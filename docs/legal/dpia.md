> Bozza da far verificare da un legale/DPO; non è consulenza legale

# DPIA — Front office con AI per pratiche ISEE/730/permesso

Versione 0.1, 16 ottobre 2026. **Valutazione preliminare da completare per il CAF e
l'ambiente effettivi; non è un'autorizzazione ad avviare il trattamento.**
Responsabile della decisione: il CAF titolare. Avanti presta assistenza; il DPO,
se designato, fornisce il parere. Riferimento: [GDPR, artt. 35–36][gdpr].

## 1. Identificazione e perimetro

| Campo                                                    | Da compilare                                                                                                                                                     |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CAF, sede, referente e contatti                          | **da completare**                                                                                                                                                |
| DPO o valutazione dell'obbligo di designazione           | **da completare**, motivazione art. 37 GDPR                                                                                                                      |
| Gestore Avanti e referente sicurezza                     | **da completare**                                                                                                                                                |
| Versione sistema/ambiente                                | Repo esaminato `42c6700`; versione/deployment effettivo **da completare**                                                                                        |
| Sedi, operatori, persone/anno e picchi, minori coinvolti | **da completare**; non assumere automaticamente piccola scala                                                                                                    |
| Primo trattamento ammesso                                | ISEE ordinario 2027; date e limiti quantitativi del pilota **da completare**                                                                                     |
| Estensioni in esame                                      | 730 e permesso: sezioni dedicate sotto, **non autorizzate per implicito** dal pilota ISEE                                                                        |
| Documenti collegati                                      | [Accordo](accordo-art28.md), [fornitori](sub-responsabili.md), [registro](registro-trattamenti.md), [informativa](informativa-cittadino.md), [AI Act](ai-act.md) |

## 2. Motivo della DPIA e screening

Il trattamento combina dati economici altamente personali, dati di familiari/minori
e altre persone vulnerabili e tecnologie AI per testo, documenti e audio. La scelta
proposta è svolgere una DPIA prima dei dati reali, anche nel pilota. Non si desume
l'obbligo dalla sola presenza di AI: si valutano contesto ed effetti sulle persone.

La verifica usa il [provvedimento Garante n. 467/2018][garante] e il relativo
[elenco allegato][elenco], in particolare punto 6 (trattamento non occasionale di soggetti
vulnerabili) e punto 7 (tecnologie innovative insieme ad almeno un altro criterio di rischio);
il provvedimento richiama anche dati altamente personali, combinazione di archivi,
scoring ed impedimento all'accesso a servizi. L'elenco non esaurisce l'art. 35.
**Da completare:** applicabilità puntuale delle voci dell'allegato alla sede concreta
e motivazione del titolare, senza presumere larga scala, profilazione o decisioni
automatizzate per il solo uso di un chatbot. Fonte di supporto: [scheda DPIA Garante][scheda].

| Criterio                        | Valutazione preliminare Avanti                                                                                                                                             |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dati altamente personali        | Presente: identità, patrimoni, redditi, composizione familiare; possibili dati art. 9                                                                                      |
| Vulnerabilità                   | Presente: minori nel nucleo, persone con disabilità, difficoltà economiche/linguistiche/digitali; essere straniero non basta da solo, il contesto può creare vulnerabilità |
| Innovazione                     | Presente: comprensione del racconto, estrazione/lettura documenti, traduzioni, trascrizione e copilota                                                                     |
| Abbinamenti/riuso               | Riuso esplicito entro CAF e gruppo famiglia, non correlazione indiscriminata tra archivi; esaminare comunque visibilità e aspettative                                      |
| Scoring/decisioni significative | Nessuna concessione/rifiuto prestazione nel perimetro dichiarato; completezza/priorità possono influenzare l'assistenza: verificare l'uso reale                            |
| Larga scala/monitoraggio        | Volumi e organizzazione **da completare**; audit accessi distinto dal monitoraggio sistematico del cittadino                                                               |
| Accesso a diritti/servizi       | Rischio indiretto se un errore o blocco impedisce assistenza; deve restare un percorso umano effettivo                                                                     |

## 3. Descrizione e ciclo dei dati

1. Il cittadino apre QR/link dello sportello, sceglie la lingua e riceve l'informativa
   del CAF e l'avviso AI. Il link casuale identifica il fascicolo, non prova identità
   e rappresentanza. Il CAF verifica queste ultime dove necessario.
2. Racconto, domande, conferme e messaggi producono il fascicolo; il nucleo comprende
   adulti, minori e possibili terzi. Recapiti e lingua sono associati; la UI richiede almeno telefono o email, mentre
   il contratto API ammette entrambi assenti. Motivare il requisito e il percorso assistito.
