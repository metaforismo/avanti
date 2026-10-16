import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import {
  cases,
  createDatabase,
  documents,
  events,
  notifications,
  offices,
  operators,
  organizations,
  sessions,
  settings,
  type Database,
} from "@avanti/db";
import {
  CitizenCase,
  CreateRenewalsResponse,
  RenewalsResponse,
  type DocumentAnalysis,
  type Member,
} from "@avanti/contracts";
import { getQuestions, nextQuestion } from "@avanti/core";
import { GatewayIntelligence } from "./ai";
import { mfaCipher } from "./mfa";
import { createApp } from "./app";
import { MemoryStorage } from "./storage";
import { hashToken, newToken } from "./security";
import { unseal, type NotificationOptions } from "./notification-config";
import { sendNotifications } from "./notifications";
import { caseById } from "./dossier";
import { eraseCase } from "./case-erasure";
import type { Services } from "./context";

const postgresUrl = process.env.RENEWALS_TEST_DATABASE_URL;
if (postgresUrl) {
  const target = new URL(postgresUrl);
  if (!["127.0.0.1", "localhost"].includes(target.hostname) || !target.pathname.endsWith("_test"))
    throw new Error("Rinnovi: serve un database Postgres loopback isolato con suffisso _test");
}
let db: Database;
let close: () => Promise<void>;
let app: ReturnType<typeof createApp>;
const now = new Date("2028-01-15T10:00:00Z");
const session = newToken();
const admin = newToken();
const origin = "http://localhost:3400";
let storage: MemoryStorage;
const send = vi.fn(async () => {});
const notices: NotificationOptions = {
  key: Buffer.alloc(32, 7),
  adapter: { mode: "console", send },
};
const person: Member = {
  id: "person",
  role: "richiedente",
  firstName: "Persona",
  lastName: "Esempio",
  birthYear: 1980,
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
const analysis = (member: Member): DocumentAnalysis => ({
  engine: "ai",
  detectedRequirementId: "identity",
  detectedLabel: "Identità",
  confidence: 0.95,
  ownerName: `${member.firstName} ${member.lastName}`,
  referenceYear: null,
  expiresOn: "2030-01-01",
  legible: true,
  pagesComplete: true,
  findings: [],
});

beforeAll(async () => {
  ({ db, close } = await createDatabase(postgresUrl ? { url: postgresUrl } : { memory: true }));
});
afterAll(async () => {
  await close?.();
});
beforeEach(async () => {
  await db.execute(sql`truncate organizations, rate_limits cascade`);
  send.mockClear();
  storage = new MemoryStorage();
  for (const id of ["a", "b"]) {
    await db.insert(organizations).values({ id, name: `CAF ${id}`, kind: "caf" });
    await db.insert(offices).values({
      id,
      organizationId: id,
      slug: id,
      name: "Sede",
      address: "Via Esempio",
      city: "Roma",
    });
    await db
      .insert(settings)
      .values({ organizationId: id, retentionDays: 365, notifyCitizenRenewals: true });
  }
  for (const [id, role, token] of [
    ["operator", "operator", session],
    ["admin", "admin", admin],
  ] as const) {
    await db.insert(operators).values({
      id,
      organizationId: "a",
      name: "Operatore",
      email: `${id}@example.test`,
      role,
      passwordHash: "unused",
    });
    await db.insert(sessions).values({
      id,
      operatorId: id,
      tokenHash: hashToken(token),
      createdAt: now.toISOString(),
      expiresAt: "2028-01-15T18:00:00Z",
    });
  }
  app = createApp({
    db,
    storage,
    clock: () => now,
    notifications: notices,
    errorLogger: () => {},
    cronSecret: "test-renewals",
  });
});
function request(
  path: string,
  input?: unknown,
  method = "POST",
  credential: string | null = session,
) {
  return app.request(`/api${path}`, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(credential ? { Cookie: `avanti_session=${credential}` } : {}),
    },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  });
}
async function fixture(patch: Partial<typeof cases.$inferInsert> = {}) {
  const id = crypto.randomUUID();
  const token = newToken();
  await db.insert(cases).values({
    id,
    organizationId: "a",
    officeId: "a",
    reference: `TEST-${id}`,
    tokenHash: hashToken(token),
    language: "it",
    practiceId: "isee_ordinario",
    status: "ready",
    answers: {
      members: [person, spouse, child],
      household_count: 3,
      practice_year: 2027,
      accounts_count: 2,
      housing: "rent",
      [`income_${person.id}`]: ["employee"],
    },
    contact: {
      firstName: person.firstName,
      lastName: person.lastName,
      email: `${id}@example.test`,
    },
    renewalContactConsentAt: "2027-12-01T00:00:00Z",
    internalNotes: "NOTA RISERVATA",
    createdAt: "2027-01-15T10:00:00Z",
    updatedAt: "2027-01-16T10:00:00Z",
    expiresAt: "2027-03-15T10:00:00Z",
    ...patch,
  });
  const docs = [];
  for (const member of [person, spouse, child]) {
    const doc = {
      id: crypto.randomUUID(),
      caseId: id,
      fileName: `${member.id}.pdf`,
      storageKey: crypto.randomUUID(),
      mimeType: "application/pdf",
      sizeBytes: 3,
      sha256: crypto.randomUUID(),
      status: "analyzed" as const,
      uploadedAt: "2027-01-15T10:00:00Z",
      checklistItemId: `identity:${member.id}`,
      memberId: member.id,
      analysis: analysis(member),
    };
    await db.insert(documents).values(doc);
    await storage.put(doc.storageKey, new Uint8Array([1, 2, 3]));
    docs.push(doc);
  }
  return { id, token, docs };
}
async function create(ids: string[], patch: Record<string, unknown> = {}) {
  const response = await request("/renewals", { sourceCaseIds: ids, year: 2028, ...patch });
  const json: unknown = await response.json();
  expect(response.status, JSON.stringify(json)).toBe(200);
  return CreateRenewalsResponse.parse(json);
}
async function list(query = "") {
  const response = await request(`/renewals?year=2028${query}`, undefined, "GET");
  const json: unknown = await response.json();
  expect(response.status, JSON.stringify(json)).toBe(200);
  return RenewalsResponse.parse(json);
}
const tokenFrom = (link: string) => link.split("/").at(-1)!;
async function citizen(token: string) {
  return CitizenCase.parse(await (await request(`/c/${token}`, undefined, "GET", null)).json());
}

