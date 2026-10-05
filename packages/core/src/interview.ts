import {
  AnswerValue,
  MemberInput,
  type Language,
  type PracticeId,
  type Question,
} from "@avanti/contracts";
import { catalog, getQuestions, questionDefinitions, type Answers } from "./catalog";
import { t } from "./i18n";
import { normalizedName } from "./household";
import { calendarYear } from "./calendar";

export class DomainValidationError extends Error {
  readonly code = "bad_request";
  constructor(
    readonly questionId: string,
    message: string,
  ) {
    super(message);
    this.name = "DomainValidationError";
  }
}

export function nextQuestion(
  practiceId: PracticeId,
  answers: Answers,
  language: Language,
  now: Date,
): Question | null {
  return (
    getQuestions(practiceId, answers, language, now).find(
      (question) => !Object.hasOwn(answers, question.id),
    ) ?? null
  );
}

export function applyAnswer(
  practiceId: PracticeId,
  answers: Answers,
  questionId: string,
  input: unknown,
  language: Language,
  now: Date,
): Answers {
  if (catalog[practiceId].availability === "coming_soon")
    throw new DomainValidationError(questionId, t(language, "unavailable"));
  const definition = getQuestions(practiceId, answers, language, now).find(
    (question) => question.id === questionId,
  );
  const parsed = AnswerValue.safeParse(input);
  if (!definition || !parsed.success)
    throw new DomainValidationError(questionId, t(language, "invalid"));
  let value = parsed.data;
  const options = new Set(definition.options?.map((option) => option.value));
  let valid = false;
  switch (definition.kind) {
    case "yes_no":
      valid = typeof value === "boolean";
      break;
    case "number":
      valid =
        typeof value === "number" &&
        Number.isFinite(value) &&
        Number.isInteger(value) &&
        value >= (definition.min ?? -Infinity) &&
        value <= (definition.max ?? Infinity);
      break;
    case "text":
      if (typeof value === "string") value = value.trim();
      valid =
        typeof value === "string" &&
        value.length >= (definition.required ? (definition.min ?? 1) : 0) &&
        value.length <= (definition.max ?? 2000);
      break;
    case "single_choice":
      valid = typeof value === "string" && options.has(value);
      break;
    case "multi_choice":
      valid =
        Array.isArray(value) &&
        value.every((entry) => typeof entry === "string" && options.has(entry)) &&
        new Set<unknown>(value).size === value.length &&
        value.length >= (definition.min ?? (definition.required ? 1 : 0)) &&
        value.length <= (definition.max ?? 50);
      break;
    case "date":
      valid = typeof value === "string" && validDate(value);
      break;
    case "members": {
      if (!Array.isArray(value)) break;
      const members = value.map((member) => MemberInput.safeParse(member));
      if (members.some((member) => !member.success)) break;
      const data = members.flatMap((member) => (member.success ? [member.data] : []));
      const identities = data.map((member) =>
        [
          member.role,
          normalizedName(member.firstName),
          normalizedName(member.lastName ?? ""),
          member.birthYear ?? "",
        ].join("|"),
      );
      valid =
        data.length >= (definition.min ?? 1) &&
        data.length <= (definition.max ?? 20) &&
        data.filter((member) => member.role === "richiedente").length === 1 &&
        data.every(
          (member) => member.birthYear === undefined || member.birthYear <= calendarYear(now),
        ) &&
        new Set(identities).size === identities.length &&
        (typeof answers.household_count !== "number" || data.length === answers.household_count);
      value = data;
      break;
    }
  }
  if (!valid) throw new DomainValidationError(questionId, t(language, "invalid"));
  const changed =
    Object.hasOwn(answers, questionId) &&
    JSON.stringify(answers[questionId]) !== JSON.stringify(value);
  return {
    ...(changed ? editAnswer(practiceId, answers, questionId) : answers),
    [questionId]: value,
  };
}

export function editAnswer(practiceId: PracticeId, answers: Answers, questionId: string): Answers {
  // Dependencies come from the old answer graph so hidden children are removed too.
  const graph = questionDefinitions(practiceId, answers, "it", new Date("2000-01-01T00:00:00Z"));
  if (!graph.some((definition) => definition.question.id === questionId))
    throw new DomainValidationError(questionId, t("it", "invalid"));
  const invalidated = new Set([questionId]);
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const definition of graph) {
      if (
        definition.dependsOn.some((dependency) => invalidated.has(dependency)) &&
        !invalidated.has(definition.question.id)
      ) {
        invalidated.add(definition.question.id);
        expanded = true;
      }
    }
  }
  return Object.fromEntries(Object.entries(answers).filter(([id]) => !invalidated.has(id)));
}

export function skipQuestion(
  practiceId: PracticeId,
  answers: Answers,
  questionId: string,
  language: Language,
  now: Date,
): Answers {
  const definition = getQuestions(practiceId, answers, language, now).find(
    (question) => question.id === questionId,
  );
  if (!definition || definition.required)
    throw new DomainValidationError(questionId, t(language, "required"));
  return { ...editAnswer(practiceId, answers, questionId), [questionId]: "" };
}

export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
