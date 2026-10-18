import type { CitizenCase } from "@avanti/contracts";
import type { cases } from "@avanti/db";

type CaseRow = typeof cases.$inferSelect;

const DAY = 86_400_000;
export const DEFAULT_RETENTION_DAYS = 180;

/**
 * The citizen's rights as the link can offer them. Before the first submission the CAF has
 * received nothing: the citizen withdraws their own draft alone (art. 17(1)(b) GDPR, no
 * obligation to keep a preparation nobody handed over). Once sent, the CAF as controller weighs
 * its retention duties (art. 17(3)(b)) and answers: the link only records the request.
 */
export function citizenPrivacy(
  row: Pick<CaseRow, "expiresAt" | "submittedAt" | "erasureRequestedAt">,
  retentionDays: number | null | undefined,
): NonNullable<CitizenCase["privacy"]> {
  const days = retentionDays ?? DEFAULT_RETENTION_DAYS;
  return {
    retentionDays: days,
    // The purge runs on the earlier of closure and expiry; closing moves the expiry forward.
    deleteBy: new Date(Date.parse(row.expiresAt) + days * DAY).toISOString(),
    canDelete: row.submittedAt === null,
    erasureRequestedAt: row.erasureRequestedAt
      ? new Date(row.erasureRequestedAt).toISOString()
      : null,
  };
}
