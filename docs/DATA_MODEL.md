# Modello dati

## Motori e migrazioni

Lo schema PostgreSQL è definito con Drizzle in `packages/db/src/schema.ts`. Senza
`DATABASE_URL`, PGlite salva i dati in `.data/pglite`; nei test il database è in memoria.
Con `DATABASE_URL` si usa postgres-js, con un pool di cinque connessioni e prepared
statements disabilitati per compatibilità con pooler esterni. Lo stesso schema e le stesse
query funzionano sui due driver; postgres-js non richiede uno specifico fornitore cloud.

`pnpm db:generate` produce migrazioni SQL e snapshot versionati. In sviluppo e nei test,
`createDatabase` applica le migrazioni mancanti prima di restituire il client. Il journal
Drizzle ne evita la riapplicazione. Su PostgreSQL un advisory lock di sessione serializza
le migrazioni tra istanze concorrenti. PGlite locale richiede un unico processo proprietario
della directory. In produzione le migrazioni si applicano esplicitamente con
`pnpm db:migrate`, prima dell'avvio: non vengono avviate da una richiesta HTTP.

## Tabelle

| Tabella              | Contenuto e vincoli principali                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| `organizations`      | Titolare CAF/patronato/studio; radice del tenant.                                                             |
| `offices`            | Sedi e slug pubblico univoco; appartenenza a un'organizzazione.                                               |
| `operators`          | Operatori, ruolo e hash scrypt; email normalizzata dall'API e univoca.                                        |
| `sessions`           | Hash del token casuale, operatore e scadenza; nessun token in chiaro.                                         |
| `cases`              | Pratica, risposte tipizzate JSON, lingua, contatto, stato, link hash, assegnatario, note e istanti KPI.       |
| `members`            | Membri con identificatori stabili, ruolo, nome e anno di nascita; PK composta pratica/ID.                     |
| `checklist_reviews`  | Decisione e nota per coppia pratica/voce stabile; operatore e istante della revisione.                        |
| `documents`          | Metadati, chiave storage, SHA-256 e analisi tipizzata; mai i byte nel database.                               |
| `messages`           | Conversazione necessaria alla pratica e originale italiano delle traduzioni.                                  |
| `events`             | Audit strutturato: categoria di azione, attore, identificatore e istante; metadata solo numeri/booleani/null. |
| `leads`              | Richieste del pilota, contatto e data di accettazione dell'informativa.                                       |
| `settings`           | Baseline dichiarata, retention (default 180 giorni), durata link (default 60 giorni).                         |
| `rate_limits`        | Contatori e scadenze; la chiave deve essere un hash, senza IP in chiaro.                                      |
| `reference_counters` | Progressivo atomico per organizzazione e anno.                                                                |

La reference è `AV-AAAA-NNNNNN`: un `INSERT … ON CONFLICT … UPDATE … RETURNING`
incrementa il contatore senza leggere prima il valore. Le reference sono univoche dentro
il tenant; il numero non costituisce una capability di accesso.

Tutti gli istanti sono `timestamptz`, trattati in UTC. Le API li serializzano come ISO 8601.
`expiresOn` nell'analisi documento è invece una data civile (`YYYY-MM-DD`), senza fuso.
L'anno dei redditi/patrimoni appartiene al catalogo versionato e all'analisi, non si deduce
dalla data di upload.

## Isolamento e conservazione dei collegamenti

Le query della console devono sempre filtrare per `organization_id`; le foreign key
composte impediscono anche di collegare una pratica a una sede o a un assegnatario di un
altro tenant. Indici coprono tenant/stato/aggiornamento, tenant/sede/creazione,
assegnatario, hash token, documenti per pratica e audit per tenant/tipo/istante.

La cancellazione di una pratica elimina membri, revisioni, messaggi, eventi e metadati
documenti. La cancellazione dei byte storage deve essere coordinata dal servizio: una
foreign key non può eliminare file. Sedi e assegnatari ancora usati dalle pratiche sono
protetti dalla cancellazione. La cancellazione di un operatore elimina le sessioni e
azzera la sua attribuzione nelle revisioni.

`checklist_item_id` e `member_id` sui documenti sono riferimenti logici, non foreign key
verso una checklist materializzata o un membro: se una risposta rende una voce non più
applicabile, il documento resta conservato e viene esposto come non abbinato. Le decisioni
dell'operatore restano per l'identificatore stabile della voce; il servizio deve rivalutarne
l'applicabilità prima di mostrarle. La hash SHA-256 non è univoca: i duplicati devono
essere conservati e segnalati, evitando di perdere un upload del cittadino.

## KPI e demo

Il primo invio salva `submitted_at` e `first_submission_complete` senza riscriverli agli
invii successivi. Gli eventi `case.created`, `case.submitted`, `review.started`,
`review.completed` e `citizen.requested` supportano conteggi e richieste di integrazione.
Il tempo creazione/primo invio è tempo trascorso, non tempo di attività verificata. Anche
l'intervallo apertura/completamento revisione include possibili pause: non va presentato
come tempo attivo o come risparmio provato. La baseline rimane un valore dichiarato dal CAF,
separato dai tempi osservati. In assenza di osservazioni una media/percentuale è `null`.

`pnpm db:seed` inserisce il tenant "CAF Demo Milano", due sedi, due operatori e dieci
pratiche con persone fittizie. Documenti generati riportano "ESEMPIO" e gli eventi sono
simulati per mostrare la console: metriche demo non sono risultati del pilota. Gli ID demo
sono stabili; un secondo seed non sovrascrive pratiche o revisioni modificate dall'operatore.
