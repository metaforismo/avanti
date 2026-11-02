import { AlertTriangle, Check, Download, FileWarning, Send } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/cn";

const PRESENT = [
  ["Documento d'identità e codice fiscale", "Ioana Popescu, Mihai Popescu"],
  ["Redditi 2025", "Certificazione Unica 2026 di entrambi"],
  ["Visura catastale", "Casa di proprietà, 1 immobile"],
] as const;

/** Queue rows, with the same status names as the console (lib/console/labels.ts). */
const QUEUE = [
  { name: "Ioana Popescu", meta: "ISEE ordinario · 2 persone", note: "1 mancante", current: true },
  { name: "Giuseppe Esposito", meta: "ISEE ordinario · 4 persone", note: "Completo" },
  { name: "Fatima Zahra El Idrissi", meta: "ISEE ordinario · in arabo", note: "2 avvisi" },
  { name: "Marco Rinaldi", meta: "ISEE ordinario · 3 persone", note: "Completo" },
] as const;

const NAV = ["Pratiche", "Rinnovi ISEE", "Metriche", "Sportelli e QR"] as const;

/**
 * The operator console, drawn statically after the real pages: the queue on the side, the
 * dossier with its name as title, actions on top and «Da guardare» first. Invented data,
 * labelled as such: a picture of the product, not a screenshot that ages with every release.
 */
export function DossierPreview() {
  return (
    <figure className="card-premium card-premium-dark overflow-hidden rounded-2xl bg-paper text-ink">
      {/* Drawn, not real controls: the whole figure is a picture of the console. */}
      <div
        aria-hidden
        className="flex h-12 items-center gap-6 border-b border-line bg-surface px-4 sm:px-5"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <LogoMark className="size-5" />
          CAF di prova
        </span>
        <span className="hidden items-center gap-1 text-sm text-ink-2 md:flex">
          {NAV.map((item, i) => (
            <span
              key={item}
              className={cn("rounded-sm px-2.5 py-1", i === 0 && "bg-sunk font-semibold text-ink")}
            >
              {item}
            </span>
          ))}
        </span>
      </div>

      <div className="grid md:grid-cols-[15.5rem_minmax(0,1fr)]">
        <div aria-hidden className="hidden border-e border-line bg-surface/60 md:block">
          <p className="flex items-baseline justify-between px-4 pt-4 pb-2 text-sm">
            <span className="font-semibold">Da revisionare</span>
            <span className="tabular text-ink-3">4</span>
          </p>
          <ul className="grid gap-0.5 px-2 pb-3">
            {QUEUE.map((row) => (
              <li
                key={row.name}
                className={cn(
                  "scroll-compose rounded-md px-2.5 py-2 text-sm",
                  "current" in row && row.current && "bg-stamp-wash ring-1 ring-stamp/20",
                )}
              >
                <span className="block truncate font-semibold">{row.name}</span>
                <span className="flex justify-between gap-2 text-xs text-ink-3">
                  <span className="truncate">{row.meta}</span>
                  <span className="shrink-0">{row.note}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-line px-4 py-4 sm:px-6">
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

          <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-2">
            <section className="scroll-compose overflow-hidden rounded-lg bg-surface ring-1 ring-line lg:col-span-2">
              <p className="flex flex-wrap items-baseline gap-x-2 px-4 pt-3 pb-2 font-display text-lg font-semibold">
                Da guardare
                <span className="font-sans text-sm font-normal text-ink-3">
                  1 documento mancante, 1 avviso
                </span>
              </p>
              <div className="flex gap-2.5 bg-danger-wash/70 px-4 py-3">
                <FileWarning className="mt-0.5 size-4.5 shrink-0 text-danger" aria-hidden />
                <div className="min-w-0 text-sm">
                  <p className="font-semibold">Manca 1 documento obbligatorio</p>
                  <p className="mt-0.5 text-ink-2">
                    Ioana Popescu · Giacenza media 2025 · conto Fineco
                  </p>
                </div>
              </div>
              <div className="flex gap-2.5 border-t border-line px-4 py-3 text-sm">
                <AlertTriangle className="mt-0.5 size-4.5 shrink-0 text-warn" aria-hidden />
                <p className="min-w-0">
                  Documento d&apos;identità di Mihai Popescu: scade il 12/01/2027
                </p>
              </div>
            </section>

            <ul className="scroll-compose divide-y divide-line rounded-lg bg-surface text-sm ring-1 ring-line">
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

            <div className="scroll-compose grid content-start gap-2 rounded-lg bg-surface p-4 text-sm ring-1 ring-line">
              <p className="font-semibold">Consegna al gestionale</p>
              <p className="text-ink-2">
                Prospetto DSU nell&apos;ordine del modello, riepilogo in PDF e originali.
              </p>
              <p className="mt-1 flex items-start gap-2 text-ink-2">
                <Download className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />7 file in un
                solo ZIP, già rinominati per persona
              </p>
            </div>
          </div>
        </div>
      </div>

      <figcaption className="border-t border-line bg-sunk px-4 py-3 text-sm text-ink-3 sm:px-6">
        Com&apos;è fatta la console: la coda delle pratiche e il fascicolo aperto. Dati inventati.
      </figcaption>
    </figure>
  );
}
