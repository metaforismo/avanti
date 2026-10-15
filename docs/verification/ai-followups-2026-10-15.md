# Avanti — verifica dei follow-up AI

15 ottobre 2026. Worktree `ai-followups`, ramo `codex/ai-followups`, base `2211eaf`.
Nessun commit, push, merge o deploy. Nessuna modifica a `apps/web/src`.

## Intake e sicurezza

- `packages/ai/src/prompts/intake.ts`: prompt v4, `intent` obbligatorio nell'output strutturato.
  `tasks.ts` impone assenza di pratica/risposte nei tre intent diversi da `need`; se l'AI
  ignora un pericolo riconosciuto localmente il risultato non passa la validazione.
- `packages/core/src/intake-safety.ts` e `i18n.ts`: riconoscimento prudenziale in otto lingue,
  anche mescolate, e avvisi deterministici localizzati. I ruoli familiari da soli non attivano
  l'emergenza. I casi riconoscibili localmente non richiedono una chiamata al provider.
- `packages/api/src/citizen.ts` / `citizen-turn.ts`: nessun avvio o proposta dal turno di
  emergenza/fuori tema/manipolazione; eventuali proposte pendenti vengono eliminate, le risposte
  già confermate restano integre. Il testo del modello non viene mostrato per questi intent.
  Si conserva solo il messaggio deterministico, senza aggiungere il racconto alla conversazione.
- L'evento `citizen.safety_notice` ha metadata vuoti e un'etichetta esplicita in `summary.ts`;
  compare nella cronologia operatore già esistente. Non occorrono migrazioni o campi nuovi
  nel dossier. Le eventuali pratiche già scelte restano disponibili per riprendere esplicitamente.

