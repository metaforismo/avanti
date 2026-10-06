import { describe, expect, it } from "vitest";
import type { ChecklistItem, DocumentSummary, Member } from "@avanti/contracts";
import { buildHousehold, evaluateDossier, extractFacts, ownerMatches } from "./index";
const now = new Date("2027-01-05T10:00:00Z");
const member: Member = { id: "m", role: "richiedente", firstName: "Mario" };
const item: ChecklistItem = {
  id: "balance",
  requirementId: "account_balance",
  group: "patrimonio_mobiliare",
  title: "Saldo",
  description: "Saldo",
  howToGet: "Banca",
  required: true,
  memberId: "m",
  memberName: "Mario",
  status: "uploaded",
  documentIds: [],
  note: null,
};
function doc(id: string, checklistItemId: string): DocumentSummary {
  return {
    id,
    checklistItemId,
    memberId: "m",
    fileName: "banca.pdf",
    mimeType: "application/pdf",
    sizeBytes: 100,
    pages: 1,
    uploadedAt: now.toISOString(),
    status: "analyzed",
    analysis: {
      engine: "ai",
      confidence: 1,
      detectedRequirementId: null,
      detectedLabel: null,
      ownerName: "Mario Rossi",
      referenceYear: 2025,
      expiresOn: null,
      legible: true,
      pagesComplete: true,
      findings: [],
    },
  };
}
function evaluate(checklist: ChecklistItem[], documents: DocumentSummary[]) {
  return evaluateDossier({
    practiceId: "isee_ordinario",
    answers: {},
    household: [member],
    checklist,
    documents,
    language: "it",
    now,
    hashes: Object.fromEntries(documents.map((d) => [d.id, "same"])),
  });
}
describe("review regressions", () => {
  it("1: shared bank statement counts for separate requirements", () => {
    const result = evaluate(
      [item, { ...item, id: "average", requirementId: "account_average" }],
      [doc("a", "balance"), doc("b", "average")],
    );
    expect(
      result.findings.filter((f) => ["document.duplicate", "checklist.missing"].includes(f.code)),
    ).toEqual([]);
    expect(result.progress.documentsDone).toBe(2);
  });
  it("2: partial names and additional names match as token subsets", () => {
    expect(ownerMatches("Mario Rossi", member)).toBe(true);
    expect(ownerMatches("Mario", { ...member, lastName: "Rossi" })).toBe(true);
    expect(ownerMatches("Rossi Mario Luigi", { ...member, lastName: "Rossi" })).toBe(true);
    expect(
      ownerMatches("Mario Rossi", { ...member, firstName: "Mario Luigi", lastName: "Rossi" }),
    ).toBe(true);
    const result = evaluate([item], [doc("a", item.id)]);
    expect(
      result.findings.some((f) => f.code === "document.wrong_owner" && f.severity === "blocker"),
    ).toBe(false);
  });
  it("2: verification downgrades document blockers", () => {
    const document = doc("a", item.id);
    document.analysis!.referenceYear = 2024;
    const result = evaluate([{ ...item, status: "verified" }], [document]);
    expect(result.findings.filter((f) => f.severity === "blocker")).toEqual([]);
    expect(result.progress.documentsDone).toBe(1);
  });
  it("3: words containing a relation do not invent household members", () => {
    expect(
      extractFacts("ISEE vivo con mia madre sotto lo stesso tetto", "it").answers.household_count,
    ).toBe(2);
  });
  it("18: flawless AI observations still require visual verification", () => {
    expect(
      evaluate([item], [doc("a", item.id)]).findings.some((f) => f.code === "document.unchecked"),
    ).toBe(true);
    expect(
      evaluate([{ ...item, status: "verified" }], [doc("a", item.id)]).findings.some(
        (f) => f.code === "document.unchecked",
      ),
    ).toBe(false);
  });
  it("26: correcting a name preserves the household identifier", () => {
    const before = buildHousehold({ members: [{ role: "richiedente", firstName: "Mairo" }] });
    const after = buildHousehold({ members: [{ role: "richiedente", firstName: "Mario" }] });
    expect(after[0]!.id).toBe(before[0]!.id);
  });
  it("33: relationships and nonresident parent are persisted as facts", () => {
    const result = extractFacts("ISEE vivo con mia madre, mio padre non vive con noi", "it");
    expect(result.answers.household_roles).toEqual(["richiedente", "genitore"]);
    expect(result.answers.nonresident_parent).toBeUndefined();
    const explicit = extractFacts("ISEE siamo 3, vivo con mia madre", "it");
    expect(explicit.answers.household_roles).toEqual(["richiedente", "genitore"]);
    expect(explicit.answers.household_count).toBe(3);
  });
  it("34: missing documents identify the person", () => {
    const result = evaluate([item], []);
    expect(result.findings.find((f) => f.code === "checklist.missing")?.message).toContain("Mario");
  });
});

