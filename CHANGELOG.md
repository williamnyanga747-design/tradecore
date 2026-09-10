# Changelog

All notable changes to TradeCore ERP will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

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
