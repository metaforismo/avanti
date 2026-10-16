# Campagna rinnovi ISEE

## Contratto scelto

L'operatore seleziona le pratiche nell'elenco `GET /api/renewals?year=YYYY`, crea il
lotto con `POST /api/renewals {sourceCaseIds,year}`, condivide i link restituiti una
volta. Il cittadino vede il nucleo precedente e conferma/modifica la lista usando
`POST /api/c/:token/turn {type:"answer",questionId:"members",value:[...]}`.
Contratti, stati, esempi e limiti esatti in [API.md](../API.md#campagna-rinnovi-isee).

La [ricerca INPS/Ministero](../research/isee-renewals.md) conferma validità fino al
31 dicembre dell'anno DSU, nucleo attuale e redditi/patrimoni del secondo anno
precedente. Gli anni futuri sono una proiezione della regola generale, non la
certificazione delle istruzioni annuali. Il catalogo versionato deve essere ricontrollato.

## Alternative e scelta

1. Tabella campagna/invito indipendente, FK verso sorgente e rinnovo, stato materializzato.
   Richiederebbe coordinare tre cicli di conservazione, scollegamenti della sorgente
   e sincronizzazione dello stato con le mutazioni di pratica e outbox.
2. Provenienza e timestamp sulla nuova pratica, stato derivato, outbox esistente.
   Scelta: il fascicolo contiene già famiglia, risposte, lingua e scadenza; l'outbox
   possiede cifratura, idempotenza email e retry. Non aggiungere una seconda macchina
   a stati riduce i casi incoerenti dopo una cancellazione o una richiesta di integrazione.

Confini dei moduli: `renewals.ts` possiede selezione/coorte, creazione atomica e
rigenerazione; `createReusedCase` e `eligibleReuseDocuments` in `family-reuse.ts`
sono condivisi con il riuso ordinario. Il core espone `renewalPending`,
`renewalQuestion`, `renewalNotice` e applica il blocco alla prima domanda nel catalogo;
nessun I/O o clock implicito. `renewal-consent.ts` gestisce preferenza e revoca nel
gruppo. `notifications.ts` accoda e rivalida l'invito, `renewal-copy.ts` rende l'email.

Le modifiche a `packages/contracts` sono necessarie per rendere espliciti filtri,
conteggi, idempotenza senza segreto, fase cittadino e consenso/preferenza. I campi
cittadino sono additivi/opzionali per i consumer esistenti; la nuova preferenza è
false per default e un PATCH parziale la conserva. Non vengono modificati `near-ready*`
o il frontend. La UI deve collegare i contratti documentati: questo lavoro non
aggiunge schermate.

## Integrità e privacy

- Sorgenti: ISEE ordinario ready/submitted dell'anno precedente. Usa l'anno esplicito
  della pratica, con il default storico 2027, non la data di creazione. Nessuna ricerca
  automatica o fusione per nome/CF. Il CF mancante non impedisce il riuso esplicito.
- `family_id` opaco persiste autonomamente. `renewal_source_id` è una provenienza
  tecnica senza FK: cancellare la sorgente non distrugge o rende illeggibile il rinnovo.
- Indice univoco CAF/sorgente/anno; la transazione prende il lock CAF `NO KEY UPDATE`
  prima dell'autorizzazione e delle sorgenti ordinate. Esclude riuso concorrente e
  family-erasure durante il controllo CAF/famiglia/anno. Anche un ISEE dell'anno nuovo
  già creato col riuso ordinario impedisce doppioni. Più sorgenti della stessa famiglia
  nel lotto possono quindi restituire lo stesso rinnovo; solo la prima crea il link.
- `answers.renewal_household_confirmed=false` è un marcatore controllato dal motore:
  solo una risposta cittadino valida a `members` lo risolve. L'operatore prepara il
  fascicolo ma non conferma il nucleo. Rimangono gli ID delle persone confermate;
  documenti delle persone uscite o con identità modificata sono scollegati/nascosti
  dai controlli esistenti. Le risposte economiche annuali non sono copiate.
- Gli stessi documenti eleggibili del riuso restano conservati con valutazione nuova:
  scaduti e annuali vecchi sono da aggiornare, incerti da verificare. Non diventano
  documenti validi o revisioni approvate per la sola copia. Visibilità pregressa degli
  altri componenti non si propaga; nessuna nuova copia fisica dei file.
- Retention usa lo stesso predicato della cancellazione, anche prima del cron, con
  identico confine stretto. La campagna non estende la conservazione della sorgente.
  Con 180 giorni molti fascicoli di gennaio precedente saranno già cancellati: la
  campagna lavora soltanto sui dati legittimamente ancora conservati. La retention del
  nuovo fascicolo è indipendente; family-erasure include entrambi e le notifiche.
- Link mostrato una volta, hash nel DB. Un retry non può ricostruirlo. Solo
  `regenerateLinks:true` può ruotarlo; il token precedente nell'outbox viene respinto
  confrontando `citizen_link_hash` con la capability corrente. `queued` e `invited`
  non attestano consegna email. `started` richiede conferma del nucleo, `submitted`
  segue il primo invio e non torna indietro con le integrazioni.
- Inviti solo con preferenza CAF e consenso cittadino dedicato, mai dedotto dalla
  privacy o da un'email presente. Nessun backfill. Revoca nella famiglia sotto lock
  CAF; il dispatcher la controlla prima del provider. Il payload con link/email è
  solo nell'envelope cifrato, soggetto alle stesse scadenze e retry dell'outbox.
- Audit senza dati personali o capability, quote operatore e quota destinatario
  canonico condivisa tra tenant. Il consenso esplicito all'invio email è una scelta
  applicativa, non una valutazione legale della base giuridica del CAF.

## Migrazione

Unica migrazione `0023_isee_renewals`, generata con
`pnpm --filter @avanti/db exec drizzle-kit generate --name=isee_renewals`;
numero da riallineare al merge. Cinque colonne nullable su `cases`, preferenza
CAF false, hash capability su `notifications`, indici e CHECK coerenti. Nessun
backfill dei dati personali o del consenso, nessuna modifica alle migrazioni precedenti.
La nuova pratica non dipende dalla sopravvivenza della sorgente; non serve una
migrazione per riscrivere i collegamenti al momento della cancellazione.

## Verifica e limiti

`renewals.test.ts` esercita il vero handler Hono con DB PGlite isolato e file in memoria:
coorte/paginazione, nucleo cambiato e senza CF, scaduti/anno sbagliato, visibilità,
richieste concorrenti, rigenerazione, altro CAF, token scaduto, arabo, consenso e
revoca, cifratura, retention e cancellazione famiglia. `renewal.test.ts` esercita il
blocco e le domande annuali nelle otto lingue. `family-reuse.test.ts` mantiene la
regressione del riuso ordinario.

Prova nativa della stessa suite: impostare `RENEWALS_TEST_DATABASE_URL` a un database
Postgres loopback vuoto con suffisso `_test` e lanciare soltanto
`pnpm --filter @avanti/api exec vitest run src/renewals.test.ts`. Il test esegue
`TRUNCATE` nel DB isolato fra i casi. In questa sessione la prova nativa è BLOCKED:
`initdb` fallisce su `shmget` con `Operation not permitted`; directory temporanea rimossa.
La prova concorrente PGlite verifica l'idempotenza osservabile, non sostituisce
la verifica dei lock su PostgreSQL con connessioni indipendenti. Nessun invio reale
Resend o browser UI eseguito.

I conteggi per stato sono disponibili nella campagna. Il rapporto pilota resta
invariato: aggiungere la nuova dimensione richiede coordinare la soppressione
complementare delle celle piccole e le esportazioni PDF/CSV. Non si aggiunge un
conteggio grezzo a un rapporto che oggi applica protezioni statistiche.

## Esito locale del 16 ottobre 2026

- **PASS** `TURBO_CACHE_DIR=.turbo/cache pnpm check --concurrency=2`: tutti i 18 task,
  1.510 test passati e 23 test opzionali PostgreSQL saltati. API: 50 suite verdi,
  659 test passati; core: 676; DB: 43; AI: 85; web: 47.
- **PASS** 26 test nuovi: 17 API e 9 core; include intervista cittadino completa fino
  al primo invio. La prima verifica completa aveva individuato una forma di cortesia
  ucraina minuscola, corretta rispettando il registro esistente; il controllo dedicato
  e il successivo check completo sono verdi.
- **PASS** `TURBO_CACHE_DIR=.turbo/cache pnpm build`: tutti i 3 task di build e Next.js
  produzione. Preflight locale con fallback senza chiavi; nessuna prova di deployment.
- **PASS** `git diff --check`; nessuna modifica a `apps/web/src` o `near-ready*`,
  nessun file staged, nessun commit. HEAD resta `7387f43`, ramo `codex/renewals`.
- **PASS** pulizia successiva dei soli artefatti del worktree: `apps/web/.next`,
  `.turbo` radice e `.turbo` dei pacchetti/app. Cartelle condivise con altri worktree,
  dipendenze e dati locali conservati. Prima della rimozione: circa 275 MiB di `.next`
  e 16 MiB di cache Turbo radice; non è una misura dello spazio fisico APFS recuperato.
- **BLOCKED** PostgreSQL nativo per il limite `shmget` del sandbox, come sopra;
  **NOT RUN** email provider reale e verifica browser UI.
