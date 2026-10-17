import type { AnswerValue, CitizenCase, Language, PracticeId } from "@avanti/contracts";
import { plural, type PluralForms } from "@avanti/core";
import type { IntakeProposal } from "./ai";

type Phrases = {
  prefix: string;
  alone: string;
  household: PluralForms;
  relatives: [string, string, string];
  with: string;
  // With "=0", no accounts reads "non hai conti", not "hai 0 conti".
  accounts: PluralForms;
  properties: PluralForms;
  vehicles: PluralForms;
};
const phrases: Record<Language, Phrases> = {
  it: {
    prefix: "Ho capito",
    alone: "vivi da solo o sola",
    household: {
      one: "il tuo nucleo familiare comprende una persona",
      other: "il tuo nucleo familiare comprende {n} persone",
    },
    relatives: ["tua madre", "tuo padre", "il tuo coniuge"],
    with: "vivi con {who}",
    accounts: { "=0": "non hai conti", one: "hai un conto", other: "hai {n} conti" },
    properties: { "=0": "non hai immobili", one: "hai un immobile", other: "hai {n} immobili" },
    vehicles: { "=0": "non hai veicoli", one: "hai un veicolo", other: "hai {n} veicoli" },
  },
  en: {
    prefix: "I understood",
    alone: "You live alone",
    household: { one: "Your household has 1 person", other: "Your household has {n} people" },
    relatives: ["your mother", "your father", "your spouse"],
    with: "You live with {who}",
    accounts: {
      "=0": "you have no bank accounts",
      one: "you have a bank account",
      other: "you have {n} bank accounts",
    },
    properties: {
      "=0": "you own no property",
      one: "you own a property",
      other: "you own {n} properties",
    },
    vehicles: {
      "=0": "you have no vehicles",
      one: "you have a vehicle",
      other: "you have {n} vehicles",
    },
  },
  fr: {
    prefix: "J’ai compris",
    alone: "vous vivez seul ou seule",
    household: {
      one: "votre foyer compte {n} personne",
      other: "votre foyer compte {n} personnes",
    },
    relatives: ["votre mère", "votre père", "votre conjoint"],
    with: "vous vivez avec {who}",
    accounts: {
      "=0": "vous n’avez pas de compte",
      one: "vous avez un compte",
      other: "vous avez {n} comptes",
    },
    properties: {
      "=0": "vous n’avez pas de bien immobilier",
      one: "vous avez un bien immobilier",
      other: "vous avez {n} biens immobiliers",
    },
    vehicles: {
      "=0": "vous n’avez pas de véhicule",
      one: "vous avez un véhicule",
      other: "vous avez {n} véhicules",
    },
  },
  es: {
    prefix: "He entendido",
    alone: "vives solo o sola",
    household: {
      one: "tu unidad familiar tiene una persona",
      other: "tu unidad familiar tiene {n} personas",
    },
    relatives: ["tu madre", "tu padre", "tu cónyuge"],
    with: "vives con {who}",
    accounts: { "=0": "no tienes cuentas", one: "tienes una cuenta", other: "tienes {n} cuentas" },
    properties: {
      "=0": "no tienes inmuebles",
      one: "tienes un inmueble",
      other: "tienes {n} inmuebles",
    },
    vehicles: {
      "=0": "no tienes vehículos",
      one: "tienes un vehículo",
      other: "tienes {n} vehículos",
    },
  },
  ro: {
    prefix: "Am înțeles",
    alone: "locuiești singur sau singură",
    household: {
      one: "nucleul tău familial are o persoană",
      few: "nucleul tău familial are {n} persoane",
      other: "nucleul tău familial are {n} de persoane",
    },
    relatives: ["mama ta", "tatăl tău", "soțul sau soția ta"],
    with: "locuiești cu {who}",
    accounts: {
      "=0": "nu ai conturi",
      one: "ai un cont",
      few: "ai {n} conturi",
      other: "ai {n} de conturi",
    },
    properties: {
      "=0": "nu ai imobile",
      one: "ai un imobil",
      few: "ai {n} imobile",
      other: "ai {n} de imobile",
    },
    vehicles: {
      "=0": "nu ai vehicule",
      one: "ai un vehicul",
      few: "ai {n} vehicule",
      other: "ai {n} de vehicule",
    },
  },
  uk: {
    prefix: "Я зрозумів",
    alone: "Ви живете самі",
    household: {
      one: "у Вашій сім’ї {n} особа",
      few: "у Вашій сім’ї {n} особи",
      many: "у Вашій сім’ї {n} осіб",
      other: "у Вашій сім’ї {n} особи",
    },
    relatives: ["матір’ю", "батьком", "чоловіком або дружиною"],
    with: "Ви живете з {who}",
    accounts: {
      "=0": "у Вас немає рахунків",
      "=1": "у Вас один рахунок",
      one: "у Вас {n} рахунок",
      few: "у Вас {n} рахунки",
      many: "у Вас {n} рахунків",
      other: "у Вас {n} рахунку",
    },
    properties: {
      "=0": "у Вас немає нерухомості",
      "=1": "у Вас один об’єкт нерухомості",
      one: "у Вас {n} об’єкт нерухомості",
      few: "у Вас {n} об’єкти нерухомості",
      many: "у Вас {n} об’єктів нерухомості",
      other: "у Вас {n} об’єкта нерухомості",
    },
    vehicles: {
      "=0": "у Вас немає транспортних засобів",
      "=1": "у Вас один транспортний засіб",
      one: "у Вас {n} транспортний засіб",
      few: "у Вас {n} транспортні засоби",
      many: "у Вас {n} транспортних засобів",
      other: "у Вас {n} транспортного засобу",
    },
  },
  ar: {
    prefix: "فهمت",
    alone: "تعيش وحدك",
    household: {
      zero: "تتكون أسرتك من {n} أشخاص",
      one: "تتكون أسرتك من شخص واحد",
      two: "تتكون أسرتك من شخصين",
      few: "تتكون أسرتك من {n} أشخاص",
      many: "تتكون أسرتك من {n} شخصًا",
      other: "تتكون أسرتك من {n} شخص",
    },
    relatives: ["والدتك", "والدك", "زوجك أو زوجتك"],
    with: "تعيش مع {who}",
    accounts: {
      zero: "ليس لديك حسابات",
      one: "لديك حساب واحد",
      two: "لديك حسابان",
      few: "لديك {n} حسابات",
      many: "لديك {n} حسابًا",
      other: "لديك {n} حساب",
    },
    properties: {
      zero: "ليس لديك عقارات",
      one: "لديك عقار واحد",
      two: "لديك عقاران",
      few: "لديك {n} عقارات",
      many: "لديك {n} عقارًا",
      other: "لديك {n} عقار",
    },
    vehicles: {
      zero: "ليس لديك مركبات",
      one: "لديك مركبة واحدة",
      two: "لديك مركبتان",
      few: "لديك {n} مركبات",
      many: "لديك {n} مركبةً",
      other: "لديك {n} مركبة",
    },
  },
  bn: {
    prefix: "বুঝেছি",
    alone: "আপনি একা থাকেন",
    household: { other: "আপনার পরিবারে {n} জন আছেন" },
    relatives: ["আপনার মায়ের", "আপনার বাবার", "আপনার স্বামী বা স্ত্রীর"],
    with: "আপনি {who} সঙ্গে থাকেন",
    accounts: {
      "=0": "আপনার কোনো হিসাব নেই",
      "=1": "আপনার একটি হিসাব আছে",
      other: "আপনার {n}টি হিসাব আছে",
    },
    properties: {
      "=0": "আপনার কোনো সম্পত্তি নেই",
      "=1": "আপনার একটি সম্পত্তি আছে",
      other: "আপনার {n}টি সম্পত্তি আছে",
    },
    vehicles: {
      "=0": "আপনার কোনো গাড়ি নেই",
      "=1": "আপনার একটি গাড়ি আছে",
      other: "আপনার {n}টি গাড়ি আছে",
    },
  },
};

