import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  createDatabase,
  cases,
  documents,
  events,
  messages,
  offices,
  operators,
  organizations,
  settings,
  type Database,
} from "@avanti/db";
import { bootstrapOrganization } from "./admin-bootstrap";
import { exportOrganization } from "./organization-export";
import { requireProductionDatabase } from "./admin-terminal";
import { hashPassword, verifyPassword } from "./security";
import { createApp } from "./app";
import { MemoryStorage } from "./storage";

let db: Database, close: () => Promise<void>;
const now = new Date("2027-01-01T10:00:00Z");
const input = {
  organization: { name: "CAF sintetico", kind: "caf" },
  office: { name: "Sportello", slug: "caf-sintetico", address: "Indirizzo fittizio", city: "Roma" },
  admin: { name: "Admin sintetico", email: "admin@example.test" },
  confirmation: "CREA CAF PILOTA",
};
const secret = randomBytes(32).toString("hex");
let organizationId: string, adminId: string, officeId: string;
beforeAll(async () => {
  ({ db, close } = await createDatabase({ memory: true }));
});
afterAll(async () => {
  await close?.();
});
it("requires confirmation, refuses repeats, hashes the credential and enforces first password change", async () => {
  await expect(bootstrapOrganization(db, { ...input, confirmation: "yes" }, now)).rejects.toThrow(
    "conferma",
  );
  expect(await db.select().from(organizations)).toHaveLength(0);
  const created = await bootstrapOrganization(db, input, now);
  ({ organizationId, adminId, officeId } = created);
  const [admin] = await db.select().from(operators);
  expect(admin).toMatchObject({ role: "admin", mustChangePassword: true });
  expect(admin!.passwordHash).not.toContain(created.temporaryPassword);
  expect(await verifyPassword(created.temporaryPassword, admin!.passwordHash)).toBe(true);
  expect(await db.select().from(settings)).toMatchObject([{ baselineMinutesPerCase: null }]);
  const app = createApp({ db, storage: new MemoryStorage() });
  const login = await app.request("/api/auth/login", {
    method: "POST",
    headers: { Origin: "http://localhost:3400", "Content-Type": "application/json" },
    body: JSON.stringify({ email: input.admin.email, password: created.temporaryPassword }),
  });
  expect(login.status).toBe(200);
  expect(
    (
      await app.request("/api/cases", {
        headers: { Cookie: login.headers.get("set-cookie")!.split(";")[0]! },
      })
    ).status,
  ).toBe(403);
  await expect(bootstrapOrganization(db, input, now)).rejects.toThrow("esiste già");
  expect(await db.select().from(operators)).toHaveLength(1);
  await expect(
    exportOrganization(
      db,
      { organizationId, login: { email: input.admin.email, password: created.temporaryPassword } },
      now,
      secret,
    ),
  ).rejects.toThrow("Accesso negato");
  await db
    .update(operators)
    .set({ passwordHash: await hashPassword("PasswordDefinitiva2027!"), mustChangePassword: false })
    .where(eq(operators.id, adminId));
});
it("exports a consistent organization only, includes raw answers/events/hashes and omits access secrets", async () => {
  await db.insert(organizations).values({ id: "other", name: "CAF esterno", kind: "caf" });
  await db.insert(offices).values({
    id: "other-office",
    organizationId: "other",
    slug: "other",
    name: "Altra",
    address: "Altra",
    city: "Roma",
  });
  for (const [id, org, office] of [
    ["case", organizationId, officeId],
    ["other-case", "other", "other-office"],
  ]) {
    await db.insert(cases).values({
      id: id!,
      organizationId: org!,
      officeId: office!,
      tokenHash: `private-capability-${id}`,
      reference: id!,
      language: "it",
      answers: { household_size: 2 },
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: "2027-03-01T00:00:00Z",
    });
    await db.insert(documents).values({
      id: `doc-${id}`,
      caseId: id!,
      fileName: "ESEMPIO.pdf",
      mimeType: "application/pdf",
      sizeBytes: 10,
      storageKey: "private-storage-key",
      sha256: "a".repeat(64),
      uploadedAt: now.toISOString(),
      status: "analyzed",
    });
    await db.insert(messages).values({
      id: `message-${id}`,
      caseId: id!,
      role: "citizen",
      text: id === "case" ? "Esempio" : "outside-content",
      createdAt: now.toISOString(),
    });
    await db.insert(events).values({
      id: `event-${id}`,
      organizationId: org!,
      caseId: id!,
      actor: "citizen",
      type: "case.created",
      at: now.toISOString(),
    });
  }
  const login = { email: input.admin.email, password: "PasswordDefinitiva2027!" };
  await expect(
    exportOrganization(db, { organizationId: "other", login }, now, secret),
  ).rejects.toThrow("Accesso negato");
  await expect(
    exportOrganization(db, { organizationId, login: { ...login, password: "wrong" } }, now, secret),
  ).rejects.toThrow("Accesso negato");
  const data = await exportOrganization(db, { organizationId, login }, now, secret);
  expect(data.cases).toHaveLength(1);
  expect(data.cases[0]!.answers).toEqual({ household_size: 2 });
  expect(data.documents).toMatchObject([{ sha256: "a".repeat(64) }]);
  expect(data.events.some((event) => event.type === "organization.exported")).toBe(true);
  const json = JSON.stringify(data);
  for (const omitted of [
    "private-capability",
    "private-storage-key",
    "passwordHash",
    "scrypt:",
    "outside-content",
    "other-case",
  ])
    expect(json).not.toContain(omitted);
  await db.update(operators).set({ role: "operator" }).where(eq(operators.id, adminId));
  await expect(exportOrganization(db, { organizationId, login }, now, secret)).rejects.toThrow(
    "Accesso negato",
  );
  await db.update(operators).set({ role: "admin", active: false }).where(eq(operators.id, adminId));
  await expect(exportOrganization(db, { organizationId, login }, now, secret)).rejects.toThrow(
    "Accesso negato",
  );
  await expect(bootstrapOrganization(db, input, now)).rejects.toThrow("esiste già");
});
it("CLI production guard never falls back to local data or accepts a non-TLS URL", () => {
  for (const env of [
    {},
    { NODE_ENV: "production" },
    { NODE_ENV: "production", DATABASE_URL: "postgres://user@db.example/app" },
  ])
    expect(() => requireProductionDatabase(env)).toThrow();
  expect(() =>
    requireProductionDatabase({
      NODE_ENV: "production",
      DATABASE_URL: "postgres://user@db.example/app?sslmode=require",
    }),
  ).not.toThrow();
});
