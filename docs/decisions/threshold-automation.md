# Proposta: pratica «quasi pronta» per revisione rapida

Stato: **implementata per il pilota** — 15 ottobre 2026.
Approvata dal fondatore; interfaccia operatore in sviluppo separato.
Ambito iniziale: ISEE ordinario; nessun invio agli enti e nessun cambio automatico a
«pronta». Quel passaggio resta un'azione esplicita dell'operatore abilitato.

## Ammissione deterministica

Tutte le condizioni sono necessarie; un punteggio AI alto non ne compensa una mancante:

- Intervista terminata, nessuna proposta o modifica pendente; componenti identificati,
  rapporti e veicoli con proprietario; anno della pratica e catalogo ancora validi.
- Tutti i documenti obbligatori presenti e abbinati; nessun rifiuto, upload in elaborazione,
  documento duplicato o integrazione/domanda del cittadino aperta.
- Nessun blocker o warning delle regole o incongruenza AI non risolta. Nessun avviso di
  sicurezza nel fascicolo: questi casi richiedono attenzione umana, senza assegnare loro
  una priorità inferiore nella coda.
- Identità, titolarità, anni, scadenze, leggibilità e pagine risultano controllabili e
  coerenti per ogni voce obbligatoria; una lettura euristica da sola non basta. Il contenuto
  già verificato manualmente dall'operatore è ammissibile.
- Esclusi inizialmente: nucleo con eccezioni, genitore non convivente, università, attività
  autonoma, redditi/patrimoni esteri, disabilità, mantenimento, esenzioni, cointestazioni e
  altri casi che il catalogo segnala per giudizio professionale.
- Dossier, regole e letture riferiti alla stessa versione; nessun esito in cache antecedente
  all'ultima modifica. AI spenta, budget finito, timeout, schema invalido o guard attivato:
  percorso ordinario, mai «quasi pronta» per ripiego.

## Segnale AI e soglie iniziali

Due compiti con responsabilità diverse: lettura documentale e confronto del dossier.
Il confronto deve restituire zero incongruenze nuove e ogni dato usato per l'ammissione
ha una fonte effettiva (documento/pagina o risposta confermata). Il riepilogo non è una
seconda verifica indipendente se usa lo stesso modello e le stesse letture.

Proposta per la prima valutazione in ombra: confidenza di lettura ≥0,98 per ogni campo
critico e ≥0,95 per gli altri campi utilizzati. Nessuna media: prevale il valore minimo.
Sono soglie candidate, **non probabilità di correttezza**; la confidenza dichiarata dal
modello non è calibrata. Un campo non disponibile o dubbio rende il caso non ammissibile.
Nessun calcolo o importo DSU viene confermato automaticamente.

Dopo calibrazione su casi annotati dal CAF, abilitare il suggerimento visibile solo se
la precisione dei casi selezionati è ≥99%, con limite inferiore unilaterale al 95%
≥98% e zero errori critici nel campione. Servono almeno 300 casi selezionati revisionati;
non basta un eval sintetico. Valutare intervalli binomiali esatti, anche se si osservano
zero errori. Ogni modifica di modello, prompt, schema o catalogo riapre la valutazione.

## Cosa vede e decide l'operatore

Etichetta «Quasi pronta — revisione rapida suggerita», distinta dallo stato ufficiale,
con ora e versione del controllo. Mostrare le condizioni soddisfatte, la provenienza di
ogni campo critico e ciò che resta da controllare a vista. Accesso ai documenti originali
con un clic; stesso comando di revisione ordinaria sempre disponibile.

L'operatore controlla identità/nucleo, abbinamenti e annualità e può accettare il percorso
rapido o rifiutare il suggerimento con un motivo codificato. Il sistema non preseleziona
«pronta». Una nuova risposta, documento, rifiuto o segnalazione ritira subito il suggerimento.
Il cittadino non riceve una promessa di approvazione o di diritto alla prestazione.

## Registrazione e controllo

