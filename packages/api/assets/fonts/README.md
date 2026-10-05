# Font dei fascicoli PDF

I font Noto sono distribuiti nel repository ed incorporati nel PDF con un subset dei
glifi usati. Non si contattano Google o altri servizi durante l'esportazione. Noto Sans
copre latino e cirillico; Noto Sans Arabic e Noto Sans Bengali conservano i nomi nelle
scritture dei cittadini. La licenza SIL Open Font License 1.1 è inclusa in `OFL-Noto.txt`.

Fonte ufficiale: [Noto Fonts](https://github.com/notofonts/noto-fonts), consultata il 6 ottobre 2026.
Si usano i TTF statici Regular dell'archivio ufficiale, perché il subset dei font variabili
con questa versione di fontkit produce glifi mancanti nei renderer PDF. I tre file pesano
complessivamente circa 1 MB; il PDF include solo i glifi usati.

| File | Originale | SHA-256 |
| --- | --- | --- |
| `NotoSans.ttf` | [Noto Sans Regular](https://github.com/notofonts/noto-fonts/blob/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf) | `b85c38ecea8a7cfb39c24e395a4007474fa5a4fc864f6ee33309eb4948d232d5` |
| `NotoSansArabic.ttf` | [Noto Sans Arabic Regular](https://github.com/notofonts/noto-fonts/blob/main/hinted/ttf/NotoSansArabic/NotoSansArabic-Regular.ttf) | `ceea25b464a656dc3b26849bab9356740401af62aedf1bfa8b7f0d9b75925b1b` |
| `NotoSansBengali.ttf` | [Noto Sans Bengali Regular](https://github.com/notofonts/noto-fonts/blob/main/hinted/ttf/NotoSansBengali/NotoSansBengali-Regular.ttf) | `6300c5370cd688b0641343de4c786de6d412bb6c578d129dae75e93a0322dcab` |

Font embedding e shaping usano [pdf-lib](https://pdf-lib.js.org/docs/api/classes/pdfdocument#registerfontkit)
con `@pdf-lib/fontkit`. L'esportazione è destinata all'operatore e include le note interne,
identificate esplicitamente; va condivisa soltanto con persone autorizzate.
