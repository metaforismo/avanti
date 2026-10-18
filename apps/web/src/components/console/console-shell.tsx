"use client";

import {
  ClipboardCheck,
  Activity,
  AlertTriangle,
  BarChart3,
  CircleHelp,
  Inbox,
  LogOut,
  Menu,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  ScrollText,
  Settings,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { Route } from "next";
import type { LoginResponse, Operator } from "@avanti/contracts";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch, onAuthFailure } from "@/lib/api";
import { OperatorProvider } from "@/lib/console/operator-context";
import { announceSignOut, onSignOutElsewhere } from "@/lib/console/session-broadcast";
import { clearResourceCache, useResource } from "@/lib/console/use-resource";
import { cn } from "@/lib/cn";
import { PasswordForm } from "./admin/password-form";
import { MfaSetupFlow } from "./mfa/setup-flow";
import { MfaVerifyForm } from "./mfa/verify-form";
import { NewCaseDialog } from "./new-case-dialog";
import { isTyping, ShortcutsDialog } from "./shortcuts-dialog";
import { CommandPalette } from "./command-palette";
import { useRecentCases } from "@/lib/console/recent-cases";

type NavItem = {
  href: Route;
  label: string;
  icon: typeof Inbox;
  match: (path: string) => boolean;
  adminOnly?: boolean;
};

const NAV: NavItem[] = [
  {
    href: "/console",
    label: "Pratiche",
    icon: Inbox,
    match: (p) => p === "/console" || p.startsWith("/console/pratiche"),
  },
  {
    href: "/console/rinnovi",
    label: "Rinnovi ISEE",
    icon: RefreshCw,
    match: (p) => p.startsWith("/console/rinnovi"),
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
    href: "/console/impostazioni",
    label: "Impostazioni",
    icon: Settings,
    match: (p) => p.startsWith("/console/impostazioni"),
    adminOnly: true,
  },
  {
    href: "/console/rapporto",
    label: "Rapporto del pilota",
    icon: ClipboardCheck,
    match: (p) => p.startsWith("/console/rapporto"),
    adminOnly: true,
  },
  {
    href: "/console/registro",
    label: "Registro attività",
    icon: ScrollText,
    match: (p) => p.startsWith("/console/registro"),
    adminOnly: true,
  },
  {
    href: "/console/stato",
    label: "Stato del sistema",
    icon: Activity,
    match: (p) => p.startsWith("/console/stato"),
    adminOnly: true,
  },
  {
    href: "/console/aiuto",
    label: "Aiuto",
    icon: CircleHelp,
    match: (p) => p.startsWith("/console/aiuto"),
  },
];

