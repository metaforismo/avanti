# Taratura AI live — 15 ottobre 2026

**PASS — A raccomandata per il testo.** 74 casi per configurazione, policy OpenRouter `strict` (`data_collection: deny`, `zdr: true`), chiamate seriali nella eval; breaker e fallback attivi. Stress su A a concorrenza 8. Nessun commit o deploy.

| Configurazione  | Casi | Gate | Mediana testo | p95 testo | Ripieghi locali | Violazioni rilevate | Tentativi SDK | Costo stimato |
| --------------- | ---- | ---- | ------------- | --------- | --------------- | ------------------- | ------------- | ------------- |
| A               | 74   | PASS | 1.228 s       | 3.559 s   | 1/74 (1.35%)    | 0                   | 86            | €0.016804     |
| B               | 74   | PASS | 1.510 s       | 7.873 s   | 0/74 (0.00%)    | 0                   | 93            | €0.026836     |
| B, FAST=minimal | 74   | PASS | 2.324 s       | 9.051 s   | 2/74 (2.70%)    | 0                   | 99            | €0.036394     |

A: DeepSeek fast/reasoning, Luna vision e fallback. B: Luna nei tre livelli, fallback DeepSeek. Ragionamento off/minimal/minimal in A e B standard; la riga B aggiuntiva usa minimal/minimal/minimal; timeout di tentativo 6000/15000/20000 ms, totale globale 45000 ms e limiti effettivi 12500/30500/40500 ms. Tariffe EUR/M: DeepSeek 0,03/0,70; Luna 0,10/0,50. Configurazioni complete nei JSON.

Gate live: mediana testo <3 s, ripieghi <5%, zero violazioni rilevate. Mediana sui 72 compiti testuali; per un campione pari è la media dei due valori centrali. p95 nearest rank. I tempi includono retry e fallback; il numero dei tentativi SDK non include i tentativi interni del router.

Tutte e tre le passate finali: 58/58 casi annotati corretti, precisione/recall estrazione 100%, JSON finale valido 100%, 16/16 traduzioni servite dall’AI. Le 16 traduzioni non hanno una valutazione semantica automatica: alfabeto e guardia non certificano la qualità linguistica. A ha 57/57 casi annotati corretti serviti dall’AI e un caso vision risolto localmente; B standard 58/58.

## Scelta e modelli effettivi

A usa meno tentativi (86 contro 93), riduce il p95 e costa meno nel campione. B ha servito 68/74 risposte con DeepSeek dopo fallback/breaker: la sua mediana descrive la pipeline completa. Il campione vision contiene due sole immagini sintetiche. A ha risposto al documento di saldo in 7.728 s; l’immagine ostile è andata in timeout a 40.502 s con fallback sicuro, senza apertura del circuito per quel solo compito. Questa prova non qualifica OCR di documenti reali.

| Modello che ha servito la risposta AI | A   | B   |
| ------------------------------------- | --- | --- |
| `deepseek/deepseek-v4.1-flash`        | 72  | 68  |
| `openai/gpt-6-luna`                   | 1   | 6   |

La verifica aggiuntiva B con FAST=minimal usa l’impostazione delle misure dirette di Luna. Ha risposto tramite Luna solo in 6 casi, tramite DeepSeek in 66, con 2 ripieghi locali (`injection-it`, `fake-admin-ar`, timeout). Mediana 2,324 s, p95 9,051 s, costo stimato €0,036394: A resta preferibile. Il controllo del ragionamento segue il livello anche sui fallback: DeepSeek riceve minimal in questa variante. Le tabelle per compito e lingua sotto riportano A/B standard; il dettaglio della variante è nel [JSON B-minimal](ai-eval-2026-10-15-live-b-minimal.json).

## Stress live su A

**PASS**, 40 richieste logiche, concorrenza 8, 41 tentativi SDK, 0 ripieghi, mediana 1.065 s, p95 1.664 s, 0 violazioni, costo stimato €0.003553. Gli scenari deterministici 429/timeout sono separati dalle osservazioni provider. [Rapporto stress](ai-stress-2026-10-15-live.md).

## Correzioni motivate dalle risposte

- Ragionamento e timeout configurabili per livello; off invia `enabled:false` su OpenRouter. Un 400 che nomina reasoning/thinking riprova una volta senza il parametro, con motivo persistito nella telemetria CAF. Mappature OpenAI/Anthropic dirette verificate sul payload SDK con fetch simulato; le chiamate live qui sono OpenRouter.
- Schema remoto non strict; le regex Unicode di SafeText sono verificate solo in locale. Le prime risposte includevano output vuoto e testo corrotto. Gli output strutturati ancora vuoti riprovano una volta in JSON testuale sullo stesso modello, con Zod e guardia complete. Errori di contenuto o capability non aprono il breaker.
- Intake **1.3**: esempi espliciti contro membri con nomi inventati e risposte predefinite. Lo schema di generazione offre solo pratiche disponibili; richieste universitarie usano ISEE ordinario e il campo university. Il fallback locale resta compatibile con il catalogo completo. Senza una pratica identificata non si accettano risposte inventate.
- Traduzione **1.3**: rifiuto localizzato esatto per tentativi di manipolazione; la v2 citava ancora termini vietati anche nei rifiuti. Freeform **1.3**: un numero esplicito come “Nous sommes 4 personnes” viene proposto come risposta senza chiederne un’ulteriore conferma.
- AI_PRICES distingue i modelli e il modello restituito dopo un fallback; prenotazione sul candidato più costoso, globali per ID non elencati. I motivi di retry non contengono prompt o risposte.
- AiUsageQuery/AiUsageResponse erano già esportati: verificati e file contratti passato a Prettier, senza modifica necessaria. Nuove variabili incluse nell’ambiente strict di build Turborepo. Nessuna modifica a apps/web/src.

