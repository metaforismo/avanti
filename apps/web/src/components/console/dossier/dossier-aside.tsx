"use client";

import { Mail, Phone } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CaseDossier } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Notice } from "@/components/ui/notice";
import { Spinner } from "@/components/ui/spinner";
import {
  formatDateTime,
  formatMinutes,
  fullName,
  LANGUAGE_IT,
  timeAgo,
} from "@/lib/console/labels";
import { cn } from "@/lib/cn";
import { CitizenNoticeStatus } from "../citizen-notice";
import type { DossierActions } from "./dossier-view";

export function DossierAside({
  dossier,
  actions,
  onNotify,
}: {
  dossier: CaseDossier;
  actions: DossierActions;
  onNotify: () => void;
}) {
  const { citizen } = dossier;
  return (
    <aside className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-5">
      <Card title="Cittadino">
        <div className="grid gap-3 text-body-sm">
          <div>
            <p className="font-semibold">{fullName(citizen) ?? "Non indicato"}</p>
            <p className="text-sm text-ink-3">Lingua: {LANGUAGE_IT[dossier.language]}</p>
          </div>
          {citizen.phone && (
            <a
              href={`tel:${citizen.phone.replace(/\s+/g, "")}`}
              className="flex items-center gap-2 text-stamp hover:underline"
            >
              <Phone className="size-4" aria-hidden />
              {citizen.phone}
            </a>
          )}
          {citizen.email && (
            <a
              href={`mailto:${citizen.email}`}
              className="flex items-center gap-2 break-all text-stamp hover:underline"
            >
              <Mail className="size-4 shrink-0" aria-hidden />
              {citizen.email}
            </a>
          )}
        </div>
        <CitizenNoticeStatus dossier={dossier} onNotify={onNotify} />
        {dossier.citizenLink && (
          <CopyButton
            value={dossier.citizenLink}
            size="sm"
            className="mt-4"
            labels={{
              copy: "Copia il link del cittadino",
              copied: "Link copiato",
              failed: "Copia non riuscita: seleziona il link e copialo a mano.",
            }}
          />
        )}
        {dossier.citizenNote && (
          <div className="mt-4 rounded-sm bg-marker-soft px-3 py-2.5 text-body-sm">
            <p className="text-xs font-semibold text-ink-2">Nota del cittadino</p>
            <p dir="auto" className="mt-1 whitespace-pre-line">
              {dossier.citizenNote}
            </p>
          </div>
        )}
      </Card>

      <Card title="Tempi misurati">
        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-sm text-ink-3">Cittadino</dt>
            <dd className="tabular font-display text-xl font-semibold">
              {formatMinutes(dossier.timing.citizenMinutes)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-3">Revisione</dt>
            <dd className="tabular font-display text-xl font-semibold">
              {formatMinutes(dossier.timing.reviewMinutes)}
            </dd>
          </div>
        </dl>
        {dossier.submittedAt && (
          <p className="mt-3 text-sm text-ink-3">Inviata {formatDateTime(dossier.submittedAt)}</p>
        )}
      </Card>

      <InternalNotes dossier={dossier} actions={actions} />

      <Timeline timeline={dossier.timeline} />
    </aside>
  );
}

// Every opening of the dossier is an event: after a few days of work the full history would
// push the side column far below the checklist. The latest events first, the rest on request.
const TIMELINE_SHOWN = 6;

function Timeline({ timeline }: { timeline: CaseDossier["timeline"] }) {
  const [all, setAll] = useState(false);
  const rows = collapseTimeline(timeline);
  // Never a button that hides a single event: it would take the same room as the event.
  const hidden = rows.length > TIMELINE_SHOWN + 1 ? rows.length - TIMELINE_SHOWN : 0;
  const shown = all || hidden === 0 ? rows : rows.slice(0, TIMELINE_SHOWN);
  return (
    <Card title="Cronologia">
      <ol id="dossier-timeline" className="relative grid gap-4 border-s border-line ps-4">
        {shown.map(({ event, count }) => (
          <li key={event.id} className="relative">
            <span
              aria-hidden
              className={cn(
                "absolute -start-[1.3rem] top-1.5 size-2 rounded-full ring-2 ring-surface",
                event.actor === "operator"
                  ? "bg-stamp"
                  : event.actor === "citizen"
                    ? "bg-ok"
                    : "bg-line-strong",
              )}
            />
            <p className="text-body-sm">
              {event.label}
              {count > 1 && <span className="text-ink-3"> ({count} volte)</span>}
            </p>
            <p className="text-xs text-ink-3">
              {event.actorName ? `${event.actorName}, ` : ""}
              <time dateTime={event.at} title={formatDateTime(event.at)}>
                {timeAgo(event.at)}
              </time>
            </p>
          </li>
        ))}
      </ol>
      {hidden > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="-ms-3 mt-3"
          aria-expanded={all}
          aria-controls="dossier-timeline"
          onClick={() => setAll((v) => !v)}
        >
          {all ? "Mostra solo gli ultimi" : `Mostra altri ${hidden} eventi`}
        </Button>
      )}
    </Card>
  );
}

