"use client";

import { ArrowUp, ArrowUpRight, BookOpen, Sparkles, X } from "lucide-react";
import { Dialog as Primitive } from "radix-ui";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type {
  CaseDossier,
  DossierAskResponse,
  DossierChatResponse,
  DossierChatTurn,
} from "@avanti/contracts";
import { Notice } from "@/components/ui/notice";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { EvidenceChips, openEvidence } from "./copilot-panel";
import type { DossierActions } from "./dossier-view";

const STARTERS = [
  "Cosa manca per completare la pratica?",
  "Ci sono documenti scaduti o di un anno sbagliato?",
  "Riassumi nucleo, redditi e patrimonio dichiarati",
] as const;

type Pending = { question: string } | null;

/**
 * A chat about this one dossier, next to it. Answers come from the dossier and the official
 * sources, each with the pieces it rests on; the chat is private to the operator.
 */
export function DossierChat({
  open,
  onOpenChange,
  dossier,
  actions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dossier: CaseDossier;
  actions: DossierActions;
}) {
  const base = `/api/cases/${encodeURIComponent(dossier.id)}/ai/ask`;
  const [turns, setTurns] = useState<DossierChatTurn[] | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const fieldId = useId();

  useEffect(() => {
    if (!open || turns !== null) return;
    let cancelled = false;
    apiFetch<DossierChatResponse>(base)
      .then((page) => !cancelled && setTurns(page.turns))
      .catch(() => !cancelled && setTurns([]));
    return () => {
      cancelled = true;
    };
  }, [open, turns, base]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [turns?.length, pending]);

  useEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  async function ask(question: string) {
    const value = question.trim();
    if (value.length < 3 || pending) return;
    setPending({ question: value });
    setError(null);
    setText("");
    const history = (turns ?? []).slice(-4).flatMap((turn) => [
      { role: "user" as const, content: turn.question },
      { role: "assistant" as const, content: turn.response.answer },
    ]);
    try {
      const response = await apiFetch<DossierAskResponse>(base, {
        method: "POST",
        body: { question: value, history },
      });
      setTurns((current) => [
        ...(current ?? []),
        {
          id: crypto.randomUUID(),
          question: value,
          response,
          createdAt: new Date().toISOString(),
          caseVersion: dossier.updatedAt,
        },
      ]);
    } catch (err) {
      setText(value);
      setError(err instanceof ApiRequestError ? err.message : "Risposta non disponibile. Riprova.");
    } finally {
      setPending(null);
      requestAnimationFrame(() => field.current?.focus());
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(text);
  }

  const list = turns ?? [];
  const last = list[list.length - 1];
  const suggestions = !pending && last?.response.suggestions ? last.response.suggestions : [];

  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Portal>
        <Primitive.Overlay className="fixed inset-0 z-50 animate-fade-in bg-scrim backdrop-blur-[2px] lg:bg-transparent lg:backdrop-blur-none" />
        <Primitive.Content
          className={cn(
            "fixed inset-0 z-50 flex animate-rise flex-col bg-paper outline-none",
            "sm:inset-y-0 sm:start-auto sm:end-0 sm:w-[30rem] sm:border-s sm:border-line sm:shadow-float",
          )}
        >
          <header className="flex items-start gap-3 border-b border-line bg-surface px-4 py-3">
            <span
              aria-hidden
              className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-stamp-wash text-stamp ring-1 ring-stamp/15"
            >
              <Sparkles className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <Primitive.Title className="font-display text-lg font-semibold">
                Chiedi al fascicolo
              </Primitive.Title>
              <Primitive.Description className="text-sm text-ink-3">
                Risposte dai dati della pratica e dalle fonti ufficiali. Solo tu vedi questa chat.
              </Primitive.Description>
            </div>
            <Primitive.Close
              className="-me-1 grid size-10 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-sunk hover:text-ink"
              aria-label="Chiudi"
            >
              <X className="size-5" aria-hidden />
            </Primitive.Close>
          </header>

          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5">
            {turns === null ? (
              <div className="grid place-items-center py-10 text-ink-3">
                <Spinner label="Caricamento della chat" />
              </div>
            ) : list.length === 0 && !pending ? (
              <div className="grid gap-4 pt-4">
                <p className="text-center font-display text-xl font-semibold tracking-[-0.01em]">
                  Cosa vuoi sapere di questa pratica?
                </p>
                <Starters items={STARTERS} onPick={(q) => void ask(q)} />
              </div>
            ) : (
              <ol aria-live="polite" aria-relevant="additions" className="grid gap-6">
                {list.map((turn) => (
                  <Turn
                    key={turn.id}
                    turn={turn}
                    stale={turn.caseVersion !== dossier.updatedAt}
                    onEvidence={(evidence) => {
                      openEvidence(evidence, dossier, actions);
                      if (evidence.kind !== "document" && window.innerWidth < 1024)
                        onOpenChange(false);
                    }}
                  />
                ))}
                {pending && (
                  <>
                    <Question text={pending.question} />
                    <li className="grid gap-1.5" aria-label="Sto leggendo il fascicolo">
                      <Mark />
                      <p aria-hidden className="text-shimmer ps-8">
                        Sto leggendo il fascicolo…
                      </p>
                    </li>
                  </>
                )}
              </ol>
            )}
            {suggestions.length > 0 && (
              <div className="mt-5 ps-8">
                <Starters items={suggestions} onPick={(q) => void ask(q)} compact />
              </div>
            )}
            <div ref={end} />
          </div>

          <form
            onSubmit={submit}
            className="grid gap-2 border-t border-line bg-paper px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            {error && <Notice tone="danger">{error}</Notice>}
            <label htmlFor={fieldId} className="sr-only">
              Domanda sul fascicolo
            </label>
            <div className="flex items-end gap-2 rounded-xl bg-surface p-2 shadow-raised ring-1 ring-line-strong focus-within:ring-2 focus-within:ring-stamp/60">
              <textarea
                ref={field}
                id={fieldId}
                rows={1}
                value={text}
                maxLength={1000}
                placeholder="Chiedi qualcosa su questa pratica"
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void ask(text);
                  }
                }}
                className="min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-body-sm outline-none placeholder:text-ink-3"
              />
              <button
                type="submit"
                disabled={pending !== null}
                aria-label="Invia la domanda"
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-stamp focus-visible:outline-none",
                  text.trim().length >= 3
                    ? "bg-contrast text-on-contrast hover:opacity-90"
                    : "bg-sunk text-ink-3",
                )}
              >
                {pending ? (
                  <Spinner className="size-5" />
                ) : (
                  <ArrowUp className="size-5" aria-hidden />
                )}
              </button>
            </div>
            <p className="text-center text-xs text-ink-3">
              Suggerimenti automatici: controlla le fonti prima di decidere.
            </p>
          </form>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}