type Composition = {
  /** After the prefix: French puts a space before the colon. */
  colon: string;
  separator: string;
  conjunction: string;
  stop: string;
  sharedPrefix: string | null;
  /**
   * Joins a positive fact to a negative one ("у Вас немає рахунків, але є 2 транспортні
   * засоби"). Without it the shared prefix is kept, since dropping it after "у Вас немає…"
   * would read as still negated.
   */
  contrast?: { joiner: string; prefix: string };
};
const composition: Record<Language, Composition> = {
  it: { colon: ": ", separator: ", ", conjunction: " e ", stop: ".", sharedPrefix: "hai " },
  en: { colon: ": ", separator: ", ", conjunction: " and ", stop: ".", sharedPrefix: "you have " },
  fr: { colon: " : ", separator: ", ", conjunction: " et ", stop: ".", sharedPrefix: "vous avez " },
  es: { colon: ": ", separator: ", ", conjunction: " y ", stop: ".", sharedPrefix: "tienes " },
  ro: { colon: ": ", separator: ", ", conjunction: " și ", stop: ".", sharedPrefix: "ai " },
  uk: {
    colon: ": ",
    separator: ", ",
    conjunction: " і ",
    stop: ".",
    sharedPrefix: "у Вас ",
    contrast: { joiner: ", але ", prefix: "є " },
  },
  ar: { colon: ": ", separator: "، ", conjunction: " و", stop: ".", sharedPrefix: "لديك " },
  bn: { colon: ": ", separator: ", ", conjunction: " এবং ", stop: "।", sharedPrefix: null },
};
/** `negative` marks the facts that say there is none ("non hai conti"). */
function joinFacts(
  facts: string[],
  language: Language,
  compact = false,
  negative: ReadonlySet<number> = new Set(),
): string {
  const { separator, conjunction, sharedPrefix, contrast } = composition[language];
  return facts.reduce((joined, fact, index) => {
    if (index === 0) return fact;
    const joiner = index === facts.length - 1 ? conjunction : separator;
    const shared =
      compact &&
      sharedPrefix &&
      fact.startsWith(sharedPrefix) &&
      facts[index - 1]?.startsWith(sharedPrefix);
    if (!shared) return `${joined}${joiner}${fact}`;
    const rest = fact.slice(sharedPrefix.length);
    if (!negative.has(index - 1) || negative.has(index)) return `${joined}${joiner}${rest}`;
    return contrast
      ? `${joined}${contrast.joiner}${contrast.prefix}${rest}`
      : `${joined}${joiner}${fact}`;
  }, "");
}

