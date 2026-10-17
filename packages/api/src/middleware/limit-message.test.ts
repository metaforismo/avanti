import { expect, it } from "vitest";
import { limitMessage } from "./limit-message";

it.each([
  ["it", 1, "Riprova tra un secondo."],
  ["it", 30, "Riprova tra 30 secondi."],
  ["en", 1, "Try again in 1 second."],
  ["fr", 1, "Réessayez dans 1 seconde."],
  ["es", 1, "Vuelve a intentarlo en un segundo."],
  ["ro", 1, "Încearcă din nou peste o secundă."],
  ["ro", 5, "Încearcă din nou peste 5 secunde."],
  ["ro", 21, "Încearcă din nou peste 21 de secunde."],
  ["uk", 1, "Спробуйте знову через 1 секунду."],
  ["uk", 2, "Спробуйте знову через 2 секунди."],
  ["uk", 5, "Спробуйте знову через 5 секунд."],
  ["uk", 11, "Спробуйте знову через 11 секунд."],
  ["uk", 21, "Спробуйте знову через 21 секунду."],
  ["ar", 1, "حاول مجددًا بعد ثانية واحدة."],
  ["ar", 2, "حاول مجددًا بعد ثانيتين."],
  ["ar", 5, "حاول مجددًا بعد 5 ثوانٍ."],
  ["ar", 11, "حاول مجددًا بعد 11 ثانية."],
  ["ar", 21, "حاول مجددًا بعد 21 ثانية."],
] as const)("%s: the wait of %i seconds agrees with the number", (language, seconds, sentence) => {
  expect(limitMessage(language, seconds)).toContain(sentence);
});

it("uses the same wait in the upload message", () => {
  expect(limitMessage("it", 5, true)).toBe(
    "Stai caricando troppi file insieme. Attendi che finiscano e riprova tra 5 secondi.",
  );
});
