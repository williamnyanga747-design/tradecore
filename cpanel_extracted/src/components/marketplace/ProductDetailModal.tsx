import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Play, Video, ShoppingCart, MapPin, Store as StoreIcon, Package, Phone, MessageCircle, Star, Check, HandCoins, Users, CalendarClock, X, Zap } from 'lucide-react';
import { Company, MarketplaceProduct, Review, MarketplaceCustomer, GroupDeal, InstallmentPlan, Store } from '../../types';
import { getPublicTheme, PublicTheme } from '../../utils/publicTheme';
import { TZS, TFunc, VerifiedBadge, Stars, RatingBreakdown } from './MarketplaceShared';
import { reviewsFor, ratingSummary } from '../../utils/reviews';
import { formatCountdown } from '../../utils/megaHelpers';
import StoreMapCard from './StoreMapCard';

interface Props {
  product: MarketplaceProduct;
  company?: Company;
  /** Physical stores (Master Data) belonging to the product's company; resolved by storeIds. */
  stores?: Store[];
  theme: PublicTheme;
  t: TFunc;
  onBack: () => void;
  onAddToCart: (product: MarketplaceProduct) => void;
  onViewCompany?: (slug: string) => void;
  onOrderWhatsApp?: () => void;
  reviews?: Review[];
  onSubmitReview?: (data: {
    companyId: number;
    productId: number | null;
    reviewerName: string;
    reviewerPhone?: string;
    rating: number;
    comment?: string;
    isVerifiedBuyer: boolean;
  }) => { ok: boolean; error?: string };
  onTrackProductView?: (productId: number) => void;
  session?: { id?: number; phone: string; name: string } | null;
  // --- MEGA Phase 2C: Piga Bei / Nunua Pamoja / Lipa Pole Pole ---
  groupDeals?: GroupDeal[];
  installmentPlans?: InstallmentPlan[];
  onSubmitOffer?: (input: {
    productId: number;
    companyId: number;
    customerName: string;
    customerPhone: string;
    originalPrice: number;
    offeredPrice: number;
  }) => { ok: boolean; error?: string };
  onOpenGroupDeal?: (dealId: number) => void;
  onStartInstallment?: (productId: number) => void;
  // --- MEGA BUILD F5/F2: flash pricing + ask-seller chat ---
  flashPrice?: number;
  flashEndsAt?: string;
  onAskSeller?: () => void;
  // --- MEGA CRITICAL FIX 2-in-1: navigate to buyer offers list after offering ---
  onNavigateOffers?: () => void;
}

export function productGallery(product: MarketplaceProduct): Array<{ type: 'video' | 'image'; src: string }> {
  const items: Array<{ type: 'video' | 'image'; src: string }> = [];
  if (product.video) items.push({ type: 'video', src: product.video });
  const images = [product.image, ...(product.gallery || [])].filter(Boolean) as string[];
  images.forEach(src => items.push({ type: 'image', src }));
  return items;
}

