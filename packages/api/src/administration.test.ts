import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import {
  ApiError,
  CitizenCase,
  Office,
  Operator,
  OperatorSummary,
  OrganizationSettings,
  PASSWORD_MIN_LENGTH,
  TemporaryPasswordResponse,
  type AnswerValue,
} from "@avanti/contracts";
import {
  cases,
  checklistReviews,
  createDatabase,
  documents,
  events,
  messages,
  offices,
  operators,
  organizations,
  rateLimits,
  sessions,
  settings,
  storageDeletions,
  type Database,
} from "@avanti/db";
import { createApp } from "./app";
import { hashPassword, hashToken, newToken, verifyPassword } from "./security";
import { MemoryStorage } from "./storage";
import { RETENTION_BATCH_SIZE } from "./case-erasure";

const origin = "http://localhost:3400";
const initial = "2027-06-01T10:00:00.000Z";
const password = "TestAvantiPassword!";
let passwordHash: string;
let db: Database;
let close: () => Promise<void>;
let now: Date;
let app: ReturnType<typeof createApp>;
let storage: MemoryStorage;
let admin: string;
let normal: string;
let foreign: string;
let logs: unknown[];

function request(
  path: string,
  method = "GET",
  input?: unknown,
  cookie?: string,
  requestOrigin: string | null = origin,
) {
  const headers = new Headers();
  if (requestOrigin) headers.set("Origin", requestOrigin);
  if (cookie) headers.set("Cookie", cookie);
  if (input !== undefined) headers.set("Content-Type", "application/json");
  return app.request(`/api${path}`, {
    method,
    headers,
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  });
}
async function fails(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  const result = ApiError.parse(await response.json());
  expect(result.error.code).toBe(code);
  return result.error.message;
}
async function session(operatorId: string) {
  const token = newToken();
  await db.insert(sessions).values({
    id: crypto.randomUUID(),
    operatorId,
    tokenHash: hashToken(token),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 3600000).toISOString(),
  });
  return `avanti_session=${token}`;
}
async function login(email: string, suppliedPassword = password) {
  const response = await request("/auth/login", "POST", { email, password: suppliedPassword });
  expect(response.status).toBe(200);
  const operator = Operator.parse(await response.json());
  const cookie = response.headers.get("Set-Cookie")!.split(";")[0]!;
  return { operator, cookie };
}
async function createOperator(email = "new@example.test") {
  const response = await request("/operators", "POST", { email, name: "Nuovo Operatore" }, admin);
  expect(response.status).toBe(201);
  return TemporaryPasswordResponse.parse(await response.json());
}
async function caseFixture(id: string, extra: Partial<typeof cases.$inferInsert> = {}) {
  const [row] = await db
    .insert(cases)
    .values({
      id,
      organizationId: "org-a",
      officeId: "office-a",
      reference: `AV-2027-${id}`,
      tokenHash: hashToken(id),
      language: "it",
      practiceId: "isee_ordinario",
      status: "intake",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 86400000).toISOString(),
      ...extra,
    })
    .returning();
  return row!;
}
async function fileFixture(caseId: string) {
  const id = `doc-${caseId}`;
  const key = `${caseId}/${id}.pdf`;
  await storage.put(key, new Uint8Array([1, 2, 3]));
  await db.insert(documents).values({
    id,
    caseId,
    fileName: "Nome-Personale.pdf",
    mimeType: "application/pdf",
    sizeBytes: 3,
    storageKey: key,
    sha256: "hash",
    uploadedAt: now.toISOString(),
    status: "analyzed",
  });
  return key;
}
function cron() {
  return app.request("/api/cron/maintenance", {
    headers: { Authorization: "Bearer admin-test-cron" },
  });
}

beforeAll(async () => {
  ({ db, close } = await createDatabase({ memory: true }));
  passwordHash = await hashPassword(password);
});
afterAll(async () => close?.());
beforeEach(async () => {
  await db.delete(events);
  await db.delete(organizations);
  await db.delete(storageDeletions);
  await db.delete(rateLimits);
  now = new Date(initial);
  storage = new MemoryStorage();
  logs = [];
  app = createApp({
    db,
    storage,
    clock: () => new Date(now),
    publicUrl: origin,
    cronSecret: "admin-test-cron",
    rateLimitSecret: "test-secret",
    logger: (record) => logs.push(record),
    storageLogger: (record) => logs.push(record),
    errorLogger: (record) => logs.push(record),
  });
  for (const suffix of ["a", "b"]) {
    await db
      .insert(organizations)
      .values({ id: `org-${suffix}`, name: `CAF ${suffix}`, kind: "caf" });
    await db.insert(offices).values({
      id: `office-${suffix}`,
      organizationId: `org-${suffix}`,
      slug: `test-${suffix}`,
      name: "Sportello",
      city: "Milano",
      address: "Via Esempio",
    });
    await db.insert(operators).values({
      id: `admin-${suffix}`,
      organizationId: `org-${suffix}`,
      name: `Admin ${suffix}`,
      email: `admin-${suffix}@example.test`,
      passwordHash,
      role: "admin",
      createdAt: now.toISOString(),
    });
    await db.insert(settings).values({ organizationId: `org-${suffix}` });
  }
  await db.insert(operators).values({
    id: "normal",
    organizationId: "org-a",
    name: "Operatore",
    email: "normal@example.test",
    passwordHash,
    role: "operator",
    createdAt: now.toISOString(),
  });
  admin = await session("admin-a");
  normal = await session("normal");
  foreign = await session("admin-b");
});

