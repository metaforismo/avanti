import { expect, it } from "vitest";
import { getPractice } from "@avanti/core";
import type { AnswerValue, Language } from "@avanti/contracts";
import { turnAcknowledgement } from "./turn-acknowledgement";

const expected: Record<Language, [string, string, string]> = {
  it: [
    "Ho capito: Vivi con tua madre.",
    "Ho capito: Vivi con tua madre e hai un conto Fineco.",
    "Ho capito: Vivi con tua madre, hai un conto Fineco e un veicolo.",
  ],
  en: [
    "I understood: You live with your mother.",
    "I understood: You live with your mother and you have a bank account with Fineco.",
    "I understood: You live with your mother, you have a bank account with Fineco and a vehicle.",
  ],
  fr: [
    "J’ai compris: Vous vivez avec votre mère.",
    "J’ai compris: Vous vivez avec votre mère et vous avez un compte Fineco.",
    "J’ai compris: Vous vivez avec votre mère, vous avez un compte Fineco et un véhicule.",
  ],
  es: [
    "He entendido: Vives con tu madre.",
    "He entendido: Vives con tu madre y tienes una cuenta Fineco.",
    "He entendido: Vives con tu madre, tienes una cuenta Fineco y un vehículo.",
  ],
  ro: [
    "Am înțeles: Locuiești cu mama ta.",
    "Am înțeles: Locuiești cu mama ta și ai un cont Fineco.",
    "Am înțeles: Locuiești cu mama ta, ai un cont Fineco și un vehicul.",
  ],
  uk: [
    "Я зрозумів: Ви живете з матір’ю.",
    "Я зрозумів: Ви живете з матір’ю і у Вас один рахунок Fineco.",
    "Я зрозумів: Ви живете з матір’ю, у Вас один рахунок Fineco і один транспортний засіб.",
  ],
  ar: [
    "فهمت: تعيش مع والدتك.",
    "فهمت: تعيش مع والدتك ولديك حساب واحد Fineco.",
    "فهمت: تعيش مع والدتك، لديك حساب واحد Fineco ومركبة واحدة.",
  ],
  bn: [
    "বুঝেছি: আপনি আপনার মায়ের সঙ্গে থাকেন।",
    "বুঝেছি: আপনি আপনার মায়ের সঙ্গে থাকেন এবং আপনার একটি Fineco হিসাব আছে।",
    "বুঝেছি: আপনি আপনার মায়ের সঙ্গে থাকেন, আপনার একটি Fineco হিসাব আছে এবং আপনার একটি গাড়ি আছে।",
  ],
};
for (const language of Object.keys(expected) as Language[]) {
  it.each([1, 2, 3])(
    `${language}: composes %i facts with localized punctuation and conjunctions`,
    (size) => {
      const answers: Record<string, AnswerValue> = { household_relations: ["madre"] };
      if (size >= 2) Object.assign(answers, { accounts_count: 1, account_bank_0: "Fineco" });
      if (size === 3) answers.vehicles_count = 1;
      const result = turnAcknowledgement(
        { language, practice: getPractice("isee_ordinario", language), answers },
        { practiceId: "isee_ordinario", confidence: 1, answers, reply: "", engine: "heuristic" },
        {},
        "",
        "isee_ordinario",
      );
      expect(result).toBe(expected[language][size - 1]);
    },
  );
}
it("does not repeat unchanged facts and keeps the newly selected practice in a separate sentence", () => {
  const answers: Record<string, AnswerValue> = {
    household_relations: ["madre"],
    vehicles_count: 1,
  };
  const proposal = {
    practiceId: "isee_ordinario" as const,
    confidence: 1,
    answers,
    reply: "",
    engine: "heuristic" as const,
  };
  const view = { language: "it" as const, practice: getPractice("isee_ordinario", "it"), answers };
  expect(turnAcknowledgement(view, proposal, answers, "", "isee_ordinario")).toBeNull();
  expect(turnAcknowledgement(view, proposal, {}, "", null)).toBe(
    "Ho capito: ISEE ordinario. Vivi con tua madre e hai un veicolo.",
  );
});
