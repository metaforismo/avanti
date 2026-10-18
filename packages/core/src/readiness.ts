import type { ChecklistItem, ChecklistStatus, DocumentSummary } from "@avanti/contracts";

/**
 * What «pronto» means, decided once for every count the citizen and the desk read: the progress
 * at the top of the documents, the line above «Vai al riepilogo», the review and done steps, the
 * queue in the console. Before, the page counted an upload still being read as done and the core
 * did not, so the same case said «0 di 10 pronti» and «Ne mancano 9».
 *
 * A checklist item is
 * - `ready`: nothing more is needed. The desk verified or waived it, or a document is attached and
 *   was read without blocking problems. Read, not verified: the desk still checks it, but the
 *   citizen is done with it.
 * - `checking`: a document is attached and still being read. The citizen has nothing to do, but it
 *   is not ready yet: the reading can still find a problem.
 * - `todo`: the citizen has to act. Nothing uploaded, a blocking problem, or the desk asked for it
 *   again.
 *
 * Counts cover required items only: optional ones never hold the practice back.
 */
export type Readiness = "ready" | "checking" | "todo";

/**
 * The status shown for an item the desk has not decided on: uploaded once a file is attached, and
 * to look at again when a blocking finding is on it, whatever else was uploaded. A decision of
 * the desk (verified, rejected, waived) stays as it is.
 */
export function checklistStatus(
  status: ChecklistStatus,
  { attached, blocked }: { attached: boolean; blocked: boolean },
): ChecklistStatus {
  if (status === "verified" || status === "rejected" || status === "waived") return status;
  if (!attached) return "missing";
  return blocked ? "issue" : "uploaded";
}

type Item = Pick<ChecklistItem, "id" | "status" | "required">;
type Document = Pick<DocumentSummary, "checklistItemId" | "status" | "analysis">;

/** `item.status` must already account for findings (see `checklistStatus`). */
export function itemReadiness(item: Item, documents: readonly Document[]): Readiness {
  switch (item.status) {
    case "verified":
    case "waived":
      return "ready";
    case "missing":
    case "issue":
    case "rejected":
      return "todo";
    case "uploaded": {
      const linked = documents.filter((document) => document.checklistItemId === item.id);
      if (linked.some((document) => document.status === "analyzed" && document.analysis))
        return "ready";
      return linked.some((document) => document.status === "processing") ? "checking" : "todo";
    }
  }
}

export type DocumentCounts = Record<Readiness, number> & { required: number };

export function documentCounts(
  checklist: readonly Item[],
  documents: readonly Document[],
): DocumentCounts {
  const counts: DocumentCounts = { required: 0, ready: 0, checking: 0, todo: 0 };
  for (const item of checklist) {
    if (!item.required) continue;
    counts.required++;
    counts[itemReadiness(item, documents)]++;
  }
  return counts;
}
