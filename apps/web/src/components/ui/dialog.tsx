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
  closeLabel = "Chiudi",
  dismissible = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  /** Where focus goes on close when the opener disappears, e.g. an item of a closed menu. */
  returnFocusTo?: RefObject<HTMLElement | null>;
  /** The citizen app passes its own language; the console is Italian. */
  closeLabel?: string;
  /** False for content shown once (a temporary password): only its own button closes it. */
  dismissible?: boolean;
}) {
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Portal>
        <Primitive.Overlay className="fixed inset-0 z-50 animate-fade-in bg-scrim data-[state=closed]:animate-fade-out" />
        <Primitive.Content
          onEscapeKeyDown={(event) => !dismissible && event.preventDefault()}
          onInteractOutside={(event) => !dismissible && event.preventDefault()}
          onCloseAutoFocus={(event) => {
            if (!returnFocusTo?.current) return;
            event.preventDefault();
            returnFocusTo.current.focus();
          }}
          className={cn(
            // On a phone a sheet that slides from the bottom edge; from sm up a centred card.
            "fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] animate-sheet-in overflow-y-auto overscroll-contain rounded-t-xl bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-float outline-none data-[state=closed]:animate-sheet-out",
            "sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:animate-pop sm:rounded-xl sm:data-[state=closed]:animate-sink",
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
            {/* 44px target, the same minimum as every other control on the citizen's phone;
                the negative margin keeps the icon where it was. */}
            {dismissible && (
              <Primitive.Close
                className="-m-2 shrink-0 rounded-sm p-3 text-ink-3 transition-[background-color,color,transform] duration-150 ease-(--ease-out) hover:bg-sunk hover:text-ink active:scale-[0.94]"
                aria-label={closeLabel}
              >
                <X className="size-5" aria-hidden />
              </Primitive.Close>
            )}
          </div>
          {children}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
