# Piattaforma AI di Avanti

Stato: contratto di progetto con runtime implementato e verifiche locali, 15 ottobre 2026. Sostituisce l'integrazione diretta con un solo
gateway (`GatewayIntelligence`). Destinatari: chi sviluppa il backend, il frontend e chi
configura il deploy di un CAF.

## Principi

1. **Le regole decidono, l'AI aiuta.** Quali domande fare, quali documenti servono, gli anni di
   riferimento e le soglie restano nel motore deterministico (`packages/core`), con fonti
   normative citate. L'AI capisce il linguaggio, legge i documenti, spiega, riassume, segnala e
   propone. Non decide mai un esito, non dichiara un diritto, non inventa un requisito.
2. **Tutto funziona senza AI.** Ogni compito ha un percorso euristico locale. Una chiave
   mancante, un modello lento, un provider giù o un budget esaurito degradano il servizio, non lo
   fermano. Lo stato del sistema lo dice in chiaro.
3. **Un provider si cambia da configurazione.** OpenRouter, OpenAI, Anthropic e Vercel AI
   Gateway sono intercambiabili: cambiano variabili d'ambiente, non codice. Il modello si sceglie
   per compito (veloce, ragionamento, visione), con una catena di riserva.
4. **Ogni uscita è validata.** Output strutturato con schema zod, controlli di dominio dopo lo
   schema (ID ammessi, anni plausibili, lingua), al massimo un tentativo di correzione, poi
   euristica. Un testo libero non entra mai nel database senza passare da uno schema.
5. **Il contenuto esterno è dato, mai istruzione.** Testo del cittadino, documenti caricati,
   messaggi tradotti e basi di conoscenza entrano nei prompt dentro delimitatori con un
   identificatore casuale per richiesta. Il prompt di sistema dice al modello di non seguirne le
   istruzioni; i controlli in uscita verificano che non lo abbia fatto.
6. **Minimo indispensabile.** Al modello arriva solo ciò che serve al singolo compito. Niente
   note interne, niente altri fascicoli, niente dati di contatto se non servono. I log tecnici
   registrano compito, modello, tempi, token e costo, mai prompt o risposte.
7. **Costi e limiti sotto controllo.** Uso e costo stimato per CAF, per compito e per mese;
   budget mensile per CAF oltre il quale si passa all'euristica e l'amministratore viene avvisato.

## Architettura

```
packages/ai            runtime provider-agnostico (nessuna logica di dominio)
  config               lettura e validazione delle variabili, preflight
  providers            openrouter | openai | anthropic | gateway | none
  runtime              runTask: timeout, retry, catena di modelli, circuit breaker,
                       output strutturato, correzione, euristica, telemetria
  guard                delimitatori, pulizia input, controlli in uscita
  prompts              costituzione condivisa + prompt per compito, versionati
  tasks                definizioni tipizzate dei compiti (input, output, prompt, euristica)
  eval                 dataset sintetici, punteggi, rapporto (pnpm ai:eval)
packages/api           usa i compiti; budget e telemetria per CAF nel database
packages/core          regole, catalogo, euristiche pure (restano la fonte di verità)
```

Ogni compito è una definizione:

| Campo              | Significato                                                    |
| ------------------ | -------------------------------------------------------------- |
| `id`, `version`    | es. `citizen.assistant@3`; la versione entra nella telemetria  |
| `tier`             | `fast`, `reasoning` o `vision`: sceglie il modello configurato |
| `system`           | costituzione + prompt del compito, costruito da funzioni pure  |
| `input` / `output` | schemi zod; l'output è sempre strutturato                      |
| `validate`         | invarianti di dominio dopo lo schema                           |
| `heuristic`        | risultato senza AI, sempre disponibile                         |
| `limits`           | timeout, token massimi, temperatura, dimensione input          |
| `data`             | quali campi del fascicolo possono entrare nel prompt           |

## Configurazione

