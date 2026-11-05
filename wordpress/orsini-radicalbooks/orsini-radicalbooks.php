<?php
/**
 * Plugin Name: Orsini per a Radical Books
 * Description: Integra Orsini a radicalbooks.coop/orsini/ (ca/es/en) amb el build del repositori radicalbooks/Orsini; la matrícula passa pel Worker d'Orsini. Ocult per defecte: 404 per als visitants, vista prèvia per a administradors.
 * Version: 2.1.0
 * Author: Radical Books
 * Requires PHP: 7.4
 * License: GPL-2.0-or-later
 */
if (!defined('ABSPATH')) exit;

final class RB_Orsini {
	const OPT = 'rb_orsini_v2';
	const SLUG = 'rb-orsini';
	const BASE = 'orsini';
	const VERSION = '2.1.0';

	static function opts() {
		$o = get_option(self::OPT, array());
		return wp_parse_args(is_array($o) ? $o : array(), array(
			'public'    => false,
			'upstream'  => 'https://orsini.radicalbooks.coop',
			'client_id' => '',
			'secret'    => '',
		));
	}
	static function is_public() { return (bool) self::opts()['public']; }
	static function can_preview() { return is_user_logged_in() && current_user_can('manage_options'); }

	/** Service-token credentials: wp-config constants take precedence over the settings page. */
	static function creds() {
		$o = self::opts();
		$id = defined('ORSINI_ACCESS_CLIENT_ID') ? ORSINI_ACCESS_CLIENT_ID : $o['client_id'];
		$se = defined('ORSINI_ACCESS_CLIENT_SECRET') ? ORSINI_ACCESS_CLIENT_SECRET : $o['secret'];
		return array(trim((string) $id), trim((string) $se));
	}

	static function init() {
		add_action('parse_request', array(__CLASS__, 'route'), 0);
		add_action('admin_menu', array(__CLASS__, 'menu'));
		add_action('admin_post_rb_orsini_save', array(__CLASS__, 'save'));
		add_shortcode('orsini_tarjeta', array(__CLASS__, 'card'));
		add_filter('wp_sitemaps_add_provider', array(__CLASS__, 'sitemap_guard'), 10, 2);
		add_action('init', array(__CLASS__, 'register_sitemap'), 20);
	}

	/* ---------------------------------------------------------- Routing */
	static function path() {
		$p = wp_parse_url(isset($_SERVER['REQUEST_URI']) ? wp_unslash($_SERVER['REQUEST_URI']) : '/', PHP_URL_PATH);
		$home = wp_parse_url(home_url('/'), PHP_URL_PATH) ?: '/';
		$p = '/' . ltrim(substr((string) $p, strlen(rtrim($home, '/'))), '/');
		return $p;
	}

	static function route($wp) {
		$p = self::path();
		if ($p !== '/' . self::BASE && strpos($p, '/' . self::BASE . '/') !== 0) return;

		$hidden = !self::is_public();
		if ($hidden && !self::can_preview()) {
			// PRIVATE / PRELAUNCH: the section does not exist for visitors. WordPress renders its normal 404.
			$wp->query_vars = array('error' => '404');
			header('X-Robots-Tag: noindex, nofollow', true);
			return;
		}
		$rest = substr($p, strlen('/' . self::BASE));
		if ($rest === '' ) { wp_safe_redirect(home_url('/' . self::BASE . '/'), 301); exit; }
		if ($rest === '/') { wp_safe_redirect(home_url('/' . self::BASE . '/' . self::lang() . '/'), 302); exit; }
		if (!preg_match('#^/(ca|es|en|api)(/|$)#', $rest)) { $wp->query_vars = array('error' => '404'); return; }
		// Pages and assets come from the bundled build (same source as the Worker); the API always goes to the Worker.
		if (strpos($rest, '/api/') !== 0 && self::serve_local($rest, $hidden)) exit;
		if (strpos($rest, '/api/') !== 0 && is_dir(self::site_dir())) { $wp->query_vars = array('error' => '404'); return; }
		self::proxy($rest, $hidden);
	}

	static function site_dir() { return __DIR__ . '/site'; }

