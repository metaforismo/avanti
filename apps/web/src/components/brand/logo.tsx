import { cn } from "@/lib/cn";
import { CHEVRON_PATH, TICKET_PATH } from "./mark";

/** `reversed` is the mark for dark and stamp-blue grounds (docs/brand/avanti-mark-reversed.svg):
    a white slip with the chevron in stamp blue, so it never melts into a blue field. */
export function LogoMark({
  className,
  reversed = false,
}: {
  className?: string;
  reversed?: boolean;
}) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <path d={TICKET_PATH} fill={reversed ? "var(--on-contrast)" : "var(--stamp)"} />
      <path
        d={CHEVRON_PATH}
        fill="none"
        stroke={reversed ? "var(--stamp)" : "var(--marker)"}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** `inverted` is the wordmark on a dark ground (the site header over the dark and blue fields). */
export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span translate="no" className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark reversed={inverted} />
      <span
        className={cn(
          "font-display text-[1.375rem] leading-none font-bold tracking-[-0.02em] [font-stretch:92%] transition-colors duration-200",
          inverted ? "text-on-contrast" : "text-ink",
        )}
      >
        Avanti
      </span>
    </span>
  );
}
