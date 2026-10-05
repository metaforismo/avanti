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

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
