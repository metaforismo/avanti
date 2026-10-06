import { describe, expect, it } from "vitest";
import {
  LANGUAGES,
  ChecklistItem,
  PracticeSummary,
  Question,
  type DocumentSummary,
  type Language,
  type MemberInput,
} from "@avanti/contracts";
import {
  applyAnswer,
  buildChecklist,
  buildHousehold,
  catalog,
  dossierSummary,
  editAnswer,
  evaluateDossier,
  extractFacts,
  getQuestions,
  listPractices,
  nextQuestion,
  ownerMatches,
  skipQuestion,
  timelineLabel,
  type Answers,
} from "./index";
import { validDate } from "./interview";

const now = new Date("2027-01-01T10:00:00Z");
const members: MemberInput[] = [
  { role: "richiedente", firstName: "Anna", lastName: "Esempio", birthYear: 1990 },
  { role: "figlio", firstName: "Luca", lastName: "Esempio", birthYear: 2020 },
];

function answersWithMembers(): Answers {
  return { household_count: members.length, members };
}

function checklist(answers = answersWithMembers(), language: Language = "it") {
  return buildChecklist("isee_ordinario", answers, buildHousehold(answers), language);
}

function document(item: ChecklistItem, overrides: Partial<DocumentSummary> = {}): DocumentSummary {
  return {
    id: "doc_one",
    fileName: "ESEMPIO.pdf",
    mimeType: "application/pdf",
    sizeBytes: 100,
    pages: 1,
    uploadedAt: now.toISOString(),
    checklistItemId: item.id,
    memberId: item.memberId,
    status: "analyzed",
    analysis: {
      engine: "ai",
      confidence: 0.95,
      detectedRequirementId: item.requirementId,
      detectedLabel: null,
      ownerName: item.memberName,
      referenceYear: 2025,
      expiresOn: null,
      legible: true,
      pagesComplete: true,
      findings: [],
    },
    ...overrides,
  };
}

function evaluate(
  items: ChecklistItem[],
  documents: DocumentSummary[],
  at = now,
  hashes: Record<string, string> = {},
) {
  const answers = answersWithMembers();
  return evaluateDossier({
    practiceId: "isee_ordinario",
    answers,
    household: buildHousehold(answers),
    checklist: items,
    documents,
    language: "it",
    now: at,
    hashes,
  });
}

describe("versioned catalog and languages", () => {
  it.each(LANGUAGES)("returns valid catalog, questions and checklist in %s", (language) => {
    const answers = { ...answersWithMembers(), accounts_count: 1, disability: true };
    for (const practice of listPractices(language))
      expect(PracticeSummary.safeParse(practice).success).toBe(true);
    for (const question of getQuestions("isee_ordinario", answers, language))
      expect(Question.safeParse(question).success).toBe(true);
    for (const item of checklist(answers, language)) {
      expect(ChecklistItem.safeParse(item).success).toBe(true);
      expect(item.title).not.toContain("{year}");
      expect(item.howToGet).toBeTruthy();
    }
  });

  it("keeps 2027 preparation years explicit and prevents coming-soon interviews", () => {
    expect(catalog.isee_ordinario.referenceYear).toBe(2025);
    expect(catalog.modello_730.referenceYear).toBe(2026);
    expect(() => applyAnswer("isee_universitario", {}, "members", members, "it", now)).toThrow();
    expect(
      buildChecklist(
        "isee_universitario",
        answersWithMembers(),
        buildHousehold(answersWithMembers()),
        "it",
      ),
    ).toEqual([]);
  });
});

