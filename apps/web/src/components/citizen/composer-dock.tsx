"use client";

import { Mic, PenLine } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Language } from "@avanti/contracts";
import type { CitizenMessages, Widen } from "@/lib/citizen/messages";
import { voiceSupported } from "@/lib/citizen/use-voice";
import { Composer } from "./composer";

/**
 * The conversation's composer, pinned under the thumb. While a card waits for an answer it folds
 * into a 48 px pill, so the card's keys are never under it; a tap opens it with the cursor in
 * (or the microphone on). Its height is published as `--citizen-dock` and as the page's
 * scroll padding: whatever is brought into view stops above it.
 */
export function ComposerDock({
  token,
  language,
  m,
  compact,
  busy,
  voiceEnabled,
  onSend,
}: {
  token: string;
  language: Language;
  m: Widen<CitizenMessages>;
  /** A question or a «Ho capito così» card is on screen. */
  compact: boolean;
  busy: boolean;
  voiceEnabled: boolean;
  onSend: (text: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState<"text" | "voice" | null>(null);
  const canSpeak = useSyncExternalStore(noSubscription, voiceSupported, () => false);
  const dock = useRef<HTMLDivElement>(null);
  const pill = compact && open === null && !busy;

  useEffect(() => {
    const element = dock.current;
    if (!element) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => {
      const height = element.offsetHeight;
      root.style.setProperty("--citizen-dock", `${height}px`);
      root.style.scrollPaddingBottom = `${height + 16}px`;
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--citizen-dock");
      root.style.scrollPaddingBottom = "";
    };
  }, []);

  return (
    <div
      ref={dock}
      className="sticky bottom-0 z-20 -mx-5 bg-linear-to-t from-paper from-75% to-paper/0 px-5 pt-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      {pill ? (
        <div key="pill" className="cz-swap flex h-12 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setOpen("text")}
            className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-surface ps-4 pe-3 text-start text-ink-3 shadow-raised ring-1 ring-line-strong transition-[transform,box-shadow] duration-150 ease-(--ease-out) active:scale-[0.98]"
          >
            <PenLine className="size-[1.125rem] shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{m.conversation.placeholder}</span>
          </button>
          {canSpeak && voiceEnabled && (
            <button
              type="button"
              onClick={() => setOpen("voice")}
              aria-label={m.conversation.speak}
              className="grid size-12 shrink-0 place-items-center rounded-full bg-surface text-ink-2 shadow-raised ring-1 ring-line-strong transition-transform duration-150 ease-(--ease-out) active:scale-[0.92]"
            >
              <Mic className="size-5" aria-hidden />
            </button>
          )}
        </div>
      ) : (
        <div key="composer" className={compact ? "cz-swap" : undefined}>
          <Composer
            token={token}
            language={language}
            m={m}
            label={m.conversation.placeholder}
            placeholder={m.conversation.placeholder}
            maxLength={1000}
            busy={busy}
            voiceEnabled={voiceEnabled}
            autoFocus={open === "text"}
            autoStartVoice={open === "voice"}
            onIdleBlur={() => setOpen(null)}
            onSend={async (text) => {
              const sent = await onSend(text);
              if (sent) setOpen(null);
              return sent;
            }}
          />
        </div>
      )}
    </div>
  );
}

const noSubscription = () => () => {};
