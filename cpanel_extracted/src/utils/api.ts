/**
 * PHP & MySQL Backend API Client Service
 * Designed for cPanel, Shared Hosting, or standard LAMP/LEMP stacks.
 * Replaces Firebase with direct PHP REST endpoints & real-time WebSocket/EventSource sync.
 */

export interface PhpConfig {
  apiUrl: string;
  wsUrl: string;
  apiKey?: string;
}

const DEFAULT_API_URL = '/cpanel/api.php';

// Monotonic server version — authoritative cross-device change detector
// (fixes same-second TIMESTAMP collisions where 2 saves within 1s had identical updated_at)
let _lastServerVersion = 0;
export function getLastServerVersion(): number { return _lastServerVersion; }
export function setLastServerVersion(v: number): void { _lastServerVersion = Number(v) || 0; }

// 409 Conflict data: when the server rejects a stale write, it returns the fresh server state.
// The caller (flushToPhp) can use this to re-fetch and rebase.
export const _conflictData: { _pending: any; _serverVersion: number } = { _pending: null, _serverVersion: 0 };
export function consumeConflictData(): { serverData: any; serverVersion: number } | null {
  if (_conflictData._pending) {
    const d = { serverData: _conflictData._pending, serverVersion: _conflictData._serverVersion };
    _conflictData._pending = null;
    _conflictData._serverVersion = 0;
    return d;
  }
  return null;
}

/**
 * fetch() wrapper with an AbortController timeout so a slow/hanging PHP backend
 * (shared hosting, cold start, network blips) can never stall the UI indefinitely.
 * On timeout the request is aborted and the caller's normal catch/fallback path runs.
 */
function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs: number = 30000, opts?: { ignoreOuterSignal?: boolean }): Promise<Response> {
  // Always create a FRESH AbortController per request. A shared/forwarded signal
  // would let one aborted request cascade into all in-flight requests, surfacing
  // as "AbortError: signal is aborted without reason" on unrelated saves.
  const ms = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);
  // DATA-LOSS GUARD: WRITE requests (save_state, mutate_record, atomic POSTs) must
  // NEVER be tied to a caller-supplied abort signal. A caller abort (e.g. rapid
  // company switch or unmount tearing down a stale request) would kill an in-flight
  // flush and drop the user's edits. Writes opt out of outer-signal forwarding and
  // are aborted only by their OWN timeout (a late write is safer to finish than to
  // abort mid-save). Reads keep the behavior so unsubscribed UI can cancel.
  if (!opts?.ignoreOuterSignal && init.signal) {
    const outer = init.signal;
    if (outer.aborted) controller.abort();
    else outer.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return fetch(input, { ...init, signal: controller.signal })
    .then((res) => {
      // ISSUE 2: server-side session revocation. If the backend returns 401 with the
      // SESSION_REVOKED marker (user deleted / blocked / deactivated), notify the app
      // so it can force a hard logout. Uses .clone() so the original response body is
      // preserved for the caller. Fire-and-forget — never blocks or throws.
      if (res && typeof res.status === 'number' && res.status === 401) {
        res.clone().text().then((t) => {
          if (t.indexOf('SESSION_REVOKED') !== -1) {
            try {
              window.dispatchEvent(new CustomEvent('tradecore:session-revoked', { detail: { reason: 'SESSION_REVOKED' } }));
            } catch (e) {}
          }
        }).catch(() => {});
      }
      return res;
    })
    .finally(() => {
      clearTimeout(timeoutId);
    });
}

export function getPhpConfig(): PhpConfig {
  let savedApiUrl = '';
  let savedWsUrl = '';
  let savedApiKey = '';

  try {
    if (typeof localStorage !== 'undefined') {
      savedApiUrl = localStorage.getItem('tradecore_php_api_url') || '';
      savedWsUrl = localStorage.getItem('tradecore_php_ws_url') || '';
      savedApiKey = localStorage.getItem('tradecore_php_api_key') || '';
    }
  } catch (e) {}

  const apiUrl = savedApiUrl || _discoveredApiUrl || (import.meta as any).env?.VITE_PHP_API_URL || DEFAULT_API_URL;
  const wsUrl = savedWsUrl || (import.meta as any).env?.VITE_PHP_WS_URL || '';

  return {
    apiUrl,
    wsUrl,
    apiKey: savedApiKey
  };
}

export function savePhpConfig(config: Partial<PhpConfig>): void {
  try {
    if (typeof localStorage !== 'undefined') {
      if (config.apiUrl !== undefined) localStorage.setItem('tradecore_php_api_url', config.apiUrl);
      if (config.wsUrl !== undefined) localStorage.setItem('tradecore_php_ws_url', config.wsUrl);
      if (config.apiKey !== undefined) localStorage.setItem('tradecore_php_api_key', config.apiKey);
    }
  } catch (e) {
    console.error('Failed to save PHP config:', e);
  }
}

