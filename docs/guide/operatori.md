# Guida per gli operatori

Avanti prepara le pratiche prima che il cittadino arrivi allo sportello. Questa guida spiega
come usarlo in una giornata normale. Bastano dieci minuti per leggerla.

## In breve

1. **Il cittadino inizia da solo**: inquadra il QR in sala d'attesa o apre il link che gli
   mandi. Racconta cosa deve fare, risponde alle domande e fotografa i documenti.
2. **Tu trovi il fascicolo in coda**, già ordinato: cosa manca e cosa non torna sono in cima.
3. **Verifichi**, chiedi quello che manca senza telefonare, e quando è tutto a posto segni la
   pratica come pronta. La pratica ufficiale la fai come sempre, nel vostro gestionale.

Avanti non invia nulla a INPS o all'Agenzia delle Entrate e non decide al posto tuo.

## Avvio di un CAF pilota

Il responsabile tecnico segue [DEPLOY.md](../DEPLOY.md), configura backup e variabili,
esegue migrazioni/check e avvia `NODE_ENV=production pnpm admin:bootstrap` da un
terminale privato. Inserisce CAF, primo sportello e primo admin, poi conferma
`CREA CAF PILOTA`. Il comando non usa il seed demo e non si può ripetere per
rigenerare la password: se esiste già un admin, si ferma senza modifiche.

Ricevi una password temporanea mostrata una sola volta: entra in `/console/accedi`
e cambiala subito, prima di vedere le pratiche. Poi crea operatori e sportelli,
controlla indirizzo/orari e informativa, misura la baseline e stampa i QR.
Per il primo giro usa esclusivamente cittadini e documenti fittizi. I dati reali
iniziano dopo le verifiche operative e contrattuali del CAF.

Per chiudere o trasferire il pilota il tecnico usa `NODE_ENV=production pnpm admin:export`:
serve l’accesso di un admin attivo del tuo CAF con password definitiva. Riceverai
un JSON con pratiche, risposte, conversazioni, revisioni ed eventi, elenco documenti
e hash; i file binari si consegnano separatamente con procedura protetta. Il JSON
contiene anche note interne e dati di altri membri: il responsabile verifica cosa
può consegnare a ciascun interessato. Non inviarlo in chat o email non protetta.

## Prima di iniziare

- **Stampa il cartello**: _Sportelli e QR_ → _Stampa il cartello_. Un A4 con il QR e il titolo
  in otto lingue, da mettere in sala d'attesa.
- **Accesso**: entri da `/console/accedi` con l'email e la password temporanea che ti ha dato
  il responsabile. Al primo accesso scegli la tua (almeno 12 caratteri; una frase è più facile
  da ricordare). Puoi cambiarla quando vuoi cliccando sul tuo nome in basso a sinistra. La
  sessione scade dopo alcune ore di inattività.

## Creare una pratica per un cittadino

_Nuova pratica_ (in alto a sinistra):

- Scegli la lingua del cittadino: le domande e i messaggi arrivano in quella lingua, tu leggi
  sempre in italiano.
- La pratica è facoltativa: se non la sai, la capisce Avanti dal racconto.
- Il numero di telefono serve solo per aprire WhatsApp o SMS con il messaggio già scritto (in
  italiano più la lingua del cittadino).
- **Mostra al cittadino** apre il QR a schermo intero: chi è seduto davanti a te lo inquadra
  dal tuo monitor.

Il link è personale: chi lo ha può vedere la pratica. Non incollarlo in gruppi o email
condivise.

## La coda

- **Da revisionare**: inviate dal cittadino, nessuno le ha ancora toccate. Partono da qui.
- **In revisione**: qualcuno ci sta lavorando.
- **Attesa cittadino**: hai chiesto un'integrazione; tornano _Da revisionare_ quando il cittadino
  reinvia.
- **Pronte**: verificate, da inserire nel gestionale.
- **In compilazione**: il cittadino non ha ancora inviato. Puoi guardarle, non revisionarle.

I filtri restano nell'indirizzo della pagina: puoi mandare a un collega il link a "le mie
pratiche ISEE da revisionare".