const adminRoutes: [string, string, unknown?][] = [
  ["GET", "/settings"],
  ["PATCH", "/settings", { linkDays: 10 }],
  ["GET", "/operators"],
  ["POST", "/operators", { name: "Test User", email: "new@example.test" }],
  ["PATCH", "/operators/normal", { active: false }],
  ["POST", "/operators/normal/reset-password"],
  ["POST", "/offices", { name: "Centro", address: "Via Esempio", city: "Milano" }],
  ["PATCH", "/offices/office-a", { city: "Roma" }],
  ["DELETE", "/cases/test", { confirmReference: "AV-2027-test" }],
];
describe("administration access boundaries", () => {
  it.each(adminRoutes)("%s %s requires a session and admin role", async (method, path, input) => {
    await fails(await request(path, method, input), 401, "unauthorized");
    await fails(await request(path, method, input, normal), 403, "forbidden");
  });
  it.each(adminRoutes.filter(([method]) => method !== "GET"))(
    "%s %s requires the existing Origin protection",
    async (method, path, input) => {
      await fails(
        await request(path, method, input, admin, "https://untrusted.example"),
        403,
        "forbidden",
      );
      await fails(await request(path, method, input, admin, null), 403, "forbidden");
    },
  );
  it.each([
    ["PATCH", "/operators/admin-b", { name: "Cross tenant" }],
    ["POST", "/operators/admin-b/reset-password", undefined],
    ["PATCH", "/offices/office-b", { name: "Cross tenant" }],
    ["DELETE", "/cases/foreign-case", { confirmReference: "AV-2027-foreign-case" }],
  ])("%s %s hides foreign and missing resources", async (method, path, input) => {
    await caseFixture("foreign-case", { organizationId: "org-b", officeId: "office-b" });
    await fails(await request(path!, method, input, admin), 404, "not_found");
    await fails(await request(`${path}-missing`, method, input, admin), 404, "not_found");
    expect((await db.select().from(operators).where(eq(operators.id, "admin-b")))[0]?.name).toBe(
      "Admin b",
    );
    expect(await db.select().from(cases).where(eq(cases.id, "foreign-case"))).toHaveLength(1);
  });
  it.each([
    ["PATCH", "/settings", { linkDays: 0 }],
    ["PATCH", "/settings", { retentionDays: 29 }],
    ["PATCH", "/settings", { baselineMinutesPerCase: 601 }],
    ["POST", "/operators", { name: "X", email: "invalid" }],
    ["PATCH", "/operators/normal", { role: "owner" }],
    ["POST", "/offices", { name: "X", city: "Milano", address: "Via Esempio" }],
    ["PATCH", "/offices/office-a", { city: "X" }],
    ["DELETE", "/cases/test", {}],
  ])("%s %s validates the shared contract", async (method, path, input) => {
    await fails(await request(path!, method, input, admin), 400, "bad_request");
  });
});

