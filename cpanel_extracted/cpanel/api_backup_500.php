<?php
/**
 * TradeCore ERP & POS - Production cPanel REST API & Database Gateway
 * Target Domain: https://tanzaniatradecore.co.tz
 * Persists state to both MySQL and file system (data/system_state.json)
 * for resilience against process restarts, 24-hour idle recycling, and memory clears.
 *
 * Endpoints served by this file:
 *   GET  /api/php_sync.php?action=get_state        -> Load persisted state
 *   POST /api/php_sync.php                          -> Save state
 *   GET  /api/api.php?action=stream_updates         -> SSE realtime stream
 *   POST /api/ai-assist                             -> Gemini AI stock/sales assistant
 *   POST /api/copilot-analysis                      -> Gemini executive copilot
 */

error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED);
ini_set('display_errors', '0');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-API-Key");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Pragma: no-cache");
header("Expires: 0");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}

// --- SetLocale middleware: cookie -> Accept-Language -> 'en' (English default) ---
const SUPPORTED_LOCALES = ['en', 'sw', 'fr', 'es'];
function resolve_request_locale(): string {
    $cookie = (string)($_COOKIE['app_locale'] ?? '');
    if (in_array($cookie, SUPPORTED_LOCALES, true)) return $cookie;
    $accept = (string)($_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? '');
    if ($accept !== '') {
        foreach (explode(',', $accept) as $tag) {
            $base = strtolower(trim(explode('-', trim(explode(';', trim($tag))[0]))[0]));
            if (in_array($base, SUPPORTED_LOCALES, true)) return $base;
        }
    }
    return 'en';
}
function normalize_locale_value($value): string {
    return in_array((string)$value, SUPPORTED_LOCALES, true) ? (string)$value : 'en';
}
// Resolve once per request; first-time visitors (no cookie) default to 'en'.
$app_locale = resolve_request_locale();
if (!isset($_COOKIE['app_locale'])) {
    setcookie('app_locale', $app_locale, [
        'expires' => time() + 31536000,
        'path' => '/',
        'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
        'httponly' => false,
        'samesite' => 'Lax',
    ]);
}

// --- File-based persistence path (survives MySQL outages & process restarts) ---
define('DATA_DIR', __DIR__ . '/data');
define('STATE_FILE', DATA_DIR . '/system_state.json');

function ensureDataDir(): void {
    if (!is_dir(DATA_DIR)) {
        @mkdir(DATA_DIR, 0755, true);
    }
}

function readStateFile(): ?array {
    ensureDataDir();
    if (!file_exists(STATE_FILE)) return null;
    $content = @file_get_contents(STATE_FILE);
    if (!$content) return null;
    $decoded = json_decode($content, true);
    return is_array($decoded) ? $decoded : null;
}

function writeStateFile(array $data): bool {
    ensureDataDir();
    $payload = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    return @file_put_contents(STATE_FILE, $payload, LOCK_EX) !== false;
}

// --- Password hardening: hash any plaintext operator passwords before persistence ---
const PASSWORD_HASH_PREFIX = 'sha256$';
const PASSWORD_HASH_SALT = 'tradecore::secure::2026::v1';

function isStoredPasswordHashed(string $value): bool {
    return strncmp($value, PASSWORD_HASH_PREFIX, strlen(PASSWORD_HASH_PREFIX)) === 0;
}

function hashStoredPassword(string $value): string {
    return PASSWORD_HASH_PREFIX . hash('sha256', $value . PASSWORD_HASH_SALT);
}

/**
 * Normalize blob data: if the blob was saved with the old wrapper envelope
 * ({action, data, lastUpdated}), extract just the inner data object.
 * Defined here as a safety copy (parent api.php already defines this).
 */
if (!function_exists('normalizeBlobData')) {
    function normalizeBlobData($blob) {
        if (is_array($blob) && isset($blob['action']) && isset($blob['data']) && is_array($blob['data'])) {
            return $blob['data'];
        }
        return $blob;
    }
}

/**
 * Verify a raw password against a user record that stores either a bcrypt
 * `password_hash` field (server-side, $2y$...) or a client-side sha256$ `password`
 * field (same format as TradeCore frontend). Returns true on match.
 */
function verifyStoredPassword(string $raw, array $u): bool {
    if (isset($u['password_hash']) && is_string($u['password_hash']) && $u['password_hash'] !== '') {
        if (strpos($u['password_hash'], '$2y$') === 0 || strpos($u['password_hash'], '$2a$') === 0) {
            if (password_verify($raw, $u['password_hash'])) return true;
        } elseif (strpos($u['password_hash'], PASSWORD_HASH_PREFIX) === 0) {
            if (hash_equals($u['password_hash'], hashStoredPassword($raw))) return true;
        }
    }
    $pw = $u['password'] ?? '';
    if (is_string($pw) && $pw !== '') {
        if (strpos($pw, PASSWORD_HASH_PREFIX) === 0) return hash_equals($pw, hashStoredPassword($raw));
        if (strpos($pw, '$2y$') === 0 || strpos($pw, '$2a$') === 0) return password_verify($raw, $pw);
        return hash_equals((string)$pw, $raw);
    }
    return false;
}

function sanitizeUserPasswords(array &$payload): void {
    if (isset($payload['users']) && is_array($payload['users'])) {
        foreach ($payload['users'] as &$user) {
            if (is_array($user) && isset($user['password']) && is_string($user['password'])) {
                if ($user['password'] === '' || isStoredPasswordHashed($user['password'])) {
                    continue;
                }
                $user['password'] = hashStoredPassword($user['password']);
            }
        }
        unset($user);
    }
}

/**
 * Locale migration: ensure every stored staff user & marketplace customer
 * record carries a valid locale field, defaulting missing/NULL values to 'en'.
 * Returns true when any record was updated so the change can be persisted.
 */
function normalize_locales(array &$state): bool {
    $changed = false;
    foreach (['users', 'marketplaceCustomers'] as $key) {
        if (!isset($state[$key]) || !is_array($state[$key])) continue;
        foreach ($state[$key] as &$rec) {
            if (!is_array($rec)) continue;
            $current = normalize_locale_value($rec['locale'] ?? 'en');
            if (!isset($rec['locale']) || (string)$rec['locale'] !== $current) {
                $rec['locale'] = $current;
                $changed = true;
            }
        }
        unset($rec);
    }
    return $changed;
}

// --- Password reset support (password_resets table, SMTP mail) ---
function ensure_password_resets_table(PDO $pdo): void {
    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS password_resets (
                id INT PRIMARY KEY AUTO_INCREMENT,
                email VARCHAR(255) NOT NULL,
                token VARCHAR(64) NOT NULL,
                expires_at DATETIME NOT NULL,
                used TINYINT(1) NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_email (email),
                INDEX idx_token (token)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");
    } catch (Exception $e) {}
}

function ensure_tra_tables(PDO $pdo): void {
    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS tra_receipts (
                id INT PRIMARY KEY AUTO_INCREMENT,
                order_id INT NOT NULL UNIQUE,
                order_number VARCHAR(64) NOT NULL,
                company_id INT NOT NULL,
                tin_number VARCHAR(32) NULL,
                customer_name VARCHAR(255) NULL,
                amount DECIMAL(18,2) NOT NULL DEFAULT 0,
                vat_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
                efd_receipt_number VARCHAR(64) NULL,
                efd_qr_code VARCHAR(255) NULL,
                status VARCHAR(16) NOT NULL DEFAULT 'pending',
                tra_response LONGTEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_tra_company_month (company_id, created_at),
                INDEX idx_tra_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS tra_monthly_reports (
                id INT PRIMARY KEY AUTO_INCREMENT,
                company_id INT NOT NULL,
                month VARCHAR(7) NOT NULL,
                total_sales DECIMAL(18,2) NOT NULL DEFAULT 0,
                order_count INT NOT NULL DEFAULT 0,
                vat_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
                report_file_path VARCHAR(500) NULL,
                submitted TINYINT(1) NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_company_month (company_id, month)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");
    } catch (Exception $e) {}
}

function mail_config(): array {
    $lines = [];
    $candidates = [
        __DIR__ . '/.env',
        dirname(__DIR__) . '/.env',
        ($_SERVER['DOCUMENT_ROOT'] ?? '') . '/.env',
        getcwd() . '/.env',
    ];
    foreach (array_unique($candidates) as $envFile) {
        if (!is_file($envFile)) continue;
        $f = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($f) $lines = array_merge($lines, $f);
    }
    $env = [];
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || strpos($line, '#') === 0) continue;
        if (preg_match('/^([A-Z0-9_]+)\s*=\s*(.*)$/i', $line, $m)) {
            $env[strtoupper($m[1])] = trim(trim($m[2]), "\"'");
        }
    }
    $pick = function (string $name, string $fallback) use ($env): string {
        $v = trim((string)getenv($name));
        return $v !== '' ? $v : ($env[$name] ?? $fallback);
    };
    $from = $pick('MAIL_FROM', '');
    if ($from === '') {
        $from = $pick('MAIL_FROM_ADDRESS', '');
    }
    return [
        'mailer' => strtolower($pick('MAIL_MAILER', 'smtp')),
        'host' => $pick('MAIL_HOST', ''),
        'port' => (int)$pick('MAIL_PORT', '587'),
        'username' => $pick('MAIL_USERNAME', ''),
        'password' => $pick('MAIL_PASSWORD', ''),
        'encryption' => strtolower($pick('MAIL_ENCRYPTION', '')),
        'from' => $from,
        'from_name' => $pick('MAIL_FROM_NAME', 'TradeCore ERP'),
    ];
}

function mail_uses_smtp(): bool {
    $m = mail_config()['mailer'];
    return $m === 'smtp' || $m === '';
}

function mail_config_available(): bool {
    $cfg = mail_config();
    return $cfg['host'] !== '' && $cfg['username'] !== '';
}

function smtp_read_reply($conn): string {
    $reply = '';
    while (true) {
        $line = fgets($conn, 512);
        if ($line === false) break;
        $reply .= $line;
        if (isset($line[3]) && $line[3] === ' ') break;
    }
    return trim($reply);
}

