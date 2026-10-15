import { randomUUID } from "node:crypto";
import { MemberInput, type AnswerValue } from "@avanti/contracts";
import { buildHousehold } from "@avanti/core";
import { ApiFailure } from "./security";

export function storeMemberIds(
  answers: Record<string, AnswerValue>,
  previous: Record<string, AnswerValue>,
  matchMissingIds = true,
): Record<string, AnswerValue> {
  if (!Array.isArray(answers.members)) return answers;
  const before = buildHousehold(previous);
  const used = new Set<string>();
  const inputs = MemberInput.array().parse(answers.members);
  const members = inputs.map((input, position) => {
    let match = before.find((member) => member.id === input.id && !used.has(member.id));
    if (input.id && !match)
      throw new ApiFailure(
        "bad_request",
        400,
        "Il componente del nucleo familiare non è valido. Ricarica la pagina.",
      );
    if (!input.id && matchMissingIds) {
      match = before.find(
        (member) =>
          !used.has(member.id) &&
          member.role === input.role &&
          member.firstName === input.firstName &&
          member.lastName === input.lastName &&
          member.birthYear === input.birthYear,
      );
      if (
        !match &&
        before.length === inputs.length &&
        before[position]?.role === input.role &&
        !used.has(before[position]!.id)
      )
        match = before[position];
    }
    const id = match?.id ?? randomUUID();
    used.add(id);
    return { ...input, id };
  });
  const removed = before.filter((member) => !used.has(member.id)).map((member) => member.id);
  const cleaned = Object.fromEntries(
    Object.entries(answers).flatMap(([key, value]) => {
      if (removed.some((id) => key.endsWith(`_${id}`) || value === id)) return [];
      if (Array.isArray(value) && value.every((entry) => typeof entry === "string")) {
        const remaining = value.filter((entry) => !removed.includes(entry));
        if (remaining.length !== value.length) return remaining.length ? [[key, remaining]] : [];
      }
      return [[key, value]];
    }),
  );
  return { ...cleaned, members };
}
