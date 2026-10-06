import { describe, expect, it } from "vitest";
import { Language } from "@avanti/contracts";
import { requirements, requirementText, type RequirementId } from "./requirements";

const instructions: Record<Language, { sides: RegExp; complete: RegExp; genericCards: RegExp }> = {
  it: {
    sides: /fronte e retro/giu,
    complete: /complet[oaie]|tutte le pagine/giu,
    genericCards: /Per tessere e documenti d[’']identità/iu,
  },
  en: {
    sides: /both sides/giu,
    complete: /\bfull\b|all pages/giu,
    genericCards: /For cards and identity documents/iu,
  },
  fr: {
    sides: /deux faces|recto et verso/giu,
    complete: /compl[eè]t\p{L}*|toutes les pages/giu,
    genericCards: /Pour les cartes et pièces d[’']identité/iu,
  },
  es: {
    sides: /ambas caras/giu,
    complete: /complet[oa]s?|todas las páginas/giu,
    genericCards: /Para tarjetas y documentos de identidad/iu,
  },
  ro: {
    sides: /ambele fețe/giu,
    complete: /complet\p{L}*|toate paginile/giu,
    genericCards: /Pentru carduri și acte de identitate/iu,
  },
  uk: {
    sides: /обидві сторони|обох сторін/giu,
    complete: /повн\p{L}*|усі сторінки|всі сторінки/giu,
    genericCards: /Для карток і посвідчень/iu,
  },
  ar: {
    sides: /الوجهين/gu,
    complete: /كامل\p{L}*|جميع الصفحات|بجميع صفحاتها/gu,
    genericCards: /للبطاقات ووثائق الهوية/u,
  },
  bn: { sides: /দুই পাশ/gu, complete: /সম্পূর্ণ|সব পাতা/gu, genericCards: /কার্ড ও পরিচয়পত্রের/u },
};

function duplicateInstructions(text: string, language: Language): boolean {
  const { sides, complete, genericCards } = instructions[language];
  return (
    genericCards.test(text) ||
    [...text.matchAll(sides)].length > 1 ||
    [...text.matchAll(complete)].length > 1
  );
}

describe("document descriptions across the entire catalog", () => {
  for (const language of Language.options) {
    it(`${language}: each upload instruction occurs once`, () => {
      const duplicates = (Object.keys(requirements) as RequirementId[]).filter((id) =>
        duplicateInstructions(requirementText(id, language, 2025).description, language),
      );
      expect(duplicates).toEqual([]);
    });
  }
  it("keeps completeness explicit where the whole document is needed", () => {
    const selective = new Set<RequirementId>([
      "identity",
      "tax_code",
      "passport",
      "permit_current",
      "iban",
      "account_average",
    ]);
    for (const language of Language.options) {
      for (const id of Object.keys(requirements) as RequirementId[]) {
        if (!selective.has(id))
          expect(
            [
              ...requirementText(id, language, 2025).description.matchAll(
                instructions[language].complete,
              ),
            ],
            `${language}: ${id}`,
          ).toHaveLength(1);
      }
    }
  });
  it("detects repeated sides and equivalent completeness instructions", () => {
    expect(duplicateInstructions("Carta, fronte e retro. Carica fronte e retro.", "it")).toBe(true);
    expect(duplicateInstructions("Dichiarazione completa. Carica tutte le pagine.", "it")).toBe(
      true,
    );
    expect(duplicateInstructions("Full tax return. Upload all pages.", "en")).toBe(true);
    expect(
      duplicateInstructions(
        "Carta, fronte e retro. Per il passaporto, pagine con dati e scadenza.",
        "it",
      ),
    ).toBe(false);
  });
  it("keeps selective passport pages and privacy instructions in the description", () => {
    for (const language of Language.options) {
      const passport = requirementText("passport", language, null).description;
      expect([...passport.matchAll(instructions[language].complete)]).toHaveLength(0);
      const privacy: Record<Language, RegExp> = {
        it: /Copri movimenti e importi non necessari/u,
        en: /Cover unrelated transactions and amounts/u,
        fr: /Masquez opérations et montants inutiles/u,
        es: /Oculta movimientos e importes innecesarios/u,
        ro: /Acoperă tranzacțiile și sumele inutile/u,
        uk: /Закрийте зайві операції й суми/u,
        ar: /اخفِ الحركات والمبالغ غير المطلوبة/u,
        bn: /অপ্রয়োজনীয় লেনদেন ও পরিমাণ ঢেকে দিন/u,
      };
      expect(requirementText("iban", language, null).description).toMatch(privacy[language]);
    }
  });
});
