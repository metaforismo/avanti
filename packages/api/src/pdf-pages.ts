import { Worker } from "node:worker_threads";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { repoRoot } from "@avanti/db";
import { ApiFailure } from "./security";
const runtimeRequire = createRequire(resolve(repoRoot, "packages/api/package.json"));
export async function pdfPages(
  bytes: Uint8Array,
  mime: string,
  timeoutMs = 2000,
): Promise<number | null> {
  if (mime !== "application/pdf") return null;
  try {
    return await new Promise<number>((resolve, reject) => {
      const worker = new Worker(
        `const { parentPort, workerData } = require('node:worker_threads');
        const { PDFDocument } = require(workerData.modulePath);
        PDFDocument.load(workerData.bytes).then(pdf => parentPort.postMessage(pdf.getPageCount())).catch(() => parentPort.postMessage(0));`,
        {
          eval: true,
          workerData: { modulePath: runtimeRequire.resolve("pdf-lib"), bytes },
          resourceLimits: { maxOldGenerationSizeMb: 64 },
        },
      );
      const finish = (pages?: number) => {
        clearTimeout(timer);
        void worker.terminate();
        if (pages && Number.isInteger(pages) && pages > 0) resolve(pages);
        else reject(new Error("Invalid PDF"));
      };
      const timer = setTimeout(() => finish(), timeoutMs);
      worker.once("message", (pages: number) => finish(pages));
      worker.once("error", () => finish());
      worker.once("exit", () => finish());
    });
  } catch {
    throw new ApiFailure(
      "unsupported_file",
      415,
      "Il PDF non può essere letto. Carica una copia valida.",
    );
  }
}
