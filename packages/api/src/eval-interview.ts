/** Synthetic-only evaluation; the production transport remains owned by the runtime session. */
import { writeFile } from "node:fs/promises";
import { z } from "zod";
import {
  AiRuntime,
  loadAiConfig,
  converseTask,
  languageViolation,
  type Transport,
} from "@avanti/ai";
import { applyAnswer } from "@avanti/core";
import { interviewDataset } from "../../ai/eval/interview-dataset";
import { validateProposals, askNext, openQuestions } from "./conversation-state";
const live = process.env.AI_LIVE === "1";
const config = loadAiConfig(live ? process.env : {});
if (live && (config.provider !== "openrouter" || !config.key)) {
  console.info(JSON.stringify({ status: "BLOCKED", reason: "OpenRouter test key unavailable" }));
  process.exit(1);
}
const policy = config.dataPolicy;
// Explicit eval-only override requested by the product brief. No headers or raw errors are logged.
let providerCostUsd = 0;
const providerFailures: { status: number; reason: string }[] = [];
const transport: Transport = async (req) => {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: req.signal,
    headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: req.model,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.prompt },
      ],
      reasoning: req.model.startsWith("deepseek/")
        ? { enabled: false }
        : { effort: "minimal", exclude: true },
      provider:
        policy === "strict" ? { data_collection: "deny", zdr: true } : { data_collection: "allow" },
      max_tokens: req.maxOutputTokens,
      ...(req.structured && process.env.AI_EVAL_JSON_MODE !== "text"
        ? {
            response_format: {
              type: "json_schema",
              json_schema: { name: "interview", strict: false, schema: z.toJSONSchema(req.schema) },
            },
          }
        : {}),
    }),
  });
  if (!response.ok) {
    const failure = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    const message = failure?.error?.message ?? "";
    providerFailures.push({
      status: response.status,
      reason: /zero.data|zdr|data policy/i.test(message)
        ? "zdr_unavailable"
        : /endpoint/i.test(message)
          ? "endpoint_unavailable"
          : /schema|structured/i.test(message)
            ? "schema_unsupported"
            : /reasoning|effort/i.test(message)
              ? "reasoning_unsupported"
              : /model/i.test(message)
                ? "model_unavailable"
                : "provider_error",
    });
    throw Object.assign(new Error("ProviderRequestFailed"), { statusCode: response.status });
  }
  const body = (await response.json()) as {
    model?: string;
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
  };
  if (typeof body.usage?.cost === "number") providerCostUsd += body.usage.cost;
  return {
    text: body.choices?.[0]?.message?.content,
    model: body.model,
    usage: { inputTokens: body.usage?.prompt_tokens, outputTokens: body.usage?.completion_tokens },
  };
};
const now = new Date("2027-01-05T10:00:00Z");
const requestedLimit = Math.min(80, Math.max(1, Number(process.env.AI_EVAL_LIMIT ?? 80)));
const dataset = interviewDataset().filter(
  (item) => !process.env.AI_EVAL_CATEGORY || item.category === process.env.AI_EVAL_CATEGORY,
);
const limit = Math.min(requestedLimit, dataset.length);
const selected =
  limit === dataset.length
    ? dataset
    : Array.from({ length: limit }, (_, i) => dataset[Math.floor((i * dataset.length) / limit)]!);
