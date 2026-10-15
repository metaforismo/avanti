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
//           costEstimate /* EUR */, fallbackReason }
```

Per un cold start contenuto usare `@avanti/ai/config` all'avvio e import dinamico di
`@avanti/ai/runtime` e `@avanti/ai/tasks` quando servono. L'adattatore API segue questo percorso.

`Task<I,O>` contiene `id`, `version` (costituzione.compito), `tier`, schemi zod `input`/`output`,
`system(input)`, `data(input)` con contesto minimo, blocchi non fidati ed eventuale file,
`heuristic(input)`, `validate(output,input)`, `guardText(output)`, `language(input)`,
`languageText(output)`, `skip(input)` e `limits`. Il ripiego è sincrono e deve sempre rispettare
lo schema e produrre testo locale sicuro. Un input non valido solleva ZodError: l'API valida
prima coi contratti e restituisce ApiError, senza dettagli interni.

Le prossime sessioni possono definire `citizen.assistant`, `dossier.*`, `dsu.prefill`,
`request.draft`, `operator.ask` come nuovi oggetti `Task`. I relativi prompt già scritti sono
esportati; non ci sono implementazioni fittizie. Usare la costituzione comune e versionare
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
74 casi; documenti immagine generati in memoria con sharp. Report JSON e Markdown in
`docs/verification/`, distinti per modalità. La precisione ignora solo i fatti laterali
`household_roles`/`household_relations`, non presenti negli ID del form. Per le traduzioni
non si dichiara accuratezza semantica automatica: serve revisione umana. Lingua: il guard
verifica alfabeti incompatibili; non certifica lingue latine né distingue russo e ucraino.
JSON valido riguarda l'uscita finale, incluso il fallback, non tutte le risposte del modello.

`pnpm ai:stress [--concurrency N] [--limit N]` prova localmente 429 e timeout, fallback e ciclo
aperto/probe/chiuso. Con `AI_LIVE=1` aggiunge richieste concorrenti reali e le riporta a parte.
Massimo 200 casi eval e 100 stress, moltiplicati per i tentativi configurati: per una prova
contenuta usare 16 eval + 12 stress, default 3 tentativi (massimo 84 chiamate SDK).
