# Revisione sicurezza e qualità — PR #78–#86

Base: `84d6e97`, ramo `codex/review-oct16`. Esaminati `git log --oneline -12`,
diff dei singoli rilasci e relativi chiamanti/test. Revisione locale con due
revisori indipendenti; nessun commit, push o modifica a `apps/web/src`.

| Gravità | Problema confermato e corretto                                                                                                                                                                                                                                                                                | Prova                                                                                                                                                                                    |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alta    | `/c/:token/conversation` ignorava `aiCitizenAssistant=false`: testo, risposte e storia potevano raggiungere il provider dopo la disattivazione del CAF. Ora usa il fallback locale.                                                                                                                           | `conversation.test.ts`: provider chiamato prima della fix, zero chiamate dopo; proposte locali conservate.                                                                               |
| Alta    | La stessa route non intercettava localmente emergenze e violenza. Ora risponde con gli avvisi esistenti 112/1522, azzera le proposte, registra solo l'avviso e non invia né persiste il racconto sensibile.                                                                                                   | Due regressioni in `conversation.test.ts`, rosse prima della correzione.                                                                                                                 |
| Alta    | Una consistency terminata tardi modificava `ai_attention` senza avanzare `updated_at`; una «quasi pronta» poteva restare accettabile nonostante nuove incongruenze. Ora si riverifica l'attenzione prima della pubblicazione e il trigger ritira i suggerimenti già pubblicati.                               | Due race in `near-ready.test.ts`; ritiro e rollback in `near-ready-invalidation.test.ts`. I chiamanti dopo consistency rileggono lo stato derivato mantenendo il vincolo sulla versione. |
| Media   | I GET AI `brief`, `consistency`, `dsu-prefill` e il ricontrollo near-ready non avevano quota operatore. Ora condividono il limite esistente del copilota, 60/ora; il report ha quello export, 20/minuto. Il budget mensile resta una protezione separata.                                                     | Quattro test di rifiuto prima di provider/cache/versione e un test del report, con `Retry-After`. Anche i cache hit consumano la quota HTTP.                                             |
| Media   | Letture simultanee del fascicolo eseguivano separatamente le stesse letture documentali prima della pubblicazione unica. Ora condividono la lease DB del copilota per caso/versione, anche tra istanze e worker. Il payload aggiunto contiene solo l'ID della valutazione.                                    | Tre GET concorrenti: prima 9 chiamate AI, dopo 3; una sola valutazione.                                                                                                                  |
| Media   | Il trigger `0020` generava versioni con microsecondi; cache, filtri SQL e giudizi ciechi usano istanti ISO ai millisecondi. La nuova `0021` normalizza il clock e avanza una sola volta le versioni frazionarie esistenti, ritirandone i segnali. Il timestamp del ritiro è separato dalla versione del caso. | Fixture `.123456Z`, uguaglianze SQL esatte, riparazione idempotente, cronologia e rollback atomico.                                                                                      |
| Media   | Il report legava un parametro SQL per ogni valutazione e ricercava ripetutamente tutto lo storico degli eventi. Ora usa un join filtrato per CAF e una mappa per valutazione.                                                                                                                                 | Test con due CAF e 30 versioni ciascuno: stesso primo esito, nessuna contaminazione, parametri della query eventi costanti.                                                              |
| Media   | Un errore del copilota successivo all'analisi documentale già salvata faceva fallire il lavoro e poteva lasciare promise rifiutate durante worker concorrenti. Ora il passaggio usa l'arricchimento recuperabile esistente.                                                                                   | `document-recovery.test.ts`: errore iniettato dopo l'analisi, documento salvato e lavoro concluso; test rosso prima della correzione.                                                    |

