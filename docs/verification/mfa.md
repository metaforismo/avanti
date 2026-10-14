# Verifica MFA operatori — 14 ottobre 2026

Worktree `.worktrees/mfa`, branch `codex/mfa`. Nessun commit, push o modifica a
`apps/web/src`. Seed demo invariato. Nessuna nuova dipendenza.

- **PASS** `pnpm check --concurrency=1`: 15 attività riuscite; 338 test API,
  27 test DB e 39 test web eseguiti. Core invariato: 572 test da cache Turbo valida.
- **PASS** `pnpm build`: unica build finale, exit 0, due attività riuscite,
  compilazione e prerender Next completati. Cache `apps/web/.next` e `.turbo`
  del worktree eliminate dopo la build.
- **PASS** 22 test MFA API: cinque di crittografia e 17 flussi Hono con DB PGlite
  migrato. Vettori RFC 6238 SHA-1 ufficiali a otto cifre e riduzione a sei,
  finestra ±1, high-water mark anti-replay/clock rollback, consumo concorrente,
  recupero monouso, rinnovo vietato/scadenza, API bloccate, rotazione/revoca,
  obbligo organizzativo, cambio password preliminare, reset cross-tenant/self,
  rate limit condiviso, errori uniformi, credenziali assenti da log/risposte successive.
  Verificati anche PATCH parziali che preservano l'obbligo e rollback se l'audit fallisce.
- **PASS** test DB dedicato alla migrazione 0009: password/hash sessioni/impostazioni
  precedenti preservati, MFA inizialmente spenta, vincolo stati sessione attivo.
  Test seed demo e controllo dei dieci hash migrazione passati nella suite DB.
- **PASS** export CLI: senza fattore rifiutato quando necessario, recupero consumato
  una volta, nessuna credenziale MFA nell'export.
- **NOT RUN** cinque test di parità su Postgres esterno: nessun `DATABASE_URL` di
  staging configurato. Le prove transazionali di questa sessione usano PGlite.
- **NOT RUN** UI MFA/browser/app di autenticazione e deploy: il frontend è affidato
  a Claude; l'integrazione API è verificata tramite richieste Hono reali in-process.

Ricevute locali della sessione: `/tmp/avanti-mfa-check.log`,
`/tmp/avanti-mfa-build.log`. I warning Turbo relativi alla scrittura della cache nel
sandbox non hanno impedito check/build; non sono state mutate manualmente risorse Git.

Contratti ed esempi in ../API.md, scelte in ../decisions/mfa.md,
configurazione/rotazione chiave in ../SECURITY.md e ../DEPLOY.md.

Commit proposti, da eseguire fuori da questa sessione:

1. `feat(auth): add operator TOTP MFA and organization enforcement`
   — contratti, schema/migrazione, runtime/API/CLI, chiave/preflight, test.
2. `docs(auth): document operator MFA setup and recovery`
   — API, sicurezza, modello dati, guida, deploy, README, fonti e verifica.
