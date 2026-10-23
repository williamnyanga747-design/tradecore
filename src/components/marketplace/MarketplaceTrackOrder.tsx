import React, { useState } from 'react';
import { ChevronLeft, Search, Package, Store, MapPin, Smartphone, Calendar, FileText, CalendarClock, Users, CheckCircle2, Clock, Share2, ArrowRight } from 'lucide-react';
import { Company, MarketplaceOrder, MarketplaceProduct, InstallmentOrder, InstallmentPayment, GroupDeal, GroupDealParticipant } from '../../types';
import { getPublicTheme, PublicTheme } from '../../utils/publicTheme';
import { safeLower } from '../../utils/stateHelpers';
import { TZS, VerifiedBadge, TFunc, orderStatusLabel } from './MarketplaceShared';
import StatusStepper from './StatusStepper';
import InstallmentVisualSchedule from './InstallmentVisualSchedule';

interface Props {
  theme: PublicTheme;
  t: TFunc;
  orders: MarketplaceOrder[];
  companies: Company[];
  products?: MarketplaceProduct[];
  installmentOrders?: InstallmentOrder[];
  installmentPayments?: InstallmentPayment[];
  groupDeals?: GroupDeal[];
  groupDealParticipants?: GroupDealParticipant[];
  initialOrderNumber?: string;
  onBack: () => void;
  onViewCompany: (slug: string) => void;
  onNavigate?: (path: string) => void;
}

