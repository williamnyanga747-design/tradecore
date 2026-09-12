import React, { useState } from 'react';
import { ChevronLeft, Search, Package, Store, MapPin, Smartphone, Calendar, FileText } from 'lucide-react';
import { Company, MarketplaceOrder } from '../../types';
import { getPublicTheme, PublicTheme } from '../../utils/publicTheme';
import { safeLower } from '../../utils/stateHelpers';
import { TZS, VerifiedBadge, TFunc, orderStatusLabel } from './MarketplaceShared';
import StatusStepper from './StatusStepper';

interface Props {
  theme: PublicTheme;
  t: TFunc;
  orders: MarketplaceOrder[];
  companies: Company[];
  initialOrderNumber?: string;
  onBack: () => void;
  onViewCompany: (slug: string) => void;
}

export default function MarketplaceTrackOrder({ theme, t, orders, companies, initialOrderNumber, onBack, onViewCompany }: Props) {
  const th = getPublicTheme(theme);
  const milk = theme === 'milk';
  const [q, setQ] = useState(initialOrderNumber || '');
  const [submitted, setSubmitted] = useState(false);

  const order = submitted && q.trim()
    ? orders.find(o => {
        const query = q.trim().toLowerCase();
        return safeLower(o.orderNumber) === query || (o.transactionId && safeLower(o.transactionId) === query);
      })
    : undefined;

  const company = order ? companies.find(c => c.id === order.companyId) : undefined;

  const submit = () => {
    if (!q.trim()) return;
    setSubmitted(true);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      <button onClick={onBack} className={`flex items-center gap-1.5 text-[11px] font-bold ${th.textMuted} hover:underline cursor-pointer`}>
        <ChevronLeft className="w-4 h-4" /> {t('Back')}
      </button>

      <div className="text-center">
        <div className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center ${th.btnPrimary} mb-3`}>
          <Package className={`w-7 h-7 ${th.btnPrimaryText}`} />
        </div>
        <h1 className={`text-xl md:text-2xl font-black ${th.strongText}`}>{t('Track Your Order')}</h1>
        <p className={`text-[11px] ${th.textMuted} font-semibold mt-1`}>{t('Enter your order number or Transaction ID to see its status. No account needed.')}</p>
      </div>

      {/* Search */}
      <div className={`${th.card} ${th.cardBorder} rounded-2xl p-5`}>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${th.textDim}`} />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setSubmitted(false); }}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="e.g. TRD-2026-12345 or SJK2KX9QKL"
              className={th.input + ' pl-9 uppercase'}
            />
          </div>
          <button onClick={submit} className={`flex items-center justify-center gap-2 px-5 py-2.5 text-[11px] font-black rounded-xl transition cursor-pointer ${th.btnPrimary} ${th.btnPrimaryText}`}>
            <Search className="w-3.5 h-3.5" /> {t('Track')}
          </button>
        </div>
        {submitted && q.trim() && !order && (
          <div className="mt-3 text-[11px] font-bold text-red-400 bg-red-500/10 border border-red-500/40 rounded-lg px-3 py-2">
            {t('Hakuna order inayolingana na')} "{q.trim()}". {t('Angalia namba ya order au Transaction ID na ujaribu tena.')}
          </div>
        )}
      </div>

      {order && (
        <div className="space-y-4">
          <div className={`${th.card} ${th.cardBorder} rounded-2xl p-5`}>
            <StatusStepper status={order.status} rejectionReason={order.rejectionReason} t={t} />
          </div>

          {/* Order header */}
          <div className={`${th.card} ${th.cardBorder} rounded-2xl p-5`}>
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
            {order.verifiedBy && (
              <div className={`text-[10px] ${th.textDim} font-semibold mt-2`}>{t('Verified by')} {order.verifiedBy} {order.verifiedAt ? `${t('on')} ${new Date(order.verifiedAt).toLocaleString()}` : ''}</div>
            )}
          </div>

          {/* Items */}
          <div className={`${th.card} ${th.cardBorder} rounded-2xl p-5`}>
            <h2 className={`text-sm font-black ${th.strongText} mb-3`}>{t('Items')}</h2>
            <div className="space-y-3">
              {(order.items || []).map((it, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0">
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
            {order.shippingFee ? (
              <div className={`border-t ${th.border} mt-2 pt-2 flex items-center justify-between`}>
                <span className={`text-[11px] font-bold ${th.textDim}`}>Shipping ({order.shippingZoneName || 'N/A'})</span>
                <span className={`text-xs font-black ${th.strongText}`}>{TZS(order.shippingFee)}</span>
              </div>
            ) : null}
            <div className={`border-t ${th.border} mt-4 pt-3 flex items-center justify-between`}>
              <span className={`text-xs font-black ${th.strongText}`}>{t('Total')}</span>
              <span className={`text-lg font-black ${th.statValue}`}>{TZS(order.totalAmount)}</span>
            </div>
          </div>

          {/* Payment */}
          <div className={`${th.card} ${th.cardBorder} rounded-2xl p-5`}>
            <h2 className={`text-sm font-black ${th.strongText} mb-3 flex items-center gap-1.5`}>
              <FileText className="w-4 h-4" /> {t('Payment')}
            </h2>
            <div className="grid sm:grid-cols-2 gap-3 text-[11px] font-bold">
              <div>
                <span className={`${th.textDim} block`}>{t('Method')}</span>
                <span className={`${th.strongText} uppercase`}>{t(order.paymentMethodType.replace(/_/g, ' '))}</span>
              </div>
              <div>
                <span className={`${th.textDim} block`}>{t('Transaction ID')}</span>
                <span className={`${th.strongText}`}>{order.transactionId}</span>
              </div>
              <div>
                <span className={`${th.textDim} block`}>{t('Amount Paid')}</span>
                <span className={`${th.statValue} font-black`}>{TZS(order.amountPaid)}</span>
              </div>
              {order.customerType === 'account' && (
                <div>
                  <span className={`${th.textDim} block`}>{t('Customer')}</span>
                  <span className={`${th.strongText}`}>{order.customerName} <VerifiedBadge milk={milk} t={t} /></span>
                </div>
              )}
            </div>
            {order.receiptImage && (
              <a href={order.receiptImage} target="_blank" rel="noreferrer" className={`mt-3 inline-block text-[10px] font-bold ${th.brandText} hover:underline`}>
                {t('View receipt screenshot')} →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