describe("heuristic classification and fact extraction", () => {
  it("handles the brief sentence without inferring the legal household from a nonresident father", () => {
    const result = extractFacts(
      "Devo fare l'ISEE, vivo con mia madre, mio padre non vive con noi, ho un conto Fineco e una macchina",
      "it",
    );
    expect(result.practiceId).toBe("isee_ordinario");
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    expect(result.answers.household_count).toBe(2);
    expect(result.answers.accounts_count).toBe(1);
    expect(result.answers.account_bank_0).toBe("Fineco");
    expect(result.answers.vehicles_count).toBe(1);
    expect(result.facts.nonresidentParent).toBe(true);
    expect(result.answers.nonresident_parent).toBeUndefined();
    expect(result.answers.members).toBeUndefined();
  });

  it.each([
    ["it", "ISEE non ho conti e non ho la macchina", 0, 0],
    ["en", "I need ISEE. I have two bank accounts and no car", 2, 0],
    ["fr", "ISEE : j’ai deux comptes, je n’ai pas de voiture", 2, 0],
    ["es", "ISEE tengo dos cuentas y no tengo coche", 2, 0],
    ["ro", "ISEE am două conturi, nu am mașină", 2, 0],
    ["uk", "ІСЕЕ маю два рахунки, немає авто", 2, 0],
    ["ar", "ايزي لدي حسابين و ليس لدي سيارة", 2, 0],
    ["bn", "আইএসইই আমার ২ হিসাব আছে, গাড়ি নেই", 2, 0],
  ] as const)(
    "extracts counts and negations in %s",
    (language, text, accountCount, vehicleCount) => {
      const result = extractFacts(text, language);
      expect(result.answers.accounts_count).toBe(accountCount);
      expect(result.answers.vehicles_count).toBe(vehicleCount);
    },
  );

  it("keeps independent affirmative and negative clauses separate", () => {
    expect(extractFacts("ISEE non ho conti e ho una macchina", "it").answers).toMatchObject({
      accounts_count: 0,
      vehicles_count: 1,
    });
    expect(
      extractFacts("ISEE ho un conto Fineco ma non ho Revolut", "it").facts.institutions,
    ).toEqual(["Fineco"]);
  });

  it("does not silently turn investments into deposits", () => {
    const result = extractFacts("ISEE ho un conto e investimenti Fineco", "it");
    expect(result.answers.accounts_count).toBe(1);
    expect(result.answers.account_type_0).toBeUndefined();
  });

  it("asks for selection for ambiguous needs and distinguishes university ISEE", () => {
    expect(extractFacts("Ho bisogno di aiuto", "it")).toMatchObject({
      practiceId: null,
      confidence: 0,
    });
    expect(extractFacts("Devo fare ISEE e 730", "it")).toMatchObject({
      practiceId: null,
      confidence: 0.45,
    });
    expect(extractFacts("ISEE per università", "it").practiceId).toBe("isee_universitario");
    expect(extractFacts("Non devo fare il 730 ma ISEE", "it").practiceId).toBe("isee_ordinario");
  });
});

