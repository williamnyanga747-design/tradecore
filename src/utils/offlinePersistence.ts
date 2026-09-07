/**
 * offlinePersistence.ts — IndexedDB Offline Persistence Engine (PBS Offline layer).
 *
 * Replaces the volatile localStorage caches with a durable, transactional IndexedDB
 * layer for TWO things:
 *
 *   1. SYSTEM STATE CACHE  — `kv` store. The full state blob no longer has to live in
 *      a 5MB localStorage string; it is stored in IDB and mirrored to localStorage
 *      only as a legacy-compat fallback. Boot reads prefer IDB first.
 *
 *   2. PENDING MUTATION QUEUE — `sync_queue` store. Every CRUD operation (categories,
 *      products, users, sales, orders, …) the user makes while DISCONNECTED is
 *      captured here with its full record + a stable id + timestamp. On `online`
 *      the queue is drained SEQUENTIALLY via atomic POSTs to `/api/php_sync.php`.
 *
 * CRITICAL SYNC INVARIANTS (race-condition prevention):
 *   - Items are processed ONE at a time (never concurrently → no AbortError cascade).
 *   - The server commits the mutation in MySQL FIRST (2xx + `success:true` ack);
 *     ONLY THEN is the item removed from the client queue. If the ack never arrives
 *     the item stays queued for the next drain — at-least-once, never lost.
 *   - Each request uses its OWN AbortController (never a shared/outer signal), so a
 *     timeout aborts one request without cancelling unrelated in-flight calls.
 *   - A 409 Conflict (stale version) stops the drain so the app can rebase instead of
 *     blindly overwriting newer server rows.
 *
 * The public mutation API is synchronous (mirrors the previous localStorage shape) so
 * App.tsx call-sites need no async rework: writes update an in-memory copy immediately
 * and persist to IDB on the next idle tick; reads return the memory snapshot.
 */
import { getPhpConfig, getOperatorHeaders, buildSessionToken, discoverApiUrl } from './api';
import { openDB } from './idb';

export interface QueueOp {
  op: 'upsert' | 'delete';
  table: string; // e.g. 'marketplaceProducts', 'users', 'categories', 'salesOrders'
  id: string | number;
  data?: any; // full record for upsert (or a "co_X:name" category string), null for delete
  companyId?: string | number; // used by v2 endpoints when data lacks company_id
  timestamp: number;
}

interface QueueRow extends QueueOp {
  status: 'pending' | 'syncing';
}

export interface DrainSummary {
  attempted: number;
  synced: number;
  failed: number;
  conflict: boolean;
  offline: boolean;
}

const DB_NAME = 'tradecore-offline';
const DB_VERSION = 1;
const KV_STATE_KEY = 'system_state';
const KV_LAST_DRAIN_KEY = 'last_drain_ts';
const LOCALSTORAGE_MIRROR = 'tradecore_offline_queue';

const QUEUE_EVENT = 'tradecore:queue-busy';

/** Fired on ANY queue mutation + drain start/end so UI counters update instantly. */
export const QUEUE_UPDATED_EVENT = 'tradecore:queue-updated';

/** Sticky last-drain error (network / timeout / 409). Cleared on a full successful drain. */
let lastError: string | null = null;

export type SyncUiStatus = 'syncing' | 'error' | 'offline' | 'synced';

export interface SyncStatusSnapshot {
  status: SyncUiStatus;
  online: boolean;
  busy: boolean;
  total: number;
  sales: number;
  error: string | null;
}

/**
 * Reactive snapshot of the persistence engine for the top-bar Sync Status Indicator:
 *   - 'syncing'  blue  → actively pushing pending payload queue to php_sync.php
 *   - 'error'    red   → network/server error during flush (queue still holds items)
 *   - 'offline'  amber → internet disconnected; X items (incl. offline sales) queued in IDB
 *   - 'synced'   green → every local change / sale / audit row is committed to MySQL
 */
export function getSyncStatusSnapshot(): SyncStatusSnapshot {
  const online = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
  const busy = draining;
  const total = queueMirror.length;
  let sales = 0;
  for (const r of queueMirror) if (r.table === 'salesOrders') sales++;
  let status: SyncUiStatus;
  if (busy) status = 'syncing';
  else if (!online) status = 'offline';
  else if (lastError !== null && total > 0) status = 'error';
  else status = 'synced';
  return { status, online, busy, total, sales, error: lastError };
}

