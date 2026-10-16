# @avanti/ai

Runtime ESM tipizzato; nessuna chiamata di rete durante import o costruzione. Provider e SDK
si caricano alla prima richiesta. Nessuna dipendenza dal database. `@avanti/core` resta puro.

```ts
import { AiRuntime, loadAiConfig, intakeTask } from "@avanti/ai";

const runtime = new AiRuntime(loadAiConfig(process.env)); // riusare per istanza
const result = await runtime.runTask(
  intakeTask,
  {
    text,
    language,
    practiceId,
    questions,
    now, // clock esplicito per il dominio
  },
  ctx,
);
// result: { output, engine, model, attempts, latencyMs, usage,
//           costEstimate /* EUR */, fallbackReason, retryReasons }
```

Per un cold start contenuto usare `@avanti/ai/config` all'avvio e import dinamico di
`@avanti/ai/runtime` e `@avanti/ai/tasks` quando servono. L'adattatore API segue questo percorso.

`Task<I,O>` contiene `id`, `version` (costituzione.compito), `tier`, schemi zod `input`/`output`,
`system(input)`, `data(input)` con contesto minimo, blocchi non fidati ed eventuale file,
`heuristic(input)`, `validate(output,input)`, `guardText(output)`, `language(input)`,
`languageText(output)`, `skip(input)` e `limits`. `generationSchema` opzionale restringe lo
schema remoto senza restringere il contratto locale dei fallback (per esempio, classificare
una pratica indisponibile per mostrare il messaggio di recupero). Il ripiego è sincrono e deve sempre rispettare
lo schema e produrre testo locale sicuro. Un input non valido solleva ZodError: l'API valida
prima coi contratti e restituisce ApiError, senza dettagli interni.

`citizen.assistant` (fast) e `speech.transcribe` (audio) sono definiti in `citizen-tasks.ts`.
I compiti operatore sono definiti in `operator-tasks`; `citizen.assistant` resta nel
perimetro della sessione cittadino. I prompt condivisi sono esportati. Usare la costituzione comune e versionare
ogni variazione del prompt. Le invarianti di dominio (ID, anni, citazioni) appartengono a
`validate`, non al provider. Lo schema deve poter essere convertito in JSON Schema da zod.

`TaskContext` fornisce `organizationId`, `reserve(ceilingEur,{id,version,model})` e
`record(metadata,reservationId?)`. Nessun contenuto arriva a `record`: soltanto task/versione,
modello/motore, tentativi, token, costo, latenza, motivo e contatore manipolazioni. In API
`observeAi` propaga il CAF con AsyncLocalStorage, senza stato globale mutabile per richiesta.
Fuori API, un contesto senza hook esegue senza contabilità persistente: il chiamante deve
fornire gli hook quando serve un budget. `Transport` e clock sono iniettabili per prove offline.

Retry: 429, 5xx, timeout e risposte vuote; backoff esponenziale con jitter. Errori di schema,
dominio o guard hanno una sola correzione. Un 400 con json_schema passa a JSON testuale con
validazione locale, senza allentare la policy dati. Tutte le chiamate, compresa correzione e
compatibilità schema, consumano `AI_MAX_ATTEMPTS`. Il totale include attesa e retry del
provider; la contabilità DB ha i timeout SQL del deployment. Nessuna garanzia di annullamento
del lavoro remoto dopo abort. Il breaker è per modello e istanza, con un probe dopo 30 s;
non coordina serverless distinti né osserva i tentativi nascosti del router OpenRouter.

Il costo è stimato da token e tariffe configurate in EUR/milione (default input 3, output 15).
Non è una fattura né un listino aggiornato. La prenotazione conservativa include schema,
input/file e tutti i tentativi. Se un tentativo non espone usage, si addebita la sua quota di
prenotazione. Catene esclusivamente `:free`/`openrouter/free` su OpenRouter valgono zero.
Prenotazioni di processi interrotti restano conteggiate: riconciliarle dopo verifica con il
provider, non cancellarle automaticamente. Le tariffe devono coprire i modelli scelti.

