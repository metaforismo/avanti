# I diritti del cittadino dal suo link

Decisione del 19 ottobre 2026. Norme e fonti in [diritti-interessato.md](../research/diritti-interessato.md).

## Problema

Il cittadino non ha un account: il link personale è l'unico canale che usa. Prima di questa
decisione poteva togliere un documento e revocare gli inviti al rinnovo, ma non vedere cosa
conserviamo, scaricarne una copia o cancellare la pratica. Per ogni altra richiesta doveva
cercare il CAF fuori da Avanti, e il CAF non aveva in console un posto dove riceverla.

## Cosa può fare il cittadino da solo, cosa chiede al CAF

Il CAF è titolare, Avanti responsabile (art. 28): Avanti cancella solo su istruzione del CAF.
La linea passa sul **primo invio** (`cases.submitted_at`), già usato come confine durevole
per KPI e ricevuta.

| Momento                                 | Il cittadino da solo                                                      | Richiesta al CAF                       |
| --------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------- |
| Prima del primo invio                   | Vede i dati e la conservazione; scarica la copia; **cancella la pratica** | —                                      |
| Dopo l'invio (anche se rimandata a lui) | Vede, scarica, revoca il consenso agli inviti                             | **Cancellazione**: registrata sul caso |
| Link scaduto o pratica chiusa           | Revoca degli inviti (rotta esistente, capability ristretta)               | Fuori da Avanti, tramite lo sportello  |

Perché la bozza la cancella il cittadino: il CAF non l'ha ricevuta né lavorata, non c'è un
mandato né un obbligo di conservare una preparazione mai consegnata, e chi la abbandona la
rende non più necessaria (art. 17(1)(a)). Va prevista come **istruzione del CAF nell'accordo
art. 28** ([accordo](../legal/accordo-art28.md)); un CAF che non la vuole dovrà chiederla, oggi
non c'è un'impostazione per spegnerla.

Perché dopo l'invio decide il CAF: può avere obblighi di conservazione (art. 17(3)(b)), deve
poter verificare l'identità (art. 12(6), il link non la prova) e conosce le copie nel
gestionale (art. 19). La richiesta revoca subito il consenso agli inviti: è l'unico consenso
che il cittadino ha dato, e chi chiede di essere dimenticato non deve ricevere un'email.

## Cosa costruito

- **«I tuoi dati e la privacy»** in fondo a ogni passo della pratica, nelle 8 lingue: chi tratta
  i dati (CAF titolare, Avanti per suo conto), cosa conserviamo (con il numero di documenti),
  uso dell'AI, scadenza del link e giorni di conservazione del CAF, diritti e reclamo al
  Garante, link all'informativa completa.
- La **stessa scheda sul QR**, prima di iniziare, nella lingua scelta: è il secondo livello
  dell'informativa. Prima dell'idratazione il link apre ancora `/privacy`.
- `GET /api/c/:token/export`: ZIP costruito in streaming e mai salvato, con `dati.json` (vista
  del cittadino: risposte, nucleo, contatti, messaggi, conversazione, documenti con l'analisi
  automatica) e i file originali, verificati per dimensione e SHA-256. Fuori: note interne,
  audit, decisioni dell'operatore non mostrate al cittadino, altre pratiche della famiglia
  (art. 15(4)).
- `DELETE /api/c/:token` con `{confirmed:true}`: solo senza primo invio. Stessa cancellazione
  di retention e admin (`eraseCase`): DB nella transazione, file dopo il commit con tombstone e
  retry, revoca inviti nella famiglia. Evento `case.citizen_deleted` con attore cittadino.
- `POST /api/c/:token/erasure-request`: solo dopo l'invio, idempotente. Imposta
  `cases.erasure_requested_at` senza toccare `updated_at` (non è contenuto: non invalida il
  modulo aperto dall'operatore né il «quasi pronta»). Evento `citizen.erasure_requested`.
- Console: badge «Chiede la cancellazione» in coda, avviso nel fascicolo con la scadenza del
  mese (art. 12(3), calcolata come da Reg. 1182/71) e, per l'admin, «Elimina definitivamente»,
  «Cancella tutta la famiglia» o «Conserva la pratica» (`DELETE /api/cases/:id/erasure-request`,
  evento `case.erasure_declined`), che chiede di aver già spiegato i motivi al cittadino
  (art. 12(4)).
- Rate limit `citizenData` (5 al minuto, 20 l'ora per link) su copia, cancellazione e richiesta.

Audit: tipo, attore, istante, riferimento tecnico; la copia registra solo numero di documenti
e byte. Dopo la cancellazione restano gli eventi pseudonimi per i loro 365 giorni, e la
scheda lo dice al cittadino.

## Alternative scartate

- **Cancellazione sempre su richiesta al CAF**: più semplice da difendere, ma lascia al CAF
  una coda di bozze abbandonate che nessuno ha ricevuto, e al cittadino un'attesa senza motivo.
- **Cancellazione sempre autonoma**: ignora gli obblighi di conservazione del CAF dopo
  l'invio e la verifica dell'identità.
- **Copia in PDF leggibile**: più comprensibile, ma l'art. 20 chiede un formato strutturato e
  la pagina della pratica è già la vista leggibile; il PDF resta un'estensione possibile.
- **Annullare la richiesta di cancellazione dal link**: rimandato, nessun caso d'uso osservato.
- **Email al CAF a ogni richiesta**: rimandata; oggi il badge in coda e il registro attività.

## Limiti

- Non c'è ancora un'impostazione del CAF per disattivare la cancellazione autonoma della bozza.
- La richiesta non è un registro delle richieste GDPR: esito, data della risposta e motivi
  restano nella procedura del CAF; l'audit conserva solo richiesta e chiusura.
- Una richiesta su una pratica chiusa o con link scaduto non passa da Avanti.
- Il calcolo della scadenza non sposta i termini che cadono di sabato o festivi.
