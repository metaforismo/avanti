import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;
export interface DatabaseOptions {
  url?: string;
  dataDir?: string;
  memory?: boolean;
  migrate?: boolean;
}

export function findRepoRoot(start = process.cwd()): string {
  let directory = resolve(start);
  for (;;) {
    if (existsSync(join(directory, "packages/db/migrations/meta/_journal.json"))) return directory;
    const parent = dirname(directory);
    if (parent === directory) throw new Error("Avanti migration assets were not found");
    directory = parent;
  }
}

export const repoRoot = findRepoRoot();
const migrationsFolder = join(repoRoot, "packages/db/migrations");

export async function createDatabase(options: DatabaseOptions = {}): Promise<{
  db: Database;
  close: () => Promise<void>;
}> {
  const url = options.url ?? process.env.DATABASE_URL;
  const shouldMigrate =
    options.migrate ?? (options.memory === true || process.env.NODE_ENV !== "production");
  if (url?.trim() && !options.memory) {
    const client = postgres(url, { max: 5, prepare: false });
    const db = drizzlePostgres(client, { schema });
    try {
      if (shouldMigrate) {
        // Session locks serialize startup migrations across Node instances sharing PostgreSQL.
        await client.reserve().then(async (connection) => {
          try {
            await connection`select pg_advisory_lock(614829701)`;
            await migratePostgres(drizzlePostgres(connection, { schema }), { migrationsFolder });
          } finally {
            try {
              await connection`select pg_advisory_unlock(614829701)`;
            } finally {
              connection.release();
            }
          }
        });
      }
    } catch (error) {
      await client.end();
      throw error;
    }
    return { db, close: () => client.end() };
  }

  const dataDir = options.dataDir ?? resolve(repoRoot, ".data/pglite");
  if (!options.memory) await mkdir(dataDir, { recursive: true, mode: 0o700 });
  const client = new PGlite(options.memory ? undefined : dataDir);
  const db = drizzlePglite(client, { schema });
  try {
    if (shouldMigrate) await migratePglite(db, { migrationsFolder });
  } catch (error) {
    await client.close();
    throw error;
  }
  return { db, close: () => client.close() };
}
