# Avanti

**Il fascicolo arriva pronto. Avanti il prossimo.**

Avanti è il front office AI per CAF e patronati. Il cittadino descrive in parole sue (e nella
sua lingua) cosa deve fare; Avanti capisce la pratica, fa solo le domande necessarie, costruisce
la checklist personalizzata, controlla i documenti caricati e consegna all'operatore un
fascicolo ordinato, con quello che manca già evidenziato.

Avanti **non** sostituisce l'operatore abilitato né il gestionale del CAF: prepara il lavoro
prima che arrivi allo sportello.

```
cittadino → AI → fascicolo completo → operatore CAF → pratica ufficiale
```

> Stato: in sviluppo attivo, pronto per le prove interne. Primo verticale: **ISEE ordinario
> 2027** (DSU con redditi e patrimoni 2025), pilota con CAF gennaio 2027. Vedi la
> [roadmap](docs/ROADMAP.md).

![Landing di Avanti](docs/screenshots/landing.png)

| Cittadino: ingresso dal QR                           | Cittadino: una domanda alla volta                  | Cittadino: documenti                                   |
| ---------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------ |
| ![Ingresso](docs/screenshots/cittadino-ingresso.png) | ![Domande](docs/screenshots/cittadino-domande.png) | ![Documenti](docs/screenshots/cittadino-documenti.png) |

![Console operatore: fascicolo](docs/screenshots/console-fascicolo.png)

Gli screenshot si rigenerano con `pnpm --filter @avanti/web screenshots` (dati demo fittizi).

## Avvio rapido

```bash
pnpm install        # store globale ~/Library/pnpm/store (.npmrc)
pnpm dev            # http://localhost:3400
```

Requisiti: Node ≥ 22.19 (consigliato 24), pnpm 10. Nessuna chiave necessaria in locale.

## Percorsi dell'app

| Percorso                 | Per chi   | Cosa fa                                                       |
| ------------------------ | --------- | ------------------------------------------------------------- |
| `/`                      | CAF       | Landing e candidatura al pilota                               |
| `/s/[sportello]`         | Cittadino | Ingresso dal QR dello sportello: lingua, informativa, avvio   |
| `/pratica/[token]`       | Cittadino | Esigenza, domande, documenti, invio (link personale)          |
| `/console`               | Operatore | Coda pratiche con filtri                                      |
| `/console/pratiche/[id]` | Operatore | Fascicolo: problemi, verifica documenti, integrazioni, export |
| `/console/metriche`      | Operatore | Tempi e completezza misurati                                  |
| `/console/sportelli`     | Operatore | Link e QR degli sportelli, cartello A4 da stampare            |

## Struttura

| Percorso             | Cosa contiene                                            |
| -------------------- | -------------------------------------------------------- |
| `apps/web`           | Next.js 16: landing, flusso cittadino, console operatore |
| `packages/contracts` | Schemi zod condivisi delle API                           |
| `packages/core`      | Catalogo pratiche, intervista, checklist, verifiche      |
| `packages/db`        | Schema Drizzle, migrazioni, seed                         |
| `packages/api`       | Backend Hono montato su `/api`                           |
| `docs/`              | Architettura, API, modello dati, ricerca normativa       |

## Script

| Comando                              | Effetto                                             |
| ------------------------------------ | --------------------------------------------------- |
| `pnpm dev`                           | Avvia l'app web con backend integrato               |
| `pnpm check`                         | Lint + typecheck + test di tutti i pacchetti        |
| `pnpm --filter @avanti/web test:e2e` | Test end-to-end Playwright (Chrome locale, DB demo) |
| `pnpm build`                         | Build di produzione                                 |
| `pnpm db:seed`                       | Carica i dati demo                                  |

## Documentazione

- [Stato e roadmap](docs/ROADMAP.md)
- [Architettura](docs/ARCHITECTURE.md)
- [Design e UX](docs/DESIGN.md)
- [Guida per gli operatori](docs/guide/operatori.md)
- [Ricerca: mercato, competitor, normativa](docs/research/README.md)
- [Istruzioni per agenti e contributori](AGENTS.md)

## Licenza

Proprietario. Tutti i diritti riservati.

## Sviluppo backend

```bash
pnpm install
pnpm db:seed      # idempotente, solo demo: mai su un database con dati reali
pnpm dev          # http://localhost:3400
curl http://localhost:3400/api/health
pnpm format:check
pnpm check
pnpm build
```

Se il watcher nel sandbox macOS restituisce `EMFILE`, lo smoke locale può usare
`WATCHPACK_POLLING=1000 pnpm dev --env-mode=loose -- --port=3417`.
La modalità `loose` passa l’impostazione di polling al processo Next; la porta diversa
consente di mantenere avviato l’altro worktree.

Il seed crea **CAF Demo Milano**, sedi `demo-milano-centro` e
`demo-milano-loreto`, dieci fascicoli e PDF chiaramente marcati ESEMPIO. Le
metriche demo sono sintetiche, non risultati del pilota. Credenziali locali:

| Ruolo       | Email                           | Password          |
| ----------- | ------------------------------- | ----------------- |
| Admin       | `admin@demo.avanti.local`       | `DemoAvanti2027!` |
| Operatore   | `operatore@demo.avanti.local`   | `DemoAvanti2027!` |
| Disattivato | `disattivato@demo.avanti.local` | accesso negato    |

