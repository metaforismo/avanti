# Backend: decisioni e prove

Il contratto pubblico esistente resta il confine frontend/backend. Le risposte e i documenti sono ricalcolati dal core a ogni lettura; revisioni e abbinamenti sono persistiti per ID deterministico. Il clock è iniettato nella factory API e passato al core.

Sono state confrontate due strutture: un repository applicativo con metodi per ogni endpoint, e query Drizzle nel servizio fascicolo con un database comune ai due driver. La seconda evita duplicazione tra repository e query; il servizio compone il DTO e nasconde la ricostruzione, mentre le route gestiscono validazione/autorizzazione.

Token, sessioni, storage e AI sono confini separati. L'AI produce proposte strutturate che il catalogo valida. Il fallback non può attestare leggibilità, titolarità o completezza: occorre revisione umana. PDF e JSON sono export preparatori, mai trasmissioni agli enti.

Verifica prevista: unit test dominio, integrazione Hono/PGlite in memoria, migrazioni/seed idempotenti, check/build root e smoke HTTP attraverso Next in locale. I dati demo non sono evidenza dei KPI del pilota. Provider remoti e conformità legale richiedono verifiche dedicate prima del trattamento reale.

AI SDK 7 verificato dalla documentazione del pacchetto installato: `instructions`,
`Output.object`, timeout totale e parti `file` anche per immagini. Le chiamate sono
vincolate a un provider Gateway (`only`), senza fallback verso altri fornitori. Il
modello di esempio [Claude Sonnet 5.5](https://vercel.com/ai-gateway/models/claude-sonnet-5.5)
è presente nel catalogo ufficiale consultato il 6 ottobre 2026; la disponibilità del
proprio account e le garanzie contrattuali richiedono una prova distinta.

## Seconda revisione backend — 6 ottobre 2026

I membri hanno UUID assegnati dall’API e salvati in `answers.members`; il core resta puro.
`MemberInput.id` è facoltativo per compatibilità: il frontend deve rimandarlo durante gli edit.
Un ID esplicito deve appartenere al nucleo corrente; senza ID si cerca prima la stessa identità,
poi posizione e ruolo se la lunghezza è invariata. Nei cambiamenti di dimensione si conserva
il nucleo precedente fino alla risposta sui membri, per mantenere identità e abbinamenti.
Alla rimozione definitiva si eliminano risposte riferite al membro, si staccano documenti e
si annullano revisioni relative a voci scomparse, nella stessa transazione.

La migrazione `0002` corretta abbina le occorrenze omonime in ordine, usando il suffisso
ordinale degli ID legacy per la posizione dei record della vecchia tabella. Scrive gli ID
anche nelle risposte. `0003` migra i DB che hanno già eseguito la versione precedente,
assegna UUID e conferma le chiavi delle risposte esistenti. Per gli omonimi già passati dalla
vecchia migrazione, la tabella originale è stata cancellata e l’abbinamento esatto non è più
ricostruibile: documenti ambigui tornano non abbinati e le revisioni vengono annullate.
Questo caso richiede un nuovo abbinamento da parte dell’operatore.

Per le anteprime PDF inline non si usa CSP `sandbox`, né la combinazione
`allow-scripts allow-same-origin`: il contenuto viene aperto dal visore PDF nativo del
browser, con MIME PDF verificato all’upload e `nosniff`. Si restringono gli incorporamenti
con `frame-ancestors 'self'`, `object-src 'none'` e `base-uri 'none'`; gli altri file mantengono
`sandbox`. I formati visualizzabili sono una lista chiusa (PDF, JPEG, PNG, WebP), HTML e SVG
sono rifiutati all’upload e gli altri tipi vengono scaricati come allegati. Non si restituisce
HTML utente con permessi di scripting sull’origine dell’app. La scelta mantiene compatibile
il visore Chrome nell’iframe e le immagini nell’elemento `img` della console.
Riferimento: [implementazione del visore PDF Chromium](https://chromium.googlesource.com/chromium/src/+/b6f88b13241ce96f0572540b0cdfd46d04ff3412).

Il worker PDF riusa un solo thread per istanza, con coda massima di quattro lavori, heap
192 MiB sul limite attuale di 4 MiB e timeout di 15 secondi per lavoro, incluso l’avvio a
freddo. Timeout/OOM terminano il thread e producono 503; il parser riparte al lavoro
successivo. Un worker inattivo viene chiuso dopo 30 secondi. La factory Node caricata a
runtime evita la trasformazione del costruttore da parte di Turbopack; entrambi i file CJS
sono inclusi nel tracing Next.

La manutenzione globale è soltanto un job autenticato (`GET /api/cron/maintenance`),
con cooldown anche dopo gli errori. Per Vercel configurare il Cron con quel percorso e
`CRON_SECRET`; per Node chiamarlo da uno scheduler. L’app non esegue il purge prima del
login o durante i turni del cittadino. Resta il tentativo immediato sul singolo file appena
eliminato, con tombstone persistente e backoff in caso di errore.

Con Node/Hono `transport: "node"` dichiara la disponibilità del socket nei binding;
`createApp` va chiamato prima di aprire il listener. Fetch/Next non offre quel binding:
serve un proxy fidato o un adattatore `clientAddress`. La configurazione senza una fonte
attendibile viene rifiutata durante l’inizializzazione. Gli header non fidati sono ignorati.
Riferimento: [binding e indirizzo remoto in Hono](https://hono.dev/docs/helpers/conninfo).
