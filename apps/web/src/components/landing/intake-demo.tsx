"use client";

import { AlertTriangle, Check, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

const STEP_MS = 620;
// Phase 0 = sentence only, 1..5 = facts highlighted one by one, 6 = dossier visible.
const LAST_PHASE = FACTS.length + 1;

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
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || reduced) return;
    const timers = Array.from({ length: LAST_PHASE }, (_, i) =>
      window.setTimeout(() => setPhase(i + 1), 500 + i * STEP_MS),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [visible, reduced, sampleIndex, run]);

  const replay = () => {
    setPhase(0);
    setRun((r) => r + 1);
  };

  const sample = SAMPLES[sampleIndex] ?? SAMPLES[0]!;
  // Reduced motion: show the finished dossier straight away, no sequence.
  const shown = reduced ? LAST_PHASE : phase;
  const done = shown >= LAST_PHASE;

  return (
    <div ref={rootRef} className="relative">
      <div
        role="group"
        aria-label="Lingua dell'esempio"
        className="mb-3 flex flex-wrap items-center gap-1"
      >
        {/* font-sans on the labels: one word in Arabic or Bengali reads fine in the system font,
            and would otherwise fetch 270 KB of Noto above the fold. The sample text keeps Noto. */}
        {SAMPLES.map((s, i) => (
          <button
            key={s.lang}
            type="button"
            lang={s.lang}
            aria-pressed={i === sampleIndex}
            onClick={() => {
              setSampleIndex(i);
              replay();
            }}
            className={cn(
              "h-8 rounded-full px-3 font-sans text-sm transition-colors duration-150",
              i === sampleIndex ? "bg-ink text-white" : "text-ink-2 hover:bg-sunk hover:text-ink",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <figure className="rounded-xl bg-surface p-5 shadow-raised ring-1 ring-line sm:p-6">
        <figcaption className="mb-3 flex items-center justify-between text-sm text-ink-3">
          <span>Il cittadino scrive, a modo suo</span>
          {done && !reduced && (
            <button
              type="button"
              onClick={replay}
              className="-m-1.5 inline-flex animate-fade-in items-center gap-1 rounded-sm p-1.5 text-ink-3 hover:text-ink"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Rivedi
            </button>
          )}
        </figcaption>
        <p
          key={sample.lang}
          lang={sample.lang}
          dir={sample.dir}
          className="animate-fade-in text-[1.1875rem] leading-[1.7] text-ink sm:text-xl"
        >
          {sample.segments.map((segment, i) =>
            typeof segment === "string" ? (
              <span key={i}>{segment}</span>
            ) : (
              <mark
                key={i}
                className={cn(
                  "bg-transparent [box-decoration-break:clone] bg-no-repeat text-inherit [-webkit-box-decoration-break:clone]",
                  "bg-[linear-gradient(var(--marker),var(--marker))] [background-position:0_78%] transition-[background-size] duration-500 ease-(--ease-out)",
                  sample.dir === "rtl" && "[background-position:100%_78%]",
                  shown > segment.fact ? "bg-[length:100%_0.9em]" : "bg-[length:0%_0.9em]",
                )}
              >
                {segment.text}
              </mark>
            ),
          )}
        </p>
      </figure>

      <div
        aria-hidden
        className="mx-auto h-6 w-px bg-[repeating-linear-gradient(to_bottom,var(--line-strong)_0_4px,transparent_4px_8px)]"
      />

      <section
        aria-label="Fascicolo per l'operatore"
        className="relative rounded-xl bg-surface shadow-float ring-1 ring-line"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line px-5 py-4 sm:px-6">
          <p className="font-display text-lg font-semibold tracking-[-0.01em]">
            Fascicolo per l&apos;operatore
          </p>
          <span className="font-mono text-xs whitespace-nowrap text-ink-3">AV-2027-000318</span>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 px-5 py-4 text-[0.9375rem] sm:px-6">
          {FACTS.map((fact, i) => (
            <div key={fact.key} className="contents">
              <dt className="text-ink-3">{fact.key}</dt>
              <dd className="relative">
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-y-1 left-0 w-28 rounded-xs bg-sunk transition-opacity duration-200",
                    shown > i ? "opacity-0" : "opacity-100",
                  )}
                />
                <span
                  className={cn(
                    "relative block font-semibold transition-[opacity,transform] duration-300 ease-(--ease-out)",
                    shown > i ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
                  )}
                >
                  {fact.value}
                </span>
              </dd>
            </div>
          ))}
        </dl>
        <ul
          className={cn(
            "grid gap-2 border-t border-dashed border-line px-5 py-4 text-[0.9375rem] transition-opacity duration-500 sm:px-6",
            done ? "opacity-100" : "opacity-0",
          )}
          aria-hidden={!done}
        >
          {CHECKLIST.map((item) => (
            <li key={item.label} className="flex items-start gap-2.5">
              {item.state === "ok" ? (
                <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-label="Presente" />
              ) : (
                <AlertTriangle
                  className="mt-0.5 size-4 shrink-0 text-warn"
                  aria-label="Da completare"
                />
              )}
              <span className={item.state === "warn" ? "font-semibold text-ink" : "text-ink-2"}>
                {item.label}
              </span>
            </li>
          ))}
        </ul>
        <div
          className={cn(
            "flex items-center justify-between gap-3 rounded-b-xl bg-warn-wash px-5 py-3 text-sm text-warn transition-opacity duration-500 sm:px-6",
            done ? "opacity-100" : "opacity-0",
          )}
          aria-hidden={!done}
        >
          <span>Manca 1 documento: già chiesto al cittadino, nella sua lingua.</span>
        </div>
      </section>
    </div>
  );
}
