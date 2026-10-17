"use client";

import { ChevronDown, MessageCircleQuestion, Minus, Plus } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { AnswerValue, MemberInput, Question } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useOpenAssistant } from "@/lib/citizen/assistant";
import type { CitizenMessages, Widen } from "@/lib/citizen/messages";
import type { CitizenCaseApi } from "@/lib/citizen/use-citizen-case";
import { cn } from "@/lib/cn";
import { MembersEditor } from "./members-editor";

type Props = {
  api: CitizenCaseApi;
  question: Question;
  m: Widen<CitizenMessages>;
  initial?: AnswerValue;
  /** Household size already stated by the citizen, to pre-create the right number of rows. */
  expectedMembers?: number;
  /** Roles understood from free text ("vivo con mia madre"), used to prefill those rows. */
  expectedRoles?: MemberInput["role"][];
  /** Move focus to the question when it replaces a previous one (not on first page load). */
  autoFocus?: boolean;
};

/**
 * One question at a time, with the input that fits its kind. Choice answers submit on tap:
 * fewer steps for people who struggle with forms.
 */
export function QuestionCard({
  api,
  question,
  m,
  initial,
  expectedMembers,
  expectedRoles,
  autoFocus,
}: Props) {
  const titleId = useId();
  const errorId = `${titleId}-error`;
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const busy = api.pending === "answer" || api.pending === "skip";

  useEffect(() => {
    if (autoFocus) titleRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  async function answer(value: AnswerValue) {
    setLocalError(null);
    await api.turn({ type: "answer", questionId: question.id, value }, "answer");
  }

  return (
    <section
      key={question.id}
      aria-labelledby={titleId}
      className="animate-rise rounded-lg bg-surface p-5 shadow-raised ring-1 ring-line sm:p-6"
    >
      <p className="text-sm text-ink-3">{question.section}</p>
      <h2
        id={titleId}
        ref={titleRef}
        tabIndex={-1}
        className="mt-1 font-display text-2xl leading-tight font-semibold tracking-[-0.015em] outline-none"
      >
        {question.prompt}
      </h2>
      {question.help && <WhyWeAsk label={m.interview.why}>{question.help}</WhyWeAsk>}
      <AskAbout questionId={question.id} label={m.assistant.askAboutQuestion} />

      <div className="mt-5">
        {(question.kind === "single_choice" || question.kind === "yes_no") && (
          <ChoiceList
            options={
              question.kind === "yes_no"
                ? [
                    { value: "true", label: m.common.yes },
                    { value: "false", label: m.common.no },
                  ]
                : (question.options ?? [])
            }
            labelledBy={titleId}
            pendingValue={busy ? chosen : null}
            disabled={busy}
            selected={initial === undefined ? null : String(initial)}
            onChoose={(value) => {
              setChosen(value);
              void answer(question.kind === "yes_no" ? value === "true" : value);
            }}
          />
        )}
        {question.kind === "multi_choice" && (
          <MultiChoice
            question={question}
            m={m}
            busy={busy}
            initial={initial}
            onSubmit={answer}
            onInvalid={setLocalError}
            labelledBy={titleId}
            errorId={localError ? errorId : undefined}
          />
        )}
        {(question.kind === "number" || question.kind === "text" || question.kind === "date") && (
          <ValueInput
            question={question}
            m={m}
            busy={busy}
            initial={initial}
            onSubmit={answer}
            onInvalid={setLocalError}
            errorId={localError ? errorId : undefined}
          />
        )}
        {question.kind === "members" && (
          <MembersEditor
            m={m}
            busy={busy}
            initial={Array.isArray(initial) ? (initial as MemberInput[]) : []}
            expected={expectedMembers}
            expectedRoles={expectedRoles}
            onSubmit={(members) => void answer(members)}
          />
        )}
      </div>

      {localError && (
        <p id={errorId} role="alert" className="mt-3 text-sm font-medium text-danger">
          {localError}
        </p>
      )}

      {!question.required && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void api.turn({ type: "skip", questionId: question.id }, "skip")}
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-sm text-ink-2 underline underline-offset-2 hover:text-ink disabled:opacity-50"
        >
          {m.interview.skip}
          {api.pending === "skip" && <Spinner className="size-4" />}
        </button>
      )}
    </section>
  );
}

function WhyWeAsk({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="mt-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-sm text-sm font-semibold text-stamp"
      >
        {label}
        <ChevronDown
          className={cn("size-4 transition-transform duration-200", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open && (
        <p id={id} className="mt-2 animate-fade-in rounded-sm bg-sunk px-3 py-2.5 text-ink-2">
          {children}
        </p>
      )}
    </div>
  );
}

function ChoiceList({
  options,
  onChoose,
  pendingValue,
  disabled,
  selected,
  labelledBy,
}: {
  labelledBy: string;
  options: { value: string; label: string; hint?: string }[];
  onChoose: (value: string) => void;
  pendingValue: string | null;
  disabled: boolean;
  selected: string | null;
}) {
  return (
    <div role="group" aria-labelledby={labelledBy} className="grid gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          aria-pressed={selected === option.value}
          onClick={() => onChoose(option.value)}
          className={cn(
            "flex min-h-14 w-full items-center gap-3 rounded-md px-4 py-3 text-start text-lg ring-1 ring-line-strong transition-[background-color,box-shadow,transform] duration-150 ease-(--ease-out) ring-inset",
            "hover:bg-sunk active:scale-[0.99] active:bg-stamp-wash disabled:cursor-wait",
            selected === option.value && "ring-2 ring-stamp",
            pendingValue === option.value && "bg-stamp-wash ring-2 ring-stamp",
          )}
        >
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{option.label}</span>
            {option.hint && (
              <span className="mt-0.5 block text-base text-ink-3">{option.hint}</span>
            )}
          </span>
          {pendingValue === option.value && <Spinner className="size-5 text-stamp" />}
        </button>
      ))}
    </div>
  );
}

