> Bozza da far verificare da un legale/DPO; non è consulenza legale

# Registri delle attività di trattamento — CAF e gestore Avanti

Versione 0.1 del 16 ottobre 2026. Modello da integrare nei due registri effettivi;
non coincide con il registro tecnico degli accessi presente nell'app.
I registri sono scritti, anche elettronici, aggiornati e disponibili all'autorità
su richiesta. La soglia di 250 dipendenti non esenta automaticamente: rilevano anche
non occasionalità, rischio e categorie di dati trattati. Fonte: [GDPR art. 30][gdpr].

## 1. Anagrafica del registro CAF — art. 30.1

| Campo comune a tutte le voci            | Valore                                                                                                          |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Titolare                                | CAF **[ragione sociale, CF/P.IVA, sede e contatti: da completare]**                                             |
| Rappresentante, ove applicabile         | **da completare** o «non applicabile», motivando                                                                |
| Eventuali contitolari                   | **da completare** o «nessuno per questo flusso»; gli enti non sono automaticamente contitolari del front office |
| DPO, ove designato, e referente interno | **da completare**; valutazione obbligo art. 37 separata                                                         |
| Custode registro e versione             | **da completare**, data ultimo riesame e prossima verifica                                                      |
| Responsabile                            | Gestore Avanti **[identità/contatti da completare]**, accordo art. 28 n. **[da completare]**                    |
| Sub-responsabili                        | Versione firmata di [sub-responsabili.md](sub-responsabili.md) **[da completare]**                              |

Per ogni voce completare i campi comuni e specifici; basi giuridiche, fonti e misure
sono campi aggiunti per accountability, oltre ai contenuti obbligatori dell'art. 30.1.

### CAF-01 — Preparazione e revisione dei fascicoli

| Campo             | Contenuto della voce                                                                                                                                                                                                                                                                                  |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Finalità          | Raccogliere esigenze/documenti, preparare checklist e fascicolo multilingue, far verificare dall'operatore, chiedere integrazioni e consegnare al CAF. Primo pilota ISEE ordinario 2027; 730/permesso solo dopo approvazione                                                                          |
| Interessati       | Richiedenti adulti/rappresentanti, membri del nucleo anche minori, terzi nei documenti, operatori che annotano/verificano                                                                                                                                                                             |
| Categorie di dati | Identità, CF, nascita, nucleo, redditi, patrimoni, conti, immobili, documenti, lingua, recapiti (email facoltativa; UI richiede telefono o email), risposte/racconto/messaggi, note, analisi AI, prospetto e revisioni; eventuali dati art. 9, art. 10 fuori primo pilota salvo perimetro autorizzato |
| Basi e fonti      | Matrice per verticale sotto, **da completare**; ricezione/lettura informativa distinta dal consenso                                                                                                                                                                                                   |
| Destinatari       | Operatori autorizzati, gestore Avanti e catena approvata hosting/DB/storage/AI; tecnici solo per necessità. Export al CAF; successivi invii agli enti nel gestionale hanno voce separata **da completare dal CAF**                                                                                    |
| Trasferimenti     | Paesi terzi/organizzazioni internazionali e strumento capo V **da completare per destinatario** o assenza documentata; usare schede fornitori, non la sola regione DB                                                                                                                                 |
| Cancellazione     | Termine CAF **[da completare]**: default fascicolo 180 giorni da chiusura o scadenza link, non da creazione; link default 60. Purge a lotti, retry file e ultimi riferimenti. Copie export/archivio ufficiale con termini propri **da completare**                                                    |
| Misure            | Allegato B accordo: tenant, ruoli, MFA da imporre, sessioni/link hashati, input/file validati, storage privato, audit, guard AI e conferme; configurazione e collaudi reali **da completare**                                                                                                         |
| AI/audio          | Input minimo per compito a soli endpoint approvati ZDR/no training, UE quando disponibile; altrimenti fallback. Audio non persistito dall'app, testo inviato/conversazioni conservati nel fascicolo                                                                                                   |

### CAF-02 — Comunicazioni operative e ricevute

| Campo            | Contenuto della voce                                                                                                                                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Finalità         | Avvisare su integrazioni, disponibilità allo sportello, eventuale ricevuta di invio; digest di conteggi per operatori                                                                                       |
| Interessati/dati | Cittadino: email facoltativa non verificata, lingua, nome CAF/sportello, titoli del catalogo per integrazioni o riferimento ricevuta, stato minimo. Operatori: email di lavoro, conteggi del CAF            |
| Basi             | Collegare al servizio richiesto o ad altra base effettivamente applicabile art. 6 **[da completare]**. Nessun consenso generale da email presente e nessuna promozione                                      |
| Destinatari      | Personale CAF/Avanti necessario, provider email approvato e suoi sub-responsabili, destinatari nelle caselle indicate; rapporto con provider caselle da valutare nel flusso concreto                        |
| Trasferimenti    | Paesi/importatori e garanzie email **da completare**                                                                                                                                                        |
| Termini          | Outbox: payload cancellato a completamento/annullamento; pendenti/falliti 7 giorni, ricevute tecniche 30 giorni dal completamento, al passaggio cron. Copie provider/caselle **da completare**              |
| Misure           | AES-256-GCM outbox, rivalidazione contatto/stato, quote destinatario e dati minimi; nessun link-capability nelle email ordinarie. Tracking da disabilitare nel provider; invio accettato non prova recapito |

