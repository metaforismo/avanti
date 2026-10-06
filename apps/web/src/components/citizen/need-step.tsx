"use client";

import { ChevronDown, Clock } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { PracticeSummary } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch } from "@/lib/api";
import { format } from "@/lib/citizen/messages";
import { cn } from "@/lib/cn";
import { ActionErrorNotice } from "./action-error";
import { AssistantMessage, lastMessage } from "./assistant-message";
import type { StepProps } from "./citizen-app";
import { STEP_TITLE_ID } from "@/lib/citizen/view";
import { QuestionCard } from "./question-card";

const MIN_LENGTH = 3;

export function NeedStep({ api, data, m }: StepProps) {
  const [text, setText] = useState("");
  const [tooShort, setTooShort] = useState(false);
  const [showList, setShowList] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  // A story about a practice Avanti can't prepare yet opens the list of the ones it can.
  const [seenUnavailable, setSeenUnavailable] = useState(api.unavailablePractice);
  if (api.unavailablePractice !== seenUnavailable) {
    setSeenUnavailable(api.unavailablePractice);
    if (api.unavailablePractice) setShowList(true);
  }
  useEffect(() => {
    if (api.unavailablePractice)
      listRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [api.unavailablePractice]);
  const textareaId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sending = api.pending === "text";
  const assistant = lastMessage(data.messages, "assistant");

  async function send(value: string) {
    const trimmed = value.trim();
    if (trimmed.length < MIN_LENGTH) {
      setTooShort(true);
      textareaRef.current?.focus();
      return;
    }
    setTooShort(false);
    const result = await api.turn({ type: "text", text: trimmed });
    if (result) setText("");
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(text);
  }

  return (
    <div className="grid gap-6">
      <div>
        <h1
          id={STEP_TITLE_ID}
          tabIndex={-1}
          className="font-display text-[2rem] leading-[1.05] font-bold tracking-[-0.025em] outline-none"
        >
          <label htmlFor={textareaId}>{m.need.title}</label>
        </h1>
        <p className="mt-2 text-lg text-ink-2">{m.need.hint}</p>
      </div>

      {assistant && (
        <AssistantMessage
          message={assistant}
          label={m.interview.assistant}
          question={data.nextQuestion?.prompt}
        />
      )}
      {data.nextQuestion && <QuestionCard api={api} question={data.nextQuestion} m={m} />}

      <form onSubmit={onSubmit} className="grid gap-3">
        <textarea
          id={textareaId}
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (tooShort) setTooShort(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void send(text);
            }
          }}
          rows={4}
          maxLength={2000}
          placeholder={m.need.placeholder}
          aria-invalid={tooShort || undefined}
          aria-describedby={tooShort ? `${textareaId}-error` : undefined}
          className="[field-sizing:content] min-h-32 w-full resize-none rounded-md bg-surface p-4 text-lg leading-relaxed text-ink ring-1 ring-line-strong ring-inset placeholder:text-ink-3 focus:ring-2 focus:ring-stamp focus:outline-none"
        />
        {tooShort && (
          <p id={`${textareaId}-error`} role="alert" className="text-sm font-medium text-danger">
            {m.need.tooShort}
          </p>
        )}
        <ActionErrorNotice error={api.actionError} m={m} onDismiss={api.clearActionError} />
        <Button type="submit" size="lg" loading={sending} className="w-full">
          {m.need.send}
        </Button>
      </form>

      <section aria-labelledby="examples-label">
        <h2 id="examples-label" className="mb-2.5 text-sm text-ink-3">
          {m.need.examplesLabel}
        </h2>
        <div className="flex flex-wrap gap-2">
          {m.need.examples.map((example) => (
            <button
              key={example}
              type="button"
              disabled={sending}
              onClick={() => void send(example)}
              className="rounded-full bg-surface px-4 py-2.5 text-start text-[0.9375rem] text-ink ring-1 ring-line-strong transition-colors ring-inset hover:bg-sunk disabled:opacity-50"
            >
              {example}
            </button>
          ))}
        </div>
      </section>

      <div ref={listRef} className="scroll-mt-28 border-t border-line pt-5">
        <button
          type="button"
          aria-expanded={showList}
          onClick={() => setShowList((v) => !v)}
          className="flex w-full items-center justify-between gap-3 rounded-sm py-2 text-start font-semibold text-stamp"
        >
          {m.need.pick}
          <ChevronDown
            className={cn("size-5 transition-transform duration-200", showList && "rotate-180")}
            aria-hidden
          />
        </button>
        {showList && <PracticeList {...{ api, data, m }} />}
      </div>
    </div>
  );
}

function PracticeList({ api, data, m }: Pick<StepProps, "api" | "data" | "m">) {
  const [practices, setPractices] = useState<PracticeSummary[] | "error" | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiFetch<PracticeSummary[]>(`/api/practices?lang=${data.language}`)
      .then((list) => !cancelled && setPractices(list))
      .catch(() => !cancelled && setPractices("error"));
    return () => {
      cancelled = true;
    };
  }, [data.language, attempt]);

  if (practices === null) {
    return (
      <div className="grid place-items-center py-8 text-ink-3">
        <Spinner label={m.common.loading} />
      </div>
    );
  }
  if (practices === "error") {
    return (
      <div
        role="alert"
        className="mt-3 flex flex-wrap items-center gap-3 rounded-md bg-danger-wash px-4 py-3 text-danger"
      >
        <span className="flex-1">{m.errors.network}</span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setPractices(null);
            setAttempt((n) => n + 1);
          }}
        >
          {m.common.retry}
        </Button>
      </div>
    );
  }

  const order = { available: 0, beta: 1, coming_soon: 2 } as const;
  const sorted = [...practices].sort((a, b) => order[a.availability] - order[b.availability]);

  return (
    <ul className="mt-3 grid animate-fade-in gap-2">
      {sorted.map((practice) => {
        const disabled = practice.availability === "coming_soon";
        const choosing = api.pending === `choose:${practice.id}`;
        return (
          <li key={practice.id}>
            <button
              type="button"
              disabled={disabled || api.pending !== null}
              onClick={() =>
                void api.turn(
                  { type: "choose_practice", practiceId: practice.id },
                  `choose:${practice.id}`,
                )
              }
              className={cn(
                "flex w-full items-start gap-3 rounded-md bg-surface p-4 text-start ring-1 ring-line-strong transition-colors ring-inset",
                disabled ? "cursor-not-allowed opacity-60" : "hover:bg-sunk",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{practice.name}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold",
                      practice.availability === "available" && "bg-ok-wash text-ok",
                      practice.availability === "beta" && "bg-stamp-wash text-stamp",
                      practice.availability === "coming_soon" && "bg-sunk text-ink-3",
                    )}
                  >
                    {practice.availability === "available"
                      ? m.need.available
                      : practice.availability === "beta"
                        ? m.need.beta
                        : m.need.comingSoon}
                  </span>
                </span>
                <span className="mt-1 block text-ink-2">{practice.description}</span>
                {!disabled && (
                  <span className="mt-2 flex items-center gap-1.5 text-sm text-ink-3">
                    <Clock className="size-3.5" aria-hidden />
                    {format(m.need.minutes, { n: practice.estimatedMinutes })}
                  </span>
                )}
              </span>
              {choosing && <Spinner className="mt-1 size-5 text-stamp" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
