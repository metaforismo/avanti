import { cn } from "@/lib/cn";

/** Queue-ticket mark: the paper number you take at the sportello, pointing forward. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <path
        d="M6 5h20a3 3 0 0 1 3 3v5.2a2.8 2.8 0 0 0 0 5.6V24a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-5.2a2.8 2.8 0 0 0 0-5.6V8a3 3 0 0 1 3-3Z"
        fill="var(--stamp)"
      />
      <path
        d="M13.5 11.5 18 16l-4.5 4.5"
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