it("lists only retained previous-year ISEE ready/submitted sources in the CAF, with stable pagination and reuse assessments", async () => {
  const source = await fixture();
  await fixture({ status: "submitted" });
  await fixture({ practiceId: "modello_730" });
  await fixture({ status: "in_review" });
  await fixture({ answers: { practice_year: 2026 } });
  await fixture({ organizationId: "b", officeId: "b" });
  await fixture({ expiresAt: "2026-01-01T00:00:00Z" });
  await db
    .update(documents)
    .set({ analysis: { ...analysis(spouse), expiresOn: "2027-12-31" } })
    .where(eq(documents.id, source.docs[1]!.id));
  await db
    .update(documents)
    .set({ analysis: { ...analysis(child), expiresOn: null } })
    .where(eq(documents.id, source.docs[2]!.id));
  const all = await list();
  expect(all.items).toHaveLength(2);
  expect(all.items.find((r) => r.sourceCaseId === source.id)).toMatchObject({
    citizenName: "Persona Esempio",
    householdCount: 3,
    documents: { valid: 1, toUpdate: 1, toVerify: 1 },
    status: "not_invited",
    lastInvitedAt: null,
  });
  const page = await list("&limit=1");
  expect(page.nextAfter).not.toBeNull();
  const second = await list(`&limit=1&after=${page.nextAfter}`);
  expect(second.items[0]!.sourceCaseId).not.toBe(page.items[0]!.sourceCaseId);
  expect(second.nextAfter).toBeNull();
  expect((await request("/renewals?year=bad", undefined, "GET")).status).toBe(400);
});

