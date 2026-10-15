# Prestazioni API: volume e confronto locale

PASS locale: seed deterministico e banco ripetibile, 5.000 pratiche, traversata integrale dei cursori senza duplicati o perdite. Nessuna misura di capacità concorrente o di produzione è implicita in questi numeri.

## Riproduzione

```bash
# Solo PGlite demo locale; fermare il server che usa lo stesso .data/pglite.
pnpm db:seed:volume                 # default 5.000 pratiche aggiuntive alle 10, se già presenti
pnpm db:seed:volume --cases 10000    # numero totale di pratiche volume da assicurare, non incremento

# Indipendente dal database del server: DB nuovo in memoria, eliminato alla chiusura.
pnpm bench:api --cases 5000 --samples 20 --output docs/verification/performance-api-run.json
```

`--output` è relativo alla radice del repository, oppure assoluto. Il benchmark è uno script separato: non viene eseguito da `pnpm check`. I test di regressione su una coorte piccola restano in `check`.

Il seed riusa `assertDemoSeedAllowed` e il bootstrap del seed ordinario: rifiuta `NODE_ENV=production`, `VERCEL`, `VERCEL_ENV`, `DATABASE_URL` non vuota e database con organizzazioni diverse da `demo-caf-milano`. Nessuna cancellazione, sovrascrittura delle pratiche esistenti o creazione di file. Una transazione ogni 100 pratiche rende il comando riprendibile; i figli vengono inseriti solo per le pratiche appena create, preservando modifiche e rimozioni fatte nella demo. Il limite CLI è 1–100.000. Il comando di volume non crea anche i dieci PDF del seed ordinario.

Seed fisso `202701`, clock `2027-01-15T12:00:00Z`, avvii distribuiti nei 180 giorni precedenti. Sei stati, otto lingue, due sedi, nuclei da 1 a 4 componenti, 1–2 conti, checklist ISEE prodotta dal core, documenti parziali o verificati, sei messaggi per pratica ed eventi coerenti con gli stati. Identificativi, risposte, date e metadati sono riproducibili; il salt delle credenziali demo rimane casuale. I token prevedibili sono esclusivamente demo locale. Gli `storageKey` `volume-metadata-only/...` non corrispondono a file scaricabili; l'upload misurato usa invece un piccolo JPEG reale già nel repository.

## Metodo e macchina

Rilevazione del 15 ottobre 2026 nel worktree `perf-api`, branch `codex/perf-api`. Backend prima: `cc164f290d718bf83eb72ad234dfeddad78c271b`. Backend dopo: modifiche di questo worktree a `ai.ts`, `dossier.ts`, `operator.ts`, `pilot-report-export.ts`. Stesso harness e stesso corpus nei due run; per la baseline sono stati temporaneamente ripristinati solo questi quattro file dal commit, poi ripristinate le modifiche prima del run successivo. Nessun commit o cambio di branch.

Apple M3, 8 core, 16 GiB RAM, macOS/Darwin 25.5.0, Node v25.8.2. Mac condiviso con altro lavoro, disco quasi pieno; niente download o server esterni. Le variazioni di pochi millisecondi e soprattutto le code p95 risentono del carico della macchina. Non attribuire miglioramenti degli endpoint invariati a queste modifiche.

Hono Fetch in-process, stesso middleware di produzione, autenticazione operatore reale con sessione demo; percorsi cittadino senza cookie operatore. Una richiesta di warmup e 20 campioni sequenziali per endpoint. Timer fino al consumo integrale del body; byte del body non compresso. p50/p95 a rango più vicino (`ceil(n*p)-1`); campioni grezzi inclusi negli artefatti. I bucket rate limit sono svuotati e i lavori background drenati fuori dal timer: questo misura la latenza delle operazioni ammesse, senza simulare il traffico o la throttling policy. L'upload restituisce `processing`, l'analisi è eseguita fuori dal tempo della risposta, come con `after()`.

Corpus iniziale: 5.000 pratiche, 29.997 metadati documento, 30.000 messaggi, 14.994 revisioni e 14.997 eventi. Dopo le letture con audit e i 21 upload: 30.018 documenti e 15.144 eventi, uguali nei due run. `seedVolume.elapsedMs`: 10.251 ms prima, 10.313 ms dopo per inserimenti e ANALYZE (escluso bootstrap). Il benchmark conserva i metadati nel DB in memoria e i byte upload in `MemoryStorage`.

