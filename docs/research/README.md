# Ricerca per Avanti

**Cutoff: 5 ottobre 2026.** Raccolta e verifiche svolte il 5–6 ottobre; nessun evento successivo al cutoff usato per descrivere lo stato normativo. I prezzi e le funzioni di pagine non versionate sono osservazioni commerciali del momento, non ricostruzioni storiche. Fonti primarie: enti, testi normativi, associazioni di settore e siti/documentazione dei fornitori; le dichiarazioni dei vendor non sono prove di efficacia.

**Verificato** = valore o regola sostenuti dalla fonte, con anno e perimetro. **Stima/proposta** = inferenza, calcolo o scelta del progetto. **Non trovato** = lacuna della ricerca, non inesistenza. Il repository descrive il prodotto previsto: questo dossier non certifica che le funzionalità siano già implementate, conformi o disponibili al pubblico.

## Indice

| Documento                            | Decisione che aiuta a prendere                                          |
| ------------------------------------ | ----------------------------------------------------------------------- |
| [Mercato](market.md)                 | Volumi, sedi e compensi; ordine di grandezza dei ricavi e dati mancanti |
| [Competitor](competitors.md)         | Offerte già presenti e differenziazione da dimostrare                   |
| [Regolamentazione](regulation.md)    | Perimetro, responsabilità e documenti prima dei dati reali              |
| [Integrazioni](integrations.md)      | Handoff iniziale e accessi/connettori da verificare                     |
| [Playbook piloti](pilot-playbook.md) | Reclutamento, baseline, KPI e accordo da revisionare                    |
| [Lingue](languages.md)               | Comunità, priorità e verifica delle traduzioni                          |

La ricerca normativa sulle singole pratiche, incluso ISEE 2027, è un lavoro separato. Questi documenti non definiscono la checklist normativa completa né sostituiscono la sua verifica prima del pilota.

## I dieci insight per prodotto e landing

1. **La domanda è grande, ma dichiarazioni e famiglie sono diverse.** INPS conta circa **11 milioni DSU ordinarie e 10,4 milioni nuclei nel 2025**. Claim possibile, con anno e fonte; evitare «11 milioni di clienti potenziali Avanti». [INPS, febbraio 2026](https://www.inps.it/it/it/inps-comunica/notizie/dettaglio-news-page.news.2026.02.osservatorio-su-dsu-e-isee-i-dati-2016-2025.html).

2. **Il CAF rimane un canale centrale.** **85% DSU tramite CAF nel 2024**, nel rapporto MLPS. Dire il dato nel suo perimetro; evitare una quota 2026 inventata o la somma con l'autonomia 2025. [Rapporto ISEE 2024](https://lavoro.gov.it/documenti-e-norme/studi-e-statistiche/rapporto-isee-2024).

3. **Gennaio richiede un prodotto già pronto.** Il **71% delle DSU 2025** è nel primo trimestre. Il pilota va preparato a dicembre, con supporto e handoff; evitare di presentare il picco come una previsione esatta per il 2027. [INPS](https://www.inps.it/it/it/inps-comunica/notizie/dettaglio-news-page.news.2026.02.osservatorio-su-dsu-e-isee-i-dati-2016-2025.html).

4. **«Primo front office AI CAF» non è sostenibile.** TeamSystem Centro Servizi documenta chat AI ISEE/730 e fascicolo nella brochure **febbraio 2026**. La differenza Avanti è un'ipotesi su lingue, attrito e lavoro netto, non l'esistenza dell'AI. [Brochure TeamSystem](https://www.teamsystem.com/media/files/1671_TS_BROCHURE_LIGHT_TeamSystem_Centro_Servizi_2026.pdf).

5. **Sportelli × prezzo è uno scenario, non un mercato conquistabile.** Le oltre **30.000 sedi** sono una dichiarazione Consulta **2023**. La base tonda a 50–150 €/mese produce **18–54 milioni €/anno** a penetrazione totale, senza costi; evitare quel valore come previsione di fatturato. [Consulta](https://consultacaf.it/30-anni-di-caf-angileri-da-sempre-al-servizio-del-paese-svolgiamo-un-ruolo-sociale-siamo-il-punto-di-contatto-tra-istituzioni-e-cittadini/), [calcoli e limiti](market.md).

6. **La sensibilità al prezzo va misurata sul margine.** Per il 730 dell'attività **2025**, AdE riduce il totale nominale fatturabile del **54,912982%**. Il compenso pubblico non è ricavo Avanti né budget software libero. Evitare «il CAF incassa sempre 18,30 € per 730». [Avviso AdE, maggio 2026](https://telematici.agenziaentrate.gov.it/Main/Avviso?id=20260521175911).

7. **Il fascicolo prepara il lavoro dell'operatore.** Mandato, firma, controllo e trasmissione restano nella procedura CAF; il click in Avanti non presenta una DSU. Formulazione proposta, da usare dopo verifica funzionale: «Prepara i documenti per il tuo CAF». Evitare «ISEE approvato dall'AI» e garanzie d'esito. [Convenzione INPS–CAF 2026](https://www.inps.it/content/dam/inps-site/it/scorporati/circolari-e-messaggi/2026/04/Circolare_15250/Allegati/16747_Messaggio-numero-0001442-del-30-04-2026_Allegato-n-1.pdf).

8. **Il rinvio high risk non rinvia tutta la normativa AI.** Omnibus AI **2026/1744** è già vigente; Annex III, capitolo III sezioni 1–3, dal **2 dicembre 2027**, ma trasparenza chatbot art. 50(1) dal **2 agosto 2026**. Classificazione specifica Avanti ancora da motivare; evitare «esente dall'AI Act». [Omnibus AI](https://eur-lex.europa.eu/eli/reg/2026/1744/oj), [analisi](regulation.md).

9. **Le lingue sono una scelta da validare, non una percentuale di copertura.** ISTAT 2025 indica grandi comunità albanese, cinese e pakistana: `sq/zh/ur` sono prossime candidate. Nazionalità non identifica lingua preferita; evitare «tutte le lingue» e percentuali di parlanti dedotte dai residenti. [Dataset ISTAT](https://demo.istat.it/data/rcs/Dati_RCS_cittadinanza_2025.zip), [conteggi riproducibili](languages.md).

10. **Risparmio e compatibilità devono avere una prova.** Non trovate API aperte sufficienti a promettere ogni gestionale; prima del pilota testare export e caricamento. Misurare minuti totali, mancanti, correzioni e abbandoni contro il flusso abituale nello stesso periodo. Evitare «zero errori», percentuali di risparmio o «integrato con tutti» prima di una misura documentata. [Integrazioni](integrations.md), [protocollo proposto](pilot-playbook.md).

## Cosa chiudere prima di vendere

Confermare autonomia d'acquisto e firma dei CAF, convenzione/regole 2027, DPA/DPIA e subresponsabili, qualità delle lingue e export. Conservare una distinzione esplicita fra copia preparatoria Avanti e archivio ufficiale. «Gratis per il cittadino» e «pilota gratuito fino a marzo 2027» sono **scelte commerciali del brief**, da riflettere nell'accordo; non provano beneficio, sicurezza o acquisto successivo.

_Ricerca di Codex (GPT-6.1 Sol)._
