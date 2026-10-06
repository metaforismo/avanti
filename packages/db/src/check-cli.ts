import { createDatabase } from "./client";
import { checkDatabase, DatabaseCheckFailure } from "./check";

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url || !/^postgres(?:ql)?:\/\//.test(url))
    throw new DatabaseCheckFailure(
      "DATABASE_URL Postgres obbligatoria. Nessun fallback PGlite per db:check.",
    );
  const resource = await createDatabase({ url, migrate: false });
  try {
    const result = await checkDatabase(resource.db);
    console.info(
      `PASS: Postgres raggiungibile, ${result.migrations} migrazioni e ${result.indexes} indici verificati.`,
    );
  } finally {
    await resource.close();
  }
}
main().catch((error: unknown) => {
  console.error(
    error instanceof DatabaseCheckFailure
      ? error.message
      : "FAIL: verifica Postgres non riuscita. Controlla connessione, TLS e permessi.",
  );
  process.exitCode = 1;
});
