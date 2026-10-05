import type { CaseDossier } from "@avanti/contracts";
import { formatDateTime } from "@/lib/console/labels";
import { cn } from "@/lib/cn";

export function AnswersSection({ dossier }: { dossier: CaseDossier }) {
  if (dossier.answers.length === 0) return null;
  const sections = new Map<string, CaseDossier["answers"]>();
  for (const answer of dossier.answers) {
    sections.set(answer.section, [...(sections.get(answer.section) ?? []), answer]);
  }
  return (
    <section aria-labelledby="answers-title">
      <h2 id="answers-title" className="font-display text-xl font-semibold">
        Risposte del cittadino
      </h2>
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
                  <dd dir="auto" className="font-semibold break-words">
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
            {messages.length} messaggi, mostra
          </span>
        </summary>
        <ol className="mt-4 grid gap-3">
          {messages.map((message) => (
            <li
              key={message.id}
              className={cn(
                "max-w-[85%] rounded-lg px-4 py-3",
                message.role === "citizen"
                  ? "justify-self-end bg-stamp-wash"
                  : "bg-surface ring-1 ring-line",
              )}
            >
              <p className="text-xs font-semibold text-ink-3">
                {ROLE_LABEL[message.role]}, {formatDateTime(message.createdAt)}
              </p>
              <p dir="auto" className="mt-1 break-words whitespace-pre-line">
                {message.text}
              </p>
              {message.originalText && message.originalText !== message.text && (
                <p className="mt-2 border-t border-line pt-2 text-sm text-ink-3">
                  Originale: <span className="whitespace-pre-line">{message.originalText}</span>
                </p>
              )}
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}
