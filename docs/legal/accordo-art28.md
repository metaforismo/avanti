> Bozza da far verificare da un legale/DPO; non è consulenza legale

# Accordo di nomina a responsabile del trattamento — Avanti

Versione 0.1 del 16 ottobre 2026. Allegato al contratto pilota n. **[da completare]**.
I termini contrattuali proposti sotto non attestano servizi operativi già attivati.
Compilare e approvare tutti i campi essenziali prima della sottoscrizione.

## 1. Parti e contatti

**Titolare:** CAF **[ragione sociale, CF/P.IVA, sede, PEC: da completare]**, rappresentato
da **[nome, qualifica e poteri: da completare]**. Referente privacy **[da completare]**;
DPO, se designato, **[contatti: da completare]**.

**Responsabile:** gestore di Avanti **[ragione sociale o identità del soggetto contraente,
CF/P.IVA, sede, PEC: da completare]**, rappresentato da **[da completare]**.
Referente tecnico/privacy **[da completare]**; DPO, se designato, **[da completare]**.

Canale riservato per istruzioni e diritti: **[da completare]**. Recapiti incidenti,
telefono e sostituti raggiungibili anche fuori orario: **[da completare per entrambe
le parti]**. Non usare ticket pubblici o email ordinarie per allegare fascicoli o link.

## 2. Oggetto, ruoli e durata

Il CAF nomina il gestore di Avanti responsabile ai sensi dell'art. 28 GDPR per il
front office descritto nell'allegato A. Il CAF determina finalità, interessati, basi
giuridiche, dati necessari, destinatari, conservazione e autorizzazioni. Il gestore
determina i mezzi tecnici non essenziali entro queste istruzioni. Ruoli differenti
richiedono un'analisi e un accordo distinti; la nomina non sana attività svolte per
finalità proprie. Riferimenti: [GDPR, artt. 4 e 28][gdpr]; [EDPB 07/2020][edpb].

La nomina decorre dal **[da completare]**, termina con il servizio il **[da completare
o criterio]** e continua per le sole operazioni necessarie alla restituzione e
cancellazione previste dall'art. 11. Gli obblighi di riservatezza sopravvivono.
Questa bozza non costituisce da sola contratto commerciale: sedi, durata del pilota,
canone e assistenza sono **da completare** nel contratto principale. L'AI è inclusa
nel servizio; chiavi, modelli e budget sono gestiti da Avanti, senza ricariche AI del
CAF. Ciò non elimina l'autorizzazione dei sub-responsabili da parte del CAF.

La nomina riguarda i fascicoli del CAF. Lead del sito Avanti, fatturazione e personale
del gestore hanno finalità distinte e non sono autorizzati da questo accordo.

## 3. Istruzioni documentate e limiti

Costituiscono istruzioni l'accordo e gli allegati approvati, le impostazioni effettuate
da amministratori autorizzati e le richieste scritte del referente CAF. Il gestore
registra data, autore e versione delle istruzioni; le modifiche di finalità o di
garanzie richiedono conferma scritta del CAF prima dell'esecuzione. Una configurazione
tecnica non autorizza un trasferimento o una conservazione non concordati.

Il responsabile tratta i dati soltanto su tali istruzioni, inclusi i trasferimenti,
salvo obbligo del diritto UE o nazionale applicabile; in quel caso informa il CAF
prima del trattamento, salvo divieto legale per rilevanti motivi di interesse pubblico.
Se ritiene un'istruzione contraria alla normativa sulla protezione dei dati, informa
immediatamente il CAF e sospende la sola operazione contestata, proteggendo i dati,
fino alla soluzione documentata. Non estende autonomamente finalità o destinatari.

Sono vietati training/fine tuning con fascicoli, marketing, vendita dati, arricchimento
di profili, correlazione tra CAF e condivisione con altri prodotti del gestore o di
soggetti collegati. Test, demo ed eval usano dati sintetici. L'accesso tecnico a dati
reali è limitato all'assistenza necessaria, autorizzato, tracciato e riservato.

