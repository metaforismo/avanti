import type { AnswerValue, CitizenCase, IntakeTurn, Language, PracticeId } from "@avanti/contracts";
import { MemberRole } from "@avanti/contracts";
import {
  CLASSIFICATION_THRESHOLD,
  applyAnswer,
  DomainValidationError,
  editAnswer,
  getPractice,
  getQuestions,
  skipQuestion,
} from "@avanti/core";
import type { IntakeProposal } from "./ai";
import type { CaseRow } from "./dossier";
import { turnAcknowledgement } from "./turn-acknowledgement";
import { storeMemberIds } from "./household-ids";
import { ApiFailure } from "./security";

export function assertStartable(practiceId: PracticeId | undefined, now: Date) {
  if (practiceId && getPractice(practiceId, "it").availability === "coming_soon") {
    throw new ApiFailure("bad_request", 400, "Questa pratica non è ancora disponibile.");
  }
}

export function assertProposalCurrent(initial: CaseRow, current: CaseRow) {
  if (
    initial.practiceId !== current.practiceId ||
    initial.language !== current.language ||
    JSON.stringify(initial.answers) !== JSON.stringify(current.answers)
  ) {
    throw new ApiFailure("conflict", 409, "Le risposte sono cambiate. Riprova il messaggio.");
  }
}

function applyValidatedAnswer(
  practiceId: PracticeId,
  answers: Record<string, AnswerValue>,
  questionId: string,
  value: unknown,
  language: Language,
  now: Date,
) {
  let updated = applyAnswer(practiceId, answers, questionId, value, language, now);
  // Keep identity and ownership while the citizen is still changing the household size.
  if (questionId === "household_count" && answers.members)
    updated = { ...answers, household_count: updated.household_count! };
  return storeMemberIds(updated, answers);
}

function applyProposedAnswers(
  practiceId: PracticeId,
  initial: Record<string, AnswerValue>,
  proposal: IntakeProposal,
  language: Language,
  now: Date,
) {
  let answers = initial;
  const pending = new Map(Object.entries(proposal.answers));
  // Each pass can expose dependent questions; stop only when no answer was accepted.
  const maximumPasses = pending.size;
  for (let pass = 0; pass < maximumPasses; pass++) {
    let accepted = false;
    for (const question of getQuestions(practiceId, answers, language)) {
      const value = pending.get(question.id);
      if (value === undefined) continue;
      pending.delete(question.id);
      try {
        answers = applyValidatedAnswer(practiceId, answers, question.id, value, language, now);
        accepted = true;
      } catch (error) {
        if (!(error instanceof DomainValidationError)) throw error;
      }
    }
    if (!accepted || !pending.size) break;
  }
  return answers;
}

export function applyTurn(
  current: CaseRow,
  input: IntakeTurn,
  proposal: IntakeProposal | null,
  now: Date,
) {
  let practiceId = current.practiceId;
  let answers = { ...current.answers };
  if (input.type === "choose_practice") {
    assertStartable(input.practiceId, now);
    if (practiceId !== input.practiceId) answers = {};
    return { practiceId: input.practiceId, answers };
  }
  if (input.type === "text" && proposal) {
    if (!practiceId && proposal.practiceId && proposal.confidence >= CLASSIFICATION_THRESHOLD) {
      assertStartable(proposal.practiceId, now);
      practiceId = proposal.practiceId;
    }
    if (practiceId)
      answers = applyProposedAnswers(practiceId, answers, proposal, current.language, now);
    const roles = MemberRole.array().max(20).safeParse(proposal.answers.household_roles);
    if (roles.success) answers.household_roles = roles.data;
    const relations = proposal.answers.household_relations;
    if (
      Array.isArray(relations) &&
      relations.every(
        (value) => typeof value === "string" && ["madre", "padre", "coniuge"].includes(value),
      )
    )
      answers.household_relations = relations;
    if (proposal.answers.applicant_parent_nonresident === true)
      answers.applicant_parent_nonresident = true;
    return { practiceId, answers };
  }
  if (!practiceId) throw new ApiFailure("bad_request", 400, "Scegli prima la pratica.");
  switch (input.type) {
    case "answer":
      answers = applyValidatedAnswer(
        practiceId,
        answers,
        input.questionId,
        input.value,
        current.language,
        now,
      );
      break;
    case "edit":
      answers = editAnswer(practiceId, answers, input.questionId);
      if (["members", "household_count"].includes(input.questionId)) {
        answers = { ...current.answers };
        if (input.questionId === "household_count") delete answers.household_count;
      }
      break;
    case "skip":
      answers = skipQuestion(practiceId, answers, input.questionId, current.language);
      break;
  }
  return { practiceId, answers };
}

const choosePractice: Record<Language, string> = {
  it: "Scegli la pratica che ti serve.",
  en: "Choose the service you need.",
  fr: "Choisissez le service souhaité.",
  es: "Elige el servicio que necesitas.",
  ro: "Alege serviciul dorit.",
  uk: "Оберіть потрібну послугу.",
  ar: "اختر الخدمة التي تحتاجها.",
  bn: "আপনার প্রয়োজনীয় সেবা বেছে নিন।",
};
const uploadDocuments: Record<Language, string> = {
  it: "Puoi caricare i documenti della checklist.",
  en: "You can upload the checklist documents.",
  fr: "Vous pouvez envoyer les documents de la liste.",
  es: "Puedes subir los documentos de la lista.",
  ro: "Poți încărca documentele din listă.",
  uk: "Можете завантажити документи зі списку.",
  ar: "يمكنك تحميل المستندات في القائمة.",
  bn: "তালিকার নথিগুলো আপলোড করতে পারেন।",
};

export function assistantReply(
  view: Pick<CitizenCase, "language" | "practice" | "answers" | "nextQuestion">,
  proposal: IntakeProposal | null,
  previous: Record<string, AnswerValue> = {},
  text = "",
  previousPractice?: PracticeId | null,
) {
  if (proposal) {
    const reply = turnAcknowledgement(view, proposal, previous, text, previousPractice);
    if (reply) return reply;
  }
  if (view.nextQuestion) return view.nextQuestion.prompt;
  return view.practice ? uploadDocuments[view.language] : choosePractice[view.language];
}
