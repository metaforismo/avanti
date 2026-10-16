import { commercialUsage, operators, settings, usageQuotaAlerts, type Database } from "@avanti/db";
import { and, eq } from "drizzle-orm";
import { CommercialUsage } from "@avanti/contracts";
import { usageMonth, usagePercent } from "@avanti/core";
import type { Services } from "./context";
import { enqueueNotification } from "./notifications";

export async function commercialStatus(db: Database, organizationId: string, now: Date) {
  const month = usageMonth(now);
  const [counter] = await db
    .select()
    .from(commercialUsage)
    .where(
      and(
        eq(commercialUsage.organizationId, organizationId),
        eq(commercialUsage.officeId, ""),
        eq(commercialUsage.month, month),
      ),
    );
  const [config] = await db
    .select()
    .from(settings)
    .where(eq(settings.organizationId, organizationId));
  const delivered = counter?.delivered ?? 0;
  const cap = config?.monthlyDeliveryCap ?? null;
  return CommercialUsage.parse({ month, delivered, cap, percent: usagePercent(delivered, cap) });
}

/** Runs after the counter trigger, while the submission transaction still holds its total-row lock. */
export async function enqueueUsageAlerts(
  db: Database,
  s: Services,
  organizationId: string,
  now: Date,
) {
  const usage = await commercialStatus(db, organizationId, now);
  const ids: string[] = [];
  const alerts: { month: string; threshold: number; delivered: number; cap: number }[] = [];
  if (usage.cap === null) return { ids, alerts };
  for (const threshold of [70, 90, 100]) {
    if (usage.delivered * 100 < usage.cap * threshold) continue;
    const [inserted] = await db
      .insert(usageQuotaAlerts)
      .values({
        organizationId,
        month: usage.month,
        threshold,
        delivered: usage.delivered,
        cap: usage.cap,
        at: now.toISOString(),
      })
      .onConflictDoNothing()
      .returning();
    if (!inserted) continue;
    const admins = await db
      .select({ id: operators.id, email: operators.email })
      .from(operators)
      .where(
        and(
          eq(operators.organizationId, organizationId),
          eq(operators.role, "admin"),
          eq(operators.active, true),
        ),
      );
    for (const admin of admins) {
      const id = await enqueueNotification(
        db,
        s.notifications,
        {
          kind: "usage_quota",
          language: "it",
          organizationId,
          operatorId: admin.id,
          dedupeKey: `usage:${organizationId}:${usage.month}:${threshold}:${admin.id}`,
          to: admin.email,
          email: {
            subject: `Avanti: quota consegne al ${threshold}%`,
            text: `Mese ${usage.month}: ${usage.delivered} fascicoli consegnati su una quota di ${usage.cap}. Soglia ${threshold}% raggiunta. Gli invii continuano anche oltre quota. Contatta Avanti per rivedere il cap.`,
          },
        },
        now,
      );
      if (id) ids.push(id);
    }
    alerts.push({ month: usage.month, threshold, delivered: usage.delivered, cap: usage.cap });
  }
  return { ids, alerts };
}

export function logUsageAlerts(
  organizationId: string,
  alerts: Awaited<ReturnType<typeof enqueueUsageAlerts>>["alerts"],
) {
  for (const alert of alerts) {
    try {
      console.info(JSON.stringify({ event: "usage.quota", organizationId, ...alert }));
    } catch {
      /* A log sink cannot invalidate a committed submission. */
    }
  }
}
