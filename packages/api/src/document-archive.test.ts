import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  cases,
  checklistReviews,
  createDatabase,
  documents,
  events,
  offices,
  operators,
  organizations,
  sessions,
  type Database,
} from "@avanti/db";
import { ApiError, CaseDossier } from "@avanti/contracts";
import { createApp } from "./app";
import { GatewayIntelligence } from "./ai";
import { hashBytes, hashToken, newToken } from "./security";
import { MemoryStorage } from "./storage";
import { readZip } from "./test-zip";
import { PDFDocument, StandardFonts } from "pdf-lib";

const origin = "https://avanti.example.test";
const now = new Date("2027-01-12T09:00:00Z");
let db: Database;
let close: () => Promise<void>;
let app: ReturnType<typeof createApp>;
let storage: MemoryStorage;
const cookies = {
  a: `avanti_session=${newToken()}`,
  a2: `avanti_session=${newToken()}`,
  b: `avanti_session=${newToken()}`,
};
const logs: unknown[] = [];
let sequence = 0;

const applicant = { id: "m-applicant", role: "richiedente", firstName: "Amina" } as const;
const child = { id: "m-child", role: "figlio", firstName: "Yusuf" } as const;

beforeAll(async () => {
  ({ db, close } = await createDatabase({ memory: true }));
  for (const tenant of ["a", "b"] as const) {
    await db.insert(organizations).values({ id: tenant, name: `CAF ${tenant}`, kind: "caf" });
    await db.insert(offices).values({
      id: tenant,
      organizationId: tenant,
      slug: tenant,
      name: "Sede Centro",
      address: "Via Esempio 1",
      city: "Milano",
    });
  }
  for (const [id, organizationId] of [
    ["a", "a"],
    ["a2", "a"],
    ["b", "b"],
  ] as const) {
    await db.insert(operators).values({
      id,
      organizationId,
      name: "Operatore Esempio",
      email: `${id}@example.test`,
      passwordHash: "unused",
      role: "operator",
    });
    await db.insert(sessions).values({
      id,
      operatorId: id,
      tokenHash: hashToken(cookies[id].split("=")[1]!),
      createdAt: now.toISOString(),
      expiresAt: "2027-01-12T17:00:00Z",
    });
  }
  storage = new MemoryStorage();
  app = createApp({
    db,
    storage,
    ai: new GatewayIntelligence(),
    clock: () => clockAt,
    publicUrl: `${origin}/`,
    logger: (record) => logs.push(record),
    errorLogger: (record) => logs.push(record),
    storageLogger: (record) => logs.push(record),
  });
});
afterAll(async () => close?.());
// Each test in its own rate-limit window: the archive quota is a few a minute.
let clockAt = now;
beforeEach(() => {
  clockAt = new Date(clockAt.getTime() + 120_000);
});

async function fixture() {
  const id = `case-${++sequence}`;
  const token = newToken();
  await db.insert(cases).values({
    id,
    organizationId: "a",
    officeId: "a",
    reference: `AV-2027-${String(sequence).padStart(6, "0")}`,
    tokenHash: hashToken(token),
    language: "ar",
    status: "in_review",
    practiceId: "isee_ordinario",
    answers: { members: [applicant, child], household_count: 2, practice_year: 2027 },
    contact: { firstName: "Amina", lastName: "Esempio", phone: "3330000000" },
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    submittedAt: now.toISOString(),
    expiresAt: "2027-03-01T00:00:00Z",
  });
  const dossier = CaseDossier.parse(
    await (await app.request(`/api/cases/${id}`, { headers: { Cookie: cookies.a } })).json(),
  );
  return { id, token, checklist: dossier.checklist };
}

async function dossier(id: string) {
  return CaseDossier.parse(
    await (await app.request(`/api/cases/${id}`, { headers: { Cookie: cookies.a } })).json(),
  );
}

async function review(id: string, itemId: string, decision: "rejected" | "reset") {
  const response = await app.request(
    `/api/cases/${id}/checklist/${encodeURIComponent(itemId)}/review`,
    {
      method: "POST",
      headers: { Cookie: cookies.a, Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({
        decision,
        note: decision === "rejected" ? "Foto sfocata" : undefined,
        expectedUpdatedAt: (await dossier(id)).updatedAt,
      }),
    },
  );
  expect(response.status, await response.clone().text()).toBe(200);
}

async function citizenUpload(token: string, itemId: string, label: string) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage([300, 200]).drawText(label, { x: 20, y: 100, font, size: 12 });
  const form = new FormData();
  form.set(
    "file",
    new File([new Uint8Array(await pdf.save())], `${label}.pdf`, { type: "application/pdf" }),
  );
  form.set("checklistItemId", itemId);
  const response = await app.request(`/api/c/${token}/documents`, {
    method: "POST",
    body: form,
    headers: { Origin: origin },
  });
  expect(response.status, await response.clone().text()).toBeLessThan(300);
}

