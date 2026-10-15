import type { Language, PracticeId } from "@avanti/contracts";
import { getQuestions, type Answers } from "./catalog";
import { buildHousehold, householdMinimum } from "./household";

/** Planning range, not a catalog maximum. Unknown sizes assume 3 people, 3 financial
 * relationships, 2 properties and 2 vehicles. Explicit counts always override these
 * product assumptions; the range may grow when a larger household is declared. */
export function questionEstimate(practiceId: PracticeId, answers: Answers, language: Language) {
  const active = getQuestions(practiceId, answers, language);
  const answered = active.filter((q) => Object.hasOwn(answers, q.id)).length;
  if (practiceId !== "isee_ordinario")
    return { min: active.length - answered, max: active.length - answered };
  function bound(upper: boolean) {
    const projected: Answers = { ...answers };
    const people = buildHousehold(answers);
    const count = Math.max(
      people.length,
      typeof answers.household_count === "number"
        ? answers.household_count
        : upper
          ? Math.max(3, householdMinimum(answers))
          : householdMinimum(answers),
    );
    if (people.length < count) {
      projected.members = [
        ...people,
        ...Array.from({ length: count - people.length }, (_, index) => ({
          id: `estimate_${index}`,
          role: people.length === 0 && index === 0 ? ("richiedente" as const) : ("altro" as const),
          firstName: "Stima",
        })),
      ];
    }
    // These are planning assumptions, never input limits or inferred citizen answers.
    for (const id of ["accounts_count", "properties_count", "vehicles_count"]) {
      if (!Object.hasOwn(answers, id))
        projected[id] = upper ? (id === "accounts_count" ? 3 : 2) : 0;
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
