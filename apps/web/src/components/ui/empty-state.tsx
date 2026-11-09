import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Nothing to show yet: what this place is for, and the one action that fills it. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid animate-fade-in place-items-center rounded-lg bg-surface/60 px-6 py-16 text-center ring-1 ring-line",
        className,
      )}
    >
      {/* The icon on a small raised tile, like an object left on the desk. */}
      {Icon && (
        <span className="grid size-12 place-items-center rounded-md bg-surface text-ink-3 shadow-raised ring-1 ring-line">
          <Icon className="size-5.5" aria-hidden />
        </span>
      )}
      <p className={cn("text-base font-semibold", Icon && "mt-5")}>{title}</p>
      {children && <div className="mt-1 max-w-sm text-body-sm text-ink-3">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
