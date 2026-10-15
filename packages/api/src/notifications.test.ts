import { mfaCipher } from "./mfa";
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { Language, OrganizationSettings, type AnswerValue } from "@avanti/contracts";
import { buildChecklist, buildHousehold, getQuestions } from "@avanti/core";
import {
  cases,
  checklistReviews,
  createDatabase,
  events,
  leads,
  messages,
  notifications,
  offices,
  operators,
  organizations,
  rateLimits,
  sessions,
  settings,
  type Database,
} from "@avanti/db";
import { createApp } from "./app";
import type { Services } from "./context";
import { GatewayIntelligence } from "./ai";
import { MemoryStorage } from "./storage";
import { hashToken } from "./security";
import {
  ConsoleEmail,
  DeliveryFailure,
  ResendEmail,
  type Delivery,
  type EmailAdapter,
} from "./email";
import { loadNotifications, unseal, type NotificationOptions } from "./notification-config";
import {
  enqueueCitizen,
  enqueueDigests,
  enqueueNotification,
  enqueueSubmissionReceipt,
  maintainNotifications,
  NOTIFICATION_BATCH,
  scheduleNotificationDelivery,
  sendNotifications,
} from "./notifications";
import { citizenNotification } from "./notification-copy";
import { submissionReceipt } from "./submission-receipt";

const initial = "2027-01-15T10:00:00.000Z";
const origin = "http://localhost:3400";
const sessionToken = "o".repeat(43);
const citizenToken = "c".repeat(43);
let db: Database, close: () => Promise<void>, now: Date, s: Services;
let options: NotificationOptions;
let send: ReturnType<typeof vi.fn<(delivery: Delivery) => Promise<void>>>;
let logs: unknown[];
const leadInput = {
  name: "Nome Riservato",
  organization: "CAF Prova",
  email: "lead@example.test",
  role: "Responsabile",
  phone: "12345",
  offices: 2,
  message: "Modulo riservato",
  privacyAccepted: true as const,
};