Avanti prepara checklist, documenti, proposte e riepiloghi; non trasmette pratiche
agli enti, non attribuisce prestazioni e non sostituisce il mandato/delega o la firma
richiesti dal CAF. Il link personale è una credenziale di accesso, non un'identità
certificata né un mandato. Il CAF mantiene una revisione umana sostanziale e un
canale assistito per chi non può usare il percorso digitale.

## 4. Persone autorizzate e sicurezza

Il gestore limita gli accessi al personale necessario, vincolato alla riservatezza
o a un equivalente obbligo legale, con istruzioni, formazione, revoca tempestiva e
verifica periodica dei privilegi. Il CAF fa altrettanto per i propri operatori e
identifica i soggetti prima di reset credenziali o richieste sui dati.

Le parti applicano misure adeguate al rischio ex [art. 32 GDPR][gdpr]. L'allegato B
descrive le funzioni presenti nel repo e le verifiche ancora necessarie. Il gestore
non riduce le garanzie concordate; comunica cambiamenti sostanziali e vulnerabilità
rilevanti al CAF, con piano correttivo. Il CAF approva una configurazione prima dei
dati reali: MFA obbligatoria nel pilota, ruoli assegnati, regione e backup verificati.
Non si dichiara cifratura integrale applicativa di tutti i dati né certificazione.

## 5. Sub-responsabili e autorizzazione

Il CAF rilascia un'autorizzazione generale scritta **limitata alla versione compilata
e sottoscritta** di [sub-responsabili.md](sub-responsabili.md). Righe «da scegliere»
o «da completare» non autorizzano alcun fornitore. Prima di ogni attivazione Avanti
verifica le garanzie e stipula un atto vincolante con obblighi equivalenti, inclusi
riservatezza, assistenza, incidenti, audit, cessazione e trasferimenti. Rimane
pienamente responsabile verso il CAF dell'adempimento dei sub-responsabili.

Per aggiunte o sostituzioni Avanti invia direttamente al referente CAF, con almeno
**30 giorni di preavviso**, identità, attività, dati, localizzazioni, catena dei
fornitori e garanzie. Il CAF può opporsi motivatamente entro **15 giorni**. Il
silenzio dopo il preavviso vale solo nel perimetro dell'autorizzazione generale
firmata, mai come accettazione di nuovi trasferimenti non autorizzati. In caso di
opposizione non risolta il nuovo fornitore non riceve i dati di quel CAF; le parti
concordano alternativa, fallback locale o sospensione della funzione, ed eventuale
cessazione senza pregiudicare restituzione e cancellazione. Un'urgenza non autorizza
instradamenti occulti; per abbreviare il termine occorre consenso scritto del CAF.

## 6. Localizzazione e trasferimenti

I dati applicativi, i file e i relativi backup devono usare l'hosting UE approvato
nell'elenco. La configurazione prevista è Frankfurt per Functions/DB/Blob; la sua
attivazione effettiva è **da completare**. CDN, assistenza remota, log e catene di
fornitura sono verificati separatamente. Per l'AI si ammettono soltanto endpoint
senza conservazione dei contenuti e senza training, con regione UE quando disponibile.
L'assenza di regione UE non è un'autorizzazione implicita a inviare dati altrove.

Ogni trasferimento fuori SEE, compreso un accesso da un paese terzo quando configura
trasferimento, richiede istruzione documentata e garanzia del capo V: decisione di
adeguatezza applicabile oppure strumento ex art. 46, con valutazione della sua
efficacia e misure supplementari necessarie. Identificare paesi, importatori, eventuali
SCC e moduli, valutazione d'impatto del trasferimento e accessi pubblici. Le deroghe
dell'art. 49 non sono il meccanismo ordinario di un SaaS. Se la protezione non è
assicurabile si sospende il trasferimento e si usa il percorso locale. Fonti:
[GDPR, artt. 44–49][gdpr]; [EDPB, raccomandazioni 01/2020][trasferimenti].

Il responsabile informa il CAF delle richieste di autorità riguardanti i dati,
salvo divieto legale, ne verifica la legittimità e limita le comunicazioni al dovuto.
Conserva evidenza riservata delle verifiche senza inserire contenuti nei log tecnici.

## 7. Diritti degli interessati

