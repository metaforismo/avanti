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
| `renewal_reminders`  | Promemoria ISEE minimo dopo retention, con consenso versionato, scadenza fissa e sola capability di revoca hashata.                                                           |
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

I membri del fascicolo sono salvati in `cases.answers.members`, con UUID persistenti;
il promemoria minimo conserva una proiezione senza UUID, CF o data completa di nascita.
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

## Risposte rapide e cicli di promemoria

La sola migrazione `0012_quick_replies_citizen_reminders` è generata con drizzle-kit;
il numero verrà adattato al merge. `quick_replies` contiene `id`, `organization_id`,
`title`, `text`, `position`: FK cascade sul CAF, lunghezze 80/1.000 e posizione intera
0–49. La coppia univoca CAF/posizione impone anche il massimo di 50 righe per CAF.
Le scritture acquisiscono il lock dell'organizzazione e ricontrollano l'admin;
riordino e compattazione sostituiscono atomicamente le righe conservando gli ID.
Nessun fascicolo dipende dal template: il messaggio usato è una copia modificabile.
Il seed demo aggiunge cinque risposte, senza sovrascrivere i testi modificati.
Gli esempi non fissano anni o nuovi obblighi documentali: la giacenza rimanda all'anno
della checklist, basata sulla [ricerca ISEE](research/isee-2027.md).

`settings.notify_citizen_reminders` è false e `citizen_reminder_days` JSONB è `[3,4]`
per default. Un CHECK limita la sequenza a uno o due interi di 1–30 giorni.
`cases.citizen_request_id` identifica il ciclo aperto dalla richiesta di integrazione,
`citizen_requested_at` l'inizio. `citizen_reminders_queued` (CHECK 0–2) conta le
accodature, `citizen_reminder_sent_at` il completamento dell'ultima accodatura.
La seconda accodatura richiede quel completamento e il secondo intervallo trascorso.
Nuova richiesta: nuovo UUID e reset; risposta del cittadino o cambio stato: UUID nullo.
I vecchi casi rimangono senza ciclo; nessun backfill presume che siano ancora in attesa.
Un indice parziale seleziona solo i cicli di `needs_citizen` ancora aperti.

L'outbox ammette `kind=citizen_reminder`, con `citizen_request_id` e `reminder_number`
(1–2) obbligatori insieme a caso/CAF, vincolati dalla FK composta esistente.
`dedupe_key=reminder:<caseId>:<requestId>:<numero>` è unica; il contatore sul caso
sopravvive alla cancellazione delle ricevute dopo 30 giorni. Accodamento e contatore
sono nella stessa transazione, con lock caso e `SKIP LOCKED`; un errore li annulla entrambi.
Il dispatcher ricontrolla l'attualità sotto lock caso prima di contattare il provider;
completamento outbox, istante sul caso ed evento cronologia sono atomici.
`citizen.reminder_sent` e `citizen.reminder_simulated` hanno attore system e nessun
payload personale. Non cambiano `updated_at`. Cifratura, scadenza payload e retry
restano quelli dell'outbox esistente.

## Indicazioni pubbliche e ricevuta invio (15 ottobre 2026)

La migrazione unica `0013_office_next_steps_submission_receipt`, generata con
`drizzle-kit generate --name=office_next_steps_submission_receipt`, aggiunge:

- `offices.booking_url` e `offices.citizen_note`: text nullable. Indirizzo, città,
  telefono e orari usano le colonne esistenti. L'API rappresenta l'indirizzo non
  compilato con stringa vuota e non cambia i dati preesistenti.
- `settings.notify_citizen_submission`: boolean NOT NULL default false.
- `citizen_submission` tra i tipi ammessi dal CHECK di `notifications.kind`.

Nessun nuovo archivio di prenotazioni. Le indicazioni sono lette dallo sportello
corrente, anche per pratiche già inviate; il nome nella ricevuta è quello al
momento del primo invio. L'envelope cifrato contiene solo destinatario, mittente,
oggetto e testo minimo. La FK composta pratica/organizzazione resta applicata.