beforeAll(async () => {
  ({ db, close } = await createDatabase({ memory: true }));
});
afterAll(async () => {
  await close?.();
});
beforeEach(async () => {
  // system_jobs holds the cron lock: every test restarts the clock, so a stale run would skip it.
  await db.execute(
    sql`truncate organizations, leads, notifications, system_jobs, rate_limits cascade`,
  );
  now = new Date(initial);
  logs = [];
  send = vi.fn(async (_delivery: Delivery) => {});
  options = {
    key: randomBytes(32),
    adapter: { mode: "resend", send },
    from: "avanti@example.test",
    leadsEmail: "team@example.test",
  };
  s = {
    db,
    storage: new MemoryStorage(),
    ai: new GatewayIntelligence(),
    clock: () => now,
    publicUrl: origin,
    production: false,
    notifications: options,
    mfa: mfaCipher({ key: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" }),
    cronSecret: "test-cron",
    rateLimitSecret: "test-receipt-rate-secret",
    errorLogger: (record) => logs.push(record),
    logger: (record) => logs.push(record),
  };
  await db.insert(organizations).values([
    { id: "a", name: "CAF Prova", kind: "caf" },
    { id: "b", name: "Altro CAF", kind: "caf" },
  ]);
  await db.insert(offices).values({
    id: "office",
    organizationId: "a",
    slug: "notify-test",
    name: "Sportello",
    city: "Roma",
    address: "Via Test",
  });
  await db.insert(operators).values([
    {
      id: "admin",
      organizationId: "a",
      name: "Operatore Riservato",
      email: "operator@example.test",
      passwordHash: "unused",
      role: "admin",
    },
    {
      id: "inactive",
      organizationId: "a",
      name: "Inattivo",
      email: "inactive@example.test",
      passwordHash: "unused",
      role: "operator",
      active: false,
    },
    {
      id: "foreign",
      organizationId: "b",
      name: "Altro",
      email: "foreign@example.test",
      passwordHash: "unused",
      role: "admin",
    },
  ]);
  await db.insert(sessions).values({
    id: "session",
    operatorId: "admin",
    tokenHash: hashToken(sessionToken),
    expiresAt: "2027-02-01T00:00:00Z",
    createdAt: initial,
  });
  await db.insert(settings).values({ organizationId: "a" });
});

async function request(path: string, method = "GET", input?: unknown) {
  return createApp(s).request(`/api${path}`, {
    method,
    headers: {
      Origin: origin,
      Cookie: `avanti_session=${sessionToken}`,
      "Content-Type": "application/json",
    },
    ...(input ? { body: JSON.stringify(input) } : {}),
  });
}
async function fixture(email: string | undefined = "citizen@example.test") {
  const [row] = await db
    .insert(cases)
    .values({
      id: "case",
      organizationId: "a",
      officeId: "office",
      reference: "AV-2027-TEST",
      tokenHash: hashToken(citizenToken),
      practiceId: "isee_ordinario",
      language: "it",
      status: "in_review",
      answers: {
        household_count: 1,
        members: [
          { role: "richiedente", firstName: "Persona", lastName: "Riservata", birthYear: 1985 },
        ],
        accounts_count: 1,
        account_bank_0: "Banca Riservata",
        account_type_0: "deposit",
      },
      contact: { firstName: "Persona", lastName: "Riservata", ...(email ? { email } : {}) },
      createdAt: initial,
      updatedAt: initial,
      expiresAt: "2027-04-01T00:00:00Z",
    })
    .returning();
  return row!;
}
async function queue(key = "test", to = "team@example.test") {
  await enqueueNotification(
    db,
    options,
    {
      kind: "pilot_lead",
      language: "it",
      dedupeKey: key,
      to,
      email: { subject: "Test", text: "Contenuto riservato" },
    },
    now,
  );
}
function envelope(row: typeof notifications.$inferSelect) {
  return unseal(options, `${row.id}:${row.kind}:${row.language}`, row.envelope!);
}

function captureBackground() {
  const jobs: Array<() => Promise<void>> = [];
  s.background = (work) => jobs.push(work);
  return jobs;
}
function cron(app = createApp(s)) {
  return app.request("/api/cron/maintenance", {
    headers: { Authorization: "Bearer test-cron" },
  });
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

it("delivers a committed lead in background without cron or draining older notifications", async () => {
  await queue("older");
  const jobs = captureBackground();
  expect((await request("/leads", "POST", leadInput)).status).toBe(201);
  expect(jobs).toHaveLength(1);
  expect(send).not.toHaveBeenCalled();
  await jobs[0]!();
  expect(send).toHaveBeenCalledTimes(1);
  expect(send.mock.calls[0]![0].kind).toBe("pilot_lead");
  expect(
    await db.select().from(notifications).where(eq(notifications.dedupeKey, "older")),
  ).toMatchObject([{ state: "pending", attempts: 0 }]);
});

it("returns the API response while background delivery is still waiting for the provider", async () => {
  const entered = deferred();
  const release = deferred();
  let work: Promise<void> | undefined;
  send.mockImplementation(async () => {
    entered.resolve();
    await release.promise;
  });
  s.background = (job) => {
    work = job();
  };
  try {
    const response = await request("/leads", "POST", leadInput);
    expect(response.status).toBe(201);
    await entered.promise;
    expect(send).toHaveBeenCalledTimes(1);
  } finally {
    release.resolve();
    await work;
  }
});

it("does not send twice when immediate background delivery overlaps cron", async () => {
  const jobs = captureBackground();
  await request("/leads", "POST", leadInput);
  await Promise.all([jobs[0]!(), cron()]);
  expect(send).toHaveBeenCalledTimes(1);
  expect((await db.select().from(notifications))[0]).toMatchObject({ state: "sent", attempts: 1 });
});

it("recovers a confirmed immediate refusal on the next daily cron with the same delivery ID", async () => {
  const jobs = captureBackground();
  send.mockRejectedValueOnce(new DeliveryFailure("provider_unavailable", true));
  expect((await request("/leads", "POST", leadInput)).status).toBe(201);
  await jobs[0]!();
  expect((await db.select().from(notifications))[0]).toMatchObject({
    state: "pending",
    attempts: 1,
    firstAttemptAt: null,
    lastError: "provider_unavailable",
  });
  now = new Date(now.getTime() + 86400_000);
  expect(await (await cron()).json()).toMatchObject({ deliveredNotifications: 1 });
  expect(send).toHaveBeenCalledTimes(2);
  expect(send.mock.calls[1]![0]).toEqual(send.mock.calls[0]![0]);
  expect((await db.select().from(notifications))[0]).toMatchObject({ state: "sent", attempts: 2 });
});

it("never extends an uncertain send window after a later confirmed refusal", async () => {
  const jobs = captureBackground();
  send.mockRejectedValueOnce(new Error("private provider response"));
  send.mockRejectedValueOnce(new DeliveryFailure("provider_unavailable", true));
  await request("/leads", "POST", leadInput);
  await jobs[0]!();
  now = new Date(now.getTime() + 60_000);
  await cron();
  now = new Date(Date.parse(initial) + 86400_000);
  await cron();
  expect(send).toHaveBeenCalledTimes(2);
  const [row] = await db.select().from(notifications);
  expect(row).toMatchObject({ state: "failed", lastError: "retry_window_expired" });
  expect(new Date(row!.firstAttemptAt!).toISOString()).toBe(initial);
  expect(JSON.stringify(logs)).not.toContain("private provider response");
});

it("scheduling or background failures stay in synthetic logs and cron can recover", async () => {
  s.background = () => {
    throw new Error("lead@example.test private details");
  };
  expect((await request("/leads", "POST", leadInput)).status).toBe(201);
  expect(logs).toContainEqual(
    expect.objectContaining({ code: "NOTIFICATION_SCHEDULING_FAILED", stack: null }),
  );
  const jobs = captureBackground();
  const [row] = await db.select().from(notifications);
  scheduleNotificationDelivery(s, row!.id);
  const transaction = vi
    .spyOn(db, "transaction")
    .mockRejectedValueOnce(new Error("private DB details"));
  await jobs[0]!();
  transaction.mockRestore();
  expect(logs).toContainEqual(
    expect.objectContaining({ code: "NOTIFICATION_BACKGROUND_FAILED", stack: null }),
  );
  expect(JSON.stringify(logs)).not.toMatch(/private|lead@example/);
  expect(await (await cron()).json()).toMatchObject({ deliveredNotifications: 1 });
});

it("persists lead and encrypted outbox atomically, without sending on the request", async () => {
  expect((await request("/leads", "POST", leadInput)).status).toBe(201);
  const [lead] = await db.select().from(leads);
  const [row] = await db.select().from(notifications);
  expect(row).toMatchObject({
    leadId: lead!.id,
    kind: "pilot_lead",
    state: "pending",
    attempts: 0,
  });
  expect(envelope(row!).text).toContain("Consenso al ricontatto: sì");
  expect(envelope(row!).text).toContain("Sportelli: 2");
  expect(JSON.stringify(row)).not.toContain(leadInput.email);
  expect(JSON.stringify(row)).not.toContain(leadInput.message);
  expect(send).not.toHaveBeenCalled();
  expect(JSON.stringify(logs)).not.toMatch(/Riservato|lead@example|Modulo/);
  s.notifications = { ...options, key: Buffer.alloc(1) };
  expect((await request("/leads", "POST", leadInput)).status).toBe(500);
  expect(await db.select().from(leads)).toHaveLength(1);
  expect(await db.select().from(notifications)).toHaveLength(1);
});

it("requests only catalog titles, commits audit and outbox together, rejects stale retries", async () => {
  const jobs = captureBackground();
  const row = await fixture();
  const checklist = buildChecklist(
    "isee_ordinario",
    row.answers,
    buildHousehold(row.answers),
    "it",
  );
  const selected = checklist.filter((item) => item.requirementId === "account_balance");
  const input = {
    expectedUpdatedAt: initial,
    checklistItemIds: selected.map((item) => item.id),
    message: "Messaggio libero con Persona Riservata e 12000 euro",
  };
  expect((await request("/cases/case/requests", "POST", input)).status).toBe(200);
  const [notification] = await db.select().from(notifications);
  expect(envelope(notification!).text).toContain("CAF Prova");
  expect(envelope(notification!).text).toContain("Apri il link che hai salvato");
  expect(envelope(notification!).text).not.toMatch(
    /Riservata|Riservato|Messaggio libero|12000|case-link|\/pratica\/|Banca/,
  );
  expect(await db.select().from(events).where(eq(events.type, "case.requested"))).toHaveLength(1);
  expect((await request("/cases/case/requests", "POST", input)).status).toBe(409);
  expect(await db.select().from(notifications)).toHaveLength(1);
  expect(jobs).toHaveLength(1);
  await jobs[0]!();
  expect(send).toHaveBeenCalledTimes(1);
  expect(send.mock.calls[0]![0].kind).toBe("citizen_request");
});

it("an outbox failure rolls back integration, reviews, messages and audit", async () => {
  const jobs = captureBackground();
  await fixture();
  s.notifications = { ...options, key: Buffer.alloc(1) };
  expect(
    (
      await request("/cases/case/requests", "POST", {
        expectedUpdatedAt: initial,
        checklistItemIds: ["identity:m_richiedente_0"],
        message: "Ricarica il documento",
      })
    ).status,
  ).toBe(500);
  expect((await db.select().from(cases))[0]!.status).toBe("in_review");
  expect(await db.select().from(messages)).toHaveLength(0);
  expect(await db.select().from(checklistReviews)).toHaveLength(0);
  expect(await db.select().from(events)).toHaveLength(0);
  expect(await db.select().from(notifications)).toHaveLength(0);
  expect(jobs).toHaveLength(0);
});

it("never queues citizen mail without an email and ready is opt-in", async () => {
  const row = await fixture("");
  await enqueueCitizen(db, s, row, "citizen_request");
  await enqueueCitizen(db, s, row, "citizen_ready");
  expect(await db.select().from(notifications)).toHaveLength(0);
  row.contact = { firstName: "Persona", lastName: "Riservata", email: "citizen@example.test" };
  await enqueueCitizen(db, s, row, "citizen_ready");
  expect(await db.select().from(notifications)).toHaveLength(0);
  await db
    .update(settings)
    .set({ notifyCitizenReady: true })
    .where(eq(settings.organizationId, "a"));
  await enqueueCitizen(db, s, row, "citizen_ready");
  await enqueueCitizen(db, s, row, "citizen_ready");
  expect(await db.select().from(notifications)).toHaveLength(1);
});

it("ready transition queues once; unchanged ready status and other patches do not notify", async () => {
  const jobs = captureBackground();
  const row = await fixture();
  const answers: Record<string, AnswerValue> = {
    ...row.answers,
    account_owner_0: "m_richiedente_0",
    properties_count: 0,
    vehicles_count: 0,
    housing: "hosted",
    income_present_m_richiedente_0: false,
  };
  for (let pass = 0; pass < 10; pass++) {
    const unanswered = getQuestions("isee_ordinario", answers, "it").filter(
      (q) => !Object.hasOwn(answers, q.id),
    );
    if (!unanswered.length) break;
    for (const question of unanswered) {
      expect(question.kind, question.id).toBe("yes_no");
      answers[question.id] = false;
    }
  }
  await db
    .update(cases)
    .set({ answers, confirmedAnswers: Object.keys(answers) })
    .where(eq(cases.id, row.id));
  const checklist = buildChecklist("isee_ordinario", answers, buildHousehold(answers), "it");
  await db.insert(checklistReviews).values(
    checklist.map((item) => ({
      caseId: row.id,
      itemId: item.id,
      decision: "waived" as const,
      operatorId: "admin",
      reviewedAt: initial,
      note: "Verificato allo sportello",
    })),
  );
  await db
    .update(settings)
    .set({ notifyCitizenReady: true })
    .where(eq(settings.organizationId, "a"));
  const response = await request("/cases/case", "PATCH", {
    expectedUpdatedAt: initial,
    status: "ready",
  });
  expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
  expect(await db.select().from(notifications)).toHaveLength(1);
  expect(jobs).toHaveLength(1);
  await jobs[0]!();
  expect(send).toHaveBeenCalledTimes(1);
  expect(send.mock.calls[0]![0].kind).toBe("citizen_ready");
  const view = await response.json();
  expect(
    (
      await request("/cases/case", "PATCH", {
        expectedUpdatedAt: view.updatedAt,
        status: "ready",
        internalNotes: "Nota",
      })
    ).status,
  ).toBe(200);
  expect(await db.select().from(notifications)).toHaveLength(1);
});

it("settings expose defaults, validate booleans, and preserve omitted preferences", async () => {
  const defaults = OrganizationSettings.parse(await (await request("/settings")).json());
  expect(defaults).toMatchObject({ notifyCitizenReady: false, notifyOperatorDigest: false });
  expect((await request("/settings", "PATCH", { notifyCitizenReady: "true" })).status).toBe(400);
  expect(
    (await request("/settings", "PATCH", { notifyCitizenReady: true, notifyOperatorDigest: true }))
      .status,
  ).toBe(200);
  const response = await request("/settings", "PATCH", { linkDays: 7 });
  expect(await response.json()).toMatchObject({
    linkDays: 7,
    notifyCitizenReady: true,
    notifyOperatorDigest: true,
  });
  expect(await db.select().from(settings).where(eq(settings.organizationId, "b"))).toHaveLength(0);
});

it("retries exponentially, respects due time, limits attempts, and stores no provider PII", async () => {
  await queue();
  send.mockRejectedValue(new Error("citizen@example.test: Contenuto riservato"));
  for (let attempt = 1; attempt <= 5; attempt++) {
    const start = now.getTime();
    expect(await sendNotifications(s, now)).toBe(0);
    const [row] = await db.select().from(notifications);
    expect(row!.attempts).toBe(attempt);
    expect(row!.lastError).toBe("delivery_unknown");
    expect(JSON.stringify(logs)).not.toContain("citizen@example.test");
    if (attempt < 5) {
      expect(Date.parse(row!.nextAttemptAt) - start).toBe(60_000 * 2 ** (attempt - 1));
      await sendNotifications(s, now);
      expect(send).toHaveBeenCalledTimes(attempt);
      now = new Date(row!.nextAttemptAt);
    } else expect(row!.state).toBe("failed");
  }
  await sendNotifications(s, new Date(now.getTime() + 3600_000));
  expect(send).toHaveBeenCalledTimes(5);
});

it("deduplicates enqueue and concurrent workers, and scrubs delivered payloads", async () => {
  await queue();
  await queue();
  await Promise.all([sendNotifications(s, now), sendNotifications(s, now)]);
  expect(send).toHaveBeenCalledTimes(1);
  expect((await db.select().from(notifications))[0]).toMatchObject({
    state: "sent",
    attempts: 1,
    envelope: null,
    lastError: null,
  });
  await sendNotifications(s, now);
  expect(send).toHaveBeenCalledTimes(1);
});

it("recovers an interrupted lease with the same provider ID, stops before 24h expiry", async () => {
  await queue();
  const [row] = await db.select().from(notifications);
  await db.update(notifications).set({
    state: "sending",
    attempts: 1,
    firstAttemptAt: initial,
    leaseToken: "crashed",
    nextAttemptAt: new Date(now.getTime() + 60_000).toISOString(),
  });
  await sendNotifications(s, now);
  expect(send).not.toHaveBeenCalled();
  now = new Date(now.getTime() + 60_000);
  await sendNotifications(s, now);
  expect(send.mock.calls[0]![0].id).toBe(row!.id);
  await queue("expired");
  await db
    .update(notifications)
    .set({ firstAttemptAt: initial, attempts: 1 })
    .where(eq(notifications.dedupeKey, "expired"));
  now = new Date(Date.parse(initial) + 23 * 3600_000);
  await sendNotifications(s, now);
  expect(send).toHaveBeenCalledTimes(1);
  expect(
    (await db.select().from(notifications).where(eq(notifications.dedupeKey, "expired")))[0],
  ).toMatchObject({ state: "failed", lastError: "retry_window_expired" });
});

it("missing recipient waits without spending attempts, then uses configuration", async () => {
  options.leadsEmail = undefined;
  await enqueueNotification(
    db,
    options,
    {
      kind: "pilot_lead",
      language: "it",
      dedupeKey: "config",
      to: null,
      email: { subject: "Test", text: "Lead" },
    },
    now,
  );
  await sendNotifications(s, now);
  expect((await db.select().from(notifications))[0]).toMatchObject({
    attempts: 0,
    state: "pending",
    lastError: "configuration_missing",
  });
  options.leadsEmail = "team@example.test";
  now = new Date(now.getTime() + 3600_000);
  await sendNotifications(s, now);
  expect(send.mock.calls[0]![0].email.to).toBe("team@example.test");
});

it("cancels changed contacts or disabled ready preferences and cascades on erasure", async () => {
  const row = await fixture();
  row.status = "needs_citizen";
  await db.update(cases).set({ status: row.status }).where(eq(cases.id, row.id));
  await enqueueCitizen(db, s, row, "citizen_request");
  await db
    .update(cases)
    .set({ contact: { firstName: "Persona", lastName: "Riservata" } })
    .where(eq(cases.id, row.id));
  await sendNotifications(s, now);
  expect((await db.select().from(notifications))[0]).toMatchObject({
    state: "cancelled",
    envelope: null,
  });
  expect(send).not.toHaveBeenCalled();
  await db
    .update(settings)
    .set({ notifyCitizenReady: true })
    .where(eq(settings.organizationId, "a"));
  row.status = "ready";
  await db.update(cases).set({ status: "ready", contact: row.contact }).where(eq(cases.id, row.id));
  await enqueueCitizen(db, s, row, "citizen_ready");
  await db
    .update(settings)
    .set({ notifyCitizenReady: false })
    .where(eq(settings.organizationId, "a"));
  await sendNotifications(s, now);
  expect(send).not.toHaveBeenCalled();
  await db.delete(cases).where(eq(cases.id, row.id));
  expect(await db.select().from(notifications)).toHaveLength(0);
});

it("daily digest snapshots tenant counts once per UTC day for active operators only", async () => {
  await fixture();
  await db
    .update(settings)
    .set({ notifyOperatorDigest: true })
    .where(eq(settings.organizationId, "a"));
  expect(await enqueueDigests(s, now)).toBe(1);
  expect(await enqueueDigests(s, now)).toBe(0);
  const [row] = await db.select().from(notifications);
  expect(row).toMatchObject({ operatorId: "admin", organizationId: "a" });
  expect(envelope(row!).text).toBe(
    "Pratiche da revisionare: 1.\n\nApri la console per consultare la coda.",
  );
  expect(envelope(row!).text).not.toMatch(/Persona|CAF|AV-2027/);
  now = new Date(now.getTime() + 86400_000);
  await maintainNotifications(s, now);
  expect(send).toHaveBeenCalledTimes(1);
  expect((await db.select().from(notifications)).map((n) => n.state).sort()).toEqual([
    "cancelled",
    "sent",
  ]);
});

it("daily marker rolls back with failed digest enqueue", async () => {
  await db
    .update(settings)
    .set({ notifyOperatorDigest: true })
    .where(eq(settings.organizationId, "a"));
  s.notifications = { ...options, key: Buffer.alloc(1) };
  await expect(enqueueDigests(s, now)).rejects.toThrow();
  expect(
    (await db.select().from(settings).where(eq(settings.organizationId, "a")))[0]!.lastDigestDate,
  ).toBeNull();
  expect(await db.select().from(notifications)).toHaveLength(0);
  s.notifications = options;
  expect(await enqueueDigests(s, now)).toBe(1);
});

it("one daily cron delivers every new digest in background beyond its batch, despite old backlog", async () => {
  const jobs = captureBackground();
  await db
    .update(settings)
    .set({ notifyOperatorDigest: true })
    .where(eq(settings.organizationId, "a"));
  for (let i = 0; i < NOTIFICATION_BATCH + 1; i++) {
    await queue(`backlog-${i}`);
    await db.insert(operators).values({
      id: `digest-${i}`,
      organizationId: "a",
      name: "Operatore",
      email: `digest-${i}@example.test`,
      passwordHash: "unused",
      role: "operator",
    });
  }
  const run = createApp(s);
  now = new Date(now.getTime() + 60_000);
  expect(await (await cron(run)).json()).toMatchObject({ queuedDigests: NOTIFICATION_BATCH + 2 });
  expect(jobs).toHaveLength(NOTIFICATION_BATCH + 2);
  for (const job of jobs) await job();
  const digestSends = () =>
    send.mock.calls.filter(([delivery]) => delivery.kind === "operator_digest");
  expect(digestSends()).toHaveLength(NOTIFICATION_BATCH + 2);
  now = new Date(now.getTime() + 86400_000);
  jobs.length = 0;
  expect(await (await cron(run)).json()).toMatchObject({ queuedDigests: NOTIFICATION_BATCH + 2 });
  for (const job of jobs) await job();
  expect(digestSends()).toHaveLength(2 * (NOTIFICATION_BATCH + 2));
  expect(new Set(send.mock.calls.map(([delivery]) => delivery.id)).size).toBe(
    send.mock.calls.length,
  );
});

it("cron authenticates, drains outbox, and repeat invocations do not resend", async () => {
  await queue();
  const app = createApp(s);
  expect((await app.request("/api/cron/maintenance")).status).toBe(401);
  expect(send).not.toHaveBeenCalled();
  const run = () =>
    app.request("/api/cron/maintenance", { headers: { Authorization: "Bearer test-cron" } });
  expect(await (await run()).json()).toMatchObject({ ok: true, deliveredNotifications: 1 });
  expect(await (await run()).json()).toMatchObject({ ok: true, skipped: true });
  now = new Date(now.getTime() + 60_000);
  expect(await (await run()).json()).toMatchObject({ ok: true, deliveredNotifications: 0 });
  expect(send).toHaveBeenCalledTimes(1);
});

it("foreign tenant associations are rejected by notification composite FKs", async () => {
  const row = await fixture();
  await expect(
    enqueueNotification(
      db,
      options,
      {
        kind: "citizen_request",
        language: "it",
        organizationId: "b",
        caseId: row.id,
        dedupeKey: "foreign-case",
        to: row.contact!.email!,
        email: citizenNotification("citizen_request", "it", "CAF"),
      },
      now,
    ),
  ).rejects.toThrow();
  await expect(
    enqueueNotification(
      db,
      options,
      {
        kind: "operator_digest",
        language: "it",
        organizationId: "b",
        operatorId: "admin",
        dedupeKey: "foreign-operator",
        to: "operator@example.test",
        email: { subject: "Riepilogo", text: "0" },
      },
      now,
    ),
  ).rejects.toThrow();
});

it("expires encrypted payloads at 7 days and deletes operational receipts after 30 days", async () => {
  await queue();
  await db
    .update(notifications)
    .set({ state: "failed", completedAt: initial, lastError: "provider_rejected" });
  now = new Date(Date.parse(initial) + 8 * 86400_000);
  await maintainNotifications(s, now);
  const [row] = await db.select().from(notifications);
  expect(row).toMatchObject({ envelope: null, state: "failed", lastError: "payload_expired" });
  now = new Date(now.getTime() + 31 * 86400_000);
  await maintainNotifications(s, now);
  expect(await db.select().from(notifications)).toHaveLength(0);
});

it("console logs only kind and ID and records simulation distinctly from delivery", async () => {
  options.adapter = new ConsoleEmail((record) => logs.push(record));
  await queue();
  const [row] = await db.select().from(notifications);
  await sendNotifications(s, now);
  expect(logs).toEqual([{ kind: "pilot_lead", id: row!.id }]);
  expect((await db.select().from(notifications))[0]).toMatchObject({
    state: "simulated",
    envelope: null,
  });
  expect(send).not.toHaveBeenCalled();
});

for (const language of Language.options) {
  it(`${language}: integration and ready emails include CAF and saved-link instructions`, () => {
    const integration = citizenNotification("citizen_request", language, "CAF Prova", [
      "Doc A",
      "Doc A",
    ]);
    const ready = citizenNotification("citizen_ready", language, "CAF Prova");
    expect(integration.text).toContain("CAF Prova");
    expect(integration.text.match(/Doc A/g)).toHaveLength(1);
    expect(ready.text).toContain("CAF Prova");
    expect(integration.text.split("\n\n").at(-1)).toBe(ready.text.split("\n\n").at(-1));
    expect(integration.text).not.toMatch(/https?:|\/pratica\//);
    expect(ready.subject).not.toBe(integration.subject);
    if (language !== "it") expect(integration.text).not.toContain("Apri il link");
    if (language === "uk") expect(ready.text).toContain("Ви");
    if (language === "bn") expect(ready.text).toContain("আপনি");
  });
}

it("Resend sends plain text with stable idempotency ID through injected HTTP only", async () => {
  const http = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(JSON.stringify({ id: "provider-id" }), { status: 200 }));
  const adapter: EmailAdapter = new ResendEmail("test-key", http);
  const delivery = {
    id: "uuid",
    kind: "pilot_lead" as const,
    email: {
      from: "avanti@example.test",
      to: "team@example.test",
      subject: "Test",
      text: "Riservato",
    },
  };
  await adapter.send(delivery);
  const [url, init] = http.mock.calls[0]!;
  expect(url).toBe("https://api.resend.com/emails");
  expect(init!.headers).toMatchObject({ "Idempotency-Key": "uuid" });
  expect(JSON.parse(init!.body as string)).toEqual({ ...delivery.email, to: [delivery.email.to] });
  expect(init!.signal).toBeInstanceOf(AbortSignal);
  http.mockResolvedValueOnce(new Response("PII provider message", { status: 422 }));
  await expect(adapter.send(delivery)).rejects.toMatchObject({
    code: "provider_rejected",
    retryable: false,
  });
  http.mockResolvedValueOnce(new Response("PII provider message", { status: 429 }));
  await expect(adapter.send(delivery)).rejects.toMatchObject({
    code: "provider_unavailable",
    retryable: true,
  });
  for (const status of [409, 500, 503]) {
    http.mockResolvedValueOnce(new Response("PII provider message", { status }));
    await expect(adapter.send(delivery)).rejects.toMatchObject({
      code: "delivery_unknown",
      retryable: true,
    });
  }
  http.mockRejectedValueOnce(new Error("PII network error"));
  await expect(adapter.send(delivery)).rejects.toThrow("delivery_unknown");
});

it("configuration rejects unknown providers and production without persistent encryption", async () => {
  await expect(loadNotifications({ NOTIFY_PROVIDER: "smtp" }, "/unused")).rejects.toThrow(
    "NOTIFY_PROVIDER",
  );
  await expect(loadNotifications({ NOTIFY_PROVIDER: "resend" }, "/unused")).rejects.toThrow(
    "Resend requires",
  );
  await expect(loadNotifications({ NODE_ENV: "production" }, "/unused")).rejects.toThrow(
    "NOTIFY_ENCRYPTION_KEY",
  );
  const config = await loadNotifications(
    { NOTIFY_ENCRYPTION_KEY: randomBytes(32).toString("hex") },
    "/unused",
  );
  expect(config.adapter.mode).toBe("console");
});

it("terminal provider rejection fails without repeated attempts", async () => {
  await queue();
  send.mockRejectedValue(new DeliveryFailure("provider_rejected", false));
  await sendNotifications(s, now);
  await sendNotifications(s, new Date(now.getTime() + 60_000));
  expect(send).toHaveBeenCalledTimes(1);
  expect((await db.select().from(notifications))[0]).toMatchObject({
    state: "failed",
    attempts: 1,
    lastError: "provider_rejected",
  });
});

async function prepareSubmission(language: Language = "it") {
  const row = await fixture();
  const answers: Record<string, AnswerValue> = {
    ...row.answers,
    account_owner_0: "m_richiedente_0",
    properties_count: 0,
    vehicles_count: 0,
    housing: "hosted",
    income_present_m_richiedente_0: false,
  };
  for (let pass = 0; pass < 10; pass++) {
    const missing = getQuestions("isee_ordinario", answers, language).filter(
      (q) => !Object.hasOwn(answers, q.id),
    );
    if (!missing.length) break;
    for (const question of missing) {
      expect(question.kind, question.id).toBe("yes_no");
      answers[question.id] = false;
    }
  }
  await db
    .update(cases)
    .set({ status: "intake", language, answers, confirmedAnswers: Object.keys(answers) })
    .where(eq(cases.id, row.id));
  return row;
}
const submission = (email: string | undefined = "citizen@example.test") => ({
  confirmed: true,
  contact: { firstName: "Persona", lastName: "Riservata", ...(email ? { email } : {}) },
  note: "Testo personale da escludere dalle email",
});
async function enableReceipts() {
  await db
    .update(settings)
    .set({ notifyCitizenSubmission: true })
    .where(eq(settings.organizationId, "a"));
}

for (const language of Language.options) {
  it(`${language}: first submission atomically queues a minimal localized receipt after commit`, async () => {
    const jobs = captureBackground();
    const row = await prepareSubmission(language);
    await enableReceipts();
    await db.update(offices).set({
      bookingUrl: "https://booking.example.test",
      citizenNote: "Nota privata dello sportello",
    });
    const response = await request(`/c/${citizenToken}/submit`, "POST", submission());
    expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "submitted",
      office: {
        bookingUrl: "https://booking.example.test",
        citizenNote: "Nota privata dello sportello",
      },
    });
    const [notice] = await db.select().from(notifications);
    expect(notice).toMatchObject({
      kind: "citizen_submission",
      language,
      organizationId: "a",
      caseId: row.id,
      dedupeKey: `citizen_submission:${row.id}`,
    });
    const mail = envelope(notice!);
    expect(mail).toEqual({
      to: "citizen@example.test",
      from: options.from,
      ...submissionReceipt(language, row.reference, "Sportello"),
    });
    expect(mail.text).toContain(row.reference);
    expect(mail.text).toContain("Sportello");
    expect(mail.text).not.toMatch(
      /Persona|Riservata|personale|Banca|ISEE|isee|https?:|www\.|case-link|\/pratica\/|Nota privata/,
    );
    expect(mail.subject).not.toContain(row.reference);
    expect(jobs).toHaveLength(1);
    expect(send).not.toHaveBeenCalled();
    await Promise.all([jobs[0]!(), jobs[0]!()]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logs)).not.toMatch(/Persona|Riservata|citizen@example|AV-2027/);
    if (language !== "it") expect(mail.text).not.toContain("Lo sportello controllerà");
    if (language === "uk") expect(mail.text).toContain("Ваш");
    if (language === "bn") expect(mail.text).toContain("আপনার");
  });
}

