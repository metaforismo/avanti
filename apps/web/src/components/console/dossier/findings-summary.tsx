import { AlertOctagon, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { CaseDossier, Finding } from "@avanti/contracts";
import { cn } from "@/lib/cn";

/** Blockers first, then warnings: the operator's reading order. */
export function FindingsSummary({ dossier }: { dossier: CaseDossier }) {
  const blockers = dossier.findings.filter((f) => f.severity === "blocker");
  const warnings = dossier.findings.filter((f) => f.severity === "warning");

  if (blockers.length === 0 && warnings.length === 0) {
    return (
      <p className="flex items-center gap-3 rounded-lg bg-ok-wash px-5 py-4 font-semibold text-ok">
        <CheckCircle2 className="size-5 shrink-0" aria-hidden />
        Nessun problema rilevato. Verifica le voci e segna la pratica come pronta.
      </p>
    );
  }

  return (
    <section
      aria-labelledby="findings-title"
      className="overflow-hidden rounded-lg ring-1 ring-line"
    >
      <h2
        id="findings-title"
        className="flex flex-wrap items-baseline gap-x-3 bg-surface px-5 pt-4 pb-3 font-display text-xl font-semibold"
      >
        Da guardare
        <span className="text-sm font-normal text-ink-3">
          {[
            blockers.length &&
              `${blockers.length} ${blockers.length === 1 ? "bloccante" : "bloccanti"}`,
            warnings.length && `${warnings.length} ${warnings.length === 1 ? "avviso" : "avvisi"}`,
          ]
            .filter(Boolean)
            .join(", ")}
        </span>
      </h2>
      <ul className="divide-y divide-line bg-surface">
        {[...blockers, ...warnings].map((finding) => (
          <FindingRow key={finding.id} finding={finding} />
        ))}
      </ul>
    </section>
  );
}

function FindingRow({ finding }: { finding: Finding }) {
  const blocker = finding.severity === "blocker";
  const Icon = blocker ? AlertOctagon : AlertTriangle;
  const content = (
    <>
      <Icon
        className={cn("mt-0.5 size-4.5 shrink-0", blocker ? "text-danger" : "text-warn")}
        aria-hidden
      />
      <span className="flex-1">{finding.message}</span>
      <span className="sr-only">{blocker ? "Bloccante" : "Avviso"}</span>
    </>
  );
  return (
    <li>
      {finding.checklistItemId ? (
        <a
          href={`#item-${finding.checklistItemId}`}
          className={cn(
            "flex gap-3 px-5 py-3 transition-colors hover:bg-paper",
            blocker && "bg-danger-wash/40",
          )}
        >
          {content}
        </a>
      ) : (
        <div className={cn("flex gap-3 px-5 py-3", blocker && "bg-danger-wash/40")}>{content}</div>
      )}
    </li>
  );
}
