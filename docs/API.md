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

## Rapporto del pilota

`GET /api/reports/pilot?from=2027-01-01&to=2027-03-31&office=<id>&format=json`
richiede una sessione **admin attiva del CAF**. `from` e `to` sono date valide
`YYYY-MM-DD`, incluse, in **Europe/Rome**; massimo un anno di calendario
(1 gennaio–31 dicembre ammesso, 1 gennaio–1 gennaio successivo escluso).
`office` è facoltativo e indica l'ID, non lo slug. Uno sportello inesistente o di
un altro CAF restituisce 404; operatore ordinario 403, sessione assente/scaduta 401,
periodo/formato/parametri non validi 400. Le chiavi query sconosciute sono rifiutate.

`format=json` (default), `csv` o `pdf` esportano lo stesso rapporto, con
`Content-Disposition: attachment` e `Cache-Control: private, no-store`. CSV UTF-8
con BOM, righe CRLF e neutralizzazione delle formule condivisa con il registro
attività: anche nomi di sportello preceduti da spazi/controlli e `=`, `+`, `-`, `@`
sono resi testo. Il CSV è in forma lunga: sezione, sportello, percorso del campo,
valore; conserva anche metodo, campioni e motivi degli esiti. PDF A4 multipagina,
font Unicode locali, metodo incluso. Ogni esportazione riuscita, incluso JSON e
le richieste ripetute, registra `pilot_report.exported` senza ID pratica o dati
personali; dettagli `reportJson`, `reportCsv`, `reportPdf`. Letture ed evento sono
nella stessa transazione con snapshot coerente e controllo admin. Si applica il
limite export esistente: 20/minuto per operatore, 200/minuto per IP fidato.

### Contratto e denominatori

Nuovi schemi/tipi condivisi `PilotReportQuery`, `PilotReport`, `PilotReportGroup`,
`PilotThreshold`, `PilotCount` in `@avanti/contracts`. Sono necessari perché il
rapporto condivisibile applica soppressione e soglie che il DTO `Metrics` non
esprime; l'endpoint `/metrics` conserva il suo contratto. Nessuna migrazione o
nuova baseline inventata. Il rapporto versione 1 contiene:

| Campo                                  | Significato                                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `generatedAt`, `period`                | Data di generazione, date locali, fuso, inizio UTC incluso, fine UTC esclusa, osservazione fino al minore fra fine e clock            |
| `baseline`                             | Minuti manuali nelle impostazioni attuali del CAF, etichetta della fonte; numerosità e completezza verificata non registrate (`null`) |
| `method`                               | Definizioni e limiti in italiano, identici nel PDF                                                                                    |
| `total`, `offices[]`                   | Aggregati del CAF/sportelli selezionati, nessun dettaglio cittadino                                                                   |
| `starts`, `deliveries`, `deliveryRate` | Avvii nel periodo, loro primo invio entro fine periodo, quota e campione                                                              |
| `completeness`                         | Quota senza blocchi al primo invio sui valori conosciuti, conteggio completi, campione e valori mancanti                              |
| `integrations`                         | Richieste successive al primo invio entro il periodo e pratiche interessate, senza testo dei messaggi                                 |
| `times[]`                              | Media, campione, unità minuti, ID e descrizione dell'intervallo realmente misurato                                                    |
| `byLanguage`, `byPractice`             | Conteggi avvii secondo lingua/tipo attualmente salvati; tipo `null` = non classificato                                                |
| `thresholds[]`                         | ID, obiettivo/unità, minimo campione, campione osservato/baseline, valore, esito e motivo                                             |

**Coorte:** tutte le pratiche create nel periodo, compresi abbandoni, chiusure e
pratiche non classificate. Consegne e tempi riguardano quella stessa coorte;
un avvio precedente con invio nel periodo è escluso. `submittedAt` è il **primo**
invio, quindi i reinvii non gonfiano la conversione. La fine del periodo è la
mezzanotte locale successiva a `to`; i giorni di cambio ora possono durare 23 o
25 ore. Periodi futuri/in corso mostrano quanto osservato, con conversione
`dati_insufficienti`. Retention e cancellazioni possono ridurre i dati conservati;
il rapporto non è un archivio immutabile degli avvii cancellati. Include tutti i
tipi, quindi non dimostra da solo il risultato della coorte ISEE ordinario.

