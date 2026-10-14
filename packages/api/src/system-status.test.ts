import { mfaCipher } from "./mfa";
import { defaultNotifications, seal } from "./notification-config";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { SystemStatus, ApiError } from "@avanti/contracts";
import {
  cases,
  createDatabase,
  documents,
  notifications,
  events,
  offices,
  operators,
  organizations,
  sessions,
  operationalCounters,
  systemJobs,
  storageDeletions,
  type Database,
} from "@avanti/db";
import { eq } from "drizzle-orm";
import { createApp } from "./app";
import { GatewayIntelligence } from "./ai";
import { MemoryStorage } from "./storage";
import { hashToken, newToken } from "./security";
import { aiStatus, countStatus, jobStatus, worstStatus } from "./system-status";
import { observeAi, recordOperationalCounters, utcHour } from "./operational-telemetry";
import type { Services } from "./context";
import * as erasure from "./case-erasure";
import { analyzePendingDocument } from "./document-analysis";
import { sendNotifications } from "./notifications";
import { ConsoleEmail } from "./email";
import { readFile } from "node:fs/promises";

vi.mock("ai", async () => ({
  ...(await vi.importActual<typeof import("ai")>("ai")),
  generateText: vi.fn(),
}));
import { generateText } from "ai";

let db: Database;
let close: () => Promise<void>;
let now: Date;
let services: Services;
let app: ReturnType<typeof createApp>;
let admin: string;
let normal: string;
let foreign: string;
beforeAll(async () => {
  ({ db, close } = await createDatabase({ memory: true }));
});
afterAll(async () => {
  await close?.();
});
beforeEach(async () => {
  vi.restoreAllMocks();
  vi.mocked(generateText).mockReset();
  now = new Date("2027-06-01T10:30:00.000Z");
  await db.delete(notifications);
  await db.delete(events);
  await db.delete(cases);
  await db.delete(offices);
  await db.delete(organizations);
  await db.delete(systemJobs);
  await db.delete(storageDeletions);
  for (const id of ["a", "b"]) {
    await db.insert(organizations).values({ id, name: "Private CAF", kind: "caf" });
    await db.insert(offices).values({
      id,
      organizationId: id,
      slug: id,
      name: "Private office",
      address: "Private address",
      city: "Roma",
    });
  }
  for (const [id, org, role] of [
    ["admin", "a", "admin"],
    ["normal", "a", "operator"],
    ["foreign", "b", "admin"],
  ] as const) {
    await db.insert(operators).values({
      id,
      organizationId: org,
      name: "Private admin",
      email: `${id}@secret.test`,
      passwordHash: "secret-password-hash",
      role,
    });
  }
  async function cookie(operatorId: string) {
    const token = newToken();
    await db.insert(sessions).values({
      id: operatorId,
      operatorId,
      tokenHash: hashToken(token),
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 3600000).toISOString(),
    });
    return `avanti_session=${token}`;
  }
  [admin, normal, foreign] = await Promise.all([
    cookie("admin"),
    cookie("normal"),
    cookie("foreign"),
  ]);
  services = {
    db,
    storage: new MemoryStorage(),
    ai: new GatewayIntelligence(),
    clock: () => now,
    publicUrl: "http://localhost:3400",
    production: false,
    cronSecret: "secret-cron",
    errorLogger: vi.fn(),
    notifications: defaultNotifications(),
    mfa: mfaCipher({ key: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" }),
  };
  app = createApp(services);
});
function request(cookie = admin, path = "/api/status", target = app) {
  return target.request(path, { headers: cookie ? { Cookie: cookie } : {} });
}
async function status(cookie = admin, target = app) {
  const response = await request(cookie, "/api/status", target);
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  return SystemStatus.parse(await response.json());
}
async function fixture(id: string, extra: Partial<typeof cases.$inferInsert> = {}) {
  const token = newToken();
  await db.insert(cases).values({
    id,
    organizationId: "a",
    officeId: "a",
    tokenHash: hashToken(token),
    reference: `PRIVATE-${id}`,
    language: "it",
    status: "intake",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: "2027-07-01Z",
    contact: { firstName: "PII-NAME", email: "citizen@secret.test" },
    citizenNote: "PII-TEXT",
    ...extra,
  });
  return token;
}
async function document(caseId: string, id: string, uploadedAt: string) {
  const key = `${caseId}/${id}`;
  await services.storage.put(key, new Uint8Array([1, 2]), "image/png");
  await db.insert(documents).values({
    id,
    caseId,
    fileName: "PII-DOCUMENT.png",
    mimeType: "image/png",
    sizeBytes: 2,
    storageKey: key,
    sha256: "secret-sha",
    uploadedAt,
    status: "processing",
  });
}
const cron = (target = app) =>
  target.request("/api/cron/maintenance", { headers: { Authorization: "Bearer secret-cron" } });

async function notification(id: string, extra: Partial<typeof notifications.$inferInsert> = {}) {
  await db.insert(notifications).values({
    id,
    dedupeKey: `PRIVATE-${id}`,
    kind: "citizen_request",
    language: "it",
    organizationId: "a",
    createdAt: now.toISOString(),
    nextAttemptAt: now.toISOString(),
    envelope: seal(services.notifications, `${id}:citizen_request:it`, {
      to: "citizen@secret.test",
      from: "sender@secret.test",
      subject: "PII-SUBJECT",
      text: "PII-BODY",
    }),
    lastError: "PII-PROVIDER-ERROR citizen@secret.test",
    ...extra,
  });
}

it("counts email only for the authenticated CAF at exact age and rolling 24-hour boundaries", async () => {
  const send = vi.fn();
  services.notifications.adapter = { mode: "resend", send };
  const hourAgo = new Date(now.getTime() - 3600000).toISOString();
  const older = new Date(now.getTime() - 3600001).toISOString();
  const dayAgo = new Date(now.getTime() - 86400000).toISOString();
  const outside = new Date(now.getTime() - 86400001).toISOString();
  await notification("pending", { createdAt: older });
  await notification("sending", {
    state: "sending",
    createdAt: older,
    nextAttemptAt: "2027-06-02T10:30:00Z",
  });
  await notification("hour-boundary", { createdAt: hourAgo });
  await notification("failed-boundary", { state: "failed", completedAt: dayAgo });
  await notification("failed-now", { state: "failed", completedAt: now.toISOString() });
  await notification("sent-boundary", { state: "sent", completedAt: dayAgo });
  await notification("sent-now", { state: "sent", completedAt: now.toISOString() });
  for (const state of ["sent", "failed"] as const) {
    await notification(`${state}-old`, { state, completedAt: outside });
    await notification(`${state}-future`, { state, completedAt: "2027-06-01T10:30:00.001Z" });
    await notification(`${state}-foreign`, {
      state,
      organizationId: "b",
      completedAt: now.toISOString(),
    });
    await notification(`${state}-lead`, {
      state,
      organizationId: null,
      kind: "pilot_lead",
      completedAt: now.toISOString(),
    });
  }
  await notification("foreign-queue", { organizationId: "b", createdAt: older });
  await notification("lead-queue", { organizationId: null, kind: "pilot_lead", createdAt: older });
  for (const state of ["cancelled", "simulated"] as const)
    await notification(state, { state, createdAt: older, completedAt: now.toISOString() });
  const result = await status();
  expect(result.components.email).toEqual({
    provider: "resend",
    status: "attention",
    code: "email_failed",
    queuedOver1Hour: 2,
    failed24Hours: 2,
    sent24Hours: 2,
  });
  expect(result.counters.notificationsQueued).toEqual({
    count: 3,
    status: "attention",
    code: "backlog",
  });
  expect((await status(foreign)).components.email).toMatchObject({
    queuedOver1Hour: 1,
    failed24Hours: 1,
    sent24Hours: 1,
  });
  expect(JSON.stringify(result)).not.toMatch(
    /PII-|PRIVATE-|secret|@|envelope|lastError|dedupeKey|organizationId|subject/,
  );
  expect(send).not.toHaveBeenCalled();
});

it.each(["pending", "failed"] as const)(
  "classifies email %s thresholds through the endpoint",
  async (state) => {
    services.notifications.adapter = { mode: "resend", send: vi.fn() };
    expect((await status()).components.email).toMatchObject({ status: "ok", code: "available" });
    for (let count = 1; count <= 5; count++) {
      await notification(`threshold-${count}`, {
        state,
        createdAt: "2027-06-01T09:29:59Z",
        completedAt: state === "failed" ? now.toISOString() : null,
      });
      const result = await status();
      expect(result.components.email).toMatchObject({
        status: count < 5 ? "attention" : "problem",
        code: state === "failed" ? "email_failed" : "email_backlog",
        [state === "failed" ? "failed24Hours" : "queuedOver1Hour"]: count,
      });
      if (count === 5) expect(result.status).toBe("problem");
    }
    // A severe backlog takes priority over a smaller number of failed sends.
    if (state === "pending") {
      await notification("one-failure", { state: "failed", completedAt: now.toISOString() });
      expect((await status()).components.email.code).toBe("email_backlog");
    }
  },
);

it("reports console simulation without real sends and does not flag a fresh queue as backlog", async () => {
  const logger = vi.fn();
  services.notifications.adapter = new ConsoleEmail(logger);
  for (let index = 0; index < 5; index++) await notification(`fresh-${index}`);
  expect((await status()).counters.notificationsQueued).toEqual({
    count: 5,
    status: "ok",
    code: "available",
  });
  expect(await sendNotifications(services, now)).toBe(5);
  expect(logger).toHaveBeenCalledTimes(5);
  const result = await status();
  expect(result.components.email).toEqual({
    provider: "console",
    status: "attention",
    code: "email_simulated",
    queuedOver1Hour: 0,
    failed24Hours: 0,
    sent24Hours: 0,
  });
  expect(result.counters.notificationsQueued.count).toBe(0);
  expect((await db.select().from(notifications)).every((row) => row.state === "simulated")).toBe(
    true,
  );
  for (let index = 0; index < 5; index++)
    await notification(`failed-${index}`, { state: "failed", completedAt: now.toISOString() });
  expect((await status()).components.email).toMatchObject({
    status: "problem",
    code: "email_failed",
  });
});

it("validates the documented status example against the current contract", async () => {
  const example = JSON.parse(
    await readFile(
      new URL("../../../docs/verification/system-status-example.json", import.meta.url),
      "utf8",
    ),
  );
  expect(SystemStatus.safeParse(example).success).toBe(true);
});

it("requires a live admin session; capabilities, operators and temporary passwords cannot access status", async () => {
  expect((await request("")).status).toBe(401);
  const rejected = await request(normal);
  expect(rejected.status).toBe(403);
  expect(ApiError.parse(await rejected.json()).error.code).toBe("forbidden");
  expect((await request("", "/api/status", createApp(services))).status).toBe(401);
  expect((await request(admin, "/api/status?organizationId=b")).status).toBe(400);
  await db.update(operators).set({ mustChangePassword: true }).where(eq(operators.id, "admin"));
  expect((await request()).status).toBe(403);
  await db
    .update(operators)
    .set({ mustChangePassword: false, active: false })
    .where(eq(operators.id, "admin"));
  expect((await request()).status).toBe(401);
});

it("reports never-run jobs and unconfigured AI without contacting the provider", async () => {
  const result = await status();
  expect(result.status).toBe("attention");
  expect(result.components.maintenance).toMatchObject({
    status: "attention",
    code: "never_run",
    outcome: null,
  });
  expect(result.components.retention.code).toBe("never_run");
  expect(result.components.ai).toMatchObject({
    configured: false,
    mode: "fallback",
    code: "not_configured",
  });
  expect(result.counters.notificationsQueued).toEqual({
    count: 0,
    status: "ok",
    code: "available",
  });
  expect(result.components.email).toEqual({
    provider: "console",
    status: "attention",
    code: "email_simulated",
    queuedOver1Hour: 0,
    failed24Hours: 0,
    sent24Hours: 0,
  });
  expect(generateText).not.toHaveBeenCalled();
});

it("counts only this CAF with strict time boundaries, including waiting age preserved through note edits", async () => {
  await fixture("old", { status: "needs_citizen", expiresAt: "2027-06-08T10:30:00Z" });
  await document("old", "old-doc", "2027-06-01T10:19:59Z");
  await db.insert(events).values({
    id: "requested",
    organizationId: "a",
    caseId: "old",
    actor: "operator",
    type: "case.requested",
    at: "2027-05-25T10:29:59Z",
  });
  await fixture("boundary", {
    status: "needs_citizen",
    updatedAt: "2027-05-25T10:30:00Z",
    expiresAt: "2027-06-08T10:30:00.001Z",
  });
  await document("boundary", "boundary-doc", "2027-06-01T10:20:00Z");
  await fixture("expired", { expiresAt: now.toISOString() });
  await fixture("closed", { status: "closed", expiresAt: "2027-06-02Z" });
  await fixture("foreign", {
    organizationId: "b",
    officeId: "b",
    status: "needs_citizen",
    updatedAt: "2027-05-01Z",
    expiresAt: "2027-06-02Z",
  });
  await document("foreign", "foreign-doc", "2027-05-01Z");
  await recordOperationalCounters(services, "b", ["ai_error", "api_error"]);
  const result = await status();
  expect(result.counters.documentsProcessingOver10Minutes.count).toBe(1);
  expect(result.counters.casesWaitingForCitizenOver7Days.count).toBe(1);
  expect(result.counters.linksExpiringWithin7Days.count).toBe(1);
  expect(result.counters.recentApiErrors24Hours.count).toBe(0);
  expect(result.components.ai.hourly?.every((h) => h.errors === 0)).toBe(true);
  const other = await status(foreign);
  expect(other.counters.recentApiErrors24Hours.count).toBe(1);
  expect(other.counters.documentsProcessingOver10Minutes.count).toBe(1);
  const output = JSON.stringify(result);
  expect(output).not.toMatch(
    /PII-|PRIVATE-|secret|citizen@|password|storageKey|tokenHash|organizationId/,
  );
});

it("observes real fallback intake calls, survives an app restart, and separates tenants/hours", async () => {
  const token = await fixture("intake");
  const turn = (target = app) =>
    target.request(`/api/c/${token}/turn`, {
      method: "POST",
      headers: { Origin: services.publicUrl, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "text", text: "Devo fare ISEE" }),
    });
  expect((await turn()).status).toBe(200);
  expect((await status()).components.ai.hourly?.at(-1)).toMatchObject({ fallbacks: 1, errors: 0 });
  expect(generateText).not.toHaveBeenCalled();
  services.ai = new GatewayIntelligence({ key: "secret-key", logger: vi.fn() });
  const restarted = createApp(services);
  vi.mocked(generateText).mockRejectedValue(new Error("PII-PROVIDER secret-key"));
  expect((await turn(restarted)).status).toBe(200);
  expect((await status(admin, restarted)).components.ai).toMatchObject({
    configured: true,
    code: "ai_errors",
    status: "attention",
  });
  expect((await status(admin, restarted)).components.ai.hourly?.at(-1)).toMatchObject({
    fallbacks: 2,
    errors: 1,
  });
  await db.update(sessions).set({ expiresAt: "2027-06-01T12:00:00Z" });
  now = new Date("2027-06-01T11:00:00Z");
  await observeAi(services, "a", () => services.ai.translate("PII-TEXT", "en"));
  const newer = await status(admin, restarted);
  expect(newer.components.ai.hourly?.at(-1)).toMatchObject({
    hour: utcHour(now),
    fallbacks: 1,
    errors: 1,
  });
  expect(newer.components.ai.hourly?.at(-2)).toMatchObject({ fallbacks: 2, errors: 1 });
  expect(JSON.stringify(newer)).not.toMatch(/PII-|secret-key|PROVIDER/);
});

