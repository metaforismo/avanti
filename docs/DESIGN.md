# Design e UX

Avanti ha tre pubblici con bisogni opposti: chi gestisce un CAF (landing), il cittadino (spesso
anziano, straniero o poco abituato ai moduli, quasi sempre da telefono) e l'operatore (desktop,
tante pratiche al giorno, ogni minuto conta). Il sistema visivo è unico, la densità no.

## Identità

Avanti si presenta come un oggetto da sportello, non come una startup: carta d'ufficio,
inchiostro blu del timbro, l'evidenziatore giallo con cui l'operatore segna ciò che conta.
Nessun gradiente vistoso (solo luci radiali appena percettibili sul sito), nessuna illustrazione generica, nessuna icona "AI" con scintille in primo piano:
il prodotto si mostra com'è, con dati inventati dichiarati.

### Marchio

Il segno è un **biglietto della coda** (il numero di carta che si prende allo sportello) con una
freccia che va avanti, ritagliata nel giallo evidenziatore. Il logotipo è «Avanti» in Bricolage
Grotesque bold, larghezza 92%, tracking −0.02em, accanto al segno a 28 px.

| Uso                          | File                                                                    |
| ---------------------------- | ----------------------------------------------------------------------- |
| Segno a colori (predefinito) | [`docs/brand/avanti-mark.svg`](brand/avanti-mark.svg)                   |
| Monocromo (fax, stampa b/n)  | [`docs/brand/avanti-mark-mono.svg`](brand/avanti-mark-mono.svg)         |
| Su fondo scuro               | [`docs/brand/avanti-mark-reversed.svg`](brand/avanti-mark-reversed.svg) |
| Nel codice                   | `components/brand/mark.ts` (tracciati), `logo.tsx`, `app/icon.svg`      |

Regole: area di rispetto pari a metà altezza del segno; minimo 16 px; la freccia è gialla solo
dentro il biglietto blu, su fondo scuro si usa la versione invertita. Il marchio non va mai accanto a loghi di enti pubblici: Avanti non è la PA e non è un CAF.

## Colori

Token semantici in `apps/web/src/app/globals.css`, esposti a Tailwind con `@theme inline`
(`bg-paper`, `text-ink-2`, `ring-line-field`…). Nessun componente usa esadecimali: il tema scuro
della console ridefinisce gli stessi nomi. Contrasti misurati (WCAG 2.2) sul fondo indicato.

| Token                  | Chiaro                            | Ruolo                                                     | Contrasto                     |
| ---------------------- | --------------------------------- | --------------------------------------------------------- | ----------------------------- |
| `paper`                | `#f7f8f6`                         | Sfondo: carta d'ufficio, fredda, non crema                | —                             |
| `surface` / `sunk`     | `#ffffff` / `#eef1f0`             | Schede; fasce e campi incassati                           | —                             |
| `ink`                  | `#141b2d`                         | Testo principale: inchiostro blu-nero                     | 16,9 su paper                 |
| `ink-2`                | `#485067`                         | Testo secondario, paragrafi lunghi                        | 7,1 su sunk                   |
| `ink-3`                | `#5d6477`                         | Note, didascalie, metadati                                | 5,5 su paper, 4,7 su folder   |
| `line` / `line-strong` | `#dde1e3` / `#c3c9cf`             | Righe e divisori decorativi                               | decorativi                    |
| `line-field`           | `#868d9b`                         | Bordo dei campi dei moduli (WCAG 1.4.11)                  | 3,3 su surface                |
| `stamp`                | `#2440b3`                         | Azioni primarie, link, stato attivo: il blu del timbro    | 8,0 su paper, 8,5 con bianco  |
| `stamp-wash`           | `#e9edfb`                         | Fondo di selezioni e proposte dell'AI                     | stamp sopra: 7,3              |
| `marker`               | `#ffe45c`                         | Evidenziatore: i fatti capiti dal testo; mai per il testo | ink sopra: 13,5               |
| `folder`               | `#dce6f2`                         | Superfici "lato operatore": l'azzurro della cartellina    | stamp sopra: 6,8              |
| `ok / warn / danger`   | `#1d7448` / `#9a5500` / `#b8322a` | Solo stato del fascicolo, mai decorativi                  | ≥ 4,9 sul rispettivo `*-wash` |
| `contrast`             | `#141b2d`                         | Fasce invertite (sezione operatori), tooltip, avatar      | bianco sopra: 16,9            |

**«Selezionato» ha un solo aspetto per area.** Scelta di un valore (lingua della demo, risposte
del cittadino): `stamp-wash` con anello `stamp` e spunta. Segmento o scheda attiva nella console:
`surface` con anello `line`. Il nero pieno non è uno stato di selezione.

**Documento mancante, un colore per area** (`components/ui/missing.ts`). Per l'operatore un
obbligatorio mancante blocca la pratica: `danger` (stato «Mancante», «Da guardare», «manca» nel
foglio DSU). Per il cittadino è un passo da fare, non un suo errore: `warn`. Le immagini del
prodotto sul sito seguono l'area che mostrano: il fascicolo dell'hero è dell'operatore, quindi
`danger-wash`.

Il tema scuro esiste solo per la console (vedi sotto). Landing e pagine del cittadino restano
chiare di proposito.

## Tipografia

**Bricolage Grotesque** per i titoli (assi `opsz` e `wdth` sul sito e nella console, solo peso
nelle pagine del cittadino) e **Atkinson Hyperlegible Next** per tutto il resto. Atkinson è stato
disegnato per lettori ipovedenti: distingue 0/O, 1/l/I, e regge bene a 16–18 px su schermi
economici. Noto Sans Bengali/Arabic si scaricano solo quando servono (`unicode-range`).
Atkinson Hyperlegible Mono solo per codici e tasti.

