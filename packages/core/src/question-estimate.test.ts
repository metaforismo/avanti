import { expect, it } from "vitest";
import { applyAnswer } from "./interview";
import { questionEstimate } from "./question-estimate";
import { getQuestions, type Answers } from "./catalog";
import { evaluateDossier } from "./evaluation";

const now = new Date("2027-01-15T12:00:00Z");
it("reserves every conditional question and never increases the upper bound along an interview", () => {
  let answers: Answers = {};
  let previous = questionEstimate("isee_ordinario", answers, "it").max;
  const values: Answers = {
    household_count: 4,
    members: [
      { id: "a", firstName: "Ada", role: "richiedente" },
      { id: "b", firstName: "Leo", role: "coniuge" },
      { id: "c", firstName: "Eva", role: "figlio" },
      { id: "d", firstName: "Ivo", role: "figlio" },
    ],
    accounts_count: 3,
    properties_count: 2,
    vehicles_count: 2,
  };
  for (let n = 0; n < 100; n++) {
    const question = getQuestions("isee_ordinario", answers, "it").find(
      (q) => !Object.hasOwn(answers, q.id),
    );
    if (!question) break;
    const value =
      values[question.id] ??
      (question.kind === "yes_no"
        ? true
        : question.kind === "multi_choice"
          ? ["a"]
          : (question.options?.[0]?.value ?? "Esempio"));
    answers = applyAnswer("isee_ordinario", answers, question.id, value, "it", now);
    const estimate = questionEstimate("isee_ordinario", answers, "it");
    expect(estimate.max, question.id).toBeLessThanOrEqual(previous);
    expect(estimate.min).toBeLessThanOrEqual(estimate.max);
    previous = estimate.max;
  }
  expect(questionEstimate("isee_ordinario", answers, "it")).toEqual({ min: 0, max: 0 });
  expect(
    getQuestions("isee_ordinario", answers, "it").every((q) => Object.hasOwn(answers, q.id)),
  ).toBe(true);
});
it("does not give legacy clients a numeric estimate before the branch sizes are known", () => {
  const result = evaluateDossier({
    practiceId: "isee_ordinario",
    answers: {},
    household: [],
    checklist: [],
    documents: [],
    language: "it",
    now,
  });
  expect(result.progress.questionsTotal).toBe(0);
  expect(result.progress.questionsRemaining!.max).toBeGreaterThan(
    result.progress.questionsRemaining!.min,
  );
});
it("counts per person, per account and per vehicle in advance", () => {
  const base: Answers = {
    household_count: 2,
    accounts_count: 0,
    properties_count: 0,
    vehicles_count: 0,
    disability: false,
    self_employed: false,
    foreign_income: false,
    maintenance: false,
    exempt_income: false,
  };
  const before = questionEstimate("isee_ordinario", base, "it");
  expect(before.min).toBe(before.max);
  expect(questionEstimate("isee_ordinario", { ...base, household_count: 4 }, "it").max).toBe(
    before.max + 2,
  );
  expect(questionEstimate("isee_ordinario", { ...base, accounts_count: 2 }, "it").max).toBe(
    before.max + 7,
  );
  expect(questionEstimate("isee_ordinario", { ...base, vehicles_count: 2 }, "it").max).toBe(
    before.max + 4,
  );
});
