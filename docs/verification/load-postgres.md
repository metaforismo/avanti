# Postgres reale e carico concorrente

Prova locale del 15 ottobre 2026, worktree `pg-load`, branch `codex/pg-load`.
**PASS locale** per migrazioni, seed, parità, revoche e carico. I numeri misurano dati
sintetici sul cluster autorizzato `127.0.0.1:5544`, non la capacità di un deployment.

## Metodo e macchina

Apple M3, 8 core, 16 GiB RAM, macOS/Darwin 25.5.0, Node 25.8.2, pnpm 10.28.0,
PostgreSQL Homebrew 17.11 arm64; cluster preesistente con `max_connections=120`.
Nessun download, dipendenza aggiunta o cambio di schema. Il cluster e il suo
filesystem sono gestiti da Claude; il benchmark crea e cancella soltanto il proprio DB.

`pnpm bench:load` usa gli handler Hono reali attraverso `app.request`, Drizzle e
connessioni TCP postgres-js reali. Un processo Node genera il carico e raccoglie le
risposte; non passa da HTTP, Next, TLS o un reverse proxy. I controlli di autenticazione,
versione, tenant, rate limit e i lock delle route restano attivi. Le sessioni sintetiche
sono predisposte nel DB: login e costo scrypt non entrano nella misura.

Ogni esecuzione crea `avanti_load_<pid>_<random>_test`, applica le migrazioni e semina
5.000 fascicoli deterministici, in lotti da 100. Nessun binario nel seed di volume.
Il clock applicativo è fisso al 15 gennaio 2027 per stabilizzare scadenze, versioni e
rate limit; i tempi misurati usano il clock monotono `performance.now()`.
Preparazione e migrazioni sono escluse dal throughput. Prima della chiusura vengono
drenati i lavori background, compresi recupero documenti e notifiche locali.
Il `finally` chiude le connessioni e cancella il DB; SIGINT/SIGTERM interrompono i
cicli dopo il lavoro corrente e producono un risultato `stopped`, exit 130.
SIGKILL o la perdita del processo possono lasciare un DB da eliminare manualmente.

Default: **30 operatori + 200 cittadini**, senza pause, 5 cicli per persona, massimo
230 richieste contemporanee. Ogni operatore usa una sessione distinta e un fascicolo
in revisione: coda (25 righe), fascicolo, nota con versione attesa, verifica di una voce
con documento, richiesta di integrazione, ritorno allo stato `in_review`.
Ogni cittadino risponde a una domanda e modifica i metadati di un documento
preseminato (`PATCH .../documents/:id`), su un fascicolo distinto in intake.
Sono 2.900 richieste per esecuzione ordinaria. Il numero di attori è la concorrenza
massima del generatore, non 230 connessioni DB.

`--hot-cases 1` fa lavorare tutti gli operatori sullo stesso fascicolo: i 409 sono
contati separatamente, non ritentati, e interrompono quel ciclo operatore. Perciò
questo scenario esegue meno richieste e non è confrontabile nel throughput con gli
altri. `--shared-ip 1` fornisce l'IP fidato sintetico `192.0.2.1` a tutti gli attori:
vengono addebitati anche i bucket IP condivisi. Senza tale opzione restano i bucket
capability/operatore, come nel fallback locale senza IP attendibile.

`--upload-mode file` sostituisce il PATCH con un vero POST multipart del piccolo
JPEG fixture già nel repository, storage in memoria e analisi euristica background.
La prova con IP condiviso usa un solo ciclo: 200 upload restano sotto il burst IP di
400/minuto; cinque cicli da 200 upload sul clock fisso produrrebbero legittimi 429.
Non sono prove di Blob, OCR o AI esterni. Le traduzioni usano sempre il fallback reale
locale, anche in presenza di una chiave AI nella shell; le email sono simulate dalla
configurazione locale di `createApp`.

## Misure

