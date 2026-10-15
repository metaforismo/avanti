// Deliberately only Node imports here: cold import timing must include the API dependency graph.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { registerHooks } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import { cpus, platform, release, totalmem } from "node:os";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const rounded = (n: number) => Number(n.toFixed(2));
const quantile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return rounded(sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)]!);
};

if (process.argv.includes("--cold")) {
  const loaded: string[] = [];
  const hook = registerHooks({
    load(url, context, nextLoad) {
      loaded.push(url);
      return nextLoad(url, context);
    },
  });
  const start = performance.now();
  const api = await import("./index");
  const imported = performance.now();
  const cached = loaded;
  const { createDatabase } = await import("@avanti/db");
  const database = await createDatabase({ memory: true });
  try {
    const app = api.createApp({
      db: database.db,
      storage: new api.MemoryStorage(),
      clock: () => new Date("2027-01-15T12:00:00Z"),
    });
    const ready = performance.now();
    const response = await app.request("/api/health");
    await response.arrayBuffer();
    if (response.status !== 200) throw new Error("Cold health failed");
    const end = performance.now();
    hook.deregister();
    console.info(
      JSON.stringify({
        importMs: rounded(imported - start),
        databaseInitMs: rounded(ready - imported),
        firstRequestMs: rounded(end - ready),
        importToFirstResponseMs: rounded(end - start),
        eagerModules: {
          pdf: cached.some((p) => p.includes("/pdf-lib/")),
          fontkit: cached.some((p) => p.includes("/fontkit/")),
          ai: cached.some((p) => /\/ai\/(dist|src)\//.test(p)),
        },
      }),
    );
  } finally {
    await database.close();
    await api.closeRuntimeDatabase();
  }
} else {
  const { assertDemoSeedAllowed } = await import("../../db/src/seed-guard");
  assertDemoSeedAllowed();
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const options: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!["--cases", "--samples", "--output"].includes(args[i]!) || !args[i + 1])
      throw new Error("Usage: bench:api [--cases N] [--samples N] [--output path]");
    options[args[i]!] = args[i + 1]!;
  }
  const { volumeCasesArgument, seedVolume, volumeId, volumeToken, VOLUME_NOW } =
    await import("@avanti/db/volume");
  const count = volumeCasesArgument(["--cases", options["--cases"] ?? "5000"]);
  const samples = Number(options["--samples"] ?? "20");
  if (!Number.isInteger(samples) || samples < 5 || samples > 25)
    throw new Error("samples must be 5–25");
  const cold: {
    importMs: number;
    databaseInitMs: number;
    firstRequestMs: number;
    importToFirstResponseMs: number;
    eagerModules: Record<"pdf" | "fontkit" | "ai", boolean>;
  }[] = [];
  for (let n = 0; n < 5; n++) {
    const { stdout } = await promisify(execFile)(
      process.execPath,
      ["--import", "tsx", fileURLToPath(import.meta.url), "--cold"],
      { maxBuffer: 1024 * 1024 },
    );
    cold.push(JSON.parse(stdout.trim()));
  }
  const { createDatabase, sessions, rateLimits, repoRoot } = await import("@avanti/db");
  const { sql } = await import("drizzle-orm");
  const { hashToken } = await import("./security");
  const { createApp } = await import("./app");
  const { MemoryStorage } = await import("./storage");
  type Query = { query: string; params: unknown[] };
  let queries: Query[] = [];
  const database = await createDatabase({
    memory: true,
    logger: {
      logQuery(query, params) {
        queries.push({ query, params });
      },
    },
  });
  try {
    const seeded = await seedVolume(database.db, count);
    await database.db.insert(sessions).values({
      id: "bench-session",
      operatorId: "demo-admin",
      tokenHash: hashToken("b".repeat(43)),
      createdAt: VOLUME_NOW,
      expiresAt: "2027-01-15T23:00:00Z",
    });
    const background: (() => Promise<void>)[] = [];
    const app = createApp({
      db: database.db,
      storage: new MemoryStorage(),
      clock: () => new Date(VOLUME_NOW),
      background: (work) => background.push(work),
    });
    const headers = { Cookie: `avanti_session=${"b".repeat(43)}`, Origin: "http://localhost:3400" };
    const request = async (path: string, init: RequestInit = {}) =>
      app.request(path, {
        ...init,
        headers: {
          ...(path.startsWith("/api/c/") ? { Origin: headers.Origin } : headers),
          ...init.headers,
        },
      });
    const firstStart = performance.now();
    const first = await request("/api/cases");
    const firstBody = await first.arrayBuffer();
    if (first.status !== 200)
      throw new Error(`First queue ${first.status}: ${Buffer.from(firstBody).toString()}`);
    const firstQueueMs = rounded(performance.now() - firstStart);
    const page = JSON.parse(Buffer.from(firstBody).toString()) as { nextCursor: string | null };
    const drain = async () => {
      while (background.length) await background.shift()!();
    };
    const paths: Record<string, () => Promise<Response>> = {
      queue: () => request("/api/cases?limit=50"),
      queueFiltered: () =>
        request(
          "/api/cases?status=in_review&officeId=demo-office-centro&assignee=demo-operator&practiceId=isee_ordinario",
        ),
      queueSearch: () => request("/api/cases?q=Esempio%2042"),
      queueReference: () => request("/api/cases?q=VOL-2027-0000042"),
      queueCursor: () => request(`/api/cases?limit=50&cursor=${page.nextCursor ?? ""}`),
      dossier: () => request(`/api/cases/${volumeId(1)}`),
      metrics30: () => request("/api/metrics?from=2026-12-17&to=2027-01-15"),
      metrics90: () => request("/api/metrics?from=2026-10-18&to=2027-01-15"),
      pilotReport: () => request("/api/reports/pilot?from=2026-10-18&to=2027-01-15"),
      systemStatus: () => request("/api/status"),
      audit: () => request("/api/audit?limit=50"),
      auditFiltered: () =>
        request(
          "/api/audit?action=review.completed&operatorId=demo-operator&from=2026-10-18T00:00:00Z&to=2027-01-16T00:00:00Z",
        ),
      auditReference: () => request("/api/audit?reference=VOL-2027-0000042"),
      auditCsv: () =>
        request("/api/audit/export.csv?from=2027-01-01T00:00:00Z&to=2027-01-16T00:00:00Z"),
      citizen: () => request(`/api/c/${volumeToken(1)}`),
      citizenTurn: () =>
        request(`/api/c/${volumeToken(1)}/turn`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "answer", questionId: "housing", value: "hosted" }),
        }),
      uploadMetadata: () =>
        request(`/api/c/${volumeToken(1)}/documents/${volumeId(1)}-doc-0`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checklistItemId: null }),
        }),
    };
    const image = await readFile(new URL("./fixtures/rotated-exif.jpg", import.meta.url));
    paths.upload = async () => {
      const form = new FormData();
      form.set("file", new File([image], "ESEMPIO.jpg", { type: "image/jpeg" }));
      return request(`/api/c/${volumeToken(1)}/documents`, { method: "POST", body: form });
    };
    const measurements: Record<
      string,
      {
        p50Ms: number;
        p95Ms: number;
        bytes: number;
        bytesMin: number;
        bytesMax: number;
        queries: number;
        explainSelectMs: number;
        samplesMs: number[];
      }
    > = {};
    const plans: Record<string, unknown> = {};
    for (const [name, call] of Object.entries(paths)) {
      const times: number[] = [],
        sizes: number[] = [],
        counts: number[] = [];
      let sampleQueries: Query[] = [];
      for (let sample = -1; sample < samples; sample++) {
        await drain();
        await database.db.delete(rateLimits);
        queries = [];
        const started = performance.now();
        const response = await call();
        const bytes = await response.arrayBuffer();
        if (response.status !== 200 && !(name === "upload" && response.status === 201))
          throw new Error(`${name}: HTTP ${response.status}: ${Buffer.from(bytes).toString()}`);
        if (sample >= 0) {
          times.push(performance.now() - started);
          sizes.push(bytes.byteLength);
          counts.push(queries.length);
          if (!sample) sampleQueries = [...queries];
        }
      }
      await drain();
      // Replay actual SELECTs with their bound parameters, without disabling sequential scans.
      let queryMs = 0;
      const explained = [];
      for (const q of sampleQueries.filter((q) => /^select /i.test(q.query))) {
        const explain = sql.empty();
        explain.append(sql.raw("explain (analyze, buffers, format json) "));
        let end = 0;
        for (const match of q.query.matchAll(/\$(\d+)/g)) {
          explain.append(sql.raw(q.query.slice(end, match.index)));
          explain.append(sql`${q.params[Number(match[1]) - 1]}`);
          end = match.index! + match[0].length;
        }
        explain.append(sql.raw(q.query.slice(end)));
        const result = (await database.db.execute(explain)) as { rows: Record<string, unknown>[] };
        explained.push({ query: q.query, plan: result.rows });
        const plan = result.rows[0]?.["QUERY PLAN"] as { "Execution Time": number }[] | undefined;
        queryMs += plan?.[0]?.["Execution Time"] ?? 0;
      }
      plans[name] = explained;
      measurements[name] = {
        p50Ms: quantile(times, 0.5),
        p95Ms: quantile(times, 0.95),
        bytes: quantile(sizes, 0.5),
        bytesMin: Math.min(...sizes),
        bytesMax: Math.max(...sizes),
        samplesMs: times.map(rounded),
        queries: Math.max(...counts),
        explainSelectMs: rounded(queryMs),
      };
      console.info(name, JSON.stringify(measurements[name]));
    }
    const cardinalities = (
      (await database.db.execute(
        sql`select (select count(*) from cases)::int as cases, (select count(*) from documents)::int as documents, (select count(*) from messages)::int as messages, (select count(*) from checklist_reviews)::int as reviews, (select count(*) from events)::int as events`,
      )) as { rows: Record<string, unknown>[] }
    ).rows[0];
    // Verify complete cursor traversal on volume data, outside timing samples.
    const ids = new Set<string>();
    let cursor: string | null = null;
    do {
      const response = await request(`/api/cases?limit=100${cursor ? `&cursor=${cursor}` : ""}`);
      if (response.status !== 200) throw new Error("Cursor traversal failed");
      const result = (await response.json()) as {
        items: { id: string }[];
        nextCursor: string | null;
      };
      for (const item of result.items) {
        if (ids.has(item.id)) throw new Error("Repeated cursor ID");
        ids.add(item.id);
      }
      cursor = result.nextCursor;
    } while (cursor);
    if (ids.size !== count) throw new Error(`Cursor lost rows: ${ids.size}/${count}`);
    const report = {
      measuredAt: new Date().toISOString(),
      method:
        "Hono Fetch in-process, sequential, PGlite memory, one warmup, full response consumed; rate buckets reset and background drained outside timings; EXPLAIN ANALYZE natural plans after samples",
      machine: {
        cpu: cpus()[0]?.model,
        cores: cpus().length,
        memoryGiB: rounded(totalmem() / 2 ** 30),
        platform: platform(),
        release: release(),
        node: process.version,
      },
      samples,
      seeded,
      cardinalities,
      cold,
      firstQueueMs,
      measurements,
      cursorTraversal: ids.size,
      plans,
    };
    if (options["--output"])
      await writeFile(
        resolve(repoRoot, options["--output"]),
        JSON.stringify(report, null, 2) + "\n",
      );
    console.info(
      "BENCH_API",
      JSON.stringify({ cold, firstQueueMs, cardinalities, cursorTraversal: ids.size }),
    );
  } finally {
    await database.close();
  }
}
