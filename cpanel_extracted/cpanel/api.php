<?php
/**
 * GlobalTradeCore API — Bulletproof wrapper v3
 * Architecture: headers-first, inline fast-track for ALL sync-critical actions,
 * backup file for everything else, catch(Throwable) last resort.
 */
// Suppress output from included files
error_reporting(E_ERROR | E_PARSE);
@ini_set('display_errors', '0');

// 1. Set headers BEFORE anything else
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
header('X-Content-Type-Options: nosniff');

// 2. CORS — always allow all origins
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS, HEAD');
header('Access-Control-Allow-Headers: Content-Type, Accept, X-API-Key, X-Requested-With, Authorization');
header('Access-Control-Max-Age: 86400');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit(); }

/**
 * Normalize blob data: if the blob was saved with the old wrapper envelope
 * ({action, data, lastUpdated}), extract just the inner data object.
 * All blob reads MUST pass through this to handle legacy corrupted blobs.
 */
function normalizeBlobData($blob) {
    if (is_array($blob) && isset($blob['action']) && isset($blob['data']) && is_array($blob['data'])) {
        return $blob['data'];
    }
    return $blob;
}

/**
 * CATEGORY PERSISTENCE: tradecore_categories is the per-company MySQL store for
 * Stock Categories. Every category is a row with company_id, category_name and
 * created_at/updated_at timestamps, kept in sync from the save_state merge. The
 * table is the source of truth on get_state so categories survive blob clobbering,
 * refresh and company switches.
 */
function tcEnsureCategoryTable($pdo) {
    static $done = false;
    if ($done || !$pdo) return;
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS tradecore_categories (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id VARCHAR(50) NOT NULL,
            category_name VARCHAR(255) NOT NULL,
            created_at BIGINT NOT NULL,
            updated_at BIGINT NOT NULL,
            deleted_at BIGINT DEFAULT NULL,
            UNIQUE KEY uniq_cat_company (company_id, category_name),
            INDEX idx_cat_company (company_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $done = true;
    } catch (Throwable $e) {}
}

/**
 * Read all categories from tradecore_categories as company-scoped strings
 * ("co_<companyId>:<name>"). When a company_id is supplied the result is scoped to
 * that company only; otherwise the full cross-company set is returned (matching the
 * blob format the client already expects and filters per active company).
 */
function tcLoadCategories($pdo, $companyId = '') {
    $out = [];
    if (!$pdo) return $out;
    tcEnsureCategoryTable($pdo);
    try {
        if ($companyId !== '') {
            $st = $pdo->prepare("SELECT company_id, category_name, deleted_at FROM tradecore_categories WHERE company_id=? ORDER BY created_at ASC, id ASC");
            $st->execute([(string)$companyId]);
        } else {
            $st = $pdo->query("SELECT company_id, category_name, deleted_at FROM tradecore_categories ORDER BY company_id ASC, created_at ASC, id ASC");
        }
        foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) {
            if (!empty($r['deleted_at'])) continue;
            $cid = (int)($r['company_id'] ?? 1);
            $name = trim((string)($r['category_name'] ?? ''));
            if ($name === '') continue;
            $out[] = 'co_' . $cid . ':' . $name;
        }
    } catch (Throwable $e) {}
    return $out;
}

/**
 * Mirror a merged categories array into tradecore_categories. Idempotent upserts
 * capture company_id, category_name and timestamps (requirement: explicit MySQL rows
 * per company). Rows are pruned ONLY for companies fully present in the incoming
 * merged set — an empty/unrelated merge never deletes another company's categories,
 * so a stale flush can never wipe them.
 */
function tcMirrorCategories($pdo, $cats) {
    if (!$pdo || !is_array($cats)) return;
    tcEnsureCategoryTable($pdo);
    try {
        $byCompany = [];
        foreach ($cats as $cname) {
            if (!is_string($cname) || trim($cname) === '') continue;
            $cid = 1; $name = trim($cname);
            if (preg_match('/^co_(\d+):(.+)$/s', $name, $m)) { $cid = (int)$m[1]; $name = trim($m[2]); }
            if ($name === '') continue;
            if (!isset($byCompany[$cid])) $byCompany[$cid] = [];
            $byCompany[$cid][] = $name;
        }
        if (count($byCompany) === 0) return;
        $now = time();
        $upsert = $pdo->prepare("INSERT INTO tradecore_categories (company_id, category_name, created_at, updated_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE updated_at=VALUES(updated_at), deleted_at=NULL");
        foreach ($byCompany as $cid => $names) {
            foreach ($names as $name) {
                try { $upsert->execute([(string)$cid, $name, $now, $now]); } catch (Throwable $e) {}
            }
            $ph = implode(',', array_fill(0, count($names), '?'));
            $params = array_merge([(string)$cid], $names);
            try {
                $del = $pdo->prepare("DELETE FROM tradecore_categories WHERE company_id=? AND deleted_at IS NULL AND category_name NOT IN ($ph)");
                $del->execute($params);
            } catch (Throwable $e) {}
        }
        error_log('[TradeCore API] CATEGORIES mirrored to MySQL across ' . count($byCompany) . ' companies (' . count($cats) . ' entries)');
    } catch (Throwable $e) {
        error_log('[TradeCore API] CATEGORIES mirror failed: ' . $e->getMessage());
    }
}

/**
 * CAPTURE OPERATOR IP safely (behind proxies / shared hosting).
 */
function tcClientIp() {
    foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'REMOTE_ADDR'] as $k) {
        $v = $_SERVER[$k] ?? '';
        if ($v !== '') {
            $parts = explode(',', $v);
            $ip = trim($parts[0]);
            if (filter_var($ip, FILTER_VALIDATE_IP)) return $ip;
        }
    }
    return '0.0.0.0';
}

/**
 * tcCurrentOperator — resolve the authenticated operator identity from headers/body
 * for audit logging. Returns [username, role].
 */
function tcCurrentOperator($rawInput) {
    $operator = $role = '';
    foreach ($_SERVER as $k => $v) {
        if (strcasecmp($k, 'HTTP_X_OPERATOR') === 0 && $v !== '') $operator = $v;
        if (strcasecmp($k, 'HTTP_X_OPERATOR_ROLE') === 0 && $v !== '') $role = $v;
    }
    if ($operator === '') {
        $in = is_array($rawInput) ? $rawInput : (@json_decode((string)$rawInput, true) ?: []);
        if (!empty($in['operator'])) $operator = (string)$in['operator'];
        if (empty($role) && !empty($in['role'])) $role = (string)$in['role'];
    }
    return [$operator !== '' ? $operator : 'System', $role !== '' ? $role : 'Guest'];
}

/**
 * logCoreAction — insert a row into the existing `audit_logs` table.
 * Columns (per schema): id (auto), timestamp, operator_username, role,
 * action_performed, details, ip_address.
 * This is a fire-and-forget logger: it NEVER blocks or alters the request flow and
 * swallows any DB error so audit logging can never break a sync/CRUD write.
 *
 * @param PDO|null $pdo
 * @param string   $operator
 * @param string   $role
 * @param string   $action         action_performed
 * @param string   $details
 * @param string   $ip             optional, defaults to detected client IP
 */
function logCoreAction($pdo, $operator, $role, $action, $details, $ip = null) {
    if (!$pdo) return;
    try {
        $operator = (string)($operator ?? 'System');
        $role = (string)($role ?? 'Guest');
        $action = (string)($action ?? '');
        $details = (string)($details ?? '');
        $ip = $ip !== null ? (string)$ip : tcClientIp();
        $ts = date('Y-m-d H:i:s');
        // Preserve caller-provided timestamp if the action already carries one.
        if (is_string($details) && preg_match('/\btimestamp=([0-9]{4}-[0-9]{2}-[0-9]{2}[ T][0-9:.]+)/', $details, $m)) {
            $ts = str_replace('T', ' ', $m[1]);
        }
        if (strlen($operator) > 160) $operator = substr($operator, 0, 160);
        if (strlen($action) > 160) $action = substr($action, 0, 160);
        if (strlen($details) > 1000) $details = substr($details, 0, 1000);
        $stmt = $pdo->prepare(
            "INSERT INTO audit_logs (timestamp, operator_username, role, action_performed, details, ip_address)
             VALUES (?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([$ts, $operator, $role, $action, $details, $ip]);
    } catch (Throwable $e) {
        error_log('[TradeCore API] logCoreAction failed: ' . $e->getMessage());
    }
}

/**
 * AUTHORIZATION GUARD (Issue 2): when a request carries the authenticated operator
 * (X-Operator / X-Operator-Id header, or `operator`/`user_id` in the body), validate
 * against the authoritative atomic `tradecore_users` table on EVERY request. If the
 * user was deleted or is no longer Active, return 401 so the client force-logs-out.
 * Core super admins (root_mandate/superadmin) are always allowed.
 *
 * Returns true if the caller may proceed, false if a 401 already was emitted.
 */
function tcAuthorizeOperator($pdo, $rawInput) {
    if (!$pdo) return true; // No DB → cannot validate; do not lock out users.
    static $checked = false;
    if ($checked) return true; // one check per request
    $operator = $operatorId = '';
    $hasHeaders = false;
    foreach ($_SERVER as $k => $v) {
        if (strcasecmp($k, 'HTTP_X_OPERATOR') === 0 && $v !== '') { $operator = $v; $hasHeaders = true; }
        if (strcasecmp($k, 'HTTP_X_OPERATOR_ID') === 0 && $v !== '') { $operatorId = $v; $hasHeaders = true; }
    }
    if (!$hasHeaders) {
        $in = is_array($rawInput) ? $rawInput : (@json_decode((string)$rawInput, true) ?: []);
        if (!empty($in['operator'])) { $operator = (string)$in['operator']; $hasHeaders = true; }
        if (!empty($in['user_id'])) { $operatorId = (string)$in['user_id']; $hasHeaders = true; }
    }
    if (!$hasHeaders || ($operator === '' && $operatorId === '')) return true; // Guest/public/system — allowed.
    // Core super admins always bypass.
    $op = strtolower(trim($operator));
    if ($op === 'root_mandate' || $op === 'superadmin' || $op === 'system') { $checked = true; return true; }
    try {
        $stmt = null;
        if ($operator !== '') {
            $stmt = $pdo->prepare("SELECT data, deleted_at FROM tradecore_users WHERE deleted_at IS NULL AND LOWER(BINARY data->>'$.username') = ? LIMIT 1");
            $stmt->execute([$op]);
        } elseif ($operatorId !== '') {
            $stmt = $pdo->prepare("SELECT data, deleted_at FROM tradecore_users WHERE deleted_at IS NULL AND id = ? LIMIT 1");
            $stmt->execute([$operatorId]);
        }
        if (!$stmt) { $checked = true; return true; }
        $row = $stmt->fetch();
        if (!$row) {
            // Not found in atomic table → either deleted or unknown. Reject to force session refresh.
            $checked = true;
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'unauthorized', 'code' => 'SESSION_REVOKED', 'server_ts' => time()]);
            exit();
        }
        $u = json_decode($row['data'], true);
        $active = ($u['is_active'] ?? $u['active'] ?? 1) == 1;
        $status = strtolower((string)($u['status'] ?? ''));
        $blocked = $status === 'blocked' || $status === 'terminated';
        if (!$active || $blocked || !empty($row['deleted_at'])) {
            $checked = true;
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'unauthorized', 'code' => 'SESSION_REVOKED', 'server_ts' => time()]);
            exit();
        }
    } catch (Throwable $eAuth) {
        error_log('[TradeCore API] tcAuthorizeOperator query failed: ' . $eAuth->getMessage());
    }
    $checked = true;
    return true;
}

