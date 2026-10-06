# Amministrazione CAF pilota — verifica locale

PASS su `feat/admin-backend`: test eseguiti sul backend montato nella route Next,
con PGlite e storage locale, senza chiavi esterne. Questa verifica non attesta un
deployment o l’attivazione dello scheduler remoto.

## Comandi

```sh
pnpm format:check
pnpm check
pnpm build
pnpm db:migrate && pnpm db:seed
WATCHPACK_POLLING=1000 pnpm dev --env-mode=loose -- --port=3417
node packages/api/scripts/verify-administration.mjs http://localhost:3417
```

La porta alternativa e il polling seguono il runbook locale del README. Lo script
usa `curl`, conserva i cookie in una directory temporanea privata e la rimuove
alla fine; non stampa password o cookie. Crea solo dati demo: un operatore poi
disattivato, uno sportello e un fascicolo cancellato; ripristina i settings iniziali.

## Curl

33 controlli PASS. Le rotte parametrizzate sotto omettono token e identificativi
generati durante la prova.

| Controllo                              | Metodo | Percorso                        | HTTP |
| -------------------------------------- | ------ | ------------------------------- | ---- |
| health                                 | GET    | `/health`                       | 200  |
| login admin demo                       | POST   | `/auth/login`                   | 200  |
| list operators including inactive demo | GET    | `/operators`                    | 200  |
| create operator                        | POST   | `/operators`                    | 201  |
| login temporary password               | POST   | `/auth/login`                   | 200  |
| cases before password change           | GET    | `/cases`                        | 403  |
| me during forced password change       | GET    | `/auth/me`                      | 200  |
| second temporary session               | POST   | `/auth/login`                   | 200  |
| change password                        | POST   | `/auth/password`                | 200  |
| cases after password change            | GET    | `/cases`                        | 200  |
| other session revoked                  | GET    | `/auth/me`                      | 401  |
| ordinary operator denied settings      | GET    | `/settings`                     | 403  |
| reset password                         | POST   | `/operators/:id/reset-password` | 200  |
| reset revokes old session              | GET    | `/auth/me`                      | 401  |
| login reset password                   | POST   | `/auth/login`                   | 200  |
| deactivate operator                    | PATCH  | `/operators/:id`                | 200  |
| deactivation revokes sessions          | GET    | `/auth/me`                      | 401  |
| inactive operator login                | POST   | `/auth/login`                   | 401  |
| create office                          | POST   | `/offices`                      | 201  |
| edit office without changing slug      | PATCH  | `/offices/:id`                  | 200  |
| printed QR slug still resolves         | GET    | `/offices/:id`                  | 200  |
| get settings                           | GET    | `/settings`                     | 200  |
| patch settings                         | PATCH  | `/settings`                     | 200  |
| create case for erasure                | POST   | `/cases`                        | 201  |
| new link uses seven days               | GET    | `/c/:token`                     | 200  |
| declared household count               | POST   | `/c/:token/turn`                | 200  |
| member list aligns household count     | POST   | `/c/:token/turn`                | 200  |
| upload file before erasure             | POST   | `/c/:token/documents`           | 201  |
| reject wrong deletion reference        | DELETE | `/cases/:id`                    | 400  |
| delete case                            | DELETE | `/cases/:id`                    | 204  |
| deleted case unavailable               | GET    | `/cases/:id`                    | 404  |
| deleted citizen capability unavailable | GET    | `/c/:token`                     | 404  |
| restore demo settings                  | PATCH  | `/settings`                     | 200  |

## Test automatici

Le nuove prove API coprono ogni endpoint, permessi admin, Origin, cross-tenant,
validazione, password temporanee, revoca delle altre sessioni, inattivi, login/reset
concorrenti, ultimo login, email globalmente unica, settings e durata dei nuovi
link, slug entro il limite dell’intake, cancellazione atomica con rollback e retry.
La retention usa un clock iniettato, verifica soglia esatta, durata per tenant,
chiusura/riapertura, lotti, idempotenza e storage indisponibile.

La migrazione conserva hash/password degli operatori preesistenti e assegna un
istante conservativo alle chiusure storiche. Il seed è idempotente, mantiene
l’admin noto e include un operatore inattivo. Il core accetta conteggi diversi dalla
proposta iniziale, mantenendo limiti e validazione dei componenti; la prova API
verifica le identità superstiti e i documenti scollegati. La composizione delle
conferme è verificata con 1, 2 e 3 fatti in tutte le otto lingue.
