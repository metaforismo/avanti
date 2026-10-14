import { join } from "node:path";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq, sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { createDatabase, repoRoot } from "./client";
import { nextReference } from "./reference";
import * as schema from "./schema";
import { cases, documents, events, organizations, offices, operators, settings } from "./schema";

const closes: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of closes.splice(0)) await close();
});

describe("PostgreSQL schema on PGlite", () => {
  it("allocates unique references per organization/year with atomic upserts", async () => {
    const { db, close } = await createDatabase({ memory: true });
    closes.push(close);
    await db.insert(organizations).values([
      { id: "a", name: "CAF Esempio A", kind: "caf" },
      { id: "b", name: "CAF Esempio B", kind: "caf" },
    ]);
    const references = await Promise.all(
      Array.from({ length: 12 }, () => nextReference(db, "a", 2027)),
    );
    expect(new Set(references).size).toBe(12);
    expect(references).toContain("AV-2027-000012");
    expect(await nextReference(db, "b", 2027)).toBe("AV-2027-000001");
    expect(await nextReference(db, "a", 2028)).toBe("AV-2028-000001");
    await expect(nextReference(db, "a", 2027.5)).rejects.toThrow(RangeError);
  });

  it("rejects cross-organization office links and cascades case data", async () => {
    const { db, close } = await createDatabase({ memory: true });
    closes.push(close);
    await db.insert(organizations).values([
      { id: "a", name: "CAF Esempio A", kind: "caf" },
      { id: "b", name: "CAF Esempio B", kind: "caf" },
    ]);
    await db.insert(offices).values({
      id: "office-a",
      organizationId: "a",
      slug: "office-a",
      name: "Sede",
      address: "Via Esempio",
      city: "Milano",
    });
    const input = {
      id: "case",
      organizationId: "b",
      officeId: "office-a",
      tokenHash: "hash",
      reference: "AV-2027-000001",
      language: "it" as const,
      createdAt: "2027-01-01T00:00:00.000Z",
      updatedAt: "2027-01-01T00:00:00.000Z",
      expiresAt: "2027-03-01T00:00:00.000Z",
    };
    await expect(db.insert(cases).values(input)).rejects.toThrow();
    await db.insert(cases).values({ ...input, organizationId: "a" });
    await db.insert(documents).values({
      id: "doc",
      caseId: "case",
      fileName: "ESEMPIO.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2,
      storageKey: "example",
      sha256: "hash",
      uploadedAt: input.createdAt,
      status: "analyzed",
    });
    await db.delete(cases).where(eq(cases.id, "case"));
    expect(await db.select().from(documents)).toEqual([]);
  });

  it("applies migrations twice in memory without losing existing data", async () => {
    const client = new PGlite({ extensions: { pg_trgm } });
    closes.push(() => client.close());
    const db = drizzle(client, { schema });
    const options = { migrationsFolder: join(repoRoot, "packages/db/migrations") };
    await migrate(db, options);
    await db.insert(organizations).values({ id: "persist", name: "CAF Esempio", kind: "caf" });
    await db.insert(settings).values({ organizationId: "persist" });
    await migrate(db, options);
    expect(await db.select().from(organizations)).toHaveLength(1);
    expect((await db.select().from(settings))[0]?.linkDays).toBe(60);
  });

  it("enforces audit tenant boundaries and permits only non-content metadata", async () => {
    const { db, close } = await createDatabase({ memory: true });
    closes.push(close);
    await db.insert(organizations).values([
      { id: "a", name: "CAF Esempio A", kind: "caf" },
      { id: "b", name: "CAF Esempio B", kind: "caf" },
    ]);
    await db.insert(offices).values({
      id: "office-a",
      organizationId: "a",
      slug: "office-a",
      name: "Sede",
      address: "Via Esempio",
      city: "Milano",
    });
    const at = "2027-01-01T00:00:00.000Z";
    await db.insert(cases).values({
      id: "case-a",
      organizationId: "a",
      officeId: "office-a",
      tokenHash: "hash",
      reference: "AV-2027-000001",
      language: "it",
      createdAt: at,
      updatedAt: at,
      expiresAt: "2027-03-01T00:00:00.000Z",
    });
    const event = {
      id: "audit",
      caseId: "case-a",
      organizationId: "b",
      actor: "system" as const,
      type: "case.created",
      at,
      metadata: {},
    };
    await expect(db.insert(events).values(event)).rejects.toThrow();
    await expect(
      db.insert(events).values({
        ...event,
        organizationId: "a",
        metadata: sql`'{"text":"private content"}'::jsonb`,
      }),
    ).rejects.toThrow();
    await expect(
      db.insert(events).values({
        ...event,
        organizationId: "a",
        metadata: sql`'{"nested":{"count":1}}'::jsonb`,
      }),
    ).rejects.toThrow();
    await db.insert(events).values({
      ...event,
      organizationId: "a",
      metadata: { count: 1, heuristic: true, optional: null },
    });
    expect(await db.select().from(events)).toHaveLength(1);
    await expect(db.delete(cases).where(eq(cases.id, "case-a"))).rejects.toThrow();
    expect(await db.select().from(events)).toHaveLength(1);
  });

  it("rejects assignment to operators from another organization", async () => {
    const { db, close } = await createDatabase({ memory: true });
    closes.push(close);
    await db.insert(organizations).values([
      { id: "a", name: "CAF Esempio A", kind: "caf" },
      { id: "b", name: "CAF Esempio B", kind: "caf" },
    ]);
    await db.insert(offices).values({
      id: "office-a",
      organizationId: "a",
      slug: "office-a",
      name: "Sede",
      address: "Via Esempio",
      city: "Milano",
    });
    await db.insert(operators).values({
      id: "operator-b",
      organizationId: "b",
      name: "Operatore",
      email: "operator@example.invalid",
      passwordHash: "unused",
      role: "operator",
    });
    await expect(
      db.insert(cases).values({
        id: "case-a",
        organizationId: "a",
        officeId: "office-a",
        assigneeId: "operator-b",
        tokenHash: "hash",
        reference: "AV-2027-000001",
        language: "it",
        createdAt: "2027-01-01T00:00:00.000Z",
        updatedAt: "2027-01-01T00:00:00.000Z",
        expiresAt: "2027-03-01T00:00:00.000Z",
      }),
    ).rejects.toThrow();
  });
});
