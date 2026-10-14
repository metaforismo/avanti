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

Notifiche: il default cron resta `0 3 * * *` per consentire il deploy Hobby.
Dopo il commit di candidatura, integrazione o pratica pronta, `services.background`
registra un dispatch del solo ID appena accodato. Usa gli stessi lease, lock DB e ID
di deduplicazione del cron; la risposta non attende il provider e gli errori finiscono
solo in log sintetici. Il cron resta il recupero e genera il digest una volta per giorno
UTC, con dispatch in background anche dei digest oltre il lotto di cinque invii.
Un rifiuto temporaneo confermato può essere ritentato dal cron giornaliero; gli esiti
incerti mantengono la finestra di 23 ore per evitare duplicati fuori dall'idempotenza
del provider. Su Pro/Enterprise la cadenza può passare a `* * * * *` per retry più rapidi.
