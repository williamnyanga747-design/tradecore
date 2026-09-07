import React, { useMemo, useState } from 'react';
import { ArrowLeft, Camera, CheckCircle2, Coins, BadgePercent, Store, Landmark, Smartphone, Loader2, ShieldCheck, CreditCard, Clock3 } from 'lucide-react';
import { Company, Currency, TradeSubscriptionPlan, CompanySubscription, PayNumbersConfig, TradePlanType } from '../../types';
import { getPublicTheme, PublicTheme } from '../../utils/publicTheme';
import ReceiptCameraModal from '../ReceiptCameraModal';

export interface SubscriptionPaymentData {
  companyId: number;
  planId: number;
  planName: string;
  planSlug: string;
  planType: TradePlanType;
  currencyCode: string;
  exchangeRate: number;
  amountPaid: number;
  amountTzs: number;
  commissionPercentSnapshot: number;
  paymentMethod: string;
  paymentReference: string;
  paymentProof?: string;
}

interface SubscriptionPaymentProps {
  mode: 'renew' | 'pay';
  company: Company;
  currencies: Currency[];
  subscriptionPlans: TradeSubscriptionPlan[];
  companySubscriptions: CompanySubscription[];
  payNumbers: PayNumbersConfig;
  theme: PublicTheme;
  t: (text: string) => string;
  prefillSubscriptionId?: number;
  onSubmitSubscriptionPayment: (data: SubscriptionPaymentData) => { ok: boolean; subscriptionId?: number; error?: string };
  onBack: () => void;
}

