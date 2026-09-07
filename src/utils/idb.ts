/**
 * idb.ts — tiny, dependency-free Promise wrapper around the native IndexedDB API,
 * API-compatible with the `idb` npm package for the subset TradeCore uses.
 *
 * Why not dexie/idb from npm? This project is deployed from a zip onto shared
 * hosting with a strict dependency budget; a 25-line shim buys the same durable,
 * transactional persistence without adding a package to the lockfile or bundle.
 *
 * Usage mirrors `idb`:
 *   const db = await openDB('tradecore-offline', 1, { upgrade(db) { ... } });
 *   await db.put('sync_queue', item);
 *   const x = await db.get('sync_queue', id);
 *   const all = await db.getAll('sync_queue');
 *   await db.delete('sync_queue', id);
 *   await db.clear('sync_queue');
 *
 * RESILIENT CONNECTION MANAGEMENT (2026-09-07-03):
 * The OfflineEngine ran fine, but its IndexedDB connection singleton could end up
 * pointing at a CLOSED/CLOSING native handle — the exact production failure:
 *   [OfflineEngine] IDB state cache write failed:
 *   InvalidStateError: Failed to execute 'transaction' on 'IDBDatabase': The database
 *   connection is closing.
 * A live server flush would keep succeeding (Flush OK) while the local snapshot
 * cache silently died. This wrapper now:
 *   1. Tracks a `_closed` flag driven by the native `onclose` and `onversionchange`
 *      events — a browser eviction, or a versionchange from another tab / SW flow,
 *      closes our handle underneath us. On versionchange we close politely (the
 *      spec REQUIRES it or the other tab is blocked forever) then lazily reopen.
 *   2. Checks connection freshness BEFORE every operation (readyState !== 'done').
 *   3. On a closing/closed failure, AUTO-REOPENS through the same openDB() manager
 *      and RETRIES the operation ONCE (try/catch fallback in `put`, `get`, etc.).
 *   4. `ensureReady()` lets synchronous `transaction()` consumers flush a stale
 *      handle before opening a transaction, keeping sequential writes isolated.
 */

export interface IDBPUpgradeDB {
  createObjectStore(name: string, options?: IDBObjectStoreParameters): IDBObjectStore;
  deleteObjectStore(name: string): void;
  objectStoreNames: DOMStringList;
  transaction: IDBTransaction;
}

type Upgrader = (db: IDBPUpgradeDB, oldVersion: number, newVersion: number | null, tx: IDBTransaction) => void | Promise<void>;

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

/** Active front-line: connection was usable a moment ago; the very next call hit a closed handle. */
export class IDBConnectionClosingError extends Error {
  name = 'InvalidStateError';
  constructor() {
    super('[OfflineEngine] The database connection is closing/closed');
  }
}

/** True for the browser's InvalidStateError on a closing/closed handle (or our own front-line marker). */
function isClosingFailure(e: unknown): boolean {
  if (!e) return false;
  const name = (e as any)?.name as string | undefined;
  const msg = String((e as any)?.message ?? '');
  if (name === 'InvalidStateError') return true;
  if (msg.includes('connection is closing') || msg.includes('database is closing')) return true;
  return false;
}

function idbTxLost(storeNames: string | string[]): void {
  console.warn('[OfflineEngine] IDB transaction aborted (store: ' + String(storeNames) + ')');
}

class IDBPTransactionImpl {
  constructor(private readonly tx: IDBTransaction) {}
  done: Promise<void> = new Promise((resolve, reject) => {
    this.tx.oncomplete = () => resolve();
    this.tx.onerror = () => reject(this.tx.error ?? new Error('IndexedDB transaction failed'));
    this.tx.onabort = () => reject(this.tx.error ?? new Error('IndexedDB transaction aborted'));
  });
  store(name: string): IDBObjectStore {
    return this.tx.objectStore(name);
  }
}

