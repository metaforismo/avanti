import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { WithCallLinks } from "./call-links";

/**
 * One turn of a conversation with Avanti. The citizen's words sit in a bubble on their side; the
 * assistant's reply reads as plain text under its name and mark, so an automated answer never
 * passes for a person's (AI Act art. 50) and long explanations stay easy to read.
 */
export function ChatBubble({
  from,
  label,
  text,
  before,
  context,
  children,
}: {
  from: "citizen" | "assistant";
  /** Who is speaking. The citizen's own turns show it only to screen readers. */
  label?: string;
  text: string;
  /** Shown above the text, for what must be read first. */
  before?: ReactNode;
  /** The question a citizen's short answer replies to, quoted like a chat reply. */
  context?: string | null;
  /** Shown below the text: sources, follow-up actions. */
  children?: ReactNode;
}) {
  if (from === "citizen") {
    return (
      <li data-from="citizen" className="flex animate-fade-in scroll-mt-40 justify-end">
        <div className="max-w-[85%] rounded-3xl bg-sunk px-4 py-2.5 text-ink">
          {/* The question first, then who answered: «Hai un'auto? Tu: No», not «Tu: Hai un'auto?». */}
          {context && (
            <blockquote
              dir="auto"
              className="mb-1 line-clamp-3 border-s-2 border-line-strong ps-2 text-sm leading-snug break-words text-ink-3"
            >
              {context}
            </blockquote>
          )}
          <p
            dir="auto"
            className={cn("break-words whitespace-pre-line", context && "font-semibold")}
          >
            {label && <span className="sr-only">{label}: </span>}
            <span>{text}</span>
          </p>
          {children}
        </div>
      </li>
    );
  }
  return (
    <li className="flex animate-rise gap-3">
      <AssistantAvatar />
      <div className="min-w-0 flex-1 pt-0.5">
        {label && <span className="sr-only">{label}: </span>}
        {before}
        <p
          dir="auto"
          className="text-[1.0625rem] leading-relaxed break-words whitespace-pre-line text-ink"
        >
          <WithCallLinks text={text} />
        </p>
        {children}
      </div>
    </li>
  );
}

/** The assistant's mark beside each automated reply (AI Act art. 50 transparency). */
export function AssistantAvatar() {
  return (
    <span
      aria-hidden
      className="grid size-7 shrink-0 place-items-center rounded-full bg-stamp-wash text-stamp ring-1 ring-stamp/20"
    >
      <Sparkles className="size-3.5" />
    </span>
  );
}

/** While Avanti reads: the mark and a softly shimmering line, as the chat apps do. */
export function Thinking({ text }: { label?: string; text: string }) {
  return (
    <li className="flex gap-3" aria-label={text}>
      <AssistantAvatar />
      <p aria-hidden className="text-shimmer pt-0.5 text-[1.0625rem]">
        {text}
      </p>
    </li>
  );
}
