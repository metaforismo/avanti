import { defaultNotifications } from "./notification-config";
import { afterAll, beforeAll, expect, it } from "vitest";
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import {
  ApiError,
  CitizenCase,
  LANGUAGES,
  StartIntakeResponse,
  type AnswerValue,
  type Question,
} from "@avanti/contracts";
import {
  cases,
  createDatabase,
  offices,
  operators,
  organizations,
  rateLimits,
  type Database,
} from "@avanti/db";
import { createApp } from "./app";
import { MemoryStorage } from "./storage";
import { hashPassword } from "./security";
import { rateLimit } from "./middleware/rate-limit";
import { registerErrors } from "./middleware/errors";
import { limitMessage } from "./middleware/limit-message";
import type { ApiEnv, Services } from "./context";
import { GatewayIntelligence } from "./ai";

let db: Database;
let close: () => Promise<void>;
let now = new Date("2027-01-05T10:00:00Z");
const origin = "https://avanti.example.test";
const sharedIp = "192.0.2.1";
const services = (): Services => ({
  notifications: defaultNotifications(),
  db,
  storage: new MemoryStorage(),
  ai: new GatewayIntelligence(),
  clock: () => now,
  production: true,
  publicUrl: origin,
  clientAddress: () => sharedIp,
  rateLimitSecret: "waiting-room-synthetic-secret",
  logger: () => {},
});
beforeAll(async () => {
  ({ db, close } = await createDatabase({ memory: true }));
  await db.insert(organizations).values({ id: "room", name: "CAF Esempio", kind: "caf" });
  await db.insert(offices).values({
    id: "room",
    organizationId: "room",
    slug: "room",
    name: "Sala",
    address: "Esempio",
    city: "Roma",
  });
});
afterAll(async () => close?.());
const post = (app: ReturnType<typeof createApp>, path: string, input: unknown) =>
  app.request(path, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
function answer(question: Question): AnswerValue {
  if (question.id === "household_count") return 1;
  if (question.id === "members")
    return [{ role: "richiedente", firstName: "Persona", lastName: "Esempio", birthYear: 1985 }];
  if (question.kind === "yes_no") return false;
  if (question.kind === "number") return question.min ?? 0;
  if (question.kind === "single_choice") return question.options![0]!.value;
  if (question.kind === "multi_choice") return [question.options![0]!.value];
  throw new Error(`Missing fixture answer: ${question.id}`);
}
it("40 citizens on one Wi-Fi create cases together and complete ISEE interviews in ten minutes without 429", async () => {
  const app = createApp(services());
  const starts = await Promise.all(
    Array.from({ length: 40 }, () =>
      post(app, "/api/intake", {
        officeSlug: "room",
        language: "it",
        practiceId: "isee_ordinario",
        privacyAccepted: true,
      }),
    ),
  );
  expect(starts.every((response) => response.status === 201)).toBe(true);
  let citizens = await Promise.all(
    starts.map(async (response) => StartIntakeResponse.parse(await response.json())),
  );
  let turns = 0;
  for (
    let round = 0;
    round < 40 && citizens.some((citizen) => citizen.case.nextQuestion);
    round++
  ) {
    // Everyone taps an answer every two seconds: the busiest a room can realistically get.
    now = new Date(Date.parse("2027-01-05T10:00:00Z") + (round + 1) * 2000);
    citizens = await Promise.all(
      citizens.map(async (citizen) => {
        const question = citizen.case.nextQuestion;
        if (!question) return citizen;
        const response = await post(app, `/api/c/${citizen.token}/turn`, {
          type: "answer",
          questionId: question.id,
          value: answer(question),
        });
        expect(response.status, question.id).toBe(200);
        turns++;
        return { token: citizen.token, case: CitizenCase.parse(await response.json()) };
      }),
    );
  }
  expect(turns).toBeGreaterThan(120);
  expect(
    citizens.every(
      (citizen) => citizen.case.nextQuestion === null && citizen.case.step === "documents",
    ),
  ).toBe(true);
  expect(now.getTime() - Date.parse("2027-01-05T10:00:00Z")).toBeLessThanOrEqual(600000);
});
it("ten operators on one Wi-Fi can retry and log in without blocking one another", async () => {
  await db.delete(rateLimits);
  const password = "SyntheticPassword-2027!";
  const passwordHash = await hashPassword(password);
  await db.insert(operators).values(
    Array.from({ length: 10 }, (_, i) => ({
      id: `room-op-${i}`,
      organizationId: "room",
      name: "Operatore Esempio",
      email: `room-op-${i}@example.invalid`,
      passwordHash,
      role: "operator" as const,
    })),
  );
  const app = createApp(services());
  for (let i = 0; i < 10; i++) {
    const email = `room-op-${i}@example.invalid`;
    expect((await post(app, "/api/auth/login", { email, password: "wrong" })).status).toBe(401);
    expect((await post(app, "/api/auth/login", { email, password })).status).toBe(200);
  }
  for (let i = 0; i < 8; i++)
    expect(
      (
        await post(app, "/api/auth/login", {
          email: "room-op-0@example.invalid",
          password: "wrong",
        })
      ).status,
    ).toBe(401);
  expect(
    (await post(app, "/api/auth/login", { email: "room-op-0@example.invalid", password })).status,
  ).toBe(429);
  expect(
    (await post(app, "/api/auth/login", { email: "room-op-1@example.invalid", password })).status,
  ).toBe(200);
});
function limitedApp() {
  const app = new Hono<ApiEnv>();
  registerErrors(app, () => {});
  app.use("*", rateLimit(services()));
  app.post("*", (c) => c.json({ ok: true }));
  return app;
}
it("capability burst is strict, localized, and does not charge the Wi-Fi for rejected requests", async () => {
  await db.delete(rateLimits);
  const [row] = await db.select().from(cases).limit(1);
  expect(row).toBeDefined();
  // Synthetic token here tests the limiter; full capability authentication is covered by the room test.
  const token = "x".repeat(43);
  const { hashToken } = await import("./security");
  await db
    .update(cases)
    .set({ tokenHash: hashToken(token), language: "en" })
    .where(eq(cases.id, row!.id));
  const app = limitedApp();
  for (let i = 0; i < 60; i++)
    expect((await post(app, `/api/c/${token}/turn`, {})).status).toBe(200);
  const blocked = await post(app, `/api/c/${token}/turn`, {});
  expect(blocked.status).toBe(429);
  expect(blocked.headers.get("Retry-After")).toBe("60");
  expect(ApiError.parse(await blocked.json()).error.message).toBe(limitMessage("en", 60));
  const counters = await db.select().from(rateLimits);
  expect(counters.filter((r) => r.count === 60)).toHaveLength(3);
  now = new Date(now.getTime() + 60000);
  expect((await post(app, `/api/c/${token}/turn`, {})).status).toBe(200);
});
it("intake allows 60 cases an hour with a 40-case burst, returns the actual remaining wait, and resets", async () => {
  await db.delete(rateLimits);
  now = new Date("2027-01-05T12:00:00Z");
  const app = limitedApp();
  const input = { officeSlug: "room", privacyAccepted: true, language: "fr" };
  for (let i = 0; i < 40; i++) expect((await post(app, "/api/intake", input)).status).toBe(200);
  const burst = await post(app, "/api/intake", input);
  expect(burst.status).toBe(429);
  expect(burst.headers.get("Retry-After")).toBe("60");
  now = new Date(now.getTime() + 60000);
  for (let i = 0; i < 20; i++) expect((await post(app, "/api/intake", input)).status).toBe(200);
  const hourly = await post(app, "/api/intake", input);
  expect(hourly.status).toBe(429);
  expect(hourly.headers.get("Retry-After")).toBe("3540");
  expect(ApiError.parse(await hourly.json()).error.message).toBe(limitMessage("fr", 3540));
  now = new Date("2027-01-05T13:00:00Z");
  expect((await post(app, "/api/intake", input)).status).toBe(200);
});
// This checks quota correctness with 15,000 real requests; PGlite writes can exceed 30s on a busy host.
it("the broad IP ceiling stops at 15,000 turns per hour across otherwise healthy capabilities", async () => {
  await db.delete(rateLimits);
  const base = Date.parse("2027-01-05T15:00:00Z");
  const app = limitedApp();
  // 50 citizens, six taps a minute each, for 50 minutes: every per-case limit stays healthy.
  const tokens = Array.from({ length: 50 }, (_, i) => String(i).padStart(43, "x"));
  for (let minute = 0; minute < 50; minute++) {
    now = new Date(base + minute * 60000);
    const responses = await Promise.all(
      Array.from({ length: 6 }, () =>
        tokens.map((token) => post(app, `/api/c/${token}/turn`, {})),
      ).flat(),
    );
    expect(responses.every((response) => response.status === 200)).toBe(true);
  }
  now = new Date(base + 50 * 60000);
  const blocked = await post(app, `/api/c/${tokens[0]}/turn`, {});
  expect(blocked.status).toBe(429);
  expect(blocked.headers.get("Retry-After")).toBe("600");
  now = new Date(base + 3600000);
  expect((await post(app, `/api/c/${tokens[0]}/turn`, {})).status).toBe(200);
}, 240_000);
it.each(LANGUAGES)("intake limits return citizen copy and Retry-After in %s", async (language) => {
  await db.delete(rateLimits);
  const app = limitedApp();
  const input = { officeSlug: "room", privacyAccepted: true, language };
  for (let i = 0; i < 40; i++) expect((await post(app, "/api/intake", input)).status).toBe(200);
  const response = await post(app, "/api/intake", input);
  expect(response.status).toBe(429);
  expect(response.headers.get("Retry-After")).toBe("60");
  const message = ApiError.parse(await response.json()).error.message;
  expect(message).toContain("60");
  if (language !== "it") expect(message).not.toBe(limitMessage("it", 60));
});

it("a citizen answering at full speed is never throttled", async () => {
  await db.delete(rateLimits);
  const app = createApp(services());
  now = new Date("2027-01-05T18:00:00Z");
  const start = await post(app, "/api/intake", {
    officeSlug: "room",
    language: "it",
    practiceId: "isee_ordinario",
    privacyAccepted: true,
  });
  const { token } = StartIntakeResponse.parse(await start.json());
  // 46 quick turns in 90 seconds (changing an answer and giving it again), one every two seconds.
  for (let tap = 0; tap < 46; tap++) {
    now = new Date(Date.parse("2027-01-05T18:00:00Z") + tap * 2000);
    const turn =
      tap % 2 === 0
        ? { type: "answer", questionId: "household_count", value: (tap % 5) + 1 }
        : { type: "edit", questionId: "household_count" };
    const response = await post(app, `/api/c/${token}/turn`, turn);
    expect(response.status, `tap ${tap}`).toBe(200);
  }
});