function accountBanks(sentence: string, banks: string[], language: Language): string {
  if (!banks.length) return sentence;
  const names = joinFacts(banks, language);
  if (language === "bn") return sentence.replace("হিসাব", `${names} হিসাব`);
  return `${sentence}${language === "en" ? " with " : " "}${names}`;
}

export function turnAcknowledgement(
  view: Pick<CitizenCase, "language" | "practice" | "answers">,
  proposal: IntakeProposal,
  previous: Record<string, AnswerValue>,
  _text: string,
  previousPractice?: PracticeId | null,
) {
  const words = phrases[view.language];
  const changes = Object.fromEntries(
    Object.entries(proposal.answers).filter(
      ([key, value]) =>
        Object.hasOwn(view.answers, key) &&
        JSON.stringify(previous[key]) !== JSON.stringify(value) &&
        JSON.stringify(view.answers[key]) === JSON.stringify(value),
    ),
  );
  const facts: string[] = [];
  const negative = new Set<number>();
  const practiceName =
    view.practice &&
    (previousPractice === null ||
      (previousPractice === undefined && Object.keys(previous).length === 0))
      ? view.practice.name
      : null;
  const relations = changes.household_relations;
  if (Array.isArray(relations) && relations.length) {
    const names = relations.flatMap((relation) => {
      const index = ["madre", "padre", "coniuge"].indexOf(String(relation));
      return index >= 0 ? [words.relatives[index]!] : [];
    });
    if (names.length) facts.push(words.with.replace("{who}", joinFacts(names, view.language)));
  } else if (typeof changes.household_count === "number") {
    facts.push(
      changes.household_count === 1
        ? words.alone
        : plural(view.language, changes.household_count, words.household),
    );
  }
  for (const [key, templates] of [
    ["accounts_count", words.accounts],
    ["properties_count", words.properties],
    ["vehicles_count", words.vehicles],
  ] as const) {
    const count = changes[key];
    if (typeof count !== "number") {
      if (key === "accounts_count") {
        const banks = Object.entries(changes)
          .filter(([id, value]) => /^account_bank_\d+$/.test(id) && typeof value === "string")
          .map(([, value]) => String(value));
        if (banks.length)
          facts.push(accountBanks(plural(view.language, 1, templates), banks, view.language));
      }
      continue;
    }
    if (count === 0) negative.add(facts.length);
    let sentence = plural(view.language, count, templates);
    if (key === "accounts_count") {
      const banks = Object.entries(changes)
        .filter(([id, value]) => /^account_bank_\d+$/.test(id) && typeof value === "string")
        .map(([, value]) => String(value));
      sentence = accountBanks(sentence, banks, view.language);
    }
    facts.push(sentence);
  }
  const sentence = joinFacts(facts, view.language, true, negative);
  const { colon, stop } = composition[view.language];
  if (practiceName)
    return `${words.prefix}${colon}${practiceName}${stop}${sentence ? ` ${sentence[0]!.toLocaleUpperCase(view.language)}${sentence.slice(1)}${stop}` : ""}`;
  return sentence ? `${words.prefix}${colon}${sentence}${stop}` : null;
}
