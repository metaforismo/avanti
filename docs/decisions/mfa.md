# MFA operatori

Il frontend usa `LoginResponse` per scegliere tra challenge e operatore; quest'ultimo
espone `mustChangePassword` e `mustSetupMfa` in ordine di priorità. Account usa le
API `/auth/mfa/*`; Impostazioni salva `mfaRequired`; gestione operatori chiama
`reset-mfa`. Contratti ed esempi sono in ../API.md.

Alternative considerate: una tabella distinta per challenge e configurazione,
oppure stati e segreto provvisorio nella tabella sessioni esistente. La seconda
riusa cookie, scadenza, revoca e manutenzione, evitando due identità di sessione e
due punti di autorizzazione. Il segreto confermato e gli hash di recupero appartengono
all'operatore; il segreto provvisorio appartiene alla sessione iniziatrice.

`mfa.ts` concentra TOTP, cifratura, consumo fattori e deduplicazione dei fallimenti;
`routes/mfa.ts` esegue le transazioni sotto lock operatore, come password/reset esistenti.
Il middleware applica gli stati a tutte le API; password-only e setup non rinnovano
la scadenza. Il core non cambia: crittografia, chiavi e transazioni sono I/O del backend.
La CLI export usa lo stesso consumo del fattore per non offrire un accesso con la
sola password ai dati protetti. Nessun segreto viene aggiunto agli export.

La migrazione 0009 è additiva, generata con Drizzle e applicata nei test PGlite;
i default mantengono seed e login demo invariati. Nessuna nuova dipendenza.
