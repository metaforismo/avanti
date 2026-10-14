# Casi limite e affidabilità — Avanti

Verifica locale del 14 ottobre 2026, worktree `.worktrees/edge-cases`, branch
`codex/edge-cases`, base `fe12b4c`. Dati sintetici; database PostgreSQL WASM
(PGlite), storage in memoria e fallback AI. Nessuna modifica al frontend,
commit, push, merge o deploy. I test API chiamano gli handler Hono reali.

`Risolto` indica una regressione riprodotta prima della correzione e poi verde.
`Già OK` indica un comportamento esistente verificato con test.
`Aperto` identifica la parte di prova o integrazione ancora necessaria.

## Inventario: caso → comportamento → test

I file test abbreviati nella tabella sono in `packages/api/src`, salvo `core/`
che indica `packages/core/src`. I titoli riportati individuano i test senza
fare affidamento sui numeri di riga.

| Caso                                                   | Stato                                      | Comportamento verificato                                                                                                                                     | Test                                                                                                                                                |
| ------------------------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Due operatori modificano le note dalla stessa versione | Risolto backend; aperto UI                 | Un solo successo; seconda scrittura 409 `conflict`, nota vincente conservata                                                                                 | `edge-cases.test.ts`: `operators: rejects stale notes`                                                                                              |
| Due operatori cambiano lo stato dalla stessa versione  | Risolto backend; aperto UI                 | Un solo successo, nessuna seconda transizione/audit                                                                                                          | `edge-cases.test.ts`: `operators: rejects stale status`                                                                                             |
| Due operatori cambiano assegnatario                    | Risolto backend; aperto UI                 | Un solo successo; assegnatario vincente conservato                                                                                                           | `edge-cases.test.ts`: `operators: rejects stale assignment`                                                                                         |
| Verifica/rifiuto della stessa voce                     | Risolto backend; aperto UI                 | Una sola decisione persistita; perdente 409, niente sovrascrittura                                                                                           | `edge-cases.test.ts`: `operators: verification and rejection`                                                                                       |
| Richiesta di integrazione dopo una traduzione lenta    | Risolto backend; aperto UI                 | Ricontrollo versione dopo AI, sotto lock; nessun messaggio/revisione parziale                                                                                | `edge-cases.test.ts`: `operators: a request translated from a stale dossier`                                                                        |
| Versione mancante, clock fermo o tornato indietro      | Risolto                                    | Omissione 409; `updatedAt` cresce almeno di 1 ms; offset equivalenti accettati                                                                               | `edge-cases.test.ts`: `operators: rejects stale`, `operators: an equivalent offset timestamp`                                                       |
| Analisi background modifica il fascicolo già letto     | Risolto                                    | Completamento/errore dell'analisi aggiorna la versione, invalida la scrittura vecchia                                                                        | `edge-cases.test.ts`: `operators: background analysis invalidates`; `document-recovery.test.ts`                                                     |
| Verificare una voce con documento `processing`         | Risolto                                    | 409 con invito ad attendere, nessuna revisione salvata                                                                                                       | `edge-cases.test.ts`: `operators: a processing document cannot be verified`                                                                         |
| Doppio invio simultaneo / doppio tap su invio          | Già OK                                     | Uno 200 e uno 409; unico evento di invio, contatto e data del primo invio conservati                                                                         | `edge-cases.test.ts`: `citizen: parallel double submit`                                                                                             |
| Invio mentre il body/file è in upload                  | Risolto                                    | Lease persistito prima della lettura multipart, 409 anche da un'altra istanza API                                                                            | `edge-cases.test.ts`: `citizen: submit is blocked during storage upload`; `documents: an interrupted multipart upload`                              |
| Invio mentre l'analisi è in corso                      | Risolto                                    | 409 fino all'uscita da `processing`; invio possibile dopo analisi                                                                                            | `edge-cases.test.ts`: `citizen: submit is blocked during storage upload`                                                                            |
| Link scade durante l'intervista                        | Già OK                                     | 410 `link_expired` prima della scrittura; risposte e chat non alterate                                                                                       | `edge-cases.test.ts`: `citizen: link expires during interview`; `link-regeneration.test.ts`: `revokes a turn waiting for AI`                        |
| Link scade o viene sostituito durante upload           | Già OK                                     | 410; nessun documento committato; file rimosso o tombstone nel retry                                                                                         | `edge-cases.test.ts`: `citizen: link expires during upload`; `link-regeneration.test.ts`: upload in corso, anche cleanup fallito                    |
| Cambio lingua a metà                                   | Già OK                                     | Cambiano i testi derivati; risposte, UUID, documenti e abbinamenti conservati                                                                                | `edge-cases.test.ts`: `citizen: switching language`; `app.test.ts`: intervista con cambio ad arabo                                                  |
| Risposta modificata dopo invio con integrazione aperta | Già OK                                     | `needs_citizen` e rifiuti applicabili conservati; domande dipendenti riaperte; primo invio non riscritto                                                     | `edge-cases.test.ts`: `citizen: changing an answer with an open integration`; `app.test.ts`: `9,11,28,29`                                           |
| Familiare rimosso con documenti/revisioni              | Già OK                                     | Documenti conservati senza abbinamento; revisione rimossa; UUID dei superstiti conservati                                                                    | `app.test.ts`: `1: IDs are stored, preserved through edit and removed members lose documents/reviews`                                               |
| Nucleo da 1 a 20 persone                               | Già OK                                     | Tutte le 20 dimensioni ammesse; ID univoci, voci identità e titolarità corrette                                                                              | `core/edge-cases.test.ts`: `household: %i members`                                                                                                  |
| Nucleo 0, 21, frazioni, NaN/Infinity                   | Già OK                                     | Errore di dominio; nessun elenco incoerente                                                                                                                  | `core/edge-cases.test.ts`: `household: rejects count`                                                                                               |
| Testi lunghissimi                                      | Già OK                                     | Limiti: testo/risposte 2.000 unità UTF-16, nomi 80, note cittadino 1.000, operatore 5.000; input eccessivi rifiutati                                         | `core/edge-cases.test.ts`: `text: bounds long input`; `app.test.ts`: validazione richieste                                                          |
| Emoji e nomi arabi/bengalesi                           | Già OK dati; risolto PDF                   | Unicode conservato, coppie surrogate valide ammesse; PDF usa fallback esplicito per simboli non presenti nei font                                            | `core/edge-cases.test.ts`: `text: preserves Unicode`; `export.test.ts`: `edge PDF`                                                                  |
| Spazi e maiuscole nei nomi                             | Già OK                                     | Trim ai bordi, maiuscole originali conservate; confronto titolare normalizzato per spazi/case/ordine token                                                   | `core/edge-cases.test.ts`: `names: ignores spaces, case and token order`                                                                            |
| Controlli C0/C1, override/isolate bidi                 | Risolto                                    | 400 alla validazione, prima di persistenza; newline/tab ammessi nei testi, non nei nomi; joiner Indic conservati                                             | `core/edge-cases.test.ts`: `text: rejects unsafe controls`; `text: bounds long input`                                                               |
| Surrogate UTF-16 isolate                               | Risolto                                    | Input rifiutato prima che PostgreSQL JSONB lo trasformi in un errore interno; emoji valide restano ammesse                                                   | `core/edge-cases.test.ts`: `text: rejects unpaired UTF-16 surrogates`                                                                               |
| Controlli restituiti dal modello nella traduzione      | Risolto                                    | Output validato; fallback localizzato, nessun NUL nella chat                                                                                                 | `ai.test.ts`: `edge: unsafe controls in model translations`                                                                                         |
| Stesso file caricato due volte                         | Già OK                                     | Entrambi gli originali restano scaricabili; duplicato segnalato nella stessa voce, non contato due volte; stesso file su requisiti distinti ammesso          | `edge-cases.test.ts`: `documents: duplicate bytes`; `core/review.test.ts`: `shared bank statement counts for separate requirements`                 |
| File da 0 byte                                         | Già OK                                     | 415 `unsupported_file` prima di storage/AI                                                                                                                   | `edge-cases.test.ts`: `documents: zero bytes and encrypted PDFs`                                                                                    |
| PDF cifrati / con password                             | Già OK                                     | Presenza `/Encrypt` rifiutata con 415 dal parser; nessun tentativo di aggirare la protezione                                                                 | `edge-cases.test.ts`: `documents: zero bytes and encrypted PDFs` (fixture PDF sintetica con dizionario Encrypt)                                     |
| Immagine ruotata EXIF                                  | Già OK backend; aperto browser             | JPEG sintetico 2×3 con EXIF Orientation=6 scaricato byte per byte senza eliminare EXIF. Il client usa già `imageOrientation: from-image` per la compressione | `edge-cases.test.ts`: `documents: EXIF orientation`; fixture `fixtures/rotated-exif.jpg`. Orientamento visivo su telefoni/browser ancora da provare |
| HEIC                                                   | Già OK fallback; aperto file reale/browser | Metadati BMFF entro limiti, byte preservati; nessuna chiamata vision, fallback euristico e verifica umana                                                    | `edge-cases.test.ts`: `documents: HEIC headers`; `ai.test.ts`: `13: HEIC never reaches vision`. La fixture BMFF non è una fotografia decodificabile |
| Nome file con path, controlli, alfabeti non latini     | Già OK                                     | Nome sanificato, estensione dal MIME rilevato, `filename*` UTF-8, download attachment; nessuna modifica ai byte                                              | `edge-cases.test.ts`: `documents: duplicate bytes`; `pilot-upload.test.ts`; `storage.test.ts`                                                       |
| Upload multipart interrotto                            | Risolto lease                              | 400 senza documento; reservation rimossa, invio successivo possibile                                                                                         | `edge-cases.test.ts`: `documents: an interrupted multipart upload`                                                                                  |
| Host terminato / errore ambiguo di put                 | Già OK cleanup; esteso lease               | Tombstone persistito prima di ogni I/O; cron ritenta la cancellazione; un upload oltre il lease non può committare                                           | `pilot-upload.test.ts`: `total byte quota ... storage failures`; `edge-cases.test.ts`: `documents: an upload past its durable lease`                |
| Quote/saturazione upload                               | Già OK                                     | 4 MiB/file, 60 documenti, 120 MiB/fascicolo sotto lock; quinto upload per istanza riceve 429, altra pratica resta libera                                     | `pilot-upload.test.ts`; `app.test.ts`                                                                                                               |
| Fuso Europe/Rome e ora legale                          | Già OK                                     | Giorni civili di Roma; intervalli metriche di 23/25 ore, senza confondere giorno UTC                                                                         | `routes.test.ts`: `6: Rome calendar metrics`; `core/edge-cases.test.ts`: `keeps the Rome day through the clock change`                              |
| 31 dicembre / 1 gennaio, riferimenti ISEE              | Già OK, catalogo vincolato al 2027         | Cambio anno locale a 23:00 UTC in inverno; catalogo 2027 mantiene riferimento 2025, dal 2028 blocker; nessuna invenzione di istruzioni annuali               | `core/edge-cases.test.ts`: `keeps the catalog reference year explicit`; fonte già presente in `docs/research/isee-2027.md`                          |
| Scadenza documenti                                     | Già OK                                     | Valido per tutta la data civile di scadenza di Roma; scaduto dal giorno seguente; avviso entro 90 giorni                                                     | `core/edge-cases.test.ts`: `expiry is inclusive through the Rome date`; `operator-findings.test.ts`                                                 |
| Export PDF arabo RTL e bengalese                       | Già OK font/script                         | NotoSans/NotoSansArabic/NotoSansBengali inclusi; shaping nei run; PDF riaperto con parser, font incorporati confermati con `pdffonts`                        | `export.test.ts`: tutte le lingue + `edge PDF`; rendering Poppler delle quattro pagine ispezionato                                                  |
| Export PDF con testi lunghi / 20 persone               | Già OK wrapping; risolto fallback glifi    | Paginazione A4, parole lunghe spezzate per grafemi, margini misurati per ogni drawText; nessun glifo mancante                                                | `export.test.ts`: `paginates long checklists`, `edge PDF`, `newline remains a paragraph break`; PDF/PNG sintetici in `edge-cases-pdf/`              |
| Zero pratiche                                          | Già OK                                     | Conteggi 0, liste vuote, tassi/medie null; nessun NaN/Infinity                                                                                               | `edge-cases.test.ts`: `metrics: zero practices`                                                                                                     |
| Periodo senza dati                                     | Già OK                                     | Serie giornaliera completa con 0 per ogni giorno; medie/tassi null                                                                                           | `edge-cases.test.ts`: `metrics: a period without data`                                                                                              |
| Operatore disattivato nelle metriche                   | Già OK                                     | Misure storiche conservate indipendentemente dall'accesso dell'operatore                                                                                     | `edge-cases.test.ts`: `metrics: deactivation keeps historical measurements`                                                                         |
| Pratiche cancellate nelle metriche                     | Già OK                                     | Pratica ed eventi personali esclusi dagli aggregati; solo audit anonimo della cancellazione sopravvive                                                       | `edge-cases.test.ts`: `metrics: deactivation keeps historical measurements`; `administration.test.ts`                                               |
| Ultimo admin si disattiva / declassa                   | Già OK                                     | Self-deactivation/demotion 409; azioni admin serializzate per CAF, sempre almeno un admin attivo                                                             | `administration.test.ts`: `rejects self-demotion`, `serializes competing admins`                                                                    |
| Email operatore con maiuscole                          | Già OK                                     | Trim/lowercase prima di login/creazione; duplicati normalizzati 409                                                                                          | `administration.test.ts`: operator provisioning/duplicate email; `app.test.ts`: autenticazione                                                      |
| Sportello rinominato con QR stampati                   | Già OK                                     | Slug non modificabile via update; vecchio link pubblico mostra nuova sede                                                                                    | `administration.test.ts`: `preserves the printed QR after edits`                                                                                    |

