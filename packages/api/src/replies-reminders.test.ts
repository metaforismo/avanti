import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { Language, QuickReplyList, OrganizationSettings } from "@avanti/contracts";
import {
  cases,
  createDatabase,
  events,
  notifications,
  offices,
  operators,
  organizations,
  quickReplies,
  sessions,
  settings,
  type Database,
} from "@avanti/db";
import { createApp } from "./app";
import { hashToken } from "./security";
import { MemoryStorage } from "./storage";
import { GatewayIntelligence } from "./ai";
import { mfaCipher } from "./mfa";
import type { Services } from "./context";
import { ConsoleEmail, DeliveryFailure, type Delivery } from "./email";
import { enqueueReminders, sendNotifications } from "./notifications";
import { reminderNotification } from "./reminder-copy";
import { dossierView } from "./dossier";

const origin = "http://localhost:3400";
const initial = "2027-01-15T10:00:00.000Z";
const citizenToken = "c".repeat(43);
const tokens = { admin: "a".repeat(43), operator: "o".repeat(43), foreign: "f".repeat(43) };
let db: Database, close: () => Promise<void>, now: Date, s: Services;
let send: ReturnType<typeof vi.fn<(delivery: Delivery) => Promise<void>>>;
beforeAll(async () => {
  ({ db, close } = await createDatabase({ memory: true }));
});
afterAll(async () => {
  await close?.();
});
beforeEach(async () => {
  await db.execute(sql`truncate organizations, notifications, system_jobs cascade`);
  now = new Date(initial);
  send = vi.fn(async (_delivery: Delivery) => {});
  s = {
    db,
    clock: () => now,
    storage: new MemoryStorage(),
    ai: new GatewayIntelligence(),
    publicUrl: origin,
    production: false,
    cronSecret: "test-cron",
    mfa: mfaCipher({ key: "12".repeat(32) }),
    notifications: {
      key: randomBytes(32),
      from: "avanti@example.test",
      adapter: { mode: "resend", send },
    },
    errorLogger: () => {},
  };
  await db.insert(organizations).values([
    { id: "a", name: "CAF A", kind: "caf" },
    { id: "b", name: "CAF B", kind: "caf" },
  ]);
  await db.insert(offices).values({
    id: "office",
    organizationId: "a",
    slug: "test",
    name: "Test",
    city: "Roma",
    address: "Test",
  });
  for (const id of ["admin", "operator", "foreign"] as const) {
    await db.insert(operators).values({
      id,
      organizationId: id === "foreign" ? "b" : "a",
      name: id,
      email: `${id}@example.test`,
      passwordHash: "unused",
      role: id === "operator" ? "operator" : "admin",
    });
  }
  await db
    .insert(settings)
    .values([{ organizationId: "a" }, { organizationId: "b", notifyCitizenReminders: true }]);
});
async function request(
  path: string,
  method = "GET",
  input?: unknown,
  actor: keyof typeof tokens = "admin",
) {
  await db
    .insert(sessions)
    .values({
      id: actor,
      operatorId: actor,
      tokenHash: hashToken(tokens[actor]),
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 1800_000).toISOString(),
    })
    .onConflictDoUpdate({
      target: sessions.id,
      set: {
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 1800_000).toISOString(),
      },
    });
  return createApp(s).request(`/api${path}`, {
    method,
    headers: {
      Origin: origin,
      Cookie: `avanti_session=${tokens[actor]}`,
      "Content-Type": "application/json",
    },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  });
}
async function fixture(email = "citizen@example.test") {
  await db.insert(cases).values({
    id: "case",
    organizationId: "a",
    officeId: "office",
    tokenHash: hashToken(citizenToken),
    reference: "AV-2027-TEST",
    practiceId: "isee_ordinario",
    language: "it",
    status: "in_review",
    contact: { firstName: "Persona", lastName: "Riservata", ...(email ? { email } : {}) },
    createdAt: initial,
    updatedAt: initial,
    expiresAt: "2028-01-01T00:00:00Z",
  });
}
async function ask() {
  const [row] = await db.select().from(cases).where(eq(cases.id, "case"));
  const response = await request("/cases/case/requests", "POST", {
    expectedUpdatedAt: new Date(row!.updatedAt).toISOString(),
    checklistItemIds: [],
    message: "Carica una foto leggibile.",
  });
  expect(response.status, await response.clone().text()).toBe(200);
  // Initial integration notice is unrelated to reminder assertions.
  await sendNotifications(s, now);
  send.mockClear();
  return response.json();
}
async function enable(days = [3, 4]) {
  expect(
    (
      await request("/settings", "PATCH", {
        notifyCitizenReminders: true,
        citizenReminderDays: days,
      })
    ).status,
  ).toBe(200);
}
const advance = (days: number) => {
  now = new Date(now.getTime() + days * 86400_000);
};
const reminderRows = () =>
  db.select().from(notifications).where(eq(notifications.kind, "citizen_reminder"));
