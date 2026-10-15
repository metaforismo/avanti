import {
  answeredQuestions,
  getQuestions,
  buildChecklist,
  buildHousehold,
  evaluateDossier,
  getPractice,
  type Answers,
  type CopilotDossier,
} from "@avanti/core";
import { heuristicAnalysis } from "../src/heuristics";
import type { DocumentSummary, MemberInput } from "@avanti/contracts";

export const realisticKinds = [
  "ready",
  "uploaded",
  "mixed",
  "wrong_year",
  "large_missing",
] as const;
export type RealisticKind = (typeof realisticKinds)[number];

// Synthetic fixtures only: no source is read from a citizen database or local uploads.
export function realisticOperatorFixture(kind: RealisticKind): CopilotDossier {
  const now = new Date("2027-01-15T12:00:00Z");
  const count = kind === "ready" ? 2 : kind === "large_missing" ? 4 : 3;
  const members: MemberInput[] = Array.from({ length: count }, (_, n) => ({
    id: `m_synthetic_${n}`,
    role: n === 0 ? "richiedente" : n === 1 ? "coniuge" : "figlio",
    firstName: ["Ada", "Luca", "Eva", "Leo"][n]!,
    lastName: "Esempio",
    birthYear: n < 2 ? 1985 : 2015,
  }));
  const answers: Answers = {
    practice_year: 2027,
    members,
    household_count: count,
    household_exceptions: false,
    housing: "hosted",
    accounts_count: 2,
    properties_count: 0,
    vehicles_count: 1,
    account_type_0: "deposit",
    account_type_1: "deposit",
    account_owner_0: members[0]!.id!,
    account_owner_1: members[1]!.id!,
    account_bank_0: "Banca sintetica A",
    account_bank_1: "Banca sintetica B",
    vehicle_label_0: "Auto sintetica",
    vehicle_owner_0: members[0]!.id!,
    excluded_savings: false,
    disability: false,
    nonresident_parent: false,
    university: false,
    self_employed: false,
    foreign_income: false,
    foreign_assets: false,
    maintenance: false,
    exempt_income: false,
    ...Object.fromEntries(members.map((m) => [`income_present_${m.id}`, false])),
  };
  const household = buildHousehold(answers);
  const checklist = buildChecklist("isee_ordinario", answers, household, "it");
  const documents: DocumentSummary[] = [];
  for (const [n, item] of checklist.entries()) {
    if (kind === "large_missing" && n % 3 === 0) continue;
    const id = `doc_synthetic_${n}`;
    const member = household.find((m) => m.id === item.memberId) ?? household[0]!;
    const rules = kind === "mixed" && n % 2 === 0;
    const doc: DocumentSummary = {
      id,
      fileName: "documento-sintetico.pdf",
      mimeType: "application/pdf",
      sizeBytes: 100,
      pages: 1,
      uploadedAt: now.toISOString(),
      checklistItemId: item.id,
      memberId: item.memberId,
      status: "analyzed",
      citizenCheck: { status: "ok", messages: [] },
      citizenKeptAt: null,
      analysis: {
        engine: rules ? "heuristic" : "ai",
        detectedRequirementId: item.requirementId,
        detectedLabel: item.title,
        confidence: rules ? 0.5 : 0.99,
        ownerName: rules ? null : `${member.firstName} ${member.lastName}`,
        referenceYear: kind === "wrong_year" && /account/.test(item.requirementId) ? 2024 : 2025,
        expiresOn: item.requirementId === "identity" ? "2030-01-01" : null,
        legible: true,
        pagesComplete: rules ? null : true,
        findings: [],
      },
    };
    if (rules)
      doc.analysis = heuristicAnalysis(`${item.requirementId}_2025.pdf`, [item.requirementId]);
    documents.push(doc);
    item.documentIds = [id];
    item.status = kind === "ready" ? "verified" : "uploaded";
  }
  const findings = evaluateDossier({
    practiceId: "isee_ordinario",
    answers,
    household,
    checklist,
    documents,
    now,
    language: "it",
  }).findings;
  return {
    practice: getPractice("isee_ordinario", "it"),
    household,
    checklist,
    findings,
    accountsCount: 2,
    answers: answeredQuestions(
      getQuestions("isee_ordinario", answers, "it"),
      answers,
      Object.keys(answers),
      "it",
    ),
    documents: documents.map(
      ({ fileName: _file, mimeType: _mime, sizeBytes: _size, uploadedAt: _at, ...doc }) => doc,
    ),
  };
}
