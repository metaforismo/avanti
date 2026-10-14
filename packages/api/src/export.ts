import { readFile } from "node:fs/promises";
import { join } from "node:path";
// Fontkit's Indic shaping state machine requires the generator runtime in Node.
import "regenerator-runtime/runtime.js";
import type { CaseDossier, ChecklistStatus } from "@avanti/contracts";
import { repoRoot } from "@avanti/db";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PageSizes, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";

type FontFamily = "latin" | "arabic" | "bengali";
type Fonts = Partial<Record<FontFamily, PDFFont>> & { latin: PDFFont };
const fontFiles: Record<FontFamily, string> = {
  latin: "NotoSans.ttf",
  arabic: "NotoSansArabic.ttf",
  bengali: "NotoSansBengali.ttf",
};
const fontBytes = new Map<FontFamily, Promise<Buffer>>();
const textColor = rgb(0.13, 0.16, 0.2);
const mutedColor = rgb(0.35, 0.4, 0.45);
const headingColor = rgb(0.12, 0.26, 0.36);
const margin = 46;
const statusLabels: Record<ChecklistStatus, string> = {
  missing: "Manca",
  uploaded: "Caricato",
  issue: "Da controllare",
  verified: "Verificato",
  rejected: "Rifiutato",
  waived: "Non richiesto",
};

function strongFamily(character: string): FontFamily | null {
  if (/\p{Script=Arabic}/u.test(character)) return "arabic";
  if (/\p{Script=Bengali}/u.test(character)) return "bengali";
  if (/[\p{Letter}\p{Number}]/u.test(character)) return "latin";
  return null;
}

function runs(text: string, fonts: Fonts): Array<{ text: string; font: PDFFont }> {
  const characters = [...text];
  const following: FontFamily[] = [];
  let nextFamily: FontFamily = "latin";
  for (let index = characters.length - 1; index >= 0; index--) {
    following[index] = nextFamily;
    nextFamily = strongFamily(characters[index]!) ?? nextFamily;
  }
  const output: Array<{ text: string; font: PDFFont }> = [];
  let previous: FontFamily = "latin";
  for (const [index, character] of characters.entries()) {
    const strong = strongFamily(character);
    // Keep spaces inside an Arabic name for shaping, but put mixed-script separators in the Latin run.
    const inherited = /\p{Mark}/u.test(character) || previous === following[index];
    const key = strong ?? (inherited ? previous : "latin");
    if (strong) previous = strong;
    const font = fonts[key] ?? fonts.latin;
    const last = output.at(-1);
    if (last?.font === font) last.text += character;
    else output.push({ text: character, font });
  }
  return output;
}

const characterSets = new WeakMap<PDFFont, Set<number>>();
function printableText(text: string, fonts: Fonts): string {
  return runs(text, fonts)
    .map((run) => {
      let supported = characterSets.get(run.font);
      if (!supported) {
        supported = new Set(run.font.getCharacterSet());
        characterSets.set(run.font, supported);
      }
      return [...run.text]
        .map((character) => {
          if (character === "\n" || character === "\t") return character;
          const point = character.codePointAt(0)!;
          return supported.has(point) ? character : `[U+${point.toString(16).toUpperCase()}]`;
        })
        .join("");
    })
    .join("");
}

export async function loadFonts(pdf: PDFDocument, content: string): Promise<Fonts> {
  pdf.registerFontkit(fontkit);
  const fonts: Partial<Record<FontFamily, PDFFont>> = {};
  const families: FontFamily[] = ["latin"];
  if (/\p{Script=Arabic}/u.test(content)) families.push("arabic");
  if (/\p{Script=Bengali}/u.test(content)) families.push("bengali");
  for (const key of families) {
    let bytes = fontBytes.get(key);
    if (!bytes) {
      bytes = readFile(join(repoRoot, "packages/api/assets/fonts", fontFiles[key]));
      fontBytes.set(key, bytes);
      bytes.catch(() => fontBytes.delete(key));
    }
    fonts[key] = await pdf.embedFont(await bytes, { subset: true });
  }
  if (!fonts.latin) throw new Error("PDF font unavailable");
  return { ...fonts, latin: fonts.latin };
}

export class UnicodePrinter {
  private page: PDFPage;
  private y = 0;
  private readonly width = PageSizes.A4[0] - margin * 2;
  private readonly graphemes = new Intl.Segmenter("it", { granularity: "grapheme" });
  private readonly widths = new Map<string, number>();

  constructor(
    private readonly pdf: PDFDocument,
    private readonly fonts: Fonts,
    private readonly document: { header: string; subtitle: string; footer: string },
  ) {
    this.page = this.addPage();
  }