**Completezza:** `firstSubmissionComplete` fotografa assenza di segnalazioni
bloccanti automatiche; i valori `null` sono dichiarati e non trattati come
incompleti. Non attesta completezza verificata al primo appuntamento.
**Tempi:** `creation_to_submission` misura creazione–primo invio;
`review_to_ready` usa `durationMinutes` dell'ultimo evento `review.completed`
nel periodo per pratica consegnata. Eventi senza durata sono esclusi: il campo
corrente `reviewStartedAt` può riferirsi a una revisione successiva. Entrambi gli
intervalli comprendono pause/attese e non sono lavoro attivo netto.

**Soglie:** ≥5 minuti netti, +15 punti percentuali di completezza verificata,
≥70% consegne/avvii. Minimo operativo **50 casi per gruppo e 50 nel confronto**,
coerente con l'obiettivo di circa 50 casi per percorso del playbook, senza
significatività statistica garantita. Per conversione: almeno 50 avvii, periodo
concluso, celle pubblicabili, confronto esatto senza arrotondamento.
`outcome` è `raggiunta`, `non_raggiunta` o `dati_insufficienti`.
Le prime due soglie restano insufficienti: non esistono timer attivi netti,
numerosità della baseline, baseline di completezza o misura verificata al primo
appuntamento. Anche una differenza esattamente pari a cinque fra baseline e
intervallo di calendario non dimostra il risparmio. La baseline minuti resta
visibile, con confronto dichiarato non valutabile.

**Riservatezza:** `PilotCount = number | "<5" | null`. Zero resta zero;
conteggi 1–4 diventano `"<5"`; `null` indica dato non misurato o soppressione
complementare. In una distribuzione con celle piccole, anche gli altri conteggi
positivi sono oscurati. Quote e tempi sono `null` con campioni sotto 5; quote
con numeratore/complemento piccolo sono oscurate. Campioni ripetuti e totali
ricostruibili sono oscurati insieme, compresi tempi ponderabili fra sportelli.
Per questo un totale può essere oscurato anche con molti casi. Il testo del
metodo spiega questa scelta; non pubblicare rapporti sovrapposti per tentare di
ricostruire celle. Non è una garanzia di anonimato contro query ripetute.

Esempio **sintetico, estratto** dal rapporto di un unico sportello, 50 avvii,
35 consegne, tutte senza blocchi; non è un risultato del pilota:

```json
{
  "version": 1,
  "baseline": {
    "manualMinutesPerCase": 30,
    "sample": null,
    "completeAtFirstAppointment": null,
    "label": "Baseline manuale dichiarata dal CAF nelle impostazioni attuali; campione e periodo non registrati"
  },
  "total": {
    "starts": 50,
    "deliveries": 35,
    "deliveryRate": {
      "label": "Primi invii della coorte / avvii",
      "value": 0.7,
      "sample": 50
    },
    "thresholds": [
      {
        "id": "delivery_rate",
        "target": 0.7,
        "unit": "ratio",
        "minimumSample": 50,
        "sample": 50,
        "baselineSample": null,
        "observed": 0.7,
        "outcome": "raggiunta",
        "reason": "Consegne della stessa coorte / avvii; confronto esatto con 70%. Risultato operativo, non prova causale."
      }
    ]
  }
}
```

Il JSON completo include sempre le tre soglie, i gruppi per sportello, il periodo,
i tempi con etichette/campioni, le distribuzioni e il metodo. L'estratto sopra non
sostituisce lo schema completo.

## Risposte rapide e promemoria al cittadino

I nuovi contratti in `@avanti/contracts` consentono alla console di gestire i testi del
CAF e le preferenze del cron senza duplicare validazione e limiti nel frontend.
`QuickReplyInput` contiene `title` (1–80 caratteri, una riga) e `text` (1–1.000 caratteri),
entrambi ripuliti dagli spazi ai bordi e validati con `SafeText`. I testi sono italiani;
`QuickReply` aggiunge `id` e `position` (0–49). `QuickReplyList` è un array ordinato,
lungo al massimo 50. Nessun `organizationId` viene accettato o restituito: il tenant
proviene dalla sessione.

