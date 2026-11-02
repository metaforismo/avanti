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
| `type-hero`       | 46 → 84 px, interlinea 0,98 | Un solo titolo per pagina, nella landing    |
| `type-page`       | 36 → 56 px                  | Titoli delle pagine secondarie del sito     |
| `type-section`    | 32 → 52 px                  | Titolo di sezione                           |
| `type-subsection` | 28 → 40 px                  | Sezione minore o di chiusura                |
| `type-title`      | 24 px, semibold             | Titoli di scheda e di colonna               |
| `type-lead`       | 17 → 20 px, interlinea 1,55 | Paragrafo sotto un titolo di sezione        |
| `type-eyebrow`    | 13 px, maiuscoletto +0,06em | Etichetta sopra il titolo di sezione        |
| `text-base`       | 16 px                       | Testo corrente (cittadino: mai sotto 16 px) |
| `text-body-sm`    | 15 px                       | Righe dense della console                   |

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

## Movimento

- Curve in `globals.css`: `--ease-out` per entrate e uscite, `--ease-drawer` per pannelli e
  fogli che scorrono da un bordo, `--ease-in-out` per ciò che si sposta sullo schermo. Solo
  `transform` e `opacity`; sotto i 300 ms, le uscite più rapide delle entrate.
- Dialoghi: sul telefono un foglio che sale dal basso, da `sm` una scheda che compare al
  centro. I pannelli laterali (aiuto del cittadino, «Chiedi al fascicolo») scorrono dal bordo
  in cui stanno, specchiati in RTL. I menu crescono dal pulsante che li apre.
- Non animiamo ciò che l'operatore ripete decine di volte al giorno da tastiera: la ricerca
  ⌘K si apre di colpo, il visore cambia documento con le frecce senza transizioni.
- Un badge di stato si anima solo quando cambia (documento caricato, voce verificata), non
  all'apertura della pagina (`components/ui/use-changed.ts`).

## Landing

Pubblico e tono in [gtm/pubblico.md](gtm/pubblico.md). Ogni sezione si apre con
`SectionIntro` (etichetta, titolo, lead) e alterna carta e fasce bianche; la fascia scura è
riservata alla sezione operatori e al richiamo finale, così il prodotto spicca. Le immagini del
prodotto sono componenti disegnati sulle pagine vere (`intake-demo`, `dossier-preview` con coda e
fascicolo, `ai-snippets`), con «Dati inventati» in didascalia: niente screenshot che invecchiano,
niente illustrazioni generiche, niente loghi o testimonianze finché non ci sono clienti veri.
Sotto l'hero, quattro fatti verificabili prendono il posto della prova sociale.

Movimento della landing (verificato): l'unico momento orchestrato è l'evidenziatore della demo,
che parte quando è in vista. È l'unica transizione che non usa `transform`/`opacity`
(`background-size` del tratto, che segue le righe a capo e non si può fare con una scala); dura
500 ms una volta sola su poche parole. Con `prefers-reduced-motion` la demo mostra subito il
fascicolo finito. Il resto: dissolvenze, rotazione dell'icona delle FAQ, pressione dei pulsanti.

Controlli prima di cambiarla: 320, 375, 768 e 1440 px senza scorrimento orizzontale, zoom al
200% (viewport di 720 px), testi lunghi nei nomi della coda (troncati: sono decorativi) e
nell'email della conferma (`break-all`).

## Cosa non diciamo

Niente statistiche inventate, niente "primo", "zero errori" o percentuali di risparmio prima di
una misura documentata (vedi [ricerca](research/README.md)). I numeri compaiono solo nella
console, misurati sulle pratiche reali.
