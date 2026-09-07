import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, HandCoins, Clock, CheckCircle2, XCircle, Zap, RefreshCw } from 'lucide-react';
import { Company, MarketplaceProduct, Offer } from '../../types';
import { getPublicTheme, PublicTheme } from '../../utils/publicTheme';
import { TZS, TFunc } from './MarketplaceShared';

interface Props {
  theme: PublicTheme;
  t: TFunc;
  offers: Offer[];
  products: MarketplaceProduct[];
  companies: Company[];
  identityPhone: string | null;
  onBack: () => void;
  onOpenProduct: (p: MarketplaceProduct) => void;
  onOpenOffer: (offerId: number) => void;
  onAcceptCounter: (offerId: number) => { ok: boolean; error?: string };
  onRejectCounter: (offerId: number) => { ok: boolean; error?: string };
  onCounterAgain: (offerId: number, price: number, message?: string) => { ok: boolean; error?: string };
}

const normalizePhone = (phone: string): string => {
  const digits = (phone || '').replace(/[^0-9]/g, '');
  if (digits.startsWith('255')) return `+${digits}`;
  if (digits.startsWith('0')) return `+255${digits.slice(1)}`;
  if (digits.length === 9) return `+255${digits}`;
  return phone.startsWith('+') ? phone : `+${digits}`;
};

