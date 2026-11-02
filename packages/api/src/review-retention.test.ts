import { randomBytes } from "node:crypto";
import { expect, it } from "vitest";
import { createDatabase, leads, notifications } from "@avanti/db";
import { createApp } from "./app";
import { ConsoleEmail } from "./email";
import { MemoryStorage } from "./storage";

it("review: a lead stays for two years, its outbox payload expires sooner, then both go", async () => {
  const { db, close } = await createDatabase({ memory: true });
  try {
    let now = new Date("2027-01-15T10:00:00.000Z");
    const app = createApp({
      db,
      storage: new MemoryStorage(),
      clock: () => now,
      cronSecret: "review-cron",
      notifications: {
        key: randomBytes(32),
        adapter: new ConsoleEmail(() => {}),
        leadsEmail: "team@example.test",
      },
    });
    const input = {
      name: "Candidatura di prova",
      organization: "CAF Prova",
      email: "lead@example.test",
      phone: "12345",
      message: "Richiesta di ricontatto",
      privacyAccepted: true,
    };
    const created = await app.request("/api/leads", {
      method: "POST",
      headers: { Origin: "http://localhost:3400", "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    expect(created.status).toBe(201);
    const [before] = await db.select().from(notifications);
    expect(before).toMatchObject({ state: "pending", kind: "pilot_lead" });
    expect(before?.envelope).toBeTypeOf("string");

    // Day 729: the payload expired long ago, the application is still there.
    now = new Date(now.getTime() + 729 * 86400_000);
    const maintenance = await app.request("/api/cron/maintenance", {
      headers: { Authorization: "Bearer review-cron" },
    });
    expect(maintenance.status).toBe(200);
    expect(await maintenance.json()).toMatchObject({ ok: true, deletedCases: 0, deletedLeads: 0 });
    const [retained] = await db.select().from(leads);
    expect(retained).toMatchObject({
      name: input.name,
      organization: input.organization,
      email: input.email,
      phone: input.phone,
      message: input.message,
    });
    expect(await db.select().from(notifications)).toEqual([
      expect.objectContaining({
        leadId: retained!.id,
        envelope: null,
        state: "failed",
        lastError: "payload_expired",
      }),
    ]);

    now = new Date(now.getTime() + 2 * 86400_000);
    const later = await app.request("/api/cron/maintenance", {
      headers: { Authorization: "Bearer review-cron" },
    });
    expect(await later.json()).toMatchObject({ deletedLeads: 1 });
    expect(await db.select().from(leads)).toEqual([]);
    expect(await db.select().from(notifications)).toEqual([]);
  } finally {
    await close();
  }
});
