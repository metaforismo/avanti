import { describe, expect, it } from "vitest";
import { DEMO_EXPECTED, DEMO_STORIES } from "./demo-stories";
import { extractFacts } from "./extraction";

describe("homepage stories without AI", () => {
  for (const language of Object.keys(DEMO_STORIES) as (keyof typeof DEMO_STORIES)[]) {
    it(language, () => {
      const result = extractFacts(DEMO_STORIES[language], language);
      expect(result.practiceId).toBe(DEMO_EXPECTED.practiceId);
      expect(result.answers).toEqual(DEMO_EXPECTED.answers);
      expect(result.facts).toEqual({
        householdCount: 2,
        nonresidentParent: true,
        institutions: ["Fineco"],
      });
    });
  }
});

import type { Language } from "@avanti/contracts";
import type { Answers } from "./catalog";

const mother = {
  household_count: 2,
  household_roles: ["richiedente", "genitore"],
  household_relations: ["madre"],
};
const father = { ...mother, household_relations: ["padre"] };
const spouseAndChild = {
  household_count: 3,
  household_roles: ["richiedente", "coniuge", "figlio"],
  household_relations: ["coniuge", "figlio"],
};
type Variant = { text: string; expected: Answers };
const VARIANTS: Record<Language, Variant[]> = {
  it: [
    {
      text: "devo fare isee sto con mamma e papà non vive con noi ho una moto e un conto in Fineco",
      expected: {
        ...mother,
        applicant_parent_nonresident: true,
        accounts_count: 1,
        account_bank_0: "Fineco",
        vehicles_count: 1,
      },
    },
    {
      text: "ho una macchina vivo con babbo ma mia madre abita altrove",
      expected: { ...father, vehicles_count: 1, applicant_parent_nonresident: true },
    },
    { text: "con mia moglie vivo e mio figlio", expected: spouseAndChild },
    {
      text: "abito con mio marito e due figli",
      expected: {
        household_count: 4,
        household_roles: ["richiedente", "coniuge", "figlio", "figlio"],
        household_relations: ["coniuge", "figlio", "figlio"],
      },
    },
    { text: "mi serve aiuto mio padre lavora", expected: {} },
    { text: "mi serve aiuto", expected: {} },
  ],
  en: [
    {
      text: "I need the ISEE I live with my mum and my dad does not live with us",
      expected: { ...mother, applicant_parent_nonresident: true },
    },
    {
      text: "gotta do isee i live with mom and my dad doesn't live with us i have a Fineco account and a car",
      expected: {
        ...mother,
        applicant_parent_nonresident: true,
        accounts_count: 1,
        account_bank_0: "Fineco",
        vehicles_count: 1,
      },
    },
    {
      text: "i have a motorbike i stay with dad but my mom lives elsewhere",
      expected: { ...father, applicant_parent_nonresident: true, vehicles_count: 1 },
    },
    { text: "i live with my husband and my daughter", expected: spouseAndChild },
    {
      text: "with my wife i live and two kids",
      expected: {
        household_count: 4,
        household_roles: ["richiedente", "coniuge", "figlio", "figlio"],
        household_relations: ["coniuge", "figlio", "figlio"],
      },
    },
    { text: "need help my father works", expected: {} },
    { text: "can you help me", expected: {} },
  ],
  fr: [
    {
      text: "besoin isee je vis avec maman et mon papa ne vit pas avec nous j'ai un compte chez Fineco et une voiture",
      expected: {
        ...mother,
        applicant_parent_nonresident: true,
        accounts_count: 1,
        account_bank_0: "Fineco",
        vehicles_count: 1,
      },
    },
    {
      text: "j ai une moto j habite avec papa mais ma mere habite ailleurs",
      expected: { ...father, applicant_parent_nonresident: true, vehicles_count: 1 },
    },
    { text: "je vis avec mon mari et ma fille", expected: spouseAndChild },
    {
      text: "avec ma femme je vis et deux enfants",
      expected: {
        household_count: 4,
        household_roles: ["richiedente", "coniuge", "figlio", "figlio"],
        household_relations: ["coniuge", "figlio", "figlio"],
      },
    },
    { text: "aidez moi mon père travaille", expected: {} },
    { text: "besoin d aide", expected: {} },
  ],
  es: [
    {
      text: "necesito isee vivo con mamá y mi papá no vive con nosotros tengo una cuenta en Fineco y un coche",
      expected: {
        ...mother,
        applicant_parent_nonresident: true,
        accounts_count: 1,
        account_bank_0: "Fineco",
        vehicles_count: 1,
      },
    },
    {
      text: "tengo un carro vivo con papa pero mi mama vive aparte",
      expected: { ...father, applicant_parent_nonresident: true, vehicles_count: 1 },
    },
    { text: "vivo con mi esposo y mi hija", expected: spouseAndChild },
    {
      text: "con mi esposa vivo y dos hijos tengo una moto",
      expected: {
        household_count: 4,
        household_roles: ["richiedente", "coniuge", "figlio", "figlio"],
        household_relations: ["coniuge", "figlio", "figlio"],
        vehicles_count: 1,
      },
    },
    { text: "ayuda mi padre trabaja", expected: {} },
    { text: "necesito ayuda", expected: {} },
  ],
  ro: [
    {
      text: "vreau isee stau cu mama si tata nu locuiește cu noi am un cont la Fineco si o mașină",
      expected: {
        ...mother,
        applicant_parent_nonresident: true,
        accounts_count: 1,
        account_bank_0: "Fineco",
        vehicles_count: 1,
      },
    },
    {
      text: "am o masina locuiesc cu tata dar mama nu locuieste cu noi",
      expected: { ...father, applicant_parent_nonresident: true, vehicles_count: 1 },
    },
    { text: "locuiesc cu sotul meu si fiica", expected: spouseAndChild },
    {
      text: "cu sotia locuiesc si doi copii",
      expected: {
        household_count: 4,
        household_roles: ["richiedente", "coniuge", "figlio", "figlio"],
        household_relations: ["coniuge", "figlio", "figlio"],
      },
    },
    { text: "ajutor tata lucreaza", expected: {} },
    { text: "vreau ajutor", expected: {} },
  ],
  uk: [
    {
      text: "треба isee живу з мамою і тато з нами не живе у мене є рахунок у Fineco і машина",
      expected: {
        ...mother,
        applicant_parent_nonresident: true,
        accounts_count: 1,
        account_bank_0: "Fineco",
        vehicles_count: 1,
      },
    },
    {
      text: "маю автомобіль живу з батьком але мама не живе з нами",
      expected: { ...father, applicant_parent_nonresident: true, vehicles_count: 1 },
    },
    { text: "живу з чоловіком і донькою", expected: spouseAndChild },
    {
      text: "з дружиною живу і двома дітьми",
      expected: {
        household_count: 4,
        household_roles: ["richiedente", "coniuge", "figlio", "figlio"],
        household_relations: ["coniuge", "figlio", "figlio"],
      },
    },
    { text: "допоможіть мій батько працює", expected: {} },
    { text: "потрібна допомога", expected: {} },
  ],
  ar: [
    {
      text: "احتاج isee أعيش مع أمي وأبي لا يعيش معنا لدي حساب في Fineco وسيارة",
      expected: {
        ...mother,
        applicant_parent_nonresident: true,
        accounts_count: 1,
        account_bank_0: "Fineco",
        vehicles_count: 1,
      },
    },
    {
      text: "لدي دراجة نارية أسكن مع بابا لكن ماما لا تعيش معنا",
      expected: { ...father, applicant_parent_nonresident: true, vehicles_count: 1 },
    },
    { text: "أعيش مع زوجي وابنتي", expected: spouseAndChild },
    {
      text: "أسكن مع زوجتي وطفلين",
      expected: {
        household_count: 4,
        household_roles: ["richiedente", "coniuge", "figlio", "figlio"],
        household_relations: ["coniuge", "figlio", "figlio"],
      },
    },
    { text: "اريد مساعدة والدي يعمل", expected: {} },
    { text: "ممكن مساعدة", expected: {} },
  ],
  bn: [
    { text: "আমার ISEE করতে হবে আমি আমার মায়ের সাথে থাকি", expected: mother },
    {
      text: "isee করতে হবে আমি মায়ের সাথে থাকি আর আমার বাবা আমাদের সাথে থাকেন না আমার একটি Fineco অ্যাকাউন্ট আর একটি গাড়ি আছে",
      expected: {
        ...mother,
        applicant_parent_nonresident: true,
        accounts_count: 1,
        account_bank_0: "Fineco",
        vehicles_count: 1,
      },
    },
    {
      text: "আমার একটা বাইক আছে আমি আব্বুর সঙ্গে থাকি আর আমার মা আমাদের সাথে থাকে না",
      expected: { ...father, applicant_parent_nonresident: true, vehicles_count: 1 },
    },
    { text: "আমি স্বামীর সাথে থাকি আর মেয়ের", expected: spouseAndChild },
    {
      text: "আমি স্ত্রীর সঙ্গে থাকি আর দুই ছেলের",
      expected: {
        household_count: 4,
        household_roles: ["richiedente", "coniuge", "figlio", "figlio"],
        household_relations: ["coniuge", "figlio", "figlio"],
      },
    },
    { text: "সাহায্য দরকার আমার বাবা কাজ করেন", expected: {} },
    { text: "আমার সাহায্য দরকার", expected: {} },
  ],
};

