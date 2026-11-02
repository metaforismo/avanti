import { and, eq } from "drizzle-orm";
import type { CitizenCase } from "@avanti/contracts";
import { events, type cases, type Database } from "@avanti/db";

type CaseRow = typeof cases.$inferSelect;

const DAY = 86_400_000;
export const DEFAULT_RETENTION_DAYS = 180;

type DraftFields = Pick<
  CaseRow,
  "submittedAt" | "status" | "familyId" | "renewalSourceId" | "internalNotes" | "assigneeId"
>;

/**
 * What the case row alone says about a draft only the citizen has handled: never sent (a
 * reopened case can be back in review without a first submission), outside any family or
 * renewal (reuse and renewals are operator work, and share files with other cases), with no
 * operator note or assignee. The audit settles the rest (see `operatorHasWorked`).
 */
export function citizenOnlyDraft(row: DraftFields) {
  return (
    row.submittedAt === null &&
    row.status === "intake" &&
    row.familyId === null &&
    row.renewalSourceId === null &&
    !row.internalNotes?.trim() &&
    row.assigneeId === null
  );
}

/**
 * Every operator write on a case is audited with the operator as actor: creating it at the desk
 * (`POST /cases`), a new link, an export, a note, a copilot question. Any of these means the CAF
 * already holds or worked the case, so it is no longer the citizen's own draft.
 */
export async function operatorHasWorked(db: Database, caseId: string) {
  const [event] = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.caseId, caseId), eq(events.actor, "operator")))
    .limit(1);
  return event !== undefined;
}

/** The case is the citizen's own draft: they may erase it from the link, without the CAF. */
export async function citizenMayDelete(db: Database, row: DraftFields & Pick<CaseRow, "id">) {
  return citizenOnlyDraft(row) && !(await operatorHasWorked(db, row.id));
}

/**
 * The citizen's rights as the link can offer them. A draft only the citizen has handled was
 * never received by the CAF: the citizen withdraws it alone, as data no longer necessary
 * (art. 17(1)(a) GDPR). Otherwise the CAF as controller weighs its retention duties
 * (art. 17(3)(b)) and answers: the link only records the request.
 */
export function citizenPrivacy(
  row: Pick<CaseRow, "expiresAt" | "erasureRequestedAt">,
  retentionDays: number | null | undefined,
  canDelete: boolean,
): NonNullable<CitizenCase["privacy"]> {
  const days = retentionDays ?? DEFAULT_RETENTION_DAYS;
  return {
    retentionDays: days,
    // The purge runs on the earlier of closure and expiry; closing moves the expiry forward.
    deleteBy: new Date(Date.parse(row.expiresAt) + days * DAY).toISOString(),
    canDelete,
    erasureRequestedAt: row.erasureRequestedAt
      ? new Date(row.erasureRequestedAt).toISOString()
      : null,
  };
}