### CAF-03 — Riuso documentale e rinnovi ISEE

| Campo                       | Contenuto della voce                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Finalità                    | Preparare, su selezione esplicita operatore, fascicolo successivo da dati ancora legittimamente disponibili; inviare eventuale invito dedicato                                                                                                                                                                                                                                  |
| Interessati/dati            | Richiedente/nucleo e documenti eleggibili finché conservati. Dopo retention: solo CAF/sportello, lingua/anno/riferimento, nomi e contatti già dati, ruoli/nomi/anni nascita, data/versione consenso, gruppo opaco e hash di sola revoca. Esclusi CF, date complete, file, economia, messaggi e note                                                                             |
| Base del riuso/preparazione | **da completare dal CAF**; necessità/compatibilità e condizioni art. 9 ove pertinenti. Non coincide automaticamente con consenso al ricontatto                                                                                                                                                                                                                                  |
| Base dell'invito            | Consenso dedicato proposto art. 6.1(a); backend salva data e versione testo per lingua, con snapshot nel core, senza backfill storico. Validità della prova, informativa sul promemoria, rappresentanza/necessità dei dati familiari e regole del canale **da completare dal CAF/DPO**; preferenza CAF default disattivata                                                      |
| Destinatari                 | Operatori, Avanti/catena autorizzata; per email il provider riceve **anche il link personale**. Nessuna trasmissione ufficiale/nuova domanda all'ente automatica                                                                                                                                                                                                                |
| Trasferimenti               | Mappa email/hosting/AI se attiva **da completare**                                                                                                                                                                                                                                                                                                                              |
| Termini                     | Fascicolo/file non prorogati. Promemoria solo per ISEE inviato con consenso versionato e contatto utile, fino a fine 31 marzo anno successivo alla pratica (2027 → marzo 2028, Roma); query escludono scaduti, cron li cancella. Revoca/erasure cancellano subito nel gruppo; nuovo fascicolo con retention propria. Audit 365 giorni separato; tempi/base da approvare dal CAF |
| Misure                      | Nucleo da riconfermare, zero file riusabili dal promemoria; niente correlazione per CF/nome. Revoca cittadino via vecchia capability (solo revoca) o operatore su richiesta; family-erasure da ID sorgente eliminata. Lock CAF condivisi, audit senza payload, outbox cifrata/rivalidata. UI, lock Postgres e provider effettivi da collaudare                                  |

### CAF-04 — Accessi, audit e sicurezza del front office

| Campo            | Contenuto della voce                                                                                                                                                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Finalità         | Autorizzare operatori, ricostruire accessi/modifiche, prevenire abusi, gestire incidenti e diritti; metriche organizzative del pilota                                                                                               |
| Interessati/dati | Operatori/admin, cittadini collegabili tramite riferimenti pratica; ID tecnici, azioni, istanti, conteggi, credenziali hashate, TOTP cifrato e recuperi hashati; bucket HMAC e metadati tecnici. Non descriverli tutti come anonimi |
| Basi             | Obblighi di sicurezza/accountability e/o interesse legittimo ove applicabile con valutazione **[da completare]**; per eventuale controllo lavoratori analisi separata, non autorizzata da questa voce                               |
| Destinatari      | Admin del CAF per proprio audit; personale Avanti necessario e infrastruttura autorizzata; autorità quando dovuto. Tentativi su account sconosciuti riservati al gestore, senza tenant                                              |
| Trasferimenti    | Infrastruttura, log/supporto e destinazioni CSV **da completare**                                                                                                                                                                   |
| Termini          | Audit 365 giorni dall'evento, purge a lotti; sessioni 30 minuti inattività/max 12 ore, pulizia scadute; bucket eliminati dopo scadenza. Account, copie CSV, log infrastrutturali e telemetria AI **da completare**                  |
| Misure           | Minimi privilegi, MFA, metadati ammessi, niente contenuti nei log, export admin riservato; necessità/proporzionalità dei 365 giorni e gestione copie da approvare                                                                   |

## 2. Matrice basi e norme — compilazione a cura CAF/DPO

Non pubblicare una lista alternativa di basi come se fossero tutte applicabili.
Scegliere e motivare per finalità, persone e dati, con riferimento alla norma vigente.
L'art. 6.1(b) non copre automaticamente i familiari che non sono parti del servizio;
art. 6.1(c)/(e) richiedono il relativo fondamento normativo.

