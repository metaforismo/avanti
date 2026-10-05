# Avanti — istruzioni per agenti

Front office AI per CAF e patronati: il cittadino descrive l'esigenza, Avanti costruisce
checklist e fascicolo verificato, l'operatore abilitato fa la pratica. Leggi `README.md` e
`docs/ARCHITECTURE.md` prima di lavorare.

## Divisione del lavoro

- Backend (`packages/core`, `packages/db`, `packages/api`): Codex.
- Frontend (`apps/web`, design system, UX): Claude. Il backend non tocca `apps/web/src`
  tranne `src/app/api/[[...route]]/route.ts`.
- `packages/contracts` è il contratto: modificalo solo se necessario e spiega il perché nella PR.

## Regole

- TypeScript strict, ESM, Node ≥ 22. Nessun `any` non giustificato.
- Valida ogni input con gli schemi di `@avanti/contracts`. Errori nel formato `ApiError`
  con messaggi italiani sicuri da mostrare; mai stack o dettagli interni al client.
- Nessun dato personale (nomi, CF, testo del cittadino, contenuto documenti) nei log.
- Il core è puro: niente I/O, niente Date.now() implicito (passa il clock), testabile.
- Tutto deve funzionare senza chiavi esterne: AI e storage remoto hanno fallback locali.
- Test con Vitest accanto al codice (`*.test.ts`). Copri casi limite ed errori, non l'ovvio.
- Commenti solo dove spiegano un perché non evidente (norme, scelte di sicurezza).
- Commit convenzionali (`feat(core): …`), branch `feat/*` / `fix/*`, PR verso `main`.
- Prima di chiudere: `pnpm check` e `pnpm build` verdi.
- Contenuti normativi (documenti richiesti, anni di riferimento): cita la fonte ufficiale
  (INPS, Agenzia Entrate, Ministero dell'Interno, …) in `docs/research/` e non inventare.