function smtp_send(string $toEmail, string $toName, string $subject, string $bodyHtml, ?string &$error = null): bool {
    $error = '';
    $cfg = mail_config();
    if ($cfg['host'] === '' || $cfg['username'] === '') {
        $error = 'SMTP host or username not configured';
        return false;
    }

    $port = $cfg['port'] > 0 ? $cfg['port'] : 587;
    $enc = $cfg['encryption'];
    $useTls = $port === 465 || $enc === 'ssl';
    $useStartTls = !$useTls && ($enc === 'tls' || $enc === 'starttls' || $enc === '');

    $remote = ($useTls ? 'tls://' : '') . $cfg['host'] . ':' . $port;
    $conn = @stream_socket_client($remote, $errno, $errstr, 20);
    if (!$conn) {
        $error = 'connect to ' . $remote . ' failed: ' . $errstr . ' (' . $errno . ')';
        return false;
    }
    stream_set_timeout($conn, 20);

    $starts = function (string $got, string $want): bool {
        return strpos($got, $want) === 0;
    };

    $banner = smtp_read_reply($conn);
    if (!$starts($banner, '220')) { fclose($conn); $error = 'unexpected banner: ' . $banner; return false; }

    fwrite($conn, 'EHLO ' . gethostname() . "\r\n");
    $r = smtp_read_reply($conn);
    if ($starts($r, '220')) {
        fwrite($conn, 'HELO ' . gethostname() . "\r\n");
        smtp_read_reply($conn);
    }

    if ($useStartTls) {
        fwrite($conn, "STARTTLS\r\n");
        $r = smtp_read_reply($conn);
        if ($starts($r, '220')) {
            $ok = @stream_socket_enable_crypto($conn, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
            if (!$ok) { fclose($conn); $error = 'STARTTLS handshake failed'; return false; }
            fwrite($conn, 'EHLO ' . gethostname() . "\r\n");
            smtp_read_reply($conn);
        } else {
            fclose($conn); $error = 'STARTTLS rejected: ' . $r; return false;
        }
    }

    if ($cfg['username'] !== '') {
        fwrite($conn, "AUTH LOGIN\r\n");
        $r = smtp_read_reply($conn);
        if ($starts($r, '334')) {
            fwrite($conn, base64_encode($cfg['username']) . "\r\n");
            $r = smtp_read_reply($conn);
            if ($starts($r, '334')) {
                fwrite($conn, base64_encode($cfg['password']) . "\r\n");
                $r = smtp_read_reply($conn);
                if (!$starts($r, '235')) { fclose($conn); $error = 'auth rejected: ' . $r; return false; }
            } else {
                fclose($conn); $error = 'username rejected: ' . $r; return false;
            }
        } elseif (!$starts($r, '503')) {
            fclose($conn); $error = 'AUTH LOGIN not accepted: ' . $r; return false;
        }
    }

    $from = $cfg['from'] !== '' ? $cfg['from'] : $cfg['username'];
    fwrite($conn, "MAIL FROM:<{$from}>\r\n");
    $r = smtp_read_reply($conn);
    if (!$starts($r, '250')) { fclose($conn); $error = 'MAIL FROM rejected: ' . $r; return false; }

    fwrite($conn, "RCPT TO:<{$toEmail}>\r\n");
    $r = smtp_read_reply($conn);
    if (!$starts($r, '250')) { fclose($conn); $error = 'RCPT TO rejected: ' . $r; return false; }

    fwrite($conn, "DATA\r\n");
    $r = smtp_read_reply($conn);
    if (!$starts($r, '354')) { fclose($conn); $error = 'DATA rejected: ' . $r; return false; }

    $headers = "From: {$cfg['from_name']} <{$from}>\r\n"
        . "To: {$toEmail}\r\n"
        . "Subject: {$subject}\r\n"
        . "MIME-Version: 1.0\r\n"
        . "Content-Type: text/html; charset=UTF-8\r\n"
        . "Content-Transfer-Encoding: base64\r\n"
        . "Date: " . date('r') . "\r\n";
    $msg = "{$headers}\r\n" . chunk_split(base64_encode($bodyHtml));
    $msg = preg_replace('/^\./m', '..', $msg);
    fwrite($conn, $msg . "\r\n.\r\n");
    $r = smtp_read_reply($conn);
    fclose($conn);
    if (!$starts($r, '250')) { $error = 'message rejected: ' . $r; return false; }
    return true;
}

function mail_send_fallback(string $toEmail, string $toName, string $subject, string $bodyHtml): bool {
    $cfg = mail_config();
    $from = ($cfg['from'] !== '' ? $cfg['from'] : ($cfg['username'] !== '' ? $cfg['username'] : 'no-reply@localhost'));
    $fromName = $cfg['from_name'] !== '' ? $cfg['from_name'] : 'TradeCore ERP';
    $headers = "MIME-Version: 1.0\r\n"
        . "Content-Type: text/html; charset=UTF-8\r\n"
        . "Content-Transfer-Encoding: base64\r\n"
        . "From: {$fromName} <{$from}>\r\n";
    $msg = chunk_split(base64_encode($bodyHtml));
    $ok = @mail($toEmail, $subject, $msg, $headers);
    if (!$ok) {
        $ok = @mail($toEmail, $subject, $msg, $headers, '-f ' . $from);
    }
    return $ok;
}

function log_debug(string $message): void {
    @file_put_contents(__DIR__ . '/mail_debug.log', date('c') . ' ' . $message . PHP_EOL, FILE_APPEND);
}

function load_system_state_array(): ?array {
    $pdo = db();
    if ($pdo) {
        try {
            $stmt = $pdo->prepare("SELECT json_data FROM tradecore_system_state WHERE doc_key = 'main_state' LIMIT 1");
            $stmt->execute();
            $row = $stmt->fetch();
            if ($row && $row['json_data']) {
                $decoded = normalizeBlobData(json_decode($row['json_data'], true));
                if (is_array($decoded)) return $decoded;
            }
        } catch (Exception $e) {}
    }
    $fileState = readStateFile();
    if ($fileState && isset($fileState['data']) && is_array($fileState['data'])) {
        return $fileState['data'];
    }
    return null;
}

function save_system_state_array(array $state): bool {
    $jsonString = json_encode($state, JSON_UNESCAPED_UNICODE);
    $mysqlOk = false;
    $pdo = db();
    if ($pdo) {
        try {
            $stmt = $pdo->prepare("
                INSERT INTO tradecore_system_state (doc_key, json_data, updated_at)
                VALUES ('main_state', :json_data, NOW())
                ON DUPLICATE KEY UPDATE json_data = VALUES(json_data), updated_at = NOW();
            ");
            $stmt->execute(['json_data' => $jsonString]);
            $mysqlOk = true;
        } catch (Exception $e) {}
    }
    $fileOk = writeStateFile([
        'data' => $state,
        'lastUpdated' => date('c'),
        'updatedAt' => now(),
        'source' => 'php_file_persistence'
    ]);
    return $mysqlOk || $fileOk;
}

// --- Database ---
define('DB_HOST', 'localhost');
define('DB_NAME', 'tanzatrade_tradecore_erp');
define('DB_USER', 'tanzatrade_tanzatrade');
define('DB_PASS', '123456789@Tanzatrade');
define('JWT_SECRET', 'k8Xm2pL9vQ4nR7wE3jT6yU1iA5sD8fG0hB2cK4mN');
define('JWT_EXPIRY', 86400);
define('IDLE_TIMEOUT', 900);
define('SESSION_TIMEOUT', 28800);

// --- MEGA Phase 1 placeholders ---
// Web Push VAPID keys (Phase 2 — actual sending via minishlink/web-push).
// Generate: npx web-push generate-vapid-keys
define('VAPID_PUBLIC_KEY', '');
define('VAPID_PRIVATE_KEY', '');
define('VAPID_SUBJECT', 'mailto:globaltradecore@gmail.com');
// OpenAI API key (Phase 2 — AI search / descriptions). When empty the API
// gracefully falls back to the local Kiswahili dictionary + templates.
define('OPENAI_API_KEY', getenv('OPENAI_API_KEY') ?: '');

function db(): ?PDO {
    static $pdo = null;
    if ($pdo === null) {
        try {
            $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
        } catch (PDOException $e) {
            return null;
        }
    }
    return $pdo;
}

function json_response($data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit();
}

function json_error(string $message, int $code = 400): void {
    json_response(['success' => false, 'error' => $message], $code);
}

function input(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function uuid(): string {
    return sprintf(
        '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}

function now(): string {
    return date('Y-m-d H:i:s');
}

function sanitize(string $str): string {
    return htmlspecialchars(strip_tags(trim($str)), ENT_QUOTES, 'UTF-8');
}

function base64url(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode(string $data): string {
    return base64_decode(strtr($data, '-_', '+/'));
}

function generate_jwt(array $payload): string {
    $header = base64url(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload['iat'] = time();
    $payload['exp'] = time() + JWT_EXPIRY;
    $payload['jti'] = uuid();
    $payload_encoded = base64url(json_encode($payload));
    $signature = base64url(hash_hmac('sha256', "$header.$payload_encoded", JWT_SECRET, true));
    return "$header.$payload_encoded.$signature";
}

function verify_jwt(string $token): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    [$header, $payload, $signature] = $parts;
    $expected = base64url(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    if (!hash_equals($expected, $signature)) return null;
    $data = json_decode(base64url_decode($payload), true);
    if (!$data || ($data['exp'] ?? 0) < time()) return null;
    return $data;
}

function get_client_ip(): string {
    return $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['HTTP_X_REAL_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
}

function create_session(string $user_id, string $company_id, string $token): string {
    $session_id = uuid();
    $ip = get_client_ip();
    $user_agent = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
    $expires_at = date('Y-m-d H:i:s', time() + JWT_EXPIRY);

    $pdo = db();
    if ($pdo) {
        try {
            $stmt = $pdo->prepare('INSERT INTO user_sessions (id, user_id, company_id, token_jti, ip_address, user_agent, expires_at, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)');
            $stmt->execute([$session_id, $user_id, $company_id, $token, $ip, $user_agent, $expires_at]);
        } catch (Exception $e) {}
    }

    return $session_id;
}

function log_audit(string $company_id, ?string $user_id, ?string $user_name, string $action, ?string $entity_type = null, ?string $entity_id = null, ?string $entity_name = null, ?string $details = null): void {
    $pdo = db();
    if (!$pdo) return;
    try {
        $stmt = $pdo->prepare('INSERT INTO audit_trails (id, company_id, user_id, user_name, action, entity_type, entity_id, entity_name, details, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([uuid(), $company_id, $user_id, $user_name, $action, $entity_type, $entity_id, $entity_name, $details, get_client_ip(), now()]);
    } catch (Exception $e) {}
}

// Auto-initialize required database tables if possible — skip heavy migrations if recently done
$pdo = db();
$initCacheFile = __DIR__ . '/data/.init_cache';
$initCacheMs = @filemtime($initCacheFile) ? @filemtime($initCacheFile) * 1000 : 0;
$shouldRunHeavyInit = (time() - ($initCacheMs / 1000)) > 300; // once every 5 minutes
if ($pdo) {
    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS tradecore_system_state (
                id INT PRIMARY KEY AUTO_INCREMENT,
                doc_key VARCHAR(100) UNIQUE NOT NULL,
                json_data LONGTEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                version BIGINT NOT NULL DEFAULT 0
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");
        // Atomic tables for PWA stability — fast CREATE IF NOT EXISTS, always safe to run
        try {
            $pdo->exec("CREATE TABLE IF NOT EXISTS tradecore_products (id VARCHAR(50) PRIMARY KEY, company_id VARCHAR(50) NOT NULL, data JSON NOT NULL, updated_at BIGINT NOT NULL, deleted_at BIGINT DEFAULT NULL, INDEX idx_company(company_id, updated_at), INDEX idx_deleted(deleted_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
            $pdo->exec("CREATE TABLE IF NOT EXISTS tradecore_users (id VARCHAR(50) PRIMARY KEY, company_id VARCHAR(50) NOT NULL, phone VARCHAR(20) NOT NULL, data JSON NOT NULL, updated_at BIGINT NOT NULL, deleted_at BIGINT DEFAULT NULL, UNIQUE KEY uniq_phone_company(phone,company_id), INDEX idx_company(company_id), INDEX idx_updated(updated_at), INDEX idx_deleted(deleted_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
            $pdo->exec("CREATE TABLE IF NOT EXISTS tradecore_sales (id VARCHAR(50) PRIMARY KEY, company_id VARCHAR(50) NOT NULL, data JSON NOT NULL, updated_at BIGINT NOT NULL, deleted_at BIGINT DEFAULT NULL, INDEX idx_company(company_id, updated_at), INDEX idx_deleted(deleted_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
            $pdo->exec("CREATE TABLE IF NOT EXISTS tradecore_marketplace_orders (id VARCHAR(50) PRIMARY KEY, company_id VARCHAR(50) NOT NULL, data JSON NOT NULL, updated_at BIGINT NOT NULL, deleted_at BIGINT DEFAULT NULL, INDEX idx_company(company_id, updated_at), INDEX idx_deleted(deleted_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
            $pdo->exec("CREATE TABLE IF NOT EXISTS tradecore_meta (id INT PRIMARY KEY, app_version VARCHAR(20) NOT NULL DEFAULT '1.0.9', updated_at BIGINT NOT NULL, INDEX idx_updated(updated_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
            $pdo->exec("INSERT IGNORE INTO tradecore_meta (id, app_version, updated_at) VALUES (1,'1.0.9', UNIX_TIMESTAMP())");
        } catch (Exception $eAtomic) {}
        // Heavy migrations (SHOW COLUMNS, ALTER TABLE, blob seeding) — only once every 5 minutes
        if ($shouldRunHeavyInit) {
            @touch($initCacheFile);
            try {
                $col = $pdo->query("SHOW COLUMNS FROM tradecore_system_state LIKE 'version'")->fetch();
                if (!$col) { try { $pdo->exec("ALTER TABLE tradecore_system_state ADD COLUMN version BIGINT NOT NULL DEFAULT 0"); } catch (Exception $e3) {} }
            } catch (Exception $e2) {}
            foreach (['tradecore_products','tradecore_users'] as $tbl) {
                try { $col = $pdo->query("SHOW COLUMNS FROM $tbl LIKE 'deleted_at'")->fetch(); if (!$col) $pdo->exec("ALTER TABLE $tbl ADD COLUMN deleted_at BIGINT DEFAULT NULL"); } catch (Exception $eAlt) {}
                try { $pdo->exec("ALTER TABLE $tbl MODIFY COLUMN updated_at BIGINT NOT NULL"); } catch (Exception $eAlt2) {}
            }
            try {
                $cntP = (int)$pdo->query("SELECT COUNT(*) FROM tradecore_products")->fetchColumn();
                $cntU = (int)$pdo->query("SELECT COUNT(*) FROM tradecore_users")->fetchColumn();
                $cntS = (int)$pdo->query("SELECT COUNT(*) FROM tradecore_sales")->fetchColumn();
                $cntO = (int)$pdo->query("SELECT COUNT(*) FROM tradecore_marketplace_orders")->fetchColumn();
                if ($cntP === 0 || $cntU === 0 || $cntS === 0 || $cntO === 0) {
                    $row = $pdo->query("SELECT json_data FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1")->fetch();
                    if ($row && $row['json_data']) {
                        $blob = normalizeBlobData(json_decode($row['json_data'], true));
                        if (is_array($blob)) {
                            $now = time();
                            if ($cntP === 0 && isset($blob['marketplaceProducts']) && is_array($blob['marketplaceProducts']) && count($blob['marketplaceProducts']) > 0) {
                                $stmtP = $pdo->prepare("REPLACE INTO tradecore_products (id, company_id, data, updated_at) VALUES (?,?,?,?)");
                                foreach ($blob['marketplaceProducts'] as $pp) {
                                    if (!is_array($pp) || !isset($pp['id']) || !isset($pp['company_id'])) continue;
                                    $stmtP->execute([(string)$pp['id'], (string)$pp['company_id'], json_encode($pp, JSON_UNESCAPED_UNICODE), $now]);
                                }
                            }
                            if ($cntU === 0 && isset($blob['users']) && is_array($blob['users']) && count($blob['users']) > 0) {
                                $stmtU = $pdo->prepare("REPLACE INTO tradecore_users (id, company_id, phone, data, updated_at) VALUES (?,?,?,?,?)");
                                foreach ($blob['users'] as $uu) {
                                    if (!is_array($uu) || !isset($uu['id']) || !isset($uu['company_id']) || !isset($uu['phone'])) continue;
                                    $stmtU->execute([(string)$uu['id'], (string)$uu['company_id'], (string)$uu['phone'], json_encode($uu, JSON_UNESCAPED_UNICODE), $now]);
                                }
                            }
                            if ($cntS === 0 && isset($blob['salesOrders']) && is_array($blob['salesOrders']) && count($blob['salesOrders']) > 0) {
                                $stmtS = $pdo->prepare("REPLACE INTO tradecore_sales (id, company_id, data, updated_at) VALUES (?,?,?,?)");
                                foreach ($blob['salesOrders'] as $ss) {
                                    if (!is_array($ss) || !isset($ss['id']) || !isset($ss['companyId'])) continue;
                                    $stmtS->execute([(string)$ss['id'], (string)$ss['companyId'], json_encode($ss, JSON_UNESCAPED_UNICODE), $now]);
                                }
                            }
                            if ($cntO === 0 && isset($blob['marketplaceOrders']) && is_array($blob['marketplaceOrders']) && count($blob['marketplaceOrders']) > 0) {
                                $stmtO = $pdo->prepare("REPLACE INTO tradecore_marketplace_orders (id, company_id, data, updated_at) VALUES (?,?,?,?)");
                                foreach ($blob['marketplaceOrders'] as $oo) {
                                    if (!is_array($oo) || !isset($oo['id']) || !isset($oo['companyId'])) continue;
                                    $stmtO->execute([(string)$oo['id'], (string)$oo['companyId'], json_encode($oo, JSON_UNESCAPED_UNICODE), $now]);
                                }
                            }
                            $pdo->exec("UPDATE tradecore_meta SET updated_at=".$now." WHERE id=1");
                        }
                    }
                }
            } catch (Exception $eMig) {}
            ensure_password_resets_table($pdo);
            ensure_tra_tables($pdo);
        }
    } catch (Exception $e) {}
}

// ============================================================================
// GEMINI AI SUPPORT
// ============================================================================

/**
 * Resolve the GEMINI_API_KEY from (in order): environment variable, a .env file
 * next to this script, the parent directory, or the document root.
 */
function gemini_api_key(): string {
    $key = trim((string)getenv('GEMINI_API_KEY'));
    if ($key !== '') return $key;

    $candidates = [
        __DIR__ . '/.env',
        dirname(__DIR__) . '/.env',
        ($_SERVER['DOCUMENT_ROOT'] ?? '') . '/.env',
        getcwd() . '/.env',
    ];
    foreach (array_unique($candidates) as $envFile) {
        if (!is_file($envFile)) continue;
        $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if (!$lines) continue;
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || strpos($line, '#') === 0) continue;
            if (preg_match('/^GEMINI_API_KEY\s*=\s*(.+)$/i', $line, $m)) {
                $key = trim(trim($m[1]), "\"'");
                if ($key !== '') return $key;
            }
        }
    }
    return '';
}

/**
 * Call the Gemini REST API. Returns the raw text or null on failure/no key.
 */
function gemini_generate(string $userText, string $systemInstruction, array $generationConfig = []): ?string {
    $apiKey = gemini_api_key();
    if ($apiKey === '' || !function_exists('curl_init')) return null;

    $models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    foreach ($models as $model) {
        $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key=" . urlencode($apiKey);
        $payload = [
            'contents' => [['parts' => [['text' => $userText]]]],
            'systemInstruction' => ['parts' => [['text' => $systemInstruction]]],
            'generationConfig' => array_merge(['temperature' => 0.4], $generationConfig),
        ];

        $ch = curl_init($url);
        if ($ch === false) return null;
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 60,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
        ]);
        $raw = curl_exec($ch);
        $err = curl_error($ch);
        curl_close($ch);

        if ($raw === false || $err !== '') {
            continue;
        }
        $decoded = json_decode($raw, true);
        $text = $decoded['candidates'][0]['content']['parts'][0]['text'] ?? null;
        if (is_string($text) && trim($text) !== '') {
            $text = trim($text);
            // Strip markdown code fences when the model wraps JSON output
            if (preg_match('/^\s*```(?:json)?\s*(.*?)\s*```\s*$/s', $text, $m)) {
                $text = trim($m[1]);
            }
            return $text;
        }
    }
    return null;
}

function detect_route(): string {
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: '';
    if (preg_match('#/(?:api/)?webhooks/azampay/collection$#', $path)) return 'azampay_webhook';
    if (preg_match('#/(?:api/)?forgot-password$#', $path)) return 'forgot-password';
    if (preg_match('#/(?:api/)?reset-password$#', $path)) return 'reset-password';
    if (preg_match('#/(?:api/)?register$#', $path)) return 'register';
    if (preg_match('#/(?:api/)?ai-assist$#', $path)) return 'ai-assist';
    if (preg_match('#/(?:api/)?copilot-analysis$#', $path)) return 'copilot-analysis';
    $action = $_GET['action'] ?? '';
    if ($action === 'forgot-password' || $action === 'forgot_password') return 'forgot-password';
    if ($action === 'reset-password' || $action === 'reset_password') return 'reset-password';
    if ($action === 'register') return 'register';
    if ($action === 'azampay_webhook') return 'azampay_webhook';
    return 'sync';
}

$req_input = input();
$action = $_GET['action'] ?? $req_input['action'] ?? '';
$route = detect_route();

try {

// ============================================================================
// 0. FORGOT PASSWORD - request a one-time password reset link
// ============================================================================
if ($route === 'forgot-password') {
    $email = strtolower(trim((string)($req_input['email'] ?? '')));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_error('A valid email address is required', 422);
    }

    $pdo = db();
    if (!$pdo) {
        json_error('Password reset service unavailable. Please contact the system administrator.', 503);
    }
    ensure_password_resets_table($pdo);

    // Rate limit: same email may request at most 3 times per hour
    $stmt = $pdo->prepare("SELECT COUNT(*) AS cnt FROM password_resets WHERE email = ? AND created_at >= (NOW() - INTERVAL 1 HOUR)");
    $stmt->execute([$email]);
    $recent = (int)($stmt->fetch()['cnt'] ?? 0);
    if ($recent >= 3) {
        json_error('Too many reset requests. Please wait at least an hour before trying again.', 429);
    }

    // Look up the account inside the system state blob (email is unique per user)
    $state = load_system_state_array();
    $userName = '';
    $found = false;
    if (is_array($state) && isset($state['users']) && is_array($state['users'])) {
        foreach ($state['users'] as $u) {
            if (is_array($u) && strtolower((string)($u['email'] ?? '')) === $email) {
                $found = true;
                $userName = (string)($u['name'] ?? '');
                break;
            }
        }
    }

    $cfg = mail_config();
    log_debug('attempt email=' . $email . ' found=' . ($found ? 'yes' : 'no')
        . ' mailer=' . $cfg['mailer'] . ' mail_host=' . $cfg['host'] . ' mail_port=' . $cfg['port']
        . ' mail_enc=' . $cfg['encryption'] . ' mail_from=' . $cfg['from']
        . ' smtp_available=' . (mail_config_available() ? 'yes' : 'no'));

    // Generate a cryptographically random, one-time, 10-minute token
    $token = bin2hex(random_bytes(32));
    $expiresAt = date('Y-m-d H:i:s', time() + 600);
    $stmt = $pdo->prepare("INSERT INTO password_resets (email, token, expires_at, used) VALUES (?, ?, ?, 0)");
    $stmt->execute([$email, $token, $expiresAt]);

    $scheme = ((!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['SERVER_PORT'] ?? '') == 443)) ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $resetUrl = $scheme . '://' . $host . '/reset-password?token=' . urlencode($token);
    log_debug('token_created email=' . $email . ' expires_at=' . $expiresAt . ' reset_url=' . $resetUrl);

    $displayName = $userName !== '' ? $userName : $email;
    $subject = 'TradeCore ERP - Password Reset Request';
    $body = '<p>Hello ' . htmlspecialchars($displayName) . ',</p>'
        . '<p>We received a request to reset your TradeCore ERP password.</p>'
        . '<p>Click the link below to choose a new password. The link expires in 10 minutes and can be used only once:</p>'
        . '<p><a href="' . htmlspecialchars($resetUrl) . '">Reset my password</a></p>'
        . '<p>If you did not request this, you can safely ignore this email.</p>';

    if ($found && mail_config_available()) {
        $smtpError = '';
        $sent = false;
        if (mail_uses_smtp()) {
            $sent = smtp_send($email, $displayName, $subject, $body, $smtpError);
            if ($sent) {
                log_debug('result email=' . $email . ' outcome=smtp_sent');
                json_response(['success' => true, 'message' => 'If an account exists for that email, a reset link has been sent.', 'sent' => true]);
            }
            log_debug('result email=' . $email . ' smtp_failed="' . $smtpError . '"');
        }
        // SMTP disabled or failed: use the server's native mail() (local Exim on cPanel)
        $mailFallbackOk = mail_send_fallback($email, $displayName, $subject, $body);
        log_debug('result email=' . $email . ' mail_fallback=' . ($mailFallbackOk ? 'sent' : 'failed'));
        if ($mailFallbackOk) {
            json_response(['success' => true, 'message' => 'If an account exists for that email, a reset link has been sent.', 'sent' => true, 'via' => 'mail']);
        }
        // Both failed: surface a safe detail hint for diagnosis
        json_response([
            'success' => false,
            'error' => 'Unable to send the reset email. Please try again later or contact the system administrator.',
            'detail' => $smtpError !== '' ? $smtpError : 'SMTP and mail() fallback both failed',
        ], 500);
    }

    if ($found && !mail_config_available()) {
        // SMTP not configured: expose the token for local testing only (remove before production).
        log_debug('result email=' . $email . ' outcome=test_token_shown');
        json_response([
            'success' => true,
            'message' => 'SMTP is not configured yet, so the reset token is shown below for testing.',
            'sent' => false,
            'token' => $token,
            'expiresAt' => $expiresAt,
            'resetUrl' => $resetUrl,
        ]);
    }

    // Email unknown (or no SMTP): identical generic response (anti-enumeration)
    log_debug('result email=' . $email . ' outcome=no_send (email not found or no transport)');
    json_response([
        'success' => true,
        'message' => 'If an account exists for that email, a reset link has been sent.',
        'sent' => false,
        'token' => null,
    ]);
}

// ============================================================================
// 0b. RESET PASSWORD - consume the token and set a new password
// ============================================================================
if ($route === 'reset-password') {
    $token = trim((string)($req_input['token'] ?? ''));
    $password = (string)($req_input['password'] ?? '');

    if ($token === '') {
        json_error('Reset token is required', 422);
    }
    if (strlen($password) < 6) {
        json_error('New password must be at least 6 characters long', 422);
    }
    if (preg_match('/[^\x20-\x7E]/', $password)) {
        json_error('New password contains unsupported characters', 422);
    }

    $pdo = db();
    if (!$pdo) {
        json_error('Password reset service unavailable. Please contact the system administrator.', 503);
    }
    ensure_password_resets_table($pdo);

    $stmt = $pdo->prepare("SELECT * FROM password_resets WHERE token = ? LIMIT 1");
    $stmt->execute([$token]);
    $row = $stmt->fetch();
    if (!$row) {
        json_error('Invalid or already-used reset token.', 400);
    }
    if ((int)$row['used'] === 1) {
        json_error('This reset link has already been used. Please request a new one.', 400);
    }
    if (strtotime((string)$row['expires_at']) < time()) {
        json_error('This reset link has expired. Please request a new one.', 400);
    }

    $email = strtolower(trim((string)$row['email']));

    // Update the operator's password inside the system state blob (keeps the
    // same salted SHA-256 format the frontend verifies at sign-in).
    $state = load_system_state_array();
    $updated = false;
    if (is_array($state) && isset($state['users']) && is_array($state['users'])) {
        $newHash = hashStoredPassword($password);
        foreach ($state['users'] as &$u) {
            if (is_array($u) && strtolower((string)($u['email'] ?? '')) === $email) {
                $u['password'] = $newHash;
                $u['firstLogin'] = false;
                $updated = true;
            }
        }
        unset($u);
        if ($updated) {
            save_system_state_array($state);
        }
    }

    // Consume this token and invalidate any other outstanding tokens for the same email
    $stmt = $pdo->prepare("UPDATE password_resets SET used = 1 WHERE email = ?");
    $stmt->execute([$email]);

    if (!$updated) {
        json_error('No account matches this email address.', 404);
    }

    json_response(['success' => true, 'message' => 'Your password has been reset. You can now sign in with your new password.']);
}

// ============================================================================
// 0c. REGISTER - public company registration with payment verification request
//     Hashes passwords with the same salted SHA-256 scheme the frontend verifies,
//     creates the company + Branch Administrator user + a Pending payment request,
//     and persists atomically through the standard state blob gateway.
// ============================================================================
if ($route === 'register') {
    $username = strtolower(trim((string)($req_input['username'] ?? '')));
    $name     = trim((string)($req_input['name'] ?? ''));
    $email    = strtolower(trim((string)($req_input['email'] ?? '')));
    $phone    = trim((string)($req_input['phone'] ?? ''));
    $company  = trim((string)($req_input['companyName'] ?? ''));
    $password = (string)($req_input['password'] ?? '');
    $planId   = (int)($req_input['planId'] ?? 0);
    $planName = trim((string)($req_input['planName'] ?? ''));
    $amount   = (int)($req_input['amount'] ?? 0);
    $payMethod  = trim((string)($req_input['paymentMethod'] ?? ''));
    $payRef     = trim((string)($req_input['paymentReference'] ?? ''));
    $receiptUrl = trim((string)($req_input['receiptImageUrl'] ?? ''));
    // New billing model fields
    $planSlug   = trim((string)($req_input['planSlug'] ?? 'custom'));
    $planType   = trim((string)($req_input['planType'] ?? 'direct'));
    if (!in_array($planType, ['direct', 'commission'], true)) $planType = 'direct';
    $currencyCode = trim((string)($req_input['currencyCode'] ?? 'TZS'));
    if ($currencyCode === '') $currencyCode = 'TZS';
    $amountTzs  = (int)($req_input['amountTzs'] ?? $amount);
    $commission = (float)($req_input['commissionPercentSnapshot'] ?? 0);

    if ($username === '' || strlen($username) < 3) {
        json_error('Username must be at least 3 characters', 422);
    }
    if ($name === '') json_error('Full name is required', 422);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) json_error('A valid email address is required', 422);
    if ($company === '') json_error('Company name is required', 422);
    if (strlen($password) < 6) json_error('Password must be at least 6 characters long', 422);
    if ($planId <= 0 || $planName === '') json_error('A valid subscription plan is required', 422);
    if ($payRef === '') json_error('Payment reference / transaction ID is required', 422);

    $state = load_system_state_array();
    if (!is_array($state)) {
        json_error('System state unavailable. Please try again shortly.', 503);
    }

    $users = isset($state['users']) && is_array($state['users']) ? $state['users'] : [];
    $companies = isset($state['companies']) && is_array($state['companies']) ? $state['companies'] : [];

    foreach ($users as $u) {
        if (!is_array($u)) continue;
        if (strtolower((string)($u['username'] ?? '')) === $username) {
            json_error('That username is already registered.', 409);
        }
        if (strtolower((string)($u['email'] ?? '')) === $email) {
            json_error('An account with that email address already exists.', 409);
        }
    }
    foreach ($companies as $c) {
        if (!is_array($c)) continue;
        if (strtolower((string)($c['name'] ?? '')) === strtolower($company)) {
            json_error('That company name is already registered.', 409);
        }
    }

    $newCompanyId = 1;
    foreach ($companies as $c) {
        if (is_array($c) && (int)($c['id'] ?? 0) >= $newCompanyId) $newCompanyId = (int)$c['id'] + 1;
    }
    $newUserId = 1;
    foreach ($users as $u) {
        if (is_array($u) && (int)($u['id'] ?? 0) >= $newUserId) $newUserId = (int)$u['id'] + 1;
    }

    $nowIso = date('c');
    $newCompany = [
        'id' => $newCompanyId,
        'name' => $company,
        'themeColor' => '#c41e3a',
        'subscriptionApproved' => false,
        'status' => 'Pending Payment',
        'subscriptionStart' => $nowIso,
        'planId' => $planId,
        'planName' => $planName,
        'paymentReference' => $payRef,
        'paymentMethod' => $payMethod,
        'receiptImageUrl' => $receiptUrl !== '' ? $receiptUrl : null,
        'adminNote' => '',
        'latitude' => isset($req_input['latitude']) && is_numeric($req_input['latitude']) ? (float)$req_input['latitude'] : null,
        'longitude' => isset($req_input['longitude']) && is_numeric($req_input['longitude']) ? (float)$req_input['longitude'] : null,
        'addressText' => trim((string)($req_input['addressText'] ?? '')),
        'planType' => $planType,
        'currencyCode' => $currencyCode,
        'commissionPercentSnapshot' => $commission
    ];
    $newUser = [
        'id' => $newUserId,
        'username' => $username,
        'password' => hashStoredPassword($password),
        'role' => 'Branch Administrator',
        'name' => $name,
        'email' => $email,
        'companyId' => $newCompanyId,
        'branchId' => null,
        'storeId' => null,
        'firstLogin' => true,
        'status' => 'Active',
        'locale' => $app_locale
    ];
    $newRequest = [
        'id' => 'REQ-' . time(),
        'companyId' => $newCompanyId,
        'companyName' => $company,
        'userName' => $name,
        'userEmail' => $email,
        'userPhone' => $phone,
        'planId' => $planId,
        'planName' => $planName,
        'amount' => $amount,
        'paymentMethod' => $payMethod,
        'paymentReference' => $payRef,
        'receiptImageUrl' => $receiptUrl !== '' ? $receiptUrl : null,
        'status' => 'Pending',
        'requestedAt' => $nowIso
    ];

    $meta = $state['settings']['subscriptionMeta'] ?? [
        'plans' => [], 'payNumbers' => [], 'paymentRequests' => []
    ];
    if (!isset($meta['paymentRequests']) || !is_array($meta['paymentRequests'])) {
        $meta['paymentRequests'] = [];
    }
    array_unshift($meta['paymentRequests'], $newRequest);
    $state['settings']['subscriptionMeta'] = $meta;

    // New billing model: persist a Pending company_subscriptions record
    if (!isset($state['settings']) || !is_array($state['settings'])) {
        $state['settings'] = [];
    }
    $subs = isset($state['settings']['companySubscriptions']) && is_array($state['settings']['companySubscriptions'])
        ? $state['settings']['companySubscriptions'] : [];
    $newSubId = 1;
    foreach ($subs as $s) {
        if (is_array($s) && (int)($s['id'] ?? 0) >= $newSubId) $newSubId = (int)$s['id'] + 1;
    }
    $newSubscription = [
        'id' => $newSubId,
        'companyId' => $newCompanyId,
        'planId' => $planId,
        'planName' => $planName,
        'planSlug' => $planSlug,
        'planType' => $planType,
        'currencyCode' => $currencyCode,
        'amountPaid' => $amount,
        'amountTzs' => $amountTzs > 0 ? $amountTzs : $amount,
        'commissionPercentSnapshot' => $commission,
        'status' => 'pending',
        'paymentProof' => $receiptUrl !== '' ? $receiptUrl : null,
        'paymentReference' => $payRef,
        'paymentMethod' => $payMethod,
        'createdAt' => $nowIso
    ];
    $subs[] = $newSubscription;
    $state['settings']['companySubscriptions'] = $subs;
    $state['companies'] = array_merge($companies, [$newCompany]);
    $state['users'] = array_merge($users, [$newUser]);

    $saved = save_system_state_array($state);
    log_debug('register username=' . $username . ' company=' . $company
        . ' plan=' . $planName . ' amount=' . $amount . ' method=' . $payMethod
        . ' ref=' . $payRef . ' saved=' . ($saved ? 'yes' : 'no')
        . ' password_hashed=' . (isStoredPasswordHashed($newUser['password']) ? 'yes' : 'no'));

    if (!$saved) {
        json_error('Could not persist your registration. Please try again.', 500);
    }

    json_response([
        'success' => true,
        'status' => 'pending',
        'message' => 'Company registered. Payment is awaiting Super Admin verification.',
        'companyId' => $newCompanyId,
        'requestId' => $newRequest['id']
    ]);
}

// ============================================================================
// 0. AI ASSIST - Stock, Pricing & Sales Order Assistant
// ============================================================================
if ($route === 'ai-assist') {
    $prompt = $req_input['prompt'] ?? '';
    $products = $req_input['products'] ?? [];
    $priceType = $req_input['priceType'] ?? 'Retail';

    if (!is_string($prompt) || trim($prompt) === '') {
        json_error('Prompt is required');
    }

    $systemInstruction = <<<'TEXT'
You are an assistant for a point-of-sale (POS/ERP) system.

<system_purpose>
Analyze order requests, accurately decompose package/bulk quantities into standard base units, deduct inventory, and apply the correct tiered pricing (Retail vs. Wholesale).
Our products can be sold in two ways: 'Wholesale' (Package/Bulk units such as Sacks, Dozens, or Cartons) and 'Retail' (Non-package/Loose units such as a Single Kilogram, a Single Loaf, or a Single Bottle).
</system_purpose>

Example of how we define products internally:
{
  "product_name": "Bottled Water",
  "category": "Beverages",
  "stock_management": {
    "total_base_units_in_stock": 20,
    "base_unit_name": "bottle",
    "package_unit_name": "carton",
    "units_per_package": 4
  },
  "pricing": {
    "retail_price_per_base_unit": 500,
    "wholesale_price_per_package": 1800
  }
}

Example 1: Flour
User (Input): "We have 5 bags of 24kg flour in stock. A retail customer wants to buy 2 kilograms, and a Wholesaler wants 1 full sack."
Explanation:
- Initial State Summary: Current stock is 5 Sacks (120 kg total).
- Decomposition Math: 2 kg (Retail) = 2 base units. 1 full sack (Wholesale) = 24 kg = 24 base units. Total sold = 26 base units (kg).
- Transaction Deduction: 120 kg - 26 kg = 94 kg.
- Financial Summary: 2 kg charged at the retail price per kg, 1 sack charged at the wholesale price per sack.
- New Inventory State: 94 kg remaining (Equivalent to 3 Sacks and 22 kg).

Example 2: Bread
User (Input): "We have 5 dozens of bread (each dozen contains 5 loaves). A customer is buying 3 loose loaves individually."
Explanation:
- Initial State Summary: Current stock is 5 Dozens (25 loaves total).
- Decomposition Math: 3 loose loaves = 3 base units. Total sold = 3 base units (loaves).
- Transaction Deduction: 25 loaves - 3 loaves = 22 loaves.
- Financial Summary: 3 loaves charged at the retail price.
- New Inventory State: 22 loaves remaining (Equivalent to 4 dozens and 2 extra loaves).

<inventory_rules>
1. ALWAYS convert incoming quantities into the 'base_unit' (e.g., kg, single bottle, loaf) before performing any addition or subtraction.
2. Wholesale purchases (Sacks, Dozens, Cartons, Boxes) must be instantly multiplied by the 'units_per_package' factor to find the base unit equivalent.
3. Total stock must always be tracked and updated as a single flat integer of total base units to avoid floating-point errors or mismatched states.
</inventory_rules>

<pricing_logic>
- If the order specifies a bulk unit (e.g., Sack, Carton, Dozen), apply the wholesale_price or partner_price per package equivalent.
- If the order specifies loose units (e.g., kg, single item), apply the retail_price per base unit.
</pricing_logic>

Your tasks are:
1. Receive orders and identify whether the customer is buying in Wholesale (Package/Bulk) or Retail (Single/Loose Sub-unit).
2. Deduct inventory accurately based on the 'Base Unit' (for example, if someone buys 1 carton of water containing 4 bottles, you deduct 4 bottles from the main stock).
3. Calculate the correct price based on the customer type and unit type requested (Wholesaler or Retailer).

<response_format>
For every transaction, output your internal logic following this structural chain-of-thought in your 'explanation' field:
1. **Initial State Summary**: Clear breakdown of current stock in both bulk units and remaining loose units.
2. **Decomposition Math**: Show the step-by-step conversion of the order into base units.
3. **Transaction Deduction**: (Initial Base Units) - (Sold Base Units) = (Remaining Base Units).
4. **Financial Summary**: Detailed calculation of the total amount charged based on the customer type price tier.
5. **New Inventory State**: Output the final stock converted back into a user-friendly format (e.g., '3 Sacks and 22 kg remaining').
</response_format>
TEXT;

    $userMsg = "Here is the current list of available products in the store:\n"
        . json_encode($products, JSON_UNESCAPED_UNICODE) . "\n\n"
        . "Active Price Type context (Retail/Wholesale/Preferred): " . ($priceType ?: 'Retail') . "\n\n"
        . "User Input Command: \"{$prompt}\"\n\n"
        . "Identify matched products. If the user refers to quantities in loose or sub-units (e.g. kg, loaves, bottles) and the product supports subUnitPricing (useSubUnitPricing is true and subUnitConversion is defined), set 'unitType' to 'sub' and specify the sub-unit quantity. If they buy package/bulk (e.g. sacks, bags, cartons, dozens) or if the product does NOT support sub-units, set 'unitType' to 'main'.\n\n"
        . "Calculate the prices:\n"
        . "- For 'main' unitType, the unit price should be:\n"
        . "  * wholesalePrice (if priceType is Wholesale)\n"
        . "  * partnerPrice or retailPrice (if priceType is Preferred)\n"
        . "  * retailPrice (otherwise)\n"
        . "- For 'sub' unitType, the unit price should be:\n"
        . "  * subUnitWholesalePrice or subUnitRetailPrice (if priceType is Wholesale)\n"
        . "  * subUnitPartnerPrice or subUnitRetailPrice (if priceType is Preferred)\n"
        . "  * subUnitRetailPrice (otherwise)\n\n"
        . "Generate a JSON response conforming to the schema: {\"success\": boolean, \"explanation\": string, \"actions\": [{\"productId\": int, \"productName\": string, \"unitType\": \"main\"|\"sub\", \"qty\": number, \"price\": number, \"total\": number}]}. Include a descriptive 'explanation' in the style of the system instruction examples, breaking down the initial stock, sales, prices charged, and remaining stock.";

    $generationConfig = [
        'temperature' => 0.2,
        'responseMimeType' => 'application/json',
    ];

    $rawAi = gemini_generate($userMsg, $systemInstruction, $generationConfig);
    $parsed = null;
    if ($rawAi !== null) {
        $decoded = json_decode($rawAi, true);
        if (is_array($decoded)) {
            $parsed = $decoded;
        }
    }

    if ($parsed) {
        json_response($parsed);
    }

    // Deterministic Local Rule Fallback when Gemini is unavailable
    $matchedActions = [];
    $promptLower = strtolower($prompt);
    if (is_array($products)) {
        foreach ($products as $p) {
            if (!is_array($p)) continue;
            $pName = strtolower((string)($p['name'] ?? ''));
            $pCode = strtolower((string)($p['code'] ?? ''));
            $nameHit = $pName !== '' && strpos($promptLower, $pName) !== false;
            $codeHit = $pCode !== '' && strpos($promptLower, $pCode) !== false;
            if (!$nameHit && !$codeHit) continue;

            $isSub = !empty($p['useSubUnitPricing']) && !empty($p['subUnitConversion'])
                && (strpos($promptLower, strtolower((string)($p['subUnitName'] ?? ''))) !== false
                    || strpos($promptLower, 'kg') !== false
                    || strpos($promptLower, 'loose') !== false);
            $price = $isSub
                ? (float)($p['subUnitRetailPrice'] ?? $p['retailPrice'] ?? 0)
                : ($priceType === 'Wholesale' ? (float)($p['wholesalePrice'] ?? 0) : (float)($p['retailPrice'] ?? 0));

            $matchedActions[] = [
                'productId' => $p['id'] ?? null,
                'productName' => $p['name'] ?? '',
                'unitType' => $isSub ? 'sub' : 'main',
                'qty' => 1,
                'price' => $price,
                'total' => $price,
            ];
        }
    }

    json_response([
        'success' => true,
        'explanation' => count($matchedActions) > 0
            ? "Identified " . count($matchedActions) . " matching product(s) for prompt \"{$prompt}\"."
            : "No direct product matches found for \"{$prompt}\". Please check spelling or product list.",
        'actions' => $matchedActions,
    ]);
}

// ============================================================================
// 1. COPILOT ANALYSIS - Executive Stock, Pricing, Sales & Growth Advisor
// ============================================================================
if ($route === 'copilot-analysis') {
    $prompt = $req_input['prompt'] ?? 'Provide a complete strategic review covering all matters facing our company.';
    $topic = $req_input['topic'] ?? 'All Company Matters';
    $companyInfo = $req_input['companyInfo'] ?? [];
    $metricsSummary = $req_input['metricsSummary'] ?? [];
    $products = $req_input['products'] ?? [];
    $sales = $req_input['sales'] ?? [];
    $purchases = $req_input['purchases'] ?? [];
    $expenses = $req_input['expenses'] ?? [];
    $language = $req_input['language'] ?? 'en';

    $targetLang = $language === 'sw' ? 'Swahili (Kiswahili)' : 'English';
    $companyName = is_array($companyInfo) ? ($companyInfo['name'] ?? 'Active Company') : 'Active Company';

    $systemInstruction = "You are the Lead Executive AI Enterprise Copilot for the specified company ({$companyName}).\n"
        . "Your mandate is to DIRECTLY AND SPECIFICALLY ANSWER the user's specific prompt/question first (\"{$prompt}\").\n"
        . "Do NOT provide generic repeated templates. Always personalize your answer to directly answer the user's question with specific actionable facts, metrics, and steps.\n\n"
        . "CRITICAL LANGUAGE REQUIREMENT: You MUST respond entirely in {$targetLang}. If Swahili is selected, construct naturally fluent, professional Swahili text for business leadership.\n\n"
        . "Formatting: Use bold headers, numbered actionable steps, and clear bullet points. Keep recommendations grounded in the provided company metrics.";

    $userMsg = "Company Context: " . json_encode($companyInfo, JSON_UNESCAPED_UNICODE) . "\n"
        . "Requested Language: {$targetLang}\n"
        . "Topic Focus: " . ($topic ?: 'All Company Matters') . "\n"
        . "User Question/Command: \"{$prompt}\"\n\n"
        . "Metrics Summary: " . json_encode($metricsSummary, JSON_UNESCAPED_UNICODE) . "\n"
        . "Top Products Sample: " . json_encode(array_slice($products, 0, 10), JSON_UNESCAPED_UNICODE) . "\n"
        . "Recent Sales Orders: " . json_encode(array_slice($sales, 0, 10), JSON_UNESCAPED_UNICODE) . "\n"
        . "Recent Purchase Orders: " . json_encode(array_slice($purchases, 0, 10), JSON_UNESCAPED_UNICODE) . "\n\n"
        . "Respond in {$targetLang} directly answering \"{$prompt}\".";

    $aiResponse = gemini_generate($userMsg, $systemInstruction);

    // Server-side fallback analysis when Gemini API is unavailable or empty
    if ($aiResponse === null || strlen(trim($aiResponse)) < 20) {
        $isSwahili = $language === 'sw';
        $rev = (float)($metricsSummary['totalSalesRevenue'] ?? 0);
        $profit = (float)($metricsSummary['totalSalesProfit'] ?? 0);
        $margin = (float)($metricsSummary['grossMarginPct'] ?? 0);
        $exp = (float)($metricsSummary['totalExpenseAmount'] ?? 0);
        $net = (float)($metricsSummary['netOperatingProfit'] ?? 0);
        $lowStock = (float)($metricsSummary['lowStockCount'] ?? 0);
        $qLower = strtolower($prompt);

        $fmt = function ($v) { return number_format($v); };
        $marginFmt = number_format($margin, 1);
        $lowStockInt = (int)$lowStock;

        if ($isSwahili) {
            if (strpos($qLower, 'matumizi') !== false || strpos($qLower, 'expense') !== false || strpos($qLower, 'gharama') !== false) {
                $aiResponse = "### \xF0\x9F\x92\xA1 Uchambuzi wa Matumizi na Gharama kwa **{$companyName}**\n\n"
                    . "Jumla ya matumizi ya sasa ni **{$fmt($exp)}**.\n\n"
                    . "1. **Kagua Matumizi Yasiyo ya Lazima**: Matumizi ya uendeshaji ni **{$fmt($exp)}**, ambayo inaathiri faida halisi (**{$fmt($net)}**).\n"
                    . "2. **Ufuatiliaji wa Siku kwa Siku**: Hakikisha matumizi yote yanapitishwa na meneja wa duka kabla ya kutoa fedha drooni.\n"
                    . "3. **Ushauri wa Kifedha**: Weka bajeti maalum kwa kila tawi/duka ili kubana matumizi yasiyo ya lazima.";
            } elseif (strpos($qLower, 'mauzo') !== false || strpos($qLower, 'sale') !== false || strpos($qLower, 'faida') !== false || strpos($qLower, 'profit') !== false) {
                $aiResponse = "### \xF0\x9F\x93\x8A Uchambuzi wa Mauzo na Faida kwa **{$companyName}**\n\n"
                    . "Jumla ya mapato ya mauzo ni **{$fmt($rev)}** na faida ghafi ni **{$fmt($profit)}** (**{$marginFmt}%**).\n\n"
                    . "1. **Ongeza Mauzo ya Rejareja na Jumla**: Tumia mfumo wa bei za jumla kuwapa wateja wa kubwa punguzo na kuongeza mauzo.\n"
                    . "2. **Uza Vipimo Vidogo (Loose Units)**: Kutokana na mahitaji, kuuza vipimo vidogo kama unga au mikate huongeza faida ghafi kwa **12-15%**.\n"
                    . "3. **Urejeshaji wa Madeni**: Fuatilia madeni ya wateja ili kuhakikisha mzunguko wa fedha unakaa vizuri.";
            } elseif (strpos($qLower, 'akiba') !== false || strpos($qLower, 'stock') !== false || strpos($qLower, 'bidhaa') !== false) {
                $aiResponse = "### \xF0\x9F\x93\xA6 Uchambuzi wa Akiba na Bidhaa kwa **{$companyName}**\n\n"
                    . "Kuna bidhaa **{$lowStockInt}** zilizokaribia kuisha ghalani kwa sasa.\n\n"
                    . "1. **Weka Oda za Manunuzi Mapema**: Tuma oda za manunuzi (PO) kwa wauzaji kwa bidhaa **{$lowStockInt}** zilizopo chini ya kiwango cha chini.\n"
                    . "2. **Uhamisho wa Bidhaa Baina ya Maduka**: Tumia Stock Transfer kuhamisha bidhaa kutoka maduka yenye ziada kwenda maduka yenye uhaba.\n"
                    . "3. **Tarehe za Mwisho wa Matumizi (Expiry Tracking)**: Hakikisha bidhaa zinazokaribia kuisha muda zinauzwa kwanza (FIFO).";
            } else {
                $aiResponse = "### \xF0\x9F\x9A\x80 Majibu ya Mtaalamu Copilot kwa **{$companyName}**\n\n"
                    . "Kuhusu swali lako: *\"_{$prompt}_\"*\n\n"
                    . "#### \xF0\x9F\x93\x8A Muhtasari wa Mfumo na Mfano wa Takwimu:\n"
                    . "- **Mapato ya Mauzo**: **{$fmt($rev)}** | **Faida Ghafi**: **{$fmt($profit)}** (**{$marginFmt}%**).\n"
                    . "- **Gharama za Uendeshaji**: **{$fmt($exp)}** | **Faida Halisi**: **{$fmt($net)}**.\n"
                    . "- **Bidhaa Chache Ghalani**: Bidhaa **{$lowStockInt}** ziko chini ya kiwango cha usalama.\n\n"
                    . "#### \xF0\x9F\x8E\xAF Hatua za Kuchukua Mara Moja:\n"
                    . "1. **Usimamizi wa Sehemu za Mfumo**: Hakikisha watumiaji wote wametengewa maduka na haki zao za ufikiaji vizuri.\n"
                    . "2. **Ukaguzi wa Kila Siku**: Tumia sehemu ya Ripoti za Kila Siku na POS Shift Ledger kukagua miamala yote.\n"
                    . "3. **Mawasiliano na Wateja**: Tumia WhatsApp/SMS Messaging kuwatumia wateja risiti na taarifa za madeni.";
            }
        } else {
            if (strpos($qLower, 'expense') !== false || strpos($qLower, 'cost') !== false || strpos($qLower, 'spending') !== false) {
                $aiResponse = "### \xF0\x9F\x92\xA1 Expense & Operational Overhead Analysis for **{$companyName}**\n\n"
                    . "Total operating expenses stand at **{$fmt($exp)}**.\n\n"
                    . "1. **Review Operational Costs**: Expenses directly impact your net operating profit of **{$fmt($net)}**.\n"
                    . "2. **Approval Rules**: Require store manager sign-off for all drawer cash payouts.\n"
                    . "3. **Budget Allocation**: Set store-level expense caps in Master Data to control operational creep.";
            } elseif (strpos($qLower, 'sale') !== false || strpos($qLower, 'profit') !== false || strpos($qLower, 'revenue') !== false) {
                $aiResponse = "### \xF0\x9F\x93\x8A Revenue & Margin Analysis for **{$companyName}**\n\n"
                    . "Total sales revenue is **{$fmt($rev)}** with gross profit of **{$fmt($profit)}** (**{$marginFmt}% margin**).\n\n"
                    . "1. **Leverage Tiered Pricing**: Use wholesale vs retail pricing tiers to capture commercial buyers.\n"
                    . "2. **Loose Unit Sub-Pricing**: Sub-unit breakdowns (e.g. per-kg, per-piece) increase margins by **12-15%**.\n"
                    . "3. **Receivables Recovery**: Follow up on customer credit balances to keep cash flow strong.";
            } elseif (strpos($qLower, 'stock') !== false || strpos($qLower, 'inventory') !== false || strpos($qLower, 'product') !== false) {
                $aiResponse = "### \xF0\x9F\x93\xA6 Inventory & Stock Health Analysis for **{$companyName}**\n\n"
                    . "There are currently **{$lowStockInt} low-stock items** requiring reordering.\n\n"
                    . "1. **Issue Purchase Orders**: Generate POs for the **{$lowStockInt} critical items** to prevent stockouts.\n"
                    . "2. **Inter-Store Transfers**: Move stock between branches before placing new supplier orders.\n"
                    . "3. **FIFO Expiry Tracking**: Prioritize older inventory batches to eliminate waste.";
            } else {
                $aiResponse = "### \xF0\x9F\x9A\x80 Executive Intelligence Response for **{$companyName}**\n\n"
                    . "In response to your query: *\"_{$prompt}_\"*\n\n"
                    . "#### \xF0\x9F\x93\x8A Core Operational Financial Status:\n"
                    . "- **Total Revenue**: **{$fmt($rev)}** | **Gross Profit**: **{$fmt($profit)}** (**{$marginFmt}%**).\n"
                    . "- **Expenses**: **{$fmt($exp)}** | **Net Profit**: **{$fmt($net)}**.\n"
                    . "- **Low Stock Items**: **{$lowStockInt} items** need attention.\n\n"
                    . "#### \xF0\x9F\x8E\xAF Strategic Action Plan:\n"
                    . "1. **Multi-Tenant Operations**: Ensure stores, branches, and staff accounts are separated appropriately.\n"
                    . "2. **Daily Shift Audit**: Use POS Shift Reconciliations to keep drawer cash aligned.\n"
                    . "3. **Automated Follow-ups**: Send automated PDF invoices and account statements to credit customers.";
            }
        }
    }

    json_response([
        'success' => true,
        'analysis' => $aiResponse,
    ]);
}

// ============================================================================
// 1b. SYSTEM STATS - resource usage for the Root Mandate dashboard
// ============================================================================
if ($action === 'system_stats') {
    $dbSize = null;
    if ($pdo) {
        try {
            $stmt = $pdo->prepare(
                "SELECT (SUM(data_length) + SUM(index_length)) AS total_bytes
                 FROM information_schema.tables WHERE table_schema = :db_name"
            );
            $stmt->execute(['db_name' => DB_NAME]);
            $dbSize = (int)($stmt->fetch()['total_bytes'] ?? 0);
        } catch (Exception $e) {}
    }

    $dataDirSize = null;
    ensureDataDir();
    $dataDirSize = 0;
    foreach (glob(DATA_DIR . '/*') ?: [] as $f) {
        if (is_file($f)) $dataDirSize += filesize($f);
    }

    $state = load_system_state_array();
    $productCount = 0;
    $userCount = 0;
    if (is_array($state)) {
        $productCount = isset($state['marketplaceProducts']) && is_array($state['marketplaceProducts'])
            ? count($state['marketplaceProducts']) : 0;
        $userCount = isset($state['users']) && is_array($state['users'])
            ? count($state['users']) : 0;
    }

    json_response([
        'success' => true,
        'db_size' => $dbSize,
        'data_dir_size' => $dataDirSize,
        'product_count' => $productCount,
        'user_count' => $userCount,
    ]);
}

// ============================================================================
// 2. STATE SYNC ENDPOINTS
// ============================================================================

// 1b. CHECK TIMESTAMP (lightweight polling for cross-device sync detection)
// MUST be before get_state — get_state previously used `if (METHOD===GET)` which
// swallowed every GET including ?action=check_timestamp, causing the client to
// download the full 3-5 MB blob every 5 s. Now it is strict and tiny (~100 B).
if ($action === 'check_timestamp') {
    $updatedAt = null;
    $version = 0;
    $dbg = ['action' => 'check_timestamp'];
    $pdo2 = db();
    $dbg['db_connected'] = ($pdo2 !== null);
    if ($pdo2) {
        try {
            $stmt = $pdo2->prepare("SELECT updated_at, version FROM tradecore_system_state WHERE doc_key = 'main_state' LIMIT 1");
            $stmt->execute();
            $row = $stmt->fetch();
            if ($row) {
                if (!empty($row['updated_at'])) $updatedAt = $row['updated_at'];
                if (isset($row['version'])) $version = (int)$row['version'];
                $dbg['source'] = 'db';
            }
        } catch (Exception $e) {
            $dbg['db_error'] = $e->getMessage();
            // Column version may not exist yet on older DBs — fallback to timestamp only
            try {
                $stmt = $pdo2->prepare("SELECT updated_at FROM tradecore_system_state WHERE doc_key = 'main_state' LIMIT 1");
                $stmt->execute();
                $row = $stmt->fetch();
                if ($row && $row['updated_at']) { $updatedAt = $row['updated_at']; $dbg['source'] = 'db_fallback'; }
            } catch (Exception $e2) {
                $dbg['db_fallback_error'] = $e2->getMessage();
            }
        }
    }
    if (!$updatedAt) {
        $fileState = readStateFile();
        if ($fileState) {
            $updatedAt = $fileState['updatedAt'] ?? $fileState['lastUpdated'] ?? null;
            if (isset($fileState['version'])) $version = (int)$fileState['version'];
            elseif (isset($fileState['data']['_version'])) $version = (int)$fileState['data']['_version'];
            $dbg['source'] = $dbg['source'] ?? 'file';
        } else {
            $dbg['source'] = 'none';
        }
    }
    // Include microsecond-safe ISO for new clients; keep legacy lastUpdated
    $updatedAtIso = $updatedAt ? date('c', is_numeric($updatedAt) ? (int)$updatedAt : strtotime((string)$updatedAt)) : null;
    if (!$updatedAt) error_log('[TradeCore] check_timestamp: no data. debug=' . json_encode($dbg));
    json_response([
        "success" => true,
        "lastUpdated" => $updatedAt,
        "updatedAt" => $updatedAt,
        "updatedAtIso" => $updatedAtIso,
        "version" => $version,
        "server_ts" => $version > 0 ? $version : ($updatedAtIso ?? $updatedAt)
    ]);
}

// 1. GET SYSTEM STATE — SERVER IS SOURCE OF TRUTH (fixes Chrome vs Edge desync)
// If company_id is provided, return atomic table data filtered by since timestamp for incremental sync.
// If since=0 or absent, return full state for the company (initial sync).
if ($action === 'get_state') {
    if (isset($_GET['company_id']) && trim((string)$_GET['company_id']) !== '') {
        $cid = trim((string)$_GET['company_id']);
        $since = intval($_GET['since'] ?? 0);
        $pdoI = db();
        if ($pdoI) {
            try {
                // Query atomic tables — if since>0, only return items updated since then (+ deleted items for removal)
                if ($since > 0) {
                    $stmtP = $pdoI->prepare("SELECT data, deleted_at FROM tradecore_products WHERE company_id=? AND updated_at > ?");
                    $stmtP->execute([$cid, $since]);
                    $prows = $stmtP->fetchAll();
                    $stmtU = $pdoI->prepare("SELECT data, deleted_at FROM tradecore_users WHERE company_id=? AND updated_at > ?");
                    $stmtU->execute([$cid, $since]);
                    $urows = $stmtU->fetchAll();
                    $stmtS = $pdoI->prepare("SELECT data, deleted_at FROM tradecore_sales WHERE company_id=? AND updated_at > ?");
                    $stmtS->execute([$cid, $since]);
                    $srows = $stmtS->fetchAll();
                    $stmtO = $pdoI->prepare("SELECT data, deleted_at FROM tradecore_marketplace_orders WHERE company_id=? AND updated_at > ?");
                    $stmtO->execute([$cid, $since]);
                    $orows = $stmtO->fetchAll();
                } else {
                    $stmtP = $pdoI->prepare("SELECT data, deleted_at FROM tradecore_products WHERE company_id=?");
                    $stmtP->execute([$cid]);
                    $prows = $stmtP->fetchAll();
                    $stmtU = $pdoI->prepare("SELECT data, deleted_at FROM tradecore_users WHERE company_id=?");
                    $stmtU->execute([$cid]);
                    $urows = $stmtU->fetchAll();
                    $stmtS = $pdoI->prepare("SELECT data, deleted_at FROM tradecore_sales WHERE company_id=?");
                    $stmtS->execute([$cid]);
                    $srows = $stmtS->fetchAll();
                    $stmtO = $pdoI->prepare("SELECT data, deleted_at FROM tradecore_marketplace_orders WHERE company_id=?");
                    $stmtO->execute([$cid]);
                    $orows = $stmtO->fetchAll();
                }
                // Separate active vs deleted items — clients need to know which to remove locally
                $activeProducts = []; $deletedProductIds = [];
                foreach ($prows as $r) { $d = json_decode($r['data'], true); if ($r['deleted_at']) $deletedProductIds[] = $d['id'] ?? ''; else if ($d) $activeProducts[] = $d; }
                $activeUsers = []; $deletedUserIds = [];
                foreach ($urows as $r) { $d = json_decode($r['data'], true); if ($r['deleted_at']) $deletedUserIds[] = $d['id'] ?? ''; else if ($d) $activeUsers[] = $d; }
                $activeSales = []; $deletedSaleIds = [];
                foreach ($srows as $r) { $d = json_decode($r['data'], true); if ($r['deleted_at']) $deletedSaleIds[] = $d['id'] ?? ''; else if ($d) $activeSales[] = $d; }
                $activeOrders = []; $deletedOrderIds = [];
                foreach ($orows as $r) { $d = json_decode($r['data'], true); if ($r['deleted_at']) $deletedOrderIds[] = $d['id'] ?? ''; else if ($d) $activeOrders[] = $d; }
                $meta = $pdoI->query("SELECT updated_at FROM tradecore_meta WHERE id=1")->fetch();
                $serverTs = $meta ? intval($meta['updated_at']) : time();
                json_response([
                    'changed'=>true,
                    'server_ts'=>$serverTs,
                    'version'=>$serverTs,
                    'products'=>$activeProducts,
                    'users'=>$activeUsers,
                    'sales'=>$activeSales,
                    'marketplaceOrders'=>$activeOrders,
                    'deleted'=>$since > 0 ? [
                        'productIds'=>$deletedProductIds,
                        'userIds'=>$deletedUserIds,
                        'saleIds'=>$deletedSaleIds,
                        'orderIds'=>$deletedOrderIds,
                    ] : null,
                    'debug'=>['company_id'=>$cid,'since'=>$since,'product_count'=>count($activeProducts),'user_count'=>count($activeUsers),'sale_count'=>count($activeSales),'order_count'=>count($activeOrders),'deleted'=>count($deletedProductIds)+count($deletedUserIds)+count($deletedSaleIds)+count($deletedOrderIds)]
                ]);
    } catch (Throwable $e) { error_log('[TradeCore API] auto-init error: ' . $e->getMessage()); }
}
        // Fallback: filter old 5 MB blob by company_id server-side
        try {
            $stmtB = $pdoI->prepare("SELECT json_data FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1");
            $stmtB->execute(); $rowB = $stmtB->fetch();
            if ($rowB && $rowB['json_data']) {
                $state = normalizeBlobData(json_decode($rowB['json_data'], true));
                if (is_array($state)) {
                    $filtered = [
                        'products' => array_values(array_filter($state['marketplaceProducts'] ?? [], fn($p)=> (string)($p['company_id']??'') === $cid)),
                        'users' => array_values(array_filter($state['users'] ?? [], fn($u)=> (string)($u['company_id']??'') === $cid)),
                    ];
                    $serverTs = time();
                    json_response([
                        'changed'=>true, 'server_ts'=>$serverTs, 'version'=>$serverTs,
                        'products'=>$filtered['products'], 'users'=>$filtered['users'],
                        'sales'=>[], 'marketplaceOrders'=>[], 'deleted'=>null,
                        'debug'=>['company_id'=>$cid,'source'=>'blob_filtered']
                    ]);
                }
            }
        } catch (Exception $e) {}
    }
    $data = null;
    $updatedAt = null;
    $version = 0;
    $pdo2 = db();
    if ($pdo2) {
        try {
            $stmt = $pdo2->prepare("SELECT json_data, updated_at, version FROM tradecore_system_state WHERE doc_key = 'main_state' LIMIT 1");
            $stmt->execute();
            $row = $stmt->fetch();
            if ($row && $row['json_data']) {
                $decoded = normalizeBlobData(json_decode($row['json_data'], true));
                if ($decoded) {
                    $data = $decoded;
                    $updatedAt = $row['updated_at'];
                    $version = isset($row['version']) ? (int)$row['version'] : (int)($decoded['_version'] ?? 0);
                }
            }
        } catch (Exception $e) {
            // Fallback when version column not yet migrated
            try {
                $stmt = $pdo2->prepare("SELECT json_data, updated_at FROM tradecore_system_state WHERE doc_key = 'main_state' LIMIT 1");
                $stmt->execute();
                $row = $stmt->fetch();
                if ($row && $row['json_data']) {
                    $decoded = normalizeBlobData(json_decode($row['json_data'], true));
                    if ($decoded) { $data = $decoded; $updatedAt = $row['updated_at']; $version = (int)($decoded['_version'] ?? 0); }
                }
            } catch (Exception $e2) {}
        }
    }
    if (!$data) {
        $fileState = readStateFile();
        if ($fileState && isset($fileState['data'])) {
            $data = $fileState['data'];
            $updatedAt = $fileState['updatedAt'] ?? $fileState['lastUpdated'] ?? null;
            $version = (int)($fileState['version'] ?? $fileState['data']['_version'] ?? 0);
        }
    }
    if ($data) {
        if (normalize_locales($data)) {
            $jsonString = json_encode($data, JSON_UNESCAPED_UNICODE);
            $pdo3 = db();
            if ($pdo3) {
                try {
                    // Best-effort locale backfill — bump version so peers re-fetch
                    try {
                        $pdo3->prepare("INSERT INTO tradecore_system_state (doc_key, json_data, updated_at, version) VALUES ('main_state', :j, NOW(3), 1) ON DUPLICATE KEY UPDATE json_data=VALUES(json_data), updated_at=NOW(3), version=version+1")->execute(['j'=>$jsonString]);
                    } catch (Exception $ee) {
                        $pdo3->prepare("INSERT INTO tradecore_system_state (doc_key, json_data, updated_at) VALUES ('main_state', :j, NOW()) ON DUPLICATE KEY UPDATE json_data=VALUES(json_data), updated_at=NOW()")->execute(['j'=>$jsonString]);
                    }
                    // Refresh updatedAt/version after bump
                    try { $r=$pdo3->query("SELECT updated_at, version FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1")->fetch(); if($r){ $updatedAt=$r['updated_at'] ?? $updatedAt; $version=(int)($r['version'] ?? $version);} } catch(Exception $e) {}
                } catch (Exception $e) {}
            }
            writeStateFile(['data'=>$data,'lastUpdated'=>$updatedAt ?? date('c'),'updatedAt'=>now(),'version'=>$version,'source'=>'php_file_persistence']);
        }
        // Attach server version into payload envelope + inside data for legacy clients
        if (!isset($data['_version'])) $data['_version'] = $version;
        if (!isset($data['_serverUpdatedAt'])) $data['_serverUpdatedAt'] = $updatedAt;
        json_response([
            "success" => true,
            "status" => "ok",
            "data" => $data,
            "locale" => $app_locale,
            "lastUpdated" => $updatedAt,
            "updatedAt" => $updatedAt,
            "version" => $version
        ]);
    } else {
        json_response(["success"=>true,"status"=>"ok","data"=>null,"message"=>"No state found in PHP database yet.","version"=>0]);
    }
}

// 2. SAVE SYSTEM STATE — atomic version++ + advisory lock + changedKeys merge
//    Fixes two critical bugs:
//    a) Same-second TIMESTAMP collisions: two saves in the same second produced
//       identical updated_at, so the 5 s poll never saw the second write.
//       Now a monotonic BIGINT `version` is the primary change detector.
//    b) Last-write-wins: a stale full-blob write could resurrect a deleted
//       product. When the client sends `changedKeys`, we preserve server values
//       for all non-dirty keys (per-collection merge).
if ($action === 'save_state') {
    $payloadData = $req_input['data'] ?? ($req_input ?: null);
    $changedKeys = $req_input['changedKeys'] ?? null;
    if (!is_array($changedKeys)) $changedKeys = null;
    elseif (count($changedKeys) > 60) $changedKeys = array_slice($changedKeys, 0, 60);
    if ($payloadData) {
        $jsonObj = $payloadData;
        if (is_array($jsonObj)) {
            normalize_locales($jsonObj);
            sanitizeUserPasswords($jsonObj);
        }
        $pdoW = db();
        $mysqlOk = false;
        $newVersion = 0;
        $newUpdatedAt = null;
        $toPersist = $jsonObj;
        // Advisory lock + merge must be atomic
        $locked = false;
        if ($pdoW) {
            try { $pdoW->query("SELECT GET_LOCK('tradecore_main_state', 5)")->fetchColumn(); $locked = true; } catch (Exception $e) { $locked = false; }
            try {
                // Read previous state for merge + current version
                $prevData = null; $prevVersion = 0;
                try {
                    $stmt = $pdoW->prepare("SELECT json_data, version FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1");
                    $stmt->execute(); $prow=$stmt->fetch();
                    if ($prow && $prow['json_data']) {
                        $pd = normalizeBlobData(json_decode($prow['json_data'], true));
                        if (is_array($pd)) { $prevData=$pd; $prevVersion=(int)($prow['version'] ?? $pd['_version'] ?? 0); }
                    }
                } catch (Exception $e) {
                    try { $stmt=$pdoW->prepare("SELECT json_data FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1"); $stmt->execute(); $prow=$stmt->fetch(); if($prow && $prow['json_data']){ $pd=normalizeBlobData(json_decode($prow['json_data'],true)); if(is_array($pd)) $prevData=$pd; } } catch(Exception $e2){}
                }
                if (!$prevData) {
                    $fs = readStateFile();
                    if ($fs && isset($fs['data']) && is_array($fs['data'])) { $prevData=$fs['data']; $prevVersion=(int)($fs['version'] ?? $fs['data']['_version'] ?? 0); }
                }
                // Per-collection merge: keep server value for every key NOT in changedKeys
                if (is_array($changedKeys) && $changedKeys !== null && is_array($prevData)) {
                    $merged = $toPersist;
                    foreach ($prevData as $k=>$v) {
                        if (!in_array($k, $changedKeys, true) && !in_array($k, ['lastUpdated','_version','_serverUpdatedAt'], true)) {
                            // Only overwrite if incoming is stale/missing for this key
                            // If incoming lacks the key entirely, keep server's.
                            // If incoming has it but not dirty, trust server.
                            $merged[$k] = $v;
                        }
                    }
                    $toPersist = $merged;
                }
                $newVersion = $prevVersion + 1;
                if ($newVersion < 1) $newVersion = 1;
                $toPersist['_version'] = $newVersion;
                $nowIso = (new DateTime('now'))->format('Y-m-d\TH:i:s.vP');
                $toPersist['lastUpdated'] = $nowIso;
                $toPersist['_serverUpdatedAt'] = $nowIso;
                $jsonString = json_encode($toPersist, JSON_UNESCAPED_UNICODE);
                // Prefer NOW(3) for microsecond precision; fallback to NOW()
                $saveOk = false;
                try {
                    $stmt = $pdoW->prepare("INSERT INTO tradecore_system_state (doc_key, json_data, updated_at, version) VALUES ('main_state', :j, NOW(3), :v) ON DUPLICATE KEY UPDATE json_data=VALUES(json_data), updated_at=NOW(3), version=VALUES(version)");
                    $stmt->execute(['j'=>$jsonString,'v'=>$newVersion]); $saveOk=true;
                } catch (Exception $e) {
                    try {
                        $stmt = $pdoW->prepare("INSERT INTO tradecore_system_state (doc_key, json_data, updated_at, version) VALUES ('main_state', :j, NOW(), :v) ON DUPLICATE KEY UPDATE json_data=VALUES(json_data), updated_at=NOW(), version=VALUES(version)");
                        $stmt->execute(['j'=>$jsonString,'v'=>$newVersion]); $saveOk=true;
                    } catch (Exception $e2) {
                        // Ultimate fallback when version column not yet migrated
                        $stmt = $pdoW->prepare("INSERT INTO tradecore_system_state (doc_key, json_data, updated_at) VALUES ('main_state', :j, NOW()) ON DUPLICATE KEY UPDATE json_data=VALUES(json_data), updated_at=NOW()");
                        $stmt->execute(['j'=>$jsonString]); $saveOk=true; $newVersion = $prevVersion + 1;
                    }
                }
                if ($saveOk) {
                    $mysqlOk = true;
                    try { $r=$pdoW->query("SELECT updated_at, version FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1")->fetch(); if($r){ $newUpdatedAt=$r['updated_at']; if(isset($r['version'])) $newVersion=(int)$r['version']; } } catch(Exception $e){}
                    if (!$newUpdatedAt) $newUpdatedAt = $nowIso;
                    // Sync atomic tables so incremental poll (company_id+since) stays consistent with full-blob saves
                    try {
                        if (is_array($changedKeys) && in_array('marketplaceProducts', $changedKeys, true)) {
                            $arr = $toPersist['marketplaceProducts'] ?? [];
                            if (is_array($arr)) {
                                $nowInt = time();
                                $stmtA = $pdoW->prepare("REPLACE INTO tradecore_products (id, company_id, data, updated_at) VALUES (?,?,?,?)");
                                foreach ($arr as $it) {
                                    if (!is_array($it) || !isset($it['id']) || !isset($it['company_id'])) continue;
                                    $stmtA->execute([(string)$it['id'], (string)$it['company_id'], json_encode($it, JSON_UNESCAPED_UNICODE), $nowInt]);
                                }
                            }
                        }
                        if (is_array($changedKeys) && in_array('users', $changedKeys, true)) {
                            $arrU = $toPersist['users'] ?? [];
                            if (is_array($arrU)) {
                                $nowInt = time();
                                $stmtU = $pdoW->prepare("REPLACE INTO tradecore_users (id, company_id, phone, data, updated_at) VALUES (?,?,?,?,?)");
                                foreach ($arrU as $u) {
                                    if (!is_array($u) || !isset($u['id']) || !isset($u['company_id']) || !isset($u['phone'])) continue;
                                    $stmtU->execute([(string)$u['id'], (string)$u['company_id'], (string)$u['phone'], json_encode($u, JSON_UNESCAPED_UNICODE), $nowInt]);
                                }
                            }
                        }
                        // Bump meta for incremental poll
                        if (is_array($changedKeys) && (in_array('marketplaceProducts', $changedKeys, true) || in_array('users', $changedKeys, true))) {
                            $pdoW->prepare("INSERT INTO tradecore_meta (id, app_version, updated_at) VALUES (1,'1.0.8',?) ON DUPLICATE KEY UPDATE updated_at=VALUES(updated_at)")->execute([time()]);
                        }
                    } catch (Exception $eSync) {}
                }
            } catch (Exception $e) { $mysqlOk = false; }
            if ($locked) { try { $pdoW->query("SELECT RELEASE_LOCK('tradecore_main_state')")->fetchColumn(); } catch(Exception $e){} }
        }
        // File fallback always
        $fileOk = writeStateFile(['data'=>$toPersist,'lastUpdated'=>$newUpdatedAt ?? $toPersist['lastUpdated'] ?? date('c'),'updatedAt'=>now(),'version'=>$newVersion,'source'=>'php_file_persistence']);
        if ($mysqlOk || $fileOk) {
            json_response([
                "success"=>true,"status"=>"ok",
                "message"=>$mysqlOk ? "State saved successfully to MySQL and file system" : "State saved to file system only (MySQL unavailable)",
                "mysqlOk"=>$mysqlOk,"fileOk"=>$fileOk,
                "updatedAt"=>$newUpdatedAt ?? date("Y-m-d H:i:s"),
                "lastUpdated"=>$newUpdatedAt ?? $toPersist['lastUpdated'] ?? date('c'),
                "version"=>$newVersion,
                "server_ts"=>$newVersion
            ]);
        } else {
            json_error("Failed to persist state: both MySQL and file system writes failed", 500);
        }
    } else {
        json_error("Empty payload provided", 400);
    }
}

// 2b. ATOMIC DELETE_PRODUCT — no 5 MB blob race (dual-writes to new table + blob for backward compat)
if ($action === 'delete_product') {
    $id = trim((string)($_POST['id'] ?? $_GET['id'] ?? $req_input['id'] ?? ''));
    $company_id = trim((string)($_POST['company_id'] ?? $_GET['company_id'] ?? $req_input['company_id'] ?? ''));
    if ($id === '' || $company_id === '') json_error('id and company_id required', 422);
    $pdoA = db();
    if (!$pdoA) json_error('Database unavailable', 503);
    try {
        $pdoA->exec("SET SESSION TRANSACTION ISOLATION LEVEL SERIALIZABLE");
        $pdoA->beginTransaction();
        $stmt = $pdoA->prepare("DELETE FROM tradecore_products WHERE id=? AND company_id=?");
        $stmt->execute([$id, $company_id]);
        $now = time();
        $pdoA->prepare("INSERT INTO tradecore_meta (id, app_version, updated_at) VALUES (1,'1.0.8',?) ON DUPLICATE KEY UPDATE updated_at=VALUES(updated_at)")->execute([$now]);
        // Dual-write: keep old 5 MB blob in sync for old clients that still poll full blob
        try {
            $stmt2 = $pdoA->prepare("SELECT json_data, version FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1");
            $stmt2->execute(); $row = $stmt2->fetch();
            if ($row && $row['json_data']) {
                $blob = normalizeBlobData(json_decode($row['json_data'], true));
                if (is_array($blob) && isset($blob['marketplaceProducts']) && is_array($blob['marketplaceProducts'])) {
                    $blob['marketplaceProducts'] = array_values(array_filter($blob['marketplaceProducts'], fn($p)=> !((string)($p['id']??'') === $id && (string)($p['company_id']??'') === $company_id)));
                    $prevVer = isset($row['version']) ? (int)$row['version'] : (int)($blob['_version'] ?? 0);
                    $newVer = $prevVer + 1; if ($newVer < 1) $newVer = 1;
                    $blob['_version'] = $newVer; $blob['lastUpdated'] = date('c'); $blob['_serverUpdatedAt'] = date('c');
                    $j = json_encode($blob, JSON_UNESCAPED_UNICODE);
                    try { $pdoA->prepare("INSERT INTO tradecore_system_state (doc_key, json_data, updated_at, version) VALUES ('main_state',?,NOW(3),?) ON DUPLICATE KEY UPDATE json_data=VALUES(json_data), updated_at=NOW(3), version=VALUES(version)")->execute([$j,$newVer]); }
                    catch (Exception $e) { $pdoA->prepare("INSERT INTO tradecore_system_state (doc_key, json_data, updated_at, version) VALUES ('main_state',?,NOW(),?) ON DUPLICATE KEY UPDATE json_data=VALUES(json_data), updated_at=NOW(), version=VALUES(version)")->execute([$j,$newVer]); }
                }
            }
            // Also update file fallback
            $fs = readStateFile(); if ($fs && isset($fs['data']['marketplaceProducts'])) {
                $fs['data']['marketplaceProducts'] = array_values(array_filter($fs['data']['marketplaceProducts'], fn($p)=> !((string)($p['id']??'') === $id && (string)($p['company_id']??'') === $company_id)));
                $fs['data']['_version'] = ($fs['data']['_version'] ?? 0) + 1; $fs['data']['lastUpdated'] = date('c');
                writeStateFile(['data'=>$fs['data'],'lastUpdated'=>date('c'),'updatedAt'=>now(),'version'=>$fs['data']['_version'],'source'=>'php_file_persistence']);
            }
        } catch (Exception $eBlob) {}
        $pdoA->commit();
        json_response(['success'=>true,'server_ts'=>$now,'version'=>$now]);
    } catch (Exception $e) {
        if ($pdoA->inTransaction()) $pdoA->rollBack();
        json_error('delete_product failed: '.$e->getMessage(), 500);
    }
}

// 2b. UPSERT_PRODUCT — atomic create/update, no blob race
if ($action === 'upsert_product') {
    $raw = $req_input['product_json'] ?? $_POST['product_json'] ?? null;
    $pData = is_string($raw) ? json_decode($raw, true) : (is_array($raw) ? $raw : null);
    if (!$pData || !isset($pData['id'])) json_error('product_json with id required', 422);
    $pid = (string)$pData['id'];
    $cid = trim((string)($pData['company_id'] ?? $_POST['company_id'] ?? $req_input['company_id'] ?? ''));
    if ($cid === '') json_error('company_id required', 422);
    $pData['company_id'] = $cid;
    $now = time();
    $pData['updated_at'] = $now;
    $pdoA = db();
    if (!$pdoA) json_error('Database unavailable', 503);
    try {
        $pdoA->exec("SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED");
        $pdoA->beginTransaction();
        $j = json_encode($pData, JSON_UNESCAPED_UNICODE);
        $pdoA->prepare("REPLACE INTO tradecore_products (id, company_id, data, updated_at, deleted_at) VALUES (?,?,?, ?, NULL)")->execute([$pid, $cid, $j, $now]);
        $pdoA->prepare("INSERT INTO tradecore_meta (id, app_version, updated_at) VALUES (1,'1.0.9',?) ON DUPLICATE KEY UPDATE updated_at=VALUES(updated_at)")->execute([$now]);
        // Dual-write to old blob
        try {
            $stmt2 = $pdoA->prepare("SELECT json_data, version FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1");
            $stmt2->execute(); $row = $stmt2->fetch();
            if ($row && $row['json_data']) {
                $blob = normalizeBlobData(json_decode($row['json_data'], true));
                if (is_array($blob)) {
                    $prods = isset($blob['marketplaceProducts']) && is_array($blob['marketplaceProducts']) ? $blob['marketplaceProducts'] : [];
                    $prods = array_values(array_filter($prods, fn($p) => (string)($p['id']??'') !== $pid || (string)($p['company_id']??'') !== $cid));
                    $prods[] = $pData;
                    $blob['marketplaceProducts'] = $prods;
                    $prevVer = isset($row['version']) ? (int)$row['version'] : (int)($blob['_version'] ?? 0);
                    $newVer = max($prevVer + 1, 1);
                    $blob['_version'] = $newVer; $blob['lastUpdated'] = date('c'); $blob['_serverUpdatedAt'] = date('c');
                    $jj = json_encode($blob, JSON_UNESCAPED_UNICODE);
                    try { $pdoA->prepare("INSERT INTO tradecore_system_state (doc_key, json_data, updated_at, version) VALUES ('main_state',?,NOW(3),?) ON DUPLICATE KEY UPDATE json_data=VALUES(json_data), updated_at=NOW(3), version=VALUES(version)")->execute([$jj,$newVer]); }
                    catch (Exception $e) { $pdoA->prepare("INSERT INTO tradecore_system_state (doc_key, json_data, updated_at, version) VALUES ('main_state',?,NOW(),?) ON DUPLICATE KEY UPDATE json_data=VALUES(json_data), updated_at=NOW(), version=VALUES(version)")->execute([$jj,$newVer]); }
                }
            }
        } catch (Exception $eBlob) {}
        $pdoA->commit();
        json_response(['success'=>true, 'server_ts'=>$now, 'version'=>$now, 'id'=>$pid]);
    } catch (Exception $e) {
        if ($pdoA->inTransaction()) $pdoA->rollBack();
        json_error('upsert_product failed: '.$e->getMessage(), 500);
    }
}

// 2c. UPSERT_USER — atomic create/update
if ($action === 'upsert_user') {
    $raw = $req_input['user_json'] ?? $_POST['user_json'] ?? null;
    $uData = is_string($raw) ? json_decode($raw, true) : (is_array($raw) ? $raw : null);
    if (!$uData || !isset($uData['id'])) json_error('user_json with id required', 422);
    $uid = (string)$uData['id'];
    $ucid = trim((string)($uData['company_id'] ?? $_POST['company_id'] ?? $req_input['company_id'] ?? ''));
    $uphone = trim((string)($uData['phone'] ?? $_POST['phone'] ?? $req_input['phone'] ?? ''));
    if ($ucid === '' || $uphone === '') json_error('company_id and phone required', 422);
    $uData['company_id'] = $ucid;
    $uData['phone'] = $uphone;
    // Hash password if plaintext provided
    if (isset($uData['password']) && $uData['password'] !== '' && !isset($uData['password_hash'])) {
        $uData['password_hash'] = password_hash($uData['password'], PASSWORD_DEFAULT);
        unset($uData['password']);
    }
    $now = time();
    $uData['updated_at'] = $now;
    $pdoA = db();
    if (!$pdoA) json_error('Database unavailable', 503);
    try {
        $pdoA->exec("SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED");
        $pdoA->beginTransaction();
        $j = json_encode($uData, JSON_UNESCAPED_UNICODE);
        $pdoA->prepare("REPLACE INTO tradecore_users (id, company_id, phone, data, updated_at, deleted_at) VALUES (?,?,?,?,?, NULL)")->execute([$uid, $ucid, $uphone, $j, $now]);
        $pdoA->prepare("INSERT INTO tradecore_meta (id, app_version, updated_at) VALUES (1,'1.0.9',?) ON DUPLICATE KEY UPDATE updated_at=VALUES(updated_at)")->execute([$now]);
        // Dual-write to old blob
        try {
            $stmt2 = $pdoA->prepare("SELECT json_data, version FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1");
            $stmt2->execute(); $row = $stmt2->fetch();
            if ($row && $row['json_data']) {
                $blob = normalizeBlobData(json_decode($row['json_data'], true));
                if (is_array($blob)) {
                    $users = isset($blob['users']) && is_array($blob['users']) ? $blob['users'] : [];
                    $users = array_values(array_filter($users, fn($u) => !((string)($u['phone']??'') === $uphone && (string)($u['company_id']??'') === $ucid));
                    $users[] = $uData;
                    $blob['users'] = $users;
                    $prevVer = isset($row['version']) ? (int)$row['version'] : (int)($blob['_version'] ?? 0);
                    $newVer = max($prevVer + 1, 1);
                    $blob['_version'] = $newVer; $blob['lastUpdated'] = date('c');
                    $jj = json_encode($blob, JSON_UNESCAPED_UNICODE);
                    try { $pdoA->prepare("INSERT INTO tradecore_system_state (doc_key, json_data, updated_at, version) VALUES ('main_state',?,NOW(3),?) ON DUPLICATE KEY UPDATE json_data=VALUES(json_data), updated_at=NOW(3), version=VALUES(version)")->execute([$jj,$newVer]); }
                    catch (Exception $e) { $pdoA->prepare("INSERT INTO tradecore_system_state (doc_key, json_data, updated_at, version) VALUES ('main_state',?,NOW(),?) ON DUPLICATE KEY UPDATE json_data=VALUES(json_data), updated_at=NOW(), version=VALUES(version)")->execute([$jj,$newVer]); }
                }
            }
        } catch (Exception $eBlob) {}
        $pdoA->commit();
        json_response(['success'=>true, 'server_ts'=>$now, 'version'=>$now, 'id'=>$uid]);
    } catch (Exception $e) {
        if ($pdoA->inTransaction()) $pdoA->rollBack();
        json_error('upsert_user failed: '.$e->getMessage(), 500);
    }
}

// 2d. UPSERT_SALE — atomic create/update for salesOrders
if ($action === 'upsert_sale') {
    $raw = $req_input['sale_json'] ?? $_POST['sale_json'] ?? null;
    $sData = is_string($raw) ? json_decode($raw, true) : (is_array($raw) ? $raw : null);
    if (!$sData || !isset($sData['id'])) json_error('sale_json with id required', 422);
    $sid = (string)$sData['id'];
    $scid = trim((string)($sData['companyId'] ?? $sData['company_id'] ?? $_POST['company_id'] ?? $req_input['company_id'] ?? ''));
    if ($scid === '') json_error('companyId required', 422);
    $now = time();
    $sData['updated_at'] = $now;
    $pdoA = db();
    if (!$pdoA) json_error('Database unavailable', 503);
    try {
        $pdoA->beginTransaction();
        $j = json_encode($sData, JSON_UNESCAPED_UNICODE);
        $pdoA->prepare("REPLACE INTO tradecore_sales (id, company_id, data, updated_at, deleted_at) VALUES (?,?,?, ?, NULL)")->execute([$sid, $scid, $j, $now]);
        $pdoA->prepare("INSERT INTO tradecore_meta (id, app_version, updated_at) VALUES (1,'1.0.9',?) ON DUPLICATE KEY UPDATE updated_at=VALUES(updated_at)")->execute([$now]);
        $pdoA->commit();
        json_response(['success'=>true, 'server_ts'=>$now, 'id'=>$sid]);
    } catch (Exception $e) {
        if ($pdoA->inTransaction()) $pdoA->rollBack();
        json_error('upsert_sale failed: '.$e->getMessage(), 500);
    }
}

// 2e. UPSERT_ORDER — atomic create/update for marketplaceOrders
if ($action === 'upsert_order') {
    $raw = $req_input['order_json'] ?? $_POST['order_json'] ?? null;
    $oData = is_string($raw) ? json_decode($raw, true) : (is_array($raw) ? $raw : null);
    if (!$oData || !isset($oData['id'])) json_error('order_json with id required', 422);
    $oid = (string)$oData['id'];
    $ocid = trim((string)($oData['companyId'] ?? $oData['company_id'] ?? $_POST['company_id'] ?? $req_input['company_id'] ?? ''));
    if ($ocid === '') json_error('companyId required', 422);
    $now = time();
    $oData['updated_at'] = $now;
    $pdoA = db();
    if (!$pdoA) json_error('Database unavailable', 503);
    try {
        $pdoA->beginTransaction();
        $j = json_encode($oData, JSON_UNESCAPED_UNICODE);
        $pdoA->prepare("REPLACE INTO tradecore_marketplace_orders (id, company_id, data, updated_at, deleted_at) VALUES (?,?,?, ?, NULL)")->execute([$oid, $ocid, $j, $now]);
        $pdoA->prepare("INSERT INTO tradecore_meta (id, app_version, updated_at) VALUES (1,'1.0.9',?) ON DUPLICATE KEY UPDATE updated_at=VALUES(updated_at)")->execute([$now]);
        $pdoA->commit();
        json_response(['success'=>true, 'server_ts'=>$now, 'id'=>$oid]);
    } catch (Exception $e) {
        if ($pdoA->inTransaction()) $pdoA->rollBack();
        json_error('upsert_order failed: '.$e->getMessage(), 500);
    }
}

// 2f. DELETE_USER — soft delete
if ($action === 'delete_user') {
    $id = trim((string)($_POST['id'] ?? $_GET['id'] ?? $req_input['id'] ?? ''));
    $company_id = trim((string)($_POST['company_id'] ?? $_GET['company_id'] ?? $req_input['company_id'] ?? ''));
    if ($id === '' || $company_id === '') json_error('id and company_id required', 422);
    $pdoA = db();
    if (!$pdoA) json_error('Database unavailable', 503);
    try {
        $now = time();
        $pdoA->beginTransaction();
        $pdoA->prepare("UPDATE tradecore_users SET deleted_at=?, updated_at=? WHERE id=? AND company_id=?")->execute([$now, $now, $id, $company_id]);
        $pdoA->prepare("INSERT INTO tradecore_meta (id, app_version, updated_at) VALUES (1,'1.0.9',?) ON DUPLICATE KEY UPDATE updated_at=VALUES(updated_at)")->execute([$now]);
        // Dual-write to blob
        try {
            $stmt2 = $pdoA->prepare("SELECT json_data, version FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1");
            $stmt2->execute(); $row = $stmt2->fetch();
            if ($row && $row['json_data']) {
                $blob = normalizeBlobData(json_decode($row['json_data'], true));
                if (is_array($blob) && isset($blob['users']) && is_array($blob['users'])) {
                    $blob['users'] = array_values(array_filter($blob['users'], fn($u) => !((string)($u['id']??'') === $id && (string)($u['company_id']??'') === $company_id)));
                    $prevVer = isset($row['version']) ? (int)$row['version'] : (int)($blob['_version'] ?? 0);
                    $newVer = max($prevVer + 1, 1);
                    $blob['_version'] = $newVer; $blob['lastUpdated'] = date('c'); $blob['_serverUpdatedAt'] = date('c');
                    $jj = json_encode($blob, JSON_UNESCAPED_UNICODE);
                    try { $pdoA->prepare("INSERT INTO tradecore_system_state (doc_key, json_data, updated_at, version) VALUES ('main_state',?,NOW(3),?) ON DUPLICATE KEY UPDATE json_data=VALUES(json_data), updated_at=NOW(3), version=VALUES(version)")->execute([$jj,$newVer]); }
                    catch (Exception $e) { $pdoA->prepare("INSERT INTO tradecore_system_state (doc_key, json_data, updated_at, version) VALUES ('main_state',?,NOW(),?) ON DUPLICATE KEY UPDATE json_data=VALUES(json_data), updated_at=NOW(), version=VALUES(version)")->execute([$jj,$newVer]); }
                }
            }
        } catch (Exception $eBlob) {}
        $pdoA->commit();
        json_response(['success'=>true, 'server_ts'=>$now]);
    } catch (Exception $e) {
        if ($pdoA->inTransaction()) $pdoA->rollBack();
        json_error('delete_user failed: '.$e->getMessage(), 500);
    }
}

// 2g. ATOMIC ASSIGN_USER — one row, no blob overwrite
if ($action === 'assign_user' || $action === 'create_user') {
    $raw = $req_input['user_json'] ?? $_POST['user_json'] ?? null;
    $userData = is_string($raw) ? json_decode($raw, true) : (is_array($raw) ? $raw : $req_input);
    // Allow flat POST fields as well
    if (!is_array($userData) || !isset($userData['phone'])) {
        $userData = [
            'id' => $_POST['id'] ?? $req_input['id'] ?? uniqid('u_'),
            'company_id' => $_POST['company_id'] ?? $req_input['company_id'] ?? '',
            'phone' => $_POST['phone'] ?? $req_input['phone'] ?? '',
            'name' => $_POST['name'] ?? $req_input['name'] ?? '',
            'role' => $_POST['role'] ?? $req_input['role'] ?? 'seller',
            'password' => $_POST['password'] ?? $req_input['password'] ?? ''
        ];
    }
    $id = trim((string)($userData['id'] ?? uniqid('u_')));
    $company_id = trim((string)($userData['company_id'] ?? ''));
    $phone = trim((string)($userData['phone'] ?? ''));
    if ($id === '' || $company_id === '' || $phone === '') json_error('id, company_id and phone required', 422);
    $plain = (string)($userData['password'] ?? $_POST['password'] ?? $req_input['password'] ?? '');
    if ($plain === '') json_error('password required', 422);
    $userData['id'] = $id; $userData['company_id'] = $company_id; $userData['phone'] = $phone;
    $userData['password_hash'] = password_hash($plain, PASSWORD_DEFAULT);
    unset($userData['password']);
    $userData['is_active'] = 1; $userData['updated_at'] = time();
    // Ensure hashed password is also sanitized for blob dual-write
    $pdoA = db();
    if (!$pdoA) json_error('Database unavailable', 503);
    try {
        $pdoA->exec("SET SESSION TRANSACTION ISOLATION LEVEL SERIALIZABLE");
        $pdoA->beginTransaction();
        $j = json_encode($userData, JSON_UNESCAPED_UNICODE);
        $now = time();
        $pdoA->prepare("REPLACE INTO tradecore_users (id, company_id, phone, data, updated_at) VALUES (?,?,?,?,?)")->execute([$id, $company_id, $phone, $j, $now]);
        $pdoA->prepare("INSERT INTO tradecore_meta (id, app_version, updated_at) VALUES (1,'1.0.8',?) ON DUPLICATE KEY UPDATE updated_at=VALUES(updated_at)")->execute([$now]);
        // Dual-write to old blob
        try {
            $stmt2 = $pdoA->prepare("SELECT json_data, version FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1");
            $stmt2->execute(); $row = $stmt2->fetch();
            if ($row && $row['json_data']) {
                $blob = normalizeBlobData(json_decode($row['json_data'], true));
                if (is_array($blob)) {
                    $users = isset($blob['users']) && is_array($blob['users']) ? $blob['users'] : [];
                    // Remove old same phone+company, then append
                    $users = array_values(array_filter($users, fn($u)=> !((string)($u['phone']??'') === $phone && (string)($u['company_id']??'') === $company_id)));
                    // Keep password hashed already
                    $users[] = $userData;
                    $blob['users'] = $users;
                    $prevVer = isset($row['version']) ? (int)$row['version'] : (int)($blob['_version'] ?? 0);
                    $newVer = $prevVer + 1; if ($newVer < 1) $newVer = 1;
                    $blob['_version'] = $newVer; $blob['lastUpdated'] = date('c');
                    $jj = json_encode($blob, JSON_UNESCAPED_UNICODE);
                    try { $pdoA->prepare("INSERT INTO tradecore_system_state (doc_key, json_data, updated_at, version) VALUES ('main_state',?,NOW(3),?) ON DUPLICATE KEY UPDATE json_data=VALUES(json_data), updated_at=NOW(3), version=VALUES(version)")->execute([$jj,$newVer]); }
                    catch (Exception $e) { $pdoA->prepare("INSERT INTO tradecore_system_state (doc_key, json_data, updated_at, version) VALUES ('main_state',?,NOW(),?) ON DUPLICATE KEY UPDATE json_data=VALUES(json_data), updated_at=NOW(), version=VALUES(version)")->execute([$jj,$newVer]); }
                    $fs = readStateFile(); if ($fs && isset($fs['data'])) { $fs['data']['users'] = $users; $fs['data']['_version'] = $newVer; $fs['data']['lastUpdated']=date('c'); writeStateFile(['data'=>$fs['data'],'lastUpdated'=>date('c'),'updatedAt'=>now(),'version'=>$newVer,'source'=>'php_file_persistence']); }
                }
            }
        } catch (Exception $eBlob) {}
        $pdoA->commit();
        json_response(['success'=>true,'server_ts'=>$now,'version'=>$now,'user'=>$userData]);
    } catch (Exception $e) {
        if ($pdoA->inTransaction()) $pdoA->rollBack();
        $code = strpos($e->getMessage(),'uniq')!==false || strpos($e->getMessage(),'Duplicate')!==false ? 409 : 500;
        json_error('assign_user failed: '.$e->getMessage(), $code);
    }
}

// 2d. ATOMIC LOGIN — checks atomic table first, falls back to blob
if ($action === 'login') {
    $phone = trim((string)($_POST['phone'] ?? $req_input['phone'] ?? ''));
    $pass = (string)($_POST['password'] ?? $req_input['password'] ?? '');
    $username = trim((string)($_POST['username'] ?? $req_input['username'] ?? ''));
    if (($phone === '' && $username === '') || $pass === '') json_error('phone/username and password required', 422);
    $pdoA = db();
    if ($pdoA) {
        try {
            // Try by phone in atomic table
            if ($phone !== '') {
                $stmt = $pdoA->prepare("SELECT data FROM tradecore_users WHERE phone=? LIMIT 1");
                $stmt->execute([$phone]);
                $row = $stmt->fetch();
                if ($row && $row['data']) {
                    $u = json_decode($row['data'], true);
                    if (is_array($u) && ($u['is_active'] ?? 1) == 1 && verifyStoredPassword($pass, $u)) {
                        json_response(['success'=>true,'user'=>$u,'token'=>bin2hex(random_bytes(16)),'server_ts'=>time()]);
                    }
                }
                // Try phone+company scoped if company_code provided
                $company_code = trim((string)($_POST['company_code'] ?? $req_input['company_code'] ?? ''));
                if ($company_code !== '') {
                    $stmt = $pdoA->prepare("SELECT data FROM tradecore_users WHERE phone=? AND company_id=? LIMIT 1");
                    $stmt->execute([$phone, $company_code]);
                    $row = $stmt->fetch();
                    if ($row && $row['data']) {
                        $u = json_decode($row['data'], true);
                        if (is_array($u) && ($u['is_active'] ?? 1) == 1 && verifyStoredPassword($pass, $u)) {
                            json_response(['success'=>true,'user'=>$u,'token'=>bin2hex(random_bytes(16)),'server_ts'=>time()]);
                        }
                    }
                }
            }
            // Try by username in atomic table (scan all users for this company or all)
            if ($username !== '') {
                $company_code = trim((string)($_POST['company_code'] ?? $req_input['company_code'] ?? ''));
                $allRows = [];
                if ($company_code !== '') {
                    $stmt = $pdoA->prepare("SELECT data FROM tradecore_users WHERE company_id=?");
                    $stmt->execute([$company_code]);
                    $allRows = $stmt->fetchAll();
                } else {
                    $stmt = $pdoA->query("SELECT data FROM tradecore_users");
                    $allRows = $stmt->fetchAll();
                }
                foreach ($allRows as $r) {
                    if (!$r['data']) continue;
                    $u = json_decode($r['data'], true);
                    if (!is_array($u)) continue;
                    if (strtolower(trim($u['username'] ?? '')) !== strtolower($username)) continue;
                    if (($u['is_active'] ?? 1) != 1) continue;
                    if (verifyStoredPassword($pass, $u)) {
                        json_response(['success'=>true,'user'=>$u,'token'=>bin2hex(random_bytes(16)),'server_ts'=>time()]);
                    }
                }
            }
        } catch (Exception $e) {}
        // Fallback to old blob — try phone first, then username
        try {
            $stmt = $pdoA->prepare("SELECT json_data FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1");
            $stmt->execute(); $row=$stmt->fetch();
            if ($row && $row['json_data']) {
                $blob=normalizeBlobData(json_decode($row['json_data'], true));
                if (is_array($blob) && isset($blob['users']) && is_array($blob['users'])) {
                    foreach ($blob['users'] as $u) {
                        if (!is_array($u)) continue;
                        $matchPhone = $phone !== '' && (string)($u['phone']??'') === $phone;
                        $matchUsername = $username !== '' && strtolower(trim($u['username'] ?? '')) === strtolower($username);
                        if (!$matchPhone && !$matchUsername) continue;
                        if (($u['is_active'] ?? 1) != 1) continue;
                        $hash = $u['password_hash'] ?? $u['password'] ?? '';
                        $ok = false;
                        if (strpos($hash, PASSWORD_HASH_PREFIX)===0) $ok = hash_equals($hash, hashStoredPassword($pass));
                        elseif (strpos($hash, '$2y$')===0) $ok = password_verify($pass, $hash);
                        else $ok = hash_equals((string)$hash, $pass);
                        if ($ok) json_response(['success'=>true,'user'=>$u,'token'=>bin2hex(random_bytes(16)),'server_ts'=>time()]);
                    }
                }
            }
        } catch (Exception $e) {}
    }
    json_response(['success'=>false,'error'=>'User not found or inactive'], 401);
}

// 3. STREAM REALTIME UPDATES (Server-Sent Events) — now version-aware + lightweight
if ($action === 'stream_updates') {
    // SSE — never let PHP errors produce a raw 500 HTML page
    ignore_user_abort(false);
    set_time_limit(10);
    ob_implicit_flush(true);
    @ini_set('output_buffering', '0');
    @ini_set('zlib.output_compression', '0');
    if (ob_get_level() > 0) @ob_end_clean();
    if (!headers_sent()) {
        header('Content-Type: text/event-stream');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Connection: keep-alive');
        header('X-Accel-Buffering: no');
    }
    // Always send an initial ping so the client knows we're alive
    echo "data: " . json_encode(["type" => "connected", "updatedAt" => date('c'), "version" => 0]) . "\n\n";
    @flush();
    $lastSeenVersion = -1;
    $lastSeenUpdatedAt = '';
    try {
        $pdoS = db();
        for ($i = 0; $i < 6; $i++) {
            if (connection_aborted()) break;
            $curVersion = null; $curUpdatedAt = null;
            if ($pdoS) {
                try {
                    $stmt = $pdoS->prepare("SELECT version, updated_at FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1");
                    $stmt->execute(); $row=$stmt->fetch();
                    if ($row) { if(isset($row['version'])) $curVersion=(int)$row['version']; if(!empty($row['updated_at'])) $curUpdatedAt=(string)$row['updated_at']; }
                } catch (Exception $e) {
                    try { $stmt=$pdoS->prepare("SELECT updated_at FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1"); $stmt->execute(); $row=$stmt->fetch(); if($row && $row['updated_at']) $curUpdatedAt=(string)$row['updated_at']; } catch(Exception $e2){}
                }
            }
            if ($curVersion===null && $curUpdatedAt===null) {
                $fileState = readStateFile();
                if ($fileState) {
                    if (isset($fileState['version'])) $curVersion=(int)$fileState['version'];
                    elseif (isset($fileState['data']['_version'])) $curVersion=(int)$fileState['data']['_version'];
                    $curUpdatedAt = $fileState['updatedAt'] ?? $fileState['lastUpdated'] ?? null;
                }
            }
            $changed = false;
            if ($curVersion !== null && $curVersion !== $lastSeenVersion) $changed = true;
            elseif ($curUpdatedAt !== null && $curUpdatedAt !== $lastSeenUpdatedAt) $changed = true;
            elseif ($curVersion===null && $curUpdatedAt===null && $i===0) $changed = true;
            if ($changed) {
                $lastSeenVersion = $curVersion ?? $lastSeenVersion;
                $lastSeenUpdatedAt = $curUpdatedAt ?? $lastSeenUpdatedAt;
                $stateData = null; $updatedAtVal = $curUpdatedAt; $verOut = $curVersion;
                if ($pdoS) {
                    try {
                        $stmt = $pdoS->prepare("SELECT json_data, updated_at, version FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1");
                        $stmt->execute(); $row=$stmt->fetch();
                        if ($row && $row['json_data']) { $dec=normalizeBlobData(json_decode($row['json_data'], true)); if($dec){ $stateData=$dec; $updatedAtVal=$row['updated_at'] ?? $curUpdatedAt; if(isset($row['version'])) $verOut=(int)$row['version']; } }
                    } catch (Exception $e) {
                        try { $stmt=$pdoS->prepare("SELECT json_data, updated_at FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1"); $stmt->execute(); $row=$stmt->fetch(); if($row && $row['json_data']){ $dec=normalizeBlobData(json_decode($row['json_data'], true)); if($dec){ $stateData=$dec; $updatedAtVal=$row['updated_at']; } } } catch(Exception $e2){}
                    }
                }
                if (!$stateData) {
                    $fileState = readStateFile();
                    if ($fileState && isset($fileState['data'])) { $stateData=$fileState['data']; $updatedAtVal=$fileState['updatedAt'] ?? $fileState['lastUpdated'] ?? $curUpdatedAt; $verOut=$fileState['version'] ?? $stateData['_version'] ?? $verOut; }
                }
                if ($stateData) {
                    if (!isset($stateData['_version']) && $verOut!==null) $stateData['_version']=$verOut;
                    echo "data: " . json_encode(["data"=>$stateData,"updatedAt"=>$updatedAtVal,"version"=>$verOut,"lastUpdated"=>$updatedAtVal]) . "\n\n";
                    @flush();
                }
            }
            sleep(1);
        }
    } catch (Throwable $e) {
        error_log('[TradeCore SSE] Error: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
        if (!connection_aborted()) {
            echo "data: " . json_encode(["error" => "SSE temporary error", "updatedAt" => date('c'), "version" => 0]) . "\n\n";
            @flush();
        }
    }
    exit();
}

// 4. SUBMIT REVIEW (Feature 3) — public endpoint. Validates, guards against duplicates
// (same reviewer key + same product within 24h), then queues the review as PENDING.
// Aggregates are only recomputed from approved rows (see approve_review).
if ($action === 'submit_review') {
    $companyId = (int)($req_input['companyId'] ?? 0);
    $productId = isset($req_input['productId']) && $req_input['productId'] !== null && $req_input['productId'] !== '' ? (int)$req_input['productId'] : null;
    $reviewerName = trim((string)($req_input['reviewerName'] ?? ''));
    $reviewerPhone = trim((string)($req_input['reviewerPhone'] ?? ''));
    $rating = (int)($req_input['rating'] ?? 0);
    $comment = trim((string)($req_input['comment'] ?? ''));
    $isVerifiedBuyer = !empty($req_input['isVerifiedBuyer']);

    if ($companyId <= 0) json_error('Company is required', 422);
    if (mb_strlen($reviewerName) < 2 || mb_strlen($reviewerName) > 60) json_error('Please enter your name (2-60 characters).', 422);
    if ($rating < 1 || $rating > 5) json_error('Please choose a star rating.', 422);
    if (mb_strlen($comment) > 1000) json_error('Review comment is limited to 1000 characters.', 422);

    $state = load_system_state_array();
    if (!is_array($state)) json_error('System state unavailable. Please try again shortly.', 503);

    $reviews = isset($state['reviews']) && is_array($state['reviews']) ? $state['reviews'] : [];

    // 24h duplicate guard — same normalized phone (or name) + same product
    $normalizedPhone = preg_replace('/[^0-9]/', '', $reviewerPhone);
    $key = $normalizedPhone !== '' ? $normalizedPhone : strtolower($reviewerName);
    if ($key !== '') {
        $cutoff = time() - 24 * 60 * 60;
        foreach ($reviews as $r) {
            if (!is_array($r)) continue;
            if ((int)($r['productId'] ?? -1) !== $productId) continue;
            $rCreated = strtotime((string)($r['createdAt'] ?? ''));
            if ($rCreated !== false && $rCreated < $cutoff) continue;
            $rPhone = preg_replace('/[^0-9]/', '', (string)($r['reviewerPhone'] ?? ''));
            $rKey = $rPhone !== '' ? $rPhone : strtolower((string)($r['reviewerName'] ?? ''));
            if ($rKey !== '' && $rKey === $key) {
                json_error('You have already reviewed this product in the last 24 hours.', 429);
            }
        }
    }

    $maxId = 0;
    foreach ($reviews as $r) { if (is_array($r) && (int)($r['id'] ?? 0) > $maxId) $maxId = (int)$r['id']; }

    $newReview = [
        'id' => $maxId + 1,
        'companyId' => $companyId,
        'productId' => $productId,
        'userId' => isset($req_input['userId']) ? (int)$req_input['userId'] : null,
        'reviewerName' => $reviewerName,
        'reviewerPhone' => $reviewerPhone !== '' ? $reviewerPhone : null,
        'rating' => $rating,
        'comment' => $comment !== '' ? $comment : null,
        'isVerifiedBuyer' => $isVerifiedBuyer,
        'status' => 'pending',
        'ipAddress' => get_client_ip(),
        'createdAt' => date('c')
    ];
    array_unshift($reviews, $newReview);
    $state['reviews'] = array_slice($reviews, 0, 2000);

    if (!save_system_state_array($state)) {
        json_error('Failed to save your review. Please try again.', 500);
    }
    json_response([
        "success" => true,
        "message" => "Review submitted and awaiting approval.",
        "review" => $newReview
    ]);
}

// 5. APPROVE / REJECT REVIEW (Feature 3) — ROOT_MANDATE only. Recomputes
// average_rating + reviews_count on the affected company and product.
if ($action === 'approve_review') {
    $reviewId = (int)($req_input['reviewId'] ?? 0);
    $newStatus = trim((string)($req_input['status'] ?? 'approved'));
    if (!in_array($newStatus, ['approved', 'rejected', 'pending'], true)) $newStatus = 'approved';

    // ROOT authorization
    $rootKey = trim((string)($req_input['rootKey'] ?? ''));
    if (strpos($req_input['username'] ?? '', 'root_mandate') === false && strpos($req_input['username'] ?? '', 'superadmin') === false) {
        json_error('Access denied: ROOT_MANDATE only.', 403);
    }
    unset($rootKey);

    $state = load_system_state_array();
    if (!is_array($state)) json_error('System state unavailable.', 503);

    $reviews = isset($state['reviews']) && is_array($state['reviews']) ? $state['reviews'] : [];
    $found = false;
    foreach ($reviews as $k => $r) {
        if (is_array($r) && (int)($r['id'] ?? 0) === $reviewId) {
            $reviews[$k]['status'] = $newStatus;
            $reviews[$k]['decidedAt'] = date('c');
            $found = true;
            break;
        }
    }
    if (!$found) json_error('Review not found.', 404);
    $state['reviews'] = $reviews;

    // Recompute aggregates from approved reviews
    $approved = array_values(array_filter($reviews, function ($r) {
        return is_array($r) && ($r['status'] ?? '') === 'approved';
    }));
    $companyAgg = [];
    $productAgg = [];
    foreach ($approved as $r) {
        $cid = (int)($r['companyId'] ?? 0);
        $pid = isset($r['productId']) && $r['productId'] !== null ? (int)$r['productId'] : null;
        if ($cid > 0) { $companyAgg[$cid]['sum'] = ($companyAgg[$cid]['sum'] ?? 0) + (int)$r['rating']; $companyAgg[$cid]['cnt'] = ($companyAgg[$cid]['cnt'] ?? 0) + 1; }
        if ($pid !== null && $pid > 0) { $productAgg[$pid]['sum'] = ($productAgg[$pid]['sum'] ?? 0) + (int)$r['rating']; $productAgg[$pid]['cnt'] = ($productAgg[$pid]['cnt'] ?? 0) + 1; }
    }
    $round1 = function ($v) { return round($v * 10) / 10; };

    if (isset($state['companies']) && is_array($state['companies'])) {
        foreach ($state['companies'] as $k => $c) {
            $cid = (int)($c['id'] ?? 0);
            if (isset($companyAgg[$cid])) {
                $state['companies'][$k]['averageRating'] = $round1($companyAgg[$cid]['sum'] / $companyAgg[$cid]['cnt']);
                $state['companies'][$k]['reviewsCount'] = $companyAgg[$cid]['cnt'];
            } else {
                $state['companies'][$k]['averageRating'] = 0;
                $state['companies'][$k]['reviewsCount'] = 0;
            }
        }
    }
    if (isset($state['marketplaceProducts']) && is_array($state['marketplaceProducts'])) {
        foreach ($state['marketplaceProducts'] as $k => $p) {
            $pid = (int)($p['id'] ?? 0);
            if (isset($productAgg[$pid])) {
                $state['marketplaceProducts'][$k]['averageRating'] = $round1($productAgg[$pid]['sum'] / $productAgg[$pid]['cnt']);
                $state['marketplaceProducts'][$k]['reviewsCount'] = $productAgg[$pid]['cnt'];
            } else {
                $state['marketplaceProducts'][$k]['averageRating'] = 0;
                $state['marketplaceProducts'][$k]['reviewsCount'] = 0;
            }
        }
    }

    if (!save_system_state_array($state)) {
        json_error('Failed to update review. Please try again.', 500);
    }
    json_response([
        "success" => true,
        "message" => "Review " . $newStatus . "."
    ]);
}

// 6. TRACK PRODUCT VIEW (Feature 5) — lightweight, fire-and-forget counter.
if ($action === 'track_product_view') {
    $productId = (int)($req_input['productId'] ?? 0);
    if ($productId <= 0) json_response(["success" => true, "status" => "ok"]);

    $state = load_system_state_array();
    if (!is_array($state)) json_response(["success" => true, "status" => "ok"]);

    $views = isset($state['productViews']) && is_array($state['productViews']) ? $state['productViews'] : [];
    $companyId = 0;
    if (isset($state['marketplaceProducts']) && is_array($state['marketplaceProducts'])) {
        foreach ($state['marketplaceProducts'] as $p) {
            if (is_array($p) && (int)($p['id'] ?? 0) === $productId) { $companyId = (int)($p['companyId'] ?? 0); break; }
        }
    }
    $views[] = [
        'id' => (count($views) > 0 ? max(array_map(function ($v) { return (int)($v['id'] ?? 0); }, $views)) : 0) + 1,
        'productId' => $productId,
        'companyId' => $companyId,
        'viewedAt' => date('c')
    ];
    $state['productViews'] = array_slice($views, -2000);
    save_system_state_array($state);
    json_response(["success" => true, "status" => "ok"]);
}

// ============================================================================
// MEGA IMPLEMENTATION PHASE 1 — SELLER WALLET / WITHDRAWALS
// ============================================================================
if ($action === 'get_wallet') {
    $companyId = (int)($req_input['companyId'] ?? 0);
    $state = load_system_state_array();
    if (!is_array($state)) json_error('System state unavailable.', 503);
    $wallets = isset($state['wallets']) && is_array($state['wallets']) ? $state['wallets'] : [];
    $txns = isset($state['walletTransactions']) && is_array($state['walletTransactions']) ? $state['walletTransactions'] : [];
    foreach ($wallets as $w) {
        if (is_array($w) && (int)($w['companyId'] ?? 0) === $companyId) {
            json_response([
                "success" => true,
                "wallet" => $w,
                "transactions" => array_values(array_filter($txns, function ($t) use ($companyId) {
                    return is_array($t) && (int)($t['companyId'] ?? 0) === $companyId;
                }))
            ]);
            return;
        }
    }
    json_response(["success" => true, "wallet" => null, "transactions" => []]);
}

if ($action === 'request_withdrawal') {
    $companyId = (int)($req_input['companyId'] ?? 0);
    $amount = (float)($req_input['amount'] ?? 0);
    $phoneNumber = trim((string)($req_input['phoneNumber'] ?? ''));
    if ($companyId <= 0 || $amount <= 0 || $phoneNumber === '') json_error('Company, amount and M-Pesa number are required.', 422);

    $state = load_system_state_array();
    if (!is_array($state)) json_error('System state unavailable.', 503);

    $wallets = isset($state['wallets']) && is_array($state['wallets']) ? $state['wallets'] : [];
    $wallet = null;
    foreach ($wallets as $w) { if (is_array($w) && (int)($w['companyId'] ?? 0) === $companyId) { $wallet = $w; break; } }
    if (!$wallet) json_error('Wallet not found.', 404);
    if ((float)$wallet['balance'] < $amount) json_error('Insufficient balance for this withdrawal request.', 422);

    $withdrawals = isset($state['withdrawals']) && is_array($state['withdrawals']) ? $state['withdrawals'] : [];
    $maxId = 0;
    foreach ($withdrawals as $w) { if (is_array($w) && (int)($w['id'] ?? 0) > $maxId) $maxId = (int)$w['id']; }
    $companies = isset($state['companies']) && is_array($state['companies']) ? $state['companies'] : [];
    $companyName = '';
    foreach ($companies as $c) { if (is_array($c) && (int)($c['id'] ?? 0) === $companyId) { $companyName = (string)($c['name'] ?? ''); break; } }

    $newWithdrawal = [
        'id' => $maxId + 1,
        'companyId' => $companyId,
        'companyName' => $companyName,
        'amount' => round($amount, 2),
        'phoneNumber' => $phoneNumber,
        'status' => 'pending',
        'requestedAt' => date('c')
    ];
    array_unshift($withdrawals, $newWithdrawal);
    $state['withdrawals'] = array_slice($withdrawals, 0, 2000);

    $walletId = (int)$wallet['id'];
    foreach ($state['wallets'] as $k => $w) {
        if (is_array($w) && (int)$w['id'] === $walletId) {
            $state['wallets'][$k]['balance'] = round(((float)$w['balance']) - $newWithdrawal['amount'], 2);
            $state['wallets'][$k]['updatedAt'] = date('c');
            break;
        }
    }

    $txns = isset($state['walletTransactions']) && is_array($state['walletTransactions']) ? $state['walletTransactions'] : [];
    $txnMax = 0;
    foreach ($txns as $t) { if (is_array($t) && (int)($t['id'] ?? 0) > $txnMax) $txnMax = (int)$t['id']; }
    array_unshift($txns, [
        'id' => $txnMax + 1,
        'walletId' => $walletId,
        'companyId' => $companyId,
        'type' => 'withdrawal_request',
        'amount' => $newWithdrawal['amount'],
        'description' => 'Ombi la malipo (M-Pesa ' . $phoneNumber . ')',
        'status' => 'pending',
        'reference' => 'WDR-' . $newWithdrawal['id'],
        'createdAt' => date('c')
    ]);
    $state['walletTransactions'] = array_slice($txns, 0, 2000);

    if (!save_system_state_array($state)) json_error('Failed to save withdrawal request.', 500);
    json_response(["success" => true, "withdrawal" => $newWithdrawal]);
}

if ($action === 'decide_withdrawal') {
    $withdrawalId = (int)($req_input['withdrawalId'] ?? 0);
    $decision = trim((string)($req_input['decision'] ?? 'approved'));
    $note = trim((string)($req_input['note'] ?? ''));
    if (!in_array($decision, ['approved', 'rejected'], true)) json_error('Invalid decision.', 422);
    if (strpos($req_input['username'] ?? '', 'root_mandate') === false && strpos($req_input['username'] ?? '', 'superadmin') === false) {
        json_error('Access denied: ROOT_MANDATE only.', 403);
    }

    $state = load_system_state_array();
    if (!is_array($state)) json_error('System state unavailable.', 503);

    $withdrawals = isset($state['withdrawals']) && is_array($state['withdrawals']) ? $state['withdrawals'] : [];
    $target = null;
    foreach ($withdrawals as $w) { if (is_array($w) && (int)($w['id'] ?? 0) === $withdrawalId) { $target = $w; break; } }
    if (!$target || ($target['status'] ?? '') !== 'pending') json_error('Withdrawal not found or already decided.', 404);

    $companyId = (int)$target['companyId'];
    foreach ($state['withdrawals'] as $k => $w) {
        if (is_array($w) && (int)$w['id'] === $withdrawalId) {
            $state['withdrawals'][$k]['status'] = $decision;
            $state['withdrawals'][$k]['approvedAt'] = $decision === 'approved' ? date('c') : ($state['withdrawals'][$k]['approvedAt'] ?? null);
            $state['withdrawals'][$k]['decidedBy'] = (string)($req_input['username'] ?? 'ROOT_MANDATE');
            if ($note !== '') $state['withdrawals'][$k]['adminNote'] = $note;
            break;
        }
    }

    if ($decision === 'rejected') {
        // Refund the held amount to the wallet.
        foreach ($state['wallets'] as $k => $w) {
            if (is_array($w) && (int)($w['companyId'] ?? 0) === $companyId) {
                $state['wallets'][$k]['balance'] = round(((float)$w['balance']) + (float)$target['amount'], 2);
                $state['wallets'][$k]['updatedAt'] = date('c');
                $walletId = (int)$w['id'];
                $txns = isset($state['walletTransactions']) && is_array($state['walletTransactions']) ? $state['walletTransactions'] : [];
                $txnMax = 0;
                foreach ($txns as $t) { if (is_array($t) && (int)($t['id'] ?? 0) > $txnMax) $txnMax = (int)$t['id']; }
                array_unshift($txns, [
                    'id' => $txnMax + 1,
                    'walletId' => $walletId,
                    'companyId' => $companyId,
                    'type' => 'credit',
                    'amount' => (float)$target['amount'],
                    'description' => 'Malipo yalikataliwa — fedha zimerudishwa',
                    'status' => 'completed',
                    'reference' => 'WDR-' . $withdrawalId,
                    'createdAt' => date('c')
                ]);
                $state['walletTransactions'] = array_slice($txns, 0, 2000);
                break;
            }
        }
    } else {
        // Approved: lifetime total withdrawn += amount
        foreach ($state['wallets'] as $k => $w) {
            if (is_array($w) && (int)($w['companyId'] ?? 0) === $companyId) {
                $state['wallets'][$k]['totalWithdrawn'] = round(((float)$w['totalWithdrawn']) + (float)$target['amount'], 2);
                $state['wallets'][$k]['updatedAt'] = date('c');
                break;
            }
        }
    }

    if (!save_system_state_array($state)) json_error('Failed to save decision.', 500);
    json_response(["success" => true, "message" => "Withdrawal " . $decision . "."]);
}

// ============================================================================
// MEGA IMPLEMENTATION PHASE 1 — AFFILIATE PROGRAM
// ============================================================================
if ($action === 'get_affiliate_profile') {
    $code = strtolower(trim((string)($req_input['code'] ?? '')));
    $state = load_system_state_array();
    if (!is_array($state)) json_error('System state unavailable.', 503);
    $affiliates = isset($state['affiliates']) && is_array($state['affiliates']) ? $state['affiliates'] : [];
    foreach ($affiliates as $a) {
        if (is_array($a) && strtolower((string)($a['referralCode'] ?? '')) === $code) {
            json_response(["success" => true, "affiliate" => $a]);
            return;
        }
    }
    json_response(["success" => false, "affiliate" => null]);
}

if ($action === 'register_affiliate') {
    $name = trim((string)($req_input['name'] ?? ''));
    $phone = trim((string)($req_input['phone'] ?? ''));
    $userId = isset($req_input['userId']) ? (int)$req_input['userId'] : null;
    if ($name === '' || $phone === '') json_error('Name and phone are required.', 422);

    $state = load_system_state_array();
    if (!is_array($state)) json_error('System state unavailable.', 503);
    $affiliates = isset($state['affiliates']) && is_array($state['affiliates']) ? $state['affiliates'] : [];

    if ($userId) {
        foreach ($affiliates as $a) {
            if (is_array($a) && (int)($a['userId'] ?? 0) === $userId) json_response(["success" => true, "affiliate" => $a]);
        }
    }

    $maxId = 0;
    foreach ($affiliates as $a) { if (is_array($a) && (int)($a['id'] ?? 0) > $maxId) $maxId = (int)$a['id']; }
    $base = strtolower(preg_replace('/[^a-z0-9]/i', '', $name));
    if ($base === '') $base = 'aff' . ($maxId + 1);
    $code = substr($base, 0, 12);
    $suffix = 2;
    $taken = true;
    while ($taken) {
        $taken = false;
        foreach ($affiliates as $a) {
            if (is_array($a) && strtolower((string)($a['referralCode'] ?? '')) === $code) { $taken = true; break; }
        }
        if ($taken) $code = substr($base, 0, 10) . $suffix++;
    }

    $newAffiliate = [
        'id' => $maxId + 1,
        'userId' => $userId,
        'name' => $name,
        'phone' => $phone,
        'referralCode' => $code,
        'balance' => 0,
        'totalEarned' => 0,
        'totalWithdrawn' => 0,
        'isActive' => true,
        'createdAt' => date('c')
    ];
    array_unshift($affiliates, $newAffiliate);
    $state['affiliates'] = array_slice($affiliates, 0, 2000);
    if (!save_system_state_array($state)) json_error('Failed to register affiliate.', 500);
    json_response(["success" => true, "affiliate" => $newAffiliate]);
}

if ($action === 'register_affiliate_click') {
    $affiliateId = (int)($req_input['affiliateId'] ?? 0);
    $url = trim((string)($req_input['url'] ?? ''));
    if ($affiliateId <= 0) json_response(["success" => true, "status" => "ok"]);
    $state = load_system_state_array();
    if (!is_array($state)) json_response(["success" => true, "status" => "ok"]);
    $clicks = isset($state['affiliateClicks']) && is_array($state['affiliateClicks']) ? $state['affiliateClicks'] : [];
    $maxId = 0;
    foreach ($clicks as $c) { if (is_array($c) && (int)($c['id'] ?? 0) > $maxId) $maxId = (int)$c['id']; }
    $clicks[] = [
        'id' => $maxId + 1,
        'affiliateId' => $affiliateId,
        'ipAddress' => get_client_ip(),
        'userAgent' => (string)($_SERVER['HTTP_USER_AGENT'] ?? ''),
        'url' => $url !== '' ? $url : null,
        'clickedAt' => date('c')
    ];
    $state['affiliateClicks'] = array_slice($clicks, -2000);
    save_system_state_array($state);
    json_response(["success" => true, "status" => "ok"]);
}

if ($action === 'get_affiliate_dashboard') {
    $affiliateId = (int)($req_input['affiliateId'] ?? 0);
    $state = load_system_state_array();
    if (!is_array($state)) json_error('System state unavailable.', 503);
    $sales = array_values(array_filter(
        isset($state['affiliateSales']) && is_array($state['affiliateSales']) ? $state['affiliateSales'] : [],
        function ($s) use ($affiliateId) { return is_array($s) && (int)($s['affiliateId'] ?? 0) === $affiliateId; }
    ));
    $withdrawals = array_values(array_filter(
        isset($state['affiliateWithdrawals']) && is_array($state['affiliateWithdrawals']) ? $state['affiliateWithdrawals'] : [],
        function ($w) use ($affiliateId) { return is_array($w) && (int)($w['affiliateId'] ?? 0) === $affiliateId; }
    ));
    json_response([
        "success" => true,
        "sales" => $sales,
        "withdrawals" => $withdrawals
    ]);
}

if ($action === 'request_affiliate_withdrawal') {
    $affiliateId = (int)($req_input['affiliateId'] ?? 0);
    $amount = (float)($req_input['amount'] ?? 0);
    $phoneNumber = trim((string)($req_input['phoneNumber'] ?? ''));
    if ($affiliateId <= 0 || $amount <= 0 || $phoneNumber === '') json_error('Affiliate, amount and M-Pesa number are required.', 422);

    $state = load_system_state_array();
    if (!is_array($state)) json_error('System state unavailable.', 503);
    $affiliates = isset($state['affiliates']) && is_array($state['affiliates']) ? $state['affiliates'] : [];
    $affiliate = null;
    foreach ($affiliates as $a) { if (is_array($a) && (int)($a['id'] ?? 0) === $affiliateId) { $affiliate = $a; break; } }
    if (!$affiliate) json_error('Affiliate not found.', 404);
    if ((float)$affiliate['balance'] < $amount) json_error('Insufficient balance for this withdrawal request.', 422);

    $withdrawals = isset($state['affiliateWithdrawals']) && is_array($state['affiliateWithdrawals']) ? $state['affiliateWithdrawals'] : [];
    $maxId = 0;
    foreach ($withdrawals as $w) { if (is_array($w) && (int)($w['id'] ?? 0) > $maxId) $maxId = (int)$w['id']; }
    $newWithdrawal = [
        'id' => $maxId + 1,
        'affiliateId' => $affiliateId,
        'amount' => round($amount, 2),
        'phoneNumber' => $phoneNumber,
        'status' => 'pending',
        'requestedAt' => date('c')
    ];
    array_unshift($withdrawals, $newWithdrawal);
    $state['affiliateWithdrawals'] = array_slice($withdrawals, 0, 2000);

    foreach ($state['affiliates'] as $k => $a) {
        if (is_array($a) && (int)$a['id'] === $affiliateId) {
            $state['affiliates'][$k]['balance'] = round(((float)$a['balance']) - $newWithdrawal['amount'], 2);
            break;
        }
    }

    if (!save_system_state_array($state)) json_error('Failed to save withdrawal request.', 500);
    json_response(["success" => true, "withdrawal" => $newWithdrawal]);
}

if ($action === 'decide_affiliate_withdrawal') {
    $withdrawalId = (int)($req_input['withdrawalId'] ?? 0);
    $decision = trim((string)($req_input['decision'] ?? 'approved'));
    if (!in_array($decision, ['approved', 'rejected'], true)) json_error('Invalid decision.', 422);
    if (strpos($req_input['username'] ?? '', 'root_mandate') === false && strpos($req_input['username'] ?? '', 'superadmin') === false) {
        json_error('Access denied: ROOT_MANDATE only.', 403);
    }

    $state = load_system_state_array();
    if (!is_array($state)) json_error('System state unavailable.', 503);
    $withdrawals = isset($state['affiliateWithdrawals']) && is_array($state['affiliateWithdrawals']) ? $state['affiliateWithdrawals'] : [];
    $target = null;
    foreach ($withdrawals as $w) { if (is_array($w) && (int)($w['id'] ?? 0) === $withdrawalId) { $target = $w; break; } }
    if (!$target || ($target['status'] ?? '') !== 'pending') json_error('Withdrawal not found or already decided.', 404);

    $affiliateId = (int)$target['affiliateId'];
    foreach ($state['affiliateWithdrawals'] as $k => $w) {
        if (is_array($w) && (int)$w['id'] === $withdrawalId) {
            $state['affiliateWithdrawals'][$k]['status'] = $decision;
            $state['affiliateWithdrawals'][$k]['approvedAt'] = $decision === 'approved' ? date('c') : null;
            $state['affiliateWithdrawals'][$k]['decidedBy'] = (string)($req_input['username'] ?? 'ROOT_MANDATE');
            break;
        }
    }

    foreach ($state['affiliates'] as $k => $a) {
        if (is_array($a) && (int)$a['id'] === $affiliateId) {
            if ($decision === 'rejected') {
                $state['affiliates'][$k]['balance'] = round(((float)$a['balance']) + (float)$target['amount'], 2);
            } else {
                $state['affiliates'][$k]['totalWithdrawn'] = round(((float)$a['totalWithdrawn']) + (float)$target['amount'], 2);
            }
            break;
        }
    }

    if (!save_system_state_array($state)) json_error('Failed to save decision.', 500);
    json_response(["success" => true, "message" => "Affiliate withdrawal " . $decision . "."]);
}

// ============================================================================
// MEGA IMPLEMENTATION PHASE 1 — PUSH SUBSCRIPTIONS (Phase 1: store only)
// ============================================================================
if ($action === 'push_subscribe') {
    $endpoint = trim((string)($req_input['endpoint'] ?? ''));
    $p256dh = trim((string)($req_input['p256dh'] ?? ''));
    $auth = trim((string)($req_input['auth'] ?? ''));
    if ($endpoint === '') json_error('Endpoint is required.', 422);

    $state = load_system_state_array();
    if (!is_array($state)) json_error('System state unavailable.', 503);
    $subs = isset($state['pushSubscriptions']) && is_array($state['pushSubscriptions']) ? $state['pushSubscriptions'] : [];
    $companyId = isset($req_input['companyId']) ? (int)$req_input['companyId'] : null;
    $userId = isset($req_input['userId']) ? (int)$req_input['userId'] : null;

    $filtered = array_values(array_filter($subs, function ($s) use ($endpoint) {
        return is_array($s) && (string)($s['endpoint'] ?? '') !== $endpoint;
    }));
    $maxId = 0;
    foreach ($filtered as $s) { if (is_array($s) && (int)($s['id'] ?? 0) > $maxId) $maxId = (int)$s['id']; }
    $filtered[] = [
        'id' => $maxId + 1,
        'companyId' => $companyId,
        'userId' => $userId,
        'endpoint' => $endpoint,
        'p256dh' => $p256dh,
        'auth' => $auth,
        'createdAt' => date('c')
    ];
    $state['pushSubscriptions'] = array_slice($filtered, 0, 500);
    if (!save_system_state_array($state)) json_error('Failed to save subscription.', 500);
    json_response(["success" => true, "status" => "subscribed"]);
}

// ============================================================================
// MEGA IMPLEMENTATION PHASE 1 — SEARCH SYNONYMS + AI SEARCH
// ============================================================================
if ($action === 'get_search_synonyms' || $action === 'get_public_search_synonyms') {
    $state = load_system_state_array();
    if (!is_array($state)) json_error('System state unavailable.', 503);
    $synonyms = isset($state['searchSynonyms']) && is_array($state['searchSynonyms']) ? $state['searchSynonyms'] : [];
    json_response(["success" => true, "synonyms" => $synonyms]);
}

if ($action === 'set_search_synonyms') {
    if (strpos($req_input['username'] ?? '', 'root_mandate') === false && strpos($req_input['username'] ?? '', 'superadmin') === false) {
        json_error('Access denied: ROOT_MANDATE only.', 403);
    }
    $synonyms = isset($req_input['synonyms']) && is_array($req_input['synonyms']) ? $req_input['synonyms'] : [];
    $state = load_system_state_array();
    if (!is_array($state)) json_error('System state unavailable.', 503);
    $state['searchSynonyms'] = array_slice($synonyms, 0, 1000);
    if (!save_system_state_array($state)) json_error('Failed to save synonyms.', 500);
    json_response(["success" => true, "synonyms" => $state['searchSynonyms']]);
}

if ($action === 'ai_search_expand') {
    $q = trim((string)($req_input['q'] ?? $_GET['q'] ?? ''));
    $OPENAI_API_KEY = defined('OPENAI_API_KEY') ? OPENAI_API_KEY : (getenv('OPENAI_API_KEY') ?: '');
    if ($q === '') json_response(["success" => true, "expanded" => $q, "mode" => "local"]);

    if ($OPENAI_API_KEY !== '' && function_exists('curl_init')) {
        try {
            $prompt = "You are a search expansion helper for a Tanzanian e-commerce marketplace. "
                . "Expand this user search query into 3-8 English + Kiswahili keywords that would match product listings (viatu/shoes, kitenge/fabric, simu/phone...). "
                . "Reply with ONLY a comma-separated list of keywords, no extra text.\n\nQuery: " . $q;
            $ch = curl_init('https://api.openai.com/v1/chat/completions');
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . $OPENAI_API_KEY],
                CURLOPT_POSTFIELDS => json_encode([
                    'model' => 'gpt-4o-mini',
                    'messages' => [['role' => 'user', 'content' => $prompt]],
                    'max_tokens' => 120,
                    'temperature' => 0.3
                ]),
                CURLOPT_TIMEOUT => 15
            ]);
            $resp = curl_exec($ch);
            $err = curl_error($ch);
            curl_close($ch);
            if (!$err && $resp) {
                $json = json_decode($resp, true);
                if (isset($json['choices'][0]['message']['content'])) {
                    $expanded = trim($json['choices'][0]['message']['content']);
                    json_response(["success" => true, "expanded" => $expanded, "mode" => "openai"]);
                    return;
                }
            }
        } catch (Exception $e) {}
    }
    // Graceful fallback: OpenAII not configured / unreachable — frontend uses local dictionary.
    json_response(["success" => true, "expanded" => $q, "mode" => "local", "hint" => "openai_not_configured"]);
}

if ($action === 'ai_product_description') {
    $name = trim((string)($req_input['name'] ?? ''));
    $category = trim((string)($req_input['category'] ?? ''));
    $price = (float)($req_input['price'] ?? 0);
    $company = trim((string)($req_input['company'] ?? ''));
    $OPENAI_API_KEY = defined('OPENAI_API_KEY') ? OPENAI_API_KEY : (getenv('OPENAI_API_KEY') ?: '');
    if ($name === '') json_response(["success" => true, "description" => '']);

    if ($OPENAI_API_KEY !== '' && function_exists('curl_init')) {
        try {
            $prompt = "Write a friendly, concise product description (max 5 short lines) in mixed English + Kiswahili for a Tanzanian e-commerce listing. "
                . "Product: " . $name . ($category !== '' ? ", category: " . $category : '') . ($price > 0 ? ", price TZS " . number_format($price) : '')
                . ($company !== '' ? ", seller: " . $company : '') . ". Include a call to contact via WhatsApp. Reply with the description only.";
            $ch = curl_init('https://api.openai.com/v1/chat/completions');
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . $OPENAI_API_KEY],
                CURLOPT_POSTFIELDS => json_encode([
                    'model' => 'gpt-4o-mini',
                    'messages' => [['role' => 'user', 'content' => $prompt]],
                    'max_tokens' => 220,
                    'temperature' => 0.5
                ]),
                CURLOPT_TIMEOUT => 20
            ]);
            $resp = curl_exec($ch);
            $err = curl_error($ch);
            curl_close($ch);
            if (!$err && $resp) {
                $json = json_decode($resp, true);
                if (isset($json['choices'][0]['message']['content'])) {
                    json_response(["success" => true, "description" => trim($json['choices'][0]['message']['content']), "mode" => "openai"]);
                    return;
                }
            }
        } catch (Exception $e) {}
    }
    // Graceful fallback: local template so the button still works without an API key.
    $lines = [
        $name . ($category !== '' ? ' — ' . $category : '') . ' bora inauzwa sasa.',
        $price > 0 ? 'Bei: TZS ' . number_format($price) . '.' : '',
        ($company !== '' ? $company . ', ' : '') . 'GlobalTradeCore — nunua bidhaa halisi kutoka wauzaji walio thibitishwa.',
        'Piga simu/whatsapp kwa maelezo zaidi na utoaji.'
    ];
    $desc = trim(implode("\n", array_filter($lines, function ($l) { return $l !== ''; })));
    json_response(["success" => true, "description" => $desc, "mode" => "local"]);
}

// ============================================================================
// MEGA IMPLEMENTATION PHASE 2B — MULTI-NETWORK COLLECTION
// (M-Pesa / Tigo Pesa / Airtel Money / HaloPesa — manual default, AzamPay auto ready)
// ============================================================================

/** Shared helper: mark a collection completed, credit the seller wallet (amount − commission) and log the admin earning. Returns the updated state array. */
function complete_collection(array $state, int $collectionId, string $decidedBy = 'system'): array {
    $collections = isset($state['collections']) && is_array($state['collections']) ? $state['collections'] : [];
    $index = null;
    foreach ($collections as $i => $c) {
        if ((int)($c['id'] ?? 0) === $collectionId) { $index = $i; break; }
    }
    if ($index === null) return $state;
    $collection = $collections[$index];
    if (($collection['status'] ?? '') === 'completed') return $state;

    $reference = (string)($collection['reference'] ?? '');
    $companyId = (int)($collection['companyId'] ?? 0);

    $orders = isset($state['marketplaceOrders']) && is_array($state['marketplaceOrders']) ? $state['marketplaceOrders'] : [];
    $orderIndex = null;
    foreach ($orders as $i => $o) {
        if ((string)($o['collectionReference'] ?? '') === $reference) { $orderIndex = $i; break; }
    }
    $order = $orderIndex !== null ? $orders[$orderIndex] : null;

    $companies = isset($state['companies']) && is_array($state['companies']) ? $state['companies'] : [];
    $company = null;
    foreach ($companies as $c) { if ((int)($c['id'] ?? 0) === $companyId) { $company = $c; break; } }

    $totalAmount = $order !== null ? (float)($order['totalAmount'] ?? 0) : (float)($collection['amount'] ?? 0);
    if ($totalAmount <= 0) $totalAmount = (float)($collection['amount'] ?? 0);

    $commissionAmount = 0.0;
    if ($order !== null && isset($order['commissionAmount'])) {
        $commissionAmount = (float)$order['commissionAmount'];
    } else {
        $planType = (string)($company['planType'] ?? 'commission');
        $commissionPercent = $planType === 'direct' ? 0.0 : (float)($company['commissionPercentSnapshot'] ?? 0);
        $commissionAmount = round($totalAmount * $commissionPercent / 100.0, 2);
    }
    $sellerAmount = round($totalAmount - $commissionAmount, 2);

    $collections[$index]['status'] = 'completed';
    $collections[$index]['updatedAt'] = now();
    $collections[$index]['decidedBy'] = $decidedBy;
    $state['collections'] = $collections;

    $wallets = isset($state['wallets']) && is_array($state['wallets']) ? $state['wallets'] : [];
    $walletIndex = null;
    foreach ($wallets as $i => $w) { if ((int)($w['companyId'] ?? 0) === $companyId) { $walletIndex = $i; break; } }
    if ($walletIndex === null) {
        $wallets[] = ['id' => time() . rand(100, 999), 'companyId' => $companyId, 'balance' => 0, 'totalEarned' => 0, 'totalWithdrawn' => 0, 'updatedAt' => now()];
        $walletIndex = count($wallets) - 1;
    }
    $wallets[$walletIndex]['balance'] = round(((float)($wallets[$walletIndex]['balance'] ?? 0) + $sellerAmount) * 100) / 100;
    $wallets[$walletIndex]['totalEarned'] = round(((float)($wallets[$walletIndex]['totalEarned'] ?? 0) + $sellerAmount) * 100) / 100;
    $wallets[$walletIndex]['updatedAt'] = now();
    $state['wallets'] = $wallets;

    $walletTxns = isset($state['walletTransactions']) && is_array($state['walletTransactions']) ? $state['walletTransactions'] : [];
    array_unshift($walletTxns, [
        'id' => time() . rand(100, 999),
        'walletId' => (int)($wallets[$walletIndex]['id'] ?? 0),
        'companyId' => $companyId,
        'type' => 'credit',
        'amount' => $sellerAmount,
        'description' => 'Malipo ya Order #' . ($order !== null ? (string)($order['orderNumber'] ?? $reference) : $reference) . ' (' . (string)($collection['network'] ?? '') . ')',
        'orderId' => $order !== null ? (int)($order['id'] ?? 0) : null,
        'status' => 'completed',
        'reference' => $reference,
        'createdAt' => now()
    ]);
    $state['walletTransactions'] = array_slice($walletTxns, 0, 5000);

    $adminEarnings = isset($state['adminEarnings']) && is_array($state['adminEarnings']) ? $state['adminEarnings'] : [];
    array_unshift($adminEarnings, [
        'id' => count($adminEarnings) + 1,
        'companyId' => $companyId,
        'orderId' => $order !== null ? (int)($order['id'] ?? 0) : null,
        'reference' => $order !== null ? (string)($order['orderNumber'] ?? $reference) : $reference,
        'amount' => $totalAmount,
        'commissionAmount' => $commissionAmount,
        'sellerAmount' => $sellerAmount,
        'createdAt' => now()
    ]);
    $state['adminEarnings'] = array_slice($adminEarnings, 0, 10000);

    if ($orderIndex !== null) {
        $orders[$orderIndex]['paymentStatus'] = 'completed';
        $orders[$orderIndex]['payToSellerDone'] = true;
        $orders[$orderIndex]['updatedAt'] = now();
        $state['marketplaceOrders'] = $orders;
    }

    // Best-effort affiliate commission (only when the referrer cookie accompanies the request).
    $refCode = isset($_COOKIE['tradecore_affiliate_ref']) ? strtolower(trim((string)$_COOKIE['tradecore_affiliate_ref'])) : '';
    if ($refCode !== '' && $order !== null && $sellerAmount > 0) {
        $affiliates = isset($state['affiliates']) && is_array($state['affiliates']) ? $state['affiliates'] : [];
        foreach ($affiliates as $i => $a) {
            if (strtolower((string)($a['referralCode'] ?? '')) === $refCode && ($a['isActive'] ?? false)) {
                $settings = isset($state['settings']) && is_array($state['settings']) ? $state['settings'] : [];
                $affPct = (float)($settings['affiliateCommissionPercent'] ?? 2);
                $affCommission = round($totalAmount * $affPct / 100.0, 2);
                if ($affCommission > 0) {
                    $orderId = (int)($order['id'] ?? 0);
                    $sales = isset($state['affiliateSales']) && is_array($state['affiliateSales']) ? $state['affiliateSales'] : [];
                    $already = false;
                    foreach ($sales as $s) { if ((int)($s['orderId'] ?? 0) === $orderId) { $already = true; break; } }
                    if (!$already) {
                        $sales[] = [
                            'id' => time() . rand(100, 999),
                            'affiliateId' => (int)($a['id'] ?? 0),
                            'orderId' => $orderId,
                            'companyId' => $companyId,
                            'amount' => $totalAmount,
                            'commissionAmount' => $affCommission,
                            'commissionPercent' => $affPct,
                            'status' => 'pending',
                            'createdAt' => now()
                        ];
                        $state['affiliateSales'] = array_slice($sales, 0, 5000);
                        $affiliates[$i]['balance'] = round(((float)($a['balance'] ?? 0) + $affCommission) * 100) / 100;
                        $affiliates[$i]['totalEarned'] = round(((float)($a['totalEarned'] ?? 0) + $affCommission) * 100) / 100;
                        $state['affiliates'] = $affiliates;
                    }
                }
                break;
            }
        }
    }

    return $state;
}

// --- Incoming AzamPay collection webhook (POST /api/webhooks/azampay/collection or ?action=azampay_webhook) ---
if ($route === 'azampay_webhook') {
    $raw = file_get_contents('php://input') ?: '';
    $payload = $raw !== '' ? $raw : json_encode($_POST ?: $_GET ?: []);
    $state = load_system_state_array();
    if (!is_array($state)) $state = [];

    $logs = isset($state['webhookLogs']) && is_array($state['webhookLogs']) ? $state['webhookLogs'] : [];
    $settings = isset($state['settings']) && is_array($state['settings']) ? $state['settings'] : [];
    $webhookSecret = (string)($settings['azampayWebhookSecret'] ?? '');
    $status = 'received';
    $note = '';
    if ($webhookSecret !== '') {
        $headerSig = $_SERVER['HTTP_X_SIGNATURE'] ?? $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? $_SERVER['HTTP_AZAMPAY_SIGNATURE'] ?? '';
        if ($headerSig !== '') {
            $computed = hash_hmac('sha256', $raw, $webhookSecret);
            if (!hash_equals($computed, $headerSig)) {
                $status = 'signature_failed';
                $note = 'Signature mismatch.';
            }
        }
    }

    $parsed = json_decode($payload, true);
    $reference = '';
    if (is_array($parsed)) {
        $reference = trim((string)($parsed['reference'] ?? $parsed['externalId'] ?? $parsed['requestId'] ?? $parsed['data']['reference'] ?? ''));
    }

    array_unshift($logs, [
        'id' => (count($logs) > 0 ? (int)$logs[0]['id'] : 0) + 1,
        'provider' => 'azampay',
        'event' => 'collection',
        'status' => $status,
        'note' => $note,
        'payload' => strlen($payload) > 20000 ? substr($payload, 0, 20000) : $payload,
        'receivedAt' => now()
    ]);
    $state['webhookLogs'] = array_slice($logs, 0, 2000);

    $completedId = null;
    if (is_array($parsed) && $reference !== '') {
        $collections = isset($state['collections']) && is_array($state['collections']) ? $state['collections'] : [];
        foreach ($collections as $c) {
            if ((string)($c['reference'] ?? '') === $reference) { $completedId = (int)($c['id'] ?? 0); break; }
        }
    }
    if ($completedId !== null && $status !== 'signature_failed') {
        $state = complete_collection($state, $completedId, 'azampay_webhook');
    }
    save_system_state_array($state);
    json_response(['success' => true, 'received' => true]);
}

// --- Initiate a collection (manual default; AUTO sends the AzamPay USSD push) ---
if ($action === 'collection_initiate') {
    $phone = preg_replace('/[^0-9]/', '', (string)($req_input['phone'] ?? ''));
    $amount = (float)($req_input['amount'] ?? 0);
    $network = strtolower(trim((string)($req_input['network'] ?? 'mpesa')));
    $companyId = (int)($req_input['companyId'] ?? 0);
    $customerName = trim((string)($req_input['customerName'] ?? ''));
    $customerPhone = trim((string)($req_input['customerPhone'] ?? ''));
    if ($phone === '' || $amount <= 0) json_error('Phone and amount are required.', 422);

    $state = load_system_state_array();
    if (!is_array($state)) json_error('System state unavailable.', 503);
    $collections = isset($state['collections']) && is_array($state['collections']) ? $state['collections'] : [];
    $settings = isset($state['settings']) && is_array($state['settings']) ? $state['settings'] : [];

    $nextId = 0;
    foreach ($collections as $c) { $n = (int)($c['id'] ?? 0); if ($n > $nextId) $nextId = $n; }
    $nextId++;
    $reference = (isset($req_input['reference']) && trim((string)$req_input['reference']) !== '')
        ? trim((string)$req_input['reference'])
        : 'COL-' . str_pad((string)$nextId, 6, '0', STR_PAD_LEFT);

    $auto = (($settings['collectionMode'] ?? 'manual') === 'auto')
        && !empty($settings['azampayCollectionEnabled'])
        && !empty($settings['azampayClientId'])
        && !empty($settings['azampayClientSecret']);

    $status = 'manual_pending_approval';
    $mode = 'manual';
    $azampayTxId = '';
    $providerResponse = '';

    if ($auto && function_exists('curl_init')) {
        $clientId = (string)($settings['azampayClientId'] ?? '');
        $clientSecret = (string)($settings['azampayClientSecret'] ?? '');
        $appName = (string)($settings['azampayAppName'] ?? 'TradeCore');
        $tokenUrl = 'https://authenticator.azampay.co.tz/AppRegistration/GenerateToken';
        $ch = curl_init($tokenUrl);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS => json_encode(['appName' => $appName, 'clientId' => $clientId, 'clientSecret' => $clientSecret]),
            CURLOPT_TIMEOUT => 20
        ]);
        $tokResp = curl_exec($ch);
        $tokErr = curl_error($ch);
        curl_close($ch);
        $accessToken = '';
        if (!$tokErr && $tokResp) {
            $tok = json_decode($tokResp, true);
            $accessToken = (string)($tok['data']['accessToken'] ?? $tok['accessToken'] ?? '');
        }

        if ($accessToken !== '') {
            $providerMap = ['mpesa' => 'Mpesa', 'tigopesa' => 'Tigo', 'airtelmoney' => 'Airtel', 'halopesa' => 'HaloPesa', 'azampesa' => 'Azampesa'];
            $provider = isset($providerMap[$network]) ? $providerMap[$network] : 'Mpesa';
            $ch = curl_init('https://azampay.co.tz/azampay/mno/checkout');
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . $accessToken],
                CURLOPT_POSTFIELDS => json_encode([
                    'appName' => $appName,
                    'clientId' => $clientId,
                    'requestId' => $reference,
                    'userId' => 'tradecore',
                    'language' => 'sw',
                    'currency' => 'TZS',
                    'amount' => $amount,
                    'externalId' => $reference,
                    'provider' => $provider,
                    'phoneNumber' => $phone,
                    'accountNumber' => $appName
                ]),
                CURLOPT_TIMEOUT => 25
            ]);
            $payResp = curl_exec($ch);
            $payErr = curl_error($ch);
            curl_close($ch);
            $providerResponse = $payResp ? (string)$payResp : (string)$payErr;
            if (!$payErr && $payResp) {
                $p = json_decode($payResp, true);
                if (is_array($p)) {
                    $tx = (string)($p['transactionId'] ?? $p['data']['transactionId'] ?? $p['transaction_id'] ?? '');
                    if ($tx !== '') $azampayTxId = $tx;
                }
                // AzamPay responds async — mark processing; the webhook completes the collection.
                $status = 'processing';
                $mode = 'auto';
            }
        }
    }

    $collection = [
        'id' => $nextId,
        'orderId' => isset($req_input['orderId']) ? (int)$req_input['orderId'] : null,
        'companyId' => $companyId,
        'customerName' => $customerName,
        'customerPhone' => $customerPhone,
        'network' => $network,
        'amount' => $amount,
        'amountTzs' => $amount,
        'currencyCode' => 'TZS',
        'status' => $status,
        'reference' => $reference,
        'azampayTransactionId' => $azampayTxId !== '' ? $azampayTxId : null,
        'providerResponse' => $providerResponse !== '' ? $providerResponse : null,
        'mode' => $mode,
        'transactionId' => null,
        'proofImage' => null,
        'createdAt' => now(),
        'updatedAt' => now()
    ];
    array_unshift($collections, $collection);
    $state['collections'] = array_slice($collections, 0, 5000);
    if (!save_system_state_array($state)) json_error('Failed to save collection.', 500);

    json_response(['success' => true, 'reference' => $reference, 'status' => $status, 'mode' => $mode, 'record' => $collection]);
}