/**
 * Attach the authenticated operator identity as headers so the backend can (a) validate
 * live user status on every sync/request (Issue 2: instant revocation of deleted/blocked
 * users) and (b) record who performed each action in audit_logs (Issue 3).
 * Public/marketplace flows carry no operator → headers are empty and the guard is a no-op.
 */
export function getOperatorHeaders(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    if (typeof localStorage === 'undefined') return out;
    const raw = localStorage.getItem('tradecore_user');
    if (!raw) return out;
    const u = JSON.parse(raw);
    const username = (u?.username ?? '').trim();
    if (username) out['X-Operator'] = username;
    if (u?.id != null) out['X-Operator-Id'] = String(u.id);
    if (u?.role) out['X-Operator-Role'] = String(u.role);
  } catch (e) {}
  return out;
}

/**
 * AUTH FIX: derive a lightweight Bearer session credential from the stored active user
 * so mutations (especially the First-time Security Check password modal) carry an
 * Authorization header. The app does not issue JWTs — this tokens the operator username
 * + id so `php_sync.php`/`api.php` can identify and validate the live session.
 * Returns '' when no session is present (public/marketplace flows stay unauthenticated).
 */
export function buildSessionToken(): string {
  try {
    if (typeof localStorage === 'undefined') return '';
    const raw = localStorage.getItem('tradecore_user');
    if (!raw) return '';
    const u = JSON.parse(raw);
    const username = (u?.username ?? '').trim();
    const id = u?.id != null ? String(u.id) : '';
    if (!username) return '';
    return btoa(unescape(encodeURIComponent(`${username}::${id}`)));
  } catch {
    return '';
  }
}

/**
 * Probe candidate API paths and auto-discover a working one.
 * Stores the first successful path in localStorage so subsequent calls skip probing.
 */
const API_CANDIDATES = ['/api/php_sync.php', '/cpanel/api.php', '/api/api.php', '/api.php'];
let _discoveredApiUrl: string | null = null;
let _discoveryPromise: Promise<string | null> | null = null;

export async function discoverApiUrl(): Promise<string | null> {
  // 1) Already discovered this session — return immediately (no probing).
  if (_discoveredApiUrl) return _discoveredApiUrl;

  // 2) A previous session saved a working URL — trust the cache, skip the probe
  //    loop entirely so we NEVER burn 9×timeout on every load.
  const savedApiUrl = (() => { try { return localStorage.getItem('tradecore_php_api_url') || ''; } catch { return ''; } })();
  if (savedApiUrl) {
    _discoveredApiUrl = savedApiUrl;
    return savedApiUrl;
  }

  // 3) Nothing cached yet — probe candidates ONCE (deduped) with a fresh
  //    AbortController and a generous 30s timeout. First success wins and is cached.
  if (_discoveryPromise) return _discoveryPromise;

  _discoveryPromise = (async (): Promise<string | null> => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const absoluteCandidates = origin ? API_CANDIDATES.map(p => origin + p) : [];
    const candidates = [...API_CANDIDATES, ...absoluteCandidates];

    for (const url of candidates) {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 30000);
      try {
        const resp = await fetch(`${url}?action=check_timestamp`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          cache: 'no-store',
          signal: controller.signal
        });
        if (resp.ok) {
          const text = await resp.text();
          let parsed: any = null;
          try { parsed = JSON.parse(text); } catch (parseErr) { parsed = null; }
          if (parsed && (parsed.success || parsed.version !== undefined)) {
            _discoveredApiUrl = url;
            try { localStorage.setItem('tradecore_php_api_url', url); } catch {}
            console.log('[PHP API] Discovered working API URL:', url);
            return url;
          } else {
            // 200 but non-API JSON — SPA fallback served index.html for an unknown route
            console.warn(`[PHP API] ${url} returned non-JSON (HTML/SPA fallback). Status:`, resp.status);
          }
        } else {
          console.warn(`[PHP API] ${url} returned HTTP ${resp.status}`);
        }
      } catch (err: any) {
        const reason = err?.name === 'AbortError' ? 'timeout' : (err?.message || 'network error');
        console.warn(`[PHP API] ${url} failed: ${reason}`);
      } finally {
        clearTimeout(tid);
      }
    }
    console.error('[PHP API] No working API URL found among', candidates.length, 'candidates:', candidates);
    return null;
  })();

  try {
    return await _discoveryPromise;
  } finally {
    _discoveryPromise = null;
  }
}

/**
 * Fetch unified system state from PHP backend
 * @param timeoutMs optional request timeout (default 10s) so a slow/hanging server
 *                  never blocks the UI — the caller falls back to local state on abort.
 */
