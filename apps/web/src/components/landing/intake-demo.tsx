"use client";

import { AlertTriangle, Check, Mic, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { QueueTicket, Stamp } from "@/components/brand/desk-objects";
import { cn } from "@/lib/cn";
import { usePrefersReducedMotion } from "@/lib/hooks/use-media-query";
import { SAMPLES } from "./intake-demo-samples";

/** What the operator reads: always Italian, whatever language the citizen used. */
const FACTS = [
  { key: "Pratica", value: "ISEE ordinario 2027" },
  { key: "Nucleo", value: "Richiedente e madre" },
  { key: "Padre", value: "Non convivente" },
  { key: "Rapporti finanziari", value: "1 conto Fineco" },
  { key: "Veicoli", value: "1 auto" },
] as const;

const CHECKLIST: { label: string; state: "ok" | "warn" }[] = [
  { label: "Documenti d'identità di entrambi", state: "ok" },
  { label: "Redditi 2025 di entrambi", state: "ok" },
  { label: "Saldo e giacenza media 2025 del conto Fineco", state: "warn" },
  { label: "Targa dell'auto", state: "ok" },
];

const STEP_MS = 560;
// Phases: 1–5 a phrase is highlighted and its fact lands in the dossier; 6–9 the checklist is
// ticked line by line; 10 the dossier is stamped and the missing document flagged.
const FACTS_END = FACTS.length;
const LAST_PHASE = FACTS_END + CHECKLIST.length + 1;

/**
 * The hero: what a citizen writes, in their own words and language, becoming the dossier the
 * operator opens. Invented data, said so in the caption. The sentences are the ones the
 * extraction is tested on (intake-demo-samples.ts).
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
      window.setTimeout(() => setPhase(i + 1), 700 + i * STEP_MS),
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
    <div
      ref={rootRef}
      className="grid items-start gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-center lg:gap-10"
    >
      {/* The citizen's screen */}
      <div className="min-w-0">
        <div
          role="group"
          aria-label="Lingua dell'esempio"
          className="-mx-1 mb-3 flex [scrollbar-width:none] items-center gap-1 overflow-x-auto px-1 py-0.5"
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
                "h-10 shrink-0 rounded-full px-3.5 font-sans text-sm transition-[background-color,color,transform] duration-150 ease-(--ease-out) active:scale-[0.96]",
                i === sampleIndex
                  ? "bg-contrast text-on-contrast"
                  : "text-ink-2 ring-1 ring-line ring-inset hover:bg-surface hover:text-ink",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <figure className="card-premium relative rounded-[1.75rem] p-2">
          <div className="rounded-[1.25rem] bg-paper ring-1 ring-line/70">
            <figcaption className="flex items-center justify-between border-b border-line px-4 py-3 text-sm">
              <span className="font-semibold text-ink">CAF di prova · ISEE</span>
              <span className="hidden text-ink-3 sm:inline">Il cittadino, dal telefono</span>
            </figcaption>
            <div className="grid min-h-[13.5rem] content-between gap-6 px-4 pt-5 pb-4 sm:min-h-[12rem]">
              <p
                key={`${sample.lang}-${run}`}
                lang={sample.lang}
                dir={sample.dir}
                className={cn(
                  "w-fit max-w-[95%] animate-rise rounded-3xl bg-surface px-4 py-3 text-[1.125rem] leading-[1.75] text-ink shadow-raised ring-1 ring-line sm:text-[1.1875rem]",
                  sample.dir === "rtl" ? "me-auto rounded-ss-md" : "ms-auto rounded-se-md",
                )}
              >
                {sample.segments.map((segment, i) =>
                  typeof segment === "string" ? (
                    <span key={i}>{segment}</span>
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
                      {segment.text}
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
          </div>
        </figure>
      </div>

      {/* The operator's dossier, on a small stack of sheets */}
      <div className="min-w-0">
        <div className="relative">
          <div
            aria-hidden
            className="absolute inset-x-3 top-3 -bottom-2.5 rotate-[1.4deg] rounded-xl bg-surface shadow-raised ring-1 ring-line"
          />
          <div
            aria-hidden
            className="absolute inset-x-1.5 top-1.5 -bottom-1 -rotate-[0.8deg] rounded-xl bg-surface ring-1 ring-line"
          />
          <QueueTicket
            number="A 318"
            label="In coda"
            className="absolute -end-2 -top-6 z-10 origin-top-right scale-[0.82] rotate-[4deg] [--notch:color-mix(in_srgb,var(--sunk)_70%,var(--paper))] sm:-end-4 sm:-top-5 sm:scale-100"
          />

          <section
            aria-label="Fascicolo per l'operatore"
            className="card-premium relative overflow-hidden rounded-xl"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line px-5 py-4 pe-28 sm:px-6 sm:pe-32">
              <p className="font-display text-lg font-semibold">Fascicolo per l&apos;operatore</p>
              <span className="font-mono text-xs whitespace-nowrap text-ink-3">AV-2027-000318</span>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 px-5 py-4 text-body-sm sm:px-6">
              {FACTS.map((fact, i) => (
                <div key={fact.key} className="contents">
                  <dt className="text-ink-3">{fact.key}</dt>
                  <dd className="relative min-w-0">
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
            <ul className="relative grid gap-2 border-t border-dashed border-line px-5 pt-4 pb-16 text-body-sm sm:px-6 sm:pb-4">
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
                          <AlertTriangle
                            className="tick-in size-4 text-warn"
                            aria-label="Da completare"
                          />
                        ))}
                    </span>
                    <span
                      className={cn(
                        "transition-colors duration-300",
                        !ticked && "text-ink-3",
                        ticked && item.state === "warn" && "font-semibold text-ink",
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
                  className="pointer-events-none absolute end-4 bottom-3 text-[0.6875rem] [--stamp-rotate:-9deg] sm:end-6"
                >
                  <span>Consegnato</span>
                  <span className="mt-0.5">allo sportello</span>
                </Stamp>
              )}
            </ul>
            <div
              className={cn(
                "flex items-center gap-2 bg-warn-wash px-5 py-3 text-sm text-warn transition-[opacity,transform] duration-500 ease-(--ease-out) sm:px-6",
                done ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
              )}
              aria-hidden={!done}
            >
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              Manca 1 documento: già chiesto al cittadino, nella sua lingua.
            </div>
          </section>
        </div>

        <p className="relative mt-5 flex min-h-11 items-center justify-between gap-3 text-sm text-ink-3">
          <span>Esempio con dati inventati.</span>
          {done && !reduced && (
            <button
              type="button"
              onClick={replay}
              className="-me-2 inline-flex min-h-11 animate-fade-in items-center gap-1.5 rounded-sm px-2 text-ink-2 transition-colors hover:text-ink"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Rivedi
            </button>
          )}
        </p>
      </div>
    </div>
  );
}
