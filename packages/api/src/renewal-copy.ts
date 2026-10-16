import type { Language } from "@avanti/contracts";

const copy: Record<Language, { subject: string; text: string }> = {
  it: {
    subject: "Prepara il rinnovo ISEE {year}",
    text: "Il tuo CAF ti invita a preparare il rinnovo ISEE {year}. Apri il link personale, conferma il nucleo familiare attuale e rispondi alle domande del nuovo anno. Non condividere questo link.",
  },
  en: {
    subject: "Prepare your {year} ISEE renewal",
    text: "Your CAF invites you to prepare your {year} ISEE renewal. Open your personal link, confirm your current household and answer the new year's questions. Do not share this link.",
  },
  fr: {
    subject: "Préparez votre renouvellement ISEE {year}",
    text: "Votre CAF vous invite à préparer le renouvellement ISEE {year}. Ouvrez votre lien personnel, confirmez votre foyer actuel et répondez aux questions de la nouvelle année. Ne partagez pas ce lien.",
  },
  es: {
    subject: "Prepara la renovación ISEE {year}",
    text: "Tu CAF te invita a preparar la renovación ISEE {year}. Abre tu enlace personal, confirma tu unidad familiar actual y responde a las preguntas del nuevo año. No compartas este enlace.",
  },
  ro: {
    subject: "Pregătește reînnoirea ISEE {year}",
    text: "CAF-ul tău te invită să pregătești reînnoirea ISEE {year}. Deschide linkul personal, confirmă familia actuală și răspunde la întrebările pentru noul an. Nu distribui acest link.",
  },
  uk: {
    subject: "Підготуйте поновлення ISEE на {year} рік",
    text: "Ваш CAF запрошує підготувати поновлення ISEE на {year} рік. Відкрийте особисте посилання, підтвердьте поточний склад сім’ї та дайте відповіді на запитання за новий рік. Не передавайте це посилання іншим.",
  },
  ar: {
    subject: "حضّر تجديد ISEE لعام {year}",
    text: "يدعوك مركز CAF إلى تحضير تجديد ISEE لعام {year}. افتح رابطك الشخصي، وأكّد أفراد أسرتك الحاليين، وأجب عن أسئلة العام الجديد. لا تشارك هذا الرابط.",
  },
  bn: {
    subject: "{year} সালের ISEE নবায়নের প্রস্তুতি নিন",
    text: "আপনার CAF আপনাকে {year} সালের ISEE নবায়নের প্রস্তুতি নিতে আমন্ত্রণ জানাচ্ছে। ব্যক্তিগত লিংকটি খুলুন, বর্তমান পরিবারের সদস্যদের নিশ্চিত করুন এবং নতুন বছরের প্রশ্নের উত্তর দিন। এই লিংক অন্য কাউকে দেবেন না।",
  },
};
export function renewalInvitation(language: Language, year: number, link: string) {
  return {
    subject: copy[language].subject.replace("{year}", String(year)),
    text: `${copy[language].text.replace("{year}", String(year))}\n\n${link}`,
  };
}