function Mark() {
  return (
    <p className="flex items-center gap-2 text-sm font-semibold text-ink-2">
      <span
        aria-hidden
        className="grid size-6 place-items-center rounded-full bg-stamp-wash text-stamp ring-1 ring-stamp/15"
      >
        <Sparkles className="size-3.5" />
      </span>
      Copilota
    </p>
  );
}

function Question({ text }: { text: string }) {
  return (
    <li className="flex justify-end">
      <p className="max-w-[85%] rounded-3xl rounded-ee-md bg-sunk px-4 py-2.5 whitespace-pre-line">
        <span className="sr-only">Tu: </span>
        {text}
      </p>
    </li>
  );
}

function Turn({
  turn,
  stale,
  onEvidence,
}: {
  turn: DossierChatTurn;
  stale: boolean;
  onEvidence: Parameters<typeof EvidenceChips>[0]["onOpen"];
}) {
  const { response } = turn;
  return (
    <>
      <Question text={turn.question} />
      <li className="grid gap-1.5">
        <Mark />
        <div className="ps-8">
          <AnswerText response={response} onEvidence={onEvidence} />
          {response.citations.length > 0 && (
            <ul className="mt-2.5 grid gap-1">
              {response.citations.map((citation) => (
                <li key={citation.id} className="flex items-start gap-1.5 text-xs text-ink-3">
                  <BookOpen className="mt-0.5 size-3 shrink-0" aria-hidden />
                  {citation.url ? (
                    <a
                      href={citation.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 hover:text-ink"
                    >
                      {citation.title}
                    </a>
                  ) : (
                    citation.title
                  )}
                  <span>· {citation.source}</span>
                </li>
              ))}
            </ul>
          )}
          {(response.engine === "heuristic" || stale) && (
            <p className="mt-2 text-xs text-ink-3">
              {response.engine === "heuristic" ? "Risposta senza AI, dalle regole. " : ""}
              {stale ? "La pratica è cambiata dopo questa risposta." : ""}
            </p>
          )}
        </div>
      </li>
    </>
  );
}

function Starters({
  items,
  onPick,
  compact = false,
}: {
  items: readonly string[];
  onPick: (question: string) => void;
  compact?: boolean;
}) {
  if (compact)
    return (
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onPick(item)}
            className="rounded-full px-3 py-1.5 text-start text-sm text-ink-2 ring-1 ring-line-strong transition-colors hover:bg-surface hover:text-ink"
          >
            {item}
          </button>
        ))}
      </div>
    );
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl bg-surface ring-1 ring-line">
      {items.map((item) => (
        <li key={item}>
          <button
            type="button"
            onClick={() => onPick(item)}
            className="group flex w-full items-center gap-3 px-4 py-3 text-start text-body-sm transition-colors hover:bg-paper focus-visible:bg-paper focus-visible:outline-none"
          >
            <span className="min-w-0 flex-1">{item}</span>
            <ArrowUpRight className="size-4 shrink-0 text-ink-3 group-hover:text-ink" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}

const MARKER = /\s*\[((?:\d+|fonte \d+)(?:, (?:\d+|fonte \d+))*)\]\s*$/;

/**
 * The answer, one paragraph per statement, with its references as small numbered marks that open
 * the piece of the dossier (or the official source) each statement rests on.
 */
function AnswerText({
  response,
  onEvidence,
}: {
  response: DossierAskResponse;
  onEvidence: Parameters<typeof EvidenceChips>[0]["onOpen"];
}) {
  const mark =
    "ms-1 inline-grid h-5 min-w-5 place-items-center rounded-full bg-stamp-wash px-1.5 align-[0.1em] text-[0.6875rem] font-semibold text-stamp hover:bg-stamp hover:text-on-stamp";
  return (
    <div className="grid gap-3 leading-relaxed">
      {response.answer.split(/\n{2,}/).map((paragraph, index) => {
        const found = MARKER.exec(paragraph);
        const text = found ? paragraph.slice(0, found.index) : paragraph;
        const refs = found ? found[1]!.split(", ") : [];
        return (
          <p key={index} className="whitespace-pre-line">
            {text}
            {refs.map((ref) => {
              const source = /^fonte (\d+)$/.exec(ref);
              if (source) {
                const citation = response.citations[Number(source[1]) - 1];
                return citation?.url ? (
                  <a
                    key={ref}
                    href={citation.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`${citation.title} · ${citation.source}`}
                    className={mark}
                  >
                    <BookOpen className="size-3" aria-label={citation.title} />
                  </a>
                ) : null;
              }
              const evidence = response.evidence[Number(ref) - 1];
              if (!evidence) return null;
              return (
                <button
                  key={ref}
                  type="button"
                  onClick={() => onEvidence(evidence)}
                  title={evidence.label}
                  aria-label={`Fonte ${ref}: ${evidence.label}`}
                  className={mark}
                >
                  {ref}
                </button>
              );
            })}
          </p>
        );
      })}
    </div>
  );
}
