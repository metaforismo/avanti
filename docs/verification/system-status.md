# Verifica locale dello stato del sistema

Verificato il 14 ottobre 2026 nel worktree `.worktrees/system-status`, branch
`codex/system-status`. Nessun commit o deploy eseguito. L'interfaccia parallela di
Claude è stata compilata dai controlli del worktree; questo intervento modifica
backend, contratti, database, configurazione e documentazione.

| Verifica                                                         | Esito   | Evidenza                                                                                       |
| ---------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------- |
| `pnpm check --concurrency=1 --cache-dir=<worktree>/.turbo/cache` | PASS    | 15/15 task; API 331, core 572, DB 27, web 39 test passati; 5 test Postgres opzionali saltati   |
| Test `system-status.test.ts`                                     | PASS    | 15 casi, inclusi permessi, tenant, PII/segreti, soglie, fallback, job e retry di cancellazione |
| Upgrade SQL da 0008                                              | PASS    | Migrazione 0009 applicata a un CAF esistente; vincoli e cascade della telemetria verificati    |
| JSON di esempio                                                  | PASS    | Validato con `SystemStatus.parse`                                                              |
| `pnpm build --concurrency=1 --cache-dir=<worktree>/.turbo/cache` | PASS    | Unica build eseguita; API TypeScript e Next completati; `/console/stato` incluso               |
| `git diff --check` e Prettier sui file modificati                | PASS    | Nessun errore di whitespace/formattazione                                                      |
| Pulizia finale                                                   | PASS    | Rimossi `apps/web/.next` e le directory `.turbo` nel worktree; assenza verificata              |
| Postgres remoto, Blob e provider AI reali                        | NOT RUN | Nessuna chiave o risorsa di produzione usata                                                   |

I due controlli iniziali hanno incontrato il timeout preesistente di 30 secondi del
test da 15.000 richieste, anche dopo il retry con concorrenza 1. Solo quel test ha
ora un budget di 240 secondi, con richieste e asserzioni invariate. Nell'ultimo run
ha completato in circa 24,7 secondi. Il run precedente all'ultima correzione dei job
è stato ripetuto con i file backend fermi: il controllo finale è interamente verde.

Il preflight locale ammette database/storage e AI senza chiavi. La build ha emesso
avvisi sulla generazione del fallback dei font Atkinson e sull'assenza di output
per il build API (che esegue `tsc --noEmit`); non hanno impedito il completamento.
Questi risultati non attestano configurazione, disponibilità o deploy in produzione.

Contratto, limiti e soglie: [SYSTEM_STATUS.md](../SYSTEM_STATUS.md).
Esempio completo sintetico: [system-status-example.json](system-status-example.json).
