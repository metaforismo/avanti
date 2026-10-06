"use client";

import { BarChart3, CircleHelp, Inbox, LogOut, Menu, Plus, QrCode, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { Route } from "next";
import type { Operator } from "@avanti/contracts";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch } from "@/lib/api";
import { OperatorProvider } from "@/lib/console/operator-context";
import { useResource } from "@/lib/console/use-resource";
import { cn } from "@/lib/cn";
import { NewCaseDialog } from "./new-case-dialog";

const NAV: { href: Route; label: string; icon: typeof Inbox; match: (path: string) => boolean }[] =
  [
    {
      href: "/console",
      label: "Pratiche",
      icon: Inbox,
      match: (p) => p === "/console" || p.startsWith("/console/pratiche"),
    },
    {
      href: "/console/metriche",
      label: "Metriche",
      icon: BarChart3,
      match: (p) => p.startsWith("/console/metriche"),
    },
    {
      href: "/console/sportelli",
      label: "Sportelli e QR",
      icon: QrCode,
      match: (p) => p.startsWith("/console/sportelli"),
    },
    {
      href: "/console/aiuto",
      label: "Aiuto",
      icon: CircleHelp,
      match: (p) => p.startsWith("/console/aiuto"),
    },
  ];

export function ConsoleShell({ children }: { children: ReactNode }) {
  const me = useResource<Operator>("/api/auth/me");
  const [menuOpen, setMenuOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const pathname = usePathname();

  // Scope for the console's dark theme (see globals.css): citizen pages stay light.
  useEffect(() => {
    document.documentElement.classList.add("console");
    return () => document.documentElement.classList.remove("console");
  }, []);

  // Close the mobile menu whenever navigation happens.
  useEffect(() => {
    const timer = window.setTimeout(() => setMenuOpen(false), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      document.getElementById("console-menu-toggle")?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  if (me.status === "loading" || (me.status === "error" && !me.data)) {
    return (
      <div className="grid min-h-dvh place-items-center text-ink-3">
        {me.status === "loading" ? (
          <Spinner label="Caricamento della console" className="size-6" />
        ) : (
          <div className="text-center">
            <p className="text-lg font-semibold text-ink">Console non raggiungibile</p>
            <p className="mt-1">{me.error?.message}</p>
            <Button className="mt-5" onClick={() => void me.reload()}>
              Riprova
            </Button>
          </div>
        )}
      </div>
    );
  }

  const operator = me.data!;

  return (
    <OperatorProvider value={operator}>
      <a
        href="#contenuto"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-sm focus:bg-contrast focus:px-4 focus:py-2 focus:text-on-contrast"
      >
        Vai al contenuto
      </a>
      <div className="min-h-dvh bg-paper lg:grid lg:grid-cols-[15rem_1fr]">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface px-4 lg:hidden">
          <Link href="/console" className="rounded-sm">
            <Logo />
          </Link>
          <Button
            id="console-menu-toggle"
            variant="ghost"
            size="icon"
            aria-label={menuOpen ? "Chiudi menu" : "Apri menu"}
            aria-expanded={menuOpen}
            aria-controls="console-menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </header>

        <aside
          id="console-menu"
          className={cn(
            "z-20 flex-col overscroll-contain border-e border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh",
            menuOpen
              ? "fixed inset-x-0 top-14 bottom-0 flex animate-fade-in overflow-y-auto"
              : "hidden",
          )}
        >
          <div className="hidden h-16 items-center px-5 lg:flex">
            <Link href="/console" className="rounded-sm">
              <Logo />
            </Link>
          </div>
          <div className="px-3 pt-3 lg:pt-1">
            <Button className="w-full justify-start" onClick={() => setCreating(true)}>
              <Plus className="size-4" aria-hidden />
              Nuova pratica
            </Button>
          </div>
          <nav aria-label="Console" className="mt-4 flex-1 px-3">
            <ul className="grid gap-0.5">
              {NAV.map(({ href, label, icon: Icon, match }) => {
                const active = match(pathname);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-10 items-center gap-3 rounded-sm px-3 text-[0.9375rem] transition-colors",
                        active
                          ? "bg-stamp-wash font-semibold text-stamp"
                          : "text-ink-2 hover:bg-sunk hover:text-ink",
                      )}
                    >
                      <Icon className="size-4.5" aria-hidden />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <OperatorCard operator={operator} />
        </aside>

        <main id="contenuto" tabIndex={-1} className="min-w-0 outline-none">
          {children}
        </main>
      </div>
      <NewCaseDialog open={creating} onOpenChange={setCreating} />
    </OperatorProvider>
  );
}

function OperatorCard({ operator }: { operator: Operator }) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  async function logout() {
    setLeaving(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      // Leave even if the request failed: the session expires server-side anyway.
      router.replace("/console/accedi");
    }
  }

  return (
    <div className="flex items-center gap-3 border-t border-line p-4">
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-full bg-contrast font-display text-sm font-semibold text-on-contrast"
      >
        {operator.name
          .split(/\s+/)
          .map((part) => part[0])
          .slice(0, 2)
          .join("")
          .toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{operator.name}</p>
        <p className="truncate text-xs text-ink-3">{operator.organization.name}</p>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Esci"
        onClick={() => void logout()}
        loading={leaving}
      >
        <LogOut className="rtl-flip size-4" />
      </Button>
    </div>
  );
}
