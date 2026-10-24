# SEO d’Orsini

URL canònica: https://radicalbooks.github.io/Orsini/
Mapa del web: https://radicalbooks.github.io/Orsini/sitemap.xml

## Publicació des del CMS

El contingut es continua editant a `content/`. Després de la publicació habitual de GitHub Pages, el workflow «SEO · publicació i indexació» genera i desplega les pàgines estàtiques actualitzades. No cal copiar manualment els textos al codi HTML.

El generador no necessita dependències externes: `node scripts/build-seo.mjs` i `node scripts/check-seo.mjs`. La plantilla de les fitxes és `scripts/templates/curs.html`. Els cursos actius de `content/cursos/*.json` generen una URL pròpia, metadades, contingut complet, dades Course i enllaços de matrícula. Les URLs antigues amb `curs.html?id=` es mantenen com a redireccions de compatibilitat.

El mapa del web només inclou les 12 pàgines canòniques actuals, sense formularis de prova, resultats de pagament, arxiu retirat ni articles no publicats. No s’inventen dates, professorat, ressenyes ni ofertes de matrícula.

La imatge per compartir és `assets/orsini-social.png` (1200 × 630). Les tipografies locals WOFF2 es precarreguen i mantenen `font-display: swap`.

## Descobriment i mesurament

El workflow envia el mapa d’URLs a IndexNow després de desplegar. Els codis 200/202 indiquen recepció, no indexació ni posicionament. La clau de verificació allotjada al web és específica del protocol, no dona accés al compte ni a cap servei.

Per mesurar impressions, errors i cerques, cal donar d’alta la propietat de prefix d’URL `https://radicalbooks.github.io/Orsini/` a Google Search Console i a Bing Webmaster Tools. Cal afegir al web el fitxer o la metaetiqueta de verificació exacta que proporcionin els serveis i després enviar `sitemap.xml`. No s’hi han afegit codis de verificació ficticis ni eines de seguiment.

`robots.txt` es prepara per a una futura publicació a l’arrel d’un domini. A GitHub Pages, `/Orsini/robots.txt` NO és el fitxer autoritatiu: els cercadors consulten `https://radicalbooks.github.io/robots.txt`. Les directives `robots` de cada HTML funcionen sense tenir accés a l’arrel del domini. El sitemap es declara també als HTML i s’envia a IndexNow.

Qualsevol migració a un domini propi requereix actualitzar `base` als scripts, canònics, sitemap i verificacions. Un canvi de domini ha d’anar acompanyat de redireccions adequades.
