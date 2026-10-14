# API Avanti

Base path `/api`, JSON UTF-8, backend Hono in Next runtime Node. Schemi request/response:
`@avanti/contracts`. Tutte le risposte sono `Cache-Control: no-store`. Errori nel formato
`ApiError`: messaggio sicuro, codice stabile e request ID; niente stack o SQL. Gli errori
di dominio dell'intervista sono nella lingua cittadino, gli errori infrastrutturali in italiano.

`GET /api/status` restituisce `SystemStatus` solo agli admin del CAF autenticato:
componenti, contatori senza dati personali, job e versione. Contratto, esempio JSON,
scope e soglie in [SYSTEM_STATUS.md](SYSTEM_STATUS.md).

## Pubblico

| Metodo | Percorso             | Input                  | Risposta                                                                             |
| ------ | -------------------- | ---------------------- | ------------------------------------------------------------------------------------ |
| GET    | `/health`            | —                      | `{status:"ok",fallbackCount:number}`: processo API pronto, non prova provider remoti |
| GET    | `/practices?lang=it` | `Language`, default it | `PracticeSummary[]`, include coming_soon                                             |
| GET    | `/offices/:slug`     | slug pubblico          | `{office:Office,organization:OrganizationPublic}`                                    |
| POST   | `/leads`             | `PilotLeadRequest`     | 201 `{ok:true}`                                                                      |
| POST   | `/intake`            | `StartIntakeRequest`   | 201 `StartIntakeResponse`, token mostrato una volta                                  |

`privacyAccepted:true` obbligatorio per intake e lead. Coming soon non avviabili. La privacy
è presa visione; il CAF definisce basi giuridiche e deleghe, anche per gli altri membri.

## Cittadino

Capability in `/c/:token`: 32 byte casuali base64url, solo SHA-256 in DB, scadenza di default
60 giorni. Link scaduto: 410 `link_expired`; inesistente: 404. Nessun account cittadino. Un messaggio iniziale in tutte le lingue indica
assistenza automatica/AI, verifica umana e possibilità di rivolgersi allo sportello.
Il link è una credenziale: frontend/proxy devono oscurarlo dai log e applicare no-referrer.

| Metodo | Percorso dopo `/c/:token` | Input                                    | Risposta                                    |
| ------ | ------------------------- | ---------------------------------------- | ------------------------------------------- |
| GET    | ``                        | —                                        | `CitizenCase`                               |
| POST   | `/turn`                   | `IntakeTurn`                             | `IntakeTurnResponse` con `engine` opzionale |
| PUT    | `/language`               | `UpdateLanguageRequest`                  | `CitizenCase`                               |
| POST   | `/documents`              | multipart `file`, `UploadDocumentFields` | 201 `CitizenCase`                           |
| PATCH  | `/documents/:id`          | `ReassignDocumentRequest`                | `CitizenCase`                               |
| DELETE | `/documents/:id`          | —                                        | `CitizenCase`                               |
| GET    | `/documents/:id/file`     | —                                        | allegato autorizzato                        |
| POST   | `/submit`                 | `SubmitCaseRequest`                      | `CitizenCase` con stato submitted           |

Intervista/upload modificabili in `intake` o `needs_citizen`. Invio richiede pratica e
intervista terminata; può contenere documenti mancanti, esplicitamente segnalati. La prima
completezza è fotografata al primo invio e non riscritta da integrazioni successive.

`turn`: text classifica/estrae; sotto confidenza 0,75 rimane la scelta esplicita della
pratica. answer valida tipi/opzioni/condizioni; edit rende prioritaria la domanda modificata e invalida dipendenze; skip ammesso solo
per domande opzionali; choose_practice riparte con risposte vuote quando cambia pratica.
AI SDK 7 propone, core convalida. Nessuna chiave/errore/timeout → euristica esplicita.

### Classificazione non disponibile e ripresa del racconto