describe("informal citizen stories", () => {
  for (const language of Object.keys(VARIANTS) as Language[]) {
    it.each(VARIANTS[language])(`${language}: $text`, ({ text, expected }) => {
      const result = extractFacts(text, language, "isee_ordinario");
      expect(result.answers).toMatchObject(expected);
      if (!Object.keys(expected).length) expect(result.answers).toEqual({});
      if (expected.household_count) {
        expect(result.facts.householdCount).toBe(expected.household_count);
      }
    });
  }
});

const PARENT_NEGATIONS: [Language, string][] = [
  ["it", "vivo con mamma e mio padre non vive con noi"],
  ["en", "i live with mum and my dad doesn't live with us"],
  ["en", "i live with mom and my dad does not live with us"],
  ["en", "i live with mum and my dad isn't living with us"],
  ["en", "i live with mom and my dad lives elsewhere"],
  ["en", "i live with mum and my dad lives apart"],
  ["fr", "je vis avec maman et mon papa ne vit pas avec nous"],
  ["es", "vivo con mamá y mi papá no vive con nosotros"],
  ["ro", "locuiesc cu mama și tata nu locuiește cu noi"],
  ["uk", "живу з мамою і батько не живе з нами"],
  ["ar", "أعيش مع والدتي ووالدي لا يعيش معنا"],
  ["ar", "أعيش مع ماما وبابا لا يعيش معنا"],
  ["bn", "আমি আম্মুর সাথে থাকি আর আমার আব্বু আমাদের সাথে থাকে না"],
  ["bn", "আমি মায়ের সঙ্গে থাকি আর আমার বাবা আমাদের সঙ্গে থাকেন না"],
];
it.each(PARENT_NEGATIONS)("negation scope in %s: %s", (language, text) => {
  const result = extractFacts(text, language, "isee_ordinario");
  expect(result.answers).toEqual({ ...mother, applicant_parent_nonresident: true });
  expect(result.answers.nonresident_parent).toBeUndefined();
});

