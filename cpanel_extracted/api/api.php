<?php
/**
 * Thin proxy — forwards ALL requests to cpanel/api.php.
 * Explicit JSON Content-Type FIRST (before the backend is loaded) so even a
 * broken/empty backend can never leave the frontend parsing text/html — that was
 * the "/api/php_sync.php returns index.html" bug.
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
error_reporting(0);
ini_set('display_errors', '0');
$backend = __DIR__ . '/../cpanel/api.php';
if (is_file($backend)) {
    require $backend;
} else {
    echo json_encode(['success' => false, 'error' => 'Backend not found.']);
}