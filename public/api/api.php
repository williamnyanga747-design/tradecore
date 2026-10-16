<?php
/**
 * Thin proxy — forwards ALL requests to cpanel/api.php.
 * Explicit JSON Content-Type FIRST (before the backend is loaded) so even a
 * broken/empty backend can never leave the frontend parsing text/html — that was
 * the "/api/php_sync.php returns index.html" bug.
 */
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, HEAD');
header('Access-Control-Allow-Headers: Content-Type, Accept, X-API-Key, X-Requested-With, Authorization, X-Operator, X-Operator-Id, X-Operator-Role');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

if (!empty($_GET['action']) && ($_GET['action'] === 'stream_updates' || $_GET['action'] === 'copilot_stream')) {
    header('Content-Type: text/event-stream');
    header('Cache-Control: no-cache, no-transform');
    header('Connection: keep-alive');
    header('X-Accel-Buffering: no');
} else {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
}
error_reporting(0);
ini_set('display_errors', '0');
$backend = __DIR__ . '/../cpanel/api.php';
if (is_file($backend)) {
    require $backend;
} else {
    echo json_encode(['success' => false, 'error' => 'Backend not found.']);
}