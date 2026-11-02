import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const COLUMNS = [
  {
    title: "Prodotto",
    links: [
      { href: "/#come-funziona", label: "Come funziona" },
      { href: "/#operatori", label: "Per gli operatori" },
      { href: "/#pratiche", label: "Pratiche" },
      { href: "/#pilota", label: "Pilota 2027" },
    ],
  },
  {
    title: "Fiducia",
    links: [
      { href: "/sicurezza", label: "Sicurezza e dati" },
      { href: "/privacy", label: "Privacy" },
      { href: "/accessibilita", label: "Accessibilità" },
    ],
  },
  {
    title: "Accesso",
    links: [
      { href: "/console/accedi", label: "Console operatori" },
      { href: "/#pilota", label: "Contatti" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer id="footer" className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-x-8 gap-y-12 px-4 pt-16 pb-12 sm:px-6 md:grid-cols-[1.3fr_2fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-ink-2">
            Il front office AI per CAF e patronati. Prepara il lavoro, non sostituisce chi lo fa.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3">
          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="type-eyebrow text-ink-3">{column.title}</h2>
              <ul className="mt-3 grid">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="inline-flex min-h-10 items-center rounded-sm text-ink-2 transition-colors hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
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