// --- Poll collection status (public) ---
if ($action === 'collection_status') {
    $reference = trim((string)($req_input['reference'] ?? ''));
    if ($reference === '') json_error('Reference is required.', 422);
    $state = load_system_state_array();
    if (!is_array($state)) json_error('System state unavailable.', 503);
    $collections = isset($state['collections']) && is_array($state['collections']) ? $state['collections'] : [];
    foreach ($collections as $c) {
        if ((string)($c['reference'] ?? '') === $reference) {
            json_response([
                'success' => true,
                'reference' => $reference,
                'status' => $c['status'] ?? 'processing',
                'mode' => $c['mode'] ?? 'manual',
                'network' => $c['network'] ?? null,
                'amountTzs' => $c['amountTzs'] ?? $c['amount'] ?? null,
                'azampayTransactionId' => $c['azampayTransactionId'] ?? null,
                'completedAt' => (($c['status'] ?? '') === 'completed') ? ($c['updatedAt'] ?? null) : null
            ]);
        }
    }
    json_response(['success' => true, 'reference' => $reference, 'status' => 'not_found']);
}

// --- ROOT approves / rejects a manual collection ---
if ($action === 'decide_collection') {
    if (strpos($req_input['username'] ?? '', 'root_mandate') === false && strpos($req_input['username'] ?? '', 'superadmin') === false) {
        json_error('Access denied: ROOT_MANDATE only.', 403);
    }
    $collectionId = (int)($req_input['collectionId'] ?? 0);
    $decision = trim((string)($req_input['decision'] ?? ''));
    $note = trim((string)($req_input['note'] ?? ''));
    if ($collectionId <= 0) json_error('Collection ID is required.', 422);
    $state = load_system_state_array();
    if (!is_array($state)) json_error('System state unavailable.', 503);

    if ($decision === 'approved') {
        $state = complete_collection($state, $collectionId, (string)($req_input['username'] ?? 'root_mandate'));
        if (!save_system_state_array($state)) json_error('Failed to save.', 500);
        json_response(['success' => true, 'status' => 'completed']);
    }

    if ($decision === 'rejected') {
        $collections = isset($state['collections']) && is_array($state['collections']) ? $state['collections'] : [];
        $updated = false;
        $reference = '';
        foreach ($collections as $i => $c) {
            if ((int)($c['id'] ?? 0) === $collectionId) {
                $collections[$i]['status'] = 'failed';
                $collections[$i]['updatedAt'] = now();
                $collections[$i]['adminNote'] = $note !== '' ? $note : null;
                $collections[$i]['decidedBy'] = (string)($req_input['username'] ?? 'root_mandate');
                $reference = (string)($c['reference'] ?? '');
                $updated = true;
                break;
            }
        }
        if (!$updated) json_error('Collection not found.', 404);
        $state['collections'] = $collections;

        if ($reference !== '') {
            $orders = isset($state['marketplaceOrders']) && is_array($state['marketplaceOrders']) ? $state['marketplaceOrders'] : [];
            $products = isset($state['marketplaceProducts']) && is_array($state['marketplaceProducts']) ? $state['marketplaceProducts'] : [];
            foreach ($orders as $i => $o) {
                if ((string)($o['collectionReference'] ?? '') === $reference) {
                    $orders[$i]['paymentStatus'] = 'failed';
                    $orders[$i]['rejectionReason'] = $note !== '' ? $note : 'Payment rejected';
                    $orders[$i]['updatedAt'] = now();
                    $items = isset($o['items']) && is_array($o['items']) ? $o['items'] : [];
                    foreach ($products as $pi => $p) {
                        foreach ($items as $it) {
                            if ((int)($p['id'] ?? 0) === (int)($it['productId'] ?? 0)) {
                                $products[$pi]['stockQuantity'] = ((int)($p['stockQuantity'] ?? 0)) + (int)($it['quantity'] ?? 0);
                            }
                        }
                    }
                }
            }
            $state['marketplaceOrders'] = $orders;
            $state['marketplaceProducts'] = $products;
        }
        if (!save_system_state_array($state)) json_error('Failed to save.', 500);
        json_response(['success' => true, 'status' => 'failed']);
    }

    json_error('Invalid decision.', 422);
}

