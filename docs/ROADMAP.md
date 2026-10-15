# Stato e roadmap

Aggiornato al 15 ottobre 2026. Obiettivo: 2–3 CAF pilota in uso reale durante il picco ISEE di
gennaio 2027, misure condivise entro marzo, campagna 730 da aprile.

## Cosa c'è

**Cittadino** (mobile, 8 lingue con arabo RTL, nessun account)

- Ingresso dal QR dello sportello o dal link inviato dal CAF; avviso di trasparenza AI.
- Racconto libero, classificazione della pratica, intervista una domanda alla volta, nucleo
  familiare, fatti dedotti dal testo evidenziati e modificabili. Il racconto è capito anche senza
  AI in tutte le 8 lingue (parentela informale, negazioni, numeri in lettere, conti, banche,
  veicoli); le frasi della homepage sono un test di accettazione.
- Nessun vicolo cieco: se il racconto riguarda una pratica non ancora disponibile, l'assistente lo
  spiega e propone le altre; "ISEE per l'università" diventa ISEE ordinario con la richiesta
  universitaria.
- Avanzamento onesto ("ancora circa N domande"), layout verificato fino a 320px, registro
  coerente per lingua (Lei in francese e ucraino).
- Checklist per persona con "dove lo trovo", consigli per le foto, upload dal telefono con
  riduzione delle immagini e controllo automatico, ripresa in giorni diversi, invio e reinvio.

**Operatore**

- Coda con filtri, fascicolo con mancanti e problemi in cima, verifica voce per voce, visore
  documenti, richieste d'integrazione tradotte, note interne, export PDF/JSON, metriche misurate.
- Finché manca qualcosa il pulsante principale è "Chiedi integrazione"; segnare pronta una
  pratica incompleta chiede conferma.
- Prospetto DSU nell'ordine del modello, ogni campo con la sua fonte, pronto da copiare nel
  gestionale; mancanti raggruppati per persona; "Per iniziare" per il primo giorno di un CAF.
- Nuova pratica con link, QR (anche a schermo intero), WhatsApp/SMS bilingue; cartello A4.
- Tema scuro, pagina Aiuto, guida in `docs/guide/operatori.md`.

**Amministrazione** (responsabile del CAF)

- Operatori con password temporanea e cambio obbligatorio al primo accesso, reset,
  disattivazione; sportelli; parametri (baseline, validità dei link, conservazione).
- Cancellazione definitiva su richiesta dell'interessato e pulizia automatica a fine
  conservazione.
- Registro attività con export CSV, stato del sistema, avvisi via email (facoltativi), rapporto
  del pilota, verifica in due passaggi (anche obbligatoria), risposte rapide e promemoria.

**Pratiche**: ISEE ordinario completo; assegno unico, 730 e permesso di soggiorno in beta; le
altre elencate come "in arrivo" (vedi `docs/research/`).

**Qualità**: test unitari (core, db, api, web), test end-to-end Playwright (mobile e desktop) con controlli di
accessibilità axe (WCAG 2.2 AA) su sito, cittadino in arabo e bengalese e console in tema chiaro
e scuro; CI pronta (ferma per il billing dell'account GitHub); revisioni del backend documentate
nelle PR.

## In corso

- Staging su Vercel secondo `docs/DEPLOY.md`, in attesa del via libera (funziona anche sul piano
  Hobby con manutenzione giornaliera).
- Decisioni commerciali del fondatore in `docs/gtm/README.md` (sedi, budget pilota, soglie,
  prezzo da testare, promesse in landing).

## Fatto di recente (15 ottobre, sera): l'AI dentro il flusso

- Runtime AI unico per OpenRouter, OpenAI, Anthropic e AI Gateway: solo fornitori a
  conservazione zero, budget mensile per CAF, pagina admin con consumi; senza AI si va avanti con
  le regole (`docs/decisions/ai-platform.md`).
- Cittadino: intervista come conversazione con proposte da confermare, assistente, voce, controlli
  immediati sui documenti con «È giusto così»; emergenze riconosciute prima del modello con 112 e
  1522; numero di domande rimanenti che non sale più.
- Operatore: copilota con riepilogo e controlli incrociati, importi DSU letti dai documenti da
  confermare, bozze di risposta dalle fonti, priorità in coda, interruttori AI del CAF.
- Provato nel browser con il trasporto di produzione: otto difetti che le eval sintetiche non
  vedevano, tutti corretti; eval del copilota ora usa la configurazione reale.
- Interfaccia: componenti condivisi per avvisi, intestazioni, caricamenti e scelte; errori sempre
  annunciati; arabo corretto anche in coda e nei QR; pagina Accessibilità.

## Fatto di recente (15 ottobre)

- Prestazioni misurate prima di toccare: aprire una pratica passa da 842 a 103 ms, le schermate
  già viste si aprono subito, la coda carica le pratiche più vecchie prima di arrivare in fondo e
  scorre leggera anche con 650 righe; font della landing e della pagina dello sportello dimezzati;
  API più rapida all'avvio (da 939 a 656 ms) e verificata con 5.000 pratiche (`pnpm db:seed:volume`,
  `pnpm bench:api`).
