import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  cases,
  createDatabase,
  documents,
  events,
  offices,
  operators,
  organizations,
  sessions,
  settings,
  storageDeletions,
  type Database,
} from "@avanti/db";
import { ApiError, CaseDossier, CitizenCase, RegenerateLinkResponse } from "@avanti/contracts";
import { createApp } from "./app";
import { GatewayIntelligence } from "./ai";
import { eraseCase } from "./case-erasure";
import { hashToken, newToken } from "./security";
import { MemoryStorage } from "./storage";

const origin = "https://avanti.example.test";
const at = new Date("2027-01-05T10:00:00Z");
let now = at;
let db: Database;
let close: () => Promise<void>;
let app: ReturnType<typeof createApp>;
const storage = new MemoryStorage();
const ai = new GatewayIntelligence();
const cookies = { a: `avanti_session=${newToken()}`, b: `avanti_session=${newToken()}` };
const logs: unknown[] = [];
let sequence = 0;

beforeAll(async () => {
  ({ db, close } = await createDatabase({ memory: true }));
  for (const tenant of ["a", "b"] as const) {
    await db.insert(organizations).values({ id: tenant, name: `CAF ${tenant}`, kind: "caf" });
    await db.insert(offices).values({
      id: tenant,
      organizationId: tenant,
      slug: tenant,
      name: "Sede",
      address: "Esempio",
      city: "Roma",
    });
    await db.insert(operators).values({
      id: tenant,
      organizationId: tenant,
      name: "Operatore Esempio",
      email: `${tenant}@example.test`,
      passwordHash: "unused",
      role: "operator",
    });
    await db.insert(sessions).values({
      id: tenant,
      operatorId: tenant,
      tokenHash: hashToken(cookies[tenant].split("=")[1]!),
      createdAt: at.toISOString(),
      expiresAt: "2027-01-05T10:30:00Z",
    });
  }
  await db.insert(settings).values({ organizationId: "a", linkDays: 7 });
  app = createApp({
    db,
    storage,
    ai,
    clock: () => now,
    publicUrl: `${origin}/`,
    logger: (record) => logs.push(record),
    errorLogger: (record) => logs.push(record),
  });
});
afterAll(async () => close?.());

async function fixture(tenant: "a" | "b" = "a") {
  const token = newToken();
  const id = `case-${++sequence}`;
  const [row] = await db
    .insert(cases)
    .values({
      id,
      organizationId: tenant,
      officeId: tenant,
      reference: `AV-2027-${String(sequence).padStart(6, "0")}`,
      tokenHash: hashToken(token),
      language: "en",
      practiceId: "isee_ordinario",
      createdAt: at.toISOString(),
      updatedAt: at.toISOString(),
      expiresAt: "2027-01-06T00:00:00Z",
    })
    .returning();
  return { row: row!, token };
}
function regenerate(id: string, cookie = cookies.a, target = app) {
  return target.request(`/api/cases/${id}/link`, {
    method: "POST",
    headers: { Cookie: cookie, Origin: origin },
  });
}
function operatorGet(path: string) {
  return app.request(path, { headers: { Cookie: cookies.a } });
}
function tokenFrom(url: string) {
  return new URL(url).pathname.split("/").at(-1)!;
}
async function failure(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  const result = ApiError.parse(await response.json());
  expect(result.error.code).toBe(code);
  return result.error.message;
}
function upload(token: string) {
  const bytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRuoAAAAASUVORK5CYII=",
    "base64",
  );
  const body = new FormData();
  body.set("file", new File([bytes], "ESEMPIO.png", { type: "image/png" }));
  return app.request(`/api/c/${token}/documents`, {
    method: "POST",
    headers: { Origin: origin },
    body,
  });
}
function gate() {
  let release!: () => void;
  let entered!: () => void;
  const paused = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  return { paused, started, release, entered };
}

it("rotates the hash, renews expiry from the clock, audits without secrets and returns the URL once", async () => {
  const { row, token } = await fixture();
  const response = await regenerate(row.id);
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  const result = RegenerateLinkResponse.parse(await response.json());
  const replacement = tokenFrom(result.url);
  expect(result.url).toBe(`${origin}/pratica/${replacement}`);
  expect(replacement).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(replacement).not.toBe(token);
  expect(result.expiresAt).toBe("2027-01-12T10:00:00.000Z");
  const [updated] = await db.select().from(cases).where(eq(cases.id, row.id));
  expect(updated).toMatchObject({
    tokenHash: hashToken(replacement),
    status: row.status,
    answers: row.answers,
  });
  for (const suffix of [
    "",
    "/documents/no-document/file",
    "/turn",
    "/language",
    "/documents",
    "/documents/no-document",
    "/submit",
  ]) {
    const method =
      suffix === "/language"
        ? "PUT"
        : suffix === "/documents/no-document"
          ? "DELETE"
          : ["", "/documents/no-document/file"].includes(suffix)
            ? "GET"
            : "POST";
    await failure(
      await app.request(`/api/c/${token}${suffix}`, { method, headers: { Origin: origin } }),
      404,
      "not_found",
    );
  }
  expect((await app.request(`/api/c/${replacement}`)).status).toBe(200);
  const [event] = await db
    .select()
    .from(events)
    .where(and(eq(events.caseId, row.id), eq(events.type, "case.link_regenerated")));
  expect(event).toMatchObject({
    actor: "operator",
    actorId: "a",
    organizationId: "a",
    metadata: {},
  });
  const dossier = CaseDossier.parse(await (await operatorGet(`/api/cases/${row.id}`)).json());
  expect(dossier.citizenLink).toBeNull();
  expect(
    dossier.timeline.some((entry) => entry.label === "Link cittadino rigenerato dall'operatore"),
  ).toBe(true);
  const stored = JSON.stringify([updated, event, dossier, logs]);
  expect(stored).not.toContain(replacement);
  expect(stored).not.toContain(token);
});

