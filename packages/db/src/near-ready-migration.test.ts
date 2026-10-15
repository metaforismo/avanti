import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, it } from "vitest";
import { repoRoot } from "./client";
it("migra le organizzazioni esistenti in ombra e conserva budget e preferenze", async () => {
  const client = new PGlite({ extensions: { pg_trgm } });
  try {
    const journal: { entries: { tag: string }[] } = JSON.parse(
      await readFile(join(repoRoot, "packages/db/migrations/meta/_journal.json"), "utf8"),
    );
    for (const e of journal.entries.filter((e) => e.tag !== "0019_near_ready"))
      await client.exec(
        await readFile(join(repoRoot, `packages/db/migrations/${e.tag}.sql`), "utf8"),
      );
    await client.exec(
      "insert into organizations values ('synthetic','CAF sintetico','caf'); insert into settings (organization_id,link_days,ai_monthly_budget_eur,ai_copilot) values ('synthetic',45,12,false)",
    );
    await client.exec(
      await readFile(join(repoRoot, "packages/db/migrations/0019_near_ready.sql"), "utf8"),
    );
    expect(
      (
        await client.query(
          "select near_ready_mode,near_ready_critical_threshold,near_ready_other_threshold,near_ready_suspended_at,link_days,ai_monthly_budget_eur,ai_copilot from settings",
        )
      ).rows,
    ).toEqual([
      {
        near_ready_mode: "shadow",
        near_ready_critical_threshold: 0.98,
        near_ready_other_threshold: 0.95,
        near_ready_suspended_at: null,
        link_days: 45,
        ai_monthly_budget_eur: 12,
        ai_copilot: false,
      },
    ]);
    await expect(client.exec("update settings set near_ready_mode = 'invalid'")).rejects.toThrow();
    await expect(
      client.exec("update settings set near_ready_critical_threshold = 1.1"),
    ).rejects.toThrow();
  } finally {
    await client.close();
  }
});
