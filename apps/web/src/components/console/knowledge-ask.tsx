"use client";

import { BookOpen, ExternalLink } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { Notice } from "@/components/ui/notice";
import { SectionHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { engineLabel, type KnowledgeAnswer } from "@/lib/console/copilot";
import { ChatInput, CopilotAvatar, QuestionBubble, Starters, ThinkingRow } from "./chat-parts";

const COVERAGE = {
  full: { label: "Dalla base normativa", tone: "ok" },
  partial: { label: "Risposta parziale", tone: "warn" },
  none: { label: "Non coperto dalla base normativa", tone: "neutral" },
} as const;

const EXAMPLES = [
  "Come si considera il conto cointestato nella giacenza media?",
  "Quando serve l'ISEE corrente invece di quello ordinario?",
  "Chi fa parte del nucleo se un figlio studia fuori sede?",
] as const;

type Exchange = { id: string; question: string; answer: KnowledgeAnswer };

/**
 * Practical rules questions answered only from Avanti's knowledge base, each answer with the
 * excerpts it rests on. When the base does not cover it, it says so instead of guessing.
 * The exchange stays on this page only: nothing about it is saved.
 */
export function KnowledgeAsk() {
  const [text, setText] = useState("");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const fieldId = useId();

  useEffect(() => {
    if (exchanges.length > 0 || pending)
      end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [exchanges.length, pending]);

  async function ask(question: string) {
    const value = question.trim();
    if (value.length < 3 || pending) return;
    setPending(value);
    setError(null);
    setText("");
    try {
      const answer = await apiFetch<KnowledgeAnswer>("/api/ai/ask", {
        method: "POST",
        body: { question: value },
      });
      setExchanges((current) => [...current, { id: crypto.randomUUID(), question: value, answer }]);
    } catch (err) {
      setText(value);
      setError(err instanceof ApiRequestError ? err.message : "Risposta non disponibile. Riprova.");
    } finally {
      setPending(null);
      requestAnimationFrame(() => field.current?.focus());
    }
  }

  return (
    <section aria-labelledby="ask-title" className="rounded-lg bg-surface p-5 ring-1 ring-line">
      <SectionHeader
        id="ask-title"
        icon={<BookOpen className="size-5 text-stamp" aria-hidden />}
        title="Domande normative"
        lead="Risponde solo dalla base normativa di Avanti, con le fonti. Se la base non copre la domanda, lo dice."
      />

      <div className="mt-4 grid gap-4">
        {exchanges.length === 0 && !pending ? (
          <Starters items={EXAMPLES} onPick={(q) => void ask(q)} />
        ) : (
          <ol aria-live="polite" aria-relevant="additions" className="grid gap-5">
            {exchanges.map((exchange) => (
              <Answer key={exchange.id} exchange={exchange} />
            ))}
            {pending && (
              <>
                <QuestionBubble text={pending} />
                <ThinkingRow text="Sto cercando nella base normativa…" />
              </>
            )}
          </ol>
        )}
        <div ref={end} />
        {error && <Notice tone="danger">{error}</Notice>}
        <ChatInput
          id={fieldId}
          label="La tua domanda"
          value={text}
          onChange={setText}
          onSend={(value) => void ask(value)}
          pending={pending !== null}
          placeholder="Scrivi una domanda sulle regole"
          maxLength={500}
          inputRef={field}
          footer="Verifica sempre sulla fonte ufficiale prima di applicarla a una pratica."
        />
      </div>
    </section>
  );
}

function Answer({ exchange: { question, answer } }: { exchange: Exchange }) {
  const coverage = COVERAGE[answer.coverage];
  return (
    <>
      <QuestionBubble text={question} />
      <li className="flex gap-3">
        <CopilotAvatar />
        <div className="min-w-0 flex-1 pt-0.5">
          <span className="sr-only">Copilota: </span>
          <p className="leading-relaxed whitespace-pre-line">{answer.answer}</p>
          {answer.citations.length > 0 && (
            <ul className="mt-3 grid gap-1">
              {answer.citations.map((c) => (
                <li key={c.id} className="flex items-start gap-1.5 text-xs text-ink-3">
                  <BookOpen className="mt-0.5 size-3 shrink-0" aria-hidden />
                  {c.url ? (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-ink"
                    >
                      {c.title}
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                  ) : (
                    c.title
                  )}
                  <span>· {c.source}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-3">
            <CopyButton
              iconOnly
              value={answer.answer}
              showValueOnFailure={false}
              labels={{
                copy: "Copia la risposta",
                copied: "Risposta copiata",
                failed: "Copia non riuscita",
              }}
              className="-ms-1.5 text-ink-3"
            />
            <Pill tone={coverage.tone} size="xs">
              {coverage.label}
            </Pill>
            <span>{engineLabel(answer.engine)}</span>
          </div>
        </div>
      </li>
    </>
  );
}