it("renews expired links, uses the organization default and rejects at the new expiry boundary", async () => {
  const { row, token } = await fixture("b");
  await db.update(cases).set({ expiresAt: at.toISOString() }).where(eq(cases.id, row.id));
  await failure(await app.request(`/api/c/${token}`), 410, "link_expired");
  const response = await regenerate(row.id, cookies.b);
  expect(response.status).toBe(200);
  const result = RegenerateLinkResponse.parse(await response.json());
  expect(result.expiresAt).toBe("2027-03-06T10:00:00.000Z");
  now = new Date(result.expiresAt);
  try {
    await failure(await app.request(`/api/c/${tokenFrom(result.url)}`), 410, "link_expired");
  } finally {
    now = at;
  }
});

it("requires operator authentication and Origin; tenant boundaries also cover deleted cases", async () => {
  const { row } = await fixture("b");
  await failure(await regenerate(row.id, ""), 401, "unauthorized");
  await failure(
    await app.request(`/api/cases/${row.id}/link`, {
      method: "POST",
      headers: { Cookie: cookies.b, Origin: "https://foreign.example.test" },
    }),
    403,
    "forbidden",
  );
  await failure(await regenerate(row.id), 404, "not_found");
  await db.transaction((tx) => eraseCase(tx, row, now, "b"));
  await failure(await regenerate(row.id), 404, "not_found");
  expect(await failure(await regenerate(row.id, cookies.b), 409, "conflict")).toContain(
    "cancellata",
  );
  await failure(await regenerate("unknown"), 404, "not_found");
  expect(
    await db
      .select()
      .from(events)
      .where(and(eq(events.deletedCaseId, row.id), eq(events.type, "case.link_regenerated"))),
  ).toHaveLength(0);
});

it("rejects closed cases without changing hash/expiry or recording a regeneration", async () => {
  const { row } = await fixture();
  await db
    .update(cases)
    .set({ status: "closed", closedAt: at.toISOString() })
    .where(eq(cases.id, row.id));
  expect(await failure(await regenerate(row.id), 409, "conflict")).toContain("chiusa");
  const [unchanged] = await db.select().from(cases).where(eq(cases.id, row.id));
  expect(unchanged?.tokenHash).toBe(row.tokenHash);
  expect(unchanged?.expiresAt).toBe(row.expiresAt);
  expect(
    await db
      .select()
      .from(events)
      .where(and(eq(events.caseId, row.id), eq(events.type, "case.link_regenerated"))),
  ).toHaveLength(0);
});

it("serializes concurrent regenerations so only the final capability remains valid", async () => {
  const { row } = await fixture();
  const responses = await Promise.all([regenerate(row.id), regenerate(row.id)]);
  const links = await Promise.all(
    responses.map(async (response) => {
      expect(response.status).toBe(200);
      return RegenerateLinkResponse.parse(await response.json());
    }),
  );
  const statuses = await Promise.all(
    links.map(async (link) => (await app.request(`/api/c/${tokenFrom(link.url)}`)).status),
  );
  expect(statuses.sort()).toEqual([200, 404]);
});

it.each([false, true])(
  "revokes an in-flight upload and rolls back storage (cleanup failure: %s)",
  async (cleanupFails) => {
    const { row, token } = await fixture();
    const wait = gate();
    const put = storage.put.bind(storage);
    let writtenKey = "";
    const pausedPut = vi.spyOn(storage, "put").mockImplementationOnce(async (key, bytes) => {
      writtenKey = key;
      await put(key, bytes);
      wait.entered();
      await wait.paused;
      return key;
    });
    const remove = cleanupFails
      ? vi.spyOn(storage, "delete").mockRejectedValueOnce(new Error("synthetic cleanup failure"))
      : null;
    const pending = upload(token);
    try {
      await wait.started;
      expect((await regenerate(row.id)).status).toBe(200);
      wait.release();
      const message = await failure(await pending, 410, "link_expired");
      expect(message).toContain("nuovo link");
      expect(await db.select().from(documents).where(eq(documents.caseId, row.id))).toHaveLength(0);
      const cleanup = await db
        .select()
        .from(storageDeletions)
        .where(eq(storageDeletions.caseId, row.id));
      expect(cleanup).toHaveLength(cleanupFails ? 1 : 0);
      if (!cleanupFails) await expect(storage.get(writtenKey)).rejects.toThrow();
    } finally {
      wait.release();
      await pending;
      pausedPut.mockRestore();
      remove?.mockRestore();
    }
  },
);