function MultiChoice({
  question,
  m,
  busy,
  initial,
  onSubmit,
  onInvalid,
  labelledBy,
  errorId,
}: {
  question: Question;
  m: Widen<CitizenMessages>;
  busy: boolean;
  initial?: AnswerValue;
  onSubmit: (value: AnswerValue) => Promise<void>;
  onInvalid: (message: string | null) => void;
  labelledBy: string;
  errorId?: string;
}) {
  const [values, setValues] = useState<string[]>(
    Array.isArray(initial)
      ? (initial as unknown[]).filter((v): v is string => typeof v === "string")
      : [],
  );
  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (question.required && values.length === 0) return onInvalid(m.interview.selectAtLeastOne);
    void onSubmit(values);
  }
  return (
    <form onSubmit={submit} className="grid gap-2">
      <div
        role="group"
        aria-labelledby={labelledBy}
        aria-describedby={errorId}
        className="grid gap-2"
      >
        {(question.options ?? []).map((option) => {
          const checked = values.includes(option.value);
          return (
            <label
              key={option.value}
              className={cn(
                "flex min-h-14 cursor-pointer items-center gap-3 rounded-md px-4 py-3 text-lg ring-1 ring-line-strong ring-inset has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-stamp",
                checked && "bg-stamp-wash ring-2 ring-stamp",
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => {
                  onInvalid(null);
                  setValues((list) =>
                    e.target.checked
                      ? [...list, option.value]
                      : list.filter((v) => v !== option.value),
                  );
                }}
                className="size-5 shrink-0 accent-stamp"
              />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{option.label}</span>
                {option.hint && (
                  <span className="mt-0.5 block text-base text-ink-3">{option.hint}</span>
                )}
              </span>
            </label>
          );
        })}
      </div>
      <Button type="submit" size="lg" loading={busy} className="mt-2 w-full">
        {m.common.continue}
      </Button>
    </form>
  );
}

function ValueInput({
  question,
  m,
  busy,
  initial,
  onSubmit,
  onInvalid,
  errorId,
}: {
  question: Question;
  m: Widen<CitizenMessages>;
  busy: boolean;
  initial?: AnswerValue;
  onSubmit: (value: AnswerValue) => Promise<void>;
  onInvalid: (message: string | null) => void;
  errorId?: string;
}) {
  // Numbers start empty: a prefilled 0 would let a quick tap submit an answer nobody gave.
  const [value, setValue] = useState(
    typeof initial === "string" || typeof initial === "number" ? String(initial) : "",
  );
  const isNumber = question.kind === "number";

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const trimmed = value.trim();
    if (!trimmed) return question.required ? onInvalid(m.interview.required) : undefined;
    if (isNumber) {
      const n = Number(trimmed.replace(",", "."));
      const outOfRange =
        (question.min !== undefined && n < question.min) ||
        (question.max !== undefined && n > question.max);
      if (!Number.isFinite(n) || outOfRange) return onInvalid(m.interview.numberInvalid);
      return void onSubmit(n);
    }
    void onSubmit(trimmed);
  }

  const step = (delta: number) => {
    onInvalid(null);
    setValue((current) => {
      const base =
        current.trim() === ""
          ? (question.min ?? 0) - (delta > 0 ? delta : 0)
          : Number(current) || 0;
      const n = base + delta;
      const clamped = Math.min(question.max ?? Infinity, Math.max(question.min ?? 0, n));
      return String(clamped);
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-3">
      {isNumber ? (
        <div className="flex items-center gap-2" dir="ltr">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="size-14"
            onClick={() => step(-1)}
            aria-label={m.common.decrease}
          >
            <Minus className="size-5" />
          </Button>
          <Input
            value={value}
            onChange={(e) => {
              onInvalid(null);
              setValue(e.target.value);
            }}
            inputMode="numeric"
            name="answer"
            autoComplete="off"
            placeholder={question.min !== undefined ? String(question.min) : "0"}
            aria-label={question.prompt}
            aria-invalid={errorId ? true : undefined}
            aria-describedby={errorId}
            className="tabular h-14 flex-1 text-center font-display text-2xl font-semibold"
          />
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="size-14"
            onClick={() => step(1)}
            aria-label={m.common.increase}
          >
            <Plus className="size-5" />
          </Button>
        </div>
      ) : (
        <Input
          type={question.kind === "date" ? "date" : "text"}
          value={value}
          onChange={(e) => {
            onInvalid(null);
            setValue(e.target.value);
          }}
          name="answer"
          autoComplete="off"
          aria-label={question.prompt}
          aria-invalid={errorId ? true : undefined}
          aria-describedby={errorId}
          className="h-14 text-lg"
          maxLength={2000}
        />
      )}
      <Button type="submit" size="lg" loading={busy} className="w-full">
        {m.common.continue}
      </Button>
    </form>
  );
}

function AskAbout({ questionId, label }: { questionId: string; label: string }) {
  const open = useOpenAssistant();
  if (!open) return null;
  return (
    <button
      type="button"
      onClick={() => open({ questionId })}
      className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-stamp underline underline-offset-2"
    >
      <MessageCircleQuestion className="size-4" aria-hidden />
      {label}
    </button>
  );
}