	/** Serve /<lang>/<path> from site/<lang>/ or site/_shared/. Returns false when the file does not exist. */
	static function serve_local($rest, $hidden) {
		$base = realpath(self::site_dir());
		if (!$base || !preg_match('#^/(ca|es|en)(/.*)?$#', $rest, $m)) return false;
		$lang = $m[1];
		$rel = isset($m[2]) ? ltrim(rawurldecode($m[2]), '/') : '';
		if ($rel === '' || substr($rel, -1) === '/') $rel .= 'index.html';
		if (strpos($rel, '..') !== false || strpos($rel, "\0") !== false) return false;
		foreach (array($base . '/' . $lang . '/' . $rel, $base . '/_shared/' . $rel) as $cand) {
			$real = realpath($cand);
			if (!$real || strpos($real, $base . DIRECTORY_SEPARATOR) !== 0 || !is_file($real)) continue;
			$ext = strtolower(pathinfo($real, PATHINFO_EXTENSION));
			$types = array('html' => 'text/html; charset=utf-8', 'css' => 'text/css; charset=utf-8', 'js' => 'text/javascript; charset=utf-8', 'json' => 'application/json; charset=utf-8',
				'svg' => 'image/svg+xml', 'webp' => 'image/webp', 'png' => 'image/png', 'jpg' => 'image/jpeg', 'woff2' => 'font/woff2', 'woff' => 'font/woff', 'txt' => 'text/plain; charset=utf-8', 'xml' => 'application/xml');
			if (!isset($types[$ext])) return false;
			status_header(200);
			header('Content-Type: ' . $types[$ext]);
			header('X-Content-Type-Options: nosniff');
			if ($hidden) { nocache_headers(); header('X-Robots-Tag: noindex, nofollow, noarchive'); }
			elseif ($ext !== 'html') header('Cache-Control: public, max-age=86400');
			if ($ext === 'html') { echo self::decorate(file_get_contents($real), $hidden); } // phpcs:ignore -- build output, escaped at build time.
			else readfile($real);
			return true;
		}
		return false;
	}

	static function lang() {
		if (function_exists('rb_lang')) { $l = rb_lang(); if (in_array($l, array('ca', 'es', 'en'), true)) return $l; }
		$al = isset($_SERVER['HTTP_ACCEPT_LANGUAGE']) ? strtolower(substr((string) $_SERVER['HTTP_ACCEPT_LANGUAGE'], 0, 2)) : '';
		return in_array($al, array('ca', 'es', 'en'), true) ? $al : 'ca';
	}

	/* ---------------------------------------------------------- Proxy (single source: the Orsini Worker) */
	static function proxy($rest, $hidden) {
		$o = self::opts();
		list($id, $secret) = self::creds();
		$method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper($_SERVER['REQUEST_METHOD']) : 'GET';
		if (!in_array($method, array('GET', 'HEAD', 'POST'), true)) self::fail(405);
		$is_api = strpos($rest, '/api/') === 0;
		if ($is_api && $rest === '/api/stripe/webhook') self::fail(404); // Stripe calls the Worker directly.
		$query = isset($_SERVER['QUERY_STRING']) && $_SERVER['QUERY_STRING'] !== '' ? '?' . $_SERVER['QUERY_STRING'] : '';
		$url = rtrim($o['upstream'], '/') . $rest . $query;

		$headers = array('Accept' => isset($_SERVER['HTTP_ACCEPT']) ? $_SERVER['HTTP_ACCEPT'] : '*/*', 'User-Agent' => 'RB-Orsini-WP/' . self::VERSION);
		if ($id && $secret) { $headers['CF-Access-Client-Id'] = $id; $headers['CF-Access-Client-Secret'] = $secret; }
		if ($is_api) {
			$headers['Origin'] = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : home_url();
			if (isset($_SERVER['CONTENT_TYPE'])) $headers['Content-Type'] = $_SERVER['CONTENT_TYPE'];
		}
		$cache_key = 'rb_orsini_' . md5($url);
		$cacheable = $method === 'GET' && !$is_api && !$hidden;
		$cached = $cacheable ? get_transient($cache_key) : false;
		if ($cached) { $res = $cached; }
		else {
			$r = wp_remote_request($url, array('method' => $method, 'headers' => $headers, 'timeout' => 15, 'redirection' => 0,
				'body' => $method === 'POST' ? file_get_contents('php://input') : null));
			if (is_wp_error($r)) { if ($is_api) self::json_fail(503); self::fail(502); }
			$res = array('code' => (int) wp_remote_retrieve_response_code($r), 'type' => (string) wp_remote_retrieve_header($r, 'content-type'),
				'location' => (string) wp_remote_retrieve_header($r, 'location'), 'body' => wp_remote_retrieve_body($r));
			if ($cacheable && $res['code'] === 200) set_transient($cache_key, $res, strpos($res['type'], 'text/html') === 0 ? 5 * MINUTE_IN_SECONDS : HOUR_IN_SECONDS);
		}
		if ($res['code'] === 404 && !$is_api) { $GLOBALS['wp']->query_vars = array('error' => '404'); return; }
		if ($res['code'] >= 300 && $res['code'] < 400 && $res['location']) {
			$loc = preg_replace('#^https?://[^/]+#', '', $res['location']);
			wp_safe_redirect(home_url('/' . self::BASE . $loc), $res['code']); exit;
		}

		status_header($res['code']);
		if ($hidden) { nocache_headers(); header('X-Robots-Tag: noindex, nofollow, noarchive'); }
		header('Content-Type: ' . ($res['type'] ?: 'application/octet-stream'));
		header('X-Content-Type-Options: nosniff');
		$body = $res['body'];
		if (strpos($res['type'], 'text/html') === 0) $body = self::decorate($body, $hidden);
		if ($method !== 'HEAD') echo $body; // phpcs:ignore -- upstream HTML is the Orsini build, already escaped at build time.
		exit;
	}

