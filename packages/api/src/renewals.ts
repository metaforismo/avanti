import { and, asc, eq, gt, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { cases, documents, offices, organizations, settings } from "@avanti/db";
import {
  CreateRenewalsRequest,
  CreateRenewalsResponse,
  RenewalConsentRequest,
  RenewalsQuery,
  RenewalsResponse,
  ReuseCaseRequest,
  type RenewalStatus,
} from "@avanti/contracts";
import { assessDocumentReuse, buildChecklist, buildHousehold, practiceYear } from "@avanti/core";
import { body, parse, type App, type Services } from "./context";
import { audit, iso, type CaseRow } from "./dossier";
import { currentCitizenLink } from "./citizen-link";
import { createReusedCase, eligibleReuseDocuments } from "./family-reuse";
import { pastRetention } from "./case-erasure";
import { lockOperatorAccess } from "./operator-access";
import { ApiFailure, hashToken, newToken, notFound } from "./security";
import { nextCaseUpdate } from "./case-version";
import { enqueueRenewalInvitation, scheduleNotificationDelivery } from "./notifications";
import { lockRenewalConsent, setRenewalConsent } from "./renewal-consent";
import { recordActivity } from "./audit-log";

export function renewalStatus(
  row: Pick<CaseRow, "submittedAt" | "renewalSourceId" | "renewalHouseholdConfirmedAt"> | null,
): RenewalStatus {
  return !row
    ? "not_invited"
    : row.submittedAt
      ? "submitted"
      : !row.renewalSourceId || row.renewalHouseholdConfirmedAt
        ? "started"
        : "invited";
}

function documentCounts(
  source: CaseRow,
  stored: (typeof documents.$inferSelect)[],
  year: number,
  now: Date,
) {
  const household = buildHousehold(source.answers);
  const answers = { members: household, household_count: household.length, practice_year: year };
  const oldChecklist = buildChecklist("isee_ordinario", source.answers, household, "it");
  const checklist = buildChecklist("isee_ordinario", answers, household, "it");
  const counts = { valid: 0, toUpdate: 0, toVerify: 0 };
  for (const doc of eligibleReuseDocuments(source, household, stored)) {
    const requirementId =
      oldChecklist.find((item) => item.id === doc.checklistItemId)?.requirementId ??
      doc.analysis?.detectedRequirementId ??
      null;
    const targets = checklist.filter(
      (item) => item.requirementId === requirementId && item.memberId === doc.memberId,
    );
    const result = assessDocumentReuse({
      analysis: doc.analysis,
      status: doc.status,
      applicable: targets.length === 1,
      requirementId,
      sourceYear: doc.reusedFromYear ?? practiceYear(source.answers),
      practiceId: "isee_ordinario",
      answers,
      member: household.find((m) => m.id === doc.memberId) ?? null,
      previousMember: doc.reusedMember ?? household.find((m) => m.id === doc.memberId) ?? null,
      now,
    });
    counts[
      result.status === "valido"
        ? "valid"
        : result.status === "da_aggiornare"
          ? "toUpdate"
          : "toVerify"
    ]++;
  }
  return counts;
}

export function mountRenewalRoutes(app: App, s: Services) {
  app.get("/renewals", async (c) => {
    const q = parse(RenewalsQuery, c.req.query());
    const actor = c.get("operator");
    const now = s.clock();
    const target = alias(cases, "renewal_target");
    // A family may already have a target created through ordinary reuse. Choose one
    // deterministically rather than multiplying campaign rows for older duplicates.
    const targetJoin = sql`${target.id} = (select r.id from cases r
      where r.organization_id = ${cases.organizationId} and r.practice_id = 'isee_ordinario'
      and coalesce((r.answers->>'practice_year')::int, 2027) = ${q.year}
      and (r.renewal_source_id = ${cases.id} or (${cases.familyId} is not null and r.family_id = ${cases.familyId}))
      order by r.created_at, r.id limit 1)`;
    const state = sql<RenewalStatus>`case when ${target.id} is null then 'not_invited'
      when ${target.submittedAt} is not null then 'submitted'
      when ${target.renewalSourceId} is null or ${target.renewalHouseholdConfirmedAt} is not null then 'started'
      else 'invited' end`;
    const eligible = and(
      eq(cases.organizationId, actor.organizationId),
      eq(cases.practiceId, "isee_ordinario"),
      inArray(cases.status, ["ready", "submitted"]),
      sql`coalesce((${cases.answers}->>'practice_year')::int, 2027) = ${q.year - 1}`,
      sql`not (${pastRetention(now)})`,
    );
    const result = await s.db.transaction(async (tx) => {
      await tx.execute(sql`set transaction isolation level repeatable read`);
      const counts = { not_invited: 0, invited: 0, started: 0, submitted: 0 };
      const totals = await tx
        .select({ state, count: sql<number>`count(*)::int` })
        .from(cases)
        .leftJoin(settings, eq(settings.organizationId, cases.organizationId))
        .leftJoin(target, targetJoin)
        .where(eligible)
        .groupBy(state);
      for (const total of totals) counts[total.state] = total.count;
      const rows = await tx
        .select({ source: cases, targetId: target.id, invitedAt: target.renewalInvitedAt, state })
        .from(cases)
        .leftJoin(settings, eq(settings.organizationId, cases.organizationId))
        .leftJoin(target, targetJoin)
        .where(
          and(
            eligible,
            q.status === "all" ? undefined : sql`${state} = ${q.status}`,
            q.after ? gt(cases.id, q.after) : undefined,
          ),
        )
        .orderBy(asc(cases.id))
        .limit(q.limit + 1);
      const page = rows.slice(0, q.limit);
      const stored = page.length
        ? await tx
            .select()
            .from(documents)
            .where(
              inArray(
                documents.caseId,
                page.map((r) => r.source.id),
              ),
            )
        : [];
      await recordActivity(tx, actor.organizationId, actor.id, "renewals.listed", now, null, {
        year: q.year,
        cases: page.length,
      });
      return RenewalsResponse.parse({
        year: q.year,
        counts,
        nextAfter: rows.length > q.limit ? page.at(-1)!.source.id : null,
        items: page.map(({ source, targetId, invitedAt, state: status }) => ({
          sourceCaseId: source.id,
          reference: source.reference,
          citizenName: source.contact?.firstName
            ? [source.contact.firstName, source.contact.lastName].filter(Boolean).join(" ")
            : null,
          householdCount: buildHousehold(source.answers).length,
          documents: documentCounts(
            source,
            stored.filter((doc) => doc.caseId === source.id),
            q.year,
            now,
          ),
          status,
          renewalCaseId: targetId,
          lastInvitedAt: invitedAt ? iso(invitedAt) : null,
        })),
      });
    });
    c.header("Cache-Control", "private, no-store");
    return c.json(result);
  });

  app.post("/renewals", async (c) => {
    const input = await body(c, CreateRenewalsRequest);
    const result = await s.db.transaction(async (tx) => {
      const tenant = c.get("operator").organizationId;
      // Excludes ordinary reuse and family erasure while checking all family/year
      // targets, including batches selecting different sources of the same family.
      await tx
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.id, tenant))
        .for("no key update");
      const actor = await lockOperatorAccess(tx, c, s);
      const now = s.clock();
      const sources = await tx
        .select({ source: cases })
        .from(cases)
        .leftJoin(settings, eq(settings.organizationId, cases.organizationId))
        .where(
          and(
            eq(cases.organizationId, tenant),
            inArray(cases.id, input.sourceCaseIds),
            sql`not (${pastRetention(now)})`,
          ),
        )
        .orderBy(cases.id)
        .for("update", { of: cases });
      if (sources.length !== input.sourceCaseIds.length) throw notFound();
      const items: CreateRenewalsResponse["items"] = [];
      const notificationIds: string[] = [];
      const handled = new Set<string>();
      // Locks were acquired by ID; process in request order so the first selected
      // source supplies the household, language and preference for a shared target.
      sources.sort(
        (a, b) =>
          input.sourceCaseIds.indexOf(a.source.id) - input.sourceCaseIds.indexOf(b.source.id),
      );
      for (const { source } of sources) {
        if (
          source.practiceId !== "isee_ordinario" ||
          !["ready", "submitted"].includes(source.status) ||
          practiceYear(source.answers) !== input.year - 1
        )
          throw new ApiFailure(
            "conflict",
            409,
            "Seleziona pratiche ISEE pronte o inviate dell'anno precedente.",
          );
        const [existing] = await tx
          .select()
          .from(cases)
          .where(
            and(
              eq(cases.organizationId, tenant),
              eq(cases.practiceId, "isee_ordinario"),
              sql`coalesce((${cases.answers}->>'practice_year')::int, 2027) = ${input.year}`,
              or(
                eq(cases.renewalSourceId, source.id),
                source.familyId ? eq(cases.familyId, source.familyId) : undefined,
              ),
            ),
          )
          .orderBy(cases.createdAt, cases.id)
          .limit(1)
          .for("update");
        if (existing && handled.has(existing.id)) {
          items.push({
            sourceCaseId: source.id,
            caseId: existing.id,
            reference: existing.reference,
            status: renewalStatus(existing),
            created: false,
            citizenLink: null,
            invitation: "existing",
          });
          continue;
        }
        let row: CaseRow;
        let token: string | null = null;
        if (existing) {
          row = existing;
          if (input.regenerateLinks) {
            if (
              !row.renewalYear ||
              row.submittedAt ||
              !["intake", "needs_citizen"].includes(row.status)
            )
              throw new ApiFailure(
                "conflict",
                409,
                "Il fascicolo esistente non consente la rigenerazione dalla campagna.",
              );
            const [retained] = await tx
              .select({ id: cases.id })
              .from(cases)
              .leftJoin(settings, eq(settings.organizationId, cases.organizationId))
              .where(and(eq(cases.id, row.id), sql`not (${pastRetention(now)})`));
            if (!retained)
              throw new ApiFailure(
                "conflict",
                409,
                "Il rinnovo ha superato il periodo di conservazione.",
              );
            const [config] = await tx
              .select()
              .from(settings)
              .where(eq(settings.organizationId, tenant));
            token = newToken();
            const [updated] = await tx
              .update(cases)
              .set({
                tokenHash: hashToken(token),
                expiresAt: new Date(
                  now.getTime() + (config?.linkDays ?? 60) * 86400000,
                ).toISOString(),
                renewalInvitedAt: now.toISOString(),
                updatedAt: nextCaseUpdate(row, now),
              })
              .where(eq(cases.id, row.id))
              .returning();
            if (!updated) throw notFound();
            row = updated;
            await audit(tx, row, "operator", "renewal.link_regenerated", now, actor.id, {
              year: input.year,
            });
          }
        } else {
          const [office] = await tx
            .select()
            .from(offices)
            .where(and(eq(offices.id, source.officeId), eq(offices.organizationId, tenant)));
          if (!office) throw notFound();
          const request = ReuseCaseRequest.safeParse({
            officeId: office.id,
            practiceId: "isee_ordinario",
            practiceYear: input.year,
            language: source.language,
            members: buildHousehold(source.answers),
            confirmed: true,
          });
          if (!request.success)
            throw new ApiFailure(
              "conflict",
              409,
              "Completa il nucleo della pratica sorgente prima di creare il rinnovo.",
            );
          const created = await createReusedCase(tx, source, office, request.data, now, actor.id);
          token = created.token;
          const [updated] = await tx
            .update(cases)
            .set({
              renewalSourceId: source.id,
              renewalYear: input.year,
              answers: { ...created.row.answers, renewal_household_confirmed: false },
              confirmedAnswers: [],
              renewalContactConsentAt: source.renewalContactConsentAt,
              renewalInvitedAt: now.toISOString(),
            })
            .where(eq(cases.id, created.row.id))
            .returning();
          if (!updated) throw notFound();
          row = updated;
          await audit(tx, row, "operator", "renewal.created", now, actor.id, { year: input.year });
        }
        const citizenLink = token ? `${s.publicUrl.replace(/\/$/, "")}/pratica/${token}` : null;
        const invitation = citizenLink
          ? await enqueueRenewalInvitation(tx, s, row, citizenLink)
          : { status: "existing" as const, id: undefined };
        if (invitation.id) notificationIds.push(invitation.id);
        handled.add(row.id);
        items.push({
          sourceCaseId: source.id,
          caseId: row.id,
          reference: row.reference,
          status: renewalStatus(row),
          created: !existing,
          citizenLink,
          invitation: invitation.status,
        });
      }
      return {
        response: CreateRenewalsResponse.parse({ year: input.year, items }),
        notificationIds,
      };
    });
    for (const id of result.notificationIds) scheduleNotificationDelivery(s, id);
    c.header("Cache-Control", "private, no-store");
    return c.json(result.response);
  });

  app.put("/c/:token/renewal-consent", async (c) => {
    const input = await body(c, RenewalConsentRequest);
    const row = await s.db.transaction(async (tx) => {
      await lockRenewalConsent(tx, c.get("citizen"));
      const current = await currentCitizenLink(tx, c.get("citizen"), s.clock(), true);
      const now = s.clock();
      await setRenewalConsent(tx, current, input.consented, now);
      await audit(tx, current, "citizen", "renewal.consent_updated", now, null, {
        consented: input.consented,
      });
      return { consented: input.consented };
    });
    return c.json(row);
  });
}