it("observes document fallback and counts exceptions without depending on the instance fallback counter", async () => {
  await fixture("doc");
  await document("doc", "document", "2027-06-01T10:00:00Z");
  services.ai = new GatewayIntelligence({ key: "secret-key", logger: vi.fn() });
  vi.mocked(generateText).mockRejectedValue(new Error("private provider diagnostic"));
  await analyzePendingDocument(services, "document");
  expect((await status(admin, createApp(services))).components.ai.hourly?.at(-1)).toMatchObject({
    fallbacks: 1,
    errors: 1,
  });
  await expect(
    observeAi(services, "a", async () => {
      throw new Error("private exception");
    }),
  ).rejects.toThrow("private exception");
  await recordOperationalCounters(services, "a", ["ai_error"]);
  await recordOperationalCounters(services, "a", ["ai_error"]);
  await recordOperationalCounters(services, "a", ["ai_error"]);
  expect((await status(admin, createApp(services))).components.ai.status).toBe("problem");
});

it("atomically increments hourly counts and omits old/future buckets", async () => {
  await Promise.all(
    Array.from({ length: 20 }, () => recordOperationalCounters(services, "a", ["ai_success"])),
  );
  await db.insert(operationalCounters).values([
    { organizationId: "a", hour: "2027-05-31T10:00:00Z", metric: "ai_error", count: 999 },
    { organizationId: "a", hour: "2027-06-01T11:00:00Z", metric: "ai_error", count: 999 },
  ]);
  services.ai = new GatewayIntelligence({ key: "configured" });
  const result = await status(admin, createApp(services));
  expect(result.components.ai.hourly?.at(-1)?.successes).toBe(20);
  expect(result.components.ai.status).toBe("ok");
});

