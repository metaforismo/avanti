# Percorso del cittadino su un telefono lento

Decisione del 17 ottobre 2026.

## Come si misura

Build di produzione (`next build`, `next start`), Chrome con profilo Pixel 7, CPU rallentata
4×, rete «Slow 4G» di DevTools (562,5 ms di RTT, 1,44 Mbit/s in discesa, 675 kbit/s in
salita), cache disattivata, DB demo appena creato, nessuna chiave AI. Per scenario, media di
due mediane di 3 caricamenti a freddo, alternando la build di partenza e quella nuova. «Pronta» è il primo
istante con la schermata del passo visibile e nessun `aria-busy`. In locale `next start`
serve HTTP/1.1 e non comprime le risposte dell'API: su Vercel (HTTP/2, brotli) i tempi
assoluti sono migliori, le differenze vanno nella stessa direzione.

Su questa rete il limite è la banda: font, CSS e script partono insieme e finiscono insieme,
quindi ogni 18 KB in meno sul percorso critico valgono circa 100 ms, e ogni richiesta che
parte solo dopo gli script costa un RTT intero (~0,6 s).

## Risultati

| Scenario                            | Pronta prima → dopo | FCP prima → dopo | Byte trasferiti |
| ----------------------------------- | ------------------- | ---------------- | --------------- |
| Sportello: «Inizia» → prima domanda | 4,17 → 2,20 s       | —                | —               |
| Pratica, passo esigenza (it)        | 5,43 → 4,13 s       | 5,05 → 4,04 s    | 406 → 366 KB    |
| Pratica, conversazione (it)         | 5,52 → 4,23 s       | 5,21 → 4,06 s    | 410 → 370 KB    |
| Pratica, documenti (it)             | 5,94 → 4,26 s       | 5,61 → 4,14 s    | 426 → 386 KB    |
| Pratica, conversazione (bn)         | 5,77 → 4,38 s       | 5,55 → 4,28 s    | 542 → 502 KB    |
| Pratica, conversazione (ar)         | 5,59 → 4,31 s       | 5,38 → 4,21 s    | 604 → 564 KB    |
| Sportello `/s/[office]`             | 3,92 → 3,66 s       | 1,93 → 1,76 s    | 345 → 393 KB¹   |
| Landing `/`                         | 4,35 → 3,59 s       | 2,10 → 1,93 s    | 487 → 413 KB    |

¹ Include i ~78 KB della pratica scaricati dopo `load` (punto 3); prima di `load` sono 19 KB
di font in meno. JavaScript della pratica invariato (263 KB): i guadagni vengono dall'ordine
delle richieste e dai font.

## 1. La pratica parte insieme agli script

Prima: HTML → script (263 KB) → idratazione → `GET /api/c/:token` → schermata. La lettura
della pratica partiva solo dopo tutto il JavaScript. Ora la pagina server emette
`preload(casePath(token), { as: "fetch", crossOrigin: "anonymous" })`: il browser scarica la
pratica mentre arrivano gli script e il primo `apiFetch` del client riusa la risposta (stesso
URL, modalità `cors`, credenziali `same-origin`). Vale anche per la navigazione dallo
sportello: React applica il preload appena arriva l'RSC.

