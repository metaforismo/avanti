import { DsuRow, DsuSheet, type DocumentSummary, type Member } from "@avanti/contracts";
import { describe, expect, it } from "vitest";
import { buildChecklist } from "./checklist";
import { buildDsuSheet, formatDsuAmount, formatDsuDate } from "./dsu-sheet";
import type { Answers } from "./catalog";

const applicant: Member = {
  id: "m1",
  role: "richiedente",
  firstName: "Ada",
  lastName: "Esempio",
  birthYear: 1980,
};
const child: Member = { id: "m2", role: "figlio", firstName: "Luca", birthYear: 2009 };
const spouse: Member = { id: "m3", role: "coniuge", firstName: "Carlo" };
const members = [child, applicant, spouse];
const answers: Answers = {
  members,
  housing: "rent",
  accounts_count: 3,
  account_type_0: "deposit",
  account_bank_0: "Banca Demo",
  account_owner_0: applicant.id,
  account_type_1: "investment",
  account_owner_1: spouse.id,
  account_type_2: "deposit",
  account_owner_2: "joint",
  properties_count: 2,
  property_owner_0: applicant.id,
  property_mortgage_0: true,
  property_owner_1: "joint",
  property_label_1: "Casa demo",
  vehicles_count: 1,
  vehicle_owner_0: child.id,
  vehicle_label_0: "Moto demo",
  exempt_income: true,
  exempt_income_members: [spouse.id],
  disability: true,
  disability_members: [child.id],
};
function fixture() {
  const checklist = buildChecklist("isee_ordinario", answers, members, "it");
  const documents: DocumentSummary[] = checklist.map((item, index) => {
    const id = `doc-${index}`;
    item.status = "verified";
    item.documentIds = [id];
    return {
      id,
      fileName: "ESEMPIO.pdf",
      mimeType: "application/pdf",
      sizeBytes: 100,
      pages: 1,
      uploadedAt: "2027-01-01T00:00:00Z",
      checklistItemId: item.id,
      memberId: item.memberId,
      status: "analyzed",
      analysis: null,
    };
  });
  return { checklist, documents };
}

