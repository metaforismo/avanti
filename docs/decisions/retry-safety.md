# Ritentativi sicuri, integrazioni e «quasi pronta», limiti del fascicolo

Decisione del 17 ottobre 2026.

## 1. Risposta persa: niente doppioni

Problema osservato: in sala d'attesa il Wi-Fi resta connesso ma perde le risposte. Il server
registra l'azione, il telefono mostra «Connessione assente» e il cittadino preme di nuovo
«Invia»: lo stesso messaggio compariva due volte nella conversazione, la stessa domanda
all'assistente costava una seconda chiamata AI, «Chiedi allo sportello» arrivava due volte
all'operatore, lo stesso file diventava due documenti. Eliminare di nuovo un documento già
eliminato dava 404 e il frontend mostrava l'intera pratica come «non trovata». Lato operatore
la richiesta di integrazione era già protetta dalla versione attesa, ma il ritentativo
riceveva un 409 «la pratica è cambiata» proprio per effetto del primo tentativo; la domanda
al fascicolo (`ai/ask`) ripeteva risposta e costo.

Alternative valutate:

- **Deduplicazione per contenuto in una finestra** (stesso testo nella stessa pratica entro N
  secondi): nessun cambio ai client, ma confonde il ritentativo con la ripetizione voluta.
  «Sì», «no», «2» sono risposte normali che il cittadino dà più volte; lo stesso PDF può
  servire per due voci. La finestra è arbitraria: troppo corta non copre un Wi-Fi lento,
  troppo lunga perde messaggi veri. Scartata.
- **Versione attesa** (`expectedUpdatedAt`, già usata dalla console): evita il doppio effetto
  ma il ritentativo fallisce con un conflitto creato dal primo tentativo; nella conversazione
  costringerebbe ogni azione del cittadino a portare una versione e a ricaricare dopo ogni
  modifica altrui (operatore, analisi dei documenti, altro telefono). Resta dove c'è già,
  ma non basta.
- **Chiave di idempotenza con risposta salvata** (schema di Stripe e della bozza IETF
  `Idempotency-Key`): corretta, ma salvare il corpo della risposta duplica dati personali
  (conversazione, fascicolo) in una seconda tabella con retention propria.
- **Chiave di idempotenza con riferimento al risultato** — adottata.

