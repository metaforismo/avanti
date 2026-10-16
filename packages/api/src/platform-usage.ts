import { loadAiConfig } from "@avanti/ai/config";
import { PlatformUsageQuery } from "@avanti/contracts";
import { usageMonthRange, usagePercent } from "@avanti/core";
import {
  aiUsage,
  commercialUsage,
  events,
  offices,
  organizations,
  settings,
  type Database,
} from "@avanti/db";
import { and, eq, gte, lt, sql } from "drizzle-orm";

export async function platformUsage(
  db: Database,
  raw: unknown,
  defaultBudget = loadAiConfig().monthlyBudgetEur,
) {
  const query = PlatformUsageQuery.parse(raw);
  const { from, until } = usageMonthRange(query.month);
  return db.transaction(async (tx) => {
    await tx.execute(sql`set transaction isolation level repeatable read read only`);
    const orgs = await tx
      .select({ id: organizations.id })
      .from(organizations)
      .where(
        and(
          eq(organizations.meteringExcluded, false),
          query.org ? eq(organizations.id, query.org) : undefined,
        ),
      )
      .orderBy(organizations.id);
    if (query.org && !orgs.length)
      throw new Error("Organizzazione assente o esclusa dalle misure commerciali.");
    const result = [];
    for (const org of orgs) {
      const counters = await tx
        .select()
        .from(commercialUsage)
        .where(
          and(eq(commercialUsage.organizationId, org.id), eq(commercialUsage.month, query.month)),
        );
      const branches = await tx
        .select({ id: offices.id })
        .from(offices)
        .where(eq(offices.organizationId, org.id));
      const [config] = await tx
        .select({ budget: settings.aiMonthlyBudgetEur, cap: settings.monthlyDeliveryCap })
        .from(settings)
        .where(eq(settings.organizationId, org.id));
      const ai = await tx
        .select({
          officeId: aiUsage.officeId,
          calls: sql<number>`coalesce(sum(${aiUsage.attempts}),0)::int`,
          tasks: sql<number>`count(*)::int`,
          unresolvedReservations: sql<number>`count(*) filter (where ${aiUsage.outcome} = 'reserved')::int`,
          cost: sql<number>`coalesce(sum(${aiUsage.costEstimateEur}),0)::float8`,
          reserved: sql<number>`coalesce(sum(${aiUsage.reservedEur}),0)::float8`,
        })
        .from(aiUsage)
        .where(
          and(eq(aiUsage.organizationId, org.id), gte(aiUsage.day, from), lt(aiUsage.day, until)),
        )
        .groupBy(aiUsage.officeId);
      const activity = and(
        eq(events.organizationId, org.id),
        eq(events.actor, "operator"),
        sql`${events.at} >= (${from}::date::timestamp AT TIME ZONE 'Europe/Rome')`,
        sql`${events.at} < (${until}::date::timestamp AT TIME ZONE 'Europe/Rome')`,
      );
      const active = await tx
        .select({
          officeId: events.officeId,
          count: sql<number>`count(distinct ${events.actorId})::int`,
        })
        .from(events)
        .where(activity)
        .groupBy(events.officeId);
      const [totalActive] = await tx
        .select({ count: sql<number>`count(distinct ${events.actorId})::int` })
        .from(events)
        .where(activity);
      const budget = config?.budget ?? defaultBudget;
      const metrics = (officeId?: string) => {
        const counter =
          officeId === "" ? undefined : counters.find((r) => r.officeId === (officeId ?? ""));
        const rows =
          officeId === undefined ? ai : ai.filter((r) => (r.officeId ?? "") === officeId);
        const costEstimateEur = rows.reduce((sum, r) => sum + r.cost, 0);
        const reservedEur = rows.reduce((sum, r) => sum + r.reserved, 0);
        const delivered = counter?.delivered ?? 0;
        return {
          started: counter?.started ?? 0,
          delivered,
          activeOperators:
            officeId === undefined
              ? (totalActive?.count ?? 0)
              : (active.find((r) => r.officeId === officeId)?.count ?? 0),
          aiCalls: rows.reduce((sum, r) => sum + r.calls, 0),
          aiTasks: rows.reduce((sum, r) => sum + r.tasks, 0),
          unresolvedReservations: rows.reduce((sum, r) => sum + r.unresolvedReservations, 0),
          costEstimateEur,
          reservedEur,
          aiCostPerDeliveredEur: delivered ? costEstimateEur / delivered : null,
          budgetEur: budget,
          budgetPercent: usagePercent(costEstimateEur + reservedEur, budget),
        };
      };
      const ids = new Set([
        ...branches.map((r) => r.id),
        ...counters.map((r) => r.officeId).filter(Boolean),
        ...ai.map((r) => r.officeId).filter((id): id is string => id !== null),
        ...active.map((r) => r.officeId).filter((id): id is string => id !== null),
      ]);
      const officeRows = [...ids].sort().map((officeId) => {
        const row = metrics(officeId);
        return {
          officeId,
          active:
            row.started > 0 || row.delivered > 0 || row.aiCalls > 0 || row.activeOperators > 0,
          ...row,
        };
      });
      result.push({
        organizationId: org.id,
        ...metrics(),
        cap: config?.cap ?? null,
        activeOffices: officeRows.filter((r) => r.active && r.officeId !== "__unattributed__")
          .length,
        offices: officeRows,
        // Legacy rows lack office provenance; keeping them explicit preserves reconciliation.
        unattributedAi: metrics(""),
      });
    }
    return {
      month: query.month,
      timeZone: "Europe/Rome" as const,
      budgetScope: "organization" as const,
      organizations: result,
    };
  });
}

export function formatPlatformUsage(report: Awaited<ReturnType<typeof platformUsage>>) {
  const fmt = (value: number | null, digits = 4) => (value === null ? "—" : value.toFixed(digits));
  const rows: string[][] = [
    [
      "CAF / sportello",
      "Avvii",
      "Consegnati",
      "Op. attivi",
      "Chiamate AI",
      "AI EUR",
      "Riserva EUR",
      "AI/consegna EUR",
      "Budget CAF EUR",
      "% budget",
      "Sportelli attivi",
    ],
  ];
  for (const org of report.organizations) {
    for (const row of [
      { label: org.organizationId, ...org },
      ...org.offices.map((o) => ({ label: `  ${o.officeId}`, ...o })),
      ...(org.unattributedAi.aiTasks
        ? [{ label: "  [AI non attribuita]", ...org.unattributedAi }]
        : []),
    ]) {
      rows.push(
        [
          row.label,
          row.started,
          row.delivered,
          row.activeOperators,
          row.aiCalls,
          fmt(row.costEstimateEur),
          fmt(row.reservedEur),
          fmt(row.aiCostPerDeliveredEur),
          fmt(row.budgetEur, 2),
          fmt(row.budgetPercent, 2),
          "activeOffices" in row ? row.activeOffices : "—",
        ].map(String),
      );
    }
  }
  const widths = rows[0]!.map((_, i) => Math.max(...rows.map((row) => row[i]!.length)));
  return [
    `Utilizzo ${report.month} (${report.timeZone}); budget condiviso del CAF, % inclusiva delle riserve.`,
    ...rows.map((row) =>
      row
        .map((cell, i) => cell.padEnd(widths[i]!))
        .join("  ")
        .trimEnd(),
    ),
  ].join("\n");
}
