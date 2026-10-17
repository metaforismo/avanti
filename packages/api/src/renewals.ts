import { and, asc, eq, gt, inArray, or, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { unionAll } from "drizzle-orm/pg-core";
import { alias } from "drizzle-orm/pg-core";
import {
  cases,
  documents,
  offices,
  organizations,
  settings,
  renewalReminders,
  events,
} from "@avanti/db";
import {
  CreateRenewalsRequest,
  CreateRenewalsResponse,
  RenewalConsentRequest,
  RevokeRenewalConsentRequest,
  Id,
  RenewalsQuery,
  RenewalsResponse,
  ReuseCaseRequest,
  type RenewalStatus,
} from "@avanti/contracts";
import {
  assessDocumentReuse,
  buildChecklist,
  buildHousehold,
  practiceYear,
  renewalConsentEvidence,
  DEFAULT_PRACTICE_YEAR,
} from "@avanti/core";
import { body, parse, type App, type Services } from "./context";
import { audit, iso, type CaseRow } from "./dossier";
import { currentCitizenLink } from "./citizen-link";
import { createReusedCase, eligibleReuseDocuments } from "./family-reuse";
import { pastRetention } from "./case-erasure";
import { lockOperatorAccess } from "./operator-access";
import { ApiFailure, hashToken, newToken, notFound } from "./security";
import { nextCaseUpdate } from "./case-version";
import { enqueueRenewalInvitation, scheduleNotificationDelivery } from "./notifications";
import { lockRenewalConsent, setRenewalConsent, withdrawRenewalConsent } from "./renewal-consent";
import { createCase } from "./citizen";
import { activeReminder, reminderOwner } from "./renewal-reminders";
import { recordActivity } from "./audit-log";

/** SQL twin of `practiceYear()`, so the campaign and the core never disagree on the default. */
const practiceYearSql = (answers: SQL | AnyColumn) =>
  sql`coalesce((${answers}->>'practice_year')::int, ${DEFAULT_PRACTICE_YEAR})`;

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
    const source = unionAll(
      s.db
        .select({
          id: cases.id,
          familyId: cases.familyId,
          reference: cases.reference,
          contact: cases.contact,
          answers: cases.answers,
          kind: sql<"case" | "reminder">`'case'`.as("kind"),
          consentAt: cases.renewalContactConsentAt,
          reminderExpiresAt: sql<string | null>`null::timestamptz`.as("reminder_expires_at"),
        })
        .from(cases)
        .leftJoin(settings, eq(settings.organizationId, cases.organizationId))
        .where(
          and(
            eq(cases.organizationId, actor.organizationId),
            eq(cases.practiceId, "isee_ordinario"),
            inArray(cases.status, ["ready", "submitted"]),
            sql`${practiceYearSql(cases.answers)} = ${q.year - 1}`,
            sql`not (${pastRetention(now)})`,
          ),
        ),
      s.db
        .select({
          id: renewalReminders.sourceCaseId,
          familyId: renewalReminders.familyId,
          reference: renewalReminders.reference,
          contact: renewalReminders.contact,
          answers: sql<
            CaseRow["answers"]
          >`jsonb_build_object('members', ${renewalReminders.household})`.as("answers"),
          kind: sql<"case" | "reminder">`'reminder'`.as("kind"),
          consentAt: renewalReminders.consentAt,
          reminderExpiresAt: renewalReminders.expiresAt,
        })
        .from(renewalReminders)
        .where(
          and(
            eq(renewalReminders.organizationId, actor.organizationId),
            eq(renewalReminders.practiceYear, q.year - 1),
            activeReminder(now),
          ),
        ),
    ).as("renewal_sources");
    const target = alias(cases, "renewal_target");
    const targetJoin = sql`${target.id} = (select r.id from cases r
      where r.organization_id = ${actor.organizationId} and r.practice_id = 'isee_ordinario'
      and ${practiceYearSql(sql.raw("r.answers"))} = ${q.year}
      and (r.renewal_source_id = ${source.id} or (${source.familyId} is not null and r.family_id = ${source.familyId}))
      order by r.created_at, r.id limit 1)`;
    const state = sql<RenewalStatus>`case when ${target.id} is null then 'not_invited'
      when ${target.submittedAt} is not null then 'submitted'
      when ${target.renewalSourceId} is null or ${target.renewalHouseholdConfirmedAt} is not null then 'started'
      else 'invited' end`;
    const result = await s.db.transaction(async (tx) => {
      await tx.execute(sql`set transaction isolation level repeatable read`);
      const counts = { not_invited: 0, invited: 0, started: 0, submitted: 0 };
      const totals = await tx
        .select({ state, count: sql<number>`count(*)::int` })
        .from(source)
        .leftJoin(target, targetJoin)
        .groupBy(state);
      for (const total of totals) counts[total.state] = total.count;
      const rows = await tx
        .select({
          source: {
            id: source.id,
            reference: source.reference,
            contact: source.contact,
            answers: source.answers,
            kind: source.kind,
            consentAt: source.consentAt,
            reminderExpiresAt: source.reminderExpiresAt,
          },
          targetId: target.id,
          invitedAt: target.renewalInvitedAt,
          state,
        })
        .from(source)
        .leftJoin(target, targetJoin)
        .where(
          and(
            q.status === "all" ? undefined : sql`${state} = ${q.status}`,
            q.after ? gt(source.id, q.after) : undefined,
          ),
        )
        .orderBy(asc(source.id))
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
      const caseSources = page.length
        ? await tx
            .select()
            .from(cases)
            .where(
              and(
                eq(cases.organizationId, actor.organizationId),
                inArray(
                  cases.id,
                  page.map((r) => r.source.id),
                ),
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
          sourceKind: source.kind,
          reminderExpiresAt: source.reminderExpiresAt ? iso(source.reminderExpiresAt) : null,
          renewalContactConsent: source.consentAt !== null,
          householdConfirmationRequired: status === "not_invited" || status === "invited",
          reference: source.reference,
          citizenName: source.contact?.firstName
            ? [source.contact.firstName, source.contact.lastName].filter(Boolean).join(" ")
            : null,
          householdCount: buildHousehold(source.answers).length,
          documents:
            source.kind === "reminder"
              ? { valid: 0, toUpdate: 0, toVerify: 0 }
              : documentCounts(
                  caseSources.find((r) => r.id === source.id)!,
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
      const caseSources = await tx
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
      const reminders = await tx
        .select()
        .from(renewalReminders)
        .where(
          and(
            eq(renewalReminders.organizationId, tenant),
            inArray(renewalReminders.sourceCaseId, input.sourceCaseIds),
            activeReminder(now),
          ),
        )
        .orderBy(renewalReminders.sourceCaseId)
        .for("update");
      const sources = [
        ...caseSources.map(({ source }) => ({ source, reminder: null })),
        ...reminders.map((reminder) => ({
          source: {
            ...reminderOwner(reminder),
            officeId: reminder.officeId,
            language: reminder.language,
            practiceId: "isee_ordinario" as const,
            status: "submitted" as const,
            contact: reminder.contact,
            answers: { members: reminder.household, practice_year: reminder.practiceYear },
            renewalContactConsentAt: reminder.consentAt,
            renewalContactConsentVersion: reminder.consentVersion,
          },
          reminder,
        })),
      ];
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
      for (const { source, reminder } of sources) {
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
              sql`${practiceYearSql(cases.answers)} = ${input.year}`,
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
          const created = reminder
            ? await createCase(
                tx,
                office,
                {
                  language: source.language,
                  practiceId: "isee_ordinario",
                  practiceYear: input.year,
                  contact: source.contact,
                },
                now,
                "operator",
                actor.id,
              )
            : await createReusedCase(tx, source, office, request.data, now, actor.id);
          token = created.token;
          const [updated] = await tx
            .update(cases)
            .set({
              familyId: source.familyId ?? created.row.familyId,
              renewalSourceId: source.id,
              renewalYear: input.year,
              answers: {
                ...created.row.answers,
                ...(reminder
                  ? {
                      members: buildHousehold(source.answers),
                      household_count: reminder.household.length,
                    }
                  : {}),
                renewal_household_confirmed: false,
              },
              confirmedAnswers: [],
              renewalContactConsentAt: source.renewalContactConsentAt,
              renewalContactConsentVersion: source.renewalContactConsentVersion,
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

  // The same source ID works from dossier and campaign, before or after retention.
  for (const path of ["/cases/:id/renewal-consent", "/renewals/:id/renewal-consent"]) {
    app.put(path, async (c) => {
      await body(c, RevokeRenewalConsentRequest);
      const id = parse(Id, c.req.param("id"));
      await s.db.transaction(async (tx) => {
        await lockRenewalConsent(tx, c.get("operator"));
        const actor = await lockOperatorAccess(tx, c, s);
        const [row] = await tx
          .select()
          .from(cases)
          .where(and(eq(cases.id, id), eq(cases.organizationId, actor.organizationId)))
          .for("update");
        const [reminder] = row
          ? []
          : await tx
              .select()
              .from(renewalReminders)
              .where(
                and(
                  eq(renewalReminders.sourceCaseId, id),
                  eq(renewalReminders.organizationId, actor.organizationId),
                ),
              )
              .for("update");
        if (!row && !reminder) throw notFound();
        const owner = row ?? reminderOwner(reminder!);
        const now = s.clock();
        await withdrawRenewalConsent(tx, owner, now);
        if (row)
          await audit(tx, row, "operator", "renewal.consent_updated", now, actor.id, {
            consented: false,
          });
        else
          await tx.insert(events).values({
            id: crypto.randomUUID(),
            organizationId: actor.organizationId,
            deletedCaseId: id,
            caseReference: owner.reference,
            actor: "operator",
            actorId: actor.id,
            type: "renewal.consent_updated",
            at: now.toISOString(),
            metadata: { consented: false },
          });
      });
      return c.json({ consented: false });
    });
  }

  app.put("/c/:token/renewal-consent", async (c) => {
    const input = await body(c, RenewalConsentRequest);
    const token = c.req.param("token");
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw notFound();
    const tokenHash = hashToken(token);
    await s.db.transaction(async (tx) => {
      // Look up tenant without locks, then recheck capability after acquiring tenant.
      const [original] = await tx.select().from(cases).where(eq(cases.tokenHash, tokenHash));
      const [originalReminder] = original
        ? []
        : await tx
            .select()
            .from(renewalReminders)
            .where(eq(renewalReminders.withdrawalTokenHash, tokenHash));
      const tenant = original ?? originalReminder;
      if (!tenant) throw notFound();
      await lockRenewalConsent(tx, tenant);
      const [current] = await tx
        .select()
        .from(cases)
        .where(eq(cases.tokenHash, tokenHash))
        .for("update");
      const [reminder] = current
        ? []
        : await tx
            .select()
            .from(renewalReminders)
            .where(
              and(eq(renewalReminders.withdrawalTokenHash, tokenHash), activeReminder(s.clock())),
            )
            .for("update");
      const now = s.clock();
      if (current) {
        if (input.consented) await currentCitizenLink(tx, current, now);
        await setRenewalConsent(tx, current, input.consented, now);
        await audit(tx, current, "citizen", "renewal.consent_updated", now, null, {
          consented: input.consented,
          ...renewalConsentEvidence(current.language),
        });
      } else {
        if (!reminder || input.consented) throw notFound();
        await withdrawRenewalConsent(tx, reminderOwner(reminder), now);
        await tx.insert(events).values({
          id: crypto.randomUUID(),
          organizationId: reminder.organizationId,
          deletedCaseId: reminder.sourceCaseId,
          caseReference: reminder.reference,
          actor: "citizen",
          type: "renewal.consent_updated",
          at: now.toISOString(),
          metadata: { consented: false },
        });
      }
    });
    return c.json({ consented: input.consented });
  });
}
