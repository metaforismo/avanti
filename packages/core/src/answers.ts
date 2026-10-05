import type {
  AnswerValue,
  AnsweredQuestion,
  Language,
  MemberRole,
  Question,
} from "@avanti/contracts";
import { localize, t, type Text } from "./i18n";
const roles: Record<MemberRole, Text> = {
  richiedente: [
    "richiedente",
    "applicant",
    "demandeur",
    "solicitante",
    "solicitant",
    "заявник",
    "مقدم الطلب",
    "আবেদনকারী",
  ],
  coniuge: [
    "coniuge",
    "spouse",
    "conjoint",
    "cónyuge",
    "soț/soție",
    "чоловік/дружина",
    "زوج/زوجة",
    "স্বামী/স্ত্রী",
  ],
  figlio: ["figlio", "child", "enfant", "hijo", "copil", "дитина", "ابن/ابنة", "সন্তান"],
  genitore: [
    "genitore",
    "parent",
    "parent",
    "progenitor",
    "părinte",
    "батько/мати",
    "والد/والدة",
    "বাবা/মা",
  ],
  altro: [
    "altro familiare",
    "other relative",
    "autre proche",
    "otro familiar",
    "altă rudă",
    "інший родич",
    "قريب آخر",
    "অন্য আত্মীয়",
  ],
};
export function readableAnswer(value: AnswerValue, question: Question, language: Language): string {
  if (typeof value === "boolean") return t(language, value ? "yes" : "no");
  if (typeof value === "number") return String(value);
  if (typeof value === "string")
    return question.options?.find((o) => o.value === value)?.label ?? value;
  if (Array.isArray(value))
    return value
      .map((entry) => {
        if (typeof entry === "string")
          return question.options?.find((o) => o.value === entry)?.label ?? entry;
        return `${[entry.firstName, entry.lastName].filter(Boolean).join(" ")} (${localize(language, roles[entry.role])})`;
      })
      .join(", ");
  return "—";
}
export function answeredQuestions(
  questions: Question[],
  answers: Record<string, AnswerValue>,
  confirmed: string[],
  language: Language,
): AnsweredQuestion[] {
  return questions
    .filter((q) => Object.hasOwn(answers, q.id))
    .map((q) => ({
      questionId: q.id,
      question: q.prompt,
      answer: readableAnswer(answers[q.id]!, q, language),
      section: q.section,
      editable: confirmed.includes(q.id),
    }));
}
