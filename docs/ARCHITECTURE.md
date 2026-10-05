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