export async function fetchSystemDataFromPhp(timeoutMs: number = 10000): Promise<any | null> {
  let { apiUrl, apiKey } = getPhpConfig();
  // If the configured URL has never been validated, auto-discover
  if (!apiUrl || apiUrl === DEFAULT_API_URL) {
    if (!_discoveredApiUrl) {
      const found = await discoverApiUrl();
      if (found) apiUrl = found;
    } else {
      apiUrl = _discoveredApiUrl;
    }
  }
  if (!apiUrl) return null;

  try {
    const headers: Record<string, string> = {
      'Accept': 'application/json'
    };
    if (apiKey) {
      headers['X-API-Key'] = apiKey;
    }

    const response = await fetchWithTimeout(`${apiUrl}?action=get_state`, {
      method: 'GET',
      headers,
      cache: 'no-store'
    }, timeoutMs);

    if (!response.ok) {
      console.warn(`[PHP API] Server returned status ${response.status} for ${apiUrl}`);
      // If the saved URL failed, clear it and try discovery on next call
      _discoveredApiUrl = null;
      return null;
    }

    const text = await response.text();
    try {
      const result = JSON.parse(text);
      // Capture server version for cross-device poll (monotonic, no timestamp collisions)
      if (result && typeof result.version !== 'undefined') {
        const v = Number(result.version);
        if (!Number.isNaN(v) && v > 0) _lastServerVersion = v;
      }
      // FIX (2026-09-07) — "refresh resets everything / data lost across devices":
      // get_state / check_timestamp return the real blob NESTED under `state`
      // ({changed, version, state: {...}}) WITHOUT a `success` flag, and the atomic
      // path returns top-level collections ({products, users, sales, categories}) also
      // WITHOUT `success`. The old fallback returned the WHOLE wrapper as the blob, so
      // applyData saw no top-level collections and swapped every collection back to
      // factory defaults; a later flush then wrote those defaults to the server and
      // every device synced them. MUST unwrap `state` (or accept a collection-bearing
      // object), and NEVER accept a wrapper that carries zero state collections.
      const unwrapped: any =
        (result && result.state && typeof result.state === 'object' && !Array.isArray(result.state)) ? result.state
        : (result && result.data && typeof result.data === 'object' && !Array.isArray(result.data) && (typeof result.success === 'undefined' || result.success)) ? result.data
        : result;
      const hasCollections = (obj: any): boolean => {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
        const COLLECTION_KEYS = ['users', 'products', 'marketplaceProducts', 'stockItems', 'companies', 'branches', 'stores', 'categories', 'taxes', 'suppliers', 'customers', 'salesOrders', 'purchaseOrders', 'expenses', 'settings', 'rolePermissions'];
        return COLLECTION_KEYS.some(k => Object.prototype.hasOwnProperty.call(obj, k));
      };
      if (unwrapped !== result || hasCollections(unwrapped)) {
        const innerV = Number(unwrapped?._version ?? unwrapped?._serverVersion ?? unwrapped?.version ?? 0);
        if (!Number.isNaN(innerV) && innerV > _lastServerVersion) _lastServerVersion = innerV;
        return unwrapped;
      }
      // Only a wrapper with NO usable data (e.g. a bare {changed:true, server_ts:...})
      // — treat as no-data so the caller keeps its localStorage cache instead of
      // resetting to factory defaults.
      return null;
    } catch (parseErr) {
      console.warn('[PHP API] Response is not valid JSON:', text.substring(0, 150));
      return null;
    }
  } catch (error) {
    // Per-request AbortController (fetchWithTimeout): an abort here is ONLY this read's
    // own timeout — never a shared signal killed by a company switch. Parallel saves are
    // never aborted either (writes pass ignoreOuterSignal, so they run to completion on
    // their own controller). Treating AbortError as silent keeps the switch-storm
    // "signal is aborted without reason" noise out of the console.
    if (error && typeof error === 'object' && (error as any)?.name === 'AbortError') return null;
    console.warn('[PHP API] Unable to connect to PHP backend:', error);
    return null;
  }
}

export async function fetchCheckTimestamp(timeoutMs: number = 8000): Promise<{ version: number; lastUpdated: string | null; updatedAt: string | null } | null> {
  let { apiUrl, apiKey } = getPhpConfig();
  if (!apiUrl || apiUrl === DEFAULT_API_URL) {
    if (_discoveredApiUrl) apiUrl = _discoveredApiUrl;
    else { const f = await discoverApiUrl(); if (f) apiUrl = f; }
  }
  if (!apiUrl) return null;
  try {
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (apiKey) headers['X-API-Key'] = apiKey;
    const response = await fetchWithTimeout(`${apiUrl}?action=check_timestamp`, { method: 'GET', headers, cache: 'no-store' }, timeoutMs);
    if (!response.ok) return null;
    const result = JSON.parse(await response.text());
    if (!result || !result.success) return null;
    const version = Number(result.version ?? result.server_ts ?? 0) || 0;
    if (version > 0) _lastServerVersion = Math.max(_lastServerVersion, version);
    return { version, lastUpdated: result.lastUpdated ?? result.updatedAt ?? null, updatedAt: result.updatedAt ?? result.lastUpdated ?? null };
  } catch { return null; }
}

/**
 * Save unified system state to PHP backend
 * @param timeoutMsOrOpts optional request timeout (default 30s) or options object.
 */
