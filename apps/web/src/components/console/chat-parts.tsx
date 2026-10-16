"use client";

import { ArrowUp, ArrowUpRight, CornerDownRight, Sparkles } from "lucide-react";
import { useEffect, useRef, type FormEvent, type ReactNode, type RefObject } from "react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";

/** The copilot's mark: every automated reply in the console starts with it. */
export function CopilotAvatar({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-stamp-wash text-stamp ring-1 ring-stamp/20",
        size === "lg" ? "size-9" : "size-7",
      )}
    >
      <Sparkles className={size === "lg" ? "size-4.5" : "size-3.5"} />
    </span>
  );
}

/** The operator's own message, on the right as in the chat apps. */
export function QuestionBubble({ text }: { text: string }) {
  return (
    <li className="flex justify-end">
      <p className="max-w-[85%] rounded-3xl bg-sunk px-4 py-2.5 whitespace-pre-line">
        <span className="sr-only">Tu: </span>
        {text}
      </p>
    </li>
  );
}

/** «Reading…» in place of the answer while it is on its way. */
export function ThinkingRow({ text }: { text: string }) {
  return (
    <li className="flex gap-3" aria-label={text}>
      <CopilotAvatar />
      <p aria-hidden className="text-shimmer pt-0.5">
        {text}
      </p>
    </li>
  );
}

/** Example questions on an empty chat: a list of rows, each one click away from being asked. */
export function Starters({
  items,
  onPick,
}: {
  items: readonly string[];
  onPick: (question: string) => void;
}) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl bg-surface ring-1 ring-line">
      {items.map((item) => (
        <li key={item}>
          <button
            type="button"
            onClick={() => onPick(item)}
            className="group flex w-full items-center gap-3 px-4 py-3 text-start text-body-sm transition-colors hover:bg-paper focus-visible:bg-paper focus-visible:outline-none"
          >
            <span className="min-w-0 flex-1">{item}</span>
            <ArrowUpRight className="size-4 shrink-0 text-ink-3 group-hover:text-ink" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Next questions, as in the chat apps: plain rows under the answer, each a click away. */
export function FollowUps({
  items,
  onPick,
}: {
  items: readonly string[];
  onPick: (question: string) => void;
}) {
  return (
    <ul className="ms-10 mt-3 divide-y divide-line">
      {items.map((item) => (
        <li key={item}>
          <button
            type="button"
            onClick={() => onPick(item)}
            className="group flex w-full items-start gap-3 py-2.5 text-start text-body-sm text-ink-2 transition-colors hover:text-ink focus-visible:text-ink focus-visible:outline-none"
          >
            <CornerDownRight
              className="rtl-flip mt-0.5 size-4 shrink-0 text-ink-3 group-hover:text-stamp"
              aria-hidden
            />
            <span className="min-w-0 flex-1">{item}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * The question box of the console chats: it grows with the text, Enter sends and Shift+Enter
 * starts a new line, the round button turns dark once there is something to send.
 */
export function ChatInput({
  id,
  label,
  value,
  onChange,
  onSend,
  pending,
  placeholder,
  maxLength,
  sendLabel = "Invia la domanda",
  inputRef,
  footer,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSend: (value: string) => void;
  pending: boolean;
  placeholder: string;
  maxLength: number;
  sendLabel?: string;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  footer?: ReactNode;
}) {
  const own = useRef<HTMLTextAreaElement>(null);
  const field = inputRef ?? own;

  useEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value, field]);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSend(value);
  }

  return (
    <form onSubmit={submit} className="grid gap-2">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="flex items-end gap-2 rounded-2xl bg-surface p-1.5 ps-3 ring-1 ring-line focus-within:ring-line-strong">
        <textarea
          ref={field}
          id={id}
          rows={1}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              onSend(value);
            }
          }}
          className="min-h-10 flex-1 resize-none bg-transparent py-2 outline-none placeholder:text-ink-3"
        />
        <button
          type="submit"
          disabled={pending}
          aria-label={sendLabel}
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-stamp focus-visible:outline-none",
            value.trim().length >= 3
              ? "bg-contrast text-on-contrast hover:opacity-90"
              : "bg-sunk text-ink-3",
          )}
        >
          {pending ? <Spinner className="size-5" /> : <ArrowUp className="size-5" aria-hidden />}
        </button>
      </div>
      {footer && <p className="text-center text-xs text-ink-3">{footer}</p>}
    </form>
  );
}