it.each(["it", "en", "fr", "es", "ro", "uk", "ar", "bn"] as const)(
  "31: contextual questions and document instructions in %s",
  async (language) => {
    const { getQuestions, buildChecklist } = await import("./index");
    const answers = {
      members: [{ role: "richiedente" as const, firstName: "Mario" }],
      accounts_count: 1,
      account_bank_0: "Fineco",
      self_employed: true,
    };
    const questions = getQuestions("isee_ordinario", answers, language);
    expect(questions.find((q) => q.id === "account_owner_0")?.prompt).toContain("Fineco");
    const exception = questions.find((q) => q.id === "household_exceptions")!;
    expect(exception.prompt.length).toBeLessThan(110);
    expect(exception.help).toBeTruthy();
    const items = buildChecklist("isee_ordinario", answers, buildHousehold(answers), language);
    for (const entry of items) expect(entry.description).not.toContain(entry.title + ".");
    expect(items.find((i) => i.requirementId === "account_average")?.description).toContain("2025");
  },
);
it("23: member validation uses the supplied Rome clock across a year boundary", async () => {
  const { applyAnswer } = await import("./index");
  const value = [{ role: "richiedente", firstName: "Mario", birthYear: 2028 }];
  expect(() =>
    applyAnswer(
      "isee_ordinario",
      { household_count: 1 },
      "members",
      value,
      "it",
      new Date("2027-12-31T22:59:59Z"),
    ),
  ).toThrow();
  expect(
    applyAnswer(
      "isee_ordinario",
      { household_count: 1 },
      "members",
      value,
      "it",
      new Date("2027-12-31T23:00:00Z"),
    ).members,
  ).toEqual(value);
});
it("11,27: answer rendering keeps names, roles and choices human-readable", async () => {
  const { readableAnswer, getQuestions } = await import("./index");
  const question = getQuestions("isee_ordinario", {}, "it").find((q) => q.id === "members")!;
  expect(
    readableAnswer(
      [
        { role: "coniuge", firstName: "Anna" },
        { role: "figlio", firstName: "Luca" },
      ],
      question,
      "it",
    ),
  ).toBe("Anna (coniuge), Luca (figlio)");
  expect(readableAnswer(true, question, "it")).toBe("Sì");
  expect(readableAnswer(3, question, "it")).toBe("3");
});
it("1: a present document awaiting analysis never produces a missing-file finding", () => {
  const document = doc("pending", item.id);
  document.status = "processing";
  document.analysis = null;
  expect(evaluate([item], [document]).findings.some((f) => f.code === "checklist.missing")).toBe(
    false,
  );
});
it("31: property and vehicle descriptions can be collected and reused in the ownership question", async () => {
  const { getQuestions, applyAnswer } = await import("./index");
  let answers = { properties_count: 1, vehicles_count: 1 };
  expect(
    getQuestions("isee_ordinario", answers, "it").find((q) => q.id === "property_label_0"),
  ).toMatchObject({ kind: "text", required: false });
  const withProperty = applyAnswer(
    "isee_ordinario",
    answers,
    "property_label_0",
    "Milano",
    "it",
    now,
  );
  const withVehicle = applyAnswer(
    "isee_ordinario",
    withProperty,
    "vehicle_label_0",
    "Fiat Panda",
    "it",
    now,
  );
  expect(
    getQuestions("isee_ordinario", withVehicle, "it").find((q) => q.id === "property_owner_0")
      ?.prompt,
  ).toContain("Milano");
  expect(
    getQuestions("isee_ordinario", withVehicle, "it").find((q) => q.id === "vehicle_owner_0")
      ?.prompt,
  ).toContain("Fiat Panda");
});
it("29,31: new optional labels do not reopen a previously answered interview", async () => {
  const { getQuestions } = await import("./index");
  const answers = {
    properties_count: 1,
    property_owner_0: "joint",
    vehicles_count: 1,
    vehicle_owner_0: "m_richiedente_0",
  };
  expect(
    getQuestions("isee_ordinario", answers, "it").filter((q) => /^\w+_label_0$/.test(q.id)),
  ).toEqual([]);
});
