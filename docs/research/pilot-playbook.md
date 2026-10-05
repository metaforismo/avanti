# Piloti CAF: trovare il problema e misurare il risultato

Cutoff delle fonti: **5 ottobre 2026**. Ricerca svolta il 5–6 ottobre. Tutti i numeri di reclutamento, calendario e misura sotto sono **proposte operative**, non risultati già ottenuti. Obiettivo richiesto: 2–3 CAF pilota, preparati entro dicembre, sperimentazione ISEE da gennaio a marzo 2027.

## Chi cercare

Partire da uno sportello con responsabile raggiungibile, operatori disponibili a registrare il tempo e autorizzazione della rete all'uso di un fornitore esterno. Una sede affiliata non può necessariamente scegliere software o firmare il DPA: verificare titolare, poteri e acquisti prima della demo. Preferire una seconda sede che usi un gestionale diverso; la terza serve a verificare il flusso assistito e le barriere linguistiche. Una rete nazionale è un possibile acquirente successivo, ma aumenta tempi e dipendenze del primo pilota.

| Profilo                                         | Perché è utile                                                                 | Motivo per escluderlo dal primo test                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Sede locale con clientela ricorrente            | Misura preparazione dei clienti già acquisiti, senza confonderla con marketing | Nessun responsabile o impossibilità di autorizzare il trattamento |
| Sede con forte domanda in una lingua supportata | Verifica comprensione e richieste di integrazione                              | Lingua presunta dalla cittadinanza, senza riscontro della sede    |
| Sede di una rete con portale già attivo         | Confronto con alternativa digitale effettiva                                   | Importare il fascicolo richiede più lavoro del flusso esistente   |
| Sportello con prevalente assistenza in presenza | Verifica alternativa per chi non riesce a usare il telefono                    | Pilota utilizzabile soltanto da utenti digitalmente esperti       |

Per scegliere il territorio, usare le tavole ISTAT **al 1° gennaio 2025** e poi verificare la clientela del CAF. Roma è candidata per il bengalese, Milano per l'arabo; Prato è utile se si introduce il cinese, Brescia per urdu/punjabi. Sono **ipotesi commerciali**, non domanda CAF dimostrata. I conteggi comunali e la metodologia sono in [languages.md](languages.md), da [dataset ufficiale ISTAT](https://demo.istat.it/data/rcs/Dati_RCS_cittadinanza_2025.zip). Non scegliere Prato per dimostrare lingue che il prodotto non supporta.

## Come costruire la lista e contattare