export function ConsoleShell({ children }: { children: ReactNode }) {
  const me = useResource<LoginResponse>("/api/auth/me");
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const [expired, setExpired] = useState(false);
  const pathname = usePathname();

  // A write can fail because the session ended (idle timeout, operator deactivated, password
  // reset by an admin) or because a permission changed (role, MFA now required). Ending: keep
  // the page and what is typed on it, and offer the way back. Narrowing: refetch the profile,
  // so menus and gates follow the new role at once.
  // Listening starts once the console is on screen; before that, a 401 goes to sign in.
  const { reload: reloadMe } = me;
  const shown = me.data !== null;
  useEffect(() => {
    if (!shown) return;
    return onAuthFailure(({ status }) => {
      if (status === 403) return reloadMe();
      clearResourceCache();
      setExpired(true);
    });
  }, [reloadMe, shown]);

  // «Esci» in another tab ended this session too: leave its data, as that tab did.
  useEffect(
    () =>
      onSignOutElsewhere(() => {
        clearResourceCache();
        router.replace("/console/accedi");
      }),
    [router],
  );

  // «?» lists the shortcuts, as in most work tools; never while typing a question mark.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "?" || event.metaKey || event.ctrlKey || isTyping(event.target)) return;
      event.preventDefault();
      setShortcuts(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ⌘K / Ctrl+K opens the search from anywhere in the console. It only opens: closing goes
  // through the palette (Esc), which also clears its query.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      setSearching(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
          <Notice
            tone="danger"
            size="page"
            className="mx-4 max-w-md"
            title="Console non raggiungibile"
            action={
              <Button variant="secondary" onClick={() => void me.reload()}>
                Riprova
              </Button>
            }
          >
            {me.error?.message}
          </Notice>
        )}
      </div>
    );
  }

  const account = me.data!;

  // A reload between password and code keeps the half-open session: finish it here.
  if ("mfaRequired" in account) {
    return (
      <Gate
        title="Verifica in due passaggi"
        intro="Apri l'app di autenticazione sul telefono e scrivi il codice di Avanti."
      >
        <MfaVerifyForm onVerified={me.setData} onCancel={() => void signOut(router)} />
      </Gate>
    );
  }

  const operator = account;

  if (operator.mustChangePassword) {
    return (
      <OperatorProvider value={{ operator, reload: me.reload, replace: me.setData }}>
        <Gate
          title="Scegli la tua password"
          intro={`Per entrare nella console di ${operator.organization.name} scegli una password tua al posto di quella temporanea.`}
          onSignOut={() => void signOut(router)}
        >
          <PasswordForm submitLabel="Salva ed entra" onChanged={me.setData} temporary />
        </Gate>
      </OperatorProvider>
    );
  }

  if (operator.mustSetupMfa) {
    return (
      <Gate
        title="Attiva la verifica in due passaggi"
        intro={`${operator.organization.name} la richiede per entrare nella console: oltre alla password servirà un codice dall'app sul tuo telefono.`}
        wide
        onSignOut={() => void signOut(router)}
      >
        <MfaSetupFlow doneLabel="Entra nella console" onDone={() => void me.reload()} />
      </Gate>
    );
  }

  return (
    <OperatorProvider value={{ operator, reload: me.reload, replace: me.setData }}>
      <a
        href="#contenuto"
        className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50 focus:rounded-sm focus:bg-contrast focus:px-4 focus:py-2 focus:text-on-contrast"
      >
        Vai al contenuto
      </a>
      {/* Citizens' names and file names can be one long unbroken word: wrap rather than overflow. */}
      <div className="min-h-dvh bg-paper wrap-break-word lg:grid lg:grid-cols-[15rem_1fr]">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface px-4 lg:hidden">
          <Link href="/console" className="rounded-sm">
            <Logo />
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="ms-auto"
            aria-label="Cerca"
            onClick={() => setSearching(true)}
          >
            <Search className="size-5" aria-hidden />
          </Button>
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
          <div className="grid gap-1.5 px-3 pt-3 lg:pt-1">
            <Button className="w-full justify-start" onClick={() => setCreating(true)}>
              <Plus className="size-4" aria-hidden />
              Nuova pratica
            </Button>
            <button
              type="button"
              onClick={() => setSearching(true)}
              aria-keyshortcuts="Meta+K Control+K"
              className="flex h-10 items-center gap-3 rounded-sm px-3 text-body-sm text-ink-2 transition-colors hover:bg-sunk hover:text-ink"
            >
              <Search className="size-4.5" aria-hidden />
              <span className="flex-1 text-start">Cerca</span>
              <Kbd className="hidden lg:block">⌘K</Kbd>
            </button>
          </div>
          <nav aria-label="Console" className="mt-4 flex-1 px-3">
            <ul className="grid gap-0.5">
              {NAV.filter((item) => !item.adminOnly || operator.role === "admin").map(
                ({ href, label, icon: Icon, match }) => {
                  const active = match(pathname);
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex h-10 items-center gap-3 rounded-sm px-3 text-body-sm transition-colors",
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
                },
              )}
            </ul>
            <RecentCases operatorId={operator.id} />
          </nav>
          <OperatorCard operator={operator} />
        </aside>

        <main id="contenuto" tabIndex={-1} className="min-w-0 outline-none">
          {expired && <SessionExpired />}
          {children}
        </main>
      </div>
      <NewCaseDialog open={creating} onOpenChange={setCreating} />
      <ShortcutsDialog open={shortcuts} onOpenChange={setShortcuts} />
      <CommandPalette
        open={searching}
        onOpenChange={setSearching}
        onNewCase={() => setCreating(true)}
        onShortcuts={() => setShortcuts(true)}
        operatorId={operator.id}
        pages={NAV.filter((item) => !item.adminOnly || operator.role === "admin").map(
          ({ href, label, icon }) => ({ href, label, icon }),
        )}
      />
    </OperatorProvider>
  );
}

