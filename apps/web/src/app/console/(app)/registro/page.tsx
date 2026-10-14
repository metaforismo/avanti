"use client";

import { AlertTriangle, Download } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Route } from "next";
import type { AuditAction, AuditEvent, AuditPage, OperatorSummary } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/console/labels";
import { useOperator } from "@/lib/console/operator-context";
import { useResource } from "@/lib/console/use-resource";
import { cn } from "@/lib/cn";

/** The questions a CAF manager actually asks, each answered by one kind of event. */
const QUESTIONS: { label: string; action?: AuditAction }[] = [
  { label: "Tutte le attività" },
  { label: "Accessi non riusciti", action: "auth.login_failed" },
  { label: "Accessi", action: "auth.login_succeeded" },
  { label: "Esportazioni di fascicoli", action: "case.exported" },
  { label: "Prospetti DSU consultati", action: "dsu_sheet.viewed" },
  { label: "Documenti scaricati", action: "document.downloaded" },
  { label: "Link rigenerati", action: "case.link_regenerated" },
  { label: "Cancellazioni definitive", action: "case.deleted" },
  { label: "Cancellazioni per fine conservazione", action: "case.retention_deleted" },
  { label: "Password reimpostate", action: "operator.password_reset" },
  { label: "Operatori disattivati", action: "operator.deactivated" },
  { label: "Parametri modificati", action: "settings.updated" },
];

const PERIODS = [
  { key: "1", label: "Oggi", days: 1 },
  { key: "7", label: "7 giorni", days: 7 },
  { key: "30", label: "30 giorni", days: 30 },
  { key: "90", label: "90 giorni", days: 90 },
] as const;

/** Midnight in the browser's day, n-1 days ago: "today" means since this morning. */
function since(days: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start.toISOString();
}

export default function AuditLogPage() {
  const operator = useOperator();
  if (operator.role !== "admin") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <h1 className="font-display text-2xl font-semibold">Registro riservato</h1>
        <p className="mt-2 text-ink-2">Il registro delle attività lo consulta un amministratore.</p>
      </div>
    );
  }
  return <AuditLog />;
}

