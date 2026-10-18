# Voce del backend verso il cittadino

Decisione del 6 ottobre 2026. Il catalogo, le domande, gli aiuti, le conferme,
gli avvisi e le richieste di integrazione seguono questo registro e glossario.
Il frontend deve usare gli stessi termini.

| Lingua | Registro                                                          | Sportello            | Pratica     | Documento | Nucleo familiare |
| ------ | ----------------------------------------------------------------- | -------------------- | ----------- | --------- | ---------------- |
| it     | tu                                                                | sportello            | pratica     | documento | nucleo familiare |
| en     | you, neutro                                                       | desk                 | application | document  | household        |
| fr     | vous                                                              | guichet              | demande     | document  | foyer            |
| es     | tú                                                                | ventanilla           | trámite     | documento | unidad familiar  |
| ro     | tu                                                                | ghișeu               | cerere      | document  | nucleu familial  |
| uk     | Ви, cortesia con maiuscola                                        | вікно обслуговування | заява       | документ  | сім’я            |
| ar     | seconda persona maschile singolare; frasi neutre quando possibile | شباك الخدمة          | طلب         | وثيقة     | الأسرة           |
| bn     | আপনি, cortesia                                                    | সেবা কাউন্টার        | আবেদন       | নথি       | পরিবার           |

I termini si declinano secondo la frase. In ucraino anche i possessivi e gli
altri casi dei pronomi di cortesia hanno la maiuscola: Ваш, Вас, Вам, Вами.

`desk` indica lo sportello CAF o patronato. Gli enti che rilasciano i documenti
sono autorità o servizi competenti; `post office` indica le Poste. Il glossario
non cambia i nomi degli enti o dei documenti ufficiali, come CU, DSU, tessera
sanitaria o atto d’acquisto. Il fascicolo è distinto dalla pratica; i legami di
parentela e il motivo famiglia di un permesso sono distinti dal nucleo ISEE.

Le descrizioni dicono cosa caricare e quali pagine servono. La completezza va
indicata nella singola descrizione, senza aggiungere una regola automatica.
Il passaporto richiede le pagine indicate; l’IBAN mantiene l’invito a coprire i
dati non necessari. Il campo «dove lo trovo» contiene le istruzioni per ottenere
il documento. Gli anni, i requisiti e le riserve sulla verifica dell’operatore
seguono la ricerca normativa già presente.

Il test `packages/core/src/catalog-copy.test.ts` controlla ogni descrizione in
ogni lingua: lati ripetuti, completezza ripetuta anche con parole diverse e
ritorno della frase generica sulle tessere. Controlla anche che le indicazioni
sulla completezza e le eccezioni per passaporto e IBAN siano mantenute.

Il test `packages/api/src/citizen-copy.test.ts` usa liste di forme tipiche su
tutti i testi localizzati nei sorgenti core/API/DB e sugli errori `ApiFailure`
italiani. Legge anche le costanti private, senza esportarle per il test.
Esclude i dizionari di riconoscimento e le storie citate dei cittadini.
Le eccezioni sono circoscritte alle chiavi: le frasi «siete/sois/sunteți almeno
2» descrivono il gruppo, alcuni verbi francesi hanno un soggetto in terza
persona, alcuni possessivi spagnoli indicano il genitore o gli intestatari.
Le liste intercettano regressioni frequenti; non sono un controllo grammaticale
completo.

`packages/api/src/citizen-copy-style.ts` fornisce registro e glossario alle
istruzioni AI di intake e traduzione. Il messaggio originale dell’operatore è
conservato, anche quando è in un altro registro. Il fallback locale segue lo
stesso glossario. I test AI controllano le istruzioni senza chiamare un provider.

## Testi del frontend

L'interfaccia del cittadino vive in `apps/web/src/lib/citizen/messages.ts` (it, en) e
`messages-extra.ts` (le altre lingue). Fuori da quei file ci sono testi multilingue scritti a
mano, da allineare quando cambia il glossario: il cartello A4
(`components/console/office-poster.tsx`), i messaggi WhatsApp/SMS con il link
(`components/console/share-citizen-link.tsx`), gli avvisi WhatsApp/SMS e l'elenco dei
documenti da stampare (`lib/citizen/handoff-messages.ts`), la vetrina delle lingue e la demo della homepage
(`components/landing/language-showcase.tsx`, `intake-demo-samples.ts`; le frasi della demo sono
anche un test del backend).
