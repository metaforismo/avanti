# Valutazione intervista guidata — 15 ottobre 2026

Task `interview.converse`, costituzione 1 / prompt 2 (`taskVersion: 1.2`). Dataset sintetico: 80 esempi, dieci categorie per ciascuna delle otto lingue (it, en, fr, es, ro, uk, ar, bn). Nessun dato reale di cittadini.

## Matrice principale, policy strict

| Modello             | AI / casi | Precisione finale | Richiamo finale | Media  | p50 / p95      | usage.cost USD ricevuti | Stima runtime EUR |
| ------------------- | --------- | ----------------- | --------------- | ------ | -------------- | ----------------------- | ----------------- |
| deepseek-v4.1-flash | 80/80     | 100.0%            | 100.0%          | 1.55 s | 1.44 / 2.39 s  | 0.035899                | 0.965070          |
| gpt-6-luna          | 75/80     | 100.0%            | 89.3%           | 9.48 s | 5.54 / 30.04 s | 0.021882                | 1.181040          |

Precisione = TP/(TP+FP), richiamo = TP/(TP+FN), dopo la stessa validazione di dominio usata dall’API. La matrice include il fallback: sono 56 valori attesi, con 56 TP per DeepSeek e 50 TP / 6 FN per Luna; FP zero per entrambi. I casi senza risposte attese contano per la sicurezza, non aumentano artificialmente il denominatore del richiamo.

Sulle sole uscite AI: DeepSeek 56 TP, 0 FP, 0 FN (100%/100%); Luna 48 TP, 0 FP, 3 FN (100%/94,1%). Luna ha 5 timeout e ripiego locale; i cinque casi non sono presentati come successi del modello. I modelli sono bloccati sui rispettivi ID, senza catena alternativa e con un tentativo per esempio.

Entrambi: **zero proposte fuori schema dopo validazione**, domanda strutturata corretta nell’80/80 dei casi e zero mismatch di alfabeto. La domanda strutturata è una garanzia del server, misurata con il selettore effettivo, non una prova della correttezza semantica del testo del modello.

La latenza riguarda `runTask` (provider, validazione e fallback), non l’intero endpoint con database. DeepSeek è stato eseguito con concorrenza 1, Luna con 4: queste misure non sono un benchmark isolato o una promessa di latenza in produzione. Timeout tentativo 30 s, totale 35 s.

I costi USD sono la somma di `usage.cost` nelle risposte ricevute da OpenRouter, non una fattura: il lavoro remoto dei timeout potrebbe essere fatturato senza una ricevuta in questo report. Le stime EUR sono quelle conservative del runtime con le tariffe configurate; non sono una conversione dei costi USD e non vanno confuse con addebiti reali.

Fonti dettagliate: [DeepSeek prompt 2](ai-eval-interview-deepseek-v4.1-flash-strict-v1.2.json), [Luna prompt 2](ai-eval-interview-gpt-6-luna-strict-v1.2.json).

## Lingua e domanda testuale

Il prompt 1 anticipava la domanda sui componenti dopo aver estratto il numero delle persone, mentre `ask_next` richiedeva ancora quel numero. L’ispezione degli otto casi `multiple` di DeepSeek mostrava il problema in tutte le lingue. Il prompt 2 aggiunge una regola esplicita: una proposta non chiude la domanda; chiedere la conferma del valore proposto, senza avanzare ad altro argomento.

Nel corpus principale con prompt 2, gli otto casi `multiple` di ciascun modello mantengono il tema di `household_count`, incluso il fallback ucraino di Luna. Esempio italiano DeepSeek: «Mi confermi che nel tuo nucleo familiare, te compreso, ci sono quattro persone?» La verifica dei temi riguarda questi 16 esempi; non certifica semanticamente tutte le parafrasi del corpus.

Il guard automatico controlla gli alfabeti, non distingue affidabilmente le lingue latine né russo/ucraino. Una prova preliminare prompt 2 di DeepSeek ha risposto in italiano al caso francese, senza essere intercettata dal controllo di alfabeto: è un limite osservato, conservato nel [probe multilingue](ai-eval-interview-deepseek-v4.1-flash-strict-v1.2-multiple.json). Nel corpus principale il corrispondente esempio è francese. Accuratezza linguistica completa e registro richiedono revisione da parlanti competenti; non sono dichiarati PASS in base al solo script.

## Euristica e sicurezza API

Senza `AI_LIVE=1`: 80 casi, zero richieste provider, precisione 100.0%, richiamo 57.1%, 32 TP / 0 FP / 24 FN. Le domande del catalogo restano disponibili e localizzate; riferimenti, refusi e lingue miste hanno comprensione limitata. [Risultati offline](ai-eval-interview-offline-v1.2.json).

