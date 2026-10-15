# Eval copilota — strict-production-2026-10-15-realistic-final

Dataset esclusivamente sintetico. Trasporto: production:createTransport.

Casi: 10; passati: 10; AI: 10; regole: 0. Costo stimato EUR: 0.00868119.

| Caso                                | Motore | Esito |   ms | Tentativi | Ripiego | Dettagli                                                                                                                                              |
| ----------------------------------- | ------ | ----- | ---: | --------: | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| realistic:brief:ready               | ai     | PASS  | 5222 |         1 | —       | {"members":2,"documents":9,"rulesDocuments":0,"expectedStep":"ready_for_practice","actualStep":"ready_for_practice","invalidEvidence":0}              |
| realistic:consistency:ready         | ai     | PASS  | 1974 |         1 | —       | {"members":2,"rulesFindings":1,"aiFindings":0,"repeatedRulesFindings":0,"afterDedup":1}                                                               |
| realistic:brief:uploaded            | ai     | PASS  | 4673 |         1 | —       | {"members":3,"documents":11,"rulesDocuments":0,"expectedStep":"verify_documents","actualStep":"verify_documents","invalidEvidence":0}                 |
| realistic:consistency:uploaded      | ai     | PASS  | 2577 |         1 | —       | {"members":3,"rulesFindings":12,"aiFindings":0,"repeatedRulesFindings":0,"afterDedup":12}                                                             |
| realistic:brief:mixed               | ai     | PASS  | 9206 |         1 | —       | {"members":3,"documents":11,"rulesDocuments":6,"expectedStep":"verify_documents","actualStep":"verify_documents","invalidEvidence":0}                 |
| realistic:consistency:mixed         | ai     | PASS  | 4254 |         1 | —       | {"members":3,"rulesFindings":12,"aiFindings":0,"repeatedRulesFindings":0,"afterDedup":12}                                                             |
| realistic:brief:wrong_year          | ai     | PASS  | 7633 |         1 | —       | {"members":3,"documents":11,"rulesDocuments":0,"expectedStep":"needs_operator_judgement","actualStep":"needs_operator_judgement","invalidEvidence":0} |
| realistic:consistency:wrong_year    | ai     | PASS  | 5588 |         1 | —       | {"members":3,"rulesFindings":16,"aiFindings":0,"repeatedRulesFindings":0,"afterDedup":16}                                                             |
| realistic:brief:large_missing       | ai     | PASS  | 5087 |         1 | —       | {"members":4,"documents":8,"rulesDocuments":0,"expectedStep":"ask_citizen","actualStep":"ask_citizen","invalidEvidence":0}                            |
| realistic:consistency:large_missing | ai     | PASS  | 8877 |         1 | —       | {"members":4,"rulesFindings":13,"aiFindings":0,"repeatedRulesFindings":0,"afterDedup":13}                                                             |
