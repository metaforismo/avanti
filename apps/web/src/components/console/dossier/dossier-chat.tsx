"use client";

import { BookOpen, X } from "lucide-react";
import { Dialog as Primitive } from "radix-ui";
import { useEffect, useId, useRef, useState } from "react";
import type {
  CaseDossier,
  DossierAskResponse,
  DossierChatResponse,
  DossierChatTurn,
} from "@avanti/contracts";
import { CopyButton } from "@/components/ui/copy-button";
import { Notice } from "@/components/ui/notice";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { cn } from "@/lib/cn";
import {
  ChatInput,
  CopilotAvatar,
  FollowUps,
  QuestionBubble,
  Starters,
  ThinkingRow,
} from "../chat-parts";
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

  async function ask(question: string) {
    const value = question.trim();
    if (value.length < 3 || pending) return;
    setPending({ question: value });
    setError(null);
    setText("");
    try {
      // No history from the client: the server rebuilds it from saved answers about this
      // dossier version only, so an answer about an older version never becomes a fact.
      const response = await apiFetch<DossierAskResponse>(base, {
        method: "POST",
        body: { question: value },
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
          <header className="flex items-center gap-3 px-5 pt-4 pb-2">
            <CopilotAvatar size="lg" />
            <div className="min-w-0 flex-1">
              <Primitive.Title className="font-semibold">Chiedi al fascicolo</Primitive.Title>
              <Primitive.Description className="truncate text-sm text-ink-3">
                Risposte dai dati della pratica. Solo tu vedi questa chat.
              </Primitive.Description>
            </div>
            <Primitive.Close
              className="grid size-9 shrink-0 place-items-center rounded-md bg-surface text-ink-3 ring-1 ring-line hover:text-ink"
              aria-label="Chiudi"
            >
              <X className="size-5" aria-hidden />
            </Primitive.Close>
          </header>

          <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
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
              <ol
                aria-live="polite"
                aria-relevant="additions"
                className="grid grid-cols-[minmax(0,1fr)] gap-6"
              >
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
                    <QuestionBubble text={pending.question} />
                    <ThinkingRow text="Sto leggendo il fascicolo…" />
                  </>
                )}
              </ol>
            )}
            {suggestions.length > 0 && (
              <FollowUps items={suggestions} onPick={(q) => void ask(q)} />
            )}
            <div ref={end} />
          </div>

          <div className="grid gap-2 px-5 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {error && <Notice tone="danger">{error}</Notice>}
            <ChatInput
              id={fieldId}
              label="Domanda sul fascicolo"
              value={text}
              onChange={setText}
              onSend={(value) => void ask(value)}
              pending={pending !== null}
              placeholder="Chiedi qualcosa su questa pratica"
              maxLength={1000}
              inputRef={field}
              footer="Le risposte dell'AI possono sbagliare: controlla le fonti prima di decidere."
            />
          </div>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
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
      <QuestionBubble text={turn.question} />
      <li className="flex gap-3">
        <CopilotAvatar />
        <div className="min-w-0 flex-1 pt-0.5">
          <span className="sr-only">Copilota: </span>
          <AnswerText response={response} onEvidence={onEvidence} />
          {response.citations.length > 0 && (
            <ul className="mt-3 grid gap-1">
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
          <div className="mt-2 flex items-center gap-2 text-xs text-ink-3">
            <CopyButton
              iconOnly
              value={plainAnswer(response.answer)}
              showValueOnFailure={false}
              labels={{
                copy: "Copia la risposta",
                copied: "Risposta copiata",
                failed: "Copia non riuscita",
              }}
              className="-ms-1.5 text-ink-3"
            />
            {response.engine === "heuristic" && <span>Risposta senza AI, dalle regole.</span>}
            {stale && <span>La pratica è cambiata dopo questa risposta.</span>}
          </div>
        </div>
      </li>
    </>
  );
}

/** The answer without its reference marks, for pasting into a note or a message. */
const plainAnswer = (answer: string) =>
  answer
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(MARKER, ""))
    .join("\n\n");

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