| Endpoint                         | Permesso        | Corpo / risposta                                                               |
| -------------------------------- | --------------- | ------------------------------------------------------------------------------ |
| `GET /api/quick-replies`         | Operatore/admin | `QuickReplyList`                                                               |
| `POST /api/quick-replies`        | Admin           | `QuickReplyInput` → `QuickReply`, 201                                          |
| `PATCH /api/quick-replies/:id`   | Admin           | `UpdateQuickReplyRequest`: almeno uno tra `title`, `text` → `QuickReply`       |
| `DELETE /api/quick-replies/:id`  | Admin           | Nessun corpo → 204; compatta le posizioni                                      |
| `PUT /api/quick-replies/reorder` | Admin           | `ReorderQuickRepliesRequest`: `{ "ids": ["id-b", "id-a"] }` → `QuickReplyList` |

Il riordino richiede tutti e soli gli ID correnti del CAF, una volta ciascuno. Elenco
cambiato o ID estraneo: 409 `conflict`; duplicati/formato non valido: 400 `bad_request`.
Edit/delete di un ID estraneo: 404. Scritture di un operatore: 403. Il limite di 50
restituisce 409 anche con creazioni concorrenti. Le mutazioni sono serializzate per CAF
e registrano `quick_reply.created/updated/deleted/reordered`, senza titolo o testo
nel registro. Le risposte rapide sono incluse nell'export amministrativo del CAF.

Esempio creazione:

```http
POST /api/quick-replies
Content-Type: application/json

{"title":"Foto illeggibile","text":"Carica una nuova foto a fuoco e senza riflessi."}
```

Per usare una risposta, copia `text` nel `message` dell'endpoint esistente: il testo
resta modificabile e segue le stesse regole di traduzione/fallback delle integrazioni.
La semplice scelta non invia nulla.

```http
POST /api/cases/case-id/requests
Content-Type: application/json

{"expectedUpdatedAt":"2027-01-15T10:00:00.000Z","checklistItemIds":[],"message":"Carica una nuova foto a fuoco e senza riflessi."}
```

`OrganizationSettings` e `UpdateSettingsRequest` espongono `notifyCitizenReminders`
(booleano, default false) e `citizenReminderDays` (`CitizenReminderDays`: uno o due
interi tra 1 e 30, default `[3,4]`). Il primo intervallo decorre dalla richiesta;
il secondo dall'effettivo invio del primo promemoria. Per un solo promemoria usa `[3]`.
I PATCH conservano le preferenze omesse; lettura e modifica restano riservate agli admin.

```http
PATCH /api/settings
Content-Type: application/json

{"notifyCitizenReminders":true,"citizenReminderDays":[3,4]}
```

`GET /api/cron/maintenance`, con il consueto bearer `CRON_SECRET`, aggiunge
`queuedReminders` alla risposta. A ogni esecuzione accoda fino a 100 promemoria dovuti,
con invio tramite la stessa outbox cifrata e lo stesso dispatcher delle notifiche.
Il cron giornaliero può quindi inviarli al primo passaggio successivo alla scadenza;
non garantisce l'ora esatta. I retry seguono il runbook notifiche esistente.

Solo una nuova richiesta tramite `/cases/:id/requests` apre un ciclo; le pratiche già
in attesa al momento della migrazione e il semplice PATCH di stato non ricevono
promemoria retroattivi. L'attivazione considera anche richieste tracciate mentre la
preferenza era spenta. Non vengono accodate email senza indirizzo o con link scaduto.
Ogni risposta/modifica accettata del cittadino (testo, risposta intervista, upload,
abbinamento/eliminazione documento, lingua, invio fascicolo) chiude il ciclo anche
se lo stato resta `needs_citizen`. Letture e download non lo chiudono.
Un cambio di stato lo chiude; una nuova richiesta apre un nuovo ciclo indipendente.
Modifiche interne, assegnazioni e rigenerazione del link non riavviano il conteggio.

