"use client";

import { X } from "lucide-react";
import { Dialog as Primitive } from "radix-ui";
import type { ReactNode, RefObject } from "react";
import { cn } from "@/lib/cn";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  returnFocusTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  /** Where focus goes on close when the opener disappears, e.g. an item of a closed menu. */
  returnFocusTo?: RefObject<HTMLElement | null>;
}) {
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Portal>
        <Primitive.Overlay className="fixed inset-0 z-50 animate-fade-in bg-scrim backdrop-blur-[2px]" />
        <Primitive.Content
          onCloseAutoFocus={(event) => {
            if (!returnFocusTo?.current) return;
            event.preventDefault();
            returnFocusTo.current.focus();
          }}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] animate-rise overflow-y-auto overscroll-contain rounded-t-xl bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-float outline-none",
            "sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl",
            className,
          )}
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <Primitive.Title className="font-display text-2xl font-semibold tracking-[-0.015em]">
                {title}
              </Primitive.Title>
              {description ? (
                <Primitive.Description className="mt-1 text-ink-2">
                  {description}
                </Primitive.Description>
              ) : (
                <Primitive.Description className="sr-only">{title}</Primitive.Description>
              )}
            </div>
            <Primitive.Close
              className="-m-1 rounded-sm p-2 text-ink-3 hover:bg-sunk hover:text-ink"
              aria-label="Chiudi"
            >
              <X className="size-5" aria-hidden />
            </Primitive.Close>
          </div>
          {children}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