const cron = () =>
  createApp(s).request("/api/cron/maintenance", { headers: { Authorization: "Bearer test-cron" } });

it("quick replies require authentication; only admins mutate, and tenants are isolated", async () => {
  expect((await createApp(s).request("/api/quick-replies")).status).toBe(401);
  const input = { title: "Foto illeggibile", text: "Carica una foto a fuoco." };
  const created = await (await request("/quick-replies", "POST", input)).json();
  expect(created).toMatchObject({ ...input, position: 0 });
  const foreign = await (await request("/quick-replies", "POST", input, "foreign")).json();
  const own = QuickReplyList.parse(
    await (await request("/quick-replies", "GET", undefined, "operator")).json(),
  );
  expect(own.map((row) => row.id)).toEqual([created.id]);
  for (const [path, method, body] of [
    ["/quick-replies", "POST", input],
    [`/quick-replies/${created.id}`, "PATCH", { text: "Nuovo testo" }],
    [`/quick-replies/${created.id}`, "DELETE", undefined],
    ["/quick-replies/reorder", "PUT", { ids: [created.id] }],
  ] as const)
    expect((await request(path, method, body, "operator")).status).toBe(403);
  expect((await request(`/quick-replies/${foreign.id}`, "PATCH", input)).status).toBe(404);
  expect((await request(`/quick-replies/${foreign.id}`, "DELETE")).status).toBe(404);
  expect((await request("/quick-replies/reorder", "PUT", { ids: [foreign.id] })).status).toBe(409);
  // Operators use the stored text through the integration/translation endpoint.
  await fixture();
  expect(
    (
      await request(
        "/cases/case/requests",
        "POST",
        {
          expectedUpdatedAt: initial,
          checklistItemIds: [],
          message: own[0]!.text,
        },
        "operator",
      )
    ).status,
  ).toBe(200);
});

it("quick replies validate SafeText, lengths and nonempty patches without storing unsafe text in activity", async () => {
  for (const input of [
    { title: "", text: "ok" },
    { title: "x".repeat(81), text: "ok" },
    { title: "Titolo\nAltro", text: "ok" },
    { title: "Titolo", text: "   " },
    { title: "Titolo", text: "x".repeat(1001) },
    { title: "Titolo", text: "bad\u202Etext" },
    { title: "Titolo", text: "bad\u0000text" },
    { title: "Titolo", text: "ok", organizationId: "b" },
  ])
    expect((await request("/quick-replies", "POST", input)).status).toBe(400);
  const created = await (
    await request("/quick-replies", "POST", { title: "Titolo", text: "TESTO RISERVATO" })
  ).json();
  expect((await request(`/quick-replies/${created.id}`, "PATCH", {})).status).toBe(400);
  const result = await request(`/quick-replies/${created.id}`, "PATCH", { text: "Nuovo testo" });
  expect(await result.json()).toMatchObject({ title: "Titolo", text: "Nuovo testo" });
  const audit = await (await request("/audit")).json();
  expect(audit.items.map((item: { action: string }) => item.action)).toEqual(
    expect.arrayContaining(["quick_reply.created", "quick_reply.updated"]),
  );
  expect(JSON.stringify(await db.select().from(events))).not.toContain("TESTO RISERVATO");
});

