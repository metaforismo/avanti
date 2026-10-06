# Prospetto DSU per il gestionale del CAF

Verifica delle fonti: **6 ottobre 2026**. Il prospetto prepara l'ISEE ordinario:
non calcola l'indicatore, non compila o trasmette la DSU e non accede agli archivi
INPS/AdE. La composizione legale del nucleo e la scelta dei moduli restano al CAF.

## Modello verificato e aggiornamenti

Fonti ufficiali riaperte nella presente revisione:

1. [MLPS, decreto n. 3 del 2 marzo 2026](https://www.lavoro.gov.it/documenti-e-norme/normative/pagine/decreto-interdipartimentale-n-3-del-2032026),
   approvazione del modello e delle istruzioni; [testo del decreto](https://www.lavoro.gov.it/sites/default/files/documenti-e-norme/normativa/Decreto-Dip-3-del-02032026-ISEE.pdf).
2. [MLPS, DSU Mini 2026](https://www.lavoro.gov.it/strumenti-e-servizi/isee-dsu-mini-2026),
   pp. 2–4: A/B, FC1–FC6; p. 5: sottoscrizione/ricevuta.
3. [MLPS, DSU integrale 2026](https://www.lavoro.gov.it/strumenti-e-servizi/isee-dsu-2026),
   pp. 3–5: A/B, C/D, E e nucleo ristretto; pp. 6–8: FC1–FC6; p. 9: FC7; pp. 10–11: FC8; p. 12: FC9.
4. [MLPS, istruzioni 2026](https://www.lavoro.gov.it/strumenti-e-servizi/isee-istruzioni-2026),
   parte 1 §§3.5–3.6: dati precompilati/autodichiarati; parte 2: singoli quadri;
   parti 3–4: moduli ulteriori e integrazione.
5. [INPS, messaggio 799 del 6 marzo 2026](https://www.inps.it/content/dam/inps-site/it/scorporati/circolari-e-messaggi/2026/03/Circolare_15192/Allegati/16613_Messaggio-numero-799-del-06-03-2026.pdf):
   aggiornamento annualità fiscali, attestazione per specifiche prestazioni familiari
   e inclusione e disposizione 2026 sugli immobili distrutti/inagibili per calamità.

La [pagina ISEE del Ministero](https://lavoro.gov.it/strumenti-e-servizi/isee/pagine/default)
continua a elencare la documentazione **2026**. La ricerca mirata DSU/modello 2027
sui siti MLPS e INPS non ha restituito un modello o istruzioni 2027 pubblicati.
Questo è il risultato della consultazione, non prova che non possano uscire aggiornamenti.
Il catalogo Avanti prepara il 2027 con redditi/giacenza 2025 e patrimoni al
31/12/2025 secondo la regola vigente del secondo anno precedente, come documentato
in [isee-2027.md](isee-2027.md). Nucleo, casa e veicoli sono alla presentazione.
Non estendere al 2027 la disposizione calamità limitata al 2026; ricontrollare
modello, istruzioni e legge di bilancio prima del pilota.

**La Mini non contiene C né FC7.** C e D appartengono a MB.2, E a MB.3; MB.1rid riusa A/B per il nucleo ristretto; FC7 è nel modulo FC.2; FC8 nel modulo integrativo FC.3; FC9 nel FC.4.
Il prospetto include FC7 e un promemoria FC8 per la valutazione CAF, ma non si
presenta come una Mini sufficiente per qualunque nucleo. Università, disabilità,
genitori non coniugati/non conviventi, esonero senza CU e sospensione tributaria
possono richiedere l'integrale anche partendo dalla raccolta ordinaria.

## Come leggere l'inventario

I nomi dei campi sotto rimandano ai quadri dei modelli citati. Le righe ripetute
per componente/rapporto/immobile/mezzo mantengono la stessa definizione.

- **D**: autodichiarazione del dichiarante, assistita/verificata dal CAF.
- **P/D**: dato precompilabile INPS/AdE che il dichiarante accetta, modifica o integra;
  in modalità non precompilata il dato va dichiarato. Non ogni patrimonio è precompilato:
  estero, terreni, impresa/partecipazioni e mutui richiedono attenzione (istruzioni §§3.5–3.6).
- **P/CAF**: acquisizione dagli archivi; Avanti non la effettua. Rettifiche/esoneri
  richiedono valutazione del CAF, non una sostituzione automatica con risposte Avanti.
- **Documento**: Avanti richiede una copia pertinente in checklist, condizionata alle
  risposte. Il campo non è estratto: fonte `document` solo con voce verificata
  dall'operatore e documento ancora abbinato/analizzato; altrimenti `missing`.
- **No**: nessuna domanda strutturata o documento specifico sufficiente oggi.
  Una descrizione libera può citare il dato ma non costituisce estrazione del campo.

Il CAF non diventa autore delle autodichiarazioni: qui `caf` indica un'attività ancora
da svolgere, non un fatto attestato. Le risposte raccolte sono dichiarazioni da
confermare; analisi AI/euristiche non sono attestazioni né estrazione di valori DSU.

## MB.1 — A, Nucleo familiare

Fonte: Mini p. 2 / integrale p. 3. Serve la famiglia alla presentazione, con eventuali
attrazioni/esclusioni verificate; il dichiarante va al primo rigo.

| Campo nel modello                                           | Compila | Avanti oggi / prospetto                                                         |
| ----------------------------------------------------------- | ------- | ------------------------------------------------------------------------------- |
| Cognome                                                     | D       | `members[].lastName`; se assente, documento `identity`                          |
| Nome                                                        | D       | `members[].firstName`, risposta `members`                                       |
| Codice fiscale                                              | D       | Documento `tax_code`, nessuna estrazione                                        |
| Data di nascita                                             | D       | Documento `identity`; `birthYear` è solo anno e non viene trasformato in data   |
| Comune o Stato estero di nascita                            | D       | Documento `identity`, non estratto                                              |
| Sesso M/F                                                   | D       | Documento `identity`, non estratto; nessuna inferenza dal nome                  |
| Assenza redditi/trattamenti/patrimoni del minore            | D       | No verifica congiunta: `income_present_<id>` non prova assenza patrimoni; `caf` |
| Genitori occupati per almeno sei mesi nell'anno dei redditi | D       | No; `caf`                                                                       |
| Genitore solo con figli minorenni                           | D       | No conferma legale; `caf`                                                       |
| Numero figli (almeno due), di cui conviventi                | D       | No elenco completo figli non conviventi; `caf`, non derivato dai ruoli          |

`household_count`, `members`, `household_exceptions`, `nonresident_parent` sono
supporto alla raccolta, non accertamento del nucleo. Non si aggiungono persone
attratte e non si escludono persone sulla base del racconto.

## MB.1 — B, Casa di abitazione

Fonte: Mini p. 2 / integrale p. 3. Abitazione alla presentazione; il canone è quello
annuale contrattuale corrente, non l'importo dei pagamenti del 2025.

| Campo nel modello                                                 | Compila | Avanti oggi / prospetto                                      |
| ----------------------------------------------------------------- | ------- | ------------------------------------------------------------ |
| Via                                                               | D       | Documento `rent` se affitto; altrimenti No                   |
| Numero civico                                                     | D       | Come via                                                     |
| CAP                                                               | D       | Come via                                                     |
| Comune                                                            | D       | Come via; non l'indirizzo dello sportello                    |
| Provincia                                                         | D       | Come via                                                     |
| Proprietà/altro diritto reale, locazione, altro                   | D       | Risposta `housing`, tradotta nella casella del modello       |
| CF intestatari del contratto                                      | D       | Documento `rent`, non estratto                               |
| Data registrazione                                                | D       | Documento `rent`, non estratta                               |
| Serie                                                             | D       | Documento `rent`, non estratta                               |
| Numero registrazione e relativo suffisso                          | D       | Documento `rent`, non estratto                               |
| Codice ufficio                                                    | D       | Documento `rent`, non estratto                               |
| Canone annuale previsto dal contratto                             | P/D     | Documento `rent`; possibile acquisizione precompilata al CAF |
| Residenza familiare del dichiarante/coniuge con residenze diverse | D       | No scelta strutturata; `caf`                                 |

## FC.1 — FC1, Dati del componente

Fonte: Mini p. 3 / integrale p. 6. Per ciascuno: nome/cognome/CF come A; nessun
telefono o e-mail della pratica viene attribuito automaticamente a tutti i membri.

| Campo nel modello                         | Compila | Avanti oggi / prospetto                                                             |
| ----------------------------------------- | ------- | ----------------------------------------------------------------------------------- |
| Cognome, nome, CF                         | D       | Come le tre righe corrispondenti di A                                               |
| Relazione con il dichiarante              | D       | `members[].role`: D/C/P proposti se un solo richiedente; conferma CAF. Figli: `caf` |
| Cittadinanza                              | D       | Documento `identity`, non estratta                                                  |
| Via di residenza diversa dal B            | D       | No                                                                                  |
| Numero civico                             | D       | No                                                                                  |
| CAP                                       | D       | No                                                                                  |
| Comune                                    | D       | No                                                                                  |
| Provincia                                 | D       | No                                                                                  |
| Telefono facoltativo                      | D       | No per componente; contatto pratica separato                                        |
| E-mail facoltativa                        | D       | No per componente; contatto pratica separato                                        |
| Convivenza anagrafica (istituto ecc.)     | D       | No                                                                                  |
| Attività lavorativa (casella facoltativa) | D       | No categoria esatta; `self_employed_members` è solo un indizio                      |

Codici relazione del modello: D, C, F, MA, FC, FNC, P, GNC. Il ruolo generico
`figlio` e il solo anno di nascita non determinano minorità, affidamento, convivenza
o carico fiscale: nessun F/FC/FNC/MA viene inventato. Richiedente e dichiarante
possono differire: D è una proposta esplicitamente da confermare.

## FC.1 — FC2, Patrimonio mobiliare per rapporto

Fonte: Mini pp. 3–4 / integrale pp. 6–7, istruzioni parte 2 FC2. Rapporti anche chiusi
nell'anno, carte, quote e dati esteri vanno verificati. Avanti ha istanze numerate
`account_<n>` con un intestatario o `joint`, non l'elenco di tutte le quote.

| Campo nel modello                                 | Compila                     | Avanti oggi / prospetto                                                                 |
| ------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------- |
| Nessun/almeno un rapporto finanziario             | D                           | `accounts_count = 0`: riga `Nessuno` per componente, dichiarazione da confermare al CAF |
| Tipo rapporto, sez. I                             | P/D                         | `account_type_<n>` raggruppa depositi/investimenti/altro: non determina 01/03/09; `caf` |
| Identificativo rapporto, sez. I                   | P/D                         | `account_balance`, documento non estratto                                               |
| CF operatore finanziario, sez. I                  | P/D                         | `account_balance`; `account_bank_<n>` è solo nome dell'istituto                         |
| Saldo al 31 dicembre                              | P/D                         | `account_balance`, nessun valore estratto                                               |
| Giacenza media annua                              | P/D                         | `account_average` per depositi, nessun valore estratto                                  |
| Data inizio se aperto nell'anno                   | P/D                         | `account_balance`, non estratta                                                         |
| Data fine se chiuso nell'anno                     | P/D                         | `account_balance`, non estratta                                                         |
| Totale saldo A                                    | CAF su dati D/P             | No somma; `caf`                                                                         |
| Totale giacenza B                                 | CAF su dati D/P             | No somma; `caf`                                                                         |
| Differenza A-B                                    | CAF su dati D/P             | No calcolo; `caf`                                                                       |
| Incremento patrimonio almeno pari a B-A (casella) | D                           | No; promemoria `caf`                                                                    |
| Incremento patrimonio immobiliare C               | D                           | No importo; `caf`                                                                       |
| Incremento patrimonio mobiliare D                 | D                           | No importo; `caf`                                                                       |
| Totale C+D                                        | CAF su dati D               | No calcolo; `caf`                                                                       |
| Tipo rapporto, sez. II                            | P/D                         | Categoria `investment` insufficiente per 02/05/06/07 e altri codici; `caf`              |
| Identificativo rapporto, sez. II                  | P/D                         | Documento `investment`                                                                  |
| CF operatore finanziario, sez. II                 | P/D                         | Documento `investment`                                                                  |
| Valore, sez. II                                   | P/D                         | Documento `investment`                                                                  |
| Data inizio, sez. II                              | P/D                         | Documento `investment`                                                                  |
| Data fine, sez. II                                | P/D                         | Documento `investment`                                                                  |
| Altre forme: partecipazioni/patrimonio d'impresa  | D (alcune non precompilate) | Documento `business` per membri selezionati, classificazione/valore CAF                 |

I gruppi sono supporto Avanti, non codici del modello. `other` non identifica una
sezione DSU: il CAF deve classificare il rapporto e richiedere anche la giacenza
se pertinente. `excluded_savings` richiede certificazioni, non sottrae 50.000 euro
per rapporto; `foreign_assets` genera un documento di nucleo senza attribuirlo a
ciascun membro. Vedi le fonti su esclusioni/quote in [isee-2027.md](isee-2027.md).
Le istanze `joint`/sconosciute rimangono senza `memberId`, una sola volta: niente
replica su tutti i componenti o calcolo di quote.

## FC.1 — FC3, Patrimonio immobiliare per cespite

Fonte: Mini p. 4 / integrale p. 7; istruzioni FC3. Il CAF verifica consistenza,
valore e quota alla data patrimoniale pertinente, non confonde rendita e valore IMU.

| Campo nel modello                                  | Compila         | Avanti oggi / prospetto                                                     |
| -------------------------------------------------- | --------------- | --------------------------------------------------------------------------- |
| Tipo patrimonio F/TE/TA                            | P/D (terreni D) | Documento `property`; `property_label_<n>` è solo descrizione               |
| Comune o Stato estero                              | P/D (estero D)  | Documento `property`, non estratto dalla descrizione                        |
| Quota posseduta (%)                                | P/D             | Documento `property`; `property_owner_<n>` non è quota                      |
| Valore IMU/IVIE della quota                        | P/D (estero D)  | Documento `property`, nessun calcolo/estrazione                             |
| Quota capitale residua mutuo della quota posseduta | D               | Documento `mortgage` se dichiarato; nessun valore estratto o zero implicito |
| Casa di abitazione (casella)                       | D               | Correlazione con B non raccolta; `caf`                                      |

Per co-intestati/estero seguono gli stessi limiti di titolarità del FC2. Il valore
«mutuo assente» non crea automaticamente 0,00 in un campo fiscale.

## FC.1 — FC4, Redditi e trattamenti da dichiarare a fini ISEE

Fonte: Mini p. 4 / integrale p. 8; istruzioni FC4. Tutti questi campi sono **D**,
anche dopo la precompilazione; distinguere trattamenti INPS (acquisiti) e quelli
non INPS, e non includere automaticamente prestazioni per disabilità.

| Campo nel modello                                                  | Compila | Avanti oggi / prospetto                                                           |
| ------------------------------------------------------------------ | ------- | --------------------------------------------------------------------------------- |
| Redditi a imposta sostitutiva/ritenuta d'imposta                   | D       | Documento `exempt_income`, categoria esatta e importo non estratti                |
| Redditi esenti, esclusi trattamenti INPS                           | D       | Documento `exempt_income`                                                         |
| Proventi agrari ai fini IRAP                                       | D       | Documento `business` se presente; non garantisce copertura del reddito agrario    |
| Redditi fondiari di beni non locati soggetti a IMU                 | D       | Documento `property` se presente; il valore catastale da solo non è il reddito    |
| Trattamenti non IRPEF/non INPS, escluse prestazioni per disabilità | D       | Documento `exempt_income`, esclusioni CAF                                         |
| Lavoro/pensione tassati esclusivamente all'estero                  | D       | Documento `foreign_income` per membro selezionato                                 |
| Reddito lordo fiscale residenti AIRE nel paese di residenza        | D       | Documento `foreign_income`; iscrizione AIRE non raccolta                          |
| Redditi fondiari esteri non locati soggetti a IVIE                 | D       | Documento `foreign_income` se presente; potrebbe servire ulteriore certificazione |

`income_present_<id>` non è un importo; `false` rimuove una richiesta di CU ma non
compila a zero FC4 o FC8. I documenti indicati sono evidenze da consultare: non
attestano che ogni voce sia presente nel file. Se manca la certificazione specifica
va acquisita dal CAF. Le domande speciali individuano solo i membri interessati.

## FC.1 — FC5, Assegni periodici per coniuge e figli

Fonte: Mini p. 4 / integrale p. 8. Tutte le righe sono **D**; Avanti raccoglie
`maintenance` e membri coinvolti, quindi documento `maintenance`, senza direzione
ricevuto/pagato o importi estratti.

| Campo nel modello                                                            | Compila | Avanti oggi / prospetto                        |
| ---------------------------------------------------------------------------- | ------- | ---------------------------------------------- |
| Assegni percepiti per mantenimento figli                                     | D       | Documento `maintenance`                        |
| Assegni corrisposti al coniuge, inclusi figli, dopo separazione/scioglimento | D       | Documento `maintenance`; condizioni legali CAF |
| Assegni corrisposti per figli conviventi con altro genitore                  | D       | Documento `maintenance`; condizioni legali CAF |

Il mantenimento percepito per il coniuge non va duplicato in questa prima riga:
è nel reddito complessivo acquisito da AdE.

## FC.1 — FC6, Autoveicoli e altri beni durevoli

Fonte: Mini p. 4 / integrale p. 8. Mezzi intestati alla presentazione.

| Campo nel modello             | Compila | Avanti oggi / prospetto                                                        |
| ----------------------------- | ------- | ------------------------------------------------------------------------------ |
| Tipo A/M/N/I                  | D       | Documento `vehicle`; descrizione libera non tradotta automaticamente in codice |
| Targa o estremi registrazione | D       | Documento `vehicle`, nessuna estrazione                                        |

`vehicles_count`, `vehicle_owner_<n>`, `vehicle_label_<n>` individuano istanze e
intestatario. Il CAF verifica auto, moto di almeno 500 cc, navi e imbarcazioni;
una moto citata non prova la cilindrata richiesta. Nessuna assenza per membro viene
inferita dal mancato abbinamento di un mezzo.

## FC.2 — FC7, Disabilità e non autosufficienza

Fonte: integrale p. 9, non Mini. `disability` e `disability_members` richiedono il
verbale pertinente, non una cartella clinica.

| Campo nel modello                                      | Compila | Avanti oggi / prospetto                                                         |
| ------------------------------------------------------ | ------- | ------------------------------------------------------------------------------- |
| Disabilità media/grave/non autosufficienza (casella)   | D       | Documento `disability`, classificazione da verificare; nessuna inferenza dal sì |
| Ente certificatore                                     | D       | Documento `disability`, non estratto                                            |
| Numero documento certificazione                        | D       | Documento `disability`, non estratto                                            |
| Data certificazione                                    | D       | Documento `disability`, non estratta; scadenza dell'analisi non è data rilascio |
| Beneficiario socio-sanitario residenziale continuativo | D       | No; `caf`, valutare MB.3                                                        |

## Quadri ulteriori e acquisizioni CAF

Fonte: integrale e istruzioni parti 3–4. Non sono compresi nella compilazione del
prospetto ordinario di questa consegna; eventuali segnali non sono valori da copiare.

| Modulo / quadro / campi                                                                                                                                      | Compila                  | Avanti oggi                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ | -------------------------------------------------------------------------------------- |
| MB.2 C: CF studente, presenza genitori, condizioni residenza/capacità reddituale per autonomia, CF e protocollo DSU genitore                                 | D/CAF                    | Solo `university` generale; campi non raccolti. ISEE universitario restituisce `null`  |
| MB.2 D: generalità/CF genitore non convivente, CF figli, esclusioni/provvedimenti, nuovo coniuge/altri figli, CF/protocollo DSU o foglio componente genitore | D/CAF                    | `nonresident_parent`, documento `parent` facoltativo; nessuno dei valori estratto      |
| MB.3 E: beneficiario residenziale, nucleo ridotto, figli fuori nucleo/DSU e donazioni                                                                        | D/CAF                    | No percorso di compilazione                                                            |
| MB.1rid A/B: nucleo familiare ristretto                                                                                                                      | D/CAF                    | No determinazione autonoma del nucleo ridotto                                          |
| FC.3 FC8 I/II: identificazione/rettifica, esonero/sospensione tributaria                                                                                     | D/CAF                    | Non interrogato esplicitamente; `income_present` non determina esonero                 |
| FC8 II/III: reddito complessivo IRPEF, redditi dipendente/pensione/altri, trattamenti INPS, spese previste                                                   | P/CAF, salvo eccezioni D | Documento `income` disponibile come supporto, valori non estratti; nel prospetto `caf` |
| FC.4 FC9: componente aggiuntiva                                                                                                                              | D/CAF                    | No calcolo né compilazione                                                             |
| Sottoscrizione, luogo/data, deleghe/identificazione, ricevuta/protocollo                                                                                     | D/CAF                    | Informativa Avanti non è delega DSU; nessuna firma o protocollo inventato              |
| MS S1–S5: ISEE corrente                                                                                                                                      | D/CAF                    | Fuori ambito                                                                           |

## Contratto e scelte implementative

`DsuSheet` è necessario in `packages/contracts`: API e futuri consumatori condividono
ordine, riferimenti e provenienza, senza ricostruire il modello dal testo del dossier.
La modifica va descritta nella PR: aggiunta compatibile `CaseDossier.dsuSheet` (default
`null` per payload precedenti), endpoint nullable e schemi dei tipi fonte/riga/sezione.
Non vengono cambiati questionario, dati persistiti o contratti del flusso cittadino.

- `version: 1`, `practiceId`, `modelYear: 2026`, URL del modello integrale,
  `declarationYear: 2027`, `referenceYear: 2025`, `notes`, `sections` ordinate.
- Ogni sezione ha `module`, `quadro`, titolo ufficiale, `memberId/memberName`
  nullable, `instanceId` nullable e `rows`. `instanceId` è la posizione del rapporto
  nell'intervista, **non** il suo identificativo fiscale/bancario.
- Ogni riga ha `label`, `value: string | null`, `source`, `note?`. `answer` richiede
  `questionId` e valore; `document` richiede `documentId/checklistItemId` e valore
  `null`; `missing` può riferire domanda/voce; `caf` ha valore `null`.
- Formati disponibili nel core: ISO completo e valido → gg/mm/aaaa; importo finito,
  non negativo → due decimali con virgola, senza separatore migliaia. Le date/importi
  fiscali oggi non sono raccolti come risposte e rimangono `null`; nessun dato viene
  ricavato dal nome file, anno di nascita, `expiresOn`, `ownerName` o testo libero.
- Campi di supporto (anno nascita, banca, descrizioni, intestatari) sono etichettati
  come tali. Le categorie ampie non diventano codici specifici di rapporto o bene.
- Documento rifiutato, non verificato, in analisi, fallito, con abbinamento obsoleto
  o intestatario incompatibile non diventa una fonte verificata. Non si usano
  documenti di un altro componente come fallback. Fra più documenti verificati
  della stessa voce si sceglie deterministicamente il primo per ID; gli altri
  restano elencati nel dossier, tutti da consultare se necessario.
- Campi non pertinenti/non attribuiti restano da valutare, senza zero né assenza
  impliciti. Il prospetto può quindi contenere `missing` anche per campi che il CAF
  escluderà dopo verifica: non è un conteggio di documenti obbligatori mancanti.

`GET /api/cases/:id/dsu-sheet`: sessione operatore dell'organizzazione, risposta
`DsuSheet | null`, 401 senza sessione, 404 per pratica assente/altra organizzazione,
400 per ID fuori schema. Audit `dsu_sheet.viewed` a ogni accesso riuscito, incluso
`null`, con metadata `{}` e senza dati personali. Nessuna modifica di stato o
`updatedAt` della pratica. JSON e PDF del fascicolo usano la stessa costruzione;
nel PDF «Prospetto DSU» è la sezione finale, con valore, fonte e nota per riga.
Gli export mantengono l'audit esistente `case.exported`.
