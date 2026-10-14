# MFA operatori: fonti

Consultate il 14 ottobre 2026.

- [RFC 6238, IETF](https://www.rfc-editor.org/rfc/rfc6238): algoritmo TOTP, passo
  predefinito di 30 secondi, segreti unici casuali, protezione delle chiavi, divieto
  di riutilizzo dopo una verifica riuscita (§5.2), vettori ufficiali SHA-1 in Appendice B.
  Avanti usa sei cifre e la finestra ±1 richiesta dal progetto; i vettori ufficiali
  sono a otto cifre, verificati separatamente nel test.
- [Regolamento UE 2016/679, testo ufficiale EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj/ita),
  art. 32: misure tecniche e organizzative adeguate al rischio. La scelta di TOTP per
  gli operatori è una decisione progettuale per proteggere i fascicoli; l'articolo
  non prescrive in generale questo specifico algoritmo e non rende MFA una prova
  sufficiente di conformità.

Il testo EUR-Lex ha richiesto una verifica anti-bot nella sessione di consultazione.
Il contenuto dell’art. 32 è stato riscontrato nella fonte ufficiale del
[Garante: misure di sicurezza](https://www.garanteprivacy.it/it/temi/cybersecurity/misure-di-sicurezza).
