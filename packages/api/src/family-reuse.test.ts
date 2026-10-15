import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import {
  createDatabase,
  cases,
  documents,
  events,
  offices,
  operators,
  organizations,
  sessions,
  storageDeletions,
  type Database,
} from "@avanti/db";
import {
  CitizenCase,
  ReuseCaseResponse,
  type DocumentAnalysis,
  type Member,
} from "@avanti/contracts";
import { createApp } from "./app";
import { MemoryStorage } from "./storage";
import { GatewayIntelligence } from "./ai";
import { hashToken, newToken } from "./security";
import { eraseCase } from "./case-erasure";
import { caseById } from "./dossier";
import { detachRemovedMembers } from "./household-cleanup";

const postgresUrl = process.env.DOC_REUSE_TEST_DATABASE_URL;
if (postgresUrl) {
  const target = new URL(postgresUrl);
  if (!["127.0.0.1", "localhost"].includes(target.hostname) || !target.pathname.endsWith("_test"))
    throw new Error("Riuso: serve un database Postgres loopback isolato con suffisso _test");
}
let db: Database;
let close: () => Promise<void>;
let app: ReturnType<typeof createApp>;
let now = new Date("2027-01-15T10:00:00Z");
const origin = "http://localhost:3400";
const storage = new MemoryStorage();
const ai = new GatewayIntelligence();
const analyze = vi.spyOn(ai, "analyze");
const session = newToken();
const operatorSession = newToken();
const applicant: Member = {
  id: "applicant",
  role: "richiedente",
  firstName: "Persona",
  lastName: "Esempio",
  birthDate: "1980-02-10",
  birthYear: 1980,
  taxCode: "AAAAAA80B10A000A",
};
const spouse: Member = {
  id: "spouse",
  role: "coniuge",
  firstName: "Coniuge",
  lastName: "Esempio",
  birthYear: 1981,
};
const child: Member = {
  id: "child",
  role: "figlio",
  firstName: "Figlio",
  lastName: "Esempio",
  birthYear: 2010,
};
const analysis = (member: Member, requirement = "identity"): DocumentAnalysis => ({
  engine: "ai",
  detectedRequirementId: requirement,
  detectedLabel: requirement,
  confidence: 0.95,
  ownerName: `${member.firstName} ${member.lastName}`,
  referenceYear: null,
  expiresOn: "2030-01-01",
  legible: true,
  pagesComplete: true,
  findings: [],
});