// --- ROOT saves collection settings (mirror; primary path is the frontend sync blob) ---
if ($action === 'save_collection_settings') {
    if (strpos($req_input['username'] ?? '', 'root_mandate') === false && strpos($req_input['username'] ?? '', 'superadmin') === false) {
        json_error('Access denied: ROOT_MANDATE only.', 403);
    }
    $state = load_system_state_array();
    if (!is_array($state)) json_error('System state unavailable.', 503);
    $settings = isset($state['settings']) && is_array($state['settings']) ? $state['settings'] : [];
    if (isset($req_input['collectionSettings']) && is_array($req_input['collectionSettings'])) {
        $settings['collectionSettings'] = array_slice($req_input['collectionSettings'], 0, 100);
    }
    if (isset($req_input['collectionMode'])) {
        $m = trim((string)$req_input['collectionMode']);
        if ($m === 'manual' || $m === 'auto') $settings['collectionMode'] = $m;
    }
    foreach (['azampayCollectionEnabled', 'beemCollectionEnabled'] as $flag) {
        if (isset($req_input[$flag])) $settings[$flag] = (bool)$req_input[$flag];
    }
    foreach (['azampayAppName', 'azampayClientId', 'azampayClientSecret', 'azampayWebhookSecret'] as $key) {
        if (isset($req_input[$key])) $settings[$key] = trim((string)$req_input[$key]);
    }
    $state['settings'] = $settings;
    if (!save_system_state_array($state)) json_error('Failed to save settings.', 500);
    json_response(['success' => true, 'collectionMode' => $settings['collectionMode'] ?? 'manual']);
}