Valutazione: `pnpm ai:eval [--task intake.understand|interview.freeform|document.analyze|translate]
[--limit N]`. Offline per default; `AI_LIVE=1` abilita i provider. Dataset sintetico, 8 lingue,
226 casi, inclusi 152 casi cittadino multilingue; documenti immagine generati in memoria con sharp. Report JSON e Markdown in
`docs/verification/`, distinti per modalità. La precisione ignora solo i fatti laterali
`household_roles`/`household_relations`, non presenti negli ID del form. Per le traduzioni
non si dichiara accuratezza semantica automatica: serve revisione umana. Lingua: il guard
verifica alfabeti incompatibili; non certifica lingue latine né distingue russo e ucraino.
JSON valido riguarda l'uscita finale, incluso il fallback, non tutte le risposte del modello.

`pnpm ai:stress [--concurrency N] [--limit N]` prova localmente 429 e timeout, fallback e ciclo
aperto/probe/chiuso. Con `AI_LIVE=1` aggiunge richieste concorrenti reali e le riporta a parte.
Massimo 200 casi eval e 100 stress, moltiplicati per i tentativi configurati: per una prova
contenuta usare 16 eval + 12 stress, default 3 tentativi (massimo 84 chiamate SDK).

## Taratura dei livelli (15 ottobre 2026)

`AI_REASONING_FAST=off`, `AI_REASONING_REASONING=minimal`, `AI_REASONING_VISION=minimal`;
valori ammessi `off|minimal|low|medium`. OpenRouter invia `enabled:false` per off e
`effort/exclude:true` altrimenti. OpenAI diretto usa `none` per off; per GPT-6 `minimal`
diventa `low`, perché l'SDK installato scarterebbe minimal. Anthropic usa il mapping
nativo dell'SDK (adaptive/low per minimal, dove disponibile); sui modelli precedenti
il budget è 1024/2048/4096 token per minimal/low/medium, incluso nella prenotazione.
Un 400 che nomina reasoning/thinking causa al massimo un retry senza controllo per modello,
nel limite globale dei tentativi. `retryReasons` registra `reasoning_unsupported` anche dopo
un recupero; la telemetria CAF conserva il motivo in `outcome`, senza contenuti.

`AI_ATTEMPT_TIMEOUT_MS_FAST/REASONING/VISION/AUDIO` hanno default 6000/25000/20000/20000 ms: i controlli incrociati producono JSON lunghi e con 15 s DeepSeek andava in timeout.
`AI_ATTEMPT_TIMEOUT_MS` resta un override legacy comune; gli override di livello prevalgono.
Il totale è il minimo fra `AI_TOTAL_TIMEOUT_MS` (45000), due timeout di livello + 500 ms
e l'eventuale limite del compito. Tre tentativi al massimo per default. Il breaker conta
solo timeout, rate limit ed errori provider, una volta per modello nella richiesta;
gli errori di schema, validazione e guardia non sono avarie del provider.

Gli schemi remoti sono `json_schema` non strict, senza regex lessicali: tutte le regex,
la struttura e i vincoli di dominio vengono verificati in locale con Zod. Un 400 di schema
esplicito o una risposta strutturata vuota può ripiegare una volta sul JSON testuale per modello mantenendo la validazione locale e la policy dati.
`AI_PRICES` contiene `{ "model": [inputEurPerMillion, outputEurPerMillion] }` opzionale;
le tariffe globali coprono gli ID non elencati. Il costo di ogni tentativo usa il modello
restituito dal provider; le risposte senza usage e i timeout mantengono una stima prudente.
La prenotazione usa il candidato più costoso della catena, inclusi i fallback.

`pnpm ai:eval --limit 74 --variant a` conserva una variante senza sovrascrivere le altre.
Le risposte salvate dalla CLI sono esclusivamente quelle del dataset sintetico, mai dati
cittadino. Il gate live fallisce con fallback >=5%, mediana testo >=3000 ms o violazioni;
le lingue latine richiedono ancora revisione semantica umana.

Voce: `AI_MODEL_AUDIO` sceglie il modello (default `google/gemini-3.5-flash-lite`).
La riserva audio è `qwen/qwen3.8-omni-flash`. L’API conserva la registrazione solo in memoria,
riconosce il contenitore e verifica la durata prima di `runTask`. Un mismatch chiaro di lingua
porta alla riserva senza allentare la policy dati. Budget e telemetria restano quelli del runtime.
Prove e limiti in [ai-eval-citizen.md](../../docs/verification/ai-eval-citizen.md).

