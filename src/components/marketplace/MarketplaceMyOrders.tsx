import React, { useState } from 'react';
import { ChevronLeft, ShoppingBag, Search, Store, Lock, LogOut, ArrowRight, Package, CalendarClock, Users, CheckCircle2, Clock } from 'lucide-react';
import { Company, MarketplaceCustomer, MarketplaceOrder, MarketplaceProduct, InstallmentOrder, GroupDeal, GroupDealParticipant } from '../../types';
import { getPublicTheme, PublicTheme } from '../../utils/publicTheme';
import { TZS, TFunc, orderStatusLabel } from './MarketplaceShared';

interface Props {
  theme: PublicTheme;
  t: TFunc;
  orders: MarketplaceOrder[];
  customers: MarketplaceCustomer[];
  companies: Company[];
  products?: MarketplaceProduct[];
  installmentOrders?: InstallmentOrder[];
  groupDeals?: GroupDeal[];
  groupDealParticipants?: GroupDealParticipant[];
  session: { phone: string; name: string } | null;
  onLogin: (phone: string, password: string) => { ok: boolean; customer?: MarketplaceCustomer; error?: string };
  onLogout: () => void;
  onTrack: (orderNumber: string) => void;
  onViewCompany: (slug: string) => void;
  onBack: () => void;
  onNavigate?: (path: string) => void;
}

