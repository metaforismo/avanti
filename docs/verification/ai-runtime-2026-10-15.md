# Runtime AI — verifica locale 15 ottobre 2026

Worktree `.worktrees/ai-runtime`, branch `codex/ai-runtime`, HEAD di partenza `d01839d`.
Nessun commit, push, deploy o modifica credenziali. Le modifiche frontend concorrenti sono
state preservate; questo lavoro non ha modificato `apps/web/src`. I prompt di Claude non
sono stati modificati: costituzione e prompt restano alla versione 1, task alla versione `1.1`.

| Verifica | Stato | Evidenza |
| --- | --- | --- |
| `pnpm check --cache-dir="$PWD/.turbo/cache" --concurrency=1` | PASS | 18/18 task; verifica finale con 15 cache hit dopo una suite completa verde |
| Test | PASS | AI 14, API 507, core 572, DB 36, web 43: 1.172 passati; 18 saltati esplicitamente |
| `TURBO_CACHE_DIR="$PWD/.turbo/cache" pnpm build` | PASS | Unica invocazione build: 3/3 task, 47,684 s; compilazione Next riuscita |
| Migrazione `0014_ai_runtime` | PASS locale | Upgrade PGlite con dati preesistenti, vincoli, cascade; nessun DB di produzione modificato |
| Isolamento/budget | PASS locale | Endpoint admin, CAF/mesi distinti, override/null, budget zero, ammissioni concorrenti, riconciliazione e contabilità non disponibile |
| Strict OpenRouter | PASS simulato | SDK ufficiale con fetch sostituito: payload `data_collection:deny,zdr:true`, fallback `models`, reasoning limitato/escluso, json_schema |
| Retry/guard | PASS simulato | 429, 5xx, timeout hard, risposta vuota, correzione unica, JSON testuale, ID invalidi, credenziali nelle 8 lingue, telemetria senza contenuti |
| Cleanup richiesto | PASS | Rimossi `apps/web/.next` e `.turbo` da root, web e pacchetti; verificata assenza dopo build |
| `git diff --check` | PASS | Nessun errore whitespace |
| Eval/stress con modelli gratuiti reali | BLOCKED | Chiave assente nelle shell login e non-login; 0 richieste SDK di inferenza, nessuna chiave letta o scritta |
| Postgres esterno, CI, deploy | NOT RUN | Le prove DB sono PGlite; gli skip esterni della suite restano skip |

I warning Turbo su output mancanti di AI/API sono attesi dai loro build `tsc --noEmit`;
la build termina con exit 0. La cache assoluta nel worktree evita il tentativo di scrivere
nella checkout principale. I controlli non vengono ripetuti dopo la pulizia per non ricreare
`.next` tramite `next typegen`.

## Eval locale

[Rapporto completo](ai-eval-2026-10-15.md),
[JSON euristico](ai-eval-2026-10-15-heuristic.json),
[blocco live](ai-eval-2026-10-15-live.json).

74 casi sintetici, otto lingue per il testo, immagini italiane generate in memoria.
Tutti eseguiti in euristica, zero richieste esterne. Accuratezza sui 58 casi annotati:
57/58 (98,28%); classificazione pratica 100%; precisione/richiamo risposte 100% sui campi
annotati del form, esclusi i fatti laterali household_roles/household_relations.
Zero violazioni del guard sulle uscite; 100% JSON finale valido, inclusi i fallback.
Il caso documentale normale fallisce l'accuratezza visuale perché l'euristica non legge
intestatario, pagine o leggibilità: non è un controllo visivo riuscito. Le traduzioni
restano avvisi locali espliciti, senza un punteggio semantico fittizio.
12 controlli lingua superano il controllo di alfabeto, 62 restano non verificati; zero
mismatch rilevati. Non equivale a certificare otto lingue. Latenza media locale e costo
stimato sono nel JSON, senza convertirli in numeri del provider.

## Stress locale

[Rapporto completo](ai-stress-2026-10-15.md),
[JSON deterministico](ai-stress-2026-10-15-deterministic.json).

Concorrenza 4, 20 richieste per scenario, 40 fallback euristici corretti. In entrambi gli
scenari, 429 e timeout iniettati, il breaker si apre, sopprime le richieste, ammette un probe
ed è chiuso dopo il recupero. I conteggi transportCalls appartengono al trasporto simulato.
Nessun 429 o timeout è stato osservato su un provider reale.

## Cold start

[Confronto import locale](ai-cold-start-2026-10-15-local.json): 6 processi nuovi per variante,
mediana import adattatore precedente 832,39 ms, nuovo 215,13 ms. Include tsx e cache filesystem
potenzialmente calde; non è un confronto di deploy o dell'intera API.
[Smoke primo health](ai-cold-http-2026-10-15.json): AI SDK, PDF e fontkit non caricati; tempi
rilevati sotto carico macchina, senza baseline HTTP comparabile. L'import del runtime e dei
compiti è pigro nell'adattatore, quello dei provider è pigro nel trasporto.

## Prossima verifica

Rendere `OPENROUTER_API_KEY` disponibile nella shell senza scriverla in repository o report.
Con dati sintetici: `AI_PROVIDER=openrouter AI_DATA_POLICY=permissive`, testo
`nvidia/nemotron-3-super-120b-a12b:free`, visione `google/gemma-4-31b-it:free`, fallback
`openrouter/free`. Rieseguire eval 16 casi e stress 12 casi/concorrenza 3, al massimo 84
chiamate SDK con tre tentativi. I limiti interni OpenRouter possono cambiare quel che accade
a monte. La lettura pubblica del [catalogo](https://openrouter.ai/api/v1/models) ha confermato
14 modelli `:free`, inclusi i due indicati, senza chiamate di inferenza.

Prima dei dati reali scegliere e valutare il modello di produzione con policy strict,
revisionare le traduzioni e verificare accordi/account per retention dei provider diretti.
Il controllo lingua è conservativo e il budget è basato su stime EUR, non su fatture.

API e limiti per le prossime sessioni: [README del runtime](../../packages/ai/README.md).
Sono pronti `Task<I,O>`, `TaskContext`, `Transport` e i prompt dei compiti successivi;
`citizen.assistant`, `dossier.*`, `dsu.prefill`, `request.draft`, `operator.ask` restano alle
sessioni previste dal contratto.
