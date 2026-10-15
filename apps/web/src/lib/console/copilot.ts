import type { DossierBrief, Engine } from "@avanti/contracts";

export type {
  ConsistencyIssue,
  ConsistencyReport,
  DossierBrief,
  DsuPrefill,
  DsuPrefillField,
  Engine,
  Evidence,
  KnowledgeAnswer,
} from "@avanti/contracts";

export const NEXT_STEP: Record<DossierBrief["nextStep"], string> = {
  verify_documents: "Verifica i documenti",
  ask_citizen: "Chiedi un'integrazione",
  ready_for_practice: "Pronta per la pratica",
  needs_operator_judgement: "Serve una tua valutazione",
};

export function engineLabel(engine: Engine, model?: string | null) {
  return engine === "ai" ? `AI${model ? ` · ${model.split("/").pop()}` : ""}` : "Regole (senza AI)";
}
