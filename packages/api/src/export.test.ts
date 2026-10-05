import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CaseDossier, Language } from "@avanti/contracts";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
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
