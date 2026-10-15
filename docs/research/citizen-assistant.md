# Fonti per l’aiuto al cittadino

Verificato il 15 ottobre 2026.

- Emergenze: il testo fisso indica il 112, numero europeo per i servizi di emergenza.
  Fonte ufficiale: [Commissione europea, 112](https://digital-strategy.ec.europa.eu/en/policies/112).
- Domande e documenti: l’assistente riusa descrizioni, spiegazioni e indicazioni “dove lo
  trovo” dal catalogo. Fonti normative, anni e limiti restano quelli già raccolti in questa
  cartella, fra cui [ISEE 2027](isee-2027.md). Nessuna nuova regola di spettanza.
- Foto, ripresa con lo stesso link e verifica dell’operatore: istruzioni di prodotto curate
  in otto lingue in `packages/core/src/citizen-assistant.ts`, non contenuti normativi.
- Orari, prenotazione e nota dello sportello: dati pubblici configurati dal CAF, senza
  accesso a siti esterni né promesse di disponibilità o prenotazione effettuata.

Il prompt può citare soltanto gli id di questi elementi forniti dal server nella pratica
corrente. Per informazioni che mancano si rimanda allo sportello. Le traduzioni curate
seguono `docs/decisions/citizen-copy.md` e richiedono comunque revisione madrelingua prima
che il pilota venga usato con persone reali.
