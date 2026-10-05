import type { ChecklistStatus, CitizenCase } from "@avanti/contracts";

/** Checklist states that need nothing more from the citizen. */
export const DONE_STATUSES: ReadonlySet<ChecklistStatus> = new Set([
  "uploaded",
  "verified",
  "waived",
]);

export type View = "need" | "interview" | "documents" | "review" | "submitted";

const ORDER: View[] = ["need", "interview", "documents", "review"];

/** The server decides how far the citizen may go; local views can only move backwards or to review. */
export function resolveView(view: View | null, data: Pick<CitizenCase, "step">): View {
  const serverView: View = data.step === "submitted" ? "submitted" : data.step;
  if (!view) return serverView;
  if (view === "review")
    return data.step === "documents" || data.step === "review" ? "review" : serverView;
  return ORDER.indexOf(view) <= ORDER.indexOf(serverView) ? view : serverView;
}