describe("interview validation and edits", () => {
  it.each([NaN, Infinity, -1, 1.5, 21, "2", null])(
    "rejects invalid household count %s",
    (value) => {
      expect(() =>
        applyAnswer("isee_ordinario", {}, "household_count", value, "it", now),
      ).toThrow();
    },
  );

  it("requires exactly one applicant and non-future birth years", () => {
    for (const value of [
      members.slice(1),
      [...members, members[0]],
      [{ ...members[0], birthYear: 2028 }, members[1]],
    ]) {
      expect(() =>
        applyAnswer("isee_ordinario", { household_count: 2 }, "members", value, "it", now),
      ).toThrow();
    }
    expect(
      applyAnswer("isee_ordinario", { household_count: 2 }, "members", members, "it", now).members,
    ).toEqual(members);
  });

  it("rejects hidden questions, unknown choices and repeated member selections", () => {
    const answers = answersWithMembers();
    const household = buildHousehold(answers);
    expect(() =>
      applyAnswer("isee_ordinario", answers, "account_owner_0", household[0]!.id, "it", now),
    ).toThrow();
    expect(() => applyAnswer("isee_ordinario", answers, "housing", "castle", "it", now)).toThrow();
    expect(() =>
      applyAnswer(
        "isee_ordinario",
        { ...answers, disability: true },
        "disability_members",
        [household[0]!.id, household[0]!.id],
        "it",
        now,
      ),
    ).toThrow();
  });

  it("removes the full dependent graph when the household count changes, preserving independent facts", () => {
    const answers: Answers = {
      ...answersWithMembers(),
      accounts_count: 2,
      account_bank_0: "Fineco",
      account_owner_0: buildHousehold(answersWithMembers())[0]!.id,
      disability: true,
      disability_members: [buildHousehold(answersWithMembers())[0]!.id],
      housing: "rent",
    };
    const changed = applyAnswer("isee_ordinario", answers, "household_count", 1, "it", now);
    expect(changed.members).toBeUndefined();
    expect(changed.account_owner_0).toBeUndefined();
    expect(changed.disability_members).toBeUndefined();
    expect(changed.account_bank_0).toBe("Fineco");
    expect(changed.housing).toBe("rent");
  });

  it("removes children made invisible by changed answers", () => {
    const answers: Answers = {
      ...answersWithMembers(),
      accounts_count: 2,
      account_bank_1: "Poste",
      account_type_1: "deposit",
      account_owner_1: "joint",
      excluded_savings: true,
    };
    const changed = applyAnswer("isee_ordinario", answers, "accounts_count", 0, "it", now);
    expect(changed.account_bank_1).toBeUndefined();
    expect(changed.excluded_savings).toBeUndefined();
    expect(
      nextQuestion("isee_ordinario", editAnswer("isee_ordinario", answers, "household_count"), "it")
        ?.id,
    ).toBe("household_count");
  });

  it("skips optional answers but requires mandatory ones, with localized errors", () => {
    const answers = { ...answersWithMembers(), accounts_count: 1 };
    expect(skipQuestion("isee_ordinario", answers, "account_bank_0", "en").account_bank_0).toBe("");
    expect(() => skipQuestion("isee_ordinario", answers, "housing", "en")).toThrow();
    expect(() => applyAnswer("isee_ordinario", {}, "household_count", "bad", "bn", now)).toThrow(
      /[\u0980-\u09ff]/,
    );
  });

  it.each([
    "2027-02-29",
    "2027-02-31",
    "2027-13-01",
    "2027-01-32",
    "2027-1-01",
    "2027-01-01T00:00:00Z",
  ])("rejects invalid calendar date %s", (date) => expect(validDate(date)).toBe(false));
  it("accepts leap days without local timezone rounding", () =>
    expect(validDate("2028-02-29")).toBe(true));

  it("validates birth years on the Rome calendar at New Year", () => {
    const newYear = new Date("2027-12-31T23:30:00Z");
    expect(() =>
      applyAnswer(
        "isee_ordinario",
        { household_count: 1 },
        "members",
        [{ role: "richiedente", firstName: "Esempio", birthYear: 2028 }],
        "it",
        newYear,
      ),
    ).not.toThrow();
  });
});

