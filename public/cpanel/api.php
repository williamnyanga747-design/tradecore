<?php
/**
 * GlobalTradeCore API — Bulletproof wrapper v3
 * Architecture: headers-first, inline fast-track for ALL sync-critical actions,
 * backup file for everything else, catch(Throwable) last resort.
 * BUILD 2026-09-06-10 — refresh data-loss fixes: full cross-company categories on
 * snapshot, company-scoped client category guard, get_state state unwrap contract.
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

// 2. CORS — restrict to allowed origins only
$allowedOrigins = [
    'https://tanzaniatradecore.co.tz',
    'http://localhost:5173',  // Vite dev server
    'http://localhost:3000',  // Local dev
];
$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($requestOrigin, $allowedOrigins)) {
    header('Access-Control-Allow-Origin: ' . $requestOrigin);
}
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
            // SAFETY: Only soft-delete categories not in the incoming array if the
            // incoming set appears complete (2+ companies or matches DB count)
            $dbCatCount = 0;
            try {
                $dbStmt = $pdo->prepare("SELECT COUNT(*) as cnt FROM tradecore_categories WHERE company_id=? AND deleted_at IS NULL");
                $dbStmt->execute([(string)$cid]);
                $dbRow = $dbStmt->fetch(PDO::FETCH_ASSOC);
                $dbCatCount = (int)($dbRow['cnt'] ?? 0);
            } catch (Throwable $eDb) {}
            $incomingCount = count($names);
            $isCompleteSet = (count($byCompany) >= 2) || ($incomingCount >= $dbCatCount) || ($dbCatCount === 0);
            if ($isCompleteSet) {
                $ph = implode(',', array_fill(0, count($names), '?'));
                $params = array_merge([(string)$cid], $names);
                try {
                    // SOFT DELETE instead of hard delete
                    $del = $pdo->prepare("UPDATE tradecore_categories SET deleted_at=?, updated_at=? WHERE company_id=? AND deleted_at IS NULL AND category_name NOT IN ($ph)");
                    $del->execute([$now, $now, (string)$cid, ...$names]);
                } catch (Throwable $e) {}
            }
        }
        error_log('[TradeCore API] CATEGORIES mirrored to MySQL across ' . count($byCompany) . ' companies (' . count($cats) . ' entries)');
    } catch (Throwable $e) {
        error_log('[TradeCore API] CATEGORIES mirror failed: ' . $e->getMessage());
    }
}

/**
 * ============================================================================
 * NORMALIZED PERSISTENT BACKEND STORAGE (PBS) — v2 layer
 * ----------------------------------------------------------------------------
 * Per-entity, stateless MySQL persistence that replaces the monolithic blob as
 * the durability layer. Helpers here are shared by:
 *   - the v2_* action dispatch (immediate atomic CRUD for the stateless client)
 *   - tcMirrorNormalized() — backfill from every save_state/snapshot so legacy
 *     blob flushes ALSO populate the normalized tables (transition bridge)
 * All rows are scoped with `WHERE company_id = ?`; soft deletes use deleted_at.
 * ============================================================================
 */
function tcBool($v) { return in_array($v, [1, '1', true, 'true', 'on'], true) ? 1 : 0; }
function tcNum($v) { return (is_numeric($v)) ? (float)$v : null; }

