"use client";

import { Check, CheckCheck, ChevronDown, Eye, FileSearch, RefreshCw } from "lucide-react";
import { useState } from "react";
import type { CaseDossier } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/console/labels";
import { cn } from "@/lib/cn";
import type { DossierActions } from "./dossier-view";

type NearReady = NonNullable<CaseDossier["nearReady"]>;
type Reason = "identity" | "household" | "document_match" | "year" | "amount" | "other";

const REASONS: Record<Reason, string> = {
  identity: "Identità o intestatario",
  household: "Nucleo familiare",
  document_match: "Documento non abbinato bene",
  year: "Anno o scadenza",
  amount: "Importi",
  other: "Altro",
};
const CRITICAL: Record<string, string> = {
  identity: "Identità sbagliata",
  household: "Nucleo sbagliato",
  year: "Anno sbagliato",
  missing_document: "Documento obbligatorio mancante",
};

/**
 * The near-ready suggestion for this dossier. It never marks the case ready: it orders a quick
 * review, and in the pilot it first asks the operator's own judgement so the measure stays blind.
 */
export function NearReadyPanel({
  dossier,
  actions,
}: {
  dossier: CaseDossier;
  actions: DossierActions;
}) {
  const near = dossier.nearReady!;
  if (near.blindReviewRequired) return <BlindReview near={near} actions={actions} />;
  if (near.state === "suggested" || (near.state === "shadow" && near.mode === "visible"))
    return <Suggestion near={near} dossier={dossier} actions={actions} />;
  if (near.state === "accepted")
    return <Accepted near={near} dossier={dossier} actions={actions} />;
  // Also in shadow: a superseded check can no longer take a blind review until rechecked.
  if (near.state === "withdrawn") return <Superseded near={near} actions={actions} />;
  if (near.mode !== "visible") return null;
  if (near.state === "not_eligible" && near.exclusions.length > 0)
    return <NotEligible near={near} actions={actions} />;
  if (near.state === "dismissed")
    return (
      <p className="rounded-lg bg-sunk px-4 py-2.5 text-sm text-ink-2">
        Suggerimento di revisione rapida scartato.
      </p>
    );
  return null;
}

function Shell({
  tone = "ok",
  title,
  meta,
  children,
}: {
  tone?: "ok" | "neutral";
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        "overflow-hidden rounded-lg bg-surface ring-1",
        tone === "ok" ? "ring-ok/30" : "ring-line",
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3",
          tone === "ok" ? "bg-ok-wash/60" : "bg-sunk/60",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "grid size-7 place-items-center rounded-full",
            tone === "ok" ? "bg-ok text-on-stamp" : "bg-sunk text-ink-2",
          )}
        >
          <CheckCheck className="size-4" />
        </span>
        <h2 className="flex-1 basis-64 font-display text-lg font-semibold">{title}</h2>
        {meta && <span className="text-xs text-ink-3">{meta}</span>}
      </div>
      <div className="grid gap-4 p-5">{children}</div>
    </section>
  );
}

function BlindReview({ near, actions }: { near: NearReady; actions: DossierActions }) {
  const [ready, setReady] = useState<boolean | null>(null);
  const [reason, setReason] = useState<Reason>("other");
  const busy = actions.pending === "near:blind-review";
  return (
    <Shell
      tone="neutral"
      title="Prima di guardare: secondo te è pronta?"
      meta="Valutazione del pilota"
    >
      <p className="text-ink-2">
        Avanti ha già valutato se questa pratica si presta a una revisione rapida. Per misurare bene
        il pilota, dicci prima il tuo giudizio: poi vedrai il suggerimento.
      </p>
      <div role="radiogroup" aria-label="Il tuo giudizio" className="flex flex-wrap gap-2">
        {([true, false] as const).map((value) => (
          <button
            key={String(value)}
            type="button"
            role="radio"
            aria-checked={ready === value}
            onClick={() => setReady(value)}
            className={cn(
              "h-10 rounded-full px-4 text-sm font-semibold ring-1 transition-colors",
              ready === value
                ? "bg-contrast text-on-contrast ring-contrast"
                : "text-ink-2 ring-line-strong hover:bg-sunk",
            )}
          >
            {value ? "Sì, mi sembra pronta" : "No, non ancora"}
          </button>
        ))}
      </div>
      {ready === false && (
        <ReasonSelect value={reason} onChange={setReason} label="Che cosa manca, soprattutto?" />
      )}
      <div>
        <Button
          disabled={ready === null}
          loading={busy}
          onClick={() => void actions.nearReady("blind-review", { ready, reason })}
        >
          Registra e mostra il suggerimento
        </Button>
      </div>
      <Checked near={near} />
    </Shell>
  );
}

