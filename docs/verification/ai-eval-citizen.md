# Valutazione cittadino — 15 ottobre 2026

Dataset sintetico: 72 casi `citizen.assistant` e 80 `interview.freeform`, nelle otto lingue. Categorie: spiegazioni, reperimento documenti, fuori tema, consulenza, offerte di credenziali, istruzioni nascoste, finti operatori, emergenze e lingue miste. Nessun dato reale. I testi di riferimento sono in `packages/ai/eval/citizen-dataset.ts`.

| Prova                                                         | Esito provider | Casi corretti / totali | Risposte AI corrette / AI | Fallback | Chiamate |
| ------------------------------------------------------------- | -------------- | ---------------------- | ------------------------- | -------- | -------- |
| [Locale senza rete](citizen-heuristic.json)                   | eseguita       | 152/152                | 0/0                       | 152      | 0        |
| [Gratuito strict: nemotron](citizen-free-strict.json)         | BLOCKED        | 8/8                    | 0/0                       | 8        | 5        |
| [Gratuito permissive: nemotron](citizen-free-permissive.json) | eseguita       | 149/152                | 87/90                     | 62       | 152      |
| [DeepSeek strict, campione](citizen-deepseek-strict.json)     | eseguita       | 31/32                  | 10/11                     | 21       | 32       |
| [Luna strict, campione](citizen-luna-strict.json)             | BLOCKED        | 32/32                  | 0/0                       | 32       | 32       |

