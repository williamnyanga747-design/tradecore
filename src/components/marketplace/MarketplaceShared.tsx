import React from 'react';
import { BadgeCheck, Globe2, Phone, Mail, Store, Home, LayoutDashboard, ShoppingBag, Plus, ShoppingCart, Video, Star, Search, Landmark } from 'lucide-react';
import { getPublicTheme, PublicTheme, PublicThemeToggle } from '../../utils/publicTheme';
import { Company, MarketplaceProduct } from '../../types';
import { LangCode } from '../../utils/i18n';
import LanguageSwitcher from '../../utils/LanguageSwitcher';

export type TFunc = (text: string) => string;

export const TZS = (amount: number) => `TZS ${Math.round(amount || 0).toLocaleString('en-US')}`;

export const isProductVisible = (p: MarketplaceProduct) =>
  p.isActive !== false && (p.status === undefined || p.status === 'approved');

// New billing model: a seller is only public while their subscription period is valid
// (today <= subscriptionEnd). A lapsed subscription hides the storefront/products even while a
// renewal payment is pending re-approval. Early renewals keep the store visible until the old
// period actually ends. Legacy/demo sellers (no planType) are never auto-hidden.
export const isCompanySubscriptionExpired = (c: Company): boolean => {
  if (!c || c.isDemo === true || !c.planType) return false;
  const end = c.subscriptionEnd;
  if (!end) return true;
  const today = new Date().toISOString().split('T')[0];
  return end < today;
};

export const ORDER_STATUS_KEYS: Record<string, string> = {
  pending_verification: 'Inasubiri Uhakiki',
  verified: 'Verified / Approved',
  processing: 'Processing',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  rejected: 'Rejected'
};

export function orderStatusLabel(status: string, t?: TFunc): string {
  const tr = t || ((s: string) => s);
  return tr(ORDER_STATUS_KEYS[status] || status);
}

export interface CartLine {
  product: MarketplaceProduct;
  quantity: number;
}

export function Money({ amount, className = '' }: { amount: number; className?: string }) {
  return <span className={className}>{TZS(amount)}</span>;
}

export function VerifiedBadge({ milk, t }: { milk: boolean; t?: TFunc }) {
  const tr = t || ((s: string) => s);
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${milk ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'}`}>
      <BadgeCheck className="w-3 h-3" /> {tr('Verified')}
    </span>
  );
}

