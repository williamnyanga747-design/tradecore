# Changelog

All notable changes to TradeCore ERP will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.9-build-17] - 2026-09-10

### Build 2026-09-08-17 — CRITICAL SQL 1292 FIX: `Incorrect datetime value: '1789066134' for column 'created_at'` + epoch-schema self-healing
Screenshot `2026-09-10 212657` showed `v2_upsert_company` failing with `SQLSTATE[22007]: Invalid datetime format: 1292 Incorrect datetime value: '1789066134' for column 'created_at'`.

**Root cause**: the whole TradeCore stack persists `created_at`/`updated_at` as **BIGINT epoch-seconds** (`$now = time()`; all of `database.sql`, migrations `002/003/004`, and every upsert/load). But the deployed `companies` table was created by a legacy schema that declared those columns as DATETIME (same for `stores`, which `001_multi_store_location.sql` created with `DATETIME DEFAULT CURRENT_TIMESTAMP`). `CREATE TABLE IF NOT EXISTS` is a no-op on those tables, so the epoch int `1789066134` was handed to a DATETIME column and MySQL rejected it with 1292.

**Backend fixes** (`public/cpanel/api.php`):
1. **`tcEnsureEpochTimestamps($pdo, $tables)`** — new migration, invoked from `tcEnsureNormalizedTables` for `companies, stores, stock_categories, products, user_accounts, audit_trails`. It queries `INFORMATION_SCHEMA.COLUMNS` for `created_at`/`updated_at` whose `DATA_TYPE` is not BIGINT, then per affected table: converts existing `YYYY-MM-DD HH:MM:SS` rows to epoch-seconds via `UNIX_TIMESTAMP()` (a `REGEXP '^[0-9]+$'` guard leaves genuine epoch values untouched, NULLs stay NULL, `< 10000000000` bounds the numeric-coerced string match to < year 2286), then `ALTER TABLE ... MODIFY COLUMN created_at BIGINT NOT NULL, MODIFY COLUMN updated_at BIGINT NOT NULL` (+ `deleted_at BIGINT DEFAULT NULL`). Memoized per request; only touches tables actually on the wrong type.
2. **`tcEpochTs($value, $fallback)`** — the requested PHP sanitizer, adapted to the epoch-seconds contract so the frontend's numeric `created_at`/`updated_at` handling never breaks: numeric → `(int)` (13-digit ms auto-detected and divided by 1000), ISO/date strings → `strtotime()`, empty/bool/invalid → `$fallback` (`time()` for created/updated, `null` for deleted). Wired into `tcUpsertCompanyRow` and `tcUpsertStoreRow` timestamps.
3. Build-16's dynamic column whitelist (`tcTableColumns`) and build-15's error surfacing remain intact; the fix is type-agnostic — it works whether the deployed column is DATETIME (legacy), TIMESTAMP, or BIGINT.

**Acceptance**: deploy head commit → hard refresh → add company → console shows `[Direct MySQL] v2_upsert_company RESPONSE {success:true,...}` → `SHOW COLUMNS FROM companies;` now reports `created_at`/`updated_at` as `bigint` → `SELECT * FROM companies WHERE deleted_at IS NULL ORDER BY created_at DESC;` shows the row. Table is still **`companies`** (`tradecore_companies` is not created).

## [1.0.9-build-16] - 2026-09-10

### Build 2026-09-08-16 — CRITICAL SQL 1054 FIX: `Unknown column 'owner_user_id' in 'INSERT INTO'` + schema auto-migration guard
Screenshot `2026-09-10 210311` showed `v2_upsert_company` failing with `SQLSTATE[42S22]: Column not found: 1054 Unknown column 'owner_user_id' in 'INSERT INTO'`.

**Root cause**: `owner_user_id` exists in the `CREATE TABLE IF NOT EXISTS companies` statement, but that statement is a **no-op on tables created by older builds**. No `ALTER` migration ever added `owner_user_id` to those legacy tables, so the INSERT targeted a column that physically did not exist — and because `tcEnsureNormalizedTables` only ALTERs `theme_color`/`subscription_end`/`logo`, the column was never created.

**Backend fixes** (`public/cpanel/api.php`):
1. **Migration guard** in `tcEnsureNormalizedTables`: idempotent `ALTER TABLE companies ADD COLUMN owner_user_id VARCHAR(64) DEFAULT NULL AFTER id` (try/catch — MySQL 8.0 does not support `ADD COLUMN IF NOT EXISTS`). Legacy `companies` tables are auto-repaired on the first request.
2. **Dynamic column filtering** — new `tcTableColumns($pdo, $table)`: memoized `INFORMATION_SCHEMA.COLUMNS` lookup returning the LIVE column set. `tcUpsertCompanyRow` now builds `INSERT INTO companies (...col...) VALUES (...?) ON DUPLICATE KEY UPDATE ...` from the **intersection** of the normalized field map and the real schema, so a missing column (`owner_user_id`, `theme_color`, `logo`, ...) is skipped rather than aborting the upsert with 42S22. Values stay bound positionally; `id`/`created_at` are never overwritten on duplicate; `deleted_at=NULL` on duplicate preserves the 2026-09-07 soft-delete guard (delete-touches are handled before this path).
3. Existing `tcLoadCompanies` uses `SELECT *` (already schema-safe); error surfacing from build-15 (`[v2_upsert_company] FAILED SQL:` log + `v2UpsertCompanyDetailed`) is unchanged.

**Acceptance**: deploy head commit → hard refresh → add company → console shows `[Direct MySQL] v2_upsert_company RESPONSE {success:true,...}` → `SELECT * FROM companies WHERE deleted_at IS NULL ORDER BY created_at DESC;` shows the row → refresh and a second browser see it. On legacy DBs, `owner_user_id` is auto-added on first request (verify `SHOW COLUMNS FROM companies;`). Table is still **`companies`** — `tradecore_companies` is not created.

## [1.0.9-build-15] - 2026-09-10

