import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { databaseRegion, preflight, strongSecret } from "./preflight";
import { assertDemoSeedAllowed } from "./seed-guard";

const valid = () => ({
  DATABASE_URL:
    "postgresql://user:do-not-print@ep-example.aws-eu-central-1.neon.tech/app?sslmode=require",
  BLOB_READ_WRITE_TOKEN: "do-not-print-blob",
  PUBLIC_APP_URL: "https://avanti.example",
  RATE_LIMIT_SECRET: randomBytes(32).toString("hex"),
  MFA_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
  CRON_SECRET: randomBytes(32).toString("hex"),
});
it("checks production without logging values or making network requests", () => {
  const env = valid();
  const result = preflight(env);
  expect(result.filter((issue) => issue.level === "error")).toEqual([]);
  expect(result.some((issue) => issue.message.includes("aws-eu-central-1"))).toBe(true);
  expect(result.some((issue) => issue.message.includes("fallback euristico"))).toBe(true);
  for (const secret of [
    env.DATABASE_URL,
    env.BLOB_READ_WRITE_TOKEN,
    env.CRON_SECRET,
    env.RATE_LIMIT_SECRET,
    env.MFA_ENCRYPTION_KEY,
  ])
    expect(JSON.stringify(result)).not.toContain(secret);
});
it("reports every missing obligation, permits local fallback, and does not require AI", () => {
  const errors = preflight({}).filter((issue) => issue.level === "error");
  for (const key of [
    "DATABASE_URL",
    "BLOB_READ_WRITE_TOKEN",
    "PUBLIC_APP_URL",
    "RATE_LIMIT_SECRET",
    "CRON_SECRET",
    "MFA_ENCRYPTION_KEY",
  ])
    expect(errors.some((issue) => issue.message.includes(key))).toBe(true);
  expect(preflight({}, false).every((issue) => issue.level !== "error")).toBe(true);
});
it("rejects URL ambiguity, insecure origins, weak or reused secrets and demo links", () => {
  for (const PUBLIC_APP_URL of [
    "http://avanti.example",
    "https://avanti.example/",
    "https://avanti.example/path",
    "https://u:p@avanti.example",
    "https://avanti.example?q=1",
    "https://localhost",
    "garbage",
  ])
    expect(
      preflight({ ...valid(), PUBLIC_APP_URL }).some(
        (i) => i.level === "error" && i.message.includes("PUBLIC_APP_URL"),
      ),
    ).toBe(true);
  for (const DATABASE_URL of [
    "https://db.example",
    "postgres://user@db.example",
    "postgres://user@db.example/app",
    "secret://do-not-print",
  ])
    expect(
      preflight({ ...valid(), DATABASE_URL }).some(
        (i) => i.level === "error" && i.message.includes("DATABASE_URL"),
      ),
    ).toBe(true);
  for (const secret of [
    "a".repeat(64),
    "0123456789abcdef".repeat(4),
    "short",
    "password".repeat(10),
  ]) {
    expect(strongSecret(secret)).toBe(false);
  }
  const env = valid();
  expect(
    preflight({ ...env, CRON_SECRET: env.RATE_LIMIT_SECRET }).some((i) => i.level === "error"),
  ).toBe(true);
  expect(
    preflight({ ...env, NEXT_PUBLIC_DEMO_OFFICE_SLUG: "demo" }).some((i) => i.level === "error"),
  ).toBe(true);
  expect(databaseRegion("aws-0-eu-central-1.pooler.supabase.com")).toBe("eu-central-1");
  expect(databaseRegion("db.ref.supabase.co")).toBeNull();
});
it("blocks demo seed even when a remote environment overrides NODE_ENV", () => {
  for (const env of [
    { NODE_ENV: "production" },
    { NODE_ENV: "development", VERCEL: "1" },
    { VERCEL_ENV: "preview" },
    { DATABASE_URL: "postgres://example/app" },
  ])
    expect(() => assertDemoSeedAllowed(env)).toThrow();
  expect(() => assertDemoSeedAllowed({ NODE_ENV: "development" })).not.toThrow();
});
it("CLI fails safely and --local cannot bypass a Vercel preflight", () => {
  const script = fileURLToPath(new URL("./preflight-cli.ts", import.meta.url));
  const result = spawnSync(process.execPath, ["--import", "tsx", script, "--local"], {
    encoding: "utf8",
    env: { PATH: process.env.PATH, VERCEL: "1", DATABASE_URL: "do-not-print-database-secret" },
  });
  expect(result.status).toBe(1);
  expect(result.stdout).toContain("rilascio bloccato");
  expect(result.stdout + result.stderr).not.toContain("do-not-print-database-secret");
});
