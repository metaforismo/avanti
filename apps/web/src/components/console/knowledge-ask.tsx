"use client";

import { BookOpen, ExternalLink, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { engineLabel, type KnowledgeAnswer } from "@/lib/console/copilot";

const COVERAGE = {
  full: { label: "Risposta dalla base normativa", tone: "ok" },
  partial: { label: "Risposta parziale", tone: "warn" },
  none: { label: "Non coperto dalla base normativa", tone: "neutral" },
} as const;

/**
 * Practical rules questions answered only from Avanti's knowledge base, each answer with the
 * excerpts it rests on. When the base does not cover it, it says so instead of guessing.
 */
export function KnowledgeAsk() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<KnowledgeAnswer | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(event: FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (text.length < 3 || pending) return;
    setPending(true);
    setError(null);
    try {
      setAnswer(
        await apiFetch<KnowledgeAnswer>("/api/ai/ask", {
          method: "POST",
          body: { question: text },
        }),
      );
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Risposta non disponibile. Riprova.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="ask-title" className="rounded-lg bg-surface p-5 ring-1 ring-line">
      <h2 id="ask-title" className="flex items-center gap-2 font-display text-xl font-semibold">
        <BookOpen className="size-5 text-stamp" aria-hidden />
        Domande normative
      </h2>
      <p className="mt-1 text-ink-2">
        Per esempio: «Come si considera il conto cointestato nella giacenza media?». Risponde solo
        dalla base normativa di Avanti, con le fonti.
      </p>
      <form onSubmit={ask} className="mt-4 grid gap-2">
        <label htmlFor="ask-question" className="sr-only">
          La tua domanda
        </label>
        <textarea
          id="ask-question"
          rows={2}
          maxLength={500}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Scrivi la domanda"
          className="w-full resize-y rounded-sm bg-surface p-3 text-[0.9375rem] ring-1 ring-line-strong ring-inset focus:ring-2 focus:ring-stamp focus:outline-none"
        />
        <Button
          type="submit"
          loading={pending}
          disabled={question.trim().length < 3}
          className="w-fit"
        >
          <Sparkles className="size-4" aria-hidden />
          Chiedi
        </Button>
      </form>
      {error && (
        <p role="alert" className="mt-3 rounded-md bg-danger-wash px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      <div aria-live="polite">
        {answer && (
          <div className="mt-5 grid gap-3 border-t border-line pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={COVERAGE[answer.coverage].tone}>{COVERAGE[answer.coverage].label}</Pill>
              <span className="text-xs text-ink-3">{engineLabel(answer.engine)}</span>
            </div>
            <p className="text-[0.9375rem] leading-relaxed whitespace-pre-line">{answer.answer}</p>
            {answer.citations.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-ink-2">Fonti</h3>
                <ul className="mt-1.5 grid gap-1.5 text-sm">
                  {answer.citations.map((c) => (
                    <li key={c.id}>
                      <span className="font-semibold">{c.title}</span>
                      <span className="text-ink-3"> · {c.source}</span>
                      {c.url && (
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ms-2 inline-flex items-center gap-1 text-stamp underline underline-offset-2"
                        >
                          Apri
                          <ExternalLink className="size-3" aria-hidden />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-ink-3">
              Verifica sempre sulla fonte ufficiale prima di applicarla a una pratica.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
