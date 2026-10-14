# Pilota ISEE: proposta e onboarding

**14 ottobre 2026. Proposta commerciale da approvare**, non accordo firmato, cliente acquisito o risultato. Perimetro di prodotto: [README](../../README.md), [roadmap](../ROADMAP.md). La proposta alla sede sotto è pensata come una pagina; il playbook è materiale interno separato.

## Una pagina per il responsabile CAF

### Prepariamo insieme il picco ISEE di gennaio

**Obiettivo.** Verificare se Avanti riduce il lavoro di preparazione e i documenti mancanti prima dell'appuntamento. La checklist si adatta al nucleo; il cittadino entra da un link o QR senza installare app, anche nelle otto lingue disponibili. L'operatore trova documenti ordinati e segnalazioni da controllare. La pratica ufficiale resta al CAF, nel gestionale abituale.

**Cosa ricevete.** Una sede configurata, accessi personali agli operatori, cartello QR, formazione di un'ora e prove guidate; fascicolo PDF/JSON e prospetto DSU, controllo umano e richieste d'integrazione. Nessuna integrazione automatica promessa: prima proviamo insieme il caricamento nel vostro gestionale. Supporto del team e report finale con dati aggregati, inclusi eventuali risultati negativi. [Guida operatore](../guide/operatori.md).

**Tempi e prezzo.** Onboarding di due settimane a novembre/dicembre 2026; utilizzo gennaio–marzo 2027. SaaS **gratuito fino al 31 marzo**, massimo **500 fascicoli consegnati per sede nel trimestre**; eventuale aumento concordato prima dell'utilizzo extra. Tre sedi nel programma, massimo 1.500 consegne complessive. Nessun rinnovo a pagamento automatico. La gratuità copre configurazione e formazione standard; attività personalizzate solo dopo preventivo accettato.

**Cosa chiediamo.** Un referente con autorizzazione della rete e un operatore di riferimento; un'ora di formazione; una settimana di misure del lavoro abituale; inviti a casi consecutivi secondo protocollo, assistenza ordinaria sempre disponibile; mezz'ora di confronto settimanale. Verificate ogni documento e mantenete le procedure di mandato, firma e trasmissione del CAF. Gli accordi sui dati e le prove tecniche devono essere conclusi prima dei cittadini reali.

**Come decidiamo se funziona.** Concordiamo prima dell'avvio soglie operative: almeno **5 minuti netti risparmiati per fascicolo lavorato**, completezza al primo invio migliorata di almeno **15 punti percentuali**, almeno **70% di consegne sugli avvii**. Per acquistare, il valore economico stimato deve essere almeno **due volte il prezzo successivo**; per una sede piccola questo può richiedere più di cinque minuti. Conteggiamo anche abbandoni, assistenza e doppia digitazione, confrontando i percorsi nelle stesse settimane. Sono obiettivi del test, senza garanzia di risparmio. Errori critici o incidenti richiedono stop e revisione.

**Uscita e decisione.** Potete interrompere la sperimentazione senza penale. Restituiamo dati e documenti attraverso un canale concordato e verifichiamo la cancellazione delle copie secondo l'accordo, distinguendo i vostri obblighi d'archivio. Il 15 marzo presentiamo il report e un'offerta separata; entro il 31 marzo decidete se proseguire. Nome, logo e testimonianze si pubblicano solo con autorizzazione distinta; nessun obbligo di parlare bene di Avanti.

**Prossimo passo:** incontro di 30 minuti con responsabile e operatore, demo su una famiglia fittizia e prova di export nel vostro gestionale. [Dettaglio economico](prezzi.md), [sicurezza e avvio](../SECURITY.md), [uscita dal servizio](../research/data-portability.md).

---

## Playbook interno: dieci giorni lavorativi

