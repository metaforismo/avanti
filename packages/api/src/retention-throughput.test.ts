import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import {
  cases,
  createDatabase,
  documents,
  events,
  leads,
  offices,
  operators,
  organizations,
  sessions,
  storageDeletions,
  systemJobs,
  type Database,
} from "@avanti/db";
import { SystemStatus } from "@avanti/contracts";
import { createApp } from "./app";
import * as notifications from "./notifications";
import { retryStorageDeletions } from "./storage-cleanup";
import { MemoryStorage } from "./storage";
import { hashToken, newToken } from "./security";
import type { Services } from "./context";

// Postgres only: PGlite runs one transaction at a time, so it cannot hold a lock while the
// cleanup runs. Point at a disposable loopback database whose name ends in _test.
const postgresUrl = process.env.RETENTION_TEST_DATABASE_URL;
if (postgresUrl) {
  const target = new URL(postgresUrl);
  if (!["127.0.0.1", "localhost"].includes(target.hostname) || !target.pathname.endsWith("_test"))
    throw new Error("Retention: serve un database Postgres loopback isolato con suffisso _test");
}

let db: Database;
let close: () => Promise<void>;
let storage: MemoryStorage;
let now: Date;
const admin = `avanti_session=${newToken()}`;

beforeEach(async () => {
  ({ db, close } = await createDatabase({ memory: true }));
  storage = new MemoryStorage();
  now = new Date("2027-06-01T03:00:00Z");
  await db.insert(organizations).values({ id: "org", name: "CAF Esempio", kind: "caf" });
  await db.insert(offices).values({
    id: "office",
    organizationId: "org",
    slug: "sede",
    name: "Sede",
    address: "Via Esempio 1",
    city: "Milano",
  });
  await db.insert(operators).values({
    id: "admin",
    organizationId: "org",
    name: "Admin",
    email: "admin@example.test",
    passwordHash: "unused",
    role: "admin",
  });
  await db.insert(sessions).values({
    id: "admin",
    operatorId: "admin",
    tokenHash: hashToken(admin.split("=")[1]!),
    createdAt: now.toISOString(),
    expiresAt: "2027-06-01T10:00:00Z",
  });
});
afterEach(async () => {
  vi.restoreAllMocks();
  await close();
});
afterAll(() => vi.restoreAllMocks());

function app(overrides: Partial<Services> = {}) {
  return createApp({
    db,
    storage,
    clock: () => now,
    cronSecret: "cron",
    storageLogger: () => {},
    errorLogger: () => {},
    ...overrides,
  });
}
const cron = (target = app()) =>
  target.request("/api/cron/maintenance", { headers: { Authorization: "Bearer cron" } });
async function status(target = app()) {
  const response = await target.request("/api/status", { headers: { Cookie: admin } });
  expect(response.status).toBe(200);
  return SystemStatus.parse(await response.json());
}

/** Expired a year ago: past the default 180-day retention by far. */
async function expiredCases(count: number, filesEach = 0) {
  for (let n = 0; n < count; n++) {
    const id = `case-${n}`;
    await db.insert(cases).values({
      id,
      organizationId: "org",
      officeId: "office",
      reference: `AV-2026-${String(n).padStart(6, "0")}`,
      tokenHash: hashToken(newToken()),
      language: "it",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      expiresAt: "2026-03-01T00:00:00Z",
    });
    for (let f = 0; f < filesEach; f++) {
      const key = `${id}/${f}`;
      await storage.put(key, new Uint8Array([1, 2, 3]));
      await db.insert(documents).values({
        id: `${id}-doc-${f}`,
        caseId: id,
        fileName: "doc.pdf",
        mimeType: "application/pdf",
        sizeBytes: 3,
        storageKey: key,
        sha256: "x",
        uploadedAt: "2026-01-01T00:00:00Z",
        status: "analyzed",
      });
    }
  }
}
async function oldEvents(count: number) {
  await db.execute(sql`insert into events (id, organization_id, actor, type, at, metadata)
    select 'old-' || g, 'org', 'system', 'activity.recorded', '2025-01-01T00:00:00Z', '{}'::jsonb
    from generate_series(1, ${count}) g`);
}
const count = async (table: typeof cases | typeof events | typeof storageDeletions) =>
  (await db.select({ n: sql<number>`count(*)::int` }).from(table))[0]!.n;

