import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

const variants = {
  primary:
    "bg-stamp text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.14)] hover:bg-stamp-hover active:bg-stamp-hover",
  secondary: "bg-surface text-ink ring-1 ring-line-strong ring-inset hover:bg-sunk",
  ghost: "text-ink-2 hover:bg-sunk hover:text-ink",
  danger: "bg-surface text-danger ring-1 ring-danger/30 ring-inset hover:bg-danger-wash",
  marker: "bg-marker text-ink hover:bg-[#ffdc2e]",
} as const;

const sizes = {
  sm: "h-8 gap-1.5 rounded-sm px-3 text-sm",
  md: "h-10 gap-2 rounded-sm px-4 text-[0.9375rem]",
  lg: "h-12 gap-2.5 rounded-md px-5 text-base",
  icon: "size-10 rounded-sm",
  "icon-sm": "size-8 rounded-sm",
} as const;

export type ButtonProps = ComponentProps<"button"> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
  asChild?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  asChild = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap select-none",
        "transition-[background-color,color,box-shadow,transform] duration-150 ease-(--ease-out)",
        "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && (
            <span className="absolute inset-0 grid place-items-center">
              <Spinner className="size-4" />
            </span>
          )}
          <span className={cn("contents", loading && "invisible")}>{children}</span>
        </>
      )}
    </Comp>
  );
}
