import {
  buildChecklist,
  buildDsuSheet,
  buildHousehold,
  evaluateDossier,
  getPractice,
  type CopilotDossier,
} from "@avanti/core";
import type { DocumentSummary } from "@avanti/contracts";
export function operatorFixture(
  kind: "clean" | "wrong_name" | "wrong_year" | "expired" | "undeclared" = "clean",
) {
  const now = new Date("2027-01-15T12:00:00.000Z");
  const answers = {
    members: [{ id: "m_demo", role: "richiedente" as const, firstName: "José", lastName: "Rossi" }],
    household_count: 1,
    accounts_count: kind === "undeclared" ? 0 : 1,
    account_owner_0: "m_demo",
    account_type_0: "deposit",
    account_bank_0: "Banca di esempio",
    housing: "rent",
    income_present_m_demo: true,
  };
  const household = buildHousehold(answers),
    checklist = buildChecklist("isee_ordinario", answers, household, "it");
  const item = checklist.find((i) => i.requirementId === "account_balance");
  const documents: DocumentSummary[] = [
    {
      id: "doc_demo",
      fileName: "esempio.pdf",
      mimeType: "application/pdf",
      sizeBytes: 100,
      pages: 1,
      uploadedAt: now.toISOString(),
      checklistItemId: item?.id ?? null,
      memberId: "m_demo",
      status: "analyzed",
      citizenCheck: { status: "ok", messages: [] },
      citizenKeptAt: null,
      analysis: {
        engine: "ai",
        detectedRequirementId: "account_balance",
        detectedLabel: "Certificazione sintetica di saldo",
        confidence: 0.99,
        ownerName: kind === "wrong_name" ? "Mario Bianchi" : "ROSSI JOSE",
        referenceYear: kind === "wrong_year" ? 2024 : 2025,
        expiresOn: kind === "expired" ? "2026-01-01" : null,
        legible: true,
        pagesComplete: true,
        findings: [],
      },
    },
  ];
  if (item) {
    item.status = "uploaded";
    item.documentIds = ["doc_demo"];
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
  const dossier: CopilotDossier = {
    practice: getPractice("isee_ordinario", "it"),
    household,
    checklist,
    documents,
    findings,
    accountsCount: answers.accounts_count,
    answers: [
      {
        questionId: "accounts_count",
        question: "Quanti rapporti finanziari?",
        answer: String(answers.accounts_count),
        section: "Patrimonio",
      },
    ],
  };
  return {
    dossier,
    sheet: buildDsuSheet("isee_ordinario", answers, household, checklist, documents),
  };
}