it("one run drains more than a batch of dossiers, audit events and files", async () => {
  await expiredCases(30, 4);
  await oldEvents(1100);
  const response = await cron();
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    deletedCases: 30,
    retentionBacklog: false,
  });
  expect(await count(cases)).toBe(0);
  expect(await count(storageDeletions)).toBe(0);
  // Only this run's erasure records remain; the 1,100 old events are gone.
  expect((await db.select().from(events)).every((e) => e.type === "case.retention_deleted")).toBe(
    true,
  );
  await expect(storage.get("case-0/0")).rejects.toThrow();
  await expect(storage.get("case-29/3")).rejects.toThrow();
  const [job] = await db.select().from(systemJobs).where(eq(systemJobs.kind, "retention"));
  expect(job?.outcome).toBe("ok");
});

it("reports a run cut short by its time budget as failed, and the overdue rows on /status", async () => {
  await expiredCases(3);
  let clock = 0;
  // The budget is spent before the first batch: nothing is deleted, the backlog is reported.
  vi.spyOn(performance, "now").mockImplementation(() => (clock += 100_000));
  const response = await cron();
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ deletedCases: 0, retentionBacklog: true });
  vi.restoreAllMocks();
  const result = await status();
  expect(result.components.retention).toMatchObject({ outcome: "failed", status: "problem" });
  expect(result.counters.retentionOverdue).toMatchObject({ count: 3, status: "attention" });
  // The next run, with its full budget, catches up and clears the counter.
  now = new Date(now.getTime() + 11 * 60_000);
  expect((await cron()).status).toBe(200);
  const after = await status();
  expect(after.components.retention.outcome).toBe("ok");
  expect(after.counters.retentionOverdue).toMatchObject({ count: 0, status: "ok" });
});

it("a failing earlier step no longer skips retention", async () => {
  await expiredCases(2);
  vi.spyOn(notifications, "maintainNotifications").mockRejectedValue(new Error("provider down"));
  const response = await cron();
  expect(response.status).toBe(500);
  expect(await count(cases)).toBe(0);
  const jobs = await db.select().from(systemJobs);
  expect(jobs.find((j) => j.kind === "retention")?.outcome).toBe("ok");
  expect(jobs.find((j) => j.kind === "maintenance")?.outcome).toBe("failed");
});

it("deletes pilot applications two years after they arrived, with their outbox rows", async () => {
  const lead = (id: string, createdAt: string) => ({
    id,
    name: "Candidatura di prova",
    organization: "CAF Prova",
    email: `${id}@example.test`,
    privacyAcceptedAt: createdAt,
    createdAt,
  });
  await db
    .insert(leads)
    .values([lead("old", "2025-05-31T03:00:00Z"), lead("recent", "2025-06-02T03:00:00Z")]);
  const response = await cron();
  expect(await response.json()).toMatchObject({ deletedLeads: 1 });
  expect((await db.select().from(leads)).map((l) => l.id)).toEqual(["recent"]);
});

it.skipIf(!postgresUrl)(
  "the cleanup skips a lease an upload is committing, instead of deleting its file",
  async () => {
    await close();
    ({ db, close } = await createDatabase({
      url: postgresUrl!,
      applicationName: "avanti-retention-test",
    }));
    await db.execute(sql`truncate table storage_deletions`);
    await storage.put("org/case/upload", new Uint8Array([1]));
    await db.insert(storageDeletions).values({
      id: "upload:x",
      caseId: "case",
      storageKey: "org/case/upload",
      createdAt: "2027-06-01T02:00:00Z",
      // The 10-minute lease ran out a moment ago.
      nextAttemptAt: "2027-06-01T02:59:59Z",
    });
    const services = { db, storage, clock: () => now } as unknown as Services;
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    let locked!: () => void;
    const lockTaken = new Promise<void>((resolve) => (locked = resolve));
    const upload = db.transaction(async (tx) => {
      await tx
        .select()
        .from(storageDeletions)
        .where(eq(storageDeletions.id, "upload:x"))
        .for("update");
      locked();
      await held;
      // The upload commits its document and consumes the lease.
      await tx.delete(storageDeletions).where(eq(storageDeletions.id, "upload:x"));
    });
    await lockTaken;
    expect(await retryStorageDeletions(services)).toEqual({ attempted: 1, outOfTime: false });
    expect(await storage.get("org/case/upload")).toEqual(new Uint8Array([1]));
    release();
    await upload;
    expect(await db.select().from(storageDeletions)).toEqual([]);
  },
);
