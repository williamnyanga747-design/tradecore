# DEBUG_PWA.md — Clear old PWA cache after deploy (UNIVERSAL vs TANZANIA split)

## Why you saw two brandings
- Homepage hero (`UNIVERSAL'S` vs `TANZANIA'S`) is **not** hardcoded — it comes from `tradecore_system_state.content.heroTitle` stored in MySQL (`cpanel/api.php` single blob). The browser/PWA caches a copy in `localStorage tradecore_data`.
- Before the fix, `?action=check_timestamp` was hijacked by `get_state` and downloaded the full 5 MB every 5 s, and `updated_at TIMESTAMP` had 1-second resolution → two writes in the same second looked identical → poll never fired. Device A saved `UNIVERSAL` but Device B kept stale `TANZANIA` in its localStorage/PWA cache.
- The fix adds a monotonic `version BIGINT` + `changedKeys` merge + `GET_LOCK` + version-first poll (`src/utils/api.ts` / `public/cpanel/api.php`), so all devices converge ≤ 5 s. `public/sw.js` cache name was bumped to `tanzaniatradecore-v2-20260826` and now `NetworkOnly` for `api.php`/`php_sync.php`.

## What was changed in this zip
- `public/sw.js` — `CACHE_NAME` → `v2-20260826`, fetch handler now `NetworkOnly` for any `api.php`/`php_sync.php`/`?action=` request; stale shell auto-updates on next load (`src/App.tsx` forces `registration.update()` and reloads on `controllerchange`).
- `public/.htaccess` / `dist/.htaccess` — `index.html`/`sw.js`/`manifest.json` → `no-cache, no-store`, `*.js,*.css` → `immutable` (so a new hash `index-*.js` is fetched after `index.html` refresh).
- `public/manifest.json` stays `GlobalTradeCore - Online Marketplace Tanzania` (factory `initialData.ts:77`). Hero branding is server-driven, not manifest — after sync both PWA and browser will show the same value as `Root → Homepage → Hero Title` on the server.

## How to force all devices to the same view (one-time)
All browsers/Tabs/PWAs will auto-converge on next hard refresh. If a device still shows old `TANZANIA'S` after deploy:

### Android Chrome (installed PWA)
1. Long-press the PWA icon → **App info** → **Uninstall** (or Chrome → `⋮` → **Uninstall GlobalTradeCore**).
2. Chrome → `⋮` → **Settings** → **Privacy and security** → **Delete browsing data** → **Cached images and files** (keep cookies if you like).
3. Reopen `https://tanzaniatradecore.co.tz` in Chrome → you should see the new Hero Title (check `Root → Homepage` value). Chrome will offer **Install app** again → install. The new PWA will be `v2`.

### iOS Safari (installed PWA)
1. Long-press icon → **Remove App** → **Delete**.
2. Settings → Safari → **Clear History and Website Data** (or Safari → `aA` → **Website Settings** → remove).
3. Reopen site in Safari → **Share** → **Add to Home Screen**.

### Desktop Chrome/Edge
1. `chrome://apps` → right-click TradeCore → **Remove**.
2. DevTools → **Application** → **Clear storage** → **Clear site data** (or `Ctrl+Shift+Delete` → Cached images/files).
3. Reload (`Ctrl+F5`). If `Application → Service Workers` still shows an old worker, click **Unregister**, then reload.

### Verify
- DevTools → **Application** → **Local Storage** → `tradecore_data` → `_version` should match MySQL `SELECT version FROM tradecore_system_state WHERE doc_key='main_state'`.
- Console should show `[DB] Cross-device change detected` within 5 s of another device's edit.
- `manifest.json` `name` is intentionally neutral (`GlobalTradeCore…`); check branding via `content.heroTitle` in that same `localStorage` entry.

### If login still fails on PWA but works in browser
- Auth is `localStorage tradecore_user` (not sessionStorage) — PWA and browser share the same origin storage, but an old PWA with a stale Service Worker may have a stale `tradecore_data.users[]`. After the steps above, create/test a user on Device A, then within 5 s try login on the PWA — it will succeed once the version poll has fetched the new blob.
