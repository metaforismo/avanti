import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { expect, it } from "vitest";
import { repoRoot } from "./client";

it("adds MFA without changing existing passwords, sessions, settings or demo access", async () => {
  const client = new PGlite({ extensions: { pg_trgm } });
  const migration = (tag: string) =>
    readFile(join(repoRoot, `packages/db/migrations/${tag}.sql`), "utf8");
  const journal: { entries: { tag: string }[] } = JSON.parse(
    await readFile(join(repoRoot, "packages/db/migrations/meta/_journal.json"), "utf8"),
  );
  try {
    for (const entry of journal.entries.slice(0, -1)) await client.exec(await migration(entry.tag));
    await client.exec(`
      INSERT INTO organizations VALUES ('org','ESEMPIO','caf');
      INSERT INTO operators (id,organization_id,name,email,password_hash,role) VALUES ('admin','org','ESEMPIO','admin@example.test','preserved-hash','admin');
      INSERT INTO sessions (id,operator_id,token_hash,expires_at) VALUES ('session','admin','preserved-token-hash','2027-01-05T11:00:00Z');
      INSERT INTO settings (organization_id,link_days,retention_days) VALUES ('org',45,90);
    `);
    await client.exec(await migration("0011_mfa"));
    expect(
      (
        await client.query(
          "select password_hash,mfa_secret,mfa_enabled_at,mfa_last_used_step,mfa_recovery_hashes from operators",
        )
      ).rows,
    ).toEqual([
      {
        password_hash: "preserved-hash",
        mfa_secret: null,
        mfa_enabled_at: null,
        mfa_last_used_step: null,
        mfa_recovery_hashes: [],
      },
    ]);
    expect(
      (
        await client.query(
          "select token_hash,state,mfa_setup_secret,mfa_setup_expires_at from sessions",
        )
      ).rows,
    ).toEqual([
      {
        token_hash: "preserved-token-hash",
        state: "authenticated",
        mfa_setup_secret: null,
        mfa_setup_expires_at: null,
      },
    ]);
    expect(
      (await client.query("select mfa_required,link_days,retention_days from settings")).rows,
    ).toEqual([{ mfa_required: false, link_days: 45, retention_days: 90 }]);
    await expect(client.exec("update sessions set state = 'invalid'")).rejects.toThrow();
  } finally {
    await client.close();
  }
});
