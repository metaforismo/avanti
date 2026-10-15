// Explicit synthetic provider probe; never imported by the application or pnpm check.
import { readFile, writeFile } from "node:fs/promises";
import { AiIntelligence } from "./ai";
import { loadAiConfig } from "@avanti/ai";
import { audioMetadata } from "./speech-audio";
if (process.env.AI_LIVE !== "1" || process.env.AI_PROVIDER !== "openrouter")
  throw new Error("ExplicitLiveOptInRequired");
const ai = new AiIntelligence({ config: loadAiConfig(process.env) });
const rows = [];
for (const language of ["it", "es", "ar"] as const) {
  const bytes = new Uint8Array(
    await readFile(new URL(`./fixtures/synthetic-speech-${language}.wav`, import.meta.url)),
  );
  const mime = await audioMetadata(bytes);
  const start = performance.now();
  const result = await ai.transcribe({ bytes, mime, language });
  rows.push({ ...result, latencyMs: Math.round(performance.now() - start) });
}
const report = { policy: process.env.AI_DATA_POLICY, synthetic: true, rows };
await writeFile(
  `../../docs/verification/citizen-speech-${process.env.AI_DATA_POLICY}.json`,
  JSON.stringify(report, null, 2) + "\n",
);
console.info(JSON.stringify(report));
