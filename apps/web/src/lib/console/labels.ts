import type {
  CaseStatus,
  ChecklistStatus,
  Language,
  PracticeId,
  Severity,
} from "@avanti/contracts";
import { MISSING } from "@/components/ui/missing";

export const CASE_STATUS: Record<CaseStatus, { label: string; tone: Tone; hint: string }> = {
  submitted: {
    label: "Da revisionare",
    tone: "stamp",
    hint: "Inviate dal cittadino, nessuno le ha ancora aperte",
  },
  in_review: { label: "In revisione", tone: "neutral", hint: "Aperte da un operatore" },
  needs_citizen: {
    label: "Attesa cittadino",
    tone: "warn",
    hint: "Integrazioni richieste al cittadino",
  },
  ready: { label: "Pronte", tone: "ok", hint: "Verificate, da inserire nel gestionale" },
  intake: { label: "In compilazione", tone: "muted", hint: "Il cittadino non ha ancora inviato" },
  closed: { label: "Chiuse", tone: "muted", hint: "Archiviate" },
};

/** Queue order: what needs an operator first. */
export const STATUS_ORDER: CaseStatus[] = [
  "submitted",
  "in_review",
  "needs_citizen",
  "ready",
  "intake",
  "closed",
];

export const CHECKLIST_STATUS: Record<ChecklistStatus, { label: string; tone: Tone }> = {
  missing: { label: "Mancante", tone: MISSING.operator.tone },
  uploaded: { label: "Da verificare", tone: "stamp" },
  issue: { label: "Con problemi", tone: "warn" },
  verified: { label: "Verificato", tone: "ok" },
  rejected: { label: "Rifiutato", tone: "danger" },
  waived: { label: "Non necessario", tone: "muted" },
};

/**
 * «Saldo e dati del rapporto · Maria»: the item and whose it is. An account item's title already
 * ends with the bank's name, and when that name is the person's (demo data, a self-named
 * account) the suffix would say it twice.
 */
export function withMember(item: { title: string; memberName: string | null }, separator = " · ") {
  const name = memberSuffix(item);
  return name ? `${item.title}${separator}${name}` : item.title;
}

/** The person to name after an item's title, or null when the title already ends with it. */
export function memberSuffix(item: { title: string; memberName: string | null }) {
  const name = item.memberName?.trim();
  if (!name) return null;
  const fold = (value: string) => value.toLocaleLowerCase("it").replace(/\s+/g, " ").trim();
  const title = fold(item.title);
  return title.endsWith(`· ${fold(name)}`) || title === fold(name) ? null : name;
}

/** Items the operator has already decided on: nothing left to check there. */
export const DECIDED: ReadonlySet<ChecklistStatus> = new Set(["verified", "rejected", "waived"]);

/** «Nome Cognome», or null when the citizen gave neither. */
export function fullName(person: { firstName?: string | null; lastName?: string | null }) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ") || null;
}

export const SEVERITY: Record<Severity, { label: string; tone: Tone }> = {
  blocker: { label: "Bloccante", tone: "danger" },
  warning: { label: "Avviso", tone: "warn" },
  info: { label: "Nota", tone: "neutral" },
  ok: { label: "OK", tone: "ok" },
};

export const PRACTICE_SHORT: Record<PracticeId, string> = {
  isee_ordinario: "ISEE ordinario",
  isee_universitario: "ISEE università",
  modello_730: "730",
  red: "RED",
  assegno_unico: "Assegno unico",
  successione_semplice: "Successione",
  permesso_soggiorno: "Permesso di soggiorno",
  cittadinanza: "Cittadinanza",
  naspi: "NASpI",
};

export const LANGUAGE_IT: Record<Language, string> = {
  it: "Italiano",
  en: "Inglese",
  fr: "Francese",
  es: "Spagnolo",
  ro: "Rumeno",
  uk: "Ucraino",
  ar: "Arabo",
  bn: "Bengalese",
};

export type Tone = "stamp" | "ok" | "warn" | "danger" | "neutral" | "muted";

export const TONE_CLASSES: Record<Tone, string> = {
  stamp: "bg-stamp-wash text-stamp",
  ok: "bg-ok-wash text-ok",
  warn: "bg-warn-wash text-warn",
  danger: "bg-danger-wash text-danger",
  neutral: "bg-sunk text-ink-2",
  muted: "bg-sunk text-ink-3",
};

const relative = new Intl.RelativeTimeFormat("it", { numeric: "auto" });
// The CAF works on Italian time, whatever the operator's computer is set to.
const dateTime = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Rome",
});
const dateOnly = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Rome",
});

/** "3 min fa", "ieri", or a date when older than a week. */
export function timeAgo(iso: string, now = Date.now()) {
  const diff = (new Date(iso).getTime() - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return "adesso";
  if (abs < 3600) return relative.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return relative.format(Math.round(diff / 3600), "hour");
  if (abs < 7 * 86400) return relative.format(Math.round(diff / 86400), "day");
  return dateOnly.format(new Date(iso));
}

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));

export function formatMinutes(minutes: number | null) {
  if (minutes === null || !Number.isFinite(minutes)) return "—";
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

const megabytes = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 });
/** "840 kB", "12,4 MB": the size of a download, rounded as a file manager shows it. */
export function formatBytes(bytes: number) {
  if (bytes < 1000) return `${bytes} byte`;
  if (bytes < 999_500) return `${Math.round(bytes / 1000)} kB`;
  return `${megabytes.format(bytes / 1_000_000)} MB`;
}
