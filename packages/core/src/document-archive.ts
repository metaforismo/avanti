import type { ChecklistItem, DocumentSummary } from "@avanti/contracts";

/**
 * Which original files go into the operator's ZIP, in which order and under which names. Shared
 * by the API (that writes the archive) and the console (that says what it will contain), so the
 * two never disagree.
 *
 * The archive is what the operator uploads into the CAF's own software, one attachment at a
 * time from a file picker: the order of the dossier (person by person, item by item) and a name
 * that says whose document it is and what it is, sorted by a number in front.
 */
export interface DocumentArchiveEntry {
  documentId: string;
  /** File name inside the ZIP, unique, at most {@link MAX_NAME_BYTES} bytes in UTF-8. */
  name: string;
  sizeBytes: number;
  uploadedAt: string;
  /** False while the operator has not verified the item yet (or the file is unmatched). */
  verified: boolean;
}

export interface DocumentArchivePlan {
  entries: DocumentArchiveEntry[];
  /** Files left out because the desk rejected their item or marked it not needed. */
  excluded: number;
  unverified: number;
  totalBytes: number;
}

type Item = Pick<ChecklistItem, "id" | "title" | "memberName" | "status">;
type Document = Pick<
  DocumentSummary,
  "id" | "fileName" | "mimeType" | "sizeBytes" | "uploadedAt" | "checklistItemId"
>;

/** Most file systems cap a name at 255 bytes; this leaves room for an extracting folder. */
export const MAX_NAME_BYTES = 200;

const EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

const encoder = new TextEncoder();
const bytes = (text: string) => encoder.encode(text).length;

/**
 * A citizen's name or a checklist title made safe as part of a file name on Windows, macOS and
 * Linux: no path separators or reserved characters ("Saldo al 31/12/2025" must not become a
 * folder), no control or bidirectional override characters, cut on a character boundary.
 */
export function fileNamePart(text: string, maxBytes: number): string {
  const cleaned = text
    .normalize("NFC")
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    // «Redditi 2025: CU» reads as «Redditi 2025 - CU», not «Redditi 2025- CU».
    .replace(/\s*:\s*/g, " - ")
    .replace(/[/\\*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  let out = "";
  for (const character of cleaned) {
    if (bytes(out + character) > maxBytes) break;
    out += character;
  }
  // Windows drops trailing dots and spaces, which would make two names collide.
  return out.replace(/[. ]+$/, "");
}

function extension(document: Document) {
  const known = EXTENSIONS[document.mimeType];
  if (known) return known;
  const fromName = /\.([A-Za-z0-9]{1,8})$/.exec(document.fileName)?.[1];
  return fromName ? fromName.toLowerCase() : "bin";
}

function baseName(fileName: string) {
  return fileName.replace(/\.[A-Za-z0-9]{1,8}$/, "") || "documento";
}

export function documentArchivePlan(
  checklist: readonly Item[],
  documents: readonly Document[],
): DocumentArchivePlan {
  const items = new Map(checklist.map((item) => [item.id, item]));
  const groups: { item: Item | null; documents: Document[] }[] = [];
  let excluded = 0;
  for (const item of checklist) {
    const attached = documents.filter((document) => document.checklistItemId === item.id);
    if (!attached.length) continue;
    // A rejected file is the wrong one and a waived item is not part of the practice: neither
    // belongs in the CAF's archive.
    if (item.status === "rejected" || item.status === "waived") {
      excluded += attached.length;
      continue;
    }
    groups.push({ item, documents: attached });
  }
  const unmatched = documents.filter(
    (document) => !document.checklistItemId || !items.has(document.checklistItemId),
  );
  for (const document of unmatched) groups.push({ item: null, documents: [document] });

  const total = groups.reduce((sum, group) => sum + group.documents.length, 0);
  const digits = Math.max(2, String(total).length);
  const entries: DocumentArchiveEntry[] = [];
  for (const { item, documents: attached } of groups) {
    attached.forEach((document, index) => {
      const number = String(entries.length + 1).padStart(digits, "0");
      const who = item
        ? fileNamePart(item.memberName ?? "Nucleo familiare", 60)
        : "Altri documenti";
      const what = item
        ? fileNamePart(item.title, 110)
        : fileNamePart(baseName(document.fileName), 110) || "documento";
      const part = attached.length > 1 ? ` (${index + 1} di ${attached.length})` : "";
      const ext = `.${extension(document)}`;
      const head = `${number} ${who || "Senza nome"} - `;
      // The cut falls on the description, never on the number that keeps the names unique.
      const room = MAX_NAME_BYTES - bytes(head) - bytes(part) - bytes(ext);
      entries.push({
        documentId: document.id,
        name: `${head}${fileNamePart(what, room) || "documento"}${part}${ext}`,
        sizeBytes: document.sizeBytes,
        uploadedAt: document.uploadedAt,
        verified: item?.status === "verified",
      });
    });
  }
  return {
    entries,
    excluded,
    unverified: entries.filter((entry) => !entry.verified).length,
    totalBytes: entries.reduce((sum, entry) => sum + entry.sizeBytes, 0),
  };
}

/** «Rossi Mario - AV-2027-000123 - documenti.zip»: the surname first, as the CAF files it. */
export function documentArchiveName(
  reference: string,
  citizen: { firstName: string | null; lastName: string | null },
): string {
  const person = fileNamePart([citizen.lastName, citizen.firstName].filter(Boolean).join(" "), 80);
  const code = fileNamePart(reference, 40);
  return `${person ? `${person} - ` : ""}${code} - documenti.zip`;
}
