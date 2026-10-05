import type { ChecklistItem, Language, Member, PracticeId } from "@avanti/contracts";
import { boundedCount, catalog, type Answers } from "./catalog";
import { requirements, requirementText, type RequirementId } from "./requirements";

export function buildChecklist(
  practiceId: PracticeId,
  answers: Answers,
  household: Member[],
  language: Language,
): ChecklistItem[] {
  if (catalog[practiceId].availability === "coming_soon") return [];
  const items: ChecklistItem[] = [];
  const year = catalog[practiceId].referenceYear;
  function add(
    requirementId: RequirementId,
    key = "case",
    member: Member | null = null,
    required = true,
    suffix = "",
  ) {
    const definition = requirements[requirementId];
    const text = requirementText(requirementId, language, year);
    const memberName = member
      ? [member.firstName, member.lastName].filter(Boolean).join(" ")
      : null;
    items.push({
      id: `${requirementId}:${key}`,
      requirementId,
      group: definition.group,
      ...text,
      title: text.title + (suffix ? ` · ${suffix}` : ""),
      required,
      memberId: member?.id ?? null,
      memberName,
      status: "missing",
      documentIds: [],
      note: null,
    });
  }
  function owner(id: string): Member | null {
    return household.find((member) => member.id === answers[id]) ?? null;
  }
  function selected(parent: string): Member[] {
    const ids = answers[`${parent}_members`];
    return Array.isArray(ids)
      ? household.filter((member) => ids.some((id) => id === member.id))
      : [];
  }
  for (const member of household) {
    if (practiceId !== "permesso_soggiorno")
      add("identity", member.id, member, member.role === "richiedente");
    add("tax_code", member.id, member);
    if (
      practiceId === "modello_730" ||
      (practiceId === "isee_ordinario" && answers[`income_present_${member.id}`] !== false)
    )
      add("income", member.id, member);
  }
  if (practiceId === "isee_ordinario") {
    if (answers.housing === "rent") add("rent");
    for (let index = 0; index < boundedCount(answers.accounts_count); index++) {
      const member = owner(`account_owner_${index}`);
      const key = `account_${index}_${member?.id ?? "joint"}`;
      const label =
        typeof answers[`account_bank_${index}`] === "string"
          ? String(answers[`account_bank_${index}`])
          : "";
      if (answers[`account_type_${index}`] === "investment")
        add("investment", key, member, true, label);
      else {
        add("account_balance", key, member, true, label);
        if (answers[`account_type_${index}`] !== "other")
          add("account_average", key, member, true, label);
      }
    }
    if (answers.excluded_savings === true) add("excluded_savings", "case", null, false);
    for (let index = 0; index < boundedCount(answers.properties_count); index++) {
      const member = owner(`property_owner_${index}`);
      const key = `property_${index}_${member?.id ?? "joint"}`;
      add("property", key, member);
      if (answers[`property_mortgage_${index}`] === true) add("mortgage", key, member);
    }
    for (let index = 0; index < boundedCount(answers.vehicles_count); index++) {
      const member = owner(`vehicle_owner_${index}`);
      add("vehicle", `vehicle_${index}_${member?.id ?? "unknown"}`, member);
    }
    for (const member of selected("disability")) add("disability", member.id, member);
    if (answers.nonresident_parent === true) add("parent", "case", null, false);
    for (const member of selected("self_employed")) add("business", member.id, member);
    for (const member of selected("foreign_income")) add("foreign_income", member.id, member);
    if (answers.foreign_assets === true) add("foreign_assets");
    for (const member of selected("maintenance")) add("maintenance", member.id, member);
    for (const member of selected("exempt_income")) add("exempt_income", member.id, member);
  } else if (practiceId === "assegno_unico") {
    add("iban");
    add("isee_certificate", "case", null, false);
    if (answers.child_special === true) add("child_conditions");
  } else if (practiceId === "modello_730") {
    add("tax_previous");
    if (answers.tax_expenses === true) add("tax_expenses");
    if (answers.tax_foreign === true) {
      add("foreign_income");
      add("foreign_assets");
    }
  } else if (practiceId === "permesso_soggiorno") {
    const applicant = household.find((member) => member.role === "richiedente") ?? null;
    add("passport", applicant?.id ?? "case", applicant);
    if (answers.permit_action === "renewal")
      add("permit_current", applicant?.id ?? "case", applicant);
    if (answers.permit_reason === "work") add("permit_work", applicant?.id ?? "case", applicant);
    if (answers.permit_reason === "study") add("permit_study", applicant?.id ?? "case", applicant);
    if (answers.permit_reason === "family")
      add("permit_family", applicant?.id ?? "case", applicant);
  }
  return items;
}
