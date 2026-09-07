import React, { useEffect, useState } from 'react';

interface UpdateBannerProps {
  translate?: (text: string) => string;
}

/**
 * Non-intrusive "new version available" banner.
 *
 * Shown when either:
 *   1. The Service Worker installs a new build and posts NEW_VERSION_AVAILABLE
 *      (sw.ts install listener), or
 *   2. App.tsx's version.json poll / registerSW onNeedRefresh dispatches the
 *      `tradecore:update-available` window event.
 *
 * The refresh is ALWAYS user-confirmed: "Refresh now" calls the same updateSW
 * function registerSW returned (skip-waiting + reload) — it never purges caches
 * or force-reloads on its own, so open sessions and unsaved work survive.
 */
export default function UpdateBanner({ translate }: UpdateBannerProps) {
  const t = (s: string) => (translate ? translate(s) : s);
  const [available, setAvailable] = useState(false);
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    const show = (v: string) => {
      setVersion(v || '');
      setAvailable(true);
      console.log('New build detected, banner shown');
    };

    // Pathway 1: Service Worker posts NEW_VERSION_AVAILABLE on new-build install.
    let messageListener: ((event: MessageEvent) => void) | null = null;
    if ('serviceWorker' in navigator) {
      messageListener = (event: MessageEvent) => {
        const data = event?.data;
        if (data && (data.type === 'NEW_VERSION_AVAILABLE' || data === 'NEW_VERSION_AVAILABLE')) {
          show(data.version || '');
        }
      };
      navigator.serviceWorker.addEventListener('message', messageListener);
    }

    // Pathway 2: App.tsx dispatches `tradecore:update-available` (registerSW
    // onNeedRefresh + version.json polling).
    let windowListener: ((event: Event) => void) | null = null;
    windowListener = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      show(detail?.version || '');
    };
    window.addEventListener('tradecore:update-available', windowListener);

    return () => {
      if (messageListener && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', messageListener);
      }
      if (windowListener) {
        window.removeEventListener('tradecore:update-available', windowListener);
      }
    };
  }, []);

  if (!available) return null;

  const handleRefreshNow = () => {
    console.log('User data preserved and restored — applying update reload.');
    // Persist any pending work exactly like a graceful unload would.
    try {
      (window as any).__tradecorePreserveWork?.();
    } catch (e) {}
    const updater = (window as any).__tradecoreUpdateSW as ((reloadPage?: boolean) => Promise<void>) | undefined;
    if (typeof updater === 'function') {
      void updater(true);
    } else {
      try {
        if ('caches' in window) {
          caches.keys().then(names => names.forEach(name => caches.delete(name))).catch(() => {});
        }
      } catch (e) {}
      window.location.reload();
    }
  };

  return (
    <div className="fixed top-0 inset-x-0 z-[99999] flex justify-center pointer-events-none" style={{ paddingTop: 10 }}>
      <div
        className="pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-xl shadow-2xl border text-xs font-bold"
        style={{ background: '#fffbe6', borderColor: '#f59e0b', color: '#78350f' }}
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
        </span>
        <span>
          {t('A new version is available.')}{' '}
          {version && version !== 'latest' ? (
            <span className="opacity-80">({version})</span>
          ) : null}
        </span>
        <button
          type="button"
          onClick={handleRefreshNow}
          className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-black tracking-wide uppercase transition shadow"
        >
          {t('Refresh now to apply updates')}
        </button>
      </div>
    </div>
  );
}