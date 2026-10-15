"use client";

import { AlertTriangle, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import type { AiUsageResponse, SystemStatus } from "@avanti/contracts";
import { Notice } from "@/components/ui/notice";
import { PageContainer, PageHeader, SectionHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { useOperator } from "@/lib/console/operator-context";
import { useResource } from "@/lib/console/use-resource";
import { cn } from "@/lib/cn";
import { NearReadyPilot } from "@/components/console/near-ready-pilot";

const TASKS: Record<string, string> = {
  "intake.understand": "Comprensione del racconto",
  "interview.freeform": "Risposte a parole",
  "interview.converse": "Conversazione guidata",
  "citizen.assistant": "Assistente del cittadino",
  "speech.transcribe": "Trascrizione vocale",
  "document.analyze": "Lettura dei documenti",
  translate: "Traduzioni",
  "dossier.brief": "Riepilogo per l'operatore",
  "dossier.consistency": "Controlli incrociati",
  "dsu.prefill": "Prospetto DSU precompilato",
  "request.draft": "Bozze delle richieste",
  "message.reply_draft": "Bozze delle risposte",
  "operator.ask": "Domande normative",
  "dossier.ask": "Chiedi al fascicolo",
  "near_ready.read": "Quasi pronta: lettura dei dati",
  "near_ready.compare": "Quasi pronta: confronto",
};

const PROVIDER: Record<string, string> = {
  openrouter: "OpenRouter",
  openai: "OpenAI",
  anthropic: "Anthropic",
  gateway: "Vercel AI Gateway",
  none: "Nessuno (solo regole)",
};

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const smallEuro = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 4,
});
const numbers = new Intl.NumberFormat("it-IT");

export default function AiPage() {
  const operator = useOperator();
  if (operator.role !== "admin") {
    return (
      <PageContainer width="3xl" className="py-16 text-center lg:py-16">
        <h1 className="font-display text-2xl font-semibold">Pagina riservata</h1>
        <p className="mt-2 text-ink-2">
          L&apos;uso dell&apos;intelligenza artificiale lo vede un amministratore.
        </p>
      </PageContainer>
    );
  }
  return <AiView />;
}

