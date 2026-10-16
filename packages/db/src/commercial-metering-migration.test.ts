import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { expect, it } from "vitest";
import { repoRoot } from "./client";

it("backfills surviving first submissions by Rome month, excludes demo, then preserves counts through erasure", async () => {
  const client = new PGlite({ extensions: { pg_trgm } });
  try {
    const journal: { entries: { tag: string }[] } = JSON.parse(
      await readFile(join(repoRoot, "packages/db/migrations/meta/_journal.json"), "utf8"),
    );
    const migration = (tag: string) =>
      readFile(join(repoRoot, `packages/db/migrations/${tag}.sql`), "utf8");
    const index = journal.entries.findIndex((e) => e.tag === "0024_commercial_metering");
    for (const entry of journal.entries.slice(0, index))
      await client.exec(await migration(entry.tag));
    await client.exec(`
      INSERT INTO organizations(id,name,kind) VALUES ('org','SYNTHETIC','caf'),('other','SYNTHETIC','caf'),('demo-caf-milano','DEMO','caf');
      INSERT INTO offices(id,organization_id,slug,name,address,city) VALUES
        ('office','org','one','SYNTHETIC','SYNTHETIC','SYNTHETIC'),
        ('other','other','two','SYNTHETIC','SYNTHETIC','SYNTHETIC'),
        ('demo','demo-caf-milano','demo','SYNTHETIC','SYNTHETIC','SYNTHETIC');
      INSERT INTO cases(id,organization_id,office_id,token_hash,reference,language,created_at,updated_at,expires_at,submitted_at) VALUES
        ('first','org','office','hash1','REF1','it','2027-01-31T22:59:59Z','2027-02-02T00:00:00Z','2027-03-01T00:00:00Z','2027-01-31T23:00:00Z'),
        ('draft','org','office','hash2','REF2','it','2027-02-01T00:00:00Z','2027-02-01T00:00:00Z','2027-03-01T00:00:00Z',NULL),
        ('foreign','other','other','hash3','REF3','it','2027-02-01T00:00:00Z','2027-02-01T00:00:00Z','2027-03-01T00:00:00Z','2027-02-01T00:00:00Z'),
        ('demo','demo-caf-milano','demo','hash4','REF4','it','2027-02-01T00:00:00Z','2027-02-01T00:00:00Z','2027-03-01T00:00:00Z','2027-02-01T00:00:00Z');
      INSERT INTO events(id,case_id,organization_id,actor,type,at,metadata) VALUES
        ('first-send','first','org','citizen','case.submitted','2027-01-31T23:00:00Z','{"first":true}'),
        ('resend','first','org','citizen','case.submitted','2027-02-02T00:00:00Z','{"first":false}');
      INSERT INTO events(id,deleted_case_id,organization_id,actor,type,at,metadata) VALUES
        ('deleted-start','erased','other','citizen','case.created','2027-01-31T23:00:00Z','{}'),
        ('deleted-first','erased','other','citizen','case.submitted','2027-02-01T00:00:00Z','{"first":true}'),
        ('deleted-first-duplicate','erased','other','citizen','case.submitted','2027-02-02T00:00:00Z','{"first":true}'),
        ('deleted-again','erased','other','citizen','case.submitted','2027-02-03T00:00:00Z','{"first":false}');
    `);
    // The migration runner wraps SQL in a transaction; raw replay must do the same for LOCK.
    await client.transaction(async (tx) => {
      await tx.exec(await migration("0024_commercial_metering"));
    });
    const totals = () =>
      client.query(
        "select organization_id,month,started,delivered from commercial_usage where office_id = '' order by organization_id,month",
      );
    expect((await totals()).rows).toEqual([
      { organization_id: "org", month: "2027-01", started: 1, delivered: 0 },
      { organization_id: "org", month: "2027-02", started: 1, delivered: 1 },
      { organization_id: "other", month: "2027-02", started: 2, delivered: 2 },
    ]);
    expect(
      (await client.query("select office_id from events where id = 'first-send'")).rows,
    ).toEqual([{ office_id: "office" }]);
    expect(
      (
        await client.query(
          "select started,delivered from commercial_usage where organization_id = 'other' and office_id = '__unattributed__'",
        )
      ).rows,
    ).toEqual([{ started: 1, delivered: 1 }]);
    await client.exec("update cases set submitted_at='2027-02-02T00:00:00Z' where id='first'");
    expect((await totals()).rows[1]).toMatchObject({ delivered: 1 });
    await client.exec("delete from events; delete from cases where id='first'");
    expect((await totals()).rows[1]).toMatchObject({ started: 1, delivered: 1 });
    await expect(
      client.transaction(async (tx) => {
        await tx.exec("update cases set submitted_at='2027-02-03T00:00:00Z' where id='draft'");
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect((await totals()).rows[1]).toMatchObject({ delivered: 1 });
    await client.exec("update cases set submitted_at='2027-02-03T00:00:00Z' where id='draft'");
    expect((await totals()).rows[1]).toMatchObject({ delivered: 2 });
  } finally {
    await client.close();
  }
});