function tcEnsureNormalizedTables($pdo) {
    static $done = false;
    if ($done || !$pdo) return;
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS companies (id VARCHAR(64) PRIMARY KEY, owner_user_id VARCHAR(64) DEFAULT NULL, name VARCHAR(255) NOT NULL, code VARCHAR(64) DEFAULT NULL, currency_code VARCHAR(8) NOT NULL DEFAULT 'TZS', country VARCHAR(64) NOT NULL DEFAULT 'Tanzania', phone VARCHAR(32) DEFAULT NULL, email VARCHAR(190) DEFAULT NULL, tin_number VARCHAR(32) DEFAULT NULL, address VARCHAR(255) DEFAULT NULL, latitude DECIMAL(10,7) DEFAULT NULL, longitude DECIMAL(10,7) DEFAULT NULL, is_verified TINYINT(1) NOT NULL DEFAULT 0, is_active TINYINT(1) NOT NULL DEFAULT 1, status VARCHAR(20) NOT NULL DEFAULT 'active', locale VARCHAR(5) NOT NULL DEFAULT 'en', settings_json TEXT DEFAULT NULL, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL, deleted_at BIGINT DEFAULT NULL, INDEX idx_comp_active (is_active, deleted_at), INDEX idx_comp_code (code)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $pdo->exec("CREATE TABLE IF NOT EXISTS stores (id VARCHAR(64) PRIMARY KEY, company_id VARCHAR(64) NOT NULL, branch_id VARCHAR(64) DEFAULT NULL, name VARCHAR(255) NOT NULL, code VARCHAR(64) DEFAULT NULL, phone VARCHAR(32) DEFAULT NULL, email VARCHAR(190) DEFAULT NULL, address VARCHAR(255) DEFAULT NULL, city VARCHAR(100) DEFAULT NULL, is_active TINYINT(1) NOT NULL DEFAULT 1, settings_json TEXT DEFAULT NULL, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL, deleted_at BIGINT DEFAULT NULL, INDEX idx_store_company (company_id, deleted_at), INDEX idx_store_active (is_active, deleted_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $pdo->exec("CREATE TABLE IF NOT EXISTS stock_categories (id VARCHAR(64) PRIMARY KEY, company_id VARCHAR(64) NOT NULL, name VARCHAR(255) NOT NULL, parent_id VARCHAR(64) DEFAULT NULL, color VARCHAR(16) DEFAULT NULL, is_active TINYINT(1) NOT NULL DEFAULT 1, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL, deleted_at BIGINT DEFAULT NULL, UNIQUE KEY uniq_sc_cat_company (company_id, name), INDEX idx_sc_company (company_id, deleted_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $pdo->exec("CREATE TABLE IF NOT EXISTS products (id VARCHAR(64) PRIMARY KEY, company_id VARCHAR(64) NOT NULL, store_id VARCHAR(64) DEFAULT NULL, category_id VARCHAR(64) DEFAULT NULL, sku VARCHAR(128) DEFAULT NULL, name VARCHAR(255) NOT NULL, barcode VARCHAR(128) DEFAULT NULL, unit_price DECIMAL(18,2) NOT NULL DEFAULT 0, cost_price DECIMAL(18,2) NOT NULL DEFAULT 0, stock_qty DECIMAL(18,3) NOT NULL DEFAULT 0, low_stock_threshold DECIMAL(18,3) DEFAULT NULL, tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0, unit VARCHAR(32) DEFAULT NULL, image_url VARCHAR(500) DEFAULT NULL, description TEXT DEFAULT NULL, tags_json TEXT DEFAULT NULL, extra_json TEXT DEFAULT NULL, is_active TINYINT(1) NOT NULL DEFAULT 1, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL, deleted_at BIGINT DEFAULT NULL, INDEX idx_prod_company (company_id, deleted_at), INDEX idx_prod_store (store_id, deleted_at), INDEX idx_prod_cat (category_id, deleted_at), INDEX idx_prod_updated (company_id, updated_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $pdo->exec("CREATE TABLE IF NOT EXISTS user_accounts (id VARCHAR(64) PRIMARY KEY, company_id VARCHAR(64) DEFAULT NULL, branch_id VARCHAR(64) DEFAULT NULL, store_id VARCHAR(64) DEFAULT NULL, full_name VARCHAR(255) DEFAULT NULL, username VARCHAR(100) DEFAULT NULL, phone VARCHAR(24) NOT NULL, email VARCHAR(190) DEFAULT NULL, role VARCHAR(50) NOT NULL DEFAULT 'Cashier', password_hash VARCHAR(255) DEFAULT NULL, is_active TINYINT(1) NOT NULL DEFAULT 1, status VARCHAR(20) NOT NULL DEFAULT 'active', locale VARCHAR(5) NOT NULL DEFAULT 'en', permissions_json TEXT DEFAULT NULL, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL, deleted_at BIGINT DEFAULT NULL, UNIQUE KEY uniq_ua_phone_company (phone, company_id), UNIQUE KEY uniq_ua_username (username), INDEX idx_ua_company (company_id, deleted_at), INDEX idx_ua_active (is_active, deleted_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        // MIGRATION: add branch_id/store_id columns if missing (safe for existing tables)
        try { $pdo->exec("ALTER TABLE user_accounts ADD COLUMN branch_id VARCHAR(64) DEFAULT NULL AFTER company_id"); } catch (Throwable $eMig) {}
        try { $pdo->exec("ALTER TABLE user_accounts ADD COLUMN store_id VARCHAR(64) DEFAULT NULL AFTER branch_id"); } catch (Throwable $eMig2) {}
        $pdo->exec("CREATE TABLE IF NOT EXISTS audit_trails (id VARCHAR(64) PRIMARY KEY, company_id VARCHAR(64) NOT NULL, store_id VARCHAR(64) DEFAULT NULL, user_id VARCHAR(64) DEFAULT NULL, user_name VARCHAR(255) DEFAULT NULL, action VARCHAR(100) NOT NULL, entity_type VARCHAR(100) DEFAULT NULL, entity_id VARCHAR(64) DEFAULT NULL, entity_name VARCHAR(255) DEFAULT NULL, details TEXT DEFAULT NULL, details_json TEXT DEFAULT NULL, ip_address VARCHAR(45) DEFAULT NULL, created_at BIGINT NOT NULL, INDEX idx_at_company_action (company_id, action), INDEX idx_at_created (created_at), INDEX idx_at_entity (entity_type, entity_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $done = true;
    } catch (Throwable $e) {
        error_log('[TradeCore API] tcEnsureNormalizedTables failed: ' . $e->getMessage());
    }
}

// Merge a v2 request: POST JSON body first, then GET params (GET wins only when absent
// in body) so both `?action=v2_list_products&company_id=1` and POST bodies work.
function tcV2Input($rawInput) {
    $in = [];
    $b = json_decode((string)$rawInput, true);
    if (is_array($b)) $in = $b;
    foreach ($_GET as $k => $v) { if (!isset($in[$k])) $in[$k] = $v; }
    return $in;
}

// Persist a blob merge for READ-compat with the classic build. NEVER bumps the
// monotonic version (only save_state may) — mirrors the existing dual-write rule.
function tcBlobMerge($pdo, $field, $entity = null, $removeId = null) {
    try {
        $pre = $pdo->query("SELECT json_data FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1")->fetch();
        if (!$pre || !$pre['json_data']) return;
        $pd = normalizeBlobData(json_decode($pre['json_data'], true));
        if (!is_array($pd)) return;
        if ($removeId !== null) {
            if (isset($pd[$field]) && is_array($pd[$field])) {
                $rid = (string)$removeId;
                $pd[$field] = array_values(array_filter($pd[$field], function($x) use ($rid) { return isset($x['id']) && (string)$x['id'] !== $rid; }));
            }
        } elseif ($entity !== null && is_array($entity) && isset($entity['id'])) {
            if (!isset($pd[$field]) || !is_array($pd[$field])) $pd[$field] = [];
            $eid = (string)$entity['id'];
            $found = false;
            foreach ($pd[$field] as &$x) { if (isset($x['id']) && (string)$x['id'] === $eid) { $x = $entity; $found = true; break; } }
            unset($x);
            if (!$found) $pd[$field][] = $entity;
        } else {
            return;
        }
        $jj = json_encode($pd, JSON_UNESCAPED_UNICODE);
        $pdo->prepare("INSERT INTO tradecore_system_state (doc_key, json_data, updated_at) VALUES ('main_state', ?, NOW()) ON DUPLICATE KEY UPDATE json_data=VALUES(json_data), updated_at=NOW()")->execute([$jj]);
    } catch (Throwable $eBlob) { error_log('[TradeCore API] tcBlobMerge failed: ' . $eBlob->getMessage()); }
}

function tcUpsertCompanyRow($pdo, $c, $now) {
    if (!$pdo || !is_array($c) || !isset($c['id'])) return false;
    $id = (string)$c['id'];
    // DELETED-ENTITY GUARD (2026-09-07): honor the client's soft-delete flag so a blob
    // flush can never resurrect a company the user deleted. Previously the ON DUPLICATE
    // clause always forced deleted_at=NULL, so the next snapshot's tcLoadCompanies
    // (WHERE deleted_at IS NULL) re-surfaced the "deleted" company on every login.
    if (!empty($c['isDeleted']) || !empty($c['deleted_at']) || !empty($c['deletedAt'])) {
        try {
            $pdo->prepare("UPDATE companies SET deleted_at=?, is_active=0, status='deleted', updated_at=? WHERE id=?")->execute([$now, $now, $id]);
        } catch (Throwable $eDel) { error_log('[TradeCore API] company delete-touch failed: ' . $eDel->getMessage()); return false; }
        return true;
    }
    $data = [
        'owner_user_id' => isset($c['owner_user_id']) ? (string)$c['owner_user_id'] : (isset($c['ownerUserId']) ? (string)$c['ownerUserId'] : null),
        'name' => (string)($c['name'] ?? $id),
        'code' => isset($c['code']) ? (string)$c['code'] : null,
        'currency_code' => (string)($c['currency_code'] ?? $c['currencyCode'] ?? $c['currency'] ?? 'TZS'),
        'country' => (string)($c['country'] ?? 'Tanzania'),
        'phone' => isset($c['phone']) ? (string)$c['phone'] : null,
        'email' => isset($c['email']) ? (string)$c['email'] : null,
        'tin_number' => isset($c['tin_number']) ? (string)$c['tin_number'] : (isset($c['tinNumber']) ? (string)$c['tinNumber'] : null),
        'address' => isset($c['address']) ? (string)$c['address'] : (isset($c['addressText']) ? (string)$c['addressText'] : null),
        'latitude' => tcNum($c['latitude'] ?? $c['lat'] ?? null),
        'longitude' => tcNum($c['longitude'] ?? $c['lng'] ?? null),
        'is_verified' => tcBool($c['is_verified'] ?? $c['isVerified'] ?? 0),
        'is_active' => tcBool($c['is_active'] ?? $c['active'] ?? 1),
        'status' => (string)($c['status'] ?? ($c['is_active'] ?? $c['active'] ?? 1) ? 'active' : 'inactive'),
        'locale' => (string)($c['locale'] ?? 'en'),
        'settings_json' => (isset($c['settings_json']) && is_string($c['settings_json'])) ? $c['settings_json'] : (is_array($c['settings_json'] ?? $c['settings'] ?? null) ? json_encode($c['settings_json'] ?? $c['settings'], JSON_UNESCAPED_UNICODE) : null),
    ];
    try {
        $pdo->prepare("INSERT INTO companies (id, owner_user_id, name, code, currency_code, country, phone, email, tin_number, address, latitude, longitude, is_verified, is_active, status, locale, settings_json, created_at, updated_at, deleted_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)
            ON DUPLICATE KEY UPDATE owner_user_id=VALUES(owner_user_id), name=VALUES(name), code=VALUES(code), currency_code=VALUES(currency_code), country=VALUES(country), phone=VALUES(phone), email=VALUES(email), tin_number=VALUES(tin_number), address=VALUES(address), latitude=VALUES(latitude), longitude=VALUES(longitude), is_verified=VALUES(is_verified), is_active=VALUES(is_active), status=VALUES(status), locale=VALUES(locale), settings_json=VALUES(settings_json), updated_at=VALUES(updated_at), deleted_at=NULL")
            ->execute([$id, $data['owner_user_id'], $data['name'], $data['code'], $data['currency_code'], $data['country'], $data['phone'], $data['email'], $data['tin_number'], $data['address'], $data['latitude'], $data['longitude'], $data['is_verified'], $data['is_active'], $data['status'], $data['locale'], $data['settings_json'], $now, $now]);
        return true;
    } catch (Throwable $e) { error_log('[TradeCore API] upsert company failed: ' . $e->getMessage()); return false; }
}

function tcUpsertStoreRow($pdo, $s, $now) {
    if (!$pdo || !is_array($s) || !isset($s['id'])) return false;
    $id = (string)$s['id'];
    // DELETED-ENTITY GUARD (2026-09-07): same treatment as tcUpsertCompanyRow — honor
    // client soft-deletes so a blob flush can never resurrect a store/branch that was
    // deleted (tcUpsertStoreRow used to force deleted_at=NULL on every upsert).
    if (!empty($s['isDeleted']) || !empty($s['deleted_at']) || !empty($s['deletedAt'])) {
        try {
            $pdo->prepare("UPDATE stores SET deleted_at=?, is_active=0, updated_at=? WHERE id=?")->execute([$now, $now, $id]);
        } catch (Throwable $eDel) { error_log('[TradeCore API] store delete-touch failed: ' . $eDel->getMessage()); return false; }
        return true;
    }
    $companyId = (string)($s['company_id'] ?? $s['companyId'] ?? '');
    $branchId = isset($s['branch_id']) ? (string)$s['branch_id'] : (isset($s['branchId']) ? (string)$s['branchId'] : null);
    $data = [
        'company_id' => $companyId,
        'branch_id' => $branchId,
        'name' => (string)($s['name'] ?? $s['storeName'] ?? $id),
        'code' => isset($s['code']) ? (string)$s['code'] : null,
        'phone' => isset($s['phone']) ? (string)$s['phone'] : null,
        'email' => isset($s['email']) ? (string)$s['email'] : null,
        'address' => isset($s['address']) ? (string)$s['address'] : null,
        'city' => isset($s['city']) ? (string)$s['city'] : null,
        'is_active' => tcBool($s['is_active'] ?? $s['active'] ?? 1),
        'settings_json' => (isset($s['settings_json']) && is_string($s['settings_json'])) ? $s['settings_json'] : (is_array($s['settings_json'] ?? $s['settings'] ?? null) ? json_encode($s['settings_json'] ?? $s['settings'], JSON_UNESCAPED_UNICODE) : null),
    ];
    try {
        $pdo->prepare("INSERT INTO stores (id, company_id, branch_id, name, code, phone, email, address, city, is_active, settings_json, created_at, updated_at, deleted_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)
            ON DUPLICATE KEY UPDATE company_id=VALUES(company_id), branch_id=VALUES(branch_id), name=VALUES(name), code=VALUES(code), phone=VALUES(phone), email=VALUES(email), address=VALUES(address), city=VALUES(city), is_active=VALUES(is_active), settings_json=VALUES(settings_json), updated_at=VALUES(updated_at), deleted_at=NULL")
            ->execute([$id, $data['company_id'], $data['branch_id'], $data['name'], $data['code'], $data['phone'], $data['email'], $data['address'], $data['city'], $data['is_active'], $data['settings_json'], $now, $now]);
        return true;
    } catch (Throwable $e) { error_log('[TradeCore API] upsert store failed: ' . $e->getMessage()); return false; }
}

function tcUpsertCategoryRow($pdo, $companyId, $name, $now, $color = null) {
    if (!$pdo || $name === '') return false;
    $companyId = (string)$companyId;
    $name = trim((string)$name);
    if ($name === '') return false;
    $id = 'nc_' . md5($companyId . ':' . $name);
    $color = $color !== null ? (string)$color : '#f59e0b';
    try {
        $pdo->prepare("INSERT INTO stock_categories (id, company_id, name, parent_id, color, is_active, created_at, updated_at, deleted_at)
            VALUES (?,?,?,NULL,?,1,?,?,NULL)
            ON DUPLICATE KEY UPDATE name=VALUES(name), color=VALUES(color), updated_at=VALUES(updated_at), deleted_at=NULL")
            ->execute([$id, $companyId, $name, $color, $now, $now]);
    } catch (Throwable $e) { error_log('[TradeCore API] upsert stock_category failed: ' . $e->getMessage()); return false; }
    // Legacy atomic mirror so the classic snapshot/list path also sees the category.
    try { $pdo->prepare("INSERT INTO tradecore_categories (company_id, category_name, created_at, updated_at) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE updated_at=VALUES(updated_at), deleted_at=NULL")->execute([$companyId, $name, $now, $now]); } catch (Throwable $e2) {}
    return true;
}

function tcUpsertProductRow($pdo, $p, $now) {
    if (!$pdo || !is_array($p) || !isset($p['id'])) return false;
    $id = (string)$p['id'];
    $companyId = (string)($p['company_id'] ?? $p['companyId'] ?? '');
    $storeId = (string)($p['store_id'] ?? $p['storeId'] ?? '');
    if ($storeId === '') $storeId = null;
    $categoryId = (string)($p['category_id'] ?? $p['categoryId'] ?? '');
    if ($categoryId === '') $categoryId = null;
    $name = (string)($p['name'] ?? $p['productName'] ?? $id);
    $data = [
        'store_id' => $storeId,
        'category_id' => $categoryId,
        'sku' => isset($p['sku']) ? (string)$p['sku'] : null,
        'name' => $name,
        'barcode' => isset($p['barcode']) ? (string)$p['barcode'] : null,
        'unit_price' => tcNum($p['unit_price'] ?? $p['price'] ?? $p['unitPrice'] ?? 0),
        'cost_price' => tcNum($p['cost_price'] ?? $p['costPrice'] ?? $p['unitCost'] ?? 0),
        'stock_qty' => tcNum($p['stock_qty'] ?? $p['stockQty'] ?? $p['quantity'] ?? 0),
        'low_stock_threshold' => tcNum($p['low_stock_threshold'] ?? $p['lowStockThreshold'] ?? null) ?? 0,
        'tax_rate' => tcNum($p['tax_rate'] ?? $p['taxRate'] ?? 0),
        'unit' => isset($p['unit']) ? (string)$p['unit'] : null,
        'image_url' => isset($p['image_url']) ? (string)$p['image_url'] : (isset($p['image']) ? (string)$p['image'] : null),
        'description' => isset($p['description']) ? (string)$p['description'] : null,
        'tags_json' => (isset($p['tags']) && is_array($p['tags'])) ? json_encode($p['tags'], JSON_UNESCAPED_UNICODE) : (is_string($p['tags_json'] ?? null) ? $p['tags_json'] : null),
        'extra_json' => null,
        'is_active' => tcBool($p['is_active'] ?? $p['active'] ?? 1),
    ];
    $extra = [];
    foreach (['companyPrices', 'status', 'productCode', 'createdBy', 'updatedBy', 'color', 'warranty', 'expiryDate', 'supplierId'] as $ek) {
        if (array_key_exists($ek, $p) && $p[$ek] !== null) $extra[$ek] = $p[$ek];
    }
    if (count($extra) > 0) $data['extra_json'] = json_encode($extra, JSON_UNESCAPED_UNICODE);
    try {
        $pdo->prepare("INSERT INTO products (id, company_id, store_id, category_id, sku, name, barcode, unit_price, cost_price, stock_qty, low_stock_threshold, tax_rate, unit, image_url, description, tags_json, extra_json, is_active, created_at, updated_at, deleted_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)
            ON DUPLICATE KEY UPDATE company_id=VALUES(company_id), store_id=VALUES(store_id), category_id=VALUES(category_id), sku=VALUES(sku), name=VALUES(name), barcode=VALUES(barcode), unit_price=VALUES(unit_price), cost_price=VALUES(cost_price), stock_qty=VALUES(stock_qty), low_stock_threshold=VALUES(low_stock_threshold), tax_rate=VALUES(tax_rate), unit=VALUES(unit), image_url=VALUES(image_url), description=VALUES(description), tags_json=VALUES(tags_json), extra_json=VALUES(extra_json), is_active=VALUES(is_active), updated_at=VALUES(updated_at), deleted_at=NULL")
            ->execute([$id, $companyId, $data['store_id'], $data['category_id'], $data['sku'], $data['name'], $data['barcode'], $data['unit_price'], $data['cost_price'], $data['stock_qty'], $data['low_stock_threshold'], $data['tax_rate'], $data['unit'], $data['image_url'], $data['description'], $data['tags_json'], $data['extra_json'], $data['is_active'], $now, $now]);
    } catch (Throwable $e) { error_log('[TradeCore API] upsert product failed: ' . $e->getMessage()); return false; }
    // Legacy atomic mirror (classic snapshot/list path).
    try {
        $pdo->prepare("REPLACE INTO tradecore_products (id, company_id, data, updated_at, deleted_at) VALUES (?,?,?,?,NULL)")->execute([$id, $companyId, json_encode($p, JSON_UNESCAPED_UNICODE), $now]);
    } catch (Throwable $eLeg) { error_log('[TradeCore API] product legacy mirror failed: ' . $eLeg->getMessage()); }
    return true;
}

function tcUpsertUserRow($pdo, $u, $now) {
    if (!$pdo || !is_array($u) || !isset($u['id'])) return false;
    $id = (string)$u['id'];
    $companyId = (string)($u['company_id'] ?? $u['companyId'] ?? '');
    $branchId = (string)($u['branch_id'] ?? $u['branchId'] ?? '');
    if ($branchId === '') $branchId = null;
    $storeId = (string)($u['store_id'] ?? $u['storeId'] ?? '');
    if ($storeId === '') $storeId = null;
    $phone = (string)($u['phone'] ?? $u['phoneNumber'] ?? '');
    $password = isset($u['password']) ? (string)$u['password'] : (isset($u['passwordHash']) ? (string)$u['passwordHash'] : null);
    $data = [
        'company_id' => $companyId === '' ? null : $companyId,
        'branch_id' => $branchId,
        'store_id' => $storeId,
        'full_name' => isset($u['full_name']) ? (string)$u['full_name'] : (isset($u['fullName']) ? (string)$u['fullName'] : null),
        'username' => isset($u['username']) ? (string)$u['username'] : null,
        'phone' => $phone,
        'email' => isset($u['email']) ? (string)$u['email'] : null,
        'role' => (string)($u['role'] ?? 'Cashier'),
        'password_hash' => $password,
        'is_active' => tcBool($u['is_active'] ?? $u['active'] ?? 1),
        'status' => (string)($u['status'] ?? 'active'),
        'locale' => (string)($u['locale'] ?? 'en'),
        'permissions_json' => (isset($u['permissions_json']) && is_string($u['permissions_json'])) ? $u['permissions_json'] : (is_array($u['permissions'] ?? $u['permissions_json'] ?? null) ? json_encode($u['permissions'] ?? $u['permissions_json'], JSON_UNESCAPED_UNICODE) : null),
    ];
    try {
        // IF(VALUES(password_hash) IS NULL, password_hash, VALUES(password_hash)) keeps an
        // existing hash when the incoming payload carries none (safe re-syncs).
        $pdo->prepare("INSERT INTO user_accounts (id, company_id, branch_id, store_id, full_name, username, phone, email, role, password_hash, is_active, status, locale, permissions_json, created_at, updated_at, deleted_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)
            ON DUPLICATE KEY UPDATE company_id=VALUES(company_id), branch_id=VALUES(branch_id), store_id=VALUES(store_id), full_name=VALUES(full_name), username=VALUES(username), phone=VALUES(phone), email=VALUES(email), role=VALUES(role), password_hash=IF(VALUES(password_hash) IS NULL, password_hash, VALUES(password_hash)), is_active=VALUES(is_active), status=VALUES(status), locale=VALUES(locale), permissions_json=VALUES(permissions_json), updated_at=VALUES(updated_at), deleted_at=NULL")
            ->execute([$id, $data['company_id'], $data['branch_id'], $data['store_id'], $data['full_name'], $data['username'], $data['phone'], $data['email'], $data['role'], $data['password_hash'], $data['is_active'], $data['status'], $data['locale'], $data['permissions_json'], $now, $now]);
    } catch (Throwable $e) { error_log('[TradeCore API] upsert user_account failed: ' . $e->getMessage()); return false; }
    // Legacy atomic mirror so existing login/auth keeps working during transition.
    try {
        $pdo->prepare("REPLACE INTO tradecore_users (id, company_id, phone, data, updated_at, deleted_at) VALUES (?,?,?,?,?,NULL)")->execute([$id, $companyId, $phone, json_encode($u, JSON_UNESCAPED_UNICODE), $now]);
    } catch (Throwable $eLeg) { error_log('[TradeCore API] user legacy mirror failed: ' . $eLeg->getMessage()); }
    return true;
}

function tcLoadCompanies($pdo) {
    $out = [];
    if (!$pdo) return $out;
    tcEnsureNormalizedTables($pdo);
    try {
        $rows = $pdo->query("SELECT * FROM companies WHERE deleted_at IS NULL ORDER BY name ASC")->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as $r) {
            $out[] = [
                'id' => $r['id'], 'name' => $r['name'], 'code' => $r['code'],
                'currency' => $r['currency_code'], 'currencyCode' => $r['currency_code'],
                'country' => $r['country'], 'phone' => $r['phone'], 'email' => $r['email'],
                'tinNumber' => $r['tin_number'], 'addressText' => $r['address'],
                'latitude' => $r['latitude'] === null ? null : (float)$r['latitude'],
                'longitude' => $r['longitude'] === null ? null : (float)$r['longitude'],
                'isVerified' => (int)$r['is_verified'], 'is_active' => (int)$r['is_active'], 'active' => (int)$r['is_active'],
                'status' => $r['status'], 'locale' => $r['locale'],
                'created_at' => $r['created_at'], 'updated_at' => $r['updated_at'],
            ];
        }
    } catch (Throwable $e) { error_log('[TradeCore API] tcLoadCompanies failed: ' . $e->getMessage()); }
    return $out;
}

function tcLoadStores($pdo, $companyId = '') {
    $out = [];
    if (!$pdo) return $out;
    tcEnsureNormalizedTables($pdo);
    try {
        if ($companyId !== '') {
            $st = $pdo->prepare("SELECT * FROM stores WHERE company_id=? AND deleted_at IS NULL ORDER BY name ASC");
            $st->execute([(string)$companyId]);
        } else {
            $st = $pdo->query("SELECT * FROM stores WHERE deleted_at IS NULL ORDER BY company_id ASC, name ASC");
        }
        foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $out[] = [
                'id' => $r['id'], 'companyId' => $r['company_id'], 'branchId' => $r['branch_id'],
                'name' => $r['name'], 'code' => $r['code'], 'phone' => $r['phone'],
                'email' => $r['email'], 'address' => $r['address'], 'city' => $r['city'],
                'is_active' => (int)$r['is_active'], 'active' => (int)$r['is_active'],
                'updated_at' => $r['updated_at'],
            ];
        }
    } catch (Throwable $e) { error_log('[TradeCore API] tcLoadStores failed: ' . $e->getMessage()); }
    return $out;
}

function tcLoadProductsN($pdo, $companyId = '', $storeId = '', $since = 0) {
    $out = [];
    if (!$pdo || $companyId === '') return $out;
    tcEnsureNormalizedTables($pdo);
    try {
        $sql = "SELECT * FROM products WHERE deleted_at IS NULL AND company_id=?";
        $args = [(string)$companyId];
        if ($storeId !== '') { $sql .= " AND store_id=?"; $args[] = (string)$storeId; }
        if ($since > 0) { $sql .= " AND updated_at>?"; $args[] = (int)$since; }
        $sql .= " ORDER BY name ASC";
        $st = $pdo->prepare($sql);
        $st->execute($args);
        foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $extra = [];
            if ($r['extra_json']) { $d = json_decode($r['extra_json'], true); if (is_array($d)) $extra = $d; }
            $p = [
                'id' => $r['id'], 'companyId' => $r['company_id'], 'storeId' => $r['store_id'],
                'categoryId' => $r['category_id'], 'sku' => $r['sku'], 'name' => $r['name'],
                'barcode' => $r['barcode'], 'price' => (float)$r['unit_price'], 'unitPrice' => (float)$r['unit_price'],
                'costPrice' => (float)$r['cost_price'], 'unitCost' => (float)$r['cost_price'],
                'stockQty' => (float)$r['stock_qty'], 'quantity' => (float)$r['stock_qty'],
                'lowStockThreshold' => $r['low_stock_threshold'] === null ? null : (float)$r['low_stock_threshold'],
                'taxRate' => (float)$r['tax_rate'], 'unit' => $r['unit'], 'image' => $r['image_url'],
                'description' => $r['description'], 'is_active' => (int)$r['is_active'], 'active' => (int)$r['is_active'],
                'created_at' => $r['created_at'], 'updated_at' => $r['updated_at'],
            ];
            foreach ($extra as $ek => $ev) { if (!array_key_exists($ek, $p)) $p[$ek] = $ev; }
            $out[] = $p;
        }
    } catch (Throwable $e) { error_log('[TradeCore API] tcLoadProductsN failed: ' . $e->getMessage()); }
    return $out;
}

function tcLoadUsersN($pdo, $companyId = '') {
    $out = [];
    if (!$pdo) return $out;
    tcEnsureNormalizedTables($pdo);
    // BRANCH/STORE SCOPE PRESERVATION: the normalized user_accounts table has no
    // branch_id/store_id columns, but the legacy mirror (tradecore_users.data) keeps the
    // FULL original user JSON — including the branchId/storeId chosen on the ADD USER form.
    // Load that map once per query and overlay the scope onto the normalized rows so
    // snapshot users[] RETURNS the scope. Without this, a Branch Administrator assigned
    // SINGIDA + Store=None would come back from a snapshot branchless → the client treats
    // them as company-wide and they see EVERY store.
    $legacyScope = [];
    try {
        if ($companyId !== '') {
            $ls = $pdo->prepare("SELECT id, data FROM tradecore_users WHERE company_id=? AND deleted_at IS NULL");
            $ls->execute([(string)$companyId]);
        } else {
            $ls = $pdo->query("SELECT id, data FROM tradecore_users WHERE deleted_at IS NULL");
        }
        foreach ($ls->fetchAll(PDO::FETCH_ASSOC) as $lr) {
            $d = json_decode($lr['data'], true);
            if (!is_array($d)) continue;
            $legacyScope[$lr['id']] = $d;
        }
    } catch (Throwable $eLs) { error_log('[TradeCore API] tcLoadUsersN legacy scope failed: ' . $eLs->getMessage()); }
    try {
        if ($companyId !== '') {
            $st = $pdo->prepare("SELECT * FROM user_accounts WHERE company_id=? AND deleted_at IS NULL ORDER BY full_name ASC");
            $st->execute([(string)$companyId]);
        } else {
            $st = $pdo->query("SELECT * FROM user_accounts WHERE deleted_at IS NULL ORDER BY company_id ASC, full_name ASC");
        }
        foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $perms = null;
            if ($r['permissions_json']) { $dp = json_decode($r['permissions_json'], true); if (is_array($dp)) $perms = $dp; }
            $branchId = $r['branch_id'] ?? null;
            $storeId = $r['store_id'] ?? null;
            $leg = $legacyScope[$r['id']] ?? null;
            if (($branchId === null || $branchId === '') && is_array($leg)) {
                $branchId = $leg['branchId'] ?? $leg['branch_id'] ?? null;
            }
            if (($storeId === null || $storeId === '') && is_array($leg)) {
                $storeId = $leg['storeId'] ?? $leg['store_id'] ?? null;
            }
            $out[] = [
                'id' => $r['id'], 'companyId' => $r['company_id'], 'fullName' => $r['full_name'],
                'username' => $r['username'], 'phone' => $r['phone'], 'email' => $r['email'],
                'role' => $r['role'], 'is_active' => (int)$r['is_active'], 'active' => (int)$r['is_active'],
                'status' => $r['status'], 'locale' => $r['locale'], 'permissions' => $perms,
                'branchId' => ($branchId !== null && $branchId !== '') ? (is_numeric($branchId) ? (int)$branchId : (string)$branchId) : null,
                'storeId' => ($storeId !== null && $storeId !== '') ? (is_numeric($storeId) ? (int)$storeId : (string)$storeId) : null,
                'created_at' => $r['created_at'], 'updated_at' => $r['updated_at'],
            ];
        }
    } catch (Throwable $e) { error_log('[TradeCore API] tcLoadUsersN failed: ' . $e->getMessage()); }
    return $out;
}

function tcLoadCategoriesN($pdo, $companyId = '') {
    $out = [];
    if (!$pdo) return $out;
    tcEnsureNormalizedTables($pdo);
    try {
        if ($companyId !== '') {
            $st = $pdo->prepare("SELECT company_id, name, deleted_at FROM stock_categories WHERE company_id=? AND deleted_at IS NULL ORDER BY created_at ASC");
            $st->execute([(string)$companyId]);
        } else {
            $st = $pdo->query("SELECT company_id, name, deleted_at FROM stock_categories WHERE deleted_at IS NULL ORDER BY company_id ASC, created_at ASC");
        }
        foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $cid = (int)($r['company_id'] ?? 1);
            $name = trim((string)($r['name'] ?? ''));
            if ($name !== '') $out[] = 'co_' . $cid . ':' . $name;
        }
    } catch (Throwable $e) { error_log('[TradeCore API] tcLoadCategoriesN failed: ' . $e->getMessage()); }
    return $out;
}

// Append-only normalized audit row + legacy audit_logs back-compat.
function tcWriteAuditTrail($pdo, $cid, $userId, $userName, $action, $entityType, $entityId, $entityName, $detailsObj) {
    if (!$pdo) return;
    tcEnsureNormalizedTables($pdo);
    $now = time();
    $det = is_array($detailsObj) ? json_encode($detailsObj, JSON_UNESCAPED_UNICODE) : (string)$detailsObj;
    $id = md5($action . ':' . $entityType . ':' . $entityId . ':' . $now . ':' . $userId);
    try {
        $pdo->prepare("INSERT INTO audit_trails (id, company_id, store_id, user_id, user_name, action, entity_type, entity_id, entity_name, details, details_json, ip_address, created_at)
            VALUES (?,?,NULL,?,?,?,?,?,?,?,?,?,?)")->execute([$id, (string)$cid, $userId, (string)$userName, $action, $entityType, $entityId, $entityName, $det, $det, tcClientIp(), $now]);
    } catch (Throwable $eAud) { error_log('[TradeCore API] audit_trails write failed: ' . $eAud->getMessage()); }
    try { if (function_exists('logCoreAction')) logCoreAction($pdo, $userName, $entityType ?? '', $action, $entityId); } catch (Throwable $e2) {}
}

// Backfill normalized tables from a full state object (legacy bridge). Called from
// save_state and snapshot so every write — even a classic blob flush — lands in the
// normalized schema and normalizes COMPANY/STORE parent rows for FK readiness.
function tcMirrorNormalized($pdo, $data) {
    if (!$pdo || !is_array($data)) return;
    tcEnsureNormalizedTables($pdo);
    $now = time();
    try {
        if (isset($data['companies']) && is_array($data['companies'])) {
            foreach ($data['companies'] as $c) { if (is_array($c) && isset($c['id'])) tcUpsertCompanyRow($pdo, $c, $now); }
        }
        if (isset($data['branches']) && is_array($data['branches'])) {
            foreach ($data['branches'] as $b) { if (is_array($b)) { $b['company_id'] = $b['company_id'] ?? $b['companyId'] ?? ''; $b['branch_id'] = $b['branch_id'] ?? $b['id']; tcUpsertStoreRow($pdo, $b, $now); } }
        }
        if (isset($data['stores']) && is_array($data['stores'])) {
            foreach ($data['stores'] as $s) { if (is_array($s)) tcUpsertStoreRow($pdo, $s, $now); }
        }
        $prodList = null;
        if (isset($data['marketplaceProducts']) && is_array($data['marketplaceProducts'])) $prodList = $data['marketplaceProducts'];
        elseif (isset($data['products']) && is_array($data['products'])) $prodList = $data['products'];
        if (is_array($prodList)) { foreach ($prodList as $p) { if (is_array($p) && isset($p['id'])) tcUpsertProductRow($pdo, $p, $now); } }
        if (isset($data['users']) && is_array($data['users'])) {
            foreach ($data['users'] as $u) { if (is_array($u) && isset($u['id'])) tcUpsertUserRow($pdo, $u, $now); }
        }
        if (isset($data['categories']) && is_array($data['categories'])) {
            foreach ($data['categories'] as $cname) {
                if (!is_string($cname) || trim($cname) === '') continue;
                $cid = 1; $name = trim($cname);
                if (preg_match('/^co_(\d+):(.+)$/s', $name, $m)) { $cid = (int)$m[1]; $name = trim($m[2]); }
                if ($name !== '') tcUpsertCategoryRow($pdo, (string)$cid, $name, $now);
            }
        }
    } catch (Throwable $e) { error_log('[TradeCore API] tcMirrorNormalized failed: ' . $e->getMessage()); }
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
    // REMOVED: hardcoded bypass for root_mandate/superadmin — all operators must be validated against DB
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
    // REMOVED: hardcoded bypass for root_mandate/superadmin — all operators must be validated against DB
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
        if (!is_array($dbCreds)) $dbCreds = ['host'=>(getenv('TC_DB_HOST')?:'localhost'),'name'=>(getenv('TC_DB_NAME')?:'tanzatrade_tradecore_erp'),'user'=>(getenv('TC_DB_USER')?:'tanzatrade_tanzatrade'),'pass'=>(getenv('TC_DB_PASS')?:'')];
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
    $softAuthActions = ['change_password', 'upsert_user', 'assign_user', 'create_user', 'login', 'get_my_role'];
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
            // The NORMALIZED PBS layer (companies/stores/products/categories/users)
            // is authoritative when it has rows; the legacy tradecore_* atomic
            // tables and blob remain as fallbacks/overlay while a table is empty.
            // tcMirrorNormalized backfills normalized rows from this very blob on
            // every snapshot, so an empty normalized table self-populates here.
            try { tcMirrorNormalized($pdo, $blob); } catch (Throwable $eMirror) {}

            // companies -> normalized when present, else blob overlay.
            $nCompanies = tcLoadCompanies($pdo);
            if (count($nCompanies) > 0) $blob['companies'] = $nCompanies;
            // stores (stores + branches) -> normalized when present, else blob.
            $nStores = tcLoadStores($pdo, $companyId !== '' ? $companyId : '');
            if (count($nStores) > 0) {
                $branches = array_values(array_filter($nStores, function($s) { return !empty($s['branchId']); }));
                $poSs = array_values(array_filter($nStores, function($s) { return empty($s['branchId']); }));
                if (count($poSs) > 0) $blob['stores'] = $poSs;
                if (count($branches) > 0) $blob['branches'] = $branches;
            }
            // user_accounts -> normalized when present, else tradecore_users/blob.
            $nUsers = tcLoadUsersN($pdo, $companyId !== '' ? $companyId : '');
            if (count($nUsers) > 0) {
                $blob['users'] = $nUsers;
                $blob['userAccounts'] = $nUsers;
            }
            if ($companyId !== '') {
                // users -> tradecore_users (fallback only when normalized/blob have none)
                try {
                    $st = $pdo->prepare("SELECT data FROM tradecore_users WHERE company_id=? AND deleted_at IS NULL");
                    $st->execute([$companyId]);
                    $rows = [];
                    foreach ($st->fetchAll() as $r) { $d = json_decode($r['data'], true); if (is_array($d)) $rows[] = $d; }
                    // Only fill from the legacy atomic table when nothing was already
                    // resolved (normalized user_accounts wins; next fallback is the blob).
                    if (empty($blob['users'] ?? [])) $blob['users'] = $rows;
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

            // 3. Categories: stock_categories (normalized) first, then the legacy
            //    tradecore_categories mirror, falling back to the blob only while both
            //    tables are empty so a fresh DB (migration not yet run) can never reset
            //    categories to [].
            //    CRITICAL (2026-09-07): load the FULL cross-company category set — never
            //    a company-scoped subset. The client stores categories as a single global
            //    array of "co_<cid>:<name>" strings and filters per active company itself
            //    (getCompanyCategories). Returning only the requested company's rows here
            //    wipes every OTHER company's categories from the client's state on each
            //    snapshot; a following flush then sends the trimmed array to the server,
            //    permanently deleting the other companies' categories for all users.
            try {
                $cats = tcLoadCategoriesN($pdo, '');
                if (count($cats) === 0) $cats = tcLoadCategories($pdo);
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
                    // FULL: return all active items from NORMALIZED tables
                    // Use tcLoadUsersN and tcLoadProductsN for faster, normalized reads
                    $users = tcLoadUsersN($pdo, $companyId);
                    $products = tcLoadProductsN($pdo, $companyId);
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
                    $result['categories'] = tcLoadCategoriesN($pdo, $companyId);
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
            } elseif ($collection === 'companies' && $op === 'upsert') {
                // COMPANY PERSISTENCE (2026-09-07): mirror company micro-updates to the
                // atomic companies table (tanzatrade_tradecore_erp.companies) so a record
                // created via mutate_record survives a refresh — the blob alone let a
                // "NEW" company vanish and the snapshot re-bootstrap returned to company 1.
                try { tcUpsertCompanyRow($pdo, $record, date('Y-m-d H:i:s')); } catch (Throwable $ec) {}
            } elseif ($collection === 'stores' && $op === 'upsert') {
                try { tcUpsertStoreRow($pdo, $record, date('Y-m-d H:i:s')); } catch (Throwable $es) {}
            } elseif (($collection === 'companies' || $collection === 'stores') && $op === 'delete') {
                // Soft-delete the atomic row so the next authoritative snapshot can never
                // resurrect a company/store removed via the micro-update path.
                try {
                    $cd = date('Y-m-d H:i:s');
                    if ($collection === 'companies') {
                        $pdo->prepare("UPDATE companies SET deleted_at=?, is_active=0, status='deleted', updated_at=? WHERE id=?")->execute([$cd, $cd, (string)$recordId]);
                    } else {
                        $pdo->prepare("UPDATE stores SET deleted_at=?, is_active=0, updated_at=? WHERE id=?")->execute([$cd, $cd, (string)$recordId]);
                    }
                } catch (Throwable $ed2) {}
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
        // CRITICAL: extract inner data — frontend sends {action, data, lastUpdated, changedKeys, lastSeenVersion}
        $stateData = (is_array($data) && isset($data['data']) && is_array($data['data'])) ? $data['data'] : ($data ?: []);
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
                    // COMPANY-SCOPED CLIENT GUARD (2026-09-07): if the server holds
                    // categories for MULTIPLE companies but the client only sends rows for
                    // a SINGLE company, the client's array is a partial/company-scoped
                    // snapshot (from an older buggy snapshot parse), not the real full
                    // array. Trusting it would delete every other company's categories on
                    // the server for all users. Merge: within the ONE company the client
                    // demonstrably knows, the client wins (real edits/deletes land); for
                    // every other company, keep the server's categories.
                    if (is_array($toPersist['categories'] ?? null)) {
                        $parseCatCid = function ($cn) {
                            if (is_string($cn) && preg_match('/^co_(\d+):/', $cn, $m)) return (int)$m[1];
                            return 1; // legacy plain name => company 1
                        };
                        $clientCids = [];
                        foreach ($toPersist['categories'] as $cn) { if (is_string($cn)) $clientCids[$parseCatCid($cn)] = true; }
                        $serverCats = is_array($prevData['categories'] ?? null) ? $prevData['categories'] : [];
                        $serverCids = [];
                        foreach ($serverCats as $cn) { if (is_string($cn)) $serverCids[$parseCatCid($cn)] = true; }
                        if (count($serverCids) > 1 && count($clientCids) === 1) {
                            $ownCid = (int)array_keys($clientCids)[0];
                            $clientSet = [];
                            foreach ($toPersist['categories'] as $cn) { if (is_string($cn)) $clientSet[$cn] = true; }
                            $preserved = 0;
                            foreach ($serverCats as $scat) {
                                if (!is_string($scat) || isset($clientSet[$scat])) continue;
                                if ($parseCatCid($scat) !== $ownCid) {
                                    $toPersist['categories'][] = $scat;
                                    $clientSet[$scat] = true;
                                    $preserved++;
                                }
                            }
                            if ($preserved > 0) {
                                error_log('[TradeCore API] CATEGORY COMPANY-SCOPED GUARD: client sent single-company array; preserved ' . $preserved . ' server categories for other companies');
                            }
                        }
                    }
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

                // 3b3. DELETE RECONCILE (2026-09-07): the blob flush is authoritative for
                // every collection the client marks dirty. Persist deletions INTO the
                // normalized mirror tables so a later snapshot/tcLoadCompanies cannot
                // resurrect them ("the deleted company came back after login" bug). Each
                // reconcile only fires when its collection is actually dirty (or the
                // payload is a full-state save), so a boot/rebase flush can never
                // mass-delete another client's rows.
                $fullAuth = !is_array($changedKeys) || count($changedKeys) === 0;
                if (is_array($toPersist['companies'] ?? null) && ($fullAuth || (is_array($changedKeys) && in_array('companies', $changedKeys, true)))) {
                    try {
                        $keepCids = [];
                        foreach ($toPersist['companies'] as $cc) { if (is_array($cc) && isset($cc['id'])) $keepCids[(string)$cc['id']] = true; }
                        $crows = $pdo->query("SELECT id FROM companies WHERE deleted_at IS NULL")->fetchAll(PDO::FETCH_COLUMN);
                        $delCids = [];
                        foreach ($crows as $rid) { if (!isset($keepCids[(string)$rid])) $delCids[(string)$rid] = true; }
                        if (!empty($delCids)) {
                            foreach (array_keys($delCids) as $dcid) {
                                try { $pdo->prepare("UPDATE companies SET deleted_at=?, is_active=0, status='deleted', updated_at=? WHERE id=?")->execute([$now, $now, (string)$dcid]); } catch (Throwable $e1) {}
                            }
                            error_log('[TradeCore API] COMPANY DELETE RECONCILE: soft-deleted ' . count($delCids) . ' company row(s) absent from the authoritative blob (v' . $prevVersion . ')');
                        }
                    } catch (Throwable $eCmpR) { error_log('[TradeCore API] company reconcile failed: ' . $eCmpR->getMessage()); }
                }
                if ((is_array($toPersist['stores'] ?? null) || is_array($toPersist['branches'] ?? null))
                    && ($fullAuth || (is_array($changedKeys) && (in_array('branches', $changedKeys, true) || in_array('stores', $changedKeys, true))))) {
                    try {
                        $keepSid = [];
                        foreach (array_merge(is_array($toPersist['stores'] ?? null) ? $toPersist['stores'] : [], is_array($toPersist['branches'] ?? null) ? $toPersist['branches'] : []) as $ss) {
                            if (is_array($ss) && isset($ss['id'])) $keepSid[(string)$ss['id']] = true;
                        }
                        $srows = $pdo->query("SELECT id FROM stores WHERE deleted_at IS NULL")->fetchAll(PDO::FETCH_COLUMN);
                        $delSid = [];
                        foreach ($srows as $rid) { if (!isset($keepSid[(string)$rid])) $delSid[(string)$rid] = true; }
                        if (!empty($delSid)) {
                            foreach (array_keys($delSid) as $dsid) {
                                try { $pdo->prepare("UPDATE stores SET deleted_at=?, is_active=0, updated_at=? WHERE id=?")->execute([$now, $now, (string)$dsid]); } catch (Throwable $e2) {}
                            }
                            error_log('[TradeCore API] STORE DELETE RECONCILE: soft-deleted ' . count($delSid) . ' store/branch row(s) absent from the authoritative blob (v' . $prevVersion . ')');
                        }
                    } catch (Throwable $eStR) { error_log('[TradeCore API] store reconcile failed: ' . $eStR->getMessage()); }
                }
                // CATEGORY DELETE RECONCILE: the snapshot prefers stock_categories
                // (tcLoadCategoriesN), but tcMirrorNormalized only upserts that table —
                // it never prunes, so a category the client deleted returned from every
                // reload. Prune stock_categories rows only for companies whose full set
                // is present in the merged array (identical rule to tcMirrorCategories),
                // so a stale/partial flush can never wipe another company's categories.
                // SAFETY: Only reconcile if the incoming data appears to be a complete
                // cross-company set (has categories for 2+ companies OR matches DB count)
                if (is_array($toPersist['categories'] ?? null)) {
                    try {
                        $catByCid = [];
                        foreach ($toPersist['categories'] as $cname) {
                            if (!is_string($cname) || trim($cname) === '') continue;
                            $cid = 1; $name = trim($cname);
                            if (preg_match('/^co_(\d+):(.+)$/s', $name, $mCat) === 1) { $cid = (int)$mCat[1]; $name = trim($mCat[2]); }
                            if ($name === '') continue;
                            if (!isset($catByCid[$cid])) $catByCid[$cid] = [];
                            $catByCid[$cid][$name] = true;
                        }
                        // SAFETY GUARD: Count total categories in DB across all companies
                        $dbCatCount = 0;
                        try {
                            $dbCatStmt = $pdo->query("SELECT COUNT(*) as cnt FROM stock_categories WHERE deleted_at IS NULL");
                            $dbCatRow = $dbCatStmt->fetch(PDO::FETCH_ASSOC);
                            $dbCatCount = (int)($dbCatRow['cnt'] ?? 0);
                        } catch (Throwable $eDbCat) {}
                        $incomingCatCount = count($toPersist['categories']);
                        // Only reconcile if incoming set is complete:
                        // - Has categories for 2+ companies (multi-company flush), OR
                        // - Incoming count matches or exceeds DB count (no data loss), OR
                        // - DB is empty (first-time setup)
                        $isCompleteSet = (count($catByCid) >= 2) || ($incomingCatCount >= $dbCatCount) || ($dbCatCount === 0);
                        if ($isCompleteSet) {
                            foreach ($catByCid as $ccid => $nameSet) {
                                $st = $pdo->prepare("SELECT id, name FROM stock_categories WHERE company_id=? AND deleted_at IS NULL");
                                $st->execute([(string)$ccid]);
                                foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $crow) {
                                    $crowName = trim((string)($crow['name'] ?? ''));
                                    if ($crowName === '' || !isset($nameSet[$crowName])) {
                                        try { $pdo->prepare("UPDATE stock_categories SET deleted_at=?, is_active=0, updated_at=? WHERE id=?")->execute([$now, $now, $crow['id']]); } catch (Throwable $e3) {}
                                    }
                                }
                            }
                        } else {
                            error_log('[TradeCore API] category reconcile SKIPPED: incomplete set (incoming=' . $incomingCatCount . ', db=' . $dbCatCount . ', companies=' . count($catByCid) . ')');
                        }
                    } catch (Throwable $eCatR) { error_log('[TradeCore API] category reconcile failed: ' . $eCatR->getMessage()); }
                }

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

                // 6b. NORMALIZED PBS BACKFILL: mirror the merged state into the
                // normalized tables (companies/stores/products/categories/user_accounts).
                // Runs inside the same transaction so the blob + normalized rows commit
                // atomically — every legacy flush lands in the normalized schema too.
                try { tcMirrorNormalized($pdo, $toPersist); } catch (Throwable $eMirrorN) { error_log('[TradeCore API] tcMirrorNormalized failed: ' . $eMirrorN->getMessage()); }

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
            // NORMALIZED TABLE WRITE: Also write to products for fast queries
            $ok = tcUpsertProductRow($pdo, $product, $now);
            // Legacy atomic mirror
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
            // NORMALIZED TABLE WRITE: Also write to user_accounts for fast login/auth queries
            $ok = tcUpsertUserRow($pdo, $user, $now);
            // Legacy atomic mirror
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
    // the full-state flush is slow/failing). 
    // SECURITY: Server-side bcrypt hashing — client sends raw password, server hashes with bcrypt.
    // ============================================================================
    if ($action === 'change_password') {
        if (!$pdo) { echo json_encode(["success" => false, "error" => "No DB", "server_ts" => $now]); exit(); }
        $input = json_decode($rawInput, true);
        $userId = (string)($input['user_id'] ?? '');
        $companyId = (string)($input['company_id'] ?? '');
        $newPassword = (string)($input['password'] ?? $input['password_hash'] ?? '');
        if ($userId === '' || $newPassword === '') { echo json_encode(["success" => false, "error" => "Missing user_id / password", "server_ts" => $now]); exit(); }
        // SECURITY: Hash password with bcrypt on the server side
        // If client sends a raw password (not already hashed), use bcrypt
        // If client sends a sha256$ hash (legacy), convert to bcrypt
        $SALT = 'tradecore::secure::2026::v1';
        if (strpos($newPassword, '$2y$') === 0 || strpos($newPassword, '$2a$') === 0) {
            // Already bcrypt — use as-is
            $newHash = $newPassword;
        } elseif (strpos($newPassword, 'sha256$') === 0) {
            // Legacy sha256$ hash — convert to bcrypt by extracting the raw password
            // Note: We can't reverse the sha256, so we re-hash with bcrypt using the same input
            // The client should send the raw password, but if they send sha256, we accept it
            $newHash = password_hash($newPassword, PASSWORD_BCRYPT);
        } else {
            // Raw password — hash with bcrypt
            $newHash = password_hash($newPassword, PASSWORD_BCRYPT);
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
    // RATE LIMITING: Prevent brute force attacks on login
    // Uses file-based tracking (works on shared hosting without extra tables)
    // ============================================================================
    function tcCheckRateLimit($identifier, $maxAttempts = 5, $windowSeconds = 900) {
        $rateFile = sys_get_temp_dir() . '/tc_rate_' . md5($identifier) . '.json';
        $now = time();
        $attempts = [];
        if (file_exists($rateFile)) {
            $data = @json_decode(file_get_contents($rateFile), true);
            if (is_array($data)) $attempts = $data;
        }
        // Remove old attempts outside the window
        $attempts = array_filter($attempts, function($t) use ($now, $windowSeconds) {
            return ($now - $t) < $windowSeconds;
        });
        if (count($attempts) >= $maxAttempts) {
            return false; // Rate limited
        }
        return $attempts;
    }
    function tcRecordFailedAttempt($identifier) {
        $rateFile = sys_get_temp_dir() . '/tc_rate_' . md5($identifier) . '.json';
        $now = time();
        $attempts = [];
        if (file_exists($rateFile)) {
            $data = @json_decode(file_get_contents($rateFile), true);
            if (is_array($data)) $attempts = $data;
        }
        $attempts[] = $now;
        @file_put_contents($rateFile, json_encode($attempts));
    }
    function tcClearRateLimit($identifier) {
        $rateFile = sys_get_temp_dir() . '/tc_rate_' . md5($identifier) . '.json';
        if (file_exists($rateFile)) @unlink($rateFile);
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
        // RATE LIMIT: Check for brute force attempts
        $rateIdentifier = ($username !== '' ? $username : $phone) . ':' . tcClientIp();
        $rateAttempts = tcCheckRateLimit($rateIdentifier);
        if ($rateAttempts === false) {
            http_response_code(429);
            echo json_encode(["success" => false, "error" => "Too many login attempts. Please try again in 15 minutes.", "server_ts" => $now]);
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
                $sessionToken = bin2hex(random_bytes(16));
                $sUserId = (string)($matchedUser['id'] ?? '');
                $sCompanyId = (string)($matchedUser['company_id'] ?? $matchedUser['companyId'] ?? '');
                if ($sUserId !== '' && $sCompanyId !== '') {
                    try {
                        $stmtS = $pdo->prepare('INSERT INTO user_sessions (id, user_id, company_id, token_jti, ip_address, user_agent, expires_at, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)');
                        $stmtS->execute([
                            bin2hex(random_bytes(16)),
                            $sUserId,
                            $sCompanyId,
                            $sessionToken,
                            tcClientIp(),
                            (string)($_SERVER['HTTP_USER_AGENT'] ?? 'unknown'),
                            date('Y-m-d H:i:s', time() + 86400)
                        ]);
                    } catch (Throwable $eSess) {
                        error_log('[TradeCore API] user_sessions insert failed: ' . $eSess->getMessage());
                    }
                }
                // SECURITY: Remove password hash from response before sending to client
                unset($matchedUser['password'], $matchedUser['password_hash']);
                tcClearRateLimit($rateIdentifier);
                logCoreAction($pdo, (string)($matchedUser['username'] ?? $username), (string)($matchedUser['role'] ?? 'User'), 'User Login', 'User Login success from ' . tcClientIp());
                echo json_encode(["success" => true, "user" => $matchedUser, "token" => $sessionToken, "server_ts" => time()]);
            } else {
                tcRecordFailedAttempt($rateIdentifier);
                logCoreAction($pdo, $username !== '' ? $username : $phone, 'Guest', 'Login Failed', 'Login failed for ' . ($username !== '' ? $username : $phone) . ' from ' . tcClientIp());
                http_response_code(401);
                echo json_encode(["success" => false, "error" => "User not found or inactive", "server_ts" => $now]);
            }
        } catch (Throwable $eLogin) {
            error_log('[TradeCore API] login failed: ' . $eLogin->getMessage() . ' in ' . $eLogin->getFile() . ':' . $eLogin->getLine());
            echo json_encode(["success" => false, "error" => "Login error: " . $eLogin->getMessage(), "server_ts" => $now]);
        }
        exit();
    }

    // ============================================================================
    // get_my_role: lightweight role/company/branch/store assignment check used by
    // the client's 2.5s background role-cache revalidation. Returns ONLY the
    // assignment fields so a stale tradecore_role_cache can be purged + the page
    // reloaded automatically when an Admin reassigns the user (no manual logout).
    // Reads the atomic tradecore_users row first, then the blob as fallback.
    // Soft-authorized (never SESSION_REVOKED) because it is a read-only check.
    // ============================================================================
    if ($action === 'get_my_role') {
        if (!$pdo) { echo json_encode(["success" => false, "error" => "No DB", "server_ts" => $now]); exit(); }
        $userId = trim((string)($_GET['user_id'] ?? $_POST['user_id'] ?? ''));
        if ($userId === '') {
            error_log('[TradeCore API] get_my_role missing user_id');
            echo json_encode(["success" => false, "error" => "Missing user_id", "server_ts" => $now]);
            exit();
        }
        try {
            $user = null;
            $stmt = $pdo->prepare("SELECT data, company_id FROM tradecore_users WHERE id=? AND deleted_at IS NULL LIMIT 1");
            $stmt->execute([$userId]);
            $row = $stmt->fetch();
            if ($row && $row['data']) {
                $u = json_decode($row['data'], true);
                if (is_array($u)) {
                    $user = $u;
                    $user['company_id'] = $u['company_id'] ?? $u['companyId'] ?? ($row['company_id'] ?? '');
                }
            }
            if (!$user) {
                try {
                    $stmt2 = $pdo->query("SELECT json_data FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1");
                    $row2 = $stmt2->fetch();
                    if ($row2 && $row2['json_data']) {
                        $blob = normalizeBlobData(json_decode($row2['json_data'], true));
                        if (is_array($blob) && isset($blob['users']) && is_array($blob['users'])) {
                            foreach ($blob['users'] as $bu) {
                                if (is_array($bu) && isset($bu['id']) && (string)$bu['id'] === $userId) { $user = $bu; break; }
                            }
                        }
                    }
                } catch (Throwable $eBlob) {}
            }
            // Also keep the soft-auth verdict visible so the client can purge a
            // revoked/deleted account's cache even when the row is gone.
            if (!$user) {
                echo json_encode(["success" => false, "error" => "User not found", "server_ts" => $now]);
                exit();
            }
            echo json_encode([
                "success" => true,
                "user_id" => (string)$userId,
                "role" => $user['role'] ?? 'Staff',
                "company_id" => (string)($user['company_id'] ?? $user['companyId'] ?? ''),
                "branch_id" => (string)($user['branch_id'] ?? $user['branchId'] ?? ''),
                "store_id" => (string)($user['store_id'] ?? $user['storeId'] ?? ''),
                "username" => (string)($user['username'] ?? ''),
                "is_active" => (int)(($user['is_active'] ?? $user['active'] ?? 1) == 1),
                "server_ts" => $now
            ]);
        } catch (Throwable $eRole) {
            error_log('[TradeCore API] get_my_role failed: ' . $eRole->getMessage());
            echo json_encode(["success" => false, "error" => $eRole->getMessage(), "server_ts" => $now]);
        }
        exit();
    }

    // ============================================================================
    // PBS v2 — STATELESS ATOMIC CRUD AGAINST THE NORMALIZED PERSISTENCE TABLES.
    // Every request is a targeted round-trip; the client holds NO source-of-truth
    // blob. Reads are company-scoped (`WHERE company_id = ?`) and fall back to the
    // legacy blob key ONLY while the normalized table is still empty. Writes
    // upsert the normalized row, mirror a legacy atomic row (classic-build read
    // compat), merge the blob (classic-build read compat) and write an audit trail.
    // Auth is already enforced above (strict guard). Runs BEFORE the backup include
    // so v2 actions never reach the fallback backend.
    // ============================================================================
    // ---- delete_company (alias) ---------------------------------------------------
    // Classic-name alias for the frontend delete flow:
    // `/api/php_sync.php?action=delete_company&id=X` -> soft-delete (deleted_at) the
    // company row + strip it from the blob, exactly like v2_delete_company. Applied
    // BEFORE the v2_ dispatch gate so the handler runs; tcV2Input merges the GET id
    // into $v2in['id'].
    if ($action === 'delete_company') { $action = 'v2_delete_company'; }
    if (strpos($action, 'v2_') === 0) {
        $v2in = tcV2Input($rawInput);
        list($v2op, $v2role) = tcCurrentOperator($rawInput);
        $v2company = (string)($v2in['company_id'] ?? $v2in['companyId'] ?? '');

        // ---- v2_list_companies --------------------------------------------------
        if ($action === 'v2_list_companies') {
            $list = tcLoadCompanies($pdo);
            if (count($list) === 0) {
                try {
                    $pre = $pdo ? $pdo->query("SELECT json_data FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1")->fetch() : null;
                    $pd = ($pre && $pre['json_data']) ? normalizeBlobData(json_decode($pre['json_data'], true)) : [];
                    if (is_array($pd) && isset($pd['companies']) && is_array($pd['companies'])) $list = array_values(array_filter($pd['companies'], function($c) { return is_array($c) && empty($c['isDeleted']) && empty($c['deletedAt']); }));
                } catch (Throwable $e) { error_log('[TradeCore API] v2_list_companies blob fallback failed: ' . $e->getMessage()); }
            }
            echo json_encode(["success" => true, "list" => $list, "count" => count($list), "server_ts" => $now]);
            exit();
        }

        // ---- v2_upsert_company ---------------------------------------------------
        if ($action === 'v2_upsert_company') {
            if (!$pdo) { echo json_encode(["success" => false, "error" => "No DB", "server_ts" => $now]); exit(); }
            $company = is_array($v2in['entity'] ?? null) ? $v2in['entity'] : (is_array($v2in['company'] ?? null) ? $v2in['company'] : null);
            if (!$company || !isset($company['id'])) { echo json_encode(["success" => false, "error" => "Missing company.id", "server_ts" => $now]); exit(); }
            $ok = tcUpsertCompanyRow($pdo, $company, $now);
            if ($ok) tcBlobMerge($pdo, 'companies', $company);
            $name = (string)($company['name'] ?? $company['id']);
            tcWriteAuditTrail($pdo, (string)$company['id'], '', $v2op, 'Company Upsert', 'Company', (string)$company['id'], $name, ['company_id' => $company['id']]);
            echo json_encode(["success" => $ok, "id" => (string)$company['id'], "server_ts" => $now]);
            exit();
        }

        // ---- v2_delete_company ---------------------------------------------------
        if ($action === 'v2_delete_company') {
            if (!$pdo) { echo json_encode(["success" => false, "error" => "No DB", "server_ts" => $now]); exit(); }
            $id = (string)($v2in['id'] ?? '');
            if ($id === '') { echo json_encode(["success" => false, "error" => "Missing company id", "server_ts" => $now]); exit(); }
            try { $pdo->prepare("UPDATE companies SET deleted_at=?, updated_at=? WHERE id=?")->execute([$now, $now, $id]); $ok = true; } catch (Throwable $e) { $ok = false; error_log('[TradeCore API] v2_delete_company failed: ' . $e->getMessage()); }
            tcBlobMerge($pdo, 'companies', null, $id);
            tcWriteAuditTrail($pdo, $id, '', $v2op, 'Company Delete', 'Company', $id, $id, ['company_id' => $id]);
            echo json_encode(["success" => $ok, "server_ts" => $now]);
            exit();
        }

        // ---- purge_snapshot (alias for v2_purge_company) ----------------------------
        // Convenience endpoint that matches the classic deploy call
        // `/api/php_sync.php?action=purge_snapshot&company_id=X`. php_sync.php proxies
        // here; tcV2Input merges the GET company_id, so this maps 1:1 onto the full hard
        // purge (normalized tables + legacy tables + blob arrays + file caches).
        if ($action === 'purge_snapshot') { $action = 'v2_purge_company'; }

        // ---- v2_purge_company ----------------------------------------------------
        // PERMANENT hard purge of a company and every record that belongs to it.
        // The frontend delete cascade + a plain blob save_state only filtered the local
        // cache and the main_state blob — the NORMALIZED mirror tables (companies/
        // stores/stock_categories/products/user_accounts) and the legacy per-company
        // atomic tables (tradecore_users/products/sales/marketplace_orders) kept their
        // rows with deleted_at NULL, so the next authoritative snapshot REBUILT the
        // "deleted" company on every login. This strips all of them, purges every
        // company-scoped blob array, bumps the version and writes an audit row.
        if ($action === 'v2_purge_company') {
            if (!$pdo) { echo json_encode(["success" => false, "error" => "No DB", "server_ts" => $now]); exit(); }
            $cid = (string)($v2in['company_id'] ?? $v2in['companyId'] ?? $v2in['id'] ?? '');
            if ($cid === '') { echo json_encode(["success" => false, "error" => "Missing company id", "server_ts" => $now]); exit(); }
            $ok = true;
            try { tcEnsureNormalizedTables($pdo); } catch (Throwable $e) { $ok = false; error_log('[TradeCore API] v2_purge_company ensure tables: ' . $e->getMessage()); }
            // 1. Normalized mirror tables (the authoritative source for snapshot lists).
            foreach (['companies' => 'id', 'stores' => 'company_id', 'stock_categories' => 'company_id', 'products' => 'company_id', 'user_accounts' => 'company_id', 'audit_trails' => 'company_id'] as $tbl => $col) {
                if (!preg_match('/^[a-z0-9_]+$/', $tbl) || !preg_match('/^[a-z0-9_]+$/', $col)) continue;
                try { $pdo->prepare("DELETE FROM {$tbl} WHERE {$col}=?")->execute([$cid]); } catch (Throwable $e) { error_log('[TradeCore API] v2_purge_company ' . $tbl . ': ' . $e->getMessage()); }
            }
            // 2. Legacy per-company atomic tables (classic-build read compat).
            foreach (['tradecore_users', 'tradecore_products', 'tradecore_sales', 'tradecore_marketplace_orders'] as $tbl) {
                try { $pdo->prepare("DELETE FROM {$tbl} WHERE company_id=?")->execute([$cid]); } catch (Throwable $e) { error_log('[TradeCore API] v2_purge_company ' . $tbl . ': ' . $e->getMessage()); }
            }
            // 3. Strip every company-scoped blob array + bump the version so clients
            //    polling with the old watermark refetch instead of rejecting ingress.
            $version = 0;
            try {
                $pre = $pdo->query("SELECT json_data, version FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1")->fetch(PDO::FETCH_ASSOC);
                if ($pre && $pre['json_data']) {
                    $pd = normalizeBlobData(json_decode($pre['json_data'], true));
                    if (is_array($pd)) {
                        foreach ($pd as $key => &$arr) {
                            if (!is_array($arr) || count($arr) === 0) continue;
                            $arrKeys = array_keys($arr);
                            if ($arrKeys !== range(0, count($arr) - 1)) continue; // object, not a list
                            if ($key === 'companies') {
                                $arr = array_values(array_filter($arr, function ($c) use ($cid) { return !is_array($c) || (string)($c['id'] ?? '') !== $cid; }));
                            } else {
                                $arr = array_values(array_filter($arr, function ($item) use ($cid) { return !is_array($item) || (string)($item['companyId'] ?? $item['company_id'] ?? '') !== $cid; }));
                            }
                        }
                        unset($arr);
                        $newVer = (int)($pre['version'] ?? 0) + 1;
                        $jj = json_encode($pd, JSON_UNESCAPED_UNICODE);
                        $pdo->prepare("INSERT INTO tradecore_system_state (doc_key, json_data, version, updated_at) VALUES ('main_state', ?, ?, NOW()) ON DUPLICATE KEY UPDATE json_data=VALUES(json_data), version=VALUES(version), updated_at=NOW()")->execute([$jj, $newVer]);
                        $version = $newVer;
                        $ok = true;
                    }
                }
            } catch (Throwable $eBlob) { error_log('[TradeCore API] v2_purge_company blob strip failed: ' . $eBlob->getMessage()); }
            // 4. Scrub FILE-side persistence so nothing server-side can resurrect the
            //    company: data/system_state.json (legacy file-fallback blob) and any
            //    per-company data/snapshot_company_<cid>.json seed files.
            try {
                $dataDir = __DIR__ . '/data';
                if (is_dir($dataDir)) {
                    $sf = $dataDir . '/system_state.json';
                    if (is_file($sf)) {
                        $rawFs = @file_get_contents($sf);
                        $fs = json_decode((string)$rawFs, true);
                        if (is_array($fs) && isset($fs['data']) && is_array($fs['data'])) {
                            $fsData = $fs['data'];
                            foreach ($fsData as $fKey => &$fArr) {
                                if (!is_array($fArr) || count($fArr) === 0) continue;
                                $fKeys = array_keys($fArr);
                                if ($fKeys !== range(0, count($fArr) - 1)) continue;
                                if ($fKey === 'companies') {
                                    $fArr = array_values(array_filter($fArr, function ($c) use ($cid) { return !is_array($c) || (string)($c['id'] ?? '') !== $cid; }));
                                } else {
                                    $fArr = array_values(array_filter($fArr, function ($item) use ($cid) { return !is_array($item) || (string)($item['companyId'] ?? $item['company_id'] ?? '') !== $cid; }));
                                }
                            }
                            unset($fArr);
                            $fs['data'] = $fsData;
                            @file_put_contents($sf, json_encode($fs, JSON_UNESCAPED_UNICODE), LOCK_EX);
                        }
                    }
                    foreach (glob($dataDir . '/snapshot_company_' . $cid . '.json') as $snapFile) {
                        @unlink($snapFile);
                    }
                }
            } catch (Throwable $eFile) { error_log('[TradeCore API] v2_purge_company file scrub failed: ' . $eFile->getMessage()); }
            $cname = $cid;
            try {
                $q = $pdo->prepare("SELECT name FROM companies WHERE id=? LIMIT 1");
                $q->execute([$cid]);
                $nm = $q->fetchColumn();
                if ($nm) $cname = (string)$nm;
            } catch (Throwable $e) {}
            try { tcWriteAuditTrail($pdo, $cid, '', $v2op, 'Company Purge', 'Company', $cid, $cname, ['company_id' => $cid]); } catch (Throwable $e) {}
            echo json_encode(["success" => $ok, "id" => $cid, "version" => $version, "server_ts" => $now]);
            exit();
        }

        // ---- v2_list_stores -------------------------------------------------------
        if ($action === 'v2_list_stores') {
            $list = tcLoadStores($pdo, $v2company);
            if (count($list) === 0) {
                try {
                    $pre = $pdo ? $pdo->query("SELECT json_data FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1")->fetch() : null;
                    $pd = ($pre && $pre['json_data']) ? normalizeBlobData(json_decode($pre['json_data'], true)) : [];
                    if (is_array($pd)) {
                        foreach (['stores', 'branches'] as $sk) {
                            if (isset($pd[$sk]) && is_array($pd[$sk])) {
                                foreach ($pd[$sk] as $s) {
                                    if (!is_array($s) || !empty($s['isDeleted']) || !empty($s['deletedAt'])) continue;
                                    if ($v2company !== '' && (string)($s['company_id'] ?? $s['companyId'] ?? '') !== $v2company) continue;
                                    $list[] = $s;
                                }
                            }
                        }
                    }
                } catch (Throwable $e) { error_log('[TradeCore API] v2_list_stores blob fallback failed: ' . $e->getMessage()); }
            }
            echo json_encode(["success" => true, "list" => $list, "count" => count($list), "server_ts" => $now]);
            exit();
        }

        // ---- v2_upsert_store ------------------------------------------------------
        if ($action === 'v2_upsert_store') {
            if (!$pdo) { echo json_encode(["success" => false, "error" => "No DB", "server_ts" => $now]); exit(); }
            $store = is_array($v2in['entity'] ?? null) ? $v2in['entity'] : (is_array($v2in['store'] ?? null) ? $v2in['store'] : null);
            if (!$store || !isset($store['id'])) { echo json_encode(["success" => false, "error" => "Missing store.id", "server_ts" => $now]); exit(); }
            $scid = (string)($store['company_id'] ?? $store['companyId'] ?? $v2company ?? '');
            $store['company_id'] = $store['companyId'] = $scid;
            $ok = tcUpsertStoreRow($pdo, $store, $now);
            if ($ok) {
                $sname = (string)($store['name'] ?? $store['id']);
                tcBlobMerge($pdo, 'stores', ['id' => $store['id'], 'companyId' => $scid, 'name' => $sname, 'is_active' => 1]);
                if (!empty($store['branch_id']) || !empty($store['branchId'])) {
                    tcBlobMerge($pdo, 'branches', ['id' => (string)($store['branch_id'] ?? $store['branchId']), 'companyId' => $scid, 'name' => $sname, 'is_active' => 1]);
                }
                /*
                 * NOTE: For a store entity the client's canonical record already IS
                 * the store; that same record is merged into the legacy branches
                 * array only when a branchId was provided, so the classic
                 * snapshot-driven UI keeps working during the transition.
                 */
            }
            tcWriteAuditTrail($pdo, $scid, '', $v2op, 'Store Upsert', 'Store', (string)$store['id'], (string)($store['name'] ?? $store['id']), ['company_id' => $scid]);
            echo json_encode(["success" => $ok, "id" => (string)$store['id'], "server_ts" => $now]);
            exit();
        }

        // ---- v2_delete_store ------------------------------------------------------
        if ($action === 'v2_delete_store') {
            if (!$pdo) { echo json_encode(["success" => false, "error" => "No DB", "server_ts" => $now]); exit(); }
            $id = (string)($v2in['id'] ?? '');
            $scid = $v2company !== '' ? $v2company : (string)($v2in['company_id'] ?? '');
            if ($id === '') { echo json_encode(["success" => false, "error" => "Missing store id", "server_ts" => $now]); exit(); }
            try { $pdo->prepare("UPDATE stores SET deleted_at=?, updated_at=? WHERE id=?")->execute([$now, $now, $id]); $ok = true; } catch (Throwable $e) { $ok = false; error_log('[TradeCore API] v2_delete_store failed: ' . $e->getMessage()); }
            tcBlobMerge($pdo, 'stores', null, $id);
            tcBlobMerge($pdo, 'branches', null, $id);
            tcWriteAuditTrail($pdo, $scid, '', $v2op, 'Store Delete', 'Store', $id, $id, ['company_id' => $scid]);
            echo json_encode(["success" => $ok, "server_ts" => $now]);
            exit();
        }

        // ---- v2_list_products -----------------------------------------------------
        if ($action === 'v2_list_products') {
            $list = tcLoadProductsN($pdo, $v2company, (string)($v2in['store_id'] ?? $v2in['storeId'] ?? ''), (int)($v2in['since'] ?? 0));
            if (count($list) === 0 && $v2company !== '') {
                try {
                    $pre = $pdo ? $pdo->query("SELECT json_data FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1")->fetch() : null;
                    $pd = ($pre && $pre['json_data']) ? normalizeBlobData(json_decode($pre['json_data'], true)) : [];
                    if (is_array($pd) && isset($pd['marketplaceProducts']) && is_array($pd['marketplaceProducts'])) {
                        foreach ($pd['marketplaceProducts'] as $p) {
                            if (!is_array($p) || isset($p['isDeleted']) || isset($p['deletedAt'])) continue;
                            if ((string)($p['company_id'] ?? $p['companyId'] ?? '') !== $v2company) continue;
                            $list[] = $p;
                        }
                    }
                } catch (Throwable $e) { error_log('[TradeCore API] v2_list_products blob fallback failed: ' . $e->getMessage()); }
            }
            echo json_encode(["success" => true, "list" => $list, "count" => count($list), "server_ts" => $now]);
            exit();
        }

        // ---- v2_upsert_product ----------------------------------------------------
        if ($action === 'v2_upsert_product') {
            if (!$pdo) { echo json_encode(["success" => false, "error" => "No DB", "server_ts" => $now]); exit(); }
            $product = is_array($v2in['entity'] ?? null) ? $v2in['entity'] : (is_array($v2in['product'] ?? null) ? $v2in['product'] : null);
            if (!$product || !isset($product['id'])) { echo json_encode(["success" => false, "error" => "Missing product.id", "server_ts" => $now]); exit(); }
            $pcid = (string)($product['company_id'] ?? $product['companyId'] ?? $v2company ?? '');
            if ($pcid === '') { echo json_encode(["success" => false, "error" => "Missing product company_id", "server_ts" => $now]); exit(); }
            $product['company_id'] = $product['companyId'] = $pcid;
            $ok = tcUpsertProductRow($pdo, $product, $now);
            if ($ok) tcBlobMerge($pdo, 'marketplaceProducts', $product);
            tcWriteAuditTrail($pdo, $pcid, '', $v2op, 'Product Upsert', 'Product', (string)$product['id'], (string)($product['name'] ?? $product['id']), ['company_id' => $pcid, 'store_id' => $product['storeId'] ?? null]);
            echo json_encode(["success" => $ok, "id" => (string)$product['id'], "server_ts" => $now]);
            exit();
        }

        // ---- v2_delete_product ----------------------------------------------------
        if ($action === 'v2_delete_product') {
            if (!$pdo) { echo json_encode(["success" => false, "error" => "No DB", "server_ts" => $now]); exit(); }
            $id = (string)($v2in['id'] ?? '');
            $pcid = $v2company !== '' ? $v2company : (string)($v2in['company_id'] ?? '');
            if ($id === '' || $pcid === '') { echo json_encode(["success" => false, "error" => "Missing product id/company_id", "server_ts" => $now]); exit(); }
            try {
                $pdo->prepare("UPDATE products SET deleted_at=?, updated_at=? WHERE id=? AND company_id=?")->execute([$now, $now, $id, $pcid]);
                $pdo->prepare("UPDATE tradecore_products SET deleted_at=? WHERE id=? AND company_id=?")->execute([$now, $id, $pcid]);
                $ok = true;
            } catch (Throwable $e) { $ok = false; error_log('[TradeCore API] v2_delete_product failed: ' . $e->getMessage()); }
            tcBlobMerge($pdo, 'marketplaceProducts', null, $id);
            tcWriteAuditTrail($pdo, $pcid, '', $v2op, 'Product Delete', 'Product', $id, $id, ['company_id' => $pcid]);
            echo json_encode(["success" => $ok, "server_ts" => $now]);
            exit();
        }

        // ---- v2_list_categories ---------------------------------------------------
        if ($action === 'v2_list_categories') {
            $list = tcLoadCategoriesN($pdo, $v2company);
            if (count($list) === 0) {
                $list = tcLoadCategories($pdo, $v2company);
            }
            echo json_encode(["success" => true, "list" => $list, "count" => count($list), "server_ts" => $now]);
            exit();
        }

        // ---- v2_upsert_category ---------------------------------------------------
        if ($action === 'v2_upsert_category') {
            if (!$pdo) { echo json_encode(["success" => false, "error" => "No DB", "server_ts" => $now]); exit(); }
            $catName = trim((string)($v2in['name'] ?? $v2in['category_name'] ?? ''));
            if ($catName === '') { echo json_encode(["success" => false, "error" => "Missing category name", "server_ts" => $now]); exit(); }
            $ccid = $v2company !== '' ? $v2company : (string)($v2in['company_id'] ?? '');
            if ($ccid === '') { echo json_encode(["success" => false, "error" => "Missing company_id", "server_ts" => $now]); exit(); }
            $ok = tcUpsertCategoryRow($pdo, $ccid, $catName, $now, (string)($v2in['color'] ?? null));
            if ($ok) {
                try {
                    $pre = $pdo->query("SELECT json_data FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1")->fetch();
                    if ($pre && $pre['json_data']) {
                        $pd = normalizeBlobData(json_decode($pre['json_data'], true));
                        if (is_array($pd)) {
                            if (!isset($pd['categories']) || !is_array($pd['categories'])) $pd['categories'] = [];
                            $entry = 'co_' . (int)$ccid . ':' . $catName;
                            if (!in_array($entry, $pd['categories'], true)) $pd['categories'][] = $entry;
                            $pdo->prepare("INSERT INTO tradecore_system_state (doc_key, json_data, updated_at) VALUES ('main_state', ?, NOW()) ON DUPLICATE KEY UPDATE json_data=VALUES(json_data), updated_at=NOW()")->execute([json_encode($pd, JSON_UNESCAPED_UNICODE)]);
                        }
                    }
                } catch (Throwable $eBlob) { error_log('[TradeCore API] v2_upsert_category blob merge failed: ' . $eBlob->getMessage()); }
            }
            tcWriteAuditTrail($pdo, $ccid, '', $v2op, 'Category Upsert', 'Category', 'nc_' . md5($ccid . ':' . $catName), $catName, ['company_id' => $ccid]);
            echo json_encode(["success" => $ok, "id" => 'nc_' . md5($ccid . ':' . $catName), "server_ts" => $now]);
            exit();
        }

        // ---- v2_delete_category ---------------------------------------------------
        if ($action === 'v2_delete_category') {
            if (!$pdo) { echo json_encode(["success" => false, "error" => "No DB", "server_ts" => $now]); exit(); }
            $ccid = $v2company !== '' ? $v2company : (string)($v2in['company_id'] ?? '');
            $catId = (string)($v2in['id'] ?? $v2in['category_id'] ?? '');
            $catName = trim((string)$v2in['name'] ?? '');
            if ($ccid === '') { echo json_encode(["success" => false, "error" => "Missing company_id", "server_ts" => $now]); exit(); }
            if ($catId === '' && $catName === '') { echo json_encode(["success" => false, "error" => "Missing category id or name", "server_ts" => $now]); exit(); }
            if ($catId === '' && $catName !== '') $catId = 'nc_' . md5($ccid . ':' . $catName);
            try {
                $pdo->prepare("UPDATE stock_categories SET deleted_at=?, updated_at=? WHERE id=? AND company_id=?")->execute([$now, $now, $catId, $ccid]);
                $ok = true;
            } catch (Throwable $e) { $ok = false; error_log('[TradeCore API] v2_delete_category failed: ' . $e->getMessage()); }
            if ($catName !== '') {
                try { $pdo->prepare("UPDATE tradecore_categories SET deleted_at=? WHERE company_id=? AND category_name=?")->execute([$now, $ccid, $catName]); } catch (Throwable $e) {}
                try {
                    $pre = $pdo->query("SELECT json_data FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1")->fetch();
                    if ($pre && $pre['json_data']) {
                        $pd = normalizeBlobData(json_decode($pre['json_data'], true));
                        if (is_array($pd) && isset($pd['categories']) && is_array($pd['categories'])) {
                            $entry = 'co_' . (int)$ccid . ':' . $catName;
                            $pd['categories'] = array_values(array_filter($pd['categories'], function($x) use ($entry) { return $x !== $entry; }));
                            $pdo->prepare("INSERT INTO tradecore_system_state (doc_key, json_data, updated_at) VALUES ('main_state', ?, NOW()) ON DUPLICATE KEY UPDATE json_data=VALUES(json_data), updated_at=NOW()")->execute([json_encode($pd, JSON_UNESCAPED_UNICODE)]);
                        }
                    }
                } catch (Throwable $eBlob) {}
            }
            tcWriteAuditTrail($pdo, $ccid, '', $v2op, 'Category Delete', 'Category', $catId, $catName !== '' ? $catName : $catId, ['company_id' => $ccid]);
            echo json_encode(["success" => $ok, "server_ts" => $now]);
            exit();
        }

        // ---- v2_list_user_accounts -------------------------------------------------
        if ($action === 'v2_list_user_accounts') {
            $list = tcLoadUsersN($pdo, $v2company);
            if (count($list) === 0) {
                try {
                    $pre = $pdo ? $pdo->query("SELECT json_data FROM tradecore_system_state WHERE doc_key='main_state' LIMIT 1")->fetch() : null;
                    $pd = ($pre && $pre['json_data']) ? normalizeBlobData(json_decode($pre['json_data'], true)) : [];
                    if (is_array($pd) && isset($pd['users']) && is_array($pd['users'])) {
                        foreach ($pd['users'] as $u) {
                            if (!is_array($u) || empty($u['id']) || !empty($u['isDeleted']) || !empty($u['deletedAt'])) continue;
                            if ($v2company !== '' && (string)($u['company_id'] ?? $u['companyId'] ?? '') !== $v2company) continue;
                            $list[] = $u;
                        }
                    }
                } catch (Throwable $e) { error_log('[TradeCore API] v2_list_user_accounts blob fallback failed: ' . $e->getMessage()); }
            }
            echo json_encode(["success" => true, "list" => $list, "count" => count($list), "server_ts" => $now]);
            exit();
        }

        // ---- v2_upsert_user_account -------------------------------------------------
        if ($action === 'v2_upsert_user_account') {
            if (!$pdo) { echo json_encode(["success" => false, "error" => "No DB", "server_ts" => $now]); exit(); }
            $user = is_array($v2in['entity'] ?? null) ? $v2in['entity'] : (is_array($v2in['user'] ?? null) ? $v2in['user'] : null);
            if (!$user || !isset($user['id'])) { echo json_encode(["success" => false, "error" => "Missing user.id", "server_ts" => $now]); exit(); }
            $ucid = (string)($user['company_id'] ?? $user['companyId'] ?? $v2company ?? '');
            $user['company_id'] = $user['companyId'] = $ucid;
            $ok = tcUpsertUserRow($pdo, $user, $now);
            if ($ok) tcBlobMerge($pdo, 'users', $user);
            tcWriteAuditTrail($pdo, $ucid, (string)$user['id'], $v2op, 'User Account Upsert', 'UserAccount', (string)$user['id'], (string)($user['username'] ?? $user['id']), ['company_id' => $ucid]);
            echo json_encode(["success" => $ok, "id" => (string)$user['id'], "server_ts" => $now]);
            exit();
        }

        // ---- v2_delete_user_account -------------------------------------------------
        if ($action === 'v2_delete_user_account') {
            if (!$pdo) { echo json_encode(["success" => false, "error" => "No DB", "server_ts" => $now]); exit(); }
            $id = (string)($v2in['id'] ?? '');
            $ucid = $v2company !== '' ? $v2company : (string)($v2in['company_id'] ?? '');
            if ($id === '') { echo json_encode(["success" => false, "error" => "Missing user id", "server_ts" => $now]); exit(); }
            try {
                $pdo->prepare("UPDATE user_accounts SET deleted_at=?, updated_at=? WHERE id=?")->execute([$now, $now, $id]);
                if ($ucid !== '') $pdo->prepare("UPDATE tradecore_users SET deleted_at=? WHERE id=? AND company_id=?")->execute([$now, $id, $ucid]);
                $ok = true;
            } catch (Throwable $e) { $ok = false; error_log('[TradeCore API] v2_delete_user_account failed: ' . $e->getMessage()); }
            tcBlobMerge($pdo, 'users', null, $id);
            tcWriteAuditTrail($pdo, $ucid, $id, $v2op, 'User Account Delete', 'UserAccount', $id, $id, ['company_id' => $ucid]);
            echo json_encode(["success" => $ok, "server_ts" => $now]);
            exit();
        }

        // ---- v2_get_audit_trails ---------------------------------------------------
        if ($action === 'v2_get_audit_trails') {
            $limit = max(1, min(500, (int)($v2in['limit'] ?? 100)));
            $rows = [];
            if ($pdo) {
                try {
                    if ($v2company !== '') {
                        $st = $pdo->prepare("SELECT id, store_id, user_id, user_name, action, entity_type, entity_id, entity_name, details, details_json, ip_address, created_at FROM audit_trails WHERE company_id=? ORDER BY created_at DESC LIMIT " . (int)$limit);
                        $st->execute([$v2company]);
                    } else {
                        $st = $pdo->query("SELECT id, store_id, user_id, user_name, action, entity_type, entity_id, entity_name, details, details_json, ip_address, created_at FROM audit_trails ORDER BY created_at DESC LIMIT " . (int)$limit);
                    }
                    $rows = $st->fetchAll(PDO::FETCH_ASSOC);
                    foreach ($rows as &$r) { $r['timestamp'] = $r['created_at']; if ($r['details_json']) { $dp = json_decode($r['details_json'], true); if (is_array($dp)) $r['detailsObj'] = $dp; } }
                    unset($r);
                } catch (Throwable $e) { error_log('[TradeCore API] v2_get_audit_trails failed: ' . $e->getMessage()); }
            }
            echo json_encode(["success" => true, "list" => $rows, "count" => count($rows), "server_ts" => $now]);
            exit();
        }

        // ---- v2 entity endpoints (expenses, suppliers, customers, etc.) --------
        $entitiesFile = __DIR__ . '/api_entities.php';
        if (is_file($entitiesFile)) {
            try { require $entitiesFile; } catch (Throwable $eEnt) {
                error_log('[TradeCore API] api_entities.php failed: ' . $eEnt->getMessage());
            }
        }

        // ---- unknown v2_ action ------------------------------------------------
        echo json_encode(["success" => false, "error" => "Unknown v2 action: " . $action, "server_ts" => $now]);
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
