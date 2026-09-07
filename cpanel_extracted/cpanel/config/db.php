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

// Production credentials (cPanel shared hosting)
return [
    'host' => 'localhost',
    'name' => 'tanzatrade_tradecore_erp',
    'user' => 'tanzatrade_tanzatrade',
    'pass' => '123456789@Tanzatrade',
];