	static function json_fail($code) { status_header($code); nocache_headers(); header('Content-Type: application/json; charset=utf-8'); echo '{"error":"La matrícula encara no està disponible."}'; exit; }

	static function fail($code) { status_header($code); nocache_headers(); header('Content-Type: text/plain; charset=utf-8'); echo (int) $code; exit; }

	/** Replace the build's fallback strip with the real Radical Books identity and add the single RB consent manager. */
	static function decorate($html, $hidden) {
		$logo = self::rb_logo_url();
		if ($logo) $html = preg_replace('#<span class="rb-strip__mark"[^>]*>RB</span><span>Radical Books</span>#', '<img src="' . esc_url($logo) . '" alt="Radical Books Coop" width="37" height="26">', $html, 1);
		try { $footer = self::rb_consent_markup(); } catch (Throwable $e) { $footer = ''; }
		if ($hidden) $footer .= '<div style="position:fixed;left:12px;bottom:12px;z-index:99999;background:#20231e;color:#fff;font:600 11px/1 Arial,sans-serif;padding:8px 10px;letter-spacing:.06em">VISTA PRÈVIA PRIVADA · ORSINI OCULT</div>';
		return str_replace('</body>', $footer . '</body>', $html);
	}

	/** The theme stores its logo as a data URI in index.php; reuse it as a cached file so the brand is never duplicated by hand. */
	static function rb_logo_url() {
		$cached = get_option('rb_orsini_logo');
		if ($cached && !empty($cached['url']) && !empty($cached['mtime']) && @filemtime(get_template_directory() . '/index.php') === $cached['mtime']) return $cached['url'];
		$src = @file_get_contents(get_template_directory() . '/index.php');
		if (!$src || !preg_match('#\$rb_logo\s*=\s*[\'"]data:image/(png|svg\+xml|webp);base64,([A-Za-z0-9+/=]+)[\'"]#', $src, $m)) return '';
		$up = wp_upload_dir();
		if (!empty($up['error'])) return '';
		$dir = trailingslashit($up['basedir']) . 'orsini';
		wp_mkdir_p($dir);
		$ext = $m[1] === 'svg+xml' ? 'svg' : $m[1];
		$file = $dir . '/rb-logo.' . $ext;
		if (false === file_put_contents($file, base64_decode($m[2]))) return '';
		$url = trailingslashit($up['baseurl']) . 'orsini/rb-logo.' . $ext . '?v=' . substr(md5($m[2]), 0, 8);
		update_option('rb_orsini_logo', array('url' => $url, 'mtime' => @filemtime(get_template_directory() . '/index.php')), false);
		return $url;
	}

	/** Runs only the Radical Books cookie footer callback (banner + dialog + config) and its script. No second banner exists. */
	static function rb_consent_markup() {
		$out = '';
		$file = WP_PLUGIN_DIR . '/radicalbooks-dashboard/radicalbooks-dashboard.php';
		global $wp_filter;
		if (isset($wp_filter['wp_footer'])) {
			foreach ($wp_filter['wp_footer']->callbacks as $cbs) {
				foreach ($cbs as $cb) {
					$fn = $cb['function'];
					if (!($fn instanceof Closure)) continue;
					try { $ref = new ReflectionFunction($fn); } catch (ReflectionException $e) { continue; }
					if (wp_normalize_path((string) $ref->getFileName()) !== wp_normalize_path($file)) continue;
					ob_start(); call_user_func($fn); $chunk = ob_get_clean();
					if (strpos($chunk, 'rbd-cookie') !== false) $out .= $chunk;
				}
			}
		}
		if ($out && strpos($out, 'cookies.js') === false && file_exists(WP_PLUGIN_DIR . '/radicalbooks-dashboard/assets/cookies.js'))
			$out .= '<script src="' . esc_url(plugins_url('assets/cookies.js', $file)) . '" defer></script>';
		return $out;
	}

