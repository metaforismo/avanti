import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export { PANEL } from "@/components/ui/panel";

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