it("copies no annual answers or notes; a citizen without CF confirms a changed household first, with other members' documents protected", async () => {
  const source = await fixture();
  const result = await create([source.id]);
  const item = result.items[0]!;
  expect(item).toMatchObject({ created: true, status: "invited", invitation: "queued" });
  const token = tokenFrom(item.citizenLink!);
  const initial = await citizen(token);
  expect(initial.renewal).toMatchObject({
    year: 2028,
    previousYear: 2027,
    householdConfirmationRequired: true,
    householdConfirmedAt: null,
  });
  expect(initial.nextQuestion).toMatchObject({ id: "members", kind: "members", required: true });
  expect(initial.conversation?.ask.map((q) => q.id)).toEqual(["members"]);
  expect(initial.documents.map((d) => d.memberId)).toEqual([person.id]);
  expect(initial.answers).not.toHaveProperty("accounts_count");
  expect(initial.answers).not.toHaveProperty("housing");
  expect(JSON.stringify(initial)).not.toContain("NOTA RISERVATA");
  expect(
    (await request(`/c/${token}/turn`, { type: "skip", questionId: "members" }, "POST", null))
      .status,
  ).toBe(400);
  expect(
    (
      await request(
        `/c/${token}/turn`,
        { type: "answer", questionId: "housing", value: "rent" },
        "POST",
        null,
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await request(
        `/c/${token}/turn`,
        { type: "choose_practice", practiceId: "modello_730" },
        "POST",
        null,
      )
    ).status,
  ).toBe(409);
  expect(
    (
      await request(
        `/c/${token}/submit`,
        { confirmed: true, contact: { firstName: "Persona", lastName: "Esempio" } },
        "POST",
        null,
      )
    ).status,
  ).toBe(409);
  const response = await request(
    `/c/${token}/turn`,
    {
      type: "answer",
      questionId: "members",
      value: [person, { role: "figlio", firstName: "Nuovo", birthYear: 2027 }],
    },
    "POST",
    null,
  );
  const view = CitizenCase.parse(await response.json());
  expect(response.status).toBe(200);
  expect(view.household).toHaveLength(2);
  expect(view.household.find((m) => m.firstName === "Nuovo")!.id).not.toBe(child.id);
  expect(view.renewal?.householdConfirmationRequired).toBe(false);
  expect(view.renewal?.householdConfirmedAt).not.toBeNull();
  expect(view.nextQuestion).not.toBeNull();
  expect(view.nextQuestion?.id).not.toBe("members");
  expect(
    getQuestions("isee_ordinario", view.answers, "it").some((q) => q.id.startsWith("income_")),
  ).toBe(true);
  expect(nextQuestion("isee_ordinario", view.answers, "it")).not.toBeNull();
  expect((await list()).items).toHaveLength(0);
  expect((await list("&status=started")).items[0]!.renewalCaseId).toBe(item.caseId);
  const protectedDocs = await db
    .select()
    .from(documents)
    .where(and(eq(documents.caseId, item.caseId), eq(documents.citizenVisible, false)));
  for (const doc of protectedDocs) {
    expect(
      (await request(`/c/${token}/documents/${doc.id}/file`, undefined, "GET", null)).status,
    ).toBe(404);
    expect((await request(`/c/${token}/documents/${doc.id}`, {}, "DELETE", null)).status).toBe(404);
    expect(
      (
        await request(
          `/c/${token}/documents/${doc.id}`,
          { checklistItemId: `identity:${person.id}` },
          "PATCH",
          null,
        )
      ).status,
    ).toBe(404);
  }
  const confirmations = await db
    .select()
    .from(events)
    .where(eq(events.type, "renewal.household_confirmed"));
  expect(confirmations).toHaveLength(1);
  expect(confirmations[0]!.actor).toBe("citizen");
});

it("keeps expired and wrong-year documents marked to update instead of counting them as valid", async () => {
  const source = await fixture();
  await db
    .update(documents)
    .set({ analysis: { ...analysis(person), expiresOn: "2027-12-31" } })
    .where(eq(documents.id, source.docs[0]!.id));
  await db.insert(documents).values({
    ...source.docs[0]!,
    id: crypto.randomUUID(),
    checklistItemId: `income:${person.id}`,
    analysis: {
      ...analysis(person),
      detectedRequirementId: "income",
      referenceYear: 2025,
      expiresOn: null,
    },
  });
  const created = (await create([source.id])).items[0]!;
  const view = await citizen(tokenFrom(created.citizenLink!));
  expect(view.documents.some((d) => d.reuse?.code === "expired")).toBe(true);
  expect(view.documents.some((d) => d.reuse?.code === "wrong_year")).toBe(true);
  expect((await list("&status=invited")).items[0]!.documents.toUpdate).toBe(2);
});

it("is idempotent under concurrent requests and only returns a new link on explicit regeneration", async () => {
  const source = await fixture();
  const input = { sourceCaseIds: [source.id], year: 2028 };
  const replies = await Promise.all([request("/renewals", input), request("/renewals", input)]);
  const results = await Promise.all(
    replies.map(async (response) => {
      expect(response.status).toBe(200);
      return CreateRenewalsResponse.parse(await response.json()).items[0]!;
    }),
  );
  expect(new Set(results.map((r) => r.caseId)).size).toBe(1);
  expect(results.filter((r) => r.created)).toHaveLength(1);
  expect(results.filter((r) => r.citizenLink)).toHaveLength(1);
  expect(
    await db.select().from(notifications).where(eq(notifications.kind, "citizen_renewal")),
  ).toHaveLength(1);
  const first = results.find((r) => r.citizenLink)!;
  expect((await list("&status=invited")).counts).toMatchObject({ invited: 1, not_invited: 0 });
  const regenerated = (await create([source.id], { regenerateLinks: true })).items[0]!;
  expect(regenerated.caseId).toBe(first.caseId);
  expect(regenerated.citizenLink).not.toBe(first.citizenLink);
  expect(
    (await request(`/c/${tokenFrom(first.citizenLink!)}`, undefined, "GET", null)).status,
  ).toBe(404);
  expect(
    (await request(`/c/${tokenFrom(regenerated.citizenLink!)}`, undefined, "GET", null)).status,
  ).toBe(200);
  expect(await db.select().from(cases).where(eq(cases.renewalSourceId, source.id))).toHaveLength(1);
  await deliver();
  expect(send).toHaveBeenCalledTimes(1);
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.kind, "citizen_renewal"));
  expect(rows.map((r) => r.state).sort()).toEqual(["cancelled", "simulated"]);
});

