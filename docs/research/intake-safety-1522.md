# Avviso di sicurezza nell'intake

Fonte ufficiale: Dipartimento per le Pari Opportunità della Presidenza del Consiglio dei Ministri,
[1522 – Numero Antiviolenza e Antistalking](https://www.pariopportunita.gov.it/it/numeri-utili/1522-numero-antiviolenza-e-antistalking/).
Accesso e verifica online: **15 ottobre 2026**.

Il Dipartimento presenta il 1522 come servizio pubblico gratuito, disponibile 24 ore su 24,
con operatrici specializzate che accolgono richieste di aiuto per violenza e stalking.
Riscontro anche nella [relazione trimestrale settembre–novembre 2025](https://www.pariopportunita.gov.it/media/31sgjiig/relazione-1522-settembre-ottobre-novembre-2025.pdf).
Il messaggio di Avanti indica prima il 112 in caso di pericolo; aggiunge il 1522
quando il racconto presenta indizi di violenza, maltrattamenti o stalking. Non promette
un intervento, una diagnosi o una presa in carico da parte del CAF.

La classificazione locale è prudenziale e legge indizi nelle otto lingue anche se mescolate.
Non riconosce tutte le parafrasi né interpreta il contesto come una persona: anche racconti
negati o storici possono attivarla. Il falso positivo interrompe soltanto quel turno,
non impedisce un successivo avvio esplicito. Le traduzioni richiedono revisione umana.
L'audit conserva soltanto l'evento `citizen.safety_notice` con metadata vuoti; il racconto
che lo attiva non viene aggiunto alla conversazione. La cronologia operatore ha un'etichetta
esplicita già resa dal frontend esistente: non servono nuovi campi nei contratti o migrazioni.