export default function SubscriptionPayment({
  mode, company, currencies, subscriptionPlans, companySubscriptions, payNumbers,
  theme, t, prefillSubscriptionId, onSubmitSubscriptionPayment, onBack
}: SubscriptionPaymentProps) {
  const th = getPublicTheme(theme);
  const activeCurrencies = currencies.filter(c => c.isActive);
  const prefillSub = mode === 'pay' && prefillSubscriptionId
    ? companySubscriptions.find(s => s.id === prefillSubscriptionId)
    : undefined;

  const [currencyCode, setCurrencyCode] = useState<string>(prefillSub?.currencyCode || activeCurrencies[0]?.code || 'TZS');
  const selectedCurrency = activeCurrencies.find(c => c.code === currencyCode) || activeCurrencies[0];
  const currencyRate = selectedCurrency?.exchangeRate || 1;

  const activePlans = useMemo(() => subscriptionPlans.filter(p => p.isActive), [subscriptionPlans]);
  const [planId, setPlanId] = useState<number>(prefillSub?.planId || activePlans[0]?.id || 0);
  const selectedPlan = activePlans.find(p => p.id === planId) || activePlans[0];

  const [paymentMethod, setPaymentMethod] = useState('M-Pesa');
  const [paymentReference, setPaymentReference] = useState(prefillSub?.paymentReference || '');
  const [receiptImageUrl, setReceiptImageUrl] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ reference: string; planName: string; amount: number; currency: string } | null>(null);

  const planPrice = (plan: TradeSubscriptionPlan): string => {
    if (!selectedCurrency || selectedCurrency.code === 'TZS') {
      return `TZS ${Math.round(plan.basePriceTZS).toLocaleString('en-US')}`;
    }
    const conv = plan.basePriceTZS / currencyRate;
    return `${selectedCurrency.symbol} ${conv.toLocaleString('en-US', { maximumFractionDigits: 2 })} (~TZS ${Math.round(plan.basePriceTZS).toLocaleString('en-US')})`;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    if (!selectedPlan) {
      setError(t('No subscription plan available. Contact support.'));
      return;
    }
    if (!paymentReference.trim()) {
      setError(t('Payment reference / transaction ID is required'));
      return;
    }
    setSubmitting(true);
    try {
      const amountPaid = selectedCurrency && selectedCurrency.code !== 'TZS'
        ? Math.round(selectedPlan.basePriceTZS / currencyRate)
        : selectedPlan.basePriceTZS;
      const res = onSubmitSubscriptionPayment({
        companyId: company.id,
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        planSlug: selectedPlan.slug,
        planType: selectedPlan.type,
        currencyCode: selectedCurrency?.code || 'TZS',
        exchangeRate: currencyRate,
        amountPaid,
        amountTzs: selectedPlan.basePriceTZS,
        commissionPercentSnapshot: selectedPlan.commissionPercent,
        paymentMethod,
        paymentReference: paymentReference.trim(),
        paymentProof: receiptImageUrl || undefined
      });
      if (!res.ok) {
        setError(res.error || t('Something went wrong submitting the payment. Please try again.'));
        return;
      }
      setDone({ reference: paymentReference.trim(), planName: selectedPlan.name, amount: amountPaid, currency: selectedCurrency?.code || 'TZS' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = `w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-amber-500/40`;

  if (done) {
    return (
      <div className={`max-w-xl mx-auto ${th.card} ${th.cardBorder} rounded-2xl p-7 text-center`}>
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-9 h-9" />
        </div>
        <h2 className={`text-lg font-black mt-4 ${th.strongText}`}>{t('Payment Request Received')}</h2>
        <p className={`text-xs ${th.textMuted} font-semibold mt-2 leading-relaxed`}>
          {t('Thank you! Your subscription payment request has been submitted. The Super Admin will verify your payment and activate the subscription for')} <span className="font-black">{company.name}</span>.
        </p>
        <div className={`mt-4 rounded-xl border ${th.cardBorder} p-4 text-left space-y-1.5 text-xs`}>
          <div className="flex justify-between gap-3"><span className={`${th.textMuted} font-semibold`}>{t('Plan')}</span><span className="font-black">{done.planName}</span></div>
          <div className="flex justify-between gap-3"><span className={`${th.textMuted} font-semibold`}>{t('Amount')}</span><span className="font-black">{done.currency} {Number(done.amount).toLocaleString()}</span></div>
          <div className="flex justify-between gap-3"><span className={`${th.textMuted} font-semibold`}>{t('Reference')}</span><span className="font-black font-mono">{done.reference}</span></div>
          <div className="flex justify-between gap-3"><span className={`${th.textMuted} font-semibold`}>{t('Status')}</span><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">{t('Pending Verification')}</span></div>
        </div>
        <button onClick={onBack} className={`mt-5 px-5 py-2.5 text-xs font-black rounded-xl ${th.btnPrimary} ${th.btnPrimaryText} cursor-pointer`}>
          {t('Back to Store')}
        </button>
      </div>
    );
  }

  return (
    <div className={`max-w-2xl mx-auto ${th.card} ${th.cardBorder} rounded-2xl overflow-hidden`}>
      <div className={`px-5 py-4 border-b ${th.cardBorder} flex items-center justify-between gap-3`}>
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${mode === 'renew' ? 'bg-amber-100 text-amber-600' : 'bg-purple-100 text-purple-600'}`}>
            {mode === 'renew' ? <Clock3 className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <h1 className={`text-sm font-black ${th.strongText} truncate`}>{mode === 'renew' ? t('Renew Subscription') : t('Complete Subscription Payment')}</h1>
            <div className={`text-[11px] ${th.textMuted} font-semibold truncate`}>{company.name} · {company.region || '—'}</div>
          </div>
        </div>
        <button onClick={onBack} className={`px-3 py-1.5 text-[10px] font-bold rounded-lg ${th.btnSecondary} ${th.btnSecondaryText} inline-flex items-center gap-1 cursor-pointer`}>
          <ArrowLeft className="w-3.5 h-3.5" /> {t('Back')}
        </button>
      </div>

      <form onSubmit={submit} className="p-5 space-y-4">
        {prefillSub && (
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-3 text-[11px] font-semibold text-purple-800">
            <div className="flex items-center gap-1.5 font-black uppercase tracking-wider mb-1"><CreditCard className="w-3.5 h-3.5" /> {t('Existing Payment Request')} #{prefillSub.id}</div>
            <div className="flex justify-between gap-2"><span className="text-purple-600">{prefillSub.planName}</span><span className="font-black">{prefillSub.currencyCode} {Number(prefillSub.amountPaid || 0).toLocaleString()}</span></div>
            <div className="mt-1"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${prefillSub.status === 'pending' ? 'bg-amber-100 text-amber-800' : prefillSub.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{prefillSub.status}</span></div>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-[11px] font-semibold text-red-700">{error}</div>
        )}

        {/* Official Pay Numbers */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
          <div className="flex items-center gap-2 text-[11px] font-black text-amber-800 uppercase tracking-wider">
            <Smartphone className="w-4 h-4" />
            {t('Pay To These Official Numbers')}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
            <div className="bg-white rounded-lg p-2 border border-amber-100">
              <span className="block text-[9px] text-gray-400 font-bold uppercase">M-Pesa</span>
              <span className="font-black text-amber-900 font-mono">{payNumbers.mpesa || '- - -'}</span>
            </div>
            <div className="bg-white rounded-lg p-2 border border-amber-100">
              <span className="block text-[9px] text-gray-400 font-bold uppercase">TigoPesa</span>
              <span className="font-black text-amber-900 font-mono">{payNumbers.tigopesa || '- - -'}</span>
            </div>
            <div className="bg-white rounded-lg p-2 border border-amber-100">
              <span className="block text-[9px] text-gray-400 font-bold uppercase">Airtel Money</span>
              <span className="font-black text-amber-900 font-mono">{payNumbers.airtel || '- - -'}</span>
            </div>
            <div className="bg-white rounded-lg p-2 border border-amber-100">
              <span className="block text-[9px] text-gray-400 font-bold uppercase">{t('Bank')}</span>
              <span className="font-black text-amber-900">{payNumbers.bankName}</span>
            </div>
          </div>
          <div className="bg-white rounded-lg p-2 border border-amber-100 text-[10px] text-amber-800 font-semibold">
            <span className="flex items-center gap-1"><Landmark className="w-3.5 h-3.5" /> {payNumbers.bankName}: {payNumbers.bankAccount} — {payNumbers.bankHolder}</span>
          </div>
          {payNumbers.instructions && (
            <p className="text-[10px] text-amber-700 font-semibold leading-relaxed">{payNumbers.instructions}</p>
          )}
        </div>

        {/* Billing currency */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400 block tracking-wider uppercase">{t('Billing Currency')}</label>
          <div className="flex items-center gap-2">
            <Coins className={`w-4 h-4 ${th.brandText}`} />
            <select value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)} className={inputCls}>
              {activeCurrencies.map(c => (
                <option key={c.id} value={c.code}>
                  {c.name} ({c.code}) — {c.code === 'TZS' ? 'base' : `1 ${c.code} = ${c.exchangeRate} TZS`}
                </option>
              ))}
            </select>
          </div>
          <p className="text-[9px] text-gray-400 font-semibold">{t('Plan prices convert to your billing currency automatically.')}</p>
        </div>

        {/* Plan selection */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400 block tracking-wider uppercase">{t('Subscription Plan Tier')}</label>
          {activePlans.length === 0 ? (
            <div className={`rounded-xl border ${th.cardBorder} p-4 text-xs ${th.textMuted} font-semibold text-center`}>
              {t('No subscription plans are currently available. Contact support.')}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-2">
              {activePlans.map(plan => (
                <label
                  key={plan.id}
                  className={`text-left p-3 rounded-xl border transition cursor-pointer block ${
                    planId === plan.id ? 'border-amber-500 bg-amber-400/10 ring-2 ring-amber-500/30' : 'border-gray-200 hover:border-amber-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <input type="radio" name="trade-plan" checked={planId === plan.id} onChange={() => setPlanId(plan.id)} className="mt-0.5 w-4 h-4 accent-amber-500" />
                      <div className="min-w-0">
                        <span className="text-xs font-black text-gray-800 block">{plan.name}</span>
                        <span className={`inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-full mt-1 ${plan.type === 'direct' ? 'bg-emerald-100 text-emerald-700' : 'bg-purple-100 text-purple-700'}`}>
                          {plan.type === 'direct' ? <Store className="w-3 h-3" /> : <BadgePercent className="w-3 h-3" />}
                          {plan.type === 'direct' ? t('Direct — Pay Seller') : `${t('Commission')} ${plan.commissionPercent}%`}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className={`text-sm font-black ${th.brandText} mt-1.5`}>{planPrice(plan)}</div>
                  <div className="text-[10px] text-gray-400 font-semibold">{plan.durationDays || 30} {t('days access')} · {plan.maxProducts} {t('products')}</div>
                  <div className="mt-2 space-y-1">
                    {(plan.features || []).slice(0, 4).map((f, i) => (
                      <div key={i} className="flex items-start gap-1 text-[10px] text-gray-500 font-medium">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </label>
              ))}
            </div>
          )}
          <p className="text-[9px] text-gray-400 font-semibold">
            {t('Biashara Direct: customers pay you directly via WhatsApp — no platform commission. Biashara Commission: customers pay through the platform and the platform commission is deducted.')}
          </p>
        </div>

        {/* Payment details */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 block tracking-wider uppercase">{t('Payment Method')}</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputCls}>
              <option>M-Pesa</option>
              <option>TigoPesa</option>
              <option>Airtel Money</option>
              <option>Bank Wire Transfer</option>
              <option>International Bank Wire</option>
              <option>PayPal</option>
              <option>Direct Cash</option>
              <option>Credit Card</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 block tracking-wider uppercase">{t('Payment Reference / Transaction ID')}</label>
            <input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} className={inputCls} placeholder="e.g. SDR93LXM2A" />
          </div>
        </div>

        {/* Receipt capture */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400 block tracking-wider uppercase">{t('Payment Receipt Photo (Optional)')}</label>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setShowCamera(true)} className="flex items-center gap-1.5 px-3 py-2 bg-[#2d323e] text-white text-[11px] font-bold rounded-lg cursor-pointer">
              <Camera className="w-4 h-4" />
              {t('Capture / Upload Receipt')}
            </button>
            {receiptImageUrl && (
              <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {t('Receipt attached')}
                <button type="button" onClick={() => setReceiptImageUrl('')} className="text-red-500 underline cursor-pointer">{t('Remove')}</button>
              </div>
            )}
          </div>
          {receiptImageUrl && (
            <img src={receiptImageUrl} alt="Receipt" className="mt-2 w-40 h-28 object-cover rounded-lg border border-gray-200" />
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            {t('Your payment is verified manually by the Super Admin before activation.')}
          </div>
          <button
            type="submit"
            disabled={submitting || activePlans.length === 0}
            className={`px-5 py-2.5 ${th.btnPrimary} ${th.btnPrimaryText} disabled:opacity-50 text-xs font-black rounded-xl uppercase tracking-wider shadow cursor-pointer transition inline-flex items-center gap-2`}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
            {submitting ? t('Submitting…') : t('Submit Payment')}
          </button>
        </div>
      </form>

      <ReceiptCameraModal open={showCamera} onClose={() => setShowCamera(false)} onCapture={(dataUrl) => setReceiptImageUrl(dataUrl)} translate={t} />
    </div>
  );
}