it("submission receipts are off by default, tenant-scoped, and not backfilled on resubmission", async () => {
  captureBackground();
  await prepareSubmission();
  await db.insert(settings).values({ organizationId: "b", notifyCitizenSubmission: true });
  expect((await (await request("/settings")).json()).notifyCitizenSubmission).toBe(false);
  expect((await request("/settings", "PATCH", { notifyCitizenSubmission: "true" })).status).toBe(
    400,
  );
  expect((await request(`/c/${citizenToken}/submit`, "POST", submission())).status).toBe(200);
  expect(await db.select().from(notifications)).toHaveLength(0);
  expect((await request("/settings", "PATCH", { notifyCitizenSubmission: true })).status).toBe(200);
  expect(await (await request("/settings", "PATCH", { linkDays: 7 })).json()).toMatchObject({
    notifyCitizenSubmission: true,
  });
  await db.update(cases).set({ status: "needs_citizen" });
  expect((await request(`/c/${citizenToken}/submit`, "POST", submission())).status).toBe(200);
  expect(await db.select().from(notifications)).toHaveLength(0);
});

it("no email on first submission means no receipt, even if added on resubmission", async () => {
  const jobs = captureBackground();
  await prepareSubmission();
  await enableReceipts();
  expect((await request(`/c/${citizenToken}/submit`, "POST", submission(""))).status).toBe(200);
  expect(await db.select().from(notifications)).toHaveLength(0);
  expect(jobs).toHaveLength(0);
  await db.update(cases).set({ status: "needs_citizen" });
  expect((await request(`/c/${citizenToken}/submit`, "POST", submission())).status).toBe(200);
  expect(await db.select().from(notifications)).toHaveLength(0);
});