it.each([
  ["it", "abito con mio papà"],
  ["en", "i live with dad"],
  ["fr", "je vis avec papa"],
  ["es", "vivo con papá"],
  ["ro", "stau cu tata"],
  ["uk", "живу з татом"],
  ["ar", "أعيش مع والدي"],
  ["bn", "আমি বাবার সাথে থাকি"],
] as const)("resident father in %s", (language, text) => {
  expect(extractFacts(text, language, "isee_ordinario").answers).toEqual(father);
});

const ASSETS: [Language, string, number][] = [
  ["it", "ho un auto e una moto", 2],
  ["en", "i have a car and a motorcycle", 2],
  ["fr", "j ai une voiture et une moto", 2],
  ["es", "tengo un carro y un coche y una moto", 3],
  ["ro", "am o mașină și o motocicletă", 2],
  ["uk", "маю машину і автомобіль", 2],
  ["ar", "لدي سيارة ودراجة نارية", 2],
  ["bn", "আমার একটি গাড়ি আর একটি মোটরসাইকেল আর একটি বাইক আছে", 3],
];
it.each(ASSETS)("vehicles in %s: %s", (language, text, count) => {
  expect(extractFacts(text, language, "isee_ordinario").answers.vehicles_count).toBe(count);
});

const BANK_WRAPPERS: Record<Language, (bank: string) => string> = {
  it: (bank) => `ho un conto ${bank}`,
  en: (bank) => `i have a ${bank} account`,
  fr: (bank) => `j ai un compte chez ${bank}`,
  es: (bank) => `tengo una cuenta en ${bank}`,
  ro: (bank) => `am un cont la ${bank}`,
  uk: (bank) => `у мене є рахунок у${bank}`,
  ar: (bank) => `لدي حساب في${bank}`,
  bn: (bank) => `আমার একটি ${bank}অ্যাকাউন্ট আছে`,
};
const EXPECTED_BANKS = [
  "Fineco",
  "Intesa Sanpaolo",
  "UniCredit",
  "Poste",
  "BancoPosta",
  "BNL",
  "Banco BPM",
  "Mediolanum",
  "ING",
  "N26",
  "Revolut",
  "Hype",
  "BPER",
  "Crédit Agricole",
  "Monte dei Paschi",
  "Sella",
  "Santander",
  "Wise",
];
for (const language of Object.keys(BANK_WRAPPERS) as Language[]) {
  it.each(EXPECTED_BANKS)(`${language}: bank %s with surrounding script`, (bank) => {
    const result = extractFacts(
      BANK_WRAPPERS[language](bank.toUpperCase()),
      language,
      "isee_ordinario",
    );
    expect(result.answers.accounts_count).toBe(1);
    expect(result.answers.account_bank_0).toBe(bank);
    expect(result.facts.institutions).toEqual([bank]);
  });
}
it("matches whole Latin bank names, not substrings", () => {
  expect(extractFacts("Finecologia BPERsonale INGrosso", "it", "isee_ordinario").answers).toEqual(
    {},
  );
});
it("keeps affirmative banks and vehicles independent from negated assets", () => {
  expect(
    extractFacts("non ho conti Fineco ma ho un conto Revolut e una moto", "it", "isee_ordinario")
      .answers,
  ).toMatchObject({ accounts_count: 1, account_bank_0: "Revolut", vehicles_count: 1 });
});
it.each(["it", "bn", "ar", "uk", "en"] as const)(
  "normalizes Unicode and case in %s",
  (language) => {
    expect(
      extractFacts(DEMO_STORIES[language].normalize("NFD").toUpperCase(), language).answers,
    ).toEqual(DEMO_EXPECTED.answers);
  },
);
it.each([
  ["siamo in 3 vivo con mamma", 3],
  ["siamo in 2 vivo con mamma e papà", 3],
  ["siamo in 2 vivo con mia moglie e due figli", 4],
])("reconciles stated household and roles: %s", (text, count) => {
  const result = extractFacts(String(text), "it", "isee_ordinario");
  expect(result.answers.household_count).toBe(count);
  expect(result.facts.householdCount).toBe(count);
});
it("does not invent the number of unspecified children", () => {
  expect(extractFacts("vivo con mia moglie e figli", "it", "isee_ordinario").answers).toMatchObject(
    { household_count: 2, household_roles: ["richiedente", "coniuge"] },
  );
});
it.each([
  ["it", "vivo con mamma e mio padre lavora"],
  ["en", "i live with mom and my father works"],
  ["fr", "je vis avec maman et mon père travaille"],
  ["es", "vivo con mama y mi padre trabaja"],
  ["ro", "locuiesc cu mama si tata lucreaza"],
  ["uk", "живу з мамою і батько працює"],
  ["ar", "أعيش مع أمي وأبي يعمل"],
  ["bn", "আমি মায়ের সাথে থাকি আর আমার বাবা কাজ করেন"],
] as const)("does not count an unrelated subject in %s", (language, text) => {
  expect(extractFacts(text, language, "isee_ordinario").answers).toEqual(mother);
});

