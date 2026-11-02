import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  cases,
  createDatabase,
  documents,
  events,
  messages,
  offices,
  operators,
  organizations,
  sessions,
  settings,
  type Database,
} from "@avanti/db";
import {
  ApiError,
  CaseDossier,
  CaseListResponse,
  CitizenCase,
  CreateCaseResponse,
  RegenerateLinkResponse,
} from "@avanti/contracts";
import { createApp } from "./app";
import { GatewayIntelligence } from "./ai";
import { citizenCopyNames, citizenPrivacy } from "./citizen-privacy";
import { citizenOnlyDraft } from "./privacy-view";
import { hashBytes, hashToken, newToken } from "./security";
import { MemoryStorage } from "./storage";
import { readZip } from "./test-zip";

const origin = "https://avanti.example.test";
const start = new Date("2027-01-12T09:00:00Z");
let clockAt = start;
let db: Database;
let close: () => Promise<void>;
let app: ReturnType<typeof createApp>;
let storage: MemoryStorage;
const admin = `avanti_session=${newToken()}`;
const desk = `avanti_session=${newToken()}`;
let sequence = 0;

beforeAll(async () => {
  ({ db, close } = await createDatabase({ memory: true }));
  await db.insert(organizations).values({ id: "a", name: "CAF Esempio", kind: "caf" });
  await db.insert(settings).values({ organizationId: "a", retentionDays: 90 });
  await db.insert(offices).values({
    id: "a",
    organizationId: "a",
    slug: "a",
    name: "Sede Centro",
    address: "Via Esempio 1",
    city: "Milano",
  });
  for (const [id, role, cookie] of [
    ["admin", "admin", admin],
    ["desk", "operator", desk],
  ] as const) {
    await db.insert(operators).values({
      id,
      organizationId: "a",
      name: "Operatore Esempio",
      email: `${id}@example.test`,
      passwordHash: "unused",
      role,
    });
    await db.insert(sessions).values({
      id,
      operatorId: id,
      tokenHash: hashToken(cookie.split("=")[1]!),
      createdAt: start.toISOString(),
      expiresAt: "2027-12-31T00:00:00Z",
    });
  }
  storage = new MemoryStorage();
  app = createApp({
    db,
    storage,
    ai: new GatewayIntelligence(),
    clock: () => clockAt,
    publicUrl: `${origin}/`,
    logger: () => {},
    errorLogger: () => {},
    storageLogger: () => {},
  });
});
afterAll(async () => close?.());
// Each test in its own rate-limit window: the citizen's data quota is a few a minute.
beforeEach(() => {
  clockAt = new Date(clockAt.getTime() + 120_000);
});

async function fixture(
  submitted: boolean,
  consent = false,
  overrides: Partial<typeof cases.$inferInsert> = {},
) {
  const id = `case-${++sequence}`;
  const token = newToken();
  await db.insert(cases).values({
    id,
    organizationId: "a",
    officeId: "a",
    // Far from the references the desk numbers from 1, so POST /cases never collides.
    reference: `AV-2027-${900000 + sequence}`,
    tokenHash: hashToken(token),
    language: "ro",
    status: submitted ? "submitted" : "intake",
    practiceId: "isee_ordinario",
    answers: {
      members: [{ id: "m-1", role: "richiedente", firstName: "Ioana" }],
      household_count: 1,
      practice_year: 2027,
    },
    contact: { firstName: "Ioana", lastName: "Esempio", phone: "3330000000" },
    internalNotes: submitted ? "Nota riservata dello sportello" : null,
    createdAt: start.toISOString(),
    updatedAt: start.toISOString(),
    submittedAt: submitted ? start.toISOString() : null,
    renewalContactConsentAt: consent ? start.toISOString() : null,
    renewalContactConsentVersion: consent ? "ro-1" : null,
    expiresAt: "2027-03-01T00:00:00Z",
    ...overrides,
  });
  const bytes = new TextEncoder().encode(`%PDF-1.4 esempio ${id}`);
  const key = `${id}/doc`;
  await storage.put(key, bytes);
  await db.insert(documents).values({
    id: `${id}-doc`,
    caseId: id,
    fileName: "carta identità.pdf",
    mimeType: "application/pdf",
    sizeBytes: bytes.length,
    storageKey: key,
    sha256: hashBytes(bytes),
    uploadedAt: start.toISOString(),
    status: "analyzed",
  });
  await db.insert(events).values({
    id: `${id}-created`,
    caseId: id,
    caseReference: `AV-2027-${900000 + sequence}`,
    organizationId: "a",
    officeId: "a",
    actor: "citizen",
    type: "case.created",
    at: start.toISOString(),
    metadata: {},
  });
  return { id, token, key, bytes };
}