Il responsabile trasmette al CAF le richieste ricevute senza decidere autonomamente
sul merito, entro **2 giorni lavorativi**, e presta assistenza entro **5 giorni
lavorativi** dalla richiesta del CAF, con priorità immediata per urgenze. Sono termini
contrattuali proposti: non sostituiscono il termine ordinario di un mese dell'art. 12
GDPR né giustificano ritardi. Il CAF valuta identità/rappresentanza, diritti di terzi,
condizioni e limiti di accesso, rettifica, cancellazione, limitazione, opposizione e
portabilità e comunica l'esito all'interessato. Avanti assiste il CAF nelle comunicazioni
ai destinatari di rettifiche, cancellazioni e limitazioni ai sensi dell'art. 19 e ne
assicura l'esecuzione nella propria catena su istruzione, conservandone evidenza minima.

Avanti mette a disposizione export e cancellazione descritti nell'allegato B e
assistenza manuale riservata per le operazioni non coperte da UI. L'export completo
non va inviato indiscriminatamente a un membro della famiglia. La cancellazione di
un singolo fascicolo non elimina i riusi collegati: valutare la cancellazione del
gruppo famiglia e gli altri riferimenti legittimi ai file. Documentare copie, audit
e backup residui e la motivazione della loro conservazione. Per limitazione, bloccare
l'uso operativo mediante procedura concordata; manca una UI dedicata attestata.

## 8. Incidenti e data breach

Il responsabile informa il CAF **senza ingiustificato ritardo e comunque entro 24 ore
dalla conoscenza di una violazione** dei dati affidati, anche presso sub-responsabili,
tramite il canale incidenti e contatto di riserva. Segnala con urgenza anche sospetti
credibili che richiedano contenimento. Non aspetta il completamento dell'indagine.
Le 24 ore sono un limite contrattuale proposto; la legge impone al responsabile
l'avviso senza ingiustificato ritardo, non concede un'attesa di 72 ore.

Il primo avviso indica, per quanto noto: evento e cronologia, sistemi e CAF coinvolti,
categorie/numero stimato di persone e record, conseguenze, contenimento, evidenze
disponibili e referente. Le informazioni mancanti sono dichiarate e integrate senza
ulteriore ritardo; aggiornamenti almeno ogni **24 ore** durante la fase attiva e
rapporto conclusivo proposto entro **10 giorni lavorativi dalla stabilizzazione**,
con spiegazione di eventuali indagini ancora aperte.

Il responsabile contiene, revoca accessi compromessi, preserva evidenze minime protette,
collabora alla valutazione e attua rimedi. Il CAF decide e documenta notifica al Garante
senza ingiustificato ritardo e, ove possibile, entro 72 ore dalla propria conoscenza,
salvo improbabilità del rischio; valuta la comunicazione agli interessati in caso di
rischio elevato e le eccezioni pertinenti. Avanti non comunica a cittadini o stampa per
conto del CAF senza istruzione, salvi propri obblighi inderogabili. Fonti:
[GDPR, artt. 33–34][gdpr]. Reperibilità e simulazione della procedura sono **da completare**.

## 9. Assistenza, verifiche e audit

Il responsabile fornisce informazioni utili per sicurezza, DPIA e consultazione
preventiva ex artt. 32–36, documentazione tecnica, elenco fornitori e prove della
configurazione effettiva. Tiene il registro ex art. 30.2 per ciascun titolare.

Mette a disposizione tutte le informazioni necessarie a dimostrare gli obblighi
dell'art. 28 e consente/contribuisce ad audit e ispezioni del CAF o di un suo auditor
indipendente vincolato alla riservatezza. Preavviso ordinario proposto: **10 giorni
lavorativi**; incidenti, indizi fondati o richieste dell'autorità consentono urgenza.
Una verifica documentale può precedere l'ispezione senza escluderla. Proteggere gli
altri tenant e i segreti, concordando un accesso che resti effettivo. Il gestore
comunica rilievi e piano con responsabili/scadenze; i costi eventuali concordati nel
contratto non devono rendere impraticabile il diritto di audit. Nessun limite
contrattuale ostacola i poteri dell'autorità di controllo.

## 10. Conservazione durante il servizio

