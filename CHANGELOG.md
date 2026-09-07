# Changelog

All notable changes to TradeCore ERP will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