class IDBPObjectStore {
  constructor(private readonly store: IDBObjectStore) {}
  get(key: IDBValidKey | IDBKeyRange): Promise<any> { return promisify(this.store.get(key)); }
  getAll(query?: IDBValidKey | IDBKeyRange | null, count?: number): Promise<any[]> { return promisify(this.store.getAll(query ?? null, count)); }
  put(value: any, key?: IDBValidKey): Promise<IDBValidKey> { return promisify(this.store.put(value, key)); }
  add(value: any, key?: IDBValidKey): Promise<IDBValidKey> { return promisify(this.store.add(value, key)); }
  delete(key: IDBValidKey | IDBKeyRange): Promise<void> { return promisify(this.store.delete(key)); }
  clear(): Promise<void> { return promisify(this.store.clear()); }
  count(query?: IDBValidKey | IDBKeyRange): Promise<number> { return promisify(this.store.count(query ?? undefined)); }
  index(name: string): IDBIndex { return this.store.index(name); }
}

class IDBPIndex {
  constructor(private readonly index: IDBIndex) {}
  get(key: IDBValidKey | IDBKeyRange): Promise<any> { return promisify(this.index.get(key)); }
  getAll(query?: IDBValidKey | IDBKeyRange | null, count?: number): Promise<any[]> { return promisify(this.index.getAll(query ?? null, count)); }
  getAllKeys(query?: IDBValidKey | IDBKeyRange | null, count?: number): Promise<IDBValidKey[]> { return promisify(this.index.getAllKeys(query ?? null, count)); }
  count(query?: IDBValidKey | IDBKeyRange): Promise<number> { return promisify(this.index.count(query ?? undefined)); }
}

class IDBPObjectStores {
  constructor(private readonly tx: IDBTransaction) {}
  get = (name: string) => new IDBPObjectStore(this.tx.objectStore(name));
}

/**
 * The resilient proxy (referred to as `QN` in the crash report). Holds ONE live
 * IDBDatabase handle, transparently swaps it for a freshly-opened handle whenever
 * the host closes it, and never surfaces InvalidStateError to the sync pipeline.
 */
class IDBPDatabaseImpl {
  private db: IDBDatabase;
  private _closed = false;

  constructor(db: IDBDatabase, private readonly reopenFn?: () => Promise<IDBDatabase>) {
    this.db = db;
    this._wireCloseListeners();
  }

  get isClosed(): boolean {
    const rs = (this.db as IDBDatabase & { readyState?: string }).readyState;
    return this._closed || rs === 'closing' || rs === 'closed';
  }

  private _wireCloseListeners(): void {
    try {
      this.db.onclose = () => {
        this._closed = true;
        console.warn('[OfflineEngine] IDB connection closed by host — will auto-reopen on next access');
      };
    } catch (e) {}
    try {
      this.db.onversionchange = () => {
        // Another tab (or a SW-triggered upgrade) bumped/removed the DB version and
        // is BLOCKED until every other connection closes. Close this now-stale handle
        // so the other tab unblocks; the wrapper lazily reopens on the next access.
        this._closed = true;
        try { this.db.close(); } catch (e) {}
        console.warn('[OfflineEngine] IDB versionchange received — closed stale handle; will auto-reopen on next access');
      };
    } catch (e) {}
  }

  /** Freshness gate: throws IDBConnectionClosingError when the handle is dead. */
  private requireLive(): IDBDatabase {
    if (this.isClosed) throw new IDBConnectionClosingError();
    return this.db;
  }

  /** Reopen the database through the same openDB() manager that created us. */
  private async reopen(): Promise<IDBDatabase> {
    if (!this.reopenFn) throw new IDBConnectionClosingError();
    const fresh = await this.reopenFn();
    this.db = fresh;
    this._closed = false;
    this._wireCloseListeners();
    return this.db;
  }

