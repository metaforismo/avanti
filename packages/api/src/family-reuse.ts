import { and, desc, eq, sql } from "drizzle-orm";
import { cases, documents, offices, type Database } from "@avanti/db";
import {
  CheckDocumentReuseRequest,
  DocumentAnalysis,
  EraseFamilyRequest,
  FamilySearchRequest,
  FamilySearchResponse,
  Id,
  ReuseCaseRequest,
  ReuseCaseResponse,
} from "@avanti/contracts";
import {
  buildChecklist,
  buildHousehold,
  calendarDate,
  practiceYear,
  sameMemberIdentity,
} from "@avanti/core";
import { normalizedName } from "@avanti/core";
import { body, parse, type App, type Services } from "./context";
import { audit, caseById, dossierView, type CaseRow } from "./dossier";
import { createCase } from "./citizen";
import { storeMemberIds } from "./household-ids";
import { lockOperatorAccess } from "./operator-access";
import { ApiFailure, notFound } from "./security";
import { recordActivity } from "./audit-log";
import { administer } from "./routes/administration";
import { eraseCase } from "./case-erasure";
import { retryStorageDeletions } from "./storage-cleanup";
import { deadline } from "./deadline";
import { nextCaseUpdate } from "./case-version";

const bad = (message: string) => new ApiFailure("bad_request", 400, message);

