"use client";

import { AlertOctagon, AlertTriangle, Info, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import type { CaseDossier } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { apiFetch, ApiRequestError } from "@/lib/api";
import {
  engineLabel,
  NEXT_STEP,
  type ConsistencyReport,
  type DossierBrief,
  type Evidence,
} from "@/lib/console/copilot";
import { formatDateTime } from "@/lib/console/labels";
import { useResource } from "@/lib/console/use-resource";
import { cn } from "@/lib/cn";
import type { DossierActions } from "./dossier-view";

/**
 * The first thing the operator reads: a colleague's brief of the dossier and the cross-checks
 * between what was declared and what the documents show. Suggestions only: every line points to
 * its evidence, and the operator decides.
 */
export function CopilotPanel({
  dossier,
  actions,
}: {
  dossier: CaseDossier;
  actions: DossierActions;
}) {
  const base = `/api/cases/${encodeURIComponent(dossier.id)}/ai`;
  const brief = useResource<DossierBrief>(`${base}/brief`);
  const consistency = useResource<ConsistencyReport>(`${base}/consistency`);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A brief of an older version of the case would describe things that are no longer true.
  const stale = brief.data && brief.data.caseVersion !== dossier.updatedAt;

  async function regenerate() {
    setRegenerating(true);
    setError(null);
    try {
      brief.setData(await apiFetch<DossierBrief>(`${base}/brief`, { method: "POST" }));
      consistency.reload();
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "Riepilogo non disponibile. Riprova.",
      );
    } finally {
      setRegenerating(false);
    }
  }

  const onEvidence = (evidence: Evidence) => {
    if (evidence.kind === "document") {
      const doc = dossier.documents.find((d) => d.id === evidence.id);
      if (doc) actions.openDocument(doc);
      return;
    }
    const target =
      evidence.kind === "checklist"
        ? document.getElementById(`item-${evidence.id}`)
        : document.getElementById(evidence.kind === "answer" ? "answers-title" : "findings-title");
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  if (brief.status === "error" && !brief.data) {
    // The copilot is an aid: if it is unreachable the dossier works as before, quietly.
    if (brief.error.status === 404) return null;
    return (
      <p className="rounded-lg bg-sunk px-5 py-3 text-sm text-ink-2">
        Il copilota non è disponibile ora: il fascicolo resta consultabile come sempre.
      </p>
    );
  }

  const issues = consistency.data?.issues ?? [];

  return (
    <section
      aria-labelledby="copilot-title"
      aria-busy={brief.status === "loading" || regenerating || undefined}
      className="overflow-hidden rounded-lg bg-surface ring-1 ring-stamp/25"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-stamp-wash/50 px-5 py-3">
        <h2
          id="copilot-title"
          className="flex items-center gap-2 font-display text-lg font-semibold"
        >
          <Sparkles className="size-4.5 text-stamp" aria-hidden />
          Copilota
        </h2>
        <div className="flex items-center gap-2 text-xs text-ink-3">
          {brief.data && (
            <span title={`Generato il ${formatDateTime(brief.data.generatedAt)}`}>
              {engineLabel(brief.data.engine, brief.data.model)}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            loading={regenerating}
            onClick={() => void regenerate()}
            aria-label="Rigenera il riepilogo"
          >
            <RefreshCw className="size-3.5" aria-hidden />
            {stale ? "Aggiorna" : "Rigenera"}
          </Button>
        </div>
      </div>

      {!brief.data ? (
        <div className="grid gap-2 p-5" aria-hidden>
          <div className="h-4 w-11/12 animate-pulse rounded-xs bg-sunk" />
          <div className="h-4 w-3/4 animate-pulse rounded-xs bg-sunk" />
          <div className="h-4 w-2/3 animate-pulse rounded-xs bg-sunk" />
        </div>
      ) : (
        <div className="grid gap-4 p-5">
          {stale && (
            <p className="rounded-md bg-warn-wash px-3 py-2 text-sm text-warn">
              La pratica è cambiata dopo questo riepilogo: aggiornalo prima di decidere.
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-md bg-danger-wash px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          <p className="text-[0.9375rem] leading-relaxed">{brief.data.situation}</p>

          {brief.data.attention.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-ink-2">Da controllare</h3>
              <ol className="mt-2 grid gap-2">
                {brief.data.attention.map((item, i) => (
                  <li key={i} className="flex gap-2.5 text-[0.9375rem]">
                    <span className="tabular mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-sunk text-xs font-semibold text-ink-2">
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      {item.text}
                      <EvidenceChips evidence={item.evidence} onOpen={onEvidence} />
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {issues.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-ink-2">
                Controlli incrociati
                <span className="ms-2 font-normal text-ink-3">
                  dichiarazioni e documenti a confronto
                </span>
              </h3>
              <ul className="mt-2 grid gap-2">
                {issues.map((issue) => (
                  <li
                    key={issue.id}
                    className={cn(
                      "flex gap-2.5 rounded-md px-3 py-2 text-[0.9375rem]",
                      issue.severity === "blocker" && "bg-danger-wash/60",
                      issue.severity === "warning" && "bg-warn-wash/60",
                      issue.severity === "info" && "bg-sunk",
                    )}
                  >
                    <SeverityIcon severity={issue.severity} />
                    <span className="min-w-0">
                      {issue.text}
                      <EvidenceChips evidence={issue.evidence} onOpen={onEvidence} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="flex flex-wrap items-center gap-2 border-t border-line pt-3 text-sm">
            <span className="text-ink-3">Prossimo passo suggerito</span>
            <Pill tone={brief.data.nextStep === "ready_for_practice" ? "ok" : "stamp"}>
              {NEXT_STEP[brief.data.nextStep]}
            </Pill>
            <span className="text-ink-2">{brief.data.nextStepReason}</span>
          </p>
          <p className="text-xs text-ink-3">
            Suggerimenti automatici: possono sbagliare. Ogni decisione resta tua.
          </p>
        </div>
      )}
    </section>
  );
}

function EvidenceChips({
  evidence,
  onOpen,
}: {
  evidence: Evidence[];
  onOpen: (evidence: Evidence) => void;
}) {
  if (evidence.length === 0) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-1.5">
      {evidence.map((e) => (
        <button
          key={`${e.kind}:${e.id}`}
          type="button"
          onClick={() => onOpen(e)}
          className="rounded-full bg-sunk px-2.5 py-0.5 text-xs font-semibold text-ink-2 hover:bg-stamp-wash hover:text-stamp"
        >
          {e.label}
        </button>
      ))}
    </span>
  );
}

function SeverityIcon({ severity }: { severity: "blocker" | "warning" | "info" }) {
  const Icon =
    severity === "blocker" ? AlertOctagon : severity === "warning" ? AlertTriangle : Info;
  return (
    <Icon
      className={cn(
        "mt-0.5 size-4.5 shrink-0",
        severity === "blocker"
          ? "text-danger"
          : severity === "warning"
            ? "text-warn"
            : "text-ink-3",
      )}
      aria-label={severity === "blocker" ? "Bloccante" : severity === "warning" ? "Avviso" : "Nota"}
    />
  );
}
