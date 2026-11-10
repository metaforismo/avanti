"use client";

import { ArrowRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

// The order of the page: the header, the mobile menu and the footer all follow it, so the
// current marker only ever moves forward while scrolling down.
export const SITE_NAV = [
  { id: "come-funziona", label: "Come funziona" },
  { id: "operatori", label: "Per gli operatori" },
  { id: "pratiche", label: "Pratiche" },
  { id: "dati", label: "Dati e sicurezza" },
  { id: "pilota", label: "Pilota 2027" },
] as const;

type SectionId = (typeof SITE_NAV)[number]["id"];

/** Height of the bar (h-16); the mobile menu starts right under it. */
const BAR_HEIGHT = 64;
/** Matches the exit animation of `.menu-sheet` in site.css. */
const MENU_EXIT_MS = 150;

/** The section in the middle band of the screen, for the header's current marker. */
function useActiveSection(enabled: boolean) {
  const [active, setActive] = useState<SectionId | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const nodes = SITE_NAV.map((item) => document.getElementById(item.id)).filter(
      (node): node is HTMLElement => node !== null,
    );
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id as SectionId;
          if (entry.isIntersecting) setActive(id);
          else setActive((current) => (current === id ? null : current));
        }
      },
      // A thin band just above the middle: one section at a time, switching as it is read.
      { rootMargin: "-40% 0px -55% 0px" },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [enabled]);
  return enabled ? active : null;
}

/**
 * Whether the page has moved (the bar gets its blurred ground) and whether the bar is over one
 * of the dark bands (sections marked `data-header="dark"`): the bar then turns dark too, so it
 * never reads as a pale slab laid over the blue.
 */
function useBarTone(pathname: string) {
  const [tone, setTone] = useState({ scrolled: false, dark: false });
  useEffect(() => {
    const bands = [...document.querySelectorAll<HTMLElement>('[data-header="dark"]')];
    let frame = 0;
    const read = () => {
      frame = 0;
      // The bar's middle line decides: a band that only touches its lower edge doesn't count.
      const probe = BAR_HEIGHT / 2;
      const dark = bands.some((band) => {
        const rect = band.getBoundingClientRect();
        return rect.top <= probe && rect.bottom > probe;
      });
      const scrolled = window.scrollY > 8;
      setTone((prev) =>
        prev.scrolled === scrolled && prev.dark === dark ? prev : { scrolled, dark },
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [pathname]);
  return tone;
}

/** While the mobile menu is up the page behind it neither scrolls nor takes focus. */
function usePageLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const root = document.documentElement;
    // Only the root: with the body locked too it becomes a scroll container of its own, and the
    // sticky header would stay behind at the top of the document while the page is scrolled.
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    root.dataset.menuOpen = "";
    const behind = document.querySelectorAll<HTMLElement>("#contenuto, #footer");
    behind.forEach((node) => node.setAttribute("inert", ""));
    return () => {
      root.style.overflow = previous;
      delete root.dataset.menuOpen;
      behind.forEach((node) => node.removeAttribute("inert"));
    };
  }, [locked]);
}

