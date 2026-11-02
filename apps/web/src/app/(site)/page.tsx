import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Clock3,
  FileArchive,
  Languages,
  MessageSquareText,
  Printer,
  ShieldCheck,
} from "lucide-react";
import { CitizenSnippet, OperatorSnippet } from "@/components/landing/ai-snippets";
import { CountUp } from "@/components/landing/count-up";
import { DossierPreview } from "@/components/landing/dossier-preview";
import { IntakeDemo } from "@/components/landing/intake-demo";
import { LanguageShowcase } from "@/components/landing/language-showcase";
import { PilotForm } from "@/components/landing/pilot-form";
import { SectionIntro } from "@/components/landing/section-intro";
import { QueueTicket, Stamp } from "@/components/brand/desk-objects";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const DESCRIPTION =
  "Avanti prepara le pratiche ISEE prima dell'appuntamento: il cittadino risponde dal telefono, anche nella sua lingua, e l'operatore del CAF trova un fascicolo ordinato con quello che manca già segnalato. La pratica resta all'operatore.";

export const metadata: Metadata = {
  title: { absolute: "Avanti — il fascicolo ISEE arriva pronto allo sportello del CAF" },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { title: "Avanti — il fascicolo arriva pronto", description: DESCRIPTION, url: "/" },
  twitter: { card: "summary_large_image" },
};

// Public demo office (seeded, fictitious data). Unset in environments without demo data.
const DEMO_OFFICE = process.env.NEXT_PUBLIC_DEMO_OFFICE_SLUG;

/** The three things a CAF manager asks before reading further. */
const HERO_FACTS = [
  "Non presenta nulla all'INPS: la pratica la fa il vostro operatore",
  "Il CAF resta titolare dei dati, come oggi",
  /* DA DECIDERE: gratuità del pilota fino al 31 marzo 2027 (docs/gtm/pilota.md è una proposta
     da approvare). Confermare prima di pubblicare. */
  "Gratis per i CAF pilota fino al 31 marzo 2027",
] as const;

/** Short, checkable facts under the hero, in place of logos and testimonials we don't have. */
const PROOF = [
  { value: "8 lingue", label: "per il cittadino. La console resta in italiano" },
  { value: "Nessuna app", label: "per il cittadino: un link o il QR dello sportello" },
  { value: "Un'ora", label: "di formazione per gli operatori, su pratiche di prova" },
  { value: "Fonti ufficiali", label: "INPS e Agenzia delle Entrate dietro ogni regola" },
] as const;

const DESK_QUESTIONS = [
  {
    asked: "«Che pratica le serve?»",
    answer:
      "Avanti la riconosce da come il cittadino la racconta, anche se non conosce il nome giusto. Se ha dubbi, chiede.",
  },
  {
    asked: "«Cosa devo portare?»",
    answer:
      "Una checklist costruita su quella famiglia: un estratto per ogni conto, una visura per ogni immobile, un documento per ogni persona.",
  },
  {
    asked: "«Questo documento va bene?»",
    answer:
      "Controlla tipo, anno, intestatario, scadenza, leggibilità e pagine mancanti appena il file viene caricato.",
  },
  {
    asked: "«Torni con la giacenza media.»",
    answer:
      "Quello che manca il cittadino lo sa prima dell'appuntamento, con le istruzioni per trovarlo, nella sua lingua.",
  },
] as const;

const STEPS = [
  {
    title: "Racconta",
    body: "Il cittadino apre il link o inquadra il QR dello sportello e scrive cosa deve fare, con parole sue. Nessun account, nessuna app.",
  },
  {
    title: "Risponde",
    body: "Una conversazione, scritta o a voce, con le sole domande che mancano. Chi ha già detto «vivo con mia madre» non se lo sente richiedere: conferma quello che Avanti ha capito.",
  },
  {
    title: "Carica",
    body: "Foto o PDF dal telefono. Avanti li analizza, propone la voce giusta e segnala subito cosa non torna. Quando il controllo è incerto lo dice: la verifica resta all'operatore.",
  },
  {
    title: "Consegna",
    body: "Il fascicolo arriva in coda allo sportello, già ordinato: riepilogo, nucleo, documenti, cosa manca. L'operatore verifica e fa la pratica.",
  },
] as const;

