import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { expect, it } from "vitest";
import { repoRoot } from "./client";
it("adds content-free AI accounting without resetting an existing CAF, and constrains spend", async () => {
  const client = new PGlite({ extensions: { pg_trgm } });
  try {
    const journal: { entries: { tag: string }[] } = JSON.parse(
      await readFile(join(repoRoot, "packages/db/migrations/meta/_journal.json"), "utf8"),
    );
    const migration = (tag: string) =>
      readFile(join(repoRoot, `packages/db/migrations/${tag}.sql`), "utf8");
    const index = journal.entries.findIndex((e) => e.tag === "0014_ai_runtime");
    for (const entry of journal.entries.slice(0, index))
      await client.exec(await migration(entry.tag));
    await client.exec(
      "insert into organizations values ('org','SYNTHETIC','caf'); insert into settings (organization_id,link_days,mfa_required) values ('org',45,true)",
    );
    await client.exec(await migration("0014_ai_runtime"));
    expect(
      (await client.query("select link_days,mfa_required,ai_monthly_budget_eur from settings"))
        .rows,
    ).toEqual([{ link_days: 45, mfa_required: true, ai_monthly_budget_eur: null }]);
    await expect(client.exec("update settings set ai_monthly_budget_eur = -1")).rejects.toThrow();
    await client.exec(
      "insert into ai_usage (id,organization_id,task,version,engine,outcome,day,cost_estimate_eur) values ('record','org','translate','1.1','ai','success','2027-01-01',0.01)",
    );
    await expect(client.exec("update ai_usage set cost_estimate_eur=-1")).rejects.toThrow();
    await expect(client.exec("update ai_usage set engine='invented'")).rejects.toThrow();
    await client.exec("delete from organizations");
    expect((await client.query("select * from ai_usage")).rows).toHaveLength(0);
  } finally {
    await client.close();
  }
});