export function SiteHeader() {
  const pathname = usePathname();
  const { scrolled, dark: overDark } = useBarTone(pathname);
  // `open` is the intent; `mounted` outlives it by the exit animation.
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const exitTimer = useRef<number | undefined>(undefined);
  const active = useActiveSection(pathname === "/");
  usePageLock(mounted);

  const openMenu = useCallback(() => {
    window.clearTimeout(exitTimer.current);
    setMounted(true);
    setOpen(true);
  }, []);
  const closeMenu = useCallback((immediately = false) => {
    setOpen(false);
    window.clearTimeout(exitTimer.current);
    if (immediately) setMounted(false);
    else exitTimer.current = window.setTimeout(() => setMounted(false), MENU_EXIT_MS);
  }, []);
  useEffect(() => () => window.clearTimeout(exitTimer.current), []);

  useEffect(() => {
    if (!mounted) return;
    // Escape closes the menu and gives focus back to the button that opened it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      closeMenu();
      toggleRef.current?.focus();
    };
    // From lg the menu doesn't exist: a phone turned sideways or a window widened must not
    // leave the page locked behind a menu nobody can see.
    const desktop = matchMedia("(min-width: 64rem)");
    const onWide = () => desktop.matches && closeMenu(true);
    const onHash = () => closeMenu();
    window.addEventListener("keydown", onKey);
    window.addEventListener("hashchange", onHash);
    desktop.addEventListener("change", onWide);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("hashchange", onHash);
      desktop.removeEventListener("change", onWide);
    };
  }, [mounted, closeMenu]);

  const raised = scrolled || open;
  // The open menu is paper: the bar above it stays light whatever is underneath.
  const dark = overDark && !open;

  return (
    <header className="sticky top-0 z-40">
      {/* The bar's ground is its own layer, so the hero reads as one surface at the top. It
          fades in (opacity) once the page moves; the blur is static. Its two tints cross-fade
          when the bar passes over a dark band. */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 backdrop-blur-[14px] backdrop-saturate-[160%] transition-opacity duration-200",
          raised ? "opacity-100" : "opacity-0",
        )}
      >
        <div
          className={cn(
            "absolute inset-0 bg-paper/82 shadow-[0_1px_0_var(--line)] transition-opacity duration-200",
            dark && "opacity-0",
          )}
        />
        <div
          className={cn(
            "absolute inset-0 bg-contrast/78 shadow-[0_1px_0_rgb(255_255_255/0.08)] transition-opacity duration-200",
            !dark && "opacity-0",
          )}
        />
      </div>
      {/* Three columns from lg: the section links sit on the page's centre line, whatever the
          widths of the logo and the actions. */}
      <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6 lg:grid lg:grid-cols-[1fr_auto_1fr]">
        <Link
          href="/"
          aria-label="Avanti, pagina iniziale"
          className={cn(
            "w-fit origin-left rounded-sm transition-transform duration-300 ease-(--ease-out) rtl:origin-right",
            dark && "focus-visible:outline-marker",
            scrolled && "scale-[0.94]",
          )}
        >
          <Logo inverted={dark} />
        </Link>
        <nav aria-label="Sezioni" className="hidden lg:block">
          <ul className="flex items-center gap-0.5">
            {SITE_NAV.map((item) => {
              const current = active === item.id;
              return (
                <li key={item.id}>
                  <a
                    href={`/#${item.id}`}
                    aria-current={current ? "location" : undefined}
                    className={cn(
                      "relative inline-flex h-11 items-center rounded-sm px-2.5 text-body-sm transition-colors duration-200",
                      "focus-visible:outline-2 focus-visible:outline-offset-2",
                      dark
                        ? cn(
                            "focus-visible:outline-marker",
                            current
                              ? "text-on-contrast"
                              : "text-on-contrast/70 hover:text-on-contrast",
                          )
                        : cn(
                            "focus-visible:outline-stamp",
                            current ? "text-ink" : "text-ink-2 hover:text-ink",
                          ),
                    )}
                  >
                    {item.label}
                    <span
                      aria-hidden
                      className={cn(
                        "absolute inset-x-2.5 bottom-2 h-0.5 rounded-full transition-[transform,opacity,background-color] duration-300 ease-(--ease-out)",
                        dark ? "bg-marker" : "bg-stamp",
                        current ? "scale-x-100 opacity-100" : "scale-x-50 opacity-0",
                      )}
                    />
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="flex items-center gap-2 lg:justify-self-end">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className={cn(
              "hidden h-11 px-2.5 text-[0.9375rem] font-medium duration-200 sm:inline-flex",
              dark &&
                "text-on-contrast/70 not-disabled:hover:bg-on-contrast/10 not-disabled:hover:text-on-contrast focus-visible:outline-marker",
            )}
          >
            <Link href="/console/accedi">Accedi</Link>
          </Button>
          <Button
            asChild
            variant={dark ? "marker" : "primary"}
            size="sm"
            className={cn(
              "group hidden h-11 px-4 duration-200 sm:inline-flex",
              dark && "focus-visible:outline-marker",
            )}
          >
            <Link href="/#pilota">
              Parliamo del pilota
              <ArrowRight
                className="rtl-flip size-4 transition-transform duration-200 ease-(--ease-out) group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </Button>
          <Button
            ref={toggleRef}
            variant="ghost"
            size="icon-lg"
            className={cn(
              "lg:hidden",
              dark &&
                "text-on-contrast/80 not-disabled:hover:bg-on-contrast/10 not-disabled:hover:text-on-contrast focus-visible:outline-marker",
            )}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Chiudi menu" : "Apri menu"}
            onClick={() => (open ? closeMenu() : openMenu())}
          >
            <span className="relative grid size-5 place-items-center" aria-hidden>
              <Menu
                className={cn(
                  "absolute size-5 transition-[opacity,transform] duration-200 ease-(--ease-out)",
                  open && "scale-50 rotate-90 opacity-0",
                )}
              />
              <X
                className={cn(
                  "absolute size-5 transition-[opacity,transform] duration-200 ease-(--ease-out)",
                  !open && "scale-50 -rotate-90 opacity-0",
                )}
              />
            </span>
          </Button>
        </div>
      </div>

      {mounted && (
        // A sheet under the bar, not a drop-down: the page behind is out of reach while it is
        // up, as in an app. The links rise one after the other (site.css, `.menu-item`).
        <div
          id="mobile-nav"
          data-state={open ? "open" : "closed"}
          className="menu-sheet fixed inset-x-0 top-16 bottom-0 flex flex-col overflow-y-auto overscroll-contain bg-paper lg:hidden"
        >
          <nav aria-label="Sezioni" className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <ul className="border-t border-line">
              {SITE_NAV.map((item, i) => (
                <li
                  key={item.id}
                  className="menu-item border-b border-line"
                  style={{ "--i": i } as CSSProperties}
                >
                  <a
                    href={`/#${item.id}`}
                    onClick={() => closeMenu()}
                    aria-current={active === item.id ? "location" : undefined}
                    className="flex min-h-14 items-center justify-between gap-4 rounded-sm font-display text-[1.75rem] leading-[1.15] font-semibold tracking-[-0.01em] text-ink [font-stretch:97%] transition-colors duration-150 active:text-stamp aria-[current]:text-stamp"
                  >
                    {item.label}
                    <ArrowRight className="rtl-flip size-5 shrink-0 text-ink-3" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div
            className="menu-item mx-auto mt-auto w-full max-w-6xl px-4 pt-8 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:hidden"
            style={{ "--i": SITE_NAV.length } as CSSProperties}
          >
            <Button asChild size="lg" className="group min-h-13 w-full">
              <Link href="/#pilota" onClick={() => closeMenu()}>
                Parliamo del pilota
                <ArrowRight
                  className="rtl-flip size-4.5 transition-transform duration-200 ease-(--ease-out) group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </Button>
            <Link
              href="/console/accedi"
              className="mt-1 flex min-h-11 items-center justify-center rounded-sm text-body-sm font-medium text-ink-2 transition-colors hover:text-ink"
            >
              Accedi
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