| Utility           | Dimensione                  | Uso                                         |
| ----------------- | --------------------------- | ------------------------------------------- |
| `type-hero`       | 46 → 96 px, interlinea 0,98 | Un solo titolo per pagina, nella landing    |
| `type-page`       | 38 → 60 px                  | Titoli delle pagine secondarie del sito     |
| `type-section`    | 32 → 52 px                  | Titolo di sezione                           |
| `type-subsection` | 28 → 40 px                  | Sezione minore o di chiusura                |
| `type-title`      | 24 px, semibold             | Titoli di scheda e di colonna               |
| `type-lead`       | 17 → 20 px, interlinea 1,55 | Paragrafo sotto un titolo di sezione        |
| `type-eyebrow`    | 13 px, maiuscoletto +0,06em | Etichetta sopra il titolo di sezione        |
| `text-base`       | 16 px                       | Testo corrente (cittadino: mai sotto 16 px) |
| `text-body-sm`    | 15 px                       | Righe dense della console                   |

Tracking ottico: Bricolage stringe già da sé ai corpi grandi (asse `opsz`), quindi i titoli
editoriali vanno da −0,008em verso −0,006em man mano che crescono, larghezza 96–98% e peso
650–660. Con −0,022em e larghezza 88% «rr», «fa» e «sc» si toccavano.

Titoli con `text-wrap: balance`, paragrafi con `pretty`, al massimo ~65 caratteri per riga
(`max-w-2xl` per i lead). I lead centrati hanno `text-balance` e `max-w-[34rem]`: niente parola
orfana all'ultima riga.

**Apostrofo tipografico.** Nei testi italiani e francesi l'apostrofo tra due lettere è sempre ’
(mai `'` né `&apos;`), titoli compresi: a 52 px quello dritto quasi sparisce. Fanno eccezione i
codici e i valori, e le frasi del cittadino che il backend prova così come si digitano
(`intake-demo-samples.ts`: la pagina le disegna con ’). `lib/site/typography.test.ts` fallisce se
l'area del sito ne contiene uno dritto. Cifre che cambiano o si confrontano: `tabular`.

## Spaziature, griglia, forme

- Scala di Tailwind (4 px). Ritmo del sito: sezioni `py-20 lg:py-28`, titolo → contenuto
  `mt-12/14`, etichetta → titolo `mb-4`. Contenitore `max-w-6xl`, margini `px-4 sm:px-6`.
- Raggi: `xs` 4 · `sm` 6 (pulsanti, campi) · `md` 10 · `lg` 16 (schede) · `xl` 22 (immagini del
  prodotto). Un elemento annidato ha un raggio minore del contenitore.
- Ombre: `shadow-raised` per schede su carta, `shadow-float` per ciò che sta sopra (fogli,
  menu), `shadow-frame` per le immagini del prodotto nella landing, `shadow-dock` per le barre
  in basso. Su fondo scuro si usa l'anello `ring-on-contrast/10`, non l'ombra.
- Bersagli: 44 px sul sito e nella console da telefono, 56 px per le scelte del cittadino.

## Iconografia

Lucide, tratto 2 px, a 16 px nel testo denso e 20 px negli elenchi; colore `stamp` per spunte
ed elenchi, `marker` sulle fasce scure, colori di stato solo per lo stato. Un'icona accompagna
sempre una parola, tranne i controlli universali (menu, chiudi) che hanno un `aria-label`.
Niente icone di "magia" (scintille, bacchette) fuori dalle etichette che segnalano una proposta
dell'AI.

## Principi

1. **Una domanda alla volta.** Nel flusso cittadino ogni schermata chiede una cosa sola. Le
   scelte si toccano e inviano subito (niente "seleziona poi conferma"), target ≥ 56 px.
2. **Le sue parole prima del modulo.** Il cittadino può sempre scrivere a parole sue, anche a
   metà intervista. L'evidenziatore della landing racconta proprio questo.
3. **Cosa manca, prima di tutto.** Checklist ordinata per persona e con le voci da fare in
   cima; nella console prima i bloccanti, poi gli avvisi, poi il resto.
4. **Mai un vicolo cieco.** Ogni errore dice cosa fare: link scaduto → chiedi un nuovo link;
   foto troppo grande → la riduciamo noi, e se non riusciamo spieghiamo come rifarla.
5. **Trasparenza AI.** Il cittadino lo sa dall'inizio (art. 50 AI Act) e ogni risposta
   automatica è etichettata. L'operatore vede motore (AI/euristico) e certezza di ogni analisi.
6. **Movimento solo come risposta.** Un unico momento orchestrato (la demo della landing),
   per il resto solo transizioni che spiegano un cambiamento. Con `prefers-reduced-motion`
   restano solo dissolvenze brevi: niente scorrimenti, scale o cicli.

## Dettagli che contano

- Foto dal telefono ridimensionate nel browser (max 2400 px, JPEG 85%) prima dell'upload: il
  limite di 4 MB non diventa un problema per il cittadino.
- Upload con barra di avanzamento reale (XHR), errori per singolo file, più pagine per voce.
- Il link personale non finisce nel `Referer` (`referrer: no-referrer`) né nei motori di ricerca.
- Ripresa della pratica sullo stesso telefono riaprendo il QR dello sportello.
- Lingua cambiabile in ogni momento; arabo in RTL con icone direzionali specchiate.
- Console: filtri nell'URL (condivisibili), coda che si aggiorna da sola, note interne salvate
  all'uscita dal campo, visore documenti navigabile con le frecce.
- Fascicolo: il titolo è la persona (quaranta «ISEE ordinario» al giorno si distinguono dal
  nome), le azioni restano in una barra in alto mentre si scorre, «← Pratiche» torna alla coda
  con gli stessi filtri, gli stati della checklist stanno in colonna. La sessione scaduta è una
  barra attaccata al bordo superiore, mai una scheda sopra il contenuto.
