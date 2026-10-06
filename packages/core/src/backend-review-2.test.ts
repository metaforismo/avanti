import { expect, it } from "vitest";
import { LANGUAGES } from "@avanti/contracts";
import { extractFacts, buildHousehold, getQuestions, catalog } from "./index";

it("1: removing the first child preserves the surviving explicit ID", () => {
  const children = [
    { id: "child-a", role: "figlio" as const, firstName: "A" },
    { id: "child-b", role: "figlio" as const, firstName: "B" },
  ];
  expect(buildHousehold({ members: children.slice(1) })[0]?.id).toBe("child-b");
});
it.each([
  "vivo con mia madre, mio padre non vive con noi",
  "Mio padre lavora, mia sorella non vive con noi",
  "Ho un figlio minorenne. Mio padre non vive con noi",
])("2: applicant parents and separate clauses do not set the legal answer: %s", (text) => {
  expect(extractFacts(text, "it", "isee_ordinario").answers.nonresident_parent).toBeUndefined();
});
it("2: a minor child and their nonresident parent in the same clause need review", () => {
  expect(
    extractFacts("Ho un figlio minorenne il cui padre non vive con noi", "it", "isee_ordinario")
      .answers.applicant_parent_nonresident,
  ).toBeUndefined();
  expect(
    extractFacts("Ho un figlio minorenne il cui padre non vive con noi", "it", "isee_ordinario")
      .answers.nonresident_parent,
  ).toBe(true);
});
it.each([
  ["uk", "живу з мамою"],
  ["ro", "locuiesc cu soția"],
  ["ar", "أعيش مع والدتي"],
] as const)("3: inflected relations in %s", (language, text) => {
  expect(extractFacts(text, language, "isee_ordinario").answers.household_count).toBe(2);
});
it.each([
  ["it", "vivo da solo"],
  ["it", "vivo da sola"],
  ["en", "I live alone"],
  ["fr", "je vis seule"],
  ["es", "vivo solo"],
  ["ro", "locuiesc singură"],
  ["uk", "живу сам"],
  ["ar", "أعيش وحدي"],
  ["bn", "আমি একা থাকি"],
] as const)("7: living alone in %s", (language, text) => {
  expect(extractFacts(text, language, "isee_ordinario").answers.household_count).toBe(1);
});
it("7: siamo in 3", () => {
  expect(extractFacts("ISEE siamo in 3", "it").answers.household_count).toBe(3);
});
it("B3: selection prompts use the catalog reference year in eight languages", () => {
  const previous = catalog.isee_ordinario.referenceYear;
  catalog.isee_ordinario.referenceYear = 2024;
  try {
    for (const language of LANGUAGES) {
      const prompt = getQuestions("isee_ordinario", { self_employed: true }, language).find(
        (q) => q.id === "self_employed_members",
      )?.prompt;
      expect(prompt).toContain("2024");
    }
  } finally {
    catalog.isee_ordinario.referenceYear = previous;
  }
});
