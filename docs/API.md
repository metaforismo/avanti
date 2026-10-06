# API Avanti

Base path `/api`, JSON UTF-8, backend Hono in Next runtime Node. Schemi request/response:
`@avanti/contracts`. Tutte le risposte sono `Cache-Control: no-store`. Errori nel formato
`ApiError`: messaggio sicuro, codice stabile e request ID; niente stack o SQL. Gli errori
di dominio dell'intervista sono nella lingua cittadino, gli errori infrastrutturali in italiano.

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

| Metodo | Percorso dopo `/c/:token` | Input                                    | Risposta                             |
| ------ | ------------------------- | ---------------------------------------- | ------------------------------------ |
| GET    | ``                        | —                                        | `CitizenCase`                        |
| POST   | `/turn`                   | `IntakeTurn`                             | `CitizenCase` con `engine` opzionale |
| PUT    | `/language`               | `UpdateLanguageRequest`                  | `CitizenCase`                        |
| POST   | `/documents`              | multipart `file`, `UploadDocumentFields` | 201 `CitizenCase`                    |
| PATCH  | `/documents/:id`          | `ReassignDocumentRequest`                | `CitizenCase`                        |
| DELETE | `/documents/:id`          | —                                        | `CitizenCase`                        |
| GET    | `/documents/:id/file`     | —                                        | allegato autorizzato                 |
| POST   | `/submit`                 | `SubmitCaseRequest`                      | `CitizenCase` con stato submitted    |

Intervista/upload modificabili in `intake` o `needs_citizen`. Invio richiede pratica e
intervista terminata; può contenere documenti mancanti, esplicitamente segnalati. La prima
completezza è fotografata al primo invio e non riscritta da integrazioni successive.

`turn`: text classifica/estrae; sotto confidenza 0,75 rimane la scelta esplicita della
pratica. answer valida tipi/opzioni/condizioni; edit rende prioritaria la domanda modificata e invalida dipendenze; skip ammesso solo
per domande opzionali; choose_practice riparte con risposte vuote quando cambia pratica.
AI SDK 7 propone, core convalida. Nessuna chiave/errore/timeout → euristica esplicita.

Upload massimo **4 MiB file**, richiesta multipart 4 MiB + 128 KiB (entro il limite Vercel
4,5 MB). PDF leggibile dal parser o immagine riconosciuta da magic bytes, MIME dichiarato
ignorato. Nome sanificato, SHA-256 sui byte originali. `checklistItemId` esplicito deve
appartenere al fascicolo; auto-abbinamento solo a una singola voce candidata. In presenza
di più membri/conti serve scelta umana. Riassegnare a null lascia il documento non abbinato.

Quando cambiano i requisiti, documenti conservati e restituiti non abbinati; revisioni
persistono sugli ID rimasti applicabili. Modificare i file di una voce invalida la verifica
precedente. I membri mantengono gli UUID in `answers.members`: rimandare `MemberInput.id`
negli edit; i vecchi input senza ID restano accettati. La rimozione di un membro stacca i suoi
documenti e annulla le revisioni relative. Download: PDF/immagini supportate inline;
`?download=1` forza attachment, sempre `nosniff`. Storage key e URL Blob mai esposti.
Timeout/OOM del parser PDF restituiscono 503 con invito a riprovare, file non valido 415.

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
| GET    | `/cases/:id`                             | —                            | `CaseDossier`, senza transizione di stato         |
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

Date reali YYYY-MM-DD, entrambe incluse, giorni **UTC**, massimo 366 giorni. Sede opzionale;
organizzazione sempre derivata dalla sessione. Avvii da createdAt, invii da primo submittedAt,
pronti da eventi review.completed; aggregati per pratica/lingua e giorno. Completezza e
tasso integrazioni riferiti ai fascicoli del cohort inviato nell'intervallo; nessun dato → null.
Baseline deriva esclusivamente dalle impostazioni dichiarate dal CAF (demo esplicitamente fittizia).

Minuti cittadino: creazione → primo invio; revisione: prima apertura → pronto. Sono intervalli
trascorsi, includono pause/attesa, non misurano minuti di attività continua. Non usare questi
intervalli come prova di risparmio di lavoro senza un protocollo di misurazione nel pilota.

Rate limit persistente su hash IP+categoria: login 10, leads 5, intake 30, upload 30, turn
120 richieste/minuto; 429 `rate_limited`, Retry-After. IP da x-forwarded-for soltanto dietro
proxy fidato (`VERCEL=1` o `TRUST_PROXY=1`); locale usa bucket condiviso. Non abilitare TRUST_PROXY
su server direttamente accessibile che accetta header arbitrari.

Provider AI/Blob/Postgres remoto non provati dalla suite locale. I modelli DSU/730 2027
richiedono aggiornamento normativo prepilota; beta non sostituisce la revisione dello sportello.

## Manutenzione

`GET /api/cron/maintenance` richiede `Authorization: Bearer <CRON_SECRET>`. Nessuna
sessione operatore richiesta. Il job elimina sessioni e bucket scaduti e ritenta le
cancellazioni storage; risponde `{ok:true}`, oppure `{ok:true,skipped:true}` entro il
cooldown di un minuto. Un segreto assente o errato dà 401. Compatibile con Vercel Cron;
va configurato nello scheduler del deploy. Nessun purge globale durante i POST utente.

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
`linkDays` vale solo per nuovi link. `retentionDays` viene applicato dal cron ai
fascicoli chiusi o scaduti da più del periodo configurato (25 per esecuzione).
La cancellazione manuale richiede il riferimento, senza distinzione maiuscole/minuscole.
Entrambe rimuovono DB e file, con tombstone/retry e audit senza contenuti personali:
vedi [SECURITY.md](SECURITY.md#retention-e-diritti).