- Cartello A4 stampabile per la sala d'attesa, con QR e titolo in otto lingue; QR a schermo
  intero per chi è seduto allo sportello.
- I fatti dedotti dal testo libero sono evidenziati e sempre modificabili.
- Il cittadino sa che può interrompere: i documenti restano salvati e il link è a portata.
- La revisione (e il suo cronometro) parte alla prima azione dell'operatore, non all'apertura.

## Tema scuro

Solo la console operatore segue l'impostazione scura del sistema: chi la usa tutto il giorno
ne beneficia. Pagine del cittadino e landing restano chiare di proposito (documenti, foto e
moduli si leggono meglio su carta). I colori si ridefiniscono tramite token semantici
(`contrast`/`on-contrast`, `on-stamp`, `scrim`, `chart-*`) sotto `:root.console`: nessun
componente conosce il tema. La coppia di colori del grafico è validata separatamente per lo
sfondo chiaro e per quello scuro.

## Prestazioni

- Nessuna libreria di validazione nel browser: le costanti condivise arrivano da
  `@avanti/contracts/constants` (senza zod); il server valida ogni richiesta con i contratti.
- Font di scrittura non latina scaricati solo se la pagina li usa (`unicode-range`).
- Niente `backdrop-filter` sulle barre fisse del flusso cittadino: costa sui telefoni economici.
- Le barre di avanzamento animano `transform`, non la larghezza.

## Motion

Il movimento risponde a qualcosa (un'azione, un'informazione che arriva) e non decora. Regole
per tutte le aree:

- **Solo `transform` e `opacity`.** Unica eccezione: il tratto dell'evidenziatore sul testo del
  cittadino nella demo (`background-size`), perché segue le righe a capo; dura 500 ms, una volta.
- **Curve** (`globals.css`): `--ease-out` per entrate, uscite e feedback; `--ease-drawer` per
  fogli e pannelli da un bordo; `--ease-in-out` per ciò che si sposta sullo schermo. Solo sul sito
  (`(site)/site.css`): `--ease-out-expo` per ciò che arriva una volta (reveal, hero). Mai
  `ease-in`.
- **Durate:** feedback 100–160 ms, menu e popover 150–250 ms, fogli 300–340 ms; sul sito i
  reveal 600–800 ms. Le uscite sono più rapide delle entrate.
- **Header del sito:** `backdrop-filter: blur(14px) saturate(160%)` statico (solo opacità che
  cambia) quando la pagina si muove; sopra le fasce `data-header="dark"` (operatori, dati) le due
  tinte (carta e `contrast`) si incrociano in 200 ms e la barra diventa scura, con voci
  `on-contrast`, CTA `marker` e marchio invertito. Solo per fasce a tutta larghezza: la scheda di
  chiusura è inset, e una barra scura sulla carta chiara sarebbe grigia ai lati. Il divieto di
  `backdrop-filter` vale per le barre del cittadino, non per il sito.
- **Menu mobile del sito:** foglio a tutto schermo sotto la barra (64 px), pagina bloccata e
  `inert`, voci in `font-display` 28 px alte 56 px; le voci salgono di 8 px con 40 ms tra l'una e
  l'altra (240 ms), la chiusura è una dissolvenza di 150 ms. In basso un solo tasto da 52 px e
  «Accedi» come link. Si chiude con Esc, con un clic su una voce e allargando la finestra.
- **Pressione:** i pulsanti scendono a `scale(0.98)` su `:active`; le pillole della lingua a 0,96.
  Gli hover (sollevamento di 2 px delle schede, freccia che avanza) solo dove c'è un puntatore:
  Tailwind 4 li mette già sotto `@media (hover: hover)`.
- **Movimento ridotto:** le entrate diventano dissolvenze di 150 ms, niente slittamenti, scale o
  cicli; la demo mostra subito il fascicolo finito; i reveal non nascondono nulla; i numeri non
  contano. Lo spinner continua a girare, più lento: è uno stato.
- **Prestazioni:** niente librerie di animazione. Reveal e conteggi con un solo
  IntersectionObserver per pagina; niente `backdrop-filter` sulle barre del cittadino.

Console e cittadino:

- Dialoghi: sul telefono un foglio che sale dal basso, da `sm` una scheda che compare al
  centro. I pannelli laterali (aiuto del cittadino, «Chiedi al fascicolo») scorrono dal bordo
  in cui stanno, specchiati in RTL. I menu crescono dal pulsante che li apre.
- Non animiamo ciò che l'operatore ripete decine di volte al giorno da tastiera: la ricerca
  ⌘K si apre di colpo, il visore cambia documento con le frecce senza transizioni.
- Un badge di stato si anima solo quando cambia (documento caricato, voce verificata), non
  all'apertura della pagina (`components/ui/use-changed.ts`).
- Passaggi del cittadino (`citizen.css`, caricato solo dal flusso del cittadino): il passo entra
  con una dissolvenza (`cz-step`, 180 ms) e i suoi blocchi salgono di 14 px uno dopo l'altro
  (`cz-in`, 420 ms, 55 ms tra l'uno e l'altro, al massimo sei: `rise(i)` in `motion.ts`).
  Tornare indietro li fa scendere dall'alto (`--step-dir`). Verticale di proposito: uno
  slittamento laterale manda la pagina del telefono in scorrimento orizzontale per tutta la sua
  durata. Il contenitore che si anima sposta anche i figli `fixed`: le barre in basso dei passaggi
  vanno in un portale (`createPortal` su `body`) con `lang` e `dir` propri. Con movimento ridotto
  restano solo 150 ms di dissolvenza, senza ritardi.
