import { expect, it } from "vitest";
import { Finding, Language, type ChecklistItem, type DocumentSummary } from "@avanti/contracts";
import { evaluateDossier, type DossierInput } from "./evaluation";

const member = {
  id: "person",
  role: "richiedente" as const,
  firstName: "Mario",
  lastName: "Rossi",
};
const item: ChecklistItem = {
  id: "income",
  requirementId: "income",
  group: "redditi",
  title: "Redditi",
  description: "Redditi",
  howToGet: null,
  required: true,
  memberId: member.id,
  memberName: "Mario Rossi",
  status: "uploaded",
  documentIds: [],
  note: null,
};
function document(id: string, overrides: Partial<DocumentSummary> = {}): DocumentSummary {
  return {
    id,
    fileName: `${id}.pdf`,
    mimeType: "application/pdf",
    sizeBytes: 100,
    pages: 1,
    uploadedAt: "2027-01-05T10:00:00Z",
    checklistItemId: item.id,
    memberId: member.id,
    status: "analyzed",
    analysis: {
      engine: "ai",
      detectedRequirementId: "income",
      detectedLabel: null,
      confidence: 1,
      ownerName: "Un Altro",
      referenceYear: 2024,
      expiresOn: "2026-01-01",
      legible: false,
      pagesComplete: false,
      findings: [],
    },
    ...overrides,
  };
}
const input: DossierInput = {
  practiceId: "isee_ordinario",
  answers: {
    household_exceptions: true,
    nonresident_parent: true,
    university: true,
    foreign_institution_review: true,
    mortgage_review: true,
    excluded_savings: true,
    account_owner_0: "joint",
  },
  household: [member],
  checklist: [
    item,
    { ...item, id: "missing", status: "missing" },
    { ...item, id: "rejected", status: "rejected" },
  ],
  documents: [
    document("expired"),
    document("expiring", { analysis: { ...document("base").analysis!, expiresOn: "2028-03-01" } }),
    document("duplicate"),
    document("unmatched", { checklistItemId: null }),
    document("other", {
      analysis: { ...document("base").analysis!, detectedRequirementId: "rent" },
    }),
    document("failed", { status: "failed", analysis: null }),
  ],
  hashes: { expired: "same", duplicate: "same" },
  language: "it",
  now: new Date("2028-01-05T10:00:00Z"),
};

it("provides Italian operator instructions for every finding code, independent of citizen language", () => {
  const findings = [
    ...evaluateDossier(input).findings,
    ...evaluateDossier({ ...input, practiceId: "assegno_unico" }).findings,
    ...evaluateDossier({ ...input, practiceId: "permesso_soggiorno" }).findings,
  ];
  expect(new Set(findings.map((finding) => finding.code))).toEqual(
    new Set([
      "checklist.missing",
      "checklist.rejected",
      "document.expired",
      "document.expiring",
      "document.wrong_year",
      "document.wrong_owner",
      "document.illegible",
      "document.missing_pages",
      "document.duplicate",
      "document.unmatched",
      "document.other_practice",
      "document.unchecked",
      "document.failed",
      "practice.household_review",
      "practice.provisional_year",
      "practice.parent_review",
      "practice.university_review",
      "practice.foreign_institution_review",
      "practice.mortgage_review",
      "practice.full_dsu",
      "practice.savings_exclusion",
      "practice.auu_review",
      "practice.permit_review",
      "practice.joint_ownership",
      "practice.outdated_catalog",
    ]),
  );
  for (const finding of findings) {
    expect(Finding.safeParse(finding).success).toBe(true);
    expect(finding.operatorMessage).toBeTruthy();
    expect(finding.operatorMessage).not.toMatch(/\{\w+\}|Il CAF|L’operatore|Il patronato/);
    const { operatorMessage: _operatorMessage, ...legacy } = finding;
    expect(Finding.safeParse(legacy).success).toBe(true);
  }
  const italian = evaluateDossier(input).findings;
  for (const language of Language.options) {
    const localized = evaluateDossier({ ...input, language }).findings;
    expect(localized.map((finding) => finding.operatorMessage)).toEqual(
      italian.map((finding) => finding.operatorMessage),
    );
    expect(localized.map(({ message: _message, ...finding }) => finding)).toEqual(
      italian.map(({ message: _message, ...finding }) => finding),
    );
  }
});

it("retains citizen wording while identifying the operator checks and the automation limit", () => {
  const italian = evaluateDossier(input).findings;
  const unchecked = italian.find((finding) => finding.code === "document.unchecked");
  expect(unchecked?.message).toBe(
    "expired.pdf: alcuni dati non sono verificati. L’operatore controllerà il documento.",
  );
  expect(unchecked?.operatorMessage).toBe(
    "expired.pdf: controlla a vista intestatario, anno, scadenza e pagine: il controllo automatico non sostituisce la verifica.",
  );
  const english = evaluateDossier({ ...input, language: "en" }).findings;
  expect(english.find((finding) => finding.id === unchecked?.id)?.message).toBe(
    "expired.pdf: some details are not checked. The operator will review the document.",
  );
  expect(
    italian.find((finding) => finding.code === "document.wrong_owner")?.operatorMessage,
  ).toContain("Mario Rossi");
  expect(
    italian.find((finding) => finding.code === "document.wrong_year")?.operatorMessage,
  ).toContain("2025");
});
