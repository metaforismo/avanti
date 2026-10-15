import { and, asc, eq, gt, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
import {
  cases,
  notifications,
  offices,
  operators,
  organizations,
  settings,
  type Database,
  type NotificationKind,
} from "@avanti/db";
import { catalog, requirementText, type RequirementId } from "@avanti/core";
import type { ChecklistItem, Language, PilotLeadRequest } from "@avanti/contracts";
import type { Services } from "./context";
import type { CaseRow } from "./dossier";
import { citizenNotification, digestNotification, leadNotification } from "./notification-copy";
import { seal, unseal, type Envelope, type NotificationOptions } from "./notification-config";
import { audit } from "./dossier";
import { reminderNotification } from "./reminder-copy";
import { DeliveryFailure } from "./email";
import { submissionReceipt } from "./submission-receipt";

export const NOTIFICATION_ATTEMPTS = 5;
export const NOTIFICATION_BATCH = 5;
const retryWindow = 23 * 3600_000;
type Row = typeof notifications.$inferSelect;
const aad = (row: Pick<Row, "id" | "kind" | "language">) => `${row.id}:${row.kind}:${row.language}`;

export async function enqueueNotification(
  db: Database,
  options: NotificationOptions,
  input: {
    dedupeKey: string;
    kind: NotificationKind;
    language: Language;
    organizationId?: string;
    caseId?: string;
    citizenRequestId?: string;
    reminderNumber?: number;
    leadId?: string;
    operatorId?: string;
    to: string | null;
    email: { subject: string; text: string };
  },
  now: Date,
) {
  const { to, email, ...fields } = input;
  const id = crypto.randomUUID();
  const [queued] = await db
    .insert(notifications)
    .values({
      ...fields,
      id,
      envelope: seal(options, aad({ id, ...fields }), { to, from: options.from ?? null, ...email }),
      createdAt: now.toISOString(),
      nextAttemptAt: now.toISOString(),
    })
    .onConflictDoNothing({ target: notifications.dedupeKey })
    .returning({ id: notifications.id });
  return queued?.id;
}

export async function enqueueLead(
  db: Database,
  s: Services,
  id: string,
  input: PilotLeadRequest,
  now: Date,
) {
  return enqueueNotification(
    db,
    s.notifications,
    {
      kind: "pilot_lead",
      language: "it",
      dedupeKey: `lead:${id}`,
      leadId: id,
      to: s.notifications.leadsEmail ?? null,
      email: leadNotification(input),
    },
    now,
  );
}

export async function enqueueCitizen(
  db: Database,
  s: Services,
  row: CaseRow,
  kind: "citizen_request" | "citizen_ready",
  selected: ChecklistItem[] = [],
) {
  if (!row.contact?.email) return;
  const [prefs] = await db
    .select()
    .from(settings)
    .where(eq(settings.organizationId, row.organizationId));
  if (kind === "citizen_ready" && !prefs?.notifyCitizenReady) return;
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, row.organizationId));
  if (!org) throw new Error("Notification organization missing");
  // Rebuild catalog titles: checklist titles can contain bank names and other citizen answers.
  const titles = row.practiceId
    ? selected.map(
        (item) =>
          requirementText(
            item.requirementId as RequirementId,
            row.language,
            catalog[row.practiceId!].referenceYear,
          ).title,
      )
    : [];
  return enqueueNotification(
    db,
    s.notifications,
    {
      kind,
      language: row.language,
      dedupeKey: `${kind}:${row.id}:${new Date(row.updatedAt).toISOString()}`,
      organizationId: row.organizationId,
      caseId: row.id,
      to: row.contact.email,
      email: citizenNotification(kind, row.language, org.name, titles),
    },
    s.clock(),
  );
}

/** Called only in the transaction that records the first submission. */
export async function enqueueSubmissionReceipt(db: Database, s: Services, row: CaseRow) {
  if (!row.contact?.email) return;
  const [prefs] = await db
    .select()
    .from(settings)
    .where(eq(settings.organizationId, row.organizationId));
  if (!prefs?.notifyCitizenSubmission) return;
  const [office] = await db
    .select()
    .from(offices)
    .where(and(eq(offices.id, row.officeId), eq(offices.organizationId, row.organizationId)));
  if (!office) throw new Error("Notification office missing");
  return enqueueNotification(
    db,
    s.notifications,
    {
      kind: "citizen_submission",
      language: row.language,
      dedupeKey: `citizen_submission:${row.id}`,
      organizationId: row.organizationId,
      caseId: row.id,
      to: row.contact.email,
      email: submissionReceipt(row.language, row.reference, office.name),
    },
    s.clock(),
  );
}

