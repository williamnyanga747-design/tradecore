import React from 'react';
import { RefreshCw, WifiOff, ShieldCheck, AlertTriangle } from 'lucide-react';
import { drainSyncQueue } from '../utils/offlinePersistence';
import { useSyncStatus } from './SyncStatusIndicator';

/**
 * SyncStatusDot — minimal icon-only fallback for the Top Navigation Bar.
 * Saves horizontal space around the company/branch/store selector hub while
 * keeping connectivity visible on EVERY page (dashboard + non-dashboard).
 *
 * States:
 *   - synced   green dot               — queue empty, all committed to MySQL
 *   - syncing  blue spinner            — actively pushing queue to php_sync.php
 *   - offline  amber badge + pending   — disconnected; X items queued in IDB
 *   - error    red dot (pulse)         — last flush failed; click to Retry
 */
interface SyncStatusDotProps {
  /** Optional i18n translator (Header passes its tenant-isolated `t`). */
  t?: (text: string) => string;
}

export default function SyncStatusDot({ t = (text: string) => text }: SyncStatusDotProps) {
  const snap = useSyncStatus();

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (snap.busy || !snap.online) return;
    void drainSyncQueue();
  };

  // Syncing — spinning blue indicator (highest priority visual).
  if (snap.busy || snap.status === 'syncing') {
    return (
      <button
        type="button"
        className="w-8 h-8 rounded-full bg-sky-500/20 border border-sky-400/50 flex items-center justify-center text-sky-200 transition hover:bg-sky-500/30 shrink-0 cursor-default"
        title={t('Syncing — pushing pending queue to php_sync.php')}
      >
        <RefreshCw className="w-4 h-4 text-sky-300 animate-spin" />
      </button>
    );
  }

  // Offline — amber badge with pending count.
  if (snap.status === 'offline') {
    return (
      <button
        type="button"
        className="relative w-8 h-8 rounded-full bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-200 transition hover:bg-amber-500/30 shrink-0 cursor-default"
        title={
          snap.sales > 0
            ? `${t('Offline')} — ${snap.total} ${t('pending')} (${snap.sales} ${t('sales')}) ${t('safely queued in IndexedDB')}`
            : `${t('Offline')} — ${snap.total} ${t('pending')} ${t('safely queued in IndexedDB')}`
        }
        aria-live="polite"
      >
        <WifiOff className="w-4 h-4 text-amber-300" />
        {snap.total > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-amber-500 text-white text-[9px] font-black flex items-center justify-center border border-amber-300 shadow">
            {snap.total > 99 ? '99+' : snap.total}
          </span>
        )}
      </button>
    );
  }

  // Error — red pulsing dot; click retries the drain.
  if (snap.status === 'error') {
    return (
      <button
        type="button"
        onClick={handleRetry}
        className="relative w-8 h-8 rounded-full bg-red-500/20 border border-red-400/50 flex items-center justify-center text-red-200 transition hover:bg-red-500/30 shrink-0"
        title={`${t('Sync Error')} — ${snap.error || t('network or server error during flush')}. ${t('Click to Retry')}`}
        aria-live="assertive"
      >
        <AlertTriangle className="w-4 h-4 text-red-300 animate-pulse" />
        {snap.total > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center border border-red-300 shadow">
            {snap.total > 99 ? '99+' : snap.total}
          </span>
        )}
      </button>
    );
  }

  // Synced — plain green dot.
  return (
    <button
      type="button"
      className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center text-emerald-200 transition hover:bg-emerald-500/25 shrink-0 cursor-default"
      title={t('Synced — all changes committed to MySQL, queue empty')}
    >
      <ShieldCheck className="w-4 h-4 text-emerald-300" />
    </button>
  );
}