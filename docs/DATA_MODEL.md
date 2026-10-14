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

| Tabella              | Contenuto e vincoli principali                                                                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `organizations`      | Titolare CAF/patronato/studio; radice del tenant.                                                                                                                             |
| `offices`            | Sedi e slug pubblico univoco; appartenenza a un'organizzazione.                                                                                                               |
| `operators`          | Operatori, ruolo e hash scrypt; email normalizzata dall'API e univoca.                                                                                                        |
| `sessions`           | Hash del token casuale, operatore e scadenza; nessun token in chiaro.                                                                                                         |
| `cases`              | Pratica, risposte tipizzate JSON, lingua, contatto, stato, link hash, assegnatario, note e istanti KPI.                                                                       |
| `checklist_reviews`  | Decisione e nota per coppia pratica/voce stabile; operatore e istante della revisione.                                                                                        |
| `storage_deletions`  | Tombstone e backoff per cancellazioni storage da ritentare tramite cron, senza nome o contenuto del file.                                                                     |
| `documents`          | Metadati, chiave storage, SHA-256 e analisi tipizzata; mai i byte nel database.                                                                                               |
| `messages`           | Conversazione necessaria alla pratica e originale italiano delle traduzioni.                                                                                                  |
| `events`             | Audit strutturato: azione, attore/ID, account interessato, istante, riferimento pratica e metadata numerici/booleani/null; conservazione autonoma di 365 giorni.              |
| `leads`              | Richieste del pilota, contatto e data di accettazione dell'informativa.                                                                                                       |
| `settings`           | Baseline dichiarata, retention (default 180 giorni), durata link (default 60 giorni).                                                                                         |
| `notifications`      | Outbox atomica degli eventi: tipo, lingua, ID tecnici, envelope AES-GCM con destinatario e messaggio minimo, stato, tentativi, prossimo tentativo, lease ed errore sintetico. |
| `rate_limits`        | Contatori e scadenze; la chiave deve essere un hash, senza IP in chiaro.                                                                                                      |
| `reference_counters` | Progressivo atomico per organizzazione e anno.                                                                                                                                |

`settings` include `notifyCitizenReady` e `notifyOperatorDigest` (false per default),
e `lastDigestDate` interno per l'unicità del riepilogo UTC. La migrazione 0010 aggiunge
preferenze e outbox. `dedupe_key` è univoca per evento; l'ID della notifica è la chiave
di idempotenza Resend.
`first_attempt_at` conserva l'inizio della finestra di esito incerto: dopo un rifiuto
temporaneo confermato può tornare null soltanto se non ci sono tentativi precedenti
incerti. `attempts` e payload restano invariati, salvo incremento al nuovo tentativo.
Stati: `pending`, `sending`, `sent` (accettata dal provider), `simulated` (console),
`failed`, `cancelled`. Payload cancellato dopo conferma/annullamento
o scadenza di 7 giorni; ricevute dopo 30 giorni dal completamento. FK cascade eliminano
anche le notifiche con pratica/lead/operatore/organizzazione. Nessun indirizzo o contenuto
è conservato in chiaro nell'outbox. [Runbook](DEPLOY.md#notifiche-email-e-outbox).

La migrazione 0009 aggiunge `system_jobs` (ultimo run globale di manutenzione e
retention) e `operational_counters` (conteggi orari per tenant, senza payload).
Vincoli, retention della telemetria e semantica in [SYSTEM_STATUS.md](SYSTEM_STATUS.md).

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
altro tenant. Gli eventi associati a un caso hanno a loro volta una foreign key composta
per imporre che il tenant dell’audit corrisponda a quello della pratica. Indici coprono tenant/stato/aggiornamento, tenant/sede/creazione,
assegnatario, hash token, documenti per pratica e audit per tenant/tipo/istante.

La migrazione `0008_motionless_thunderbolt_ross` aggiunge il riferimento tecnico
agli eventi esistenti, l’ID dell’account interessato e gli indici per paginazione,
attore e riferimento. Le FK degli eventi verso le pratiche sono restrittive:
la cancellazione deve prima scollegarli (`caseId=null`, `deletedCaseId=id`) nella
stessa transazione. Il tenant è nullable soltanto per tentativi di login falliti
di account sconosciuti, senza attore/risorsa identificabile; un CHECK limita questa
eccezione. Nessun admin può consultarli. Gli audit già privi di pratica prima della
migrazione non possono recuperare un riferimento che non è più nel DB.

