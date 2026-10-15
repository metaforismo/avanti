import { describe, expect, it } from "vitest";
import { CaseDossier, type NearReadyReason } from "@avanti/contracts";
import { buildChecklist } from "./checklist";
import { buildHousehold } from "./household";
import { CATALOG_VERSION, getPractice, getQuestions, type Answers } from "./catalog";
import {
  evaluateNearReady,
  nearReadySlots,
  nearReadyValidUntil,
  type NearReadyInput,
} from "./near-ready";
import { clopperPearson, nearReadyPilotGroup } from "./near-ready-metrics";
function fixture(): NearReadyInput {
  const answers: Answers = {
    household_count: 1,
    members: [
      {
        id: "person",
        firstName: "Persona",
        lastName: "Sintetica",
        birthYear: 1985,
        role: "richiedente",
      },
    ],
    accounts_count: 0,
    properties_count: 0,
    vehicles_count: 0,
    housing: "hosted",
    income_present_person: false,
  };
  for (const q of getQuestions("isee_ordinario", answers, "it"))
    if (q.kind === "yes_no" && !(q.id in answers)) answers[q.id] = false;
  const household = buildHousehold(answers);
  const checklist = buildChecklist("isee_ordinario", answers, household, "it").map((c, n) => ({
    ...c,
    documentIds: [`doc${n}`],
    status: "uploaded" as const,
  }));
  const version = "2027-01-15T12:00:00.000Z";
  const dossier = CaseDossier.parse({
    id: "case",
    reference: "TEST",
    citizenName: null,
    practice: getPractice("isee_ordinario", "it", answers),
    status: "submitted",
    language: "it",
    office: null,
    assignee: null,
    progress: {
      questionsAnswered: 20,
      questionsTotal: 20,
      documentsDone: 2,
      documentsRequired: 2,
      percent: 100,
    },
    blockers: 0,
    warnings: 0,
    createdAt: version,
    updatedAt: version,
    submittedAt: version,
    citizen: { firstName: null, lastName: null, email: null, phone: null },
    headline: "ISEE",
    facts: [],
    household,
    answers: [],
    checklist,
    documents: checklist.map((c, n) => ({
      id: `doc${n}`,
      fileName: "synthetic.pdf",
      mimeType: "application/pdf",
      sizeBytes: 10,
      pages: 2,
      uploadedAt: version,
      checklistItemId: c.id,
      memberId: c.memberId,
      status: "analyzed",
      analysis: null,
      citizenCheck: { status: "ok", messages: [] },
    })),
    findings: [],
    messages: [],
    timeline: [],
    citizenNote: null,
    internalNotes: null,
    timing: { citizenMinutes: null, reviewMinutes: null },
    citizenLink: null,
  });
  return {
    dossier,
    answers,
    confirmedAnswers: getQuestions("isee_ordinario", answers, "it").map((q) => q.id),
    editingQuestion: null,
    pendingProposals: false,
    openRequest: false,
    securityNotice: false,
    duplicate: false,
    caseVersion: version,
    analysisVersion: version,
    catalogVersion: CATALOG_VERSION,
    now: new Date(version),
    aiAvailable: true,
    aiOk: true,
    aiIssues: false,
    criticalThreshold: 0.98,
    otherThreshold: 0.95,
    fields: nearReadySlots(dossier).map((slot) => ({
      fieldId: slot.fieldId,
      label: slot.label,
      critical: slot.critical,
      documentId: slot.documentId,
      page: 1,
      answerId: null,
      source: "ai",
      confidence: slot.critical ? 0.98 : 0.95,
      consistent: true,
    })),
  };
}
it("ammette il caso pulito alle soglie esatte senza medie", () => {
  const input = fixture();
  expect(evaluateNearReady(input).eligible).toBe(true);
  input.fields[0]!.confidence = 0.97999;
  expect(evaluateNearReady(input).exclusions).toContain("field_confidence");
});
const gates: [NearReadyReason, (i: NearReadyInput) => void][] = [
  [
    "unsupported_practice",
    (i) => {
      i.dossier.practice = getPractice("modello_730", "it");
    },
  ],
  [
    "case_status",
    (i) => {
      i.dossier.status = "ready";
    },
  ],
  [
    "interview_incomplete",
    (i) => {
      i.confirmedAnswers = [];
    },
  ],
  [
    "interview_incomplete",
    (i) => {
      delete i.answers.housing;
    },
  ],
  [
    "pending_proposals",
    (i) => {
      i.pendingProposals = true;
    },
  ],
  [
    "pending_proposals",
    (i) => {
      i.editingQuestion = "members";
    },
  ],
  [
    "household_unidentified",
    (i) => {
      i.answers.household_count = 2;
    },
  ],
  [
    "household_unidentified",
    (i) => {
      i.dossier.household[0]!.lastName = undefined;
    },
  ],
  [
    "ownership_missing",
    (i) => {
      i.answers.accounts_count = 1;
    },
  ],
  [
    "ownership_missing",
    (i) => {
      i.answers.vehicles_count = 1;
    },
  ],
  [
    "catalog_outdated",
    (i) => {
      i.catalogVersion = "old";
    },
  ],
  [
    "catalog_outdated",
    (i) => {
      i.now = new Date("2028-01-01Z");
    },
  ],
  [
    "documents_missing",
    (i) => {
      i.dossier.checklist[0]!.documentIds = [];
    },
  ],
  [
    "document_rejected",
    (i) => {
      i.dossier.checklist[0]!.status = "rejected";
    },
  ],
  [
    "document_rejected",
    (i) => {
      i.dossier.checklist[0]!.status = "waived";
    },
  ],
  [
    "document_processing",
    (i) => {
      i.dossier.documents[0]!.status = "processing";
    },
  ],
  [
    "document_duplicate",
    (i) => {
      i.duplicate = true;
    },
  ],
  [
    "document_unmatched",
    (i) => {
      i.dossier.documents[0]!.memberId = null;
    },
  ],
  [
    "open_request",
    (i) => {
      i.openRequest = true;
    },
  ],
  [
    "rule_issues",
    (i) => {
      i.dossier.findings = [
        {
          id: "test",
          memberId: null,
          code: "test",
          severity: "warning",
          message: "Test",
          documentId: null,
          checklistItemId: null,
        },
      ];
    },
  ],
  [
    "security_notice",
    (i) => {
      i.securityNotice = true;
    },
  ],
  [
    "stale_version",
    (i) => {
      i.analysisVersion = "2027-01-15T11:00:00Z";
    },
  ],
  [
    "ai_unavailable",
    (i) => {
      i.aiAvailable = false;
    },
  ],
  [
    "ai_fallback",
    (i) => {
      i.aiOk = false;
    },
  ],
  [
    "ai_issues",
    (i) => {
      i.aiIssues = true;
    },
  ],
  [
    "field_missing",
    (i) => {
      i.fields.shift();
    },
  ],
  [
    "field_missing",
    (i) => {
      i.fields[0]!.page = null;
    },
  ],
  [
    "field_missing",
    (i) => {
      i.fields[0]!.page = 3;
    },
  ],
  [
    "field_confidence",
    (i) => {
      i.fields.find((f) => !f.critical)!.confidence = 0.94999;
    },
  ],
  [
    "field_inconsistent",
    (i) => {
      i.fields[0]!.consistent = false;
    },
  ],
];
describe.each(gates)("esclusione %s", (code, mutate) => {
  it("non può essere compensata dalla confidenza degli altri campi", () => {
    const input = fixture();
    mutate(input);
    expect(evaluateNearReady(input).exclusions).toContain(code);
    expect(evaluateNearReady(input).eligible).toBe(false);
  });
});
it.each([
  "household_exceptions",
  "nonresident_parent",
  "university",
  "self_employed",
  "foreign_income",
  "foreign_assets",
  "disability",
  "maintenance",
  "exempt_income",
  "excluded_savings",
  "foreign_institution_review",
  "mortgage_review",
  "property_mortgage_0",
])("esclude complessità %s", (key) => {
  const input = fixture();
  input.answers[key] = true;
  expect(evaluateNearReady(input).exclusions).toContain("complex_case");
});
it("manuale è ammissibile soltanto con verifica e AI di confronto attiva", () => {
  const i = fixture();
  i.fields.forEach((f) => {
    f.source = "manual";
    f.page = null;
  });
  expect(evaluateNearReady(i).eligible).toBe(false);
  i.dossier.checklist.forEach((c) => {
    c.status = "verified";
  });
  expect(evaluateNearReady(i).eligible).toBe(true);
  i.aiAvailable = false;
  expect(evaluateNearReady(i).eligible).toBe(false);
});
it("intervalli esatti anche con zero errori e zero osservazioni", () => {
  expect(clopperPearson(0, 0)).toBeNull();
  expect(clopperPearson(300, 300)!.oneSidedLower95).toBeCloseTo(Math.pow(0.05, 1 / 300), 10);
  expect(clopperPearson(0, 10)!.upper).toBeCloseTo(1 - Math.pow(0.025, 1 / 10), 10);
  expect(clopperPearson(5, 10)!.lower).toBeCloseTo(0.1870860284, 8);
  expect(clopperPearson(5, 10)!.upper).toBeCloseTo(0.8129139716, 8);
  expect(() => clopperPearson(4, 3)).toThrow();
});
it("metriche separano esiti, errori critici e tempi misurati", () => {
  const result = nearReadyPilotGroup([
    {
      caseId: "a",
      language: "it",
      reading: "ai",
      selected: true,
      ready: true,
      criticalError: false,
      durationMinutes: 2,
    },
    {
      caseId: "b",
      language: "it",
      reading: "ai",
      selected: true,
      ready: true,
      criticalError: true,
      durationMinutes: 4,
    },
    {
      caseId: "c",
      language: "bn",
      reading: "manual",
      selected: false,
      ready: true,
      criticalError: false,
      durationMinutes: 12,
    },
    {
      caseId: "d",
      language: "bn",
      reading: "manual",
      selected: true,
      ready: null,
      criticalError: false,
      durationMinutes: null,
    },
  ]);
  expect(result).toMatchObject({
    evaluated: 4,
    selected: 3,
    precision: 0.5,
    falseNearReady: 1,
    criticalErrors: 1,
    missedOpportunities: 1,
    suggestedReview: { count: 2, medianMinutes: 3, p95Minutes: 4 },
    ordinaryReview: { count: 1, medianMinutes: 12 },
  });
});

it.each([
  ["2027-01-15T12:00:00Z", "2027-01-15T23:00:00.000Z"],
  ["2027-07-15T12:00:00Z", "2027-07-15T22:00:00.000Z"],
  ["2027-03-27T12:00:00Z", "2027-03-27T23:00:00.000Z"],
  ["2027-03-28T12:00:00Z", "2027-03-28T22:00:00.000Z"],
])("scadenza alla mezzanotte di Roma da %s", (start, end) => {
  expect(nearReadyValidUntil(new Date(start))).toBe(end);
});