it.each([
  ["it", "vivo con mamma mio padre non vive con noi"],
  ["en", "i live with mum my dad does not live with us"],
  ["fr", "je vis avec maman mon papa ne vit pas avec nous"],
  ["es", "vivo con mamá mi papá no vive con nosotros"],
  ["ro", "locuiesc cu mama tata nu locuiește cu noi"],
  ["uk", "живу з мамою тато з нами не живе"],
  ["ar", "أعيش مع أمي أبي لا يعيش معنا"],
  ["bn", "আমি মায়ের সাথে থাকি আমার বাবা আমাদের সাথে থাকেন না"],
] as const)("parent negation without punctuation or conjunction in %s", (language, text) => {
  expect(extractFacts(text, language, "isee_ordinario").answers).toEqual({
    ...mother,
    applicant_parent_nonresident: true,
  });
});
it.each([
  ["it", "vivo con mamma mio padre lavora"],
  ["en", "my father works i live with mum"],
] as const)("unrelated subject without punctuation in %s", (language, text) => {
  expect(extractFacts(text, language, "isee_ordinario").answers).toEqual(mother);
});
it("keeps relatives listed with commas in the living context", () => {
  expect(
    extractFacts("vivo con mamma, papà, due figli", "it", "isee_ordinario").answers.household_count,
  ).toBe(5);
});
it.each([
  ["it", "non vivo con mia madre"],
  ["en", "i do not live with my mother"],
  ["fr", "je ne vis pas avec maman"],
  ["es", "no vivo con mamá"],
  ["ro", "nu locuiesc cu mama"],
  ["uk", "не живу з мамою"],
  ["ar", "لا أعيش مع أمي"],
  ["bn", "আমি মায়ের সাথে থাকি না"],
] as const)(
  "does not turn negative first-person living into a household in %s",
  (language, text) => {
    const result = extractFacts(text, language, "isee_ordinario");
    expect(result.answers.household_roles).toBeUndefined();
    expect(result.answers.household_count).toBeUndefined();
  },
);
it("does not confuse the applicant's father with their child's father in one statement", () => {
  const result = extractFacts(
    "ho un figlio minorenne mio padre non vive con noi",
    "it",
    "isee_ordinario",
  );
  expect(result.answers.applicant_parent_nonresident).toBe(true);
  expect(result.answers.nonresident_parent).toBeUndefined();
});
it.each([
  ["it", "siamo in tre vivo con mamma"],
  ["en", "we are three i live with mom"],
  ["fr", "nous sommes trois je vis avec maman"],
  ["es", "somos tres vivo con mamá"],
  ["ro", "suntem trei stau cu mama"],
  ["uk", "нас три живу з мамою"],
  ["ar", "نحن ثلاثة أعيش مع أمي"],
  ["bn", "আমরা তিন জন আমি মায়ের সাথে থাকি"],
] as const)("keeps an explicit greater count in %s", (language, text) => {
  const result = extractFacts(text, language, "isee_ordinario");
  expect(result.answers).toEqual({ ...mother, household_count: 3 });
  expect(result.facts.householdCount).toBe(3);
});
it.each([
  ["আমি আমার স্বামীর আর মেয়ের সাথে থাকি", spouseAndChild],
  [
    "আমি আমার স্ত্রীর আর দুই ছেলের সঙ্গে থাকি",
    {
      household_count: 4,
      household_roles: ["richiedente", "coniuge", "figlio", "figlio"],
      household_relations: ["coniuge", "figlio", "figlio"],
    },
  ],
  [
    "আমি আমার মায়ের আর বাবার সাথে থাকি",
    {
      household_count: 3,
      household_roles: ["richiedente", "genitore", "genitore"],
      household_relations: ["madre", "padre"],
    },
  ],
] as const)(
  "Bengali shares a final living verb across the preceding list: %s",
  (text, expected) => {
    expect(extractFacts(text, "bn", "isee_ordinario").answers).toEqual(expected);
  },
);
it("Bengali does not share a negated final living verb", () => {
  const result = extractFacts("আমি আমার স্বামীর আর ছেলের সাথে থাকি না", "bn", "isee_ordinario");
  expect(result.answers.household_count).toBeUndefined();
});
it("Bengali does not share the living verb with an unrelated earlier subject", () => {
  expect(
    extractFacts("আমার মা কাজ করে আর আমি বাবার সাথে থাকি", "bn", "isee_ordinario").answers,
  ).toEqual(father);
});
it.each([
  ["it", "vivo con mamma papà"],
  ["en", "i live with mom dad"],
  ["fr", "je vis avec maman papa"],
  ["es", "vivo con mamá papá"],
  ["ro", "stau cu mama tata"],
  ["uk", "живу з мамою татом"],
  ["ar", "أعيش مع أمي أبي"],
  ["bn", "আমি আমার মায়ের বাবার সাথে থাকি"],
] as const)("accepts a bare list without punctuation in %s", (language, text) => {
  const result = extractFacts(text, language, "isee_ordinario");
  expect(result.answers).toEqual({
    household_count: 3,
    household_roles: ["richiedente", "genitore", "genitore"],
    household_relations: ["madre", "padre"],
  });
});

