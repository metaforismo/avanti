import { SystemStatus, SystemStatusQuery, type SystemStatusLevel } from "@avanti/contracts";
import { cases, documents, events, operationalCounters, systemJobs } from "@avanti/db";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { parse, type App, type Services } from "./context";
import { ApiFailure } from "./security";
import { deadline } from "./deadline";
import { utcHour } from "./operational-telemetry";

type Component = SystemStatus["components"]["database"];
const DAY = 86_400_000;
export function worstStatus(levels: SystemStatusLevel[]): SystemStatusLevel {
  return levels.includes("problem") ? "problem" : levels.includes("attention") ? "attention" : "ok";
}
export function countStatus(
  count: number | null,
  problemAt: number,
  code: "backlog" | "recent_errors" = "backlog",
) {
  return {
    count,
    status:
      count === null || count >= problemAt
        ? ("problem" as const)
        : count > 0
          ? ("attention" as const)
          : ("ok" as const),
    code: count === null ? ("unavailable" as const) : count > 0 ? code : ("available" as const),
  };
}
export function jobStatus(
  row: typeof systemJobs.$inferSelect | undefined,
  now: Date,
): SystemStatus["components"]["maintenance"] {
  const fields = {
    lastStartedAt: row ? new Date(row.startedAt).toISOString() : null,
    lastFinishedAt: row?.finishedAt ? new Date(row.finishedAt).toISOString() : null,
    outcome: row?.outcome ?? null,
  };
  if (!row) return { ...fields, status: "attention", code: "never_run" };
  if (row.outcome === "failed") return { ...fields, status: "problem", code: "failed" };
  if (row.outcome === "running")
    return {
      ...fields,
      status: now.getTime() - Date.parse(row.startedAt) >= 600000 ? "problem" : "attention",
      code: now.getTime() - Date.parse(row.startedAt) >= 600000 ? "stale" : "running",
    };
  const age = now.getTime() - Date.parse(row.finishedAt ?? row.startedAt);
  return {
    ...fields,
    status: age >= 48 * 3600000 ? "problem" : age >= 26 * 3600000 ? "attention" : "ok",
    code: age >= 26 * 3600000 ? "stale" : "available",
  };
}
export function aiStatus(
  configured: boolean | undefined,
  hourly: SystemStatus["components"]["ai"]["hourly"],
): SystemStatus["components"]["ai"] {
  if (!hourly)
    return {
      status: "problem",
      code: "unavailable",
      configured: configured === true,
      mode: configured === false ? "fallback" : "unknown",
      hourly,
    };
  const errors = hourly.reduce((sum, h) => sum + h.errors, 0);
  const fallbacks = hourly.reduce((sum, h) => sum + h.fallbacks, 0);
  const successes = hourly.reduce((sum, h) => sum + h.successes, 0);
  const base = { configured: configured === true, hourly };
  const degradedMode =
    fallbacks > 0 && successes === 0 ? ("fallback" as const) : ("unknown" as const);
  if (configured === false)
    return { ...base, status: "attention", code: "not_configured", mode: "fallback" };
  if (errors)
    return {
      ...base,
      status: errors >= 5 ? "problem" : "attention",
      code: "ai_errors",
      mode: degradedMode,
    };
  if (fallbacks) return { ...base, status: "attention", code: "ai_fallback", mode: degradedMode };
  if (!successes || configured === undefined)
    return { ...base, status: "attention", code: "no_observations", mode: "unknown" };
  return { ...base, status: "ok", code: "available", mode: "ai" };
}