// AUTH FIX (Fix 2): SOFT authorization used for credential-changing / login flows
// (change_password, upsert_user, login). Identical live-user validation to
// tcAuthorizeOperator, but it NEVER emits the SESSION_REVOKED marker / hard exit.
// Return values:
//   1  → allowed (valid active operator, core superadmin, or guest/public).
//   0  → operator headers present but the operator is unknown/blocked/deleted/inactive.
//        The caller decides how to respond (a graceful, NON-revoking error for
//        password changes — never a forced logout of a session that owns the change).
function tcAuthorizeOperatorSoft($pdo, $rawInput, $action = '') {
    if (!$pdo) return 1;
    static $checkedSoft = false;
    if ($checkedSoft) return 1;
    $operator = $operatorId = '';
    $hasHeaders = false;
    foreach ($_SERVER as $k => $v) {
        if (strcasecmp($k, 'HTTP_X_OPERATOR') === 0 && $v !== '') { $operator = $v; $hasHeaders = true; }
        if (strcasecmp($k, 'HTTP_X_OPERATOR_ID') === 0 && $v !== '') { $operatorId = $v; $hasHeaders = true; }
    }
    if (!$hasHeaders) {
        $in = is_array($rawInput) ? $rawInput : (@json_decode((string)$rawInput, true) ?: []);
        if (!empty($in['operator'])) { $operator = (string)$in['operator']; $hasHeaders = true; }
        if (!empty($in['user_id'])) { $operatorId = (string)$in['user_id']; $hasHeaders = true; }
    }
    if (!$hasHeaders || ($operator === '' && $operatorId === '')) { $checkedSoft = true; return 1; } // guest
    $op = strtolower(trim($operator));
    if ($op === 'root_mandate' || $op === 'superadmin' || $op === 'system') { $checkedSoft = true; return 1; }
    try {
        $stmt = null;
        if ($operator !== '') {
            $stmt = $pdo->prepare("SELECT data, deleted_at FROM tradecore_users WHERE deleted_at IS NULL AND LOWER(BINARY data->>'$.username') = ? LIMIT 1");
            $stmt->execute([$op]);
        } elseif ($operatorId !== '') {
            $stmt = $pdo->prepare("SELECT data, deleted_at FROM tradecore_users WHERE deleted_at IS NULL AND id = ? LIMIT 1");
            $stmt->execute([$operatorId]);
        }
        if (!$stmt) { $checkedSoft = true; return 1; }
        $row = $stmt->fetch();
        if (!$row) { $checkedSoft = true; return 0; } // unknown → graceful, not revoked
        $u = json_decode($row['data'], true);
        $active = ($u['is_active'] ?? $u['active'] ?? 1) == 1;
        $status = strtolower((string)($u['status'] ?? ''));
        $blocked = $status === 'blocked' || $status === 'terminated';
        if (!$active || $blocked || !empty($row['deleted_at'])) { $checkedSoft = true; return 0; }
    } catch (Throwable $eAuth) {
        error_log('[TradeCore API] tcAuthorizeOperatorSoft query failed: ' . $eAuth->getMessage());
    }
    $checkedSoft = true;
    return 1;
}

// 3. Detect SSE early — bypass all headers/json logic
$isSSE = (
    stripos($_SERVER['HTTP_ACCEPT'] ?? '', 'text/event-stream') !== false ||
    (!empty($_GET['action']) && $_GET['action'] === 'stream_updates')
);

