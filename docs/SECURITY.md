# Sicurezza e protezione dei dati

Versione: **6 ottobre 2026**; fonti consultate il 5–6 ottobre. Questo documento descrive controlli tecnici, responsabilità
e lavoro operativo necessario al pilota; non certifica conformità GDPR o AI Act.
Le prove di implementazione sono i test e i controlli riportati nella PR.

## Confini e minacce

Il link cittadino è una credenziale: chi lo possiede può accedere al relativo fascicolo.
I dati includono identità, situazione economica, documenti e potenzialmente salute/minori.
Minacce principali: furto del link/sessione, accesso fra CAF, caricamenti malevoli,
abuso degli endpoint, esposizione tramite log/cache/export e invio eccessivo a fornitori AI.
Avanti prepara; il CAF verifica e utilizza il proprio gestionale per la pratica ufficiale.

| Superficie     | Controllo da mantenere                                                                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Password       | scrypt `N=32768, r=8, p=1`, sale casuale 16 byte, derivato 64 byte; confronto costante. Nessuna password nei log                                                  |
| Sessioni       | Token casuale 32 byte, solo SHA-256 nel DB; cookie HttpOnly, SameSite=Lax, Secure in produzione; scadenza e rinnovo controllati dal server                        |
| CSRF operatore | Origin confrontato con origine della richiesta o PUBLIC_APP_URL; senza Origin solo Sec-Fetch-Site same-origin; controllo su tutte le mutazioni operatore          |
| Cittadino      | Capability casuale 32 byte, solo hash nel DB; scadenza e risposta `link_expired`/410. Il token non viene ricostruito per la console                               |
| Tenant         | Organizzazione dalla sessione, mai fidata dal body; ogni query, file, assegnatario, export e metrica deve essere circoscritto; risorse estranee restituiscono 404 |
| Input          | Schemi condivisi più validazione di dominio; errori italiani sicuri, niente stack/dettagli infrastrutturali al client                                             |
| Upload         | Massimo 4 MiB per file, limite della richiesta multipart, firma del tipo e nomi sanificati; chiavi storage generate dal server                                    |
| Download       | Autorizzazione prima dello storage; allegato, `nosniff`, cache privata disabilitata. URL Blob privati non esposti al cittadino                                    |
| Abusi          | Rate limit login/intake/turn/upload/leads, errore uniforme di login; origine IP derivata solo da proxy fidato                                                     |
| Audit          | Attore, categoria, istante, conteggi; niente messaggi, nomi, CF, contatti, nomi file o contenuto documenti nei metadati/log                                       |

Le firme riconoscono il contenitore; non sono antivirus né prova che tutte le pagine
si aprano correttamente. PDF/immagini possono contenere dati o contenuti pericolosi:
download come allegato e verifica umana restano necessari. Valutare scansione malware e
decodifica isolata prima di un deployment con dati reali su larga scala.

Il reverse proxy deve oscurare i segmenti capability nei log delle richieste e inviare
`Referrer-Policy: no-referrer` sulle pagine cittadino. Analytics, replay di sessione e
tracker non devono raccogliere quelle pagine. Non incollare link veri in ticket o chat.
La policy del proxy/browser fa parte del deployment e non è provata dai soli test Hono.

## GDPR: ruoli, base e informativa