### Build 2026-09-08-15 — COMPANY-ADD ROOT-CAUSE FIX: subscription_end types + exact server error surfaced (fixes "v2_upsert_company still returns false even with correct payload")
With build-14's normalizeCompanyPayload sending the correct `{id, company_id, name, tin_number}` PLUS form fields (`subscriptionEnd: '2026-09-30'`, `themeColor`), the INSERT still failed. The REAL cause was a schema/type mismatch the boolean-only helper hid:

1. **`subscription_end` was declared BIGINT** but the app's `Company.subscriptionEnd` is a **date string** (`'2026-09-30'`; `Header.tsx:142` and `MasterData.tsx:639` compare `todayStr > c.subscriptionEnd`). MySQL strict mode rejects a date string into a BIGINT column → `SQLSTATE[22007]: Incorrect integer value: '2026-09-30'` → `tcUpsertCompanyRow` catch → `success:false`. The frontend's `v2UpsertCompany` returned only `!!(res.success)` so the exact PDO error never appeared in console.
2. On a fresh DB the ALTERs for `theme_color`/`subscription_end`/`logo` had not run before the INSERT.

**Backend fixes** (`public/cpanel/api.php`):
- `tcEnsureNormalizedTables`: `subscription_end` now `VARCHAR(16)` — ADD (fresh) **and** MODIFY (fix build-14's BIGINT), idempotent. Matches the app's date-string contract.
- `tcUpsertCompanyRow`: calls `tcEnsureNormalizedTables($pdo)` first so theme_color/subscription_end/logo columns always exist before INSERT.
- `v2_upsert_company` handler: on failure logs **`[v2_upsert_company] FAILED SQL: <PDO message> DATA: <json payload>`** — the exact grep-able line to paste. Response already carries `"error"`.

**Frontend fix** (`src/App.tsx` + `src/utils/normalizedPersistence.ts`):
- New `v2UpsertCompanyDetailed` returns the RAW `V2WriteResponse` (not boolean). `addCompany` now logs `[Direct MySQL] v2_upsert_company RESPONSE <full>` and throws with `res.error` so the **real MySQL error** appears in console + toast instead of a bare `v2_upsert_company returned false`.

**Note on tables**: the write/read target is the existing **`companies`** table (single source of truth). `tradecore_companies` does NOT exist and is NOT created — that was the rejected duplicate-schema plan. Verify with `SHOW CREATE TABLE companies;` / `SELECT * FROM companies WHERE deleted_at IS NULL ORDER BY created_at DESC;`.

## [1.0.9-build-14] - 2026-09-10

### Build 2026-09-08-14 — COMPANY-ADD FULL FIX: backend robustness + frontend normalizeCompanyPayload + round-trip themeColor/subscriptionEnd/logo through MySQL
After build-13's explicit v2_upsert_company POST, the user reported the company STILL vanishes (screenshot 2026-09-10_192817/192606): server returned `success:false`, and the payload logged lacked `id`/`company_id`. The `companies` table also lacked columns for `theme_color`, `subscription_end`, `logo`, so even a successful insert lost the app-specific fields on reload.

**Root causes identified:**
1. Frontend `addCompany` payload included `id`/`company_id` but the server handler only accepted them via `$v2in['entity']`; if the entity wrapper was missing or malformed, it returned `{"success":false, "error":"Missing company.id"}` — never the DB error.
2. `tcUpsertCompanyRow` accepted both camelCase and snake_case for many fields but NOT `theme_color`/`subscription_end`/`logo`/`tin` (only `tin_number`/`tinNumber`). The `companies` table had no `theme_color`, `subscription_end`, or `logo` columns.
3. `tcLoadCompanies` did not return `themeColor`/`subscriptionEnd`/`logo` so even a successful write was invisible to the app on refresh.
4. The handler could return bare false on PDO exceptions with no structured error.

**Backend fixes** (`public/cpanel/api.php`):
- `tcEnsureNormalizedTables`: ALTER TABLE `companies` ADD `theme_color VARCHAR(16)`, `subscription_end BIGINT`, `logo TEXT` (safe idempotent).
- `tcUpsertCompanyRow`: accepts `&$err` param (never returns bare false without error message). Normalizes `tin`→`tin_number`, `language`→`locale`, `themeColor`→`theme_color`, `subscriptionEnd`→`subscription_end`, `logo`/`logoUrl`→`logo`. INSERT/UPDATE includes new columns.
- `v2_upsert_company` handler: robust entity extraction — tries `$v2in['entity']`, `$v2in['company']`, then the entire payload (bare top-level). Auto-generates `id` via `random_bytes(8)` when missing. Catches PDOException explicitly. Response always includes `"error"` key. Wrapped tcBlobMerge in try/catch.
- `tcLoadCompanies`: returns `themeColor`, `subscriptionEnd`, `logo`, `language`. ORDER BY `created_at DESC, name ASC`.
- `v2_list_companies`: superadmin GLOBAL scope already forced (line 3142).

**Frontend fix** (`src/App.tsx`):
- `addCompany` now builds payload via `normalizeCompanyPayload`: explicit `id`+`company_id` (uuid), all fields in snake_case AND camelCase (both forms), `status:'active'`, `is_active:1`, `theme_color` from form, `subscription_end` from form. Logs `[Companies] normalizeCompanyPayload →` before POST.
- GLOBAL v2_list_companies re-fetch applied immediately after successful upsert.

**Note for phpMyAdmin verification**: query `SELECT * FROM companies WHERE deleted_at IS NULL ORDER BY created_at DESC` (NOT `tradecore_companies` — that table does not exist; `companies` is the single source of truth).

## [1.0.9-build-13] - 2026-09-08

### Build 2026-09-08-13 — Add Company now goes DIRECT MySQL via explicit awaited POST (fixes "nimeadd company imefutika" / company local-only after refresh / invisible to other users)
After the build-12 direct-MySQL migration, adding a Company through System Companies still did not make it to MySQL in all cases. The reported symptom (Screenshot 162036.png): the Company appeared in the switch list and a Flush for (users, settings) 12.4KB happened, but NO `v2_upsert_company` POST appeared in the network tab — so on reload the server loaded its (unchanged) MySQL list and the new row vanished, and other users never saw it either.

**Root cause**: the build-12 diff dispatch (`saveAllData` → `DIRECT_DELTA_HANDLERS.companies`) fired `v2UpsertCompany(rec).catch(() => {})` — a silent swallow. Any failure in URL resolution, auth, or the POST itself was eaten with NO console output and NO MySQL write, then the flow never re-fetched from the DB. The Company was therefore local-only: UI had it, MySQL did not.

**Fix** (`src/App.tsx` + `src/components/MasterData.tsx`):
- New `addCompany` callback passed to System Companies: creates the record with `crypto.randomUUID()` (fallback `co_<ts>_<rand>`), then performs an EXPLICIT `/api.php?action=v2_upsert_company` POST that is **awaited** and **logged** (`[Direct MySQL] v2_upsert_company OK|FAILED`). On failure it throws + shows a toast instead of silently swallowing, so a failed write can never masquerade as success.
- Immediately after the successful write it runs `v2_list_companies` (super admin scope = GLOBAL server-side) and applies the fresh MySQL list to local state + IDB cache (`[Direct MySQL] v2_list_companies GLOBAL re-fetch N rows`), so all views + other users + the next reload read the row from the `companies` table.
- `MasterData.tsx` company-create handler now calls `addCompany(cleanCompany)` (awaited) and only saves the local `settings` (companyLanguages/Currencies/ExchangeRates) via `saveAllData` — NO `saveAllData({ companies })` for the create path, so the write cannot be lost in the blob/diff pipeline. Falls back to the old numeric-`nextId` path only when the prop is absent.
- `DIRECT_DELTA_HANDLERS` catch blocks now log (`console.warn('[Direct MySQL] v2_upsert_company delta failed', e, rec)`) instead of swallowing so the same silent-death class is visible everywhere.

**Note for verification in phpMyAdmin**: the new row lands in the existing **`companies`** table (NOT a `tradecore_companies` table — that was the rejected duplicate-schema plan). Query: `SELECT * FROM companies WHERE name = 'Gamma Ltd' AND deleted_at IS NULL;` — expected one row with the recent `created_at`/`updated_at`.

## [1.0.9-build-12] - 2026-09-08

### Build 2026-09-08-12 — DIRECT-MYSQL CRUD MIGRATION: master data no longer rides the state blob
The reported bug pattern — "13.4KB Flush → 409 Conflict server version ahead → new Company vanishes" — happened because `saveAllData` shipped every master-data edit as a full `save_state` blob delta (versioned, conflict-prone). The server ALREADY had the direct-MySQL machinery (`companies`/`stores`/`products`/`customers`/`suppliers` normalized tables + `v2_*` atomic endpoints); the frontend just never used it for these collections. Users were the only entity users saw work because they already mirrored to `user_accounts`. This build migrates the master collections onto the SAME direct network path as users. No duplicate data model was introduced (the original plan's `tradecore_companies` table + `api/companies.php` files were rejected: identical live tables/endpoints already existed and forking them would split data into two sources of truth).

**Now**:
- **Direct diffed CRUD dispatch** (`src/App.tsx` `saveAllData` → `DIRECT_DELTA_HANDLERS`): for `companies`/`branches`/`stores`/`customers`/`suppliers`/`marketplaceProducts`, the PREVIOUS array is diffed against the incoming one so ONLY changed records hit the wire — new = `v2_upsert_*` (~0.5KB POST), edited = one upsert, removed = `v2_delete_*` (deleted rows stay deleted; the OLD full-array upsert-of-survivors silently resurrected deleted customers/suppliers on reload).
- **Never dirty-marked / never blob** (`DIRECT_SYNC_KEYS`): these keys are excluded from `flushDirtyKeysRef`/`dirtyValuesRef`/`MASTER_SYNC_KEYS` (now just `categories`), so no more 13.4KB `save_state` delta, no version bump, no 409 Conflict for master data; the blob payload stays settings/UI only.
- **System Companies / Branches / Stores read MySQL directly** (`refreshMasterData` + `MasterData.tsx` effect on tab open): each tab re-fetches via `v2_list_companies` / new `v2_list_branches` / `v2_list_stores` — super admin scope is forced GLOBAL server-side (`api.php` `tcResolveOperatorUser`/`tcIsSuperOperatorUser`), killing the "Filter per-company snapshot … skipping due to company_id mismatch" class.
- **New `v2_list_branches`** (`public/cpanel/api.php`): branches are `stores` rows whose `branch_id` equals their own `id` (the wiring `tcMirrorNormalized` already used); super global + company-scoped, blob fallback while the table is empty. Registered in the super-global force-list.
- **`tcLoadCompanies` now returns `company_id`** per row so every downstream company-scoped match sees `alphaglobal`-style ids, never an undefined `company_id`.
- **Server commit paths untouched re: versioning**: `v2_upsert_company/store/product` do plain `INSERT … ON DUPLICATE KEY UPDATE … deleted_at=NULL` + audit trail; no main_state version bump → no 409.
- IDB stays a pure offline read cache (`cacheSystemState/getCachedSystemState`); MySQL is the only source of truth. Bell-and-braces applyData reboot fallback + 409-rebase companies union from build -11 remain (now no-ops for companies since they no longer enter the blob).

### Backend
- `public/cpanel/api.php`: `v2_list_branches` added; `v2_list_branches` included in the SUPERADMIN GLOBAL scope force-list; `tcLoadCompanies` row output gains `company_id`. Deploy copy will be re-hash-synced and verified (SYNC True expected).

## [1.0.9-build-11] - 2026-09-08

### Build 2026-09-08-11 — New Company added via System Companies now survives reload (fixes "added a Company, then it vanished")
- **Record-shape parity for Add Company** (`src/components/MasterData.tsx`): a company created through the System Companies form (`newCo`) previously shipped as `{...cleanCompany, id: nextId}` with NO `company_id` / `is_default` / `created_by`. The registration path stamps `company_id: newCompanyId` (App.tsx L7003) — so a company-scoped snapshot/filter (client or server) could "skip" the new record as company-id mismatched while the two seed default Companies always matched. It now carries `company_id: nextId`, `is_default: false`, `created_by: 'root_mandate'`, exactly like a registration-created company.
- **Reboot-safe companies fallback** (`src/App.tsx` `applyData`): the boot path fetches a per-company snapshot FIRST (`fetchCompanySnapshot(bootCid)`); a per-company snapshot can be served without a top-level `companies` array, and the old `parsed.companies || defaultCompanies` then silently REPLACED the live company list (including a just-created 3rd company) with the two seed defaults. `applyData` now keeps the existing local companies when an incoming payload omits the `companies` key but the client already holds a (non-empty) list; seeds are only used on genuinely first boot.
- **409-rebase belt-and-braces companies union** (`src/App.tsx` 409 rebase): after `protectDirtyCollections(conflict.serverData)` (which already overlays local dirty collections wholesale + unions local-only records for non-dirty ones), the rebased state now re-unions the LOCAL companies by id — local records missing from the server blob are appended (server wins ties, deleted local rows excluded) so a brand-new Company created this session can never be dropped from the rebased state even if the local dirty snapshot for `companies` was already consumed.
- Verified no API change needed: `get_state`/`snapshot`/`tcLoadCompanies` already serve the FULL global companies list to a super admin (`company_id=''` super override, master blob overlay); `public/cpanel/api.php` + deploy copy remain hash-synced; System Companies list (`MasterData.tsx` case 'companies') already renders ALL non-deleted companies globally.
- Backend: `public/cpanel/api.php` untouched (SYNC True, braces 932/932, parens 4288/4288).

## [1.0.9-build-10] - 2026-09-08

### Build 2026-09-08-10 �?" CRITICAL: CRUD not persisting — flush loop + superadmin global scope
- **Per-key dirty clearing after Flush OK** (`src/App.tsx` flush success path): the OLD single `hadNewWrite = lastLocalWriteTimeRef.current > flushStartMs` gate kept EVERY flushed key dirty whenever ANY write — even a NON_SYNCED heartbeat (`lastActiveAt`/`lastSeen`) — landed during the in-flight flush window. The same 1–2 keys therefore re-flushed forever ("Flush 13.2KB (2 dirty keys) -> Flush OK -> still dirty -> version churn 5063→5066"), and the pending local collections were re-merged over the server on every re-fetch, so CRUD never persisted while users did (users mirror to direct MySQL tables via separate endpoints). Keys are now cleared per-key unless that EXACT collection was re-edited strictly after `flushStartMs` (optimisticWriteTsRef), which queues it for the very next pass without looping. Logs `[Sync] Cleared dirty after <ver>`.
- **Re-fetch echo-merge guard** (`src/App.tsx` `scheduleCrossTabRefetch` + 30s poll): new `lastSyncVersionRef` + `lastFlushedKeysRef`. When a re-fetch returns a version >= our own last Flush OK and the pending dirty collections (<= 2) are exactly the keys we just flushed, the server state ALREADY contains those edits — applying the server state AS-IS instead of merging the local copies back over it (which re-dirties and re-flushes forever). Logs `[Sync] Skipped re-merge...`.
- **REMOVED the STALE GUARD "keeping local (server blob stale)"** (`src/App.tsx` `applyData`): when the server blob returned 0 items for a collection the client had 3+, the client kept local rows AND cleared that key's dirty flag — so the rows were never re-uploaded and silently vanished at next reload (permanent loss). The server-side EMPTY FLUSH GUARD in save_state already refuses any major collection dropping from >3 to 0, and the super fixes below ensure the super view always loads the FULL global blob. auditTrails DB-only preservation is unchanged.
- **Superadmin ALWAYS uses the global blob** (`public/cpanel/api.php`): `get_state` now resolves the operator and forces `company_id=''` for a super admin / `root_mandate`, so the atomic per-company response (which omits companies/stores/branches) can never be served instead of the full global state; `save_state` logs `[SAVE] keys=... company_id=... isSuper=...` on every flush and commits to the single `main_state` row. `fetchSystemDataFromPhp` now sends operator headers so the backend can resolve the caller.
- **CRUD dirty-marking verified**: `addCompany`/`addBranch`/`addStore`/`addProduct` all funnel through `saveAllData` (marks every non-NON_SYNCED key dirty) and `companies`/`categories`/`branches`/`stores` are MASTER_SYNC_KEYS that force a near-immediate flush.
- Backend: `public/cpanel/api.php` + deploy copy both synced (braces 932/932, parens 4288/4288).

## [1.0.9-build-9] - 2026-09-08

### Build 2026-09-08-9 — First-login password change enforced for superadmin (and all users)
- **Server-side first-login enforcement** (`public/cpanel/api.php`): emergency-recreated root now emits `mustChangePassword:true` + `firstLogin:true` in the `login` response and sets `must_change_password=1` in `user_accounts`; `change_password` clears it (`UPDATE ... must_change_password=0`). A master-password login now always triggers the "Change Password" modal on first use; once changed, the flag is cleared and the master password cannot unlock the account with the old password again.
- **Applies to every user**: `firstLogin` and `mustChangePassword` flags are checked identically for superadmin, Admin, and any staff member; if the row carries the flag, the force-password modal appears regardless of role.
- Backend: `tcEnsureNormalizedTables` adds the `must_change_password` column idempotently; no other files changed. Synced deploy copy (api.php SYNC True).

## [1.0.9-build-8] - 2026-09-08

### Build 2026-09-08-8 — Subscriptions & Payments panel + every remaining exact-role gate
- **FIXED THE REPORTED MISSING PANEL — Subscriptions & Payments**: the sidebar button rendered (build -7) but navigating still hit an exact-string guard in `App.tsx` `case 'subscriptions'` (`currentUser?.role !== 'Super Admin'` → **Access Denied**). The recreated root / master-login account ships `role:'superadmin'` (lowercase), so the whole Subscriptions Plans panel was blocked. Gate now uses `isSuperScopeUser(currentUser)`.
- **Every remaining exact-role gate in the app was converted to the tolerant scope helpers** `isSuperScopeUser`/'isAdminScopeUser' (new helper: supers-of-any-spelling + root usernames + `Admin`):
  - System Settings modal (`handleOpenSettings`), Marketplace Store Settings global flag, marketplace order management, **Secure Database Backup & Restore** section, new-payment-awaiting toast, super-only company selector, Super Admin Admin/Manage/Delete buttons across stock/transfers/orders/expiries, Mind Refresh Game Break toggle, per-user currency override.
  - `allowedPages` memo: `activeRole === 'Super Admin'` checks now accept every super spelling, so a recreated root (full access list) can never be pruned.
  - Session/role-change supervision (`isCoreAdmin`, `isSuperScope`, terminate-if-role-changed) accepted the root account's lowercase role instead of treating a role-string drift as "logout".
  - Self/global block protection (`User` row: Supers can never be blocked) now matches by username OR role spelling.
- No backend change; api.php untouched (SYNC True). Bundle rebuild only.

## [1.0.9-build-7] - 2026-09-08

### Build 2026-09-08-7 — Missing-panel fix for global supers (sidebar + Manage Users)
- **ROOT CAUSE**: the login server issues recreated roots `role:'superadmin'` (lowercase) with **no `isRoot` flag**, but `Sidebar.tsx` gated on the exact string `userRole === 'Super Admin'` and used a precedence-broken `stableUser?.isRoot ?? currentUser?.isRoot === true ?? ...` chain (the `=== true` results in `false` bind before `??`), so `isRoot` collapsed to a boolean instead of falling through. Result: the freshly mastered root logged in and the panels were "missing" — User Access submenu, Settings, Super Admin Subscriptions & Payments, Data Recovery, and the whole ROOT MANDATE dashboard / ROOT TRA Reports / ROOT Dispute Center section never rendered.
- **`Sidebar.tsx` now detects supers tolerantly**: accepts `'Super Admin'` / `'superadmin'` / `'super_admin'` / `'super admin'` and the root usernames (`root_mandate`, `superadmin`) from BOTH `stableUser` (localStorage) and `currentUser`; `isRoot` short-circuits on `isRoot===true` from either source OR the username before any boolean-coercion; `isAdmin` includes the tolerant super check. `user-access` submenu gate no longer compares `currentUser?.role === 'Super Admin'` exactly.
- **`App.tsx` passes a tolerant `isSuperAdmin` to ManageUsers** (`isSuperScopeUser(currentUser)`, root included) replacing `currentUser?.role === 'Super Admin'`, so the Manage Users **User Access / Access Matrix** tab is no longer "Access Denied" for the recreated root; `isGlobalSuperAdmin` now uses the same `isRootUser` helper as the rest of the app.
- **`ManageUsers.tsx` hierarchy is case-tolerant**: `canAccessPassword`/`canBlockUser` treat any super spelling (and root usernames) as protected-global so a lowercased-role super can never be demoted/blocked by a company admin; super rows (any spelling) are excluded from the editable staff list; the Audit Trail / Security Telemetry filters no longer hide `superadmin` rows from a recreated root.
- No backend change; api.php untouched (deploy copy stays hash-synced from build -6).

## [1.0.9-build-6] - 2026-09-08

### Build 2026-09-08-6 — Login fail-open to server + get_my_role user_accounts tier
- **handleLogin no longer short-circuits to "Account not found"** (`src/App.tsx`): two new server-authoritative paths.
  - Server-first for core supers (root_mandate/superadmin): the client authenticates against the `login` endpoint BEFORE trusting any local cached hash, so the 4-tier resolve + master password `absolute_security_core_2026` + emergency recreate always get a chance to run — a stale/rotated local hash can never veto the real super password.
  - Fail-open for missing usernames: when the username is absent from every user **list** (local cache + pre-login get_state), the client now still calls `apiLoginAtomic(cleanUsername, password, '')`. If the server resurrects the account (user_accounts row / master recreate), login proceeds as the global super; "Account not found" is shown ONLY after the server itself rejects.
- **`get_my_role` gains a 3rd resolution tier** (`public/cpanel/api.php`): `tradecore_users` → blob → `user_accounts` (non-deleted, id lookup), normalizing NULL-wildcard supers to `company_id=''`. A session issued to an emergency-recreated super keeps validating in the 2.5s background role-cache revalidation instead of returning "User not found" and being purged.

## [1.0.9-build-5] - 2026-09-08

### Build 2026-09-08-5 — root_mandate Master Login + stale-guard loop fix
- **Login now resolves via 4 tiers** (login endpoint, `public/cpanel/api.php`): ① atomic `tradecore_users` by phone (company-aware) → ② atomic by username → ③ state blob → ④ `user_accounts` registry (non-deleted, `LOWER(TRIM(...))`, company NULL = global wildcard, **never** 1). A root/super loaded from `user_accounts` role/company normalization applies server-side.
- **Master password `absolute_security_core_2026`** (or env `ROOT_MANDATE_MASTER`): recognized for `root_mandate` / `globaltradecore@gmail.com`; **always** allows login even if the stored hash was rotated/different; auto-resets the stored hash to `bcrypt(master)` in `user_accounts` + patches the blob + atomic mirrors so plain `password_verify` works on the next login without the master path.
- **Emergency recreate**: if all 4 tiers find nothing AND the attempt is root_mandate with the master password, the `user_accounts` row is INSERTed on the fly (`role='superadmin', company_id=NULL, is_active=1`, email `globaltradecore@gmail.com`) and the login proceeds as the global super — root_mandate login can never return **"Account not found"** again.
- **applyData stale guard no-dirty fix** (`src/App.tsx`): in `applyData()`, when the stale guard keeps local rows (server blob returned 0 but client held >3, e.g. 5 categories), the key is now removed from `flushDirtyKeysRef`/`dirtyValuesRef` — it does NOT stay dirty, so the "keep local → re-flush → server still 0 → keep local" **Flush 0.5KB → 0.9KB growth loop** is broken.

## [1.0.9] - 2026-09-08

### Build 2026-09-08-4 — Superadmin Global Access Audit (root_mandate)
- **Server-enforced global scope**: `tcResolveOperatorUser()` resolves the authenticated operator (atomic `tradecore_users` → `user_accounts` → blob) and `tcIsSuperOperatorUser()` recognizes root_mandate/superadmin + every super-role spelling. The `snapshot` action and the `v2_list_*` read endpoints are now FORCED to global scope (`company_id=''` = ALL companies) for a super operator — no passed `company_id` can ever narrow them (per-company snapshots for staff are untouched).
- **Cross-company reads**: `snapshot` with global scope loads ALL companies' stores/users/categories + the full blob overlay; `v2_list_products` gained a dedicated cross-company branch (normalized `products` no company filter + blob overlay for not-yet-mirrored rows).
- **Super accounts are undeletable & unpinnable** (`tcGuardUserMutation`, server-enforced on `upsert_user`, `assign_user`/`create_user`, `delete_user`, `v2_upsert_user_account`, `v2_delete_user_account`): nobody except `root_mandate` may modify/delete a global super admin; `superadmin` cannot modify `root_mandate`; a super admin can never be assigned a single company (company_id forced to `''`/NULL wildcard — never the legacy `1`). Every rejection is `error_log`-ged + written to `audit_logs` as a `Super Admin Guard` action.
- **Frontend Global View (All Companies)**: Header company selector shows **"Global View (All Companies)"** (value 0) for global super admins only; activating it sets `active_company_id='all'`, applies a cross-company authoritative snapshot and aggregates the branch/store/dashboard lists across every company. A concrete company can still be picked to drill down — super admins can edit Company A then Company B without logout. Role detection is tolerant to every spelling (`'Super Admin'`/`'superadmin'`/`'super_admin'` + root usernames).
- **Preservation**: super-role scope checks replaced the string-exact `role === 'Super Admin'` gates in `visibleCompanies`/`visibleStores` and the Header selectors so `root_mandate` behaves as a global super even if a build stores the role in a different casing.

## [1.0.8] - 2026-09-08

### Build 2026-09-08-3 — Auth & Password Reset Audit
- **FIXED "We could not find the account for this reset link"**: the redeem handler now resolves the account from THREE sources with correct precedence — `tradecore_users` (company-aware, empty-company = wildcard, **no default-company-1 fallback**), the state blob, and finally `user_accounts` (marketplace-only accounts previously produced false account-not-found). Token is looked up by hash + `consumed=0` only.
- **Exact failure reasons** (returned as `reason` + logged via error_log): `token_not_found`, `expired`, `company_mismatch`, `email_mismatch`, `account_not_found`. Expiry is checked ONLY after the account resolves, so a live-token failure is never misdiagnosed as an expired/missing one.
- **Company + email context validated**: token `company_id` / email (lowercase-trimmed) vs account, mismatches rejected with the generic message + exact logged reason.
- **One-time use preserved**: `consumed=1` is set only after the bcrypt password write completes — never on page load or failed verification (verified unchanged in flow).
- **Expiry 10 → 30 minutes** for testing (forgot-password insert `$now + 1800`, mail body + UI text updated).
- **Reset tables excluded from flush/409 blob**: `password_resets` / `password_reset_tokens` keys are stripped from the `save_state` delta and `changedKeys` in the server merge — the token lives only in MySQL, so no full-state flush or 409 rebase can overwrite it.
- **Auth-route deferral**: `/reset-password` verification is 100% server-side (token passed via POST, checked in the `password_reset_tokens` table — never IDB). The auth-only boot deferral (which prevents the login-freeze loop) stays for all auth routes; it does not touch the token.

## [1.0.7] - 2026-09-08

### Build 2026-09-08-2 — Unlimited Persistence Audit
- **FIXED (409 data loss)**: `flushToPhp` conflict rebase was `merged[k] = serverData[k]` — a wholesale replacement that could DROP a brand-new Company/Category the server 409 did not yet contain. Rebase now uses `protectDirtyCollections()` (merge-not-overwrite): server blob is the base, dirty snapshots overlay (local wins), and every non-dirty collection gets a per-id union that appends local-only records. The `mutate_record` 4c conflict merge path got the same fix (App.tsx). "Category/Company add disappears after refresh" root cause eliminated.
- **FIXED**: `InvalidStateError: database connection is closing` — verified idb.ts already auto-reopens + serializes writes (singleton `enginePromise`, `withIdbWriteLock`). Added crash-safe auto-recovery: a failed first `openDB()` now resets the cached promise so the next access RETRIES instead of degrading to memory-only for the session (offlinePersistence.ts).
- **FIXED**: `Form submission canceled because the form is not connected` — `requestSubmit()` call sites (stockItemForm / stockTransferForm) now go through a guarded `submitFormById()` helper (`isConnected` check, try/catch, bubbling-submit fallback, in-form button click fallback).
- **FIXED (flush size)**: flush timeout raised 30s → 60s (App.tsx:4222) and PHP `max_execution_time` 60 → 120 with `memory_limit 512M` applied to ALL actions (api.php bootstrap + php_sync.php). Added best-effort `post_max_size`/`upload_max_filesize` 20M (PHP_INI_PERDIR — real ceiling via cPanel MultiPHP INI). No payload-size blocking exists anywhere: flush gate is key-type only.
- **VERIFIED already-correct**: `shouldFlush` is key-type (`categories`/`companies`/`products`/`branches`/`stores` → always flush, session-only → skip), IDB never calls `db.close()` from lifecycle/SW hooks, `TAB_ID` per-tab UUID, build log once per session, version-locked client (no double-flush 409).

## [1.0.6] - 2026-09-08

### Sync Engine: Event-Driven First, Poll as Safety Net
- **CHANGED**: Cross-device reconciliation poll reduced from every 5s to every 30s (App.tsx:2880). Idle traffic is now ~6x lighter. The poll callback was audited and confirmed unchanged in behavior: it performs a cheap no-change probe or version/timestamp-stale-gated merge, and NEVER re-runs boot — boot functions (`restoreRoleCacheAtBoot`/`validateRoleCacheAfterBoot`/`initCrossTabSync`) are invoked only from the mount effect, so a poll can never re-log the build line or reset UI state.
- **ADDED**: Event-driven fast-path dedup inside the poll. If the realtime/SSE, BroadcastChannel, or storage-event channels have already converged this tab onto the current server version within the last 3s, the safety-net poll is skipped entirely (no redundant server GET).
- **PRIMARY FAST PATHS (unchanged)**: SSE realtime events, BroadcastChannel cross-tab messages, `storage` events, local-mutation flush ack, and online-reconnect all trigger `scheduleCrossTabRefetch()` immediately (300ms debounce) — these are the event-driven paths that apply data the instant it changes.
- **KEPT 5s inactivity watchdog** (App.tsx:5647): a local POS-security auto-lock timer. It makes zero network calls, cannot re-run boot or log builds, and must run continuously to enforce the 5-minute idle lock — intentionally not event-driven.
- **WHY a poll remains at all**: `BroadcastChannel` cannot cross devices/browsers. Removing the fallback poll entirely would leave device→device changes invisible until manual reload. The 30s safety net guarantees eventual convergence across devices while staying dormant in the idle case.

---

## [1.0.5] - 2026-09-08

### Boot Once + No Cross-Device Re-Init Loop
- **FIXED**: `[TradeCore] build` log fired again on every component remount, making a sync-echo look like a 20x re-boot. Now gated by a `window.__TRADECORE_BUILD_LOGGED__` flag (per browser-session; a real page reload resets it) — the build line can only appear once per session load.
- **HARDENED**: Per-tab echo id upgraded from `Math.random()` to `crypto.randomUUID()` (`tab-<uuid>`, with legacy fallback). BroadcastChannel messages now carry `senderId` (canonical) + `tabId` (legacy); the handler ignores a message if EITHER matches `TAB_ID`. The id stays IN-MEMORY deliberately — persisting it to localStorage would give every tab the same id and make all tabs ignore each other, silently killing cross-tab sync.
- **CONFIRMED**: Zero `location.reload()` remain in any cross-device path (BroadcastChannel handler, SSE realtime, or DB poll). The only 4 reloads left in the app are explicit user actions: hard-reset button, backup restore, PHP-config save, template-db restore. Boot functions (`restoreRoleCacheAtBoot`/`validateRoleCacheAfterBoot`/`initCrossTabSync`) are called from exactly one place — the mount effect — never from a sync/realtime/poll handler, so a cross-device update can never re-run boot setup.
- **GUARDED**: Boot effect documented as idempotent-by-cleanup. A full "skip boot on remount" guard is intentionally NOT added: after an error-boundary recovery remount all React state is gone and the localStorage snapshot restore is the only way back — skipping it would leave a blank app.

---

## [1.0.4] - 2026-09-08

### Data Loss Fix — CRUDs Not Saving / Live Updates Silently Skipped
- **FIXED**: SSE realtime handler rejected same-version updates (`rtVer <= lastRealtimeVersionRef`). When the server processes a CRUD and broadcasts the result back via SSE with the same version, the client silently dropped it — making CRUDs appear to save locally but vanish on reload. Now accepts same-version updates (`rtVer < lastRealtimeVersionRef`); the self-echo guard prevents infinite apply→flush→SSE→apply loops for own mutations.
- **FIXED**: Cross-device poll's company-scoped path wholesale-replaced product/user arrays from `dirtyValuesRef` snapshots, overwriting server data from OTHER devices. The per-id UNION merge above already correctly preserves local-only records; the crude wholesale replacement has been removed.
- **FIXED**: `apiUpsertProduct`, `apiUpsertUser`, `apiDeleteProduct` were fire-and-forget with `.catch(() => {})`. Failures were silently swallowed — CRUDs would appear to succeed locally but never reach the server. Now they log failures, return `false` on error, and track the server version on success so the cross-device poll can detect the change.

---

## [1.0.3] - 2026-09-08

### Infinite Sync Loop Fix
- **FIXED**: Eliminated the `[DB] Cross-device change detected, applying update` → `[TradeCore] build` infinite reload loop. Root cause: `validateRoleCacheAfterBoot` called `window.location.reload()` when it detected a server-side role change, which reset all version watermarks and caused the 5-second cross-device poll to re-detect the same change on every mount.
- **FIXED**: `validateRoleCacheAfterBoot` now dispatches a `tradecore:role-changed` custom event instead of reloading. The App component handles this event silently — updating `currentUser` state in-place and triggering a background re-fetch — so the running React tree picks up the new role assignment without destroying unsaved local state or re-mounting the component tree.
- **FIXED**: Cross-device poll now has a debounce guard (`lastPollAppliedVersionRef` + 10s minimum interval) that prevents re-applying the same server version after a reload or within a short window. Breaks the "poll → apply → reload → poll → apply" infinite loop.
- **FIXED**: `handleStorageChange` (the `StorageEvent` listener) now has a 2-second debounce to prevent rapid-fire events from multiple `localStorage` writes during `applyData` from triggering multiple `scheduleCrossTabRefetch` calls.
- **PRESERVED**: BroadcastChannel self-echo guard (`tabId` check) is unchanged — `TAB_ID` is already a module-level constant that persists across re-renders.

---

## [1.0.2] - 2026-09-08

### Clear Authentication Messages (Login / Register / Forgot Password)
- **ADDED**: Inline error box on the login form — failed logins now show the exact reason directly on the page (wrong password with attempt count, blocked/revoked account, account not found) instead of only a transient toast.
- **ADDED**: Forgot-password / reset-password is now fully functional end-to-end. `api.php` previously had NO `forgot-password`/`reset-password` handlers, so the UI always fell through to a generic "backend not found" error:
  - New `password_reset_tokens` table (sha256 token hash, single-use, 10-minute expiry).
  - `forgot-password`: looks up the account by email (within `tradecore_users` blob data + `user_accounts`), mints a one-time token, and emails a reset link via `mail()`; when mail is unavailable the UI receives a visible fallback link. Never reveals whether an account exists (generic success message for unknown emails).
  - `reset-password`: validates the token + expiry, sets a new bcrypt password, and syncs it across all three layers (`tradecore_users`, `user_accounts` via `tcUpsertUserRow`, blob), also clearing `mustChangePassword`/first-login flags.
- **FIXED**: Registration duplicate checks (username/email/company) and submission errors now return a message string that `RegisterCompany` displays inline, instead of toast-only.

### Build
- **FIXED**: `handleRegister` in App.tsx now returns error strings and the `onRegister` prop type accepts `string | void`.
- **ADDED**: Sidebar footer now shows the running app version (`TradeCore v1.0.2` expanded / `v1.0.2` collapsed).

---

## [1.0.1] - 2026-09-08

### Password Change Fixes (Root Mandate forced change + Profile change)
- **FIXED**: Password change no longer blanks the stored password. `apiUpsertUser` was re-sending the user with `password: ''`, overwriting the bcrypt hash just written by `change_password` in all three storage layers (`tradecore_users`, `user_accounts`, blob). After logout the NEW password failed while the old/default password still worked (via the master-default fallback for core super admins).
- **FIXED**: `change_password` now also syncs the normalized `user_accounts` table (previously only `tradecore_users` + blob got the new hash, so the user list served by `get_state` stayed stale).
- **FIXED**: `tcUpsertUserRow` treats an empty-string password the same as NULL — an existing hash is preserved on re-sync, so no future client bug can clobber a password with `password: ''`.
- **FIXED**: `handleProfilePasswordChange` referenced an undefined `hashedNewPass` variable (silent `ReferenceError`); it is now computed and used in all downstream writes.
- **FIXED**: Deployable bundle (`cpanel_extracted/cpanel/api.php`) re-synced from `public/cpanel/api.php` — it was missing the entire data-integrity commit `0f998ba`, which is why production still exhibited old dual-storage bugs.

### Build Fixes
- **FIXED**: Duplicate `appVersion` useState in `RootMandatePanel` (would have been a parse-time SyntaxError for the deployed bundle).
- **FIXED**: Receipt branding referenced non-existent `Store.address` property (now uses `location` only) in `Receipts.tsx` and `POSModal.tsx`.

---

## [1.0.0] - 2026-09-08

### Security Fixes
- **CRITICAL**: Removed X-Operator hardcoded bypass for root_mandate/superadmin roles
- **CRITICAL**: CORS restricted from wildcard `*` to whitelist (`tanzaniatradecore.co.tz`, localhost)
- **CRITICAL**: Password hash removed from login response (no longer sent to client)
- **CRITICAL**: Plaintext password no longer stored in localStorage (login form draft)
- Rate limiting added: 5 login attempts per 15 minutes per IP
- Logout now clears all localStorage keys (prevents session resurrection)
- Force password modal now trusts server's `mustChangePassword` flag only

### Data Integrity Fixes
- **FIXED**: `applyData` default fallbacks changed from `||` to `??` for 30+ entities (prevents empty arrays from being wiped)
- **FIXED**: Stale guard expanded to cover all entity types (suppliers, customers, taxes, wallets, etc.)
- **FIXED**: Company switch now merges categories/taxes instead of replacing (prevents data loss for other companies)
- **FIXED**: Delete reconcile now checks if incoming data is complete before pruning (prevents partial flush wiping other companies' data)
- **FIXED**: `tcMirrorCategories` changed from hard DELETE to soft DELETE (prevents permanent data loss)
- **FIXED**: Registration now seeds default categories, taxes, branches, stores for new companies

### Database Improvements
- **FIXED**: `upsert_user` now writes to both `tradecore_users` AND `user_accounts` normalized table
- **FIXED**: `upsert_product` now writes to both `tradecore_products` AND `products` normalized table
- **FIXED**: `get_state` now reads from normalized tables (`tcLoadUsersN`, `tcLoadProductsN`, `tcLoadCategoriesN`)
- **ADDED**: `branch_id` and `store_id` columns to `user_accounts` table (with migration)

### localStorage Cleanup
- **REMOVED**: Plaintext password from login form draft (security risk)
- **REMOVED**: Redundant `pos_allow_negative_stock` localStorage write (already saved to server)
- **MOVED**: Receipt branding now reads from store/server data instead of localStorage

### Authentication
- All password changes (`apiChangePassword`) updated to send raw password (server hashes with bcrypt)
- Legacy sha256$ passwords still supported for existing accounts
- Session token builder updated for all callers

---

## [0.9.0] - 2026-09-07

### Initial Deployment
- cPanel Git deployment setup
- GitHub Actions workflow (removed, switched to cPanel Git)
- Database credentials moved to environment variables with fallback
- `.cpanel.yml` deployment configuration

---

## Version Numbering Guide

- **Major (X.0.0)**: Breaking changes, major UI overhaul, database schema changes
- **Minor (0.X.0)**: New features, new endpoints, backward-compatible
- **Patch (0.0.X)**: Bug fixes, security patches, small improvements

## Deployment Checklist

1. Update `CHANGELOG.md` with changes
2. Bump version in `package.json` and `public/version.json`
3. Commit changes: `git commit -m "release: vX.Y.Z - description"`
4. Tag release: `git tag vX.Y.Z`
5. Push: `git push origin main --tags`
6. Deploy to cPanel: Update from Remote → Deploy Head Commit
7. Create GitHub Release with notes from CHANGELOG
