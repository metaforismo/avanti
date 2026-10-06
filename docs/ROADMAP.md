# Stato e roadmap

Aggiornato al 6 ottobre 2026. Obiettivo: 2–3 CAF pilota in uso reale durante il picco ISEE di
gennaio 2027, misure condivise entro marzo, campagna 730 da aprile.

## Cosa c'è

**Cittadino** (mobile, 8 lingue con arabo RTL, nessun account)

- Ingresso dal QR dello sportello o dal link inviato dal CAF; avviso di trasparenza AI.
- Racconto libero, classificazione della pratica, intervista una domanda alla volta, nucleo
  familiare, fatti dedotti dal testo evidenziati e modificabili.
- Checklist per persona con "dove lo trovo", consigli per le foto, upload dal telefono con
  riduzione delle immagini e controllo automatico, ripresa in giorni diversi, invio e reinvio.

**Operatore**

- Coda con filtri, fascicolo con mancanti e problemi in cima, verifica voce per voce, visore
  documenti, richieste d'integrazione tradotte, note interne, export PDF/JSON, metriche misurate.
- Nuova pratica con link, QR (anche a schermo intero), WhatsApp/SMS bilingue; cartello A4.
- Tema scuro, pagina Aiuto, guida in `docs/guide/operatori.md`.

**Pratiche**: ISEE ordinario completo; assegno unico, 730 e permesso di soggiorno in beta; le
altre elencate come "in arrivo" (vedi `docs/research/`).

**Qualità**: test unitari (core, db, api, web), 7 test end-to-end Playwright, CI pronta
(ferma per il billing dell'account GitHub), revisioni del backend documentate nelle PR.

## In corso

- Quarto giro di correzioni del backend (`fix/backend-review-2`): ID stabili dei membri,
  inferenze sul nucleo, estrazione in ucraino/rumeno/arabo, anteprima PDF, pulizia via cron.
- Amministrazione per i piloti (`feat/admin-contracts` → backend): operatori con password
  temporanee, sportelli, parametri (baseline, validità link, conservazione), cambio password,
  cancellazione definitiva e conservazione automatica.

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