it("concurrent submissions queue one receipt; reinvios and outbox cleanup cannot create another", async () => {
  const jobs = captureBackground();
  const row = await prepareSubmission();
  await enableReceipts();
  const responses = await Promise.all([
    request(`/c/${citizenToken}/submit`, "POST", submission()),
    request(`/c/${citizenToken}/submit`, "POST", submission()),
  ]);
  expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(await db.select().from(notifications)).toHaveLength(1);
  expect(jobs).toHaveLength(1);
  await jobs[0]!();
  await db.update(cases).set({ status: "needs_citizen" });
  expect((await request(`/c/${citizenToken}/submit`, "POST", submission())).status).toBe(200);
  expect(await db.select().from(notifications)).toHaveLength(1);
  await db.delete(notifications);
  await db.update(cases).set({ status: "intake" });
  expect((await request(`/c/${citizenToken}/submit`, "POST", submission())).status).toBe(200);
  expect(await db.select().from(notifications)).toHaveLength(0);
  expect(new Date((await db.select().from(cases))[0]!.submittedAt!).toISOString()).toBe(initial);
  expect(row.reference).toBe("AV-2027-TEST");
});

async function receiptCase(email: string, organizationId = "a") {
  const [template] = await db.select().from(cases).where(eq(cases.id, "case"));
  const id = crypto.randomUUID();
  const [row] = await db
    .insert(cases)
    .values({
      ...template!,
      id,
      reference: id,
      tokenHash: hashToken(id),
      organizationId,
      officeId: organizationId === "a" ? "office" : "office-b",
      contact: { firstName: "Persona", lastName: "Riservata", email },
    })
    .returning();
  return db.transaction((tx) => enqueueSubmissionReceipt(tx, s, row!));
}

