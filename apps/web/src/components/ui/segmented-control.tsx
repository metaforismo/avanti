import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A small set of mutually exclusive views (period, filter): toggle buttons in one group,
 * the current one pressed. For navigation between pages use links, not this.
 *
 * Always one line: options never wrap inside themselves. Below `sm` the track takes the full
 * width and shares it out; if the labels still don't fit, the track scrolls sideways inside
 * itself, never the page.
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
      className={cn(
        "flex w-fit max-w-full [scrollbar-width:none] overflow-x-auto rounded-sm bg-sunk p-0.5 max-sm:w-full",
        className,
      )}
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
              "shrink-0 rounded-xs border px-3 text-sm whitespace-nowrap transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-stamp focus-visible:outline-none disabled:opacity-50 max-sm:flex-1 max-sm:px-2",
              size === "sm" ? "h-7" : "h-8",
              active
                ? "border-line bg-surface font-semibold text-ink"
                : "border-transparent text-ink-2 hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