describe("children listed after the spouse, with articles, possessives or a repeated preposition", () => {
  const family = (children: number) => ({
    household_count: children + 2,
    household_roles: ["richiedente", "coniuge", ...Array(children).fill("figlio")],
    household_relations: ["coniuge", ...Array(children).fill("figlio")],
  });
  it("understands the Romanian story from the screenshot: me, husband, two children", () => {
    const result = extractFacts(
      "Trebuie să fac ISEE, locuiesc cu soțul și cei doi copii, avem un cont la bancă și o mașină.",
      "ro",
    );
    expect(result.practiceId).toBe("isee_ordinario");
    expect(result.answers).toEqual({
      ...family(2),
      accounts_count: 1,
      account_type_0: "deposit",
      vehicles_count: 1,
    });
    expect(result.facts.householdCount).toBe(4);
  });
  const STORIES: [Language, string, number][] = [
    ["it", "vivo con mio marito e i miei due figli", 2],
    ["it", "vivo con mio marito e con i miei due figli", 2],
    ["it", "vivo con mia moglie e i nostri tre figli", 3],
    ["it", "vivo con mio marito e i due bambini", 2],
    ["en", "i live with my husband and my two kids", 2],
    ["en", "i live with my wife and our three children", 3],
    ["en", "i live with my husband and the two kids", 2],
    ["en", "i live with my husband and with my two kids", 2],
    ["fr", "je vis avec mon mari et mes deux enfants", 2],
    ["fr", "je vis avec mon mari et nos deux enfants", 2],
    ["fr", "je vis avec mon mari et avec mes deux enfants", 2],
    ["es", "vivo con mi marido y mis dos hijos", 2],
    ["es", "vivo con mi marido y nuestros dos hijos", 2],
    ["es", "vivo con mi marido y con mis dos hijos", 2],
    ["ro", "locuiesc cu soțul și cei doi copii", 2],
    ["ro", "locuiesc cu soțul și cu cei doi copii", 2],
    ["ro", "locuiesc cu soția și cele două fiice", 2],
    ["ro", "locuiesc cu soțul meu și cei trei copii ai noștri", 3],
    ["uk", "я живу з чоловіком і двоє дітей", 2],
    ["uk", "я живу з чоловіком і нашими двома дітьми", 2],
    ["uk", "я живу з чоловіком і з двома дітьми", 2],
    ["ar", "أعيش مع زوجي وطفلين", 2],
    ["ar", "أعيش مع زوجي وطفلي الاثنين", 2],
    ["ar", "أعيش مع زوجي وأطفالي الثلاثة", 3],
    ["bn", "আমি স্বামী ও দুই সন্তানের সাথে থাকি", 2],
    ["bn", "আমি আমার স্বামী আর দুই সন্তানের সাথে থাকি", 2],
    ["bn", "আমি আমার স্ত্রী ও তিন সন্তানের সঙ্গে থাকি", 3],
  ];
  it.each(STORIES)("%s: %s", (language, text, children) => {
    const result = extractFacts(text, language, "isee_ordinario");
    expect(result.answers).toEqual(family(children));
    expect(result.facts.householdCount).toBe(children + 2);
  });
  it.each([
    ["it", "vivo con i miei due figli"],
    ["en", "i live with my two kids"],
    ["fr", "je vis avec mes deux enfants"],
    ["es", "vivo con mis dos hijos"],
    ["ro", "locuiesc cu cei doi copii ai mei"],
    ["uk", "живу з двома дітьми"],
    ["ar", "أعيش مع طفلين"],
    ["bn", "আমি আমার দুই সন্তানের সাথে থাকি"],
  ] as const)("only children in %s: %s", (language, text) => {
    expect(extractFacts(text, language, "isee_ordinario").answers).toEqual({
      household_count: 3,
      household_roles: ["richiedente", "figlio", "figlio"],
      household_relations: ["figlio", "figlio"],
    });
  });
  it.each([
    ["it", "non ho figli, vivo con mio marito"],
    ["it", "vivo con mio marito e i nostri due figli non vivono con noi"],
    ["en", "i have no kids, i live with my husband"],
    ["en", "i live with my wife and our son doesn't live with us"],
    ["fr", "je n'ai pas d'enfants, je vis avec mon mari"],
    ["fr", "je vis avec mon mari et avec nos deux enfants qui étudient à paris"],
    ["es", "no tengo hijos, vivo con mi marido"],
    ["ro", "nu am copii, locuiesc cu soțul"],
    ["ro", "locuiesc cu soțul, cei doi copii nu locuiesc cu noi"],
    ["uk", "у мене немає дітей, живу з чоловіком"],
    ["uk", "я живу з чоловіком, наші двоє дітей живуть окремо"],
    ["ar", "ليس لدي أطفال، أعيش مع زوجي"],
    ["ar", "أعيش مع زوجي وأطفالي الثلاثة لا يعيشون معنا"],
    ["bn", "আমার কোনো সন্তান নেই, আমি স্বামীর সাথে থাকি"],
  ] as const)("children not living with the applicant stay out in %s: %s", (language, text) => {
    expect(extractFacts(text, language, "isee_ordinario").answers).toEqual({
      household_count: 2,
      household_roles: ["richiedente", "coniuge"],
      household_relations: ["coniuge"],
    });
  });
  it("still does not invent a number for plural children with an article", () => {
    expect(
      extractFacts("locuiesc cu soțul și copiii mei", "ro", "isee_ordinario").answers,
    ).toMatchObject({ household_count: 2, household_roles: ["richiedente", "coniuge"] });
    expect(
      extractFacts("vivo con mio marito e i bambini", "it", "isee_ordinario").answers,
    ).toMatchObject({ household_count: 2, household_roles: ["richiedente", "coniuge"] });
  });
  it("splits Bengali lists on ও without merging an unrelated subject", () => {
    expect(
      extractFacts("আমি মায়ের সাথে থাকি ও আমার বাবা কাজ করেন", "bn", "isee_ordinario").answers,
    ).toEqual(mother);
    expect(extractFacts("আমার একটি গাড়ি ও একটি বাইক আছে", "bn", "isee_ordinario").answers).toEqual(
      { vehicles_count: 2 },
    );
  });
});

