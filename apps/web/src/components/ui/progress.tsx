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
      <div
        className={cn(
          "h-full origin-left rounded-full transition-transform duration-500 ease-(--ease-out) rtl:origin-right",
          tone === "ok" ? "bg-ok" : "bg-stamp",
        )}
        style={{ transform: `scaleX(${clamped / 100})` }}
      />
    </div>
  );
}