beforeAll(async () => {
  ({ db, close } = await createDatabase(
    postgresUrl ? { url: postgresUrl, applicationName: "avanti-doc-reuse-test" } : { memory: true },
  ));
  for (const id of ["a", "b"]) {
    await db.insert(organizations).values({ id, name: `CAF ${id}`, kind: "caf" });
    await db
      .insert(offices)
      .values({ id, organizationId: id, slug: id, name: "Sede", address: "Esempio", city: "Roma" });
  }
  for (const [id, role] of [
    ["admin", "admin"],
    ["operator", "operator"],
  ] as const) {
    await db.insert(operators).values({
      id,
      organizationId: "a",
      name: "Operatore",
      email: `${id}@example.test`,
      passwordHash: "unused",
      role,
    });
    await db.insert(sessions).values({
      id,
      operatorId: id,
      tokenHash: hashToken(id === "admin" ? session : operatorSession),
      createdAt: now.toISOString(),
      expiresAt: "2027-01-15T18:00:00Z",
    });
  }
  app = createApp({
    db,
    storage,
    ai,
    clock: () => now,
    cronSecret: "reuse-test",
    errorLogger: () => {},
  });
});
afterAll(async () => {
  await close?.();
});
function request(
  path: string,
  input: unknown,
  method = "POST",
  credential: string | null = session,
) {
  now = new Date(now.getTime() + 4000);
  return app.request(`/api${path}`, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(credential ? { Cookie: `avanti_session=${credential}` } : {}),
    },
    body: JSON.stringify(input),
  });
}
async function fixture(tenant = "a") {
  // A test advancing cron by an hour may have purged the shared synthetic sessions.
  for (const id of ["admin", "operator"])
    await db
      .insert(sessions)
      .values({
        id,
        operatorId: id,
        tokenHash: hashToken(id === "admin" ? session : operatorSession),
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 8 * 3600_000).toISOString(),
      })
      .onConflictDoNothing();
  const id = crypto.randomUUID();
  const token = newToken();
  await db.insert(cases).values({
    id,
    organizationId: tenant,
    officeId: tenant,
    reference: `TEST-${id}`,
    tokenHash: hashToken(token),
    language: "it",
    practiceId: "isee_ordinario",
    answers: {
      members: [applicant, spouse, child],
      household_count: 3,
      practice_year: 2027,
      accounts_count: 1,
    },
    contact: { firstName: applicant.firstName, lastName: applicant.lastName },
    internalNotes: "RISERVATO",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: "2027-03-01T00:00:00Z",
  });
  const docs = [];
  for (const member of [applicant, spouse, child]) {
    const doc = {
      id: crypto.randomUUID(),
      caseId: id,
      fileName: `${member.firstName}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 3,
      storageKey: crypto.randomUUID(),
      sha256: crypto.randomUUID(),
      uploadedAt: now.toISOString(),
      memberId: member.id,
      checklistItemId: `identity:${member.id}`,
      status: "analyzed" as const,
      analysis: analysis(member),
    };
    await db.insert(documents).values(doc);
    await storage.put(doc.storageKey, new Uint8Array([1, 2, 3]));
    docs.push(doc);
  }
  return { id, token, docs };
}
async function reuse(id: string, patch: Record<string, unknown> = {}) {
  return request(`/cases/${id}/reuse`, {
    officeId: "a",
    practiceId: "isee_ordinario",
    practiceYear: 2028,
    members: [applicant, spouse, child],
    confirmed: true,
    ...patch,
  });
}
async function reused(id: string, patch: Record<string, unknown> = {}) {
  const response = await reuse(id, patch);
  const json: unknown = await response.json();
  expect(response.status, JSON.stringify(json)).toBe(201);
  return ReuseCaseResponse.parse(json);
}
function citizenToken(link: string) {
  return link.split("/").at(-1)!;
}

it("creates a new link only after operator action, shares bytes and copies no economic answers, notes or reviews", async () => {
  const source = await fixture();
  const put = vi.spyOn(storage, "put");
  const created = await reused(source.id);
  const [row] = await db.select().from(cases).where(eq(cases.id, created.case.id));
  expect(row?.answers).toMatchObject({ members: [applicant, spouse, child], practice_year: 2028 });
  expect(row?.answers).not.toHaveProperty("accounts_count");
  expect(row?.internalNotes).toBeNull();
  expect(created.case.documents).toHaveLength(3);
  expect(created.case.documents.every((doc) => doc.reuse?.status === "valido")).toBe(true);
  const copied = await db.select().from(documents).where(eq(documents.caseId, created.case.id));
  expect(copied.map((doc) => doc.storageKey).sort()).toEqual(
    source.docs.map((doc) => doc.storageKey).sort(),
  );
  expect(put).not.toHaveBeenCalled();
  put.mockRestore();
  const citizen = CitizenCase.parse(
    await (await app.request(`/api/c/${citizenToken(created.citizenLink)}`)).json(),
  );
  expect(citizen.reuseNotice).toContain("Abbiamo già");
  expect(citizen.documents.map((doc) => doc.memberId)).toEqual([applicant.id]);
  expect(citizen.checklist.flatMap((item) => item.documentIds)).toEqual(
    citizen.documents.map((doc) => doc.id),
  );
  const serialized = JSON.stringify(citizen);
  for (const doc of created.case.documents.filter((doc) => doc.memberId !== applicant.id)) {
    expect(serialized).not.toContain(doc.id);
    for (const [method, suffix, input] of [
      ["GET", "/file", undefined],
      ["PATCH", "", { checklistItemId: `identity:${applicant.id}` }],
      ["DELETE", "", {}],
    ] as const) {
      const response =
        method === "GET"
          ? await app.request(
              `/api/c/${citizenToken(created.citizenLink)}/documents/${doc.id}${suffix}`,
            )
          : await request(
              `/c/${citizenToken(created.citizenLink)}/documents/${doc.id}`,
              input,
              method,
              null,
            );
      expect(response.status).toBe(404);
    }
  }
  expect(
    (await app.request(`/api/c/${source.token}/documents/${created.case.documents[0]!.id}/file`))
      .status,
  ).toBe(404);
  expect(analyze).not.toHaveBeenCalled();
});

it("does not reuse anything between independent links, even for the same applicant", async () => {
  const source = await fixture();
  const independentlyCreated = await request("/cases", {
    officeId: "a",
    practiceId: "modello_730",
    practiceYear: 2027,
    citizen: { firstName: applicant.firstName, lastName: applicant.lastName },
  });
  const created = ReuseCaseResponse.parse(await independentlyCreated.json());
  expect(created.case.documents).toEqual([]);
  const [sourceRow] = await db.select().from(cases).where(eq(cases.id, source.id));
  expect(sourceRow?.familyId).toBeNull();
});

it("supports explicit grants for other members, excludes departed members, and adds a birth without inheriting documents", async () => {
  const source = await fixture();
  const created = await reused(source.id, {
    members: [
      applicant,
      spouse,
      { role: "figlio", firstName: "Neonato", lastName: "Esempio", birthYear: 2027 },
    ],
    citizenVisibleDocumentIds: [source.docs[1]!.id],
  });
  expect(created.case.documents.map((doc) => doc.memberId).sort()).toEqual(
    [applicant.id, spouse.id].sort(),
  );
  const citizen = CitizenCase.parse(
    await (await app.request(`/api/c/${citizenToken(created.citizenLink)}`)).json(),
  );
  expect(citizen.documents).toHaveLength(2);
  expect(created.case.household.find((m) => m.firstName === "Neonato")?.id).not.toBe(child.id);
  expect(
    (await reuse(source.id, { members: [applicant], documentIds: [source.docs[1]!.id] })).status,
  ).toBe(400);
});

it("a later household edit hides and detaches a removed member's reused documents without deleting the source", async () => {
  const source = await fixture();
  const created = await reused(source.id, { citizenVisibleDocumentIds: [source.docs[1]!.id] });
  await db.transaction(async (tx) => {
    const before = await caseById(tx, created.case.id, "a", true);
    const [after] = await tx
      .update(cases)
      .set({ answers: { ...before.answers, members: [applicant] } })
      .where(eq(cases.id, before.id))
      .returning();
    await detachRemovedMembers(tx, before, after!);
  });
  const citizen = CitizenCase.parse(
    await (await app.request(`/api/c/${citizenToken(created.citizenLink)}`)).json(),
  );
  expect(citizen.documents.map((doc) => doc.memberId)).toEqual([applicant.id]);
  const operator = (await (
    await app.request(`/api/cases/${created.case.id}`, {
      headers: { Cookie: `avanti_session=${session}` },
    })
  ).json()) as { documents: { memberId: string | null; reuse: { code: string } }[] };
  expect(operator.documents.filter((doc) => doc.reuse.code === "member_changed")).toHaveLength(2);
  expect(await storage.get(source.docs[1]!.storageKey)).toEqual(new Uint8Array([1, 2, 3]));
});

it("blocks cross-tenant sources/offices/documents and unauthenticated/citizen use", async () => {
  const source = await fixture();
  const other = await fixture("b");
  expect((await reuse(other.id)).status).toBe(404);
  expect((await reuse(source.id, { officeId: "b" })).status).toBe(404);
  expect((await reuse(source.id, { documentIds: [other.docs[0]!.id] })).status).toBe(400);
  expect((await reuse(source.id, { citizenVisibleDocumentIds: [other.docs[0]!.id] })).status).toBe(
    400,
  );
  expect((await reuse(source.id, { confirmed: false })).status).toBe(400);
  expect((await reuse(source.id, { members: [{ ...applicant, id: other.id }] })).status).toBe(400);
  expect((await request(`/cases/${source.id}/reuse`, {}, "POST", null)).status).toBe(401);
  expect(
    (
      await request(`/cases/${other.id}/documents/${other.docs[0]!.id}/reuse-check`, {
        useAi: true,
      })
    ).status,
  ).toBe(404);
});

it("searches the applicant only within the CAF and audits without search terms", async () => {
  const response = await request(
    "/cases/families/search",
    { taxCode: applicant.taxCode?.toLowerCase() },
    "POST",
    operatorSession,
  );
  expect(response.status).toBe(200);
  const result = (await response.json()) as { items: { caseId: string }[] };
  expect(result.items.length).toBeGreaterThan(0);
  for (const item of result.items) {
    const [row] = await db.select().from(cases).where(eq(cases.id, item.caseId));
    expect(row?.organizationId).toBe("a");
  }
  const byName = await request("/cases/families/search", {
    firstName: " PERSONA ",
    lastName: "Esempio",
    birthDate: applicant.birthDate,
  });
  expect(((await byName.json()) as { items: unknown[] }).items.length).toBeGreaterThan(0);
  const wrongDate = await request("/cases/families/search", {
    firstName: applicant.firstName,
    lastName: applicant.lastName,
    birthDate: "1980-02-11",
  });
  expect(await wrongDate.json()).toMatchObject({ items: [] });
  expect(
    (
      await request("/cases/families/search", {
        firstName: "Persona",
        lastName: "Esempio",
        birthDate: "1980-02-30",
      })
    ).status,
  ).toBe(400);
  expect(
    (await request("/cases/families/search", { taxCode: applicant.taxCode }, "POST", null)).status,
  ).toBe(401);
  const searches = await db.select().from(events).where(eq(events.type, "family.searched"));
  expect(searches.length).toBeGreaterThan(0);
  for (const event of searches) expect(event.metadata).toEqual({ cases: expect.any(Number) });
  expect(JSON.stringify(searches)).not.toContain(applicant.taxCode);
});

it("retention removes just the expired dossier; a deletion retry keeps files referenced by a live dossier", async () => {
  const source = await fixture();
  const created = await reused(source.id);
  await db.update(cases).set({ expiresAt: "2020-01-01T00:00:00Z" }).where(eq(cases.id, source.id));
  const maintenance = await app.request("/api/cron/maintenance", {
    headers: { Authorization: "Bearer reuse-test" },
  });
  expect(maintenance.status).toBe(200);
  expect(await db.select().from(cases).where(eq(cases.id, source.id))).toEqual([]);
  expect(await db.select().from(cases).where(eq(cases.id, created.case.id))).toHaveLength(1);
  for (const doc of source.docs)
    expect(await storage.get(doc.storageKey)).toEqual(new Uint8Array([1, 2, 3]));
  // A stale pre-existing queue item must also be safe.
  await db.insert(storageDeletions).values({
    id: crypto.randomUUID(),
    caseId: source.id,
    storageKey: source.docs[0]!.storageKey,
    createdAt: now.toISOString(),
    nextAttemptAt: now.toISOString(),
  });
  const nextApp = createApp({
    db,
    storage,
    ai,
    clock: () => new Date(now.getTime() + 61_000),
    cronSecret: "reuse-test",
    errorLogger: () => {},
  });
  expect(
    (
      await nextApp.request("/api/cron/maintenance", {
        headers: { Authorization: "Bearer reuse-test" },
      })
    ).status,
  ).toBe(200);
  expect(await storage.get(source.docs[0]!.storageKey)).toEqual(new Uint8Array([1, 2, 3]));
});

it("deleting one document keeps the shared bytes until the last reference is removed", async () => {
  const source = await fixture();
  const created = await reused(source.id);
  const ownDoc = created.case.documents.find((doc) => doc.memberId === applicant.id)!;
  expect(
    (await request(`/c/${source.token}/documents/${source.docs[0]!.id}`, {}, "DELETE", null))
      .status,
  ).toBe(200);
  expect(await storage.get(source.docs[0]!.storageKey)).toEqual(new Uint8Array([1, 2, 3]));
  expect(
    (
      await request(
        `/c/${citizenToken(created.citizenLink)}/documents/${ownDoc.id}`,
        {},
        "DELETE",
        null,
      )
    ).status,
  ).toBe(200);
  await expect(storage.get(source.docs[0]!.storageKey)).rejects.toThrow("Missing file");
});

it("subject erasure covers the entire linked group even after removal of its source and leaves unrelated/foreign cases alone", async () => {
  const source = await fixture();
  const unrelated = await fixture();
  const other = await fixture("b");
  const first = await reused(source.id);
  const second = await reused(first.case.id, { practiceId: "modello_730", practiceYear: 2027 });
  const [linked] = await db.select().from(cases).where(eq(cases.id, first.case.id));
  // Even an identical group ID must never widen erasure to another CAF.
  await db.update(cases).set({ familyId: linked!.familyId }).where(eq(cases.id, other.id));
  await db.transaction(async (tx) =>
    eraseCase(tx, await caseById(tx, source.id, "a", true), now, "admin"),
  );
  expect(
    (
      await request(
        `/cases/${first.case.id}/family-erasure`,
        { confirmReference: first.case.reference, confirmed: true },
        "POST",
        operatorSession,
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await request(`/cases/${first.case.id}/family-erasure`, {
        confirmReference: "wrong",
        confirmed: true,
      })
    ).status,
  ).toBe(400);
  const response = await request(`/cases/${first.case.id}/family-erasure`, {
    confirmReference: first.case.reference,
    confirmed: true,
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ deletedCases: 2 });
  for (const id of [first.case.id, second.case.id])
    expect(await db.select().from(cases).where(eq(cases.id, id))).toEqual([]);
  for (const id of [unrelated.id, other.id])
    expect(await db.select().from(cases).where(eq(cases.id, id))).toHaveLength(1);
  for (const doc of source.docs)
    await expect(storage.get(doc.storageKey)).rejects.toThrow("Missing file");
  expect((await app.request(`/api/c/${citizenToken(first.citizenLink)}`)).status).toBe(404);
  const erasures = await db
    .select()
    .from(events)
    .where(and(eq(events.organizationId, "a"), eq(events.type, "family.erased")));
  expect(erasures).toContainEqual(expect.objectContaining({ metadata: { cases: 2 } }));
});

it("uses AI only on uncertain documents by explicit request and leaves evidence unchanged on failure", async () => {
  const source = await fixture();
  const created = await reused(source.id, { practiceYear: 2027 });
  const doc = created.case.documents.find((d) => d.memberId === applicant.id)!;
  const configured = vi.spyOn(ai, "configured", "get").mockReturnValue(true);
  analyze.mockResolvedValue(analysis(applicant));
  expect(
    (await request(`/cases/${created.case.id}/documents/${doc.id}/reuse-check`, { useAi: true }))
      .status,
  ).toBe(200);
  expect(analyze).not.toHaveBeenCalled();
  await db
    .update(documents)
    .set({ analysis: { ...analysis(applicant), expiresOn: null } })
    .where(eq(documents.id, doc.id));
  expect(
    (await request(`/cases/${created.case.id}/documents/${doc.id}/reuse-check`, { useAi: false }))
      .status,
  ).toBe(200);
  expect(analyze).not.toHaveBeenCalled();
  analyze.mockRejectedValueOnce(new Error("provider unavailable"));
  const fallback = await request(`/cases/${created.case.id}/documents/${doc.id}/reuse-check`, {
    useAi: true,
  });
  expect(await fallback.json()).toMatchObject({ status: "da_verificare" });
  const success = await request(`/cases/${created.case.id}/documents/${doc.id}/reuse-check`, {
    useAi: true,
  });
  expect(await success.json()).toMatchObject({ status: "valido" });
  expect(analyze).toHaveBeenCalledTimes(2);
  await db
    .update(documents)
    .set({ analysis: { ...analysis(applicant), expiresOn: "2020-01-01" } })
    .where(eq(documents.id, doc.id));
  const expired = await request(`/cases/${created.case.id}/documents/${doc.id}/reuse-check`, {
    useAi: true,
  });
  expect(await expired.json()).toMatchObject({ status: "da_aggiornare", code: "expired" });
  expect(analyze).toHaveBeenCalledTimes(2);
  configured.mockRestore();
});

it("retries failed deletion of the last shared reference without losing the deletion receipt", async () => {
  const source = await fixture();
  const created = await reused(source.id);
  const ownDoc = created.case.documents.find((doc) => doc.memberId === applicant.id)!;
  await request(`/c/${source.token}/documents/${source.docs[0]!.id}`, {}, "DELETE", null);
  const failingApp = createApp({
    db,
    storage,
    ai,
    clock: () => now,
    storageLogger: () => {},
    errorLogger: () => {},
  });
  const deletion = vi
    .spyOn(storage, "delete")
    .mockRejectedValueOnce(new Error("storage unavailable"));
  const response = await failingApp.request(
    `/api/c/${citizenToken(created.citizenLink)}/documents/${ownDoc.id}`,
    { method: "DELETE", headers: { Origin: origin } },
  );
  expect(response.status).toBe(200);
  expect(await storage.get(source.docs[0]!.storageKey)).toEqual(new Uint8Array([1, 2, 3]));
  expect(
    await db.select().from(storageDeletions).where(eq(storageDeletions.id, ownDoc.id)),
  ).toEqual([expect.objectContaining({ attempts: 1 })]);
  deletion.mockRestore();
  const retryApp = createApp({
    db,
    storage,
    ai,
    clock: () => new Date(now.getTime() + 3600_000),
    cronSecret: "retry-test",
    errorLogger: () => {},
  });
  expect(
    (
      await retryApp.request("/api/cron/maintenance", {
        headers: { Authorization: "Bearer retry-test" },
      })
    ).status,
  ).toBe(200);
  await expect(storage.get(source.docs[0]!.storageKey)).rejects.toThrow("Missing file");
  expect(
    await db.select().from(storageDeletions).where(eq(storageDeletions.id, ownDoc.id)),
  ).toEqual([]);
});

it("an AI result arriving after subject erasure cannot restore documents or case data", async () => {
  const source = await fixture();
  const created = await reused(source.id);
  const doc = created.case.documents.find((d) => d.memberId === applicant.id)!;
  await db
    .update(documents)
    .set({ analysis: { ...analysis(applicant), expiresOn: null } })
    .where(eq(documents.id, doc.id));
  const configured = vi.spyOn(ai, "configured", "get").mockReturnValue(true);
  let finish!: (value: DocumentAnalysis) => void;
  let started!: () => void;
  const waiting = new Promise<void>((resolve) => {
    started = resolve;
  });
  analyze.mockImplementationOnce(async () => {
    started();
    return new Promise<DocumentAnalysis>((resolve) => {
      finish = resolve;
    });
  });
  const checking = request(`/cases/${created.case.id}/documents/${doc.id}/reuse-check`, {
    useAi: true,
  });
  try {
    await waiting;
    const erased = await request(`/cases/${created.case.id}/family-erasure`, {
      confirmReference: created.case.reference,
      confirmed: true,
    });
    expect(erased.status).toBe(200);
    finish(analysis(applicant));
    expect((await checking).status).toBe(404);
    expect(await db.select().from(documents).where(eq(documents.caseId, created.case.id))).toEqual(
      [],
    );
    expect(await db.select().from(cases).where(eq(cases.id, created.case.id))).toEqual([]);
  } finally {
    finish?.(analysis(applicant));
    configured.mockRestore();
  }
});

it.skipIf(!postgresUrl)(
  "Postgres: family erasure and retention complete concurrently without an organization/case deadlock",
  async () => {
    const source = await fixture();
    const created = await reused(source.id);
    let locked!: () => void;
    let proceed!: () => void;
    const hasLock = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const release = new Promise<void>((resolve) => {
      proceed = resolve;
    });
    const retaining = db.transaction(async (tx) => {
      const row = await caseById(tx, source.id, "a", true);
      locked();
      await release;
      await eraseCase(tx, row, now, null);
    });
    // Attach the rejection handler before intentionally opening the competing transaction.
    const retained = retaining.then(
      () => ({ ok: true as const }),
      () => ({ ok: false as const }),
    );
    await hasLock;
    const erasing = request(`/cases/${created.case.id}/family-erasure`, {
      confirmReference: created.case.reference,
      confirmed: true,
    });
    try {
      let waiting = false;
      for (let attempt = 0; attempt < 200; attempt++) {
        const [result] = await db
          .select({
            waiting: sql<boolean>`exists(select 1 from pg_stat_activity where application_name = 'avanti-doc-reuse-test' and wait_event_type = 'Lock' and query like 'select%from "cases"%for update%')`,
          })
          .from(sql`(select 1) as lock_probe`);
        if (result?.waiting) {
          waiting = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(waiting).toBe(true);
      proceed();
      expect(await retained).toEqual({ ok: true });
      expect((await erasing).status).toBe(200);
      expect(await db.select().from(cases).where(eq(cases.id, created.case.id))).toEqual([]);
    } finally {
      proceed();
      await Promise.allSettled([retained, erasing]);
    }
  },
);
