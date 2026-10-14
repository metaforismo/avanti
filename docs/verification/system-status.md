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

## Avvisi email — worktree status-mail

Verificato il 14 ottobre 2026 in `.worktrees/status-mail`, branch `codex/status-mail`.
Modificati solo backend, contratto e documentazione; nessun commit o deploy.

| Verifica                                                              | Esito   | Evidenza                                                                                                                                                                             |
| --------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm --filter @avanti/api exec vitest run src/system-status.test.ts` | PASS    | 20 test: permessi, tenant, lead esclusi, soglie 0/1/4/5, confini temporali, console, dati illeggibili, PII ed esempio JSON                                                           |
| `pnpm check --concurrency=1 --cache-dir=<worktree>/.turbo/cache`      | PASS    | 15/15 task; API 373, core 572, DB 28, web 39 test; 5 test Postgres opzionali saltati                                                                                                 |
| `EXPLAIN` delle due query email su PGlite                             | PASS    | Con `enable_seqscan=off`, coda compatibile con `notifications_due_idx` e completamenti con `notifications_completed_idx`; non è una misura di carico né il piano del Postgres remoto |
| `pnpm build --concurrency=1 --cache-dir=<worktree>/.turbo/cache`      | PASS    | Unica build; TypeScript API e Next completati                                                                                                                                        |
| `git diff --check` e Prettier sui file modificati                     | PASS    | Nessun errore di whitespace o formattazione                                                                                                                                          |
| Pulizia finale                                                        | PASS    | Rimossi `apps/web/.next` e le directory `.turbo` nel worktree; assenza verificata                                                                                                    |
| Resend reale e Postgres remoto                                        | NOT RUN | Provider simulato e PGlite isolato nei test; nessun invio reale                                                                                                                      |

Il primo check si era fermato sulla mappa frontend dei codici: il contratto finale
limita i nuovi codici al componente email, preservando il tipo dei componenti
esistenti. Il check successivo è interamente verde. La build ha emesso gli avvisi
preesistenti sui fallback dei font Atkinson e sull'assenza di output del task API
(`tsc --noEmit`). Nessuna nuova migrazione o dipendenza.
