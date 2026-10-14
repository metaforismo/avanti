import { and, eq, gt, like } from "drizzle-orm";
import {
  cases,
  offices,
  settings,
  documents,
  storageDeletions,
  messages,
  checklistReviews,
  nextReference,
  type Database,
} from "@avanti/db";
import {
  StartIntakeRequest,
  IntakeTurn,
  IntakeTurnResponse,
  UpdateLanguageRequest,
  UploadDocumentFields,
  ReassignDocumentRequest,
  SubmitCaseRequest,
  UPLOAD_LIMITS,
  type ChecklistItem,
  MemberInput,
  type PracticeId,
} from "@avanti/contracts";
import { calendarYear, getQuestions } from "@avanti/core";
import { applyTurn, assertProposalCurrent, assertStartable, assistantReply } from "./citizen-turn";
import { detachRemovedMembers } from "./household-cleanup";
import { heuristicAnalysis } from "./ai";
import { analyzePendingDocument, scheduleDocumentRecovery } from "./document-analysis";
import { assertImageSafe } from "./image-safety";
import { pdfPages } from "./pdf-pages";
import { retryStorageDeletions } from "./storage-cleanup";
import { safeError } from "./logging";
import {
  newToken,
  hashToken,
  hashBytes,
  ApiFailure,
  notFound,
  sanitizeName,
  sniffMime,
} from "./security";
import { citizenView, audit, type CaseRow } from "./dossier";
import { automaticAssistanceNotice } from "./disclosure";
import { currentCitizenLink } from "./citizen-link";
import { body, parse, mutableCitizen, type App, type Services, type ApiContext } from "./context";

import { nextCaseUpdate } from "./case-version";

export { assertStartable } from "./citizen-turn";
export async function createCase(
  db: Database,
  office: typeof offices.$inferSelect,
  input: { language: CaseRow["language"]; practiceId?: PracticeId; contact?: CaseRow["contact"] },
  now: Date,
  actor: "citizen" | "operator" = "citizen",
  actorId: string | null = null,
) {
  assertStartable(input.practiceId);
  const token = newToken();
  const [config] = await db
    .select()
    .from(settings)
    .where(eq(settings.organizationId, office.organizationId));
  const [row] = await db
    .insert(cases)
    .values({
      id: crypto.randomUUID(),
      organizationId: office.organizationId,
      officeId: office.id,
      tokenHash: hashToken(token),
      reference: await nextReference(db, office.organizationId, calendarYear(now)),
      language: input.language,
      practiceId: input.practiceId ?? null,
      status: "intake",
      answers: {},
      contact: input.contact ?? null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + (config?.linkDays ?? 60) * 86400000).toISOString(),
    })
    .returning();
  if (!row) throw new Error("Case insert failed");
  await db.insert(messages).values({
    id: crypto.randomUUID(),
    caseId: row.id,
    role: "system",
    text: automaticAssistanceNotice[row.language],
    originalText: automaticAssistanceNotice.it,
    createdAt: now.toISOString(),
  });
  await audit(db, row, actor, "case.created", now, actorId);
  return { token, row };
}
async function lockCase(db: Database, row: CaseRow, now: Date) {
  const fresh = await currentCitizenLink(db, row, now, true);
  mutableCitizen(fresh);
  return fresh;
}
async function touchCase(db: Database, row: CaseRow, now: Date) {
  const [updated] = await db
    .update(cases)
    .set({ updatedAt: nextCaseUpdate(row, now) })
    .where(eq(cases.id, row.id))
    .returning();
  if (!updated) throw notFound();
  return updated;
}
async function download(c: ApiContext, s: Services, row: CaseRow, id: string) {
  const [document] = await s.db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.caseId, row.id)))
    .limit(1);
  if (!document) throw notFound();
  const bytes = await s.storage.get(document.storageKey);
  if (!c.get("operator")) await currentCitizenLink(s.db, row, s.clock());
  const disposition = "attachment";
  const name = sanitizeName(document.fileName, document.mimeType);
  const encodedName = encodeURIComponent(name).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  c.header("Content-Type", document.mimeType);
  c.header(
    "Content-Disposition",
    `${disposition}; filename="${sanitizeName("documento", document.mimeType)}"; filename*=UTF-8''${encodedName}`,
  );
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Content-Security-Policy", "default-src 'none'; sandbox; frame-ancestors 'none'");
  const operator = c.get("operator");
  await audit(
    s.db,
    row,
    operator ? "operator" : "citizen",
    "document.downloaded",
    s.clock(),
    operator?.id ?? null,
  );
  return c.body(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
  );
}
export { download };