Prima dell'invio, anche dopo un retry, si ricontrollano ciclo, stato, lingua,
destinatario, scadenza e preferenze. Il lock del fascicolo resta acquisito durante
l'invio: una risposta o un cambio di stato già confermati impediscono l'invio.
Disattivazione e rimozione del secondo intervallo annullano le email ancora in coda;
un promemoria annullato o fallito non genera un nuovo tentativo logico.
Il secondo richiede il completamento del primo. Al massimo due promemoria accodati
per richiesta, anche dopo la pulizia delle ricevute outbox.

L'email è generica nelle otto lingue del cittadino: nessun link, nome, riferimento,
elenco documenti o contenuto della richiesta. Nel dossier `timeline` riporta
`citizen.reminder_sent`, etichetta «Promemoria inviato» e `at` per la data; lo stato
`sent` significa accettazione del provider, non consegna certificata. Il fallback locale
produce `citizen.reminder_simulated` («Invio promemoria simulato»). Nessun invio viene
annotato prima della conferma del dispatcher; il promemoria non modifica `updatedAt`
e non sposta la pratica in coda.

## Indicazioni dello sportello e ricevuta del primo invio

`OfficeInput`, `UpdateOfficeRequest` e `Office` aggiungono `bookingUrl` e
`citizenNote`. La modifica del contratto è necessaria per condividere con la UI le
indicazioni dello sportello e la preferenza della ricevuta. Il backend restituisce
sempre i nuovi campi, anche quando valgono `null`; nel DTO `Office` sono opzionali
per compatibilità con i consumatori precedenti.

Nome e città restano obbligatori alla creazione. L'indirizzo è ora omissibile
(default `""`, anche per cancellarlo); `phone`, `openingHours`, `bookingUrl` e
`citizenNote` sono omissibili o `null`. Un PATCH conserva ogni campo omesso,
compreso l'indirizzo. I limiti sono: indirizzo 200 caratteri su una riga, telefono
30 su una riga, orari 200 e nota 300 anche su più righe. Si applicano `SafeName` e
`SafeText` esistenti. Questi contenuti sono pubblici, inseriti dal CAF e non
tradotti automaticamente.

`bookingUrl` accetta al massimo 2048 caratteri dopo trim: URL assoluto con
prefisso `https://`, host valido, senza credenziali, spazi interni, controlli o
backslash. Nessun redirect o fetch server; HTTPS non certifica l'affidabilità
della destinazione. Il frontend deve identificare la destinazione esterna e
trattare tutti gli altri campi come testo, secondo [SECURITY.md](SECURITY.md).

```http
PATCH /api/offices/office-id
Content-Type: application/json

{
  "address": "Via Roma 10",
  "openingHours": "Lun–Ven 9–13; pomeriggio su appuntamento",
  "phone": "+39 06 123456",
  "bookingUrl": "https://prenota.example.test/sede",
  "citizenNote": "Porta gli originali dei documenti d'identità"
}
```

Solo l'admin del CAF proprietario può modificare questi campi; un altro CAF
riceve 404, un operatore senza ruolo admin 403. Lo slug e i QR restano invariati.
`GET /offices/:slug` e `CitizenCase.office` (anche nella risposta di
`POST /c/:token/submit` e nelle letture successive) restituiscono le stesse
indicazioni aggiornate. Nessuna prenotazione è creata da Avanti.

```http
PATCH /api/settings
Content-Type: application/json

{ "notifyCitizenSubmission": true }
```

`OrganizationSettings.notifyCitizenSubmission` è un booleano, **false per
default**, anche senza una riga `settings`. Un PATCH che lo omette lo conserva.
Se abilitato al primo invio e il contatto contiene un'email, la transazione di
submit accoda `citizen_submission`; dopo il commit si programma il dispatcher
esistente. Il corpo include soltanto riferimento, nome dello sportello e cosa
succede adesso in una delle otto lingue del cittadino. Non contiene URL, token,
tipo di pratica, nomi o note del cittadino, dati dei documenti, recapiti o note
libere dello sportello. La punteggiatura di indirizzi web/email nel nome dello
sportello è resa spazio per impedire gli autolink dei client email.