`POST /c/:token/turn` restituisce `IntakeTurnResponse`: tutti i campi di `CitizenCase`
più **`unavailablePractice: PracticeId | null`**, sempre presente. È un esito del singolo
turno, non un campo persistente del fascicolo; GET, cambio lingua e upload restituiscono
`CitizenCase`. Un client che usa `CitizenCase.parse` deve passare a `IntakeTurnResponse.parse`
per leggere il nuovo campo (Zod elimina le chiavi estranee).

Con testo libero e classificazione affidabile `coming_soon`, HTTP **200**, messaggio
cittadino e risposta assistente salvati in `messages`, `unavailablePractice` valorizzato.
La pratica non viene avviata né sostituisce una pratica già scelta, e le risposte precedenti
restano conservate. Per mostrare alternative, caricare `GET /practices?lang=<language>`
e filtrare `availability !== "coming_soon"`; inviare `{type:"choose_practice",practiceId}`.
Il turno successivo restituisce `unavailablePractice:null` se non ha un nuovo esito indisponibile.
La rilettura del fascicolo conserva la conversazione e permette una nuova scelta.

Avvio `POST /intake` con `practiceId` indisponibile e turno `choose_practice`:
HTTP **400**, `ApiError.error.code = "practice_unavailable"`. Il client può tradurre questo
codice; il messaggio sicuro italiano usa lo stesso testo sotto. Nessun fascicolo viene
creato per un avvio rifiutato, nessuna risposta/chat cambia per una scelta rifiutata.

Testi della risposta assistente, deterministici anche con AI attiva, in `core/src/i18n.ts`
(chiave `unavailablePractice`):

| Lingua | Testo                                                                                                          |
| ------ | -------------------------------------------------------------------------------------------------------------- |
| it     | Questa pratica non si può ancora preparare con Avanti. Puoi sceglierne un’altra o chiedere allo sportello.     |
| en     | Avanti cannot prepare this service yet. You can choose another service or ask your office.                     |
| fr     | Avanti ne peut pas encore préparer ce dossier. Vous pouvez choisir un autre service ou contacter votre bureau. |
| es     | Avanti aún no puede preparar este trámite. Puedes elegir otro o consultar en la oficina.                       |
| ro     | Avanti nu poate pregăti încă acest dosar. Poți alege alt serviciu sau întreba la sediu.                        |
| uk     | Avanti ще не може підготувати цю справу. Ви можете обрати іншу послугу або звернутися до офісу.                |
| ar     | لا يمكن تحضير هذا الطلب مع Avanti بعد. يمكنك اختيار خدمة أخرى أو سؤال المكتب.                                  |
| bn     | Avanti এখনও এই কাজের নথি প্রস্তুত করতে পারে না। অন্য সেবা বেছে নিতে পারেন বা অফিসে জিজ্ঞাসা করতে পারেন।        |

Il racconto sull’ISEE universitario avvia la **raccolta** `isee_ordinario` con
`answers.university:true`; la scelta esplicita del catalogo `isee_universitario` resta
indisponibile. L’operatore riceve `practice.university_review` e `practice.full_dsu` nei
`findings` del dossier: [fonte e limiti](research/isee-universita.md).

### Minimo del nucleo e indizi da confermare

La domanda `household_count` espone `min` pari al numero dei ruoli già proposti,
richiedente incluso (default 1). Dopo la conferma, `answers.members` prevale sui ruoli
estratti. Modificare l’elenco aggiorna conteggio e minimo; per ridurre il nucleo occorre
prima correggere l’elenco. Una risposta intera positiva sotto `min` restituisce 400
`bad_request` con spiegazione nella lingua cittadino, ad esempio «Hai detto che vivi
con il tuo coniuge: siete almeno 2.»; formati, frazioni e limiti massimi usano la
validazione ordinaria. L’errore non cambia le risposte salvate.

