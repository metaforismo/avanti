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
        "grid animate-fade-in place-items-center rounded-md border border-line px-6 py-12 text-center",
        className,
      )}
    >
      {/* A plain grey icon: the frame and the sentence say it is empty, nothing floats. */}
      {Icon && (
        <span className="grid size-10 place-items-center rounded-full bg-sunk text-ink-3">
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      <p className={cn("text-base font-semibold", Icon && "mt-4")}>{title}</p>
      {children && <div className="mt-1 max-w-sm text-body-sm text-ink-3">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