## Contratto e integrazione della console

`packages/contracts` cambia per due motivi: validare testi sicuri prima del DB
(incluso output AI) e rappresentare `expectedUpdatedAt` sulle tre scritture del
fascicolo: PATCH pratica, POST revisione voce, POST richiesta di integrazione.

Il client deve inviare la versione del fascicolo che **ha letto**, senza recuperare
una nuova versione automaticamente prima di salvare. Versione assente o superata:
409 `conflict`, «La pratica è cambiata. Ricarica il fascicolo e controlla le modifiche
prima di riprovare.». Nessuna mutazione o audit della decisione perdente. Il
controllo avviene sotto il lock della pratica e di nuovo dopo un'eventuale traduzione.

Il campo è opzionale nei DTO TypeScript/Zod per permettere la compilazione della
console esistente e restituire un conflitto esplicito all'omissione; **non è opzionale
per ottenere una scrittura riuscita**. Questo è un cambio comportamentale dell'API.
Non servono migrazioni: si riutilizza `updatedAt`, reso monotono per tutte le scritture
rilevanti, incluse modifiche cittadino, documenti, analisi e rotazione link.

**Aperto prima del pilota:** la console attuale in
`apps/web/src/components/console/dossier/dossier-view.tsx` e nei suoi hook deve
aggiungere `expectedUpdatedAt: dossier.updatedAt` a update/review/request. Su 409
va conservata la bozza, ricaricato il fascicolo e richiesta una decisione esplicita
dell'operatore. Non fare retry ciechi. Qui non è stato modificato `apps/web/src`.
I fixture dei vecchi test modellano una lettura aggiornata; i nuovi test di
concorrenza mantengono invece deliberatamente lo snapshot vecchio.