it("revokes a turn waiting for AI before it writes answers or messages", async () => {
  const { row, token } = await fixture();
  const wait = gate();
  const intake = ai.intake.bind(ai);
  const paused = vi.spyOn(ai, "intake").mockImplementationOnce(async (...args) => {
    wait.entered();
    await wait.paused;
    return intake(...args);
  });
  const pending = app.request(`/api/c/${token}/turn`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "text", text: "ISEE" }),
  });
  try {
    await wait.started;
    expect((await regenerate(row.id)).status).toBe(200);
    wait.release();
    await failure(await pending, 410, "link_expired");
    const [current] = await db.select().from(cases).where(eq(cases.id, row.id));
    expect(current?.answers).toEqual({});
    expect(
      await db
        .select()
        .from(events)
        .where(and(eq(events.caseId, row.id), eq(events.actor, "citizen"))),
    ).toHaveLength(0);
  } finally {
    wait.release();
    await pending;
    paused.mockRestore();
  }
});

it("revokes a download waiting on storage before releasing bytes or auditing access", async () => {
  const { row, token } = await fixture();
  const bytes = new Uint8Array([1, 2, 3]);
  await storage.put(row.id, bytes);
  await db.insert(documents).values({
    id: row.id,
    caseId: row.id,
    fileName: "ESEMPIO.pdf",
    mimeType: "application/pdf",
    sizeBytes: 3,
    status: "analyzed",
    storageKey: row.id,
    sha256: "synthetic",
    uploadedAt: at.toISOString(),
  });
  const wait = gate();
  const get = storage.get.bind(storage);
  const paused = vi.spyOn(storage, "get").mockImplementationOnce(async (key) => {
    wait.entered();
    await wait.paused;
    return get(key);
  });
  const pending = app.request(`/api/c/${token}/documents/${row.id}/file`);
  try {
    await wait.started;
    expect((await regenerate(row.id)).status).toBe(200);
    wait.release();
    await failure(await pending, 410, "link_expired");
    expect(
      await db
        .select()
        .from(events)
        .where(and(eq(events.caseId, row.id), eq(events.type, "document.downloaded"))),
    ).toHaveLength(0);
  } finally {
    wait.release();
    await pending;
    paused.mockRestore();
  }
});

it("exposes localized citizen findings and direct Italian operator copy in dossier and JSON export", async () => {
  const { row, token } = await fixture();
  await db.insert(documents).values({
    id: row.id,
    caseId: row.id,
    fileName: "ESEMPIO.png",
    mimeType: "image/png",
    sizeBytes: 100,
    storageKey: row.id,
    sha256: "synthetic",
    uploadedAt: at.toISOString(),
    status: "analyzed",
    analysis: {
      engine: "ai",
      confidence: 1,
      detectedRequirementId: null,
      detectedLabel: null,
      ownerName: null,
      referenceYear: null,
      expiresOn: "2026-01-01",
      legible: false,
      pagesComplete: false,
      findings: [],
    },
  });
  const citizen = CitizenCase.parse(await (await app.request(`/api/c/${token}`)).json());
  const illegible = citizen.findings.find((finding) => finding.code === "document.illegible");
  expect(illegible?.message).toBe("ESEMPIO.png is not readable. Upload a clearer photo or PDF.");
  expect(citizen.findings.every((finding) => finding.operatorMessage === undefined)).toBe(true);
  const dossier = CaseDossier.parse(await (await operatorGet(`/api/cases/${row.id}`)).json());
  expect(dossier.findings.every((finding) => finding.message === finding.operatorMessage)).toBe(
    true,
  );
  expect(
    dossier.findings.find((finding) => finding.code === "document.unchecked")?.message,
  ).toContain("controlla a vista");
  const exported = CaseDossier.parse(
    await (await operatorGet(`/api/cases/${row.id}/export?format=json`)).json(),
  );
  expect(exported.findings).toEqual(dossier.findings);
});

it("limits each operator to 20/minute across cases, persists across instances and resets with Retry-After", async () => {
  const { row } = await fixture();
  const options = {
    db,
    storage,
    clock: () => now,
    rateLimitSecret: "synthetic-link-rate",
    publicUrl: origin,
  };
  const limited = createApp(options);
  for (let i = 0; i < 20; i++)
    expect((await regenerate(row.id, cookies.a, limited)).status).toBe(200);
  const otherCase = await fixture();
  const restarted = createApp(options);
  const blocked = await regenerate(otherCase.row.id, cookies.a, restarted);
  expect(blocked.headers.get("Retry-After")).toBe("60");
  await failure(blocked, 429, "rate_limited");
  const otherTenant = await fixture("b");
  expect((await regenerate(otherTenant.row.id, cookies.b, restarted)).status).toBe(200);
  now = new Date(at.getTime() + 60000);
  try {
    expect((await regenerate(row.id, cookies.a, restarted)).status).toBe(200);
  } finally {
    now = at;
  }
});
