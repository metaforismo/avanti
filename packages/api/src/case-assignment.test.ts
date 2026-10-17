import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { AssignCasesResponse, CaseListResponse, type AssignCasesRequest } from "@avanti/contracts";
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
import { hashToken } from "./security";
import { MemoryStorage } from "./storage";

// Tuesday 19 January 2027, 16:00 in Rome: the overdue cutoff is Friday 15 at 16:00.
const now = new Date("2027-01-19T15:00:00.000Z");
const version = "2027-01-18T09:00:00.000Z";
const adminToken = "a".repeat(43);
const operatorToken = "o".repeat(43);
const otherAdminToken = "x".repeat(43);

let db: Database;
let close: () => Promise<void>;
beforeAll(async () => {
  ({ db, close } = await createDatabase({ memory: true }));
});
afterAll(async () => close());

function caseRow(id: string, organizationId: string, submittedAt: string | null, extra = {}) {
  return {
    id,
    organizationId,
    officeId: organizationId === "org" ? "office" : "other-office",
    reference: `AV-2027-${id.toUpperCase()}`,
    tokenHash: hashToken(id),
    language: "it" as const,
    practiceId: "isee_ordinario" as const,
    status: (submittedAt ? "submitted" : "intake") as "submitted" | "intake",
    contact: { firstName: "Persona", lastName: "Esempio" },
    createdAt: "2027-01-10T09:00:00.000Z",
    updatedAt: version,
    submittedAt,
    expiresAt: "2027-04-01T00:00:00.000Z",
    ...extra,
  };
}

beforeEach(async () => {
  await db.delete(organizations);
  await db.delete(rateLimits);
  await db.insert(organizations).values([
    { id: "org", name: "CAF", kind: "caf" },
    { id: "other", name: "Altro CAF", kind: "caf" },
  ]);
  await db.insert(offices).values([
    {
      id: "office",
      organizationId: "org",
      name: "Sede",
      slug: "sede",
      address: "Via",
      city: "Roma",
    },
    {
      id: "other-office",
      organizationId: "other",
      name: "Altra",
      slug: "altra",
      address: "Via",
      city: "Milano",
    },
  ]);
  const operator = (
    id: string,
    organizationId: string,
    role: "admin" | "operator",
    active = true,
  ) => ({
    id,
    organizationId,
    name: `Nome ${id}`,
    email: `${id}@example.test`,
    passwordHash: "unused",
    role,
    active,
  });
  await db
    .insert(operators)
    .values([
      operator("admin", "org", "admin"),
      operator("maria", "org", "operator"),
      operator("former", "org", "operator", false),
      operator("other-admin", "other", "admin"),
      operator("other-op", "other", "operator"),
    ]);
  await db.insert(sessions).values(
    [
      ["admin", adminToken],
      ["maria", operatorToken],
      ["other-admin", otherAdminToken],
    ].map(([operatorId, token]) => ({
      id: `${operatorId}-session`,
      operatorId: operatorId!,
      tokenHash: hashToken(token!),
      createdAt: now.toISOString(),
      expiresAt: "2027-01-19T20:00:00.000Z",
    })),
  );
  await db.insert(cases).values([
    // Friday 15 January 08:00 Rome: more than two working days ago.
    caseRow("old", "org", "2027-01-15T07:00:00.000Z"),
    // Monday 18 January: one working day.
    caseRow("fresh", "org", "2027-01-18T08:00:00.000Z"),
    // Old but already taken: not waiting.
    caseRow("taken", "org", "2027-01-11T08:00:00.000Z", { assigneeId: "maria" }),
    caseRow("draft", "org", null),
    caseRow("foreign", "other", "2027-01-11T08:00:00.000Z"),
  ]);
});

function client() {
  const app = createApp({ db, storage: new MemoryStorage(), clock: () => now });
  return (path: string, token: string, input?: unknown) =>
    app.request(`/api${path}`, {
      method: input === undefined ? "GET" : "POST",
      headers: {
        Origin: "http://localhost:3400",
        Cookie: `avanti_session=${token}`,
        "Content-Type": "application/json",
      },
      body: input === undefined ? undefined : JSON.stringify(input),
    });
}

const assignment = (
  assigneeId: string | null,
  ids: string[],
  at = version,
): AssignCasesRequest => ({
  assigneeId,
  cases: ids.map((id) => ({ id, expectedUpdatedAt: at })),
});

async function stored(ids: string[]) {
  const rows = await db.select().from(cases).where(inArray(cases.id, ids));
  return Object.fromEntries(rows.map((row) => [row.id, row]));
}

