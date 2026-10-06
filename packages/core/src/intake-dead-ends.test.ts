import { describe, expect, it } from "vitest";
import { LANGUAGES, type Language } from "@avanti/contracts";
import { extractFacts } from "./extraction";
import { applyAnswer, DomainValidationError } from "./interview";
import { getQuestions } from "./catalog";
import { evaluateDossier } from "./evaluation";
import { t } from "./i18n";

const now = new Date("2027-01-05T10:00:00Z");
const CHILD_STORIES: [Language, string, number][] = [
  ["it", "vivo con mia moglie e due figli", 2],
  ["it", "vivo con mia moglie e tre figli", 3],
  ["it", "vivo con mia moglie e quattro figli", 4],
  ["en", "i live with my wife and two kids", 2],
  ["en", "i live with my wife and three kids", 3],
  ["en", "i live with my wife and four kids", 4],
  ["fr", "je vis avec ma femme et deux enfants", 2],
  ["fr", "je vis avec ma femme et trois enfants", 3],
  ["fr", "je vis avec ma femme et quatre enfants", 4],
  ["es", "vivo con mi esposa y dos hijos", 2],
  ["es", "vivo con mi esposa y tres hijos", 3],
  ["es", "vivo con mi esposa y cuatro hijos", 4],
  ["ro", "locuiesc cu sotia si doi copii", 2],
  ["ro", "locuiesc cu sotia si trei copii", 3],
  ["ro", "locuiesc cu sotia si patru copii", 4],
  ["uk", "живу з дружиною і двоє дітей", 2],
  ["uk", "живу з дружиною і три дітей", 3],
  ["uk", "живу з дружиною і чотири дітей", 4],
  ["ar", "أعيش مع زوجتي وولدين", 2],
  ["ar", "أعيش مع زوجتي وثلاثة أطفال", 3],
  ["ar", "أعيش مع زوجتي وأربعة أطفال", 4],
  ["bn", "আমি স্ত্রীর আর দুই ছেলে সঙ্গে থাকি", 2],
  ["bn", "আমি স্ত্রীর আর তিন ছেলে সঙ্গে থাকি", 3],
  ["bn", "আমি স্ত্রীর আর চার ছেলে সঙ্গে থাকি", 4],
];
it.each(CHILD_STORIES)("%s children in words: %s", (language, text, count) => {
  const result = extractFacts(text, language, "isee_ordinario");
  expect(result.answers.household_count).toBe(count + 2);
  expect(result.answers.household_roles).toEqual([
    "richiedente",
    "coniuge",
    ...Array(count).fill("figlio"),
  ]);
  expect(result.answers.household_relations).toEqual(["coniuge", ...Array(count).fill("figlio")]);
});

it.each([
  ["it", "vivo con mia moglie e i miei figli non vivono con noi"],
  ["en", "i live with my wife and two kids live elsewhere"],
  ["ar", "أعيش مع زوجتي وثلاثة أطفال لا يعيشون معنا"],
] as const)("does not add absent children in %s", (language, text) => {
  expect(extractFacts(text, language, "isee_ordinario").answers.household_count).toBe(2);
});

