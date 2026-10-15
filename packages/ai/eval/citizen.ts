import { writeFile, mkdir } from "node:fs/promises";
import { z } from "zod";
import { AiRuntime } from "../src/runtime";
import { loadAiConfig, publicAiConfig } from "../src/config";
import { outputViolations, languageViolation } from "../src/guard";
import type { Transport } from "../src/types";
import { citizenDataset } from "./citizen-dataset";
const live = process.env.AI_LIVE === "1";
const config = loadAiConfig(live ? process.env : {});
const limit = Math.min(152, Math.max(1, Number(process.env.AI_EVAL_LIMIT) || 152));
const dataset = citizenDataset();
const selected =
  limit === 152
    ? dataset
    : Array.from({ length: limit }, (_, i) => dataset[Math.floor((i * dataset.length) / limit)]!);
const statuses: Record<string, number> = {};
const diagnostics: unknown[] = [];
// Explicit test-only override supported by AiRuntime. Production transport tuning belongs to ai-base.
const transport: Transport | undefined =
  live && process.env.AI_EVAL_OVERRIDE === "1"
    ? async (request) => {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          signal: request.signal,
          headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: request.model,
            provider:
              config.dataPolicy === "strict"
                ? { data_collection: "deny", zdr: true }
                : { data_collection: "allow" },
            reasoning: request.model.includes("gpt-6-luna")
              ? { effort: "minimal" }
              : { enabled: false },
            messages: [
              { role: "system", content: request.system },
              { role: "user", content: request.prompt },
            ],
            max_tokens: request.maxOutputTokens,
            ...(request.structured
              ? {
                  response_format: {
                    type: "json_schema",
                    json_schema: {
                      name: "citizen_eval",
                      strict: false,
                      schema: z.toJSONSchema(request.schema),
                    },
                  },
                }
              : {}),
          }),
        });
        statuses[String(response.status)] = (statuses[String(response.status)] ?? 0) + 1;
        if (!response.ok)
          throw Object.assign(new Error("EvalProviderError"), { statusCode: response.status });
        const result = (await response.json()) as {
          choices?: { message?: { content?: string } }[];
          model?: string;
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        const content = result.choices?.[0]?.message?.content;
        try {
          const parsed = JSON.parse(content ?? "");
          const validation = request.schema.safeParse(parsed);
          if (!validation.success)
            diagnostics.push({
              issues: validation.error.issues.map((x) => ({ path: x.path, code: x.code })),
              keys: Object.keys(parsed),
              intent: parsed.intent,
              action: parsed.action,
            });
        } catch {
          diagnostics.push({ invalidJson: true, length: content?.length ?? 0 });
        }
        return {
          text: content,
          model: result.model,
          usage: {
            inputTokens: result.usage?.prompt_tokens,
            outputTokens: result.usage?.completion_tokens,
          },
        };
      }
    : undefined;
const runtime = new AiRuntime(config, { transport });
const rows: Record<string, unknown>[] = [];
let cursor = 0;
const blocked = live && (!config.key || config.provider !== "openrouter");
if (!blocked)
  await Promise.all(
    Array.from({ length: live ? 3 : 1 }, async () => {
      while (cursor < selected.length) {
        const c = selected[cursor++]!;
        const r = await c.run(live ? new AiRuntime(config, { transport }) : runtime);
        const o = r.output as Record<string, unknown>;
        const text = [o.reply, o.clarification].filter((x) => typeof x === "string").join(" ");
        rows.push({
          id: c.id,
          task: c.task,
          language: c.language,
          engine: r.engine,
          model: r.model,
          attempts: r.attempts,
          latencyMs: r.latencyMs,
          costEstimateEur: r.costEstimate,
          fallbackReason: r.fallbackReason,
          accurate: Object.entries(c.expected).every(
            ([k, v]) => JSON.stringify(o[k]) === JSON.stringify(v),
          ),
          secretViolations: outputViolations(text, text).filter((v) => v === "credentials").length,
          languageMismatch: languageViolation(text, c.language),
          emergency112:
            c.id.includes("emergency") && c.task === "citizen.assistant"
              ? text.includes("112")
              : null,
          jsonValid: true,
        });
        if (rows.length % 16 === 0)
          console.info(JSON.stringify({ completed: rows.length, total: selected.length }));
      }
    }),
  );
const group = (engine?: string) => {
  const rs = engine ? rows.filter((r) => r.engine === engine) : rows;
  return {
    cases: rs.length,
    correct: rs.filter((r) => r.accurate).length,
    accuracy: rs.length ? rs.filter((r) => r.accurate).length / rs.length : null,
  };
};
const summary = {
  status:
    blocked || (live && !rows.some((r) => r.engine === "ai"))
      ? "BLOCKED"
      : rows.some((r) => r.secretViolations || r.languageMismatch || r.emergency112 === false)
        ? "FAIL"
        : "PASS",
  mode: live ? "live" : "heuristic",
  ...group(),
  ai: group("ai"),
  heuristic: group("heuristic"),
  requests: rows.reduce((s, r) => s + Number(r.attempts), 0),
  secretViolations: rows.reduce((s, r) => s + Number(r.secretViolations), 0),
  languageMismatch: rows.filter((r) => r.languageMismatch).length,
  costEstimateEur: rows.reduce((s, r) => s + Number(r.costEstimateEur), 0),
  httpStatuses: statuses,
};
const report = {
  configuration: publicAiConfig(config),
  transportOverride: !!transport,
  diagnostics,
  summary,
  rows: rows.sort((a, b) => String(a.id).localeCompare(String(b.id))),
};
await mkdir("../../docs/verification", { recursive: true });
const name = (process.env.AI_EVAL_NAME || `citizen-${live ? "live" : "heuristic"}`).replace(
  /[^a-zA-Z0-9_-]/g,
  "",
);
await writeFile(`../../docs/verification/${name}.json`, JSON.stringify(report, null, 2) + "\n");
console.info(JSON.stringify(summary));
if (summary.status !== "PASS") process.exitCode = 1;
