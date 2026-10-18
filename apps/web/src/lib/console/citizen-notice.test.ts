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

const RLM = "‏";
const LRM = "‎";
/** The text as a reader sees it, without direction marks. */
const plain = (text: string) => text.replace(/[‎‏]/g, "");

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
    status: "rejected",
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
      // Two people's balances share the catalog title: one line with a count.
      item({ genericTitle: "Sold la 31/12/2025", genericTitleIt: "Saldo al 31/12/2025" }),
      item({ genericTitle: "Sold la 31/12/2025", genericTitleIt: "Saldo al 31/12/2025" }),
      item({ status: "missing", genericTitle: "Lipsă", genericTitleIt: "Mancante" }),
      item({ status: "issue", genericTitle: "Problemă", genericTitleIt: "Da controllare" }),
    ],
    request: null,
    ...overrides,
  };
}

describe("noticeText", () => {
  it("names what the desk selected, citizen's language first, without personal details", () => {
    const text = plain(noticeText(handoff(), "request"));
    const [romanian, italian] = text.split("\n\n");
    expect(romanian).toContain("ghișeul îți mai cere");
    expect(romanian).toContain("• Act de identitate");
    expect(romanian).toContain("• Sold la 31/12/2025 ×2");
    expect(italian).toContain("lo sportello ti chiede ancora");
    expect(italian).toContain("• Documento d'identità");
    expect(text).not.toContain("Banca Segreta");
    expect(text).not.toContain("Amina");
    // Not selected: missing items stay in the link, and the automatic checks give way.
    expect(text).not.toContain("Mancante");
    expect(text).not.toContain("Da controllare");
    expect(text).toContain("AV-2027-000042");
  });

  it("names the automatic checks only when the desk selected nothing", () => {
    const text = plain(
      noticeText(
        handoff({ language: "it", items: [item({ status: "issue", genericTitleIt: "Sfocato" })] }),
        "request",
      ),
    );
    expect(text).toContain("• Sfocato");
  });

  it("falls back to a generic request when nothing is listed", () => {
    const text = noticeText(handoff({ language: "it", items: [] }), "request");
    expect(plain(text)).toBe(
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
    const text = plain(noticeText(handoff({ language: "it", items: many }), "request"));
    expect(text.match(/^• Doc/gm)).toHaveLength(MAX_LISTED);
    expect(text).toContain("• e altri 3");
    const one = Array.from({ length: MAX_LISTED + 1 }, (_, i) =>
      item({ genericTitle: `Doc ${i}`, genericTitleIt: `Doc ${i}` }),
    );
    expect(plain(noticeText(handoff({ language: "it", items: one }), "request"))).toContain(
      "• e un altro",
    );
  });

  it("names one document in the singular, and two in the Arabic dual", () => {
    const single = plain(noticeText(handoff({ items: [item()] }), "request"));
    expect(single).toContain("îți mai cere acest document:");
    expect(single).toContain("ti chiede ancora questo documento:");
    const two = [
      item({ genericTitle: "أ", genericTitleIt: "A" }),
      item({ genericTitle: "ب", genericTitleIt: "B" }),
    ];
    const arabic = plain(noticeText(handoff({ language: "ar", items: two }), "request"));
    expect(arabic).toContain("هاتين الوثيقتين:");
    expect(arabic).toContain("ti chiede ancora questi documenti:");
  });

  it("puts a new link once, at the end, after its sentence in both languages", () => {
    const link = "https://avanti.example/pratica/abc";
    const text = noticeText(handoff({ language: "ar" }), "request", link);
    expect(text.split(link)).toHaveLength(2);
    expect(text.endsWith(`\n${link}`)).toBe(true);
    const last = text.split("\n\n").at(-1)!;
    expect(last).toBe(
      [RLM + HANDOFF_MESSAGES.ar.newLink, LRM + HANDOFF_MESSAGES.it.newLink, link].join("\n"),
    );
    expect(text).not.toContain(HANDOFF_MESSAGES.ar.savedLink);
  });

  it("marks every Arabic line right to left and every Italian line left to right", () => {
    const [arabic, italian] = noticeText(handoff({ language: "ar" }), "request").split("\n\n");
    expect(arabic!.split("\n").every((line) => line.startsWith(RLM))).toBe(true);
    expect(italian!.split("\n").every((line) => line.startsWith(LRM))).toBe(true);
  });

  it("tells a ready citizen to book, where, and what to bring", () => {
    const text = plain(noticeText(handoff({ status: "ready" }), "ready"));
    expect(text).toContain("Acum fă-ți programarea la ghișeu");
    expect(text).toContain("Fă-ți programarea aici: https://prenota.example.it/centro");
    expect(text).toContain("Prenota l'appuntamento qui: https://prenota.example.it/centro");
    expect(text).toContain("Sede Centro · Via Roma 1, Milano\nLun-Ven 9-13");
    expect(text).toContain("documento d'identità");
    expect(text).not.toContain("Act de identitate");
  });

  it("leaves booking and hours out when the desk has none", () => {
    const text = plain(
      noticeText(
        handoff({
          language: "it",
          office: { ...handoff().office!, bookingUrl: null, openingHours: null },
        }),
        "ready",
      ),
    );
    expect(text).not.toContain("Prenota l'appuntamento qui");
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
      const italian = HANDOFF_MESSAGES.it[key as keyof typeof m];
      const forms = typeof value === "string" ? [value] : Object.values(value);
      const expected = placeholders(typeof italian === "string" ? italian : italian.other);
      for (const text of forms) {
        expect(text.trim(), `${language}.${key}`).not.toBe("");
        expect(placeholders(text), `${language}.${key}`).toEqual(expected);
      }
    }
  });
});

describe("phone numbers and links", () => {
  it.each([
    ["333 000 0000", "393330000000"],
    ["333000000", "39333000000"],
    ["02 1234 5678", "390212345678"],
    ["+39 333 000 0000", "393330000000"],
    ["0039 333 000 0000", "393330000000"],
    ["+40 712 345 678", "40712345678"],
    ["0040 (712) 345-678", "40712345678"],
    ["40712345678", "40712345678"],
  ])("%s → %s", (input, expected) => {
    expect(whatsappNumber(input)).toBe(expected);
  });

  it.each([null, "", "12345", "+1234567890123456", "333 abc", "3330"])(
    "refuses %s instead of guessing",
    (input) => {
      expect(whatsappNumber(input)).toBeNull();
    },
  );

  it("opens WhatsApp on the text alone when the number is unusable", () => {
    expect(whatsappHref("123", "ciao")).toBe("https://wa.me/?text=ciao");
    expect(whatsappHref("3330000000", "a & b\n#c")).toBe(
      "https://wa.me/393330000000?text=a%20%26%20b%0A%23c",
    );
  });

  it("writes SMS numbers in international form, without spaces", () => {
    expect(smsHref("333 000 0000", "x y")).toBe("sms:+393330000000?&body=x%20y");
    expect(smsHref(null, "x")).toBe("sms:?&body=x");
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

  it("starts a new wait also when the status is set to waiting by hand", () => {
    const timeline = [
      event("case.requested", "2027-01-10T09:00:00.000Z"),
      event("citizen.notice_copied", "2027-01-10T09:01:00.000Z"),
      event("case.in_review", "2027-01-11T09:00:00.000Z"),
      event("case.needs_citizen", "2027-01-12T09:00:00.000Z"),
    ];
    expect(lastNotice(timeline, "request")).toBeNull();
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