  private measure(text: string, size: number): number {
    const key = `${size}:${text}`;
    const cached = this.widths.get(key);
    if (cached !== undefined) return cached;
    const width = runs(text, this.fonts).reduce(
      (total, run) => total + run.font.widthOfTextAtSize(run.text, size),
      0,
    );
    this.widths.set(key, width);
    return width;
  }

  private draw(text: string, x: number, y: number, size: number, color: RGB): void {
    for (const run of runs(text, this.fonts)) {
      this.page.drawText(run.text, { x, y, size, font: run.font, color });
      x += run.font.widthOfTextAtSize(run.text, size);
    }
  }

  private addPage(): PDFPage {
    this.page = this.pdf.addPage(PageSizes.A4);
    const top = this.page.getHeight() - margin;
    const header = printableText(this.document.header, this.fonts);
    const headerSize = Math.min(
      9,
      (9 * this.width) / Math.max(this.width, this.measure(header, 9)),
    );
    this.draw(header, margin, top, headerSize, headingColor);
    this.draw(printableText(this.document.subtitle, this.fonts), margin, top - 17, 9, mutedColor);
    this.page.drawLine({
      start: { x: margin, y: top - 27 },
      end: { x: this.page.getWidth() - margin, y: top - 27 },
      thickness: 0.7,
      color: rgb(0.78, 0.81, 0.83),
    });
    this.y = top - 49;
    return this.page;
  }

  newPage(): void {
    this.addPage();
  }

  private space(height: number): void {
    if (this.y - height < margin + 12) this.addPage();
  }

  section(title: string): void {
    this.space(42);
    this.y -= 11;
    this.paragraph(title, 13, headingColor, 8);
  }

  paragraph(text: string, size = 10, color = textColor, gap = 5): void {
    const printable = printableText(
      text
        .replace(/\r\n?/g, "\n")
        .replace(
          /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g,
          "",
        ),
      this.fonts,
    );
    const lineHeight = size * 1.6;
    const line = (value: string) => {
      this.space(lineHeight);
      this.draw(value, margin, this.y, size, color);
      this.y -= lineHeight;
    };
    for (const paragraph of printable.split("\n")) {
      let current = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const candidate = current ? `${current} ${word}` : word;
        if (this.measure(candidate, size) <= this.width) {
          current = candidate;
          continue;
        }
        if (current) {
          line(current);
          current = "";
        }
        if (this.measure(word, size) <= this.width) {
          current = word;
          continue;
        }
        for (const { segment } of this.graphemes.segment(word)) {
          if (current && this.measure(current + segment, size) > this.width) {
            line(current);
            current = "";
          }
          current += segment;
        }
      }
      line(current);
    }
    this.y -= gap;
  }

  finish(): void {
    const pages = this.pdf.getPages();
    for (const [position, page] of pages.entries()) {
      page.drawText(this.document.footer, {
        x: margin,
        y: 27,
        size: 7,
        font: this.fonts.latin,
        color: mutedColor,
      });
      const counter = `${position + 1} / ${pages.length}`;
      page.drawText(counter, {
        x: page.getWidth() - margin - this.fonts.latin.widthOfTextAtSize(counter, 8),
        y: 27,
        size: 8,
        font: this.fonts.latin,
        color: mutedColor,
      });
    }
  }
}

