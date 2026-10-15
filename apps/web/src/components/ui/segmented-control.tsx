import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A small set of mutually exclusive views (period, filter): toggle buttons in one group,
 * the current one pressed. For navigation between pages use links, not this.
 */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  size = "sm",
  className,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: ReactNode; disabled?: boolean }[];
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("flex w-fit rounded-sm bg-sunk p-0.5", className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-xs px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-stamp focus-visible:outline-none disabled:opacity-50",
              size === "sm" ? "h-8" : "h-9",
              active ? "bg-surface font-semibold text-ink shadow-xs" : "text-ink-2 hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