export async function saveSystemDataToPhp(
  data: any,
  timeoutMsOrOpts: number | { changedKeys?: string[]; baseVersion?: number; timeoutMs?: number } = 30000
): Promise<boolean> {
  let { apiUrl, apiKey } = getPhpConfig();
  if (!apiUrl || apiUrl === DEFAULT_API_URL) {
    if (_discoveredApiUrl) apiUrl = _discoveredApiUrl;
    else { const f = await discoverApiUrl(); if (f) apiUrl = f; }
  }
  if (!apiUrl) return false;

  let timeoutMs = 30000;
  let changedKeys: string[] | undefined;
  let baseVersion: number | undefined;
  if (typeof timeoutMsOrOpts === 'number') timeoutMs = timeoutMsOrOpts;
  else if (timeoutMsOrOpts && typeof timeoutMsOrOpts === 'object') {
    if (Array.isArray((timeoutMsOrOpts as any).changedKeys)) changedKeys = (timeoutMsOrOpts as any).changedKeys;
    if (typeof (timeoutMsOrOpts as any).baseVersion === 'number') baseVersion = (timeoutMsOrOpts as any).baseVersion;
    if (typeof (timeoutMsOrOpts as any).timeoutMs === 'number') timeoutMs = (timeoutMsOrOpts as any).timeoutMs;
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    if (apiKey) {
      headers['X-API-Key'] = apiKey;
    }
    Object.assign(headers, getOperatorHeaders());

    const payload: any = {
      action: 'save_state',
      // DELTA-ONLY: only the collections the caller actually changed, never a full-state dump.
      delta: data,
      lastUpdated: new Date().toISOString()
    };
    if (changedKeys && changedKeys.length) payload.changedKeys = changedKeys;
    // Send lastSeenVersion for server-side conflict detection (409 if stale)
    if (typeof baseVersion === 'number') payload.lastSeenVersion = baseVersion;
    if (typeof baseVersion === 'number' && baseVersion > 0) data._clientBaseVersion = baseVersion;

    const bodyStr = JSON.stringify(payload);
    const bodyBytes = new Blob([bodyStr]).size;
    console.log(`[PHP API] Saving state — payload ${bodyBytes < 1048576 ? (bodyBytes / 1024).toFixed(1) + 'KB' : (bodyBytes / 1024 / 1024).toFixed(1) + 'MB'}, timeout ${timeoutMs}ms`);

    const response = await fetchWithTimeout(apiUrl, {
      method: 'POST',
      headers,
      body: bodyStr
    }, timeoutMs, { ignoreOuterSignal: true });

    if (!response.ok) {
      // 409 Conflict: server version is ahead — caller should re-fetch and rebase
      if (response.status === 409) {
        try {
          const conflictResult = JSON.parse(await response.text());
          console.warn('[PHP API] 409 Conflict — server version', conflictResult.serverVersion, 'ahead of client');
          // Apply the fresh server data from the conflict response
          if (typeof conflictResult?.serverData === 'object' && conflictResult.serverData !== null) {
            // Store conflict data for the caller to pick up
            (_conflictData as any)._pending = conflictResult.serverData;
            (_conflictData as any)._serverVersion = conflictResult.serverVersion;
          }
          if (conflictResult.serverVersion) _lastServerVersion = Number(conflictResult.serverVersion);
        } catch {}
        return false;
      }
      const errText = await response.text().catch(() => '(unreadable)');
      console.error(`[PHP API] Save failed with HTTP ${response.status}: ${errText.substring(0, 200)}`);
      return false;
    }

    const text = await response.text();
    try {
      const result = JSON.parse(text);
      // CLIENT-VERSION LOCK SOURCE (2026-09-07-03): accept the server's monotonic
      // version from ANY success channel (version / serverVersion / server_ts /
      // _version) and adopt it MONOTONICALLY (Math.max) so the Flush OK success
      // handler in flushToPhp can lock clientVersion reliably before any queued pass
      // re-reads it — eliminating the stale-version double-flush 409.
      if (result) {
        const v = Number(result.version ?? result.serverVersion ?? result.server_ts ?? result._version ?? 0);
        if (!Number.isNaN(v) && v > 0) _lastServerVersion = Math.max(_lastServerVersion, v);
      }
      if (result && (result.success || result.status === 'ok')) {
        console.log('[PHP API] Flush OK — server version:', result.version ?? result.server_ts ?? 'unknown');
      } else {
        console.warn('[PHP API] Save returned success=false:', JSON.stringify(result).substring(0, 200));
      }
      return !!(result && (result.success || result.status === 'ok'));
    } catch (parseErr) {
      console.warn('[PHP API] Save response is not valid JSON:', text.substring(0, 300));
      return false;
    }
  } catch (error) {
    console.error('[PHP API] Error saving data to PHP backend:', error);
    return false;
  }
}