function Suggestion({
  near,
  dossier,
  actions,
}: {
  near: NearReady;
  dossier: CaseDossier;
  actions: DossierActions;
}) {
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState<Reason>("other");
  const [note, setNote] = useState("");
  return (
    <Shell
      title="Quasi pronta: revisione rapida suggerita"
      meta={`Controllata ${formatDateTime(near.checkedAt)}`}
    >
      <div className="grid gap-5 md:grid-cols-2">
        <List title="Cosa risulta già" icon="check" items={near.conditionsMet} />
        <List title="Da controllare a vista" icon="eye" items={near.visualChecks} />
      </div>
      {near.criticalFields.length > 0 && <Fields near={near} dossier={dossier} actions={actions} />}
      {dismissing ? (
        <div className="grid gap-3 rounded-md bg-paper p-4 ring-1 ring-line">
          <ReasonSelect value={reason} onChange={setReason} label="Perché non è quasi pronta?" />
          <label className="grid gap-1 text-sm">
            <span className="font-semibold">Nota (facoltativa, senza dati del cittadino)</span>
            <textarea
              value={note}
              maxLength={1000}
              rows={2}
              onChange={(e) => setNote(e.target.value)}
              className="w-full resize-y rounded-sm bg-surface p-2.5 ring-1 ring-line-strong ring-inset focus:ring-2 focus:ring-stamp focus:outline-none"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              loading={actions.pending === "near:decision"}
              onClick={() =>
                void actions.nearReady("decision", {
                  evaluationId: near.evaluationId,
                  decision: "dismiss",
                  reason,
                  ...(note.trim() ? { note: note.trim() } : {}),
                })
              }
            >
              Scarta il suggerimento
            </Button>
            <Button variant="ghost" onClick={() => setDismissing(false)}>
              Annulla
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            loading={actions.pending === "near:decision"}
            onClick={() =>
              void actions.nearReady("decision", {
                evaluationId: near.evaluationId,
                decision: "accept",
              })
            }
          >
            <Check className="size-4" aria-hidden />
            Usa la revisione rapida
          </Button>
          <Button variant="ghost" onClick={() => setDismissing(true)}>
            Non è quasi pronta
          </Button>
        </div>
      )}
      <p className="text-xs text-ink-3">
        Il suggerimento non segna la pratica come pronta: lo decidi tu, dopo i controlli.
      </p>
    </Shell>
  );
}