function notifyQueue() {
  try {
    window.dispatchEvent(new CustomEvent(QUEUE_UPDATED_EVENT, { detail: getSyncStatusSnapshot() }));
  } catch (e) {}
}

function setLastError(msg: string) {
  lastError = msg;
}

type Engine = Awaited<ReturnType<typeof openDB>>;
let enginePromise: Promise<Engine> | null = null;

/**
 * Serialize IDB writes through a promise chain so rapid post-flush state-cache calls
 * can NEVER open overlapping transactions on the (possibly closing) shared handle.
 * The wrapper's auto-reopen handles a dead connection; this mutex prevents the
 * interleaving that made a closing connection fail mid-write in the first place.
 */
let idbWriteChain: Promise<void> = Promise.resolve();
function withIdbWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = idbWriteChain.then(fn, fn);
  idbWriteChain = run.then(
    () => {},
    () => {}
  );
  return run;
}

let queueMirror: QueueRow[] = [];
let mirrorLoaded = false;
let persistTimer: number | null = null;
let draining = false;
let bootDrainScheduled = false;

// -----------------------------------------------------------------------------
// DB bootstrap
// -----------------------------------------------------------------------------
function getEngine(): Promise<Engine> {
  if (!enginePromise) {
    enginePromise = openDB(DB_NAME, DB_VERSION, {
      upgrade: (db) => {
        if (!db.objectStoreNames.contains('kv')) {
          db.createObjectStore('kv', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('sync_queue')) {
          const store = db.createObjectStore('sync_queue', { keyPath: 'id' });
          store.createIndex('by_timestamp', 'timestamp');
          store.createIndex('by_status', 'status');
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      }
    });
    // Hydrate the in-memory queue mirror the moment the DB opens.
    enginePromise.then(async (db) => {
      try {
        const rows = (await db.getAll('sync_queue')) as QueueRow[];
        queueMirror = rows.slice().sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
      } catch (e) {
        console.warn('[OfflineEngine] queue hydrate failed:', e);
        queueMirror = [];
      }
      mirrorLoaded = true;
    }).catch(() => {});
  }
  return enginePromise;
}

/** idb may be unavailable (private mode) → everything degrades to in-memory only. */
let memoryOnly = false;

// -----------------------------------------------------------------------------
// Durable persist (async, coalesced)
// -----------------------------------------------------------------------------
function schedulePersist() {
  if (memoryOnly || !mirrorLoaded) return;
  if (persistTimer !== null) return;
  persistTimer = window.setTimeout(() => {
    persistTimer = null;
    void persistQueue();
  }, 0);
}

async function persistQueue() {
  if (memoryOnly) return;
  const db = await getEngine().catch(() => null);
  if (!db) { memoryOnly = true; return; }
  const snapshot = queueMirror.filter((r) => r.status !== 'syncing');
  try {
    await db.ensureReady();
    const tx = db.transaction('sync_queue', 'readwrite');
    await tx.store('sync_queue').clear();
    for (const row of snapshot) { await tx.store('sync_queue').put(row); }
    await tx.done;
  } catch (e) {
    console.warn('[OfflineEngine] queue persist failed:', e);
  }
}

// -----------------------------------------------------------------------------
// Public mutation API (synchronous call-compatible with the previous queue)
// -----------------------------------------------------------------------------
/** Replaces the whole queue (meta-write). Persists async. */
export function replaceQueue(ops: QueueOp[]): number {
  queueMirror = ops
    .slice()
    .map((o) => ({ ...o, status: 'pending' as const }))
    .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
  schedulePersist();
  notifyQueue();
  return queueMirror.length;
}

/** Appends CRUD operations to the durable queue. Returns the new queue length. */
export function queueMutations(ops: QueueOp[]): number {
  if (!ops || ops.length === 0) return queueMirror.length;
  for (const op of ops) {
    queueMirror.push({ ...op, status: 'pending' });
  }
  queueMirror.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
  schedulePersist();
  notifyQueue();
  return queueMirror.length;
}

/** Pending items currently known to this page (memory mirror). */
export function getQueueSnapshot(): QueueOp[] {
  return queueMirror.slice();
}

export function getQueueCount(): number {
  return queueMirror.length;
}

/** Removes ONE item AFTER the server acked it. Persists async. */
export function removeQueueItem(id: string | number): void {
  const before = queueMirror.length;
  queueMirror = queueMirror.filter((r) => String(r.id) !== String(id));
  if (queueMirror.length !== before) {
    schedulePersist();
    notifyQueue();
  }
}

export function clearQueue(): void {
  if (queueMirror.length === 0) return;
  queueMirror = [];
  schedulePersist();
  notifyQueue();
}

// -----------------------------------------------------------------------------
// SALES ADAPTER — POS checkout offline capture, unified with every other mutation.
// A pending sale is a QueueOp like any other (`table:'salesOrders'`, op 'upsert').
// drainSyncQueue() routes it to `php_sync.php` as `upsert_sale` in the SAME
// sequential, ack-before-clear pipeline as categories/products/users/audit rows.
// -----------------------------------------------------------------------------
/**
 * Queue a POS sale for guaranteed server sync. Returns the durable QueueOp; the sale
 * is committed to IndexedDB immediately (memory-first, persisted on next tick) and
 * drained to PHP on the next `online` event / boot / visibility tick.
 */
export function enqueueOfflineSale(sale: any, companyId?: string | number): QueueOp {
  const cid = companyId ?? sale?.company_id ?? sale?.companyId ?? '';
  const id = String(sale?.id ?? ('OFFLINE-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)));
  const op: QueueOp = {
    op: 'upsert',
    table: 'salesOrders',
    id,
    data: { ...(sale ?? {}), company_id: cid, _offline: true, _queuedAt: Date.now() },
    companyId: cid,
    timestamp: Date.now()
  };
  queueMutations([op]);
  return op;
}

/** All currently-queued (unacked) POS sales. */
export function getPendingSales(): QueueOp[] {
  return getQueueSnapshot().filter((r) => r.table === 'salesOrders');
}

/** Count of pending POS sales — feed to the Top Bar sync indicator when offline. */
export function getPendingSalesCount(): number {
  let n = 0;
  for (const r of queueMirror) if (r.table === 'salesOrders') n++;
  return n;
}

// -----------------------------------------------------------------------------
// System state cache (IDB-first, localStorage fallback mirror)
// -----------------------------------------------------------------------------
export async function cacheSystemState(state: unknown): Promise<void> {
  try {
    localStorage.setItem('tradecore_data', JSON.stringify(state));
  } catch (e) {
    console.warn('[OfflineEngine] localStorage state mirror failed:', e);
  }
  const db = await getEngine().catch(() => null);
  if (!db) return;
  try {
    await withIdbWriteLock(async () => {
      await db.ensureReady();
      await db.put('kv', { key: KV_STATE_KEY, value: state, savedAt: Date.now() });
    });
  } catch (e) {
    console.warn('[OfflineEngine] IDB state cache write failed:', e);
  }
}

/** Boot cache read: prefer the durable IDB copy, fall back to the localStorage mirror. */
export async function getCachedSystemState(): Promise<any | null> {
  const db = await getEngine().catch(() => null);
  if (db) {
    try {
      const row = await db.get('kv', KV_STATE_KEY);
      if (row && row.value !== undefined) return row.value;
    } catch (e) {
      console.warn('[OfflineEngine] IDB state cache read failed:', e);
    }
  }
  try {
    const raw = localStorage.getItem('tradecore_data');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

// -----------------------------------------------------------------------------
// Sync endpoint resolution → /api/php_sync.php (thin proxy to cpanel/api.php)
// -----------------------------------------------------------------------------
function resolveSyncEndpoint(explicit?: string): string {
  if (explicit && explicit.includes('php_sync')) return explicit;
  const { apiUrl } = getPhpConfig();
  if (apiUrl && apiUrl.includes('php_sync')) return apiUrl;
  if (apiUrl && /\/cpanel\/api\.php$/.test(apiUrl)) {
    return apiUrl.replace(/\/cpanel\/api\.php$/, '/api/php_sync.php');
  }
  if (apiUrl) {
    const base = apiUrl.replace(/\/api\.php$/, '');
    if (!base.endsWith('/')) return base + '/php_sync.php';
    return base + 'php_sync.php';
  }
  return '/api/php_sync.php';
}

/** Map a queued op to an atomic action + payload (v2 routes for normalized entities). */
function resolveAction(item: QueueOp): { action: string; payload: Record<string, unknown> } {
  const cid = (item.companyId ?? item.data?.company_id ?? item.data?.companyId ?? '') as string | number;
  const base = { company_id: String(cid) };

  // Categories: data is a "co_<companyId>:<name>" string or { name }.
  if (item.table === 'categories') {
    let name = '';
    let ccid = String(cid);
    if (typeof item.data === 'string') {
      const m = /^co_(\d+):(.+)$/s.exec(item.data.trim());
      if (m) { ccid = m[1]; name = m[2]; }
      else name = item.data.trim();
    } else if (item.data && typeof item.data === 'object') {
      name = String((item.data as any).name ?? (item.data as any).category_name ?? '');
      ccid = String((item.data as any).company_id ?? (item.data as any).companyId ?? ccid);
    }
    const payload = { company_id: ccid, name };
    return { action: item.op === 'upsert' ? 'v2_upsert_category' : 'v2_delete_category', payload };
  }

  // Products → v2 (atomic company-scoped upsert/delete + legacy mirror + blob merge).
  if (item.table === 'marketplaceProducts') {
    if (item.op === 'upsert') {
      return { action: 'v2_upsert_product', payload: { entity: item.data, ...base } };
    }
    return { action: 'v2_delete_product', payload: { id: String(item.id), ...base } };
  }

  // Users → v2.
  if (item.table === 'users') {
    if (item.op === 'upsert') {
      return { action: 'v2_upsert_user_account', payload: { entity: item.data, ...base } };
    }
    return { action: 'v2_delete_user_account', payload: { id: String(item.id), ...base } };
  }

  // Sales / orders: legacy atomic upserts exist; deletes route through mutate_record.
  if (item.table === 'salesOrders' && item.op === 'upsert') {
    return { action: 'upsert_sale', payload: { sale_json: JSON.stringify(item.data) } };
  }
  if (item.table === 'purchaseOrders' && item.op === 'upsert') {
    return { action: 'upsert_order', payload: { order_json: JSON.stringify(item.data) } };
  }

  // Generic fallback: micro-update (server commits ONE record, echoes ack).
  return {
    action: 'mutate_record',
    payload: { collection: item.table, op: item.op, recordId: String(item.id), record: item.op === 'delete' ? null : (item.data ?? null) }
  };
}

// -----------------------------------------------------------------------------
// DRAIN — sequential, ack-before-delete, online-gated.
// -----------------------------------------------------------------------------
async function postSync(action: string, payload: Record<string, unknown>, endpoint: string): Promise<{ ok: boolean; status: number; body: any }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    const { apiKey } = getPhpConfig();
    if (apiKey) headers['X-API-Key'] = apiKey;
    Object.assign(headers, getOperatorHeaders());
    const token = buildSessionToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, ...payload }),
      signal: controller.signal
    });
    let body: any = null;
    try { body = JSON.parse(await res.text()); } catch (e) { body = null; }
    return { ok: res.ok && !!(body && (body.success === true || body.status === 'ok')), status: res.status, body };
  } catch (error) {
    const isAbort = (error as any)?.name === 'AbortError' || (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError');
    return { ok: false, status: 0, body: { error: isAbort ? 'timeout' : 'network_error' } };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Drain the IndexedDB sync_queue ONE item at a time. Each item is committed on the
 * server (2xx + success ack) BEFORE its client-side row is removed. Any failure —
 * network, timeout, 409 — stops the drain and leaves every un-acked item queued.
 * Returns a per-run summary (never throws).
 */
export async function drainSyncQueue(opts?: { endpoint?: string; onItem?: (item: QueueOp, ok: boolean) => void }): Promise<DrainSummary> {
  const summary: DrainSummary = { attempted: 0, synced: 0, failed: 0, conflict: false, offline: false };
  if (draining) return summary;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) { summary.offline = true; return summary; }
  const items = queueMirror.filter((r) => r.status === 'pending').slice();
  if (items.length === 0) return summary;

  draining = true;
  window.dispatchEvent(new CustomEvent(QUEUE_EVENT, { detail: { busy: true, pending: items.length } }));
  notifyQueue();
  const endpoint = resolveSyncEndpoint(opts?.endpoint);
  try {
    for (const item of items) {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        summary.offline = true;
        break;
      }
      summary.attempted++;
      const { action, payload } = resolveAction(item);
      const { ok, status, body } = await postSync(action, payload, endpoint);

      if (ok) {
        // COMMIT POINT: server committed to MySQL → now clear the client item.
        removeQueueItem(item.id);
        summary.synced++;
        opts?.onItem?.(item, true);
        continue;
      }
      if (status === 409 || (body && (body.error === 'conflict' || body.error === 'stale_record'))) {
        setLastError(body?.message ?? 'Sync conflict — server copy changed; please refresh to rebase.');
        summary.conflict = true;
        summary.failed++;
        opts?.onItem?.(item, false);
        try {
          window.dispatchEvent(new CustomEvent('tradecore:queue-conflict', {
            detail: { item, serverData: body?.serverData ?? null, serverVersion: body?.serverVersion ?? body?.version ?? 0 }
          }));
        } catch (e) {}
        break; // STOP — let the app rebase before retrying.
      }
      // Network / transient failure → keep the item, stop the run.
      setLastError(typeof body?.error === 'string' && body.error ? body.error : 'Network or server error while syncing');
      summary.failed++;
      opts?.onItem?.(item, false);
      break;
    }
  } finally {
    draining = false;
    // A drain that pushed EVERY attempted item without a conflict is a full success → clear error.
    if (summary.attempted > 0 && summary.failed === 0 && !summary.conflict) lastError = null;
    try {
      const db = await getEngine().catch(() => null);
      if (db) {
        await withIdbWriteLock(async () => {
          await db.ensureReady();
          await db.put('kv', { key: KV_LAST_DRAIN_KEY, value: Date.now() });
        });
      }
    } catch (e) {}
    window.dispatchEvent(new CustomEvent(QUEUE_EVENT, { detail: { busy: false, pending: queueMirror.length } }));
    notifyQueue();
  }
  return summary;
}

// -----------------------------------------------------------------------------
// Online / visibility listeners — the "background sync trigger" layer.
// -----------------------------------------------------------------------------
function safeDrain() {
  void drainSyncQueue();
}

/**
 * Wire the online event listener + boot + tab-visibility bootstrap. Exception-safe:
 * every handler is guarded so a failure in one tab never throws into the sync loop.
 * Returns a cleanup function for effect-based mounting.
 */
export function registerOnlineSync(opts?: { onDrain?: (summary: DrainSummary) => void; endpoint?: string }): () => void {
  void getEngine(); // open the DB + hydrate the mirror eagerly at mount.

  const handleOnline = () => {
    safeDrain();
  };
  const handleVisibility = () => {
    if (document.visibilityState === 'visible' && typeof navigator !== 'undefined' && navigator.onLine !== false) {
      safeDrain();
    }
  };
  const handleConflict = (e: Event) => {
    // A stale write was rejected; the app can hook this to rebase once.
    console.warn('[OfflineEngine] sync queue hit a 409 conflict:', (e as CustomEvent).detail?.item);
  };

  window.addEventListener('online', handleOnline);
  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('tradecore:queue-conflict', handleConflict);

  // Boot drain: hydrate the mirror from IDB, then flush any leftover queue once.
  if (!bootDrainScheduled) {
    bootDrainScheduled = true;
    window.setTimeout(async () => {
      await getEngine().catch(() => null);
      if (typeof navigator !== 'undefined' && navigator.onLine !== false) {
        const summary = await drainSyncQueue({ endpoint: opts?.endpoint });
        opts?.onDrain?.(summary);
      }
    }, 800);
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    document.removeEventListener('visibilitychange', handleVisibility);
    window.removeEventListener('tradecore:queue-conflict', handleConflict);
  };
}

// -----------------------------------------------------------------------------
// One-shot utilities used by the app shell.
// -----------------------------------------------------------------------------
export function isSyncBusy(): boolean {
  return draining;
}

/** Persist any in-memory queue state immediately (call from beforeunload). */
export function flushQueueNow(): void {
  if (persistTimer !== null) {
    window.clearTimeout(persistTimer);
    persistTimer = null;
  }
  void persistQueue();
}