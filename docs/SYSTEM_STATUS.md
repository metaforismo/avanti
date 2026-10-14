# Stato del sistema per gli amministratori

`GET /api/status` richiede una sessione attiva con ruolo `admin`. Non accetta parametri:
l'organizzazione deriva dalla sessione. Un operatore riceve `403`; senza sessione valida,
`401`. Il cambio obbligatorio della password impedisce l'accesso. La risposta ha
`Cache-Control: no-store` e rimane HTTP `200` anche con stato aggregato `problem`.

Il contratto Zod **SystemStatus**, esportato da `@avanti/contracts`, è necessario perché
backend e interfaccia devono condividere campi, codici e semantica dei valori mancanti.
È uno schema rigoroso, senza campi liberi: `schemaVersion: 1`, `generatedAt`, stato
aggregato, versione, sei componenti e cinque contatori. Componenti e contatori hanno
`status: ok | attention | problem` e un `code` enumerato. L'aggregato è il peggiore stato.
L'[esempio JSON completo](verification/system-status-example.json) è sintetico e validabile
con lo schema. Non contiene nomi, ID di pratiche/documenti/operatori/organizzazioni, URL,
chiavi storage, credenziali, stack o messaggi del provider.

Il commit è una SHA esadecimale di 7–40 caratteri; il tag deve essere SemVer, con prefisso
`v` opzionale. Metadati assenti/non validi diventano `null`. Su Vercel il commit proviene
da `VERCEL_GIT_COMMIT_SHA`; altrove configurare `APP_COMMIT` e `APP_TAG`. Il runtime
non esegue comandi Git.

## Ambito e osservazioni

- **Database e storage**: infrastruttura condivisa del deployment. Lo snapshot DB
  interroga conteggi, job e telemetria in una transazione read-only, con timeout SQL
  di 3 secondi e deadline complessiva di 5 secondi. Il probe storage scrive, legge
  e cancella un payload sintetico tramite l'adattatore esistente: timeout di 3 secondi,
  risultato condiviso per 10 secondi fra letture della stessa istanza. Un adattatore
  senza probe è `attention/probe_unavailable`.
- **AI e contatori**: solo l'organizzazione autenticata. `hourly` contiene 24 bucket
  UTC ordinati, l'ora corrente più le 23 precedenti, compresi gli zeri. È una finestra
  per ore di calendario: il primo bucket comincia fra 23 e 24 ore prima.
  `recentApiErrors24Hours` usa la stessa finestra. Sono osservate intake, analisi
  documenti e traduzione nelle chiamate reali. La traduzione italiana senza AI non
  è un successo AI né un fallback.
- `configured` indica la presenza della configurazione Gateway; non prova la validità
  della chiave o la disponibilità del provider. `mode` descrive gli esiti nella finestra:
  `ai` per soli successi, `fallback` per esiti degradati senza successi o configurazione
  assente, `unknown` per esiti misti, errori senza fallback osservato o assenza di dati.
  La dashboard non chiama l'AI. Un
  provider iniettato senza `configured` resta `no_observations/unknown`.
- **Manutenzione e retention**: ultimi job globali, condivisi fra CAF. Si espongono
  solo inizio, fine ed esito, senza volumi o identificatori di altre organizzazioni.
  Retention indica che la selezione/cancellazione dei fascicoli eleggibili e la pulizia
  dell'audit sono terminate, anche se non c'era nulla da eliminare. Comprende anche i
  retry di cancellazione storage: se rimangono file con tentativi
  falliti, entrambi i job hanno esito `failed` finché una successiva esecuzione li
  elimina. Non certifica lo svuotamento completo della coda: i lotti possono lasciare
  file ancora non tentati. Il JSON del cron conserva `ok: true` per una chiamata
  completata con retry differiti; il DTO segnala il fallimento operativo.
- **Email**: `components.email` espone il provider effettivo (`console` o `resend`) e
  tre conteggi del solo CAF autenticato: `queuedOver1Hour`, `failed24Hours` e
  `sent24Hours`. `console` scrive solo log e non invia email reali: almeno
  `attention/email_simulated`, anche con coda vuota. `resend` indica l'adattatore
  configurato, non una verifica live del provider. `sent` significa accettazione
  dell'invio dal provider, non ricezione nella casella del destinatario.
  `simulated` e `cancelled` non contano come inviati o falliti.
