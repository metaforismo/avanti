import { randomBytes } from "node:crypto";
import { expect, it } from "vitest";
import { createDatabase, leads, notifications } from "@avanti/db";
import { createApp } from "./app";
import { ConsoleEmail } from "./email";
import { MemoryStorage } from "./storage";

it("review: lead personal data survives maintenance after ten years while its outbox payload expires", async () => {
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

    now = new Date(now.getTime() + 3651 * 86400_000);
    const maintenance = await app.request("/api/cron/maintenance", {
      headers: { Authorization: "Bearer review-cron" },
    });
    expect(maintenance.status).toBe(200);
    expect(await maintenance.json()).toMatchObject({ ok: true, deletedCases: 0 });
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
  } finally {
    await close();
  }
});
