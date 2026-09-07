import React, { useEffect, useRef, useState } from 'react';
import { Bell, Zap, ShoppingBag, MessageCircle, AlertTriangle, Info, HandCoins } from 'lucide-react';
import { AppNotification } from '../../types';
import { getPublicTheme, PublicTheme } from '../../utils/publicTheme';
import { TFunc } from './MarketplaceShared';
import { timeAgo } from '../../utils/megaHelpers';

interface Props {
  theme: PublicTheme;
  t: TFunc;
  notifications: AppNotification[];
  onMarkAllRead: () => void;
  onOpenItem?: (n: AppNotification) => void;
}

const ICONS: Record<AppNotification['type'], React.ElementType> = {
  flash_sale: Zap,
  order_update: ShoppingBag,
  new_message: MessageCircle,
  dispute: AlertTriangle,
  offer_update: HandCoins,
  general: Info
};

const ICON_CLS: Record<AppNotification['type'], string> = {
  flash_sale: 'text-red-500 bg-red-500/15',
  order_update: 'text-emerald-500 bg-emerald-500/15',
  new_message: 'text-blue-500 bg-blue-500/15',
  dispute: 'text-amber-500 bg-amber-500/15',
  offer_update: 'text-yellow-600 bg-yellow-500/15',
  general: 'text-gray-400 bg-gray-500/15'
};

/** MEGA BUILD F5 — notifications bell (header). MVP: DB-style list + unread badge. */
export default function MegaNotificationsBell({ theme, t, notifications, onMarkAllRead, onOpenItem }: Props) {
  const th = getPublicTheme(theme);
  const [open, setOpen] = useState(false);
  const [, setTick] = useState(0);
  const ref = useRef<HTMLDivElement | null>(null);

  // MVP polling: refresh badge every 30s
  useEffect(() => {
    const id = window.setInterval(() => setTick(x => x + 1), 30000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const unread = notifications.filter(n => !n.isRead).length;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(v => !v); if (!open && unread > 0) onMarkAllRead(); }}
        title={t('Taarifa')}
        className={`relative flex items-center justify-center w-8 h-8 rounded-lg transition cursor-pointer ${milkCls(theme)}`}
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-0.5 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute right-0 top-10 z-[60] w-80 max-w-[85vw] rounded-2xl border shadow-2xl overflow-hidden ${theme === 'milk' ? 'bg-white border-gray-200' : 'bg-gray-900 border-gray-700'}`}>
          <div className={`px-3.5 py-2.5 text-[11px] font-black border-b flex items-center justify-between ${theme === 'milk' ? 'border-gray-100 text-gray-800' : 'border-gray-800 text-white'}`}>
            {t('Taarifa')}
            {notifications.length > 0 && <span className="text-[9px] font-bold opacity-60">{notifications.length}</span>}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 && (
              <div className={`p-6 text-center text-[11px] font-semibold ${theme === 'milk' ? 'text-gray-500' : 'text-gray-500'}`}>
                {t('Hakuna taarifa bado')}
              </div>
            )}
            {notifications.slice(0, 30).map(n => {
              const Icon = ICONS[n.type] || Bell;
              return (
                <button
                  key={n.id}
                  onClick={() => { setOpen(false); onOpenItem?.(n); }}
                  className={`w-full flex items-start gap-2.5 px-3.5 py-2.5 text-left border-b cursor-pointer transition ${theme === 'milk' ? 'border-gray-50 hover:bg-gray-50' : 'border-gray-800 hover:bg-white/5'} ${!n.isRead ? (theme === 'milk' ? 'bg-amber-50/60' : 'bg-amber-500/5') : ''}`}
                >
                  <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${ICON_CLS[n.type]}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className={`block text-[11px] font-black truncate ${theme === 'milk' ? 'text-gray-900' : 'text-gray-100'}`}>{n.title}</span>
                    <span className={`block text-[10px] font-semibold line-clamp-2 ${theme === 'milk' ? 'text-gray-500' : 'text-gray-400'}`}>{n.message}</span>
                    <span className={`block text-[8px] font-bold mt-0.5 ${theme === 'milk' ? 'text-gray-400' : 'text-gray-600'}`}>{timeAgo(n.createdAt)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function milkCls(theme: PublicTheme): string {
  return theme === 'milk'
    ? 'text-gray-600 hover:text-amber-700 hover:bg-amber-100'
    : 'text-gray-200 hover:text-white hover:bg-white/10';
}