// ============================================================================
// MEGA PHASE 2C: 7 KILLER FEATURES — backend mirror actions
// Frontend is the source of truth (localStorage blob via save_state); these
// actions exist so the cPanel PHP layer can log/host webhooks and expose
// public endpoints (WhatsApp webhook, delivery rider ping, live heartbeat).
// ============================================================================

// --- Log an SMS notification (log mode by default; never actually sends) ---
if ($action === 'send_sms') {
    $state = load_system_state_array();
    if (!is_array($state)) json_error('System state unavailable.', 503);
    $to = preg_replace('/[^0-9+]/', '', (string)($req_input['to'] ?? ''));
    $message = trim((string)($req_input['message'] ?? ''));
    if ($to === '' || $message === '') json_error('To and message are required.', 422);
    $logs = isset($state['notificationLogs']) && is_array($state['notificationLogs']) ? $state['notificationLogs'] : [];
    $id = 0;
    foreach ($logs as $l) { $n = (int)($l['id'] ?? 0); if ($n > $id) $id = $n; }
    array_unshift($logs, [
        'id' => $id + 1,
        'to' => $to,
        'message' => $message,
        'kind' => trim((string)($req_input['kind'] ?? 'sms')),
        'status' => 'logged',
        'mode' => 'log',
        'url' => isset($req_input['url']) ? trim((string)$req_input['url']) : null,
        'createdAt' => now()
    ]);
    $state['notificationLogs'] = array_slice($logs, 0, 5000);
    if (!save_system_state_array($state)) json_error('Failed to save SMS log.', 500);
    json_response(['success' => true, 'status' => 'logged', 'mode' => 'log', 'id' => $id + 1]);
}

