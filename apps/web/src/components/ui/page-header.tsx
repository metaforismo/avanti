import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Width and padding of every console page. Pages start at the same left edge whatever their
 * width, so the title doesn't jump when switching pages; only short notices are centered.
 *
 * Two widths, so the right edge doesn't jump either: `wide` (1072 px of content at 1440) for
 * tables, metrics, reports and status; `form` (720 px) for forms. The dossier is a workspace
 * with its own side column (`7xl`). The other sizes remain for pages not yet moved to the two.
 */
export function PageContainer({
  width = "5xl",
  centered = false,
  className,
  children,
}: {
  width?: "wide" | "form" | "3xl" | "4xl" | "5xl" | "6xl" | "7xl";
  centered?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const max = {
    wide: "max-w-6xl",
    // 720 px of content inside the 40 px side padding.
    form: "max-w-[50rem]",
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
    "6xl": "max-w-6xl",
    "7xl": "max-w-7xl",
  }[width];
  return (
    <div
      className={cn("px-4 py-6 sm:px-6 lg:px-10 lg:py-8", centered && "mx-auto", max, className)}
    >
      {children}
    </div>
  );
}

/** The h1 of a console page, its one-line purpose and the page's own actions. */
export function PageHeader({
  title,
  lead,
  actions,
  icon,
  className,
}: {
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 font-display text-[1.75rem] leading-tight font-[650] tracking-[-0.012em]">
          {icon}
          {title}
        </h1>
        {lead && <p className="mt-1 max-w-2xl text-body-sm text-ink-3">{lead}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A section inside a page: h2 (or h3), an optional lead and actions aligned to the title. */
export function SectionHeader({
  id,
  title,
  lead,
  actions,
  icon,
  as: Heading = "h2",
  className,
}: {
  id?: string;
  title: ReactNode;
  icon?: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  as?: "h2" | "h3";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <Heading
          id={id}
          className={cn(
            "flex items-center gap-2 font-display font-semibold tracking-[-0.01em]",
            Heading === "h2" ? "text-xl" : "text-lg",
          )}
        >
          {icon}
          {title}
        </Heading>
        {lead && <p className="mt-1 max-w-2xl text-body-sm text-ink-3">{lead}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
