# Riuso di nucleo e documenti

Contratto backend per il lavoro condiviso con il frontend: `POST /api/cases/:id/reuse`
usa `ReuseCaseRequest` e risponde come `CreateCaseResponse` (201, link mostrato una volta).
`practiceYear` è l'anno della pratica, non l'anno dei redditi. `members` conferma l'intero
nucleo attuale: mantenere gli `id` della sorgente per le stesse persone, ometterli per le
nascite/nuovi membri, omettere dalla lista le persone uscite. `confirmed: true` è obbligatorio.
`documentIds` omesso seleziona tutti i documenti eleggibili; `[]` copia solo il nucleo.
`citizenVisibleDocumentIds` autorizza esplicitamente la visibilità dei documenti degli
altri componenti; quelli del richiedente sono visibili se l'identità è rimasta la stessa.
Documenti senza titolare e documenti degli altri membri sono altrimenti solo operatore.
`DocumentSummary.reuse` contiene `status` (`valido`, `da_aggiornare`, `da_verificare`),
`code`, `reason` italiano e `checkedAt`. `CitizenCase.reuseNotice` contiene il promemoria
localizzato; la lista documenti, le segnalazioni e i download rispettano la visibilità.

`POST /api/cases/families/search` riceve `{taxCode}` oppure
`{firstName,lastName,birthDate}` (data ISO completa, non solo anno). Cerca il solo richiedente,
nel CAF autenticato, uguaglianza dopo normalizzazione; massimo 50 risultati e `truncated`.
Risponde con `FamilySearchResponse` e registra `family.searched` senza i termini cercati.
Le pratiche preesistenti prive di CF/data completa non vengono identificate per supposizione.

`POST /api/cases/:id/documents/:docId/reuse-check` riceve `{useAi:false}`: ricalcola
la valutazione. Con `true`, solo nei casi dubbi e con AI configurata, rilegge il documento
tramite `document.analyze`; le regole deterministiche decidono comunque lo stato.
Risponde con `DocumentReuseAssessment`. Un documento scaduto non richiede AI.

`POST /api/cases/:id/family-erasure` (solo amministratore) riceve
`{confirmReference,confirmed:true}` e cancella tutti i fascicoli esplicitamente collegati,
anche se la sorgente originale è stata rimossa. Risponde `{deletedCases}`.
La DELETE esistente resta la rimozione amministrativa di un solo fascicolo; retention
ed export conservano la loro portata. Una richiesta di cancellazione dell'interessato
si gestisce con `family-erasure`, non con una serie manuale di DELETE.

## Scelta architetturale

Considerate due alternative: una nuova entità file con tabella di riferimenti e contatori,
oppure metadati separati per documento e `storageKey` condivisa. Scelta la seconda:
lo storage corrente consente riferimenti multipli e non richiede copie fisiche. Il documento
resta proprietà del fascicolo (analisi, abbinamento e verifica indipendenti), mentre il file
si elimina soltanto dopo l'ultimo riferimento. La coda di cancellazione controlla i
riferimenti al momento del tentativo, inclusi i retry. Nessun contatore da sincronizzare.

Il gruppo di famiglia è un ID opaco persistente, senza FK alla sorgente, sempre circoscritto
al CAF. Non si crea alcun collegamento confrontando automaticamente nomi o codici fiscali.
Il riuso trasferisce soltanto il nucleo confermato e i documenti delle persone rimaste,
non risposte economiche annuali, revisioni precedenti, note interne o conversazioni.
La classificazione valida non è una verifica ufficiale: le nuove checklist richiedono la
revisione normale dell'operatore. Il rischio annuale segue il catalogo e le fonti ufficiali
esistenti; gli anni futuri richiedono comunque la verifica del modello annuale.

## Esempi di contratto

Nuovo fascicolo per l'anno successivo, con il solo richiedente ancora nel nucleo:

```http
POST /api/cases/pratica-sorgente/reuse
Content-Type: application/json
```

```json
{
  "officeId": "sede-del-caf",
  "practiceId": "isee_ordinario",
  "practiceYear": 2028,
  "language": "it",
  "confirmed": true,
  "members": [
    {
      "id": "id-richiedente-della-sorgente",
      "role": "richiedente",
      "firstName": "Persona",
      "lastName": "Esempio",
      "birthYear": 1980,
      "birthDate": "1980-02-10",
      "taxCode": "AAAAAA80B10A000A"
    }
  ],
  "citizenVisibleDocumentIds": []
}
```

Gli stessi campi identificativi devono essere presenti nella sorgente. Il CF
nell'esempio è fittizio. La risposta 201 contiene `{case, citizenLink}` e la nuova
pratica espone, per esempio:

