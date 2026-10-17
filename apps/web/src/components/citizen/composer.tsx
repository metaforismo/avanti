"use client";

import { ArrowUp, Mic, Square } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type { Language } from "@avanti/contracts";
import { Spinner } from "@/components/ui/spinner";
import type { CitizenMessages, Widen } from "@/lib/citizen/messages";
import { MAX_RECORDING_SECONDS, useVoice, voiceSupported } from "@/lib/citizen/use-voice";
import { cn } from "@/lib/cn";

/**
 * Where the citizen writes or speaks: the text on top, the actions in a bar below, like the chat
 * apps people already know. Speech comes back as text in the box, so they can read and fix it
 * before sending: a transcript is never sent on its own.
 */
export function Composer({
  token,
  language,
  m,
  label,
  placeholder,
  maxLength,
  busy,
  onSend,
  voiceEnabled = true,
  size = "chat",
  inputId,
  describedBy,
  invalid = false,
  sendLabel,
  leading,
  onTextChange,
}: {
  token: string;
  language: Language;
  m: Widen<CitizenMessages>;
  /** Accessible name; omit when an outside <label htmlFor={inputId}> names the field. */
  label?: string;
  placeholder: string;
  maxLength: number;
  busy: boolean;
  /** Resolves true when the text was accepted, so the box can be cleared. */
  onSend: (text: string) => Promise<boolean>;
  /** Off when the CAF has switched off AI for citizens: recordings would go to a provider. */
  voiceEnabled?: boolean;
  /** "hero" is the first question of the practice: a roomier box. */
  size?: "hero" | "chat";
  inputId?: string;
  describedBy?: string;
  invalid?: boolean;
  /** Name of the send button when "send" is not the right verb (e.g. "Continua"). */
  sendLabel?: string;
  /** Extra actions at the start of the bar. */
  leading?: ReactNode;
  onTextChange?: () => void;
}) {
  const [text, setText] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  const ownId = useId();
  const id = inputId ?? ownId;
  const voice = useVoice(token, language);
  const recording = voice.state.kind === "recording";
  const transcribing = voice.state.kind === "transcribing";

  // False on the server and during hydration: only the browser knows whether it can record.
  const canSpeak = useSyncExternalStore(noSubscription, voiceSupported, () => false);
  const max = size === "hero" ? 280 : 168;

  // Grow with the text up to a few lines, then scroll inside.
  useEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  }, [text, max]);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const value = text.trim();
    if (busy) return;
    if (!value) {
      field.current?.focus();
      return;
    }
    if (await onSend(value)) setText("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends on a keyboard; on phones the on-screen key inserts a new line as expected.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      if (window.matchMedia("(pointer: fine)").matches) {
        event.preventDefault();
        void submit();
      }
    }
  }

  async function speak() {
    if (recording) {
      voice.stop();
      return;
    }
    const transcript = await voice.start();
    if (transcript) {
      setText((current) => (current ? `${current.trimEnd()} ${transcript}` : transcript));
      requestAnimationFrame(() => field.current?.focus());
    }
  }

  const voiceNotice =
    voice.state.kind === "error"
      ? voice.state.reason === "denied"
        ? m.conversation.micDenied
        : voice.state.reason === "too_long"
          ? m.conversation.voiceTooLong
          : m.conversation.voiceUnavailable
      : null;
  const status = recording
    ? `${clock(voice.state.kind === "recording" ? voice.state.seconds : 0)} / ${clock(MAX_RECORDING_SECONDS)}`
    : transcribing
      ? m.conversation.transcribing
      : voiceNotice;
  const empty = !text.trim();

  return (
    <form onSubmit={submit} className="grid gap-1.5">
      {label && (
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
      )}
      <div
        // A click anywhere on the box puts the cursor in the text, as in every chat app.
        onClick={(event) => {
          if (event.target === event.currentTarget) field.current?.focus();
        }}
        className={cn(
          "grid rounded-xl bg-surface shadow-raised ring-1 ring-line-strong transition-shadow",
          "focus-within:ring-2 focus-within:ring-stamp/60",
          invalid && "ring-2 ring-danger/70",
          recording && "ring-2 ring-danger",
        )}
      >
        <textarea
          ref={field}
          id={id}
          dir="auto"
          rows={size === "hero" ? 3 : 1}
          value={text}
          maxLength={maxLength}
          placeholder={recording ? "" : placeholder}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(e) => {
            setText(e.target.value);
            onTextChange?.();
            if (voice.state.kind === "error") voice.reset();
          }}
          onKeyDown={onKeyDown}
          disabled={recording || transcribing}
          className={cn(
            "w-full resize-none bg-transparent px-4 text-ink outline-none placeholder:text-ink-3 disabled:opacity-60",
            size === "hero"
              ? "min-h-24 pt-4 pb-1 text-lg leading-relaxed"
              : "min-h-11 pt-3 pb-0.5 text-base leading-snug",
          )}
        />
        <div className="flex items-center gap-1.5 px-2 pb-2">
          {leading}
          {status && (
            <span
              dir="auto"
              className={cn(
                "tabular flex min-w-0 items-center gap-2 truncate px-2 text-sm",
                recording ? "font-semibold text-danger" : "text-ink-3",
              )}
            >
              {recording && (
                <span
                  aria-hidden
                  className="size-2 shrink-0 animate-pulse rounded-full bg-danger"
                />
              )}
              {status}
            </span>
          )}
          <span className="ms-auto" />
          {canSpeak && voiceEnabled && (
            <button
              type="button"
              onClick={() => void speak()}
              disabled={transcribing || busy}
              aria-pressed={recording}
              aria-label={recording ? m.conversation.stop : m.conversation.speak}
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-stamp focus-visible:outline-none disabled:opacity-50",
                recording
                  ? "bg-danger-wash text-danger"
                  : "text-ink-2 hover:bg-sunk hover:text-ink",
              )}
            >
              {transcribing ? (
                <Spinner className="size-5" />
              ) : recording ? (
                <Square className="size-4 fill-current" aria-hidden />
              ) : (
                <Mic className="size-5" aria-hidden />
              )}
            </button>
          )}
          <button
            type="submit"
            disabled={busy || recording || transcribing}
            aria-label={sendLabel ?? m.conversation.send}
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-stamp focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none disabled:cursor-not-allowed",
              empty ? "bg-sunk text-ink-3" : "bg-contrast text-on-contrast hover:opacity-90",
            )}
          >
            {busy ? <Spinner className="size-5" /> : <ArrowUp className="size-5" aria-hidden />}
          </button>
        </div>
      </div>
      {/* Announced to screen readers; on screen it lives inside the bar. */}
      <p role="status" className="sr-only">
        {recording ? m.conversation.recording : (status ?? "")}
      </p>
    </form>
  );
}

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

const noSubscription = () => () => {};
