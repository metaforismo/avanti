import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { expect, it } from "vitest";
import { repoRoot } from "./client";

it("backfills existing audit references and prevents accidental erasure or unscoped resource events", async () => {
  const client = new PGlite({ extensions: { pg_trgm } });
  const folder = join(repoRoot, "packages/db/migrations");
  const journal: { entries: { idx: number; tag: string }[] } = JSON.parse(
    await readFile(join(folder, "meta/_journal.json"), "utf8"),
  );
  try {
    for (const entry of journal.entries.filter((e) => e.idx < 8))
      await client.exec(await readFile(join(folder, `${entry.tag}.sql`), "utf8"));
    await client.exec(`
      INSERT INTO organizations VALUES ('a','CAF A','caf'), ('b','CAF B','caf');
      INSERT INTO offices (id,organization_id,slug,name,address,city) VALUES ('office','a','test','Esempio','Esempio','Milano');
      INSERT INTO cases (id,organization_id,office_id,token_hash,reference,language,created_at,updated_at,expires_at)
      VALUES ('case','a','office','hash','AV-2027-000001','it',now(),now(),now());
      INSERT INTO events (id,case_id,organization_id,actor,type,at)
      VALUES ('legacy','case','a','citizen','case.created',now()), ('deleted',null,'a','system','case.retention_deleted',now());
    `);
    const migration = journal.entries.find((e) => e.idx === 8)!;
    await client.exec(await readFile(join(folder, `${migration.tag}.sql`), "utf8"));
    expect((await client.query("SELECT id, case_reference FROM events ORDER BY id")).rows).toEqual([
      { id: "deleted", case_reference: null },
      { id: "legacy", case_reference: "AV-2027-000001" },
    ]);
    await expect(client.exec("DELETE FROM cases WHERE id='case'")).rejects.toThrow();
    await expect(
      client.exec(
        "INSERT INTO events (id,case_id,organization_id,actor,type,at) VALUES ('foreign','case','b','system','case.exported',now())",
      ),
    ).rejects.toThrow();
    await expect(
      client.exec(
        "INSERT INTO events (id,organization_id,actor,type,at) VALUES ('bad-scope',null,'system','case.exported',now())",
      ),
    ).rejects.toThrow();
    await expect(
      client.exec(
        "INSERT INTO events (id,organization_id,actor,actor_id,type,at) VALUES ('bad-actor',null,'system','admin','auth.login_failed',now())",
      ),
    ).rejects.toThrow();
    await client.exec(
      "INSERT INTO events (id,organization_id,actor,type,at) VALUES ('unknown',null,'system','auth.login_failed',now())",
    );
    expect(
      (await client.query("SELECT id FROM events WHERE organization_id IS NULL")).rows,
    ).toEqual([{ id: "unknown" }]);
  } finally {
    await client.close();
  }
});
