"use client";

import {
  AlertTriangle,
  Check,
  Download,
  FileArchive,
  FileSearch,
  FileText,
  FileWarning,
  Languages,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Stamp } from "@/components/brand/desk-objects";
import { MISSING } from "@/components/ui/missing";
import { cn } from "@/lib/cn";

/*
 * «Cosa vede l'operatore»: the names of the dossier's parts, set large; choosing one lays that
 * part of the console on the ticket. The fragments are drawn after the real screens with the
 * same invented case (`data-ui`); the sentence beside them is the claim, kept true to the code.
 */

function Panel({ title, meta, children }: { title: string; meta?: string; children: ReactNode }) {
  return (
    <div data-ui className="w-full overflow-hidden rounded-[10px] bg-surface text-ink">
      <div className="border-b border-line px-5 py-3.5">
        <p className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="rounded-full bg-stamp-wash px-2 py-0.5 font-semibold text-stamp">
            Da revisionare
          </span>
          <span className="rounded-full bg-sunk px-2 py-0.5 font-semibold text-ink-2">
            Cittadina in rumeno
          </span>
        </p>
        <p className="mt-2 flex items-baseline justify-between gap-3">
          <span className="font-display text-xl font-semibold tracking-[-0.012em]">
            Ioana Popescu
          </span>
          <span className="text-[0.8125rem] text-ink-3">ISEE ordinario 2027</span>
        </p>
      </div>
      <div className="p-4">
        <p className="mb-2.5 flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-semibold">{title}</span>
          {meta && <span className="text-ink-3">{meta}</span>}
        </p>
        {children}
      </div>
    </div>
  );
}

function Review() {
  return (
    <Panel title="Da guardare" meta="1 documento mancante, 1 avviso">
      <div className="overflow-hidden rounded-md ring-1 ring-line">
        <div className={cn("flex gap-2.5 px-3.5 py-3", MISSING.operator.wash)}>
          <FileWarning className="mt-0.5 size-4.5 shrink-0 text-danger" aria-hidden />
          <div className="min-w-0 text-sm">
            <p className="font-semibold">Manca 1 documento obbligatorio</p>
            <p className="mt-0.5 text-ink-2">Giacenza media 2025 · conto Fineco</p>
          </div>
        </div>
        <div className="flex gap-2.5 border-t border-line px-3.5 py-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4.5 shrink-0 text-warn" aria-hidden />
          <p className="min-w-0">Documento d’identità di Mihai Popescu: scade il 12/01/2027</p>
        </div>
      </div>
      <p className="mt-3 flex flex-wrap gap-2" aria-hidden>
        <span className="inline-flex h-9 items-center gap-1.5 rounded-sm bg-stamp px-3 text-sm font-semibold whitespace-nowrap text-on-stamp">
          <Send className="size-4" />
          Chiedi integrazione
        </span>
        <span className="inline-flex h-9 items-center gap-1.5 rounded-sm px-3 text-sm font-semibold whitespace-nowrap ring-1 ring-line-strong ring-inset">
          <Check className="size-4" />
          Segna come pronta
        </span>
      </p>
    </Panel>
  );
}

