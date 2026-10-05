import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { CitizenCase, StartIntakeResponse } from "@avanti/contracts";
import { cases, createDatabase, messages, offices, organizations, type Database } from "@avanti/db";
import { createApp } from "./app";
import { GatewayIntelligence, type IntakeProposal } from "./ai";
import { MemoryStorage } from "./storage";
import { calculateMetrics, metricsRange } from "./operator-metrics";
import type { CaseRow } from "./dossier";

const now = new Date("2027-01-05T10:00:00.000Z");
const exampleCase: CaseRow = {
  id: "case-example",
  organizationId: "organization-example",
  officeId: "office-example",
  tokenHash: "example-hash",
  reference: "AV-2027-000001",
  language: "it",
  practiceId: "isee_ordinario",
  status: "ready",
  answers: {},
  confirmedAnswers: [],
  contact: null,
  citizenNote: null,
  internalNotes: null,
  assigneeId: null,
  createdAt: "2027-01-01T10:00:00.000Z",
  updatedAt: "2027-01-08T12:00:00.000Z",
  submittedAt: "2027-01-05T10:10:00.000Z",
  reviewStartedAt: "2027-01-05T10:10:00.000Z",
  reviewCompletedAt: "2027-01-08T12:00:00.000Z",
  expiresAt: "2027-03-01T00:00:00.000Z",
  firstSubmissionComplete: false,
};

describe("metrics over historical review events", () => {
  it("uses the completion in the requested period after a later reopened review", () => {
    const metrics = calculateMetrics(
      "2027-01-05",
      "2027-01-05",
      [exampleCase],
      [
        {
          caseId: exampleCase.id,
          type: "review.completed",
          at: "2027-01-05T10:20:00.000Z",
          metadata: {},
        },
        {
          caseId: exampleCase.id,
          type: "review.completed",
          at: "2027-01-08T12:00:00.000Z",
          metadata: { durationMinutes: 40 },
        },
        {
          caseId: exampleCase.id,
          type: "citizen.requested",
          at: "2027-01-07T12:00:00.000Z",
          metadata: {},
        },
      ],
      null,
    );
    expect(metrics.casesReady).toBe(1);
    expect(metrics.avgReviewMinutes).toBe(10);
    expect(metrics.needsCitizenRate).toBe(0);
    expect(metrics.casesStarted).toBe(0);
    expect(metrics.casesSubmitted).toBe(1);
  });

  it("counts each ready case once and uses its last completion within the period", () => {
    const metrics = calculateMetrics(
      "2027-01-05",
      "2027-01-05",
      [exampleCase],
      [
        {
          caseId: exampleCase.id,
          type: "review.completed",
          at: "2027-01-05T10:20:00.000Z",
          metadata: { durationMinutes: 10 },
        },
        {
          caseId: exampleCase.id,
          type: "review.completed",
          at: "2027-01-05T10:40:00.000Z",
          metadata: { durationMinutes: 30 },
        },
      ],
      30,
    );
    expect(metrics.casesReady).toBe(1);
    expect(metrics.avgReviewMinutes).toBe(30);
    expect(metrics.baselineMinutesPerCase).toBe(30);
  });

  it("rejects invalid calendar dates and oversized intervals, including leap-year edges", () => {
    expect(() => metricsRange("2027-02-29", "2027-03-01")).toThrow();
    expect(() => metricsRange("2027-01-02", "2027-01-01")).toThrow();
    expect(() => metricsRange("2028-01-01", "2029-01-01")).toThrow();
    expect(metricsRange("2028-01-01", "2028-12-31").end.toISOString()).toBe(
      "2028-12-31T23:00:00.000Z",
    );
    expect(calculateMetrics("2027-01-01", "2027-01-01", [], [], null).avgReviewMinutes).toBeNull();
  });
});

