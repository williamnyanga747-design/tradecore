<?php
/**
 * Thin proxy — forwards ALL requests to cpanel/api.php.
 * Explicit JSON Content-Type FIRST (before the backend is loaded) so even a
 * broken/empty backend can never leave the frontend parsing text/html — that was
 * the "/api/php_sync.php returns index.html" bug.
 *
 * UNLIMITED PERSISTENCE (2026-09-08-2): this proxy accepts arbitrary-size flush
 * payloads — the client's flush is key-type gated, never size-gated. The original
 * ini_set calls for post_max_size / upload_max_filesize are PHP_INI_PERDIR, so under
 * FastCGI/FPM they are best-effort no-ops: raise the real ceiling in cPanel →
 * MultiPHP INI Editor (post_max_size = 20M) if a bulk import ever exceeds the PHP
 * default. We still set them with @ to make intent explicit and help mod_php hosts.
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
error_reporting(0);
ini_set('display_errors', '0');
@ini_set('memory_limit', '512M');
@ini_set('max_execution_time', '120');
@set_time_limit(120);
@ini_set('post_max_size', '20M');
@ini_set('upload_max_filesize', '20M');
$backend = __DIR__ . '/../cpanel/api.php';
if (is_file($backend)) {
    require $backend;
} else {
    echo json_encode(['success' => false, 'error' => 'Backend not found.']);
}