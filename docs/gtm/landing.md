# Landing: modifiche proposte in ordine d'impatto

**14 ottobre 2026. Solo suggerimenti, nessuna modifica al frontend.** Analisi del [sorgente landing](<../../apps/web/src/app/(site)/page.tsx>), del [modulo pilota](../../apps/web/src/components/landing/pilot-form.tsx) e della [pagina sicurezza](<../../apps/web/src/app/(site)/sicurezza/page.tsx>). Non è un audit del sito live, del rendering mobile o del tasso di conversione. Le priorità sono giudizi qualitativi; tempi/risparmi non misurati.

La pagina ha già una buona base informativa: hero, quattro passaggi, esempio operatore, lingue, calendario pratiche, fonti numeriche, limiti, sicurezza, proposta pilota e sei FAQ. Non serve aggiungere una seconda spiegazione generica dell'AI. Serve rendere più chiara la decisione del responsabile: **che prova faccio, cosa devo impegnare, quale handoff avrò, quando posso uscire?**

## 1. Rendere il pilota una proposta verificabile vicino alla CTA

**Impatto atteso: alto.** Oggi «Diventa CAF pilota» precede i dettagli, e si alternano «2–3 CAF» nella roadmap e «tre sportelli» in pagina. Uniformare a **tre sportelli in 2–3 organizzazioni**, obiettivo ancora da reclutare. «Tre posti» non significa posti già prenotati.

Copy proposto sotto il hero, dopo approvazione del programma:

> **Pilota ISEE gennaio–marzo 2027.** Preparazione dello sportello in due settimane, una formazione di un'ora, confronto settimanale di mezz'ora. Gratuito fino al 31 marzo, con volumi concordati. Per proseguire serve un accordo separato.

CTA primaria: **«Parliamo del pilota ISEE»**, verso il modulo esistente. Microcopy: «Prima chiamata di 30 minuti con responsabile e operatore. Nessun impegno d'acquisto.» Secondaria: **«Guarda il fascicolo di esempio»**, verso la sezione operatore; la demo cittadino è utile ma un responsabile compra il flusso complessivo. Rendere scaricabile una versione pubblica della [proposta di una pagina](pilota.md#una-pagina-per-il-responsabile-caf), senza pubblicare il playbook interno, prezzi provvisori o riferimenti a file di repository non raggiungibili dal sito.

**Accettazione:** stesso calendario/numero sedi in hero, modulo, FAQ e proposta; nessuna candidatura presentata come attivazione immediata; cap e uscita leggibili nella proposta. Gratis fino a marzo è già in landing: rendere espliciti limiti e conversione separata.

## 2. Correggere le promesse troppo assolute sui documenti e sui tempi

**Impatto atteso: alto sulla fiducia.** Il titolo «Il fascicolo arriva pronto» può restare come messaggio, ma va qualificato subito: **«ordinato, con mancanti e dubbi da verificare»**. Oggi «ogni file viene ... controllato» e «se non va, lo dice subito» non distinguono processing, incertezza e fallback; la lista operatore collega i tempi della console al risparmio.

