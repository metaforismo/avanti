import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { expect, it } from "vitest";
import { repoRoot } from "./client";

it("migration preserves existing settings/outbox and keeps old waiting cases out of reminders", async () => {
  const client = new PGlite({ extensions: { pg_trgm } });
  const migration = (tag: string) =>
    readFile(join(repoRoot, `packages/db/migrations/${tag}.sql`), "utf8");
  const journal: { entries: { tag: string }[] } = JSON.parse(
    await readFile(join(repoRoot, "packages/db/migrations/meta/_journal.json"), "utf8"),
  );
  const tag = "0012_quick_replies_citizen_reminders";
  try {
    for (const entry of journal.entries.slice(
      0,
      journal.entries.findIndex((entry) => entry.tag === tag),
    ))
      await client.exec(await migration(entry.tag));
    await client.exec(`
      INSERT INTO organizations VALUES ('org','ESEMPIO','caf');
      INSERT INTO offices (id,organization_id,slug,name,address,city) VALUES ('office','org','test','ESEMPIO','ESEMPIO','ESEMPIO');
      INSERT INTO settings (organization_id,link_days,notify_citizen_ready) VALUES ('org',45,true);
      INSERT INTO cases (id,organization_id,office_id,token_hash,reference,language,status,created_at,updated_at,expires_at)
        VALUES ('case','org','office','hash','AV-TEST','it','needs_citizen',now(),now(),now()+interval '60 days');
      INSERT INTO notifications (id,dedupe_key,kind,language,organization_id,case_id,envelope,next_attempt_at,created_at)
        VALUES ('notice','notice','citizen_request','it','org','case','preserved',now(),now());
    `);
    await client.exec(await migration(tag));
    expect(
      (
        await client.query(
          "select link_days,notify_citizen_ready,notify_citizen_reminders,citizen_reminder_days from settings",
        )
      ).rows,
    ).toEqual([
      {
        link_days: 45,
        notify_citizen_ready: true,
        notify_citizen_reminders: false,
        citizen_reminder_days: [3, 4],
      },
    ]);
    expect(
      (
        await client.query(
          "select citizen_request_id,citizen_requested_at,citizen_reminders_queued from cases",
        )
      ).rows,
    ).toEqual([
      { citizen_request_id: null, citizen_requested_at: null, citizen_reminders_queued: 0 },
    ]);
    expect((await client.query("select envelope from notifications")).rows).toEqual([
      { envelope: "preserved" },
    ]);
    for (const days of [[], [0], [31], [1.5], [1, 2, 3], [null], ["3"]])
      await expect(
        client.query("update settings set citizen_reminder_days = $1::jsonb", [
          JSON.stringify(days),
        ]),
      ).rejects.toThrow();
    await expect(client.exec("update cases set citizen_reminders_queued=3")).rejects.toThrow();
    await expect(
      client.exec("insert into quick_replies values ('reply','org','Titolo','Testo',50)"),
    ).rejects.toThrow();
  } finally {
    await client.close();
  }
});
