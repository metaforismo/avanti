import type { CaseListItem, CaseStatus, PracticeId } from "@avanti/contracts";
import { PRACTICE_IDS } from "@avanti/contracts/constants";
import { STATUS_ORDER } from "./labels";

export type QueuePriority = NonNullable<CaseListItem["aiPriority"]>;
export const QUEUE_PRIORITIES: readonly QueuePriority[] = [
  "near_ready",
  "citizen_question",
  "attention",
  "quick_review",
];
/** CaseListQuery.q accepts at most 100 characters. */
export const QUEUE_SEARCH_MAX = 100;

export type QueueParams = {
  status: CaseStatus;
  practice: PracticeId | "";
  assignee: "me" | "none" | "";
  priority: QueuePriority | "";
  longestWaiting: boolean;
  q: string;
};

const pick = <T extends string>(allowed: readonly T[], value: string | null): T | "" =>
  allowed.includes(value as T) ? (value as T) : "";

/**
 * The queue filters live in the address bar, so they come from old bookmarks and hand-edited
 * links too. Anything the API would reject falls back to "no filter" instead of an error page.
 */
export function readQueueParams(params: { get(key: string): string | null }): QueueParams {
  const status = pick(STATUS_ORDER, params.get("stato")) || "submitted";
  return {
    status,
    practice: pick(PRACTICE_IDS, params.get("pratica")),
    assignee: pick(["me", "none"] as const, params.get("assegnatario")),
    priority: pick(QUEUE_PRIORITIES, params.get("priorita")),
    // Only the submitted tab offers this order: elsewhere nothing on screen could undo it.
    longestWaiting: status === "submitted" && params.get("ordina") === "attesa",
    q: (params.get("q") ?? "").slice(0, QUEUE_SEARCH_MAX),
  };
}

/** Appended pages can repeat a case that moved up into a refreshed first page: show it once. */
export function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => !seen.has(item.id) && seen.add(item.id));
}
