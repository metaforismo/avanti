"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import type { Route } from "next";
import type { Metrics } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { PageContainer, PageHeader, SectionHeader } from "@/components/ui/page-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { DailyChart } from "@/components/console/daily-chart";
import { formatMinutes, LANGUAGE_IT, PRACTICE_SHORT } from "@/lib/console/labels";
import { useOperator } from "@/lib/console/operator-context";
import { useResource } from "@/lib/console/use-resource";
import { cn } from "@/lib/cn";

const RANGES = [
  { days: 7, label: "7 giorni" },
  { days: 30, label: "30 giorni" },
  { days: 90, label: "90 giorni" },
] as const;
const RANGE_OPTIONS = RANGES.map((range) => ({ value: String(range.days), label: range.label }));

// Calendar days in Italian time: toISOString() would drop "today" between 00:00 and 02:00.
const romeDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" });
const isoDay = (date: Date) => romeDay.format(date);

const percent = (share: number | null) => (share === null ? "—" : `${Math.round(share * 100)}%`);

export default function MetricsPage() {
  return (
    <Suspense>
      <MetricsView />
    </Suspense>
  );
}

function MetricsView() {
  const operator = useOperator();
  const router = useRouter();
  const params = useSearchParams();
  // Filters live in the URL, like the queue: shareable and kept on reload.
  const requestedDays = Number(params.get("giorni"));
  const days = RANGES.some((r) => r.days === requestedDays) ? requestedDays : 30;
  const officeId = params.get("sportello") ?? "";
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    const search = next.toString();
    router.replace((search ? `/console/metriche?${search}` : "/console/metriche") as Route, {
      scroll: false,
    });
  };
  const setDays = (value: number) => setParam("giorni", value === 30 ? "" : String(value));
  const setOfficeId = (value: string) => setParam("sportello", value);

  const path = useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - (days - 1) * 86_400_000);
    const q = new URLSearchParams({ from: isoDay(from), to: isoDay(to) });
    if (officeId) q.set("officeId", officeId);
    return `/api/metrics?${q.toString()}`;
  }, [days, officeId]);
  const metrics = useResource<Metrics>(path);
  const data = metrics.data;

  return (
    <PageContainer width="6xl">
      <PageHeader
        title="Metriche"
        lead="Tempi e completezza misurati sulle pratiche reali, non stimati."
        actions={
          <>
            {operator.offices.length > 1 && (
              <Select
                value={officeId}
                onChange={(e) => setOfficeId(e.target.value)}
                aria-label="Sportello"
                compact
                className="h-9 text-sm"
              >
                <option value="">Tutti gli sportelli</option>
                {operator.offices.map((office) => (
                  <option key={office.id} value={office.id}>
                    {office.name}
                  </option>
                ))}
              </Select>
            )}
            <SegmentedControl
              label="Periodo"
              value={String(days)}
              options={RANGE_OPTIONS}
              onChange={(value) => setDays(Number(value))}
            />
          </>
        }
      />

      {metrics.status === "error" && !data ? (
        <Notice
          tone="danger"
          size="page"
          className="mt-8"
          title="Metriche non disponibili."
          action={
            <Button variant="secondary" onClick={() => void metrics.reload()}>
              Riprova
            </Button>
          }
        />
      ) : !data ? (
        <div className="mt-8 grid gap-8">
          <p role="status" className="sr-only">
            Caricamento metriche
          </p>
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      ) : (
        <div
          className={cn("mt-8 grid gap-8 transition-opacity", metrics.refreshing && "opacity-60")}
        >
          <dl className="grid gap-px overflow-hidden rounded-lg bg-line shadow-raised ring-1 ring-line sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Pratiche avviate" value={String(data.casesStarted)} />
            <Tile label="Inviate allo sportello" value={String(data.casesSubmitted)} />
            <Tile
              label="Complete al primo invio"
              value={percent(data.completeAtFirstSubmission)}
              share={data.completeAtFirstSubmission}
              note="Senza problemi bloccanti quando arrivano"
            />
            <Tile
              label="Richieste di integrazione"
              value={percent(data.needsCitizenRate)}
              share={data.needsCitizenRate}
              note="Pratiche rimandate al cittadino"
            />
          </dl>

          <section
            aria-labelledby="time-title"
            className="rounded-lg bg-surface p-5 shadow-raised ring-1 ring-line sm:p-6"
          >
            <SectionHeader id="time-title" title="Tempo per pratica" />
            <TimeBars metrics={data} />
            {data.baselineMinutesPerCase !== null && data.avgReviewMinutes !== null && (
              <p className="mt-5 border-t border-line pt-4 text-ink-2">
                {data.avgReviewMinutes < data.baselineMinutesPerCase
                  ? `In media ${formatMinutes(data.baselineMinutesPerCase - data.avgReviewMinutes)} in meno per pratica rispetto alla baseline.`
                  : "Per ora la revisione non è più veloce della baseline dichiarata."}
              </p>
            )}
            {data.baselineMinutesPerCase === null && (
              <p className="mt-5 border-t border-line pt-4 text-sm text-ink-3">
                Senza una baseline misurata prima di Avanti non è possibile calcolare il tempo
                risparmiato.{" "}
                {operator.role === "admin" ? (
                  <Link
                    href="/console/impostazioni#baseline"
                    className="font-semibold text-stamp underline underline-offset-2"
                  >
                    Scrivi i minuti per pratica
                  </Link>
                ) : (
                  "La imposta un amministratore del CAF."
                )}
              </p>
            )}
          </section>

          <DailyChart daily={data.daily} />

          <div className="grid gap-6 md:grid-cols-2">
            <Breakdown
              title="Per pratica"
              rows={data.byPractice.map((row) => ({
                key: row.practiceId,
                label: PRACTICE_SHORT[row.practiceId],
                value: row.count,
              }))}
            />
            <Breakdown
              title="Per lingua del cittadino"
              rows={data.byLanguage.map((row) => ({
                key: row.language,
                label: LANGUAGE_IT[row.language],
                value: row.count,
              }))}
            />
          </div>
        </div>
      )}
    </PageContainer>
  );
}

