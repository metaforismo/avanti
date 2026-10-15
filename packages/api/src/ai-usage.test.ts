import { beforeAll, beforeEach, afterAll, expect, it, vi } from "vitest";
import {
  createDatabase,
  aiUsage,
  operationalCounters,
  organizations,
  operators,
  sessions,
  settings,
  type Database,
} from "@avanti/db";
import { eq } from "drizzle-orm";
import { AiIntelligence } from "./ai";
import { loadAiConfig } from "@avanti/ai/config";
import { cafAiContext, aiBudget } from "./ai-usage";
import { observeAi } from "./operational-telemetry";
import { MemoryStorage } from "./storage";
import { mfaCipher } from "./mfa";
import { defaultNotifications } from "./notification-config";
import { createApp } from "./app";
import type { Services } from "./context";
import { hashToken } from "./security";
let db: Database, close: () => Promise<void>, s: Services;
const transport = vi.fn(async () => ({
  output: { text: "Bring the document to the desk." },
  usage: { inputTokens: 50, outputTokens: 10 },
}));
beforeAll(async () => {
  ({ db, close } = await createDatabase({ memory: true }));
});
afterAll(async () => {
  await close();
});
beforeEach(async () => {
  await db.delete(organizations);
  for (const id of ["a", "b"])
    await db.insert(organizations).values({ id, name: "Synthetic CAF", kind: "caf" });
  transport.mockClear();
  s = {
    db,
    storage: new MemoryStorage(),
    ai: new AiIntelligence({
      config: loadAiConfig({
        AI_PROVIDER: "openai",
        OPENAI_API_KEY: "synthetic",
        AI_MONTHLY_BUDGET_EUR: "1",
      }),
      transport,
    }),
    clock: () => new Date("2027-01-10T12:00:00Z"),
    mfa: mfaCipher({}),
    notifications: defaultNotifications(),
    publicUrl: "http://localhost:3400",
    production: false,
  };
});
it("isolates tenants and months, validates query and protects the endpoint", async () => {
  for (const [id, role, org] of [
    ["admin", "admin", "a"],
    ["operator", "operator", "a"],
    ["foreign", "admin", "b"],
  ] as const) {
    await db.insert(operators).values({
      id,
      organizationId: org,
      name: "Synthetic",
      email: `${id}@test.invalid`,
      passwordHash: "none",
      role,
    });
    await db.insert(sessions).values({
      id,
      operatorId: id,
      tokenHash: hashToken(`${id}-token`.padEnd(43, "x")),
      expiresAt: "2027-02-01T00:00:00Z",
      createdAt: "2027-01-10T12:00:00Z",
    });
  }
  await observeAi(s, "a", () => s.ai.translate("Porta il documento allo sportello", "en"));
  await db.insert(aiUsage).values({
    id: "old",
    organizationId: "a",
    task: "translate",
    version: "1",
    engine: "ai",
    outcome: "success",
    day: "2026-12-01",
    costEstimateEur: 99,
  });
  const app = createApp(s);
  const request = (id?: string, query = "") =>
    app.request(`/api/ai/usage${query}`, {
      headers: id ? { cookie: `avanti_session=${`${id}-token`.padEnd(43, "x")}` } : {},
    });
  expect((await request()).status).toBe(401);
  expect((await request("operator")).status).toBe(403);
  expect((await request("admin", "?month=2027-13")).status).toBe(400);
  const current = await (await request("admin", "?month=2027-01")).json();
  expect(current).toMatchObject({
    month: "2027-01",
    totals: { calls: 1, inputTokens: 50, outputTokens: 10 },
  });
  expect(current.groups[0]).toMatchObject({
    task: "translate",
    version: "1.3",
    outcome: "success",
    engine: "ai",
  });
  expect((await (await request("foreign")).json()).totals.calls).toBe(0);
  expect(JSON.stringify(current)).not.toMatch(/Porta|synthetic|Bring/);
  const patch = (budget: number | null) =>
    app.request("/api/settings", {
      method: "PATCH",
      headers: {
        cookie: `avanti_session=${"admin-token".padEnd(43, "x")}`,
        origin: s.publicUrl,
        "content-type": "application/json",
      },
      body: JSON.stringify({ aiMonthlyBudgetEur: budget }),
    });
  expect((await patch(-1)).status).toBe(400);
  expect((await patch(0)).status).toBe(200);
  const status = await (
    await app.request("/api/status", {
      headers: { cookie: `avanti_session=${"admin-token".padEnd(43, "x")}` },
    })
  ).json();
  expect(status.components.ai).toMatchObject({
    mode: "fallback",
    budget: { exhausted: true, budgetEur: 0 },
    configuration: { provider: "openai", keyPresent: true, dataPolicy: "strict" },
  });
  expect((await aiBudget(s, "b")).budgetEur).toBe(1);
  expect((await patch(null)).status).toBe(200);
  expect((await aiBudget(s, "a")).budgetEur).toBe(1);
});
it("honors organization overrides and admits only the reserved amount under concurrency", async () => {
  await db.insert(settings).values({ organizationId: "a", aiMonthlyBudgetEur: 0.1 });
  const context = cafAiContext(s, "a");
  const result = await Promise.all(
    Array.from({ length: 8 }, () =>
      context.reserve!(0.06, { id: "test", version: "1", model: "synthetic" }),
    ),
  );
  expect(result.filter((r) => "id" in r)).toHaveLength(1);
  expect(result.filter((r) => "reason" in r)).toHaveLength(7);
  expect((await aiBudget(s, "a")).reservedEur).toBeCloseTo(0.06);
  expect((await aiBudget(s, "b")).reservedEur).toBe(0);
});
it("uses heuristics with zero budget, records the fallback and advertises exhaustion", async () => {
  await db.insert(settings).values({ organizationId: "a", aiMonthlyBudgetEur: 0 });
  const result = await observeAi(s, "a", () => s.ai.translate("Porta il documento", "en"));
  expect(result.engine).toBe("heuristic");
  expect(transport).not.toHaveBeenCalled();
  expect(await db.select().from(aiUsage).where(eq(aiUsage.organizationId, "a"))).toMatchObject([
    { outcome: "budget_exhausted", attempts: 0, reservedEur: 0, costEstimateEur: 0 },
  ]);
  expect((await aiBudget(s, "a")).exhausted).toBe(true);
  const counters = await db
    .select()
    .from(operationalCounters)
    .where(eq(operationalCounters.organizationId, "a"));
  expect(counters.some((row) => row.metric === "ai_error")).toBe(false);
});
it("reconciles reservations into estimated spend without retaining content", async () => {
  await observeAi(s, "a", () => s.ai.translate("Porta il documento", "en"));
  const [row] = await db.select().from(aiUsage);
  expect(row).toMatchObject({
    task: "translate",
    reservedEur: 0,
    attempts: 1,
    inputTokens: 50,
    outputTokens: 10,
  });
  expect(row?.costEstimateEur).toBeCloseTo(0.0003);
  expect(Object.keys(row!)).not.toEqual(expect.arrayContaining(["prompt", "output", "text"]));
});
it("fails closed if the organization cannot reserve a budget", async () => {
  await expect(
    observeAi(s, "missing", () => s.ai.translate("Porta il documento", "en")),
  ).resolves.toMatchObject({ engine: "heuristic" });
  expect(transport).not.toHaveBeenCalled();
});
it("persists a reasoning capability retry without recording content", async () => {
  const retryTransport = vi
    .fn()
    .mockRejectedValueOnce({ statusCode: 400, message: "Unsupported reasoning_effort" })
    .mockResolvedValue({
      output: { text: "Bring the document to the desk." },
      usage: { inputTokens: 50, outputTokens: 10 },
    });
  s.ai = new AiIntelligence({
    config: loadAiConfig({ AI_PROVIDER: "openai", OPENAI_API_KEY: "synthetic" }),
    transport: retryTransport,
  });
  await observeAi(s, "a", () => s.ai.translate("Porta il documento allo sportello", "en"));
  const [row] = await db.select().from(aiUsage).where(eq(aiUsage.organizationId, "a"));
  expect(row).toMatchObject({
    outcome: "success_after_reasoning_unsupported",
    attempts: 2,
    engine: "ai",
    reservedEur: 0,
  });
  expect(JSON.stringify(row)).not.toContain("Porta il documento");
});