function AiView() {
  const status = useResource<SystemStatus>("/api/status");
  const usage = useResource<AiUsageResponse>("/api/ai/usage");
  const ai = status.data?.components.ai;
  const config = ai?.configuration;

  // One row per task: the API groups by task, model, engine, outcome and day.
  const byTask = useMemo(() => {
    const rows = new Map<
      string,
      { calls: number; ai: number; latency: number; cost: number; manipulation: number }
    >();
    for (const g of usage.data?.groups ?? []) {
      const row = rows.get(g.task) ?? { calls: 0, ai: 0, latency: 0, cost: 0, manipulation: 0 };
      row.calls += g.calls;
      if (g.engine === "ai") row.ai += g.calls;
      row.latency += g.latencyMs * g.calls;
      row.cost += g.costEstimateEur;
      row.manipulation += g.manipulationAttempts;
      rows.set(g.task, row);
    }
    return [...rows.entries()].sort((a, b) => b[1].calls - a[1].calls);
  }, [usage.data]);

  const totals = usage.data?.totals;
  const share =
    usage.data && usage.data.budgetEur > 0 ? usage.data.usedEur / usage.data.budgetEur : 0;

  return (
    <PageContainer width="5xl" className="grid gap-10">
      <PageHeader
        icon={<Sparkles className="size-7 text-stamp" aria-hidden />}
        title="Intelligenza artificiale"
        lead={
          <>
            Cosa fa l&apos;AI in Avanti, con quale fornitore, quanto costa questo mese. Ogni
            funzione ha un percorso senza AI: se il fornitore non risponde o il budget finisce,
            Avanti continua con le regole.
          </>
        }
      />

      <section aria-labelledby="provider-title" className="grid gap-4 sm:grid-cols-2">
        <h2 id="provider-title" className="sr-only">
          Configurazione
        </h2>
        <div className="rounded-lg bg-surface p-5 ring-1 ring-line">
          <p className="text-sm text-ink-3">Fornitore</p>
          <p className="mt-1 font-display text-2xl font-semibold">
            {config ? PROVIDER[config.provider] : "—"}
          </p>
          {config && !config.keyPresent && config.provider !== "none" && (
            <p className="mt-2 flex items-center gap-2 text-sm text-warn">
              <AlertTriangle className="size-4" aria-hidden />
              Manca la chiave: si usano le regole.
            </p>
          )}
          {config && (
            <dl className="mt-3 grid gap-1 text-sm">
              {(
                [
                  ["Conversazione e testi", config.models.fast],
                  ["Riepiloghi e controlli", config.models.reasoning],
                  ["Lettura dei documenti", config.models.vision],
                  ["Riserva", config.fallbacks.join(", ")],
                ] as const
              ).map(([label, model]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-ink-3">{label}</dt>
                  <dd className="font-code truncate text-ink-2" translate="no">
                    {model || "—"}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        <div className="rounded-lg bg-surface p-5 ring-1 ring-line">
          <p className="text-sm text-ink-3">Dati ai fornitori</p>
          {config ? (
            config.dataPolicy === "strict" ? (
              <p className="mt-1 flex items-start gap-2 font-semibold text-ok">
                <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
                Solo fornitori che non conservano i dati e non li usano per addestrare modelli.
              </p>
            ) : (
              <p className="mt-1 flex items-start gap-2 font-semibold text-warn">
                <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
                Modalità di prova: i fornitori possono conservare i dati. Non usarla con dati reali.
              </p>
            )
          ) : (
            <p className="mt-1">—</p>
          )}
          <p className="mt-3 text-sm text-ink-2">
            Al modello arriva solo ciò che serve a ogni singolo compito: mai note interne, mai altri
            fascicoli. Dettagli in{" "}
            <Link href="/sicurezza" className="underline underline-offset-2">
              Sicurezza e dati
            </Link>
            .
          </p>
        </div>
      </section>

      <section aria-labelledby="budget-title">
        <SectionHeader id="budget-title" title="Questo mese" />
        {usage.status === "error" && !usage.data ? (
          <Notice tone="danger" className="mt-3">
            Consumi non disponibili: {usage.error.message}
          </Notice>
        ) : !usage.data || !totals ? (
          <Skeleton className="mt-3 h-32 rounded-lg" />
        ) : (
          <>
            <div className="mt-3 rounded-lg bg-surface p-5 ring-1 ring-line">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p>
                  <span className="font-display text-3xl font-semibold">
                    {euro.format(usage.data.usedEur)}
                  </span>
                  <span className="text-ink-3"> su {euro.format(usage.data.budgetEur)}</span>
                </p>
                {usage.data.exhausted && <Pill tone="warn">Budget finito: si usano le regole</Pill>}
              </div>
              <div
                className="mt-3 h-2 overflow-hidden rounded-full bg-sunk"
                role="meter"
                aria-label="Budget usato"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(Math.min(1, share) * 100)}
              >
                <div
                  className={cn("h-full rounded-full", share >= 0.9 ? "bg-warn" : "bg-stamp")}
                  style={{ width: `${Math.min(100, share * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-ink-3">
                Il budget si imposta nelle{" "}
                <Link href="/console/impostazioni" className="underline underline-offset-2">
                  impostazioni
                </Link>
                .
              </p>
            </div>
            <dl className="mt-4 grid gap-px overflow-hidden rounded-lg bg-line ring-1 ring-line sm:grid-cols-4">
              {(
                [
                  ["Richieste", numbers.format(totals.calls)],
                  ["Token letti", numbers.format(totals.inputTokens)],
                  ["Token scritti", numbers.format(totals.outputTokens)],
                  ["Tentativi di manipolazione", numbers.format(totals.manipulationAttempts)],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="bg-surface px-5 py-4">
                  <dt className="text-sm text-ink-2">{label}</dt>
                  <dd className="tabular mt-1 font-display text-2xl font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </section>

      {byTask.length > 0 && (
        <section aria-labelledby="tasks-title">
          <SectionHeader id="tasks-title" title="Per funzione" />
          <div className="mt-3 overflow-x-auto rounded-lg bg-surface ring-1 ring-line">
            <table className="w-full text-sm">
              <thead className="text-ink-2">
                <tr className="border-b border-line">
                  <th scope="col" className="px-4 py-3 text-start font-medium">
                    Funzione
                  </th>
                  <th scope="col" className="px-4 py-3 text-end font-medium">
                    Richieste
                  </th>
                  <th scope="col" className="px-4 py-3 text-end font-medium">
                    Con AI
                  </th>
                  <th scope="col" className="px-4 py-3 text-end font-medium">
                    Tempo medio
                  </th>
                  <th scope="col" className="px-4 py-3 text-end font-medium">
                    Costo
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {byTask.map(([task, row]) => (
                  <tr key={task}>
                    <th scope="row" className="px-4 py-3 text-start font-semibold">
                      {TASKS[task] ?? task}
                    </th>
                    <td className="tabular px-4 py-3 text-end">{numbers.format(row.calls)}</td>
                    <td className="tabular px-4 py-3 text-end">
                      {row.calls ? `${Math.round((row.ai / row.calls) * 100)}%` : "—"}
                    </td>
                    <td className="tabular px-4 py-3 text-end">
                      {row.calls ? `${(row.latency / row.calls / 1000).toFixed(1)} s` : "—"}
                    </td>
                    <td className="tabular px-4 py-3 text-end">{smallEuro.format(row.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-sm text-ink-3">
            «Con AI» sotto il 100% vuol dire che alcune richieste sono passate alle regole:
            fornitore lento o non raggiungibile, risposta non valida, budget finito.
          </p>
        </section>
      )}

      <NearReadyPilot />
    </PageContainer>
  );
}