Esempio del corpo italiano:

```text
Riferimento della pratica: AV-2027-000123

Sportello: Roma Centro

Lo sportello controllerà il fascicolo. L'invio non prenota un appuntamento e non conclude la pratica. Apri la pagina della pratica che hai salvato per trovare le indicazioni dello sportello su prenotazione, orari e cosa portare. Se non trovi queste indicazioni, chiedi allo sportello come proseguire.
```

Un reinvio dopo un'integrazione o una riapertura non genera altre ricevute,
anche se la precedente è già stata eliminata dalla retention dell'outbox. Non
ci sono invii retroattivi abilitando l'opzione o aggiungendo un'email dopo il
primo invio. Richieste concorrenti producono un solo submit riuscito; la seconda
riceve 409 con il consueto `ApiError`. Senza email o con opzione spenta il submit
riesce senza accodare nulla. Un errore nell'accodamento annulla anche submit e
audit. Prima della consegna si ricontrollano preferenza del CAF, lingua,
contatto e scadenza: se cambiano, la ricevuta pendente è annullata. Retry,
simulazione locale e idempotenza del provider seguono l'outbox esistente.

## Riuso di nucleo e documenti tra pratiche

I contratti `ReuseCaseRequest`, `FamilySearchRequest`, `CheckDocumentReuseRequest`
e `EraseFamilyRequest` definiscono i nuovi endpoint operatore sotto `/api/cases`.
Esempi completi, semantica di visibilità, cancellazione dell'intero gruppo e
migrazione unica sono in [Riuso di nucleo e documenti](decisions/document-reuse.md).
La ricerca usa POST per evitare dati personali negli URL; il riuso richiede la
conferma dell'operatore e non avviene tra link indipendenti.

## Intervista come conversazione guidata

`GET /c/:token/conversation` e il campo `CitizenCase.conversation` restituiscono
`ConversationState`: `turns`, `proposals`, `ask` (1–2 domande localizzate), `progress`,
`complete`, `engine`. Senza AI viene chiesta una domanda alla volta dal catalogo.
`complete` dipende dalle risposte confermate e dalle condizioni del core, mai dal modello.

`POST /c/:token/conversation` accetta `{ "text": "Siamo in quattro e viviamo in affitto" }`
(1–1000 caratteri, `SafeText`). Una richiesta esegue un solo `interview.converse` di livello
`fast`; retry e fallback restano responsabilità del runtime. Il modello riceve domande aperte
in ordine, `ask_next` scelto dal server, risposte confermate e gli ultimi 8 turni come dati
non fidati. Il server scarta proposte fuori schema o per domande nascoste/già risposte,
controlla le citazioni sui messaggi del cittadino e abbassa a massimo 0,3 la confidenza senza
riscontro. Tutte le proposte richiedono conferma, qualunque sia la confidenza.

Esempio di proposta (gli ID reali sono opachi):

```json
{
  "id": "proposal-1",
  "questionId": "household_count",
  "questionText": "Quante persone fanno parte del tuo nucleo familiare?",
  "value": 4,
  "display": "4",
  "evidence": "Siamo in quattro",
  "confidence": 0.95
}
```

`POST /c/:token/conversation/confirm` accetta conferme parziali e correzioni:

```json
{
  "accept": [{ "proposalId": "proposal-1", "value": 3 }],
  "reject": ["proposal-2"]
}
```

Il valore omesso accetta quello proposto. L'intera richiesta è atomica: un valore non valido
causa 400 senza modificare risposte, proposte o messaggi; ID duplicati danno 400, ID scaduti
o appartenenti a un'altra pratica danno 409. Il rifiuto rimuove la proposta e lascia aperta
la domanda. La conferma usa la stessa validazione, gli stessi eventi `answer.updated` e lo
stesso ricalcolo della checklist di `turn:answer`. Le risposte con pulsanti/editor passano
ancora da `/turn` e sono registrate come turni del cittadino leggibili.