La latenza include autenticazione, coda Node/pool, transazioni, costruzione e lettura
della risposta JSON; i percentili sono nearest rank. Sono conservati i percentili
per ogni operazione. Il throughput totale comprende anche i 409; `successfulRps`
esclude errori e conflitti. HTTP non-2xx inattesi, errori di trasporto/promesse background rifiutate o
incremento dei deadlock producono exit 1. I 409 sono attesi solo nello scenario hot. Gli errori recuperati internamente dai servizi non sono un contatore separato del benchmark.

Un pool osservatore separato di una connessione interroga ogni circa 100 ms
`pg_stat_activity` e `pg_locks`, filtrando DB e `application_name=avanti`:
connessioni totali/attive, query in attesa di lock, lock non concessi e anzianità
delle transazioni. `oldestWaitingQueryMs` è l'età della query in attesa, **un limite
superiore al tempo di attesa del lock**, non la misura esatta di quel tempo.
Il delta di `pg_stat_database.deadlocks` viene letto dopo il drain e un intervallo
per la pubblicazione delle statistiche. Nessuna query o parametro viene salvato nei report.

Il campionamento può perdere attese brevi e i suoi conteggi sono istantanei, non
numero cumulativo di eventi. `active` comprende query in attesa; non misura CPU.
`peakInFlight` e saturazione descrivono la pressione sul pool, ma postgres-js non
espone qui il tempo di checkout o il numero esatto delle query in coda nel client.
Non si deduce tale attesa sottraendo connessioni da richieste.

<!-- RESULTS -->

| Scenario                                                 | Richieste |  req/s |  p50 ms |  p95 ms |  p99 ms | Errori | 409 | Deadlock | Load avg 1m |
| -------------------------------------------------------- | --------: | -----: | ------: | ------: | ------: | -----: | --: | -------: | ----------: |
| [Baseline, pool 5](load-postgres-baseline.json)          |      2900 | 387.74 |  446.28 |  718.92 | 1108.03 |      0 |   0 |        0 |        4.01 |
| [Pool 10](load-postgres-pool10.json)                     |      2900 | 116.86 | 1665.28 | 2555.93 | 4013.89 |      0 |   0 |        0 |       16.90 |
| [Pool 20](load-postgres-pool20.json)                     |      2900 | 298.74 |  512.55 | 1060.29 | 1429.98 |      0 |   0 |        0 |       13.80 |
| [Pool 5, ripetizione](load-postgres-pool5-repeat.json)   |      2900 | 195.04 |  806.36 | 1474.88 | 2314.43 |      0 |   0 |        0 |       10.48 |
| [Hot 1, pool 5](load-postgres-contention.json)           |      2459 |  81.43 | 2546.12 | 3394.23 | 5449.78 |      0 | 147 |        0 |       17.84 |
| [Pool 10, ripetizione](load-postgres-pool10-repeat.json) |      2900 | 254.50 |  721.20 | 1009.07 | 1491.92 |      0 |   0 |        0 |       20.61 |
| [Finale, pool 5](load-postgres-final.json)               |      2900 | 448.06 |  390.21 |  514.01 |  847.28 |      0 |   0 |        0 |        7.79 |
| [IP condiviso, pool 5](load-postgres-wifi.json)          |      2900 | 273.14 |  680.82 | 1462.93 | 1486.83 |      0 |   0 |        0 |        5.72 |
| [Upload JPEG + IP, 1 ciclo](load-postgres-uploads.json)  |       580 | 255.78 |  698.10 |  856.10 |  856.78 |      0 |   0 |        0 |        5.67 |

<!-- END RESULTS -->

| Scenario             | Picco connessioni app | Query in attesa (picco) | Lock non concessi (picco) | Età max query in attesa ms | Età max transazione ms |
| -------------------- | --------------------: | ----------------------: | ------------------------: | -------------------------: | ---------------------: |
| Finale               |                     5 |                       0 |                         0 |                       0.00 |                  10.39 |
| Pool 10, ripetizione |                    10 |                       0 |                         0 |                       0.00 |                  37.31 |
| Pool 20              |                    20 |                       0 |                         1 |                       0.00 |                  64.78 |
| Hot 1                |                     5 |                       2 |                         2 |                      17.88 |                 209.26 |
| IP condiviso         |                     5 |                       2 |                         2 |                       0.07 |                  41.45 |
| Upload JPEG + IP     |                     5 |                       0 |                         0 |                       0.00 |                  13.57 |

