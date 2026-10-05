# Lingue: domanda demografica e validazione allo sportello

Cutoff: **5 ottobre 2026**; consultazione 5–6 ottobre. I numeri sotto sono residenti per **cittadinanza**, non parlanti né utenti CAF. Le priorità linguistiche sono **inferenze di prodotto**, da verificare nelle sedi pilota.

## Le comunità più numerose

Fonte primaria: [ISTAT Demo, popolazione per cittadinanza](https://demo.istat.it/app/?i=RCS&l=it), [CSV ufficiale nel pacchetto 2025](https://demo.istat.it/data/rcs/Dati_RCS_cittadinanza_2025.zip). Riferimento **1° gennaio 2025**; somma nazionale stranieri **5.371.251**. Valori riprodotti leggendo il CSV, non copiati da aggregatori.

| Cittadinanza | Residenti al 1° gennaio 2025 | Lingue candidate: inferenza, non censimento                      |
| ------------ | ---------------------------: | ---------------------------------------------------------------- |
| Romania      |                    1.053.042 | Romeno                                                           |
| Albania      |                      414.622 | Albanese                                                         |
| Marocco      |                      412.457 | Arabo/darija; lingue amazigh da verificare                       |
| Cina         |                      311.250 | Cinese scritto; varietà orale da chiedere                        |
| Ucraina      |                      287.187 | Ucraino; altre preferenze da chiedere                            |
| Bangladesh   |                      213.622 | Bengalese                                                        |
| Egitto       |                      174.141 | Arabo; varietà egiziana per la voce                              |
| India        |                      171.429 | Punjabi, hindi e altre; nessuna lingua assegnata automaticamente |
| Pakistan     |                      171.179 | Urdu, punjabi e altre                                            |
| Filippine    |                      153.455 | Filipino/tagalog; inglese come possibile lingua ponte            |
| Nigeria      |                      132.129 | Inglese e altre lingue, da verificare                            |
| Tunisia      |                      123.828 | Arabo/tunisino; francese come possibile lingua ponte             |
| Senegal      |                      119.067 | Wolof, francese e altre                                          |
| Perù         |                      116.169 | Spagnolo; altre preferenze da chiedere                           |
| Sri Lanka    |                      113.705 | Singalese/tamil, da distinguere                                  |
| Moldova      |                       94.141 | Romeno e altre, da chiedere                                      |

Il dato nazionale più recente è **5,560 milioni di residenti stranieri al 1° gennaio 2026**, **9,4%** della popolazione, **provvisorio**: [ISTAT, Indicatori demografici 2025, pubblicati 31 marzo 2026](https://www.istat.it/comunicato-stampa/indicatori-demografici-anno-2025/). Tenere separati questo totale e la graduatoria dettagliata 2025; non presentare la tabella come composizione del 2026.

Per il futuro verticale immigrazione, [ISTAT su dati Ministero dell'Interno, 28 ottobre 2025](https://www.istat.it/comunicato-stampa/cittadini-non-comunitari-in-italia-anno-2024/) conta **3.810.741 permessi validi al 31 dicembre 2024** e **290.119 nuovi permessi nel 2024**. Include le principali comunità extra-UE sopra. Questo universo differisce dai residenti e non include allo stesso modo i cittadini UE: **non sommarlo** alla popolazione straniera.

## Scelta iniziale e prossime lingue

Il pacchetto del brief `it/en/fr/es/ro/uk/ar/bn` è plausibile, ma non dimostra una percentuale di copertura.

| Lingua / codice                                         | Decisione proposta                                       | Cosa validare                                                                                      |
| ------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Italiano `it`                                           | Base cittadino e revisione operatore                     | Frasi semplici, termini economici spiegati                                                         |
| Romeno `ro`, ucraino `uk`, bengalese `bn`               | Priorità iniziale sostenuta dalle rispettive comunità    | Comprensione effettiva, alfabetizzazione, termini bancari                                          |
| Arabo `ar`                                              | Priorità iniziale, con interfaccia RTL                   | Arabo scritto standard e comprensione delle varietà parlate; non promettere ogni dialetto          |
| Inglese `en`, francese `fr`, spagnolo `es`              | Lingue ponte e comunità plurilingui; utilità da misurare | Lingua scelta dall'utente, senza dedurla dal passaporto                                            |
| Albanese `sq`, cinese `zh`, urdu `ur`                   | **Prossime candidate demografiche**                      | Richieste delle sedi e disponibilità di revisori competenti                                        |
| Punjabi `pa`, filipino `fil` / tagalog `tl`, wolof `wo` | Priorità locale                                          | Varietà, scrittura e termini; scegliere un'etichetta/codice coerente con la traduzione disponibile |
| Singalese `si`, tamil `ta`                              | Altre candidate locali                                   | La cittadinanza srilankese non permette di scegliere fra le due                                    |

La somma di residenti delle cittadinanze associate a una lingua sarebbe una **stima impropria dei parlanti**. Non dichiarare «copriamo il 90% degli stranieri» o «tutti parlano una di queste lingue». Anche un italiano può preferire un'altra lingua e un cittadino straniero può preferire l'italiano.

## Dove testare

| Comune, dato ISTAT al 1° gennaio 2025 | Comunità osservata                      | Uso nel pilota: proposta                                                       |
| ------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------ |
| Roma                                  | **35.139** residenti bangladesi         | Test bengalese, dopo conferma del bacino della sede                            |
| Milano                                | **41.346** residenti egiziani           | Test arabo scritto e richieste assistite                                       |
| Prato                                 | **33.564** residenti cinesi             | Verifica domanda di cinese; evitare di reclutare per una lingua ancora assente |
| Brescia                               | **3.791** pakistani e **2.780** indiani | Esplorare urdu/punjabi con mediatori e utenti                                  |

Fonte: stesso [CSV ISTAT](https://demo.istat.it/data/rcs/Dati_RCS_cittadinanza_2025.zip), righe comunali rispettivamente `058091`, `015146`, `100005`, `017029`. Una comunità residente non garantisce domanda ISEE in quel CAF: il dato serve a selezionare colloqui, non a prevedere conversioni.

## Criteri di rilascio

**Proposta di prodotto:** far scegliere la lingua, consentire il cambio e mantenere un percorso umano. Revisionare con persone competenti domande, informative e messaggi su nucleo, saldo, giacenza, patrimonio, anno di riferimento e documenti mancanti. Non usare la sola traduzione automatica come prova di correttezza.

Mostrare all'operatore l'originale e la traduzione italiana, con incertezza e possibilità di correzione. Verificare numeri, date, nomi, codici e anno separatamente dal testo; un documento in lingua diversa non diventa valido perché tradotto. Per la voce verificare comprensione per varietà locale; per l'arabo testare RTL, campi numerici, focus e lettori di schermo.

Misurare lingua scelta, completamento di **tutti gli inviti**, aiuto richiesto, errori critici e integrazioni per lingua. Non raccogliere nazionalità solo per produrre queste metriche. Rilasciare una lingua quando passa la revisione dei contenuti e la prova assistita, senza dichiarare qualità identica prima di misurarla. Protocollo: [pilot-playbook.md](pilot-playbook.md).

## Riproducibilità del conteggio

Pacchetto consultato il 6 ottobre 2026: `Dati_RCS_cittadinanza_2025.zip`; SHA-256 del download: `c9c38b139ede112976d11eceabea280a59f53ca64567ca6f62e71fa8e24fa62a`. L'hash identifica questa versione, non una prova della sua data originaria di pubblicazione. CSV `Dati_cittadinanza_2025.csv`, UTF-8, separatore `;`.

```python
import csv

with open("Dati_cittadinanza_2025.csv", encoding="utf-8-sig", newline="") as f:
    rows = list(csv.DictReader(f, delimiter=";"))

italia = [r for r in rows if r["Codice Istat"] == "IT"
          and r["Codice stato di cittadinanza"] != "100"]
print(sum(int(r["Totale"]) for r in italia))  # 5371251
for r in sorted(italia, key=lambda r: int(r["Totale"]), reverse=True)[:16]:
    print(r["Stato di cittadinanza"], r["Totale"])
```

Escludere il codice cittadinanza `100` (Italia). Non sommare insieme Italia, regioni, province e comuni: sono aggregazioni sovrapposte. Per il territorio filtrare il singolo codice comunale prima di selezionare la cittadinanza.

_Ricerca di Codex (GPT-6.1 Sol)._
