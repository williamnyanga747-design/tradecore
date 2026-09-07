import React, { useState } from 'react';
import { ChevronLeft, ShoppingBag, Search, Store, Lock, LogOut, ArrowRight, Package } from 'lucide-react';
import { Company, MarketplaceCustomer, MarketplaceOrder } from '../../types';
import { getPublicTheme, PublicTheme } from '../../utils/publicTheme';
import { TZS, TFunc, orderStatusLabel } from './MarketplaceShared';

interface Props {
  theme: PublicTheme;
  t: TFunc;
  orders: MarketplaceOrder[];
  customers: MarketplaceCustomer[];
  companies: Company[];
  session: { phone: string; name: string } | null;
  onLogin: (phone: string, password: string) => { ok: boolean; customer?: MarketplaceCustomer; error?: string };
  onLogout: () => void;
  onTrack: (orderNumber: string) => void;
  onViewCompany: (slug: string) => void;
  onBack: () => void;
}

export default function MarketplaceMyOrders({
  theme, t, orders, customers, companies, session, onLogin, onLogout, onTrack, onViewCompany, onBack
}: Props) {
  const th = getPublicTheme(theme);
  const [phone, setPhone] = useState(session?.phone || '');
  const [password, setPassword] = useState('');
  const [locked, setLocked] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [guestPhone, setGuestPhone] = useState<string | null>(null);

  const effectivePhone = session?.phone || guestPhone || null;
  const myOrders = effectivePhone
    ? orders
        .filter(o => o.customerPhone === effectivePhone)
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    : [];

  const companyFor = (order: MarketplaceOrder) => companies.find(c => c.id === order.companyId);

  const lookup = () => {
    setError('');
    const p = phone.trim().replace(/\s/g, '');
    if (!p) return;
    const account = customers.find(c => c.phone === p && !c.isGuest && !!c.password);
    if (account) {
      setLocked(true);
      setSearching(true);
      return;
    }
    setGuestPhone(p);
  };

  const login = () => {
    setError('');
    const res = onLogin(phone.trim(), password);
    if (res.ok && res.customer) {
      setLocked(false);
      setSearching(false);
      setGuestPhone(null);
    } else {
      setError(res.error || t('Login failed.'));
    }
  };

  const statusColor: Record<string, string> = {
    pending_verification: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    verified: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    processing: 'bg-blue-500/15 text-blue-300 border-blue-500/40',
    out_for_delivery: 'bg-purple-500/15 text-purple-300 border-purple-500/40',
    delivered: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60',
    rejected: 'bg-red-500/15 text-red-300 border-red-500/40'
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      <button onClick={onBack} className={`flex items-center gap-1.5 text-[11px] font-bold ${th.textMuted} hover:underline cursor-pointer`}>
        <ChevronLeft className="w-4 h-4" /> {t('Back')}
      </button>

      <div className="text-center">
        <div className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center ${th.btnPrimary} mb-3`}>
          <ShoppingBag className={`w-7 h-7 ${th.btnPrimaryText}`} />
        </div>
        <h1 className={`text-xl md:text-2xl font-black ${th.strongText}`}>{t('My Orders')}</h1>
        <p className={`text-[11px] ${th.textMuted} font-semibold mt-1`}>{t('View and track all orders placed with your phone number.')}</p>
      </div>

      {/* Phone / login */}
      {!effectivePhone && (
        <div className={`${th.card} ${th.cardBorder} rounded-2xl p-5`}>
          <label className={`block text-[10px] font-black uppercase tracking-wider mb-1.5 ${th.label}`}>{t('Namba ya simu')}</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${th.textDim}`} />
              <input
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setLocked(false); setError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && (locked ? login() : lookup())}
                placeholder="+255 7XX XXX XXX"
                className={th.input + ' pl-9'}
              />
            </div>
            {!locked ? (
              <button onClick={lookup} className={`flex items-center justify-center gap-2 px-5 py-2.5 text-[11px] font-black rounded-xl transition cursor-pointer ${th.btnPrimary} ${th.btnPrimaryText}`}>
                <Search className="w-3.5 h-3.5" /> {t('Find Orders')}
              </button>
            ) : (
              <button onClick={login} className={`flex items-center justify-center gap-2 px-5 py-2.5 text-[11px] font-black rounded-xl transition cursor-pointer ${th.btnPrimary} ${th.btnPrimaryText}`}>
                <Lock className="w-3.5 h-3.5" /> {t('Login')}
              </button>
            )}
          </div>

          {locked && (
            <div className="mt-3">
              <div className={`flex items-center gap-2 text-[10px] font-bold ${th.chipText} ${th.chip} ${th.chipBorder} px-3 py-1.5 rounded-full w-fit mb-2`}>
                <Lock className="w-3 h-3" /> {t('Akaunti inapatikana — ingia kwa password')}
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && login()}
                placeholder={t('Password')}
                className={th.input}
              />
            </div>
          )}

          {error && (
            <div className="mt-3 text-[11px] font-bold text-red-400 bg-red-500/10 border border-red-500/40 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {!searching && effectivePhone === null && guestPhone !== null && myOrders.length === 0 && (
            <div className="mt-3 text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/40 rounded-lg px-3 py-2">
              {t('Hakuna orders zilizopatikana kwa namba hii. Unaweza kuweka order kwenye marketplace.')}
            </div>
          )}
        </div>
      )}

      {/* Session bar */}
      {session && (
        <div className={`${th.card} ${th.cardBorder} rounded-2xl p-4 flex items-center justify-between`}>
          <div>
            <div className={`text-sm font-black ${th.strongText}`}>{t('Karibu')}, {session.name.split(' ')[0]}</div>
            <div className={`text-[10px] ${th.textDim} font-semibold`}>{session.phone}</div>
          </div>
          <button onClick={onLogout} className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-black rounded-xl transition cursor-pointer ${th.btnSecondary} ${th.btnSecondaryText}`}>
            <LogOut className="w-3.5 h-3.5" /> {t('Logout')}
          </button>
        </div>
      )}

      {/* Orders list */}
      {effectivePhone && myOrders.length > 0 ? (
        <div className="space-y-3">
          {myOrders.map(o => {
            const company = companyFor(o);
            const count = (o.items || []).reduce((s, i) => s + i.quantity, 0);
            return (
              <div key={o.id} className={`${th.card} ${th.cardBorder} rounded-2xl p-4 cursor-pointer hover:brightness-105 transition`} onClick={() => onTrack(o.orderNumber)}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className={`text-xs font-black ${th.strongText}`}>{t('Order')} {o.orderNumber}</div>
                    <div className={`text-[10px] ${th.textDim} font-semibold mt-0.5`}>{new Date(o.createdAt).toLocaleString()} · {count} {count !== 1 ? t('items') : t('item')}</div>
                  </div>
                  <span className={`shrink-0 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full border ${statusColor[o.status] || 'bg-white/10 text-gray-300 border-white/20'}`}>
                    {orderStatusLabel(o.status, t)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className={`flex items-center gap-1.5 text-[10px] font-bold ${th.textDim}`}>
                    <Store className="w-3 h-3" /> {company?.name || t('Company')}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-black ${th.statValue}`}>{TZS(o.totalAmount)}</span>
                    <span className={`flex items-center gap-1 text-[10px] font-black ${th.brandText}`}>
                      {t('Track')} <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : effectivePhone && myOrders.length === 0 ? (
        <div className={`${th.card} ${th.cardBorder} rounded-2xl p-10 text-center`}>
          <Package className={`w-10 h-10 mx-auto mb-3 ${th.textDim}`} />
          <div className={`text-sm font-black ${th.strongText}`}>{t('Hakuna orders bado')}</div>
          <div className={`text-[11px] ${th.textMuted} font-semibold mt-1`}>{t('When you place an order, it will appear here.')}</div>
        </div>
      ) : null}

      {effectivePhone && (
        <div className="text-center">
          <button onClick={onBack} className={`inline-flex items-center gap-1.5 text-[10px] font-bold ${th.brandText} hover:underline cursor-pointer`}>
            <ShoppingBag className="w-3.5 h-3.5" /> {t('Continue Shopping')}
          </button>
        </div>
      )}
    </div>
  );
}
