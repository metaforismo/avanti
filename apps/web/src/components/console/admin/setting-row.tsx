import { useId, type ComponentProps, type InputHTMLAttributes, type ReactNode } from "react";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";

/**
 * Building blocks of the settings page, after Linear's settings: a small title above a card whose
 * rows are divided by hairlines, each row a name with a one-line description and its control on
 * the right. Local to the console admin; the generic controls live in components/ui.
 */
export function SettingGroup({
  title,
  lead,
  children,
  id,
  className,
}: {
  title?: ReactNode;
  lead?: ReactNode;
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div id={id} className={className}>
      {title && (
        <div className="mb-2">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {lead && <p className="mt-0.5 text-sm text-ink-3">{lead}</p>}
        </div>
      )}
      <div className="divide-y divide-line overflow-hidden rounded-lg bg-surface shadow-raised ring-1 ring-line">
        {children}
      </div>
    </div>
  );
}

const rowLayout =
  "grid gap-x-6 gap-y-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center";

/** A yes/no setting. A native checkbox drawn as a switch: forms, labels and tests keep working. */
export function ToggleRow({
  label,
  hint,
  className,
  ...input
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: ReactNode; hint?: ReactNode }) {
  const id = useId();
  // The whole row stays clickable, but the name is the label alone: the hint is a description.
  const labelId = `${id}-label`;
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <label
      className={cn(
        rowLayout,
        "cursor-pointer transition-colors duration-100 hover:bg-sunk/50 has-[:disabled]:cursor-not-allowed has-[:disabled]:hover:bg-transparent has-[:focus-visible]:bg-sunk/50",
        className,
      )}
    >
      <span className="min-w-0 sm:order-1">
        <span id={labelId} className="block font-semibold">
          {label}
        </span>
        {hint && (
          <span id={hintId} className="mt-0.5 block max-w-xl text-sm text-ink-3">
            {hint}
          </span>
        )}
      </span>
      <input
        type="checkbox"
        aria-labelledby={labelId}
        aria-describedby={hintId}
        {...input}
        className={cn(
          "relative h-6 w-10 shrink-0 cursor-pointer appearance-none justify-self-start rounded-full bg-line-field sm:order-2 sm:justify-self-end",
          "transition-colors duration-150 ease-(--ease-out) checked:bg-stamp",
          "after:absolute after:start-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow-sm",
          "after:transition-transform after:duration-150 after:ease-(--ease-out) checked:after:translate-x-4",
          "focus-visible:ring-2 focus-visible:ring-stamp focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      />
    </label>
  );
}

/** A setting with a value to type or pick: name and description left, the control right. */
export function ValueRow({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: (props: {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }) => ReactNode;
  className?: string;
}) {
  const id = useId();
  const hintId = hint && !error ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cn(rowLayout, className)}>
      <div className="min-w-0">
        <label htmlFor={id} className="block font-semibold">
          {label}
        </label>
        {hint && !error && (
          <p id={hintId} className="mt-0.5 max-w-xl text-sm text-ink-3">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="mt-0.5 text-sm font-medium text-danger">
            {error}
          </p>
        )}
      </div>
      <div className="sm:justify-self-end">
        {children({
          id,
          "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined,
          "aria-invalid": error ? true : undefined,
        })}
      </div>
    </div>
  );
}

/** A whole number with its unit inside the field, so «30» is never left to be guessed as days. */
export function NumberInput({
  unit,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { unit: string }) {
  return (
    <span className="relative inline-flex">
      <Input
        type="text"
        {...props}
        className={cn("tabular w-36 text-end", unit.length > 1 ? "pe-14" : "pe-9", className)}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-body-sm text-ink-3"
      >
        {unit}
      </span>
    </span>
  );
}
