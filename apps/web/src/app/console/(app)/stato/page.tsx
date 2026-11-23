"use client";

import { AlertOctagon, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import type { Route } from "next";
import type { SystemStatus, SystemStatusLevel } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { PANEL, PanelTitle } from "@/components/console/admin/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/console/labels";
import { useOperator } from "@/lib/console/operator-context";
import { useResource } from "@/lib/console/use-resource";
import { cn } from "@/lib/cn";
import { onlyNotStarted } from "@/lib/console/system-status";

type SystemStatusCode =
  SystemStatus["components"]["database"]["code"] | SystemStatus["components"]["email"]["code"];

const LEVEL: Record<
  SystemStatusLevel,
  { label: string; headline: string; icon: typeof CheckCircle2; tone: string }
> = {
  ok: { label: "Funziona", headline: "Tutto funziona", icon: CheckCircle2, tone: "text-ok" },
  attention: {
    label: "Da controllare",
    headline: "Qualcosa da controllare",
    icon: AlertTriangle,
    tone: "text-warn",
  },
  problem: {
    label: "Problema",
    headline: "C'è un problema",
    icon: AlertOctagon,
    tone: "text-danger",
  },
};

/** What each code means for the CAF, and what to do about it. */
const CODES: Record<SystemStatusCode, string> = {
  available: "Raggiungibile e in funzione.",
  unavailable: "Non raggiungibile. Se dura più di qualche minuto, contatta il supporto di Avanti.",
  probe_unavailable: "Il controllo non è disponibile in questo ambiente.",
  not_configured:
    "Non attiva in questo ambiente: si usano le regole e i documenti vanno controllati a vista. Se succede nel vostro servizio, contatta il supporto di Avanti.",
  no_observations:
    "Nessuna attività nelle ultime 24 ore: è normale finché i cittadini non iniziano a usarla.",
  ai_fallback:
    "L'AI non risponde e si usano le regole: le pratiche procedono, i documenti vanno controllati a vista.",
  ai_errors: "Errori recenti dell'AI: alcune analisi sono passate alle regole.",
  never_run:
    "Non ancora eseguita: parte da sola una volta al giorno. Se dopo un giorno è ancora così, contatta il supporto.",
  running: "In corso adesso.",
  stale: "Non eseguita da troppo tempo: documenti bloccati e pulizie possono accumularsi.",
  failed: "L'ultima esecuzione non è riuscita; riproverà da sola.",
  backlog: "C'è dell'arretrato.",
  recent_errors: "Ci sono stati errori nelle ultime 24 ore.",
  not_supported: "Non disponibile.",
  email_simulated:
    "Nessun servizio di invio attivo: gli avvisi via email non arrivano a nessuno. Per attivarli contatta il supporto di Avanti.",
  email_backlog:
    "Alcuni avvisi aspettano da più di un'ora: il servizio di invio potrebbe essere lento.",
  email_failed:
    "Alcuni avvisi non sono partiti dopo 5 tentativi. Se continua, contatta il supporto di Avanti.",
};

const emailSummary = (email: SystemStatus["components"]["email"]) =>
  email.provider === "console"
    ? "Solo registro"
    : email.sent24Hours === null
      ? null
      : `${email.sent24Hours} ${email.sent24Hours === 1 ? "inviato" : "inviati"} nelle ultime 24 ore`;

export default function SystemStatusPage() {
  const operator = useOperator();
  if (operator.role !== "admin") {
    return (
      <PageContainer width="3xl" centered className="py-16 text-center lg:py-16">
        <h1 className="font-display text-2xl font-semibold">Stato riservato</h1>
        <p className="mt-2 text-ink-2">Lo stato del sistema lo consulta un amministratore.</p>
      </PageContainer>
    );
  }
  return <StatusView />;
}

function StatusView() {
  const status = useResource<SystemStatus>("/api/status");
  const { reload } = status;
  // Left open on a screen during the pilot: keep it current.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") reload();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [reload]);

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Stato del sistema"
        lead="Si aggiorna ogni minuto. Non mostra dati dei cittadini."
        actions={
          <Button
            variant="secondary"
            size="sm"
            loading={status.refreshing || status.reloading}
            onClick={() => reload()}
          >
            <RefreshCw className="size-4" aria-hidden />
            Aggiorna
          </Button>
        }
      />

      {status.status === "error" && !status.data ? (
        <Notice tone="danger" size="page" className="mt-6" title="Stato non disponibile.">
          {status.error.message}
        </Notice>
      ) : !status.data ? (
        <div className="mt-6 grid items-start gap-4 lg:grid-cols-3" aria-hidden>
          <Skeleton className="h-[30rem] rounded-md lg:col-span-2" />
          <div className="grid gap-4">
            <Skeleton className="h-40 rounded-md" />
            <Skeleton className="h-80 rounded-md" />
          </div>
        </div>
      ) : (
        <>
          {status.status === "error" && (
            <Notice tone="danger" className="mt-6">
              Aggiornamento non riuscito: i dati qui sotto sono quelli del{" "}
              {formatDateTime(status.data.generatedAt)}. {status.error.message}
            </Notice>
          )}
          <StatusBody data={status.data} />
        </>
      )}
    </PageContainer>
  );
}