## Passate di calibrazione

Ogni nuova passata segue una modifica motivata; non sono ripetizioni identiche scelte per ottenere un risultato favorevole. Le prime versioni del gate valutavano solo guardia/lingua: la colonna seguente ricalcola il gate con gli obiettivi di latenza e ripiego. Le accuratezze iniziali usavano confronto parziale dei campi; la versione finale conta anche le estrazioni aggiuntive come errori.

| Passata   | Gate dagli obiettivi | Ripieghi | Mediana testo (ms, metodo originario) |
| --------- | -------------------- | -------- | ------------------------------------- |
| initial-a | FAIL                 | 69/74    | 1                                     |
| a-v2      | FAIL                 | 12/74    | 1386                                  |
| b-v2      | FAIL                 | 46/74    | 701                                   |
| a-v3      | FAIL                 | 5/74     | 1620                                  |
| b-v3      | FAIL                 | 8/74     | 2630                                  |

## Dettaglio per compito

| Compito            | AI A / casi | AI B / casi | Mediana A | Mediana B |
| ------------------ | ----------- | ----------- | --------- | --------- |
| intake.understand  | 32/32       | 32/32       | 1.471 s   | 1.629 s   |
| interview.freeform | 24/24       | 24/24       | 1.236 s   | 1.231 s   |
| translate          | 16/16       | 16/16       | 0.833 s   | 0.852 s   |
| document.analyze   | 1/2         | 2/2         | 24.115 s  | 3.433 s   |

## Dettaglio per lingua

| Lingua | AI A / 9 | AI B / 9 | Mediana A | Mediana B |
| ------ | -------- | -------- | --------- | --------- |
| it     | 9/9      | 9/9      | 1.323 s   | 7.283 s   |
| en     | 9/9      | 9/9      | 0.956 s   | 1.011 s   |
| fr     | 9/9      | 9/9      | 0.973 s   | 1.011 s   |
| es     | 9/9      | 9/9      | 0.982 s   | 1.405 s   |
| ro     | 9/9      | 9/9      | 1.227 s   | 1.293 s   |
| uk     | 9/9      | 9/9      | 1.272 s   | 1.634 s   |
| ar     | 9/9      | 9/9      | 1.675 s   | 7.122 s   |
| bn     | 9/9      | 9/9      | 1.246 s   | 1.029 s   |

## Verifiche e riproduzione

`pnpm check`: **PASS**, 18/18 compiti, nessun risultato da cache. `pnpm build`: **PASS**, 3/3 compiti, una build di produzione senza cache. Contratti: Prettier PASS. Test runtime/prezzi: **37/37 PASS**. Regressioni HTTP su timeout, pratiche indisponibili e sala d’attesa: **48/48 PASS**. Persistenza dei motivi di retry: PASS locale. Nessun compito reasoning-tier nel dataset live; quel livello è verificato offline sul trasporto.

Configurare le variabili in [DEPLOY.md](../DEPLOY.md), poi `AI_LIVE=1 pnpm ai:eval --limit 74 --variant a`; cambiare modelli/fallback per B con `--variant b`; ripristinare A e lanciare `AI_LIVE=1 pnpm ai:stress --concurrency 8 --limit 40`. La chiave resta nell’ambiente. Le CLI salvano esclusivamente risposte del dataset sintetico.

[A JSON](ai-eval-2026-10-15-live-a.json), [B JSON](ai-eval-2026-10-15-live-b.json), [confronto e cronologia JSON](ai-eval-2026-10-15-live.json). Le tariffe sono quelle fornite per questa prova; costi stimati e prenotazioni prudenziali non sono fatture. Rete, cache dei provider e verifiche locali in background introducono variabilità nei tempi. Prima di un pilota serve revisione umana delle traduzioni nelle lingue usate.

La prima esecuzione completa ha rilevato il vecchio deadline atteso a 12 s, il recupero RED non disponibile (risolto separando schema remoto e schema locale completo), e il budget wall-clock del test sala d’attesa. Il deadline atteso è ora 12,5 s; il singolo test con 40 cittadini ha un budget di esecuzione di 120 s per le transazioni PGlite serializzate. Tutte le asserzioni sul flusso e sui dieci minuti del clock simulato restano attive. I tre gruppi sono verdi nella nuova esecuzione mirata e nell’intera seconda esecuzione di `pnpm check`.
