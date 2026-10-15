# Deploy Avanti: staging e avvio del pilota

## Notifiche email e outbox

Migrazione `0010_notifications`: outbox e preferenze dell'organizzazione.
La richiesta API salva evento e outbox nella stessa transazione; dopo il commit
registra con `services.background` l'invio del solo ID appena accodato, senza attendere
il provider. Next usa `after()` come per l'analisi dei documenti. Il cron recupera
retry e lavoro interrotto; un errore di scheduling/invio produce solo un log sintetico,
senza indirizzi, contenuti o dettagli del provider. Gli host incorporati devono
fornire `background` per l'invio immediato; senza questo hook resta il recupero cron.
Configurare
le variabili server (anche nella shell dei comandi amministrativi; mai `NEXT_PUBLIC_`):

| Variabile               | Uso                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| `NOTIFY_PROVIDER`       | `console` default; registra tipo e ID, simula senza inviare. `resend` abilita HTTP.               |
| `NOTIFY_FROM`           | Indirizzo email semplice del mittente, con dominio verificato su Resend. Obbligatorio con Resend. |
| `RESEND_API_KEY`        | Chiave privata Resend con permesso di invio. Obbligatoria con Resend.                             |
| `LEADS_NOTIFY_EMAIL`    | Casella del team per candidature pilota; richiesta dal preflight con Resend.                      |
| `NOTIFY_ENCRYPTION_KEY` | 32 byte casuali in hex, dedicati e stabili; obbligatoria in produzione anche con console.         |

Generare la chiave con il gestore segreti o `openssl rand -hex 32` in terminale
privato e conservarla separatamente dai backup del DB. Senza chiavi esterne in
locale tutto funziona: console, PGlite e chiave AES generata in `.data/notify.key`
(0600). Non cancellare quel file se ci sono righe pendenti. Il default di
`createApp` è per DB di test isolati; host incorporati con DB persistente devono
iniettare `notifications` con chiave persistente come il runtime Next.

