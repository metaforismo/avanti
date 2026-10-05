import { Hono } from "hono";
import { createDatabase, repoRoot } from "@avanti/db";
import { resolve } from "node:path";
import { createApp } from "./app";
import { DiskStorage, BlobStorage } from "./storage";
import { GatewayIntelligence } from "./ai";

export { createApp } from "./app";
export { MemoryStorage, DiskStorage, BlobStorage } from "./storage";
export type { ApiOptions } from "./context";
import { lazyRuntime } from "./runtime";
import { safeError } from "./logging";
async function initialize() {
  if (process.env.VERCEL && !process.env.DATABASE_URL)
    throw new Error("DATABASE_URL required on Vercel");
  if (process.env.VERCEL && !process.env.BLOB_READ_WRITE_TOKEN)
    throw new Error("Private blob storage required on Vercel");
  if (process.env.NODE_ENV === "production" && !process.env.PUBLIC_APP_URL?.trim())
    throw new Error("PUBLIC_APP_URL required in production");
  if (process.env.NODE_ENV === "production" && !process.env.RATE_LIMIT_SECRET?.trim())
    throw new Error("RATE_LIMIT_SECRET required in production");
  const { db, close } = await createDatabase();
  try {
    return createApp({
      db,
      storage: process.env.BLOB_READ_WRITE_TOKEN
        ? new BlobStorage(process.env.BLOB_READ_WRITE_TOKEN)
        : new DiskStorage(resolve(repoRoot, ".data/uploads")),
      ai: new GatewayIntelligence({
        key: process.env.AI_GATEWAY_API_KEY,
        provider: process.env.AI_GATEWAY_PROVIDER,
        textModel: process.env.AI_MODEL_TEXT,
        visionModel: process.env.AI_MODEL_VISION,
      }),
      publicUrl: process.env.PUBLIC_APP_URL ?? "http://localhost:3400",
      production: process.env.NODE_ENV === "production",
      rateLimitSecret: process.env.RATE_LIMIT_SECRET,
      vercel: process.env.VERCEL === "1",
      errorLogger: (record) => console.error(JSON.stringify(record)),
      storageLogger: (record) => console.error(JSON.stringify(record)),
      trustProxy: process.env.VERCEL === "1" || process.env.TRUST_PROXY === "1",
      logger: (record) => console.info(JSON.stringify(record)),
    });
  } catch (error) {
    await close().catch((cleanupError) =>
      console.error(JSON.stringify({ requestId: crypto.randomUUID(), ...safeError(cleanupError) })),
    );
    throw error;
  }
}
const runtime = lazyRuntime(initialize);
export const app = new Hono().basePath("/api");
app.all("*", async (c) => {
  try {
    return await (await runtime()).fetch(c.req.raw);
  } catch (error) {
    const requestId = crypto.randomUUID();
    console.error(JSON.stringify({ requestId, ...safeError(error) }));
    c.header("X-Request-Id", requestId);
    return c.json(
      {
        error: {
          code: "internal",
          message: "Servizio momentaneamente non disponibile. Riprova.",
          requestId,
        },
      },
      500,
    );
  }
});