export default function ProductDetailPage({
  product, company, stores, theme, t, onBack, onAddToCart, onViewCompany, onOrderWhatsApp,
  reviews, onSubmitReview, onTrackProductView, session,
  groupDeals, installmentPlans, onSubmitOffer, onOpenGroupDeal, onStartInstallment,
  flashPrice, flashEndsAt, onAskSeller, onNavigateOffers
}: Props) {
  const th = getPublicTheme(theme);
  const milk = theme === 'milk';
  const items = useMemo(() => productGallery(product), [product]);
  const [index, setIndex] = useState(0);

  // Multi-Store Location Mapping: resolve the physical stores assigned to this product
  // via its storeIds. Empty = caller falls back to Main HQ inside StoreMapCard.
  const assignedStores = useMemo(() => {
    const ids = Array.isArray(product.storeIds) ? product.storeIds : [];
    if (ids.length === 0 || !Array.isArray(stores)) return [];
    const set = new Set(ids);
    return stores.filter(s => set.has(s.id) && !s.isDeleted);
  }, [product.storeIds, stores]);

  // --- MEGA BUILD F5: live flash-sale countdown ticker ---
  const [, setFlashTick] = useState(0);
  useEffect(() => {
    if (!flashEndsAt) return;
    const iv = window.setInterval(() => setFlashTick(x => x + 1), 1000);
    return () => window.clearInterval(iv);
  }, [flashEndsAt]);
  const flashActive = typeof flashPrice === 'number' && flashPrice < product.price;

  // Feature 5: record one product-page view per hour (deduped in App).
  useEffect(() => {
    onTrackProductView?.(product.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  // Feature 3: review summary + form state
  const productReviews = useMemo(
    () => reviewsFor(reviews || [], { companyId: company?.id, productId: product.id }),
    [reviews, company?.id, product.id]
  );
  const summary = useMemo(
    () => ratingSummary(reviews || [], { companyId: company?.id ?? 0, productId: product.id }),
    [reviews, company?.id, product.id]
  );
  const [showForm, setShowForm] = useState(false);
  const [rRating, setRRating] = useState(0);
  const [rName, setRName] = useState(session?.name || '');
  const [rPhone, setRPhone] = useState(session?.phone || '');
  const [rComment, setRComment] = useState('');
  const [rVerified, setRVerified] = useState(!!session);
  const [rError, setRError] = useState('');
  const [rHover, setRHover] = useState(0);

  // --- MEGA Phase 2C: Piga Bei offer form state ---
  const [showOffer, setShowOffer] = useState(false);
  const [oName, setOName] = useState(session?.name || '');
  const [oPhone, setOPhone] = useState(session?.phone || '');
  const [oPrice, setOPrice] = useState('');
  const [oError, setOError] = useState('');
  const [oSuccess, setOSuccess] = useState(false);

  const activeGroupDeals = useMemo(
    () => (groupDeals || []).filter(d => d.productId === product.id && d.status === 'active' && new Date(d.expiresAt).getTime() > Date.now()),
    [groupDeals, product.id]
  );
  const activeInstallmentPlans = useMemo(
    () => (installmentPlans || []).filter(p => p.productId === product.id && p.status === 'active'),
    [installmentPlans, product.id]
  );

  const submitOffer = () => {
    setOError('');
    if (!onSubmitOffer) return;
    if (!oName.trim()) return setOError(t('Jina linahitajika.'));
    if (!/^(\+?255|0)[67]\d{8}$/.test(oPhone.trim().replace(/\s/g, ''))) return setOError(t('Namba ya simu si sahihi. Tumia format ya Tanzania (+255 or 0...).'));
    const price = Number(oPrice);
    if (!price || price <= 0 || price >= product.price) return setOError(t('Bei yako lazima iwe chini ya bei ya sasa.'));
    // MEGA CRITICAL FIX: mirror the backend 50%-minimum rule
    if (price < product.price * 0.5) return setOError(t('Bei yako ni ndini mno. Kiwango cha chini kabisa ni 50% ya bei ya bidhaa.'));
    const res = onSubmitOffer({
      productId: product.id,
      companyId: product.companyId,
      customerName: oName.trim(),
      customerPhone: oPhone.trim(),
      originalPrice: product.price,
      offeredPrice: price
    });
    if (!res.ok) return setOError(res.error || t('Something went wrong while submitting your offer.'));
    setOSuccess(true);
    setShowOffer(false);
  };

  const submitReview = () => {
    if (!onSubmitReview || !company) return;
    const res = onSubmitReview({
      companyId: company.id,
      productId: product.id,
      reviewerName: rName,
      reviewerPhone: rPhone,
      rating: rRating,
      comment: rComment,
      isVerifiedBuyer: rVerified
    });
    if (!res.ok) {
      setRError(res.error || t('Could not submit your review.'));
      return;
    }
    setRError('');
    setShowForm(false);
    setRRating(0);
    setRComment('');
  };

  const current = items[index] || items[0];
  const out = (product.stockQuantity || 0) < 1;
  const address = [company?.region, company?.district, company?.ward].filter(Boolean).join(', ');

  // WhatsApp order — uses the store WhatsApp number, falls back to the store phone
  const whatsappNumber = (company?.whatsappNumber || company?.phone || '').replace(/[^0-9]/g, '');
  const whatsappOrder = () => {
    if (!whatsappNumber) return;
    const message =
      `Habari ${company?.name || ''}, nimeona bidhaa *${product.name}* kwa TZS ${product.price} kwenye GlobalTradeCore.co.tz\n\n` +
      `Link: ${window.location.href}\n\nInapatikana?`;
    const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    onOrderWhatsApp?.();
  };

  return (
    <div className="space-y-5 pb-16">
      {/* Breadcrumb / back */}
      <button onClick={onBack} className={`flex items-center gap-1.5 text-[11px] font-bold ${th.textMuted} hover:underline cursor-pointer`}>
        <ChevronLeft className="w-4 h-4" /> {t('Back to Marketplace')}
      </button>

      <div className={`${th.card} ${th.cardBorder} rounded-3xl overflow-hidden`}>
        <div className="grid md:grid-cols-2">
          {/* Gallery */}
          <div className="p-4 md:p-5">
            <div className="relative h-64 sm:h-80 md:h-[440px] rounded-2xl overflow-hidden bg-black flex items-center justify-center">
              {current?.type === 'video' ? (
                <video key={current.src} src={current.src} controls autoPlay muted loop playsInline preload="metadata" loading="lazy" className="w-full h-full object-contain" />
              ) : (
                current?.src && <img key={current.src} src={current.src} alt={product.name} className="w-full h-full object-contain" />
              )}

              {items.length > 1 && (
                <>
                  <button
                    onClick={() => setIndex(i => Math.max(0, i - 1))}
                    disabled={index === 0}
                    className={`absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${milk ? 'bg-white/90 text-gray-800' : 'bg-black/50 text-white hover:bg-black/70'}`}
                    title={t('Previous')}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setIndex(i => Math.min(items.length - 1, i + 1))}
                    disabled={index >= items.length - 1}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${milk ? 'bg-white/90 text-gray-800' : 'bg-black/50 text-white hover:bg-black/70'}`}
                    title={t('Next')}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <span className="absolute bottom-2 right-2 px-2 py-1 rounded-full bg-black/60 text-white text-[10px] font-black">
                    {index + 1}/{items.length}
                  </span>
                </>
              )}
            </div>

            {/* Thumbnails */}
            {items.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
                {items.map((item, i) => (
                  <button
                    key={item.src}
                    onClick={() => setIndex(i)}
                    className={`relative w-16 h-16 shrink-0 rounded-xl overflow-hidden cursor-pointer border-2 transition ${i === index ? 'border-amber-500 ring-2 ring-amber-500/40' : 'border-transparent opacity-70 hover:opacity-100'}`}
                    title={item.type === 'video' ? t('Video') : `${product.name} ${i + 1}`}
                  >
                    {item.type === 'video' ? (
                      <span className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-blue-600">
                        <Play className="w-6 h-6 text-white fill-white" />
                      </span>
                    ) : (
                      <img src={item.src} alt={`${product.name} ${i + 1}`} className="w-full h-full object-cover" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="p-4 md:p-6 md:pl-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {product.category && (
                <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full ${th.chip} ${th.chipText} ${th.chipBorder}`}>
                  <Package className="w-3 h-3" /> {product.category}
                </span>
              )}
              {product.video && (
                <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full ${milk ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-purple-500/15 text-purple-300 border border-purple-500/40'}`}>
                  <Video className="w-3 h-3" /> {t('VIDEO AVAILABLE')}
                </span>
              )}
              {out && (
                <span className="text-[10px] font-black uppercase px-2 py-1 rounded-full bg-red-600 text-white">{t('Sold Out')}</span>
              )}
            </div>

            <h2 className={`text-xl md:text-2xl font-black mt-3 ${th.strongText}`}>{product.name}</h2>

            {(product.reviewsCount || 0) > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <Stars rating={product.averageRating || 0} size={16} />
                <span className={`text-[11px] font-black ${th.textMuted}`}>
                  {product.averageRating?.toFixed(1)} ({product.reviewsCount} {product.reviewsCount === 1 ? t('review') : t('reviews')})
                </span>
              </div>
            )}

            <div className="mt-3 flex items-center gap-3 flex-wrap">
              {flashActive ? (
                <>
                  <span className="text-2xl md:text-3xl font-black text-red-500">{TZS(flashPrice!)}</span>
                  <span className={`text-sm font-bold line-through ${th.textDim}`}>{TZS(product.price)}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full bg-red-600 text-white">
                    <Zap className="w-3 h-3" /> {t('Flash Sale')} -{Math.round(((product.price - flashPrice!) / product.price) * 100)}%
                  </span>
                </>
              ) : (
                <span className={`text-2xl md:text-3xl font-black ${th.statValue}`}>{TZS(product.price)}</span>
              )}
              <span className={`text-[11px] font-bold ${product.stockQuantity > 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                {product.stockQuantity} {t('in stock')}
              </span>
            </div>

            {flashActive && flashEndsAt && (
              <div className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-black text-red-500 bg-red-500/10 border border-red-500/30 rounded-full px-3 py-1">
                <Zap className="w-3 h-3" /> {t('Bei inaisha kwa')}: {formatCountdown(Math.floor((new Date(flashEndsAt).getTime() - Date.now()) / 1000))}
              </div>
            )}

            {company && (
              <div className={`mt-4 rounded-2xl border ${th.cardBorder} ${th.card} p-3.5 space-y-2`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center text-sm font-black shrink-0 ${milk ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/15 text-amber-300'}`}>
                      {company.logoUrl ? (
                        <img src={company.logoUrl} alt={company.name} className="w-full h-full object-cover" />
                      ) : (
                        (company.name || '-').charAt(0)
                      )}
                    </div>
                    <div className="min-w-0">
                      <button
                        onClick={() => company.slug && onViewCompany?.(company.slug)}
                        className={`text-xs font-black ${th.brandText} hover:underline truncate block cursor-pointer`}
                      >
                        {company.name}
                      </button>
                      {company.isVerified && <VerifiedBadge milk={milk} t={t} />}
                      {/* Multi-Store Location Mapping: Company + assigned Store name(s) */}
                      <div className={`text-[10px] font-bold mt-0.5 ${th.textMuted} truncate`}>
                        {t('Company')}: {company.name}
                        {' | '}
                        {t('Store')}: {assignedStores.length > 0 ? assignedStores.map(s => s.name).join(', ') : t('Main HQ')}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => company.slug && onViewCompany?.(company.slug)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black rounded-lg transition cursor-pointer ${th.btnSecondary} ${th.btnSecondaryText}`}
                  >
                    <StoreIcon className="w-3 h-3" /> {t('Visit Store')}
                  </button>
                </div>
                <div className="space-y-1.5 text-[11px] font-bold">
                  {address && (
                    <span className={`flex items-center gap-1.5 ${th.textMuted}`}>
                      <MapPin className="w-3.5 h-3.5 shrink-0" /> {address}
                    </span>
                  )}
                  {company.phone && (
                    <a href={`tel:${company.phone}`} className={`flex items-center gap-1.5 ${th.textMuted} hover:underline`}>
                      <Phone className="w-3.5 h-3.5 shrink-0" /> {company.phone}
                    </a>
                  )}
                </div>
              </div>
            )}

            {product.description && (
              <p className={`text-xs ${th.textMuted} font-medium mt-4 leading-relaxed`}>{product.description}</p>
            )}

            {whatsappNumber && (
              <button
                onClick={whatsappOrder}
                className="mt-5 w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-full transition cursor-pointer shadow-lg shadow-green-500/25"
              >
                <MessageCircle className="w-5 h-5" /> {t('Order via WhatsApp')}
              </button>
            )}

            {/* --- MEGA BUILD F2: Uliza Muuzaji — start an in-app chat about this product --- */}
            {onAskSeller && (
              <button
                onClick={onAskSeller}
                className={`mt-3 w-full flex items-center justify-center gap-2 py-3 px-6 text-sm font-black rounded-full border transition cursor-pointer hover:brightness-110 ${th.cardBorder} ${th.btnSecondary} ${th.btnSecondaryText}`}
              >
                <MessageCircle className="w-4 h-4" /> {t('Uliza Muuzaji')}
              </button>
            )}

            {company?.planType === 'direct' ? (
              <div className={`mt-3 text-center text-[11px] font-bold px-4 py-2.5 rounded-xl border ${th.cardBorder} ${th.textMuted}`}>
                {t('Direct billing store — pay the seller directly via M-Pesa. No platform checkout for this store.')}
              </div>
            ) : (
              <button
                onClick={() => onAddToCart(product)}
                disabled={out}
                className={`mt-3 w-full flex items-center justify-center gap-2 px-5 py-3 text-sm font-black rounded-full transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border ${whatsappNumber ? th.cardBorder : ''} ${whatsappNumber ? 'bg-transparent ' + th.strongText : th.btnPrimary + ' ' + th.btnPrimaryText}`}
              >
                <ShoppingCart className="w-4 h-4" /> {t('Add to Cart')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* MEGA Phase 2C — Piga Bei / Nunua Pamoja / Lipa Pole Pole */}
      {(onSubmitOffer || activeGroupDeals.length > 0 || activeInstallmentPlans.length > 0) && (
        <div className={`${th.card} ${th.cardBorder} rounded-3xl p-4 md:p-5`}>
          <h3 className={`text-sm font-black ${th.strongText} mb-3`}>{t('Smart Ways to Buy')}</h3>
          <div className="grid sm:grid-cols-3 gap-2.5">
            {onSubmitOffer && (
              <button
                onClick={() => { setOSuccess(false); setShowOffer(true); }}
                className={`p-3.5 rounded-2xl border text-left transition cursor-pointer hover:brightness-105 ${th.cardBorder} ${th.card}`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${milk ? 'bg-orange-100 text-orange-700' : 'bg-orange-500/20 text-orange-400'}`}>
                  <HandCoins className="w-4.5 h-4.5" />
                </div>
                <div className={`text-[11px] font-black ${th.strongText}`}>{t('Piga Bei')}</div>
                <div className={`text-[9px] ${th.textMuted} font-semibold mt-0.5`}>{t('Nadi bei yako mwenyewe — muuzaji atakujibu ndani ya saa 24.')}</div>
              </button>
            )}
            {activeGroupDeals.length > 0 && (
              <button
                onClick={() => onOpenGroupDeal?.(activeGroupDeals[0].id)}
                className={`p-3.5 rounded-2xl border text-left transition cursor-pointer hover:brightness-105 ${th.cardBorder} ${th.card}`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${milk ? 'bg-indigo-100 text-indigo-700' : 'bg-indigo-500/20 text-indigo-400'}`}>
                  <Users className="w-4.5 h-4.5" />
                </div>
                <div className={`text-[11px] font-black ${th.strongText}`}>{t('Nunua Pamoja')}</div>
                <div className={`text-[9px] ${th.textMuted} font-semibold mt-0.5`}>{t('Bei ya kikundi')}: <span className="text-emerald-500 font-black">{TZS(activeGroupDeals[0].groupPrice)}</span> · {activeGroupDeals[0].paidCount}/{activeGroupDeals[0].minBuyers} {t('wamelipa')}</div>
              </button>
            )}
            {activeInstallmentPlans.length > 0 && (
              <button
                onClick={() => onStartInstallment?.(product.id)}
                className={`p-3.5 rounded-2xl border text-left transition cursor-pointer hover:brightness-105 ${th.cardBorder} ${th.card}`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${milk ? 'bg-sky-100 text-sky-700' : 'bg-sky-500/20 text-sky-400'}`}>
                  <CalendarClock className="w-4.5 h-4.5" />
                </div>
                <div className={`text-[11px] font-black ${th.strongText}`}>{t('Lipa Pole Pole')}</div>
                <div className={`text-[9px] ${th.textMuted} font-semibold mt-0.5`}>{t('Malipo ya awali')} {activeInstallmentPlans[0].downPaymentPercent}% + {activeInstallmentPlans[0].installmentsCount} {t('awamu')}</div>
              </button>
            )}
          </div>

          {/* Piga Bei modal */}
          {showOffer && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setShowOffer(false)}>
              <div
                className={`${th.card} ${th.cardBorder} rounded-2xl p-5 w-full max-w-sm space-y-3`}
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <h4 className={`text-sm font-black ${th.strongText}`}>{t('Piga Bei')} — {product.name}</h4>
                  <button onClick={() => setShowOffer(false)} className={`p-1.5 rounded-lg cursor-pointer ${th.textMuted} hover:bg-white/10`}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className={`text-[11px] ${th.textMuted} font-semibold`}>
                  {t('Bei ya sasa')}: <span className="font-black text-amber-500">{TZS(product.price)}</span>. {t('Weka bei yako — muuzaji anaweza kukubali, kutoa bei yake, au kukataa.')}
                </p>
                <input value={oName} onChange={e => setOName(e.target.value)} placeholder={t('Jina Kamili')} className={th.input} />
                <input value={oPhone} onChange={e => setOPhone(e.target.value)} placeholder="+255 7XX XXX XXX" className={th.input} />
                <input value={oPrice} onChange={e => setOPrice(e.target.value.replace(/[^\d]/g, ''))} placeholder={t('Bei yako (TZS)')} type="number" className={th.input} />
                {oError && <div className="text-[11px] font-bold text-red-500">{oError}</div>}
                <button
                  onClick={submitOffer}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-black rounded-xl ${th.btnPrimary} ${th.btnPrimaryText} cursor-pointer`}
                >
                  <HandCoins className="w-3.5 h-3.5" /> {t('Tuma Offer')}
                </button>
              </div>
            </div>
          )}

          {/* Offer success toast */}
          {oSuccess && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-black text-emerald-500 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2">
                <Check className="w-4 h-4" /> {t('Offer yako imetumwa! Muuzaji atajibu ndani ya masaa 24.')}
              </div>
              {onNavigateOffers && (
                <button
                  onClick={onNavigateOffers}
                  className={`inline-flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-lg cursor-pointer ${th.btnPrimary} ${th.btnPrimaryText}`}
                >
                  <HandCoins className="w-3 h-3" /> {t('Angalia status kwenye Ofa Zangu')}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Feature 4 — store location map + directions */}
      {company && <StoreMapCard company={company} theme={theme} t={t} compact stores={assignedStores} />}

      {/* Feature 3 — reviews & rating */}
      {company && (
        <div className={`${th.card} ${th.cardBorder} rounded-3xl p-4 md:p-5`}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className={`text-sm font-black ${th.strongText}`}>
              <Star className="w-4 h-4 inline-block mr-1 -mt-0.5 text-amber-400" fill="currentColor" />
              {t('Reviews & Ratings')}
            </h3>
            {onSubmitReview && !showForm && (
              <button
                onClick={() => setShowForm(true)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black rounded-lg cursor-pointer ${th.btnPrimary} ${th.btnPrimaryText}`}
              >
                <Star className="w-3 h-3" /> {t('Leave your review')}
              </button>
            )}
          </div>

          <div className="grid md:grid-cols-[220px_1fr] gap-5 mt-4">
            <div>
              <RatingBreakdown rating={summary.avg} count={summary.total} breakdown={summary.breakdown} t={t} />
            </div>
            <div>
              {showForm ? (
                <div className={`rounded-2xl border ${th.cardBorder} p-3.5 space-y-3`}>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        onClick={() => setRRating(n)}
                        onMouseEnter={() => setRHover(n)}
                        onMouseLeave={() => setRHover(0)}
                        className="cursor-pointer"
                        title={`${n} ${n === 1 ? t('star') : t('stars')}`}
                      >
                        <Star
                          className={`w-6 h-6 ${(rHover || rRating) >= n ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'}`}
                          fill="currentColor"
                        />
                      </button>
                    ))}
                    <span className={`text-[11px] font-black ml-1 ${th.textMuted}`}>
                      {rRating ? `${rRating}/5` : t('Tap to rate')}
                    </span>
                  </div>
                  <input
                    value={rName}
                    onChange={e => setRName(e.target.value)}
                    placeholder={t('Your name')}
                    maxLength={60}
                    className={`w-full rounded-lg border ${th.cardBorder} px-3 py-2 text-[12px] font-bold bg-transparent outline-none ${th.strongText}`}
                  />
                  <input
                    value={rPhone}
                    onChange={e => setRPhone(e.target.value)}
                    placeholder={t('Phone (optional) — helps confirm verified buyer')}
                    maxLength={20}
                    className={`w-full rounded-lg border ${th.cardBorder} px-3 py-2 text-[12px] font-bold bg-transparent outline-none ${th.strongText}`}
                  />
                  <textarea
                    value={rComment}
                    onChange={e => setRComment(e.target.value)}
                    placeholder={t('Share your experience...')}
                    maxLength={1000}
                    rows={3}
                    className={`w-full rounded-lg border ${th.cardBorder} px-3 py-2 text-[12px] font-bold bg-transparent outline-none resize-none ${th.strongText}`}
                  />
                  <div className="flex items-center gap-2">
                    <input
                      id="rv-verified"
                      type="checkbox"
                      checked={rVerified}
                      onChange={e => setRVerified(e.target.checked)}
                      className="accent-emerald-500 w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor="rv-verified" className={`text-[11px] font-bold cursor-pointer ${th.textMuted}`}>
                      {t('I bought this product from this store')}
                    </label>
                  </div>
                  {rError && <div className="text-[11px] font-bold text-red-500">{rError}</div>}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={submitReview}
                      disabled={!rRating || rName.trim().length < 2}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-[11px] font-black rounded-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-amber-500 text-white hover:bg-amber-600"
                    >
                      <Check className="w-3.5 h-3.5" /> {t('Submit Review')}
                    </button>
                    <button
                      onClick={() => setShowForm(false)}
                      className={`text-[11px] font-black px-3 py-2 rounded-lg cursor-pointer ${th.textMuted} hover:underline`}
                    >
                      {t('Cancel')}
                    </button>
                  </div>
                </div>
              ) : productReviews.length === 0 ? (
                <div className={`text-[11px] font-bold ${th.textMuted} text-center py-8`}>{t('No reviews yet — be the first to review this product.')}</div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {productReviews.map(r => (
                    <div key={r.id} className={`rounded-xl border ${th.cardBorder} p-3`}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black ${milk ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/15 text-amber-300'}`}>
                            {r.reviewerName.charAt(0).toUpperCase()}
                          </div>
                          <span className={`text-[11px] font-black ${th.strongText}`}>{r.reviewerName}</span>
                          {r.isVerifiedBuyer && (
                            <span className={`inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full ${milk ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/15 text-emerald-300'}`}>
                              <Check className="w-2.5 h-2.5" /> {t('Verified Buyer')}
                            </span>
                          )}
                        </div>
                        <span className={`text-[10px] font-bold ${th.textDim}`}>{new Date(r.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="mt-1.5">
                        <Stars rating={r.rating} size={13} />
                      </div>
                      {r.comment && <p className={`text-[11px] ${th.textMuted} font-medium mt-1.5 leading-relaxed`}>{r.comment}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
