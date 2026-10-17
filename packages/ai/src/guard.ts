import { randomUUID } from "node:crypto";
import type { Language } from "@avanti/contracts";

const controls =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069\p{Surrogate}]/gu;
const fakeTags =
  /<\/?(?:untrusted|system|assistant|developer|context)\b[^>]*>|\[\/?INST\]|<\|[^>]*\|>/gi;
export function manipulationCount(text: string) {
  return (
    text.match(
      /ignore (?:all|previous|your)|ignora (?:le|tutte)|sono l.amministratore|system\s*:|reveal (?:your|the) prompt|<\/?untrusted|developer\s*:|override|تجاهل|ігноруй|উপেক্ষা/gi,
    ) ?? []
  ).length;
}
export function cleanUntrusted(text: string, maxLength: number) {
  return text.replace(controls, "").replace(fakeTags, "").slice(0, maxLength);
}
export function delimit(text: string, kind: string, id = randomUUID(), maxLength = 12000) {
  return `<untrusted id="${id}" kind="${kind}">\n${cleanUntrusted(text, maxLength)}\n</untrusted>`;
}
const contacts =
  /https?:\/\/[^\s<>"'\])}]+|\bwww\.[^\s<>"']+|\b[\w-]+\.(?:it|com|org|net|eu|io|test|invalid)(?:\/[^\s<>"']*)?\b|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b|(?<!\w)\+?\d[\d ().-]{7,}\d(?!\w)/gi;
const secrets =
  /\b(?:spid|otp|password|cvv|cvc|puk|pin)\b|one[- ]time (?:code|password)|mot de passe|contrase[nñ]a|parol[ăa]|(?:carta|card)\s+(?:di credito|number|numero|details)|numero.{0,12}carta|numéro.{0,12}carte|дані картки|номер картки|парол[ьяю]|كلمة المرور|رمز التحقق|رقم البطاقة|পাসওয়ার্ড|পিন|কার্ড নম্বর/iu;
// A conservative script check can prove a mismatch, but cannot prove the language of a short Latin sentence.
const WORD = /[\p{L}\p{M}]+/gu;
const NON_LATIN = /(?!\p{Script=Latin})\p{L}/u;
// The context holds untrusted text too: only a few whole words, a small share of the reply,
// count as quoted names, so a pasted paragraph never exempts a reply in another language.
const MAX_QUOTED_WORDS = 6;
const MAX_QUOTED_SHARE = 0.3;
const letters = (text: string) => text.match(/\p{L}/gu)?.length ?? 0;
function withoutQuotedNames(text: string, context: string) {
  const known = new Set(context.match(WORD));
  const quoted = (word: string) => NON_LATIN.test(word) && known.has(word);
  const words = (text.match(WORD) ?? []).filter(quoted);
  if (
    !words.length ||
    words.length > MAX_QUOTED_WORDS ||
    letters(words.join("")) > letters(text) * MAX_QUOTED_SHARE
  )
    return text;
  return text.replace(WORD, (word) => (quoted(word) ? "" : word));
}
export function languageViolation(text: string, language?: Language, context = "") {
  if (context && language && !["ar", "bn", "uk"].includes(language))
    text = withoutQuotedNames(text, context);
  if (!language || text.replace(/\s/g, "").length < 12) return false;
  const script = {
    ar: /\p{Script=Arabic}/u,
    bn: /\p{Script=Bengali}/u,
    uk: /\p{Script=Cyrillic}/u,
  };
  if (language in script) return !script[language as keyof typeof script].test(text);
  if (/(?!\p{Script=Latin})\p{L}/u.test(text)) return true;
  return latinMismatch(text, language);
}

// Latin-script languages share an alphabet: compare their most frequent short words instead.
// Only a clear majority for another language counts, so Italian document names quoted in a
// French or Spanish reply never trip it.
const FUNCTION_WORDS: Partial<Record<Language, Set<string>>> = {
  it: new Set(
    "il lo gli che per non sono della delle nel con una del è anche questa questo hai tuo tua".split(
      " ",
    ),
  ),
  en: new Set("the and is you your of to are this that with for it be have can".split(" ")),
  fr: new Set("le les des est vous votre pour une dans avec pas que du ce sont".split(" ")),
  es: new Set("el los las es tu tus para una con que por del esta se puedes".split(" ")),
  ro: new Set("și este pentru care sau din cu la să nu ai un o ta tău".split(" ")),
};

function latinMismatch(text: string, language: Language) {
  const expected = FUNCTION_WORDS[language];
  if (!expected) return false;
  const words = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  if (words.length < 8) return false;
  const score = (set: Set<string>) => words.filter((w) => set.has(w)).length;
  const own = score(expected);
  return Object.entries(FUNCTION_WORDS).some(
    ([other, set]) => other !== language && score(set!) >= 4 && score(set!) > own * 2,
  );
}
export function outputViolations(text: string, context: string, language?: Language) {
  const violations: string[] = [];
  const permitted = new Set((context.match(contacts) ?? []).map((s) => s.toLowerCase()));
  if ((text.match(contacts) ?? []).some((s) => !permitted.has(s.toLowerCase())))
    violations.push("contact");
  // Blocking mentions as well as requests deliberately fails closed across languages.
  if (secrets.test(text) || /\b(?:\d[ -]?){13,19}\b/.test(text)) violations.push("credentials");
  if (controls.test(text)) violations.push("controls");
  controls.lastIndex = 0;
  if (languageViolation(text, language, context)) violations.push("language");
  return violations;
}
