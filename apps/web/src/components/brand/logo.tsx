import { cn } from "@/lib/cn";
import { CHEVRON_PATH, TICKET_PATH } from "./mark";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <path d={TICKET_PATH} fill="var(--stamp)" />
      <path
        d={CHEVRON_PATH}
        fill="none"
        stroke="var(--marker)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span translate="no" className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="font-display text-[1.375rem] leading-none font-bold tracking-[-0.02em] text-ink [font-stretch:92%]">
        Avanti
      </span>
    </span>
  );
}