/** Newest first; consecutive identical events (e.g. many answers) become one line. */
function collapseTimeline(timeline: CaseDossier["timeline"]) {
  const rows: { event: CaseDossier["timeline"][number]; count: number }[] = [];
  for (const event of [...timeline].reverse()) {
    const last = rows.at(-1);
    if (last && last.event.type === event.type && last.event.actorName === event.actorName)
      last.count += 1;
    else rows.push({ event, count: 1 });
  }
  return rows;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg bg-surface p-4 ring-1 ring-line">
      <h2 className="mb-3 text-sm font-semibold text-ink-2">{title}</h2>
      {children}
    </section>
  );
}

const AUTOSAVE_MS = 1200;

function InternalNotes({ dossier, actions }: { dossier: CaseDossier; actions: DossierActions }) {
  const [value, setValue] = useState(dossier.internalNotes ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saved = dossier.internalNotes ?? "";
  // The notes this draft started from: if the saved ones moved on, a colleague edited them.
  const [base, setBase] = useState(saved);
  const colleagueEdited = state === "error" && saved !== base;
  const dirty = value !== saved;
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);

  const save = useCallback(async () => {
    const text = latest.current;
    if (text === saved) return;
    setBase(saved);
    setState("saving");
    const ok = await actions.update({ internalNotes: text.trim() ? text : null }, "notes");
    setState(ok ? "saved" : "error");
  }, [actions, saved]);

  // Autosave after a pause in typing, so leaving the page rarely loses anything.
  useEffect(() => {
    // After a failure only the operator retries: an automatic save could overwrite a colleague.
    if (!dirty || state === "error") return;
    const id = window.setTimeout(() => void save(), AUTOSAVE_MS);
    return () => window.clearTimeout(id);
  }, [dirty, value, save, state]);

  // …and if it would, the browser asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return (
    <section className="rounded-lg bg-surface p-4 ring-1 ring-line">
      <div className="mb-2 flex min-h-6 items-center justify-between gap-2">
        <label htmlFor="internal-notes" className="text-sm font-semibold text-ink-2">
          Note interne
        </label>
        <span className="text-xs text-ink-3" role="status">
          {state === "saving" ? (
            <Spinner className="size-3.5" label="Salvataggio" />
          ) : state === "saved" && !dirty ? (
            "Salvate"
          ) : null}
        </span>
      </div>
      <textarea
        id="internal-notes"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (state !== "saving") setState("idle");
        }}
        onBlur={() => void save()}
        rows={4}
        maxLength={5000}
        placeholder="Visibili solo agli operatori del CAF…"
        className="w-full resize-y rounded-sm bg-paper p-2.5 text-body-sm ring-1 ring-line ring-inset placeholder:text-ink-3 focus:ring-2 focus:ring-stamp focus:outline-none"
      />
      {colleagueEdited ? (
        <Notice
          tone="warn"
          role="alert"
          className="mt-2"
          title="Un collega ha cambiato le note mentre scrivevi."
          action={
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => void save()}>
                Tieni la mia versione
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setValue(saved);
                  setState("idle");
                }}
              >
                Usa la sua
              </Button>
            </div>
          }
        >
          <p className="whitespace-pre-line text-ink-2">{saved || "(note vuote)"}</p>
        </Notice>
      ) : (
        state === "error" && (
          <div
            role="alert"
            className="mt-2 flex items-center justify-between gap-2 text-sm text-danger"
          >
            Note non salvate.
            <Button size="sm" variant="secondary" onClick={() => void save()}>
              Riprova
            </Button>
          </div>
        )
      )}
    </section>
  );
}
