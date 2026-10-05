"use client";

import { AlertTriangle, Check, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { usePrefersReducedMotion } from "@/lib/hooks/use-media-query";

type Segment = string | { text: string; fact: number };

type Sample = {
  lang: string;
  label: string;
  dir: "ltr" | "rtl";
  segments: Segment[];
};

/** What the operator reads: always Italian, whatever language the citizen used. */
const FACTS = [
  { key: "Pratica", value: "ISEE ordinario 2027" },
  { key: "Nucleo", value: "Richiedente e madre" },
  { key: "Padre", value: "Non convivente" },
  { key: "Rapporti finanziari", value: "1 conto Fineco" },
  { key: "Veicoli", value: "1 auto" },
] as const;

const SAMPLES: Sample[] = [
  {
    lang: "it",
    label: "Italiano",
    dir: "ltr",
    segments: [
      "Devo ",
      { text: "fare l'ISEE", fact: 0 },
      ", ",
      { text: "vivo con mia madre", fact: 1 },
      ", ",
      { text: "mio padre non vive con noi", fact: 2 },
      ", ho ",
      { text: "un conto Fineco", fact: 3 },
      " e ",
      { text: "una macchina", fact: 4 },
      ".",
    ],
  },
  {
    lang: "bn",
    label: "বাংলা",
    dir: "ltr",
    segments: [
      "আমাকে ",
      { text: "ISEE করতে হবে", fact: 0 },
      ", আমি ",
      { text: "আমার মায়ের সাথে থাকি", fact: 1 },
      ", ",
      { text: "আমার বাবা আমাদের সাথে থাকেন না", fact: 2 },
      ", আমার ",
      { text: "একটি Fineco অ্যাকাউন্ট", fact: 3 },
      " আর ",
      { text: "একটি গাড়ি", fact: 4 },
      " আছে।",
    ],
  },
  {
    lang: "ar",
    label: "العربية",
    dir: "rtl",
    segments: [
      "أحتاج إلى ",
      { text: "عمل الـ ISEE", fact: 0 },
      "، ",
      { text: "أعيش مع أمي", fact: 1 },
      "، و",
      { text: "أبي لا يعيش معنا", fact: 2 },
      "، لدي ",
      { text: "حساب في Fineco", fact: 3 },
      " و",
      { text: "سيارة", fact: 4 },
      ".",
    ],
  },
  {
    lang: "uk",
    label: "Українська",
    dir: "ltr",
    segments: [
      "Мені потрібно ",
      { text: "зробити ISEE", fact: 0 },
      ", я ",
      { text: "живу з мамою", fact: 1 },
      ", ",
      { text: "тато з нами не живе", fact: 2 },
      ", у мене є ",
      { text: "рахунок у Fineco", fact: 3 },
      " і ",
      { text: "машина", fact: 4 },
      ".",
    ],
  },
  {
    lang: "en",
    label: "English",
    dir: "ltr",
    segments: [
      "I need to ",
      { text: "do the ISEE", fact: 0 },
      ". I ",
      { text: "live with my mother", fact: 1 },
      ", ",
      { text: "my father doesn't live with us", fact: 2 },
      ", I have ",
      { text: "a Fineco account", fact: 3 },
      " and ",
      { text: "a car", fact: 4 },
      ".",
    ],
  },
];

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
              "h-8 rounded-full px-3 text-sm transition-colors duration-150",
              i === sampleIndex ? "bg-ink text-white" : "text-ink-2 hover:bg-sunk hover:text-ink",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <figure className="bg-surface shadow-raised ring-line rounded-xl p-5 ring-1 sm:p-6">
        <figcaption className="text-ink-3 mb-3 flex items-center justify-between text-sm">
          <span>Il cittadino scrive, a modo suo</span>
          {done && !reduced && (
            <button
              type="button"
              onClick={replay}
              className="text-ink-3 animate-fade-in hover:text-ink -m-1.5 inline-flex items-center gap-1 rounded-sm p-1.5"
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
          className="animate-fade-in text-ink text-[1.1875rem] leading-[1.7] sm:text-xl"
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
        className="bg-surface shadow-float ring-line relative rounded-xl ring-1"
      >
        <div className="border-line flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b px-5 py-4 sm:px-6">
          <h3 className="font-display text-lg font-semibold tracking-[-0.01em]">
            Fascicolo per l&apos;operatore
          </h3>
          <span className="text-ink-3 font-mono text-xs whitespace-nowrap">AV-2027-000318</span>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 px-5 py-4 text-[0.9375rem] sm:px-6">
          {FACTS.map((fact, i) => (
            <div key={fact.key} className="contents">
              <dt className="text-ink-3">{fact.key}</dt>
              <dd className="relative">
                <span
                  aria-hidden
                  className={cn(
                    "bg-sunk absolute inset-y-1 left-0 w-28 rounded-xs transition-opacity duration-200",
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
            "border-line grid gap-2 border-t border-dashed px-5 py-4 text-[0.9375rem] transition-opacity duration-500 sm:px-6",
            done ? "opacity-100" : "opacity-0",
          )}
          aria-hidden={!done}
        >
          {CHECKLIST.map((item) => (
            <li key={item.label} className="flex items-start gap-2.5">
              {item.state === "ok" ? (
                <Check className="text-ok mt-0.5 size-4 shrink-0" aria-label="Presente" />
              ) : (
                <AlertTriangle
                  className="text-warn mt-0.5 size-4 shrink-0"
                  aria-label="Da completare"
                />
              )}
              <span className={item.state === "warn" ? "text-ink font-semibold" : "text-ink-2"}>
                {item.label}
              </span>
            </li>
          ))}
        </ul>
        <div
          className={cn(
            "bg-warn-wash text-warn flex items-center justify-between gap-3 rounded-b-xl px-5 py-3 text-sm transition-opacity duration-500 sm:px-6",
            done ? "opacity-100" : "opacity-0",
          )}
        >
          <span>Manca 1 documento: già chiesto al cittadino, nella sua lingua.</span>
        </div>
      </section>
    </div>
  );
}
