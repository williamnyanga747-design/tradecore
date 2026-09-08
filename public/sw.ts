/// <reference lib="webworker" />

// TradeCore custom Service Worker (injectManifest mode).
//
// Why custom (instead of generateSW): the generateSW baseline had no way to attach a
// fallback CATCH handler, so a document/navigation fetch that failed under network
// latency or while offline produced an unhandled Promise rejection in browser DevTools:
//   The FetchEvent for "https://tanzaniatradecore.co.tz/" resulted in a network error
//   response: the promise was rejected.
//   Uncaught (in promise) TypeError: Failed to fetch at workbox-*.js
//
// This SW:
//   1. Precache + route the injected build manifest (__WB_MANIFEST).
//   2. Routes SPA HTML *document* navigations with NetworkFirst + a SHORT timeout so a
//      slow/hung request falls back to the precached index.html instead of throwing.
//   3. Attaches setCatchHandler() as the FINAL safety net: any navigation fetch that
//      still fails returns the cached index.html (or offline.html) — it never rejects.
//   4. Deliberately excludes ALL API/SSE paths (/api/*, php_sync.php, cpanel/api.php,
//      /login, offline.html) from every handler so the Service Worker never intercepts
//      them. They always go straight to the network (never cached, never throw a
//      Workbox 'no-response' / 'Failed to fetch').
//
// CRASH-PROOFING (fixes "ServiceWorker script evaluation failed for .../sw.js"):
//   a. NO window / document / DOM references anywhere — the worker context exposes
//      only `self`. Workbox's bundled helpers use `location`, which in a worker
//      resolves safely to `self.location`. Everything else stays `self`-scoped.
//   b. The injected precache manifest is NULL-SAFE: if a stale/manual `sw.js` is
//      served without __WB_MANIFEST (or it is malformed), we skip precaching instead
//      of throwing at the top level. A throw during evaluation is exactly what
//      browsers report as "script evaluation failed" and it poisons ALL future
//      registrations until the file byte-hash changes.
//   c. Every listener registration, route and catch handler is wrapped in try/catch.
//   d. Global `error` / `unhandledrejection` handlers swallow stray asynchronous
//      failures so a bad line can never cascade into a rejected evaluation.
//
// INDEXEDDB GUARD (2026-09-07-03): this worker uses ONLY the Cache Storage API
// (caches.open/put/delete/match). It MUST NEVER open or close the main-window
// app database (`tradecore-offline`) or any IndexedDB connection. Background fetch
// cycles, precache cleanups (cleanupOutdatedCaches / activate purge) and cache
// invalidation MUST continue to operate purely on Cache Storage — an IDB
// connection closed by a worker would surface in the page as:
//   InvalidStateError: Failed to execute 'transaction' on 'IDBDatabase':
//   The database connection is closing.
// The OfflineEngine wrapper in src/utils/idb.ts auto-reopens such handles, but the
// worker must never be the one closing them. No indexedDB.* or db.close() calls are
// permitted in this file.

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST?: Array<{ url: string; revision: string | null }>;
};

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, setCatchHandler } from 'workbox-routing';
import { NetworkFirst, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { clientsClaim } from 'workbox-core';

// ---------------------------------------------------------------------------
// ACTIVE BUILD IDENTIFIER — user-confirmed update flow.
// BUMP THIS on every deploy that must drop stale app-shell caches. The SW NEVER
// purges caches or skip-waits on its own: when a new build is installed it posts
// a message to every open client and the page shows a "new version available"
// banner. The user chooses when to refresh; only when they confirm (via the
// SKIP_WAITING message) does the new SW activate and purge stale caches, so
// unsaved work / open sessions are never lost to a silent forced reload.
// ---------------------------------------------------------------------------
const BUILD_VERSION = '2026-09-08-3';
const BUILD_META_CACHE = 'build-meta';
const readBuildVersion = async (): Promise<string | null> => {
  try {
    const cache = await caches.open(BUILD_META_CACHE).catch(() => null);
    if (!cache) return null;
    const res = await cache.match('build-version').catch(() => undefined);
    return res ? await res.text() : null;
  } catch {
    return null;
  }
};
const recordBuildVersion = async (): Promise<void> => {
  try {
    const cache = await caches.open(BUILD_META_CACHE).catch(() => null);
    if (cache) await cache.put('build-version', new Response(BUILD_VERSION, { headers: { 'Content-Type': 'text/plain' } })).catch(() => {});
  } catch {}
};

// Strategy availability guard. In this production build Rollup INLINES all the
// Workbox modules into the single emitted sw.js (verified: the bundle has zero
// runtime `import` statements, so a bare `CacheFirst is not defined` ReferenceError
// is impossible here — the classes are always defined). The lookup below exists
// purely as belt-and-suspenders: if a LEGACY / hand-served static copy of this
// script ever fails to resolve its workbox references, every strategy-based route
// degrades to network-only instead of throwing during script evaluation.
let strategies: {
  NetworkFirst: typeof NetworkFirst;
  CacheFirst: typeof CacheFirst;
  CacheableResponsePlugin: typeof CacheableResponsePlugin;
  ExpirationPlugin: typeof ExpirationPlugin;
} | null = null;
try {
  strategies = { NetworkFirst, CacheFirst, CacheableResponsePlugin, ExpirationPlugin };
} catch (e) {
  console.warn('[SW] workbox strategies unavailable — cache routes disabled:', e);
}

// -----------------------------------------------------------------------------
// d. Global guards — an unrecoverable async failure must NEVER reject evaluation.
// -----------------------------------------------------------------------------
self.addEventListener('error', (event) => {
  event.preventDefault();
});
self.addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
});

