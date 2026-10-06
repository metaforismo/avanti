import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";
import { repoRoot } from "./client";

it("migrates existing operators without forcing password changes and dates legacy closures conservatively", async () => {
  const client = new PGlite();
  const migration = (tag: string) =>
    readFile(join(repoRoot, `packages/db/migrations/${tag}.sql`), "utf8");
  try {
    for (const tag of [
      "0000_lowly_miek",
      "0001_nice_jane_foster",
      "0002_needy_valeria_richards",
      "0003_stable_members",
    ])
      await client.exec(await migration(tag));
    await client.exec(`
      INSERT INTO organizations VALUES ('org','ESEMPIO','caf');
      INSERT INTO offices (id,organization_id,slug,name,address,city) VALUES ('office','org','test','ESEMPIO','ESEMPIO','Milano');
      INSERT INTO operators (id,organization_id,name,email,password_hash,role) VALUES ('admin','org','ESEMPIO','admin@example.test','preserved-hash','admin');
      INSERT INTO cases (id,organization_id,office_id,token_hash,reference,language,status,created_at,updated_at,expires_at)
      VALUES ('closed','org','office','closed','CLOSED','it','closed','2027-01-01Z','2027-02-01Z','2027-03-01Z'),('open','org','office','open','OPEN','it','intake','2027-01-01Z','2027-02-01Z','2027-03-01Z');
    `);
    await client.exec(await migration("0004_happy_zombie"));
    const operator = (
      await client.query<{
        active: boolean;
        must_change_password: boolean;
        last_login_at: Date | null;
        password_hash: string;
      }>("SELECT active,must_change_password,last_login_at,password_hash FROM operators")
    ).rows[0];
    expect(operator).toEqual({
      active: true,
      must_change_password: false,
      last_login_at: null,
      password_hash: "preserved-hash",
    });
    expect((await client.query("SELECT id FROM cases WHERE closed_at = updated_at")).rows).toEqual([
      { id: "closed" },
    ]);
    expect((await client.query("SELECT id FROM cases WHERE closed_at IS NULL")).rows).toEqual([
      { id: "open" },
    ]);
    await client.exec(
      "INSERT INTO events (id,organization_id,actor,type,at,deleted_case_id) VALUES ('audit','org','system','case.retention_deleted',now(),'closed'); DELETE FROM cases WHERE id='closed'",
    );
    expect((await client.query("SELECT case_id,deleted_case_id FROM events")).rows).toEqual([
      { case_id: null, deleted_case_id: "closed" },
    ]);
  } finally {
    await client.close();
  }
});