Gratuito: `nvidia/nemotron-3-super-120b-a12b:free`. In strict, 5 tentativi HTTP 404 e 3 casi fermati dal breaker. Un probe minimo distinto ha confermato `noEndpoint=true` e `policyBlocked=true`: nessun endpoint corrispondente alla policy dati. Il test permissive è stato esplicitamente limitato ai dati sintetici; nessun allentamento automatico in produzione. Catalogo modelli verificato sul [catalogo ufficiale OpenRouter](https://openrouter.ai/api/v1/models).

La misura completa permissive riparte con un runtime per caso, così un breaker aperto non cancella la copertura delle altre lingue. Concorrenza 3, un tentativo per caso, timeout tentativo 15 s. Una prima prova condivisa (12 chiamate, 6 uscite AI) era stata interrotta dal breaker; non viene usata come prova di copertura. DeepSeek: una prima prova condivisa di 7 chiamate è esclusa per lo stesso motivo. Sono state eseguite circa 250 chiamate di generazione complessive, incluse ripetizioni e probe.

Il trasporto di eval usa l’override esplicito di `AiRuntime`: `reasoning.enabled=false` per DeepSeek e nemotron, `effort=minimal` per Luna, schema JSON non strict. Il trasporto testo di produzione trovato in questo worktree resta quello di ai-base (effort minimal fisso / schema SDK): questa prova non ne dimostra la futura taratura. Nessun prompt intake o assistente originale è stato modificato.

## Esiti della prova gratuita completa

| Compito            | Corretti | Uscite AI |
| ------------------ | -------- | --------- |
| citizen.assistant  | 69/72    | 31        |
| interview.freeform | 80/80    | 59        |

Copertura AI totale: 90/152 (59,2%). Accuratezza delle sole uscite AI: 87/90 (96,7%). Accuratezza dopo fallback: 149/152 (98,0%). Fallback: 34 timeout, 20 output invalidi e 8 violazioni rifiutate dal guard. Tutti i 152 endpoint hanno risposto HTTP 200; alcuni oltre il tempo utile o con output non utilizzabile.

I tre esiti difformi sono `citizen-explain-en`, `citizen-where-ro`, `citizen-mixed-ro`: il modello rimanda allo sportello o classifica diversamente una richiesta spiegabile dal contesto. Non sono correzioni arbitrarie delle risposte dell’intervista. DeepSeek: 31/32 corretti dopo fallback, 10/11 fra le uscite AI; stesso caso inglese difforme.

Luna non ha prodotto un’uscita AI utilizzabile per questi schemi: 29 HTTP 400 e 3 timeout. [Probe dello schema](citizen-luna-probe.json): 400 con messaggio generico del provider; un oggetto minimale distinto ha risposto 200. Il blocco riguarda questa combinazione di modello/endpoint/schema, non prova l’assenza di endpoint ZDR per Luna. Non viene presentato il 32/32 dei fallback come qualità di Luna.

| Lingua | Corretti dopo fallback | Uscite AI |
| ------ | ---------------------- | --------- |
| it     | 19/19                  | 11        |
| en     | 18/19                  | 5         |
| fr     | 19/19                  | 8         |
| es     | 19/19                  | 12        |
| ro     | 17/19                  | 8         |
| uk     | 19/19                  | 16        |
| ar     | 19/19                  | 14        |
| bn     | 19/19                  | 16        |

Latenza delle uscite AI gratuite: mediana 3260 ms; p95 9507 ms. Costo del modello gratuito: 0 EUR. Le stime conservative del runtime per i campioni a pagamento (DeepSeek 0,234 EUR, Luna 1,053 EUR) usano i coefficienti predefiniti e includono tentativi falliti: **non sono addebiti del provider**.

## Guard e limiti della misura

Nessuna violazione finale rilevata su credenziali o alfabeti; tutte le emergenze assistente contengono 112. Il guard ha scartato 8 output nella prova gratuita. Gli schemi validi finali includono il fallback: non equivalgono alla validità del JSON grezzo del modello. Il controllo di alfabeto non dimostra correttezza linguistica o semantica, soprattutto tra lingue latine. Accuratezza: confronto con intent/status/value annotati, non giudizio umano sul testo. Nessuna revisione madrelingua o prova con cittadini reali. I punteggi non sono una certificazione di sicurezza o una raccomandazione di rilascio del modello gratuito. Lo stato PASS del report grezzo misura i controlli finali; la qualità del modello va letta separatamente dalla copertura.

## Voce

[Prova reale strict](citizen-speech-strict.json), con lo stesso adattatore OpenRouter dell’app: tre WAV sintetici generati offline con eSpeak NG (port Emscripten 0.3.5), una chiamata per lingua, default `google/gemini-3.5-flash-lite`. Nessun dato di una persona. I file di prova ripetibili sono in `packages/api/src/fixtures/synthetic-speech-*.wav`. Il software TTS è stato installato soltanto in `/tmp`, non è una dipendenza dell’app.

| Lingua   | Latenza  | Esito osservato                                                             |
| -------- | -------- | --------------------------------------------------------------------------- |
| Italiano | 6.110 ms | «Vorrei fare l’ISEE per la mia famiglia.»; ISEE preservato                  |
| Spagnolo | 2.114 ms | «Quiero pedir el ISEE para mi familia.»; nessuna traduzione in italiano     |
| Arabo    | 1.770 ms | «تقديم طلب»; lingua corretta, trascrizione incompleta della frase sintetica |

**Limite aperto:** la verifica per alfabeto non rileva omissioni come quella araba. Prima del pilota serve una valutazione umana di parlato naturale e accenti. Il cittadino deve sempre poter correggere il testo prima dell’invio. Non è stato necessario usare permissive per l’audio; la riserva Qwen è verificata con trasporto sintetico su una trascrizione nella lingua sbagliata. Non si riutilizza Gemini 2.5.

La [prova reale dei formati](citizen-speech-formats-strict.json) ha trascritto la stessa frase italiana anche in WebM, Ogg e M4A con policy strict (tre uscite AI). I contenitori audio MP4 sono inviati come formato `m4a`, conforme alla documentazione del provider.

Test locali verificano WAV, Ogg, MP4/M4A e WebM senza durata nel contenitore, audio oltre 60 secondi, MIME falsificato, buffer oltre 2 MiB, trascrizione non persistita e fallback per lingua incompatibile.

## Ripetere le prove

```sh
pnpm --filter @avanti/ai exec tsx eval/citizen.ts
AI_LIVE=1 AI_PROVIDER=openrouter AI_DATA_POLICY=strict AI_MODEL_FAST=nvidia/nemotron-3-super-120b-a12b:free AI_MAX_ATTEMPTS=1 AI_EVAL_LIMIT=8 AI_EVAL_NAME=citizen-free-strict AI_EVAL_OVERRIDE=1 pnpm --filter @avanti/ai exec tsx eval/citizen.ts
AI_LIVE=1 AI_PROVIDER=openrouter AI_DATA_POLICY=permissive AI_MODEL_FAST=nvidia/nemotron-3-super-120b-a12b:free AI_MAX_ATTEMPTS=1 AI_ATTEMPT_TIMEOUT_MS=15000 AI_TOTAL_TIMEOUT_MS=16000 AI_EVAL_NAME=citizen-free-permissive AI_EVAL_OVERRIDE=1 pnpm --filter @avanti/ai exec tsx eval/citizen.ts
AI_LIVE=1 AI_PROVIDER=openrouter AI_DATA_POLICY=strict AI_ATTEMPT_TIMEOUT_MS=15000 AI_TOTAL_TIMEOUT_MS=30000 pnpm --filter @avanti/api exec tsx src/speech-live.ts
```

La chiave viene letta soltanto dall’ambiente; non inserire valori in file o comandi. `pnpm check` non importa le CLI live e non chiama provider. Migrazione e test API usano PGlite in memoria. Le prove di questa sessione non comprendono PostgreSQL ospitato, browser o distribuzione in produzione.

I nuovi controlli documento sono verificati con metadati sintetici nelle otto lingue e con
trasporto controllato per il riconoscimento di tipi fuori checklist. Questa sessione non
aggiunge una prova reale immagini/PDF di `document.analyze`; la taratura vision del runtime
resta distinta dai controlli deterministici e non viene presentata come verificata qui.

## Verifica finale del worktree

PASS — `pnpm check --concurrency=1`: 18 attività completate, 1.218 test passati,
18 saltati (percorsi opzionali del database). Include benchmark su 2.000 pratiche e
20.000 documenti con il limite di 15 query conservato, permessi, retention, quote,
revoca della capability durante l’AI, fonti, emergenze e controlli multilingue.

PASS — una sola esecuzione finale di `pnpm build`: 3 attività completate, build web
compilata e controlli TypeScript completati. Successivamente rimossi `apps/web/.next`
e le cartelle `.turbo` del worktree, come richiesto. Avvisi Turbo su cache/output dei
compiti `tsc --noEmit` senza errori di build.

PASS — nessuna modifica a `apps/web/src`, `/conversation` o `interview.converse`;
una sola migrazione generata con drizzle-kit. La credenziale del provider non compare
negli artefatti. Nessun commit creato e nessuna pubblicazione o distribuzione eseguita.
