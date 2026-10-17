import { eq } from "drizzle-orm";
import { plural, type PluralForms } from "@avanti/core";
import { cases } from "@avanti/db";
import { StartIntakeRequest, type Language } from "@avanti/contracts";
import type { ApiContext, Services } from "../context";
import { hashToken } from "../security";

export async function limitLanguage(c: ApiContext, s: Services): Promise<Language> {
  if (c.get("citizen")) return c.get("citizen").language;
  const token = /^\/api\/c\/([A-Za-z0-9_-]{43})(?:\/|$)/.exec(c.req.path)?.[1];
  if (token) {
    const [row] = await s.db
      .select({ language: cases.language })
      .from(cases)
      .where(eq(cases.tokenHash, hashToken(token)))
      .limit(1);
    return row?.language ?? "it";
  }
  if (c.req.path === "/api/intake") {
    const input = StartIntakeRequest.safeParse(await c.req.json().catch(() => null));
    if (input.success) return input.data.language;
  }
  return "it";
}

// After "tra", "in", "dans", "peste", "через", "بعد": the case each language needs there.
const SECONDS: Record<Language, PluralForms> = {
  it: { one: "un secondo", other: "{n} secondi" },
  en: { one: "{n} second", other: "{n} seconds" },
  fr: { one: "{n} seconde", other: "{n} secondes" },
  es: { one: "un segundo", other: "{n} segundos" },
  ro: { one: "o secundă", few: "{n} secunde", other: "{n} de secunde" },
  uk: { one: "{n} секунду", few: "{n} секунди", many: "{n} секунд", other: "{n} секунди" },
  ar: {
    zero: "{n} ثانية",
    one: "ثانية واحدة",
    two: "ثانيتين",
    few: "{n} ثوانٍ",
    many: "{n} ثانية",
    other: "{n} ثانية",
  },
  bn: { other: "{n} সেকেন্ড" },
};

export function limitMessage(language: Language, seconds: number, uploading = false): string {
  const wait = plural(language, seconds, SECONDS[language]);
  const messages: Record<Language, string> = {
    it: uploading
      ? `Stai caricando troppi file insieme. Attendi che finiscano e riprova tra ${wait}.`
      : `Hai raggiunto il limite di richieste. Riprova tra ${wait}. Se hai bisogno, chiedi aiuto allo sportello.`,
    en: uploading
      ? `Too many files are uploading at once. Wait for them to finish and try again in ${wait}.`
      : `You have reached the request limit. Try again in ${wait}. You can ask the desk for help.`,
    fr: uploading
      ? `Trop de fichiers sont en cours d'envoi. Attendez la fin et réessayez dans ${wait}.`
      : `Vous avez atteint la limite de demandes. Réessayez dans ${wait}. Vous pouvez demander de l'aide au guichet.`,
    es: uploading
      ? `Se están subiendo demasiados archivos a la vez. Espera a que terminen y vuelve a intentarlo en ${wait}.`
      : `Has alcanzado el límite de solicitudes. Vuelve a intentarlo en ${wait}. Puedes pedir ayuda en la ventanilla.`,
    ro: uploading
      ? `Se încarcă prea multe fișiere simultan. Așteaptă să se termine și încearcă din nou peste ${wait}.`
      : `Ai atins limita de cereri. Încearcă din nou peste ${wait}. Poți cere ajutor la ghișeu.`,
    uk: uploading
      ? `Одночасно завантажується забагато файлів. Дочекайтеся завершення та спробуйте знову через ${wait}.`
      : `Ви досягли ліміту запитів. Спробуйте знову через ${wait}. Можна звернутися по допомогу до вікна обслуговування.`,
    ar: uploading
      ? `يجري رفع ملفات كثيرة في الوقت نفسه. انتظر حتى تنتهي وحاول مجددًا بعد ${wait}.`
      : `لقد وصلت إلى الحد الأقصى للطلبات. حاول مجددًا بعد ${wait}. يمكنك طلب المساعدة من شباك الخدمة.`,
    bn: uploading
      ? `একসঙ্গে অনেক ফাইল আপলোড হচ্ছে। শেষ হওয়া পর্যন্ত অপেক্ষা করুন এবং ${wait} পরে আবার চেষ্টা করুন।`
      : `আপনি অনুরোধের সীমায় পৌঁছেছেন। ${wait} পরে আবার চেষ্টা করুন। সেবা কাউন্টারে সাহায্য চাইতে পারেন।`,
  };
  return messages[language];
}
