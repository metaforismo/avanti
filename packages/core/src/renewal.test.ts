import { expect, it } from "vitest";
import { LANGUAGES, type Member } from "@avanti/contracts";
import { applyAnswer, nextQuestion, skipQuestion } from "./interview";
import { getQuestions } from "./catalog";
import { renewalNotice, renewalPending } from "./renewal";
import { questionEstimate } from "./question-estimate";

const now = new Date("2028-01-15T10:00:00Z");
const applicant: Member = {
  id: "person",
  role: "richiedente",
  firstName: "Persona",
  birthYear: 1980,
};
const previous = {
  practice_year: 2028,
  members: [applicant, { id: "spouse", role: "coniuge" as const, firstName: "Coniuge" }],
  household_count: 2,
  renewal_household_confirmed: false,
};

it.each(LANGUAGES)("requires household confirmation before annual questions in %s", (language) => {
  expect(getQuestions("isee_ordinario", previous, language).map((q) => q.id)).toEqual(["members"]);
  const question = nextQuestion("isee_ordinario", previous, language)!;
  expect(question).toMatchObject({ id: "members", kind: "members", required: true });
  expect(question.prompt.length).toBeGreaterThan(10);
  expect(renewalNotice(language, 2027, 2028)).toContain("2027");
  expect(renewalNotice(language, 2027, 2028)).toContain("2028");
  expect(() => skipQuestion("isee_ordinario", previous, "members", language)).toThrow();
  expect(() => applyAnswer("isee_ordinario", previous, "housing", "rent", language, now)).toThrow();
  expect(questionEstimate("isee_ordinario", previous, language).min).toBeGreaterThan(1);
  const confirmed = applyAnswer("isee_ordinario", previous, "members", [applicant], language, now);
  expect(renewalPending(confirmed)).toBe(false);
  expect(confirmed.household_count).toBe(1);
  expect(confirmed.household_roles).toEqual(["richiedente"]);
  expect(nextQuestion("isee_ordinario", confirmed, language)).not.toBeNull();
  const annual = getQuestions("isee_ordinario", confirmed, language);
  for (const id of [
    "housing",
    "household_exceptions",
    "accounts_count",
    "properties_count",
    "vehicles_count",
    "disability",
    `income_present_${applicant.id}`,
  ])
    expect(annual.some((q) => q.id === id && q.required)).toBe(true);
});

it("rejects missing applicant, duplicate identities and future or inconsistent birth dates", () => {
  for (const members of [
    [],
    [{ role: "figlio", firstName: "Figlio" }],
    [applicant, applicant],
    [{ ...applicant, birthYear: 2029 }],
    [{ ...applicant, birthDate: "2028-02-01" }],
    [{ ...applicant, birthDate: "1981-01-01" }],
  ])
    expect(() => applyAnswer("isee_ordinario", previous, "members", members, "it", now)).toThrow();
});
