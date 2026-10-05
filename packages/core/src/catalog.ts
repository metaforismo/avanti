import {
  PRACTICE_IDS,
  type AnswerValue,
  type Language,
  type PracticeAvailability,
  type PracticeCategory,
  type PracticeId,
  type PracticeSummary,
  type Question,
} from "@avanti/contracts";
import { localize, t, type Text, type TextKey } from "./i18n";
import { buildHousehold } from "./household";

export const CATALOG_VERSION = "2027-preparation.1";
export type Answers = Record<string, AnswerValue>;
export type QuestionDefinition = { question: Question; dependsOn: string[] };
export type PracticeDefinition = {
  id: PracticeId;
  category: PracticeCategory;
  availability: PracticeAvailability;
  name: TextKey;
  description: TextKey;
  referenceYear: number | null;
  declarationYear: number | null;
  estimatedMinutes: number;
};

export const catalog: Record<PracticeId, PracticeDefinition> = {
  isee_ordinario: {
    id: "isee_ordinario",
    category: "assistenza",
    availability: "available",
    name: "isee",
    description: "iseeDescription",
    referenceYear: 2025,
    declarationYear: 2027,
    estimatedMinutes: 15,
  },
  isee_universitario: {
    id: "isee_universitario",
    category: "assistenza",
    availability: "coming_soon",
    name: "universityName",
    description: "universityDescription",
    referenceYear: 2025,
    declarationYear: 2027,
    estimatedMinutes: 20,
  },
  assegno_unico: {
    id: "assegno_unico",
    category: "assistenza",
    availability: "beta",
    name: "auu",
    description: "auuDescription",
    referenceYear: null,
    declarationYear: null,
    estimatedMinutes: 8,
  },
  modello_730: {
    id: "modello_730",
    category: "fiscale",
    availability: "beta",
    name: "tax",
    description: "taxDescription",
    referenceYear: 2026,
    declarationYear: 2027,
    estimatedMinutes: 12,
  },
  permesso_soggiorno: {
    id: "permesso_soggiorno",
    category: "immigrazione",
    availability: "beta",
    name: "permit",
    description: "permitDescription",
    referenceYear: null,
    declarationYear: null,
    estimatedMinutes: 10,
  },
  red: {
    id: "red",
    category: "previdenza",
    availability: "coming_soon",
    name: "red",
    description: "soon",
    referenceYear: null,
    declarationYear: null,
    estimatedMinutes: 10,
  },
  successione_semplice: {
    id: "successione_semplice",
    category: "successioni",
    availability: "coming_soon",
    name: "succession",
    description: "soon",
    referenceYear: null,
    declarationYear: null,
    estimatedMinutes: 20,
  },
  cittadinanza: {
    id: "cittadinanza",
    category: "immigrazione",
    availability: "coming_soon",
    name: "citizenship",
    description: "soon",
    referenceYear: null,
    declarationYear: null,
    estimatedMinutes: 20,
  },
  naspi: {
    id: "naspi",
    category: "previdenza",
    availability: "coming_soon",
    name: "naspi",
    description: "soon",
    referenceYear: null,
    declarationYear: null,
    estimatedMinutes: 10,
  },
};

export function getPractice(id: PracticeId, language: Language, _now: Date): PracticeSummary {
  const definition = catalog[id];
  return {
    id,
    category: definition.category,
    availability: definition.availability,
    name: t(language, definition.name),
    description: t(language, definition.description),
    referenceYear: definition.referenceYear,
    estimatedMinutes: definition.estimatedMinutes,
  };
}
export function listPractices(language: Language, now: Date): PracticeSummary[] {
  return PRACTICE_IDS.map((id) => getPractice(id, language, now));
}

