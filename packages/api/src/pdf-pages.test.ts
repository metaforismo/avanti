import { expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { pdfPages } from "./pdf-pages";
it("19: parsing is terminated at a hard deadline", async () => {
  const bytes = await (await PDFDocument.create()).save();
  await expect(pdfPages(bytes, "application/pdf", 1)).rejects.toMatchObject({ status: 415 });
  expect(await pdfPages(new Uint8Array(), "image/png")).toBeNull();
});