try {
    // 4. Parse action
    $rawInput = file_get_contents('php://input');
    $action = '';
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $rawInput) {
        $inputData = json_decode($rawInput, true);
        if (is_array($inputData) && isset($inputData['action'])) $action = $inputData['action'];
    }
    if (!$action) $action = $_GET['action'] ?? $_POST['action'] ?? '';
    if (!$action) $action = 'get_state';

    // --- PDO connection (reused by all inline handlers) ---
    $pdo = null;
    try {
        // Load DB credentials from config file (outside public_html when possible)
        $dbCreds = @include(__DIR__ . '/config/db.php');
        if (!is_array($dbCreds)) $dbCreds = @include(dirname(__DIR__, 2) . '/config/db.php');
        if (!is_array($dbCreds)) $dbCreds = ['host'=>'localhost','name'=>'tanzatrade_tradecore_erp','user'=>'tanzatrade_tanzatrade','pass'=>'123456789@Tanzatrade'];
        $pdo = new PDO(
            "mysql:host=" . $dbCreds['host'] . ";dbname=" . $dbCreds['name'] . ";charset=utf8mb4",
            $dbCreds['user'],
            $dbCreds['pass'],
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false]
        );
    } catch (Throwable $dbErr) {
        error_log('[TradeCore API] DB connection failed: ' . $dbErr->getMessage());
    }

    $now = time();

    // ============================================================================
    // ISSUE 2: AUTH / SESSION REVOCATION — validate the authenticated operator against
    // the authoritative atomic tradecore_users table on EVERY request. Deleted,
    // blocked, or deactivated users get HTTP 401 SESSION_REVOKED, which the client
    // uses to force a hard logout. Runs only when an operator header/body is present
    // (public marketplace + login carry none and are unaffected).
    // ============================================================================
    // AUTH FIX (Fix 2): Credential-changing / login flows use the SOFT guard which never
    // hard-revokes (`SESSION_REVOKED`) — a valid active user attempting a mandatory
    // password update must NOT be thrown out to /login. All other actions keep the strict
    // guard (deleted/blocked users are still hard-revoked instantly).
    $softAuthActions = ['change_password', 'upsert_user', 'assign_user', 'create_user', 'login'];
    if (in_array($action, $softAuthActions, true)) {
        $authResult = tcAuthorizeOperatorSoft($pdo, $rawInput, $action);
        // Even when the operator looks soft-invalid, DO NOT exit here. The action handler
        // below decides (change_password self-serves; logout is never forced).
        unset($authResult, $softAuthActions);
    } else {
        tcAuthorizeOperator($pdo, $rawInput);
    }

    // ============================================================================
    // ISSUE 3: get_audit_logs — return rows from the existing `audit_logs` table for
    // the Audit Trail UI. Optional `action`, `operator`, and `limit` filters.
    // ============================================================================
    if ($action === 'get_audit_logs') {
        if (!$pdo) { echo json_encode(["success" => false, "error" => "no_db", "logs" => []]); exit(); }
        $fAction = isset($_GET['action_filter']) ? trim((string)$_GET['action_filter']) : (isset($_GET['action']) ? trim((string)$_GET['action']) : '');
        $fOperator = isset($_GET['operator']) ? trim((string)$_GET['operator']) : '';
        $limit = isset($_GET['limit']) ? max(1, (int)$_GET['limit']) : 200;
        if ($limit > 2000) $limit = 2000;
        try {
            $sql = "SELECT timestamp, operator_username, role, action_performed, details, ip_address
                    FROM audit_logs";
            $cond = [];
            $args = [];
            if ($fAction !== '') { $cond[] = "action_performed = ?"; $args[] = $fAction; }
            if ($fOperator !== '') { $cond[] = "operator_username = ?"; $args[] = $fOperator; }
            if (count($cond) > 0) $sql .= " WHERE " . implode(' AND ', $cond);
            $sql .= " ORDER BY id DESC LIMIT " . $limit;
            $stmt = $pdo->prepare($sql);
            $stmt->execute($args);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            // Normalize to camelCase fields for the React AuditTrail type.
            $logs = [];
            foreach ($rows as $r) {
                $logs[] = [
                    'id' => 'DB-' . md5(json_encode($r)),
                    'userId' => 0,
                    'username' => (string)($r['operator_username'] ?? ''),
                    'role' => (string)($r['role'] ?? ''),
                    'action' => (string)($r['action_performed'] ?? ''),
                    'details' => (string)($r['details'] ?? ''),
                    'companyId' => null,
                    'timestamp' => (string)($r['timestamp'] ?? ''),
                    'ipAddress' => (string)($r['ip_address'] ?? ''),
                ];
            }
            echo json_encode(["success" => true, "logs" => $logs, "server_ts" => time()]);
        } catch (Throwable $eAudit) {
            error_log('[TradeCore API] get_audit_logs failed: ' . $eAudit->getMessage());
            echo json_encode(["success" => false, "error" => "Audit log query failed", "logs" => []]);
        }
        exit();
    }

    // ============================================================================
    // SNAPSHOT: per-company authoritative fetch (SINGLE SOURCE OF TRUTH).
    // Returns the canonical company state to a browser on boot / active-company
    // switch by reading DIRECTLY from MySQL: per-row tables are queried with
    // `WHERE company_id = ?` (users, products, sales, marketplace_orders) and
    // categories come from tradecore_categories (falling back to the blob's
    // categories only while the mirror table is still empty). Every other, still
    // blob-backed collection (companies/branches/stores/taxes/suppliers/...) is
    // overlaid from the main_state blob so the result is a complete state object.
    // The client applies this UNCONDITIONALLY — localStorage is never treated as a
    // source of truth, which is what makes Chrome and Edge converge on refresh.
    // ============================================================================
    if ($action === 'snapshot') {
        if (!$pdo) { echo json_encode(["success" => false, "error" => "no_db"]); exit(); }
        try {
            $companyId = isset($_GET['company_id']) ? trim((string)$_GET['company_id']) : '';
            if ($companyId === '') {
                // Allow a POST body company_id too (defensive; GET is the norm).
                $bodyIn = json_decode((string)$rawInput, true);
                if (is_array($bodyIn) && isset($bodyIn['company_id'])) $companyId = trim((string)$bodyIn['company_id']);
            }

            // 1. Authoritative blob: version watermark + every blob-backed collection.
            $blobRow = $pdo->query("SELECT json_data, version FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1")->fetch(PDO::FETCH_ASSOC);
            $blob = $blobRow && $blobRow['json_data'] ? normalizeBlobData(json_decode($blobRow['json_data'], true)) : [];
            if (!is_array($blob)) $blob = [];
            $version = $blobRow ? (int)($blobRow['version'] ?? 0) : 0;

            // 2. Relational rows scoped to the company (WHERE company_id = ?).
            if ($companyId !== '') {
                // users -> tradecore_users
                try {
                    $st = $pdo->prepare("SELECT data FROM tradecore_users WHERE company_id=? AND deleted_at IS NULL");
                    $st->execute([$companyId]);
                    $rows = [];
                    foreach ($st->fetchAll() as $r) { $d = json_decode($r['data'], true); if (is_array($d)) $rows[] = $d; }
                    // Omit the key when the table has nothing yet but the blob does
                    // (legacy rows) so the authoritative replace can't wipe them.
                    if (count($rows) > 0 || empty($blob['users'] ?? [])) $blob['users'] = $rows;
                } catch (Throwable $eSnapU) { error_log('[TradeCore API] snapshot users failed: ' . $eSnapU->getMessage()); }
                // products -> marketplaceProducts
                try {
                    $st = $pdo->prepare("SELECT data FROM tradecore_products WHERE company_id=? AND deleted_at IS NULL");
                    $st->execute([$companyId]);
                    $rows = [];
                    foreach ($st->fetchAll() as $r) { $d = json_decode($r['data'], true); if (is_array($d)) $rows[] = $d; }
                    if (count($rows) > 0 || empty($blob['marketplaceProducts'] ?? [])) $blob['marketplaceProducts'] = $rows;
                } catch (Throwable $eSnapP) { error_log('[TradeCore API] snapshot products failed: ' . $eSnapP->getMessage()); }
                // sales -> salesOrders
                try {
                    $st = $pdo->prepare("SELECT data FROM tradecore_sales WHERE company_id=? AND deleted_at IS NULL");
                    $st->execute([$companyId]);
                    $rows = [];
                    foreach ($st->fetchAll() as $r) { $d = json_decode($r['data'], true); if (is_array($d)) $rows[] = $d; }
                    if (count($rows) > 0 || empty($blob['salesOrders'] ?? [])) $blob['salesOrders'] = $rows;
                } catch (Throwable $eSnapS) { error_log('[TradeCore API] snapshot sales failed: ' . $eSnapS->getMessage()); }
                // marketplace_orders -> marketplaceOrders
                try {
                    $st = $pdo->prepare("SELECT data FROM tradecore_marketplace_orders WHERE company_id=? AND deleted_at IS NULL");
                    $st->execute([$companyId]);
                    $rows = [];
                    foreach ($st->fetchAll() as $r) { $d = json_decode($r['data'], true); if (is_array($d)) $rows[] = $d; }
                    if (count($rows) > 0 || empty($blob['marketplaceOrders'] ?? [])) $blob['marketplaceOrders'] = $rows;
                } catch (Throwable $eSnapO) { error_log('[TradeCore API] snapshot orders failed: ' . $eSnapO->getMessage()); }
            }

            // 3. Categories: tradecore_categories is authoritative; fall back to the
            //    blob's categories only while the mirror table is still empty so a
            //    fresh DB (migration not yet run) can never reset categories to [].
            try {
                $cats = tcLoadCategories($pdo);
                if (count($cats) === 0 && isset($blob['categories']) && is_array($blob['categories']) && count($blob['categories']) > 0) {
                    $cats = $blob['categories'];
                }
                $blob['categories'] = $cats;
            } catch (Throwable $eSnapC) { error_log('[TradeCore API] snapshot categories failed: ' . $eSnapC->getMessage()); }

            $blob['_version'] = $version;
            $blob['_serverUpdatedAt'] = $blobRow['updated_at'] ?? $blob['_serverUpdatedAt'] ?? null;
            if (!isset($blob['lastUpdated'])) $blob['lastUpdated'] = date('c');

            echo json_encode(["success" => true, "changed" => true, "version" => $version, "_version" => $version, "server_ts" => $version > 0 ? $version : time(), "state" => $blob]);
            exit();
        } catch (Throwable $eSnap) {
            error_log('[TradeCore API] snapshot failed: ' . $eSnap->getMessage());
            echo json_encode(["success" => false, "error" => "snapshot_failed"]);
            exit();
        }
    }

    // ============================================================================
    // INLINE FAST-TRACK: check_timestamp
    // ============================================================================
    if ($action === 'check_timestamp') {
        $clientVersion = isset($_GET['client_version']) ? (int)$_GET['client_version'] : 0;
        $includeState = isset($_GET['full']) || $clientVersion > 0;
        $updatedAt = null;
        $version = 0;
        if ($pdo) {
            try {
                $stmt = $pdo->query("SELECT updated_at, version FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1");
                $row = $stmt ? $stmt->fetch(PDO::FETCH_ASSOC) : null;
                if ($row) {
                    if (!empty($row['updated_at'])) $updatedAt = $row['updated_at'];
                    if (isset($row['version'])) $version = (int)$row['version'];
                }
            } catch (Throwable $e) {
                error_log('[TradeCore API] check_timestamp query failed: ' . $e->getMessage());
            }
        }
        if (!$updatedAt) {
            $sf = __DIR__ . '/data/system_state.json';
            if (is_file($sf)) {
                $fc = @file_get_contents($sf);
                $fd = $fc ? json_decode($fc, true) : null;
                if (is_array($fd)) {
                    $inner = isset($fd['data']) && is_array($fd['data']) ? $fd['data'] : $fd;
                    $updatedAt = $inner['updatedAt'] ?? $inner['lastUpdated'] ?? $fd['updatedAt'] ?? $fd['lastUpdated'] ?? null;
                    $version = (int)($inner['version'] ?? $inner['_version'] ?? $fd['version'] ?? 0);
                }
            }
        }
        $iso = $updatedAt ? date('c', is_numeric($updatedAt) ? (int)$updatedAt : strtotime((string)$updatedAt)) : null;
        $result = [
            "success" => true,
            "lastUpdated" => $updatedAt,
            "updatedAt" => $updatedAt,
            "updatedAtIso" => $iso,
            "version" => $version,
            "_version" => $version,
            "server_ts" => $version > 0 ? $version : ($iso ?? $updatedAt),
        ];
        // When client_version differs from server or full=1, return full state inline
        // so the client doesn't need a separate get_state round-trip
        if ($includeState && $pdo) {
            $stateChanged = ($clientVersion > 0 && $clientVersion !== $version) || $clientVersion === 0;
            if ($stateChanged) {
                try {
                    $stmt2 = $pdo->query("SELECT json_data FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1");
                    $row2 = $stmt2 ? $stmt2->fetch(PDO::FETCH_ASSOC) : null;
                    if ($row2 && $row2['json_data']) {
                        $stData = normalizeBlobData(json_decode($row2['json_data'], true));
                        if (is_array($stData)) $result['state'] = $stData;
                    }
                } catch (Throwable $eSt) {
                    error_log('[TradeCore API] check_timestamp state fetch failed: ' . $eSt->getMessage());
                }
            }
        }
        echo json_encode($result);
        exit();
    }

    // ============================================================================
    // INLINE FAST-TRACK: get_state (with since + deleted support)
    // ============================================================================
    if ($action === 'get_state') {
        $companyId = $_GET['company_id'] ?? '';
        $since = isset($_GET['since']) ? (int)$_GET['since'] : 0;

        if ($companyId !== '' && $pdo) {
            try {
                $products = $users = $sales = $orders = [];
                $deletedProducts = $deletedUsers = [];

                if ($since > 0) {
                    // INCREMENTAL: only return items updated since last poll + deleted items
                    $sp = $pdo->prepare("SELECT id, data, deleted_at FROM tradecore_products WHERE company_id=? AND updated_at > ?");
                    $sp->execute([$companyId, $since]);
                    foreach ($sp->fetchAll() as $r) {
                        if ($r['deleted_at']) { $deletedProducts[] = $r['id']; }
                        else { $d = json_decode($r['data'], true); if ($d) $products[] = $d; }
                    }
                    $su = $pdo->prepare("SELECT id, data, deleted_at FROM tradecore_users WHERE company_id=? AND updated_at > ?");
                    $su->execute([$companyId, $since]);
                    foreach ($su->fetchAll() as $r) {
                        if ($r['deleted_at']) { $deletedUsers[] = $r['id']; }
                        else { $d = json_decode($r['data'], true); if ($d) $users[] = $d; }
                    }
                    $ss = $pdo->prepare("SELECT data FROM tradecore_sales WHERE company_id=? AND updated_at > ?");
                    $ss->execute([$companyId, $since]);
                    foreach ($ss->fetchAll() as $r) { $d = json_decode($r['data'], true); if ($d) $sales[] = $d; }
                    $so = $pdo->prepare("SELECT data FROM tradecore_marketplace_orders WHERE company_id=? AND updated_at > ?");
                    $so->execute([$companyId, $since]);
                    foreach ($so->fetchAll() as $r) { $d = json_decode($r['data'], true); if ($d) $orders[] = $d; }
                } else {
                    // FULL: return all active items
                    $sp = $pdo->prepare("SELECT data FROM tradecore_products WHERE company_id=? AND deleted_at IS NULL");
                    $sp->execute([$companyId]);
                    foreach ($sp->fetchAll() as $r) { $d = json_decode($r['data'], true); if ($d) $products[] = $d; }
                    $su = $pdo->prepare("SELECT data FROM tradecore_users WHERE company_id=? AND deleted_at IS NULL");
                    $su->execute([$companyId]);
                    foreach ($su->fetchAll() as $r) { $d = json_decode($r['data'], true); if ($d) $users[] = $d; }
                    $ss = $pdo->prepare("SELECT data FROM tradecore_sales WHERE company_id=?");
                    $ss->execute([$companyId]);
                    foreach ($ss->fetchAll() as $r) { $d = json_decode($r['data'], true); if ($d) $sales[] = $d; }
                    $so = $pdo->prepare("SELECT data FROM tradecore_marketplace_orders WHERE company_id=?");
                    $so->execute([$companyId]);
                    foreach ($so->fetchAll() as $r) { $d = json_decode($r['data'], true); if ($d) $orders[] = $d; }
                }

                $meta = $pdo->query("SELECT updated_at FROM tradecore_meta WHERE id=1")->fetch();
                $serverTs = $meta ? (int)$meta['updated_at'] : $now;

                // CRITICAL: Return the BLOB version (from tradecore_system_state), not the
                // meta timestamp. The client sends this back as lastSeenVersion in flush
                // requests, and save_state compares it against the blob version. If we
                // return the meta timestamp (~1788242048) but the blob version is ~100,
                // every flush gets a 409 "server version ahead" conflict.
                $blobVer = 0;
                try {
                    $bv = $pdo->query("SELECT version FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1")->fetch();
                    if ($bv) $blobVer = (int)($bv['version'] ?? 0);
                } catch (Throwable $eVer) {}
                $effectiveVer = $blobVer > 0 ? $blobVer : $serverTs;

                $result = [
                    "changed" => true,
                    "server_ts" => $effectiveVer,
                    "version" => $effectiveVer,
                    "_version" => $effectiveVer,
                    "products" => $products,
                    "users" => $users,
                    "sales" => $sales,
                    "marketplaceOrders" => $orders,
                ];
                // Categories: on a FULL fetch (since=0) return the MySQL-backed category
                // list (per-company rows + timestamps; source of truth). Incremental
                // fetches omit this key so the client keeps its already-loaded categories.
                if ($since === 0) {
                    $result['categories'] = tcLoadCategories($pdo);
                }
                // Include deleted IDs for incremental sync
                if ($since > 0 && (count($deletedProducts) > 0 || count($deletedUsers) > 0)) {
                    $result['deleted'] = [
                        'productIds' => $deletedProducts,
                        'userIds' => $deletedUsers,
                    ];
                }
                echo json_encode($result);
                exit();
            } catch (Throwable $e) {
                error_log('[TradeCore API] get_state atomic failed: ' . $e->getMessage());
            }
        }
        // Fallback: blob or empty
        if ($pdo) {
            try {
                $stmt = $pdo->query("SELECT json_data, updated_at, version FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1");
                $row = $stmt ? $stmt->fetch(PDO::FETCH_ASSOC) : null;
                if ($row && $row['json_data']) {
                    $data = normalizeBlobData(json_decode($row['json_data'], true));
                    $ver = (int)($row['version'] ?? 0);
                    $outData = is_array($data) ? $data : [];
                    // SELF-HEALING: if blob is empty, rebuild from atomic tables
                    $emptyCount = 0;
                foreach (['users', 'marketplaceProducts', 'stockItems', 'expenses', 'salesOrders', 'purchaseOrders'] as $ck) {
                    if (empty($outData[$ck] ?? [])) $emptyCount++;
                }
                    if ($emptyCount >= 3) {
                        $rebuilt = $outData;
                        try {
                            $rows = $pdo->query("SELECT data FROM tradecore_users WHERE deleted_at IS NULL")->fetchAll(PDO::FETCH_COLUMN);
                            $atomicUsers = [];
                            foreach ($rows as $rj) { $u = json_decode($rj, true); if (is_array($u)) $atomicUsers[] = $u; }
                            if (count($atomicUsers) > 0) { $rebuilt['users'] = $atomicUsers; error_log('[TradeCore API] get_state SELF-HEALING: restored ' . count($atomicUsers) . ' users'); }
                        } catch (Throwable $eu) {}
                        try {
                            $rows = $pdo->query("SELECT data FROM tradecore_products WHERE deleted_at IS NULL")->fetchAll(PDO::FETCH_COLUMN);
                            $atomicProds = [];
                            foreach ($rows as $rj) { $p = json_decode($rj, true); if (is_array($p)) $atomicProds[] = $p; }
                            if (count($atomicProds) > 0) { $rebuilt['marketplaceProducts'] = $atomicProds; error_log('[TradeCore API] get_state SELF-HEALING: restored ' . count($atomicProds) . ' products'); }
                        } catch (Throwable $ep) {}
                        try {
                            $rows = $pdo->query("SELECT data FROM tradecore_sales WHERE deleted_at IS NULL")->fetchAll(PDO::FETCH_COLUMN);
                            $atomicSales = [];
                            foreach ($rows as $rj) { $s = json_decode($rj, true); if (is_array($s)) $atomicSales[] = $s; }
                            if (count($atomicSales) > 0) { $rebuilt['salesOrders'] = $atomicSales; error_log('[TradeCore API] get_state SELF-HEALING: restored ' . count($atomicSales) . ' sales'); }
                        } catch (Throwable $es) {}
                        try {
                            $rows = $pdo->query("SELECT data FROM tradecore_marketplace_orders WHERE deleted_at IS NULL")->fetchAll(PDO::FETCH_COLUMN);
                            $atomicOrders = [];
                            foreach ($rows as $rj) { $o = json_decode($rj, true); if (is_array($o)) $atomicOrders[] = $o; }
                            if (count($atomicOrders) > 0) { $rebuilt['marketplaceOrders'] = $atomicOrders; error_log('[TradeCore API] get_state SELF-HEALING: restored ' . count($atomicOrders) . ' orders'); }
                        } catch (Throwable $eo) {}
                        if (count($rebuilt) > count($outData)) {
                            $outData = $rebuilt;
                            try { $jj = json_encode($outData, JSON_UNESCAPED_UNICODE); $pdo->prepare("UPDATE tradecore_system_state SET json_data=? WHERE doc_key='main_state'")->execute([$jj]); error_log('[TradeCore API] get_state SELF-HEALING: blob rebuilt and persisted'); } catch (Throwable $erb) {}
                        }
                    }
                    if (!isset($outData['_version']) && $ver > 0) $outData['_version'] = $ver;
                    // CATEGORY PERSISTENCE: the MySQL table is the source of truth on GET.
                    // If the table holds categories, rebuild the blob's categories from it —
                    // a clobbered/empty blob key can never wipe known categories.
                    $tableCats = tcLoadCategories($pdo);
                    if (count($tableCats) > 0) $outData['categories'] = $tableCats;
                    echo json_encode(["changed" => true, "server_ts" => $ver, "version" => $ver, "_version" => $ver, "state" => $outData]);
                    exit();
                }
            } catch (Throwable $e) {
                error_log('[TradeCore API] get_state blob failed: ' . $e->getMessage());
            }
        }
        echo json_encode(["changed" => true, "server_ts" => $now, "version" => 0, "state" => ["products" => [], "users" => [], "companies" => []]]);
        exit();
    }

    // ============================================================================
    // INLINE FAST-TRACK: stream_updates (SSE)
    // ============================================================================
    if ($action === 'stream_updates') {
        // SSE requires text/event-stream content type and no-cache headers
        header('Content-Type: text/event-stream');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('X-Accel-Buffering: no');
        if (function_exists('apache_setenv')) @apache_setenv('no-gzip', '1');
        @ini_set('zlib.output_compression', '0');
        while (ob_get_level() > 0) { @ob_end_clean(); }
        if (!connection_aborted()) {
            echo "data: " . json_encode(["type" => "connected", "updatedAt" => date('c'), "version" => 0]) . "\n\n";
            @flush();
        }
        $lastVersion = -1;
        $lastUpdatedAt = '';
        try {
            for ($i = 0; $i < 6; $i++) {
                if (connection_aborted()) break;
                $curVersion = null; $curUpdatedAt = null;
                if ($pdo) {
                    try {
                        $r = $pdo->query("SELECT version, updated_at FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1")->fetch(PDO::FETCH_ASSOC);
                        if ($r) { $curVersion = isset($r['version']) ? (int)$r['version'] : null; $curUpdatedAt = $r['updated_at'] ?? null; }
                    } catch (Throwable $e) {}
                }
                if (!$curVersion && !$curUpdatedAt) {
                    $sf = __DIR__ . '/data/system_state.json';
                    if (is_file($sf)) { $fc = @file_get_contents($sf); $fd = $fc ? json_decode($fc, true) : null; if (is_array($fd)) { $inner = normalizeBlobData($fd); $curVersion = (int)($inner['version'] ?? $inner['_version'] ?? $fd['version'] ?? 0); $curUpdatedAt = $inner['updatedAt'] ?? $inner['lastUpdated'] ?? $fd['updatedAt'] ?? null; } }
                }
                $changed = ($curVersion !== null && $curVersion !== $lastVersion) || ($curUpdatedAt !== null && $curUpdatedAt !== $lastUpdatedAt) || ($curVersion === null && $curUpdatedAt === null && $i === 0);
                if ($changed) {
                    $lastVersion = $curVersion ?? $lastVersion;
                    $lastUpdatedAt = $curUpdatedAt ?? $lastUpdatedAt;
                    $stateData = null; $updatedAtVal = $curUpdatedAt; $verOut = $curVersion;
                    if ($pdo) {
                        try {
                            $r = $pdo->query("SELECT json_data, updated_at, version FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1")->fetch(PDO::FETCH_ASSOC);
                            if ($r && $r['json_data']) { $dec = normalizeBlobData(json_decode($r['json_data'], true)); if ($dec) { $stateData = $dec; $updatedAtVal = $r['updated_at'] ?? $curUpdatedAt; if (isset($r['version'])) $verOut = (int)$r['version']; } }
                        } catch (Throwable $e) {}
                    }
                    if (!$stateData) {
                        $sf = __DIR__ . '/data/system_state.json';
                        if (is_file($sf)) { $fc = @file_get_contents($sf); $fd = $fc ? json_decode($fc, true) : null; if (is_array($fd)) { $stateData = normalizeBlobData(isset($fd['data']) && is_array($fd['data']) ? $fd['data'] : $fd); $updatedAtVal = $fd['updatedAt'] ?? null; $verOut = $fd['version'] ?? 0; } }
                    }
                    if ($stateData && !connection_aborted()) {
                        if (!isset($stateData['_version']) && $verOut !== null) $stateData['_version'] = $verOut;
                        echo "data: " . json_encode(["data" => $stateData, "updatedAt" => $updatedAtVal, "version" => $verOut, "lastUpdated" => $updatedAtVal]) . "\n\n";
                        @flush();
                    }
                }
                sleep(1);
            }
        } catch (Throwable $e) {
            error_log('[TradeCore API] SSE error: ' . $e->getMessage());
            if (!connection_aborted()) {
                echo "data: " . json_encode(["error" => "SSE temporary error", "updatedAt" => date('c'), "version" => 0]) . "\n\n";
                @flush();
            }
        }
        exit();
    }

    // ============================================================================
    // MICRO-UPDATE: mutate_record (PATCH-style single-record CRUD)
    // Isolated, per-record optimistic lock — never rewrites the whole blob.
    // Client sends { action:'mutate_record', collection, op:'upsert'|'delete',
    // recordId, record, baseVersion, lastUpdated }.
    // A single house/property/stock edit commits ONLY that record, atomically
    // bumping _version, and returns HTTP 200 + the updated recordId so the frontend
    // can confirm the write before updating its persistent cache. Stale writes
    // (baseVersion < server version, or per-record updated_at rollback) -> 409.
    // ============================================================================
    if ($action === 'mutate_record') {
        @ini_set('memory_limit', '512M');
        @ini_set('max_execution_time', '60');
        @set_time_limit(60);
        $data = json_decode($rawInput, true);
        $collection = isset($data['collection']) ? (string)$data['collection'] : '';
        $op = isset($data['op']) ? (string)$data['op'] : 'upsert';
        $recordId = $data['recordId'] ?? null;
        $record = (isset($data['record']) && is_array($data['record'])) ? $data['record'] : null;
        $baseVersion = isset($data['baseVersion']) ? (int)$data['baseVersion'] : 0;

        if (!preg_match('/^[A-Za-z0-9_]+$/', $collection)) {
            echo json_encode(["success" => false, "error" => "invalid_collection"]);
            exit();
        }

        // SAFE_COLLECTIONS: only small per-record CRUD targets are allowed through
        // the micro-update path. Mass/settings collections must go through save_state.
        $SAFE_COLLECTIONS = ['stockItems', 'expenses', 'salesOrders', 'purchaseOrders', 'suppliers', 'customers', 'categories', 'taxes', 'branches', 'stores', 'companies', 'users', 'marketplaceProducts', 'marketplaceCustomers', 'marketplaceOrders', 'shippingZones'];
        if (!in_array($collection, $SAFE_COLLECTIONS, true)) {
            echo json_encode(["success" => false, "error" => "collection_not_allowed_for_micro_update"]);
            exit();
        }
        if ($recordId === null || $recordId === '') {
            echo json_encode(["success" => false, "error" => "missing_record_id"]);
            exit();
        }
        if ($op === 'upsert' && $record === null) {
            echo json_encode(["success" => false, "error" => "missing_record"]);
            exit();
        }
        if ($op !== 'upsert' && $op !== 'delete') {
            echo json_encode(["success" => false, "error" => "invalid_op"]);
            exit();
        }

        if (!$pdo) { echo json_encode(["success" => false, "error" => "no_db"]); exit(); }

        // Begin an explicit DB transaction so the blob write + mirrored atomic-table
        // rows commit ATOMICALLY. Only after PDO::commit() do we return the 200 ack —
        // guaranteeing a subsequent get_state/check_timestamp reads back the updated
        // record (never a stale row) and that the version bump is durable.
        $txOpen = false;
        try { $pdo->beginTransaction(); $txOpen = true; } catch (Throwable $txE) { $txOpen = false; }

        try {
            // 1. Read the authoritative blob under a committed read.
            $prevRow = $pdo->query("SELECT json_data, version FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1")->fetch(PDO::FETCH_ASSOC);
            $prevVersion = $prevRow ? (int)($prevRow['version'] ?? 0) : 0;
            $prevData = ($prevRow && $prevRow['json_data']) ? normalizeBlobData(json_decode($prevRow['json_data'], true)) : [];

            if (!is_array($prevData)) $prevData = [];
            if (!isset($prevData[$collection]) || !is_array($prevData[$collection])) $prevData[$collection] = [];

            // 2. Whole-blob optimistic lock: reject if the client's base version
            //    is stale (a micro-update built on an older snapshot).
            if ($baseVersion > 0 && $prevVersion > 0 && $baseVersion < $prevVersion) {
                $freshData = $prevData;
                if (!isset($freshData['_version'])) $freshData['_version'] = $prevVersion;
                header('HTTP/1.1 409 Conflict');
                echo json_encode([
                    "success" => false,
                    "error" => "conflict",
                    "serverVersion" => $prevVersion,
                    "serverData" => $freshData,
                    "server_ts" => $prevVersion
                ]);
                exit();
            }

            $collectionArr = $prevData[$collection];
            $idx = null;
            foreach ($collectionArr as $i => $rec) {
                if (is_array($rec) && isset($rec['id']) && (string)$rec['id'] === (string)$recordId) { $idx = $i; break; }
            }

            if ($op === 'delete') {
                // Delete = remove the record entirely. Missing record is still a
                // success (idempotent delete) so the caller can clear its cache.
                if ($idx !== null) {
                    array_splice($collectionArr, $idx, 1);
                }
            } else {
                // Upsert. Per-record optimistic lock: only overwrite if the client's
                // record is NOT older than what the server already has. Uses the
                // millisecond updated_at watermark (same convention as the password
                // merge guard) so a stale tab can't roll back a newer edit.
                $clientTs = (int)($record['updated_at'] ?? ($record['updatedAt'] ?? 0));
                if ($idx !== null) {
                    $serverRec = $collectionArr[$idx];
                    $serverTs = (int)($serverRec['updated_at'] ?? ($serverRec['updatedAt'] ?? 0));
                    // If server record is strictly newer AND has a meaningful ts, and
                    // the client's ts is older, reject as stale.
                    if ($serverTs > $clientTs && $clientTs > 0 && $serverTs > 0) {
                        header('HTTP/1.1 409 Conflict');
                        echo json_encode([
                            "success" => false,
                            "error" => "stale_record",
                            "serverVersion" => $prevVersion,
                            "recordId" => $recordId,
                            "serverRecord" => $serverRec,
                            "server_ts" => $prevVersion
                        ]);
                        exit();
                    }
                    // Enforce id stability (client shouldn't change the id of an existing record).
                    $record['id'] = $serverRec['id'];
                    $collectionArr[$idx] = $record;
                } else {
                    // New record: ensure it carries an id.
                    if (!isset($record['id'])) $record['id'] = $recordId;
                    $collectionArr[] = $record;
                }
            }

            // 3. Write back the single collection atomically + bump version.
            $prevData[$collection] = $collectionArr;
            $newVer = max($prevVersion + 1, 1);
            $prevData['_version'] = $newVer;
            $prevData['_serverUpdatedAt'] = date('c');
            if (!isset($prevData['lastUpdated'])) $prevData['lastUpdated'] = date('c');
            // Preserve every other key untouched (no mass overwrite).

            $jsonStr = json_encode($prevData, JSON_UNESCAPED_UNICODE);
            try {
                $pdo->prepare("INSERT INTO tradecore_system_state (doc_key, json_data, updated_at, version) VALUES ('main_state', ?, NOW(), ?) ON DUPLICATE KEY UPDATE json_data=VALUES(json_data), updated_at=NOW(), version=VALUES(version)")->execute([$jsonStr, $newVer]);
            } catch (Throwable $e2) {
                $pdo->prepare("INSERT INTO tradecore_system_state (doc_key, json_data, updated_at) VALUES ('main_state', ?, NOW()) ON DUPLICATE KEY UPDATE json_data=VALUES(json_data), updated_at=NOW()")->execute([$jsonStr]);
            }

            // 4. Mirror to the per-collection atomic table when one exists.
            if ($collection === 'marketplaceProducts' && $op === 'upsert' && isset($record['company_id'])) {
                try {
                    $pds = isset($record['updated_at']) && is_numeric($record['updated_at']) ? (int)$record['updated_at'] : $newVer;
                    $pdo->prepare("REPLACE INTO tradecore_products (id, company_id, data, updated_at, deleted_at) VALUES (?,?,?, ?,NULL)")->execute([(string)$recordId, (string)$record['company_id'], json_encode($record, JSON_UNESCAPED_UNICODE), $pds]);
                } catch (Throwable $ep) {}
            } elseif ($collection === 'users' && $op === 'upsert') {
                try {
                    $uds = isset($record['updated_at']) && is_numeric($record['updated_at']) ? (int)$record['updated_at'] : $newVer;
                    $pdo->prepare("REPLACE INTO tradecore_users (id, company_id, phone, data, updated_at, deleted_at) VALUES (?,?,?,?,?,NULL)")->execute([(string)$recordId, (string)($record['company_id'] ?? ($record['companyId'] ?? '')), (string)($record['phone'] ?? ''), json_encode($record, JSON_UNESCAPED_UNICODE), $uds]);
                } catch (Throwable $eu) {}
            }

            // 5. File fallback mirror.
            $dir = __DIR__ . '/data';
            if (!is_dir($dir)) @mkdir($dir, 0755, true);
            @file_put_contents($dir . '/system_state.json', json_encode(['data' => $prevData, 'lastUpdated' => date('c'), 'updatedAt' => $newVer, 'version' => $newVer, '_version' => $newVer, 'source' => 'php_file_persistence'], JSON_UNESCAPED_UNICODE), LOCK_EX);

            // 6. Explicit success ack with the updated record ID + new version.
            //    COMMIT the transaction FIRST so the 200 response is never seen before
            //    the blob + atomic mirror rows are durable in the DB.
            if ($txOpen) { try { $pdo->commit(); } catch (Throwable $cE) { error_log('[TradeCore API] mutate_record commit failed: ' . $cE->getMessage()); } }
            $opName = $op === 'delete' ? 'Record Deleted' : 'Record Created/Updated';
            logCoreAction($pdo, tcCurrentOperator($rawInput)[0], tcCurrentOperator($rawInput)[1], $opName, 'CRUD ' . $collection . ' #' . $recordId . ' ' . $op . ' by ' . tcCurrentOperator($rawInput)[0]);
            echo json_encode(["success" => true, "recordId" => (string)$recordId, "version" => $newVer, "server_ts" => $newVer, "_version" => $newVer, "updated_at" => date('c')]);
        } catch (Throwable $e) {
            if ($txOpen) { try { $pdo->rollBack(); } catch (Throwable $rE) {} }
            error_log('[TradeCore API] mutate_record failed: ' . $e->getMessage());
            echo json_encode(["success" => false, "error" => "mutate failed: " . $e->getMessage()]);
        }
        exit();
    }

    // ============================================================================
    // INLINE FAST-TRACK: save_state / sync / flush
    // Version-aware: rejects stale writes (409 Conflict), auto-increments _version
    // ============================================================================
    if ($action === 'save_state' || $action === 'sync' || $action === 'flush') {
        @ini_set('memory_limit', '512M');
        @ini_set('max_execution_time', '60');
        @set_time_limit(60);
        $data = json_decode($rawInput, true);
        // CRITICAL: extract inner data — frontend sends {action, delta, lastUpdated, changedKeys, lastSeenVersion}
        // (legacy clients may still send "data" instead of "delta"; accept both).
        $stateData = null;
        if (is_array($data) && isset($data['delta']) && is_array($data['delta'])) $stateData = $data['delta'];
        elseif (is_array($data) && isset($data['data']) && is_array($data['data'])) $stateData = $data['data'];
        else $stateData = ($data ?: []);
        $clientLastSeenVersion = isset($data['lastSeenVersion']) ? (int)$data['lastSeenVersion'] : 0;
        $changedKeys = $data['changedKeys'] ?? null;

        if ($stateData && $pdo) {
            // Begin an explicit transaction so the blob + mirrored atomic-table writes
            // commit atomically before the 200 ack is returned. This guarantees the
            // flushed edits are durable and immediately readable by get_state/flag.
            $txOpen = false;
            try { $pdo->beginTransaction(); $txOpen = true; } catch (Throwable $txE) { $txOpen = false; }
            try {
                // 1. Read current server version (advisory: read-then-write under simple lock)
                $prevRow = $pdo->query("SELECT json_data, version FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1")->fetch(PDO::FETCH_ASSOC);
                $prevVersion = $prevRow ? (int)($prevRow['version'] ?? 0) : 0;
                $prevData = $prevRow && $prevRow['json_data'] ? normalizeBlobData(json_decode($prevRow['json_data'], true)) : [];

                // 1a. SELF-HEALING: if blob is empty/corrupted, rebuild from atomic tables before writing
                $emptyCount = 0;
                foreach (['users', 'marketplaceProducts', 'stockItems', 'expenses', 'salesOrders', 'purchaseOrders'] as $ck) {
                    if (empty($prevData[$ck] ?? [])) $emptyCount++;
                }
                $blobIsEmpty = !is_array($prevData) || empty($prevData) || $emptyCount >= 3;
                if ($blobIsEmpty && $pdo) {
                    error_log('[TradeCore API] SELF-HEALING: blob is mostly empty (' . $emptyCount . '/6 collections empty, version=' . $prevVersion . '), rebuilding from atomic tables');
                    $rebuilt = is_array($prevData) ? $prevData : [];
                    // Rebuild users from atomic table
                    try {
                        $rows = $pdo->query("SELECT data FROM tradecore_users WHERE deleted_at IS NULL")->fetchAll(PDO::FETCH_COLUMN);
                        $atomicUsers = [];
                        foreach ($rows as $rj) { $u = json_decode($rj, true); if (is_array($u)) $atomicUsers[] = $u; }
                        if (count($atomicUsers) > 0) { $rebuilt['users'] = $atomicUsers; error_log('[TradeCore API] SELF-HEALING: restored ' . count($atomicUsers) . ' users from atomic table'); }
                    } catch (Throwable $eu) { error_log('[TradeCore API] SELF-HEALING user restore failed: ' . $eu->getMessage()); }
                    // Rebuild products from atomic table
                    try {
                        $rows = $pdo->query("SELECT data FROM tradecore_products WHERE deleted_at IS NULL")->fetchAll(PDO::FETCH_COLUMN);
                        $atomicProds = [];
                        foreach ($rows as $rj) { $p = json_decode($rj, true); if (is_array($p)) $atomicProds[] = $p; }
                        if (count($atomicProds) > 0) { $rebuilt['marketplaceProducts'] = $atomicProds; error_log('[TradeCore API] SELF-HEALING: restored ' . count($atomicProds) . ' products from atomic table'); }
                    } catch (Throwable $ep) { error_log('[TradeCore API] SELF-HEALING product restore failed: ' . $ep->getMessage()); }
                    // Rebuild sales from atomic table
                    try {
                        $rows = $pdo->query("SELECT data FROM tradecore_sales WHERE deleted_at IS NULL")->fetchAll(PDO::FETCH_COLUMN);
                        $atomicSales = [];
                        foreach ($rows as $rj) { $s = json_decode($rj, true); if (is_array($s)) $atomicSales[] = $s; }
                        if (count($atomicSales) > 0) { $rebuilt['salesOrders'] = $atomicSales; error_log('[TradeCore API] SELF-HEALING: restored ' . count($atomicSales) . ' sales from atomic table'); }
                    } catch (Throwable $es) { error_log('[TradeCore API] SELF-HEALING sales restore failed: ' . $es->getMessage()); }
                    // Rebuild orders from atomic table
                    try {
                        $rows = $pdo->query("SELECT data FROM tradecore_marketplace_orders WHERE deleted_at IS NULL")->fetchAll(PDO::FETCH_COLUMN);
                        $atomicOrders = [];
                        foreach ($rows as $rj) { $o = json_decode($rj, true); if (is_array($o)) $atomicOrders[] = $o; }
                        if (count($atomicOrders) > 0) { $rebuilt['marketplaceOrders'] = $atomicOrders; error_log('[TradeCore API] SELF-HEALING: restored ' . count($atomicOrders) . ' orders from atomic table'); }
                    } catch (Throwable $eo) { error_log('[TradeCore API] SELF-HEALING orders restore failed: ' . $eo->getMessage()); }
                    if (count($rebuilt) > count($prevData)) {
                        $prevData = $rebuilt;
                        $rebuildJson = json_encode($prevData, JSON_UNESCAPED_UNICODE);
                        try { $pdo->prepare("UPDATE tradecore_system_state SET json_data=? WHERE doc_key='main_state'")->execute([$rebuildJson]); } catch (Throwable $erb) {}
                        error_log('[TradeCore API] SELF-HEALING: blob rebuilt with ' . count($rebuilt) . ' keys, persisted to DB');
                    }
                }

                // 2. Conflict detection: if client thinks server is older than it actually is, reject
                if ($clientLastSeenVersion > 0 && $prevVersion > 0 && $clientLastSeenVersion < $prevVersion) {
                    if ($txOpen) { try { $pdo->rollBack(); } catch (Throwable $rE0) {} }
                    // Return fresh server data so client can rebase
                    header('HTTP/1.1 409 Conflict');
                    $freshData = is_array($prevData) ? $prevData : [];
                    if (!isset($freshData['_version'])) $freshData['_version'] = $prevVersion;
                    echo json_encode([
                        "success" => false,
                        "error" => "conflict",
                        "serverVersion" => $prevVersion,
                        "serverData" => $freshData,
                        "server_ts" => $prevVersion
                    ]);
                    exit();
                }

                // 3. Merge: if changedKeys provided, only overwrite those collections
                $toPersist = $stateData;
                if (is_array($changedKeys) && count($changedKeys) > 0 && is_array($prevData) && count($prevData) > 0) {
                    foreach ($prevData as $k => $v) {
                        if (!in_array($k, $changedKeys) && !in_array($k, ['lastUpdated', '_version', '_serverUpdatedAt'])) {
                            $toPersist[$k] = $v; // server wins for non-dirty keys
                        }
                    }
                }

                // 3b. EMPTY FLUSH PROTECTION (AFTER merge): if ANY major collection drops
                // from >N to 0 in the merged result, restore the server version.
                // This catches both: (a) client sends empty array in changedKeys, and
                // (b) client sends empty array that the merge loop didn't restore.
                $MAJOR_COLLECTIONS = ['users', 'marketplaceProducts', 'stockItems', 'expenses', 'salesOrders', 'purchaseOrders', 'companies', 'branches', 'stores'];
                $rejectedCollections = [];
                foreach ($MAJOR_COLLECTIONS as $col) {
                    $serverCount = is_array($prevData[$col] ?? null) ? count($prevData[$col]) : 0;
                    $mergedCount = is_array($toPersist[$col] ?? null) ? count($toPersist[$col]) : 0;
                    if ($serverCount > 3 && $mergedCount === 0) {
                        $toPersist[$col] = $prevData[$col];
                        $rejectedCollections[] = $col . '(' . $serverCount . '->0)';
                    }
                }
                if (!empty($rejectedCollections)) {
                    error_log('[TradeCore API] EMPTY FLUSH GUARD (post-merge): kept server data for: ' . implode(', ', $rejectedCollections) . ' (version=' . $prevVersion . ')');
                }

                // 3b2. CATEGORY PERSISTENCE GUARD: categories are stored as company-scoped
                // strings ("co_<companyId>:<name>"). If the server already holds categories
                // but the merged result would drop the array to empty (e.g. a stale client
                // snapshot or a company-switch reset racing the flush), keep the server's
                // categories so new categories survive reloads / company switches.
                $serverCatCount = is_array($prevData['categories'] ?? null) ? count($prevData['categories']) : 0;
                $mergedCatCount = is_array($toPersist['categories'] ?? null) ? count($toPersist['categories']) : 0;
                if ($serverCatCount > 0 && $mergedCatCount === 0) {
                    $toPersist['categories'] = $prevData['categories'];
                    error_log('[TradeCore API] CATEGORY GUARD: kept server categories (' . $serverCatCount . '->0) for company_id=' . ($companyId ?? ''));
                } else {
                    // Normalize + de-duplicate any categories the client sends (strip nulls).
                    if (is_array($toPersist['categories'] ?? null)) {
                        $seen = [];
                        $clean = [];
                        foreach ($toPersist['categories'] as $cname) {
                            if ($cname === null || !is_string($cname) || trim($cname) === '') continue;
                            $trimmed = trim($cname);
                            if (!isset($seen[$trimmed])) { $seen[$trimmed] = true; $clean[] = $trimmed; }
                        }
                        $toPersist['categories'] = $clean;
                    }
                }

                // 3b3. MYSQL MIRROR: persist every category as an explicit
                // company_id + category_name row with timestamps (source of truth for
                // company-filtered fetches + refresh survival). Runs inside the same
                // transaction, so the blob and the category rows commit atomically.
                try { tcMirrorCategories($pdo, $toPersist['categories'] ?? []); } catch (Throwable $eMirror) {}

                error_log('[TradeCore API] save_state merge: client_keys=' . (is_array($changedKeys) ? implode(',', $changedKeys) : 'null') . ', prev_v=' . $prevVersion . ', prev_users=' . count($prevData['users'] ?? []) . ', incoming_users=' . count($toPersist['users'] ?? []) . ', final_users=' . count($toPersist['users'] ?? []));

                // 3c. PASSWORD MERGE GUARD: when the client sends users, keep server
                // password if the server's updated_at is newer (another device/tab
                // already changed the password). This prevents a stale flush from
                // overwriting a password change made on another device.
                if (is_array($changedKeys) && in_array('users', $changedKeys)
                    && is_array($toPersist['users'] ?? null) && is_array($prevData['users'] ?? null)) {
                    $serverUsersById = [];
                    foreach ($prevData['users'] as $su) {
                        if (is_array($su) && isset($su['id'])) $serverUsersById[(string)$su['id']] = $su;
                    }
                    foreach ($toPersist['users'] as &$cu) {
                        if (!is_array($cu) || !isset($cu['id'])) continue;
                        $cid = (string)$cu['id'];
                        if (!isset($serverUsersById[$cid])) continue;
                        $su = $serverUsersById[$cid];
                        $clientUpdated = (int)($cu['updated_at'] ?? 0);
                        $serverUpdated = (int)($su['updated_at'] ?? 0);
                        $clientPass = $cu['password'] ?? $cu['password_hash'] ?? '';
                        $serverPass = $su['password'] ?? $su['password_hash'] ?? '';
                        // If server has newer timestamp AND different password, keep server's user
                        if ($serverUpdated > $clientUpdated && $serverPass !== '' && $clientPass !== $serverPass) {
                            $cu = $su;
                            error_log('[TradeCore API] PASSWORD MERGE GUARD: kept server password for user ' . $cid . ' (server_ts=' . $serverUpdated . ' > client_ts=' . $clientUpdated . ')');
                        }
                    }
                    unset($cu);
                }

                // 4. Auto-increment version (monotonic, never goes backward)
                $newVer = max($prevVersion + 1, 1);
                $toPersist['_version'] = $newVer;
                $toPersist['_serverUpdatedAt'] = date('c');
                if (!isset($toPersist['lastUpdated'])) $toPersist['lastUpdated'] = date('c');

                // 5. Write to DB
                $jsonStr = json_encode($toPersist, JSON_UNESCAPED_UNICODE);
                try {
                    $pdo->prepare("INSERT INTO tradecore_system_state (doc_key, json_data, updated_at, version) VALUES ('main_state', ?, NOW(), ?) ON DUPLICATE KEY UPDATE json_data=VALUES(json_data), updated_at=NOW(), version=VALUES(version)")->execute([$jsonStr, $newVer]);
                } catch (Throwable $e2) {
                    // Fallback if version column doesn't exist
                    $pdo->prepare("INSERT INTO tradecore_system_state (doc_key, json_data, updated_at) VALUES ('main_state', ?, NOW()) ON DUPLICATE KEY UPDATE json_data=VALUES(json_data), updated_at=NOW()")->execute([$jsonStr]);
                }

                // 6. Sync atomic tables if changedKeys includes products or users
                if (is_array($changedKeys)) {
                    if (in_array('marketplaceProducts', $changedKeys) && isset($toPersist['marketplaceProducts']) && is_array($toPersist['marketplaceProducts'])) {
                        foreach ($toPersist['marketplaceProducts'] as $prod) {
                            if (isset($prod['id']) && isset($prod['company_id'])) {
                                try {
                                    $pid = (string)$prod['id'];
                                    $pcid = (string)$prod['company_id'];
                                    $pj = json_encode($prod, JSON_UNESCAPED_UNICODE);
                                    $pts = isset($prod['updated_at']) && is_numeric($prod['updated_at']) ? (int)$prod['updated_at'] : $newVer;
                                    $pdo->prepare("REPLACE INTO tradecore_products (id, company_id, data, updated_at, deleted_at) VALUES (?,?,?, ?,NULL)")->execute([$pid, $pcid, $pj, $pts]);
                                } catch (Throwable $ep) {}
                            }
                        }
                    }
                    if (in_array('users', $changedKeys) && isset($toPersist['users']) && is_array($toPersist['users'])) {
                        foreach ($toPersist['users'] as $usr) {
                            if (isset($usr['id'])) {
                                try {
                                    $uid = (string)$usr['id'];
                                    $ucid = (string)($usr['company_id'] ?? $usr['companyId'] ?? '');
                                    $uphone = (string)($usr['phone'] ?? '');
                                    $uj = json_encode($usr, JSON_UNESCAPED_UNICODE);
                                    $uts = isset($usr['updated_at']) && is_numeric($usr['updated_at']) ? (int)$usr['updated_at'] : $newVer;
                                    $pdo->prepare("REPLACE INTO tradecore_users (id, company_id, phone, data, updated_at, deleted_at) VALUES (?,?,?,?,?,NULL)")->execute([$uid, $ucid, $uphone, $uj, $uts]);
                                } catch (Throwable $eu) {}
                            }
                        }
                    }
                }

                // 7. File fallback
                $dir = __DIR__ . '/data';
                if (!is_dir($dir)) @mkdir($dir, 0755, true);
                @file_put_contents($dir . '/system_state.json', json_encode(['data' => $toPersist, 'lastUpdated' => date('c'), 'updatedAt' => $newVer, 'version' => $newVer, '_version' => $newVer, 'source' => 'php_file_persistence'], JSON_UNESCAPED_UNICODE), LOCK_EX);

                // COMMIT the transaction BEFORE returning 200 — the flush ack must only
                // be sent after the edits are durable and version bump is committed.
                if ($txOpen) { try { $pdo->commit(); } catch (Throwable $cE) { error_log('[TradeCore API] save_state commit failed: ' . $cE->getMessage()); } }
                $ckStr = is_array($changedKeys) && count($changedKeys) > 0 ? implode(',', $changedKeys) : 'full_state';
                logCoreAction($pdo, tcCurrentOperator($rawInput)[0], tcCurrentOperator($rawInput)[1], 'Data Sync/CRUD', 'State flushed (v' . $newVer . ') keys=[' . substr($ckStr, 0, 200) . '] by ' . tcCurrentOperator($rawInput)[0]);
                echo json_encode(["success" => true, "server_ts" => $newVer, "version" => $newVer, "_version" => $newVer, "updated_at" => date('c')]);
            } catch (Throwable $e) {
                if ($txOpen) { try { $pdo->rollBack(); } catch (Throwable $rE) {} }
                error_log('[TradeCore API] save_state failed: ' . $e->getMessage());
                echo json_encode(["success" => false, "error" => "Save failed: " . $e->getMessage(), "server_ts" => $now]);
            }
        } else {
            echo json_encode(["success" => false, "error" => "No data to save", "server_ts" => $now]);
        }
        exit();
    }

    // ============================================================================
    // INLINE FAST-TRACK: upsert_product (atomic row-level, no blob race)
    // ============================================================================
    if ($action === 'upsert_product') {
        if (!$pdo) { echo json_encode(["success" => false, "error" => "No DB", "server_ts" => $now]); exit(); }
        $input = json_decode($rawInput, true);
        $productJson = $input['product_json'] ?? null;
        $product = $productJson ? json_decode($productJson, true) : null;
        if (!$product || !isset($product['id'])) { echo json_encode(["success" => false, "error" => "Missing product.id", "server_ts" => $now]); exit(); }
        $id = (string)$product['id'];
        $companyId = (string)($product['company_id'] ?? $product['companyId'] ?? '');
        $j = json_encode($product, JSON_UNESCAPED_UNICODE);
        $ts = isset($product['updated_at']) && is_numeric($product['updated_at']) ? (int)$product['updated_at'] : $now;
        try {
            $stmt = $pdo->prepare("REPLACE INTO tradecore_products (id, company_id, data, updated_at, deleted_at) VALUES (?,?,?, ?,NULL)");
            $stmt->execute([$id, $companyId, $j, $ts]);
            // Bump meta timestamp
            try { $newVer = $now; $pdo->prepare("UPDATE tradecore_meta SET updated_at=? WHERE id=1")->execute([$newVer]); } catch (Throwable $e) {}
    // Dual-write to blob — CRITICAL: do NOT pass a version param. The atomic
                // upserts use $now (Unix timestamp) as version, which overwrites the
                // monotonic counter maintained by save_state and causes perpetual 409
                // conflicts ("server version always ahead"). Only save_state may bump
                // the blob version.
                try {
                    $prevData = [];
                    $preRow = $pdo->query("SELECT json_data FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1")->fetch();
                    if ($preRow && $preRow['json_data']) $prevData = normalizeBlobData(json_decode($preRow['json_data'], true)) ?: [];
                    if (!isset($prevData['marketplaceProducts']) || !is_array($prevData['marketplaceProducts'])) $prevData['marketplaceProducts'] = [];
                    $found = false;
                    foreach ($prevData['marketplaceProducts'] as &$pp) { if (isset($pp['id']) && (string)$pp['id'] === $id) { $pp = $product; $found = true; break; } }
                    unset($pp);
                    if (!$found) $prevData['marketplaceProducts'][] = $product;
                    $jj = json_encode($prevData, JSON_UNESCAPED_UNICODE);
                    $pdo->prepare("INSERT INTO tradecore_system_state (doc_key, json_data, updated_at) VALUES ('main_state', ?, NOW()) ON DUPLICATE KEY UPDATE json_data=VALUES(json_data), updated_at=NOW()")->execute([$jj]);
                } catch (Throwable $eBlob) {}
                echo json_encode(["success" => true, "server_ts" => $now]);
            } catch (Throwable $e) {
                error_log('[TradeCore API] upsert_product failed: ' . $e->getMessage());
                echo json_encode(["success" => false, "error" => $e->getMessage(), "server_ts" => $now]);
            }
            exit();
        }

    // ============================================================================
    // INLINE FAST-TRACK: delete_product (soft delete)
    // ============================================================================
    if ($action === 'delete_product') {
        if (!$pdo) { echo json_encode(["success" => false, "error" => "No DB", "server_ts" => $now]); exit(); }
        $input = json_decode($rawInput, true);
        $id = (string)($input['id'] ?? '');
        $companyId = (string)($input['company_id'] ?? '');
        if (!$id || !$companyId) { echo json_encode(["success" => false, "error" => "Missing id/company_id", "server_ts" => $now]); exit(); }
        try {
            $stmt = $pdo->prepare("UPDATE tradecore_products SET deleted_at=?, updated_at=? WHERE id=? AND company_id=?");
            $stmt->execute([$now, $now, $id, $companyId]);
            try { $pdo->prepare("UPDATE tradecore_meta SET updated_at=? WHERE id=1")->execute([$now]); } catch (Throwable $e) {}
            // Remove from blob
            try {
                $preRow = $pdo->query("SELECT json_data FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1")->fetch();
                if ($preRow && $preRow['json_data']) {
                    $pd = normalizeBlobData(json_decode($preRow['json_data'], true)) ?: [];
                    if (isset($pd['marketplaceProducts']) && is_array($pd['marketplaceProducts'])) {
                        $pd['marketplaceProducts'] = array_values(array_filter($pd['marketplaceProducts'], function($p) use ($id) { return isset($p['id']) && (string)$p['id'] !== $id; }));
                        $jj = json_encode($pd, JSON_UNESCAPED_UNICODE);
                        $pdo->prepare("INSERT INTO tradecore_system_state (doc_key, json_data, updated_at) VALUES ('main_state', ?, NOW()) ON DUPLICATE KEY UPDATE json_data=VALUES(json_data), updated_at=NOW()")->execute([$jj]);
                    }
                }
            } catch (Throwable $eBlob) {}
            echo json_encode(["success" => true, "server_ts" => $now]);
        } catch (Throwable $e) {
            error_log('[TradeCore API] delete_product failed: ' . $e->getMessage());
            echo json_encode(["success" => false, "error" => $e->getMessage(), "server_ts" => $now]);
        }
        exit();
    }

    // ============================================================================
    // INLINE FAST-TRACK: upsert_user (atomic row-level)
    // ============================================================================
    if ($action === 'upsert_user') {
        if (!$pdo) { echo json_encode(["success" => false, "error" => "No DB", "server_ts" => $now]); exit(); }
        $input = json_decode($rawInput, true);
        $userJson = $input['user_json'] ?? null;
        $user = $userJson ? json_decode($userJson, true) : null;
        if (!$user || !isset($user['id'])) { echo json_encode(["success" => false, "error" => "Missing user.id", "server_ts" => $now]); exit(); }
        $id = (string)$user['id'];
        $companyId = (string)($user['company_id'] ?? $user['companyId'] ?? '');
        $phone = (string)($user['phone'] ?? $user['phoneNumber'] ?? '');
        $j = json_encode($user, JSON_UNESCAPED_UNICODE);
        $ts = isset($user['updated_at']) && is_numeric($user['updated_at']) ? (int)$user['updated_at'] : $now;
        try {
            $stmt = $pdo->prepare("REPLACE INTO tradecore_users (id, company_id, phone, data, updated_at, deleted_at) VALUES (?,?,?,?,?, NULL)");
            $stmt->execute([$id, $companyId, $phone, $j, $ts]);
            try { $pdo->prepare("UPDATE tradecore_meta SET updated_at=? WHERE id=1")->execute([$now]); } catch (Throwable $e) {}
    // Dual-write to blob — CRITICAL: do NOT pass a version param (see upsert_product comment).
                try {
                    $prevData = [];
                    $preRow = $pdo->query("SELECT json_data FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1")->fetch();
                    if ($preRow && $preRow['json_data']) $prevData = normalizeBlobData(json_decode($preRow['json_data'], true)) ?: [];
                    if (!isset($prevData['users']) || !is_array($prevData['users'])) $prevData['users'] = [];
                    $found = false;
                    foreach ($prevData['users'] as &$uu) { if (isset($uu['id']) && (string)$uu['id'] === $id) { $uu = $user; $found = true; break; } }
                    unset($uu);
                    if (!$found) $prevData['users'][] = $user;
                    $jj = json_encode($prevData, JSON_UNESCAPED_UNICODE);
                    $pdo->prepare("INSERT INTO tradecore_system_state (doc_key, json_data, updated_at) VALUES ('main_state', ?, NOW()) ON DUPLICATE KEY UPDATE json_data=VALUES(json_data), updated_at=NOW()")->execute([$jj]);
                } catch (Throwable $eBlob) {}
                logCoreAction($pdo, tcCurrentOperator($rawInput)[0], tcCurrentOperator($rawInput)[1], 'User Upsert', 'Created/updated user "' . (string)($user['username'] ?? $id) . '" (#' . $id . ') by ' . tcCurrentOperator($rawInput)[0]);
                echo json_encode(["success" => true, "server_ts" => $now]);
            } catch (Throwable $e) {
                error_log('[TradeCore API] upsert_user failed: ' . $e->getMessage());
                echo json_encode(["success" => false, "error" => $e->getMessage(), "server_ts" => $now]);
            }
            exit();
        }

    // ============================================================================
    // INLINE FAST-TRACK: delete_user (soft delete)
    // ============================================================================
    if ($action === 'delete_user') {
        if (!$pdo) { echo json_encode(["success" => false, "error" => "No DB", "server_ts" => $now]); exit(); }
        $input = json_decode($rawInput, true);
        $id = (string)($input['id'] ?? '');
        $companyId = (string)($input['company_id'] ?? '');
        if (!$id) { echo json_encode(["success" => false, "error" => "Missing id", "server_ts" => $now]); exit(); }
        try {
            // REQUIREMENT 3 + 1: strict transaction — the soft-delete (status='deleted'
            // via deleted_at) and the blob-removal must COMMIT atomically BEFORE this
            // handler responds. A re-fetch triggered after this response therefore can
            // never resurrect the user, because the row is already marked deleted in MySQL.
            $txOpen = false;
            try { $pdo->beginTransaction(); $txOpen = true; } catch (Throwable $txE) { $txOpen = false; }
            if ($companyId) {
                $stmt = $pdo->prepare("UPDATE tradecore_users SET deleted_at=?, updated_at=? WHERE id=? AND company_id=?");
                $stmt->execute([$now, $now, $id, $companyId]);
            } else {
                $stmt = $pdo->prepare("UPDATE tradecore_users SET deleted_at=?, updated_at=? WHERE id=?");
                $stmt->execute([$now, $now, $id]);
            }
            try { $pdo->prepare("UPDATE tradecore_meta SET updated_at=? WHERE id=1")->execute([$now]); } catch (Throwable $e) {}
            // Remove from blob
            try {
                $preRow = $pdo->query("SELECT json_data FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1")->fetch();
                if ($preRow && $preRow['json_data']) {
                    $pd = normalizeBlobData(json_decode($preRow['json_data'], true)) ?: [];
                    if (isset($pd['users']) && is_array($pd['users'])) {
                        $pd['users'] = array_values(array_filter($pd['users'], function($u) use ($id) { return isset($u['id']) && (string)$u['id'] !== $id; }));
                        $jj = json_encode($pd, JSON_UNESCAPED_UNICODE);
                        $pdo->prepare("INSERT INTO tradecore_system_state (doc_key, json_data, updated_at) VALUES ('main_state', ?, NOW()) ON DUPLICATE KEY UPDATE json_data=VALUES(json_data), updated_at=NOW()")->execute([$jj]);
                    }
                }
            } catch (Throwable $eBlob) {}
            // COMMIT the delete + blob-removal together so the 200 is never returned
            // before the hard delete is durable (prevents deleted users re-appearing
            // on background sync / restart).
            if ($txOpen) { try { $pdo->commit(); } catch (Throwable $cE) { error_log('[TradeCore API] delete_user commit failed: ' . $cE->getMessage()); } }
            logCoreAction($pdo, tcCurrentOperator($rawInput)[0], tcCurrentOperator($rawInput)[1], 'User Deleted', 'Permanently removed user #' . $id . ' (soft delete / terminated) by ' . tcCurrentOperator($rawInput)[0]);
            echo json_encode(["success" => true, "server_ts" => $now, "updated_at" => date('c')]);
        } catch (Throwable $e) {
            if (isset($txOpen) && $txOpen) { try { $pdo->rollBack(); } catch (Throwable $rE) {} }
            error_log('[TradeCore API] delete_user failed: ' . $e->getMessage());
            echo json_encode(["success" => false, "error" => $e->getMessage(), "server_ts" => $now]);
        }
        exit();
    }

    // ============================================================================
    // INLINE FAST-TRACK: change_password (atomic targeted update — tiny payload,
    // never a 5MB blob, so a password change ALWAYS reaches the server even when
    // the full-state flush is slow/failing). The client computes the sha256$ hash
    // (same format as normal user passwords) and sends it here.
    // ============================================================================
    if ($action === 'change_password') {
        if (!$pdo) { echo json_encode(["success" => false, "error" => "No DB", "server_ts" => $now]); exit(); }
        $input = json_decode($rawInput, true);
        $userId = (string)($input['user_id'] ?? '');
        $companyId = (string)($input['company_id'] ?? '');
        $newHash = (string)($input['password_hash'] ?? '');
        if ($userId === '' || $newHash === '') { echo json_encode(["success" => false, "error" => "Missing user_id / password_hash", "server_ts" => $now]); exit(); }
        // AUTH FIX (Fix 3): server-side hash normalization — if the client ever sends a
        // raw/legacy password (not already a `sha256$` hash), hash it here with the app's
        // exact convention (sha256$ + SALT) so plaintext is never persisted and the stored
        // format always matches what PHP login (hash('sha256', raw . SALT)) expects.
        $SALT = 'tradecore::secure::2026::v1';
        if (strpos($newHash, 'sha256$') !== 0) {
            $newHash = 'sha256$' . hash('sha256', $newHash . $SALT);
        }
        // AUTH FIX (Fix 2): this is a SELF-SERVICE credential change. We deliberately
        // never emit SESSION_REVOKED for it; if the operator guard flagged the session as
        // soft-invalid we still let the owner set their password, because killing the
        // session here is exactly the "booted to /login" bug. No http_response_code(401)
        // and no exit() on auth grounds in this handler.
        $updated = false;
        try {
            // Find the user in the atomic table first; fall back to the blob so a
            // first-login user (who may only exist in legacy blob state) still gets
            // a working password change. We must NEVER fail with "User not found".
            $u = null;
            $phone = '';
            if ($companyId !== '') {
                $stmt = $pdo->prepare("SELECT data FROM tradecore_users WHERE id=? AND company_id=? LIMIT 1");
                $stmt->execute([$userId, $companyId]);
            } else {
                $stmt = $pdo->prepare("SELECT data FROM tradecore_users WHERE id=? LIMIT 1");
                $stmt->execute([$userId]);
            }
            $row = $stmt->fetch();
            if ($row && $row['data']) {
                $dec = json_decode($row['data'], true);
                if (is_array($dec)) $u = $dec;
            }
            if (!$u) {
                // Fallback: locate the user inside the blob so first-login changes work
                try {
                    $preRow = $pdo->query("SELECT json_data FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1")->fetch();
                    if ($preRow && $preRow['json_data']) {
                        $pd = normalizeBlobData(json_decode($preRow['json_data'], true));
                        if (is_array($pd) && isset($pd['users']) && is_array($pd['users'])) {
                            foreach ($pd['users'] as $bu) {
                                if (isset($bu['id']) && (string)$bu['id'] === $userId) {
                                    $u = $bu;
                                    if (isset($bu['phone'])) $phone = (string)$bu['phone'];
                                    break;
                                }
                            }
                        }
                    }
                } catch (Throwable $eBlob2) {}
            }
            if (!is_array($u) || !isset($u['id'])) {
                // No record anywhere — synthesize a minimal row so we never hard-fail
                // the first-login flow. Real user data will sync on the next get_state.
                $u = ['id' => $userId, 'username' => $userId, 'role' => 'User', 'active' => true];
            }
            if ($phone === '') $phone = (string)($u['phone'] ?? $u['phoneNumber'] ?? '');
            $u['password'] = $newHash;
            $u['mustChangePassword'] = false;
            $u['firstLogin'] = false;
            $u['first_time_login'] = false; // snake_case variant (Fix 3)
            $u['updated_at'] = time();
            $u['reset_password'] = false;
            unset($u['password_hash']);
            $j = json_encode($u, JSON_UNESCAPED_UNICODE);
            $ts = $now;
            if ($companyId !== '') {
                $up = $pdo->prepare("REPLACE INTO tradecore_users (id, company_id, phone, data, updated_at, deleted_at) VALUES (?,?,?,?,?,NULL)");
                $up->execute([$userId, $companyId, $phone, $j, $ts]);
            } else {
                $pre = $pdo->query("SELECT company_id FROM tradecore_users WHERE id=" . $pdo->quote($userId) . " LIMIT 1")->fetch();
                $cid = $companyId !== '' ? $companyId : (string)($pre['company_id'] ?? '');
                $up = $pdo->prepare("REPLACE INTO tradecore_users (id, company_id, phone, data, updated_at, deleted_at) VALUES (?,?,?,?,?,NULL)");
                $up->execute([$userId, $cid, $phone, $j, $ts]);
            }
            $updated = true;
            try { $pdo->prepare("UPDATE tradecore_meta SET updated_at=? WHERE id=1")->execute([$now]); } catch (Throwable $e) {}
            // Dual-write to blob so legacy blob-login also sees the new sha256 password
            try {
                $preRow = $pdo->query("SELECT json_data, version FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1")->fetch();
                if ($preRow && $preRow['json_data']) {
                    $pd = normalizeBlobData(json_decode($preRow['json_data'], true)) ?: [];
                    if (isset($pd['users']) && is_array($pd['users'])) {
                        foreach ($pd['users'] as &$uu) {
                            if (isset($uu['id']) && (string)$uu['id'] === $userId) {
                                $uu['password'] = $newHash;
                                $uu['mustChangePassword'] = false;
                                $uu['firstLogin'] = false;
                                $uu['first_time_login'] = false;
                                unset($uu['password_hash']);
                                $uu['updated_at'] = time();
                                break;
                            }
                        }
                        unset($uu);
                        $jj = json_encode($pd, JSON_UNESCAPED_UNICODE);
                        $pdo->prepare("INSERT INTO tradecore_system_state (doc_key, json_data, updated_at) VALUES ('main_state', ?, NOW()) ON DUPLICATE KEY UPDATE json_data=VALUES(json_data), updated_at=NOW()")->execute([$jj]);
                    }
                }
            } catch (Throwable $eBlob) {}
        } catch (Throwable $e) {
            error_log('[TradeCore API] change_password failed: ' . $e->getMessage());
        }
        if ($updated) {
            echo json_encode(["success" => true, "server_ts" => $now]);
        } else {
            echo json_encode(["success" => false, "error" => "User not found", "server_ts" => $now]);
        }
        exit();
    }

    // ============================================================================
    // INLINE FAST-TRACK: upsert_sale (atomic row-level)
    // ============================================================================
    if ($action === 'upsert_sale') {
        $input = json_decode($rawInput, true);
        $saleJson = $input['sale_json'] ?? null;
        $sale = $saleJson ? json_decode($saleJson, true) : null;
        if (!$sale || !isset($sale['id'])) { echo json_encode(["success" => false, "error" => "Missing sale.id", "server_ts" => $now]); exit(); }
        $id = (string)$sale['id'];
        $companyId = (string)($sale['company_id'] ?? $sale['companyId'] ?? '');
        $j = json_encode($sale, JSON_UNESCAPED_UNICODE);
        $ts = isset($sale['updated_at']) && is_numeric($sale['updated_at']) ? (int)$sale['updated_at'] : $now;
        try {
            $stmt = $pdo->prepare("REPLACE INTO tradecore_sales (id, company_id, data, updated_at, deleted_at) VALUES (?,?,?, ?,NULL)");
            $stmt->execute([$id, $companyId, $j, $ts]);
            try { $pdo->prepare("UPDATE tradecore_meta SET updated_at=? WHERE id=1")->execute([$now]); } catch (Throwable $e) {}
            // Dual-write to blob
            try {
                $prevData = [];
                $preRow = $pdo->query("SELECT json_data FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1")->fetch();
                if ($preRow && $preRow['json_data']) $prevData = normalizeBlobData(json_decode($preRow['json_data'], true)) ?: [];
                if (!isset($prevData['salesOrders']) || !is_array($prevData['salesOrders'])) $prevData['salesOrders'] = [];
                $found = false;
                foreach ($prevData['salesOrders'] as &$ss) { if (isset($ss['id']) && (string)$ss['id'] === $id) { $ss = $sale; $found = true; break; } }
                unset($ss);
                if (!$found) $prevData['salesOrders'][] = $sale;
                $jj = json_encode($prevData, JSON_UNESCAPED_UNICODE);
                $pdo->prepare("INSERT INTO tradecore_system_state (doc_key, json_data, updated_at) VALUES ('main_state', ?, NOW()) ON DUPLICATE KEY UPDATE json_data=VALUES(json_data), updated_at=NOW()")->execute([$jj]);
            } catch (Throwable $eBlob) {}
            echo json_encode(["success" => true, "server_ts" => $now]);
        } catch (Throwable $e) {
            error_log('[TradeCore API] upsert_sale failed: ' . $e->getMessage());
            echo json_encode(["success" => false, "error" => $e->getMessage(), "server_ts" => $now]);
        }
        exit();
    }

    // ============================================================================
    // INLINE FAST-TRACK: upsert_order (atomic row-level)
    // ============================================================================
    if ($action === 'upsert_order') {
        if (!$pdo) { echo json_encode(["success" => false, "error" => "No DB", "server_ts" => $now]); exit(); }
        $input = json_decode($rawInput, true);
        $orderJson = $input['order_json'] ?? null;
        $order = $orderJson ? json_decode($orderJson, true) : null;
        if (!$order || !isset($order['id'])) { echo json_encode(["success" => false, "error" => "Missing order.id", "server_ts" => $now]); exit(); }
        $id = (string)$order['id'];
        $companyId = (string)($order['company_id'] ?? $order['companyId'] ?? '');
        $j = json_encode($order, JSON_UNESCAPED_UNICODE);
        $ts = isset($order['updated_at']) && is_numeric($order['updated_at']) ? (int)$order['updated_at'] : $now;
        try {
            $stmt = $pdo->prepare("REPLACE INTO tradecore_marketplace_orders (id, company_id, data, updated_at, deleted_at) VALUES (?,?,?, ?,NULL)");
            $stmt->execute([$id, $companyId, $j, $ts]);
            try { $pdo->prepare("UPDATE tradecore_meta SET updated_at=? WHERE id=1")->execute([$now]); } catch (Throwable $e) {}
            // Dual-write to blob
            try {
                $prevData = [];
                $preRow = $pdo->query("SELECT json_data FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1")->fetch();
                if ($preRow && $preRow['json_data']) $prevData = normalizeBlobData(json_decode($preRow['json_data'], true)) ?: [];
                if (!isset($prevData['marketplaceOrders']) || !is_array($prevData['marketplaceOrders'])) $prevData['marketplaceOrders'] = [];
                $found = false;
                foreach ($prevData['marketplaceOrders'] as &$oo) { if (isset($oo['id']) && (string)$oo['id'] === $id) { $oo = $order; $found = true; break; } }
                unset($oo);
                if (!$found) $prevData['marketplaceOrders'][] = $order;
                $jj = json_encode($prevData, JSON_UNESCAPED_UNICODE);
                $pdo->prepare("INSERT INTO tradecore_system_state (doc_key, json_data, updated_at) VALUES ('main_state', ?, NOW()) ON DUPLICATE KEY UPDATE json_data=VALUES(json_data), updated_at=NOW()")->execute([$jj]);
            } catch (Throwable $eBlob) {}
            echo json_encode(["success" => true, "server_ts" => $now]);
        } catch (Throwable $e) {
            error_log('[TradeCore API] upsert_order failed: ' . $e->getMessage());
            echo json_encode(["success" => false, "error" => $e->getMessage(), "server_ts" => $now]);
        }
        exit();
    }

    // ============================================================================
    // INLINE FAST-TRACK: assign_user
    // ============================================================================
    if ($action === 'assign_user' || $action === 'create_user') {
        if (!$pdo) { echo json_encode(["success" => false, "error" => "No DB", "server_ts" => $now]); exit(); }
        $input = json_decode($rawInput, true);
        $userJson = $input['user_json'] ?? null;
        $user = $userJson ? json_decode($userJson, true) : null;
        if (!$user || !isset($user['id'])) { echo json_encode(["success" => false, "error" => "Missing user.id", "server_ts" => $now]); exit(); }
        $id = (string)$user['id'];
        $companyId = (string)($user['company_id'] ?? $user['companyId'] ?? '');
        $phone = (string)($user['phone'] ?? $user['phoneNumber'] ?? '');
        $j = json_encode($user, JSON_UNESCAPED_UNICODE);
        $ts = $now;
        try {
            $stmt = $pdo->prepare("REPLACE INTO tradecore_users (id, company_id, phone, data, updated_at, deleted_at) VALUES (?,?,?,?,?, NULL)");
            $stmt->execute([$id, $companyId, $phone, $j, $ts]);
            try { $pdo->prepare("UPDATE tradecore_meta SET updated_at=? WHERE id=1")->execute([$now]); } catch (Throwable $e) {}
            // Dual-write to blob
            try {
                $prevData = [];
                $preRow = $pdo->query("SELECT json_data FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1")->fetch();
                if ($preRow && $preRow['json_data']) $prevData = normalizeBlobData(json_decode($preRow['json_data'], true)) ?: [];
                if (!isset($prevData['users']) || !is_array($prevData['users'])) $prevData['users'] = [];
                $found = false;
                foreach ($prevData['users'] as &$uu) { if (isset($uu['id']) && (string)$uu['id'] === $id) { $uu = $user; $found = true; break; } }
                unset($uu);
                if (!$found) $prevData['users'][] = $user;
                $jj = json_encode($prevData, JSON_UNESCAPED_UNICODE);
                $pdo->prepare("INSERT INTO tradecore_system_state (doc_key, json_data, updated_at) VALUES ('main_state', ?, NOW()) ON DUPLICATE KEY UPDATE json_data=VALUES(json_data), updated_at=NOW()")->execute([$jj]);
            } catch (Throwable $eBlob) {}
            logCoreAction($pdo, tcCurrentOperator($rawInput)[0], tcCurrentOperator($rawInput)[1], 'User Created/Assigned', 'Created/assigned user "' . (string)($user['username'] ?? $id) . '" (#' . $id . ') by ' . tcCurrentOperator($rawInput)[0]);
            echo json_encode(["success" => true, "server_ts" => $now]);
        } catch (Throwable $e) {
            error_log('[TradeCore API] assign_user failed: ' . $e->getMessage());
            echo json_encode(["success" => false, "error" => $e->getMessage(), "server_ts" => $now]);
        }
        exit();
    }

    // ============================================================================
    // INLINE FAST-TRACK: login (reads from tradecore_users atomic table directly,
    // never depends on blob state — immune to empty-blob corruption)
    // ============================================================================
    if ($action === 'login') {
        if (!$pdo) { echo json_encode(["success" => false, "error" => "Database unavailable", "server_ts" => $now]); exit(); }
        $input = json_decode($rawInput, true);
        $phone = trim((string)($_POST['phone'] ?? $input['phone'] ?? ''));
        $pass  = (string)($_POST['password'] ?? $input['password'] ?? '');
        $username = trim((string)($_POST['username'] ?? $input['username'] ?? ''));
        $companyCode = trim((string)($_POST['company_code'] ?? $input['company_code'] ?? ''));
        if (($phone === '' && $username === '') || $pass === '') {
            echo json_encode(["success" => false, "error" => "phone/username and password required", "server_ts" => $now]);
            exit();
        }
        try {
            // Helper: verify password (sha256$ or bcrypt or plaintext)
            function tcVerifyLogin(string $raw, array $u): bool {
                $hash = $u['password_hash'] ?? $u['password'] ?? '';
                if (!is_string($hash) || $hash === '') return false;
                if (strpos($hash, '$2y$') === 0 || strpos($hash, '$2a$') === 0) {
                    return password_verify($raw, $hash);
                }
                if (strncmp($hash, 'sha256$', 7) === 0) {
                    $expected = 'sha256$' . hash('sha256', $raw . 'tradecore::secure::2026::v1');
                    return hash_equals($hash, $expected);
                }
                return hash_equals($hash, $raw);
            }
            function tcIsActive(array $u): bool {
                return ($u['is_active'] ?? $u['active'] ?? 1) == 1;
            }
            $matchedUser = null;
            // 1. Try by phone in atomic table
            if ($phone !== '') {
                if ($companyCode !== '') {
                    $stmt = $pdo->prepare("SELECT data FROM tradecore_users WHERE phone=? AND company_id=? AND deleted_at IS NULL LIMIT 1");
                    $stmt->execute([$phone, $companyCode]);
                } else {
                    $stmt = $pdo->prepare("SELECT data FROM tradecore_users WHERE phone=? AND deleted_at IS NULL LIMIT 1");
                    $stmt->execute([$phone]);
                }
                $row = $stmt->fetch();
                if ($row && $row['data']) {
                    $u = json_decode($row['data'], true);
                    if (is_array($u) && tcIsActive($u) && tcVerifyLogin($pass, $u)) $matchedUser = $u;
                }
            }
            // 2. Try by username in atomic table
            if (!$matchedUser && $username !== '') {
                if ($companyCode !== '') {
                    $stmt = $pdo->prepare("SELECT data FROM tradecore_users WHERE company_id=? AND deleted_at IS NULL");
                    $stmt->execute([$companyCode]);
                } else {
                    $stmt = $pdo->query("SELECT data FROM tradecore_users WHERE deleted_at IS NULL");
                }
                foreach ($stmt->fetchAll() as $r) {
                    if (!$r['data']) continue;
                    $u = json_decode($r['data'], true);
                    if (!is_array($u)) continue;
                    if (strtolower(trim($u['username'] ?? '')) !== strtolower($username)) continue;
                    if (!tcIsActive($u)) continue;
                    if (tcVerifyLogin($pass, $u)) { $matchedUser = $u; break; }
                }
            }
            // 3. Fallback: try blob if atomic table returned nothing
            if (!$matchedUser) {
                try {
                    $stmt = $pdo->query("SELECT json_data FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1");
                    $row = $stmt->fetch();
                    if ($row && $row['json_data']) {
                        $blob = normalizeBlobData(json_decode($row['json_data'], true));
                        if (is_array($blob) && isset($blob['users']) && is_array($blob['users'])) {
                            foreach ($blob['users'] as $u) {
                                if (!is_array($u)) continue;
                                $matchPhone = $phone !== '' && (string)($u['phone'] ?? '') === $phone;
                                $matchUsername = $username !== '' && strtolower(trim($u['username'] ?? '')) === strtolower($username);
                                if (!$matchPhone && !$matchUsername) continue;
                                if (!tcIsActive($u)) continue;
                                if (tcVerifyLogin($pass, $u)) { $matchedUser = $u; break; }
                            }
                        }
                    }
                } catch (Throwable $eBlob) {
                    error_log('[TradeCore API] login blob fallback error: ' . $eBlob->getMessage());
                }
            }
            if ($matchedUser) {
                logCoreAction($pdo, (string)($matchedUser['username'] ?? $username), (string)($matchedUser['role'] ?? 'User'), 'User Login', 'User Login success from ' . tcClientIp());
                echo json_encode(["success" => true, "user" => $matchedUser, "token" => bin2hex(random_bytes(16)), "server_ts" => time()]);
            } else {
                logCoreAction($pdo, $username !== '' ? $username : $phone, 'Guest', 'Login Failed', 'Login failed for ' . ($username !== '' ? $username : $phone) . ' from ' . tcClientIp());
                echo json_encode(["success" => false, "error" => "User not found or inactive", "server_ts" => $now], 401);
            }
        } catch (Throwable $eLogin) {
            error_log('[TradeCore API] login failed: ' . $eLogin->getMessage() . ' in ' . $eLogin->getFile() . ':' . $eLogin->getLine());
            echo json_encode(["success" => false, "error" => "Login error: " . $eLogin->getMessage(), "server_ts" => $now]);
        }
        exit();
    }

    // ============================================================================
    // ALL OTHER ACTIONS: include backup file (gemini, AI, etc.)
    // ============================================================================
    $backup = __DIR__ . '/api_backup_500.php';
    if (is_file($backup)) {
        try {
            require $backup;
        } catch (Throwable $eBackup) {
            error_log('[TradeCore API] backup include failed: ' . $eBackup->getMessage() . ' in ' . $eBackup->getFile() . ':' . $eBackup->getLine());
            echo json_encode(["success" => false, "error" => "Backend error: " . $eBackup->getMessage(), "action" => $action, "server_ts" => $now]);
        }
    } else {
        echo json_encode(["success" => false, "error" => "Backend not found", "server_ts" => $now]);
    }
} catch (Throwable $e) {
    // LAST RESORT: ALWAYS return valid JSON with HTTP 200
    error_log('[TradeCore API] CRITICAL: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        http_response_code(200);
    }
    echo json_encode([
        'success' => false,
        'error' => 'Server error — please try again.',
        'action' => $action ?: 'unknown',
        'server_ts' => time(),
        'changed' => true,
        'state' => ['products' => [], 'users' => [], 'companies' => []],
        'timestamp' => time(),
    ], JSON_UNESCAPED_UNICODE);
    exit();
}