const rows: {
  id: string;
  language: string;
  category: string;
  engine: string;
  model: string | null;
  attempts: number;
  fallbackReason: string | null;
  tp: number;
  fp: number;
  fn: number;
  invalid: number;
  structuredAskCorrect: boolean;
  languageScriptMismatch: boolean;
  latencyMs: number;
  costEstimateEur: number;
  rawProposals: unknown;
  validatedProposals: unknown;
  reply: string;
}[] = [];
const concurrency = Math.min(4, Math.max(1, Number(process.env.AI_EVAL_CONCURRENCY ?? 1)));
async function evaluate(item: (typeof selected)[number]) {
  // Isolate examples so a breaker opened by one sample cannot turn the rest into offline results.
  const result = await new AiRuntime(config, { transport }).runTask(converseTask, item.input);
  const row = {
    practiceId: item.input.practiceId,
    answers: item.input.answered,
    language: item.language,
    editingQuestion: null,
  };
  const texts = [
    ...item.input.turns.filter((t) => t.role === "citizen").map((t) => t.text),
    item.input.text,
  ];
  const proposals = validateProposals(row, result.output.proposals, texts, now);
  const actual = Object.fromEntries(proposals.map((p) => [p.questionId, p.value]));
  const matches = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const tp = Object.entries(actual).filter(([id, v]) => matches(item.expected[id], v)).length;
  const fp = Object.keys(actual).length - tp;
  const fn = Object.entries(item.expected).filter(([id, v]) => !matches(actual[id], v)).length;
  const invalid = proposals.filter((p) => {
    try {
      applyAnswer(row.practiceId, row.answers, p.questionId, p.value, row.language, now);
      return false;
    } catch {
      return true;
    }
  }).length;
  const ask = askNext(openQuestions(row));
  rows.push({
    id: item.id,
    language: item.language,
    category: item.category,
    engine: result.engine,
    model: result.model,
    attempts: result.attempts,
    fallbackReason: result.fallbackReason,
    tp,
    fp,
    fn,
    invalid,
    structuredAskCorrect: ask[0]?.id === item.input.openQuestions[0]?.id,
    languageScriptMismatch: languageViolation(result.output.reply, item.language),
    latencyMs: result.latencyMs,
    costEstimateEur: result.costEstimate,
    rawProposals: result.output.proposals,
    validatedProposals: actual,
    reply: result.output.reply,
  });
  console.info(
    JSON.stringify({ id: item.id, engine: result.engine, reason: result.fallbackReason }),
  );
}
for (let offset = 0; offset < selected.length; offset += concurrency) {
  const results = await Promise.allSettled(
    selected.slice(offset, offset + concurrency).map(evaluate),
  );
  if (results.some((result) => result.status === "rejected"))
    throw new Error("SyntheticEvaluationFailed");
}
rows.sort(
  (a, b) =>
    selected.findIndex((item) => item.id === a.id) - selected.findIndex((item) => item.id === b.id),
);
const sum = (key: "tp" | "fp" | "fn" | "invalid" | "attempts" | "latencyMs" | "costEstimateEur") =>
  rows.reduce((a, r) => a + r[key], 0);
const summary = {
  concurrency,
  providerCostUsd,
  mode: live ? "live" : "offline",
  model: config.models.fast,
  policy,
  cases: rows.length,
  ai: rows.filter((r) => r.engine === "ai").length,
  requests: sum("attempts"),
  precision: sum("tp") + sum("fp") ? sum("tp") / (sum("tp") + sum("fp")) : null,
  recall: sum("tp") / (sum("tp") + sum("fn")),
  tp: sum("tp"),
  fp: sum("fp"),
  fn: sum("fn"),
  invalidAfterValidation: sum("invalid"),
  structuredAskAccuracy: rows.filter((r) => r.structuredAskCorrect).length / rows.length,
  languageScriptMismatches: rows.filter((r) => r.languageScriptMismatch).length,
  meanLatencyMs: sum("latencyMs") / rows.length,
  costEstimateEur: sum("costEstimateEur"),
};
const suffix = live ? `${config.models.fast.split("/").at(-1)}-${policy}` : "offline";
await writeFile(
  new URL(
    `../../../docs/verification/ai-eval-interview-${suffix}-v${converseTask.version}${process.env.AI_EVAL_CATEGORY ? `-${process.env.AI_EVAL_CATEGORY}` : ""}.json`,
    import.meta.url,
  ),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      taskVersion: converseTask.version,
      summary,
      providerFailures,
      transportOverride: `eval-only: DeepSeek reasoning disabled; ${process.env.AI_EVAL_JSON_MODE === "text" ? "JSON text with local schema validation" : "JSON schema non-strict"}; isolated breaker per sample`,
      rows,
    },
    null,
    2,
  ),
);
console.info(JSON.stringify(summary));