it("reorders a complete unique list, compacts deletion, and enforces the 50-slot limit concurrently", async () => {
  await db.insert(quickReplies).values(
    Array.from({ length: 49 }, (_, position) => ({
      id: `reply-${position}`,
      organizationId: "a",
      position,
      title: "Titolo",
      text: "Testo",
    })),
  );
  const results = await Promise.all([
    request("/quick-replies", "POST", { title: "Ultimo", text: "Testo" }),
    request("/quick-replies", "POST", { title: "Troppo", text: "Testo" }),
  ]);
  expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
  const ids = (await db.select().from(quickReplies).orderBy(quickReplies.position))
    .map((row) => row.id)
    .reverse();
  expect((await request("/quick-replies/reorder", "PUT", { ids: [ids[0], ids[0]] })).status).toBe(
    400,
  );
  expect((await request("/quick-replies/reorder", "PUT", { ids: ids.slice(1) })).status).toBe(409);
  const response = await request("/quick-replies/reorder", "PUT", { ids });
  expect(QuickReplyList.parse(await response.json()).map((row) => row.id)).toEqual(ids);
  expect((await request(`/quick-replies/${ids[20]}`, "DELETE")).status).toBe(204);
  const rows = QuickReplyList.parse(await (await request("/quick-replies")).json());
  expect(rows.map((row) => row.position)).toEqual(Array.from({ length: 49 }, (_, index) => index));
  expect(rows.map((row) => row.id)).toEqual(ids.filter((_, index) => index !== 20));
  const audit = await db.select().from(events);
  expect(audit.map((row) => row.type)).toEqual(
    expect.arrayContaining(["quick_reply.reordered", "quick_reply.deleted"]),
  );
});

it("reminder defaults are off, validates 1-2 delays, preserves omitted settings and admin permissions", async () => {
  expect(OrganizationSettings.parse(await (await request("/settings")).json())).toMatchObject({
    notifyCitizenReminders: false,
    citizenReminderDays: [3, 4],
  });
  for (const days of [[], [0], [31], [1.5], [1, 2, 3], ["3"], null])
    expect((await request("/settings", "PATCH", { citizenReminderDays: days })).status).toBe(400);
  expect((await request("/settings", "PATCH", { notifyCitizenReminders: "true" })).status).toBe(
    400,
  );
  expect(
    (await request("/settings", "PATCH", { notifyCitizenReminders: true }, "operator")).status,
  ).toBe(403);
  await enable([2]);
  expect(await (await request("/settings", "PATCH", { linkDays: 7 })).json()).toMatchObject({
    notifyCitizenReminders: true,
    citizenReminderDays: [2],
  });
  expect(
    (await db.select().from(settings).where(eq(settings.organizationId, "b")))[0]!
      .citizenReminderDays,
  ).toEqual([3, 4]);
});

it("daily cron sends at 3 days, then 4 days after delivery; reruns/concurrent workers never duplicate and stop at 2", async () => {
  await fixture();
  await enable();
  await ask();
  advance(2);
  expect(await enqueueReminders(s, now)).toBe(0);
  advance(1);
  expect(await (await cron()).json()).toMatchObject({
    queuedReminders: 1,
    deliveredNotifications: 1,
  });
  expect(await (await cron()).json()).toMatchObject({ skipped: true });
  expect(await enqueueReminders(s, now)).toBe(0);
  advance(3);
  expect(await enqueueReminders(s, now)).toBe(0);
  advance(1);
  await Promise.all([enqueueReminders(s, now), enqueueReminders(s, now)]);
  await Promise.all([sendNotifications(s, now), sendNotifications(s, now)]);
  expect(send).toHaveBeenCalledTimes(2);
  advance(60);
  expect(await enqueueReminders(s, now)).toBe(0);
  expect((await reminderRows()).map((row) => row.reminderNumber).sort()).toEqual([1, 2]);
  const [row] = await db.select().from(cases).where(eq(cases.id, "case"));
  const dossier = await dossierView(db, row!, now);
  expect(dossier.timeline.filter((event) => event.type === "citizen.reminder_sent")).toMatchObject([
    { label: "Promemoria inviato", at: "2027-01-18T10:00:00.000Z" },
    { label: "Promemoria inviato", at: "2027-01-22T10:00:00.000Z" },
  ]);
  expect(new Date(row!.updatedAt).toISOString()).toBe("2027-01-15T10:00:00.001Z");
});

