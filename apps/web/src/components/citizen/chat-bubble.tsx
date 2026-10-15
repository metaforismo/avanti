import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * One turn of a conversation with Avanti. The assistant's turns always carry their label and
 * the sparkle, so an automated reply never passes for a person's (AI Act art. 50).
 */
export function ChatBubble({
  from,
  label,
  text,
  before,
  children,
}: {
  from: "citizen" | "assistant";
  /** Who is speaking; the citizen's own turns may go without. */
  label?: string;
  text: string;
  /** Shown above the text, for what must be read first. */
  before?: ReactNode;
  /** Shown below the text: sources, follow-up actions. */
  children?: ReactNode;
}) {
  const mine = from === "citizen";
  return (
    <li className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] animate-fade-in rounded-2xl px-4 py-2.5",
          mine
            ? "rounded-ee-md bg-stamp text-on-stamp"
            : "rounded-es-md bg-surface ring-1 ring-line",
        )}
      >
        {label && (
          <p
            className={cn(
              "mb-0.5 flex items-center gap-1 text-xs",
              mine ? "text-on-stamp/80" : "text-ink-3",
            )}
          >
            {!mine && <Sparkles className="size-3" aria-hidden />}
            {label}
          </p>
        )}
        {before}
        <p dir="auto" className="break-words whitespace-pre-line">
          {text}
        </p>
        {children}
      </div>
    </li>
  );
}
