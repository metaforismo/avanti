import { Check, FileSearch, Sparkles, X } from "lucide-react";
import { Stamp } from "@/components/brand/desk-objects";

/**
 * A fragment of the real dossier, drawn statically: an amount read by the AI that becomes data
 * only when the operator confirms it on the file. Invented data, labelled as such.
 */
export function OperatorSnippet() {
  return (
    <figure
      aria-label="Esempio: l'operatore conferma un importo letto dall'AI"
      className="relative mx-auto w-full max-w-md"
    >
      {/* The source document, behind the proposal it comes from. */}
      <div
        aria-hidden
        className="card-premium absolute inset-x-10 -top-8 bottom-16 rotate-[-3deg] p-5 sm:inset-x-14"
      >
        <p className="text-xs font-semibold text-ink-3">Attestazione Fineco · pagina 2</p>
        <div className="mt-4 grid gap-2">
          {[78, 64, 86, 52].map((w) => (
            <span key={w} className="h-2 rounded-full bg-sunk" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>

      <div className="card-premium relative overflow-hidden">
        <p className="flex items-center justify-between gap-2 border-b border-line bg-stamp-wash/50 px-5 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-stamp" aria-hidden />
            Copilota
          </span>
          <span className="text-xs text-ink-3">Prospetto DSU · quadro FC2</span>
        </p>
        <div className="grid gap-3 p-5 text-sm">
          <p className="text-ink-2">Giacenza media 2025 · conto Fineco</p>
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-display text-3xl font-semibold tabular-nums">12.430,55 €</span>
            <span className="text-xs font-semibold text-stamp">proposto dall&apos;AI</span>
          </p>
          <p className="flex items-center gap-1.5 text-xs text-ink-2">
            <FileSearch className="size-3.5" aria-hidden />
            Attestazione Fineco, pagina 2
          </p>
          <p aria-hidden className="mt-2 flex gap-2">
            <span className="inline-flex h-9 items-center gap-1.5 rounded-md bg-stamp px-3.5 text-sm font-semibold text-on-stamp">
              <Check className="size-4" />
              Conferma
            </span>
            <span className="inline-flex h-9 items-center gap-1.5 rounded-md px-3.5 text-sm font-semibold text-ink-2 ring-1 ring-line-strong">
              <X className="size-4" />
              Scarta
            </span>
          </p>
        </div>
        <Stamp className="absolute end-5 bottom-5 hidden text-[0.6875rem] [--stamp-rotate:-8deg] sm:inline-flex">
          <span>Decide</span>
          <span className="mt-0.5">l&apos;operatore</span>
        </Stamp>
      </div>
      <figcaption className="mt-4 text-center text-sm text-ink-3">Dati inventati.</figcaption>
    </figure>
  );
}