La transazione che prende il lock della pratica registra `submitted_at`, audit
e outbox. `submitted_at IS NULL` è la guardia durevole del primo invio;
`dedupe_key = citizen_submission:<case-id>` impedisce ulteriori inserimenti
nell'outbox. Il primo timestamp non viene azzerato nei reinvii: la guardia
sopravvive alla cancellazione delle ricevute dopo 30 giorni. Con opzione spenta
o senza email non si registra una notifica e non la si recupera retroattivamente.
Il provider continua a ricevere l'ID tecnico stabile della notifica come chiave
di idempotenza entro la sua finestra; questa non è una garanzia di consegna alla
casella del destinatario.

## Famiglie collegate e file condivisi (0014)

`cases.family_id` è il gruppo opaco creato dall'operatore nel proprio CAF durante
il riuso. Non dipende dalla sopravvivenza della pratica sorgente. L'anno applicativo
è in `answers.practice_year`, con default di catalogo 2027 per i record precedenti.
Ogni pratica conserva documenti e verifiche indipendenti; più documenti possono
referenziare la stessa `storage_key`. `reused_from_year` conserva l'anno originario,
`reused_member` l'identità al momento del riuso e `citizen_visible` l'autorizzazione
alla visibilità. La coda verifica i riferimenti prima di ogni cancellazione fisica.
La retention elimina una sola pratica alla volta; la richiesta dell'interessato
usa `family-erasure` per l'intero gruppo. L'export organizzazione include anche i promemoria minimi, senza hash di revoca.
Dettagli ed esempi in [document-reuse.md](decisions/document-reuse.md).

## Rinnovi ISEE (0023)

La migrazione `0023_isee_renewals` è generata con drizzle-kit (numero da riallineare
al merge). Su `cases`: `renewal_source_id` è provenienza opaca senza FK,
`renewal_year` anno nuovo, `renewal_household_confirmed_at` conferma cittadino,
`renewal_invited_at` ultima emissione link, `renewal_contact_consent_at` consenso
esplicito all'invito annuale. Le colonne sono nullable; nessun consenso pregresso
viene presunto. CHECK vincola la coppia sorgente/anno ai rinnovi ISEE collegati a
una famiglia; indice univoco CAF/sorgente/anno. Lo stato della campagna è derivato
dalla presenza del rinnovo e dai timestamp, senza uno stato duplicato da sincronizzare.

`settings.notify_citizen_renewals` è false per default.
L'outbox ammette `citizen_renewal` e contiene `citizen_link_hash`, confrontato al
momento dell'invio con il token corrente. Il link in chiaro è solo nell'envelope
cifrato; una rigenerazione rende obsoleti gli inviti precedenti. La cancellazione
segue la FK al rinnovo, non alla sorgente. Il consenso viene trasferito al rinnovo
soltanto se esplicito; la revoca lo rimuove dai fascicoli del gruppo nel CAF.

`answers.renewal_household_confirmed=false` fa riproporre obbligatoriamente `members`
come prima domanda, pur conservando il nucleo proposto dell'anno precedente. Solo
la risposta cittadino lo porta a true; `confirmed_answers` parte vuoto. Nessuna
risposta economica annuale è trasferita. Il gruppo famiglia e i file condivisi
seguono le stesse regole del riuso ordinario e rimangono validi dopo la cancellazione
della sorgente. [Decisione e verifiche](decisions/renewals.md).

## Promemoria minimo rinnovi dopo retention (0024 provvisoria)

`0024_renewal_retention_reminders`, generata con drizzle-kit e da rinumerare rispetto
alla PR metering, introduce `renewal_reminders`. PK `source_case_id` senza FK a
`cases`: la sorgente viene eliminata. FK cascade al CAF e composta sportello/CAF;
indici campagna CAF/anno/ID, famiglia CAF/gruppo e scadenza. Il gruppo opaco non
richiede la sopravvivenza di alcun fascicolo. Anno e lingua hanno CHECK; la scadenza
non può superare mezzanotte Roma del 1 aprile dell'anno successivo alla pratica.

