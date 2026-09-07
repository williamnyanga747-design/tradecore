<?php
/**
 * GlobalTradeCore - Dynamic SEO Sitemaps
 * Served via .htaccess rewrites:
 *   /sitemap.xml           -> this file (sitemap index)
 *   /sitemap-products.xml  -> this file (approved products of verified companies)
 *   /sitemap-companies.xml -> this file (verified companies)
 *
 * Data source: the same JSON state file written by api/php_sync.php
 * (and the root api.php), so sitemaps always reflect the live marketplace.
 * Cached to disk for 1 hour to keep responses fast.
 *
 * Only approved products and verified companies are included (never pending/rejected).
 */

error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED);
ini_set('display_errors', '0');

define('SITE_DOMAIN', 'https://tanzaniatradecore.co.tz');
define('CACHE_TTL', 3600); // 1 hour

// --- Locate the most recent state file (api/ first, root fallback) ---
function find_state_file(): ?string {
    $candidates = [
        __DIR__ . '/api/data/system_state.json',
        __DIR__ . '/data/system_state.json',
    ];
    $best = null;
    $bestTime = -1;
    foreach ($candidates as $path) {
        if (is_file($path)) {
            $t = @filemtime($path);
            if ($t !== false && $t > $bestTime) {
                $best = $path;
                $bestTime = $t;
            }
        }
    }
    return $best;
}

function read_state(): ?array {
    $file = find_state_file();
    if (!$file) return null;
    $raw = @file_get_contents($file);
    if (!$raw) return null;
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : null;
}

function xml_escape(string $value): string {
    return htmlspecialchars($value, ENT_QUOTES | ENT_XML1, 'UTF-8');
}

function lastmod_of(array $state, string $file): string {
    if (isset($state['lastUpdated']) && is_string($state['lastUpdated'])) {
        $ts = strtotime($state['lastUpdated']);
        if ($ts !== false) return gmdate('c', $ts);
    }
    $mt = $file ? @filemtime($file) : false;
    return $mt !== false ? gmdate('c', $mt) : gmdate('c');
}

// Simple unique-ify for slugs (defensive; frontend already guarantees uniqueness)
function unique_slug(string $base, array &$used): string {
    $slug = $base;
    $n = 2;
    while (isset($used[$slug])) {
        $slug = $base . '-' . $n;
        $n++;
    }
    $used[$slug] = true;
    return $slug;
}

function slugify($text): string {
    $text = (string)$text;
    $text = strtolower(trim($text));
    $text = preg_replace('/[^a-z0-9]+/', '-', $text);
    $text = trim($text, '-');
    return substr($text, 0, 60);
}

// --- Respond with cached or freshly generated XML ---
function send_xml(string $body): void {
    header('Content-Type: application/xml; charset=utf-8');
    header('Cache-Control: public, max-age=' . CACHE_TTL . ', s-maxage=' . CACHE_TTL);
    header('X-Robots-Tag: index, follow');
    echo $body;
    exit;
}

function cache_get(string $key): ?string {
    $dir = __DIR__ . '/data/sitemap-cache';
    $file = $dir . '/' . $key . '.xml';
    if (!is_file($file)) return null;
    if ((time() - (int)@filemtime($file)) > CACHE_TTL) {
        @unlink($file);
        return null;
    }
    $raw = @file_get_contents($file);
    return $raw !== false ? $raw : null;
}

function cache_set(string $key, string $body): void {
    $dir = __DIR__ . '/data/sitemap-cache';
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    @file_put_contents($dir . '/' . $key . '.xml', $body, LOCK_EX);
}

function state_has_changed(string $key, string $stateFile): bool {
    $dir = __DIR__ . '/data/sitemap-cache';
    $marker = $dir . '/' . $key . '.mtime';
    $current = $stateFile ? (string)@filemtime($stateFile) : '0';
    if (!is_file($marker)) return true;
    return (string)@file_get_contents($marker) !== $current;
}

function mark_state(string $key, string $stateFile): void {
    $dir = __DIR__ . '/data/sitemap-cache';
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    @file_put_contents($dir . '/' . $key . '.mtime', $stateFile ? (string)@filemtime($stateFile) : '0', LOCK_EX);
}

// --- Determine requested sitemap ---
$uri = $_SERVER['REQUEST_URI'] ?? '';
$target = 'index';
if (stripos($uri, 'sitemap-products.xml') !== false) $target = 'products';
elseif (stripos($uri, 'sitemap-companies.xml') !== false) $target = 'companies';

$cacheKey = 'sitemap-' . $target;
$state = read_state();
$stateFile = find_state_file();

// Serve cache when fresh AND the underlying state file is unchanged
if ($stateFile && !state_has_changed($cacheKey, $stateFile)) {
    $cached = cache_get($cacheKey);
    if ($cached !== null) send_xml($cached);
}

// --- Build the XML ---
$xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";

