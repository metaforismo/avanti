> Bozza da far verificare da un legale/DPO; non è consulenza legale

# Pacchetto documentale per il CAF pilota

Versione 0.1 del **16 ottobre 2026**, repo esaminato `42c6700`, ramo `codex/legal`.
Set di bozze completo per la revisione, con campi **«da completare»** e impegni
negoziali proposti. Non attesta firma, conformità o avvio del pilota. Prima dei dati
reali servono documenti personalizzati approvati e prove operative sull'ambiente.

## Documenti e responsabilità

| Documento                                            | Chi compila                                                          | Chi approva/firma e cosa produce                                                                                        |
| ---------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| [Accordo art. 28](accordo-art28.md) con allegati A–C | Avanti e CAF, legale/DPO per ruoli/basi                              | Firmatari autorizzati CAF e gestore; istruzioni, sicurezza, tempi, incidenti, audit e uscita                            |
| [Sub-responsabili](sub-responsabili.md)              | Avanti raccoglie identità, catene, paesi, contratti e configurazione | CAF autorizza l'elenco definitivo; Avanti assume gli obblighi verso i fornitori                                         |
| [DPIA](dpia.md)                                      | CAF con DPO/legale e assistenza tecnica Avanti                       | Decisione motivata del titolare, parere DPO se designato; chiusura delle condizioni o consultazione art. 36 se dovuta   |
| [Registro trattamenti](registro-trattamenti.md)      | CAF per art. 30.1; gestore per art. 30.2                             | Ciascun soggetto adotta il proprio registro; nessuna firma del cittadino                                                |
| [Informativa cittadino](informativa-cittadino.md)    | CAF personalizza, Avanti verifica fatti tecnici                      | CAF approva e consegna prima della raccolta; consenso solo per finalità che lo richiedono, distinto dalla presa visione |
| [Posizione AI Act](ai-act.md)                        | Gestore e legale, CAF per destinazione/uso reale                     | Gestore documenta classificazione, trasparenza e adempimenti; CAF adotta supervisione/formazione                        |

La firma del cittadino non «approva la DPIA» e non sostituisce nomina, basi giuridiche,
mandato, delega o firma della pratica. L'accordo commerciale del pilota è separato:
parti, canone (AI inclusa), durata/sedi, assistenza, responsabilità commerciali e
legge/foro sono **da completare**; questo set non inventa un settimo contratto commerciale.

## Ordine di compilazione, approvazione e firma

1. **Definire soggetti e perimetro.** Fondatore identifica il gestore contraente;
   CAF verifica titolarità/poteri, sedi, operatori e DPO ove necessario. Primo pilota
   ISEE ordinario 2027; 730/permesso restano estensioni con approvazione dedicata.
2. **Completare basi, dati e tempi.** CAF/DPO compilano registro, informative art. 13/14
   e allegati A/C. Avanti conferma compatibilità con il comportamento reale, compresi
   purge a lotti, audit, copie esportate, backup e riuso. Separare archivio ufficiale.
3. **Chiudere fornitori e trasferimenti.** Avanti consegna schede e DPA di tutta la
   catena, incluso router, inferenza/audio e riserve. CAF valuta e approva; nessun dato
   reale a righe «da scegliere». Il nome di un modello provato non vale autorizzazione.
4. **Concludere DPIA e classificazione AI.** Eseguire le prove richieste, ottenere il
   parere del DPO ove designato e la decisione motivata del CAF. Se il residuo rimane
   elevato, consultazione preventiva prima del trattamento; una firma non lo sana.
5. **Firmare contratto e nomina con allegati definitivi.** I due firmatari sottoscrivono
   accordo art. 28 e versione dell'elenco; adottano contatti/procedure e conservano
   copie firmate. Registri/DPIA/memo sono approvati dai rispettivi responsabili, senza
   presentarli tutti come contratti bilaterali obbligatori per legge.
6. **Collaudare e autorizzare l'avvio.** Informativa e avviso AI disponibili nelle
   lingue attive, MFA/configurazione e percorsi assistiti operativi, prove con dati
   sintetici concluse. CAF e Avanti registrano un verbale di avvio con condizioni,
   ambiente/versione e referenti. Solo dopo si accolgono cittadini reali.

La firma può precedere l'attivazione tecnica soltanto con condizioni sospensive
chiare e nessun dato reale prima del loro soddisfacimento; allegati essenziali non
compilati non rendono la nomina operativa. Conservare versione firmata, evidenze
riservate e cronologia delle modifiche; non mettere fascicoli/chiavi nei documenti Git.

## Checklist da chiudere prima del primo cittadino