Il copilota è disponibile dal subpath `@avanti/ai/operator-tasks`: `dossierBriefTask`,
`dossierConsistencyTask`, `dsuReadTask` (vision), `dsuPrefillTask` (selezione reasoning),
`requestDraftTask`, `operatorAskTask`, `replyDraftTask`. API, cache, decisioni e recupero
sono descritti in `docs/decisions/operator-copilot.md`. I prompt operatore originali
restano v1; i prompt nuovi hanno versione 1, salvo la selezione DSU v2: i conflitti si raggruppano
per sezione e campo anche quando gli ID opachi delle proposte sono diversi.

Rigenerare l'indice senza rete: `node packages/core/scripts/build-knowledge.mjs` dalla
root. L’allowlist di file, sezioni e titoli in
`packages/core/scripts/build-knowledge.mjs` ammette soltanto guide normative e operative
per le pratiche e il servizio pubblico 1522. Nuovi file/sezioni restano esclusi fino
alla revisione esplicita; una sezione ammessa senza fonti ufficiali o con link commerciali
fa fallire la generazione. Note di progetto, mercato, demografia e dettagli implementativi
non sono fonti per l’operatore. L’indice non certifica che una norma sia tuttora vigente.
Il fallback delle domande normative sceglie al massimo due frasi consecutive da un
singolo paragrafo pertinente, con una citazione e copertura `partial`; se trova solo
frammenti, tabelle o corrispondenze deboli restituisce `none`. Non calcola diritti o importi.

Eval del copilota: `pnpm --filter @avanti/ai exec tsx eval/operator.ts`, offline per default.
Live richiede `AI_LIVE=1 AI_PROVIDER=openrouter` e la configurazione A di `docs/DEPLOY.md`.
Il default `AI_EVAL_TRANSPORT=production` costruisce `AiRuntime` senza override: usa lo stesso
`createTransport`, schemi, reasoning, timeout, retry e policy strict della produzione.
`AI_EVAL_SUITE=realistic` limita la prova ai dieci compiti sui cinque fascicoli realistici;
usare un `AI_EVAL_TAG` distinto per conservarne la ricevuta.
`AI_EVAL_TRANSPORT=legacy` conserva il precedente adattatore solo per confronti espliciti,
con report separati. `AI_EVAL_TAG` distingue le esecuzioni; `AI_EVAL_ISOLATED=1` isola il breaker.

Il dataset aggiunge cinque dossier da 2–4 componenti con 8–11 documenti: raccolta verificata,
caricamenti completi, letture AI/euristiche miste, anni errati e documenti mancanti. Il caso
verificato conserva l'avviso normativo generale del catalogo ISEE 2027: «pronto» qui indica
il prossimo passo suggerito all'operatore, non approvazione né convalida delle istruzioni annuali.
Il report distingue AI, percorsi locali attesi, fallback inattesi, latenza per compito,
tentativi e finding ripetuti prima/dopo la stessa deduplicazione usata dall'API. Un ripiego
inatteso fallisce il gate live. Include regressioni su evidenze e letture PDF con valuta.
Il trasporto di produzione espone stime EUR; il costo fatturato USD rimane null se non misurato.
File sintetici creati in memoria; nessun dato reale, chiave o contenuto di cittadini nei report.

`@avanti/ai/dossier-ask-task` aggiunge `dossierAskTask` (`dossier.ask`, reasoning,
costituzione 1/prompt 2). Restituisce affermazioni con ID di evidenze/citazioni o
astensioni esplicite; il server risolve i riferimenti e compone `DossierAskResponse`.
Chat e contratti UI in [dossier-ask.md](../../docs/decisions/dossier-ask.md).
Eval sintetico con trasporto di produzione: `AI_LIVE=1 pnpm --filter @avanti/ai exec tsx eval/dossier-ask.ts`;
senza `AI_LIVE`, esercita i fallback. `AI_EVAL_TAG` conserva esecuzioni distinte.
