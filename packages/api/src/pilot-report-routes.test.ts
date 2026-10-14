import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { PilotReport } from "@avanti/contracts";
import {
  createDatabase,
  cases,
  events,
  offices,
  operators,
  organizations,
  rateLimits,
  sessions,
  type Database,
} from "@avanti/db";
import { createApp } from "./app";
import { MemoryStorage } from "./storage";
import { hashToken, newToken } from "./security";
import { PDFDocument } from "pdf-lib";

let db: Database;
let close: () => Promise<void>;
let app: ReturnType<typeof createApp>;
let admin: string;
let normal: string;
const now = new Date("2027-02-01T10:00:00Z");
const url = "/api/reports/pilot?from=2027-01-01&to=2027-01-31";
function request(path = url, cookie = admin) {
  return app.request(path, { headers: { Cookie: cookie } });
}
beforeAll(async () => {
  ({ db, close } = await createDatabase({ memory: true }));
});
afterAll(async () => close());
beforeEach(async () => {
  await db.delete(events);
  await db.delete(cases);
  await db.delete(rateLimits);
  await db.delete(organizations);
  for (const id of ["a", "b"]) {
    await db.insert(organizations).values({ id, name: `CAF ${id}`, kind: "caf" });
    await db.insert(offices).values({
      id: `office-${id}`,
      organizationId: id,
      slug: id,
      name: id === "a" ? "مكتب المساعدة" : "Foreign office",
      city: "Test",
      address: "Test",
    });
  }
  for (const [id, role] of [
    ["admin", "admin"],
    ["normal", "operator"],
  ] as const) {
    await db.insert(operators).values({
      id,
      organizationId: "a",
      name: "PRIVATE OPERATOR NAME",
      email: `${id}@example.test`,
      passwordHash: "not-used",
      role,
    });
    const token = newToken();
    await db.insert(sessions).values({
      id,
      operatorId: id,
      tokenHash: hashToken(token),
      createdAt: now.toISOString(),
      expiresAt: "2027-02-01T11:00:00Z",
    });
    if (id === "admin") admin = `avanti_session=${token}`;
    else normal = `avanti_session=${token}`;
  }
  for (const id of ["a", "b"])
    await db.insert(cases).values({
      id: `private-case-${id}`,
      organizationId: id,
      officeId: `office-${id}`,
      tokenHash: hashToken(newToken()),
      reference: `PRIVATE-REFERENCE-${id}`,
      language: "it",
      practiceId: "isee_ordinario",
      contact: { firstName: "PRIVATE CITIZEN" },
      answers: { story: "PRIVATE STORY" },
      createdAt: "2027-01-05T10:00:00Z",
      updatedAt: "2027-01-05T10:00:00Z",
      expiresAt: "2027-04-01T10:00:00Z",
    });
  app = createApp({ db, storage: new MemoryStorage(), clock: () => now });
});
it("requires an authenticated active admin and rejects another CAF's office without an export", async () => {
  expect((await request(url, "")).status).toBe(401);
  expect((await request(url, normal)).status).toBe(403);
  expect((await request(`${url}&office=office-b`)).status).toBe(404);
  expect((await request(`${url}&office=missing`)).status).toBe(404);
  await db.update(operators).set({ active: false }).where(eq(operators.id, "admin"));
  expect((await request()).status).toBe(401);
  expect(
    await db.select().from(events).where(eq(events.type, "pilot_report.exported")),
  ).toHaveLength(0);
});
it("validates dates, format and all query keys using the contract", async () => {
  for (const path of [
    "/api/reports/pilot",
    "/api/reports/pilot?from=2027-02-30&to=2027-03-01",
    "/api/reports/pilot?from=2027-01-01&to=2028-01-01",
    `${url}&format=html`,
    `${url}&officeId=office-b`,
  ])
    expect((await request(path)).status).toBe(400);
  expect(
    await db.select().from(events).where(eq(events.type, "pilot_report.exported")),
  ).toHaveLength(0);
});
it("exports the same masked report in JSON/CSV/Unicode PDF and audits every access without personal metadata", async () => {
  for (const format of ["json", "csv", "pdf"]) {
    const response = await request(`${url}&office=office-a&format=${format}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Content-Disposition")).toContain(`.${format}`);
    if (format === "pdf") {
      expect(response.headers.get("Content-Type")).toBe("application/pdf");
      expect((await PDFDocument.load(await response.arrayBuffer())).getPageCount()).toBeGreaterThan(
        0,
      );
    } else {
      const text = await response.text();
      expect(text).not.toMatch(
        /PRIVATE|private-case|office-b|Foreign office|passwordHash|tokenHash/,
      );
      expect(text).toContain("<5");
      if (format === "json") {
        const report = PilotReport.parse(JSON.parse(text));
        expect(report.offices).toHaveLength(1);
        expect(report.offices[0]!.office?.id).toBe("office-a");
        expect(report.baseline.manualMinutesPerCase).toBeNull();
      }
    }
  }
  await request(); // Repeated JSON also audited.
  const records = await db.select().from(events).where(eq(events.type, "pilot_report.exported"));
  expect(records).toHaveLength(4);
  expect(
    records.every((r) => r.organizationId === "a" && r.actorId === "admin" && r.caseId === null),
  ).toBe(true);
  expect(records.map((r) => r.metadata)).toEqual([
    { reportJson: true, reportCsv: false, reportPdf: false },
    { reportJson: false, reportCsv: true, reportPdf: false },
    { reportJson: false, reportCsv: false, reportPdf: true },
    { reportJson: true, reportCsv: false, reportPdf: false },
  ]);
  const audit = (await (
    await app.request("/api/audit?action=pilot_report.exported", { headers: { Cookie: admin } })
  ).json()) as { items: { label: string }[] };
  expect(audit.items.every((r) => r.label === "Rapporto del pilota esportato")).toBe(true);
});
it("shares the existing operator export rate limit", async () => {
  for (let i = 0; i < 20; i++) expect((await request()).status).toBe(200);
  const limited = await request();
  expect(limited.status).toBe(429);
  expect(limited.headers.get("Retry-After")).toBe("60");
  expect(
    await db.select().from(events).where(eq(events.type, "pilot_report.exported")),
  ).toHaveLength(20);
});
