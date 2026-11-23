import type { Metadata } from "next";
import Link from "next/link";
import { Fragment, type CSSProperties } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { ActivityLog } from "@/components/landing/activity-log";
import { AiSwitches } from "@/components/landing/ai-switches";
import { HowItWorks } from "@/components/landing/how-it-works";
import { IntakeDemo } from "@/components/landing/intake-demo";
import { OperatorShowcase } from "@/components/landing/operator-showcase";
import { PeakFigure } from "@/components/landing/peak-figure";
import { PilotForm } from "@/components/landing/pilot-form";
import { cn } from "@/lib/cn";

const DESCRIPTION =
  "Avanti prepara le pratiche ISEE prima dell’appuntamento: il cittadino risponde dal telefono, anche nella sua lingua, e l’operatore del CAF trova un fascicolo ordinato con quello che manca già segnalato. La pratica resta all’operatore.";

export const metadata: Metadata = {
  title: { absolute: "Avanti — il fascicolo ISEE arriva pronto allo sportello del CAF" },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { title: "Avanti — il fascicolo arriva pronto", description: DESCRIPTION, url: "/" },
  twitter: { card: "summary_large_image" },
};

// Public demo office (seeded, fictitious data). Unset in environments without demo data.
const DEMO_OFFICE = process.env.NEXT_PUBLIC_DEMO_OFFICE_SLUG;

/** Split by word: each one rises on its own (site.css, .hero-word). */
const HERO_TITLE = ["Il", "fascicolo", "arriva", "pronto."] as const;

const HERO_FACTS = [
  "Nessun invio all’INPS",
  "Il CAF resta titolare dei dati",
  /* DA DECIDERE: gratuità del pilota fino al 31 marzo 2027 (docs/gtm/pilota.md è una proposta
     da approvare). Confermare prima di pubblicare. */
  "Gratis per i CAF pilota fino al 31 marzo 2027",
] as const;

// Verified figures only, with year and primary source (see docs/research/market.md).
const SOURCES = {
  caf: {
    label: "Ministero del Lavoro, Rapporto ISEE 2024",
    href: "https://lavoro.gov.it/documenti-e-norme/studi-e-statistiche/rapporto-isee-2024",
  },
  quarter: {
    label: "INPS, Osservatorio DSU e ISEE, febbraio 2026",
    href: "https://www.inps.it/it/it/inps-comunica/notizie/dettaglio-news-page.news.2026.02.osservatorio-su-dsu-e-isee-i-dati-2016-2025.html",
  },
} as const;

const NEXT_PRACTICES = ["Modello 730", "Assegno unico", "permesso di soggiorno"] as const;

// Every line must match docs/SECURITY.md, docs/DEPLOY.md and docs/legal/sub-responsabili.md:
// Frankfurt is the planned pilot region, and the providers' terms are still to be signed.
const DATA_ROWS = [
  [
    ["Titolare", "il vostro CAF", "dei dati e dei fascicoli"],
    ["Responsabile", "Avanti", "art. 28 GDPR, con accordo scritto"],
  ],
  [
    ["Server", "Francoforte, UE", "previsti per il pilota"],
    ["Fornitori", "approvati da voi", "elencati nell’accordo"],
  ],
  [
    ["Accessi", "tutti registrati", "il registro si esporta"],
    ["AI", "con fornitori approvati", "altrimenti, solo regole"],
    ["Enti", "nessun invio", "la DSU la trasmette il CAF"],
  ],
] as const;

const PILOT_TIMELINE = [
  { when: "Novembre", what: "Mezz’ora di demo e prova nel vostro gestionale" },
  { when: "Dicembre", what: "Accordo sui dati, un’ora di formazione, QR in sala" },
  { when: "Gennaio – marzo", what: "Uso vero nel picco, flusso abituale sempre disponibile" },
  {
    when: "Entro il 31 marzo",
    // DA DECIDERE: «nessun passaggio automatico a pagamento» (proposta in docs/gtm/pilota.md, da approvare).
    what: "Risultati e proposta. Decidete voi: nessun passaggio automatico a pagamento.",
  },
] as const;

/** Widths of the calendar: one per month for the first three steps; the closing step, a
    deadline rather than a span, takes the width of one month. */
const PILOT_MONTHS = [1, 1, 3, 1] as const;
const PILOT_FIELDS = ["bg-folder", "bg-stamp-wash", "bg-stamp text-on-stamp", "bg-marker"] as const;