async function deliver(clock = now) {
  const s: Services = {
    db,
    storage,
    notifications: notices,
    clock: () => clock,
    errorLogger: () => {},
    mfa: mfaCipher({ key: "ab".repeat(32) }),
    ai: new GatewayIntelligence(),
    publicUrl: origin,
    production: false,
  };
  return sendNotifications(s, clock);
}

it("uses Arabic citizen and encrypted invitation copy and cancels delivery when the link expires", async () => {
  const source = await fixture({ language: "ar" });
  const created = (await create([source.id])).items[0]!;
  const view = await citizen(tokenFrom(created.citizenLink!));
  expect(view.language).toBe("ar");
  expect(view.nextQuestion?.prompt).toMatch(/أسرتك/);
  expect(view.renewal?.notice).toMatch(/تجديد/);
  const [row] = await db
    .select()
    .from(notifications)
    .where(eq(notifications.caseId, created.caseId));
  expect(row!.envelope).not.toContain(created.citizenLink!);
  const envelope = unseal(notices, `${row!.id}:${row!.kind}:${row!.language}`, row!.envelope!);
  expect(envelope.subject).toContain("تجديد");
  expect(envelope.text).toContain(created.citizenLink!);
  await db.update(cases).set({ expiresAt: now.toISOString() }).where(eq(cases.id, created.caseId));
  expect(
    (await request(`/c/${tokenFrom(created.citizenLink!)}`, undefined, "GET", null)).status,
  ).toBe(410);
  await deliver();
  expect(send).not.toHaveBeenCalled();
  expect(
    (await db.select().from(notifications).where(eq(notifications.id, row!.id)))[0]!.state,
  ).toBe("cancelled");
});

