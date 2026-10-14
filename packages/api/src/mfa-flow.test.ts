import { randomBytes } from "node:crypto";
import { beforeAll, beforeEach, afterAll, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import {
  createDatabase,
  events,
  operators,
  organizations,
  sessions,
  settings,
  rateLimits,
  type Database,
} from "@avanti/db";
import {
  LoginResponse,
  MfaChallenge,
  MfaRecoveryCodesResponse,
  MfaSetupResponse,
  MfaStatus,
  Operator,
  OperatorSummary,
} from "@avanti/contracts";
import { createApp } from "./app";
import { MemoryStorage } from "./storage";
import { hashPassword, hashToken, newToken } from "./security";
import { mfaCipher, totp } from "./mfa";
import { exportOrganization } from "./organization-export";

const origin = "http://localhost:3400",
  password = "PasswordSicura2027!",
  key = randomBytes(32).toString("hex");
let db: Database,
  close: () => Promise<void>,
  app: ReturnType<typeof createApp>,
  now: Date,
  logs: unknown[],
  passwordHash: string;
const cookie = (r: Response) => r.headers.get("set-cookie")!.split(";")[0]!;
async function request(
  path: string,
  method = "GET",
  input?: unknown,
  auth?: string,
  requestOrigin: string | null = origin,
) {
  return app.request(`/api${path}`, {
    method,
    headers: {
      ...(requestOrigin ? { Origin: requestOrigin } : {}),
      ...(auth ? { Cookie: auth } : {}),
      ...(input === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  });
}
async function login(id = "user") {
  const response = await request("/auth/login", "POST", { email: `${id}@example.test`, password });
  expect(response.status).toBe(200);
  return { cookie: cookie(response), data: LoginResponse.parse(await response.json()) };
}
async function session(id = "admin") {
  const token = newToken();
  await db.insert(sessions).values({
    id: crypto.randomUUID(),
    operatorId: id,
    tokenHash: hashToken(token),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 1800000).toISOString(),
  });
  return `avanti_session=${token}`;
}
const stepCode = (secret: string) => totp(secret, Math.floor(now.getTime() / 30000));
function invalidCode(secret: string) {
  const step = Math.floor(now.getTime() / 30000);
  const valid = new Set([-1, 0, 1].map((offset) => totp(secret, step + offset)));
  for (let value = 0; value < 1000000; value++) {
    const code = value.toString().padStart(6, "0");
    if (!valid.has(code)) return code;
  }
  throw new Error("No invalid test code");
}
async function enable(id = "user") {
  const auth = await login(id);
  const start = await request(
    "/auth/mfa/setup/start",
    "POST",
    { currentPassword: password },
    auth.cookie,
  );
  expect(start.status).toBe(200);
  const setup = MfaSetupResponse.parse(await start.json());
  const response = await request(
    "/auth/mfa/setup/confirm",
    "POST",
    { code: stepCode(setup.secret) },
    auth.cookie,
  );
  expect(response.status).toBe(200);
  const recovery = MfaRecoveryCodesResponse.parse(await response.json());
  return {
    secret: setup.secret,
    codes: recovery.recoveryCodes,
    cookie: cookie(response),
    previous: auth.cookie,
  };
}
beforeAll(async () => {
  ({ db, close } = await createDatabase({ memory: true }));
  passwordHash = await hashPassword(password);
});
afterAll(async () => {
  await close();
});
beforeEach(async () => {
  await db.delete(organizations);
  await db.delete(rateLimits);
  now = new Date("2027-01-05T10:00:00Z");
  logs = [];
  await db.insert(organizations).values([
    { id: "a", name: "CAF A", kind: "caf" },
    { id: "b", name: "CAF B", kind: "caf" },
  ]);
  await db.insert(operators).values(
    ["user", "admin", "other"].map((id) => ({
      id,
      organizationId: id === "other" ? "b" : "a",
      name: id,
      email: `${id}@example.test`,
      passwordHash,
      role: id === "user" ? ("operator" as const) : ("admin" as const),
    })),
  );
  app = createApp({
    db,
    storage: new MemoryStorage(),
    clock: () => now,
    mfaEncryptionKey: key,
    rateLimitSecret: key,
    logger: (r) => logs.push(r),
    errorLogger: (r) => logs.push(r),
  });
});
it("demo-compatible password login returns Operator without a second factor by default", async () => {
  const auth = await login();
  expect(Operator.parse(auth.data)).toMatchObject({ mfaEnabled: false, mustSetupMfa: false });
  expect((await request("/cases", "GET", undefined, auth.cookie)).status).toBe(200);
  expect((await request("/auth/mfa/verify", "POST", { code: "000000" }, auth.cookie)).status).toBe(
    401,
  );
});
it("enrollment binds secret to the initiating session, expires after five minutes and requires password", async () => {
  const first = await login(),
    second = await login();
  expect(
    (await request("/auth/mfa/setup/start", "POST", { currentPassword: "wrong" }, first.cookie))
      .status,
  ).toBe(401);
  const start = await request(
    "/auth/mfa/setup/start",
    "POST",
    { currentPassword: password },
    first.cookie,
  );
  const setup = MfaSetupResponse.parse(await start.json());
  const uri = new URL(setup.otpauthUri);
  expect(uri.searchParams.get("algorithm")).toBe("SHA1");
  expect(uri.searchParams.get("digits")).toBe("6");
  expect(uri.searchParams.get("period")).toBe("30");
  expect(
    (
      await request(
        "/auth/mfa/setup/confirm",
        "POST",
        { code: stepCode(setup.secret) },
        second.cookie,
      )
    ).status,
  ).toBe(401);
  now = new Date(now.getTime() + 300000);
  expect(
    (
      await request(
        "/auth/mfa/setup/confirm",
        "POST",
        { code: stepCode(setup.secret) },
        first.cookie,
      )
    ).status,
  ).toBe(401);
  expect(
    (await db.select().from(operators).where(eq(operators.id, "user")))[0]!.mfaEnabledAt,
  ).toBeNull();
});
it("enables atomically, revokes existing cookies and returns recovery codes once without revealing secrets later", async () => {
  const other = await session("user"),
    enabled = await enable();
  expect((await request("/auth/me", "GET", undefined, other)).status).toBe(401);
  expect((await request("/auth/me", "GET", undefined, enabled.previous)).status).toBe(401);
  const [stored] = await db.select().from(operators).where(eq(operators.id, "user"));
  expect(stored!.mfaSecret).not.toContain(enabled.secret);
  expect(stored!.mfaRecoveryHashes).toHaveLength(10);
  expect(await mfaCipher({ key }).decrypt(stored!.mfaSecret!, "user")).toBe(enabled.secret);
  expect(
    (await request("/auth/mfa/setup/start", "POST", { currentPassword: password }, enabled.cookie))
      .status,
  ).toBe(409);
  const status = await request("/auth/mfa/status", "GET", undefined, enabled.cookie);
  expect(MfaStatus.parse(await status.clone().json())).toMatchObject({
    enabled: true,
    recoveryCodesRemaining: 10,
    setupPending: false,
  });
  const me = await request("/auth/me", "GET", undefined, enabled.cookie);
  expect(Operator.parse(await me.clone().json()).mfaEnabled).toBe(true);
  const confirmation = await request(
    "/auth/mfa/setup/confirm",
    "POST",
    { code: stepCode(enabled.secret) },
    enabled.cookie,
  );
  expect(confirmation.status).toBe(409);
  const output = JSON.stringify({
    logs,
    events: await db.select().from(events),
    status: await status.json(),
    me: await me.json(),
    confirmation: await confirmation.json(),
  });
  for (const value of [
    enabled.secret,
    stepCode(enabled.secret),
    ...enabled.codes,
    ...stored!.mfaRecoveryHashes,
    stored!.mfaSecret!,
    password,
  ])
    expect(output).not.toContain(value);
  expect((await db.select().from(sessions)).every((row) => row.mfaSetupSecret === null)).toBe(true);
});
it("pending session cannot access any other APIs or renew its lifetime, then rotates on successful TOTP", async () => {
  const enabled = await enable();
  now = new Date(now.getTime() + 30000);
  const pending = await login();
  MfaChallenge.parse(pending.data);
  const [stored] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.tokenHash, hashToken(pending.cookie.split("=")[1]!)));
  expect(Date.parse(stored!.expiresAt) - now.getTime()).toBe(300000);
  for (const path of [
    "/cases",
    "/metrics",
    "/settings",
    "/operators",
    "/audit",
    "/health",
    "/offices/demo",
    "/auth/mfa/status",
  ])
    expect((await request(path, "GET", undefined, pending.cookie)).status, path).toBe(403);
  for (const path of [
    "/auth/password",
    "/auth/mfa/setup/start",
    "/auth/mfa/setup/confirm",
    "/auth/mfa/disable",
    "/auth/mfa/recovery-codes/regenerate",
    "/intake",
  ])
    expect((await request(path, "POST", {}, pending.cookie)).status, path).toBe(403);
  const me = await request("/auth/me", "GET", undefined, pending.cookie);
  MfaChallenge.parse(await me.json());
  expect(me.headers.get("set-cookie")).toBeNull();
  const verified = await request(
    "/auth/mfa/verify",
    "POST",
    { code: stepCode(enabled.secret) },
    pending.cookie,
  );
  expect(verified.status).toBe(200);
  expect(Operator.parse(await verified.json()).mfaEnabled).toBe(true);
  expect(cookie(verified)).not.toBe(pending.cookie);
  expect((await request("/auth/me", "GET", undefined, pending.cookie)).status).toBe(401);
  expect((await request("/cases", "GET", undefined, cookie(verified))).status).toBe(200);
});
it("rejects the enrollment TOTP replay and allows only one simultaneous verification of a fresh step", async () => {
  const enabled = await enable(),
    first = await login(),
    second = await login();
  expect(
    (await request("/auth/mfa/verify", "POST", { code: stepCode(enabled.secret) }, first.cookie))
      .status,
  ).toBe(401);
  now = new Date(now.getTime() + 30000);
  const results = await Promise.all(
    [first, second].map((auth) =>
      request("/auth/mfa/verify", "POST", { code: stepCode(enabled.secret) }, auth.cookie),
    ),
  );
  expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
});
it("consumes a recovery code once even in parallel and logs only its use", async () => {
  const enabled = await enable(),
    first = await login(),
    second = await login();
  const results = await Promise.all(
    [first, second].map((auth) =>
      request("/auth/mfa/verify", "POST", { code: enabled.codes[0]!.toUpperCase() }, auth.cookie),
    ),
  );
  expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
  const rows = await db.select().from(events).where(eq(events.type, "auth.mfa_recovery_used"));
  expect(rows).toHaveLength(1);
  expect(rows[0]!.metadata).toEqual({});
  expect(
    (await db.select().from(operators).where(eq(operators.id, "user")))[0]!.mfaRecoveryHashes,
  ).toHaveLength(9);
});
it("expires pending sessions without renewal and rejects unauthenticated and cross-origin attempts", async () => {
  const enabled = await enable(),
    pending = await login();
  expect((await request("/auth/mfa/verify", "POST", { code: enabled.codes[0] })).status).toBe(401);
  expect(
    (await request("/auth/mfa/verify", "POST", { code: enabled.codes[0] }, pending.cookie, null))
      .status,
  ).toBe(403);
  expect(
    (
      await request(
        "/auth/mfa/verify",
        "POST",
        { code: enabled.codes[0] },
        pending.cookie,
        "https://evil.test",
      )
    ).status,
  ).toBe(403);
  now = new Date(now.getTime() + 300000);
  expect(
    (await request("/auth/mfa/verify", "POST", { code: enabled.codes[0] }, pending.cookie)).status,
  ).toBe(401);
});
it("shares ten MFA attempts per account across cookies and logs one failure per window", async () => {
  const enabled = await enable();
  now = new Date(now.getTime() + 61000);
  const first = await login(),
    second = await login();
  for (let i = 0; i < 10; i++)
    expect(
      (
        await request(
          "/auth/mfa/verify",
          "POST",
          { code: invalidCode(enabled.secret) },
          i % 2 ? first.cookie : second.cookie,
        )
      ).status,
    ).toBe(401);
  const limited = await request(
    "/auth/mfa/verify",
    "POST",
    { code: enabled.codes[0] },
    second.cookie,
  );
  expect(limited.status).toBe(429);
  expect(limited.headers.get("retry-after")).toBe("60");
  expect(
    (await request("/auth/mfa/verify", "POST", { code: enabled.codes[0] }, first.cookie)).status,
  ).toBe(429);
  expect(await db.select().from(events).where(eq(events.type, "auth.mfa_failed"))).toHaveLength(1);
  now = new Date(now.getTime() + 61000);
  expect(
    (await request("/auth/mfa/verify", "POST", { code: invalidCode(enabled.secret) }, first.cookie))
      .status,
  ).toBe(401);
  expect(await db.select().from(events).where(eq(events.type, "auth.mfa_failed"))).toHaveLength(2);
  expect(
    (await request("/auth/mfa/verify", "POST", { code: enabled.codes[0] }, first.cookie)).status,
  ).toBe(200);
});
it("regeneration invalidates all old recovery codes, needs both factors and preserves TOTP replay protection", async () => {
  const enabled = await enable();
  now = new Date(now.getTime() + 61000);
  expect(
    (
      await request(
        "/auth/mfa/recovery-codes/regenerate",
        "POST",
        { currentPassword: "wrong", code: enabled.codes[0] },
        enabled.cookie,
      )
    ).status,
  ).toBe(401);
  const regenerated = await request(
    "/auth/mfa/recovery-codes/regenerate",
    "POST",
    { currentPassword: password, code: stepCode(enabled.secret) },
    enabled.cookie,
  );
  expect(regenerated.status).toBe(200);
  const fresh = MfaRecoveryCodesResponse.parse(await regenerated.json());
  const pending = await login();
  expect(
    (await request("/auth/mfa/verify", "POST", { code: enabled.codes[1] }, pending.cookie)).status,
  ).toBe(401);
  expect(
    (await request("/auth/mfa/verify", "POST", { code: stepCode(enabled.secret) }, pending.cookie))
      .status,
  ).toBe(401);
  expect(
    (await request("/auth/mfa/verify", "POST", { code: fresh.recoveryCodes[0] }, pending.cookie))
      .status,
  ).toBe(200);
});
it("disabling requires password plus a fresh factor and revokes pending and authenticated sessions", async () => {
  const enabled = await enable(),
    pending = await login();
  now = new Date(now.getTime() + 61000);
  const incorrect = await request(
    "/auth/mfa/disable",
    "POST",
    { currentPassword: "wrong", code: enabled.codes[0] },
    enabled.cookie,
  );
  const badCode = await request(
    "/auth/mfa/disable",
    "POST",
    { currentPassword: password, code: invalidCode(enabled.secret) },
    enabled.cookie,
  );
  expect(incorrect.status).toBe(401);
  expect(badCode.status).toBe(401);
  expect((await incorrect.json()).error.message).toBe((await badCode.json()).error.message);
  const disabled = await request(
    "/auth/mfa/disable",
    "POST",
    { currentPassword: password, code: enabled.codes[0] },
    enabled.cookie,
  );
  expect(disabled.status).toBe(200);
  expect((await request("/auth/me", "GET", undefined, enabled.cookie)).status).toBe(401);
  expect((await request("/auth/me", "GET", undefined, pending.cookie)).status).toBe(401);
  expect(Operator.parse((await login()).data).mfaEnabled).toBe(false);
  expect((await request("/auth/me", "GET", undefined, cookie(disabled))).status).toBe(200);
  const [stored] = await db.select().from(operators).where(eq(operators.id, "user"));
  expect(stored).toMatchObject({
    mfaSecret: null,
    mfaEnabledAt: null,
    mfaLastUsedStep: null,
    mfaRecoveryHashes: [],
  });
});
it("organization mandate gates new and existing sessions and enrollment unlocks the console", async () => {
  const old = await login(),
    admin = await session();
  expect((await request("/settings", "PATCH", { mfaRequired: true }, admin)).status).toBe(200);
  expect((await request("/cases", "GET", undefined, old.cookie)).status).toBe(403);
  expect((await request("/health", "GET", undefined, old.cookie)).status).toBe(403);
  const auth = await login();
  expect(Operator.parse(auth.data).mustSetupMfa).toBe(true);
  const [stored] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.tokenHash, hashToken(auth.cookie.split("=")[1]!)));
  expect(stored!.state).toBe("mfa_setup");
  expect(Date.parse(stored!.expiresAt) - now.getTime()).toBe(300000);
  const enabled = await enable();
  expect((await request("/cases", "GET", undefined, enabled.cookie)).status).toBe(200);
  expect(
    (
      await request(
        "/auth/mfa/disable",
        "POST",
        { currentPassword: password, code: enabled.codes[0] },
        enabled.cookie,
      )
    ).status,
  ).toBe(409);
});
it("mandatory password change precedes required MFA setup and cannot upgrade a challenge", async () => {
  await db.insert(settings).values({ organizationId: "a", mfaRequired: true });
  await db.update(operators).set({ mustChangePassword: true }).where(eq(operators.id, "user"));
  const auth = await login();
  expect(Operator.parse(auth.data)).toMatchObject({ mustChangePassword: true, mustSetupMfa: true });
  expect(
    (await request("/auth/mfa/setup/start", "POST", { currentPassword: password }, auth.cookie))
      .status,
  ).toBe(403);
  const changed = await request(
    "/auth/password",
    "POST",
    { currentPassword: password, newPassword: "PasswordNuova2027!" },
    auth.cookie,
  );
  expect(changed.status).toBe(200);
  expect(Operator.parse(await changed.json()).mustSetupMfa).toBe(true);
  expect((await request("/cases", "GET", undefined, cookie(changed))).status).toBe(403);
  const setup = await request(
    "/auth/mfa/setup/start",
    "POST",
    { currentPassword: "PasswordNuova2027!" },
    cookie(changed),
  );
  expect(setup.status).toBe(200);
});
it("admin reset is tenant scoped, forbids self/non-admin, revokes every session and is audited", async () => {
  const enabled = await enable(),
    pending = await login(),
    admin = await session();
  expect((await request("/operators/user/reset-mfa", "POST", {}, enabled.cookie)).status).toBe(403);
  expect((await request("/operators/other/reset-mfa", "POST", {}, admin)).status).toBe(404);
  expect((await request("/operators/missing/reset-mfa", "POST", {}, admin)).status).toBe(404);
  expect((await request("/operators/admin/reset-mfa", "POST", {}, admin)).status).toBe(409);
  const reset = await request("/operators/user/reset-mfa", "POST", {}, admin);
  expect(reset.status).toBe(200);
  expect(OperatorSummary.parse(await reset.json()).mfaEnabled).toBe(false);
  expect((await request("/auth/me", "GET", undefined, enabled.cookie)).status).toBe(401);
  expect((await request("/auth/me", "GET", undefined, pending.cookie)).status).toBe(401);
  expect(await db.select().from(events).where(eq(events.type, "operator.mfa_reset"))).toMatchObject(
    [{ actorId: "admin", subjectOperatorId: "user", organizationId: "a", metadata: {} }],
  );
  await db.insert(settings).values({ organizationId: "a", mfaRequired: true });
  expect(Operator.parse((await login()).data).mustSetupMfa).toBe(true);
});
it("disabled accounts and password resets invalidate pending challenges", async () => {
  await enable();
  const pending = await login(),
    admin = await session();
  expect((await request("/operators/user/reset-password", "POST", {}, admin)).status).toBe(200);
  expect(
    (await request("/auth/mfa/verify", "POST", { code: "000000" }, pending.cookie)).status,
  ).toBe(401);
  await db.update(operators).set({ active: false }).where(eq(operators.id, "user"));
  const inactive = await request("/auth/login", "POST", { email: "user@example.test", password });
  const unknown = await request("/auth/login", "POST", { email: "absent@example.test", password });
  expect(inactive.status).toBe(401);
  expect(unknown.status).toBe(401);
  expect((await inactive.json()).error.message).toBe((await unknown.json()).error.message);
});
it("CLI export also enforces MFA and never exports MFA credentials", async () => {
  const enabled = await enable("admin");
  const input = { organizationId: "a", login: { email: "admin@example.test", password } };
  await expect(exportOrganization(db, input, now, key)).rejects.toThrow();
  const exported = await exportOrganization(
    db,
    { ...input, login: { ...input.login, code: enabled.codes[0] } },
    now,
    key,
  );
  const output = JSON.stringify(exported);
  for (const value of [enabled.secret, ...enabled.codes]) expect(output).not.toContain(value);
  await expect(
    exportOrganization(
      db,
      { ...input, login: { ...input.login, code: enabled.codes[0] } },
      now,
      key,
    ),
  ).rejects.toThrow();
  expect(
    await db
      .select()
      .from(events)
      .where(and(eq(events.type, "auth.mfa_recovery_used"), eq(events.actorId, "admin"))),
  ).toHaveLength(1);
});