const SEVERITY: Record<SystemStatusLevel, number> = { problem: 0, attention: 1, ok: 2 };

function StatusBody({ data }: { data: SystemStatus }) {
  const overall = LEVEL[data.status];
  const { database, storage, ai, maintenance, retention, email } = data.components;
  const counters = data.counters;
  const components = [
    { key: "database", name: "Database", level: database.status, code: database.code },
    { key: "storage", name: "Archivio documenti", level: storage.status, code: storage.code },
    {
      key: "ai",
      name: "Analisi con AI",
      level: ai.status,
      code: ai.code,
      extra: ai.configured ? (ai.mode === "fallback" ? "Ora: regole" : "Ora: AI") : null,
      chart: ai.hourly ? <AiChart hourly={ai.hourly} /> : null,
    },
    {
      key: "maintenance",
      name: "Manutenzione automatica",
      level: maintenance.status,
      code: maintenance.code,
      extra: lastRun(maintenance.lastFinishedAt),
    },
    {
      key: "retention",
      name: "Conservazione (pulizia dei fascicoli)",
      level: retention.status,
      code: retention.code,
      extra: lastRun(retention.lastFinishedAt),
    },
    {
      key: "email",
      name: "Avvisi via email",
      level: email.status,
      code: email.code,
      extra: emailSummary(email),
    },
  ];
  // What needs looking at comes first; among equals the order stays the usual one.
  const sorted = [...components].sort((a, b) => SEVERITY[a.level] - SEVERITY[b.level]);
  const working = components.filter((c) => c.level === "ok").length;

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-3">
      {/* Announces only the verdict, so a refresh every minute stays quiet unless it changes. */}
      <p role="status" className="sr-only">
        {overall.headline}
      </p>
      <section aria-labelledby="components-title" className={cn(PANEL, "lg:col-span-2")}>
        <div className="border-b border-line p-5">
          <p className="flex items-center gap-2.5 text-2xl leading-tight font-semibold">
            <overall.icon className={cn("size-6 shrink-0", overall.tone)} aria-hidden />
            {overall.headline}
          </p>
          <p className="mt-1.5 text-sm text-ink-2">
            <span className="tabular">
              {working} componenti su {components.length} funzionano
            </span>
            {" · controllato il "}
            <span className="tabular">{formatDateTime(data.generatedAt)}</span>
          </p>
          {onlyNotStarted(data) && (
            <p className="mt-1 text-sm text-ink-2">
              Alcune attività non sono ancora partite: nei primi giorni è normale. Se resta così per
              più di un giorno, contatta il supporto.
            </p>
          )}
        </div>
        <PanelTitle id="components-title" className="px-5 pt-4">
          Componenti
        </PanelTitle>
        <ul className="divide-y divide-line px-5">
          {sorted.map((c) => (
            <ComponentRow key={c.key} name={c.name} level={c.level} code={c.code} extra={c.extra}>
              {c.chart}
            </ComponentRow>
          ))}
        </ul>
      </section>

      <div className="flex flex-col gap-4">
        {data.usage && <UsageCard usage={data.usage} />}
        {/* Stretched to the components' foot: the rows share the extra height, no blank band. */}
        <section aria-labelledby="counters-title" className={cn(PANEL, "flex flex-1 flex-col p-5")}>
          <PanelTitle id="counters-title">Da tenere d&apos;occhio</PanelTitle>
          <dl className="mt-1 flex flex-1 flex-col divide-y divide-line">
            <Counter
              label="Documenti in analisi da più di 10 minuti"
              level={counters.documentsProcessingOver10Minutes.status}
              count={counters.documentsProcessingOver10Minutes.count}
            />
            <Counter
              label="Pratiche in attesa del cittadino da più di 7 giorni"
              level={counters.casesWaitingForCitizenOver7Days.status}
              count={counters.casesWaitingForCitizenOver7Days.count}
              href="/console?stato=needs_citizen"
            />
            <Counter
              label="Link dei cittadini in scadenza entro 7 giorni"
              level={counters.linksExpiringWithin7Days.status}
              count={counters.linksExpiringWithin7Days.count}
            />
            <Counter
              label="Pratiche e registrazioni oltre la conservazione"
              level={counters.retentionOverdue.status}
              count={counters.retentionOverdue.count}
            />
            <Counter
              label="Errori del servizio nelle ultime 24 ore"
              level={counters.recentApiErrors24Hours.status}
              count={counters.recentApiErrors24Hours.count}
            />
            <Counter
              label="Avvisi email non partiti nelle ultime 24 ore"
              level={email.failed24Hours ? email.status : "ok"}
              count={email.failed24Hours}
            />
            <Counter
              label="Avvisi email in coda"
              level={counters.notificationsQueued.status}
              count={counters.notificationsQueued.count}
            />
          </dl>
        </section>
      </div>

      <p className="text-[0.8125rem] text-ink-3 lg:col-span-3">
        Versione{" "}
        {data.version.tag ??
          (data.version.commit ? data.version.commit.slice(0, 7) : "di sviluppo")}
      </p>
    </div>
  );
}

