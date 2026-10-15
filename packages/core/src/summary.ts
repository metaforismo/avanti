import type { DossierFact, Member, PracticeId } from "@avanti/contracts";
import { catalog, getPractice, practiceYear, type Answers } from "./catalog";

export function dossierSummary(
  practiceId: PracticeId | null,
  answers: Answers,
  household: Member[],
): { headline: string; facts: DossierFact[] } {
  const facts: DossierFact[] = [];
  if (!practiceId) return { headline: "Pratica da identificare", facts };
  const practice = getPractice(practiceId, "it", answers);
  if (household.length)
    facts.push({
      label: "Nucleo familiare",
      value: `${household.length} ${household.length === 1 ? "persona" : "persone"}`,
      source: "citizen",
    });
  if (practice.referenceYear)
    facts.push({
      label: "Anno dei dati",
      value: String(practice.referenceYear),
      source: "citizen",
    });
  if (typeof answers.housing === "string")
    facts.push({
      label: "Abitazione",
      value:
        (
          {
            rent: "In affitto",
            owned: "Di proprietà",
            hosted: "Ospite o altra situazione",
          } as Record<string, string>
        )[answers.housing] ?? "Da verificare",
      source: "citizen",
    });
  for (const [key, label] of [
    ["accounts_count", "Rapporti finanziari"],
    ["properties_count", "Immobili / terreni"],
    ["vehicles_count", "Veicoli / imbarcazioni"],
  ] as const) {
    if (typeof answers[key] === "number")
      facts.push({ label, value: String(answers[key]), source: "citizen" });
  }
  for (const [key, label] of [
    ["household_exceptions", "Nucleo familiare con persone non conviventi"],
    ["nonresident_parent", "Genitore non convivente del figlio minorenne"],
    ["applicant_parent_nonresident", "Genitore del richiedente non convivente (da chiarire)"],
    ["disability", "Disabilità"],
    ["university", "Prestazioni universitarie"],
    ["foreign_income", "Redditi esteri"],
    ["foreign_assets", "Beni esteri"],
    ["self_employed", "Lavoro autonomo"],
    ["maintenance", "Mantenimento"],
    ["exempt_income", "Redditi non presenti in CU o dichiarazione"],
  ] as const) {
    if (answers[key] === true)
      facts.push({ label, value: "Segnalato: verifica operatore necessaria", source: "citizen" });
  }
  return {
    headline: `${practice.name}${catalog[practiceId].declarationYear ? ` ${practiceYear(answers)}` : ""}`,
    facts,
  };
}

const timelineLabels: Record<string, string> = {
  "case.reused": "Nucleo e documenti riusati per una nuova pratica",
  "document.reuse_checked": "Validità del documento riusato controllata",
  "citizen.question": "Domanda del cittadino allo sportello",
  "document.kept": "Documento confermato dal cittadino: è giusto così",
  "citizen.reminder_sent": "Promemoria inviato",
  "citizen.reminder_simulated": "Invio promemoria simulato",
  "privacy.accepted": "Presa visione dell’informativa registrata",
  "case.link_created": "Link cittadino creato dall'operatore",
  "case.link_regenerated": "Link cittadino rigenerato dall'operatore",
  "answer.updated": "Risposte aggiornate dal cittadino",
  "answer.edited": "Risposta precedente modificata",
  "language.updated": "Lingua aggiornata",
  "review.started": "Revisione iniziata",
  "review.completed": "Revisione completata dall'operatore",
  "citizen.requested": "Integrazione richiesta al cittadino",
  "case.created": "Fascicolo aperto",
  "case.viewed": "Fascicolo consultato dall’operatore",
  "document.uploaded": "Documento caricato",
  "document.analyzed": "Analisi documento completata",
  "document.reassigned": "Abbinamento documento modificato",
  "document.deleted": "Documento eliminato",
  "document.downloaded": "Documento consultato",
  "case.submitted": "Fascicolo inviato al CAF",
  "checklist.reviewed": "Voce della checklist revisionata",
  "case.requested": "Integrazione richiesta al cittadino",
  "case.in_review": "Fascicolo in revisione",
  "case.needs_citizen": "In attesa del cittadino",
  "case.reopened": "Fascicolo riaperto",
  "case.assigned": "Assegnazione aggiornata",
  "case.note_updated": "Nota interna aggiornata",
  "checklist.verified": "Documento verificato",
  "checklist.rejected": "Nuovo documento richiesto",
  "checklist.waived": "Documento non necessario: motivo registrato",
  "checklist.reset": "Verifica annullata",
  "case.ready": "Fascicolo pronto per il gestionale",
  "case.closed": "Fascicolo chiuso",
  "case.exported": "Fascicolo esportato",
  "dsu_sheet.viewed": "Prospetto DSU consultato",
};
export function timelineLabel(type: string): string {
  return timelineLabels[type] ?? "Attività registrata sul fascicolo";
}
