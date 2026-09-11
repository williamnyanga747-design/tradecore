<?php
/**
 * api_entities.php — Atomic CRUD endpoints for all entity tables.
 * Included by api.php when action starts with "v2_".
 *
 * Expects from parent scope: $pdo, $now, $rawInput
 * Uses helpers: tcV2Input(), tcCurrentOperator(), tcWriteAuditTrail()
 */

if (!$pdo || strpos($action, 'v2_') !== 0) return;

$v2in = tcV2Input($rawInput);
list($v2op, $v2role) = tcCurrentOperator($rawInput);
$v2company = (string)($v2in['company_id'] ?? $v2in['companyId'] ?? '');

// Helper: build UPDATE SET clause from allowed fields
function tcBuildUpdate($fields, $entity) {
    $sets = []; $vals = [];
    foreach ($fields as $f => $def) {
        if (array_key_exists($f, $entity) || $def === 'required') {
            $v = $entity[$f] ?? null;
            if (is_array($v)) $v = json_encode($v);
            $sets[] = "`$f` = ?";
            $vals[] = $v;
        }
    }
    return [$sets, $vals];
}

// Helper: build INSERT from allowed fields
function tcBuildInsert($table, $fields, $entity, $extra = []) {
    $cols = []; $ph = []; $vals = [];
    foreach ($extra as $k => $v) { $cols[] = "`$k`"; $ph[] = '?'; $vals[] = $v; }
    foreach ($fields as $f => $def) {
        if (array_key_exists($f, $entity) || $def === 'required') {
            $v = $entity[$f] ?? null;
            if (is_array($v)) $v = json_encode($v);
            $cols[] = "`$f`"; $ph[] = '?'; $vals[] = $v;
        }
    }
    $sql = "INSERT INTO `$table` (" . implode(',', $cols) . ") VALUES (" . implode(',', $ph) . ")";
    return [$sql, $vals];
}

// Helper: upsert pattern — try UPDATE first, then INSERT
function tcUpsertRow($pdo, $table, $id, $insertSql, $insertVals, $updateSets, $updateVals, $extraCols = []) {
    // Try update
    if (!empty($updateSets)) {
        $usql = "UPDATE `$table` SET " . implode(',', $updateSets) . " WHERE `id` = ? AND `deleted_at` IS NULL";
        $uvals = array_merge($updateVals, [$id]);
        $stmt = $pdo->prepare($usql);
        $stmt->execute($uvals);
        if ($stmt->rowCount() > 0) return true;
    }
    // Insert
    $stmt = $pdo->prepare($insertSql);
    $stmt->execute($insertVals);
    return $stmt->rowCount() > 0;
}

// BUILD 2026-09-08-19 (Required Fix 3): SCOPED SOFT/HARD DELETE. When a company scope
// is supplied, the UPDATE/DELETE is additionally bound to `AND company_id = ?` so a
// multi-tenant row can NEVER be soft-deleted (or removed) by a caller that does not own
// it — fixes the wrong-company deleted-row bug and keeps root_mandate impersonation
// deletes inside the intended tenant. Falls back to id-only when no scope is sent
// (legacy callers). Returns success without throwing (never breaks a batch).
function tcV2ScopedDelete($pdo, $table, $id, $cid, $hard = false, $withUpdated = true) {
    global $now;
    try {
        if ($hard) {
            if ($cid !== '') { $pdo->prepare("DELETE FROM `$table` WHERE id=? AND company_id=?")->execute([$id, $cid]); }
            else { $pdo->prepare("DELETE FROM `$table` WHERE id=?")->execute([$id]); }
        } else {
            if ($withUpdated) {
                if ($cid !== '') { $pdo->prepare("UPDATE `$table` SET deleted_at=?, updated_at=? WHERE id=? AND company_id=?")->execute([$now, $now, $id, $cid]); }
                else { $pdo->prepare("UPDATE `$table` SET deleted_at=?, updated_at=? WHERE id=?")->execute([$now, $now, $id]); }
            } else {
                if ($cid !== '') { $pdo->prepare("UPDATE `$table` SET deleted_at=? WHERE id=? AND company_id=?")->execute([$now, $id, $cid]); }
                else { $pdo->prepare("UPDATE `$table` SET deleted_at=? WHERE id=?")->execute([$now, $id]); }
            }
        }
        return true;
    } catch (Throwable $e) { error_log('[API] v2 delete ' . $table . ' #' . $id . ': ' . $e->getMessage()); return false; }
}

