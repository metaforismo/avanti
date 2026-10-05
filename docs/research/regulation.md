# Regole e documenti necessari prima del pilota

Cutoff normativo: **5 ottobre 2026**; consultazione 5–6 ottobre. **Verificato**: testo primario citato. **Valutazione**: applicazione proposta al prodotto, da confermare con CAF e referente legale/DPO. **Non trovato**: risposta specifica o documento non reperito. Questo dossier serve a decidere il perimetro; non certifica conformità e non è consulenza legale.

## GDPR: chi risponde di cosa

**Verificato:** la [convenzione INPS–CAF ISEE 2026, art. 14, pp. 17–19](https://www.inps.it/content/dam/inps-site/it/scorporati/circolari-e-messaggi/2026/04/Circolare_15250/Allegati/16747_Messaggio-numero-0001442-del-30-04-2026_Allegato-n-1.pdf) qualifica **INPS e CAF titolari per le rispettive competenze**, comprendendo dati degli artt. 9 e 10 GDPR. Il CAF non va descritto genericamente come responsabile di INPS.

**Valutazione Avanti:** il CAF può essere titolare dell'intake; Avanti responsabile ex art. 28 se tratta il fascicolo soltanto sulle sue istruzioni. Hosting, storage, OCR, traduzione, gateway e modelli possono essere subresponsabili. L'etichetta contrattuale deve riflettere chi decide finalità e mezzi essenziali: [EDPB, Guidelines 07/2020, versione finale 7 luglio 2021](https://www.edpb.europa.eu/documents/guideline/guidelines-072020-on-the-concepts-of-controller-and-processor-in-the-gdpr_en).

Addestramento, marketing e analisi individuale tra CAF diversi non sono automaticamente coperti da quella nomina. ItaliaAperta/Pino, Civlo, DVNS e GovCore non acquisiscono un diritto a ricevere i fascicoli perché appartengono all'ecosistema: separare finalità, accessi e basi giuridiche; per il pilota non prevedere tale condivisione.

Il [GDPR 2016/679, artt. 5, 6, 13–14, 25, 28, 30 e 32](https://eur-lex.europa.eu/eli/reg/2016/679/oj/ita) richiede:

- Matrice delle finalità e basi giuridiche; informativa comprensibile, dati necessari e diritti. Una spunta «ho letto» non è di per sé consenso valido né delega operativa.
- DPA con oggetto/durata, dati/interessati, istruzioni, riservatezza, sicurezza, autorizzazione dei subresponsabili, assistenza per diritti/DPIA/incidenti, audit e restituzione/cancellazione.
- Registro dei trattamenti, valutazione dell'obbligo di DPO, permessi per sede e operatore, cifratura, audit senza contenuti personali, procedura di accesso/rettifica/cancellazione.
- Piano incidenti: responsabile informa il titolare senza ingiustificato ritardo; il titolare valuta la notifica all'autorità entro **72 ore** quando dovuta, artt. 33–34. Non aspettare una diagnosi completa per avviare l'escalation.

## Dati delicati, minori e DPIA

| Dato / uso                            | Regola verificata                                                                             | Decisione proposta                                                                  |
| ------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Redditi, CF, identità, conti          | Dati personali; non diventano tutti categorie particolari                                     | Minimizzazione e nessun contenuto nei log                                           |
| Salute/disabilità, documenti sanitari | Art. **9** GDPR; base art. 6 più condizione art. 9 pertinente                                 | Raccogliere solo ciò che serve; accesso ristretto, verifica dell'operatore          |
| Condanne e reati                      | Art. **10**; trattamento sotto controllo dell'autorità o autorizzato dal diritto con garanzie | Consenso generico insufficiente; fuori dal primo pilota salvo perimetro autorizzato |
| Permesso di soggiorno                 | Non è automaticamente dato giudiziario; alcuni fascicoli includono certificati penali         | Distinguere documenti e verticali, non applicare art. 10 a ogni permesso            |
| Bambini nel nucleo                    | Dati di soggetti vulnerabili; non equivalgono ad accesso autonomo al chatbot                  | Dichiarante adulto/rappresentante e raccolta necessaria                             |

Fonte della distinzione: [GDPR, artt. 6, 9 e 10](https://eur-lex.europa.eu/eli/reg/2016/679/oj/ita). La condizione concreta per salute/disabilità e i dati giudiziari deve essere documentata dal CAF per il trattamento effettivo, non presunta dalla disponibilità del file.

**DPIA:** l'AI da sola non impone automaticamente una valutazione d'impatto. Dati altamente personali, vulnerabilità, innovazione, eventuale profilazione e combinazione di archivi sono però criteri di rischio rilevanti: [Garante, provvedimento 467 dell'11 ottobre 2018](https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/9058979), [scheda DPIA](https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/6991317). **Proposta:** DPIA con i CAF prima dei dati reali; motivare per ciascun trattamento necessità, proporzionalità e rischio residuo. Se, nonostante le misure previste, rimane un rischio elevato, consultare preventivamente il Garante prima del trattamento, ex art. 36. Nessuna «DPIA del software» sostituisce l'analisi del suo uso nella sede.

**Accesso dei minori:** soglia italiana **14 anni** per il consenso ai servizi digitali direttamente offerti ai minori, nel relativo perimetro: [Garante, minori](https://garanteprivacy.it/web/guest/temi/minori), art. 8 GDPR e art. 2-quinquies Codice privacy. Inoltre la [legge 132/2025, GU 25 settembre 2025, in vigore dal 10 ottobre 2025](https://www.gazzettaufficiale.it/eli/id/2025/09/25/25G00143/sg), art. 4(4), disciplina l'accesso all'AI sotto i 14 anni con consenso genitoriale e richiede informazioni comprensibili per i 14–17 anni. **Pilota proposto:** dichiaranti adulti o rappresentanti; percorso separato prima di ammettere accesso diretto dei minori.

## Conservazione, mandato e firma DSU

Regole **2026**, non automaticamente valide per il **2027**: [convenzione INPS–CAF, artt. 2, 4, 10, 11 e 13](https://www.inps.it/content/dam/inps-site/it/scorporati/circolari-e-messaggi/2026/04/Circolare_15250/Allegati/16747_Messaggio-numero-0001442-del-30-04-2026_Allegato-n-1.pdf).

| Obbligo verificato                                                                                                             | Implicazione per Avanti                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Identità/CF e mandato sottoscritto per le attività selezionate; delega a terzo distinta                                        | Il link-capability apre l'intake, non identifica legalmente il dichiarante e non costituisce mandato |
| Trasmissione CAF entro il **quarto giorno lavorativo**, secondo convenzione                                                    | «Fascicolo consegnato» deve restare distinto da DSU ufficialmente trasmessa                          |
| Dati DSU conservati dal CAF **non oltre due anni dalla trasmissione**, art. 2(3)                                               | Non attribuire indistintamente questa retention a ogni documento, delega o log                       |
| Dichiarazione datata e sottoscritta, anche con firma digitale, art. 10                                                         | Non presumere equivalenza tra checkbox, firma disegnata, OTP e sottoscrizione accettata              |
| Copie per immagine sostitutive degli originali con processo conforme alle linee guida AgID e certificazione prevista           | Un PDF caricato o un backup cloud non è conservazione documentale conforme                           |
| Mandati, deleghe e identità conservati per la durata normativa; esibizione a INPS entro **30 giorni** dalla richiesta, art. 11 | Archivio CAF reperibile e controllabile; Avanti non ne diventa automaticamente l'archivio ufficiale  |
| Accesso INPS riservato a operatori con profilo autorizzato, art. 13                                                            | Nessuna condivisione di credenziali o uso del token Avanti come abilitazione                         |

La [scheda INPS mandato/delega](https://www.inps.it/it/it/dettaglio-approfondimento.schede-informative.mandato-e-delega-al-caf-per-la-compilazione-della-dsu-e-il-calcolo-dell-isee.html) distingue i documenti del mandante e quelli di delegante/delegato. La delega digitale citata nel preambolo della convenzione è oggetto di lavoro tecnico: non prova la validità generale di un nuovo flusso di firma Avanti.

**Proposta di retention:** Avanti conserva una copia preparatoria per un periodo breve concordato nel DPA; cancellazione dopo export/chiusura secondo quella policy. Separare bozze abbandonate, documenti, estrazioni AI, audit, backup e contenzioso; assegnare responsabile e criterio di scadenza a ciascuno. Evitare un numero unico inventato. La cancellazione su Avanti non cancella automaticamente gli obblighi dell'archivio CAF; i termini DSU non vanno estesi al futuro 730.

## Modelli AI, regioni e trasferimenti

**Residency, assenza di training e zero data retention (ZDR) sono proprietà diverse.** Region EU non garantisce che supporto, telemetria, gateway e subprocessori restino tutti in UE; `store:false` non prova da solo assenza di retention. Fonte giuridica: [GDPR, artt. 28 e 44–49](https://eur-lex.europa.eu/eli/reg/2016/679/oj/ita), [EDPB Recommendations 01/2020, versione finale 18 giugno 2021](https://www.edpb.europa.eu/documents/recommendation/recommendations-012020-on-measures-that-supplement-transfer-tools-to_en).

| Fornitore: documentazione primaria consultata                                                                                                                                                                                                  | Capacità dichiarata                                                       | Limiti da verificare nel contratto/configurazione                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| OpenAI, [annuncio residency Europa, 6 febbraio 2025](https://openai.com/index/introducing-data-residency-in-europe/), [data controls API](https://developers.openai.com/api/docs/guides/your-data)                                             | Residency e controlli di retention per clienti/configurazioni ammissibili | ZDR soggetto ad approvazione; endpoint stateful, Files/vector stores, system data e servizi terzi hanno regole proprie |
| Mistral, [ZDR](https://docs.mistral.ai/admin/monitor-comply/zero-data-retention), [hosting, pagina datata 12 agosto 2026](https://help.mistral.ai/en/articles/347629-where-do-you-store-my-data-or-my-organization-s-data)                     | Hosting UE e ZDR per chiamate stateless ammesse                           | Files, Agents e conversazioni non automaticamente coperti; eventuali trasferimenti di feature/subprocessori            |
| Anthropic, [retention commerciale](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data), [covered models](https://privacy.claude.com/en/articles/15425996-data-retention-practices-for-covered-models) | Accordi di retention/ZDR secondo servizio e modello                       | Eccezioni per file, sicurezza e modelli designati; non attribuire a ogni endpoint le condizioni di un altro            |

Le pagine tecniche non versionate descrivono l'offerta osservata il 5–6 ottobre, **non condizioni storiche garantite al cutoff né un accordo già ottenuto da Avanti**. Prima dell'uso: DPA, elenco subprocessori, matrice modello–endpoint–regione–retention, accessi di supporto e garanzia di non addestramento concordata. Per trasferimenti extra-UE verificare decisione di adeguatezza applicabile ex art. 45 oppure garanzie ex art. 46 con relativa valutazione: nessun divieto o via libera automatico per ogni fornitore USA. Il fallback deve rispettare la stessa configurazione approvata, senza instradamenti automatici verso altri fornitori.

## AI Act: Annex III 5(a) è un rischio da analizzare

**Verificato:** [regolamento 2024/1689, Annex III 5(a)](https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng) comprende sistemi usati da autorità pubbliche o **per loro conto** per valutare ammissibilità a prestazioni/servizi pubblici essenziali o concederli, ridurli, revocarli e recuperarli.

La convenzione ISEE affida al CAF assistenza e alimentazione del sistema INPS, ma **non trovata** una pronuncia ufficiale specifica che classifichi il front office AI di un CAF come tale caso d'uso. Il ruolo GDPR del CAF e la presenza di un operatore non risolvono il problema AI Act.

**Valutazione condizionata:** lingua, classificazione dei documenti, leggibilità, checklist e fascicolo preparatorio possono essere fuori dal caso d'uso o rientrare nel filtro **art. 6(3)** per attività procedurali/preparatorie, se non influenzano materialmente la valutazione dell'ammissibilità. Una funzione che nega accesso, stima merito/successo/frode o raccomanda il rigetto cambia il perimetro. La profilazione nel caso Annex III impedisce quel filtro. Un blocco documentale deve consentire revisione umana e non impedire al cittadino di chiedere assistenza.

Supporto interpretativo, da distinguere dalla norma: [bozze Commissione del 19 maggio 2026](https://digital-strategy.ec.europa.eu/en/library/draft-commission-guidelines-classification-high-risk-ai-systems), [Service Desk, essential services](https://ai-act-service-desk.ec.europa.eu/en/essential-services), [horizontal issues](https://ai-act-service-desk.ec.europa.eu/en/horizontal-issues-listed-use-cases). Non sono una classificazione definitiva di Avanti.

Documentare destinazione d'uso, funzioni, effetti, gestione degli errori e motivazione per versione; se si usa l'eccezione art. 6(3), predisporre autovalutazione. **Il rinvio non comprende espressamente l'art. 49(2)**, che appartiene alla sezione 5: per un sistema ricadente in Annex III che beneficia del filtro art. 6(3), il testo prevede registrazione prima dell'immissione sul mercato/messa in servizio. Verificare prima del pilota l'applicazione coordinata e la procedura disponibile; non presumere il rinvio della registrazione al dicembre 2027. Un sistema fuori da Annex III non richiede questa registrazione soltanto perché usa AI. Fonti: [AI Act, artt. 49 e 113](https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng), [Omnibus, art. 1(40)](https://eur-lex.europa.eu/eli/reg/2026/1744/oj). Se il sistema è high risk: pianificare gestione rischio, dati, documentazione/log, supervisione, accuratezza/sicurezza, conformità e responsabilità provider/deployer; verificare anche art. 27 sul deployer che eroga servizi pubblici. I verticali immigrazione futuri richiedono una nuova classificazione, non ereditano quella ISEE.

### Calendario aggiornato: Omnibus AI già vigente

| Obbligo / evento                                                            | Data e stato al 5 ottobre 2026                                                                                                      |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Capitoli I–II AI Act, inclusa alfabetizzazione AI                           | **2 febbraio 2025**; art. 4 poi modificato: adottare misure per sostenere l'alfabetizzazione, senza garanzia di livello individuale |
| Digital Omnibus on AI, **regolamento UE 2026/1744**                         | Adottato **8 luglio 2026**, GU **24 luglio**, in vigore **27 luglio 2026**                                                          |
| Trasparenza chatbot art. **50(1)**                                          | **2 agosto 2026**, già applicabile; non rinviata con le regole high risk                                                            |
| Capitolo III sezioni 1–3, sistemi Annex III                                 | **2 dicembre 2027**, salvo eccezione art. 6(5) indicata nel testo                                                                   |
| Capitolo III sezioni 1–3, sistemi Annex I                                   | **2 agosto 2028**, con la stessa eccezione                                                                                          |
| Grace per art. **50(2)**, sistemi sintetici immessi prima del 2 agosto 2026 | **2 dicembre 2026**; non è un rinvio generale dell'art. 50                                                                          |

Fonti vincolanti: [AI Act 2024/1689, artt. 50 e 113](https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng), [Omnibus AI 2026/1744, art. 1(5), (39)–(40) e art. 4](https://eur-lex.europa.eu/eli/reg/2026/1744/oj). **Omnibus dati/GDPR è distinto:** [procedura 2025/0360/COD](https://eur-lex.europa.eu/procedure/EN/2025_360) ancora in corso; le sue proposte non modificano qui il GDPR vigente.

Prima interazione: avviso chiaro, accessibile e nelle lingue supportate che il cittadino interagisce con AI e può rivolgersi a un operatore. Esaminare separatamente la marcatura machine readable del contenuto sintetico ex art. 50(2); un banner chatbot non la sostituisce. Il rinvio high risk non sospende GDPR, trasparenza o regole CAF.

## Accessibilità

Il [d.lgs. 82/2022, artt. 1–3](https://www.gazzettaufficiale.it/eli/id/2022/07/01/22G00089/sg) attua l'EAA, applicabile dal **28 giugno 2025** alle categorie previste, inclusi servizi di commercio elettronico; le microimprese che prestano servizi hanno l'esenzione EAA prevista. Un SaaS B2B non è automaticamente e-commerce al consumatore. Verificare servizio concreto e obblighi della sede sotto legge 4/2004: [AgID, accessibilità](https://www.agid.gov.it/it/ambiti-intervento/accessibilita-usabilita). L'esenzione EAA non elimina tutti gli altri obblighi; la [legge 132/2025, art. 3(7)](https://www.gazzettaufficiale.it/eli/id/2025/09/25/25G00143/sg) richiede pieno accesso delle persone disabili ai sistemi AI.

**Target proposto:** EN 301 549/WCAG AA appropriati al perimetro, test tastiera e lettori di schermo, contrasto/focus, errori comprensibili, upload assistito, RTL e alternativa all'uso autonomo dello smartphone. Nessun claim «accessibile» prima della verifica.

## Checklist di avvio: evidenza richiesta

| Da completare prima di gennaio 2027                              | Responsabile proposto     | Evidenza                                                               |
| ---------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------- |
| Soggetto CAF e poteri di firma, accordo pilota e DPA             | CAF + Avanti              | Accordi sottoscritti e istruzioni documentate                          |
| Finalità/basi art. 6/9/10, informative multilingua, registro/DPO | CAF con supporto Avanti   | Matrice approvata e informative revisionate                            |
| DPIA e trasferimenti                                             | CAF/DPO + Avanti          | Rischi residui, misure e decisione motivata                            |
| Hosting/OCR/AI/gateway e subprocessori                           | Avanti, approvati dal CAF | Matrice endpoint/regione/retention e contratti effettivi               |
| Accessi, isolamento sedi, incidenti, log senza dati personali    | Avanti                    | Verifica permessi e procedura di escalation provata                    |
| Retention, cancellazione, backup, archivio ufficiale             | CAF + Avanti              | Policy per categoria e prova export/cancellazione                      |
| Mandato/delega e firma                                           | CAF                       | Flusso accettato e documenti reperibili                                |
| Classificazione AI Act e trasparenza                             | Avanti + CAF              | Memo per versione, avviso e analisi art. 50(2)                         |
| Minori, dati sensibili, assistenza umana                         | CAF + Avanti              | Perimetro e procedura di reindirizzamento                              |
| Accessibilità, traduzioni, handoff e regole 2027                 | Avanti + operatori CAF    | Prove assistite; convenzione/regole ricontrollate prima dei dati reali |

**Non trovato al cutoff:** convenzione INPS–CAF 2027, qualificazione ufficiale specifica Avanti/CAF ex Annex III 5(a), validità generale di una firma elettronica semplice per ogni delega DSU. Queste lacune richiedono verifica mirata prima dell'avvio, non una promessa in landing.

_Ricerca di Codex (GPT-6.1 Sol)._