it("does not remind without email, opt-in, request tracking or a valid citizen link", async () => {
  await fixture("");
  await enable();
  await ask();
  advance(3);
  expect(await enqueueReminders(s, now)).toBe(0);
  await db.update(cases).set({ contact: { email: "citizen@example.test" } });
  await db
    .update(settings)
    .set({ notifyCitizenReminders: false })
    .where(eq(settings.organizationId, "a"));
  expect(await enqueueReminders(s, now)).toBe(0);
  await enable();
  await db.update(cases).set({ expiresAt: now.toISOString() });
  expect(await enqueueReminders(s, now)).toBe(0);
  await db.update(cases).set({ expiresAt: "2028-01-01T00:00:00Z", citizenRequestId: null });
  expect(await enqueueReminders(s, now)).toBe(0);
});

it("a citizen reply before delivery cancels a queued reminder, even while needs_citizen remains", async () => {
  await fixture();
  await enable();
  await ask();
  advance(3);
  expect(await enqueueReminders(s, now)).toBe(1);
  const response = await createApp(s).request(`/api/c/${citizenToken}/turn`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "text", text: "Ho bisogno di aiuto." }),
  });
  expect(response.status, await response.clone().text()).toBe(200);
  await sendNotifications(s, now);
  advance(10);
  expect(await enqueueReminders(s, now)).toBe(0);
  expect(send).not.toHaveBeenCalled();
  expect(await reminderRows()).toMatchObject([{ state: "cancelled", envelope: null }]);
  expect((await db.select().from(cases))[0]).toMatchObject({
    status: "needs_citizen",
    citizenRequestId: null,
  });
});

it("state changes between reminders cancel the second; a new request cannot revive stale mail", async () => {
  await fixture();
  await enable();
  await ask();
  advance(3);
  await enqueueReminders(s, now);
  await sendNotifications(s, now);
  advance(4);
  await enqueueReminders(s, now);
  const [row] = await db.select().from(cases);
  expect(
    (
      await request("/cases/case", "PATCH", {
        expectedUpdatedAt: new Date(row!.updatedAt).toISOString(),
        status: "in_review",
      })
    ).status,
  ).toBe(200);
  await ask(); // This clears send mock; the first request's queued second reminder is cancelled too.
  expect((await reminderRows()).map((row) => row.state)).toEqual(["sent", "cancelled"]);
  await sendNotifications(s, now);
  expect(send).not.toHaveBeenCalled();
  advance(3);
  expect(await enqueueReminders(s, now)).toBe(1);
  await sendNotifications(s, now);
  expect(send).toHaveBeenCalledTimes(1);
  expect(new Set((await reminderRows()).map((row) => row.dedupeKey)).size).toBe(3);
});

it("disabling reminders or removing the second interval cancels even already queued delivery", async () => {
  await fixture();
  await enable();
  await ask();
  advance(3);
  await enqueueReminders(s, now);
  await db
    .update(settings)
    .set({ notifyCitizenReminders: false })
    .where(eq(settings.organizationId, "a"));
  await sendNotifications(s, now);
  expect(send).not.toHaveBeenCalled();
  await enable();
  await ask();
  advance(3);
  await enqueueReminders(s, now);
  await sendNotifications(s, now);
  advance(4);
  await enqueueReminders(s, now);
  await enable([3]);
  send.mockClear();
  await sendNotifications(s, now);
  expect(send).not.toHaveBeenCalled();
  expect((await reminderRows()).map((row) => row.state)).toEqual([
    "cancelled",
    "sent",
    "cancelled",
  ]);
});

