import { and, eq, sql } from "drizzle-orm";
import { operationalCounters, systemJobs } from "@avanti/db";
import type { Services } from "./context";
import { deadline } from "./deadline";

export function utcHour(now: Date): string {
  return new Date(Math.floor(now.getTime() / 3_600_000) * 3_600_000).toISOString();
}

export async function recordOperationalCounters(
  s: Services,
  organizationId: string,
  metrics: (typeof operationalCounters.$inferInsert.metric)[],
) {
  if (!metrics.length) return;
  const hour = utcHour(s.clock());
  // Telemetry failure must not prevent a citizen completing an otherwise successful action.
  try {
    await deadline(
      s.db
        .insert(operationalCounters)
        .values(
          metrics.map((metric) => ({
            organizationId,
            hour,
            metric,
            count: 1,
          })),
        )
        .onConflictDoUpdate({
          target: [
            operationalCounters.organizationId,
            operationalCounters.hour,
            operationalCounters.metric,
          ],
          set: { count: sql`${operationalCounters.count} + 1` },
        }),
      3000,
    );
  } catch {
    s.errorLogger?.({
      requestId: "telemetry",
      name: "TelemetryUnavailable",
      code: null,
      stack: null,
    });
  }
}

export async function observeAi<T extends { engine?: "ai" | "heuristic" }>(
  s: Services,
  organizationId: string,
  work: () => Promise<T>,
): Promise<T> {
  let result: T;
  try {
    result = await work();
  } catch (error) {
    await recordOperationalCounters(s, organizationId, ["ai_error"]);
    throw error;
  }
  await recordOperationalCounters(
    s,
    organizationId,
    result.engine === "ai"
      ? ["ai_success"]
      : result.engine === "heuristic"
        ? s.ai.configured === true
          ? ["ai_fallback", "ai_error"]
          : ["ai_fallback"]
        : [],
  );
  return result;
}

export async function startSystemJob(
  s: Services,
  kind: "maintenance" | "retention",
  runId: string,
) {
  await s.db
    .insert(systemJobs)
    .values({
      kind,
      runId,
      startedAt: s.clock().toISOString(),
      finishedAt: null,
      outcome: "running",
    })
    .onConflictDoUpdate({
      target: systemJobs.kind,
      set: { runId, startedAt: s.clock().toISOString(), finishedAt: null, outcome: "running" },
    });
}

export async function finishSystemJob(
  s: Services,
  kind: "maintenance" | "retention",
  runId: string,
  outcome: "ok" | "failed",
) {
  // A late worker cannot overwrite the result of a newer run on another instance.
  await s.db
    .update(systemJobs)
    .set({ outcome, finishedAt: s.clock().toISOString() })
    .where(and(eq(systemJobs.kind, kind), eq(systemJobs.runId, runId)));
}
