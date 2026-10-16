# Prezzi B2B e margini: tre modelli da testare

**Aggiornato il 16 ottobre 2026. Tutti i prezzi Avanti sono proposte, non listino approvato o disponibilità a pagare dimostrata.** IVA esclusa. I riferimenti ai listini hosting risalgono al 14 ottobre, non sono garantiti per gennaio 2027. I consumi del pilota vanno misurati sul provider approvato; le prove AI del 15 ottobre usano solo casi sintetici e non misurano un costo medio per fascicolo reale.

**Raccomandazione:** pilota gratuito a obiettivi fino al 31 marzo 2027, con cap e supporto concordati; poi testare **129 €/sportello/mese con 150 fascicoli inclusi e 0,75 € per eccedenza**. Un'alternativa da confrontare è **1,50 € per fascicolo consegnato**, senza canone. Per le reti, lo sconto è condizionato a costi e supporto misurati: nessun illimitato.

## Unità da vendere

**Fascicolo consegnato** = primo invio del cittadino che entra in coda all'operatore, identificato da ID pratica. Non è una DSU ufficiale, né un fascicolo certamente completo. Contarlo una volta: integrazioni e reinvii dello stesso ID inclusi; test sintetici esclusi; duplicati segnalati dalla sede rettificati; cancellare dopo la consegna non annulla l'utilizzo. La fattura non dipende da «Segna pronta», che incentiverebbe a manipolare lo stato. Il limite commerciale e il momento di conteggio devono essere scritti nel contratto.

**Sportello** = sede fisica/operativa concordata, non utente della console né cassa individuale. Fino a cinque operatori per sportello nella proposta standard, con accessi personali. La rete deve dichiarare sedi e titolare; niente frammentazione di un solo sportello per ottenere quote extra.