Dove vale la lettura unica: nei browser Chromium (Chrome, Samsung Internet, Edge su Android e
desktop) con la build di produzione. In sviluppo StrictMode esegue due volte l'effetto e la
seconda esecuzione legge di nuovo. WebKit, cioè Safari e ogni browser su iOS, non passa
ancora un preload `as=fetch` a `fetch()`, e la pratica è `no-store`: lì il preload
scaricherebbe la pratica due volte proprio sulle reti più lente. Per questo
`reusesFetchPreload` lo emette solo quando lo user agent è Chromium e non iOS; Firefox resta
fuori finché non è misurato. Uno user agent indovinato male costa solo il vantaggio del
preload: il client legge la pratica come prima. Scartato il passaggio con uno script inline
che avvia la `fetch` e lascia la promessa all'app: funzionerebbe ovunque, ma non parte nella
navigazione dallo sportello (gli script inline dell'RSC non vengono eseguiti) e legherebbe la
pagina a `'unsafe-inline'` negli script, che la CSP oggi ha solo perché Next lo richiede.

Il token era già nell'URL e nell'HTML; `Referrer-Policy: no-referrer` resta. Il preload parte
quando la rete è più occupata: se la prima lettura si perde per la rete, il client la riprova
una volta dopo 1,5 s prima di mostrare «Riprova». `e2e/citizen-loading.spec.ts` controlla che
il preload venga usato (Chrome lo segnala in console quando non lo è), che dallo sportello a
«Inizia» la pratica sia letta una volta (due in sviluppo) e il nuovo tentativo silenzioso: se
`apiFetch` cambia credenziali o URL, il browser scaricherebbe la pratica due volte senza
errori visibili.

Scartato: leggere la pratica nel server component. L'HTML aspetterebbe una query sul DB prima
di partire e i dati della pratica finirebbero nel payload RSC, oltre che nella risposta
dell'API; inoltre ARCHITECTURE.md ammette le chiamate in-process solo per le GET pubbliche, e
la lettura del cittadino non lo è (serve il token).

## 2. Font: si precarica solo il latino

`subsets` di `next/font` sceglie solo cosa precaricare: tutti i sottoinsiemi restano nel CSS
con il loro `unicode-range`. Con `["latin", "latin-ext"]` ogni pagina del cittadino
precaricava 38 KB di latin-ext (Atkinson e Bricolage) anche in italiano, e la landing 72 KB.
Ora si precarica `latin`; latin-ext si scarica solo dove compaiono ă, ș, ț (rumeno, o il nome
«Română» nella scelta della lingua dello sportello). Il prezzo: una pratica in rumeno aperta a
freddo da un link (SMS, WhatsApp) mostra per un attimo quelle lettere nel font di riserva,
finché latin-ext non arriva (`display: swap`). Dallo sportello di solito è già in cache,
perché la scelta della lingua mostra «Română».

Non toccati: Noto Sans Bengali (106 KB + 26 KB di latino) e Noto Sans Arabic (163 KB + 31 KB)
si scaricano solo nelle pagine in quelle lingue; il loro latino serve perché `:lang(bn)` e
`:lang(ar)` li mettono per primi. Tagli statici per peso sarebbero più file, non meno byte.

## 3. Lo sportello scarica in anticipo la pratica

Dopo «Inizia» servivano in fila: `POST /api/intake`, RSC della pratica, ~71 KB di script della
conversazione, lettura della pratica. Ora `OfficeStart`, dopo l'evento `load` della pagina,
importa `citizen-app`: Turbopack riusa gli stessi chunk per `/pratica`, e dopo «Inizia»
resta solo un chunk condiviso da 10 KB. Partire dopo `load` evita di rubare banda ai font e
alle icone dello sportello. Chi apre lo sportello e non prosegue scarica ~78 KB in più.

Si scarica solo per uno sportello esistente, con il browser in linea e senza Risparmio dati
(`navigator.connection.saveData`); su 2G sì, perché è lì che il tempo dopo «Inizia» pesa di
più. Se il download fallisce, il bundler conserva l'errore per tutta la vita della pagina e
una navigazione client fallirebbe a pratica già creata: in quel caso «Inizia» apre la pratica
con un caricamento completo. Un download ancora in corso viene atteso, perché è lo stesso che
servirebbe alla navigazione.

## 4. Messaggi: le otto lingue restano in un solo chunk

I testi del cittadino (`messages.ts` + `messages-extra.ts`) sono 35 KB compressi, solo su
`/s/[office]` e `/pratica/[token]` (non su landing e console). Caricare solo la lingua in uso
toglierebbe ~29 KB per l'italiano e ~21 KB per le altre lingue (~120–160 ms su Slow 4G), ma
la lingua è nota solo nel browser: sullo sportello dopo l'idratazione, sulla pratica dopo la
lettura del caso. Il chunk della lingua partirebbe quindi dopo gli script e costerebbe un RTT
(~0,6 s) a chiunque non abbia la lingua prevista, cioè proprio a chi usa l'arabo o il
bengalese su un telefono impostato in italiano. Indovinare la lingua sul server
(`Accept-Language`, un cookie) aggiunge stato e un caso d'errore nuovo (chunk non caricato)
per un guadagno minore di quello dei punti 1–3. Da rivedere se i testi superano ~60 KB
compressi o se la lingua della pratica diventa nota al server senza leggere il caso.

## Verificato e lasciato com'è

- **Cache degli asset**: `/_next/static/*` ha già `public, max-age=31536000, immutable`; le
  intestazioni di sicurezza (CSP, HSTS, COOP, CORP) non cambiano.
- **Polling**: solo mentre un documento è `processing`, ogni 2,5 s, a pagina visibile e senza
  richieste in corso; senza AI l'analisi finisce in uno o due cicli. Un `ETag` sulla pratica
  servirebbe solo con analisi AI lunghe.
- **Ridimensionamento delle foto**: provata la decodifica già ridotta (`createImageBitmap`
  con `resizeWidth`/`resizeHeight`) e la preparazione di una foto alla volta. Su Chrome desktop
  il picco di memoria misurato (RSS dei processi) non cambia in modo ripetibile: senza una
  misura su un Android da 2 GB il codice resta com'è. L'orientamento EXIF è già corretto.
- **Componenti pesanti**: foglio dell'assistente, anteprima foto e registratore vocale pesano
  pochi KB ciascuno; i grossi sono Radix Dialog (13 KB) e DropdownMenu (20 KB), già visibili o
  usati nel passo documenti. Caricarli a richiesta aggiungerebbe un RTT alla prima apertura.
