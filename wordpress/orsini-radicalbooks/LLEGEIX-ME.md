# Orsini per a Radical Books · 2.0.0

Integra Orsini a `radicalbooks.coop/orsini/` com a **intermediari** del Worker `orsini.radicalbooks.coop`.
No conté cap còpia dels continguts: la font única és el repositori `radicalbooks/Orsini` (CMS + build ca/es/en).

| Estat | Visitants | Administradors connectats |
| --- | --- | --- |
| Ocult (per defecte) | 404 a `/orsini/` i a totes les subrutes, API inclosa | Vista prèvia privada (franja «VISTA PRÈVIA PRIVADA») |
| Públic | Secció accessible | Igual |

- Ajustos → Orsini: estat, comprovació en viu del Worker (`/health`) i credencial de servei de Cloudflare Access.
- La credencial es pot definir a `wp-config.php` amb `ORSINI_ACCESS_CLIENT_ID` i `ORSINI_ACCESS_CLIENT_SECRET` (recomanat).
- La casella de publicació **només** controla WordPress. Subdomini, Access, matrícula i Stripe són passos separats (`ACTIVACIO.md`).
- Capçalera i peu: franja fina de Radical Books amb el logotip real del tema (llegit de `index.php`), i el **mateix gestor de cookies** de Radical Books. Orsini no té banner propi.
- Exclou `/orsini/*` de qualsevol memòria cau de pàgina.
