import { describe, expect, it } from "vitest";
import {
  documentArchiveName,
  documentArchivePlan,
  fileNamePart,
  MAX_NAME_BYTES,
} from "./document-archive";

const item = (
  id: string,
  title: string,
  memberName: string | null,
  status: "missing" | "uploaded" | "issue" | "verified" | "rejected" | "waived" = "verified",
) => ({ id, title, memberName, status });
let n = 0;
const doc = (
  checklistItemId: string | null,
  fileName = "scan.pdf",
  mimeType = "application/pdf",
  sizeBytes = 100,
) => ({
  id: `doc-${++n}`,
  fileName,
  mimeType,
  sizeBytes,
  uploadedAt: "2027-01-12T09:00:00.000Z",
  checklistItemId,
  rejectedAt: null as string | null,
});
const size = (text: string) => new TextEncoder().encode(text).length;

describe("documentArchivePlan", () => {
  it("follows the dossier order, numbers every file and names whose and what it is", () => {
    const checklist = [
      item("id-a", "Documento d’identità", "Mario Rossi"),
      item("bal-a", "Saldo al 31/12/2025 e dati del rapporto · Fineco", "Mario Rossi", "uploaded"),
      item("id-b", "Documento d’identità", "Anna Rossi"),
      item("lease", "Contratto di locazione", null),
    ];
    const documents = [
      doc("lease"),
      doc("id-b", "IMG_2041.HEIC", "image/heic"),
      doc("id-a", "fronte.jpg", "image/jpeg"),
      doc("id-a", "retro.jpg", "image/jpeg"),
      doc("bal-a"),
    ];
    const plan = documentArchivePlan(checklist, documents);
    expect(plan.entries.map((entry) => entry.name)).toEqual([
      "01 Mario Rossi - Documento d’identità (1 di 2).jpg",
      "02 Mario Rossi - Documento d’identità (2 di 2).jpg",
      "03 Mario Rossi - Saldo al 31-12-2025 e dati del rapporto · Fineco.pdf",
      "04 Anna Rossi - Documento d’identità.heic",
      "05 Nucleo familiare - Contratto di locazione.pdf",
    ]);
    expect(plan.unverified).toBe(1);
    expect(plan.totalBytes).toBe(500);
  });

  it("leaves out rejected and waived items and keeps files nobody matched, last", () => {
    const checklist = [
      item("id-a", "Documento d’identità", "Mario Rossi", "rejected"),
      item("car", "Libretto", "Mario Rossi", "waived"),
      item("isee", "ISEE precedente", "Mario Rossi", "uploaded"),
    ];
    const plan = documentArchivePlan(checklist, [
      doc(null, "foto del contratto.final.png", "image/png"),
      doc("id-a"),
      doc("car"),
      doc("isee"),
      // An item the checklist no longer has (the answers changed): still the citizen's file.
      doc("gone", "vecchio.pdf"),
    ]);
    expect(plan.excluded).toBe(2);
    expect(plan.entries.map((entry) => entry.name)).toEqual([
      "01 Mario Rossi - ISEE precedente.pdf",
      "02 Altri documenti - foto del contratto.final.png",
      "03 Altri documenti - vecchio.pdf",
    ]);
    expect(plan.entries.every((entry) => !entry.verified)).toBe(true);
  });

  it("keeps a rejected file out after the citizen sent its replacement", () => {
    // The upload clears the rejection, so the item reads «uploaded» with both files on it.
    const wrong = {
      ...doc("id-a", "sbagliato.jpg", "image/jpeg"),
      rejectedAt: "2027-01-12T10:00:00Z",
    };
    const unmatchedWrong = { ...doc(null, "vecchio.pdf"), rejectedAt: "2027-01-12T10:00:00Z" };
    const plan = documentArchivePlan(
      [item("id-a", "Documento d’identità", "Mario Rossi", "uploaded")],
      [wrong, doc("id-a", "giusto.jpg", "image/jpeg"), unmatchedWrong],
    );
    expect(plan.entries.map((entry) => entry.name)).toEqual([
      "01 Mario Rossi - Documento d’identità.jpg",
    ]);
    expect(plan.excluded).toBe(2);
    expect(plan.totalBytes).toBe(100);
  });

  it("returns an empty plan when there is nothing to hand over", () => {
    expect(documentArchivePlan([item("a", "Documento", "X", "missing")], [])).toEqual({
      entries: [],
      excluded: 0,
      unverified: 0,
      totalBytes: 0,
    });
  });

  it("keeps names unique and short for long titles in non-Latin scripts", () => {
    const longName = "মোহাম্মদ রহমান চৌধুরী ".repeat(6);
    const title = "Certificazione dei redditi percepiti all’estero con traduzione ".repeat(4);
    const checklist = Array.from({ length: 3 }, (_, index) => item(`i${index}`, title, longName));
    const plan = documentArchivePlan(
      checklist,
      checklist.map((entry) => doc(entry.id, "x.webp", "image/webp")),
    );
    const names = plan.entries.map((entry) => entry.name);
    expect(new Set(names).size).toBe(3);
    for (const name of names) {
      expect(size(name)).toBeLessThanOrEqual(MAX_NAME_BYTES);
      expect(name).toMatch(/^0\d [^/\\]+ - .+\.webp$/);
      expect(name).not.toContain("�");
    }
  });

  it("pads the number to the count so a file picker sorts past 99 files", () => {
    const checklist = [item("a", "Pagina", "Mario Rossi")];
    const plan = documentArchivePlan(
      checklist,
      Array.from({ length: 100 }, () => doc("a")),
    );
    expect(plan.entries[0]!.name).toBe("001 Mario Rossi - Pagina (1 di 100).pdf");
    expect(plan.entries[99]!.name).toBe("100 Mario Rossi - Pagina (100 di 100).pdf");
  });

  it("uses the original extension only for a type it does not know, never a path", () => {
    const plan = documentArchivePlan(
      [],
      [doc(null, "../../etc/passwd", "application/octet-stream"), doc(null, "a.TIFF", "image/x")],
    );
    expect(plan.entries.map((entry) => entry.name)).toEqual([
      "01 Altri documenti - ..-..-etc-passwd.bin",
      "02 Altri documenti - a.tiff",
    ]);
  });
});

describe("fileNamePart", () => {
  it("removes controls and bidirectional overrides and trailing dots", () => {
    expect(fileNamePart("Rossi‮ fdp.exe\u0000 ...", 100)).toBe("Rossi fdp.exe");
    expect(fileNamePart('a/b*c?"d<e>f|g\\h', 100)).toBe("a-b-c--d-e-f-g-h");
    expect(fileNamePart("Redditi 2025: CU", 100)).toBe("Redditi 2025 - CU");
  });

  it("cuts on a character boundary", () => {
    expect(fileNamePart("محمد", 5)).toBe("مح");
    expect(fileNamePart("😀😀", 5)).toBe("😀");
  });
});

describe("documentArchiveName", () => {
  it("puts the surname first and works without a name", () => {
    expect(documentArchiveName("AV-2027-000123", { firstName: "Mario", lastName: "Rossi" })).toBe(
      "Rossi Mario - AV-2027-000123 - documenti.zip",
    );
    expect(documentArchiveName("AV-2027-000123", { firstName: null, lastName: null })).toBe(
      "AV-2027-000123 - documenti.zip",
    );
  });
});