Il CAF approva l'allegato C e la motivazione dei termini. I default tecnici non sono
termini di legge. Avanti monitora le pulizie e segnala backlog e guasti; non prolunga
la conservazione per favorire i rinnovi. Un consenso agli inviti non autorizza da solo
a tenere un intero fascicolo per un altro anno. Il CAF mantiene separatamente il proprio
archivio ufficiale e i relativi obblighi per ciascuna pratica.

## 11. Restituzione e cancellazione a fine servizio

Alla cessazione il CAF sceglie per iscritto restituzione con successiva cancellazione,
oppure sola cancellazione. **Termini proposti:** export entro 15 giorni dalla richiesta;
conferma del CAF entro i successivi 10 giorni; eliminazione dei dati attivi e copie
di lavoro entro 30 giorni dalla cessazione, con piano concordato prima di quel termine
se il trasferimento richiede più tempo. Nessuna proroga tacita o uso ulteriore.
In assenza di istruzione Avanti sollecita il CAF prima della cessazione e sospende
l'uso ordinario: non assume il silenzio come scelta di distruzione immediata.

La restituzione comprende dati, metadati e **binari tramite trasferimento separato**,
manifest di integrità e consegna protetta al destinatario verificato. Il JSON CLI
non contiene i binari e non è da solo una restituzione completa. Attestare ricezione,
leggibilità e integrità; revocare sessioni e capability e coordinare i sub-responsabili.

Le copie di backup sono isolate, non usate ordinariamente ed eliminate entro la finestra
approvata nell'allegato C, proposta di **7 giorni dal rispettivo backup**. Il verbale
finale elenca dati attivi eliminati, retry storage, copie presso fornitori, audit e
scadenze residue. La conservazione dopo cessazione è ammessa solo se imposta da diritto
UE/nazionale applicabile, con norma, dati minimi, durata e accessi documentati; il
default audit di 365 giorni non è da solo motivo per conservarli a fine contratto.
Prima di un restore si riapplicano cancellazioni e revoche da un registro protetto
separato. La cancellazione dell'intera organizzazione e delle copie remote è una
procedura assistita **da completare e provare**, non un pulsante di uscita certificato.

## 12. Prevalenza e sottoscrizione

L'accordo prevale sulle clausole commerciali incompatibili in materia di protezione
dei dati, senza limitare diritti degli interessati, responsabilità inderogabili o
poteri dell'autorità. Legge applicabile e foro tra le parti: **[da completare dal
legale]**. Ogni modifica è documentata. Sono parti integranti gli allegati A–C e
l'elenco sub-responsabili con numero di versione **[da completare]**.

Luogo/data **[da completare]**. Per il CAF **[firma e poteri]**. Per il gestore Avanti
**[firma e poteri]**. Referenti prendono in carico le procedure **[nomi/data]**.

## Allegato A — Trattamento autorizzato

| Voce          | Istruzione da approvare                                                                                                                                                                                                                                                                       |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Perimetro     | Sedi **[da completare]**; primo pilota ISEE ordinario 2027; 730 e permesso di soggiorno soltanto con attivazione scritta e aggiornamento DPIA, basi e classificazione AI                                                                                                                      |
| Finalità      | Preparazione del fascicolo, assistenza multilingue, verifica documentale umana, integrazioni, consegna al CAF, sicurezza e continuità del servizio                                                                                                                                            |
| Operazioni    | Raccolta, registrazione, strutturazione, analisi AI/euristica, traduzione, consultazione, revisione, export, riuso esplicito, cancellazione; trascrizione vocale facoltativa senza persistenza dell'audio                                                                                     |
| Dati          | Identità/CF, data di nascita, nucleo, redditi/patrimoni/conti/immobili, documenti, recapiti (email facoltativa; UI richiede telefono o email), lingua, messaggi, risposte, note interne, analisi/proposte AI, prospetto preparatorio, revisioni, audit pseudonimi e dati di accesso operatori |
| Dati delicati | Minori e terzi nel nucleo; possibili dati di salute/disabilità e altre categorie art. 9 nei documenti. Dati art. 10 esclusi dal primo pilota salvo specifica autorizzazione normativa e revisione documentata                                                                                 |
| Interessati   | Richiedenti adulti o rappresentanti verificati dal CAF, familiari/minori/terzi indicati nei documenti, operatori e amministratori CAF                                                                                                                                                         |
| Basi          | Matrice art. 6 e, ove necessario, art. 9/10: **[CAF/DPO: da completare per verticale]**; la presa visione non è consenso generale                                                                                                                                                             |
| AI            | Inclusa nel canone; interruttori CAF per cittadini e copilota; solo catena approvata ZDR/no training, UE quando disponibile; altrimenti fallback locale                                                                                                                                       |
| Rinnovi       | Solo ISEE, selezione operatore; inviti email con consenso dedicato e preferenza CAF; nessun rinnovo automatico della prestazione. Il riuso/preparazione ha base e durata proprie da approvare, distinte dal consenso agli inviti                                                              |
| Destinatari   | Operatori autorizzati CAF, gestore e soli sub-responsabili approvati; export al CAF. Nessun invio diretto agli enti da Avanti                                                                                                                                                                 |