function uploadChecklistItem(
  checklist: ChecklistItem[],
  requestedId: string | undefined,
  detectedRequirementId: string | null,
) {
  if (requestedId) {
    const item = checklist.find((entry) => entry.id === requestedId);
    if (!item) {
      throw new ApiFailure("conflict", 409, "La checklist è cambiata. Riprova il caricamento.");
    }
    return item;
  }
  const candidates = checklist.filter((item) => item.requirementId === detectedRequirementId);
  return candidates.length === 1 ? candidates[0] : undefined;
}

export function mountCitizenRoutes(app: App, s: Services) {
  app.post("/intake", async (c) => {
    const input = await body(c, StartIntakeRequest);
    const [office] = await s.db
      .select()
      .from(offices)
      .where(eq(offices.slug, input.officeSlug))
      .limit(1);
    if (!office) throw notFound();
    const result = await s.db.transaction(async (tx) => {
      const created = await createCase(tx, office, input, s.clock());
      await audit(tx, created.row, "citizen", "privacy.accepted", s.clock(), null, {
        noticeVersion: 1,
      });
      return created;
    });
    return c.json(
      { token: result.token, case: await citizenView(s.db, result.row, s.clock()) },
      201,
    );
  });
  app.get("/c/:token", async (c) => {
    const row = c.get("citizen");
    const view = await citizenView(s.db, row, s.clock());
    scheduleDocumentRecovery(s, row.id);
    return c.json(view);
  });
  app.post("/c/:token/turn", async (c) => {
    const input = await body(c, IntakeTurn);
    const initial = c.get("citizen");
    mutableCitizen(initial);
    const proposal =
      input.type === "text"
        ? await s.ai.intake(
            input.text,
            initial.language,
            initial.practiceId,
            initial.practiceId
              ? getQuestions(initial.practiceId, initial.answers, initial.language)
              : [],
            s.clock(),
          )
        : null;
    const result = await s.db.transaction(async (tx) => {
      const current = await lockCase(tx, initial, s.clock());
      const now = s.clock();
      if (proposal) assertProposalCurrent(initial, current);
      const { practiceId, answers, unavailablePractice } = applyTurn(current, input, proposal, now);
      const [updated] = await tx
        .update(cases)
        .set({
          practiceId,
          answers,
          confirmedAnswers: confirmedAnswers(current, input, answers),
          editingQuestion: editingQuestion(input, answers),
          updatedAt: nextCaseUpdate(current, s.clock()),
        })
        .where(eq(cases.id, current.id))
        .returning();
      if (!updated) throw notFound();
      await detachRemovedMembers(tx, current, updated);
      await audit(
        tx,
        updated,
        "citizen",
        input.type === "edit" ? "answer.edited" : "answer.updated",
        s.clock(),
        null,
        { answersCount: Object.keys(answers).length, heuristic: proposal?.engine === "heuristic" },
      );
      if (input.type === "text") {
        await tx.insert(messages).values({
          id: crypto.randomUUID(),
          caseId: current.id,
          role: "citizen",
          text: input.text,
          createdAt: now.toISOString(),
        });
        const view = await citizenView(tx, updated, now);
        await tx.insert(messages).values({
          id: crypto.randomUUID(),
          caseId: current.id,
          role: "assistant",
          text: assistantReply(
            view,
            proposal,
            current.answers,
            input.text,
            current.practiceId,
            unavailablePractice,
          ),
          createdAt: s.clock().toISOString(),
        });
      }
      return { row: updated, unavailablePractice };
    });
    return c.json(
      IntakeTurnResponse.parse({
        ...(await citizenView(s.db, result.row, s.clock())),
        unavailablePractice: result.unavailablePractice,
        ...(proposal ? { engine: proposal.engine } : {}),
      }),
    );
  });
  app.put("/c/:token/language", async (c) => {
    const input = await body(c, UpdateLanguageRequest);
    const row = await s.db.transaction(async (tx) => {
      const current = await lockCase(tx, c.get("citizen"), s.clock());
      const [updated] = await tx
        .update(cases)
        .set({ language: input.language, updatedAt: nextCaseUpdate(current, s.clock()) })
        .where(eq(cases.id, current.id))
        .returning();
      if (!updated) throw notFound();
      await audit(tx, updated, "citizen", "language.updated", s.clock());
      return updated;
    });
    return c.json(await citizenView(s.db, row, s.clock()));
  });
  app.post("/c/:token/documents", async (c) => {
    const initial = c.get("citizen");
    mutableCitizen(initial);
    const id = crypto.randomUUID();
    const leaseId = `upload:${id}`;
    const requestedKey = `${initial.organizationId}/${initial.id}/${id}`;
    let key = requestedKey;
    let writeStarted = false;
    let putSucceeded = false;
    let committed = false;
    // Reserve before consuming the body. Submit and other instances share the case lock.
    await s.db.transaction(async (tx) => {
      await lockCase(tx, initial, s.clock());
      await tx.insert(storageDeletions).values({
        id: leaseId,
        caseId: initial.id,
        storageKey: requestedKey,
        createdAt: s.clock().toISOString(),
        nextAttemptAt: new Date(s.clock().getTime() + 600000).toISOString(),
      });
    });
    try {
      let form: FormData;
      try {
        form = await c.req.formData();
      } catch {
        throw new ApiFailure("bad_request", 400, "Caricamento non valido.");
      }
      const file = form.get("file");
      if (!(file instanceof File))
        throw new ApiFailure("bad_request", 400, "Scegli un file da caricare.");
      if (!file.size) throw new ApiFailure("unsupported_file", 415, "Il file è vuoto.");
      if (form.getAll("file").length !== 1)
        throw new ApiFailure("bad_request", 400, "Carica un solo file alla volta.");
      if (file.size > UPLOAD_LIMITS.maxBytes)
        throw new ApiFailure("file_too_large", 413, "Il file è troppo grande. Il limite è 4 MB.");
      const fields = parse(UploadDocumentFields, {
        checklistItemId: form.get("checklistItemId") ?? undefined,
      });
      const bytes = new Uint8Array(await file.arrayBuffer());
      const mime = sniffMime(bytes);
      if (!mime || !UPLOAD_LIMITS.mimeTypes.some((t) => t === mime))
        throw new ApiFailure("unsupported_file", 415, "Carica un PDF o un'immagine supportata.");
      if (file.type && file.type !== "application/octet-stream" && file.type !== mime)
        throw new ApiFailure(
          "unsupported_file",
          415,
          "Il tipo dichiarato non corrisponde al file.",
        );
      assertImageSafe(bytes, mime);
      const pages = await pdfPages(bytes, mime);
      const view = await citizenView(s.db, initial, s.clock());
      assertDocumentLimit(view.documents.length);
      assertCaseBytes(view.documents, file.size);
      if (fields.checklistItemId && !view.checklist.some((i) => i.id === fields.checklistItemId))
        throw new ApiFailure("bad_request", 400, "Voce della checklist non valida.");
      const fileName = sanitizeName(file.name, mime);
      const requirements = [...new Set(view.checklist.map((i) => i.requirementId))];
      const analysis = s.background
        ? heuristicAnalysis(fileName, requirements)
        : await s.ai.analyze(bytes, mime, fileName, requirements);
      writeStarted = true;
      key = await s.storage.put(requestedKey, bytes, mime);
      putSucceeded = true;
      const row = await s.db.transaction(async (tx) => {
        const current = await lockCase(tx, initial, s.clock());
        const [lease] = await tx
          .select()
          .from(storageDeletions)
          .where(
            and(
              eq(storageDeletions.id, leaseId),
              gt(storageDeletions.nextAttemptAt, s.clock().toISOString()),
            ),
          );
        if (!lease)
          throw new ApiFailure("conflict", 409, "Il caricamento è scaduto. Riprova il file.");
        const fresh = await citizenView(tx, current, s.clock());
        assertDocumentLimit(fresh.documents.length);
        assertCaseBytes(fresh.documents, file.size);
        const item = uploadChecklistItem(
          fresh.checklist,
          fields.checklistItemId,
          analysis.detectedRequirementId,
        );
        if (item)
          await tx
            .delete(checklistReviews)
            .where(
              and(eq(checklistReviews.caseId, current.id), eq(checklistReviews.itemId, item.id)),
            );
        await tx.insert(documents).values({
          id,
          caseId: current.id,
          fileName,
          mimeType: mime,
          sizeBytes: bytes.length,
          pages,
          storageKey: key,
          sha256: hashBytes(bytes),
          uploadedAt: s.clock().toISOString(),
          checklistItemId: item?.id ?? null,
          memberId: item?.memberId ?? null,
          status: s.background ? "processing" : "analyzed",
          analysis: s.background ? null : analysis,
        });
        await tx.delete(storageDeletions).where(eq(storageDeletions.id, leaseId));
        const updated = await touchCase(tx, current, s.clock());
        await audit(tx, current, "citizen", "document.uploaded", s.clock(), null, {
          bytes: bytes.length,
          heuristic: analysis.engine === "heuristic",
        });
        return updated;
      });
      committed = true;
      const response = await citizenView(s.db, row, s.clock());
      if (s.background) {
        try {
          s.background(async () => {
            try {
              await analyzePendingDocument(s, id);
            } catch {
              /* The maintenance job retries persisted processing documents. */
            }
          });
        } catch {
          /* Scheduling is optional; the durable job already exists. */
        }
      }
      return c.json(response, 201);
    } catch (error) {
      if (committed) throw error;
      if (!writeStarted) {
        await s.db.delete(storageDeletions).where(eq(storageDeletions.id, leaseId));
        throw error;
      }
      // A failed put can have an ambiguous remote result; retain its original cleanup deadline.
      if (!putSucceeded) throw error;
      try {
        await s.storage.delete(key);
        await s.db.delete(storageDeletions).where(eq(storageDeletions.id, leaseId));
      } catch (cleanupError) {
        await s.db
          .insert(storageDeletions)
          .values({
            id: leaseId,
            caseId: initial.id,
            storageKey: key,
            createdAt: s.clock().toISOString(),
            nextAttemptAt: s.clock().toISOString(),
          })
          .onConflictDoUpdate({
            target: storageDeletions.id,
            set: { storageKey: key, nextAttemptAt: s.clock().toISOString() },
          })
          .catch((insertError) => {
            (s.errorLogger ?? console.error)({
              requestId: c.get("requestId"),
              ...safeError(insertError),
            });
          });
        (s.storageLogger ?? console.error)({
          op: "upload.rollback",
          caseId: initial.id,
          documentId: id,
          errorName: safeError(cleanupError).name,
        });
      }
      throw error;
    }
  });
  app.patch("/c/:token/documents/:id", async (c) => {
    const input = await body(c, ReassignDocumentRequest);
    const row = await s.db.transaction(async (tx) => {
      const current = await lockCase(tx, c.get("citizen"), s.clock());
      const view = await citizenView(tx, current, s.clock());
      const item = view.checklist.find((i) => i.id === input.checklistItemId);
      if (input.checklistItemId && !item)
        throw new ApiFailure("bad_request", 400, "Voce della checklist non valida.");
      const [previous] = await tx
        .select()
        .from(documents)
        .where(and(eq(documents.id, c.req.param("id")), eq(documents.caseId, current.id)));
      if (!previous) throw notFound();
      for (const itemId of new Set([previous.checklistItemId, input.checklistItemId]))
        if (itemId)
          await tx
            .delete(checklistReviews)
            .where(
              and(eq(checklistReviews.caseId, current.id), eq(checklistReviews.itemId, itemId)),
            );
      const updated = await tx
        .update(documents)
        .set({ checklistItemId: input.checklistItemId, memberId: item?.memberId ?? null })
        .where(and(eq(documents.id, c.req.param("id")), eq(documents.caseId, current.id)))
        .returning();
      if (!updated.length) throw notFound();
      const touched = await touchCase(tx, current, s.clock());
      await audit(tx, touched, "citizen", "document.reassigned", s.clock());
      return touched;
    });
    return c.json(await citizenView(s.db, row, s.clock()));
  });
  app.delete("/c/:token/documents/:id", async (c) => {
    const row = await s.db.transaction(async (tx) => {
      const current = await lockCase(tx, c.get("citizen"), s.clock());
      const [deleted] = await tx
        .delete(documents)
        .where(and(eq(documents.id, c.req.param("id")), eq(documents.caseId, current.id)))
        .returning();
      if (!deleted) throw notFound();
      await tx.insert(storageDeletions).values({
        id: deleted.id,
        caseId: current.id,
        storageKey: deleted.storageKey,
        createdAt: s.clock().toISOString(),
        nextAttemptAt: s.clock().toISOString(),
      });
      if (deleted.checklistItemId)
        await tx
          .delete(checklistReviews)
          .where(
            and(
              eq(checklistReviews.caseId, current.id),
              eq(checklistReviews.itemId, deleted.checklistItemId),
            ),
          );
      const touched = await touchCase(tx, current, s.clock());
      await audit(tx, touched, "citizen", "document.deleted", s.clock());
      return touched;
    });
    await retryStorageDeletions(s, c.req.param("id"));
    return c.json(await citizenView(s.db, row, s.clock()));
  });
  app.get("/c/:token/documents/:id/file", (c) =>
    download(c, s, c.get("citizen"), c.req.param("id")),
  );
  app.post("/c/:token/submit", async (c) => {
    const input = await body(c, SubmitCaseRequest);
    const row = await s.db.transaction(async (tx) => {
      const current = await lockCase(tx, c.get("citizen"), s.clock());
      const [upload] = await tx
        .select({ id: storageDeletions.id })
        .from(storageDeletions)
        .where(
          and(
            eq(storageDeletions.caseId, current.id),
            like(storageDeletions.id, "upload:%"),
            gt(storageDeletions.nextAttemptAt, s.clock().toISOString()),
          ),
        )
        .limit(1);
      const [processing] = await tx
        .select({ id: documents.id })
        .from(documents)
        .where(and(eq(documents.caseId, current.id), eq(documents.status, "processing")))
        .limit(1);
      if (upload || processing)
        throw new ApiFailure(
          "conflict",
          409,
          "Attendi la fine del caricamento e dell'analisi dei documenti prima di inviare.",
        );
      const view = await citizenView(tx, current, s.clock(), current.language, true);
      if (!current.practiceId || view.nextQuestion)
        throw new ApiFailure("conflict", 409, "Completa le domande prima di inviare il fascicolo.");
      const [updated] = await tx
        .update(cases)
        .set({
          status: "submitted",
          contact: input.contact,
          citizenNote: input.note ?? null,
          submittedAt: current.submittedAt ?? s.clock().toISOString(),
          firstSubmissionComplete:
            current.firstSubmissionComplete ?? view.findings.every((f) => f.severity !== "blocker"),
          updatedAt: nextCaseUpdate(current, s.clock()),
        })
        .where(eq(cases.id, current.id))
        .returning();
      if (!updated) throw notFound();
      await audit(tx, updated, "citizen", "case.submitted", s.clock(), null, {
        blockers: view.findings.filter((f) => f.severity === "blocker").length,
        first: current.submittedAt === null,
      });
      return updated;
    });
    return c.json(await citizenView(s.db, row, s.clock()));
  });
}