export function mountFamilyReuseRoutes(app: App, s: Services) {
  app.post("/cases/families/search", async (c) => {
    const input = await body(c, FamilySearchRequest);
    const result = await s.db.transaction(async (tx) => {
      const actor = await lockOperatorAccess(tx, c, s);
      // Exact applicant match. The bound JSON never becomes a SQL or log fragment.
      const matches =
        "taxCode" in input
          ? sql`upper(m->>'taxCode') = ${input.taxCode}`
          : sql`lower(regexp_replace(trim(m->>'firstName'), '\\s+', ' ', 'g')) = ${normalizedName(input.firstName)} and lower(regexp_replace(trim(m->>'lastName'), '\\s+', ' ', 'g')) = ${normalizedName(input.lastName)} and m->>'birthDate' = ${input.birthDate}`;
      const rows = await tx
        .select()
        .from(cases)
        .where(
          and(
            eq(cases.organizationId, actor.organizationId),
            sql`exists (select 1 from jsonb_array_elements(case when jsonb_typeof(${cases.answers}->'members') = 'array' then ${cases.answers}->'members' else '[]'::jsonb end) m where m->>'role' = 'richiedente' and ${matches})`,
          ),
        )
        .orderBy(desc(cases.updatedAt), desc(cases.id))
        .limit(51);
      const items = rows.slice(0, 50).flatMap((row) => {
        const applicant = buildHousehold(row.answers).find(
          (member) => member.role === "richiedente",
        );
        return applicant
          ? [
              {
                caseId: row.id,
                reference: row.reference,
                practiceId: row.practiceId,
                practiceYear: practiceYear(row.answers),
                applicant,
              },
            ]
          : [];
      });
      await recordActivity(tx, actor.organizationId, actor.id, "family.searched", s.clock(), null, {
        cases: items.length,
      });
      return FamilySearchResponse.parse({ items, truncated: rows.length > 50 });
    });
    return c.json(result);
  });

  app.post("/cases/:id/reuse", async (c) => {
    const input = await body(c, ReuseCaseRequest);
    const id = parse(Id, c.req.param("id"));
    const { row, token } = await s.db.transaction(async (tx) => {
      const actor = await lockOperatorAccess(tx, c, s);
      // Copy shares the same source-row lock as unlink, retention and erasure.
      const source = await caseById(tx, id, actor.organizationId, true);
      const [office] = await tx
        .select()
        .from(offices)
        .where(
          and(eq(offices.id, input.officeId), eq(offices.organizationId, actor.organizationId)),
        );
      if (!office) throw notFound();
      return createReusedCase(tx, source, office, input, s.clock(), actor.id);
    });
    const citizenLink = `${s.publicUrl.replace(/\/$/, "")}/pratica/${token}`;
    return c.json(
      ReuseCaseResponse.parse({
        case: { ...(await dossierView(s.db, row, s.clock())), citizenLink },
        citizenLink,
      }),
      201,
    );
  });

  app.post("/cases/:id/documents/:docId/reuse-check", async (c) => {
    const input = await body(c, CheckDocumentReuseRequest);
    const id = parse(Id, c.req.param("id"));
    const docId = parse(Id, c.req.param("docId"));
    const actor = c.get("operator");
    const row = await caseById(s.db, id, actor.organizationId);
    const view = await dossierView(s.db, row, s.clock());
    const summary = view.documents.find((doc) => doc.id === docId);
    if (!summary?.reuse) throw notFound();
    const [document] = await s.db
      .select()
      .from(documents)
      .where(and(eq(documents.id, docId), eq(documents.caseId, row.id)));
    if (!document) throw notFound();
    let analysis: DocumentAnalysis | null = null;
    if (
      input.useAi &&
      summary.reuse.status === "da_verificare" &&
      summary.reuse.code === "uncertain" &&
      document.checklistItemId &&
      document.memberId &&
      s.ai.configured
    ) {
      const bytes = await deadline(s.storage.get(document.storageKey), 10_000);
      try {
        const observed = DocumentAnalysis.parse(
          await deadline(
            s.ai.analyze(bytes, document.mimeType, document.fileName, [
              ...new Set(view.checklist.map((item) => item.requirementId)),
            ]),
            25_000,
          ),
        );
        if (observed.engine === "ai") analysis = observed;
      } catch {
        /* Keep the original evidence and the uncertain state on provider failure. */
      }
    }
    const assessment = await s.db.transaction(async (tx) => {
      await lockOperatorAccess(tx, c, s);
      const current = await caseById(tx, id, actor.organizationId, true);
      const [fresh] = await tx
        .select()
        .from(documents)
        .where(and(eq(documents.id, docId), eq(documents.caseId, id)));
      if (!fresh || fresh.reusedFromYear === null) throw notFound();
      if (
        analysis &&
        (current.updatedAt !== row.updatedAt || JSON.stringify(fresh) !== JSON.stringify(document))
      )
        throw new ApiFailure("conflict", 409, "Il fascicolo è cambiato. Ripeti il controllo.");
      if (analysis) {
        await tx
          .update(documents)
          .set({ analysis, status: "analyzed" })
          .where(eq(documents.id, docId));
        await tx
          .update(cases)
          .set({ updatedAt: nextCaseUpdate(current, s.clock()) })
          .where(eq(cases.id, id));
      }
      const result = (await dossierView(tx, current, s.clock())).documents.find(
        (doc) => doc.id === docId,
      )?.reuse;
      if (!result) throw notFound();
      await audit(tx, current, "operator", "document.reuse_checked", s.clock(), actor.id, {
        heuristic: !analysis,
      });
      return result;
    });
    return c.json(assessment);
  });

  app.post("/cases/:id/family-erasure", async (c) => {
    const input = await body(c, EraseFamilyRequest);
    const id = parse(Id, c.req.param("id"));
    const actor = c.get("operator");
    const deletedIds = await administer(s, c, async (tx) => {
      // Tenant lock held by administer prevents new links while the group is enumerated.
      const source = await caseById(tx, id, actor.organizationId);
      if (input.confirmReference.toLowerCase() !== source.reference.toLowerCase())
        throw bad("Il riferimento non corrisponde al fascicolo.");
      const linked = await tx
        .select()
        .from(cases)
        .where(
          and(
            eq(cases.organizationId, actor.organizationId),
            source.familyId ? eq(cases.familyId, source.familyId) : eq(cases.id, source.id),
          ),
        )
        .orderBy(cases.id)
        .for("update");
      for (const row of linked) await eraseCase(tx, row, s.clock(), actor.id);
      await recordActivity(tx, actor.organizationId, actor.id, "family.erased", s.clock(), null, {
        cases: linked.length,
      });
      return linked.map((row) => row.id);
    });
    for (const caseId of deletedIds) await retryStorageDeletions(s, undefined, caseId);
    return c.json({ deletedCases: deletedIds.length });
  });
}

