import Link from "next/link";
import { Logo } from "@/components/brand/logo";

// The order of the page (as in the header), then the pages that stand on their own.
const LINKS = [
  { href: "/#come-funziona", label: "Come funziona" },
  { href: "/#operatori", label: "Per gli operatori" },
  { href: "/#pratiche", label: "Pratiche" },
  { href: "/#pilota", label: "Pilota 2027" },
  { href: "/sicurezza", label: "Sicurezza" },
  { href: "/privacy", label: "Privacy" },
  { href: "/accessibilita", label: "Accessibilità" },
  { href: "/console/accedi", label: "Accedi" },
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
      <div className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
        <div className="flex flex-col gap-2 border-t border-line pt-6 text-sm text-ink-3 sm:flex-row sm:items-center sm:justify-between">
          <p>Avanti non è un servizio della Pubblica Amministrazione e non è un CAF.</p>
          <p>Gli esempi sul sito usano dati inventati.</p>
        </div>
      </div>
      {/* The name, whole, as the last thing on the page: the letters are the height of the
          block (no descenders in «Avanti»), so nothing is cut and the page visibly ends.
          Generated content: it is decoration, not text to read or to check for contrast. */}
      <div
        aria-hidden
        className="mx-auto max-w-6xl px-4 pb-[env(safe-area-inset-bottom)] select-none sm:px-6"
      >
        <div className="overflow-clip pt-[0.05em] font-display text-[clamp(4.5rem,18.5vw,14rem)] leading-[0.74] font-bold tracking-[-0.01em] text-sunk [font-stretch:92%] before:content-['Avanti']" />
      </div>
    </footer>
  );
}
