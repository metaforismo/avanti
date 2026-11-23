import Link from "next/link";
import { PICTURE_CREDITS } from "@/lib/site/credits";

// The order of the page (as in the header), then the pages that stand on their own.
const COLUMNS = [
  [
    { href: "/#come-funziona", label: "Come funziona" },
    { href: "/#operatori", label: "Per gli operatori" },
    { href: "/#dati", label: "Dati e sicurezza" },
  ],
  [
    { href: "/#pilota", label: "Pilota 2027" },
    { href: "/sicurezza", label: "Sicurezza" },
    { href: "/privacy", label: "Privacy" },
  ],
  [{ href: "/accessibilita", label: "Accessibilità" }],
] as const;

/**
 * The mark, built large from its own flat shapes: the slip with its two notches (cut, so the
 * ground shows through) and the forward chevron. Decorative: the name is in the links' landmark.
 */
function MarkLarge() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 260 220"
      className="h-[clamp(10rem,30svh,17rem)] w-auto"
      role="presentation"
    >
      <defs>
        <mask id="footer-mark-cut">
          <rect width="260" height="220" rx="26" fill="#fff" />
          <circle cx="0" cy="110" r="30" fill="#000" />
          <circle cx="260" cy="110" r="30" fill="#000" />
        </mask>
      </defs>
      <rect width="260" height="220" rx="26" fill="var(--stamp)" mask="url(#footer-mark-cut)" />
      <path
        d="M104 62 152 110 104 158"
        fill="none"
        stroke="var(--marker)"
        strokeWidth="30"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SiteFooter() {
  return (
    <footer id="footer" className="bg-paper pt-24 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="frame grid gap-x-6 gap-y-14 lg:grid-cols-12">
        <div className="flex flex-wrap items-end gap-x-10 gap-y-8 lg:col-span-12">
          <MarkLarge />
          <p className="t-sub max-w-[22ch] pb-1">Prepara il lavoro, non sostituisce chi lo fa.</p>
        </div>

        <nav aria-label="Sito" className="lg:col-span-12">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
            {COLUMNS.map((links, i) => (
              <ul key={i} className="grid content-start">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="inline-flex min-h-11 items-center rounded-sm text-[0.9375rem] text-ink transition-colors hover:text-stamp"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            ))}
            <div className="sm:justify-self-end">
              <Link
                href="/console/accedi"
                className="ticket-btn inline-flex h-11 items-center rounded-sm px-5 text-[0.9375rem] font-semibold text-paper [--ticket-fill-hover:var(--ink-2)] [--ticket-fill:var(--ink)] active:scale-[0.98]"
              >
                Accedi
              </Link>
            </div>
          </div>
        </nav>

        <div className="grid gap-6 lg:col-span-12 lg:grid-cols-12 lg:items-end">
          <div className="grid gap-2 text-[0.9375rem] text-ink-2 lg:col-span-12">
            <p>
              Avanti non è un servizio della Pubblica Amministrazione e non è un CAF. Gli esempi sul
              sito usano dati inventati.
            </p>
            <p>
              Fotografia:{" "}
              {PICTURE_CREDITS.map((credit) => (
                <span key={credit.source}>
                  <a
                    href={credit.source}
                    className="underline decoration-[0.07em] underline-offset-[0.2em] hover:text-ink"
                  >
                    {credit.title}
                  </a>
                  , di {credit.creator},{" "}
                  <a
                    href={credit.licenceUrl}
                    className="underline decoration-[0.07em] underline-offset-[0.2em] hover:text-ink"
                  >
                    {credit.licence}
                  </a>
                  , via Wikimedia Commons.
                </span>
              ))}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