Payload chiuso dal solo writer: contatto (soli nome/cognome/email/telefono già dati),
`household` (soli ruolo, nomi, anno nascita), riferimento, lingua, anno, CAF/sportello,
consenso (`consent_at`, `consent_version`), famiglia tecnica e scadenza. Nessun CF,
data completa di nascita, ID persona o documento, risposta economica, documento,
nota, messaggio o chiave storage. `withdrawal_token_hash` è l'hash del token sorgente
per la sola revoca, senza estenderne l'accesso ai dati. Non è esportato dalle API.

Su `cases`: `renewal_contact_consent_version` e `renewal_contact_revoked_at`, nullable,
senza backfill. La prova della versione nasce dall'azione esplicita submit/PUT;
il timestamp pregresso da solo non rende eleggibili alla conservazione minima.
Le copie di rinnovo mantengono data/versione originarie; la revoca nel gruppo le
azzera e registra la revoca. Audit con soli codici numerici della versione/lingua,
booleani e riferimenti tecnici, soggetto alla durata propria di 365 giorni.

Retenzione: solo ISEE con primo invio, consenso versionato e contatto utile; nessuna
proroga del fascicolo o dei file. Esempio 2027: promemoria fino a fine 31 marzo 2028
(Roma), escluso dalle query alla scadenza ed eliminato dal cron successivo. Revoca
e cancellazione su richiesta eliminano subito i promemoria del gruppo. Family-erasure
funziona anche da ID sorgente ormai cancellata; se restano solo promemoria può
restituire `deletedCases:0`. Vedi [decisione](decisions/renewals.md#promemoria-minimo-alla-retention-16-ottobre-2026).

L’export CLI del CAF include `renewalReminders` per portabilità, senza `withdrawal_token_hash`;
non esporta nuove capability. Il formato resta versione 1 con campo additivo.

## Versione del contenuto per «quasi pronta» (0026)

`0026_near_ready_content_version`, generata con drizzle-kit e completata in coda con SQL
manuale, aggiunge `cases.content_version` (`timestamptz NOT NULL`, backfill uguale a
`updated_at`). `updated_at` resta la versione di concorrenza (`expectedUpdatedAt`) e
cresce a ogni scrittura; `content_version` identifica il fascicolo come l'ha consegnato
il cittadino ed è la chiave di `near_ready_evaluations.case_version`,
`near_ready_blind_reviews.case_version` e `near_ready_events.case_version`.

La colonna è gestita solo dal trigger `cases_content_version` (BEFORE INSERT/UPDATE):
all'inserimento vale `updated_at`; avanza quando cambia `ai_attention` (nuove incongruenze
AI, pubblicate senza nuovo `updated_at`) o quando cambia `updated_at` in una transazione
che non ha dichiarato lavoro dell'operatore con
`set_config('avanti.operator_work', 'on', true)` (`markOperatorWork` nell'API). Il valore è
`greatest(updated_at, content_version precedente + 1 ms)`: monotono anche con clock fermo e
con la stessa precisione al millisecondo delle versioni API. Una scrittura diretta della
colonna conserva il valore precedente. La classificazione è prudente: un nuovo writer che
non dichiara il lavoro conta come contenuto e ritira un suggerimento, mai il contrario.

Dichiarano lavoro: presa in carico e cambi di stato, assegnatario e note (`PATCH /cases/:id`),
verifica/rifiuto/«non serve» delle voci, richiesta di integrazione, rigenerazione del link e
decisioni sul precompilato DSU. Restano contenuto: risposte e conversazione, nucleo,
caricamento/rimozione/riassegnazione e analisi dei documenti, riuso familiare, invio del
cittadino, `ai_attention`, il ricontrollo esplicito e le modifiche di politica del CAF (che
avanzano `updated_at` delle pratiche aperte dal trigger su `settings`).

`withdraw_near_ready` ora scatta (AFTER UPDATE OF `updated_at`, `ai_attention`,
`content_version`: le colonne cambiate solo da un BEFORE trigger non contano per
`UPDATE OF`) quando cambia `content_version` e registra il ritiro con quella versione.
