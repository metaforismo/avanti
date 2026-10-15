import { AiRuntime } from "../src/runtime";
import { loadAiConfig, publicAiConfig } from "../src/config";
import { languageViolation, outputViolations } from "../src/guard";
import { dataset } from "./dataset";
import { arg, limitArg, writeReport } from "./report";

const live = process.env.AI_LIVE === "1";
const config = loadAiConfig(live ? process.env : {});
const blocked = live && (!config.key || config.provider === "none");
const runtime = new AiRuntime(config);
const limit = limitArg("limit", live ? 16 : 200, 200);
const all = await dataset();
const filtered = all.filter((c) => !arg("task") || c.task === arg("task"));
if (!filtered.length) throw new Error("Unknown or empty --task");
// Round-robin across tasks/languages/categories so a limited run is not only the first Italian rows.
const selected =
  limit >= filtered.length
    ? filtered
    : Array.from(
        { length: Math.min(limit, filtered.length) },
        (_, i) => filtered[Math.floor((i * filtered.length) / Math.min(limit, filtered.length))]!,
      );
function fieldsMatch(expected: Record<string, unknown>, actual: Record<string, unknown>): boolean {
  return Object.entries(expected).every(([key, value]) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? fieldsMatch(
          value as Record<string, unknown>,
          (actual[key] ?? {}) as Record<string, unknown>,
        )
      : JSON.stringify(actual[key]) === JSON.stringify(value),
  );
}
const rows: {
  id: string;
  task: string;
  language: string;
  category: string;
  engine: string;
  model: string | null;
  attempts: number;
  latencyMs: number;
  costEstimateEur: number;
  fallbackReason: string | null;
  accurate: boolean | null;
  practiceAccurate: boolean | null;
  tp: number;
  fp: number;
  fn: number;
  guardViolations: number;
  languageCheck: string;
  jsonValid: boolean;
}[] = [];
if (!blocked)
  for (const item of selected) {
    const result = await item.run(runtime);
    const output = result.output as Record<string, unknown>;
    const expectedAnswers = item.expected.answers as Record<string, unknown> | undefined;
    const answers = output.answers as Record<string, unknown> | undefined;
    let tp = 0,
      fp = 0,
      fn = 0;
    if (expectedAnswers && answers) {
      // Household roles/relations are heuristic side facts, outside the supplied form question IDs.
      const sideFacts = new Set(["household_roles", "household_relations"]);
      for (const [key, value] of Object.entries(answers)) {
        if (sideFacts.has(key)) continue;
        if (JSON.stringify(expectedAnswers[key]) === JSON.stringify(value)) tp++;
        else fp++;
      }
      for (const [key, value] of Object.entries(expectedAnswers))
        if (JSON.stringify(answers[key]) !== JSON.stringify(value)) fn++;
    }
    const text = [output.text, output.reply, output.clarification]
      .filter((v) => typeof v === "string")
      .join(" ");
    const check =
      !item.languageExpected || !text.trim()
        ? "unverifiable"
        : languageViolation(text, item.language)
          ? "fail"
          : ["ar", "bn", "uk"].includes(item.language)
            ? "script_pass"
            : "latin_unverified";
    // Contacts are checked by the runtime against each task's original context. Recheck only secrets here.
    const violations = outputViolations(text, text).filter((v) => v !== "language").length;
    rows.push({
      id: item.id,
      task: item.task,
      language: item.language,
      category: item.category,
      engine: result.engine,
      model: result.model,
      attempts: result.attempts,
      latencyMs: result.latencyMs,
      costEstimateEur: result.costEstimate,
      fallbackReason: result.fallbackReason,
      accurate: Object.keys(item.expected).length ? fieldsMatch(item.expected, output) : null,
      practiceAccurate: Object.hasOwn(item.expected, "practiceId")
        ? item.expected.practiceId === output.practiceId
        : null,
      tp,
      fp,
      fn,
      guardViolations: violations,
      languageCheck: check,
      jsonValid: typeof JSON.parse(JSON.stringify(output)) === "object",
    });
    process.stdout.write(
      JSON.stringify({
        id: item.id,
        engine: result.engine,
        attempts: result.attempts,
        latencyMs: result.latencyMs,
        fallbackReason: result.fallbackReason,
      }) + "\n",
    );
  }
const sum = (
  key: "tp" | "fp" | "fn" | "attempts" | "latencyMs" | "costEstimateEur" | "guardViolations",
) => rows.reduce((n, r) => n + r[key], 0);
const summary = {
  status: blocked ? "BLOCKED" : "PASS",
  reason: blocked ? "missing_provider_or_key" : null,
  mode: live ? "live" : "heuristic",
  cases: rows.length,
  requests: sum("attempts"),
  ai: rows.filter((r) => r.engine === "ai").length,
  heuristic: rows.filter((r) => r.engine === "heuristic").length,
  accuracy: rows.some((r) => r.accurate !== null)
    ? rows.filter((r) => r.accurate === true).length /
      rows.filter((r) => r.accurate !== null).length
    : null,
  scoredCases: rows.filter((r) => r.accurate !== null).length,
  practiceAccuracy: rows.some((r) => r.practiceAccurate !== null)
    ? rows.filter((r) => r.practiceAccurate === true).length /
      rows.filter((r) => r.practiceAccurate !== null).length
    : null,
  translationSemanticAccuracy: "manual_review_required",
  translationAiCoverage: rows.some((r) => r.task === "translate")
    ? rows.filter((r) => r.task === "translate" && r.engine === "ai").length /
      rows.filter((r) => r.task === "translate").length
    : null,
  extractionPrecision: sum("tp") + sum("fp") ? sum("tp") / (sum("tp") + sum("fp")) : null,
  extractionRecall: sum("tp") + sum("fn") ? sum("tp") / (sum("tp") + sum("fn")) : null,
  guardViolations: sum("guardViolations"),
  languageFailures: rows.filter((r) => r.languageCheck === "fail").length,
  languageScriptPass: rows.filter((r) => r.languageCheck === "script_pass").length,
  languageUnverified: rows.filter((r) =>
    ["latin_unverified", "unverifiable"].includes(r.languageCheck),
  ).length,
  jsonValidity: rows.length ? rows.filter((r) => r.jsonValid).length / rows.length : null,
  meanLatencyMs: rows.length ? sum("latencyMs") / rows.length : null,
  costEstimateEur: sum("costEstimateEur"),
};
if (summary.guardViolations || summary.languageFailures) summary.status = "FAIL";
const report = {
  generatedAt: new Date().toISOString(),
  configuration: publicAiConfig(config),
  summary,
  rows,
  limitations: [
    "Synthetic fixtures only; no real citizen data",
    "Accuracy checks only labelled fields; translations need human semantic review",
    "Language checks prove script mismatches only; Latin languages are unverified",
    "Final JSON includes heuristic fallback; not raw model JSON validity",
    "Estimated EUR cost, not provider invoice",
    "No provider call unless AI_LIVE=1; live hard cap 200 cases with bounded runtime attempts",
  ],
};
const path = await writeReport(
  "ai-eval",
  live ? "live" : "heuristic",
  report,
  `# AI eval ${new Date().toISOString().slice(0, 10)}\n\n${JSON.stringify(summary, null, 2)}\n\nConfiguration: ${JSON.stringify(publicAiConfig(config))}\n\n${report.limitations.map((s) => `- ${s}`).join("\n")}\n\nDetailed rows in adjacent JSON. Runtime safety success does not establish model quality.\n`,
);
console.info(JSON.stringify({ summary, report: path }));
if (blocked || summary.status === "FAIL") process.exitCode = 1;
