import React, { useEffect, useState } from 'react';
import { RefreshCw, WifiOff, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  getSyncStatusSnapshot,
  drainSyncQueue,
  QUEUE_UPDATED_EVENT,
  SyncStatusSnapshot
} from '../utils/offlinePersistence';

/**
 * useSyncStatus — shared reactive snapshot hook for the persistence engine.
 *
 * Subscribes to window 'online'/'offline', the unified queue mutation event
 * (`tradecore:queue-updated`, fired by every CRUD enqueue/dequeue AND drain
 * lifecycle), drain/conflict ack events, plus a 3s polling fallback for
 * cross-tab / background-tab drift. Re-renders consumers with a fresh
 * SyncStatusSnapshot on every change.
 */
export function useSyncStatus(): SyncStatusSnapshot {
  const [snap, setSnap] = useState<SyncStatusSnapshot>(() => getSyncStatusSnapshot());

  useEffect(() => {
    const refresh = () => setSnap(getSyncStatusSnapshot());
    refresh();

    const handleOnline = () => {
      refresh();
      // The moment connectivity returns, kick the background drain AND re-snap
      // immediately so any widget flips to 'syncing' instead of lingering on 'offline'.
      void drainSyncQueue();
    };
    const handleOffline = () => refresh();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener(QUEUE_UPDATED_EVENT, refresh);
    window.addEventListener('tradecore:queue-busy', refresh);
    window.addEventListener('tradecore:queue-conflict', refresh);
    const iv = window.setInterval(refresh, 3000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener(QUEUE_UPDATED_EVENT, refresh);
      window.removeEventListener('tradecore:queue-busy', refresh);
      window.removeEventListener('tradecore:queue-conflict', refresh);
      window.clearInterval(iv);
    };
  }, []);

  return snap;
}

/**
 * SyncStatusIndicator — full status widget for the Dashboard header area.
 * Reports real-time network connectivity + IndexedDB → MySQL persistence state
 * across every module (sales, stock categories, products, users, audit trails).
 *
 * States (matches the product spec):
 *   - 'synced'   green  → all local changes + sales + audit rows committed to MySQL (queue empty)
 *   - 'syncing'  blue   → draining the pending payload queue to /api/php_sync.php
 *   - 'offline'  amber  → internet disconnected; X items (incl. offline POS sales) safely queued in IDB
 *   - 'error'    red    → network/server failure during flush; 'Retry' re-runs the drain
 *
 * `variant` selects the visual treatment:
 *   - 'header' (default): translucent glass pills for the brand-colored top nav.
 *   - 'card':            opaque pastel pills tuned for white dashboard cards.
 */
interface SyncStatusIndicatorProps {
  t?: (text: string) => string;
  variant?: 'header' | 'card';
}

export default function SyncStatusIndicator({
  t = (text: string) => text,
  variant = 'header'
}: SyncStatusIndicatorProps) {
  const snap = useSyncStatus();
  const [retrying, setRetrying] = useState<boolean>(false);

  const handleRetry = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (snap.busy || retrying || !snap.online) return;
    setRetrying(true);
    try {
      // drainSyncQueue fires `tradecore:queue-updated` + `tradecore:queue-busy`
      // on completion, so the hook re-snaps automatically — no manual setState.
      await drainSyncQueue();
    } finally {
      setRetrying(false);
    }
  };

  const isCard = variant === 'card';
  const pill = isCard
    ? 'no-print inline-flex items-center gap-1.5 shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold border transition select-none cursor-default'
    : 'no-print inline-flex items-center gap-1.5 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold border transition select-none cursor-default';

  if (snap.status === 'syncing' || (snap.status === 'offline' && snap.busy)) {
    return (
      <div
        className={`${pill} ${
          isCard
            ? 'bg-sky-50 border-sky-200 text-sky-700'
            : 'bg-sky-500/20 border-sky-400/50 text-sky-100'
        }`}
        title={t('Actively pushing pending queue to php_sync.php')}
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isCard ? 'text-sky-500' : 'text-sky-300'} animate-spin`} />
        <span>{t('Syncing')}…</span>
        {snap.total > 0 && (
          <span className={`${isCard ? 'bg-sky-100 text-sky-600' : 'bg-sky-400/20 text-sky-100'} rounded-full px-1.5 py-0.5 text-[10px] font-black`}>
            {snap.total}
          </span>
        )}
      </div>
    );
  }

  if (snap.status === 'offline') {
    const pendingLabel = `${snap.total} ${t('Pending')}`;
    const tooltip =
      snap.sales > 0
        ? `${snap.total} ${t('item(s)')} — ${snap.sales} ${t('sale(s)')} — ${t('safely queued in IndexedDB; will sync on reconnect')}`
        : `${snap.total} ${t('item(s)')} — ${t('safely queued in IndexedDB; will sync on reconnect')}`;
    return (
      <div
        className={`${pill} ${
          isCard
            ? 'bg-amber-50 border-amber-200 text-amber-700'
            : 'bg-amber-500/20 border-amber-400/50 text-amber-100'
        }`}
        title={tooltip}
        aria-live="polite"
      >
        <WifiOff className={`w-3.5 h-3.5 ${isCard ? 'text-amber-500' : 'text-amber-300'}`} />
        <span>{t('Offline')}</span>
        <span className={`${
          isCard ? 'bg-amber-100 text-amber-700' : 'bg-amber-400/20 text-amber-200'
        } rounded-full px-1.5 py-0.5 text-[10px] font-black`}>
          ({pendingLabel}
          {snap.sales > 0 ? ` · ${snap.sales} ${t('Sales')}` : ''})
        </span>
      </div>
    );
  }

  if (snap.status === 'error') {
    return (
      <div
        className={`${pill} ${
          isCard
            ? 'bg-red-50 border-red-200 text-red-700 pl-3 pr-1'
            : 'bg-red-500/20 border-red-400/50 text-red-100 pl-2.5 pr-1'
        }`}
        title={snap.error || t('A network or server error occurred during sync')}
        aria-live="assertive"
      >
        <AlertTriangle className={`w-3.5 h-3.5 ${isCard ? 'text-red-500' : 'text-red-300'}`} />
        <span>{t('Sync Error')}</span>
        <button
          type="button"
          onClick={handleRetry}
          disabled={retrying || !snap.online}
          className={`ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-[10px] font-black uppercase tracking-wide transition disabled:opacity-60 ${
            isCard ? 'bg-red-600 hover:bg-red-500' : 'bg-red-500 hover:bg-red-400'
          }`}
        >
          {retrying ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
          {t('Retry')}
        </button>
      </div>
    );
  }

  // synced
  return (
    <div
      className={`${pill} ${
        isCard
          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
          : 'bg-emerald-500/15 border-emerald-400/40 text-emerald-100'
      }`}
      title={t('All changes, sales and audit logs are committed to MySQL — queue empty')}
    >
      <CheckCircle2 className={`w-3.5 h-3.5 ${isCard ? 'text-emerald-500' : 'text-emerald-300'}`} />
      <span>{t('Synced')}</span>
    </div>
  );
}