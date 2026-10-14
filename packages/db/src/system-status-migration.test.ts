import { readMigrationFiles } from "drizzle-orm/migrator";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { expect, it } from "vitest";
import { repoRoot } from "./client";

it("upgrades an existing CAF without inventing maintenance history and enforces bounded telemetry keys", async () => {
  const client = new PGlite({ extensions: { pg_trgm } });
  const migrations = readMigrationFiles({
    migrationsFolder: join(repoRoot, "packages/db/migrations"),
  });
  try {
    for (const migration of migrations.slice(0, 9))
      for (const statement of migration.sql) await client.exec(statement);
    await client.exec("INSERT INTO organizations VALUES ('preserved','CAF ESEMPIO','caf')");
    for (const statement of migrations[9]!.sql) await client.exec(statement);
    expect((await client.query("SELECT id FROM organizations")).rows).toEqual([
      { id: "preserved" },
    ]);
    expect((await client.query("SELECT * FROM system_jobs")).rows).toEqual([]);
    expect((await client.query("SELECT * FROM operational_counters")).rows).toEqual([]);
    await expect(
      client.exec(
        "INSERT INTO system_jobs VALUES ('private-diagnostic','run',now(),NULL,'running')",
      ),
    ).rejects.toThrow();
    await expect(
      client.exec(
        "INSERT INTO operational_counters VALUES ('preserved',now(),'private-diagnostic',1)",
      ),
    ).rejects.toThrow();
    await expect(
      client.exec("INSERT INTO operational_counters VALUES ('preserved',now(),'ai_error',-1)"),
    ).rejects.toThrow();
    await expect(
      client.exec("INSERT INTO operational_counters VALUES ('missing',now(),'ai_error',1)"),
    ).rejects.toThrow();
    await client.exec(
      "INSERT INTO operational_counters VALUES ('preserved',now(),'ai_error',1); DELETE FROM organizations WHERE id = 'preserved'",
    );
    expect((await client.query("SELECT * FROM operational_counters")).rows).toEqual([]);
  } finally {
    await client.close();
  }
});
