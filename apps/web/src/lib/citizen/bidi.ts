const RTL = /[\p{Script=Arabic}\p{Script=Hebrew}]/u;

/**
 * A bracketed term with Latin letters, or a run of Latin words (with the digits, spaces and
 * punctuation between them). Brackets go with their content: a lone «(» left in the Arabic run is
 * what the algorithm mirrors to the wrong end of the line.
 */
const LATIN_RUN =
  /\([^()]*\p{Script=Latin}[^()]*\)|\p{Script=Latin}(?:[\p{Script=Latin}\p{N}\p{M}\s'’./&-]*[\p{Script=Latin}\p{N}])?/gu;

export const hasRtl = (text: string) => RTL.test(text);

/** The text cut into Latin runs and the rest, only when it also has right-to-left letters. */
export function latinRuns(text: string): { text: string; latin: boolean }[] {
  if (!hasRtl(text)) return [{ text, latin: false }];
  const parts: { text: string; latin: boolean }[] = [];
  let last = 0;
  for (const match of text.matchAll(LATIN_RUN)) {
    const start = match.index;
    if (start > last) parts.push({ text: text.slice(last, start), latin: false });
    parts.push({ text: match[0], latin: true });
    last = start + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), latin: false });
  return parts;
}

/**
 * First Strong Isolate … Pop Directional Isolate: a value placed in a right-to-left sentence
 * (a name, an office, a date in Latin digits) keeps its own direction and its neighbours keep
 * theirs. Invisible, and only added where the sentence is right-to-left.
 */
export const isolate = (value: string) => `⁨${value}⁩`;
