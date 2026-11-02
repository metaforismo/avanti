"use client";

import { ArrowRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * On a phone the hero's call to action scrolls away after one screen. This bar brings it back
 * from the bottom edge, and leaves again where it would be in the way: over the hero, over the
 * pilot form it points to, and over the footer.
 */
export function MobileCta() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (pathname !== "/") return;
    const hero = document.getElementById("hero");
    const blockers = ["pilota", "chiusura", "footer"]
      .map((id) => document.getElementById(id))
      .filter((node): node is HTMLElement => node !== null);
    if (!hero) return;

    const visible = new Map<Element, boolean>();
    const update = () => {
      const heroGone = visible.get(hero) === false;
      const blocked = blockers.some((node) => visible.get(node));
      setShow(heroGone && !blocked);
    };
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) visible.set(entry.target, entry.isIntersecting);
      update();
    });
    [hero, ...blockers].forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [pathname]);

  if (pathname !== "/") return null;

  return (
    <div
      // Hidden from assistive tech while off screen: the same link is in the header.
      aria-hidden={!show}
      inert={!show}
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] lg:hidden",
        "transition-[transform,opacity] duration-300 ease-(--ease-out)",
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0",
      )}
    >
      <a
        href="#pilota"
        className="flex min-h-13 items-center justify-between gap-3 rounded-xl bg-stamp ps-5 pe-2 text-on-stamp shadow-float ring-1 ring-white/15 transition-transform duration-150 ease-(--ease-out) focus-visible:outline-marker active:scale-[0.98]"
      >
        <span className="min-w-0 leading-tight">
          <span className="block text-body-sm font-semibold">Pilota ISEE gennaio–marzo</span>
          <span className="block text-xs text-on-stamp/80">Una chiamata di mezz&apos;ora</span>
        </span>
        <span className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-marker px-3.5 text-sm font-semibold text-ink">
          Parliamone
          <ArrowRight className="rtl-flip size-4" aria-hidden />
        </span>
      </a>
    </div>
  );
}
