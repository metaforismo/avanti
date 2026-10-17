import { describe, expect, it } from "vitest";
import { LANGUAGES } from "@avanti/contracts/constants";
import { integerCategories, isPluralForms, type PluralForms } from "@avanti/core/plural";
import { format, MESSAGES, plural } from "./messages";

function leaves(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") return [prefix];
  if (Array.isArray(value)) return [prefix];
  if (isPluralForms(value)) return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    leaves(v, prefix ? `${prefix}.${k}` : k),
  );
}

const read = (language: (typeof LANGUAGES)[number], key: string) =>
  key
    .split(".")
    .reduce<unknown>((obj, k) => (obj as Record<string, unknown>)[k], MESSAGES[language]);

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("citizen messages", () => {
  const italianKeys = leaves(MESSAGES.it).sort();
  const pluralKeys = italianKeys.filter((key) => isPluralForms(read("it", key)));

  it.each(LANGUAGES)("%s defines every key with non-empty text", (language) => {
    expect(leaves(MESSAGES[language]).sort()).toEqual(italianKeys);
    for (const key of italianKeys) {
      const value = read(language, key);
      const texts = isPluralForms(value) ? Object.values(value) : [value];
      for (const text of texts)
        if (typeof text === "string") expect(text.trim(), `${language}.${key}`).not.toBe("");
    }
  });

  it("keeps the same placeholders across languages", () => {
    for (const language of LANGUAGES) {
      for (const key of italianKeys) {
        const it = read("it", key);
        const other = read(language, key);
        if (typeof it === "string")
          expect(placeholders(other as string), `${language}.${key}`).toEqual(placeholders(it));
        if (isPluralForms(it)) {
          expect(isPluralForms(other), `${language}.${key}`).toBe(true);
          const forms = other as PluralForms;
          const allowed = placeholders(it.other);
          expect(placeholders(forms.other), `${language}.${key}.other`).toEqual(allowed);
          // A form may spell the number out ("una domanda", "سؤالان"), never add a placeholder.
          for (const [category, form] of Object.entries(forms))
            for (const name of placeholders(form))
              expect(allowed, `${language}.${key}.${category}`).toContain(name);
        }
      }
    }
  });

  // Ukrainian needs one/few/many, Arabic all six categories, Romanian one/few/other: a message
  // with only "one" and "other" would print "5 запитання" or "11 أسئلة".
  it.each(LANGUAGES)("%s writes every plural form its rules use", (language) => {
    expect(pluralKeys.length).toBeGreaterThan(0);
    for (const key of pluralKeys) {
      const forms = read(language, key) as PluralForms;
      const categories = Object.keys(forms).filter((k) => !k.startsWith("="));
      if (categories.length === 1) continue; // only "other": invariant in this language
      for (const category of integerCategories(language))
        expect(categories, `${language}.${key}`).toContain(category);
    }
  });

  it("formats placeholders and leaves unknown ones visible", () => {
    expect(format("{done} di {total}", { done: 2, total: 5 })).toBe("2 di 5");
    expect(format("ciao {name}", {})).toBe("ciao {name}");
  });

  it.each([
    ["it", 1, "Puoi fare ancora una domanda oggi."],
    ["it", 3, "Puoi fare ancora 3 domande oggi."],
    ["en", 1, "You can ask one more question today."],
    ["fr", 1, "Vous pouvez encore poser une question aujourd'hui."],
    ["uk", 1, "Сьогодні Ви можете поставити ще одне запитання."],
    ["uk", 3, "Сьогодні Ви можете поставити ще 3 запитання."],
    ["uk", 5, "Сьогодні Ви можете поставити ще 5 запитань."],
    ["ar", 2, "يمكنك طرح سؤالين آخرين اليوم."],
    ["ar", 5, "يمكنك طرح 5 أسئلة أخرى اليوم."],
    ["ro", 1, "Mai poți pune o întrebare azi."],
  ] as const)("assistant questions left in %s for %i", (language, n, expected) => {
    expect(plural(language, n, MESSAGES[language].assistant.remaining)).toBe(expected);
  });

  it.each([
    ["it", 1, "circa un minuto"],
    ["it", 10, "circa 10 minuti"],
    ["fr", 1, "environ une minute"],
    ["ro", 20, "aproximativ 20 de minute"],
    ["ar", 2, "حوالي دقيقتين"],
    ["ar", 15, "حوالي 15 دقيقة"],
  ] as const)("practice duration in %s for %i minutes", (language, n, expected) => {
    expect(plural(language, n, MESSAGES[language].need.minutes)).toBe(expected);
  });

  it("missing documents: exactly one keeps its own sentence, 21 does not", () => {
    expect(plural("it", 1, MESSAGES.it.docs.missing)).toMatch(/^Ne manca 1\. .* te lo chiederà\.$/);
    expect(plural("fr", 1, MESSAGES.fr.docs.missing)).toMatch(/vous le demandera/);
    expect(plural("fr", 2, MESSAGES.fr.docs.missing)).toMatch(/vous les demandera/);
    expect(plural("uk", 1, MESSAGES.uk.docs.missing)).toMatch(/його попросять/);
    expect(plural("uk", 21, MESSAGES.uk.docs.missing)).toMatch(/^Бракує ще 21\. .*їх попросять/);
    expect(plural("ar", 11, MESSAGES.ar.docs.missing)).toMatch(/^ما زال ينقص 11 مستندًا\./);
  });

  it("ranges agree with their upper bound", () => {
    const range = (language: "uk" | "ro" | "ar", min: number, max: number) =>
      plural(language, max, MESSAGES[language].interview.remainingRange, { min, max });
    expect(range("uk", 3, 4)).toBe("Залишилось 3–4 запитання");
    expect(range("uk", 4, 6)).toBe("Залишилось 4–6 запитань");
    expect(range("ro", 18, 22)).toBe("Mai sunt 18–22 de întrebări");
    expect(range("ar", 9, 12)).toBe("يبقى 9–12 سؤالًا");
  });
});

describe("documents counter", () => {
  it.each([
    ["it", 0, 1, "0 di 1 pronto"],
    ["it", 1, 3, "1 di 3 pronti"],
    ["fr", 1, 1, "1 sur 1 prêt"],
    ["es", 2, 4, "2 de 4 listos"],
    ["uk", 2, 5, "Готово 2 з 5"],
  ] as const)("%s: %i of %i", (language, done, total, expected) => {
    expect(plural(language, total, MESSAGES[language].docs.progress, { done, total })).toBe(
      expected,
    );
  });
});
