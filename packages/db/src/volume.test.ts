import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { sql, eq } from "drizzle-orm";
import { createDatabase } from "./client";
import { organizations, cases, documents } from "./schema";
import { seedVolume, volumeCasesArgument, volumeToken } from "./volume";

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("VERCEL_ENV", "");
});
afterEach(() => vi.unstubAllEnvs());

it("validates volume CLI arguments without silently seeding on a typo", () => {
  expect(volumeCasesArgument([])).toBe(5000);
  expect(volumeCasesArgument(["--", "--cases", "123"])).toBe(123);
  for (const args of [
    ["--cases"],
    ["--cases", "0"],
    ["--cases", "1.5"],
    ["--cases", "100001"],
    ["--case", "5"],
    ["5"],
  ])
    expect(() => volumeCasesArgument(args)).toThrow();
  expect(volumeToken(1)).toMatch(/^[A-Za-z0-9_-]{43}$/);
});

it("creates resumable deterministic metadata-only volume and refuses real organizations/production", async () => {
  const { db, close } = await createDatabase({ memory: true });
  try {
    await seedVolume(db, 180);
    await db
      .update(cases)
      .set({ internalNotes: "Nota modificata" })
      .where(eq(cases.id, "volume-case-0000001"));
    await db.delete(documents).where(eq(documents.id, "volume-case-0000001-doc-0"));
    const before = await db.select().from(cases).orderBy(cases.id);
    const docs = await db.select().from(documents).orderBy(documents.id);
    expect(new Set(before.map((r) => r.status)).size).toBe(6);
    expect(new Set(before.map((r) => r.language)).size).toBe(8);
    expect(Date.parse(before.at(-1)!.createdAt)).toBeLessThan(Date.parse("2027-01-15"));
    expect(
      docs.every(
        (d) => d.storageKey.startsWith("volume-metadata-only/") && d.status === "analyzed",
      ),
    ).toBe(true);
    const totals = async () =>
      db.execute(
        sql`select (select count(*) from cases) as cases, (select count(*) from documents) as docs, (select count(*) from messages) as messages, (select count(*) from checklist_reviews) as reviews, (select count(*) from events) as events`,
      );
    const counts = await totals();
    await seedVolume(db, 180);
    expect(await db.select().from(cases).orderBy(cases.id)).toEqual(before);
    expect(await db.select().from(documents).orderBy(documents.id)).toEqual(docs);
    expect(await totals()).toEqual(counts);
    vi.stubEnv("NODE_ENV", "production");
    await expect(seedVolume(db, 1)).rejects.toThrow("disabled");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("DATABASE_URL", "postgres://example.invalid/never-connect");
    await expect(seedVolume(db, 1)).rejects.toThrow("disabled");
    vi.stubEnv("DATABASE_URL", "");
    await db.insert(organizations).values({ id: "real", name: "Real CAF", kind: "caf" });
    await expect(seedVolume(db, 1)).rejects.toThrow("empty database");
  } finally {
    await close();
  }
}, 30000);
