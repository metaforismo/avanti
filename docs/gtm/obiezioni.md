# Le dieci obiezioni da preparare

**14 ottobre 2026.** Risposte per demo e prima trattativa, ancorate a documenti e funzioni del checkout. Una funzione documentata non prova l'operatività del deployment né certifica conformità. La dimostrazione proposta usa dati fittizi; le prove pilota indicate sono ancora da raccogliere. [Perimetro prodotto](../../README.md), [protocollo](pilota.md).

## 1. «Sono documenti di reddito e identità: dove finiscono?»

**Risposta.** Il CAF definisce finalità e istruzioni; Avanti opera per suo conto nel perimetro concordato. Accessi personali degli operatori, isolamento fra CAF, storage privato, retention configurabile e registrazione degli accessi sono controlli previsti. Prima dei dati reali si completano nomina, analisi dei rischi e verifica dei fornitori effettivi. Non basta chiamare il server «europeo».

**Prova.** [Controlli e punti ancora aperti](../SECURITY.md), [deploy e regioni da verificare](../DEPLOY.md), [regolamento GDPR artt. 28 e 32](https://eur-lex.europa.eu/eli/reg/2016/679/oj/ita). In demo: due CAF sintetici, accesso a fascicolo estraneo negato, durata link, impostazione retention. Prima del pilota: matrice provider/endpoint/regione/retention e prova reale di cancellazione. Evitare «GDPR certificato», «tutto sempre in UE» o «nessun rischio».

## 2. «L'AI inventa: rischio di fare un ISEE sbagliato»

**Risposta.** Le regole della checklist sono versionate; l'AI interpreta il racconto e segnala caratteristiche dei file. Ogni documento deve essere verificato dall'operatore. Avanti non calcola ISEE, non decide l'ammissibilità e non invia DSU. Il prospetto non estrae automaticamente saldi, giacenze e redditi: indica cosa leggere e la fonte. Un warning non è un rifiuto della prestazione.

**Prova.** [Architettura](../ARCHITECTURE.md), [prospetto DSU](../research/dsu-prospetto.md), [adattatore AI](../../packages/api/src/ai.ts). Demo con anno ambiguo e intestatario non determinabile: incertezza visibile e correzione umana. Pilota: falsi rilievi e problemi non rilevati, non soltanto «quanti avvisi genera». Evitare «zero errori» e «documento certificato dall'AI».

## 3. «I miei operatori meno digitali non vogliono un'altra console»

**Risposta.** Manteniamo il gestionale abituale e concentriamo Avanti su coda, mancanti e revisione. Formazione di un'ora su un caso concreto; guida, operatore referente e avvio graduale. Se il passaggio aggiunge lavoro, il pilota lo deve rilevare. L'età non è una misura di competenza: proviamo con chi userà davvero lo strumento.

**Prova.** [Guida operatori](../guide/operatori.md), [onboarding giorni 4–5](pilota.md#playbook-interno-dieci-giorni-lavorativi), [roadmap console](../ROADMAP.md). Far completare un caso senza aiuto del fondatore; rilevare minuti, errori e richieste di aiuto. Non promettere che «non serve formazione» o che tutti impareranno in dieci minuti.

## 4. «Molti cittadini non hanno smartphone o non lo sanno usare»

**Risposta.** Avanti è facoltativo. Il link può essere aperto sul computer dello sportello e compilato insieme; resta il percorso ordinario. Nessuna app o account cittadino. L'assistenza richiede comunque tempo e accorgimenti di riservatezza: va conteggiata, non scaricata sul cittadino.

**Prova.** [FAQ della guida operatore](../guide/operatori.md#domande-frequenti), [flussi](../ARCHITECTURE.md). Demo assistita su PC, con dati fittizi; pilota con canali autonomo/assistito separati. Non promettere kiosk, funzionamento offline, accesso telefonico o assistente vocale nativo, che non risultano dal prodotto documentato.

## 5. «Abbiamo già CODYCE/Zucchetti: è integrato o devo ricopiare tutto?»

**Risposta.** Oggi abbiamo PDF/JSON, originali scaricabili separatamente e prospetto DSU ordinato. È un handoff documentale, **non import automatico** nel gestionale. Prima dell'avvio proviamo un fascicolo completo nel vostro software/versione e cronometriamo la copia. Un connettore si sceglie dopo quella prova.

**Prova.** [Integrazioni e formati](../research/integrations.md), [export API](../API.md), [limiti prospetto](../research/dsu-prospetto.md). [Centro Servizi TeamSystem](https://www.teamsystem.com/media/files/1671_TS_BROCHURE_LIGHT_TeamSystem_Centro_Servizi_2026.pdf) dichiara già il trasferimento nativo: riconosciamo il vantaggio e confrontiamo l'intero percorso. Se l'incumbent soddisfa la sede, non fingere una funzione mancante.

## 6. «Chi risponde dell'errore? Firma, delega e invio restano a noi?»

**Risposta.** Sì: Avanti prepara. Il CAF applica la procedura ufficiale, verifica il nucleo e i dati, acquisisce mandato/firma e trasmette con le abilitazioni necessarie. L'informativa Avanti non è un mandato DSU. Il contratto deve anche definire obblighi del fornitore e rimedi: «controlla l'operatore» non è un esonero generale di Avanti.

**Prova.** [INPS, mandato/delega al CAF](https://www.inps.it/it/it/dettaglio-approfondimento.schede-informative.mandato-e-delega-al-caf-per-la-compilazione-della-dsu-e-il-calcolo-dell-isee.html), [convenzione CAF 2026](https://www.inps.it/content/dam/inps-site/it/scorporati/circolari-e-messaggi/2026/04/Circolare_15250/Allegati/16747_Messaggio-numero-0001442-del-30-04-2026_Allegato-n-1.pdf), [regole e perimetro](../research/regulation.md). In demo distinguere «consegnata», «verificata» e atto ufficiale nel gestionale. Convenzione e istruzioni 2027 da ricontrollare; nessuna firma qualificata o certificazione generale promessa da Avanti.

## 7. «Il margine ISEE è basso: perché dovrei pagare?»

**Risposta.** Prima misuriamo il tempo netto, compreso handoff e aiuto. Il pilota è gratuito fino al 31 marzo; l'offerta a pagamento sarà distinta. Proposta di test: 129 €/sportello/mese con 150 consegne, extra 0,75 €, oppure 1,50 €/consegna per sede stagionale. Sono ipotesi: se il beneficio non copre il costo, non c'è un caso economico dimostrato.

**Prova.** [Tre simulazioni, costi e break-even](prezzi.md), [metriche pilota](pilota.md#disegno-del-test-nel-picco). Con 25 €/ora ipotetici, una sede da 100 consegne deve risparmiare circa 6,2 minuti/caso per valore doppio del canone. Mostrare anche scenario costoso e costo del picco; niente «129 tutto incluso illimitato» o ROI garantito.

## 8. «La lingua aiuta davvero? E chi parla dialetto o una lingua non prevista?»

**Risposta.** Sono disponibili italiano, inglese, francese, spagnolo, romeno, ucraino, arabo e bengalese; la console mantiene l'originale e i testi operatore in italiano. La qualità va verificata localmente con mediatori, in particolare sui termini bancari e familiari. Lingue non coperte e incomprensioni passano alla normale assistenza CAF.

**Prova.** [Lingue e limiti dell'estrazione](../ARCHITECTURE.md#estrazione-euristica-del-racconto), [piano revisione linguistica](../research/languages.md), [comportamento traduzione/fallback](../../packages/api/src/ai.ts). Provare con mediatore «saldo», «giacenza media», anno, genitore non convivente e correggere un fraintendimento. Niente percentuale di stranieri coperti dedotta dalla cittadinanza, traduzione giurata o supporto a tutti i dialetti.

## 9. «Se l'AI o internet si ferma proprio a gennaio?»

**Risposta.** Senza provider AI il motore a regole prosegue, ma il riconoscimento dei documenti degrada a indizi di nome/formato e richiede controllo manuale; non conferma leggibilità, titolarità o completezza. Senza connessione/deployment il SaaS non opera offline: il CAF continua con il processo abituale. C'è recupero documenti rimasti in analisi, da provare anche nell'ambiente remoto.

**Prova.** [Fallback documentale](../../README.md#configurazione), [analisi e limiti](../../packages/api/src/ai.ts), [prove locali e lavoro remoto ancora necessario](../verification/pilot-hardening.md), [runbook](../DEPLOY.md). In demo disattivare AI in ambiente sintetico, osservare segnalazioni; prima dell'avvio simulare outage e rientro. Non promettere «funziona uguale senza AI», uptime contrattuale o 24/7 non concordati.

## 10. «Il pilota poi ci vincola? E posso comprarlo come sede affiliata?»

**Risposta.** Nessuna conversione onerosa automatica: stop o contratto separato, export e restituzione concordati. Prima di avviare verifichiamo chi può firmare e autorizzare il trattamento: può essere necessario il nazionale, anche se il responsabile locale vuole provare. Nessuna esclusiva proposta. Referenze pubbliche solo con permesso distinto.

**Prova.** [Compratori e autorizzazioni](mercato.md#chi-compra-e-chi-pu%C3%B2-autorizzare), [uscita concreta](pilota.md#uscita-concreta), [export amministrativo](../DEPLOY.md), [restituzione ex art. 28](../research/data-portability.md). Demo di restituzione JSON **più binari**, ricezione verificata dal CAF. Non garantire che ogni sede abbia autonomia né chiamare il semplice export prova di migrazione automatica in qualunque gestionale.
