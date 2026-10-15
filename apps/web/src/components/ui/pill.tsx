import type { ReactNode } from "react";
import { TONE_CLASSES, type Tone } from "@/lib/console/labels";
import { cn } from "@/lib/cn";

/** A short status label. Icons inside take the pill's own size; meaning never rests on colour. */
export function Pill({
  tone,
  children,
  size = "xs",
  className,
}: {
  tone: Tone;
  children: ReactNode;
  size?: "xs" | "sm";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full font-semibold whitespace-nowrap",
        size === "xs"
          ? "px-2.5 py-0.5 text-xs [&_svg]:size-3"
          : "px-2.5 py-1 text-sm [&_svg]:size-3.5",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