export default function MarketplaceTrackOrder({
  theme, t, orders, companies, products = [],
  installmentOrders = [], installmentPayments = [],
  groupDeals = [], groupDealParticipants = [],
  initialOrderNumber, onBack, onViewCompany, onNavigate
}: Props) {
  const th = getPublicTheme(theme);
  const milk = theme === 'milk';
  const [q, setQ] = useState(initialOrderNumber || '');
  const [submitted, setSubmitted] = useState(Boolean(initialOrderNumber));
  const [activeTab, setActiveTab] = useState<'all' | 'orders' | 'installments' | 'groups'>('all');

  const query = q.trim().toLowerCase();
  const cleanPhone = q.replace(/\D/g, '').slice(-9);

  // 1. Direct standard order lookup
  const singleOrder = submitted && query
    ? orders.find(o => safeLower(o.orderNumber) === query || (o.transactionId && safeLower(o.transactionId) === query))
    : undefined;

  // 2. Direct installment order lookup
  const singleInstallment = submitted && query
    ? installmentOrders.find(o => safeLower(o.trackingCode) === query || (o.transactionId && safeLower(o.transactionId) === query))
    : undefined;

  // 3. Direct group deal lookup
  const singleGroupDeal = submitted && query
    ? groupDeals.find(d => safeLower(d.shareCode) === query || String(d.id) === query)
    : undefined;

  // 4. Phone-based or broad lookup
  const matchingOrders = submitted && (cleanPhone.length >= 8 || query)
    ? orders.filter(o => {
        if (cleanPhone.length >= 8 && o.customerPhone.replace(/\D/g, '').endsWith(cleanPhone)) return true;
        return safeLower(o.orderNumber).includes(query) || (o.transactionId && safeLower(o.transactionId).includes(query));
      })
    : [];

  const matchingInstallments = submitted && (cleanPhone.length >= 8 || query)
    ? installmentOrders.filter(o => {
        if (cleanPhone.length >= 8 && o.customerPhone.replace(/\D/g, '').endsWith(cleanPhone)) return true;
        return safeLower(o.trackingCode).includes(query) || (o.transactionId && safeLower(o.transactionId).includes(query));
      })
    : [];

  const matchingGroupDeals = submitted && (cleanPhone.length >= 8 || query)
    ? groupDeals.filter(d => {
        if (safeLower(d.shareCode).includes(query) || String(d.id) === query) return true;
        if (cleanPhone.length >= 8) {
          const parts = groupDealParticipants.filter(p => p.groupDealId === d.id);
          return parts.some(p => p.customerPhone.replace(/\D/g, '').endsWith(cleanPhone));
        }
        return false;
      })
    : [];

  const hasAnyResults = Boolean(singleOrder || singleInstallment || singleGroupDeal || matchingOrders.length > 0 || matchingInstallments.length > 0 || matchingGroupDeals.length > 0);

  const submit = () => {
    if (!q.trim()) return;
    setSubmitted(true);
  };

  const handleGo = (path: string) => {
    if (onNavigate) onNavigate(path);
    else window.location.href = path;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <button onClick={onBack} className={`flex items-center gap-1.5 text-[11px] font-bold ${th.textMuted} hover:underline cursor-pointer`}>
        <ChevronLeft className="w-4 h-4" /> {t('Back')}
      </button>

      <div className="text-center">
        <div className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center ${th.btnPrimary} mb-3 shadow-md`}>
          <Package className={`w-7 h-7 ${th.btnPrimaryText}`} />
        </div>
        <h1 className={`text-xl md:text-2xl font-black ${th.strongText}`}>{t('Fuatilia Manunuzi & Maagizo (Buyer Tracking Hub)')}</h1>
        <p className={`text-xs ${th.textMuted} font-semibold mt-1 max-w-lg mx-auto`}>
          {t('Weka namba ya oda, kodi ya Lipa Pole Pole (LP-..), share code ya Nunua Pamoja (GRP-..), au namba yako ya simu kuona maendeleo ya manunuzi yako papo hapo.')}
        </p>
      </div>

      {/* Unified Search Input */}
      <div className={`${th.card} ${th.cardBorder} rounded-3xl p-5 shadow-sm`}>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${th.textDim}`} />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setSubmitted(false); }}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder={t('Mfano: TRD-2026-..., LP-1234, GRP-ABCDE, au 07XX XXX XXX')}
              className={`${th.input} pl-10 text-xs font-bold`}
            />
          </div>
          <button onClick={submit} className={`flex items-center justify-center gap-2 px-6 py-3 text-xs font-black rounded-xl transition cursor-pointer ${th.btnPrimary} ${th.btnPrimaryText} shadow-md`}>
            <Search className="w-4 h-4" /> {t('Tafuta Sasa')}
          </button>
        </div>

        {submitted && q.trim() && !hasAnyResults && (
          <div className="mt-4 text-xs font-bold text-red-500 bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
            {t('Hakuna agizo, awamu ya Lipa Pole Pole, au Nunua Pamoja inayolingana na')} "{q.trim()}".
            <div className="text-[11px] font-normal text-gray-500 mt-1">
              {t('Tafadhali hakikisha umeweka namba sahihi ya oda, namba ya simu ya Tanzania, au tracking code.')}
            </div>
          </div>
        )}
      </div>

      {/* Results View */}
      {submitted && hasAnyResults && (
        <div className="space-y-6">
          {/* Quick Filter Tabs if multiple kinds found */}
          {(matchingOrders.length > 0 || matchingInstallments.length > 0 || matchingGroupDeals.length > 0) && (
            <div className="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'all' ? `${th.btnPrimary} ${th.btnPrimaryText}` : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {t('Yote')} ({matchingOrders.length + matchingInstallments.length + matchingGroupDeals.length})
              </button>
              {matchingOrders.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('orders')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'orders' ? `${th.btnPrimary} ${th.btnPrimaryText}` : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" /> {t('Maagizo ya Moja kwa Moja')} ({matchingOrders.length})
                </button>
              )}
              {matchingInstallments.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('installments')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'installments' ? `${th.btnPrimary} ${th.btnPrimaryText}` : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <CalendarClock className="w-3.5 h-3.5" /> {t('Lipa Pole Pole')} ({matchingInstallments.length})
                </button>
              )}
              {matchingGroupDeals.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('groups')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'groups' ? `${th.btnPrimary} ${th.btnPrimaryText}` : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" /> {t('Nunua Pamoja')} ({matchingGroupDeals.length})
                </button>
              )}
            </div>
          )}

          {/* 1. LIPA POLE POLE INSTALLMENT RESULTS */}
          {(activeTab === 'all' || activeTab === 'installments') && (singleInstallment || matchingInstallments.length > 0) && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-black text-sky-800">
                <CalendarClock className="w-5 h-5 text-sky-600" /> {t('Mpango wa Lipa Pole Pole (BNPL Installments)')}
              </div>
              <div className="grid gap-3.5">
                {(singleInstallment ? [singleInstallment] : matchingInstallments).map(inst => {
                  const prod = products.find(p => p.id === inst.productId);
                  const isDone = inst.status === 'completed';
                  const progressPct = Math.min(100, Math.round((inst.paidInstallments / inst.installmentsCount) * 100));

                  return (
                    <div key={inst.id} className={`${th.card} ${th.cardBorder} rounded-2xl p-4.5 space-y-3.5 border hover:border-sky-400 transition shadow-sm`}>
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 shrink-0 border border-gray-100">
                            {prod?.image ? <img src={prod.image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-sky-500 flex items-center justify-center text-white font-bold text-lg">{(prod?.name || '-').charAt(0)}</div>}
                          </div>
                          <div>
                            <div className="text-xs font-black text-gray-900 line-clamp-1">{prod?.name}</div>
                            <div className="text-[10px] text-gray-500 font-mono font-bold mt-0.5">Code: {inst.trackingCode} · {inst.customerName}</div>
                            <div className="text-xs font-bold text-sky-700 mt-1">
                              Awamu {inst.paidInstallments} kati ya {inst.installmentsCount} zimekamilika
                            </div>
                          </div>
                        </div>
                        <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${isDone ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'}`}>
                          {isDone ? '✓ Imekamilika' : 'Inaendelea'}
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div>
                        <div className="flex items-center justify-between text-[11px] font-bold text-gray-600 mb-1">
                          <span>TZS {inst.totalPaid.toLocaleString()} zimeshalipwa</span>
                          <span>Baki: <strong className="text-gray-900">TZS {inst.remaining.toLocaleString()}</strong></span>
                        </div>
                        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-sky-500 to-blue-600 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                        </div>
                      </div>

                      {/* Visual Schedule Component */}
                      <div className="pt-2">
                        <InstallmentVisualSchedule
                          order={inst}
                          payments={installmentPayments}
                          theme={theme}
                          t={t}
                          onPayNow={() => handleGo(`/lipa-pole-pole/${inst.trackingCode}`)}
                        />
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
                        <div className="text-[11px] text-gray-500 font-semibold">
                          Kila Awamu: <span className="font-bold text-gray-900">TZS {inst.installmentAmount.toLocaleString()}</span>
                          {inst.nextDueDate && !isDone && ` · Ifuatayo: ${new Date(inst.nextDueDate).toLocaleDateString()}`}
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
            </div>
          )}

          {/* 2. NUNUA PAMOJA (GROUP BUY) RESULTS */}
          {(activeTab === 'all' || activeTab === 'groups') && (singleGroupDeal || matchingGroupDeals.length > 0) && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-black text-indigo-900">
                <Users className="w-5 h-5 text-indigo-600" /> {t('Vikundi vya Nunua Pamoja (Group Buys)')}
              </div>
              <div className="grid gap-3.5 sm:grid-cols-2">
                {(singleGroupDeal ? [singleGroupDeal] : matchingGroupDeals).map(deal => {
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
                        <Share2 className="w-3.5 h-3.5" /> {t('Fungua, Alika & Jiunge')}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. DIRECT ORDERS (STANDARD MARKETPLACE ORDERS) */}
          {(activeTab === 'all' || activeTab === 'orders') && (singleOrder || matchingOrders.length > 0) && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-black text-gray-900">
                <Package className="w-5 h-5 text-gray-700" /> {t('Maagizo ya Moja kwa Moja (Direct Orders)')}
              </div>

              {(singleOrder ? [singleOrder] : matchingOrders).map(order => {
                const company = companies.find(c => c.id === order.companyId);
                return (
                  <div key={order.id} className="space-y-4">
                    <div className={`${th.card} ${th.cardBorder} rounded-2xl p-5 shadow-sm`}>
                      <StatusStepper status={order.status} rejectionReason={order.rejectionReason} t={t} />
                    </div>

                    <div className={`${th.card} ${th.cardBorder} rounded-2xl p-5 shadow-sm`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className={`text-xs font-black ${th.strongText}`}>{t('Order')} {order.orderNumber}</div>
                          <div className={`text-[10px] ${th.textDim} font-semibold mt-0.5 flex items-center gap-1`}>
                            <Calendar className="w-3 h-3" /> {new Date(order.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${milk ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/15 text-amber-300 border border-amber-500/40'}`}>
                          {orderStatusLabel(order.status, t)}
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[11px] font-bold">
                        <span className={`flex items-center gap-1.5 ${th.textMuted}`}>
                          <Store className="w-3.5 h-3.5" />
                          {company ? (
                            <button onClick={() => company.slug && onViewCompany(company.slug)} className={`${th.brandText} hover:underline font-black`}>
                              {company.name}
                            </button>
                          ) : t('Company')}
                        </span>
                        <span className={`flex items-center gap-1.5 ${th.textMuted}`}>
                          <MapPin className="w-3.5 h-3.5" /> {[order.customerRegion, order.customerDistrict, order.customerWard, order.customerStreet].filter(Boolean).join(', ')}
                        </span>
                        <span className={`flex items-center gap-1.5 ${th.textMuted}`}>
                          <Smartphone className="w-3.5 h-3.5" /> {order.customerPhone}
                        </span>
                      </div>
                    </div>

                    {/* Items */}
                    <div className={`${th.card} ${th.cardBorder} rounded-2xl p-5 shadow-sm`}>
                      <h2 className={`text-sm font-black ${th.strongText} mb-3`}>{t('Bidhaa Zilizomo')}</h2>
                      <div className="space-y-3">
                        {(order.items || []).map((it, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-gray-100">
                              {it.productImage ? (
                                <img src={it.productImage} alt={it.productName} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-yellow-400 to-amber-600 text-white text-lg font-black">
                                  {it.productName.charAt(0)}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className={`text-xs font-black ${th.strongText}`}>{it.productName}</div>
                              <div className={`text-[10px] ${th.textDim} font-semibold`}>{TZS(it.unitPrice)} × {it.quantity}</div>
                            </div>
                            <div className={`text-xs font-black ${th.statValue}`}>{TZS(it.subtotal)}</div>
                          </div>
                        ))}
                      </div>
                      <div className={`border-t ${th.border} mt-4 pt-3 flex items-center justify-between`}>
                        <span className={`text-xs font-black ${th.strongText}`}>{t('Total')}</span>
                        <span className={`text-lg font-black ${th.statValue}`}>{TZS(order.totalAmount)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
