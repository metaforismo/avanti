"use client";

import { Check, FileWarning, Mic, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { QueueTicket, Stamp } from "@/components/brand/desk-objects";
import { CHEVRON_PATH } from "@/components/brand/mark";
import { MISSING } from "@/components/ui/missing";
import { cn } from "@/lib/cn";
import { usePrefersReducedMotion } from "@/lib/hooks/use-media-query";
import { SAMPLES } from "./intake-demo-samples";

/** The samples keep the plain apostrophe a keyboard types (the backend tests those exact
    sentences); the page draws the typographic one. */
const typographic = (text: string) => text.replace(/(?<=\p{L})'(?=\p{L})/gu, "’");

/** What the operator reads: always Italian, whatever language the citizen used. */
const FACTS = [
  { key: "Pratica", value: "ISEE ordinario 2027" },
  { key: "Nucleo", value: "Richiedente e madre" },
  { key: "Padre", value: "Non convivente" },
  { key: "Rapporti finanziari", value: "1 conto Fineco" },
  { key: "Veicoli", value: "1 auto" },
] as const;

// The dossier is the operator's: a missing required document is `danger` here, as in the console.
const CHECKLIST: { label: string; state: "ok" | "missing" }[] = [
  { label: "Documenti d’identità di entrambi", state: "ok" },
  { label: "Redditi 2025 di entrambi", state: "ok" },
  { label: "Saldo e giacenza media 2025 del conto Fineco", state: "missing" },
  { label: "Targa dell’auto", state: "ok" },
];

const STEP_MS = 560;
// Phases: 1–5 a phrase is highlighted and its fact lands in the dossier; 6–9 the checklist is
// ticked line by line; 10 the dossier is stamped and the missing document flagged.
const FACTS_END = FACTS.length;
const LAST_PHASE = FACTS_END + CHECKLIST.length + 1;

/**
 * The hero's live piece, laid on the blue stage: what a citizen writes, in their own words and
 * language, becoming the dossier the operator opens. Choosing a language replays it. Invented
 * data, said so under it. The sentences are the ones the extraction is tested on
 * (intake-demo-samples.ts). The two cards are fragments of the real screens (`data-ui`).
 */
export function IntakeDemo() {
  const [sampleIndex, setSampleIndex] = useState(0);
  const [phase, setPhase] = useState(0);
  const [run, setRun] = useState(0);
  const reduced = usePrefersReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  // Start only once the demo is on screen, so people actually see the sequence.
  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => entry?.isIntersecting && setVisible(true),
      { threshold: 0.3 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || reduced) return;
    const timers = Array.from({ length: LAST_PHASE }, (_, i) =>
      window.setTimeout(() => setPhase(i + 1), 900 + i * STEP_MS),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [visible, reduced, sampleIndex, run]);

  const replay = () => {
    setPhase(0);
    setRun((r) => r + 1);
  };

  const sample = SAMPLES[sampleIndex] ?? SAMPLES[0]!;
  // Reduced motion: the finished dossier straight away, no sequence.
  const shown = reduced ? LAST_PHASE : phase;
  const done = shown >= LAST_PHASE;

  return (
    <div ref={rootRef}>
      {/* The languages and, at the far end of the same row, what the example is. */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div
          role="group"
          aria-label="Lingua del cittadino nell’esempio"
          className="flex flex-wrap items-center gap-1.5"
        >
          {/* font-sans on the labels: one word in Arabic or Bengali reads fine in the system
            font, and would otherwise fetch 270 KB of Noto above the fold. */}
          {SAMPLES.map((s, i) => (
            <button
              key={s.lang}
              type="button"
              lang={s.lang}
              aria-pressed={i === sampleIndex}
              onClick={() => {
                if (i === sampleIndex) return;
                setSampleIndex(i);
                replay();
              }}
              className={cn(
                "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 font-sans text-[0.9375rem] transition-[background-color,color,transform] duration-150 ease-(--ease-out) focus-visible:outline-marker active:scale-[0.96]",
                i === sampleIndex
                  ? "bg-surface font-semibold text-stamp"
                  : "bg-on-stamp/12 text-on-stamp hover:bg-on-stamp/20",
              )}
            >
              {i === sampleIndex && <Check className="size-3.5" strokeWidth={2.5} aria-hidden />}
              {s.label}
            </button>
          ))}
        </div>
        <p className="flex min-h-11 items-center gap-3 text-sm text-on-stamp">
          <span>Esempio con dati inventati.</span>
          {done && !reduced && (
            <button
              type="button"
              onClick={replay}
              className="-me-2 inline-flex min-h-11 animate-fade-in items-center gap-1.5 rounded-sm px-2 font-semibold text-on-stamp transition-opacity hover:opacity-80 focus-visible:outline-marker"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Rivedi
            </button>
          )}
        </p>
      </div>

      <div className="grid items-start gap-0 md:grid-cols-[minmax(0,0.86fr)_auto_minmax(0,1.14fr)] md:items-center">
        {/* The citizen's screen */}
        <figure data-ui className="min-w-0 overflow-hidden rounded-[14px] bg-paper text-ink">
          <figcaption className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 text-sm">
            <span className="font-semibold">CAF di prova · ISEE</span>
            <span className="text-ink-3">Dal telefono</span>
          </figcaption>
          <div className="grid min-h-[15rem] content-between gap-6 px-4 pt-5 pb-4">
            <p
              key={`${sample.lang}-${run}`}
              lang={sample.lang}
              dir={sample.dir}
              className={cn(
                "w-fit max-w-[96%] animate-rise rounded-3xl bg-surface px-4 py-3 text-[1.0625rem] leading-[1.75] text-ink ring-1 ring-line",
                sample.dir === "rtl" ? "me-auto rounded-ss-md" : "ms-auto rounded-se-md",
              )}
            >
              {sample.segments.map((segment, i) =>
                typeof segment === "string" ? (
                  <span key={i}>{typographic(segment)}</span>
                ) : (
                  <mark
                    key={i}
                    className={cn(
                      "bg-transparent [box-decoration-break:clone] bg-no-repeat text-inherit [-webkit-box-decoration-break:clone]",
                      // The one transition here that is not transform/opacity: the stroke
                      // follows the line breaks, which a scale on a box can't (DESIGN.md).
                      "bg-[linear-gradient(var(--marker),var(--marker))] [background-position:0_80%] transition-[background-size] duration-500 ease-(--ease-out)",
                      sample.dir === "rtl" && "[background-position:100%_80%]",
                      shown > segment.fact ? "bg-[length:100%_0.95em]" : "bg-[length:0%_0.95em]",
                    )}
                  >
                    {typographic(segment.text)}
                  </mark>
                ),
              )}
            </p>
            {/* Drawn composer: the citizen can also answer by voice. */}
            <div
              aria-hidden
              className="flex h-11 items-center justify-between rounded-full bg-surface ps-4 pe-1.5 text-sm text-ink-3 ring-1 ring-line"
            >
              Scrivi o parla, con parole tue
              <span className="grid size-8 place-items-center rounded-full bg-stamp text-on-stamp">
                <Mic className="size-4" />
              </span>
            </div>
          </div>
        </figure>

        <Handoff phase={shown} reduced={reduced} />

        {/* The operator's dossier */}
        <div data-ui className="relative min-w-0">
          <section
            aria-label="Fascicolo per l’operatore"
            className="relative overflow-hidden rounded-[14px] bg-surface text-ink"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line px-5 py-4 pe-28 sm:pe-32">
              <p className="font-display text-lg font-semibold">Fascicolo per l’operatore</p>
              {/* The case code is real product data, set as the console sets it. */}
              <span className="font-mono text-xs whitespace-nowrap text-ink-3">AV-2027-000318</span>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 px-5 py-4 text-body-sm">
              {FACTS.map((fact, i) => (
                <div key={fact.key} className="contents">
                  <dt className="text-ink-3">{fact.key}</dt>
                  <dd className="relative min-w-0">
                    {shown === i + 1 && !reduced && (
                      <span
                        aria-hidden
                        className="land-flash absolute -inset-x-2 -inset-y-0.5 rounded-xs bg-marker/45"
                      />
                    )}
                    <span
                      aria-hidden
                      className={cn(
                        "absolute inset-y-1 start-0 w-28 rounded-xs bg-sunk transition-opacity duration-200",
                        shown > i ? "opacity-0" : "opacity-100",
                      )}
                    />
                    <span
                      className={cn(
                        "relative block font-semibold transition-[opacity,transform] duration-300 ease-(--ease-out)",
                        shown > i ? "translate-x-0 opacity-100" : "-translate-x-1.5 opacity-0",
                      )}
                    >
                      {fact.value}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
            <ul className="relative grid gap-2 border-t border-line px-5 pt-4 pb-16 text-body-sm sm:pb-4">
              {CHECKLIST.map((item, i) => {
                const ticked = shown > FACTS_END + i;
                return (
                  <li key={item.label} className="flex items-start gap-2.5">
                    <span className="relative mt-0.5 grid size-4 shrink-0 place-items-center">
                      {!ticked && (
                        <span
                          aria-hidden
                          className="size-3.5 rounded-full ring-1 ring-line-strong"
                        />
                      )}
                      {ticked &&
                        (item.state === "ok" ? (
                          <Check className="tick-in size-4 text-ok" aria-label="Presente" />
                        ) : (
                          <FileWarning
                            className={cn("tick-in size-4", MISSING.operator.text)}
                            aria-label="Manca"
                          />
                        ))}
                    </span>
                    <span
                      className={cn(
                        "transition-colors duration-300",
                        !ticked && "text-ink-3",
                        ticked && item.state === "missing" && "font-semibold text-ink",
                        ticked && item.state === "ok" && "text-ink-2",
                      )}
                    >
                      {item.label}
                    </span>
                  </li>
                );
              })}
              {done && (
                <Stamp
                  pressed={!reduced}
                  className="pointer-events-none absolute end-4 bottom-3 text-[0.6875rem] [--stamp-rotate:-9deg] sm:end-6 sm:top-3 sm:bottom-auto"
                >
                  <span>Consegnato</span>
                  <span className="mt-0.5">allo sportello</span>
                </Stamp>
              )}
            </ul>
            <div
              className={cn(
                "flex items-center gap-2 px-5 py-3 text-sm transition-[opacity,transform] duration-500 ease-(--ease-out)",
                MISSING.operator.wash,
                MISSING.operator.text,
                done ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
              )}
              aria-hidden={!done}
            >
              <FileWarning className="size-4 shrink-0" aria-hidden />
              Manca 1 documento: già chiesto al cittadino, nella sua lingua.
            </div>
          </section>
          {/* The paper number of the queue, laid on the dossier: the shape of the logo. */}
          <QueueTicket
            number="A 318"
            label="In coda"
            className="absolute -end-1 -top-5 z-10 origin-top-right scale-[0.82] rotate-[4deg] sm:-end-3 sm:scale-95"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * The step between the two cards: the brand chevron on a marker disc. While facts are being
 * read, each one sends a dot across (keyed by phase, so the animation restarts) and the chevron
 * gives a small push. Decorative; horizontal from md, vertical when stacked.
 */
function Handoff({ phase, reduced }: { phase: number; reduced: boolean }) {
  const moving = !reduced && phase > 0 && phase <= FACTS_END;
  return (
    <div aria-hidden className="relative mx-auto grid h-16 w-10 place-items-center md:h-10 md:w-16">
      {moving && <span key={phase} className="flow-dot absolute size-2.5 rounded-full bg-marker" />}
      <span
        key={moving ? `p${phase}` : "rest"}
        className={cn(
          "relative grid size-10 place-items-center rounded-full bg-marker text-stamp",
          moving && "flow-pulse",
        )}
      >
        <svg viewBox="11 9 9.5 14" className="h-4 w-3 rotate-90 md:rotate-0 rtl:md:-scale-x-100">
          <path
            d={CHEVRON_PATH}
            fill="none"
            stroke="var(--stamp)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </div>
  );
}