Il primo racconto usa ancora `turn:text` e `intake.understand`: classifica la pratica, ma
le informazioni estratte diventano proposte, senza entrare automaticamente nelle risposte.
Il racconto intero è usato come citazione iniziale, con confidenza limitata a 0,7.
Per correggere una risposta già confermata, inviare prima `turn:edit` con `questionId`;
la domanda riaperta può ricevere una nuova proposta. I componenti confermati vengono
conservati durante la correzione del numero di persone; se il numero non coincide con
l'elenco, l'editor dei componenti resta aperto. Nomi nuovi senza riscontro sono scartati;
gli ID nuovi dei componenti sono assegnati dal server alla conferma.

Messaggi liberi (`conversation` e `turn:text`) e conferme condividono il limite di 60/ora
per capability; i pulsanti rapidi mantengono il limite esistente di 400/ora e 60/minuto.
429 include `Retry-After` e messaggio localizzato. Il limite di lunghezza è localizzato.
Le mutazioni richiedono pratica modificabile e link corrente anche dopo l'attesa AI:
un turno divenuto obsoleto durante un'altra modifica restituisce 409 senza salvare messaggi.

I turni sono righe di `messages` con `kind` e `questionId`; l'ordine resta stabile anche
con clock uguali. Proposte e motore sono nella pratica (migrazione `0016_interview_conversation`).
Il fascicolo operatore espone anche `conversation` con i metadati dei turni e mantiene `messages`; l'export JSON del CAF include messaggi,
metadati e proposte pendenti. La cancellazione della pratica e la retention eliminano anche
questi dati. I log e gli eventi contengono solo conteggi e metadati, mai il testo del dialogo.

### Assistente del cittadino, voce e controllo dei documenti

Gli endpoint seguenti usano la capability della pratica e gli stessi controlli Origin
(CSRF) delle altre scritture cittadino. Non richiedono una sessione operatore.

| Metodo e percorso                       | Input                                                 | Risultato                                               |
| --------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------- |
| `POST /api/c/:token/assistant`          | `AssistantAsk`                                        | `AssistantReply`                                        |
| `GET /api/c/:token/assistant`           | —                                                     | `{ messages: AssistantTurn[], remainingToday: number }` |
| `POST /api/c/:token/assistant/ask-desk` | `{ message: string }`, 1–600 caratteri                | `201 { ok: true }`                                      |
| `POST /api/c/:token/transcribe`         | multipart: un `file` audio, `language` nelle 8 lingue | `{ text, language, engine }`                            |
| `POST /api/c/:token/documents/:id/keep` | nessun campo                                          | `CitizenCase` aggiornato                                |

Esempio richiesta assistente:

```json
{ "message": "Perché me lo chiedi?", "focus": { "questionId": "household_count" } }
```

Esempio risposta (id, testo e data dipendono dalla pratica):

```json
{
  "id": "turn-id",
  "reply": "Lo sportello verifica chi fa parte del nucleo familiare.",
  "intent": "answer",
  "action": "explain_question",
  "sources": [{ "id": "question:household_count", "title": "Quante persone?" }],
  "engine": "heuristic",
  "createdAt": "2027-01-05T10:00:00.001Z"
}
```

`intent`: `answer | needs_operator | off_topic | manipulation | emergency`.
`action`: `none | explain_question | open_documents | ask_desk`.
`AssistantTurn`: `{ id, role: citizen|assistant, text, intent?, action?, sources?, createdAt }`.
La storia inviata dal client viene ignorata. Soltanto gli ultimi 12 turni server entrano
nel prompt, come contenuto non fidato. Le fonti sono id del contesto server con il loro titolo.
Il focus domanda è accettato soltanto per la domanda attuale; un id sconosciuto non aggiunge dati.
I suggerimenti dei documenti provengono dalla checklist della pratica, nella lingua corrente.

