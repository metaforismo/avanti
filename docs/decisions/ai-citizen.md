# Assistente, voce e controlli cittadino

Contratti: `AssistantAsk` → `AssistantReply`; lettura `AssistantHistory`; voce
`TranscribeFields` → `Transcription`; documenti `citizenCheck` e `citizenKeptAt`.

Due alternative esaminate: una tabella di conversazioni e un nuovo worker per ogni
funzione, oppure i messaggi del fascicolo e il runtime AI esistenti. Scelta la seconda:
retention, cancellazione, autorizzazione e budget restano negli stessi confini già verificati.
Una sola migrazione generata da drizzle-kit, `0017_citizen_assistant`.
I contratti cambiano perché il frontend deve distinguere assistente, trascrizione, rilievi
immediati e conferma cittadino dalla verifica dell’operatore.

`packages/core/src/citizen-assistant.ts` costruisce contesto e fallback senza I/O o clock
impliciti. `packages/ai/src/citizen-tasks.ts` definisce compiti `fast` e `audio`, usando il
prompt assistente versione 1 invariato. Intake e freeform conservano i prompt esistenti.
`packages/api/src/citizen-assistant.ts` possiede autorizzazione, persistenza, quote e controllo
di uscita. Il dossier proietta i rilievi deterministici già localizzati; non genera spiegazioni
libere per il controllo documenti. L’analisi euristica non attesta titolarità, pagine o leggibilità.

L’adattatore audio OpenRouter si inserisce nel trasporto esistente con `input_audio` base64,
quindi passa comunque da `runTask`, budget e telemetria. La riserva audio ha una nuova chiamata
al runtime: i modelli generici testo/immagini non sono riserve valide per una registrazione.
La taratura del ragionamento e dei timeout del runtime rimane alla sessione `ai-base`.
Le CLI possono usare l’override di trasporto esplicito per misurare i parametri raccomandati,
segnalandolo nel report, senza cambiare quella logica di produzione.

Il parser audio usa un buffer in memoria e calcola la durata dai pacchetti; non richiede
ffmpeg sul server e supporta anche WebM MediaRecorder senza durata nel contenitore.
Riferimenti: [OpenRouter audio](https://openrouter.ai/docs/guides/overview/multimodal/audio),
[Mediabunny lettura media](https://mediabunny.dev/guide/reading-media-files).

Il riconoscimento documentale ammette gli id dell’intero catalogo noto, non solo quelli
richiesti nella checklist corrente: altrimenti un documento di un’altra pratica viene
rifiutato dal validatore AI e perde proprio l’informazione necessaria per segnalarlo.
Il modello non riceve altri fascicoli. Abbinamento, nome atteso, anno atteso e messaggi
localizzati restano controlli del server. Non è cambiato il prompt `document.analyze`.
