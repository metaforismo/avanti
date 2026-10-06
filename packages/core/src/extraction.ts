import { LANGUAGES, type Language, type PracticeId } from "@avanti/contracts";
import type { Answers } from "./catalog";
import {
  normalize,
  alternatives,
  termsPattern,
  fragmentsPattern,
  splitClauses,
  type Clause,
} from "./extraction-clauses";
import {
  KIN_TERMS,
  LIVING_PATTERNS,
  NEGATION_PATTERNS,
  WITH_US_PATTERNS,
  ELSEWHERE_PATTERNS,
  POSSESSIVE_TERMS,
  CHILD_CONTEXT_PATTERNS,
  VEHICLE_TERMS,
  ACCOUNT_TERMS,
  ASSET_NEGATION_PATTERNS,
  POSSESSION_PATTERNS,
  BANK_ALIASES,
  NUMBER_WORDS,
  COLLECTIVE_PARENT_TERMS,
  RELATION_LIST_TERMS,
  FOREIGN_ASSET_PATTERNS,
  HOME_MORTGAGE_PATTERNS,
  PLURAL_CHILD_TERMS,
  INFORMAL_PARENT_TERMS,
  MINOR_CHILD_PATTERNS,
  HOUSEHOLD_COUNT_PATTERNS,
  ALONE_PATTERNS,
  BENGALI_SUBJECT_TERMS,
  type Relation,
} from "./extraction-lexicons";

export const CLASSIFICATION_THRESHOLD = 0.75;
const markers: Record<PracticeId, RegExp[]> = {
  isee_ordinario: [
    /\bisee\b/u,
    /\bd[sş]u\b/u,
    /(?:^|[^\p{L}])(?:исее|ісее)(?:$|[^\p{L}])/u,
    /إيزي|ايزي|আইএসইই/u,
  ],
  isee_universitario: [
    /universita/u,
    /isee.{0,20}student/u,
    /university (fees|grant|income)/u,
    /universitaire|universitario|університетськ|جامع|বিশ্ববিদ্যাল/u,
  ],
  modello_730: [
    /\b730\b/u,
    /tax return|declaration.{0,10}(revenus|imp[oô]ts)|declaraci[oó]n.{0,10}renta|declaratie.{0,10}venit/u,
    /податкова декларація|الإقرار الضريبي|আয়কর রিটার্ন/u,
  ],
  red: [/\bred\b/u, /dichiarazione.{0,15}pension/u],
  assegno_unico: [
    /assegno unico|child allowance|allocation.{0,10}enfant|ayuda.{0,8}hijos|alocatie.{0,12}copii/u,
    /допомога на дітей|إعانة الأطفال|সন্তানের ভাতা/u,
  ],
  successione_semplice: [/succession|inheritance|herencia|mostenire|спадщин|ميراث|উত্তরাধিকার/u],
  permesso_soggiorno: [
    /permesso|soggiorno|residence permit|titre de sejour|permiso de residencia|permis de sedere/u,
    /дозвіл на проживання|تصريح الإقامة|বসবাসের অনুমতি/u,
  ],
  cittadinanza: [
    /cittadinanza|citizenship|nationalite|ciudadania|cetatenie|громадянств|الجنسية|নাগরিকত্ব/u,
  ],
  naspi: [/naspi|unemployment|ch[oô]mage|desempleo|somaj|безробіт|البطالة|বেকারত্ব/u],
};
const propertyNoun =
  /(?:immobil[ei]|terren[oi]|properties|houses|land plots|biens|terrains|inmuebles|terrenos|imobile|terenuri|нерухомост|ділянк|عقار|اراض|বাড়ি|জমি)/u;