Limiti persistenti per pratica: assistente 30/ora e 80/24 ore, domanda allo sportello 5/24 ore,
trascrizione 20/ora. Sono finestre dalla prima richiesta, come gli altri limiti cittadino.
La rigenerazione del link non azzera questi contatori. Il tetto IP per ciascuna operazione
è quello dei turni cittadino (1.500/minuto, 15.000/ora). Risposta `429` con `Retry-After`.
`remainingToday` indica il residuo della finestra di 24 ore, non il residuo orario.

Audio: webm, ogg, mp4/m4a, wav; massimo 2 MiB e 60 secondi verificati dai byte e dai
pacchetti audio, senza fidarsi del MIME o della durata del client. Solo una traccia audio,
nessun video. File vuoti, illeggibili o di durata non determinabile: `400 bad_request`.
Audio solo in memoria per la richiesta, mai nello storage o nella storia. La trascrizione
non invia un messaggio: il client la mostra modificabile e il cittadino decide se inviarla.
Senza provider, budget o trascrizione utilizzabile: `503 transcription_unavailable`,
con messaggio localizzato; il client può nascondere il microfono. Il modello audio è
`AI_MODEL_AUDIO` (default `google/gemini-3.5-flash-lite`); riserva `qwen/qwen3.8-omni-flash`.
Una trascrizione con lingua chiaramente diversa passa alla riserva, senza tradurre.

Ogni documento aggiunge:

```json
{
  "citizenCheck": {
    "status": "warning",
    "messages": ["Il documento richiede il controllo dello sportello."]
  },
  "citizenKeptAt": null
}
```

Gli stati sono `pending | ok | warning | problem`; i testi provengono dai codici fissi del
core, mai dalle osservazioni libere del modello. `ok` indica assenza di rilievi automatici,
non validità ufficiale. `keep` registra `citizenKeptAt` e un evento: non accetta il documento,
non rimuove rilievi e non cambia la decisione dell’operatore. Consentito solo durante
`intake` e `needs_citizen`, dopo la fine dell’analisi. Id di un’altra pratica: `404`.

Il fascicolo operatore aggiunge `assistantTurns` (sezione “Domande all’assistente”).
Le domande allo sportello sono messaggi cittadino distinti, con evento `citizen.question`;
`hasCitizenQuestion` nella coda segnala che il fascicolo contiene almeno una domanda.
L’indicatore è storico: non esiste ancora un comando di presa in carico della domanda.

## Copilota operatore

Tutti gli endpoint seguenti richiedono la sessione di un operatore attivo dello stesso
CAF della pratica. 401 senza accesso; 404 anche per ID di un altro CAF; input non valido
400; versione cambiata o analisi ancora in corso 409. POST protetti da Origin come le
altre mutazioni. `POST /ai/ask`: 60 tentativi/ora per operatore, 429 con `Retry-After`.
Rigenerazione e bozze condividono il limite traduzioni di 30/minuto; accettazioni e rifiuti
locali non consumano la quota delle domande normative. Le GET della stessa versione riusano la cache, anche dopo riavvio.

| Metodo / percorso relativo a `/api`              | Input                                                                                | Contratto condiviso                        |
| ------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------ |
| GET, POST `/cases/:id/ai/brief`                  | —; POST rigenera                                                                     | `DossierBrief`                             |
| GET `/cases/:id/ai/consistency`                  | —                                                                                    | `DossierConsistency` / `ConsistencyReport` |
| GET `/cases/:id/ai/dsu-prefill`                  | —                                                                                    | `DsuPrefill`                               |
| POST `/cases/:id/ai/dsu-prefill/:fieldId/accept` | —; fieldId URL encoded                                                               | `PrefillDecisionResponse`                  |
| POST `/cases/:id/ai/dsu-prefill/:fieldId/reject` | —                                                                                    | `PrefillDecisionResponse`                  |
| POST `/cases/:id/ai/request-draft`               | `{"checklistItemIds":["identity:m_demo"]}`                                           | `RequestDraftResponse`                     |
| POST `/ai/ask`                                   | `{"question":"Per ISEE 2027 quale anno dei redditi?","practiceId":"isee_ordinario"}` | `OperatorAskResponse` / `KnowledgeAnswer`  |
| POST `/cases/:id/ai/reply-draft`                 | `{"messageId":"messaggio-del-cittadino"}`                                            | `ReplyDraftResponse`                       |