async function snapshot(s: Services, organizationId: string, now: Date) {
  const currentHour = utcHour(now);
  const from = new Date(Date.parse(currentHour) - 23 * 3600000).toISOString();
  return deadline(
    s.db.transaction(async (tx) => {
      await tx.execute(sql`set transaction read only`);
      await tx.execute(sql`set local statement_timeout = '3s'`);
      const [counts] = await tx
        .select({
          processing: sql<number>`(select count(*)::int from ${documents} d join ${cases} c on c.id = d.case_id
        where c.organization_id = ${organizationId} and d.status = 'processing'
        and d.uploaded_at < ${new Date(now.getTime() - 600000).toISOString()}::timestamptz)`,
          waiting: sql<number>`(select count(*)::int from ${cases} c where c.organization_id = ${organizationId}
        and c.status = 'needs_citizen' and coalesce((select max(e.at) from ${events} e
          where e.case_id = c.id and e.organization_id = ${organizationId}
          and e.type in ('case.requested','case.needs_citizen')), c.updated_at)
          < ${new Date(now.getTime() - 7 * DAY).toISOString()}::timestamptz)`,
          links: sql<number>`(select count(*)::int from ${cases} c where c.organization_id = ${organizationId}
        and c.status <> 'closed' and c.expires_at > ${now.toISOString()}::timestamptz
        and c.expires_at <= ${new Date(now.getTime() + 7 * DAY).toISOString()}::timestamptz)`,
        })
        .from(sql`(select 1) as status_counts`);
      if (!counts) throw new Error("Missing status counts");
      const hourly = await tx
        .select()
        .from(operationalCounters)
        .where(
          and(
            eq(operationalCounters.organizationId, organizationId),
            gte(operationalCounters.hour, from),
            lte(operationalCounters.hour, currentHour),
          ),
        );
      const jobs = await tx.select().from(systemJobs);
      return { counts, hourly, jobs, from };
    }),
    5000,
  );
}

export function mountSystemStatus(app: App, s: Services) {
  let pendingStorage: Promise<Component> | undefined;
  let expires = 0;
  const storageProbe = () => {
    if (!pendingStorage || performance.now() >= expires) {
      expires = performance.now() + 10000;
      pendingStorage = (async (): Promise<Component> => {
        if (!s.storage.health) return { status: "attention", code: "probe_unavailable" };
        try {
          await deadline(s.storage.health(), 3000);
          return { status: "ok", code: "available" };
        } catch {
          return { status: "problem", code: "unavailable" };
        }
      })();
    }
    return pendingStorage;
  };
  app.get("/status", async (c) => {
    const actor = c.get("operator");
    if (actor.role !== "admin")
      throw new ApiFailure("forbidden", 403, "Operazione riservata agli amministratori.");
    parse(SystemStatusQuery, c.req.query());
    const now = s.clock();
    const [data, storage] = await Promise.all([
      snapshot(s, actor.organizationId, now).catch(() => null),
      storageProbe(),
    ]);
    const hourly = data
      ? Array.from({ length: 24 }, (_, index) => {
          const hour = new Date(Date.parse(data.from) + index * 3600000).toISOString();
          const bucket = data.hourly.filter((r) => new Date(r.hour).toISOString() === hour);
          return {
            hour,
            successes: bucket.find((r) => r.metric === "ai_success")?.count ?? 0,
            fallbacks: bucket.find((r) => r.metric === "ai_fallback")?.count ?? 0,
            errors: bucket.find((r) => r.metric === "ai_error")?.count ?? 0,
          };
        })
      : null;
    const unknownJob = {
      status: "problem" as const,
      code: "unavailable" as const,
      lastStartedAt: null,
      lastFinishedAt: null,
      outcome: null,
    };
    const components: SystemStatus["components"] = {
      database: { status: data ? "ok" : "problem", code: data ? "available" : "unavailable" },
      storage,
      ai: aiStatus(s.ai.configured, hourly),
      maintenance: data
        ? jobStatus(
            data.jobs.find((j) => j.kind === "maintenance"),
            now,
          )
        : unknownJob,
      retention: data
        ? jobStatus(
            data.jobs.find((j) => j.kind === "retention"),
            now,
          )
        : unknownJob,
    };
    const counters: SystemStatus["counters"] = {
      documentsProcessingOver10Minutes: countStatus(data?.counts.processing ?? null, 5),
      casesWaitingForCitizenOver7Days: countStatus(data?.counts.waiting ?? null, 10),
      linksExpiringWithin7Days: countStatus(data?.counts.links ?? null, 10),
      recentApiErrors24Hours: countStatus(
        data
          ? data.hourly.filter((h) => h.metric === "api_error").reduce((sum, h) => sum + h.count, 0)
          : null,
        5,
        "recent_errors",
      ),
      notificationsQueued: { status: "ok", code: "not_supported", count: null },
    };
    const version = SystemStatus.shape.version.safeParse({
      commit: s.appVersion?.commit ?? null,
      tag: s.appVersion?.tag ?? null,
    });
    return c.json(
      SystemStatus.parse({
        schemaVersion: 1,
        generatedAt: now.toISOString(),
        status: worstStatus(
          [...Object.values(components), ...Object.values(counters)].map((x) => x.status),
        ),
        version: version.success ? version.data : { commit: null, tag: null },
        components,
        counters,
      }),
    );
  });
}
