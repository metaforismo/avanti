"use client";

import { Sparkles } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import type { CaseDossier, ChatMessage, QuickReply, ReplyDraftResponse } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { createRetryKeys, withRetryKey } from "@/lib/idempotency";
import { MAX_LISTED } from "@/lib/console/citizen-notice";
import { LANGUAGE_IT } from "@/lib/console/labels";
import { useResource } from "@/lib/console/use-resource";

const NEEDS_ACTION = new Set(["missing", "rejected", "issue"]);

/** Answering a citizen's question: the dialog opens on the draft, with nothing ticked. */
export type ReplyContext = { question: ChatMessage; draft: ReplyDraftResponse };

export function RequestDialog({
  open,
  onOpenChange,
  dossier,
  onSent,
  onConflict,
  reply = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dossier: CaseDossier;
  reply?: ReplyContext | null;
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
      title={reply ? "Rispondi al cittadino" : "Chiedi un'integrazione"}
      description={
        dossier.language === "it"
          ? "Il cittadino la vede nel suo link e la pratica passa in attesa."
          : `Scrivi in italiano: il cittadino la riceve tradotta in ${LANGUAGE_IT[dossier.language].toLowerCase()}.`
      }
    >
      {open && (
        <RequestForm
          dossier={dossier}
          reply={reply}
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

function defaultMessage(dossier: CaseDossier, titles: string[]) {
  const name = dossier.citizen.firstName ? ` ${dossier.citizen.firstName}` : "";
  if (titles.length === 0)
    return `Buongiorno${name}, per completare la pratica ci serve ancora qualcosa. `;
  if (titles.length > MAX_LISTED) {
    return `Buongiorno${name}, per completare la pratica ci servono ancora ${titles.length} documenti. Li trovi elencati nel tuo link: puoi caricarli da lì. Grazie.`;
  }
  const [need, upload] =
    titles.length === 1 ? ["ci serve", "caricarlo"] : ["ci servono", "caricarli"];
  return `Buongiorno${name}, per completare la pratica ${need} ancora:\n${titles.map((t) => `- ${t}`).join("\n")}\nPuoi ${upload} dallo stesso link. Grazie.`;
}

function RequestForm({
  dossier,
  reply,
  onDone,
  onEdited,
  onConflict,
}: {
  dossier: CaseDossier;
  reply: ReplyContext | null;
  onEdited: () => void;
  onDone: (result: CaseDossier | null) => void;
  onConflict: () => void;
}) {
  const candidates = dossier.checklist.filter((item) => NEEDS_ACTION.has(item.status));
  const others = dossier.checklist.filter((item) => !NEEDS_ACTION.has(item.status));
  const [selected, setSelected] = useState<string[]>(
    reply ? [] : candidates.filter((i) => i.required).map((i) => i.id),
  );
  const label = (id: string) => {
    const item = dossier.checklist.find((i) => i.id === id);
    return item ? (item.memberName ? `${item.title} di ${item.memberName}` : item.title) : "";
  };
  const [message, setMessage] = useState(() =>
    reply ? reply.draft.message.slice(0, 1000) : defaultMessage(dossier, selected.map(label)),
  );
  const [touched, setTouched] = useState(Boolean(reply));
  const replies = useResource<QuickReply[]>("/api/quick-replies");
  const [notice, setNotice] = useState<string | null>(() =>
    !reply
      ? null
      : reply.draft.engine === "ai"
        ? "Bozza scritta dall'AI: controllala prima di inviare."
        : "AI non disponibile: scrivi tu la risposta.",
  );
  const [drafting, setDrafting] = useState(false);

  // A draft replaces the text like a typed message would: the operator then edits it.
  async function draftWithAi() {
    setDrafting(true);
    setError(null);
    try {
      const draft = await apiFetch<{ message: string; engine: "ai" | "heuristic" }>(
        `/api/cases/${dossier.id}/ai/request-draft`,
        { method: "POST", body: { checklistItemIds: selected } },
      );
      setMessage(draft.message.slice(0, 1000));
      setTouched(true);
      onEdited();
      setNotice(
        draft.engine === "ai"
          ? "Bozza scritta dall'AI: controllala prima di inviare."
          : "AI non disponibile: bozza standard dalle voci selezionate.",
      );
      requestAnimationFrame(() => textarea.current?.focus());
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Bozza non disponibile. Riprova.");
    } finally {
      setDrafting(false);
    }
  }
  const textarea = useRef<HTMLTextAreaElement>(null);
  const caretSet = useRef(false);

  // A quick reply goes where the cursor is (or at the end), as if typed: the draft is then
  // the operator's own and no longer follows the ticked items.
  const insertReply = (reply: QuickReply) => {
    const field = textarea.current;
    // Before the field is ever focused its caret sits at 0: append instead of prefixing.
    // (Clicking the reply button blurs the field, but the caret position survives the blur.)
    const known = field !== null && caretSet.current;
    const start = known ? field.selectionStart : message.length;
    const end = known ? field.selectionEnd : message.length;
    const before = message.slice(0, start).replace(/\s*$/, "");
    const after = message.slice(end).replace(/^\s*/, "");
    const glue = (left: string, right: string) =>
      left && right ? `${left}\n${right}` : left || right;
    const full = glue(glue(before, reply.text), after);
    const next = full.slice(0, 1000);
    setMessage(next);
    if (full.length > 1000)
      setNotice(
        "Il messaggio ha superato i 1000 caratteri ed è stato tagliato: controlla la fine.",
      );
    setTouched(true);
    setError(null);
    onEdited();
    requestAnimationFrame(() => {
      const caret = Math.min(next.length, glue(before, reply.text).length);
      field?.focus();
      field?.setSelectionRange(caret, caret);
    });
  };
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Sending again after a lost response must not send the citizen the request twice.
  const keys = useRef(createRetryKeys());

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
      const payload = { checklistItemIds: selected, message: message.trim() };
      const result = await withRetryKey(keys.current, "request", payload, (headers) =>
        apiFetch<CaseDossier | { ok: true }>(`/api/cases/${dossier.id}/requests`, {
          method: "POST",
          body: { ...payload, expectedUpdatedAt: dossier.updatedAt },
          headers,
        }),
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
    <Checkbox
      key={item.id}
      checked={selected.includes(item.id)}
      onChange={(e) => toggle(item.id, e.target.checked)}
      className="rounded-sm px-2 py-2 text-body-sm hover:bg-paper"
      label={
        <>
          {item.title}
          {item.memberName && <span className="text-ink-3"> · {item.memberName}</span>}
        </>
      }
    />
  );

  const items = (
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
  );

  return (
    <form onSubmit={submit} className="grid gap-4">
      {reply ? (
        <>
          <figure className="rounded-md bg-stamp-wash px-4 py-3">
            <figcaption className="text-xs font-semibold text-ink-3">
              Il cittadino ha scritto
            </figcaption>
            <blockquote dir="auto" className="mt-1 whitespace-pre-line">
              {reply.question.text}
            </blockquote>
            {reply.question.originalText && reply.question.originalText !== reply.question.text && (
              <p dir="auto" className="mt-2 border-t border-stamp/15 pt-2 text-sm text-ink-3">
                Originale: {reply.question.originalText}
              </p>
            )}
          </figure>
          <details className="rounded-md ring-1 ring-line">
            <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">
              Chiedi anche dei documenti{selected.length > 0 ? ` (${selected.length})` : ""}
            </summary>
            <div className="border-t border-line p-2">{items}</div>
          </details>
        </>
      ) : (
        <fieldset>
          <legend className="mb-1 text-sm font-semibold">Voci da completare</legend>
          {items}
        </fieldset>
      )}
      <div className="grid gap-1.5">
        <label htmlFor="request-message" className="text-sm font-semibold">
          Messaggio
        </label>
        {!reply && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={drafting}
              disabled={selected.length === 0}
              onClick={() => void draftWithAi()}
            >
              <Sparkles className="size-4 text-stamp" aria-hidden />
              Bozza con l&apos;AI
            </Button>
            <span className="text-xs text-ink-3">
              Scrive il messaggio dalle voci selezionate: rileggilo prima di inviare.
            </span>
          </div>
        )}
        {replies.data && replies.data.length > 0 && (
          <div role="group" aria-label="Risposte rapide" className="flex flex-wrap gap-1.5">
            {replies.data.map((reply) => (
              <button
                key={reply.id}
                type="button"
                title={reply.text}
                onClick={() => insertReply(reply)}
                className="rounded-full bg-sunk px-3 py-1 text-sm text-ink-2 transition-colors hover:bg-stamp-wash hover:text-ink focus-visible:ring-2 focus-visible:ring-stamp focus-visible:outline-none"
              >
                + {reply.title}
              </button>
            ))}
          </div>
        )}
        <textarea
          ref={textarea}
          onFocus={() => (caretSet.current = true)}
          id="request-message"
          value={message}
          onChange={(e) => {
            setNotice(null);
            setMessage(e.target.value);
            setTouched(true);
            setError(null);
            onEdited();
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "request-error" : undefined}
          rows={6}
          maxLength={1000}
          className="w-full resize-y rounded-sm bg-surface p-3 text-body-sm ring-1 ring-line-strong ring-inset focus:ring-2 focus:ring-stamp focus:outline-none"
        />
        <p className="tabular text-end text-xs text-ink-3">{message.length}/1000</p>
        <p role="status" className={notice ? "text-sm text-warn" : "sr-only"}>
          {notice}
        </p>
        {reply && reply.draft.citations.length > 0 && (
          <div className="text-sm text-ink-2">
            <p className="font-semibold">Fonti usate per la bozza</p>
            <ul className="mt-1 grid gap-0.5">
              {reply.draft.citations.map((citation) => (
                <li key={citation.id}>
                  {citation.url ? (
                    <a
                      href={citation.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-stamp underline underline-offset-2"
                    >
                      {citation.title}
                    </a>
                  ) : (
                    citation.title
                  )}
                  <span className="text-ink-3"> · {citation.source}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {error && (
        <Notice tone="danger" id="request-error">
          {error}
        </Notice>
      )}
      <Button type="submit" size="lg" loading={pending}>
        {reply ? "Invia la risposta" : "Invia al cittadino"}
      </Button>
    </form>
  );
}
