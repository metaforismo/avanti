// Mirrors the operator copilot contract agreed with the backend (docs/decisions/ai-platform.md);
// replaced by the @avanti/contracts types when they land.

export type Evidence = {
  kind: "answer" | "document" | "checklist" | "finding";
  id: string;
  label: string;
};

export type Engine = "ai" | "heuristic";

export type DossierBrief = {
  situation: string;
  attention: { text: string; evidence: Evidence[] }[];
  missing: string[];
  nextStep: "verify_documents" | "ask_citizen" | "ready_for_practice" | "needs_operator_judgement";
  nextStepReason: string;
  engine: Engine;
  model: string | null;
  generatedAt: string;
  caseVersion: string;
};

export type ConsistencyIssue = {
  id: string;
  severity: "blocker" | "warning" | "info";
  text: string;
  evidence: Evidence[];
  checklistItemId: string | null;
};

export type ConsistencyReport = {
  issues: ConsistencyIssue[];
  engine: Engine;
  generatedAt: string;
  caseVersion: string;
};

export type DsuPrefillField = {
  sectionId: string;
  fieldId: string;
  label: string;
  value: string | number;
  documentId: string;
  page: number | null;
  confidence: number;
  note: string | null;
};

export type DsuPrefill = {
  fields: DsuPrefillField[];
  engine: Engine;
  generatedAt: string;
  caseVersion: string;
};

export type KnowledgeAnswer = {
  answer: string;
  coverage: "full" | "partial" | "none";
  citations: { id: string; title: string; source: string; url: string | null }[];
  engine: Engine;
};

export const NEXT_STEP: Record<DossierBrief["nextStep"], string> = {
  verify_documents: "Verifica i documenti",
  ask_citizen: "Chiedi un'integrazione",
  ready_for_practice: "Pronta per la pratica",
  needs_operator_judgement: "Serve una tua valutazione",
};

export function engineLabel(engine: Engine, model?: string | null) {
  return engine === "ai" ? `AI${model ? ` · ${model.split("/").pop()}` : ""}` : "Regole (senza AI)";
}
