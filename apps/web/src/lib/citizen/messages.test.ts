import { describe, expect, it } from "vitest";
import { LANGUAGES } from "@avanti/contracts";
import { format, MESSAGES } from "./messages";

function leaves(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") return [prefix];
  if (Array.isArray(value)) return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    leaves(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe("citizen messages", () => {
  const italianKeys = leaves(MESSAGES.it).sort();

  it.each(LANGUAGES)("%s defines every key with non-empty text", (language) => {
    expect(leaves(MESSAGES[language]).sort()).toEqual(italianKeys);
    for (const key of italianKeys) {
      const value = key
        .split(".")
        .reduce<unknown>((obj, k) => (obj as Record<string, unknown>)[k], MESSAGES[language]);
      if (typeof value === "string") expect(value.trim(), `${language}.${key}`).not.toBe("");
    }
  });

  it("keeps the same placeholders across languages", () => {
    const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const language of LANGUAGES) {
      for (const key of italianKeys) {
        const read = (lang: typeof language) =>
          key
            .split(".")
            .reduce<unknown>((obj, k) => (obj as Record<string, unknown>)[k], MESSAGES[lang]);
        const it = read("it");
        const other = read(language);
        if (typeof it === "string")
          expect(placeholders(other as string), `${language}.${key}`).toEqual(placeholders(it));
      }
    }
  });

  it("formats placeholders and leaves unknown ones visible", () => {
    expect(format("{done} di {total}", { done: 2, total: 5 })).toBe("2 di 5");
    expect(format("ciao {name}", {})).toBe("ciao {name}");
  });
});
