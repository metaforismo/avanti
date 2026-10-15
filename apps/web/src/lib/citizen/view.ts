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

/** Id of each step's <h1>, focused after navigation so screen readers announce the new step. */
export const STEP_TITLE_ID = "step-title";

export type InterviewEstimate = {
  /** What to say about the questions left, or null when there is nothing honest to say. */
  remaining: { min: number; max: number; atLeast?: boolean } | null;
  /** 0–100, or null when the total is unknown. */
  percent: number | null;
};

/**
 * Answers open new questions (one per person, account, vehicle): the server gives an exact total
 * only when nothing is pending, otherwise a range. The bar uses the middle of the range.
 */
export function interviewEstimate(progress: CitizenCase["progress"]): InterviewEstimate {
  const {
    questionsAnswered: answered,
    questionsTotal: total,
    questionsRemaining: range,
  } = progress;
  if (total > 0) {
    const left = Math.max(0, total - answered);
    return {
      remaining: left > 0 ? { min: left, max: left } : null,
      percent: (answered / total) * 100,
    };
  }
  if (!range || range.max === 0) return { remaining: null, percent: null };
  // A range like 16–441 (many accounts or people still possible) says nothing useful: give the
  // floor, which is true, and size the bar on it.
  if (range.max > range.min * 1.5 + 4) {
    return {
      remaining: { min: range.min, max: range.min, atLeast: true },
      percent: (answered / (answered + range.min)) * 100,
    };
  }
  const middle = (range.min + range.max) / 2;
  return { remaining: range, percent: (answered / (answered + middle)) * 100 };
}
