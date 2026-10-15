import { expect, it } from "vitest";
import { heuristicBrief } from "@avanti/core";
import { realisticKinds, realisticOperatorFixture } from "./operator-realistic";
import { CopilotInput } from "../src/operator-tasks";

it.each(realisticKinds)("provides a valid realistic %s dossier with evidence", (kind) => {
  const dossier = realisticOperatorFixture(kind);
  expect(CopilotInput.safeParse(dossier).success).toBe(true);
  expect(dossier.household.length).toBeGreaterThanOrEqual(2);
  expect(dossier.household.length).toBeLessThanOrEqual(4);
  expect(dossier.documents.length).toBeGreaterThan(4);
  expect(dossier.documents.every((d) => d.citizenCheck.messages.length === 0)).toBe(true);
  if (kind === "ready") {
    expect(heuristicBrief(dossier).nextStep).toBe("ready_for_practice");
    expect(
      dossier.findings.filter(
        (f) =>
          f.severity === "blocker" ||
          (f.severity === "warning" && f.code !== "practice.provisional_year"),
      ),
    ).toEqual([]);
    expect(dossier.answers.length).toBeGreaterThan(20);
  }
  if (kind === "mixed")
    expect(new Set(dossier.documents.map((d) => d.analysis?.engine)).size).toBe(2);
});
