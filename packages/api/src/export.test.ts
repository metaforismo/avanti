import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CaseDossier, Language } from "@avanti/contracts";
import { PDFDocument, PDFPage } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";
import { buildDsuSheet } from "@avanti/core";
import { exportPdf } from "./export";

function sample(language: Language, name: string): CaseDossier {
  const now = "2027-01-10T12:00:00Z";
  return {
    id: "example-case",
    reference: "AV-2027-000123",
    citizenName: name,
    practice: {
      id: "isee_ordinario",
      category: "assistenza",
      availability: "available",
      name: "ISEE ordinario",
      description: "Preparazione fascicolo",
      referenceYear: 2025,
      estimatedMinutes: 15,
    },
    status: "ready",
    language,
    office: {
      id: "example-office",
      slug: "example",
      name: "CAF Esempio - Milano",
      address: "Via Esempio 1",
      city: "Milano",
      phone: null,
      openingHours: null,
    },
    assignee: null,
    progress: {
      questionsAnswered: 1,
      questionsTotal: 1,
      documentsDone: 1,
      documentsRequired: 1,
      percent: 100,
    },
    blockers: 0,
    warnings: 0,
    createdAt: now,
    updatedAt: now,
    submittedAt: now,
    citizen: { firstName: name, lastName: null, phone: null, email: "demo@example.invalid" },
    headline: "ISEE ordinario 2027",
    facts: [{ label: "Nucleo", value: "1 persona", source: "citizen" }],
    household: [{ id: "example-member", role: "richiedente", firstName: name, birthYear: 1985 }],
    answers: [],
    checklist: [
      {
        id: "identity:example-member",
        requirementId: "identity",
        group: "identita",
        title: "Documento d'identità",
        description: "Copia leggibile",
        howToGet: null,
        required: true,
        memberId: "example-member",
        memberName: name,
        status: "verified",
        documentIds: ["example-doc"],
        note: null,
      },
    ],
    dsuSheet: null,
    documents: [
      {
        id: "example-doc",
        fileName: `ESEMPIO-${name}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 2048,
        pages: 1,
        uploadedAt: now,
        checklistItemId: "identity:example-member",
        memberId: "example-member",
        status: "analyzed",
        analysis: null,
      },
    ],
    findings: [],
    messages: [],
    timeline: [],
    citizenNote: "È un fascicolo dimostrativo.",
    internalNotes: "Nota interna: già verificato dall'operatore.",
    timing: { citizenMinutes: 15, reviewMinutes: 5 },
    citizenLink: null,
  };
}

describe("PDF dossier", () => {
  it("prints the DSU as the final section, including values and document/answer/CAF/missing provenance", async () => {
    const dossier = sample("it", "Persona Esempio");
    dossier.dsuSheet = buildDsuSheet(
      "isee_ordinario",
      { housing: "owned", accounts_count: 0 },
      dossier.household,
      dossier.checklist,
      dossier.documents,
    );
    const draw = vi.spyOn(PDFPage.prototype, "drawText");
    try {
      const bytes = await exportPdf(dossier);
      const text = draw.mock.calls.map(([value]) => value).join("\n");
      expect(text.indexOf("Prospetto DSU")).toBeGreaterThan(
        text.indexOf("Note interne dell'operatore"),
      );
      expect(text).toContain("Nome: Persona Esempio");
      expect(text).toContain("Risposta del cittadino: members");
      expect(text).toContain("Documento: ESEMPIO-Persona Esempio.pdf [example-doc]");
      expect(text).toContain("A cura del CAF");
      expect(text).toContain("Dato mancante");
      expect(text).toContain("Data di nascita: Da completare");
      expect(text).toContain("Rapporti finanziari: Nessuno");
      const sharedNote = dossier.dsuSheet!.sections.find(
        (section) => section.quadro === "FC3",
      )!.note!;
      expect(sharedNote).toBeTruthy();
      // Paragraphs can wrap in the PDF; check the first line and the next field's order.
      const noteStart = text.indexOf("Nessun immobile attribuito");
      expect(noteStart).toBeGreaterThan(-1);
      expect(noteStart).toBeLessThan(text.indexOf("Tipo di patrimonio: Da completare"));
      expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(1);
      const proofDir = process.env.AVANTI_PDF_PROOF_DIR;
      if (proofDir) {
        await mkdir(proofDir, { recursive: true });
        await writeFile(join(proofDir, "dsu-sheet.pdf"), bytes);
      }
    } finally {
      draw.mockRestore();
    }
  });

  const names: Array<[Language, string]> = [
    ["it", "Élisa D'Èsempio"],
    ["en", "Alex Example"],
    ["fr", "François Démonstration"],
    ["es", "María Ejemplo"],
    ["ro", "Ștefan Țepeș"],
    ["uk", "Олена Приклад"],
    ["ar", "محمد علي"],
    ["bn", "রহিম উদাহরণ"],
  ];
  it.each(names)(
    "exports printable Unicode names for %s without altering the dossier",
    async (language, name) => {
      const dossier = sample(language, name);
      const before = JSON.stringify(dossier);
      const bytes = await exportPdf(dossier);
      const pdf = await PDFDocument.load(bytes);
      expect(pdf.getPageCount()).toBeGreaterThan(0);
      expect(pdf.getTitle()).toBe("AV-2027-000123 - ISEE ordinario 2027");
      expect(bytes.byteLength).toBeGreaterThan(1000);
      expect(JSON.stringify(dossier)).toBe(before);
      const proofDir = process.env.AVANTI_PDF_PROOF_DIR;
      if (proofDir) {
        await mkdir(proofDir, { recursive: true });
        await writeFile(join(proofDir, `${language}.pdf`), bytes);
      }
    },
  );

  it("paginates long checklists, multiline notes and unbroken text", async () => {
    const dossier = sample("it", "Persona Esempio");
    const item = dossier.checklist[0];
    if (!item) throw new Error("Missing test fixture");
    dossier.checklist = Array.from({ length: 90 }, (_, position) => ({
      ...item,
      id: `item-${position}`,
      title: `Documento ${position + 1}: ${"descrizione estesa del requisito ".repeat(5)}`,
      note: "Nota di revisione su più righe.\nLa seconda riga deve rimanere leggibile.",
    }));
    dossier.internalNotes = `PRIMA RIGA\n${"LongUnbrokenText".repeat(150)}\nULTIMA RIGA`;
    const bytes = await exportPdf(dossier);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(5);
    expect(
      pdf
        .getPages()
        .every(
          (page) => Math.round(page.getWidth()) === 595 && Math.round(page.getHeight()) === 842,
        ),
    ).toBe(true);
    const proofDir = process.env.AVANTI_PDF_PROOF_DIR;
    if (proofDir) await writeFile(join(proofDir, "long.pdf"), bytes);
  }, 15_000);
});

it.each([
  ["ar", "محمد علي"],
  ["bn", "রহিম উদাহরণ"],
] as const)(
  "edge PDF: %s, 20 members, long words, emoji and embedded glyphs stay inside A4",
  async (language, name) => {
    const dossier = sample(language, name);
    dossier.household = Array.from({ length: 20 }, (_, i) => ({
      id: `member-${i}`,
      role: i === 0 ? "richiedente" : "figlio",
      firstName: name,
      lastName: `${i}`,
    }));
    dossier.citizenNote = `${name} `.repeat(100) + "🙂🧑🏽‍💻🚀";
    dossier.internalNotes = name.replaceAll(" ", "").repeat(120);
    const draw = vi.spyOn(PDFPage.prototype, "drawText");
    try {
      const bytes = await exportPdf(dossier);
      const pdf = await PDFDocument.load(bytes);
      expect(pdf.getPageCount()).toBeGreaterThan(1);
      const drawn = draw.mock.calls.map(([text]) => text).join("");
      expect(drawn).toContain(name);
      expect(drawn).toContain("[U+1F642]");
      for (const [text, options] of draw.mock.calls) {
        const font = options?.font;
        if (!font) throw new Error("Font must be embedded explicitly");
        const supported = new Set(font.getCharacterSet());
        for (const char of text) expect(supported.has(char.codePointAt(0)!)).toBe(true);
        expect(options!.x! + font.widthOfTextAtSize(text, options!.size!)).toBeLessThanOrEqual(
          595.28 - 46 + 0.05,
        );
        expect(options!.x).toBeGreaterThanOrEqual(46 - 0.05);
        expect(options!.y).toBeGreaterThanOrEqual(27);
        expect(options!.y).toBeLessThanOrEqual(841.89 - 46 + 0.05);
      }
      const proofDir = process.env.AVANTI_PDF_PROOF_DIR;
      if (proofDir) {
        await mkdir(proofDir, { recursive: true });
        await writeFile(join(proofDir, `edge-${language}.pdf`), bytes);
      }
    } finally {
      draw.mockRestore();
    }
  },
  15_000,
);

it("edge PDF: newline remains a paragraph break and tabs remain whitespace", async () => {
  const dossier = sample("it", "Persona Esempio");
  dossier.citizenNote = "PRIMA_RIGA\nSECONDA_RIGA\tCON_TAB";
  const draw = vi.spyOn(PDFPage.prototype, "drawText");
  try {
    await exportPdf(dossier);
    const lines = draw.mock.calls.map(([text]) => text);
    expect(lines).toContain("PRIMA_RIGA");
    expect(lines).toContain("SECONDA_RIGA CON_TAB");
    expect(lines.join("")).not.toMatch(/\[U\+(A|9)\]/);
  } finally {
    draw.mockRestore();
  }
});