it("records completion even with zero deletions; the persistent cron gate survives an instance restart", async () => {
  await db
    .insert(operationalCounters)
    .values({ organizationId: "a", hour: "2027-05-20Z", metric: "ai_fallback", count: 10 });
  expect((await cron()).status).toBe(200);
  const result = await status();
  expect(result.components.maintenance).toMatchObject({
    status: "ok",
    code: "available",
    outcome: "ok",
    lastFinishedAt: now.toISOString(),
  });
  expect(result.components.retention.outcome).toBe("ok");
  expect(await db.select().from(operationalCounters)).toHaveLength(0);
  expect(await (await cron(createApp(services))).json()).toMatchObject({ skipped: true });
  expect((await app.request("/api/cron/maintenance")).status).toBe(401);
});

it("persists maintenance/retention failures without internal diagnostics and holds off retries after failure", async () => {
  vi.spyOn(erasure, "purgeRetainedCases").mockRejectedValue(
    new Error("PII-RETENTION secret-db-password"),
  );
  const response = await cron();
  expect(response.status).toBe(500);
  expect(await response.text()).not.toMatch(/PII-|secret-db/);
  const result = await status();
  expect(result.components.maintenance).toMatchObject({
    status: "problem",
    outcome: "failed",
    code: "failed",
  });
  expect(result.components.retention.outcome).toBe("failed");
  expect(await (await cron(createApp(services))).json()).toMatchObject({ skipped: true });
});

