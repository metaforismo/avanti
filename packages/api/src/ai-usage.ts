import { aiUsage, organizations, settings } from "@avanti/db";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { AiUsageQuery, AiUsageResponse } from "@avanti/contracts";
import type { TaskContext } from "@avanti/ai";
import { loadAiConfig } from "@avanti/ai/config";
import { parse, type App, type Services } from "./context";
import { ApiFailure } from "./security";

function monthRange(month: string) {
  return {
    from: `${month}-01`,
    until: `${Number(month.slice(0, 4)) + (month.endsWith("-12") ? 1 : 0)}-${String((Number(month.slice(5)) % 12) + 1).padStart(2, "0")}-01`,
  };
}
export async function aiBudget(
  s: Services,
  organizationId: string,
  month = s.clock().toISOString().slice(0, 7),
) {
  const { from, until } = monthRange(month);
  const [row] = await s.db
    .select()
    .from(settings)
    .where(eq(settings.organizationId, organizationId));
  const [usage] = await s.db
    .select({
      used: sql<number>`coalesce(sum(${aiUsage.costEstimateEur}), 0)::float8`,
      reserved: sql<number>`coalesce(sum(${aiUsage.reservedEur}), 0)::float8`,
    })
    .from(aiUsage)
    .where(
      and(
        eq(aiUsage.organizationId, organizationId),
        gte(aiUsage.day, from),
        lt(aiUsage.day, until),
      ),
    );
  const budgetEur =
    row?.aiMonthlyBudgetEur ??
    s.ai.configuration?.monthlyBudgetEur ??
    loadAiConfig().monthlyBudgetEur;
  const usedEur = Number(usage?.used ?? 0),
    reservedEur = Number(usage?.reserved ?? 0);
  return { month, budgetEur, usedEur, reservedEur, exhausted: usedEur + reservedEur >= budgetEur };
}
export function cafAiContext(s: Services, organizationId: string): TaskContext {
  const day = s.clock().toISOString().slice(0, 10);
  return {
    organizationId,
    reserve: async (ceiling, task) => {
      try {
        return await s.db.transaction(async (tx) => {
          // Serialize only admission, never hold a database lock while calling a provider.
          const [tenant] = await tx
            .select({ id: organizations.id })
            .from(organizations)
            .where(eq(organizations.id, organizationId))
            .for("update");
          if (!tenant) return { reason: "budget_unavailable" as const };
          const budget = await aiBudget({ ...s, db: tx }, organizationId, day.slice(0, 7));
          if (budget.exhausted || budget.usedEur + budget.reservedEur + ceiling > budget.budgetEur)
            return { reason: "budget_exhausted" as const };
          const id = crypto.randomUUID();
          await tx.insert(aiUsage).values({
            id,
            organizationId,
            task: task.id,
            version: task.version,
            model: task.model,
            engine: "heuristic",
            outcome: "reserved",
            day,
            reservedEur: ceiling,
          });
          return { id };
        });
      } catch {
        return { reason: "budget_unavailable" as const };
      }
    },
    record: async (record, reservationId) => {
      const values = {
        task: record.task,
        version: record.version,
        model: record.model,
        engine: record.engine,
        outcome:
          (record.fallbackReason ?? "success") +
          (record.retryReasons.length
            ? `_after_${[...new Set(record.retryReasons)].join("+")}`
            : ""),
        latencyMs: record.latencyMs,
        inputTokens: record.usage.inputTokens,
        outputTokens: record.usage.outputTokens,
        costEstimateEur: record.costEstimate,
        reservedEur: 0,
        attempts: record.attempts,
        manipulationAttempts: record.manipulationAttempts,
      };
      try {
        if (reservationId)
          await s.db
            .update(aiUsage)
            .set(values)
            .where(and(eq(aiUsage.id, reservationId), eq(aiUsage.organizationId, organizationId)));
        else
          await s.db
            .insert(aiUsage)
            .values({ id: crypto.randomUUID(), organizationId, day, ...values });
      } catch {
        // Keep a failed reconciliation reserved: spend must never silently disappear.
        s.errorLogger?.({
          requestId: "ai-usage",
          name: "TelemetryUnavailable",
          code: null,
          stack: null,
        });
      }
    },
  };
}
export function mountAiUsage(app: App, s: Services) {
  app.get("/ai/usage", async (c) => {
    const actor = c.get("operator");
    if (actor.role !== "admin")
      throw new ApiFailure("forbidden", 403, "Operazione riservata agli amministratori.");
    const query = parse(AiUsageQuery, c.req.query());
    const month = query.month ?? s.clock().toISOString().slice(0, 7);
    const { from, until } = monthRange(month);
    const groups = await s.db
      .select({
        task: aiUsage.task,
        version: aiUsage.version,
        model: aiUsage.model,
        engine: aiUsage.engine,
        outcome: aiUsage.outcome,
        day: aiUsage.day,
        calls: sql<number>`count(*)::int`,
        attempts: sql<number>`sum(${aiUsage.attempts})::int`,
        latencyMs: sql<number>`avg(${aiUsage.latencyMs})::float8`,
        inputTokens: sql<number>`sum(${aiUsage.inputTokens})::float8`,
        outputTokens: sql<number>`sum(${aiUsage.outputTokens})::float8`,
        costEstimateEur: sql<number>`sum(${aiUsage.costEstimateEur})::float8`,
        manipulationAttempts: sql<number>`sum(${aiUsage.manipulationAttempts})::int`,
      })
      .from(aiUsage)
      .where(
        and(
          eq(aiUsage.organizationId, actor.organizationId),
          gte(aiUsage.day, from),
          lt(aiUsage.day, until),
        ),
      )
      .groupBy(
        aiUsage.task,
        aiUsage.version,
        aiUsage.model,
        aiUsage.engine,
        aiUsage.outcome,
        aiUsage.day,
      );
    const totals = groups.reduce(
      (sum, row) => ({
        calls: sum.calls + row.calls,
        inputTokens: sum.inputTokens + row.inputTokens,
        outputTokens: sum.outputTokens + row.outputTokens,
        costEstimateEur: sum.costEstimateEur + row.costEstimateEur,
        manipulationAttempts: sum.manipulationAttempts + row.manipulationAttempts,
      }),
      { calls: 0, inputTokens: 0, outputTokens: 0, costEstimateEur: 0, manipulationAttempts: 0 },
    );
    return c.json(
      AiUsageResponse.parse({
        ...(await aiBudget(s, actor.organizationId, month)),
        totals,
        groups,
      }),
    );
  });
}
