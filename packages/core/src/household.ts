import { MemberInput, type AnswerValue, type Member } from "@avanti/contracts";

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
    return [{ ...member, id: `m_${key}_${count}` }];
  });
}
