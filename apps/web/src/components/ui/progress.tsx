import { cn } from "@/lib/cn";

export function ProgressBar({
  value,
  label,
  className,
  tone = "stamp",
}: {
  value: number;
  label: string;
  className?: string;
  tone?: "stamp" | "ok";
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      className={cn("h-1.5 overflow-hidden rounded-full bg-sunk", className)}
    >
      {/* Slid in from the start edge rather than scaled: scaleX squashed the rounded end into
          a flat stub at low values. Still transform-only (see docs/DESIGN.md). */}
      <div
        className={cn(
          "h-full rounded-full transition-transform duration-300 ease-(--ease-out)",
          tone === "ok" ? "bg-ok" : "bg-stamp",
        )}
        style={{ transform: `translateX(calc(${clamped - 100}% * var(--inline-sign, 1)))` }}
      />
    </div>
  );
}