3. Documenti di identità, reddituali, bancari, immobiliari e del verticale vengono
   caricati. Possono rivelare salute/disabilità o altri dati particolari. Documenti
   giudiziari non sono ammessi al primo pilota senza perimetro art. 10 approvato.
4. Regole locali e, se abilitate, chiamate AI per singolo compito propongono risposte,
   leggono documenti, traducono e preparano riepiloghi/prospetti. I contenuti minimizzati
   transitano per l'intera catena approvata; un documento può comunque contenere molti
   dati non necessari al singolo campo. L'audio facoltativo è elaborato in memoria;
   il testo inviato e le conversazioni seguono il fascicolo.
5. Il cittadino conferma le risposte; l'operatore verifica documenti e valori proposti,
   chiede integrazioni ed esporta. Avanti non invia la pratica a enti e non attribuisce
   il diritto alla prestazione. Il CAF usa il gestionale/archivio ufficiale distinto.
6. Email operative minime possono partire verso l'indirizzo fornito, non verificato.
   Per rinnovi ISEE gli inviti richiedono consenso dedicato e preferenza CAF; contengono
   il link personale. L'outbox è cifrata, il recapito non è cifratura end-to-end.
7. Riuso e rinnovo sono espliciti entro CAF: niente fusione automatica per CF/nome;
   nucleo attuale da confermare, dati economici annuali non copiati, verifiche documentali
   nuove. La preparazione del nuovo fascicolo e la sua base sono distinte dall'invito.
8. Il cron applica retention e retry dei file; audit e backup hanno termini separati.
   Solo per ISEE già inviato con consenso versionato e contatto utile, alla retention
   resta un promemoria minimo autonomo: CAF/sportello, lingua, anno/riferimento,
   nomi/contatti già forniti, ruoli/nomi/anni di nascita del nucleo, data/versione del
   consenso e gruppo tecnico. Esclusi CF, data completa di nascita, documenti/file,
   risposte economiche, messaggi e note. Scade a fine 31 marzo dell'anno seguente
   alla pratica (es. 2027 → marzo 2028, Roma), escluso subito dalle query e cancellato
   al cron successivo; revoca o erasure lo cancellano subito. L'hash del vecchio link
   permette solo revoca, mai lettura/nuovo consenso. I binari condivisi sopravvivono
   finché esiste un altro riferimento legittimo.

Flusso: cittadino → applicazione UE → DB e storage privato UE; applicazione → eventuale
router/endpoint testo, visione, audio approvato; applicazione → email → casella cittadino;
operatore → export → archivio CAF. **Da completare:** diagramma dei paesi reali, supporto,
CDN/log, backup, caselle e tutti i destinatari della catena in [sub-responsabili](sub-responsabili.md).
Nessun contratto o deployment reale è stato verificato da questa analisi documentale.

## 4. Necessità, proporzionalità e basi

| Finalità/mezzo           | Valutazione e decisione richiesta                                                                                                                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Intake e fascicolo       | Serve a preparare il servizio richiesto; raccogliere solo campi/documenti del verticale. CAF identifica base art. 6, norma/mandato e necessità dei singoli dati **[da completare]**                              |
| Dati salute/disabilità   | Una base art. 6 non basta: condizione art. 9 e garanzie nazionali **[da completare]**. Non usare consenso generico o interesse legittimo come titolo autonomo per l'art. 9                                       |
| Dati art. 10             | Esclusione dal primo pilota salvo precisa norma/autorizzazione e garanzie **[da completare]**; permesso di soggiorno non è di per sé dato giudiziario                                                            |
| Familiari/terzi          | Verificare necessità, rappresentanza e informativa art. 14 dove raccolti indirettamente; non presumere che il dichiarante possa consentire per tutti                                                             |
| AI e documenti integrali | Valutare per compito utilità rispetto a regole/assistenza umana, qualità nelle lingue e invio del documento completo. Niente training. Disabilitare il compito se garanzie/necessità non dimostrate              |
| Audio                    | Canale facoltativo alternativo a testo/sportello, nessuna identificazione biometrica prevista. Non registrare terzi; ZDR audio da documentare                                                                    |
| Email servizio           | Contatto facoltativo; distinguere integrazione, ricevuta e disponibilità. Base coerente con il servizio **[da completare]**; mantenere alternativa senza email                                                   |
| Inviti rinnovo           | Consenso dedicato; backend registra data/versione per lingua, snapshot testi nel core, revoca cittadino anche dopo retention e canale CAF. Promemoria minimo fino al marzo seguente, senza CF/file/economia; nessuna proroga fascicolo. Necessità dei dati familiari, informativa, rappresentanza e basi **da completare dal CAF/DPO** |
| Sicurezza e audit        | Necessità di ricostruire accessi, contrastare abusi e proteggere il servizio; motivare basi e termine di 365 giorni, accesso admin, diritti operatori. Audit non anonimi                                         |
| Metriche                 | Finalità organizzativa del pilota; usare aggregati e soppressione celle piccole. Non equiparare pseudonimizzazione ad anonimizzazione né riusare per controllo individuale dei lavoratori senza analisi separata |

