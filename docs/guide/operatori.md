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
  il responsabile. Al primo accesso riscrivi la password temporanea e scegli la tua (almeno 12 caratteri; una frase è più facile
  da ricordare). Puoi cambiarla quando vuoi cliccando sul tuo nome in basso a sinistra. La
  sessione scade dopo alcune ore di inattività.

Finché nessun fascicolo è arrivato allo sportello, la pagina _Pratiche_ mostra **Per iniziare**,
con i passi già fatti spuntati e il prossimo in evidenza. Per gli amministratori: dati dello
sportello (orari, telefono, prenotazione), cartello, pratica di prova da aprire sul telefono,
colleghi, baseline e verifica in due passaggi; per gli operatori: guida, pratica di prova,
cartello e verifica in due passaggi. Ogni pulsante porta dritto al campo da compilare. La
pratica di prova resta in _In compilazione_ e non nasconde i passi; cartello e guida risultano
fatti quando li apri da questo browser.

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

Premi **/** per andare subito alla ricerca (nome o codice pratica); **Esc** la svuota.

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

Per controllare tutto in una passata usa **Controlla uno per uno** accanto a _Documenti_: si apre
il primo documento ancora da verificare, **V** lo verifica e passa al successivo, **R** apre il
motivo del rifiuto. Quando non resta altro, _Torna al fascicolo_ (o Invio) ti riporta alla
pratica. Le azioni della pratica restano in alto mentre scorri, e _← Pratiche_ torna alla coda
con gli stessi filtri.

### Chiedere un'integrazione

_Chiedi integrazione_: seleziona le voci, controlla il messaggio proposto (puoi riscriverlo) e
invia. Il cittadino lo trova nel suo link, nella sua lingua; la pratica passa in _Attesa
cittadino_. Se la traduzione automatica non è disponibile, il cittadino vede il testo italiano
e un avviso.

### Avvisare chi non ha l'email

Le email partono solo verso chi ha lasciato l'indirizzo. Molti cittadini lasciano solo il
telefono: se chiedi un'integrazione a uno di loro, Avanti apre subito **Avvisa il cittadino**
con un messaggio già scritto nella sua lingua e, sotto, in italiano. Scegli **WhatsApp** (si
apre il tuo WhatsApp o WhatsApp Web con il numero e il testo pronti) oppure **Copia il
messaggio**; dal telefono o dal tablet c'è anche **SMS**. Il messaggio nomina i documenti che hai
selezionato nella richiesta, senza banche o nomi delle persone, e rimanda al link della pratica.
Se il numero non sembra completo, WhatsApp si apre sul solo testo e scegli tu la chat.

- Se il cittadino ha perso il link, premi _Il cittadino ha perso il link? Aggiungine uno nuovo_:
  il nuovo link entra in fondo al messaggio e quello vecchio smette subito di funzionare. Un
  messaggio con il link personale si può solo **copiare** e incollare nella chat: così il link
  non resta nella cronologia del browser, che sui PC dello sportello vedono anche i colleghi.
  Il nuovo link resta nella finestra finché non lasci la pagina.
- Quando la pratica è **pronta**, lo stesso pulsante prepara il messaggio «pratica pronta» con
  il link di prenotazione dello sportello, gli orari e il promemoria del documento d'identità.
- Nella scheda **Cittadino** a destra vedi «Avviso preparato su WhatsApp da …» o «Messaggio
  copiato da …», con quando: un collega che apre la pratica non lo avvisa due volte. Avanti
  registra solo che hai preparato l'avviso, non il testo, e non può sapere se l'hai inviato.

### Stampare i documenti da portare

Per chi non ha lo smartphone, o preferisce la carta: _Altro_ → **Stampa i documenti da
portare** (o il pulsante nella scheda Cittadino). Si apre un A4 con i documenti ancora mancanti o
da rifare, divisi per persona, nella lingua del cittadino con l'italiano sotto ogni voce, «dove
lo trovo», la tua ultima richiesta (una volta, in alto), il codice pratica, gli orari e il link di
prenotazione. Ogni voce ha una casella da spuntare. Si stampa anche quando non manca niente,
per esempio per consegnare a chi ha la pratica pronta orari e cosa portare. Se le domande non sono finite la pagina te lo dice: l'elenco può ancora
cambiare. La stampa compare nel registro attività, perché porta dati personali su carta.

### Prospetto DSU: copiare nel gestionale

Quando la pratica è pronta, il fascicolo apre da solo il **Prospetto DSU**: gli stessi dati,
nell'ordine del modello DSU (quadri A, B e FC per ogni componente, conto, immobile, veicolo).

- Ogni valore ha il suo pulsante **Copia**; _Copia il quadro_ copia tutta la sezione come due
  colonne (nome del campo, valore), da incollare in un foglio accanto al gestionale.
- Il pallino accanto a ogni riga dice da dove arriva il dato: **risposta del cittadino**, **da
  leggere nel documento** (il link apre il documento), **manca**, **a cura del CAF** (dati che il
  CAF prende da INPS o Agenzia delle Entrate, o che decide: per esempio il nucleo ai fini ISEE).
- _Da copiare_ mostra solo i valori, _Da controllare_ solo documenti e mancanti.
- Un "No" del cittadino compare come **Nessuno**: è un'esclusione dichiarata, non un dato mancante.

Avanti non legge importi dai documenti: saldi, giacenze e redditi li leggi tu nel documento
indicato. La responsabilità della DSU resta del CAF.

### Chiudere

- _Segna come pronta_ quando tutto è verificato. Se mancano documenti obbligatori o ci sono
  problemi bloccanti, Avanti chiede conferma e propone prima _Chiedi integrazione_: finché manca
  qualcosa è quello il pulsante principale.
- _Altro_ → _Scarica fascicolo PDF_ o _Scarica dati JSON_ per il gestionale.
- _Altro_ → _Chiudi e archivia_ chiede conferma; una pratica chiusa si può riaprire.

## Rinnovi ISEE

L'ISEE vale fino al 31 dicembre. Da **Rinnovi ISEE** trovi le famiglie che hanno fatto l'ISEE
con voi l'anno prima (pratiche pronte o inviate, ancora conservate).

1. In «Da invitare» seleziona le famiglie e premi **Prepara il rinnovo** (con più famiglie «Prepara N rinnovi», al massimo 50 per volta).
2. Avanti crea il nuovo fascicolo con il nucleo e i documenti ancora validi. I link si vedono
   solo in quel momento: copiali e consegnali, oppure lascia che parta l'email (solo se
   l'amministratore ha attivato gli inviti e il cittadino ha dato il consenso).
3. Il cittadino conferma chi vive con lui e risponde alle domande del nuovo anno. Lo segui da
   «Invitati», «Iniziati» e «Inviati»; se un link si perde, selezionalo in «Invitati» e premi
   **Nuovo link** (quello vecchio smette di funzionare).

I documenti «da aggiornare» sono scaduti o dell'anno sbagliato; quelli «validi» vanno comunque
verificati come sempre.

## Per il responsabile (amministratori)

_Impostazioni_ compare solo agli amministratori.

- **Operatori**: _Aggiungi operatore_ crea l'accesso e mostra, una volta sola, i tre dati per
  entrare: indirizzo della console, email e password temporanea. Comunicali di persona o per
  telefono, non per email. _Nuova password_ ne genera
  un'altra se qualcuno l'ha dimenticata; _Disattiva_ blocca subito l'accesso senza perdere la
  cronologia delle sue azioni.
- **Sportelli**: nome, indirizzo e orari che il cittadino vede all'inizio e sul cartello. Ogni
  sportello ha il suo link e il suo QR in _Sportelli e QR_.
- **Parametri**: minuti per pratica prima di Avanti (la baseline per le metriche), validità dei
  link per i cittadini e per quanti giorni Avanti conserva i fascicoli chiusi o scaduti.
- **Registro attività**: chi ha fatto cosa e quando (accessi, anche falliti, consultazioni,
  esportazioni, cancellazioni, modifiche agli operatori), con filtri per periodo, operatore e
  codice pratica ed esportazione CSV. Serve per rispondere a un interessato o a un controllo; non
  contiene dati personali dei cittadini. Gli eventi si conservano 365 giorni.
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
compilalo insieme a lui, poi stampagli i documenti da portare (_Altro_ → _Stampa i documenti da
portare_). Oppure lavora come sempre: Avanti non è obbligatorio.

**Ho sbagliato a rifiutare un documento.** Premi ↺ sulla voce per annullare la decisione.

**Un documento è finito sulla voce sbagliata.** Il cittadino può spostarlo; se serve, chiedigli
un'integrazione indicando la voce giusta.

## Verifica in due passaggi

Da **Account**, avvia la configurazione inserendo la password attuale. Aggiungi
Avanti alla tua app di autenticazione usando il QR ottenuto dall'URI oppure il
segreto per inserimento manuale, poi inserisci il codice di sei cifre. La configurazione
scade dopo cinque minuti: se necessario avviala nuovamente. Non condividere QR,
segreto o codici e non inserirli in chat, ticket o screenshot.

Dopo la conferma vengono mostrati **dieci codici di recupero, una sola volta**.
Conservali in un password manager o in una copia cartacea custodita. Ognuno vale
per un solo uso. La conferma termina le sessioni precedenti; sul dispositivo attuale
resti autenticato. Attendi che l'app mostri il codice successivo prima di un nuovo
login: un codice già usato non può essere riutilizzato.

Ai login successivi inserisci email e password, poi il codice dell'app oppure un
codice di recupero. Hai cinque minuti per completare il secondo passo. Dopo troppi
tentativi, attendi il tempo indicato. Se il codice non funziona, verifica che il
telefono usi data e ora automatiche e attendi il codice seguente.

Da Account puoi rigenerare i codici con password e secondo fattore: tutti i precedenti
smettono di funzionare. Puoi anche disattivare la verifica con le stesse credenziali,
se il CAF non la richiede; dovrai accedere di nuovo sugli altri dispositivi.

L'amministratore può rendere obbligatoria la verifica nelle **Impostazioni**:
chi non l'ha attivata deve configurarla prima di aprire la console. Se occorre anche
cambiare la password temporanea, quel passaggio viene prima. La demo resta accessibile
con le credenziali abituali e senza secondo fattore.

Se perdi telefono e codici di recupero, contatta l'amministratore del tuo CAF:
dopo aver verificato la tua identità può azzerare la verifica dalla gestione operatori.
L'operazione termina tutte le tue sessioni e viene registrata. Con obbligo attivo,
al login successivo imposta un nuovo telefono. Un amministratore non può azzerare
la propria verifica: serve un altro amministratore abilitato.

## Risposte rapide e promemoria

Le risposte rapide sono testi condivisi dal tuo CAF. Puoi usarne una come messaggio
per **Chiedi integrazione**, correggerla per il caso concreto e controllarla prima
dell'invio. La selezione da sola non invia nulla; la traduzione segue lo stesso
percorso delle richieste scritte a mano. La demo propone cinque esempi, tra cui
«Foto illeggibile», «Manca la pagina con la firma» e «Serve la giacenza media».
L'anno e i documenti da chiedere vanno sempre verificati sulla checklist del fascicolo.

Solo l'amministratore può creare, modificare, eliminare e riordinare le risposte:
massimo 50 per CAF, titolo di 80 caratteri e testo di 1.000. Gli operatori possono
leggerle e usarle. Le modifiche compaiono nel registro attività, senza copiare i testi.
La modifica di un modello non cambia i messaggi già inviati ai cittadini.

I promemoria sono spenti all'inizio. L'amministratore può attivarli per il CAF e
scegliere uno o due intervalli da 1 a 30 giorni: per esempio 3 giorni dalla richiesta
e altri 4 dall'invio del primo promemoria. Un solo intervallo produce un solo
promemoria. La verifica è giornaliera: l'invio può avvenire al passaggio successivo
del sistema. Il secondo attende che il primo sia stato inviato.

Il cittadino riceve un'email solo se ha lasciato l'indirizzo e il suo accesso è ancora
valido. È nella sua lingua e ricorda di leggere la richiesta dal link già salvato,
senza includere link o dati della pratica. Una risposta, un nuovo documento o un'altra
modifica del cittadino fermano i promemoria, anche prima del nuovo invio del fascicolo.
Li ferma anche un cambio di stato. Una nuova richiesta di integrazione apre un nuovo
ciclo, con al massimo due promemoria. Aprire o scaricare un documento non ferma il ciclo.

Nella cronologia trovi **Promemoria inviato** con la data quando il servizio email
ha accettato il messaggio; questo non certifica che il cittadino l'abbia letto.
In locale, **Invio promemoria simulato** indica una prova senza email reale.
Disattivare i promemoria ferma anche quelli ancora in coda. Le richieste già tracciate
possono ricevere il promemoria quando attivi l'opzione; i fascicoli precedenti
all'introduzione della funzione richiedono una nuova richiesta di integrazione.

Questa modifica fornisce contratti e API per i controlli della console; la disponibilità
dei pulsanti dipende dall'integrazione dell'interfaccia.

## Dopo l'invio: indicazioni e ricevuta

Per ogni sportello l'admin può configurare indirizzo, orari brevi, telefono,
link HTTPS al sistema di prenotazione del CAF e una nota breve, per esempio
«Porta gli originali dei documenti d'identità». Sono indicazioni pubbliche:
non inserire informazioni dei cittadini. Sono tutte facoltative; indirizzo
vuoto e gli altri campi vuoti/null non devono mostrare indicazioni inventate.
Il nome e la città dello sportello restano necessari alla creazione.

Questi dati sono disponibili nell'API sia all'ingresso dello sportello sia
nella pratica inviata. Il cittadino deve poter capire come contattarvi o
prenotare, dove andare e cosa portare. Mantenete orari e destinazione aggiornati:
Avanti non verifica il sito e non prenota appuntamenti. Le modifiche conservano
il link e il QR già stampati. I testi liberi restano nella lingua in cui li
scrivete; non vengono tradotti automaticamente.

L'impostazione admin `notifyCitizenSubmission` abilita una ricevuta al primo
invio del fascicolo. È spenta per default per limitare ciò che può comparire in
una casella condivisa; abilitatela dopo aver valutato l'uso dell'email e
l'informativa del servizio. Chi non lascia l'email prosegue normalmente.

La ricevuta è nella lingua scelta dal cittadino, con numero di riferimento,
nome dello sportello e spiegazione del passaggio successivo. Non contiene link:
invita a consultare la pagina della pratica già salvata per le indicazioni di
prenotazione, gli orari e cosa portare, oppure a chiedere allo sportello.
L'invio del fascicolo non equivale a prenotare o a concludere la pratica.
Reinvii per integrazioni e riaperture non mandano altre ricevute, nemmeno se
l'email è stata aggiunta dopo o l'opzione è stata appena abilitata. Disattivare
l'opzione annulla le ricevute ancora in attesa. In locale gli invii sono
simulati; lo stato `sent` indica l'accettazione del provider, non la lettura.

Questa modifica backend fornisce contratti e API; i controlli visuali e i moduli
per queste nuove indicazioni sono gestiti nell'interfaccia in parallelo.

## Intervista come conversazione

Il cittadino può raccontare più cose nello stesso messaggio. Avanti presenta schede con
ciò che ha capito: il cittadino può confermarle, correggerne il valore o rifiutarle.
Solo le conferme entrano nelle risposte e nella checklist. Le domande obbligatorie
restano aperte fino a una risposta valida; «non lo so» non completa una domanda.
I pulsanti rapidi e l'editor del nucleo restano disponibili dentro la conversazione.
Senza AI il percorso continua con una domanda alla volta nella lingua del cittadino.

Nel fascicolo, i messaggi mostrano il racconto originale, le risposte dell'assistente
e i valori confermati anche quando sono stati scelti con un pulsante. Controlla sempre
le proposte e le correzioni: una confidenza alta non attesta la correttezza del dato.
Una risposta già confermata va riaperta con la funzione di modifica; un nuovo racconto
non la sovrascrive. Cambiare il numero dei componenti conserva l'elenco confermato e
richiede di riallinearlo se necessario.

Il dialogo e le proposte pendenti seguono la retention del fascicolo e sono inclusi
nell'export JSON del CAF per rispondere alle richieste dell'interessato. La cancellazione
del fascicolo li elimina insieme alle risposte. La disponibilità dei controlli visuali
dipende dall'allineamento dell'interfaccia ai contratti della conversazione.

### Domande all’assistente e domande allo sportello

Il fascicolo espone “Domande all’assistente”: sono le domande del cittadino e le risposte
automatiche, nella lingua in cui sono state scritte. Non sono risposte dell’intervista e
non modificano la checklist. Le fonti rimandano alle informazioni disponibili nella pratica.
L’assistente spiega le domande e dove trovare i documenti; valutazioni sul diritto a una
prestazione, importi e casi personali restano all’operatore.

Con “Chiedi allo sportello” il cittadino invia una domanda al CAF. Compare tra i messaggi
del fascicolo e nel registro come “Domanda del cittadino allo sportello”. La coda espone
`hasCitizenQuestion`; l’indicatore segnala la presenza storica di domande, non una nuova
notifica email e non una presa in carico automatica.

Il cittadino vede subito i rilievi automatici sui documenti nella propria lingua. Può
ricaricare un file oppure confermare “è giusto così”. La data `citizenKeptAt` e l’evento
“Documento confermato dal cittadino” restano nel fascicolo. La conferma non vale come
verifica del CAF: controlla comunque intestatario, anno, scadenza, pagine e leggibilità.
L’analisi euristica controlla soltanto gli indizi deterministici disponibili.

La voce produce testo che il cittadino deve rileggere e può modificare prima di inviarlo.
Nessuna registrazione viene conservata da Avanti. Se il servizio non è disponibile, il
cittadino può continuare scrivendo.
