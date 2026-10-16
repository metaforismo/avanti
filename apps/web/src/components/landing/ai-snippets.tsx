import { Check, FileSearch, Sparkles, X } from "lucide-react";

/**
 * Two fragments of the real screens, drawn statically: what the citizen confirms after writing
 * one message, and what the operator confirms in the dossier. Invented data, labelled as such.
 */
export function CitizenSnippet() {
  return (
    <figure
      className="rounded-xl bg-paper p-4 ring-1 ring-line sm:p-5"
      aria-label="Esempio: il cittadino conferma quello che Avanti ha capito"
    >
      <p className="ms-auto w-fit max-w-[85%] rounded-3xl bg-sunk px-4 py-2.5 text-body-sm">
        Siamo in quattro, viviamo in affitto e ho un conto alla Fineco.
      </p>
      <div className="mt-3 rounded-lg bg-surface p-4 shadow-raised ring-1 ring-stamp/30">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-stamp" aria-hidden />
          Ho capito così: controlla
        </p>
        <dl className="mt-2 divide-y divide-line text-sm">
          {(
            [
              ["Persone nel nucleo", "4"],
              ["Casa", "In affitto"],
              ["Conti e rapporti", "1, Fineco"],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-3 py-2">
              <dt className="text-ink-3">{label}</dt>
              <dd className="font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 flex h-10 items-center justify-center gap-2 rounded-md bg-stamp text-sm font-semibold text-on-stamp">
          <Check className="size-4" aria-hidden />
          Sì, è giusto
        </p>
      </div>
      <figcaption className="mt-3 text-xs text-ink-3">
        Diventano risposte solo se le conferma. Dati inventati.
      </figcaption>
    </figure>
  );
}

export function OperatorSnippet() {
  return (
    <figure
      className="rounded-xl bg-paper p-4 ring-1 ring-line sm:p-5"
      aria-label="Esempio: l'operatore conferma un importo letto dall'AI"
    >
      <div className="overflow-hidden rounded-lg bg-surface ring-1 ring-stamp/25">
        <p className="flex items-center justify-between gap-2 border-b border-line bg-stamp-wash/50 px-4 py-2.5">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-stamp" aria-hidden />
            Copilota
          </span>
          <span className="text-xs text-ink-3">Prospetto DSU · quadro FC2</span>
        </p>
        <div className="grid gap-3 p-4 text-sm">
          <p className="text-ink-2">Giacenza media 2025 · conto Fineco</p>
          <div className="rounded-sm bg-stamp-wash px-3 py-2.5 ring-1 ring-stamp/15">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-base font-semibold tabular-nums">12.430,55 €</span>
              <span className="text-xs text-stamp">proposto dall&apos;AI</span>
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-2">
              <FileSearch className="size-3.5" aria-hidden />
              Attestazione Fineco, pagina 2
            </p>
            <p className="mt-2.5 flex gap-2">
              <span className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-stamp px-3 text-xs font-semibold text-on-stamp">
                <Check className="size-3.5" aria-hidden />
                Conferma
              </span>
              <span className="inline-flex h-8 items-center gap-1.5 rounded-sm px-3 text-xs font-semibold text-ink-2">
                <X className="size-3.5" aria-hidden />
                Scarta
              </span>
            </p>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-xs text-ink-3">
        Nel prospetto entra solo ciò che l&apos;operatore conferma sul file. Dati inventati.
      </figcaption>
    </figure>
  );
}
