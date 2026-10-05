import type { AnswerValue, CitizenCase, IntakeTurn, Language, PracticeId } from "@avanti/contracts";
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
        answers = applyAnswer(practiceId, answers, question.id, value, language, now);
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
    if (proposal.answers.household_roles)
      answers.household_roles = proposal.answers.household_roles;
    return { practiceId, answers };
  }
  if (!practiceId) throw new ApiFailure("bad_request", 400, "Scegli prima la pratica.");
  switch (input.type) {
    case "answer":
      answers = applyAnswer(
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

const acknowledgement: Record<Language, [string, string, string, string, string]> = {
  it: ["Ho capito", "persone", "conti", "immobili", "veicoli"],
  en: ["I understood", "people", "accounts", "properties", "vehicles"],
  fr: ["J’ai compris", "personnes", "comptes", "biens", "véhicules"],
  es: ["He entendido", "personas", "cuentas", "inmuebles", "vehículos"],
  ro: ["Am înțeles", "persoane", "conturi", "imobile", "vehicule"],
  uk: ["Я зрозумів", "людей", "рахунків", "нерухомість", "транспорт"],
  ar: ["فهمت", "أشخاص", "حسابات", "عقارات", "مركبات"],
  bn: ["বুঝেছি", "জন", "হিসাব", "সম্পত্তি", "গাড়ি"],
};
export function assistantReply(view: CitizenCase, proposal: IntakeProposal | null) {
  if (proposal) {
    const [prefix, ...labels] = acknowledgement[view.language];
    const facts: string[] = [];
    if (view.practice) facts.push(view.practice.name);
    for (const [index, key] of [
      "household_count",
      "accounts_count",
      "properties_count",
      "vehicles_count",
    ].entries()) {
      const value = view.answers[key];
      if (typeof value === "number") facts.push(`${labels[index]}: ${value}`);
    }
    const banks = Object.entries(view.answers)
      .filter(
        ([key, value]) => /^account_bank_\d+$/.test(key) && typeof value === "string" && value,
      )
      .map(([, value]) => String(value));
    if (banks.length) facts.push(banks.join(", "));
    if (facts.length) return `${prefix}: ${facts.join(", ")}.`;
    return choosePractice[view.language];
  }
  if (view.nextQuestion) return view.nextQuestion.prompt;
  return view.practice ? uploadDocuments[view.language] : choosePractice[view.language];
}