const extraPrompts = {
  household_exceptions: [
    "Ci sono coniugi con residenze diverse o figli maggiorenni a carico fiscale che vivono altrove? Il CAF verifica se fanno parte del nucleo.",
    "Are there spouses at different addresses or adult children living elsewhere who depend on the family for tax purposes? The CAF checks the household.",
    "Y a-t-il des conjoints à des adresses différentes ou des enfants adultes à charge fiscale vivant ailleurs ? Le CAF vérifie le foyer.",
    "¿Hay cónyuges con distintas residencias o hijos adultos a cargo fiscal que viven fuera? El CAF revisa la familia.",
    "Sunt soți cu adrese diferite sau copii adulți în întreținere fiscală care locuiesc separat? CAF verifică familia.",
    "Чи є подружжя з різними адресами або дорослі діти на податковому утриманні, які живуть окремо? CAF перевірить склад сім’ї.",
    "هل يوجد زوجان بعنوانين مختلفين أو أبناء بالغون على إعالة الأسرة ضريبيًا يعيشون خارجها؟ يتحقق CAF من الأسرة.",
    "স্বামী-স্ত্রীর আলাদা ঠিকানা বা করের হিসাবে নির্ভরশীল প্রাপ্তবয়স্ক সন্তান অন্যত্র থাকেন? CAF পরিবার যাচাই করবে।",
  ],
  income_present: [
    "{name} aveva redditi o trattamenti nel 2025? Se non ne aveva, non serve inventare una CU.",
    "Did {name} have income or benefits in 2025? If not, you do not need an income certificate (Certificazione Unica).",
    "{name} avait-il des revenus ou allocations en 2025 ? Sinon, pas besoin d’attestation (Certificazione Unica).",
    "¿{name} tuvo ingresos o prestaciones en 2025? Si no, no hace falta un certificado (Certificazione Unica).",
    "{name} a avut venituri sau prestații în 2025? Dacă nu, nu trebuie certificat (Certificazione Unica).",
    "Чи мав/мала {name} доходи чи виплати у 2025 році? Якщо ні, довідка (Certificazione Unica) не потрібна.",
    "هل كان لدى {name} دخل أو إعانات في 2025؟ إن لم يكن، لا تحتاج شهادة (Certificazione Unica).",
    "{name}-এর ২০২৫-এ আয় বা ভাতা ছিল? না থাকলে আয়ের সনদ (Certificazione Unica) দরকার নেই।",
  ],
  account_type: [
    "Rapporto {index}: che tipo è?",
    "Account {index}: what type is it?",
    "Compte {index} : de quel type ?",
    "Cuenta {index}: ¿qué tipo es?",
    "Contul {index}: ce tip este?",
    "Рахунок {index}: який тип?",
    "الحساب {index}: ما نوعه؟",
    "হিসাব {index}: কী ধরনের?",
  ],
  deposit: [
    "Conto, libretto o carta con IBAN",
    "Account, savings book or card with IBAN",
    "Compte, livret ou carte avec IBAN",
    "Cuenta, libreta o tarjeta con IBAN",
    "Cont, carnet de economii sau card cu IBAN",
    "Рахунок, ощадна книжка чи картка з IBAN",
    "حساب أو دفتر توفير أو بطاقة مع IBAN",
    "হিসাব, সঞ্চয় বই বা IBAN-সহ কার্ড",
  ],
  investment: [
    "Titoli, fondi, assicurazioni o altri investimenti",
    "Bonds, funds, insurance or other investments",
    "Titres, fonds, assurances ou autres placements",
    "Títulos, fondos, seguros u otras inversiones",
    "Titluri, fonduri, asigurări sau alte investiții",
    "Облігації, фонди, страхування чи інші інвестиції",
    "سندات أو صناديق أو تأمين أو استثمارات أخرى",
    "বন্ড, ফান্ড, বীমা বা অন্য বিনিয়োগ",
  ],
  other: [
    "Altro / non so",
    "Other / I don't know",
    "Autre / je ne sais pas",
    "Otro / no sé",
    "Altul / nu știu",
    "Інше / не знаю",
    "غير ذلك / لا أعرف",
    "অন্য / জানি না",
  ],
  selectMembers: [
    "Quali persone? Seleziona tutte quelle interessate.",
    "Which people? Select everyone concerned.",
    "Quelles personnes ? Sélectionnez toutes les personnes concernées.",
    "¿Qué personas? Selecciona todas las afectadas.",
    "Care persoane? Selectează toate persoanele implicate.",
    "Які люди? Виберіть усіх, кого це стосується.",
    "أي أشخاص؟ اختر جميع المعنيين.",
    "কারা? সংশ্লিষ্ট সবাইকে বেছে নিন।",
  ],
  excluded: [
    "Avete titoli di Stato italiani, buoni fruttiferi postali o libretti postali?",
    "Do you have Italian state bonds or postal savings (buoni fruttiferi postali / libretti postali)?",
    "Avez-vous des titres d’État italiens ou une épargne postale (buoni fruttiferi postali / libretti postali) ?",
    "¿Tienen deuda pública italiana o ahorro postal (buoni fruttiferi postali / libretti postali)?",
    "Aveți titluri de stat italiene sau economii poștale (buoni fruttiferi postali / libretti postali)?",
    "Чи маєте італійські державні облігації чи поштові заощадження (buoni fruttiferi postali / libretti postali)?",
    "هل لديكم سندات حكومية إيطالية أو مدخرات بريدية (buoni fruttiferi postali / libretti postali)؟",
    "ইতালির সরকারি বন্ড বা ডাক সঞ্চয় (buoni fruttiferi postali / libretti postali) আছে?",
  ],
  existing: [
    "Hai già una domanda di Assegno unico accolta dall’INPS?",
    "Has INPS already accepted your child allowance application?",
    "L’INPS a-t-il déjà accepté votre demande d’Assegno unico ?",
    "¿INPS ya ha aceptado tu solicitud de Assegno unico?",
    "INPS ți-a acceptat deja cererea de Assegno unico?",
    "INPS уже схвалив вашу заяву на Assegno unico?",
    "هل وافق INPS سابقًا على طلب Assegno unico؟",
    "INPS ইতিমধ্যে আপনার Assegno unico আবেদন মঞ্জুর করেছে?",
  ],
  isee: [
    "Hai un ISEE valido? Non è obbligatorio per chiedere l’Assegno unico.",
    "Do you have a valid ISEE? You can request child allowance without it.",
    "Avez-vous un ISEE valide ? Il n’est pas obligatoire pour l’Assegno unico.",
    "¿Tienes un ISEE válido? No es obligatorio para pedir Assegno unico.",
    "Ai un ISEE valid? Nu este obligatoriu pentru Assegno unico.",
    "Чи маєте чинний ISEE? Він не обов’язковий для Assegno unico.",
    "هل لديك ISEE ساري؟ ليس إلزاميًا لطلب Assegno unico.",
    "আপনার বৈধ ISEE আছে? Assegno unico চাইতে এটি বাধ্যতামূলক নয়।",
  ],
  children: [
    "Ci sono figli di 18–20 anni, con disabilità o con affidamento particolare?",
    "Are there children aged 18–20, with a disability or with special custody arrangements?",
    "Y a-t-il des enfants de 18 à 20 ans, avec un handicap ou une garde particulière ?",
    "¿Hay hijos de 18–20 años, con discapacidad o custodia especial?",
    "Sunt copii de 18–20 ani, cu dizabilitate sau custodie specială?",
    "Чи є діти 18–20 років, з інвалідністю або особливими умовами опіки?",
    "هل يوجد أبناء بعمر 18–20 سنة أو ذوو إعاقة أو بترتيب حضانة خاص؟",
    "১৮–২০ বছরের সন্তান, প্রতিবন্ধী সন্তান বা বিশেষ অভিভাবকত্ব আছে?",
  ],
  tax_expenses: [
    "Hai spese 2026 da portare al CAF (sanità, scuola, affitto, mutuo o altre)?",
    "Do you have expenses for 2026 to show the CAF (health, school, rent, mortgage or other)?",
    "Avez-vous des dépenses 2026 pour le CAF (santé, école, loyer, prêt ou autres) ?",
    "¿Tienes gastos de 2026 para el CAF (salud, escuela, alquiler, hipoteca u otros)?",
    "Ai cheltuieli din 2026 pentru CAF (sănătate, școală, chirie, credit sau altele)?",
    "Чи маєте витрати за 2026 рік для CAF (здоров’я, школа, оренда, кредит тощо)?",
    "هل لديك مصاريف 2026 لعرضها على CAF (صحة أو مدرسة أو إيجار أو قرض أو غيرها)؟",
    "CAF-কে দেখানোর ২০২৬-এর খরচ আছে (স্বাস্থ্য, স্কুল, ভাড়া, ঋণ বা অন্য)?",
  ],
  tax_foreign: [
    "Nel 2026 avevi redditi o beni all’estero? Il CAF verifica anche la scelta del modello.",
    "Did you have income or assets abroad in 2026? The CAF also checks which tax form applies.",
    "Aviez-vous des revenus ou biens à l’étranger en 2026 ? Le CAF vérifie aussi le formulaire adapté.",
    "¿En 2026 tenías ingresos o bienes en el extranjero? El CAF revisa también el formulario adecuado.",
    "În 2026 aveai venituri sau bunuri în străinătate? CAF verifică și formularul potrivit.",
    "Чи мали ви доходи чи майно за кордоном у 2026 році? CAF також перевірить потрібну форму.",
    "هل كان لديك دخل أو ممتلكات خارج إيطاليا في 2026؟ يتحقق CAF أيضًا من النموذج المناسب.",
    "২০২৬-এ বিদেশে আয় বা সম্পদ ছিল? CAF সঠিক কর ফর্মও যাচাই করবে।",
  ],
  permit_action: [
    "È il primo rilascio o il rinnovo del permesso?",
    "Is this your first permit or a renewal?",
    "Est-ce votre premier titre ou un renouvellement ?",
    "¿Es el primer permiso o una renovación?",
    "Este primul permis sau o reînnoire?",
    "Це перший дозвіл чи поновлення?",
    "هل هذا أول تصريح أم تجديد؟",
    "প্রথম অনুমতি নাকি নবায়ন?",
  ],
  renewal: [
    "Rinnovo",
    "Renewal",
    "Renouvellement",
    "Renovación",
    "Reînnoire",
    "Поновлення",
    "تجديد",
    "নবায়ন",
  ],
  first: [
    "Primo rilascio",
    "First permit",
    "Premier titre",
    "Primer permiso",
    "Primul permis",
    "Перший дозвіл",
    "أول تصريح",
    "প্রথম অনুমতি",
  ],
  permit_reason: [
    "Per quale motivo chiedi il permesso?",
    "Why are you applying for the permit?",
    "Pour quel motif demandez-vous le titre ?",
    "¿Por qué motivo pides el permiso?",
    "Pentru ce motiv ceri permisul?",
    "З якої причини подаєте на дозвіл?",
    "لأي سبب تطلب التصريح؟",
    "কোন কারণে অনুমতি চাইছেন?",
  ],
  work: ["Lavoro", "Work", "Travail", "Trabajo", "Muncă", "Робота", "العمل", "কাজ"],
  study: ["Studio", "Study", "Études", "Estudios", "Studii", "Навчання", "الدراسة", "পড়াশোনা"],
  family: ["Famiglia", "Family", "Famille", "Familia", "Familie", "Сім’я", "الأسرة", "পরিবার"],
} as const satisfies Record<string, Text>;

