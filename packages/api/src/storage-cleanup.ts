import { and, asc, eq, lte } from "drizzle-orm";
import { storageDeletions, documents } from "@avanti/db";
import type { Services } from "./context";
import { safeError } from "./logging";

export async function retryStorageDeletions(
  s: Services,
  id?: string,
  caseId?: string,
): Promise<void> {
  const pending = await s.db
    .select()
    .from(storageDeletions)
    .where(
      id
        ? eq(storageDeletions.id, id)
        : and(
            lte(storageDeletions.nextAttemptAt, s.clock().toISOString()),
            caseId ? eq(storageDeletions.caseId, caseId) : undefined,
          ),
    )
    .orderBy(asc(storageDeletions.nextAttemptAt), asc(storageDeletions.id))
    .limit(100);
  const started = performance.now();
  for (const row of pending) {
    if (performance.now() - started >= 20000) break;
    try {
      const [reference] = await s.db
        .select({ id: documents.id })
        .from(documents)
        .where(eq(documents.storageKey, row.storageKey))
        .limit(1);
      if (reference) {
        // Every unlink queues a new deletion; the last unlink will retry this file.
        await s.db.delete(storageDeletions).where(eq(storageDeletions.id, row.id));
        continue;
      }
      await s.storage.delete(row.storageKey);
      await s.db.delete(storageDeletions).where(eq(storageDeletions.id, row.id));
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
}
