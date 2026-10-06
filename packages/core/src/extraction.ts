import type { Language, PracticeId } from "@avanti/contracts";
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
  BANKS,
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
    /isee.{0,20}(universit|student)/u,
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
const numberWords: Record<string, number> = {
  un: 1,
  uno: 1,
  una: 1,
  one: 1,
  a: 1,
  une: 1,
  deux: 2,
  due: 2,
  two: 2,
  dos: 2,
  o: 1,
  doua: 2,
  doi: 2,
  tre: 3,
  three: 3,
  trois: 3,
  tres: 3,
  trei: 3,
  quattro: 4,
  four: 4,
  quatre: 4,
  cuatro: 4,
  patru: 4,
  cinque: 5,
  five: 5,
  cinq: 5,
  cinco: 5,
  cinci: 5,
  six: 6,
  sei: 6,
  seis: 6,
  sase: 6,
  один: 1,
  одна: 1,
  одне: 1,
  два: 2,
  дві: 2,
  двома: 2,
  двоє: 2,
  три: 3,
  чотири: 4,
  واحد: 1,
  واحدة: 1,
  اثنان: 2,
  اثنين: 2,
  طفلين: 2,
  سيارتين: 2,
  حسابين: 2,
  ثلاثة: 3,
  একটি: 1,
  এক: 1,
  দুটি: 2,
  দুই: 2,
  তিনটি: 3,
  তিন: 3,
  চারটি: 4,
};
const propertyNoun =
  /(?:immobil[ei]|terren[oi]|properties|houses|land plots|biens|terrains|inmuebles|terrenos|imobile|terenuri|нерухомост|ділянк|عقار|اراض|বাড়ি|জমি)/u;