La password è identica soltanto nei dati demo. Seed rifiutato con
`NODE_ENV=production`; non distribuire queste credenziali in ambienti reali. I link
cittadino vengono mostrati una volta alla creazione; non sono ricostruibili dal DB.

## Configurazione

Copia `.env.example` in `apps/web/.env.local` per Next. Gli script DB leggono
variabili della shell: per Postgres esporta `DATABASE_URL` anche quando esegui
`pnpm db:migrate` e `pnpm db:seed`.

| Variabile                           | Effetto                                                                                                         |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                      | Postgres con postgres-js; vuota: PGlite in `.data/pglite`                                                       |
| `BLOB_READ_WRITE_TOKEN`             | Vercel Blob privato; vuota: disco `.data/uploads`                                                               |
| `AI_GATEWAY_PROVIDER`               | Provider Gateway unico consentito (default `anthropic`); se non disponibile, fallback locale                    |
| `AI_GATEWAY_API_KEY`                | Abilita AI SDK 7; vuota: flusso euristico senza chiamate esterne                                                |
| `AI_MODEL_TEXT` / `AI_MODEL_VISION` | ID Gateway `provider/model`, default `anthropic/claude-sonnet-5.5`                                              |
| `PUBLIC_APP_URL`                    | Origine aggiuntiva per CSRF e base dei link; obbligatoria in produzione, default locale `http://localhost:3400` |
| `TRUST_PROXY`                       | `1` con proxy fidato: IP dell’ultimo hop di x-forwarded-for; su Vercel x-real-ip                                |

`RATE_LIMIT_SECRET` è obbligatorio in produzione: segreto casuale stabile per gli
HMAC dei bucket IP/email. In locale, senza un indirizzo di trasporto attendibile,
il login usa il limite per email e i turni/upload quello per link cittadino.
I proxy devono fornire l’header fidato; gli header client non sono usati quando
`TRUST_PROXY=0`.

Il cookie è una sessione opaca casuale salvata come hash; non necessita di un segreto
di firma condiviso. I parametri per organizzazione sono in `settings`: baseline
manuale, durata link 60 giorni, retention 180 giorni. Il job cron applica la retention a lotti di 25 fascicoli; procedura, scheduler e prove
di cancellazione nel deployment sono prerequisiti del pilota.

Migrazioni SQL versionate in `packages/db/migrations`, generate con `pnpm db:generate`.
Applicate idempotentemente all'avvio in sviluppo/test. In produzione eseguire
`pnpm db:migrate` prima del rilascio. Su Vercel sono obbligatori Postgres e Blob
privato: il filesystem serverless non è uno storage persistente. La configurazione
Next include migrazioni e font nell'output tracing ed esclude PGlite dal bundle.

L'analisi euristica usa indizi del nome file e del formato: non attesta leggibilità,
titolarità o completezza. L'operatore deve verificare. Senza AI, le richieste libere
dell'operatore mantengono l'originale italiano e mostrano un avviso localizzato; non
vengono presentate come traduzioni già verificate.

## Documentazione backend

- [API e semantica dei KPI](docs/API.md)
- [Modello dati](docs/DATA_MODEL.md)
- [Sicurezza e prerequisiti GDPR/AI Act](docs/SECURITY.md)
- [Ricerca ISEE 2027 e limiti annuali](docs/research/isee-2027.md)
- [Decisioni backend](docs/decisions/backend.md)

ISEE e 730 2027 sono preparati secondo le regole disponibili al 5–6 ottobre 2026:
modelli e istruzioni annuali vanno ricontrollati prima del pilota. Avanti prepara
un fascicolo e non trasmette alcuna pratica agli enti.

Le sessioni si rinnovano anche durante la consultazione e scadono comunque dopo 12 ore.
La manutenzione è separata dalle richieste utente: `GET /api/cron/maintenance`, con
`Authorization: Bearer <CRON_SECRET>`, elimina sessioni e bucket scaduti, cancella i fascicoli oltre retention e ritenta le
cancellazioni dei file. Configurare Vercel Cron (o un scheduler Node) almeno ogni ora.
`CRON_SECRET` deve essere casuale e riservato; senza segreto l’endpoint rifiuta ogni chiamata.
La manutenzione limita i tentativi a uno al minuto anche dopo un errore. Le cancellazioni
fallite restano in `storage_deletions` fino alla conferma dello storage.

I download e gli export appendono eventi di accesso anche su GET; la lettura di un
fascicolo non modifica la sua data di aggiornamento o lo stato di revisione.
Ogni pratica accetta al massimo 60 documenti. Il parser PDF usa un worker riutilizzabile,
un heap dimensionato sul limite upload e una scadenza di 15 secondi per lavoro. Timeout,
OOM e saturazione restituiscono 503 con invito a riprovare; un PDF non leggibile restituisce 415.
HEIC resta scaricabile e soggetto a controllo visivo dell’operatore.

In produzione l’adattatore Fetch di Next richiede un proxy fidato. Con un server Node
che passa i binding Hono, inizializzare `createApp({ ..., transport: "node" })` prima di
aprire il listener: il rate limit usa `incoming.socket.remoteAddress`. Un adattatore diverso
può fornire `clientAddress`. La configurazione priva di un trasporto identificabile o proxy
viene rifiutata all’inizializzazione, con un errore esplicito. Non fidarsi di header inviati
direttamente dal client.

`GET /api/health` espone `fallbackCount`, il numero di errori AI degradati al fallback
nella singola istanza, senza dettagli di richieste o cittadini.
