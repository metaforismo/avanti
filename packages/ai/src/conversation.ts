import { z } from "zod";
import {
  AnswerValue,
  ConversationTurn,
  Language,
  PracticeId,
  Question,
  SafeText,
} from "@avanti/contracts";
import { extractFacts, t } from "@avanti/core";
import { citizenCopyStyle } from "./style";
import {
  interviewConversationPrompt,
  INTERVIEW_CONVERSATION_VERSION,
} from "./prompts/interview-conversation";
import { CONSTITUTION_VERSION } from "./prompts/constitution";
import { validAnswer } from "./tasks";
import type { Task } from "./types";

export const ConverseInput = z.object({
  text: SafeText.trim().min(1).max(1000),
  language: Language,
  practiceId: PracticeId,
  organizationName: SafeText,
  practiceName: SafeText,
  openQuestions: z.array(Question).max(1000),
  askNext: z.array(Question).max(2),
  answered: z.record(z.string(), AnswerValue),
  turns: z.array(ConversationTurn).max(8),
  /** Proposals from earlier messages still wait in the card: the next question comes after them. */
  proposalsPending: z.boolean().optional(),
});
export type ConverseInput = z.infer<typeof ConverseInput>;
export const ConverseOutput = z.object({
  proposals: z
    .array(
      z.object({
        questionId: z.string(),
        value: AnswerValue,
        confidence: z.number().min(0).max(1),
        evidence: SafeText.max(1000),
      }),
    )
    .max(100),
  reply: SafeText.max(1000),
  intent: z.enum([
    "answer",
    "question",
    "off_topic",
    "needs_operator",
    "manipulation",
    "emergency",
  ]),
});
export type ConverseOutput = z.infer<typeof ConverseOutput>;
const names = {
  it: "Italian",
  en: "English",
  fr: "French",
  es: "Spanish",
  ro: "Romanian",
  uk: "Ukrainian",
  ar: "Arabic",
  bn: "Bengali",
};
const done = {
  it: "Puoi caricare i documenti della checklist.",
  en: "You can upload the checklist documents.",
  fr: "Vous pouvez envoyer les documents de la liste.",
  es: "Puedes subir los documentos de la lista.",
  ro: "Poți încărca documentele din listă.",
  uk: "Можете завантажити документи зі списку.",
  ar: "يمكنك تحميل الوثائق في القائمة.",
  bn: "তালিকার নথিগুলো আপলোড করতে পারেন।",
};
/**
 * The reply used when the model's reply cannot be. With proposals waiting, the card under it asks
 * to confirm them: asking the next question as well would ask the same thing twice («Quante
 * persone vivono…» above a card that already says 3).
 */
export function deterministicReply(
  input: Pick<ConverseInput, "askNext" | "language">,
  proposalsPending = false,
) {
  if (proposalsPending) return t(input.language, "checkProposals");
  return (
    input.askNext
      .slice(0, 1)
      .map((q) => q.prompt)
      .join(" ") || done[input.language]
  );
}
export const converseTask: Task<ConverseInput, ConverseOutput> = {
  id: "interview.converse",
  version: `${CONSTITUTION_VERSION}.${INTERVIEW_CONVERSATION_VERSION}`,
  tier: "fast",
  input: ConverseInput,
  output: ConverseOutput,
  system: (i) =>
    interviewConversationPrompt({
      languageName: names[i.language],
      register: citizenCopyStyle[i.language].address,
      glossary: citizenCopyStyle[i.language],
      organizationName: i.organizationName,
      practiceName: i.practiceName,
    }),
  data: (i) => ({
    context: {
      open_questions: i.openQuestions,
      ask_next: i.askNext.map((q) => q.id),
      proposals_pending: i.proposalsPending ?? false,
      answered: i.answered,
    },
    untrusted: [
      { kind: "citizen_text", text: JSON.stringify({ conversation: i.turns, message: i.text }) },
    ],
  }),
  heuristic: (i) => {
    const facts = extractFacts(i.text, i.language, i.practiceId);
    const q = i.askNext[0];
    const text = i.text
      .trim()
      .toLocaleLowerCase()
      .replace(/[.!؟。]+$/u, "");
    if (q) {
      if (q.kind === "yes_no" && text === t(i.language, "yes").toLocaleLowerCase())
        facts.answers[q.id] = true;
      if (q.kind === "yes_no" && text === t(i.language, "no").toLocaleLowerCase())
        facts.answers[q.id] = false;
      if (q.kind === "number" && /^\d+$/.test(text)) facts.answers[q.id] = Number(text);
      if (q.kind === "single_choice") {
        const option = q.options?.find(
          (o) => o.label.toLocaleLowerCase() === text || o.value === text,
        );
        if (option) facts.answers[q.id] = option.value;
      }
      if (q.kind === "date" && /^\d{4}-\d{2}-\d{2}$/.test(text)) facts.answers[q.id] = text;
    }
    const proposals = i.openQuestions.flatMap((q) => {
      const value = facts.answers[q.id];
      return value !== undefined && validAnswer(q, value)
        ? [{ questionId: q.id, value, confidence: 0.7, evidence: i.text }]
        : [];
    });
    return {
      proposals,
      reply: deterministicReply(i, proposals.length > 0 || i.proposalsPending === true),
      intent: "answer",
    };
  },
  guardText: (o) => o.reply,
  languageText: (o) => o.reply,
  language: (i) => i.language,
  limits: { maxOutputTokens: 1800, maxInputChars: 2000000 },
};