const citizen = (token: string, path = "", init: RequestInit = {}) =>
  app.request(`/api/c/${token}${path}`, {
    ...init,
    headers: { Origin: origin, "Content-Type": "application/json", ...init.headers },
  });
const operator = (cookie: string, path: string, init: RequestInit = {}) =>
  app.request(`/api/${path}`, {
    ...init,
    headers: {
      Cookie: cookie,
      Origin: origin,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
const erase = (token: string, body: unknown = { confirmed: true }) =>
  citizen(token, "", { method: "DELETE", body: JSON.stringify(body) });

describe("citizenPrivacy", () => {
  it("deletes by expiry plus retention, with the CAF's default when it set none", () => {
    const row = { expiresAt: "2027-03-01T00:00:00Z", erasureRequestedAt: null };
    expect(citizenPrivacy(row, 30, true)).toEqual({
      retentionDays: 30,
      deleteBy: "2027-03-31T00:00:00.000Z",
      canDelete: true,
      erasureRequestedAt: null,
    });
    expect(citizenPrivacy(row, null, false)).toMatchObject({
      retentionDays: 180,
      canDelete: false,
    });
  });

  it("treats as the citizen's own draft only an unsent intake case no operator touched", () => {
    const draft = {
      submittedAt: null,
      status: "intake" as const,
      familyId: null,
      renewalSourceId: null,
      internalNotes: null,
      assigneeId: null,
    };
    expect(citizenOnlyDraft(draft)).toBe(true);
    expect(citizenOnlyDraft({ ...draft, internalNotes: "  " })).toBe(true);
    for (const change of [
      { submittedAt: "2027-01-01T00:00:00Z" },
      // Reopened by the desk before any submission.
      { status: "in_review" as const },
      { status: "needs_citizen" as const },
      { familyId: "family" },
      { renewalSourceId: "last-year" },
      { internalNotes: "Richiamare" },
      { assigneeId: "desk" },
    ])
      expect(citizenOnlyDraft({ ...draft, ...change }), JSON.stringify(change)).toBe(false);
  });

  it("numbers the files so equal names stay apart and path tricks stay inside the folder", () => {
    expect(
      citizenCopyNames([
        { fileName: "scan.jpg", mimeType: "image/jpeg" },
        { fileName: "scan.jpg", mimeType: "image/jpeg" },
        { fileName: "../../etc/passwd", mimeType: "application/pdf" },
      ]),
    ).toEqual(["documenti/01-scan.jpg", "documenti/02-scan.jpg", "documenti/03-.._..pdf"]);
  });
});

describe("citizen's own data", () => {
  it("tells the citizen the CAF's retention and what they can do alone", async () => {
    const { token } = await fixture(false);
    const view = CitizenCase.parse(await (await citizen(token)).json());
    expect(view.privacy).toEqual({
      retentionDays: 90,
      deleteBy: "2027-05-30T00:00:00.000Z",
      canDelete: true,
      erasureRequestedAt: null,
    });
  });

  it("downloads a copy with the files as sent and without the desk's notes", async () => {
    const { id, token, bytes } = await fixture(true);
    const head = await citizen(token, "/export", { method: "HEAD" });
    expect(head.status).toBe(200);
    const response = await citizen(token, "/export");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("avanti-AV-2027-");
    const zip = readZip(new Uint8Array(await response.arrayBuffer()));
    expect(zip.map((entry) => entry.name)).toEqual([
      "dati.json",
      "documenti/01-carta identità.pdf",
    ]);
    expect(zip[1]!.data).toEqual(bytes);
    const text = new TextDecoder().decode(zip[0]!.data);
    expect(text).not.toContain("Nota riservata");
    const copy = JSON.parse(text);
    expect(copy).toMatchObject({
      format: "avanti-citizen-copy",
      controller: { name: "CAF Esempio", office: "Sede Centro" },
      contact: { firstName: "Ioana" },
      documents: [{ file: "documenti/01-carta identità.pdf", originalName: "carta identità.pdf" }],
    });
    const audits = await db.select().from(events).where(eq(events.caseId, id));
    // HEAD reads nothing: only the real download is recorded, with counts only.
    expect(audits.filter((e) => e.type === "citizen.data_exported")).toEqual([
      expect.objectContaining({
        actor: "citizen",
        metadata: { documents: 1, bytes: bytes.length },
      }),
    ]);
  });

  it("stops a loop of copies with the citizen's own quota", async () => {
    const { token } = await fixture(false);
    const statuses: number[] = [];
    for (let n = 0; n < 6; n++) statuses.push((await citizen(token, "/export")).status);
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
  });

  it("erases an unsent case with files, ends the link and the desk's access, keeps a bare audit", async () => {
    const { id, token, key } = await fixture(false, true);
    expect((await erase(token, {})).status).toBe(400);
    expect((await erase(token, { confirmed: true, extra: 1 })).status).toBe(400);
    const response = await erase(token);
    expect(response.status).toBe(204);
    expect(await db.select().from(cases).where(eq(cases.id, id))).toEqual([]);
    expect(await db.select().from(documents).where(eq(documents.caseId, id))).toEqual([]);
    await expect(storage.get(key)).rejects.toThrow();
    expect((await citizen(token)).status).toBe(404);
    expect((await citizen(token, "/export")).status).toBe(404);
    expect((await erase(token)).status).toBe(404);
    expect((await operator(admin, `cases/${id}`)).status).toBe(404);
    expect((await operator(admin, `cases/${id}/documents/archive`)).status).toBe(404);
    const trail = await db.select().from(events).where(eq(events.deletedCaseId, id));
    expect(trail.map((e) => e.type).sort()).toEqual(["case.citizen_deleted", "case.created"]);
    const deleted = trail.find((e) => e.type === "case.citizen_deleted")!;
    expect(deleted).toMatchObject({ actor: "citizen", actorId: null, caseId: null, metadata: {} });
  });

  it("refuses to erase a case already sent, and changes nothing", async () => {
    const { id, token } = await fixture(true);
    const response = await erase(token);
    expect(response.status).toBe(409);
    expect(ApiError.parse(await response.json()).error.message).toContain("chiedi al CAF");
    expect(await db.select().from(cases).where(eq(cases.id, id))).toHaveLength(1);
  });

  it("records a request once a case is sent, withdraws the renewal consent and shows it to the desk", async () => {
    const { id, token } = await fixture(true, true);
    const before = (await db.select().from(cases).where(eq(cases.id, id)))[0]!;
    const response = await citizen(token, "/erasure-request", { method: "POST" });
    expect(response.status).toBe(200);
    const view = CitizenCase.parse(await response.json());
    expect(view.privacy?.erasureRequestedAt).toBe(clockAt.toISOString());
    expect(view.renewalContactConsent).toBe(false);
    const requestedAt = clockAt.toISOString();
    clockAt = new Date(clockAt.getTime() + 1000);
    const again = CitizenCase.parse(
      await (await citizen(token, "/erasure-request", { method: "POST" })).json(),
    );
    expect(again.privacy?.erasureRequestedAt).toBe(requestedAt);
    const after = (await db.select().from(cases).where(eq(cases.id, id)))[0]!;
    // Not content: the concurrency version of an operator's open form stays valid.
    expect(after.updatedAt).toBe(before.updatedAt);
    const types = (await db.select().from(events).where(eq(events.caseId, id))).map((e) => e.type);
    expect(types.filter((t) => t === "citizen.erasure_requested")).toHaveLength(1);
    expect(types).toContain("renewal.consent_updated");

    const dossier = CaseDossier.parse(await (await operator(desk, `cases/${id}`)).json());
    expect(dossier.erasureRequestedAt).toBe(requestedAt);
    const list = CaseListResponse.parse(await (await operator(desk, "cases")).json());
    expect(list.items.find((item) => item.id === id)?.erasureRequestedAt).toBe(requestedAt);
  });

  it("sends an unsent case's citizen to the delete button instead of a request", async () => {
    const { token } = await fixture(false);
    const response = await citizen(token, "/erasure-request", { method: "POST" });
    expect(response.status).toBe(409);
  });

  it("lets only an admin close a request without erasing, recorded without content", async () => {
    const { id, token } = await fixture(true);
    await citizen(token, "/erasure-request", { method: "POST" });
    const path = `cases/${id}/erasure-request`;
    expect((await operator(desk, path, { method: "DELETE" })).status).toBe(403);
    expect((await operator(admin, path, { method: "DELETE" })).status).toBe(204);
    const view = CitizenCase.parse(await (await citizen(token)).json());
    expect(view.privacy?.erasureRequestedAt).toBeNull();
    const declined = (await db.select().from(events).where(eq(events.caseId, id))).filter(
      (e) => e.type === "case.erasure_declined",
    );
    expect(declined).toEqual([
      expect.objectContaining({ actor: "operator", actorId: "admin", metadata: {} }),
    ]);
    // Nothing left to close: idempotent, no second event.
    expect((await operator(admin, path, { method: "DELETE" })).status).toBe(204);
    expect(
      (await db.select().from(events).where(eq(events.caseId, id))).filter(
        (e) => e.type === "case.erasure_declined",
      ),
    ).toHaveLength(1);
  });

  it("does nothing through an expired link", async () => {
    const { id, token } = await fixture(false);
    await db.update(cases).set({ expiresAt: "2027-01-01T00:00:00Z" }).where(eq(cases.id, id));
    expect((await erase(token)).status).toBe(410);
    expect((await citizen(token, "/export")).status).toBe(410);
    expect(await db.select().from(cases).where(eq(cases.id, id))).toHaveLength(1);
  });
  it("puts the citizen's note and the assistant conversation in the copy, not hidden documents", async () => {
    const { id, token } = await fixture(true, false, { citizenNote: "Nota per lo sportello" });
    await db.insert(messages).values([
      {
        id: `${id}-ask`,
        caseId: id,
        role: "citizen",
        kind: "citizen_assistant",
        text: "Serve il contratto d'affitto?",
        createdAt: start.toISOString(),
      },
      {
        id: `${id}-answer`,
        caseId: id,
        role: "assistant",
        kind: "citizen_assistant",
        text: "Sì, se vivi in affitto.",
        createdAt: new Date(start.getTime() + 1000).toISOString(),
      },
    ]);
    // A relative's document reused by the desk and not shown to this citizen (art. 15(4)).
    const hidden = new TextEncoder().encode("%PDF-1.4 altro membro");
    await storage.put(`${id}/hidden`, hidden);
    await db.insert(documents).values({
      id: `${id}-hidden`,
      caseId: id,
      fileName: "busta paga del fratello.pdf",
      mimeType: "application/pdf",
      sizeBytes: hidden.length,
      storageKey: `${id}/hidden`,
      sha256: hashBytes(hidden),
      uploadedAt: start.toISOString(),
      status: "analyzed",
      citizenVisible: false,
    });
    const zip = readZip(new Uint8Array(await (await citizen(token, "/export")).arrayBuffer()));
    expect(zip.map((entry) => entry.name)).toEqual([
      "dati.json",
      "documenti/01-carta identità.pdf",
    ]);
    const text = new TextDecoder().decode(zip[0]!.data);
    expect(text).not.toContain("fratello");
    const copy = JSON.parse(text);
    expect(copy.citizenNote).toBe("Nota per lo sportello");
    expect(copy.assistant).toEqual([
      { role: "citizen", text: "Serve il contratto d'affitto?", createdAt: start.toISOString() },
      {
        role: "assistant",
        text: "Sì, se vivi in affitto.",
        createdAt: new Date(start.getTime() + 1000).toISOString(),
      },
    ]);
    // The assistant's turns are not duplicated among the messages with the desk.
    expect(copy.messages.map((m: { text: string }) => m.text)).not.toContain(
      "Sì, se vivi in affitto.",
    );
  });

  it("logs a missing file in the copy by reference only", async () => {
    const logged: unknown[] = [];
    const logging = createApp({
      db,
      storage,
      ai: new GatewayIntelligence(),
      clock: () => clockAt,
      publicUrl: `${origin}/`,
      logger: () => {},
      errorLogger: () => {},
      storageLogger: (entry) => logged.push(entry),
    });
    const { id, token, key } = await fixture(true);
    await storage.delete(key);
    const response = await logging.request(`/api/c/${token}/export`, {
      headers: { Origin: origin },
    });
    await response.arrayBuffer().catch(() => undefined);
    expect(logged).toEqual([
      { op: "citizen_export", caseId: id, documentId: `${id}-doc`, errorName: expect.any(String) },
    ]);
  });

  it("refuses to erase a draft the desk created, and takes the request instead", async () => {
    const response = await operator(desk, "cases", {
      method: "POST",
      body: JSON.stringify({ officeId: "a", practiceId: "isee_ordinario", language: "it" }),
    });
    const body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(201);
    const created = CreateCaseResponse.parse(body);
    const token = created.citizenLink.split("/pratica/")[1]!;
    const view = CitizenCase.parse(await (await citizen(token)).json());
    expect(view.submittedAt).toBeNull();
    expect(view.privacy?.canDelete).toBe(false);
    expect((await erase(token)).status).toBe(409);
    expect(await db.select().from(cases).where(eq(cases.id, created.case.id))).toHaveLength(1);
    expect((await citizen(token, "/erasure-request", { method: "POST" })).status).toBe(200);
  });

  it("refuses to erase a citizen's draft once an operator wrote on it", async () => {
    const { id, token } = await fixture(false);
    await db.insert(events).values({
      id: `${id}-copilot`,
      caseId: id,
      organizationId: "a",
      actor: "operator",
      actorId: "desk",
      type: "copilot.asked",
      at: start.toISOString(),
      metadata: {},
    });
    expect(CitizenCase.parse(await (await citizen(token)).json()).privacy?.canDelete).toBe(false);
    expect((await erase(token)).status).toBe(409);
    expect(await db.select().from(cases).where(eq(cases.id, id))).toHaveLength(1);
  });

  it("refuses to erase a case reopened in review or back with the citizen", async () => {
    const reopened = await fixture(false, false, { status: "in_review" });
    expect((await erase(reopened.token)).status).toBe(409);
    const asked = await fixture(true, false, { status: "needs_citizen" });
    expect((await erase(asked.token)).status).toBe(409);
    for (const { id } of [reopened, asked])
      expect(await db.select().from(cases).where(eq(cases.id, id))).toHaveLength(1);
  });

  it("refuses to erase a reused case and leaves last year's shared file alone", async () => {
    const source = await fixture(true, false, { familyId: "family-1" });
    const reused = await fixture(false, false, { familyId: "family-1" });
    await db.insert(documents).values({
      id: `${reused.id}-shared`,
      caseId: reused.id,
      fileName: "isee 2026.pdf",
      mimeType: "application/pdf",
      sizeBytes: source.bytes.length,
      storageKey: source.key,
      sha256: hashBytes(source.bytes),
      uploadedAt: start.toISOString(),
      status: "analyzed",
      reusedFromYear: 2026,
    });
    expect((await erase(reused.token)).status).toBe(409);
    expect(await storage.get(source.key)).toEqual(source.bytes);
    expect(await db.select().from(cases).where(eq(cases.id, source.id))).toHaveLength(1);
    expect(await db.select().from(cases).where(eq(cases.id, reused.id))).toHaveLength(1);
  });

  it("never confirms an erasure through a link the desk rotated", async () => {
    const { id, token } = await fixture(false);
    const rotated = RegenerateLinkResponse.parse(
      await (await operator(desk, `cases/${id}/link`, { method: "POST" })).json(),
    );
    expect((await erase(token)).status).toBe(404);
    expect((await citizen(token, "/export")).status).toBe(404);
    expect(await db.select().from(cases).where(eq(cases.id, id))).toHaveLength(1);
    // The new link belongs to a case the desk has now worked: the CAF decides.
    const fresh = rotated.url.split("/pratica/")[1]!;
    expect((await erase(fresh)).status).toBe(409);
  });
  it("lists every open request oldest first, in any status, and counts them whatever the filter", async () => {
    const closed = await fixture(true, false, {
      status: "closed",
      erasureRequestedAt: "2026-12-02T10:00:00Z",
    });
    const reviewing = await fixture(true, false, {
      status: "in_review",
      erasureRequestedAt: "2026-12-01T10:00:00Z",
    });
    const open = await db.select().from(cases);
    const total = open.filter((row) => row.erasureRequestedAt !== null).length;
    const first = CaseListResponse.parse(
      await (await operator(desk, "cases?erasure=requested&limit=1")).json(),
    );
    expect(first.items.map((item) => item.id)).toEqual([reviewing.id]);
    expect(first.erasureRequests).toBe(total);
    const second = CaseListResponse.parse(
      await (
        await operator(desk, `cases?erasure=requested&limit=1&cursor=${first.nextCursor}`)
      ).json(),
    );
    expect(second.items.map((item) => item.id)).toEqual([closed.id]);
    // A queue filtered elsewhere still carries the organization-wide count.
    const filtered = CaseListResponse.parse(
      await (await operator(desk, "cases?status=intake")).json(),
    );
    expect(filtered.erasureRequests).toBe(total);
    // A cursor from another order is refused rather than misread.
    expect((await operator(desk, `cases?cursor=${first.nextCursor}`)).status).toBe(400);
  });
});
