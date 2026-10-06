# Architettura

Avanti è un monorepo pnpm + Turborepo. Un solo deploy (Next.js su Vercel o Node), backend
montato dentro l'app web come handler Hono: niente CORS, niente secondo servizio da gestire.

```
cittadino ──► /pratica/[token]  ─┐
                                 │   apps/web (Next.js 16, App Router)
operatore ──► /console/*        ─┤        │
                                 │        ▼  app/api/[[...route]]/route.ts
landing   ──► /                 ─┘   packages/api   (Hono: routing, auth, servizi)
                                          │
                     ┌────────────────────┼──────────────────────┐
                     ▼                    ▼                      ▼
              packages/core        packages/db             servizi esterni
        (catalogo pratiche,     (Drizzle: PGlite in      (AI Gateway via AI SDK,
         intervista, checklist,  locale/test, Postgres    storage file: disco
         valutazione fascicolo)  in produzione)           locale / Vercel Blob)

packages/contracts — schemi zod condivisi tra frontend e backend (unica fonte di verità delle API).
```

Le pagine server possono chiamare l'API in-process (`app.request(...)`, solo GET pubbliche): lo
fa `/s/[office]` per mostrare CAF e sportello al primo paint. Next.js valuta `@avanti/api` una
volta per bundle e di nuovo a ogni hot reload, quindi il database è un singleton di processo
(`processSingleton` in `packages/api/src/runtime.ts`): PGlite ammette una sola istanza aperta
per cartella e due aperture concorrenti corrompono `.data/pglite`.

## Pacchetti

| Pacchetto           | Responsabilità                                                                 | Owner     |
| ------------------- | ------------------------------------------------------------------------------ | --------- |
| `@avanti/contracts` | DTO e schemi zod delle API. Nessuna logica.                                    | condiviso |
| `@avanti/core`      | Dominio puro, senza I/O: catalogo, motore intervista, checklist, verifiche.    | backend   |
| `@avanti/db`        | Schema Drizzle, migrazioni, client, seed demo.                                 | backend   |
| `@avanti/api`       | App Hono: route, sessioni operatore, token cittadino, AI, storage, rate limit. | backend   |
| `@avanti/web`       | Landing, flusso cittadino, console operatore, design system.                   | frontend  |

## Principi

- **L'AI prepara, l'operatore decide.** Nessuna pratica viene trasmessa a enti: Avanti produce
  un fascicolo strutturato per l'operatore abilitato del CAF/patronato.
- **Deterministico prima, AI dopo.** Il catalogo delle pratiche (domande, regole, documenti) è
  codice versionato e testato. L'AI serve a capire il linguaggio naturale, classificare e
  controllare documenti. Senza chiave AI tutto funziona con euristiche (degradazione esplicita).
- **Il cittadino non crea account.** Accede con un link-capability (token casuale, 256 bit,
  salvato solo come hash) generato dal CAF o dal QR dello sportello. Il link scade.
- **Dati sensibili.** Documenti d'identità e redditi: minimizzazione, retention configurabile,
  audit log degli accessi, nessun dato personale nei log applicativi o negli URL (tranne il token).
- **Multilingua.** Il cittadino usa la propria lingua; l'operatore vede sempre l'italiano.

## Flussi principali

1. **Intake** — il cittadino apre il link dello sportello, sceglie la lingua, accetta l'informativa,
   descrive l'esigenza a parole sue. Il motore classifica la pratica (AI o parole chiave) e
   avvia l'intervista, saltando le domande a cui ha già risposto nel testo libero.
2. **Checklist** — dalle risposte il core genera la checklist personalizzata (per persona del
   nucleo, per conto corrente, per immobile, …).
3. **Documenti** — upload, analisi (tipo, intestatario, anno, scadenza, leggibilità, pagine),
   abbinamento automatico alla voce della checklist, segnalazioni in linguaggio semplice.
4. **Invio** — il cittadino conferma; il fascicolo passa in coda all'operatore con riepilogo,
   problemi bloccanti e avvisi.
