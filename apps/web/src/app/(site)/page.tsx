import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  Clock3,
  FileArchive,
  Languages,
  MessageSquareText,
  Printer,
  ShieldCheck,
} from "lucide-react";
import { CitizenSnippet, OperatorSnippet } from "@/components/landing/ai-snippets";
import { DossierPreview } from "@/components/landing/dossier-preview";
import { IntakeDemo } from "@/components/landing/intake-demo";
import { LanguageShowcase } from "@/components/landing/language-showcase";
import { PilotForm } from "@/components/landing/pilot-form";
import { Button } from "@/components/ui/button";

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

/** The three things a CAF manager asks before reading further. Each one is true today. */
const HERO_FACTS = [
  "Non presenta nulla all'INPS: la pratica la fa il vostro operatore",
  "Il CAF resta titolare dei dati, come oggi",
  "Gratis per i CAF pilota fino al 31 marzo 2027",
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
    value: "85%",
    label: "delle DSU per l'ISEE passa da un CAF (2024)",
    source: "Ministero del Lavoro, Rapporto ISEE 2024",
    href: "https://lavoro.gov.it/documenti-e-norme/studi-e-statistiche/rapporto-isee-2024",
  },
  {
    value: "71%",
    label: "delle DSU 2025 è arrivato nel primo trimestre",
    source: "INPS, Osservatorio DSU e ISEE, febbraio 2026",
    href: "https://www.inps.it/it/it/inps-comunica/notizie/dettaglio-news-page.news.2026.02.osservatorio-su-dsu-e-isee-i-dati-2016-2025.html",
  },
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

