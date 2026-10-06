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