`answers.household_roles` contiene i ruoli del contratto e `household_relations` le
relazioni, in ordine senza richiedente: `madre`, `padre`, `coniuge`, `figlio`, `fratello`,
`sorella`, `nonno`, `nonna`, `coinquilino`. Gli ultimi cinque hanno ruolo `altro`.
Dopo la conferma dell’elenco i ruoli si riallineano ai membri e le relazioni proposte
si svuotano, perché il contratto dei membri non conferma una parentela più precisa.

Per Monobank, PrivatBank, BBVA, Banca Transilvania, BCR e bKash l’estrazione conserva
`account_bank_<index>` e segnala `answers.foreign_institution_review:true`:
`practice.foreign_institution_review` nel dossier **operatore**, senza dedurre il paese
solo dal marchio. `foreign_assets:true` richiede un’indicazione esplicita di beni/conti
all’estero. bKash non è precompilato come deposito: il tipo va confermato.
«Mutuo sulla casa» propone `housing:"owned"`, `properties_count` almeno 1 e
`mortgage_review:true`; `practice.mortgage_review` ricorda al CAF la verifica.
`property_mortgage_<index>` resta da confermare perché la domanda riguarda il residuo
al 31/12/2025, non il mutuo attuale.

Upload massimo **4 MiB file**, richiesta multipart 4 MiB + 128 KiB (entro il limite Vercel
4,5 MB). PDF leggibile dal parser o immagine riconosciuta da magic bytes, MIME dichiarato
verificato se presente (mismatch: 415). Nome sanificato, SHA-256 sui byte originali. `checklistItemId` esplicito deve
appartenere al fascicolo; auto-abbinamento solo a una singola voce candidata. In presenza
di più membri/conti serve scelta umana. Riassegnare a null lascia il documento non abbinato.

Quando cambiano i requisiti, documenti conservati e restituiti non abbinati; revisioni
persistono sugli ID rimasti applicabili. Modificare i file di una voce invalida la verifica
precedente. I membri mantengono gli UUID in `answers.members`: rimandare `MemberInput.id`
negli edit; i vecchi input senza ID restano accettati. La rimozione di un membro stacca i suoi
documenti e annulla le revisioni relative. Download sempre attachment, `filename*`
UTF-8 e `nosniff`. Storage key e URL Blob mai esposti.
Timeout/OOM del parser PDF restituiscono 503 con invito a riprovare, file non valido 415.

L'invio restituisce 409 se esistono upload attivi o documenti ancora `processing`.
Una reservation persistita prima di consumare il body impedisce l'invio anche
tra istanze API. Il lease dura 10 minuti; upload tardivi sono rifiutati e i file
recuperati dal cleanup. Doppio invio: un solo evento, la seconda richiesta riceve
409 senza riscrivere contatti/data. PDF con `/Encrypt` e file vuoti: 415.

## Autenticazione e console

Cookie `avanti_session`, HttpOnly, SameSite=Lax, Secure in produzione, path `/api`, durata
scorrevole 8 ore, rinnovata anche sui GET entro il cap assoluto di 12 ore. Solo hash del token salvato. Origin deve coincidere con l’origine della richiesta o con `PUBLIC_APP_URL` per
login/logout e modifiche operatore. Se Next normalizza il nome host dell’URL, si usa
anche l’header Host effettivo con lo stesso protocollo. Se manca Origin, è accettato soltanto
`Sec-Fetch-Site: same-origin`; un Origin presente e diverso resta rifiutato.

