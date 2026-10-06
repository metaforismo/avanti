import { asc, eq, sql } from "drizzle-orm";
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
  await db.delete(cases).where(eq(cases.id, row.id));
  await db.insert(events).values({
    id: crypto.randomUUID(),
    caseId: null,
    deletedCaseId: row.id,
    organizationId: row.organizationId,
    actor: actorId ? "operator" : "system",
    actorId,
    type: actorId ? "case.deleted" : "case.retention_deleted",
    at: now.toISOString(),
    metadata: {},
  });
}

export async function purgeRetainedCases(s: Services, now: Date): Promise<number> {
  return s.db.transaction(async (tx) => {
    const retention = sql`coalesce(${settings.retentionDays}, 180) * interval '1 day'`;
    const rows = await tx
      .select({ row: cases })
      .from(cases)
      .leftJoin(settings, eq(settings.organizationId, cases.organizationId))
      .where(
        sql`(${cases.status} = 'closed' and ${cases.closedAt} < ${now.toISOString()}::timestamptz - ${retention}) or ${cases.expiresAt} < ${now.toISOString()}::timestamptz - ${retention}`,
      )
      .orderBy(asc(cases.expiresAt), asc(cases.id))
      .limit(RETENTION_BATCH_SIZE)
      .for("update", { of: cases, skipLocked: true });
    for (const { row } of rows) await eraseCase(tx, row, now, null);
    return rows.length;
  });
}
