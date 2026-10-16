import { usageDay, usageMonth, usageMonthRange as monthRange } from "@avanti/core";
import { aiUsage, organizations, settings } from "@avanti/db";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import type { TaskContext } from "@avanti/ai";
import { loadAiConfig } from "@avanti/ai/config";
import type { Services } from "./context";

export async function aiBudget(s: Services, organizationId: string, month = usageMonth(s.clock())) {
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
export function cafAiContext(s: Services, organizationId: string, officeId?: string): TaskContext {
  const day = usageDay(s.clock());
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
            officeId,
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
            .values({ id: crypto.randomUUID(), organizationId, officeId, day, ...values });
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