Per i fascicoli, il **CAF/patronato è titolare**: decide finalità, base giuridica,
destinatari e durata. Il gestore di Avanti opera come **responsabile ex art. 28** su
istruzioni documentate, con accordo che disciplini assistenza, sicurezza, subresponsabili,
incidenti, restituzione/cancellazione e audit. Il ruolo dipende dai fatti, non dal nome
contrattuale. Per propri lead commerciali il gestore ha finalità distinte da valutare
come titolare. Non riutilizzare i fascicoli per marketing o training.
[GDPR, artt. 4 e 28](https://eur-lex.europa.eu/eli/reg/2016/679/oj/ita),
[EDPB, linee guida 07/2020](https://www.edpb.europa.eu/documents/guideline/guidelines-072020-on-the-concepts-of-controller-and-processor-in-the-gdpr_en).

Il titolare identifica la base dell'art. 6 e, per disabilità/salute, una condizione
dell'art. 9; `privacyAccepted` non dimostra da solo una base lecita per tutti i dati
dei membri. L'informativa deve spiegare titolare, finalità, AI/fornitori, destinatari,
durate e diritti in lingua comprensibile. Conservare prova della presa visione e versione
dell'informativa senza riportarne il contenuto negli audit. Acquisire deleghe e altre
autorizzazioni necessarie alla pratica tramite il CAF.
[Garante, principi e basi del trattamento](https://www.garanteprivacy.it/home/principi-fondamentali-del-trattamento).

## Retention e diritti

I parametri iniziali del DB sono `linkDays=60` e `retentionDays=180`, configurabili per
organizzazione: **scelte tecniche, non termini imposti dalla legge**. Scadenza link,
chiusura della pratica e cancellazione sono operazioni distinte. Una configurazione
non esegue di per sé la cancellazione. La durata appropriata va motivata dal CAF,
separando copia preparatoria Avanti dall'archivio obbligatorio del gestionale.
[Garante, limitazione della conservazione](https://www.garanteprivacy.it/home/principi-fondamentali-del-trattamento).

Runbook da concordare prima del pilota:

1. Il CAF identifica in modo proporzionato il richiedente, registra richiesta e scadenza;
   il possesso del link non prova da solo identità o rappresentanza di tutti i membri.
2. Per accesso/rettifica, il CAF verifica i dati e prepara la copia, tutelando terzi e
   note interne. L'export operatore completo non è automaticamente la risposta GDPR.
3. Per cancellazione, il CAF verifica eventuali obblighi di conservazione; Avanti revoca
   accessi, cancella DB e file locali/Blob e gestisce copie esportate con il CAF.
4. Limitazione e sospensione d'uso vanno rispettate anche se manca una UI dedicata.
   Conservare solo audit strettamente necessario e disciplinare scadenza delle copie
   di backup; un ripristino non deve reintrodurre dati cancellati nell'uso ordinario.
5. Documentare esito, dati residui motivati e tempi. Nessun comando di purge o workflow
   automatico può essere considerato operativo senza una prova sul deployment.

Accesso, rettifica, cancellazione, limitazione/opposizione e portabilità hanno condizioni
specifiche; la portabilità non vale indiscriminatamente per tutte le basi giuridiche.
Il titolare risponde normalmente entro un mese, con estensione motivata nei casi previsti;
Avanti lo assiste. L'interessato può reclamare al Garante.
[Garante, diritti degli interessati](https://www.garanteprivacy.it/Regolamentoue/diritti-degli-interessati).

## Fornitori AI, storage e incidenti

Senza chiavi il sistema usa storage locale ed euristiche. Attivare AI Gateway/Blob
significa coinvolgere fornitori: verificare accordi, subresponsabili, regioni, retention,
riuso/training e trasferimenti extra SEE prima di inviare documenti reali. Le variabili
d'ambiente non documentano questi aspetti. Invio minimo: singolo turno o documento
necessario, senza note interne né fascicoli di altri cittadini. `AI_GATEWAY_PROVIDER`
vincola ogni chiamata a un unico provider con `gateway.only`: se non disponibile,
il fallback è locale. Questo filtro non garantisce regione UE o ZDR; verificare
la matrice contrattuale prima di abilitare la chiave.
[Gateway, provider routing](https://vercel.com/docs/ai-gateway/models-and-providers/provider-options).

Output del modello e testo dei documenti sono input non fidati: validare tipi e
identificativi contro il catalogo, non eseguire istruzioni contenute nel documento,
consentire correzione umana e mantenere fallback esplicito. L'euristica non può
certificare leggibilità, pagine o intestazione; `verified` richiede l'operatore.

In un incidente: contenere accessi, revocare credenziali coinvolte, preservare evidenze
minime e avvisare senza ingiustificato ritardo il titolare. Il CAF valuta notifica entro
72 ore quando applicabile e comunicazione agli interessati secondo il rischio;
documentare anche incidenti non notificati. Registri di trattamento, contatti e procedura
di escalation sono attività operative da predisporre.
[GDPR, artt. 30, 32–34 e capo V](https://eur-lex.europa.eu/eli/reg/2016/679/oj/ita).

Dati economici/sanitari, minori, persone vulnerabili e tecnologia innovativa richiedono
una valutazione documentata dell'obbligo di DPIA prima del trattamento reale. La
dimensione ridotta del pilota non esenta automaticamente; se i rischi residui restano
elevati si valuta la consultazione preventiva. Questo documento non è una DPIA.
[Garante, elenco dei trattamenti soggetti a DPIA](https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/9058979).

## AI Act: qualificazione per finalità effettiva

L'Allegato III, 5(a), riguarda IA usata da/per autorità per valutare accesso a prestazioni
pubbliche essenziali; 7(c) riguarda assistenza alle autorità nell'esame di domande di
soggiorno/asilo. Il solo settore CAF non prova automaticamente l'inclusione o esclusione.
Art. 6(3) contempla compiti procedurali/preparatori senza rischio significativo e
influenza materiale sull'esito; la profilazione rende comunque alto rischio un sistema
ricompreso nell'Allegato III. L'operatore presente non è una deroga generale.
[Regolamento 2024/1689, art. 6, considerando 53 e Allegato III](https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng).

Valutazione di progetto, da confermare giuridicamente: classificare documenti,
chiedere integrazioni e tradurre per preparare un fascicolo tende al compito
preparatorio. La conclusione cambia se punteggi/blocchi filtrano l'accesso ai servizi,
se l'operatore approva senza controllo sostanziale o se il prodotto valuta ammissibilità.
Documentare destinazione d'uso, influenza reale, rischi per lingua/disabilità e motivazione;
riesaminare ad ogni estensione. Se ricompreso ma esentato, restano valutazione documentata
e obbligo di registrazione pertinente. In caso di alto rischio pianificare gestione
rischi, documentazione, qualità, logging, supervisione, conformità e obblighi del deployer
secondo i ruoli effettivi; non dichiararli assolti da questa PR.

Il **Regolamento 2026/1744**, art. 1(40), modifica il calendario: Capo III, sezioni 1–3
per Allegato III dal **2 dicembre 2027** (salvo art. 6(5)); non usare il vecchio
2 agosto 2026 per questi obblighi. Confermati requisiti di documentazione/registrazione
per l'esenzione, con semplificazione. Il nuovo art. 4 richiede misure di supporto
all'alfabetizzazione IA; l'interazione IA deve essere trasparente secondo art. 50.
L'art. **50(1)** sulla trasparenza dell'interazione è applicabile dal **2 agosto 2026**:
all'apertura del fascicolo viene restituito un avviso automatico/AI nella lingua scelta,
con verifica dell'operatore e alternativa allo sportello. Il campo `engine` del turno
identifica AI o euristica. L'export PDF dichiara il supporto automatico, la natura
preparatoria e se la verifica è completata; non attesta verifiche mai effettuate.
La marcatura machine readable ex art. 50(2) è un requisito distinto da valutare sul
rilascio e non viene dichiarata assolta dal solo campo `engine`.
Il pilota gennaio 2027 non è un'esenzione GDPR né una prova di classificazione AI Act.
[Testo ufficiale delle modifiche 2026](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ:L_202601744),
[Commissione, entrata in vigore AI Omnibus](https://digital-strategy.ec.europa.eu/en/news/ai-omnibus-enters-force).

Formare gli operatori sulle analisi incerte, disponibilità beta e correzione degli errori;
mostrare al cittadino che interagisce con un sistema automatico e come raggiungere il
CAF. Le scadenze e la qualificazione vanno ricontrollate prima del rilascio reale.
