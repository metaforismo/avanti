import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { cases, documents, events, settings, storageDeletions, type Database } from "@avanti/db";
import { lockRenewalConsent, withdrawRenewalConsent } from "./renewal-consent";
import { preserveRenewalReminder, purgeRenewalReminders } from "./renewal-reminders";
import type { Services } from "./context";
import type { CaseRow } from "./dossier";

export const RETENTION_BATCH_SIZE = 25;

// Caller holds the case row lock. All DB effects commit together, before any storage I/O.
export async function eraseCase(
  db: Database,
  row: CaseRow,
  now: Date,
  actorId: string | null,
  retention = false,
) {
  if (retention) await preserveRenewalReminder(db, row, now);
  else await withdrawRenewalConsent(db, row, now);
  const files = await db.select().from(documents).where(eq(documents.caseId, row.id));
  if (files.length)
    await db
      .insert(storageDeletions)
      .values(
        files.map((file) => ({
          id: file.id,
          caseId: row.id,
          storageKey: file.storageKey,
          createdAt: now.toISOString(),
          nextAttemptAt: now.toISOString(),
        })),
      )
      .onConflictDoNothing();
  // Audit has its own lifetime. Detach before erasure; restrictive FKs prevent accidental loss.
  await db
    .update(events)
    .set({ caseId: null, deletedCaseId: row.id, caseReference: row.reference })
    .where(and(eq(events.caseId, row.id), eq(events.organizationId, row.organizationId)));
  await db.delete(cases).where(eq(cases.id, row.id));
  await db.insert(events).values({
    id: crypto.randomUUID(),
    caseId: null,
    deletedCaseId: row.id,
    caseReference: row.reference,
    organizationId: row.organizationId,
    officeId: row.officeId,
    actor: actorId ? "operator" : "system",
    actorId,
    type: actorId ? "case.deleted" : "case.retention_deleted",
    at: now.toISOString(),
    metadata: {},
  });
}

export function pastRetention(now: Date) {
  const retention = sql`coalesce(${settings.retentionDays}, 180) * interval '1 day'`;
  return sql`coalesce((${cases.status} = 'closed' and ${cases.closedAt} < ${now.toISOString()}::timestamptz - ${retention}), false) or ${cases.expiresAt} < ${now.toISOString()}::timestamptz - ${retention}`;
}

export async function purgeRetainedCases(s: Pick<Services, "db">, now: Date): Promise<number> {
  await purgeRenewalReminders(s.db, now);
  return s.db.transaction(async (tx) => {
    // Discover tenants without case locks, then follow the global tenant -> case order.
    const candidates = await tx
      .select({ organizationId: cases.organizationId })
      .from(cases)
      .leftJoin(settings, eq(settings.organizationId, cases.organizationId))
      .where(pastRetention(now))
      .orderBy(asc(cases.expiresAt), asc(cases.id))
      .limit(RETENTION_BATCH_SIZE);
    const tenants = [...new Set(candidates.map((r) => r.organizationId))].sort();
    for (const organizationId of tenants) await lockRenewalConsent(tx, { organizationId });
    if (!tenants.length) return 0;
    const rows = await tx
      .select({ row: cases })
      .from(cases)
      .leftJoin(settings, eq(settings.organizationId, cases.organizationId))
      .where(and(pastRetention(now), inArray(cases.organizationId, tenants)))
      .orderBy(asc(cases.expiresAt), asc(cases.id))
      .limit(RETENTION_BATCH_SIZE)
      .for("update", { of: cases, skipLocked: true });
    for (const { row } of rows) await eraseCase(tx, row, now, null, true);
    return rows.length;
  });
}