describe("numbers after a child are not a count of children", () => {
  const oneChild = {
    household_count: 2,
    household_roles: ["richiedente", "figlio"],
    household_relations: ["figlio"],
  };
  it.each([
    ["ar", "أعيش مع ابني 15 عاما"],
    ["ar", "أعيش مع طفلي 7 سنوات"],
    // «الاثنين» is also Monday: after a singular son it is not «two».
    ["ar", "أعيش مع ابني الاثنين والخميس"],
    ["it", "vivo con mio figlio 15 anni"],
    ["it", "vivo con mio figlio di 15 anni"],
    ["en", "i live with my son, 15"],
    ["en", "i live with my son 15"],
    ["fr", "je vis avec mon fils de 15 ans"],
    ["es", "vivo con mi hijo de 15 años"],
    ["ro", "locuiesc cu fiul meu de 15 ani"],
    ["uk", "живу з сином 15 років"],
    ["bn", "আমি আমার ছেলের সাথে থাকি, বয়স ১৫"],
  ] as const)("%s: %s", (language, text) => {
    expect(extractFacts(text, language, "isee_ordinario").answers).toEqual(oneChild);
  });
  it("counts the same named child once", () => {
    expect(
      extractFacts("vivo con mio figlio e mio figlio", "it", "isee_ordinario").answers,
    ).toEqual(oneChild);
  });
});

