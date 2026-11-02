import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const LINKS = [
  { href: "/#come-funziona", label: "Come funziona" },
  { href: "/#pilota", label: "Pilota 2027" },
  { href: "/sicurezza", label: "Sicurezza" },
  { href: "/privacy", label: "Privacy" },
  { href: "/accessibilita", label: "Accessibilità" },
  { href: "/console/accedi", label: "Accesso operatori" },
] as const;

export function SiteFooter() {
  return (
    <footer id="footer" className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 pt-14 pb-10 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Logo />
          <p className="mt-3 text-ink-2">Prepara il lavoro, non sostituisce chi lo fa.</p>
        </div>
        <nav aria-label="Sito">
          <ul className="flex flex-wrap gap-x-6 gap-y-1">
            {LINKS.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="inline-flex min-h-11 items-center rounded-sm text-ink-2 transition-colors hover:text-ink"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="mx-auto max-w-6xl px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">
        <div className="flex flex-col gap-2 border-t border-line pt-6 text-sm text-ink-3 sm:flex-row sm:items-center sm:justify-between">
          <p>Avanti non è un servizio della Pubblica Amministrazione e non è un CAF.</p>
          <p>Gli esempi sul sito usano dati inventati.</p>
        </div>
      </div>
      {/* The wordmark, cut by the page's bottom edge: the last thing on the page is the name.
          Generated content: it is decoration, not text to read or to check for contrast. */}
      <div aria-hidden className="mx-auto max-w-6xl overflow-hidden px-4 sm:px-6">
        <div className="translate-y-[22%] font-display text-[clamp(5rem,19vw,15rem)] leading-none font-bold tracking-[-0.01em] text-sunk [font-stretch:92%] select-none before:content-['Avanti']" />
      </div>
    </footer>
  );
}