```json
{
  "reuse": {
    "status": "da_aggiornare",
    "code": "wrong_year",
    "reason": "Servono dati riferiti all'anno 2026.",
    "checkedAt": "2027-01-15T10:00:00.000Z"
  }
}
```

Ricerca alternativa per generalità complete:

```http
POST /api/cases/families/search
```

```json
{ "firstName": "Persona", "lastName": "Esempio", "birthDate": "1980-02-10" }
```

Cancellazione su richiesta dell'interessato:

```http
POST /api/cases/id-pratica/family-erasure
```

```json
{ "confirmReference": "AV-2027-000001", "confirmed": true }
```

La risposta è, per esempio, `{"deletedCases":3}`. Vengono invalidati tutti i link
del gruppo e rimossi dati, documenti e notifiche dei fascicoli; gli eventi di audit
minimi sopravvivono secondo la retention del registro. La cancellazione fisica dei
file è confermata dallo storage oppure resta nella coda persistente per il retry.

## Migrazione e compatibilità

Unica migrazione: `0014_family_document_reuse`, generata con
`pnpm --filter @avanti/db exec drizzle-kit generate --name=family_document_reuse`.
Aggiunge `cases.family_id` e indice CAF/gruppo, `documents.reused_from_year`,
`documents.reused_member`, `documents.citizen_visible` (true sui record esistenti)
e indice `storage_key`. Nessun collegamento né riuso retroattivo automatico.
`reused_from_year` conserva l'anno originario anche nei riusi concatenati.

Motivo della modifica ai contratti condivisi: frontend e backend devono scambiarsi
la conferma del nucleo, l'anno, la selezione documentale e le autorizzazioni di visibilità,
oltre a rendere gli stati del riuso senza interpretare testo libero. `MemberInput`
aggiunge CF e data di nascita opzionali; il solo anno di nascita non autorizza una
ricerca per generalità. I nuovi campi delle risposte sono additivi e opzionali.
La normale creazione può ricevere `practiceYear`; in sua assenza resta il 2027 del catalogo.
I nuovi endpoint restituiscono gli errori `ApiError` esistenti, senza dettagli interni.

## Verifica

Le suite `document-reuse.test.ts` e `family-reuse.test.ts` verificano calendario,
anni, scadenze, titolarità, isolamento tra CAF, visibilità su letture/mutazioni/download,
nessun riuso tra link indipendenti, nascite/uscite, retention, riferimenti condivisi,
cancellazione dell'intero gruppo e fallback AI. Usano PGlite isolato e storage in memoria.
Le suite di export esistenti restano la regressione dell'export.

Prova provider separata, mai inclusa da `pnpm check`:

```sh
AI_LIVE=1 AI_PROVIDER=openrouter pnpm --filter @avanti/api test:reuse:live
```

Richiede la chiave nell'ambiente e `pdftoppm`. Genera testo, PNG e PDF esclusivamente
sintetici in una directory temporanea poi rimossa. Prova `openai/gpt-6-luna`, con
`deepseek/deepseek-v4.1-flash` come riserva solo per testo/immagini. La policy `strict`
usa `zdr:true` e `data_collection:"deny"`, secondo la
[documentazione OpenRouter](https://openrouter.ai/docs/guides/routing/provider-selection).
Solo un 404 esplicito di assenza endpoint compatibile permette `permissive` per
quel test sintetico. Nessuna modifica alla policy del runtime applicativo.

In questa esecuzione: prova live **BLOCKED**, chiave non disponibile al processo;
zero richieste esterne. Disponibilità dei modelli ed endpoint ZDR non verificata.

La suite API può essere eseguita separatamente su un Postgres loopback vuoto con
nome terminante in `_test`, impostando `DOC_REUSE_TEST_DATABASE_URL` e lanciando
soltanto `vitest run src/family-reuse.test.ts` nel pacchetto API. Include una prova
concorrente di retention e cancellazione dell'intero gruppo, saltata nella normale
suite PGlite. Questa prova nativa è **NOT RUN** qui: `initdb` è bloccato dal sandbox
macOS su `shmget` (nessun server avviato). La directory temporanea è stata rimossa.

Il lock organizzazione delle mutazioni amministrative usa `FOR NO KEY UPDATE`:
continua a escludere il `FOR SHARE` delle operazioni operatore ma permette il
`KEY SHARE` richiesto dalle FK dell'audit di retention. Evita l'inversione di attesa
organizzazione/pratica durante la cancellazione del gruppo. Compatibilità dei lock:
[PostgreSQL, Explicit Locking](https://www.postgresql.org/docs/17/explicit-locking.html).
