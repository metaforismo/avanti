import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** A key in a hint («⌘K», «V»): small and outlined, so it reads as a key, not as text. */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "rounded-xs px-1.5 font-mono text-xs text-ink-3 ring-1 ring-line-strong",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
