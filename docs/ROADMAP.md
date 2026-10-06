# Stato e roadmap

Aggiornato al 6 ottobre 2026. Obiettivo: 2–3 CAF pilota in uso reale durante il picco ISEE di
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
- Nuova pratica con link, QR (anche a schermo intero), WhatsApp/SMS bilingue; cartello A4.
- Tema scuro, pagina Aiuto, guida in `docs/guide/operatori.md`.

**Amministrazione** (responsabile del CAF)

- Operatori con password temporanea e cambio obbligatorio al primo accesso, reset,
  disattivazione; sportelli; parametri (baseline, validità dei link, conservazione).
- Cancellazione definitiva su richiesta dell'interessato e pulizia automatica a fine
  conservazione.

**Pratiche**: ISEE ordinario completo; assegno unico, 730 e permesso di soggiorno in beta; le
altre elencate come "in arrivo" (vedi `docs/research/`).

**Qualità**: test unitari (core, db, api, web), test end-to-end Playwright (mobile e desktop) con controlli di
accessibilità axe (WCAG 2.2 AA) su sito, cittadino in arabo e bengalese e console in tema chiaro
e scuro; CI pronta (ferma per il billing dell'account GitHub); revisioni del backend documentate
nelle PR.

## In corso

- Staging su Vercel secondo `docs/DEPLOY.md` (in attesa del via libera: il cron di manutenzione
  al minuto richiede il piano Pro), con Postgres e Blob in UE e `pnpm db:check` sul database reale.

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
| AI         | Scelta del fornitore via AI Gateway con regione UE e zero data retention; prova su documenti fittizi | Team                    |
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