Esempio di riepilogo (IDs illustrativi):

```json
{
  "situation": "ISEE ordinario. Nucleo dichiarato: 1 componenti.",
  "attention": [
    {
      "text": "Verificare l'anno del documento.",
      "evidence": [{ "kind": "document", "id": "doc_demo", "label": "Documento caricato" }]
    }
  ],
  "missing": ["identity:m_demo"],
  "nextStep": "ask_citizen",
  "nextStepReason": "Occorre acquisire i documenti mancanti o rifiutati.",
  "engine": "heuristic",
  "model": null,
  "generatedAt": "2027-01-15T12:00:00.000Z",
  "caseVersion": "2027-01-15T11:00:00.000Z"
}
```

Coerenza: `{"issues":[{"id":"document.wrong_year:doc_demo","severity":"blocker",
"text":"Verificare l'anno dei dati.","evidence":[{"kind":"document","id":"doc_demo",
"label":"Documento caricato"}],"checklistItemId":"account_balance:account_0_m_demo"}],
"engine":"heuristic","generatedAt":"2027-01-15T12:00:00.000Z",
"caseVersion":"2027-01-15T11:00:00.000Z"}`. I controlli deterministici restano presenti
anche quando il modello non segnala nulla.

Prefill: `fields` contiene per esempio `{"sectionId":"FC2:m_demo:account_0",
"fieldId":"FC2:m_demo:account_0:saldo_al_31_dicembre~impronta",
"label":"Saldo al 31 dicembre","value":1234.56,"documentId":"doc_demo","page":1,
"confidence":0.99,"note":"Saldo al 31 dicembre: 1.234,56 euro"}`, con i consueti
`engine/generatedAt/caseVersion`. Il fieldId è opaco: usare quello ricevuto, senza
ricostruirlo. L'accettazione risponde `{"fieldId":"…","decision":"accepted"}`; il
rifiuto usa `rejected`. Solo dopo accept il prospetto contiene `value:"1234,56"` e
fonte `{"kind":"document","documentId":"doc_demo","checklistItemId":"…",
"operatorConfirmed":true,"page":1}`. La nota dice «Documento, confermato da operatore».
Il confronto del documento e il controllo umano non sono sostituiti da questa conferma.

Bozza richiesta: `{"message":"Buongiorno, per completare la pratica…","engine":"heuristic"}`.
Bozza risposta: stessa forma più `citations: []` o citazioni dei chunk usati. Nessuna
bozza è salvata nella chat o inviata. L'operatore la edita e usa l'invio già esistente.

Domande normative: `{"answer":"[kb:…] estratto della ricerca…","coverage":"partial",
"citations":[{"id":"kb:…","title":"ISEE ordinario 2027 — Versione e anni",
"source":"Ministero del Lavoro, documentazione ISEE","url":"https://lavoro.gov.it/strumenti-e-servizi/isee/pagine/default"}],
"engine":"heuristic"}`. Senza AI si restituiscono estratti, senza sintesi. Fuori base:
`coverage:"none"`, nessuna citazione. Gli ID citati dall'AI devono appartenere ai chunk
recuperati; il server risolve titolo, fonte e URL, non li accetta dal modello.

`CaseListItem` aggiunge `aiAttention: number|null` e
`aiPriority: "quick_review"|"attention"|"citizen_question"|null`.
Filtro: `GET /cases?ai=attention` (anche gli altri due valori). La lettura del dossier
marca i messaggi cittadino come letti. Il conteggio dell'ultima analisi può essere di
una versione precedente; `quick_review` richiede invece analisi della versione corrente.

`GET/PATCH /settings`: `aiCopilot` e `aiCitizenAssistant`, default true;
`aiMonthlyBudgetEur`, default null (budget da configurazione). Un PATCH omesso non
resetta questi valori. La vista cittadino espone `aiCitizenAssistant`, senza budget.
Impostazione off o budget esaurito: `engine:"heuristic"`, nessuna nuova chiamata.
