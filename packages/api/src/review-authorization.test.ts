import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  cases,
  createDatabase,
  events,
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
import type { Intelligence } from "./ai";
import { hashToken } from "./security";
import { MemoryStorage } from "./storage";

const now = new Date("2027-06-01T10:00:00.000Z");
const adminToken = "a".repeat(43);
const operatorToken = "b".repeat(43);
let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createDatabase({ memory: true }));
});
afterAll(async () => close());
beforeEach(async () => {
  await db.delete(organizations);
  await db.delete(rateLimits);
  await db.insert(organizations).values({ id: "org", name: "CAF", kind: "caf" });
  await db.insert(offices).values({
    id: "office",
    organizationId: "org",
    name: "Sportello",
    slug: "sportello",
    address: "Via Roma",
    city: "Roma",
  });
  await db.insert(operators).values([
    {
      id: "admin",
      organizationId: "org",
      name: "Admin",
      email: "admin@example.test",
      passwordHash: "unused",
      role: "admin",
    },
    {
      id: "operator",
      organizationId: "org",
      name: "Operatore",
      email: "operator@example.test",
      passwordHash: "unused",
      role: "operator",
    },
  ]);
  await db.insert(cases).values({
    id: "case",
    organizationId: "org",
    officeId: "office",
    reference: "AV-2027-REVIEW",
    tokenHash: hashToken("citizen"),
    language: "it",
    practiceId: "isee_ordinario",
    status: "in_review",
    contact: { email: "citizen@example.test" },
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: "2027-07-01T10:00:00.000Z",
  });
  await db.insert(sessions).values([
    {
      id: "admin-session",
      operatorId: "admin",
      tokenHash: hashToken(adminToken),
      createdAt: now.toISOString(),
      expiresAt: "2027-06-01T11:00:00.000Z",
    },
    {
      id: "operator-session",
      operatorId: "operator",
      tokenHash: hashToken(operatorToken),
      createdAt: now.toISOString(),
      expiresAt: "2027-06-01T11:00:00.000Z",
    },
  ]);
});

it.each(["deactivate", "reset-password", "reset-mfa", "logout", "expire", "require-mfa"] as const)(
  "rejects an integration finishing after %s revoked its authorization",
  async (operation) => {
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const ai: Intelligence = {
      async intake() {
        throw new Error("unused");
      },
      async analyze() {
        throw new Error("unused");
      },
      async translate(text) {
        entered();
        await gate;
        return { text, engine: "heuristic" };
      },
    };
    let currentTime = now;
    const app = createApp({
      db,
      storage: new MemoryStorage(),
      ai,
      clock: () => currentTime,
      mfaEncryptionKey: "a".repeat(64),
    });
    const request = (path: string, token: string, method: string, input: unknown) =>
      app.request(`/api${path}`, {
        method,
        headers: {
          Origin: "http://localhost:3400",
          Cookie: `avanti_session=${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });
    const pending = request("/cases/case/requests", operatorToken, "POST", {
      message: "Invia il documento",
      checklistItemIds: [],
      expectedUpdatedAt: now.toISOString(),
    });
    await started;
    let revoked: Response;
    try {
      if (operation === "expire") {
        currentTime = new Date(now.getTime() + 31 * 60_000);
        revoked = new Response(null, { status: 200 });
      } else if (operation === "require-mfa") {
        revoked = await request("/settings", adminToken, "PATCH", { mfaRequired: true });
      } else
        revoked =
          operation === "logout"
            ? await request("/auth/logout", operatorToken, "POST", {})
            : operation === "deactivate"
              ? await request("/operators/operator", adminToken, "PATCH", { active: false })
              : await request(`/operators/operator/${operation}`, adminToken, "POST", {});
    } finally {
      release();
    }
    expect(revoked.status).toBe(200);
    const result = await pending;
    const [current] = await db.select().from(cases).where(eq(cases.id, "case"));
    expect({
      status: current!.status,
      updatedAt: new Date(current!.updatedAt).toISOString(),
      messages: (await db.select().from(messages)).length,
      notifications: (await db.select().from(notifications)).length,
      integrationEvents: (await db.select().from(events).where(eq(events.type, "case.requested")))
        .length,
    }).toEqual({
      status: "in_review",
      updatedAt: now.toISOString(),
      messages: 0,
      notifications: 0,
      integrationEvents: 0,
    });
    expect([401, 403]).toContain(result.status);
  },
);

it("rejects an admin mutation when logout finishes while its body is still arriving", async () => {
  const app = createApp({
    db,
    storage: new MemoryStorage(),
    clock: () => now,
    mfaEncryptionKey: "a".repeat(64),
  });
  let bodyController!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      bodyController = controller;
    },
  });
  const pending = app.request(
    new Request("http://localhost:3400/api/settings", {
      method: "PATCH",
      headers: {
        Origin: "http://localhost:3400",
        Cookie: `avanti_session=${adminToken}`,
        "Content-Type": "application/json",
      },
      body: stream,
      duplex: "half",
    } as RequestInit),
  );
  let authenticated = false;
  try {
    // The idle expiry is renewed by authentication before the route consumes its body.
    // Observe that boundary rather than relying on a delay or scheduler ordering.
    for (let attempt = 0; attempt < 100; attempt++) {
      const [session] = await db.select().from(sessions).where(eq(sessions.id, "admin-session"));
      if (new Date(session!.expiresAt).getTime() === now.getTime() + 30 * 60_000) {
        authenticated = true;
        break;
      }
    }
    expect(authenticated).toBe(true);
    const logout = await app.request("/api/auth/logout", {
      method: "POST",
      headers: { Origin: "http://localhost:3400", Cookie: `avanti_session=${adminToken}` },
    });
    expect(logout.status).toBe(200);
  } finally {
    bodyController.enqueue(new TextEncoder().encode(JSON.stringify({ retentionDays: 45 })));
    bodyController.close();
  }
  const result = await pending;
  expect([401, 403]).toContain(result.status);
  expect(await db.select().from(settings)).toHaveLength(0);
  expect(await db.select().from(events).where(eq(events.type, "settings.updated"))).toHaveLength(0);
});