export function DistanceBadge({ km, className = '', t }: { km: number | null; className?: string; t?: TFunc }) {
  const tr = t || ((s: string) => s);
  if (km === null || km === undefined) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full ${className || 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/40'}`}>
      <Home className="w-3 h-3" /> {km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`} {tr('away')}
    </span>
  );
}

/** Star row (supports half stars). Feature 3. */
export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  const clamp = Math.max(0, Math.min(5, rating || 0));
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${clamp.toFixed(1)} / 5`}>
      {[1, 2, 3, 4, 5].map(i => {
        const filled = clamp >= i;
        const half = !filled && clamp >= i - 0.5;
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star className="text-gray-300 dark:text-gray-600" style={{ width: size, height: size }} fill="currentColor" />
            {(filled || half) && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: half ? `${size * 0.5}px` : size }}>
                <Star className="text-amber-400" style={{ width: size, height: size }} fill="currentColor" />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

/** Compact "4.5 ★ (12)" chip for product cards / headers. */
export function RatingChip({ rating, count, t, className = '' }: { rating: number; count: number; t?: TFunc; className?: string }) {
  const tr = t || ((s: string) => s);
  if (!count) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-black ${className || 'text-amber-500 dark:text-amber-400'}`}>
      <Star className="w-3 h-3" fill="currentColor" /> {rating.toFixed(1)}
      <span className="font-bold text-gray-400 dark:text-gray-500">({count} {count === 1 ? tr('review') : tr('reviews')})</span>
    </span>
  );
}

/** 5→1 star breakdown bars used in the review summary. */
export function RatingBreakdown({ rating, count, breakdown, t }: { rating: number; count: number; breakdown: Array<{ stars: number; count: number }>; t: TFunc }) {
  const th = getPublicTheme('milk');
  const max = Math.max(1, ...breakdown.map(b => b.count));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3">
        <span className={`text-2xl font-black ${th.statValue}`}>{count ? rating.toFixed(1) : '—'}</span>
        <div>
          <Stars rating={rating} size={15} />
          <div className={`text-[10px] font-bold mt-0.5`}>
            {count ? `${count} ${count === 1 ? t('review') : t('reviews')}` : t('No reviews yet')}
          </div>
        </div>
      </div>
      {breakdown.map(b => (
        <div key={b.stars} className="flex items-center gap-2 text-[10px] font-bold">
          <span className="w-6 text-right">{b.stars}</span>
          <Star className="w-3 h-3 text-amber-400" fill="currentColor" />
          <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <div className="h-full rounded-full bg-amber-400" style={{ width: `${(b.count / max) * 100}%` }} />
          </div>
          <span className="w-5 text-left text-gray-400">{b.count}</span>
        </div>
      ))}
    </div>
  );
}

export function ProductImage({ product, className = 'w-full h-full object-cover' }: { product: MarketplaceProduct; className?: string }) {
  if (product.image) {
    return <img src={product.image} alt={product.name} className={className} loading="lazy" />;
  }
  const letter = (product.name || '?').charAt(0).toUpperCase();
  return (
    <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-yellow-400 to-amber-600 text-white text-4xl font-black ${className}`}>
      {letter}
    </div>
  );
}

export function ProductCard({
  product, theme, t, companyName, onOpen, onAddToCart, compact = false
}: {
  product: MarketplaceProduct;
  theme: PublicTheme;
  t: TFunc;
  companyName?: string;
  onOpen: () => void;
  onAddToCart: () => void;
  compact?: boolean;
}) {
  const th = getPublicTheme(theme);
  const milk = theme === 'milk';
  const out = (product.stockQuantity || 0) < 1;
  return (
    <div className={`${th.card} ${th.cardBorder} rounded-2xl overflow-hidden flex flex-col hover:-translate-y-1 transition duration-200 group`}>
      <div onClick={onOpen} className={`relative ${compact ? 'h-28' : 'h-40'} overflow-hidden cursor-pointer`}>
        <ProductImage product={product} />
        {out && (
          <div className="absolute top-2 right-2 bg-red-600 text-white text-[9px] font-black uppercase px-2 py-1 rounded-full">{t('Sold Out')}</div>
        )}
        {product.video && (
          <div className={`absolute top-2 left-2 w-7 h-7 rounded-full flex items-center justify-center ${milk ? 'bg-white/95 text-purple-600 shadow' : 'bg-black/60 text-purple-300 backdrop-blur'}`} title={t('Video available')}>
            <Video className="w-4 h-4" />
          </div>
        )}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
          <div className={`text-[10px] font-black text-amber-300 ${th.textMuted}`}>{companyName || t('Store')}</div>
        </div>
      </div>
      <div className="p-3 flex flex-col flex-1">
        <div onClick={onOpen} className={`text-xs font-black ${th.strongText} leading-snug line-clamp-2 cursor-pointer hover:underline`}>
          {product.name}
        </div>
        <div className={`text-[10px] ${th.textDim} font-medium line-clamp-1 mt-0.5`}>{product.category || t('General')}</div>
        {(product.reviewsCount || 0) > 0 && (
          <RatingChip rating={product.averageRating || 0} count={product.reviewsCount || 0} t={t} className="mt-1" />
        )}
        <div className="flex items-center justify-between mt-2.5 flex-1">
          <div>
            <div className={`text-sm font-black ${th.statValue}`}>{TZS(product.price)}</div>
            <div className={`text-[9px] ${th.textDim} font-semibold`}>{product.stockQuantity} {t('in stock')}</div>
          </div>
          <button
            onClick={onAddToCart}
            disabled={out}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-black rounded-lg transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${milk ? 'bg-amber-500 text-white' : 'bg-brand text-[#1f2937]'} hover:brightness-110`}
            title={t('Add to cart')}
          >
            <Plus className="w-3.5 h-3.5" /> {t('Add')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MarketHeader({
  theme, t, language, onLanguageChange, onToggleTheme, onHome, onMyOrders, session, onLogout, cartCount, onOpenCart, onSearch, voiceMic
}: {
  theme: PublicTheme;
  t: TFunc;
  language: LangCode;
  onLanguageChange: (lang: LangCode) => void;
  onToggleTheme: () => void;
  onHome: () => void;
  onMyOrders: () => void;
  session: { phone: string; name: string } | null;
  onLogout: () => void;
  cartCount: number;
  onOpenCart: () => void;
  onSearch?: () => void;
  voiceMic?: React.ReactNode;
}) {
  const th = getPublicTheme(theme);
  const milk = theme === 'milk';
  const dark = !milk;
  return (
    <header className={`sticky top-0 z-30 ${th.headerBg} ${th.headerBorder}`}>
      <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between gap-3">
        <button onClick={onHome} className="flex items-center gap-2.5 cursor-pointer">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-lg ${milk ? 'bg-[#1f2937] text-amber-400' : 'bg-brand text-[#1f2937]'}`}>T</div>
          <div className="text-left hidden sm:block">
            <div className={`font-black text-sm tracking-tight ${th.strongText}`}>{t('Global TradeCore')}</div>
            <div className={`text-[9px] ${th.textDim} tracking-wider font-semibold uppercase`}>{t('Marketplace')}</div>
          </div>
        </button>
        <div className="flex items-center gap-1.5">
          <LanguageSwitcher language={language} onChange={onLanguageChange} dark={dark} />
          {voiceMic}
          {onSearch && (
            <button onClick={onSearch} title={t('Search')} className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg transition cursor-pointer ${milk ? 'text-gray-600 hover:text-amber-700 hover:bg-amber-100' : 'text-gray-200 hover:text-white hover:bg-white/10'}`}>
              <Search className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{t('Search')}</span>
            </button>
          )}
          <button onClick={onHome} className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg transition cursor-pointer ${milk ? 'text-gray-600 hover:text-amber-700 hover:bg-amber-100' : 'text-gray-200 hover:text-white hover:bg-white/10'}`}>
            <Store className="w-3.5 h-3.5" /> {t('Marketplace')}
          </button>
          <button
            onClick={onOpenCart}
            title={t('Cart')}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black rounded-lg transition cursor-pointer ${milk ? 'text-gray-600 hover:text-amber-700 hover:bg-amber-100' : 'text-gray-200 hover:text-white hover:bg-white/10'}`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('Cart')}</span>
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
          <button onClick={onMyOrders} className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg transition cursor-pointer ${milk ? 'text-gray-600 hover:text-amber-700 hover:bg-amber-100' : 'text-gray-200 hover:text-white hover:bg-white/10'}`}>
            <ShoppingBag className="w-3.5 h-3.5" /> {t('My Orders')}
          </button>
          {session && (
            <button onClick={onLogout} className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black rounded-lg transition cursor-pointer ${th.btnPrimary} ${th.btnPrimaryText}`}>
              {session.name.split(' ')[0]} · {t('Logout')}
            </button>
          )}
          <PublicThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>
    </header>
  );
}

export function MarketFooter({ theme, t, onHome, onAdmin, onTra }: { theme: PublicTheme; t: TFunc; onHome: () => void; onAdmin: () => void; onTra?: () => void }) {
  const th = getPublicTheme(theme);
  return (
    <footer className={`mt-14 ${th.footerBorder}`}>
      <div className={`max-w-6xl mx-auto px-5 py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-[10px] ${th.footerText} font-semibold`}>
        <div className="flex items-center gap-2">
          <Globe2 className="w-3.5 h-3.5" />
          {t('Global TradeCore & Enterprise Solutions')} — tanzaniatradecore.co.tz
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> +255747876653</span>
          <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> globaltradecore@gmail.com</span>
          <button onClick={onHome} className="hover:underline">{t('Home')}</button>
          {onTra && <button onClick={onTra} className="hover:underline flex items-center gap-1"><Landmark className="w-3 h-3" /> {t('TRA & Tax Compliance')}</button>}
          <button onClick={onAdmin} className="hover:underline flex items-center gap-1"><LayoutDashboard className="w-3 h-3" /> {t('Staff Login')}</button>
        </div>
      </div>
    </footer>
  );
}
