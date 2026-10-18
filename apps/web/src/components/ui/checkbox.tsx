import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A checkbox with its label and an optional hint, clickable as a whole. The "card" look is for
 * choices that matter on their own (consent, a setting); "plain" for rows in a list.
 */
export function Checkbox({
  label,
  hint,
  look = "plain",
  className,
  ...input
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: ReactNode;
  hint?: ReactNode;
  look?: "plain" | "card";
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 has-[:disabled]:cursor-not-allowed",
        look === "card" &&
          "rounded-md bg-surface p-4 ring-1 ring-line-strong ring-inset has-[:checked]:ring-stamp/50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-stamp has-[[aria-invalid=true]]:bg-danger-wash has-[[aria-invalid=true]]:ring-2 has-[[aria-invalid=true]]:ring-danger",
        className,
      )}
    >
      <input
        type="checkbox"
        {...input}
        className="mt-0.5 size-5 shrink-0 accent-stamp disabled:opacity-50"
      />
      <span className="min-w-0">
        {/* A title with a hint below is bold; a sentence to agree to reads as plain text. */}
        <span className={cn("block", look === "card" && hint && "font-semibold")}>{label}</span>
        {hint && <span className="mt-0.5 block text-sm text-ink-2">{hint}</span>}
      </span>
    </label>
  );
}