it("flags deferred file-deletion failures until a later maintenance retry succeeds", async () => {
  await fixture("retained", { expiresAt: "2026-01-01Z" });
  await document("retained", "retained-doc", "2026-01-01Z");
  services.storageLogger = vi.fn();
  const original = services.storage.delete.bind(services.storage);
  const deletion = vi
    .spyOn(services.storage, "delete")
    .mockRejectedValueOnce(new Error("secret-storage-diagnostic"));
  app = createApp(services);
  expect((await cron()).status).toBe(200);
  const failed = await status();
  expect(failed.components.retention).toMatchObject({ outcome: "failed", status: "problem" });
  expect(failed.components.maintenance.outcome).toBe("failed");
  expect(await db.select().from(storageDeletions)).toHaveLength(1);
  expect(JSON.stringify(failed)).not.toContain("secret-storage-diagnostic");
  deletion.mockImplementation(original);
  now = new Date(now.getTime() + 61000);
  expect((await cron()).status).toBe(200);
  expect((await status()).components.retention.outcome).toBe("ok");
  expect(await db.select().from(storageDeletions)).toHaveLength(0);
});

it("isolates failed storage probes, coalesces callers, and strips malformed app version metadata", async () => {
  await fixture("secret");
  const probe = vi
    .spyOn(services.storage, "health")
    .mockRejectedValue(new Error("secret-storage-token PII-NAME"));
  services.appVersion = { commit: "secret-credential", tag: "PII-TEXT" };
  app = createApp(services);
  const results = await Promise.all([status(), status()]);
  expect(probe).toHaveBeenCalledTimes(1);
  expect(results[0]?.components.database.status).toBe("ok");
  expect(results[0]?.components.storage).toEqual({ status: "problem", code: "unavailable" });
  expect(results[0]?.status).toBe("problem");
  expect(results[0]?.version).toEqual({ commit: null, tag: null });
  expect(JSON.stringify(results)).not.toMatch(/secret-|PII-|passwordHash|storageKey/);
  services.appVersion = { commit: "abcdef1234567890", tag: "v0.1.0" };
  expect((await status(admin, createApp(services))).version).toEqual(services.appVersion);
});

