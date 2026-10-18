import { AlertTriangle, Check, Download, FileWarning, Send } from "lucide-react";

const PRESENT = [
  ["Documento d'identità e codice fiscale", "Ioana Popescu, Mihai Popescu"],
  ["Redditi 2025", "Certificazione Unica 2026 di entrambi"],
  ["Visura catastale", "Casa di proprietà, 1 immobile"],
] as const;

/**
 * The operator's dossier, drawn statically after the real console page (name as title, actions
 * on top, «Da guardare» first). Invented data, labelled as such: a picture of the product, not a
 * screenshot that would age with every console change.
 */
export function DossierPreview() {
  return (
    <figure className="self-center overflow-hidden rounded-xl bg-paper text-ink shadow-float ring-1 ring-on-contrast/10">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-line bg-surface px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="rounded-full bg-stamp-wash px-2 py-0.5 font-semibold text-stamp">
              Da revisionare
            </span>
            <span className="rounded-full bg-sunk px-2 py-0.5 font-semibold text-ink-2">
              Cittadina in rumeno
            </span>
          </p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-[-0.015em]">
            Ioana Popescu
          </p>
          <p className="text-sm text-ink-2">ISEE ordinario 2027 · nucleo di 2 persone</p>
        </div>
        {/* Drawn, not real controls: the figure is a picture of the console. */}
        <div aria-hidden className="flex flex-wrap gap-2">
          <span className="inline-flex h-9 items-center gap-1.5 rounded-sm bg-stamp px-3 text-sm font-semibold text-on-stamp">
            <Send className="size-4" />
            Chiedi integrazione
          </span>
          <span className="inline-flex h-9 items-center gap-1.5 rounded-sm bg-surface px-3 text-sm font-semibold ring-1 ring-line-strong ring-inset">
            <Check className="size-4" />
            Segna come pronta
          </span>
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:p-5">
        <section className="overflow-hidden rounded-lg bg-surface ring-1 ring-line">
          <p className="flex flex-wrap items-baseline gap-x-2 px-4 pt-3 pb-2 font-display text-lg font-semibold">
            Da guardare
            <span className="font-sans text-sm font-normal text-ink-3">
              1 documento mancante, 1 avviso
            </span>
          </p>
          <div className="flex gap-2.5 bg-danger-wash/70 px-4 py-3">
            <FileWarning className="mt-0.5 size-4.5 shrink-0 text-danger" aria-hidden />
            <div className="text-sm">
              <p className="font-semibold">Manca 1 documento obbligatorio</p>
              <p className="mt-0.5 text-ink-2">
                Ioana Popescu · Giacenza media 2025 · conto Fineco
              </p>
            </div>
          </div>
          <div className="flex gap-2.5 border-t border-line px-4 py-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4.5 shrink-0 text-warn" aria-hidden />
            <p>Documento d&apos;identità di Mihai Popescu: scade il 12/01/2027</p>
          </div>
        </section>

        <ul className="divide-y divide-line rounded-lg bg-surface text-sm ring-1 ring-line">
          {PRESENT.map(([label, note]) => (
            <li key={label} className="flex items-start gap-2.5 px-4 py-2.5">
              <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-label="Verificato" />
              <span className="min-w-0">
                <span className="block font-semibold">{label}</span>
                <span className="block text-ink-3">{note}</span>
              </span>
            </li>
          ))}
        </ul>

        <p className="flex items-center gap-2 px-1 text-sm text-ink-2">
          <Download className="size-4 shrink-0 text-ink-3" aria-hidden />
          Scarica tutti: 7 file in un solo ZIP, già rinominati per persona
        </p>
      </div>

      <figcaption className="border-t border-line bg-sunk px-5 py-3 text-sm text-ink-3 sm:px-6">
        Com&apos;è fatto il fascicolo nella console. Dati inventati.
      </figcaption>
    </figure>
  );
}