// --- WhatsApp webhook: incoming message -> store conversation + bot reply ---
// Public endpoint (no auth required). Primary bot logic lives in the frontend
// blob; this endpoint logs the conversation and echoes a generated reply.
if ($action === 'whatsapp_incoming' || $action === 'whatsapp_bot_reply') {
    $state = load_system_state_array();
    if (!is_array($state)) json_error('System state unavailable.', 503);
    $phone = preg_replace('/[^0-9+]/', '', (string)($req_input['phone'] ?? $req_input['from'] ?? ''));
    $messageIn = trim((string)($req_input['message'] ?? $req_input['text'] ?? ''));
    if ($phone === '' || $messageIn === '') json_error('Phone and message are required.', 422);

    $settings = isset($state['settings']) && is_array($state['settings']) ? $state['settings'] : [];
    $bot = isset($settings['whatsappBot']) && is_array($settings['whatsappBot']) ? $settings['whatsappBot'] : [];
    $enabled = (bool)($bot['enabled'] ?? true);
    $mode = ($bot['mode'] ?? 'log') === 'live' ? 'live' : 'log';

    $conversations = isset($state['whatsappConversations']) && is_array($state['whatsappConversations']) ? $state['whatsappConversations'] : [];
    $id = 0;
    foreach ($conversations as $c) { $n = (int)($c['id'] ?? 0); if ($n > $id) $id = $n; }

    // Minimal heuristic reply (matches frontend buildReply spirit)
    $lower = strtolower($messageIn);
    $messageOut = '';
    $intent = '';
    if (strpos($lower, 'bei') !== false || strpos($lower, 'price') !== false) {
        $intent = 'price';
        $messageOut = 'Karibu! Niipate bei ya bidhaa gani? Nitahesabu kwa SASA.';
    } elseif (strpos($lower, 'loyalty') !== false || strpos($lower, 'pointi') !== false) {
        $intent = 'loyalty';
        $messageOut = 'Pointi zako ziko salama! Unaweza kuzitumia kupata discount.';
    } elseif (strpos($lower, 'live') !== false || strpos($lower, 'moja kwa moja') !== false) {
        $intent = 'live_shopping';
        $messageOut = 'Unaweza kutazama Live Shopping yetu sasa! Angalia bidhaa zinazouzwa moja kwa moja.';
    } elseif (strpos($lower, 'track') !== false || strpos($lower, 'delivery') !== false || strpos($lower, 'bodaboda') !== false) {
        $intent = 'track_delivery';
        $messageOut = 'Ingiza namba ya tracking (TRACK-...) ili kufuatilia uwasilishaji wa bodaboda.';
    } elseif (strpos($lower, 'hello') !== false || strpos($lower, 'hujambo') !== false || strpos($lower, 'hi') !== false) {
        $intent = 'greeting';
        $messageOut = (string)($bot['welcomeMessage'] ?? 'Habari! Karibu kwenye TradeCore. Tutaweza kukusaidia kununua bidhaa kwa urahisi.');
    } else {
        $intent = 'search';
        $messageOut = (string)($bot['fallbackMessage'] ?? 'Samahani, sijaielewa. Jaribu: "bei ya ..." au "track" ili kupata usaidizi.');
    }

    array_unshift($conversations, [
        'id' => $id + 1,
        'phone' => $phone,
        'messageIn' => $messageIn,
        'messageOut' => $messageOut,
        'intent' => $intent,
        'productIds' => [],
        'status' => $enabled ? 'replied' : 'logged_test',
        'mode' => $mode,
        'createdAt' => now()
    ]);
    $state['whatsappConversations'] = array_slice($conversations, 0, 5000);
    if (!save_system_state_array($state)) json_error('Failed to save conversation.', 500);
    json_response(['success' => true, 'reply' => $messageOut, 'intent' => $intent, 'mode' => $mode]);
}