it("suppresses the third receipt globally across tenants without blocking submission", async () => {
  const jobs = captureBackground();
  await prepareSubmission();
  await enableReceipts();
  await db.insert(settings).values({ organizationId: "b", notifyCitizenSubmission: true });
  await db.insert(offices).values({
    id: "office-b",
    organizationId: "b",
    slug: "other-receipts",
    name: "Altro sportello",
    city: "Roma",
    address: "Via Test",
  });
  expect(await receiptCase("citizen@example.test")).toBeTypeOf("string");
  expect(await receiptCase("citizen@example.test", "b")).toBeTypeOf("string");
  const response = await request(`/c/${citizenToken}/submit`, "POST", submission());
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ status: "submitted" });
  expect(await db.select().from(notifications)).toHaveLength(2);
  expect(
    (await db.select().from(cases).where(eq(cases.id, "case")))[0]!.submittedAt,
  ).not.toBeNull();
  expect(jobs).toHaveLength(0);
  expect((await db.select().from(rateLimits))[0]).toMatchObject({ count: 3 });
  expect(JSON.stringify(logs)).not.toContain("citizen@example.test");
});

it("normalizes receipt recipients, keeps independent HMAC counters, and expires at 24 hours", async () => {
  await fixture();
  await enableReceipts();
  expect(await receiptCase("Citizen@EXAMPLE.test")).toBeTypeOf("string");
  expect(await receiptCase("citizen@example.test")).toBeTypeOf("string");
  now = new Date(Date.parse(initial) + 86400_000 - 1);
  expect(await receiptCase("  CITIZEN@example.test  ")).toBeUndefined();
  expect(await receiptCase("other@example.test")).toBeTypeOf("string");
  expect(await receiptCase("other@example.test")).toBeTypeOf("string");
  expect(await receiptCase("other@example.test")).toBeUndefined();
  const counters = await db.select().from(rateLimits);
  expect(counters).toHaveLength(2);
  expect(counters.map((row) => row.count)).toEqual([3, 3]);
  expect(counters.every((row) => /^[a-f0-9]{64}$/.test(row.key))).toBe(true);
  expect(JSON.stringify(counters)).not.toMatch(/citizen|other|example|@/i);
  now = new Date(Date.parse(initial) + 86400_000);
  expect(await receiptCase("citizen@example.test")).toBeTypeOf("string");
  expect((await db.select().from(rateLimits)).map((row) => row.count).sort()).toEqual([1, 3]);
  expect(await db.select().from(notifications)).toHaveLength(5);
});

