import { describe, expect, it } from "vitest";
import {
  integerCategories,
  isPluralForms,
  plural,
  pluralCategory,
  type PluralForms,
} from "./plural";

const questionsUk: PluralForms = {
  one: "{n} запитання",
  few: "{n} запитання",
  many: "{n} запитань",
  other: "{n} запитання",
};
const daysUk: PluralForms = { one: "{n} день", few: "{n} дні", many: "{n} днів", other: "{n} дня" };
const questionsAr: PluralForms = {
  zero: "لا أسئلة",
  one: "سؤال واحد",
  two: "سؤالان",
  few: "{n} أسئلة",
  many: "{n} سؤالًا",
  other: "{n} سؤال",
};
const questionsRo: PluralForms = {
  one: "o întrebare",
  few: "{n} întrebări",
  other: "{n} de întrebări",
};

describe("plural", () => {
  it.each([
    [0, "0 днів"],
    [1, "1 день"],
    [2, "2 дні"],
    [5, "5 днів"],
    [11, "11 днів"],
    [12, "12 днів"],
    [21, "21 день"],
    [22, "22 дні"],
    [25, "25 днів"],
    [111, "111 днів"],
  ])("Ukrainian %i", (n, expected) => {
    expect(plural("uk", n, daysUk)).toBe(expected);
  });

  it("Ukrainian one, few and other may share a form while many differs", () => {
    expect([1, 2, 5, 11, 21].map((n) => plural("uk", n, questionsUk))).toEqual([
      "1 запитання",
      "2 запитання",
      "5 запитань",
      "11 запитань",
      "21 запитання",
    ]);
  });

  it.each([
    [0, "لا أسئلة"],
    [1, "سؤال واحد"],
    [2, "سؤالان"],
    [5, "5 أسئلة"],
    [10, "10 أسئلة"],
    [11, "11 سؤالًا"],
    [21, "21 سؤالًا"],
    [99, "99 سؤالًا"],
    [100, "100 سؤال"],
    [103, "103 أسئلة"],
  ])("Arabic %i", (n, expected) => {
    expect(plural("ar", n, questionsAr)).toBe(expected);
  });

  it.each([
    [0, "0 întrebări"],
    [1, "o întrebare"],
    [2, "2 întrebări"],
    [5, "5 întrebări"],
    [11, "11 întrebări"],
    [19, "19 întrebări"],
    [20, "20 de întrebări"],
    [21, "21 de întrebări"],
    [101, "101 întrebări"],
  ])("Romanian %i", (n, expected) => {
    expect(plural("ro", n, questionsRo)).toBe(expected);
  });

  it("prefers the exact match, which is not the same as the 'one' category", () => {
    const missing: PluralForms = {
      "=1": "Бракує ще 1: його попросять.",
      other: "Бракує ще {n}: їх попросять.",
    };
    expect(plural("uk", 1, missing)).toBe("Бракує ще 1: його попросять.");
    expect(plural("uk", 21, missing)).toBe("Бракує ще 21: їх попросять.");
    const french: PluralForms = { "=0": "aucune", one: "{n} question", other: "{n} questions" };
    expect(plural("fr", 0, french)).toBe("aucune");
    expect(plural("fr", 1, french)).toBe("1 question");
  });

  it("falls back to other and fills extra placeholders", () => {
    expect(plural("it", 1, { other: "{n} min" })).toBe("1 min");
    expect(plural("uk", 3, { other: "{min}–{max} хв" }, { min: 2, max: 3 })).toBe("2–3 хв");
    expect(plural("it", 2, { other: "{n} di {name}" })).toBe("2 di {name}");
  });

  it("French and Bengali count zero as 'one'", () => {
    expect(pluralCategory("fr", 0)).toBe("one");
    expect(pluralCategory("bn", 0)).toBe("one");
    expect(pluralCategory("it", 0)).toBe("other");
  });
});

describe("integerCategories", () => {
  it("lists what translators must write, not fractions or millions", () => {
    expect(integerCategories("it").sort()).toEqual(["one", "other"]);
    expect(integerCategories("uk").sort()).toEqual(["few", "many", "one"]);
    expect(integerCategories("ar").sort()).toEqual(["few", "many", "one", "other", "two", "zero"]);
    expect(integerCategories("ro").sort()).toEqual(["few", "one", "other"]);
  });
});

describe("isPluralForms", () => {
  it("accepts plural objects and nothing else", () => {
    expect(isPluralForms({ one: "a", other: "b" })).toBe(true);
    expect(isPluralForms({ other: "b", "=1": "c" })).toBe(true);
    expect(isPluralForms({ one: "a" })).toBe(false);
    expect(isPluralForms({ other: "b", label: "c" })).toBe(false);
    expect(isPluralForms("b")).toBe(false);
    expect(isPluralForms(["b"])).toBe(false);
    expect(isPluralForms(null)).toBe(false);
  });
});