export async function exportPdf(dossier: CaseDossier): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${dossier.reference} - ${dossier.headline}`);
  pdf.setAuthor("Avanti");
  pdf.setProducer("Avanti / pdf-lib");
  const printer = new UnicodePrinter(pdf, await loadFonts(pdf, JSON.stringify(dossier)), {
    header: `Avanti - ${dossier.office?.name ?? "Fascicolo operatore"}`,
    subtitle: dossier.reference,
    footer: "Fascicolo preparatorio - verifica dell'operatore",
  });
  printer.paragraph(dossier.headline, 19, headingColor, 9);
  printer.paragraph(
    "Fascicolo preparatorio generato con supporto automatico. Non costituisce una DSU e non è trasmesso a INPS o ad altri enti.",
    9,
    mutedColor,
  );
  const reviewed = dossier.status === "ready" || dossier.status === "closed";
  printer.paragraph(
    reviewed
      ? "Verificato dall'operatore: le decisioni sulle singole voci sono riportate nella checklist."
      : "Verifica dell'operatore da completare: questo export non attesta la correttezza dei documenti.",
    9,
    mutedColor,
  );
  printer.paragraph(
    `${dossier.progress.documentsDone}/${dossier.progress.documentsRequired} documenti richiesti acquisiti`,
    11,
  );
  const citizen = [dossier.citizen.firstName, dossier.citizen.lastName].filter(Boolean).join(" ");
  if (citizen) printer.paragraph(`Cittadino: ${citizen}`);
  const contact = [dossier.citizen.phone, dossier.citizen.email].filter(Boolean).join(" - ");
  if (contact) printer.paragraph(`Contatto: ${contact}`);
  printer.section("Riepilogo");
  const sources = { citizen: "dichiarato", document: "documento", operator: "operatore" };
  for (const fact of dossier.facts)
    printer.paragraph(`${fact.label}: ${fact.value} (${sources[fact.source]})`);
  if (!dossier.facts.length) printer.paragraph("Nessun dato riepilogativo disponibile.");

  printer.section("Nucleo familiare");
  for (const member of dossier.household)
    printer.paragraph(
      `${member.firstName} ${member.lastName ?? ""} - ${member.role}${member.birthYear ? ` - nato/a nel ${member.birthYear}` : ""}`,
    );
  if (!dossier.household.length) printer.paragraph("Nucleo non ancora indicato.");

  printer.section("Checklist documentale");
  for (const item of dossier.checklist) {
    printer.paragraph(
      `[${statusLabels[item.status]}] ${item.title}${item.memberName ? ` - ${item.memberName}` : ""}`,
    );
    if (item.note) printer.paragraph(`Nota operatore: ${item.note}`, 9, mutedColor);
  }
  if (!dossier.checklist.length) printer.paragraph("Checklist non ancora disponibile.");

  printer.section("Segnalazioni");
  const severity = { blocker: "Da completare", warning: "Attenzione", info: "Nota", ok: "OK" };
  for (const finding of dossier.findings)
    printer.paragraph(`${severity[finding.severity]}: ${finding.message}`);
  if (!dossier.findings.length) printer.paragraph("Nessuna segnalazione.");

  printer.section("Documenti allegati");
  for (const document of dossier.documents) {
    printer.paragraph(
      `${document.fileName} - ${document.pages ?? "?"} ${document.pages === 1 ? "pagina" : "pagine"} - ${Math.ceil(document.sizeBytes / 1024)} KB - ${document.checklistItemId ? "abbinato" : "non abbinato"}`,
    );
    const analysis = document.analysis;
    if (analysis)
      printer.paragraph(
        [
          analysis.ownerName ? `Intestatario: ${analysis.ownerName}` : null,
          analysis.referenceYear ? `Anno: ${analysis.referenceYear}` : null,
          analysis.expiresOn ? `Scadenza: ${analysis.expiresOn}` : null,
        ]
          .filter(Boolean)
          .join(" - "),
        9,
        mutedColor,
      );
  }
  if (!dossier.documents.length) printer.paragraph("Nessun documento allegato.");
  if (dossier.citizenNote) {
    printer.section("Nota del cittadino");
    printer.paragraph(dossier.citizenNote);
  }
  if (dossier.internalNotes) {
    printer.section("Note interne dell'operatore");
    printer.paragraph(dossier.internalNotes);
  }
  if (dossier.dsuSheet) {
    printer.section("Prospetto DSU");
    const sheet = dossier.dsuSheet;
    printer.paragraph(
      `Modello ${sheet.modelYear} - preparazione ${sheet.declarationYear} - redditi e patrimoni ${sheet.referenceYear}`,
      9,
      mutedColor,
    );
    for (const note of sheet.notes) printer.paragraph(note, 9, mutedColor);
    for (const section of sheet.sections) {
      const member =
        section.memberName ?? (section.instanceId ? "Titolarità da verificare" : "Nucleo");
      printer.section(
        `${section.module} / ${section.quadro} - ${section.title} - ${member}${section.instanceId ? ` - ${section.instanceId}` : ""}`,
      );
      if (section.note) printer.paragraph(section.note, 9, mutedColor);
      for (const row of section.rows) {
        printer.paragraph(`${row.label}: ${row.value ?? "Da completare"}`);
        const source = row.source;
        const document =
          source.kind === "document"
            ? dossier.documents.find((d) => d.id === source.documentId)
            : null;
        const sourceLabel =
          source.kind === "answer"
            ? `Risposta del cittadino: ${source.questionId}`
            : source.kind === "document"
              ? `Documento: ${document?.fileName ?? source.documentId} [${source.documentId}]; voce: ${source.checklistItemId}`
              : source.kind === "caf"
                ? "A cura del CAF"
                : `Dato mancante${source.checklistItemId ? `; voce: ${source.checklistItemId}` : ""}`;
        printer.paragraph(`Fonte: ${sourceLabel}`, 8, mutedColor);
        if (row.note) printer.paragraph(row.note, 8, mutedColor);
      }
    }
  }
  printer.finish();
  return pdf.save();
}
