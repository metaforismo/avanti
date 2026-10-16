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
o il frontend. La UI esistente contiene checkbox e campagna; i nuovi controlli di revoca e gli
indicatori del promemoria vanno collegati ai contratti. Questo lavoro non aggiunge schermate.

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
  identico confine stretto. Il fascicolo sorgente non viene prorogato. Alla cancellazione
  per retention può sopravvivere esclusivamente il promemoria minimo descritto sotto;
  il nuovo fascicolo mantiene retention propria. Family-erasure include fascicoli,
  promemoria e notifiche.
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
La nuova pratica non dipende dalla sopravvivenza della sorgente. Il promemoria
minimo richiede ora la migrazione separata descritta sotto.

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

## Promemoria minimo alla retention (16 ottobre 2026)

**Decisione implementata nel backend; testi/informative e base del trattamento restano
bozze da approvare con CAF e legale/DPO.** Il default 180 giorni non cambia. Alla
retention, nella stessa transazione che elimina la pratica, `renewal_reminders`
conserva una sola riga per sorgente se è ISEE ordinario, ha un primo invio
(`submitted_at`), consenso esplicito con versione registrata e almeno email o telefono.
Non basta lo stato `ready` senza invio; non si presume una prova per i consensi
storici con sola data. Niente backfill.

Alternative valutate: mantenere un fascicolo svuotato in `cases` avrebbe confuso
scadenza del link, autorizzazione alla lettura, metriche e retention del fascicolo;
un archivio autonomo rende espliciti dati e scadenza. Si sceglie quindi la tabella
separata, senza un secondo stato campagna: avanzamento e idempotenza restano sul
rinnovo. `renewal-reminders.ts` possiede allowlist/TTL/cancellazione;
`renewal-consent.ts` possiede prova e revoca; `renewals.ts` unisce le due sorgenti.
Il core possiede proiezione minima, versioni e calcolo della scadenza senza I/O.

Dati ammessi: CAF, sportello, lingua, anno pratica, riferimento, contatto già fornito
(nome/cognome ed email/telefono), nucleo con soli ruoli, nomi/cognomi e anni di nascita,
data e identificatore del testo del consenso. **Niente CF**, data completa di nascita,
ID documentali, risposte economiche, documenti/metadati/file, messaggi o note.
Il CF non serve: la selezione usa ID sorgente e famiglia espliciti, senza match
anagrafico. Gli ID delle persone proposte vengono ricreati per il nuovo fascicolo.
Il gruppo famiglia opaco è mantenuto (o usa l'ID sorgente se non c'è un gruppo) per
revoca ed erasure; non è un indice di ricerca per nome/CF.

Unico ulteriore dato tecnico: hash del token sorgente, utilizzabile **solo per
revocare** via `PUT /api/c/:token/renewal-consent {consented:false}` dopo scadenza o
retention. Non abilita letture né un nuovo consenso e non viene restituito nelle API.
Il vecchio token in chiaro non viene conservato. Ruotare un link prima della retention
invalida l'hash precedente come prima.

Limite scelto: **pratica ISEE 2027 → campagna 2028 → fine del 31 marzo 2028,
Europe/Rome**, istante escluso `2028-03-31T22:00:00Z`. È una scelta applicativa
proporzionata per coprire il primo trimestre seguente, non un termine imposto da INPS.
La [fonte INPS verificata](../research/isee-renewals.md) conferma soltanto la validità
ISEE al 31 dicembre. Se la retention arriva dopo questo limite, non crea alcun
promemoria. GET/POST lo escludono immediatamente alla scadenza; il cron ne elimina
la riga al successivo passaggio, anche senza fascicoli da eliminare. Nessuna scadenza
mobile dall'ultima consultazione o dall'invito.

La campagna applica filtri, conteggi, cursore, tenant e audit comuni all'unione di
fascicoli eleggibili e promemoria attivi. `sourceCaseId` resta l'ID originario anche
dopo retention. La sorgente promemoria ha sempre conteggi documentali zero, nucleo
da confermare e nessun riuso file; conserva la prova del consenso nel rinnovo.
Il trasferimento al nuovo fascicolo non costituisce una nuova espressione di consenso.

