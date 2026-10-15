# Indicazioni dello sportello e ricevuta

Decisione del 15 ottobre 2026. La UI usa `Office.bookingUrl` e `Office.citizenNote`
insieme ai recapiti esistenti; l'admin abilita `notifyCitizenSubmission` nelle
impostazioni. Il submit non crea appuntamenti.

Sono state confrontate due strutture:

1. Estendere le colonne di `offices`, la view condivisa e il dispatcher esistente.
   La ricevuta usa la transazione di submit e il primo `submittedAt` come guardia.
2. Introdurre un documento JSON di istruzioni e una tabella dedicata alle ricevute,
   con snapshot completo dello sportello per ciascun invio.

Scelta: la prima. Indirizzo, telefono e orari hanno già un proprietario e una view
usata dal percorso cittadino; l'outbox possiede già cifratura, deduplica, retry,
cancellazione e isolamento. La seconda duplicherebbe stato e retention senza
un requisito di storico delle istruzioni. Si salvano nella ricevuta solo il nome
pubblico al primo invio e il riferimento; le indicazioni nella pagina rimangono
quelle correnti. Nessun modulo o tabella di appuntamenti.

Confini: `OfficeInput` valida URL e testi; `officeView` espone i dati;
`submissionReceipt(language, reference, officeName)` produce il testo senza I/O;
`enqueueSubmissionReceipt(db, services, caseRow)` accoda dentro la transazione;
`scheduleNotificationDelivery` programma solo dopo il commit. I reinvii restano
protetti anche dopo la retention dell'outbox perché non azzerano `submittedAt`.
La ricevuta è opt-in per il CAF per minimizzare l'esposizione via email.

Verifica locale: le suite `administration.test.ts`, `notifications.test.ts`,
`citizen-copy.test.ts` e `next-steps-migration.test.ts` coprono i contratti, i
confini del tenant, il submit reale e l'aggiornamento di dati preesistenti.
Le prove UI e la consegna di email reali richiedono verifiche distinte.