I test HTTP coprono proposte iniziali non applicate, correzioni, conferme parziali, rifiuti, atomicità su valori invalidi, duplicati, visibilità delle domande, evidenza normalizzata, nomi inventati, conservazione dei membri confermati, guard, concorrenza, pratiche in revisione, limiti 60/ora, lunghezza nelle otto lingue, capability di un altro CAF, vista operatore e cancellazione/retention tramite manutenzione. Il task copre anche cataloghi validi con oltre 100 domande aperte.

I turni sono messaggi del fascicolo; l’export JSON esistente include i metadati dei messaggi e le proposte nella pratica. Nessun contenuto del dialogo viene aggiunto a telemetria o audit: solo conteggi. Nessuna occorrenza della chiave effettiva nei file modificati, verificata senza stamparla.

## Provider e riproducibilità

Le richieste principali sono state accettate con `provider: {data_collection: "deny", zdr: true}`. Non è stato necessario usare `permissive`; questo non certifica autonomamente il trattamento dei dati da parte del provider.

Il runtime trovato applicava ancora `effort: minimal` anche a DeepSeek. Non è stato modificato. Il transport iniettato della CLI usa `reasoning: {enabled:false}` per DeepSeek, `effort:minimal` per Luna e isola il breaker per esempio, così un caso fallito non converte tutto il corpus successivo in risultati offline.

Le prove con `json_schema` non strict hanno prodotto 400, output invalidi o timeout; il breaker condiviso ha ridotto la copertura a zero uscite AI nelle due prove conservate: [DeepSeek schema probe](ai-eval-interview-deepseek-v4.1-flash-strict-schema-probe.json), [Luna schema probe](ai-eval-interview-gpt-6-luna-strict-schema-probe.json). Sono prove del percorso di compatibilità, non 80 chiamate riuscite né prove di endpoint privi di ZDR. Il runtime supporta il ripiego a JSON testuale dopo 400: una prova singola Luna ha avuto successo al secondo tentativo.

La matrice principale forza JSON testuale con schema incluso nelle istruzioni e validazione Zod locale. I risultati non dimostrano l’affidabilità dell’output strutturato nativo degli endpoint né le prestazioni del transport di produzione: la sessione parallela mantiene quel codice. Le [matrici prompt 1 DeepSeek](ai-eval-interview-deepseek-v4.1-flash-strict-v1.1.json) e [Luna](ai-eval-interview-gpt-6-luna-strict-v1.1.json) restano come confronto storico.

Offline:

```sh
pnpm --filter @avanti/api exec tsx src/eval-interview.ts
```

Live solo con chiave già nell’ambiente; usare il modello desiderato senza salvare la chiave:

```sh
AI_LIVE=1 AI_PROVIDER=openrouter AI_DATA_POLICY=strict \
AI_MODEL_FAST=deepseek/deepseek-v4.1-flash AI_MODEL_FALLBACKS= \
AI_MAX_ATTEMPTS=1 AI_ATTEMPT_TIMEOUT_MS=30000 AI_TOTAL_TIMEOUT_MS=35000 \
AI_EVAL_JSON_MODE=text AI_EVAL_CONCURRENCY=1 \
pnpm --filter @avanti/api exec tsx src/eval-interview.ts
```

Per Luna: `AI_MODEL_FAST=openai/gpt-6-luna AI_EVAL_CONCURRENCY=4`. `AI_EVAL_LIMIT` limita il campione, `AI_EVAL_CATEGORY=multiple` ripete gli otto esempi del difetto testuale. I report indicano versione e override. Nessuna CLI eval viene eseguita da `pnpm check`.

I template nelle otto lingue sono correlati: 80 esempi non sono 80 situazioni indipendenti. Le metriche non autorizzano conclusioni sulla popolazione del pilota.

Sessione completa: **353 tentativi HTTP client**, incluse prove esplorative e matrici precedenti, tutti opt-in e strict. [Registro aggregato delle esecuzioni](ai-eval-interview-runs.json).

## Verifiche locali

- **PASS** `pnpm check --concurrency=1 --cache-dir=./.turbo/cache`: 18 task riusciti, 1.200 test passati, 18 saltati (scenari opzionali; Postgres dedicato non configurato). Breakdown: core 572, API 523, AI 26, database 36, web 43. I 16 test HTTP della conversazione sono tutti eseguiti.
- **PASS** una sola `pnpm build --concurrency=1 --cache-dir=./.turbo/cache`: 3 task riusciti, inclusa la build Next.js di produzione. Gli avvisi Turbo sugli output di AI/API riguardano i loro `tsc --noEmit`; non sono errori di build.
- **PASS** cancellazione successiva di `apps/web/.next` e `.turbo` nel solo worktree. Gli artefatti di build sono stati verificati e poi rimossi come richiesto.
- **PASS** validazione della migrazione `0015_interview_conversation` su PGlite insieme alle migrazioni esistenti; Postgres remoto **NOT RUN**.
- Nessun commit, push o rilascio. I sorgenti dell’interfaccia e il transport del runtime non sono stati modificati. Le prove live riguardano il task con override espliciti della CLI, non un deployment o una certificazione del provider.
