import { AlertTriangle, CheckCircle2, Info, X, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type NoticeTone = "danger" | "ok" | "warn" | "info" | "neutral";

const TONES: Record<NoticeTone, { box: string; icon: string; Icon: LucideIcon }> = {
  danger: { box: "bg-danger-wash text-danger", icon: "text-danger", Icon: AlertTriangle },
  ok: { box: "bg-ok-wash text-ok", icon: "text-ok", Icon: CheckCircle2 },
  warn: { box: "bg-warn-wash text-warn", icon: "text-warn", Icon: AlertTriangle },
  // Information reads in body ink: the stamp colour stays on the icon only.
  info: { box: "bg-stamp-wash text-ink", icon: "text-stamp", Icon: Info },
  // Something is unavailable but nothing is wrong: a quiet aside.
  neutral: { box: "bg-sunk text-ink-2", icon: "text-ink-3", Icon: Info },
};

const SIZES = {
  /** Inline, inside forms and dialogs. */
  sm: "rounded-md px-4 py-3 text-sm",
  /** A step-level message for citizens, at reading size. */
  md: "rounded-lg p-4",
  /** A whole page or section could not load. */
  page: "rounded-lg p-6",
} as const;

/**
 * Every inline message: errors, confirmations, warnings, information. Errors are announced
 * (role=alert) and confirmations politely (role=status) unless the caller says otherwise, for
 * example when the message is already there on page load and announcing it would be noise.
 */
export function Notice({
  tone,
  title,
  children,
  icon,
  action,
  onDismiss,
  dismissLabel = "Chiudi avviso",
  size = "sm",
  role,
  id,
  className,
}: {
  tone: NoticeTone;
  title?: ReactNode;
  children?: ReactNode;
  /** null hides the icon; omitted uses the tone's own. */
  icon?: LucideIcon | null;
  action?: ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
  size?: keyof typeof SIZES;
  role?: "alert" | "status" | "none";
  id?: string;
  className?: string;
}) {
  const style = TONES[tone];
  const Icon = icon === null ? null : (icon ?? style.Icon);
  const live = role ?? (tone === "danger" ? "alert" : tone === "ok" ? "status" : "none");
  return (
    <div
      id={id}
      role={live === "none" ? undefined : live}
      className={cn("flex items-start gap-3", SIZES[size], style.box, className)}
    >
      {Icon && (
        <Icon
          className={cn("shrink-0", size === "sm" ? "mt-0.5 size-4" : "mt-0.5 size-5", style.icon)}
          aria-hidden
        />
      )}
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && (
          <div className={cn(title && "mt-1", size === "page" && "text-sm")}>{children}</div>
        )}
        {action && <div className="mt-3">{action}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel}
          className={cn(
            "grid shrink-0 place-items-center rounded-sm hover:bg-current/10 focus-visible:ring-2 focus-visible:ring-current focus-visible:outline-none",
            // On the citizen's phone the close target keeps the 44px minimum.
            size === "sm" ? "-my-1.5 -me-2 size-9" : "-my-2 -me-2 size-11",
          )}
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}
