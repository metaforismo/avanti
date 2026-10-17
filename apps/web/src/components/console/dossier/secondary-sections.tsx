import type { CaseDossier } from "@avanti/contracts";
import { SectionHeader } from "@/components/ui/page-header";
import { formatDateTime } from "@/lib/console/labels";
import { MessageBubble } from "./message-bubble";

export function AnswersSection({ dossier }: { dossier: CaseDossier }) {
  if (dossier.answers.length === 0) return null;
  const sections = new Map<string, CaseDossier["answers"]>();
  for (const answer of dossier.answers) {
    sections.set(answer.section, [...(sections.get(answer.section) ?? []), answer]);
  }
  return (
    <section aria-labelledby="answers-title">
      <SectionHeader id="answers-title" title="Risposte del cittadino" />
      <div className="mt-4 grid gap-5">
        {[...sections.entries()].map(([section, answers]) => (
          <div key={section}>
            <h3 className="mb-2 text-sm font-semibold text-ink-2">{section}</h3>
            <dl className="divide-y divide-line rounded-lg bg-surface ring-1 ring-line">
              {answers.map((answer) => (
                <div
                  key={answer.questionId}
                  className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-4"
                >
                  <dt className="text-ink-2">{answer.question}</dt>
                  <dd dir="auto" className="font-semibold">
                    {answer.answer}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}

const ROLE_LABEL = {
  citizen: "Cittadino",
  assistant: "Assistente automatico",
  operator: "Operatore",
  system: "Sistema",
} as const;

export function ConversationSection({ dossier }: { dossier: CaseDossier }) {
  const messages = dossier.messages.filter((m) => m.role !== "system");
  if (messages.length === 0) return null;
  return (
    <section aria-labelledby="conversation-title">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-baseline gap-3 font-display text-xl font-semibold [&::-webkit-details-marker]:hidden">
          <h2 id="conversation-title" className="font-display text-xl font-semibold">
            Conversazione
          </h2>
          <span className="text-sm font-normal text-ink-3 group-open:hidden">
            {messages.length === 1 ? "1 messaggio" : `${messages.length} messaggi`}, mostra
          </span>
        </summary>
        <ol className="mt-4 grid gap-3">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              fromCitizen={message.role === "citizen"}
              meta={`${ROLE_LABEL[message.role]}, ${formatDateTime(message.createdAt)}`}
              text={message.text}
              originalText={message.originalText}
              language={dossier.language}
            />
          ))}
        </ol>
      </details>
    </section>
  );
}

const INTENT_NOTE: Partial<
  Record<NonNullable<CaseDossier["assistantTurns"][number]["intent"]>, string>
> = {
  needs_operator: "da vedere allo sportello",
  emergency: "segnalata come emergenza",
  manipulation: "tentativo di manipolazione",
  off_topic: "fuori tema",
};

/**
 * What the citizen asked the automatic assistant while preparing the dossier. Not answers to
 * the interview: they tell the operator what was unclear, in the citizen's own words.
 */
export function AssistantTurnsSection({ dossier }: { dossier: CaseDossier }) {
  const turns = dossier.assistantTurns;
  if (turns.length === 0) return null;
  const questions = turns.filter((t) => t.role === "citizen").length;
  return (
    <section aria-labelledby="assistant-turns-title">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-baseline gap-3 [&::-webkit-details-marker]:hidden">
          <h2 id="assistant-turns-title" className="font-display text-xl font-semibold">
            Domande all&apos;assistente
          </h2>
          <span className="text-sm text-ink-3 group-open:hidden">
            {questions === 1 ? "1 domanda" : `${questions} domande`}, mostra
          </span>
        </summary>
        <p className="mt-2 text-sm text-ink-2">
          Le risposte automatiche non cambiano la pratica: servono a capire cosa non era chiaro.
        </p>
        <ol className="mt-4 grid gap-3">
          {turns.map((turn) => (
            <MessageBubble
              key={turn.id}
              fromCitizen={turn.role === "citizen"}
              meta={
                <>
                  {turn.role === "citizen" ? "Cittadino" : "Assistente automatico"},{" "}
                  {formatDateTime(turn.createdAt)}
                  {turn.intent && INTENT_NOTE[turn.intent] && (
                    <span className="text-warn"> · {INTENT_NOTE[turn.intent]}</span>
                  )}
                </>
              }
              text={turn.text}
              textLang={dossier.language}
              language={dossier.language}
            />
          ))}
        </ol>
      </details>
    </section>
  );
}