function compileExtraction(language: Language) {
  const kin = KIN_TERMS[language];
  const parent = termsPattern([...kin.madre, ...kin.padre]);
  const possessive = termsPattern(POSSESSIVE_TERMS[language]);
  return {
    living: fragmentsPattern(LIVING_PATTERNS[language]),
    negative: fragmentsPattern(NEGATION_PATTERNS[language]),
    withUs: fragmentsPattern(WITH_US_PATTERNS[language]),
    elsewhere: fragmentsPattern(ELSEWHERE_PATTERNS[language]),
    parent,
    ownedParent:
      language === "ar"
        ? possessive
        : new RegExp(
            `(?:${possessive.source})\\s+(?:${parent.source})|(?:${parent.source})\\s+(?:${possessive.source})`,
            "u",
          ),
    childContext: fragmentsPattern(CHILD_CONTEXT_PATTERNS[language]),
    continuationWords: termsPattern(
      [
        ...Object.values(kin).flat(),
        ...POSSESSIVE_TERMS[language],
        ...COLLECTIVE_PARENT_TERMS[language],
        ...RELATION_LIST_TERMS[language],
        ...Object.keys(NUMBER_WORDS),
        ...(language === "bn" ? BENGALI_SUBJECT_TERMS : []),
      ],
      "gu",
    ),
    informalParent: termsPattern(INFORMAL_PARENT_TERMS[language]),
    minorChild: fragmentsPattern(MINOR_CHILD_PATTERNS[language]),
    relations: (Object.keys(kin) as Relation[]).map((relation) => ({
      relation,
      pattern: termsPattern(kin[relation], "gu"),
    })),
    collectiveParents: termsPattern(COLLECTIVE_PARENT_TERMS[language], "gu"),
    pluralChildren: termsPattern(PLURAL_CHILD_TERMS[language]),
    householdCount: new RegExp(
      `${fragmentsPattern(HOUSEHOLD_COUNT_PATTERNS[language]).source}\\s+(\\d{1,2}|[\\p{L}\\p{M}]+)`,
      "u",
    ),
    alone: new RegExp(fragmentsPattern(ALONE_PATTERNS[language]).source, "gu"),
    accounts: termsPattern(ACCOUNT_TERMS[language], "gu"),
    vehicles: termsPattern(VEHICLE_TERMS[language], "gu"),
    accountNoun: termsPattern(ACCOUNT_TERMS[language]),
    assetNegative: fragmentsPattern(ASSET_NEGATION_PATTERNS[language]),
    possession: fragmentsPattern(POSSESSION_PATTERNS[language]),
    foreignAssets: fragmentsPattern(FOREIGN_ASSET_PATTERNS[language]),
    mortgage: fragmentsPattern(HOME_MORTGAGE_PATTERNS[language]),
  };
}
const extractionPatterns = Object.fromEntries(
  LANGUAGES.map((language) => [language, compileExtraction(language)]),
) as Record<Language, ReturnType<typeof compileExtraction>>;
const bankPatterns = BANK_ALIASES.map((bank) => ({
  ...bank,
  marker: new RegExp(
    `(?<![\\p{Script=Latin}\\p{N}])(?:${alternatives(bank.aliases)})(?![\\p{Script=Latin}\\p{N}])`,
    "u",
  ),
}));
const exactPropertyNoun = new RegExp(`^(?:${propertyNoun.source})$`, "u");
function numericWord(word: string): number | undefined {
  if (/^\d{1,2}$/.test(word)) return Number(word);
  return NUMBER_WORDS[word];
}
function normalizedMarker(expression: RegExp): RegExp {
  // Normalize literal accents without lowercasing RegExp syntax such as \p{L}.
  return new RegExp(
    expression.source
      .normalize("NFC")
      .replace(/[أإآ]/gu, "ا")
      .replace(/\p{Script=Latin}/gu, (letter) => letter.normalize("NFD").replace(/\p{M}/gu, "")),
    expression.flags,
  );
}
const classificationPatterns = Object.fromEntries(
  (Object.keys(markers) as PracticeId[]).map((id) => [
    id,
    markers[id].map((marker) => new RegExp(normalizedMarker(marker).source, "gu")),
  ]),
) as Record<PracticeId, RegExp[]>;
function countNoun(text: string): number | undefined {
  const tokens = text.split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
  let result: number | undefined;
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index] ?? "";
    if (!exactPropertyNoun.test(token)) continue;
    if (token === "حسابين" || token === "سيارتين") {
      result = 2;
      continue;
    }
    const prefix =
      tokens
        .slice(Math.max(0, index - 6), index)
        .join(" ")
        .split(/(?:\bma\b|\bbut\b|\bmais\b|\bpero\b|\bdar\b|\bале\b|\be ho\b|\band i have\b)/u)
        .at(-1) ?? "";
    const negative =
      /(?:non ho|non abbiamo|nessun|no tengo|no tenemos|(?:^|\s)no(?:\s|$)|don t have|do not have|haven t|n ai pas|pas de|nu am|nu avem|не маю|немає|لا املك|ليس لدي|ما عندي|নেই)/u.test(
        prefix,
      );
    const suffix = tokens.slice(index + 1, index + 3).join(" ");
    if (negative || /^নেই(?:\s|$)/u.test(suffix)) {
      result = 0;
      continue;
    }
    const direct = numericWord(tokens[index - 1] ?? "");
    if (direct !== undefined) {
      result = direct;
      continue;
    }
    const following = numericWord(tokens[index + 1] ?? "");
    if (following !== undefined && /[\u0600-\u06ff]/u.test(token)) {
      result = following;
      continue;
    }
    // English allows a descriptive word between the count and the noun.
    if (/^(bank|correnti|bancaires|bancarias)$/u.test(tokens[index - 1] ?? "")) {
      const previous = numericWord(tokens[index - 2] ?? "");
      if (previous !== undefined) {
        result = previous;
        continue;
      }
    }
    if (
      /(?:ho|abbiamo|have|tengo|tenemos|j ai|nous avons|am|avem|маю|لدينا|لدي|আমার|আছে)/u.test(
        prefix,
      )
    )
      result = 1;
  }
  return result;
}
function hasPositive(text: string, expression: RegExp): boolean {
  const matches = text.matchAll(expression);
  for (const match of matches) {
    const prefix =
      text
        .slice(Math.max(0, match.index - 40), match.index)
        .split(/[.,;]|\b(?:ma|but|mais|pero|dar)\b/u)
        .at(-1) ?? "";
    if (!/(?:^|[^\p{L}])(?:non |no |not |don t |pas |nu |не |لا |নেই)[^.,;]{0,30}$/u.test(prefix))
      return true;
  }
  return false;
}

