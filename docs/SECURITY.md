# Sicurezza e protezione dei dati

Versione: **6 ottobre 2026**; fonti consultate il 5–6 ottobre. Questo documento descrive controlli tecnici, responsabilità
e lavoro operativo necessario al pilota; non certifica conformità GDPR o AI Act.
Le prove di implementazione sono i test e i controlli riportati nella PR.

## Audit mirato prima del pilota — 6 ottobre 2026

**PASS locale sui controlli verificati; rilascio con persone reali ancora da verificare.**
Riferimento: [OWASP ASVS v5.0.0, livello 2](https://owasp.org/projects/asvs),
per autenticazione/sessioni, autorizzazione, validazione/file, API, logging e
configurazione. Questo audit mirato non è una verifica completa o certificazione ASVS.
Misure, comandi, integrazione web e limiti in
[verification/pilot-hardening.md](verification/pilot-hardening.md).

| Problema / controllo                                                                 | Gravità del problema trovato          | Esito e correzione                                                                                                                                                                                                                            | Prova locale                                                                                                                                                |
| ------------------------------------------------------------------------------------ | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rotazione sessione al cambio password                                                | Alta                                  | Nuovo token e nuova scadenza; tutte le sessioni precedenti eliminate nella stessa transazione. Login sostituisce la sessione dello stesso operatore presentata col cookie                                                                     | `pilot-security.test.ts`: login/password/logout; `administration.test.ts`: cambio, reset e accesso concorrente                                              |
| Inattività sessione di otto ore                                                      | Media                                 | 30 minuti di inattività, rinnovo su lettura, massimo assoluto 12 ore; cookie HttpOnly/Secure in produzione/SameSite=Lax                                                                                                                       | `app.test.ts`: limite esatto 30 minuti, sessione attiva oltre 12 ore, rinnovo e cap; `pilot-security.test.ts`: cookie                                       |
| Link cittadino leggibile dopo chiusura                                               | Alta                                  | Chiusura anticipa expiresAt nella transazione; tutte le rotte cittadino rifiutano i fascicoli chiusi; riaprire non riattiva il link. Cancellazione elimina il record e restituisce 404                                                        | `pilot-security.test.ts`: chiusura/riapertura/file; `administration.test.ts`: erasure                                                                       |
| Entropia/confronto capability                                                        | Nessun difetto rilevato nell'entropia | 32 byte da randomBytes, solo SHA-256 persistito; confronto timingSafeEqual dell'hash dopo lookup indicizzato. Il lookup/HTTP complessivo non è a tempo costante                                                                               | `pilot-security.test.ts`: 500 token da 32 byte, scadenza; `middleware/auth.ts` e `security.ts`: controllo esplicito; non è una prova statistica del CSPRNG  |
| Origin assente su mutazioni cittadino/pubbliche; Host aggiunge origini in produzione | Alta                                  | Middleware globale prima del body, inclusi multipart; solo PUBLIC_APP_URL in produzione. Nessun CORS abilitato                                                                                                                                | `pilot-security.test.ts`: matrice mutazioni, multipart, Origin mancante/esterno, Host/URL estranei; `app.test.ts`: fallback Sec-Fetch-Site e origini locali |
| Upload riconosciuto solo dalla firma                                                 | Alta                                  | Tipo dichiarato coerente col tipo rilevato, rifiuto PDF con JavaScript/allegati/azioni attive anche negli object stream, massimo 300 pagine. Dimensioni PNG/JPEG/WebP/HEIC entro 40 megapixel e 16.384 pixel per asse; WebP animati rifiutati | `pilot-upload.test.ts`: PDF compressi/allegati, MIME, immagini; `pdf-pages.test.ts`: validi, invalidi, timeout/OOM                                          |
| Limite body dipendente da Content-Length; quota solo in numero file                  | Media                                 | Contatore sullo stream reale, 4 MiB/file, envelope 128 KiB, 60 documenti e 120 MiB/pratica verificati sotto lock; quattro upload simultanei per pratica nella singola istanza                                                                 | `pilot-upload.test.ts`: multipart oltre limite, Content-Length falsato, quota byte e quinto upload; `app.test.ts`: dimensione file e 61esimo documento      |
| Storage traversal e symlink                                                          | Alta per symlink locali               | Chiavi con segmenti ammessi, confine canonicalizzato, rifiuto symlink, O_NOFOLLOW, file 0600. Nessun nome originale usato come percorso                                                                                                       | `storage.test.ts`: traversal, symlink directory/file, permessi; `pilot-upload.test.ts`: nomi                                                                |
| PDF/file inline sullo stesso origin                                                  | Media                                 | Attachment sempre, nosniff, CSP sandbox/default-src none, nessun URL firmato/Blob nel DTO; API no-store/no-referrer e CSP restrittiva anche sugli errori                                                                                      | `pilot-security.test.ts`: file/header/log; `app.test.ts`: filename e audit download/export; revisione `dossier.ts` per DTO                                  |
| Quote assenti su export e traduzioni operatore                                       | Media                                 | Export JSON/PDF 20/minuto per operatore e 200/IP; integrazioni 30/minuto per operatore e 300/IP. Restano quote su login/password/intake/lead/turn/upload                                                                                      | `pilot-security.test.ts`: quote e proxy mancante; `middleware/rate-limit.test.ts`, `app.test.ts`: proxy fidato/socket e spoofing                            |
| Isolamento CAF                                                                       | Nessun accesso estraneo trovato       | Predicate tenant su risorse, relazioni e filtri; 404 uniforme prima di storage/AI. Lo slug sportello è intenzionalmente pubblico e contiene solo campi pubblici                                                                               | `pilot-security.test.ts`: matrice pratiche, note, revisioni, documenti/file, operatori/reset, sportelli, metriche, export; test DB sui FK tenant            |
| AI nel percorso upload; lavoro perso all'arresto                                     | Media                                 | Processing persistito, after() e recupero cron; fallback esplicito. Lease storage prima del put, rimosso nel commit documento; cleanup/backoff durevoli                                                                                       | `pilot-upload.test.ts`: risposta prima dell'AI, restart, documento eliminato, put ambiguo recuperato; `blob-storage.test.ts`: deadline/late success         |
| Health sempre OK e shutdown senza drain applicativo                                  | Media                                 | Probe DB/storage con 503 sicuro, coalescenza 10 secondi; closeRuntimeDatabase drena richieste e background registrati                                                                                                                         | `pilot-reliability.test.ts`: outage/coalescenza e commit/rollback con DB persistente; `runtime.test.ts`: singleton e chiusura idempotente                   |
| Letture storiche metriche e query ridondante assegnatario                            | Media prestazioni                     | Query circoscritte al periodo; upsert revisioni in batch; riuso operatori timeline; migrazioni 0005/0006                                                                                                                                      | `pilot-performance.test.ts`: 2.000 pratiche/20.000 documenti, conteggio query, cursori, EXPLAIN; `routes.test.ts`: storia metriche                          |
| Dipendenze produzione                                                                | Nessuna segnalata                     | pnpm audit --prod: 234 dipendenze, zero info/low/moderate/high/critical; nessuna vulnerabilità accettata o soppressa                                                                                                                          | Audit registry eseguito in questa sessione; risultato in `pilot-hardening.md`                                                                               |

**Aperto prima del trattamento reale:** header/CSP delle pagine, nonce per una CSP
senza unsafe-inline, redazione dei log proxy, polling UI durante processing e
compatibilità della preview dopo attachment; scheduler giornaliero/configurabile e recupero su lettura
su deployment; lifecycle Node/serverless e prova PostgreSQL/Blob reali con dati
sintetici. Mancano scansione malware e decodifica isolata completa: i controlli
sui contenitori/dimensioni non attestano la sicurezza di tutti i payload.
Il token resta una capability in URL: il frontend e il proxy devono applicare
no-referrer e impedirne la raccolta da analytics/log. Le prove Hono non dimostrano
questi controlli browser/infrastrutturali. Il rischio TOCTOU sul disco contro un
processo locale privilegiato resta fuori dal confine applicativo.

## Confini e minacce

Il link cittadino è una credenziale: chi lo possiede può accedere al relativo fascicolo.
I dati includono identità, situazione economica, documenti e potenzialmente salute/minori.
Minacce principali: furto del link/sessione, accesso fra CAF, caricamenti malevoli,
abuso degli endpoint, esposizione tramite log/cache/export e invio eccessivo a fornitori AI.
Avanti prepara; il CAF verifica e utilizza il proprio gestionale per la pratica ufficiale.

| Superficie | Controllo da mantenere                                                                                                                                                        |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Password   | scrypt `N=32768, r=8, p=1`, sale casuale 16 byte, derivato 64 byte; confronto costante. Nessuna password nei log                                                              |
| Sessioni   | Token casuale 32 byte, solo SHA-256 nel DB; cookie HttpOnly, SameSite=Lax, Secure in produzione; inattività 30 minuti, durata assoluta 12 ore, rotazione e revoca lato server |
| CSRF       | In produzione Origin solo PUBLIC_APP_URL; senza Origin solo Sec-Fetch-Site same-origin; controllo globale su tutte le mutazioni, multipart incluso                            |
| Cittadino  | Capability casuale 32 byte, solo hash nel DB; scadenza e risposta `link_expired`/410. Il token non viene ricostruito per la console                                           |
| Tenant     | Organizzazione dalla sessione, mai fidata dal body; ogni query, file, assegnatario, export e metrica deve essere circoscritto; risorse estranee restituiscono 404             |
| Input      | Schemi condivisi più validazione di dominio; errori italiani sicuri, niente stack/dettagli infrastrutturali al client                                                         |
| Upload     | 4 MiB/file, 120 MiB e 60 documenti/pratica, contatore body, firma/MIME, PDF attivi e dimensioni immagini controllati; chiavi generate dal server                              |
| Download   | Autorizzazione prima dello storage; allegato, `nosniff`, cache privata disabilitata. URL Blob privati non esposti al cittadino                                                |
| Abusi      | Rate limit login/password/intake/turn/upload/leads/export/traduzioni, errore uniforme di login; origine IP derivata solo da proxy fidato                                      |
| Audit      | Attore, categoria, istante, conteggi; niente messaggi, nomi, CF, contatti, nomi file o contenuto documenti nei metadati/log                                                   |

Le firme riconoscono il contenitore; non sono antivirus né prova che tutte le pagine
si aprano correttamente. PDF/immagini possono contenere dati o contenuti pericolosi:
download come allegato e verifica umana restano necessari. Valutare scansione malware e
decodifica isolata prima di un deployment con dati reali su larga scala.

Il reverse proxy deve oscurare i segmenti capability nei log delle richieste e inviare
`Referrer-Policy: no-referrer` sulle pagine cittadino. Analytics, replay di sessione e
tracker non devono raccogliere quelle pagine. Non incollare link veri in ticket o chat.
La policy del proxy/browser fa parte del deployment e non è provata dai soli test Hono.

## Sala d'attesa e manutenzione pianificata

L'IP non identifica il cittadino: 40 persone possono condividere il Wi-Fi del CAF.
Capability per pratica: turni 60/minuto + 400/ora (le risposte sono tocchi rapidi; solo il testo libero arriva all'AI), upload 30/minuto + 120/ora.
IP fidato: turni 1.500/minuto + 15.000/ora, upload 400/minuto + 4.000/ora; avvii pubblici
40/minuto + 60/ora. Login/password conservano 10/minuto per email (password anche per
operatore), con tetto IP 100/minuto per non bloccare l'ingresso di 10 operatori.
I limiti identità precedono quelli IP; un abuso già fermato sulla capability non
esaurisce il Wi-Fi. Le finestre fisse sono separate tramite HMAC categoria/durata;
nessun token, email o IP in chiaro nei bucket. Messaggi 429 nelle otto lingue del
cittadino e `Retry-After` in secondi; quota upload simultanei per pratica mantenuta,
non globale. Prove in `waiting-room.test.ts` e `pilot-upload.test.ts`.

Con Root Directory Vercel `apps/web`, la pianificazione in
[`apps/web/vercel.json`](../apps/web/vercel.json) è `0 3 * * *` UTC, giornaliera,
compatibile con Hobby. Su Pro si può scegliere `* * * * *` al prossimo deploy.
Le letture autorizzate del fascicolo registrano con `after()` il recupero dei
`processing` vecchi oltre 2 minuti: solo quel fascicolo, senza cambiare stato/data
pratica. Upload, cron e lettura acquisiscono atomicamente un lease DB di 2 minuti;
il token proprietario impedisce risultati obsoleti e analisi concorrenti durante
un lease valido. Storage fallito conserva il lease fino a scadenza. Test locali in
`document-recovery.test.ts`; il coordinamento multi-connessione resta da provare
su Postgres effettivo. Il lease non è exactly-once per chiamate esterne interrotte.

`CRON_SECRET`, distinto dal segreto rate limit, autentica il Bearer con confronto
costante; assente/errato dà 401. Il cron recupera fino a 4 documenti/run, cancella
25 fascicoli oltre retention e ritenta 100 cancellazioni file; cooldown per istanza.
Cron automatico solo Production: staging e Preview devono avere risorse isolate.
[Configurazione](https://vercel.com/docs/project-configuration/vercel-json),
[piani cron](https://vercel.com/docs/cron-jobs/usage-and-pricing).

Procedura completa, regione UE, costi/backup, migrazioni prima della build, seed
vietato, bootstrap admin, HSTS e prove Postgres reali in [DEPLOY.md](DEPLOY.md).
`pnpm db:check` è read-only e non ripara: richiede Postgres, journal completo e
indici validi. Il controllo è prerequisito del rilascio, non prova di conformità o
backup funzionante. Nessuna credenziale o dato reale negli artefatti di verifica.

## Preflight e comandi amministrativi

`pnpm preflight` controlla obblighi, URL HTTPS canonico, TLS Postgres, regione se
ricavabile, segreti distinti e forza statistica minima (192 bit stimati, almeno 12
simboli diversi, niente ripetizioni periodiche). La stima non prova la casualità:
generare 32 byte con un generatore crittografico e conservarli nel gestore segreti.
Non apre DB/storage, non stampa valori né garantisce validità delle credenziali,
regione effettiva, accesso Blob privato o backup. Il build Vercel lo esegue per primo,
fuori cache. Seed bloccato prima di qualsiasi apertura DB in produzione, su Vercel
e quando `DATABASE_URL` è impostata, anche con `NODE_ENV=development`.

Bootstrap solo CLI: terminale privato senza registrazione, Postgres TLS migrato,
`NODE_ENV=production`, conferma `CREA CAF PILOTA`, transazione con lock delle tabelle.
Rifiuta admin preesistenti anche inattivi e DB non vuoti; non sovrascrive credenziali.
Password casuale solo sul terminale di controllo una volta, hash scrypt nel DB,
cambio obbligatorio con tutte le altre API bloccate. Audit senza nomi o credenziali.

Export organizzazione solo CLI: email/password dell’admin attivo del CAF, password
nascosta nel terminale, niente argomenti segreti o endpoint pubblico. Il cambio della
password temporanea è obbligatorio prima dell’export. Massimo 10 tentativi/minuto
per email HMAC usando `RATE_LIMIT_SECRET`. Snapshot transazionale coerente, query
circoscritte al CAF, audit con conteggi. JSON include note interne e dati dei membri:
non distribuirlo automaticamente a un singolo interessato. Esclude hash password,
sessioni, capability e chiavi storage; metadati file con SHA-256, senza binari.
File locale nuovo `0600` in `.data/exports`, senza sovrascritture; cifratura del disco,
trasferimento protetto e cancellazione delle copie a cura del responsabile.
L’evento registra la preparazione dell’export, non attesta la consegna al destinatario.

Backup Neon e prova trimestrale DB **e file** in [DEPLOY.md](DEPLOY.md); la finestra
backup non coincide con retention dei fascicoli. Dopo restore ripristinare revoche,
cancellazioni e retry prima di riaprire gli accessi. Restano prove del futuro deploy.

## GDPR: ruoli, base e informativa

Per i fascicoli, il **CAF/patronato è titolare**: decide finalità, base giuridica,
destinatari e durata. Il gestore di Avanti opera come **responsabile ex art. 28** su
istruzioni documentate, con accordo che disciplini assistenza, sicurezza, subresponsabili,
incidenti, restituzione/cancellazione e audit. Il ruolo dipende dai fatti, non dal nome
contrattuale. Per propri lead commerciali il gestore ha finalità distinte da valutare
come titolare. Non riutilizzare i fascicoli per marketing o training.
[GDPR, artt. 4 e 28](https://eur-lex.europa.eu/eli/reg/2016/679/oj/ita),
[EDPB, linee guida 07/2020](https://www.edpb.europa.eu/documents/guideline/guidelines-072020-on-the-concepts-of-controller-and-processor-in-the-gdpr_en).

Il titolare identifica la base dell'art. 6 e, per disabilità/salute, una condizione
dell'art. 9; `privacyAccepted` non dimostra da solo una base lecita per tutti i dati
dei membri. L'informativa deve spiegare titolare, finalità, AI/fornitori, destinatari,
durate e diritti in lingua comprensibile. Conservare prova della presa visione e versione
dell'informativa senza riportarne il contenuto negli audit. Acquisire deleghe e altre
autorizzazioni necessarie alla pratica tramite il CAF.
[Garante, principi e basi del trattamento](https://www.garanteprivacy.it/home/principi-fondamentali-del-trattamento).

## Retention e diritti

I parametri iniziali del DB sono `linkDays=60` e `retentionDays=180`, configurabili per
organizzazione: **scelte tecniche, non termini imposti dalla legge**. Scadenza link,
chiusura della pratica e cancellazione sono operazioni distinte; la chiusura revoca anche il link anticipandone la scadenza. Il job automatico applica la configurazione
dell’organizzazione. La durata appropriata va motivata dal CAF,
separando copia preparatoria Avanti dall'archivio obbligatorio del gestionale.
[Garante, limitazione della conservazione](https://www.garanteprivacy.it/home/principi-fondamentali-del-trattamento).

`GET /api/cron/maintenance`, autenticato con `CRON_SECRET`, cancella fino a 25
fascicoli per esecuzione quando la chiusura **oppure** la scadenza del link risale a
più di `retentionDays` giorni. La chiusura ha un proprio istante: modificare una
nota non lo sposta; riaprire il fascicolo lo azzera. Per i fascicoli già chiusi prima
della migrazione si usa l’ultimo aggiornamento come limite conservativo. Il cambio
di `linkDays` si applica solo ai nuovi link; la retention aggiornata vale per le
esecuzioni successive del job.

La cancellazione rimuove insieme fascicolo, risposte (incluse le persone), contatti,
note, messaggi, revisioni e metadati dei documenti. Gli eventi vengono scollegati
dal fascicolo nella stessa transazione e mantengono ID e riferimento tecnico della
pratica, organizzazione, ID dell’operatore (o cittadino/sistema), istante, azione e
conteggi/flag ammessi. I vincoli restrittivi impediscono una cancellazione accidentale
della cronologia attraverso la pratica. Nessun nome, email, CF, testo libero, password,
token, hash di credenziali o contenuto di documento è aggiunto all’audit. I file locali o
Blob sono cancellati dopo il commit; un errore lascia una tombstone in
`storage_deletions`, ritentata con backoff fino alla conferma dello storage. Il job
ritenta al massimo 100 file per esecuzione ed è idempotente; i fascicoli in uso da
una transazione vengono saltati. Le richieste utente non eseguono il purge.

L’amministratore può anticipare la cancellazione con `DELETE /api/cases/:id`,
confermando il riferimento; usa la stessa cancellazione e lo stesso retry dei file.
Restano manuali l’attivazione e la verifica dello scheduler nel deployment (giornaliero per il pilota; aumentare
la frequenza o i run se il volume supera i lotti), il monitoraggio dei retry,
l’identificazione del richiedente, la valutazione degli obblighi di conservazione,
la gestione delle copie esportate/backup e la valutazione della durata degli audit.

### Registro attività e conservazione separata

`GET /api/audit` e `GET /api/audit/export.csv` richiedono un amministratore attivo
del CAF con password definitiva. Un controllo del ruolo sotto lock condiviso dura
fino al commit; il filtro dell’organizzazione autenticata è obbligatorio in ogni
query. Gli attori sono identificati con ID tecnici, senza esporre nomi o email nel
registro. Per i tentativi falliti l’attore è «sistema»: l’account interessato, se
esistente, non dimostra l’identità di chi ha tentato l’accesso. L’email è omessa
anche nei fallimenti. Tentativi per account sconosciuti non hanno organizzazione:
restano eventi di sicurezza riservati al gestore, non consultabili da alcun CAF.
Anche i tentativi validati respinti dal rate limit sono registrati, con un flag.
L’autenticazione per export organizzazione da CLI usa le stesse azioni e aggiunge
il flag `cli=true`, senza registrare le credenziali.
Richieste malformate/respinte prima dell’autenticazione restano errori di validazione,
non accessi riusciti. I dettagli esposti hanno chiavi fisse e valori numerici/booleani;
chiavi storiche sconosciute e categorie non riconosciute non vengono rese come testo.

Gli audit durano **365 giorni dal proprio istante**, indipendentemente dai
`retentionDays` delle pratiche. È una scelta tecnica iniziale per indagini,
ricostruzione degli accessi e gestione dei diritti, **non un termine imposto dal
GDPR**: il titolare deve documentarne necessità e proporzionalità prima del pilota.
Il cron elimina al massimo 1.000 eventi scaduti per run, inclusi quelli senza tenant;
all’esatto limite di età l’evento è ancora conservato. Il volume può richiedere run
aggiuntivi; la scadenza è quindi applicata a lotti, non una garanzia di eliminazione
esattamente al giorno 365. La cancellazione anticipata della pratica non anticipa
quella dei suoi eventi; gli audit storici già eliminati non sono recuperabili.

Gli ID e i riferimenti restano potenzialmente collegabili alle persone: il registro
è minimizzato e pseudonimo, non anonimo. Le copie CSV sono riservate e il CAF deve
gestirne accesso e cancellazione separatamente. Le letture del fascicolo da parte
dell’operatore registrano l’accesso e, se restituito nel dossier, anche il prospetto
DSU. Nessuna lettura cambia `updatedAt` o avvia la revisione. Gli export CSV hanno
un limite di 5.000 eventi, una quota per operatore/IP e un evento dedicato con il
solo conteggio delle righe; oltre il limite sono rifiutati senza consegna parziale.
Se l’evento di audit non può essere scritto, l’export e le mutazioni sensibili
falliscono. Login falliti sono committati prima della risposta 401, senza creare sessioni.

Questo registro tecnico supporta l’accountability; non sostituisce il registro
delle attività di trattamento né la procedura per rispondere all’interessato.
[GDPR, artt. 5(1)(e), 5(2), 15 e 30](https://eur-lex.europa.eu/eli/reg/2016/679/oj/ita).
Contratto, filtri e testi delle azioni in [audit-log.md](verification/audit-log.md).

Runbook da concordare prima del pilota:

1. Il CAF identifica in modo proporzionato il richiedente, registra richiesta e scadenza;
   il possesso del link non prova da solo identità o rappresentanza di tutti i membri.
2. Per accesso/rettifica, il CAF verifica i dati e prepara la copia, tutelando terzi e
   note interne. L'export operatore completo non è automaticamente la risposta GDPR.
3. Per cancellazione, il CAF verifica eventuali obblighi di conservazione; Avanti revoca
   accessi, cancella DB e file locali/Blob e gestisce copie esportate con il CAF.
4. Limitazione e sospensione d'uso vanno rispettate anche se manca una UI dedicata.
   Conservare solo audit strettamente necessario e disciplinare scadenza delle copie
   di backup; un ripristino non deve reintrodurre dati cancellati nell'uso ordinario.
5. Documentare esito, dati residui motivati e tempi. Nessun comando di purge o workflow
   automatico può essere considerato operativo senza una prova sul deployment.

Accesso, rettifica, cancellazione, limitazione/opposizione e portabilità hanno condizioni
specifiche; la portabilità non vale indiscriminatamente per tutte le basi giuridiche.
Il titolare risponde normalmente entro un mese, con estensione motivata nei casi previsti;
Avanti lo assiste. L'interessato può reclamare al Garante.
[Garante, diritti degli interessati](https://www.garanteprivacy.it/Regolamentoue/diritti-degli-interessati).

## Fornitori AI, storage e incidenti

Senza chiavi il sistema usa storage locale ed euristiche. Attivare AI Gateway/Blob
significa coinvolgere fornitori: verificare accordi, subresponsabili, regioni, retention,
riuso/training e trasferimenti extra SEE prima di inviare documenti reali. Le variabili
d'ambiente non documentano questi aspetti. Invio minimo: singolo turno o documento
necessario, senza note interne né fascicoli di altri cittadini. `AI_GATEWAY_PROVIDER`
vincola ogni chiamata a un unico provider con `gateway.only`: se non disponibile,
il fallback è locale. Questo filtro non garantisce regione UE o ZDR; verificare
la matrice contrattuale prima di abilitare la chiave.
[Gateway, provider routing](https://vercel.com/docs/ai-gateway/models-and-providers/provider-options).

Output del modello e testo dei documenti sono input non fidati: validare tipi e
identificativi contro il catalogo, non eseguire istruzioni contenute nel documento,
consentire correzione umana e mantenere fallback esplicito. L'euristica non può
certificare leggibilità, pagine o intestazione; `verified` richiede l'operatore.

In un incidente: contenere accessi, revocare credenziali coinvolte, preservare evidenze
minime e avvisare senza ingiustificato ritardo il titolare. Il CAF valuta notifica entro
72 ore quando applicabile e comunicazione agli interessati secondo il rischio;
documentare anche incidenti non notificati. Registri di trattamento, contatti e procedura
di escalation sono attività operative da predisporre.
[GDPR, artt. 30, 32–34 e capo V](https://eur-lex.europa.eu/eli/reg/2016/679/oj/ita).

Dati economici/sanitari, minori, persone vulnerabili e tecnologia innovativa richiedono
una valutazione documentata dell'obbligo di DPIA prima del trattamento reale. La
dimensione ridotta del pilota non esenta automaticamente; se i rischi residui restano
elevati si valuta la consultazione preventiva. Questo documento non è una DPIA.
[Garante, elenco dei trattamenti soggetti a DPIA](https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/9058979).

## AI Act: qualificazione per finalità effettiva

L'Allegato III, 5(a), riguarda IA usata da/per autorità per valutare accesso a prestazioni
pubbliche essenziali; 7(c) riguarda assistenza alle autorità nell'esame di domande di
soggiorno/asilo. Il solo settore CAF non prova automaticamente l'inclusione o esclusione.
Art. 6(3) contempla compiti procedurali/preparatori senza rischio significativo e
influenza materiale sull'esito; la profilazione rende comunque alto rischio un sistema
ricompreso nell'Allegato III. L'operatore presente non è una deroga generale.
[Regolamento 2024/1689, art. 6, considerando 53 e Allegato III](https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng).

Valutazione di progetto, da confermare giuridicamente: classificare documenti,
chiedere integrazioni e tradurre per preparare un fascicolo tende al compito
preparatorio. La conclusione cambia se punteggi/blocchi filtrano l'accesso ai servizi,
se l'operatore approva senza controllo sostanziale o se il prodotto valuta ammissibilità.
Documentare destinazione d'uso, influenza reale, rischi per lingua/disabilità e motivazione;
riesaminare ad ogni estensione. Se ricompreso ma esentato, restano valutazione documentata
e obbligo di registrazione pertinente. In caso di alto rischio pianificare gestione
rischi, documentazione, qualità, logging, supervisione, conformità e obblighi del deployer
secondo i ruoli effettivi; non dichiararli assolti da questa PR.

Il **Regolamento 2026/1744**, art. 1(40), modifica il calendario: Capo III, sezioni 1–3
per Allegato III dal **2 dicembre 2027** (salvo art. 6(5)); non usare il vecchio
2 agosto 2026 per questi obblighi. Confermati requisiti di documentazione/registrazione
per l'esenzione, con semplificazione. Il nuovo art. 4 richiede misure di supporto
all'alfabetizzazione IA; l'interazione IA deve essere trasparente secondo art. 50.
L'art. **50(1)** sulla trasparenza dell'interazione è applicabile dal **2 agosto 2026**:
all'apertura del fascicolo viene restituito un avviso automatico/AI nella lingua scelta,
con verifica dell'operatore e alternativa allo sportello. Il campo `engine` del turno
identifica AI o euristica. L'export PDF dichiara il supporto automatico, la natura
preparatoria e se la verifica è completata; non attesta verifiche mai effettuate.
La marcatura machine readable ex art. 50(2) è un requisito distinto da valutare sul
rilascio e non viene dichiarata assolta dal solo campo `engine`.
Il pilota gennaio 2027 non è un'esenzione GDPR né una prova di classificazione AI Act.
[Testo ufficiale delle modifiche 2026](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ:L_202601744),
[Commissione, entrata in vigore AI Omnibus](https://digital-strategy.ec.europa.eu/en/news/ai-omnibus-enters-force).

Formare gli operatori sulle analisi incerte, disponibilità beta e correzione degli errori;
mostrare al cittadino che interagisce con un sistema automatico e come raggiungere il
CAF. Le scadenze e la qualificazione vanno ricontrollate prima del rilascio reale.

## Verifica in due passaggi degli operatori

TOTP secondo [RFC 6238](https://www.rfc-editor.org/rfc/rfc6238), HMAC-SHA-1,
sei cifre, 30 secondi, finestra ±1 passo, segreti casuali da 160 bit.
La suite controlla tutti i vettori SHA-1 ufficiali dell'Appendice B a otto cifre e
la riduzione a sei cifre. Il passo accettato deve superare quello già consumato;
lock e transazione rendono monouso TOTP e recupero anche tra sessioni concorrenti.
La conferma iniziale consuma il codice. Non si accettano passi precedenti dopo un
codice futuro valido: attendere il passo successivo se l'orologio del telefono è avanti.

`MFA_ENCRYPTION_KEY` è una chiave server di 32 byte casuali rappresentati come 64
cifre hex, obbligatoria e validata in produzione, distinta dai segreti cron/rate limit.
Nessuna dipendenza nuova: `node:crypto` per TOTP e AES-256-GCM, IV casuale da 96 bit,
tag da 128 bit e AAD con versione/ID operatore. Copiare una riga cifrata su un altro
operatore non permette di usarla. In locale, senza variabile, la chiave viene
creata atomicamente in `.data/mfa-encryption.key` (0600, directory 0700); sopravvive
ai riavvii. Conservare questa chiave insieme al DB locale per continuare a usare MFA.
Il seed demo resta senza MFA. Nessuna chiave viene scaricata o inviata a un provider.

I dieci codici di recupero hanno ciascuno 128 bit casuali: il DB conserva solo
SHA-256 con dominio separato; l'entropia rende inutile un salt per resistere alla
ricerca offline. Sono visualizzati soltanto nella risposta di conferma/rigenerazione.
Il secondo fattore consente di accedere anche con telefono perso; un codice consumato
viene rimosso. Disattivazione e rigenerazione richiedono password attuale e un TOTP
nuovo o un codice di recupero. L'avvio della configurazione richiede la password;
non basta rubare una sessione di Account per impostare un nuovo segreto.

La sessione dopo password dura cinque minuti e non si rinnova. Può usare solo i
passi indispensabili del login, senza API fascicoli, amministrazione, export o API
pubbliche. La verifica ruota il cookie e distrugge la sessione in attesa. Attivazione,
disattivazione e reset revocano tutte le sessioni precedenti. MFA obbligatoria blocca
anche le sessioni già esistenti senza configurazione; il cambio password obbligatorio
non aggira il secondo fattore. Il comando CLI di export applica la stessa verifica.

Rate limit persistente: dieci POST MFA/minuto per operatore/email, cento per IP fidato,
HMAC dei bucket, quota condivisa tra sessioni e operazioni. Il limite password resta
separato. Un tentativo fallito produce al massimo un evento MFA per finestra/account,
anche sotto flood. Errori uniformi in italiano, senza indicare quale credenziale è
errata; il login password non rivela l'esistenza dell'account. Nessun segreto, codice,
URI, email o password nei log applicativi o negli eventi MFA.

Reset riservato agli admin del CAF, impossibile sul proprio account: elimina segreto,
stato replay e recupero, revoca sessioni, registra attore e soggetto. Prima di un reset
l'organizzazione deve identificare l'operatore mediante il proprio canale interno;
se l'obbligo è attivo, il prossimo accesso deve configurare di nuovo MFA.

Operazioni: sincronizzare il clock server; tenere la chiave separata dagli export e
in un secret manager; includerla nelle procedure di ripristino protette. Cambiare
soltanto la variabile non ricifra i segreti esistenti: la rotazione richiede un piano
controllato di ricifratura oppure reset e nuova configurazione. Perdita della chiave
rende i segreti non decifrabili; non usare fallback di produzione.
TOTP non resiste al phishing in tempo reale; resta necessaria la protezione della
sessione. È una misura nel quadro di sicurezza richiesto dall'
[art. 32 GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj/ita), che richiede misure
adeguate al rischio: questa implementazione da sola non certifica la conformità.