describe("password lifecycle", () => {
  it("returns mustChangePassword, records lastLoginAt only on successful login, and blocks all other routes", async () => {
    const created = await createOperator();
    expect(created.temporaryPassword.length).toBeGreaterThanOrEqual(16);
    expect(created.temporaryPassword).not.toMatch(/[0Ol1]/);
    const [stored] = await db.select().from(operators).where(eq(operators.id, created.operator.id));
    expect(stored?.passwordHash).not.toContain(created.temporaryPassword);
    expect(await verifyPassword(created.temporaryPassword, stored!.passwordHash)).toBe(true);
    expect(stored?.lastLoginAt).toBeNull();
    expect(stored?.mustChangePassword).toBe(true);
    const loggedIn = await login(created.operator.email, created.temporaryPassword);
    expect(loggedIn.operator.mustChangePassword).toBe(true);
    const summaries = OperatorSummary.array().parse(
      await (await request("/operators", "GET", undefined, admin)).json(),
    );
    expect(summaries.find((operator) => operator.id === created.operator.id)?.lastLoginAt).toBe(
      initial,
    );
    const me = Operator.parse(
      await (await request("/auth/me", "GET", undefined, loggedIn.cookie)).json(),
    );
    expect(me.mustChangePassword).toBe(true);
    for (const path of [
      "/cases",
      "/metrics",
      "/settings",
      "/operators",
      "/offices/test-a",
      "/health",
    ]) {
      expect(
        await fails(await request(path, "GET", undefined, loggedIn.cookie), 403, "forbidden"),
      ).toBe("Cambia la password per continuare.");
    }
    await fails(
      await request("/cases", "POST", { officeId: "office-a", language: "it" }, loggedIn.cookie),
      403,
      "forbidden",
    );
    expect(
      Date.parse(
        (await db.select().from(operators).where(eq(operators.id, created.operator.id)))[0]!
          .lastLoginAt!,
      ),
    ).toBe(Date.parse(initial));
    expect((await request("/auth/logout", "POST", undefined, loggedIn.cookie)).status).toBe(200);
  });
  it("changes an ordinary operator's password and rotates the session", async () => {
    const second = await session("normal");
    const result = await request(
      "/auth/password",
      "POST",
      { currentPassword: password, newPassword: "ChangedAvantiPassword!" },
      normal,
    );
    expect(result.status).toBe(200);
    expect(Operator.parse(await result.json()).mustChangePassword).toBe(false);
    const rotated = result.headers.get("set-cookie")!.split(";")[0]!;
    expect((await request("/cases", "GET", undefined, rotated)).status).toBe(200);
    await fails(await request("/auth/me", "GET", undefined, normal), 401, "unauthorized");
    await fails(await request("/auth/me", "GET", undefined, second), 401, "unauthorized");
    await fails(
      await request("/auth/login", "POST", { email: "normal@example.test", password }),
      401,
      "unauthorized",
    );
    await login("normal@example.test", "ChangedAvantiPassword!");
  });
  it("unlocks a temporary account with a rotated session", async () => {
    const created = await createOperator();
    const first = await login(created.operator.email, created.temporaryPassword);
    const second = await login(created.operator.email, created.temporaryPassword);
    const changed = await request(
      "/auth/password",
      "POST",
      { currentPassword: created.temporaryPassword, newPassword: "ChangedAvantiPassword!" },
      first.cookie,
    );
    expect(changed.status).toBe(200);
    expect(Operator.parse(await changed.json()).mustChangePassword).toBe(false);
    const rotated = changed.headers.get("set-cookie")!.split(";")[0]!;
    expect((await request("/cases", "GET", undefined, rotated)).status).toBe(200);
    await fails(await request("/auth/me", "GET", undefined, first.cookie), 401, "unauthorized");
    await fails(await request("/auth/me", "GET", undefined, second.cookie), 401, "unauthorized");
  });
  it("validates current/new passwords, same-password rejection and Origin without modifying credentials", async () => {
    const input = { currentPassword: password, newPassword: "ChangedAvantiPassword!" };
    await fails(await request("/auth/password", "POST", input), 401, "unauthorized");
    await fails(await request("/auth/password", "POST", input, normal, null), 403, "forbidden");
    await fails(
      await request("/auth/password", "POST", input, normal, "https://untrusted.example"),
      403,
      "forbidden",
    );
    await fails(
      await request("/auth/password", "POST", { ...input, currentPassword: "wrong" }, normal),
      401,
      "unauthorized",
    );
    await fails(
      await request("/auth/password", "POST", { ...input, newPassword: password }, normal),
      400,
      "bad_request",
    );
    await fails(
      await request(
        "/auth/password",
        "POST",
        { ...input, newPassword: "x".repeat(PASSWORD_MIN_LENGTH - 1) },
        normal,
      ),
      400,
      "bad_request",
    );
    const [stored] = await db.select().from(operators).where(eq(operators.id, "normal"));
    expect(stored?.passwordHash).toBe(passwordHash);
  });
  it("rate limits password checks per authenticated identity like login", async () => {
    for (let index = 0; index < 10; index++) {
      await fails(
        await request(
          "/auth/password",
          "POST",
          { currentPassword: "wrong", newPassword: "ChangedAvantiPassword!" },
          normal,
        ),
        401,
        "unauthorized",
      );
    }
    const blocked = await request(
      "/auth/password",
      "POST",
      { currentPassword: password, newPassword: "ChangedAvantiPassword!" },
      normal,
    );
    expect(blocked.headers.get("Retry-After")).toBe("60");
    await fails(blocked, 429, "rate_limited");
    await fails(
      await request("/auth/login", "POST", { email: "normal@example.test", password }),
      429,
      "rate_limited",
    );
    expect(
      (await db.select().from(rateLimits)).every((row) => /^[a-f0-9]{64}$/.test(row.key)),
    ).toBe(true);
    now = new Date(now.getTime() + 61000);
    expect(
      (
        await request(
          "/auth/password",
          "POST",
          { currentPassword: password, newPassword: "ChangedAvantiPassword!" },
          normal,
        )
      ).status,
    ).toBe(200);
  });
  it("inactive, missing and wrong-password login errors are uniform, and existing inactive sessions fail", async () => {
    await db.update(operators).set({ active: false }).where(eq(operators.id, "normal"));
    const messages = [];
    for (const [email, supplied] of [
      ["normal@example.test", password],
      ["missing@example.test", password],
      ["admin-a@example.test", "wrong"],
    ]) {
      messages.push(
        await fails(
          await request("/auth/login", "POST", { email, password: supplied }),
          401,
          "unauthorized",
        ),
      );
    }
    expect(new Set(messages).size).toBe(1);
    await fails(await request("/auth/me", "GET", undefined, normal), 401, "unauthorized");
    expect(
      (await db.select().from(operators).where(eq(operators.id, "normal")))[0]?.lastLoginAt,
    ).toBeNull();
  });
});