/** Desk work Avanti takes off the operator. Each line is a shipped console feature. */
const OPERATOR_FEATURES = [
  {
    icon: AlertTriangle,
    text: "Prima i documenti che mancano, divisi per persona, poi scadenze, anni sbagliati e pagine mancanti",
  },
  {
    icon: MessageSquareText,
    text: "Le integrazioni si chiedono nel link del cittadino, nella sua lingua. Per chi non legge l'email, un messaggio WhatsApp o SMS già scritto da copiare",
  },
  {
    icon: FileArchive,
    text: "Tutti gli originali in un solo ZIP, rinominati e in ordine per persona: non più IMG_2847.jpg",
  },
  {
    icon: Printer,
    text: "Per chi non ha lo smartphone, l'elenco dei documenti da portare su un foglio A4, nella sua lingua e in italiano",
  },
  {
    icon: Languages,
    text: "Console in italiano: il cittadino usa una delle otto lingue e l'originale resta consultabile",
  },
  {
    icon: Clock3,
    text: "Tempi, mancanti e integrazioni misurati pratica per pratica: nel pilota li confrontiamo con il vostro flusso abituale",
  },
] as const;

/** What the AI does in Avanti today, and what stays with people. Each line is a shipped feature. */
const AI_CITIZEN = [
  [
    "Parla o scrive come allo sportello",
    "Nella sua lingua, anche a voce. L'assistente capisce più informazioni in un messaggio, ripete cosa ha capito da confermare e chiede solo ciò che manca.",
  ],
  [
    "Ha un dubbio a metà strada",
    "Chiede all'assistente cosa vuol dire una domanda o dove trovare un documento. Se serve una persona, la domanda arriva allo sportello.",
  ],
  [
    "Carica una foto sbagliata",
    "Avanti la legge e avvisa subito se è il documento sbagliato, di un'altra persona, scaduto o illeggibile, prima che il fascicolo parta.",
  ],
] as const;

const AI_OPERATOR = [
  [
    "Un riepilogo da collega",
    "La situazione in due righe, cosa controllare e perché: ogni punto rimanda alla risposta o al documento da cui viene.",
  ],
  [
    "Dichiarazioni e documenti a confronto",
    "Nomi che non tornano, anni sbagliati, conti dichiarati senza estratto. E il prospetto DSU precompilato dai documenti, da confermare voce per voce.",
  ],
  [
    "Meno scrittura",
    "Bozze delle richieste d'integrazione e delle risposte ai cittadini, risposte rapide, domande normative con le fonti.",
  ],
] as const;

const AI_LIMITS = [
  "Non decide se un cittadino ha diritto a qualcosa e non manda nulla al suo posto: decide l'operatore.",
  "Non inventa documenti, anni o regole: quelle stanno nel motore di Avanti, con le fonti ufficiali.",
  "Se l'AI non risponde, Avanti continua con le regole: le pratiche non si fermano.",
  "Dalle impostazioni il CAF può spegnere l'assistente dei cittadini e il copilota degli operatori.",
  "Ogni proposta dell'AI è etichettata come tale e diventa un dato solo quando una persona la conferma.",
] as const;

const PRACTICES = [
  { name: "ISEE ordinario", when: "Gennaio 2027", status: "Pilota con i CAF", live: true },
  { name: "Modello 730", when: "Aprile 2027", status: "In preparazione", live: false },
  { name: "Assegno unico", when: "2027", status: "In preparazione", live: false },
  { name: "Permesso di soggiorno", when: "2027", status: "In preparazione", live: false },
  {
    name: "RED, NASpI, successioni semplici, cittadinanza",
    when: "Dopo",
    status: "In programma",
    live: false,
  },
] as const;

// Verified figures only, with year and primary source (see docs/research/market.md).
const FACTS = [
  {
    value: 85,
    label: "delle DSU per l'ISEE passa da un CAF (2024)",
    source: "Ministero del Lavoro, Rapporto ISEE 2024",
    href: "https://lavoro.gov.it/documenti-e-norme/studi-e-statistiche/rapporto-isee-2024",
  },
  {
    value: 71,
    label: "delle DSU 2025 è arrivato nel primo trimestre",
    source: "INPS, Osservatorio DSU e ISEE, febbraio 2026",
    href: "https://www.inps.it/it/it/inps-comunica/notizie/dettaglio-news-page.news.2026.02.osservatorio-su-dsu-e-isee-i-dati-2016-2025.html",
  },
] as const;

const HANDOFF = [
  "L'operatore verifica documenti e mancanti, voce per voce.",
  "Consulta il prospetto DSU nell'ordine del modello: le risposte del cittadino e gli importi letti dai documenti che ha confermato.",
  "Copia i dati e carica nel software del CAF gli originali, scaricati in un solo ZIP già rinominati. La procedura la proviamo insieme prima di partire.",
] as const;

const NOT_DOING = [
  {
    title: "Non fa la pratica",
    body: "Non trasmette nulla a INPS o Agenzia delle Entrate. Prepara il lavoro; la pratica la fa l'operatore abilitato.",
  },
  {
    title: "Non sostituisce il gestionale",
    body: "Sta davanti al software che il CAF usa già. Il fascicolo esce in PDF, in un file di dati e con gli originali in uno ZIP.",
  },
  {
    title: "Non decide al posto delle persone",
    body: "Segnala dubbi e mancanze; ogni voce del fascicolo resta verificabile e modificabile dall'operatore.",
  },
] as const;

