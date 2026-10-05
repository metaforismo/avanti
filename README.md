# Avanti

**Il fascicolo arriva pronto. Avanti il prossimo.**

Avanti è il front office AI per CAF e patronati. Il cittadino descrive in parole sue (e nella
sua lingua) cosa deve fare; Avanti capisce la pratica, fa solo le domande necessarie, costruisce
la checklist personalizzata, controlla i documenti caricati e consegna all'operatore un
fascicolo ordinato, con quello che manca già evidenziato.

Avanti **non** sostituisce l'operatore abilitato né il gestionale del CAF: prepara il lavoro
prima che arrivi allo sportello.

```
cittadino → AI → fascicolo completo → operatore CAF → pratica ufficiale
```

> Stato: in sviluppo attivo. Primo verticale: **ISEE ordinario 2027** (DSU con redditi e
> patrimoni 2025), pilota con CAF gennaio 2027.

## Avvio rapido

```bash
pnpm install
pnpm dev            # http://localhost:3400
```

Requisiti: Node ≥ 22.19 (consigliato 24), pnpm 10. Nessuna chiave necessaria in locale.

## Struttura

| Percorso             | Cosa contiene                                            |
| -------------------- | -------------------------------------------------------- |
| `apps/web`           | Next.js 16: landing, flusso cittadino, console operatore |
| `packages/contracts` | Schemi zod condivisi delle API                           |
| `packages/core`      | Catalogo pratiche, intervista, checklist, verifiche      |
| `packages/db`        | Schema Drizzle, migrazioni, seed                         |
| `packages/api`       | Backend Hono montato su `/api`                           |
| `docs/`              | Architettura, API, modello dati, ricerca normativa       |

## Script

| Comando        | Effetto                                      |
| -------------- | -------------------------------------------- |
| `pnpm dev`     | Avvia l'app web con backend integrato        |
| `pnpm check`   | Lint + typecheck + test di tutti i pacchetti |
| `pnpm build`   | Build di produzione                          |
| `pnpm db:seed` | Carica i dati demo                           |

## Documentazione

- [Architettura](docs/ARCHITECTURE.md)
- [Istruzioni per agenti e contributori](AGENTS.md)

## Licenza

Proprietario. Tutti i diritti riservati.