describe("organization administration", () => {
  it("scopes sorted operator summaries, persists changes and enforces system-wide email uniqueness", async () => {
    await createOperator("Unique@Example.test");
    const duplicate = await request(
      "/operators",
      "POST",
      { name: "Altro Operatore", email: " UNIQUE@EXAMPLE.TEST " },
      foreign,
    );
    expect(await fails(duplicate, 409, "conflict")).toContain("email");
    const rows = OperatorSummary.array().parse(
      await (await request("/operators", "GET", undefined, admin)).json(),
    );
    expect(rows.map((row) => row.name)).toEqual(["Admin a", "Nuovo Operatore", "Operatore"]);
    expect(rows.map((row) => row.id)).not.toContain("admin-b");
    expect(rows.every((row) => row.lastLoginAt === null)).toBe(true);
    const edited = await request(
      "/operators/normal",
      "PATCH",
      { name: "Zeta", role: "admin" },
      admin,
    );
    expect(edited.status).toBe(200);
    expect(OperatorSummary.parse(await edited.json())).toMatchObject({
      name: "Zeta",
      role: "admin",
      active: true,
    });
    expect((await request("/operators/normal", "PATCH", {}, admin)).status).toBe(200);
    expect(JSON.stringify(logs)).not.toMatch(
      /Unique|Zeta|example.test|temporaryPassword|passwordHash/,
    );
  });
  it("rejects self-demotion, self-deactivation and self-reset", async () => {
    for (const input of [{ role: "operator" }, { active: false }])
      await fails(await request("/operators/admin-a", "PATCH", input, admin), 409, "conflict");
    await fails(
      await request("/operators/admin-a/reset-password", "POST", undefined, admin),
      409,
      "conflict",
    );
    expect(
      (await request("/operators/admin-a", "PATCH", { name: "Nome aggiornato" }, admin)).status,
    ).toBe(200);
  });
  it("revokes all sessions on reset and deactivation, supports reactivation, and leaves an active admin", async () => {
    const reset = await request("/operators/normal/reset-password", "POST", undefined, admin);
    expect(reset.status).toBe(200);
    const temporary = TemporaryPasswordResponse.parse(await reset.json());
    expect(temporary.temporaryPassword).not.toMatch(/[0Ol1]/);
    await fails(await request("/auth/me", "GET", undefined, normal), 401, "unauthorized");
    const pending = await login("normal@example.test", temporary.temporaryPassword);
    expect(pending.operator.mustChangePassword).toBe(true);
    const inactive = await request("/operators/normal", "PATCH", { active: false }, admin);
    expect(OperatorSummary.parse(await inactive.json()).active).toBe(false);
    expect(await db.select().from(sessions).where(eq(sessions.operatorId, "normal"))).toHaveLength(
      0,
    );
    await fails(await request("/auth/me", "GET", undefined, pending.cookie), 401, "unauthorized");
    await fails(
      await request("/auth/login", "POST", {
        email: "normal@example.test",
        password: temporary.temporaryPassword,
      }),
      401,
      "unauthorized",
    );
    expect((await request("/operators/normal", "PATCH", { active: true }, admin)).status).toBe(200);
    expect(
      (await login("normal@example.test", temporary.temporaryPassword)).operator.mustChangePassword,
    ).toBe(true);
    expect(
      await db
        .select()
        .from(operators)
        .where(
          and(
            eq(operators.organizationId, "org-a"),
            eq(operators.role, "admin"),
            eq(operators.active, true),
          ),
        ),
    ).toHaveLength(1);
  });
  it("serializes competing admins so concurrent deactivations cannot remove the last admin", async () => {
    await db.update(operators).set({ role: "admin" }).where(eq(operators.id, "normal"));
    const results = await Promise.all([
      request("/operators/normal", "PATCH", { active: false }, admin),
      request("/operators/admin-a", "PATCH", { active: false }, normal),
    ]);
    expect(results.map((r) => r.status).filter((status) => status === 200)).toHaveLength(1);
    expect(
      results
        .map((r) => r.status)
        .filter((status) => status === 401 || status === 403 || status === 409),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(operators)
        .where(
          and(
            eq(operators.organizationId, "org-a"),
            eq(operators.role, "admin"),
            eq(operators.active, true),
          ),
        ),
    ).toHaveLength(1);
  });
  it("settings update only this tenant and affects newly created links", async () => {
    const current = OrganizationSettings.parse(
      await (await request("/settings", "GET", undefined, admin)).json(),
    );
    expect(current).toEqual({ baselineMinutesPerCase: null, linkDays: 60, retentionDays: 180 });
    const createCase = () =>
      request(
        "/cases",
        "POST",
        { officeId: "office-a", language: "it", practiceId: "isee_ordinario" },
        admin,
      );
    const before = await createCase();
    expect(before.status).toBe(201);
    const old = await before.json();
    const edited = await request(
      "/settings",
      "PATCH",
      { baselineMinutesPerCase: 30, linkDays: 7, retentionDays: 90 },
      admin,
    );
    expect(edited.status).toBe(200);
    expect(OrganizationSettings.parse(await edited.json())).toEqual({
      baselineMinutesPerCase: 30,
      linkDays: 7,
      retentionDays: 90,
    });
    const after = await createCase();
    expect(after.status).toBe(201);
    const fresh = await after.json();
    expect(
      Date.parse((await db.select().from(cases).where(eq(cases.id, fresh.case.id)))[0]!.expiresAt) -
        now.getTime(),
    ).toBe(7 * 86400000);
    expect(
      Date.parse((await db.select().from(cases).where(eq(cases.id, old.case.id)))[0]!.expiresAt) -
        now.getTime(),
    ).toBe(60 * 86400000);
    expect(
      OrganizationSettings.parse(
        await (await request("/settings", "GET", undefined, foreign)).json(),
      ).linkDays,
    ).toBe(60);
    expect((await request("/settings", "PATCH", {}, admin)).status).toBe(200);
    expect(
      (await request("/settings", "PATCH", { baselineMinutesPerCase: null }, admin)).status,
    ).toBe(200);
    await db.delete(settings).where(eq(settings.organizationId, "org-a"));
    expect(
      OrganizationSettings.parse(
        await (await request("/settings", "GET", undefined, admin)).json(),
      ),
    ).toEqual(current);
    expect((await request("/settings", "PATCH", { linkDays: 1 }, admin)).status).toBe(200);
  });
  it("rejects office names already used by this organization on create and edit", async () => {
    const input = { name: "  SPORTELLO  ", city: "Roma", address: "Via Esempio" };
    const message = "C'è già uno sportello con questo nome.";
    expect(await fails(await request("/offices", "POST", input, admin), 409, "conflict")).toBe(
      message,
    );
    const created = await request("/offices", "POST", { ...input, name: "Centro" }, admin);
    expect(created.status).toBe(201);
    const office = Office.parse(await created.json());
    expect(
      await fails(
        await request(`/offices/${office.id}`, "PATCH", { name: "  sPoRtElLo  " }, admin),
        409,
        "conflict",
      ),
    ).toBe(message);
    const unchanged = Office.parse(
      await (await request(`/offices/${office.id}`, "PATCH", { name: " CENTRO " }, admin)).json(),
    );
    expect(unchanged.name).toBe("CENTRO");
    expect(unchanged.slug).toBe(office.slug);
    expect((await request("/offices", "POST", { ...input, name: "Centro" }, foreign)).status).toBe(
      201,
    );
    expect(JSON.stringify(logs)).not.toContain(message);
  });
  it("serializes simultaneous office names within the organization", async () => {
    const input = { name: "Centro", city: "Milano", address: "Via Esempio" };
    const responses = await Promise.all([
      request("/offices", "POST", input, admin),
      request("/offices", "POST", { ...input, name: " CENTRO " }, admin),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    const rows = await db.select().from(offices).where(eq(offices.organizationId, "org-a"));
    expect(rows).toHaveLength(2);
  });
  it.each([
    ["Milano Centro", "Milano", "milano-centro"],
    [" MILANO-centro ", "milano", "milano-centro"],
    ["Milano", "Milano", "milano"],
    ["Città Nuova Centro", "Città Nuova", "citta-nuova-centro"],
    ["Milanofiori", "Milano", "milano-milanofiori"],
    ["Centro", "Milano", "milano-centro"],
  ])("allocates %s in %s as %s without repeating the city", async (name, city, slug) => {
    const input = { name, city, address: "Via Esempio" };
    const response = await request("/offices", "POST", input, admin);
    expect(response.status).toBe(201);
    const first = Office.parse(await response.json());
    expect(first.slug).toBe(slug);
    const second = Office.parse(await (await request("/offices", "POST", input, foreign)).json());
    expect(second.slug).toBe(`${slug}-2`);
    const edited = Office.parse(
      await (
        await request(`/offices/${first.id}`, "PATCH", { name: "Roma Centro", city: "Roma" }, admin)
      ).json(),
    );
    expect(edited.slug).toBe(first.slug);
  });
  it("creates global ASCII slugs with collision suffixes, preserves the printed QR after edits", async () => {
    const input = {
      name: "Sédè Centro",
      address: "Via Esempio 10",
      city: "Città Nuova",
      phone: "+39 02",
      openingHours: "Lun–Ven",
    };
    const first = await request("/offices", "POST", input, admin);
    expect(first.status).toBe(201);
    const office = Office.parse(await first.json());
    expect(office.slug).toBe("citta-nuova-sede-centro");
    const second = Office.parse(await (await request("/offices", "POST", input, foreign)).json());
    expect(second.slug).toBe(`${office.slug}-2`);
    const edited = await request(
      `/offices/${office.id}`,
      "PATCH",
      { name: "Nuovo nome", city: "Roma", phone: null, openingHours: null, slug: "replacement" },
      admin,
    );
    expect(edited.status).toBe(200);
    expect(Office.parse(await edited.json())).toMatchObject({
      slug: office.slug,
      name: "Nuovo nome",
      city: "Roma",
      phone: null,
      openingHours: null,
    });
    expect((await request(`/offices/${office.id}`, "PATCH", {}, admin)).status).toBe(200);
    const publicOffice = await request(`/offices/${office.slug}`);
    expect(publicOffice.status).toBe(200);
    expect((await publicOffice.json()).office.name).toBe("Nuovo nome");
    expect(
      Operator.parse(
        await (await request("/auth/me", "GET", undefined, admin)).json(),
      ).offices.some((row) => row.id === office.id),
    ).toBe(true);
    const unicode = Office.parse(
      await (
        await request(
          "/offices",
          "POST",
          { name: "مكتب", city: "ঢাকা", address: "Via Esempio" },
          admin,
        )
      ).json(),
    );
    expect(unicode.slug).toBe("citta-sportello");
  });
});

it("keeps generated office slugs inside the citizen intake contract limit, including collision suffixes", async () => {
  const input = { name: "Sportello".repeat(13), city: "Citta".repeat(24), address: "Via Esempio" };
  const first = Office.parse(await (await request("/offices", "POST", input, admin)).json());
  const second = Office.parse(await (await request("/offices", "POST", input, foreign)).json());
  expect(first.slug.length).toBeLessThanOrEqual(80);
  expect(second.slug.length).toBeLessThanOrEqual(80);
  expect(second.slug).toBe(`${first.slug}-2`);
  expect(
    (await request("/intake", "POST", { officeSlug: second.slug, privacyAccepted: true })).status,
  ).toBe(201);
});
it("a reset racing with login cannot leave a session authenticated by the old password", async () => {
  const [loggedIn, reset] = await Promise.all([
    request("/auth/login", "POST", { email: "normal@example.test", password }),
    request("/operators/normal/reset-password", "POST", undefined, admin),
  ]);
  expect(reset.status).toBe(200);
  expect([200, 401]).toContain(loggedIn.status);
  if (loggedIn.status === 200) {
    const cookie = loggedIn.headers.get("Set-Cookie")!.split(";")[0]!;
    await fails(await request("/auth/me", "GET", undefined, cookie), 401, "unauthorized");
  }
});

describe("erasure and automatic retention", () => {
  it("requires a matching reference, cascades personal content, removes files and preserves technical audit", async () => {
    const row = await caseFixture("erase", {
      answers: { members: [{ role: "richiedente", firstName: "Segreto" }] },
      citizenNote: "Segreto",
      internalNotes: "Segreto",
      contact: { firstName: "Segreto" },
    });
    const key = await fileFixture(row.id);
    await db.insert(messages).values({
      id: "message",
      caseId: row.id,
      role: "citizen",
      text: "Segreto",
      createdAt: now.toISOString(),
    });
    await db.insert(checklistReviews).values({
      caseId: row.id,
      itemId: "test",
      decision: "rejected",
      note: "Segreto",
      reviewedAt: now.toISOString(),
    });
    await db.insert(events).values({
      id: "old-event",
      caseId: row.id,
      organizationId: "org-a",
      actor: "citizen",
      type: "case.created",
      at: now.toISOString(),
    });
    await fails(
      await request(`/cases/${row.id}`, "DELETE", { confirmReference: "wrong" }, admin),
      400,
      "bad_request",
    );
    expect(await storage.get(key)).toHaveLength(3);
    expect(
      (
        await request(
          `/cases/${row.id}`,
          "DELETE",
          { confirmReference: ` ${row.reference.toLowerCase()} ` },
          admin,
        )
      ).status,
    ).toBe(204);
    for (const table of [cases, documents, messages, checklistReviews])
      expect(await db.select().from(table)).toHaveLength(0);
    await expect(storage.get(key)).rejects.toThrow();
    expect(await db.select().from(storageDeletions)).toHaveLength(0);
    const audit = await db.select().from(events);
    expect(audit).toHaveLength(2);
    expect(audit.find((event) => event.type === "case.deleted")).toMatchObject({
      organizationId: "org-a",
      actor: "operator",
      actorId: "admin-a",
      caseId: null,
      deletedCaseId: row.id,
      caseReference: row.reference,
      type: "case.deleted",
      metadata: {},
    });
    expect(audit.find((event) => event.id === "old-event")).toMatchObject({
      caseId: null,
      deletedCaseId: row.id,
      caseReference: row.reference,
    });
    expect(JSON.stringify(audit)).not.toMatch(/Segreto|Nome-Personale/);
    expect(JSON.stringify(logs)).not.toMatch(/Segreto|Nome-Personale|AV-2027/);
    await fails(
      await request(`/cases/${row.id}`, "DELETE", { confirmReference: row.reference }, admin),
      404,
      "not_found",
    );
  });
  it("commits file tombstones when storage fails and retries after deletion, without duplicate audit", async () => {
    const row = await caseFixture("retry");
    const key = await fileFixture(row.id);
    const realDelete = storage.delete.bind(storage);
    const remove = vi
      .spyOn(storage, "delete")
      .mockRejectedValueOnce(new Error("Segreto storage failure"));
    expect(
      (await request(`/cases/${row.id}`, "DELETE", { confirmReference: row.reference }, admin))
        .status,
    ).toBe(204);
    expect(await db.select().from(cases)).toHaveLength(0);
    expect(await db.select().from(storageDeletions)).toMatchObject([
      { storageKey: key, attempts: 1 },
    ]);
    expect(JSON.stringify(logs)).not.toContain("Segreto");
    remove.mockImplementation(realDelete);
    await cron();
    expect(await db.select().from(storageDeletions)).toHaveLength(1);
    now = new Date(now.getTime() + 61000);
    expect((await cron()).status).toBe(200);
    expect(await db.select().from(storageDeletions)).toHaveLength(0);
    expect(await db.select().from(events)).toHaveLength(1);
  });
  it("rolls back DB deletion and tombstones if the audit insert fails", async () => {
    const row = await caseFixture("rollback");
    const key = await fileFixture(row.id);
    await db.execute(
      sql`ALTER TABLE events ADD CONSTRAINT reject_erasure_test CHECK (type <> 'case.deleted')`,
    );
    try {
      await fails(
        await request(`/cases/${row.id}`, "DELETE", { confirmReference: row.reference }, admin),
        500,
        "internal",
      );
      expect(await db.select().from(cases)).toHaveLength(1);
      expect(await db.select().from(documents)).toHaveLength(1);
      expect(await db.select().from(storageDeletions)).toHaveLength(0);
      expect(await storage.get(key)).toHaveLength(3);
    } finally {
      await db.execute(sql`ALTER TABLE events DROP CONSTRAINT reject_erasure_test`);
    }
  });
  it("uses per-tenant retention, closure or expiry timestamps, and a strict age boundary with a fake clock", async () => {
    await db
      .update(settings)
      .set({ retentionDays: 30 })
      .where(eq(settings.organizationId, "org-a"));
    await db
      .update(settings)
      .set({ retentionDays: 90 })
      .where(eq(settings.organizationId, "org-b"));
    const cutoff = new Date(now.getTime() - 30 * 86400000).toISOString();
    const older = new Date(Date.parse(cutoff) - 1).toISOString();
    const future = new Date(now.getTime() + 86400000).toISOString();
    await caseFixture("closed-old", { status: "closed", closedAt: older, expiresAt: future });
    await caseFixture("expired-old", { expiresAt: older });
    await caseFixture("boundary", { expiresAt: cutoff });
    await caseFixture("closed-recent", {
      status: "closed",
      closedAt: now.toISOString(),
      expiresAt: future,
    });
    await caseFixture("reopened", { status: "in_review", closedAt: older, expiresAt: future });
    await caseFixture("ready", { status: "ready", reviewCompletedAt: older, expiresAt: future });
    await caseFixture("foreign-retention", {
      organizationId: "org-b",
      officeId: "office-b",
      expiresAt: older,
    });
    const key = await fileFixture("closed-old");
    expect((await request("/cases", "GET", undefined, admin)).status).toBe(200);
    expect(await db.select().from(cases)).toHaveLength(7);
    const response = await cron();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ deletedCases: 2 });
    expect((await db.select().from(cases)).map((r) => r.id).sort()).toEqual([
      "boundary",
      "closed-recent",
      "foreign-retention",
      "ready",
      "reopened",
    ]);
    await expect(storage.get(key)).rejects.toThrow();
    const audit = await db.select().from(events).where(eq(events.type, "case.retention_deleted"));
    expect(audit).toHaveLength(2);
    expect(
      audit.every(
        (event) =>
          event.type === "case.retention_deleted" &&
          event.actor === "system" &&
          event.actorId === null &&
          event.caseId === null,
      ),
    ).toBe(true);
    expect(await (await cron()).json()).toMatchObject({ skipped: true });
    now = new Date(now.getTime() + 61000);
    expect(await (await cron()).json()).toMatchObject({ deletedCases: 1 });
    now = new Date(now.getTime() + 61000);
    expect(await (await cron()).json()).toMatchObject({ deletedCases: 0 });
    expect(
      await db.select().from(events).where(eq(events.type, "case.retention_deleted")),
    ).toHaveLength(3);
  });
  it("limits each cron to one batch, has no user-request purge, and retries failed retention files", async () => {
    for (let index = 0; index <= RETENTION_BATCH_SIZE; index++)
      await caseFixture(`batch-${index}`, { expiresAt: "2026-01-01T00:00:00Z" });
    await fileFixture("batch-0");
    const realDelete = storage.delete.bind(storage);
    const remove = vi
      .spyOn(storage, "delete")
      .mockRejectedValueOnce(new Error("Temporary storage failure"));
    expect((await request("/settings", "PATCH", { retentionDays: 30 }, admin)).status).toBe(200);
    expect(await db.select().from(cases)).toHaveLength(RETENTION_BATCH_SIZE + 1);
    expect(await (await cron()).json()).toMatchObject({ deletedCases: RETENTION_BATCH_SIZE });
    expect(await db.select().from(cases)).toHaveLength(1);
    expect(await db.select().from(storageDeletions)).toHaveLength(1);
    remove.mockImplementation(realDelete);
    now = new Date(now.getTime() + 61000);
    expect(await (await cron()).json()).toMatchObject({ deletedCases: 1 });
    expect(await db.select().from(cases)).toHaveLength(0);
    expect(await db.select().from(storageDeletions)).toHaveLength(0);
    expect(
      await db.select().from(events).where(eq(events.type, "case.retention_deleted")),
    ).toHaveLength(RETENTION_BATCH_SIZE + 1);
  });
  it("tracks closure time and clears it when the operator reopens a case", async () => {
    const row = await caseFixture("close-time");
    expect((await request(`/cases/${row.id}`, "PATCH", { status: "closed" }, admin)).status).toBe(
      200,
    );
    const [closed] = await db.select().from(cases).where(eq(cases.id, row.id));
    expect(Date.parse(closed!.closedAt!)).toBe(now.getTime());
    now = new Date(now.getTime() + 60000);
    expect(
      (await request(`/cases/${row.id}`, "PATCH", { internalNotes: "Updated" }, admin)).status,
    ).toBe(200);
    expect(
      Date.parse((await db.select().from(cases).where(eq(cases.id, row.id)))[0]!.closedAt!),
    ).toBe(Date.parse(initial));
    expect(
      (await request(`/cases/${row.id}`, "PATCH", { status: "in_review" }, admin)).status,
    ).toBe(200);
    expect((await db.select().from(cases).where(eq(cases.id, row.id)))[0]?.closedAt).toBeNull();
  });
});

