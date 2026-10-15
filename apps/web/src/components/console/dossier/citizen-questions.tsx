import { MessageCircleQuestion, Sparkles } from "lucide-react";
import type { CaseDossier, ChatMessage } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/console/labels";
import { MessageBubble } from "./message-bubble";

/**
 * What the citizen wrote to the desk after sending the dossier and nobody has answered yet.
 * It sits above everything else: a question left unanswered is how a case gets stuck.
 */
export function unansweredQuestions(dossier: CaseDossier): ChatMessage[] {
  if (!dossier.submittedAt || dossier.status === "closed") return [];
  const submitted = Date.parse(dossier.submittedAt);
  let lastOperator = 0;
  for (const m of dossier.messages)
    if (m.role === "operator") lastOperator = Math.max(lastOperator, Date.parse(m.createdAt));
  return dossier.messages.filter(
    (m) =>
      m.role === "citizen" &&
      Date.parse(m.createdAt) >= submitted &&
      Date.parse(m.createdAt) > lastOperator,
  );
}

export function CitizenQuestions({
  dossier,
  onReply,
  pending,
}: {
  dossier: CaseDossier;
  onReply: (question: ChatMessage) => void;
  pending: string | null;
}) {
  const questions = unansweredQuestions(dossier);
  if (questions.length === 0) return null;
  const latest = questions[questions.length - 1]!;
  return (
    <section
      aria-labelledby="citizen-questions-title"
      className="rounded-lg bg-surface p-5 ring-2 ring-stamp/30"
    >
      <h2
        id="citizen-questions-title"
        className="flex items-center gap-2 font-display text-xl font-semibold"
      >
        <MessageCircleQuestion className="size-5 text-stamp" aria-hidden />
        {questions.length === 1
          ? "Il cittadino ti ha scritto"
          : `Il cittadino ti ha scritto ${questions.length} messaggi`}
      </h2>
      <ol className="mt-3 grid gap-2">
        {questions.map((question) => (
          <MessageBubble
            key={question.id}
            fromCitizen
            fill
            meta={formatDateTime(question.createdAt)}
            text={question.text}
            originalText={question.originalText}
            language={dossier.language}
          />
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          loading={pending === `reply:${latest.id}`}
          disabled={pending !== null}
          onClick={() => onReply(latest)}
        >
          <Sparkles className="size-4" aria-hidden />
          Rispondi
        </Button>
        <p className="text-sm text-ink-3">
          Prepariamo una bozza dalle fonti ufficiali: la rileggi e la invii tu.
        </p>
      </div>
    </section>
  );
}
