import type { AnswerValue, CitizenCase, Language, PracticeId } from "@avanti/contracts";
import type { IntakeProposal } from "./ai";

type Phrases = {
  prefix: string;
  alone: string;
  household: string;
  relatives: [string, string, string];
  with: string;
  accounts: [string, string];
  properties: [string, string];
  vehicles: [string, string];
};
const phrases: Record<Language, Phrases> = {
  it: {
    prefix: "Ho capito",
    alone: "Vivi da solo o sola",
    household: "Il tuo nucleo comprende {n} persone",
    relatives: ["tua madre", "tuo padre", "il tuo coniuge"],
    with: "Vivi con {who}",
    accounts: ["hai un conto", "hai {n} conti"],
    properties: ["hai un immobile", "hai {n} immobili"],
    vehicles: ["hai un veicolo", "hai {n} veicoli"],
  },
  en: {
    prefix: "I understood",
    alone: "You live alone",
    household: "Your household has {n} people",
    relatives: ["your mother", "your father", "your spouse"],
    with: "You live with {who}",
    accounts: ["you have a bank account", "you have {n} bank accounts"],
    properties: ["you own a property", "you own {n} properties"],
    vehicles: ["you have a vehicle", "you have {n} vehicles"],
  },
  fr: {
    prefix: "J’ai compris",
    alone: "Vous vivez seul ou seule",
    household: "Votre foyer compte {n} personnes",
    relatives: ["votre mère", "votre père", "votre conjoint"],
    with: "Vous vivez avec {who}",
    accounts: ["vous avez un compte", "vous avez {n} comptes"],
    properties: ["vous avez un bien immobilier", "vous avez {n} biens immobiliers"],
    vehicles: ["vous avez un véhicule", "vous avez {n} véhicules"],
  },
  es: {
    prefix: "He entendido",
    alone: "Vives solo o sola",
    household: "Tu hogar tiene {n} personas",
    relatives: ["tu madre", "tu padre", "tu cónyuge"],
    with: "Vives con {who}",
    accounts: ["tienes una cuenta", "tienes {n} cuentas"],
    properties: ["tienes un inmueble", "tienes {n} inmuebles"],
    vehicles: ["tienes un vehículo", "tienes {n} vehículos"],
  },
  ro: {
    prefix: "Am înțeles",
    alone: "Locuiești singur sau singură",
    household: "Familia ta are {n} persoane",
    relatives: ["mama ta", "tatăl tău", "soțul sau soția ta"],
    with: "Locuiești cu {who}",
    accounts: ["ai un cont", "ai {n} conturi"],
    properties: ["ai un imobil", "ai {n} imobile"],
    vehicles: ["ai un vehicul", "ai {n} vehicule"],
  },
  uk: {
    prefix: "Я зрозумів",
    alone: "Ви живете самі",
    household: "У вашій сім’ї {n} осіб",
    relatives: ["матір’ю", "батьком", "чоловіком або дружиною"],
    with: "Ви живете з {who}",
    accounts: ["у вас один рахунок", "у вас {n} рахунків"],
    properties: ["у вас один об’єкт нерухомості", "у вас {n} об’єктів нерухомості"],
    vehicles: ["у вас один транспортний засіб", "у вас {n} транспортних засобів"],
  },
  ar: {
    prefix: "فهمت",
    alone: "تعيش وحدك",
    household: "تتكون أسرتك من {n} أشخاص",
    relatives: ["والدتك", "والدك", "زوجك أو زوجتك"],
    with: "تعيش مع {who}",
    accounts: ["لديك حساب واحد", "لديك {n} حسابات"],
    properties: ["لديك عقار واحد", "لديك {n} عقارات"],
    vehicles: ["لديك مركبة واحدة", "لديك {n} مركبات"],
  },
  bn: {
    prefix: "বুঝেছি",
    alone: "আপনি একা থাকেন",
    household: "আপনার পরিবারে {n} জন আছেন",
    relatives: ["আপনার মা", "আপনার বাবা", "আপনার স্বামী বা স্ত্রী"],
    with: "আপনি {who}-এর সঙ্গে থাকেন",
    accounts: ["আপনার একটি হিসাব আছে", "আপনার {n}টি হিসাব আছে"],
    properties: ["আপনার একটি সম্পত্তি আছে", "আপনার {n}টি সম্পত্তি আছে"],
    vehicles: ["আপনার একটি গাড়ি আছে", "আপনার {n}টি গাড়ি আছে"],
  },
};

type Composition = {
  separator: string;
  conjunction: string;
  stop: string;
  sharedPrefix: string | null;
};
const composition: Record<Language, Composition> = {
  it: { separator: ", ", conjunction: " e ", stop: ".", sharedPrefix: "hai " },
  en: { separator: ", ", conjunction: " and ", stop: ".", sharedPrefix: "you have " },
  fr: { separator: ", ", conjunction: " et ", stop: ".", sharedPrefix: "vous avez " },
  es: { separator: ", ", conjunction: " y ", stop: ".", sharedPrefix: "tienes " },
  ro: { separator: ", ", conjunction: " și ", stop: ".", sharedPrefix: "ai " },
  uk: { separator: ", ", conjunction: " і ", stop: ".", sharedPrefix: "у вас " },
  ar: { separator: "، ", conjunction: " و", stop: ".", sharedPrefix: "لديك " },
  bn: { separator: ", ", conjunction: " এবং ", stop: "।", sharedPrefix: null },
};
function joinFacts(facts: string[], language: Language, compact = false): string {
  const { separator, conjunction, sharedPrefix } = composition[language];
  const clauses = facts.map((fact, index) =>
    compact &&
    sharedPrefix &&
    index > 0 &&
    fact.startsWith(sharedPrefix) &&
    facts[index - 1]?.startsWith(sharedPrefix)
      ? fact.slice(sharedPrefix.length)
      : fact,
  );
  return clauses.length < 2
    ? (clauses[0] ?? "")
    : `${clauses.slice(0, -1).join(separator)}${conjunction}${clauses.at(-1)}`;
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
        : words.household.replace("{n}", String(changes.household_count)),
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
        if (banks.length) facts.push(accountBanks(templates[0], banks, view.language));
      }
      continue;
    }
    let sentence = (count === 1 ? templates[0] : templates[1]).replace("{n}", String(count));
    if (key === "accounts_count") {
      const banks = Object.entries(changes)
        .filter(([id, value]) => /^account_bank_\d+$/.test(id) && typeof value === "string")
        .map(([, value]) => String(value));
      sentence = accountBanks(sentence, banks, view.language);
    }
    facts.push(sentence);
  }
  const sentence = joinFacts(facts, view.language, true);
  const stop = composition[view.language].stop;
  if (practiceName)
    return `${words.prefix}: ${practiceName}${stop}${sentence ? ` ${sentence[0]!.toLocaleUpperCase(view.language)}${sentence.slice(1)}${stop}` : ""}`;
  return sentence ? `${words.prefix}: ${sentence}${stop}` : null;
}
