import { describe, expect, it } from "vitest";
import { LANGUAGES } from "@avanti/contracts/constants";
import type { CitizenHandoff, CitizenHandoffItem, TimelineEvent } from "@avanti/contracts";
import { HANDOFF_MESSAGES } from "@/lib/citizen/handoff-messages";
import {
  lastNotice,
  MAX_LISTED,
  noticeKind,
  noticeText,
  smsHref,
  whatsappHref,
  whatsappNumber,
} from "./citizen-notice";

function item(overrides: Partial<CitizenHandoffItem> = {}): CitizenHandoffItem {
  return {
    id: crypto.randomUUID(),
    title: "Saldo Banca Segreta · Amina",
    titleIt: "Saldo Banca Segreta · Amina",
    genericTitle: "Saldo al 31/12/2025",
    genericTitleIt: "Saldo al 31/12/2025",
    howToGet: null,
    memberName: "Amina",
    required: true,
    status: "missing",
    note: null,
    ...overrides,
  };
}

function handoff(overrides: Partial<CitizenHandoff> = {}): CitizenHandoff {
  return {
    reference: "AV-2027-000042",
    language: "ro",
    status: "needs_citizen",
    organization: { id: "o", name: "CAF Esempio", kind: "caf" },
    office: {
      id: "s",
      slug: "centro",
      name: "Sede Centro",
      address: "Via Roma 1",
      city: "Milano",
      phone: null,
      openingHours: "Lun-Ven 9-13",
      bookingUrl: "https://prenota.example.it/centro",
    },
    practice: { name: "ISEE ordinar", nameIt: "ISEE ordinario" },
    interviewComplete: true,
    items: [
      item({ genericTitle: "Act de identitate", genericTitleIt: "Documento d'identità" }),
      // Two accounts share the catalog title: the message names it once.
      item({ genericTitle: "Sold la 31/12/2025", genericTitleIt: "Saldo al 31/12/2025" }),
      item({ genericTitle: "Sold la 31/12/2025", genericTitleIt: "Saldo al 31/12/2025" }),
      item({ required: false, genericTitle: "Opțional", genericTitleIt: "Facoltativo" }),
    ],
    ...overrides,
  };
}

describe("noticeText", () => {
  it("writes the citizen's language first, then Italian, without personal details", () => {
    const text = noticeText(handoff(), "request");
    const [romanian, italian] = text.split("\n\n");
    expect(romanian).toContain("ghișeul îți mai cere");
    expect(romanian).toContain("• Act de identitate");
    expect(romanian!.match(/Sold la/g)).toHaveLength(1);
    expect(italian).toContain("lo sportello ti chiede ancora");
    expect(italian).toContain("• Documento d'identità");
    expect(text).not.toContain("Banca Segreta");
    expect(text).not.toContain("Amina");
    // Optional documents not asked for stay in the link, not in the message.
    expect(text).not.toContain("Facoltativo");
    expect(text).toContain("AV-2027-000042");
  });

  it("names an optional document the desk asked to redo", () => {
    const text = noticeText(
      handoff({ items: [item({ required: false, status: "rejected", genericTitleIt: "Rifare" })] }),
      "request",
    );
    expect(text).toContain("• Rifare");
  });

  it("falls back to a generic request when nothing is listed", () => {
    const text = noticeText(handoff({ language: "it", items: [] }), "request");
    expect(text).toBe(
      [
        "CAF Esempio: per la pratica AV-2027-000042 lo sportello ti chiede un'integrazione.",
        HANDOFF_MESSAGES.it.savedLink,
      ].join("\n"),
    );
  });

  it("cuts long lists and points to the link", () => {
    const many = Array.from({ length: MAX_LISTED + 3 }, (_, i) =>
      item({ genericTitle: `Doc ${i}`, genericTitleIt: `Doc ${i}` }),
    );
    const text = noticeText(handoff({ language: "it", items: many }), "request");
    expect(text.match(/^• Doc/gm)).toHaveLength(MAX_LISTED);
    expect(text).toContain("• …");
  });

  it("puts a new link in every language block", () => {
    const link = "https://avanti.example/pratica/abc";
    const text = noticeText(handoff({ language: "ar" }), "request", link);
    expect(text.split(link)).toHaveLength(3);
    expect(text).toContain(HANDOFF_MESSAGES.ar.newLink);
    expect(text).not.toContain(HANDOFF_MESSAGES.ar.savedLink);
    // Arabic opens with Arabic words, so WhatsApp lays the paragraph out right to left.
    expect(text.split("\n")[0]).toMatch(/^[؀-ۿ]/);
  });

  it("tells a ready citizen where to book, what to bring and where the desk is", () => {
    const text = noticeText(handoff({ status: "ready" }), "ready");
    expect(text).toContain("Fă-ți programarea aici: https://prenota.example.it/centro");
    expect(text).toContain("Prenota l'appuntamento qui: https://prenota.example.it/centro");
    expect(text).toContain("Sede Centro · Via Roma 1, Milano\nLun-Ven 9-13");
    expect(text).toContain("documento d'identità");
    expect(text).not.toContain("Act de identitate");
  });

  it("leaves booking and hours out when the desk has none", () => {
    const text = noticeText(
      handoff({
        language: "it",
        office: { ...handoff().office!, bookingUrl: null, openingHours: null },
      }),
      "ready",
    );
    expect(text).not.toContain("Prenota");
    expect(text.endsWith("Sede Centro · Via Roma 1, Milano")).toBe(true);
  });
});

