import type { Language, PracticeId } from "@avanti/contracts";
import { getQuestions, type Answers } from "./catalog";
import { buildHousehold } from "./household";

/** Bounds on remaining questions, including branches whose selector is not answered yet. */
export function questionEstimate(practiceId: PracticeId, answers: Answers, language: Language) {
  const active = getQuestions(practiceId, answers, language);
  const answered = active.filter((q) => Object.hasOwn(answers, q.id)).length;
  if (practiceId !== "isee_ordinario")
    return { min: active.length - answered, max: active.length - answered };
  function bound(upper: boolean) {
    const projected: Answers = { ...answers };
    if (!buildHousehold(answers).length) {
      const count =
        typeof answers.household_count === "number" ? answers.household_count : upper ? 20 : 1;
      projected.members = Array.from({ length: count }, (_, index) => ({
        id: `estimate_${index}`,
        role: index === 0 ? ("richiedente" as const) : ("altro" as const),
        firstName: "Stima",
      }));
    }
    // Read catalog maxima instead of silently assuming one account/vehicle per family.
    for (const id of ["accounts_count", "properties_count", "vehicles_count"]) {
      if (!Object.hasOwn(answers, id))
        projected[id] = upper ? active.find((q) => q.id === id)!.max! : 0;
    }
    for (const id of [
      "disability",
      "self_employed",
      "foreign_income",
      "maintenance",
      "exempt_income",
    ])
      if (!Object.hasOwn(answers, id)) projected[id] = upper;
    return Math.max(0, getQuestions(practiceId, projected, language).length - answered);
  }
  return { min: bound(false), max: bound(true) };
}
