import { describe, expect, it } from "vitest";
import type { DocumentAnalysis, Member } from "@avanti/contracts";
import { assessDocumentReuse } from "./document-reuse";
import { buildChecklist } from "./checklist";
import { evaluateDossier } from "./evaluation";
import { getPractice } from "./catalog";

const member: Member = {
  id: "applicant",
  role: "richiedente",
  firstName: "Persona",
  lastName: "Esempio",
  birthYear: 1980,
};
const analysis: DocumentAnalysis = {
  engine: "ai",
  detectedRequirementId: "identity",
  detectedLabel: "Identità",
  confidence: 0.95,
  ownerName: "Persona Esempio",
  referenceYear: null,
  expiresOn: "2030-01-01",
  legible: true,
  pagesComplete: true,
  findings: [],
};
const base = {
  analysis,
  requirementId: "identity",
  sourceYear: 2027,
  practiceId: "isee_ordinario" as const,
  answers: { practice_year: 2027 },
  member,
  previousMember: member,
  now: new Date("2027-01-01T10:00:00Z"),
};

describe("reuse classification", () => {
  it("uses the Italian calendar and includes the last valid day", () => {
    const document = { ...analysis, expiresOn: "2027-01-01" };
    expect(assessDocumentReuse({ ...base, analysis: document }).status).toBe("valido");
    expect(
      assessDocumentReuse({ ...base, analysis: document, now: new Date("2027-01-01T23:01:00Z") }),
    ).toMatchObject({ status: "da_aggiornare", code: "expired" });
  });
  it("never trusts a malformed expiry, incomplete scan, heuristic, low confidence or wrong owner", () => {
    for (const patch of [
      { expiresOn: "2027-02-30" },
      { expiresOn: null },
      { pagesComplete: null },
      { legible: false },
      { confidence: 0.74 },
      { ownerName: "Altra Persona" },
      { engine: "heuristic" as const },
    ])
      expect(assessDocumentReuse({ ...base, analysis: { ...analysis, ...patch } }).status).toBe(
        "da_verificare",
      );
  });
  it("uses the target reference year, including a different practice in the same year", () => {
    const income = {
      ...analysis,
      detectedRequirementId: "income",
      referenceYear: 2025,
      expiresOn: null,
    };
    expect(assessDocumentReuse({ ...base, requirementId: "income", analysis: income }).status).toBe(
      "valido",
    );
    expect(
      assessDocumentReuse({
        ...base,
        requirementId: "income",
        analysis: income,
        practiceId: "modello_730",
      }),
    ).toMatchObject({
      status: "da_aggiornare",
      code: "wrong_year",
      reason: expect.stringContaining("2026"),
    });
    expect(
      assessDocumentReuse({
        ...base,
        requirementId: "income",
        analysis: income,
        answers: { practice_year: 2028 },
      }),
    ).toMatchObject({ code: "wrong_year", reason: expect.stringContaining("2026") });
  });
  it("updates annual documents when the year changed even without a usable year observation", () => {
    for (const requirementId of ["income", "isee_certificate", "tax_previous"]) {
      expect(
        assessDocumentReuse({
          ...base,
          requirementId,
          answers: { practice_year: 2028 },
          analysis: { ...analysis, detectedRequirementId: requirementId, referenceYear: null },
        }),
      ).toMatchObject({ status: "da_aggiornare", code: "annual" });
    }
  });
  it("fails closed after a member leaves, changes identity or is replaced by a new birth", () => {
    for (const target of [
      null,
      { ...member, firstName: "Altro" },
      { ...member, id: "newborn", birthYear: 2027 },
      { ...member, taxCode: "AAAAAA00A00A000A" },
    ])
      expect(assessDocumentReuse({ ...base, member: target })).toMatchObject({
        status: "da_verificare",
        code: "member_changed",
      });
  });
  it("never marks a failed analysis or a document outside the target checklist valid", () => {
    expect(assessDocumentReuse({ ...base, status: "failed" }).status).toBe("da_verificare");
    expect(assessDocumentReuse({ ...base, applicable: false }).status).toBe("da_verificare");
  });
  it("does not call a document without a current owner valid", () => {
    expect(assessDocumentReuse({ ...base, member: null, previousMember: null }).status).toBe(
      "da_verificare",
    );
  });
  it("keeps next-year reference years aligned across practice, checklist and evaluation without claiming annual rules verified", () => {
    const answers = { practice_year: 2028, members: [member], household_count: 1 };
    const checklist = buildChecklist("isee_ordinario", answers, [member], "it");
    expect(getPractice("isee_ordinario", "it", answers).referenceYear).toBe(2026);
    expect(checklist.find((item) => item.requirementId === "income")?.title).toContain("2026");
    const findings = evaluateDossier({
      practiceId: "isee_ordinario",
      answers,
      household: [member],
      checklist,
      documents: [],
      now: base.now,
      language: "it",
    }).findings;
    expect(findings).toContainEqual(
      expect.objectContaining({ code: "practice.outdated_catalog", severity: "blocker" }),
    );
  });
});
