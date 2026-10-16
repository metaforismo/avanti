> Bozza da far verificare da un legale/DPO; non è consulenza legale

# Avanti e AI Act — posizione preliminare per il pilota

Versione 0.1 del **16 ottobre 2026**. Destinazione d'uso e classificazione richiedono
approvazione del gestore e verifica legale con il CAF. Questo memo aggiorna la lettura
di [regulation.md](../research/regulation.md) senza modificarlo e non certifica conformità.

## 1. Sintesi della posizione

**Valutazione condizionata:** Avanti prepara un fascicolo mediante regole e AI, senza
concedere/rifiutare prestazioni né trasmettere pratiche agli enti. Il perimetro attuale
può risultare fuori da un caso d'uso dell'Allegato III oppure, se vi rientra, beneficiare
del filtro dell'art. 6.3 per compiti limitati/preparatori senza influenza materiale
sulla decisione e senza rischio significativo. Non è acquisita una qualificazione
ufficiale specifica di Avanti/CAF. La conclusione va motivata per versione e verticale:
non basta dire «c'è un operatore» o «il CAF è privato».

Riferimenti vincolanti: [AI Act 2024/1689, artt. 3, 6, 49, 50 e Allegato III][aia],
come modificato dal [regolamento UE 2026/1744][omnibus]. La qualificazione GDPR
titolare/responsabile non determina quella AI Act: le due analisi restano distinte.

## 2. Ruoli, sistema e destinazione d'uso

Il gestore che sviluppa/mette in servizio Avanti sotto il proprio nome è il candidato
**fornitore del sistema**; il CAF che lo usa nell'attività professionale è il candidato
**deployer**. Identità del gestore e catena di ruoli effettiva **da completare**. I
fornitori dei modelli/router hanno ruoli propri, che non assorbono gli obblighi del
fornitore Avanti. Un cambio di destinazione o modifica sostanziale può mutare i ruoli
e gli obblighi; non delegare la valutazione al solo marchio del modello (artt. 3 e 25).

Sistema esaminato al commit `42c6700`: intake, intervista con proposte confermate,
lettura documenti, assistente, traduzione e trascrizione, riepilogo/incongruenze,
prefill DSU da verificare e bozze di integrazione. Regole del catalogo determinano
domande/requisiti; AI propone, segnala e riassume. Nessuna domanda ufficiale è inviata
da Avanti. Primo pilota ISEE ordinario 2027; 730 e permesso richiedono attivazione e
valutazione dedicate. I rinnovi preparano un fascicolo e inviti con consenso, non
rinnovano una prestazione presso l'ente.

L'AI è inclusa nel servizio: il CAF non compra token, non sceglie modelli o chiavi;
Avanti gestisce la configurazione. Restano al CAF gli interruttori cittadini/copilota,
la supervisione e le istruzioni privacy; il gestore deve comunque rendere conoscibile
la catena dei sub-responsabili, pur senza un pannello di scelta modelli.

## 3. Classificazione per uso effettivo

| Perimetro              | Criterio normativo                                                                                                                                                       | Valutazione da finalizzare                                                                                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ISEE/front office      | Allegato III 5(a): uso da/per autorità per valutare ammissibilità a prestazioni/servizi di assistenza pubblica essenziali o concederli/ridurli/revocarli/recuperarli     | Esaminare mandato e ruolo del CAF, utilizzo concreto del fascicolo e influenza sui diritti. Preparare DSU non equivale automaticamente a decidere una prestazione, ma non basta per escludere il caso d'uso              |
| 730 preparatorio       | Non diventa high risk soltanto perché tratta dati fiscali; verificare se funzioni effettive ricadono in un caso d'uso specifico                                          | Non estendere automaticamente né inclusione né esclusione ISEE; nessun motore di ammissibilità/controllo fiscale dell'autorità attestato                                                                                 |
| Permesso               | Allegato III 7(c): sistemi da/per autorità competenti che assistono l'esame di asilo/visti/permessi e reclami quanto all'ammissibilità, inclusa affidabilità delle prove | Supportare il richiedente a ordinare documenti non è automaticamente uso per conto dell'autorità; verificare rapporti e funzioni. Ogni estensione a valutazione rischio/credibilità/ammissibilità richiede nuova analisi |
| Priorità e completezza | Uno stato/indice preparatorio può influenzare tempi e accesso anche se non decide il diritto                                                                             | Provare che errori o blocchi hanno revisione e canale umano e che non selezionano chi può ricevere assistenza                                                                                                            |
| Profilazione           | In un sistema ricompreso nell'Allegato III la profilazione rende il sistema sempre high risk ai fini dell'art. 6.3                                                       | Valutare finalità valutativa effettiva degli output, non il solo nome «riepilogo»; escludere scoring di merito/frode/affidabilità e negazione automatica                                                                 |

