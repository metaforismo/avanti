import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Aiuto" };

const QUEUE = [
  ["Da revisionare", "Inviate dal cittadino, nessuno le ha ancora toccate. Si parte da qui."],
  ["In revisione", "Qualcuno ci sta lavorando."],
  [
    "Attesa cittadino",
    "Hai chiesto un'integrazione. Tornano da revisionare quando il cittadino reinvia.",
  ],
  ["Pronte", "Verificate, da inserire nel gestionale."],
  ["In compilazione", "Il cittadino non ha ancora inviato: puoi guardarle, non revisionarle."],
] as const;

const FAQ = [
  [
    "Il cittadino dice che il link non funziona.",
    'Se è scaduto, crea una nuova pratica. Se è "non valido", probabilmente non l\'ha copiato per intero.',
  ],
  [
    "Il cittadino non ha lo smartphone.",
    "Apri il suo link sul tuo computer e compilalo insieme a lui, oppure lavora come sempre: Avanti non è obbligatorio.",
  ],
  ["Ho rifiutato un documento per sbaglio.", "Premi ↺ sulla voce per annullare la decisione."],
  [
    "Un documento è sulla voce sbagliata.",
    "Il cittadino può spostarlo; se serve, chiedigli un'integrazione indicando la voce giusta.",
  ],
  [
    "Il controllo automatico dice una cosa sbagliata.",
    "Può succedere: la decisione è tua. Il ? accanto a un documento indica un riconoscimento incerto.",
  ],
] as const;

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:py-8">
      <h1 className="font-display text-3xl font-bold tracking-[-0.025em]">Aiuto</h1>
      <p className="mt-2 text-lg text-ink-2">
        Avanti prepara la pratica prima che il cittadino arrivi. Tu verifichi e decidi; la pratica
        ufficiale si fa come sempre nel vostro gestionale.
      </p>

      <section className="mt-10" aria-labelledby="flow">
        <h2 id="flow" className="font-display text-xl font-semibold">
          Una pratica, dall&apos;inizio alla fine
        </h2>
        <ol className="mt-4 grid gap-4">
          {[
            [
              "Il cittadino inizia",
              "Inquadra il QR in sala d'attesa o apre il link che gli mandi da Nuova pratica. Racconta, risponde, fotografa i documenti.",
            ],
            [
              "Trovi il fascicolo in coda",
              "Cosa manca e cosa non torna sono in cima, raggruppati per persona.",
            ],
            [
              "Verifichi o chiedi",
              "Verifica, Rifiuta (con un motivo che il cittadino legge tradotto) o Non serve. Per quello che manca: Chiedi integrazione.",
            ],
            ["Chiudi", "Segna come pronta, scarica PDF o JSON per il gestionale, archivia."],
          ].map(([title, body], i) => (
            <li key={title} className="flex gap-4">
              <span className="tabular grid size-8 shrink-0 place-items-center rounded-full bg-stamp font-display font-bold text-on-stamp">
                {i + 1}
              </span>
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-0.5 text-ink-2">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10" aria-labelledby="queue">
        <h2 id="queue" className="font-display text-xl font-semibold">
          Gli stati della coda
        </h2>
        <dl className="mt-4 divide-y divide-line rounded-lg bg-surface ring-1 ring-line">
          {QUEUE.map(([term, description]) => (
            <div key={term} className="grid gap-1 px-4 py-3 sm:grid-cols-[12rem_1fr]">
              <dt className="font-semibold">{term}</dt>
              <dd className="text-ink-2">{description}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-10" aria-labelledby="good">
        <h2 id="good" className="font-display text-xl font-semibold">
          Da sapere
        </h2>
        <ul className="mt-4 grid gap-3 text-ink-2">
          <li>
            La revisione e il cronometro partono alla tua prima azione, non quando apri la pratica.
          </li>
          <li>Il link del cittadino è personale: non incollarlo in gruppi o email condivise.</li>
          <li>Le note interne si salvano da sole e non le vede il cittadino.</li>
          <li>
            Nel visore dei documenti le frecce ← → passano al documento precedente o successivo.
          </li>
          <li>
            Il cartello per la sala d&apos;attesa si stampa da{" "}
            <Link
              href="/console/sportelli"
              className="font-semibold text-stamp underline underline-offset-2"
            >
              Sportelli e QR
            </Link>
            .
          </li>
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="faq">
        <h2 id="faq" className="font-display text-xl font-semibold">
          Domande frequenti
        </h2>
        <div className="mt-4 divide-y divide-line border-y border-line">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-1">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-2 font-semibold [&::-webkit-details-marker]:hidden">
                {q}
                <span aria-hidden className="text-ink-3 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="pb-4 text-ink-2">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
