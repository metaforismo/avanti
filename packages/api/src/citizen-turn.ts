import type { AnswerValue, CitizenCase, IntakeTurn, Language, PracticeId } from "@avanti/contracts";
import {
  CLASSIFICATION_THRESHOLD,
  applyAnswer,
  editAnswer,
  getPractice,
  skipQuestion,
  t,
  intakeViolence,
} from "@avanti/core";
import type { IntakeProposal } from "./ai";
import type { CaseRow } from "./dossier";
import { turnAcknowledgement } from "./turn-acknowledgement";
import { storeMemberIds } from "./household-ids";
import { ApiFailure } from "./security";

export function assertStartable(practiceId: PracticeId | undefined) {
  if (practiceId && getPractice(practiceId, "it").availability === "coming_soon") {
    throw new ApiFailure("practice_unavailable", 400, t("it", "unavailablePractice"));
  }
}

export function assertProposalCurrent(initial: CaseRow, current: CaseRow) {
  if (
    initial.updatedAt !== current.updatedAt ||
    initial.practiceId !== current.practiceId ||
    initial.language !== current.language ||
    JSON.stringify(initial.answers) !== JSON.stringify(current.answers)
  ) {
    throw new ApiFailure("conflict", 409, "Le risposte sono cambiate. Riprova il messaggio.");
  }
}

export function applyValidatedAnswer(
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

export function applyTurn(
  current: CaseRow,
  input: IntakeTurn,
  proposal: IntakeProposal | null,
  now: Date,
) {
  let practiceId = current.practiceId;
  let answers = { ...current.answers };
  const unavailablePractice: PracticeId | null = null;
  if (
    current.renewalYear &&
    input.type === "choose_practice" &&
    input.practiceId !== "isee_ordinario"
  )
    throw new ApiFailure("conflict", 409, "Il rinnovo riguarda la pratica ISEE ordinario.");
  if (input.type === "choose_practice") {
    assertStartable(input.practiceId);
    if (practiceId !== input.practiceId)
      answers =
        current.answers.practice_year === undefined
          ? {}
          : { practice_year: current.answers.practice_year };
    return { practiceId: input.practiceId, answers, unavailablePractice };
  }
  if (input.type === "text") {
    if (proposal?.intent && proposal.intent !== "need")
      return { practiceId, answers, unavailablePractice };
    if (!proposal) return { practiceId, answers, unavailablePractice };
    if (proposal.practiceId === "isee_universitario")
      proposal = {
        ...proposal,
        practiceId: "isee_ordinario",
      };
    if (
      proposal.practiceId &&
      proposal.confidence >= CLASSIFICATION_THRESHOLD &&
      getPractice(proposal.practiceId, current.language).availability === "coming_soon"
    )
      return { practiceId, answers, unavailablePractice: proposal.practiceId };
    if (!practiceId && proposal.practiceId && proposal.confidence >= CLASSIFICATION_THRESHOLD)
      practiceId = proposal.practiceId;
    // Extracted values remain proposals until the citizen confirms them.
    return { practiceId, answers, unavailablePractice };
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
  return { practiceId, answers, unavailablePractice };
}

const choosePractice: Record<Language, string> = {
  it: "Scegli la pratica che ti serve.",
  en: "Choose the application you need.",
  fr: "Choisissez la demande souhaitée.",
  es: "Elige el trámite que necesitas.",
  ro: "Alege cererea dorită.",
  uk: "Оберіть потрібну заяву.",
  ar: "اختر الطلب الذي تحتاجه.",
  bn: "আপনার প্রয়োজনীয় আবেদন বেছে নিন।",
};
const uploadDocuments: Record<Language, string> = {
  it: "Puoi caricare i documenti della checklist.",
  en: "You can upload the checklist documents.",
  fr: "Vous pouvez envoyer les documents de la liste.",
  es: "Puedes subir los documentos de la lista.",
  ro: "Poți încărca documentele din listă.",
  uk: "Можете завантажити документи зі списку.",
  ar: "يمكنك تحميل الوثائق في القائمة.",
  bn: "তালিকার নথিগুলো আপলোড করতে পারেন।",
};

export function assistantReply(
  view: Pick<CitizenCase, "language" | "practice" | "answers" | "nextQuestion">,
  proposal: IntakeProposal | null,
  previous: Record<string, AnswerValue> = {},
  text = "",
  previousPractice?: PracticeId | null,
  unavailablePractice: PracticeId | null = null,
) {
  if (proposal?.intent === "emergency")
    return [
      t(view.language, "intakeEmergency"),
      intakeViolence(text) ? t(view.language, "intakeViolence") : "",
    ]
      .filter(Boolean)
      .join(" ");
  if (proposal?.intent === "off_topic" || proposal?.intent === "manipulation")
    return t(view.language, "intakeScope");
  if (unavailablePractice) return t(view.language, "unavailablePractice");
  if (proposal) {
    const reply = turnAcknowledgement(view, proposal, previous, text, previousPractice);
    if (reply) return reply;
  }
  if (view.nextQuestion) return view.nextQuestion.prompt;
  return view.practice ? uploadDocuments[view.language] : choosePractice[view.language];
}
