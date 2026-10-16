import { PlatformOrgCommand } from "@avanti/contracts";
import { usageMonth, usagePercent } from "@avanti/core";
import { loadAiConfig } from "@avanti/ai/config";
import { events, organizations, settings, type Database } from "@avanti/db";
import { eq } from "drizzle-orm";
import { monthlyAiSpend } from "./ai-usage";
import { commercialStatus, resetUsageAlerts } from "./commercial-usage";

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
      if (input.cap !== undefined && input.cap !== (before?.monthlyDeliveryCap ?? null))
        await resetUsageAlerts(tx, input.org, now);
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
    const ai = await monthlyAiSpend(tx, input.org, usageMonth(now), defaultBudget);
    return {
      organizationId: input.org,
      meteringExcluded: org.meteringExcluded,
      ai: {
        overrideEur: ai.overrideEur,
        budgetEur: ai.budgetEur,
        costEstimateEur: ai.usedEur,
        reservedEur: ai.reservedEur,
        budgetPercent: usagePercent(ai.usedEur + ai.reservedEur, ai.budgetEur),
      },
      usage: await commercialStatus(tx, input.org, now),
    };
  });
}
