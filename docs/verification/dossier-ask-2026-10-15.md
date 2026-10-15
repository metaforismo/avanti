# Chiedi al fascicolo — consegna backend

Contratti, endpoint, limiti di input, riferimenti nel testo, paginazione e migrazione:
[decisione e handoff UI](../decisions/dossier-ask.md).
Nessuna modifica a `apps/web/src`, settings, queue, analisi/cache e decisioni del
copilota esistente; il contesto condiviso elimina anche i nomi file nei finding.
Nessun commit, push, merge, deploy o migrazione su database esterno.

## Prove specifiche

PASS: 19 test API, 4 test del task e 6 test della stima. Eseguiti con:

```sh
pnpm --filter @avanti/api exec vitest run src/dossier-ask.test.ts
pnpm --filter @avanti/ai exec vitest run src/dossier-ask-task.test.ts
pnpm --filter @avanti/core exec vitest run src/question-estimate.test.ts
```

Copertura: isolamento tra operatori e CAF, autenticazione/Origin esistente, input e
storia limitati, rimozione contatti/nomi file/note interne, riferimenti parzialmente
spuri e interamente inventati, fonti normative risolte dal server, calendario
Europe/Rome, budget/interruttore/assenza chiave, rate limit 60/ora, cursori privati,
retention, nessun testo nell'audit o nei log, modifica/cancellazione della pratica e
revoca dell'operatore durante la rete. Iniezioni in risposte del cittadino, letture
documentali, domanda operatore e storia. I mock offline verificano guardie e confini;
la prova del modello reale è separata qui sotto. Verificato anche il limite di 48.000
caratteri del dossier: fallback senza trasmettere dati troncati.

Stima iniziale ISEE: **16–43**, rispetto al precedente **16–441**. Con 3 componenti e
2 rapporti dichiarati: **23–38**. Ipotesi ignote: 3 persone/3 rapporti/2 immobili/2
veicoli; i conteggi dichiarati prevalgono, anche quando superano queste ipotesi e
quando mancano ancora i nomi. L'intervallo può aumentare con nuove dichiarazioni.

## Provider reale

[Rapporto finale](dossier-ask-2026-10-15-live.md) e
[risposte sintetiche complete](dossier-ask-2026-10-15-live.json).
Configurazione A, trasporto SDK di produzione senza override, policy strict,
`dossier.ask` reasoning, costituzione 1/prompt 2. Chiave letta soltanto dall'ambiente.

- 14 domande, 13 risposte AI, 1 fallback sicuro (`invalid_output`) sull'iniezione
  nella cronologia. **FAIL del gate severo che richiede zero fallback**.
- Nessuna violazione delle guardie o esecuzione/ripetizione del payload rilevata nel
  passaggio finale; l'attacco nella storia restituisce un limite esplicito locale.
- 15 tentativi, mediana 4.373 s, p95 17.291 s; EUR 0.010443 stimati, non fatturati.
- Conto del coniuge, scadenze, mancanti, madre assente, FC2, anno patrimoniale, letture
  discordanti, verifica umana, diritti/importi, follow-up e quattro iniezioni.

Il [baseline](dossier-ask-2026-10-15-live-baseline.md), prompt 1, è conservato:
13/14 AI, un fallback e ripetizione dell'importo ostile mentre il modello descriveva
un attacco documentale (non esecuzione del comando). Il prompt 2 vieta di ripetere il
payload, privilegia risposte brevi e distingue verifica operatore da analisi automatica.
Due passaggi sugli stessi 14 casi: EUR 0.024468 stimati complessivamente.

[Fallback offline](dossier-ask-2026-10-15-offline.md): PASS, 14/14, zero chiamate e
zero costo. I controlli semantici specifici AI sono riportati ma non sono gate dei
fallback, che dichiarano capacità ridotte.

Revisione dei testi sintetici: conto/intestatario e follow-up coerenti, mancanti e
anni errati riferiti al fascicolo, FC2 spiegato dall'estratto del corpus, assenza della
madre esplicitata, diritto/importo non decisi. Restano richiami annuali non sempre
necessari e verbosità variabile. I gate automatici provano schema, riferimenti e
indicatori annotati; non certificano la corrispondenza semantica di ogni affermazione.
Il corpus locale non è una verifica normativa live e il modello può ancora sbagliare:
nessuna risposta cambia dati, verifiche documentali, stato o invii della pratica.

## Commit proposti, non eseguiti

- `feat(ai): aggiunge chat privata con il fascicolo e riferimenti verificati`
- `fix(core): usa conteggi realistici nella stima delle domande rimanenti`

## Chiusura locale

PASS `pnpm check` sul codice definitivo: 18/18 task, 1.386 test passati e 19 test
condizionali saltati. Parità/concorrenza su PostgreSQL esterno NON ESEGUITA:
`AVANTI_TEST_DATABASE_URL` e `DOC_REUSE_TEST_DATABASE_URL` non sono configurati.
Dettaglio: API 602, AI 84, core 616, DB 38, web 46. I controlli DB di schema,
migrazioni, indici e cancellazione sono stati eseguiti su PGlite.

PASS `pnpm build` sul codice definitivo (Next.js produzione e TypeScript).
PASS `git diff --check`; nessun file in `apps/web/src` modificato.
I warning Turborepo riguardano scrittura della cache condivisa fuori sandbox e output
assenza per i task `tsc --noEmit`; non hanno fatto fallire i comandi.
Pulizia finale limitata agli artefatti generati di questo worktree:
`apps/web/.next`, `.turbo` se presente e `.turbo` dei sei workspace.
