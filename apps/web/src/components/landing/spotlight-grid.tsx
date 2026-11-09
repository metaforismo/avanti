"use client";

import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A grid of cells separated by 1px gaps, with a light under the cells that follows the pointer:
 * only the gaps near the cursor light up. Transform only, one frame per pointer move at most;
 * touch screens and reduced motion never see it (site.css).
 */
export function SpotlightGrid({
  as: Tag = "div",
  className,
  children,
}: {
  as?: "div" | "dl" | "ul";
  className?: string;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const spotRef = useRef<HTMLSpanElement>(null);
  const frame = useRef(0);

  const move = (event: React.PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    const root = rootRef.current;
    const spot = spotRef.current;
    if (!root || !spot) return;
    const { clientX, clientY } = event;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const rect = root.getBoundingClientRect();
      spot.style.transform = `translate3d(${clientX - rect.left}px, ${clientY - rect.top}px, 0)`;
      root.setAttribute("data-spot-on", "");
    });
  };
  const leave = () => {
    cancelAnimationFrame(frame.current);
    rootRef.current?.removeAttribute("data-spot-on");
  };

  return (
    <Tag
      ref={rootRef as never}
      onPointerMove={move}
      onPointerLeave={leave}
      className={cn("relative isolate", className)}
    >
      <span ref={spotRef} aria-hidden className="spotlight -z-10" />
      {children}
    </Tag>
  );
}
