"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import type { Route } from "next";
import type { Metrics } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
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
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.025em]">Metriche</h1>
          <p className="mt-1 text-ink-2">
            Tempi e completezza misurati sulle pratiche reali, non stimati.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <div role="group" aria-label="Periodo" className="flex rounded-sm bg-sunk p-0.5">
            {RANGES.map((range) => (
              <button
                key={range.days}
                type="button"
                aria-pressed={days === range.days}
                onClick={() => setDays(range.days)}
                className={cn(
                  "h-8 rounded-[5px] px-3 text-sm transition-colors",
                  days === range.days
                    ? "bg-surface font-semibold shadow-raised"
                    : "text-ink-2 hover:text-ink",
                )}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {metrics.status === "error" && !data ? (
        <div className="mt-8 rounded-lg bg-danger-wash p-6 text-danger">
          <p className="font-semibold">Metriche non disponibili.</p>
          <Button variant="secondary" className="mt-4" onClick={() => void metrics.reload()}>
            Riprova
          </Button>
        </div>
      ) : !data ? (
        <div className="grid min-h-80 place-items-center text-ink-3">
          <Spinner label="Caricamento metriche" />
        </div>
      ) : (
        <div
          className={cn("mt-8 grid gap-8 transition-opacity", metrics.refreshing && "opacity-60")}
        >
          <dl className="grid gap-px overflow-hidden rounded-lg bg-line ring-1 ring-line sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Pratiche avviate" value={String(data.casesStarted)} />
            <Tile label="Inviate allo sportello" value={String(data.casesSubmitted)} />
            <Tile
              label="Complete al primo invio"
              value={percent(data.completeAtFirstSubmission)}
              note="Senza problemi bloccanti quando arrivano"
            />
            <Tile
              label="Richieste di integrazione"
              value={percent(data.needsCitizenRate)}
              note="Pratiche rimandate al cittadino"
            />
          </dl>

          <section
            aria-labelledby="time-title"
            className="rounded-lg bg-surface p-5 ring-1 ring-line sm:p-6"
          >
            <h2 id="time-title" className="font-display text-xl font-semibold">
              Tempo per pratica
            </h2>
            <div className="mt-5 grid gap-6 sm:grid-cols-3">
              <TimeFigure label="Revisione dell'operatore" value={data.avgReviewMinutes} emphasis />
              <TimeFigure
                label="Prima, a mano (dichiarato dal CAF)"
                value={data.baselineMinutesPerCase}
              />
              <TimeFigure label="Compilazione del cittadino" value={data.avgCitizenMinutes} />
            </div>
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
                risparmiato.
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
    </div>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="bg-surface px-5 py-4">
      <dt className="text-sm text-ink-2">{label}</dt>
      <dd className="tabular mt-1 font-display text-4xl font-semibold tracking-[-0.02em]">
        {value}
      </dd>
      {note && <dd className="mt-1 text-xs text-ink-3">{note}</dd>}
    </div>
  );
}

function TimeFigure({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: number | null;
  emphasis?: boolean;
}) {
  return (
    <div>
      <p className="text-sm text-ink-2">{label}</p>
      <p
        className={cn(
          "tabular mt-1 font-display font-semibold",
          emphasis ? "text-4xl text-stamp" : "text-3xl",
        )}
      >
        {formatMinutes(value)}
      </p>
    </div>
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
    <section className="rounded-lg bg-surface p-5 ring-1 ring-line">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {sorted.length === 0 ? (
        <p className="mt-3 text-ink-3">Nessun dato nel periodo.</p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {sorted.map((row) => (
            <li
              key={row.key}
              className="grid grid-cols-[8rem_1fr_2.5rem] items-center gap-3 text-sm"
            >
              <span className="truncate text-ink-2">{row.label}</span>
              <span className="h-2 overflow-hidden rounded-full bg-sunk">
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