Registrare ID/versione del fascicolo, regole/catalogo, task/prompt/schema/modello effettivo,
esito AI/regole, condizioni booleane, soglie applicate, riferimenti a evidenze già protette,
tempi, token/costo stimato e motivo di esclusione. Separare proposta, ritiro, visualizzazione,
accettazione/rifiuto e successiva decisione «pronta», con attore e timestamp.
Nessun testo del cittadino, dati fiscali, copie di documenti o segreti nei log tecnici.
L'audit applicativo segue accessi e retention del fascicolo, senza creare un corpus parallelo.

## Pilota e rischi

1. Due settimane in ombra: l'operatore annota il giudizio prima di vedere il suggerimento.
   Doppia revisione cieca di tutti i selezionati e di un campione stratificato dei non selezionati.
2. Misurare precisione, falsi «quasi pronta», errori critici (identità, nucleo, anno, documento
   mancante), quota selezionata, mancate opportunità, tempo mediano/p95 di revisione,
   integrazioni successive e correzioni dopo la revisione. Separare otto lingue, lettura AI/
   manuale/euristica, complessità del nucleo, modelli effettivi e fallback.
3. Raggiunte le soglie, prova controllata con almeno 10% dei selezionati ancora revisionati
   alla cieca nel percorso ordinario. L'operatore può disattivare il suggerimento; l'admin
   ha un interruttore generale. Nessun trattamento peggiorativo per i non selezionati.
4. Un errore critico confermato sospende il suggerimento, attiva riesame dei casi della stessa
   versione e analisi della causa. Precisione sotto soglia, forte differenza fra lingue o
   perdita del risparmio di tempo richiedono ritorno alla fase in ombra.

Rischi principali: fiducia eccessiva nell'etichetta, errori correlati fra lettura e confronto,
confidenza non calibrata, documenti manipolati, deriva normativa, versioni obsolete e
selezione sfavorevole dei casi complessi. Per questo il pilota misura anche reclami,
attese ed errori dei non selezionati e non premia la sola velocità o quota automatizzata.
Il CAF valida protocollo, responsabilità, informativa e criteri prima dell'uso reale.

## Implementazione del pilota

Contratti additivi in `packages/contracts/src/near-ready.ts`: necessari perché fascicolo,
coda, impostazioni e azioni dell’operatore devono condividere stati, motivi e versioni
senza reinterpretarli nel frontend. Nessuna modifica alle API del cittadino.

Sono state confrontate due strutture: JSON mutabile nella pratica con registrazione
nei soli eventi generali, oppure valutazioni immutabili per versione e audit dedicato.
È adottata la seconda: separa gli esiti dalle modifiche del fascicolo, permette giudizi
ciechi per ogni operatore e conserva il denominatore originario del pilota. Il core
valuta soltanto dati passati esplicitamente; rete, autorizzazione e persistenza sono nell’API.

`near_ready.read` legge gli originali un documento alla volta; `near_ready.compare`
confronta dossier e letture. Versione prompt/schema `1.1`/`1`, regole `isee-pilot.1`.
Non sono due verifiche indipendenti. Il runtime esistente applica budget e guard a ogni
chiamata. Le letture letterali usate nel confronto restano transitorie: la registrazione
contiene ID, pagina, confidenza e booleani, mai i valori letti. Un campo verificato
manualmente è ammesso senza simulare una lettura AI; resta necessario il confronto AI
riuscito. Un modello non disponibile o un ripiego esclude sempre il suggerimento.

Il valutatore sostituisce il generico `document.unchecked` con controlli espliciti per
campo. Il promemoria generale `practice.provisional_year` resta tra i controlli a vista:
non è un’incongruenza individuale. Tutti gli altri blocker/warning escludono il caso;
un anno diverso dal 2027 o un catalogo scaduto lo escludono comunque. Ciò non certifica
l’aggiornamento normativo: prima dell’uso reale il CAF deve verificare le fonti già
indicate in `docs/research/isee-2027.md`.

