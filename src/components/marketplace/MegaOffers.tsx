import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft, HandCoins, Clock, CheckCircle2, XCircle, Zap, RefreshCw,
  Phone, Search, ShoppingBag, ShieldCheck, ArrowRight, MessageCircle, ExternalLink
} from 'lucide-react';
import { Company, MarketplaceProduct, Offer, CollectionSetting, CollectionNetwork } from '../../types';
import { getPublicTheme, PublicTheme } from '../../utils/publicTheme';
import { TZS, TFunc } from './MarketplaceShared';
import { PaymentModal } from './MarketplacePhase2C';

interface Props {
  theme: PublicTheme;
  t: TFunc;
  offers: Offer[];
  products: MarketplaceProduct[];
  companies: Company[];
  identityPhone: string | null;
  collectionSettings?: CollectionSetting[];
  onBack: () => void;
  onOpenProduct: (p: MarketplaceProduct) => void;
  onOpenOffer: (offerId: number) => void;
  onAcceptCounter: (offerId: number) => { ok: boolean; error?: string };
  onRejectCounter: (offerId: number) => { ok: boolean; error?: string };
  onCounterAgain: (offerId: number, price: number, message?: string) => { ok: boolean; error?: string };
  onInitiateOfferPayment?: (offerId: number, address: {
    customerName?: string;
    customerPhone?: string;
    customerRegion?: string;
    customerDistrict?: string;
    customerWard?: string;
    customerStreet?: string;
    transactionId?: string;
    receiptImage?: string;
  }, network?: CollectionNetwork) => { ok: boolean; reference?: string; orderId?: number | null; error?: string };
}

const normalizePhone = (phone: string): string => {
  const digits = (phone || '').replace(/[^0-9]/g, '');
  if (digits.startsWith('255')) return `+${digits}`;
  if (digits.startsWith('0')) return `+255${digits.slice(1)}`;
  if (digits.length === 9) return `+255${digits}`;
  return phone.startsWith('+') ? phone : (digits ? `+${digits}` : '');
};

