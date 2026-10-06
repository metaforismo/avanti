# ISEE per l’università: raccolta Avanti e verifica CAF

Verifica del **6 ottobre 2026**. Modelli vigenti verificati: DSU 2026; il catalogo
Avanti prepara il 2027 secondo la regola del secondo anno precedente. La modulistica
2027 resta da ricontrollare prima del pilota. Avanti raccoglie documenti, non calcola
l’indicatore né compila/trasmette la DSU.

## Fonti ufficiali e percorso

La richiesta universitaria richiede la DSU estesa: MB.1 più MB.2, quadro C ed
eventualmente D. Con entrambi i genitori nel nucleo (o uno, con l’altro legalmente
separato e non convivente), non servono ulteriori sezioni MB.2 dopo l’identificazione
dello studente e la casella relativa ai genitori. La DSU Mini da sola non basta.
[Istruzioni DSU 2026, parte 1 §2 e parte 3 §§2–2.1.2, pp. 2 e 29–30](https://www.lavoro.gov.it/sites/default/files/strumenti-e-servizi/ISEE-Istruzioni-2026.pdf).

Per lo studente non convivente, l’autonomia richiede congiuntamente due anni fuori
dall’abitazione familiare, in alloggio non familiare, e adeguata capacità reddituale.
Le istruzioni riportano 9.000 euro annui, con le variazioni ammesse e verifica delle
disposizioni dell’ateneo; per coniugati/convivenza di fatto registrata rileva anche
il reddito del coniuge/convivente. In assenza di autonomia, occorre integrare la DSU
dei genitori, eventualmente quadro D. Per il dottorato valgono le regole standard
con possibile nucleo ristretto MB.1rid.
[Istruzioni DSU 2026, parte 3 §2 e §2.1.3, pp. 29–31](https://www.lavoro.gov.it/sites/default/files/strumenti-e-servizi/ISEE-Istruzioni-2026.pdf).

Anche INPS distingue ISEE ordinario e ISEE Università e spiega l’attrazione del
non autonomo nel nucleo dei genitori. Vivere con la moglie o fuori sede non prova,
da solo, l’autonomia per prestazioni universitarie.
[INPS, Tipologie di ISEE](https://www.inps.it/it/it/dettaglio-approfondimento.schede-informative.49936.tipologie-di-isee.html).

## Decisione implementativa

Per il caso comune si riutilizza **la raccolta documentale** `isee_ordinario` con
`university:true`. È una scelta di preparazione Avanti: non si equipara l’attestazione
ordinaria a quella universitaria. `practice.university_review` ricorda al CAF quadro C,
genitori non conviventi, autonomia e dottorato; `practice.full_dsu` segnala i moduli
aggiuntivi. Il nucleo legale e la documentazione aggiuntiva si decidono allo sportello.
La voce dedicata `isee_universitario` resta `coming_soon` nella scelta esplicita.

## Rapporti esteri e mutui: limiti dell’estrazione

Il quadro FC2 riguarda anche rapporti esteri; il marchio bancario non determina
dove sia detenuto il conto. Gli alias Monobank, PrivatBank, BBVA, Banca Transilvania,
BCR e bKash attivano una verifica operatore, non un paese dedotto.
[INPS, Portale unico ISEE, dati da autodichiarare](https://www.inps.it/it/it/dettaglio-scheda.it.schede-servizio-strumento.schede-servizi.Portale-unico-ISEE.html).
BBVA offre anche un conto con IBAN italiano: non va marcato automaticamente estero.
[BBVA Italia, conto e carta con IBAN italiano](https://www.bbva.it/blog/banca-in-pillole/conto-e-carta-con-iban-italiano.html).
bKash è un servizio finanziario mobile: il tipo di rapporto resta da confermare,
senza precompilarlo come deposito.
[bKash, informazioni sulla società](https://www.bkash.com/en/about).

«Mutuo sulla casa» propone proprietà e segnala il mutuo al CAF. Non risponde alla
domanda sul capitale residuo al 31/12/2025: il racconto non specifica quella data.
Il quadro FC3 richiede la verifica del mutuo per acquisto/costruzione.
[Istruzioni DSU 2026, parte 2 §5, pp. 19–20](https://www.lavoro.gov.it/sites/default/files/strumenti-e-servizi/ISEE-Istruzioni-2026.pdf).
