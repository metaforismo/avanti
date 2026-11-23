import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A panel of the management pages at rest, the same classes as `Panel` in components/ui: a
 * 1px border on the white sheet, no shadow. A real border, not a ring: a ring is a box-shadow.
 */
export const PANEL = "rounded-md border border-line bg-surface";

/** The title inside a panel: 16/600 in the text face, like every block of the console. */
export function PanelTitle({
  id,
  children,
  className,
  as: Heading = "h2",
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  as?: "h2" | "h3";
}) {
  return (
    <Heading id={id} className={cn("text-base font-semibold text-ink", className)}>
      {children}
    </Heading>
  );
}
