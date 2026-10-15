import type { CopilotDossier } from "./copilot";

export interface DossierStatement {
  text: string;
  evidence: string[];
  citations: string[];
  unavailable: boolean;
}

/** Local fallback reports only checklist states, never interprets a free-form question. */
export function heuristicDossierAsk(d: CopilotDossier, question: string) {
  const statements: DossierStatement[] = [];
  if (/manc|integra|avvis|problem|controll|rifiut/i.test(question)) {
    statements.push({
      text: "Senza AI posso mostrare solo un elenco generale di mancanti e avvisi; non posso interpretare il filtro o la persona indicati nella domanda.",
      evidence: [],
      citations: [],
      unavailable: true,
    });
    const missing = d.checklist.filter(
      (i) => i.required && ["missing", "rejected"].includes(i.status),
    );
    for (const item of missing.slice(0, 3))
      statements.push({
        text: `Voce richiesta ${item.status === "rejected" ? "rifiutata" : "mancante"}: ${item.title}${item.memberName ? ` (${item.memberName})` : ""}.`,
        evidence: [item.id],
        citations: [],
        unavailable: false,
      });
    for (const finding of d.findings
      .filter((f) => f.severity === "blocker" || f.severity === "warning")
      .slice(0, 2))
      statements.push({
        text: `Avviso: ${finding.message}`,
        evidence: [finding.id],
        citations: [],
        unavailable: false,
      });
    if (statements.length === 1)
      statements.push({
        text: "Senza AI posso mostrare solo le voci mancanti o rifiutate e gli avvisi della checklist. Consulta il fascicolo per il dettaglio della domanda.",
        evidence: [],
        citations: [],
        unavailable: true,
      });
  } else {
    statements.push({
      text: "Senza AI posso mostrare solo le voci mancanti o rifiutate e gli avvisi della checklist. Non posso interpretare questa domanda: verifica risposte e documenti nel fascicolo.",
      evidence: [],
      citations: [],
      unavailable: true,
    });
  }
  return { statements, suggestions: ["Quali documenti mancano?", "Quali voci sono rifiutate?"] };
}
