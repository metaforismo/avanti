# Preparazione al deploy

Uso previsto: le GET autorizzate del fascicolo chiamano
`scheduleDocumentRecovery(services, caseId)`; upload e cron passano dallo stesso
`analyzePendingDocument(services, documentId)`. Il chiamante non gestisce il lease.
`pnpm preflight` controlla la configurazione senza connessioni; bootstrap ed export
sono comandi amministrativi interattivi, separati dal build.

Alternative valutate: una nuova coda esterna con worker, oppure la coda persistita
nei documenti già esistente con lease atomico. La seconda evita una nuova risorsa
e conserva il fallback locale. Un mutex di processo non protegge istanze Vercel
diverse; il lease deve stare nel database, con token proprietario e scadenza.

Moduli: `document-analysis.ts` possiede selezione, lease e recupero;
`packages/db/src/preflight.ts` possiede validazione ambiente e messaggi sicuri;
`packages/api/src/admin-bootstrap.ts` e `organization-export.ts` possiedono
transazioni e autorizzazione, con CLI separate per terminale e output.
I nuovi schemi CLI sono in contracts perché sono input pubblici dei comandi.

Fasi: contesto e due alternative valutati; implementazione completata.
Prove locali in `document-recovery.test.ts`, `admin-commands.test.ts` e
`preflight.test.ts`; la sintesi non ha richiesto variazioni di ownership o una coda esterna.
I contratti aggiunti validano soltanto i nuovi input CLI, senza cambiare DTO/API frontend.
Nessuna coda remota, modifica frontend, risorsa o deploy fa parte di questo giro.