export default function MarketplaceMyOrders({
  theme, t, orders, customers, companies, products = [],
  installmentOrders = [], groupDeals = [], groupDealParticipants = [],
  session, onLogin, onLogout, onTrack, onViewCompany, onBack, onNavigate
}: Props) {
  const th = getPublicTheme(theme);
  const [phone, setPhone] = useState(session?.phone || '');
  const [password, setPassword] = useState('');
  const [locked, setLocked] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [guestPhone, setGuestPhone] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'orders' | 'installments' | 'groups'>('orders');

  const storedPhone = typeof window !== 'undefined' ? (localStorage.getItem('tradecore_buyer_phone') || '') : '';
  const effectivePhone = session?.phone || guestPhone || storedPhone || null;
  const cleanPhone = (effectivePhone || '').replace(/\D/g, '').slice(-9);

  const myOrders = cleanPhone
    ? orders
        .filter(o => o.customerPhone.replace(/\D/g, '').endsWith(cleanPhone))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    : [];

  const myInstallments = cleanPhone
    ? installmentOrders
        .filter(o => o.customerPhone.replace(/\D/g, '').endsWith(cleanPhone))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    : [];

  const myGroupDeals = cleanPhone
    ? groupDeals.filter(d => {
        const parts = groupDealParticipants.filter(p => p.groupDealId === d.id);
        return parts.some(p => p.customerPhone.replace(/\D/g, '').endsWith(cleanPhone));
      })
    : [];

  const companyFor = (companyId: number) => companies.find(c => c.id === companyId);

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
    try {
      localStorage.setItem('tradecore_buyer_phone', p);
    } catch {}
  };

  const login = () => {
    setError('');
    const res = onLogin(phone.trim(), password);
    if (res.ok && res.customer) {
      setLocked(false);
      setSearching(false);
      setGuestPhone(null);
      try {
        localStorage.setItem('tradecore_buyer_phone', phone.trim());
      } catch {}
    } else {
      setError(res.error || t('Login failed.'));
    }
  };

  const handleGo = (path: string) => {
    if (onNavigate) onNavigate(path);
    else window.location.href = path;
  };

  const statusColor: Record<string, string> = {
    pending_verification: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    verified: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    processing: 'bg-blue-500/15 text-blue-300 border-blue-500/40',
    out_for_delivery: 'bg-purple-500/15 text-purple-300 border-purple-500/40',
    delivered: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    cancelled: 'bg-red-500/15 text-red-300 border-red-500/40',
    rejected: 'bg-red-500/15 text-red-300 border-red-500/40'
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <button onClick={onBack} className={`flex items-center gap-1.5 text-[11px] font-bold ${th.textMuted} hover:underline cursor-pointer`}>
        <ChevronLeft className="w-4 h-4" /> {t('Back')}
      </button>

      <div>
        <h1 className={`text-xl md:text-2xl font-black ${th.strongText}`}>{t('Maagizo & Mipango Yangu (My Purchases & Plans)')}</h1>
        <p className={`text-xs ${th.textMuted} font-semibold mt-0.5`}>
          {t('Tazama oda zote, maendeleo ya Lipa Pole Pole, na vikundi vya Nunua Pamoja ulivyojiunga.')}
        </p>
      </div>

      {/* Guest lookup or login */}
      {!session && (
        <div className={`${th.card} ${th.cardBorder} rounded-3xl p-5 shadow-sm`}>
          <div className={`text-xs font-black ${th.strongText} mb-2`}>{t('Weka namba yako ya simu')}</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${th.textDim}`} />
              <input
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setGuestPhone(null); }}
                onKeyDown={(e) => e.key === 'Enter' && lookup()}
                placeholder="+255 7XX XXX XXX au 07XX..."
                className={th.input + ' pl-9 text-xs font-bold'}
              />
            </div>
            {!locked ? (
              <button onClick={lookup} className={`flex items-center justify-center gap-2 px-5 py-2.5 text-[11px] font-black rounded-xl transition cursor-pointer ${th.btnPrimary} ${th.btnPrimaryText}`}>
                <Search className="w-3.5 h-3.5" /> {t('Tafuta Rekodi Zangu')}
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

      {/* Category Tabs */}
      {effectivePhone && (
        <div className="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'orders' ? `${th.btnPrimary} ${th.btnPrimaryText}` : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Package className="w-3.5 h-3.5" /> {t('Maagizo ya Moja kwa Moja')} ({myOrders.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('installments')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'installments' ? `${th.btnPrimary} ${th.btnPrimaryText}` : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <CalendarClock className="w-3.5 h-3.5" /> {t('Lipa Pole Pole')} ({myInstallments.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('groups')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'groups' ? `${th.btnPrimary} ${th.btnPrimaryText}` : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> {t('Nunua Pamoja')} ({myGroupDeals.length})
          </button>
        </div>
      )}

      {/* TAB 1: DIRECT ORDERS */}
      {effectivePhone && activeTab === 'orders' && (
        myOrders.length > 0 ? (
          <div className="space-y-3">
            {myOrders.map(o => {
              const comp = companyFor(o.companyId);
              const count = (o.items || []).reduce((s, i) => s + i.quantity, 0);
              return (
                <div key={o.id} className={`${th.card} ${th.cardBorder} rounded-2xl p-4 cursor-pointer hover:border-amber-400 transition shadow-sm`} onClick={() => onTrack(o.orderNumber)}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className={`text-xs font-black ${th.strongText}`}>{t('Order')} {o.orderNumber}</div>
                      <div className={`text-[10px] ${th.textDim} font-semibold mt-0.5`}>{new Date(o.createdAt).toLocaleString()} · {count} {count !== 1 ? t('items') : t('item')}</div>
                    </div>
                    <span className={`shrink-0 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${statusColor[o.status] || 'bg-white/10 text-gray-300 border-white/20'}`}>
                      {orderStatusLabel(o.status, t)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className={`flex items-center gap-1.5 text-[10px] font-bold ${th.textDim}`}>
                      <Store className="w-3 h-3" /> {comp?.name || t('Company')}
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
        ) : (
          <div className={`${th.card} ${th.cardBorder} rounded-2xl p-10 text-center`}>
            <Package className={`w-10 h-10 mx-auto mb-3 ${th.textDim}`} />
            <div className={`text-sm font-black ${th.strongText}`}>{t('Hakuna maagizo ya moja kwa moja bado')}</div>
            <div className={`text-[11px] ${th.textMuted} font-semibold mt-1`}>{t('Wakati utakapoweka order, itaonekana hapa.')}</div>
          </div>
        )
      )}

      {/* TAB 2: LIPA POLE POLE INSTALLMENTS */}
      {effectivePhone && activeTab === 'installments' && (
        myInstallments.length > 0 ? (
          <div className="space-y-3">
            {myInstallments.map(inst => {
              const prod = products.find(p => p.id === inst.productId);
              const isDone = inst.status === 'completed';
              const progressPct = Math.min(100, Math.round((inst.paidInstallments / inst.installmentsCount) * 100));

              return (
                <div key={inst.id} className={`${th.card} ${th.cardBorder} rounded-2xl p-4.5 space-y-3 border hover:border-sky-400 transition shadow-sm`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 shrink-0 border border-gray-100">
                        {prod?.image ? <img src={prod.image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-sky-500 flex items-center justify-center text-white font-bold text-lg">{(prod?.name || '-').charAt(0)}</div>}
                      </div>
                      <div>
                        <div className="text-xs font-black text-gray-900 line-clamp-1">{prod?.name}</div>
                        <div className="text-[10px] text-gray-500 font-mono font-bold mt-0.5">Code: {inst.trackingCode}</div>
                        <div className="text-xs font-bold text-sky-700 mt-1">
                          Awamu {inst.paidInstallments} kati ya {inst.installmentsCount} zimekamilika
                        </div>
                      </div>
                    </div>
                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${isDone ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'}`}>
                      {isDone ? '✓ Imekamilika' : 'Inaendelea'}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[11px] font-bold text-gray-600 mb-1">
                      <span>TZS {inst.totalPaid.toLocaleString()} zimeshalipwa</span>
                      <span>Baki: <strong className="text-gray-900">TZS {inst.remaining.toLocaleString()}</strong></span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-sky-500 to-blue-600 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
                    <div className="text-[11px] text-gray-500 font-semibold">
                      Kila Awamu: <span className="font-bold text-gray-900">TZS {inst.installmentAmount.toLocaleString()}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleGo(`/lipa-pole-pole/${inst.trackingCode}`)}
                      className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-black cursor-pointer shadow-sm flex items-center gap-1.5 ml-auto"
                    >
                      {isDone ? t('Tazama Risiti & Maelezo') : t('Lipa Awamu Ifuatayo Sasa')} <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={`${th.card} ${th.cardBorder} rounded-2xl p-10 text-center`}>
            <CalendarClock className={`w-10 h-10 mx-auto mb-3 text-sky-400`} />
            <div className={`text-sm font-black ${th.strongText}`}>{t('Huna mpango wa Lipa Pole Pole bado')}</div>
            <div className={`text-[11px] ${th.textMuted} font-semibold mt-1`}>{t('Nunua bidhaa yoyote kwa awamu kidogo kidogo bila riba!')}</div>
          </div>
        )
      )}

      {/* TAB 3: NUNUA PAMOJA GROUP BUYS */}
      {effectivePhone && activeTab === 'groups' && (
        myGroupDeals.length > 0 ? (
          <div className="grid sm:grid-cols-2 gap-3.5">
            {myGroupDeals.map(deal => {
              const prod = products.find(p => p.id === deal.productId);
              const parts = groupDealParticipants.filter(p => p.groupDealId === deal.id);
              const paid = parts.filter(p => p.status === 'paid').length;
              const isDone = deal.status === 'completed';
              const remainingSpots = Math.max(0, deal.minBuyers - paid);

              return (
                <div key={deal.id} className={`${th.card} ${th.cardBorder} rounded-2xl p-4 space-y-3 border hover:border-indigo-400 transition shadow-sm`}>
                  <div className="flex items-start gap-3">
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 shrink-0 border border-gray-100">
                      {prod?.image ? <img src={prod.image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-indigo-500 flex items-center justify-center text-white font-bold text-lg">{(prod?.name || '-').charAt(0)}</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-black text-gray-900 line-clamp-1">{prod?.name}</div>
                      <div className="text-[10px] text-indigo-700 font-bold mt-0.5">{deal.title || `Kikundi #${deal.shareCode}`}</div>
                      <div className="text-xs font-black text-emerald-600 mt-1">Bei ya Kikundi: TZS {deal.groupPrice.toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="p-2.5 bg-indigo-50/70 rounded-xl text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 font-semibold">{t('Maendeleo')}:</span>
                      <span className="font-bold text-indigo-800">{paid} / {deal.minBuyers} {t('wamelipa')}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 font-semibold">{t('Hali')}:</span>
                      <span className={`font-black ${isDone ? 'text-emerald-700' : 'text-indigo-700'}`}>
                        {isDone ? '✓ Kikundi Kimekamilika' : `Bado wanunuzi ${remainingSpots}`}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleGo(`/group-deal/${deal.id}`)}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                  >
                    {t('Fungua, Alika & Fuatilia')}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={`${th.card} ${th.cardBorder} rounded-2xl p-10 text-center`}>
            <Users className={`w-10 h-10 mx-auto mb-3 text-indigo-400`} />
            <div className={`text-sm font-black ${th.strongText}`}>{t('Hujaanza au kujiunga na kikundi cha Nunua Pamoja bado')}</div>
            <div className={`text-[11px] ${th.textMuted} font-semibold mt-1`}>{t('Anzisha kikundi chako mwenyewe na waalike ndugu au marafiki upate punguzo kubwa!')}</div>
          </div>
        )
      )}

      {effectivePhone && (
        <div className="text-center pt-2">
          <button onClick={onBack} className={`inline-flex items-center gap-1.5 text-[10px] font-bold ${th.brandText} hover:underline cursor-pointer`}>
            <ShoppingBag className="w-3.5 h-3.5" /> {t('Continue Shopping')}
          </button>
        </div>
      )}
    </div>
  );
}
