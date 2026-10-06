import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-ink-2">
            Il front office AI per CAF e patronati. Prepara il lavoro, non sostituisce chi lo fa.
          </p>
        </div>
        <nav aria-label="Prodotto">
          <h2 className="text-sm font-semibold text-ink">Prodotto</h2>
          <ul className="mt-3 grid gap-2 text-ink-2">
            <li>
              <Link className="hover:text-ink" href="/#come-funziona">
                Come funziona
              </Link>
            </li>
            <li>
              <Link className="hover:text-ink" href="/#pratiche">
                Pratiche
              </Link>
            </li>
            <li>
              <Link className="hover:text-ink" href="/#pilota">
                Pilota 2027
              </Link>
            </li>
            <li>
              <Link className="hover:text-ink" href="/console/accedi">
                Accesso operatori
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Informazioni">
          <h2 className="text-sm font-semibold text-ink">Informazioni</h2>
          <ul className="mt-3 grid gap-2 text-ink-2">
            <li>
              <Link className="hover:text-ink" href="/sicurezza">
                Sicurezza e dati
              </Link>
            </li>
            <li>
              <Link className="hover:text-ink" href="/privacy">
                Privacy
              </Link>
            </li>
            <li>
              <a className="hover:text-ink" href="mailto:ciao@avanti.example">
                Contatti
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <div className="mx-auto max-w-6xl px-4 pb-10 text-sm text-ink-3 sm:px-6">
        Avanti non è un servizio della Pubblica Amministrazione e non è un CAF.
      </div>
    </footer>
  );
}
