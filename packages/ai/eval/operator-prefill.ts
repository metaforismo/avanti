import { writeFile } from "node:fs/promises";
import { AiRuntime } from "../src/runtime";
import { loadAiConfig } from "../src/config";
import { dsuPrefillTask } from "../src/operator-tasks";
import { operatorEvalTransport } from "./operator-transport";
import { verificationDir } from "./report";
const live = process.env.AI_LIVE === "1";
const config = loadAiConfig(live ? process.env : {});
if (live && (config.provider !== "openrouter" || !config.key))
  throw new Error("Explicit OpenRouter live configuration required");
const receipts: Parameters<typeof operatorEvalTransport>[1] = [];
const a = {
  sectionId: "FC2:m_demo:account_0",
  fieldId: "saldo~one",
  label: "Saldo al 31 dicembre",
  value: 1234.56,
  documentId: "doc_demo",
  page: 1,
  confidence: 0.99,
  note: "Saldo: 1.234,56 euro",
};
const rows = [];
for (const conflict of [false, true]) {
  const runtime = new AiRuntime(
    config,
    live ? { transport: operatorEvalTransport(config, receipts) } : {},
  );
  const result = await runtime.runTask(dsuPrefillTask, {
    candidates: conflict
      ? [
          a,
          {
            ...a,
            fieldId: "saldo~two",
            value: 999,
            documentId: "doc_demo_2",
            note: "Saldo: 999,00 euro",
          },
        ]
      : [a],
  });
  rows.push({
    id: conflict ? "different_ids_conflict" : "known_candidate",
    engine: result.engine,
    model: result.model,
    pass:
      (conflict ? result.output.fields.length === 0 : result.output.fields[0]?.value === 1234.56) &&
      (!live || result.engine === "ai"),
    attempts: result.attempts,
    latencyMs: result.latencyMs,
    fallbackReason: result.fallbackReason,
  });
}
const report = {
  task: dsuPrefillTask.id,
  version: dsuPrefillTask.version,
  policy: config.dataPolicy,
  rows,
  receipts,
  requests: receipts.length,
  costUsd: receipts.reduce((sum, r) => sum + (r.costUsd ?? 0), 0),
};
await writeFile(
  `${verificationDir}/ai-eval-operator-prefill-v2.json`,
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
