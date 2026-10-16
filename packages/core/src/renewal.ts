import type { AnswerValue, Language, Question } from "@avanti/contracts";
import { t } from "./i18n";

export const renewalPending = (answers: Record<string, AnswerValue>) =>
  answers.renewal_household_confirmed === false;

const copy: Record<Language, { prompt: string; help: string; notice: string }> = {
  it: {
    prompt: "Il tuo nucleo familiare è ancora questo?",
    help: "Questi sono i componenti dell'anno scorso. Conferma l'elenco, togli chi non fa più parte del nucleo e aggiungi le nuove persone.",
    notice:
      "Stai preparando il rinnovo ISEE {year} dalla pratica {previousYear}. Conferma il nucleo attuale e rispondi alle domande del nuovo anno.",
  },
  en: {
    prompt: "Is this still your household?",
    help: "These are last year's household members. Confirm the list, remove anyone who has left and add any new members.",
    notice:
      "You are preparing your {year} ISEE renewal from your {previousYear} case. Confirm your current household and answer the new year's questions.",
  },
  fr: {
    prompt: "Votre foyer est-il toujours composé de ces personnes ?",
    help: "Voici les membres du foyer de l'année dernière. Confirmez la liste, retirez les personnes parties et ajoutez les nouveaux membres.",
    notice:
      "Vous préparez le renouvellement ISEE {year} à partir du dossier {previousYear}. Confirmez votre foyer actuel et répondez aux questions de la nouvelle année.",
  },
  es: {
    prompt: "¿Tu unidad familiar sigue siendo esta?",
    help: "Estos son los miembros del año pasado. Confirma la lista, quita a quienes ya no forman parte y añade a las nuevas personas.",
    notice:
      "Estás preparando la renovación ISEE {year} a partir del expediente {previousYear}. Confirma tu unidad familiar actual y responde a las preguntas del nuevo año.",
  },
  ro: {
    prompt: "Familia ta este în continuare formată din aceste persoane?",
    help: "Aceștia sunt membrii de anul trecut. Confirmă lista, elimină persoanele care au plecat și adaugă noii membri.",
    notice:
      "Pregătești reînnoirea ISEE {year} pe baza dosarului din {previousYear}. Confirmă familia actuală și răspunde la întrebările pentru noul an.",
  },
  uk: {
    prompt: "Склад Вашої сім’ї залишився таким самим?",
    help: "Це члени сім’ї за минулий рік. Підтвердьте список, видаліть тих, хто вибув, і додайте нових членів.",
    notice:
      "Ви готуєте поновлення ISEE на {year} рік на основі справи за {previousYear} рік. Підтвердьте поточний склад сім’ї та дайте відповіді на запитання за новий рік.",
  },
  ar: {
    prompt: "هل ما زالت أسرتك تتكوّن من هؤلاء الأشخاص؟",
    help: "هؤلاء هم أفراد الأسرة في العام الماضي. أكّد القائمة، واحذف من لم يعد ضمن الأسرة، وأضف الأفراد الجدد.",
    notice:
      "أنت تحضّر تجديد ISEE لعام {year} انطلاقًا من ملف عام {previousYear}. أكّد أفراد أسرتك الحاليين وأجب عن أسئلة العام الجديد.",
  },
  bn: {
    prompt: "আপনার পরিবারে কি এখনও এই সদস্যরাই আছেন?",
    help: "এরা গত বছরের পরিবারের সদস্য। তালিকা নিশ্চিত করুন, যাঁরা আর পরিবারের অংশ নন তাঁদের বাদ দিন এবং নতুন সদস্য যোগ করুন।",
    notice:
      "আপনি {previousYear} সালের ফাইল থেকে {year} সালের ISEE নবায়নের প্রস্তুতি নিচ্ছেন। বর্তমান পরিবারের সদস্যদের নিশ্চিত করুন এবং নতুন বছরের প্রশ্নের উত্তর দিন।",
  },
};
export function renewalQuestion(language: Language): Question {
  return {
    id: "members",
    kind: "members",
    prompt: copy[language].prompt,
    help: copy[language].help,
    required: true,
    min: 1,
    max: 20,
    section: t(language, "household"),
  };
}
export function renewalNotice(language: Language, previousYear: number, year: number) {
  return copy[language].notice
    .replace("{previousYear}", String(previousYear))
    .replace("{year}", String(year));
}
