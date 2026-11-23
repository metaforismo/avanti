"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, type ReactNode } from "react";
import type { Route } from "next";
import type { Metrics } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { DailyChart } from "@/components/console/daily-chart";
import { formatMinutes, LANGUAGE_IT, PRACTICE_SHORT } from "@/lib/console/labels";
import { PANEL, PanelTitle } from "@/components/console/admin/panel";
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

const shortDay = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Rome",
});
const shortDayYear = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Rome",
});

const numbers = new Intl.NumberFormat("it-IT");

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

  const { path, from, to } = useMemo(() => {
    const end = new Date();
    const start = new Date(end.getTime() - (days - 1) * 86_400_000);
    const q = new URLSearchParams({ from: isoDay(start), to: isoDay(end) });
    if (officeId) q.set("officeId", officeId);
    return { path: `/api/metrics?${q.toString()}`, from: start, to: end };
  }, [days, officeId]);
  const office = operator.offices.find((o) => o.id === officeId);
  const metrics = useResource<Metrics>(path);
  const data = metrics.data;
  const report =
    operator.role === "admin" ? (
      <Link href="/console/rapporto" className="font-semibold text-stamp hover:underline">
        Rapporto del pilota
      </Link>
    ) : (
      "Rapporto del pilota"
    );

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Metriche"
        lead={
          <>
            <span className="tabular whitespace-nowrap">
              {shortDay.format(from)} – {shortDayYear.format(to)}
            </span>
            {" · "}
            {office?.name ?? "tutti gli sportelli"} · conteggi esatti, per uso interno
          </>
        }
        actions={
          <>
            {operator.offices.length > 1 && (
              <Select
                value={officeId}
                onChange={(e) => setOfficeId(e.target.value)}
                aria-label="Sportello"
                compact
                className="h-8 text-sm"
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
          className="mt-6"
          title="Metriche non disponibili."
          action={
            <Button variant="secondary" onClick={() => void metrics.reload()}>
              Riprova
            </Button>
          }
        />
      ) : !data ? (
        <MetricsSkeleton />
      ) : (
        <div
          aria-busy={metrics.refreshing || undefined}
          className={cn(
            "mt-6 grid gap-4 transition-opacity duration-150 lg:grid-cols-3",
            metrics.refreshing && "opacity-60",
          )}
        >
          <TimePanel metrics={data} admin={operator.role === "admin"} />
          <CasesPanel metrics={data} report={report} />
          <DailyChart daily={data.daily} className="lg:col-span-2" />
          <WhoPanel metrics={data} />
        </div>
      )}
    </PageContainer>
  );
}

/** The final layout with grey bars where the figures go: nothing moves when the data lands. */
function MetricsSkeleton() {
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-3">
      <p role="status" className="sr-only">
        Caricamento metriche
      </p>
      <div className={cn(PANEL, "p-5 lg:col-span-2")}>
        <PanelTitle>Tempo per pratica</PanelTitle>
        <Skeleton className="mt-4 h-[1.875rem] w-40" />
        <Skeleton className="mt-3 h-4 w-72" />
        <div className="mt-6 grid gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-5" />
          ))}
        </div>
      </div>
      <div className={cn(PANEL, "p-5")}>
        <PanelTitle>Pratiche nel periodo</PanelTitle>
        <div className="mt-4 grid gap-6">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      </div>
      <Skeleton className="h-96 rounded-md lg:col-span-2" />
      <Skeleton className="h-96 rounded-md" />
    </div>
  );
}

/**
 * The screen's answer: how long a case takes the desk now, against what the CAF declared it
 * took before. The saving is the difference of the two figures as shown, so they always agree.
 */
