"use client";

import { CheckCircle2, CircleDashed, Download, FileText, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { Suspense, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import type { PilotCount, PilotReport, PilotReportGroup, PilotThreshold } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { PageContainer, PageHeader, SectionHeader } from "@/components/ui/page-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, formatMinutes, LANGUAGE_IT, PRACTICE_SHORT } from "@/lib/console/labels";
import { useOperator } from "@/lib/console/operator-context";
import { useResource } from "@/lib/console/use-resource";
import { cn } from "@/lib/cn";
import { NearReadyPilot } from "@/components/console/near-ready-pilot";

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
      <PageContainer width="3xl" className="py-16 text-center lg:py-16">
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
  const from = params.get("dal") ?? choices[0]!.from;
  const to = params.get("al") ?? choices[0]!.to;
  const officeId = params.get("sportello") ?? "";
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
  const downloadable = validApplied && !draft;

  return (
    <PageContainer width="6xl">
      <PageHeader
        title="Rapporto del pilota"
        lead={
          <>
            Numeri aggregati da condividere con chi decide. Nessun dato dei cittadini: i gruppi con
            meno di 5 pratiche compaiono come «&lt;5».
          </>
        }
        actions={
          downloadable ? (
            <>
              <Button variant="secondary" asChild>
                <a href={`/api/reports/pilot?${query}&format=pdf`} download>
                  <FileText className="size-4" aria-hidden />
                  Scarica PDF
                </a>
              </Button>
              <Button variant="secondary" asChild>
                <a href={`/api/reports/pilot?${query}&format=csv`} download>
                  <Download className="size-4" aria-hidden />
                  Scarica CSV
                </a>
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" disabled>
                <FileText className="size-4" aria-hidden />
                Scarica PDF
              </Button>
              <Button variant="secondary" disabled>
                <Download className="size-4" aria-hidden />
                Scarica CSV
              </Button>
            </>
          )
        }
      />

      <form
        className="mt-6 flex flex-wrap items-end gap-3 rounded-lg bg-surface p-4 ring-1 ring-line"
        onSubmit={(e) => e.preventDefault()}
      >
        <SegmentedControl
          label="Periodi frequenti"
          size="md"
          value={active ?? ""}
          options={choices.map((choice) => ({ value: choice.key, label: choice.label }))}
          onChange={(key) => {
            const choice = choices.find((c) => c.key === key);
            if (!choice) return;
            setDraft(null);
            apply({ dal: choice.from, al: choice.to });
          }}
        />
        <label className="grid gap-1 text-sm">
          <span className="text-ink-2">Dal</span>
          <Input
            type="date"
            value={shown.from}
            max={shown.to || undefined}
            onChange={(e) => setDraft({ ...shown, from: e.target.value })}
            onBlur={commit}
            onKeyDown={onDateKey}
            aria-invalid={draft && invalid ? true : undefined}
            aria-describedby={draft && invalid ? "period-error" : undefined}
            className="h-9 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-ink-2">Al</span>
          <Input
            type="date"
            value={shown.to}
            min={shown.from || undefined}
            onChange={(e) => setDraft({ ...shown, to: e.target.value })}
            onBlur={commit}
            onKeyDown={onDateKey}
            aria-invalid={draft && invalid ? true : undefined}
            aria-describedby={draft && invalid ? "period-error" : undefined}
            className="h-9 text-sm"
          />
        </label>
        {operator.offices.length > 1 && (
          <label className="grid gap-1 text-sm">
            <span className="text-ink-2">Sportello</span>
            <Select
              value={officeId}
              onChange={(e) => apply({ sportello: e.target.value })}
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
          </label>
        )}
      </form>
      {draft && invalid && (
        <Notice tone="danger" id="period-error" className="mt-2">
          {invalid}
        </Notice>
      )}
      <p className="mt-2 text-sm text-ink-3">
        «—» indica un dato non ancora misurabile o nascosto perché, insieme agli altri, renderebbe
        riconoscibili poche persone.
      </p>

      {report.status === "error" && !data ? (
        <Notice
          tone="danger"
          size="page"
          className="mt-8"
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
        <div className="mt-8 grid gap-10">
          <p role="status" className="sr-only">
            Preparazione del rapporto
          </p>
          <Skeleton className="h-56 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      ) : (
        <div
          aria-busy={report.refreshing || undefined}
          className={cn("mt-8 grid gap-10 transition-opacity", report.refreshing && "opacity-60")}
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
          <Thresholds group={data.total} />
          <Totals group={data.total} report={data} />
          {data.offices.length > 1 && !officeId && <Offices offices={data.offices} />}
          <div className="grid gap-6 md:grid-cols-2">
            <Distribution
              title="Lingue usate dai cittadini"
              rows={data.total.byLanguage.map((r) => ({
                key: r.language,
                label: LANGUAGE_IT[r.language],
                count: r.count,
              }))}
            />
            <Distribution
              title="Tipi di pratica"
              rows={data.total.byPractice.map((r) => ({
                key: r.practiceId ?? "none",
                label: r.practiceId ? PRACTICE_SHORT[r.practiceId] : "Non ancora classificata",
                count: r.count,
              }))}
            />
          </div>
          <details className="group rounded-lg bg-surface p-5 ring-1 ring-line">
            <summary className="cursor-pointer font-display text-lg font-semibold">
              Come contiamo
            </summary>
            <ul className="mt-4 grid list-disc gap-2 ps-5 text-sm text-ink-2">
              {data.method.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </details>
          <p className="text-sm text-ink-3">
            Generato il {formatDateTime(data.generatedAt)}. Ogni apertura e ogni download finiscono
            nel{" "}
            <Link href="/console/registro" className="underline underline-offset-2">
              registro attività
            </Link>
            .
          </p>
        </div>
      )}
      <div className="mt-12 border-t border-line pt-10">
        <NearReadyPilot />
      </div>
    </PageContainer>
  );
}

function Thresholds({ group }: { group: PilotReportGroup }) {
  return (
    <section aria-labelledby="thresholds-title">
      <SectionHeader
        id="thresholds-title"
        title="Le tre soglie del pilota"
        lead="Decise prima di iniziare: dicono se ha senso proseguire. Con meno di 50 pratiche o con il periodo ancora aperto, il rapporto non dà un esito."
      />
      <ul className="mt-4 grid gap-4 md:grid-cols-3">
        {group.thresholds.map((threshold) => {
          const outcome = OUTCOME[threshold.outcome];
          const copy = THRESHOLD[threshold.id];
          const value = observed(threshold);
          return (
            <li
              key={threshold.id}
              className="flex flex-col rounded-lg bg-surface p-5 ring-1 ring-line"
            >
              <h3 className="font-semibold">{copy.title}</h3>
              <p className="mt-1 text-sm text-ink-2">{copy.target}</p>
              <p className={cn("mt-4 flex items-center gap-2 font-semibold", outcome.tone)}>
                <outcome.icon className="size-5 shrink-0" aria-hidden />
                {outcome.label}
                {value && <span className="tabular text-ink">· {value}</span>}
              </p>
              <p className="mt-2 text-sm text-ink-2">{explanation(threshold)}</p>
              <p className="mt-auto pt-3 text-xs text-ink-3">
                {threshold.sample === null
                  ? `Campione nascosto; minimo ${threshold.minimumSample}`
                  : `Campione: ${threshold.sample} su un minimo di ${threshold.minimumSample}`}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Totals({ group, report }: { group: PilotReportGroup; report: PilotReport }) {
  const [toSubmission, review] = group.times;
  const baseline = report.baseline.manualMinutesPerCase;
  return (
    <section aria-labelledby="totals-title">
      <SectionHeader id="totals-title" title="Cosa è successo nel periodo" />
      <dl className="mt-4 grid gap-px overflow-hidden rounded-lg bg-line ring-1 ring-line sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Pratiche avviate" value={count(group.starts)} />
        <Tile
          label="Inviate allo sportello"
          value={count(group.deliveries)}
          note={`${percent(group.deliveryRate.value)} delle avviate`}
        />
        <Tile
          label="Complete all'invio"
          value={percent(group.completeness.value)}
          note="Senza problemi bloccanti segnalati da Avanti"
        />
        <Tile
          label="Richieste di integrazione"
          value={count(group.integrations.requests)}
          note={`Su ${count(group.integrations.cases)} pratiche`}
        />
      </dl>
      <div className="mt-4 grid gap-4 rounded-lg bg-surface p-5 ring-1 ring-line sm:grid-cols-3">
        <Figure
          label="Dalla creazione al primo invio"
          value={formatMinutes(toSubmission?.value ?? null)}
          note="Media, comprese pause e attese del cittadino"
        />
        <Figure
          label="Revisione allo sportello"
          value={formatMinutes(review?.value ?? null)}
          note="Media, comprese pause"
        />
        <Figure
          label="Prima di Avanti (dichiarato)"
          value={baseline === null ? "—" : formatMinutes(baseline)}
          note={
            baseline === null ? (
              <>
                Non impostato:{" "}
                <Link href="/console/impostazioni" className="underline underline-offset-2">
                  aggiungilo nelle impostazioni
                </Link>
              </>
            ) : (
              "Minuti per pratica stimati dal CAF, non misurati"
            )
          }
        />
      </div>
      <p className="mt-2 text-sm text-ink-3">
        Sono tempi di calendario: non si confrontano con i minuti di lavoro. Il risparmio netto si
        misura con il cronometro durante il pilota.
      </p>
    </section>
  );
}

function Offices({ offices }: { offices: PilotReportGroup[] }) {
  return (
    <section aria-labelledby="offices-title">
      <SectionHeader id="offices-title" title="Per sportello" />
      <div className="mt-4 overflow-x-auto rounded-lg bg-surface ring-1 ring-line">
        <table className="w-full text-sm">
          <thead className="text-ink-2">
            <tr className="border-b border-line">
              <th scope="col" className="px-4 py-3 text-start font-medium">
                Sportello
              </th>
              <th scope="col" className="px-4 py-3 text-end font-medium">
                Avviate
              </th>
              <th scope="col" className="px-4 py-3 text-end font-medium">
                Inviate
              </th>
              <th scope="col" className="px-4 py-3 text-end font-medium">
                Complete all&apos;invio
              </th>
              <th scope="col" className="px-4 py-3 text-end font-medium">
                Integrazioni
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {offices.map((group) => (
              <tr key={group.office?.id ?? "none"}>
                <th scope="row" className="px-4 py-3 text-start font-semibold">
                  {group.office?.name ?? "Senza sportello"}
                </th>
                <td className="tabular px-4 py-3 text-end">{count(group.starts)}</td>
                <td className="tabular px-4 py-3 text-end">
                  {count(group.deliveries)}
                  <span className="ms-1 text-ink-3">({percent(group.deliveryRate.value)})</span>
                </td>
                <td className="tabular px-4 py-3 text-end">{percent(group.completeness.value)}</td>
                <td className="tabular px-4 py-3 text-end">{count(group.integrations.requests)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Distribution({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; label: string; count: PilotCount }[];
}) {
  return (
    <section className="rounded-lg bg-surface p-5 ring-1 ring-line">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-ink-3">Nessuna pratica nel periodo.</p>
      ) : (
        <table className="mt-3 w-full text-sm">
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr key={row.key}>
                <th scope="row" className="py-2 text-start font-normal text-ink-2">
                  {row.label}
                </th>
                <td className="tabular py-2 text-end font-semibold">{count(row.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
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

function Figure({ label, value, note }: { label: string; value: string; note: ReactNode }) {
  return (
    <div>
      <p className="text-sm text-ink-2">{label}</p>
      <p className="tabular mt-1 font-display text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-ink-3">{note}</p>
    </div>
  );
}
