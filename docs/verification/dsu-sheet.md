# Prospetto DSU: esclusioni dichiarate nell'intervista

Verifica del 6 ottobre 2026 sul branch `feat/dsu-sheet`.

## Rappresentazione

Le risposte booleane `false` producono `value: "Nessuno"` e
`source: { kind: "answer", questionId }`. Vale per `exempt_income`,
`foreign_income`, `foreign_assets`, `maintenance`, `self_employed`,
`disability`, `excluded_savings` e per il mutuo del singolo immobile.
La risposta negativa prevale anche su selezioni o documenti precedenti rimasti
nel fascicolo. Non significa importo fiscale zero o esclusione accertata dal CAF.

FC4 e FC5 mantengono i singoli campi: l'operatore può ritrovare la voce del
gestionale e la risposta che l'ha esclusa. FC7 escluso usa una sola riga, evitando
richieste di certificazione senza una disabilità dichiarata. I conteggi globali
`properties_count = 0` e `vehicles_count = 0` producono una sola riga per componente
in FC3 e FC6. `accounts_count = 0` sostituisce i campi del rapporto con una riga
di assenza, mantenendo separati patrimonio d'impresa e verifiche/calcoli CAF.
L'assenza di immobili esclude anche la relativa voce fondiaria in FC4;
`foreign_assets = false` esclude la voce fondiaria estera senza escludere immobili
italiani. I patrimoni esteri e i risparmi speciali sono indicati una volta per nucleo.

Una risposta `true` senza valori lascia `missing`, oppure `document` se la
certificazione è verificata. Una domanda non posta lascia `missing`.
Un componente senza beni attribuiti o non selezionato dopo un `true` globale
non viene trattato come se avesse risposto No. `income_present_<id>` resta
un'indicazione generale: non determina importi o condizioni legali FC4/FC8.

Le istruzioni generali su `Nessuno`, dati mancanti e documenti sono in `DsuSheet.notes`.
Le note identiche ripetute nella stessa sezione passano a `DsuSection.note`.
Il contratto aggiunge soltanto `note?: string`, per conservare queste indicazioni
senza duplicarle su ogni riga; l'export PDF le stampa prima dei campi.
Il frontend può leggere il nuovo campo senza altre modifiche al contratto.

## Demo prima/dopo

Il confronto usa **Persona Esempio 9**, `demo-case-9`, stato `ready`, ricreata
dal seed in un database in memoria con documenti fittizi e revisioni operatore.
La versione precedente del core (`e655c98`) sullo stesso input produceva 73 righe `missing`.
Il JSON aggiornato sostituisce il precedente esempio Persona Esempio 5 con
questa pratica, usando ID deterministici per una verifica riproducibile.

| Quadro     | Missing prima | Missing dopo |
| ---------- | ------------: | -----------: |
| B          |             5 |            5 |
| FC1        |            18 |           18 |
| FC2        |             6 |            4 |
| FC3        |            12 |            0 |
| FC4        |            16 |            0 |
| FC5        |             6 |            0 |
| FC6        |             2 |            2 |
| FC7        |             8 |            0 |
| **Totale** |        **73** |       **29** |

Restano indirizzo abitazione, campi anagrafici/di contatto non raccolti e rapporti
finanziari/mezzi non attribuiti alla madre. I 20 riferimenti documentali verificati
rimangono tali. Il nuovo prospetto contiene 30 righe `Nessuno`.

## Riproduzione

`packages/core/src/dsu-sheet.test.ts` verifica No/Sì/non risposta, conteggi zero,
mutui per immobile, documenti precedenti, membri non selezionati e note condivise.
`packages/api/src/dsu-sheet-demo.test.ts` confronta il fascicolo operatore con
`docs/verification/dsu-sheet-demo.json`, senza aprire il database locale.
`packages/api/src/export.test.ts` verifica valore di assenza e note di sezione nel PDF.

Per rigenerare il JSON dopo una modifica intenzionale:

```sh
AVANTI_DSU_PROOF_PATH="$PWD/docs/verification/dsu-sheet-demo.json" \
  pnpm --filter @avanti/api exec vitest run src/dsu-sheet-demo.test.ts
```

Validazione finale: `pnpm format:check`, `pnpm check` (15 task riusciti, inclusi
524 test core e 264 test API) e `pnpm build` verdi. Nessuna modifica a `apps/web/src`
o operazione Git di scrittura da parte del backend.
