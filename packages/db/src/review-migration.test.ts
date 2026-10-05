import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";
import { repoRoot } from "./client";
it("21,26: migration removes duplicate member storage while preserving file links, review and answers", async () => {
  const client = new PGlite();
  try {
    for (const file of ["0000_lowly_miek.sql", "0001_nice_jane_foster.sql"])
      await client.exec(await readFile(join(repoRoot, "packages/db/migrations", file), "utf8"));
    await client.exec(`
      INSERT INTO organizations VALUES ('org', 'ESEMPIO', 'caf');
      INSERT INTO offices (id, organization_id, slug, name, address, city) VALUES ('office', 'org', 'example', 'ESEMPIO', 'ESEMPIO', 'Milano');
      INSERT INTO cases (id, organization_id, office_id, token_hash, reference, language, created_at, updated_at, expires_at, answers)
      VALUES ('case', 'org', 'office', 'hash', 'REF', 'it', now(), now(), now() + interval '60 days', '{"members":[{"role":"richiedente","firstName":"Anna"},{"role":"genitore","firstName":"Rita"}],"account_owner_0":"m_old_1","income_present_m_old_1":false,"disability_members":["m_old_1"],"account_bank_0":"m_old_1 Bank"}');
      INSERT INTO members (case_id, id, role, first_name) VALUES ('case', 'm_old_0', 'richiedente', 'Anna'), ('case', 'm_old_1', 'genitore', 'Rita');
      INSERT INTO documents (id, case_id, file_name, mime_type, size_bytes, storage_key, sha256, uploaded_at, status, member_id, checklist_item_id)
      VALUES ('doc','case','ESEMPIO.pdf','application/pdf',100,'key','hash',now(),'analyzed','m_old_1','account_balance:account_0_m_old_1');
      INSERT INTO checklist_reviews (case_id, item_id, decision, reviewed_at) VALUES ('case','tax_code:m_old_1','verified',now());
    `);
    await client.exec(
      await readFile(
        join(repoRoot, "packages/db/migrations/0002_needy_valeria_richards.sql"),
        "utf8",
      ),
    );
    const docs = await client.query<{ member_id: string; checklist_item_id: string }>(
      "select member_id, checklist_item_id from documents",
    );
    expect(docs.rows).toEqual([
      { member_id: "m_genitore_0", checklist_item_id: "account_balance:account_0_m_genitore_0" },
    ]);
    const reviews = await client.query<{ item_id: string }>(
      "select item_id from checklist_reviews",
    );
    expect(reviews.rows[0]?.item_id).toBe("tax_code:m_genitore_0");
    const rows = await client.query<{ answers: Record<string, unknown> }>(
      "select answers from cases",
    );
    expect(rows.rows[0]?.answers).toMatchObject({
      account_owner_0: "m_genitore_0",
      income_present_m_genitore_0: false,
      disability_members: ["m_genitore_0"],
      account_bank_0: "m_old_1 Bank",
    });
    expect(
      (
        await client.query(
          "select table_name from information_schema.tables where table_name = 'members'",
        )
      ).rows,
    ).toEqual([]);
  } finally {
    await client.close();
  }
}, 30000);