Gli artefatti [prima](performance-api-before.json) e [dopo](performance-api-after.json) contengono misure, campioni, cardinalità, macchina e piani. Gli `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` rigiocano le SELECT realmente catturate con i rispettivi parametri dopo i campioni. `explainSelectMs` è la somma dei tempi di quelle singole riesecuzioni SQL, non il p50 DB della richiesta; esclude scritture, mapping Drizzle, trasferimento, calcolo e JSON. Nessun `enable_seqscan=off`, VACUUM forzato o indice aggiunto per far passare un piano.

## Tempi a caldo

Tutti i tempi sono in millisecondi. La colonna byte è il p50 del body, il conteggio query comprende le istruzioni catturate dal logger Drizzle, incluse autenticazione e scritture oltre alle SELECT; esclude BEGIN/COMMIT interni al driver e non rappresenta round trip di rete. Per le righe senza modifiche funzionali, le differenze sono osservazioni del run, non ottimizzazioni rivendicate.

| Percorso                                     | p50 prima → dopo | p95 prima → dopo | Byte prima → dopo | Query prima → dopo |
| -------------------------------------------- | ---------------: | ---------------: | ----------------: | -----------------: |
| Coda 50 righe                                |    20.64 → 16.03 |    22.92 → 16.99 |   46,412 → 46,412 |            11 → 10 |
| Coda: stato + sede + assegnatario + pratica  |    18.21 → 13.88 |    19.33 → 15.00 |   47,516 → 47,516 |            11 → 10 |
| Coda: ricerca nome                           |    29.16 → 24.90 |    73.77 → 26.45 |   46,465 → 46,465 |            11 → 10 |
| Coda: ricerca riferimento                    |    15.78 → 15.38 |    16.49 → 16.23 |     1,051 → 1,051 |            11 → 10 |
| Coda: seconda pagina via cursore             |    18.20 → 14.21 |    18.98 → 14.96 |   46,425 → 46,425 |            11 → 10 |
| Fascicolo                                    |      4.79 → 4.56 |      6.11 → 5.20 |   44,822 → 44,822 |            14 → 14 |
| Metriche 30 giorni                           |    13.35 → 13.69 |    14.54 → 14.71 |     2,105 → 2,105 |              7 → 7 |
| Metriche 90 giorni                           |    28.69 → 28.55 |    30.21 → 29.61 |     5,111 → 5,111 |              7 → 7 |
| Rapporto pilota JSON, 90 giorni              |    28.42 → 27.92 |    32.44 → 30.23 |     8,748 → 8,748 |            12 → 12 |
| Stato sistema                                |      6.67 → 5.05 |     16.68 → 5.70 |     2,865 → 2,865 |            11 → 11 |
| Registro, 50 righe                           |      2.98 → 2.58 |      4.53 → 2.91 |   17,131 → 17,131 |              6 → 6 |
| Registro: azione + operatore + date          |      2.89 → 2.62 |      3.36 → 2.79 |   18,831 → 18,831 |              6 → 6 |
| Registro: riferimento                        |      2.08 → 1.96 |      2.35 → 2.27 |     1,370 → 1,370 |              6 → 6 |
| Registro CSV, 15 giorni                      |    19.53 → 18.59 |    20.45 → 19.05 | 220,340 → 220,340 |              8 → 8 |
| Cittadino: lettura                           |      2.10 → 2.01 |      2.35 → 2.42 |   20,897 → 20,897 |              7 → 7 |
| Cittadino: risposta intervista               |      4.62 → 4.64 |      5.27 → 5.41 |   20,923 → 20,923 |            14 → 14 |
| Cittadino: riassegnazione metadati documento |      5.01 → 5.19 |      5.33 → 6.12 |   21,499 → 21,499 |            17 → 17 |
| Cittadino: upload JPEG + metadati            |      8.56 → 9.17 |     9.86 → 10.77 |   33,357 → 33,357 |            27 → 27 |

