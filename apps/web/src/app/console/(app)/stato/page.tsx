"use client";

import { AlertOctagon, AlertTriangle, CheckCircle2, Minus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import type { Route } from "next";
import type { SystemStatus, SystemStatusLevel } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { PageContainer, PageHeader, SectionHeader } from "@/components/ui/page-header";
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
    <PageContainer width="5xl">
      <PageHeader
        title="Stato del sistema"
        lead="Si aggiorna ogni minuto. Non mostra dati dei cittadini."
        actions={
          <Button
            variant="secondary"
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
        <Skeleton className="mt-6 h-64 rounded-lg" />
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

function StatusBody({ data }: { data: SystemStatus }) {
  const overall = LEVEL[data.status];
  const { database, storage, ai, maintenance, retention, email } = data.components;
  const counters = data.counters;

  return (
    <div className="mt-6 grid gap-8">
      {/* Announces only the verdict, so a refresh every minute stays quiet unless it changes. */}
      <p role="status" className="sr-only">
        {overall.headline}
      </p>
      <section
        aria-label="Riepilogo"
        className={cn(
          "flex items-center gap-4 rounded-lg p-5 ring-1",
          data.status === "ok" && "bg-ok-wash ring-ok/20",
          data.status === "attention" && "bg-warn-wash ring-warn/20",
          data.status === "problem" && "bg-danger-wash ring-danger/20",
        )}
      >
        <overall.icon className={cn("size-7 shrink-0", overall.tone)} aria-hidden />
        <div>
          <p className="font-display text-xl font-semibold">{overall.headline}</p>
          <p className="text-sm text-ink-2">
            {onlyNotStarted(data) &&
              "Alcune attività non sono ancora partite: nei primi giorni è normale. Se resta così per più di un giorno, contatta il supporto. "}
            Controllato il {formatDateTime(data.generatedAt)}
          </p>
        </div>
      </section>

      {data.usage && <UsageCard usage={data.usage} />}

      <section aria-labelledby="components-title">
        <SectionHeader id="components-title" title="Componenti" />
        <ul className="mt-3 divide-y divide-line rounded-lg bg-surface ring-1 ring-line">
          <ComponentRow name="Database" level={database.status} code={database.code} />
          <ComponentRow name="Archivio documenti" level={storage.status} code={storage.code} />
          <ComponentRow
            name="Analisi con AI"
            level={ai.status}
            code={ai.code}
            extra={ai.configured ? (ai.mode === "fallback" ? "Ora: regole" : "Ora: AI") : null}
          >
            {ai.hourly && <AiChart hourly={ai.hourly} />}
          </ComponentRow>
          <ComponentRow
            name="Manutenzione automatica"
            level={maintenance.status}
            code={maintenance.code}
            extra={lastRun(maintenance.lastFinishedAt)}
          />
          <ComponentRow
            name="Conservazione (pulizia dei fascicoli)"
            level={retention.status}
            code={retention.code}
            extra={lastRun(retention.lastFinishedAt)}
          />
          <ComponentRow
            name="Avvisi via email"
            level={email.status}
            code={email.code}
            extra={emailSummary(email)}
          />
        </ul>
      </section>

      <section aria-labelledby="counters-title">
        <SectionHeader id="counters-title" title={<>Da tenere d&apos;occhio</>} />
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
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
            label="Link dei cittadini in scadenza nei prossimi 7 giorni"
            level={counters.linksExpiringWithin7Days.status}
            count={counters.linksExpiringWithin7Days.count}
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

      <p className="text-sm text-ink-3">
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
  const { icon: Icon, label, tone } = LEVEL[level];
  return (
    <li className="grid gap-2 px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Icon className={cn("size-5 shrink-0", tone)} aria-hidden />
        <p className="font-semibold">{name}</p>
        <span className={cn("text-sm font-semibold", tone)}>{label}</span>
        {extra && <span className="text-sm text-ink-3">· {extra}</span>}
      </div>
      <p className="ps-8 text-sm text-ink-2">{CODES[code]}</p>
      {children && <div className="ps-8">{children}</div>}
    </li>
  );
}

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
  // An unmeasured value gets no verdict: a green tick would read as "all good".
  const { icon: Icon, tone } = count === null ? { icon: Minus, tone: "text-ink-3" } : LEVEL[level];
  return (
    <div className="rounded-lg bg-surface p-4 ring-1 ring-line">
      <dt className="text-sm text-ink-2">{label}</dt>
      <dd className="mt-1 flex items-center gap-2">
        <Icon className={cn("size-4.5 shrink-0", tone)} aria-hidden />
        {/* null means "not measured": never show it as zero. */}
        <span className="font-display text-2xl font-semibold tabular-nums">
          {count === null ? "—" : count.toLocaleString("it-IT")}
        </span>
        {count === null && <span className="text-sm text-ink-3">non disponibile</span>}
        {href && count !== null && count > 0 && (
          <Link href={href} className="ms-auto text-sm font-semibold text-stamp hover:underline">
            Vedi le pratiche
          </Link>
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
  if (total.successes + total.fallbacks + total.errors === 0) {
    return <p className="text-sm text-ink-3">Nessuna analisi nelle ultime 24 ore.</p>;
  }
  const hour = (iso: string) =>
    new Intl.DateTimeFormat("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Rome",
    }).format(new Date(iso));

  return (
    <figure className="grid gap-2">
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        <span>Ultime 24 ore:</span>
        <Legend swatch="bg-[var(--chart-ai)]">con AI {total.successes}</Legend>
        <Legend swatch="bg-[var(--chart-fallback)] hatch">con le regole {total.fallbacks}</Legend>
        <Legend swatch="rounded-full bg-danger">errori {total.errors}</Legend>
      </figcaption>
      <div className="flex h-20 items-end gap-0.5 border-b border-line" aria-hidden>
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
                  className="hatch rounded-t-[2px] bg-[var(--chart-fallback)]"
                  style={{ height: `${rules}%` }}
                />
              )}
              {ai > 0 && (
                <span
                  className={cn("bg-[var(--chart-ai)]", rules > 0 ? "" : "rounded-t-[2px]")}
                  style={{ height: `${ai}%` }}
                />
              )}
            </div>
          );
        })}
      </div>
      {hourly.length > 1 && (
        <div className="tabular flex justify-between text-xs text-ink-3" aria-hidden>
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
              <td>{h.successes}</td>
              <td>{h.fallbacks}</td>
              <td>{h.errors}</td>
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
    <section aria-labelledby="usage-title" className="rounded-lg bg-surface p-5 ring-1 ring-line">
      <h2 id="usage-title" className="text-sm font-semibold text-ink-2">
        Uso del piano, {monthName(usage.month)}
      </h2>
      <p className="mt-1 font-display text-2xl font-semibold">
        <span className="tabular">{usage.delivered}</span>{" "}
        {usage.delivered === 1 ? "fascicolo consegnato" : "fascicoli consegnati"}
        {usage.cap !== null && (
          <span className="text-base font-normal text-ink-2">
            {" "}
            su <span className="tabular">{usage.cap}</span> inclusi
          </span>
        )}
      </p>
      {percent !== null && (
        <>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-sunk"
            role="meter"
            aria-label="Quota del mese usata"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(percent, 100)}
            aria-valuetext={`${percent}%`}
          >
            <div
              className={cn("h-full rounded-full", tone)}
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-ink-2">
            {percent >= 100
              ? "Quota del mese superata: i cittadini continuano a inviare e ne parliamo noi con voi."
              : percent >= 70
                ? `${percent}% della quota del mese. Vi avvisiamo anche per email al 70% e al 90%.`
                : `${percent}% della quota del mese.`}
          </p>
        </>
      )}
      <p className="mt-2 text-xs text-ink-3">
        Un fascicolo conta una volta, al primo invio del cittadino: integrazioni e reinvii sono
        inclusi.
      </p>
    </section>
  );
}
