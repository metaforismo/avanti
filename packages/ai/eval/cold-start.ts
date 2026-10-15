import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { writeReport } from "./report";
const cwd = fileURLToPath(new URL("../../api/", import.meta.url));
const baseline = spawnSync("git", ["show", "HEAD:packages/api/src/ai.ts"], {
  cwd,
  encoding: "utf8",
});
if (baseline.status !== 0) throw new Error("Baseline unavailable");
const { writeFile, unlink } = await import("node:fs/promises");
const path = fileURLToPath(new URL("../../api/src/.ai-baseline.ts", import.meta.url));
await writeFile(path, baseline.stdout);
const rows: { kind: string; importMs: number; heapDeltaBytes: number }[] = [];
try {
  for (let i = 0; i < 6; i++)
    for (const kind of ["baseline", "runtime"]) {
      const target = kind === "baseline" ? "./src/.ai-baseline.ts" : "./src/ai.ts";
      const code = `const start=performance.now(), memory=process.memoryUsage().heapUsed; await import(${JSON.stringify(target)}); console.log(JSON.stringify({importMs:performance.now()-start,heapDeltaBytes:process.memoryUsage().heapUsed-memory}));`;
      const result = spawnSync(
        process.execPath,
        ["--import", "tsx", "--input-type=module", "-e", code],
        { cwd, encoding: "utf8" },
      );
      if (result.status !== 0) throw new Error("Cold import measurement failed");
      rows.push({ kind, ...JSON.parse(result.stdout) });
    }
} finally {
  await unlink(path);
}
const median = (kind: string) => {
  const values = rows
    .filter((r) => r.kind === kind)
    .map((r) => r.importMs)
    .sort((a, b) => a - b);
  return (values[2]! + values[3]!) / 2;
};
const summary = {
  baselineMedianMs: median("baseline"),
  runtimeMedianMs: median("runtime"),
  samplesPerVariant: 6,
  scope:
    "API intelligence module import, fresh Node processes, tsx transform and filesystem caches may be warm; no provider call",
};
console.info(
  JSON.stringify({
    summary,
    report: await writeReport(
      "ai-cold-start",
      "local",
      { summary, rows },
      `# AI cold import\n\n${JSON.stringify(summary, null, 2)}\n\nNo deployment or full HTTP startup claim. SDK imports remain dynamic.\n`,
    ),
  }),
);
