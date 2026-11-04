# Orsini · Centre d'estudis radicals

Font única del web d'Orsini (ca/es/en) i de la seva API de matrícula. **Estat: PRIVATE / PRELAUNCH.**

- Continguts: `content/` (català) i `content/i18n/{es,en}/` (traduccions, capa sobre el català). Interfície: `i18n/ui.json`.
- Build: `node scripts/build-site.mjs` → `dist/`. Proves: `node --test backend/worker.test.mjs worker/gate.test.mjs`.
- Desplegament: GitHub Actions → Worker `orsini` (Cloudflare). WordPress `/orsini/` en fa d'intermediari (`wordpress/`).
- Activació i reversió: `ACTIVACIO.md`.

Les traduccions al castellà i a l'anglès són una primera versió completa pendent de revisió editorial; els continguts de prova (consell acadèmic, professorat «Lorem ipsum») continuen marcats com a ficticis i no s'han traduït.
