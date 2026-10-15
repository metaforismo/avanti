// Local, synthetic integration load: real Hono handlers and PostgreSQL connections.
import { readFile, writeFile } from "node:fs/promises";
import { cpus, totalmem, platform, release, loadavg } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { CaseDossier } from "@avanti/contracts";
import { createDatabase, operators, sessions, repoRoot } from "@avanti/db";
import { seedVolume, volumeId, volumeToken, VOLUME_NOW } from "@avanti/db/volume";
import { demoSeedAllowed } from "../../db/src/seed-guard";
import { createApp } from "./app";
import { GatewayIntelligence } from "./ai";
import { MemoryStorage } from "./storage";
import { hashToken } from "./security";
import { resolve } from "node:path";

const options: Record<string, string> = {};
const args = process.argv.slice(2).filter((arg) => arg !== "--");
for (let i = 0; i < args.length; i += 2) {
  if (
    ![
      "--operators",
      "--citizens",
      "--iterations",
      "--cases",
      "--hot-cases",
      "--shared-ip",
      "--upload-mode",
      "--output",
    ].includes(args[i]!) ||
    !args[i + 1]
  )
    throw new Error(
      "Usage: bench:load [--operators 30] [--citizens 200] [--iterations 5] [--cases 5000] [--hot-cases 0] [--shared-ip 0|1] [--upload-mode metadata|file] [--output path]",
    );
  options[args[i]!] = args[i + 1]!;
}
function integer(key: string, fallback: number, min: number, max: number) {
  const value = Number(options[key] ?? fallback);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Invalid ${key}`);
  return value;
}
const operatorCount = integer("--operators", 30, 1, 100);
const citizenCount = integer("--citizens", 200, 0, 1000);
const iterations = integer("--iterations", 5, 1, 20);
const hotCases = integer("--hot-cases", 0, 0, operatorCount);
const sharedIp = integer("--shared-ip", 0, 0, 1) === 1;
const uploadMode = options["--upload-mode"] ?? "metadata";
if (!["metadata", "file"].includes(uploadMode)) throw new Error("Invalid --upload-mode");
const caseCount = integer("--cases", 5000, 6 * (operatorCount + citizenCount + 1), 20000);
const originalUrl = process.env.DATABASE_URL;
const originalSeedOptIn = process.env.AVANTI_LOCAL_PG_SEED;
if (!originalUrl) throw new Error("DATABASE_URL must point at the local test cluster");
const url = new URL(originalUrl);
const databaseName = `avanti_load_${process.pid}_${randomBytes(4).toString("hex")}_test`;
url.pathname = `/${databaseName}`;
// Do not connect before validating the endpoint, including host override query options.
if (!demoSeedAllowed({ ...process.env, DATABASE_URL: url.href, AVANTI_LOCAL_PG_SEED: "1" }))
  throw new Error(
    "bench:load requires a non-production loopback Postgres URL without query options",
  );
const admin = await createDatabase({ url: originalUrl, migrate: false });
let created = false;
let resource: Awaited<ReturnType<typeof createDatabase>> | undefined;
let observer: Awaited<ReturnType<typeof createDatabase>> | undefined;
let monitoring = false;
let monitor: Promise<void> | undefined;
let stopped = false;
const stop = () => {
  stopped = true;
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
const round = (n: number) => Number(n.toFixed(2));
const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? round(sorted[Math.ceil(sorted.length * p) - 1]!) : 0;
};
try {
  await admin.db.execute(sql`create database ${sql.identifier(databaseName)}`);
  created = true;
  process.env.DATABASE_URL = url.href;
  process.env.AVANTI_LOCAL_PG_SEED = "1";
  resource = await createDatabase({ url: url.href, migrate: true });
  const db = resource.db;
  await seedVolume(db, caseCount);
  const cookies: string[] = [];
  for (let i = 0; i < operatorCount; i++) {
    const token = randomBytes(32).toString("base64url");
    cookies.push(`avanti_session=${token}`);
    await db.insert(operators).values({
      id: `load-operator-${i}`,
      organizationId: "demo-caf-milano",
      name: "ESEMPIO",
      email: `load-${i}@example.invalid`,
      passwordHash: "unusable",
      role: "operator",
    });
    await db.insert(sessions).values({
      id: `load-session-${i}`,
      operatorId: `load-operator-${i}`,
      tokenHash: hashToken(token),
      createdAt: VOLUME_NOW,
      expiresAt: "2027-01-15T12:30:00Z",
    });
  }
  const jobs = new Set<Promise<void>>();
  let backgroundErrors = 0;
  const app = createApp({
    db,
    storage: new MemoryStorage(),
    clock: () => new Date(VOLUME_NOW),
    // Force the real local fallback even if the shell has an AI credential.
    ai: new GatewayIntelligence(),
    clientAddress: sharedIp ? () => "192.0.2.1" : undefined,
    rateLimitSecret: "synthetic-local-load-secret",
    mfaEncryptionKey: "a".repeat(64),
    errorLogger: () => {},
    background(work) {
      const job = work()
        .catch(() => {
          backgroundErrors++;
        })
        .finally(() => jobs.delete(job));
      jobs.add(job);
    },
  });
  // Separate monitoring connection; never competes for an application pool slot.
  observer = await createDatabase({
    url: url.href,
    migrate: false,
    poolMax: 1,
    applicationName: "avanti-load-observer",
  });
  const stats = async () => {
    const rows = await observer!.db.execute(sql`
      select deadlocks::int, conflicts::int from pg_stat_database where datname = current_database()`);
    return (rows as { deadlocks: number; conflicts: number }[])[0]!;
  };
  const before = await stats();
  const image =
    uploadMode === "file"
      ? await readFile(new URL("./fixtures/rotated-exif.jpg", import.meta.url))
      : null;
  const samples: {
    atMs: number;
    connections: number;
    active: number;
    lockWaiting: number;
    ungranted: number;
    oldestLockMs: number;
    oldestTransactionMs: number;
  }[] = [];
  const timing = new Map<string, number[]>();
  const statuses: Record<string, number> = {};
  let errors = 0,
    conflicts = 0,
    inFlight = 0,
    peakInFlight = 0;
  const started = performance.now();
  monitoring = true;
  monitor = (async () => {
    while (monitoring) {
      const rows = await observer!.db.execute(sql`
        select count(*)::int as connections,
          count(*) filter (where state = 'active')::int as active,
          count(*) filter (where wait_event_type = 'Lock')::int as lock_waiting,
          (select count(*)::int from pg_locks l join pg_stat_activity a using(pid)
            where a.datname = current_database() and a.application_name = 'avanti' and not l.granted) as ungranted,
          coalesce(max(extract(epoch from (clock_timestamp() - query_start))*1000)
            filter (where wait_event_type = 'Lock'), 0)::float8 as oldest_lock_ms,
          coalesce(max(extract(epoch from (clock_timestamp() - xact_start))*1000), 0)::float8 as oldest_transaction_ms
        from pg_stat_activity where datname = current_database() and application_name = 'avanti'`);
      const row = (
        rows as {
          connections: number;
          active: number;
          lock_waiting: number;
          ungranted: number;
          oldest_lock_ms: number;
          oldest_transaction_ms: number;
        }[]
      )[0]!;
      samples.push({
        atMs: round(performance.now() - started),
        connections: row.connections,
        active: row.active,
        lockWaiting: row.lock_waiting,
        ungranted: row.ungranted,
        oldestLockMs: round(row.oldest_lock_ms),
        oldestTransactionMs: round(row.oldest_transaction_ms),
      });
      await delay(100);
    }
  })();
  async function request(
    name: string,
    path: string,
    cookie?: string,
    payload?: unknown,
    method?: string,
  ) {
    inFlight++;
    peakInFlight = Math.max(peakInFlight, inFlight);
    const start = performance.now();
    try {
      const form = payload instanceof FormData;
      const response = await app.request(path, {
        method: method ?? (payload ? "POST" : "GET"),
        headers: {
          Origin: "http://localhost:3400",
          ...(cookie ? { Cookie: cookie } : {}),
          ...(payload && !form ? { "Content-Type": "application/json" } : {}),
        },
        ...(payload ? { body: form ? payload : JSON.stringify(payload) } : {}),
      });
      const body: unknown = await response.json();
      statuses[response.status] = (statuses[response.status] ?? 0) + 1;
      if (!response.ok) {
        if (response.status === 409 && hotCases > 0 && cookie) conflicts++;
        else errors++;
        return null;
      }
      return body;
    } catch {
      statuses.transport = (statuses.transport ?? 0) + 1;
      errors++;
      return null;
    } finally {
      const values = timing.get(name) ?? [];
      values.push(performance.now() - start);
      timing.set(name, values);
      inFlight--;
    }
  }
  const workers = await Promise.allSettled([
    ...Array.from({ length: operatorCount }, async (_, i) => {
      const id = volumeId(3 + 6 * (hotCases ? i % hotCases : i));
      const cookie = cookies[i]!;
      for (let n = 0; n < iterations && !stopped; n++) {
        await request("queue", "/api/cases?limit=25", cookie);
        const dossier = await request("dossier", `/api/cases/${id}`, cookie);
        if (!dossier) continue;
        let current = CaseDossier.parse(dossier);
        const note = await request(
          "note",
          `/api/cases/${id}`,
          cookie,
          { expectedUpdatedAt: current.updatedAt, internalNotes: `ESEMPIO ${n}` },
          "PATCH",
        );
        if (!note) continue;
        current = CaseDossier.parse(note);
        const item = current.checklist.find((entry) => entry.documentIds.length);
        if (!item) throw new Error("Missing seeded document");
        const reviewed = await request(
          "review",
          `/api/cases/${id}/checklist/${item.id}/review`,
          cookie,
          { expectedUpdatedAt: current.updatedAt, decision: "verified" },
        );
        if (!reviewed) continue;
        current = CaseDossier.parse(reviewed);
        const requested = await request("request", `/api/cases/${id}/requests`, cookie, {
          expectedUpdatedAt: current.updatedAt,
          checklistItemIds: [item.id],
          message: "ESEMPIO: integra il documento.",
        });
        if (!requested) continue;
        current = CaseDossier.parse(requested);
        await request(
          "state",
          `/api/cases/${id}`,
          cookie,
          { expectedUpdatedAt: current.updatedAt, status: "in_review" },
          "PATCH",
        );
      }
    }),
    ...Array.from({ length: citizenCount }, async (_, i) => {
      const number = 1 + 6 * (operatorCount + i);
      const token = volumeToken(number);
      for (let n = 0; n < iterations && !stopped; n++) {
        await request("turn", `/api/c/${token}/turn`, undefined, {
          type: "answer",
          questionId: "housing",
          value: "hosted",
        });
        if (image) {
          const form = new FormData();
          form.set("file", new File([image], "ESEMPIO.jpg", { type: "image/jpeg" }));
          await request("upload", `/api/c/${token}/documents`, undefined, form);
        } else {
          await request(
            "uploadMetadata",
            `/api/c/${token}/documents/${volumeId(number)}-doc-0`,
            undefined,
            { checklistItemId: null },
            "PATCH",
          );
        }
      }
    }),
  ]);
  while (jobs.size) await Promise.all(jobs);
  const failedWorker = workers.find((result) => result.status === "rejected");
  if (failedWorker?.status === "rejected") throw failedWorker.reason;
  const elapsedMs = performance.now() - started;
  monitoring = false;
  await monitor;
  // Stats can be flushed on idle; allow the PG stats collector one interval.
  await delay(1100);
  const after = await stats();
  const all = [...timing.values()].flat();
  const distribution = (values: number[]) => ({
    count: values.length,
    p50Ms: percentile(values, 0.5),
    p95Ms: percentile(values, 0.95),
    p99Ms: percentile(values, 0.99),
    maxMs: round(Math.max(0, ...values)),
  });
  const result = {
    schemaVersion: 1,
    stopped,
    timestamp: new Date().toISOString(),
    environment: {
      platform: platform(),
      release: release(),
      cpu: cpus()[0]?.model,
      cores: cpus().length,
      memoryGiB: round(totalmem() / 2 ** 30),
      node: process.version,
      loadavg: loadavg(),
      postgres: ((await db.execute(sql`select version()`)) as { version: string }[])[0]?.version,
    },
    workload: {
      operatorCount,
      citizenCount,
      iterations,
      caseCount,
      hotCases,
      sharedIp,
      uploadMode,
      poolMax: process.env.DATABASE_POOL_MAX ?? "5",
      statementTimeoutMs: process.env.DATABASE_STATEMENT_TIMEOUT_MS ?? "15000",
      lockTimeoutMs: process.env.DATABASE_LOCK_TIMEOUT_MS ?? "3000",
      sampleIntervalMs: 100,
    },
    elapsedMs: round(elapsedMs),
    throughputRps: round((all.length * 1000) / elapsedMs),
    successfulRps: round(((all.length - errors - conflicts) * 1000) / elapsedMs),
    requests: distribution(all),
    operations: Object.fromEntries([...timing].map(([key, values]) => [key, distribution(values)])),
    statuses,
    errors,
    conflicts,
    backgroundErrors,
    deadlocks: after.deadlocks - before.deadlocks,
    pool: {
      peakInFlight,
      peakConnections: Math.max(0, ...samples.map((s) => s.connections)),
      peakActive: Math.max(0, ...samples.map((s) => s.active)),
      saturatedSamples: samples.filter(
        (s) => s.active >= Number(process.env.DATABASE_POOL_MAX ?? 5),
      ).length,
    },
    locks: {
      samples: samples.length,
      waitingSamples: samples.filter((s) => s.lockWaiting > 0).length,
      peakWaiting: Math.max(0, ...samples.map((s) => s.lockWaiting)),
      peakUngranted: Math.max(0, ...samples.map((s) => s.ungranted)),
      oldestWaitingQueryMs: Math.max(0, ...samples.map((s) => s.oldestLockMs)),
      oldestTransactionMs: Math.max(0, ...samples.map((s) => s.oldestTransactionMs)),
    },
    samples,
  };
  const output = JSON.stringify(result, null, 2) + "\n";
  if (options["--output"]) await writeFile(resolve(repoRoot, options["--output"]), output);
  console.info(output);
  if (errors || backgroundErrors || result.deadlocks) process.exitCode = 1;
  if (stopped) process.exitCode = 130;
} finally {
  monitoring = false;
  await monitor?.catch(() => {});
  await observer?.close();
  await resource?.close();
  if (originalUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalUrl;
  if (originalSeedOptIn === undefined) delete process.env.AVANTI_LOCAL_PG_SEED;
  else process.env.AVANTI_LOCAL_PG_SEED = originalSeedOptIn;
  try {
    if (created) await admin.db.execute(sql`drop database ${sql.identifier(databaseName)}`);
  } finally {
    await admin.close();
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
  }
}