## Upload e recupero

La tabella di cancellazioni già esistente ospita reservation con ID `upload:<UUID>`
e deadline di 10 minuti, create sotto il lock della pratica **prima** di consumare
il body. L'invio controlla reservation vive e documenti `processing`, anche tra
istanze diverse. Errori di parsing eliminano la reservation; put ambiguo conserva
il tombstone per il recupero. Una reservation scaduta non consente un commit tardivo.
Il limite di 4 upload simultanei resta per pratica/istanza, non un limite distribuito.

Il test EXIF usa un JPEG reale sintetico, generato da un PNG 2×3 con `sips`, con
un IFD EXIF Orientation=6 aggiunto al fixture. La generazione HEIC via `sips` è
fallita nel sandbox (`kIOSurfaceMethodSetCoreVideoBridgedKeys` / errore 13).
Non sono stati installati codec o scaricati font. Restano aperti la decodifica di
una fotografia HEIC reale e l'orientamento visivo nei browser dei telefoni del pilota.

## PDF e limiti della prova

Due fascicoli sintetici con 20 membri, testi arabi/bengalesi lunghi, parole senza
spazi ed emoji: `edge-cases-pdf/edge-ar.pdf` e `edge-bn.pdf`, con PNG delle due
pagine per lingua. `pdffonts` conferma `emb=yes`, `uni=yes`. Poppler ha renderizzato
le quattro pagine; ispezione visiva di nomi, script, margini e footer completata.
I simboli assenti dai font sono rappresentati come `[U+1F642]` ecc.; il JSON
mantiene gli originali. Non sono state aggiunte dipendenze o font.

