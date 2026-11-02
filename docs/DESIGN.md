# Design e UX

Avanti ha tre pubblici con bisogni opposti: chi gestisce un CAF (landing), il cittadino (spesso
anziano, straniero o poco abituato ai moduli, quasi sempre da telefono) e l'operatore (desktop,
tante pratiche al giorno, ogni minuto conta). Il sistema visivo è unico, la densità no.

## Identità

Avanti si presenta come un oggetto da sportello, non come una startup: carta d'ufficio,
inchiostro blu del timbro, l'evidenziatore giallo con cui l'operatore segna ciò che conta.
Nessun gradiente, nessuna illustrazione generica, nessuna icona "AI" con scintille in primo piano:
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
(`max-w-2xl` per i lead). Cifre che cambiano o si confrontano: `tabular`.

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

Sito pubblico (`app/(site)/site.css`, caricato solo lì):

| Classe / attributo        | Cosa fa                                                            |
| ------------------------- | ------------------------------------------------------------------ |
| `hero-in` + `--d`         | Entrata al caricamento, da CSS (non aspetta l'idratazione), 900 ms |
| `data-reveal`             | Sale di 14 px e compare quando entra in vista, una volta           |
| `data-reveal="stagger"`   | Lo stesso per i figli, 60 ms l'uno dall'altro (massimo 300 ms)     |
| `draw-x`                  | Una linea dentro un reveal si disegna da sinistra (`scaleX`)       |
| `marker-draw`             | Evidenziatore tracciato sotto una parola di un titolo (`scaleX`)   |
| `stamp-press` / `tick-in` | Timbro premuto con piccolo rimbalzo; spunta che compare in scala   |
| `grain` / `grain-dark`    | Grana della carta (SVG di rumore) su fondi chiari o scuri          |
| `ruled`                   | Righe del registro che sfumano in alto negli hero                  |

I reveal partono dopo l'idratazione (`lib/site/reveal.ts`): un attributo aggiunto prima
all'HTML del server è un errore di idratazione. Quello che è già a schermo viene segnato come
visto subito e non lampeggia; solo ciò che sta sotto la piega parte nascosto.

## Pattern di componenti

Riutilizzabili dalla console e dalle pagine del cittadino con gli stessi token; i componenti
del sito stanno in `components/landing`, gli oggetti di brand in `components/brand`.

| Pattern                     | Dove                                                  | Regola                                                                                                                                             |
| --------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Etichetta + titolo + lead   | `SectionIntro`, `PageHero`                            | Etichetta in `type-eyebrow` con filetto di 24 px; un solo `h1` per pagina                                                                          |
| Fascia di chiusura          | `PageCta`, chiusura della landing                     | Fondo `contrast` con grana, un solo passo successivo, pulsante `marker`                                                                            |
| Elenco numerato a filetti   | passaggi al gestionale, sicurezza                     | Numero in mono `stamp`, filetto sopra; per sequenze dopo il prodotto, non per il percorso                                                          |
| Schede di passaggi          | «Come funziona»                                       | `surface` + `shadow-raised`, sollevamento di 2 px all'hover, filo tratteggiato tra i numeri                                                        |
| Immagine del prodotto       | `IntakeDemo`, `DossierPreview`                        | Disegnata sulla pagina vera, `shadow-frame`, «Dati inventati» in didascalia, controlli `aria-hidden`                                               |
| Fogli impilati              | fascicolo della demo                                  | Due fogli dietro, ruotati di +1,4° e −0,8°, mai più di due                                                                                         |
| Timbro                      | `Stamp`                                               | Maiuscolo, bordo 2,5 px, ruotato −7°/−9°, `mix-blend-multiply`; solo per uno stato vero (consegnato, ricevuta) o una regola («decide l'operatore») |
| Biglietto della coda        | `QueueTicket`                                         | Forma del logo con le tacche colorate come il fondo (`--notch`); decorativo                                                                        |
| Casella da spuntare         | «Prima di trattare dati reali»                        | Vuota quando la cosa va ancora fatta: non disegnare spunte per impegni futuri                                                                      |
| CTA ripetuta                | hero, dopo la console, chiusura, header, barra mobile | Sempre verso `#pilota`, stesso verbo («Parliamo del pilota»)                                                                                       |
| Barra in basso sul telefono | `MobileCta`                                           | Compare dopo l'hero, sparisce sopra modulo, chiusura e footer; `inert` quando nascosta, safe area                                                  |
| Header                      | `SiteHeader`                                          | Sfondo che compare scorrendo (solo opacità), sezione attiva con `aria-current="location"`                                                          |
| FAQ                         | `details` nativo                                      | Risposta che sale all'apertura, icona + che ruota di 45° e si riempie di `stamp`                                                                   |
| Numeri con fonte            | `CountUp`                                             | Il server scrive il valore finale; conta solo se arriva da sotto la piega; fonte linkata sotto                                                     |
| Focus                       | globale                                               | Contorno `stamp` di 2 px a 2 px di distanza; su fondo scuro `outline-marker`                                                                       |

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
