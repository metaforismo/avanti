import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { and, eq, isNull, sql } from "drizzle-orm";
import { AuditEvent, AuditPage, TemporaryPasswordResponse } from "@avanti/contracts";
import {
  cases,
  createDatabase,
  events,
  offices,
  operators,
  organizations,
  rateLimits,
  sessions,
  type Database,
} from "@avanti/db";
import { createApp } from "./app";
import { MemoryStorage } from "./storage";
import { hashPassword, hashToken, newToken } from "./security";
import {
  auditCsv,
  AUDIT_EXPORT_MAX_ROWS,
  AUDIT_RETENTION_BATCH,
  purgeAuditEvents,
  romeInstant,
} from "./audit-log";
import { eraseCase } from "./case-erasure";

let db: Database;
let close: () => Promise<void>;
let app: ReturnType<typeof createApp>;
let hash: string;
let admin: string;
let normal: string;
let foreign: string;
const now = new Date("2027-06-01T10:00:00.000Z");
const password = "TestAvantiPassword!";
function request(path: string, cookie = admin, method = "GET", body?: unknown) {
  return app.request(`/api${path}`, {
    method,
    headers: {
      Cookie: cookie,
      Origin: "http://localhost:3400",
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function session(id: string) {
  const token = newToken();
  await db.insert(sessions).values({
    id: crypto.randomUUID(),
    operatorId: id,
    tokenHash: hashToken(token),
    createdAt: now.toISOString(),
    expiresAt: "2027-06-01T11:00:00Z",
  });
  return `avanti_session=${token}`;
}
async function event(id: string, extra: Partial<typeof events.$inferInsert> = {}) {
  await db.insert(events).values({
    id,
    organizationId: "a",
    actor: "operator",
    actorId: "admin-a",
    type: "case.exported",
    at: now.toISOString(),
    ...extra,
  });
}
async function page(path = "/audit", cookie = admin) {
  const response = await request(path, cookie);
  expect(response.status).toBe(200);
  return AuditPage.parse(await response.json());
}
beforeAll(async () => {
  ({ db, close } = await createDatabase({ memory: true }));
  hash = await hashPassword(password);
});
afterAll(async () => close());
beforeEach(async () => {
  await db.delete(events);
  await db.delete(rateLimits);
  await db.delete(organizations);
  app = createApp({
    db,
    storage: new MemoryStorage(),
    clock: () => now,
    rateLimitSecret: "audit-test-secret",
    cronSecret: "audit-test-cron",
  });
  for (const id of ["a", "b"]) {
    await db.insert(organizations).values({ id, name: `CAF ${id}`, kind: "caf" });
    await db.insert(offices).values({
      id: `office-${id}`,
      organizationId: id,
      slug: id,
      name: "Sportello",
      city: "Milano",
      address: "Esempio",
    });
    await db.insert(operators).values({
      id: `admin-${id}`,
      organizationId: id,
      name: "Nome-Personale",
      email: `admin-${id}@example.test`,
      passwordHash: hash,
      role: "admin",
    });
  }
  await db.insert(operators).values({
    id: "normal",
    organizationId: "a",
    name: "Nome-Operatore",
    email: "normal@example.test",
    passwordHash: hash,
    role: "operator",
  });
  admin = await session("admin-a");
  normal = await session("normal");
  foreign = await session("admin-b");
});

it("protects both endpoints and rejects temporary, disabled and demoted accounts", async () => {
  for (const path of ["/audit", "/audit/export.csv"]) {
    expect((await request(path, "")).status).toBe(401);
    expect((await request(path, normal)).status).toBe(403);
    await db.update(operators).set({ mustChangePassword: true }).where(eq(operators.id, "admin-a"));
    expect((await request(path)).status).toBe(403);
    await db
      .update(operators)
      .set({ mustChangePassword: false, active: false })
      .where(eq(operators.id, "admin-a"));
    expect((await request(path)).status).toBe(401);
    await db
      .update(operators)
      .set({ active: true, role: "operator" })
      .where(eq(operators.id, "admin-a"));
    expect((await request(path)).status).toBe(403);
    await db.update(operators).set({ role: "admin" }).where(eq(operators.id, "admin-a"));
  }
});

it("scopes rows, operator/reference filters and CSV to the authenticated tenant", async () => {
  await event("local", { caseReference: "AV-2027-000001" });
  await event("foreign", {
    organizationId: "b",
    actorId: "admin-b",
    caseReference: "AV-2027-000001",
  });
  await event("unscoped", {
    organizationId: null,
    actor: "system",
    actorId: null,
    type: "auth.login_failed",
  });
  expect((await page()).items.map((e) => e.id)).toEqual(["local"]);
  expect((await page("/audit?operatorId=admin-b")).items).toEqual([]);
  expect((await page("/audit?reference=AV-2027-000001", foreign)).items.map((e) => e.id)).toEqual([
    "foreign",
  ]);
  const csv = await (await request("/audit/export.csv?reference=AV-2027-000001")).text();
  expect(csv).toContain("local");
  expect(csv).not.toContain("foreign");
  expect(csv).not.toContain("unscoped");
  expect(csv).not.toMatch(/Nome-Personale|@example\.test/);
});

it("combines exclusive/inclusive period bounds, subject operator and action/reference filters", async () => {
  await event("match", {
    at: "2027-03-28T01:00:00Z",
    actorId: "normal",
    caseReference: "AV-2027-000002",
  });
  await event("before", {
    at: "2027-03-28T00:59:59Z",
    actorId: "normal",
    caseReference: "AV-2027-000002",
  });
  await event("end", {
    at: "2027-03-28T02:00:00Z",
    actorId: "normal",
    caseReference: "AV-2027-000002",
  });
  await event("other-action", {
    at: "2027-03-28T01:00:00Z",
    actorId: "normal",
    type: "case.closed",
    caseReference: "AV-2027-000002",
  });
  const query = new URLSearchParams({
    from: "2027-03-28T03:00:00+02:00",
    to: "2027-03-28T04:00:00+02:00",
    operatorId: "normal",
    reference: "AV-2027-000002",
    action: "case.exported",
  });
  const result = await page(`/audit?${query}`);
  expect(result.items.map((e) => e.id)).toEqual(["match"]);
  expect(result.items[0]?.at).toBe("2027-03-28T03:00:00.000+02:00");
  await event("reset", {
    actorId: "admin-a",
    subjectOperatorId: "normal",
    type: "operator.password_reset",
  });
  expect(
    (await page("/audit?operatorId=normal&action=operator.password_reset")).items.map((e) => e.id),
  ).toEqual(["reset"]);
  const csv = await (await request(`/audit/export.csv?${query}`)).text();
  expect(csv).toContain('"match"');
  expect(csv).not.toContain('"end"');
  expect(csv).not.toContain('"before"');
});

it("paginates equal instants and microseconds without duplicates, and rejects reused/invalid cursors", async () => {
  await event("c", { at: "2027-06-01T09:00:00.123456Z" });
  await event("b", { at: "2027-06-01T09:00:00.123456Z" });
  await event("a", { at: "2027-06-01T09:00:00.123455Z" });
  const first = await page("/audit?limit=1");
  expect(first.items.map((e) => e.id)).toEqual(["c"]);
  const second = await page(`/audit?limit=1&cursor=${first.nextCursor}`);
  const third = await page(`/audit?limit=1&cursor=${second.nextCursor}`);
  expect(second.items.map((e) => e.id)).toEqual(["b"]);
  expect(third.items.map((e) => e.id)).toEqual(["a"]);
  expect(third.nextCursor).toBeNull();
  expect((await request(`/audit?cursor=${first.nextCursor}`, foreign)).status).toBe(400);
  expect((await request(`/audit?action=case.closed&cursor=${first.nextCursor}`)).status).toBe(400);
  expect((await request("/audit?cursor=invalid")).status).toBe(400);
  for (const query of [
    "limit=0",
    "limit=101",
    "limit=2.5",
    "from=invalid",
    "action=arbitrary",
    "organizationId=b",
    "from=2027-02-01T00:00:00Z&to=2027-01-01T00:00:00Z",
  ])
    expect((await request(`/audit?${query}`)).status).toBe(400);
  const empty = await page("/audit?action=operator.created");
  expect(empty).toEqual({ items: [], nextCursor: null });
});

it("converts winter/summer and the repeated DST hour with the correct offset", () => {
  expect(romeInstant("2027-01-01T23:30:00Z")).toBe("2027-01-02T00:30:00.000+01:00");
  expect(romeInstant("2027-10-31T00:30:00Z")).toBe("2027-10-31T02:30:00.000+02:00");
  expect(romeInstant("2027-10-31T01:30:00Z")).toBe("2027-10-31T02:30:00.000+01:00");
});

it("removes legacy personal metadata keys, free-text values and unknown action names", async () => {
  await event("old", { metadata: { "Nome-Segreto": 123, bytes: 42, heuristic: true } });
  await event("unknown", { type: "Nome-Segreto", actor: "ai" });
  const result = await page();
  expect(result.items.find((e) => e.id === "old")?.details).toEqual({ bytes: 42, heuristic: true });
  expect(result.items.find((e) => e.id === "unknown")).toMatchObject({
    action: "activity.recorded",
    label: "Attività registrata",
    actor: { type: "system", id: null },
  });
  expect(JSON.stringify(result)).not.toMatch(/Nome-Segreto|Nome-Personale|@example\.test/);
  await expect(
    db.insert(events).values({
      id: "pii",
      organizationId: "a",
      actor: "system",
      type: "case.exported",
      at: now.toISOString(),
      metadata: sql`'{"bytes":"CodiceFiscale"}'::jsonb`,
    }),
  ).rejects.toThrow();
});

it("neutralizes formulas after whitespace/controls and quotes every CSV cell", async () => {
  const base = AuditEvent.parse({
    id: "x",
    at: now.toISOString(),
    timeZone: "Europe/Rome",
    actor: { type: "operator", id: "admin-a" },
    subjectOperatorId: null,
    action: "case.exported",
    label: "Fascicolo esportato",
    case: { id: "case", reference: "ref", deleted: false },
    details: {},
  });
  for (const value of [
    '=HYPERLINK("x")',
    "+cmd",
    "-1+2",
    "@SUM(1)",
    " \t\r\n=1+1",
    "\u0000@cmd",
    "\uFEFF=cmd",
  ]) {
    const csv = auditCsv([
      {
        ...base,
        id: value,
        actor: { type: "operator", id: value },
        case: { ...base.case!, reference: value },
      },
    ]);
    const row = csv.split("\r\n")[1]!;
    expect(row).toContain("\"'");
    expect(row).not.toMatch(/[\t\r\n\u0000]/);
    expect(row).not.toMatch(/,"\s*[=+\-@]/);
  }
  await event("csv", { caseReference: "\t=cmd\nnext", deletedCaseId: "csv-case" });
  const response = await request("/audit/export.csv");
  expect(response.headers.get("content-type")).toContain("text/csv");
  expect(response.headers.get("content-disposition")).toContain("attachment");
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(await response.text()).toContain('"\' =cmd next"');
  const exported = await db.select().from(events).where(eq(events.type, "audit.exported"));
  expect(exported).toHaveLength(1);
  expect(exported[0]).toMatchObject({
    actorId: "admin-a",
    organizationId: "a",
    metadata: { rows: 1 },
  });
});

it("rejects oversized exports, accepts the exact cap and rolls back when the export audit fails", async () => {
  await db.execute(
    sql`insert into events (id,organization_id,actor,type,at) select 'bulk-' || n, 'a', 'system', 'case.created', ${now.toISOString()}::timestamptz from generate_series(1, ${AUDIT_EXPORT_MAX_ROWS + 1}) n`,
  );
  expect((await request("/audit/export.csv")).status).toBe(400);
  expect(await db.select().from(events).where(eq(events.type, "audit.exported"))).toHaveLength(0);
  await db.delete(events).where(eq(events.id, `bulk-${AUDIT_EXPORT_MAX_ROWS + 1}`));
  expect((await request("/audit/export.csv")).status).toBe(200);
  await db.delete(events).where(eq(events.type, "audit.exported"));
  await db.execute(
    sql`ALTER TABLE events ADD CONSTRAINT reject_export_test CHECK (type <> 'audit.exported')`,
  );
  try {
    expect((await request("/audit/export.csv?action=case.created")).status).toBe(500);
  } finally {
    await db.execute(sql`ALTER TABLE events DROP CONSTRAINT reject_export_test`);
  }
  expect(await db.select().from(events).where(eq(events.type, "audit.exported"))).toHaveLength(0);
});

it("commits successful and failed login events without credentials, including unknown/disabled accounts and rate limits", async () => {
  const login = (email: string, suppliedPassword = password) =>
    request("/auth/login", "", "POST", { email, password: suppliedPassword });
  expect((await login("admin-a@example.test", "wrongpassword")).status).toBe(401);
  expect((await login("unknown@example.test")).status).toBe(401);
  await db.update(operators).set({ active: false }).where(eq(operators.id, "normal"));
  expect((await login("normal@example.test")).status).toBe(401);
  expect((await login("admin-a@example.test")).status).toBe(200);
  for (let i = 0; i < 9; i++) await login("admin-a@example.test", "wrongpassword");
  expect((await login("admin-a@example.test")).status).toBe(429);
  const rows = await db.select().from(events);
  expect(rows.some((e) => e.type === "auth.login_succeeded" && e.actorId === "admin-a")).toBe(true);
  expect(rows.some((e) => e.type === "auth.login_failed" && e.subjectOperatorId === "normal")).toBe(
    true,
  );
  expect(rows.some((e) => e.type === "auth.login_failed" && e.organizationId === null)).toBe(true);
  expect(rows.some((e) => e.metadata.rateLimited === true)).toBe(true);
  expect(JSON.stringify(rows)).not.toMatch(
    /@example\.test|wrongpassword|TestAvantiPassword|Nome-Personale/,
  );
  expect(
    (await page("/audit?operatorId=admin-a&action=auth.login_failed")).items.every(
      (e) => e.actor.type === "system" && e.actor.id === null && e.subjectOperatorId === "admin-a",
    ),
  ).toBe(true);
});

it("audits password changes, resets, deactivations, reactivations and logout with the real actor/target", async () => {
  const reset = await request("/operators/normal/reset-password", admin, "POST", {});
  expect(reset.status).toBe(200);
  const temporary = TemporaryPasswordResponse.parse(await reset.json());
  expect((await request("/operators/normal", admin, "PATCH", { active: false })).status).toBe(200);
  expect((await request("/operators/normal", admin, "PATCH", { active: true })).status).toBe(200);
  const login = await request("/auth/login", "", "POST", {
    email: "normal@example.test",
    password: temporary.temporaryPassword,
  });
  const cookie = login.headers.get("set-cookie")!.split(";")[0]!;
  const changed = await request("/auth/password", cookie, "POST", {
    currentPassword: temporary.temporaryPassword,
    newPassword: "NewAvantiPassword!",
  });
  expect(changed.status).toBe(200);
  const replacement = changed.headers.get("set-cookie")!.split(";")[0]!;
  expect((await request("/auth/logout", replacement, "POST", {})).status).toBe(200);
  const rows = await db.select().from(events);
  for (const action of ["operator.password_reset", "operator.deactivated", "operator.activated"])
    expect(rows.find((e) => e.type === action)).toMatchObject({
      actorId: "admin-a",
      subjectOperatorId: "normal",
    });
  for (const action of ["auth.password_changed", "auth.logged_out"])
    expect(rows.find((e) => e.type === action)).toMatchObject({ actorId: "normal" });
  expect(JSON.stringify(rows)).not.toContain(temporary.temporaryPassword);
});

it("rolls back sessions and account mutation if their required audit cannot be committed", async () => {
  // Authentication may renew expiry outside the mutation; session identity/revocation must roll back.
  const sessionAccess = () =>
    db
      .select({ id: sessions.id, operatorId: sessions.operatorId, tokenHash: sessions.tokenHash })
      .from(sessions)
      .orderBy(sessions.id);
  const sessionsBefore = await sessionAccess();
  await db.execute(
    sql`ALTER TABLE events ADD CONSTRAINT reject_auth_test CHECK (type NOT IN ('auth.login_succeeded', 'operator.password_reset'))`,
  );
  try {
    const login = await request("/auth/login", "", "POST", {
      email: "admin-a@example.test",
      password,
    });
    expect(login.status).toBe(500);
    expect(login.headers.get("set-cookie")).toBeNull();
    expect(await sessionAccess()).toEqual(sessionsBefore);
    expect((await request("/operators/normal/reset-password", admin, "POST", {})).status).toBe(500);
    const [unchanged] = await db.select().from(operators).where(eq(operators.id, "normal"));
    expect(unchanged).toMatchObject({ passwordHash: hash, mustChangePassword: false });
    expect(await sessionAccess()).toEqual(sessionsBefore);
  } finally {
    await db.execute(sql`ALTER TABLE events DROP CONSTRAINT reject_auth_test`);
  }
});

it("records account/settings/office administration and creates no event on forbidden cross-tenant mutations", async () => {
  expect(
    (
      await request("/operators", admin, "POST", {
        email: "new@example.test",
        name: "Nome-Segreto",
      })
    ).status,
  ).toBe(201);
  expect(
    (await request("/operators/normal", admin, "PATCH", { name: "Nome-Segreto", role: "admin" }))
      .status,
  ).toBe(200);
  expect((await request("/settings", admin, "PATCH", { retentionDays: 30 })).status).toBe(200);
  expect(
    (
      await request("/offices", admin, "POST", {
        name: "Nuovo",
        address: "Indirizzo-Segreto",
        city: "Milano",
      })
    ).status,
  ).toBe(201);
  expect(
    (await request("/offices/office-a", admin, "PATCH", { name: "Nome-Segreto" })).status,
  ).toBe(200);
  const before = await db.select().from(events);
  for (const [path, method, body] of [
    ["/operators/admin-b", "PATCH", { active: false }],
    ["/operators/admin-b/reset-password", "POST", {}],
    ["/offices/office-b", "PATCH", { name: "Segreto" }],
  ] as const)
    expect((await request(path, admin, method, body)).status).toBe(404);
  expect(await db.select().from(events)).toEqual(before);
  expect(before.map((e) => e.type).sort()).toEqual(
    [
      "operator.created",
      "operator.updated",
      "settings.updated",
      "office.created",
      "office.updated",
    ].sort(),
  );
  expect(JSON.stringify(before)).not.toMatch(/Nome-Segreto|Indirizzo-Segreto|@example\.test/);
});

it("preserves audit independently of case erasure and purges it at its own cutoff in bounded batches", async () => {
  const [row] = await db
    .insert(cases)
    .values({
      id: "case",
      organizationId: "a",
      officeId: "office-a",
      tokenHash: hashToken("case"),
      reference: "AV-2027-000001",
      language: "it",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: now.toISOString(),
      answers: { private: "Segreto" },
    })
    .returning();
  await event("old-case", { caseId: row!.id });
  await expect(db.delete(cases).where(eq(cases.id, row!.id))).rejects.toThrow();
  await db.transaction((tx) => eraseCase(tx, row!, now, "admin-a"));
  const result = await page("/audit?reference=AV-2027-000001");
  expect(result.items).toHaveLength(2);
  expect(result.items.every((e) => e.case?.deleted && e.case.reference === "AV-2027-000001")).toBe(
    true,
  );
  expect(JSON.stringify(result)).not.toContain("Segreto");
  const cutoff = new Date(now.getTime() - 365 * 86400000);
  await event("boundary", { at: cutoff.toISOString() });
  await db.execute(
    sql`insert into events (id,organization_id,actor,type,at) select 'expired-' || n, 'a', 'system', 'case.created', ${new Date(cutoff.getTime() - 1).toISOString()}::timestamptz from generate_series(1, ${AUDIT_RETENTION_BATCH + 1}) n`,
  );
  await event("global-expired", {
    organizationId: null,
    actorId: null,
    actor: "system",
    type: "auth.login_failed",
    at: new Date(cutoff.getTime() - 1).toISOString(),
  });
  const cron = await app.request("/api/cron/maintenance", {
    headers: { Authorization: "Bearer audit-test-cron" },
  });
  expect(cron.status).toBe(200);
  expect(await cron.json()).toMatchObject({ deletedAuditEvents: AUDIT_RETENTION_BATCH });
  expect(await purgeAuditEvents(db, now)).toBe(2);
  expect(await purgeAuditEvents(db, now)).toBe(0);
  expect(await db.select().from(events).where(eq(events.id, "boundary"))).toHaveLength(1);
  expect(
    await db
      .select()
      .from(events)
      .where(and(isNull(events.organizationId), eq(events.type, "auth.login_failed"))),
  ).toHaveLength(0);
});
