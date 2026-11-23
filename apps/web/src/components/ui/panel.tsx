import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * A block of work on the console's white sheet: a 1px edge and nothing else. Never a shadow or
 * a ring (a ring is a box-shadow, and read as a floating card); never a panel inside a panel:
 * inside, group with rules or one tone step (`bg-sunk/60`).
 */
export const PANEL = "rounded-md border border-line bg-surface";

export function Panel({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn(PANEL, className)} {...props} />;
}
