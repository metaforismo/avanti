import type { Language, DocumentAnalysis } from "@avanti/contracts";
export const translationNotice: Record<Language, string> = {
  it: "Il CAF chiede un'integrazione. Leggi il messaggio originale o contatta lo sportello.",
  en: "Your CAF needs more information. Read the original message or contact the desk.",
  fr: "Votre CAF demande des informations. Lisez le message original ou contactez le guichet.",
  es: "Tu CAF necesita más información. Lee el mensaje original o contacta con la ventanilla.",
  ro: "CAF are nevoie de informații. Citește mesajul original sau contactează ghișeul.",
  uk: "CAF просить додаткові дані. Прочитайте оригінал повідомлення або зверніться до вікна обслуговування.",
  ar: "يطلب CAF معلومات إضافية. اقرأ الرسالة الأصلية أو اتصل بشباك الخدمة.",
  bn: "CAF আরও তথ্য চায়। মূল বার্তাটি পড়ুন বা সেবা কাউন্টারে যোগাযোগ করুন।",
};
export function heuristicAnalysis(fileName: string, requirements: string[]): DocumentAnalysis {
  const name = fileName.toLowerCase().replace(/[_-]/g, " ");
  const aliases: Record<string, string[]> = {
    identity: ["identita", "identity", "passport", "passaporto"],
    tax_code: ["codice fiscale", "tessera sanitaria"],
    account_balance: ["saldo", "balance"],
    account_average: ["giacenza", "average"],
    income: ["cu ", "certificazione", "730", "redditi"],
    rent: ["affitto", "locazione"],
    property: ["catasto", "visura"],
    vehicle: ["libretto", "veicolo"],
  };
  const detected =
    requirements.find(
      (id) =>
        name.includes(id.replace(/_/g, " ")) ||
        Object.entries(aliases).some(
          ([stem, words]) => id.includes(stem) && words.some((w) => name.includes(w)),
        ),
    ) ?? null;
  const year = name.match(/\b(20\d{2})\b/);
  return {
    engine: "heuristic",
    detectedRequirementId: detected,
    detectedLabel: detected,
    confidence: detected ? 0.45 : 0.1,
    ownerName: null,
    referenceYear: year
      ? Number(year[1]) -
        (detected === "income" && /\b(cu|730|certificazione unica|modello redditi)\b/.test(name)
          ? 1
          : 0)
      : null,
    expiresOn: null,
    legible: false,
    pagesComplete: null,
    findings: [],
  };
}
