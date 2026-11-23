"use client";

import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Download,
  FileText,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import {
  Suspense,
  useMemo,
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type { PilotCount, PilotReport, PilotReportGroup, PilotThreshold } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { PageContainer, PageHeader, SectionHeader } from "@/components/ui/page-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, formatMinutes, LANGUAGE_IT, PRACTICE_SHORT } from "@/lib/console/labels";
import { useOperator } from "@/lib/console/operator-context";
import { useDownload } from "@/lib/console/use-download";
import { useResource } from "@/lib/console/use-resource";
import { cn } from "@/lib/cn";
import { NearReadyPilot } from "@/components/console/near-ready-pilot";
import { PANEL, PanelTitle } from "@/components/console/admin/panel";

// Calendar days in Italian time, as the report counts them.
const romeDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" });
const isoDay = (date: Date) => romeDay.format(date);
const shiftMonths = (day: string, months: number) => {
  const [y, m] = day.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + months, 1));
  return d.toISOString().slice(0, 10);
};
const lastDayOf = (firstDay: string) => {
  const d = new Date(`${shiftMonths(firstDay, 1)}T00:00:00Z`);
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
};

function presets(today: string) {
  const thisMonth = `${today.slice(0, 7)}-01`;
  const lastMonth = shiftMonths(thisMonth, -1);
  const ninety = isoDay(new Date(Date.parse(`${today}T12:00:00Z`) - 89 * 86_400_000));
  return [
    { key: "90", label: "Ultimi 90 giorni", from: ninety, to: today },
    { key: "mese", label: "Questo mese", from: thisMonth, to: today },
    { key: "scorso", label: "Mese scorso", from: lastMonth, to: lastDayOf(lastMonth) },
  ];
}

const numbers = new Intl.NumberFormat("it-IT");
const count = (value: PilotCount) =>
  value === null ? "—" : typeof value === "number" ? numbers.format(value) : value;