it("unrelated settings PATCH and empty PATCH preserve mandatory MFA", async () => {
  const admin = await enable("admin");
  expect((await request("/settings", "PATCH", { mfaRequired: true }, admin.cookie)).status).toBe(
    200,
  );
  const links = await request("/settings", "PATCH", { linkDays: 45 }, admin.cookie);
  expect(links.status).toBe(200);
  expect(await links.json()).toMatchObject({ mfaRequired: true, linkDays: 45 });
  const unchanged = await request("/settings", "PATCH", {}, admin.cookie);
  expect(unchanged.status).toBe(200);
  expect(await unchanged.json()).toMatchObject({ mfaRequired: true, linkDays: 45 });
});

it("failed required audit rolls back enrollment and does not log or return credentials", async () => {
  const auth = await login();
  const started = await request(
    "/auth/mfa/setup/start",
    "POST",
    { currentPassword: password },
    auth.cookie,
  );
  const setup = MfaSetupResponse.parse(await started.json());
  await db.execute(
    sql`alter table events add constraint mfa_test_reject check (type <> 'auth.mfa_enabled')`,
  );
  try {
    const failed = await request(
      "/auth/mfa/setup/confirm",
      "POST",
      { code: stepCode(setup.secret) },
      auth.cookie,
    );
    expect(failed.status).toBe(500);
    const output = JSON.stringify({ logs, response: await failed.json() });
    for (const value of [setup.secret, setup.otpauthUri, stepCode(setup.secret), password])
      expect(output).not.toContain(value);
    const [stored] = await db.select().from(operators).where(eq(operators.id, "user"));
    expect(stored).toMatchObject({ mfaSecret: null, mfaEnabledAt: null, mfaRecoveryHashes: [] });
    expect((await request("/auth/me", "GET", undefined, auth.cookie)).status).toBe(200);
  } finally {
    await db.execute(sql`alter table events drop constraint mfa_test_reject`);
  }
});
