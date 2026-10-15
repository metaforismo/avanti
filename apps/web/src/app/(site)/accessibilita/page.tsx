import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Accessibilità",
  description:
    "Come Avanti è pensato per chi usa uno screen reader, la tastiera, una lingua diversa dall'italiano o un telefono vecchio, e cosa verifichiamo a ogni rilascio.",
};

// Only what the product does and what the automated suite checks: no conformance claims.
const PRACTICES = [
  {
    title: "Per chi non legge bene l'italiano",
    body: "Il percorso del cittadino è in otto lingue, arabo da destra a sinistra compreso, con frasi brevi a livello A2. I nomi dei documenti restano in italiano, con una spiegazione accanto, perché sono quelli che troverà scritti. Si può rispondere toccando un'opzione, scrivendo con parole proprie o parlando.",
  },
  {
    title: "Per chi usa la tastiera o uno screen reader",
    body: "Ogni azione si raggiunge da tastiera, con il focus sempre visibile. Titoli, campi, errori e avvisi hanno nomi e ruoli espliciti; i cambiamenti importanti (un documento controllato, una risposta dell'assistente) vengono annunciati. Nella console le scorciatoie, come «/» per cercare, si possono ignorare.",
  },
  {
    title: "Per chi vede poco o è sensibile al movimento",
    body: "Testi e controlli rispettano i contrasti WCAG in tema chiaro e scuro, verificati a ogni rilascio. Le animazioni si spengono quando il sistema chiede movimento ridotto.",
  },
  {
    title: "Per chi ha un telefono vecchio o poca rete",
    body: "Nessuna app e nessun account: il link si apre dal browser. Le foto vengono ridotte sul telefono prima dell'invio e, se la rete cade, il caricamento si può riprovare senza scegliere di nuovo il file. Si può interrompere e riprendere quando si vuole.",
  },
] as const;

const CHECKS = [
  "Controlli automatici axe sulle regole WCAG 2.0, 2.1 e 2.2 livelli A e AA a ogni rilascio",
  "Sito pubblico, primo passo del cittadino in italiano, arabo e bengalese",
  "Pagine della console in tema chiaro e scuro, fascicolo compreso",
  "Percorso completo del cittadino su un telefono di piccole dimensioni",
] as const;

export default function AccessibilityPage() {
  return (
    <article className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:py-24">
      <h1 className="max-w-2xl font-display text-[clamp(2.25rem,5vw,3.5rem)] leading-none font-bold tracking-[-0.03em] [font-stretch:90%]">
        Accessibilità
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-ink-2">
        Allo sportello arriva chiunque. Avanti è pensato prima di tutto per chi fa più fatica con la
        burocrazia: chi è arrivato da poco, chi non vede bene, chi ha solo il telefono.
      </p>

      <div className="mt-14 grid gap-x-12 gap-y-10 md:grid-cols-2">
        {PRACTICES.map((item) => (
          <section key={item.title}>
            <h2 className="font-display text-xl font-semibold tracking-[-0.01em]">{item.title}</h2>
            <p className="mt-2 leading-relaxed text-ink-2">{item.body}</p>
          </section>
        ))}
      </div>

      <section className="mt-16 rounded-xl bg-folder/55 p-6 sm:p-8" aria-labelledby="checks">
        <h2 id="checks" className="font-display text-2xl font-semibold tracking-[-0.015em]">
          Cosa verifichiamo
        </h2>
        <p className="mt-2 max-w-2xl text-ink-2">
          I controlli automatici trovano solo una parte dei problemi: non dichiariamo una conformità
          che non è stata valutata da terzi. Nel pilota proviamo il percorso anche con persone che
          usano tecnologie assistive.
        </p>
        <ul className="mt-5 grid gap-2.5">
          {CHECKS.map((item) => (
            <li key={item} className="flex gap-3">
              <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-stamp" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-12 text-ink-2">
        Hai trovato un ostacolo? Diccelo dal{" "}
        <Link href="/#pilota" className="font-semibold text-stamp underline underline-offset-2">
          modulo di contatto
        </Link>
        : se sei un cittadino, puoi anche chiedere aiuto allo sportello del tuo CAF.
      </p>
    </article>
  );
}
