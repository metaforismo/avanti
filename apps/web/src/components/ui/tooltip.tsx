"use client";

import { Tooltip as Primitive } from "radix-ui";
import type { ReactElement, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A short label for a control, with its key: «Chiedi integrazione  I». It only adds to what the
 * control already says (its name stays the accessible name; the keys belong in
 * `aria-keyshortcuts`). Mouse and keyboard focus only: a touch never opens it.
 */
export function Tooltip({
  label,
  keys,
  side = "bottom",
  children,
}: {
  label: ReactNode;
  /** Shown as keycaps after the label, e.g. ["⌘", "J"]. */
  keys?: string[];
  side?: "top" | "bottom" | "left" | "right";
  children: ReactElement;
}) {
  return (
    <Primitive.Provider delayDuration={500} skipDelayDuration={300}>
      <Primitive.Root>
        <Primitive.Trigger asChild>{children}</Primitive.Trigger>
        <Primitive.Portal>
          <Primitive.Content
            side={side}
            sideOffset={6}
            collisionPadding={8}
            className={cn(
              "z-50 flex max-w-64 origin-(--radix-tooltip-content-transform-origin) items-center gap-2 rounded-sm bg-contrast px-2 py-1 text-xs font-medium text-on-contrast shadow-float select-none",
              "animate-fade-in data-[state=closed]:animate-fade-out",
            )}
          >
            {label}
            {keys && keys.length > 0 && (
              <span aria-hidden className="flex gap-0.5">
                {keys.map((key) => (
                  <kbd
                    key={key}
                    className="grid h-4.5 min-w-4.5 place-items-center rounded-xs bg-on-contrast/15 px-1 font-mono text-[0.6875rem] leading-none"
                  >
                    {key}
                  </kbd>
                ))}
              </span>
            )}
          </Primitive.Content>
        </Primitive.Portal>
      </Primitive.Root>
    </Primitive.Provider>
  );
}
