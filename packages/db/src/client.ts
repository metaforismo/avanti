import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { PGlite } from "@electric-sql/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import type { Logger } from "drizzle-orm/logger";
import * as schema from "./schema";

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;
export interface DatabaseOptions {
  url?: string;
  dataDir?: string;
  memory?: boolean;
  migrate?: boolean;
  logger?: Logger;
  poolMax?: number;
  statementTimeoutMs?: number;
  lockTimeoutMs?: number;
  applicationName?: string;
}

function boundedInteger(
  value: number | string | undefined,
  fallback: number,
  name: string,
  max: number,
): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max)
    throw new Error(`${name} must be an integer between 1 and ${max}`);
  return parsed;
}

export function postgresSettings(options: DatabaseOptions = {}, env = process.env) {
  const mode = env.DATABASE_TIMEOUT_MODE ?? "startup";
  if (!["startup", "role"].includes(mode))
    throw new Error("DATABASE_TIMEOUT_MODE must be startup or role");
  const statement = boundedInteger(
    options.statementTimeoutMs ?? env.DATABASE_STATEMENT_TIMEOUT_MS,
    15000,
    "DATABASE_STATEMENT_TIMEOUT_MS",
    120000,
  );
  const lock = boundedInteger(
    options.lockTimeoutMs ?? env.DATABASE_LOCK_TIMEOUT_MS,
    3000,
    "DATABASE_LOCK_TIMEOUT_MS",
    60000,
  );
  return {
    max: boundedInteger(options.poolMax ?? env.DATABASE_POOL_MAX, 5, "DATABASE_POOL_MAX", 50),
    prepare: false,
    connect_timeout: 10,
    connection: {
      application_name: options.applicationName ?? "avanti",
      // Transaction poolers may reject these startup parameters. In role mode,
      // deploy configures the same budgets on the dedicated application role.
      ...(mode === "startup"
        ? {
            statement_timeout: statement,
            lock_timeout: lock,
            idle_in_transaction_session_timeout: 30000,
          }
        : {}),
    },
  };
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
    const client = postgres(url, postgresSettings(options));
    const db = drizzlePostgres(client, { schema, logger: options.logger });
    try {
      if (shouldMigrate) {
        // Session locks serialize startup migrations across Node instances sharing PostgreSQL.
        // ReservedSql lacks the parser options required by Drizzle. A dedicated,
        // non-expiring single connection keeps the session lock through migrations.
        const migrator = postgres(url, {
          max: 1,
          prepare: false,
          max_lifetime: 0,
          idle_timeout: 0,
          connect_timeout: 10,
          // DDL is a deployment step and needs a separate budget from interactive queries.
          connection: {
            application_name: "avanti-migrate",
            statement_timeout: 120000,
            lock_timeout: 30000,
            idle_in_transaction_session_timeout: 30000,
          },
        });
        try {
          await migrator`select pg_advisory_lock(614829701)`;
          try {
            await migratePostgres(drizzlePostgres(migrator, { schema }), { migrationsFolder });
          } finally {
            await migrator`select pg_advisory_unlock(614829701)`;
          }
        } finally {
          await migrator.end();
        }
      }
    } catch (error) {
      await client.end();
      throw error;
    }
    let closing: Promise<void> | undefined;
    return { db, close: () => (closing ??= client.end()) };
  }

  const dataDir = options.dataDir ?? resolve(repoRoot, ".data/pglite");
  if (!options.memory) await mkdir(dataDir, { recursive: true, mode: 0o700 });
  const client = new PGlite({
    dataDir: options.memory ? undefined : dataDir,
    extensions: { pg_trgm },
  });
  const db = drizzlePglite(client, { schema, logger: options.logger });
  try {
    if (shouldMigrate) await migratePglite(db, { migrationsFolder });
  } catch (error) {
    await client.close();
    throw error;
  }
  let closing: Promise<void> | undefined;
  return { db, close: () => (closing ??= client.close()) };
}
