"use client";

import { ChevronDown, Minus, Plus } from "lucide-react";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import type { AnswerValue, MemberInput, Question } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import type { CitizenMessages, Widen } from "@/lib/citizen/messages";
import type { CitizenCaseApi } from "@/lib/citizen/use-citizen-case";
import { cn } from "@/lib/cn";
import { MembersEditor } from "./members-editor";

type Props = {
  api: CitizenCaseApi;
  question: Question;
  m: Widen<CitizenMessages>;
  initial?: AnswerValue;
};

/**
 * One question at a time, with the input that fits its kind. Choice answers submit on tap:
 * fewer steps for people who struggle with forms.
 */
export function QuestionCard({ api, question, m, initial }: Props) {
  const titleId = useId();
  const [localError, setLocalError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const busy = api.pending === "answer" || api.pending === "skip";

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
        className="mt-1 font-display text-2xl leading-tight font-semibold tracking-[-0.015em]"
      >
        {question.prompt}
      </h2>
      {question.help && <WhyWeAsk label={m.interview.why}>{question.help}</WhyWeAsk>}

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
          />
        )}
        {question.kind === "members" && (
          <MembersEditor
            m={m}
            busy={busy}
            initial={Array.isArray(initial) ? (initial as MemberInput[]) : []}
            onSubmit={(members) => void answer(members)}
          />
        )}
      </div>

      {localError && (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {localError}
        </p>
      )}

      {!question.required && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void api.turn({ type: "skip", questionId: question.id }, "skip")}
          className="mt-4 inline-flex items-center gap-2 rounded-sm text-ink-2 underline underline-offset-4 hover:text-ink disabled:opacity-50"
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
}: {
  options: { value: string; label: string; hint?: string }[];
  onChoose: (value: string) => void;
  pendingValue: string | null;
  disabled: boolean;
  selected: string | null;
}) {
  return (
    <div role="group" className="grid gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          aria-pressed={selected === option.value}
          onClick={() => onChoose(option.value)}
          className={cn(
            "flex min-h-14 w-full items-center gap-3 rounded-md px-4 py-3 text-start text-lg ring-1 ring-line-strong transition-[background-color,box-shadow] duration-150 ring-inset",
            "hover:bg-sunk active:bg-stamp-wash disabled:cursor-wait",
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
}: {
  question: Question;
  m: Widen<CitizenMessages>;
  busy: boolean;
  initial?: AnswerValue;
  onSubmit: (value: AnswerValue) => Promise<void>;
  onInvalid: (message: string | null) => void;
}) {
  const [values, setValues] = useState<string[]>(
    Array.isArray(initial)
      ? (initial as unknown[]).filter((v): v is string => typeof v === "string")
      : [],
  );
  function submit(event: FormEvent) {
    event.preventDefault();
    if (question.required && values.length === 0) return onInvalid(m.interview.selectAtLeastOne);
    void onSubmit(values);
  }
  return (
    <form onSubmit={submit} className="grid gap-2">
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
}: {
  question: Question;
  m: Widen<CitizenMessages>;
  busy: boolean;
  initial?: AnswerValue;
  onSubmit: (value: AnswerValue) => Promise<void>;
  onInvalid: (message: string | null) => void;
}) {
  const [value, setValue] = useState(
    typeof initial === "string" || typeof initial === "number"
      ? String(initial)
      : question.kind === "number"
        ? String(question.min ?? 0)
        : "",
  );
  const isNumber = question.kind === "number";

  function submit(event: FormEvent) {
    event.preventDefault();
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
      const n = (Number(current) || 0) + delta;
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
            aria-label="−1"
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
            aria-label={question.prompt}
            className="tabular h-14 flex-1 text-center font-display text-2xl font-semibold"
          />
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="size-14"
            onClick={() => step(1)}
            aria-label="+1"
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
          aria-label={question.prompt}
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
