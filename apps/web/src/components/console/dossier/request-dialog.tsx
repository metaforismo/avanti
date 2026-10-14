"use client";

import { useRef, useState, type FormEvent } from "react";
import type { CaseDossier } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { LANGUAGE_IT } from "@/lib/console/labels";

const NEEDS_ACTION = new Set(["missing", "rejected", "issue"]);

export function RequestDialog({
  open,
  onOpenChange,
  dossier,
  onSent,
  onConflict,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dossier: CaseDossier;
  onSent: (result: CaseDossier | null) => void;
  /** The case changed since it was read: reload it, keeping this draft. */
  onConflict: () => void;
}) {
  const edited = useRef(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // A hand-written message is not lost to a stray Esc or click outside.
        if (!next && edited.current && !window.confirm("Scartare il messaggio non inviato?"))
          return;
        if (!next) edited.current = false;
        onOpenChange(next);
      }}
      title="Chiedi un'integrazione"
      description={
        dossier.language === "it"
          ? "Il cittadino la vede nel suo link e la pratica passa in attesa."
          : `Scrivi in italiano: il cittadino la riceve tradotta in ${LANGUAGE_IT[dossier.language].toLowerCase()}.`
      }
    >
      {open && (
        <RequestForm
          dossier={dossier}
          onEdited={() => (edited.current = true)}
          onConflict={onConflict}
          onDone={(result) => {
            edited.current = false;
            onSent(result);
            onOpenChange(false);
          }}
        />
      )}
    </Dialog>
  );
}

// Long lists would hit the 1000-character limit and are unreadable on a phone anyway:
// past this size the message points to the list the citizen already sees in the link.
const MAX_LISTED = 6;

function defaultMessage(dossier: CaseDossier, titles: string[]) {
  const name = dossier.citizen.firstName ? ` ${dossier.citizen.firstName}` : "";
  if (titles.length === 0)
    return `Buongiorno${name}, per completare la pratica ci serve ancora qualcosa. `;
  if (titles.length > MAX_LISTED) {
    return `Buongiorno${name}, per completare la pratica ci servono ancora ${titles.length} documenti. Li trovi elencati nel tuo link: puoi caricarli da lì. Grazie.`;
  }
  return `Buongiorno${name}, per completare la pratica ci servono ancora:\n${titles.map((t) => `- ${t}`).join("\n")}\nPuoi caricarli dallo stesso link. Grazie.`;
}

function RequestForm({
  dossier,
  onDone,
  onEdited,
  onConflict,
}: {
  dossier: CaseDossier;
  onEdited: () => void;
  onDone: (result: CaseDossier | null) => void;
  onConflict: () => void;
}) {
  const candidates = dossier.checklist.filter((item) => NEEDS_ACTION.has(item.status));
  const others = dossier.checklist.filter((item) => !NEEDS_ACTION.has(item.status));
  const [selected, setSelected] = useState<string[]>(
    candidates.filter((i) => i.required).map((i) => i.id),
  );
  const label = (id: string) => {
    const item = dossier.checklist.find((i) => i.id === id);
    return item ? (item.memberName ? `${item.title} di ${item.memberName}` : item.title) : "";
  };
  const [message, setMessage] = useState(() => defaultMessage(dossier, selected.map(label)));
  const [touched, setTouched] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string, on: boolean) => {
    const next = on ? [...selected, id] : selected.filter((x) => x !== id);
    setSelected(next);
    // Keep the drafted text in sync until the operator edits it by hand.
    if (!touched) setMessage(defaultMessage(dossier, next.map(label)));
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!message.trim()) {
      setError("Scrivi il messaggio per il cittadino.");
      document.getElementById("request-message")?.focus();
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await apiFetch<CaseDossier | { ok: true }>(
        `/api/cases/${dossier.id}/requests`,
        {
          method: "POST",
          body: {
            checklistItemIds: selected,
            message: message.trim(),
            expectedUpdatedAt: dossier.updatedAt,
          },
        },
      );
      onDone(result && "checklist" in result ? result : null);
    } catch (err) {
      setPending(false);
      if (err instanceof ApiRequestError && err.code === "conflict") {
        // The draft stays: the case is reloaded and the operator checks before sending again.
        onConflict();
        setError(
          "La pratica è cambiata mentre scrivevi (per esempio è arrivato un documento). Abbiamo aggiornato il fascicolo: controlla le voci e invia di nuovo.",
        );
        return;
      }
      setError(err instanceof ApiRequestError ? err.message : "Invio non riuscito. Riprova.");
    }
  }

  const renderItem = (item: (typeof dossier.checklist)[number]) => (
    <label
      key={item.id}
      className="flex cursor-pointer items-start gap-3 rounded-sm px-2 py-2 hover:bg-paper"
    >
      <input
        type="checkbox"
        checked={selected.includes(item.id)}
        onChange={(e) => toggle(item.id, e.target.checked)}
        className="mt-0.5 size-4.5 shrink-0 accent-stamp"
      />
      <span className="text-[0.9375rem]">
        {item.title}
        {item.memberName && <span className="text-ink-3"> · {item.memberName}</span>}
      </span>
    </label>
  );

  return (
    <form onSubmit={submit} className="grid gap-4">
      <fieldset>
        <legend className="mb-1 text-sm font-semibold">Voci da completare</legend>
        <div className="max-h-56 overflow-y-auto rounded-md ring-1 ring-line">
          {candidates.map(renderItem)}
          {others.length > 0 && (
            <details className="border-t border-line">
              <summary className="cursor-pointer px-2 py-2 text-sm text-ink-3">
                Altre voci ({others.length})
              </summary>
              {others.map(renderItem)}
            </details>
          )}
        </div>
      </fieldset>
      <div className="grid gap-1.5">
        <label htmlFor="request-message" className="text-sm font-semibold">
          Messaggio
        </label>
        <textarea
          id="request-message"
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            setTouched(true);
            setError(null);
            onEdited();
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "request-error" : undefined}
          rows={6}
          maxLength={1000}
          className="w-full resize-y rounded-sm bg-surface p-3 text-[0.9375rem] ring-1 ring-line-strong ring-inset focus:ring-2 focus:ring-stamp focus:outline-none"
        />
        <p className="tabular text-right text-xs text-ink-3">{message.length}/1000</p>
      </div>
      {error && (
        <p
          id="request-error"
          role="alert"
          className="rounded-md bg-danger-wash px-4 py-3 text-sm text-danger"
        >
          {error}
        </p>
      )}
      <Button type="submit" size="lg" loading={pending}>
        Invia al cittadino
      </Button>
    </form>
  );
}
