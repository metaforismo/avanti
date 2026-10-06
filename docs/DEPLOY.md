# Staging Avanti su Vercel

Procedura verificata sulle fonti ufficiali il **6 ottobre 2026**. Lo staging usa solo
persone e documenti fittizi, risorse separate e un dominio dedicato. Il deploy remoto,
Postgres gestito, Blob e cron devono ancora essere provati: i test locali non li attestano.
Per il pilota con cittadini reali completare anche i prerequisiti di [SECURITY.md](SECURITY.md).

## 1. Scegliere Postgres in UE e il piano

| Opzione                              | Regione UE da selezionare                                                        | Backup e ripristino                                                                                                           | Costo DB indicativo del pilota, USD/mese                                                                                                                                                                 |
| ------------------------------------ | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Neon Launch                          | AWS Frankfurt, `aws-eu-central-1`                                                | Instant restore fino a 7 giorni, da configurare (default paid: 1 giorno); snapshot e backup pianificati sui piani paid        | $0,106/CU-ora + $0,35/GB-mese; cron continuo: 0,25 CU × 730 ore ≈ $19,35 di compute. Con 1 GB dati e 1 GB history ($0,20), circa $19,90, più snapshot ($0,09/GB-mese), traffico ed eventuale autoscaling |
| Supabase Pro                         | Central EU Frankfurt, `eu-central-1`                                             | Backup giornalieri, 7 giorni di conservazione; PITR aggiuntivo da circa $100/mese per 7 giorni, richiede almeno Small compute | Da $25/mese per il primo progetto; compute maggiore, altri progetti, PITR e consumo oltre quota si aggiungono                                                                                            |
| Vercel Marketplace → Neon o Supabase | Selezionare esplicitamente Frankfurt nell'integrazione e verificare nel provider | Sono quelli del provider/piano acquistato                                                                                     | Marketplace è un canale di provisioning/fatturazione, non un terzo motore DB né una garanzia di backup: verificare il preventivo dell'integrazione                                                       |