const longDay = (day: string) =>
  new Intl.DateTimeFormat("it-IT", { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`),
  );

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
/** The API's own rule, checked before asking: start before end, at most one year. */
function periodError(from: string, to: string) {
  if (!ISO_DAY.test(from) || !ISO_DAY.test(to)) return "Scegli le due date del periodo.";
  if (from > to) return "La data di inizio viene dopo quella di fine.";
  const [y, m, d] = from.split("-");
  if (to >= `${Number(y) + 1}-${m}-${d}`) return "Il periodo può durare al massimo un anno.";
  return null;
}
const percent = (share: number | null) => (share === null ? "—" : `${Math.round(share * 100)}%`);

const THRESHOLD: Record<PilotThreshold["id"], { title: string; target: string }> = {
  net_minutes_saved: {
    title: "Tempo risparmiato",
    target: "Almeno 5 minuti netti in meno per pratica",
  },
  completeness_gain_pp: {
    title: "Pratiche complete",
    target: "Almeno 15 punti in più di pratiche complete al primo appuntamento",
  },
  delivery_rate: {
    title: "Pratiche che arrivano allo sportello",
    target: "Almeno il 70% delle pratiche avviate viene inviata",
  },
};

const OUTCOME: Record<
  PilotThreshold["outcome"],
  { label: string; icon: typeof CheckCircle2; tone: string }
> = {
  raggiunta: { label: "Raggiunta", icon: CheckCircle2, tone: "text-ok" },
  non_raggiunta: { label: "Non raggiunta", icon: XCircle, tone: "text-danger" },
  dati_insufficienti: { label: "Dati insufficienti", icon: CircleDashed, tone: "text-ink-3" },
};

// The API explains each outcome for the record; here the same facts in the manager's words.
function explanation(threshold: PilotThreshold) {
  if (threshold.outcome !== "dati_insufficienti") {
    return threshold.id === "delivery_rate"
      ? "Misurato sulle pratiche avviate nel periodo. È un risultato operativo: non dimostra da solo che il merito sia di Avanti."
      : threshold.reason;
  }
  switch (threshold.id) {
    case "net_minutes_saved":
      return "Si misura con il cronometro durante il pilota. Avanti registra tempi di calendario, che comprendono pause e attese.";
    case "completeness_gain_pp":
      return "Serve il confronto con le pratiche complete al primo appuntamento prima di Avanti, verificate dall'operatore.";
    case "delivery_rate":
      return "Servono almeno 50 pratiche avviate e un periodo già concluso.";
  }
}

function observed(threshold: PilotThreshold) {
  if (threshold.observed === null) return null;
  if (threshold.unit === "ratio") return percent(threshold.observed);
  if (threshold.unit === "minutes") return formatMinutes(threshold.observed);
  return `${threshold.observed > 0 ? "+" : ""}${Math.round(threshold.observed)} punti`;
}

export default function PilotReportPage() {
  const operator = useOperator();
  if (operator.role !== "admin") {
    return (
      <PageContainer width="3xl" centered className="py-16 text-center lg:py-16">
        <h1 className="font-display text-2xl font-semibold">Rapporto riservato</h1>
        <p className="mt-2 text-ink-2">Il rapporto del pilota lo prepara un amministratore.</p>
      </PageContainer>
    );
  }
  return (
    <Suspense>
      <ReportView />
    </Suspense>
  );
}

function ReportView() {
  const operator = useOperator();
  const router = useRouter();
  const params = useSearchParams();
  const today = isoDay(new Date());
  const choices = useMemo(() => presets(today), [today]);
  // The period lives in the URL, like the queue filters: a report can be linked and reloaded.
  // A hand-edited or outdated link with an impossible period opens the default one instead of
  // waiting forever for a report that is never requested.
  const linked = { from: params.get("dal") ?? "", to: params.get("al") ?? "" };
  const { from, to } = periodError(linked.from, linked.to) ? choices[0]! : linked;
  const linkedOffice = params.get("sportello") ?? "";
  const officeId = operator.offices.some((office) => office.id === linkedOffice)
    ? linkedOffice
    : "";
  const apply = (next: Record<string, string>) => {
    const search = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next))
      if (value) search.set(key, value);
      else search.delete(key);
    router.replace(`/console/rapporto?${search.toString()}` as Route, { scroll: false });
  };
  // Typed dates are drafts until the field is left or Enter is pressed: every keystroke in a
  // year field is a valid date, and each request is audited and counts toward the export limit.
  const [draft, setDraft] = useState<{ from: string; to: string } | null>(null);
  const shown = draft ?? { from, to };
  const commit = () => {
    if (!draft) return;
    if (!periodError(draft.from, draft.to)) apply({ dal: draft.from, al: draft.to });
    else return;
    setDraft(null);
  };
  const onDateKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    }
  };
  const invalid = periodError(shown.from, shown.to);
  const validApplied = !periodError(from, to);

  const query = useMemo(() => {
    const q = new URLSearchParams({ from, to });
    if (officeId) q.set("office", officeId);
    return q.toString();
  }, [from, to, officeId]);
  const report = useResource<PilotReport>(validApplied ? `/api/reports/pilot?${query}` : null);
  const data = report.data;
  const active = choices.find((c) => c.from === from && c.to === to)?.key;
  // Metrics counts the same thing over its own windows (7, 30 or 90 days ending today).
  const metricsQuery = new URLSearchParams();
  if (active === "90") metricsQuery.set("giorni", "90");
  if (officeId) metricsQuery.set("sportello", officeId);
  const metricsHref = `/console/metriche${metricsQuery.size ? `?${metricsQuery}` : ""}` as Route;
  const downloadable = validApplied && !draft;
  const files = useDownload();
  const [saveError, setSaveError] = useState<string | null>(null);
  const save = async (format: "pdf" | "csv") => {
    setSaveError(null);
    const failed = await files.download(
      `/api/reports/pilot?${query}&format=${format}`,
      `rapporto-pilota.${format}`,
    );
    if (failed) setSaveError(`Download non riuscito. ${failed}`);
  };

  const actions = (
    <>
      <Button
        variant="secondary"
        size="sm"
        disabled={!downloadable}
        loading={downloadable && files.pending?.endsWith("format=pdf")}
        onClick={() => void save("pdf")}
      >
        <FileText className="size-4" aria-hidden />
        Scarica PDF
      </Button>
      <Button
        variant="secondary"
        size="sm"
        disabled={!downloadable}
        loading={downloadable && files.pending?.endsWith("format=csv")}
        onClick={() => void save("csv")}
      >
        <Download className="size-4" aria-hidden />
        Scarica CSV
      </Button>
    </>
  );

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Rapporto del pilota"
        lead="Numeri aggregati da condividere con chi decide, senza dati dei cittadini."
        actions={actions}
      />

      {/* One row of 32 px controls: the period first, then the office. */}
      <form
        className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2"
        onSubmit={(e) => e.preventDefault()}
      >
        <SegmentedControl
          label="Periodi frequenti"
          value={active ?? ""}
          options={choices.map((choice) => ({ value: choice.key, label: choice.label }))}
          onChange={(key) => {
            const choice = choices.find((c) => c.key === key);
            if (!choice) return;
            setDraft(null);
            apply({ dal: choice.from, al: choice.to });
          }}
        />
        <span className="flex items-center gap-2">
          <DateField
            label="Dal"
            value={shown.from}
            max={shown.to || undefined}
            onChange={(e) => setDraft({ ...shown, from: e.target.value })}
            onBlur={commit}
            onKeyDown={onDateKey}
            aria-invalid={draft && invalid ? true : undefined}
            aria-describedby={draft && invalid ? "period-error" : undefined}
          />
          <DateField
            label="Al"
            value={shown.to}
            min={shown.from || undefined}
            onChange={(e) => setDraft({ ...shown, to: e.target.value })}
            onBlur={commit}
            onKeyDown={onDateKey}
            aria-invalid={draft && invalid ? true : undefined}
            aria-describedby={draft && invalid ? "period-error" : undefined}
          />
        </span>
        {operator.offices.length > 1 && (
          <Select
            value={officeId}
            aria-label="Sportello"
            onChange={(e) => apply({ sportello: e.target.value })}
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
      </form>
      {saveError && (
        <Notice
          tone="danger"
          className="mt-3"
          onDismiss={() => setSaveError(null)}
          dismissLabel="Chiudi avviso"
        >
          {saveError}
        </Notice>
      )}
      {draft && invalid && (
        <Notice tone="danger" id="period-error" className="mt-3">
          {invalid}
        </Notice>
      )}

      {report.status === "error" && !data ? (
        <Notice
          tone="danger"
          size="page"
          className="mt-6"
          title="Rapporto non disponibile."
          action={
            <Button variant="secondary" onClick={() => void report.reload()}>
              Riprova
            </Button>
          }
        >
          {report.error.message}
        </Notice>
      ) : !data ? (
        <div className="mt-6 grid gap-8" aria-hidden>
          <p role="status" className="sr-only">
            Preparazione del rapporto
          </p>
          <Skeleton className="h-72 rounded-md" />
          <Skeleton className="h-48 rounded-md" />
        </div>
      ) : (
        <div
          aria-busy={report.refreshing || undefined}
          className={cn(
            "mt-6 grid gap-8 transition-opacity duration-150",
            report.refreshing && "opacity-60",
          )}
        >
          <p role="status" className="sr-only">
            {report.refreshing
              ? ""
              : `Rapporto dal ${longDay(data.period.from)} al ${longDay(data.period.to)}.`}
          </p>
          {report.status === "error" && (
            <Notice tone="danger">
              {report.error.message} Sotto resta il rapporto precedente.
            </Notice>
          )}
          <Thresholds group={data.total} report={data} />
          <Totals group={data.total} report={data} metricsHref={metricsHref} />
          {data.offices.length > 1 && !officeId && <Offices offices={data.offices} />}
          <Who group={data.total} />
          <details className={cn(PANEL, "group")}>
            <summary className="flex cursor-pointer list-none items-center gap-3 rounded-md px-5 py-4 text-base font-semibold focus-visible:ring-2 focus-visible:ring-stamp focus-visible:outline-none [&::-webkit-details-marker]:hidden">
              <span className="flex-1">Come contiamo</span>
              <ChevronDown
                className="size-4 shrink-0 text-ink-3 transition-transform duration-150 group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <ul className="grid list-disc gap-2 px-5 ps-10 pb-5 text-sm text-ink-2">
              {data.method.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </details>
          <p className="-mt-4 text-[0.8125rem] text-ink-3">
            Generato il <span className="tabular">{formatDateTime(data.generatedAt)}</span>. Ogni
            apertura e ogni download finiscono nel{" "}
            <Link href="/console/registro" className="text-stamp underline underline-offset-2">
              registro attività
            </Link>
            .
          </p>
        </div>
      )}
      <div className="mt-8">
        <NearReadyPilot />
      </div>
    </PageContainer>
  );
}

/**
 * The native date input (keyboard, screen readers and the phone's own picker come with it),
 * with the calendar icon of the rest of the console in place of the browser's.
 */
function DateField({ label, ...props }: { label: string } & Omit<ComponentProps<"input">, "type">) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink-2">
      <span>{label}</span>
      <span className="relative block">
        <Input
          type="date"
          {...props}
          className={cn(
            "tabular h-8 w-[9.5rem] pe-8 text-sm",
            "[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-y-0 [&::-webkit-calendar-picker-indicator]:end-0 [&::-webkit-calendar-picker-indicator]:w-8 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0",
          )}
        />
        <CalendarDays
          className="pointer-events-none absolute end-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3"
          aria-hidden
        />
      </span>
    </label>
  );
}

/** The sample against the protocol's minimum, as a bar at its true ratio with both ends named. */
function SampleBar({ threshold }: { threshold: PilotThreshold }) {
  const sample = threshold.sample;
  const min = threshold.minimumSample;
  if (typeof sample !== "number") {
    return (
      <p className="text-[0.8125rem] text-ink-3">
        {sample === "<5" ? "Campione: meno di 5" : "Campione nascosto"}; minimo{" "}
        <span className="tabular">{min}</span>
      </p>
    );
  }
  const ratio = Math.min(1, sample / min);
  return (
    <div>
      <p className="flex justify-between text-[0.8125rem] text-ink-3">
        <span>
          Campione <span className="tabular font-semibold text-ink">{sample}</span>
        </span>
        <span className="tabular">minimo {min}</span>
      </p>
      <span aria-hidden className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-sunk">
        <span
          className={cn(
            "block h-full origin-left rounded-full",
            ratio >= 1 ? "bg-ink-3" : "bg-line-strong",
          )}
          style={{ transform: `scaleX(${ratio})` }}
        />
      </span>
    </div>
  );
}

/**
 * The screen's answer: one panel, the three thresholds side by side, each with its outcome as
 * the largest line, what it measured and how much of the required sample there is.
 */
function Thresholds({ group, report }: { group: PilotReportGroup; report: PilotReport }) {
  const reached = group.thresholds.filter((t) => t.outcome === "raggiunta").length;
  const decided = group.thresholds.filter((t) => t.outcome !== "dati_insufficienti").length;
  const open = report.period.observedUntilExclusive < report.period.endExclusive;
  const finding =
    decided === 0
      ? `Nessuna soglia ha ancora un esito: servono almeno ${Math.max(...group.thresholds.map((t) => t.minimumSample))} pratiche${open ? " e un periodo concluso" : ""}.`
      : `${reached} ${reached === 1 ? "soglia raggiunta" : "soglie raggiunte"} su ${group.thresholds.length}.`;
  return (
    <section aria-labelledby="thresholds-title" className={PANEL}>
      <div className="border-b border-line px-5 py-4">
        <h2 id="thresholds-title" className="text-lg font-semibold">
          Le tre soglie del pilota
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          {finding} Decise prima di iniziare: dicono se ha senso proseguire.
        </p>
      </div>
      <ul className="grid divide-y divide-line md:grid-cols-3 md:divide-x md:divide-y-0">
        {group.thresholds.map((threshold) => {
          const outcome = OUTCOME[threshold.outcome];
          const copy = THRESHOLD[threshold.id];
          const value = observed(threshold);
          return (
            <li key={threshold.id} className="flex flex-col gap-3 p-5">
              <div>
                <h3 className="text-sm font-semibold">{copy.title}</h3>
                <p className="mt-0.5 text-[0.8125rem] leading-snug text-ink-3">{copy.target}</p>
              </div>
              <p className="flex items-center gap-2">
                <outcome.icon className={cn("size-5 shrink-0", outcome.tone)} aria-hidden />
                <span className={cn("text-xl leading-tight font-semibold", outcome.tone)}>
                  {outcome.label}
                </span>
                {value && <span className="tabular text-xl font-semibold text-ink">{value}</span>}
              </p>
              <p className="text-[0.8125rem] leading-snug text-ink-2">{explanation(threshold)}</p>
              <div className="mt-auto pt-1">
                <SampleBar threshold={threshold} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Totals({
  group,
  report,
  metricsHref,
}: {
  group: PilotReportGroup;
  report: PilotReport;
  metricsHref: Route;
}) {
  const [toSubmission, review] = group.times;
  const baseline = report.baseline.manualMinutesPerCase;
  // The API hides a total when another figure of the period is under 5: showing it would let
  // the reader subtract the hidden one (see «Come contiamo»). It is not a missing measurement.
  const hidden = group.starts === null || group.deliveries === null;
  const why = "Nascosto: un dato del periodo ha meno di 5 pratiche";
  return (
    <section aria-labelledby="totals-title" className="grid gap-4">
      <SectionHeader
        id="totals-title"
        title="Cosa è successo nel periodo"
        lead={`Dal ${longDay(report.period.from)} al ${longDay(report.period.to)}${
          report.period.observedUntilExclusive < report.period.endExclusive
            ? ", fino a oggi: il periodo non è ancora concluso"
            : ""
        }.`}
      />
      <div className={PANEL}>
        <dl className="grid grid-cols-2 lg:grid-cols-4 [&>*]:border-line lg:[&>*+*]:border-s max-lg:[&>*:nth-child(even)]:border-s max-lg:[&>*:nth-child(n+3)]:border-t">
          <Tile
            label="Pratiche avviate"
            value={count(group.starts)}
            note={group.starts === null ? why : "Create nel periodo"}
          />
          <Tile
            label="Inviate allo sportello"
            value={count(group.deliveries)}
            note={
              group.deliveries === null
                ? why
                : group.deliveryRate.value === null
                  ? "Percentuale non calcolabile: troppo poche pratiche"
                  : `${percent(group.deliveryRate.value)} delle avviate`
            }
          />
          <Tile
            label="Complete all'invio"
            value={percent(group.completeness.value)}
            note={
              group.completeness.value === null
                ? hidden
                  ? why
                  : "Servono almeno 5 invii con il dato registrato"
                : "Senza problemi bloccanti segnalati da Avanti"
            }
          />
          <Tile
            label="Richieste di integrazione"
            value={count(group.integrations.requests)}
            note={
              group.integrations.requests === null
                ? why
                : `Su ${count(group.integrations.cases)} ${group.integrations.cases === 1 ? "pratica" : "pratiche"}`
            }
          />
        </dl>
        <dl className="grid divide-line border-t border-line max-sm:divide-y sm:grid-cols-3 sm:divide-x">
          <Tile
            label="Dalla creazione al primo invio"
            value={formatMinutes(toSubmission?.value ?? null)}
            note={
              toSubmission?.value == null
                ? "Nascosto: servono almeno 5 pratiche misurabili"
                : "Media, comprese pause e attese del cittadino"
            }
          />
          <Tile
            label="Revisione allo sportello"
            value={formatMinutes(review?.value ?? null)}
            note={
              review?.value == null
                ? "Nascosto: servono almeno 5 revisioni registrate"
                : "Media, comprese pause"
            }
          />
          <Tile
            label="Prima di Avanti (dichiarato)"
            value={baseline === null ? "—" : formatMinutes(baseline)}
            note={
              baseline === null ? (
                <>
                  Non impostato:{" "}
                  <Link
                    href="/console/impostazioni#baseline"
                    className="text-stamp underline underline-offset-2"
                  >
                    aggiungilo nelle impostazioni
                  </Link>
                </>
              ) : (
                "Minuti per pratica stimati dal CAF, non misurati"
              )
            }
          />
        </dl>
      </div>
      <p className="-mt-1 max-w-3xl text-[0.8125rem] leading-snug text-ink-3">
        {hidden && (
          <>
            I totali restano nascosti perché insieme al dettaglio permetterebbero di ricavare il
            gruppo piccolo; il conteggio esatto, per uso interno, è in{" "}
            <Link
              href={metricsHref}
              className="font-semibold text-stamp underline underline-offset-2"
            >
              Metriche
            </Link>
            .{" "}
          </>
        )}
        «&lt;5» vuol dire meno di 5 pratiche. I tempi sono di calendario: non si confrontano con i
        minuti di lavoro, il risparmio netto si misura con il cronometro durante il pilota.
      </p>
    </section>
  );
}

function Offices({ offices }: { offices: PilotReportGroup[] }) {
  const th = "h-9 px-4 text-[0.8125rem] font-medium whitespace-nowrap text-ink-3";
  return (
    <section aria-labelledby="offices-title" className="grid gap-4">
      <SectionHeader id="offices-title" title="Per sportello" />
      {/* On a phone each office is a two-line row: the name, then every figure in words. */}
      <ul className={cn(PANEL, "divide-y divide-line px-4 sm:hidden")}>
        {offices.map((group) => (
          <li key={group.office?.id ?? "none"} className="py-3">
            <p className="text-sm font-semibold">{group.office?.name ?? "Senza sportello"}</p>
            <p className="tabular mt-0.5 text-[0.8125rem] text-ink-3">
              Avviate {count(group.starts)} · Inviate {count(group.deliveries)} · Complete{" "}
              {percent(group.completeness.value)} · Integrazioni{" "}
              {count(group.integrations.requests)}
            </p>
          </li>
        ))}
      </ul>
      <div className={cn(PANEL, "overflow-x-auto max-sm:hidden")}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className={cn(th, "w-2/5 text-start")}>
                Sportello
              </th>
              <th scope="col" className={cn(th, "text-end")}>
                Avviate
              </th>
              <th scope="col" className={cn(th, "text-end")}>
                Inviate
              </th>
              <th scope="col" className={cn(th, "text-end")}>
                Complete all&apos;invio
              </th>
              <th scope="col" className={cn(th, "text-end")}>
                Integrazioni
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {offices.map((group) => (
              <tr key={group.office?.id ?? "none"} className="h-11">
                <th scope="row" className="px-4 text-start font-semibold">
                  {group.office?.name ?? "Senza sportello"}
                </th>
                <Cell value={count(group.starts)} />
                <td className="tabular px-4 text-end">
                  <CellValue value={count(group.deliveries)} />
                  {group.deliveryRate.value !== null && (
                    <span className="ms-1 text-ink-3">({percent(group.deliveryRate.value)})</span>
                  )}
                </td>
                <Cell value={percent(group.completeness.value)} />
                <Cell value={count(group.integrations.requests)} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="-mt-1 text-[0.8125rem] text-ink-3">
        «—» in una cella: lo sportello ha meno di 5 pratiche, o mostrarla permetterebbe di ricavare
        il dato di un altro.
      </p>
    </section>
  );
}

/** A hidden or missing value is a small grey dash, never a figure-sized one. */
function CellValue({ value }: { value: string }) {
  return value === "—" ? <span className="text-ink-3">—</span> : <>{value}</>;
}

function Cell({ value }: { value: string }) {
  return (
    <td className="tabular px-4 text-end">
      <CellValue value={value} />
    </td>
  );
}

/** Languages and kinds of practice in one panel: the long list in two columns, no half-empty card. */
function Who({ group }: { group: PilotReportGroup }) {
  return (
    <section aria-labelledby="who-title" className={cn(PANEL, "p-5")}>
      <PanelTitle id="who-title">Chi ha usato Avanti</PanelTitle>
      <div className="mt-3 grid gap-x-10 gap-y-6 lg:grid-cols-3">
        <Distribution
          title="Lingue usate dai cittadini"
          className="lg:col-span-2"
          columns
          rows={group.byLanguage.map((r) => ({
            key: r.language,
            label: LANGUAGE_IT[r.language],
            count: r.count,
          }))}
        />
        <Distribution
          title="Tipi di pratica"
          rows={group.byPractice.map((r) => ({
            key: r.practiceId ?? "none",
            label: r.practiceId ? PRACTICE_SHORT[r.practiceId] : "Non ancora classificata",
            count: r.count,
          }))}
        />
      </div>
    </section>
  );
}

function Distribution({
  title,
  rows,
  columns = false,
  className,
}: {
  title: string;
  rows: { key: string; label: string; count: PilotCount }[];
  columns?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <h3 className="text-[0.8125rem] text-ink-3">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-ink-3">Nessuna pratica nel periodo.</p>
      ) : (
        <dl className={cn("mt-1 text-sm", columns && "gap-x-10 sm:columns-2")}>
          {rows.map((row) => (
            <div
              key={row.key}
              className="flex h-9 break-inside-avoid items-center justify-between gap-3 border-b border-line"
            >
              <dt className="truncate text-ink-2">{row.label}</dt>
              <dd className="tabular font-semibold">
                <CellValue value={count(row.count)} />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: ReactNode }) {
  return (
    <div className="px-4 py-4 sm:px-5">
      <dt className="text-[0.8125rem] text-ink-3">{label}</dt>
      <dd
        className={cn(
          "tabular mt-1 text-2xl leading-tight font-semibold",
          value === "—" && "text-base leading-[1.875rem] text-ink-3",
        )}
      >
        {value}
      </dd>
      {note && <dd className="mt-1 text-[0.8125rem] leading-snug text-ink-3">{note}</dd>}
    </div>
  );
}
