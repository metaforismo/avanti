import type { ReactNode } from "react";
import type { CaseDossier } from "@avanti/contracts";
import { cn } from "@/lib/cn";

/**
 * One message of a conversation, as a list item: who and when, the text, and the citizen's
 * original wording when it was translated. Citizen messages sit on the stamp wash, to the end
 * side unless `fill` lays them across the whole list.
 */
export function MessageBubble({
  fromCitizen,
  meta,
  text,
  originalText,
  language,
  textLang,
  fill = false,
}: {
  fromCitizen: boolean;
  meta: ReactNode;
  text: string;
  originalText?: string | null;
  /** The citizen's language, which the original text is written in. */
  language: CaseDossier["language"];
  /** Set when the text itself is in the citizen's language rather than in Italian. */
  textLang?: string;
  fill?: boolean;
}) {
  return (
    <li
      className={cn(
        "rounded-lg px-4 py-3",
        !fill && "max-w-[85%]",
        fromCitizen ? "bg-stamp-wash" : "bg-surface ring-1 ring-line",
        fromCitizen && !fill && "justify-self-end",
      )}
    >
      <p className="text-xs font-semibold text-ink-3">{meta}</p>
      <p dir="auto" lang={textLang} className="mt-1 whitespace-pre-line">
        {text}
      </p>
      {originalText && originalText !== text && (
        <p
          className={cn(
            "mt-2 border-t pt-2 text-sm text-ink-3",
            fromCitizen ? "border-stamp/15" : "border-line",
          )}
        >
          Originale:{" "}
          <span lang={language} dir="auto" className="whitespace-pre-line">
            {originalText}
          </span>
        </p>
      )}
    </li>
  );
}