La migrazione unica `0019_near_ready`, generata con drizzle-kit, aggiunge impostazioni,
valutazioni, giudizi ciechi e audit. Nello stesso file sono aggiunti trigger PostgreSQL:
qualsiasi modifica di `cases.updated_at`, anche da worker, ritira atomicamente i segnali
attivi; cambiare modalità, soglie, budget o interruttore AI invalida le pratiche aperte.
Le azioni condividono il lock di autorizzazione e il lock della pratica; una sola decisione
accetta/scarta ciascun suggerimento. La rete si svolge fuori dalle transazioni e un
risultato di una versione superata non viene pubblicato.

Le impostazioni partono in `shadow`. Prima del giudizio cieco personale l’API restituisce
sempre `state: shadow`, `result: null`, campi e motivi vuoti, senza badge o filtro positivo.
Il giudizio è immutabile per operatore/versione. Vedere il risultato prima di registrarlo
impedisce di etichettare retroattivamente una revisione come cieca. Accettare è possibile
solo in `visible`: ordina i documenti e la checklist per i controlli critici e non cambia
lo stato ufficiale. Lo scarto conserva l’eventuale nota solo nella riga applicativa protetta,
mai negli eventi o nei log.

L’endpoint di ricalcolo esplicito apre una nuova versione se quella corrente è già stata
valutata: conserva i tentativi precedenti, permette di riprovare dopo indisponibilità AI
e ritira la vecchia scelta. Il controllo scade alla successiva mezzanotte di Roma. Un cambio di profilo AI, prompt, schema o catalogo rende
inutilizzabile il vecchio suggerimento; serve una nuova valutazione.

`GET /api/reports/near-ready`, solo admin del CAF, conta la prima valutazione attiva
per caso, escludendo `off`: un ricalcolo dopo correzioni non migliora il risultato
originario. Il numeratore usa la decisione finale, non l’accettazione del percorso.
`PATCH /cases/:id` con `status: ready` registra automaticamente l’esito finale; il
rifiuto finale e gli errori critici passano dall’endpoint dedicato. Tempi nulli restano
non misurati. Il report espone precisione, falsi suggerimenti, errori critici, quota,
opportunità mancate, mediana/p95 e gruppi lingua/lettura; intervallo bilaterale esatto al
95% e limite inferiore unilaterale al 95%. `calibration` isola il profilo e le soglie correnti; il demo non passa la calibrazione.
`calibrationPassed` richiede 300 revisioni,
precisione ≥99%, limite inferiore ≥98%, zero errori critici. Un errore critico confermato
dall’admin imposta immediatamente sospensione e modalità ombra per tutto il CAF.
Non esiste riattivazione della sospensione tramite PATCH ordinaria: richiede riesame
amministrativo documentato. Un interruttore `visible` non cancella la sospensione.

Il seed mantiene dieci casi: `demo-case-2` è il caso semplice, con intervista confermata
e PDF ESEMPIO coerenti. In visible è suggeribile soltanto dopo esiti AI validi sopra soglia;
senza AI è `not_eligible`, con `ai_unavailable` («Lettura AI non disponibile»).
Il risultato di un fornitore reale non viene fabbricato dal seed. Solo il CAF demo,
fuori produzione, riceve un contesto sintetico fidato per confrontare i file ESEMPIO;
negli altri CAF quei file non possono soddisfare un documento reale.

### Cosa resta prima dell’uso reale

- Collegare la UI ai contratti descritti in `docs/API.md`.
- Calibrare con casi annotati dal CAF: i test sintetici non dimostrano precisione reale,
  confidenza calibrata o risparmio di tempo. Attivazione visible deliberata dall’admin,
  non automatizzata dal solo valore `calibrationPassed`.
- Eseguire doppia revisione cieca, campionamento stratificato e mantenere almeno 10%
  dei selezionati nel percorso ordinario: gli endpoint supportano giudizi separati,
  ma assegnazione dei revisori e campionamento restano nel protocollo del CAF.
- Riesame dei casi dopo errore critico, analisi delle cause, reclami, integrazioni e
  correzioni successive: gli eventi restano disponibili, ma questi indicatori longitudinali
  non sono ancora aggregati nel nuovo report. Mancano anche una segmentazione completa
  per complessità del nucleo/modello e intervalli per differenze tra lingue.
- Validare provider reali, DPIA/informativa e catalogo annuale prima del pilota operativo.
