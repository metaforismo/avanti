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
      className={cn("bg-sunk h-1.5 overflow-hidden rounded-full", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-(--ease-out)",
          tone === "ok" ? "bg-ok" : "bg-stamp",
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