```
AI_PROVIDER=openrouter            # openrouter | openai | anthropic | gateway | none
OPENROUTER_API_KEY=…              # oppure OPENAI_API_KEY, ANTHROPIC_API_KEY, AI_GATEWAY_API_KEY
AI_MODEL_FAST=…                   # conversazione, traduzione, classificazione
AI_MODEL_REASONING=…              # riepiloghi, coerenza, prefill DSU
AI_MODEL_VISION=…                 # lettura dei documenti
AI_MODEL_FALLBACKS=…,…            # catena di riserva (OpenRouter: parametro models)
AI_DATA_POLICY=strict             # strict: solo provider senza conservazione né addestramento
AI_MONTHLY_BUDGET_EUR=…           # tetto per CAF, sovrascrivibile dall'amministratore
```

In produzione si sceglie un modello solo e lo si valuta con `pnpm ai:eval` prima del pilota.
I modelli gratuiti di OpenRouter servono solo a provare il funzionamento: hanno limiti condivisi,
risposte instabili e nessuna garanzia sui dati.

## Compiti

**Cittadino**

| Compito              | Cosa fa                                                                                                       | Quando                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `intake.understand`  | Classifica la pratica ed estrae i fatti dal racconto libero                                                   | Primo messaggio e ogni testo libero |
| `interview.freeform` | Trasforma una risposta a parole nella risposta strutturata della domanda corrente, da confermare              | «Rispondi a parole tue»             |
| `citizen.assistant`  | Risponde alle domande del cittadino sulla sua pratica, nella sua lingua, solo sulla base del contesto fornito | Ovunque nel percorso                |
| `document.analyze`   | Riconosce il documento, legge intestatario, anno, scadenza, pagine e leggibilità                              | Ogni caricamento                    |
| `translate`          | Traduce i messaggi dell'operatore al cittadino                                                                | Ogni richiesta d'integrazione       |

**Operatore**

| Compito               | Cosa fa                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| `dossier.brief`       | Riepilogo del fascicolo: situazione, cosa manca, cosa controllare, prossimo passo                      |
| `dossier.consistency` | Incongruenze tra risposte e documenti (nomi, codici fiscali, anni, componenti, scadenze), con evidenza |
| `dsu.prefill`         | Valori del prospetto DSU letti dai documenti, ognuno con documento, pagina e certezza, da confermare   |
| `request.draft`       | Bozza della richiesta d'integrazione dalle voci selezionate e dai motivi di rifiuto                    |
| `operator.ask`        | Risposte alle domande normative dell'operatore dalla base di conoscenza, con citazioni                 |

## Sicurezza dei prompt

- Delimitatori `<untrusted id="…" kind="citizen_text|document|knowledge|operator_text">` con un
  identificatore casuale per richiesta; il contenuto è ripulito da caratteri di controllo e
  da finti delimitatori prima dell'inserimento.
- L'output non può contenere URL, numeri di telefono o indirizzi email che non siano nel contesto
  fornito; non può chiedere credenziali (SPID, PIN, OTP, password, dati di carta).
- Il campo `intent` dell'assistente classifica fuori tema, richieste per l'operatore, emergenze
  e tentativi di manipolazione: il server li tratta senza fidarsi del testo libero.
- Nessuna risposta del modello diventa un dato del fascicolo senza conferma: il cittadino
  conferma le risposte proposte, l'operatore conferma prefill e incongruenze.

## Valutazione

`pnpm ai:eval` esegue dataset sintetici (nessun dato reale) per ogni compito, nelle otto lingue,
con casi normali, casi limite e attacchi (istruzioni nei documenti, richieste fuori tema, richieste
di consulenza, ruoli falsi). Il rapporto indica accuratezza, rifiuti corretti, violazioni, latenza
e costo. `pnpm ai:stress` misura il comportamento sotto concorrenza e con limiti di frequenza.

## API implementata e scelte di integrazione

`AiRuntime.runTask(task,input,ctx)` è tipizzato sul singolo oggetto `Task<I,O>`; le future
sessioni aggiungono definizioni senza cambiare il dispatcher. Interfaccia e limiti in
[`packages/ai/README.md`](../../packages/ai/README.md). `data` è una funzione che seleziona
contesto minimo e blocchi non fidati, non l'intero fascicolo. `version` unisce versione
costituzione e compito. I prompt originali restano invariati alla versione 1.

