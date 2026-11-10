import type { Metadata } from "next";
import Link from "next/link";
import { Fragment, type CSSProperties } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  Check,
  FileArchive,
  FileWarning,
  History,
  MessageSquareText,
  ServerCog,
} from "lucide-react";
import { QueueTicket } from "@/components/brand/desk-objects";
import { OperatorSnippet } from "@/components/landing/ai-snippets";
import { CountUp } from "@/components/landing/count-up";
import { DossierPreview } from "@/components/landing/dossier-preview";
import { HowItWorks } from "@/components/landing/how-it-works";
import { IntakeDemo } from "@/components/landing/intake-demo";
import { PilotForm } from "@/components/landing/pilot-form";
import { SectionIntro } from "@/components/landing/section-intro";
import { SpotlightGrid } from "@/components/landing/spotlight-grid";
import { Button } from "@/components/ui/button";
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

/** Desk work Avanti takes off the operator: three shipped console features. */
const OPERATOR_FEATURES = [
  { icon: FileWarning, text: "Mancanti in cima, per persona" },
  { icon: MessageSquareText, text: "Integrazioni nella sua lingua" },
  { icon: FileArchive, text: "Originali in un solo ZIP" },
] as const;

const AI_POINTS = [
  "Ogni proposta è etichettata",
  "Nulla parte verso gli enti",
  "Senza AI, funziona con le regole",
] as const;

// Verified figures only, with year and primary source (see docs/research/market.md).
const FACTS = [
  {
    value: 85,
    label: "delle DSU passa da un CAF",
    source: "Ministero del Lavoro, Rapporto ISEE 2024",
    href: "https://lavoro.gov.it/documenti-e-norme/studi-e-statistiche/rapporto-isee-2024",
  },
  {
    value: 71,
    label: "arriva nel primo trimestre",
    source: "INPS, Osservatorio DSU e ISEE, febbraio 2026",
    href: "https://www.inps.it/it/it/inps-comunica/notizie/dettaglio-news-page.news.2026.02.osservatorio-su-dsu-e-isee-i-dati-2016-2025.html",
  },
] as const;

const NEXT_PRACTICES = ["Modello 730", "Assegno unico", "Permesso di soggiorno"] as const;

