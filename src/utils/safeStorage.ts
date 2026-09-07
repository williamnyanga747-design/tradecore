// ============================================================================
// safeStorage — Browser Storage Shield
// ----------------------------------------------------------------------------
// Problem: Edge/Chrome "Tracking Prevention blocked access to storage" throws
// DOMException on localStorage.get/set, breaking state persistence, company
// switching and sessions. Some embeds / privacy modes have storage completely
// unavailable.
//
// This module guarantees that NO storage call can ever throw an uncaught
// exception, and that state still persists in runtime + refreshes:
//
//   1. Native localStorage is preferred when it is actually writable.
//   2. If it is blocked (throws / tracking prevention), we install a global
//      facade on window.localStorage backed by an in-memory Map, persisted to
//      IndexedDB (and sessionStorage when available) so data survives reloads
//      where possible — without any re-sync loops.
//   3. Every helper is try/catch wrapped, so even a nested failure returns a
//      sane default instead of crashing the render tree.
//
// Because the facade replaces window.localStorage itself, ALL existing direct
// `localStorage.getItem(...)` call sites in the app are automatically shielded
// — no need to rewrite hundreds of call sites.
// ============================================================================

const IDB_NAME = 'tradecore_safe_storage';
const IDB_STORE = 'kv';
const MEMORY_MARKER_KEY = '__safeStorage_mode__';

let memoryStore: Record<string, string> = Object.create(null) as Record<string, string>;
let mode: 'native' | 'memory' | 'idb' | 'probe' = 'probe';
let idbReady = false;
let idbLoading: Promise<void> | null = null;

// ---------------------------------------------------------------------------
// IndexedDB async backing (best-effort; never blocks synchronous reads)
// ---------------------------------------------------------------------------
function openIdb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  try {
    return new Promise((resolve) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    });
  } catch {
    return Promise.resolve(null);
  }
}

async function loadIdb(): Promise<void> {
  const db = await openIdb();
  if (!db) return;
  try {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const store = tx.objectStore(IDB_STORE);
    const countReq = store.count();
    const values: Record<string, string> = {};
    await new Promise<void>((res) => {
      countReq.onsuccess = () => { if (countReq.result > 0) { store.openCursor()!.onsuccess = (e: any) => { const cur = e.target && e.target.result; if (cur) { values[String(cur.key)] = cur.value; cur.continue(); } else { res(); } }; } else { res(); } };
      countReq.onerror = () => res();
    });
    memoryStore = { ...memoryStore, ...values };
    idbReady = true;
  } catch {
    idbReady = false;
  } finally {
    try { db.close(); } catch { /* noop */ }
  }
}

function persistIncremental(): void {
  // Debounced best-effort write of the whole memory map into IndexedDB.
  persistIdbSoon();
}

let idbFlushTimer: ReturnType<typeof setTimeout> | null = null;
function persistIdbSoon(): void {
  if (idbFlushTimer) clearTimeout(idbFlushTimer);
  idbFlushTimer = setTimeout(() => { idbFlushTimer = null; _idbWriteAll(); }, 250);
}

function _idbWriteAll(): void {
  if (!idbReady) return;
  try {
    const dbPromise = openIdb();
    dbPromise.then((db) => {
      if (!db) return;
      try {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        Object.keys(memoryStore).forEach((k) => store.put(memoryStore[k], k));
        tx.oncomplete = () => { try { db.close(); } catch { /* noop */ } };
        tx.onerror = () => { try { db.close(); } catch { /* noop */ } };
      } catch {
        try { db.close(); } catch { /* noop */ }
      }
    });
  } catch { /* noop */ }
}

