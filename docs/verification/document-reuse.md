# Verifica backend: riuso di nucleo e documenti

Worktree `.worktrees/doc-reuse`, branch `codex/doc-reuse`, 15 ottobre 2026.
Nessun commit, push, merge o deploy eseguito. Nessuna modifica a `apps/web/src`.

| Prova                                 | Esito   | Evidenza                                                               |
| ------------------------------------- | ------- | ---------------------------------------------------------------------- |
| Check completo, lint/typecheck/test   | PASS    | 15 task; 1.173 test passati, 19 saltati                                |
| Suite API                             | PASS    | 40 file; 514 passati, 12 saltati                                       |
| Suite core                            | PASS    | 11 file; 580 passati                                                   |
| Suite DB                              | PASS    | 17 file; 36 passati, 7 saltati                                         |
| Suite web esistente                   | PASS    | 8 file; 43 passati                                                     |
| Nuovo upgrade su dati preesistenti    | PASS    | `family-reuse-migration.test.ts`                                       |
| Export PDF/JSON esistente             | PASS    | 13 test in `export.test.ts`                                            |
| Build produzione, una sola esecuzione | PASS    | 2 task; API TypeScript e Next.js 16.3.8                                |
| Provider AI live e policy strict      | BLOCKED | Chiave non disponibile al processo, zero richieste esterne             |
| Concorrenza PostgreSQL nativo         | NOT RUN | Sandbox macOS rifiuta `shmget` durante `initdb`; nessun server avviato |

I 19 test saltati sono 7 prove DB native e 12 prove API native; una di queste è
la nuova prova concorrente su retention e cancellazione del gruppo. I test locali
di riuso usano PGlite isolato, storage in memoria e AI simulata; non sono prova
di disponibilità dei modelli o di endpoint ZDR. La directory temporanea Postgres
è stata rimossa dopo il mancato avvio.

Comandi riusciti:

```sh
TURBO_CACHE_DIR="$PWD/.turbo/cache" pnpm check --cwd="$PWD" --concurrency=1
TURBO_CACHE_DIR="$PWD/.turbo/cache" pnpm build --cwd="$PWD" --concurrency=1
```

Directory e cache sono esplicite perché l'invocazione senza opzioni tentava di
scrivere la cache nel checkout principale, fuori dai permessi. La build API è
un typecheck senza output: il relativo avviso Turborepo non è un errore di build.
Dopo la build sono stati rimossi `apps/web/.next` e `.turbo` dal worktree.

La classificazione del riuso copre scadenza nel calendario italiano, anno della
pratica e anno dei dati, tipi annuali, analisi fallite, documenti non abbinati e
identità cambiata. Le prove API coprono ricerca e audit senza termini personali,
confini CAF, nessun collegamento implicito tra link, visibilità su lista/download/
mutazioni, nuovi membri e uscite, file condivisi, retention, retry dello storage,
erasure del gruppo anche senza la sorgente e risposta AI tardiva dopo erasure.

Contratti, esempi, migrazione e motivazione della modifica condivisa:
[document-reuse.md](../decisions/document-reuse.md).
