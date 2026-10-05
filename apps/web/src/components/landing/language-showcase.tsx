"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

const QUESTIONS = [
  {
    lang: "it",
    itName: "Italiano",
    name: "Italiano",
    dir: "ltr",
    q: "Con chi vivi?",
    help: "Conta tutte le persone che hanno la tua stessa residenza, anche se non sono parenti.",
    options: ["Da solo o da sola", "Con altre persone"],
  },
  {
    lang: "bn",
    itName: "Bengalese",
    name: "বাংলা",
    dir: "ltr",
    q: "আপনি কার সাথে থাকেন?",
    help: "আপনার একই ঠিকানায় নিবন্ধিত সবাইকে গণনা করুন, আত্মীয় না হলেও।",
    options: ["একা", "অন্যদের সাথে"],
  },
  {
    lang: "ar",
    itName: "Arabo",
    name: "العربية",
    dir: "rtl",
    q: "مع من تعيش؟",
    help: "احسب كل الأشخاص المسجلين في نفس عنوان إقامتك، حتى لو لم يكونوا أقارب.",
    options: ["وحدي", "مع أشخاص آخرين"],
  },
  {
    lang: "uk",
    itName: "Ucraino",
    name: "Українська",
    dir: "ltr",
    q: "З ким ти живеш?",
    help: "Порахуй усіх, хто зареєстрований за твоєю адресою, навіть якщо це не родичі.",
    options: ["Сам або сама", "З іншими людьми"],
  },
  {
    lang: "ro",
    itName: "Rumeno",
    name: "Română",
    dir: "ltr",
    q: "Cu cine locuiești?",
    help: "Numără toate persoanele care au aceeași reședință ca tine, chiar dacă nu sunteți rude.",
    options: ["Singur sau singură", "Cu alte persoane"],
  },
  {
    lang: "es",
    itName: "Spagnolo",
    name: "Español",
    dir: "ltr",
    q: "¿Con quién vives?",
    help: "Cuenta a todas las personas empadronadas en tu misma dirección, aunque no sean familiares.",
    options: ["Solo o sola", "Con otras personas"],
  },
  {
    lang: "fr",
    itName: "Francese",
    name: "Français",
    dir: "ltr",
    q: "Avec qui vis-tu ?",
    help: "Compte toutes les personnes qui ont la même résidence que toi, même si ce ne sont pas des proches.",
    options: ["Seul ou seule", "Avec d'autres personnes"],
  },
  {
    lang: "en",
    itName: "Inglese",
    name: "English",
    dir: "ltr",
    q: "Who do you live with?",
    help: "Count everyone registered at your address, even if they are not relatives.",
    options: ["On my own", "With other people"],
  },
] as const;

export function LanguageShowcase() {
  const [active, setActive] = useState(1);
  const current = QUESTIONS[active] ?? QUESTIONS[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,15rem)_1fr] lg:gap-10">
      <div role="tablist" aria-label="Lingua" className="-mx-1 flex flex-wrap gap-1 lg:flex-col">
        {QUESTIONS.map((item, i) => (
          <button
            key={item.lang}
            role="tab"
            id={`lang-tab-${item.lang}`}
            aria-selected={i === active}
            aria-controls="lang-panel"
            tabIndex={i === active ? 0 : -1}
            lang={item.lang}
            onClick={() => setActive(i)}
            onKeyDown={(e) => {
              const delta =
                e.key === "ArrowDown" || e.key === "ArrowRight"
                  ? 1
                  : e.key === "ArrowUp" || e.key === "ArrowLeft"
                    ? -1
                    : 0;
              if (!delta) return;
              e.preventDefault();
              const next = (i + delta + QUESTIONS.length) % QUESTIONS.length;
              setActive(next);
              document.getElementById(`lang-tab-${QUESTIONS[next]!.lang}`)?.focus();
            }}
            className={cn(
              "rounded-sm px-3 py-2 text-left text-base transition-colors duration-150 lg:py-2.5",
              i === active
                ? "bg-surface font-semibold text-ink shadow-raised ring-1 ring-line"
                : "text-ink-2 hover:text-ink",
            )}
          >
            {item.name}
          </button>
        ))}
      </div>

      <div
        id="lang-panel"
        role="tabpanel"
        aria-labelledby={`lang-tab-${current.lang}`}
        className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-stretch"
      >
        <div
          key={current.lang}
          lang={current.lang}
          dir={current.dir}
          className="animate-rise rounded-xl bg-surface p-6 shadow-raised ring-1 ring-line"
        >
          <p className="mb-4 text-sm text-ink-3" dir="ltr" lang="it">
            Cosa vede il cittadino
          </p>
          <p className="font-display text-2xl font-semibold tracking-[-0.01em]">{current.q}</p>
          <p className="mt-2 text-ink-2">{current.help}</p>
          <div className="mt-5 grid gap-2">
            {current.options.map((option) => (
              <span
                key={option}
                className="rounded-md px-4 py-3 text-ink ring-1 ring-line-strong ring-inset"
              >
                {option}
              </span>
            ))}
          </div>
        </div>
        <div aria-hidden className="hidden items-center text-ink-3 md:flex">
          <svg
            viewBox="0 0 24 24"
            className="size-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M5 12h14m-5-5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="rounded-xl bg-folder/60 p-6 ring-1 ring-folder">
          <p className="mb-4 text-sm text-ink-3">Cosa legge l&apos;operatore</p>
          <dl className="grid gap-3">
            <div>
              <dt className="text-sm text-ink-3">Domanda</dt>
              <dd className="font-semibold">Composizione del nucleo familiare</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-3">Risposta</dt>
              <dd className="font-semibold">3 persone: richiedente, coniuge, figlia</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-3">Lingua del cittadino</dt>
              <dd className="font-semibold" lang="it">
                {current.lang === "it" ? "Italiano" : `${current.itName}, tradotto in italiano`}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
