import type { CaseDossier, NearReadyField, NearReadyReason } from "@avanti/contracts";
import { CATALOG_VERSION, getQuestions, practiceYear, type Answers } from "./catalog";
import { calendarDate, calendarYear } from "./calendar";
import { nextQuestion } from "./interview";
import { requirements, type RequirementId } from "./requirements";

export const NEAR_READY_RULES_VERSION = "isee-pilot.1";
export const NEAR_READY_SCHEMA_VERSION = "1";
export const nearReadyReasonText: Record<NearReadyReason, string> = {
  unsupported_practice: "Percorso rapido disponibile solo per ISEE ordinario.",
  case_status: "Il fascicolo non è nella coda di revisione.",
  interview_incomplete: "L’intervista o la conferma delle risposte non è conclusa.",
  pending_proposals: "Ci sono proposte o modifiche ancora da confermare.",
  household_unidentified: "I componenti del nucleo non sono tutti identificati.",
  ownership_missing: "Manca il proprietario di un rapporto, immobile o veicolo.",
  catalog_outdated: "Anno o versione del catalogo da verificare.",
  documents_missing: "Manca un documento obbligatorio abbinato.",
  document_rejected: "È presente una voce rifiutata o dispensata.",
  document_processing: "Un documento è in elaborazione o non è stato letto.",
  document_duplicate: "Sono presenti documenti duplicati.",
  document_unmatched: "Un documento non è abbinato correttamente.",
  open_request: "È aperta un’integrazione o una domanda del cittadino.",
  rule_issues: "Sono aperti blocchi o avvisi delle regole.",
  ai_issues: "Il confronto AI rileva incongruenze o dubbi.",
  security_notice: "Un avviso di sicurezza richiede revisione ordinaria.",
  complex_case: "Il caso richiede giudizio professionale fuori dal pilota rapido.",
  stale_version: "Dossier e controlli non si riferiscono alla stessa versione.",
  ai_unavailable: "Lettura AI non disponibile.",
  ai_not_run: "Controlli AI non eseguiti perché mancano condizioni preliminari.",
  ai_fallback: "Un controllo AI è terminato con un ripiego o un errore.",
  field_missing: "Un campo necessario non ha una fonte verificabile.",
  field_confidence: "Un campo non raggiunge la soglia di confidenza richiesta.",
  field_inconsistent: "Un campo non risulta coerente con il fascicolo.",
  mode_off: "Il CAF ha disattivato il percorso rapido.",
  suspended: "Suggerimenti sospesi dopo un errore critico confermato.",
};
export const nearReadyConditionText: Record<string, string> = {
  supported: "ISEE ordinario nel perimetro del pilota",
  active: "Fascicolo in attesa di revisione",
  interview: "Intervista conclusa con risposte confermate",
  proposals: "Nessuna proposta o modifica pendente",
  household: "Componenti del nucleo identificati",
  ownership: "Rapporti, immobili e veicoli con proprietario",
  catalog: "Anno e catalogo compatibili",
  documents: "Tutti i documenti obbligatori presenti e abbinati",
  rejected: "Nessuna voce rifiutata o dispensata",
  processing: "Nessun documento in elaborazione",
  duplicates: "Nessun documento duplicato",
  matched: "Tutti i documenti abbinati",
  requests: "Nessuna integrazione o domanda aperta",
  rules: "Nessun blocco o avviso del caso",
  security: "Nessun avviso di sicurezza",
  simple: "Nessuna situazione complessa esclusa dal pilota",
  version: "Letture e dossier della stessa versione",
  ai: "Controlli AI conclusi senza ripiego",
  consistency: "Confronto AI senza incongruenze",
  fields: "Ogni campo ha provenienza e confidenza sopra soglia",
};
export const nearReadyVisualChecks = [
  "Controllare identità e composizione del nucleo sui documenti originali.",
  "Verificare abbinamenti, titolarità, annualità e importi a vista.",
  "Verificare modello e istruzioni annuali; decidere esplicitamente se il fascicolo è pronto.",
];
export type NearReadySlot = {
  fieldId: string;
  label: string;
  critical: boolean;
  documentId: string;
  manual: boolean;
};
export function nearReadySlots(d: CaseDossier): NearReadySlot[] {
  const amounts: Record<string, [string, string][]> = {
    income: [["income_amount", "Reddito riportato nel documento"]],
    account_balance: [["balance", "Saldo al 31 dicembre"]],
    account_average: [["average", "Giacenza media"]],
    rent: [["rent_amount", "Canone annuale della locazione"]],
    investment: [["investment_amount", "Valore del patrimonio mobiliare"]],
    property: [
      ["property_amount", "Valore catastale"],
      ["property_share", "Quota di proprietà"],
    ],
  };
  return d.checklist
    .filter((i) => i.required)
    .flatMap((item) =>
      item.documentIds.flatMap((documentId) => {
        const fields: [string, string, boolean][] = [
          ["match", "Abbinamento del documento", true],
          ["legibility", "Leggibilità", false],
          ["pages", "Completezza delle pagine", false],
        ];
        if (item.memberId) fields.push(["owner", "Identità e titolarità", true]);
        if (["identity", "tax_code"].includes(item.requirementId))
          fields.push(["identity", "Identità del componente", true]);
        if (item.requirementId === "identity")
          fields.push(["expiry", "Scadenza del documento", true]);
        const requirement = requirements[item.requirementId as RequirementId];
        if (requirement?.reference === "income" || requirement?.reference === "assets")
          fields.push(["year", "Anno di riferimento", true]);
        for (const [fieldId, label] of amounts[item.requirementId] ?? [])
          fields.push([fieldId, label, true]);
        if (item.requirementId === "vehicle")
          fields.push(["registration", "Targa e intestazione del veicolo", true]);
        return fields.map(([field, label, critical]) => ({
          fieldId: `${documentId}:${field}`,
          label,
          critical,
          documentId,
          manual: item.status === "verified",
        }));
      }),
    );
}
export type NearReadyInput = {
  dossier: CaseDossier;
  answers: Answers;
  confirmedAnswers: string[];
  editingQuestion: string | null;
  pendingProposals: boolean;
  openRequest: boolean;
  securityNotice: boolean;
  duplicate: boolean;
  caseVersion: string;
  analysisVersion: string;
  catalogVersion: string;
  now: Date;
  aiAvailable: boolean;
  aiOk: boolean;
  aiIssues: boolean;
  aiAttempted?: boolean;
  fields: (NearReadyField & { consistent: boolean })[];
  criticalThreshold: number;
  otherThreshold: number;
};
export function evaluateNearReady(i: NearReadyInput) {
  const d = i.dossier,
    a = i.answers;
  const conditions: Record<string, boolean> = {};
  const exclusions: NearReadyReason[] = [];
  const test = (key: string, ok: boolean, code: NearReadyReason) => {
    conditions[key] = ok;
    if (!ok) exclusions.push(code);
  };
  test("supported", d.practice?.id === "isee_ordinario", "unsupported_practice");
  test("active", ["submitted", "in_review"].includes(d.status), "case_status");
  const questions = d.practice ? getQuestions(d.practice.id, a, "it") : [];
  test(
    "interview",
    !!d.practice &&
      !nextQuestion(d.practice.id, a, "it") &&
      questions.filter((q) => q.required).every((q) => i.confirmedAnswers.includes(q.id)),
    "interview_incomplete",
  );
  test("proposals", !i.pendingProposals && !i.editingQuestion, "pending_proposals");
  test(
    "household",
    d.household.length > 0 &&
      d.household.length === a.household_count &&
      d.household.every((m) => !!m.firstName.trim() && !!m.lastName?.trim() && !!m.birthYear),
    "household_unidentified",
  );
  test(
    "ownership",
    ["account", "property", "vehicle"].every((kind) => {
      const count =
        a[
          { account: "accounts_count", property: "properties_count", vehicle: "vehicles_count" }[
            kind
          ]!
        ];
      return (
        typeof count === "number" &&
        Number.isInteger(count) &&
        count >= 0 &&
        Array.from({ length: count }, (_, n) => a[`${kind}_owner_${n}`]).every((owner) =>
          d.household.some((m) => m.id === owner),
        )
      );
    }),
    "ownership_missing",
  );
  test(
    "catalog",
    i.catalogVersion === CATALOG_VERSION &&
      practiceYear(a) === 2027 &&
      calendarYear(i.now) <= 2027,
    "catalog_outdated",
  );
  test(
    "documents",
    d.checklist.some((c) => c.required) &&
      d.checklist
        .filter((c) => c.required)
        .every(
          (c) =>
            c.documentIds.length > 0 &&
            c.documentIds.every((id) =>
              d.documents.some((doc) => doc.id === id && doc.checklistItemId === c.id),
            ),
        ),
    "documents_missing",
  );
  test(
    "rejected",
    !d.checklist.some((c) => ["rejected", "waived"].includes(c.status)),
    "document_rejected",
  );
  test(
    "processing",
    d.documents.every((doc) => doc.status === "analyzed"),
    "document_processing",
  );
  test("duplicates", !i.duplicate, "document_duplicate");
  test(
    "matched",
    d.documents.every((doc) =>
      d.checklist.some((c) => c.id === doc.checklistItemId && c.memberId === doc.memberId),
    ),
    "document_unmatched",
  );
  test("requests", !i.openRequest, "open_request");
  // These are general human-review reminders, not case inconsistencies. Field checks below
  // must replace unchecked reading; the annual-model reminder stays in visualChecks.
  test(
    "rules",
    ![...d.findings, ...d.documents.flatMap((doc) => doc.analysis?.findings ?? [])].some(
      (f) =>
        ["blocker", "warning"].includes(f.severity) &&
        !["document.unchecked", "practice.provisional_year"].includes(f.code),
    ),
    "rule_issues",
  );
  test(
    "security",
    !i.securityNotice &&
      !d.documents.some((doc) =>
        doc.analysis?.findings.some((f) => /security|safety|manipul|guard/i.test(f.code)),
      ),
    "security_notice",
  );
  const complex = [
    "household_exceptions",
    "nonresident_parent",
    "university",
    "self_employed",
    "foreign_income",
    "foreign_assets",
    "disability",
    "maintenance",
    "exempt_income",
    "excluded_savings",
    "foreign_institution_review",
    "mortgage_review",
  ];
  test(
    "simple",
    !complex.some((key) => a[key] === true) &&
      !Object.values(a).includes("joint") &&
      !Object.entries(a).some(([key, val]) => /^property_mortgage_/.test(key) && val === true),
    "complex_case",
  );
  test(
    "version",
    i.caseVersion === i.analysisVersion && d.updatedAt === i.caseVersion,
    "stale_version",
  );
  test(
    "ai",
    i.aiAvailable && i.aiOk,
    i.aiAvailable ? (i.aiAttempted === false ? "ai_not_run" : "ai_fallback") : "ai_unavailable",
  );
  test("consistency", !i.aiIssues, "ai_issues");
  const slots = nearReadySlots(d);
  const sourced = (slot: NearReadySlot) =>
    i.fields.find(
      (f) =>
        f.fieldId === slot.fieldId &&
        f.documentId === slot.documentId &&
        (f.source === "manual"
          ? slot.manual
          : f.source === "ai" &&
            f.page !== null &&
            f.page <= (d.documents.find((doc) => doc.id === f.documentId)?.pages ?? 0)),
    );
  const missing = slots.some((slot) => !sourced(slot));
  const low = slots.some((slot) => {
    const f = sourced(slot);
    return f && f.confidence < (slot.critical ? i.criticalThreshold : i.otherThreshold);
  });
  const inconsistent = slots.some((slot) => sourced(slot)?.consistent === false);
  conditions.fields = !missing && !low && !inconsistent && slots.length > 0;
  if (missing || !slots.length) exclusions.push("field_missing");
  if (low) exclusions.push("field_confidence");
  if (inconsistent) exclusions.push("field_inconsistent");
  return {
    eligible: exclusions.length === 0,
    conditions,
    exclusions,
    fields: i.fields.map(({ consistent: _consistent, ...field }) => field),
  };
}

export function nearReadyValidUntil(now: Date): string {
  const today = calendarDate(now);
  const tomorrow = Date.parse(`${today}T00:00:00Z`) + 86400000;
  // Europe/Rome midnight is UTC+1 or UTC+2, including the nights of DST changes.
  const boundary = [tomorrow - 7200000, tomorrow - 3600000].find(
    (time) => calendarDate(new Date(time)) !== today,
  )!;
  return new Date(boundary).toISOString();
}
