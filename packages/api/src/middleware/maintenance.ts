import { recoverCopilot } from "../copilot";
import { recoverDocumentAnalysis } from "../document-analysis";
import { timingSafeEqual } from "node:crypto";
import { gt, lte, lt, or, sql } from "drizzle-orm";
import {
  clearExpiredRateLimits,
  sessions,
  systemJobs,
  operationalCounters,
  storageDeletions,
} from "@avanti/db";
import type { App, Services } from "../context";
import { purgeRetainedCases, RETENTION_BATCH_SIZE } from "../case-erasure";
import { retryStorageDeletions, STORAGE_DELETION_BATCH } from "../storage-cleanup";
import { LEAD_RETENTION_BATCH, purgeLeads } from "../lead-retention";
import { ApiFailure } from "../security";
import { AUDIT_RETENTION_BATCH, purgeAuditEvents } from "../audit-log";
import { maintainNotifications } from "../notifications";
import { startSystemJob, finishSystemJob } from "../operational-telemetry";
import { purgeIdempotencyKeys } from "../idempotency";

export function mountMaintenance(app: App, s: Services) {
  app.get("/cron/maintenance", async (c) => {
    const provided = Buffer.from(c.req.header("Authorization") ?? "");
    const expected = Buffer.from(`Bearer ${s.cronSecret ?? ""}`);
    if (
      !s.cronSecret ||
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    )
      throw new ApiFailure("unauthorized", 401, "Accesso non autorizzato.");
    const now = s.clock();
    const runId = crypto.randomUUID();
    const startedAt = now.toISOString();
    const claimed = await s.db
      .insert(systemJobs)
      .values({
        kind: "maintenance",
        runId,
        startedAt,
        finishedAt: null,
        outcome: "running",
      })
      .onConflictDoUpdate({
        target: systemJobs.kind,
        set: { runId, startedAt, finishedAt: null, outcome: "running" },
        setWhere: sql`${systemJobs.startedAt} <= ${new Date(now.getTime() - 60000).toISOString()}::timestamptz
        and (${systemJobs.outcome} <> 'running' or ${systemJobs.startedAt} <= ${new Date(now.getTime() - 600000).toISOString()}::timestamptz)`,
      })
      .returning({ kind: systemJobs.kind });
    if (!claimed.length) return c.json({ ok: true, skipped: true });
    // Every step runs even if an earlier one fails: a broken email provider must not keep
    // expired dossiers alive. The first failure is rethrown at the end (500, logged safely).
    let failure: unknown;
    const step = async (work: () => Promise<unknown>) => {
      try {
        await work();
      } catch (error) {
        failure ??= error;
      }
    };
    // Retention first, while the run has the whole budget.
    const retention = await runRetention(s, now, runId).catch((error: unknown) => {
      failure ??= error;
      return null;
    });
    await step(() =>
      s.db
        .delete(sessions)
        .where(
          or(
            lte(sessions.expiresAt, now.toISOString()),
            sql`${sessions.createdAt} + interval '12 hours' <= ${now.toISOString()}::timestamptz`,
          ),
        ),
    );
    await step(() => clearExpiredRateLimits(s.db, now));
    await step(() => purgeIdempotencyKeys(s.db, now));
    let notificationResult: Awaited<ReturnType<typeof maintainNotifications>> | undefined;
    await step(async () => {
      notificationResult = await maintainNotifications(s, now);
    });
    await step(() => recoverDocumentAnalysis(s));
    await step(() => recoverCopilot(s));
    await step(() =>
      s.db
        .delete(operationalCounters)
        .where(lt(operationalCounters.hour, new Date(now.getTime() - 7 * 86400000).toISOString())),
    );
    if (failure !== undefined) {
      await finishSystemJob(s, "maintenance", runId, "failed").catch(() => {});
      throw failure;
    }
    await finishSystemJob(s, "maintenance", runId, retention?.outcome ?? "failed");
    return c.json({
      ok: true,
      deletedCases: retention?.deletedCases ?? 0,
      deletedAuditEvents: retention?.deletedAuditEvents ?? 0,
      deletedLeads: retention?.deletedLeads ?? 0,
      retentionBacklog: retention?.backlog ?? true,
      ...notificationResult,
    });
  });
}

/**
 * Under the route's 120 s `maxDuration`, with room left for the other steps. Each batch is its
 * own transaction: a timeout or crash loses at most the batch in flight, and the next run
 * starts where this one stopped.
 */
export const RETENTION_BUDGET_MS = 75_000;

async function runRetention(s: Services, now: Date, runId: string) {
  await startSystemJob(s, "retention", runId);
  const started = performance.now();
  const left = () => RETENTION_BUDGET_MS - (performance.now() - started);
  try {
    let backlog = false;
    const drain = async (batch: () => Promise<number>, size: number) => {
      let total = 0;
      for (;;) {
        if (left() <= 0) {
          backlog = true;
          return total;
        }
        const deleted = await batch();
        total += deleted;
        if (deleted < size) return total;
      }
    };
    const deletedCases = await drain(() => purgeRetainedCases(s, now), RETENTION_BATCH_SIZE);
    const deletedAuditEvents = await drain(
      () => purgeAuditEvents(s.db, now),
      AUDIT_RETENTION_BATCH,
    );
    const deletedLeads = await drain(() => purgeLeads(s.db, now), LEAD_RETENTION_BATCH);
    for (;;) {
      const budget = Math.min(20000, left());
      if (budget <= 0) {
        backlog = true;
        break;
      }
      const run = await retryStorageDeletions(s, undefined, undefined, budget);
      if (run.outOfTime) backlog = true;
      if (run.outOfTime || run.attempted < STORAGE_DELETION_BATCH) break;
    }
    const [failedDeletion] = await s.db
      .select({ id: storageDeletions.id })
      .from(storageDeletions)
      .where(gt(storageDeletions.attempts, 0))
      .limit(1);
    // Work left for the next run is a failure to report, not a success: the status page must
    // not say «ok» while dossiers past their retention are still there.
    const outcome: "ok" | "failed" = failedDeletion || backlog ? "failed" : "ok";
    await finishSystemJob(s, "retention", runId, outcome);
    return { outcome, deletedCases, deletedAuditEvents, deletedLeads, backlog };
  } catch (error) {
    await finishSystemJob(s, "retention", runId, "failed");
    throw error;
  }
}
