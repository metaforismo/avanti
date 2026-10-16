import { and, asc, eq, sql } from "drizzle-orm";
import { cases, documents, events, settings, storageDeletions, type Database } from "@avanti/db";
import type { Services } from "./context";
import type { CaseRow } from "./dossier";

export const RETENTION_BATCH_SIZE = 25;

// Caller holds the case row lock. All DB effects commit together, before any storage I/O.
export async function eraseCase(db: Database, row: CaseRow, now: Date, actorId: string | null) {
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

export async function purgeRetainedCases(s: Services, now: Date): Promise<number> {
  return s.db.transaction(async (tx) => {
    const rows = await tx
      .select({ row: cases })
      .from(cases)
      .leftJoin(settings, eq(settings.organizationId, cases.organizationId))
      .where(pastRetention(now))
      .orderBy(asc(cases.expiresAt), asc(cases.id))
      .limit(RETENTION_BATCH_SIZE)
      .for("update", { of: cases, skipLocked: true });
    for (const { row } of rows) await eraseCase(tx, row, now, null);
    return rows.length;
  });
}
