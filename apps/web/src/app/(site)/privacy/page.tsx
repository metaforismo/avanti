import type { Metadata } from "next";
import { Notice } from "@/components/ui/notice";

export const metadata: Metadata = { title: "Privacy" };

const SECTIONS = [
  {
    title: "Chi tratta i dati",
    body: [
      "Quando usi Avanti per preparare una pratica, il titolare del trattamento è il CAF o il patronato che ti ha dato il link: il suo nome è in cima alla pagina della tua pratica e lo sportello ti dà i recapiti e l'informativa completa. Avanti tratta i dati per suo conto, come responsabile del trattamento, sulla base di un accordo scritto.",
      "Per il modulo «Diventa CAF pilota» di questo sito il titolare è il team di Avanti.",
    ],
  },
  {
    title: "Quali dati e perché",
    body: [
      "Le risposte alle domande, i dati delle persone del nucleo che indichi e i documenti che carichi. Servono solo a preparare la pratica che hai chiesto e a consegnarla all'operatore.",
      "Un assistente automatico ti aiuta a rispondere: legge i tuoi messaggi (e la voce, se scegli di parlare) per proporti le risposte, che diventano tali solo quando le confermi. Avanti non conserva la registrazione vocale: serve solo a ottenere il testo, che resta nella pratica.",
      "I documenti vengono analizzati automaticamente per riconoscerne tipo, anno, intestatario e leggibilità. L'esito è sempre verificato da un operatore: nessuna decisione viene presa solo in modo automatico.",
      "Per questi controlli usiamo fornitori di intelligenza artificiale configurati per non conservare i dati e non usarli per addestrare modelli, e inviamo solo la parte di dati necessaria a ciascun controllo. L'elenco dei fornitori e le garanzie sono nell'accordo tra Avanti e il CAF.",
      "Se inserisci dati di familiari, il CAF li tratta solo per la stessa pratica: chiedi allo sportello l'informativa anche per loro.",
    ],
  },
  {
    title: "Per quanto tempo",
    body: [
      "Il link personale scade dopo il periodo stabilito dal CAF. Alla fine del periodo di conservazione scelto dal CAF il fascicolo e i documenti vengono cancellati da Avanti automaticamente; eventuali obblighi di conservazione a carico del CAF riguardano il suo archivio.",
    ],
  },
  {
    title: "L'anno dopo: rinnovi",
    body: [
      "Se torni dallo stesso CAF, il nuovo fascicolo può partire dal nucleo e dai documenti ancora validi dell'anno prima: le persone le confermi tu, le risposte su redditi e patrimonio si danno di nuovo.",
      "Nel riepilogo puoi scegliere di ricevere un'email quando è il momento di rinnovare l'ISEE: contiene il tuo link personale e arriva solo se l'hai chiesta. Puoi cambiare idea quando vuoi dalla pagina della tua pratica o chiedendolo allo sportello.",
    ],
  },
  {
    title: "I tuoi diritti",
    body: [
      "Puoi chiedere accesso, rettifica, cancellazione o limitazione dei dati, opporti al trattamento e, quando spetta, ricevere i dati in un formato leggibile da una macchina, rivolgendoti al CAF o al patronato. Puoi revocare in qualsiasi momento il consenso agli avvisi di rinnovo.",
      "Puoi presentare reclamo al Garante per la protezione dei dati personali.",
    ],
  },
] as const;

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:py-24">
      <h1 className="font-display type-page">Informativa privacy</h1>
      <p className="mt-5 text-lg text-ink-2">
        In breve: i dati servono a preparare la tua pratica e restano sotto il controllo del CAF che
        hai scelto.
      </p>
      <div className="mt-12 grid gap-10">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="font-display text-2xl font-semibold tracking-[-0.01em]">
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
      <Notice tone="warn" className="mt-14">
        Versione preliminare per il programma pilota, in revisione legale prima del lancio.
      </Notice>
    </article>
  );
}
