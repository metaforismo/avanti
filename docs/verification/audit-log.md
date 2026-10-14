# Registro attività amministratore — proposta PR

La cronologia era scritta ma non consultabile dall’amministratore, mancavano eventi
di autenticazione/amministrazione e la cancellazione della pratica distruggeva gli
eventi precedenti. Questa modifica aggiunge lettura ed export per l’admin del CAF,
registra le azioni mancanti e conserva gli audit per 365 giorni dal proprio istante.
Non include interfaccia frontend, commit, PR aperta o rilascio.

## Contratto condiviso

La modifica di `packages/contracts` è necessaria: il frontend deve poter validare
la query e consumare risultati paginati con una forma unica, senza interpretare
righe DB, categorie interne o metadata liberi. È un’aggiunta agli endpoint esistenti.

| Schema       | Campi / semantica                                                                                                                                                                                                                                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AuditQuery` | `from` incluso, `to` escluso: timestamp ISO con offset esplicito; `operatorId` filtra attore **o** account interessato; `reference` è il codice pratica esatto, inclusi fascicoli cancellati; `action` enum; `cursor` opaco; `limit` 1–100, default 50. Chiavi sconosciute e intervalli invertiti sono rifiutati.          |
| `AuditEvent` | `id`, `at` ISO con offset storico Europe/Rome, `timeZone`; `actor: {type: operator/citizen/system, id}`; `subjectOperatorId`; `action`, `label` italiano; `case: {id, reference, deleted}` oppure null; `details` con sole chiavi fisse, conteggi/flag. Nessun nome/email è esposto. Gli attori AI sono resi come sistema. |
| `AuditPage`  | `items: AuditEvent[]`, `nextCursor: string/null`. Ordine `at DESC, id DESC`, senza offset SQL; precisione microsecondi mantenuta nel cursore. Il cursore è vincolato a tenant e filtri, riutilizzabile con un diverso `limit`.                                                                                             |

`GET /api/audit/export.csv` usa la stessa `AuditQuery`, incluso il cursore come
limite iniziale; ignora `limit` ed esporta l’intero risultato restante fino a 5.000
righe. Oltre il tetto risponde 400 con invito a restringere i filtri, senza troncare.
CSV UTF-8 con BOM, header italiano, tutte le celle tra virgolette e virgolette
interne raddoppiate; controlli, tab e a capo sono sostituiti da spazi. Un apostrofo
neutralizza `=`, `+`, `-`, `@` anche dopo spazi/controlli iniziali. Download attachment,
risposte `no-store`; 20 export/minuto per operatore e 200 per IP fidato, come gli
export dei fascicoli. Il proprio `audit.exported` è scritto dopo la selezione nella
stessa transazione e non è compreso nel CSV appena prodotto.

I cursori non sono credenziali e non congelano una snapshot: eventi nuovi prima
della posizione già letta compariranno ricominciando dalla prima pagina. Eventi
scaduti possono essere rimossi dal cron tra pagine. Nessun totale globale è esposto.
`operatorId` estranei non rivelano esistenza e restituiscono una pagina vuota.

## Copertura e limiti

Accessi validati riusciti/falliti (inclusi 429 e autenticazione CLI, distinta con `cli=true`), cambio password, logout, creazione,
modifica/attivazione/disattivazione/reset account, impostazioni e sportelli hanno
eventi aggiunti nelle transazioni pertinenti. I fallimenti per account sconosciuti
sono senza tenant e invisibili agli admin; email/password/IP sono omessi.
Rigenerazione link, cancellazioni manuali/automatiche, download documenti, export
JSON/PDF e organizzazione da CLI, DSU, revisioni e integrazioni erano già registrati.
Anche la lettura operatore del dossier ora registra accesso e DSU inclusa nella risposta.

Gli audit sopravvivono alla cancellazione delle pratiche con ID e riferimento
tecnico; nessun contenuto del cittadino è conservato. La migrazione valorizza i
riferimenti degli eventi ancora collegati. Le FK impediscono cancellazioni dirette
con perdita silenziosa di cronologia. Il cron esistente elimina gli audit scaduti
a lotti di 1.000 indipendentemente dalla retention dei fascicoli.
Vedi [SECURITY.md](../SECURITY.md#registro-attività-e-conservazione-separata) per la
motivazione e i limiti della scelta; il registro non è una certificazione GDPR.

## Verifica

`audit-log.test.ts`: permessi sui due endpoint, account temporanei/disattivati,
cross-tenant e filtri estranei, periodo/azione/attore/riferimento, cursori uguali e
microsecondi, date Europe/Rome nei cambi DST, CSV injection e quoting, privacy dei
metadata storici, tetto export (incluso limite esatto), errore scrittura audit,
login falliti persistiti/rate limit, password/reset/disattivazione/logout e retention
separata con cutoff esatto/lotti e cron. I test esistenti coprono link, DSU,
download/export fascicoli, cancellazioni/storage retry e isolamento delle mutazioni.
Prove locali su PGlite; PostgreSQL remoto e deployment non verificati in questo worktree.

Esito locale del 14 ottobre 2026: `pnpm check` verde, 879 test passati e 5 test
PostgreSQL remoto esclusi perché non configurati. Un’unica `pnpm build` verde,
con `TURBO_CACHE_DIR=.turbo/cache` per confinare la cache al worktree. Gli artefatti
`apps/web/.next` e tutte le directory `.turbo` dei pacchetti sono rimossi dopo la
build. Ricevute locali non versionate in `.data/verification/audit-log/`.
Nessun commit o rilascio eseguito. Migrazione 0008 necessaria prima dell’avvio
della nuova API in un ambiente esistente. Il frontend comparso durante il lavoro
non è stato modificato da questa attività backend.

## Testi delle azioni

| Codice                      | Testo italiano                                     |
| --------------------------- | -------------------------------------------------- |
| `privacy.accepted`          | Presa visione dell’informativa registrata          |
| `case.created`              | Fascicolo aperto                                   |
| `case.viewed`               | Fascicolo consultato dall’operatore                |
| `case.link_created`         | Link cittadino creato dall'operatore               |
| `case.link_regenerated`     | Link cittadino rigenerato dall'operatore           |
| `answer.updated`            | Risposte aggiornate dal cittadino                  |
| `answer.edited`             | Risposta precedente modificata                     |
| `language.updated`          | Lingua aggiornata                                  |
| `review.started`            | Revisione iniziata                                 |
| `review.completed`          | Revisione completata dall'operatore                |
| `citizen.requested`         | Integrazione richiesta al cittadino                |
| `document.uploaded`         | Documento caricato                                 |
| `document.analyzed`         | Analisi documento completata                       |
| `document.reassigned`       | Abbinamento documento modificato                   |
| `document.deleted`          | Documento eliminato                                |
| `document.downloaded`       | Documento consultato                               |
| `case.submitted`            | Fascicolo inviato al CAF                           |
| `checklist.reviewed`        | Voce della checklist revisionata                   |
| `case.requested`            | Integrazione richiesta al cittadino                |
| `case.in_review`            | Fascicolo in revisione                             |
| `case.needs_citizen`        | In attesa del cittadino                            |
| `case.reopened`             | Fascicolo riaperto                                 |
| `case.assigned`             | Assegnazione aggiornata                            |
| `case.note_updated`         | Nota interna aggiornata                            |
| `checklist.verified`        | Documento verificato                               |
| `checklist.rejected`        | Nuovo documento richiesto                          |
| `checklist.waived`          | Documento non necessario: motivo registrato        |
| `checklist.reset`           | Verifica annullata                                 |
| `case.ready`                | Fascicolo pronto per il gestionale                 |
| `case.closed`               | Fascicolo chiuso                                   |
| `case.exported`             | Fascicolo esportato                                |
| `dsu_sheet.viewed`          | Prospetto DSU consultato                           |
| `case.deleted`              | Fascicolo cancellato dall’amministratore           |
| `case.retention_deleted`    | Fascicolo cancellato per fine conservazione        |
| `auth.login_succeeded`      | Accesso operatore riuscito                         |
| `auth.login_failed`         | Tentativo di accesso operatore fallito             |
| `auth.password_changed`     | Password modificata dall’operatore                 |
| `auth.logged_out`           | Sessione operatore terminata                       |
| `operator.created`          | Account operatore creato                           |
| `operator.updated`          | Account operatore aggiornato                       |
| `operator.deactivated`      | Account operatore disattivato                      |
| `operator.activated`        | Account operatore riattivato                       |
| `operator.password_reset`   | Password operatore reimpostata dall’amministratore |
| `settings.updated`          | Impostazioni dell’organizzazione aggiornate        |
| `office.created`            | Sportello creato                                   |
| `office.updated`            | Sportello aggiornato                               |
| `organization.bootstrapped` | Organizzazione e primo amministratore creati       |
| `organization.exported`     | Dati dell’organizzazione esportati                 |
| `audit.exported`            | Registro attività esportato in CSV                 |
| `activity.recorded`         | Attività registrata                                |