**Prima di partire:** organizzazione CAF e poteri di firma verificati; gestione privacy/fornitori approvata; deploy e restore provati con dati sintetici; [prerequisiti di sicurezza](../SECURITY.md) completati. Le prove locali non attestano il deployment remoto. Nessun import di fascicoli reali per «fare la demo». Per la nomina e restituzione seguire [GDPR artt. 28 e 32](https://eur-lex.europa.eu/eli/reg/2016/679/oj/ita); il [mandato CAF INPS](https://www.inps.it/it/it/dettaglio-approfondimento.schede-informative.mandato-e-delega-al-caf-per-la-compilazione-della-dsu-e-il-calcolo-dell-isee.html) resta distinto dall'informativa Avanti.

| Giorno | Lavoro                                                                                                                           | Responsabile                 | Evidenza per passare al giorno successivo                                                |
| ------ | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------- |
| 1      | Kickoff: sede, pratiche ammesse, lingue effettive, canale inviti, gruppo di confronto, acquirente e data della decisione         | Fondatore + responsabile CAF | Scheda sede e protocollo approvati; niente CF/testo dei cittadini nella scheda           |
| 2      | Disegnare percorso attuale, individuare ogni passaggio di raccolta, revisione e copia; provare famiglia sintetica nel gestionale | Operatore referente + team   | Prova di handoff completata, minuti di caricamento e campi ridigitati registrati         |
| 3      | Configurare sede/accessi personali, retention/link, QR e canale assistenza; prova link perso e recupero                          | Team + admin CAF             | Accessi corretti, stampa e recupero link riusciti; niente password condivise             |
| 4      | Formazione di un'ora: caso completo, anno sbagliato, documento ambiguo, integrazione, export, cittadino senza smartphone         | Team + tutti gli operatori   | Ogni operatore completa un caso fittizio; guida breve a disposizione                     |
| 5      | Prova con mediatore della lingua prioritaria; simulare mancanti, foto difficili e modalità assistita                             | Operatore + mediatore + team | Comprensione dei termini critici verificata; percorso umano disponibile                  |
| 6      | Avviare registro tempi del percorso abituale su casi consecutivi; fissare regole di assegnazione e motivi di esclusione          | CAF                          | Timer con pause e schema condiviso; versione regole congelata                            |
| 7      | Continuare baseline; simulare errori AI/servizio, documento in analisi e ritorno al flusso normale                               | CAF + team                   | Nessun cittadino obbligato a finire via Avanti; escalation provata                       |
| 8      | Continuare baseline; verifica manuale coerenza registro, denominatori e costi supporto                                           | Referente + team             | Eventi mancanti segnalati, nessun contenuto documentale nei report                       |
| 9      | Continuare baseline; prova exit con export amministrativo e file binari su dati sintetici                                        | Team + admin CAF             | Restituzione leggibile dal CAF, elenco file/hash coerente, cancellazione/restore provati |
| 10     | Completare settimana baseline, retrospettiva e decisione di avvio per gennaio                                                    | Responsabile + fondatore     | Firma di accettazione operativa; piano turni/supporto e protocollo definitivo            |

Giorni 6–10 sono una settimana di misure organizzative. Se svolta in dicembre, **non dimostra il beneficio ISEE di gennaio**: mantenere il gruppo di confronto contemporaneo in gennaio. Per prove dell'app cittadino a dicembre usare dati sintetici finché accordi e procedure non sono pronti. [Protocollo precedente e motivazione](../research/pilot-playbook.md).

## Disegno del test nel picco

Tre sedi in 2–3 organizzazioni, almeno due gestionali, una con domanda concreta di arabo o bengalese già supportati e revisionati. Niente selezione per nazionalità presunta. Adesione digitale autonoma e compilazione assistita sono sottogruppi distinti. 730, ISEE corrente, universitario autonomo e immigrazione fuori dalla coorte principale: reindirizzamento al CAF registrato e assistenza garantita. [Limiti ISEE](../research/isee-2027.md), [università](../research/isee-universita.md), [lingue](../research/languages.md).

Assegnazione proposta: inviti ai due percorsi in modo casuale nella stessa sede/settimana, senza rifiutare il servizio ordinario. Se non praticabile, blocchi alternati prestabiliti; confrontare lingua richiesta, complessità e operatori, dichiarando selezione residua. **Obiettivo operativo di raccolta:** almeno 100 inviti per sede, circa 50 per percorso, poi continuare nei cap concordati. Non è un calcolo di potenza statistica; numerosità effettiva e precisione dipendono dalla baseline. I due gruppi contano inviti, non solo persone che hanno completato con successo.

La console misura intervalli creazione–invio e revisione–pronto, che includono pause. Per il costo del lavoro usare un **timer separato con pause**, sommando accoglienza, aiuto, controllo, contatti, integrazioni, export e copia nel gestionale. È una procedura del pilota, non una funzione aggiunta al prodotto. [Semantica KPI dell'API](../API.md#metriche-e-limiti).

| Metrica                 | Definizione / denominatore                                                                                                    | Obiettivo proposto / regola                                                                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Minuti attivi           | Somma del lavoro umano fino alla preparazione nel gestionale; media per stima economica, mediana e quartili per distribuzione | ≥5 minuti netti risparmiati per fascicolo lavorato; analisi separata di tutti gli inviti, compreso tempo perso negli abbandoni   |
| Completezza primo invio | Fascicoli ricevuti che l'operatore approva senza richiedere nuovi documenti / ricevuti                                        | ≥15 punti percentuali sul confronto; distinguere rigore delle verifiche e numero di componenti                                   |
| Conversione             | Consegnati / avviati; separatamente consegnati / invitati                                                                     | ≥70% sugli avvii; il secondo denominatore impedisce di nascondere mancata adozione                                               |
| Integrazioni e ritorni  | Contatti e visite ulteriori per caso ricevuto, con motivo codificato                                                          | Riduzione desiderata, senza soglia certa prima della baseline                                                                    |
| Errori                  | Falsi rilievi, problemi non rilevati e correzioni da operatore; verifica dei documenti in tutti i casi del pilota             | Nessun errore critico usato senza correzione; sospensione della funzione/coorte coinvolta e analisi del motivo                   |
| Handoff                 | Minuti e campi ridigitati, fino a ricezione nel software CAF                                                                  | Inclusi nel beneficio; se cancellano il risparmio, connettore prioritario o stop vendita                                         |
| Inclusione              | Aiuto richiesto, abbandoni, tempo/ritorni dichiarati dal cittadino, per lingua/canale                                         | Nessuno escluso dal servizio ordinario; non dichiarare peggioramento nullo da pochi casi                                         |
| Economia                | Token/costi, abbandoni, supporto e valore dei minuti, con ipotesi di costo del lavoro                                         | Costo base ≤0,30 €/consegna e valore CAF ≥2× offerta; soglie economiche da rinegoziare prima dell'avvio se cambiano gli endpoint |
| Acquisto                | Offerta presentata al decisore e accettazione scritta                                                                         | Interesse, ordine e pagamento sono tre evidenze diverse                                                                          |

Le soglie sono proposte di **decisione**, non promesse di risultato. Se una metrica peggiora, analizzare anche il sottogruppo prima di aggregare; niente percentuali pubbliche senza campioni/periodi. Per la stima economica non ricavare ore totali dalla sola differenza delle mediane. Tutti gli inviti assegnati restano nel report; utenti che passano al percorso abituale non diventano «spariti». Risultati su tre sedi restano esplorativi, senza generalizzazione nazionale.

## Supporto e calendario dei tre mesi

- **Prima settimana gennaio:** breve verifica giornaliera con il referente; avvio progressivo, cinque casi al giorno proposti, poi volume concordato se errori/handoff sono gestibili. Questo supporto intensivo va conteggiato nel budget e può superare la riserva standard.
- **Ogni settimana:** incontro di 30 minuti; report aggregato per sede, lingua/canale e gruppo; lista problemi senza documenti o link personali nei ticket.
- **Fine gennaio:** prima lettura del tempo netto e qualità, controllo consumi. Non trasformare segnalazioni AI in «errori evitati» senza revisione.
- **Febbraio:** stabilizzare processo, osservare adozione senza assistenza continua del fondatore, misurare disponibilità a pagare.
- **15 marzo:** report con limiti e offerta A/B; **31 marzo:** stop o contratto separato. Un'estensione per dati insufficienti richiede nuove date/cap espliciti.

**Proposta di assistenza da confermare prima di prometterla:** giorni lavorativi 9–18, presa in carico ordinaria entro il giorno lavorativo successivo; problemi bloccanti prioritari mentre il CAF prosegue con il flusso abituale. Nessun SLA 24/7 implicito. Incidente sui dati: segnalazione immediata al referente e gestione secondo accordo, sospendendo il flusso interessato.

## Uscita concreta

Stop ai nuovi inviti; inventario delle pratiche aperte e passaggio al flusso CAF; restituzione autenticata all'admin autorizzato. Export amministrativo JSON contiene risposte, eventi, note interne e riferimenti/hash: **i binari devono essere consegnati separatamente**. Non chiamare questo JSON «backup completo dei documenti». Prova di lettura e conteggio dal CAF, poi cancellazione delle copie Avanti secondo DPA e policy di backup, con registrazione dei retry. Archivio ufficiale CAF e obblighi di conservazione restano distinti. [Runbook deploy/export](../DEPLOY.md), [portabilità/restituzione](../research/data-portability.md).

Per il report pubblico: aggregati che non identifichino persone, niente celle piccole riconoscibili; autorizzazione distinta per nome/logo e citazioni. I report interni pseudonimi restano dati personali. [GDPR artt. 5, 25, 28](https://eur-lex.europa.eu/eli/reg/2016/679/oj/ita).
