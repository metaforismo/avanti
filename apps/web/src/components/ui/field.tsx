"use client";

import { ChevronDown } from "lucide-react";
import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-sm bg-surface px-3 text-ink ring-1 ring-line-strong ring-inset placeholder:text-ink-3 " +
  "transition-shadow duration-150 hover:ring-ink-3 focus:ring-2 focus:ring-stamp focus:outline-none " +
  "aria-invalid:ring-danger disabled:bg-sunk disabled:text-ink-3";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-11 text-base", className)} {...props} />;
}

/** Native select (keyboard and screen readers for free) styled like the other controls. */
export function Select({
  className,
  wrapperClassName,
  compact = false,
  ...props
}: ComponentProps<"select"> & { wrapperClassName?: string; compact?: boolean }) {
  return (
    <span className={cn("relative flex", wrapperClassName)}>
      <select
        className={cn(
          control,
          "cursor-pointer appearance-none pe-9",
          compact ? "h-10 text-[0.9375rem]" : "h-11 text-base",
          className,
        )}
        {...props}
      />
      <ChevronDown
        className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-ink-3"
        aria-hidden
      />
    </span>
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea className={cn(control, "min-h-24 resize-y py-2.5 text-base", className)} {...props} />
  );
}

/** Label + control + hint/error wired with ids for screen readers. */
export function Field({
  label,
  hint,
  error,
  optional,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  optional?: string;
  children: (props: {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }) => ReactNode;
  className?: string;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    // content-start: next to a taller field (one with a hint) the control stays aligned on top.
    <div className={cn("grid content-start gap-1.5", className)}>
      <label
        htmlFor={id}
        className="flex items-baseline justify-between gap-2 text-sm font-semibold text-ink"
      >
        {label}
        {optional && <span className="text-xs font-normal text-ink-3">{optional}</span>}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint && !error && (
        <p id={hintId} className="text-sm text-ink-3">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="animate-fade-in text-sm font-medium text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