1. Cercare sedi nelle directory ufficiali delle reti: [CAF ACLI](https://www.cafacli.it/it/), [CAAF CGIL](https://www.caafcgil.com/), [CAF CISL](https://www.cafcisl.it/), [CAF UIL](https://cafuil.it/). Annotare sede, referente, gestionale se dichiarato, canale di contatto e fonte; nessun numero personale raccolto da social.
2. Chiedere introduzioni a un operatore, un mediatore linguistico o un'associazione locale. Le relazioni e le adesioni devono essere verificate; non sono accordi esistenti.
3. Usare il recapito pubblicato per una richiesta mirata di confronto, verificando con il referente legale l'uso del canale. Un indirizzo online non autorizza campagne massive. Questo documento prepara il contatto; non invia messaggi.
4. Fare una demo con documenti sintetici: richiesta in lingua, checklist, documento illeggibile, richiesta di integrazione, revisione in italiano, export e caricamento nel loro gestionale.
5. Confermare una sede soltanto dopo accordo, DPA, test di handoff e responsabili nominati. Una manifestazione d'interesse non è un pilota attivo.

**Messaggio proposto**

> Stiamo sviluppando Avanti per preparare i documenti ISEE prima dell'appuntamento: domande guidate anche in altre lingue, elenco personalizzato e fascicolo da verificare. La pratica resta ai vostri operatori e al vostro gestionale. Cerchiamo sportelli con cui misurare se diminuiscono documenti mancanti e minuti di preparazione. Il pilota è gratuito fino a marzo 2027; chiediamo tempo per il confronto e metriche d'uso concordate, senza riutilizzare i documenti per addestrare modelli. Possiamo mostrarvi il passaggio completo con una pratica di prova?

Non promettere fascicoli infallibili o un risparmio percentuale. [TeamSystem Centro Servizi, brochure febbraio 2026](https://www.teamsystem.com/media/files/1671_TS_BROCHURE_LIGHT_TeamSystem_Centro_Servizi_2026.pdf), documenta già chat AI e collaborazione digitale: chiedere che cosa usano oggi e dove quel flusso fallisce.

## Calendario proposto

| Periodo            | Risultato da ottenere                                             | Evidenza per proseguire                                                           |
| ------------------ | ----------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Ottobre 2026       | Colloqui e osservazione del lavoro, selezione di 2–3 sedi         | Problema concreto, referente e autorizzazioni possibili                           |
| Novembre           | Demo sintetica, mapping del gestionale, accordo e DPA             | Export caricato e letto dall'operatore; ruoli e costi chiariti                    |
| Dicembre           | Formazione, prove assistite, traduzioni, protocollo congelato     | Checklist di [regulation.md](regulation.md) completata; regole 2027 ricontrollate |
| Gennaio–marzo 2027 | Confronto prospettico con flusso abituale e rilevazione incidenti | Report per sede, inclusi abbandoni, errori e assistenza necessaria                |
| Marzo              | Decisione di acquisto o stop                                      | Beneficio netto e prezzo accettato dal soggetto che paga                          |

Le prove di dicembre verificano l'usabilità: non sono una baseline ISEE 2027 comparabile. Il picco stagionale rende debole il confronto tra dicembre e gennaio; misurare i due percorsi nello stesso periodo.

## Protocollo di misura

Definire prima del test: pratica ammessa, criteri di completezza, inizio/fine del lavoro, periodi, assegnazione e motivi di esclusione. Limitare la prima coorte al verticale ordinario gestibile; registrare separatamente i casi reindirizzati all'operatore, senza cancellarli dal conteggio degli accessi.

**Baseline:** cronometrare il flusso abituale su casi consecutivi con lo stesso schema di eventi. Poi confrontare, quando possibile, inviti assegnati casualmente ai due percorsi nella stessa sede e settimana. Conservare sempre l'assistenza ordinaria. Se la randomizzazione non è possibile, alternare blocchi prestabiliti e confrontare casi simili per lingua richiesta, complessità e canale; dichiarare la selezione residua e non chiamare causale il risultato.

| KPI                           | Definizione e denominatore                                                                            | Rilevazione                                                                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Minuti attivi di preparazione | Somma di lettura, controlli, contatti, integrazioni, traduzione, export e doppia digitazione per caso | Timer operatore con pause; includere il lavoro spostato su Avanti e il supporto              |
| Completezza al primo invio    | Fascicoli approvati dall'operatore senza integrazione / fascicoli ricevuti                            | Giudizio operatore su regole congelate; nessun punteggio AI usato come verità                |
| Conversione dell'invito       | Casi consegnati / tutti gli inviti assegnati                                                          | Distinguere mai aperti, iniziati, consegnati e reindirizzati                                 |
| Integrazioni                  | Richieste e contatti per fascicolo ricevuto                                                           | Eventi e motivo codificato; non contenuto del messaggio                                      |
| Errori documentali            | Segnalazioni corrette, false segnalazioni e problemi non rilevati                                     | Revisione di tutti i casi del pilota o campione predefinito; report separato per tipo/lingua |
| Tempo del cittadino           | Tempo dichiarato, ritorni in sede, aiuto richiesto                                                    | Questionario breve facoltativo; non stimarlo dalla durata della scheda aperta                |
| Handoff                       | Minuti, errori e campi ridigitati per export                                                          | Osservazione nel gestionale effettivo                                                        |
| Costo netto e acquisto        | Costi variabili, supporto e disponibilità a pagare                                                    | Dati contabili propri e offerta al decisore; interesse verbale separato da acquisto          |

Presentare mediana e distribuzione dei tempi, numerosità per gruppo, dati mancanti e intervalli d'incertezza quando sostenibili. Pubblicare sia l'esito di **tutti gli inviti assegnati** sia quello dei fascicoli effettivamente usati: analizzare soltanto i completamenti nasconde chi ha abbandonato. I CAF sono unità organizzative diverse; non trattare migliaia di eventi come migliaia di sportelli indipendenti.

Non fissare qui una numerosità che garantisca significatività: serve la variabilità della baseline. Concordare una soglia di beneficio economico prima dell'avvio; se il campione è piccolo, il risultato è esplorativo. Perimetro: preparazione e handoff, non approvazione delle prestazioni. Eventuali nuovi clienti portati da ItaliaAperta/Pino vanno in una coorte separata da quelli già acquisiti dal CAF.

**Eventi minimi:** ID caso pseudonimo, sede, gruppo assegnato, versione regole/modello, lingua scelta, stato, timestamp, minuti attivi, motivo integrazione e correzione. Niente CF, documenti o testo libero nelle metriche. La pseudonimizzazione non rende i dati anonimi: autorizzazioni, minimizzazione e retention si applicano comunque; condividere report aggregati evitando celle che identificano persone. Riferimento: [GDPR 2016/679, artt. 5, 25, 28 e 32](https://eur-lex.europa.eu/eli/reg/2016/679/oj/ita).

## Prima chiamata: script

> Chi decide strumenti e fornitori per questa sede? Quale gestionale e portale usate? Qual è l'ultimo caso ISEE rallentato dai documenti: che cosa mancava, quanti contatti sono serviti e chi ha lavorato?
>
> Quali lingue chiedono davvero i vostri utenti? Quanti riescono a inviare foto dal telefono e quanti hanno bisogno di aiuto? Come verificate identità, mandato e firma?
>
> Possiamo osservare il flusso senza acquisire dati personali e provare un export sintetico? Quale dato potete misurare oggi? Chi firma accordo e nomina privacy? Se il beneficio fosse misurato, quale budget e processo di acquisto avreste?

Chiudere con un prossimo passo concreto: demo sintetica con operatore e referente autorizzato. Non chiedere fascicoli reali via email per prepararla.

## Accordo pilota: punti da far revisionare

**Bozza commerciale, non consulenza legale né contratto pronto alla firma.**

- Parti, sedi e firmatari; verifica del potere di impegnare la rete e nominare il fornitore.
- Perimetro ISEE preparatorio; decisione, verifica, mandato, firma e trasmissione a carico del CAF nei canali autorizzati.
- Gratuità del SaaS fino al 31 marzo 2027, secondo l'ipotesi richiesta; nessun rinnovo oneroso automatico. Costi esclusi ed eventuali limiti concordati, senza vincoli nascosti.
- DPA art. 28, informative, subresponsabili, trasferimenti, sicurezza e retention per categoria. Nessun addestramento o marketing sui documenti; metriche concordate e minimizzate, non cessione generalizzata dei dati in cambio della gratuità.
- Obblighi della sede: referente operativo, formazione, rilevazioni, controllo umano, canale per problemi; assistenza Avanti e tempi di risposta concordati.
- Protocollo allegato, baseline, criteri e report; nessun obbligo di testimonianza favorevole.
- Incidenti, escalation, sospensione, fallback ordinario e rimedi; responsabilità e coperture da revisionare senza esoneri generici.
- Proprietà dei documenti/dati, export e cancellazione a fine test; gestione delle copie nell'archivio ufficiale del CAF.
- Recesso semplice, assenza di esclusiva e nessun riuso pubblico di nome/logo o risultati identificabili senza autorizzazione separata.
- Offerta successiva distinta: 50–150 €/mese per sportello oppure 0,50–1 €/pratica sono **ipotesi del progetto**, da testare; definire pratica fatturabile, limiti, IVA e assistenza prima della firma commerciale.

## Rischi e decisione

Fermare l'accesso a dati reali se mancano accordi e configurazione privacy, se le regole 2027 non sono validate o se emergono accessi indebiti. Reindirizzare subito i casi fuori perimetro o le incomprensioni che possono danneggiare il cittadino. Interrompere una funzione documentale se genera errori critici; conservare il servizio ordinario.

Valutare lo stop commerciale se il lavoro di importazione annulla il risparmio, se gli utenti abbandonano o se la sede non ha autonomia d'acquisto. Aprire la fase a pagamento solo con beneficio netto documentato e un decisore disposto a comprare. I piloti gratuiti validano il lavoro; da soli non validano il prezzo.

_Ricerca di Codex (GPT-6.1 Sol)._
