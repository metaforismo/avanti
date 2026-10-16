import { PlatformOrgCommand } from "@avanti/contracts";
import { usageMonth, usagePercent } from "@avanti/core";
import { loadAiConfig } from "@avanti/ai/config";
import { aiUsage, events, organizations, settings, type Database } from "@avanti/db";
import { and, eq, sql } from "drizzle-orm";
import { commercialStatus } from "./commercial-usage";

export async function platformOrg(
  db: Database,
  raw: unknown,
  now: Date,
  defaultBudget = loadAiConfig().monthlyBudgetEur,
) {
  const input = PlatformOrgCommand.parse(raw);
  return db.transaction(async (tx) => {
    const [org] = await tx
      .select({ id: organizations.id, meteringExcluded: organizations.meteringExcluded })
      .from(organizations)
      .where(eq(organizations.id, input.org))
      .for("update");
    if (!org) throw new Error("Organizzazione non trovata.");
    const changes = {
      ...(input.budget !== undefined ? { aiMonthlyBudgetEur: input.budget } : {}),
      ...(input.cap !== undefined ? { monthlyDeliveryCap: input.cap } : {}),
    };
    if (Object.keys(changes).length) {
      const [before] = await tx
        .select()
        .from(settings)
        .where(eq(settings.organizationId, input.org));
      await tx
        .insert(settings)
        .values({ organizationId: input.org, ...changes })
        .onConflictDoUpdate({ target: settings.organizationId, set: changes });
      await tx.insert(events).values({
        id: crypto.randomUUID(),
        organizationId: input.org,
        actor: "system",
        type: "platform.organization_limits_updated",
        at: now.toISOString(),
        metadata: {
          budgetChanged: input.budget !== undefined,
          capChanged: input.cap !== undefined,
          previousBudgetEur: before?.aiMonthlyBudgetEur ?? null,
          budgetEur:
            input.budget !== undefined ? input.budget : (before?.aiMonthlyBudgetEur ?? null),
          previousCap: before?.monthlyDeliveryCap ?? null,
          cap: input.cap !== undefined ? input.cap : (before?.monthlyDeliveryCap ?? null),
        },
      });
    }
    const [config] = await tx.select().from(settings).where(eq(settings.organizationId, input.org));
    const month = usageMonth(now);
    const [ai] = await tx
      .select({
        cost: sql<number>`coalesce(sum(${aiUsage.costEstimateEur}),0)::float8`,
        reserved: sql<number>`coalesce(sum(${aiUsage.reservedEur}),0)::float8`,
      })
      .from(aiUsage)
      .where(and(eq(aiUsage.organizationId, input.org), sql`left(${aiUsage.day},7) = ${month}`));
    const budgetEur = config?.aiMonthlyBudgetEur ?? defaultBudget;
    return {
      organizationId: input.org,
      meteringExcluded: org.meteringExcluded,
      ai: {
        overrideEur: config?.aiMonthlyBudgetEur ?? null,
        budgetEur,
        costEstimateEur: ai?.cost ?? 0,
        reservedEur: ai?.reserved ?? 0,
        budgetPercent: usagePercent((ai?.cost ?? 0) + (ai?.reserved ?? 0), budgetEur),
      },
      usage: await commercialStatus(tx, input.org, now),
    };
  });
}