export function questionDefinitions(
  practiceId: PracticeId,
  answers: Answers,
  language: Language,
  _now: Date,
): QuestionDefinition[] {
  if (catalog[practiceId].availability === "coming_soon") return [];
  const definitions: QuestionDefinition[] = [];
  const people = buildHousehold(answers);
  const memberOptions = people.map((member) => ({
    value: member.id,
    label: [member.firstName, member.lastName].filter(Boolean).join(" "),
  }));
  function add(
    id: string,
    kind: Question["kind"],
    prompt: string,
    section: TextKey = "particular",
    required = true,
    dependsOn: string[] = [],
    extra: Partial<Question> = {},
  ) {
    definitions.push({
      question: { id, kind, prompt, required, section: t(language, section), ...extra },
      dependsOn,
    });
  }
  function named(
    id: TextKey,
    kind: Question["kind"],
    section: TextKey,
    extra: Partial<Question> = {},
  ) {
    add(id, kind, t(language, id), section, true, [], extra);
  }
  function selectMembers(id: string, parent: string) {
    if (answers[parent] === true)
      add(
        id,
        "multi_choice",
        localize(language, extraPrompts.selectMembers),
        "particular",
        true,
        [parent, "members"],
        { options: memberOptions, min: 1 },
      );
  }
  if (practiceId === "isee_ordinario" || practiceId === "assegno_unico")
    named("household_count", "number", "household", { min: 1, max: 20 });
  add(
    "members",
    "members",
    t(language, "members"),
    "household",
    true,
    practiceId === "permesso_soggiorno" || practiceId === "modello_730" ? [] : ["household_count"],
    { help: t(language, "membersHelp"), min: 1, max: 20 },
  );
  if (practiceId === "isee_ordinario") {
    add(
      "household_exceptions",
      "yes_no",
      localize(language, extraPrompts.household_exceptions),
      "household",
    );
    for (const member of people) {
      add(
        `income_present_${member.id}`,
        "yes_no",
        localize(language, extraPrompts.income_present, {
          name: [member.firstName, member.lastName].filter(Boolean).join(" "),
        }),
        "incomeGroup",
        true,
        ["members"],
      );
    }
    named("housing", "single_choice", "home", {
      options: ["rent", "owned", "hosted"].map((value) => ({
        value,
        label: t(language, value as "rent" | "owned" | "hosted"),
      })),
    });
    named("accounts_count", "number", "assets", { min: 0, max: 50 });
    for (let index = 0; index < boundedCount(answers.accounts_count); index++) {
      const variables = { index: index + 1 };
      add(
        `account_type_${index}`,
        "single_choice",
        localize(language, extraPrompts.account_type, variables),
        "assets",
        true,
        ["accounts_count"],
        {
          options: ["deposit", "investment", "other"].map((value) => ({
            value,
            label: localize(language, extraPrompts[value as "deposit" | "investment" | "other"]),
          })),
        },
      );
      add(
        `account_bank_${index}`,
        "text",
        t(language, "account_bank", variables),
        "assets",
        false,
        ["accounts_count"],
        { max: 120 },
      );
      add(
        `account_owner_${index}`,
        "single_choice",
        t(language, "owner", { ...variables, kind: t(language, "accountKind") }),
        "assets",
        true,
        ["accounts_count", "members"],
        { options: [...memberOptions, { value: "joint", label: t(language, "joint") }] },
      );
    }
    if (boundedCount(answers.accounts_count) > 0)
      add("excluded_savings", "yes_no", localize(language, extraPrompts.excluded), "assets", true, [
        "accounts_count",
      ]);
    named("properties_count", "number", "assets", { min: 0, max: 50 });
    for (let index = 0; index < boundedCount(answers.properties_count); index++) {
      add(
        `property_owner_${index}`,
        "single_choice",
        t(language, "owner", { index: index + 1, kind: t(language, "propertyKind") }),
        "assets",
        true,
        ["properties_count", "members"],
        { options: [...memberOptions, { value: "joint", label: t(language, "joint") }] },
      );
      add(
        `property_mortgage_${index}`,
        "yes_no",
        t(language, "property_mortgage", { index: index + 1 }),
        "assets",
        true,
        ["properties_count"],
      );
    }
    named("vehicles_count", "number", "assets", { min: 0, max: 50 });
    for (let index = 0; index < boundedCount(answers.vehicles_count); index++)
      add(
        `vehicle_owner_${index}`,
        "single_choice",
        t(language, "owner", { index: index + 1, kind: t(language, "vehicleKind") }),
        "assets",
        true,
        ["vehicles_count", "members"],
        { options: memberOptions },
      );
    named("disability", "yes_no", "particular");
    selectMembers("disability_members", "disability");
    named("nonresident_parent", "yes_no", "household");
    named("university", "yes_no", "particular");
    named("self_employed", "yes_no", "incomeGroup");
    selectMembers("self_employed_members", "self_employed");
    named("foreign_income", "yes_no", "incomeGroup");
    selectMembers("foreign_income_members", "foreign_income");
    named("foreign_assets", "yes_no", "assets");
    named("maintenance", "yes_no", "incomeGroup");
    selectMembers("maintenance_members", "maintenance");
    named("exempt_income", "yes_no", "incomeGroup");
    selectMembers("exempt_income_members", "exempt_income");
  } else if (practiceId === "assegno_unico") {
    add("auu_existing", "yes_no", localize(language, extraPrompts.existing));
    add("has_isee", "yes_no", localize(language, extraPrompts.isee), "incomeGroup", false);
    add("child_special", "yes_no", localize(language, extraPrompts.children));
  } else if (practiceId === "modello_730") {
    add(
      "tax_expenses",
      "yes_no",
      localize(language, extraPrompts.tax_expenses),
      "incomeGroup",
      false,
    );
    add("tax_foreign", "yes_no", localize(language, extraPrompts.tax_foreign), "incomeGroup");
  } else if (practiceId === "permesso_soggiorno") {
    add(
      "permit_action",
      "single_choice",
      localize(language, extraPrompts.permit_action),
      "particular",
      true,
      [],
      {
        options: ["renewal", "first"].map((value) => ({
          value,
          label: localize(language, extraPrompts[value as "renewal" | "first"]),
        })),
      },
    );
    add(
      "permit_reason",
      "single_choice",
      localize(language, extraPrompts.permit_reason),
      "particular",
      true,
      [],
      {
        options: ["work", "study", "family", "other"].map((value) => ({
          value,
          label: localize(language, extraPrompts[value as "work" | "study" | "family" | "other"]),
        })),
      },
    );
  }
  return definitions;
}

export function boundedCount(value: AnswerValue | undefined): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? Math.min(value, 50)
    : 0;
}
export function getQuestions(
  practiceId: PracticeId,
  answers: Answers,
  language: Language,
  now: Date,
): Question[] {
  return questionDefinitions(practiceId, answers, language, now).map(({ question }) => question);
}