- [ ] Gestore legale e CAF identificati, poteri di firma, referenti privacy/sicurezza e
      sostituti, canale riservato e reperibilità incidenti effettiva.
- [ ] Contratto pilota e art. 28 firmati; tempi proposti di assistenza, preavvisi e uscita
      sostenibili e concordati (24 ore per avviso breach; altri termini nell'accordo).
- [ ] Basi art. 6 e condizioni art. 9/10 definite per persone/finalità; DPO valutato;
      registro art. 30 adottato da CAF e gestore, trattamento lead separato.
- [ ] Elenco sub-responsabili completo e autorizzato; hosting/DB/file/backup UE
      verificati; supporto/log/CDN censiti; trasferimenti e garanzie approvati.
- [ ] AI esterna solo con endpoint ZDR/no training, UE quando disponibile, e catena
      compresa riserva/audio approvata; altrimenti fallback locale.
- [ ] DPIA completata con rischi residui/prove, parere DPO se presente e decisione CAF;
      rischio file malevoli risolto/rivalutato, art. 36 esaminato se resta elevato.
- [ ] Classificazione per versione/verticale, eventuale registrazione e percorso high
      risk valutati; avviso art. 50 prima interazione e analisi separata art. 50.2.
- [ ] Informativa CAF personalizzata art. 13 e gestione art. 14, minori/rappresentanza;
      traduzioni revisionate e percorso umano accessibile con recapiti effettivi.
- [ ] Retention e decorrenze approvate, audit 365 motivato, scheduler/purge monitorati;
      termini per export, log infrastrutturali, telemetria e copie provider definiti.
- [ ] MFA resa obbligatoria, account nominativi, revoche/reset provati; accessi tecnici,
      chiavi AES e backup delle chiavi protetti; separazione ambienti verificata.
- [ ] Collaudo sintetico su Postgres/storage effettivi: tenant, file, export con binari
      separati, cancellazione gruppo famiglia/riusi, outbox e retry, assenza token nei log.
- [ ] Backup DB e file separati attivi, restore iniziale completato, RPO/RTO misurati;
      ripristino revoche/cancellazioni da registro separato e prossimo test trimestrale.
- [ ] Procedura diritti provata, filtro dati di terzi, limitazione anche manuale,
      incidenti simulati con contatti e scadenze; verbale senza payload personali.
- [ ] Rinnovi attivati solo dopo base del riuso, consenso inviti separato/provabile,
      revoca praticabile e collaudo UI/email; nessuna proroga retention per automatismo.
- [ ] Norme/modelli/convenzioni annuali 2027 ricontrollati per il verticale attivo;
      mandato/delega/firma e archivio ufficiale del CAF distinti da Avanti.

Verbale finale: CAF **[da completare]**, gestore **[da completare]**, ambiente/versione
**[da completare]**, data e autorizzazioni **[da completare]**, funzioni non attivate
**[da completare]**, prossima verifica **[da completare]**.

## Decisioni del fondatore da completare

| Decisione             | Esito da formalizzare                                                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Soggetto gestore      | Denominazione, sede, partita IVA, firmatario, contatti privacy/incidenti e valutazione DPO                                       |
| Pacchetto commerciale | Durata/canone pilota con AI inclusa, sedi, assistenza e risorse per adempiere agli SLA proposti                                  |
| Infrastruttura        | Confermare Vercel/Neon/Blob previsti e relativi contratti/entità/regioni; scegliere destinazione backup file e piano operativo   |
| Catena AI             | Endpoint primari/riserve/testo/visione/audio, router, prove ZDR/no training e regioni; eventuali trasferimenti approvati dal CAF |
| Email e rinnovi       | Contratto e localizzazioni Resend, recapito dei link, prova consenso/versione e revoca; verifica UI prima attivazione            |
| Retention/uscita      | Proporre termini sostenibili per categoria, copie, log/telemetria e cancellazione organizzazione; CAF approva necessità e durata |
| Sicurezza residua     | Strategia scansione file/isolamento e postazioni, backup/restore, privilegi e reperibilità; non vendere come già collaudato      |
| AI Act e lingue       | Responsabile classificazione/registrazione e art. 50.2, formazione, verifica traduzioni e canale assistito                       |

Le basi di trattamento, la necessità dei dati e la decisione DPIA spettano al CAF con
il proprio legale/DPO: il fondatore deve fornire fatti, contratti e opzioni realizzabili,
senza decidere al suo posto.

## Incoerenze e limiti trovati nel repo

1. **Promessa AI più forte delle prove:** `/privacy` e `/sicurezza` affermano già ZDR e
   no training; DEPLOY/SECURITY richiedono ancora verifica account/contratti/regioni.
   I filtri tecnici strict non costituiscono da soli evidenza contrattuale.
2. **Email rinnovi:** `/sicurezza`, SECURITY e l'apertura di DEPLOY dicono che le email
   non hanno link-capability; la decisione rinnovi e `renewal-copy.ts` introducono
   inviti con link. Gli avvisi ordinari restano distinti. L'outbox conserva quel link
   cifrato mentre il record pratica conserva l'hash: precisare anche «solo hash nel DB».
3. **Informativa breve incompleta:** mancano identità/recapiti puntuali, basi, termini,
   destinatari/trasferimenti, alcuni diritti, riuso/rinnovi e gestione dati indiretti.
   Confronto dettagliato in [informativa, parte D](informativa-cittadino.md#d-differenze-rispetto-a-privacy-e-sicurezza-attuali).
4. **Retention e rinnovo annuale:** il backend ora conserva, per ISEE inviato con
   consenso versionato e contatto utile, solo il [promemoria minimo](../decisions/renewals.md#promemoria-minimo-alla-retention-16-ottobre-2026)
   fino al marzo seguente, senza prorogare fascicoli/file. Necessità dei dati familiari,
   informativa e base vanno approvate da CAF/DPO; scheduler e ambiente da collaudare.
   La scadenza link non coincide con cancellazione.
5. **Prove operative aperte:** il runbook non attesta provisioning/hosting UE,
   backup DB/file, restore, cron e trasferimenti già funzionanti in produzione.
   Export JSON senza binari non significa backup né restituzione completa.
6. **Consenso rinnovi:** checkbox, submit e console campagna esistono. Il backend ora
   registra data/versione per lingua (testi immutabili nel core), con revoca cittadino
   di sola capacità anche dopo retention e due route CAF di sola revoca. Restano da
   collegare i controlli UI e da approvare l'informativa sul promemoria; nessuna prova
   browser/email reale. Versione/azione sulla capability non dimostrano identità civile
   o rappresentanza dei componenti del nucleo.
7. **Misure da non sovrastimare:** MFA configurabile, non automaticamente obbligatoria;
   isolamento tra CAF non dimostra isolamento per singola sede; controlli upload non
   sono antivirus; audit pseudonimo non è anonimo né archivio immodificabile certificato.
8. **Telemetria:** il cron esaminato pulisce audit/outbox/sessioni/bucket e contatori
   operativi; per `ai_usage` non è attestata una scadenza automatica. Contiene metadati
   senza prompt/documenti/ID pratica; decidere necessità, classificazione e durata.
9. **Recapiti:** il riepilogo cittadino impone almeno telefono o email; lo schema
   API li consente entrambi assenti. Email facoltativa non significa assenza di
   requisito di contatto nella UI. Il CAF deve motivarlo e definire l'alternativa
   assistita, evitando di descrivere indistintamente tutti i contatti come facoltativi.

I punti 4 e 6 includono l’aggiornamento backend del promemoria minimo del 16 ottobre 2026.
Gli altri sono rilievi documentali; non modificano il prodotto. L'eventuale correzione frontend,
runbook o codice resta fuori da questa attività.

## Fonti ufficiali e metodo di verifica

**Data di consultazione: 16 ottobre 2026 per tutte le fonti sotto.** Testi normativi,
orientamenti delle autorità e valutazioni del progetto sono distinti nei singoli file.
I termini negoziali proposti non sono presentati come termini legali obbligatori.

| Fonte ufficiale                                                                                                                                                                                                                                       | Uso nel pacchetto / evidenza della consultazione                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [GDPR 2016/679 — EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj/ita)                                                                                                                                                                          | Artt. 5–6, 9–10, 12–22, 25, 28, 30, 32–37, capo V. Verifica con ricerche mirate su estratti indicizzati del testo ufficiale, inclusi artt. 13/28/30/33; accesso diretto integrale bloccato da challenge anti-bot |
| [EDPB 07/2020, testo finale v2.1](https://www.edpb.europa.eu/system/files/documents/2023-10/EDPB_guidelines_202007_controllerprocessor_final_en.pdf)                                                                                                  | PDF aperto; ruoli effettivi, accordo concreto e obblighi nella catena. Adozione 7 luglio 2021, correzioni minori 20 settembre 2022                                                                               |
| [EDPB 01/2020, versione finale](https://www.edpb.europa.eu/documents/recommendation/recommendations-012020-on-measures-that-supplement-transfer-tools-to_en)                                                                                          | Pagina ufficiale reperita, versione 18 giugno 2021; valutazione dei trasferimenti e misure supplementari. Nessuna valutazione già svolta sui fornitori Avanti                                                    |
| [Garante, provvedimento 467/2018](https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/9058979)                                                                                                                                          | Pagina aperta, criteri DPIA e carattere non esaustivo dell'elenco                                                                                                                                                |
| [Garante, allegato elenco DPIA](https://www.garanteprivacy.it/web/guest/home/docweb/-/docweb-display/docweb/9059358)                                                                                                                                  | Pagina e PDF collegato aperti; vulnerabilità, innovazione e altre fattispecie da applicare al contesto reale                                                                                                     |
| [Garante, scheda DPIA](https://www.garanteprivacy.it/it/valutazione-d-impatto-della-protezione-dei-dati-dpia-)                                                                                                                                        | Informazioni ufficiali reperite sulla valutazione preventiva e sul rischio residuo elevato                                                                                                                       |
| [Garante, diritti degli interessati](https://www.garanteprivacy.it/Regolamentoue/diritti-degli-interessati)                                                                                                                                           | Pagina aperta; termini di risposta, assistenza del responsabile e condizioni dei diritti. Verificare percorso e contatti alla pubblicazione                                                                      |
| [AgID, gestione documentale e conservazione](https://www.agid.gov.it/it/ambiti-intervento/gestione-documentale) e [linee guida sul documento informatico](https://www.agid.gov.it/sites/agid/files/2024-06/Linee_guida_sul_documento_informatico.pdf) | Pagine/estratti ufficiali reperiti: conservazione documentale distinta da storage/backup. PDF diretto non scaricabile dal tool (403); non attestata lettura integrale né conformità Avanti alle linee guida      |
| [AI Act 2024/1689 — EUR-Lex](https://eur-lex.europa.eu/eli/reg/2024/1689/oj/ita)                                                                                                                                                                      | Estratti ufficiali indicizzati per artt. 3/6/49/50/113 e Allegato III; testo diretto soggetto a challenge                                                                                                        |
| [Omnibus AI 2026/1744 — EUR-Lex](https://eur-lex.europa.eu/eli/reg/2026/1744/oj)                                                                                                                                                                      | Estratti ufficiali indicizzati, in particolare art. 1(5), (39)–(40), art. 4 e considerando 22: alfabetizzazione, calendario e registrazione mantenuta; testo diretto soggetto a challenge                        |
| [Consolidato AI Act al 27 luglio 2026](https://eur-lex.europa.eu/eli/reg/2024/1689/2026-07-27/ita)                                                                                                                                                    | Reperimento ufficiale del consolidato; non dichiarata lettura integrale. Da controllare insieme a testo originario/modifiche nella revisione legale                                                              |

**Limite di verifica:** dove EUR-Lex ha richiesto JavaScript/anti-bot, le verifiche
sono state effettuate sugli estratti della stessa fonte ufficiale restituiti dalle
ricerche, non su ricostruzioni di blog. La revisione legale deve leggere integralmente
norme coordinate, eventuali nuovi atti e condizioni dei fornitori prima della firma.
Questa limitazione non è un dubbio omesso né una prova di conformità del prodotto.

Le clausole sono una proposta applicata ai fatti del repo, non riproduzioni di un
modello approvato dal Garante/EDPB. Non si è creato un ulteriore dossier in
`docs/research/` perché l'incarico limita le scritture a `docs/legal/`; tutte le nuove
fonti sono qui e nei documenti pertinenti.

## Base tecnica e aggiornamenti

Letti AGENTS, README, [ARCHITECTURE](../ARCHITECTURE.md), [regulation](../research/regulation.md),
[SECURITY](../SECURITY.md), [DEPLOY](../DEPLOY.md), [AI](../decisions/ai-platform.md),
[rinnovi](../decisions/renewals.md) e [riuso](../decisions/document-reuse.md), oltre alle
pagine privacy/sicurezza in sola lettura. Verifiche mirate del codice per decorrenza
retention, outbox/link rinnovi, consenso/revoca e cron; lettura mirata anche di
`review-step.tsx`, `use-citizen-case.ts`, testi consenso e pagina console rinnovi per
verificare lo scarto rispetto alla nota tecnica. Nessuna modifica al codice.

Aggiornare insieme accordo, elenco, DPIA, registro, informativa e memo AI quando
cambiano perimetro, catena, dati, tempi o garanzie. Custodi CAF/Avanti e prima data di
riesame **[da completare]**. Le firme e i documenti compilati per ciascun CAF vanno in
un archivio riservato, non nelle bozze pubbliche del repository.