  /**
   * Guarantee a live connection before a synchronous transaction() call. Imports the
   * fallback here so `db.transaction(...)` consumers can flush a closing handle first.
   */
  async ensureReady(): Promise<this> {
    if (!this.isClosed) return this;
    console.log('[OfflineEngine] IDB connection closed/closing. Reopening database pool...');
    await this.reopen();
    return this;
  }

  /** Run an op on a live connection; reopen + retry exactly once on a closing/closed handle. */
  private async run<T>(op: (db: IDBDatabase) => Promise<T>): Promise<T> {
    try {
      return await op(this.requireLive());
    } catch (e) {
      if (isClosingFailure(e) || this._closed) {
        console.log('[OfflineEngine] IDB connection closed/closing. Reopening database pool...');
        const fresh = await this.reopen();
        return await op(fresh);
      }
      throw e;
    }
  }

  get name(): string { return this.db.name; }
  get objectStoreNames(): DOMStringList { return this.db.objectStoreNames; }

  transaction(storeNames: string | string[], mode: IDBTransactionMode = 'readonly'): IDBPTransactionImpl {
    const db = this.requireLive();
    try {
      const tx = db.transaction(storeNames, mode);
      tx.onabort = () => idbTxLost(storeNames);
      tx.onerror = () => idbTxLost(storeNames);
      return new IDBPTransactionImpl(tx);
    } catch (e) {
      if (isClosingFailure(e)) throw new IDBConnectionClosingError();
      throw e;
    }
  }

  async put(store: string, value: any, key?: IDBValidKey): Promise<IDBValidKey> {
    return this.run((db) => {
      const tx = db.transaction(store, 'readwrite');
      tx.onabort = () => idbTxLost(store);
      return promisify(tx.objectStore(store).put(value, key));
    });
  }
  async get(store: string, key: IDBValidKey): Promise<any> {
    return this.run((db) => promisify(db.transaction(store, 'readonly').objectStore(store).get(key)));
  }
  async getAll(store: string): Promise<any[]> {
    return this.run((db) => promisify(db.transaction(store, 'readonly').objectStore(store).getAll()));
  }
  async delete(store: string, key: IDBValidKey): Promise<void> {
    return this.run(async (db) => { await promisify(db.transaction(store, 'readwrite').objectStore(store).delete(key)); });
  }
  async clear(store: string): Promise<void> {
    return this.run(async (db) => { await promisify(db.transaction(store, 'readwrite').objectStore(store).clear()); });
  }
  async count(store: string): Promise<number> {
    return this.run((db) => promisify(db.transaction(store, 'readonly').objectStore(store).count()));
  }
}

export interface OpenDBOptions {
  upgrade?: Upgrader;
}

/**
 * Connection manager: opens (or reopens) a database, wiring the resilient wrapper
 * so every consumer shares ONE live handle and the wrapper can auto-reopen it.
 * NEVER closes this handle from page-lifecycle hooks — the wrapper closes it only
 * in response to onversionchange, and any future reopen is lazy + transparent.
 */
export async function openDB(name: string, version: number, opts?: OpenDBOptions): Promise<IDBPDatabaseImpl> {
  const openOnce = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not available in this context'));
        return;
      }
      let req: IDBOpenDBRequest;
      try {
        req = indexedDB.open(name, version);
      } catch (e) {
        reject(e instanceof Error ? e : new Error('IndexedDB open failed'));
        return;
      }
      req.onupgradeneeded = (ev) => {
        const db = req.result;
        if (opts?.upgrade) {
          const tx = (ev.target as any)?.transaction as IDBTransaction;
          void opts.upgrade(
            { createObjectStore: (n, o) => db.createObjectStore(n, o), deleteObjectStore: (n) => db.deleteObjectStore(n), objectStoreNames: db.objectStoreNames, transaction: tx },
            ev.oldVersion,
            ev.newVersion,
            tx
          );
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
      req.onblocked = () => reject(new Error('IndexedDB open blocked by another tab'));
    });

  const native = await openOnce();
  return new IDBPDatabaseImpl(native, () => openOnce());
}