it.each([
  ["Vittima+1@EXAMPLE.test", "vittima+2@example.test", "vittima@example.test"],
  ["V.Ittima+1@GoogleMail.com", "vit.tima+2@gmail.com", "vittima@gmail.com"],
])("receipt aliases share a budget and preserve delivery addresses: %s", async (...aliases) => {
  await fixture();
  await enableReceipts();
  expect(await receiptCase(aliases[0])).toBeTypeOf("string");
  expect(await receiptCase(aliases[1])).toBeTypeOf("string");
  expect(await receiptCase(aliases[2])).toBeUndefined();
  const queued = await db.select().from(notifications);
  expect(queued).toHaveLength(2);
  expect(
    queued.map((row) => unseal(options, `${row.id}:${row.kind}:${row.language}`, row.envelope!).to),
  ).toEqual(expect.arrayContaining(aliases.slice(0, 2)));
  expect(await db.select().from(rateLimits)).toMatchObject([{ count: 3 }]);
  const domain = aliases[2].split("@")[1]!;
  expect(await receiptCase(`other@${domain}`)).toBeTypeOf("string");
});

it("concurrent receipts for different cases share the atomic recipient budget", async () => {
  await fixture();
  await enableReceipts();
  const ids = await Promise.all(
    Array.from({ length: 5 }, (_, index) => receiptCase(`citizen+${index}@example.test`)),
  );
  expect(ids.filter(Boolean)).toHaveLength(2);
  expect(await db.select().from(notifications)).toHaveLength(2);
  expect((await db.select().from(rateLimits))[0]).toMatchObject({ count: 5 });
});

