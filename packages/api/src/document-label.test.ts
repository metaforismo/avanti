import { afterAll, beforeAll, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { requirements } from "@avanti/core";
import {
  createDatabase,
  cases,
  documents,
  offices,
  organizations,
  type Database,
} from "@avanti/db";
import type { DocumentAnalysis } from "@avanti/contracts";
import { heuristicAnalysis } from "./ai";
import { citizenView } from "./dossier";

let db: Database, close: () => Promise<void>;
const now = new Date("2027-01-15T10:00:00Z");

beforeAll(async () => {
  ({ db, close } = await createDatabase({ memory: true }));
  await db.insert(organizations).values({ id: "org", name: "CAF sintetico", kind: "caf" });
  await db.insert(offices).values({
    id: "office",
    organizationId: "org",
    slug: "office",
    name: "Sportello",
    address: "Esempio",
    city: "Roma",
  });
  await db.insert(cases).values({
    id: "case",
    organizationId: "org",
    officeId: "office",
    tokenHash: "token",
    reference: "case",
    language: "ro",
    practiceId: "isee_ordinario",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: "2027-03-01T00:00:00Z",
  });
  const legacy: DocumentAnalysis = {
    ...heuristicAnalysis("identity.pdf", ["identity"]),
    // What heuristic analyses stored before the label stopped carrying the id.
    detectedLabel: "identity",
  };
  const rows: [string, string, DocumentAnalysis][] = [
    ["legacy", "identity.pdf", legacy],
    [
      "fresh",
      "saldo_conto_2025.pdf",
      heuristicAnalysis("saldo_conto_2025.pdf", Object.keys(requirements)),
    ],
    ["unknown", "ESEMPIO.pdf", heuristicAnalysis("ESEMPIO.pdf", Object.keys(requirements))],
    [
      "ai",
      "foto.jpg",
      { ...legacy, engine: "ai", confidence: 0.9, detectedLabel: "Carta d'identità elettronica" },
    ],
  ];
  for (const [id, fileName, analysis] of rows)
    await db.insert(documents).values({
      id,
      caseId: "case",
      fileName,
      mimeType: "application/pdf",
      sha256: id.padEnd(64, "0"),
      sizeBytes: 1,
      uploadedAt: now.toISOString(),
      storageKey: id,
      status: "analyzed",
      analysis,
    });
});
afterAll(async () => {
  await close?.();
});

async function labels(language: "it" | "ro") {
  const [row] = await db.select().from(cases).where(eq(cases.id, "case"));
  const view = await citizenView(db, row!, now, language, true);
  return Object.fromEntries(view.documents.map((d) => [d.id, d.analysis?.detectedLabel ?? null]));
}

it("labels detected types in Italian for the operator, never with the internal id", async () => {
  expect(await labels("it")).toEqual({
    legacy: "Documento d’identità",
    fresh: "Saldo al 31/12/2025 e dati del rapporto",
    unknown: null,
    ai: "Carta d'identità elettronica",
  });
});

it("labels detected types in the citizen's language, without the Italian AI reading", async () => {
  expect(await labels("ro")).toEqual({
    legacy: "Act de identitate",
    fresh: "Sold la 31/12/2025 (saldo) și datele contului",
    unknown: null,
    ai: "Act de identitate",
  });
});

it("keeps the stored analysis untouched", async () => {
  const [stored] = await db.select().from(documents).where(eq(documents.id, "legacy"));
  expect(stored?.analysis?.detectedLabel).toBe("identity");
});
