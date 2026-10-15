import type {
  CaseDossier,
  ConsistencyIssue,
  DossierBrief,
  DsuPrefillField,
  DsuSheet,
  Evidence,
} from "@avanti/contracts";

export type CopilotDossier = Pick<
  CaseDossier,
  "practice" | "household" | "answers" | "checklist" | "findings"
> & {
  documents: Omit<
    CaseDossier["documents"][number],
    "fileName" | "mimeType" | "sizeBytes" | "uploadedAt"
  >[];
  accountsCount: number | null;
};

export function evidenceFor(d: CopilotDossier): Evidence[] {
  return [
    ...d.answers.map((a) => ({ kind: "answer" as const, id: a.questionId, label: a.question })),
    ...d.documents.map((a) => ({
      kind: "document" as const,
      id: a.id,
      label: "Documento caricato",
    })),
    ...d.checklist.map((a) => ({ kind: "checklist" as const, id: a.id, label: a.title })),
    ...d.findings.map((a) => ({ kind: "finding" as const, id: a.id, label: a.message })),
  ];
}
export function normalizedOwner(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("it-IT")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .sort()
    .join(" ");
}
export function deterministicConsistency(d: CopilotDossier): ConsistencyIssue[] {
  const evidence = evidenceFor(d);
  const issues: ConsistencyIssue[] = d.findings
    .filter((f) => {
      if (f.severity === "ok") return false;
      if (f.code !== "document.wrong_owner") return true;
      const doc = d.documents.find((doc) => doc.id === f.documentId);
      const member = d.household.find((m) => m.id === f.memberId);
      return (
        !doc?.analysis?.ownerName ||
        !member ||
        normalizedOwner(doc.analysis.ownerName) !==
          normalizedOwner(`${member.firstName} ${member.lastName ?? ""}`)
      );
    })
    .map((f) => ({
      id: f.id,
      severity:
        f.severity === "ok" ||
        f.code === "practice.provisional_year" ||
        (f.code === "document.unchecked" &&
          d.documents.some(
            (doc) =>
              doc.id === f.documentId &&
              doc.status === "analyzed" &&
              doc.analysis?.engine === "ai" &&
              doc.analysis.legible &&
              doc.analysis.pagesComplete === true &&
              doc.analysis.confidence >= 0.75,
          ))
          ? "info"
          : f.severity,
      text: f.message,
      checklistItemId: f.checklistItemId,
      evidence: evidence.filter(
        (e) =>
          (e.kind === "finding" && e.id === f.id) ||
          (e.kind === "document" && e.id === f.documentId) ||
          (e.kind === "checklist" && e.id === f.checklistItemId),
      ),
    }));
  for (const doc of d.documents) {
    const a = doc.analysis;
    if (!a || doc.status !== "analyzed" || a.engine !== "ai") continue;
    const item = d.checklist.find((i) => i.id === doc.checklistItemId);
    if (
      a.ownerName &&
      d.household.length &&
      d.household.every((m) => m.lastName) &&
      !d.household.some(
        (m) => normalizedOwner(a.ownerName!) === normalizedOwner(`${m.firstName} ${m.lastName}`),
      ) &&
      !issues.some(
        (i) =>
          i.evidence.some((e) => e.kind === "document" && e.id === doc.id) &&
          i.id.startsWith("document.wrong_owner"),
      )
    ) {
      issues.push({
        id: `owner:${doc.id}`,
        severity: "warning",
        text: "L’intestatario letto non coincide con i componenti del nucleo: verificare l’abbinamento.",
        checklistItemId: item?.id ?? null,
        evidence: evidence.filter((e) => e.kind === "document" && e.id === doc.id),
      });
    }
    if (
      d.accountsCount === 0 &&
      ["account_balance", "account_average", "investment"].includes(a.detectedRequirementId ?? "")
    ) {
      issues.push({
        id: `undeclared:${doc.id}`,
        severity: "warning",
        text: "È presente un documento di rapporto finanziario, ma non risultano conti dichiarati.",
        checklistItemId: item?.id ?? null,
        evidence: evidence.filter(
          (e) =>
            (e.kind === "document" && e.id === doc.id) ||
            (e.kind === "answer" && e.id === "accounts_count"),
        ),
      });
    }
  }
  return issues;
}
/** Same suppression in the operator API and in the production-transport eval. */
export function repeatsRuleFinding(
  issue: Pick<ConsistencyIssue, "text" | "checklistItemId">,
  rules: ConsistencyIssue[],
): boolean {
  return rules.some(
    (rule) =>
      rule.text === issue.text ||
      (issue.checklistItemId !== null && rule.checklistItemId === issue.checklistItemId),
  );
}