- **Coda email**: `counters.notificationsQueued.count` è il totale `pending/sending`
  del CAF, di qualunque età; il suo livello dipende solo dal sottoinsieme più vecchio
  di un'ora, così una coda appena creata non genera un allarme. Include i retry e
  gli invii sotto lease, anche se `nextAttemptAt` è nel futuro. I lead al team senza
  organizzazione sono esclusi da tutti i conteggi e dall'aggregato: l'endpoint non
  ha un ambito globale email e un admin CAF non deve osservare attività del team.

Se il DB fallisce dopo l'autenticazione, i dati non leggibili diventano `null` con
`problem/unavailable`, mai zeri o `never_run`. Se fallisce prima di autenticare, l'API
restituisce il consueto `ApiError` sicuro: i permessi rimangono obbligatori. Un errore
storage non impedisce di leggere gli altri componenti. Gli errori API conteggiati sono
HTTP 5xx con tenant già autenticato; non includono errori anonimi, login, cron,
validazione o rate limit.

## Soglie del pilota

Le soglie sono operative, non normative, e seguono il cron giornaliero UTC.

| Componente o contatore                             | `ok`                                                    | `attention`                                                  | `problem`                                                                       |
| -------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Database                                           | Snapshot completato                                     | Non previsto                                                 | Snapshot fallito/scaduto                                                        |
| Storage                                            | Probe completato                                        | Probe non disponibile                                        | Probe fallito o oltre 3 s                                                       |
| AI configurata                                     | Almeno un successo, zero fallback/errori nella finestra | Nessuna osservazione, fallback o 1–4 errori                  | ≥5 errori nella finestra; telemetria illeggibile                                |
| AI senza chiave                                    | Non previsto                                            | `not_configured`, fallback locale                            | Telemetria illeggibile                                                          |
| Manutenzione e retention                           | Ultimo job riuscito da meno di 26 h                     | Mai eseguito; riuscito da ≥26 h e <48 h; in corso da <10 min | Ultimo job fallito; riuscito da ≥48 h; in corso da ≥10 min; storico illeggibile |
| Documenti in `processing` da **più di** 10 min     | 0                                                       | 1–4                                                          | ≥5                                                                              |
| Pratiche in `needs_citizen` da **più di** 7 giorni | 0                                                       | 1–9                                                          | ≥10                                                                             |
| Link validi in scadenza entro 7 giorni             | 0                                                       | 1–9                                                          | ≥10                                                                             |
| Errori API recenti (HTTP 5xx)                      | 0                                                       | 1–4                                                          | ≥5                                                                              |
| Email con provider `console`                       | Non previsto                                            | `email_simulated` se non ci sono anomalie più gravi          | Come coda/fallimenti; conteggi illeggibili                                      |
| Email in `pending/sending` da **più di** 1 ora     | 0                                                       | 1–4, `email_backlog`                                         | ≥5, `email_backlog`                                                             |
| Email definitivamente `failed` nelle ultime 24 h   | 0                                                       | 1–4, `email_failed`                                          | ≥5, `email_failed`                                                              |
| Email `sent` nelle ultime 24 h                     | Qualunque conteggio leggibile                           | Non previsto                                                 | Conteggio illeggibile                                                           |

Gli errori AI includono chiamate configurate degradate dal Gateway (anche input non
supportati, output non valido e timeout) ed eccezioni della chiamata AI. Senza chiave,
il fallback previsto aumenta `fallbacks`, non `errors`. Un fallback può quindi essere
anche un errore: non sommare le due colonne come tentativi distinti.

Per i documenti si usa `uploadedAt`, non il termine del lease o l'ultimo retry. Per le
pratiche in attesa si usa l'ultima richiesta al cittadino (`case.requested` o
`case.needs_citizen` nell'audit), quindi modificare una nota non azzera l'età. Per
fascicoli precedenti senza questi eventi si usa `updatedAt`; anche la scadenza della
retention dell'audit può imporre questo ripiego. I link conteggiano fascicoli non chiusi,
con `expiresAt > now` e `<= now + 7 giorni`: quelli già scaduti sono esclusi.
I conteggi illeggibili sono sempre `null/problem`.