function TimePanel({ metrics, admin }: { metrics: Metrics; admin: boolean }) {
  const review = metrics.avgReviewMinutes === null ? null : Math.round(metrics.avgReviewMinutes);
  const baseline =
    metrics.baselineMinutesPerCase === null ? null : Math.round(metrics.baselineMinutesPerCase);
  const saved = review !== null && baseline !== null ? baseline - review : null;

  let headline: ReactNode;
  let subline: ReactNode;
  if (saved !== null && saved > 0) {
    headline = <span className="text-ok">−{formatMinutes(saved)}</span>;
    subline = "per pratica allo sportello, rispetto a prima di Avanti";
  } else if (saved !== null) {
    headline = formatMinutes(review);
    subline = "di revisione per pratica: per ora non meno di prima di Avanti";
  } else if (review !== null) {
    headline = formatMinutes(review);
    subline = "di revisione per pratica, in media";
  } else {
    headline = "—";
    subline = "Nessuna revisione conclusa nel periodo";
  }

  const rows = [
    { label: "Revisione dell'operatore", value: review, bar: "bg-stamp", strong: true },
    { label: "Prima di Avanti (dichiarato)", value: baseline, bar: "bg-ink-3", strong: false },
    {
      label: "Compilazione del cittadino",
      value: metrics.avgCitizenMinutes === null ? null : Math.round(metrics.avgCitizenMinutes),
      bar: "bg-line-strong",
      strong: false,
    },
  ];
  const max = Math.max(1, ...rows.map((row) => row.value ?? 0));

  return (
    <section aria-labelledby="time-title" className={cn(PANEL, "flex flex-col p-5 lg:col-span-2")}>
      <PanelTitle id="time-title">Tempo per pratica</PanelTitle>
      <p className="tabular mt-4 text-[1.875rem] leading-none font-semibold">{headline}</p>
      <p className="mt-2 text-sm text-ink-2">{subline}</p>
      <ul className="my-4 grid min-h-32 flex-1 content-evenly gap-y-3">
        {rows.map((row) => (
          <li
            key={row.label}
            className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-x-4 gap-y-1.5 sm:grid-cols-[13rem_minmax(0,1fr)_4.5rem]"
          >
            <span className={cn("text-sm", row.strong ? "font-semibold text-ink" : "text-ink-2")}>
              {row.label}
            </span>
            <span
              aria-hidden
              className="col-span-2 row-start-2 h-2 overflow-hidden rounded-full bg-sunk sm:col-span-1 sm:col-start-2 sm:row-start-1"
            >
              {row.value !== null && (
                <span
                  className={cn("block h-full origin-left rounded-full", row.bar)}
                  style={{ transform: `scaleX(${row.value / max})` }}
                />
              )}
            </span>
            <span
              className={cn(
                "tabular text-end text-sm",
                row.value === null ? "text-ink-3" : "font-semibold text-ink",
              )}
            >
              {formatMinutes(row.value)}
            </span>
          </li>
        ))}
      </ul>
      {baseline === null ? (
        <p className="mt-auto border-t border-line pt-4 text-[0.8125rem] text-ink-3">
          Senza i minuti per pratica di prima non si calcola il risparmio.{" "}
          {admin ? (
            <Link
              href="/console/impostazioni#baseline"
              className="font-semibold text-stamp hover:underline"
            >
              Scrivi i minuti per pratica
            </Link>
          ) : (
            "Li imposta un amministratore del CAF."
          )}
        </p>
      ) : (
        <p className="mt-auto border-t border-line pt-4 text-[0.8125rem] text-ink-3">
          Medie delle pratiche del periodo. «Prima di Avanti» sono i minuti dichiarati dal CAF{" "}
          {admin ? (
            <Link
              href="/console/impostazioni#baseline"
              className="font-semibold text-stamp hover:underline"
            >
              nelle impostazioni
            </Link>
          ) : (
            "nelle impostazioni"
          )}
          , non misurati.
        </p>
      )}
    </section>
  );
}

