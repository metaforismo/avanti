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
        "grid place-items-center rounded-lg border-2 border-dashed border-line px-6 py-14 text-center",
        className,
      )}
    >
      {Icon && <Icon className="size-8 text-ink-3" aria-hidden />}
      <p className={cn("text-lg font-semibold", Icon && "mt-4")}>{title}</p>
      {children && <div className="mt-1 max-w-sm text-ink-2">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