function Documents() {
  return (
    <Panel title="Documenti" meta="6 di 7 verificati">
      <ul className="divide-y divide-line overflow-hidden rounded-md text-sm ring-1 ring-line">
        {(
          [
            ["Documento d’identità e codice fiscale", "Ioana e Mihai Popescu", true],
            ["Certificazione Unica 2026", "Ioana Popescu", true],
            ["Visura catastale", "Casa di proprietà, 1 immobile", true],
            ["Giacenza media 2025", "Conto Fineco", false],
          ] as const
        ).map(([label, note, ok]) => (
          <li key={label} className="flex items-start gap-2.5 px-3.5 py-2.5">
            {ok ? (
              <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
            ) : (
              <FileWarning className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
            )}
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{label}</span>
              <span className="block text-ink-3">{note}</span>
            </span>
            <FileText className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Amounts() {
  return (
    <Panel title="Prospetto DSU" meta="quadro FC2">
      <div className="relative rounded-md bg-stamp-wash/60 p-4 ring-1 ring-stamp/15">
        <p className="flex items-center gap-1.5 text-[0.8125rem] font-semibold text-stamp">
          <Sparkles className="size-3.5" aria-hidden />
          Proposto dall’AI
        </p>
        <p className="mt-1 text-sm text-ink-2">Giacenza media 2025 · conto Fineco</p>
        <p className="mt-1 font-display text-3xl font-semibold tabular-nums">12.430,55 €</p>
        <p className="mt-1.5 flex items-center gap-1.5 text-[0.8125rem] text-ink-2">
          <FileSearch className="size-3.5" aria-hidden />
          Attestazione Fineco, pagina 2
        </p>
        <p aria-hidden className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex h-9 items-center gap-1.5 rounded-sm bg-stamp px-3.5 text-sm font-semibold whitespace-nowrap text-on-stamp">
            <Check className="size-4" />
            Conferma
          </span>
          <span className="inline-flex h-9 items-center gap-1.5 rounded-sm bg-surface px-3.5 text-sm font-semibold whitespace-nowrap text-ink-2 ring-1 ring-line-strong ring-inset">
            <X className="size-4" />
            Scarta
          </span>
        </p>
        <Stamp className="absolute end-4 bottom-4 hidden text-[0.6875rem] [--stamp-rotate:-8deg] sm:inline-flex">
          <span>Decide</span>
          <span className="mt-0.5">l’operatore</span>
        </Stamp>
      </div>
    </Panel>
  );
}

function Requests() {
  return (
    <Panel title="Chiedi integrazione" meta="nel link del cittadino">
      <div className="grid gap-2.5 text-sm">
        <p className="rounded-md bg-paper px-3.5 py-3 ring-1 ring-line">
          Ci serve l’attestazione con la giacenza media 2025 del conto Fineco.
        </p>
        <p className="flex items-center gap-1.5 text-[0.8125rem] text-ink-3">
          <Languages className="size-3.5" aria-hidden />
          La cittadina la legge in rumeno
        </p>
        <p
          lang="ro"
          className="ms-auto w-fit max-w-[92%] rounded-2xl rounded-se-md bg-stamp px-3.5 py-2.5 text-on-stamp"
        >
          Avem nevoie de atestatul cu soldul mediu pe 2025 al contului Fineco.
        </p>
      </div>
    </Panel>
  );
}

function Handover() {
  return (
    <Panel title="Consegna al gestionale">
      <ul className="divide-y divide-line overflow-hidden rounded-md text-sm ring-1 ring-line">
        {(
          [
            [FileText, "Prospetto DSU", "nell’ordine del modello, con la fonte di ogni campo"],
            [FileText, "Riepilogo in PDF", "per l’archivio della pratica"],
            [FileArchive, "Originali in un solo ZIP", "7 file, già rinominati per persona"],
          ] as const
        ).map(([Icon, label, note]) => (
          <li key={label} className="flex items-start gap-2.5 px-3.5 py-2.5">
            <Icon className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{label}</span>
              <span className="block text-ink-3">{note}</span>
            </span>
            <Download className="mt-0.5 size-4 shrink-0 text-stamp" aria-hidden />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

const PARTS = [
  {
    name: "Da guardare",
    fact: "In cima al fascicolo i documenti che mancano, persona per persona, poi gli avvisi.",
    ticket: "bg-marker",
    Visual: Review,
  },
  {
    name: "Documenti",
    fact: "Ogni file è abbinato alla sua voce e alla persona a cui appartiene.",
    ticket: "bg-folder",
    Visual: Documents,
  },
  {
    name: "Importi",
    fact: "L’AI propone l’importo e mostra il file da cui viene. Lo conferma l’operatore.",
    ticket: "bg-stamp",
    Visual: Amounts,
  },
  {
    name: "Integrazioni",
    fact: "Si chiedono dal fascicolo; il cittadino le riceve nel suo link, nella sua lingua.",
    ticket: "bg-marker",
    Visual: Requests,
  },
  {
    name: "Gestionale",
    fact: "Per copiare nel vostro gestionale: prospetto DSU, riepilogo e originali in un solo ZIP.",
    ticket: "bg-folder",
    Visual: Handover,
  },
] as const;

/** Where the ticket starts under each part (it breaks the ticket's top edge) and how far it
    runs past the part's bottom. */
const TICKET_TOP = 48;
const TICKET_BELOW = 40;

export function OperatorShowcase({ titleId }: { titleId: string }) {
  const [active, setActive] = useState(0);
  const factId = useId();
  const part = PARTS[active] ?? PARTS[0];
  // Each part's ticket follows that part's height; the stage keeps the tallest one's, so
  // choosing a part never moves anything outside this section.
  const partRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [heights, setHeights] = useState<number[]>([]);

  useLayoutEffect(() => {
    const nodes = partRefs.current.filter((n): n is HTMLDivElement => n !== null);
    const read = () => setHeights(partRefs.current.map((n) => n?.offsetHeight ?? 0));
    read();
    const observer = new ResizeObserver(read);
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="frame grid gap-10 py-24 xl:grid-cols-12 xl:gap-x-6 xl:py-28">
      {/* The ticket and the part of the console laid on it. */}
      <div className="relative xl:col-span-7 xl:col-start-6 xl:row-start-1">
        <div
          className="relative mx-auto w-full max-w-[36rem] px-[5%]"
          style={{ paddingBottom: TICKET_BELOW }}
        >
          {PARTS.map((p, i) => {
            const height = heights[i];
            return (
              <span
                key={p.name}
                aria-hidden
                data-off={i === active ? undefined : ""}
                style={
                  height
                    ? { top: TICKET_TOP, height: height - TICKET_TOP + TICKET_BELOW }
                    : { top: TICKET_TOP, bottom: 0 }
                }
                className={cn(
                  "swap ticket absolute inset-x-0 rounded-[14px] [--notch:28px] max-sm:[--notch:18px]",
                  p.ticket,
                )}
              />
            );
          })}
          <div className="relative grid">
            {PARTS.map(({ name, Visual }, i) => (
              <div
                key={name}
                ref={(node) => {
                  partRefs.current[i] = node;
                }}
                aria-hidden={i !== active}
                data-off={i === active ? undefined : ""}
                className="swap col-start-1 row-start-1 self-start"
              >
                <Visual />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* The names of the parts, the heading as their first line, and what the chosen one does.
          Top-aligned with the part on the right. */}
      <div className="xl:col-span-5 xl:col-start-1 xl:row-start-1">
        <h2 id={titleId} className="t-sub text-on-contrast/70">
          Cosa vede l’operatore
        </h2>
        <ul data-reveal="stagger" className="mt-1" aria-describedby={factId}>
          {PARTS.map((p, i) => (
            <li key={p.name}>
              <button
                type="button"
                aria-pressed={i === active}
                onClick={() => setActive(i)}
                className={cn(
                  "group t-sub inline-flex min-h-11 items-center gap-3 rounded-sm text-start transition-colors duration-200 focus-visible:outline-marker",
                  i === active ? "text-on-contrast" : "text-on-contrast/55 hover:text-on-contrast",
                )}
              >
                {p.name}
                <span
                  aria-hidden
                  className={cn(
                    "ticket-dot text-[0.5em] text-marker transition-[opacity,transform] duration-300 ease-(--ease-out)",
                    i === active ? "opacity-100" : "-translate-x-1 opacity-0",
                  )}
                />
              </button>
            </li>
          ))}
        </ul>
        <p id={factId} aria-live="polite" className="t-body mt-8 max-w-[34ch] text-on-contrast">
          {part.fact}
        </p>
      </div>
    </div>
  );
}