	/* ---------------------------------------------------------- Shortcode & sitemap (only when public) */
	static function card() {
		if (!self::is_public()) return '';
		$l = self::lang();
		$t = array('ca' => array('Orsini', 'Centre d’estudis radicals'), 'es' => array('Orsini', 'Centro de estudios radicales'), 'en' => array('Orsini', 'Centre for radical studies'));
		return '<a class="rb-orsini-card" href="' . esc_url(home_url('/' . self::BASE . '/' . $l . '/')) . '"><strong>' . esc_html($t[$l][0]) . '</strong> <span>' . esc_html($t[$l][1]) . '</span> ↗</a>';
	}
	static function sitemap_guard($provider, $name) { return ($name === 'orsini' && !self::is_public()) ? false : $provider; }
	static function register_sitemap() {
		if (!self::is_public() || !function_exists('wp_register_sitemap_provider') || !class_exists('WP_Sitemaps_Provider')) return;
		require_once __DIR__ . '/sitemap-provider.php';
		wp_register_sitemap_provider('orsini', new RB_Orsini_Sitemap());
	}

	/* ---------------------------------------------------------- Admin: Ajustos → Orsini */
	static function menu() { add_options_page('Orsini', 'Orsini', 'manage_options', self::SLUG, array(__CLASS__, 'page')); }

	static function health() {
		$o = self::opts(); list($id, $se) = self::creds();
		$h = array('Accept' => 'application/json');
		if ($id && $se) { $h['CF-Access-Client-Id'] = $id; $h['CF-Access-Client-Secret'] = $se; }
		$r = wp_remote_get(rtrim($o['upstream'], '/') . '/health', array('headers' => $h, 'timeout' => 8, 'redirection' => 0));
		if (is_wp_error($r)) return array('ok' => false, 'msg' => $r->get_error_message());
		$code = wp_remote_retrieve_response_code($r); $j = json_decode(wp_remote_retrieve_body($r), true);
		return array('ok' => $code === 200 && is_array($j), 'code' => $code, 'data' => is_array($j) ? $j : null);
	}

