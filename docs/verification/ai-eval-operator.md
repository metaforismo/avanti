# Valutazione del copilota operatore

15 ottobre 2026. Solo fascicoli fittizi e file generati in memoria. Nessun dato reale,
nessuna chiave o contenuto personale nei report. Contratti ed esempi in
[API.md](../API.md#copilota-operatore), scelte in
[operator-copilot.md](../decisions/operator-copilot.md).

## Risultati

| Esecuzione                                                              | Esito dei casi                                      | AI / euristica | Richieste HTTP | Costo USD esposto dal provider      |
| ----------------------------------------------------------------------- | --------------------------------------------------- | -------------- | -------------- | ----------------------------------- |
| [Offline, corpus definitivo](ai-eval-operator-offline.json)             | PASS 17/17 per il fallback                          | 0 / 17         | 0              | 0                                   |
| [Configurazione DeepSeek + Luna iniziale](ai-eval-operator-strict.json) | FAIL 14/17: letture non eseguite dal breaker aperto | 3 / 14         | 13             | 0,003465825 su 7 risposte con costo |
| [Luna isolato, primo corpus](ai-eval-operator-strict-luna.json)         | PASS 17/17, incluso fallback per un timeout         | 14 / 3         | 31             | 0,0048259 su 15 risposte con costo  |
| [Luna isolato, corpus definitivo](ai-eval-operator-strict-final.json)   | PASS 17/17                                          | 15 / 2         | 31             | 0,004314 su 16 risposte con costo   |

Corpus definitivo: `b94cbc660f3a984a`, 31 chunk. Sezioni Markdown con link
istituzionali; escluse navigazione e sezioni con fonti commerciali mescolate. ID stabili
per file/sezione/posizione, versione del corpus calcolata dal contenuto. Non si è fatta
una nuova verifica della normativa annuale: le date e i limiti della ricerca rimangono
negli estratti. `KnowledgeRetriever` è il confine per un futuro indice embeddings.

L'esecuzione definitiva usa `openai/gpt-6-luna` su testo, immagini e PDF, policy `strict`
(`data_collection:deny`, `zdr:true`). Le due euristiche sono le domande fuori base e
l'iniezione: nessuna chiamata per entrambe. Nessun caso definitivo è passato
silenziosamente all'euristica dopo un errore. p50 6,023 s, p95 36,656 s per caso,
comprendendo tentativi e correzioni. Si tratta di un campione piccolo, non di uno SLA.

La policy strict ha trovato endpoint per entrambi i modelli testati; non è stato
necessario usare permissive. Questo prova l'ammissione del router con quei parametri,
non certifica autonomamente i processi del fornitore. I modelli usati hanno esposto costi
positivi: non si dichiarano chiamate gratuite. Nel complesso sono state tentate 79
richieste nell'eval e una smoke supplementare; eventuali richieste abortite prima di una
risposta non compaiono fra le ricevute HTTP. La smoke diretta (0,0000105 USD) è stata eseguita senza il flag
`AI_LIVE`: eccezione operativa non conforme alla richiesta, non replicata nei runner
consegnati, che richiedono entrambi i flag opt-in. Limite massimo teorico delle eval live:
142 tentativi, più la smoke, inferiore a qualche centinaio.

## Cosa misura il PASS

- Cinque dossier: nome compatibile con accenti/maiuscole/ordine, nome sbagliato, anno
  sbagliato, documento scaduto e conto non dichiarato. Richiamo dei quattro errori
  introdotti: 4/4 nel report unito alle regole. La verifica misura la pipeline composta;
  non attribuisce al modello il lavoro dei controlli deterministici.
- Riepilogo: un dossier incompleto non viene presentato pronto. Bozze richiesta e risposta:
  JSON valido e testo presente, senza invio. Lo stile richiede ancora revisione umana.
- Due domande note: anni di riferimento ISEE 2027 e CU 2026 → redditi 2025, con citazioni
  appartenenti al recupero. Domanda di cucina e richiesta di rivelare password → copertura
  none e nessuna citazione. Non è una misura della copertura di tutta la normativa.
- Documento bancario immagine: saldo 1.234,56 e giacenza 2.345,67, entrambi letti correttamente.
  CU PDF: reddito da lavoro dipendente 28.500,00; contratto PDF: canone annuale 7.200,00.
  Valori noti recuperati 4/4, pagina 1, confidenza e citazione letterale validate. Nessun
  calcolo di reddito complessivo o annualizzazione.
- Selezione prefill: copia del candidato noto e omissione di valori discordanti per lo
  stesso campo. Il fallback senza letture restituisce zero proposte; gli zeri non vengono
  inventati. Accettazione e rifiuto sono provati nei test API, non delegati al modello.

La selezione DSU v2 è verificata anche separatamente: [2/2 casi live](ai-eval-operator-prefill-v2.json),
4 richieste strict, 2 uscite AI, 0,000433475 USD esposti. Il conflitto usa due ID
opachi diversi per lo stesso campo: nessuna delle due proposte viene restituita.

## Compatibilità del runtime

Le eval live usano il `Transport` iniettabile del runtime, con override confinato
all'eval: `reasoning.enabled:false` per DeepSeek, `effort:minimal` per Luna, JSON schema
non strict e PDF nativo. Non è stato modificato `providers.ts`, gestito dalla sessione
runtime parallela. Costituzione, delimitatori, schemi zod, guard, correzione e fallback
sono comunque quelli di `runTask`.

Nell'eval definitiva 15 richieste con JSON schema hanno ricevuto HTTP 400 classificato
`schema_rejected`; il runtime è passato al JSON testuale con validazione locale, sotto
la stessa policy dati. Le 15 uscite AI finali sono JSON strutturati validi per l'applicazione;
il successo non dimostra enforcement remoto dello schema. Questo punto resta da
riconciliare con la taratura runtime prima di una prova in produzione. Il costo
prudenziale stimato dal runtime (1,261785 EUR) include riserve sui tentativi senza usage;
non è il costo USD misurato né una conversione valutaria.

Riferimenti tecnici consultati: [OpenRouter structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs),
[provider routing e ZDR](https://openrouter.ai/docs/guides/routing/provider-selection),
[reasoning](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens),
[PDF nativi](https://openrouter.ai/docs/guides/overview/multimodal/pdfs).

## Riproduzione

```sh
node packages/core/scripts/build-knowledge.mjs
pnpm --filter @avanti/ai exec tsx eval/operator.ts
AI_LIVE=1 AI_PROVIDER=openrouter AI_DATA_POLICY=strict \
  AI_MODEL_FAST=openai/gpt-6-luna AI_MODEL_REASONING=openai/gpt-6-luna \
  AI_MODEL_VISION=openai/gpt-6-luna AI_MODEL_FALLBACKS= \
  AI_ATTEMPT_TIMEOUT_MS=30000 AI_TOTAL_TIMEOUT_MS=60000 AI_MAX_ATTEMPTS=3 \
  AI_EVAL_ISOLATED=1 AI_EVAL_TAG=final \
  pnpm --filter @avanti/ai exec tsx eval/operator.ts
```

La chiave è soltanto nell'ambiente; non aggiungerla al comando, ai file o alle ricevute.
`pnpm check` non imposta `AI_LIVE` e i test usano esclusivamente transport sintetici.
Le ricevute hanno task, esito, modello, tempi, tentativi e costi: nessun prompt/risposta.

## Verifiche locali

Test nuovi: permessi e cross-tenant, cache persistente/concorrenza/POST di rigenerazione,
risposta tardiva su versione cambiata, unione con le regole, budget zero e AI disattivata,
contatti esclusi dai prompt testuali, prefill confermato e documento sostituito, rifiuto,
nessun invio dalle bozze, domande non lette, revisione rapida con verifica umana ancora
obbligatoria, limite 60/ora, PATCH parziale e interruttore cittadino indipendente,
migrazione conservativa. Le prove su database usano PGlite; il profilo Postgres esterno
rimane opt-in.

Esiti finali locali:

- **PASS** `TURBO_CACHE_DIR=.turbo/cache pnpm check --concurrency=1`: 18/18 attività,
  1.196 test superati; 18 prove opt-in saltate (Postgres esterno e relativi controlli).
- **PASS** conferma sequenziale DSU: 14 test API del copilota ripetuti dopo l'ultimo
  aggiornamento della cache; nessuna nuova chiamata per confermare i valori residui.
- **PASS** benchmark originale: 2.000 fascicoli / 20.000 documenti, limite di 15 query
  per richiesta mantenuto, cursori stabili. Nessuna soglia di prestazione allentata.
- **PASS** una sola `TURBO_CACHE_DIR=.turbo/cache pnpm build`: typecheck AI/API e
  produzione Next; preflight locale. Gli avvisi sugli output dei build `tsc --noEmit`
  non sono errori di compilazione.
- **PASS** pulizia successiva: rimossi `apps/web/.next` e `.turbo` del solo worktree.
- **PASS** controlli di stile e `git diff --check`; nessun contenuto della chiave di
  test nei file modificati/aggiunti. Nessuna modifica a `apps/web/src`, nessun commit.

Questi esiti sono locali: non sono una ricevuta di CI hosted, deploy o collaudo con dati
reali. I report live misurano il transport di valutazione descritto sopra.
