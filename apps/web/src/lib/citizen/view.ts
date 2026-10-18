import type { ChecklistItem, CitizenCase, ConversationTurn, Language } from "@avanti/contracts";
import { format, plural, type CitizenMessages, type Widen } from "./messages";
import { documentCounts, itemReadiness } from "@avanti/core/readiness";
import { splitRequestLabels } from "@avanti/core/request-labels";

/** «Pronto» means the same here as in the console: see `@avanti/core/readiness`. */
export function readinessOf(item: ChecklistItem, data: Pick<CitizenCase, "documents">) {
  return itemReadiness(item, data.documents);
}

export function documentCountsOf(data: Pick<CitizenCase, "checklist" | "documents">) {
  return documentCounts(data.checklist, data.documents);
}

/** Required items the citizen still has to do something about: what they bring to the desk. */
export function stillToDo(data: Pick<CitizenCase, "checklist" | "documents">) {
  return data.checklist.filter((item) => item.required && readinessOf(item, data) === "todo");
}

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

/**
 * A floor this high reads as a long road and says little: what lies behind «at least 16» can be
 * 16 questions or 400 (one per person, per account). Until it gets small the line says where the
 * citizen is instead; the bar still shows the way done.
 */
export const OPEN_FLOOR = 8;

/** What the step header says about the questions left, or null when there is nothing to say. */
export function remainingText(
  remaining: InterviewEstimate["remaining"],
  language: Language,
  m: Widen<CitizenMessages>,
  section?: string,
) {
  if (!remaining) return null;
  if (remaining.atLeast && remaining.min > OPEN_FLOOR)
    return section ? format(m.interview.remainingOpen, { section }) : m.interview.remainingSteps;
  if (remaining.atLeast) return plural(language, remaining.min, m.interview.remainingAtLeast);
  // In a range the noun agrees with the last number.
  if (remaining.min !== remaining.max)
    return plural(language, remaining.max, m.interview.remainingRange, {
      min: remaining.min,
      max: remaining.max,
    });
  return remaining.max === 1
    ? m.interview.remainingOne
    : format(m.interview.remainingMany, { n: remaining.max });
}

/**
 * What a question starts from. A renewal asks to confirm last year's household: the people
 * are already in `household` (with their ids, so documents stay with the right person)
 * before any answer exists.
 */
export function initialAnswer(data: CitizenCase, questionId: string) {
  const answer = data.answers[questionId];
  if (answer !== undefined) return answer;
  if (questionId === "members" && data.renewal?.householdConfirmationRequired)
    return data.household.map(
      ({ id, role, firstName, lastName, birthYear, birthDate, taxCode }) => ({
        id,
        role,
        firstName,
        ...(lastName ? { lastName } : {}),
        ...(birthYear ? { birthYear } : {}),
        ...(birthDate ? { birthDate } : {}),
        ...(taxCode ? { taxCode } : {}),
      }),
    );
  return undefined;
}

/**
 * The question a tapped or confirmed answer replies to, when the turn just before doesn't ask it:
 * a history of bare «No», «No», «4» says nothing to someone scrolling back.
 */
export function askedBefore(
  turns: ConversationTurn[],
  index: number,
  answered: CitizenCase["answered"],
): string | null {
  const turn = turns[index]!;
  if (turn.role !== "citizen" || turn.kind !== "confirmation" || !turn.questionId) return null;
  const previous = turns[index - 1];
  if (previous?.role === "assistant" && previous.questionId === turn.questionId) return null;
  return answered.find((item) => item.questionId === turn.questionId)?.question ?? null;
}

/**
 * The last thing the assistant said is tagged with this question: the card under it shows the
 * official prompt in a compact line instead of a second title. It may have been the model's own
 * wording, so the card never drops the prompt.
 */
export function justAsked(turns: ConversationTurn[], questionId: string) {
  const last = turns.at(-1);
  return last?.role === "assistant" && last.questionId === questionId;
}

/**
 * An office request ends with one line per item it asks for: those lines become links to the
 * item, so the citizen does not hunt for it among the others. Lines that name no item stay text.
 */
export function splitRequest(text: string, checklist: ChecklistItem[]) {
  return splitRequestLabels(text, checklist, (item) => item.status === "rejected");
}
