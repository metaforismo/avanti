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

/*
 * The two half-moon notches of a tear-off ticket are cut out of the ticket (a mask), not painted
 * in the colour of whatever is behind it: so the ticket has real holes on paper, on the dotted
 * desk and on the dark closing card alike. Radius 8px, centred on the side edges. The shadow
 * cannot be the ticket's own box-shadow (the mask would clip it), so the wrapper drops it.
 */
const NOTCHES =
  "radial-gradient(circle 8px at 0 50%, #0000 7.5px, #000 8px), radial-gradient(circle 8px at 100% 50%, #0000 7.5px, #000 8px)";
const notchStyle = {
  maskImage: NOTCHES,
  WebkitMaskImage: NOTCHES,
  maskComposite: "intersect",
  WebkitMaskComposite: "source-in",
} as const;

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
        "inline-flex [filter:drop-shadow(0_1px_1px_rgb(20_27_45/0.1))_drop-shadow(0_8px_10px_rgb(20_27_45/0.14))]",
        className,
      )}
    >
      <span
        style={notchStyle}
        className="inline-flex items-center gap-3 rounded-[10px] bg-stamp py-2.5 ps-4 pe-5 text-on-stamp"
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
    </span>
  );
}