Adottata: header facoltativo `Idempotency-Key` (`IDEMPOTENCY_HEADER` e `IdempotencyKey` in
`@avanti/contracts`, 16–128 caratteri `[A-Za-z0-9_-]`). Tabella `idempotency_keys`
(migrazione `0028`): chiave primaria (pratica, attore, chiave), dove l'attore è `citizen` o
l'id dell'operatore; rotta; impronta SHA-256 dell'input validato; `result` con soli
riferimenti (id della risposta dell'assistente, id del turno, motore usato); data. Nessun
testo del cittadino e nessun corpo di risposta: al ritentativo la risposta si ricostruisce
dallo stato attuale (conversazione, pratica, fascicolo) o dalla riga già salvata (risposta
dell'assistente, turno della chat del fascicolo). Le righe seguono la pratica alla
cancellazione (`ON DELETE CASCADE`) e la manutenzione toglie quelle più vecchie di 24 ore.

Funzionamento:

- Prima del lavoro costoso (AI, upload) si cerca la chiave: se c'è, si risponde con il
  risultato senza chiamare il provider né lo storage.
- La riga si scrive **nella stessa transazione dell'effetto**, dopo il lock della pratica, e
  la chiave si ricontrolla sotto lo stesso lock. Due tentativi simultanei si serializzano: uno
  scrive, l'altro trova la riga e risponde con lo stesso risultato. Nel caso raro di due
  tentativi in volo insieme la chiamata AI può avvenire due volte, l'effetto mai: si è
  preferito questo a uno stato «in corso» con lease, attese e recupero dei lease orfani.
- I fallimenti non si salvano: un 409 o un errore del provider lasciano ripetere l'azione.
- La stessa chiave con un'altra rotta o un altro input dà 409 `conflict`; una chiave
  malformata 400. Le chiavi sono isolate per pratica e per persona: la chat del fascicolo è
  privata dell'operatore e la stessa chiave di un collega è un'altra azione.
- Senza header il comportamento è quello di prima: i client già distribuiti continuano a
  funzionare e il server non rifiuta nulla.
- Lo stato viene controllato dopo la chiave: il ritentativo dell'invio di una pratica appena
  inviata risponde con la pratica inviata invece di «Il fascicolo è in revisione», e quello
  della richiesta di integrazione risponde con il fascicolo invece del conflitto di versione.

Rotte coperte: cittadino `POST /turn`, `/conversation`, `/conversation/confirm`,
`/assistant`, `/assistant/ask-desk`, `/documents` (prima di leggere il corpo; l'impronta usa
voce e SHA-256 del file), `DELETE /documents/:id`, `/submit`; operatore
`POST /cases/:id/requests` e `/cases/:id/ai/ask`. Non coperte, perché già idempotenti per
natura o senza effetti ripetibili: lingua, riassegnazione, «tienilo», decisioni sulle voci e
sulla «quasi pronta» (rispondono 409 «già registrato»). Restano fuori, da rivalutare:
`POST /intake` e `POST /cases` (il ritentativo crea una seconda pratica vuota; rispondere con
la prima richiederebbe di conservare il token in chiaro, che oggi esiste solo come hash) e la
trascrizione vocale (nessun effetto salvato, solo un secondo costo AI).

Frontend: `apps/web/src/lib/idempotency.ts` dà una chiave per azione e contenuto; la stessa
azione ripetuta con lo stesso contenuto riusa la chiave. Ogni successo confermato le dimentica
tutte: lo stesso «sì» detto più tardi a un'altra domanda è un'azione nuova che una chiave
vecchia avrebbe ingoiato. Una ricarica in background invece no: può arrivare prima che la
richiesta persa sia salvata, e dimenticare la chiave in quel momento salverebbe il reinvio due
volte (l'e2e `citizen-retry` lo riproduceva con la lettura della conversazione all'apertura). Il caricamento
porta la chiave con il file in attesa, così «Riprova» non crea un secondo documento. La chiave
usa `crypto.randomUUID` o, sui telefoni che non lo hanno (Safari prima della 15.4),
`getRandomValues`.

Limiti noti: la retention di 24 ore copre i ritentativi della stessa visita, non una ripresa
il giorno dopo; due azioni diverse in volo nello stesso hook possono far dimenticare la chiave
dell'altra (al più si torna al comportamento senza chiave). I ritentativi consumano comunque
il limite di frequenza.

## 2. Richiesta di integrazione e «quasi pronta»

Problema osservato: se l'operatore chiedeva un'integrazione su una pratica suggerita come
«quasi pronta», l'esito restava non registrato finché qualcuno non usava «non era pronta» a
mano. La risposta del cittadino cambia poi il contenuto e ritira la valutazione: l'esito non
si può più attribuire e la precisione perde proprio i casi in cui il suggerimento sbagliava.

Alternative valutate:

- **Lasciare tutto all'operatore**: nessun rischio di etichetta sbagliata, ma la metrica resta
  distorta verso l'alto (si perdono i falsi «quasi pronta»).
- **Registrare all'arrivo della risposta del cittadino**: a quel punto il contenuto giudicato
  è già superato e la richiesta può essere stata ritirata nel frattempo.
- **Registrare alla richiesta, come esito provvisorio** — adottata.

Adottata: nella transazione della richiesta, se almeno una voce richiesta è **obbligatoria**
e la valutazione della versione di contenuto corrente è idonea (stato suggerita, accettata,
scartata o in ombra), si scrive `final_decision` con `ready: false` e motivo
`integration_requested` (nuovo valore del vincolo, migrazione `0028`).

Casi limite:

- Solo voci facoltative o messaggio senza voci: nessun esito, il fascicolo poteva essere
  lavorabile; l'operatore può sempre registrarlo a mano.
- Esito già registrato (manuale o automatico): resta. Una seconda richiesta sullo stesso
  contenuto non aggiunge nulla.
- L'esito automatico è provvisorio: un esito esplicito dell'operatore sullo stesso contenuto
  lo sostituisce. Richiesta ritirata (da «attende il cittadino» di nuovo «in revisione»), voci
  verificate e «pronta»: vale `ready: true`. «Non era pronta» con un motivo preciso o con un
  errore grave sostituisce il motivo generico.
- Errore grave: mai automatico; resta il gesto esplicito che sospende il pilota.
- Ombra: l'esito non rivela nulla e non registra «visto», quindi il giudizio cieco resta
  possibile e un disaccordo fra i due viene contato.
- Più valutazioni: si etichetta solo quella del contenuto corrente, come per «pronta»; il
  report usa comunque la prima valutazione per pratica.
- Scartata dall'operatore: inclusa, pur non essendo nell'elenco iniziale, perché resta un
  suggerimento selezionato nella precisione; lasciarla senza esito favorirebbe i suggerimenti
  già giudicati sbagliati.
- Valutazione non idonea: nessun esito; non c'è precisione da difendere.
- Richiesta fallita (409, lingua cambiata): stessa transazione, nessun esito.

## 3. Limiti del fascicolo con un codice proprio

Problema osservato: i limiti di 60 documenti e 120 MB rispondevano 409 `conflict` con testo
solo italiano. Il frontend del cittadino mostra il messaggio del server solo per gli errori di
validazione: il cittadino leggeva «la pratica è cambiata» nella sua lingua e la pagina si
ricaricava senza dire che cosa fare.

Alternative valutate: tradurre il messaggio del server nella lingua del cittadino (resterebbe
un `conflict` che il frontend tratta come «ricarica»); mostrare il messaggio del server per
ogni 409 (testi infrastrutturali in italiano a chi non lo legge); un codice dedicato.

Adottata: `ErrorCode` `case_full`, sempre con stato 409 per i client distribuiti che guardano
lo stato. Il frontend lo traduce in 8 lingue (`docs.caseFull`) e non ricarica la pratica. Un
client vecchio mostra il messaggio generico invece di «la pratica è cambiata».