// ============================================================================
// EXPENSES
// ============================================================================
if ($action === 'v2_list_expenses') {
    $cid = (string)($v2in['company_id'] ?? '');
    if ($cid === '') { echo json_encode(["success" => false, "error" => "Missing company_id"]); exit(); }
    $rows = [];
    try {
        $stmt = $pdo->prepare("SELECT * FROM expenses WHERE company_id = ? AND deleted_at IS NULL ORDER BY date DESC");
        $stmt->execute([$cid]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $e) { error_log('[API] v2_list_expenses: ' . $e->getMessage()); }
    echo json_encode(["success" => true, "list" => $rows, "count" => count($rows), "server_ts" => $now]);
    exit();
}
if ($action === 'v2_upsert_expense') {
    $e = $v2in['entity'] ?? $v2in['expense'] ?? null;
    if (!$e || !isset($e['id'])) { echo json_encode(["success" => false, "error" => "Missing expense.id"]); exit(); }
    $cid = (string)($e['company_id'] ?? $v2in['company_id'] ?? '');
    if ($cid === '') { echo json_encode(["success" => false, "error" => "Missing company_id"]); exit(); }
    $fields = ['company_id'=>'required','store_id'=>'','category'=>'required','description'=>'','amount'=>'required','currency_code'=>'','amount_tzs'=>'required','date'=>'required','receipt_image'=>'','payment_method'=>'','reference'=>'','approved_by'=>'','status'=>''];
    $e['company_id'] = $cid;
    [$uS, $uV] = tcBuildUpdate($fields, $e);
    [$iS, $iV] = tcBuildInsert('expenses', $fields, $e, ['created_at' => $now, 'updated_at' => $now, 'deleted_at' => null]);
    $ok = tcUpsertRow($pdo, 'expenses', $e['id'], $iS, $iV, $uS, $uV);
    tcWriteAuditTrail($pdo, $cid, '', $v2op, 'Expense Upsert', 'Expense', $e['id'], $e['category'] ?? '', ['amount' => $e['amount'] ?? '']);
    echo json_encode(["success" => $ok, "id" => $e['id'], "server_ts" => $now]);
    exit();
}
if ($action === 'v2_delete_expense') {
    $id = (string)($v2in['id'] ?? '');
    if ($id === '') { echo json_encode(["success" => false, "error" => "Missing id"]); exit(); }
    $cid = (string)($v2in['company_id'] ?? $v2in['companyId'] ?? '');
    $ok = tcV2ScopedDelete($pdo, 'expenses', $id, $cid);
    tcWriteAuditTrail($pdo, $cid !== '' ? $cid : null, '', $v2op, 'Expense Delete', 'Expense', $id, '');
    echo json_encode(["success" => $ok, "server_ts" => $now]);
    exit();
}

// ============================================================================
// SUPPLIERS
// ============================================================================
if ($action === 'v2_list_suppliers') {
    $cid = (string)($v2in['company_id'] ?? '');
    if ($cid === '') { echo json_encode(["success" => false, "error" => "Missing company_id"]); exit(); }
    $rows = [];
    try {
        $stmt = $pdo->prepare("SELECT * FROM suppliers WHERE company_id = ? AND deleted_at IS NULL ORDER BY name ASC");
        $stmt->execute([$cid]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $e) { error_log('[API] v2_list_suppliers: ' . $e->getMessage()); }
    echo json_encode(["success" => true, "list" => $rows, "count" => count($rows), "server_ts" => $now]);
    exit();
}
if ($action === 'v2_upsert_supplier') {
    $e = $v2in['entity'] ?? $v2in['supplier'] ?? null;
    if (!$e || !isset($e['id'])) { echo json_encode(["success" => false, "error" => "Missing supplier.id"]); exit(); }
    $cid = (string)($e['company_id'] ?? $v2in['company_id'] ?? '');
    if ($cid === '') { echo json_encode(["success" => false, "error" => "Missing company_id"]); exit(); }
    $fields = ['company_id'=>'required','name'=>'required','phone'=>'','email'=>'','address'=>'','city'=>'','contact_person'=>'','tax_id'=>'','notes'=>'','is_active'=>''];
    $e['company_id'] = $cid;
    [$uS, $uV] = tcBuildUpdate($fields, $e);
    [$iS, $iV] = tcBuildInsert('suppliers', $fields, $e, ['created_at' => $now, 'updated_at' => $now, 'deleted_at' => null]);
    $ok = tcUpsertRow($pdo, 'suppliers', $e['id'], $iS, $iV, $uS, $uV);
    tcWriteAuditTrail($pdo, $cid, '', $v2op, 'Supplier Upsert', 'Supplier', $e['id'], $e['name'] ?? '');
    echo json_encode(["success" => $ok, "id" => $e['id'], "server_ts" => $now]);
    exit();
}
if ($action === 'v2_delete_supplier') {
    $id = (string)($v2in['id'] ?? '');
    if ($id === '') { echo json_encode(["success" => false, "error" => "Missing id"]); exit(); }
    $cid = (string)($v2in['company_id'] ?? $v2in['companyId'] ?? '');
    $ok = tcV2ScopedDelete($pdo, 'suppliers', $id, $cid);
    tcWriteAuditTrail($pdo, $cid !== '' ? $cid : null, '', $v2op, 'Supplier Delete', 'Supplier', $id, '');
    echo json_encode(["success" => $ok, "server_ts" => $now]);
    exit();
}

// ============================================================================
// PURCHASE ORDERS
// ============================================================================
if ($action === 'v2_list_purchase_orders') {
    $cid = (string)($v2in['company_id'] ?? '');
    if ($cid === '') { echo json_encode(["success" => false, "error" => "Missing company_id"]); exit(); }
    $rows = [];
    try {
        $stmt = $pdo->prepare("SELECT * FROM purchase_orders WHERE company_id = ? AND deleted_at IS NULL ORDER BY created_at DESC");
        $stmt->execute([$cid]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as &$r) { if (!empty($r['items']) && is_string($r['items'])) $r['items'] = json_decode($r['items'], true); }
    } catch (Throwable $e) { error_log('[API] v2_list_purchase_orders: ' . $e->getMessage()); }
    echo json_encode(["success" => true, "list" => $rows, "count" => count($rows), "server_ts" => $now]);
    exit();
}
if ($action === 'v2_upsert_purchase_order') {
    $e = $v2in['entity'] ?? $v2in['purchase_order'] ?? null;
    if (!$e || !isset($e['id'])) { echo json_encode(["success" => false, "error" => "Missing purchase_order.id"]); exit(); }
    $cid = (string)($e['company_id'] ?? $v2in['company_id'] ?? '');
    if ($cid === '') { echo json_encode(["success" => false, "error" => "Missing company_id"]); exit(); }
    $fields = ['company_id'=>'required','store_id'=>'','supplier_id'=>'','supplier_name'=>'','order_number'=>'required','status'=>'','items'=>'required','subtotal'=>'required','tax_amount'=>'','total'=>'required','currency_code'=>'','notes'=>'','expected_date'=>'','received_date'=>'','received_by'=>''];
    $e['company_id'] = $cid;
    [$uS, $uV] = tcBuildUpdate($fields, $e);
    [$iS, $iV] = tcBuildInsert('purchase_orders', $fields, $e, ['created_at' => $now, 'updated_at' => $now, 'deleted_at' => null]);
    $ok = tcUpsertRow($pdo, 'purchase_orders', $e['id'], $iS, $iV, $uS, $uV);
    tcWriteAuditTrail($pdo, $cid, '', $v2op, 'Purchase Order Upsert', 'PurchaseOrder', $e['id'], $e['order_number'] ?? '');
    echo json_encode(["success" => $ok, "id" => $e['id'], "server_ts" => $now]);
    exit();
}
if ($action === 'v2_delete_purchase_order') {
    $id = (string)($v2in['id'] ?? '');
    if ($id === '') { echo json_encode(["success" => false, "error" => "Missing id"]); exit(); }
    $cid = (string)($v2in['company_id'] ?? $v2in['companyId'] ?? '');
    $ok = tcV2ScopedDelete($pdo, 'purchase_orders', $id, $cid);
    tcWriteAuditTrail($pdo, $cid !== '' ? $cid : null, '', $v2op, 'Purchase Order Delete', 'PurchaseOrder', $id, '');
    echo json_encode(["success" => $ok, "server_ts" => $now]);
    exit();
}

// ============================================================================
// CUSTOMERS
// ============================================================================
if ($action === 'v2_list_customers') {
    $cid = (string)($v2in['company_id'] ?? '');
    if ($cid === '') { echo json_encode(["success" => false, "error" => "Missing company_id"]); exit(); }
    $rows = [];
    try {
        $stmt = $pdo->prepare("SELECT * FROM customers WHERE company_id = ? AND deleted_at IS NULL ORDER BY name ASC");
        $stmt->execute([$cid]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $e) { error_log('[API] v2_list_customers: ' . $e->getMessage()); }
    echo json_encode(["success" => true, "list" => $rows, "count" => count($rows), "server_ts" => $now]);
    exit();
}
if ($action === 'v2_upsert_customer') {
    $e = $v2in['entity'] ?? $v2in['customer'] ?? null;
    if (!$e || !isset($e['id'])) { echo json_encode(["success" => false, "error" => "Missing customer.id"]); exit(); }
    $cid = (string)($e['company_id'] ?? $v2in['company_id'] ?? '');
    if ($cid === '') { echo json_encode(["success" => false, "error" => "Missing company_id"]); exit(); }
    $fields = ['company_id'=>'required','name'=>'required','phone'=>'','email'=>'','address'=>'','city'=>'','tax_id'=>'','loyalty_points'=>'','total_spent'=>'','notes'=>'','is_active'=>''];
    $e['company_id'] = $cid;
    [$uS, $uV] = tcBuildUpdate($fields, $e);
    [$iS, $iV] = tcBuildInsert('customers', $fields, $e, ['created_at' => $now, 'updated_at' => $now, 'deleted_at' => null]);
    $ok = tcUpsertRow($pdo, 'customers', $e['id'], $iS, $iV, $uS, $uV);
    tcWriteAuditTrail($pdo, $cid, '', $v2op, 'Customer Upsert', 'Customer', $e['id'], $e['name'] ?? '');
    echo json_encode(["success" => $ok, "id" => $e['id'], "server_ts" => $now]);
    exit();
}
if ($action === 'v2_delete_customer') {
    $id = (string)($v2in['id'] ?? '');
    if ($id === '') { echo json_encode(["success" => false, "error" => "Missing id"]); exit(); }
    $cid = (string)($v2in['company_id'] ?? $v2in['companyId'] ?? '');
    $ok = tcV2ScopedDelete($pdo, 'customers', $id, $cid);
    tcWriteAuditTrail($pdo, $cid !== '' ? $cid : null, '', $v2op, 'Customer Delete', 'Customer', $id, '');
    echo json_encode(["success" => $ok, "server_ts" => $now]);
    exit();
}

// ============================================================================
// COMPANY SETTINGS
// ============================================================================
if ($action === 'v2_get_company_settings') {
    $cid = (string)($v2in['company_id'] ?? '');
    if ($cid === '') { echo json_encode(["success" => false, "error" => "Missing company_id"]); exit(); }
    $row = null;
    try {
        $stmt = $pdo->prepare("SELECT * FROM company_settings WHERE company_id = ?");
        $stmt->execute([$cid]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row && !empty($row['extra_json']) && is_string($row['extra_json'])) $row['extra_json'] = json_decode($row['extra_json'], true);
    } catch (Throwable $e) { error_log('[API] v2_get_company_settings: ' . $e->getMessage()); }
    echo json_encode(["success" => true, "settings" => $row, "server_ts" => $now]);
    exit();
}
if ($action === 'v2_upsert_company_settings') {
    $e = $v2in['entity'] ?? $v2in['settings'] ?? $v2in;
    $cid = (string)($e['company_id'] ?? $v2in['company_id'] ?? '');
    if ($cid === '') { echo json_encode(["success" => false, "error" => "Missing company_id"]); exit(); }
    $fields = ['currency_code'=>'','currency_symbol'=>'','exchange_rate'=>'','tax_enabled'=>'','tax_rate'=>'','receipt_header'=>'','receipt_footer'=>'','low_stock_threshold'=>'','pos_enabled'=>'','marketplace_enabled'=>'','loyalty_enabled'=>'','sms_notifications'=>'','extra_json'=>''];
    [$uS, $uV] = tcBuildUpdate($fields, $e);
    $exists = false;
    try { $stmt = $pdo->prepare("SELECT id FROM company_settings WHERE company_id = ?"); $stmt->execute([$cid]); $exists = (bool)$stmt->fetch(); } catch (Throwable $e) {}
    if ($exists) {
        $usql = "UPDATE company_settings SET " . implode(',', $uS) . ", updated_at = ? WHERE company_id = ?";
        $stmt = $pdo->prepare($usql);
        $stmt->execute(array_merge($uV, [$now, $cid]));
    } else {
        $e['company_id'] = $cid;
        $e['id'] = 'cs_' . $cid;
        [$iS, $iV] = tcBuildInsert('company_settings', $fields, $e, ['id' => $e['id'], 'company_id' => $cid, 'created_at' => $now, 'updated_at' => $now]);
        $stmt = $pdo->prepare($iS);
        $stmt->execute($iV);
    }
    echo json_encode(["success" => true, "server_ts" => $now]);
    exit();
}

// ============================================================================
// TAX RULES
// ============================================================================
if ($action === 'v2_list_tax_rules') {
    $cid = (string)($v2in['company_id'] ?? '');
    if ($cid === '') { echo json_encode(["success" => false, "error" => "Missing company_id"]); exit(); }
    $rows = [];
    try {
        $stmt = $pdo->prepare("SELECT * FROM tax_rules WHERE company_id = ? AND deleted_at IS NULL ORDER BY name ASC");
        $stmt->execute([$cid]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $e) { error_log('[API] v2_list_tax_rules: ' . $e->getMessage()); }
    echo json_encode(["success" => true, "list" => $rows, "count" => count($rows), "server_ts" => $now]);
    exit();
}
if ($action === 'v2_upsert_tax_rule') {
    $e = $v2in['entity'] ?? $v2in['tax_rule'] ?? null;
    if (!$e || !isset($e['id'])) { echo json_encode(["success" => false, "error" => "Missing tax_rule.id"]); exit(); }
    $cid = (string)($e['company_id'] ?? $v2in['company_id'] ?? '');
    if ($cid === '') { echo json_encode(["success" => false, "error" => "Missing company_id"]); exit(); }
    $fields = ['company_id'=>'required','name'=>'required','rate'=>'required','type'=>'','applies_to'=>'','is_active'=>''];
    $e['company_id'] = $cid;
    [$uS, $uV] = tcBuildUpdate($fields, $e);
    [$iS, $iV] = tcBuildInsert('tax_rules', $fields, $e, ['created_at' => $now, 'updated_at' => $now, 'deleted_at' => null]);
    $ok = tcUpsertRow($pdo, 'tax_rules', $e['id'], $iS, $iV, $uS, $uV);
    echo json_encode(["success" => $ok, "id" => $e['id'], "server_ts" => $now]);
    exit();
}
if ($action === 'v2_delete_tax_rule') {
    $id = (string)($v2in['id'] ?? '');
    if ($id === '') { echo json_encode(["success" => false, "error" => "Missing id"]); exit(); }
    $cid = (string)($v2in['company_id'] ?? $v2in['companyId'] ?? '');
    $ok = tcV2ScopedDelete($pdo, 'tax_rules', $id, $cid);
    tcWriteAuditTrail($pdo, $cid !== '' ? $cid : null, '', $v2op, 'Tax Rule Delete', 'TaxRule', $id, '');
    echo json_encode(["success" => $ok, "server_ts" => $now]);
    exit();
}

// ============================================================================
// FLASH SALES
// ============================================================================
if ($action === 'v2_list_flash_sales') {
    $cid = (string)($v2in['company_id'] ?? '');
    if ($cid === '') { echo json_encode(["success" => false, "error" => "Missing company_id"]); exit(); }
    $rows = [];
    try {
        $stmt = $pdo->prepare("SELECT * FROM flash_sales WHERE company_id = ? AND deleted_at IS NULL ORDER BY starts_at DESC");
        $stmt->execute([$cid]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $e) { error_log('[API] v2_list_flash_sales: ' . $e->getMessage()); }
    echo json_encode(["success" => true, "list" => $rows, "count" => count($rows), "server_ts" => $now]);
    exit();
}
if ($action === 'v2_upsert_flash_sale') {
    $e = $v2in['entity'] ?? $v2in['flash_sale'] ?? null;
    if (!$e || !isset($e['id'])) { echo json_encode(["success" => false, "error" => "Missing flash_sale.id"]); exit(); }
    $cid = (string)($e['company_id'] ?? $v2in['company_id'] ?? '');
    if ($cid === '') { echo json_encode(["success" => false, "error" => "Missing company_id"]); exit(); }
    $fields = ['company_id'=>'required','product_id'=>'required','original_price'=>'required','flash_price'=>'required','stock_limit'=>'','stock_sold'=>'','starts_at'=>'required','ends_at'=>'required','status'=>''];
    $e['company_id'] = $cid;
    [$uS, $uV] = tcBuildUpdate($fields, $e);
    [$iS, $iV] = tcBuildInsert('flash_sales', $fields, $e, ['created_at' => $now, 'updated_at' => $now, 'deleted_at' => null]);
    $ok = tcUpsertRow($pdo, 'flash_sales', $e['id'], $iS, $iV, $uS, $uV);
    echo json_encode(["success" => $ok, "id" => $e['id'], "server_ts" => $now]);
    exit();
}
if ($action === 'v2_delete_flash_sale') {
    $id = (string)($v2in['id'] ?? '');
    if ($id === '') { echo json_encode(["success" => false, "error" => "Missing id"]); exit(); }
    $cid = (string)($v2in['company_id'] ?? $v2in['companyId'] ?? '');
    $ok = tcV2ScopedDelete($pdo, 'flash_sales', $id, $cid);
    tcWriteAuditTrail($pdo, $cid !== '' ? $cid : null, '', $v2op, 'Flash Sale Delete', 'FlashSale', $id, '');
    echo json_encode(["success" => $ok, "server_ts" => $now]);
    exit();
}

// ============================================================================
// STORIES
// ============================================================================
if ($action === 'v2_list_stories') {
    $cid = (string)($v2in['company_id'] ?? '');
    if ($cid === '') { echo json_encode(["success" => false, "error" => "Missing company_id"]); exit(); }
    $rows = [];
    try {
        $stmt = $pdo->prepare("SELECT * FROM stories WHERE company_id = ? AND deleted_at IS NULL AND expires_at > ? ORDER BY created_at DESC");
        $stmt->execute([$cid, $now]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $e) { error_log('[API] v2_list_stories: ' . $e->getMessage()); }
    echo json_encode(["success" => true, "list" => $rows, "count" => count($rows), "server_ts" => $now]);
    exit();
}
if ($action === 'v2_upsert_story') {
    $e = $v2in['entity'] ?? $v2in['story'] ?? null;
    if (!$e || !isset($e['id'])) { echo json_encode(["success" => false, "error" => "Missing story.id"]); exit(); }
    $cid = (string)($e['company_id'] ?? $v2in['company_id'] ?? '');
    if ($cid === '') { echo json_encode(["success" => false, "error" => "Missing company_id"]); exit(); }
    $fields = ['company_id'=>'required','product_id'=>'','media_url'=>'required','caption'=>'','views_count'=>'','expires_at'=>'required'];
    $e['company_id'] = $cid;
    [$uS, $uV] = tcBuildUpdate($fields, $e);
    [$iS, $iV] = tcBuildInsert('stories', $fields, $e, ['created_at' => $now, 'deleted_at' => null]);
    $ok = tcUpsertRow($pdo, 'stories', $e['id'], $iS, $iV, $uS, $uV);
    echo json_encode(["success" => $ok, "id" => $e['id'], "server_ts" => $now]);
    exit();
}
if ($action === 'v2_delete_story') {
    $id = (string)($v2in['id'] ?? '');
    if ($id === '') { echo json_encode(["success" => false, "error" => "Missing id"]); exit(); }
    $cid = (string)($v2in['company_id'] ?? $v2in['companyId'] ?? '');
    $ok = tcV2ScopedDelete($pdo, 'stories', $id, $cid, false, false);
    tcWriteAuditTrail($pdo, $cid !== '' ? $cid : null, '', $v2op, 'Story Delete', 'Story', $id, '');
    echo json_encode(["success" => $ok, "server_ts" => $now]);
    exit();
}

// ============================================================================
// DISPUTES
// ============================================================================
if ($action === 'v2_list_disputes') {
    $cid = (string)($v2in['company_id'] ?? '');
    if ($cid === '') { echo json_encode(["success" => false, "error" => "Missing company_id"]); exit(); }
    $rows = [];
    try {
        $stmt = $pdo->prepare("SELECT * FROM disputes WHERE company_id = ? AND deleted_at IS NULL ORDER BY created_at DESC");
        $stmt->execute([$cid]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $e) { error_log('[API] v2_list_disputes: ' . $e->getMessage()); }
    echo json_encode(["success" => true, "list" => $rows, "count" => count($rows), "server_ts" => $now]);
    exit();
}
if ($action === 'v2_upsert_dispute') {
    $e = $v2in['entity'] ?? $v2in['dispute'] ?? null;
    if (!$e || !isset($e['id'])) { echo json_encode(["success" => false, "error" => "Missing dispute.id"]); exit(); }
    $cid = (string)($e['company_id'] ?? $v2in['company_id'] ?? '');
    if ($cid === '') { echo json_encode(["success" => false, "error" => "Missing company_id"]); exit(); }
    $fields = ['company_id'=>'required','order_id'=>'required','raised_by'=>'required','reason'=>'required','description'=>'','status'=>'','resolution'=>'','resolved_by'=>''];
    $e['company_id'] = $cid;
    [$uS, $uV] = tcBuildUpdate($fields, $e);
    [$iS, $iV] = tcBuildInsert('disputes', $fields, $e, ['created_at' => $now, 'updated_at' => $now, 'deleted_at' => null]);
    $ok = tcUpsertRow($pdo, 'disputes', $e['id'], $iS, $iV, $uS, $uV);
    echo json_encode(["success" => $ok, "id" => $e['id'], "server_ts" => $now]);
    exit();
}
if ($action === 'v2_delete_dispute') {
    $id = (string)($v2in['id'] ?? '');
    if ($id === '') { echo json_encode(["success" => false, "error" => "Missing id"]); exit(); }
    $cid = (string)($v2in['company_id'] ?? $v2in['companyId'] ?? '');
    $ok = tcV2ScopedDelete($pdo, 'disputes', $id, $cid);
    tcWriteAuditTrail($pdo, $cid !== '' ? $cid : null, '', $v2op, 'Dispute Delete', 'Dispute', $id, '');
    echo json_encode(["success" => $ok, "server_ts" => $now]);
    exit();
}

// ============================================================================
// DISPUTE MESSAGES
// ============================================================================
if ($action === 'v2_list_dispute_messages') {
    $did = (string)($v2in['dispute_id'] ?? '');
    if ($did === '') { echo json_encode(["success" => false, "error" => "Missing dispute_id"]); exit(); }
    $rows = [];
    try {
        $stmt = $pdo->prepare("SELECT * FROM dispute_messages WHERE dispute_id = ? ORDER BY created_at ASC");
        $stmt->execute([$did]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $e) { error_log('[API] v2_list_dispute_messages: ' . $e->getMessage()); }
    echo json_encode(["success" => true, "list" => $rows, "count" => count($rows), "server_ts" => $now]);
    exit();
}
if ($action === 'v2_upsert_dispute_message') {
    $e = $v2in['entity'] ?? $v2in['dispute_message'] ?? null;
    if (!$e || !isset($e['id'])) { echo json_encode(["success" => false, "error" => "Missing id"]); exit(); }
    $did = (string)($e['dispute_id'] ?? '');
    if ($did === '') { echo json_encode(["success" => false, "error" => "Missing dispute_id"]); exit(); }
    $fields = ['dispute_id'=>'required','sender'=>'required','sender_role'=>'','message'=>'required'];
    [$uS, $uV] = tcBuildUpdate($fields, $e);
    [$iS, $iV] = tcBuildInsert('dispute_messages', $fields, $e, ['created_at' => $now]);
    $exists = false;
    try { $stmt = $pdo->prepare("SELECT id FROM dispute_messages WHERE id = ?"); $stmt->execute([$e['id']]); $exists = (bool)$stmt->fetch(); } catch (Throwable $e2) {}
    if ($exists) {
        $usql = "UPDATE dispute_messages SET " . implode(',', $uS) . " WHERE id = ?";
        $stmt = $pdo->prepare($usql);
        $stmt->execute(array_merge($uV, [$e['id']]));
    } else {
        $stmt = $pdo->prepare($iS);
        $stmt->execute($iV);
    }
    echo json_encode(["success" => true, "id" => $e['id'], "server_ts" => $now]);
    exit();
}

// ============================================================================
// PRODUCT RETURNS
// ============================================================================
if ($action === 'v2_list_product_returns') {
    $cid = (string)($v2in['company_id'] ?? '');
    if ($cid === '') { echo json_encode(["success" => false, "error" => "Missing company_id"]); exit(); }
    $rows = [];
    try {
        $stmt = $pdo->prepare("SELECT * FROM product_returns WHERE company_id = ? AND deleted_at IS NULL ORDER BY created_at DESC");
        $stmt->execute([$cid]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $e) { error_log('[API] v2_list_product_returns: ' . $e->getMessage()); }
    echo json_encode(["success" => true, "list" => $rows, "count" => count($rows), "server_ts" => $now]);
    exit();
}
if ($action === 'v2_upsert_product_return') {
    $e = $v2in['entity'] ?? $v2in['product_return'] ?? null;
    if (!$e || !isset($e['id'])) { echo json_encode(["success" => false, "error" => "Missing product_return.id"]); exit(); }
    $cid = (string)($e['company_id'] ?? $v2in['company_id'] ?? '');
    if ($cid === '') { echo json_encode(["success" => false, "error" => "Missing company_id"]); exit(); }
    $fields = ['company_id'=>'required','order_id'=>'required','product_id'=>'required','customer_name'=>'required','reason'=>'required','status'=>'','refund_amount'=>'','admin_note'=>''];
    $e['company_id'] = $cid;
    [$uS, $uV] = tcBuildUpdate($fields, $e);
    [$iS, $iV] = tcBuildInsert('product_returns', $fields, $e, ['created_at' => $now, 'updated_at' => $now, 'deleted_at' => null]);
    $ok = tcUpsertRow($pdo, 'product_returns', $e['id'], $iS, $iV, $uS, $uV);
    echo json_encode(["success" => $ok, "id" => $e['id'], "server_ts" => $now]);
    exit();
}
if ($action === 'v2_delete_product_return') {
    $id = (string)($v2in['id'] ?? '');
    if ($id === '') { echo json_encode(["success" => false, "error" => "Missing id"]); exit(); }
    $cid = (string)($v2in['company_id'] ?? $v2in['companyId'] ?? '');
    $ok = tcV2ScopedDelete($pdo, 'product_returns', $id, $cid);
    tcWriteAuditTrail($pdo, $cid !== '' ? $cid : null, '', $v2op, 'Product Return Delete', 'ProductReturn', $id, '');
    echo json_encode(["success" => $ok, "server_ts" => $now]);
    exit();
}

// ============================================================================
// CHAT CONVERSATIONS
// ============================================================================
if ($action === 'v2_list_chat_conversations') {
    $cid = (string)($v2in['company_id'] ?? '');
    if ($cid === '') { echo json_encode(["success" => false, "error" => "Missing company_id"]); exit(); }
    $rows = [];
    try {
        $stmt = $pdo->prepare("SELECT * FROM chat_conversations WHERE company_id = ? ORDER BY last_message_at DESC");
        $stmt->execute([$cid]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $e) { error_log('[API] v2_list_chat_conversations: ' . $e->getMessage()); }
    echo json_encode(["success" => true, "list" => $rows, "count" => count($rows), "server_ts" => $now]);
    exit();
}
if ($action === 'v2_upsert_chat_conversation') {
    $e = $v2in['entity'] ?? $v2in['chat_conversation'] ?? null;
    if (!$e || !isset($e['id'])) { echo json_encode(["success" => false, "error" => "Missing chat_conversation.id"]); exit(); }
    $cid = (string)($e['company_id'] ?? $v2in['company_id'] ?? '');
    if ($cid === '') { echo json_encode(["success" => false, "error" => "Missing company_id"]); exit(); }
    $fields = ['company_id'=>'required','customer_name'=>'required','customer_phone'=>'','last_message'=>'','last_message_at'=>'','unread_count'=>'','status'=>''];
    $e['company_id'] = $cid;
    [$uS, $uV] = tcBuildUpdate($fields, $e);
    [$iS, $iV] = tcBuildInsert('chat_conversations', $fields, $e, ['created_at' => $now, 'updated_at' => $now]);
    $ok = tcUpsertRow($pdo, 'chat_conversations', $e['id'], $iS, $iV, $uS, $uV);
    echo json_encode(["success" => $ok, "id" => $e['id'], "server_ts" => $now]);
    exit();
}
if ($action === 'v2_delete_chat_conversation') {
    $id = (string)($v2in['id'] ?? '');
    if ($id === '') { echo json_encode(["success" => false, "error" => "Missing id"]); exit(); }
    $cid = (string)($v2in['company_id'] ?? $v2in['companyId'] ?? '');
    $ok = tcV2ScopedDelete($pdo, 'chat_conversations', $id, $cid, true);
    tcWriteAuditTrail($pdo, $cid !== '' ? $cid : null, '', $v2op, 'Chat Conversation Delete', 'ChatConversation', $id, '');
    echo json_encode(["success" => $ok, "server_ts" => $now]);
    exit();
}

// ============================================================================
// CHAT MESSAGES
// ============================================================================
if ($action === 'v2_list_chat_messages') {
    $convId = (string)($v2in['conversation_id'] ?? '');
    if ($convId === '') { echo json_encode(["success" => false, "error" => "Missing conversation_id"]); exit(); }
    $rows = [];
    try {
        $stmt = $pdo->prepare("SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC");
        $stmt->execute([$convId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $e) { error_log('[API] v2_list_chat_messages: ' . $e->getMessage()); }
    echo json_encode(["success" => true, "list" => $rows, "count" => count($rows), "server_ts" => $now]);
    exit();
}
if ($action === 'v2_upsert_chat_message') {
    $e = $v2in['entity'] ?? $v2in['chat_message'] ?? null;
    if (!$e || !isset($e['id'])) { echo json_encode(["success" => false, "error" => "Missing chat_message.id"]); exit(); }
    $convId = (string)($e['conversation_id'] ?? '');
    if ($convId === '') { echo json_encode(["success" => false, "error" => "Missing conversation_id"]); exit(); }
    $fields = ['conversation_id'=>'required','sender'=>'required','sender_role'=>'required','message'=>'required','is_read'=>''];
    [$iS, $iV] = tcBuildInsert('chat_messages', $fields, $e, ['created_at' => $now]);
    $stmt = $pdo->prepare($iS);
    $stmt->execute($iV);
    // Update conversation last_message
    try { $pdo->prepare("UPDATE chat_conversations SET last_message=?, last_message_at=?, updated_at=? WHERE id=?")->execute([$e['message'] ?? '', $now, $now, $convId]); } catch (Throwable $e2) {}
    echo json_encode(["success" => true, "id" => $e['id'], "server_ts" => $now]);
    exit();
}

// ============================================================================
// ESCROW TRANSACTIONS
// ============================================================================
if ($action === 'v2_list_escrow_transactions') {
    $cid = (string)($v2in['company_id'] ?? '');
    if ($cid === '') { echo json_encode(["success" => false, "error" => "Missing company_id"]); exit(); }
    $rows = [];
    try {
        $stmt = $pdo->prepare("SELECT * FROM escrow_transactions WHERE company_id = ? ORDER BY created_at DESC");
        $stmt->execute([$cid]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $e) { error_log('[API] v2_list_escrow_transactions: ' . $e->getMessage()); }
    echo json_encode(["success" => true, "list" => $rows, "count" => count($rows), "server_ts" => $now]);
    exit();
}
if ($action === 'v2_upsert_escrow_transaction') {
    $e = $v2in['entity'] ?? $v2in['escrow_transaction'] ?? null;
    if (!$e || !isset($e['id'])) { echo json_encode(["success" => false, "error" => "Missing escrow_transaction.id"]); exit(); }
    $cid = (string)($e['company_id'] ?? $v2in['company_id'] ?? '');
    if ($cid === '') { echo json_encode(["success" => false, "error" => "Missing company_id"]); exit(); }
    $fields = ['company_id'=>'required','order_id'=>'required','buyer_id'=>'','seller_id'=>'','amount'=>'required','status'=>'','released_at'=>''];
    $e['company_id'] = $cid;
    [$uS, $uV] = tcBuildUpdate($fields, $e);
    [$iS, $iV] = tcBuildInsert('escrow_transactions', $fields, $e, ['created_at' => $now, 'updated_at' => $now]);
    $ok = tcUpsertRow($pdo, 'escrow_transactions', $e['id'], $iS, $iV, $uS, $uV);
    echo json_encode(["success" => $ok, "id" => $e['id'], "server_ts" => $now]);
    exit();
}

// ============================================================================
// VISUAL SEARCHES
// ============================================================================
if ($action === 'v2_list_visual_searches') {
    $cid = (string)($v2in['company_id'] ?? '');
    if ($cid === '') { echo json_encode(["success" => false, "error" => "Missing company_id"]); exit(); }
    $rows = [];
    try {
        $stmt = $pdo->prepare("SELECT * FROM visual_searches WHERE company_id = ? ORDER BY created_at DESC");
        $stmt->execute([$cid]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as &$r) { if (!empty($r['results']) && is_string($r['results'])) $r['results'] = json_decode($r['results'], true); }
    } catch (Throwable $e) { error_log('[API] v2_list_visual_searches: ' . $e->getMessage()); }
    echo json_encode(["success" => true, "list" => $rows, "count" => count($rows), "server_ts" => $now]);
    exit();
}
if ($action === 'v2_upsert_visual_search') {
    $e = $v2in['entity'] ?? $v2in['visual_search'] ?? null;
    if (!$e || !isset($e['id'])) { echo json_encode(["success" => false, "error" => "Missing visual_search.id"]); exit(); }
    $cid = (string)($e['company_id'] ?? $v2in['company_id'] ?? '');
    if ($cid === '') { echo json_encode(["success" => false, "error" => "Missing company_id"]); exit(); }
    $fields = ['company_id'=>'required','user_id'=>'','image_url'=>'required','results'=>''];
    $e['company_id'] = $cid;
    [$iS, $iV] = tcBuildInsert('visual_searches', $fields, $e, ['created_at' => $now]);
    $stmt = $pdo->prepare($iS);
    $stmt->execute($iV);
    echo json_encode(["success" => true, "id" => $e['id'], "server_ts" => $now]);
    exit();
}

// ============================================================================
// INSTALLMENT PLANS
// ============================================================================
if ($action === 'v2_list_installment_plans') {
    $cid = (string)($v2in['company_id'] ?? '');
    if ($cid === '') { echo json_encode(["success" => false, "error" => "Missing company_id"]); exit(); }
    $rows = [];
    try {
        $stmt = $pdo->prepare("SELECT * FROM installment_plans WHERE company_id = ? ORDER BY created_at DESC");
        $stmt->execute([$cid]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $e) { error_log('[API] v2_list_installment_plans: ' . $e->getMessage()); }
    echo json_encode(["success" => true, "list" => $rows, "count" => count($rows), "server_ts" => $now]);
    exit();
}
if ($action === 'v2_upsert_installment_plan') {
    $e = $v2in['entity'] ?? $v2in['installment_plan'] ?? null;
    if (!$e || !isset($e['id'])) { echo json_encode(["success" => false, "error" => "Missing installment_plan.id"]); exit(); }
    $cid = (string)($e['company_id'] ?? $v2in['company_id'] ?? '');
    if ($cid === '') { echo json_encode(["success" => false, "error" => "Missing company_id"]); exit(); }
    $fields = ['product_id'=>'required','company_id'=>'required','total_price'=>'required','down_payment_percent'=>'required','installments_count'=>'required','installment_percent_extra'=>'','status'=>''];
    $e['company_id'] = $cid;
    [$uS, $uV] = tcBuildUpdate($fields, $e);
    [$iS, $iV] = tcBuildInsert('installment_plans', $fields, $e, ['created_at' => $now]);
    $ok = tcUpsertRow($pdo, 'installment_plans', $e['id'], $iS, $iV, $uS, $uV);
    echo json_encode(["success" => $ok, "id" => $e['id'], "server_ts" => $now]);
    exit();
}
if ($action === 'v2_delete_installment_plan') {
    $id = (string)($v2in['id'] ?? '');
    if ($id === '') { echo json_encode(["success" => false, "error" => "Missing id"]); exit(); }
    $cid = (string)($v2in['company_id'] ?? $v2in['companyId'] ?? '');
    $ok = tcV2ScopedDelete($pdo, 'installment_plans', $id, $cid, true);
    tcWriteAuditTrail($pdo, $cid !== '' ? $cid : null, '', $v2op, 'Installment Plan Delete', 'InstallmentPlan', $id, '');
    echo json_encode(["success" => $ok, "server_ts" => $now]);
    exit();
}

// ============================================================================
// INSTALLMENT ORDERS
// ============================================================================
if ($action === 'v2_list_installment_orders') {
    $cid = (string)($v2in['company_id'] ?? '');
    if ($cid === '') { echo json_encode(["success" => false, "error" => "Missing company_id"]); exit(); }
    $rows = [];
    try {
        $stmt = $pdo->prepare("SELECT * FROM installment_orders WHERE company_id = ? ORDER BY created_at DESC");
        $stmt->execute([$cid]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $e) { error_log('[API] v2_list_installment_orders: ' . $e->getMessage()); }
    echo json_encode(["success" => true, "list" => $rows, "count" => count($rows), "server_ts" => $now]);
    exit();
}
if ($action === 'v2_upsert_installment_order') {
    $e = $v2in['entity'] ?? $v2in['installment_order'] ?? null;
    if (!$e || !isset($e['id'])) { echo json_encode(["success" => false, "error" => "Missing installment_order.id"]); exit(); }
    $cid = (string)($e['company_id'] ?? $v2in['company_id'] ?? '');
    if ($cid === '') { echo json_encode(["success" => false, "error" => "Missing company_id"]); exit(); }
    $fields = ['product_id'=>'required','company_id'=>'required','installment_plan_id'=>'required','customer_name'=>'required','customer_phone'=>'required','total_price'=>'required','down_payment'=>'required','remaining'=>'required','installment_amount'=>'required','installments_count'=>'required','paid_installments'=>'','total_paid'=>'','status'=>'','next_due_date'=>'','tracking_code'=>'required','order_id'=>''];
    $e['company_id'] = $cid;
    [$uS, $uV] = tcBuildUpdate($fields, $e);
    [$iS, $iV] = tcBuildInsert('installment_orders', $fields, $e, ['created_at' => $now]);
    $ok = tcUpsertRow($pdo, 'installment_orders', $e['id'], $iS, $iV, $uS, $uV);
    echo json_encode(["success" => $ok, "id" => $e['id'], "server_ts" => $now]);
    exit();
}

// ============================================================================
// INSTALLMENT PAYMENTS
// ============================================================================
if ($action === 'v2_list_installment_payments') {
    $oid = (string)($v2in['installment_order_id'] ?? '');
    if ($oid === '') { echo json_encode(["success" => false, "error" => "Missing installment_order_id"]); exit(); }
    $rows = [];
    try {
        $stmt = $pdo->prepare("SELECT * FROM installment_payments WHERE installment_order_id = ? ORDER BY created_at ASC");
        $stmt->execute([$oid]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $e) { error_log('[API] v2_list_installment_payments: ' . $e->getMessage()); }
    echo json_encode(["success" => true, "list" => $rows, "count" => count($rows), "server_ts" => $now]);
    exit();
}
if ($action === 'v2_upsert_installment_payment') {
    $e = $v2in['entity'] ?? $v2in['installment_payment'] ?? null;
    if (!$e || !isset($e['id'])) { echo json_encode(["success" => false, "error" => "Missing installment_payment.id"]); exit(); }
    $oid = (string)($e['installment_order_id'] ?? '');
    if ($oid === '') { echo json_encode(["success" => false, "error" => "Missing installment_order_id"]); exit(); }
    $fields = ['installment_order_id'=>'required','amount'=>'required','type'=>'required','status'=>'','reference'=>'','collection_id'=>'','due_date'=>'','paid_at'=>''];
    [$iS, $iV] = tcBuildInsert('installment_payments', $fields, $e, ['created_at' => $now]);
    $stmt = $pdo->prepare($iS);
    $stmt->execute($iV);
    echo json_encode(["success" => true, "id" => $e['id'], "server_ts" => $now]);
    exit();
}
