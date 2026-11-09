"use client";

import { AlertTriangle, Check, FileText, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const STEPS = [
  {
    title: "Racconta",
    body: "Con parole sue, dal telefono, in una delle otto lingue.",
  },
  {
    title: "Conferma",
    body: "Avanti chiede solo quello che manca e ripete cosa ha capito.",
  },
  {
    title: "Carica",
    body: "Foto o PDF. Anno sbagliato o pagina mancante? Lo sa subito.",
  },
  {
    title: "Consegna",
    body: "Il fascicolo arriva in coda, in italiano, con i mancanti in cima.",
  },
] as const;

/* The four pictures: fragments of the real screens, invented data, decorative (the text next to
   them says the same). */

function Phone({ children }: { children: ReactNode }) {
  return (
    <div className="card-premium mx-auto w-full max-w-[24rem] p-2">
      <div className="rounded-[0.75rem] bg-paper">
        <div className="flex items-center justify-between border-b border-line px-4 py-3 text-xs">
          <span className="font-semibold">CAF di prova · ISEE</span>
          <span className="text-ink-3">Dati inventati</span>
        </div>
        <div className="grid min-h-[17rem] content-center gap-3 p-4">{children}</div>
      </div>
    </div>
  );
}

const LANGS = [
  { lang: "ro", text: "Trebuie să fac ISEE, locuiesc cu mama mea." },
  { lang: "uk", text: "Мені потрібно зробити ISEE, я живу з мамою." },
  { lang: "it", text: "Devo fare l'ISEE, vivo con mia madre." },
] as const;

function VisualTell() {
  return (
    <Phone>
      {LANGS.map((item, i) => (
        <p
          key={item.lang}
          lang={item.lang}
          className={cn(
            "ms-auto w-fit max-w-[90%] rounded-2xl rounded-se-md px-3.5 py-2.5 text-sm",
            i === LANGS.length - 1
              ? "bg-surface text-ink shadow-raised ring-1 ring-line"
              : "bg-sunk text-ink-2",
          )}
        >
          {item.text}
        </p>
      ))}
    </Phone>
  );
}

function VisualConfirm() {
  return (
    <Phone>
      <div className="rounded-xl bg-surface p-4 shadow-raised ring-1 ring-stamp/20">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-stamp" />
          Ho capito così
        </p>
        <dl className="mt-2 divide-y divide-line text-sm">
          {(
            [
              ["Persone nel nucleo", "2"],
              ["Casa", "In affitto"],
              ["Conti", "1, Fineco"],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 py-2">
              <dt className="text-ink-3">{k}</dt>
              <dd className="font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 flex h-10 items-center justify-center gap-2 rounded-md bg-stamp text-sm font-semibold text-on-stamp">
          <Check className="size-4" />
          Sì, è giusto
        </p>
      </div>
    </Phone>
  );
}

function VisualUpload() {
  return (
    <Phone>
      {(
        [
          ["Carta d'identità", "Leggibile, valida", "ok"],
          ["Certificazione Unica", "È del 2024: serve la 2026", "warn"],
          ["Estratto conto Fineco", "Manca la pagina 2", "warn"],
        ] as const
      ).map(([name, note, tone]) => (
        <div
          key={name}
          className="flex items-center gap-3 rounded-xl bg-surface p-3 shadow-raised ring-1 ring-line"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sunk">
            <FileText className="size-4 text-ink-3" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{name}</span>
            <span className={cn("block text-xs", tone === "ok" ? "text-ok" : "text-warn")}>
              {note}
            </span>
          </span>
          {tone === "ok" ? (
            <Check className="size-4 shrink-0 text-ok" />
          ) : (
            <AlertTriangle className="size-4 shrink-0 text-warn" />
          )}
        </div>
      ))}
    </Phone>
  );
}

function VisualDeliver() {
  return (
    <div className="card-premium mx-auto w-full max-w-[28rem] overflow-hidden">
      <div className="border-b border-line px-5 py-4">
        <p className="text-xs font-semibold text-stamp">Da revisionare</p>
        <p className="mt-1 font-display text-xl font-semibold">Ioana Popescu</p>
        <p className="text-sm text-ink-3">ISEE ordinario 2027 · 2 persone</p>
      </div>
      <div className="flex gap-2.5 bg-danger-wash/70 px-5 py-3 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
        <span>
          <span className="block font-semibold">Manca 1 documento</span>
          <span className="text-ink-2">Giacenza media 2025 · Fineco</span>
        </span>
      </div>
      <ul className="divide-y divide-line text-sm">
        {["Documenti d'identità", "Redditi 2025", "Visura catastale"].map((label) => (
          <li key={label} className="flex items-center gap-2.5 px-5 py-2.5">
            <Check className="size-4 shrink-0 text-ok" />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}

const VISUALS = [VisualTell, VisualConfirm, VisualUpload, VisualDeliver];

/**
 * The four steps, with the picture held on screen (sticky) and changing as each step is read.
 * On a phone each step carries its own picture instead.
 */
export function HowItWorks() {
  const [active, setActive] = useState(0);
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.step));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    stepRefs.current.forEach((node) => node && observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="grid gap-16 lg:grid-cols-2 lg:gap-20">
      <div className="relative">
        {/* Progress rail: fills step by step as each one is read (desktop, where the picture
            stays put and the rail is what says how far along you are). */}
        <div aria-hidden className="absolute inset-y-[18vh] -start-8 hidden w-px bg-line lg:block">
          <div
            className="h-full w-full origin-top bg-stamp transition-transform duration-700 ease-(--ease-out)"
            style={{ transform: `scaleY(${(active + 1) / STEPS.length})` }}
          />
        </div>
        <ol className="grid gap-16 lg:gap-0 lg:py-[18vh]">
          {STEPS.map((step, i) => {
            const Visual = VISUALS[i]!;
            return (
              <li
                key={step.title}
                ref={(node) => {
                  stepRefs.current[i] = node;
                }}
                data-step={i}
                // Inactive steps are dimmed with colour, not opacity: they stay readable (AA).
                data-active={i === active || undefined}
                className="group lg:flex lg:min-h-[52vh] lg:flex-col lg:justify-center"
              >
                <p className="tabular inline-grid h-7 min-w-10 place-items-center self-start rounded-full bg-stamp-wash px-2.5 font-mono text-sm text-stamp transition-[background-color,color] duration-500 lg:bg-sunk lg:text-ink-3 lg:group-data-active:bg-stamp lg:group-data-active:text-on-stamp">
                  0{i + 1}
                </p>
                <h3 className="mt-3 font-display text-[clamp(2rem,3.6vw,3rem)] leading-[1.02] font-semibold tracking-[-0.008em] transition-colors duration-500 lg:text-ink-3 lg:group-data-active:text-ink">
                  {step.title}
                </h3>
                <p className="mt-3 max-w-sm type-lead text-ink-2 transition-colors duration-500 lg:text-ink-3 lg:group-data-active:text-ink-2">
                  {step.body}
                </p>
                <div aria-hidden className="glow mt-10 lg:hidden">
                  <Visual />
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <div aria-hidden className="hidden lg:block">
        <div className="glow sticky top-[calc(50vh-15rem)] grid h-[30rem] place-items-center">
          <div className="absolute start-1/2 -top-2 flex -translate-x-1/2 gap-1.5 rtl:translate-x-1/2">
            {STEPS.map((step, i) => (
              <span
                key={step.title}
                className={cn(
                  "h-1 w-8 rounded-full transition-colors duration-500",
                  i === active ? "bg-stamp" : i < active ? "bg-stamp/40" : "bg-line-strong",
                )}
              />
            ))}
          </div>
          {VISUALS.map((Visual, i) => (
            <div
              key={i}
              className={cn(
                "col-start-1 row-start-1 w-full transition-[opacity,transform] duration-500 ease-(--ease-out)",
                i === active
                  ? "translate-y-0 scale-100 opacity-100"
                  : i < active
                    ? "pointer-events-none -translate-y-4 scale-[0.97] opacity-0"
                    : "pointer-events-none translate-y-4 scale-[0.97] opacity-0",
              )}
            >
              <Visual />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