// MEGA CRITICAL FIX 2-in-1 PART 1 — buyer "Ofa Zangu" page.
// Every offer shows a clear status badge + the actions that match its state,
// and the list auto-refreshes every 30 seconds so seller feedback is never missed.
export default function MegaOffers({
  theme, t, offers, products, companies, identityPhone,
  onBack, onOpenProduct, onOpenOffer,
  onAcceptCounter, onRejectCounter, onCounterAgain
}: Props) {
  const th = getPublicTheme(theme);
  const milk = theme === 'milk';
  const [, setTick] = useState(0);
  // spec: auto refresh every 30 sec
  useEffect(() => {
    const iv = window.setInterval(() => setTick(x => x + 1), 30000);
    return () => window.clearInterval(iv);
  }, []);

  const [counterFor, setCounterFor] = useState<number | null>(null);
  const [counterPrice, setCounterPrice] = useState('');
  const [counterMsg, setCounterMsg] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const myPhone = identityPhone ? normalizePhone(identityPhone) : '';
  const myOffers = useMemo(() =>
    offers
      .filter(o => normalizePhone(o.customerPhone) === myPhone)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [offers, myPhone]);

  const badge = (o: Offer): { emoji: string; label: string; cls: string } | null => {
    const isStale = new Date(o.expiresAt).getTime() <= Date.now();
    switch (isStale && (o.status === 'pending' || o.status === 'countered') ? 'expired' : o.status) {
      case 'pending': return { emoji: '🟡', label: t('Inasubiri Muuzaji'), cls: milk ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-amber-500/15 text-amber-400 border border-amber-500/30' };
      case 'accepted': return { emoji: '🟢', label: t('Muuzaji Amekubali! Nunua sasa'), cls: milk ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-green-500/15 text-green-400 border border-green-500/30' };
      case 'rejected': return { emoji: '🔴', label: t('Imekataliwa'), cls: milk ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-red-500/15 text-red-400 border border-red-500/30' };
      case 'countered': return { emoji: '🔵', label: t('Ofa Nyingine ya Muuzaji'), cls: milk ? 'bg-sky-100 text-sky-800 border border-sky-200' : 'bg-sky-500/15 text-sky-400 border border-sky-500/30' };
      case 'expired': return { emoji: '⚪', label: t('Muda Umeisha'), cls: milk ? 'bg-gray-100 text-gray-600 border border-gray-200' : 'bg-gray-500/15 text-gray-400 border border-gray-500/30' };
      case 'paid': return { emoji: '✅', label: t('Imelipwa'), cls: milk ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' };
      default: return null;
    }
  };

  const act = (res: { ok: boolean; error?: string }, okText: string) => {
    if (res.ok) { setMsg(okText); setErr(''); setCounterFor(null); setCounterPrice(''); setCounterMsg(''); }
    else { setErr(res.error || t('Imeshindikana.')); }
    window.setTimeout(() => { setMsg(''); setErr(''); }, 4000);
  };

  if (!identityPhone) {
    return (
      <div className="max-w-md mx-auto space-y-5 pb-16">
        <button onClick={onBack} className={`flex items-center gap-1.5 text-[11px] font-bold ${th.textMuted} hover:underline cursor-pointer`}>
          <ChevronLeft className="w-4 h-4" /> {t('Back to Marketplace')}
        </button>
        <div className={`${th.card} ${th.cardBorder} rounded-2xl p-8 text-center`}>
          <HandCoins className="w-10 h-10 mx-auto mb-3 text-amber-500" />
          <div className={`text-sm font-black ${th.strongText}`}>{t('Ofa Zangu')}</div>
          <div className={`text-[11px] ${th.textMuted} font-semibold mt-1`}>
            {t('Ingiza namba yako ya simu kuona ofa zako zote na majibu ya wauzaji.')}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-16">
      <button onClick={onBack} className={`flex items-center gap-1.5 text-[11px] font-bold ${th.textMuted} hover:underline cursor-pointer`}>
        <ChevronLeft className="w-4 h-4" /> {t('Back to Marketplace')}
      </button>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className={`text-lg md:text-xl font-black flex items-center gap-2 ${th.strongText}`}>
          <HandCoins className="w-5 h-5 text-orange-500" /> {t('Ofa Zangu')}
        </h1>
        <button onClick={() => setTick(x => x + 1)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black rounded-lg cursor-pointer ${th.btnSecondary} ${th.btnSecondaryText}`}>
          <RefreshCw className="w-3 h-3" /> {t('Refresh')}
        </button>
      </div>
      <p className={`text-[10px] ${th.textDim} font-semibold -mt-2`}>{t('Inajiandisha yenyewe kila sekunde 30.')}</p>

      {msg && <div className="text-[11px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2">{msg}</div>}
      {err && <div className="text-[11px] font-bold text-red-500 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">{err}</div>}

      {myOffers.length === 0 && (
        <div className={`${th.card} ${th.cardBorder} rounded-2xl p-10 text-center`}>
          <HandCoins className={`w-10 h-10 mx-auto mb-3 ${th.textDim}`} />
          <div className={`text-sm font-black ${th.strongText}`}>{t('Hakuna ofa bado')}</div>
          <div className={`text-[11px] ${th.textMuted} font-semibold mt-1`}>
            {t('Fungua bidhaa yoyote ubofye "Piga Bei" kuanza kujadili bei.')}
          </div>
        </div>
      )}

      {myOffers.map(o => {
        const product = products.find(p => p.id === o.productId);
        const company = companies.find(c => c.id === o.companyId);
        const b = badge(o);
        const finalPrice = o.finalPrice ?? o.counterPrice ?? o.offeredPrice;
        const discount = Math.round(((o.originalPrice - o.offeredPrice) / o.originalPrice) * 100);
        return (
          <div key={o.id} className={`${th.card} ${th.cardBorder} rounded-2xl p-4 space-y-3`}>
            {/* Row: product image | prices | status */}
            <div className="flex items-start gap-3">
              <button onClick={() => product && onOpenProduct(product)} className="w-16 h-16 rounded-xl overflow-hidden shrink-0 cursor-pointer">
                {product?.image ? (
                  <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-yellow-400 to-amber-600 text-white font-black">{(product?.name || '?').charAt(0)}</div>
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-black truncate ${th.strongText}`}>{product?.name || `#${o.productId}`}</span>
                  {b && <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${b.cls}`}>{b.emoji} {b.label}</span>}
                </div>
                <div className={`text-[10px] font-semibold ${th.textMuted}`}>{company?.name || ''}</div>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <div>
                    <div className={`text-[9px] font-bold uppercase ${th.textDim}`}>{t('Bei Halisi')}</div>
                    <div className={`text-[11px] font-bold line-through ${th.textMuted}`}>{TZS(o.originalPrice)}</div>
                  </div>
                  <div>
                    <div className={`text-[9px] font-bold uppercase ${th.textDim}`}>{t('Bei Yako')}</div>
                    <div className={`text-sm font-black ${th.statValue}`}>{TZS(o.offeredPrice)} <span className="text-[9px] text-orange-500">(-{discount}%)</span></div>
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

            {/* Seller message (reject reason / counter note) */}
            {o.sellerMessage && (o.status === 'rejected' || o.status === 'countered' || o.status === 'accepted') && (
              <div className={`text-[11px] font-semibold rounded-xl px-3 py-2 ${milk ? 'bg-gray-50 text-gray-700' : 'bg-white/5 text-gray-300'}`}>
                💬 {t('Ujumbe wa muuzaji')}: {o.sellerMessage}
              </div>
            )}

            {/* Expiry */}
            {(o.status === 'pending' || o.status === 'countered') && (
              <div className={`flex items-center gap-1.5 text-[10px] font-bold ${th.textMuted}`}>
                <Clock className="w-3 h-3" /> {t('Inaisha')}: {new Date(o.expiresAt).toLocaleString()}
              </div>
            )}
            {o.status === 'accepted' && o.acceptedExpiresAt && (
              <div className={`flex items-center gap-1.5 text-[10px] font-bold ${milk ? 'text-green-700' : 'text-green-400'}`}>
                <Clock className="w-3 h-3" /> {t('Lipa kabla ya')}: {new Date(o.acceptedExpiresAt).toLocaleString()}
              </div>
            )}

            {/* Actions per status */}
            <div className="flex flex-wrap gap-2 pt-1">
              {o.status === 'accepted' && (
                <button
                  onClick={() => onOpenOffer(o.id)}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 text-[11px] font-black rounded-xl cursor-pointer ${th.btnPrimary} ${th.btnPrimaryText}`}
                >
                  <Zap className="w-3.5 h-3.5" /> {t('Nunua kwa Bei Yako')} — {TZS(finalPrice)}
                </button>
              )}
              {o.status === 'rejected' && product && (
                <button
                  onClick={() => onOpenProduct(product)}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 text-[11px] font-black rounded-xl cursor-pointer ${th.btnSecondary} ${th.btnSecondaryText}`}
                >
                  <HandCoins className="w-3.5 h-3.5" /> {t('Jadili Upya')}
                </button>
              )}
              {o.status === 'countered' && (
                <>
                  <button
                    onClick={() => act(onAcceptCounter(o.id), t('Umekubali bei ya muuzaji. Endelea kulipa!'))}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-[11px] font-black rounded-xl cursor-pointer bg-green-600 text-white hover:bg-green-700"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> {t('Kubali Bei ya Muuzaji')}
                  </button>
                  <button
                    onClick={() => act(onRejectCounter(o.id), t('Umekataa pendekezo la muuzaji.'))}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-[11px] font-black rounded-xl cursor-pointer bg-red-500/90 text-white hover:bg-red-600"
                  >
                    <XCircle className="w-3.5 h-3.5" /> {t('Kataa')}
                  </button>
                  <button
                    onClick={() => { setCounterFor(counterFor === o.id ? null : o.id); setCounterPrice(''); setCounterMsg(''); }}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 text-[11px] font-black rounded-xl cursor-pointer ${th.btnSecondary} ${th.btnSecondaryText}`}
                  >
                    <HandCoins className="w-3.5 h-3.5" /> {t('Piga Bei Nyingine')}
                  </button>
                </>
              )}
            </div>

            {/* Counter-again inline form */}
            {counterFor === o.id && (
              <div className={`rounded-xl border p-3 space-y-2 ${th.cardBorder} ${milk ? 'bg-gray-50' : 'bg-white/5'}`}>
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
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2 text-[11px] font-black rounded-xl cursor-pointer disabled:opacity-40 ${th.btnPrimary} ${th.btnPrimaryText}`}
                >
                  <HandCoins className="w-3.5 h-3.5" /> {t('Tuma Bei Mpya')}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