I membri sono salvati soltanto in `cases.answers.members`, con UUID persistenti;
la vecchia tabella `members` è stata rimossa. `confirmed_answers` conserva le chiavi
confermate e `editing_question` la domanda da riproporre durante un edit. Per i casi
preesistenti la migrazione conferma tutte le chiavi delle risposte già salvate.

La cancellazione di una pratica elimina revisioni, messaggi, eventi e metadati
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

Lingue, stati, ruoli e decisioni sono verificati anche con vincoli SQL. I metadata
dell’audit ammettono soltanto un oggetto con valori numerici, booleani o null:
stringhe, array e oggetti annidati sono rifiutati dal DB. Nomi di chiave e categorie
devono comunque essere costanti definite dal backend; un numero non garantisce
da solo l’assenza di dati personali. Non è implementata una policy RLS: i vincoli
non sostituiscono il filtro tenant e l’autorizzazione delle query API.

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

Il seed rifiuta `NODE_ENV=production`, Vercel, qualsiasi `DATABASE_URL` e database con organizzazioni diverse dal tenant
demo. Nucleo e checklist usano lo stesso core delle API; i contatori demo vengono
assegnati nella transazione del caso. Se la creazione fallisce, vengono rimossi i file
scritti da quel tentativo. Nei test PGlite e le migrazioni restano in memoria, mentre
i PDF sono in directory temporanee rimosse a fine test. Le verifiche locali non
attestano la compatibilità con uno specifico servizio PostgreSQL remoto, che va
validato prima del deploy.

## Coda di analisi e portabilità

La migrazione 0007 aggiunge `documents.analysis_lease_token` e
`analysis_lease_until`: proprietà e scadenza del lease DB condiviso da upload,
recupero su lettura e cron. Restano interni, esclusi dai DTO e dall’export. Le righe
`processing` preesistenti con lease nullo restano recuperabili dopo 2 minuti.
La finalizzazione richiede lo stesso token e lease ancora valido, sotto lock pratica.

Bootstrap registra `organization.bootstrapped`, export `organization.exported`,
senza credenziali o dati personali nei metadata. L’export versione 1 include dati
CAF/pratiche, risposte, messaggi, revisioni, eventi e documenti con SHA-256, senza
capability, sessioni, hash password, chiavi storage o binari. Runbook in DEPLOY.md.

## MFA operatori (migrazione 0011)

- `operators.mfa_secret`: segreto base32 cifrato AES-256-GCM (`v1:iv:tag:ciphertext`),
  associato crittograficamente all'ID operatore; null quando MFA è disattivata.
- `operators.mfa_enabled_at`: istante di conferma, null per account senza MFA.
- `operators.mfa_last_used_step`: bigint, massimo passo TOTP consumato; verifica
  atomica sotto lock operatore, condivisa con conferma, API e CLI. I passi uguali o
  precedenti sono respinti anche se il clock torna indietro.
- `operators.mfa_recovery_hashes`: JSONB con soli hash SHA-256 con dominio separato
  dei codici casuali da 128 bit, default `[]`; il consumo rimuove un hash sotto lock.
- `sessions.state`: `authenticated` (default per le sessioni preesistenti),
  `mfa_pending` (sola password) oppure `mfa_setup` (obbligo da configurare), con CHECK.
- `sessions.mfa_setup_secret`, `mfa_setup_expires_at`: configurazione cifrata
  temporanea legata alla sessione iniziatrice, al massimo cinque minuti. La conferma
  revoca tutte le sessioni precedenti: il segreto provvisorio viene eliminato.
- `settings.mfa_required`: boolean NOT NULL default false; nessuna modifica al seed.

TOTP e codici di recupero non entrano nel modello pubblico dell'operatore, negli
export o nei metadati degli eventi. I nuovi eventi MFA usano solo tipo, timestamp,
organizzazione, attore/soggetto e l'eventuale boolean `rateLimited`/`cli`.
La manutenzione delle sessioni scadute elimina anche configurazioni provvisorie;
non serve una nuova tabella o un job separato.