it("requires dedicated consent and CAF preference, never inferring them from an email or old privacy acceptance", async () => {
  const source = await fixture({ renewalContactConsentAt: null });
  expect((await create([source.id])).items[0]!.invitation).toBe("no_consent");
  expect(await db.select().from(notifications)).toHaveLength(0);
  const response = await request(
    `/c/${source.token}/renewal-consent`,
    { consented: true },
    "PUT",
    null,
  );
  // Source link expired but still retained: consent cannot be forged through an expired capability.
  expect(response.status).toBe(410);
  const live = await fixture({ expiresAt: "2028-02-01T00:00:00Z", renewalContactConsentAt: null });
  expect(
    (await request(`/c/${live.token}/renewal-consent`, { consented: true }, "PUT", null)).status,
  ).toBe(200);
  expect((await create([live.id])).items[0]!.invitation).toBe("queued");
  const noEmail = await fixture({ contact: { firstName: "Persona", lastName: "Esempio" } });
  expect((await create([noEmail.id])).items[0]!.invitation).toBe("no_email");
  await db
    .update(settings)
    .set({ notifyCitizenRenewals: false })
    .where(eq(settings.organizationId, "a"));
  const disabled = await fixture();
  expect((await create([disabled.id])).items[0]!.invitation).toBe("disabled");
  await deliver();
  expect(send).not.toHaveBeenCalled();
});

it("isolates CAFs, gates roles/session state and rejects invalid or oversized batches atomically", async () => {
  const source = await fixture();
  const other = await fixture({ organizationId: "b", officeId: "b" });
  expect(
    (await request("/renewals", { sourceCaseIds: [source.id, other.id], year: 2028 })).status,
  ).toBe(404);
  expect(await db.select().from(cases).where(eq(cases.renewalYear, 2028))).toHaveLength(0);
  expect((await request("/renewals?year=2028", undefined, "GET", null)).status).toBe(401);
  expect(
    (await request("/renewals", { sourceCaseIds: [source.id], year: 2028 }, "POST", null)).status,
  ).toBe(401);
  expect(
    (await request("/renewals", { sourceCaseIds: [source.id, source.id], year: 2028 })).status,
  ).toBe(400);
  expect(
    (
      await request("/renewals", {
        sourceCaseIds: Array.from({ length: 51 }, (_, i) => `source-${i}`),
        year: 2028,
      })
    ).status,
  ).toBe(400);
  await db.update(operators).set({ active: false }).where(eq(operators.id, "operator"));
  expect((await request("/renewals?year=2028", undefined, "GET")).status).toBe(401);
});

it("survives source erasure and family erasure includes the renewal and its encrypted invite", async () => {
  const source = await fixture();
  const created = (await create([source.id])).items[0]!;
  await db.transaction(async (tx) =>
    eraseCase(tx, await caseById(tx, source.id, "a", true), now, "admin"),
  );
  expect((await citizen(tokenFrom(created.citizenLink!))).household).toHaveLength(3);
  expect(await storage.get(source.docs[0]!.storageKey)).toEqual(new Uint8Array([1, 2, 3]));
  const response = await request(
    `/cases/${created.caseId}/family-erasure`,
    { confirmReference: created.reference, confirmed: true },
    "POST",
    admin,
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ deletedCases: 1 });
  expect(
    await db.select().from(notifications).where(eq(notifications.caseId, created.caseId)),
  ).toHaveLength(0);
  expect(
    (await request(`/c/${tokenFrom(created.citizenLink!)}`, undefined, "GET", null)).status,
  ).toBe(404);
  await expect(storage.get(source.docs[0]!.storageKey)).rejects.toThrow();
});