const FAQ = [
  {
    q: "Cosa ci chiedete in cambio?",
    a: "Un referente che possa autorizzare il nuovo fornitore e un operatore di riferimento; una settimana di misure prima di iniziare, per avere un punto di partenza onesto; il permesso di pubblicare i risultati in forma aggregata. Nome e logo solo se lo autorizzate.",
  },
  {
    q: "Perché sul sito non ci sono loghi né testimonianze?",
    a: "Siamo all’inizio: il pilota serve proprio a raccogliere le prove. Con i primi sportelli misureremo minuti di lavoro, completezza al primo invio e tempo di copia nel gestionale, e pubblicheremo metodo, campione e limiti del risultato, anche se non è quello sperato.",
  },
  {
    q: "Se l’AI sbaglia, chi ne risponde?",
    a: "Nessun documento è accettato o rifiutato dall’AI e nessun importo entra nel prospetto senza la conferma dell’operatore: ogni proposta è etichettata e ha accanto il file da cui viene. La DSU la firmano e la trasmettono il cittadino e il CAF, con le procedure di sempre. Nel pilota contiamo anche gli errori dell’AI, separati per tipo, e li mettiamo nel rapporto.",
  },
  {
    q: "Dove finiscono i dati?",
    a: "Per il pilota prevediamo database e documenti su server a Francoforte, nell’Unione europea. All’AI arriva solo la parte che serve a ogni compito, mai note interne o altri fascicoli. Fornitori, regioni, conservazione dei dati e uso per l’addestramento sono scritti nell’elenco allegato all’accordo e li approvate voi: senza garanzie adeguate, Avanti lavora con le sole regole. Prima del primo cittadino vero firmiamo insieme accordo di nomina, valutazione d’impatto e informativa nelle lingue dello sportello.",
  },
  {
    q: "Funziona con il nostro gestionale?",
    a: "Avanti non lo sostituisce e oggi non si collega in automatico. Dal fascicolo l’operatore copia i dati dal prospetto DSU, già nell’ordine del modello, e scarica in un solo ZIP tutti gli originali rinominati per persona, più il riepilogo in PDF. Prima di partire proviamo insieme il passaggio nel vostro software; i collegamenti diretti li costruiamo con i CAF pilota.",
  },
  {
    q: "Quanto tempo serve agli operatori per imparare?",
    a: "Un’ora di formazione su pratiche di prova: caso completo, documento sbagliato, richiesta d’integrazione, export. La console è in italiano e ha una pagina di aiuto; il primo giorno una lista «Per iniziare» guida l’amministratore passo per passo.",
  },
  {
    q: "E chi non ha lo smartphone o non sa scrivere bene?",
    a: "Le domande sono brevi, con risposte da toccare, e si può rispondere a voce. L’operatore può completare il fascicolo allo sportello insieme al cittadino, oppure stampargli l’elenco dei documenti da portare su un foglio A4, nella sua lingua e in italiano. Lo sportello resta aperto come oggi: nessuno è obbligato a usare Avanti.",
  },
  {
    q: "Il cittadino deve installare qualcosa o registrarsi?",
    a: "No. Riceve un link personale (o inquadra il QR dello sportello) e lo apre dal browser del telefono. Il link scade da solo dopo il periodo stabilito dal CAF.",
  },
  {
    q: "E l’anno dopo, quando l’ISEE scade?",
    a: "L’ISEE vale fino al 31 dicembre. Per il rinnovo l’operatore sceglie le famiglie dell’anno prima e Avanti prepara il nuovo fascicolo con nucleo e documenti ancora validi: il cittadino conferma chi vive con lui e carica solo quello che va aggiornato. L’invito via email parte solo a chi ha dato il consenso.",
  },
  {
    q: "Quanto costa? E se non fa per noi?",
    // DA DECIDERE: gratuità fino al 31 marzo, «vi fermate», «nessun rinnovo automatico»
    // (docs/gtm/pilota.md e prezzi.md sono proposte da approvare). Il prezzo dopo il pilota non
    // è deciso: non citare canoni o modelli finché non lo è.
    a: "Per i CAF pilota è gratuito fino al 31 marzo 2027, intelligenza artificiale inclusa: nessuna chiave da configurare. Il prezzo per continuare non è ancora deciso: entro marzo vi facciamo un’offerta separata, costruita sui risultati misurati nel pilota. Se il pilota non funziona per voi vi fermate: non c’è rinnovo automatico, vi restituiamo i dati e cancelliamo le copie in Avanti.",
  },
] as const;

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Avanti",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  inLanguage: "it",
  description: DESCRIPTION,
  audience: { "@type": "BusinessAudience", name: "CAF e patronati" },
};

