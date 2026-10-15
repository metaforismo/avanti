# Copilota operatore: confini e persistenza

15 ottobre 2026. Contratti in `@avanti/contracts`; UI di Claude, backend in questa consegna.

Uso: l'operatore legge `GET /cases/:id/ai/brief`, `consistency` e `dsu-prefill`.
La versione è `cases.updatedAt` in ISO. La lettura non modifica quella versione. `POST brief`
rigenera esplicitamente. La conferma di un prefill aggiorna invece la versione e registra
la decisione; le letture residue sono riportate nella nuova cache, perché file e risposte
non sono cambiati: si possono confermare più campi senza nuove chiamate; né bozze né analisi inviano messaggi o modificano una verifica documentale.

Sono state confrontate due forme: JSON nella riga `cases`, oppure cache e decisioni in
relazioni dedicate. La prima semplifica una lettura, ma confonde modifiche del fascicolo,
lease e analisi derivate. La seconda mantiene separati aggiornamento del cittadino,
analisi per versione e conferme umane; è la scelta adottata. Una sola migrazione generata:
`0018_operator_copilot`.

- `packages/core/copilot`: riepilogo euristico, evidenze, controlli deterministici,
  normalizzazione nomi, campi DSU ammessi e applicazione delle sole conferme.
- `packages/core/knowledge`: indice generato da sezioni di ricerca con link ufficiali,
  versione del corpus, recupero BM25 puro. `KnowledgeRetriever` consente un futuro
  recuperatore embeddings senza cambiare l'API. Non è una verifica aggiornata delle norme.
- `packages/ai/operator-tasks`: oggetti `Task`, prompt originali operatore v1 invariati.
  I nuovi prompt lettura DSU/risposta hanno versione `costituzione.1`; selezione DSU
  `costituzione.2`, per distinguere il campo dall’ID opaco della proposta ed escludere
  importi discordanti anche con impronte diverse.
  `fast` per bozze; `reasoning` per sintesi/coerenza/selezione e domanda normativa;
  `vision` per leggere file. Nessuna nuova logica di provider.
- `packages/api/copilot`: autorizzazione CAF, dati minimi, cache persistente con lease,
  budget/telemetria esistenti e decisioni sotto lock dell'operatore e della pratica.

Il lease dura cinque minuti, non tiene una transazione aperta durante la rete. Le
richieste concorrenti attendono fino a 55 secondi e poi ricevono 409. Un risultato
arrivato dopo una modifica o cancellazione non viene pubblicato. Un worker interrotto
è recuperabile dopo il lease; letture autorizzate e manutenzione recuperano la coerenza
mancante. Invio cittadino e completamento analisi documento avviano lo stesso percorso.
Le cache delle vecchie versioni seguono la retention del fascicolo (FK cascade).

Le impostazioni disattivate e il budget esaurito usano cache euristiche separate, senza
chiamate. Le prenotazioni restano responsabilità di `cafAiContext`: anche richieste
contemporanee e letture di molti documenti devono passare l'ammissione prima di ogni
chiamata. Nessun limite è una garanzia sulla fattura del provider.

La lettura DSU richiede importo letterale, citazione breve, pagina valida e confidenza
almeno 0,8. Non somma, annualizza o stima. Una certificazione del medesimo rapporto può alimentare sia saldo sia giacenza, anche
se caricata sotto una sola delle due voci; ciascun valore deve comunque essere letto.
La selezione può soltanto copiare letture
esistenti; valori discordanti per lo stesso campo vengono omessi. Il fallback senza
letture è un elenco vuoto, non numeri ricavati da nomi file o dall'intervista.
L'identificativo pubblico della proposta include un'impronta di documento/importo/pagina:
una vecchia schermata non può confermare un importo nuovo sotto lo stesso ID.
La fonte confermata nel prospetto resta valida solo con documento presente, hash,
abbinamento e campo ancora pertinenti; cambio intestatario/anno, rifiuto o rimozione la
rendono inutilizzabile. I redditi CU nel quadro FC8 sono solo supporto, da classificare
nel gestionale dal CAF: una CU non viene trasformata in reddito complessivo IRPEF.

Nomi del nucleo sono necessari per confrontare gli intestatari; contatti, note interne,
cronologia messaggi e nomi file non entrano nel contesto testuale del dossier. Email,
URL e telefoni presenti nel testo selezionato sono rimossi. I file sono trasmessi solo
al compito documentale per estrarre i campi pertinenti: possono contenere dati personali,
come già nell'analisi documenti, e richiedono la policy dati del CAF.

La richiesta di verifica umana per un documento AI leggibile e completo e il promemoria
generale sul modello annuale rimangono nel dossier originale; nella coerenza sono
segnalazioni informative, non incongruenze del singolo fascicolo.

`aiAttention` conta blocker+warning dell'ultima analisi persistita, anche se precedente
alla versione corrente. `aiPriority` privilegia domande cittadino non lette, poi problemi,
poi revisione rapida soltanto con analisi della versione corrente e tutti i file leggibili.
Le domande non lette sono identificate da punteggiatura interrogativa (anche arabo) e
indizi italiani: non è una classificazione semantica multilingue. La consultazione del
fascicolo marca i messaggi letti; gli endpoint AI non lo fanno. Filtri SQL prima della
paginazione; conteggi coerenti con i filtri.

`aiCitizenAssistant` è disponibile nelle impostazioni e nella vista cittadino; disattivato
mantiene la comprensione locale dei turni senza provider. Le bozze di risposta rimangono
italiane: la traduzione e l'invio restano nel percorso operatore esistente.
