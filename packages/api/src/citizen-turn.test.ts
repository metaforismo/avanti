import { expect, it } from "vitest";
import { applyTurn } from "./citizen-turn";
import type { CaseRow } from "./dossier";
import { CLASSIFICATION_THRESHOLD } from "@avanti/core";
it("22: classification uses the exported threshold", () => {
  const current = { practiceId: null, answers: {}, language: "it" } as CaseRow;
  const proposal = {
    practiceId: "isee_ordinario" as const,
    confidence: CLASSIFICATION_THRESHOLD - 0.01,
    answers: {},
    reply: "",
    engine: "heuristic" as const,
  };
  expect(
    applyTurn(current, { type: "text", text: "ISEE" }, proposal, new Date("2027-01-01Z"))
      .practiceId,
  ).toBeNull();
  expect(
    applyTurn(
      current,
      { type: "text", text: "ISEE" },
      { ...proposal, confidence: CLASSIFICATION_THRESHOLD },
      new Date("2027-01-01Z"),
    ).practiceId,
  ).toBe("isee_ordinario");
});
it("33: AI household role suggestions must match the contract", () => {
  const current = { practiceId: "isee_ordinario", answers: {}, language: "it" } as CaseRow;
  const proposal = {
    practiceId: "isee_ordinario" as const,
    confidence: 1,
    answers: { household_roles: ["unsupported-role"] },
    reply: "",
    engine: "ai" as const,
  };
  const result = applyTurn(
    current,
    { type: "text", text: "ISEE" },
    proposal,
    new Date("2027-01-01Z"),
  );
  expect(result.answers.household_roles).toBeUndefined();
});

it("B4: acknowledgement describes only this turn, naturally and with relations", async () => {
  const { assistantReply } = await import("./citizen-turn");
  const { getPractice } = await import("@avanti/core");
  const view = {
    language: "it",
    practice: getPractice("isee_ordinario", "it"),
    answers: {
      household_count: 2,
      household_roles: ["richiedente", "genitore"],
      accounts_count: 1,
      account_bank_0: "Fineco",
      vehicles_count: 1,
      household_relations: ["madre"],
    },
  } as unknown as import("@avanti/contracts").CitizenCase;
  const proposal = {
    practiceId: "isee_ordinario" as const,
    confidence: 1,
    answers: { vehicles_count: 1 },
    reply: "",
    engine: "heuristic" as const,
  };
  expect(
    assistantReply(view, proposal, { ...view.answers, vehicles_count: 0 }, "", "isee_ordinario"),
  ).toBe("Ho capito: hai un veicolo.");
  expect(
    assistantReply(
      view,
      { ...proposal, answers: view.answers },
      {},
      "ISEE vivo con mia madre, ho un conto Fineco e un'auto",
    ),
  ).toContain("Vivi con tua madre");
});

it("university AI classification uses the shared collection while explicit choice remains unavailable", () => {
  const current = { practiceId: null, answers: {}, language: "en" } as CaseRow;
  const now = new Date("2027-01-01T00:00:00Z");
  const result = applyTurn(
    current,
    { type: "text", text: "ISEE university fees" },
    {
      practiceId: "isee_universitario",
      confidence: 1,
      answers: {},
      reply: "",
      engine: "ai",
    },
    now,
  );
  expect(result).toMatchObject({
    practiceId: "isee_ordinario",
    answers: {},
    unavailablePractice: null,
  });
  expect(() =>
    applyTurn(current, { type: "choose_practice", practiceId: "isee_universitario" }, null, now),
  ).toThrow(expect.objectContaining({ code: "practice_unavailable" }));
});