| Metodo | Percorso                                 | Input                        | Risposta                                          |
| ------ | ---------------------------------------- | ---------------------------- | ------------------------------------------------- |
| POST   | `/auth/login`                            | `LoginRequest`               | `Operator` + cookie                               |
| POST   | `/auth/logout`                           | —                            | `{ok:true}`, sessione revocata                    |
| GET    | `/auth/me`                               | —                            | `Operator`                                        |
| GET    | `/cases`                                 | `CaseListQuery`              | `CaseListResponse`                                |
| POST   | `/cases`                                 | `CreateCaseRequest`          | 201 `CreateCaseResponse`, link mostrato una volta |
| POST   | `/cases/:id/link`                        | `Id` (path), nessun body     | `RegenerateLinkResponse`, URL mostrato una volta  |
| GET    | `/cases/:id`                             | —                            | `CaseDossier`, senza transizione di stato         |
| GET    | `/cases/:id/dsu-sheet`                   | `Id`                         | `DsuSheet` o `null`, audit `dsu_sheet.viewed`     |
| PATCH  | `/cases/:id`                             | `UpdateCaseRequest`          | `CaseDossier`                                     |
| POST   | `/cases/:id/checklist/:itemId/review`    | `ReviewChecklistItemRequest` | `CaseDossier`                                     |
| POST   | `/cases/:id/requests`                    | `RequestFromCitizenRequest`  | `CaseDossier`                                     |
| GET    | `/cases/:id/export?format=json`          | `ExportFormat` json o pdf    | allegato completo, evento audit di accesso        |
| GET    | `/cases/:id/documents/:docId/file`       | —                            | allegato autorizzato, evento audit di accesso     |
| GET    | `/metrics?from=2027-01-01&to=2027-01-31` | `MetricsQuery`               | `Metrics`                                         |

Ogni accesso è filtrato per organizzazione della sessione. Sedi, assegnatari e documenti
di altri tenant restituiscono 404. Operatore vede sempre italiano nei testi di dominio;
le risposte libere e i messaggi del cittadino conservano l'originale per non alterare prove.
Il dossier non ricostruisce il token cittadino (`citizenLink:null`).

Le scritture PATCH `/cases/:id`, POST revisione checklist e POST richieste di
integrazione richiedono `expectedUpdatedAt` uguale alla versione letta nel dossier.
La precondizione viene verificata sotto lock; mancanza o mismatch restituiscono
409 `conflict` con invito a ricaricare e controllare le modifiche, senza applicare
la scrittura. `updatedAt` cresce almeno di 1 ms anche a clock fermo o arretrato;
le modifiche dei documenti e il completamento dell'analisi invalidano lo snapshot.
Il campo resta opzionale nel tipo condiviso durante l'integrazione frontend, ma
la sua omissione non consente una scrittura. Non recuperare una versione nuova
per fare retry automatici: conserverebbe il rischio di sovrascrittura.

La rigenerazione ruota subito il token e rinnova la scadenza dal clock corrente secondo
`linkDays` del CAF (default 60 giorni). `RegenerateLinkResponse` contiene `{url, expiresAt}`;
solo SHA-256 del nuovo token viene salvato. Audit `case.link_regenerated` senza dati personali.
Pratica chiusa o cancellata nello stesso CAF: 409 `conflict` con messaggio esplicito;
inesistente o di altro CAF: 404. Il vecchio token restituisce 404, perché il suo hash
non identifica più una pratica. Richieste già autenticate, incluse upload in corso,
ricontrollano l’hash e falliscono con 410 `link_expired` se il link è stato sostituito;
l’upload annulla il salvataggio e rimuove il file o lo mette nel retry di cancellazione.

`Finding.operatorMessage` è il testo italiano di revisione, opzionale per compatibilità
con le analisi persistite precedenti. Tutti i findings generati lo valorizzano.
Nel dossier e negli export anche `message` usa questo testo, per renderlo disponibile ai
client esistenti. Nel flusso cittadino `message` resta localizzato e `operatorMessage`
viene omesso. [Inventario completo prima/dopo](verification/link-regeneration.md).

Il dossier e gli export JSON/PDF includono `dsuSheet`: solo ISEE ordinario, valori
con fonte per campo e riferimenti al modello DSU 2026. Gli importi/date documentali
non estratti sono `null`, con documento verificato da consultare; precompilati INPS/AdE
a cura del CAF. Il PDF termina con «Prospetto DSU». La consultazione dedicata
registra un audit senza metadata personali e non modifica stato o `updatedAt`.
Inventario e limiti in [dsu-prospetto.md](research/dsu-prospetto.md).

