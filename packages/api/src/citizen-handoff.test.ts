import { afterAll, beforeAll, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  cases,
  checklistReviews,
  createDatabase,
  events,
  offices,
  operators,
  organizations,
  sessions,
  type Database,
} from "@avanti/db";
import { ApiError, AuditPage, CaseDossier, CitizenHandoff } from "@avanti/contracts";
import { createApp } from "./app";
import { GatewayIntelligence } from "./ai";
import { hashToken, newToken } from "./security";
import { MemoryStorage } from "./storage";

const origin = "https://avanti.example.test";
const now = new Date("2027-01-12T09:00:00Z");
let db: Database;
let close: () => Promise<void>;
let app: ReturnType<typeof createApp>;
const cookies = { a: `avanti_session=${newToken()}`, b: `avanti_session=${newToken()}` };
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
      bookingUrl: "https://prenota.example.test/centro",
    });
    await db.insert(operators).values({
      id: tenant,
      organizationId: tenant,
      name: "Operatore Esempio",
      email: `${tenant}@example.test`,
      passwordHash: "unused",
      role: "admin",
    });
    await db.insert(sessions).values({
      id: tenant,
      operatorId: tenant,
      tokenHash: hashToken(cookies[tenant].split("=")[1]!),
      createdAt: now.toISOString(),
      expiresAt: "2027-01-12T17:00:00Z",
    });
  }
  app = createApp({
    db,
    storage: new MemoryStorage(),
    ai: new GatewayIntelligence(),
    clock: () => now,
    publicUrl: `${origin}/`,
    logger: (record) => logs.push(record),
    errorLogger: (record) => logs.push(record),
  });
});
afterAll(async () => close?.());

async function fixture(
  language: "ar" | "it" = "ar",
  status: "needs_citizen" | "intake" | "in_review" = "needs_citizen",
  year = 2027,
) {
  const id = `case-${++sequence}`;
  await db.insert(cases).values({
    id,
    organizationId: "a",
    officeId: "a",
    reference: `AV-2027-${String(sequence).padStart(6, "0")}`,
    tokenHash: hashToken(newToken()),
    language,
    status,
    practiceId: "isee_ordinario",
    answers: {
      members: [applicant, child],
      household_count: 2,
      practice_year: year,
      accounts_count: 1,
      account_owner_0: applicant.id,
      account_bank_0: "Banca Segreta",
      account_type_0: "current",
    },
    contact: { firstName: "Amina", lastName: "Esempio", phone: "3330000000" },
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    submittedAt: now.toISOString(),
    expiresAt: "2027-03-01T00:00:00Z",
  });
  return id;
}

const get = (id: string, cookie = cookies.a) =>
  app.request(`/api/cases/${id}/citizen-handoff`, { headers: { Cookie: cookie } });