La `0020` rilasciata resta immutata. La `0021` è una migrazione forward; le sue
modifiche a policy, versioni, suggerimenti ed eventi partecipano alla stessa
transazione. Aggiornati journal/snapshot e test storici delle migrazioni, che
devono preparare solo le migrazioni precedenti a quella sotto test.
La precisione dei timestamp e il limite di 65.535 parametri sono documentati da
[PostgreSQL 17](https://www.postgresql.org/docs/17/datatype-datetime.html) e dai
[limiti ufficiali](https://www.postgresql.org/docs/17/limits.html).

**Da decidere — media:** `packages/api/src/near-ready.ts:402` assegna l'esito
finale corrente anche alle valutazioni storiche senza esito; il report
(`near-ready-metrics.ts:35`) lo usa per la prima valutazione. Dopo correzioni,
un fascicolo finalmente pronto può quindi migliorare la precisione del
suggerimento originario, anche dopo un giudizio cieco negativo. Occorre fissare
il criterio di verità per versione e la gestione dei giudizi discordanti.
La semantica delle etichette non è stata modificata durante questa revisione.

**Frontend, dubbio da verificare:**
`apps/web/src/components/console/dossier/dossier-chat.tsx:80` reinvia gli ultimi
quattro scambi senza filtrare `caseVersion`; fornire `history` evita il filtro
server delle sole risposte della versione corrente. Il prompt tratta comunque
la storia come dati non fidati: non è stato riprodotto un exploit. Proposta per
il frontend: omettere `history` oppure filtrarla sulla versione corrente.

Non sono emersi bypass IDOR nei nuovi endpoint: il CAF deriva dalla sessione e
`caseById` filtra l'organizzazione; report e uso AI richiedono admin. Le azioni
near-ready condividono autorizzazione e lock del caso. Le capability cittadino
sono verificate anche dopo lavoro lento, con lock per le scritture: link
scaduti/ruotati e doppio invio sono coperti dalle suite esistenti. Log, audit,
`ai_usage`, snapshot e cache sono stati seguiti fino alla persistenza; le nuove
snapshot non conservano letture letterali. Gli errori interni passano attraverso
il messaggio API generico. Questa è evidenza locale, non una garanzia esaustiva.

Prompt injection: verificati separazione dei blocchi non fidati, controlli di
schema, riferimenti ammessi e blocco credenziali su testo del cittadino,
documenti e storia operatore. Nessun exploit ulteriore riprodotto; il solo
riferimento valido non dimostra che ogni affermazione del modello sia vera.
Provider reali e nuove eval live non eseguiti.

**Verifica:** 17 regressioni aggiunte, più adeguamenti ai test delle migrazioni.
Comandi mirati: `pnpm --filter @avanti/api exec vitest run src/conversation.test.ts
src/copilot.test.ts src/near-ready.test.ts src/near-ready-metrics.test.ts src/document-recovery.test.ts` e
`pnpm --filter @avanti/db exec vitest run src/near-ready-invalidation.test.ts`.
Il check completo include anche le regressioni esistenti su autorizzazione,
injection, revoche, doppio invio, telemetria e prestazioni della coda.

Postgres nativo **BLOCKED**: PostgreSQL 17.11 installato, ma `initdb` fallisce
con `shmget: Operation not permitted`, anche configurando memoria `mmap`.
La suite di parità è pronta tramite `AVANTI_TEST_DATABASE_URL` su un database
locale sacrificabile con suffisso `_test`; qui quei test restano saltati.

Misure locali: PGlite in memoria, 5.000 pratiche/valutazioni e 15.000 eventi,
un warmup e cinque campioni sequenziali, risposta interamente consumata e
`EXPLAIN ANALYZE` naturale. Coda ordinaria p50/p95 102,9/108,1 ms; filtro near-ready
186,7/188,8 ms, entrambi 11 query. Report prima della correzione 439,4/509,4 ms,
con 5.000 parametri nella query eventi; dopo la correzione 161,0/163,2 ms e un
parametro. Nei piani della coda sono usati gli indici esistenti su organizzazione,
stato/versione, messaggi e valutazione per caso/versione; non sono stati aggiunti
indici senza prova. Dati in
[`security-quality-review-2026-10-16-performance.json`](security-quality-review-2026-10-16-performance.json).
Misure sintetiche, senza inferenze sulla latenza di Postgres remoto o del pilota.

**PASS:** `pnpm check` — 18 task riusciti (9 da cache); 1.481 test superati,
23 saltati, inclusi Postgres nativo ed eval live. `pnpm build` — 3 task riusciti,
Next.js/Turbopack completato. `git diff --check` e formattazione dei file modificati
verificati. Rimossi `apps/web/.next` e tutte le cartelle `.turbo` presenti nella
worktree; HEAD ancora `84d6e97`. Nessun file frontend o contratto modificato.

Commit proposti, non eseguiti:

- `fix(api): rispetta policy AI e gestisce localmente le emergenze`
- `fix(api): limita e coordina i controlli AI del fascicolo`
- `fix(db): ritira segnali obsoleti e normalizza le versioni near-ready`
- `perf(api): aggrega lo storico near-ready con query limitate al CAF`
