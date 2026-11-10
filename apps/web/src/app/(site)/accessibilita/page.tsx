import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { PageCta, PageHero } from "@/components/landing/page-hero";
import { RuleList } from "@/components/landing/rule-list";

export const metadata: Metadata = {
  title: "Accessibilità",
  description:
    "Come Avanti è pensato per chi usa uno screen reader, la tastiera, una lingua diversa dall’italiano o un telefono vecchio, e cosa verifichiamo a ogni rilascio.",
};

// Only what the product does and what the automated suite checks: no conformance claims.
const PRACTICES = [
  {
    title: "Per chi non legge bene l’italiano",
    summary: "Otto lingue, frasi brevi, risposte anche a voce.",
    body: "Il percorso del cittadino è in otto lingue, arabo da destra a sinistra compreso, con frasi brevi a livello A2. I nomi dei documenti restano in italiano, con una spiegazione accanto, perché sono quelli che troverà scritti. Si può rispondere toccando un’opzione, scrivendo con parole proprie o parlando.",
  },
  {
    title: "Per chi usa la tastiera o uno screen reader",
    summary: "Tutto da tastiera, focus visibile, cambiamenti annunciati.",
    body: "Ogni azione si raggiunge da tastiera, con il focus sempre visibile. Titoli, campi, errori e avvisi hanno nomi e ruoli espliciti; i cambiamenti importanti (un documento controllato, una risposta dell’assistente) vengono annunciati. Nella console le scorciatoie, come «/» per cercare, si possono ignorare.",
  },
  {
    title: "Per chi vede poco o è sensibile al movimento",
    summary: "Contrasti verificati, animazioni che si spengono.",
    body: "Testi e controlli rispettano i contrasti WCAG in tema chiaro e scuro, verificati a ogni rilascio. Le animazioni si spengono quando il sistema chiede movimento ridotto.",
  },
  {
    title: "Per chi ha un telefono vecchio o poca rete",
    summary: "Nessuna app, foto ridotte sul telefono, invii da riprendere.",
    body: "Nessuna app e nessun account: il link si apre dal browser. Le foto vengono ridotte sul telefono prima dell’invio e, se la rete cade, il caricamento si può riprovare senza scegliere di nuovo il file. Si può interrompere e riprendere quando si vuole.",
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
    <article>
      <PageHero
        eyebrow="Accessibilità"
        title="Allo sportello arriva chiunque."
        lead="Pensato prima di tutto per chi fa più fatica con la burocrazia."
      />

      <RuleList items={PRACTICES} columns={2} />

      <section
        aria-labelledby="checks"
        className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:py-28"
      >
        <div data-reveal="stagger">
          <p className="mb-4 flex items-center gap-2.5 type-eyebrow text-stamp">
            <span aria-hidden className="h-px w-6 bg-current opacity-60" />
            Verifiche
          </p>
          <h2 id="checks" className="font-display type-section">
            Cosa verifichiamo
          </h2>
          <p className="mt-5 type-lead text-ink-2">
            Nessuna conformità dichiarata senza una valutazione di terzi. Nel pilota proviamo il
            percorso con chi usa tecnologie assistive.
          </p>
        </div>
        <ul data-reveal="stagger" className="grid content-start border-t border-line">
          {CHECKS.map((item) => (
            <li key={item} className="flex gap-3 border-b border-line py-4">
              <Check className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <PageCta title="Hai trovato un ostacolo?">
        <p>
          Diccelo dal <Link href="/#pilota">modulo di contatto</Link>: se sei un cittadino, puoi
          anche chiedere aiuto allo sportello del tuo CAF.
        </p>
      </PageCta>
    </article>
  );
}