Se l'uso ricade nell'Allegato III, l'art. 6.3 richiede assenza di rischio significativo
per salute, sicurezza e diritti fondamentali, anche perché non influenza materialmente
l'esito decisionale, e almeno una delle condizioni previste. Per Avanti sono ipotesi
da esaminare **compito procedurale limitato** e **compito preparatorio**; il considerando
53 cita, tra gli esempi, strutturazione e classificazione documenti. Non è un'esenzione
generale per ogni software che produce documenti. Fonte: [art. 6 e considerando 53][aia].

**Se si invoca il filtro:** conservare autovalutazione documentata, destinazione,
funzioni, effetti, motivazione e prove; verificare registrazione ex art. 49.2 e dati
richiesti dall'Allegato VIII nella versione vigente. L'Omnibus mantiene tale via e
ne semplifica le informazioni (considerando 22). Il rinvio delle sezioni 1–3 del Capo
III non comprende espressamente art. 49, nella sezione 5: non assumere che il memo
permetta di rimandare ogni registrazione al dicembre 2027. **Da completare prima della
messa in servizio:** parere sul coordinamento temporale, procedura/banca dati disponibile
e ricevuta ove richiesta. Se il sistema è fuori dall'Allegato III, questa registrazione
non nasce dal solo uso di AI. Fonti: [artt. 6.4 e 49 AI Act][aia], [Omnibus][omnibus].

**Se la conclusione è high risk:** predisporre il percorso del fornitore (rischi,
dati, documentazione tecnica, log, supervisione, accuratezza/robustezza/cybersecurity,
qualità e conformità) e quello del deployer (istruzioni, controllo umano, monitoraggio,
registri e segnalazioni pertinenti). Valutare art. 27, anche per enti privati che
erogano servizi pubblici, e valutazione dei diritti fondamentali. La DPIA può essere
richiamata nelle parti pertinenti secondo art. 27 modificato, senza sostituire gli
elementi mancanti. Non dichiarare questi obblighi già assolti dal presente pacchetto.

## 4. Calendario verificato e confronto con la ricerca

| Regola                                                    | Stato al 16 ottobre 2026                                                                                                                                             |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Regolamento 2026/1744 — Omnibus AI                        | Adottato 8 luglio, GU 24 luglio, in vigore 27 luglio 2026; non è soltanto una proposta                                                                               |
| Capitoli I–II / alfabetizzazione                          | Applicazione dal 2 febbraio 2025; art. 4 sostituito dall'Omnibus: misure per sostenere alfabetizzazione, senza obbligo di garantire un livello individuale specifico |
| Trasparenza interazione art. 50.1                         | Applicabile dal **2 agosto 2026**, dunque già rilevante prima del pilota gennaio 2027                                                                                |
| Capo III sezioni 1–3, sistemi Allegato III                | **2 dicembre 2027**, salvo eccezione art. 6.5; non è un rinvio generale dell'intero regolamento                                                                      |
| Capo III sezioni 1–3, sistemi Allegato I                  | **2 agosto 2028**, con la medesima eccezione; non è il perimetro tipico del front office in esame                                                                    |
| Art. 50.2 per sistemi già immessi prima del 2 agosto 2026 | Termine transitorio **2 dicembre 2026** secondo art. 111.4 modificato; non è una proroga generale per nuovi sistemi o per l'avviso chatbot                           |

Fonti: [AI Act artt. 50, 111 e 113][aia]; [Omnibus, art. 1(5), (39)–(40) e art. 4][omnibus].
L'art. 111 contiene ulteriori transitori per sistemi preesistenti: data di messa in
servizio e modifiche di Avanti **da completare**, senza presumere che un pilota dia
automaticamente diritto a deroghe. GDPR e obblighi di settore restano applicabili.

Il calendario principale di `regulation.md` è confermato dagli estratti ufficiali
consultati; questo memo aggiunge il raccordo al runtime corrente, audio, prefill e
rinnovi. Non tratta come definitive le bozze interpretative della Commissione citate
nel dossier del 5 ottobre; stato finale e applicabilità di eventuali ulteriori linee
guida sono **da ricontrollare prima del pilota**, senza sostituire il testo normativo.

## 5. Trasparenza verso il cittadino e contenuti sintetici

L'art. 50.1 richiede che chi interagisce direttamente sappia che si tratta di AI,
salvo le eccezioni previste; l'art. 50.5 richiede informazione chiara e distinguibile,
al più tardi alla prima interazione, conforme ai requisiti di accessibilità applicabili.
Per Avanti non conviene affidarsi alla sola presunta evidenza dell'interfaccia.
Testo proposto, da tradurre e provare nelle lingue attive:

> Stai usando un assistente AI per preparare la pratica del tuo CAF. Può sbagliare:
> controlla e conferma le risposte proposte. Un operatore verifica il fascicolo;
> Avanti non decide se hai diritto alla prestazione e non invia pratiche agli enti.
> Puoi chiedere assistenza allo sportello: **[recapito/percorso da completare]**.

Il backend restituisce già l'avviso automatico/AI localizzato all'apertura; `engine`
distingue AI/euristica e il PDF dichiara natura preparatoria e stato di verifica.
**Da completare:** prova della visualizzazione tempestiva in ogni ingresso reale,
compresi riapertura/rinnovo, microfono, fallback e lingue; leggibilità con tecnologie
assistive. L'avviso AI non sostituisce informativa GDPR né consenso eventualmente dovuto.

