> Bozza da far verificare da un legale/DPO; non è consulenza legale

# Elenco e autorizzazione dei sub-responsabili

Versione 0.1 del 16 ottobre 2026. Allegato all'[accordo art. 28](accordo-art28.md),
CAF **[da completare]**, gestore Avanti **[da completare]**, ambiente **[da completare]**.
Compila Avanti; il CAF verifica e autorizza. Nessuna riga incompleta costituisce
autorizzazione all'invio di dati reali. Non allegare credenziali o link personali.

## 1. Elenco da finalizzare

Distinguere l'integrazione disponibile dalla persona giuridica contrattualizzata.
Il repo prevede Vercel, Neon Launch Frankfurt e Blob privato Frankfurt; DEPLOY indica
Neon come scelto per il primo pilota ma non ne attesta provisioning o contratto.
Supabase è un'alternativa documentata, non un fornitore automaticamente aggiunto.
Resend è l'adattatore email scelto tecnicamente, attivabile da configurazione.
I provider AI sono intercambiabili: prove sintetiche su un modello non lo autorizzano
per i cittadini. Non riportare nomi candidati come fornitori già approvati.

| ID e funzione                        | Soggetto contrattuale / stato                                                                                    | Cosa può trattare                                                                                                                               | Dove e per quanto                                                                                                  | Garanzie/evidenze da ottenere                                                                                                                            |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1 — hosting applicazione            | Vercel previsto; entità legale/piano **da completare**                                                           | Richieste, fascicoli durante elaborazione, file in transito, sessioni/capability, metadati di rete e log                                        | Functions `fra1` da verificare; CDN, log, supporto, backup e accessi fuori SEE **da completare**                   | DPA, catena infrastrutturale, regioni, oscuramento token/log, privilegi, incidenti e cancellazione                                                       |
| D1 — database                        | Neon Launch Frankfurt indicato nel runbook; entità/account **da completare**                                     | Fascicoli strutturati, persone/contatti, messaggi, note, estrazioni, audit, credenziali hashate, segreti MFA e outbox cifrati, metadati tecnici | `aws-eu-central-1` prevista; PITR/snapshot 7 giorni proposti; localizzazioni e termini effettivi **da completare** | DPA, regione risorse/repliche/supporto, TLS, cifratura a riposo, controllo accessi e restore. Eventuale sostituzione con altro DB richiede aggiornamento |
| S1 — storage documenti               | Vercel Blob privato previsto; entità e store **da completare**                                                   | Documenti completi e relativi oggetti, possibili categorie art. 9 e dati di minori                                                              | Frankfurt `fra1` prevista; oggetti fino al purge dell'ultimo riferimento; copie provider **da completare**         | Accesso realmente privato, DPA, regione, cifratura a riposo, delete e copie residue; binari separati dal DB                                              |
| B1 — backup file e copie ulteriori   | **da scegliere**                                                                                                 | Copie cifrate dei documenti, manifest riservato e hash                                                                                          | Destinazione UE richiesta, finestra proposta 7 giorni; scadenze incluse copie eccezionali **da completare**        | DPA se soggetto distinto, chiavi separate, cancellazione, restore provato e registro revoche; il repo non implementa la copia remota                     |
| E1 — invio email                     | Resend scelto tecnicamente; entità/account **da completare**; console locale simula                              | Indirizzo, mittente, messaggio minimo, nome CAF; titoli di integrazioni o riferimento ricevuta; per rinnovi **link personale** e anno           | Recapito, log, supporto, retention contenuti/eventi e paesi **da completare**                                      | DPA, catena, trasferimenti, tracking disabilitato, dominio, cancellazione e gestione incidenti. La cifratura outbox termina prima del recapito           |
| A1 — router/gateway AI               | **da scegliere** tra integrazioni disponibili; OpenRouter/Vercel AI Gateway sono possibilità, non autorizzazioni | Testo, contesto minimo, output; secondo compito documento/immagine o audio                                                                      | Endpoint, instradamento, UE se disponibile, metadati e supporto **da completare**                                  | DPA, ZDR dei contenuti/no training, mappa di ogni destinatario effettivo e fallback; `strict` o `gateway.only` non provano queste condizioni             |
| A2 — inferenza testuale              | **da scegliere**; società che eroga l'endpoint e modello **da completare**                                       | Racconto/turni selezionati, risposte pertinenti, traduzioni; contesto ridotto del copilota senza contatti, note interne o nomi file             | Modello/versione/endpoint/regione per ogni tentativo **da completare**                                             | ZDR contrattuale/no training, eccezioni sicurezza, retention telemetria distinta, catena, trasferimenti; non basta il nome del modello                   |
| A3 — visione/lettura documenti       | **da scegliere**, anche se coincide con A2 indicarlo                                                             | Singolo documento/immagine necessari, campi estratti e output, possibili dati particolari                                                       | Regione e endpoint **da completare**; assenza persistenza file/contenuti da dimostrare                             | DPA e ZDR per modalità binarie/Files eventualmente usate, no training; non estendere condizioni testo alla visione senza evidenza                        |
| A4 — trascrizione audio              | **da scegliere**, con catena effettiva **da completare**                                                         | Voce e parlato, possibile presenza accidentale di terzi o dati delicati, trascrizione                                                           | Audio in memoria nell'app; paese/retention lato fornitore **da completare**                                        | Endpoint audio espressamente coperto da ZDR/no training; nessuna identificazione biometrica prevista, garanzie e limiti da verificare                    |
| A5 — modelli/endpoint di riserva     | **da scegliere**, una riga per ogni combinazione                                                                 | Stesse categorie del compito ritentato; anche più destinatari per una sola richiesta                                                            | **da completare** per ciascuno                                                                                     | Stesse garanzie del primario; nessun downgrade automatico a policy permissiva; fallback locale se manca una catena approvata                             |
| T1 — assistenza/monitoraggio esterni | **da scegliere solo se necessari**; assenza di servizio aggiuntivo **da confermare**                             | Metadati tecnici minimizzati; eventuale accesso ai dati per assistenza documentata                                                              | **da completare**                                                                                                  | Evitare prompt, payload, capability, replay e analytics sui fascicoli; se esterni trattano dati personali includerli nella catena e nel DPA              |

