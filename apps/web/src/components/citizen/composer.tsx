"use client";

import { Mic, SendHorizontal, Square } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import type { Language } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { CitizenMessages, Widen } from "@/lib/citizen/messages";
import { MAX_RECORDING_SECONDS, useVoice, voiceSupported } from "@/lib/citizen/use-voice";
import { cn } from "@/lib/cn";

/**
 * Where the citizen writes or speaks. Speech comes back as text in the box, so they can read and
 * fix it before sending: a transcript is never sent on its own.
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
}: {
  /** Off when the CAF has switched off AI for citizens: recordings would go to a provider. */
  voiceEnabled?: boolean;
  token: string;
  language: Language;
  m: Widen<CitizenMessages>;
  label: string;
  placeholder: string;
  maxLength: number;
  busy: boolean;
  /** Resolves true when the text was accepted, so the box can be cleared. */
  onSend: (text: string) => Promise<boolean>;
}) {
  const [text, setText] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const voice = useVoice(token, language);
  const recording = voice.state.kind === "recording";
  const transcribing = voice.state.kind === "transcribing";

  // False on the server and during hydration: only the browser knows whether it can record.
  const canSpeak = useSyncExternalStore(noSubscription, voiceSupported, () => false);

  // Grow with the text up to a few lines, then scroll inside.
  useEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const value = text.trim();
    if (!value || busy) return;
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

  return (
    <form onSubmit={submit} className="grid gap-1.5">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div
        className={cn(
          "flex items-end gap-1.5 rounded-xl bg-surface p-1.5 ring-1 ring-line-strong transition-shadow",
          "focus-within:ring-2 focus-within:ring-stamp",
          recording && "ring-2 ring-danger",
        )}
      >
        <textarea
          ref={field}
          id={id}
          dir="auto"
          rows={1}
          value={text}
          maxLength={maxLength}
          placeholder={recording ? "" : placeholder}
          onChange={(e) => {
            setText(e.target.value);
            if (voice.state.kind === "error") voice.reset();
          }}
          onKeyDown={onKeyDown}
          disabled={recording || transcribing}
          className="min-h-11 flex-1 resize-none bg-transparent px-2.5 py-2.5 text-base leading-snug outline-none placeholder:text-ink-3 disabled:opacity-60"
        />
        {canSpeak && voiceEnabled && (
          <Button
            type="button"
            variant={recording ? "danger" : "ghost"}
            size="icon"
            className="size-11 shrink-0 rounded-lg"
            onClick={() => void speak()}
            disabled={transcribing || busy}
            aria-pressed={recording}
            aria-label={recording ? m.conversation.stop : m.conversation.speak}
          >
            {transcribing ? (
              <Spinner className="size-5" />
            ) : recording ? (
              <Square className="size-4 fill-current" aria-hidden />
            ) : (
              <Mic className="size-5" aria-hidden />
            )}
          </Button>
        )}
        <Button
          type="submit"
          size="icon"
          className="size-11 shrink-0 rounded-lg"
          loading={busy}
          disabled={!text.trim() || recording || transcribing}
          aria-label={m.conversation.send}
        >
          <SendHorizontal className="rtl-flip size-5" aria-hidden />
        </Button>
      </div>
      <p role="status" dir="auto" className="tabular min-h-5 px-1 text-sm text-ink-3">
        {recording
          ? `● ${clock(voice.state.kind === "recording" ? voice.state.seconds : 0)} / ${clock(MAX_RECORDING_SECONDS)}`
          : transcribing
            ? m.conversation.transcribing
            : (voiceNotice ?? "")}
      </p>
    </form>
  );
}

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

const noSubscription = () => () => {};