/**
 * Micro-update a single CRUD record (PATCH-style), avoiding mass blob overwrites.
 * Sends { action:'mutate_record', collection, op:'upsert'|'delete', recordId, record, baseVersion }.
 * Only that one record is committed on the server (per-record optimistic lock) and the
 * response carries HTTP 200 + the updated recordId, so the caller only updates its
 * persistent cache after an explicit success ack. Returns a structured result.
 */
export interface MutateResult {
  ok: boolean;
  conflict?: boolean;
  stale?: boolean;
  newVersion?: number;
  recordId?: string;
  serverRecord?: any;
}
export async function mutateCollectionRecordToPhp(
  collection: string,
  op: 'upsert' | 'delete',
  recordId: string | number,
  record: any | null,
  baseVersion?: number,
  timeoutMs: number = 20000
): Promise<MutateResult> {
  let { apiUrl, apiKey } = getPhpConfig();
  if (!apiUrl || apiUrl === DEFAULT_API_URL) {
    if (_discoveredApiUrl) apiUrl = _discoveredApiUrl;
    else { const f = await discoverApiUrl(); if (f) apiUrl = f; }
  }
  if (!apiUrl) return { ok: false };
  const res: MutateResult = { ok: false };
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    if (apiKey) headers['X-API-Key'] = apiKey;
    Object.assign(headers, getOperatorHeaders());
    const payload: any = {
      action: 'mutate_record',
      collection,
      op,
      recordId,
      record: record ?? null,
      lastUpdated: new Date().toISOString()
    };
    if (typeof baseVersion === 'number' && baseVersion > 0) payload.baseVersion = baseVersion;

    const response = await fetchWithTimeout(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    }, timeoutMs, { ignoreOuterSignal: true });

    let result: any = null;
    try { result = JSON.parse(await response.text()); } catch { result = null; }

    if (result && (typeof result.version !== 'undefined')) {
      const v = Number(result.version ?? result._version ?? result.server_ts ?? 0);
      if (!Number.isNaN(v) && v > 0) _lastServerVersion = Math.max(_lastServerVersion, v);
    }

    if (response.status === 409) {
      res.conflict = true;
      res.newVersion = Number(result?.serverVersion ?? 0) || 0;
      res.recordId = result?.recordId;
      res.serverRecord = result?.serverRecord ?? null;
      res.stale = result?.error === 'stale_record';
      // Stash full server state so flushToPhp / rebase can pick it up, mirroring save_state.
      if (result && typeof result.serverData === 'object' && result.serverData !== null) {
        (_conflictData as any)._pending = result.serverData;
        (_conflictData as any)._serverVersion = Number(result.serverVersion ?? 0);
      }
      if (res.newVersion > 0) _lastServerVersion = Math.max(_lastServerVersion, res.newVersion);
      return res;
    }

    if (response.ok && result) {
      res.ok = !!(result.success || result.status === 'ok');
      res.recordId = result.recordId ?? String(recordId);
      res.newVersion = Number(result.version ?? result._version ?? result.server_ts ?? 0) || 0;
    }
    return res;
  } catch (error) {
    console.warn('[PHP API] mutate_record network error:', error);
    return res;
  }
}

/**
 * Fetch live audit-log rows from the backend `get_audit_logs` action (Issue 3).
 * Returns a normalized list compatible with the React AuditTrail type, or [] on failure.
 */
