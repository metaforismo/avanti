import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase, repoRoot, type Database } from "./client";
import {
  cases,
  copilotCache,
  nearReadyBlindReviews,
  nearReadyEvaluations,
  nearReadyEvents,
  offices,
  operators,
  organizations,
  settings,
} from "./schema";

const postgresUrl = process.env.AVANTI_TEST_DATABASE_URL;
if (postgresUrl) {
  const url = new URL(postgresUrl);
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    !url.pathname.endsWith("_test") ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Near-ready tests require a disposable local Postgres database ending in _test",
    );
}

for (const engine of ["pglite", "postgres"] as const) {
  describe.skipIf(engine === "postgres" && !postgresUrl)(
    `${engine}: near-ready invalidation`,
    () => {
      let db: Database, close: () => Promise<void>, id: string;
      const fractional = "2099-01-01T00:00:00.123456Z";
      const normalized = "2099-01-01T00:00:00.124Z";
      beforeAll(async () => {
        ({ db, close } = await createDatabase(
          engine === "pglite" ? { memory: true } : { url: postgresUrl, migrate: true },
        ));
      });
      afterAll(async () => close?.());
      beforeEach(async () => {
        id = `near-ready-invalidation-${crypto.randomUUID()}`;
        await db.insert(organizations).values({ id, name: "Sintetico", kind: "caf" });
        await db.insert(offices).values({
          id,
          organizationId: id,
          slug: id,
          name: "Sintetico",
          address: "Sintetico",
          city: "Roma",
        });
        await db.insert(operators).values({
          id,
          organizationId: id,
          name: "Sintetico",
          email: `${id}@example.invalid`,
          passwordHash: "unused",
          role: "operator",
        });
        await db.insert(settings).values({ organizationId: id });
        await db.insert(cases).values({
          id,
          organizationId: id,
          officeId: id,
          reference: id,
          tokenHash: id,
          language: "it",
          status: "submitted",
          createdAt: fractional,
          updatedAt: fractional,
          expiresAt: "2100-01-01T00:00:00Z",
        });
      });
      afterEach(async () => {
        await db.delete(organizations).where(eq(organizations.id, id));
      });
      const version = async () => {
        const [row] = await db.select({ at: cases.updatedAt }).from(cases).where(eq(cases.id, id));
        return row!.at;
      };
      const evaluation = async (caseVersion = fractional) => {
        await db.insert(nearReadyEvaluations).values({
          id,
          caseId: id,
          caseVersion,
          currentVersion: caseVersion,
          checkedAt: caseVersion,
          eligible: true,
          mode: "visible",
          state: "suggested",
          language: "it",
          reading: "ai",
          snapshot: {
            rulesVersion: "synthetic",
            catalogVersion: "synthetic",
            schemaVersion: "1",
            configurationKey: "synthetic",
            validUntil: "2100-01-01T00:00:00Z",
            conditions: {},
            criticalThreshold: 0.98,
            otherThreshold: 0.95,
            fields: [],
            exclusions: [],
            tasks: [],
            durationMs: 0,
          },
        });
      };
      const replay = async () => {
        const migration = await readFile(
          join(repoRoot, "packages/db/migrations/0022_near_ready_invalidation.sql"),
          "utf8",
        );
        await db.transaction(async (tx) => {
          for (const statement of migration.split("--> statement-breakpoint"))
            if (statement.trim()) await tx.execute(sql.raw(statement));
        });
      };

      it("normalizes existing microseconds once and withdraws the previous suggestion", async () => {
        await evaluation();
        await replay();
        expect(new Date(await version()).toISOString()).toBe(normalized);
        const [row] = await db
          .select()
          .from(nearReadyEvaluations)
          .where(eq(nearReadyEvaluations.id, id));
        expect(row?.state).toBe("withdrawn");
        expect(new Date(row!.currentVersion).toISOString()).toBe(normalized);
        await replay();
        expect(new Date(await version()).toISOString()).toBe(normalized);
        expect(
          await db.select().from(nearReadyEvents).where(eq(nearReadyEvents.evaluationId, id)),
        ).toHaveLength(1);
      });

      it("policy changes preserve exact SQL equality with API versions and blind reviews", async () => {
        await db
          .update(settings)
          .set({ nearReadyMode: "visible" })
          .where(eq(settings.organizationId, id));
        const apiVersion = new Date(await version()).toISOString();
        expect(apiVersion).toBe(normalized);
        await evaluation(apiVersion);
        await db.insert(copilotCache).values({
          caseId: id,
          caseVersion: apiVersion,
          task: "consistency",
          payload: {},
          leaseToken: id,
          leaseUntil: apiVersion,
        });
        await db.insert(nearReadyBlindReviews).values({
          caseId: id,
          caseVersion: await version(),
          operatorId: id,
          ready: true,
          reason: "other",
          at: apiVersion,
        });
        const matches = await db
          .select({ id: cases.id })
          .from(cases)
          .innerJoin(
            nearReadyEvaluations,
            and(
              eq(nearReadyEvaluations.caseId, cases.id),
              eq(nearReadyEvaluations.caseVersion, cases.updatedAt),
            ),
          )
          .innerJoin(
            copilotCache,
            and(eq(copilotCache.caseId, cases.id), eq(copilotCache.caseVersion, cases.updatedAt)),
          )
          .innerJoin(
            nearReadyBlindReviews,
            and(
              eq(nearReadyBlindReviews.caseId, cases.id),
              eq(nearReadyBlindReviews.caseVersion, apiVersion),
            ),
          )
          .where(eq(cases.id, id));
        expect(matches).toEqual([{ id }]);
        await db
          .update(settings)
          .set({ nearReadyCriticalThreshold: 0.99 })
          .where(eq(settings.organizationId, id));
        expect(new Date(await version()).toISOString()).toBe("2099-01-01T00:00:00.125Z");
      });

      it("late consistency findings withdraw suggestions without invalidating their cache version", async () => {
        await evaluation();
        const checkedAt = "2099-01-01T00:10:00.000Z";
        await db
          .update(nearReadyEvaluations)
          .set({ checkedAt })
          .where(eq(nearReadyEvaluations.id, id));
        await db.update(cases).set({ aiAttention: 1 }).where(eq(cases.id, id));
        const [row] = await db
          .select()
          .from(nearReadyEvaluations)
          .where(eq(nearReadyEvaluations.id, id));
        expect(row?.state).toBe("withdrawn");
        expect(await version()).toBe(row?.caseVersion);
        await db.update(cases).set({ aiAttention: 1 }).where(eq(cases.id, id));
        const history = await db
          .select()
          .from(nearReadyEvents)
          .where(eq(nearReadyEvents.evaluationId, id));
        expect(history).toHaveLength(1);
        expect(Date.parse(history[0]!.at)).toBeGreaterThanOrEqual(Date.parse(checkedAt));
        expect(history[0]!.caseVersion).toBe(row?.caseVersion);
      });

      it("rolls back policy, case version, withdrawal and audit together", async () => {
        await evaluation();
        await expect(
          db.transaction(async (tx) => {
            await tx
              .update(settings)
              .set({ nearReadyMode: "visible" })
              .where(eq(settings.organizationId, id));
            throw new Error("synthetic rollback");
          }),
        ).rejects.toThrow("synthetic rollback");
        const [policy] = await db.select().from(settings).where(eq(settings.organizationId, id));
        const [row] = await db
          .select()
          .from(nearReadyEvaluations)
          .where(eq(nearReadyEvaluations.id, id));
        expect(policy?.nearReadyMode).toBe("shadow");
        expect(row?.state).toBe("suggested");
        expect(await version()).toBe(row?.caseVersion);
        expect(
          await db.select().from(nearReadyEvents).where(eq(nearReadyEvents.evaluationId, id)),
        ).toEqual([]);
      });
    },
  );
}
