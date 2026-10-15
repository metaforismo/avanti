import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
export const verificationDir = fileURLToPath(
  new URL("../../../docs/verification/", import.meta.url),
);
export async function writeReport(prefix: string, mode: string, report: unknown, markdown: string) {
  await mkdir(verificationDir, { recursive: true });
  const name = `${prefix}-${new Date().toISOString().slice(0, 10)}-${mode}`;
  await writeFile(resolve(verificationDir, `${name}.json`), JSON.stringify(report, null, 2) + "\n");
  await writeFile(resolve(verificationDir, `${name}.md`), markdown + "\n");
  if (prefix === "ai-eval" || prefix === "ai-stress") {
    const date = new Date().toISOString().slice(0, 10);
    const modes = prefix === "ai-eval" ? ["heuristic", "live"] : ["deterministic", "live"];
    const rows: string[] = [];
    for (const variant of modes) {
      const stem = `${prefix}-${date}-${variant}`;
      try {
        const result: {
          summary: {
            status: string;
            cases?: number;
            liveCases?: number;
            requests?: number;
            reason?: string;
            accuracy?: number;
            guardViolations?: number;
          };
        } = JSON.parse(await readFile(resolve(verificationDir, `${stem}.json`), "utf8"));
        rows.push(
          `| ${variant} | ${result.summary.status} | ${result.summary.cases ?? result.summary.liveCases ?? 0} | ${result.summary.requests ?? 0} | [Markdown](${stem}.md), [JSON](${stem}.json) |`,
        );
      } catch {
        rows.push(`| ${variant} | NOT RUN | — | — | — |`);
      }
    }
    await writeFile(
      resolve(verificationDir, `${prefix}-${date}.md`),
      `# ${prefix} ${date}\n\n| Modalità | Stato | Casi | Richieste SDK reali | Rapporti |\n| --- | --- | --- | --- | --- |\n${rows.join("\n")}\n\nI test offline non provano il provider. BLOCKED indica assenza di chiave/provider, senza chiamate. Accuratezza e JSON riguardano i campi annotati e l'uscita finale; le traduzioni e la lingua richiedono verifica umana oltre i controlli di alfabeto.\n`,
    );
  }
  return `docs/verification/${name}.md`;
}
export function arg(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index < 0 ? undefined : process.argv[index + 1];
}
export function limitArg(name: string, defaultValue: number, maximum: number) {
  const raw = arg(name);
  const number = raw === undefined ? defaultValue : Number(raw);
  if (!Number.isInteger(number) || number < 1 || number > maximum)
    throw new Error(`--${name}: expected integer 1..${maximum}`);
  return number;
}
