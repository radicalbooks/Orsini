/* Orsini · un sol Worker per a tot: web estàtica multilingüe (dist/) + API de matrícula + webhook Stripe.
 * Serveix orsini.radicalbooks.coop i és l'origen que WordPress (radicalbooks.coop/orsini/) intermedia.
 *
 * Ocultació (PRIVATE / PRELAUNCH, per defecte):
 *  - Cloudflare Access protegeix el domini. A més, aquí es verifica el JWT d'Access (defensa en profunditat):
 *    sense JWT vàlid -> 404 per a TOTES les rutes (pàgines, fitxers, API), excepte el webhook signat d'Stripe.
 *  - Capçaleres X-Robots-Tag: noindex i cache privada.
 * Publicació (ORSINI_PUBLIC=true): les pàgines es redirigeixen (301) a l'URL canònica integrada a WordPress.
 * Matrícula: PUBLIC_ENROLLMENT=false -> només des de la previsualització autenticada. Stripe sempre en mode test.
 */
import api from '../../backend/worker.mjs';

const LANGS = ['ca', 'es', 'en'];
const NOT_FOUND = () => new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex, nofollow', 'cache-control': 'no-store' } });

// ---- Cloudflare Access JWT (RS256) ----
let certCache = { at: 0, keys: [] };
const b64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), c => c.charCodeAt(0));
async function accessKeys(team) {
  if (Date.now() - certCache.at < 3600_000 && certCache.keys.length) return certCache.keys;
  const r = await fetch(`https://${team}/cdn-cgi/access/certs`, { cf: { cacheTtl: 3600 } });
  if (!r.ok) return [];
  const { keys = [] } = await r.json();
  certCache = { at: Date.now(), keys };
  return keys;
}
export async function verifyAccess(req, env) {
  const team = env.ACCESS_TEAM_DOMAIN, aud = env.ACCESS_AUD;
  const token = req.headers.get('cf-access-jwt-assertion');
  if (!team || !aud || !token) return null;
  const [h, p, sig] = token.split('.');
  if (!h || !p || !sig) return null;
  let header, payload;
  try { header = JSON.parse(new TextDecoder().decode(b64u(h))); payload = JSON.parse(new TextDecoder().decode(b64u(p))); } catch { return null; }
  if (header.alg !== 'RS256') return null;
  const now = Math.floor(Date.now() / 1000);
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.includes(aud) || !(payload.exp > now) || (payload.nbf && payload.nbf > now + 60) || payload.iss !== `https://${team}`) return null;
  const jwk = (await accessKeys(team)).find(k => k.kid === header.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(sig), new TextEncoder().encode(h + '.' + p));
  return ok ? { email: payload.email || payload.common_name || 'service-token' } : null;
}

function preferredLang(req) {
  const al = (req.headers.get('accept-language') || '').toLowerCase();
  for (const part of al.split(',')) { const l = part.trim().slice(0, 2); if (LANGS.includes(l)) return l; }
  return 'ca';
}
function harden(res, isPublic) {
  const r = new Response(res.body, res);
  r.headers.set('x-content-type-options', 'nosniff');
  r.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  r.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  if (!isPublic) { r.headers.set('x-robots-tag', 'noindex, nofollow, noarchive'); r.headers.set('cache-control', 'private, no-store'); }
  return r;
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const isPublic = env.ORSINI_PUBLIC === 'true';
    const isWebhook = url.pathname === '/api/stripe/webhook' && req.method === 'POST';
    const isApi = url.pathname.startsWith('/api/') || url.pathname === '/health';

    // Stripe webhook: verified by Stripe signature inside the API, never by Access.
    if (isWebhook) return api.fetch(req, { ...env, PREVIEW_OK: '' }, ctx);

    const viewer = await verifyAccess(req, env);
    if (!isPublic && !viewer) return NOT_FOUND();

    if (isApi) return harden(await api.fetch(req, { ...env, PREVIEW_OK: viewer ? '1' : '' }, ctx), isPublic);

    // Once public, the integrated WordPress URL is canonical: the subdomain redirects there (except for the WP upstream fetch).
    if (isPublic && !viewer && env.CANONICAL_BASE && req.method === 'GET') {
      const target = new URL(url.pathname.replace(/^\//, '') + url.search, env.CANONICAL_BASE);
      return Response.redirect(target.href, 301);
    }
    if (url.pathname === '/' || url.pathname === '/index.html') return Response.redirect(new URL('/' + preferredLang(req) + '/', url).href, 302);
    if (url.pathname.startsWith('/build.json')) return NOT_FOUND();
    const res = await env.ASSETS.fetch(req);
    return harden(res, isPublic);
  },
  scheduled: (e, env, ctx) => api.scheduled(e, env, ctx),
};