describe("concurrent intake proposals", () => {
  let db: Database;
  let closeDatabase: () => Promise<void>;
  beforeAll(async () => {
    const database = await createDatabase({ memory: true });
    db = database.db;
    closeDatabase = database.close;
    await db.insert(organizations).values({ id: "org-routes", name: "CAF Esempio", kind: "caf" });
    await db.insert(offices).values({
      id: "office-routes",
      organizationId: "org-routes",
      slug: "routes",
      name: "Sede Esempio",
      address: "Via Esempio 1",
      city: "Milano",
    });
  }, 20_000);
  afterAll(async () => closeDatabase?.());

  it("rejects a stale AI proposal instead of overwriting a newer explicit answer", async () => {
    let resolveProposal: (proposal: IntakeProposal) => void = () => {
      throw new Error("Proposal not initialized");
    };
    let markStarted: () => void = () => {
      throw new Error("Signal not initialized");
    };
    const proposalStarted = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const proposalPending = new Promise<IntakeProposal>((resolve) => {
      resolveProposal = resolve;
    });
    const ai = new GatewayIntelligence();
    ai.intake = async () => {
      markStarted();
      return proposalPending;
    };
    const app = createApp({ db, ai, storage: new MemoryStorage(), clock: () => new Date(now) });
    const post = (path: string, input: unknown) =>
      app.request(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
    const intake = StartIntakeResponse.parse(
      await (
        await post("/api/intake", {
          officeSlug: "routes",
          practiceId: "isee_ordinario",
          privacyAccepted: true,
        })
      ).json(),
    );
    const staleTurn = post(`/api/c/${intake.token}/turn`, { type: "text", text: "Ho due conti" });
    await proposalStarted;
    const answered = await post(`/api/c/${intake.token}/turn`, {
      type: "answer",
      questionId: "accounts_count",
      value: 3,
    });
    expect(answered.status).toBe(200);
    resolveProposal({
      practiceId: "isee_ordinario",
      confidence: 0.9,
      answers: { accounts_count: 2 },
      reply: "Ho aggiornato i dati.",
      engine: "ai",
    });
    expect((await staleTurn).status).toBe(409);
    const current = CitizenCase.parse(await (await app.request(`/api/c/${intake.token}`)).json());
    expect(current.answers.accounts_count).toBe(3);
    const chat = await db.select().from(messages).where(eq(messages.caseId, intake.case.id));
    expect(chat.filter((message) => message.role !== "system")).toHaveLength(0);
    const [stored] = await db.select().from(cases).where(eq(cases.id, intake.case.id));
    expect(stored?.answers.accounts_count).toBe(3);
  });
});

describe("6: Rome calendar metrics and unit shares", () => {
  it("uses local midnight through summer/winter changes", () => {
    expect(metricsRange("2027-03-28", "2027-03-28").start.toISOString()).toBe(
      "2027-03-27T23:00:00.000Z",
    );
    expect(metricsRange("2027-03-28", "2027-03-28").end.toISOString()).toBe(
      "2027-03-28T22:00:00.000Z",
    );
    expect(metricsRange("2027-10-31", "2027-10-31").end.toISOString()).toBe(
      "2027-10-31T23:00:00.000Z",
    );
  });
  it("buckets late UTC submissions on the Rome day and returns 0–1 shares", () => {
    const row = {
      ...exampleCase,
      createdAt: "2027-01-04T23:30:00Z",
      submittedAt: "2027-01-04T23:40:00Z",
      firstSubmissionComplete: true,
    };
    const metrics = calculateMetrics(
      "2027-01-05",
      "2027-01-05",
      [row],
      [{ caseId: row.id, type: "case.requested", at: "2027-01-05T10:00:00Z", metadata: {} }],
      null,
    );
    expect(metrics.casesStarted).toBe(1);
    expect(metrics.completeAtFirstSubmission).toBe(1);
    expect(metrics.needsCitizenRate).toBe(1);
    expect(metrics.daily).toEqual([{ date: "2027-01-05", started: 1, submitted: 1 }]);
  });
});
