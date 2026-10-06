import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sicurezza e dati",
  description:
    "Come Avanti protegge i documenti dei cittadini: ruoli GDPR, link personali, isolamento tra CAF, controllo dei file, audit e uso dell'AI.",
};

// Every statement here must match what the code does (see docs/SECURITY.md). No certifications
// or guarantees that are not in place.
const CONTROLS = [
  {
    title: "Il CAF resta titolare dei dati",
    body: "Avanti tratta i fascicoli per conto del CAF o del patronato, come responsabile ai sensi dell'art. 28 GDPR, con un accordo scritto. I fascicoli non vengono usati per marketing né per addestrare modelli.",
  },
  {
    title: "Link personali, non password",
    body: "Il cittadino accede con un link casuale a 256 bit. Nel database ne conserviamo solo l'impronta (hash): chi legge il database non può ricostruire i link. Ogni link scade; la durata la decide il CAF.",
  },
  {
    title: "Ogni CAF vede solo le sue pratiche",
    body: "L'organizzazione si ricava dalla sessione dell'operatore, mai da quello che arriva dal browser. Pratiche, documenti, export e metriche di un altro CAF risultano inesistenti.",
  },
  {
    title: "Accessi degli operatori",
    body: "Password conservate con scrypt e sale casuale. Sessioni in cookie protetti, con scadenza massima, e controllo dell'origine su ogni modifica per bloccare richieste da altri siti. Tentativi di accesso limitati.",
  },
  {
    title: "Documenti controllati prima di essere accettati",
    body: "Massimo 4 MB per file. Il tipo si riconosce dal contenuto, non dall'estensione dichiarata. I nomi dei file vengono ripuliti e i file si scaricano solo dopo il controllo dei permessi.",
  },
  {
    title: "Registro degli accessi, log senza dati personali",
    body: "Chi ha fatto cosa e quando resta registrato nel fascicolo. I log tecnici contengono categorie, tempi e conteggi: mai nomi, codici fiscali, contatti o contenuto dei documenti.",
  },
  {
    title: "Conservazione decisa dal CAF",
    body: "Durata dei link e conservazione dei documenti sono configurabili per ogni CAF. Su richiesta del CAF cancelliamo dati e file di un fascicolo da Avanti, senza toccare l'archivio ufficiale del gestionale.",
  },
  {
    title: "AI con il minimo indispensabile",
    body: "Al modello arriva solo il testo del singolo turno o il singolo documento da controllare, mai note interne o altri fascicoli. Senza chiave AI Avanti funziona comunque, con controlli locali. Ogni risultato automatico resta verificabile e modificabile dall'operatore.",
  },
] as const;

const BEFORE_REAL_DATA = [
  "Accordo di nomina a responsabile del trattamento (art. 28 GDPR)",
  "Valutazione d'impatto (DPIA) per dati economici, minori e salute",
  "Scelta dei fornitori AI e di hosting: regione, conservazione, subresponsabili",
  "Durate di conservazione e procedura per le richieste degli interessati",
  "Informativa per i cittadini nelle lingue usate allo sportello",
] as const;

export default function SecurityPage() {
  return (
    <article className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:py-24">
      <h1 className="max-w-2xl font-display text-[clamp(2.25rem,5vw,3.5rem)] leading-none font-bold tracking-[-0.03em] [font-stretch:90%]">
        Sicurezza e dati
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-ink-2">
        Allo sportello arrivano documenti d&apos;identità, redditi, conti correnti. Ecco come li
        trattiamo, in concreto. Non usiamo parole come «certificato» o «garantito» dove non c&apos;è
        una certificazione.
      </p>

      <div className="mt-14 grid gap-x-12 gap-y-10 md:grid-cols-2">
        {CONTROLS.map((item) => (
          <section key={item.title}>
            <h2 className="font-display text-xl font-semibold tracking-[-0.01em]">{item.title}</h2>
            <p className="mt-2 leading-relaxed text-ink-2">{item.body}</p>
          </section>
        ))}
      </div>

      <section className="mt-16 rounded-xl bg-folder/55 p-6 sm:p-8" aria-labelledby="before">
        <h2 id="before" className="font-display text-2xl font-semibold tracking-[-0.015em]">
          Prima di trattare dati reali, insieme al CAF
        </h2>
        <p className="mt-2 max-w-2xl text-ink-2">
          Il software è una parte. Questi passaggi li completiamo con ogni CAF pilota prima del
          primo cittadino vero:
        </p>
        <ul className="mt-5 grid gap-2.5">
          {BEFORE_REAL_DATA.map((item) => (
            <li key={item} className="flex gap-3">
              <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-stamp" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-12 text-ink-2">
        Hai domande tecniche o vuoi la documentazione completa per il vostro DPO?{" "}
        <Link href="/#pilota" className="font-semibold text-stamp underline underline-offset-2">
          Scrivici dal modulo del pilota
        </Link>
        . Per i cittadini c&apos;è l&apos;
        <Link href="/privacy" className="font-semibold text-stamp underline underline-offset-2">
          informativa privacy
        </Link>
        .
      </p>
    </article>
  );
}