export interface AuditLogRow {
  id: string;
  username: string;
  role: string;
  action: string;
  details: string;
  timestamp: string;
  ipAddress?: string;
}
export async function getAuditLogsFromPhp(opts: { limit?: number; action?: string; operator?: string; timeoutMs?: number } = {}): Promise<AuditLogRow[]> {
  let { apiUrl, apiKey } = getPhpConfig();
  if (!apiUrl || apiUrl === DEFAULT_API_URL) {
    if (_discoveredApiUrl) apiUrl = _discoveredApiUrl;
    else { const f = await discoverApiUrl(); if (f) apiUrl = f; }
  }
  if (!apiUrl) return [];
  try {
    const q: string[] = [`action=get_audit_logs`];
    if (opts.limit) q.push(`limit=${opts.limit}`);
    if (opts.action) q.push(`action_filter=${encodeURIComponent(opts.action)}`);
    if (opts.operator) q.push(`operator=${encodeURIComponent(opts.operator)}`);
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (apiKey) headers['X-API-Key'] = apiKey;
    Object.assign(headers, getOperatorHeaders());
    const response = await fetchWithTimeout(`${apiUrl}?${q.join('&')}`, { method: 'GET', headers }, opts.timeoutMs ?? 15000);
    if (!response.ok) return [];
    const result = await response.json();
    if (result && result.success && Array.isArray(result.logs)) {
      return result.logs as AuditLogRow[];
    }
    return [];
  } catch (error) {
    // Issue 2: rapid company switches abort in-flight audit-log fetches before they
    // resolve (the AbortController inside fetchWithTimeout, or an outer signal from the
    // caller). "AbortError / The user aborted a request" is NOT a real failure — it is a
    // cancelled poll, so swallow it silently: no error notifications, no dirty console.
    let isAbortError = false;
    try {
      const errName = (error && typeof error === 'object' && (error as any).name) || '';
      isAbortError = errName === 'AbortError' ||
        (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError') ||
        (error && typeof error === 'object' && !!(error as any)?.signal?.aborted);
    } catch { isAbortError = false; }
    if (isAbortError) return [];
    console.warn('[PHP API] getAuditLogsFromPhp error:', error);
    return [];
  }
}

/**
 * Fetch the authoritative per-company snapshot directly from MySQL (SINGLE SOURCE OF
 * TRUTH). The backend `snapshot` action runs relational queries with
 * `WHERE company_id = ?` for per-row tables (users/products/sales/orders), reads
 * categories from tradecore_categories, and overlays the shared blob for the
 * remaining collections. The resulting state is applied UNCONDITIONALLY — it is the
 * database's view, never undermined by stale localStorage. Returns the canonical
 * company state object (or null on failure so callers can fall back).
 */
export async function fetchCompanySnapshot(companyId: string | number): Promise<any | null> {
  let { apiUrl, apiKey } = getPhpConfig();
  if (!apiUrl || apiUrl === DEFAULT_API_URL) {
    if (_discoveredApiUrl) apiUrl = _discoveredApiUrl;
    else { const f = await discoverApiUrl(); if (f) apiUrl = f; }
  }
  if (!apiUrl) return null;
  try {
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (apiKey) headers['X-API-Key'] = apiKey;
    Object.assign(headers, getOperatorHeaders());
    const response = await fetchWithTimeout(
      `${apiUrl}?action=snapshot&company_id=${encodeURIComponent(String(companyId))}&t=${Date.now()}`,
      { method: 'GET', headers, cache: 'no-store' },
      20000,
      { ignoreOuterSignal: true }
    );
    if (!response.ok) return null;
    const result = await response.json().catch(() => null);
    if (!result || !result.success) return null;
    const data = result.state ?? result.data ?? result;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const v = Number(data._version ?? data.version ?? result.version ?? result.server_ts ?? 0);
    if (!Number.isNaN(v) && v > 0) _lastServerVersion = Math.max(_lastServerVersion, v);
    return data;
  } catch (error) {
    // Snapshot is a read; an abort/timeout here just means "fall back to blob fetch".
    console.warn('[PHP API] fetchCompanySnapshot error (falling back to blob fetch):', error);
    return null;
  }
}

/**
 * Permanently purge a company server-side. The frontend cascade only filtered the local
 * state and the main_state blob — the NORMALIZED mirror tables (companies/stores/
 * products/stock_categories/user_accounts) and the legacy per-company atomic tables
 * (tradecore_{users,products,sales,marketplace_orders}) kept their rows with
 * deleted_at NULL, so the next authoritative snapshot rebuilt the "deleted" company on
 * every login. The backend `purge_company` action hard-removes all of those rows,
 * strips the blob, bumps the version and writes an audit row. Best-effort: an explicit
 * Super Admin action; a failure here only means the next save_state no-op cannot hide it.
 */
export async function purgeCompanyFromPhp(companyId: string | number, timeoutMs: number = 30000): Promise<boolean> {
  let { apiUrl, apiKey } = getPhpConfig();
  if (!apiUrl || apiUrl === DEFAULT_API_URL) {
    if (_discoveredApiUrl) apiUrl = _discoveredApiUrl;
    else { const f = await discoverApiUrl(); if (f) apiUrl = f; }
  }
  if (!apiUrl) return false;
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    if (apiKey) headers['X-API-Key'] = apiKey;
    Object.assign(headers, getOperatorHeaders());
    const response = await fetchWithTimeout(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action: 'v2_purge_company', company_id: String(companyId) })
    }, timeoutMs, { ignoreOuterSignal: true });
    let result: any = null;
    try { result = JSON.parse(await response.text()); } catch { result = null; }
    if (result && (typeof result.version !== 'undefined')) {
      const v = Number(result.version ?? result._version ?? result.server_ts ?? 0);
      if (!Number.isNaN(v) && v > 0) _lastServerVersion = Math.max(_lastServerVersion, v);
    }
    if (!response.ok || !result) return false;
    return !!(result.success || result.status === 'ok');
  } catch (error) {
    console.warn('[PHP API] purge_company network error:', error);
    return false;
  }
}

/**
 * Soft-delete a company server-side via the classic `delete_company` action
 * (marks deleted_at in the atomic companies table + strips it from the blob).
 * This is the "DEFAULT returns / NEW vanishes" fix: the company deletion must be
 * persisted to MySQL OR the next per-company snapshot / login rebuilds it.
 */