Browser/app di autenticazione scelti autonomamente dall'operatore e sistemi esterni di
prenotazione non diventano automaticamente sub-responsabili di Avanti. Il CAF censisce
gli eventuali propri responsabili e titolari autonomi. La trasmissione successiva a
INPS/Agenzia Entrate/autorità è del flusso CAF, fuori dall'invio di Avanti.

## 2. Scheda obbligatoria per ogni soggetto

Duplicare questa scheda per H1–T1 e per ogni destinatario della catena che tratta dati;
se un soggetto copre più funzioni richiamare gli ID. Un elenco pubblico collegato
non sostituisce la versione approvata e l'avviso diretto delle modifiche.

| Campo                                                                 | Compilazione                                                                                                                                |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| ID funzione, denominazione legale, sede, paese e contatti             | **da completare**                                                                                                                           |
| Rapporto nella catena                                                 | Contratto con Avanti o sub-responsabile di **[da completare]**; eventuali finalità autonome del fornitore da valutare separatamente         |
| Servizio/piano/account, attività e categorie di dati/interessati      | **da completare**, riferimenti interni senza segreti                                                                                        |
| DPA e garanzie art. 28                                                | Versione, data, contraenti, copia riservata e referente **da completare**                                                                   |
| Paesi di esecuzione, storage, repliche, backup, telemetria e supporto | **da completare**, distinguere UE/SEE e paesi terzi                                                                                         |
| Retention                                                             | Contenuti, output, sicurezza/abusi, metadati, copie e scadenze **da completare**; ZDR contenuti non significa assenza di qualsiasi metadato |
| Addestramento/uso ulteriore                                           | Esclusioni vincolanti e relative eccezioni **da completare**; se incompatibili non attivare                                                 |
| Trasferimenti capo V                                                  | Assenti con motivazione oppure paesi/importatori, adeguatezza o SCC/modulo, valutazione e misure supplementari **da completare**            |
| Sicurezza e continuità                                                | Cifratura trasporto/riposo, accessi, audit, cancellazione, backup e prove **da completare**                                                 |
| Assistenza/incidenti                                                  | Canale, reperibilità e termini compatibili con le 24 ore Avanti–CAF, audit e diritti **da completare**                                      |
| Catena successiva                                                     | Elenco/versione, meccanismo di notifica e gestione opposizioni **da completare**                                                            |
| Esito e autorizzazione                                                | Ammesso/non ammesso, funzioni abilitate, condizioni, referente Avanti e autorizzazione CAF con data **da completare**                       |

Per AI allegare anche la matrice **compito → router → modello/versione → operatore
dell'endpoint → paese di elaborazione → retention → fallback**, distinta per testo,
immagini/PDF e audio. «UE quando disponibile» richiede una scelta documentata per
ogni endpoint; non usare un marchio europeo come prova di localizzazione.

## 3. Procedura di selezione e modifica

1. Avanti raccoglie contratti, schede e mappa effettiva dei flussi; verifica garanzie
   prima di introdurre chiavi o dati reali. I test permissivi restano sintetici.
2. CAF/DPO valutano finalità, trasferimenti e rischio; Avanti propone configurazione
   chiusa sui soli destinatari approvati. Se le garanzie mancano resta il fallback locale.
3. CAF e Avanti firmano l'elenco iniziale completo. L'approvazione di un router include
   solo i destinatari esplicitamente censiti, non ogni modello raggiungibile dal router.
4. Ogni aggiunta/sostituzione segue preavviso 30 giorni, opposizione entro 15 e gestione
   delle obiezioni prevista dall'accordo. Cambiare endpoint, paese, retention o riserve
   richiede riesame anche se il marchio non cambia; applicare le autorizzazioni per
   trasferimenti prima dell'attivazione.
5. Avanti registra versione/data, prova configurazione con dati sintetici e aggiorna
   informativa, DPIA e registri dove necessario. Verifica almeno annuale proposta e a
   ogni cambiamento rilevante; nominare il responsabile del riesame **[da completare]**.

## 4. Approvazione

Versione definitiva elenco **[da completare]**, allegati riservati **[da completare]**.
Funzioni non abilitate **[da completare]**. Prima verifica successiva **[da completare]**.
Per Avanti **[nome/firma/data]**; per CAF **[nome/poteri/firma/data]**.

## Fonti

Consultazione **16 ottobre 2026**: [GDPR, artt. 28 e 44–49](https://eur-lex.europa.eu/eli/reg/2016/679/oj/ita),
[EDPB 07/2020, parte II, responsabili e sub-responsabili](https://www.edpb.europa.eu/system/files/documents/2023-10/EDPB_guidelines_202007_controllerprocessor_final_en.pdf),
[EDPB 01/2020, trasferimenti e misure supplementari](https://www.edpb.europa.eu/documents/recommendation/recommendations-012020-on-measures-that-supplement-transfer-tools-to_en).
Metodo e limiti: [README](README.md#fonti-ufficiali-e-metodo-di-verifica).
Stato del prodotto ricavato da [DEPLOY](../DEPLOY.md), [SECURITY](../SECURITY.md),
[decisione AI](../decisions/ai-platform.md) e [rinnovi](../decisions/renewals.md),
letti il 16 ottobre 2026; nessun contratto fornitore esaminato in questa attività.
