import { expect, it } from "vitest";
import { Language, RenewalReminderMember } from "@avanti/contracts";
import {
  minimalRenewalHousehold,
  renewalReminderExpiry,
  RENEWAL_CONSENT_VERSIONS,
  RENEWAL_CONSENT_TEXT_V1,
  renewalConsentEvidence,
} from "./renewal-retention";

it("minimizes household identity without fiscal codes, full birth dates or reusable document IDs", () => {
  expect(
    minimalRenewalHousehold([
      {
        id: "private",
        role: "richiedente",
        firstName: "Nome",
        taxCode: "RSSMRA80A01H501U",
        birthDate: "1980-06-05",
      },
      { id: "other", role: "figlio", firstName: "Figlio" },
    ]),
  ).toEqual([
    { role: "richiedente", firstName: "Nome", birthYear: 1980 },
    { role: "figlio", firstName: "Figlio" },
  ]);
  expect(
    RenewalReminderMember.safeParse({
      role: "richiedente",
      firstName: "Nome",
      taxCode: "RSSMRA80A01H501U",
    }).success,
  ).toBe(false);
});
it.each([2026, 2027, 2028, 2030])(
  "bounds the %s dossier reminder at midnight Rome after the next March",
  (year) => {
    const expiry = new Date(renewalReminderExpiry(year));
    const format = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Rome",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    expect(format.format(expiry)).toBe(`${year + 1}-04-01 00:00`);
    expect(format.format(new Date(expiry.getTime() - 1))).toBe(`${year + 1}-03-31 23:59`);
  },
);
it("defines an immutable consent copy and unambiguous personal-data-free evidence per language", () => {
  expect(new Set(Object.values(RENEWAL_CONSENT_VERSIONS)).size).toBe(8);
  for (const language of Language.options) {
    expect(RENEWAL_CONSENT_VERSIONS[language]).toBe(`isee-renewal-email:${language}:1`);
    expect(RENEWAL_CONSENT_TEXT_V1[language].label.length).toBeGreaterThan(20);
    expect(renewalConsentEvidence(language)).toEqual({
      consentTextVersion: 1,
      consentLanguage: Language.options.indexOf(language),
    });
  }
});
