import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  createDatabase,
  cases,
  nearReadyEvaluations,
  nearReadyEvents,
  nearReadyBlindReviews,
  operators,
  type Database,
  offices,
  organizations,
} from "@avanti/db";
import { CATALOG_VERSION, NEAR_READY_RULES_VERSION, NEAR_READY_SCHEMA_VERSION } from "@avanti/core";
import { nearReadyPilot } from "./near-ready-metrics";

const postgresUrl = process.env.AVANTI_TEST_DATABASE_URL;
if (
  postgresUrl &&
  (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(postgresUrl).hostname) ||
    !new URL(postgresUrl).pathname.endsWith("_test"))
)
  throw new Error("Metrics parity requires a disposable local *_test Postgres database");

for (const engine of ["pglite", "postgres"] as const) {
  it.skipIf(engine === "postgres" && !postgresUrl)(
    `${engine}: aggregates the first screening per case within the CAF without binding every historical evaluation id`,
    async () => {
      const queries: { query: string; params: unknown[] }[] = [];
      const { db, close } = await createDatabase({
        ...(engine === "pglite" ? { memory: true } : { url: postgresUrl, migrate: true }),
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
                rulesVersion: NEAR_READY_RULES_VERSION,
                catalogVersion: CATALOG_VERSION,
                schemaVersion: NEAR_READY_SCHEMA_VERSION,
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
        for (const org of ["mine", "foreign"])
          await db.delete(organizations).where(eq(organizations.id, org));
        await close();
      }
    },
  );
}

for (const engine of ["pglite", "postgres"] as const) {
  describe.skipIf(engine === "postgres" && !postgresUrl)(
    `${engine}: versioned near-ready truth`,
    () => {
      let db: Database, close: () => Promise<void>, id: string;
      const version = "2027-01-01T00:00:00.000Z";
      const later = "2027-01-02T00:00:00.000Z";
      beforeAll(async () => {
        ({ db, close } = await createDatabase(
          engine === "pglite" ? { memory: true } : { url: postgresUrl, migrate: true },
        ));
      });
      afterAll(async () => close?.());
      beforeEach(async () => {
        id = crypto.randomUUID();
        await db.insert(organizations).values({ id, name: "Sintetico", kind: "caf" });
        await db.insert(offices).values({
          id,
          organizationId: id,
          slug: id,
          name: "Sede",
          address: "Esempio",
          city: "Roma",
        });
        await db.insert(operators).values(
          [0, 1].map((n) => ({
            id: `${id}-${n}`,
            organizationId: id,
            name: "Sintetico",
            email: `${id}-${n}@example.invalid`,
            passwordHash: "unused",
            role: "operator" as const,
          })),
        );
        await db.insert(cases).values({
          id,
          organizationId: id,
          officeId: id,
          reference: id,
          tokenHash: id,
          language: "it",
          status: "in_review",
          createdAt: version,
          updatedAt: version,
          expiresAt: later,
        });
      });
      afterEach(async () => {
        await db.delete(organizations).where(eq(organizations.id, id));
      });
      const evaluation = async (eligible = true) => {
        await db.insert(nearReadyEvaluations).values({
          id,
          caseId: id,
          caseVersion: version,
          currentVersion: version,
          checkedAt: version,
          eligible,
          mode: "shadow",
          state: "shadow",
          language: "it",
          reading: "ai",
          snapshot: {
            configurationKey: "synthetic",
            validUntil: later,
            rulesVersion: NEAR_READY_RULES_VERSION,
            catalogVersion: CATALOG_VERSION,
            schemaVersion: NEAR_READY_SCHEMA_VERSION,
            conditions: { active: true },
            criticalThreshold: 0.98,
            otherThreshold: 0.95,
            fields: [],
            exclusions: [],
            tasks: [],
            durationMs: 1,
          },
        });
      };
      const final = async (ready: boolean, caseVersion = version) => {
        await db.insert(nearReadyEvents).values({
          id: crypto.randomUUID(),
          evaluationId: id,
          action: "final_decision",
          actor: "system",
          at: later,
          caseVersion,
          ready,
          durationMinutes: 3,
        });
      };
      const blind = async (values: boolean[], caseVersion = version) => {
        for (const [n, ready] of values.entries())
          await db.insert(nearReadyBlindReviews).values({
            caseId: id,
            caseVersion,
            operatorId: `${id}-${n}`,
            ready,
            reason: "other",
            at: later,
          });
      };

      it.each([true, false])(
        "ignores historical final outcomes from a corrected dossier (selected: %s)",
        async (selected) => {
          await evaluation(selected);
          await db.update(cases).set({ updatedAt: later }).where(eq(cases.id, id));
          await final(true, later);
          await blind([true], later);
          const report = await nearReadyPilot(db, id, "synthetic");
          expect(report.total).toMatchObject({
            evaluated: 1,
            selected: selected ? 1 : 0,
            unjudged: 1,
            disagreements: 0,
            reviewedSelected: 0,
            correctSelected: 0,
            falseNearReady: 0,
            missedOpportunities: 0,
            precision: null,
            precisionInterval: null,
            suggestedReview: { count: 0, medianMinutes: null },
          });
          expect(report.groups).toEqual([{ ...report.total, language: "it", reading: "ai" }]);
          expect(report.calibration).toEqual(report.total);
          expect(report.calibrationPassed).toBe(false);
        },
      );
      it("distinguishes historical versions within the same millisecond", async () => {
        await evaluation();
        await final(true, "2027-01-01T00:00:00.000001Z");
        expect((await nearReadyPilot(db, id, "synthetic")).total).toMatchObject({
          unjudged: 1,
          reviewedSelected: 0,
          precision: null,
        });
      });
      it.each([true, false])(
        "keeps a blind negative despite a later ready outcome (selected: %s)",
        async (selected) => {
          await evaluation(selected);
          await blind([false]);
          await final(true, later);
          const report = await nearReadyPilot(db, id, "synthetic");
          expect(report.total).toMatchObject({
            unjudged: 0,
            disagreements: 0,
            reviewedSelected: selected ? 1 : 0,
            falseNearReady: selected ? 1 : 0,
            missedOpportunities: 0,
            precision: selected ? 0 : null,
          });
        },
      );
      it.each([true, false])(
        "counts a same-version blind/final disagreement conservatively (blind: %s)",
        async (ready) => {
          await evaluation();
          await blind([ready]);
          await final(!ready);
          const report = await nearReadyPilot(db, id, "synthetic");
          expect(report.total).toMatchObject({
            unjudged: 0,
            disagreements: 1,
            reviewedSelected: 1,
            correctSelected: 0,
            falseNearReady: 1,
            precision: 0,
            suggestedReview: { count: 1, medianMinutes: 3 },
          });
          expect(report.groups[0]?.disagreements).toBe(1);
        },
      );
      it("counts disagreement between two blind reviewers only once per evaluation", async () => {
        await evaluation();
        await blind([true, false]);
        await final(true);
        expect((await nearReadyPilot(db, id, "synthetic")).total).toMatchObject({
          disagreements: 1,
          reviewedSelected: 1,
          falseNearReady: 1,
          precision: 0,
        });
      });
      const critical = async (caseVersion = version) => {
        await db.insert(nearReadyEvents).values({
          id,
          evaluationId: id,
          action: "critical_error",
          actor: "system",
          at: later,
          caseVersion,
          reason: "identity",
        });
      };
      it.each(["blind", "final", "none"] as const)(
        "a critical error on the judged content is a failure regardless of %s truth",
        async (source) => {
          await evaluation();
          if (source === "blind") await blind([true]);
          if (source === "final") await final(true);
          await critical();
          expect((await nearReadyPilot(db, id, "synthetic")).total).toMatchObject({
            unjudged: 0,
            disagreements: 0,
            reviewedSelected: 1,
            falseNearReady: 1,
            criticalErrors: 1,
            precision: 0,
          });
        },
      );
      // Rows written before content versions stamped every historical evaluation.
      it("ignores a critical error stamped from later content", async () => {
        await evaluation();
        await blind([true]);
        await critical(later);
        expect((await nearReadyPilot(db, id, "synthetic")).total).toMatchObject({
          unjudged: 0,
          reviewedSelected: 1,
          correctSelected: 1,
          criticalErrors: 0,
          precision: 1,
        });
      });
      it("a critical error cannot fail an evaluation that suggested nothing", async () => {
        await evaluation(false);
        await final(true);
        await critical();
        expect((await nearReadyPilot(db, id, "synthetic")).total).toMatchObject({
          criticalErrors: 0,
          missedOpportunities: 1,
        });
      });
      it.each(["blind", "final"] as const)(
        "uses same-version %s truth for missed opportunities",
        async (source) => {
          await evaluation(false);
          if (source === "blind") await blind([true]);
          else await final(true);
          expect((await nearReadyPilot(db, id, "synthetic")).total).toMatchObject({
            unjudged: 0,
            disagreements: 0,
            reviewedSelected: 0,
            missedOpportunities: 1,
            precision: null,
          });
        },
      );
      it("returns an empty report without manufactured precision or calibration", async () => {
        const report = await nearReadyPilot(db, id, "synthetic");
        expect(report.total).toMatchObject({
          evaluated: 0,
          selected: 0,
          unjudged: 0,
          disagreements: 0,
          precision: null,
          precisionInterval: null,
          selectionRate: null,
        });
        expect(report.calibration).toEqual(report.total);
        expect(report.groups).toEqual([]);
        expect(report.calibrationPassed).toBe(false);
      });
    },
  );
}
