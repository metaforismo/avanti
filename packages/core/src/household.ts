import { MemberInput, type AnswerValue, type Member } from "@avanti/contracts";

export function normalizedName(name: string): string {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("it-IT");
}

// FNV is an instance identifier, never a security hash or a pseudonymisation method.
export function stableKey(value: string): string {
  let hash = 2166136261;
  for (const codePoint of value) hash = Math.imul(hash ^ (codePoint.codePointAt(0) ?? 0), 16777619);
  return (hash >>> 0).toString(36);
}

export function buildHousehold(answers: Record<string, AnswerValue>): Member[] {
  if (!Array.isArray(answers.members)) return [];
  const occurrence = new Map<string, number>();
  return answers.members.flatMap((input) => {
    const result = MemberInput.safeParse(input);
    if (!result.success) return [];
    const member = result.data;
    const key = stableKey(
      [
        member.role,
        normalizedName(member.firstName),
        normalizedName(member.lastName ?? ""),
        member.birthYear ?? "",
      ].join("|"),
    );
    const count = occurrence.get(key) ?? 0;
    occurrence.set(key, count + 1);
    return [{ ...member, id: `m_${key}_${count}` }];
  });
}