## Allegato B — Misure tecniche e organizzative

«Nel repo» indica implementazione/documentazione esaminata al commit `42c6700`, non
un collaudo della produzione. Per ogni verifica operativa aggiungere verbale, responsabile
e data **[da completare]**. Fonti interne: [SECURITY](../SECURITY.md), [DEPLOY](../DEPLOY.md),
[piattaforma AI](../decisions/ai-platform.md), [riuso](../decisions/document-reuse.md),
[rinnovi](../decisions/renewals.md).

| Area           | Nel repo                                                                                                                                                       | Da completare prima dei dati reali                                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Autenticazione | scrypt con sale; token sessione hashati; cookie HttpOnly/Secure in produzione/SameSite; 30 minuti inattività, massimo 12 ore; revoca/rotazione                 | Account nominativi, gestione password e revoche, prova sul dominio effettivo                                                                |
| MFA            | TOTP, codici recupero monouso hashati; segreti AES-256-GCM; obbligatorietà configurabile per CAF                                                               | Rendere obbligatoria nel pilota, provare reset con identificazione e custodia/restore chiave                                                |
| Cittadini      | Link casuale 256 bit, hash nel DB, scadenza e rotazione; token necessario nell'envelope cifrato dell'invito rinnovo                                            | Distribuzione sicura, no-referrer, log proxy senza token, nessuna raccolta analytics; il link non verifica l'identità                       |
| Autorizzazione | Tenant dalla sessione, controlli su pratiche/file/export e ruoli; risorse di altro CAF non accessibili                                                         | Matrice ruoli e accessi alle sedi: non attestato isolamento rigido per singola sede; limitare accessi infrastrutturali                      |
| API            | Schemi condivisi, origine delle mutazioni, quote, errori sicuri, header API no-store                                                                           | Collaudo browser/proxy e assenza di contenuti nei log infrastrutturali                                                                      |
| File           | 4 MiB/file, 60 file/120 MiB per pratica; riconoscimento contenuto, controlli PDF attivi e dimensioni immagini; download autorizzato come allegato              | Non è antivirus: scansione malware/decodifica isolata non attestata; decidere misure proporzionate e rischio residuo                        |
| Storage        | Blob privato o disco locale con controlli percorso e permessi 0600; retry cancellazione persistente, rispetto riferimenti condivisi                            | Provisioning UE, put/get/delete reali; cifratura a riposo di DB/oggetti e backup da documentare con il fornitore, senza attribuirla all'app |
| Trasporto      | Configurazione HTTPS e TLS Postgres prevista nel runbook                                                                                                       | Verificare dominio, certificati, HSTS e connessioni effettive                                                                               |
| Email          | Outbox destinatario/mittente/oggetto/corpo AES-256-GCM, chiave dedicata; annullamento/rivalidazione; nessun tracking richiesto dal codice                      | DPA email, tracking disabilitato, dominio, regioni e gestione chiave. Il provider vede il messaggio in chiaro necessario al recapito        |
| Audit          | Accessi, export, cancellazioni e mutazioni con ID/azioni/tempi; metadati ammessi senza testi o credenziali; consultazione/export admin                         | Gli ID restano dati pseudonimi; motivare 365 giorni e gestire CSV; non attestata immutabilità crittografica/WORM                            |
| AI             | Input minimo per compito, validazione output e conferma umana per risposte/valori, guard e fallback; OpenRouter strict invia `zdr:true`/`data_collection:deny` | Accordi ed endpoint di tutti i tentativi, regioni, no training, audio, router e riserve; filtri non equivalgono a garanzia contrattuale     |
| Retention      | Cron con segreto, lotti di purge, retry file, cancellazione amministrativa e gruppo famiglia                                                                   | Scheduler effettivo, backlog e attestazioni; copie esportate, file condivisi e backup gestiti separatamente                                 |
| Continuità     | Runbook backup DB e file separati, restore con revoche e cancellazioni                                                                                         | Backup remoti/copia file e restore non attestati; approvare RPO/RTO e prova iniziale/trimestrale                                            |
| Organizzazione | Procedure tecniche e test locali documentati                                                                                                                   | Designazioni, NDA, formazione, reperibilità, gestione incidenti, verifica periodica accessi e piano vulnerabilità                           |