I report JSON accanto a questo file contengono percentili per operazione, errori,
stati HTTP, campioni, configurazione e macchina. Il primo report `baseline` è stato
raccolto dopo la sola correzione che consentiva di migrare, con pool 5 e timeout
SQL non limitati. Il contatore `peakConnections=6` di quel primo report include una
connessione osservatore inattiva: il pool applicativo era 5. I report successivi
filtrano l'application name ed escludono l'osservatore.

**Nessuna conclusione causale sulle prestazioni:** il carico medio della macchina
varia fortemente fra le prove, anche con lo stesso pool. La latenza finale inferiore
non dimostra un effetto dei timeout. Le prove sono brevi, con cache calde e un carico
chiuso che riduce il ritmo quando le risposte rallentano. Non misurano una sala
reale, una lunga stagione ISEE o un tasso aperto di arrivi oltre la capacità.

## Problemi riprodotti e correzioni

1. **Avvio Postgres rotto:** `pnpm db:migrate` falliva prima di applicare lo schema
   con `TypeError: Cannot read properties of undefined (reading 'parsers')`.
   Drizzle 0.45.3 richiede `client.options`; postgres-js 3.4.9 non lo espone su
   `ReservedSql`. Il migratore ora ha un client dedicato con `max=1`, senza scadenza
   della connessione, e conserva il session advisory lock per tutto il DDL.
   I test avviano tre migratori contemporaneamente su un DB nuovo e poi usano lo
   schema; migrazione ripetuta, 13 hash e 35 indici sono verificati da `db:check`.
2. **Query e attese senza budget:** ora `DATABASE_STATEMENT_TIMEOUT_MS=15000`,
   `DATABASE_LOCK_TIMEOUT_MS=3000`, timeout di connessione 10 s e transazione inattiva
   30 s sul collegamento diretto. I limiti sono validati e rifiutano zero, valori
   non interi o fuori intervallo. Il budget inattivo lascia margine al provider email
   che può attendere fino a 10 s all'interno della transazione di consegna.
   DDL e advisory lock usano un budget separato: statement 120 s, lock 30 s.
   [Misura isolata](load-postgres-timeouts.json): una query con `pg_sleep(1)` senza
   budget termina in 1.001,42 ms; con budget 150 ms è cancellata in 156,31 ms,
   SQLSTATE `57014`. Un UPDATE bloccato viene cancellato in 53,07 ms con lock timeout
   50 ms, SQLSTATE `55P03`: nessuna modifica parziale e pool ancora utilizzabile.
   I test controllano gli SQLSTATE, non un generico rifiuto della connessione.
3. **Pool fisso e seed vietati su ogni Postgres:** pool configurabile da 1 a 50,
   default conservato a 5. Nessuna prova giustifica un aumento automatico.
   I seed ora richiedono `AVANTI_LOCAL_PG_SEED=1`, host loopback, nome `*_test`,
   nessuna query/fragment nell'URL e ambiente fuori da produzione/Vercel.
   Conservano il rifiuto di organizzazioni diverse dalla demo e l'idempotenza.
   Sono testati anche URL remoti, override host, produzione e opt-in assente.

Non è emerso un motivo per cambiare ordine/ampiezza dei lock o aggiungere indici.
Restano `organizzazione → operatore → sessione → fascicolo`, letture autorizzative
`FOR SHARE` e scritture del fascicolo `FOR UPDATE`. Ridurli per alzare un numero
avrebbe indebolito la protezione dalle revoche senza un collo di bottiglia dimostrato.
Nessuna modifica a contratti o `apps/web/src`, nessuna migrazione aggiunta.

## Ripetere la prova

Solo su un cluster locale autorizzato, già avviato:

```bash
psql -h 127.0.0.1 -p 5544 -U avanti -d avanti \
  -c 'CREATE DATABASE avanti_parity_test'
export DATABASE_URL=postgres://avanti@127.0.0.1:5544/avanti_parity_test
pnpm db:migrate
pnpm db:check
AVANTI_LOCAL_PG_SEED=1 pnpm db:seed
AVANTI_LOCAL_PG_SEED=1 pnpm db:seed:volume --cases 5000

# La suite usa AVANTI_TEST_DATABASE_URL, non DATABASE_URL.
# Il runtime di prova non deve ereditare il DB demo come fallback.
unset DATABASE_URL
AVANTI_TEST_DATABASE_URL=postgres://avanti@127.0.0.1:5544/avanti_parity_test \
  pnpm check --concurrency=1

# Il benchmark usa la URL solo per creare il proprio DB temporaneo.
export DATABASE_URL=postgres://avanti@127.0.0.1:5544/avanti
pnpm bench:load --output /tmp/load-default.json
DATABASE_POOL_MAX=10 pnpm bench:load --output /tmp/load-pool10.json
DATABASE_POOL_MAX=20 pnpm bench:load --output /tmp/load-pool20.json
pnpm bench:load --hot-cases 1 --output /tmp/load-hot.json
pnpm bench:load --shared-ip 1 --output /tmp/load-wifi.json
pnpm bench:load --shared-ip 1 --upload-mode file --iterations 1 \
  --output /tmp/load-uploads.json
```

`--operators`, `--citizens`, `--iterations`, `--cases`, `--hot-cases`,
`--shared-ip`, `--upload-mode` e `--output` sono validati; il numero di fascicoli deve
contenere tutti gli attori. Il nome del DB di ingresso non viene cancellato dal
benchmark. Alla fine delle proprie prove il chiamante può eliminare
`avanti_parity_test` e i file demo creati dal seed; il benchmark non li possiede.
Non eseguire il seed normale su un database remoto o produttivo.

## Verifica di correttezza

La suite `review-authorization.test.ts` gira sia su PGlite sia su un DB Postgres
isolato creato dalla suite quando `AVANTI_TEST_DATABASE_URL` è presente. Copre revoca
in parallelo con un'integrazione lenta: disattivazione, reset password, reset MFA,
logout, scadenza e cambio policy MFA. Copre anche logout mentre il body admin arriva.
Su Postgres aggiunge una scrittura già autenticata **osservata in attesa del lock
organizzazione**: la revoca committata prima di concederle il lock la fa fallire 401
senza salvare la nota. Venti scritture della stessa versione danno esattamente un
200 e diciannove 409, con un solo evento di modifica. I test DB coprono rollback,
contatori atomici, riferimenti, indici, timeout e recupero della connessione.

<!-- CHECKS -->

- **PASS** `pnpm db:migrate`, `pnpm db:check` (13 migrazioni, 35 indici), seed demo (10 fascicoli) e `db:seed:volume --cases 5000` su `avanti_parity_test`.
- **PASS** `AVANTI_TEST_DATABASE_URL=... pnpm check --concurrency=1`: 15 task verdi; DB 40, core 572, API 459 e web 43 test passati (1.114 complessivi). Tre skip corrispondono alle copie PGlite dei tre test specifici Postgres: i corrispondenti test Postgres sono eseguiti.
- **PASS** typecheck API dopo l'aggiunta degli scenari IP condiviso e multipart.
- **PASS** unica `pnpm build`: 2 task, nessuna cache, 20,597 s. Next compila e prerenderizza. Turbo segnala avvisi di accesso alla cache condivisa e output assenti per il task API (solo typecheck); entrambi i task terminano con successo.
- **PASS** cancellati il DB `avanti_parity_test`, tutti i DB temporanei dei benchmark, i PDF demo creati dal seed, lo script di misura temporaneo, i log temporanei, `apps/web/.next` e tutte le directory `.turbo` del worktree. Il DB base `avanti` e il cluster di Claude restano attivi. I soli report persistenti occupano meno di 300 KiB.

<!-- END CHECKS -->

## Deploy: budget e provider

