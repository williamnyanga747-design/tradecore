<?php
/**
 * Database configuration — loaded by api.php and api_backup_500.php.
 *
 * LOCAL DEVELOPMENT: If db.local.php exists in the same directory, it is loaded
 * instead of the production credentials below. This lets you run XAMPP with
 * root/no-password without touching this file (which may be version-controlled).
 *
 * Production: this file sits OUTSIDE public_html (e.g. /home/tanzatrade/config/db.php)
 * and is symlinked or included via absolute path. For cPanel shared hosting where
 * absolute paths outside public_html are not possible, place this file in
 * public_html/cpanel/config/db.php and block access via .htaccess (already done).
 */

// Check for local development override first
$localConfig = __DIR__ . '/db.local.php';
if (file_exists($localConfig)) {
    return require $localConfig;
}

// Production credentials — prefer environment variables (cPanel > Software > Environment Variables)
// Falls back to hardcoded values only when env vars are not set (shared hosting limitation)
return [
    'host' => getenv('TC_DB_HOST') ?: 'localhost',
    'name' => getenv('TC_DB_NAME') ?: 'tanzatrade_tradecore_erp',
    'user' => getenv('TC_DB_USER') ?: 'tanzatrade_tanzatrade',
    'pass' => getenv('TC_DB_PASS') ?: '123456789@Tanzatrade',
];
