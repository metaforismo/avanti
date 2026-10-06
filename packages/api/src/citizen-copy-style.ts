import type { Language } from "@avanti/contracts";

export const citizenCopyStyle: Record<
  Language,
  { address: string; desk: string; application: string; document: string; household: string }
> = {
  it: {
    address: "tu",
    desk: "sportello",
    application: "pratica",
    document: "documento",
    household: "nucleo familiare",
  },
  en: {
    address: "you",
    desk: "desk",
    application: "application",
    document: "document",
    household: "household",
  },
  fr: {
    address: "vous",
    desk: "guichet",
    application: "demande",
    document: "document",
    household: "foyer",
  },
  es: {
    address: "tú",
    desk: "ventanilla",
    application: "trámite",
    document: "documento",
    household: "unidad familiar",
  },
  ro: {
    address: "tu",
    desk: "ghișeu",
    application: "cerere",
    document: "document",
    household: "nucleu familial",
  },
  uk: {
    address: "Ви",
    desk: "вікно обслуговування",
    application: "заява",
    document: "документ",
    household: "сім’я",
  },
  ar: {
    address: "أنت",
    desk: "شباك الخدمة",
    application: "طلب",
    document: "وثيقة",
    household: "الأسرة",
  },
  bn: {
    address: "আপনি",
    desk: "সেবা কাউন্টার",
    application: "আবেদন",
    document: "নথি",
    household: "পরিবার",
  },
};

export function citizenWritingInstructions(language: Language): string {
  const { address, ...vocabulary } = citizenCopyStyle[language];
  return `Address the citizen using ${address}. Use informal singular in Italian, Spanish and Romanian; polite forms in French, Ukrainian and Bengali. Capitalize all Ukrainian courtesy pronouns, including possessives. In Arabic use masculine singular imperatives or neutral sentences. Use short, concrete sentences. Use these terms consistently, inflected as needed: ${JSON.stringify(vocabulary)}. The desk is the CAF or patronato service point; distinguish issuing authorities, family relationships and the case file from the household and application.`;
}