function Arrow({ className }: { className?: string }) {
  return (
    <ArrowRight
      className={cn(
        "rtl-flip size-4.5 transition-transform duration-200 ease-(--ease-out) group-hover:translate-x-0.5",
        className,
      )}
      aria-hidden
    />
  );
}

/** A source under a figure: opens the official page in a new tab. */
function Source({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline decoration-[0.07em] underline-offset-[0.2em] transition-opacity hover:opacity-80 focus-visible:outline-marker"
    >
      {label}
      <ArrowUpRight className="ms-0.5 inline size-3.5 align-[-0.1em]" aria-hidden />
      <span className="sr-only"> (si apre in una nuova scheda)</span>
    </a>
  );
}

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        // Static object defined above: no user input reaches it.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

      {/* Hero: the title on paper, the live dossier on a blue stage cut like the ticket. */}
      <section id="hero" aria-labelledby="hero-title" className="relative pb-24 xl:pb-32">
        <div className="frame grid grid-cols-1 gap-x-6 pt-12 sm:pt-16 xl:grid-cols-12 xl:pt-20">
          <h1 id="hero-title" className="t-display xl:col-span-8">
            {/* Screen readers get one sentence: inline-block words can be read one by one. */}
            <span className="sr-only">{HERO_TITLE.join(" ")}</span>
            <span aria-hidden>
              {HERO_TITLE.map((word, i) => (
                <Fragment key={word}>
                  {i > 0 && " "}
                  {i === 2 && <br className="hidden sm:inline" />}
                  <span className="hero-word">
                    <span
                      className={cn(i === HERO_TITLE.length - 1 && "marker-draw")}
                      style={{ "--d": `${80 + i * 60}ms` } as CSSProperties}
                    >
                      {word}
                    </span>
                  </span>
                </Fragment>
              ))}
            </span>
          </h1>

          <div className="mt-8 xl:col-span-4 xl:row-start-2 xl:mt-12 xl:pe-4">
            <p className="hero-in t-lead max-w-[36ch] text-ink [--d:280ms]">
              Per CAF e patronati. Il cittadino prepara l’ISEE dal telefono, nella sua lingua; il
              vostro operatore trova tutto in ordine, con i mancanti in cima.
            </p>
            <a
              href="#pilota"
              className="ticket-btn group hero-in t-body mt-8 inline-flex min-h-13 items-center gap-2.5 rounded-md px-6 font-semibold text-on-stamp transition-transform duration-150 ease-(--ease-out) [--d:360ms] active:scale-[0.98]"
            >
              Parliamo del pilota
              <Arrow className="text-marker" />
            </a>
            <ul className="hero-in t-body mt-8 grid gap-2.5 text-ink [--d:420ms]">
              {HERO_FACTS.map((fact) => (
                <li key={fact} className="flex items-baseline gap-3">
                  <span aria-hidden className="ticket-dot translate-y-[0.06em] text-stamp" />
                  {fact}
                </li>
              ))}
            </ul>
            {DEMO_OFFICE && (
              <p className="hero-in t-body mt-6 [--d:460ms]">
                <Link
                  href={`/s/${DEMO_OFFICE}`}
                  className="font-semibold text-stamp underline decoration-[0.07em] underline-offset-[0.2em]"
                >
                  Prova la demo dal telefono
                </Link>
              </p>
            )}
          </div>

          {/* The stage bleeds off the right edge, past the frame on very wide screens too. */}
          <div
            className={cn(
              "stage-open stage-cut relative mt-14 bg-stamp px-6 pt-8 pb-8 text-on-stamp [--d:520ms] [--notch-y:3.5rem] [--notch:18px] sm:px-10 sm:pt-12 sm:[--notch-y:96px] sm:[--notch:30px] xl:col-span-8 xl:col-start-5 xl:row-start-2 xl:mt-12 xl:rounded-ss-[28px] xl:ps-14 xl:pe-14 xl:pt-14 xl:pb-14",
              "-mx-[var(--site-margin)] xl:ms-0 xl:-me-[calc(var(--site-margin)+max(0px,(100vw-105rem)/2))]",
            )}
          >
            <div className="stage-settle xl:max-w-[54rem]">
              <IntakeDemo />
            </div>
          </div>
        </div>
      </section>

      {/* How it works: one practice across four fields. */}
      <section id="come-funziona" aria-labelledby="come-title" className="scroll-mt-16">
        <HowItWorks titleId="come-title" />
      </section>

      {/* Operators: the names of the dossier's parts and the console laid on the ticket. */}
      <section
        id="operatori"
        data-header="dark"
        aria-labelledby="operatori-title"
        className="scroll-mt-16 bg-contrast text-on-contrast"
      >
        <OperatorShowcase titleId="operatori-title" />
      </section>

      {/* AI: the two switches a CAF has, and what each leaves when it is off. */}
      <section aria-labelledby="ai-title" className="pt-28 xl:pt-40">
        <div data-reveal="stagger" className="frame grid gap-x-6 pb-14 xl:grid-cols-12 xl:pb-16">
          <h2 id="ai-title" className="t-head xl:col-span-7">
            L’AI propone. L’operatore decide.
          </h2>
          <p className="t-lead mt-6 max-w-[40ch] text-ink xl:col-span-4 xl:col-start-9 xl:mt-0 xl:self-end">
            Legge documenti e racconti, accanto a regole scritte con le fonti ufficiali. Nulla parte
            verso gli enti.
          </p>
        </div>
        <AiSwitches />
      </section>

      {/* The peak: the visitor's own number. */}
      <section
        id="pratiche"
        data-header="stamp"
        aria-labelledby="pratiche-title"
        className="ticket scroll-mt-16 bg-stamp text-on-stamp [--notch-y:2.75rem] [--notch:2rem] max-sm:[--notch:1.25rem]"
      >
        <div className="frame grid min-h-[88svh] gap-x-6 py-24 xl:grid-cols-12 xl:py-28">
          <div className="flex flex-col xl:col-span-8">
            <h2 id="pratiche-title" data-reveal className="t-head">
              Quante DSU fate in un anno?
            </h2>
            <p className="t-body mt-5 max-w-[44ch] text-on-stamp">
              In Italia l’85% delle DSU passa da un CAF (<Source {...SOURCES.caf} />
              ), e quasi tutte arrivano nello stesso trimestre.
            </p>
            <PeakFigure />
          </div>
          <div className="mt-10 grid content-end gap-6 xl:col-span-4 xl:col-start-9 xl:mt-0">
            <p className="t-body max-w-[34ch] text-on-stamp">
              Il 71% delle DSU arriva tra gennaio e marzo (<Source {...SOURCES.quarter} />
              ). Il numero grande è quella media nazionale applicata al vostro: non è una
              previsione.
            </p>
            <p className="t-body max-w-[34ch] text-on-stamp">
              <span className="font-semibold">Si parte dall’ISEE ordinario,</span> quando serve di
              più. In preparazione: {NEXT_PRACTICES.join(", ")}.
            </p>
          </div>
        </div>
      </section>

      {/* Data and responsibility: the statement, the table pushed right, the activity log. */}
      <section id="dati" aria-labelledby="dati-title" className="scroll-mt-16 py-28 xl:py-40">
        <div className="frame grid gap-x-6 xl:grid-cols-12">
          <h2 id="dati-title" data-reveal className="t-head xl:col-span-12 xl:ps-[3vw]">
            I dati restano del CAF.
          </h2>
          <div className="mt-14 max-xl:order-last xl:col-span-5 xl:row-start-2 xl:mt-24 xl:self-end">
            <ActivityLog />
          </div>
          <div className="mt-14 xl:col-span-5 xl:col-start-8 xl:row-start-2 xl:mt-24 xl:self-end">
            <div className="grid gap-y-11">
              {DATA_ROWS.map((group, g) => (
                <dl key={g} data-reveal="stagger" className="grid gap-y-5">
                  {group.map(([kind, what, note]) => (
                    <div
                      key={kind}
                      className="t-body grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-0.5 sm:grid-cols-[8rem_minmax(0,1fr)_auto]"
                    >
                      <dt className="text-ink-2 max-sm:col-span-2">{kind}</dt>
                      <dd className="font-semibold text-ink">{what}</dd>
                      <dd className="text-end text-ink-2">{note}</dd>
                    </div>
                  ))}
                </dl>
              ))}
            </div>
            <Link
              href="/sicurezza"
              className="group t-body mt-12 inline-flex min-h-11 items-center gap-2 rounded-sm font-semibold text-stamp"
            >
              Tutti i controlli di sicurezza
              <Arrow className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Pilot: the calendar drawn to scale, then the coupon to send. */}
      <section id="pilota" aria-labelledby="pilota-title" className="scroll-mt-16 pb-28 xl:pb-40">
        <div className="frame">
          <div data-reveal="stagger" className="grid gap-x-6 xl:grid-cols-12">
            {/* DA DECIDERE: gratuità fino al 31 marzo 2027, «potete fermarvi quando volete» e
                tetto di pratiche del pilota (docs/gtm/pilota.md propone 500 fascicoli per sede, da
                approvare). Finché non è deciso il tetto resta «volumi concordati», senza numeri. */}
            <h2 id="pilota-title" className="t-head xl:col-span-7">
              Tre sportelli per il picco di gennaio.
            </h2>
            <p className="t-lead mt-6 max-w-[40ch] text-ink xl:col-span-4 xl:col-start-9 xl:mt-0 xl:self-end">
              Gratis fino al 31 marzo 2027, intelligenza artificiale inclusa, con volumi concordati
              prima di partire. Potete fermarvi quando volete.
            </p>
          </div>

          <ol data-ui data-reveal="stagger" className="mt-16 grid gap-1.5 md:flex">
            {PILOT_TIMELINE.map((step, i) => (
              <li
                key={step.when}
                style={{ flexGrow: PILOT_MONTHS[i] } as CSSProperties}
                className="flex min-w-0 flex-col md:basis-0"
              >
                <span
                  className={cn(
                    "t-lead flex min-h-16 items-start rounded-[6px] px-5 pt-4 font-display font-semibold md:min-h-[12rem]",
                    PILOT_FIELDS[i],
                  )}
                >
                  {step.when}
                </span>
                <span className="t-body mt-3 mb-4 max-w-[26ch] text-ink md:mb-0 md:pe-3">
                  {step.what}
                </span>
              </li>
            ))}
          </ol>

          <div data-reveal className="mt-24 xl:mt-32">
            <PilotForm />
          </div>
        </div>
      </section>

      {/* FAQ: the heading holds while the tiles pass; one tile open at a time. */}
      <section aria-labelledby="faq-title" className="bg-surface py-28 xl:py-40">
        <div className="frame grid gap-x-6 gap-y-12 xl:grid-cols-12">
          <div className="xl:col-span-4">
            <h2 id="faq-title" className="t-head xl:sticky xl:top-24">
              Domande dei CAF
            </h2>
          </div>
          <div data-reveal="stagger" className="grid gap-2 xl:col-span-8">
            {FAQ.map((item) => (
              <details
                key={item.q}
                name="faq"
                className="group rounded-[14px] bg-sunk transition-colors duration-200 open:bg-stamp open:text-on-stamp"
              >
                <summary className="t-lead flex min-h-[4.5rem] cursor-pointer list-none items-center justify-between gap-6 rounded-[14px] px-6 py-4 font-medium focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span aria-hidden className="relative size-4 shrink-0">
                    <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-current" />
                    <span className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 rounded-full bg-current transition-transform duration-200 ease-(--ease-out) group-open:rotate-90" />
                  </span>
                </summary>
                <p className="t-body max-w-[56ch] animate-rise px-6 pb-7">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* The close: the counter's call, the whole band one link. */}
      <section id="chiusura" aria-labelledby="chiusura-title">
        <a
          href="#pilota"
          data-header="stamp"
          className="call-band ticket group relative flex min-h-[46svh] flex-col justify-between overflow-clip transition-colors duration-150 [--notch-y:50%] [--notch:2.5rem] focus-visible:outline-none max-sm:[--notch:1.25rem] sm:min-h-[60svh]"
        >
          <span className="frame flex items-start justify-between gap-6 pt-8 sm:pt-10">
            <span id="chiusura-title" className="call-sentence t-lead max-w-[26ch] font-semibold">
              Mezz’ora per capire se fa per voi. Parliamo del pilota.
            </span>
            <svg
              aria-hidden
              viewBox="0 0 48 48"
              className="call-arrow size-8 shrink-0 sm:size-12"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 36 36 12M16 12h20v20" />
            </svg>
          </span>
          <span
            aria-hidden
            className="frame block font-display text-[clamp(5.5rem,34vw,36rem)] leading-[0.86] font-extrabold tracking-[-0.03em] [font-stretch:92%]"
          >
            <span className="block pt-[0.04em] pb-[max(1.5rem,0.08em)]">Avanti</span>
          </span>
        </a>
      </section>
    </>
  );
}