function Tile({
  label,
  value,
  note,
  share,
}: {
  label: string;
  value: string;
  note?: string;
  /** 0–1: a thin meter under the figure for the two percentages. */
  share?: number | null;
}) {
  return (
    <div className="bg-surface px-5 py-5">
      <dt className="text-sm font-medium text-ink-3">{label}</dt>
      <dd className="tabular mt-2 font-display text-[2.75rem] leading-none font-semibold tracking-[-0.03em]">
        {value}
      </dd>
      {share !== undefined && share !== null && (
        <dd aria-hidden className="mt-3 h-1 overflow-hidden rounded-full bg-sunk">
          <span
            className="block h-full origin-left rounded-full bg-stamp"
            style={{ transform: `scaleX(${Math.min(1, Math.max(0, share))})` }}
          />
        </dd>
      )}
      {note && <dd className="mt-2 text-xs text-ink-3">{note}</dd>}
    </div>
  );
}

/** The three durations as bars on one scale, so «prima» and «dopo» compare at a glance. */
function TimeBars({ metrics }: { metrics: Metrics }) {
  const rows = [
    { label: "Revisione dell'operatore", value: metrics.avgReviewMinutes, tone: "bg-stamp" },
    {
      label: "Prima, a mano (dichiarato dal CAF)",
      value: metrics.baselineMinutesPerCase,
      tone: "bg-line-strong",
    },
    { label: "Compilazione del cittadino", value: metrics.avgCitizenMinutes, tone: "bg-ink-3" },
  ];
  const max = Math.max(1, ...rows.map((row) => row.value ?? 0));
  return (
    <ul className="mt-5 grid gap-5">
      {rows.map((row, i) => (
        <li
          key={row.label}
          className="grid gap-2 sm:grid-cols-[14rem_minmax(0,1fr)_5.5rem] sm:items-center sm:gap-4"
        >
          <span className={cn("text-sm", i === 0 ? "font-semibold text-ink" : "text-ink-2")}>
            {row.label}
          </span>
          <span aria-hidden className="h-2.5 overflow-hidden rounded-full bg-sunk">
            {row.value !== null && (
              <span
                className={cn("block h-full origin-left rounded-full", row.tone)}
                style={{ transform: `scaleX(${row.value / max})` }}
              />
            )}
          </span>
          <span
            className={cn(
              "tabular font-display font-semibold sm:text-end",
              i === 0 ? "text-2xl text-stamp" : "text-xl",
            )}
          >
            {formatMinutes(row.value)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Breakdown({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; label: string; value: number }[];
}) {
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  const max = Math.max(1, ...sorted.map((r) => r.value));
  return (
    <section className="rounded-lg bg-surface p-5 shadow-raised ring-1 ring-line">
      <h2 className="font-display text-lg font-semibold tracking-[-0.01em]">{title}</h2>
      {sorted.length === 0 ? (
        <p className="mt-4 rounded-md bg-sunk px-4 py-6 text-center text-sm text-ink-3">
          Nessun dato nel periodo.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {sorted.map((row) => (
            <li
              key={row.key}
              className="grid grid-cols-[8rem_1fr_2.5rem] items-center gap-3 text-sm"
            >
              <span className="truncate text-ink-2">{row.label}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-sunk">
                <span
                  className="block h-full rounded-full bg-stamp"
                  style={{ width: `${(row.value / max) * 100}%` }}
                />
              </span>
              <span className="tabular text-end font-semibold">{row.value}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
