import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { CHEVRON_PATH } from "./mark";

/*
 * Objects from a CAF desk, drawn for the site: the rubber stamp and the queue ticket the logo is
 * made from. Decorative: they repeat what the text next to them says.
 */

/** A rubber stamp, slightly turned. `pressed` plays the press once (site.css). */
export function Stamp({
  children,
  tone = "stamp",
  pressed = false,
  className,
}: {
  children: ReactNode;
  tone?: "stamp" | "ok" | "danger";
  pressed?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex rotate-[var(--stamp-rotate,-7deg)] flex-col items-center rounded-md border-[2.5px] px-3 py-1.5 text-center font-display leading-none font-bold tracking-[0.08em] uppercase [font-stretch:90%] mix-blend-multiply",
        tone === "stamp" && "border-stamp/85 text-stamp/85",
        tone === "ok" && "border-ok/85 text-ok/85",
        tone === "danger" && "border-danger/85 text-danger/85",
        pressed && "stamp-press",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** The paper number taken at the sportello: the shape of the logo, with a number on it. */
export function QueueTicket({
  number,
  label = "Numero",
  className,
}: {
  number: string;
  label?: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex items-center gap-3 rounded-[10px] bg-stamp py-2.5 ps-4 pe-5 text-on-stamp shadow-raised",
        // The two half-moon notches of a tear-off ticket, cut by the paper behind it.
        "before:absolute before:-start-2 before:top-1/2 before:size-4 before:-translate-y-1/2 before:rounded-full before:bg-[var(--notch,var(--paper))]",
        "after:absolute after:-end-2 after:top-1/2 after:size-4 after:-translate-y-1/2 after:rounded-full after:bg-[var(--notch,var(--paper))]",
        className,
      )}
    >
      <svg viewBox="11 9 9.5 14" className="h-6 w-4 shrink-0">
        <path
          d={CHEVRON_PATH}
          fill="none"
          stroke="var(--marker)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="leading-none">
        <span className="block text-[0.625rem] font-semibold tracking-[0.12em] uppercase opacity-75">
          {label}
        </span>
        <span className="tabular mt-1 block font-display text-2xl font-bold tracking-[0.02em]">
          {number}
        </span>
      </span>
    </span>
  );
}