function confirmedAnswers(
  current: CaseRow,
  input: IntakeTurn,
  answers: CaseRow["answers"],
): string[] {
  const confirmed = current.confirmedAnswers.filter((id) => Object.hasOwn(answers, id));
  if ((input.type === "answer" || input.type === "skip") && !confirmed.includes(input.questionId))
    confirmed.push(input.questionId);
  if (input.type === "choose_practice" && input.practiceId !== current.practiceId) return [];
  return confirmed;
}
export const MAX_CASE_BYTES = 120 * 1024 * 1024;
export const MAX_CASE_DOCUMENTS = 60;
function assertCaseBytes(stored: { sizeBytes: number }[], incoming: number) {
  if (stored.reduce((total, document) => total + document.sizeBytes, incoming) > MAX_CASE_BYTES)
    throw new ApiFailure(
      "conflict",
      409,
      "Hai raggiunto il limite di 120 MB per fascicolo. Elimina i documenti non necessari.",
    );
}
function assertDocumentLimit(count: number) {
  if (count >= MAX_CASE_DOCUMENTS)
    throw new ApiFailure(
      "conflict",
      409,
      "Hai raggiunto il limite di 60 documenti. Elimina quelli non necessari.",
    );
}

function editingQuestion(input: IntakeTurn, answers: CaseRow["answers"]): string | null {
  if (input.type === "edit") return input.questionId;
  const members = MemberInput.array().safeParse(answers.members);
  if (
    members.success &&
    typeof answers.household_count === "number" &&
    members.data.length !== answers.household_count
  )
    return "members";
  return null;
}
