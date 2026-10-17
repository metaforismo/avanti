"use client";

import {
  ArrowUpRight,
  Baby,
  ChevronDown,
  Clock,
  FileText,
  IdCard,
  ListChecks,
  Receipt,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { PracticeSummary } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Pill } from "@/components/ui/pill";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch } from "@/lib/api";
import { plural } from "@/lib/citizen/messages";
import { cn } from "@/lib/cn";
import { ActionErrorNotice } from "./action-error";
import { WaitingStatus } from "./waiting-status";
import { AssistantMessage, lastMessage } from "./assistant-message";
import { Composer } from "./composer";
import type { StepProps } from "./citizen-app";
import { STEP_TITLE_ID } from "@/lib/citizen/view";
import { QuestionCard } from "./question-card";

const MIN_LENGTH = 3;

export function NeedStep({ api, data, m, token }: StepProps) {
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
  const sending = api.pending === "text";
  const assistant = lastMessage(data.messages, "assistant");

  async function send(value: string) {
    const trimmed = value.trim();
    if (trimmed.length < MIN_LENGTH) {
      setTooShort(true);
      document.getElementById(textareaId)?.focus();
      return false;
    }
    setTooShort(false);
    return Boolean(await api.turn({ type: "text", text: trimmed }));
  }

  return (
    <div className="grid gap-8 pt-2 sm:pt-8">
      <div className="text-center">
        <h1
          id={STEP_TITLE_ID}
          tabIndex={-1}
          className="font-display text-[2.25rem] leading-[1.05] font-bold tracking-[-0.03em] outline-none sm:text-[2.75rem]"
        >
          <label htmlFor={textareaId}>{m.need.title}</label>
        </h1>
        <p className="mx-auto mt-3 max-w-md text-lg text-ink-2">{m.need.hint}</p>
      </div>

      {assistant && (
        <AssistantMessage
          message={assistant}
          label={m.interview.assistant}
          question={data.nextQuestion?.prompt}
        />
      )}
      {data.nextQuestion && <QuestionCard api={api} question={data.nextQuestion} m={m} />}

      <div className="grid gap-3">
        <Composer
          token={token}
          language={data.language}
          m={m}
          size="hero"
          inputId={textareaId}
          placeholder={m.need.placeholder}
          maxLength={2000}
          busy={sending}
          sendLabel={m.need.send}
          invalid={tooShort}
          describedBy={tooShort ? `${textareaId}-error` : undefined}
          voiceEnabled={data.aiCitizenAssistant !== false}
          onTextChange={() => tooShort && setTooShort(false)}
          onSend={send}
        />
        {tooShort && (
          <p id={`${textareaId}-error`} role="alert" className="text-sm font-medium text-danger">
            {m.need.tooShort}
          </p>
        )}
        <WaitingStatus active={sending} m={m} showReading />
        <ActionErrorNotice error={api.actionError} m={m} onDismiss={api.clearActionError} />
      </div>

      <section aria-labelledby="examples-label">
        <h2 id="examples-label" className="mb-2 px-1 text-sm text-ink-3">
          {m.need.examplesLabel}
        </h2>
        <ul className="divide-y divide-line overflow-hidden rounded-xl bg-surface ring-1 ring-line">
          {m.need.examples.map((example, index) => {
            const Icon = EXAMPLE_ICONS[index % EXAMPLE_ICONS.length]!;
            return (
              <li key={example}>
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => void send(example)}
                  className="group flex w-full items-center gap-3 px-4 py-3.5 text-start transition-colors hover:bg-paper focus-visible:bg-paper focus-visible:outline-none active:bg-sunk disabled:opacity-50"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-md bg-stamp-wash text-stamp">
                    <Icon className="size-4.5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 text-ink">{example}</span>
                  <ArrowUpRight
                    className="rtl-flip size-4 shrink-0 text-ink-3 transition-colors group-hover:text-ink"
                    aria-hidden
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <div ref={listRef} className="scroll-mt-28">
        <button
          type="button"
          aria-expanded={showList}
          onClick={() => setShowList((v) => !v)}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-start font-semibold text-stamp ring-1 ring-line transition-colors hover:bg-surface active:bg-stamp-wash"
        >
          <ListChecks className="size-5 shrink-0" aria-hidden />
          <span className="flex-1">{m.need.pick}</span>
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

// ISEE, 730, residence permit, child benefit: the order of `m.need.examples` in every language.
const EXAMPLE_ICONS = [FileText, Receipt, IdCard, Baby] as const;

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
      <Notice
        tone="danger"
        size="md"
        className="mt-3"
        action={
          <Button
            variant="secondary"
            size="touch"
            onClick={() => {
              setPractices(null);
              setAttempt((n) => n + 1);
            }}
          >
            {m.common.retry}
          </Button>
        }
      >
        {m.errors.network}
      </Notice>
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
                disabled ? "cursor-not-allowed opacity-60" : "hover:bg-sunk active:bg-stamp-wash",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{practice.name}</span>
                  <Pill
                    tone={
                      practice.availability === "available"
                        ? "ok"
                        : practice.availability === "beta"
                          ? "stamp"
                          : "muted"
                    }
                  >
                    {practice.availability === "available"
                      ? m.need.available
                      : practice.availability === "beta"
                        ? m.need.beta
                        : m.need.comingSoon}
                  </Pill>
                </span>
                <span className="mt-1 block text-ink-2">{practice.description}</span>
                {!disabled && (
                  <span className="mt-2 flex items-center gap-1.5 text-sm text-ink-3">
                    <Clock className="size-3.5" aria-hidden />
                    {plural(data.language, practice.estimatedMinutes, m.need.minutes)}
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
