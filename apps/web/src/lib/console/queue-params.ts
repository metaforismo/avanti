import type { CaseListItem, CaseListResponse, CaseStatus, PracticeId } from "@avanti/contracts";
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
  /** Only the open erasure requests, in every status, nearest deadline first. */
  erasure: boolean;
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
    erasure: params.get("cancellazioni") === "1",
    q: (params.get("q") ?? "").slice(0, QUEUE_SEARCH_MAX),
  };
}

/** Appended pages can repeat a case that moved up into a refreshed first page: show it once. */
export function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => !seen.has(item.id) && seen.add(item.id));
}

/**
 * The API request behind a queue view. The queue and the dossier's «Prossima pratica» both use
 * it: the same string is the cache key, so a case the dossier finishes leaves the cached list.
 */
export function queueApiPath(queue: QueueParams): string {
  // Every status at once, nearest art. 12(3) deadline first: nothing else filters this list.
  if (queue.erasure) return "/api/cases?erasure=requested&limit=50";
  const q = new URLSearchParams({ status: queue.status, limit: "50" });
  if (queue.practice) q.set("practiceId", queue.practice);
  if (queue.assignee) q.set("assignee", queue.assignee);
  if (queue.priority) q.set("ai", queue.priority);
  const search = queue.q.trim();
  if (search) q.set("q", search);
  if (queue.longestWaiting) q.set("sort", "waiting");
  return `/api/cases?${q.toString()}`;
}

/**
 * The case after `currentId` in the queue as listed, so skipping a case never loops back to it.
 * When the current case has left the list (it was just finished), the first one is next.
 */
export function nextInQueue<T extends { id: string }>(items: T[], currentId: string): T | null {
  const here = items.findIndex((item) => item.id === currentId);
  const after = here === -1 ? items : items.slice(here + 1);
  return after.find((item) => item.id !== currentId) ?? null;
}

/**
 * A cached queue list as it is once a case listed in it moved from `from` to `to`: gone from the
 * list and counted under its new status, so going back to the queue never shows the case just
 * finished on top while the refresh runs. Returns null when the list doesn't show the case: its
 * counts may not include it (other filters), and the refresh is enough there.
 */
export function moveInCachedList(
  list: CaseListResponse,
  caseId: string,
  from: CaseStatus,
  to: CaseStatus,
): CaseListResponse | null {
  if (from === to || !list.items.some((item) => item.id === caseId)) return null;
  const counts = { ...list.counts, [to]: (list.counts[to] ?? 0) + 1 };
  counts[from] = Math.max(0, (counts[from] ?? 0) - 1);
  return { ...list, items: list.items.filter((item) => item.id !== caseId), counts };
}