## Il fascicolo

Si legge dall'alto in basso:

1. **Da guardare**: documenti mancanti (raggruppati) e i problemi rilevati, prima i bloccanti.
   Cliccando una riga arrivi alla voce.
2. **Riepilogo** e **Documenti** per persona: per ogni voce _Verifica_, _Rifiuta_ (con un motivo
   che il cittadino legge tradotto) o _Non serve_. Il simbolo ↺ annulla la decisione.
3. **Risposte del cittadino** e **Conversazione**, con il testo originale accanto alla traduzione.

A destra: contatti, tempi misurati, **note interne** (solo per gli operatori, si salvano da sole)
e la cronologia.

La revisione — e il cronometro — partono alla tua prima azione, non quando apri la pratica: puoi
dare un'occhiata senza falsare i tempi.

### Controllo automatico dei documenti

Aprendo un documento vedi a destra cosa ha rilevato Avanti: a quale voce l'ha abbinato,
intestatario, anno, scadenza, pagine, leggibilità e con quanta certezza. Un **?** accanto al
nome indica un riconoscimento incerto. Il controllo automatico può sbagliare: la decisione
finale è tua. Con le frecce ← → passi al documento precedente o successivo.

### Chiedere un'integrazione

_Chiedi integrazione_: seleziona le voci, controlla il messaggio proposto (puoi riscriverlo) e
invia. Il cittadino lo trova nel suo link, nella sua lingua; la pratica passa in _Attesa
cittadino_. Se la traduzione automatica non è disponibile, il cittadino vede il testo italiano
e un avviso.

### Chiudere

- _Segna come pronta_ quando tutto è verificato. Se mancano documenti obbligatori o ci sono
  problemi bloccanti, Avanti chiede conferma e propone prima _Chiedi integrazione_: finché manca
  qualcosa è quello il pulsante principale.
- _Altro_ → _Scarica fascicolo PDF_ o _Scarica dati JSON_ per il gestionale.
- _Altro_ → _Chiudi e archivia_ chiede conferma; una pratica chiusa si può riaprire.

## Per il responsabile (amministratori)

_Impostazioni_ compare solo agli amministratori.

- **Operatori**: _Aggiungi operatore_ crea l'accesso e mostra una password temporanea, una
  volta sola. Comunicala di persona o per telefono, non per email. _Nuova password_ ne genera
  un'altra se qualcuno l'ha dimenticata; _Disattiva_ blocca subito l'accesso senza perdere la
  cronologia delle sue azioni.
- **Sportelli**: nome, indirizzo e orari che il cittadino vede all'inizio e sul cartello. Ogni
  sportello ha il suo link e il suo QR in _Sportelli e QR_.
- **Parametri**: minuti per pratica prima di Avanti (la baseline per le metriche), validità dei
  link per i cittadini e per quanti giorni Avanti conserva i fascicoli chiusi o scaduti.
- **Cancellazione definitiva**: dal fascicolo, _Altro_ → _Elimina definitivamente…_, scrivendo
  il codice della pratica per conferma. Serve per le richieste di cancellazione degli
  interessati: verifica prima gli obblighi di conservazione del CAF. Non si può annullare.

## Metriche

Tempi di revisione, tempo del cittadino, completezza al primo invio e richieste di
integrazione, misurati sulle pratiche vere. Il confronto con "prima" usa la baseline che il
responsabile ha dichiarato misurando il flusso abituale: senza baseline Avanti non stima
risparmi.

## Domande frequenti

**Il cittadino dice che il link non funziona.** Se è scaduto, crea una nuova pratica. Se è
"non valido", probabilmente non l'ha copiato per intero.

**Il cittadino non ha lo smartphone o non se la sente.** Apri il suo link sul tuo computer e
compilalo insieme a lui, oppure lavora come sempre: Avanti non è obbligatorio.

**Ho sbagliato a rifiutare un documento.** Premi ↺ sulla voce per annullare la decisione.

**Un documento è finito sulla voce sbagliata.** Il cittadino può spostarlo; se serve, chiedigli
un'integrazione indicando la voce giusta.