describe("conditional and stable checklist", () => {
  it("preserves person identifiers across reordering and checklist ids across language changes", () => {
    const answers = answersWithMembers();
    const reversed = { ...answers, members: [...members].reverse() };
    expect(
      buildHousehold(reversed)
        .map((member) => member.id)
        .sort(),
    ).toEqual(
      buildHousehold(answers)
        .map((member) => member.id)
        .sort(),
    );
    expect(checklist(answers, "bn").map((item) => item.id)).toEqual(
      checklist(answers, "it").map((item) => item.id),
    );
  });

  it("removes income evidence when a person reports no income and collects exempt income by person", () => {
    const answers = answersWithMembers();
    const household = buildHousehold(answers);
    const applicant = household[0]!;
    const child = household[1]!;
    const items = checklist({
      ...answers,
      [`income_present_${child.id}`]: false,
      exempt_income: true,
      exempt_income_members: [applicant.id],
    });
    expect(
      items.some((item) => item.requirementId === "income" && item.memberId === child.id),
    ).toBe(false);
    expect(
      items.some(
        (item) => item.requirementId === "exempt_income" && item.memberId === applicant.id,
      ),
    ).toBe(true);
  });

  it("repeats accounts and conditional mortgages without losing surviving instance ids", () => {
    const answers: Answers = {
      ...answersWithMembers(),
      accounts_count: 2,
      account_type_0: "deposit",
      account_type_1: "investment",
      properties_count: 2,
      property_mortgage_0: true,
      property_mortgage_1: false,
      housing: "rent",
    };
    const before = checklist(answers);
    const after = checklist({ ...answers, accounts_count: 1, properties_count: 1 });
    expect(before.filter((item) => item.requirementId === "account_average")).toHaveLength(1);
    expect(before.filter((item) => item.requirementId === "investment")).toHaveLength(1);
    expect(before.filter((item) => item.requirementId === "mortgage")).toHaveLength(1);
    expect(after.every((item) => before.some((existing) => existing.id === item.id))).toBe(true);
  });

  it("does not require ISEE for AUU or expired-permit evidence for a first issue", () => {
    const answers = answersWithMembers();
    const household = buildHousehold(answers);
    expect(
      buildChecklist("assegno_unico", answers, household, "it").find(
        (item) => item.requirementId === "isee_certificate",
      )?.required,
    ).toBe(false);
    const permit = buildChecklist(
      "permesso_soggiorno",
      { members: [members[0]!], permit_action: "first", permit_reason: "study" },
      [household[0]!],
      "it",
    );
    expect(permit.some((item) => item.requirementId === "permit_current")).toBe(false);
    expect(permit.some((item) => item.requirementId === "permit_study")).toBe(true);
    expect(permit.some((item) => item.requirementId === "permit_work")).toBe(false);
  });
});

