import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildHousehold, buildChecklist, evaluateDossier, getQuestions } from "@avanti/core";
import { eq } from "drizzle-orm";
import { expect, it, vi } from "vitest";
import { createDatabase } from "./client";
import { seedDemo } from "./demo";
import {
  cases,
  documents,
  events,
  operators,
  organizations,
  messages,
  quickReplies,
} from "./schema";

it("seed is idempotent, creates safe PDFs, and preserves operator edits", async () => {
  const { db, close } = await createDatabase({ memory: true });
  const uploadsDir = await mkdtemp(join(tmpdir(), "avanti-demo-"));
  try {
    const options = { now: new Date("2027-01-15T10:00:00Z"), uploadsDir };
    expect(await seedDemo(db, options)).toEqual({ created: 10 });
    expect(await db.select().from(quickReplies)).toHaveLength(5);
    await db
      .update(quickReplies)
      .set({ text: "Testo modificato" })
      .where(eq(quickReplies.id, "demo-quick-reply-1"));
    const before = await db.select().from(operators);
    expect(before).toHaveLength(3);
    expect(before.find((row) => row.id === "demo-admin")).toMatchObject({
      active: true,
      mustChangePassword: false,
    });
    expect(before.find((row) => row.id === "demo-inactive-operator")).toMatchObject({
      active: false,
      mustChangePassword: false,
    });
    await db
      .update(cases)
      .set({ internalNotes: "Nota modificata" })
      .where(eq(cases.id, "demo-case-1"));
    expect(await seedDemo(db, options)).toEqual({ created: 0 });
    expect(await db.select().from(quickReplies)).toHaveLength(5);
    expect(
      (await db.select().from(quickReplies).where(eq(quickReplies.id, "demo-quick-reply-1")))[0]
        ?.text,
    ).toBe("Testo modificato");
    const seededCases = await db.select().from(cases);
    expect(seededCases).toHaveLength(10);
    const seededDocuments = await db.select().from(documents);
    for (const row of seededCases) {
      const household = buildHousehold(row.answers);
      expect(household).toHaveLength(2);
      const unanswered = getQuestions("isee_ordinario", row.answers, "it").filter(
        (question) => !Object.hasOwn(row.answers, question.id),
      );
      expect(unanswered.map((question) => question.id)).toEqual([]);
      const checklist = buildChecklist("isee_ordinario", row.answers, household, "it");
      const linkedDocuments = seededDocuments.filter((document) => document.caseId === row.id);
      const result = evaluateDossier({
        practiceId: row.practiceId,
        answers: row.answers,
        household,
        checklist,
        documents: linkedDocuments,
        language: "it",
        now: options.now,
        hashes: Object.fromEntries(
          linkedDocuments.map((document) => [document.id, document.sha256]),
        ),
      });
      if (row.submittedAt) {
        expect(row.firstSubmissionComplete).toBe(
          !result.findings.some((finding) => finding.severity === "blocker"),
        );
      }
      if (["ready", "closed"].includes(row.status)) {
        expect(result.progress.percent).toBe(100);
      }
    }
    const integrationMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.role, "operator"));
    expect(integrationMessages).toHaveLength(2);
    expect(await db.select().from(operators)).toEqual(before);
    const [edited] = await db.select().from(cases).where(eq(cases.id, "demo-case-1"));
    expect(edited?.internalNotes).toBe("Nota modificata");
    const [document] = await db.select().from(documents);
    expect(document).toBeDefined();
    const file = await readFile(join(uploadsDir, document!.storageKey));
    expect(file.subarray(0, 4).toString()).toBe("%PDF");
    expect(file.byteLength).toBe(document!.sizeBytes);
    const audit = await db.select().from(events);
    expect(
      audit.every(
        (event) =>
          event.caseReference === seededCases.find((row) => row.id === event.caseId)?.reference,
      ),
    ).toBe(true);
    expect(audit.filter((event) => event.type === "citizen.requested")).toHaveLength(2);
    expect(
      audit.every((event) =>
        Object.values(event.metadata).every(
          (value) => value === null || typeof value === "number" || typeof value === "boolean",
        ),
      ),
    ).toBe(true);
  } finally {
    await close();
    await rm(uploadsDir, { recursive: true, force: true });
  }
});

it("refuses to seed a database containing another organization", async () => {
  const { db, close } = await createDatabase({ memory: true });
  try {
    await db
      .insert(organizations)
      .values({ id: "existing-caf", name: "Existing CAF", kind: "caf" });
    await expect(
      seedDemo(db, { now: new Date("2027-01-15T10:00:00Z"), uploadsDir: "/not-used" }),
    ).rejects.toThrow("empty database");
    expect(await db.select().from(organizations)).toHaveLength(1);
    expect(await db.select().from(operators)).toEqual([]);
  } finally {
    await close();
  }
});

it("refuses demo credentials in production before any database writes", async () => {
  const { db, close } = await createDatabase({ memory: true });
  try {
    vi.stubEnv("NODE_ENV", "production");
    await expect(
      seedDemo(db, { now: new Date("2027-01-15T10:00:00Z"), uploadsDir: "/not-used" }),
    ).rejects.toThrow("production");
    expect(await db.select().from(organizations)).toEqual([]);
  } finally {
    vi.unstubAllEnvs();
    await close();
  }
});
