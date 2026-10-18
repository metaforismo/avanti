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