- Verifica delle voci direttamente dal visore dei documenti, anche da tastiera (V, R, frecce): dopo
  ogni verifica si passa al prossimo documento da controllare.
- Risposte rapide per le richieste d'integrazione e promemoria automatici al cittadino che non ha
  ancora risposto (facoltativi, nella sua lingua, al massimo due).
- Revisione di sicurezza indipendente (`docs/verification/review-2026-10.md`): nessun problema
  critico o alto; corretta la revoca durante richieste in corso e la scadenza del link salvato sul
  dispositivo del cittadino. Da decidere: conservazione delle candidature pilota.
- Postgres reale: corretto un crash delle migrazioni che PGlite non mostrava; pool e timeout
  espliciti; prova di carico con 30 operatori e 200 cittadini senza errori né deadlock
  (`pnpm bench:load`, `docs/verification/load-postgres.md`).
- Dopo l'invio il cittadino trova il link per prenotare l'appuntamento e le indicazioni dello
  sportello; ricevuta email facoltativa, limitata per destinatario.
- Revisione dell'interfaccia: conferme prima di cambiare gli accessi di un operatore, focus e
  annunci per chi usa tastiera e lettori di schermo, rapporto del pilota con periodo nell'URL.

## Fatto di recente (14 ottobre)

- Rigenerare e rimandare il link al cittadino che l'ha perso; controlli scritti per l'operatore.
- Registro attività per l'amministratore (accessi anche falliti, esportazioni, cancellazioni),
  con CSV sicuro; un solo evento per finestra quando scatta il limite di accesso.
- Due operatori sulla stessa pratica non si sovrascrivono: la console mostra il cambiamento e
  lascia decidere; note e bozze non si perdono.
- PDF con nomi e testi in arabo e bengalese verificati; testi salvati senza caratteri di
  controllo né override bidirezionali.
- Ricerca go-to-market in `docs/gtm/`; landing più precisa su cosa fa Avanti e su come il
  lavoro prosegue nel gestionale.
- Campo password con mostra/nascondi e avviso Bloc Maiusc; "/" per cercare in coda.
- Stato del sistema per l'amministratore: database, archivio, AI (con le ultime 24 ore),
  manutenzione e coda spiegati in parole semplici, senza dati dei cittadini.
- Avvisi via email con outbox cifrata: richiesta d'integrazione al cittadino nella sua lingua,
  candidature pilota al team, e su scelta del CAF pratica pronta e riepilogo giornaliero agli
  operatori. Senza chiavi esterne restano nel log, senza dati personali.
- I pulsanti in caricamento mantengono il nome per i lettori di schermo.
- Verifica in due passaggi per gli operatori (app di autenticazione e codici di recupero),
  obbligatoria su scelta del CAF; l'amministratore sblocca chi perde il telefono.
- Rapporto del pilota per il responsabile del CAF: le tre soglie con esito onesto («dati
  insufficienti» sotto i 50 casi), numeri aggregati senza celle sotto 5, PDF e CSV.
- Lo stato del sistema dice anche se gli avvisi email partono davvero.

## Fatto di recente (6 ottobre)

- Audit di sicurezza e prestazioni per il pilota (`docs/SECURITY.md`,
  `docs/verification/pilot-hardening.md`): sessioni, link, upload, isolamento tra CAF, header.
- Limiti pensati per la sala d'attesa sullo stesso Wi-Fi; analisi dei documenti in background.
- Un'unica voce per catalogo e interfaccia: registro e glossario per lingua
  (`docs/decisions/citizen-copy.md`).

## Prima del pilota (ottobre–dicembre 2026)

| Area       | Cosa serve                                                                                           | Chi                     |
| ---------- | ---------------------------------------------------------------------------------------------------- | ----------------------- |
| Hosting    | Deploy di produzione (Vercel + Postgres in UE + Blob privato), dominio, backup                       | Team                    |
| AI         | Modello di produzione dopo eval su casi reali anonimizzati; contratti ZDR e regione UE dei fornitori | Team                    |
| AI         | «Quasi pronta» in ombra secondo `docs/decisions/threshold-automation.md`, se approvata               | Team + CAF              |
| Legale     | Accordo art. 28 con ogni CAF, DPIA, informativa nelle lingue dello sportello, registro trattamenti   | Team + consulente + CAF |
| Normativa  | Verifica delle regole ISEE 2027 quando escono modello e istruzioni definitive                        | Team + CAF              |
| Traduzioni | Revisione delle 7 lingue straniere da madrelingua, priorità bengalese e arabo                        | Mediatori dei CAF       |
| Misure     | Settimana di baseline in ogni CAF prima dell'avvio (vedi `docs/research/pilot-playbook.md`)          | CAF                     |
| Formazione | Un'ora con gli operatori, cartello in sala d'attesa, link nei messaggi                               | Team                    |

## Dopo il pilota

- Modello 730 completo per aprile 2027, poi RED e prestazioni INPS.
- Lingue successive suggerite dalla ricerca: albanese, cinese, urdu.
- Export verso i gestionali più diffusi nei CAF pilota (formato da definire con loro).
- Collegamento con Pino/ItaliaAperta: il cittadino che scopre un bonus può preparare la pratica
  direttamente e inviarla a un CAF partner.
