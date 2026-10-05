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
