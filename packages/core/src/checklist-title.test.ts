import { describe, expect, it } from "vitest";
import { buildChecklist, genericChecklistTitle, isRequirementId } from "./index";

const applicant = { id: "m1", role: "richiedente" as const, firstName: "Amina" };
const answers = (year: number) => ({
  members: [applicant],
  household_count: 1,
  practice_year: year,
  accounts_count: 1,
  account_owner_0: applicant.id,
  account_bank_0: "Banca Segreta",
  account_type_0: "current",
});

describe("genericChecklistTitle", () => {
  it("follows the case year, like the checklist, without the bank", () => {
    for (const year of [2027, 2028]) {
      const list = buildChecklist("isee_ordinario", answers(year), [applicant], "it");
      const balance = list.find((item) => item.requirementId === "account_balance")!;
      const title = genericChecklistTitle(
        balance.requirementId,
        "isee_ordinario",
        answers(year),
        "it",
      );
      expect(balance.title.startsWith(title!)).toBe(true);
      expect(title).toContain(String(year - 2));
      expect(title).not.toContain("Banca Segreta");
    }
  });

  it("returns null for an id outside the catalog, including prototype keys", () => {
    expect(isRequirementId("toString")).toBe(false);
    expect(genericChecklistTitle("unknown", "isee_ordinario", {}, "ar")).toBeNull();
  });
});

describe("checklist titles with a person", () => {
  const holder = { id: "m1", role: "richiedente" as const, firstName: "Prova" };
  const named = (bank: string) =>
    buildChecklist(
      "isee_ordinario",
      {
        members: [holder],
        household_count: 1,
        accounts_count: 1,
        account_owner_0: holder.id,
        account_bank_0: bank,
        account_type_0: "deposit",
      },
      [holder],
      "it",
    ).filter((item) => item.memberId === holder.id && item.requirementId.startsWith("account"));

  it("drops a bank label that is only the holder's name, so the name is said once", () => {
    const items = named(" prova ");
    expect(items.map((item) => item.requirementId)).toEqual(["account_balance", "account_average"]);
    for (const item of items) {
      expect(item.title).not.toContain("·");
      expect(item.memberName).toBe("Prova");
    }
  });

  it("keeps a real bank next to the title", () => {
    for (const item of named("Fineco")) expect(item.title).toMatch(/ · Fineco$/);
  });
});
