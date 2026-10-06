import type { Worker, WorkerOptions } from "node:worker_threads";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { UPLOAD_LIMITS } from "@avanti/contracts";
import { repoRoot } from "@avanti/db";
import { ApiFailure } from "./security";

const runtimeRequire = createRequire(resolve(repoRoot, "packages/api/package.json"));
const heapMb = Math.max(128, Math.ceil(UPLOAD_LIMITS.maxBytes / 1024 / 1024) * 48);
const retry = () =>
  new ApiFailure("internal", 503, "Analisi PDF momentaneamente non disponibile. Riprova tra poco.");
const invalid = () =>
  new ApiFailure("unsupported_file", 415, "Il PDF non può essere letto. Carica una copia valida.");

let worker: Worker | null = null;
let queued = 0;
let tail = Promise.resolve();
let idleTimer: ReturnType<typeof setTimeout> | undefined;

function parserWorker() {
  clearTimeout(idleTimer);
  if (!worker) {
    // Load the Node factory at runtime: Turbopack would bundle a direct Worker constructor.
    const factory = runtimeRequire(
      resolve(repoRoot, "packages/api/assets/pdf-worker-runtime.cjs"),
    ) as { createPdfWorker(path: string, options: WorkerOptions): Worker };
    worker = factory.createPdfWorker(resolve(repoRoot, "packages/api/assets/pdf-worker.cjs"), {
      workerData: {
        modulePath: runtimeRequire.resolve("pdf-lib", {
          paths: [resolve(repoRoot, "packages/api"), resolve(repoRoot, "node_modules/.pnpm")],
        }),
      },
      resourceLimits: { maxOldGenerationSizeMb: heapMb },
    });
    worker.on("error", () => {
      /* Each active job handles the failure; an idle worker is discarded. */
    });
    const created = worker;
    worker.once("exit", () => {
      if (worker === created) worker = null;
    });
    worker.unref();
  }
  return worker;
}

async function parse(bytes: Uint8Array, timeoutMs: number): Promise<number> {
  const parser = parserWorker();
  try {
    return await new Promise<number>((resolvePages, reject) => {
      const onError = () => finish(retry(), true);
      const onMessage = (result: { pages?: number; invalid?: boolean }) => {
        if (result.pages && Number.isInteger(result.pages) && result.pages > 0)
          finish(null, false, result.pages);
        else finish(invalid());
      };
      const finish = (error: ApiFailure | null, terminate = false, pages = 0) => {
        clearTimeout(timer);
        parser.off("message", onMessage);
        parser.off("error", onError);
        parser.off("exit", onError);
        if (terminate) {
          if (worker === parser) worker = null;
          void parser.terminate();
        }
        if (error) reject(error);
        else resolvePages(pages);
      };
      const timer = setTimeout(onError, timeoutMs);
      parser.once("message", onMessage);
      parser.once("error", onError);
      parser.once("exit", onError);
      try {
        parser.postMessage(bytes);
      } catch {
        finish(retry(), true);
      }
    });
  } finally {
    if (worker === parser) {
      idleTimer = setTimeout(() => {
        if (worker === parser) worker = null;
        void parser.terminate();
      }, 30000);
      idleTimer.unref();
    }
  }
}

export async function pdfPages(
  bytes: Uint8Array,
  mime: string,
  timeoutMs = 15000,
): Promise<number | null> {
  if (mime !== "application/pdf") return null;
  if (queued >= 4) throw retry();
  queued++;
  const previous = tail;
  let release: () => void = () => {};
  tail = new Promise<void>((resolveQueue) => {
    release = resolveQueue;
  });
  try {
    await previous;
    return await parse(bytes, timeoutMs);
  } catch (error) {
    if (error instanceof ApiFailure) throw error;
    throw retry();
  } finally {
    queued--;
    release();
  }
}