describe("dossier findings and progress", () => {
  it("uses Rome's calendar day across midnight, including expiry today", () => {
    const item = checklist().find((entry) => entry.requirementId === "identity" && entry.required)!;
    const doc = document(item);
    doc.analysis!.expiresOn = "2026-12-31";
    const result = evaluate([item], [doc], new Date("2026-12-31T23:30:00Z"));
    expect(result.findings.some((finding) => finding.code === "document.expired")).toBe(true);
    doc.analysis!.expiresOn = "2027-01-01";
    expect(
      evaluate([item], [doc]).findings.some((finding) => finding.code === "document.expired"),
    ).toBe(false);
    expect(
      evaluate([item], [doc]).findings.some((finding) => finding.code === "document.expiring"),
    ).toBe(true);
  });

  it("checks the 90-day window across the leap-year boundary", () => {
    const item = checklist().find((entry) => entry.requirementId === "identity" && entry.required)!;
    const doc = document(item);
    doc.analysis!.expiresOn = "2028-02-29";
    expect(
      evaluate([item], [doc], new Date("2027-12-01T12:00:00Z")).findings.some(
        (finding) => finding.code === "document.expiring",
      ),
    ).toBe(true);
    doc.analysis!.expiresOn = "2028-03-01";
    expect(
      evaluate([item], [doc], new Date("2027-12-01T12:00:00Z")).findings.some(
        (finding) => finding.code === "document.expiring",
      ),
    ).toBe(false);
  });

  it("uses income reference year instead of certificate cover year and ignores current-document years", () => {
    const income = checklist().find((entry) => entry.requirementId === "income")!;
    const identity = checklist().find(
      (entry) => entry.requirementId === "identity" && entry.required,
    )!;
    const wrong = document(income);
    wrong.analysis!.referenceYear = 2026;
    expect(
      evaluate([income], [wrong]).findings.some(
        (finding) => finding.code === "document.wrong_year" && finding.severity === "blocker",
      ),
    ).toBe(true);
    const current = document(identity);
    current.analysis!.referenceYear = 2020;
    expect(
      evaluate([identity], [current]).findings.some(
        (finding) => finding.code === "document.wrong_year",
      ),
    ).toBe(false);
  });

  it("does not count documents with known blockers or absent analysis", () => {
    const item = checklist().find((entry) => entry.requirementId === "income")!;
    const doc = document(item);
    doc.analysis!.ownerName = "Persona Diversa";
    doc.analysis!.legible = false;
    doc.analysis!.pagesComplete = false;
    const result = evaluate([item], [doc]);
    expect(result.progress.documentsDone).toBe(0);
    expect(result.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        "document.wrong_owner",
        "document.illegible",
        "document.missing_pages",
      ]),
    );
    expect(evaluate([item], [document(item, { analysis: null })]).progress.documentsDone).toBe(0);
  });

  it("flags orphaned documents after an answer removes their item", () => {
    const items = checklist({ ...answersWithMembers(), housing: "rent" });
    const rent = items.find((entry) => entry.requirementId === "rent")!;
    expect(
      evaluate(checklist({ ...answersWithMembers(), housing: "owned" }), [
        document(rent),
      ]).findings.some((finding) => finding.code === "document.unmatched"),
    ).toBe(true);
  });

  it("tracks duplicate hash uploads and failed files without counting them twice", () => {
    const items = checklist().filter((entry) => entry.requirementId === "income");
    const docs = [document(items[0]!), document(items[0]!, { id: "doc_two" })];
    const result = evaluate(items, docs, now, { doc_one: "same_hash", doc_two: "same_hash" });
    expect(result.findings.some((finding) => finding.code === "document.duplicate")).toBe(true);
    expect(result.progress.documentsDone).toBe(1);
    expect(
      evaluate(
        [items[0]!],
        [document(items[0]!, { status: "failed", analysis: null })],
      ).findings.some((finding) => finding.code === "document.failed"),
    ).toBe(true);
  });

  it("keeps heuristic analysis explicitly unverified and flags wrong-practice files", () => {
    const item = checklist().find((entry) => entry.requirementId === "income")!;
    const heuristic = document(item);
    heuristic.analysis!.engine = "heuristic";
    expect(
      evaluate([item], [heuristic]).findings.some(
        (finding) => finding.code === "document.unchecked",
      ),
    ).toBe(true);
    const unrelated = document(item);
    unrelated.analysis!.detectedRequirementId = "passport";
    expect(
      evaluate([item], [unrelated]).findings.some(
        (finding) => finding.code === "document.other_practice",
      ),
    ).toBe(true);
  });

  it("does not reintroduce blockers for operator-waived requirements", () => {
    const item = checklist().find((entry) => entry.requirementId === "income")!;
    item.status = "waived";
    const doc = document(item);
    doc.analysis!.legible = false;
    const result = evaluate([item], [doc]);
    expect(result.progress.documentsDone).toBe(1);
    expect(result.findings.some((finding) => finding.severity === "blocker")).toBe(false);
  });

  it("rejects outdated catalog usage and marks complex household situations for human review", () => {
    const answers: Answers = {
      ...answersWithMembers(),
      nonresident_parent: true,
      university: true,
      excluded_savings: true,
      household_exceptions: true,
    };
    const result = evaluateDossier({
      practiceId: "isee_ordinario",
      answers,
      household: buildHousehold(answers),
      checklist: [],
      documents: [],
      language: "it",
      now: new Date("2027-12-31T23:30:00Z"),
    });
    expect(result.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        "practice.outdated_catalog",
        "practice.parent_review",
        "practice.university_review",
        "practice.savings_exclusion",
        "practice.household_review",
      ]),
    );
  });

  it("recognizes reordered and partial owner names pending visual verification", () => {
    const member = buildHousehold(answersWithMembers())[0]!;
    expect(ownerMatches("  Esempio ANNA ", member)).toBe(true);
    expect(ownerMatches("Anna", member)).toBe(true);
    expect(ownerMatches("Anna Esempio Secondo", member)).toBe(true);
  });

  it("keeps operator summaries in Italian and event labels independent of user input", () => {
    const summary = dossierSummary(
      "isee_ordinario",
      { ...answersWithMembers(), housing: "rent" },
      buildHousehold(answersWithMembers()),
    );
    expect(summary.headline).toBe("ISEE ordinario 2027");
    expect(summary.facts.find((fact) => fact.label === "Abitazione")?.value).toBe("In affitto");
    expect(timelineLabel("unexpected.personal_input")).toBe("Attività registrata sul fascicolo");
  });
});