export async function softDeleteCompanyFromPhp(companyId: string | number, timeoutMs: number = 30000): Promise<boolean> {
  let { apiUrl, apiKey } = getPhpConfig();
  if (!apiUrl || apiUrl === DEFAULT_API_URL) {
    if (_discoveredApiUrl) apiUrl = _discoveredApiUrl;
    else { const f = await discoverApiUrl(); if (f) apiUrl = f; }
  }
  if (!apiUrl) return false;
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    if (apiKey) headers['X-API-Key'] = apiKey;
    Object.assign(headers, getOperatorHeaders());
    const response = await fetchWithTimeout(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action: 'delete_company', id: String(companyId) })
    }, timeoutMs, { ignoreOuterSignal: true });
    let result: any = null;
    try { result = JSON.parse(await response.text()); } catch { result = null; }
    if (result && (typeof result.version !== 'undefined')) {
      const v = Number(result.version ?? result._version ?? result.server_ts ?? 0);
      if (!Number.isNaN(v) && v > 0) _lastServerVersion = Math.max(_lastServerVersion, v);
    }
    if (!response.ok || !result) return false;
    return !!(result.success || result.status === 'ok');
  } catch (error) {
    console.warn('[PHP API] delete_company network error:', error);
    return false;
  }
}

/**
 * Connect to WebSocket or Server-Sent Events (SSE) server on PHP host for multi-device real-time sync
 */
let activeWebSocket: WebSocket | null = null;
let activeEventSource: EventSource | null = null;

export function connectPhpRealtimeSync(onUpdateCallback: (data: any) => void): () => void {
  let { apiUrl, wsUrl } = getPhpConfig();
  if (apiUrl === DEFAULT_API_URL && _discoveredApiUrl) apiUrl = _discoveredApiUrl;
  let disposed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const cleanup = () => {
    disposed = true;
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    if (activeWebSocket) { activeWebSocket.close(); activeWebSocket = null; }
    if (activeEventSource) { activeEventSource.close(); activeEventSource = null; }
  };

  // 1. Attempt WebSocket if wsUrl is provided
  if (wsUrl && typeof WebSocket !== 'undefined') {
    try {
      if (activeWebSocket) activeWebSocket.close();
      const ws = new WebSocket(wsUrl);
      activeWebSocket = ws;

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message) {
            const v = Number(message.version ?? message.data?._version ?? message.data?.version ?? 0);
            if (!Number.isNaN(v) && v > 0) _lastServerVersion = Math.max(_lastServerVersion, v);
          }
          if (message && message.type === 'STATE_UPDATE' && message.data) {
            onUpdateCallback(message.data);
          }
        } catch (e) {
          console.error('[PHP Realtime] Error parsing WebSocket message:', e);
        }
      };

      ws.onerror = (err) => {
        console.warn('[PHP Realtime] WebSocket connection warning:', err);
      };

      ws.onclose = () => {
        // Auto-reconnect WebSocket after 5s
        if (!disposed) {
          reconnectTimer = setTimeout(() => {
            if (!disposed) connectPhpRealtimeSync(onUpdateCallback);
          }, 5000);
        }
      };

      return cleanup;
    } catch (err) {
      console.warn('[PHP Realtime] Failed to initialize WebSocket:', err);
    }
  }

  // 2. Fallback to PHP Server-Sent Events (SSE) with auto-reconnect
  if (apiUrl && typeof EventSource !== 'undefined') {
    const connectSSE = () => {
      if (disposed) return;
      try {
        if (activeEventSource) activeEventSource.close();
        const sseUrl = `${apiUrl}?action=stream_updates`;
        const sse = new EventSource(sseUrl);
        activeEventSource = sse;

        sse.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message) {
              const v = Number(message.version ?? message.data?._version ?? message.data?.version ?? 0);
              if (!Number.isNaN(v) && v > 0) _lastServerVersion = Math.max(_lastServerVersion, v);
            }
            if (message && message.data) {
              onUpdateCallback(message.data);
            }
          } catch (e) {
            console.error('[PHP Realtime SSE] Error parsing SSE event:', e);
          }
        };

        sse.onerror = () => {
          sse.close();
          activeEventSource = null;
          // CRITICAL: Auto-reconnect SSE after 3s (PHP SSE streams for ~6s then stops)
          if (!disposed) {
            reconnectTimer = setTimeout(connectSSE, 3000);
          }
        };
      } catch (e) {
        console.warn('[PHP Realtime SSE] SSE unavailable:', e);
        if (!disposed) {
          reconnectTimer = setTimeout(connectSSE, 5000);
        }
      }
    };

    connectSSE();
    return cleanup;
  }

  return cleanup;
}

/**
 * Generic POST call to the cPanel PHP API (used for MEGA Phase 2B collection actions).
 */