Lista ordinata per updatedAt e id decrescenti, cursore opaco base64url, limite default 50,
max 100. Counts applica filtri della lista escluso lo stato selezionato. Il cursore non è
una snapshot: modifiche concorrenti possono cambiare le pagine; ricaricare la prima pagina.

Stati: submitted → in_review → ready → closed; in_review → needs_citizen → submitted
quando il cittadino reinvia, oppure needs_citizen → in_review. ready può tornare in_review.
Closed non modificabile nello stato. Ready richiede intervista completa, assenza blocker e
ogni voce obbligatoria verificata o motivatamente esentata. Rifiuto/esenzione richiedono nota.
Integrazione preserva messaggio italiano; traduzione AI se disponibile, altrimenti avviso
localizzato con originale visibile (mai spacciato per traduzione). Header `X-Avanti-Engine`.

## Metriche e limiti

Date reali YYYY-MM-DD, entrambe incluse, giorni civili **Europe/Rome**, massimo 366 giorni. Sede opzionale;
organizzazione sempre derivata dalla sessione. Avvii da createdAt, invii da primo submittedAt,
pronti da eventi review.completed; aggregati per pratica/lingua e giorno. Completezza e
tasso integrazioni riferiti ai fascicoli del cohort inviato nell'intervallo; nessun dato → null.
Baseline deriva esclusivamente dalle impostazioni dichiarate dal CAF (demo esplicitamente fittizia).

Minuti cittadino: creazione → primo invio; revisione: prima apertura → pronto. Sono intervalli
trascorsi, includono pause/attesa, non misurano minuti di attività continua. Non usare questi
intervalli come prova di risparmio di lavoro senza un protocollo di misurazione nel pilota.

Rate limit persistente su HMAC di identità/categoria/finestra. Capability come identità
principale per turni (60/minuto, 400/ora) e upload (30/minuto, 120/ora); tetti IP
rispettivamente 1.500/minuto e 15.000/ora, 400/minuto e 4.000/ora. Nuove pratiche pubbliche:
40/minuto e 60/ora per IP. Login/password: 10/minuto per email, 100/minuto per IP;
password anche per operatore. Export e rigenerazione link: ciascuno 20/minuto per operatore,
200 per IP, in bucket separati; integrazioni:
30/minuto per operatore, 300 per IP. Lead: 5/minuto per IP. Finestre fisse dalla prima
richiesta; la guardia al minuto consente il burst senza attendere una ricarica continua.
429 `rate_limited` con `Retry-After` in secondi e messaggio localizzato per la pratica
(o lingua validata di intake); upload simultanei 4/pratica/istanza, `Retry-After:5`.
IP solo da trasporto/proxy fidato; Vercel usa x-real-ip, altri proxy ultimo hop di
x-forwarded-for. In locale senza IP restano capability/email. Non abilitare TRUST_PROXY
su server direttamente accessibile che accetta header arbitrari.

Provider AI/Blob/Postgres remoto non provati dalla suite locale. I modelli DSU/730 2027
richiedono aggiornamento normativo prepilota; beta non sostituisce la revisione dello sportello.

## Manutenzione

`GET /api/cron/maintenance` richiede `Authorization: Bearer <CRON_SECRET>`. Nessuna
sessione operatore richiesta. Il job elimina sessioni e bucket scaduti e ritenta le
cancellazioni storage; risponde `{ok:true}`, oppure `{ok:true,skipped:true}` entro il
cooldown di un minuto. Un segreto assente o errato dà 401. Compatibile con Vercel Cron;
è pianificato ogni giorno alle 03:00 UTC in `apps/web/vercel.json`, con `CRON_SECRET`
in Production. Le Preview non hanno cron automatico; dettagli in [DEPLOY](DEPLOY.md). Nessun purge globale durante i POST utente.

## Amministrazione dei CAF pilota

Tutte le risorse amministrative sono limitate all’organizzazione della sessione.
Le mutazioni richiedono il controllo Origin della console. Un operatore normale
riceve `forbidden`; un id di un’altra organizzazione riceve `not_found`.