it("does not duplicate a new-year case already linked by ordinary reuse, including other sources of the same family", async () => {
  const source = await fixture();
  const reused = await request(`/cases/${source.id}/reuse`, {
    officeId: "a",
    practiceId: "isee_ordinario",
    practiceYear: 2028,
    confirmed: true,
    members: [person, spouse, child],
  });
  expect(reused.status).toBe(201);
  const existing = (await reused.json()) as { case: { id: string } };
  expect((await list()).items).toHaveLength(0);
  const result = (await create([source.id])).items[0]!;
  expect(result).toMatchObject({
    caseId: existing.case.id,
    created: false,
    citizenLink: null,
    invitation: "existing",
    status: "started",
  });
});

it("records only technical identifiers and numeric/boolean renewal audit metadata", async () => {
  const source = await fixture();
  const created = (await create([source.id])).items[0]!;
  await list("&status=all");
  const rows = await db
    .select()
    .from(events)
    .where(sql`${events.type} like 'renewal%'`);
  expect(rows.length).toBeGreaterThan(0);
  const serialized = JSON.stringify(rows);
  for (const text of [
    person.firstName,
    person.lastName,
    "example.test",
    "NOTA RISERVATA",
    created.citizenLink!,
  ])
    expect(serialized).not.toContain(text);
  for (const row of rows)
    expect(
      Object.values(row.metadata).every(
        (v) => v === null || ["number", "boolean"].includes(typeof v),
      ),
    ).toBe(true);
});

it("supports citizen confirmation through conversation proposals without an operator confirmation path", async () => {
  const source = await fixture();
  const created = (await create([source.id])).items[0]!;
  const token = tokenFrom(created.citizenLink!);
  const proposal = {
    id: "household-proposal",
    questionId: "members",
    questionText: "Conferma",
    value: [person],
    display: "Persona",
    evidence: "Persona",
    confidence: 0.8,
  };
  await db
    .update(cases)
    .set({ conversationProposals: [proposal] })
    .where(eq(cases.id, created.caseId));
  const response = await request(
    `/c/${token}/conversation/confirm`,
    { accept: [{ proposalId: proposal.id }], reject: [] },
    "POST",
    null,
  );
  expect(response.status).toBe(200);
  const view = await citizen(token);
  expect(view.renewal?.householdConfirmationRequired).toBe(false);
  expect(view.renewal?.householdConfirmedAt).not.toBeNull();
  expect(view.household).toHaveLength(1);
  expect(view.conversation?.complete).toBe(false);
});

it("does not revive sources due for retention before cron and includes the exact retention boundary", async () => {
  const cutoff = new Date(now.getTime() - 365 * 86400000);
  const boundary = await fixture({ expiresAt: cutoff.toISOString() });
  const expired = await fixture({ expiresAt: new Date(cutoff.getTime() - 1).toISOString() });
  expect((await list()).items.map((i) => i.sourceCaseId)).toEqual([boundary.id]);
  expect((await request("/renewals", { sourceCaseIds: [expired.id], year: 2028 })).status).toBe(
    404,
  );
  expect((await create([boundary.id])).items[0]!.created).toBe(true);
});

it("withdraws consent across the linked family and cancels an already queued invitation", async () => {
  const source = await fixture({ expiresAt: "2028-02-01T00:00:00Z" });
  const created = (await create([source.id])).items[0]!;
  const response = await request(
    `/c/${source.token}/renewal-consent`,
    { consented: false },
    "PUT",
    null,
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ consented: false });
  expect((await citizen(tokenFrom(created.citizenLink!))).renewalContactConsent).toBe(false);
  await deliver();
  expect(send).not.toHaveBeenCalled();
  expect(
    (await db.select().from(notifications).where(eq(notifications.caseId, created.caseId)))[0]!
      .state,
  ).toBe("cancelled");
});

it("operator frequency limits apply even to idempotent calls and return Retry-After", async () => {
  const source = await fixture();
  for (let i = 0; i < 5; i++) await create([source.id]);
  const response = await request("/renewals", { sourceCaseIds: [source.id], year: 2028 });
  expect(response.status).toBe(429);
  expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
  expect(await db.select().from(cases).where(eq(cases.renewalSourceId, source.id))).toHaveLength(1);
});

