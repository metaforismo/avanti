import { expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { pdfPages } from "./pdf-pages";
it("19: parsing is terminated at a hard deadline", async () => {
  const bytes = await (await PDFDocument.create()).save();
  await expect(pdfPages(bytes, "application/pdf", 1)).rejects.toMatchObject({ status: 503 });
  expect(await pdfPages(new Uint8Array(), "image/png")).toBeNull();
});
it("9: valid PDFs survive cold start and repeated parsing; malformed input stays 415", async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const bytes = await pdf.save();
  expect(await pdfPages(bytes, "application/pdf")).toBe(1);
  expect(await pdfPages(bytes, "application/pdf")).toBe(1);
  await expect(
    pdfPages(new TextEncoder().encode("%PDF-invalid"), "application/pdf"),
  ).rejects.toMatchObject({ status: 415 });
});
it("9: OOM is retryable and the next request starts a fresh worker", async () => {
  const { Worker } = await import("node:worker_threads");
  const { vi } = await import("vitest");
  const post = vi.spyOn(Worker.prototype, "postMessage").mockImplementationOnce(function (
    this: InstanceType<typeof Worker>,
  ) {
    this.emit(
      "error",
      Object.assign(new Error("memory limit"), { code: "ERR_WORKER_OUT_OF_MEMORY" }),
    );
  });
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const bytes = await pdf.save();
  await expect(pdfPages(bytes, "application/pdf")).rejects.toMatchObject({ status: 503 });
  post.mockRestore();
  expect(await pdfPages(bytes, "application/pdf")).toBe(1);
});
it("9: successive parses reuse the same worker thread", async () => {
  const { Worker } = await import("node:worker_threads");
  const { vi } = await import("vitest");
  const postMessage = Worker.prototype.postMessage;
  const threads: number[] = [];
  const post = vi.spyOn(Worker.prototype, "postMessage").mockImplementation(function (
    this: InstanceType<typeof Worker>,
    ...args: Parameters<typeof postMessage>
  ) {
    threads.push(this.threadId);
    return postMessage.apply(this, args);
  });
  try {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const bytes = await pdf.save();
    await pdfPages(bytes, "application/pdf");
    await pdfPages(bytes, "application/pdf");
    expect(threads.length).toBe(2);
    expect(new Set(threads).size).toBe(1);
  } finally {
    post.mockRestore();
  }
});
