# Changelog

All notable changes to TradeCore ERP will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