Il CAF approva la matrice puntuale in [registro-trattamenti](registro-trattamenti.md)
e l'informativa. Le alternative sono moduli/regole senza chiamate AI e assistenza in
sede: meno invii esterni, maggiore lavoro umano. **Da completare:** confronto documentato
di benefici, accuratezza, accessibilità e carico operatori nella sede, senza assumere
che l'AI sia necessaria per ogni passaggio.

## 5. Conservazione e diritti

L'[allegato C dell'accordo](accordo-art28.md#allegato-c--tempi-e-cancellazione) riporta
default e limiti: link 60 giorni, fascicoli 180 dalla chiusura o scadenza link, audit
365 dall'evento, outbox 7/30 giorni, backup proposti 7 giorni. Sono durate da approvare,
con purge a lotti e ritardi da monitorare. Non sono termini di legge per DSU/730/permesso.
Con 180 giorni i documenti dell'ISEE precedente potrebbero non essere più disponibili
per rinnovi: non allungare tutto il trattamento per compensare questa limitazione.

Il CAF identifica il richiedente, tutela terzi e prepara accesso/rettifica; Avanti
assiste con export e cancellazione di fascicolo/gruppo famiglia. Limitazione,
copie già esportate, backup e dati dei fornitori richiedono procedura anche manuale.
Non è attestato un flusso automatico completo di tutti i diritti. Inserire referenti,
canale riservato e prova con richiesta sintetica **[da completare]**.

## 6. Metodo di rischio

Scala proposta: probabilità P e gravità G da 1 (bassa) a 4 (molto alta); R=P×G:
1–3 basso, 4–7 medio, 8–11 alto, 12–16 molto alto. La gravità misura conseguenze
sulle persone: perdita economica/diritti, discriminazione, esposizione sanitaria,
furto d'identità e sicurezza familiare, non soltanto danno commerciale ad Avanti.

Le stime sono ipotesi da validare dal CAF/DPO. Il residuo indicato è **obiettivo solo
dopo le misure e le prove**; dove queste mancano lo stato è «aperto», senza accettazione
del rischio. Un punteggio medio non neutralizza automaticamente un rischio elevato
ai sensi dell'art. 36; serve giudizio motivato, specie su impatti gravi poco probabili.

| ID / scenario e danno                                                                   | Iniziale P×G | Misure nel repo e integrazioni richieste                                                                                                                                                              | Residuo obiettivo / stato / responsabile                                                              |
| --------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| R1 Link rubato/inoltrato: esposizione del nucleo e furto identità                       | 3×4=12       | Token 256 bit/hash/scadenza/revoca, no-referrer nelle pagine; collaudare proxy senza token, distribuzione e recupero. Email rinnovo espone capability alla casella/provider                           | 1×4=4; **aperto** fino a prova canali; CAF + Avanti                                                   |
| R2 Accesso tra CAF o abuso operatore/admin: divulgazione patrimoniale/sanitaria         | 3×4=12       | Tenant da sessione, ruoli, audit e revoche. MFA implementata ma da imporre, accessi tecnici minimi, revisione privilegi; non presumere isolamento per sede                                            | 1×4=4; **aperto** fino a collaudo produzione e matrice accessi; Avanti + CAF                          |
| R3 Minori/famiglia: documento di un componente visto da altro non autorizzato           | 3×4=12       | Visibilità del riuso esplicita, gruppo opaco, nessun match automatico; verificare rappresentanza e informativa indiretta, casi separazione/conflitto e recapiti condivisi                             | 1×4=4; **aperto** fino a procedura CAF e test assistiti; CAF                                          |
| R4 Documenti art. 9 o art. 10 inviati senza titolo/minimizzazione                       | 3×4=12       | Checklist per verticale e input minimo; documento può contenere dati eccedenti. CAF definisce basi, filtra raccolta non necessaria e gestisce upload inattesi. Art. 10 fuori pilota salvo revisione   | 1×4=4; **aperto**, nessun avvio senza basi e regole di raccolta; CAF/DPO                              |
| R5 Provider/router conserva, addestra o trasferisce senza garanzie                      | 3×4=12       | Filtri strict, invio minimo, fallback locale. Contratti ZDR/no training, mappa endpoint/riserve/audio, paesi, SCC/valutazione e supporto da completare                                                | 1×4=4; **aperto**, AI esterna non attivabile senza evidenze; Avanti + CAF/DPO                         |
| R6 Errori AI, traduzioni o annualità: rinuncia, ritardo o esclusione da prestazione     | 3×4=12       | Regole versionate, output validati, proposte confermate, revisione umana, fallback. Prove per lingua/verticale e canale operatore; evitare approvazioni automatiche di fatto                          | 1×4=4; **aperto** fino a prova con operatori, verifica norme annuali e carico revisione; CAF + Avanti |
| R7 Prompt injection/istruzioni nei file: contenuti ingannevoli o fuga dati              | 3×4=12       | Delimitatori input, guard, schemi, contesto minimo e nessuna esecuzione istruzioni; rilevatori euristici limitati. Aggiornare prove e procedura di segnalazione                                       | 1×4=4; **aperto** per configurazione reale; Avanti                                                    |
| R8 File malevoli compromettono postazione/servizio                                      | 3×4=12       | Controlli formato/size/PDF attivi, allegato e header; antivirus e decodifica isolata completa non attestati. Decidere scansione/isolamento, viewer e misure postazioni                                | 2×4=8; **alto e aperto** fino a rimedio o rivalutazione motivata; Avanti + CAF                        |
| R9 Retention estesa/restore reintroduce dati: esposizione e perdita controllo           | 3×4=12       | Purge, retry e gruppo famiglia; file all'ultimo riferimento. Approvare tempi, monitorare backlog, gestire export e backup, riapplicare revoche da registro separato                                   | 1×4=4; **aperto** fino a prove purge/restore; Avanti + CAF                                            |
| R10 Email errata o rinnovo non voluto: divulgazione di relazione CAF e accesso con link | 3×3=9        | Email non verificata, quote destinatario; outbox cifrata e rivalidazione. Consenso separato con data/versione per lingua; revoca via capability di sola revoca dopo retention o CAF, promemoria eliminato subito. Definire consegna sicura, no tracking e collaudo UI/provider                                       | 2×3=6; **aperto**, valutare impatto 4 per link a dati particolari; CAF + Avanti                       |
| R11 Indisponibilità/perdita file: impossibilità o ritardo nell'assistenza               | 3×3=9        | Fallback e recupero lavori; backup DB/file e restore sono runbook da attivare, non prova operativa. Canale assistito alternativo e scadenze presidiate                                                | 1×3=3; **aperto** fino a restore e piano continuità; Avanti + CAF                                     |
| R12 Export/log/ticket/metriche reidentificabili o copiati                               | 3×4=12       | Log applicativi minimizzati, audit pseudonimi, export riservato; verificare log infrastruttura, destinazioni, dispositivi e cancellazione copie. Analizzare telemetria senza contenuti                | 1×4=4; **aperto** fino a disciplina copie; Avanti + CAF                                               |
| R13 Esclusione digitale/linguistica di stranieri o persone disabili                     | 3×3=9        | Otto lingue e alternativa sportello dichiarate; fallback ha limiti semantici. Provare accessibilità e traduzioni, canale umano realmente disponibile senza penalizzazioni                             | 1×3=3; **aperto** fino a prove e organizzazione; CAF + Avanti                                         |
| R14 Riuso/rinnovo conserva nucleo errato o supera revoca/retention                      | 3×3=9        | Conferma nucleo; promemoria con sola allowlist, senza CF/file/economia, scadenza fissa al marzo seguente; consenso versionato senza backfill, revoca immediata del promemoria nel gruppo e controllo prima invio. Lock CAF comuni e family-erasure anche da sorgente eliminata; UI e Postgres/provider da collaudare | 1×3=3; **aperto**, limitare campagna finché i controlli non sono operativi; CAF + Avanti              |

## 7. Estensioni da valutare separatamente

**730:** documenti fiscali e familiari, oneri/spese anche sanitarie, possibili dati
particolari indiretti. Prima dell'attivazione completare categorie/necessità,
art. 6 e art. 9, modelli annuali e conservazione per categoria; non riusare la policy
DSU né promettere invii ad Agenzia Entrate. Rivalutare i rischi di AI su deduzioni,
importi e dichiarazioni e il peso della revisione umana.

**Permesso di soggiorno:** identità, nazionalità, soggiorno, familiari e lavoro;
alcuni documenti possono rivelare origine etnica, salute o dati giudiziari, senza
che ogni permesso rientri automaticamente negli artt. 9/10. Specificare tipi di
procedimento, rappresentanza e destinatari; escludere valutazione di attendibilità,
rischio/frode e raccomandazioni su ammissibilità. Nuova analisi Allegato III, punto
7(c) AI Act e rapporti con autorità, oltre a art. 5(a) dove pertinente. Nessuna
classificazione ufficiale specifica di Avanti è acquisita da questa bozza.

## 8. Piano, consultazioni e decisione

| Azione prima dei dati reali                                                                | Owner                  | Scadenza / prova / esito                              |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------- |
| Completare basi per verticale, informativa art. 13/14, rappresentanza e diritti            | CAF + DPO/legale       | **da completare**                                     |
| Firmare DPA, censire/approvare catena, trasferimenti e matrice endpoint                    | Avanti + CAF           | **da completare**; in assenza AI esterna disabilitata |
| Imporre MFA, verificare accessi, canali link/email e log                                   | Avanti + admin CAF     | **da completare**                                     |
| Decidere trattamento file malevoli e rivalutare R8 alto                                    | Avanti + CAF/DPO       | **da completare**, eventuale consultazione art. 36    |
| Provare backup DB e binari, purge, riuso/famiglia e restore                                | Avanti + referente CAF | **da completare**, verbali con soli dati sintetici    |
| Provare lingue, accessibilità e revisione umana senza esclusione                           | CAF + Avanti           | **da completare**                                     |
| Approvare informativa del promemoria/necessità dei familiari; collaudare UI, versioni, revoca e scadenza backend | CAF + Avanti           | **da completare**, rinnovi non attivati prima         |
| Completare classificazione AI, trasparenza e formazione                                    | Avanti + CAF           | **da completare**, vedi memo AI Act                   |

**Parere DPO:** **[da completare; se non designato annotare valutazione e consulente]**.
**Opinioni degli interessati o rappresentanti, ove opportuno (art. 35.9):** proporre
sessioni assistite con rappresentanti di utenti/minori/disabilità e lingue; esiti e
modifiche **[da completare]**. Se non raccolte, motivare perché e quali alternative.
**Responsabile sicurezza:** evidenze e obiezioni **[da completare]**.

**Decisione titolare:** ☐ non avvio ☐ avvio dopo chiusura delle condizioni, con
motivazione e residui accettati **[da completare]**. Le caselle non sono preselezionate.
Se resta un rischio elevato non mitigabile, il titolare attiva la consultazione
preventiva ex art. 36 **prima del trattamento**, senza sostituirla con una firma di
accettazione. Stato di questa bozza: **aperto; R8 ancora alto, altre mitigazioni non
collaudate**. Non è attestata idoneità al trattamento reale.

Firma titolare/data **[da completare]**; presa visione Avanti e parere DPO **[da completare]**.
Riesame proposto almeno annuale e prima di nuove finalità/verticali, modifica di
provider/paesi, scala, retention, scoring, incidente o evidenza di errori/discriminazioni.
Prossima data e custode del documento **[da completare]**.

## Fonti e stato delle evidenze

Fonti ufficiali consultate il **16 ottobre 2026**: [GDPR artt. 5, 6, 9, 10, 25, 32,
35–36][gdpr]; [Garante 467/2018][garante], [allegato][elenco] e [scheda DPIA][scheda];
[AI Act](https://eur-lex.europa.eu/eli/reg/2024/1689/oj/ita);
[AgID, linee guida sul documento informatico](https://www.agid.gov.it/it/ambiti-intervento/gestione-documentale).
Le linee guida AgID distinguono la gestione/conservazione documentale dal semplice
deposito di file: Avanti non è attestato come sistema di conservazione conforme.
Non si presume che ogni obbligo PA si applichi automaticamente a un CAF privato.
Metodo/limiti delle consultazioni: [README](README.md#fonti-ufficiali-e-metodo-di-verifica).

Evidenze di prodotto: [SECURITY](../SECURITY.md), [DEPLOY](../DEPLOY.md),
[AI](../decisions/ai-platform.md), [riuso](../decisions/document-reuse.md),
[rinnovi](../decisions/renewals.md). Misure nel repo distinte da contratti e prove di
deployment **da completare**; punteggi di rischio sono valutazioni di questa bozza.

[gdpr]: https://eur-lex.europa.eu/eli/reg/2016/679/oj/ita
[garante]: https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/9058979
[elenco]: https://www.garanteprivacy.it/web/guest/home/docweb/-/docweb-display/docweb/9059358
[scheda]: https://www.garanteprivacy.it/it/valutazione-d-impatto-della-protezione-dei-dati-dpia-
