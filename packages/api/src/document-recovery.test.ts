import { mfaCipher } from "./mfa";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  createDatabase,
  cases,
  documents,
  offices,
  operators,
  organizations,
  sessions,
  type Database,
} from "@avanti/db";
import { createApp } from "./app";
import { GatewayIntelligence, heuristicAnalysis } from "./ai";
import { MemoryStorage } from "./storage";
import { hashToken, newToken } from "./security";
import {
  analyzePendingDocument,
  ANALYSIS_LEASE_MS,
  recoverDocumentAnalysis,
} from "./document-analysis";
import type { Services } from "./context";

let db: Database, close: () => Promise<void>;
let now = new Date("2027-01-01T10:00:00Z");
const token = newToken(),
  operatorToken = newToken();
const storage = new MemoryStorage(),
  ai = new GatewayIntelligence();
const jobs: (() => Promise<void>)[] = [];
let app: ReturnType<typeof createApp>, services: Services;
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
  await db.insert(operators).values({
    id: "operator",
    organizationId: "org",
    role: "operator",
    name: "Esempio",
    email: "operator@example.test",
    passwordHash: "unused",
  });
  await db.insert(sessions).values({
    id: "session",
    operatorId: "operator",
    tokenHash: hashToken(operatorToken),
    createdAt: now.toISOString(),
    expiresAt: "2027-01-01T12:00:00Z",
  });
  for (const id of ["case", "other"])
    await db.insert(cases).values({
      id,
      organizationId: "org",
      officeId: "office",
      tokenHash: id === "case" ? hashToken(token) : "other-token",
      reference: id,
      language: "it",
      practiceId: "isee_ordinario",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: "2027-03-01T00:00:00Z",
    });
  services = {
    db,
    storage,
    ai,
    clock: () => now,
    publicUrl: "http://localhost:3400",
    production: false,
    mfa: mfaCipher({ key: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" }),
    background: (job) => jobs.push(job),
  };
  app = createApp(services);
});
afterAll(async () => {
  await close?.();
});
async function pending(
  id: string,
  caseId = "case",
  uploadedAt = new Date(now.getTime() - ANALYSIS_LEASE_MS - 1).toISOString(),
) {
  const key = await storage.put(id, new Uint8Array([1]));
  await db.insert(documents).values({
    id,
    caseId,
    fileName: "ESEMPIO.pdf",
    mimeType: "application/pdf",
    sha256: "a".repeat(64),
    sizeBytes: 1,
    uploadedAt,
    storageKey: key,
    status: "processing",
  });
}
it("citizen and operator reads return processing then recover only the opened case in background", async () => {
  await pending("citizen-doc");
  await pending("other-doc", "other");
  const before = (await db.select().from(cases).where(eq(cases.id, "case")))[0];
  const response = await app.request(`/api/c/${token}`);
  expect(response.status).toBe(200);
  expect((await response.json()).documents[0].status).toBe("processing");
  await jobs.shift()!();
  expect(
    (await db.select().from(documents).where(eq(documents.id, "citizen-doc")))[0]?.status,
  ).toBe("analyzed");
  expect((await db.select().from(documents).where(eq(documents.id, "other-doc")))[0]?.status).toBe(
    "processing",
  );
  await pending("operator-doc");
  expect(
    (
      await app.request("/api/cases/case", {
        headers: { Cookie: `avanti_session=${operatorToken}` },
      })
    ).status,
  ).toBe(200);
  await jobs.shift()!();
  expect(
    (await db.select().from(documents).where(eq(documents.id, "operator-doc")))[0]?.status,
  ).toBe("analyzed");
  const after = (await db.select().from(cases).where(eq(cases.id, "case")))[0]!;
  expect({ ...after, updatedAt: before!.updatedAt }).toEqual(before);
  expect(Date.parse(after.updatedAt)).toBeGreaterThan(Date.parse(before!.updatedAt));
  expect((await app.request("/api/cases/other")).status).toBe(401);
  expect(jobs).toHaveLength(0);
});
it("fresh documents and valid leases are skipped; duplicate workers have a single AI invocation", async () => {
  await pending("fresh", "case", now.toISOString());
  await pending("leased");
  await db
    .update(documents)
    .set({
      analysisLeaseToken: "existing-worker",
      analysisLeaseUntil: new Date(now.getTime() + ANALYSIS_LEASE_MS).toISOString(),
    })
    .where(eq(documents.id, "leased"));
  const analyze = vi.spyOn(ai, "analyze");
  await recoverDocumentAnalysis(services, "case");
  expect(analyze).not.toHaveBeenCalled();
  await pending("concurrent");
  let release!: () => void, ready!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    ready = resolve;
  });
  analyze.mockImplementationOnce(async () => {
    ready();
    await wait;
    return heuristicAnalysis("ESEMPIO.pdf", []);
  });
  try {
    const first = analyzePendingDocument(services, "concurrent");
    await started;
    await Promise.all([
      analyzePendingDocument(services, "concurrent"),
      recoverDocumentAnalysis(services, "case"),
    ]);
    expect(analyze).toHaveBeenCalledTimes(1);
    release();
    await first;
    await analyzePendingDocument(services, "concurrent");
    expect(analyze).toHaveBeenCalledTimes(1);
  } finally {
    release();
    analyze.mockRestore();
  }
});
it("storage failure retains backoff lease, expired workers cannot overwrite a newer analysis", async () => {
  await pending("failed-storage");
  const get = vi.spyOn(storage, "get").mockRejectedValueOnce(new Error("private-storage-failure"));
  await recoverDocumentAnalysis(services, "case");
  const failed = (await db.select().from(documents).where(eq(documents.id, "failed-storage")))[0]!;
  expect(failed.status).toBe("processing");
  expect(failed.analysisLeaseToken).toBeTruthy();
  await recoverDocumentAnalysis(services, "case");
  expect(get).toHaveBeenCalledTimes(1);
  get.mockRestore();
  await pending("late");
  let release!: () => void, ready!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    ready = resolve;
  });
  const analyze = vi.spyOn(ai, "analyze").mockImplementationOnce(async () => {
    ready();
    await waiting;
    return { ...heuristicAnalysis("ESEMPIO.pdf", []), detectedLabel: "stale" };
  });
  try {
    const old = analyzePendingDocument(services, "late");
    await started;
    now = new Date(now.getTime() + ANALYSIS_LEASE_MS + 1);
    await analyzePendingDocument(services, "late");
    release();
    await old;
    expect(
      (await db.select().from(documents).where(eq(documents.id, "late")))[0]?.analysis
        ?.detectedLabel,
    ).not.toBe("stale");
    await recoverDocumentAnalysis(services, "case");
    expect(
      (await db.select().from(documents).where(eq(documents.id, "failed-storage")))[0]?.status,
    ).toBe("analyzed");
  } finally {
    release();
    analyze.mockRestore();
  }
});
it("a case closed during analysis does not become analyzed and deleted rows stay deleted", async () => {
  await pending("closed-during-analysis");
  const analyze = vi.spyOn(ai, "analyze").mockImplementationOnce(async () => {
    await db.update(cases).set({ status: "closed" }).where(eq(cases.id, "case"));
    return heuristicAnalysis("ESEMPIO.pdf", []);
  });
  await analyzePendingDocument(services, "closed-during-analysis");
  expect(
    (await db.select().from(documents).where(eq(documents.id, "closed-during-analysis")))[0]
      ?.status,
  ).toBe("failed");
  analyze.mockRestore();
  await db.delete(documents).where(eq(documents.id, "closed-during-analysis"));
  await analyzePendingDocument(services, "closed-during-analysis");
  expect(
    await db.select().from(documents).where(eq(documents.id, "closed-during-analysis")),
  ).toEqual([]);
});
