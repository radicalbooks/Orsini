# Orsini · arquitectura, activació i reversió

## Arquitectura (una sola font)

```
repo radicalbooks/Orsini (privat)
  content/ (ca) + content/i18n/{es,en} + i18n/ui.json   ← CMS (Pages CMS) i traduccions
  scripts/build-site.mjs  → dist/{ca,es,en}/            ← build únic
  .github/workflows/orsini.yml → wrangler deploy        ← proves + build + desplegament
        │
        ▼
Worker "orsini" (Cloudflare, compte de la zona radicalbooks.coop)
  orsini.radicalbooks.coop  = web estàtica + /api/* + /api/stripe/webhook
  D1 "orsini" (jurisdicció UE) · Cloudflare Access (app «orsini»)
        ▲
        │ intermediari amb credencial de servei (sense còpia de continguts)
WordPress radicalbooks.coop/orsini/  ← plugin «Orsini per a Radical Books» 2.0
  franja/peu de Radical Books, logotip del tema, gestor de cookies únic de RB
```

- **URL canònica (quan es publiqui):** `https://www.radicalbooks.coop/orsini/{ca|es|en}/…` amb `hreflang` ca/es/en i `x-default` → ca.
- **Subdomini:** en privat, previsualització protegida per Access. En públic, redirecció 301 de cada pàgina a la URL canònica (sense duplicats SEO). L'API i el webhook continuen al subdomini.
- **Cookies:** Orsini no té banner propi ni instal·la analítica. A `/orsini/` es mostra el gestor de Radical Books (`rb_cookie_consent`). El subdomini no mostra cap banner (no hi ha cookies opcionals) i en públic redirigeix al domini principal, de manera que només hi ha un consentiment.

## Estat actual: PRIVATE / PRELAUNCH

| Capa | Control | Valor |
| --- | --- | --- |
| WordPress | Ajustos → Orsini | Ocult → 404 per a visitants |
| Worker | `ORSINI_PUBLIC` | `false` → 404 sense JWT d'Access vàlid |
| Cloudflare Access | app «orsini» | només correus autoritzats + credencial de servei de WP |
| Build | `vars.ORSINI_PUBLIC` (GitHub) | buit → `noindex` a totes les pàgines, `robots.txt` Disallow |
| Matrícula | `PUBLIC_ENROLLMENT` | `false` → només des de la vista prèvia autenticada |
| Stripe | `STRIPE_MODE` / `LIVE_PAYMENTS` | `test` / `false` (el codi rebutja claus i esdeveniments LIVE) |

Es poden comprovar a Ajustos → Orsini (llegeix `/health` del Worker).

## Activació 1 · Publicar la web (sense vendes)

1. GitHub → Settings → Variables → `ORSINI_PUBLIC` = `true` (build indexable).
2. `worker/wrangler.jsonc` → `"ORSINI_PUBLIC": "true"` i commit (desplega).
3. Cloudflare Access → app «orsini» → afegeix una política **Bypass · Everyone** per sobre de les altres (o elimina l'app). Mantén la credencial de servei.
4. WordPress → Ajustos → Orsini → marca «Fer pública la secció» → Desar. Purga la memòria cau.
5. Afegeix l'enllaç a la navegació de Radical Books (o `[orsini_tarjeta]` a Projectes). El sitemap d'Orsini s'activa sol.
6. Comprova en una finestra privada: `/orsini/ca/` 200, `orsini.radicalbooks.coop/ca/` → 301 a `/orsini/ca/`.

## Activació 2 · Matrícula i cobraments (aprovació separada)

Abans: dades fiscals i titular del compte, condicions definitives, IVA i factura, base jurídica del camp opcional, remitent de correu verificat (`EMAIL`, `MAIL_FROM`, `MAIL_REPLY_TO`), alertes.

1. Prova completa en test des de la vista prèvia (targeta `4242 4242 4242 4242`), incloent devolució de prova al tauler d'Stripe.
2. `PUBLIC_ENROLLMENT` = `true` (matrícula en test oberta a tothom, si es vol una prova pública).
3. **LIVE:** requereix un canvi de codi revisat a `backend/worker.mjs` (avui rebutja claus `sk_live_` i esdeveniments `livemode`), secrets LIVE nous, endpoint de webhook LIVE i una compra real autoritzada. No es declara verificat fins llavors.

## Reversió (tornar a ocultar-ho tot)

1. WordPress → Ajustos → Orsini → desmarca «Fer pública» → Desar (404 immediat).
2. `worker/wrangler.jsonc` → `"ORSINI_PUBLIC": "false"`, `"PUBLIC_ENROLLMENT": "false"` → commit.
3. Cloudflare Access → elimina la política Bypass · Everyone.
4. GitHub → variable `ORSINI_PUBLIC` buida → el build torna a `noindex`.
No s'esborra cap dada: D1, continguts i configuració es mantenen.
