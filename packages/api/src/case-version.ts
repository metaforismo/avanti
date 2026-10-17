import { sql } from "drizzle-orm";
import type { Database } from "@avanti/db";
import type { CaseRow } from "./dossier";
import { ApiFailure } from "./security";

export function assertCaseVersion(current: CaseRow, expected: string | undefined): void {
  if (!expected || Date.parse(expected) !== Date.parse(current.updatedAt))
    throw new ApiFailure(
      "conflict",
      409,
      "La pratica è cambiata. Ricarica il fascicolo e controlla le modifiche prima di riprovare.",
    );
}

// Locks serialize writes; a monotonic instant distinguishes writes even with a fixed/reversed clock.
export function nextCaseUpdate(current: Pick<CaseRow, "updatedAt">, now: Date): string {
  return new Date(Math.max(now.getTime(), Date.parse(current.updatedAt) + 1)).toISOString();
}

/**
 * Declares that this transaction's case writes are operator work, not new content: the
 * near-ready evaluation keeps judging the dossier as the citizen delivered it (migration 0026).
 * Transaction-local, so it must run inside the same transaction as the write.
 */
export async function markOperatorWork(tx: Database): Promise<void> {
  await tx.execute(sql`select set_config('avanti.operator_work', 'on', true)`);
}