describe("a cohabiting partner is part of the household", () => {
  const partner = (children: number) => ({
    household_count: children + 2,
    household_roles: ["richiedente", "altro", ...Array(children).fill("figlio")],
    household_relations: ["partner", ...Array(children).fill("figlio")],
  });
  it.each([
    ["it", "vivo con la mia compagna e due figli", 2],
    ["it", "vivo con il mio convivente", 0],
    ["en", "i live with my partner and our two kids", 2],
    ["fr", "je vis avec mon compagnon", 0],
    ["es", "vivo con mi pareja y mis dos hijos", 2],
    ["ro", "locuiesc cu partenerul meu și cei doi copii", 2],
    ["uk", "живу з партнером", 0],
    ["ar", "أعيش مع شريكي", 0],
    ["bn", "আমি আমার সঙ্গীর সাথে থাকি", 0],
  ] as const)("%s: %s", (language, text, children) => {
    expect(extractFacts(text, language, "isee_ordinario").answers).toEqual(partner(children));
  });
  it("keeps a roommate a roommate and a non-cohabiting parent out", () => {
    expect(
      extractFacts("vivo con un compagno di stanza", "it", "isee_ordinario").answers
        .household_relations,
    ).toEqual(["coinquilino"]);
    expect(
      extractFacts("vivo con mi compañero de piso", "es", "isee_ordinario").answers
        .household_relations,
    ).toEqual(["coinquilino"]);
    expect(
      extractFacts("vivo con mamma e mio padre non convivente", "it", "isee_ordinario").answers,
    ).toEqual(mother);
  });
});