const record = (id: string, input: unknown, cookie = cookies.a) =>
  app.request(`/api/cases/${id}/citizen-handoff/events`, {
    method: "POST",
    headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

it("lists what is left in the citizen's language, Italian beside it, required first", async () => {
  const id = await fixture("ar");
  const handoff = CitizenHandoff.parse(await (await get(id)).json());
  expect(handoff.language).toBe("ar");
  expect(handoff.office?.bookingUrl).toBe("https://prenota.example.test/centro");
  expect(handoff.practice?.nameIt).toBe("ISEE ordinario");
  expect(handoff.practice?.name).not.toBe("ISEE ordinario");
  expect(handoff.items.length).toBeGreaterThan(2);
  const required = handoff.items.map((item) => item.required);
  expect(required).toEqual([...required].sort((a, b) => Number(b) - Number(a)));
  for (const item of handoff.items) {
    expect(item.title).not.toBe(item.titleIt);
    expect(item.status).toBe("missing");
  }
  // The citizen's own list names the bank; what leaves through WhatsApp does not.
  const balance = handoff.items.find((item) => item.titleIt.includes("Banca Segreta"));
  expect(balance).toBeDefined();
  expect(balance!.genericTitle).not.toContain("Banca Segreta");
  expect(balance!.genericTitleIt).not.toContain("Banca Segreta");
  expect(handoff.items.some((item) => item.memberName === "Yusuf")).toBe(true);
});

it("leaves out what is done and keeps the desk's reason for a rejection", async () => {
  const id = await fixture("it");
  const before = CitizenHandoff.parse(await (await get(id)).json());
  const [first, second] = before.items;
  await db.insert(checklistReviews).values([
    {
      caseId: id,
      itemId: first!.id,
      decision: "rejected",
      note: "Serve il retro",
      operatorId: "a",
      reviewedAt: now.toISOString(),
    },
    {
      caseId: id,
      itemId: second!.id,
      decision: "waived",
      note: "Non serve",
      operatorId: "a",
      reviewedAt: now.toISOString(),
    },
  ]);
  const after = CitizenHandoff.parse(await (await get(id)).json());
  expect(after.items.map((item) => item.id)).not.toContain(second!.id);
  const rejected = after.items.find((item) => item.id === first!.id);
  expect(rejected).toMatchObject({ status: "rejected", note: "Serve il retro" });
  // Italian citizens get one language: both columns say the same.
  expect(rejected!.title).toBe(rejected!.titleIt);
});

it("names the documents of the case's own year, not the catalog default", async () => {
  const id = await fixture("ar", "needs_citizen", 2028);
  const handoff = CitizenHandoff.parse(await (await get(id)).json());
  const balance = handoff.items.find((item) => item.titleIt.includes("Banca Segreta"))!;
  expect(balance.genericTitleIt).toContain("31/12/2026");
  expect(balance.genericTitle).toContain("2026");
  expect(balance.genericTitle).not.toContain("2025");
});

it("carries the desk's latest request once, without the item list appended to it", async () => {
  const id = await fixture("ar", "in_review");
  const before = CitizenHandoff.parse(await (await get(id)).json());
  expect(before.request).toBeNull();
  const asked = await app.request(`/api/cases/${id}/requests`, {
    method: "POST",
    headers: { Cookie: cookies.a, Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({
      expectedUpdatedAt: now.toISOString(),
      checklistItemIds: before.items.slice(0, 2).map((item) => item.id),
      message: "Serve anche il retro.\nGrazie.",
    }),
  });
  expect(asked.status, await asked.text()).toBe(200);
  const after = CitizenHandoff.parse(await (await get(id)).json());
  // No AI key in tests: the citizen's line is the localized "read the Italian original"
  // notice, never the Italian passed off as a translation; the Italian follows it on paper.
  expect(after.request?.textIt).toBe("Serve anche il retro.\nGrazie.");
  expect(after.request?.text).toMatch(/[\u0600-\u06ff]/);
  expect(after.request?.text).not.toContain("Serve");
  expect(after.items.filter((item) => item.status === "rejected")).toHaveLength(2);
});

it("says when the interview is still open, so the list can still grow", async () => {
  const id = await fixture("ar", "intake");
  const handoff = CitizenHandoff.parse(await (await get(id)).json());
  expect(handoff.interviewComplete).toBe(false);
});

it("keeps other CAFs and signed-out visitors out", async () => {
  const id = await fixture();
  expect((await get(id, cookies.b)).status).toBe(404);
  expect((await app.request(`/api/cases/${id}/citizen-handoff`)).status).toBe(401);
  expect((await record(id, { channel: "print" }, cookies.b)).status).toBe(404);
  const missing = await get("does-not-exist");
  expect(ApiError.parse(await missing.json()).error.code).toBe("not_found");
});

it("records the channel in the timeline, never the text, without touching the case", async () => {
  const id = await fixture();
  const [before] = await db.select().from(cases).where(eq(cases.id, id));
  for (const channel of ["whatsapp", "sms", "copy", "print"])
    expect((await record(id, { channel })).status).toBe(204);
  const rows = await db.select().from(events).where(eq(events.caseId, id));
  expect(rows.map((row) => row.type).sort()).toEqual([
    "citizen.checklist_printed",
    "citizen.notice_copied",
    "citizen.notice_sms",
    "citizen.notice_whatsapp",
  ]);
  expect(rows.every((row) => Object.keys(row.metadata).length === 0)).toBe(true);
  const [after] = await db.select().from(cases).where(eq(cases.id, id));
  // A colleague's open dossier must not turn stale because someone sent a WhatsApp.
  expect(after!.updatedAt).toBe(before!.updatedAt);

  const dossier = CaseDossier.parse(
    await (await app.request(`/api/cases/${id}`, { headers: { Cookie: cookies.a } })).json(),
  );
  expect(dossier.timeline.map((event) => event.label)).toEqual(
    expect.arrayContaining([
      "Avviso al cittadino preparato su WhatsApp",
      "Elenco dei documenti stampato per il cittadino",
    ]),
  );
  // Printing puts personal data on paper: the manager finds it in the activity log.
  const audit = AuditPage.parse(
    await (
      await app.request("/api/audit?action=citizen.checklist_printed", {
        headers: { Cookie: cookies.a },
      })
    ).json(),
  );
  expect(audit.items.some((event) => event.case?.reference === before!.reference)).toBe(true);
  expect(JSON.stringify(logs)).not.toContain("Amina");
});

it("rejects unknown channels and extra fields", async () => {
  const id = await fixture();
  expect((await record(id, { channel: "email" })).status).toBe(400);
  expect((await record(id, { channel: "sms", text: "ciao" })).status).toBe(400);
  const rows = await db
    .select()
    .from(events)
    .where(and(eq(events.caseId, id), eq(events.actor, "operator")));
  expect(rows).toHaveLength(0);
});
