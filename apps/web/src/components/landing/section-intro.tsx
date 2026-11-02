import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Label, title and lead that open every site section. The label tells someone scrolling on a
 * phone what the section is about before they read the title. Revealed on scroll (site.css).
 */
export function SectionIntro({
  id,
  eyebrow,
  title,
  lead,
  inverted = false,
  className,
}: {
  id: string;
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  inverted?: boolean;
  className?: string;
}) {
  return (
    <div data-reveal="stagger" className={cn("max-w-2xl", className)}>
      <p
        className={cn(
          "mb-4 flex items-center gap-2.5 type-eyebrow",
          inverted ? "text-marker" : "text-stamp",
        )}
      >
        <span aria-hidden className="h-px w-6 bg-current opacity-60" />
        {eyebrow}
      </p>
      <h2 id={id} className="font-display type-section">
        {title}
      </h2>
      {lead && (
        <p className={cn("mt-5 type-lead", inverted ? "text-on-contrast/80" : "text-ink-2")}>
          {lead}
        </p>
      )}
    </div>
  );
}