function numericWord(word: string): number | undefined {
  if (/^\d{1,2}$/.test(word)) return Number(word);
  return numberWords[word];
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
function countNoun(text: string, noun: RegExp): number | undefined {
  const tokens = text.split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
  let result: number | undefined;
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index] ?? "";
    if (!new RegExp(`^(?:${noun.source})$`, "u").test(token)) continue;
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
  const matches = text.matchAll(
    new RegExp(expression.source, `${expression.flags.replace("g", "")}g`),
  );
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
function countAssets(clauses: Clause[], terms: string[], language: Language): number | undefined {
  const noun = termsPattern(terms, "gu");
  const negative = fragmentsPattern(ASSET_NEGATION_PATTERNS[language]);
  const possession = fragmentsPattern(POSSESSION_PATTERNS[language]);
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
  const kin = KIN_TERMS[language];
  const living = fragmentsPattern(LIVING_PATTERNS[language]);
  const negative = fragmentsPattern(NEGATION_PATTERNS[language]);
  const withUs = fragmentsPattern(WITH_US_PATTERNS[language]);
  const elsewhere = fragmentsPattern(ELSEWHERE_PATTERNS[language]);
  const parentSource = termsPattern([...kin.madre, ...kin.padre]).source;
  const possessiveSource = termsPattern(POSSESSIVE_TERMS[language]).source;
  const ownedParent =
    language === "ar"
      ? termsPattern(POSSESSIVE_TERMS.ar)
      : new RegExp(
          `(?:${possessiveSource})\\s+(?:${parentSource})|(?:${parentSource})\\s+(?:${possessiveSource})`,
          "u",
        );
  const childContext = fragmentsPattern(CHILD_CONTEXT_PATTERNS[language]);
  const relationTerms = Object.values(kin).flat();
  const continuationWords = termsPattern(
    [
      ...relationTerms,
      ...POSSESSIVE_TERMS[language],
      ...Object.keys(numberWords),
      ...(language === "bn" ? BENGALI_SUBJECT_TERMS : []),
    ],
    "gu",
  );
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
    const parent = termsPattern([...kin.madre, ...kin.padre]).test(clause.text);
    if (absent && parent) {
      facts.nonresidentParent = true;
      if (
        ownedParent.test(clause.text) ||
        (termsPattern(INFORMAL_PARENT_TERMS[language]).test(clause.text) &&
          !childContext.test(clause.text))
      ) {
        answers.applicant_parent_nonresident = true;
      } else if (fragmentsPattern(MINOR_CHILD_PATTERNS[language]).test(clause.text)) {
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
    const mentioned = (Object.keys(kin) as Relation[])
      .flatMap((relation) => {
        return Array.from(clause.text.matchAll(termsPattern(kin[relation], "gu")), (match) => ({
          relation,
          match,
        }));
      })
      .sort((a, b) => a.match.index - b.match.index);
    // A bare list can omit punctuation. Additional predicates instead introduce
    // unrelated subjects, which must not become household members.
    const bareList = isRelationList({ ...clause, text: clause.text.replace(living, "") });
    const residents = bareList ? mentioned : mentioned.slice(0, 1);
    for (const { relation, match } of residents) {
      if (relation !== "figlio") {
        if (!relations.includes(relation)) relations.push(relation);
        continue;
      }
      const previous = clause.text.slice(0, match.index).trim().split(/\s+/u).at(-1) ?? "";
      const pluralChildren = termsPattern(PLURAL_CHILD_TERMS[language]);
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
        relation === "madre" || relation === "padre" ? "genitore" : relation,
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
      score: markers[id].reduce(
        (score, expression) =>
          score + (hasPositive(normalized, normalizedMarker(expression)) ? 1 : 0),
        0,
      ),
    }))
    .sort((a, b) => b.score - a.score);
  const best = scores[0];
  const second = scores[1];
  let practiceId: PracticeId | null = null;
  let confidence = 0;
  if (best && best.score > 0) {
    if (
      best.id === "isee_universitario" &&
      markers.isee_universitario.some((marker) => normalizedMarker(marker).test(normalized))
    ) {
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
  const facts: ExtractedFacts = { institutions: [] };
  if (practiceId !== "isee_ordinario" && practiceId !== "assegno_unico")
    return { practiceId, confidence, answers, facts };
  const clauses = splitClauses(normalized, language);
  const countPrefix = fragmentsPattern(HOUSEHOLD_COUNT_PATTERNS[language]).source;
  const explicitHousehold = new RegExp(`${countPrefix}\\s+(\\d{1,2}|[\\p{L}\\p{M}]+)`, "u").exec(
    normalized,
  );
  const statedCount = explicitHousehold ? numericWord(explicitHousehold[1] ?? "") : undefined;
  if (statedCount && statedCount <= 20) answers.household_count = statedCount;
  const alone = fragmentsPattern(ALONE_PATTERNS[language]);
  if (clauses.some((clause) => hasPositive(clause.text, alone))) {
    answers.household_count = Math.max(statedCount ?? 0, 1);
    answers.household_roles = ["richiedente"];
  }
  extractHousehold(clauses, language, answers, facts);
  if (practiceId === "assegno_unico") return { practiceId, confidence, answers, facts };
  const accountNoun = termsPattern(ACCOUNT_TERMS[language]);
  const accounts = countAssets(clauses, ACCOUNT_TERMS[language], language);
  if (accounts !== undefined) answers.accounts_count = accounts;
  const vehicles = countAssets(clauses, VEHICLE_TERMS[language], language);
  if (vehicles !== undefined) answers.vehicles_count = vehicles;
  const properties = countNoun(normalized, propertyNoun);
  if (properties !== undefined) answers.properties_count = properties;
  for (const bank of BANKS) {
    // Latin boundaries allow Arabic, Ukrainian and Bengali affixes next to bank names.
    const marker = new RegExp(
      `(?<![\\p{Script=Latin}\\p{N}])(?:${alternatives([bank])})(?![\\p{Script=Latin}\\p{N}])`,
      "u",
    );
    if (bank === "BPM" && facts.institutions.includes("Banco BPM")) continue;
    if (
      clauses.some(
        (clause) =>
          marker.test(clause.text) &&
          !fragmentsPattern(ASSET_NEGATION_PATTERNS[language]).test(clause.text),
      )
    ) {
      facts.institutions.push(bank);
    }
  }
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
      answers[`account_type_${index}`] = "deposit";
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
  return { practiceId, confidence, answers, facts };
}