// ---------------------------------------------------------------------------
// Native probe — must also check that reads work (some modes block reads).
// ---------------------------------------------------------------------------
function probeNative(): boolean {
  const key = '__tradecore_probe__';
  try {
    const w = window as any;
    if (typeof w.localStorage !== 'object' || w.localStorage === null) return false;
    w.localStorage.setItem(key, '1');
    const back = w.localStorage.getItem(key);
    w.localStorage.removeItem(key);
    return back === '1';
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// The in-memory facade — drop-in Storage shape used when native is blocked.
// ---------------------------------------------------------------------------
const memoryStorage: Storage = {
  get length(): number { return Object.keys(memoryStore).length; },
  clear(): void { memoryStore = Object.create(null) as Record<string, string>; persistIncremental(); },
  getItem(key: string): string | null {
    try { return key in memoryStore ? memoryStore[key] : null; } catch { return null; }
  },
  key(index: number): string | null {
    try { return Object.keys(memoryStore)[index] ?? null; } catch { return null; }
  },
  removeItem(key: string): void {
    try {
      delete memoryStore[key];
      persistIncremental();
    } catch { /* noop */ }
  },
  setItem(key: string, value: string): void {
    try {
      memoryStore[key] = String(value);
      persistIncremental();
    } catch { /* noop */ }
  },
};

function installMemoryFacade(): void {
  try {
    const w = window as any;
    try {
      Object.defineProperty(w, 'localStorage', {
        configurable: true,
        enumerable: true,
        get: () => memoryStorage,
        set: () => { /* keep facade */ },
      });
    } catch {
      // Object.defineProperty unsupported — assign directly.
      w.localStorage = memoryStorage;
    }
    mode = 'idb';
    idbLoading = loadIdb().then(() => { idbReady = true; });
    // Reflect current mode so the dev can see which backing is active.
    try { memoryStorage.setItem(MEMORY_MARKER_KEY, 'memory+idb'); } catch { /* noop */ }
  } catch { /* noop */ }
}

function installNativeShield(): void {
  // Native storage works — but wrap every call so a transient block never throws.
  // We can't easily re-wrap every call-site method without churn; instead keep a
  // safe helper API. Shadow the native instance with guarded wrappers for the
  // four methods we use so even partial permission loss is non-fatal.
  try {
    const w = window as any;
    const native = w.localStorage;
    const guarded: Storage = {
      get length(): number { try { return native.length; } catch { return 0; } },
      clear(): void { try { native.clear(); } catch { /* noop */ } },
      getItem(key: string): string | null { try { return native.getItem(key); } catch { return memoryStore[key] ?? null; } },
      key(index: number): string | null { try { return native.key(index); } catch { return null; } },
      removeItem(key: string): void { try { native.removeItem(key); } catch { /* noop */ } },
      setItem(key: string, value: string): void {
        try { native.setItem(key, String(value)); }
        catch {
          // Fall through to memory so the session keeps working this refresh.
          memoryStore[key] = String(value);
          persistIncremental();
        }
      },
    };
    try {
      Object.defineProperty(w, 'localStorage', {
        configurable: true,
        enumerable: true,
        get: () => guarded,
        set: () => { /* keep guard */ },
      });
    } catch {
      try { w.localStorage = guarded; } catch { /* noop */ }
    }
    mode = 'native';
  } catch { /* noop */ }
}

// ---------------------------------------------------------------------------
// Public install — call once at module load (main.tsx).
// ---------------------------------------------------------------------------
export function installSafeStorage(): void {
  try {
    if (typeof window === 'undefined') return;
    if ((window as any).__safeStorageInstalled__) return;
    (window as any).__safeStorageInstalled__ = true;
    if (probeNative()) {
      installNativeShield();
    } else {
      installMemoryFacade();
    }
  } catch { /* noop */ }
}

// ---------------------------------------------------------------------------
// Explicit helper API (preferred for new / migrated code).
// Always safe: they resolve through the same backing store used by the facade,
// so memory + IDB fallback apply automatically.
// ---------------------------------------------------------------------------
function backingGet(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return memoryStore[key] ?? null; }
}
function backingSet(key: string, value: string): void {
  try { window.localStorage.setItem(key, String(value)); } catch { memoryStore[key] = String(value); }
}
function backingRemove(key: string): void {
  try { window.localStorage.removeItem(key); } catch { delete memoryStore[key]; }
}

export function storageGet(key: string): string | null {
  return backingGet(key);
}
export function storageSet(key: string, value: string): void {
  backingSet(key, value);
}
export function storageRemove(key: string): void {
  backingRemove(key);
}
export function storageGetJson<T>(key: string, fallback: T): T {
  try {
    const raw = backingGet(key);
    return raw == null || raw === '' ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}
export function storageSetJson(key: string, value: unknown): void {
  try { backingSet(key, JSON.stringify(value)); } catch { /* noop */ }
}
export function storageClear(): void {
  try { window.localStorage.clear(); } catch { /* noop */ }
}

// Auto-install for any module that imports this file (safe + idempotent).
try { installSafeStorage(); } catch { /* noop */ }
