"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-sm bg-surface px-3 text-ink ring-1 ring-line-strong ring-inset placeholder:text-ink-3 " +
  "transition-shadow duration-150 hover:ring-ink-3 focus:ring-2 focus:ring-stamp focus:outline-none " +
  "aria-invalid:ring-danger disabled:bg-sunk disabled:text-ink-3";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-11 text-base", className)} {...props} />;
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
    <div className={cn("grid gap-1.5", className)}>
      <label
        htmlFor={id}
        className="text-ink flex items-baseline justify-between gap-2 text-sm font-semibold"
      >
        {label}
        {optional && <span className="text-ink-3 text-xs font-normal">{optional}</span>}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint && !error && (
        <p id={hintId} className="text-ink-3 text-sm">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="animate-fade-in text-danger text-sm font-medium" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
