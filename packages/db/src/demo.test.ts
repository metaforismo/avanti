import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import { createDatabase } from "./client";
import { seedDemo } from "./demo";
import { cases, documents, events, operators } from "./schema";

it("seed is idempotent, creates safe PDFs, and preserves operator edits", async () => {
  const { db, close } = await createDatabase({ memory: true });
  const uploadsDir = await mkdtemp(join(tmpdir(), "avanti-demo-"));
  try {
    const options = { now: new Date("2027-01-15T10:00:00Z"), uploadsDir };
    expect(await seedDemo(db, options)).toEqual({ created: 10 });
    const before = await db.select().from(operators);
    await db
      .update(cases)
      .set({ internalNotes: "Nota modificata" })
      .where(eq(cases.id, "demo-case-1"));
    expect(await seedDemo(db, options)).toEqual({ created: 0 });
    expect(await db.select().from(cases)).toHaveLength(10);
    expect(await db.select().from(operators)).toEqual(before);
    const [edited] = await db.select().from(cases).where(eq(cases.id, "demo-case-1"));
    expect(edited?.internalNotes).toBe("Nota modificata");
    const [document] = await db.select().from(documents);
    expect(document).toBeDefined();
    const file = await readFile(join(uploadsDir, document!.storageKey));
    expect(file.subarray(0, 4).toString()).toBe("%PDF");
    expect(file.byteLength).toBe(document!.sizeBytes);
    const audit = await db.select().from(events);
    expect(audit.filter((event) => event.type === "citizen.requested")).toHaveLength(2);
    expect(
      audit.every((event) =>
        Object.values(event.metadata).every(
          (value) => value === null || typeof value === "number" || typeof value === "boolean",
        ),
      ),
    ).toBe(true);
  } finally {
    await close();
    await rm(uploadsDir, { recursive: true, force: true });
  }
});