// Every line must match docs/SECURITY.md, docs/DEPLOY.md and docs/legal/sub-responsabili.md:
// Frankfurt is the planned pilot region, and the providers' terms are still to be signed.
const DATA_FACTS = [
  "Il CAF resta titolare dei dati. Avanti li tratta per suo conto, con un accordo di nomina a responsabile (art. 28 GDPR).",
  "Per il pilota prevediamo database e documenti su server a Francoforte, nell'Unione europea. Fornitori e regioni li mettiamo per iscritto nell'accordo.",
  "Il cittadino entra con un link personale che scade: niente password da ricordare, niente app.",
  "Ogni accesso al fascicolo resta registrato; il responsabile del CAF consulta ed esporta il registro.",
  "La conservazione la decide il CAF; su richiesta dell'interessato il fascicolo si cancella da Avanti.",
  "All'AI arriva solo ciò che serve al singolo controllo. I fornitori li approva il CAF prima del primo cittadino, con conservazione e uso per l'addestramento scritti nell'elenco; senza garanzie adeguate Avanti lavora con le sole regole.",
] as const;

const PILOT_TIMELINE = [
  {
    when: "Novembre",
    what: "Una chiamata di mezz'ora e una demo con una famiglia inventata. Proviamo insieme a portare un fascicolo nel vostro gestionale.",
  },
  {
    when: "Dicembre",
    what: "Accordo sui dati, configurazione dello sportello, un'ora di formazione per gli operatori, il cartello con il QR per la sala d'attesa e una settimana di misure del lavoro di oggi.",
  },
  {
    when: "Gennaio – marzo",
    what: "Uso vero nel picco ISEE, con il vostro flusso abituale sempre disponibile. Mezz'ora a settimana per dirci cosa non va.",
  },
  {
    when: "Entro il 31 marzo",
    // DA DECIDERE: «nessun passaggio automatico a pagamento» (proposta in docs/gtm/pilota.md, da approvare).
    what: "Vi diamo i risultati, anche se non sono quelli sperati, e una proposta per continuare. Decidete voi: nessun passaggio automatico a pagamento.",
  },
] as const;

const PILOT_ASKS = [
  "Un referente che possa autorizzare il nuovo fornitore e un operatore di riferimento",
  "Una settimana di misure prima di iniziare, per avere un punto di partenza onesto",
  "Il permesso di pubblicare i risultati in forma aggregata. Nome e logo solo se lo autorizzate",
] as const;

