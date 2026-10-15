import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { expect, it } from "vitest";
import { repoRoot } from "./client";

it("upgrades existing cases/documents without linking families, hiding files or changing storage references", async () => {
  const client = new PGlite({ extensions: { pg_trgm } });
  const migration = (tag: string) =>
    readFile(join(repoRoot, `packages/db/migrations/${tag}.sql`), "utf8");
  const journal: { entries: { tag: string }[] } = JSON.parse(
    await readFile(join(repoRoot, "packages/db/migrations/meta/_journal.json"), "utf8"),
  );
  const tag = "0014_family_document_reuse";
  try {
    const index = journal.entries.findIndex((entry) => entry.tag === tag);
    expect(index).toBeGreaterThan(0);
    for (const entry of journal.entries.slice(0, index))
      await client.exec(await migration(entry.tag));
    await client.exec(`
      INSERT INTO organizations VALUES ('org','ESEMPIO','caf');
      INSERT INTO offices (id,organization_id,slug,name,address,city)
        VALUES ('office','org','test','Sportello','Via Test','Roma');
      INSERT INTO cases (id,organization_id,office_id,token_hash,reference,language,created_at,updated_at,expires_at,answers)
        VALUES ('case','org','office','hash','AV-TEST','it',now(),now(),now()+interval '60 days','{"members":[]}');
      INSERT INTO documents (id,case_id,file_name,mime_type,size_bytes,storage_key,sha256,uploaded_at,status)
        VALUES ('doc','case','ESEMPIO.pdf','application/pdf',3,'preserved-key','preserved-hash',now(),'analyzed');
    `);
    await client.exec(await migration(tag));
    expect((await client.query("select family_id,answers from cases")).rows).toEqual([
      { family_id: null, answers: { members: [] } },
    ]);
    expect(
      (
        await client.query(
          "select storage_key,sha256,citizen_visible,reused_from_year,reused_member from documents",
        )
      ).rows,
    ).toEqual([
      {
        storage_key: "preserved-key",
        sha256: "preserved-hash",
        citizen_visible: true,
        reused_from_year: null,
        reused_member: null,
      },
    ]);
  } finally {
    await client.close();
  }
});
