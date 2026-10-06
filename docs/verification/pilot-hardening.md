# Backend: verifica prima del pilota

Audit locale del 6 ottobre 2026, branch `fix/pilot-hardening`, base
`3ce36156a98556725121ecdd9aa2507a38f4af9a` (PR #31). Dati esclusivamente sintetici.
Nessun commit, push, deploy o invio a fornitori. `packages/contracts` invariato.
L'unico file frontend modificato è la route API consentita: registra `after()` e
riserva 120 secondi di durata all'handler e ai lavori successivi alla risposta.

## Prestazioni riproducibili

`packages/api/src/pilot-performance.test.ts` genera in PGlite **2.000 pratiche,
20.000 documenti e 8.000 eventi**. Un CAF sintetico, un operatore assegnatario,
1.800 pratiche storiche e 200 del gennaio 2027; dieci documenti per fascicolo.
I metadati sono realistici, i file non sono conservati: gli export esportano il
fascicolo, non i contenuti binari. Non è un test di carico concorrente o una stima
convalidata della capacità del servizio PostgreSQL/Blob di produzione.

Ogni endpoint ha un riscaldamento e cinque campioni; la tabella usa la mediana
wall-clock, includendo middleware, sessione, serializzazione e lettura della risposta.
Le query sono contate con il logger Drizzle, senza stampare SQL o parametri personali.
Il logger non è abilitato nel runtime di produzione. L'export comprende l'audit GET.

Ambiente: macOS arm64, Node 25.8.2, pnpm 10.28.0, PGlite 0.3.16.

| Endpoint                | Query prima → dopo | Mediana prima → dopo (ms) |
| ----------------------- | ------------------ | ------------------------- |
| Coda, 50 pratiche       | 11 → 11            | 19.98 → 15.42             |
| Fascicolo, 10 documenti | 13 → 12            | 3.87 → 3.42               |
| Metriche gennaio 2027   | 7 → 7              | 61.02 → 6.48              |
| Export JSON             | 14 → 14            | 4.50 → 3.89               |
| Export PDF              | 14 → 14            | 87.08 → 71.15             |

La coda era già priva di N+1: resta a 11 query per pagine da 1, 50 e 100 pratiche.
Il fascicolo riutilizza gli operatori della timeline per l'assegnatario, eliminando
una query. L'export perde quella query e guadagna il controllo del bucket operatore:
il totale resta 14 nel benchmark locale senza IP di trasporto. In produzione con
IP fidato c'è anche il bucket IP, quindi una query aggiuntiva per export.
Le metriche restano a sette query ma leggono solo pratiche create/inviate o con
verifica completata nel periodo: 200 righe invece di 2.000 in questa fixture.
Gli eventi passano da 8.000 a 400 pertinenti (richiesta e completamento); i conteggi,
le richieste precedenti al periodo e l'ultima verifica nel periodo mantengono la
semantica coperta da `routes.test.ts`. L'aggregazione giornaliera usa mappe anziché
ripercorrere tutti i fascicoli per ogni giorno.
Le richieste di integrazione scrivono tutte le revisioni in un unico upsert, senza
una query per voce. Non è stato inventato un N+1 sui quattro endpoint misurati.

Il cursore usa `(updatedAt, id)` in ordine decrescente. Il test attraversa le 2.000
pratiche con timestamp uguali: nessun duplicato o salto. È una coda viva, non uno
snapshot: modifiche concorrenti possono spostare una pratica prima del cursore;
un aggiornamento della coda ricarica la prima pagina.

## Indici e migrazioni

`0005_lame_virginia_dare.sql`: indici per organizzazione + aggiornamento/ID,
sportello, pratica, assegnatario, creazione, invio; invio per sportello; evento per
pratica/tipo/istante e indice parziale dei documenti `processing`.
`0006_condemned_trish_tilby.sql`: `pg_trgm`, GIN per riferimento e per l'esatta
espressione nome/cognome usata dalla ricerca; riduce la scadenza delle sessioni
preesistenti a non oltre 30 minuti dal rilascio.

Per i filtri combinati PostgreSQL può scegliere l'indice più selettivo e filtrare
le altre condizioni: non vengono create tutte le combinazioni possibili. I termini
di ricerca sotto tre caratteri possono comunque richiedere una scansione del tenant.
Il benchmark verifica con `EXPLAIN` la disponibilità degli indici; per questa
fixture omogenea imposta `enable_seqscan=off` **solo dopo le misure**, poi lo ripristina.
Questo prova la utilizzabilità, non la scelta del planner di produzione.
I piani sono in `pilot-hardening-benchmark.json`. Eseguire `ANALYZE` e confrontare
`EXPLAIN (ANALYZE, BUFFERS)` su staging con distribuzione e cardinalità reali.

PGlite registra il bundle `pg_trgm` incluso nella versione installata; PostgreSQL
richiede l'estensione e il privilegio per crearla nella migrazione. Eseguire le
migrazioni prima del rilascio, fuori dal picco: la creazione degli indici acquisisce
lock, non usa `CONCURRENTLY` dentro la transazione Drizzle.

## Upload e affidabilità

La lettura del body usa un TransformStream che conta i byte effettivi, anche senza
Content-Length o con valore falsato. Il multipart viene materializzato una volta
per usare File/AI/parser: 4 MiB per file più 128 KiB di envelope, quattro upload
contemporanei per istanza; nessuna raccolta preventiva di tutti i chunk nel middleware.
Sono rimosse copie evitabili per sniffing, Blob e risposta file. Non è uno storage
streaming end-to-end: File, parser e AI richiedono ancora un buffer limitato.
Il fascicolo ha un limite atomico di 60 documenti e **120 MiB complessivi**.

Nel runtime Next, il commit salva documento `processing` prima della risposta;
`after()` esegue l'AI successivamente. La manutenzione recupera fino a quattro
lavori vecchi di almeno due minuti. L'abbinamento iniziale usa la voce richiesta o
l'euristica del nome; l'analisi non sovrascrive successive assegnazioni dell'utente.
Il fallback dell'AI viene salvato esplicitamente, non presentato come verifica.
Un documento eliminato mentre il lavoro aspetta non viene ricreato.

Un lease di cancellazione persistito **prima** dello storage segue anche upload
interrotti o risposte remote ambigue; il commit documento rimuove il lease nella
stessa transazione. Il lease diventa eliminabile dopo dieci minuti. Un fallimento
lascia il file tracciato per il retry. La cancellazione di file ha già backoff
1/2/4/... minuti, fino a un'ora; il lotto interrompe l'avvio di nuovi tentativi
dopo 20 secondi. Il recupero analisi interrompe l'avvio di nuovi lavori dopo 45
secondi; un lavoro già iniziato può ancora terminare. Configurare manutenzione
**ogni minuto** per recuperare un backlog, e verificare la durata consentita dal piano.

Gateway: timeout totali 12/18/8 secondi per intake/analisi/traduzione; intake e
traduzione hanno un retry SDK con backoff, analisi zero retry per non duplicare
un invio pesante nel percorso rapido. Una deadline esterna copre anche provider
che non terminano. Blob: AbortSignal e deadline di 15 secondi per operazione,
lettura file limitata a 4 MiB; i retry con backoff sono quelli dell'SDK installato,
limitati dalla deadline. Una scrittura confermata tardivamente viene cancellata;
il lease resta la protezione persistente dopo un arresto del processo.

`closeRuntimeDatabase()` blocca nuovi ingressi API, attende richieste e lavori
`after()` già registrati, quindi chiude il DB una sola volta. Il test su PGlite
persistente sospende una transazione dopo la prima scrittura, avvia lo shutdown,
poi prova commit e rollback: dopo la riapertura ci sono entrambi i record oppure
nessuno. Non prova SIGKILL, crash macchina o il drain del server HTTP di Next.
`GET /api/health` prova DB e put/get/delete di due byte sintetici nello storage:
cache/coalescenza dieci secondi, deadline tre secondi, 503 ApiError senza dettagli.
La coalescenza è per istanza; il proxy deve limitare anche i probe esterni.

## Prove e confini

- `pilot-security.test.ts`: matrice cross-tenant per lettura/modifica/cancellazione
  pratica e note, revisioni, integrazioni, file/documenti, export JSON/PDF,
  operatori/reset, sportelli, filtri e metriche. Nessun accesso storage/AI sulle
  risorse estranee. Origin assente/esterno, multipart e Host falsato; revoca,
  rotazione, logout, cookie, header, token 32 byte e quote export/traduzione.
- `pilot-upload.test.ts`: PDF con JavaScript e allegati nei object stream, MIME
  discordante, dimensioni immagini, nomi file, body oltre limite, analisi differita,
  recupero dopo riavvio, cancellazione concorrente, errore storage e lease recuperato,
  risposta fallita dopo commit e rifiuto del quinto upload contemporaneo.
- `storage.test.ts`: traversal, symlink nei componenti e nel file finale, permessi
  0600, probe e cancellazione idempotente. Non è una difesa contro un processo locale
  privilegiato che altera la directory durante la syscall.
- `blob-storage.test.ts`: SDK simulato, accesso privato, AbortSignal, limite di
  lettura, deadline anche durante retry e cleanup di successo tardivo. Nessun test
  live sul fornitore o invio di documenti.
- `pilot-reliability.test.ts`: atomicità durante drain, DB/storage non disponibili,
  coalescenza e risposta health senza dettagli.
- `app.test.ts`, `administration.test.ts`, `ai.test.ts`, `pdf-pages.test.ts`:
  scadenza inattività/assoluta, revoche amministrative, logging, rollback, retention,
  timeout/OOM del parser e fallback AI senza perdere il turno.

Restano da applicare e verificare lato web gli header e lo shutdown proposti sotto.
Il frontend mostra già `processing`, ma ricarica al cambio di visibilità: aggiungere
polling breve mentre esistono documenti in analisi per aggiornarli senza cambiare scheda.
La preview PDF via URL ora riceve un allegato: usare download o un viewer isolato
basato su Blob, senza ripristinare PDF inline sullo stesso origin.
Il recupero cron e il lifecycle serverless richiedono una prova sul deployment.
Malware, struttura completa/decodifica immagini e PDF con contenuti non coperti dal
controllo degli oggetti richiedono scansione/sandbox: nessuna attestazione antivirus.

## Header lato web da applicare

Esempio da integrare in `next.config.ts`, solo per pagine (lasciare gli header API
al backend). È una CSP statica compatibile con gli script inline di Next; per
eliminare `unsafe-inline` servono nonce per richiesta e rendering coerente, che
non si ottengono con il solo `headers()` del config.

```ts
const pageCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src 'self' blob:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

// Aggiungere alla configurazione esistente; produzione HTTPS.
async function headers() {
  if (process.env.NODE_ENV !== "production") return [];
  return [
    {
      source: "/((?!api(?:/|$)).*)",
      headers: [
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Content-Security-Policy", value: pageCsp },
      ],
    },
  ];
}
```

Non aggiungere analytics/replay alle pagine capability. Oscurare segmenti token
nei log del proxy e confermare `no-referrer` sui documenti HTML, non soltanto sulle API.
Verificare console, cittadino, upload, font e download in un browser di staging.
[Next, CSP](https://nextjs.org/docs/app/guides/content-security-policy).

## instrumentation.ts da applicare

Next 16.3.8 installato registra propri handler SIGTERM/SIGINT e chiama `process.exit`
dopo il suo drain HTTP (`next/dist/server/lib/start-server.js`). `register()` non
espone un hook pubblico di teardown. Un secondo listener concorrente non garantisce
che il DB venga chiuso prima di quell'exit.
Per un **host Node supervisionato**, impostare `NEXT_MANUAL_SIG_HANDLE=1` **prima
che Next parta**, drenare il traffico nel proxy/host e usare questo file in
`apps/web/src/instrumentation.ts`. Il codice gestisce il drain backend; per il drain
HTTP completo usare un custom host che chiude il listener prima di questa funzione.
Non impostare questa variabile su Vercel: i segnali non sono un lifecycle affidabile
per le funzioni, e transazioni/lease/cron costituiscono il recupero persistente.

```ts
export async function register() {
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    process.env.NODE_ENV !== "production" ||
    process.env.VERCEL === "1"
  )
    return;
  if (process.env.NEXT_MANUAL_SIG_HANDLE !== "1") return;
  const key = Symbol.for("avanti.shutdown.handlers");
  const state = globalThis as Record<symbol, boolean | undefined>;
  if (state[key]) return;
  state[key] = true;
  const { closeRuntimeDatabase } = await import("@avanti/api");
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    void closeRuntimeDatabase().then(
      () => process.exit(0),
      () => {
        console.error({ event: "database_shutdown_failed" });
        process.exit(1);
      },
    );
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
}
```

Impostare nel supervisore un periodo di grazia sufficiente per lavori già registrati
(almeno la durata massima dell'handler); un SIGKILL non esegue cleanup.
[Next, instrumentation](https://nextjs.org/docs/app/guides/instrumentation).

## Controlli finali

| Comando                    | Esito locale                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| `pnpm audit --prod --json` | PASS: 234 dipendenze, zero vulnerabilità e zero soppressioni                                     |
| `pnpm format:check`        | PASS: tutti i file conformi                                                                      |
| `pnpm check`               | PASS: 15/15 task; 239 test API, 12 DB, 490 core, 34 web (775); 6 task da cache                   |
| `pnpm build`               | PASS: eseguito una sola volta, 2/2 task senza cache, Next produzione completato in 10,95 secondi |
| `git diff --check`         | PASS                                                                                             |

Turborepo segnala accessi cache non permessi dal sandbox e nessun output per il
build API (`tsc --noEmit`); i comandi sono comunque terminati con exit code 0.
Nessuna modifica alla configurazione Turbo per silenziare questi avvisi.
Build e check usano Node 25.8.2 su macOS; staging/PostgreSQL/Blob/browser/scheduler
non eseguiti in questa sessione. HEAD resta quello iniziale, senza commit.

Proposte di commit, senza eseguirle:

1. `fix(api): harden pilot authentication, uploads and runtime recovery`
2. `perf(db): index pilot queues and narrow metrics queries`
3. `docs(security): record pilot audit evidence and web integration steps`
