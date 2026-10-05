import type { Language, PracticeId } from "@avanti/contracts";
import type { Answers } from "./catalog";

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
  три: 3,
  чотири: 4,
  واحد: 1,
  واحدة: 1,
  اثنان: 2,
  اثنين: 2,
  ثلاثة: 3,
  একটি: 1,
  এক: 1,
  দুটি: 2,
  দুই: 2,
  তিনটি: 3,
  তিন: 3,
  চারটি: 4,
};
const banks = [
  "Fineco",
  "Intesa Sanpaolo",
  "UniCredit",
  "Poste",
  "BancoPosta",
  "ING",
  "BPER",
  "BNL",
  "BPM",
  "Monte dei Paschi",
  "Revolut",
  "N26",
  "Sella",
  "Crédit Agricole",
  "Santander",
  "Wise",
];
const accountNoun =
  /(?:cont[oi]|accounts?|comptes?|cuentas?|conturi|рахун(?:ок|ки|ків)|حساب(?:ات|ين)?|হিসাব|অ্যাকাউন্ট)/u;
const vehicleNoun =
  /(?:auto(?:mobile)?|macchin[ae]|cars?|voitures?|coches?|masin[ai]|авто|машин(?:а|и)|سيار(?:ة|ات|تين)|গাড়ি)/u;
const propertyNoun =
  /(?:immobil[ei]|terren[oi]|properties|houses|land plots|biens|terrains|inmuebles|terrenos|imobile|terenuri|нерухомост|ділянк|عقار|اراض|বাড়ি|জমি)/u;

function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[০-৯٠-٩۰-۹]/g, (digit) => {
      const codePoint = digit.codePointAt(0) ?? 0;
      const zero = codePoint >= 0x09e6 ? 0x09e6 : codePoint >= 0x06f0 ? 0x06f0 : 0x0660;
      return String(codePoint - zero);
    });
}
function numericWord(word: string): number | undefined {
  if (/^\d{1,2}$/.test(word)) return Number(word);
  return numberWords[word];
}
function normalizedMarker(expression: RegExp): RegExp {
  // Normalize literal accents without lowercasing RegExp syntax such as \p{L}.
  return new RegExp(
    expression.source.normalize("NFKD").replace(/[\u0300-\u036f]/g, ""),
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
export function extractFacts(
  text: string,
  _language: Language,
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
  const explicitHousehold =
    /(?:siamo|we are|nous sommes|somos|suntem|нас|نحن)\s+(\d{1,2}|[\p{L}]+)/u.exec(normalized);
  const statedCount = explicitHousehold ? numericWord(explicitHousehold[1] ?? "") : undefined;
  if (statedCount && statedCount <= 20) answers.household_count = statedCount;
  else {
    const livingWith =
      /(?:vivo con|abito con|live with|living with|vis avec|vivo con|locuiesc cu|живу з|اعيش مع|থাকি)/u.exec(
        normalized,
      );
    if (livingWith) {
      const householdClause =
        normalized
          .slice(livingWith.index)
          .split(/[.;]|(?:mio padre|my father|mon pere|mi padre).{0,10}(?:non|not|ne |no )/u)[0] ??
        "";
      const relations = [
        /(?:madre|mamma|mother|mere|mama|мама|والدت|امي|মা)/u,
        /(?:padre|papa|father|pere|tata|батько|والد|ابي|বাবা)/u,
        /(?:moglie|marito|wife|husband|epouse|epoux|esposa|esposo|sot(?:ie|ul)?|дружина|чоловік|زوج|স্ত্রী|স্বামী)/u,
      ];
      const roles = relations.flatMap((expression, index) => {
        const bounded = new RegExp(
          `(?<![\\p{L}\\p{M}])(?:${expression.source})(?![\\p{L}\\p{M}])`,
          "u",
        );
        if (!hasPositive(householdClause, bounded)) return [];
        return [index === 2 ? "coniuge" : "genitore"];
      });
      const known = roles.length;
      if (known) answers.household_roles = ["richiedente", ...roles];
      if (
        known > 0 &&
        !/figli|children|enfants|hijos|copii|діт|اطفال|সন্তান/u.test(householdClause)
      )
        answers.household_count = 1 + known;
    }
  }
  if (typeof answers.household_count === "number") facts.householdCount = answers.household_count;
  facts.nonresidentParent =
    /(?:padre|madre|father|mother|pere|mere|tata|mama|батько|мати|الاب|الام).{0,30}(?:non vive|non abita|does not live|doesn t live|not living|ne vit pas|no vive|nu locuieste|не живе|لا يعيش)/u.test(
      normalized,
    ) || undefined;
  if (facts.nonresidentParent) answers.nonresident_parent = true;
  if (practiceId === "assegno_unico") return { practiceId, confidence, answers, facts };
  const accounts = countNoun(normalized, accountNoun);
  if (accounts !== undefined) answers.accounts_count = accounts;
  const vehicles = countNoun(normalized, vehicleNoun);
  if (vehicles !== undefined) answers.vehicles_count = vehicles;
  const properties = countNoun(normalized, propertyNoun);
  if (properties !== undefined) answers.properties_count = properties;
  for (const bank of banks) {
    const marker = new RegExp(`(?:^|[^\\p{L}\\p{N}])${normalize(bank)}(?:$|[^\\p{L}\\p{N}])`, "u");
    if (hasPositive(normalized, marker)) facts.institutions.push(bank);
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
