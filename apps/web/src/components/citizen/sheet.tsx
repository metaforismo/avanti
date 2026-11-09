"use client";

import { X } from "lucide-react";
import { Dialog as Primitive } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import "./citizen.css";
import { useSheetDrag } from "./sheet-drag";

/**
 * The citizen's dialog: on a phone a sheet that comes up from the bottom and follows the finger
 * down to be dismissed (from the handle or the title, never from the scrolling content); from
 * `sm` a card in the centre. Same Radix behaviour as components/ui/dialog: focus trap, Escape,
 * return of focus.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  closeLabel,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  closeLabel: string;
  children: ReactNode;
  className?: string;
}) {
  const drag = useSheetDrag(() => {
    onOpenChange(false);
  });

  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Portal>
        <Primitive.Overlay className="fixed inset-0 z-50 animate-fade-in bg-scrim data-[state=closed]:animate-fade-out" />
        <Primitive.Content
          className={cn(
            "cz-sheet-in fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-[1.75rem] bg-surface shadow-float outline-none",
            "sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:animate-pop sm:rounded-xl sm:data-[state=closed]:animate-sink",
            className,
          )}
        >
          {/* The grab zone: handle and title. Wider than it looks, because a thumb is. */}
          <div {...drag} className="cz-grab shrink-0 px-6 pt-2.5 sm:cursor-auto sm:pt-6">
            <div
              aria-hidden
              className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line-strong sm:hidden"
            />
            <div className="flex items-start justify-between gap-4 pb-4">
              <div className="min-w-0">
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
                className="-me-2 grid size-11 shrink-0 place-items-center rounded-full bg-sunk text-ink-2 transition-[background-color,transform] duration-150 ease-(--ease-out) hover:bg-line active:scale-[0.92]"
                aria-label={closeLabel}
              >
                <X className="size-5" aria-hidden />
              </Primitive.Close>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            {children}
          </div>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}

export { useSheetDrag };