function AuditLog() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["key"]>("7");
  const [question, setQuestion] = useState(0);
  const [operatorId, setOperatorId] = useState("");
  const [reference, setReference] = useState("");
  const [appliedReference, setAppliedReference] = useState("");
  const operators = useResource<OperatorSummary[]>("/api/operators");

  const query = useMemo(() => {
    const q = new URLSearchParams({ from: since(PERIODS.find((p) => p.key === period)!.days) });
    const action = QUESTIONS[question]?.action;
    if (action) q.set("action", action);
    if (operatorId) q.set("operatorId", operatorId);
    if (appliedReference) q.set("reference", appliedReference);
    return q.toString();
  }, [period, question, operatorId, appliedReference]);

  const page = useResource<AuditPage>(`/api/audit?${query}`);
  const [more, setMore] = useState<{ query: string; items: AuditEvent[]; cursor: string | null }>();
  const [loadingMore, setLoadingMore] = useState(false);
  const extra = more?.query === query ? more : undefined;
  const items = [...(page.data?.items ?? []), ...(extra?.items ?? [])];
  const cursor = extra ? extra.cursor : (page.data?.nextCursor ?? null);
  const names = new Map((operators.data ?? []).map((op) => [op.id, op.name]));

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const next = await apiFetch<AuditPage>(
        `/api/audit?${query}&cursor=${encodeURIComponent(cursor)}`,
      );
      setMore({ query, items: [...(extra?.items ?? []), ...next.items], cursor: next.nextCursor });
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.025em]">Registro attività</h1>
          <p className="mt-1 max-w-2xl text-ink-2">
            Chi ha fatto cosa, e quando: per rispondere a un interessato o a un controllo. Il
            registro non contiene dati personali dei cittadini.
          </p>
        </div>
        <Button variant="secondary" asChild>
          <a href={`/api/audit/export.csv?${query}`} download>
            <Download className="size-4" aria-hidden />
            Esporta CSV
          </a>
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Periodo" className="flex rounded-sm bg-sunk p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={period === p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                "rounded-xs px-3 py-1.5 text-sm",
                period === p.key ? "bg-surface font-semibold text-ink shadow-xs" : "text-ink-2",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <Select
          compact
          aria-label="Cosa cerchi"
          value={question}
          onChange={(e) => setQuestion(Number(e.target.value))}
        >
          {QUESTIONS.map((q, i) => (
            <option key={q.label} value={i}>
              {q.label}
            </option>
          ))}
        </Select>
        <Select
          compact
          aria-label="Operatore"
          value={operatorId}
          onChange={(e) => setOperatorId(e.target.value)}
        >
          <option value="">Tutti gli operatori</option>
          {(operators.data ?? []).map((op) => (
            <option key={op.id} value={op.id}>
              {op.name}
              {op.active ? "" : " (disattivato)"}
            </option>
          ))}
        </Select>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setAppliedReference(reference.trim().toUpperCase());
          }}
          className="flex gap-2"
        >
          <Input
            aria-label="Codice pratica"
            placeholder="AV-2027-000123"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            onBlur={() => setAppliedReference(reference.trim().toUpperCase())}
            className="h-10 w-44 font-mono text-sm"
            spellCheck={false}
          />
        </form>
      </div>

      <section aria-busy={page.status === "loading"} className="mt-5">
        {page.status === "error" && !page.data ? (
          <div role="alert" className="rounded-lg bg-danger-wash p-6 text-danger">
            <p className="font-semibold">Registro non disponibile.</p>
            <p className="mt-1 text-sm">{page.error.message}</p>
            <Button variant="secondary" className="mt-4" onClick={() => page.reload()}>
              Riprova
            </Button>
          </div>
        ) : !page.data ? (
          <div className="h-64 animate-pulse rounded-lg bg-sunk" aria-hidden />
        ) : items.length === 0 ? (
          <p className="rounded-lg border-2 border-dashed border-line px-6 py-12 text-center text-ink-2">
            Nessuna attività con questi filtri.
          </p>
        ) : (
          <>
            <ol className="divide-y divide-line overflow-hidden rounded-lg bg-surface ring-1 ring-line">
              {items.map((event) => (
                <EventRow key={event.id} event={event} names={names} />
              ))}
            </ol>
            {cursor && (
              <div className="mt-4 flex justify-center">
                <Button variant="secondary" loading={loadingMore} onClick={() => void loadMore()}>
                  Mostra altre
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function EventRow({ event, names }: { event: AuditEvent; names: Map<string, string> }) {
  const failed = event.action === "auth.login_failed";
  const actor =
    event.actor.type === "citizen"
      ? "Cittadino"
      : event.actor.type === "system"
        ? "Sistema"
        : (names.get(event.actor.id ?? "") ?? "Operatore");
  const subject =
    event.subjectOperatorId && event.subjectOperatorId !== event.actor.id
      ? names.get(event.subjectOperatorId)
      : undefined;

  return (
    <li
      className={cn(
        "grid gap-1 px-4 py-3 md:grid-cols-[11rem_minmax(0,1fr)_10rem] md:items-center md:gap-4",
        failed && "bg-warn-wash/50",
      )}
    >
      <time dateTime={event.at} className="text-sm text-ink-3 tabular-nums">
        {formatDateTime(event.at)}
      </time>
      <p className="min-w-0">
        {/* Who tried a failed login is unknown by definition: only the targeted account is. */}
        {!failed && <span className="font-semibold">{actor}</span>}{" "}
        <span className={cn(failed ? "text-warn" : "text-ink-2")}>
          {failed && <AlertTriangle className="me-1 inline size-3.5 align-[-2px]" aria-hidden />}
          {event.label}
        </span>
        {subject && <span className="text-ink-2"> · {subject}</span>}
      </p>
      <p className="text-sm md:text-end">
        {event.case ? (
          event.case.deleted ? (
            <span className="text-ink-3">{event.case.reference ?? "Pratica"} (eliminata)</span>
          ) : (
            <Link
              href={`/console/pratiche/${event.case.id}` as Route}
              className="font-mono text-stamp hover:underline"
            >
              {event.case.reference ?? "Apri"}
            </Link>
          )
        ) : null}
      </p>
    </li>
  );
}
