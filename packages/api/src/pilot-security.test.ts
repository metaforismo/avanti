import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  createDatabase,
  organizations,
  offices,
  operators,
  cases,
  documents,
  sessions,
  settings,
  type Database,
} from "@avanti/db";
import { createApp } from "./app";
import { hashPassword, hashToken, newToken } from "./security";
import { MemoryStorage } from "./storage";
import { GatewayIntelligence } from "./ai";

const origin = "https://avanti.example.test";
const at = new Date("2027-01-05T10:00:00Z");
const password = "Password-Test-2027!";
let db: Database;
let close: () => Promise<void>;
let app: ReturnType<typeof createApp>;
const storage = new MemoryStorage();
const ai = new GatewayIntelligence();
const tokens = { a: newToken(), b: newToken() };
const logs: unknown[] = [];
const errors: unknown[] = [];
const sessionToken = newToken();
const cookie = `avanti_session=${sessionToken}`;
beforeAll(async () => {
  ({ db, close } = await createDatabase({ memory: true }));
  for (const tenant of ["a", "b"] as const) {
    await db.insert(organizations).values({ id: tenant, name: `CAF ${tenant}`, kind: "caf" });
    await db.insert(offices).values({
      id: `office-${tenant}`,
      organizationId: tenant,
      slug: `office-${tenant}`,
      name: "Sede",
      address: "Esempio",
      city: "Roma",
    });
    await db.insert(operators).values({
      id: `operator-${tenant}`,
      organizationId: tenant,
      name: `Operatore ${tenant}`,
      email: `${tenant}@example.test`,
      passwordHash: await hashPassword(password),
      role: "admin",
    });
    await db
      .insert(settings)
      .values({ organizationId: tenant, baselineMinutesPerCase: tenant === "a" ? 20 : 90 });
    await db.insert(cases).values({
      id: `case-${tenant}`,
      organizationId: tenant,
      officeId: `office-${tenant}`,
      tokenHash: hashToken(tokens[tenant]),
      reference: `AV-2027-00000${tenant === "a" ? 1 : 2}`,
      language: "it",
      status: "intake",
      createdAt: at.toISOString(),
      updatedAt: at.toISOString(),
      expiresAt: "2027-03-01T00:00:00Z",
      internalNotes: `NOTA-RISERVATA-${tenant}`,
    });
    await db.insert(documents).values({
      id: `doc-${tenant}`,
      caseId: `case-${tenant}`,
      fileName: "ESEMPIO.pdf",
      mimeType: "application/pdf",
      sizeBytes: 3,
      storageKey: `private-${tenant}`,
      sha256: "hash",
      uploadedAt: at.toISOString(),
      status: "analyzed",
    });
    await storage.put(`private-${tenant}`, new Uint8Array([1, 2, 3]));
  }
  await db.insert(sessions).values({
    id: "session-a",
    operatorId: "operator-a",
    tokenHash: hashToken(sessionToken),
    createdAt: at.toISOString(),
    expiresAt: "2027-01-05T18:00:00Z",
  });
  app = createApp({
    db,
    storage,
    ai,
    clock: () => at,
    publicUrl: origin,
    production: true,
    clientAddress: () => "127.0.0.1",
    rateLimitSecret: "synthetic-secret",
    logger: (r) => logs.push(r),
    errorLogger: (r) => errors.push(r),
  });
});
afterAll(async () => {
  await close?.();
});
function request(
  path: string,
  method = "GET",
  body?: unknown,
  session = cookie,
  requestOrigin: string | null = origin,
) {
  const headers = new Headers();
  if (requestOrigin) headers.set("Origin", requestOrigin);
  if (session) headers.set("Cookie", session);
  if (body !== undefined) headers.set("Content-Type", "application/json");
  return app.request(path, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
it("pilot: rejects foreign resources on every tenant resource route before storage/AI", async () => {
  const get = vi.spyOn(storage, "get");
  const translate = vi.spyOn(ai, "translate");
  const routes: [string, string, unknown?][] = [
    ["/api/cases/case-b", "GET"],
    ["/api/cases/case-b", "PATCH", { internalNotes: "estranea" }],
    ["/api/cases/case-b", "DELETE", { confirmReference: "AV-2027-000002" }],
    ["/api/cases/case-b/checklist/item/review", "POST", { decision: "waived", note: "Esempio" }],
    ["/api/cases/case-b/requests", "POST", { checklistItemIds: [], message: "Esempio" }],
    ["/api/cases/case-b/documents/doc-b/file", "GET"],
    ["/api/cases/case-a/documents/doc-b/file", "GET"],
    ["/api/cases/case-b/export?format=json", "GET"],
    ["/api/cases/case-b/export?format=pdf", "GET"],
    ["/api/operators/operator-b", "PATCH", { name: "Estraneo" }],
    ["/api/operators/operator-b/reset-password", "POST"],
    ["/api/offices/office-b", "PATCH", { name: "Estranea" }],
    ["/api/cases", "POST", { officeId: "office-b" }],
    ["/api/cases/case-a", "PATCH", { assigneeId: "operator-b" }],
    [`/api/c/${tokens.a}/documents/doc-b/file`, "GET"],
    [`/api/c/${tokens.a}/documents/doc-b`, "DELETE"],
    [`/api/c/${tokens.a}/documents/doc-b`, "PATCH", { checklistItemId: null }],
  ];
  for (const [path, method, input] of routes) {
    const response = await request(path, method, input);
    expect(response.status, `${method} ${path}`).toBe(404);
    expect(await response.text()).not.toContain("NOTA-RISERVATA-b");
  }
  expect(get).not.toHaveBeenCalled();
  expect(translate).not.toHaveBeenCalled();
  get.mockRestore();
  translate.mockRestore();
  for (const path of ["/api/cases?officeId=office-b", "/api/cases?assignee=operator-b"]) {
    expect(await (await request(path)).json()).toMatchObject({ items: [] });
  }
  expect(await (await request("/api/operators")).json()).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ id: "operator-b" })]),
  );
  expect(await (await request("/api/settings")).json()).toMatchObject({
    baselineMinutesPerCase: 20,
  });
  expect(
    await (await request("/api/metrics?from=2027-01-01&to=2027-01-31&officeId=office-b")).json(),
  ).toMatchObject({ casesStarted: 0 });
  // Public slugs expose only the public office contract, intentionally across CAFs.
  expect(await (await request("/api/offices/office-b")).text()).not.toMatch(
    /passwordHash|tokenHash|NOTA-RISERVATA/,
  );
});
it("pilot: every mutation rejects foreign or missing Origin including multipart and public intake", async () => {
  const routes: [string, string, unknown?][] = [
    ["/api/intake", "POST", { officeSlug: "office-a", privacyAccepted: true }],
    ["/api/leads", "POST", {}],
    [`/api/c/${tokens.a}/turn`, "POST", { type: "text", text: "Esempio" }],
    [`/api/c/${tokens.a}/language`, "PUT", { language: "en" }],
    [`/api/c/${tokens.a}/documents/doc-a`, "DELETE"],
    [`/api/c/${tokens.a}/submit`, "POST", {}],
    ["/api/cases/case-a", "PATCH", {}],
    ["/api/auth/login", "POST", {}],
    ["/api/settings", "PATCH", {}],
    ["/api/operators", "POST", {}],
    ["/api/offices", "POST", {}],
  ];
  for (const [path, method, input] of routes)
    for (const value of ["https://evil.example.test", null])
      expect((await request(path, method, input, cookie, value)).status, `${method} ${path}`).toBe(
        403,
      );
  const form = new FormData();
  form.set("file", new File(["bad"], "ESEMPIO.pdf"));
  expect(
    (
      await app.request(`/api/c/${tokens.a}/documents`, {
        method: "POST",
        headers: { Origin: "https://evil.example.test" },
        body: form,
      })
    ).status,
  ).toBe(403);
  // Host and URL are not allowed to broaden the canonical production origin.
  expect(
    (
      await app.request("https://evil.example.test/api/auth/login", {
        method: "POST",
        headers: { Host: "evil.example.test", Origin: "https://evil.example.test" },
        body: "{}",
      })
    ).status,
  ).toBe(403);
});
it("pilot: capability is revoked on closure and stays revoked after reopening", async () => {
  expect((await request("/api/cases/case-a", "PATCH", { status: "closed" })).status).toBe(200);
  for (const path of [`/api/c/${tokens.a}`, `/api/c/${tokens.a}/documents/doc-a/file`])
    expect((await request(path)).status).toBe(410);
  expect((await request("/api/cases/case-a", "PATCH", { status: "in_review" })).status).toBe(200);
  expect((await request(`/api/c/${tokens.a}`)).status).toBe(410);
});
it("pilot: login revokes the presented session; password rotates current and revokes others; logout invalidates", async () => {
  const login = await request("/api/auth/login", "POST", { email: "a@example.test", password });
  expect(login.status).toBe(200);
  const current = login.headers.get("set-cookie")!.split(";")[0]!;
  expect(current).not.toBe(cookie);
  expect(login.headers.get("set-cookie")).toMatch(/HttpOnly/);
  expect(login.headers.get("set-cookie")).toMatch(/Secure/);
  expect(login.headers.get("set-cookie")).toMatch(/SameSite=Lax/);
  expect((await request("/api/auth/me", "GET", undefined, cookie)).status).toBe(401);
  const other = newToken();
  await db.insert(sessions).values({
    id: "other",
    operatorId: "operator-a",
    tokenHash: hashToken(other),
    createdAt: at.toISOString(),
    expiresAt: "2027-01-05T18:00:00Z",
  });
  const changed = await request(
    "/api/auth/password",
    "POST",
    { currentPassword: password, newPassword: "Changed-Test-2027!" },
    current,
  );
  expect(changed.status).toBe(200);
  const rotated = changed.headers.get("set-cookie")!.split(";")[0]!;
  expect(rotated).not.toBe(current);
  expect((await request("/api/auth/me", "GET", undefined, current)).status).toBe(401);
  expect((await request("/api/auth/me", "GET", undefined, `avanti_session=${other}`)).status).toBe(
    401,
  );
  expect((await request("/api/auth/me", "GET", undefined, rotated)).status).toBe(200);
  expect((await request("/api/auth/logout", "POST", undefined, rotated)).status).toBe(200);
  expect((await request("/api/auth/me", "GET", undefined, rotated)).status).toBe(401);
});
it("pilot: API headers also protect auth failures and no CORS / capabilities / storage keys reach logs", async () => {
  const response = await request(`/api/c/${tokens.b}/documents/doc-b/file`);
  expect(response.headers.get("Content-Disposition")).toContain("attachment");
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  const failure = await request("/api/auth/me", "GET", undefined, "");
  expect(failure.headers.get("Content-Security-Policy")).toContain("default-src 'none'");
  const output = JSON.stringify([logs, errors]);
  for (const secret of [
    tokens.a,
    tokens.b,
    sessionToken,
    "private-a",
    "private-b",
    "NOTA-RISERVATA",
  ])
    expect(output).not.toContain(secret);
});
it("pilot: token generation is 256 bits; expiry rejects at the boundary", async () => {
  const generated = Array.from({ length: 500 }, newToken);
  expect(new Set(generated).size).toBe(500);
  for (const token of generated) {
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
  }
  await db.update(cases).set({ expiresAt: at.toISOString() }).where(eq(cases.id, "case-b"));
  expect((await request(`/api/c/${tokens.b}`)).status).toBe(410);
});