L'upload aggiunge documenti ad ogni campione, quindi il body cresce da 23.268 a 44.567 byte in entrambi i run; gli artefatti includono minimo e massimo. Le letture del fascicolo appendono eventi audit, perciò anche la timeline cresce. La ricerca nome prima ha un campione p95 da 73,77 ms: non è una riduzione strutturale del costo SQL, che resta circa 12 ms sulle due query principali. Coda: p50 −22,3%, p95 −25,9%; seconda pagina p50 −21,9%. Le dimensioni delle risposte della coda sono identiche, perché il contratto era già ridotto ai campi della lista.

## Avvio

Cinque processi Node nuovi per run. Mediane in ms; non sono p95 attendibili su soli cinque campioni. Il timer import parte all'ingresso dello script, dopo l'avvio di Node/tsx. Nessun server Next né rete. La prima health usa `createApp` con un nuovo DB PGlite in memoria già pronto, mentre la riga totale include il suo avvio e le migrazioni. Il primo accesso alla coda sul corpus di volume è una misura separata e singola, con moduli e DB già inizializzati.

| Misura                                           |   Prima |    Dopo |
| ------------------------------------------------ | ------: | ------: |
| Import `@avanti/api`                             |  939.07 |  655.62 |
| Avvio PGlite in memoria + migrazioni + createApp |  873.74 |  705.89 |
| Prima richiesta health, dopo DB pronto           |   16.01 |   14.91 |
| Import → prima risposta health                   | 1828.35 | 1406.98 |
| Prima coda sul corpus, singolo campione          |   45.01 |   38.78 |

Import API: −30,2%. Il load hook Node osserva realmente i moduli caricati, inclusi ESM: `pdf-lib`, `fontkit` e `ai` presenti in tutti i processi prima, assenti in tutti i processi dopo. L'avvio PGlite resta la parte maggiore del cold start dopo la correzione; il suo codice non è cambiato e il suo calo osservato non viene attribuito all'ottimizzazione. Un cold start Vercel con Postgres ha costi diversi.

## Correzioni e diagnosi

- **Lavoro superfluo in coda.** Prima ogni riga generava tutta la vista cittadino, incluse domande, risposte leggibili e contatto, scartandone quasi tutto. Ora coda e cittadino condividono soltanto la preparazione della valutazione del fascicolo; il core calcola ancora gli stessi progressi e problemi. Documenti/revisioni sono raggruppati per pratica una volta, sedi e operatori indicizzati in Map, eliminando filtri ripetuti sugli array. Rimossa la lettura dell'organizzazione non necessaria per questa vista (FK garantita). La SELECT delle pratiche esclude hash della capability, note e stato UI dell'intervista.
- **Import pesanti.** L'export fascicolo importa il renderer PDF solo nel ramo PDF. Il CSV del rapporto non importa più il renderer PDF: `pilotReportPdf` carica PDF e renderer solo alla chiamata. L'SDK AI viene importato dentro il `try` solo con chiave configurata e operazione supportata, preservando fallback ed error handling. I byte font erano già letti al primo PDF; ora anche PDF/fontkit restano fuori dal percorso di avvio. I test esercitano ancora gli export Unicode e i fallback AI.
- **Nessun N+1 osservato.** La coda usa 10 query con limite 1 o 100, con documenti e revisioni letti a blocchi. Fascicolo, metriche, rapporto e registro hanno conteggi riportati nella tabella; non è stata aggiunta una cache per mascherare query.
- **Indici esistenti adeguati per coda e registro.** I piani naturali mostrano `cases_org_updated_idx` per la coda, gli indici documenti/revisioni per i figli, `events_org_time_id_idx`, `events_org_type_time_idx` e `events_org_reference_time_idx` nelle letture del registro. Non serve una migrazione per aggiungere duplicati.
- **Ricerca: costo residuo reale.** Il planner preferisce un Bitmap Heap Scan del CAF e filtra 5.000 righe per il riferimento selettivo (4.999 scartate) e per il nome (4.889 scartate), due volte per conteggi e pagina. Gli indici trigramma esistono. Una prova separata della riscrittura con `UNION` ha usato i GIN ma non ha migliorato in modo affidabile i tempi (riferimento ~7,0 → 10,7 ms, nome ~6,0 → 5,8 ms per SELECT): scartata. I piani principali e i tempi SQL restano negli artefatti; il probe esplorativo non è codice di prodotto.
- **Metriche/rapporto.** A 90 giorni sono ancora circa 28 ms p50. Le SELECT sono già proiettate e limitate al periodo/coorte; il resto include lettura/mapping di migliaia di righe, calcolo e serializzazione. Non c'è prova qui che un nuovo indice sia la soluzione. Nessun aggregato persistito o semantica KPI alterata.
- **Cache.** Le API misurate mantengono `no-store` (`private, no-store` per il rapporto). Contengono dati personali, capability, stato variabile o audit su GET. Una risposta 304 non eliminerebbe in sicurezza autorizzazione e audit; non è stata introdotta cache condivisa né un ETag incompleto. Il catalogo pubblico è fuori da questo banco e non è risultato un collo misurato.