## Allegato C — Tempi e cancellazione

| Categoria                                                  | Comportamento attuale e istruzione                                                                                                                                                                                                                       |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Link                                                       | Default 60 giorni; configurabile 1–365. Scadenza accesso distinta dalla cancellazione. Valore CAF **[da completare]**                                                                                                                                    |
| Fascicolo, documenti, messaggi, estrazioni/cache collegate | Default `retentionDays=180`, configurabile 30–3650; purge quando chiusura oppure scadenza link è più vecchia del termine. Non decorre semplicemente dall'upload; riaperture/rigenerazioni possono incidere. Valore e motivazione CAF **[da completare]** |
| Cancellazione                                              | Fino a 25 fascicoli/run; file dopo commit, retry fino a conferma; file condiviso eliminato soltanto dopo ultimo riferimento legittimo. Frequenza/ritardo massimo operativo e allarmi **[da completare]**                                                 |
| Audit                                                      | 365 giorni dal singolo evento, purge fino a 1.000/run; durata tecnica separata, da approvare e motivare. Cessazione regolata dall'art. 11                                                                                                                |
| Outbox                                                     | Payload eliminato a invio confermato/annullamento, scadenza pendenti/falliti 7 giorni; ricevute tecniche 30 giorni dal completamento, applicate dal cron; copie provider **[da completare]**                                                             |
| Audio                                                      | Elaborato in memoria, non scritto nel DB/disco dall'app; testo inviato/confermato e messaggi seguono il fascicolo. ZDR del fornitore audio **[da completare]**                                                                                           |
| Backup DB/file                                             | Proposta runbook 7 giorni, copie cifrate file UE e registro separato di revoche/cancellazioni; attivazione e scadenze effettive **[da completare]**                                                                                                      |
| Export, ticket, log infrastrutturali, telemetria AI        | Accessi, necessità, tempi e cancellazione **[da completare per ciascuna categoria]**. `ai_usage` non contiene contenuti/pratica ma non ha una scadenza automatica attestata nel cron esaminato                                                           |
| Rinnovi                                                    | Solo dati ancora legittimamente conservati; nessuna proroga della sorgente. Nuovo fascicolo con propria retention; revoca inviti nel gruppo collegato e cancellazione coordinata                                                                         |

Fonti ufficiali consultate il **16 ottobre 2026**; limiti di accesso e repertorio in
[README, fonti](README.md#fonti-ufficiali-e-metodo-di-verifica). Termini di assistenza,
preavvisi e uscita sono proposte negoziali di questa bozza, non termini imposti dal GDPR.

[gdpr]: https://eur-lex.europa.eu/eli/reg/2016/679/oj/ita
[edpb]: https://www.edpb.europa.eu/system/files/documents/2023-10/EDPB_guidelines_202007_controllerprocessor_final_en.pdf
[trasferimenti]: https://www.edpb.europa.eu/documents/recommendation/recommendations-012020-on-measures-that-supplement-transfer-tools-to_en
