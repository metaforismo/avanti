import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";
import { repoRoot } from "./client";

it("4/12: legacy homonyms map one-to-one and existing answers become editable", async () => {
  const client = new PGlite();
  try {
    for (const name of ["0000_lowly_miek", "0001_nice_jane_foster"])
      await client.exec(
        await readFile(join(repoRoot, `packages/db/migrations/${name}.sql`), "utf8"),
      );
    await client.exec(`
      INSERT INTO organizations VALUES ('org','ESEMPIO','caf');
      INSERT INTO offices (id,organization_id,slug,name,address,city) VALUES ('office','org','test','ESEMPIO','ESEMPIO','ESEMPIO');
      INSERT INTO cases (id,organization_id,office_id,token_hash,reference,language,created_at,updated_at,expires_at,answers)
      VALUES ('case','org','office','hash','REF','it',now(),now(),now(),'{"household_count":3,"members":[{"role":"richiedente","firstName":"Test"},{"role":"figlio","firstName":"Omonimo"},{"role":"figlio","firstName":"Omonimo"}]}');
      INSERT INTO members(case_id,id,role,first_name) VALUES ('case','m_richiedente_0','richiedente','Test'),('case','m_old_1','figlio','Omonimo'),('case','m_old_2','figlio','Omonimo');
      INSERT INTO documents(id,case_id,file_name,mime_type,size_bytes,storage_key,sha256,uploaded_at,status,member_id,checklist_item_id)
      VALUES ('doc0','case','test.pdf','application/pdf',10,'key0','h0',now(),'analyzed','m_old_1','identity:m_old_1'),('doc1','case','test.pdf','application/pdf',10,'key1','h1',now(),'analyzed','m_old_2','identity:m_old_2');
      INSERT INTO checklist_reviews(case_id,item_id,decision,reviewed_at) VALUES ('case','identity:m_old_1','verified',now()),('case','identity:m_old_2','verified',now());
    `);
    await client.exec(
      (
        await readFile(
          join(repoRoot, "packages/db/migrations/0002_needy_valeria_richards.sql"),
          "utf8",
        )
      ).replace("DROP TABLE avanti_member_remap;", ""),
    );
    expect((await client.query("select * from avanti_member_remap")).rows).toHaveLength(3);
    expect(
      (
        await client.query<{ confirmed_answers: string[] }>(
          "select confirmed_answers from cases where id = 'case'",
        )
      ).rows[0]?.confirmed_answers,
    ).toEqual(expect.arrayContaining(["members", "household_count"]));
    await client.exec("DROP TABLE avanti_member_remap");
    expect(
      (
        await client.query<{ member_id: string }>("select member_id from documents order by id")
      ).rows.map((d) => d.member_id),
    ).toEqual(["m_figlio_0", "m_figlio_1"]);
    await client.exec(`
      INSERT INTO cases (id,organization_id,office_id,token_hash,reference,language,created_at,updated_at,expires_at,answers)
      SELECT 'historical',organization_id,office_id,'historical','HISTORICAL',language,created_at,updated_at,expires_at,
        jsonb_set(answers, '{members}', (SELECT jsonb_agg(member - 'id') FROM jsonb_array_elements(answers->'members') member))
      FROM cases WHERE id = 'case';
      INSERT INTO documents(id,case_id,file_name,mime_type,size_bytes,storage_key,sha256,uploaded_at,status,member_id,checklist_item_id)
      VALUES ('historical-doc','historical','test.pdf','application/pdf',10,'hkey','hh',now(),'analyzed','m_figlio_0','identity:m_figlio_0');
      INSERT INTO checklist_reviews(case_id,item_id,decision,reviewed_at) VALUES ('historical','identity:m_figlio_0','verified',now());
    `);
    await client.exec(
      await readFile(join(repoRoot, "packages/db/migrations/0003_stable_members.sql"), "utf8"),
    );
    expect(
      (
        await client.query(
          "select member_id, checklist_item_id from documents where case_id = 'historical'",
        )
      ).rows,
    ).toEqual([{ member_id: null, checklist_item_id: null }]);
    expect(
      (await client.query("select * from checklist_reviews where case_id = 'historical'")).rows,
    ).toEqual([]);
    const row = (
      await client.query<{ answers: { members: { id: string }[] }; confirmed_answers: string[] }>(
        "select answers, confirmed_answers from cases where id = 'case'",
      )
    ).rows[0]!;
    expect(new Set(row.answers.members.map((m) => m.id)).size).toBe(3);
    expect(row.confirmed_answers).toEqual(expect.arrayContaining(["members", "household_count"]));
    const docs = (
      await client.query<{ member_id: string; checklist_item_id: string }>(
        "select member_id,checklist_item_id from documents where case_id = 'case' order by id",
      )
    ).rows;
    expect(docs.map((d) => d.member_id)).toEqual(row.answers.members.slice(1).map((m) => m.id));
    expect(docs.map((d) => d.checklist_item_id)).toEqual(
      row.answers.members.slice(1).map((m) => `identity:${m.id}`),
    );
    expect(
      (await client.query("select * from checklist_reviews where case_id = 'case'")).rows,
    ).toHaveLength(2);
  } finally {
    await client.close();
  }
}, 30000);
