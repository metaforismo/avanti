import { LANGUAGES, type Language } from "@avanti/contracts";
import {
  BANKS,
  NUMBER_WORDS,
  CONJUNCTIONS,
  KIN_TERMS,
  ACCOUNT_TERMS,
  VEHICLE_TERMS,
  CLAUSE_START_PATTERNS,
  LIVING_CLAUSE_START_PATTERNS,
  NEGATION_PATTERNS,
  POSSESSIVE_TERMS,
  WITH_US_PATTERNS,
  ELSEWHERE_PATTERNS,
  CHILD_CONTEXT_PATTERNS,
  NEGATION_PREFIX_TERMS,
} from "./extraction-lexicons";

export function normalize(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[’']/gu, " ")
    .replace(/[\u064b-\u065f]/gu, "")
    .replace(/[أإآ]/gu, "ا")
    .replace(/\p{Script=Latin}/gu, (letter) => letter.normalize("NFD").replace(/\p{M}/gu, ""))
    .replace(/[০-৯٠-٩۰-۹]/gu, (digit) => {
      const codePoint = digit.codePointAt(0)!;
      const zero = codePoint >= 0x09e6 ? 0x09e6 : codePoint >= 0x06f0 ? 0x06f0 : 0x0660;
      return String(codePoint - zero);
    });
}
export function escapeTerm(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
export function alternatives(terms: string[]): string {
  return terms
    .map(normalize)
    .sort((a, b) => b.length - a.length)
    .map(escapeTerm)
    .join("|");
}
export function boundedPattern(source: string, flags = "u"): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])(?:${source})(?![\\p{L}\\p{M}\\p{N}])`, flags);
}
export function termsPattern(terms: string[], flags = "u"): RegExp {
  return boundedPattern(alternatives(terms), flags);
}
export function fragmentsPattern(fragments: string[]): RegExp {
  return boundedPattern(fragments.map(normalize).join("|"));
}
function compileClauses(language: Language) {
  const parents = alternatives([...KIN_TERMS[language].madre, ...KIN_TERMS[language].padre]);
  const possessives = alternatives(language === "ar" ? [] : POSSESSIVE_TERMS[language]);
  const starts = fragmentsPattern([
    ...CLAUSE_START_PATTERNS[language],
    ...LIVING_CLAUSE_START_PATTERNS[language],
  ]);
  const prefix = NEGATION_PREFIX_TERMS[language];
  return {
    separator: new RegExp(
      `([.,;:!?،؛।\\n]+)|${language === "it" ? "(?<!\\bc\\s)" : ""}${termsPattern(CONJUNCTIONS[language]).source}`,
      "gu",
    ),
    starts: new RegExp(starts.source, "gu"),
    negationPrefix: prefix.length ? new RegExp(`${termsPattern(prefix).source}$`, "u") : null,
    childContext: fragmentsPattern(CHILD_CONTEXT_PATTERNS[language]),
    subject: boundedPattern(`(?:(?:${possessives})\\s+)?(?:${parents})`, "gu"),
    negative: fragmentsPattern(NEGATION_PATTERNS[language]),
    residence: fragmentsPattern([...WITH_US_PATTERNS[language], ...ELSEWHERE_PATTERNS[language]]),
  };
}
const clausePatterns = Object.fromEntries(
  LANGUAGES.map((language) => [language, compileClauses(language)]),
) as Record<Language, ReturnType<typeof compileClauses>>;
const attachedConjunction = new RegExp(
  `(?<![\\p{L}\\p{M}])و(?=${alternatives([
    ...Object.values(KIN_TERMS.ar).flat(),
    ...ACCOUNT_TERMS.ar,
    ...VEHICLE_TERMS.ar,
    ...BANKS,
    "لدي",
    "عندي",
    "ليس",
    "لا",
    "أنا",
    "انا",
    ...Object.keys(NUMBER_WORDS),
  ])})`,
  "gu",
);
export type Clause = { text: string; coordinated: boolean };
export function splitClauses(text: string, language: Language): Clause[] {
  let prepared = text;
  if (language === "ar") prepared = prepared.replace(attachedConjunction, "و ");
  const { separator, starts, negationPrefix } = clausePatterns[language];
  const clauses: Clause[] = [];
  let start = 0;
  let coordinated = false;
  for (const match of prepared.matchAll(separator)) {
    const clause = prepared.slice(start, match.index).trim();
    if (clause) clauses.push({ text: clause, coordinated });
    coordinated = !match[1] || /^[,،]+$/u.test(match[1]);
    start = match.index + match[0].length;
  }
  const last = prepared.slice(start).trim();
  if (last) clauses.push({ text: last, coordinated });
  return clauses.flatMap((clause) => {
    const statements: Clause[] = [];
    let offset = 0;
    let coordinated = clause.coordinated;
    for (const match of clause.text.matchAll(starts)) {
      if (match.index === 0) continue;
      const prefix = clause.text.slice(offset, match.index).trim();
      if (negationPrefix?.test(prefix)) continue;
      if (prefix) statements.push({ text: prefix, coordinated });
      offset = match.index;
      coordinated = false;
    }
    statements.push({ text: clause.text.slice(offset).trim(), coordinated });
    return statements.flatMap((statement) => splitNegatedParents(statement, language));
  });
}

function splitNegatedParents(clause: Clause, language: Language): Clause[] {
  const { childContext, subject, negative, residence } = clausePatterns[language];
  if (childContext.test(clause.text)) return [clause];
  const subjects = Array.from(clause.text.matchAll(subject));
  const parts: Clause[] = [];
  let start = 0;
  for (let index = 0; index < subjects.length; index++) {
    const match = subjects[index]!;
    const suffix = clause.text.slice(match.index + match[0].length, subjects[index + 1]?.index);
    if (match.index > start && negative.test(suffix) && residence.test(suffix)) {
      parts.push({
        text: clause.text.slice(start, match.index).trim(),
        coordinated: clause.coordinated,
      });
      start = match.index;
    }
  }
  parts.push({
    text: clause.text.slice(start).trim(),
    coordinated: parts.length ? false : clause.coordinated,
  });
  return parts;
}
