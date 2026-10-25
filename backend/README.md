# Matrícules Orsini v2 — activació pendent a Cloudflare

Frontend: https://radicalbooks.github.io/Orsini/matricula.html
API existent: https://orsini-matricules-api.simon-657.workers.dev

Aquesta actualització conserva el mode de proves. No accepta claus ni esdeveniments de producció. No s’ha habilitat cap cobrament real. La validació per servidor, el registre complet de dades i els correus requereixen desplegar aquest Worker; el nou frontend comprova `form_version: 2` abans de permetre continuar, per evitar que la versió anterior ignori camps.

## Actualitzar el Worker existent

1. Obre `orsini-matricules-api` al compte Cloudflare que ja el conté.
2. A l’editor del Worker, substitueix el mòdul principal pel contingut de `backend/worker.mjs`. És un únic mòdul ESM sense dependències ni compilació. També està disponible en el paquet `backend/orsini-matricules-v2.zip` com a `worker.js`.
3. Mantén el binding D1 `DB` i els secrets existents `STRIPE_SECRET_KEY` i `STRIPE_WEBHOOK_SECRET`. No copiïs mai aquests secrets al repositori ni al navegador del client. El servidor accepta claus de proves `sk_test_` o `rk_test_`; es prefereixen claus restringides amb els permisos necessaris.
4. Afegeix `SITE_URL=https://radicalbooks.github.io/Orsini/`. Els antics `SITE_ORIGIN` i `SUCCESS_URL` poden romandre configurats, però la v2 genera els retorns a partir de SITE_URL.
5. Desplega. El primer accés crea, de manera idempotent, `registration_details_v2` i `enrollment_mail_outbox` al mateix D1. No es modifica ni s’elimina l’esquema existent, ni es migren dades antigues.
6. Comprova `/health`: ha de retornar `form_version:2` i `mode:test`.
7. Mantén la notificació Stripe a `/api/stripe/webhook` i inclou `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` i `checkout.session.expired`.

## Correu automàtic preparat

El Worker prepara el correu després d’un webhook signat amb `payment_status=paid`, import i moneda correctes. Congela el títol, l’import, el llibre, les dates, el lloc i les condicions acceptades. El text del correu s’edita a `content/correus-matricula.json` des del CMS. Les condicions acceptades s’adjunten en text pla.

Per activar l’enviament amb Cloudflare Email Service:

- Cal un domini remitent verificat i el servei de sortida activat. L’enviament a destinataris arbitraris requereix Workers Paid segons la documentació actual; aquesta tasca NO activa cap pla de pagament.
- Afegeix un binding `EMAIL` de tipus `send_email` amb l’abast de destinataris adequat. El binding sense restriccions de destinatari pot limitar-se als destinataris verificats del compte: comprova-ho amb el servei abans d’obrir matrícules reals.
- Configura `MAIL_FROM` amb el remitent verificat i `MAIL_REPLY_TO` amb l’adreça de suport, per exemple el contacte actual `info@manifestllibres.cat`.
- Afegeix un Cron Trigger `*/15 * * * *` al Worker per enviar la cua pendent quan el servei estigui disponible. Les confirmacions noves també intenten enviar-se després del webhook, sense esperar el cron.
- Els correus de prova porten `[PROVA]` a l’assumpte i un avís de simulació. Sense servei/remitent configurats, el correu queda pendent i la pàgina de resultat ho explica; no diu que ja s’ha enviat.
- Una excepció d’enviament o una interrupció passa a revisió. No es reenvia automàticament un correu de resultat incert, per evitar duplicats. Si es verifica que no es va enviar, un administrador pot retornar únicament aquella fila a `pending` per reintentar-la.

## Dades i seguretat

- El servidor comprova acceptació de condicions i privacitat, longituds, tipus, curs actiu i aforament.
- La reserva i els detalls nous s’escriuen en una transacció. Les peticions repetides amb el mateix identificador i les mateixes dades reutilitzen la sessió ja creada.
- Les places de pagaments asíncrons queden retingudes fins al resultat definitiu. Pagaments tardans o imports incorrectes passen a revisió, sense correu de plaça confirmada.
- La resposta sobre participació política/social/sindical és opcional i requereix una casella separada. Només s’ha preparat per a dades fictícies en el sandbox. L’activació real exigeix validar la base jurídica específica segons RGPD i LOPDGDD; el consentiment, per si sol, pot no ser suficient en aquest àmbit.
- L’adreça, els estudis i la resposta col·lectiva no s’envien a Stripe. Aquesta resposta tampoc no apareix als correus ni a la consulta d’estat. No hi ha registre de cossos de petició ni de dades personals a la consola.
- El resultat necessita un token aleatori de 256 bits, separat de la sessió Stripe. El token viatja en un fragment de retorn (no al servidor de pàgines) i s’envia a l’API només al cos de la consulta d’estat. L’API no retorna nom, email, adreça ni resposta col·lectiva.
- Les dades de matrícula es mantenen en memòria del formulari; no es desen en localStorage ni a l’URL. Només es conserva temporalment la credencial de resultat en sessionStorage per poder recarregar la confirmació.

## Comprovacions

`node --test backend/worker.test.mjs` requereix Node 24 o superior amb `node:sqlite`.
`node scripts/build-seo.mjs` i `node scripts/check-seo.mjs` regeneren i validen el frontend.

S’han provat transaccions, aforament, reintents, validació, signatures rotades, pagaments asíncrons, import alterat, retorn autenticat, manca de servei de correu i duplicats. Les proves no criden Stripe ni envien correus reals.

## Abans d’obrir la venda real

Cal validar programa, dates, lloc, preu definitiu i condicions comercials; la base jurídica del camp opcional protegit; el servei de correu i la verificació del remitent; i completar una prova de pagament i notificació al sandbox. La v2 NO canvia al compte Stripe real i rebutja els seus esdeveniments. El compte real disponible al connector és RADICAL BOOKS SCCL; no s’ha modificat.