Resend è stato scelto per invio via `fetch` nativo con timeout 10 secondi e chiave
di idempotenza HTTP: nessun SDK o dipendenza SMTP. Corpo solo testuale, senza HTML,
allegati, link cittadino o tracking richiesto dal codice. Disabilitare click/open
tracking nel dashboard del provider. [API invio](https://resend.com/docs/api-reference/emails/send-email).
L'indirizzo mittente e il messaggio vengono congelati per i retry al primo tentativo;
non cambiare provider/mittente durante un invio incerto. `sent` attesta accettazione
HTTP del provider, senza garanzia di consegna: bounce e caselle spam vanno verificati
operativamente.

`GET /api/cron/maintenance`, autenticato con `CRON_SECRET`, genera al massimo 25
riepiloghi di organizzazioni per run (uno per operatore attivo, una volta per giorno
UTC), poi processa fino a 5 notifiche in ordine di scadenza del tentativo.
Ogni nuovo digest registra anche un invio in background per ID dopo il commit:
quelli oltre il lotto partono nello stesso run giornaliero. Il conteggio della risposta
cron riguarda solo gli invii attesi dalla route, non quelli ancora in background.
Conta le pratiche `submitted`/`in_review`,
senza dati personali; un riepilogo arretrato viene annullato, il giorno corrente
ne genera uno nuovo. Le due preferenze `notifyCitizenReady` e `notifyOperatorDigest`
sono false per default e si aggiornano con `PATCH /api/settings` da admin. Le
richieste di integrazione con email sono notifiche di servizio sempre attive.

Ogni tentativo acquisisce una lease DB di 60 secondi e un lock durante l'I/O;
worker concorrenti saltano righe occupate. Retry dopo 1, 2, 4, 8 minuti, massimo
5 tentativi; errori permanenti HTTP passano subito a `failed`. Il payload e l'ID
restano identici. Un rifiuto temporaneo confermato (HTTP 429) può essere recuperato
anche dal cron del giorno dopo, senza azzerare il conteggio dei tentativi.
Timeout, HTTP 409/5xx e risposte di successo non decodificabili mantengono invece
l'esito incerto. Resend conserva l'idempotenza per 24 ore: entro 23 ore dal primo
tentativo potenzialmente accettato si può recuperare una lease interrotta con lo stesso ID; oltre quel
limite si marca `failed/retry_window_expired` per evitare duplicati dopo un esito
incerto. Un successivo 429 non prolunga una finestra già incerta.
[Finestra del provider](https://resend.com/docs/dashboard/emails/idempotency-keys),
[errori HTTP](https://resend.com/docs/api-reference/errors).

Il default del repo è `0 3 * * *` (03:00 UTC), compatibile con il cron giornaliero
Hobby: candidature, integrazioni e pratica pronta partono in background dopo il
commit; il digest viene generato e inviato nel run giornaliero. I retry attendono
il prossimo cron, fino a circa 24 ore; gli esiti incerti fuori dalla finestra sicura
richiedono verifica operativa. Su Pro/Enterprise si può impostare `* * * * *`
per retry più rapidi, oppure usare uno scheduler esterno autenticato.
Dimensionare cadenza/lotti sul volume e sulla durata massima della Function: cinque
timeout email richiedono fino a 50 secondi, oltre alla restante manutenzione.
Vercel invoca solo Production; per Preview/staging fare una chiamata manuale o
usare un progetto/scheduler separato. Non distribuire dati reali nelle Preview.

Prova locale con dati fittizi:

1. Usare `NOTIFY_PROVIDER=console`, avviare `pnpm dev` con `CRON_SECRET` configurato.
2. Inviare una candidatura dal modulo: insieme al record `leads` viene salvata
   `pilot_lead/pending`, poi il background la porta a `simulated` senza cron.
3. Da terminale privato chiamare la manutenzione (sostituire la porta se diversa):

   ```sh
   curl --fail -H "Authorization: Bearer $CRON_SECRET" http://localhost:3400/api/cron/maintenance
   ```

4. Il log deve contenere solo `kind` e `id`, la riga deve essere `simulated`, con
   `envelope=null`. Ripetere dopo un minuto: nessun nuovo invio dello stesso evento.
5. Creare una pratica con email fittizia e chiedere un'integrazione dalla console;
   senza email nessuna notifica. Per provare “pronta”/riepilogo abilitare da admin
   `{"notifyCitizenReady":true,"notifyOperatorDigest":true}`: “pronta” parte in
   background, il riepilogo dal cron. Ripetere il cron il giorno UTC successivo:
   deve arrivare un nuovo riepilogo, senza reinviare le notifiche già completate.
6. Test automatizzati: `pnpm --filter @avanti/api exec vitest run src/notifications.test.ts`.
   HTTP è iniettato/finto; nessun invio reale. Per verificare le caselle sullo staging,
   usare solo indirizzi controllati e dati fittizi dopo configurazione del provider.

Monitoraggio riservato nel DB: conteggi per `state/kind`, età del più vecchio
`pending`, `attempts`, `next_attempt_at`, categorie fisse `last_error`. Non stampare
`envelope`, indirizzi, corpi o risposte HTTP. `configuration_missing` attende un'ora
senza consumare tentativi; configurare destinatario/mittente e richiamare il cron.
La risposta cron riporta `queuedDigests` e `deliveredNotifications`; quest'ultimo
include simulazioni quando il provider è console, non una ricevuta di recapito.

Con `failed`/finestra scaduta, verificare l'ID nel dashboard Resend prima di qualunque
reinvio manuale: mai azzerare tentativi o creare una nuova chiave alla cieca. Correggere
la causa; una nuova azione dell'operatore costituisce un evento nuovo. Non è previsto
un endpoint pubblico di replay. Console produce `simulated` e non viene riconvertito
in invio reale cambiando configurazione: consultare il lead originale nel DB se serve
il ricontatto. Payload pendenti/falliti scadono dopo 7 giorni; ricevute operative dopo
30 giorni dal completamento, al passaggio cron. Cancellare una pratica elimina anche
le sue notifiche; documentare separatamente backup e copie del provider.

Prima del pilota: verifica DPA, dominio mittente, retention/trasferimenti del provider,
restore della chiave AES, cadenza reale cron e gestione degli errori. Non sono attestati
dal passaggio dei test locali. [Minimizzazione e basi giuridiche](SECURITY.md#email-di-servizio-e-candidature-pilota-14-ottobre-2026).

Procedura verificata sulle fonti ufficiali il **6 ottobre 2026**. Lo staging usa solo
persone e documenti fittizi, risorse separate e un dominio dedicato. Il deploy remoto,
Postgres gestito, Blob e cron devono ancora essere provati: i test locali non li attestano.
Per il pilota con cittadini reali completare anche i prerequisiti di [SECURITY.md](SECURITY.md).

## Checklist quando arriva il via

1. Creare progetto Vercel, Neon Frankfurt e Blob privato Frankfurt, separati dalle Preview.
2. Configurare backup, restore window 7 giorni e variabili dal gestore segreti; AI opzionale.
3. Impostare Root Directory `apps/web`, Node 24.x e Fluid Compute abilitato.
4. Dalla radice, con variabili nella shell: `pnpm preflight`.
5. Eseguire `NODE_ENV=production pnpm db:migrate` e `pnpm db:check`.
6. In terminale privato: `NODE_ENV=production pnpm admin:bootstrap` (mai seed).
7. Eseguire il deploy approvato: `apps/web/vercel.json` contiene install/build command e cron.
8. Cambiare password admin, creare operatori e stampare il QR dello sportello scelto.
9. Provare health, upload/recupero, cron, export e ripristino su dati sintetici isolati.
10. Aprire ai cittadini solo dopo i prerequisiti contrattuali e le prove di SECURITY.md.

Questa checklist si esegue **dopo l'autorizzazione al deploy**. Nessuna risorsa remota
è stata creata durante la preparazione. I comandi amministrativi non leggono `.env.local`:
caricare le variabili nella shell dal gestore segreti senza stamparle.

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
restore window 7 giorni e budget/avvisi. La cadenza opzionale al minuto può tenere
attivo il compute: le stime in tabella sono un riferimento, non una promessa di costo.
Con il default giornaliero il DB può sospendersi fra richieste; gli invii immediati
non dipendono dal cron, mentre il recupero degli esiti incerti conserva il limite
di sicurezza descritto sopra. Supabase Pro è un'alternativa
con costo base più prevedibile e backup giornalieri. I Free servono a prove fittizie:
Neon ha una finestra di ripristino breve e Supabase Free non include backup automatici.
Prima del pilota fare un restore su una risorsa isolata e definire RPO/RTO e responsabilità.
Il backup DB non comprende i file nel Blob: serve una procedura distinta per questi.

Il default giornaliero permette le prove su Hobby senza modifiche allo schedule. Hobby è riservato
all’uso personale non commerciale: per il servizio CAF usare il piano appropriato,
normalmente Pro. [Condizioni Hobby](https://vercel.com/docs/plans/hobby).
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

1. Importare il repository in un progetto **separato** `avanti-staging`, con piano appropriato all’uso (vedi sopra).
   Impostare la Production Branch al branch di staging approvato. La sua Production
   contiene dati fittizi: è distinta dal futuro progetto pilota.
2. Framework Preset: **Next.js**. Root Directory: **`apps/web`**. Abilitare
   **Include source files outside of the Root Directory in the Build Step**:
   `packages/*`, lockfile e migrazioni sono esterni alla directory dell'app.
3. Node.js: **24.x**, **Fluid Compute abilitato** (la route API usa `maxDuration=120`,
   compatibile con Hobby Fluid; il vecchio limite Hobby senza Fluid è 60 secondi).
   [Durata Functions](https://vercel.com/docs/functions/configuring-functions/duration).
   Il repo richiede almeno 22.19; pnpm è fissato dal `packageManager`
   radice a 10.28.0. Install Command: `cd ../.. && pnpm install --frozen-lockfile`.
4. Build Command (parte da `apps/web`):

   ```sh
   cd ../.. && pnpm preflight && if [ "$VERCEL_ENV" = production ] || [ "$MIGRATE_ON_BUILD" = 1 ]; then pnpm db:migrate && pnpm db:check; fi && pnpm build
   ```

   Le migrazioni partono da sole solo in Production. Per staging o Preview con un database
   **separato**, impostare `MIGRATE_ON_BUILD=1` solo nell'ambiente Vercel di quel database:
   così una Preview configurata per errore sul database di produzione non può cambiarne lo
   schema con il codice di un branch non ancora approvato.

   Install e Build Command sono già in `apps/web/vercel.json`; evitare override discordanti.
   Il preflight precede migrazioni e build, è fuori dalla cache e non si connette al DB.
   `pnpm build` lo riesegue anche localmente (fallback ammessi solo fuori produzione).
   Output Directory: mantenere il default Next.js (`.next` dell'app). Il comando Turbo
   costruisce il monorepo; non sostituirlo con una seconda build Next. Le variabili server
   sono dichiarate in `turbo.json` per strict mode e hash di cache. Migrazione e controllo
   sono fuori dalla cache e precedono la build dove abilitate: un loro errore blocca il deploy.

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
| `MFA_ENCRYPTION_KEY`           | Sì                        | Chiave AES-256-GCM: 32 byte casuali in 64 cifre hex; distinta dagli altri segreti, mai pubblica                       |
| `CRON_SECRET`                  | Sì                        | Altro segreto casuale di almeno 32 byte; obbligatorio per eseguire manutenzione                                       |
| `PUBLIC_APP_URL`               | No                        | Origine HTTPS canonica di staging, senza path o slash finale; obbligatoria. Usata per link, metadata e CSRF           |
| `TRUST_PROXY`                  | No                        | `1` dietro Vercel; il runtime riconosce anche `VERCEL=1` e usa `x-real-ip` fidato                                     |
| `AI_GATEWAY_API_KEY`           | Sì                        | Lasciare assente per primo staging: fallback euristico. Abilitare solo dopo verifica provider/contratti/trasferimenti |
| `AI_GATEWAY_PROVIDER`          | No                        | `anthropic` (default), unico provider autorizzato; filtro non garantisce residenza UE                                 |
| `AI_MODEL_TEXT`                | No                        | Default del repo `anthropic/claude-sonnet-5.5`; verificare disponibilità prima di abilitare AI                        |
| `AI_MODEL_VISION`              | No                        | Come sopra; nessuna chiamata esterna senza chiave                                                                     |
| `NEXT_PUBLIC_DEMO_OFFICE_SLUG` | No, pubblico              | Assente/vuota: niente collegamento allo sportello demo sullo staging/pilota                                           |
| `NODE_ENV`                     | No, gestita dal framework | `production` in build/runtime; non forzare `development` per aggirare i controlli                                     |
| `VERCEL` / `VERCEL_ENV`        | No, gestite da Vercel     | `1` / ambiente del deployment; non simularle in sviluppo locale                                                       |
| `MIGRATE_ON_BUILD`             | No                        | `1` solo negli ambienti con database separato (staging, Preview): abilita le migrazioni in build fuori da Production  |
| `NEXT_RUNTIME`                 | No, gestita da Next       | `nodejs` per la route API; non impostare manualmente                                                                  |
| `NEXT_MANUAL_SIG_HANDLE`       | No                        | Assente su Vercel; opzione solo per host Node gestito manualmente                                                     |

`AVANTI_TEST_DATABASE_URL` è un segreto **solo della suite di parità**, non una variabile
di deploy; usare un database vuoto e sacrificabile il cui nome finisca in `_test`.
Non servono segreti JWT/session signing: le sessioni sono token opachi hashati nel DB.
Generare i tre segreti indipendenti con un password manager o `openssl rand -hex 32`,
senza salvarne l'output nei log di CI. Rotazione di `RATE_LIMIT_SECRET` azzera di fatto
le quote correnti; `CRON_SECRET` deve cambiare anche nello scheduler esterno se presente.
`MFA_ENCRYPTION_KEY` deve restare disponibile nel ripristino: non cambiarla senza
ricifrare i segreti TOTP o pianificare reset e nuova configurazione (vedi SECURITY.md).

## 5. Migrare e predisporre lo sportello

Prima di assegnare il dominio, eseguire il build command del passo 2 con il DB corretto.
`db:migrate` applica 0000–0007 idempotentemente sotto advisory lock; 0006 richiede
`CREATE EXTENSION pg_trgm`. Concedere i permessi al ruolo di migrazione, non ignorare
errori di estensione. Se il ruolo runtime è diverso, verificare che possa leggere il
journal Drizzle e i cataloghi usati da `db:check`, oltre alle tabelle applicative.

`pnpm db:check` rifiuta URL vuota/non Postgres, non apre PGlite e non migra: verifica
connessione, **tutti gli hash e timestamp del journal**, `pg_trgm` e i **25 indici SQL
espliciti** (struttura, ordine colonne, unicità, predicati, opclass e validità/readiness).
Il controllo non certifica tutti i vincoli o l'intero schema. Restituisce exit 1 se non
pronto, senza stampare URL, credenziali o dettagli grezzi del driver.

### Avvio di un CAF pilota

**Mai eseguire `pnpm db:seed` nel pilota**: il guard rifiuta produzione, Vercel e
i database remoti. Il seed è ammesso su PGlite locale oppure, con opt-in esplicito, su Postgres loopback `*_test`; resta vietato su database remoti e in produzione. Vedi [carico Postgres](verification/load-postgres.md). Non usare credenziali Demo.
Il primo CAF si crea dalla radice con DB già migrato, senza endpoint bootstrap pubblico:

```sh
pnpm preflight
NODE_ENV=production pnpm admin:bootstrap
```

Il terminale deve essere interattivo e privato: niente pipe, redirect, registrazione
sessione o esecuzione in CI. Il comando verifica le migrazioni senza applicarle,
chiede nome/tipo CAF, sportello, slug, indirizzo/città, nome/email admin e conferma
esatta **`CREA CAF PILOTA`**. Nessuna password passa come argomento o variabile.
Crea organizzazione, sportello, impostazioni e admin in una transazione protetta da
lock; genera una password casuale, conserva solo scrypt e la mostra una volta sul
terminale di controllo, mai nei log stdout. Baseline non inventata: resta vuota.

Una seconda esecuzione è rifiutata se esiste qualunque admin, anche disattivato;
non duplica CAF e non rigenera credenziali. Un DB non vuoto senza admin è rifiutato
per richiedere un provisioning amministrativo controllato. Questo è il comportamento
idempotente: il retry non modifica quanto già creato. Non usarlo per aggiungere CAF.

Annotare `organizationId` per le esportazioni e lo slug scelto per `/s/<slug>`.
Consegnare la password di persona, cambiarla al primo login su `/console/accedi`
e creare i successivi operatori dalla console. Le altre API e l’export CLI sono
bloccati finché il cambio non è completato. Se si perde la password mostrata,
serve recupero amministrativo supervisionato sul DB: il bootstrap non la ristampa.
La guida [operatori](guide/operatori.md) descrive i passi del responsabile.

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

Il default in `apps/web/vercel.json` è **`0 3 * * *`**, giornaliero alle 03:00 UTC.
Hobby ammette questa cadenza con precisione entro l'ora. Le notifiche degli eventi
partono in background dopo il commit; il cron genera i digest e recupera retry,
analisi e pulizie. Su Pro/Enterprise si può passare a **`* * * * *`** per retry
più rapidi; il compute DB può restare attivo: pianificare budget e monitoraggio.
Il recupero delle analisi sulle
pratiche aperte continua anche tramite letture autorizzate.
[Cron e piani](https://vercel.com/docs/cron-jobs/usage-and-pricing).

Non è una variabile runtime: Vercel registra lo schedule dal file al deploy.
Per cambiare la cadenza su Pro modificare `crons[0].schedule` e rifare il deploy.
Su host Node configurare `services.background` e lo scheduler
esterno sulla medesima route. Vercel aggiunge `Authorization: Bearer <CRON_SECRET>`;
segreto assente o errato dà 401. [Autenticazione](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

Le GET autorizzate `/api/c/:token` e `/api/cases/:id` restituiscono il fascicolo e
registrano recupero con `after()`. Non avviano la revisione né toccano `updatedAt`.
Si recuperano solo documenti della pratica aperta, in `processing` da oltre **N=2
minuti**, senza lease valido. Upload, lettura e cron usano la stessa acquisizione
atomica nel DB: lease di 2 minuti e token proprietario, senza analisi concorrenti
con lease valido. Un worker tardivo non può sovrascrivere il nuovo proprietario;
errori storage lasciano scadere il lease prima del retry. Non è una garanzia exactly-once
sul provider AI dopo una terminazione: vale il limite del lease e la scadenza AI SDK.

Recupero: fino a 4 documenti per lettura/run, budget 45 secondi tra lavori, storage
10 secondi e analisi 25 secondi massimi per lavoro; la route ha 120 secondi disponibili.
Retention: fino a 25 fascicoli/run; retry file: fino a 100/run. Il cron
recupera anche le pratiche mai riaperte e fa le pulizie. Con backlog superiore ai
lotti servono run ulteriori o cadenza Pro; la retention è un criterio di eleggibilità,
non una promessa di cancellazione all’istante esatto. Monitorare conteggi e ritardi.
Il cooldown di un minuto è per istanza; lease e transazioni proteggono le operazioni
persistite anche in presenza di invocazioni sovrapposte.

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
   Jobs confermare path/espressione, osservare **due run effettivi** nei log (su giornaliero attendere due giorni) e lo stato
   persistito. Su dati fittizi lasciare un documento in processing vecchio >2 minuti,
   un lease storage scaduto e una pratica oltre retention: verificare recupero,
   cancellazione file/righe e retry dopo un errore storage controllato. Aprire anche
   il fascicolo da cittadino e operatore senza invocare cron: l’analisi deve ripartire
   dopo la risposta; provare due letture simultanee con un solo lease valido.
5. Ricreare la sala con 40 capability distinte dallo stesso IP: avvio simultaneo, circa
   4 turni/minuto/pratica per 10 minuti (1.600 turni), nessun 429. Una singola capability
   oltre 60 turni/minuto deve avere 429 localizzato e `Retry-After`; gli altri cittadini
   continuano. Dieci operatori possono entrare e correggere una password errata senza
   esaurire il tetto condiviso. Usare solo dati fittizi e controllare latenze/pool.
6. Su **DB sacrificabile** `_test` in ambiente staging, esportare separatamente
   `AVANTI_TEST_DATABASE_URL` ed eseguire la suite (Turbo ora inoltra questa variabile ai task test):

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
| Cron multi-istanza     | Due invocazioni autorizzate concorrenti e riavvio: retention/retry idempotenti, analisi non resuscita documenti cancellati; verificare un solo worker per lease valido e il rifiuto dei risultati tardivi      |
| Restore                | Restore DB e procedura file su risorse isolate: controllo migrazioni, link/sessioni, indici e accessi; rispettare revoche e cancellazioni dopo ripristino                                                      |

Conservare esiti e deployment ID in una nota di verifica senza segreti o capability.
Questo documento prepara il rilascio; non afferma che staging o pilota siano già online.

## 9. Backup Neon e prova di ripristino trimestrale

Provider scelto per il primo pilota: **Neon Launch, Frankfurt**. Nel dashboard
Settings → Postgres impostare **history/restore window a 7 giorni** e verificare
che sia effettivamente applicata (il default paid è 1 giorno). PITR/instant restore
è disponibile sulla root branch; non basta creare una branch figlia e chiamarla
backup. Configurazione, limiti e addebiti: [Neon piani](https://neon.com/docs/introduction/plans),
[sorgente ufficiale](https://github.com/neondatabase/website/blob/main/content/docs/introduction/plans.md).

Policy operativa proposta, da approvare col CAF: snapshot giornaliero con scadenza
**7 giorni**, più snapshot prima delle migrazioni con la stessa scadenza. In Neon
Backup & restore attivare il backup schedule e controllare timestamp ultimo successo,
retention e alert: scrivere questa policy non la attiva. L’ultimo snapshot di uno
schedule attivo può essere preservato oltre la scadenza: sorvegliare i backup falliti
e disciplinare anche quella copia nella cancellazione finale. Evitare snapshot manuali
senza expiry e copie indefinite. La finestra PITR non è la retention applicativa.
[Backup & restore](https://neon.com/docs/guides/backup-restore),
[sorgente ufficiale](https://github.com/neondatabase/website/blob/main/content/docs/guides/backup-restore.md).

Obiettivi iniziali **da misurare**, non garanzie del provider: RPO DB ≤1 ora,
RPO file ≤24 ore, RTO del servizio ≤4 ore. Il responsabile tecnico controlla ogni
giorno ultimo backup, ultimo cron e backlog, registra solo conteggi/tempi; il CAF
nomina responsabile e sostituto per incidenti e restore. Se l’obiettivo non è
raggiunto, adeguare strategia prima dei dati reali.

**Blob è separato:** il DB salva hash/chiavi ma non i binari. Prima del pilota
attivare una copia cifrata giornaliera degli oggetti privati in destinazione UE
approvata, accesso separato e retention 7 giorni, con manifest DB/storage e SHA-256.
Provare recupero di PDF/immagine e riconciliare anche gli oggetti caricati dopo il
restore point. Questo repository non crea né pianifica la copia remota: assenza
backup file è un prerequisito operativo aperto, non risolta dal PITR o dall’export.
Le chiavi storage nel manifest di backup sono riservate e non entrano nell’export
portabile. Se queste copie non sono disponibili, non aprire il pilota ai dati reali.

**Ogni trimestre e prima del primo pilota**, il tecnico con il referente CAF:

1. Registra ora di inizio e punto UTC scelto nella finestra di ripristino; usa una
   pratica sintetica con risposte, evento e PDF dal contenuto noto, senza esportare
   dati personali nei verbali. Prova sia la storia PITR sia uno snapshot giornaliero.
2. In Neon crea un ambiente di restore **isolato** dal punto storico della root;
   per lo snapshot usa **Restore → Multi-step restore**, che crea la copia senza
   spostare il compute. Non eseguire **Finalize** o migrare connessioni della produzione.
   Mai premere Instant Restore sulla produzione durante una prova. Credenziali, Blob e
   accesso di rete separati; nessun cron o provider AI collegato alle copie reali.
3. Carica solo la URL del DB ripristinato nella shell e lancia `pnpm db:check` da
   un checkout compatibile con quel punto (non applicare migrazioni per mascherare
   un restore incompleto). Verifica journal, indici, conteggi e relazione CAF/sportello.
4. Ripristina una copia isolata dei file dal backup e confronta bytes e SHA-256
   con `documents.sha256`. Verifica PDF e immagine fittizi scaricabili solo tramite
   API autorizzata e che un altro CAF non possa leggerli.
5. **Prima di qualsiasi riapertura**, ripristina dal registro protetto degli interventi
   le cancellazioni e revoche successive al punto scelto. Svuota le sessioni restaurate,
   revoca capability compromesse, applica tombstone/retention e riconcilia Blob.
   L’audit nel DB vecchio non contiene le cancellazioni avvenute dopo quel punto:
   il CAF deve conservare quel registro separato per la finestra dei backup.
6. Verifica login, cambio password, lettura, recupero lease e una pratica sintetica
   completa; misura perdita dati (RPO) e tempo totale (RTO). Nessuna chiamata AI
   con dati reali durante la prova, nessun contatto a cittadini.
7. Registra PASS/FAIL, timestamp, snapshot/branch ID, hash del campione, durata,
   responsabili e rimedi senza password/capability/payload. Elimina copie e risorse
   temporanee secondo l’approvazione operativa e fissa la prossima prova a 3 mesi.

Un guasto reale richiede autorizzazione del responsabile, blocco scritture/accessi,
scelta del punto, preservazione controllata dell’ultima versione e la medesima
riconciliazione prima di cambiare la URL del servizio. Rollback Vercel e restore DB
sono azioni distinte; misurare gli effetti sul cron e sui worker ancora attivi.
**Stato attuale: NOT RUN** per backup/restore remoti e copia Blob; nessuna risorsa
è stata creata da questo lavoro.

## 10. Esportazione e uscita dal pilota

Con DB migrato, credenziali DB TLS, `RATE_LIMIT_SECRET` e `MFA_ENCRYPTION_KEY` caricati dal gestore segreti,
admin attivo del CAF che abbia completato il cambio password e terminale privato:

```sh
NODE_ENV=production pnpm admin:export
```

Il comando chiede `organizationId`, email e password (input nascosto). Il ruolo e
l’organizzazione sono verificati nel DB: conoscere l’id non autorizza l’export.
Operatori, admin di altri CAF, disattivati e password temporanee sono rifiutati;
i tentativi sono limitati a 10/minuto per email HMAC. Le credenziali non passano in
argomenti, file o log. Non usare CI, redirect, session recorder o shell tracing.
L’accesso diretto alle credenziali DB resta un privilegio infrastrutturale distinto:
chi può interrogare liberamente il DB può aggirare qualunque CLI; limitarlo al tecnico.

Scrive un file nuovo `0600` in `.data/exports/organization-<UUID>.json`, directory
fuori Git: formato `avanti.organization`, versione 1, timestamp, organizzazione,
sportelli, impostazioni, operatori senza credenziali, pratiche con risposte strutturate,
contatti/note, messaggi originali, revisioni ed eventi, inclusi audit di cancellazione.
Lo snapshot transazionale è coerente. Documenti: elenco, metadati, analisi e **SHA-256**;
**nessun binario**, chiave storage, hash capability, sessione, password o credenziale MFA.
L’export richiede anche il codice TOTP/recupero quando l’admin ha MFA attiva; senza
configurazione, un obbligo MFA impedisce l’export. Tutti i prompt sensibili sono nascosti.

L’audit `organization.exported` registra la preparazione e i conteggi, non la
consegna; un errore di scrittura non stampa il dataset. Verificare destinatario,
integrità e importabilità con il CAF, trasferire file/binari cifrati tramite canale
approvato, documentare ricevuta e cancellare copie locali secondo l’accordo.
L’export completo contiene dati di più persone e note interne: il CAF deve filtrare
una risposta al singolo interessato e proteggere terzi. Supporta restituzione/uscita
ex art. 28 e, quando applicabile, portabilità art. 20; non dichiara assolti tutti i
diritti GDPR e non è un backup completo. Fonti/limiti in
[ricerca portabilità](research/data-portability.md) e [SECURITY.md](SECURITY.md).

## Runtime AI e scelta del modello

Configurazione completa in [`.env.example`](../.env.example) e API per gli sviluppatori in
[`packages/ai/README.md`](../packages/ai/README.md). Tutti i provider hanno fallback locali.
Le chiavi vanno nel gestore segreti del deploy, mai nel client, Git o nei report.

| Provider   | Impostazioni                                                               | Note                                                                                |
| ---------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| OpenRouter | `AI_PROVIDER=openrouter`, `OPENROUTER_API_KEY`, modelli `provider/model`   | `AI_DATA_POLICY=strict` richiede `data_collection:deny,zdr:true` a ogni chiamata    |
| OpenAI     | `AI_PROVIDER=openai`, `OPENAI_API_KEY`, ID OpenAI nei tre livelli          | Contratti e conservazione vanno configurati con OpenAI                              |
| Anthropic  | `AI_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`, ID Anthropic nei tre livelli | Contratti e conservazione vanno configurati con Anthropic                           |
| Gateway    | `AI_PROVIDER=gateway`, `AI_GATEWAY_API_KEY`, ID `provider/model`           | `AI_GATEWAY_PROVIDER` vincola `gateway.only`; impostazione legacy ancora supportata |
| Locale     | `AI_PROVIDER=none`                                                         | Nessuna chiamata esterna                                                            |

Specificare `AI_MODEL_FAST`, `AI_MODEL_REASONING`, `AI_MODEL_VISION` e facoltativamente
`AI_MODEL_FALLBACKS` (virgole, massimo cinque). Non affidarsi ai default come scelta di
produzione. `AI_MODEL_TEXT` e la selezione implicita Gateway continuano a funzionare;
il preflight segnala la configurazione legacy senza stampare chiavi.

`strict` non costituisce un accordo di trattamento né una garanzia UE. OpenAI, Anthropic e
Gateway richiedono verifiche contrattuali separate; nessuna variabile rende automaticamente
ZDR un account. Con OpenRouter il runtime non rimuove mai i filtri strict per recuperare
una risposta. Il provider può non avere endpoint compatibili: in quel caso usa l'euristica.
[Routing ufficiale OpenRouter](https://openrouter.ai/docs/guides/routing/provider-selection).

Configurazione candidata raccomandata per le prove sintetiche (A, misurata il 15 ottobre
2026; risultati e limiti in [eval live](verification/ai-eval-2026-10-15-live.md)):

```dotenv
AI_PROVIDER=openrouter
AI_DATA_POLICY=strict
AI_MODEL_FAST=deepseek/deepseek-v4.1-flash
AI_MODEL_REASONING=deepseek/deepseek-v4.1-flash
AI_MODEL_VISION=openai/gpt-6-luna
AI_MODEL_FALLBACKS=google/gemini-3.1-flash-lite
AI_REASONING_FAST=off
AI_REASONING_REASONING=minimal
AI_REASONING_VISION=minimal
AI_ATTEMPT_TIMEOUT_MS_FAST=6000
AI_ATTEMPT_TIMEOUT_MS_REASONING=15000
AI_ATTEMPT_TIMEOUT_MS_VISION=20000
AI_TOTAL_TIMEOUT_MS=45000
AI_MAX_ATTEMPTS=3
AI_PRICES='{"deepseek/deepseek-v4.1-flash":[0.03,0.70],"openai/gpt-6-luna":[0.10,0.50],"google/gemini-3.1-flash-lite":[0.25,1.50]}'
```

Risultati finali: A mediana testo **1.228 s**, p95 **3.559 s**, **1/74 ripieghi (1,35%)**, costo stimato **€0.016804**. B: **1.510 s**, p95 **7.873 s**, **0/74 ripieghi**, costo **€0.026836**; 68 risposte B sono state servite da DeepSeek. Entrambe: zero violazioni rilevate e 58/58 casi annotati corretti. Stress A: **40/40 AI**, concorrenza **8**, mediana **1.065 s**, p95 **1.664 s**, zero ripieghi e violazioni. A mantiene un timeout sulla sola immagine ostile; il fallback non attesta una lettura vision riuscita.

Riserva: Luna risponde in 2–9 s anche a richieste banali, troppo per il timeout di 6 s del
livello veloce; quando DeepSeek rallenta, la catena finiva nell'euristica. La riserva è quindi
Gemini 3.1 Flash-Lite (endpoint Google ZDR, ragionamento disattivabile): da sola, sulla stessa
eval, **74/74 AI**, 58/58 annotati corretti, zero violazioni, mediana **1,76 s**, p95 **3,28 s**
([rapporto](verification/ai-eval-2026-10-15-live-gemini-lite.md)). Luna resta il modello vision.

Provata anche B con `AI_REASONING_FAST=minimal`: mediana **2,324 s**, p95 **9,051 s**, **2/74 ripieghi**, costo stimato **€0,036394**; 66 risposte DeepSeek e 6 Luna. Il fallback eredita il ragionamento del livello. La raccomandazione resta A.

La chiave OpenRouter va impostata separatamente nel gestore segreti o nell'ambiente.
`AI_PROVIDER=none` resta il default dell'esempio locale: nessuna chiamata senza provider e
chiave. Per riprodurre A usare le variabili sopra; per B usare Luna nei tre livelli e
DeepSeek nei fallback. I controlli di ragionamento sono identici nelle due prove.

```bash
AI_LIVE=1 pnpm ai:eval --limit 74 --variant a
# Cambiare solo modelli e fallback per B:
AI_LIVE=1 pnpm ai:eval --limit 74 --variant b
# Ripristinare la configurazione migliore:
AI_LIVE=1 pnpm ai:stress --concurrency 8 --limit 40
```

Il comando eval live include ora tutto il dataset per default. Una variante salva JSON e
Markdown separati. I report contengono le risposte dei soli casi sintetici e non vanno
alimentati con dati reali. Gate: mediana testo <3 s, ripieghi <5%, nessuna violazione
rilevata. Il router può fare tentativi a monte non visibili all'SDK. Le traduzioni nelle
otto lingue e la correttezza normativa richiedono verifica umana oltre ai controlli automatici.

I timeout di tentativo per livello sono 6000/15000/20000 ms; `AI_ATTEMPT_TIMEOUT_MS` resta
l'override legacy comune quando manca quello specifico. Il totale per compito è il minimo
fra `AI_TOTAL_TIMEOUT_MS` (45000), due timeout del livello +500 ms e l'eventuale limite
specifico: con i default 12500/30500/40500 ms. Il breaker apre dopo tre richieste fallite
per modello e ammette un probe dopo 30 s. Conta solo errori provider, 429 e timeout, al
massimo un fallimento per modello nella stessa richiesta: un singolo compito vision lento
non apre il circuito. Errori di schema, validazione o guardia non sono outage.

`AI_REASONING_FAST/REASONING/VISION` accettano `off|minimal|low|medium`.
Su OpenRouter off invia `enabled:false`; gli altri livelli `effort` e `exclude:true`.
[Controlli ufficiali](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens).
OpenAI diretto mappa off a none e minimal a low per GPT-6; Anthropic usa adaptive/effort
quando disponibile, oppure budget 1024/2048/4096 sui modelli precedenti. Un 400 che nomina
il parametro consente una sola ripetizione senza quel controllo per modello, nel limite
di tempo e tentativi; il motivo `reasoning_unsupported` resta nella telemetria anche se il
retry riesce. La policy dati resta strict.

Lo schema remoto è non strict, senza regex lessicali Unicode; la validazione Zod completa
e i vincoli del compito restano locali. Una risposta strutturata vuota riprova una volta
come JSON testuale sullo stesso modello, con motivo `empty_structured_output` in telemetria. La telemetria non memorizza prompt o documenti.

Applicare la migrazione `0015_ai_runtime` prima del rilascio. `AI_MONTHLY_BUDGET_EUR=50` è il
default CAF; l'admin può impostare `aiMonthlyBudgetEur` in `/api/settings` (0 disattiva AI,
null ripristina il default). `/api/ai/usage?month=YYYY-MM` offre aggregati mensili del CAF,
`/api/status` mostra budget, provider, livelli, policy e presenza chiave. Le tariffe
`AI_PRICES` può specificare una coppia input/output EUR per milione per ciascun ID modello.
`AI_INPUT_EUR_PER_MILLION` e `AI_OUTPUT_EUR_PER_MILLION` coprono i modelli non elencati e
restano conservative. Il costo usa il modello restituito per ogni tentativo; le prenotazioni
usano il candidato più costoso della catena, incluso il ragionamento aggiuntivo Anthropic.
Usage assente e timeout mantengono una stima prudente: sono stime EUR, non fatture. Le prenotazioni
non riconciliate dopo un arresto restano addebitate: confrontarle col provider prima di una
correzione amministrativa, senza liberarle a scadenza mentre potrebbe esserci lavoro remoto.

In questo worktree Turborepo può risolvere la cache nella checkout principale: usare
`pnpm check --cache-dir="$PWD/.turbo/cache" --concurrency=1` e, per la build finale,
`TURBO_CACHE_DIR="$PWD/.turbo/cache" pnpm build`. Non condividere cache mutate con altri lavori.
