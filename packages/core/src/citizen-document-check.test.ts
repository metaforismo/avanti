import { expect, it } from "vitest";
import { Language, type DocumentSummary, type ChecklistItem } from "@avanti/contracts";
import { evaluateDossier } from "./evaluation";
const member = {
  id: "member",
  role: "richiedente" as const,
  firstName: "José",
  lastName: "García",
};
const item: ChecklistItem = {
  id: "income",
  requirementId: "income",
  group: "redditi",
  title: "CU",
  description: "CU",
  howToGet: null,
  required: true,
  memberId: "member",
  memberName: "José García",
  status: "uploaded",
  documentIds: ["doc"],
  note: null,
};
const doc: DocumentSummary = {
  id: "doc",
  fileName: "synthetic.pdf",
  mimeType: "application/pdf",
  sizeBytes: 1,
  pages: 1,
  uploadedAt: "2027-01-05T00:00:00Z",
  checklistItemId: "income",
  memberId: "member",
  status: "analyzed",
  citizenKeptAt: null,
  citizenCheck: { status: "pending", messages: [] },
  analysis: {
    engine: "ai",
    detectedRequirementId: "identity",
    detectedLabel: "ID",
    confidence: 0.9,
    ownerName: "Altra Persona",
    referenceYear: 2024,
    expiresOn: "2026-01-01",
    legible: false,
    pagesComplete: false,
    findings: [],
  },
};
for (const language of Language.options)
  it(`uses fixed translated document findings: ${language}`, () => {
    const evaluate = (document: DocumentSummary) =>
      evaluateDossier({
        practiceId: "isee_ordinario",
        answers: {},
        household: [member],
        checklist: [item],
        documents: [document],
        language,
        now: new Date("2027-01-05T12:00:00Z"),
      }).findings;
    const findings = evaluate(doc);
    for (const code of [
      "document.wrong_owner",
      "document.wrong_year",
      "document.expired",
      "document.illegible",
      "document.missing_pages",
      "document.other_practice",
    ])
      expect(findings.some((f) => f.code === code && f.message.length > 10)).toBe(true);
    const heuristic = evaluate({ ...doc, analysis: { ...doc.analysis!, engine: "heuristic" } });
    expect(
      heuristic.some((f) =>
        ["document.wrong_owner", "document.illegible", "document.missing_pages"].includes(f.code),
      ),
    ).toBe(false);
    expect(heuristic.some((f) => f.code === "document.wrong_year")).toBe(true);
    const matched = evaluate({ ...doc, analysis: { ...doc.analysis!, ownerName: "Garcia Jose" } });
    expect(matched.some((f) => f.code === "document.wrong_owner")).toBe(false);
  });