- Conferme: `cz-pop` (460 ms, piccolo rimbalzo) con `cz-ring`, un anello che esce dal segno una
  volta sola (scala e opacità, colore da `--cz-ring-color`): la voce che diventa pronta, la
  pratica inviata. Il biglietto con il codice entra con `cz-ticket` (640 ms, si assesta con una
  piccola rotazione). Un segno che c'era già all'apertura non si anima (`useChanged`).
- Fogli (`components/citizen/sheet.tsx`, `sheet-drag.ts`): sul telefono salgono dal bordo (340 ms,
  `--ease-drawer`) e seguono il dito 1:1 verso il basso dalla maniglia o dal titolo, mai dal
  contenuto che scorre; al rilascio si chiudono per distanza (> 110 px) o velocità (> 0,6 px/ms),
  altrimenti tornano su con una molla di 320 ms; verso l'alto la resistenza è 1/6. Niente
  render per movimento: la `transform` si scrive sull'elemento. Da `sm` il foglio è una scheda al
  centro e non si trascina. Il pannello dell'assistente si chiude allo stesso modo dalla barra del
  titolo.
- Caricamento foto: la miniatura è la foto scattata (URL locale, revocato a fine caricamento)
  sotto un velo che si alza con l'avanzamento, poi uno spinner mentre Avanti la legge; PDF e HEIC
  mostrano l'icona del file.
