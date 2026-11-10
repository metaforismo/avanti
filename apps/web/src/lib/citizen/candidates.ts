import type { PracticeId, PracticeSummary } from "@avanti/contracts";

/** Words that point at a practice in a story Avanti could not settle on its own (Italian first). */
const KEYWORDS: Partial<Record<PracticeId, string[]>> = {
  isee_ordinario: ["isee"],
  assegno_unico: ["assegno unico", "assegno"],
  modello_730: ["730", "dichiarazione dei redditi"],
  permesso_soggiorno: ["permesso di soggiorno", "permesso", "soggiorno"],
  cittadinanza: ["cittadinanza"],
  naspi: ["naspi", "disoccupazione"],
  successione_semplice: ["successione", "eredità"],
};

const MAX = 4;
const MIN = 2;

/**
 * The practices a story names, for the taps under Avanti's reply: «ISEE per l'assegno unico»
 * offers ISEE and Assegno unico. Too few named: the list is filled with the others that can be
 * started, in catalog order, up to four.
 */
export function candidatePractices(text: string, practices: PracticeSummary[]) {
  const startable = practices.filter((p) => p.availability !== "coming_soon");
  const lower = text.toLocaleLowerCase("it");
  const position = (practice: PracticeSummary) => {
    const hits = (KEYWORDS[practice.id] ?? [])
      .map((word) => lower.indexOf(word))
      .filter((index) => index >= 0);
    return hits.length ? Math.min(...hits) : -1;
  };
  const named = startable
    .map((practice) => ({ practice, at: position(practice) }))
    .filter((entry) => entry.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((entry) => entry.practice);
  const rest = startable.filter((practice) => !named.includes(practice));
  const fill = named.length >= MIN ? [] : rest.slice(0, MAX - named.length);
  return [...named, ...fill].slice(0, MAX);
}