Per la coda email si usa `createdAt < now - 1 ora`, mai l'ultimo retry: a un'ora
esatta la riga è esclusa dal backlog. Per inviati/falliti si usa `completedAt` nella
finestra mobile `[now - 24 ore, now]`, entrambi i confini inclusi; completamenti
futuri e righe senza completamento sono esclusi. Un retry ancora `pending/sending`
non è un fallimento definitivo. Il livello email è il peggiore fra backlog,
fallimenti e simulazione; a parità di livello il codice dà precedenza a fallimenti,
poi backlog, poi simulazione. Con `resend`, coda senza arretrati e zero fallimenti
sono `ok/available` anche con zero inviati. Nessuna chiamata al provider o decifratura
dell'outbox viene eseguita dalla dashboard; indirizzi, oggetti, contenuti ed errori
non entrano nel DTO. Se lo snapshot DB fallisce, tutti e tre i conteggi email e il
totale in coda diventano `null`, il componente è `problem/unavailable`; il provider
configurato rimane visibile.

## Persistenza e migrazione

La migrazione **0009_loving_carmella_unuscione** aggiunge solo:

- `system_jobs`: due righe massime, `maintenance` e `retention`, con ID interno del run,
  timestamp ed esito enumerato. La tabella vuota significa `never_run`: l'upgrade non
  inventa uno storico per installazioni esistenti.
- `operational_counters`: contatori atomici per `(organization_id, hour, metric)`.
  Le sole metriche sono `ai_success`, `ai_fallback`, `ai_error`, `api_error`. Il cron
  elimina i bucket dopo 7 giorni; il DTO espone solo 24 bucket. La FK del tenant
  prevede la cancellazione in cascata.

Il cron acquisisce la guardia nel DB: massimo un tentativo al minuto anche dopo un
fallimento/riavvio. Un job `running` non si riassegna prima di 10 minuti. Il completamento
è protetto dall'ID del run: un vecchio worker non sovrascrive l'esito di uno nuovo.
Una chiamata saltata non altera lo storico. Gli errori non sono salvati come testo:
solo `failed` e timestamp. Un arresto lascia `running`, che diventa `problem/stale`
dopo 10 minuti.

La scrittura della telemetria AI/errori è best-effort, con deadline di 3 secondi:
non deve bloccare una pratica altrimenti riuscita. Un fallimento può sottostimare i
conteggi e produce solo `TelemetryUnavailable` nel logger configurato. Questo è un
segnale operativo, non un audit completo delle chiamate. Nessuna dipendenza aggiunta.

Per i conteggi email si riutilizza l'outbox esistente: la query della coda filtra
`pending/sending` (indice parziale `notifications_due_idx`), quella dei completamenti
limita `completedAt` alle ultime 24 ore (`notifications_completed_idx`). Entrambe
filtrano `organization_id` nel DB e restituiscono solo aggregati, nello stesso
snapshot read-only. Non serve una nuova migrazione per questo intervento.

In produzione applicare la migrazione prima di distribuire il backend.
La pianificazione e i segreti rimangono quelli del [runbook](DEPLOY.md).

## Verifica

`packages/api/src/system-status.test.ts` copre permessi, tenant, confini temporali,
PII/segreti, fallback reale senza chiave e con provider simulato in errore, analisi,
traduzioni, persistenza fra istanze, contatori concorrenti, timeout/probe assente,
job mai eseguiti, fallimenti, guardia cron condivisa e recupero di un run abbandonato.
Copre anche permessi email, cross-tenant e lead esclusi, confini a 1 ora/24 ore,
soglie email 0/1/4/5, coda fresca, fallimenti definitivi distinti dai retry,
simulazione console reale, precedenza dei codici, conteggi illeggibili ed esempio JSON.
`packages/db/src/system-status-migration.test.ts` prova l'upgrade da 0008, i vincoli
e la cancellazione in cascata. Le chiamate al provider sono simulate nei test:
non sono una prova di disponibilità di AI/Blob/Postgres in produzione.

Il test preesistente del tetto IP esegue 15.000 richieste reali: dopo un timeout
anche con `pnpm check --concurrency=1`, il suo solo budget temporale è stato portato
a 240 secondi. Numero di richieste, soglie e asserzioni restano identici; il test
verifica la quota, mentre il tempo del flusso di 40 cittadini è verificato separatamente.
