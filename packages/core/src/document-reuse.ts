import type {
  DocumentAnalysis,
  DocumentReuseAssessment,
  DocumentStatus,
  Member,
  PracticeId,
} from "@avanti/contracts";
import { type Answers, practiceYear, referenceYearFor } from "./catalog";
import { normalizedName } from "./household";
import { validDate } from "./interview";
import { calendarDate } from "./calendar";
import { requirements, type RequirementId } from "./requirements";
import { ownerMatches } from "./evaluation";

export function sameMemberIdentity(before: Member, after: Member): boolean {
  return (
    before.id === after.id &&
    normalizedName(before.firstName) === normalizedName(after.firstName) &&
    normalizedName(before.lastName ?? "") === normalizedName(after.lastName ?? "") &&
    before.birthYear === after.birthYear &&
    before.birthDate === after.birthDate &&
    before.taxCode === after.taxCode
  );
}

export function assessDocumentReuse(input: {
  analysis: DocumentAnalysis | null;
  status?: DocumentStatus;
  applicable?: boolean;
  requirementId: string | null;
  sourceYear: number;
  practiceId: PracticeId;
  answers: Answers;
  member: Member | null;
  previousMember: Member | null;
  now: Date;
}): DocumentReuseAssessment {
  const { analysis, now, member, previousMember } = input;
  const result = (
    status: DocumentReuseAssessment["status"],
    code: DocumentReuseAssessment["code"],
    reason: string,
  ): DocumentReuseAssessment => ({ status, code, reason, checkedAt: now.toISOString() });
  if (previousMember && (!member || !sameMemberIdentity(previousMember, member)))
    return result(
      "da_verificare",
      "member_changed",
      "Il componente del nucleo è cambiato: l'operatore deve verificare la titolarità.",
    );
  if (
    analysis?.expiresOn &&
    validDate(analysis.expiresOn) &&
    analysis.expiresOn < calendarDate(now)
  )
    return result(
      "da_aggiornare",
      "expired",
      "Il documento è scaduto: serve un documento aggiornato.",
    );
  const requirement = requirements[input.requirementId as RequirementId];
  const annual = requirement && ["income", "assets"].includes(requirement.reference);
  const year = referenceYearFor(input.practiceId, input.answers);
  if (
    annual &&
    year !== null &&
    analysis?.referenceYear !== null &&
    analysis?.referenceYear !== undefined &&
    analysis.referenceYear !== year
  )
    return result("da_aggiornare", "wrong_year", `Servono dati riferiti all'anno ${year}.`);
  if (
    (["isee_certificate", "tax_previous"].includes(input.requirementId ?? "") ||
      (annual && analysis?.referenceYear == null)) &&
    input.sourceYear !== practiceYear(input.answers)
  )
    return result(
      "da_aggiornare",
      "annual",
      "Questo tipo di documento va aggiornato per il nuovo anno della pratica.",
    );
  if (input.applicable === false)
    return result(
      "da_verificare",
      "uncertain",
      "L'operatore deve abbinare il documento a una voce della nuova checklist.",
    );
  if (
    (input.status !== undefined && input.status !== "analyzed") ||
    !analysis ||
    analysis.engine === "heuristic" ||
    analysis.confidence < 0.75 ||
    !analysis.legible ||
    analysis.pagesComplete !== true ||
    !requirement ||
    analysis.detectedRequirementId !== input.requirementId ||
    (analysis.expiresOn !== null && !validDate(analysis.expiresOn)) ||
    (annual && (year === null || analysis.referenceYear === null)) ||
    (["identity", "passport", "permit_current"].includes(input.requirementId ?? "") &&
      !analysis.expiresOn) ||
    !member ||
    !analysis.ownerName ||
    !ownerMatches(analysis.ownerName, member)
  )
    return result(
      "da_verificare",
      "uncertain",
      "Mancano dati certi su titolarità, leggibilità, scadenza o anno: verifica con l'operatore.",
    );
  if (
    requirement.reference === "current" &&
    !["identity", "passport", "permit_current", "tax_code"].includes(input.requirementId ?? "")
  )
    return result(
      "da_verificare",
      "uncertain",
      "La situazione attuale deve essere riconfermata dall'operatore.",
    );
  return result(
    "valido",
    "valid",
    "I dati disponibili sono compatibili con la nuova pratica. Resta necessaria la verifica dell'operatore.",
  );
}