5. **Revisione** — l'operatore verifica/rifiuta voci, chiede integrazioni (tradotte nella lingua
   del cittadino), esporta il fascicolo (PDF/JSON) per il gestionale esistente.
6. **Metriche** — tempi misurati e completezza al primo invio, confrontati con la baseline
   dichiarata dal CAF.

Vedi [API.md](API.md) per gli endpoint e [DATA_MODEL.md](DATA_MODEL.md) per lo schema.

## Estrazione euristica del racconto

`packages/core/src/extraction.ts` classifica la pratica ed estrae indizi dal testo,
senza I/O né chiavi AI. L’API la usa come fallback locale e come rete di sicurezza
per l’estrazione AI. Le lingue coperte sono italiano (`it`), inglese (`en`), francese
(`fr`), spagnolo (`es`), rumeno (`ro`), ucraino (`uk`), arabo (`ar`) e bengalese (`bn`).
La classificazione resta basata sulle parole chiave del catalogo; i lessici dei fatti
seguono la lingua scelta dal cittadino.

Il testo viene normalizzato in NFC, senza distinzione fra maiuscole e minuscole;
si tollerano accenti latini omessi, apostrofi tipografici, vocalizzazione araba e cifre
arabe/bengalesi. I segni bengalesi restano intatti. Le clausole si separano su
punteggiatura (anche `،` e `।`), congiunzioni e inizi di frasi riconosciuti. In arabo
si separa anche la `و` attaccata ai termini noti. La negazione vale nella propria
clausola, anche quando segue il parente, come in bengalese e ucraino.

Solo la convivenza dichiarata produce ruoli: citare un parente che lavora non lo
aggiunge al nucleo. Una lista di parenti può proseguire dopo virgole o congiunzioni;
un genitore negato resta fuori. Il genitore non convivente del richiedente produce
`applicant_parent_nonresident`, distinto da `nonresident_parent`, riservato agli indizi
su un figlio minorenne e il suo genitore. Nessun indizio sostituisce la conferma
nell’intervista o la valutazione dell’operatore.

Il conteggio è almeno quello dei ruoli riconosciuti (richiedente più conviventi).
Un numero esplicito maggiore viene conservato: l’intervista chiede le persone
ancora da identificare. Per un plurale senza numero, come «vivo con mia moglie e
figli», non si inventa il numero dei figli. Le banche note sono riconosciute anche
accanto a preposizioni o suffissi in altri alfabeti; le parole latine più lunghe
non sono abbinate per sottostringa. Conti e veicoli hanno negazioni locali e
quantità esplicite, oppure il singolare implicito di una dichiarazione di possesso.

I lessici sono in `extraction-lexicons.ts`: per aggiungere un termine, inserire la
forma letterale nella lista della lingua (`KIN_TERMS`, `VEHICLE_TERMS`,
`ACCOUNT_TERMS`, oppure `BANKS` per un istituto). Le liste `*_PATTERNS` contengono
frammenti regexp nominati, da estendere quando cambia la struttura della frase.
Aggiungere in `extraction.test.ts` un racconto concreto con risultato atteso e un
caso negativo vicino; eseguire `pnpm --filter @avanti/core test`.

Le cinque storie esatte della homepage e il risultato atteso sono esportati da
`@avanti/core/demo-stories`, un subpath di soli dati senza import o dipendenze dal
resto del core. Il test di accettazione le esegue senza AI; il frontend può usarle
per verificare che i propri segmenti non divergano.

Limiti noti: non è un parser generale e non comprende ogni errore ortografico,
dialetto, pronome anaforico o lingua mescolata. Parentele indirette («la madre di
mio marito»), racconti ipotetici e liste ambigue possono richiedere chiarimento.
Il collettivo «vivo con i miei genitori» non identifica ancora i ruoli: occorre
indicare madre/padre o completarli nell’intervista. Non identifica persone, titolarità dei conti o il nucleo legale; i
figli senza quantità restano da completare. L’assenza di un fatto estratto non
significa una risposta negativa.