const FAQ = [
  {
    q: "Se l'AI sbaglia, chi ne risponde?",
    a: "Nessun documento è accettato o rifiutato dall'AI e nessun importo entra nel prospetto senza la conferma dell'operatore: ogni proposta è etichettata e ha accanto il file da cui viene. La DSU la firmano e la trasmettono il cittadino e il CAF, con le procedure di sempre. Nel pilota contiamo anche gli errori dell'AI, separati per tipo, e li mettiamo nel rapporto.",
  },
  {
    q: "Dove finiscono i dati?",
    a: "Per il pilota prevediamo database e documenti su server a Francoforte, nell'Unione europea. All'AI arriva solo la parte che serve a ogni compito, mai note interne o altri fascicoli. Fornitori, regioni, conservazione dei dati e uso per l'addestramento sono scritti nell'elenco allegato all'accordo e li approvate voi: senza garanzie adeguate, Avanti lavora con le sole regole. Prima del primo cittadino vero firmiamo insieme accordo di nomina, valutazione d'impatto e informativa nelle lingue dello sportello.",
  },
  {
    q: "Funziona con il nostro gestionale?",
    a: "Avanti non lo sostituisce e oggi non si collega in automatico. Dal fascicolo l'operatore copia i dati dal prospetto DSU, già nell'ordine del modello, e scarica in un solo ZIP tutti gli originali rinominati per persona, più il riepilogo in PDF. Prima di partire proviamo insieme il passaggio nel vostro software; i collegamenti diretti li costruiamo con i CAF pilota.",
  },
  {
    q: "Quanto tempo serve agli operatori per imparare?",
    a: "Un'ora di formazione su pratiche di prova: caso completo, documento sbagliato, richiesta d'integrazione, export. La console è in italiano e ha una pagina di aiuto; il primo giorno una lista «Per iniziare» guida l'amministratore passo per passo.",
  },
  {
    q: "E chi non ha lo smartphone o non sa scrivere bene?",
    a: "Le domande sono brevi, con risposte da toccare, e si può rispondere a voce. L'operatore può completare il fascicolo allo sportello insieme al cittadino, oppure stampargli l'elenco dei documenti da portare su un foglio A4, nella sua lingua e in italiano. Lo sportello resta aperto come oggi: nessuno è obbligato a usare Avanti.",
  },
  {
    q: "Il cittadino deve installare qualcosa o registrarsi?",
    a: "No. Riceve un link personale (o inquadra il QR dello sportello) e lo apre dal browser del telefono. Il link scade da solo dopo il periodo stabilito dal CAF.",
  },
  {
    q: "E l'anno dopo, quando l'ISEE scade?",
    a: "L'ISEE vale fino al 31 dicembre. Per il rinnovo l'operatore sceglie le famiglie dell'anno prima e Avanti prepara il nuovo fascicolo con nucleo e documenti ancora validi: il cittadino conferma chi vive con lui e carica solo quello che va aggiornato. L'invito via email parte solo a chi ha dato il consenso.",
  },
  {
    q: "Quanto costa? E se non fa per noi?",
    // DA DECIDERE: gratuità fino al 31 marzo, «vi fermate», «nessun rinnovo automatico»
    // (docs/gtm/pilota.md e prezzi.md sono proposte da approvare). Il prezzo dopo il pilota non
    // è deciso: non citare canoni o modelli finché non lo è.
    a: "Per i CAF pilota è gratuito fino al 31 marzo 2027, intelligenza artificiale inclusa: nessuna chiave da configurare. Il prezzo per continuare non è ancora deciso: entro marzo vi facciamo un'offerta separata, costruita sui risultati misurati nel pilota. Se il pilota non funziona per voi vi fermate: non c'è rinnovo automatico, vi restituiamo i dati e cancelliamo le copie in Avanti.",
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

/** Inline call to action, repeated where a reader has just seen enough to want the pilot. */
function PilotLink({ inverted = false, children }: { inverted?: boolean; children: string }) {
  return (
    <a
      href="#pilota"
      className={cn(
        "group inline-flex min-h-11 items-center gap-2 rounded-sm font-semibold underline-offset-4 hover:underline",
        inverted ? "text-marker focus-visible:outline-marker" : "text-stamp",
      )}
    >
      {children}
      <ArrowRight
        className="rtl-flip size-4 transition-transform duration-200 ease-(--ease-out) group-hover:translate-x-1"
        aria-hidden
      />
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

      {/* Hero */}
      <section id="hero" aria-labelledby="hero-title" className="relative">
        <div aria-hidden className="ruled pointer-events-none absolute inset-x-0 top-0 h-[46rem]" />
        <div className="relative mx-auto max-w-6xl px-4 pt-8 pb-16 sm:px-6 lg:pt-14 lg:pb-24">
          <p className="hero-in mb-7 inline-flex w-fit max-w-full items-center gap-2 rounded-2xl bg-surface py-1 ps-1.5 pe-3 text-sm font-semibold text-ink-2 shadow-raised ring-1 ring-line">
            <span className="shrink-0 rounded-full bg-stamp-wash px-2 py-0.5 text-xs whitespace-nowrap text-stamp">
              Pilota ISEE
            </span>
            <span className="min-w-0">
              <span className="sm:hidden">CAF e patronati, gennaio 2027</span>
              <span className="hidden sm:inline">Per CAF e patronati, da gennaio 2027</span>
            </span>
          </p>
          <h1 id="hero-title" className="hero-in font-display type-hero [--d:60ms]">
            Il fascicolo arriva <span className="marker-draw">pronto.</span>
          </h1>

          <div className="mt-8 grid gap-10 lg:mt-10 lg:grid-cols-12 lg:gap-8">
            <div className="hero-in [--d:140ms] lg:col-span-6">
              <p className="type-lead text-ink-2">
                Avanti prepara le pratiche ISEE prima dell&apos;appuntamento. Il cittadino risponde
                dal telefono, anche nella sua lingua; allo sportello arriva un fascicolo ordinato,
                con i documenti mancanti e i dubbi da verificare già in cima. La pratica la fa il
                vostro operatore.
              </p>
              <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap">
                <Button asChild size="lg" className="group">
                  <a href="#pilota">
                    Parliamo del pilota ISEE
                    <ArrowRight
                      className="rtl-flip size-4.5 transition-transform duration-200 ease-(--ease-out) group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </a>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <a href="#operatori">Guarda il fascicolo di esempio</a>
                </Button>
              </div>
              <p className="mt-3 text-sm text-ink-3">
                Prima una chiamata di mezz&apos;ora con il responsabile e un operatore. Nessun
                impegno d&apos;acquisto.
              </p>
            </div>
            <div className="hero-in [--d:220ms] lg:col-span-5 lg:col-start-8">
              <p className="type-eyebrow text-ink-3">Quello che chiedete per primo</p>
              <ul className="mt-3 divide-y divide-line border-y border-line">
                {HERO_FACTS.map((fact) => (
                  <li key={fact} className="flex gap-3 py-3 text-ink">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-stamp text-on-stamp">
                      <Check className="size-3" strokeWidth={3} aria-hidden />
                    </span>
                    {fact}
                  </li>
                ))}
              </ul>
              {DEMO_OFFICE && (
                <p className="mt-4 text-ink-2">
                  Vuoi vederlo dal lato del cittadino?{" "}
                  <Link
                    href={`/s/${DEMO_OFFICE}`}
                    className="font-semibold text-stamp underline underline-offset-2"
                  >
                    Prova la demo dal telefono
                  </Link>
                </p>
              )}
            </div>
          </div>

          {/* The stage: the live example on a desk surface. */}
          <div className="hero-in grain relative mt-14 rounded-[1.75rem] bg-sunk/70 p-4 ring-1 ring-line [--d:320ms] sm:p-6 lg:mt-16 lg:p-10">
            <IntakeDemo />
          </div>

          <dl
            data-reveal="stagger"
            className="mt-14 grid grid-cols-1 gap-x-8 gap-y-6 min-[420px]:grid-cols-2 lg:mt-16 lg:grid-cols-4"
          >
            {PROOF.map((item) => (
              <div key={item.value} className="min-w-0 border-t border-line-strong pt-4">
                <dt className="font-display text-xl font-semibold text-ink">{item.value}</dt>
                <dd className="mt-1 text-body-sm text-ink-2">{item.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Desk questions */}
      <section aria-labelledby="sportello-title" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <SectionIntro
            id="sportello-title"
            eyebrow="Il lavoro di oggi"
            title="Prima di aprire la pratica, lo sportello fa domande. Sempre le stesse."
            lead="Capire cosa serve, chiedere i documenti, scoprire cosa manca, richiamare. Avanti fa questa parte prima che il cittadino si sieda."
          />
          <dl data-reveal="stagger" className="mt-14 border-t border-line">
            {DESK_QUESTIONS.map((item, i) => (
              <div
                key={item.asked}
                className="grid gap-2 border-b border-line py-7 md:grid-cols-[3rem_minmax(0,20rem)_1fr] md:gap-8"
              >
                <span
                  aria-hidden
                  className="tabular hidden pt-1.5 font-mono text-sm text-ink-3 md:block"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <dt className="font-display text-xl font-semibold text-ink sm:text-2xl">
                  {item.asked}
                </dt>
                <dd className="max-w-xl text-[1.0625rem] leading-relaxed text-ink-2">
                  {item.answer}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* How it works */}
      <section
        id="come-funziona"
        aria-labelledby="come-title"
        className="mx-auto max-w-6xl scroll-mt-16 px-4 py-20 sm:px-6 lg:py-28"
      >
        <SectionIntro
          id="come-title"
          eyebrow="Come funziona"
          title={<>Dal «devo fare l&apos;ISEE» al fascicolo, in quattro passaggi.</>}
        />
        <div data-reveal className="relative mt-14">
          {/* The thread through the four steps, drawn when the section arrives. */}
          <span
            aria-hidden
            className="draw-x absolute inset-x-[12.5%] top-[2.375rem] hidden h-px bg-[repeating-linear-gradient(to_right,var(--line-strong)_0_6px,transparent_6px_12px)] lg:block"
          />
          <ol data-reveal="stagger" className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <li key={step.title}>
                <div className="h-full rounded-lg bg-surface p-6 shadow-raised ring-1 ring-line transition-[transform,box-shadow] duration-200 ease-(--ease-out) hover:-translate-y-0.5 hover:shadow-float">
                  <span
                    aria-hidden
                    className="tabular relative grid size-9 place-items-center rounded-full bg-stamp font-display text-base font-bold text-on-stamp ring-4 ring-surface"
                  >
                    {i + 1}
                  </span>
                  <h3 className="mt-5 font-display type-title">{step.title}</h3>
                  <p className="mt-2 leading-relaxed text-ink-2">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Operators */}
      <section
        id="operatori"
        aria-labelledby="operatori-title"
        className="grain grain-dark relative scroll-mt-16 bg-contrast text-on-contrast"
      >
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
            <SectionIntro
              id="operatori-title"
              inverted
              eyebrow="Per l'operatore"
              title="L'operatore apre il fascicolo e sa già dove guardare."
              lead="Ogni voce si verifica con un clic, anche da tastiera. Finché manca qualcosa, il pulsante principale è «Chiedi integrazione»."
            />
            <ul data-reveal="stagger" className="grid content-end gap-5">
              {OPERATOR_FEATURES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex gap-3.5 text-on-contrast/90">
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-on-contrast/8 ring-1 ring-on-contrast/10">
                    <Icon className="size-4.5 text-marker" aria-hidden />
                  </span>
                  <span className="pt-1">{text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div data-reveal className="mt-14 [--reveal-distance:28px] lg:mt-16">
            <DossierPreview />
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-on-contrast/10 pt-6">
            <p className="text-on-contrast/75">
              Nella demo lo vedete su una pratica di prova, con un vostro operatore.
            </p>
            <PilotLink inverted>Prenotate mezz&apos;ora</PilotLink>
          </div>
        </div>
      </section>

      {/* Handoff to the CAF's software */}
      <section aria-labelledby="gestionale-title" className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <div data-reveal="stagger">
            <p className="mb-4 flex items-center gap-2.5 type-eyebrow text-stamp">
              <span aria-hidden className="h-px w-6 bg-current opacity-60" />
              Dopo Avanti
            </p>
            <h2 id="gestionale-title" className="font-display type-subsection">
              Il lavoro prosegue nel vostro gestionale.
            </h2>
          </div>
          {/* Ruled columns, not a second row of cards: the four steps above are the citizen's
              journey, these are what happens after it, at the desk. */}
          <ol data-reveal="stagger" className="mt-10 grid gap-8 md:grid-cols-3 md:gap-10">
            {HANDOFF.map((text, i) => (
              <li key={text} className="border-t-2 border-ink pt-4">
                <span aria-hidden className="tabular block font-mono text-sm font-bold text-stamp">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="mt-2 leading-relaxed text-ink-2">{text}</p>
              </li>
            ))}
          </ol>
          <p className="mt-8 max-w-3xl text-sm text-ink-3">
            Gli importi letti dall&apos;AI nei documenti restano proposte finché l&apos;operatore
            non li conferma sul file. Avanti non invia nulla agli enti e oggi non si collega in
            automatico al gestionale; i collegamenti diretti si definiscono con i piloti.
          </p>
        </div>
      </section>

      {/* AI */}
      <section aria-labelledby="ai-title" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <SectionIntro
          id="ai-title"
          eyebrow="Intelligenza artificiale"
          title="L'intelligenza artificiale, dove fa risparmiare tempo."
          lead="Non un chatbot appoggiato sopra: l'AI lavora dentro il percorso, accanto a regole scritte con le fonti ufficiali che decidono cosa chiedere e cosa serve. È inclusa: il CAF non deve configurare chiavi né account con i fornitori."
        />
        {/* Subgrid: the two examples share one row height, so the lists under them start on
            the same line. */}
        <div
          data-reveal="stagger"
          className="mt-14 grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-y-0"
        >
          {(
            [
              ["Per il cittadino", AI_CITIZEN],
              ["Per l'operatore", AI_OPERATOR],
            ] as const
          ).map(([title, items], index) => (
            <div key={title} className="lg:row-span-3 lg:grid lg:grid-rows-subgrid">
              <h3 className="font-display type-title">{title}</h3>
              <div className="mt-6 grid">
                {index === 0 ? <CitizenSnippet /> : <OperatorSnippet />}
              </div>
              <dl className="mt-8 grid gap-6">
                {items.map(([term, text]) => (
                  <div key={term}>
                    <dt className="font-semibold">{term}</dt>
                    <dd className="mt-1 leading-relaxed text-ink-2">{text}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
        <div
          data-reveal
          className="relative mt-14 overflow-hidden rounded-xl bg-surface p-6 shadow-raised ring-1 ring-line sm:p-8"
        >
          <Stamp className="absolute end-6 top-6 hidden text-xs sm:inline-flex">
            <span>Decide</span>
            <span className="mt-0.5">l&apos;operatore</span>
          </Stamp>
          <h3 className="flex items-center gap-2 font-display type-title">
            <ShieldCheck className="size-6 shrink-0 text-stamp" aria-hidden />
            Cosa resta alle persone
          </h3>
          <ul className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {AI_LIMITS.map((line) => (
              <li key={line} className="flex gap-2.5 leading-relaxed text-ink-2">
                <Check className="mt-1 size-4 shrink-0 text-stamp" aria-hidden />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Languages */}
      <section
        id="lingue"
        aria-labelledby="lingue-title"
        className="border-y border-line bg-surface"
      >
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <SectionIntro
            id="lingue-title"
            eyebrow="Lingue"
            title="Ognuno risponde nella sua lingua. Lo sportello legge in italiano."
            lead="Per chi è arrivato da poco, la parte difficile non è la pratica: è capire cosa chiedono. Avanti spiega con parole semplici e lascia in italiano i nomi che si troveranno scritti sui documenti."
          />
          {/* Skipped until near the viewport: its Arabic and Bengali glyphs (270 KB of fonts) are
              then fetched only by visitors who scroll this far. */}
          <div className="mt-12 [contain-intrinsic-size:auto_32rem] [content-visibility:auto]">
            <LanguageShowcase />
          </div>
        </div>
      </section>

      {/* Practices */}
      <section
        id="pratiche"
        aria-labelledby="pratiche-title"
        className="mx-auto grid max-w-6xl scroll-mt-16 grid-cols-1 gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:py-28"
      >
        <div className="min-w-0">
          <SectionIntro
            id="pratiche-title"
            eyebrow="Pratiche"
            title="Si parte dall'ISEE. Il resto segue il calendario dei CAF."
            lead="Gennaio è il mese più pesante per l'ISEE, aprile apre la campagna 730. Ogni pratica arriva quando è verificata con chi la fa ogni giorno."
          />
          <div
            data-reveal="stagger"
            className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"
          >
            {FACTS.map((fact) => (
              <p key={fact.value} className="border-t-2 border-ink pt-3">
                <span className="block font-display text-6xl font-semibold">
                  <CountUp value={fact.value} suffix="%" />
                </span>
                <span className="mt-1 block text-ink-2">{fact.label}</span>
                <a
                  href={fact.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-sm text-ink-3 underline underline-offset-2 hover:text-ink"
                >
                  {fact.source}
                  <span className="sr-only"> (si apre in una nuova scheda)</span>
                </a>
              </p>
            ))}
          </div>
        </div>
        <ol
          data-reveal="stagger"
          className="relative grid content-center gap-0 border-s border-line-strong ps-8"
        >
          {/* Dots centred on the 1px rule (ps-8 + border) and on the date line (20px). */}
          {PRACTICES.map((p) => (
            <li key={p.name} className="relative pb-8 last:pb-0">
              <span
                aria-hidden
                className={
                  p.live
                    ? "absolute -start-[39.5px] top-[3px] size-3.5 rounded-full bg-stamp ring-4 ring-stamp-wash"
                    : "absolute -start-[38.5px] top-1 size-3 rounded-full bg-paper ring-2 ring-line-strong"
                }
              />
              <p className="tabular text-sm text-ink-3">{p.when}</p>
              <h3 className="mt-0.5 font-display text-xl font-semibold">{p.name}</h3>
              <p className={p.live ? "mt-1 font-semibold text-stamp" : "mt-1 text-ink-2"}>
                {p.status}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* Data, security and boundaries */}
      <section
        id="dati"
        aria-labelledby="dati-title"
        className="grain grain-dark relative scroll-mt-16 bg-contrast text-on-contrast"
      >
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <SectionIntro
            id="dati-title"
            inverted
            eyebrow="Dati e responsabilità"
            title="Documenti di persone vere, trattati di conseguenza."
          />
          <div className="mt-14 grid gap-14 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
            <div>
              <h3 className="font-display type-title">Cosa Avanti non fa, di proposito</h3>
              <dl data-reveal="stagger" className="mt-6 grid gap-6">
                {NOT_DOING.map((item) => (
                  <div key={item.title} className="border-t border-on-contrast/15 pt-4">
                    <dt className="font-semibold">{item.title}</dt>
                    <dd className="mt-1 leading-relaxed text-on-contrast/75">{item.body}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div
              data-reveal
              className="rounded-xl bg-on-contrast/[0.06] p-6 ring-1 ring-on-contrast/12 sm:p-8"
            >
              <h3 className="flex items-center gap-2.5 font-display type-title">
                <ShieldCheck className="size-6 shrink-0 text-marker" aria-hidden />
                Come trattiamo i dati
              </h3>
              <ul className="mt-6 grid gap-3.5">
                {DATA_FACTS.map((line) => (
                  <li key={line} className="flex gap-2.5 leading-relaxed text-on-contrast/80">
                    <Check className="mt-1 size-4 shrink-0 text-marker" aria-hidden />
                    {line}
                  </li>
                ))}
              </ul>
              <p className="mt-6 border-t border-on-contrast/12 pt-5 leading-relaxed text-on-contrast/80">
                Prima del primo cittadino vero firmiamo con il CAF l&apos;accordo di nomina,
                l&apos;elenco dei fornitori e la valutazione d&apos;impatto, e prepariamo
                l&apos;informativa nelle lingue dello sportello.
              </p>
              <Link
                href="/sicurezza"
                className="group mt-4 inline-flex min-h-11 items-center gap-2 rounded-sm font-semibold text-marker underline-offset-4 hover:underline focus-visible:outline-marker"
              >
                Tutti i controlli di sicurezza
                <ArrowRight
                  className="rtl-flip size-4 transition-transform duration-200 ease-(--ease-out) group-hover:translate-x-1"
                  aria-hidden
                />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Pilot */}
      <section id="pilota" aria-labelledby="pilota-title" className="scroll-mt-16 bg-sunk/60">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:py-28">
          <div className="min-w-0">
            {/* DA DECIDERE: gratuità fino al 31 marzo 2027, «potete fermarvi quando volete» e
                tetto di pratiche del pilota (docs/gtm/pilota.md propone 500 fascicoli per sede, da
                approvare). Finché non è deciso il tetto resta «volumi concordati», senza numeri. */}
            <SectionIntro
              id="pilota-title"
              eyebrow="Pilota 2027"
              title="Cerchiamo tre sportelli per il picco ISEE di gennaio."
              lead="Gratis fino al 31 marzo 2027, intelligenza artificiale inclusa, con volumi concordati prima di partire. Potete fermarvi quando volete."
            />
            <h3 className="mt-10 font-semibold">Come si svolge</h3>
            <ol data-reveal="stagger" className="mt-4 grid gap-0 border-s border-line-strong">
              {PILOT_TIMELINE.map((step) => (
                <li key={step.when} className="relative ps-6 pb-6 last:pb-0">
                  <span
                    aria-hidden
                    className="absolute -start-[5px] top-[7px] size-2.5 rounded-full bg-stamp ring-4 ring-sunk"
                  />
                  <p className="font-semibold text-ink">{step.when}</p>
                  <p className="mt-1 leading-relaxed text-ink-2">{step.what}</p>
                </li>
              ))}
            </ol>
            <h3 className="mt-10 font-semibold">In cambio vi chiediamo</h3>
            <ul className="mt-3 grid gap-3 text-ink-2">
              {PILOT_ASKS.map((text) => (
                <li key={text} className="flex gap-3">
                  <Check className="mt-1 size-4 shrink-0 text-stamp" aria-hidden />
                  {text}
                </li>
              ))}
            </ul>
            <div className="mt-10 border-t border-line-strong pt-6">
              <h3 className="font-semibold">Perché qui non trovate loghi né testimonianze</h3>
              <p className="mt-2 leading-relaxed text-ink-2">
                Siamo all&apos;inizio: il pilota serve proprio a raccogliere le prove. Con i primi
                sportelli misureremo minuti di lavoro, completezza al primo invio e tempo di copia
                nel gestionale, e pubblicheremo metodo, campione e limiti del risultato, anche se
                non è quello sperato.
              </p>
            </div>
          </div>
          <div className="lg:sticky lg:top-24 lg:self-start">
            <PilotForm />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section
        aria-labelledby="faq-title"
        className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28"
      >
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <SectionIntro
              id="faq-title"
              eyebrow="Domande"
              title="Domande dei CAF"
              lead="Le obiezioni che sentiamo più spesso, con le risposte che daremmo al telefono."
            />
          </div>
          <div data-reveal="stagger" className="border-t border-line">
            {FAQ.map((item) => (
              <details key={item.q} className="group border-b border-line">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 rounded-sm py-4 text-lg font-semibold transition-colors hover:text-stamp [&::-webkit-details-marker]:hidden">
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
        className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:pb-28"
      >
        <div
          data-reveal
          className="grain grain-dark relative grid gap-8 rounded-[1.75rem] bg-contrast px-6 py-12 text-on-contrast sm:px-10 md:grid-cols-[1fr_auto] md:items-center lg:px-14 lg:py-16"
        >
          <QueueTicket
            number="A 319"
            label="Il prossimo"
            className="absolute end-12 -top-6 hidden rotate-[6deg] [--notch:var(--contrast)] lg:inline-flex"
          />
          <div className="max-w-2xl">
            <h2 id="chiusura-title" className="font-display type-subsection">
              Mezz&apos;ora per capire se fa per il vostro sportello.
            </h2>
            <p className="mt-4 type-lead text-on-contrast/80">
              Vi mostriamo una pratica di prova dall&apos;inizio alla fine, con una famiglia
              inventata, e proviamo insieme il passaggio nel vostro gestionale. Un&apos;altra
              domanda? Scrivetecela nel modulo: rispondiamo noi, senza impegno.
            </p>
          </div>
          <Button
            asChild
            size="lg"
            variant="marker"
            className="group w-full focus-visible:outline-marker md:w-auto"
          >
            <a href="#pilota">
              Parliamo del pilota ISEE
              <ArrowRight
                className="rtl-flip size-4.5 transition-transform duration-200 ease-(--ease-out) group-hover:translate-x-0.5"
                aria-hidden
              />
            </a>
          </Button>
        </div>
      </section>
    </>
  );
}
