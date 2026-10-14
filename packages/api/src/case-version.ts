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
