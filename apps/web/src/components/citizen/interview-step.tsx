"use client";

import { ChevronDown, MessageSquareText, Pencil, SendHorizontal } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { ProgressBar } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { ActionErrorNotice } from "./action-error";
import { AssistantMessage, lastMessage } from "./assistant-message";
import type { StepProps } from "./citizen-app";
import { QuestionCard } from "./question-card";

export function InterviewStep({ api, data, m }: StepProps) {
  const question = data.nextQuestion;
  const answered = data.answered ?? [];
  const { questionsAnswered, questionsTotal } = data.progress;
  const assistant = lastMessage(data.messages, "assistant");

  return (
    <div className="grid gap-5">
      <div>
        {data.practice && (
          <p className="font-display text-xl font-semibold tracking-[-0.01em]">
            {data.practice.name}
          </p>
        )}
        {questionsTotal > 0 && (
          <div className="mt-2 flex items-center gap-3">
            <ProgressBar
              value={(questionsAnswered / questionsTotal) * 100}
              label={`${questionsAnswered}/${questionsTotal}`}
              className="flex-1"
            />
            <span className="tabular text-sm text-ink-3" dir="ltr">
              {questionsAnswered}/{questionsTotal}
            </span>
          </div>
        )}
      </div>

      <AssistantMessage message={assistant} label={m.interview.assistant} />
      <ActionErrorNotice error={api.actionError} m={m} onDismiss={api.clearActionError} />

      {question && (
        <QuestionCard
          key={question.id}
          api={api}
          question={question}
          m={m}
          initial={data.answers[question.id]}
        />
      )}

      <FreeText api={api} m={m} />

      <details className="group rounded-lg ring-1 ring-line">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 py-3.5 font-semibold [&::-webkit-details-marker]:hidden">
          <span>
            {m.interview.yourAnswers}
            <span className="tabular ms-2 font-normal text-ink-3">{answered.length}</span>
          </span>
          <ChevronDown
            className="size-5 transition-transform duration-200 group-open:rotate-180"
            aria-hidden
          />
        </summary>
        {answered.length === 0 ? (
          <p className="px-4 pb-4 text-ink-3">{m.interview.noAnswers}</p>
        ) : (
          <dl className="divide-y divide-line border-t border-line">
            {answered.map((item) => (
              <div key={item.questionId} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <dt className="text-sm text-ink-3">{item.question}</dt>
                  <dd className="mt-0.5 font-semibold break-words">{item.answer}</dd>
                </div>
                {item.editable && (
                  <button
                    type="button"
                    disabled={api.pending !== null}
                    onClick={() =>
                      void api.turn(
                        { type: "edit", questionId: item.questionId },
                        `edit:${item.questionId}`,
                      )
                    }
                    className="-me-2 inline-flex shrink-0 items-center gap-1.5 rounded-sm px-2 py-1.5 text-sm font-semibold text-stamp hover:bg-stamp-wash disabled:opacity-50"
                    aria-label={`${m.common.edit}: ${item.question}`}
                  >
                    {api.pending === `edit:${item.questionId}` ? (
                      <Spinner className="size-4" />
                    ) : (
                      <Pencil className="size-3.5" aria-hidden />
                    )}
                    {m.common.edit}
                  </button>
                )}
              </div>
            ))}
          </dl>
        )}
      </details>
    </div>
  );
}

/** Free text at any point: "actually my brother lives with us too" is easier to type than to click. */
function FreeText({ api, m }: Pick<StepProps, "api" | "m">) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const inputId = useId();
  const sending = api.pending === "text";

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (text.trim().length < 3) return;
    const result = await api.turn({ type: "text", text: text.trim() });
    if (result) {
      setText("");
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-fit items-center gap-2 rounded-sm text-ink-2 hover:text-ink"
      >
        <MessageSquareText className="size-4" aria-hidden />
        <span className="underline underline-offset-4">{m.interview.writeInstead}</span>
      </button>
    );
  }

  return (
    <form onSubmit={submit} className={cn("flex animate-fade-in gap-2")}>
      <label htmlFor={inputId} className="sr-only">
        {m.interview.writeInstead}
      </label>
      <Input
        id={inputId}
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={m.interview.writePlaceholder}
        maxLength={2000}
        className="h-12 flex-1 text-base"
      />
      <Button
        type="submit"
        size="icon"
        className="size-12"
        loading={sending}
        aria-label={m.interview.send}
      >
        <SendHorizontal className="rtl-flip size-5" aria-hidden />
      </Button>
    </form>
  );
}