// Never run: the row's own explanation already says so.
const lastRun = (iso: string | null) => (iso ? `Ultima: ${formatDateTime(iso)}` : null);

function ComponentRow({
  name,
  level,
  code,
  extra,
  children,
}: {
  name: string;
  level: SystemStatusLevel;
  code: SystemStatusCode;
  extra?: string | null;
  children?: ReactNode;
}) {
  const { icon: Icon, label } = LEVEL[level];
  return (
    <li className="grid gap-1 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-semibold">{name}</p>
        <span className="flex items-center gap-3">
          {extra && <span className="tabular text-[0.8125rem] text-ink-3">{extra}</span>}
          <Pill tone={TONE[level]}>
            <Icon aria-hidden />
            {label}
          </Pill>
        </span>
      </div>
      <p className="max-w-2xl text-[0.8125rem] leading-snug text-ink-3">{CODES[code]}</p>
      {children && <div className="mt-2">{children}</div>}
    </li>
  );
}

const TONE: Record<SystemStatusLevel, "ok" | "warn" | "danger"> = {
  ok: "ok",
  attention: "warn",
  problem: "danger",
};

/** One count per row: what is counted on the left, the figure on the right. */
function Counter({
  label,
  level,
  count,
  href,
}: {
  label: string;
  level: SystemStatusLevel;
  count: number | null;
  href?: Route;
}) {
  // A fine count needs no mark: only what needs looking at carries the status colour.
  const flagged = count !== null && level !== "ok";
  const { icon: Icon, tone } = LEVEL[level];
  return (
    <div className="flex min-h-11 flex-1 items-center justify-between gap-4 py-2">
      <dt className="min-w-0 text-[0.8125rem] leading-snug text-ink-2">
        {label}
        {href && count !== null && count > 0 && (
          <>
            {" · "}
            <Link href={href} className="font-semibold text-stamp hover:underline">
              Vedi le pratiche
            </Link>
          </>
        )}
      </dt>
      <dd className="flex shrink-0 items-center gap-1.5">
        {flagged && <Icon className={cn("size-3.5", tone)} aria-hidden />}
        {/* null means "not measured": never show it as zero. */}
        {count === null ? (
          <span className="text-[0.8125rem] text-ink-3">non misurato</span>
        ) : (
          <span className={cn("tabular text-base font-semibold", flagged && tone)}>
            {count.toLocaleString("it-IT")}
          </span>
        )}
      </dd>
    </div>
  );
}

