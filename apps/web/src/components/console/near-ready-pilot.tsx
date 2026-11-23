"use client";

import Link from "next/link";
import type { z } from "zod";
import type { NearReadyPilotResponse } from "@avanti/contracts";
import { Notice } from "@/components/ui/notice";
import { SectionHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { useResource } from "@/lib/console/use-resource";
import { PANEL } from "@/components/console/admin/panel";
import { cn } from "@/lib/cn";

const MODE = { off: "Spenta", shadow: "In ombra", visible: "Visibile agli operatori" } as const;
const percent = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)}%`);
const minutes = (value: number | null) => (value === null ? "—" : `${Math.round(value)} min`);

/**
 * How the near-ready suggestion is doing in the pilot: the numbers the proposal set as the bar
 * before it may be shown to operators (precision with its interval, critical errors, time saved).
 */
export function NearReadyPilot() {
  const report = useResource<z.infer<typeof NearReadyPilotResponse>>("/api/reports/near-ready");
  const data = report.data;
  return (
    <section aria-labelledby="near-ready-title" className="grid gap-4">
      <SectionHeader
        id="near-ready-title"
        title="Pratica «quasi pronta»"
        lead="Misure del pilota: precisione dei suggerimenti rispetto alla decisione finale dell'operatore."
        actions={
          data && (
            <Pill
              className="text-[0.8125rem]"
              tone={data.mode === "visible" ? "ok" : data.mode === "shadow" ? "stamp" : "muted"}
            >
              {MODE[data.mode]}
            </Pill>
          )
        }
      />
      {report.status === "error" && !data ? (
        <Notice tone="danger">{report.error.message}</Notice>
      ) : !data ? (
        <Skeleton className="h-40 rounded-md" />
      ) : (
        <>
          {data.suspendedAt && (
            <Notice tone="warn" role="none">
              Sospesa il {new Date(data.suspendedAt).toLocaleDateString("it-IT")} per un errore
              grave confermato. Si riattiva dalle{" "}
              <Link
                href="/console/impostazioni#quasi-pronta"
                className="underline underline-offset-2"
              >
                impostazioni
              </Link>
              .
            </Notice>
          )}
          <dl
            className={cn(
              PANEL,
              // Two by two on a phone and a tablet, one row of four from lg: rules between cells only.
              "grid grid-cols-2 lg:grid-cols-4 lg:[&>*+*]:border-s max-lg:[&>*:nth-child(even)]:border-s max-lg:[&>*:nth-child(n+3)]:border-t",
            )}
          >
            {(
              [
                ["Valutate", String(data.total.evaluated)],
                [
                  "Suggerite",
                  data.total.selectionRate === null
                    ? String(data.total.selected)
                    : `${data.total.selected} (${percent(data.total.selectionRate)})`,
                ],
                [
                  "Precisione",
                  data.total.precisionInterval
                    ? `${percent(data.total.precision)} (${percent(data.total.precisionInterval.lower)}–${percent(data.total.precisionInterval.upper)})`
                    : percent(data.total.precision),
                ],
                ["Errori gravi", String(data.total.criticalErrors)],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="border-line px-5 py-4">
                <dt className="text-[0.8125rem] text-ink-3">{label}</dt>
                <dd
                  className={cn(
                    "tabular mt-1 text-2xl leading-tight font-semibold",
                    value === "—" && "text-base leading-[1.875rem] text-ink-3",
                  )}
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-[0.8125rem] leading-snug text-ink-2">
            Revisione mediana: {minutes(data.total.suggestedReview.medianMinutes)} con il
            suggerimento, {minutes(data.total.ordinaryReview.medianMinutes)} nel percorso ordinario.
            Falsi «quasi pronta»: {data.total.falseNearReady}; occasioni mancate:{" "}
            {data.total.missedOpportunities}.
          </p>
          {(data.total.unjudged > 0 || data.total.disagreements > 0) && (
            <p className="text-[0.8125rem] leading-snug text-ink-3">
              Ogni suggerimento si giudica solo sulla pratica com&apos;era quando è stato dato.{" "}
              {data.total.unjudged > 0 &&
                `${data.total.unjudged} ${data.total.unjudged === 1 ? "valutazione non giudicabile" : "valutazioni non giudicabili"} (la pratica è cambiata prima della decisione), escluse dalla precisione. `}
              {data.total.disagreements > 0 &&
                `${data.total.disagreements} ${data.total.disagreements === 1 ? "caso" : "casi"} con giudizi discordanti, contati come non pronti.`}
            </p>
          )}
          <p className="flex flex-wrap items-center gap-2 text-[0.8125rem] leading-snug">
            <Pill className="text-[0.8125rem]" tone={data.calibrationPassed ? "ok" : "muted"}>
              {data.calibrationPassed
                ? "Calibrazione superata"
                : "Calibrazione non ancora superata"}
            </Pill>
            <span className="text-ink-3">
              Serve almeno il 99% di precisione su 300 casi rivisti, con il limite inferiore al 95%
              sopra il 98% (intervallo {data.intervalMethod}). Prima resta in ombra.
              {data.synthetic ? " Dati dimostrativi." : ""}
            </span>
          </p>
        </>
      )}
    </section>
  );
}