Le bozze non consegnate non vengono fatturate per pratica, ma consumano risorse. Quota pilota proposta: massimo **2.000 avvii** e **1.500 consegne** complessive, tre sportelli; cap ordinario 500 consegne per sede nel trimestre, riallocabile per accordo. Avvisi al 70% e 90%, revisione manuale del cap; non bloccare silenziosamente chi sta finendo. Sono implementati contatori mensili per CAF/sportello, report di piattaforma e avvisi di quota consegne al 70%, 90% e 100%; gli invii continuano oltre il cap e il contatore registra l’eccedenza. Il budget AI è una protezione interna di Avanti. Fatturazione, rettifiche dei duplicati e quote trimestrali/cumulative del pilota restano gestioni manuali: il cap software è mensile, condiviso tra gli sportelli del CAF. [Operare la piattaforma](../DEPLOY.md#operare-la-piattaforma). [API e stati](../API.md), [limiti tecnici](../../README.md).

## Tre offerte comparabili

| Modello                            | Proposta locale                                        | Proposta rete, ipotesi                                                                         | Vantaggio                                                                        | Limite                                                                                                                               |
| ---------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **A. Consumo**                     | 1,50 €/fascicolo consegnato, nessun canone             | 1,20 € con almeno 50 sportelli e impegno minimo 10.000 consegne/anno; connettori a preventivo  | Si paga durante la campagna; facile per sede stagionale                          | Ricavi stagionali, costo degli abbandoni e supporto non coperti a basso volume. Minimo rete da validare, non contratto già accettato |
| **B. Sportello/mese con quota**    | 129 €/mese, 150 consegne incluse, extra 0,75 €         | 99 €/sportello/mese per almeno 50 sedi attive, 150 incluse/sede con pool di rete, extra 0,60 € | Budget base comprensibile; risorse sotto controllo; prezzo per operatore evitato | La quota rende il mese di picco più caro. Supporto standard, formazione extra e SLA dedicato vanno esplicitati                       |
| **C. Pilota gratuito a obiettivi** | SaaS 0 € fino al 31/03/2027, una sede per partecipante | Massimo tre sedi nel pilota, non rollout nazionale gratuito                                    | Produce prove di utilizzo, handoff e acquisto                                    | Ricavi zero; Avanti finanzia onboarding e consumi. Nessun rinnovo oneroso automatico né obbligo di testimonianza favorevole          |

Il canone B è mensile, disdicibile per il mese successivo nella proposta. Archivio, export e cancellazione a fine servizio secondo accordo; niente quota trasferita automaticamente al mese seguente. L'eventuale piano «sola campagna» si valuta dopo il pilota: non vendere dodici mesi sulla promessa di un 730 ancora in beta. Referenza: [CAFhub 59/129/249 €/mese](https://cafhub.it/), [730App 5 € + IVA/completamento 730](https://730.info/), [Flisco 79/179/349 €/mese per clienti](https://www.flisco.it/). Sono benchmark con unità e servizi diversi, non validazione del nostro prezzo.

## Costo variabile: misurarlo con la telemetria

L’AI è inclusa nel piano: il CAF non compra token né sceglie fornitori. La piattaforma usa
il runtime [`@avanti/ai`](../../packages/ai/README.md), con modelli, tentativi e fallback
configurabili. La configurazione **A** di [DEPLOY.md](../DEPLOY.md#runtime-ai-e-scelta-del-modello)
usa DeepSeek per testo/ragionamento e Luna per visione e riserva. Le tariffe stimate sono
quelle esplicite in `AI_PRICES`, in EUR per milione di token input/output; per modelli non
elencati valgono `AI_INPUT_EUR_PER_MILLION` e `AI_OUTPUT_EUR_PER_MILLION`. Questa pagina non
aggiunge un listino e non usa più Sonnet come assunzione per tutti i fascicoli.

La tabella `ai_usage` registra compito/versione, modello, motore, giorno, tentativi, token,
costo stimato e riserve aperte, senza prompt o documenti. `pnpm platform:usage --month YYYY-MM`
aggrega questi dati per CAF e sportello. I retry contano come chiamate; il fallback locale
senza tentativi remoti ne conta zero. I tentativi nascosti dal router a monte non sono
osservabili. Usage mancante, timeout e prenotazioni non riconciliate richiedono confronto
con la fattura del provider: il report è una stima, non un addebito al CAF.

```text
AI_EUR_mese = somma(ai_usage.cost_estimate_eur)
AI_per_consegna = AI_EUR_mese / consegne_del_mese
budget_usato_% = (AI_EUR_mese + riserve_aperte_EUR) / budget_CAF_EUR × 100
storage = GB × mesi_effettivi × tariffa_GB_mese + operazioni/backup/traffico
costo_tecnico_per_consegna = (AI_EUR_mese + storage + runtime/DB/traffico) / consegne
margine_contributivo = ricavo - costi_tecnici - supporto_allocato
```

Con zero consegne il rapporto è `null`, non zero. L’AI del mese include bozze e attività su
fascicoli iniziati in altri mesi: è un costo allocato sul volume mensile, non una misura del
singolo dossier. Non aggiungere una seconda quota per gli abbandoni se i loro consumi sono
già inclusi nel numeratore. Le riserve sono mostrate separatamente dal costo stimato ma
consumano budget. Il budget è del CAF; le percentuali degli sportelli ne mostrano la quota
utilizzata, senza moltiplicare il budget disponibile per il numero delle sedi.

Il [rapporto sintetico A del 15 ottobre](../verification/ai-eval-2026-10-15-live.md) misura
**€0,016804** sull’insieme dei compiti di valutazione: non è il prezzo per fascicolo.
Le simulazioni economiche qui sotto conservano **0,30 €/consegna** come accantonamento base
e **0,90 €** come scenario stress per il costo tecnico totale. Sono ipotesi di budget,
non valori ricavati dai modelli attuali né limiti massimi. Sostituirli con telemetria e
fatture del pilota; il costo pieno comprende anche storage, hosting, backup e supporto.
Il prodotto ammette fino a 60 file e 120 MiB/pratica: la coda costosa va misurata.

### Storage e hosting: ipotesi ancorate ai listini

[Vercel Blob](https://vercel.com/docs/vercel-blob/usage-and-pricing) mostra nel listino predefinito **0,023 USD/GB-mese**, operazioni semplici **0,40 USD/milione**, avanzate **5 USD/milione**, traffico Blob **0,05 USD/GB**. Sono tariffe di riferimento, non un preventivo Frankfurt. Un dossier da 15 MB = 0,015 GB per sei mesi costa circa **0,0021 USD di sola conservazione**; 15 upload avanzati circa **0,000075 USD**. Download ripetuti, backup, trasferimento attraverso Function e regione aggiungono costo: 0,01 € base è una riserva, non il listino dello storage.

La retention attuale decorre dalla chiusura/scadenza, non necessariamente dall'upload: sei mesi è una **assunzione economica**, non la durata reale garantita dal software. Con link di 60 giorni e poi retention 180 giorni, una bozza può occupare più di sei mesi. Ricalcolare su giorni effettivi, cancellazioni riuscite e copie di backup. [Configurazione](../../README.md), [restituzione dati](../research/data-portability.md).

[Vercel Pro](https://vercel.com/pricing) parte da **20 USD/mese**, con credito incluso di utilizzo; runtime ha tariffazione per CPU attiva, memoria, invocazioni e trasferimento, distinta dal costo build. [Neon Launch](https://neon.com/pricing) indica **0,106 USD/CU-ora** e **0,35 USD/GB-mese** per storage. I consumi aggiuntivi di runtime/DB vanno allocati usando le fatture, separandoli dal minimo fisso: nessun costo per richiesta è garantito.

**Budget fisso condiviso proposto: 90 €/mese**, incluso piano hosting, riserva DB minimo, backup e monitoraggio, esclusi consumi marginali sopra. Non è un preventivo dei fornitori. Separare quota minima e consumo aggiuntivo nelle fatture ed evitare doppio conteggio dei crediti. Amortizzare su sportelli **paganti**: 90/3 = 30 €, 90/10 = 9 €, 90/30 = 3 €/sede/mese. Un ambiente dedicato di rete e SLA aggiuntivi richiedono un conto proprio.

## Simulazioni per piccolo, medio e rete

Profili **ipotetici**, stesso mese con adozione Avanti: piccolo **1 sede, 100 consegne**; medio **3 sedi, 400 consegne/sede**, totale 1.200; rete **50 sedi, 400/sede**, totale 20.000. Non sono medie nazionali e non tutte le pratiche della sede useranno Avanti.

| Modello / profilo                                      |                              Ricavo mensile, € |         Costo tecnico allocato a 0,30 €, € |    Contributo prima di supporto/fissi, € |                     Margine |
| ------------------------------------------------------ | ---------------------------------------------: | -----------------------------------------: | ---------------------------------------: | --------------------------: |
| A — piccolo                                            |                                            150 |                                         30 |                                      120 |                       80,0% |
| A — medio                                              |                                          1.800 |                                        360 |                                    1.440 |                       80,0% |
| A — rete, 1,20 €                                       |                                         24.000 |                                      6.000 |                                   18.000 |                       75,0% |
| B — piccolo                                            |                                            129 |                                         30 |                                       99 |                       76,7% |
| B — medio                                              |    3 × 129 + (1.200 − 450) × 0,75 = **949,50** |                                        360 |                                   589,50 |                       62,1% |
| B — rete                                               | 50 × 99 + (20.000 − 7.500) × 0,60 = **12.450** |                                      6.000 |                                    6.450 |                       51,8% |
| C — piccolo, mese da 100 consegne                      |                                              0 |                                         30 |                                      −30 | Non definito su ricavo zero |
| C — medio, massimo tre sedi/500 ciascuna nel trimestre |                                              0 |                   Fino a 450 nel trimestre |                   −450 prima di supporto |                Non definito |
| C — rete                                               |                                              0 | Fino a 450 per le **sole tre sedi** pilota | Nessuna estensione gratuita alle 50 sedi |                Non definito |

Esempio di costo di servizio dopo il pilota: **0,5 ore di supporto per sede/mese a 35 €/ora** = 17,50 €; ipotesi di costo interno, non tariffa ai CAF. Per piccolo/medio ipotizzare un portafoglio totale di dieci sportelli paganti: quota fissi 9 €/sede. Per la rete di 50 sedi allocare l'intero budget condiviso di 90 €, pari a 1,80 €/sede, senza ambiente dedicato. Con B, dopo supporto e queste quote fisse, restano **72,50 € / 510 € / 5.485 €**, pari a **56,2% / 53,7% / 44,1%** per piccolo/medio/rete. Non è utile netto: mancano sviluppo, commerciale, onboarding iniziale, legale, imposte e insoluti. Per A nelle stesse condizioni restano **93,50 / 1.360,50 / 17.035 €**. Il margine migliore di A non prova che il CAF accetterà quel prezzo; se la rete richiede risorse dedicate, sostituire i 90 € con il preventivo reale.

Con **0,90 € di costo stress**, B produce prima del supporto **39 €** sul piccolo, **−130,50 €** sul medio e **−5.550 €** sulla rete. A lascia rispettivamente 60 €, 720 € e 6.000 €. Conseguenza: non promettere lo sconto rete o extra da 0,60 € finché il costo per consegna e la coda non sono misurati. Per tenere il 60% di contributo **sulla sola eccedenza**, il costo tecnico deve essere ≤0,30 € a prezzo 0,75 e ≤0,24 € a prezzo 0,60, prima del supporto.

### Stagionalità: una sede ISEE può pagare più della media

Scenario di **1.200 consegne ISEE/anno**: distribuzione ipotetica gennaio–dicembre **45/23/3/4/3/3/3/2/4/4/3/3%**. Somma 100%; solo il 45% e il cumulato >2/3 sono ancorati al [MLPS 2024](https://lavoro.gov.it/documenti-e-norme/studi-e-statistiche/rapporto-isee-2024), **le altre quote sono assunzioni**, non volumi mensili nazionali.

Gennaio: 540 consegne → B costa **421,50 €**; febbraio: 276 → **223,50 €**; altri mesi 129 €. Totale B **1.935 €/anno**, contro A **1.800 €**. Ipotizzare 100 ogni mese avrebbe dato soltanto 1.548 €: il canone «129» da solo nasconde il consumo stagionale. Per una sede solo ISEE, A può essere la scelta migliore; proporre B quando l'utilizzo è continuativo e il beneficio è provato. Se vende anche 730, il relativo valore e costo vanno misurati prima di estendere il contratto.

## Il valore per il CAF e il punto di pareggio

Ipotesi di costo del lavoro **25 €/ora**, da sostituire con il costo pieno della sede. Cinque minuti **netti** risparmiati valgono **2,08 €/fascicolo**: includere lavoro di assistenza cittadino, verifica, recuperi e copia nel gestionale. Non sono necessariamente risparmio di cassa: possono essere capacità liberata durante il picco.

| Profilo B | Canone + consumo per consegna | Minuti netti/consegna per pareggiare il prezzo | Minuti per valore almeno 2× prezzo |
| --------- | ----------------------------: | ---------------------------------------------: | ---------------------------------: |
| Piccolo   |                        1,29 € |                                           3,10 |                           **6,19** |
| Medio     |                  0,79 € circa |                                           1,90 |                           **3,80** |
| Rete      |                  0,62 € circa |                                           1,49 |                           **2,99** |

A a 1,50 € richiede 3,6 minuti per pareggiare, 7,2 per valore 2×. I compensi DSU 2026 sono nominalmente [10,81–17,35 € + IVA nei casi remunerabili](https://www.inps.it/content/dam/inps-site/it/scorporati/circolari-e-messaggi/2026/04/Circolare_15250/Allegati/16747_Messaggio-numero-0001442-del-30-04-2026_Allegato-n-1.pdf): una fee di 1,50 € pesa circa 8,6–13,9% del compenso, prima del riparto rete e del personale. Il decisore deve riconoscere valore economico netto, non «costo piccolo rispetto al totale».

## Budget del pilota e scelta successiva

Cap **1.500 consegne complessive**: tecnico base 450 €, stress 1.350 €. Per tre sedi: sei ore di onboarding per sede più mezz'ora/settimana per dodici settimane = **36 ore × 35 € = 1.260 €**. Fissi condivisi tre mesi **270 €**; acquisizione ipotetica otto ore/sede **840 €**. Budget complessivo **2.820 € base / 3.720 € stress**. Proposta di accantonamento: **3.000–4.000 €**, con legale, revisione traduzioni, viaggi ed eventuali condizioni UE/ZDR **da quotare separatamente**. Il cap gratuito non copre un rollout di rete.

Entro febbraio rilevare consumi reali, costo di abbandoni, supporto per sede, valore dei minuti e costo di export. Non inviare documenti reali a modelli non approvati per misurare i prezzi. La telemetria commerciale implementata conserva solo conteggi aggregati, token e stime di costo; non conserva testo libero o contenuto documentale. Le organizzazioni sintetiche vanno escluse prima di creare pratiche (`organizations.metering_excluded`); il seed demo lo imposta automaticamente.

Entro **15 marzo** offrire A e B al decisore e registrare scelta, ragione e ordine/contratto separatamente dall'interesse verbale. **Raccomandazione condizionata:** adottare B per sedi continuative se costo tecnico ≤0,30 €, supporto ≤30 minuti/mese e beneficio almeno 2× prezzo; A per stagionali o dove il canone non è accettato. Non introdurre tre listini permanenti prima di tre veri confronti di acquisto. Per la rete, prima un rollout pagato di cinque sedi; connettore, onboarding e SLA come voci esplicite. [Protocollo pilota](pilota.md).