it("receipt encryption failure rolls back submission and audit and schedules no delivery", async () => {
  const jobs = captureBackground();
  await prepareSubmission();
  await enableReceipts();
  s.notifications = { ...options, key: Buffer.alloc(1) };
  expect((await request(`/c/${citizenToken}/submit`, "POST", submission())).status).toBe(500);
  expect((await db.select().from(cases))[0]).toMatchObject({ status: "intake", submittedAt: null });
  expect(await db.select().from(events)).toHaveLength(0);
  expect(await db.select().from(notifications)).toHaveLength(0);
  expect(await db.select().from(rateLimits)).toHaveLength(0);
  expect(jobs).toHaveLength(0);
});

it.each(["preference", "language", "email", "expired"])(
  "pending receipt cancels after %s changes",
  async (change) => {
    captureBackground();
    await prepareSubmission();
    await enableReceipts();
    expect((await request(`/c/${citizenToken}/submit`, "POST", submission())).status).toBe(200);
    if (change === "preference") await db.update(settings).set({ notifyCitizenSubmission: false });
    if (change === "language") await db.update(cases).set({ language: "en" });
    if (change === "email")
      await db.update(cases).set({ contact: { firstName: "Persona", lastName: "Riservata" } });
    if (change === "expired") await db.update(cases).set({ expiresAt: initial });
    await sendNotifications(s, now);
    expect(send).not.toHaveBeenCalled();
    expect((await db.select().from(notifications))[0]).toMatchObject({
      state: "cancelled",
      envelope: null,
    });
  },
);

it("receipt association cannot cross tenants", async () => {
  const row = await prepareSubmission();
  await expect(
    enqueueNotification(
      db,
      options,
      {
        kind: "citizen_submission",
        language: "it",
        organizationId: "b",
        caseId: row.id,
        dedupeKey: "foreign-receipt",
        to: row.contact!.email!,
        email: submissionReceipt("it", row.reference, "Altro sportello"),
      },
      now,
    ),
  ).rejects.toThrow();
});

it("even an office named after a URL cannot insert clickable addresses in a receipt", () => {
  const mail = submissionReceipt(
    "it",
    "AV-2027-TEST",
    "https://evil.example/a www.example.test mail@evil.test evil。test",
  );
  expect(mail.text).not.toMatch(/https?:|www\.|@|evil[.。]test/);
});