Nessuna modifica a `packages/contracts`, nessuna migrazione e nessuna modifica a `apps/web/src`. Il payload esterno mantiene la stessa forma; l'ottimizzazione riguarda costruzione e letture interne della lista. Il nuovo subpath `@avanti/db/volume` è solo lo strumento per condividere il fixture fra CLI, benchmark e test, fuori dal barrel DB usato a runtime.

## Verifiche

- PASS: benchmark prima/dopo, status 200/201 verificato per tutti i campioni; 5.000 ID distinti nella traversata completa dei cursori.
- PASS: regressione coda con 240 timestamp identici, ordine ID discendente e pagine da 17, isolamento fra CAF, filtri combinati, ricerca senza distinzione maiuscole e con `%`, `_`, `\` letterali, cursore malformato, parità di ogni campo lista con i fascicoli corrispondenti (anche documenti falliti e pratica non classificata), payload strettamente conforme e query costanti fra 1 e 100 righe.
- PASS: seed con argomenti invalidi, ambiente produzione/remoto, CAF reale, idempotenza e preservazione di modifiche/rimozioni; test di import freddo, export PDF Unicode e fallback AI.
- PASS: `pnpm check`, 15 task riusciti; API 421 test, DB 31 test e 5 controlli Postgres saltati per assenza di `AVANTI_TEST_DATABASE_URL`. Core 572 e web 39 test riportati dalla cache Turbo. Nessun timeout e nessun retry necessario.
- PASS: unica esecuzione di `pnpm build` (29,3 s, Next.js 16.3.8), preflight locale, typecheck API e build web riusciti. Rimosso `apps/web/.next` (209 MiB) e verificato `.turbo` assente dopo la build, senza secondo build. Turbo ha emesso avvisi per permessi cache e output del build API (`tsc --noEmit`); nessun errore di build.

## Cosa resta da misurare

Prima del picco: ripetere su Postgres della versione del deployment con statistiche rappresentative, più CAF e selettività diverse; includere insert recenti e aggiornamenti mentre si consulta la coda. Il cursore attuale ordina `(updated_at DESC, id DESC)` e non crea uno snapshot multi-request: aggiornare una pratica fra due pagine può spostarla fuori dal seguito. I test garantiscono stabilità con timestamp uguali su dataset fermo, non una fotografia durante scritture concorrenti.

Separare in una prova di carico: 40 cittadini e più operatori concorrenti, attesa del pool Postgres (max 5), autenticazione/rate limit, rete/Next, upload realistici, parsing PDF, Blob privato e latenza AI configurata. PGlite in memoria non misura rete, round trip, pool o disco locale. Nessuna prova live di AI/Blob/produzione è stata eseguita. L'export registro resta limitato a 5.000 eventi e richiede filtri: il banco misura un export sotto soglia, senza aggirarla.

Se la ricerca domina su Postgres, confrontare i piani del filtro OR e il costo dei conteggi globali con una sola selezione riutilizzata; conservare ricerca letterale, isolamento e conteggi per stato. Valutare aggregazioni SQL per i KPI soltanto mantenendo coorti, eventi storici, fuso Europe/Rome e soppressione delle celle del rapporto. Il banco ora fornisce una base per questi confronti.
