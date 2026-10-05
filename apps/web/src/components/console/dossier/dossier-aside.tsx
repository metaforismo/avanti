"use client";

import { Check, Copy, Mail, Phone } from "lucide-react";
import { useState } from "react";
import type { CaseDossier } from "@avanti/contracts";
import { Spinner } from "@/components/ui/spinner";
import { formatDateTime, formatMinutes, LANGUAGE_IT, timeAgo } from "@/lib/console/labels";
import { cn } from "@/lib/cn";
import type { DossierActions } from "./dossier-view";

export function DossierAside({
  dossier,
  actions,
}: {
  dossier: CaseDossier;
  actions: DossierActions;
}) {
  const { citizen } = dossier;
  return (
    <aside className="grid content-start gap-5">
      <Card title="Cittadino">
        <dl className="grid gap-3 text-[0.9375rem]">
          <div>
            <dt className="sr-only">Nome</dt>
            <dd className="font-semibold">
              {[citizen.firstName, citizen.lastName].filter(Boolean).join(" ") || "Non indicato"}
            </dd>
            <dd className="text-sm text-ink-3">Lingua: {LANGUAGE_IT[dossier.language]}</dd>
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
        </dl>
        {dossier.citizenLink && <CopyLink link={dossier.citizenLink} />}
        {dossier.citizenNote && (
          <div className="mt-4 rounded-sm bg-marker-soft px-3 py-2.5 text-[0.9375rem]">
            <p className="text-xs font-semibold text-ink-2">Nota del cittadino</p>
            <p className="mt-1 whitespace-pre-line">{dossier.citizenNote}</p>
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

      <Card title="Cronologia">
        <ol className="relative grid gap-4 border-s border-line ps-4">
          {[...dossier.timeline].reverse().map((event) => (
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
              <p className="text-[0.9375rem]">{event.label}</p>
              <p className="text-xs text-ink-3">
                {event.actorName ? `${event.actorName}, ` : ""}
                <time dateTime={event.at} title={formatDateTime(event.at)}>
                  {timeAgo(event.at)}
                </time>
              </p>
            </li>
          ))}
        </ol>
      </Card>
    </aside>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg bg-surface p-4 ring-1 ring-line">
      <h2 className="mb-3 text-sm font-semibold text-ink-2">{title}</h2>
      {children}
    </section>
  );
}

function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(link);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {}
      }}
      className="mt-4 inline-flex items-center gap-2 rounded-sm text-sm font-semibold text-stamp hover:underline"
    >
      {copied ? (
        <Check className="size-4 text-ok" aria-hidden />
      ) : (
        <Copy className="size-4" aria-hidden />
      )}
      {copied ? "Link copiato" : "Copia il link del cittadino"}
    </button>
  );
}

function InternalNotes({ dossier, actions }: { dossier: CaseDossier; actions: DossierActions }) {
  const [value, setValue] = useState(dossier.internalNotes ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const dirty = value !== (dossier.internalNotes ?? "");

  async function save() {
    if (!dirty) return;
    setState("saving");
    const ok = await actions.update({ internalNotes: value.trim() ? value : null });
    setState(ok ? "saved" : "error");
  }

  return (
    <section className="rounded-lg bg-surface p-4 ring-1 ring-line">
      <div className="mb-2 flex items-center justify-between">
        <label htmlFor="internal-notes" className="text-sm font-semibold text-ink-2">
          Note interne
        </label>
        <span className="text-xs text-ink-3" aria-live="polite">
          {state === "saving" ? (
            <Spinner className="size-3.5" label="Salvataggio" />
          ) : state === "saved" && !dirty ? (
            "Salvate"
          ) : state === "error" ? (
            "Non salvate"
          ) : (
            ""
          )}
        </span>
      </div>
      <textarea
        id="internal-notes"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setState("idle");
        }}
        onBlur={() => void save()}
        rows={4}
        maxLength={5000}
        placeholder="Visibili solo agli operatori del CAF"
        className="w-full resize-y rounded-sm bg-paper p-2.5 text-[0.9375rem] ring-1 ring-line ring-inset placeholder:text-ink-3 focus:ring-2 focus:ring-stamp focus:outline-none"
      />
    </section>
  );
}