Questa è una prova locale di layout/shaping, non una certificazione linguistica.
La lettura da parte di operatori/cittadini madrelingua e la verifica sul deployment
pilota restano prove esterne. Le regole annuali ISEE sono quelle documentate in
[isee-2027.md](../research/isee-2027.md); non sono state introdotte nuove norme.

## Verifica riproducibile

```sh
pnpm --filter @avanti/core exec vitest run src/edge-cases.test.ts
pnpm --filter @avanti/api exec vitest run src/edge-cases.test.ts src/export.test.ts src/ai.test.ts
pnpm check --concurrency=2 --cache-dir=.turbo/cache
pnpm build --concurrency=2 --cache-dir=.turbo/cache --cache=local:,remote:
```

Per rigenerare i PDF di prova impostare `AVANTI_PDF_PROOF_DIR` all'interno di
questo worktree ed eseguire `export.test.ts`; renderizzare con
`pdftoppm -scale-to 1200 -png <pdf> <prefisso>`. Il comando genera anche altri
campioni della suite: conservare soltanto i due `edge-*` per questa verifica.

Esito finale: **PASS** `pnpm check --concurrency=2 --cache-dir=.turbo/cache
--cache=local:,remote:`: 15 task riusciti, nessun risultato da cache; 939 test
passati (303 API, 572 core, 39 web, 25 DB), 5 test PostgreSQL esterno saltati
per assenza di `AVANTI_TEST_DATABASE_URL`. Aggiunti **74 casi di test**.

**PASS** l'unica `pnpm build --concurrency=2 --cache-dir=.turbo/cache
--cache=local:,remote:`: preflight locale, typecheck e build Next completati,
17 pagine statiche generate. Due warning sui fallback dei font web Atkinson;
i font PDF Noto sono incorporati e verificati separatamente. Nessuna build ripetuta.

**PASS** cleanup successivo: rimossi `apps/web/.next`, `.turbo` e le directory
`.turbo` dei cinque pacchetti, soltanto in questo worktree. `git diff --check`
verde. Nessun commit eseguito; `apps/web/src` invariato.

Proposta di commit:

1. `fix(api): proteggi revisioni concorrenti e invii durante upload` — contratto,
   timestamp monotoni, lease, controlli AI/test e aggiornamenti dei fixture.
2. `fix(api): rendi sicuro il rendering PDF Unicode` — fallback dei glifi,
   preservazione newline/tab, prove font/script/margini e PDF/PNG sintetici.
3. `docs: documenta casi limite e integrazione della console` — inventario,
   semantica API e punti aperti prima del pilota.