describe("DSU preparatory sheet", () => {
  it.each([
    ["exempt_income", "FC4", 3],
    ["foreign_income", "FC4", 3],
    ["self_employed", "FC2", 1],
    ["self_employed", "FC4", 1],
    ["maintenance", "FC5", 3],
    ["disability", "FC7", 1],
    ["foreign_assets", "FC2", 1],
    ["excluded_savings", "FC2", 1],
  ] as const)(
    "uses an explicit No to %s for %s, without treating Yes or an unanswered question as absence",
    (questionId, quadro, count) => {
      for (const value of [false, true, undefined, "false", 0]) {
        const input: Answers = {};
        if (value !== undefined) input[questionId] = value;
        // The savings question is asked only after at least one account is declared.
        if (questionId === "excluded_savings") input.accounts_count = 1;
        const sheet = DsuSheet.parse(buildDsuSheet("isee_ordinario", input, [applicant], [], []));
        const rows = sheet.sections
          .filter((section) => section.quadro === quadro)
          .flatMap((section) => section.rows);
        const absent = rows.filter(
          (row) => row.source.kind === "answer" && row.source.questionId === questionId,
        );
        expect(absent).toHaveLength(value === false ? count : 0);
        expect(absent.every((row) => row.value === "Nessuno")).toBe(true);
        expect(rows.filter((row) => row.source.kind === "missing").length).toBeGreaterThanOrEqual(
          value === false ? 0 : count,
        );
      }
    },
  );

  it.each(["accounts_count", "properties_count", "vehicles_count"] as const)(
    "distinguishes zero %s from an unasked question and a positive count with no owner",
    (questionId) => {
      const quadro = { accounts_count: "FC2", properties_count: "FC3", vehicles_count: "FC6" }[
        questionId
      ];
      for (const value of [0, 1, undefined, "0", false]) {
        const input: Answers = {};
        if (value !== undefined) input[questionId] = value;
        const sheet = DsuSheet.parse(buildDsuSheet("isee_ordinario", input, members, [], []));
        for (const member of members) {
          const rows = sheet.sections
            .filter((section) => section.quadro === quadro && section.memberId === member.id)
            .flatMap((section) => section.rows);
          if (value === 0) {
            expect(
              rows.filter((row) => row.source.kind === "missing").map((row) => row.label),
            ).toEqual(
              questionId === "accounts_count"
                ? ["Partecipazioni e patrimonio netto d'impresa"]
                : [],
            );
            expect(rows.find((row) => row.value === "Nessuno")?.source).toEqual({
              kind: "answer",
              questionId,
            });
          } else {
            expect(rows.some((row) => row.source.kind === "missing")).toBe(true);
            expect(rows.some((row) => row.value === "Nessuno")).toBe(false);
          }
        }
      }
    },
  );

  it("uses the mortgage answer for its own property without zeroing another property's debt", () => {
    const input = { ...answers, property_mortgage_0: false, property_mortgage_1: true };
    const sheet = buildDsuSheet("isee_ordinario", input, members, [], [])!;
    const mortgage = (instance: string) =>
      sheet.sections
        .find((section) => section.instanceId === instance)
        ?.rows.find((row) => row.label.startsWith("Quota capitale"));
    expect(mortgage("property_0")).toMatchObject({
      value: "Nessuno",
      source: { kind: "answer", questionId: "property_mortgage_0" },
    });
    expect(mortgage("property_1")).toMatchObject({ value: null, source: { kind: "missing" } });
  });

  it("prioritizes explicit exclusions over stale selections or documents, without excluding unrelated fields", () => {
    const { checklist, documents } = fixture();
    const input = {
      ...answers,
      exempt_income: false,
      disability: false,
      foreign_assets: false,
      foreign_income: true,
    };
    const sheet = buildDsuSheet("isee_ordinario", input, members, checklist, documents)!;
    const spouseIncome = sheet.sections.find(
      (section) => section.quadro === "FC4" && section.memberId === spouse.id,
    )!;
    expect(spouseIncome.rows.find((row) => row.label.startsWith("Redditi esenti"))).toMatchObject({
      value: "Nessuno",
      source: { kind: "answer", questionId: "exempt_income" },
    });
    expect(
      spouseIncome.rows.find((row) => row.label.startsWith("Redditi fondiari esteri")),
    ).toMatchObject({ value: "Nessuno", source: { kind: "answer", questionId: "foreign_assets" } });
    expect(
      spouseIncome.rows.find((row) => row.label.startsWith("Redditi da lavoro"))?.source.kind,
    ).toBe("missing");
    expect(
      sheet.sections
        .find((section) => section.instanceId === "property_0")
        ?.rows.find((row) => row.label === "Tipo di patrimonio")?.source.kind,
    ).toBe("document");
    expect(
      sheet.sections.find((section) => section.quadro === "FC7" && section.memberId === child.id)
        ?.rows,
    ).toEqual([
      {
        label: "Disabilità e non autosufficienza",
        value: "Nessuno",
        source: { kind: "answer", questionId: "disability" },
      },
    ]);
  });

  it.each([
    "exempt_income",
    "foreign_income",
    "self_employed",
    "maintenance",
    "disability",
  ] as const)(
    "retains verified documents for Yes to %s and leaves unselected members missing",
    (questionId) => {
      const input: Answers = { [questionId]: true, [`${questionId}_members`]: [applicant.id] };
      const checklist = buildChecklist("isee_ordinario", input, [applicant, spouse], "it");
      const requirementId = questionId === "self_employed" ? "business" : questionId;
      const item = checklist.find((item) => item.requirementId === requirementId)!;
      item.status = "verified";
      item.documentIds = ["doc-selected"];
      const documents: DocumentSummary[] = [
        {
          id: "doc-selected",
          fileName: "ESEMPIO.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1,
          pages: 1,
          uploadedAt: "2027-01-01T00:00:00Z",
          checklistItemId: item.id,
          memberId: applicant.id,
          status: "analyzed",
          analysis: null,
        },
      ];
      const sheet = buildDsuSheet(
        "isee_ordinario",
        input,
        [applicant, spouse],
        checklist,
        documents,
      )!;
      expect(
        sheet.sections
          .filter((section) => section.memberId === applicant.id)
          .flatMap((section) => section.rows)
          .some(
            (row) =>
              row.source.kind === "document" &&
              row.source.documentId === "doc-selected" &&
              row.value === null,
          ),
      ).toBe(true);
      expect(
        sheet.sections
          .filter((section) => section.memberId === spouse.id)
          .flatMap((section) => section.rows)
          .some((row) => row.value === "Nessuno"),
      ).toBe(false);
    },
  );

  it("moves repeated notes to the section and keeps general provenance instructions on the sheet", () => {
    const sheet = DsuSheet.parse(buildDsuSheet("isee_ordinario", {}, [applicant], [], []));
    const property = sheet.sections.find((section) => section.quadro === "FC3")!;
    expect(property.note).toContain("Nessun immobile attribuito");
    expect(property.rows.every((row) => row.note === undefined)).toBe(true);
    for (const section of sheet.sections) {
      const rowNotes = section.rows.flatMap((row) => (row.note ? [row.note] : []));
      expect(new Set(rowNotes).size).toBe(rowNotes.length);
    }
    expect(
      sheet.sections
        .flatMap((section) => section.rows)
        .some((row) => row.note?.includes("Dato non raccolto; acquisire")),
    ).toBe(false);
    expect(sheet.notes.some((note) => note.includes("Dati mancanti: acquisire"))).toBe(true);
  });

  it("orders the declarant first and each component's quadri, keeping joint assets unallocated exactly once", () => {
    const { checklist, documents } = fixture();
    const before = JSON.stringify({ answers, members, checklist, documents });
    const sheet = DsuSheet.parse(
      buildDsuSheet("isee_ordinario", answers, members, checklist, documents),
    );
    expect(sheet.sections[0]?.memberId).toBe(applicant.id);
    expect(sheet.sections.filter((s) => s.memberId === applicant.id).map((s) => s.quadro)).toEqual([
      "A",
      "FC1",
      "FC2",
      "FC2",
      "FC3",
      "FC4",
      "FC5",
      "FC6",
      "FC7",
      "FC8",
    ]);
    for (const instance of ["account_2", "property_1"]) {
      const sections = sheet.sections.filter((s) => s.instanceId === instance);
      expect(sections).toHaveLength(1);
      expect(sections[0]?.memberId).toBeNull();
    }
    expect(
      sheet.sections.find((s) => s.quadro === "FC6" && s.instanceId === "vehicle_0")?.memberId,
    ).toBe(child.id);
    expect(sheet.referenceYear).toBe(2025);
    expect(sheet.declarationYear).toBe(2027);
    expect(JSON.stringify({ answers, members, checklist, documents })).toBe(before);
  });

  it("points to verified documents without inventing values or using analysis metadata as field extraction", () => {
    const { checklist, documents } = fixture();
    const sheet = buildDsuSheet("isee_ordinario", answers, members, checklist, documents)!;
    const deposit = sheet.sections.find((s) => s.instanceId === "account_0")!;
    expect(deposit.rows.find((r) => r.label === "Saldo al 31 dicembre")).toMatchObject({
      value: null,
      source: { kind: "document", checklistItemId: "account_balance:account_0_m1" },
    });
    expect(deposit.rows.find((r) => r.label === "Giacenza media")?.source).toMatchObject({
      kind: "document",
      checklistItemId: "account_average:account_0_m1",
    });
    expect(deposit.rows.find((r) => r.label === "Tipo rapporto")?.source.kind).toBe("caf");
    expect(deposit.rows.find((r) => r.label === "Istituto (supporto Avanti)")?.source).toEqual({
      kind: "answer",
      questionId: "account_bank_0",
    });
    const investment = sheet.sections.find((s) => s.instanceId === "account_1")!;
    expect(investment.rows.some((r) => r.label === "Giacenza media")).toBe(false);
    expect(investment.rows.find((r) => r.label === "Valore")?.source.kind).toBe("document");
    expect(
      sheet.sections
        .flatMap((s) => s.rows)
        .filter((r) => r.source.kind !== "answer")
        .every((r) => r.value === null),
    ).toBe(true);
    expect(
      sheet.sections
        .find((s) => s.quadro === "FC1" && s.memberId === child.id)
        ?.rows.find((r) => r.label === "Relazione con il dichiarante")?.source.kind,
    ).toBe("caf");
  });

  it.each(["uploaded", "rejected", "waived", "issue", "missing"] as const)(
    "does not present %s documents as verified sources",
    (status) => {
      const { checklist, documents } = fixture();
      const item = checklist.find(
        (i) => i.requirementId === "account_balance" && i.memberId === applicant.id,
      )!;
      item.status = status;
      expect(
        buildDsuSheet("isee_ordinario", answers, members, checklist, documents)!
          .sections.find((s) => s.instanceId === "account_0")!
          .rows.find((r) => r.label === "Saldo al 31 dicembre")?.source.kind,
      ).toBe("missing");
    },
  );

  it.each(["stale", "wrong-owner", "failed", "processing"])(
    "rejects a %s document reference",
    (variant) => {
      const { checklist, documents } = fixture();
      const doc = documents.find((d) => d.checklistItemId === "account_balance:account_0_m1")!;
      if (variant === "stale") doc.checklistItemId = "deleted-item";
      if (variant === "wrong-owner") doc.memberId = spouse.id;
      if (variant === "failed" || variant === "processing") doc.status = variant;
      expect(
        buildDsuSheet("isee_ordinario", answers, members, checklist, documents)!
          .sections.find((s) => s.instanceId === "account_0")!
          .rows.find((r) => r.label === "Saldo al 31 dicembre")?.source.kind,
      ).toBe("missing");
    },
  );

  it("handles incomplete cases, unknown owners and false income without constructing a birthday, zero amounts or legal exclusions", () => {
    const incomplete = {
      ...answers,
      account_owner_0: "obsolete-member",
      [`income_present_${child.id}`]: false,
    };
    const sheet = DsuSheet.parse(buildDsuSheet("isee_ordinario", incomplete, members, [], []));
    expect(sheet.sections.find((s) => s.instanceId === "account_0")?.memberId).toBeNull();
    const aChild = sheet.sections.find((s) => s.quadro === "A" && s.memberId === child.id)!;
    expect(aChild.rows.find((r) => r.label === "Data di nascita")?.value).toBeNull();
    expect(aChild.rows.find((r) => r.label.startsWith("Assenza"))?.source.kind).toBe("caf");
    expect(sheet.sections.flatMap((s) => s.rows).some((r) => r.value === "0,00")).toBe(false);
    expect(DsuSheet.safeParse(buildDsuSheet("isee_ordinario", {}, [], [], [])).success).toBe(true);
    expect(buildDsuSheet(null, {}, [], [], [])).toBeNull();
    expect(buildDsuSheet("isee_universitario", {}, [], [], [])).toBeNull();
    expect(buildDsuSheet("modello_730", {}, [], [], [])).toBeNull();
  });

  it("validates provenance and rejects a invented document value", () => {
    expect(
      DsuRow.safeParse({
        label: "Saldo",
        value: "1,00",
        source: { kind: "document", documentId: "doc", checklistItemId: "item" },
      }).success,
    ).toBe(false);
    expect(
      DsuRow.safeParse({ label: "Nome", value: "Ada", source: { kind: "answer" } }).success,
    ).toBe(false);
    expect(
      DsuRow.safeParse({
        label: "Saldo",
        value: null,
        source: { kind: "document", documentId: "doc" },
      }).success,
    ).toBe(false);
  });
});

describe("DSU formatting", () => {
  it("formats dates without timezone shifts and rejects partial or impossible dates", () => {
    expect(formatDsuDate("2028-02-29")).toBe("29/02/2028");
    expect(formatDsuDate("2025-12-31")).toBe("31/12/2025");
    for (const value of ["2027-02-29", "2027-04-31", "1980", "2027-01-01T12:00:00Z"])
      expect(formatDsuDate(value)).toBeNull();
  });
  it("formats nonnegative amounts with two decimals, refusing invalid and unsafe numbers", () => {
    expect(formatDsuAmount(0)).toBe("0,00");
    expect(formatDsuAmount(1234.5)).toBe("1234,50");
    expect(formatDsuAmount(1234.567)).toBe("1234,57");
    for (const value of [NaN, Infinity, -1, Number.MAX_SAFE_INTEGER])
      expect(formatDsuAmount(value)).toBeNull();
  });
});
