# «Quasi pronta»: verità per versione e parità Postgres

Base: `7387f43`, worktree `near-ready-truth`. Nessun commit, nuova migrazione,
modifica frontend o intervento sui rinnovi ISEE.

## Comportamento verificato

La prima valutazione attiva per pratica resta la coorte del report. La verità
proviene dai giudizi ciechi sulla stessa versione oppure dalla prima decisione
finale sulla stessa versione. Il confronto delle versioni avviene in SQL e
conserva anche i microsecondi degli eventi storici. Gli esiti di versioni
successive già registrati dal vecchio codice vengono esclusi senza riscrivere
l'audit.

Senza verità il caso aumenta `unjudged` ed è escluso da precisione e opportunità
mancate. Giudizi discordanti sulla stessa versione aumentano `disagreements`
una sola volta per valutazione; prevale «non pronta». Un critico resta un
fallimento anche dopo un esito positivo, dopo correzioni o senza altri giudizi.
Il tempo di una decisione finale su un'altra versione non viene riutilizzato.
Clopper-Pearson e soglie di calibrazione sono conservati.

`NearReadyPilotGroup` aggiunge solo `unjudged` e `disagreements` in `total`,
`groups` e `calibration`: la UI può mostrare esclusioni e conflitti senza
ricostruire etichette. Tutti i campi esistenti restano disponibili.

Le regressioni HTTP su correzione successiva, con e senza cieco negativo,
fallivano prima della correzione: entrambi i casi mostravano precisione 1.
Ora il primo è non giudicabile, il secondo resta un falso suggerimento.
La conferma «pronta» registra l'esito prima di avanzare la versione nella stessa
transazione, sotto il lock della pratica.

## Differenze emerse su Postgres

Il GET del fascicolo inseriva l'audit prima di acquisire `FOR UPDATE` sulla
pratica. L'inserimento prendeva il lock FK `KEY SHARE`; letture concorrenti
tentavano poi l'upgrade del lock, causando deadlock. Il test rafforzato ha
ottenuto 11 risposte 500 su 12 letture concorrenti; spostando l'audit dopo il
lock tutte le risposte sono 200 e restano tre chiamate AI complessive.
PGlite serializza le transazioni e non riproduceva questo difetto.

La suite delle route near-ready ora accetta `AVANTI_TEST_DATABASE_URL` e crea
un database Postgres temporaneo, migrato e rimosso al termine. La suite delle
metriche esegue gli stessi casi su entrambi i motori, compresi più CAF,
discordanza fra revisori, critici tardivi e report vuoto. I test di persistenza
su disco richiedono esplicitamente PGlite con `url: ""`, così `DATABASE_URL`
non li indirizza tutti allo stesso database nativo. Nessun comportamento del
client DB è stato cambiato.

## Comandi e risultati

Database locale sacrificabile: `postgres://avanti@127.0.0.1:5544/avanti_test`.
Il server è rimasto avviato. Le verifiche non usano provider AI reali.

- **PASS** — con `AVANTI_TEST_DATABASE_URL`, `pnpm --filter @avanti/db exec
vitest run src/check.test.ts src/near-ready-invalidation.test.ts`:
  22 test superati, 1 saltato (controllo specifico Postgres nella variante PGlite).
- **PASS** — con `DATABASE_URL`, `pnpm db:migrate` e `pnpm db:check`:
  23 migrazioni e 41 indici verificati, incluso `pg_trgm`. La suite di
  autorizzazione verifica anche tre avvii concorrenti su un database nuovo.
- **PASS** — `DATABASE_URL=postgres://avanti@127.0.0.1:5544/avanti_test
AVANTI_TEST_DATABASE_URL=postgres://avanti@127.0.0.1:5544/avanti_test
AVANTI_LOCAL_PG_SEED=1 pnpm --filter @avanti/api test`:
  49 file, 683 test superati e 3 saltati; durata 190,87 secondi.
  La variabile del seed abilita solo fixture locali sul database sacrificabile.
  Le route near-ready, le metriche e l'autorizzazione esercitano Postgres nativo;
  i test con `memory: true` rimangono su PGlite. Questo risultato non afferma
  che l'intera suite sia stata convertita al motore nativo.

Il primo `pnpm check` con la concorrenza predefinita ha completato 17 task su 18,
con 1.500 test superati e un timeout nel `beforeEach` PGlite di `app.test.ts`
(limite locale di 20 secondi). Il corpo del test non è arrivato alle asserzioni.
La regressione isolata `vitest run src/app.test.ts -t 'reports duplicate content'`
è passata in 5,95 secondi complessivi. Il check è stato rieseguito con
`--concurrency=1`, senza modificare timeout o verifiche.

**PASS** — `pnpm check --concurrency=1`: 18 task riuscite (6 da cache),
1.501 test superati e 38 saltati. Suite API: 49 file superati, 659 test superati
più 27 saltati. Tutti i 62 test di `app.test.ts` sono passati, incluso il caso
che aveva avuto il timeout. I test Postgres saltati nel giro senza variabile
sono coperti dai comandi nativi sopra; il test specifico di riuso documentale
con variabile separata `DOC_REUSE_TEST_DATABASE_URL` resta saltato.

**PASS** — `pnpm build`: 3 task riuscite, nessuna da cache; Next.js 16.3.8
ha completato compilazione, TypeScript e generazione delle pagine. Una sola
build eseguita. `git diff --check` e Prettier sui file modificati sono verdi.

Dopo la build sono stati rimossi `apps/web/.next` e tutti i percorsi `.turbo`
presenti nella worktree, esclusi `node_modules` e i metadati Git. Nessuna
modifica a `apps/web/src`, allo schema DB o alle migrazioni. HEAD resta `7387f43`.

Commit proposti, non eseguiti:

- `fix(api): lega la verità quasi pronta alla versione del fascicolo`
- `fix(api): evita deadlock nell'audit concorrente del fascicolo`
