# I diritti del cittadino dal suo link

Decisione del 19 ottobre 2026. Norme e fonti in [diritti-interessato.md](../research/diritti-interessato.md).

## Problema

Il cittadino non ha un account: il link personale è l'unico canale che usa. Prima di questa
decisione poteva togliere un documento e revocare gli inviti al rinnovo, ma non vedere cosa
conserviamo, scaricarne una copia o cancellare la pratica. Per ogni altra richiesta doveva
cercare il CAF fuori da Avanti, e il CAF non aveva in console un posto dove riceverla.

## Cosa può fare il cittadino da solo, cosa chiede al CAF

Il CAF è titolare, Avanti responsabile (art. 28): Avanti cancella solo su istruzione del CAF.
La linea passa su **ciò che il CAF ha ricevuto o lavorato**, non solo sul primo invio
(`cases.submitted_at`): una pratica aperta dallo sportello o toccata da un operatore è già
del CAF anche se il cittadino non l'ha mai inviata.

**Bozza del cittadino** (`citizenMayDelete`, in `privacy-view.ts`), tutte insieme:

- nessun primo invio **e** stato `intake`: una pratica riaperta dallo sportello può essere in
  revisione senza `submitted_at`;
- fuori da famiglie e rinnovi (`family_id` e `renewal_source_id` nulli): riuso e rinnovo sono
  lavoro dell'operatore e condividono file con altre pratiche;
- nessun assegnatario e nessuna nota interna;
- **nessun evento di audit con attore operatore** sulla pratica. Ogni scrittura dell'operatore
  lo registra: creazione allo sportello (`POST /cases`, `case.created` con attore operatore),
  riuso, rinnovo, nuovo link, export, PDF, domanda al copilota, nota, assegnazione. Un
  operatore che ha già scaricato o interrogato la pratica ne ha una copia o una valutazione:
  da lì decide il CAF. La sola lettura del fascicolo non è un evento e non conta.

Gli eventi restano 365 giorni, più della vita di una bozza (scadenza del link più i giorni di
conservazione); le condizioni sulla riga coprono comunque il lavoro che lascia traccia sul caso.

| Momento                            | Il cittadino da solo                                                      | Richiesta al CAF                       |
| ---------------------------------- | ------------------------------------------------------------------------- | -------------------------------------- |
| Bozza del cittadino (regola sopra) | Vede i dati e la conservazione; scarica la copia; **cancella la pratica** | —                                      |
| Ogni altra pratica con link valido | Vede, scarica, revoca il consenso agli inviti                             | **Cancellazione**: registrata sul caso |
| Link scaduto o pratica chiusa      | Revoca degli inviti (rotta esistente, capability ristretta)               | Fuori da Avanti, tramite lo sportello  |

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
  del cittadino: risposte, nucleo, contatti, la nota scritta all'invio (`citizenNote`),
  messaggi con lo sportello, conversazione dell'intervista, conversazione con l'assistente
  (`assistant`), documenti con l'analisi automatica) e i file originali, verificati per
  dimensione e SHA-256; un file mancante o alterato interrompe la copia ed è registrato solo per
  riferimento (`citizen_export`, caso, documento, tipo di errore). Fuori: note interne, audit,
  decisioni dell'operatore non mostrate al cittadino, documenti di altri membri riusati e non
  resi visibili, altre pratiche della famiglia (art. 15(4)). Nel browser la copia arriva intera
  in memoria (al massimo i 120 MB della pratica), come l'archivio dell'operatore: così un
  rifiuto (quota, link scaduto) e uno ZIP troncato si vedono nella scheda, nella lingua del
  cittadino, invece di salvare un errore come file.
- `DELETE /api/c/:token` con `{confirmed:true}`: solo sulla bozza del cittadino, altrimenti 409.
  Un link ruotato dallo sportello risponde 404 come uno mai esistito (il server non conserva i
  token vecchi, quindi non può dire 410): la scheda conferma la cancellazione su un 404 solo se
  la stessa pagina aveva già inviato una DELETE di cui non ha ricevuto risposta; altrimenti
  dice che il link non vale più e, se non l'aveva già cancellata, di chiedere allo sportello. Stessa cancellazione
  di retention e admin (`eraseCase`): DB nella transazione, file dopo il commit con tombstone e
  retry, revoca inviti nella famiglia. Evento `case.citizen_deleted` con attore cittadino.
- `POST /api/c/:token/erasure-request`: su ogni pratica che non è la bozza del cittadino,
  idempotente. Imposta
  `cases.erasure_requested_at` senza toccare `updated_at` (non è contenuto: non invalida il
  modulo aperto dall'operatore né il «quasi pronta»). Evento `citizen.erasure_requested`.
- Console: in ogni scheda della coda un avviso conta le richieste aperte di tutta
  l'organizzazione (`erasureRequests`) e porta all'elenco `erasure=requested`, in ogni stato,
  dalla scadenza più vicina; badge «Chiede la cancellazione · entro il …» sulla riga, avviso nel fascicolo con la scadenza del
  mese (art. 12(3), calcolata come da Reg. 1182/71) e, per l'admin, «Elimina definitivamente»,
  «Cancella tutta la famiglia» o «Conserva la pratica» (`DELETE /api/cases/:id/erasure-request`,
  evento `case.erasure_declined`), che chiede di aver già spiegato i motivi al cittadino
  (art. 12(4)).
- Rate limit `citizenData` (5 al minuto, 20 l'ora per link) su copia, cancellazione e richiesta.

Audit: tipo, attore, istante, riferimento tecnico; la copia registra solo numero di documenti
e byte. Dopo la cancellazione restano gli eventi pseudonimi per i loro 365 giorni e, nei backup
del database, i dati fino alla scadenza del backup (proposta 7 giorni, [DEPLOY](../DEPLOY.md)
§9): la scheda dice entrambe le cose al cittadino. I tempi di risposta sono detti come
nell'art. 12(3): di norma un mese, prorogabile di due mesi spiegando il motivo. «Avanti non usa
i tuoi dati per addestrare l'AI» resta un'affermazione su Avanti: per i fornitori AI il no
training non è ancora attestato da contratto ([informativa](../legal/informativa-cittadino.md)).

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
- Un nuovo link chiesto allo sportello per una bozza la rende del CAF: da lì il cittadino può
  solo chiederne la cancellazione.
- La richiesta non è un registro delle richieste GDPR: esito, data della risposta e motivi
  restano nella procedura del CAF; l'audit conserva solo richiesta e chiusura.
- Una richiesta su una pratica chiusa o con link scaduto non passa da Avanti.
- Il calcolo della scadenza non sposta i termini che cadono di sabato o festivi.
