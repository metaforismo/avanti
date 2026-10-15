# Chiedi al fascicolo: contratto e confini

15 ottobre 2026. Implementazione backend; nessuna UI o modifica a settings, queue,
cache e decisioni del copilota. `packages/contracts` cambia perché la UI necessita
schemi condivisi di input, risposta e cronologia; `Progress` conserva la stessa forma.

Sono state confrontate due forme: salvare l'intera chat in un JSON della pratica,
oppure una relazione di turni domanda/risposta. Il JSON della pratica richiederebbe
serializzazione e riscrittura dell'intera chat e mescolerebbe operatori e versione del
fascicolo. La relazione scelta isola operatore/pratica, indicizza le pagine e permette
la cancellazione con FK cascade. La chat non modifica `cases.updatedAt` e non entra
nei messaggi cittadino. FK anche sull'operatore, con cancellazione a cascata.

La superficie pubblica è `mountDossierAsk(app, services)`. Il percorso è:
contratti → `copilotDossier(dossierView(...))` → `dossierAskTask` → risoluzione dei
riferimenti → transazione con nuova autorizzazione, lock pratica e controllo versione.
Il core possiede solo il fallback puro `heuristicDossierAsk(dossier, question)`; il task
possiede prompt/schema/invarianti, il runtime esistente provider/budget/telemetria.
La correzione in `copilot-context.ts` rimuove anche i nomi file citati dai finding del
motore: togliere soltanto `documents.fileName` lasciava quei metadati nel prompt.

## API per la UI

Tutti i percorsi sono sotto `/api`, richiedono sessione operatore del CAF e per POST
l'Origin ammessa. Gli errori sono `ApiError` in italiano, nessun contenuto nei log.

- `POST /api/cases/:id/ai/ask`, `DossierAskRequest`:
  `{ question: string (3–1000), history?: { role: "user" | "assistant", content: string (1–5000) }[] (max 8) }`.
  Se history è omessa, il server carica gli ultimi quattro scambi di questo operatore,
  soltanto per la versione corrente. `[]` avvia una domanda senza contesto storico,
  senza cancellare gli scambi precedenti. Ogni contenuto della storia è dato non fidato.
- Risposta `DossierAskResponse`:
  `{ answer: string, evidence: Evidence[], citations: KnowledgeCitation[], engine: "ai" | "heuristic", suggestions?: string[] }`.
  L'implementazione include sempre 2–3 suggerimenti. `[1]`, `[2]` nel testo puntano
  agli elementi di `evidence` (indici da 1); `[fonte 1]` punta a `citations[0]`.
  `Evidence = { kind: "answer" | "document" | "checklist" | "finding", id, label }`.
  `KnowledgeCitation = { id, title, source, url: string | null }`.
  I riferimenti sono risolti dal fascicolo/corpus lato server: nessuna label o URL
  forniti dal modello. I riferimenti spuri sono scartati mantenendo quelli reali;
  ogni affermazione deve avere almeno un supporto reale, oppure essere un'astensione.
- `GET /api/cases/:id/ai/ask?beforeId=<id-opzionale>`, `DossierChatResponse`:
  `{ turns: { id, question, response: DossierAskResponse, createdAt, caseVersion }[], nextBeforeId: string | null }`.
  Ultimi 50 scambi, ordine cronologico nella pagina. Per caricare gli scambi precedenti
  usare nextBeforeId. Cursori di altri operatori/pratiche sono 404. I riferimenti storici
  descrivono `caseVersion`, possono essere superati: non sono riusati come fatti.
  I timestamp sono ISO UTC. GET/POST: `Cache-Control: private, no-store`.

Limite condiviso con la domanda normativa: 60 POST/ora per operatore (tutte le
pratiche); tetto IP fidato 6000/ora. 429 con Retry-After reale. Una modifica della
pratica durante l'AI restituisce 409 e non salva lo scambio; revoca/sessione scaduta
401/403, cancellazione 404. Nessuna transazione rimane aperta durante la rete.
Un retry di rete può creare un secondo turno: non c'è una chiave di idempotenza.

`dossier.ask` è reasoning, costituzione 1/prompt 2, OPERATOR_STYLE condiviso. Solo
fascicolo minimizzato, data del clock nel calendario Europe/Rome e fino a cinque estratti recuperati; domanda e
cronologia sono blocchi non fidati. Nessun file binario, contatto, nota interna o nome
file. Il modello non decide diritti/importi e non usa la storia come fonte. La base
normativa è il corpus locale, non una ricerca live né una certificazione delle regole
annuali. Una data ambigua richiede chiarimento.

Senza AI, budget o interruttore: `engine: heuristic`, elenco generale limitato di voci
mancanti/rifiutate e avvisi quando richiesto, dichiarando che non interpreta il filtro
per persona; altrimenti limite esplicito delle capacità locali. Nessun valore inventato. Per dossier o indice evidenze oltre 48.000 caratteri si usa il
fallback prima di chiamare il provider (motivo runtime `invalid_output`): non si
risponde da un JSON troncato mantenendo riferimenti a dati omessi.

Migrazione generata con `pnpm --filter @avanti/db exec drizzle-kit generate --name dossier_ask`:
`0019_dossier_ask.sql` e snapshot/journal. Da applicare prima di usare gli endpoint;
la numerazione può essere riallineata alla migrazione della sessione parallela.
La retention del fascicolo elimina i turni; l'audit `copilot.asked` conserva solo evento,
operatore e identificativi, secondo la retention audit esistente, senza domanda/risposta.

## Intervallo delle domande

`questionsRemaining` è una stima di pianificazione, non un limite teorico del catalogo.
I conteggi dichiarati prevalgono, inclusi i componenti ancora senza nome. Dove ignoti,
il massimo usa ipotesi di prodotto moderate: 3 persone, 3 rapporti finanziari, 2 immobili,
2 veicoli; il minimo mantiene i rami senza beni e il nucleo minimo noto. Non sono medie
statistiche, requisiti normativi o limiti agli input: famiglie e patrimoni maggiori sono
ammessi. Le risposte possono far crescere l'intervallo. `questionsTotal` resta 0 fino a
quando il numero è determinabile; nessun cambiamento al contratto della UI.