it("pilot: export and operator translation enforce per-operator and trusted-IP quotas", async () => {
  const token = newToken();
  await db.insert(sessions).values({
    id: "rate-session",
    operatorId: "operator-b",
    tokenHash: hashToken(token),
    createdAt: at.toISOString(),
    expiresAt: "2027-01-05T10:30:00Z",
  });
  const headers = { Cookie: `avanti_session=${token}`, Origin: origin };
  const limited = createApp({
    db,
    storage,
    ai,
    clock: () => at,
    publicUrl: origin,
    production: true,
    trustProxy: true,
    rateLimitSecret: "synthetic-limit",
  });
  expect((await limited.request("/api/cases/case-b/export", { headers })).status).toBe(400);
  const proxyHeaders = { ...headers, "x-forwarded-for": "1.2.3.4, 127.0.0.1" };
  for (let count = 0; count < 20; count++)
    expect(
      (await limited.request("/api/cases/case-b/export", { headers: proxyHeaders })).status,
    ).toBe(200);
  const blocked = await limited.request("/api/cases/case-b/export?format=pdf", {
    headers: proxyHeaders,
  });
  expect(blocked.status).toBe(429);
  expect(blocked.headers.get("Retry-After")).toBe("60");
  await db.update(cases).set({ status: "in_review", language: "en" }).where(eq(cases.id, "case-b"));
  for (let count = 0; count < 30; count++)
    expect(
      (
        await limited.request("/api/cases/case-b/requests", {
          method: "POST",
          headers: { ...proxyHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({ checklistItemIds: [], message: "Esempio" }),
        })
      ).status,
    ).toBe(200);
  expect(
    (
      await limited.request("/api/cases/case-b/requests", {
        method: "POST",
        headers: { ...proxyHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ checklistItemIds: [], message: "Esempio" }),
      })
    ).status,
  ).toBe(429);
});
