import { DsuSheet } from "@avanti/contracts";
import { cases, createDatabase, repoRoot } from "@avanti/db";
import { eq } from "drizzle-orm";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { seedDemo } from "../../db/src/demo";
import { dossierView } from "./dossier";

it("keeps the ready demo DSU proof aligned with the operator dossier", async () => {
  const database = await createDatabase({ memory: true });
  const uploadsDir = await mkdtemp(join(tmpdir(), "avanti-dsu-demo-"));
  let nextId = 0;
  const uuid = vi
    .spyOn(crypto, "randomUUID")
    .mockImplementation(() => `00000000-0000-4000-8000-${String(++nextId).padStart(12, "0")}`);
  try {
    const now = new Date("2027-01-15T10:00:00Z");
    await seedDemo(database.db, { now, uploadsDir });
    const [row] = await database.db.select().from(cases).where(eq(cases.id, "demo-case-9"));
    expect(row?.status).toBe("ready");
    const dossier = await dossierView(database.db, row!, now);
    const sheet = DsuSheet.parse(dossier.dsuSheet);
    const missing = sheet.sections
      .flatMap((section) => section.rows)
      .filter((field) => field.source.kind === "missing");
    expect(missing).toHaveLength(29);
    expect(
      sheet.sections
        .flatMap((section) => section.rows)
        .filter((field) => field.value === "Nessuno"),
    ).toHaveLength(30);
    const proofPath = process.env.AVANTI_DSU_PROOF_PATH;
    if (proofPath) {
      await writeFile(proofPath, JSON.stringify(sheet, null, 2) + "\n");
    } else {
      const proof = JSON.parse(
        await readFile(join(repoRoot, "docs/verification/dsu-sheet-demo.json"), "utf8"),
      );
      expect(sheet).toEqual(proof);
    }
  } finally {
    uuid.mockRestore();
    await database.close();
    await rm(uploadsDir, { recursive: true, force: true });
  }
});