const entryNames = async (id: string) =>
  readZip(new Uint8Array(await (await archive(id)).arrayBuffer())).map((entry) => entry.name);

async function upload(
  caseId: string,
  checklistItemId: string | null,
  content: string,
  fileName = "foto.jpg",
  mimeType = "image/jpeg",
) {
  const documentId = `doc-${++sequence}`;
  const data = new TextEncoder().encode(content);
  const storageKey = await storage.put(`cases/${caseId}/${documentId}`, data);
  await db.insert(documents).values({
    id: documentId,
    caseId,
    fileName,
    mimeType,
    sizeBytes: data.length,
    storageKey,
    sha256: hashBytes(data),
    uploadedAt: new Date(now.getTime() - 3_600_000 + sequence * 1000).toISOString(),
    checklistItemId,
    memberId: null,
    status: "analyzed",
  });
  return documentId;
}

const archive = (id: string, cookie = cookies.a) =>
  app.request(`/api/cases/${id}/documents/archive`, { headers: { Cookie: cookie } });

it("hands over every original in dossier order, named by person and document", async () => {
  const { id, checklist } = await fixture();
  const identity = checklist.find(
    (item) => item.requirementId === "identity" && item.memberName === "Amina",
  )!;
  const childIdentity = checklist.find(
    (item) => item.requirementId === "identity" && item.memberName === "Yusuf",
  )!;
  await upload(id, childIdentity.id, "yusuf");
  await upload(id, identity.id, "fronte");
  await upload(id, identity.id, "retro");
  await upload(id, null, "%PDF senza voce", "contratto affitto.pdf", "application/pdf");

  const response = await archive(id);
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("application/zip");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("content-disposition")).toBe(
    `attachment; filename="documenti.zip"; filename*=UTF-8''Esempio%20Amina%20-%20AV-2027-${id.slice(5).padStart(6, "0")}%20-%20documenti.zip`,
  );
  const entries = readZip(new Uint8Array(await response.arrayBuffer()));
  const decode = (data: Uint8Array) => new TextDecoder().decode(data);
  const position = (memberName: string) =>
    checklist.findIndex((item) => item.memberName === memberName);
  // Amina's items come before Yusuf's in the dossier, whatever the upload order.
  expect(position("Amina")).toBeLessThan(position("Yusuf"));
  expect(entries.map((entry) => [entry.name, decode(entry.data)])).toEqual([
    ["01 Amina - Documento d’identità (1 di 2).jpg", "fronte"],
    ["02 Amina - Documento d’identità (2 di 2).jpg", "retro"],
    ["03 Yusuf - Documento d’identità.jpg", "yusuf"],
    ["04 Altri documenti - contratto affitto.pdf", "%PDF senza voce"],
  ]);

  const [event] = await db
    .select()
    .from(events)
    .where(and(eq(events.caseId, id), eq(events.type, "documents.archive_downloaded")));
  expect(event).toMatchObject({ actor: "operator", actorId: "a" });
  expect(event!.metadata).toEqual({ documents: 4, bytes: 31 });
  const timeline = CaseDossier.parse(
    await (await app.request(`/api/cases/${id}`, { headers: { Cookie: cookies.a } })).json(),
  ).timeline;
  expect(timeline.map((entry) => entry.label)).toContain("Documenti scaricati in un unico ZIP");
});

it("leaves out what the desk rejected or waived", async () => {
  const { id, checklist } = await fixture();
  const [rejected, waived, kept] = checklist.filter((item) => item.memberName === "Amina");
  await upload(id, rejected!.id, "sbagliato");
  await upload(id, waived!.id, "inutile");
  await upload(id, kept!.id, "giusto");
  await db.insert(checklistReviews).values([
    { caseId: id, itemId: rejected!.id, decision: "rejected", reviewedAt: now.toISOString() },
    { caseId: id, itemId: waived!.id, decision: "waived", reviewedAt: now.toISOString() },
  ]);
  const entries = readZip(new Uint8Array(await (await archive(id)).arrayBuffer()));
  expect(entries.map((entry) => new TextDecoder().decode(entry.data))).toEqual(["giusto"]);
});

it("says so when there is nothing to download, and never shows another CAF's case", async () => {
  const { id, checklist } = await fixture();
  const empty = await archive(id);
  expect(empty.status).toBe(404);
  expect(ApiError.parse(await empty.json()).error.message).toBe(
    "In questa pratica non ci sono documenti da scaricare.",
  );
  await upload(id, checklist[0]!.id, "dato riservato");
  const foreign = await archive(id, cookies.b);
  expect(foreign.status).toBe(404);
  expect(await foreign.text()).not.toContain("dato riservato");
  expect((await app.request(`/api/cases/${id}/documents/archive`)).status).toBe(401);
  const events_ = await db
    .select()
    .from(events)
    .where(and(eq(events.caseId, id), eq(events.type, "documents.archive_downloaded")));
  expect(events_).toHaveLength(0);
});

