"use client";

import { useEffect, useMemo, useRef, useState, type RefCallback } from "react";
import { cn } from "@/lib/cn";

export type SettingsSectionLink = { id: string; label: string };

/** Distance from the top of the window at which a section counts as the one being read. */
const READING_LINE = 140;

function useActiveSection(ids: readonly string[]) {
  const [active, setActive] = useState(ids[0] ?? "");
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const atEnd =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let current = ids[0] ?? "";
      for (const id of ids) {
        const top = document.getElementById(id)?.getBoundingClientRect().top;
        if (top !== undefined && top <= READING_LINE) current = id;
      }
      // A short last section never reaches the reading line: at the bottom it is the one read.
      setActive(atEnd ? (ids[ids.length - 1] ?? current) : current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // Sections load their lists after the page: their height moves the others.
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ids]);
  return [active, setActive] as const;
}

/**
 * The strip under the title of the settings: the sections as segments (the current one lit as
 * the reader scrolls) and, in the same place, the bar of unsaved changes. The bar lives here
 * and not at the bottom of the window because a fixed bar sits on top of whatever is scrolled
 * under it; a strip that stays at the top only ever hides what has already gone past.
 * While the bar is shown it replaces the segments, so nothing changes height under the pointer.
 */
export function SettingsNav({
  sections,
  barOpen,
  barRef,
}: {
  sections: readonly SettingsSectionLink[];
  barOpen: boolean;
  /** Where the form puts its save bar (a portal target). */
  barRef: RefCallback<HTMLDivElement>;
}) {
  const ids = useMemo(() => sections.map((section) => section.id), [sections]);
  const [active, setActive] = useActiveSection(ids);
  const rail = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  // On a narrow screen the rail scrolls: keep the current segment in view, without touching the page.
  useEffect(() => {
    const el = rail.current?.querySelector<HTMLElement>("[aria-current]");
    const box = rail.current;
    if (!el || !box || box.scrollWidth <= box.clientWidth) return;
    box.scrollTo({
      left: el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2,
      behavior: "smooth",
    });
  }, [active]);

  // A hairline appears once content really runs under the strip.
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const update = () =>
      setStuck(
        strip.getBoundingClientRect().top <= Number.parseFloat(getComputedStyle(strip).top) + 0.5 &&
          window.scrollY > 0,
      );
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div
      ref={stripRef}
      id="settings-strip"
      className={cn(
        "sticky top-14 z-20 grid h-12 items-center border-b bg-paper transition-[border-color] duration-150 lg:top-0",
        stuck ? "border-line" : "border-transparent",
      )}
    >
      <div
        ref={rail}
        className={cn(
          "col-start-1 row-start-1 min-w-0 [scrollbar-width:none] overflow-x-auto [&::-webkit-scrollbar]:hidden",
          "transition-opacity duration-150 max-sm:[mask-image:linear-gradient(to_right,#000_calc(100%-24px),transparent)]",
          barOpen && "pointer-events-none opacity-0",
        )}
        inert={barOpen}
      >
        <nav
          aria-label="Sezioni"
          className="flex w-fit rounded-sm bg-sunk p-0.5 max-sm:me-6"
          onClick={(event) => {
            const link = (event.target as HTMLElement).closest("a");
            if (link) setActive(link.hash.slice(1));
          }}
        >
          {sections.map((section) => {
            const current = section.id === active;
            return (
              <a
                key={section.id}
                href={`#${section.id}`}
                aria-current={current ? "location" : undefined}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center rounded-xs px-3 text-sm font-medium whitespace-nowrap transition-colors duration-100",
                  "focus-visible:ring-2 focus-visible:ring-stamp focus-visible:outline-none",
                  current
                    ? "bg-surface text-ink shadow-xs ring-1 ring-line"
                    : "text-ink-2 hover:text-ink",
                )}
              >
                {section.label}
              </a>
            );
          })}
        </nav>
      </div>
      <div
        ref={barRef}
        role="status"
        className={cn("col-start-1 row-start-1 min-w-0", !barOpen && "pointer-events-none")}
      />
    </div>
  );
}
