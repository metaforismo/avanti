import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, it } from "vitest";
import { repoRoot } from "./client";
it("preserves existing CAF budget and preferences while enabling both copilot switches", async () => {
  const client = new PGlite({ extensions: { pg_trgm } });
  try {
    const journal: { entries: { idx: number; tag: string }[] } = JSON.parse(
      await readFile(join(repoRoot, "packages/db/migrations/meta/_journal.json"), "utf8"),
    );
    for (const entry of journal.entries.filter((e) => e.idx < 18))
      await client.exec(
        await readFile(join(repoRoot, `packages/db/migrations/${entry.tag}.sql`), "utf8"),
      );
    await client.exec(
      "insert into organizations values ('synthetic','CAF sintetico','caf'); insert into settings (organization_id,link_days,ai_monthly_budget_eur) values ('synthetic',45,12)",
    );
    await client.exec(
      await readFile(join(repoRoot, "packages/db/migrations/0018_operator_copilot.sql"), "utf8"),
    );
    expect(
      (
        await client.query(
          "select link_days,ai_monthly_budget_eur,ai_copilot,ai_citizen_assistant from settings",
        )
      ).rows,
    ).toEqual([
      { link_days: 45, ai_monthly_budget_eur: 12, ai_copilot: true, ai_citizen_assistant: true },
    ]);
  } finally {
    await client.close();
  }
});