- Console: niente entrate di pagina, transizioni di colore a 100 ms su voci e righe. La barra
  delle azioni in basso del telefono non entra: è parte della pagina. I tooltip compaiono dopo
  500 ms con una dissolvenza (poi 300 ms per passare da uno all'altro). Tutto il
  resto sotto 200 ms. Le classi stanno in `components/console/motion.css` (importato dalla
  shell, non in `globals.css`): `console-viewer` fa entrare il visore dal bordo destro in 200 ms
  (e si chiude di colpo: il contenuto segue l’URL, già vuoto), `console-arrive` fa salire di 4 px una conferma o un errore appena arrivati.
  Con movimento ridotto restano dissolvenze di 120 ms. La barra di avanzamento dei documenti
  nella coda anima `scaleX`, non la larghezza.

Sito pubblico (`app/(site)/site.css`, caricato solo lì):

**Coreografia dell'hero**, ritardi di partenza: badge 0 · parole del titolo da 80 ms, 50 ms l'una
dall'altra · lead 280 · CTA 360 · fatti 420 · banco 520. La CTA è leggibile entro 500 ms e tutto è
fermo entro 1,3 s (l'evidenziatore sotto «pronto» parte a 520 ms e dura 500). La maschera di ogni
parola ha spazio per l'ascendente della «f» e il discendente della «p» (padding 0,14/0,16em con
margine negativo uguale) e la parola parte trasparente: un bordo netto non mostra mai mezza
lettera. Con movimento ridotto è una dissolvenza di 150 ms senza ritardi.

| Classe / attributo          | Cosa fa                                                                          |
| --------------------------- | -------------------------------------------------------------------------------- |
| `hero-in` + `--d`           | Entrata al caricamento, da CSS (non aspetta l'idratazione), 700 ms               |
| `data-reveal`               | Sale di 14 px e compare quando entra in vista, una volta                         |
| `data-reveal="stagger"`     | Lo stesso per i figli, 60 ms l'uno dall'altro (massimo 300 ms)                   |
| `draw-x`                    | Una linea dentro un reveal si disegna da sinistra (`scaleX`)                     |
| `marker-draw`               | Evidenziatore tracciato sotto una parola di un titolo (`scaleX`)                 |
| `stamp-press` / `tick-in`   | Timbro premuto con piccolo rimbalzo; spunta che compare in scala                 |
| `grain` / `grain-dark`      | Grana della carta (SVG di rumore) su fondi chiari o scuri                        |
| `ruled`                     | Righe del registro che sfumano in alto negli hero                                |
| `hero-word`                 | Titolo dell'hero parola per parola (600 ms), ognuna sale dalla sua riga          |
| `hero-stage` + `stage`      | Il banco della demo arriva inclinato (24 px, 6°) e si raddrizza, 800 ms          |
| `flow-dot` / `flow-pulse`   | Passaggio cittadino → fascicolo: un punto per fatto, freccia Avanti              |
| `land-flash`                | La riga del fascicolo che riceve un fatto lampeggia di giallo                    |
| `fill-in` + `--i`           | Quadretti della figura 10×10 dei numeri, uno dopo l'altro                        |
| `thread`                    | Calendario del pilota: un tratto per passo, dal centro di un punto al successivo |
| `menu-sheet` / `menu-item`  | Menu mobile: dissolvenza 150 ms, voci che salgono di 8 px (40 ms l'una)          |
| `fade-x`                    | Riga scorrevole sfumata dove continua (`--fade-s`, `--fade-e`), mai tagliata     |
| `press-on-reveal`           | Timbro premuto quando la sua immagine entra in vista                             |
| `spotlight`                 | Luce sotto le celle delle fasce scure che segue il puntatore                     |
| `cta-sheen`                 | Riflesso che attraversa la CTA principale all'hover, una volta                   |
| `band-light` / `edge-light` | Luce dall'alto sulle fasce scure; filo luminoso sul bordo dell'immagine          |

I reveal partono dopo l'idratazione (`lib/site/reveal.ts`): un attributo aggiunto prima
all'HTML del server è un errore di idratazione. Quello che è già a schermo viene segnato come
visto subito e non lampeggia; solo ciò che sta sotto la piega parte nascosto.

## Pattern di componenti

Riutilizzabili dalla console e dalle pagine del cittadino con gli stessi token; i componenti
del sito stanno in `components/landing`, gli oggetti di brand in `components/brand`.

| Pattern                     | Dove                                                          | Regola                                                                                                                                                                                                           |
| --------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Etichetta + titolo + lead   | `SectionIntro`, `PageHero`                                    | Etichetta in `type-eyebrow` con filetto di 24 px; un solo `h1` per pagina                                                                                                                                        |
| Fascia di chiusura          | `PageCta`, chiusura della landing                             | Fondo `contrast` con grana, un solo passo successivo, pulsante `marker`                                                                                                                                          |
| Elenco numerato a filetti   | `RuleList`: sicurezza e accessibilità; passaggi al gestionale | Numero in mono `stamp`, filetto sopra; per sequenze dopo il prodotto, non per il percorso                                                                                                                        |
| Schede di passaggi          | «Come funziona»                                               | `surface` + `shadow-raised`, sollevamento di 2 px all'hover, filo tratteggiato tra i numeri                                                                                                                      |
| Immagine del prodotto       | `IntakeDemo`, `DossierPreview`                                | Disegnata sulla pagina vera, `shadow-frame`, «Dati inventati» in didascalia, controlli `aria-hidden`                                                                                                             |
| Fogli impilati              | fascicolo della demo                                          | Due fogli dietro, ruotati di +1,4° e −0,8°, mai più di due                                                                                                                                                       |
| Timbro                      | `Stamp`                                                       | Maiuscolo, bordo 2,5 px, ruotato −7°/−9°, `mix-blend-multiply`; solo per uno stato vero (consegnato, ricevuta) o una regola («decide l'operatore»)                                                               |
| Biglietto della coda        | `QueueTicket`                                                 | Forma del logo con le tacche ritagliate (maschera, raggio 8 px): buca davvero qualunque fondo; l'ombra è un `drop-shadow` del contenitore; decorativo                                                            |
| Casella da spuntare         | «Prima di trattare dati reali»                                | Vuota quando la cosa va ancora fatta: non disegnare spunte per impegni futuri                                                                                                                                    |
| CTA ripetuta                | hero, chiusura, header, menu, barra mobile, invio del modulo  | Sempre verso `#pilota`, un solo verbo e la freccia («Parliamo del pilota», mai «ISEE», «Parliamone», «Candida»). Il «non impegna» sta nella nota sotto il tasto                                                  |
| Barra in basso sul telefono | `MobileCta`                                                   | Compare dopo l'hero, sparisce sopra modulo, chiusura e footer; `inert` quando nascosta, safe area                                                                                                                |
| Header                      | `SiteHeader`                                                  | Sfondo sfocato che compare scorrendo (opacità), scuro sopra le fasce `data-header="dark"`; voci nell'ordine della pagina; sezione attiva con `aria-current="location"`; focus `stamp` 2 px, `marker` sullo scuro |
| Frecce                      | ovunque                                                       | → (`ArrowRight`, avanza di 2 px all'hover) per andare dentro Avanti, anche «Nel dettaglio» (ruota di 90° da aperto); ↗ solo per i link esterni. Niente ›, ↳                                                      |
| FAQ                         | `details` nativo                                              | Risposta che sale all'apertura, icona + che ruota di 45° e si riempie di `stamp`                                                                                                                                 |
| Numeri con fonte            | `CountUp`                                                     | Il server scrive il valore finale; conta solo se arriva da sotto la piega; fonte linkata sotto                                                                                                                   |
| Focus                       | globale                                                       | Contorno `stamp` di 2 px a 2 px di distanza; su fondo scuro `outline-marker`                                                                                                                                     |

### Cittadino

Un'app, non un sito: un compito per schermo, l'azione principale sotto il pollice, nessun
paragrafo che ripete il titolo.

| Pattern                  | Dove                                    | Regola                                                                                                                                                                                                                                               |
| ------------------------ | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Barra d'azione in basso  | sportello («Inizia»), documenti         | `fixed`, `shadow-dock`, safe area; dentro il `<form>` se invia; il consenso sta nella barra sopra il tasto che sblocca; sotto 640 px d'altezza solo il tasto                                                                                         |
| Controlli dell'header    | aiuto, lingua                           | Pillole piene (`bg-stamp-wash` / `bg-sunk`) alte 44 px, scendono a 0,96; padding superiore con `safe-area-inset-top`                                                                                                                                 |
| Avanzamento              | header dei passaggi                     | Tre segmenti con `scale-x` da `origin-left` (`rtl:origin-right`), verdi i passi fatti; quello attivo si riempie in proporzione (risposte, documenti pronti); nessuna seconda barra nel passo; sotto 640 px d'altezza senza etichette                 |
| Scelta a pillola         | lingua, ruolo della persona             | `stamp-wash` + anello `stamp` + spunta, mai nero pieno; nessuna preselezione; la pillola della lingua tiene la direzione della pagina, il nome in `<bdi lang>`                                                                                       |
| Voce della checklist     | documenti                               | Segno tondo a inizio scheda (tratteggiato da fare, pieno `ok` pronto, `warn` da rivedere) + riga di stato colorata sotto il titolo                                                                                                                   |
| Caricamento              | voce della checklist                    | Stessa coppia su ogni voce da fare: sul telefono «Scatta una foto» `tinted` e «Scegli un file» neutro, alti 48 px, in colonna sotto i 400 px; col mouse «Carica»; sulle voci pronte il link «Aggiungi una pagina»                                    |
| Biglietto della pratica  | inviata                                 | Fondo `stamp`, tacche `paper`, freccia `marker` a fine riga (specchiata in RTL), codice in mono `dir="ltr"`                                                                                                                                          |
| Mancanti da portare      | inviata                                 | Caselle vuote da 18 px (raggio 4, bordo `line-field`), non puntini: sono cose ancora da fare                                                                                                                                                         |
| Bolla del cittadino      | conversazione, aiuto, «Cosa devi fare?» | `bg-stamp`, angolo d'origine stretto (`rounded-ee-md`); la domanda è una didascalia di una riga, la risposta 17 px semibold; in bolla solo l'ultimo scambio, il resto in «Le tue risposte»; la frase del cittadino resta anche se Avanti non capisce |
| Foglio                   | dialoghi sul telefono                   | Maniglia di 40 × 6 px, raggio 28 px, trascinabile verso il basso (vedi Motion); argomenti separati da filetti, non da spazio                                                                                                                         |
| Profondità               | tutto il flusso                         | Ciò che aspetta il cittadino si solleva (`bg-surface` + `shadow-raised`, raggio `xl`); ciò che è fatto resta piatto (solo anello `line`)                                                                                                             |
| Piastrella icona         | sportello, riepilogo, inviata           | 40 px, raggio 12 px, fondo `stamp-wash` e icona `stamp` (`ok-wash` per la privacy): sostituisce i punti elenco                                                                                                                                       |
| Scelta con segno         | domande                                 | Cerchio a inizio riga che si riempie con la spunta (`aria-pressed`); Sì/No sono due tasti affiancati alti 64 px; più risposte: casella                                                                                                               |
| Spiegazioni dopo i tasti | domande                                 | «Perché te lo chiediamo» e «Chiedi all'assistente» stanno sotto le risposte: il pollice arriva prima ai tasti                                                                                                                                        |
| Sezione per persona      | documenti                               | Iniziale in un cerchio `folder`, nome, contatore a pillola (`ok-wash` con spunta quando la persona è a posto)                                                                                                                                        |
| Foto in arrivo           | documenti                               | Miniatura reale con velo e avanzamento, vedi Motion                                                                                                                                                                                                  |
| Composer                 | conversazione                           | Fissa sotto il pollice; con una scheda attiva è una pillola da 48 px che si apre al tocco; dopo un turno l'ultimo tasto della scheda si ferma sopra di lei (`--citizen-dock`, `scroll-padding-bottom`)                                               |
| Riga dell'assistente     | prima di «Ho capito così»               | Una riga sola («Ecco cosa ho capito: controlla qui sotto.»): i dati stanno solo nella scheda                                                                                                                                                         |
| Testo misto              | tutto il flusso in arabo                | Termini italiani nelle frasi tradotte isolati con `<Bidi>` (parentesi comprese, su una riga se corti); valori di `format()` tra FSI/PDI; citazioni del cittadino su una riga propria con `dir="auto"`                                                |
| Voce appena pronta       | documenti                               | Resta dov'è (ordine congelato per la visita) con la spunta `cz-pop`; la spiegazione resta 1,2 s e sfuma in 200 ms, poi la scheda si compatta                                                                                                         |
| «I tuoi dati»            | foglio della privacy                    | In testa chi li vede e fino a quando, subito sotto «Scarica la copia» e «Cancella», il resto in `details` chiusi                                                                                                                                     |
| Biglietto con strappo    | inviata                                 | Due metà separate da una linea tratteggiata con le due tacche; sopra il codice, sotto la pratica e la freccia; ombra del colore `stamp`                                                                                                              |
| Identità dello sportello | intestazione dei passi, ingresso        | Nome del CAF su due righe al massimo (mai troncato con «…»); all'ingresso l'iniziale della prima parola che distingue (non «CAF», «Patronato», «Centro», «di»)                                                                                       |

### Console

Il riferimento è Linear: tante pratiche al giorno, la gerarchia la fa il peso, non il colore.

| Pattern                 | Dove                          | Regola                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Barra laterale          | `ConsoleShell`                | 14 rem, voci alte 36 px in `text-sm`; attiva su `bg-sunk` con l'icona `stamp`, le altre icone `ink-3`                                                                                                                                                                                                                                                                                                                                                                                            |
| Schede di stato         | coda                          | Segmenti alti 32 px; l'attiva è una scheda `surface` con anello `line`, mai invertita; il conteggio da revisionare resta `stamp`                                                                                                                                                                                                                                                                                                                                                                 |
| Riga della coda         | coda                          | 56 px (72 sul telefono), sempre due righe: nome a 15 px semibold (colonna di almeno 220 px, nessun badge accanto), poi metadati a 13 px `ink-3` su una riga sola (`flex-nowrap`): codice, lingua, «arrivata oggi» / «in attesa da 3 giorni»; l'attesa oltre soglia è un orologio `warn` con «9 g», non una pillola. Sul telefono la prima riga ha anche i problemi e la seconda «1/7»                                                                                                            |
| Problemi                | coda                          | Numero colorato con icona da 14 px, senza pillola: bloccanti, avvisi, poi i punti dell'AI (`Sparkles` `stamp` col numero) e gli altri suggerimenti dell'AI come sola icona. Ogni indicatore ha un tooltip che dice da dove viene il conto                                                                                                                                                                                                                                                        |
| Filtri sul telefono     | coda                          | Sotto `md` una riga sola: ricerca (40 px) e «Filtri · n», che apre un foglio con i tre filtri e l'ordinamento. Le schede di stato scorrono di lato con una sfumatura di 24 px a fine riga                                                                                                                                                                                                                                                                                                        |
| Titolo di pagina        | `PageHeader`, fascicolo       | 28 px, peso 650, tracking −0,012em (con −0,022em «rr» e «fa» si toccavano), lead in `text-body-sm` `ink-3`                                                                                                                                                                                                                                                                                                                                                                                       |
| Larghezze               | `PageContainer`               | Due misure, allineate a sinistra a 40 px dalla barra laterale: `wide` (1072 px di contenuto) per tabelle, metriche, rapporto e stato; `form` (720 px) per i moduli. Il fascicolo è un piano di lavoro con la sua colonna laterale (`7xl`)                                                                                                                                                                                                                                                        |
| Indice delle sezioni    | impostazioni                  | Segmenti alti 32 px in una fascia fissa sotto il titolo (`SettingsNav`): l'attivo è `surface` con anello `line` e segue lo scorrimento (scroll-spy); sul telefono la fascia scorre di lato con una sfumatura di 24 px. Ancore e campi a fuoco si fermano sotto la fascia (`scroll-padding-top` della pagina)                                                                                                                                                                                     |
| Salvataggio             | impostazioni                  | La barra «Modifiche non ancora salvate» prende il posto dei segmenti nella stessa fascia (stessa altezza, niente salti) e sta nella colonna del modulo. Mai una barra fissa sul fondo: copre per forza ciò che scorre sotto. «Salva» è un `submit` legato al modulo (`form="…"`); sul telefono il tasto è «Salva», il nome accessibile resta «Salva parametri»                                                                                                                                   |
| Campi numerici          | impostazioni                  | Testo con `inputmode="numeric"`, solo cifre (anche incollate), tante cifre quante ne ha il massimo, unità dentro il campo («giorni», «min», «%»). L'errore dice l'intervallo e l'unità, compare quando si esce dal campo e sparisce appena il valore è giusto; un salvataggio con un errore non parte (`settings-limits.ts`)                                                                                                                                                                     |
| Menu delle azioni       | operatori                     | Le azioni su una persona stanno in un menu «⋯» (44 px sul telefono, 32 sopra), con «Disattiva» in fondo in `danger`; «Riattiva» resta un pulsante visibile. Quattro pulsanti per riga non stanno in 720 px                                                                                                                                                                                                                                                                                       |
| Dato nascosto           | rapporto del pilota           | Sotto ogni «—» c'è il motivo a 13 px («Nascosto: un dato del periodo ha meno di 5 pratiche») e, se il conteggio esatto esiste, il rimando a Metriche. Metriche conta tutto, per uso interno; il rapporto è fatto per essere condiviso e nasconde i gruppi sotto 5: i due numeri non si confrontano senza dirlo (periodo e regola scritti a schermo)                                                                                                                                              |
| Grafico giornaliero     | metriche                      | Disegnato alla larghezza che ha (mai un disegno ridotto: i testi restano da 13 px). Con pochi giorni di dati, o con più di metà dei giorni vuoti, barre affiancate (8 px, raggio 2) e la nota «Pochi giorni di dati»; altrimenti linee. Asse a passi interi (1, 2, 5, 10…), 16 px di margine a destra                                                                                                                                                                                            |
| Testo minimo            | tutta la console              | Mai sotto i 13 px: metadati e note in `text-[0.8125rem]` `ink-3`, anche dentro le pillole                                                                                                                                                                                                                                                                                                                                                                                                        |
| Barra del fascicolo     | fascicolo (desktop)           | Fissa in alto, controlli da 32 px: «← Pratiche», «Prossima pratica», poi «Chiedi» (ghost, ⌘J), i passi secondari ghost, **una sola primaria** (il passo che la pratica aspetta) e «Altro». Tasti nei tooltip con `Kbd`. «Assegna a me» sta accanto all'assegnatario sotto il nome                                                                                                                                                                                                                |
| Barra in basso          | fascicolo (telefono)          | Sotto `lg`: in alto solo «← Pratiche» e «Prossima»; in basso, fissa con `shadow-dock` e safe area, la primaria a tutta larghezza (48 px) e «Altro» quadrato da 48 px, che contiene gli altri passi e «Chiedi al fascicolo». Il contenuto lascia lo spazio e `scroll-padding-bottom` tiene i campi fuori dalla barra. Niente pulsanti flottanti sopra il contenuto                                                                                                                                |
| Striscia del pilota     | fascicolo                     | La domanda alla cieca è una striscia alta 48 px (`stamp-wash/50`) con due pulsanti da 28 px; la scelta registra subito («Non ancora» chiede prima il motivo, sulla stessa striscia)                                                                                                                                                                                                                                                                                                              |
| Tooltip                 | `Tooltip`                     | Fondo `contrast`, 12 px, tasti come keycap chiari; solo puntatore e focus da tastiera, mai sul tocco. Aggiunge al nome del controllo, non lo sostituisce                                                                                                                                                                                                                                                                                                                                         |
| Disattivato             | `Button`                      | Opacità 0,45, saturazione dimezzata, cursore `not-allowed`, nessun hover né pressione: un tasto spento non deve sembrare chiaro o premuto                                                                                                                                                                                                                                                                                                                                                        |
| Primaria nel tema scuro | `Button`, `console-theme.css` | Riempimento `#3b5bdb` con testo bianco (5,9:1), hover `#4c6ef5`: lo `stamp` chiaro del tema scuro resta per link e testo. «Nuova pratica» nella barra laterale è `tinted`: la primaria piena dello schermo è della pagina                                                                                                                                                                                                                                                                        |
| Empty state             | `EmptyState`                  | Icona su una piastrella `surface` con `shadow-raised`, titolo a 16 px, testo `ink-3`; nessun bordo tratteggiato; il titolo è una frase («Nessuna pratica chiusa»)                                                                                                                                                                                                                                                                                                                                |
| Barra laterale (2)      | `ConsoleShell`                | Tre gruppi: lavoro, «Amministrazione» (solo admin, con etichetta), «Aiuto» in fondo sopra l'operatore; «Cerca» è disegnato come un campo                                                                                                                                                                                                                                                                                                                                                         |
| Tabella della coda      | coda                          | Le intestazioni stanno nella fascia alta della scheda (`bg-paper/70`, 36 px); lo scheletro ha le stesse colonne e la stessa altezza di riga                                                                                                                                                                                                                                                                                                                                                      |
| Selezione               | `QueueAssign`                 | Barra fluttuante centrata sulla colonna del contenuto (`shadow-float`, anello `line`), non una fascia a tutta larghezza                                                                                                                                                                                                                                                                                                                                                                          |
| Tasto                   | `Kbd`                         | Un tasto visto dall'alto: 20 px, fondo `surface`, bordo inferiore `line-strong`; dentro un pulsante il tasto è `aria-hidden` (lo dice `aria-keyshortcuts`)                                                                                                                                                                                                                                                                                                                                       |
| Palette ⌘K              | `CommandPalette`              | Righe di 40 px su una riga sola (nome, poi dettagli in `ink-3`, stato come pillola in fondo); evidenziata su `sunk`, senza movimento; piè con ↑ ↓ ↵                                                                                                                                                                                                                                                                                                                                              |
| Visore                  | `DocumentViewer`              | Il titolo è la voce a cui il file è abbinato (in grassetto), la persona in pillola, il nome del file in `ink-3`; se il controllo automatico pensa a un altro tipo, il pannello lo dice in cima («Sembra: … (45%)» con l'icona `warn`). Da `xl` tre colonne: elenco dei file con il punto di stato (14 rem), anteprima su `sunk` come un foglio sul tavolo, decisione e controllo automatico (20 rem). La decisione è in cima con i tasti nei pulsanti; i dati letti sono coppie etichetta/valore |
| Evidenza                | «Da guardare», copilota       | Ogni punto che viene da un file ha «Documento», che lo apre nel visore; se la frase nomina già la voce, la fonte è una freccia → in fondo alla frase, legata all'ultima parola (mai sola a inizio riga), non una riga «Vai alla voce»                                                                                                                                                                                                                                                            |
| Niente doppioni         | copilota, «Da guardare»       | I documenti mancanti stanno solo in «Da guardare»: il copilota dà la sintesi, le incongruenze e il passo suggerito. Il nome della persona non si ripete dopo una voce che lo contiene già (`withMember`)                                                                                                                                                                                                                                                                                         |
| Avvisi ripetuti         | voce della checklist          | Al massimo due avvisi per voce, poi «e altri N avvisi»: con molti file uguali la voce resta leggibile. Il colore sta nell'icona da 14 px (`warn` o `danger`), il testo è `ink-2` a 14 px su due righe al massimo, poi «Mostra tutto»                                                                                                                                                                                                                                                             |
| Dialoghi                | `Dialog` nella console        | Titolo a 20 px e padding di 20 px sotto `:root.console`; anello `line` di 1 px che nel tema scuro disegna il bordo. Un dialogo da leggere (le scorciatoie) mette il focus sul foglio, non sulla X (`focusContent`)                                                                                                                                                                                                                                                                               |
| Dati del cittadino      | ovunque                       | Nomi e nomi di file con `dir="auto"`: un nome arabo tiene la sua direzione anche in una riga italiana                                                                                                                                                                                                                                                                                                                                                                                            |

## Landing

Pubblico e tono in [gtm/pubblico.md](gtm/pubblico.md). **Less is better:** ogni sezione ha un
titolo forte, al massimo una riga di lead e un'immagine che porta il messaggio; i dettagli stanno
nelle FAQ chiuse e nelle pagine dedicate. Sequenza: hero centrato con la demo su un piano di lavoro
→ «Come funziona» con l'immagine fissa che cambia a ogni passaggio (`HowItWorks`) → **operatori
(scuro)** con la console che si inclina e si compone allo scroll → AI («L'AI propone, l'operatore
decide») → cifre con fonte e pratiche → **dati (scuro)** in quattro celle → pilota con modulo
fisso → FAQ → **chiusura (scuro)**. Un solo accento per sezione: blu sul chiaro, giallo sullo
scuro. Le immagini del prodotto (`card-premium`: bordo di 1 px traslucido, luce in alto, tre
ombre) sono disegnate sulle pagine vere, con «Dati inventati»; niente loghi né testimonianze
finché non ci sono clienti veri (lo spiega una FAQ).

Le quattro immagini di «Come funziona» stanno nella stessa cornice (400×340, barra «CAF di prova ·
ISEE» in alto) e cambiano con una dissolvenza incrociata di 220 ms e 6 px di salita; i trattini di
avanzamento restano fissi sopra la cornice fino all'ultimo passo. Il documento mancante segue
l'area che la figura rappresenta (cittadino `warn`, operatore `danger`). Le pagine secondarie
(sicurezza, privacy, accessibilità) hanno un solo `PageHero` (96 px sopra, 64 sotto, `type-page`,
lead `type-lead`) e un solo pattern di contenuto, l'elenco numerato a filetti; la privacy tiene
l'indice laterale.

Scroll-linked dove il browser supporta le animazioni guidate dallo scroll (`scroll-tilt`,
`scroll-compose` in `site.css`, ognuna sulla propria `view()` timeline): altrove, o con
movimento ridotto, l'immagine è semplicemente completa. Nei passaggi i testi non attivi si
attenuano con il colore (`ink-3`), non con l'opacità, così restano AA.

La demo dell'hero è l'unico momento orchestrato: parte quando è in vista; frase evidenziata →
fatto nel fascicolo (5 volte), checklist spuntata riga per riga, poi timbro «Consegnato allo
sportello» e avviso del mancante. Il cambio lingua ridisegna il messaggio con una dissolvenza
e riparte; il fascicolo resta in italiano.

Controlli prima di cambiarla: 320, 375, 768 e 1440 px senza scorrimento orizzontale, zoom al
200% (viewport di 720 px), testi lunghi nei nomi della coda (troncati: sono decorativi) e
nell'email della conferma (`break-all`), axe senza violazioni gravi su tutte le pagine del sito.

## Cosa non diciamo

Niente statistiche inventate, niente "primo", "zero errori" o percentuali di risparmio prima di
una misura documentata (vedi [ricerca](research/README.md)). I numeri compaiono solo nella
console, misurati sulle pratiche reali.
