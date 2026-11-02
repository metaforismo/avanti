import type { Metadata } from "next";
import { PageHero } from "@/components/landing/page-hero";
import { Notice } from "@/components/ui/notice";

export const metadata: Metadata = { title: "Privacy" };

const SECTIONS = [
  {
    id: "chi",
    title: "Chi tratta i dati",
    body: [
      "Quando usi Avanti per preparare una pratica, il titolare del trattamento è il CAF o il patronato che ti ha dato il link: il suo nome è in cima alla pagina della tua pratica e lo sportello ti dà i recapiti e l'informativa completa. Avanti tratta i dati per suo conto, come responsabile del trattamento, sulla base di un accordo scritto.",
      // DA DECIDERE: denominazione legale, sede ed email di contatto del titolare per il modulo
      // del pilota. Non inventarli: vanno inseriti quando la società è definita.
      "Per il modulo di candidatura al pilota di questo sito il titolare è il team di Avanti.",
    ],
  },
  {
    id: "quali",
    title: "Quali dati e perché",
    body: [
      "Le risposte alle domande, i dati delle persone del nucleo che indichi e i documenti che carichi. Servono solo a preparare la pratica che hai chiesto e a consegnarla all'operatore.",
      "Un assistente automatico ti aiuta a rispondere: legge i tuoi messaggi (e la voce, se scegli di parlare) per proporti le risposte, che diventano tali solo quando le confermi. Avanti non conserva la registrazione vocale: serve solo a ottenere il testo, che resta nella pratica.",
      "I documenti vengono analizzati automaticamente per riconoscerne tipo, anno, intestatario e leggibilità. L'esito è sempre verificato da un operatore: nessuna decisione viene presa solo in modo automatico.",
      "Per questi controlli inviamo ai fornitori di intelligenza artificiale solo la parte di dati necessaria a ciascun controllo. L'elenco dei fornitori, con regioni, conservazione dei dati e uso per l'addestramento, è nell'accordo tra Avanti e il CAF, che lo approva.",
      "Se inserisci dati di familiari, il CAF li tratta solo per la stessa pratica: chiedi allo sportello l'informativa anche per loro.",
    ],
  },
  {
    id: "quanto",
    title: "Per quanto tempo",
    body: [
      "Il link personale scade dopo il periodo stabilito dal CAF. Alla fine del periodo di conservazione scelto dal CAF il fascicolo e i documenti vengono cancellati da Avanti automaticamente; eventuali obblighi di conservazione a carico del CAF riguardano il suo archivio.",
      "Le candidature inviate con il modulo «Diventa CAF pilota» vengono cancellate automaticamente due anni dopo l'invio.",
    ],
  },
  {
    id: "rinnovi",
    title: "L'anno dopo: rinnovi",
    body: [
      "Se torni dallo stesso CAF, il nuovo fascicolo può partire dal nucleo e dai documenti ancora validi dell'anno prima: le persone le confermi tu, le risposte su redditi e patrimonio si danno di nuovo.",
      "Nel riepilogo puoi scegliere di ricevere un'email quando è il momento di rinnovare l'ISEE: contiene il tuo link personale e arriva solo se l'hai chiesta. Puoi cambiare idea quando vuoi dalla pagina della tua pratica o chiedendolo allo sportello.",
    ],
  },
  {
    id: "diritti",
    title: "I tuoi diritti",
    body: [
      "Puoi chiedere accesso, rettifica, cancellazione o limitazione dei dati, opporti al trattamento e, quando spetta, ricevere i dati in un formato leggibile da una macchina, rivolgendoti al CAF o al patronato. Puoi revocare in qualsiasi momento il consenso agli avvisi di rinnovo.",
      "Puoi presentare reclamo al Garante per la protezione dei dati personali.",
    ],
  },
] as const;

export default function PrivacyPage() {
  return (
    <article>
      <PageHero
        eyebrow="Privacy"
        title="Informativa privacy"
        lead="In breve: i dati servono a preparare la tua pratica e restano sotto il controllo del CAF che hai scelto."
      >
        <Notice tone="warn" className="max-w-2xl">
          Versione preliminare per il programma pilota, in revisione legale prima del lancio.
        </Notice>
      </PageHero>

      <div className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-16 lg:py-20">
          <nav aria-label="In questa pagina" className="lg:sticky lg:top-24 lg:self-start">
            <p className="type-eyebrow text-ink-3">In questa pagina</p>
            <ol className="mt-3 grid border-s border-line">
              {SECTIONS.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="-ms-px flex min-h-10 items-center border-s-2 border-transparent ps-4 text-body-sm text-ink-2 transition-colors hover:border-stamp hover:text-ink"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <div className="grid max-w-2xl gap-12">
            {SECTIONS.map((section) => (
              <section
                key={section.id}
                id={section.id}
                aria-labelledby={`${section.id}-title`}
                data-reveal
                className="scroll-mt-24"
              >
                <h2 id={`${section.id}-title`} className="font-display type-title">
                  {section.title}
                </h2>
                {section.body.map((p) => (
                  <p key={p} className="mt-3 leading-relaxed text-ink-2">
                    {p}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
