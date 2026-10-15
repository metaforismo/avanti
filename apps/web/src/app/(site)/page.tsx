import Link from "next/link";
import { AlertTriangle, Check, Clock3, FileCheck2, Languages, ShieldCheck } from "lucide-react";
import { IntakeDemo } from "@/components/landing/intake-demo";
import { LanguageShowcase } from "@/components/landing/language-showcase";
import { PilotForm } from "@/components/landing/pilot-form";
import { Button } from "@/components/ui/button";

// Public demo office (seeded, fictitious data). Unset in environments without demo data.
const DEMO_OFFICE = process.env.NEXT_PUBLIC_DEMO_OFFICE_SLUG;

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
    body: "Avanti fa solo le domande che mancano, una alla volta. Chi ha già detto «vivo con mia madre» non se lo sente richiedere.",
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
    body: "Sta davanti al software che il CAF usa già. Il fascicolo si esporta in PDF e in un formato strutturato.",
  },
  {
    title: "Non decide al posto delle persone",
    body: "Segnala dubbi e mancanze; ogni voce del fascicolo resta verificabile e modificabile dall'operatore.",
  },
] as const;

const FAQ = [
  {
    q: "Il cittadino deve installare qualcosa o registrarsi?",
    a: "No. Riceve un link personale (o inquadra il QR dello sportello) e lo apre dal browser del telefono. Il link scade da solo dopo un periodo stabilito dal CAF.",
  },
  {
    q: "Chi è titolare dei dati?",
    a: "Il CAF o il patronato, come oggi. Avanti tratta i dati per conto loro, con un accordo di nomina a responsabile del trattamento. Ogni accesso al fascicolo resta registrato.",
  },
  {
    q: "E se il cittadino non sa scrivere bene, o non sa usare il telefono?",
    a: "Le domande sono brevi e hanno risposte già pronte da toccare. Se serve, l'operatore può aprire il fascicolo allo sportello e completarlo insieme a lui.",
  },
  {
    q: "Cosa succede se l'AI sbaglia a riconoscere un documento?",
    a: "Il cittadino vede a quale voce è stato abbinato e può spostarlo. L'operatore vede il grado di certezza e ha sempre l'ultima parola su ogni voce.",
  },
  {
    q: "Funziona con il nostro gestionale?",
    a: "Avanti non lo sostituisce: esporta un fascicolo leggibile e un file strutturato da cui copiare i dati. Le integrazioni dirette le costruiamo con i CAF pilota.",
  },
  {
    q: "Quanto costa?",
    a: "Per i CAF pilota è gratuito fino al 31 marzo 2027. Dopo, un canone per sportello che definiamo insieme ai piloti sulla base del tempo risparmiato misurato.",
  },
] as const;

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl gap-12 px-4 pt-10 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pt-16 lg:pb-28">
        <div className="flex flex-col justify-center">
          <p className="mb-6 inline-flex w-fit items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-sm text-ink-2 ring-1 ring-line">
            <span className="size-1.5 rounded-full bg-ok" aria-hidden />
            Pilota ISEE con i CAF, gennaio 2027
          </p>
          <h1 className="font-display text-[clamp(2.75rem,7vw,5.25rem)] leading-[0.95] font-bold tracking-[-0.035em] [font-stretch:88%]">
            Il fascicolo arriva pronto.
          </h1>
          <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-ink-2 sm:text-xl">
            Avanti è il front office AI per CAF e patronati. Ascolta il cittadino nella sua lingua,
            prepara la checklist, ordina i documenti e segnala cosa va verificato. L&apos;operatore
            controlla il fascicolo e prosegue nel gestionale.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <a href="#pilota">Diventa CAF pilota</a>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <a href="#come-funziona">Guarda come funziona</a>
            </Button>
          </div>
          {DEMO_OFFICE && (
            <p className="mt-5 text-ink-2">
              Vuoi vederlo dal lato del cittadino?{" "}
              <Link
                href={`/s/${DEMO_OFFICE}`}
                className="font-semibold text-stamp underline underline-offset-4"
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
            <h2
              id="sportello-title"
              className="font-display text-[clamp(2rem,4.2vw,3.25rem)] leading-[1.02] font-bold tracking-[-0.03em] [font-stretch:90%]"
            >
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
        <h2
          id="come-title"
          className="max-w-2xl font-display text-[clamp(2rem,4.2vw,3.25rem)] leading-[1.02] font-bold tracking-[-0.03em] [font-stretch:90%]"
        >
          Dal «devo fare l&apos;ISEE» al fascicolo, in quattro passaggi.
        </h2>
        <ol className="mt-14 grid gap-10 md:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative">
              <div className="flex items-center gap-3">
                <span className="tabular grid size-9 place-items-center rounded-full bg-stamp font-display text-base font-bold text-white">
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
      <section id="operatori" aria-labelledby="operatori-title" className="bg-ink text-white">
        <div className="mx-auto grid max-w-6xl gap-14 px-4 py-20 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:py-28">
          <div>
            <h2
              id="operatori-title"
              className="font-display text-[clamp(2rem,4.2vw,3.25rem)] leading-[1.02] font-bold tracking-[-0.03em] [font-stretch:90%]"
            >
              L&apos;operatore apre il fascicolo e sa già dove guardare.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-white/75">
              Prima i problemi bloccanti, poi gli avvisi, poi tutto il resto. Ogni voce si verifica
              con un clic; le integrazioni si chiedono nel link del cittadino, nella sua lingua.
            </p>
            <ul className="mt-10 grid gap-5">
              {[
                {
                  icon: FileCheck2,
                  text: "Documenti rinominati e ordinati per persona, non IMG_2847.jpg",
                },
                {
                  icon: AlertTriangle,
                  text: "Scadenze, anni sbagliati e pagine mancanti segnalati in cima",
                },
                {
                  icon: Languages,
                  text: "Console in italiano; il cittadino usa una delle otto lingue e l'originale resta consultabile",
                },
                {
                  icon: Clock3,
                  text: "Tempi, mancanti e integrazioni misurati pratica per pratica: nel pilota li confrontiamo con il vostro flusso abituale",
                },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex gap-3.5 text-white/90">
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
          <h2
            id="gestionale-title"
            className="font-display text-[clamp(1.75rem,3.4vw,2.5rem)] leading-[1.05] font-bold tracking-[-0.025em] [font-stretch:90%]"
          >
            Il lavoro prosegue nel vostro gestionale.
          </h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              "L'operatore verifica documenti e mancanti, voce per voce.",
              "Consulta il prospetto DSU, nell'ordine del modello, con la fonte di ogni campo; scarica il riepilogo PDF o i dati JSON.",
              "Copia i dati e carica gli originali nel software del CAF, con la procedura provata insieme durante l'avvio.",
            ].map((text, i) => (
              <li key={text} className="flex gap-4">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-stamp font-display font-bold text-on-stamp">
                  {i + 1}
                </span>
                <p className="text-ink-2">{text}</p>
              </li>
            ))}
          </ol>
          <p className="mt-8 max-w-3xl text-sm text-ink-3">
            Avanti non legge gli importi dai documenti e non invia nulla agli enti: saldi e redditi
            li legge l&apos;operatore nel documento indicato. Le integrazioni dirette con i
            gestionali si definiscono con i piloti.
          </p>
        </div>
      </section>

      {/* Languages */}
      <section
        id="lingue"
        aria-labelledby="lingue-title"
        className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28"
      >
        <div className="max-w-2xl">
          <h2
            id="lingue-title"
            className="font-display text-[clamp(2rem,4.2vw,3.25rem)] leading-[1.02] font-bold tracking-[-0.03em] [font-stretch:90%]"
          >
            Ognuno risponde nella sua lingua. Lo sportello legge in italiano.
          </h2>
          <p className="mt-5 text-lg text-ink-2">
            Per chi è arrivato da poco, la parte difficile non è la pratica: è capire cosa chiedono.
            Avanti spiega con parole semplici e lascia in italiano i nomi che si troveranno scritti
            sui documenti.
          </p>
        </div>
        {/* Skipped until near the viewport: its Arabic and Bengali glyphs (270 KB of fonts) are
            then fetched only by visitors who scroll this far. */}
        <div className="mt-12 [contain-intrinsic-size:auto_32rem] [content-visibility:auto]">
          <LanguageShowcase />
        </div>
      </section>

      {/* Practices */}
      <section
        id="pratiche"
        aria-labelledby="pratiche-title"
        className="border-y border-line bg-surface"
      >
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:py-28">
          <div>
            <h2
              id="pratiche-title"
              className="font-display text-[clamp(2rem,4.2vw,3.25rem)] leading-[1.02] font-bold tracking-[-0.03em] [font-stretch:90%]"
            >
              Si parte dall&apos;ISEE. Il resto segue il calendario dei CAF.
            </h2>
            <p className="mt-5 text-lg text-ink-2">
              Gennaio è il mese più pesante per l&apos;ISEE, aprile apre la campagna 730. Ogni
              pratica arriva quando è verificata con chi la fa ogni giorno.
            </p>
            <dl className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {FACTS.map((fact) => (
                <div key={fact.value} className="border-t-2 border-ink pt-3">
                  <dt className="sr-only">{fact.label}</dt>
                  <dd className="tabular font-display text-5xl font-bold tracking-[-0.03em]">
                    {fact.value}
                  </dd>
                  <dd className="mt-1 text-ink-2">{fact.label}</dd>
                  <dd className="mt-1 text-sm">
                    <a
                      href={fact.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ink-3 underline underline-offset-2 hover:text-ink"
                    >
                      {fact.source}
                    </a>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <ol className="relative grid gap-0 border-s border-line-strong ps-8">
            {PRACTICES.map((p) => (
              <li key={p.name} className="relative pb-8 last:pb-0">
                <span
                  aria-hidden
                  className={
                    p.live
                      ? "absolute top-1.5 -left-[2.4rem] size-3.5 rounded-full bg-stamp ring-4 ring-stamp-wash"
                      : "absolute top-1.5 -left-[2.3rem] size-3 rounded-full bg-surface ring-2 ring-line-strong"
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
        </div>
      </section>

      {/* Boundaries + privacy */}
      <section
        aria-labelledby="limiti-title"
        className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28"
      >
        <h2
          id="limiti-title"
          className="max-w-2xl font-display text-[clamp(2rem,4.2vw,3.25rem)] leading-[1.02] font-bold tracking-[-0.03em] [font-stretch:90%]"
        >
          Cosa Avanti non fa, di proposito.
        </h2>
        <div className="mt-12 grid gap-10 md:grid-cols-3">
          {NOT_DOING.map((item) => (
            <div key={item.title}>
              <h3 className="font-display text-xl font-semibold tracking-[-0.01em]">
                {item.title}
              </h3>
              <p className="mt-2 leading-relaxed text-ink-2">{item.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col gap-5 rounded-xl bg-folder/55 p-6 sm:flex-row sm:items-start sm:p-8">
          <ShieldCheck className="size-7 shrink-0 text-stamp" aria-hidden />
          <div>
            <h3 className="font-display text-xl font-semibold tracking-[-0.01em]">
              Documenti di persone vere, trattati di conseguenza
            </h3>
            <p className="mt-2 max-w-3xl leading-relaxed text-ink-2">
              Il CAF resta titolare dei dati. Il cittadino accede con un link personale che scade,
              senza password da ricordare. Ogni accesso al fascicolo è registrato, la durata di
              conservazione la decide il CAF e l&apos;AI riceve solo ciò che serve a controllare il
              singolo documento.
            </p>
            <Link
              href="/sicurezza"
              className="mt-4 inline-block font-semibold text-stamp underline underline-offset-4"
            >
              Come proteggiamo i dati
            </Link>
          </div>
        </div>
      </section>

      {/* Pilot */}
      <section
        id="pilota"
        aria-labelledby="pilota-title"
        className="border-t border-line bg-sunk/60"
      >
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:py-28">
          <div>
            <h2
              id="pilota-title"
              className="font-display text-[clamp(2rem,4.2vw,3.25rem)] leading-[1.02] font-bold tracking-[-0.03em] [font-stretch:90%]"
            >
              Cerchiamo tre sportelli per il picco ISEE di gennaio.
            </h2>
            <p className="mt-5 text-lg text-ink-2">
              Installazione e formazione tra novembre e dicembre, uso vero a gennaio. Gratis fino al
              31 marzo 2027.
            </p>
            <h3 className="mt-10 font-semibold">In cambio vi chiediamo</h3>
            <ul className="mt-3 grid gap-3 text-ink-2">
              {[
                "Una settimana di misure prima di iniziare, per avere un punto di partenza onesto",
                "Mezz'ora a settimana per dirci cosa non funziona",
                "Il permesso di raccontare i risultati, anche se non sono quelli sperati",
              ].map((text) => (
                <li key={text} className="flex gap-3">
                  <Check className="mt-1 size-4 shrink-0 text-ok" aria-hidden />
                  {text}
                </li>
              ))}
            </ul>
            <h3 className="mt-10 font-semibold">La prova che stiamo cercando</h3>
            <p className="mt-3 text-ink-2">
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
        <h2
          id="faq-title"
          className="font-display text-[clamp(2rem,4.2vw,3rem)] leading-[1.02] font-bold tracking-[-0.03em] [font-stretch:90%]"
        >
          Domande dei CAF
        </h2>
        <div className="mt-10 divide-y divide-line border-y border-line">
          {FAQ.map((item) => (
            <details key={item.q} className="group py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 rounded-sm py-4 text-lg font-semibold [&::-webkit-details-marker]:hidden">
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
              <p className="pb-5 leading-relaxed text-ink-2">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}

/** Static, labelled example of the operator dossier view. */
function DossierPreview() {
  const rows = [
    { label: "Documento d'identità, Anna Rossi", state: "warn", note: "Scade il 12/01/2027" },
    { label: "Saldo e giacenza media 2025, conto Fineco", state: "block", note: "Non caricato" },
    { label: "Redditi 2025, Mario Rossi", state: "ok", note: "Certificazione Unica 2026" },
    { label: "Visura catastale, casa di proprietà", state: "ok", note: "1 immobile" },
    { label: "Targa del veicolo", state: "ok", note: "Dichiarata dal cittadino" },
  ] as const;
  return (
    <figure className="self-center rounded-xl bg-paper text-ink shadow-float ring-1 ring-white/10">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
        <div>
          <p className="font-display text-lg font-semibold tracking-[-0.01em]">
            ISEE ordinario 2027
          </p>
          <p className="text-sm text-ink-3">Mario Rossi, nucleo di 3 persone</p>
        </div>
        <span className="rounded-full bg-warn-wash px-2.5 py-1 text-sm font-semibold text-warn">
          12 di 13 documenti
        </span>
      </div>
      <ul className="divide-y divide-line">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
            <span
              className={
                row.state === "ok"
                  ? "grid size-6 shrink-0 place-items-center rounded-full bg-ok-wash text-ok"
                  : row.state === "warn"
                    ? "grid size-6 shrink-0 place-items-center rounded-full bg-warn-wash text-warn"
                    : "grid size-6 shrink-0 place-items-center rounded-full bg-danger-wash text-danger"
              }
              role="img"
              aria-label={
                row.state === "ok" ? "Presente" : row.state === "warn" ? "Avviso" : "Mancante"
              }
            >
              {row.state === "ok" ? (
                <Check className="size-3.5" />
              ) : (
                <AlertTriangle className="size-3.5" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{row.label}</span>
              <span className="block text-sm text-ink-3">{row.note}</span>
            </span>
          </li>
        ))}
      </ul>
      <figcaption className="rounded-b-xl border-t border-line bg-sunk px-5 py-3 text-sm text-ink-3 sm:px-6">
        Esempio con dati inventati
      </figcaption>
    </figure>
  );
}
