import { Language, RenewalReminderMember, type Member } from "@avanti/contracts";

// Version 1 identifies the checkbox + hint in citizen/messages{,-extra}.ts at
// 2026-10-16. Changing either localized text requires a new immutable identifier.
export const RENEWAL_CONSENT_VERSIONS: Record<Language, string> = {
  it: "isee-renewal-email:it:1",
  en: "isee-renewal-email:en:1",
  fr: "isee-renewal-email:fr:1",
  es: "isee-renewal-email:es:1",
  ro: "isee-renewal-email:ro:1",
  uk: "isee-renewal-email:uk:1",
  ar: "isee-renewal-email:ar:1",
  bn: "isee-renewal-email:bn:1",
};
// Immutable copy snapshot associated with the identifiers above; never stored in the DB.
export const RENEWAL_CONSENT_TEXT_V1 = {
  it: {
    label: "Avvisami via email quando sarà il momento di rinnovare l'ISEE",
    hint: "Una volta l'anno, dal CAF. Puoi cambiare idea quando vuoi.",
  },
  en: {
    label: "Email me when it's time to renew the ISEE",
    hint: "Once a year, from the CAF. You can change your mind at any time.",
  },
  fr: {
    label: "Prévenez-moi par e-mail quand il faudra renouveler l'ISEE",
    hint: "Une fois par an, de la part du CAF. Vous pouvez changer d'avis à tout moment.",
  },
  es: {
    label: "Avísame por correo cuando toque renovar el ISEE",
    hint: "Una vez al año, desde el CAF. Puedes cambiar de idea cuando quieras.",
  },
  ro: {
    label: "Anunță-mă pe e-mail când trebuie reînnoit ISEE",
    hint: "O dată pe an, de la CAF. Te poți răzgândi oricând.",
  },
  uk: {
    label: "Повідомте мене електронною поштою, коли треба буде оновити ISEE",
    hint: "Раз на рік, від CAF. Ви можете передумати будь-коли.",
  },
  ar: {
    label: "أخبرني بالبريد الإلكتروني عندما يحين وقت تجديد الـ ISEE",
    hint: "مرة في السنة، من الـ CAF. يمكنك تغيير رأيك في أي وقت.",
  },
  bn: {
    label: "ISEE নবায়নের সময় হলে আমাকে ইমেইলে জানান",
    hint: "বছরে একবার, CAF থেকে। আপনি যেকোনো সময় মত বদলাতে পারেন।",
  },
} as const;
export function renewalConsentEvidence(language: Language) {
  return { consentTextVersion: 1, consentLanguage: Language.options.indexOf(language) };
}

export function minimalRenewalHousehold(members: Member[]) {
  return members.map((m) =>
    RenewalReminderMember.parse({
      role: m.role,
      firstName: m.firstName,
      ...(m.lastName ? { lastName: m.lastName } : {}),
      ...(m.birthYear || m.birthDate
        ? { birthYear: m.birthYear ?? Number(m.birthDate!.slice(0, 4)) }
        : {}),
    }),
  );
}

/** End of 31 March of the renewal campaign (source year + 1), Europe/Rome. */
export function renewalReminderExpiry(practiceYear: number) {
  // April starts in CEST for the supported practice years.
  return new Date(Date.UTC(practiceYear + 1, 2, 31, 22)).toISOString();
}