/** Four counts of the period as key-value rows: what is counted on the left, the figure right. */
function CasesPanel({ metrics, report }: { metrics: Metrics; report: ReactNode }) {
  const rows = [
    {
      label: "Avviate",
      note: "Create nel periodo, anche se abbandonate",
      value: numbers.format(metrics.casesStarted),
    },
    {
      label: "Inviate allo sportello",
      note: "Primo invio del cittadino",
      value: numbers.format(metrics.casesSubmitted),
    },
    {
      label: "Complete al primo invio",
      note: "Senza problemi bloccanti all'arrivo",
      value: percent(metrics.completeAtFirstSubmission),
    },
    {
      label: "Richieste di integrazione",
      note: "Rimandate al cittadino almeno una volta",
      value: percent(metrics.needsCitizenRate),
    },
  ];
  return (
    <section aria-labelledby="cases-title" className={cn(PANEL, "flex flex-col p-5")}>
      <PanelTitle id="cases-title">Pratiche nel periodo</PanelTitle>
      <dl className="mt-1 flex-1 divide-y divide-line">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 py-3">
            {/* The note belongs to the term: a <dd> inside a <div> of its own breaks the list. */}
            <dt className="min-w-0">
              <span className="block text-sm font-semibold text-ink">{row.label}</span>
              <span className="block text-[0.8125rem] leading-snug text-ink-3">{row.note}</span>
            </dt>
            <dd
              className={cn(
                "tabular shrink-0 text-2xl leading-none font-semibold",
                row.value === "—" && "text-base text-ink-3",
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      {/* The same counts differ on purpose in the report: say so where the counts are. */}
      <p className="mt-2 border-t border-line pt-4 text-[0.8125rem] leading-snug text-ink-3">
        Il {report}, da condividere, nasconde i gruppi sotto 5 pratiche: lì gli stessi dati possono
        comparire come «—».
      </p>
    </section>
  );
}

/** Kinds of practice and the citizens' languages: who used Avanti in the period. */
function WhoPanel({ metrics }: { metrics: Metrics }) {
  return (
    <section aria-labelledby="who-title" className={cn(PANEL, "p-5")}>
      <PanelTitle id="who-title">Per pratica e lingua</PanelTitle>
      <Breakdown
        title="Tipo di pratica"
        rows={metrics.byPractice.map((row) => ({
          key: row.practiceId,
          label: PRACTICE_SHORT[row.practiceId],
          value: row.count,
        }))}
      />
      <Breakdown
        title="Lingua del cittadino"
        rows={metrics.byLanguage.map((row) => ({
          key: row.language,
          label: LANGUAGE_IT[row.language],
          value: row.count,
        }))}
      />
    </section>
  );
}

const LIST_CAP = 5;

function Breakdown({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; label: string; value: number }[];
}) {
  const all = [...rows].sort((a, b) => b.value - a.value);
  // Five rows and the rest summed in one, so the panel stays level with the chart beside it.
  const rest = all.slice(LIST_CAP);
  const sorted =
    rest.length > 1
      ? [
          ...all.slice(0, LIST_CAP),
          {
            key: "rest",
            label: `Altre ${rest.length}: ${rest.map((r) => r.label.toLowerCase()).join(", ")}`,
            value: rest.reduce((sum, r) => sum + r.value, 0),
          },
        ]
      : all;
  const max = Math.max(1, ...all.map((r) => r.value));
  return (
    <div className="mt-4">
      <h3 className="text-[0.8125rem] text-ink-3">{title}</h3>
      {sorted.length === 0 ? (
        <p className="mt-2 text-sm text-ink-3">Nessuna pratica nel periodo.</p>
      ) : (
        <ul className="mt-1.5 grid">
          {sorted.map((row, i) => (
            <li key={row.key} className="grid gap-1.5 py-1.5">
              <span className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate text-ink-2" title={row.label}>
                  {row.label}
                </span>
                <span className="tabular font-semibold">{numbers.format(row.value)}</span>
              </span>
              {/* Thin and grey, the top one in ink: «most first» is seen, not only read. */}
              <span aria-hidden className="h-0.5">
                {row.key !== "rest" && (
                  <span
                    className={cn(
                      "block h-full origin-left rounded-full",
                      i === 0 ? "bg-ink" : "bg-line-strong",
                    )}
                    style={{ transform: `scaleX(${Math.min(1, row.value / max)})` }}
                  />
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
