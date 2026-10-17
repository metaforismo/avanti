import type {
  CaseStatus,
  CitizenHandoff,
  CitizenHandoffChannel,
  CitizenHandoffItem,
  Language,
  TimelineEvent,
} from "@avanti/contracts";
import { directionOf } from "@/lib/citizen/document-language";
import { HANDOFF_MESSAGES } from "@/lib/citizen/handoff-messages";
import { format, messagesFor } from "@/lib/citizen/messages";

export type NoticeKind = "request" | "ready";

/** Only two moments need the citizen to act: something is asked, or the file is ready. */
export function noticeKind(status: CaseStatus): NoticeKind | null {
  return status === "needs_citizen" ? "request" : status === "ready" ? "ready" : null;
}

/**
 * Longest list named in a message to the citizen, here and in the integration request: read on
 * a phone a longer one hides the end, and the request has a 1000-character limit. Past it the
 * message points to the list the citizen already sees in the link.
 */
export const MAX_LISTED = 6;

/**
 * What the email names too: the items the operator selected (the request marks them rejected);
 * the automatic checks only when nothing was selected. Two people needing the same document
 * read as one title with a count, so the catalog title stays free of their names.
 */
function requestedTitles(items: CitizenHandoffItem[], language: Language) {
  const selected = items.filter((item) => item.status === "rejected");
  const named = selected.length ? selected : items.filter((item) => item.status === "issue");
  const counts = new Map<string, number>();
  for (const item of named) {
    const title = language === "it" ? item.genericTitleIt : item.genericTitle;
    counts.set(title, (counts.get(title) ?? 0) + 1);
  }
  return [...counts].map(([title, n]) => (n > 1 ? `${title} ×${n}` : title));
}

/**
 * WhatsApp and SMS apps pick each line's direction from its first strong letter: a mark of the
 * block's own direction keeps an Arabic line that opens with the CAF's Latin name right to left.
 */
const mark = (language: Language) => (directionOf(language) === "rtl" ? "‏" : "‎");

function block(handoff: CitizenHandoff, kind: NoticeKind, language: Language, withLink: boolean) {
  const m = HANDOFF_MESSAGES[language];
  const vars = { org: handoff.organization.name, ref: handoff.reference };
  const lines: string[] = [];
  if (kind === "request") {
    const titles = requestedTitles(handoff.items, language);
    if (titles.length === 0) lines.push(format(m.requestGeneric, vars));
    else {
      lines.push(format(m.requestIntro, vars));
      lines.push(...titles.slice(0, MAX_LISTED).map((title) => `• ${title}`));
      if (titles.length > MAX_LISTED) lines.push("• …");
    }
    if (!withLink) lines.push(m.savedLink);
  } else {
    lines.push(format(m.readyIntro, vars));
    if (handoff.office?.bookingUrl) lines.push(`${m.book} ${handoff.office.bookingUrl}`);
    lines.push(messagesFor(language).done.bring);
    if (!withLink) lines.push(m.readySavedLink);
  }
  return lines.map((line) => mark(language) + line).join("\n");
}

/**
 * The citizen's language first, so the preview on their lock screen is one they can read, then
 * the Italian for whoever helps them. Catalog titles only: the message leaves through a
 * third-party app and must not carry banks or names taken from the citizen's answers. A new
 * link appears once, at the end, after the sentence that introduces it in both languages.
 */
export function noticeText(handoff: CitizenHandoff, kind: NoticeKind, link?: string) {
  const languages: Language[] = handoff.language === "it" ? ["it"] : [handoff.language, "it"];
  const blocks = languages.map((language) => block(handoff, kind, language, Boolean(link)));
  const office = handoff.office;
  if (kind === "ready" && office) {
    blocks.push(
      [
        `${office.name} · ${[office.address, office.city].filter(Boolean).join(", ")}`,
        office.openingHours,
      ]
        .filter(Boolean)
        .map((line) => mark("it") + line)
        .join("\n"),
    );
  }
  if (link) {
    const key = kind === "request" ? "newLink" : "readyNewLink";
    blocks.push(
      [...languages.map((language) => mark(language) + HANDOFF_MESSAGES[language][key]), link].join(
        "\n",
      ),
    );
  }
  return blocks.join("\n\n");
}

/**
 * International form without "+", or null when the number cannot be one. Italian numbers are
 * often typed without the country code: mobiles start with 3, landlines with 0.
 */
export function whatsappNumber(phone?: string | null): string | null {
  let digits = phone?.trim().replace(/[\s().\-/]/g, "") ?? "";
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  else if (/^3\d{8,9}$/.test(digits) || /^0\d{5,10}$/.test(digits)) digits = `39${digits}`;
  return /^\d{8,15}$/.test(digits) ? digits : null;
}

/** Without a usable number WhatsApp opens on the text and the operator picks the chat. */
export const whatsappHref = (phone: string | null | undefined, text: string) => {
  const number = whatsappNumber(phone);
  return `https://wa.me/${number ?? ""}?text=${encodeURIComponent(text)}`;
};

export const smsHref = (phone: string | null | undefined, text: string) => {
  const number = whatsappNumber(phone);
  return `sms:${number ? `+${number}` : ""}?&body=${encodeURIComponent(text)}`;
};

const NOTICE_CHANNELS: Record<string, Exclude<CitizenHandoffChannel, "print">> = {
  "citizen.notice_whatsapp": "whatsapp",
  "citizen.notice_sms": "sms",
  "citizen.notice_copied": "copy",
};

/** Events that open a new wait for the citizen: the request route or a status change. */
const STARTS: Record<NoticeKind, ReadonlySet<string>> = {
  request: new Set(["case.requested", "case.needs_citizen"]),
  ready: new Set(["case.ready"]),
};

/**
 * The latest notice prepared since the case entered its current state: a colleague opening the
 * file sees the citizen was already told and does not message them twice.
 */
export function lastNotice(timeline: TimelineEvent[], kind: NoticeKind) {
  let since = "";
  let found: {
    channel: Exclude<CitizenHandoffChannel, "print">;
    at: string;
    by: string | null;
  } | null = null;
  for (const event of timeline) {
    if (STARTS[kind].has(event.type) && event.at >= since) {
      since = event.at;
      found = null;
    }
    const channel = NOTICE_CHANNELS[event.type];
    if (channel && since && event.at >= since && (!found || event.at >= found.at))
      found = { channel, at: event.at, by: event.actorName };
  }
  return found;
}