// Caller holds tenant authorization and the source row lock.
export async function createReusedCase(
  tx: Database,
  source: CaseRow,
  office: typeof offices.$inferSelect,
  input: ReuseCaseRequest,
  now: Date,
  actorId: string,
) {
  const before = buildHousehold(source.answers);
  const answers = storeMemberIds(
    {
      members: input.members,
      household_count: input.members.length,
      household_roles: input.members.map((m) => m.role),
      household_relations: [],
      practice_year: input.practiceYear,
    },
    source.answers,
    false,
  );
  const household = buildHousehold(answers);
  if (
    household.some(
      (member) =>
        (member.birthDate && member.birthDate > calendarDate(now)) ||
        (member.birthYear && member.birthYear > Number(calendarDate(now).slice(0, 4))) ||
        (member.birthDate &&
          member.birthYear &&
          Number(member.birthDate.slice(0, 4)) !== member.birthYear),
    )
  )
    throw bad("Controlla le date di nascita del nucleo.");
  const sourceApplicant = before.find((member) => member.role === "richiedente");
  const applicant = household.find((member) => member.role === "richiedente");
  if (!sourceApplicant || !applicant || !sameMemberIdentity(sourceApplicant, applicant))
    throw bad("Per riusare il nucleo conferma lo stesso richiedente della pratica sorgente.");
  const sourceDocuments = await tx.select().from(documents).where(eq(documents.caseId, source.id));
  const sourceChecklist = source.practiceId
    ? buildChecklist(source.practiceId, source.answers, before, "it")
    : [];
  const eligible = eligibleReuseDocuments(source, household, sourceDocuments);
  const selected = eligible.filter(
    (doc) => !input.documentIds || input.documentIds.includes(doc.id),
  );
  if (
    input.documentIds?.some((docId) => !selected.some((doc) => doc.id === docId)) ||
    input.citizenVisibleDocumentIds.some((docId) => !selected.some((doc) => doc.id === docId))
  )
    throw bad("Alcuni documenti non appartengono al nucleo confermato o sono ancora in analisi.");
  const created = await createCase(
    tx,
    office,
    {
      language: input.language,
      practiceId: input.practiceId,
      practiceYear: input.practiceYear,
      contact: source.contact,
    },
    now,
    "operator",
    actorId,
  );
  const familyId = source.familyId ?? crypto.randomUUID();
  if (!source.familyId) await tx.update(cases).set({ familyId }).where(eq(cases.id, source.id));
  const [row] = await tx
    .update(cases)
    .set({
      familyId,
      answers,
      confirmedAnswers: ["household_count", "members"],
    })
    .where(eq(cases.id, created.row.id))
    .returning();
  if (!row) throw notFound();
  const checklist = buildChecklist(input.practiceId, answers, household, "it");
  if (selected.length)
    await tx.insert(documents).values(
      selected.map((doc) => {
        const oldItem = sourceChecklist.find((item) => item.id === doc.checklistItemId);
        const requirement = oldItem?.requirementId ?? doc.analysis?.detectedRequirementId;
        // Asset/account indexes are not portable; only one unambiguous target may be linked.
        const targets = checklist.filter(
          (item) => item.requirementId === requirement && item.memberId === doc.memberId,
        );
        return {
          id: crypto.randomUUID(),
          caseId: row.id,
          fileName: doc.fileName,
          mimeType: doc.mimeType,
          sizeBytes: doc.sizeBytes,
          pages: doc.pages,
          storageKey: doc.storageKey,
          sha256: doc.sha256,
          uploadedAt: doc.uploadedAt,
          checklistItemId: targets.length === 1 ? targets[0]!.id : null,
          memberId: doc.memberId,
          status: doc.status,
          analysis: doc.analysis,
          reusedFromYear: doc.reusedFromYear ?? practiceYear(source.answers),
          reusedMember: before.find((member) => member.id === doc.memberId) ?? null,
          citizenVisible:
            doc.memberId === applicant.id || input.citizenVisibleDocumentIds.includes(doc.id),
        };
      }),
    );
  await audit(tx, row, "operator", "case.reused", now, actorId, {
    documents: selected.length,
  });
  await audit(tx, source, "operator", "case.reused", now, actorId, {
    documents: selected.length,
  });
  return { row, token: created.token };
}

export function eligibleReuseDocuments(
  source: CaseRow,
  household: import("@avanti/contracts").Member[],
  sourceDocuments: (typeof documents.$inferSelect)[],
) {
  const before = buildHousehold(source.answers);
  const kept = new Set(
    household
      .filter((member) => before.some((old) => sameMemberIdentity(old, member)))
      .map((member) => member.id),
  );
  const checklist = source.practiceId
    ? buildChecklist(source.practiceId, source.answers, before, "it")
    : [];
  return sourceDocuments.filter(
    (doc) =>
      doc.status !== "processing" &&
      (doc.memberId
        ? kept.has(doc.memberId)
        : checklist.some((item) => item.id === doc.checklistItemId && item.memberId === null)) &&
      (!doc.reusedMember ||
        household.some((member) => sameMemberIdentity(doc.reusedMember!, member))),
  );
}