it("second delay starts after first delivery, and permanent counters survive outbox receipt cleanup", async () => {
  await fixture();
  await enable();
  await ask();
  advance(3);
  await enqueueReminders(s, now);
  send.mockRejectedValueOnce(new DeliveryFailure("provider_unavailable", true));
  await sendNotifications(s, now);
  advance(5);
  expect(await enqueueReminders(s, now)).toBe(0);
  await sendNotifications(s, now);
  advance(3);
  expect(await enqueueReminders(s, now)).toBe(0);
  advance(1);
  expect(await enqueueReminders(s, now)).toBe(1);
  await sendNotifications(s, now);
  await db.delete(notifications).where(eq(notifications.kind, "citizen_reminder"));
  advance(40);
  expect(await enqueueReminders(s, now)).toBe(0);
});

it("outbox failures roll back counters, and console delivery writes an explicitly simulated history entry", async () => {
  await fixture();
  await enable();
  await ask();
  advance(3);
  const options = s.notifications;
  s.notifications = { ...options, key: Buffer.alloc(1) };
  await expect(enqueueReminders(s, now)).rejects.toThrow();
  expect((await db.select().from(cases))[0]!.citizenRemindersQueued).toBe(0);
  expect(await reminderRows()).toHaveLength(0);
  s.notifications = { ...options, adapter: new ConsoleEmail(() => {}) };
  await enqueueReminders(s, now);
  await sendNotifications(s, now);
  expect(await reminderRows()).toMatchObject([{ state: "simulated" }]);
  expect(
    await db.select().from(events).where(eq(events.type, "citizen.reminder_sent")),
  ).toHaveLength(0);
  expect(
    await db.select().from(events).where(eq(events.type, "citizen.reminder_simulated")),
  ).toHaveLength(1);
});

for (const language of Language.options) {
  it(`${language}: reminder delivery uses citizen language and contains no links, names or case details`, async () => {
    await fixture();
    await enable([1]);
    await db.update(cases).set({ language });
    await ask();
    advance(1);
    expect(await enqueueReminders(s, now)).toBe(1);
    await sendNotifications(s, now);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0]).toMatchObject({
      kind: "citizen_reminder",
      email: reminderNotification(language),
    });
    const email = send.mock.calls[0]![0].email;
    expect(JSON.stringify(email)).not.toMatch(
      /https?:|\/pratica\/|Persona|Riservata|AV-2027|Carica una foto|CAF A/,
    );
    advance(30);
    expect(await enqueueReminders(s, now)).toBe(0);
  });
}

it("rechecks state between claiming the outbox row and final delivery", async () => {
  await fixture();
  await enable();
  await ask();
  advance(3);
  await enqueueReminders(s, now);
  const original = db.transaction.bind(db);
  const transaction = vi.spyOn(db, "transaction").mockImplementationOnce(async (action, config) => {
    const result = await original(action, config);
    await db
      .update(cases)
      .set({ status: "in_review", citizenRequestId: null })
      .where(eq(cases.id, "case"));
    return result;
  });
  try {
    await sendNotifications(s, now);
  } finally {
    transaction.mockRestore();
  }
  expect(send).not.toHaveBeenCalled();
  expect(await reminderRows()).toMatchObject([{ state: "cancelled", attempts: 1 }]);
});

it("changing a recipient or language after enqueue cancels the old envelope", async () => {
  await fixture();
  await enable();
  await ask();
  advance(3);
  await enqueueReminders(s, now);
  await db.update(cases).set({ contact: { email: "other@example.test" }, language: "fr" });
  await sendNotifications(s, now);
  expect(send).not.toHaveBeenCalled();
  expect(await reminderRows()).toMatchObject([{ state: "cancelled" }]);
});
