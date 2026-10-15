# Proposta: pratica «quasi pronta» per revisione rapida

Stato: **proposta, non implementata** — 15 ottobre 2026.
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