it.each([
  ["Intesa", "Intesa Sanpaolo"],
  ["MPS", "Monte dei Paschi"],
  ["Banca Sella", "Sella"],
  ["Poste Italiane", "Poste"],
  ["Postepay", "Postepay"],
  ["BancoPosta", "BancoPosta"],
])("bank alias %s", (alias, canonical) => {
  const result = extractFacts(`un conto in ${alias}`, "it", "isee_ordinario");
  expect(result.answers).toMatchObject({
    accounts_count: 1,
    account_bank_0: canonical,
    account_type_0: "deposit",
  });
  expect(result.facts.institutions).toEqual([canonical]);
  expect(
    extractFacts(`non ho un conto in ${alias}`, "it", "isee_ordinario").facts.institutions,
  ).toEqual([]);
});
it("deduplicates canonical bank aliases within the same story", () => {
  expect(
    extractFacts("un conto Intesa Sanpaolo, Intesa", "it", "isee_ordinario").facts.institutions,
  ).toEqual(["Intesa Sanpaolo"]);
});
it.each(["Monobank", "PrivatBank", "BBVA", "Banca Transilvania", "BCR", "bKash"])(
  "flags %s for verification, not a guessed country",
  (bank) => {
    const result = extractFacts(`ho un conto in ${bank}`, "it", "isee_ordinario");
    expect(result.answers).toMatchObject({
      account_bank_0: bank,
      accounts_count: 1,
      foreign_institution_review: true,
    });
    expect(result.answers.foreign_assets).toBeUndefined();
    if (bank === "bKash") expect(result.answers.account_type_0).toBeUndefined();
    expect(
      extractFacts(`non ho un conto ${bank}`, "it", "isee_ordinario").answers
        .foreign_institution_review,
    ).toBeUndefined();
  },
);
it.each([
  ["it", "ho un conto all'estero in BBVA", "non ho conti all'estero"],
  ["en", "i have an account abroad with BBVA", "i have no account abroad"],
  ["fr", "j ai un compte à l étranger", "pas de compte à l étranger"],
  ["es", "tengo una cuenta en el extranjero", "no tengo cuenta en el extranjero"],
  ["ro", "am un cont în străinătate", "nu am cont în străinătate"],
  ["uk", "маю рахунок за кордоном", "немає рахунку за кордоном"],
  ["ar", "لدي حساب في الخارج", "ليس لدي حساب في الخارج"],
  ["bn", "আমার বিদেশে অ্যাকাউন্ট আছে", "বিদেশে অ্যাকাউন্ট নেই"],
] as const)(
  "only explicit foreign assets answer the question in %s",
  (language, positive, negative) => {
    expect(extractFacts(positive, language, "isee_ordinario").answers.foreign_assets).toBe(true);
    expect(
      extractFacts(negative, language, "isee_ordinario").answers.foreign_assets,
    ).toBeUndefined();
  },
);
it.each([
  ["it", "c'è la macchina", "non c'è la macchina"],
  ["en", "there is a car", "there is no car"],
  ["uk", "є автомобіль", "немає автомобіля"],
] as const)("subjectless vehicle possession in %s", (language, positive, negative) => {
  expect(extractFacts(positive, language, "isee_ordinario").answers.vehicles_count).toBe(1);
  expect(extractFacts(negative, language, "isee_ordinario").answers.vehicles_count ?? 0).toBe(0);
});
it.each([
  ["it", "vivo con mia madre e mio fratello", "fratello"],
  ["en", "live w my mom and my brother", "fratello"],
  ["it", "vivo con mia madre e mia sorella", "sorella"],
  ["en", "i live with mom and my roommate", "coinquilino"],
] as const)("explicit other resident in %s: %s", (language, text, relation) => {
  expect(extractFacts(text, language, "isee_ordinario").answers).toMatchObject({
    household_count: 3,
    household_roles: ["richiedente", "genitore", "altro"],
    household_relations: ["madre", relation],
  });
});
it.each([
  ["it", "vivo con mia madre e mio fratello non vive con noi"],
  ["en", "live w my mom and my brother works"],
  ["it", "mio fratello lavora"],
] as const)("does not add an unrelated sibling in %s", (language, text) => {
  const roles = extractFacts(text, language, "isee_ordinario").answers.household_roles;
  expect(Array.isArray(roles) ? roles : []).not.toContain("altro");
});
it("collective parents are two resident roles only in a positive living context", () => {
  expect(extractFacts("vivo con i miei genitori", "it", "isee_ordinario").answers).toEqual({
    household_count: 3,
    household_roles: ["richiedente", "genitore", "genitore"],
    household_relations: ["madre", "padre"],
  });
  expect(extractFacts("non vivo con i miei genitori", "it", "isee_ordinario").answers).toEqual({});
  expect(extractFacts("i miei genitori lavorano", "it", "isee_ordinario").answers).toEqual({});
});
it("home mortgage exposes property questions but does not assert a historical outstanding balance", () => {
  const result = extractFacts("mutuo sulla casa", "it", "isee_ordinario");
  expect(result.answers).toMatchObject({
    housing: "owned",
    properties_count: 1,
    mortgage_review: true,
  });
  expect(result.answers.property_mortgage_0).toBeUndefined();
  expect(
    getQuestions("isee_ordinario", result.answers, "it").some(
      (question) => question.id === "property_mortgage_0",
    ),
  ).toBe(true);
  expect(
    extractFacts("non ho un mutuo sulla casa", "it", "isee_ordinario").answers.housing,
  ).toBeUndefined();
});
it("precompiled global patterns do not leak state across calls or languages", () => {
  for (let iteration = 0; iteration < 3; iteration++) {
    for (const [language, text, count] of CHILD_STORIES) {
      expect(extractFacts(text, language, "isee_ordinario").answers.household_count).toBe(
        count + 2,
      );
    }
  }
});

