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
import { purgeRetainedCases } from "../case-erasure";
import { retryStorageDeletions } from "../storage-cleanup";
import { ApiFailure } from "../security";
import { purgeAuditEvents } from "../audit-log";
import { maintainNotifications } from "../notifications";
import { startSystemJob, finishSystemJob } from "../operational-telemetry";

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
    try {
      await s.db
        .delete(sessions)
        .where(
          or(
            lte(sessions.expiresAt, now.toISOString()),
            sql`${sessions.createdAt} + interval '12 hours' <= ${now.toISOString()}::timestamptz`,
          ),
        );
      await clearExpiredRateLimits(s.db, now);
      const notificationResult = await maintainNotifications(s, now);
      await startSystemJob(s, "retention", runId);
      let deletedCases: number;
      let deletedAuditEvents: number;
      let outcome: "ok" | "failed" = "ok";
      try {
        deletedCases = await purgeRetainedCases(s, now);
        deletedAuditEvents = await purgeAuditEvents(s.db, now);
        await retryStorageDeletions(s);
        const [failedDeletion] = await s.db
          .select({ id: storageDeletions.id })
          .from(storageDeletions)
          .where(gt(storageDeletions.attempts, 0))
          .limit(1);
        if (failedDeletion) outcome = "failed";
        await finishSystemJob(s, "retention", runId, outcome);
      } catch (error) {
        await finishSystemJob(s, "retention", runId, "failed");
        throw error;
      }
      await recoverDocumentAnalysis(s);
      await recoverCopilot(s);
      await s.db
        .delete(operationalCounters)
        .where(lt(operationalCounters.hour, new Date(now.getTime() - 7 * 86400000).toISOString()));
      await finishSystemJob(s, "maintenance", runId, outcome);
      return c.json({ ok: true, deletedCases, deletedAuditEvents, ...notificationResult });
    } catch (error) {
      await finishSystemJob(s, "maintenance", runId, "failed");
      throw error;
    }
  });
}