async function apiPost(action: string, payload: Record<string, unknown>): Promise<any> {
  let { apiUrl, apiKey } = getPhpConfig();
  if (!apiUrl || apiUrl === DEFAULT_API_URL) {
    if (_discoveredApiUrl) apiUrl = _discoveredApiUrl;
    else { const f = await discoverApiUrl(); if (f) apiUrl = f; }
  }
  if (!apiUrl) return null;
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    if (apiKey) {
      headers['X-API-Key'] = apiKey;
    }
    // AUTH FIX: carry the active operator/session credential on EVERY atomic POST
    // (incl. the First-time Security Check password modal). Without these the backend
    // treats the request as unauthenticated and may SESSION_REVOKE a valid user.
    Object.assign(headers, getOperatorHeaders());
    const authToken = buildSessionToken();
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const response = await fetchWithTimeout(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, ...payload })
    }, 12000, { ignoreOuterSignal: true });
    if (!response.ok) return null;
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  } catch (error) {
    console.warn('[PHP API] POST failed:', error);
    return null;
  }
}

// Atomic table helpers — tiny payloads, no 5 MB blob race.
// These are fire-and-forget on the CALLER side (the caller does not await the result
// in most places), but the functions themselves now log failures and track the server
// version so the cross-device poll can detect the change.
export async function apiDeleteProduct(id: string | number, companyId: string | number): Promise<boolean> {
  try {
    const res = await apiPost('delete_product', { id: String(id), company_id: String(companyId) });
    if (res && res.success) {
      if (res.version) setLastServerVersion(Math.max(getLastServerVersion(), Number(res.version)));
      return true;
    }
    console.warn('[PHP API] delete_product failed:', res?.error || 'unknown');
    return false;
  } catch (e) {
    console.error('[PHP API] delete_product error:', e);
    return false;
  }
}
export async function apiUpsertProduct(product: any): Promise<boolean> {
  try {
    const res = await apiPost('upsert_product', { product_json: JSON.stringify(product) });
    if (res && res.success) {
      if (res.version) setLastServerVersion(Math.max(getLastServerVersion(), Number(res.version)));
      return true;
    }
    console.warn('[PHP API] upsert_product failed:', res?.error || 'unknown');
    return false;
  } catch (e) {
    console.error('[PHP API] upsert_product error:', e);
    return false;
  }
}
export async function apiUpsertUser(userData: any): Promise<boolean> {
  try {
    const res = await apiPost('upsert_user', { user_json: JSON.stringify(userData) });
    if (res && res.success) {
      if (res.version) setLastServerVersion(Math.max(getLastServerVersion(), Number(res.version)));
      return true;
    }
    console.warn('[PHP API] upsert_user failed:', res?.error || 'unknown');
    return false;
  } catch (e) {
    console.error('[PHP API] upsert_user error:', e);
    return false;
  }
}
/**
 * Atomic password change — tiny targeted request (never a 5MB blob) so the server
 * is guaranteed to receive the new sha256$ hash. Returns true on success.
 * @param hash MUST already be a client-side sha256$ hash (use hashPassword()).
 */
export async function apiChangePassword(userId: string | number, passwordHash: string, companyId?: string | number): Promise<boolean> {
  const res = await apiPost('change_password', {
    user_id: String(userId),
    password: passwordHash,  // SECURITY: Send raw password, server hashes with bcrypt
    company_id: companyId != null ? String(companyId) : ''
  });
  return !!(res && res.success);
}
export async function apiUpsertSale(sale: any): Promise<boolean> {
  const res = await apiPost('upsert_sale', { sale_json: JSON.stringify(sale) });
  return !!(res && res.success);
}
export async function apiUpsertOrder(order: any): Promise<boolean> {
  const res = await apiPost('upsert_order', { order_json: JSON.stringify(order) });
  return !!(res && res.success);
}
export async function apiDeleteUser(id: string | number, companyId: string | number): Promise<boolean> {
  const res = await apiPost('delete_user', { id: String(id), company_id: String(companyId) });
  return !!(res && res.success);
}
export async function apiAssignUser(userData: any): Promise<boolean> {
  // Send as user_json + flat fields for PHP compatibility
  const payload: Record<string, unknown> = { user_json: JSON.stringify(userData) };
  for (const [k, v] of Object.entries(userData)) payload[k] = v as any;
  const res = await apiPost('assign_user', payload);
  return !!(res && res.success);
}
export async function apiLoginAtomic(phone: string, password: string, company_code?: string): Promise<any> {
  return apiPost('login', { phone, username: phone, password, company_code: company_code ?? '' });
}

export interface CollectionInitiateInput {
  phone: string; // 2557XXXXXX
  amount: number;
  network: string;
  reference?: string; // when absent, PHP generates one (AUTO mode)
  orderId?: number | null;
  companyId?: number | null;
  customerName?: string;
  customerPhone?: string;
}

/**
 * Ask the PHP backend to create a collection. In AUTO mode (API keys set) this
 * sends the AzamPay USSD push; otherwise it falls back to manual instructions.
 */
export async function apiCollectionInitiate(input: CollectionInitiateInput): Promise<any> {
  return apiPost('collection_initiate', { ...input } as Record<string, unknown>);
}

/**
 * Poll the PHP backend for a collection's current status (used by AUTO mode).
 */
export async function apiCollectionStatus(reference: string): Promise<any> {
  return apiPost('collection_status', { reference });
}