| Metodo | Percorso                        | Input                   | Risposta                          |
| ------ | ------------------------------- | ----------------------- | --------------------------------- |
| POST   | `/auth/password`                | `ChangePasswordRequest` | `Operator`                        |
| GET    | `/settings`                     | —                       | `OrganizationSettings`            |
| PATCH  | `/settings`                     | `UpdateSettingsRequest` | `OrganizationSettings`            |
| GET    | `/operators`                    | —                       | `OperatorSummary[]`               |
| POST   | `/operators`                    | `CreateOperatorRequest` | `TemporaryPasswordResponse` (201) |
| PATCH  | `/operators/:id`                | `UpdateOperatorRequest` | `OperatorSummary`                 |
| POST   | `/operators/:id/reset-password` | —                       | `TemporaryPasswordResponse`       |
| POST   | `/offices`                      | `OfficeInput`           | `Office` (201)                    |
| PATCH  | `/offices/:id`                  | `UpdateOfficeRequest`   | `Office`                          |
| DELETE | `/cases/:id`                    | `DeleteCaseRequest`     | 204                               |

`/auth/password` è disponibile a ogni operatore e condivide il limite login
(10 tentativi/minuto per email e, dove disponibile, IP fidato). Verifica la password
attuale, rifiuta una nuova password uguale e revoca le altre sessioni mantenendo
quella corrente. Login e `/auth/me` includono `mustChangePassword`; quando è vero,
solo `/auth/me`, `/auth/password` e `/auth/logout` sono consentiti. Le altre rotte
restituiscono `forbidden` con «Cambia la password per continuare.».

Creazione e reset restituiscono una password temporanea casuale di 20 caratteri
una sola volta, salvata esclusivamente come hash. Il reset revoca tutte le sessioni.
Gli operatori disattivati non possono accedere e ricevono lo stesso errore delle
credenziali errate. La lista include gli inattivi, è ordinata per nome e riporta
l’ultimo login riuscito. Un admin non può disattivarsi, declassarsi o reimpostare
la propria password attraverso la rotta admin; deve restare un admin attivo.

Il nome dello sportello è unico all’interno dell’organizzazione: su create ed edit
il confronto ignora maiuscole/minuscole e spazi ai bordi. Un duplicato restituisce
HTTP 409, codice `conflict` e messaggio «C'è già uno sportello con questo nome.».
Lo stesso nome è consentito in organizzazioni diverse; rinominare lo sportello
senza cambiarne il nome normalizzato è consentito.