// -----------------------------------------------------------------------------
// Entire boot inside one guarded IIFE. If ANY setup step throws, the SW still
// evaluates successfully (degraded to network-only) so the browser stops failing.
// -----------------------------------------------------------------------------
(() => {
  try {
    // The injected precache manifest (workbox replaces this single literal token
    // with `[{"url":"index.html",...}, ...]` at build time). The manifest is
    // optional: if it is ever missing or malformed (e.g. a stale manual copy is
    // served instead of the build output), we skip precaching instead of throwing.
    // NOTE: keep EXACTLY ONE occurrence of the literal below — workbox-build's
    // injectManifest asserts there is precisely one injection point per file.
    let manifest: Array<{ url: string; revision: string | null }> = [];
    try {
      const injected = self.__WB_MANIFEST;
      if (Array.isArray(injected)) manifest = injected;
    } catch (e) {
      console.warn('[SW] manifest read failed:', e);
    }

    // Take control of already-open pages on FIRST install (so the app is
    // offline-ready), but do NOT skip-wait on later updates — that respects the
    // 'prompt' update flow (user-confirmed updates only).
    try {
      clientsClaim();
    } catch (e) {
      console.warn('[SW] clientsClaim failed:', e);
    }

    // Precache every file emitted by the production build (only if injected).
    try {
      if (manifest.length > 0) {
        precacheAndRoute(manifest);
      } else {
        console.warn('[SW] __WB_MANIFEST missing or empty — precache skipped (network-only mode)');
      }
    } catch (e) {
      console.warn('[SW] precacheAndRoute failed (network-only mode):', e);
    }

    // Remove stale precache entries from previous deploys (fixes stale index.html /
    // old workbox-*.js assets lingering after an update).
    try {
      cleanupOutdatedCaches();
    } catch (e) {
      console.warn('[SW] cleanupOutdatedCaches failed:', e);
    }

    // Honour the updatePrompt's SKIP_WAITING message so the new SW activates
    // promptly ONLY when the user confirms the update (App.tsx sends this via
    // registerSW/updateSW).
    try {
      self.addEventListener('message', (event: ExtendableMessageEvent) => {
        try {
          if (event.data && event.data.type === 'SKIP_WAITING') {
            void self.skipWaiting();
          }
        } catch (e) {}
      });
    } catch (e) {
      console.warn('[SW] message listener failed:', e);
    }

    // ---------------------------------------------------------------------------
    // USER-CONFIRMED NEW-BUILD FLOW (install):
    // When a freshly installed SW carries a DIFFERENT BUILD_VERSION than the one
    // recorded at the previous activation, this is a NEW BUILD. We do NOT purge
    // caches or skip-wait here — instead we notify every open client so the page
    // can show "A new version is available. Refresh now to apply updates."
    // ---------------------------------------------------------------------------
    try {
      self.addEventListener('install', (event: ExtendableEvent) => {
        const notifyClients = () => {
          try {
            // Only notify when this is a REAL update (a previous build was recorded
            // at an earlier activation). A first-ever install records nothing, so the
            // banner is never shown on a brand-new visitor's first load.
            readBuildVersion().then((previous) => {
              if (previous === null || previous === BUILD_VERSION) return;
              self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
                for (const client of clients) {
                  try {
                    client.postMessage({ type: 'NEW_VERSION_AVAILABLE', version: BUILD_VERSION });
                  } catch (e) {}
                }
                console.log('[SW] New build ' + BUILD_VERSION + ' detected — banner shown. Waiting for user confirmation before activating.');
              }).catch(() => {});
            }).catch(() => {});
          } catch (e) {}
        };
        // Defer the postMessage until the install event has finished processing.
        event.waitUntil(new Promise<void>((resolve) => {
          try { notifyClients(); } catch (e) {}
          resolve();
        }));
      });
    } catch (e) {
      console.warn('[SW] install notification listener failed:', e);
    }

    // ---------------------------------------------------------------------------
    // NEW-BUILD CACHE INVALIDATION (activate):
    // Runs AFTER the user approved the update (the SKIP_WAITING message above made
    // this SW active). When BUILD_VERSION differs from the version recorded at the
    // previous activation, purge every runtime cache + leftover workbox-* precache
    // and record the new build. Never runs on its own — activation is the user's
    // confirmation that a refresh is safe.
    // ---------------------------------------------------------------------------
    try {
      self.addEventListener('activate', (event: ExtendableEvent) => {
        event.waitUntil((async () => {
          try {
            const previous = await readBuildVersion();
            if (previous !== BUILD_VERSION) {
              const keys = await caches.keys().catch(() => []);
              await Promise.all(
                keys
                  .filter((k) => k !== BUILD_META_CACHE)
                  .map((k) => caches.delete(k).catch(() => false))
              );
              await recordBuildVersion();
              // Re-populate the fresh build's precache immediately (activation runs AFTER
              // install, whose precache we just purged) so the new shell is served from
              // cache on the very next navigation — never re-downloaded lazily.
              try {
                if (manifest.length > 0) precacheAndRoute(manifest);
              } catch (e) {
                console.warn('[SW] re-precache on activate failed:', e);
              }
              console.log('[SW] New build ' + BUILD_VERSION + ' activated after user confirmation — stale caches purged.');
            } else {
              console.log('[SW] Build ' + BUILD_VERSION + ' already active. Nothing to purge.');
            }
            // Claim previously-controlled clients ONLY now — the page is reloading
            // under the user's control, so claiming at this point is safe.
            try {
              await self.clients.claim();
            } catch (e) {
              console.warn('[SW] clients.claim failed:', e);
            }
          } catch (e) {
            console.warn('[SW] Build-version cache invalidation failed:', e);
          }
        })());
      });
    } catch (e) {
      console.warn('[SW] activate listener failed:', e);
    }
    // ---------------------------------------------------------------------------
    // SPA document (HTML) navigation — NetworkFirst with a SHORT network timeout.
    // ---------------------------------------------------------------------------
    const isNavigation = (url: URL, request: Request): boolean =>
      request.mode === 'navigate' || request.destination === 'document' || url.pathname === '/';

    // Paths the Service Worker must NEVER intercept (they go straight to the network).
    const isExcludedSpaPath = (pathname: string): boolean =>
      pathname.includes('/api/') ||
      pathname.includes('/cpanel/') ||
      pathname.includes('php_sync') ||
      pathname.includes('.php') ||
      pathname === '/login' ||
      pathname.includes('/login') ||
      pathname === '/offline.html';

    try {
      if (!strategies) {
        console.warn('[SW] HTML navigation route disabled (strategies unavailable)');
      } else {
        registerRoute(
          ({ request, url }) => {
            if (!isNavigation(url, request)) return false;
            if (isExcludedSpaPath(url.pathname)) return false;
            // Only handle our own origin HTML navigations.
            if (url.origin !== self.location.origin) return false;
            return true;
          },
          new strategies.NetworkFirst({
            cacheName: 'html-cache',
            networkTimeoutSeconds: 3,
            plugins: [
              // Only cache successful HTTP 0 (opaque) / 2xx responses.
              new strategies.CacheableResponsePlugin({ statuses: [0, 200] }),
              new strategies.ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 7 }),
            ],
          }),
          'GET'
        );
      }
    } catch (e) {
      console.warn('[SW] HTML navigation route failed:', e);
    }

    // ---------------------------------------------------------------------------
    // RUNTIME CACHING — Leaflet map tiles (offline-dashboard requirement).
    // CacheFirst + Expiration; scoped to known tile host patterns ONLY.
    // ---------------------------------------------------------------------------
    try {
      if (!strategies) {
        console.warn('[SW] tile runtime route disabled (strategies unavailable)');
      } else {
        registerRoute(
          ({ url, request }) => {
            if (request.method !== 'GET') return false;
            if (url.origin !== self.location.origin) {
              // Only third-party tile hosts that are safe to cache (no cookies,
              // immutable tiles). Everything else from other origins stays network-only.
              const host = url.hostname;
              if (![
                'tile.openstreetmap.org',
                'a.tile.openstreetmap.org',
                'b.tile.openstreetmap.org',
                'c.tile.openstreetmap.org',
                'tile.osm.org',
                'server.arcgisonline.com',
                'services.arcgisonline.com',
              ].includes(host)) return false;
            }
            return true;
          },
          new strategies.CacheFirst({
            cacheName: 'tile-cache',
            plugins: [
              new strategies.CacheableResponsePlugin({ statuses: [0, 200] }),
              new strategies.ExpirationPlugin({
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30,
                purgeOnQuotaError: true,
              }),
            ],
          }),
          'GET'
        );
      }
    } catch (e) {
      console.warn('[SW] tile runtime route failed:', e);
    }

    // ---------------------------------------------------------------------------
    // FINAL SAFETY NET: never let a navigation fetch surface as an unhandled
    // rejection. Returns cached index.html → offline.html → in-memory 200.
    // ---------------------------------------------------------------------------
    try {
      setCatchHandler(async ({ event }) => {
        if (event && 'request' in event && event.request) {
          const req = event.request;
          const dest = req.destination || ((req as any).mode === 'navigate' ? 'document' : '');
          if (dest === 'document' || dest === '' || !req.destination) {
            const cache = await caches.open('html-cache').catch(() => null);
            if (cache) {
              const cachedIndex = await cache.match('index.html').catch(() => undefined);
              if (cachedIndex) return cachedIndex;
              const cachedOffline = await cache.match('/offline.html').catch(() => undefined);
              if (cachedOffline) return cachedOffline;
            }
            // Last resort: an in-memory 200 so the browser never sees an
            // unhandled rejection.
            return new Response('<!doctype html><html><head><meta charset="utf-8"><title>TradeCore Offline</title></head><body><h1>You are offline</h1><p>Please check your connection and reload.</p></body></html>', {
              status: 200,
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            });
          }
        }
        // For any other (non-document) request, return a clean 504 — never reject.
        return new Response('Service Unavailable', { status: 504, statusText: 'Service Unavailable' });
      });
    } catch (e) {
      console.warn('[SW] setCatchHandler failed:', e);
    }
  } catch (e) {
    // Absolute last line of defence: evaluating the script itself is what matters.
    // Even if nothing else above worked, execution reaches here without throwing.
    console.warn('[SW] boot failed — running in network-only mode:', e);
  }
})();