export type ExtractedFacts = {
  householdCount?: number;
  nonresidentParent?: boolean;
  institutions: string[];
};
function countAssets(clauses: Clause[], noun: RegExp, language: Language): number | undefined {
  const { assetNegative: negative, possession } = extractionPatterns[language];
  let sharedPossession = false;
  let total: number | undefined;
  for (const clause of clauses) {
    if (!clause.coordinated) sharedPossession = false;
    const owned: boolean = possession.test(clause.text) || sharedPossession;
    let clauseCount: number | undefined;
    for (const match of clause.text.matchAll(noun)) {
      if (negative.test(clause.text)) {
        clauseCount = 0;
        break;
      }
      const before = clause.text.slice(0, match.index).trim().split(/\s+/u);
      const after = clause.text
        .slice(match.index + match[0].length)
        .trim()
        .split(/\s+/u);
      const direct = numericWord(before.at(-1) ?? "");
      const modifierCount = numericWord(before.at(-2) ?? "");
      const following = language === "ar" ? numericWord(after[0] ?? "") : undefined;
      const dual = language === "ar" ? numericWord(match[0]) : undefined;
      const count = dual ?? direct ?? modifierCount ?? following ?? (owned ? 1 : undefined);
      if (count !== undefined) clauseCount = (clauseCount ?? 0) + count;
    }
    if (clauseCount !== undefined) total = (total ?? 0) + clauseCount;
    sharedPossession = owned && !negative.test(clause.text);
  }
  return total;
}
function extractHousehold(
  clauses: Clause[],
  language: Language,
  answers: Answers,
  facts: ExtractedFacts,
): void {
  const patterns = extractionPatterns[language];
  const { living, negative, withUs, elsewhere, ownedParent, childContext, continuationWords } =
    patterns;
  const isRelationList = (clause: Clause) =>
    clause.text.replace(continuationWords, "").replace(/[\s\d]+/gu, "") === "";
  const livingClauses = clauses.map(
    (clause) => !negative.test(clause.text) && living.test(clause.text),
  );
  // Bengali puts the living verb after the entire coordinated list.
  if (language === "bn") {
    for (let index = clauses.length - 1; index > 0; index--) {
      if (
        livingClauses[index] &&
        clauses[index]!.coordinated &&
        isRelationList(clauses[index - 1]!)
      ) {
        livingClauses[index - 1] = true;
      }
    }
  }
  const relations: Relation[] = [];
  let sharedLiving = false;
  for (const [index, clause] of clauses.entries()) {
    const absent =
      negative.test(clause.text) && (withUs.test(clause.text) || elsewhere.test(clause.text));
    const parent = patterns.parent.test(clause.text);
    if (absent && parent) {
      facts.nonresidentParent = true;
      if (
        ownedParent.test(clause.text) ||
        (patterns.informalParent.test(clause.text) && !childContext.test(clause.text))
      ) {
        answers.applicant_parent_nonresident = true;
      } else if (patterns.minorChild.test(clause.text)) {
        answers.nonresident_parent = true;
      } else if (["uk", "ar", "bn"].includes(language)) {
        answers.applicant_parent_nonresident = true;
      }
    }
    const cohabiting: boolean =
      !negative.test(clause.text) &&
      (livingClauses[index] === true ||
        (clause.coordinated && sharedLiving && isRelationList(clause)));
    sharedLiving = cohabiting;
    if (!cohabiting) continue;
    const mentioned = [
      ...patterns.relations.flatMap(({ relation, pattern }) =>
        Array.from(clause.text.matchAll(pattern), (match) => ({ relation, match })),
      ),
      ...Array.from(clause.text.matchAll(patterns.collectiveParents)).flatMap((match) =>
        (["madre", "padre"] as const).map((relation) => ({ relation, match })),
      ),
    ].sort((a, b) => a.match.index - b.match.index);
    // A bare list can omit punctuation. Additional predicates instead introduce
    // unrelated subjects, which must not become household members.
    const bareList = isRelationList({ ...clause, text: clause.text.replace(living, "") });
    const residents = bareList
      ? mentioned
      : mentioned.filter((entry) => entry.match.index === mentioned[0]?.match.index);
    for (const { relation, match } of residents) {
      if (relation !== "figlio") {
        if (!relations.includes(relation)) relations.push(relation);
        continue;
      }
      const previous = clause.text.slice(0, match.index).trim().split(/\s+/u).at(-1) ?? "";
      const pluralChildren = patterns.pluralChildren;
      const count =
        numericWord(previous) ??
        (language === "ar" ? numericWord(match[0]) : undefined) ??
        (pluralChildren.test(match[0]) ? 0 : 1);
      if (count > 0 && count < 20) relations.push(...Array.from({ length: count }, () => relation));
    }
  }
  if (relations.length) {
    answers.household_roles = [
      "richiedente",
      ...relations.map((relation) =>
        relation === "madre" || relation === "padre"
          ? "genitore"
          : relation === "coniuge" || relation === "figlio"
            ? relation
            : "altro",
      ),
    ];
    answers.household_relations = relations;
    answers.household_count = Math.max(
      typeof answers.household_count === "number" ? answers.household_count : 0,
      relations.length + 1,
    );
  }
  if (typeof answers.household_count === "number") facts.householdCount = answers.household_count;
}
export function extractFacts(
  text: string,
  language: Language,
  selectedPractice?: PracticeId,
): { practiceId: PracticeId | null; confidence: number; answers: Answers; facts: ExtractedFacts } {
  const normalized = normalize(text);
  const scores = (Object.keys(markers) as PracticeId[])
    .map((id) => ({
      id,
      score: classificationPatterns[id].reduce(
        (score, expression) => score + (hasPositive(normalized, expression) ? 1 : 0),
        0,
      ),
    }))
    .sort((a, b) => b.score - a.score);
  const best = scores[0];
  const second = scores[1];
  let practiceId: PracticeId | null = null;
  let confidence = 0;
  if (best && best.score > 0) {
    if (best.id === "isee_universitario") {
      practiceId = best.id;
      confidence = 0.95;
    } else if (best.score !== second?.score) {
      practiceId = best.id;
      confidence = Math.min(0.98, 0.85 + (best.score - 1) * 0.05);
    } else confidence = 0.45;
  }
  const university = scores.find((score) => score.id === "isee_universitario");
  if (
    university &&
    university.score > 0 &&
    scores.every(
      (score) =>
        score.score === 0 || score.id === "isee_universitario" || score.id === "isee_ordinario",
    )
  ) {
    practiceId = "isee_universitario";
    confidence = 0.95;
  }
  if (selectedPractice) {
    practiceId = selectedPractice;
    confidence = 1;
  }
  const answers: Answers = {};
  if (practiceId === "isee_universitario") {
    practiceId = "isee_ordinario";
    answers.university = true;
  } else if (practiceId === "isee_ordinario" && university && university.score > 0) {
    answers.university = true;
  }
  const facts: ExtractedFacts = { institutions: [] };
  if (practiceId !== "isee_ordinario" && practiceId !== "assegno_unico")
    return { practiceId, confidence, answers, facts };
  const clauses = splitClauses(normalized, language);
  const patterns = extractionPatterns[language];
  const explicitHousehold = patterns.householdCount.exec(normalized);
  const statedCount = explicitHousehold ? numericWord(explicitHousehold[1] ?? "") : undefined;
  if (statedCount && statedCount <= 20) answers.household_count = statedCount;
  const alone = patterns.alone;
  if (clauses.some((clause) => hasPositive(clause.text, alone))) {
    answers.household_count = Math.max(statedCount ?? 0, 1);
    answers.household_roles = ["richiedente"];
  }
  extractHousehold(clauses, language, answers, facts);
  if (practiceId === "assegno_unico") return { practiceId, confidence, answers, facts };
  const accountNoun = patterns.accountNoun;
  const accounts = countAssets(clauses, patterns.accounts, language);
  if (accounts !== undefined) answers.accounts_count = accounts;
  const vehicles = countAssets(clauses, patterns.vehicles, language);
  if (vehicles !== undefined) answers.vehicles_count = vehicles;
  const properties = countNoun(normalized);
  if (properties !== undefined) answers.properties_count = properties;
  const matchedBanks = bankPatterns.filter((bank) =>
    clauses.some(
      (clause) => bank.marker.test(clause.text) && !patterns.assetNegative.test(clause.text),
    ),
  );
  facts.institutions = matchedBanks.map((bank) => bank.name);
  if (matchedBanks.some((bank) => bank.reviewForeign)) answers.foreign_institution_review = true;
  if (
    clauses.some(
      (clause) =>
        patterns.foreignAssets.test(clause.text) && !patterns.assetNegative.test(clause.text),
    )
  )
    answers.foreign_assets = true;
  if (facts.institutions.length && answers.accounts_count !== 0) {
    answers.accounts_count = Math.max(
      typeof answers.accounts_count === "number" ? answers.accounts_count : 0,
      facts.institutions.length,
    );
    facts.institutions.forEach((bank, index) => {
      answers[`account_bank_${index}`] = bank;
    });
  }
  if (
    typeof answers.accounts_count === "number" &&
    answers.accounts_count > 0 &&
    accountNoun.test(normalized) &&
    !/titoli|investiment|funds|bonds|fond[os]|облігац|سندات|বন্ড/u.test(normalized)
  ) {
    for (let index = 0; index < answers.accounts_count; index++)
      if (!matchedBanks[index]?.wallet) answers[`account_type_${index}`] = "deposit";
  }
  if (
    /in affitto|rent my home|renting|en location|alquil|in chirie|оренд|ايجار|إيجار|ভাড়া/u.test(
      normalized,
    )
  )
    answers.housing = "rent";
  else if (
    /casa di proprieta|own my home|maison a moi|casa propia|casa mea|власн.{0,6}(житло|будин)|بيت ملك/u.test(
      normalized,
    )
  )
    answers.housing = "owned";
  if (
    clauses.some(
      (clause) => patterns.mortgage.test(clause.text) && !patterns.assetNegative.test(clause.text),
    )
  ) {
    answers.housing = "owned";
    answers.properties_count = Math.max(
      typeof answers.properties_count === "number" ? answers.properties_count : 0,
      1,
    );
    // The catalog asks about 31/12/2025; a current mortgage does not prove that historical fact.
    answers.mortgage_review = true;
  }
  return { practiceId, confidence, answers, facts };
}