Revoca cittadino e CAF (`PUT /api/cases/:id/renewal-consent` oppure
`PUT /api/renewals/:id/renewal-consent`, solo `{consented:false}`) eliminano
immediatamente tutti i promemoria del gruppo nel CAF e azzerano il consenso nelle
pratiche collegate, con data di revoca e audit tecnico. CAF agisce su richiesta del
cittadino e non può concedere consenso. Il dispatcher rivalida la preferenza prima
del provider; payload pendenti non più autorizzati vengono annullati al controllo
successivo secondo il ciclo outbox esistente. Nessun nuovo promemoria viene creato
dalle copie revocate. Retention, creazione campagna e revoca acquisiscono il lock CAF
prima dei lock pratica/promemoria. Un invio già completato non può essere richiamato.

`POST /api/cases/:id/family-erasure` accetta anche l'ID di una sorgente ormai presente
solo come promemoria, con riferimento e conferma, ed elimina il gruppo. La cancellazione
su richiesta di un fascicolo ancora conservato elimina anche i promemoria del gruppo;
nessuna cancellazione su richiesta ne crea uno. La richiesta elimina anche il consenso
nelle copie conservate del gruppo, impedendo ricreazioni successive. Audit pseudonimo e retry dei file
seguono le durate già documentate, senza conservare il payload del promemoria.

Prova del consenso: `RENEWAL_CONSENT_VERSIONS` e snapshot immutabile
`RENEWAL_CONSENT_TEXT_V1` nel core identificano checkbox **e hint** per lingua come
`isee-renewal-email:<lingua>:1`. Submit e PUT espliciti registrano data/versione;
non il testo integrale nel DB. Cambiare un testo richiede nuova versione e snapshot.
Audit: `renewal.consent_updated`, boolean `consented`, `consentTextVersion:1` e
`consentLanguage` (indice di `Language.options`), senza testo, nomi, contatti o hash.
La revoca di un promemoria resta nell'audit scollegato dal fascicolo eliminato.
Questo prova l'azione sulla capability e la versione associata dal server, non
l'identità civile né da solo l'effettiva lettura dell'informativa. L'informativa deve
esplicitare il promemoria e la rappresentanza per i familiari va valutata dal CAF.

Contratti modificati perché la UI deve distinguere sorgenti, scadenza e possibilità
di revoca: nuovi campi in `RenewalItem` e `CitizenCase`, schema CAF di sola revoca;
`EraseFamilyResponse` ammette zero fascicoli quando cancella solo promemoria e riporta
`deletedReminders` quando presenti. `RenewalReminderMember` è l'allowlist zod condivisa
tra core e DB; i nuovi campi numerici di `AuditDetails` rendono leggibile la prova
senza ammettere testi personali nell'audit. Nessuna modifica al frontend.

Migrazione **`0024_renewal_retention_reminders` generata con drizzle-kit**; SQL,
snapshot e journal insieme. Numero provvisorio: la PR metering usa già 0024 e sarà
riallineato dall'utente. Aggiunge tabella/indici/FK tenant-sportello, CHECK lingua,
anno e limite scadenza, più versione e data revoca su `cases`. Nessuna modifica alle
migrazioni precedenti.

L’export organizzazione include i promemoria del solo CAF, escludendo sempre l’hash
di revoca. Il formato rimane versione 1 con campo additivo `renewalReminders`.

### Verifica locale del promemoria minimo

- **PASS** `TURBO_CACHE_DIR=.turbo/cache pnpm check --concurrency=2`: 18 task,
  1.562 test passati e 38 opzionali saltati; API 692, core 695, DB 43, AI 85, web 47.
- **PASS** 20 test nuovi (14 API, 6 core), più regressioni aggiornate per export e
  schema. Coperti consenso assente/storico, ISEE non inviato, allowlist senza CF/data
  completa, revoca prima/dopo retention e concorrente, canali CAF di sola revoca,
  campagna mista con paginazione, scadenza Roma anche prima del cron, isolamento,
  erasure con/senza fascicoli e mancata ricreazione dopo cancellazione su richiesta.
- **PASS** `TURBO_CACHE_DIR=.turbo/cache pnpm build`: 3 task e Next.js produzione.
  Preflight locale con fallback senza chiavi; `drizzle-kit generate` successivo non
  rileva differenze schema/snapshot.
- **NOT RUN** PostgreSQL nativo, browser e provider email reale in questa attività.
  Le prove concorrenti PGlite non sostituiscono lock su connessioni PostgreSQL distinte.
