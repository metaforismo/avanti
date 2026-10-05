import { eq, lte } from "drizzle-orm";
import { storageDeletions } from "@avanti/db";
import type { Services } from "./context";
import { safeError } from "./logging";

export async function retryStorageDeletions(s: Services, id?: string): Promise<void> {
  const pending = await s.db
    .select()
    .from(storageDeletions)
    .where(
      id
        ? eq(storageDeletions.id, id)
        : lte(storageDeletions.nextAttemptAt, s.clock().toISOString()),
    )
    .limit(100);
  for (const row of pending) {
    try {
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
