import { and, asc, eq, lte } from "drizzle-orm";
import { storageDeletions, documents } from "@avanti/db";
import type { Services } from "./context";
import { safeError } from "./logging";

export const STORAGE_DELETION_BATCH = 100;

/**
 * Deletes due files. Each row is claimed with FOR UPDATE SKIP LOCKED and checked again under
 * that lock: an upload whose 10-minute lease just ran out may be committing its document right
 * now, holding the lease row, and deleting its file would leave a document with no bytes. The
 * upload locks the same row before it commits, so exactly one of the two wins.
 */
export async function retryStorageDeletions(
  s: Services,
  id?: string,
  caseId?: string,
  budgetMs = 20000,
): Promise<{ attempted: number; outOfTime: boolean }> {
  const due = () =>
    id
      ? eq(storageDeletions.id, id)
      : and(
          lte(storageDeletions.nextAttemptAt, s.clock().toISOString()),
          caseId ? eq(storageDeletions.caseId, caseId) : undefined,
        );
  const pending = await s.db
    .select()
    .from(storageDeletions)
    .where(due())
    .orderBy(asc(storageDeletions.nextAttemptAt), asc(storageDeletions.id))
    .limit(STORAGE_DELETION_BATCH);
  const started = performance.now();
  let attempted = 0;
  for (const row of pending) {
    if (performance.now() - started >= budgetMs) return { attempted, outOfTime: true };
    attempted++;
    try {
      await s.db.transaction(async (tx) => {
        const [claimed] = await tx
          .select()
          .from(storageDeletions)
          .where(and(eq(storageDeletions.id, row.id), due()))
          .for("update", { skipLocked: true });
        // Taken by an upload commit or another worker, rescheduled, or already done.
        if (!claimed) return;
        const [reference] = await tx
          .select({ id: documents.id })
          .from(documents)
          .where(eq(documents.storageKey, claimed.storageKey))
          .limit(1);
        // Every unlink queues a new deletion; the last unlink will retry this file.
        if (!reference) await s.storage.delete(claimed.storageKey);
        await tx.delete(storageDeletions).where(eq(storageDeletions.id, claimed.id));
      });
    } catch (error) {
      (s.storageLogger ?? console.error)({
        op: "storage.delete",
        caseId: row.caseId,
        documentId: row.id,
        errorName: safeError(error).name,
      });
      await s.db
        .update(storageDeletions)
        .set({
          attempts: row.attempts + 1,
          nextAttemptAt: new Date(
            s.clock().getTime() + Math.min(3600000, 60000 * 2 ** Math.min(row.attempts, 6)),
          ).toISOString(),
        })
        .where(eq(storageDeletions.id, row.id));
    }
  }
  return { attempted, outOfTime: false };
}
