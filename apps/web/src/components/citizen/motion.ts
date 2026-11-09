import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

/**
 * Entrance order of the blocks of a step (`cz-in`, citizen.css): one after the other, never
 * more than six deep, so a long page does not make the last block wait for its turn.
 * Spread it on the block: `<section {...rise(2, "grid gap-3")}>`.
 */
export const rise = (
  index: number,
  className?: string,
): { className: string; style: CSSProperties } => ({
  className: cn("cz-in", className),
  style: { "--i": Math.min(index, 6) } as CSSProperties,
});
