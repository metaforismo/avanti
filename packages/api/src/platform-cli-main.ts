import { runPlatformCli } from "./platform-cli";
runPlatformCli(process.argv[2], process.argv.slice(3)).catch(() => {
  console.error(
    "FAIL: comando non eseguito. Verifica argomenti, organizzazione, configurazione DB e migrazioni; nessun dettaglio interno stampato.",
  );
  process.exitCode = 1;
});