/**
 * AI calls per hour over the last 24 hours. Two adjacent series (AI, rules) with a hatch on
 * the second because the pair is close for protanopes; errors are a dot above the bar, a
 * different shape rather than a third adjacent colour. A table carries the same numbers.
 */
function AiChart({ hourly }: { hourly: NonNullable<SystemStatus["components"]["ai"]["hourly"]> }) {
  const max = Math.max(1, ...hourly.map((h) => h.successes + h.fallbacks));
  const total = hourly.reduce(
    (sum, h) => ({
      successes: sum.successes + h.successes,
      fallbacks: sum.fallbacks + h.fallbacks,
      errors: sum.errors + h.errors,
    }),
    { successes: 0, fallbacks: 0, errors: 0 },
  );
  // An empty day is drawn too: 24 notches on the baseline and one sentence.
  const none = total.successes + total.fallbacks + total.errors === 0;
  const hour = (iso: string) =>
    new Intl.DateTimeFormat("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Rome",
    }).format(new Date(iso));

  return (
    <figure className="grid gap-2">
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem] text-ink-2">
        <span>{none ? "Nessuna analisi nelle ultime 24 ore." : "Ultime 24 ore:"}</span>
        {!none && (
          <>
            <Legend swatch="bg-stamp">con AI {total.successes}</Legend>
            <Legend swatch="bg-line-strong hatch">con le regole {total.fallbacks}</Legend>
            <Legend swatch="rounded-full bg-danger">errori {total.errors}</Legend>
          </>
        )}
      </figcaption>
      <div
        className={cn("flex items-end gap-0.5 border-b border-line-strong", none ? "h-3" : "h-20")}
        aria-hidden
      >
        {hourly.map((h) => {
          const ai = (h.successes / max) * 100;
          const rules = (h.fallbacks / max) * 100;
          return (
            <div
              key={h.hour}
              title={`${hour(h.hour)}: ${h.successes} con AI, ${h.fallbacks} con le regole, ${h.errors} ${h.errors === 1 ? "errore" : "errori"}`}
              className="relative flex h-full flex-1 flex-col justify-end gap-0.5 rounded-xs hover:bg-sunk"
            >
              {h.errors > 0 && (
                <span className="mx-auto mb-0.5 size-1.5 shrink-0 rounded-full bg-danger" />
              )}
              {rules > 0 && (
                <span
                  className="hatch min-h-[3px] rounded-t-[2px] bg-line-strong"
                  style={{ height: `${rules}%` }}
                />
              )}
              {ai > 0 && (
                <span
                  className={cn("min-h-[3px] bg-stamp", rules > 0 ? "" : "rounded-t-[2px]")}
                  style={{ height: `${ai}%` }}
                />
              )}
              {/* An hour with nothing is a notch, not a hole: all 24 columns stay drawn. */}
              {ai === 0 && rules === 0 && <span className="h-0.5 rounded-full bg-line-strong" />}
            </div>
          );
        })}
      </div>
      {hourly.length > 1 && (
        <div className="tabular flex justify-between text-[0.8125rem] text-ink-3" aria-hidden>
          <span>{hour(hourly[0]!.hour)}</span>
          <span>{hour(hourly[Math.floor(hourly.length / 2)]!.hour)}</span>
          <span>adesso</span>
        </div>
      )}
      <table className="sr-only">
        <caption>Chiamate all&apos;AI per ora nelle ultime 24 ore</caption>
        <thead>
          <tr>
            <th scope="col">Ora</th>
            <th scope="col">Con AI</th>
            <th scope="col">Con le regole</th>
            <th scope="col">Errori</th>
          </tr>
        </thead>
        <tbody>
          {hourly.map((h) => (
            <tr key={h.hour}>
              <th scope="row">{hour(h.hour)}</th>
              <td className="text-end">{h.successes}</td>
              <td className="text-end">{h.fallbacks}</td>
              <td className="text-end">{h.errors}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function Legend({ swatch, children }: { swatch: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2.5 rounded-[2px]", swatch)} aria-hidden />
      {children}
    </span>
  );
}

const monthName = (month: string) =>
  new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-01T00:00:00Z`),
  );

/**
 * Dossiers delivered this month against the plan's quota. Nothing is ever blocked at 100%:
 * the citizen still sends, and Avanti talks with the CAF about the excess.
 */
function UsageCard({ usage }: { usage: NonNullable<SystemStatus["usage"]> }) {
  const percent = usage.percent === null ? null : Math.round(usage.percent);
  const tone =
    percent === null || percent < 90 ? "bg-stamp" : percent < 100 ? "bg-warn" : "bg-danger";
  return (
    <section aria-labelledby="usage-title" className={cn(PANEL, "p-5")}>
      <PanelTitle id="usage-title">Uso del piano, {monthName(usage.month)}</PanelTitle>
      <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
        <span className="tabular text-2xl leading-none font-semibold">
          {usage.delivered.toLocaleString("it-IT")}
        </span>
        <span className="text-sm text-ink-2">
          {usage.delivered === 1 ? "fascicolo consegnato" : "fascicoli consegnati"}
          {usage.cap !== null && (
            <>
              {" "}
              su <span className="tabular">{usage.cap.toLocaleString("it-IT")}</span> inclusi
            </>
          )}
        </span>
      </p>
      {percent !== null && usage.cap !== null && (
        <>
          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-sunk"
            role="meter"
            aria-label="Quota del mese usata"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(percent, 100)}
            aria-valuetext={`${percent}%`}
          >
            <div
              className={cn("h-full origin-left rounded-full", tone)}
              style={{ transform: `scaleX(${Math.min(percent, 100) / 100})` }}
            />
          </div>
          {/* Both ends labelled: the fill reads as a share of the plan, not as a level. */}
          <p className="tabular mt-1.5 flex justify-between text-[0.8125rem] text-ink-3">
            <span>0</span>
            <span>{usage.cap.toLocaleString("it-IT")}</span>
          </p>
          <p className="mt-2 text-[0.8125rem] text-ink-2">
            {percent >= 100
              ? "Quota del mese superata: i cittadini continuano a inviare e ne parliamo noi con voi."
              : percent >= 70
                ? `${percent}% della quota del mese. Vi avvisiamo anche per email al 70% e al 90%.`
                : `${percent}% della quota del mese.`}
          </p>
        </>
      )}
      <p className="mt-2 text-[0.8125rem] leading-snug text-ink-3">
        Un fascicolo conta una volta, al primo invio del cittadino: integrazioni e reinvii sono
        inclusi.
      </p>
    </section>
  );
}
