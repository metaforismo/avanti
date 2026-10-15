import { describe, expect, it } from "vitest";
describe("latin-script language check", () => {
  it("flags an English reply where Italian was expected, not Italian names in Spanish", async () => {
    const { languageViolation } = await import("./guard");
    expect(
      languageViolation(
        "It is the question about your household: who lives with you and who is financially dependent on you.",
        "it",
      ),
    ).toBe(true);
    expect(
      languageViolation(
        "La domanda chiede quante persone vivono nel tuo nucleo familiare, te compreso.",
        "it",
      ),
    ).toBe(false);
    expect(
      languageViolation(
        "Necesitas la Certificazione Unica del 2025 y el documento d'identità de cada persona.",
        "es",
      ),
    ).toBe(false);
  });
});