	static function page() {
		if (!current_user_can('manage_options')) return;
		$o = self::opts(); list($id, $se) = self::creds(); $h = self::health();
		$state = self::is_public() ? 'Públic' : 'Ocult';
		$yes = function ($b) { return $b ? '<strong style="color:#b42318">sí</strong>' : 'no'; };
		echo '<div class="wrap"><h1>Orsini</h1>';
		if (isset($_GET['saved'])) echo '<div class="notice notice-success"><p>Desat.</p></div>';
		echo '<h2>Estat</h2><table class="widefat striped" style="max-width:760px"><tbody>';
		echo '<tr><th>Secció a WordPress (/orsini/)</th><td><strong>' . esc_html($state) . '</strong> — ' . (self::is_public() ? 'accessible al públic.' : '404 per als visitants; vista prèvia només per a administradors connectats.') . '</td></tr>';
		$man = @json_decode((string) @file_get_contents(self::site_dir() . '/manifest.json'), true);
		echo '<tr><th>Contingut</th><td>' . (is_array($man) ? 'Build del repositori · commit <code>' . esc_html($man['commit']) . '</code> · ' . esc_html(substr($man['built'], 0, 16)) . ' · ca/es/en' : '<strong>sense build</strong>') . '</td></tr>';
		echo '<tr><th>Origen (Worker)</th><td><code>' . esc_html($o['upstream']) . '</code> · credencial de servei: ' . ($id && $se ? 'configurada' : '<strong>no configurada</strong>') . '</td></tr>';
		if ($h['ok']) {
			$d = $h['data'];
			echo '<tr><th>Worker · ORSINI_PUBLIC</th><td>' . $yes(!empty($d['ORSINI_PUBLIC'])) . '</td></tr>';
			echo '<tr><th>Worker · PUBLIC_ENROLLMENT</th><td>' . $yes(!empty($d['PUBLIC_ENROLLMENT'])) . '</td></tr>';
			echo '<tr><th>Worker · STRIPE_MODE / LIVE_PAYMENTS</th><td>' . esc_html(isset($d['STRIPE_MODE']) ? $d['STRIPE_MODE'] : '?') . ' / ' . $yes(!empty($d['LIVE_PAYMENTS'])) . '</td></tr>';
			echo '<tr><th>Correu configurat</th><td>' . (!empty($d['email_configured']) ? 'sí' : 'no (els correus queden pendents)') . '</td></tr>';
		} else {
			echo '<tr><th>Connexió amb el Worker</th><td><strong style="color:#b42318">Error</strong> ' . esc_html(isset($h['code']) ? 'HTTP ' . $h['code'] : (isset($h['msg']) ? $h['msg'] : '')) . ' — la web es veu igualment; la matrícula de prova necessita el Worker desplegat.</td></tr>';
		}
		echo '</tbody></table>';
		echo '<p><a class="button" href="' . esc_url(home_url('/' . self::BASE . '/ca/')) . '" target="_blank">Vista prèvia privada (CA)</a> <a class="button" href="' . esc_url(home_url('/' . self::BASE . '/es/')) . '" target="_blank">ES</a> <a class="button" href="' . esc_url(home_url('/' . self::BASE . '/en/')) . '" target="_blank">EN</a></p>';

		echo '<form method="post" action="' . esc_url(admin_url('admin-post.php')) . '">';
		wp_nonce_field('rb_orsini_save');
		echo '<input type="hidden" name="action" value="rb_orsini_save">';
		echo '<h2>Publicació a WordPress</h2><p><label><input type="checkbox" name="public" value="1" ' . checked(self::is_public(), true, false) . '> Fer pública la secció <code>/orsini/</code> a radicalbooks.coop</label></p>';
		echo '<p class="description" style="max-width:760px">Aquesta casella només controla WordPress. No obre el subdomini, no treu Cloudflare Access, no activa la matrícula ni Stripe: aquests passos són separats i estan descrits a <code>ACTIVACIO.md</code> del repositori. L’estat del Worker es mostra a dalt tal com el reporta el servei.</p>';
		echo '<h2>Connexió privada amb el Worker</h2><table class="form-table" role="presentation">';
		echo '<tr><th><label for="rbo-up">URL d’origen</label></th><td><input id="rbo-up" class="regular-text" name="upstream" value="' . esc_attr($o['upstream']) . '"></td></tr>';
		if (defined('ORSINI_ACCESS_CLIENT_ID')) echo '<tr><th>Credencial de servei</th><td>Definida a wp-config.php.</td></tr>';
		else {
			echo '<tr><th><label for="rbo-id">CF-Access-Client-Id</label></th><td><input id="rbo-id" class="regular-text" name="client_id" value="' . esc_attr($o['client_id']) . '" autocomplete="off"></td></tr>';
			echo '<tr><th><label for="rbo-se">CF-Access-Client-Secret</label></th><td><input id="rbo-se" class="regular-text" type="password" name="secret" value="" placeholder="' . ($o['secret'] ? '•••••••• (desat; deixa-ho buit per conservar-lo)' : '') . '" autocomplete="new-password"></td></tr>';
		}
		echo '</table>';
		submit_button('Desar');
		echo '</form><h2>Enllaç des de Projectes</h2><p>El codi curt <code>[orsini_tarjeta]</code> no mostra res mentre Orsini estigui ocult.</p></div>';
	}

	static function save() {
		if (!current_user_can('manage_options')) wp_die('', 403);
		check_admin_referer('rb_orsini_save');
		$o = self::opts();
		$o['public'] = !empty($_POST['public']);
		$up = isset($_POST['upstream']) ? esc_url_raw(trim(wp_unslash($_POST['upstream']))) : $o['upstream'];
		if ($up && strpos($up, 'https://') === 0) $o['upstream'] = untrailingslashit($up);
		if (isset($_POST['client_id'])) $o['client_id'] = sanitize_text_field(wp_unslash($_POST['client_id']));
		if (!empty($_POST['secret'])) $o['secret'] = sanitize_text_field(wp_unslash($_POST['secret']));
		update_option(self::OPT, $o, false);
		global $wpdb; $wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '\\_transient\\_rb\\_orsini\\_%' OR option_name LIKE '\\_transient\\_timeout\\_rb\\_orsini\\_%'");
		wp_safe_redirect(admin_url('options-general.php?page=' . self::SLUG . '&saved=1')); exit;
	}
}
RB_Orsini::init();

/* Migrate the 1.x state once (it was hidden; keep it hidden). */
register_activation_hook(__FILE__, function () {
	$o = get_option(RB_Orsini::OPT);
	if (!is_array($o)) update_option(RB_Orsini::OPT, array('public' => false), false);
});