| Testo attuale / punto                               | Copy proposto                                                                                                                                                   | Evidenza                                                       |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Hero: «prepara la checklist, controlla i documenti» | «Prepara la checklist, organizza i documenti e segnala ciò che va verificato. L'operatore controlla il fascicolo e prosegue nel gestionale.»                    | [Architettura](../ARCHITECTURE.md)                             |
| Passaggio Carica: controllo immediato di ogni file  | «Carica foto o PDF. Avanti li analizza e propone dove inserirli. Quando il controllo è incerto o non disponibile, lo segnala: la verifica resta all'operatore.» | [Fallback e background](../../README.md)                       |
| «Tempi ... per sapere quanto si risparmia davvero»  | «Nel pilota misuriamo tempi, documenti mancanti e lavoro di passaggio al gestionale, insieme agli operatori.»                                                   | [API: intervalli ≠ minuti attivi](../API.md#metriche-e-limiti) |
| «Tutto in italiano, qualunque lingua»               | «La console è in italiano. Il cittadino può usare una delle otto lingue disponibili; l'originale resta consultabile.»                                           | [Lingue del prodotto](../ARCHITECTURE.md)                      |
| «Integrazioni ... senza telefonate»                 | «Chiedi le integrazioni nel link del cittadino; mantieni il contatto abituale quando serve.»                                                                    | [Guida operatore](../guide/operatori.md)                       |

**Accettazione:** un CAF comprende che l'AI può sbagliare, alcuni campi restano da leggere, il fascicolo può essere incompleto e i risultati del pilota non sono già ottenuti. Non aggiungere percentuali ipotetiche di risparmio accanto alle statistiche ufficiali di mercato.

## 3. Mostrare il passaggio concreto al gestionale

**Impatto atteso: alto.** La FAQ attuale è corretta ma il handoff è relegato in fondo. Aggiungere subito dopo la sezione operatore una striscia di tre passaggi:

> **Il lavoro prosegue nel vostro gestionale.**
>
> 1. L'operatore verifica documenti e mancanti.
> 2. Scarica il riepilogo PDF o i dati JSON; consulta il prospetto DSU con la fonte di ogni campo.
> 3. Copia i dati e carica gli originali nel software del CAF, con la procedura provata insieme durante l'onboarding.

Nota breve: «Gli originali si scaricano separatamente. Le integrazioni dirette si definiscono con i piloti.» Il prospetto **non estrae automaticamente importi** dai documenti. Fonte: [prospetto DSU](../research/dsu-prospetto.md), [API/export](../API.md), [integrazioni](../research/integrations.md).

**Accettazione:** niente loghi CODYCE/Zucchetti presentati come partner o connettori attivi. Eventuali nomi servono solo a dire «proviamo il passaggio nel software che usate», con versione e limiti nell'offerta. Un import automatico va mostrato soltanto dopo prova specifica.

## 4. Sostituire la prova sociale mancante con prove di prodotto oneste

**Impatto atteso: alto prima dei primi clienti.** Oggi il fascicolo ha già la didascalia «Esempio con dati inventati»: mantenerla. Aggiungere un breve walkthrough dello stesso caso fittizio: documento sbagliato → integrazione → revisione → export. Proposta di video 60–90 secondi da produrre in un lavoro separato, senza registrare cittadini reali.

Un blocco utile ora:

> **La prova che stiamo cercando**
> Con i primi sportelli misureremo minuti attivi, completezza al primo invio e lavoro di copia nel gestionale. Pubblicheremo metodo, campione e limiti del risultato.

Le [fonti ISEE](../research/isee-2027.md) e i [controlli documentati](../SECURITY.md) sono prove tecniche/normative, **non testimonianze clienti**. I dati [INPS sul 71% nel trimestre](https://www.inps.it/it/it/inps-comunica/notizie/dettaglio-news-page.news.2026.02.osservatorio-su-dsu-e-isee-i-dati-2016-2025.html) e [MLPS sull'85% CAF](https://lavoro.gov.it/documenti-e-norme/studi-e-statistiche/rapporto-isee-2024) sostengono il problema stagionale, non l'efficacia di Avanti.

Dopo il pilota: citazione autorizzata di un operatore, sede e periodo, numerosità per percorso, tempo netto medio/mediano, integrazioni e abbandoni. Pubblicare anche un risultato nullo se metodologicamente utilizzabile. Nessun logo senza permesso, stelle inventate, numero clienti dal database demo o «usato dai CAF italiani» prima di uso reale documentato.

## 5. Rendere il modulo meno impegnativo e il follow-up concreto

**Impatto atteso: medio-alto.** Sono già obbligatori soltanto nome, organizzazione, email e consenso al ricontatto; ruolo, telefono, sportelli e messaggio sono facoltativi. Non descrivere il modulo come un ostacolo da nove campi obbligatori. Tenere l'email di lavoro; mettere in un'area facoltativa i dettagli di qualifica.

Proposte: titolo «Verifichiamo se il pilota è adatto al tuo sportello»; domanda facoltativa «Quale gestionale usate?» da raccogliere nel messaggio o nella prima chiamata, senza richiedere subito un contratto API nuovo; suggerimento «Non inserire nomi o documenti dei cittadini». Rendere visibile chi segue le candidature usando **nome/recapito reale e approvato del team**, senza inventarlo.

La [route leads](../../packages/api/src/routes/public.ts) salva nel DB: non è documentato un invio email/notifica al team. Prima di promettere «ti rispondiamo entro due giorni lavorativi», definire un responsabile e una procedura di lettura delle candidature. Il messaggio attuale «Richiesta ricevuta» è corretto per il salvataggio; un appuntamento non è fissato. Questa ricerca non implementa notifiche o CRM.

**Accettazione:** successo solo dopo risposta API, testo che spiega il prossimo passo reale, errori leggibili e nessuna candidatura persa perché non c'è un processo di follow-up.

## 6. FAQ: mantenere le sei attuali e completare le obiezioni d'acquisto

**Impatto atteso: medio.** La pagina già risponde a account, privacy, assistenza, errore AI, gestionale e prezzo. Integrare senza duplicare:

| Domanda aggiuntiva                                    | Risposta proposta                                                                                                                                                                |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| «Quanto tempo deve dedicare lo sportello?»            | «Una formazione di un'ora, una settimana di misure del flusso abituale e mezz'ora di confronto a settimana. Il programma completo dura gennaio–marzo, dopo l'onboarding.»        |
| «Ci sono integrazioni automatiche con il gestionale?» | «Oggi forniamo PDF, JSON e prospetto DSU. Prima dell'avvio proviamo insieme il caricamento nel vostro software; non promettiamo un import automatico.»                           |
| «Se non funziona, possiamo uscire?»                   | «Sì, senza penali del pilota e senza rinnovo a pagamento automatico. Concordiamo restituzione di dati/file e cancellazione delle copie Avanti.»                                  |
| «Chi firma e trasmette la DSU?»                       | «Il CAF con le procedure e abilitazioni abituali. Avanti prepara i documenti, non calcola l'indicatore e non invia pratiche agli enti.»                                          |
| «Possiamo partecipare come centro affiliato?»         | «Verifichiamo con voi chi può autorizzare fornitore e trattamento dei dati: può servire il responsabile della rete.»                                                             |
| «Se l'AI non è disponibile?»                          | «Il percorso a regole resta utilizzabile; il controllo automatico dei documenti è limitato e la verifica è manuale. Per problemi di connessione continuate col flusso abituale.» |

Testi subordinati all'approvazione della [proposta pilota](pilota.md); riferimenti per le risposte in [obiezioni.md](obiezioni.md). Per smartphone e lingue lasciare chiara la possibilità di assistenza ordinaria, senza promettere modalità offline o voce nativa.

## 7. Prezzi: sì al pilota trasparente, aspettare per il listino permanente

**Impatto atteso: medio.** Mantenere «gratuito fino al 31 marzo 2027» e aggiungere cap concordato, nessun rinnovo automatico, cosa include e costi personalizzati separati. **Non pubblicare ora 129 € come prezzo già approvato**: il modello ha extra e sensibilità ai consumi, e la pagina attuale promette di definire il canone con i piloti.

Copy consigliato ora:

> **Il pilota è gratuito fino al 31 marzo 2027.** Formazione e volumi si concordano prima di partire. Entro marzo ricevete risultati e un'offerta separata per proseguire: nessun passaggio a pagamento automatico.

Dopo la scelta del fondatore e il test d'acquisto: mostrare il prezzo per **sportello**, quota inclusa, extra, IVA e un esempio per il mese di gennaio. Se si pubblica «da 129 €/mese», la quota di 150 e l'extra devono stare nello stesso blocco; l'ipotesi rete non diventa un'offerta self-service. [Modelli economici](prezzi.md).

## 8. Sicurezza: dare una prova leggibile al decisore e al DPO

**Impatto atteso: medio.** La pagina `/sicurezza` già elenca controlli e attività da completare prima dei dati reali. Portare vicino al modulo un collegamento «Documentazione per il responsabile e il DPO» con matrice dati/fornitori e condizioni del pilota, dopo preparazione e verifica effettiva.

Mostrare lo stato: «Controlli del software documentati; accordi e configurazione dei fornitori da completare per ciascun pilota». Non elevare test locali a certificazione. Nella FAQ distinguere **il ruolo CAF sui fascicoli** dal ruolo Avanti sui contatti commerciali della landing, descritto nell'[informativa del sito](<../../apps/web/src/app/(site)/privacy/page.tsx>). La frase «il CAF è titolare» non copre automaticamente ogni trattamento del sito. [Sicurezza](../SECURITY.md), [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj/ita).

## 9. Misurare candidature qualificate, non soltanto clic

**Impatto atteso: medio, abilitante.** Sequenza da osservare: visita landing → apertura esempio/pilota → modulo ricevuto → chiamata svolta → sede autorizzata → avvio → acquisto. KPI principale iniziale: **chiamate con decisore e problema documentale concreto / candidature valide**; poi sedi autorizzate/contatti. Nessun baseline o strumento analytics verificato in questa sessione.

Proposta operativa: registro commerciale minimale e aggregati della landing pubblica; nessun replay, tracker o URL con capability sulle pagine cittadino. Non usare contenuto dei fascicoli per lead scoring. [Regole sui link e logging](../SECURITY.md). Con pochi visitatori preferire cinque colloqui/osservazioni di comprensione ad A/B test senza potenza. Annotare fonte del contatto, motivo di rinuncia e data prossimo passo.

## Ordine di implementazione suggerito

Prima **1–3** (offerta, promesse, handoff), poi **4–6** (prova, follow-up, obiezioni), infine **7–9** dopo decisioni commerciali e operative. Il primo test di comprensione deve verificare che un responsabile sappia spiegare: chi verifica, cosa si esporta, impegno del pilota, condizioni d'uscita e prezzo ancora da decidere. Nessuna di queste proposte modifica il frontend in questo worktree.