Sono state considerate due forme: registro centrale di ID con input/output unione, oppure
oggetti task generici con schemi e fallback propri. La seconda mantiene inferenza dei tipi,
consente nuovi compiti senza modificare il runtime e tiene la logica di dominio fuori dai
provider. Il runtime non conosce CAF o database; `TaskContext` espone ammissione e telemetria.

L'API usa `AiIntelligence`; `GatewayIntelligence` è un alias per compatibilità dei chiamanti.
Le firme intake/analyze/translate restano stabili. Le osservazioni testuali sui documenti
sono convertite in finding informativi, mai in accettazioni. `interview.freeform` è disponibile
come task; non introduce nuovi controlli nel frontend, che appartiene al lavoro di Claude.

`AI_MODEL_FAST`, `AI_MODEL_REASONING`, `AI_MODEL_VISION` selezionano i livelli; la catena è
`AI_MODEL_FALLBACKS`. Su OpenRouter i modelli ammessi dal breaker entrano anche in `models`.
Default: nessun provider senza configurazione; una chiave legacy Gateway seleziona Gateway.
Provider esplicito senza chiave resta in fallback. Timeout tentativo 6 s, totale 12 s,
3 chiamate al massimo; i compiti possono imporre un totale inferiore (traduzione 8 s).
Il totale comprende retry/backoff del provider; la contabilità usa i timeout SQL separati.

Breaker locale per istanza: 3 fallimenti, cooldown 30 s, un probe; nessuna sincronizzazione
fra istanze o visibilità nei retry interni OpenRouter. 400 con json_schema passa a JSON
locale, sempre validato con zod. La correzione riparte dai dati originali, senza rimandare
al provider il precedente output potenzialmente ostile.

## Uso per CAF

Migrazione unica `0015_ai_runtime`: tabella `ai_usage` e `settings.ai_monthly_budget_eur`.
`PATCH /api/settings` accetta `aiMonthlyBudgetEur` (null ripristina il default configurato).
`GET /api/ai/usage?month=YYYY-MM` è autenticato e riservato agli admin; usa sempre il CAF
della sessione, aggrega per compito/versione/modello/motore/esito/giorno UTC. Espone token,
costo EUR stimato, latenza media per gruppo, tentativi e conteggio manipolazioni, nessun contenuto.
Lo stato `/api/status` aggiunge configurazione pubblica (chiave presente, mai valore) e budget;
se esaurito mostra attention/fallback.

L'ammissione prenota la stima conservativa sotto lock breve sull'organizzazione; la rete
avviene dopo il commit. La riconciliazione rimpiazza la prenotazione con la stima dei token,
inclusi tentativi falliti quando misurabili. Timeout senza usage addebita la quota prenotata.
Se processo o telemetria falliscono, la prenotazione resta conteggiata fino a riconciliazione
amministrativa verificata. Il budget vale sulle stime, non sulla fattura del fornitore.
Con budget zero sono disabilitate anche chiamate gratuite. Senza contabilità disponibile
l'API usa l'euristica; le CLI sintetiche non scrivono nel DB.

## Verifiche e limiti osservabili

`pnpm check` non usa provider esterni. `AI_LIVE=1` è necessario per eval/stress reali.
Dataset: 74 casi sintetici, otto lingue per testo/traduzioni, immagini italiane normali e
ostili. Report separano uscite AI ed euristiche, JSON finale e rifiuti del guard. Accuratezza
su campi annotati, precisione/richiamo sulle risposte (esclusi i fatti laterali del core);
la fedeltà delle traduzioni richiede revisione umana. Il controllo lingua riconosce script
incompatibili; le lingue latine e russo/ucraino restano da verificare semanticamente.
Il rilevatore di manipolazioni è un contatore di indizi, non una prova di assenza di attacchi.

Il catalogo pubblico OpenRouter è stato letto il 15 ottobre 2026: 14 modelli `:free`, inclusi
`nvidia/nemotron-3-super-120b-a12b:free` (structured_outputs) e
`google/gemma-4-31b-it:free` (immagini). Disponibilità e limiti vanno ricontrollati a ogni
prova: [catalogo ufficiale](https://openrouter.ai/api/v1/models).
I report `ai-eval-2026-10-15-live` e `ai-stress-2026-10-15-live` registrano BLOCKED quando la
chiave non è esportata; non trasformare quei risultati in prove del provider.