it("does not claim zero backlog when the authenticated status snapshot fails", async () => {
  vi.spyOn(db, "transaction").mockRejectedValue(new Error("secret-query"));
  const result = await status();
  expect(result.components.database.code).toBe("unavailable");
  expect(result.components.maintenance.code).toBe("unavailable");
  expect(result.components.ai.hourly).toBeNull();
  expect(result.counters.documentsProcessingOver10Minutes.count).toBeNull();
  expect(result.components.email).toEqual({
    provider: "console",
    status: "problem",
    code: "unavailable",
    queuedOver1Hour: null,
    failed24Hours: null,
    sent24Hours: null,
  });
  expect(result.counters.notificationsQueued.count).toBeNull();
  expect(JSON.stringify(result)).not.toContain("secret-query");
});

it("counts only authenticated tenant server errors with no request contents", async () => {
  app.get("/cases/test-failure/diagnostic", () => {
    throw new Error("PII-TEXT secret-stack");
  });
  expect((await request(admin, "/api/cases/test-failure/diagnostic")).status).toBe(500);
  expect((await status()).counters.recentApiErrors24Hours.count).toBe(1);
  expect((await status(foreign)).counters.recentApiErrors24Hours.count).toBe(0);
});

it("classifies all count thresholds, job ages and abandoned runs at exact boundaries", () => {
  for (const limit of [5, 10]) {
    expect(countStatus(0, limit).status).toBe("ok");
    expect(countStatus(limit - 1, limit).status).toBe("attention");
    expect(countStatus(limit, limit).status).toBe("problem");
    expect(countStatus(null, limit)).toMatchObject({
      count: null,
      code: "unavailable",
      status: "problem",
    });
  }
  const job = (age: number, outcome: "ok" | "running" = "ok") =>
    jobStatus(
      {
        kind: "maintenance",
        runId: "run",
        startedAt: new Date(now.getTime() - age).toISOString(),
        finishedAt: outcome === "ok" ? new Date(now.getTime() - age).toISOString() : null,
        outcome,
      },
      now,
    );
  expect(job(26 * 3600000 - 1).status).toBe("ok");
  expect(job(26 * 3600000).status).toBe("attention");
  expect(job(48 * 3600000).status).toBe("problem");
  expect(job(599999, "running").code).toBe("running");
  expect(job(600000, "running").code).toBe("stale");
  expect(worstStatus(["ok", "attention", "problem"])).toBe("problem");
  const empty = Array.from({ length: 24 }, () => ({
    hour: utcHour(now),
    successes: 0,
    fallbacks: 0,
    errors: 0,
  }));
  expect(aiStatus(true, empty)).toMatchObject({
    code: "no_observations",
    mode: "unknown",
    status: "attention",
  });
  empty[23] = { hour: utcHour(now), successes: 0, fallbacks: 0, errors: 1 };
  expect(aiStatus(true, empty)).toMatchObject({ code: "ai_errors", mode: "unknown" });
  empty[23] = { hour: utcHour(now), successes: 1, fallbacks: 1, errors: 1 };
  expect(aiStatus(true, empty)).toMatchObject({
    code: "ai_errors",
    mode: "unknown",
    status: "attention",
  });
});

