import { AiRuntime } from "../src/runtime";
import { loadAiConfig, publicAiConfig } from "../src/config";
import { intakeTask, translateTask } from "../src/tasks";
import type { TaskResult, Transport } from "../src/types";
import { limitArg, writeReport } from "./report";
const concurrency = limitArg("concurrency", 4, 20);
const count = limitArg("limit", 20, 100);
const live = process.env.AI_LIVE === "1";
async function pooled<T>(length: number, work: (index: number) => Promise<T>) {
  let cursor = 0;
  const results: T[] = [];
  await Promise.all(
    Array.from({ length: Math.min(concurrency, length) }, async () => {
      while (cursor < length) {
        const i = cursor++;
        results[i] = await work(i);
      }
    }),
  );
  return results;
}
const localConfig = {
  ...loadAiConfig({
    AI_PROVIDER: "openrouter",
    OPENROUTER_API_KEY: "synthetic",
    AI_MODEL_FAST: "test/model:free",
  }),
  maxAttempts: 1,
  attemptTimeoutMs: 20,
  totalTimeoutMs: 30,
  circuitFailures: 2,
  circuitCooldownMs: 10,
};
const input = {
  text: "Devo fare ISEE",
  language: "it" as const,
  practiceId: null,
  questions: [],
  now: new Date("2027-01-01Z"),
};
const started = performance.now();
const scenarios = [];
for (const fault of ["429", "timeout"] as const) {
  let phase: "fault" | "recover" = "fault",
    now = 0,
    transportCalls = 0;
  const transport: Transport = async () => {
    transportCalls++;
    if (phase === "fault") {
      if (fault === "429") throw { statusCode: 429 };
      return new Promise(() => {});
    }
    return {
      output: {
        practiceId: "isee_ordinario",
        confidence: 1,
        answers: {},
        reply: "",
        manipulation: false,
      },
    };
  };
  const runtime = new AiRuntime(localConfig, {
    transport,
    clock: () => now,
    sleep: async () => {},
  });
  const first = await pooled(count, () => runtime.runTask(intakeTask, input));
  const open = runtime.circuit.snapshot().some((s) => s.failures >= localConfig.circuitFailures);
  const blocked = await runtime.runTask(intakeTask, input);
  phase = "recover";
  now = 100;
  const recovered = await runtime.runTask(intakeTask, input);
  const closed = runtime.circuit.snapshot().length === 0;
  scenarios.push({
    fault,
    status:
      first.every((r) => r.engine === "heuristic" && r.output.practiceId === "isee_ordinario") &&
      open &&
      blocked.fallbackReason === "circuit_open" &&
      recovered.engine === "ai" &&
      closed
        ? "PASS"
        : "FAIL",
    fallback: first.filter((r) => r.engine === "heuristic").length,
    opened: open,
    suppressedWhileOpen: blocked.attempts === 0,
    recovered: recovered.engine === "ai",
    closed,
    transportCalls,
  });
}
const config = loadAiConfig(live ? process.env : {});
const blocked = live && (!config.key || config.provider === "none");
const results: TaskResult<unknown>[] = [];
if (live && !blocked) {
  const runtime = new AiRuntime(config);
  results.push(
    ...(await pooled(count, (i) =>
      runtime.runTask(translateTask, {
        text: "Porta il documento allo sportello.",
        language: (["en", "fr", "ar", "bn"] as const)[i % 4]!,
      }),
    )),
  );
}
const summary = {
  status: blocked ? "BLOCKED" : scenarios.some((s) => s.status === "FAIL") ? "FAIL" : "PASS",
  mode: live ? "live" : "deterministic",
  reason: blocked ? "missing_provider_or_key" : null,
  concurrency,
  cases: live ? results.length : scenarios.reduce((sum, scenario) => sum + scenario.fallback, 0),
  liveCases: results.length,
  requests: results.reduce((n, r) => n + r.attempts, 0),
  ai: results.filter((r) => r.engine === "ai").length,
  heuristic: results.filter((r) => r.engine === "heuristic").length,
  observed429: results.filter((r) => r.fallbackReason === "rate_limit").length,
  observedTimeout: results.filter((r) => r.fallbackReason === "timeout").length,
  wallMs: Math.round(performance.now() - started),
  costEstimateEur: results.reduce((n, r) => n + r.costEstimate, 0),
};
const report = {
  generatedAt: new Date().toISOString(),
  configuration: publicAiConfig(config),
  summary,
  deterministicFaultInjection: scenarios,
  live: results.map(({ output: _output, ...metadata }) => metadata),
  limitations: [
    "429/timeout breaker lifecycle scenarios inject faults locally; they are not provider observations",
    "Observed429/Timeout counts final fallback reasons; intermediate retries may recover",
    "No live network without AI_LIVE=1; limit <=100 cases, attempts bounded by AI_MAX_ATTEMPTS",
  ],
};
const path = await writeReport(
  "ai-stress",
  live ? "live" : "deterministic",
  report,
  `# AI stress\n\n${JSON.stringify(summary, null, 2)}\n\n## Deterministic fault injection\n\n${JSON.stringify(scenarios, null, 2)}\n\n${report.limitations.map((s) => `- ${s}`).join("\n")}\n`,
);
console.info(JSON.stringify({ summary, scenarios, report: path }));
if (summary.status !== "PASS") process.exitCode = 1;