Fonte 1522 verificata online: [Dipartimento per le Pari Opportunità](https://www.pariopportunita.gov.it/it/numeri-utili/1522-numero-antiviolenza-e-antistalking/),
accesso 15 ottobre 2026: gratuità, servizio antiviolenza e stalking, disponibilità 24 ore su 24.
Dettagli in [ricerca](../research/intake-safety-1522.md).

Regressioni: emergenze IT/AR/UK/BN via HTTP; parole di violenza in tutte le otto lingue;
fuori tema, iniezione, risposta AI ostile ignorata, nessun testo sensibile nell'audit/log,
visibilità nella cronologia operatore, «mio marito mi aiuta con i documenti» innocuo.
La suite generale di registro linguistico ha richiesto una nuova eccezione circoscritta:
`demande` nella frase francese è un sostantivo del glossario, non un imperativo informale.

Limiti: euristica lessicale prudenziale, con possibili falsi positivi su citazioni, negazioni
o racconti storici; non copre tutte le parafrasi. Le traduzioni richiedono revisione umana.
Nessuna diagnosi né presa in carico automatica dal CAF.

## Stima delle domande

`packages/core/src/question-estimate.ts` calcola i limiti delle domande ancora necessarie
proiettando il grafo del catalogo, inclusi i redditi per componente, tre domande per rapporto
finanziario più l'eventuale domanda sul risparmio escluso, tre per immobile, due per veicolo
e le selezioni condizionali dei componenti. Usa quantità note e massimi del catalogo per le
quantità ancora ignote. L'estremo superiore non cresce durante l'avanzamento ordinario;
una correzione di quantità già dichiarate può legittimamente ricalcolarlo.

Modifica necessaria a `packages/contracts`: `Progress.questionsRemaining` opzionale `{min,max}`.
Il vecchio totale del solo grafo aperto non può esprimere questa incertezza. `questionsTotal=0`
indica che un singolo numero non è ancora attendibile; la UI esistente nasconde già numero
e barra in questo caso. Appena l'intervallo coincide viene esposto il totale esatto, includendo
le domande future già determinate. Il completamento continua a dipendere dalle domande aperte,
non dallo zero convenzionale.

Limite UI esplicito: l'intervallo è disponibile nell'API, **non disegnato dal frontend**,
per rispettare la divisione di lavoro. Il cittadino non vede più una promessa numerica
crescente; vede il numero quando è determinabile. Un futuro intervento frontend può mostrare
l'intervallo, eventualmente evitando massimi teorici molto alti prima delle risposte sui conti.

Test: intervista completa con quattro componenti, tre conti, due immobili e due veicoli,
rami positivi, riduzione monotona dell'estremo superiore fino a zero; quantità note prima
della lista dei componenti; nessun numero prematuro per i client esistenti.

## Eval operatore con il trasporto di produzione

`packages/ai/eval/operator.ts` usa `AiRuntime` senza override per default: `createTransport`
reale, con configurazione dell'ambiente. Il trasporto precedente si può selezionare solo
esplicitamente con `AI_EVAL_TRANSPORT=legacy`; i report sono distinti.

`operator-realistic.ts` aggiunge cinque fascicoli da 2–4 persone e 8–11 documenti:
verificato, caricato completo, letture miste AI/regole, anni errati, raccolta incompleta.
I documenti del dossier sono fixture di letture già completate, non nuove analisi live;
la lettura di immagine e dei due PDF del prefill è invece eseguita live. Le fixture euristiche
sono prodotte dalla funzione locale reale `heuristicAnalysis`.
`repeatsRuleFinding` nel core è condiviso con l'API, così il conteggio prima/dopo la
soppressione non usa una seconda implementazione delle regole.

Prima esecuzione: **23/27** secondo il gate iniziale, 23 esiti AI, due percorsi locali
attesi e due fallback inattesi nei PDF. I due riepiloghi non coincidevano col passo atteso;
un passo più prudente non equivale da solo a un errore. Il caso verificato manteneva la
cautela generale sulle istruzioni 2027. Conservati [JSON iniziale](ai-eval-operator-strict-production-2026-10-15-a.json)
e [tabella iniziale](ai-eval-operator-strict-production-2026-10-15-a.md).

Correzioni:

- Il contesto del riepilogo include il prossimo passo calcolato dalle regole e il motivo;
  il prompt v3 distingue i documenti già verificati da quelli solo caricati. Le segnalazioni
  nuove documentate possono comunque richiedere giudizio umano. Il gate esige AI, «ready»
  solo per il caso verificato, e vieta «ready» negli altri casi, senza bocciare ogni suggerimento
  più prudente. Non modifica lo stato della pratica.
- Il parser degli importi rifiutava la lettura corretta `28.500,00 euro` perché rimuoveva
  solo `€`. Riprodotto con un PDF sintetico e `createTransport`: JSON valido, dominio rifiutato
  per due tentativi. Ora accetta valuta EUR/euro/€ ai margini, senza accettare etichette,
  altre valute, somme o valori ambigui. Test sul task completo e sul parser. Versione del
  task di lettura incrementata a 2; il prompt di lettura non è stato allentato.
- Il gate live fallisce sui fallback inattesi; i due rifiuti locali attesi non sono conteggiati
  come guasti. Il costo fatturato USD non osservato è `null`, non zero.

Seconda esecuzione, configurazione **A di `docs/DEPLOY.md`**: DeepSeek V4.1 Flash per fast e
reasoning, Luna per vision e riserva; strict, reasoning off/minimal/minimal, timeout di livello
6000/25000/20000 ms, totale 45000 ms, massimo tre tentativi. Chiave letta solo dall'ambiente.

| Misura                                                  |            Risultato |
| ------------------------------------------------------- | -------------------: |
| Casi                                                    |       **27/27 PASS** |
| Risposte AI                                             |               **25** |
| Percorsi locali attesi (fuori base/iniezione normativa) |                **2** |
| Fallback inattesi                                       |                **0** |
| Tentativi SDK                                           |               **26** |
| Latenza AI mediana / p95                                | **4.864 / 11.662 s** |
| Controlli incrociati: mediana / massimo, 10 casi        | **4.576 / 10.461 s** |
| Riepiloghi: massimo, 6 casi                             |          **9.544 s** |
| Finding delle regole ripetuti nei 5 casi realistici     |                **0** |
| Costo stimato EUR                                       |       **0.01601085** |
| Costo fatturato USD                                     |     **non misurato** |

L'immagine bancaria ha richiesto due tentativi dopo un timeout: 24.720 s complessivi,
poi lettura AI corretta. CU PDF e contratto PDF corretti via AI; nessun allentamento della
policy strict. Le tolleranze sulle evidenze malformate restano coperte dalle regressioni
esistenti, rieseguite, e il report conta riferimenti non risolti (zero sui riepiloghi realistici).

Ulteriore verifica sui soli cinque fascicoli realistici dopo aver sostituito le letture
locali costruite a mano con chiamate alla vera `heuristicAnalysis` (incluso `legible=false`
come valore non verificato): **10/10 PASS, 10 AI, zero fallback, zero finding ripetuti**.
Massimo dei confronti 8.877 s; costo stimato della ripetizione €0.00868119.
[JSON della ripetizione](ai-eval-operator-strict-production-2026-10-15-realistic-final.json),
[tabella](ai-eval-operator-strict-production-2026-10-15-realistic-final.md).
`AI_EVAL_SUITE=realistic` permette questa ripetizione circoscritta, con un tag diverso.

Ricevute finali: [JSON](ai-eval-operator-strict-production-2026-10-15-a-final.json),
[tabella](ai-eval-operator-strict-production-2026-10-15-a-final.md).
Offline: [27/27](ai-eval-operator-offline-production.md), nessuna rete, 27 risultati locali.

Riproduzione: esportare i valori non segreti di A da `docs/DEPLOY.md`, lasciare la chiave
nel gestore segreti/ambiente, quindi:

```bash
AI_LIVE=1 AI_EVAL_TRANSPORT=production AI_EVAL_TAG=2026-10-15-a-final \
  pnpm --filter @avanti/ai exec tsx eval/operator.ts
```

Limiti: singola esecuzione sintetica per versione, non SLA, browser o prova di produzione
ospitata. Altri test locali giravano durante la misura. Non certifica correttezza normativa
o semantica italiana. Il caso verificato ha ancora l'avviso generale sul catalogo ISEE 2027:
«ready_for_practice» indica il prossimo passo proposto, non approvazione delle istruzioni annuali.

## Proposta e verifiche locali

[threshold-automation.md](../decisions/threshold-automation.md): sola proposta, senza codice;
criteri di ammissione, soglie da calibrare, revisione umana, audit, valutazione in ombra,
metriche per lingua, intervalli di confidenza e sospensione per errori critici.

Verifica finale **PASS**:

- `pnpm check`: 18/18 task riusciti; **1.457 test passati, 19 saltati** dalle suite
  esistenti (7 DB, 12 API), nessun errore. Core 613, AI 80, API 583, DB 38, web 43.
- `pnpm build`: PASS, 3/3 task riusciti, compilazione Next, TypeScript e generazione
  delle pagine completate. Un solo build; avvisi di cache del sandbox e assenza di
  output per i task `tsc --noEmit` non bloccanti, nessuna modifica alla configurazione Turbo.
- Dopo l'ultimo affinamento delle fixture: 5/5 test del generatore e typecheck AI PASS;
  la ripetizione live dei cinque fascicoli è 10/10 PASS.
- `git diff --check`: PASS. `apps/web/.next` e `.turbo` rimosse dopo il build;
  assenza verificata. Nessuna modifica a `apps/web/src`, nessuna chiave negli artefatti.
- Il primo `pnpm check` aveva rilevato soltanto la falsa segnalazione lessicale francese,
  corretta con un'eccezione circoscritta al sostantivo del nuovo messaggio.
- Queste sono prove locali e chiamate live al provider: non CI ospitata, browser,
  deploy o validazione sul campo. Le suite Postgres che richiedono il proprio ambiente
  sono rimaste saltate; non si dichiara una nuova prova PostgreSQL esterna.

Commit proposti, **non eseguiti**:

- `fix(api): proteggi intake e avvisi di sicurezza multilingue`
- `fix(core): stima le domande condizionali senza promesse crescenti`
- `fix(ai): verifica il copilota col trasporto di produzione e leggi gli importi EUR`
- `docs: proponi la revisione rapida a soglia per il pilota`
