# Backend: decisioni e prove

Il contratto pubblico esistente resta il confine frontend/backend. Le risposte e i documenti sono ricalcolati dal core a ogni lettura; revisioni e abbinamenti sono persistiti per ID deterministico. Il clock è iniettato nella factory API e passato al core.

Sono state confrontate due strutture: un repository applicativo con metodi per ogni endpoint, e query Drizzle nel servizio fascicolo con un database comune ai due driver. La seconda evita duplicazione tra repository e query; il servizio compone il DTO e nasconde la ricostruzione, mentre le route gestiscono validazione/autorizzazione.

Token, sessioni, storage e AI sono confini separati. L'AI produce proposte strutturate che il catalogo valida. Il fallback non può attestare leggibilità, titolarità o completezza: occorre revisione umana. PDF e JSON sono export preparatori, mai trasmissioni agli enti.

Verifica prevista: unit test dominio, integrazione Hono/PGlite in memoria, migrazioni/seed idempotenti, check/build root e smoke HTTP attraverso Next in locale. I dati demo non sono evidenza dei KPI del pilota. Provider remoti e conformità legale richiedono verifiche dedicate prima del trattamento reale.

AI SDK 7 verificato dalla documentazione del pacchetto installato: `instructions`,
`Output.object`, timeout totale e parti `file` anche per immagini. Le chiamate sono
vincolate a un provider Gateway (`only`), senza fallback verso altri fornitori. Il
modello di esempio [Claude Sonnet 5.5](https://vercel.com/ai-gateway/models/claude-sonnet-5.5)
è presente nel catalogo ufficiale consultato il 6 ottobre 2026; la disponibilità del
proprio account e le garanzie contrattuali richiedono una prova distinta.
