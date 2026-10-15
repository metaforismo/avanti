import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { expect, it } from "vitest";
import { repoRoot } from "./client";

it("next steps migration preserves existing office, settings, submitted cases and outbox", async () => {
  const client = new PGlite({ extensions: { pg_trgm } });
  const migration = (tag: string) =>
    readFile(join(repoRoot, `packages/db/migrations/${tag}.sql`), "utf8");
  const journal: { entries: { tag: string }[] } = JSON.parse(
    await readFile(join(repoRoot, "packages/db/migrations/meta/_journal.json"), "utf8"),
  );
  const tag = "0013_office_next_steps_submission_receipt";
  try {
    const index = journal.entries.findIndex((entry) => entry.tag === tag);
    expect(index).toBeGreaterThan(0);
    for (const entry of journal.entries.slice(0, index))
      await client.exec(await migration(entry.tag));
    await client.exec(`
      INSERT INTO organizations VALUES ('org','ESEMPIO','caf');
      INSERT INTO offices (id,organization_id,slug,name,address,city,phone,opening_hours)
        VALUES ('office','org','test','Sportello','Via Test','Roma','123','Lun 9–13');
      INSERT INTO settings (organization_id,link_days,notify_citizen_ready) VALUES ('org',45,true);
      INSERT INTO cases (id,organization_id,office_id,token_hash,reference,language,status,submitted_at,created_at,updated_at,expires_at)
        VALUES ('case','org','office','hash','AV-TEST','it','submitted','2027-01-01Z',now(),now(),now()+interval '60 days');
      INSERT INTO notifications (id,dedupe_key,kind,language,organization_id,case_id,envelope,next_attempt_at,created_at)
        VALUES ('notice','notice','citizen_request','it','org','case','preserved',now(),now());
    `);
    await client.exec(await migration(tag));
    expect(
      (
        await client.query(
          "select address,phone,opening_hours,booking_url,citizen_note from offices",
        )
      ).rows,
    ).toEqual([
      {
        address: "Via Test",
        phone: "123",
        opening_hours: "Lun 9–13",
        booking_url: null,
        citizen_note: null,
      },
    ]);
    expect(
      (
        await client.query(
          "select link_days,notify_citizen_ready,notify_citizen_submission from settings",
        )
      ).rows,
    ).toEqual([{ link_days: 45, notify_citizen_ready: true, notify_citizen_submission: false }]);
    expect((await client.query("select status,submitted_at from cases")).rows).toEqual([
      { status: "submitted", submitted_at: new Date("2027-01-01Z") },
    ]);
    expect((await client.query("select kind,envelope from notifications")).rows).toEqual([
      { kind: "citizen_request", envelope: "preserved" },
    ]);
    await client.exec(`INSERT INTO notifications (id,dedupe_key,kind,language,organization_id,case_id,envelope,next_attempt_at,created_at)
      VALUES ('receipt','citizen_submission:case','citizen_submission','it','org','case','encrypted',now(),now())`);
    await expect(client.exec("update notifications set kind='unknown'")).rejects.toThrow();
  } finally {
    await client.close();
  }
});