export async function enqueueDigests(s: Services, now: Date): Promise<number> {
  const day = now.toISOString().slice(0, 10);
  const ids = await s.db.transaction(async (tx) => {
    const tenants = await tx
      .select()
      .from(settings)
      .where(
        and(
          eq(settings.notifyOperatorDigest, true),
          or(sql`${settings.lastDigestDate} is null`, sql`${settings.lastDigestDate} < ${day}`),
        ),
      )
      .orderBy(asc(settings.organizationId))
      .limit(25)
      .for("update", { skipLocked: true });
    const queued: string[] = [];
    for (const tenant of tenants) {
      const [aggregate] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(cases)
        .where(
          and(
            eq(cases.organizationId, tenant.organizationId),
            inArray(cases.status, ["submitted", "in_review"]),
          ),
        );
      const recipients = await tx
        .select()
        .from(operators)
        .where(
          and(eq(operators.organizationId, tenant.organizationId), eq(operators.active, true)),
        );
      for (const operator of recipients) {
        const id = await enqueueNotification(
          tx,
          s.notifications,
          {
            kind: "operator_digest",
            language: "it",
            organizationId: tenant.organizationId,
            operatorId: operator.id,
            dedupeKey: `digest:${tenant.organizationId}:${day}:${operator.id}`,
            to: operator.email,
            email: digestNotification(aggregate?.count ?? 0),
          },
          now,
        );
        if (id) queued.push(id);
      }
      await tx
        .update(settings)
        .set({ lastDigestDate: day })
        .where(eq(settings.organizationId, tenant.organizationId));
    }
    return queued;
  });
  // A daily cron may create more digests than its foreground delivery batch.
  for (const id of ids) scheduleNotificationDelivery(s, id);
  return ids.length;
}

async function stillRelevant(db: Database, row: Row, envelope: Envelope, now: Date) {
  if (row.caseId) {
    const query = db
      .select()
      .from(cases)
      .where(and(eq(cases.id, row.caseId), eq(cases.organizationId, row.organizationId!)));
    // Serialize delivery with citizen replies and state changes, including the provider call.
    const [current] = await (row.kind === "citizen_reminder" ? query.for("update") : query);
    if (
      !current ||
      current.language !== row.language ||
      current.contact?.email !== envelope.to ||
      Date.parse(current.expiresAt) <= now.getTime()
    )
      return false;
    if (row.kind === "citizen_reminder") {
      const [prefs] = await db
        .select()
        .from(settings)
        .where(eq(settings.organizationId, current.organizationId))
        .for("share");
      if (
        !prefs?.notifyCitizenReminders ||
        current.status !== "needs_citizen" ||
        current.citizenRequestId !== row.citizenRequestId ||
        !row.reminderNumber ||
        row.reminderNumber > prefs.citizenReminderDays.length
      )
        return false;
    }
    if (row.kind === "citizen_request" && current.status !== "needs_citizen") return false;
    if (row.kind === "citizen_ready" && current.status !== "ready") return false;
  }
  if (
    row.kind === "citizen_ready" ||
    row.kind === "citizen_submission" ||
    row.kind === "operator_digest"
  ) {
    const [prefs] = await db
      .select()
      .from(settings)
      .where(eq(settings.organizationId, row.organizationId!));
    const enabled =
      row.kind === "citizen_ready"
        ? prefs?.notifyCitizenReady
        : row.kind === "citizen_submission"
          ? prefs?.notifyCitizenSubmission
          : prefs?.notifyOperatorDigest;
    if (!enabled) return false;
  }
  if (row.operatorId) {
    const [operator] = await db.select().from(operators).where(eq(operators.id, row.operatorId));
    if (!operator?.active || operator.email !== envelope.to) return false;
    // Do not send yesterday's count after an outage; today's digest is queued separately.
    if (new Date(row.createdAt).toISOString().slice(0, 10) !== now.toISOString().slice(0, 10))
      return false;
  }
  return true;
}

async function complete(
  db: Database,
  id: string,
  state: "failed" | "cancelled" | "sent" | "simulated",
  now: Date,
  error: string | null = null,
) {
  await db
    .update(notifications)
    .set({
      state,
      lastError: error,
      leaseToken: null,
      completedAt: now.toISOString(),
      ...(state === "failed" ? {} : { envelope: null }),
    })
    .where(eq(notifications.id, id));
}

