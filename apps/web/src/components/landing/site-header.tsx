"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "#come-funziona", label: "Come funziona" },
  { href: "#operatori", label: "Per gli operatori" },
  { href: "#lingue", label: "Lingue" },
  { href: "#pratiche", label: "Pratiche" },
  { href: "#pilota", label: "Pilota 2027" },
] as const;

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-[background-color,box-shadow] duration-200",
        scrolled || open
          ? "bg-paper/85 shadow-[0_1px_0_var(--line)] backdrop-blur-md"
          : "bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <Link href="/" aria-label="Avanti, pagina iniziale" className="rounded-sm">
          <Logo />
        </Link>
        <nav aria-label="Sezioni" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="rounded-sm px-3 py-2 text-[0.9375rem] text-ink-2 transition-colors hover:text-ink"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/console/accedi">Accedi</Link>
          </Button>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <a href="#pilota">Diventa CAF pilota</a>
          </Button>
          <Button
            variant="ghost"
            size="icon"
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
          className="animate-fade-in border-t border-line lg:hidden"
        >
          <ul className="mx-auto grid max-w-6xl gap-1 px-4 py-3 sm:px-6">
            {NAV.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-sm px-2 py-3 text-base text-ink"
                >
                  {item.label}
                </a>
              </li>
            ))}
            <li className="mt-2 flex gap-2 border-t border-line pt-3 sm:hidden">
              <Button asChild variant="secondary" className="flex-1">
                <Link href="/console/accedi">Accedi</Link>
              </Button>
              <Button asChild className="flex-1">
                <a href="#pilota" onClick={() => setOpen(false)}>
                  Diventa CAF pilota
                </a>
              </Button>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
