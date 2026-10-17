import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { applyAnswer, nextQuestion, type Answers } from "@avanti/core";
import { StartIntakeResponse } from "@avanti/contracts";
import {
  aiUsage,
  cases,
  createDatabase,
  events,
  notifications,
  offices,
  operators,
  organizations,
  sessions,
  settings,
  usageQuotaAlerts,
  type Database,
} from "@avanti/db";
import { createApp } from "./app";
import { commercialStatus, enqueueUsageAlerts } from "./commercial-usage";
import { MemoryStorage } from "./storage";
import { AiIntelligence } from "./ai";
import { hashToken } from "./security";
import { eraseCase, purgeRetainedCases } from "./case-erasure";
import { defaultNotifications, unseal } from "./notification-config";
import { platformOrg } from "./platform-org";
import { platformUsage, formatPlatformUsage } from "./platform-usage";
import { parsePlatformArgs } from "./platform-cli";
import { mfaCipher } from "./mfa";
import type { Services } from "./context";
import { observeAi } from "./operational-telemetry";
import { loadAiConfig } from "@avanti/ai/config";
import { sendNotifications } from "./notifications";

let db: Database, close: () => Promise<void>, app: ReturnType<typeof createApp>, s: Services;
let now = new Date("2027-01-15T10:00:00Z");
const origin = "http://localhost:3400";
const cookie = (id = "admin") => `avanti_session=${id.padEnd(43, "x")}`;
const submit = { confirmed: true, contact: { firstName: "SYNTHETIC", lastName: "SECRET_CITIZEN" } };
beforeAll(async () => {
  ({ db, close } = await createDatabase({ memory: true }));
});
afterAll(async () => {
  await close();
});
beforeEach(async () => {
  await db.delete(events);
  await db.delete(cases);
  await db.delete(organizations);
  now = new Date("2027-01-15T10:00:00Z");
  for (const org of ["caf-a", "caf-b"]) {
    await db.insert(organizations).values({ id: org, name: "SYNTHETIC", kind: "caf" });
    await db.insert(settings).values({ organizationId: org, monthlyDeliveryCap: 10 });
  }
  for (const [id, org] of [
    ["office-a", "caf-a"],
    ["office-a2", "caf-a"],
    ["office-b", "caf-b"],
  ])
    await db.insert(offices).values({
      id: id!,
      organizationId: org!,
      slug: id!,
      name: "SYNTHETIC",
      address: "SECRET_ADDRESS",
      city: "Roma",
    });
  for (const [id, role, org] of [
    ["admin", "admin", "caf-a"],
    ["op", "operator", "caf-a"],
    ["foreign", "admin", "caf-b"],
  ] as const) {
    await db.insert(operators).values({
      id,
      organizationId: org,
      name: "SECRET_NAME",
      email: `${id}@test.invalid`,
      passwordHash: "unused",
      role,
    });
    await db.insert(sessions).values({
      id,
      operatorId: id,
      tokenHash: hashToken(id.padEnd(43, "x")),
      createdAt: now.toISOString(),
      expiresAt: "2027-12-31T00:00:00Z",
    });
  }
  s = {
    db,
    storage: new MemoryStorage(),
    ai: new AiIntelligence(),
    notifications: defaultNotifications(),
    mfa: mfaCipher({}),
    clock: () => now,
    publicUrl: origin,
    production: false,
    background: () => {},
    errorLogger: () => {},
  };
  app = createApp(s);
});
function request(path: string, method = "GET", input?: unknown, actor?: string) {
  return app.request(`/api${path}`, {
    method,
    headers: {
      origin,
      ...(actor ? { cookie: cookie(actor) } : {}),
      ...(input === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  });
}
async function start(officeSlug = "office-a") {
  const response = await request("/intake", "POST", {
    officeSlug,
    practiceId: "isee_ordinario",
    privacyAccepted: true,
  });
  expect(response.status).toBe(201);
  const intake = StartIntakeResponse.parse(await response.json());
  let answers: Answers = {};
  for (let i = 0; i < 100; i++) {
    const q = nextQuestion("isee_ordinario", answers, "it");
    if (!q) break;
    const value =
      q.kind === "members"
        ? [
            {
              id: "applicant",
              role: "richiedente",
              firstName: "SYNTHETIC",
              lastName: "SECRET_CITIZEN",
            },
          ]
        : q.kind === "yes_no"
          ? false
          : q.kind === "number"
            ? (q.min ?? 0)
            : q.kind === "single_choice"
              ? q.options![0]!.value
              : q.kind === "multi_choice"
                ? []
                : q.kind === "date"
                  ? "2025-01-01"
                  : "SYNTHETIC";
    answers = applyAnswer("isee_ordinario", answers, q.id, value, "it", now);
  }
  expect(nextQuestion("isee_ordinario", answers, "it")).toBeNull();
  await db
    .update(cases)
    .set({ answers, confirmedAnswers: Object.keys(answers) })
    .where(eq(cases.id, intake.case.id));
  return intake;
}
async function deliver(officeSlug = "office-a") {
  const intake = await start(officeSlug);
  expect((await request(`/c/${intake.token}/submit`, "POST", submit)).status).toBe(200);
  return intake;
}

it("counts first submit once through concurrent resends, integrations, erasure and tenant isolation", async () => {
  const intake = await start();
  const responses = await Promise.all([
    request(`/c/${intake.token}/submit`, "POST", submit),
    request(`/c/${intake.token}/submit`, "POST", submit),
  ]);
  expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
  expect((await request(`/c/${intake.token}/submit`, "POST", submit)).status).toBe(409);
  await db.update(cases).set({ status: "needs_citizen" }).where(eq(cases.id, intake.case.id));
  expect((await request(`/c/${intake.token}/submit`, "POST", submit)).status).toBe(200);
  expect(await commercialStatus(db, "caf-a", now)).toMatchObject({ delivered: 1, percent: 10 });
  const [row] = await db.select().from(cases).where(eq(cases.id, intake.case.id));
  await db.transaction(async (tx) => {
    await eraseCase(tx, row!, now, "admin");
  });
  expect(await commercialStatus(db, "caf-a", now)).toMatchObject({ delivered: 1 });
  expect(await commercialStatus(db, "caf-b", now)).toMatchObject({ delivered: 0 });
  const report = await platformUsage(db, { month: "2027-01", org: "caf-a" });
  expect(report.organizations[0]).toMatchObject({ started: 1, delivered: 1, activeOffices: 1 });
  expect(report.organizations[0]!.offices.find((o) => o.officeId === "office-a")).toMatchObject({
    started: 1,
    delivered: 1,
  });
});

it("commits counters with submission and rolls them back if alert enqueue fails", async () => {
  await platformOrg(db, { org: "caf-a", cap: 1 }, now);
  const intake = await start();
  // Missing encryption material must roll back both the first submission and its counter.
  const broken = createApp({ ...s, notifications: { ...s.notifications, key: Buffer.alloc(1) } });
  const response = await broken.request(`/api/c/${intake.token}/submit`, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(submit),
  });
  expect(response.status).toBe(500);
  expect((await commercialStatus(db, "caf-a", now)).delivered).toBe(0);
  expect(await db.select().from(usageQuotaAlerts)).toHaveLength(0);
  expect((await request(`/c/${intake.token}/submit`, "POST", submit)).status).toBe(200);
  expect((await commercialStatus(db, "caf-a", now)).delivered).toBe(1);
});

it("emits 70/90/100 once per CAF/month across two concurrent office submissions and outbox cleanup, allows overage", async () => {
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  try {
    for (let i = 0; i < 6; i++) await deliver();
    const first = await start(),
      second = await start("office-a2");
    const results = await Promise.all([
      request(`/c/${first.token}/submit`, "POST", submit),
      request(`/c/${second.token}/submit`, "POST", submit),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(await db.select().from(usageQuotaAlerts)).toHaveLength(1);
    await deliver();
    await deliver();
    await deliver();
    const alerts = await db.select().from(usageQuotaAlerts).orderBy(usageQuotaAlerts.threshold);
    expect(alerts.map((r) => r.threshold)).toEqual([70, 90, 100]);
    expect(await commercialStatus(db, "caf-a", now)).toMatchObject({ delivered: 11, percent: 110 });
    const outbox = await db.select().from(notifications);
    expect(outbox).toHaveLength(3);
    for (const mail of outbox) {
      expect(mail.operatorId).toBe("admin");
      const envelope = unseal(
        s.notifications,
        `${mail.id}:${mail.kind}:${mail.language}`,
        mail.envelope!,
      );
      expect(envelope.to).toBe("admin@test.invalid");
      expect(JSON.stringify(envelope)).not.toMatch(/SECRET|office-b|caf-b/);
    }
    expect(
      log.mock.calls.filter(([line]) => String(line).includes('"event":"usage.quota"')),
    ).toHaveLength(3);
    await db.delete(notifications);
    await deliver();
    expect(await db.select().from(notifications)).toHaveLength(0);
    expect(await db.select().from(usageQuotaAlerts)).toHaveLength(3);
    now = new Date("2027-01-31T23:00:00Z");
    await platformOrg(db, { org: "caf-a", cap: 1 }, now);
    await deliver();
    expect(await db.select().from(usageQuotaAlerts)).toHaveLength(6);
    expect(await commercialStatus(db, "caf-a", now)).toMatchObject({
      month: "2027-02",
      delivered: 1,
    });
    expect(await commercialStatus(db, "caf-b", now)).toMatchObject({ delivered: 0 });
  } finally {
    log.mockRestore();
  }
});

it("emails only the highest threshold crossed and starts over when the cap changes in the month", async () => {
  const quotaMail = async () =>
    (await db.select().from(notifications).where(eq(notifications.kind, "usage_quota"))).map(
      (mail) =>
        unseal(s.notifications, `${mail.id}:${mail.kind}:${mail.language}`, mail.envelope!).subject,
    );
  const thresholds = async () =>
    (await db.select().from(usageQuotaAlerts).orderBy(usageQuotaAlerts.threshold)).map(
      (r) => r.threshold,
    );
  vi.spyOn(console, "info").mockImplementation(() => {});
  await platformOrg(db, { org: "caf-a", cap: 1 }, now);
  await deliver();
  expect(await thresholds()).toEqual([70, 90, 100]);
  expect(await quotaMail()).toEqual(["Avanti: quota consegne al 100%"]);
  await platformOrg(db, { org: "caf-a", cap: 1 }, now);
  expect(await thresholds()).toEqual([70, 90, 100]);
  await platformOrg(db, { org: "caf-a", cap: 2 }, now);
  expect(await thresholds()).toEqual([]);
  await deliver();
  expect(await thresholds()).toEqual([70, 90, 100]);
  expect(await quotaMail()).toEqual([
    "Avanti: quota consegne al 100%",
    "Avanti: quota consegne al 100%",
  ]);
  vi.restoreAllMocks();
});

it("retention never decrements month totals; status is admin-only, scoped and contains only quota data", async () => {
  now = new Date("2027-01-31T22:59:59Z");
  const intake = await start();
  now = new Date("2027-01-31T23:00:00Z");
  expect((await request(`/c/${intake.token}/submit`, "POST", submit)).status).toBe(200);
  await db
    .update(cases)
    .set({ expiresAt: "2026-01-01T00:00:00Z" })
    .where(eq(cases.id, intake.case.id));
  expect(await purgeRetainedCases(s, now)).toBe(1);
  await db.update(sessions).set({ createdAt: now.toISOString() });
  const res = await request("/status", "GET", undefined, "admin");
  expect(res.status).toBe(200);
  expect((await res.json()).usage).toEqual({
    month: "2027-02",
    delivered: 1,
    cap: 10,
    percent: 10,
  });
  expect((await request("/status", "GET", undefined, "op")).status).toBe(403);
  expect((await request("/status")).status).toBe(401);
  expect(
    (await (await request("/status", "GET", undefined, "foreign")).json()).usage.delivered,
  ).toBe(0);
  const jan = await platformUsage(db, { month: "2027-01", org: "caf-a" });
  expect(jan.organizations[0]).toMatchObject({ started: 1, delivered: 0 });
});

it("reports content-free costs, retries, reservations, office attribution and activity without double-counting operators", async () => {
  await deliver();
  await deliver("office-a2");
  await platformOrg(db, { org: "caf-a", budget: 2 }, now);
  for (const [id, officeId, cost, attempts, reserved] of [
    ["a", "office-a", 0.2, 2, 0],
    ["a2", "office-a2", 0.1, 1, 0],
    ["old", null, 0.3, 3, 0],
    ["reserved", "office-a", 0, 0, 0.4],
  ] as const)
    await db.insert(aiUsage).values({
      id,
      organizationId: "caf-a",
      officeId,
      day: "2027-01-15",
      task: "test",
      version: "1",
      engine: "ai",
      outcome: reserved ? "reserved" : "success",
      costEstimateEur: cost,
      attempts,
      reservedEur: reserved,
    });
  await db.insert(aiUsage).values({
    id: "foreign",
    organizationId: "caf-b",
    day: "2027-01-15",
    task: "test",
    version: "1",
    engine: "ai",
    outcome: "success",
    costEstimateEur: 100,
    attempts: 99,
  });
  for (const [id, officeId] of [
    ["one", "office-a"],
    ["two", "office-a2"],
    ["repeat", "office-a"],
  ])
    await db.insert(events).values({
      id: id!,
      officeId: officeId!,
      organizationId: "caf-a",
      actor: "operator",
      actorId: "op",
      type: "case.viewed",
      at: now.toISOString(),
    });
  const report = await platformUsage(db, { month: "2027-01", org: "caf-a" });
  const org = report.organizations[0]!;
  expect(org).toMatchObject({
    started: 2,
    delivered: 2,
    activeOperators: 1,
    aiCalls: 6,
    budgetEur: 2,
    budgetPercent: 50,
    activeOffices: 2,
    unresolvedReservations: 1,
  });
  expect(org.costEstimateEur).toBeCloseTo(0.6);
  expect(org.aiCostPerDeliveredEur).toBeCloseTo(0.3);
  expect(org.offices[0]).toMatchObject({
    activeOperators: 1,
    aiCalls: 2,
    costEstimateEur: 0.2,
    reservedEur: 0.4,
  });
  expect(org.offices[1]).toMatchObject({ activeOperators: 1, aiCalls: 1, costEstimateEur: 0.1 });
  expect(org.unattributedAi).toMatchObject({
    started: 0,
    delivered: 0,
    aiCalls: 3,
    costEstimateEur: 0.3,
    aiCostPerDeliveredEur: null,
  });
  expect(JSON.stringify(report)).not.toMatch(/SECRET|test.invalid|token|password|caf-b/);
  expect(formatPlatformUsage(report)).toContain("[AI non attribuita]");
  expect(
    (await platformUsage(db, { month: "2027-02", org: "caf-a" })).organizations[0],
  ).toMatchObject({ started: 0, delivered: 0, aiCalls: 0, aiCostPerDeliveredEur: null });
});

it("validates platform arguments and resets limits with an atomic, content-free platform audit", async () => {
  expect(parsePlatformArgs("usage", ["--month", "2027-01", "--org", "caf-a", "--json"])).toEqual({
    month: "2027-01",
    org: "caf-a",
    json: true,
  });
  expect(
    parsePlatformArgs("org", ["--org", "caf-a", "--budget", "reset", "--cap", "reset"]),
  ).toMatchObject({ budget: null, cap: null });
  for (const args of [
    ["--month", "2027-13"],
    ["--month", "2027-01", "--org", "a", "--org", "b"],
    ["--month", "2027-01", "--oops", "value"],
  ])
    expect(() => parsePlatformArgs("usage", args)).toThrow();
  for (const args of [
    ["--org", "caf-a", "--budget", "-1"],
    ["--org", "caf-a", "--cap", "0"],
    ["--org", "caf-a", "--cap", "1.5"],
  ])
    expect(() => parsePlatformArgs("org", args)).toThrow();
  expect((await platformOrg(db, { org: "caf-a", budget: 0, cap: 20 }, now)).ai).toMatchObject({
    budgetEur: 0,
    overrideEur: 0,
  });
  const reset = await platformOrg(db, { org: "caf-a", budget: null, cap: null }, now, 50);
  expect(reset).toMatchObject({
    ai: { budgetEur: 50, overrideEur: null },
    usage: { cap: null, percent: null },
  });
  const audit = await db
    .select()
    .from(events)
    .where(eq(events.type, "platform.organization_limits_updated"));
  expect(audit).toHaveLength(2);
  expect(audit[1]?.metadata).toMatchObject({
    previousBudgetEur: 0,
    budgetEur: null,
    previousCap: 20,
    cap: null,
  });
  expect(audit.every((e) => e.actor === "system" && !e.actorId && !e.caseId)).toBe(true);
  expect(JSON.stringify(audit)).not.toMatch(/SECRET|test.invalid|password/);
  expect(
    (
      await request(
        "/settings",
        "PATCH",
        { monthlyDeliveryCap: 999, aiMonthlyBudgetEur: 999 },
        "admin",
      )
    ).status,
  ).toBe(200);
  expect(await platformOrg(db, { org: "caf-a" }, now, 50)).toMatchObject({
    ai: { budgetEur: 50, overrideEur: null },
    usage: { cap: null },
  });
  expect((await platformOrg(db, { org: "caf-b" }, now)).usage.cap).toBe(10);
  await expect(platformOrg(db, { org: "missing", budget: 100 }, now)).rejects.toThrow();
});

it("attributes AI telemetry to the office in Rome's month, including retries and non-AI fallback", async () => {
  now = new Date("2027-01-31T23:00:00Z");
  s.ai = new AiIntelligence({
    config: loadAiConfig({ AI_PROVIDER: "openai", OPENAI_API_KEY: "synthetic" }),
    transport: async () => ({
      output: { text: "Synthetic translation" },
      usage: { inputTokens: 30, outputTokens: 5 },
    }),
  });
  await observeAi(s, { organizationId: "caf-a", officeId: "office-a" }, () =>
    s.ai.translate("Synthetic", "en"),
  );
  const rows = await db.select().from(aiUsage);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    officeId: "office-a",
    organizationId: "caf-a",
    day: "2027-02-01",
    attempts: 1,
    reservedEur: 0,
  });
  expect(
    (await platformUsage(db, { month: "2027-02", org: "caf-a" })).organizations[0]?.offices[0],
  ).toMatchObject({ aiCalls: 1 });
});

it("keeps quota mail relevant across days but cancels it for a demoted admin", async () => {
  await platformOrg(db, { org: "caf-a", cap: 1 }, now);
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  try {
    await deliver();
    now = new Date("2027-01-16T10:00:00Z");
    expect(await sendNotifications(s, now)).toBe(1);
    expect((await db.select().from(notifications)).every((row) => row.state === "simulated")).toBe(
      true,
    );
    await db.delete(notifications);
    await db.delete(usageQuotaAlerts);
    await db.transaction(async (tx) => {
      await enqueueUsageAlerts(tx, s, "caf-a", now);
    });
    await db.update(operators).set({ role: "operator" }).where(eq(operators.id, "admin"));
    expect(await sendNotifications(s, now)).toBe(0);
    expect((await db.select().from(notifications)).every((row) => row.state === "cancelled")).toBe(
      true,
    );
  } finally {
    log.mockRestore();
  }
});
