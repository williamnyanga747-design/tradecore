import React, { useEffect, useState } from 'react';
import { Download, Bell, Check } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface PWAInstallButtonProps {
  translate: (text: string) => string;
  currentUserId?: number | null;
  currentCompanyId?: number | null;
  onRegisterPushSubscription?: (rec: { endpoint: string; p256dh: string; auth: string }) => void;
}

const SW_PATH = '/sw.js';
const VAPID_PUBLIC_KEY = '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export default function PWAInstallButton({ translate: t, currentUserId, currentCompanyId, onRegisterPushSubscription }: PWAInstallButtonProps) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [pushState, setPushState] = useState<'idle' | 'requesting' | 'subscribed' | 'unsupported'>('idle');
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBip);
    window.addEventListener('appinstalled', () => setInstalled(true));
    return () => {
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('appinstalled', () => setInstalled(true));
    };
  }, []);

  const handleInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setInstallEvent(null);
  };

  const handleSubscribe = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushState('unsupported');
      return;
    }
    setPushState('requesting');
    try {
      let reg = await navigator.serviceWorker.getRegistration(SW_PATH);
      if (!reg) {
        // sw.js is built by vite-plugin-pwa as a CLASSIC (non-module) script —
        // plain register() is correct; do NOT pass { type: 'module' }.
        // All failures are caught + logged; SW is an enhancement, never fatal.
        await navigator.serviceWorker.register(SW_PATH, { scope: '/' });
        reg = await navigator.serviceWorker.getRegistration(SW_PATH);
      }
      if (!reg) throw new Error('Service worker registration failed');
      const existing = await reg.pushManager.getSubscription();
      const sub = existing || await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
      const json = sub.toJSON();
      if (onRegisterPushSubscription) {
        onRegisterPushSubscription({
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh || '',
          auth: json.keys?.auth || ''
        });
      }
      setPushState('subscribed');
    } catch (err) {
      console.warn('Push subscription failed:', err);
      setPushState('unsupported');
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      {installEvent && !installed && (
        <button
          onClick={handleInstall}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-brand text-white rounded-lg text-[11px] font-bold cursor-pointer hover:bg-brand/90"
          title={t('Install App')}
        >
          <Download className="w-3.5 h-3.5" /> {t('Install')}
        </button>
      )}
      {pushState === 'idle' && (
        <button
          onClick={handleSubscribe}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-[11px] font-bold cursor-pointer hover:bg-gray-200"
          title={t('Enable notifications')}
        >
          <Bell className="w-3.5 h-3.5" /> {t('Notify')}
        </button>
      )}
      {pushState === 'requesting' && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 text-gray-500 rounded-lg text-[11px] font-bold">
          <Bell className="w-3.5 h-3.5 animate-pulse" /> …
        </span>
      )}
      {pushState === 'subscribed' && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-green-100 text-green-700 rounded-lg text-[11px] font-bold">
          <Check className="w-3.5 h-3.5" /> {t('Subscribed')}
        </span>
      )}
    </div>
  );
}