Lo slug pubblico dello sportello è ASCII, generato da città e nome. Se il nome
normalizzato coincide con la città o inizia con la città seguita da un separatore,
la città non viene aggiunta di nuovo: «Milano Centro» a Milano diventa
`milano-centro`. Lo slug resta unico nel sistema, con suffisso numerico in caso di
collisione, e invariato dopo gli edit di nome o città.
`linkDays` vale per nuovi link e rigenerazioni, senza cambiare la scadenza dei link esistenti.
`OrganizationSettings` include
anche `notifyCitizenReady` e `notifyOperatorDigest`, booleani false per default:
email al cittadino al passaggio a “pronta” e riepilogo giornaliero per gli operatori
attivi. `PATCH /settings` conserva le preferenze omesse; input non booleani sono
rifiutati. Nessun nuovo endpoint è necessario per l'invio: outbox e dispatch in
background dopo il commit, cron per digest e recupero dei retry.
I testi email sono in otto lingue; destinatario assente significa nessuna notifica
cittadino. [Configurazione e retry](DEPLOY.md#notifiche-email-e-outbox).

`retentionDays` viene applicato dal cron ai
fascicoli chiusi o scaduti da più del periodo configurato (25 per esecuzione).
La cancellazione manuale richiede il riferimento, senza distinzione maiuscole/minuscole.
Entrambe rimuovono DB e file, con tombstone/retry e audit senza contenuti personali:
vedi [SECURITY.md](SECURITY.md#retention-e-diritti).

## Registro attività (solo admin del CAF)

| Metodo | Endpoint            | Input        | Risultato                                                |
| ------ | ------------------- | ------------ | -------------------------------------------------------- |
| GET    | `/audit`            | `AuditQuery` | `AuditPage`, eventi in ordine decrescente per istante/ID |
| GET    | `/audit/export.csv` | `AuditQuery` | CSV sicuro, massimo 5.000 righe; evento `audit.exported` |

Filtri: `from` incluso e `to` escluso (timestamp ISO con offset esplicito),
`operatorId` per attore o account interessato, `reference` per codice pratica esatto,
`action` per categoria. `limit=50` di default (1–100), `cursor` opaco restituito da
`nextCursor`. Un cursore con tenant/filtri diversi è rifiutato con 400. L’export
ignora `limit` e usa il cursore come posizione iniziale; oltre il limite di righe
restituisce 400, chiedendo filtri più stretti. Entrambe le rotte rispondono 401 senza
sessione valida, 403 per operatori non admin/password temporanea; non accettano un
tenant client. Valori di operatori/pratiche estranei non rivelano la loro esistenza.

Gli eventi hanno `at` con l’offset Europe/Rome al momento dell’azione, attore con
ID tecnico, etichetta italiana, riferimento pratica anche dopo cancellazione e
dettagli limitati a conteggi/flag. Nessun nome o email nel DTO. Catalogo completo,
contratti e verifiche in [verification/audit-log.md](verification/audit-log.md).

## Verifica in due passaggi degli operatori

I nuovi contratti in `@avanti/contracts` servono a distinguere la sessione limitata
nel login e a condividere con l'interfaccia Account richieste, risposte e impostazione
obbligatoria. `LoginResponse` è `Operator | MfaChallenge`; `Operator` aggiunge
`mfaEnabled` e `mustSetupMfa`, `OperatorSummary` aggiunge `mfaEnabled`.
Le API mantengono il cookie `avanti_session`, HttpOnly e Secure in produzione.
Tutte le POST/PATCH richiedono `Origin` autorizzata; nessun token nel JSON.

| Metodo e percorso                              | Corpo                                                  | Risposta 200                                                                                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/login`                         | `{ "email": "operatore@example.it", "password": "…" }` | `Operator`, oppure `{ "mfaRequired": true, "expiresAt": "2027-01-05T10:05:00.000Z" }`                                                                                              |
| `GET /api/auth/me`                             | —                                                      | stesso tipo `LoginResponse`; sessione limitata restituisce solo il challenge                                                                                                       |
| `POST /api/auth/mfa/verify`                    | `{ "code": "123456" }` oppure codice di recupero       | `Operator`; cookie ruotato                                                                                                                                                         |
| `GET /api/auth/mfa/status`                     | —                                                      | `{ "enabled": true, "required": false, "recoveryCodesRemaining": 10, "setupPending": false }`                                                                                      |
| `POST /api/auth/mfa/setup/start`               | `{ "currentPassword": "…" }`                           | `{ "secret": "<32 caratteri base32>", "otpauthUri": "otpauth://totp/Avanti%3Aoperatore%40example.it?secret=…&issuer=Avanti&algorithm=SHA1&digits=6&period=30", "expiresAt": "…" }` |
| `POST /api/auth/mfa/setup/confirm`             | `{ "code": "123456" }`                                 | `{ "recoveryCodes": ["01234567-89abcdef-01234567-89abcdef", "… altri nove …"] }`; cookie ruotato                                                                                   |
| `POST /api/auth/mfa/disable`                   | `{ "currentPassword": "…", "code": "123456" }`         | `{ "ok": true }`; cookie ruotato                                                                                                                                                   |
| `POST /api/auth/mfa/recovery-codes/regenerate` | `{ "currentPassword": "…", "code": "123456" }`         | `{ "recoveryCodes": ["… dieci nuovi codici …"] }`                                                                                                                                  |
| `PATCH /api/settings`                          | `{ "mfaRequired": true }`                              | `OrganizationSettings`, ora con `mfaRequired` (solo admin)                                                                                                                         |
| `POST /api/operators/:id/reset-mfa`            | `{}`                                                   | `OperatorSummary` con `mfaEnabled: false` (solo admin dello stesso CAF)                                                                                                            |

Schemi delle richieste: `MfaVerifyRequest`, `MfaSetupStartRequest`,
`MfaSetupConfirmRequest`, `MfaSensitiveRequest`, `MfaResetRequest`.
Schemi delle risposte: `MfaChallenge`, `MfaStatus`, `MfaSetupResponse`,
`MfaRecoveryCodesResponse`. I codici di recupero contengono quattro gruppi di otto
cifre esadecimali, senza distinzione maiuscole/minuscole. I TOTP hanno sei cifre,
inclusi eventuali zeri iniziali: conservarli come stringhe.

Dopo la sola password, chi ha MFA attiva dispone per cinque minuti esclusivamente
di `/auth/me`, `/auth/mfa/verify`, `/auth/logout` e di un nuovo login. Anche le API
pubbliche sono bloccate se ricevono quel cookie. `/auth/me` non rinnova la scadenza.
Solo il successo del secondo fattore aggiorna `lastLoginAt` e registra l'accesso
riuscito. Verifica fallita: `401 unauthorized`, «Verifica non riuscita. Controlla le
credenziali e riprova.»; superamento del limite: `429 rate_limited` con `Retry-After`.
Dieci richieste POST MFA/minuto per account (condivise fra operazioni e sessioni),
cento/minuto per IP fidato, bucket separati dal login password.

Quando MFA è obbligatoria e non attiva, il login restituisce `Operator` con
`mustSetupMfa: true` e crea una sessione `mfa_setup` di cinque minuti. Sono ammessi
solo me, logout, login, cambio password, stato MFA, avvio e conferma configurazione.
Se `mustChangePassword` è true, il cambio password precede la configurazione MFA;
la rotazione conserva il limite di cinque minuti e lo stato limitato. Anche le
sessioni precedenti senza MFA sono bloccate appena l'organizzazione la richiede.
Un `403 forbidden` indica il passo necessario; non apre la console. Una sessione
già emessa come `mfa_setup` resta limitata fino alla conferma o a un nuovo login,
anche se nel frattempo viene tolto l’obbligo nell’organizzazione.

La conferma consuma già il TOTP: attendere un nuovo codice per un login successivo.
Avvio e conferma devono usare la stessa sessione; un secondo avvio sostituisce il
segreto ancora non confermato. Configurazione scaduta: avviare di nuovo, oppure
rifare il login se è scaduta anche la sessione. Dopo conferma non esiste un endpoint
per rileggere segreto o codici di recupero. Le risposte di conferma e rigenerazione
vanno mostrate una volta, senza salvataggio nei log, URL, analytics o storage browser.
La perdita della risposta richiede rigenerazione autenticata o reset admin.

Attivazione, disattivazione e reset revocano tutte le sessioni precedenti, incluse
quelle in attesa. Disattivazione: `409 conflict` se MFA è obbligatoria. Reset:
`409 conflict` sul proprio account, `404 not_found` per operatore inesistente o di
altro CAF. Il reset elimina entrambi i fattori alternativi (TOTP e recupero); con
obbligo attivo il prossimo login richiede una nuova configurazione.
`auth.mfa_failed` produce al massimo un evento per account/finestra di 60 secondi.
Il registro include inoltre `auth.mfa_enabled`, `auth.mfa_disabled`,
`auth.mfa_recovery_used`, `auth.mfa_recovery_regenerated`, `operator.mfa_reset`.

Anche `pnpm admin:export` richiede un codice se l'admin ha MFA attiva; il prompt è
nascosto e non accetta credenziali negli argomenti. `OrganizationExportRequest.login`
aggiunge `code` opzionale; l'obbligo MFA senza configurazione nega l'export.