export default function MegaOffers({
  theme, t, offers, products, companies, identityPhone, collectionSettings,
  onBack, onOpenProduct, onOpenOffer,
  onAcceptCounter, onRejectCounter, onCounterAgain, onInitiateOfferPayment
}: Props) {
  const th = getPublicTheme(theme);
  const milk = theme === 'milk';
  const [, setTick] = useState(0);

  // Auto refresh every 20 seconds so seller counters/acceptances show up
  useEffect(() => {
    const iv = window.setInterval(() => setTick(x => x + 1), 20000);
    return () => window.clearInterval(iv);
  }, []);

  // Phone lookup state
  const initialPhone = identityPhone || (typeof window !== 'undefined' ? localStorage.getItem('tradecore_buyer_phone') : '') || '';
  const [activePhone, setActivePhone] = useState(initialPhone);
  const [phoneInput, setPhoneInput] = useState(initialPhone);
  const [isChangingPhone, setIsChangingPhone] = useState(!initialPhone);

  const [counterFor, setCounterFor] = useState<number | null>(null);
  const [counterPrice, setCounterPrice] = useState('');
  const [counterMsg, setCounterMsg] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [payingOffer, setPayingOffer] = useState<Offer | null>(null);

  // Handle phone submission
  const handleApplyPhone = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = phoneInput.trim().replace(/\s/g, '');
    if (!clean) {
      setErr(t('Tafadhali weka namba yako ya simu.'));
      return;
    }
    const normalized = normalizePhone(clean);
    setActivePhone(normalized);
    try {
      localStorage.setItem('tradecore_buyer_phone', normalized);
    } catch {}
    setIsChangingPhone(false);
    setErr('');
  };

  // Filter offers belonging to this customer
  const myOffers = useMemo(() => {
    if (!activePhone) return [];
    const norm = normalizePhone(activePhone);
    const last9 = norm.replace(/\D/g, '').slice(-9);

    return offers
      .filter(o => {
        const oNorm = normalizePhone(o.customerPhone);
        const oLast9 = oNorm.replace(/\D/g, '').slice(-9);
        return (last9 && oLast9 && last9 === oLast9) || oNorm === norm || o.customerPhone === activePhone;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [offers, activePhone]);

  const badge = (o: Offer): { emoji: string; label: string; cls: string } | null => {
    const isStale = new Date(o.expiresAt).getTime() <= Date.now();
    switch (isStale && (o.status === 'pending' || o.status === 'countered') ? 'expired' : o.status) {
      case 'pending':
        return { emoji: '🟡', label: t('Inasubiri Muuzaji'), cls: milk ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-amber-500/15 text-amber-400 border border-amber-500/30' };
      case 'accepted':
        return { emoji: '🟢', label: t('Muuzaji Amekubali! Lipa Sasa'), cls: milk ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-green-500/15 text-green-400 border border-green-500/30' };
      case 'rejected':
        return { emoji: '🔴', label: t('Imekataliwa'), cls: milk ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-red-500/15 text-red-400 border border-red-500/30' };
      case 'countered':
        return { emoji: '🔵', label: t('Ofa Mpya ya Muuzaji (Punguzo)'), cls: milk ? 'bg-sky-100 text-sky-800 border border-sky-200' : 'bg-sky-500/15 text-sky-400 border border-sky-500/30' };
      case 'expired':
        return { emoji: '⚪', label: t('Muda Umeisha'), cls: milk ? 'bg-gray-100 text-gray-600 border border-gray-200' : 'bg-gray-500/15 text-gray-400 border border-gray-500/30' };
      case 'paid':
        return { emoji: '✅', label: t('Imelipwa Kamili'), cls: milk ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' };
      default:
        return null;
    }
  };

  const act = (res: { ok: boolean; error?: string }, okText: string) => {
    if (res.ok) {
      setMsg(okText);
      setErr('');
      setCounterFor(null);
      setCounterPrice('');
      setCounterMsg('');
    } else {
      setErr(res.error || t('Imeshindikana.'));
    }
    window.setTimeout(() => { setMsg(''); setErr(''); }, 4500);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-16">
      <button onClick={onBack} className={`flex items-center gap-1.5 text-xs font-bold ${th.textMuted} hover:underline cursor-pointer`}>
        <ChevronLeft className="w-4 h-4" /> {t('Back to Marketplace')}
      </button>

      {/* Header banner */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className={`text-lg md:text-xl font-black flex items-center gap-2 ${th.strongText}`}>
            <HandCoins className="w-5 h-5 text-orange-500" /> {t('Ofa Zangu & Mazungumzo ya Bei (Piga Bei)')}
          </h1>
          <p className={`text-[11px] ${th.textDim} font-semibold mt-0.5`}>
            {t('Fuatilia majibu ya wauzaji, kubali punguzo jipya, na kamilisha ununuzi wa bidhaa ulizojadili.')}
          </p>
        </div>
        <button
          onClick={() => setTick(x => x + 1)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-xl cursor-pointer ${th.btnSecondary} ${th.btnSecondaryText} transition shadow-sm`}
        >
          <RefreshCw className="w-3.5 h-3.5" /> {t('Refresh')}
        </button>
      </div>

      {msg && <div className="text-xs font-black text-emerald-600 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3.5 py-2.5">{msg}</div>}
      {err && <div className="text-xs font-black text-red-600 bg-red-500/10 border border-red-500/30 rounded-xl px-3.5 py-2.5">{err}</div>}

      {/* Customer Phone Identity Card */}
      <div className={`${th.card} ${th.cardBorder} rounded-2xl p-4 shadow-sm`}>
        {(!activePhone || isChangingPhone) ? (
          <form onSubmit={handleApplyPhone} className="space-y-3">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-orange-500" />
              <span className={`text-xs font-black ${th.strongText}`}>
                {t('Weka namba yako ya simu kuona ofa zako zote')}:
              </span>
            </div>
            <div className="flex gap-2 flex-wrap sm:flex-nowrap">
              <input
                value={phoneInput}
                onChange={e => setPhoneInput(e.target.value)}
                placeholder="07XX XXX XXX au +255 7XX XXX XXX"
                className={`flex-1 ${th.input}`}
                autoFocus
              />
              <button
                type="submit"
                className={`px-5 py-2 text-xs font-black rounded-xl ${th.btnPrimary} ${th.btnPrimaryText} cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap shadow-sm`}
              >
                <Search className="w-3.5 h-3.5" /> {t('Tafuta Ofa Zangu')}
              </button>
              {activePhone && (
                <button
                  type="button"
                  onClick={() => setIsChangingPhone(false)}
                  className={`px-3 py-2 text-xs font-bold rounded-xl ${th.btnSecondary} ${th.btnSecondaryText} cursor-pointer`}
                >
                  {t('Ghairi')}
                </button>
              )}
            </div>
            <p className={`text-[10px] ${th.textDim} font-semibold`}>
              {t('Tumia namba uliyotumia wakati wa kupiga bei ili kuona ofa na majibu yote ya wauzaji.')}
            </p>
          </form>
        ) : (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-xs">
                <Phone className="w-4 h-4" />
              </div>
              <div>
                <div className={`text-xs font-bold ${th.textMuted}`}>{t('Inaangalia ofa za namba')}:</div>
                <div className={`text-sm font-black ${th.strongText}`}>{activePhone}</div>
              </div>
            </div>
            <button
              onClick={() => { setPhoneInput(activePhone); setIsChangingPhone(true); }}
              className={`text-xs font-black px-3 py-1.5 rounded-lg cursor-pointer ${th.btnSecondary} ${th.btnSecondaryText} transition`}
            >
              {t('Badilisha Namba')}
            </button>
          </div>
        )}
      </div>

      {/* Offers list */}
      {activePhone && myOffers.length === 0 && (
        <div className={`${th.card} ${th.cardBorder} rounded-2xl p-10 text-center space-y-3`}>
          <HandCoins className={`w-12 h-12 mx-auto ${th.textDim}`} />
          <div className={`text-sm font-black ${th.strongText}`}>{t('Hakuna ofa bado kwa namba hii')}</div>
          <div className={`text-xs ${th.textMuted} font-semibold max-w-md mx-auto`}>
            {t('Hujatuma ofa yoyote bado au namba hii haina ofa zinazoendelea. Fungua bidhaa yoyote dukani kisha bonyeza "Piga Bei" ili kuanza mazungumzo na muuzaji.')}
          </div>
          <button
            onClick={onBack}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black rounded-xl cursor-pointer ${th.btnPrimary} ${th.btnPrimaryText} mt-2`}
          >
            <ShoppingBag className="w-4 h-4" /> {t('Tazama Bidhaa za Sokoni')}
          </button>
        </div>
      )}

      <div className="space-y-3">
        {myOffers.map(o => {
          const product = products.find(p => p.id === o.productId);
          const company = companies.find(c => c.id === o.companyId);
          const b = badge(o);
          const finalPrice = o.finalPrice ?? o.counterPrice ?? o.offeredPrice;
          const discount = Math.round(((o.originalPrice - o.offeredPrice) / o.originalPrice) * 100);

          return (
            <div key={o.id} className={`${th.card} ${th.cardBorder} rounded-2xl p-4 md:p-5 space-y-3 shadow-sm hover:border-amber-400 transition`}>
              {/* Row: product image | prices | status */}
              <div className="flex items-start gap-3">
                <button
                  onClick={() => product && onOpenProduct(product)}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden shrink-0 cursor-pointer shadow-inner"
                >
                  {product?.image ? (
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-yellow-400 to-amber-600 text-white font-black text-xl">
                      {(product?.name || '?').charAt(0)}
                    </div>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs sm:text-sm font-black truncate ${th.strongText}`}>
                      {product?.name || `#${o.productId}`}
                    </span>
                    {b && <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${b.cls}`}>{b.emoji} {b.label}</span>}
                  </div>
                  <div className={`text-xs font-semibold ${th.textMuted} mt-0.5`}>{company?.name || ''}</div>

                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <div>
                      <div className={`text-[9px] font-bold uppercase ${th.textDim}`}>{t('Bei Halisi')}</div>
                      <div className={`text-xs font-bold line-through ${th.textMuted}`}>{TZS(o.originalPrice)}</div>
                    </div>
                    <div>
                      <div className={`text-[9px] font-bold uppercase ${th.textDim}`}>{t('Ofa Yako')}</div>
                      <div className={`text-sm font-black ${th.statValue}`}>
                        {TZS(o.offeredPrice)} <span className="text-[10px] text-orange-500">(-{discount}%)</span>
                      </div>
                    </div>
                    {(o.status === 'countered' || ((o.status === 'accepted' || o.status === 'paid') && o.counterPrice)) && (
                      <div>
                        <div className={`text-[9px] font-bold uppercase ${th.textDim}`}>{t('Bei ya Muuzaji')}</div>
                        <div className="text-sm font-black text-sky-500">{TZS(o.counterPrice!)}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Messages exchange */}
              {o.buyerMessage && (
                <div className={`text-xs font-semibold rounded-xl px-3 py-2 ${milk ? 'bg-amber-50 text-amber-900 border border-amber-200' : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'}`}>
                  💬 <span className="font-bold">{t('Ujumbe wako')}:</span> {o.buyerMessage}
                </div>
              )}

              {o.sellerMessage && (o.status === 'rejected' || o.status === 'countered' || o.status === 'accepted') && (
                <div className={`text-xs font-semibold rounded-xl px-3 py-2 ${milk ? 'bg-blue-50 text-blue-900 border border-blue-200' : 'bg-blue-500/10 text-blue-300 border border-blue-500/20'}`}>
                  💬 <span className="font-bold">{t('Jibu la Muuzaji')}:</span> {o.sellerMessage}
                </div>
              )}

              {/* Expiry alerts */}
              {(o.status === 'pending' || o.status === 'countered') && (
                <div className={`flex items-center gap-1.5 text-[11px] font-bold ${th.textMuted}`}>
                  <Clock className="w-3.5 h-3.5" /> {t('Ofa hii inaisha mnamo')}: {new Date(o.expiresAt).toLocaleString()}
                </div>
              )}
              {o.status === 'accepted' && o.acceptedExpiresAt && (
                <div className={`flex items-center gap-1.5 text-[11px] font-black ${milk ? 'text-green-700' : 'text-green-400'}`}>
                  <Clock className="w-3.5 h-3.5" /> {t('Tafadhali kamilisha malipo kabla ya')}: {new Date(o.acceptedExpiresAt).toLocaleString()}
                </div>
              )}

              {/* ACTION BUTTONS PER STATUS */}
              <div className="pt-2 border-t border-gray-100 flex flex-wrap gap-2 items-center">
                {/* 1. Accepted: Customer buys at negotiated price */}
                {o.status === 'accepted' && (
                  <button
                    onClick={() => {
                      if (onInitiateOfferPayment) {
                        setPayingOffer(o);
                      } else {
                        onOpenOffer(o.id);
                      }
                    }}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs font-black rounded-xl cursor-pointer ${th.btnPrimary} ${th.btnPrimaryText} shadow-md hover:scale-102 transition active:scale-98`}
                  >
                    <Zap className="w-4 h-4" /> {t('Nunua Sasa kwa Bei ya Mazungumzo')} — {TZS(finalPrice)}
                  </button>
                )}

                {/* 2. Countered: Customer responds */}
                {o.status === 'countered' && (
                  <>
                    <button
                      onClick={() => act(onAcceptCounter(o.id), t('Umekubali bei ya muuzaji! Sasa unaweza kukamilisha malipo.'))}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black rounded-xl cursor-pointer bg-green-600 text-white hover:bg-green-700 shadow-sm transition"
                    >
                      <CheckCircle2 className="w-4 h-4" /> {t('Kubali Bei ya Muuzaji')} ({TZS(o.counterPrice || 0)})
                    </button>
                    <button
                      onClick={() => { setCounterFor(counterFor === o.id ? null : o.id); setCounterPrice(''); setCounterMsg(''); }}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black rounded-xl cursor-pointer ${th.btnSecondary} ${th.btnSecondaryText} transition`}
                    >
                      <HandCoins className="w-4 h-4" /> {t('Piga Bei Nyingine')}
                    </button>
                    <button
                      onClick={() => act(onRejectCounter(o.id), t('Umekataa pendekezo la muuzaji.'))}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl cursor-pointer bg-gray-100 text-red-600 hover:bg-red-50 border border-red-200 transition"
                    >
                      <XCircle className="w-4 h-4" /> {t('Kataa')}
                    </button>
                  </>
                )}

                {/* 3. Rejected: Allow renegotiating */}
                {o.status === 'rejected' && product && (
                  <button
                    onClick={() => onOpenProduct(product)}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black rounded-xl cursor-pointer ${th.btnSecondary} ${th.btnSecondaryText} transition`}
                  >
                    <HandCoins className="w-4 h-4" /> {t('Jadili Upya kwa Bei Tofauti')}
                  </button>
                )}

                {/* 4. Paid: Show confirmation */}
                {o.status === 'paid' && (
                  <div className="flex items-center gap-2 text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 flex-wrap">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{t('Malipo yamekamilika! Ref')}: {o.paymentReference || 'N/A'}</span>
                    {o.transactionId && <span className="font-mono text-gray-500 font-bold ml-1">· Tx: {o.transactionId}</span>}
                  </div>
                )}
              </div>

              {/* Inline Counter Again form */}
              {counterFor === o.id && (
                <div className={`rounded-xl border p-3.5 space-y-2.5 ${th.cardBorder} ${milk ? 'bg-gray-50' : 'bg-white/5'} mt-2`}>
                  <div className={`text-xs font-black ${th.strongText}`}>{t('Weka pendekezo lako jipya la bei')}:</div>
                  <input
                    value={counterPrice}
                    onChange={e => setCounterPrice(e.target.value.replace(/[^\d]/g, ''))}
                    placeholder={t('Bei yako mpya (TZS)')}
                    type="number"
                    className={th.input}
                  />
                  <input
                    value={counterMsg}
                    onChange={e => setCounterMsg(e.target.value)}
                    placeholder={t('Ujumbe kwa muuzaji (si lazima)')}
                    maxLength={300}
                    className={th.input}
                  />
                  <button
                    onClick={() => act(onCounterAgain(o.id, Number(counterPrice), counterMsg.trim() || undefined), t('Bei mpya imetumwa kwa muuzaji!'))}
                    disabled={!Number(counterPrice)}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-black rounded-xl cursor-pointer disabled:opacity-40 ${th.btnPrimary} ${th.btnPrimaryText} transition shadow-sm`}
                  >
                    <HandCoins className="w-4 h-4" /> {t('Tuma Bei Mpya')}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* PaymentModal for accepted offer in MegaOffers */}
      {payingOffer && onInitiateOfferPayment && (
        <PaymentModal
          th={th} t={t} milk={milk}
          title={`${t('Piga Bei')} — Malipo ya Makubaliano`}
          amount={payingOffer.finalPrice || payingOffer.counterPrice || payingOffer.offeredPrice}
          prefillName={payingOffer.customerName}
          prefillPhone={payingOffer.customerPhone}
          networks={collectionSettings || []}
          note={t('Malipo yanaingia moja kwa moja kwenye mfumo na muuzaji anajulishwa papo hapo kuandaa agizo lako.')}
          onClose={() => setPayingOffer(null)}
          onPay={(input) => onInitiateOfferPayment(payingOffer.id, input, input.network)}
        />
      )}
    </div>
  );
}
