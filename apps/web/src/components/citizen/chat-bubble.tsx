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
  children,
}: {
  from: "citizen" | "assistant";
  /** Who is speaking. The citizen's own turns show it only to screen readers. */
  label?: string;
  text: string;
  /** Shown above the text, for what must be read first. */
  before?: ReactNode;
  /** Shown below the text: sources, follow-up actions. */
  children?: ReactNode;
}) {
  if (from === "citizen") {
    return (
      <li className="flex animate-fade-in justify-end">
        <div className="max-w-[85%] rounded-3xl rounded-ee-md bg-sunk px-4 py-2.5 text-ink">
          {label && <span className="sr-only">{label}: </span>}
          <p dir="auto" className="break-words whitespace-pre-line">
            {text}
          </p>
          {children}
        </div>
      </li>
    );
  }
  return (
    <li className="grid animate-fade-in gap-1.5">
      <AssistantMark label={label} />
      <div className="ps-8">
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

/** The assistant's name with its mark, at the head of each automated reply. */
export function AssistantMark({ label, className }: { label?: string; className?: string }) {
  return (
    <p className={cn("flex items-center gap-2 text-sm font-semibold text-ink-2", className)}>
      <span
        aria-hidden
        className="grid size-6 shrink-0 place-items-center rounded-full bg-stamp-wash text-stamp ring-1 ring-stamp/15"
      >
        <Sparkles className="size-3.5" />
      </span>
      {label}
    </p>
  );
}

/** While Avanti reads: the mark and a softly shimmering line, as the chat apps do. */
export function Thinking({ label, text }: { label?: string; text: string }) {
  return (
    <li className="grid gap-1.5" aria-label={text}>
      <AssistantMark label={label} />
      <p aria-hidden className="text-shimmer ps-8 text-[1.0625rem]">
        {text}
      </p>
    </li>
  );
}