it("citizen member edits align count and preserve surviving identities, documents and ownership", async () => {
  const token = newToken();
  const before: Record<string, AnswerValue> = {
    household_count: 2,
    members: [
      { id: "member-applicant", role: "richiedente", firstName: "Esempio" },
      { id: "member-parent", role: "genitore", firstName: "Madre" },
    ],
    accounts_count: 1,
    account_owner_0: "member-applicant",
    income_present_member_applicant: true,
  };
  const row = await caseFixture("members", { answers: before, tokenHash: hashToken(token) });
  await fileFixture(row.id);
  await db
    .update(documents)
    .set({ memberId: "member-parent", checklistItemId: "identity_member-parent" })
    .where(eq(documents.caseId, row.id));
  const result = await request(`/c/${token}/turn`, "POST", {
    type: "answer",
    questionId: "members",
    value: [{ id: "member-applicant", role: "richiedente", firstName: "Esempio" }],
  });
  expect(result.status).toBe(200);
  const view = CitizenCase.parse(await result.json());
  expect(view.answers.household_count).toBe(1);
  expect(view.household.map((member) => member.id)).toEqual(["member-applicant"]);
  expect(view.answers.account_owner_0).toBe("member-applicant");
  expect((await db.select().from(documents))[0]).toMatchObject({
    memberId: null,
    checklistItemId: null,
  });
  const added = await request(`/c/${token}/turn`, "POST", {
    type: "answer",
    questionId: "members",
    value: [
      { id: "member-applicant", role: "richiedente", firstName: "Esempio" },
      { role: "genitore", firstName: "Padre" },
      { role: "genitore", firstName: "Madre" },
    ],
  });
  expect(added.status).toBe(200);
  expect(CitizenCase.parse(await added.json()).answers.household_count).toBe(3);
});
