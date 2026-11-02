import type { Metadata } from "next";
import Link from "next/link";
import { Stamp } from "@/components/brand/desk-objects";
import { PageCta, PageHero } from "@/components/landing/page-hero";

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
    body: "A ogni compito arriva solo ciò che serve: il messaggio del cittadino con le domande aperte, il singolo documento da leggere, il fascicolo senza contatti, note interne né nomi dei file per il riepilogo dell'operatore. Fornitori, regioni, conservazione dei dati e uso per l'addestramento sono scritti nell'elenco allegato all'accordo e li approva il CAF prima del primo cittadino; senza garanzie adeguate Avanti lavora con le sole regole. Avanti non salva le registrazioni vocali. Il testo dei cittadini è trattato come dato, mai come istruzione. Dalle impostazioni il CAF può spegnere l'assistente dei cittadini e il copilota degli operatori: senza, intervista e controlli funzionano con le regole. Nulla di ciò che propone l'AI diventa una risposta o un valore senza la conferma di una persona.",
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
    <article>
      <PageHero
        eyebrow="Sicurezza e dati"
        title="Documenti di persone vere, trattati di conseguenza."
        lead={
          <>
            Allo sportello arrivano documenti d&apos;identità, redditi, conti correnti. Ecco come li
            trattiamo, in concreto. Non usiamo parole come «certificato» o «garantito» dove non
            c&apos;è una certificazione.
          </>
        }
      />

      <div className="border-y border-line bg-surface">
        <div
          data-reveal="stagger"
          className="mx-auto grid max-w-6xl gap-x-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-3 lg:py-20"
        >
          {CONTROLS.map((item, i) => (
            <section key={item.title} className="border-t border-line py-6">
              <span aria-hidden className="tabular font-mono text-sm font-bold text-stamp">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2 className="mt-2 font-display text-xl font-semibold">{item.title}</h2>
              <p className="mt-2 leading-relaxed text-ink-2">{item.body}</p>
            </section>
          ))}
        </div>
      </div>

      <section aria-labelledby="before" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <div
          data-reveal
          className="relative mx-auto max-w-3xl rounded-xl bg-surface p-6 shadow-frame ring-1 ring-line sm:p-10"
        >
          <Stamp className="absolute end-6 top-6 hidden text-xs sm:inline-flex">
            <span>Prima del</span>
            <span className="mt-0.5">primo cittadino</span>
          </Stamp>
          <p className="type-eyebrow text-stamp">Da firmare con ogni CAF pilota</p>
          <h2 id="before" className="mt-3 max-w-md font-display type-subsection">
            Prima di trattare dati reali, insieme al CAF
          </h2>
          <p className="mt-3 max-w-xl text-ink-2">
            Il software è una parte. Questi passaggi li completiamo con ogni CAF pilota prima del
            primo cittadino vero:
          </p>
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {BEFORE_REAL_DATA.map((item) => (
              <li key={item} className="flex gap-3 py-3.5">
                {/* An empty box: to be ticked with the CAF, not already done. */}
                <span
                  aria-hidden
                  className="mt-0.5 size-5 shrink-0 rounded-sm ring-1 ring-line-field"
                />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <PageCta title="Documentazione per il vostro DPO">
        <p>
          Hai domande tecniche o vuoi la documentazione completa?{" "}
          <Link href="/#pilota">Scrivici dal modulo del pilota</Link>. Per i cittadini c&apos;è
          l&apos;<Link href="/privacy">informativa privacy</Link>.
        </p>
      </PageCta>
    </article>
  );
}