Partire da 5 connessioni per processo Node persistente; con molte istanze serverless
valutare 1–2 e un pooler, poi misurare sulla topologia effettiva. È una proposta di
configurazione, non un dimensionamento dimostrato da queste prove. Il budget totale
è `istanze × DATABASE_POOL_MAX`, più migrazioni, cron, osservabilità e accessi admin.
Sul cluster da 120 connessioni, per esempio, 10 istanze × 5 lasciano 70 slot agli
altri utilizzatori; 10 × 20 superano il limite già prima delle riserve.

Il singleton runtime condivide il pool nell'istanza. Non creare un client per
richiesta. Conservare `prepare:false`. Monitorare p95/p99 per route, errori, attese
pooler, lock e transazioni lunghe; ridurre concorrenza in ingresso quando la coda
cresce. I timeout SQL iniziano sul server e **non limitano la coda nel pool Node**;
un timeout HTTP del chiamante non cancella automaticamente una scrittura già partita.
Non ritentare alla cieca mutazioni dopo risposte ambigue. I timeout DB producono
attualmente il normale errore API sicuro `internal`/500, senza dettagli SQL.

Per pooler che rifiutano parametri di startup, usare `DATABASE_TIMEOUT_MODE=role`:
l'app invia soltanto l'application name e il deploy deve impostare/verificare i
budget sul ruolo applicativo dedicato, usando una connessione amministrativa diretta:

```sql
ALTER ROLE avanti_app SET statement_timeout = '15s';
ALTER ROLE avanti_app SET lock_timeout = '3s';
ALTER ROLE avanti_app SET idle_in_transaction_session_timeout = '30s';
```

Sono comandi proposti, **non eseguiti sul provider**. In modalità `role` le variabili
`DATABASE_*_TIMEOUT_MS` non impostano i budget sul server. Dopo aver riconnesso il
pool applicativo verificare, attraverso il suo endpoint, `SHOW statement_timeout`,
`SHOW lock_timeout` e `SHOW idle_in_transaction_session_timeout`. Mantenere distinto
il ruolo di migrazione, così il limite interattivo non tronca il DDL. In modalità
`startup` i budget sono parametri di ogni connessione; non usare override contrari
nei parametri della URL. Postgres documenta la distinzione fra statement, lock e
transazione inattiva e sconsiglia limiti indiscriminati per tutte le sessioni nel
[manuale PostgreSQL 17](https://www.postgresql.org/docs/17/runtime-config-client.html).

- **Neon:** endpoint pooled per traffico serverless, diretto per `pnpm db:migrate`.
  Il lock del migratore è di sessione: non va attraversato da un pooler transaction.
  Configurare il ruolo prima di usare `DATABASE_TIMEOUT_MODE=role`; osservare code
  client e server del pooler. [Documentazione Neon](https://neon.com/docs/connect/connection-pooling).
- **Supabase:** con l'attuale postgres-js partire da direct/session mode e verificare
  la rete disponibile. La documentazione segnala un problema di pipelining con il
  pooler shared transaction: può bloccare query o restituire righe non abbinate;
  `max_pipeline:0` non è una correzione supportata per le transazioni. `prepare:false`
  da solo non prova la compatibilità. [Guida postgres-js](https://supabase.com/docs/guides/database/postgres-js).
- **RDS:** Node persistente può usare il pool locale su connessione diretta; per
  autoscaling/serverless valutare RDS Proxy e dimensionare entrambi i livelli.
  Misurare pinning, connessioni DB/client e timeout di borrow; le impostazioni di
  sessione possono ridurre il multiplexing. [Guida RDS Proxy](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy-best-practices.workload-considerations.html).

**NOT RUN:** Neon, Supabase, RDS/Proxy, HTTP/Next, rete/TLS, istanze multiple Node,
provider AI/email/Blob reali, cron di retention e reminder sotto carico, carichi aperti
e soak test. Le notifiche reminder mantengono intenzionalmente il lock del fascicolo
fino alla risposta del provider: in produzione possono far scattare il budget di lock
di una scrittura utente. Questa prova non li ha sollecitati; vanno misurati sul deploy.
Rifare il confronto a macchina stabile sul medesimo piano DB e percorso di rete,
con 30/200 e poi arrivi crescenti, prima di aumentare il pool.