describe("handoff messages", () => {
  const keys = Object.keys(HANDOFF_MESSAGES.it).sort();
  const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  it.each(LANGUAGES)("%s has every key, filled, with the same placeholders", (language) => {
    const m = HANDOFF_MESSAGES[language];
    expect(Object.keys(m).sort()).toEqual(keys);
    for (const key of keys) {
      const value = m[key as keyof typeof m];
      expect(value.trim(), `${language}.${key}`).not.toBe("");
      expect(placeholders(value), `${language}.${key}`).toEqual(
        placeholders(HANDOFF_MESSAGES.it[key as keyof typeof m]),
      );
    }
  });
});

describe("links", () => {
  it("adds the Italian prefix only to Italian mobile numbers", () => {
    expect(whatsappNumber("333 000 0000")).toBe("393330000000");
    expect(whatsappNumber("+40 712 345 678")).toBe("40712345678");
    expect(whatsappNumber(null)).toBe("");
  });

  it("encodes the whole message, newlines and all", () => {
    const href = whatsappHref("3330000000", "a & b\n#c");
    expect(href).toBe("https://wa.me/393330000000?text=a%20%26%20b%0A%23c");
    expect(smsHref("333 000 0000", "x y")).toBe("sms:3330000000?&body=x%20y");
  });
});

describe("noticeKind and lastNotice", () => {
  const event = (type: string, at: string, actorName: string | null = "Giulia"): TimelineEvent => ({
    id: `${type}-${at}`,
    at,
    actor: "operator",
    actorName,
    type,
    label: type,
  });

  it("asks only while the citizen has something to do or the file is ready", () => {
    expect(noticeKind("needs_citizen")).toBe("request");
    expect(noticeKind("ready")).toBe("ready");
    expect(noticeKind("in_review")).toBeNull();
    expect(noticeKind("intake")).toBeNull();
  });

  it("finds the latest notice after the current request only", () => {
    const timeline = [
      event("case.requested", "2027-01-10T09:00:00.000Z"),
      event("citizen.notice_whatsapp", "2027-01-10T09:01:00.000Z"),
      event("case.requested", "2027-01-12T09:00:00.000Z"),
    ];
    expect(lastNotice(timeline, "request")).toBeNull();
    const told = [...timeline, event("citizen.notice_sms", "2027-01-12T09:05:00.000Z", "Marco")];
    expect(lastNotice(told, "request")).toEqual({
      channel: "sms",
      at: "2027-01-12T09:05:00.000Z",
      by: "Marco",
    });
  });

  it("does not count a printout or a notice from before the file was ready", () => {
    const timeline = [
      event("citizen.notice_copied", "2027-01-10T09:00:00.000Z"),
      event("case.ready", "2027-01-11T09:00:00.000Z"),
      event("citizen.checklist_printed", "2027-01-11T09:05:00.000Z"),
    ];
    expect(lastNotice(timeline, "ready")).toBeNull();
    expect(lastNotice(timeline, "request")).toBeNull();
  });
});