function logNotificationError(s: Services, code: string) {
  const record = { requestId: "background", name: "NotificationError", code, stack: null };
  try {
    if (s.errorLogger) s.errorLogger(record);
    else console.error(JSON.stringify(record));
  } catch {
    // Logging must not change delivery state or the API response.
  }
}

export function scheduleNotificationDelivery(s: Services, id: string | undefined) {
  if (!id) return;
  try {
    s.background?.(async () => {
      try {
        await sendNotifications(s, s.clock(), [id]);
      } catch {
        logNotificationError(s, "NOTIFICATION_BACKGROUND_FAILED");
      }
    });
  } catch {
    logNotificationError(s, "NOTIFICATION_SCHEDULING_FAILED");
  }
}

export async function sendNotifications(s: Services, now: Date, ids?: string[]): Promise<number> {
  let completed = 0;
  for (let index = 0; index < NOTIFICATION_BATCH; index++) {
    const claimed = await s.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(notifications)
        .where(
          and(
            inArray(notifications.state, ["pending", "sending"]),
            lte(notifications.nextAttemptAt, now.toISOString()),
            ids ? inArray(notifications.id, ids) : undefined,
          ),
        )
        .orderBy(asc(notifications.nextAttemptAt), asc(notifications.id))
        .limit(1)
        .for("update", { skipLocked: true });
      if (!row) return null;
      let envelope: Envelope;
      try {
        envelope = unseal(s.notifications, aad(row), row.envelope!);
      } catch {
        await complete(tx, row.id, "failed", now, "envelope_invalid");
        return { skipped: true } as const;
      }
      if (!(await stillRelevant(tx, row, envelope, now))) {
        await complete(tx, row.id, "cancelled", now);
        return { skipped: true } as const;
      }
      if (
        row.attempts >= NOTIFICATION_ATTEMPTS ||
        (row.firstAttemptAt && now.getTime() - Date.parse(row.firstAttemptAt) >= retryWindow)
      ) {
        // Resend only deduplicates for 24h. After an uncertain send, fail closed before that boundary.
        await complete(
          tx,
          row.id,
          "failed",
          now,
          row.attempts >= NOTIFICATION_ATTEMPTS ? "attempts_exhausted" : "retry_window_expired",
        );
        return { skipped: true } as const;
      }
      if (!row.attempts)
        envelope = {
          ...envelope,
          from: s.notifications.from ?? envelope.from,
          to: envelope.to ?? s.notifications.leadsEmail ?? null,
        };
      if (s.notifications.adapter.mode === "resend" && (!envelope.to || !envelope.from)) {
        await tx
          .update(notifications)
          .set({
            lastError: "configuration_missing",
            nextAttemptAt: new Date(now.getTime() + 3600_000).toISOString(),
          })
          .where(eq(notifications.id, row.id));
        return { skipped: true } as const;
      }
      const leaseToken = crypto.randomUUID();
      await tx
        .update(notifications)
        .set({
          state: "sending",
          attempts: row.attempts + 1,
          leaseToken,
          firstAttemptAt: row.firstAttemptAt ?? now.toISOString(),
          nextAttemptAt: new Date(now.getTime() + 60_000).toISOString(),
          envelope: seal(s.notifications, aad(row), envelope),
        })
        .where(eq(notifications.id, row.id));
      return {
        skipped: false,
        id: row.id,
        leaseToken,
        uncertainAttempt: row.firstAttemptAt !== null,
      } as const;
    });
    if (!claimed) break;
    if (claimed.skipped) continue;
    await s.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(notifications)
        .where(
          and(eq(notifications.id, claimed.id), eq(notifications.leaseToken, claimed.leaseToken)),
        )
        .for("update", { skipLocked: true });
      if (!row) return;
      // Hold the row lock across bounded I/O; an expired lease cannot send concurrently.
      const envelope = unseal(s.notifications, aad(row), row.envelope!);
      if (!(await stillRelevant(tx, row, envelope, now))) {
        await complete(tx, row.id, "cancelled", now);
        return;
      }
      try {
        await s.notifications.adapter.send({
          id: row.id,
          kind: row.kind,
          email: {
            from: envelope.from ?? "",
            to: envelope.to ?? "",
            subject: envelope.subject,
            text: envelope.text,
          },
        });
      } catch (error) {
        const failure =
          error instanceof DeliveryFailure ? error : new DeliveryFailure("delivery_unknown", true);
        logNotificationError(s, failure.code.toUpperCase());
        if (!failure.retryable || row.attempts >= NOTIFICATION_ATTEMPTS)
          await complete(tx, row.id, "failed", now, failure.code);
        else
          await tx
            .update(notifications)
            .set({
              state: "pending",
              leaseToken: null,
              lastError: failure.code,
              // A confirmed refusal can retry tomorrow; never reset an uncertain send's window.
              ...(!claimed.uncertainAttempt && failure.code === "provider_unavailable"
                ? { firstAttemptAt: null }
                : {}),
              nextAttemptAt: new Date(
                now.getTime() + 60_000 * 2 ** (row.attempts - 1),
              ).toISOString(),
            })
            .where(eq(notifications.id, row.id));
        return;
      }
      await complete(
        tx,
        row.id,
        s.notifications.adapter.mode === "console" ? "simulated" : "sent",
        now,
      );
      if (row.kind === "citizen_reminder") {
        const [current] = await tx
          .update(cases)
          .set({ citizenReminderSentAt: now.toISOString() })
          .where(and(eq(cases.id, row.caseId!), eq(cases.citizenRequestId, row.citizenRequestId!)))
          .returning();
        if (current)
          await audit(
            tx,
            current,
            "system",
            s.notifications.adapter.mode === "console"
              ? "citizen.reminder_simulated"
              : "citizen.reminder_sent",
            now,
          );
      }
      completed++;
    });
  }
  return completed;
}

