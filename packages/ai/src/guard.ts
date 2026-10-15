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
export function languageViolation(text: string, language?: Language) {
  if (!language || text.replace(/\s/g, "").length < 12) return false;
  const script = {
    ar: /\p{Script=Arabic}/u,
    bn: /\p{Script=Bengali}/u,
    uk: /\p{Script=Cyrillic}/u,
  };
  if (language in script) return !script[language as keyof typeof script].test(text);
  return /(?!\p{Script=Latin})\p{L}/u.test(text);
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
  if (languageViolation(text, language)) violations.push("language");
  return violations;
}
