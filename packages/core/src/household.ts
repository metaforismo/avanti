import { MemberRole, MemberInput, type AnswerValue, type Member } from "@avanti/contracts";

export function normalizedName(name: string): string {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("it-IT");
}

export function buildHousehold(answers: Record<string, AnswerValue>): Member[] {
  if (!Array.isArray(answers.members)) return [];
  const occurrence = new Map<string, number>();
  return answers.members.flatMap((input) => {
    const result = MemberInput.safeParse(input);
    if (!result.success) return [];
    const member = result.data;
    const key = member.role;
    const count = occurrence.get(key) ?? 0;
    occurrence.set(key, count + 1);
    return [{ ...member, id: member.id ?? `m_${key}_${count}` }];
  });
}

export function knownHouseholdRoles(answers: Record<string, AnswerValue>): MemberRole[] {
  const members = MemberInput.array().min(1).safeParse(answers.members);
  if (members.success) return members.data.map((member) => member.role);
  const roles = MemberRole.array().max(20).safeParse(answers.household_roles);
  return roles.success ? roles.data : [];
}

export function householdMinimum(answers: Record<string, AnswerValue>): number {
  const roles = knownHouseholdRoles(answers);
  return Math.max(1, roles.length + (roles.length && !roles.includes("richiedente") ? 1 : 0));
}