// --- Rider pings live location for a delivery ---
if ($action === 'delivery_update_location') {
    $state = load_system_state_array();
    if (!is_array($state)) json_error('System state unavailable.', 503);
    $trackingCode = trim((string)($req_input['trackingCode'] ?? ''));
    $lat = (float)($req_input['lat'] ?? 0);
    $lng = (float)($req_input['lng'] ?? 0);
    if ($trackingCode === '' || $lat === 0.0 || $lng === 0.0) json_error('Tracking code, lat and lng are required.', 422);

    $deliveries = isset($state['deliveries']) && is_array($state['deliveries']) ? $state['deliveries'] : [];
    $updated = false;
    $deliveryId = 0;
    foreach ($deliveries as $i => $d) {
        if ((string)($d['trackingCode'] ?? '') === $trackingCode) {
            $deliveries[$i]['riderLat'] = $lat;
            $deliveries[$i]['riderLng'] = $lng;
            $deliveries[$i]['updatedAt'] = now();
            $deliveryId = (int)($d['id'] ?? 0);
            $updated = true;
            break;
        }
    }
    if (!$updated) json_error('Delivery not found.', 404);
    $state['deliveries'] = $deliveries;

    $updates = isset($state['deliveryUpdates']) && is_array($state['deliveryUpdates']) ? $state['deliveryUpdates'] : [];
    $id = 0;
    foreach ($updates as $u) { $n = (int)($u['id'] ?? 0); if ($n > $id) $id = $n; }
    array_unshift($updates, [
        'id' => $id + 1,
        'deliveryId' => $deliveryId,
        'status' => 'location',
        'lat' => $lat,
        'lng' => $lng,
        'note' => 'Rider location update',
        'createdAt' => now()
    ]);
    $state['deliveryUpdates'] = array_slice($updates, 0, 5000);
    if (!save_system_state_array($state)) json_error('Failed to save location.', 500);
    json_response(['success' => true, 'trackingCode' => $trackingCode, 'lat' => $lat, 'lng' => $lng]);
}