if ($target === 'index') {
    $xml .= '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
    $xml .= '  <sitemap><loc>' . xml_escape(SITE_DOMAIN . '/sitemap-products.xml') . '</loc><lastmod>' . lastmod_of($state ?: [], $stateFile) . '</lastmod></sitemap>' . "\n";
    $xml .= '  <sitemap><loc>' . xml_escape(SITE_DOMAIN . '/sitemap-companies.xml') . '</loc><lastmod>' . lastmod_of($state ?: [], $stateFile) . '</lastmod></sitemap>' . "\n";
    $xml .= '</sitemapindex>' . "\n";
    cache_set($cacheKey, $xml);
    if ($stateFile) mark_state($cacheKey, $stateFile);
    send_xml($xml);
}

$products = is_array($state['marketplaceProducts'] ?? null) ? $state['marketplaceProducts'] : [];
$companies = is_array($state['companies'] ?? null) ? $state['companies'] : [];
$companyMap = [];
foreach ($companies as $c) {
    if (is_array($c) && isset($c['id'])) {
        $companyMap[$c['id']] = $c;
    }
}

if ($target === 'companies') {
    $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
    // Homepage
    $xml .= '  <url><loc>' . xml_escape(SITE_DOMAIN . '/marketplace') . '</loc><changefreq>daily</changefreq><priority>1.0</priority></url>' . "\n";
    $used = [];
    foreach ($companies as $c) {
        if (!is_array($c)) continue;
        $isVerified = !empty($c['isVerified']);
        $isActive = !isset($c['isMarketplaceActive']) || $c['isMarketplaceActive'] !== false;
        $isDeleted = !empty($c['isDeleted']);
        if (!$isVerified || !$isActive || $isDeleted) continue;
        $slug = trim((string)($c['slug'] ?? ''));
        if ($slug === '') {
            $city = (string)($c['region'] ?? '') !== '' ? (string)$c['region'] : (string)($c['district'] ?? '');
            $slug = unique_slug(slugify(($city !== '' ? ($c['name'] . ' ' . $city) : $c['name'])), $used);
        } else {
            $slug = unique_slug(slugify($slug), $used);
        }
        $xml .= '  <url><loc>' . xml_escape(SITE_DOMAIN . '/company/' . rawurlencode($slug)) . '</loc>';
        $xml .= '<lastmod>' . lastmod_of($state ?: [], $stateFile) . '</lastmod>';
        $xml .= '<changefreq>weekly</changefreq><priority>0.8</priority></url>' . "\n";
    }
    $xml .= '</urlset>' . "\n";
    cache_set($cacheKey, $xml);
    if ($stateFile) mark_state($cacheKey, $stateFile);
    send_xml($xml);
}

// Products
$xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">' . "\n";
$used = [];
foreach ($products as $p) {
    if (!is_array($p)) continue;
    $companyId = $p['companyId'] ?? null;
    $comp = $companyId !== null && isset($companyMap[$companyId]) ? $companyMap[$companyId] : null;
    // Only approved products from verified, active companies
    $statusOk = !isset($p['status']) || $p['status'] === 'approved' || $p['status'] === 'verified';
    $active = !isset($p['isActive']) || $p['isActive'] !== false;
    if (!$statusOk || !$active) continue;
    if (!$comp || (empty($comp['isVerified']))) continue;
    if (isset($comp['isMarketplaceActive']) && $comp['isMarketplaceActive'] === false) continue;
    if (!empty($comp['isDeleted'])) continue;

    $name = (string)($p['name'] ?? 'Product');
    $slug = trim((string)($p['slug'] ?? ''));
    if ($slug === '') {
        $city = (string)($comp['region'] ?? '') !== '' ? (string)$comp['region'] : (string)($comp['district'] ?? '');
        $slug = unique_slug(slugify(($city !== '' ? ($name . ' ' . $city) : $name)), $used);
    } else {
        $slug = unique_slug(slugify($slug), $used);
    }
    $xml .= '  <url><loc>' . xml_escape(SITE_DOMAIN . '/product/' . rawurlencode($slug)) . '</loc>';
    $xml .= '<lastmod>' . lastmod_of($state ?: [], $stateFile) . '</lastmod>';
    $xml .= '<changefreq>weekly</changefreq><priority>0.9</priority>';
    $image = (string)($p['image'] ?? '');
    // Only include real public image URLs (data: URIs cannot be indexed by Google)
    if ($image !== '' && stripos($image, 'http://') === 0 || stripos($image, 'https://') === 0) {
        $xml .= '<image:image><image:loc>' . xml_escape($image) . '</image:loc></image:image>';
    }
    $xml .= '</url>' . "\n";
}
$xml .= '</urlset>' . "\n";

cache_set($cacheKey, $xml);
if ($stateFile) mark_state($cacheKey, $stateFile);
send_xml($xml);