export function heuristicBrief(
  d: CopilotDossier,
): Pick<DossierBrief, "situation" | "attention" | "missing" | "nextStep" | "nextStepReason"> {
  const issues = deterministicConsistency(d);
  const missing = d.checklist
    .filter((i) => i.required && ["missing", "rejected"].includes(i.status))
    .map((i) => i.id);
  const judgement =
    !d.practice ||
    !d.household.length ||
    issues.some((i) => i.severity === "blocker" && !i.id.startsWith("checklist."));
  const nextStep = judgement
    ? "needs_operator_judgement"
    : missing.length
      ? "ask_citizen"
      : d.checklist.some((i) => i.required && i.status !== "verified" && i.status !== "waived")
        ? "verify_documents"
        : "ready_for_practice";
  return {
    situation: `${d.practice?.name ?? "Pratica da identificare"}. Nucleo dichiarato: ${d.household.length} componenti.`,
    attention: [...issues]
      .sort(
        (a, b) =>
          ({ blocker: 0, warning: 1, info: 2 })[a.severity] -
          { blocker: 0, warning: 1, info: 2 }[b.severity],
      )
      .slice(0, 5)
      .map((i) => ({ text: i.text, evidence: i.evidence })),
    missing,
    nextStep,
    nextStepReason: {
      needs_operator_judgement:
        "Sono presenti segnalazioni che richiedono la valutazione dell’operatore.",
      ask_citizen: "Occorre acquisire i documenti mancanti o rifiutati.",
      verify_documents: "I documenti caricati devono essere verificati dall’operatore.",
      ready_for_practice: "La raccolta è verificata; l’operatore può proseguire nel gestionale.",
    }[nextStep],
  };
}
export function heuristicRequest(items: CopilotDossier["checklist"]): string {
  const titles = items.map((i) => [i.title, i.memberName].filter(Boolean).join(" · "));
  if (!titles.length) return "Buongiorno, per completare la pratica ci serve ancora qualcosa. ";
  if (titles.length > 6)
    return `Buongiorno, per completare la pratica ci servono ancora ${titles.length} documenti. Li trovi elencati nel tuo link: puoi caricarli da lì. Grazie.`;
  return `Buongiorno, per completare la pratica ci servono ancora:\n${titles.map((t) => `- ${t}`).join("\n")}\nPuoi caricarli dallo stesso link. Grazie.`;
}
export type PrefillSlot = {
  sectionId: string;
  fieldId: string;
  label: string;
  documentIds: string[];
};
const slug = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_$/g, "");
export function dsuPrefillSlots(sheet: DsuSheet | null, d: CopilotDossier): PrefillSlot[] {
  if (!sheet) return [];
  const allowed: Record<string, string[]> = {
    "Saldo al 31 dicembre": ["account_balance", "account_average"],
    "Giacenza media": ["account_average", "account_balance"],
    "Canone annuale della locazione previsto dal contratto": ["rent"],
    "Redditi da lavoro dipendente, pensione e altri redditi": ["income"],
  };
  const problematic = new Set(
    deterministicConsistency(d)
      .filter((issue) =>
        /document\.(wrong_year|expired|wrong_owner|illegible|missing_pages)|^(owner|undeclared):/.test(
          issue.id,
        ),
      )
      .flatMap((issue) => issue.evidence.filter((e) => e.kind === "document").map((e) => e.id)),
  );
  return sheet.sections.flatMap((section) =>
    section.rows.flatMap((row) => {
      const requirements = allowed[row.label];
      if (!requirements || row.source.kind === "answer") return [];
      const sectionId = `${section.quadro}:${section.memberId ?? "household"}:${section.instanceId ?? "main"}`;
      const items = d.checklist.filter(
        (i) =>
          requirements.includes(i.requirementId) &&
          i.memberId === section.memberId &&
          i.status !== "waived" &&
          i.status !== "rejected" &&
          (!section.instanceId || i.id.startsWith(`${i.requirementId}:${section.instanceId}_`)),
      );
      const documentIds = d.documents
        .filter(
          (doc) =>
            !problematic.has(doc.id) &&
            doc.status === "analyzed" &&
            doc.analysis?.legible &&
            doc.analysis.engine === "ai" &&
            items.some((i) => i.id === doc.checklistItemId && i.documentIds.includes(doc.id)),
        )
        .map((doc) => doc.id);
      return documentIds.length
        ? [{ sectionId, fieldId: `${sectionId}:${slug(row.label)}`, label: row.label, documentIds }]
        : [];
    }),
  );
}
export function prefillMatchesSlot(field: DsuPrefillField, slot: PrefillSlot) {
  return (
    field.sectionId === slot.sectionId &&
    field.label === slot.label &&
    (field.fieldId === slot.fieldId || field.fieldId.startsWith(`${slot.fieldId}~`))
  );
}
export function applyConfirmedPrefill(
  sheet: DsuSheet | null,
  d: CopilotDossier,
  fields: DsuPrefillField[],
): DsuSheet | null {
  if (!sheet) return null;
  const slots = dsuPrefillSlots(sheet, d);
  return {
    ...sheet,
    sections: sheet.sections.map((section) => ({
      ...section,
      rows: section.rows.map((row) => {
        const sectionId = `${section.quadro}:${section.memberId ?? "household"}:${section.instanceId ?? "main"}`;
        const slot = slots.find((s) => s.sectionId === sectionId && s.label === row.label);
        const field =
          slot &&
          fields.find(
            (f) => prefillMatchesSlot(f, slot) && slot.documentIds.includes(f.documentId),
          );
        const doc = field && d.documents.find((doc) => doc.id === field.documentId);
        if (!field || !doc?.checklistItemId) return row;
        return {
          ...row,
          value:
            typeof field.value === "number"
              ? field.value.toFixed(2).replace(".", ",")
              : field.value,
          source: {
            kind: "document" as const,
            documentId: field.documentId,
            checklistItemId: doc.checklistItemId,
            operatorConfirmed: true,
            page: field.page,
          },
          note: "Documento, confermato da operatore. Valore di supporto: classificazione DSU a cura del CAF.",
        };
      }),
    })),
  };
}