export async function maintainNotifications(s: Services, now: Date) {
  // Operational payload expires after 7 days, even if configuration has never been supplied.
  await s.db
    .update(notifications)
    .set({
      envelope: null,
      state: "failed",
      lastError: "payload_expired",
      leaseToken: null,
      completedAt: now.toISOString(),
    })
    .where(
      and(
        isNotNull(notifications.envelope),
        sql`${notifications.createdAt} < ${now.toISOString()}::timestamptz - interval '7 days'`,
        inArray(notifications.state, ["pending", "sending", "failed"]),
      ),
    );
  await s.db
    .delete(notifications)
    .where(
      sql`${notifications.completedAt} < ${now.toISOString()}::timestamptz - interval '30 days'`,
    );
  const queuedReminders = await enqueueReminders(s, now);
  const queuedDigests = await enqueueDigests(s, now);
  const deliveredNotifications = await sendNotifications(s, now);
  return { queuedDigests, queuedReminders, deliveredNotifications };
}

export async function enqueueReminders(s: Services, now: Date): Promise<number> {
  const ids = await s.db.transaction(async (tx) => {
    const rows = await tx
      .select({ row: cases })
      .from(cases)
      .innerJoin(settings, eq(settings.organizationId, cases.organizationId))
      .where(
        and(
          eq(cases.status, "needs_citizen"),
          isNotNull(cases.citizenRequestId),
          isNotNull(cases.citizenRequestedAt),
          gt(cases.expiresAt, now.toISOString()),
          eq(settings.notifyCitizenReminders, true),
          sql`coalesce(${cases.contact}->>'email', '') <> ''`,
          sql`${cases.citizenRemindersQueued} < jsonb_array_length(${settings.citizenReminderDays})`,
          sql`((${cases.citizenRemindersQueued} = 0 and
          ${cases.citizenRequestedAt} + (${settings.citizenReminderDays}->>0)::int * interval '1 day' <= ${now.toISOString()}::timestamptz)
          or (${cases.citizenRemindersQueued} = 1 and ${cases.citizenReminderSentAt} is not null and
          ${cases.citizenReminderSentAt} + (${settings.citizenReminderDays}->>1)::int * interval '1 day' <= ${now.toISOString()}::timestamptz))`,
        ),
      )
      .orderBy(asc(cases.citizenRequestedAt), asc(cases.id))
      .limit(100)
      .for("update", { of: cases, skipLocked: true });
    const queued: string[] = [];
    for (const { row } of rows) {
      const reminderNumber = row.citizenRemindersQueued + 1;
      const id = await enqueueNotification(
        tx,
        s.notifications,
        {
          kind: "citizen_reminder",
          language: row.language,
          organizationId: row.organizationId,
          caseId: row.id,
          citizenRequestId: row.citizenRequestId!,
          reminderNumber,
          dedupeKey: `reminder:${row.id}:${row.citizenRequestId}:${reminderNumber}`,
          to: row.contact!.email!,
          email: reminderNotification(row.language),
        },
        now,
      );
      await tx
        .update(cases)
        .set({ citizenRemindersQueued: reminderNumber, citizenReminderSentAt: null })
        .where(eq(cases.id, row.id));
      if (id) queued.push(id);
    }
    return queued;
  });
  for (const id of ids) scheduleNotificationDelivery(s, id);
  return ids.length;
}