it("stops the download when a file cannot be read and logs only identifiers", async () => {
  const { id, checklist } = await fixture();
  await upload(id, checklist[0]!.id, "presente");
  const missing = await upload(id, checklist[1]!.id, "sparito");
  const [row] = await db.select().from(documents).where(eq(documents.id, missing));
  await storage.delete(row!.storageKey);
  logs.length = 0;
  const response = await archive(id);
  expect(response.status).toBe(200);
  await expect(response.arrayBuffer()).rejects.toThrow();
  expect(logs).toContainEqual({
    op: "archive",
    caseId: id,
    documentId: missing,
    errorName: "Error",
  });
  expect(JSON.stringify(logs)).not.toMatch(/Amina|Esempio|foto\.jpg/);
});

it("limits each operator to a few archives a minute", async () => {
  const { id, checklist } = await fixture();
  await upload(id, checklist[0]!.id, "x");
  for (let n = 0; n < 6; n++) expect((await archive(id, cookies.a2)).status).toBe(200);
  const limited = await archive(id, cookies.a2);
  expect(limited.status).toBe(429);
  expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  // A colleague at the next desk is not slowed down.
  expect((await archive(id, cookies.a)).status).toBe(200);
});

it("keeps a rejected file out after the citizen sends its replacement, until the desk undoes it", async () => {
  const { id, token, checklist } = await fixture();
  const identity = checklist.find(
    (item) => item.requirementId === "identity" && item.memberName === "Amina",
  )!;
  const wrong = await upload(id, identity.id, "sfocata");
  await review(id, identity.id, "rejected");
  // What «Chiedi integrazione» leaves the case in: the citizen can upload again.
  await db.update(cases).set({ status: "needs_citizen" }).where(eq(cases.id, id));
  await citizenUpload(token, identity.id, "nitida");

  const after = await dossier(id);
  const item = after.checklist.find((entry) => entry.id === identity.id)!;
  // The upload cleared the rejection: both files are on an item waiting for review.
  expect(item.status).not.toBe("rejected");
  expect(item.documentIds).toHaveLength(2);
  expect(after.documents.find((document) => document.id === wrong)!.rejectedAt).toBe(
    clockAt.toISOString(),
  );
  expect(await entryNames(id)).toEqual(["01 Amina - Documento d’identità.pdf"]);

  // ↺ on the item gives every file back to the dossier.
  await review(id, identity.id, "reset");
  expect((await dossier(id)).documents.every((document) => document.rejectedAt === null)).toBe(
    true,
  );
  expect(await entryNames(id)).toHaveLength(2);
});

it("forgets an old rejection when the citizen moves the file to another item", async () => {
  const { id, token, checklist } = await fixture();
  const [first, second] = checklist.filter((item) => item.memberName === "Amina");
  const moved = await upload(id, first!.id, "spostato");
  await review(id, first!.id, "rejected");
  await db.update(cases).set({ status: "needs_citizen" }).where(eq(cases.id, id));
  const response = await app.request(`/api/c/${token}/documents/${moved}`, {
    method: "PATCH",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ checklistItemId: second!.id }),
  });
  expect(response.status).toBe(200);
  const [row] = await db.select().from(documents).where(eq(documents.id, moved));
  expect(row!.rejectedAt).toBeNull();
});

it("announces the exact length, answers HEAD without reading or logging, refuses altered files", async () => {
  const { id, checklist } = await fixture();
  await upload(id, checklist[0]!.id, "uno");
  const altered = await upload(id, checklist[1]!.id, "due");

  const head = await app.request(`/api/cases/${id}/documents/archive`, {
    method: "HEAD",
    headers: { Cookie: cookies.a },
  });
  expect(head.status).toBe(200);
  const announced = Number(head.headers.get("content-length"));
  const recorded = () =>
    db
      .select()
      .from(events)
      .where(and(eq(events.caseId, id), eq(events.type, "documents.archive_downloaded")));
  expect(await recorded()).toHaveLength(0);

  const full = await archive(id);
  expect(Number(full.headers.get("content-length"))).toBe(announced);
  expect((await full.arrayBuffer()).byteLength).toBe(announced);
  expect(await recorded()).toHaveLength(1);

  // Same size, different bytes: the stored file is not the one the case recorded.
  const [row] = await db.select().from(documents).where(eq(documents.id, altered));
  await storage.put(row!.storageKey, new TextEncoder().encode("tre"));
  logs.length = 0;
  await expect((await archive(id)).arrayBuffer()).rejects.toThrow();
  expect(logs).toContainEqual({
    op: "archive",
    caseId: id,
    documentId: altered,
    errorName: "ArchiveIntegrityError",
  });
});
