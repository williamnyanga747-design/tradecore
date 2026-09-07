import React, { useMemo, useState } from 'react';
import { ChevronLeft, MapPin, Phone, Mail, Search, ShoppingCart, Store, Package, Grid3x3 } from 'lucide-react';
import { Company, MarketplaceProduct, Review } from '../../types';
import { getPublicTheme, PublicTheme } from '../../utils/publicTheme';
import { CartLine, ProductCard, TZS, VerifiedBadge, TFunc, isProductVisible, Stars } from './MarketplaceShared';
import StoreMapCard from './StoreMapCard';

interface Props {
  theme: PublicTheme;
  t: TFunc;
  company: Company;
  products: MarketplaceProduct[];
  cartItems: CartLine[];
  onBack: () => void;
  onAddToCart: (product: MarketplaceProduct) => void;
  onOpenProduct: (product: MarketplaceProduct) => void;
  onOpenCart: () => void;
  distanceKm: number | null;
  reviews?: Review[];
}

export default function MarketplaceStorefront({
  theme, t, company, products, cartItems, onBack, onAddToCart, onOpenProduct, onOpenCart, distanceKm, reviews
}: Props) {
  const th = getPublicTheme(theme);
  const milk = theme === 'milk';
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => { if (p.category) set.add(p.category); });
    return Array.from(set);
  }, [products]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter(p => isProductVisible(p))
      .filter(p => !category || p.category === category)
      .filter(p => !q || p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
  }, [products, search, category]);

  const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cartItems.reduce((s, i) => s + i.quantity * i.product.price, 0);
  const hasCoords = typeof company.latitude === 'number' && typeof company.longitude === 'number';
  const approvedReviews = (reviews || []).filter(r => r.status === 'approved' && r.companyId === company.id);

  return (
    <div className="space-y-6 pb-24">
      {/* Back */}
      <button onClick={onBack} className={`flex items-center gap-1.5 text-[11px] font-bold ${th.textMuted} hover:underline cursor-pointer`}>
        <ChevronLeft className="w-4 h-4" /> {t('Back to Marketplace')}
      </button>

      {/* Company header */}
      <div className={`${th.card} ${th.cardBorder} rounded-3xl overflow-hidden`}>
        {company.coverImage && (
          <div className="h-36 md:h-48 w-full overflow-hidden">
            <img src={company.coverImage} alt={company.name} className="w-full h-full object-cover" />
          </div>
        )}
        <div className={`p-5 md:p-6 ${company.coverImage ? '-mt-10' : ''}`}>
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className={`w-20 h-20 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center text-2xl font-black border-4 ${milk ? 'bg-white border-white shadow-lg' : 'bg-[#0d1832] border-[#0d1832] shadow-lg'}`}>
              {company.logoUrl ? (
                <img src={company.logoUrl} alt={company.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-amber-400">{(company.name || '-').charAt(0)}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className={`text-xl md:text-2xl font-black ${th.strongText}`}>{company.name}</h1>
                {company.isVerified && <VerifiedBadge milk={milk} t={t} />}
              </div>
              {(company.reviewsCount || 0) > 0 && (
                <div className="mt-1.5 flex items-center gap-2">
                  <Stars rating={company.averageRating || 0} size={15} />
                  <span className={`text-[11px] font-black ${th.textMuted}`}>
                    {company.averageRating?.toFixed(1)} ({company.reviewsCount} {company.reviewsCount === 1 ? t('review') : t('reviews')})
                  </span>
                </div>
              )}
              {company.category && (
                <span className={`inline-flex items-center gap-1 text-[10px] font-black ${th.chipText} ${th.chip} ${th.chipBorder} px-2 py-0.5 rounded-full mt-1`}>
                  <Store className="w-3 h-3" /> {company.category}
                </span>
              )}
              <p className={`text-xs ${th.textMuted} font-medium mt-2 max-w-2xl`}>{company.description}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5 text-[11px] font-bold">
                <span className={`flex items-center gap-1 ${th.textDim}`}>
                  <MapPin className="w-3.5 h-3.5" /> {[company.region, company.district, company.ward].filter(Boolean).join(', ')}
                </span>
                {distanceKm !== null && (
                  <span className={`flex items-center gap-1 ${th.chipText}`}>
                    <MapPin className="w-3.5 h-3.5" /> {distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)}km`} {t('from you')}
                  </span>
                )}
                {company.phone && (
                  <a href={`tel:${company.phone}`} className={`flex items-center gap-1 ${th.textMuted} hover:underline`}>
                    <Phone className="w-3.5 h-3.5" /> {company.phone}
                  </a>
                )}
              </div>
            </div>
            <div className={`shrink-0 px-4 py-3 rounded-2xl text-center ${milk ? 'bg-amber-50 border border-amber-200' : 'bg-amber-400/10 border border-amber-400/30'}`}>
              <div className={`text-lg font-black ${th.statValue}`}>{products.length}</div>
              <div className={`text-[9px] ${th.textDim} font-black uppercase tracking-wider`}>{t('Products')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Search + category filter */}
      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${th.textDim}`} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('Tafuta bidhaa...')}
            className={th.input + ' pl-9'}
          />
        </div>
        {categories.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setCategory(null)}
              className={`shrink-0 px-3 py-2 text-[10px] font-black rounded-lg transition cursor-pointer ${category === null ? `${th.btnPrimary} ${th.btnPrimaryText}` : `${th.card} ${th.cardBorder} ${th.textMuted}`}`}
            >
              {t('All')}
            </button>
            {categories.map(c => (
              <button
                key={c}
                onClick={() => setCategory(category === c ? null : c)}
                className={`shrink-0 px-3 py-2 text-[10px] font-black rounded-lg transition cursor-pointer ${category === c ? `${th.btnPrimary} ${th.btnPrimaryText}` : `${th.card} ${th.cardBorder} ${th.textMuted}`}`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Products */}
      {visible.length === 0 ? (
        <div className={`${th.card} ${th.cardBorder} rounded-2xl p-10 text-center`}>
          <Package className={`w-10 h-10 mx-auto mb-3 ${th.textDim}`} />
          <div className={`text-sm font-black ${th.strongText}`}>{t('Hakuna bidhaa zilizopatikana')}</div>
          <div className={`text-[11px] ${th.textMuted} font-semibold mt-1`}>{t('Try a different search term.')}</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {visible.map(p => (
            <React.Fragment key={p.id}>
            <ProductCard
              product={p}
              theme={theme}
              t={t}
              companyName={company.name}
              onOpen={() => onOpenProduct(p)}
              onAddToCart={() => onAddToCart(p)}
            />
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Map — Feature 4 "Njoo Dukani" with directions */}
      {(hasCoords || company.addressText) && (
        <section>
          <h2 className={`text-sm font-black ${th.strongText} mb-2 flex items-center gap-1.5`}>
            <Grid3x3 className="w-4 h-4" /> {t('Company Location')} — {t('Njoo Dukani')}
          </h2>
          <StoreMapCard company={company} theme={theme} t={t} />
        </section>
      )}

      {/* Sticky cart bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-4 inset-x-0 z-40 px-4 max-w-2xl mx-auto">
          <button
            onClick={onOpenCart}
            className={`w-full flex items-center justify-between px-5 py-3.5 rounded-2xl shadow-2xl text-white transition cursor-pointer bg-gradient-to-r from-yellow-500 to-amber-600 hover:brightness-110`}
          >
              <span className="flex items-center gap-2.5 text-sm font-black">
                <span className="relative">
                  <ShoppingCart className="w-5 h-5" />
                  <span className="absolute -top-2 -right-2 w-4.5 h-4.5 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">{cartCount}</span>
                </span>
                {t('View Cart')}
              </span>
            <span className="text-sm font-black">{TZS(cartTotal)}</span>
          </button>
        </div>
      )}
    </div>
  );
}
