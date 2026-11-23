import { AlertTriangle, Download } from "lucide-react";
import { cn } from "@/lib/cn";

/*
 * The console's «Registro attività» (app/console/(app)/registro), drawn as a fragment: the same
 * columns, the labels the API writes (packages/api/src/audit-log.ts, packages/core/src/summary.ts),
 * the dates as the console formats them. Operators and cases are invented, and the page says so.
 */
const EVENTS = [
  {
    at: "14 gen 2027, 09:52",
    actor: "Luca B.",
    label: "Prospetto DSU consultato",
    ref: "AV-2027-000318",
  },
  {
    at: "14 gen 2027, 09:44",
    actor: "Marta R.",
    label: "Fascicolo esportato",
    ref: "AV-2027-000318",
  },
  { at: "14 gen 2027, 09:41", actor: "Marta R.", label: "Accesso operatore riuscito" },
  { at: "13 gen 2027, 18:07", label: "Tentativo di accesso operatore fallito", failed: true },
  {
    at: "13 gen 2027, 17:30",
    actor: "Paolo D.",
    label: "Documenti scaricati in un unico ZIP",
    ref: "AV-2027-000302",
  },
] as const;

export function ActivityLog() {
  return (
    <figure data-ui className="w-full overflow-hidden rounded-[10px] bg-surface text-ink">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <p className="font-display text-lg font-semibold">Registro attività</p>
        <span
          aria-hidden
          className="inline-flex h-8 items-center gap-1.5 rounded-sm px-2.5 text-[0.8125rem] font-semibold ring-1 ring-line-strong ring-inset"
        >
          <Download className="size-3.5" />
          Esporta CSV
        </span>
      </div>
      <ol className="divide-y divide-line text-sm">
        {EVENTS.map((event) => (
          <li key={event.at} className="grid gap-0.5 px-4 py-2.5">
            <span className="flex items-baseline justify-between gap-3">
              <time className="text-[0.8125rem] text-ink-3 tabular-nums">{event.at}</time>
              {"ref" in event && (
                // The case code is real product data, set as the console sets it.
                <span className="font-mono text-[0.8125rem] text-stamp">{event.ref}</span>
              )}
            </span>
            <span className="min-w-0">
              {"actor" in event && <span className="font-semibold">{event.actor} </span>}
              <span className={cn("failed" in event ? "text-warn" : "text-ink-2")}>
                {"failed" in event && (
                  <AlertTriangle className="me-1 inline size-3.5 align-[-2px]" aria-hidden />
                )}
                {event.label}
              </span>
            </span>
          </li>
        ))}
      </ol>
      <figcaption className="bg-sunk px-4 py-2.5 text-[0.8125rem] text-ink-2">
        Il registro non contiene dati personali dei cittadini. Dati inventati.
      </figcaption>
    </figure>
  );
}
