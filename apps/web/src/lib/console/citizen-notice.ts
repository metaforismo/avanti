import type {
  CaseStatus,
  CitizenHandoff,
  CitizenHandoffChannel,
  Language,
  TimelineEvent,
} from "@avanti/contracts";
import { HANDOFF_MESSAGES } from "@/lib/citizen/handoff-messages";
import { format, messagesFor } from "@/lib/citizen/messages";

export type NoticeKind = "request" | "ready";

/** Only two moments need the citizen to act: something is asked, or the file is ready. */
export function noticeKind(status: CaseStatus): NoticeKind | null {
  return status === "needs_citizen" ? "request" : status === "ready" ? "ready" : null;
}

// A WhatsApp message is read on a lock screen: past this the list points to the link instead.
export const MAX_LISTED = 8;

/** What the request names: everything required, plus anything the desk asked to redo. */
function requestedTitles(handoff: CitizenHandoff, language: Language) {
  const titles = handoff.items
    .filter((item) => item.required || item.status !== "missing")
    .map((item) => (language === "it" ? item.genericTitleIt : item.genericTitle));
  return [...new Set(titles)];
}

function block(handoff: CitizenHandoff, kind: NoticeKind, language: Language, link?: string) {
  const m = HANDOFF_MESSAGES[language];
  const vars = { org: handoff.organization.name, ref: handoff.reference };
  const lines: string[] = [];
  if (kind === "request") {
    const titles = requestedTitles(handoff, language);
    if (titles.length === 0) lines.push(format(m.requestGeneric, vars));
    else {
      lines.push(format(m.requestIntro, vars));
      lines.push(...titles.slice(0, MAX_LISTED).map((title) => `• ${title}`));
      if (titles.length > MAX_LISTED) lines.push("• …");
    }
    lines.push(link ? m.newLink : m.savedLink);
  } else {
    lines.push(format(m.readyIntro, vars));
    if (handoff.office?.bookingUrl) lines.push(`${m.book} ${handoff.office.bookingUrl}`);
    lines.push(messagesFor(language).done.bring);
    lines.push(link ? m.readyNewLink : m.readySavedLink);
  }
  if (link) lines.push(link);
  return lines.join("\n");
}

/**
 * The citizen's language first, so the preview on their lock screen is one they can read, then
 * the Italian for whoever helps them. Catalog titles only: the message leaves through a
 * third-party app and must not carry banks or names taken from the citizen's answers.
 */
export function noticeText(handoff: CitizenHandoff, kind: NoticeKind, link?: string) {
  const languages: Language[] = handoff.language === "it" ? ["it"] : [handoff.language, "it"];
  const blocks = languages.map((language) => block(handoff, kind, language, link));
  const office = handoff.office;
  if (kind === "ready" && office) {
    blocks.push(
      [
        `${office.name} · ${[office.address, office.city].filter(Boolean).join(", ")}`,
        office.openingHours,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  return blocks.join("\n\n");
}

/** Italian mobile numbers are often typed without the country code. */
export function whatsappNumber(phone?: string | null) {
  const digits = phone?.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (!digits) return "";
  return digits.length === 10 && digits.startsWith("3") ? `39${digits}` : digits;
}

export const whatsappHref = (phone: string | null | undefined, text: string) =>
  `https://wa.me/${whatsappNumber(phone)}?text=${encodeURIComponent(text)}`;

export const smsHref = (phone: string | null | undefined, text: string) =>
  `sms:${phone?.replace(/\s+/g, "") ?? ""}?&body=${encodeURIComponent(text)}`;

const NOTICE_CHANNELS: Record<string, Exclude<CitizenHandoffChannel, "print">> = {
  "citizen.notice_whatsapp": "whatsapp",
  "citizen.notice_sms": "sms",
  "citizen.notice_copied": "copy",
};

/**
 * The latest notice prepared since the case entered its current state: a colleague opening the
 * file sees the citizen was already told and does not message them twice.
 */
export function lastNotice(timeline: TimelineEvent[], kind: NoticeKind) {
  const startType = kind === "request" ? "case.requested" : "case.ready";
  let since = "";
  let found: {
    channel: Exclude<CitizenHandoffChannel, "print">;
    at: string;
    by: string | null;
  } | null = null;
  for (const event of timeline) {
    if (event.type === startType && event.at >= since) {
      since = event.at;
      found = null;
    }
    const channel = NOTICE_CHANNELS[event.type];
    if (channel && since && event.at >= since && (!found || event.at >= found.at))
      found = { channel, at: event.at, by: event.actorName };
  }
  return found;
}
