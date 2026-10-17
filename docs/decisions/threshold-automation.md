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
(Precisato il 17 ottobre 2026: contano i cambiamenti del contenuto consegnato dal cittadino,
non il lavoro dell'operatore; vedi «Versione del contenuto».)
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

La migrazione unica `0020_near_ready`, generata con drizzle-kit, aggiunge impostazioni,
valutazioni, giudizi ciechi e audit. Nello stesso file sono aggiunti trigger PostgreSQL:
qualsiasi modifica di `cases.updated_at`, anche da worker, ritira atomicamente i segnali
attivi (dal 17 ottobre 2026 solo le modifiche del contenuto, vedi sotto); cambiare modalità, soglie, budget o interruttore AI invalida le pratiche aperte.
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
originario. Dal 16 ottobre 2026 la verità è riferita esclusivamente alla versione
valutata: prima il giudizio cieco di quella versione; in sua assenza, la prima decisione
finale registrata mentre quella versione era ancora corrente. Esiti di versioni successive,
anche già presenti nello storico, non etichettano la valutazione originaria. In assenza di
entrambi il caso è «non giudicabile»: `unjudged` lo conta, escluso dalla precisione e dalle
opportunità mancate (e quindi dal richiamo). Resta nel totale valutato e nella quota selezionata.

Se i giudizi ciechi della stessa versione o il giudizio cieco e l’esito finale discordano,
prevale «non pronta»; `disagreements` conta una sola discordanza per valutazione. Un errore
critico confermato resta sempre un fallimento di quella valutazione, anche dopo un giudizio
positivo; non diventa «non giudicabile». Dal 17 ottobre 2026 è attribuito solo alla
valutazione selezionata del contenuto giudicato (vedi sotto).
La semplice accettazione del percorso non è un’etichetta di verità.

`PATCH /cases/:id` con `status: ready` registra automaticamente l’esito finale sulla
versione appena verificata, prima di avanzarla nella stessa transazione. Non assegna
l’esito alle versioni precedenti; il rifiuto finale e gli errori critici passano
dall’endpoint dedicato. Soltanto i tempi della decisione finale sulla versione valutata
sono ammessi; un giudizio cieco senza quel tempo resta non misurato. Tempi nulli restano
non misurati. Il report espone precisione, falsi suggerimenti, errori critici, quota,
opportunità mancate, `unjudged`, `disagreements`, mediana/p95 e gruppi lingua/lettura;
i due nuovi contatori sono additivi in `NearReadyPilotGroup` (`total`, `groups`, `calibration`)
per rendere visibili alla UI esclusioni e conflitti, mantenendo tutti i campi precedenti.
Intervallo bilaterale esatto al
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

### Versione del contenuto (17 ottobre 2026)

Problema osservato: `updated_at` è la versione di concorrenza e avanza anche con presa in
carico, inizio revisione e verifica delle voci. Il trigger di `0022` ritirava quindi anche i
suggerimenti accettati mentre l'operatore li stava controllando; `PATCH status: ready` non
trovava più una valutazione della versione corrente, `final_decision` non veniva mai scritto
e la precisione non si accumulava. In ombra, qualunque scrittura rendeva il giudizio cieco
impossibile (409) senza un modo di ricontrollare. `final-decision` rispondeva 200 senza
registrare nulla e l'errore critico veniva copiato su tutte le valutazioni storiche.

Decisione: la valutazione giudica il fascicolo **come l'ha consegnato il cittadino**.
La invalidano solo risposte, nucleo, documenti caricati/rimossi/riassegnati o rianalizzati,
reinvio del cittadino, nuove incongruenze AI (`ai_attention`), il ricontrollo esplicito e le
modifiche della politica del CAF. Non la invalidano presa in carico, inizio revisione,
verifica/rifiuto/«non serve» delle voci, note, assegnatario, richiesta di integrazione,
rigenerazione del link, decisioni sul precompilato e apertura del fascicolo. La richiesta di
integrazione è lavoro: lascia all'operatore la possibilità di registrare «non era pronta»
sulla valutazione giudicata, invece di renderla non giudicabile; la risposta del cittadino,
che cambia il contenuto, ritira poi il suggerimento.

Alternative considerate:

- Escludere dal trigger le sole colonne di lavoro: non basta, perché la verifica delle voci
  e i documenti vivono in altre tabelle e l'unico segnale sulla pratica è `updated_at`.
- Non avanzare `updated_at` per il lavoro dell'operatore: romperebbe la concorrenza
  ottimistica (`expectedUpdatedAt`) e la cache del copilota, che ne dipendono.
- Far avanzare la versione del contenuto esplicitamente da ogni writer di contenuto:
  un writer dimenticato (o un worker futuro) lascerebbe valido un suggerimento superato.

Adottata: colonna `cases.content_version` (migrazione `0026`, backfill = `updated_at`, così
valutazioni, giudizi ciechi ed eventi esistenti restano legati alla versione corrente)
gestita da un trigger con classificazione prudente: ogni avanzamento di `updated_at` è
contenuto, salvo che la transazione dichiari lavoro dell'operatore (`markOperatorWork`,
impostazione locale alla transazione). Dimenticare la dichiarazione costa al più un ritiro
in più, mai un suggerimento su contenuto non valutato. `updated_at` resta la versione di
concorrenza. Valutazioni, giudizi ciechi, ritiri, coda `near_ready` e verità per versione
usano `content_version`; il lease condiviso della valutazione è legato a entrambe le versioni, perché
`ai_attention` cambia il contenuto senza nuovo `updated_at`. Una pubblicazione AI resta valida
se nel frattempo c'è stato solo lavoro dell'operatore.

Conseguenze:

- `PATCH status: ready` registra l'esito sulla valutazione accettata anche dopo revisione e
  verifiche; `final-decision` registra o risponde 409 con messaggio italiano (contenuto
  cambiato, esito già registrato, errore critico su un controllo che non suggeriva nulla).
- In ombra, dopo un cambio di contenuto il fascicolo mostra la valutazione come superata
  (senza rivelarne l'esito) e «Ricontrolla» chiama la rivalutazione esistente, con gli stessi
  limiti di frequenza e budget AI; nessuna rivalutazione automatica a ogni lettura.
- L'errore critico marca solo la valutazione selezionata del contenuto giudicato e sospende
  il CAF come prima. La metrica conta `critical_error` con la stessa regola di provenienza di
  `final_decision`: gli eventi storici copiati su altre versioni non etichettano più la prima
  valutazione. La sospensione già applicata resta e richiede comunque riesame amministrativo.
- Le verifiche manuali dell'operatore non rinnovano da sole la valutazione: per sfruttarle
  in un controllo successivo serve «Ricontrolla».

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
