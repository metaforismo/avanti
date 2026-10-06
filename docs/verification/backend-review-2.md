# Seconda revisione backend

Prove locali su `fix/backend-review-2`. I test di regressione sono stati eseguiti prima
delle correzioni; per i controlli aggiunti durante la verifica, i singoli moduli originali
sono stati temporaneamente ripristinati e poi riportati alla versione corretta.

| Punto | Riproduzione prima del fix                                                             | Verifica                                                                              |
| ----- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1     | Il figlio superstite riceveva `m_figlio_0`; la sequenza edit/conteggio/membri dava 400 | Core + API: UUID persistenti, edit, rimozione, detach e revisioni                     |
| 2     | `nonresident_parent: true` anche per il padre del richiedente e attraverso la virgola  | Core: clausole negative e figlio minorenne nella stessa clausola                      |
| 3     | Nucleo assente in uk/ro/ar con forme flesse                                            | Core: una frase per lingua                                                            |
| 4     | Migrazione senza backfill delle risposte                                               | DB legacy + seed di main: tutte le chiavi confermate                                  |
| 5     | Finding assenti nella vista cittadino                                                  | API: titolare, altra pratica e analisi fallita visibili                               |
| 6     | L’edit tornava alla prima domanda non risposta                                         | API: domanda modificata anche sul GET successivo                                      |
| 7     | Nucleo assente con “solo/sola” e “siamo in 3”                                          | Core: otto lingue, forme italiane e conteggio esplicito                               |
| 8     | Nessun rifiuto di configurazione, senza proxy le richieste fallivano                   | API e configurazione Next: socket Node, errore prima del listener/server              |
| 9     | Timeout 415; worker ricreato per PDF; OOM senza risposta retry                         | API: timeout/OOM 503, parser valido, malformato 415, stesso thread riusato            |
| 10    | CSP `sandbox` sul PDF inline                                                           | API: MIME/disposition/CSP; Chrome nativo: PDF caricato nell’iframe, immagine nell’img |
| 11    | Pulizia sulle mutazioni; endpoint cron assente                                         | API: cron autenticato, cooldown dopo errore, POST senza manutenzione                  |
| 12    | Cinque righe di remap per tre membri omonimi                                           | DB: mappatura uno-a-uno per posizione; reset dei vecchi abbinamenti ambigui           |
| 13    | Zero eventi dopo due download e due export GET                                         | API: append-only, attore corretto, formati JSON/PDF                                   |
| B1    | Tombstone registrava l’errore storage anziché l’insert                                 | API: errori distinti simulati, record dell’insert corretto                            |
| B2    | GET senza rinnovo cookie/sessione                                                      | API: estensione su GET, limite assoluto di 12 ore                                     |
| B3    | Domande selezione membri ancora 2025 con anno catalogo modificato                      | Core: anno di riferimento variato in otto lingue                                      |
| B4    | Risposta ripeteva pratica e tutti i conteggi pregressi                                 | API: solo dati accettati nel turno, frasi locali e parenti                            |
| B5    | Due eventi all’ingresso in revisione                                                   | API: un evento, riapertura ancora tracciata                                           |
| B6    | Health non leggeva il contatore                                                        | API: solo `status` e `fallbackCount` numerico                                         |

Comandi ripetibili:

```sh
pnpm --filter @avanti/core test
pnpm --filter @avanti/db test
pnpm --filter @avanti/api test
pnpm format:check
pnpm check
pnpm build
PREVIEW_URL=http://localhost:3417 node packages/api/scripts/verify-preview.mjs
```

Il sandbox macOS rifiuta il lock dell’indice del worktree e l’avvio di Chrome da
Playwright. Stash/checkout non sono quindi stati eseguiti. La prova del seed ha usato
una copia di `main` ottenuta con `git archive`, dipendenze esistenti e PGlite separato;
le correzioni sono state applicate con il migrator reale. Risultato: 10 casi, 54 file,
chiavi confermate, UUID distinti e proprietari dei file conservati. Il percorso da
`0001` con omonimi è coperto anche in Vitest. Le anteprime sono state verificate tramite
Chrome nativo: visore dell’iframe con “Caricamento PDF terminato” e testo del PDF,
poi immagine nel medesimo dialogo. Lo script Playwright è disponibile per un ambiente
che consente il lancio del browser; non è stato dichiarato verde in questo sandbox.
