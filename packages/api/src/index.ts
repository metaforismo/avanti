import { Hono } from "hono";
import { createDatabase, repoRoot } from "@avanti/db";
import { resolve } from "node:path";
import { createApp } from "./app";
import { DiskStorage, BlobStorage } from "./storage";
import { GatewayIntelligence } from "./ai";

export { createApp } from "./app";
export { MemoryStorage, DiskStorage, BlobStorage } from "./storage";
export type { ApiOptions } from "./context";
let runtime: ReturnType<typeof initialize> | undefined;
async function initialize() {
  if (process.env.VERCEL && !process.env.DATABASE_URL)
    throw new Error("DATABASE_URL required on Vercel");
  if (process.env.VERCEL && !process.env.BLOB_READ_WRITE_TOKEN)
    throw new Error("Private blob storage required on Vercel");
  const { db } = await createDatabase();
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
    trustProxy: process.env.VERCEL === "1" || process.env.TRUST_PROXY === "1",
    logger: (record) => console.info(JSON.stringify(record)),
  });
}
export const app = new Hono().basePath("/api");
app.all("*", async (c) => {
  try {
    runtime ??= initialize();
    return (await runtime).fetch(c.req.raw);
  } catch {
    runtime = undefined;
    return c.json(
      {
        error: { code: "internal", message: "Servizio momentaneamente non disponibile. Riprova." },
      },
      500,
    );
  }
});
