import { describe, expect, it } from "vitest";
import { prepareUpload } from "./prepare-upload";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);
const HEIF = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypmif1"), Buffer.alloc(64)]);
const PDF = Buffer.from("%PDF-1.4\n%%EOF");

async function prepared(bytes: Uint8Array<ArrayBuffer>, name: string, type: string) {
  const result = await prepareUpload(new File([bytes], name, { type }));
  return result.ok ? { type: result.file.type, name: result.file.name } : result.reason;
}

describe("prepareUpload", () => {
  it("declares the type of the content, which the server compares with the declared one", async () => {
    expect(await prepared(HEIF, "IMG_0001.HEIF", "image/heif")).toEqual({
      type: "image/heic",
      name: "IMG_0001.HEIF",
    });
    expect(await prepared(PNG, "scansione.jpg", "image/jpeg")).toMatchObject({ type: "image/png" });
    expect(await prepared(PDF, "cu.pdf", "application/x-pdf")).toMatchObject({
      type: "application/pdf",
    });
    expect(await prepared(PDF, "cu", "")).toMatchObject({ type: "application/pdf" });
  });

  it("keeps a correctly declared file as it is", async () => {
    const file = new File([PNG], "foto.png", { type: "image/png" });
    const result = await prepareUpload(file);
    expect(result.ok && result.file).toBe(file);
  });

  it("refuses empty files and content that only looks supported by its name", async () => {
    expect(await prepared(new Uint8Array(), "vuoto.jpg", "image/jpeg")).toBe("unsupported_file");
    expect(await prepared(Buffer.from("ciao"), "finto.pdf", "application/pdf")).toBe(
      "unsupported_file",
    );
  });

  it("refuses a PDF over the limit before uploading it", async () => {
    const big = Buffer.concat([PDF, Buffer.alloc(4 * 1024 * 1024)]);
    expect(await prepared(big, "grande.pdf", "application/pdf")).toBe("file_too_large");
  });
});