/**
 * A full page load, not a client navigation: unsaved notes still get the browser's
 * "leave the page?" question before the operator goes to sign in again.
 */
function SessionExpired() {
  const login = () => {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- see above
    window.location.assign(`/console/accedi?motivo=sessione&next=${next}`);
  };
  // A bar attached to the top edge of the page, not a card floating over it: it takes its own
  // room above the content and, sticky, stays in sight wherever the failed action was. Above
  // the page's own sticky bars (z-20): while the session is over, their actions can't work.
  return (
    <div
      role="alert"
      className="sticky top-14 z-30 border-b border-danger/25 bg-danger-wash text-danger lg:top-0"
    >
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6 lg:items-center lg:gap-x-4 lg:px-10">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 lg:mt-0" aria-hidden />
        <p className="min-w-0 flex-1 basis-72 text-body-sm">
          <strong className="font-semibold">La sessione è scaduta.</strong> Finché non accedi di
          nuovo, Avanti non può salvare. Se hai scritto qualcosa che non risulta salvato, copialo;
          dopo l&apos;accesso tornerai su questa pagina.
        </p>
        <Button size="sm" className="ms-auto" onClick={login}>
          Accedi di nuovo
        </Button>
      </div>
    </div>
  );
}

/** The last dossiers opened in this browser session, one click away. */
function RecentCases({ operatorId }: { operatorId: string }) {
  const recent = useRecentCases(operatorId);
  const pathname = usePathname();
  if (recent.length === 0) return null;
  return (
    <div className="mt-6">
      <p className="px-3 pb-1.5 text-xs font-semibold text-ink-3">Aperte di recente</p>
      {/* minmax(0, 1fr): a long name truncates instead of widening the column past the sidebar. */}
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-0.5">
        {recent.slice(0, 5).map((item) => {
          const href = `/console/pratiche/${item.id}` as Route;
          const active = pathname === href;
          return (
            <li key={item.id}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                title={item.name ?? undefined}
                className={cn(
                  "block truncate rounded-sm px-3 py-1.5 text-sm transition-colors",
                  active ? "bg-sunk text-ink" : "text-ink-2 hover:bg-sunk hover:text-ink",
                )}
              >
                {item.name ?? item.reference}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Leaves even if the request fails: the session expires server-side anyway. */
async function signOut(router: ReturnType<typeof useRouter>) {
  clearResourceCache();
  await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  announceSignOut();
  router.replace("/console/accedi");
}

function OperatorCard({ operator }: { operator: Operator }) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  async function logout() {
    setLeaving(true);
    await signOut(router);
  }

  return (
    <div className="flex items-center gap-3 border-t border-line p-4">
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-full bg-contrast font-display text-sm font-semibold text-on-contrast"
      >
        {operator.name
          .split(/\s+/)
          .filter(Boolean)
          // Array.from: whole code points, so a name starting with an accent or emoji survives.
          .map((part) => Array.from(part)[0])
          .slice(0, 2)
          .join("")
          .toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <Link
          href="/console/account"
          title={operator.name}
          className="block truncate text-sm font-semibold hover:underline"
        >
          {operator.name}
        </Link>
        <p className="truncate text-xs text-ink-3" title={operator.organization.name}>
          {operator.organization.name}
        </p>
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

function Gate({
  title,
  intro,
  wide = false,
  onSignOut,
  children,
}: {
  title: string;
  intro: string;
  wide?: boolean;
  onSignOut?: () => void;
  children: ReactNode;
}) {
  return (
    <main
      className={cn(
        "mx-auto grid min-h-dvh content-center px-4 py-12",
        wide ? "max-w-2xl" : "max-w-md",
      )}
    >
      <Logo />
      <PageHeader className="mt-8 mb-6" title={title} lead={intro} />
      {children}
      {onSignOut && (
        <p className="mt-8 border-t border-line pt-5 text-sm text-ink-2">
          Non è il tuo account o vuoi farlo più tardi?{" "}
          <button
            type="button"
            onClick={onSignOut}
            className="font-semibold text-stamp underline underline-offset-2"
          >
            Esci
          </button>
        </p>
      )}
    </main>
  );
}
