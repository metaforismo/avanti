import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** A key in a hint («⌘K», «V»): small and outlined, so it reads as a key, not as text. */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        // A keycap: a lower edge one shade darker, like a key seen from slightly above.
        "inline-grid h-5 min-w-5 place-items-center rounded-xs bg-surface px-1.5 font-mono text-[0.6875rem] leading-none text-ink-3 shadow-[inset_0_-1px_0_var(--line-strong)] ring-1 ring-line",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
