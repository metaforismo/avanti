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
    body: "Il cittadino accede con un link casuale a 256 bit. Nel fascicolo ne conserviamo solo l'impronta (hash): chi legge il database non può ricostruire i link. L'unica eccezione è l'invito al rinnovo, per cui il link resta cifrato nella coda delle email finché non parte. Ogni link scade; la durata la decide il CAF.",
  },
  {
    title: "Ogni CAF vede solo le sue pratiche",
    body: "L'organizzazione si ricava dalla sessione dell'operatore, mai da quello che arriva dal browser. Pratiche, documenti, export e metriche di un altro CAF risultano inesistenti.",
  },
  {
    title: "Accessi degli operatori",
    body: "Password conservate con scrypt e sale casuale. Verifica in due passaggi con app di autenticazione e codici di recupero, che il CAF può rendere obbligatoria. Sessioni in cookie protetti, con scadenza massima, e controllo dell'origine su ogni modifica per bloccare richieste da altri siti. Tentativi di accesso limitati. Un account disattivato o una sessione chiusa non possono più modificare nulla, nemmeno con una richiesta già partita.",
  },
  {
    title: "Documenti controllati prima di essere accettati",
    body: "Massimo 4 MB per file. Il tipo si riconosce dal contenuto, non dall'estensione dichiarata. I nomi dei file vengono ripuliti e i file si scaricano solo dopo il controllo dei permessi.",
  },
  {
    title: "Registro degli accessi, log senza dati personali",
    body: "Chi ha fatto cosa e quando resta registrato: il responsabile del CAF consulta il registro attività (accessi anche falliti, fascicoli aperti, esportazioni, cancellazioni) e lo esporta. I log tecnici contengono categorie, tempi e conteggi: mai nomi, codici fiscali, contatti o contenuto dei documenti.",
  },
  {
    title: "Conservazione decisa dal CAF",
    body: "Durata dei link e conservazione dei documenti sono configurabili per ogni CAF. Su richiesta del CAF cancelliamo dati e file di un fascicolo da Avanti, senza toccare l'archivio ufficiale del gestionale.",
  },
  {
    title: "Email senza link, salvo l'invito al rinnovo",
    body: "Gli avvisi al cittadino non contengono link né dati della pratica, per non insegnare a cliccare su email che potrebbero essere imitazioni. L'unica email con il link personale è l'invito al rinnovo dell'ISEE: parte solo se il cittadino l'ha chiesto e il CAF ha attivato gli inviti. Le email restano cifrate finché non partono; quelli che il cittadino può far partire da solo, come la ricevuta, sono limitati per destinatario.",
  },
  {
    title: "AI con il minimo indispensabile",
    body: "A ogni compito arriva solo ciò che serve: il messaggio del cittadino con le domande aperte, il singolo documento da leggere, il fascicolo senza contatti, note interne né nomi dei file per il riepilogo dell'operatore. Usiamo fornitori configurati per non conservare i dati e non usarli per addestrare modelli; fornitori, regioni e garanzie sono elencati nell'accordo con il CAF. Avanti non salva le registrazioni vocali. Il testo dei cittadini è trattato come dato, mai come istruzione. Il CAF può spegnere l'AI per i cittadini o per gli operatori: senza AI Avanti funziona con le regole. Nulla di ciò che propone l'AI diventa una risposta o un valore senza la conferma di una persona.",
  },
] as const;

const BEFORE_REAL_DATA = [
  "Accordo di nomina a responsabile del trattamento (art. 28 GDPR)",
  "Valutazione d'impatto (DPIA) per dati economici, minori e salute",
  "Elenco dei fornitori di AI e di hosting che usiamo (subresponsabili): regione e conservazione",
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
