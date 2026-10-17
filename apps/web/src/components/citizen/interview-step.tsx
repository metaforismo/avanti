"use client";

import { ChevronDown, MessageSquareText, Pencil, SendHorizontal } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import type { MemberRole } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { initialAnswer, STEP_TITLE_ID } from "@/lib/citizen/view";
import { RenewalNotice } from "./renewal-notice";
import { ActionErrorNotice } from "./action-error";
import { AssistantMessage, lastMessage } from "./assistant-message";
import type { StepProps } from "./citizen-app";
import { InterviewProgressBar, RemainingQuestions } from "./interview-progress";
import { QuestionCard } from "./question-card";

export function InterviewStep({ api, data, m }: StepProps) {
  const question = data.nextQuestion;
  const showAssistant = api.lastTurn === "text" || api.lastTurn === "choose_practice";
  const assistant = showAssistant ? lastMessage(data.messages, "assistant") : undefined;

  return (
    <div className="grid gap-5">
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h1
            id={STEP_TITLE_ID}
            tabIndex={-1}
            className="font-display text-xl font-semibold tracking-[-0.01em] outline-none"
          >
            {data.practice?.name ?? m.steps.interview}
          </h1>
          <RemainingQuestions progress={data.progress} m={m} />
        </div>
        <InterviewProgressBar progress={data.progress} m={m} />
      </div>

      <RenewalNotice data={data} />

      <AssistantMessage
        message={assistant}
        label={m.interview.assistant}
        question={data.nextQuestion?.prompt}
      />
      <ActionErrorNotice error={api.actionError} m={m} onDismiss={api.clearActionError} />

      {question && (
        <QuestionCard
          key={question.id}
          api={api}
          question={question}
          m={m}
          initial={initialAnswer(data, question.id)}
          autoFocus={api.lastTurn !== null}
          expectedRoles={
            Array.isArray(data.answers.household_roles)
              ? (data.answers.household_roles as MemberRole[])
              : undefined
          }
          expectedMembers={
            typeof data.answers.household_count === "number"
              ? data.answers.household_count
              : undefined
          }
        />
      )}

      <FreeText api={api} m={m} />

      <AnsweredList api={api} data={data} m={m} />
    </div>
  );
}

/** Free text at any point: "actually my brother lives with us too" is easier to type than to click. */
function FreeText({ api, m }: Pick<StepProps, "api" | "m">) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [tooShort, setTooShort] = useState(false);
  const inputId = useId();
  const sending = api.pending === "text";

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending) return;
    if (text.trim().length < 3) {
      setTooShort(true);
      return;
    }
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
        <span className="underline underline-offset-2">{m.interview.writeInstead}</span>
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="grid animate-fade-in gap-1.5">
      <div className="flex gap-2">
        <label htmlFor={inputId} className="sr-only">
          {m.interview.writeInstead}
        </label>
        <Input
          id={inputId}
          autoFocus
          value={text}
          autoComplete="off"
          aria-invalid={tooShort || undefined}
          aria-describedby={tooShort ? `${inputId}-error` : undefined}
          onChange={(e) => {
            setText(e.target.value);
            setTooShort(false);
          }}
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
      </div>
      {tooShort && (
        <p id={`${inputId}-error`} role="alert" className="text-sm font-medium text-danger">
          {m.need.tooShort}
        </p>
      )}
    </form>
  );
}

/** Everything answered so far, each editable: the citizen's own check before the documents. */
export function AnsweredList({ api, data, m }: Pick<StepProps, "api" | "data" | "m">) {
  const answered = data.answered ?? [];
  // Nothing to review yet: an empty «Your answers (0)» only adds noise to the first screen.
  if (answered.length === 0) return null;
  return (
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
      {answered.some((item) => !item.editable) && (
        <p className="flex items-start gap-2 border-t border-line px-4 py-3 text-sm text-ink-2">
          <span aria-hidden className="marker mt-0.5 shrink-0 font-semibold">
            Aa
          </span>
          {m.interview.inferred}
        </p>
      )}
      <ul className="divide-y divide-line border-t border-line">
        {answered.map((item) => (
          <li key={item.questionId} className="flex items-start gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink-3">{item.question}</p>
              <p className="mt-0.5 font-semibold break-words">
                <bdi className={item.editable ? undefined : "marker"}>{item.answer}</bdi>
                {!item.editable && <span className="sr-only"> ({m.interview.inferred})</span>}
              </p>
            </div>
            {
              <button
                type="button"
                disabled={api.pending !== null}
                onClick={() =>
                  void api.turn(
                    { type: "edit", questionId: item.questionId },
                    `edit:${item.questionId}`,
                  )
                }
                className="-me-2 inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-sm px-3 text-sm font-semibold text-stamp hover:bg-stamp-wash disabled:opacity-50"
                aria-label={`${m.common.edit}: ${item.question}`}
              >
                {api.pending === `edit:${item.questionId}` ? (
                  <Spinner className="size-4" />
                ) : (
                  <Pencil className="size-3.5" aria-hidden />
                )}
                {m.common.edit}
              </button>
            }
          </li>
        ))}
      </ul>
    </details>
  );
}