it.each([
  "Devo fare l'ISEE per l'università, vivo con mia moglie",
  "ISEE università vivo con i miei genitori",
  "ISEE università vivo da solo sono autonomo",
  "ISEE università per il dottorato",
])("collects university preparation without determining the legal household: %s", (text) => {
  const result = extractFacts(text, "it");
  expect(result.practiceId).toBe("isee_ordinario");
  expect(result.answers.university).toBe(true);
  const evaluation = evaluateDossier({
    practiceId: result.practiceId!,
    answers: result.answers,
    household: [],
    checklist: [],
    documents: [],
    language: "it",
    now,
  });
  expect(evaluation.findings).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ code: "practice.university_review", severity: "warning" }),
    ]),
  );
});
it("does not set university for a negated request", () => {
  expect(extractFacts("ISEE non per università", "it").answers.university).toBeUndefined();
});

const minimum = (answers: Parameters<typeof getQuestions>[1]) =>
  getQuestions("isee_ordinario", answers, "it").find(
    (question) => question.id === "household_count",
  )!.min;
describe("household minimum", () => {
  it.each([2, 3, 4, 5])("requires the %i known roles", (count) => {
    expect(
      minimum({ household_roles: ["richiedente", "coniuge", ...Array(count - 2).fill("figlio")] }),
    ).toBe(count);
  });
  it("defaults to applicant and does not use an unconfirmed numeric count as a minimum", () => {
    expect(minimum({})).toBe(1);
    expect(minimum({ household_count: 5 })).toBe(1);
    expect(minimum({ household_roles: ["coniuge"] })).toBe(2);
    expect(minimum({ household_roles: ["unsupported"] })).toBe(1);
  });
  it.each(LANGUAGES)("explains a too small answer in %s", (language) => {
    const answers = { household_roles: ["richiedente", "coniuge"] };
    expect(() =>
      applyAnswer("isee_ordinario", answers, "household_count", 1, language, now),
    ).toThrow(t(language, "householdSpouseMinimum"));
    expect(() =>
      applyAnswer(
        "isee_ordinario",
        { household_roles: ["richiedente", "coniuge", "figlio"] },
        "household_count",
        2,
        language,
        now,
      ),
    ).toThrow(t(language, "householdMinimum", { min: 3 }));
    expect(() =>
      applyAnswer("isee_ordinario", answers, "household_count", 1.5, language, now),
    ).toThrow(DomainValidationError);
  });
  it("confirmed edited members override previous roles and update the count", () => {
    const original = {
      household_count: 4,
      household_roles: ["richiedente", "coniuge", "figlio", "figlio"],
    };
    const edited = applyAnswer(
      "isee_ordinario",
      original,
      "members",
      [
        { role: "richiedente", firstName: "Esempio" },
        { role: "genitore", firstName: "Madre" },
      ],
      "it",
      now,
    );
    expect(minimum(edited)).toBe(2);
    expect(edited.household_count).toBe(2);
    expect(edited.household_roles).toEqual(["richiedente", "genitore"]);
    expect(edited.household_relations).toEqual([]);
  });
});

it.each(LANGUAGES)("operator warnings are localized in %s", (language) => {
  const findings = evaluateDossier({
    practiceId: "isee_ordinario",
    answers: { university: true, foreign_institution_review: true, mortgage_review: true },
    household: [],
    checklist: [],
    documents: [],
    language,
    now,
  }).findings;
  for (const code of [
    "practice.university_review",
    "practice.foreign_institution_review",
    "practice.mortgage_review",
  ]) {
    const finding = findings.find((entry) => entry.code === code);
    expect(finding).toMatchObject({ severity: "warning" });
    expect(finding!.message).not.toMatch(/\{\w+\}/u);
    if (language !== "it") expect(finding!.message).not.toContain("Il CAF verifica");
  }
});
