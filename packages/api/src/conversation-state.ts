import type {
  AnswerValue,
  ConversationState,
  Language,
  Proposal,
  Question,
} from "@avanti/contracts";
import { MemberInput } from "@avanti/contracts";
import {
  renewalPending,
  applyAnswer,
  DomainValidationError,
  getQuestions,
  readableAnswer,
} from "@avanti/core";
import type { ConverseOutput } from "@avanti/ai";
import type { CaseRow } from "./dossier";
import type { messages } from "@avanti/db";

type InterviewRow = Pick<CaseRow, "practiceId" | "answers" | "editingQuestion" | "language">;
export function openQuestions(row: InterviewRow, language: Language = row.language) {
  return row.practiceId
    ? getQuestions(row.practiceId, row.answers, language).filter(
        (q) =>
          renewalPending(row.answers) ||
          !Object.hasOwn(row.answers, q.id) ||
          q.id === row.editingQuestion,
      )
    : [];
}
export function askNext(questions: Question[]): Question[] {
  const first = questions[0],
    second = questions[1];
  if (!first) return [];
  const short = (q: Question) => q.kind === "yes_no" && q.prompt.length < 150;
  return second && first.section === second.section && short(first) && short(second)
    ? [first, second]
    : [first];
}
export const normalizeEvidence = (text: string) =>
  text.normalize("NFKC").toLocaleLowerCase().replace(/\s+/gu, " ").trim();

function mentions(text: string, name: string) {
  const escaped = normalizeEvidence(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "u").test(
    normalizeEvidence(text),
  );
}

export function validateProposals(
  row: InterviewRow,
  candidates: ConverseOutput["proposals"],
  citizenTexts: string[],
  now: Date,
): Proposal[] {
  if (!row.practiceId) return [];
  const open = openQuestions(row);
  const seen = new Set<string>();
  return candidates.flatMap((candidate) => {
    const question = open.find((q) => q.id === candidate.questionId);
    if (!question || seen.has(question.id)) return [];
    try {
      // Validate against the current domain graph, never against a model-created schema.
      const known = MemberInput.array().safeParse(row.answers.members);
      const knownMembers = known.success ? known.data : [];
      const proposedMembers =
        question.kind === "members" ? MemberInput.array().safeParse(candidate.value) : null;
      const proposed = proposedMembers?.success
        ? proposedMembers.data.map((member) => {
            const { id, ...person } = member;
            return id && knownMembers.some((m) => m.id === id) ? member : person;
          })
        : candidate.value;
      const value = applyAnswer(
        row.practiceId!,
        row.answers,
        question.id,
        proposed,
        row.language,
        now,
      )[question.id]!;
      if (question.kind === "members") {
        const members = MemberInput.array().parse(value);
        // Names/years must occur in citizen messages, not merely in the model's evidence.
        if (
          members.some((m) => {
            const existing = knownMembers.find(
              (k) => k.role === m.role && k.firstName === m.firstName && k.lastName === m.lastName,
            );
            return (
              (!existing && !citizenTexts.some((text) => mentions(text, m.firstName))) ||
              (m.lastName &&
                !existing &&
                !citizenTexts.some((text) => mentions(text, m.lastName!))) ||
              (m.birthYear &&
                existing?.birthYear !== m.birthYear &&
                !citizenTexts.some((text) => mentions(text, String(m.birthYear))))
            );
          })
        )
          return [];
      }
      const evidence = normalizeEvidence(candidate.evidence);
      const supported =
        evidence.length > 0 &&
        citizenTexts.some((text) => normalizeEvidence(text).includes(evidence));
      seen.add(question.id);
      return [
        {
          id: crypto.randomUUID(),
          questionId: question.id,
          questionText: question.prompt,
          value,
          display: readableAnswer(value, question, row.language),
          evidence: candidate.evidence,
          confidence: supported ? candidate.confidence : Math.min(candidate.confidence, 0.3),
        },
      ];
    } catch (error) {
      if (error instanceof DomainValidationError) return [];
      throw error;
    }
  });
}
export function pendingProposals(
  row: CaseRow,
  now: Date,
  language: Language = row.language,
): Proposal[] {
  const open = openQuestions(row, language);
  return row.conversationProposals.flatMap((p) => {
    const q = open.find((q) => q.id === p.questionId);
    if (!q || !row.practiceId) return [];
    try {
      applyAnswer(row.practiceId, row.answers, q.id, p.value, language, now);
      return [{ ...p, questionText: q.prompt, display: readableAnswer(p.value, q, language) }];
    } catch (error) {
      if (error instanceof DomainValidationError) return [];
      throw error;
    }
  });
}
export function conversationState(
  row: CaseRow,
  chat: (typeof messages.$inferSelect)[],
  progress: ConversationState["progress"],
  now: Date,
  language: Language = row.language,
): ConversationState {
  const open = openQuestions(row, language);
  return {
    turns: chat.flatMap((m) =>
      (m.role === "citizen" || m.role === "assistant") &&
      m.kind !== "citizen_assistant" &&
      m.kind !== "citizen_question"
        ? [
            {
              id: m.id,
              role: m.role,
              text: m.text,
              kind: m.kind,
              questionId: m.questionId,
              createdAt: new Date(m.createdAt).toISOString(),
            },
          ]
        : [],
    ),
    proposals: pendingProposals(row, now, language),
    ask: row.conversationEngine === "heuristic" ? askNext(open).slice(0, 1) : askNext(open),
    progress,
    complete: Boolean(row.practiceId) && open.length === 0,
    engine: row.conversationEngine,
  };
}
export function mergeProposals(previous: Proposal[], next: Proposal[]) {
  return [...previous.filter((p) => !next.some((n) => n.questionId === p.questionId)), ...next];
}
export function confirmedContext(row: CaseRow): Record<string, AnswerValue> {
  return Object.fromEntries(
    Object.entries(row.answers).filter(([id]) => row.confirmedAnswers.includes(id)),
  );
}