L'art. 50.2 sulla marcatura leggibile meccanicamente e rilevabilità di output sintetici
è distinto dal banner chatbot, con limiti ed eccezioni propri. **Da completare:** mappa
degli output Avanti (chat/testi, traduzioni, PDF), responsabilità lungo la catena,
applicabilità delle eccezioni e soluzione verificata con i fornitori. Il campo `engine`
o una nota PDF non dimostrano da soli di soddisfare l'obbligo. Non risultano funzioni
di generazione deepfake; eventuale pubblicazione di testi per informare il pubblico
richiederebbe esame separato dell'art. 50.4, non una deduzione dal fascicolo privato.

## 6. Supervisione umana: presente e da rendere effettiva

| Funzione presente nel prodotto                                                | Presidio operativo richiesto                                                                                                   |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Proposte intervista distinte dalle risposte confermate                        | Il cittadino può capire e correggere; assistenza se lingua o accessibilità impediscono controllo reale                         |
| Core determina domande/requisiti e convalida output AI                        | Verifica annuale di catalogo e fonti; nessun requisito inventato dal modello                                                   |
| Documenti analizzati con esiti da verificare; prefill con evidenze e conferme | L'operatore legge fonti/documenti ed è autorizzato a correggere/rifiutare; niente semplice approvazione rituale                |
| Fallback locale e interruttori CAF                                            | Spiegare limiti: euristica non attesta leggibilità/titolarità; mantenere accesso allo sportello                                |
| Audit e revisioni                                                             | Tracciare controlli effettivi senza contenuti nei log; non confondere audit tecnico con completa evidenza di conformità AI Act |
| Rinnovo con nucleo da riconfermare                                            | Nessun riuso delle risposte economiche annuali; operatore non conferma il nucleo al posto del cittadino                        |

Formazione proposta art. 4: limiti AI e automazione, errori/lingue, protezione dei
documenti, prompt injection, correzione/escalation, uso del fallback e alternative.
Avanti prepara materiali e il CAF nomina i supervisori e assegna tempo/autorità per
verificare. **Da completare:** partecipanti, date, prove pratiche, registrazione della
formazione e aggiornamenti; non promettere un certificato obbligatorio non previsto.

## 7. Scheda di decisione da approvare prima del pilota

| Campo                                                     | Decisione/evidenza                                                                                                                                    |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fornitore/deployer e versione/destinazione d'uso          | **da completare**, responsabili e firma                                                                                                               |
| Allegato III applicabile per ISEE, 730, permesso          | **da completare per ciascuno**; motivare anche l'eventuale esclusione                                                                                 |
| Filtro art. 6.3, profilazione e influenza sulle decisioni | **da completare** con casi e prove, non solo descrizione commerciale                                                                                  |
| Documentazione/registrazione o percorso high risk         | **da completare** con parere temporale e adempimenti pertinenti                                                                                       |
| Trasparenza art. 50.1/50.5 e verifica art. 50.2           | **da completare**, schermate/verbali e responsabilità lungo la catena                                                                                 |
| Supervisori, formazione e percorso assistito              | **da completare**                                                                                                                                     |
| Prossimo riesame e trigger                                | Prima del pilota, cambi funzioni/provider, nuovi scoring/verticali, effetti discriminatori, incidenti o nuove fonti ufficiali; data **da completare** |

Firme gestore Avanti **[da completare]**, CAF per uso e supervisione **[da completare]**;
parere legale **[da completare]**. Non indicare «AI Act compliant» come effetto della
sola firma né qualificare il pilota come sandbox regolamentare autorizzata.

## Fonti ufficiali e limiti

Consultazione **16 ottobre 2026**: [AI Act 2024/1689][aia], [Omnibus AI 2026/1744][omnibus],
[consolidato EUR-Lex al 27 luglio 2026](https://eur-lex.europa.eu/eli/reg/2024/1689/2026-07-27/ita).
Le ricerche sui testi ufficiali hanno confermato calendario, art. 4, Allegato III,
art. 50 e mantenimento della registrazione con semplificazione; l'accesso diretto
integrale EUR-Lex ha restituito una verifica automatica anti-bot. Il legale deve
controllare i testi integrali coordinati e gli atti successivi prima della firma;
non è dichiarata una lettura integrale del consolidato attraverso questa sessione.
Dettaglio del metodo in [README](README.md#fonti-ufficiali-e-metodo-di-verifica).

Riscontri tecnici in [ARCHITECTURE](../ARCHITECTURE.md), [SECURITY](../SECURITY.md),
[decisione AI](../decisions/ai-platform.md) e [rinnovi](../decisions/renewals.md).
Le conclusioni sulla classificazione sono inferenze per il progetto, distinte dalle
previsioni di legge. Nessuna decisione ufficiale ad hoc è stata acquisita.

[aia]: https://eur-lex.europa.eu/eli/reg/2024/1689/oj/ita
[omnibus]: https://eur-lex.europa.eu/eli/reg/2026/1744/oj
