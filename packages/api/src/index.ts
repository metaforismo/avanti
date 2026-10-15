import { Hono } from "hono";
import { createDatabase, repoRoot } from "@avanti/db";
import { resolve } from "node:path";
import { parseMfaKey } from "./mfa";
import { createApp } from "./app";
import { DiskStorage, BlobStorage } from "./storage";
import { AiIntelligence } from "./ai";
import { loadAiConfig } from "@avanti/ai/config";
import { loadNotifications } from "./notification-config";

export { createApp } from "./app";
export { MemoryStorage, DiskStorage, BlobStorage } from "./storage";
export type { ApiOptions } from "./context";
import { lazyRuntime, processSingleton, activityGate } from "./runtime";
import { safeError } from "./logging";
const activityStore = globalThis as Record<symbol, ReturnType<typeof activityGate> | undefined>;
const activity = (activityStore[Symbol.for("avanti.activity")] ??= activityGate());
const database = processSingleton(Symbol.for("avanti.database"), () => createDatabase());

/** Call after draining requests in a Node host, or during teardown of a shared-runtime test. */
export function closeRuntimeDatabase() {
  return activity.close(() => database.close((resource) => resource.close()));
}

const backgroundKey = Symbol.for("avanti.background");
const backgroundStore = globalThis as Record<
  symbol,
  ((work: () => Promise<void>) => void) | undefined
>;
export function configureRuntimeBackground(schedule: (work: () => Promise<void>) => void) {
  backgroundStore[backgroundKey] = schedule;
}

async function initialize() {
  if (process.env.VERCEL && !process.env.DATABASE_URL)
    throw new Error("DATABASE_URL required on Vercel");
  if (process.env.VERCEL && !process.env.BLOB_READ_WRITE_TOKEN)
    throw new Error("Private blob storage required on Vercel");
  if (process.env.NODE_ENV === "production" && !process.env.PUBLIC_APP_URL?.trim())
    throw new Error("PUBLIC_APP_URL required in production");
  if (process.env.NODE_ENV === "production" && !process.env.RATE_LIMIT_SECRET?.trim())
    throw new Error("RATE_LIMIT_SECRET required in production");
  if (process.env.NODE_ENV === "production") {
    if (!process.env.MFA_ENCRYPTION_KEY)
      throw new Error("MFA_ENCRYPTION_KEY required in production");
    parseMfaKey(process.env.MFA_ENCRYPTION_KEY);
  }
  // The database is shared; a failed app setup leaves it open for the next attempt.
  const { db } = await database();
  return createApp({
    db,
    notifications: await loadNotifications(process.env, resolve(repoRoot, ".data")),
    background: (work) => {
      const schedule = backgroundStore[backgroundKey];
      if (!schedule) throw new Error("Background scheduler unavailable");
      const done = activity.begin();
      try {
        schedule(async () => {
          try {
            await work();
          } finally {
            done();
          }
        });
      } catch (error) {
        done();
        throw error;
      }
    },
    storage: process.env.BLOB_READ_WRITE_TOKEN
      ? new BlobStorage(process.env.BLOB_READ_WRITE_TOKEN)
      : new DiskStorage(resolve(repoRoot, ".data/uploads")),
    ai: new AiIntelligence({
      config: loadAiConfig(process.env),
      logger: (record) => console.warn(JSON.stringify(record)),
    }),
    publicUrl: process.env.PUBLIC_APP_URL ?? "http://localhost:3400",
    production: process.env.NODE_ENV === "production",
    rateLimitSecret: process.env.RATE_LIMIT_SECRET,
    mfaEncryptionKey: process.env.MFA_ENCRYPTION_KEY,
    vercel: process.env.VERCEL === "1",
    cronSecret: process.env.CRON_SECRET,
    appVersion: {
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.APP_COMMIT,
      tag: process.env.APP_TAG,
    },
    errorLogger: (record) => console.error(JSON.stringify(record)),
    storageLogger: (record) => console.error(JSON.stringify(record)),
    trustProxy: process.env.VERCEL === "1" || process.env.TRUST_PROXY === "1",
    logger: (record) => console.info(JSON.stringify(record)),
  });
}
const runtime = lazyRuntime(initialize);
export const app = new Hono().basePath("/api");
app.all("*", async (c) => {
  let done: (() => void) | undefined;
  try {
    done = activity.begin();
    return await (await runtime()).fetch(c.req.raw);
  } catch (error) {
    const requestId = crypto.randomUUID();
    console.error(JSON.stringify({ requestId, ...safeError(error) }));
    c.header("X-Request-Id", requestId);
    c.header("Cache-Control", "no-store");
    c.header("Referrer-Policy", "no-referrer");
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header(
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    );
    return c.json(
      {
        error: {
          code: "internal",
          message: "Servizio momentaneamente non disponibile. Riprova.",
          requestId,
        },
      },
      activity.closing ? 503 : 500,
    );
  } finally {
    done?.();
  }
});
