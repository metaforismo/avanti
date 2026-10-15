import { join } from "node:path";
import { sql } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { repoRoot, type Database } from "./client";

export class DatabaseCheckFailure extends Error {}

function indexDefinition(value: string): string {
  // PostgreSQL adds parentheses, schema qualification and explicit casts when deparsing.
  return value
    .split(/('(?:''|[^'])*')/g)
    .map((part) =>
      part.startsWith("'")
        ? part
        : part
            .replaceAll('"', "")
            .replace(/::[a-zA-Z_][\w.]*/g, "")
            .replace(/\b(?:public|documents|notifications|cases)\./g, "")
            .replace(/[\s();]/g, "")
            .toLowerCase(),
    )
    .join("");
}

/** Read-only: never creates a database, applies migrations or repairs an index. */
export async function checkDatabase(
  db: Database,
): Promise<{ migrations: number; indexes: number }> {
  const expected = readMigrationFiles({
    migrationsFolder: join(repoRoot, "packages/db/migrations"),
  });
  return db.transaction(async (tx) => {
    await tx.execute(sql`set transaction read only`);
    await tx.execute(sql`set local statement_timeout = '10s'`);
    await tx.execute(sql`select 1`);
    const [table] = await tx
      .select({
        journal: sql<string | null>`to_regclass('drizzle.__drizzle_migrations')::text`,
      })
      .from(sql`(select 1) as connection_check`);
    if (!table?.journal)
      throw new DatabaseCheckFailure(
        "Registro migrazioni assente. Esegui db:migrate prima del rilascio.",
      );
    const applied = await tx
      .select({ hash: sql<string>`hash`, createdAt: sql<string>`created_at` })
      .from(sql`drizzle.__drizzle_migrations`)
      .orderBy(sql`created_at`);
    if (
      applied.length !== expected.length ||
      expected.some(
        (migration, index) =>
          applied[index]?.hash !== migration.hash ||
          Number(applied[index]?.createdAt) !== migration.folderMillis,
      )
    )
      throw new DatabaseCheckFailure(
        "Migrazioni mancanti o diverse dal checkout. Rilascio bloccato.",
      );
    const [extension] = await tx
      .select({
        installed: sql<boolean>`exists(select 1 from pg_extension where extname = 'pg_trgm')`,
      })
      .from(sql`(select 1) as extension_check`);
    if (!extension?.installed) throw new DatabaseCheckFailure("Estensione pg_trgm assente.");
    const indexes = await tx
      .select({
        name: sql<string>`c.relname`,
        valid: sql<boolean>`i.indisvalid`,
        ready: sql<boolean>`i.indisready`,
        definition: sql<string>`pg_get_indexdef(i.indexrelid)`,
      })
      .from(
        sql`pg_index i join pg_class c on c.oid = i.indexrelid
      join pg_namespace n on n.oid = c.relnamespace`,
      )
      .where(sql`n.nspname = 'public'`);
    const definitions = expected.flatMap((migration) =>
      migration.sql.flatMap((statement) =>
        [...statement.matchAll(/CREATE (?:UNIQUE )?INDEX "([^"]+)"[^;]+;/g)].map((match) => ({
          name: match[1]!,
          definition: match[0],
        })),
      ),
    );
    for (const expectedIndex of definitions) {
      const actual = indexes.find((index) => index.name === expectedIndex.name);
      if (
        !actual?.valid ||
        !actual.ready ||
        indexDefinition(actual.definition) !== indexDefinition(expectedIndex.definition)
      )
        throw new DatabaseCheckFailure(
          `Indice assente, invalido o diverso: ${expectedIndex.name}.`,
        );
    }
    return { migrations: expected.length, indexes: definitions.length };
  });
}
