import type { KnowledgeCitation, PracticeId } from "@avanti/contracts";
import { knowledgeChunks, KNOWLEDGE_VERSION } from "./knowledge-data";
export { knowledgeChunks, KNOWLEDGE_VERSION };
export type KnowledgeChunk = (typeof knowledgeChunks)[number];
export interface KnowledgeRetriever {
  readonly version: string;
  search(
    question: string,
    practiceId?: PracticeId,
    limit?: number,
  ): { chunk: KnowledgeChunk; score: number }[];
}
const stop = new Set(
  "a ad al alla alle allo ai agli che chi ci come con da dal dalla dalle dei degli del della di e è gli i il in io la le lo ma mi nel nella non o per più quale quali quanto se si sono su tra un una uno va viene devo servono serve fare si può cosa quali dove anno anni documenti documento riferimento considera considerano posso avere quando perche bisogna necessario necessaria".split(
    " ",
  ),
);
export function knowledgeTerms(text: string): string[] {
  return (
    text
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/\bco[ -]?intestat\p{L}*/gu, "cointestat")
      .match(/[\p{L}\p{N}]+/gu)
      ?.filter((t) => t.length > 1 && !stop.has(t))
      .map((t) => (t.length > 5 ? t.replace(/(?:i|e|a|o)$/, "") : t)) ?? []
  );
}
export function lexicalRetriever(chunks: KnowledgeChunk[] = knowledgeChunks): KnowledgeRetriever {
  const docs = chunks.map((chunk) => ({
    chunk,
    terms: knowledgeTerms(chunk.title + " " + chunk.text),
  }));
  const avg = docs.reduce((n, d) => n + d.terms.length, 0) / (docs.length || 1);
  const frequencies = new Map<string, number>();
  for (const doc of docs)
    for (const term of new Set(doc.terms)) frequencies.set(term, (frequencies.get(term) ?? 0) + 1);
  return {
    version: KNOWLEDGE_VERSION,
    search(question, practiceId, limit = 3) {
      const terms = [...new Set(knowledgeTerms(question))];
      if (!terms.length) return [];
      return docs
        .filter(
          (d) =>
            !practiceId || !d.chunk.practiceIds.length || d.chunk.practiceIds.includes(practiceId),
        )
        .map((d) => {
          let matches = 0;
          const score = terms.reduce((sum, t) => {
            const tf = d.terms.filter((v) => v === t).length;
            if (!tf) return sum;
            matches++;
            const idf = Math.log(
              1 +
                (docs.length - (frequencies.get(t) ?? 0) + 0.5) / ((frequencies.get(t) ?? 0) + 0.5),
            );
            return sum + (idf * tf * 2.2) / (tf + 1.2 * (0.25 + (0.75 * d.terms.length) / avg));
          }, 0);
          return { chunk: d.chunk, score: matches / terms.length >= 0.4 ? score : 0 };
        })
        .filter((d) => d.score >= 1)
        .sort((a, b) => b.score - a.score || a.chunk.id.localeCompare(b.chunk.id))
        .slice(0, Math.max(0, Math.min(5, limit)));
    },
  };
}
export const normativeRetriever = lexicalRetriever();
export function citationFor(chunk: KnowledgeChunk): KnowledgeCitation {
  return { id: chunk.id, title: chunk.title, source: chunk.source, url: chunk.url };
}
const sourceMetadata =
  /^(?:font[ei]|riscontro|accesso e verifica|verifica delle fonti)\b|^\d+[.)]\s/i;
const sentenceSegmenter = new Intl.Segmenter("it", { granularity: "sentence" });
const noKnowledge = () => ({
  answer:
    "La base normativa disponibile non copre questa domanda. Occorre una verifica dell’operatore presso la fonte ufficiale pertinente.",
  coverage: "none" as const,
  citations: [] as string[],
});

function excerptParagraphs(text: string): string[] {
  return (
    text
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/\*\*/g, "")
      .split(/\n\s*\n/)
      .filter((p) => !/^[ \t]*[|#>]/m.test(p) && !/`|https?:\/\//.test(p))
      .map((p) =>
        p
          .replace(/\n\s*/g, " ")
          .replace(/^\s*[-*]\s+/, "")
          .trim(),
      )
      // Source inventories and research/implementation metadata do not explain a rule.
      .filter((p) => !sourceMetadata.test(p))
      .filter(
        (p) =>
          !/\b(?:backend|frontend|pilota|beta|coming_soon|revisione|implementativ\p{L}*)\b/iu.test(
            p,
          ),
      )
  );
}

export function heuristicKnowledge(
  chunks: (Pick<KnowledgeChunk, "id" | "text"> & { title?: string })[],
  question: string,
) {
  const terms = [...new Set(knowledgeTerms(question))];
  if (!terms.length) return noKnowledge();
  const candidates = chunks.flatMap((chunk) =>
    excerptParagraphs(chunk.text).flatMap((paragraph) => {
      const sentences = [...sentenceSegmenter.segment(paragraph)].map((s) => s.segment.trim());
      const complete = (s: string) =>
        /^[\p{Lu}«“\d]/u.test(s) &&
        /[.!?][»”)]?$/.test(s) &&
        s.length >= 35 &&
        !sourceMetadata.test(s);
      return sentences.flatMap((sentence, start) => {
        if (!complete(sentence)) return [];
        // A contiguous window from one paragraph preserves context; no multi-source collage.
        // Stop before metadata or a clipped sentence instead of skipping over it.
        const next = sentences[start + 1];
        const answer = next && complete(next) ? `${sentence} ${next}` : sentence;
        if (answer.length > 900) return [];
        const words = new Set(knowledgeTerms(answer));
        const matches = terms.filter((t) => words.has(t)).length;
        // The practice name alone cannot answer a question about a specific requirement.
        const topic = new Set(knowledgeTerms(chunk.title ?? ""));
        const specific = terms.filter((t) => !topic.has(t));
        if (specific.length && specific.filter((t) => words.has(t)).length / specific.length < 0.5)
          return [];
        const relevance = matches / terms.length;
        if (matches < Math.min(2, terms.length) || relevance < 0.5) return [];
        return [{ id: chunk.id, answer, score: relevance - answer.length / 10000 }];
      });
    }),
  );
  const best = candidates.sort((a, b) => b.score - a.score)[0];
  return best
    ? { answer: best.answer, coverage: "partial" as const, citations: [best.id] }
    : noKnowledge();
}