// Every line must match docs/SECURITY.md and docs/DEPLOY.md (pilot: Neon and Blob in Frankfurt).
const DATA_FACTS = [
  "Il CAF resta titolare dei dati. Avanti li tratta per suo conto, con un accordo di nomina a responsabile (art. 28 GDPR).",
  "Per il pilota database e documenti stanno su server a Francoforte, nell'Unione europea.",
  "Il cittadino entra con un link personale che scade: niente password da ricordare, niente app.",
  "Ogni accesso al fascicolo resta registrato; il responsabile del CAF consulta ed esporta il registro.",
  "La conservazione la decide il CAF; su richiesta dell'interessato il fascicolo si cancella da Avanti.",
  "All'AI arriva solo ciò che serve al singolo controllo, tramite fornitori impostati per non conservare i dati né usarli per addestrare modelli. Il CAF può spegnerla.",
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
    a: "Per il pilota, database e documenti stanno su server a Francoforte, nell'Unione europea. All'AI arriva solo la parte che serve a ogni compito, mai note interne o altri fascicoli, tramite fornitori impostati per non conservarla e non usarla per addestrare modelli; l'elenco dei fornitori con regioni e garanzie è nell'accordo con il CAF. Prima del primo cittadino vero firmiamo insieme accordo di nomina, valutazione d'impatto e informativa nelle lingue dello sportello.",
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
    a: "Per i CAF pilota è gratuito fino al 31 marzo 2027, intelligenza artificiale inclusa: nessuna chiave da configurare, nessun costo a consumo. Dopo, un canone per sportello che definiamo con i piloti sulla base del tempo risparmiato misurato. Se il pilota non funziona per voi vi fermate: non c'è rinnovo automatico, vi restituiamo i dati e cancelliamo le copie in Avanti.",
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

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        // Static object defined above: no user input reaches it.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-4 pt-10 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pt-16 lg:pb-28">
        <div className="flex flex-col justify-center">
          <p className="mb-6 text-sm font-semibold tracking-[0.01em] text-stamp">
            Per CAF e patronati · Pilota ISEE da gennaio 2027
          </p>
          <h1 className="font-display type-hero">Il fascicolo arriva pronto.</h1>
          <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-ink-2 sm:text-xl">
            Avanti prepara le pratiche ISEE prima dell&apos;appuntamento. Il cittadino risponde dal
            telefono, anche nella sua lingua; allo sportello arriva un fascicolo in ordine, con
            quello che manca già segnalato.
          </p>
          <div className="mt-9 grid gap-3 sm:flex sm:flex-wrap">
            <Button asChild size="lg">
              <a href="#pilota">Parliamo del pilota</a>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <a href="#come-funziona">Guarda come funziona</a>
            </Button>
          </div>
          <ul className="mt-8 grid gap-2 text-ink-2">
            {HERO_FACTS.map((fact) => (
              <li key={fact} className="flex gap-2.5">
                <Check className="mt-1 size-4 shrink-0 text-stamp" aria-hidden />
                {fact}
              </li>
            ))}
          </ul>
          {DEMO_OFFICE && (
            <p className="mt-6 text-ink-2">
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
        <IntakeDemo />
      </section>

      {/* Desk questions */}
      <section aria-labelledby="sportello-title" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="max-w-2xl">
            <h2 id="sportello-title" className="font-display type-section">
              Prima di aprire la pratica, lo sportello fa domande. Sempre le stesse.
            </h2>
            <p className="mt-5 text-lg text-ink-2">
              Capire cosa serve, chiedere i documenti, scoprire cosa manca, richiamare. Avanti fa
              questa parte prima che il cittadino si sieda.
            </p>
          </div>
          <dl className="mt-14 divide-y divide-line border-y border-line">
            {DESK_QUESTIONS.map((item) => (
              <div
                key={item.asked}
                className="grid gap-2 py-7 md:grid-cols-[minmax(0,22rem)_1fr] md:gap-10"
              >
                <dt className="font-display text-xl font-semibold tracking-[-0.01em] text-ink sm:text-2xl">
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
        className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28"
      >
        <h2 id="come-title" className="max-w-2xl font-display type-section">
          Dal «devo fare l&apos;ISEE» al fascicolo, in quattro passaggi.
        </h2>
        <ol className="mt-14 grid gap-10 md:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative">
              <div className="flex items-center gap-3">
                <span className="tabular grid size-9 place-items-center rounded-full bg-stamp font-display text-base font-bold text-on-stamp">
                  {i + 1}
                </span>
                {i < STEPS.length - 1 && (
                  <span aria-hidden className="hidden h-px flex-1 bg-line-strong lg:block" />
                )}
              </div>
              <h3 className="mt-5 font-display text-2xl font-semibold tracking-[-0.015em]">
                {step.title}
              </h3>
              <p className="mt-2 leading-relaxed text-ink-2">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Operators */}
      <section
        id="operatori"
        aria-labelledby="operatori-title"
        className="bg-contrast text-on-contrast"
      >
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-14 px-4 py-20 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:py-28">
          <div>
            <h2 id="operatori-title" className="font-display type-section">
              L&apos;operatore apre il fascicolo e sa già dove guardare.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-on-contrast/75">
              Ogni voce si verifica con un clic, anche da tastiera. Finché manca qualcosa, il
              pulsante principale è «Chiedi integrazione».
            </p>
            <ul className="mt-10 grid gap-5">
              {OPERATOR_FEATURES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex gap-3.5 text-on-contrast/90">
                  <Icon className="mt-0.5 size-5 shrink-0 text-marker" aria-hidden />
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <DossierPreview />
        </div>
      </section>

      {/* Handoff to the CAF's software */}
      <section aria-labelledby="gestionale-title" className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <h2 id="gestionale-title" className="font-display type-subsection">
            Il lavoro prosegue nel vostro gestionale.
          </h2>
          {/* Ruled columns, not a second row of blue discs: the four steps above are the
              citizen's journey, these are what happens after it, at the desk. */}
          <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-10">
            {[
              "L'operatore verifica documenti e mancanti, voce per voce.",
              "Consulta il prospetto DSU nell'ordine del modello: le risposte del cittadino e gli importi letti dai documenti che ha confermato.",
              "Copia i dati e carica nel software del CAF gli originali, scaricati in un solo ZIP già rinominati. La procedura la proviamo insieme prima di partire.",
            ].map((text, i) => (
              <li key={text} className="border-t border-line-strong pt-4">
                <span
                  aria-hidden
                  className="tabular block font-display text-sm font-bold tracking-[0.02em] text-stamp"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="mt-2 leading-relaxed text-ink-2">{text}</p>
              </li>
            ))}
          </ol>
          <p className="mt-8 max-w-3xl text-sm text-ink-3">
            Gli importi letti dall&apos;AI nei documenti restano proposte finché l&apos;operatore
            non li conferma sul file. Avanti non invia nulla agli enti; i collegamenti diretti con i
            gestionali si definiscono con i piloti.
          </p>
        </div>
      </section>

      {/* AI */}
      <section aria-labelledby="ai-title" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <div className="max-w-2xl">
          <h2 id="ai-title" className="font-display type-section">
            L&apos;intelligenza artificiale, dove fa risparmiare tempo.
          </h2>
          <p className="mt-5 text-lg text-ink-2">
            Non un chatbot appoggiato sopra: l&apos;AI lavora dentro il percorso, accanto a regole
            scritte con le fonti ufficiali che decidono cosa chiedere e cosa serve. È inclusa nel
            servizio: niente chiavi da configurare né costi a consumo.
          </p>
        </div>
        {/* Subgrid: the two examples share one row height, so the lists under them start on
            the same line. */}
        <div className="mt-14 grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-y-0">
          {(
            [
              ["Per il cittadino", AI_CITIZEN],
              ["Per l'operatore", AI_OPERATOR],
            ] as const
          ).map(([title, items], index) => (
            <div key={title} className="lg:row-span-3 lg:grid lg:grid-rows-subgrid">
              <h3 className="font-display text-2xl font-semibold tracking-[-0.015em]">{title}</h3>
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
        <div className="mt-14 rounded-lg bg-surface p-6 ring-1 ring-line">
          <h3 className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="size-5 text-stamp" aria-hidden />
            Cosa resta alle persone
          </h3>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
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
          <div className="max-w-2xl">
            <h2 id="lingue-title" className="font-display type-section">
              Ognuno risponde nella sua lingua. Lo sportello legge in italiano.
            </h2>
            <p className="mt-5 text-lg text-ink-2">
              Per chi è arrivato da poco, la parte difficile non è la pratica: è capire cosa
              chiedono. Avanti spiega con parole semplici e lascia in italiano i nomi che si
              troveranno scritti sui documenti.
            </p>
          </div>
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
        className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:py-28"
      >
        <div>
          <h2 id="pratiche-title" className="font-display type-section">
            Si parte dall&apos;ISEE. Il resto segue il calendario dei CAF.
          </h2>
          <p className="mt-5 text-lg text-ink-2">
            Gennaio è il mese più pesante per l&apos;ISEE, aprile apre la campagna 730. Ogni pratica
            arriva quando è verificata con chi la fa ogni giorno.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {FACTS.map((fact) => (
              <p key={fact.value} className="border-t-2 border-ink pt-3">
                <span className="tabular block font-display text-5xl font-bold tracking-[-0.02em]">
                  {fact.value}
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
        <ol className="relative grid gap-0 border-s border-line-strong ps-8">
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
              <h3 className="mt-0.5 font-display text-xl font-semibold tracking-[-0.01em]">
                {p.name}
              </h3>
              <p className={p.live ? "mt-1 font-semibold text-stamp" : "mt-1 text-ink-2"}>
                {p.status}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* Data, security and boundaries */}
      <section id="dati" aria-labelledby="dati-title" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <h2 id="dati-title" className="max-w-2xl font-display type-section">
            Documenti di persone vere, trattati di conseguenza.
          </h2>
          <div className="mt-14 grid gap-14 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
            <div>
              <h3 className="font-display text-2xl font-semibold tracking-[-0.015em]">
                Cosa Avanti non fa, di proposito
              </h3>
              <dl className="mt-6 grid gap-6">
                {NOT_DOING.map((item) => (
                  <div key={item.title} className="border-t border-line pt-4">
                    <dt className="font-semibold">{item.title}</dt>
                    <dd className="mt-1 leading-relaxed text-ink-2">{item.body}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="rounded-xl bg-folder/55 p-6 sm:p-8">
              <h3 className="flex items-center gap-2.5 font-display text-2xl font-semibold tracking-[-0.015em]">
                <ShieldCheck className="size-6 shrink-0 text-stamp" aria-hidden />
                Come trattiamo i dati
              </h3>
              <ul className="mt-6 grid gap-3.5">
                {DATA_FACTS.map((line) => (
                  <li key={line} className="flex gap-2.5 leading-relaxed text-ink-2">
                    <Check className="mt-1 size-4 shrink-0 text-stamp" aria-hidden />
                    {line}
                  </li>
                ))}
              </ul>
              <p className="mt-6 border-t border-ink/10 pt-5 leading-relaxed text-ink-2">
                Prima del primo cittadino vero firmiamo con il CAF l&apos;accordo di nomina e la
                valutazione d&apos;impatto, e prepariamo l&apos;informativa nelle lingue dello
                sportello.
              </p>
              <Link
                href="/sicurezza"
                className="mt-4 inline-block font-semibold text-stamp underline underline-offset-2"
              >
                Tutti i controlli di sicurezza
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Pilot */}
      <section id="pilota" aria-labelledby="pilota-title" className="bg-sunk/60">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:py-28">
          <div>
            <h2 id="pilota-title" className="font-display type-section">
              Cerchiamo tre sportelli per il picco ISEE di gennaio.
            </h2>
            <p className="mt-5 text-lg text-ink-2">
              Gratis fino al 31 marzo 2027, intelligenza artificiale inclusa. Potete fermarvi quando
              volete.
            </p>
            <h3 className="mt-10 font-semibold">Come si svolge</h3>
            <ol className="mt-4 grid gap-0 border-s border-line-strong">
              {PILOT_TIMELINE.map((step) => (
                <li key={step.when} className="relative ps-6 pb-6 last:pb-0">
                  <span
                    aria-hidden
                    className="absolute -start-[5px] top-[7px] size-2.5 rounded-full bg-stamp"
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
            <h3 className="mt-10 font-semibold">La prova che stiamo cercando</h3>
            <p className="mt-3 leading-relaxed text-ink-2">
              Con i primi sportelli misureremo minuti di lavoro, completezza al primo invio e tempo
              di copia nel gestionale. Pubblicheremo metodo, campione e limiti del risultato.
            </p>
          </div>
          <PilotForm />
        </div>
      </section>

      {/* FAQ */}
      <section
        aria-labelledby="faq-title"
        className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:py-28"
      >
        <h2 id="faq-title" className="font-display type-section">
          Domande dei CAF
        </h2>
        <div className="mt-10 divide-y divide-line border-y border-line">
          {FAQ.map((item) => (
            <details key={item.q} className="group">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 rounded-sm py-4 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                {item.q}
                <span
                  aria-hidden
                  className="grid size-7 shrink-0 place-items-center rounded-full text-ink-3 ring-1 ring-line-strong transition-transform duration-200 ease-(--ease-out) group-open:rotate-45"
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
              <p className="max-w-[62ch] pb-6 leading-relaxed text-ink-2">{item.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-8 text-ink-2">
          Un&apos;altra domanda?{" "}
          <a href="#pilota" className="font-semibold text-stamp underline underline-offset-2">
            Scrivetecela nel modulo del pilota
          </a>
          : rispondiamo noi, senza impegno.
        </p>
      </section>
    </>
  );
}