it("counts submitted renewals by first submission, also after an integration request, and blocks regeneration", async () => {
  const source = await fixture();
  const item = (await create([source.id])).items[0]!;
  await db
    .update(cases)
    .set({ submittedAt: now.toISOString(), status: "needs_citizen" })
    .where(eq(cases.id, item.caseId));
  const listResult = await list("&status=submitted");
  expect(listResult.items).toHaveLength(1);
  expect(listResult.counts.submitted).toBe(1);
  // Resending an annual campaign after a first submission is no longer appropriate.
  expect(
    (await request("/renewals", { sourceCaseIds: [source.id], year: 2028, regenerateLinks: true }))
      .status,
  ).toBe(409);
});

it("emits only one valid link when a regeneration batch selects two previous-year sources of the same family", async () => {
  const source = await fixture();
  const reused = await request(`/cases/${source.id}/reuse`, {
    officeId: "a",
    practiceId: "isee_ordinario",
    practiceYear: 2027,
    confirmed: true,
    members: [person, spouse, child],
  });
  expect(reused.status).toBe(201);
  const second = (await reused.json()) as { case: { id: string } };
  await db.update(cases).set({ status: "ready" }).where(eq(cases.id, second.case.id));
  const result = await create([source.id, second.case.id], { regenerateLinks: true });
  expect(new Set(result.items.map((r) => r.caseId)).size).toBe(1);
  const links = result.items.flatMap((r) => (r.citizenLink ? [r.citizenLink] : []));
  expect(links).toHaveLength(1);
  expect((await citizen(tokenFrom(links[0]!))).renewal?.householdConfirmationRequired).toBe(true);
  const again = await create([source.id, second.case.id], { regenerateLinks: true });
  const regenerated = again.items.flatMap((r) => (r.citizenLink ? [r.citizenLink] : []));
  expect(regenerated).toHaveLength(1);
  expect((await request(`/c/${tokenFrom(links[0]!)}`, undefined, "GET", null)).status).toBe(404);
  expect((await request(`/c/${tokenFrom(regenerated[0]!)}`, undefined, "GET", null)).status).toBe(
    200,
  );
});

it("completes the new-year interview through citizen turns and records the first submission and explicit email consent", async () => {
  const source = await fixture({ renewalContactConsentAt: null });
  const item = (await create([source.id])).items[0]!;
  const token = tokenFrom(item.citizenLink!);
  let view = await citizen(token);
  let turns = 0;
  while (view.nextQuestion) {
    expect(++turns).toBeLessThan(50);
    const q = view.nextQuestion;
    const value =
      q.kind === "members"
        ? view.household
        : q.kind === "yes_no"
          ? false
          : q.kind === "number"
            ? Math.max(0, q.min ?? 0)
            : q.kind === "single_choice"
              ? q.options![0]!.value
              : q.kind === "multi_choice"
                ? q.options!.slice(0, q.min ?? (q.required ? 1 : 0)).map((o) => o.value)
                : q.kind === "date"
                  ? "1980-01-01"
                  : "Esempio";
    const response = await request(
      `/c/${token}/turn`,
      { type: "answer", questionId: q.id, value },
      "POST",
      null,
    );
    const json: unknown = await response.json();
    expect(response.status, JSON.stringify(json)).toBe(200);
    view = CitizenCase.parse(json);
  }
  expect(view.renewal?.householdConfirmationRequired).toBe(false);
  const submitted = await request(
    `/c/${token}/submit`,
    {
      confirmed: true,
      contact: { firstName: "Persona", lastName: "Esempio", email: "citizen@example.test" },
      renewalContactConsent: true,
    },
    "POST",
    null,
  );
  const result = CitizenCase.parse(await submitted.json());
  expect(submitted.status).toBe(200);
  expect(result.status).toBe("submitted");
  expect(result.renewalContactConsent).toBe(true);
  expect(result.submittedAt).not.toBeNull();
  expect((await list("&status=submitted")).items[0]!.renewalCaseId).toBe(item.caseId);
});
