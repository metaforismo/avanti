"use client";

import { ArrowRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const NAV = [
  { id: "come-funziona", label: "Come funziona" },
  { id: "operatori", label: "Per gli operatori" },
  { id: "dati", label: "Dati e sicurezza" },
  { id: "pratiche", label: "Pratiche" },
  { id: "pilota", label: "Pilota 2027" },
] as const;

type SectionId = (typeof NAV)[number]["id"];

/** The section in the middle band of the screen, for the header's current marker. */
function useActiveSection(enabled: boolean) {
  const [active, setActive] = useState<SectionId | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const nodes = NAV.map((item) => document.getElementById(item.id)).filter(
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

export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const active = useActiveSection(pathname === "/");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    // Escape closes the menu and gives focus back to the button that opened it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const raised = scrolled || open;

  return (
    <header className="sticky top-0 z-40">
      {/* The bar's background is its own layer: it fades in (opacity only) once the page
          moves, so the hero reads as one surface at the top. */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 bg-paper/88 shadow-[0_1px_0_var(--line)] backdrop-blur-md backdrop-saturate-150 transition-opacity duration-200",
          raised ? "opacity-100" : "opacity-0",
        )}
      />
      {/* Three columns from lg: the section links sit on the page's centre line, whatever the
          widths of the logo and the actions. */}
      <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6 lg:grid lg:grid-cols-[1fr_auto_1fr]">
        <Link
          href="/"
          aria-label="Avanti, pagina iniziale"
          className={cn(
            "w-fit origin-left rounded-sm transition-transform duration-300 ease-(--ease-out) rtl:origin-right",
            scrolled && "scale-[0.94]",
          )}
        >
          <Logo />
        </Link>
        <nav aria-label="Sezioni" className="hidden lg:block">
          <ul className="flex items-center gap-0.5">
            {NAV.map((item) => {
              const current = active === item.id;
              return (
                <li key={item.id}>
                  <a
                    href={`/#${item.id}`}
                    aria-current={current ? "location" : undefined}
                    className={cn(
                      "relative inline-flex h-11 items-center rounded-sm px-3 text-body-sm transition-colors duration-150",
                      current ? "text-ink" : "text-ink-2 hover:text-ink",
                    )}
                  >
                    {item.label}
                    <span
                      aria-hidden
                      className={cn(
                        "absolute inset-x-3 bottom-2 h-0.5 rounded-full bg-stamp transition-[transform,opacity] duration-300 ease-(--ease-out)",
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
          <Button asChild variant="ghost" size="sm" className="hidden h-11 sm:inline-flex">
            <Link href="/console/accedi">Accedi</Link>
          </Button>
          <Button asChild size="sm" className="group hidden h-11 px-4 sm:inline-flex">
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
            className="lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Chiudi menu" : "Apri menu"}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>
      {open && (
        <nav
          id="mobile-nav"
          aria-label="Sezioni"
          className="relative origin-top animate-rise border-t border-line lg:hidden"
        >
          <ul className="mx-auto grid max-w-6xl gap-0.5 px-4 py-3 sm:px-6">
            {NAV.map((item) => (
              <li key={item.id}>
                <a
                  href={`/#${item.id}`}
                  onClick={() => setOpen(false)}
                  aria-current={active === item.id ? "location" : undefined}
                  className="flex min-h-12 items-center justify-between rounded-md px-3 text-base text-ink transition-colors active:bg-sunk aria-[current]:bg-stamp-wash aria-[current]:font-semibold aria-[current]:text-stamp"
                >
                  {item.label}
                </a>
              </li>
            ))}
            <li className="mt-2 flex gap-2 border-t border-line pt-3 sm:hidden">
              <Button asChild variant="secondary" className="h-12 flex-1">
                <Link href="/console/accedi">Accedi</Link>
              </Button>
              <Button asChild className="h-12 flex-1">
                <Link href="/#pilota" onClick={() => setOpen(false)}>
                  Parliamo del pilota
                </Link>
              </Button>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
