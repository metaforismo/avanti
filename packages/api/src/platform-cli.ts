import { PlatformOrgCommand, PlatformUsageQuery } from "@avanti/contracts";
import { createDatabase, checkDatabase } from "@avanti/db";
import { requireProductionDatabase } from "./admin-terminal";
import { platformUsage, formatPlatformUsage } from "./platform-usage";
import { platformOrg } from "./platform-org";

export function parsePlatformArgs(command: string | undefined, args: string[]) {
  if (command !== "usage" && command !== "org") throw new Error("Comando piattaforma non valido.");
  const values: Record<string, unknown> = {};
  const allowed = command === "usage" ? ["month", "org", "json"] : ["org", "budget", "cap", "json"];
  for (let i = 0; i < args.length; i++) {
    const key = args[i]?.slice(2) ?? "";
    if (!args[i]?.startsWith("--") || !allowed.includes(key) || key in values)
      throw new Error("Argomenti non validi.");
    if (key === "json") {
      values[key] = true;
      continue;
    }
    const value = args[++i];
    if (!value || value.startsWith("--")) throw new Error("Valore mancante.");
    values[key] =
      key === "budget" || key === "cap"
        ? value === "reset"
          ? null
          : /^[0-9]+(?:\.[0-9]+)?$/.test(value)
            ? Number(value)
            : NaN
        : value;
  }
  return command === "usage" ? PlatformUsageQuery.parse(values) : PlatformOrgCommand.parse(values);
}

export async function runPlatformCli(command: string | undefined, args: string[]) {
  const input = parsePlatformArgs(command, args);
  if (process.env.NODE_ENV === "production") requireProductionDatabase(process.env);
  const database = await createDatabase({ migrate: false });
  try {
    await checkDatabase(database.db);
    if (command === "usage") {
      const report = await platformUsage(database.db, input);
      console.info(input.json ? JSON.stringify(report, null, 2) : formatPlatformUsage(report));
    } else {
      const state = await platformOrg(database.db, input, new Date());
      console.info(
        input.json
          ? JSON.stringify(state, null, 2)
          : [
              `CAF ${state.organizationId} (${state.usage.month})`,
              `Budget AI: EUR ${state.ai.budgetEur.toFixed(2)}; stima EUR ${state.ai.costEstimateEur.toFixed(4)}; riserva EUR ${state.ai.reservedEur.toFixed(4)}; usato ${state.ai.budgetPercent?.toFixed(1) ?? "—"}%`,
              `Consegne: ${state.usage.delivered}; cap: ${state.usage.cap ?? "nessuno"}; quota: ${state.usage.percent?.toFixed(1) ?? "—"}%`,
            ].join("\n"),
      );
    }
  } finally {
    await database.close();
  }
}