it("marks missing or timed-out storage probes without changing database health", async () => {
  const memory = new MemoryStorage();
  services.storage = {
    put: memory.put.bind(memory),
    get: memory.get.bind(memory),
    delete: memory.delete.bind(memory),
  };
  expect((await status(admin, createApp(services))).components.storage).toEqual({
    status: "attention",
    code: "probe_unavailable",
  });
  services.storage.health = () => new Promise(() => {});
  expect((await status(admin, createApp(services))).components.storage).toEqual({
    status: "problem",
    code: "unavailable",
  });
});

it("claims only one concurrent cron and reclaims an abandoned run at ten minutes", async () => {
  const responses = await Promise.all([cron(), cron(createApp(services))]);
  const results = await Promise.all(responses.map((r) => r.json()));
  expect(results.filter((r) => r.skipped)).toHaveLength(1);
  expect(results.filter((r) => r.deletedCases === 0)).toHaveLength(1);
  await db
    .update(systemJobs)
    .set({
      outcome: "running",
      finishedAt: null,
      startedAt: new Date(now.getTime() - 599999).toISOString(),
    })
    .where(eq(systemJobs.kind, "maintenance"));
  expect(await (await cron()).json()).toMatchObject({ skipped: true });
  await db
    .update(systemJobs)
    .set({ startedAt: new Date(now.getTime() - 600000).toISOString() })
    .where(eq(systemJobs.kind, "maintenance"));
  expect(await (await cron()).json()).toMatchObject({ deletedCases: 0 });
});