describe("POST /cases/assign", () => {
  it("assigns several cases in one go, bumps their version and audits each without personal data", async () => {
    const request = client();
    const response = await request(
      "/cases/assign",
      adminToken,
      assignment("maria", ["old", "fresh"]),
    );
    expect(response.status).toBe(200);
    const body = AssignCasesResponse.parse(await response.json());
    expect(body.assignee).toEqual({ id: "maria", name: "Nome maria" });
    expect(body.results.map((r) => [r.id, r.outcome])).toEqual([
      ["old", "assigned"],
      ["fresh", "assigned"],
    ]);
    const rows = await stored(["old", "fresh"]);
    expect(rows.old!.assigneeId).toBe("maria");
    expect(rows.fresh!.assigneeId).toBe("maria");
    expect(Date.parse(rows.old!.updatedAt)).toBe(now.getTime());
    expect(body.results[0]!.updatedAt).toBe(now.toISOString());
    const audit = await db.select().from(events).where(eq(events.type, "case.assigned"));
    expect(audit.map((e) => e.caseId).sort()).toEqual(["fresh", "old"]);
    for (const event of audit) {
      expect(event).toMatchObject({ actor: "operator", actorId: "admin", organizationId: "org" });
      expect(event.metadata).toEqual({ bulk: true });
      expect(JSON.stringify(event)).not.toMatch(/Persona|Esempio|Nome maria/);
    }
  });

  it("removes the assignment with null and reports cases already in the requested state", async () => {
    const request = client();
    const response = await request("/cases/assign", adminToken, assignment(null, ["taken", "old"]));
    const body = AssignCasesResponse.parse(await response.json());
    expect(body.assignee).toBeNull();
    expect(body.results.map((r) => r.outcome)).toEqual(["assigned", "unchanged"]);
    expect((await stored(["taken"])).taken!.assigneeId).toBeNull();
    const audit = await db.select().from(events).where(eq(events.type, "case.assigned"));
    expect(audit.map((e) => e.caseId)).toEqual(["taken"]);
  });

  it("leaves a case changed since the queue was read untouched and assigns the rest", async () => {
    await db
      .update(cases)
      .set({ updatedAt: "2027-01-19T14:00:00.000Z" })
      .where(eq(cases.id, "fresh"));
    const request = client();
    const body = AssignCasesResponse.parse(
      await (
        await request("/cases/assign", adminToken, assignment("maria", ["fresh", "old"]))
      ).json(),
    );
    expect(body.results).toEqual([
      { id: "fresh", outcome: "conflict", updatedAt: "2027-01-19T14:00:00.000Z" },
      { id: "old", outcome: "assigned", updatedAt: now.toISOString() },
    ]);
    const rows = await stored(["fresh", "old"]);
    expect(rows.fresh!.assigneeId).toBeNull();
    expect(rows.old!.assigneeId).toBe("maria");
  });

  it("does not overwrite a colleague who took the case meanwhile", async () => {
    const request = client();
    // The operator takes the case through the existing PATCH, which advances its version.
    const patch = await createApp({ db, storage: new MemoryStorage(), clock: () => now }).request(
      "/api/cases/old",
      {
        method: "PATCH",
        headers: {
          Origin: "http://localhost:3400",
          Cookie: `avanti_session=${operatorToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ assigneeId: "maria", expectedUpdatedAt: version }),
      },
    );
    expect(patch.status).toBe(200);
    const body = AssignCasesResponse.parse(
      await (await request("/cases/assign", adminToken, assignment(null, ["old"]))).json(),
    );
    expect(body.results[0]!.outcome).toBe("conflict");
    expect((await stored(["old"])).old!.assigneeId).toBe("maria");
  });

  it("reports cases of another CAF exactly like missing ones and never touches them", async () => {
    const request = client();
    const body = AssignCasesResponse.parse(
      await (
        await request("/cases/assign", adminToken, assignment("maria", ["foreign", "ghost", "old"]))
      ).json(),
    );
    expect(body.results).toEqual([
      { id: "foreign", outcome: "not_found", updatedAt: null },
      { id: "ghost", outcome: "not_found", updatedAt: null },
      { id: "old", outcome: "assigned", updatedAt: now.toISOString() },
    ]);
    expect((await stored(["foreign"])).foreign!.assigneeId).toBeNull();
  });

  it("is reserved to admins: an operator cannot assign, not even to themselves", async () => {
    const request = client();
    const response = await request("/cases/assign", operatorToken, assignment("maria", ["old"]));
    expect(response.status).toBe(403);
    expect((await response.json()) as unknown).toMatchObject({ error: { code: "forbidden" } });
    expect((await stored(["old"])).old!.assigneeId).toBeNull();
  });

  it("rechecks the role from the database: a demoted admin is refused", async () => {
    const request = client();
    await db.update(operators).set({ role: "operator" }).where(eq(operators.id, "admin"));
    const response = await request("/cases/assign", adminToken, assignment("maria", ["old"]));
    expect(response.status).toBe(403);
  });

  it("refuses a deactivated operator or one of another CAF, assigning nothing", async () => {
    const request = client();
    const inactive = await request("/cases/assign", adminToken, assignment("former", ["old"]));
    expect(inactive.status).toBe(409);
    expect(((await inactive.json()) as { error: { message: string } }).error.message).toMatch(
      /non è più attivo/,
    );
    const foreign = await request("/cases/assign", adminToken, assignment("other-op", ["old"]));
    expect(foreign.status).toBe(404);
    expect((await stored(["old"])).old!.assigneeId).toBeNull();
    expect(await db.select().from(events).where(eq(events.type, "case.assigned"))).toEqual([]);
  });

  it("keeps each CAF isolated: another admin cannot assign this CAF's cases", async () => {
    const request = client();
    const body = AssignCasesResponse.parse(
      await (
        await request("/cases/assign", otherAdminToken, assignment("other-op", ["old"]))
      ).json(),
    );
    expect(body.results[0]!.outcome).toBe("not_found");
    expect((await stored(["old"])).old!.assigneeId).toBeNull();
  });

  it("accepts at most 100 distinct cases with their versions", async () => {
    const request = client();
    const ids = Array.from({ length: 101 }, (_, i) => `case-${i}`);
    expect((await request("/cases/assign", adminToken, assignment("maria", ids))).status).toBe(400);
    const hundred = await request(
      "/cases/assign",
      adminToken,
      assignment("maria", ids.slice(0, 100)),
    );
    expect(hundred.status).toBe(200);
    expect(AssignCasesResponse.parse(await hundred.json()).results).toHaveLength(100);
    for (const input of [
      assignment("maria", ["old", "old"]),
      assignment("maria", []),
      { assigneeId: "maria", cases: [{ id: "old" }] },
      { ...assignment("maria", ["old"]), extra: true },
    ])
      expect((await request("/cases/assign", adminToken, input)).status).toBe(400);
  });

  it("is rate limited per admin", async () => {
    const request = client();
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++)
      statuses.push(
        (await request("/cases/assign", adminToken, assignment(null, ["draft"]))).status,
      );
    expect(statuses.slice(0, 20).every((status) => status === 200)).toBe(true);
    expect(statuses[20]).toBe(429);
  });
});

describe("waiting in the queue", () => {
  it("marks submitted unassigned cases with days and the working-day threshold", async () => {
    const request = client();
    const body = CaseListResponse.parse(
      await (await request("/cases?status=submitted", adminToken)).json(),
    );
    const byId = Object.fromEntries(body.items.map((item) => [item.id, item.waiting]));
    expect(byId.old).toEqual({ since: "2027-01-15T07:00:00.000Z", days: 4, overdue: true });
    expect(byId.fresh).toEqual({ since: "2027-01-18T08:00:00.000Z", days: 1, overdue: false });
    expect(byId.taken).toBeNull();
    expect(body.waitingOverdue).toBe(1);
  });

  it("sorts by first submission, oldest first, across pages", async () => {
    await db
      .insert(cases)
      .values([
        caseRow("tie-b", "org", "2027-01-12T08:00:00.000Z"),
        caseRow("tie-a", "org", "2027-01-12T08:00:00.000Z"),
      ]);
    const request = client();
    const seen: string[] = [];
    let cursor: string | null = "";
    while (cursor !== null) {
      const path = `/cases?status=submitted&sort=waiting&limit=2${cursor ? `&cursor=${cursor}` : ""}`;
      const page = CaseListResponse.parse(await (await request(path, adminToken)).json());
      seen.push(...page.items.map((item) => item.id));
      cursor = page.nextCursor;
    }
    expect(seen).toEqual(["taken", "tie-a", "tie-b", "old", "fresh"]);
    // Never-submitted cases come last when the sort is used outside the submitted tab.
    const all: string[] = [];
    cursor = "";
    while (cursor !== null) {
      const path = `/cases?sort=waiting&limit=3${cursor ? `&cursor=${cursor}` : ""}`;
      const page = CaseListResponse.parse(await (await request(path, adminToken)).json());
      all.push(...page.items.map((item) => item.id));
      cursor = page.nextCursor;
    }
    expect(all.at(-1)).toBe("draft");
    expect(all).toHaveLength(6);
  });

  it("rejects a cursor from the other ordering", async () => {
    const request = client();
    const page = CaseListResponse.parse(
      await (await request("/cases?status=submitted&limit=1", adminToken)).json(),
    );
    const response = await request(
      `/cases?status=submitted&sort=waiting&cursor=${page.nextCursor}`,
      adminToken,
    );
    expect(response.status).toBe(400);
  });
});
