# Preparazione deploy — verifica locale

6 ottobre 2026, worktree backend, branch `feat/deploy-readiness`, base `7fee74b`.
Node 25.8.2, pnpm 10.28.0; il target Vercel documentato è Node 24 con Fluid Compute.
Nessun commit, risorsa remota o deploy eseguito.

| Verifica                                                                                        | Esito                                                                                        |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `pnpm format:check`                                                                             | PASS sull’ultimo codice                                                                      |
| `pnpm check`                                                                                    | PASS: 15 task; 811 test pass, di cui 490 core da cache; 5 Postgres saltati senza URL di test |
| `pnpm build`                                                                                    | PASS, una sola esecuzione, compilazione Next effettiva senza cache; 2 task                   |
| `pnpm preflight` senza variabili produzione                                                     | PASS del rifiuto: exit 1 e tutti gli obblighi mancanti, nessun valore segreto stampato       |
| Preflight valido/URL/entropia/seed e CLI Vercel                                                 | PASS in `packages/db/src/preflight.test.ts`                                                  |
| Bootstrap e cambio password obbligatorio                                                        | PASS su PGlite in `admin-commands.test.ts`                                                   |
| Export admin del CAF, esclusione segreti e isolamento                                           | PASS su PGlite in `admin-commands.test.ts`                                                   |
| Recupero GET cittadino/operatore, lease concorrente, risultato tardivo, errori storage/chiusura | PASS su PGlite in `document-recovery.test.ts`                                                |
| CLI bootstrap/export senza terminale interattivo                                                | PASS del rifiuto: exit 1 prima di aprire DB, nessuna credenziale                             |
| Output tracing API Next                                                                         | PASS: include SQL 0007 e journal, file presenti sul disco                                    |
| `git diff --check`                                                                              | PASS; nessuna modifica in `apps/web/src`                                                     |
| PostgreSQL gestito, Blob privato, cron remoto, backup/restore                                   | NOT RUN; seguire DEPLOY.md prima dei dati reali                                              |

Build con avvisi non bloccanti sui fallback dei font Atkinson e sulla cache/output
Turbo nel sandbox. Non sono prove di un problema nel recupero o di un deploy riuscito.
Le prove dei servizi amministrativi sono locali: il provisioning CLI positivo su
Postgres reale e il coordinamento tra connessioni vanno verificati sull’ambiente isolato.

I nuovi schemi contracts validano gli input CLI di bootstrap/export; non cambiano
endpoint o DTO frontend. Seed limitato a PGlite locale anche se NODE_ENV fosse
erroneamente impostato a development in un ambiente remoto.