function Accepted({
  near,
  dossier,
  actions,
}: {
  near: NearReady;
  dossier: CaseDossier;
  actions: DossierActions;
}) {
  const [notReady, setNotReady] = useState(false);
  const [reason, setReason] = useState<Reason>("other");
  const [critical, setCritical] = useState("");
  // reviewOrder lists document IDs: show each checklist item once, at its first document.
  const order = [
    ...new Set(
      near.reviewOrder.flatMap((id) => {
        const item = dossier.checklist.find((entry) => entry.documentIds.includes(id));
        return item ? [item] : [];
      }),
    ),
  ];
  return (
    <Shell title="Revisione rapida in corso" meta={`Controllata ${formatDateTime(near.checkedAt)}`}>
      {order.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-ink-2">Controlla in quest&apos;ordine</h3>
          <ol className="mt-2 grid gap-1.5">
            {order.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() =>
                    document
                      .getElementById(`item-${item.id}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "center" })
                  }
                  className="flex w-full items-center gap-3 rounded-sm px-2 py-1.5 text-start hover:bg-sunk"
                >
                  <span className="tabular grid size-5 shrink-0 place-items-center rounded-full bg-sunk text-xs font-semibold text-ink-2">
                    {index + 1}
                  </span>
                  <span
                    className="min-w-0 flex-1 truncate"
                    title={item.memberName ? `${item.title} · ${item.memberName}` : item.title}
                  >
                    {item.title}
                    {item.memberName && <span className="text-ink-3"> · {item.memberName}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
      <List title="Da controllare a vista" icon="eye" items={near.visualChecks} />
      {notReady ? (
        <div className="grid gap-3 rounded-md bg-paper p-4 ring-1 ring-line">
          <ReasonSelect value={reason} onChange={setReason} label="Che cosa non andava?" />
          <label className="grid gap-1 text-sm">
            <span className="font-semibold">Era un errore grave?</span>
            <select
              value={critical}
              onChange={(e) => setCritical(e.target.value)}
              className="h-10 rounded-sm bg-surface px-2.5 ring-1 ring-line-strong ring-inset"
            >
              <option value="">No</option>
              {Object.entries(CRITICAL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {critical && (
              <span className="text-warn">
                Un errore grave sospende il suggerimento per tutto il CAF finché un amministratore
                non lo riattiva.
              </span>
            )}
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              loading={actions.pending === "near:final-decision"}
              onClick={() =>
                void actions.nearReady("final-decision", {
                  ready: false,
                  reason,
                  ...(critical ? { criticalError: critical } : {}),
                })
              }
            >
              Registra l&apos;esito
            </Button>
            <Button variant="ghost" onClick={() => setNotReady(false)}>
              Annulla
            </Button>
          </div>
        </div>
      ) : (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
          Se è tutto in ordine, segnala pronta come sempre.
          <button
            type="button"
            onClick={() => setNotReady(true)}
            className="font-semibold text-stamp underline underline-offset-2"
          >
            Non era pronta
          </button>
        </p>
      )}
    </Shell>
  );
}

function Superseded({ near, actions }: { near: NearReady; actions: DossierActions }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-sunk px-4 py-2.5 text-sm text-ink-2">
      <p className="min-w-0 flex-1 basis-64">
        {near.mode === "visible"
          ? "La pratica è cambiata: il suggerimento di revisione rapida è stato ritirato."
          : "La pratica è cambiata dopo l'ultimo controllo di revisione rapida."}
      </p>
      <Recheck actions={actions} />
    </div>
  );
}

function Recheck({ actions }: { actions: DossierActions }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      loading={actions.pending === "near:evaluate"}
      onClick={() => void actions.nearReady("evaluate", {})}
    >
      <RefreshCw className="size-3.5" aria-hidden />
      Ricontrolla
    </Button>
  );
}

function NotEligible({ near, actions }: { near: NearReady; actions: DossierActions }) {
  return (
    <details className="group rounded-lg bg-surface ring-1 ring-line">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3 text-sm [&::-webkit-details-marker]:hidden">
        <CheckCheck className="size-4 text-ink-3" aria-hidden />
        <span className="flex-1 text-ink-2">Non è una pratica da revisione rapida</span>
        <ChevronDown
          className="size-4 text-ink-3 transition-transform duration-200 group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="grid gap-3 border-t border-line px-5 py-4">
        <ul className="grid gap-1.5 text-sm text-ink-2">
          {near.exclusions.map((exclusion) => (
            <li key={exclusion.code} className="flex gap-2">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-ink-3" />
              {exclusion.text}
            </li>
          ))}
        </ul>
        <div>
          <Recheck actions={actions} />
        </div>
      </div>
    </details>
  );
}

function List({ title, icon, items }: { title: string; icon: "check" | "eye"; items: string[] }) {
  if (items.length === 0) return null;
  const Icon = icon === "check" ? Check : Eye;
  return (
    <div>
      <h3 className="text-sm font-semibold text-ink-2">{title}</h3>
      <ul className="mt-2 grid gap-1.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-body-sm">
            <Icon
              className={cn("mt-0.5 size-4 shrink-0", icon === "check" ? "text-ok" : "text-ink-3")}
              aria-hidden
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Fields({
  near,
  dossier,
  actions,
}: {
  near: NearReady;
  dossier: CaseDossier;
  actions: DossierActions;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-ink-2">Dati decisivi e da dove vengono</h3>
      <ul className="mt-2 divide-y divide-line rounded-md ring-1 ring-line">
        {near.criticalFields.map((field) => {
          const doc = field.documentId
            ? dossier.documents.find((d) => d.id === field.documentId)
            : undefined;
          return (
            <li
              key={field.fieldId}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm"
            >
              <span className="min-w-0 flex-1 font-semibold">
                {field.label}
                {field.critical && (
                  <span className="ms-1.5 text-xs font-normal text-ink-3">critico</span>
                )}
              </span>
              {doc ? (
                <button
                  type="button"
                  onClick={() => actions.openDocument(doc)}
                  className="inline-flex items-center gap-1 text-stamp underline underline-offset-2"
                >
                  <FileSearch className="size-3.5" aria-hidden />
                  {doc.analysis?.detectedLabel ?? doc.fileName}
                  {field.page ? `, p. ${field.page}` : ""}
                </button>
              ) : (
                <span className="text-ink-3">
                  {field.source === "answer" ? "Risposta del cittadino" : "Verificato a mano"}
                </span>
              )}
              <span className="tabular text-xs text-ink-3">
                {field.source === "ai" ? `lettura ${Math.round(field.confidence * 100)}%` : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ReasonSelect({
  value,
  onChange,
  label,
}: {
  value: Reason;
  onChange: (value: Reason) => void;
  label: string;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-semibold">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Reason)}
        className="h-10 rounded-sm bg-surface px-2.5 ring-1 ring-line-strong ring-inset"
      >
        {Object.entries(REASONS).map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

function Checked({ near }: { near: NearReady }) {
  return <p className="text-xs text-ink-3">Controllata {formatDateTime(near.checkedAt)}</p>;
}
