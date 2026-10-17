# Design e UX

Avanti ha tre pubblici con bisogni opposti: chi gestisce un CAF (landing), il cittadino (spesso
anziano, straniero o poco abituato ai moduli, quasi sempre da telefono) e l'operatore (desktop,
tante pratiche al giorno, ogni minuto conta). Il sistema visivo è unico, la densità no.

## Materiali

| Token                | Valore    | Ruolo                                                  |
| -------------------- | --------- | ------------------------------------------------------ |
| `paper`              | `#f7f8f6` | Sfondo: carta d'ufficio, fredda, non crema             |
| `ink`                | `#141b2d` | Testo: inchiostro blu-nero                             |
| `stamp`              | `#2440b3` | Azioni primarie e stato attivo: il blu del timbro      |
| `marker`             | `#ffe45c` | Evidenziatore: i fatti che Avanti ha capito dal testo  |
| `folder`             | `#dce6f2` | Superfici "lato operatore": l'azzurro della cartellina |
| `ok / warn / danger` | —         | Riservati allo stato del fascicolo, mai decorativi     |

Tipografia: **Bricolage Grotesque** (titoli, larghezza ridotta) e **Atkinson Hyperlegible Next**
per tutto il resto. Atkinson è stato disegnato per lettori ipovedenti: distingue 0/O, 1/l/I, e
regge bene a 16–18 px su schermi economici. Noto Sans Bengali/Arabic si scaricano solo quando
servono (`unicode-range`).

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

## Cosa non diciamo

Niente statistiche inventate, niente "primo", "zero errori" o percentuali di risparmio prima di
una misura documentata (vedi [ricerca](research/README.md)). I numeri compaiono solo nella
console, misurati sulle pratiche reali.