| Verticale/finalità                           | Base art. 6 e norma/rapporto                 | Condizione art. 9 / disciplina art. 10                                      | Conservazione obbligatoria e archivio                                                                   |
| -------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| ISEE ordinario, intake distinto da invio DSU | **da completare**                            | Disabilità/salute: **da completare**; giudiziari fuori pilota               | **da completare**, verificare annualità e convenzione vigente; non estendere a ogni file il termine DSU |
| 730 preparatorio                             | **da completare prima attivazione**          | Spese sanitarie/altri dati particolari: **da completare**                   | **da completare per categoria**, distinto da ISEE                                                       |
| Permesso preparatorio                        | **da completare prima attivazione**          | Distinguere dato soggiorno da art. 9/10, norme specifiche **da completare** | **da completare per procedimento**                                                                      |
| Riuso/preparazione rinnovo e inviti          | Due finalità distinte, **da completare**     | Verificare anche documenti riutilizzati                                     | Motivare disponibilità sorgente e prova consenso; nessun allungamento automatico                        |
| Sicurezza/email/metriche                     | **da completare** per finalità e interessati | Minimizzare; evitare dati delicati in email/metriche                        | Motivare tempi tecnici e copie                                                                          |

## 3. Registro del gestore responsabile — art. 30.2

Il gestore tiene una scheda per ogni CAF titolare, senza sostituirla con il solo elenco
clienti. Identità di eventuali rappresentanti e DPO vanno compilate ove applicabili.

| Campo obbligatorio comune                             | Valore                                                                                                                                                                              |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Responsabile ed eventuali altri responsabili          | Gestore Avanti **[identità/sede/contatti da completare]**; catena riferita a versione firmata **[da completare]**                                                                   |
| Ciascun titolare per cui opera                        | CAF **[identità/sede/contatti da completare]**, ID interno riservato **[da completare]**, estremi nomina **[da completare]**                                                        |
| Rappresentanti titolare/responsabile, ove applicabili | **da completare** o «non applicabile»                                                                                                                                               |
| DPO, ove designato                                    | Contatti CAF e gestore **[da completare]**                                                                                                                                          |
| Categorie di trattamenti                              | Voci RES-01–04 sotto                                                                                                                                                                |
| Trasferimenti                                         | Per ogni voce paesi terzi/organizzazioni internazionali, destinatari e garanzie; per art. 49.1 secondo comma documentare garanzie appropriate. **da completare** o assenza motivata |
| Descrizione generale misure, ove possibile            | Allegato B accordo art. 28, versione/configurazione effettiva e verbali **[da completare]**                                                                                         |

| Voce   | Categorie di trattamento per conto del CAF                                                                                                                        | Destinatari / tempi / misure di rinvio                                                     |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| RES-01 | Raccolta, registrazione, strutturazione, consultazione, analisi/traduzione/trascrizione, revisione, esportazione dei fascicoli                                    | CAF-01, allegati A–C e matrice AI; destinazioni effettive **da completare**                |
| RES-02 | Accodamento cifrato, invio e cancellazione delle comunicazioni operative                                                                                          | CAF-02, provider email approvato; include attivazione preferenze e alternative senza email |
| RES-03 | Collegamento esplicito famiglia/documenti, preparazione rinnovo, promemoria minimo a scadenza fissa con consenso versionato, inviti, revoca ed erasure coordinata | CAF-03; nessuna correlazione tra CAF, nessun rinnovo prestazione automatico                |
| RES-04 | Autenticazione/autorizzazione, audit, manutenzione, cancellazione, backup/restore e assistenza diritti/incidenti                                                  | CAF-04; schede fornitori e procedure operative **da completare**                           |

Finalità, interessati, basi e termini sono campi di supporto qui richiamati anche se
l'art. 30.2 ha contenuti diversi dall'art. 30.1. Questa sezione non attribuisce al
gestore finalità proprie sui fascicoli. Il gestore tiene **separatamente** le voci
come titolare per lead del sito, contratti/fatture, personale e attività autonome
eventualmente pertinenti, con relativa informativa; non sono coperte dalla nomina.

## 4. Approvazione e manutenzione

CAF: compilatore **[da completare]**, approvazione titolare/data **[da completare]**.
Gestore: compilatore e approvazione responsabile/data **[da completare]**.
Riesame proposto almeno annuale e a ogni nuovo CAF/verticale/finalità/fornitore/paese,
variazione retention o incidente; mantenere cronologia versioni e accesso riservato.

Fonti consultate il **16 ottobre 2026**: [GDPR, artt. 5, 6, 9, 10 e 30][gdpr];
[EDPB 07/2020, ruoli effettivi](https://www.edpb.europa.eu/system/files/documents/2023-10/EDPB_guidelines_202007_controllerprocessor_final_en.pdf).
Prodotto: [SECURITY](../SECURITY.md), [DEPLOY](../DEPLOY.md), [AI](../decisions/ai-platform.md),
[rinnovi](../decisions/renewals.md). Metodo/limiti: [README](README.md#fonti-ufficiali-e-metodo-di-verifica).

[gdpr]: https://eur-lex.europa.eu/eli/reg/2016/679/oj/ita