Fonti: [Neon piani](https://neon.com/docs/introduction/plans)
([sorgente ufficiale consultabile](https://github.com/neondatabase/website/blob/main/content/docs/introduction/plans.md)),
[Neon regioni](https://neon.com/docs/introduction/regions),
[Supabase prezzi](https://supabase.com/pricing),
[Supabase backup](https://supabase.com/docs/guides/platform/backups),
[Supabase regioni](https://supabase.com/docs/guides/platform/regions),
[Postgres via Marketplace](https://vercel.com/docs/postgres).

Scelta proposta per il primo staging: Neon Launch a Frankfurt, compute iniziale 0,25 CU,
restore window 7 giorni e budget/avvisi. È una stima, non un limite di spesa: il cron ogni
minuto impedisce di contare sullo scale-to-zero per risparmiare. Supabase Pro è un'alternativa
con costo base più prevedibile e backup giornalieri. I Free servono a prove fittizie:
Neon ha una finestra di ripristino breve e Supabase Free non include backup automatici.
Prima del pilota fare un restore su una risorsa isolata e definire RPO/RTO e responsabilità.
Il backup DB non comprende i file nel Blob: serve una procedura distinta per questi.

Aggiungere Vercel Pro (base $20/mese, più utilizzo), Blob, eventuale AI, dominio e imposte.
Ordine di grandezza: circa $40/mese con Neon minimo sempre attivo oppure $45 con Supabase
primo progetto, prima delle altre voci. Non è un preventivo per 40 utenti: misurare picco,
connessioni e autoscaling. [Vercel prezzi](https://vercel.com/pricing).

Creare un DB vuoto dedicato ad Avanti staging; mai collegare Preview o sviluppatori al DB
con cittadini reali. Verificare TLS con il certificato del provider (`sslmode=verify-full`
quando supportato), regione effettiva, credenziali e permessi per `pg_trgm`.
Per il pilota usare una connessione diretta o session pooler per migrazioni e runtime.
L'adattatore usa `postgres-js`, `max:5`, `prepare:false` per istanza; più istanze moltiplicano
le connessioni. Monitorare il totale prima di alzare il carico.

Le migrazioni tengono un **advisory lock di sessione** su una connessione riservata:
non passarle da un pooler in transaction mode. Se in futuro si usa un pooler transaction
per il runtime, tenere la URL diretta/session separata nel job di migrazione ed eseguire
anche le prove concorrenti sul pooler scelto. Per Supabase controllare le limitazioni di
Postgres.js sul pooler condiviso e preferire session mode per questo staging.
[Supabase connessioni](https://supabase.com/docs/guides/database/connecting-to-postgres),
[Postgres.js](https://supabase.com/docs/guides/database/postgres-js),
[Neon pooling](https://neon.com/docs/connect/connection-pooling).

## 2. Creare il progetto Vercel

1. Importare il repository in un progetto **separato** `avanti-staging`, su piano Pro.
   Impostare la Production Branch al branch di staging approvato. La sua Production
   contiene dati fittizi: è distinta dal futuro progetto pilota.
2. Framework Preset: **Next.js**. Root Directory: **`apps/web`**. Abilitare
   **Include source files outside of the Root Directory in the Build Step**:
   `packages/*`, lockfile e migrazioni sono esterni alla directory dell'app.
3. Node.js: **24.x** (il repo richiede almeno 22.19); pnpm è fissato dal `packageManager`
   radice a 10.28.0. Install Command: `cd ../.. && pnpm install --frozen-lockfile`.
4. Build Command (parte da `apps/web`):

   ```sh
   cd ../.. && pnpm db:migrate && pnpm db:check && pnpm build
   ```

   Output Directory: mantenere il default Next.js (`.next` dell'app). Il comando Turbo
   costruisce il monorepo; non sostituirlo con una seconda build Next. Le variabili server
   sono dichiarate in `turbo.json` per strict mode e hash di cache. Migrazione e controllo
   sono fuori dalla cache e precedono ogni build: un loro errore deve bloccare il deploy.

5. Applicare prima le variabili del passo 4. Per Preview fornire un DB/Blob separato con
   lo stesso elenco di variabili; se non disponibili, disabilitare i deploy Preview.
   Le migrazioni non sono abilitate automaticamente nel runtime di produzione.

`vercel.json` appartiene alla **radice del progetto Vercel**, quindi qui è
[`apps/web/vercel.json`](../apps/web/vercel.json), non alla radice del repository.
Configura Functions a Frankfurt (`fra1`) e il cron. Le fonti ufficiali mostrano
la configurazione dentro `apps/web` nei monorepo:
[monorepo](https://vercel.com/docs/monorepos),
[build e Root Directory](https://vercel.com/docs/deployments/configure-a-build),
[vercel.json](https://vercel.com/docs/project-configuration/vercel-json),
[regioni](https://vercel.com/docs/regions).

## 3. Creare Blob privato

Storage → Create Storage → Blob → accesso **Private**, regione **Frankfurt (`fra1`)**.
Collegare lo store solo alla Production del progetto staging, con store distinto per
Preview. Procurarsi il token statico `BLOB_READ_WRITE_TOKEN`: l'attuale adattatore Avanti
lo passa esplicitamente all'SDK; le sole variabili OIDC non soddisfano il controllo startup.
Verificare regione e accesso sullo store, non soltanto il nome del token.
[Creazione e credenziali](https://vercel.com/docs/vercel-blob/using-blob-sdk),
[storage privato](https://vercel.com/docs/vercel-blob/private-storage),
[regione Blob](https://vercel.com/docs/vercel-blob).

Avanti serve i file attraverso l'API autorizzata; non distribuire URL o token Blob nel
browser. La cancellazione è confermata dallo storage, con retry persistenti in DB.
Provare put/get/delete e documentare backup/restore dei file: il ripristino Postgres da
solo non recupera gli oggetti eliminati. Il filesystem serverless non è un fallback
persistente: su Vercel DB e token Blob sono obbligatori.

## 4. Impostare tutte le variabili

Inserirle in Settings → Environment Variables, per l'ambiente corretto, prima della
build. I segreti vanno nel secret manager/dashboard; mai in Git, ticket, command line,
log o `NEXT_PUBLIC_*`. Per i comandi locali DB, esportarli nella shell da un gestore di
segreti: gli script DB non leggono `apps/web/.env.local`.

| Variabile                      | Segreta                   | Valore/obbligo in staging Vercel                                                                                      |
| ------------------------------ | ------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                 | Sì                        | URL Postgres UE dedicata con TLS, diretta/session; obbligatoria, credenziali DB incluse                               |
| `BLOB_READ_WRITE_TOKEN`        | Sì                        | Token dello store **privato** UE di staging; obbligatorio                                                             |
| `RATE_LIMIT_SECRET`            | Sì                        | Segreto casuale stabile distinto per ambiente, almeno 32 byte; obbligatorio                                           |
| `CRON_SECRET`                  | Sì                        | Altro segreto casuale di almeno 32 byte; obbligatorio per eseguire manutenzione                                       |
| `PUBLIC_APP_URL`               | No                        | Origine HTTPS canonica di staging, senza path; obbligatoria. Usata per link, metadata e CSRF                          |
| `TRUST_PROXY`                  | No                        | `1` dietro Vercel; il runtime riconosce anche `VERCEL=1` e usa `x-real-ip` fidato                                     |
| `AI_GATEWAY_API_KEY`           | Sì                        | Lasciare assente per primo staging: fallback euristico. Abilitare solo dopo verifica provider/contratti/trasferimenti |
| `AI_GATEWAY_PROVIDER`          | No                        | `anthropic` (default), unico provider autorizzato; filtro non garantisce residenza UE                                 |
| `AI_MODEL_TEXT`                | No                        | Default del repo `anthropic/claude-sonnet-5.5`; verificare disponibilità prima di abilitare AI                        |
| `AI_MODEL_VISION`              | No                        | Come sopra; nessuna chiamata esterna senza chiave                                                                     |
| `NEXT_PUBLIC_DEMO_OFFICE_SLUG` | No, pubblico              | Assente/vuota: niente collegamento allo sportello demo sullo staging/pilota                                           |
| `NODE_ENV`                     | No, gestita dal framework | `production` in build/runtime; non forzare `development` per aggirare i controlli                                     |
| `VERCEL` / `VERCEL_ENV`        | No, gestite da Vercel     | `1` / ambiente del deployment; non simularle in sviluppo locale                                                       |
| `NEXT_RUNTIME`                 | No, gestita da Next       | `nodejs` per la route API; non impostare manualmente                                                                  |
| `NEXT_MANUAL_SIG_HANDLE`       | No                        | Assente su Vercel; opzione solo per host Node gestito manualmente                                                     |

`AVANTI_TEST_DATABASE_URL` è un segreto **solo della suite di parità**, non una variabile
di deploy; usare un database vuoto e sacrificabile il cui nome finisca in `_test`.
Non servono segreti JWT/session signing: le sessioni sono token opachi hashati nel DB.
Generare i due segreti indipendenti con un password manager o `openssl rand -hex 32`,
senza salvarne l'output nei log di CI. Rotazione di `RATE_LIMIT_SECRET` azzera di fatto
le quote correnti; `CRON_SECRET` deve cambiare anche nello scheduler esterno se presente.

## 5. Migrare e predisporre lo sportello

Prima di assegnare il dominio, eseguire il build command del passo 2 con il DB corretto.
`db:migrate` applica 0000–0006 idempotentemente sotto advisory lock; 0006 richiede
`CREATE EXTENSION pg_trgm`. Concedere i permessi al ruolo di migrazione, non ignorare
errori di estensione. Se il ruolo runtime è diverso, verificare che possa leggere il
journal Drizzle e i cataloghi usati da `db:check`, oltre alle tabelle applicative.

`pnpm db:check` rifiuta URL vuota/non Postgres, non apre PGlite e non migra: verifica
connessione, **tutti gli hash e timestamp del journal**, `pg_trgm` e i **25 indici SQL
espliciti** (struttura, ordine colonne, unicità, predicati, opclass e validità/readiness).
Il controllo non certifica tutti i vincoli o l'intero schema. Restituisce exit 1 se non
pronto, senza stampare URL, credenziali o dettagli grezzi del driver.

**Seed vietato in staging e pilota**, anche con dati fittizi: non eseguire `pnpm db:seed`
é usare credenziali Demo. Il guard `NODE_ENV=production` è una protezione aggiuntiva.
Predisporre il primo admin con provisioning DB amministrativo distinto; l'API richiede
un admin esistente per creare operatori e non ha un endpoint bootstrap pubblico.

1. Generare una password temporanea unica (almeno il minimo di `PASSWORD_MIN_LENGTH`
   in contracts). Usare l'helper `hashPassword` di `packages/api/src/security.ts` in una
   sessione Node amministrativa locale, passando il segreto da secret manager/env, non
   da argomenti o stringhe nello script; trasferire **solo l'hash scrypt** al DB.
2. Nella console SQL amministrativa del DB staging eseguire una transazione con gli
   insert seguenti, sostituendo i segnaposto. Non usare `ON CONFLICT` per sovrascrivere
   silenziosamente un ambiente esistente:

   ```sql
   BEGIN;
   INSERT INTO organizations (id, name, kind)
   VALUES ('staging-caf', 'CAF Prova Staging', 'caf');
   INSERT INTO offices (id, organization_id, slug, name, address, city)
   VALUES ('staging-office', 'staging-caf', 'staging-prova', 'Sportello Prova', 'Indirizzo fittizio', 'Roma');
   INSERT INTO settings (organization_id, baseline_minutes_per_case)
   VALUES ('staging-caf', 30);
   INSERT INTO operators (id, organization_id, name, email, password_hash, role, must_change_password)
   VALUES ('staging-admin', 'staging-caf', 'Admin Staging', 'EMAIL_ADMIN_APPROVATA',
           'HASH_SCRYPT_GENERATO_CON_HELPER', 'admin', true);
   COMMIT;
   ```

3. Accedere alla console e cambiare subito password: le altre azioni sono bloccate
   fino al cambio. Creare gli operatori via console/API autenticata, poi usare
   `/s/staging-prova` per la pratica fittizia.

Le migrazioni precedono il rilascio e possono cambiare il DB mentre il vecchio deploy
serve ancora traffico. Future modifiche devono essere compatibili con entrambe le
versioni; trasformazioni distruttive richiedono finestra operativa/backup e strategia
expand-contract. Un rollback Vercel **non** annulla le migrazioni: ripristino DB e cron
vanno gestiti separatamente. [Rollback cron](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

## 6. Dominio, HTTPS e log

Settings → Domains: aggiungere un sottodominio dedicato (es. `staging.avanti.example`,
segnaposto), applicare i record DNS mostrati da Vercel e attendere certificato valido.
Impostare `PUBLIC_APP_URL` alla stessa origine e ridistribuire: la build contiene i
metadata. Usare sempre il dominio canonico per le mutazioni; gli alias con origine
diversa sono rifiutati dal controllo CSRF. Verificare redirect HTTP→HTTPS e assenza di
redirect sull'endpoint cron. [Domini](https://vercel.com/docs/domains/working-with-domains/add-a-domain).

Vercel documenta HSTS predefinito `max-age=63072000`: controllarlo sul dominio HTTPS
finale sia per pagina sia per API. Non dichiarare preload/includeSubDomains senza
verificare il valore effettivo e la copertura degli altri sottodomini. Su un host Node
alternativo è il reverse proxy a dover impostare HSTS.
[Header Vercel](https://vercel.com/docs/headers/response-headers).

Proteggere lo staging con Deployment Protection e accesso del team; verificare che
le invocazioni Vercel Cron passino la protezione. Gli strumenti esterni devono usare
l'eventuale bypass approvato via header, mai nel link cittadino. Disattivare analytics,
replay e raccolta di URL capability; controllare configurazione di access log/drain
Vercel e proxy, oltre ai log applicativi minimizzati. Regione UE del DB/Functions/Blob
non equivale a garanzia che CDN, log, backup e subresponsabili restino tutti nell'UE.
[Deployment Protection](https://vercel.com/docs/deployment-protection), [SECURITY](SECURITY.md).

## 7. Attivare e verificare manutenzione

Il file `apps/web/vercel.json` pianifica `GET /api/cron/maintenance` con `* * * * *`
(UTC, ogni minuto). Vercel aggiunge `Authorization: Bearer <CRON_SECRET>`; l'endpoint
rifiuta segreto mancante o errato con 401. Pro supporta cadenza al minuto, Hobby solo
una volta al giorno e rifiuta questa configurazione.
[Cron e piani](https://vercel.com/docs/cron-jobs/usage-and-pricing),
[autenticazione cron](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

Motivo: il recupero prende fino a 4 documenti in `processing` da oltre 2 minuti per run,
con budget di recupero 45 secondi; retention a lotti di 25 e retry storage fino a 100
con backoff 1 minuto–1 ora. La route Next ha `maxDuration=120`. La cadenza riduce la coda
dopo arresti, ma non garantisce completamento entro tre minuti con backlog/errori.
Il cooldown di un minuto è per istanza, anche dopo fallimento; non è un lock globale.
Vercel può duplicare/sovrapporre invocazioni: verificare l'idempotenza e l'eventuale
duplicazione di analisi/costo AI nello staging; mai assumere esecuzione exactly-once.

Vercel Cron invoca **solo Production**, non Preview. Il progetto staging separato del
passo 2 permette di provarlo. Per una Preview fare un test manuale autorizzato oppure
usare uno scheduler esterno con il segreto; il file non lo attiva automaticamente.
Vercel non ritenta immediatamente un run fallito: la successiva pianificazione e il
lavoro persistito recuperano la coda. Sorvegliare 5xx, backlog `processing` e
`storage_deletions`, senza copiare payload personali nei monitor.
[Cron](https://vercel.com/docs/cron-jobs), [gestione](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

## 8. Verifica post-deploy e parità Postgres

1. Sul dominio canonico aprire `/api/health`: 200, `status:ok`, `fallbackCount` numerico.
   Eseguire `pnpm db:check` sul **DB effettivo** con URL caricata da secret manager nella
   shell. Health prova disponibilità DB/storage, non completezza migrazioni/indici.
2. Verificare pagina, API ed errori: HSTS, CSP, `Referrer-Policy:no-referrer`, `nosniff`,
   `X-Frame-Options:DENY`; per API `Cache-Control:no-store`, `X-Request-Id`; niente stack,
   token o dati personali. Login: cookie Secure, HttpOnly, SameSite=Lax, Path=/api.
3. Da `/s/staging-prova` creare una pratica ISEE in due lingue, completare l'intervista,
   caricare un PDF chiaramente ESEMPIO e un'immagine fittizia. Verificare risposta
   `processing`, analisi successiva/fallback esplicito, checklist e invio. Nella console
   controllare fascicolo, revisione, export e download autorizzato. Incognito senza
   capability/sessione deve rifiutare il download; URL Blob senza autorizzazione deve
   rifiutare la lettura. Provare anche la cancellazione dal fascicolo e dal Blob.
4. Cron: chiamata senza segreto → 401; con segreto via header → 200. In Settings → Cron
   Jobs confermare path/espressione, osservare **due run effettivi** nei log e lo stato
   persistito. Su dati fittizi lasciare un documento in processing vecchio >2 minuti,
   un lease storage scaduto e una pratica oltre retention: verificare recupero,
   cancellazione file/righe e retry dopo un errore storage controllato.
5. Ricreare la sala con 40 capability distinte dallo stesso IP: avvio simultaneo, circa
   4 turni/minuto/pratica per 10 minuti (1.600 turni), nessun 429. Una singola capability
   oltre 20 turni/minuto deve avere 429 localizzato e `Retry-After`; gli altri cittadini
   continuano. Dieci operatori possono entrare e correggere una password errata senza
   esaurire il tetto condiviso. Usare solo dati fittizi e controllare latenze/pool.
6. Su **DB sacrificabile** `_test` in ambiente staging, esportare separatamente
   `AVANTI_TEST_DATABASE_URL` ed eseguire senza Turbo (che filtra l'env di test):

   ```sh
   pnpm --filter @avanti/db exec vitest run src/check.test.ts
   ```

   La suite applica le migrazioni al DB di test e scrive righe sintetiche. Copre rollback,
   20 transazioni concorrenti con `FOR UPDATE`, upsert dei bucket/finestre orarie,
   hash/indici e `pg_trgm`. Senza URL salta esplicitamente i 5 test Postgres.
   Non usare il DB staging applicativo o il DB pilota per questa suite.

**Esito locale:** PGlite usa PostgreSQL WASM con `pg_trgm`; i test provano transazioni,
rollback e la sintassi/risultato dei lock, ma un solo processo non prova il coordinamento
tra connessioni Postgres. `initdb` locale nel sandbox è fallito con `shmget: Operation not
permitted`, quindi Postgres reale è **NOT RUN**. Prima di dichiarare pronto lo staging:

| Punto delicato         | Prova richiesta sul Postgres gestito                                                                                                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migrazioni concorrenti | Due `db:migrate` dalla URL diretta/session: una aspetta il lock, entrambe terminano; `db:check` verde, senza righe journal duplicate                                                                           |
| Lock e rollback        | Suite sopra verde; due istanze API aggiornano stessa pratica senza perdere risposte; turno obsoleto dà conflict; upload e cancellazione concorrenti non ricreano file/righe                                    |
| Pooler                 | Eseguire la suite e carico anche con URL/modalità runtime scelta; nessun errore transazione/pipelining o esaurimento connessioni                                                                               |
| Ricerca pg_trgm        | Ricerca console per riferimento e nome fittizio, anche con accenti; verificare risultati e `EXPLAIN (ANALYZE, BUFFERS)` con volume sintetico sufficiente per usare i GIN; un DB piccolo può preferire seq scan |
| Cron multi-istanza     | Due invocazioni autorizzate concorrenti e riavvio: retention/retry idempotenti, analisi non resuscita documenti cancellati; osservare eventuali chiamate AI duplicate                                          |
| Restore                | Restore DB e procedura file su risorse isolate: controllo migrazioni, link/sessioni, indici e accessi; rispettare revoche e cancellazioni dopo ripristino                                                      |

Conservare esiti e deployment ID in una nota di verifica senza segreti o capability.
Questo documento prepara il rilascio; non afferma che staging o pilota siano già online.
