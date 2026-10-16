import { expect, it } from "vitest";
import {
  createDatabase,
  cases,
  nearReadyEvaluations,
  nearReadyEvents,
  offices,
  organizations,
} from "@avanti/db";
import { nearReadyPilot } from "./near-ready-metrics";

it("aggregates the first screening per case within the CAF without binding every historical evaluation id", async () => {
  const queries: { query: string; params: unknown[] }[] = [];
  const { db, close } = await createDatabase({
    memory: true,
    logger: {
      logQuery(query, params) {
        queries.push({ query, params });
      },
    },
  });
  try {
    for (const org of ["mine", "foreign"]) {
      await db.insert(organizations).values({ id: org, name: "Sintetico", kind: "caf" });
      await db.insert(offices).values({
        id: org,
        organizationId: org,
        slug: org,
        name: "Sede",
        address: "Esempio",
        city: "Roma",
      });
      await db.insert(cases).values({
        id: org,
        organizationId: org,
        officeId: org,
        reference: org,
        tokenHash: org,
        language: "it",
        status: "submitted",
        createdAt: "2027-01-01T00:00:00Z",
        updatedAt: "2027-01-01T00:00:00Z",
        expiresAt: "2028-01-01T00:00:00Z",
      });
      for (let n = 0; n < 30; n++) {
        const at = new Date(Date.parse("2027-01-01T00:00:00Z") + n * 1000).toISOString();
        const id = `${org}-${n}`;
        await db.insert(nearReadyEvaluations).values({
          id,
          caseId: org,
          caseVersion: at,
          currentVersion: at,
          checkedAt: at,
          eligible: true,
          mode: "shadow",
          state: "shadow",
          language: "it",
          reading: "ai",
          snapshot: {
            configurationKey: "synthetic",
            validUntil: "2028-01-01T00:00:00Z",
            rulesVersion: "synthetic",
            catalogVersion: "synthetic",
            schemaVersion: "1",
            conditions: { active: true },
            criticalThreshold: 0.98,
            otherThreshold: 0.95,
            fields: [],
            exclusions: [],
            tasks: [],
            durationMs: 1,
          },
        });
        await db.insert(nearReadyEvents).values({
          id,
          evaluationId: id,
          action: "final_decision",
          actor: "system",
          at,
          caseVersion: at,
          ready: org === "foreign" || n > 0,
          durationMinutes: 3,
        });
      }
    }
    queries.length = 0;
    const report = await nearReadyPilot(db, "mine", "synthetic");
    expect(report.total).toMatchObject({
      evaluated: 1,
      selected: 1,
      reviewedSelected: 1,
      correctSelected: 0,
      falseNearReady: 1,
      precision: 0,
      criticalErrors: 0,
    });
    const historyQuery = queries.find((q) => q.query.includes('from "near_ready_events"'));
    expect(historyQuery).toBeDefined();
    // The report may accumulate many versions: Postgres' bind limit must not depend on that count.
    expect(historyQuery!.params.length).toBeLessThanOrEqual(2);
  } finally {
    await close();
  }
});
