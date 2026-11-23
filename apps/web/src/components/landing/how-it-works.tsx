import { AlertTriangle, Check, FileText, FileWarning, Sparkles } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { MISSING } from "@/components/ui/missing";
import { cn } from "@/lib/cn";

/*
 * «Prima dello sportello»: the same practice, one card, carried across four fields of colour as
 * it gets further along. The cards are fragments of the real screens with invented data
 * (`data-ui`): the citizen's three (the missing document is theirs to fetch, so `warn`) and the
 * operator's queue row (a missing required document blocks the case, so `danger`).
 */

function Card({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      data-ui
      className="field-card w-full max-w-[17.5rem] overflow-hidden rounded-[10px] bg-surface text-ink"
    >
      <p className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2.5 text-[0.8125rem]">
        <span className="font-semibold">{label}</span>
        <span className="text-ink-3">Dati inventati</span>
      </p>
      <div className="grid gap-2.5 p-3.5 text-sm">{children}</div>
    </div>
  );
}

function Tell() {
  return (
    <Card label="Dal telefono">
      <p
        lang="ro"
        className="ms-auto w-fit max-w-[92%] rounded-2xl rounded-se-md bg-stamp px-3.5 py-2.5 text-on-stamp"
      >
        Trebuie să fac ISEE, locuiesc cu mama mea și am un cont Fineco.
      </p>
      <p className="text-[0.8125rem] text-ink-3">Scritto in rumeno, con parole sue</p>
    </Card>
  );
}

function Confirm() {
  return (
    <Card label="Ho capito così">
      <dl className="grid">
        {(
          [
            ["Persone nel nucleo", "2"],
            ["Casa", "In affitto"],
            ["Conti", "1, Fineco"],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-line py-1.5">
            <dt className="text-ink-3">{k}</dt>
            <dd className="font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="flex h-9 items-center justify-center gap-1.5 rounded-md bg-stamp text-sm font-semibold text-on-stamp">
        <Check className="size-4" aria-hidden />
        Sì, è giusto
      </p>
    </Card>
  );
}

function Upload() {
  return (
    <Card label="Documenti">
      {(
        [
          ["Carta d’identità", "Leggibile", "ok"],
          ["Certificazione Unica", "È del 2024: serve la 2026", "warn"],
          ["Estratto conto Fineco", "Manca la pagina 2", "warn"],
        ] as const
      ).map(([name, note, tone]) => (
        <div key={name} className="flex items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-sunk">
            <FileText className="size-4 text-ink-3" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{name}</span>
            <span
              className={cn(
                "block text-[0.8125rem]",
                tone === "ok" ? "text-ok" : MISSING.citizen.text,
              )}
            >
              {note}
            </span>
          </span>
          {tone === "ok" ? (
            <Check className="size-4 shrink-0 text-ok" aria-hidden />
          ) : (
            <AlertTriangle className={cn("size-4 shrink-0", MISSING.citizen.text)} aria-hidden />
          )}
        </div>
      ))}
    </Card>
  );
}

function Deliver() {
  return (
    <Card label="Coda delle pratiche">
      <div>
        <p className="flex items-baseline justify-between gap-2">
          <span className="font-display text-lg font-semibold">Ioana Popescu</span>
          <span className={cn("shrink-0 text-[0.8125rem] font-semibold", MISSING.operator.text)}>
            1 mancante
          </span>
        </p>
        <p className="text-[0.8125rem] text-ink-3">ISEE ordinario 2027 · 2 persone · rumeno</p>
      </div>
      <p className={cn("flex gap-2 rounded-md px-2.5 py-2", MISSING.operator.wash)}>
        <FileWarning className={cn("mt-0.5 size-4 shrink-0", MISSING.operator.text)} aria-hidden />
        <span>
          <span className="block font-semibold">Giacenza media 2025</span>
          <span className="text-[0.8125rem] text-ink-2">Conto Fineco, già chiesta</span>
        </span>
      </p>
      <p className="flex items-center gap-1.5 text-[0.8125rem] text-ink-2">
        <Sparkles className="size-3.5 text-stamp" aria-hidden />
        Riepilogo pronto, in italiano
      </p>
    </Card>
  );
}

const FIELDS = [
  {
    clause: "Prima racconta, a parole sue e nella sua lingua.",
    tone: "bg-marker text-ink",
    Visual: Tell,
  },
  {
    clause: "Poi conferma quello che Avanti ha capito.",
    tone: "bg-stamp text-on-stamp",
    Visual: Confirm,
  },
  {
    clause: "Poi carica foto o PDF, con un primo controllo.",
    tone: "bg-folder text-ink",
    Visual: Upload,
  },
  {
    clause: "Infine il fascicolo arriva in coda, in italiano.",
    tone: "bg-contrast text-on-contrast",
    Visual: Deliver,
  },
] as const;

/** Four fields edge to edge: one practice, further along in each. */
export function HowItWorks({ titleId }: { titleId: string }) {
  return (
    <ol className="grid sm:grid-cols-2 xl:grid-cols-4">
      {FIELDS.map(({ clause, tone, Visual }, i) => (
        <li
          key={clause}
          className={cn(
            "field relative flex flex-col gap-7 px-[var(--site-margin)] py-10 sm:min-h-[30rem] sm:px-8 sm:py-10 xl:min-h-[34rem]",
            tone,
          )}
        >
          {i === 0 && (
            <h2 id={titleId} className="t-sub font-extrabold">
              Prima dello sportello
            </h2>
          )}
          <div
            data-reveal
            style={{ "--reveal-delay": `${i * 90}ms` } as CSSProperties}
            className="flex flex-1 items-center sm:justify-center"
          >
            <Visual />
          </div>
          <p
            data-reveal
            style={{ "--reveal-delay": `${i * 90 + 120}ms` } as CSSProperties}
            className="font-display text-[clamp(1.375rem,1.66vw,1.5rem)] leading-[1.15] font-semibold tracking-[-0.006em] text-balance"
          >
            {clause}
          </p>
        </li>
      ))}
    </ol>
  );
}