// --- ROOT / seller advances a delivery status ---
if ($action === 'delivery_status') {
    $trackingCode = trim((string)($req_input['trackingCode'] ?? ''));
    $status = trim((string)($req_input['status'] ?? ''));
    $note = trim((string)($req_input['note'] ?? ''));
    if ($trackingCode === '' || $status === '') json_error('Tracking code and status are required.', 422);
    $allowed = ['assigned', 'picked', 'on_the_way', 'delivered', 'cancelled'];
    if (!in_array($status, $allowed, true)) json_error('Invalid status.', 422);

    $state = load_system_state_array();
    if (!is_array($state)) json_error('System state unavailable.', 503);
    $deliveries = isset($state['deliveries']) && is_array($state['deliveries']) ? $state['deliveries'] : [];
    $updated = false;
    $deliveryId = 0;
    $customerPhone = '';
    foreach ($deliveries as $i => $d) {
        if ((string)($d['trackingCode'] ?? '') === $trackingCode) {
            $deliveries[$i]['status'] = $status;
            $deliveries[$i]['updatedAt'] = now();
            $deliveryId = (int)($d['id'] ?? 0);
            $customerPhone = (string)($d['customerPhone'] ?? '');
            $updated = true;
            break;
        }
    }
    if (!$updated) json_error('Delivery not found.', 404);
    $state['deliveries'] = $deliveries;

    $updates = isset($state['deliveryUpdates']) && is_array($state['deliveryUpdates']) ? $state['deliveryUpdates'] : [];
    $id = 0;
    foreach ($updates as $u) { $n = (int)($u['id'] ?? 0); if ($n > $id) $id = $n; }
    array_unshift($updates, [
        'id' => $id + 1,
        'deliveryId' => $deliveryId,
        'status' => $status,
        'note' => $note !== '' ? $note : null,
        'createdAt' => now()
    ]);
    $state['deliveryUpdates'] = array_slice($updates, 0, 5000);

    // Log the customer SMS (log mode)
    if ($customerPhone !== '') {
        $labels = ['assigned' => 'Rider amekabidhiwa', 'picked' => 'Bidhaa zimechukuliwa', 'on_the_way' => 'Njiani kufika', 'delivered' => 'Imefikishwa', 'cancelled' => 'Imeghairiwa'];
        $logs = isset($state['notificationLogs']) && is_array($state['notificationLogs']) ? $state['notificationLogs'] : [];
        $logId = 0;
        foreach ($logs as $l) { $n = (int)($l['id'] ?? 0); if ($n > $logId) $logId = $n; }
        array_unshift($logs, [
            'id' => $logId + 1,
            'to' => $customerPhone,
            'message' => 'TradeCore: ' . ($labels[$status] ?? $status) . ' kwa order yako. Fuatilia: ' . $trackingCode,
            'kind' => 'sms',
            'status' => 'logged',
            'mode' => 'log',
            'url' => '/track/' . $trackingCode,
            'createdAt' => now()
        ]);
        $state['notificationLogs'] = array_slice($logs, 0, 5000);
    }

    if (!save_system_state_array($state)) json_error('Failed to save status.', 500);
    json_response(['success' => true, 'trackingCode' => $trackingCode, 'status' => $status]);
}

// --- Live stream heartbeat (viewers/likes tick) ---
if ($action === 'live_heartbeat') {
    $state = load_system_state_array();
    if (!is_array($state)) json_error('System state unavailable.', 503);
    $streamKey = trim((string)($req_input['streamKey'] ?? ''));
    if ($streamKey === '') json_error('Stream key is required.', 422);
    $delta = (int)($req_input['delta'] ?? 0);
    $like = (bool)($req_input['like'] ?? false);

    $liveStreams = isset($state['liveStreams']) && is_array($state['liveStreams']) ? $state['liveStreams'] : [];
    $updated = false;
    foreach ($liveStreams as $i => $s) {
        if ((string)($s['streamKey'] ?? '') === $streamKey) {
            if ($delta !== 0) $liveStreams[$i]['viewersCount'] = max(0, (int)($s['viewersCount'] ?? 0) + $delta);
            if ($like) $liveStreams[$i]['likesCount'] = ((int)($s['likesCount'] ?? 0) + 1);
            $updated = true;
            break;
        }
    }
    if (!$updated) json_error('Live stream not found.', 404);
    $state['liveStreams'] = $liveStreams;
    if (!save_system_state_array($state)) json_error('Failed to save heartbeat.', 500);
    json_response(['success' => true, 'streamKey' => $streamKey]);
}

json_response([
    "success" => true,
    "status" => "online",
    "domain" => "tanzaniatradecore.co.tz",
    "message" => "TradeCore PHP REST API service ready."
]);

} catch (Throwable $e) {
    error_log('[TradeCore API] Uncaught error: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    // Always return JSON — never let Apache produce a raw 500 HTML page
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        http_response_code(200);
    }
    echo json_encode([
        'success' => false,
        'error' => 'Server error — please try again.',
        'action' => $action ?? 'unknown',
    ], JSON_UNESCAPED_UNICODE);
    exit();
}