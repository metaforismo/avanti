import { cn } from "@/lib/cn";

/**
 * A placeholder shaped like the content that is loading. Hidden from assistive technology:
 * the page announces loading once (aria-busy or a status line), not each grey bar.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-xs bg-sunk", className)} />;
}

/** A few text lines of decreasing width: a paragraph about to appear. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  const widths = ["w-11/12", "w-3/4", "w-2/3", "w-1/2"];
  return (
    <div aria-hidden className={cn("grid gap-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className={cn("h-4 animate-pulse rounded-xs bg-sunk", widths[i % widths.length])}
        />
      ))}
    </div>
  );
}
