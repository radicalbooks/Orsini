<?php
if (!defined('ABSPATH')) exit;
/** Sitemap entries for Orsini — registered only when the section is public. */
class RB_Orsini_Sitemap extends WP_Sitemaps_Provider {
	public function __construct() { $this->name = 'orsini'; $this->object_type = 'orsini'; }
	public function get_url_list($page_num, $object_subtype = '') {
		$pages = array('', 'centre.html', 'programa.html', 'participa.html');
		$r = wp_remote_get(home_url('/orsini/ca/content/courses-index.json'), array('timeout' => 8));
		$idx = is_wp_error($r) ? array() : json_decode(wp_remote_retrieve_body($r), true);
		if (is_array($idx)) foreach ($idx as $c) if (!empty($c['slug']) && preg_match('/^[a-z0-9-]+$/', $c['slug'])) $pages[] = 'curs-' . $c['slug'] . '.html';
		$out = array();
		foreach (array('ca', 'es', 'en') as $l) foreach ($pages as $p) $out[] = array('loc' => home_url('/orsini/' . $l . '/' . $p));
		return $out;
	}
	public function get_max_num_pages($object_subtype = '') { return 1; }
}