// Every line must match docs/SECURITY.md, docs/DEPLOY.md and docs/legal/sub-responsabili.md:
// Frankfurt is the planned pilot region, and the providers' terms are still to be signed.
const DATA_FACTS = [
  {
    icon: Building2,
    title: "Il CAF resta titolare",
    body: "Avanti è responsabile del trattamento (art. 28 GDPR).",
  },
  {
    icon: ServerCog,
    title: "Server UE, previsti per il pilota",
    body: "A Francoforte: fornitori e regioni scritti nell’accordo.",
  },
  {
    icon: History,
    title: "Ogni accesso registrato",
    body: "Il responsabile del CAF consulta ed esporta il registro.",
  },
  {
    icon: BadgeCheck,
    title: "Fornitori approvati da voi",
    body: "Senza garanzie adeguate, Avanti lavora senza AI.",
  },
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

/** «85 out of 100», drawn: a 10×10 figure whose squares fill in order when it comes into view. */
function HundredGrid({ value }: { value: number }) {
  return (
    <span aria-hidden className="mb-2 grid shrink-0 grid-cols-10 gap-[3px] sm:gap-1">
      {Array.from({ length: 100 }, (_, i) => (
        <span
          key={i}
          className={cn(
            "size-[7px] rounded-[2px] sm:size-2",
            i < value ? "fill-in bg-stamp" : "bg-line",
          )}
          style={i < value ? ({ "--i": i } as CSSProperties) : undefined}
        />
      ))}
    </span>
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

      {/* Hero */}
      <section id="hero" aria-labelledby="hero-title" className="relative">
        <div aria-hidden className="ruled pointer-events-none absolute inset-x-0 top-0 h-[44rem]" />
        <div
          aria-hidden
          className="hero-aura pointer-events-none absolute inset-x-0 top-0 h-[40rem]"
        />
        <div className="relative mx-auto max-w-6xl px-4 pt-10 pb-20 sm:px-6 lg:pt-14 lg:pb-28">
          <div className="mx-auto max-w-4xl text-center">
            <p className="hero-in mx-auto mb-8 inline-flex w-fit max-w-full items-center gap-2 rounded-full bg-surface/80 py-1 ps-1.5 pe-3 text-sm font-semibold text-ink-2 shadow-raised ring-1 ring-line">
              <span className="shrink-0 rounded-full bg-stamp-wash px-2 py-0.5 text-xs whitespace-nowrap text-stamp">
                Pilota ISEE
              </span>
              <span className="min-w-0 truncate">
                <span className="sm:hidden">Gennaio 2027</span>
                <span className="hidden sm:inline">Per CAF e patronati, da gennaio 2027</span>
              </span>
            </p>
            <h1 id="hero-title" className="font-display type-hero">
              {/* Screen readers get one sentence: inline-block words can be read one by one. */}
              <span className="sr-only">{HERO_TITLE.join(" ")}</span>
              <span aria-hidden>
                {HERO_TITLE.map((word, i) => (
                  <Fragment key={word}>
                    {i > 0 && " "}
                    <span className="hero-word">
                      <span
                        className={cn(i === HERO_TITLE.length - 1 && "marker-draw")}
                        style={{ "--d": `${80 + i * 50}ms` } as CSSProperties}
                      >
                        {word}
                      </span>
                    </span>
                  </Fragment>
                ))}
              </span>
            </h1>
            <p className="hero-in mx-auto mt-6 max-w-2xl type-lead text-balance text-ink-2 [--d:280ms]">
              Il cittadino prepara l’ISEE dal telefono, nella sua lingua. Il vostro operatore trova
              tutto in ordine, con i mancanti in cima.
            </p>
            <div className="hero-in mt-9 flex flex-col justify-center gap-3 [--d:360ms] sm:flex-row">
              <Button asChild size="lg" className="cta-sheen group">
                <a href="#pilota">
                  Parliamo del pilota
                  <Arrow />
                </a>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <a href="#come-funziona">Guarda come funziona</a>
              </Button>
            </div>
            <ul className="hero-in mx-auto mt-7 flex w-fit flex-col gap-2 text-start text-sm text-ink-2 [--d:420ms] sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-6">
              {HERO_FACTS.map((fact) => (
                <li key={fact} className="flex items-center gap-2">
                  <Check className="size-3.5 shrink-0 text-stamp" strokeWidth={2.5} aria-hidden />
                  {fact}
                </li>
              ))}
            </ul>
            {DEMO_OFFICE && (
              <p className="hero-in mt-5 text-sm text-ink-2 [--d:460ms]">
                <Link
                  href={`/s/${DEMO_OFFICE}`}
                  className="font-semibold text-stamp underline underline-offset-4"
                >
                  Prova la demo dal telefono
                </Link>
              </p>
            )}
          </div>

          {/* The stage: the live example on a desk surface. */}
          <div className="hero-stage stage relative mt-14 rounded-[2rem] p-4 [--d:520ms] sm:p-6 lg:mt-16 lg:p-12">
            <IntakeDemo />
          </div>
        </div>
      </section>

      {/* How it works: sticky picture, four steps */}
      <section
        id="come-funziona"
        aria-labelledby="come-title"
        className="scroll-mt-16 border-t border-line bg-surface"
      >
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-32">
          <SectionIntro
            id="come-title"
            eyebrow="Come funziona"
            title="Le domande dello sportello, prima dello sportello."
          />
          <div className="mt-16 lg:mt-8">
            <HowItWorks />
          </div>
        </div>
      </section>

      {/* Operators */}
      <section
        id="operatori"
        data-header="dark"
        aria-labelledby="operatori-title"
        className="grain grain-dark relative scroll-mt-16 overflow-hidden bg-contrast text-on-contrast"
      >
        <div aria-hidden className="band-light pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-6xl px-4 pt-24 sm:px-6 lg:pt-32">
          <SectionIntro
            id="operatori-title"
            inverted
            className="mx-auto text-center [&_p:first-child]:justify-center [&_p:last-child]:mx-auto [&_p:last-child]:max-w-[34rem] [&_p:last-child]:text-balance"
            eyebrow="Per l’operatore"
            title="Apre il fascicolo e sa già dove guardare."
            lead="Poi copia nel vostro gestionale: prospetto DSU, PDF e originali in un solo ZIP."
          />
          <ul
            data-reveal="stagger"
            className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-3 text-on-contrast/85"
          >
            {OPERATOR_FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="grid size-8 place-items-center rounded-lg bg-on-contrast/[0.06] ring-1 ring-on-contrast/10"
                >
                  <Icon className="size-4 text-marker" />
                </span>
                {text}
              </li>
            ))}
          </ul>
          <div className="glow mt-16 [--glow-color:rgb(123_144_255/0.18)] lg:mt-20">
            <div className="scroll-tilt edge-light">
              <DossierPreview />
            </div>
          </div>
        </div>
        <div className="h-24 lg:h-32" />
      </section>

      {/* AI */}
      <section aria-labelledby="ai-title" className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-32">
        <div className="grid items-center gap-16 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionIntro
              id="ai-title"
              eyebrow="Intelligenza artificiale"
              title="L’AI propone. L’operatore decide."
              lead="Legge documenti e racconti, accanto a regole scritte con le fonti ufficiali."
            />
            <ul data-reveal="stagger" className="mt-10 grid gap-4">
              {AI_POINTS.map((point) => (
                <li key={point} className="flex items-center gap-3 text-lg">
                  <span
                    aria-hidden
                    className="grid size-6 shrink-0 place-items-center rounded-full bg-stamp-wash text-stamp"
                  >
                    <Check className="size-3.5" strokeWidth={2.5} />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <div data-reveal className="glow">
            <OperatorSnippet />
          </div>
        </div>
      </section>

      {/* Practices and figures */}
      <section
        id="pratiche"
        aria-labelledby="pratiche-title"
        className="scroll-mt-16 border-y border-line bg-surface"
      >
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-32">
          <SectionIntro
            id="pratiche-title"
            eyebrow="Pratiche"
            title="Si parte dall’ISEE, quando serve di più."
          />
          <div className="mt-14 grid gap-10 sm:grid-cols-2 lg:gap-16">
            {FACTS.map((fact) => (
              <p key={fact.value} data-reveal className="border-t-2 border-ink pt-5">
                <span className="flex items-end justify-between gap-6">
                  <span className="block font-display text-[clamp(4.5rem,10vw,8rem)] leading-none font-semibold tracking-[-0.01em]">
                    <CountUp value={fact.value} suffix="%" />
                  </span>
                  <HundredGrid value={fact.value} />
                </span>
                <span className="mt-3 block text-xl text-ink">{fact.label}</span>
                <a
                  href={fact.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-sm text-ink-3 underline underline-offset-2 hover:text-ink"
                >
                  {fact.source}
                  <ArrowUpRight className="ms-0.5 inline size-3.5 align-[-0.1em]" aria-hidden />
                  <span className="sr-only"> (si apre in una nuova scheda)</span>
                </a>
              </p>
            ))}
          </div>
          <div
            data-reveal
            className="mt-16 flex flex-wrap items-center gap-x-3 gap-y-3 border-t border-line pt-8 text-body-sm"
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-stamp px-3.5 py-1.5 font-semibold text-on-stamp">
              <span aria-hidden className="size-1.5 rounded-full bg-marker" />
              ISEE ordinario · pilota da gennaio 2027
            </span>
            {NEXT_PRACTICES.map((name) => (
              <span
                key={name}
                className="rounded-full px-3.5 py-1.5 text-ink-2 ring-1 ring-line-strong"
              >
                {name}
              </span>
            ))}
            <span className="text-ink-3">in preparazione</span>
          </div>
        </div>
      </section>

      {/* Data and responsibility */}
      <section
        id="dati"
        data-header="dark"
        aria-labelledby="dati-title"
        className="grain grain-dark relative scroll-mt-16 bg-contrast text-on-contrast"
      >
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-32">
          <SectionIntro
            id="dati-title"
            inverted
            eyebrow="Dati e responsabilità"
            title="Documenti di persone vere, trattati di conseguenza."
          />
          <SpotlightGrid
            as="dl"
            className="mt-14 overflow-hidden rounded-2xl bg-on-contrast/10"
            gridClassName="grid gap-px sm:grid-cols-2"
          >
            {DATA_FACTS.map(({ icon: Icon, title, body }, i) => (
              <div
                key={title}
                data-reveal
                style={{ "--reveal-delay": `${(i % 2) * 80}ms` } as CSSProperties}
                className="bg-contrast p-7 sm:p-8"
              >
                <span
                  aria-hidden
                  className="grid size-10 place-items-center rounded-xl bg-on-contrast/[0.06] ring-1 ring-on-contrast/10"
                >
                  <Icon className="size-5 text-marker" />
                </span>
                <dt className="mt-5 font-display text-xl font-semibold">{title}</dt>
                <dd className="mt-1.5 text-on-contrast/75">{body}</dd>
              </div>
            ))}
          </SpotlightGrid>
          <Link
            href="/sicurezza"
            className="group mt-10 inline-flex min-h-11 items-center gap-2 rounded-sm font-semibold text-marker underline-offset-4 hover:underline focus-visible:outline-marker"
          >
            Tutti i controlli di sicurezza
            <Arrow className="size-4" />
          </Link>
        </div>
      </section>

      {/* Pilot */}
      <section id="pilota" aria-labelledby="pilota-title" className="scroll-mt-16">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-14 px-4 py-24 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20 lg:py-32">
          <div className="min-w-0">
            {/* DA DECIDERE: gratuità fino al 31 marzo 2027, «potete fermarvi quando volete» e
                tetto di pratiche del pilota (docs/gtm/pilota.md propone 500 fascicoli per sede, da
                approvare). Finché non è deciso il tetto resta «volumi concordati», senza numeri. */}
            <SectionIntro
              id="pilota-title"
              eyebrow="Pilota 2027"
              title="Tre sportelli per il picco di gennaio."
              lead="Gratis fino al 31 marzo 2027, intelligenza artificiale inclusa, con volumi concordati prima di partire. Potete fermarvi quando volete."
            />
            <ol data-reveal="stagger" className="thread relative mt-12 grid">
              {PILOT_TIMELINE.map((step) => (
                <li key={step.when} className="relative ps-6 pb-7 last:pb-0">
                  <span
                    aria-hidden
                    className="absolute -start-[4.5px] top-[7px] size-2.5 rounded-full bg-stamp ring-4 ring-paper"
                  />
                  <p className="font-semibold text-ink">{step.when}</p>
                  <p className="mt-0.5 text-ink-2">{step.what}</p>
                </li>
              ))}
            </ol>
          </div>
          <div className="lg:sticky lg:top-24 lg:self-start">
            <PilotForm />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-title" className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:py-32">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <SectionIntro id="faq-title" eyebrow="Domande" title="Domande dei CAF" />
          </div>
          <div data-reveal="stagger" className="border-t border-line">
            {FAQ.map((item) => (
              <details key={item.q} className="group border-b border-line">
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 rounded-sm py-4 text-lg font-semibold transition-colors hover:text-stamp [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span
                    aria-hidden
                    className="grid size-8 shrink-0 place-items-center rounded-full text-ink-3 ring-1 ring-line-strong transition-[transform,background-color,color] duration-200 ease-(--ease-out) group-open:rotate-45 group-open:bg-stamp group-open:text-on-stamp group-open:ring-stamp"
                  >
                    <svg
                      viewBox="0 0 12 12"
                      className="size-3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    >
                      <path d="M6 1v10M1 6h10" strokeLinecap="round" />
                    </svg>
                  </span>
                </summary>
                <p className="max-w-[62ch] animate-rise pb-6 leading-relaxed text-ink-2">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Closing call to action */}
      <section
        id="chiusura"
        aria-labelledby="chiusura-title"
        className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-32"
      >
        <div
          data-reveal
          className="grain grain-dark relative overflow-hidden rounded-[2rem] bg-contrast px-6 py-16 text-center text-on-contrast shadow-[0_40px_80px_-40px_rgb(20_27_45/0.5)] sm:px-10 lg:py-24"
        >
          <div aria-hidden className="closing-light pointer-events-none absolute inset-0 -z-0" />
          <div className="scroll-ticket absolute end-12 top-10 hidden lg:block">
            <QueueTicket number="A 319" label="Il prossimo" className="rotate-[6deg]" />
          </div>
          <h2 id="chiusura-title" className="relative mx-auto max-w-2xl font-display type-section">
            Mezz’ora per capire se fa per voi.
          </h2>
          <p className="relative mx-auto mt-5 max-w-xl type-lead text-on-contrast/75">
            Una pratica di prova, dall’inizio al vostro gestionale.
          </p>
          <Button
            asChild
            size="lg"
            variant="marker"
            className="cta-sheen group mt-10 w-full focus-visible:outline-marker sm:w-auto"
          >
            <a href="#pilota">
              Parliamo del pilota
              <Arrow />
            </a>
          </Button>
        </div>
      </section>
    </>
  );
}
