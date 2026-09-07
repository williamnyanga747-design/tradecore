import React, { useMemo } from 'react';
import { ChevronLeft, MapPin, Store, Package } from 'lucide-react';
import { Company, MarketplaceProduct } from '../../types';
import { getPublicTheme, PublicTheme } from '../../utils/publicTheme';
import { TANZANIA_REGIONS, regionCenter } from '../../utils/regions';
import { slugify, resolveCompanyCoords, jitterCompanyCoords } from '../../utils/haversine';
import { ProductCard, TFunc, VerifiedBadge, isProductVisible } from './MarketplaceShared';
import LeafletMap from './LeafletMap';

interface Props {
  theme: PublicTheme;
  t: TFunc;
  regionSlug: string;
  regions?: string[];
  companies: Company[];
  products: MarketplaceProduct[];
  onBack: () => void;
  onOpenCompany: (slug: string) => void;
  onOpenProduct: (product: MarketplaceProduct) => void;
  onAddToCart: (product: MarketplaceProduct) => void;
}

export function resolveRegionName(slug: string, regions?: string[]): string {
  const list = regions && regions.length > 0 ? regions : TANZANIA_REGIONS;
  const s = slug.toLowerCase();
  return list.find(r => slugify(r) === s) || '';
}

export default function MarketplaceRegion({
  theme, t, regionSlug, regions, companies, products, onBack, onOpenCompany, onOpenProduct, onAddToCart
}: Props) {
  const th = getPublicTheme(theme);
  const regionName = useMemo(() => resolveRegionName(regionSlug, regions), [regionSlug, regions]);

  const regionCompanies = useMemo(() => {
    if (!regionName) return [];
    return companies
      .filter(c => c.isMarketplaceActive !== false)
      .filter(c => (c.region || '').toLowerCase() === regionName.toLowerCase());
  }, [companies, regionName]);

  const visibleProducts = useMemo(
    () => products.filter(p => p.isActive !== false && (p.status === undefined || p.status === 'approved')),
    [products]
  );

  if (!regionName) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 pb-16">
        <button onClick={onBack} className={`flex items-center gap-1.5 text-[11px] font-bold ${th.textMuted} hover:underline cursor-pointer`}>
          <ChevronLeft className="w-4 h-4" /> {t('Back to Marketplace')}
        </button>
        <div className={`${th.card} ${th.cardBorder} rounded-2xl p-10 text-center`}>
          <Package className={`w-10 h-10 mx-auto mb-3 ${th.textDim}`} />
          <div className={`text-sm font-black ${th.strongText}`}>{t('Region haipatikani')}</div>
          <div className={`text-[11px] ${th.textMuted} font-semibold mt-1`}>{t('The region you are looking for does not exist.')}</div>
        </div>
      </div>
    );
  }

  const totalProducts = regionCompanies.reduce(
    (sum, c) => sum + visibleProducts.filter(p => p.companyId === c.id).length,
    0
  );

  return (
    <div className="space-y-8 pb-16">
      <button onClick={onBack} className={`flex items-center gap-1.5 text-[11px] font-bold ${th.textMuted} hover:underline cursor-pointer`}>
        <ChevronLeft className="w-4 h-4" /> {t('Back to Marketplace')}
      </button>

      {/* Region header */}
      <div className={`${th.card} ${th.cardBorder} rounded-3xl p-6 md:p-8 relative overflow-hidden`}>
        <div className={`absolute -top-16 -right-16 w-64 h-64 rounded-full blur-3xl ${th.heroBlobA}`}></div>
        <div className="relative">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-amber-500 mb-2">
            <MapPin className="w-3.5 h-3.5" /> {t('Mkoa')}
          </div>
          <h1 className={`text-2xl md:text-3xl font-black ${th.strongText}`}>{t('Bidhaa zote')} {regionName}</h1>
          <p className={`text-[11px] ${th.textMuted} font-semibold mt-2`}>
            {regionCompanies.length} {regionCompanies.length === 1 ? t('company') : t('companies')} · {totalProducts} {totalProducts === 1 ? t('product') : t('products')} {t('from this region')}
          </p>
        </div>
      </div>

      {/* Map of every company in this region */}
      {(() => {
        const rc = regionCenter(regionName);
        if (!rc) return null;
        const markers = regionCompanies.map(c => {
          const hasOwnCoords = typeof c.latitude === 'number' && typeof c.longitude === 'number' && isFinite(c.latitude);
          const resolved = resolveCompanyCoords(c.latitude, c.longitude, c.region);
          if (!resolved) return null;
          const coords = hasOwnCoords ? resolved : jitterCompanyCoords(resolved.lat, resolved.lng, c.id);
          return {
            lat: coords.lat,
            lng: coords.lng,
            title: c.name,
            popupHtml: `<div style="min-width:180px"><b>${c.name}</b><br/>${[c.region, c.district, c.ward].filter(Boolean).join(', ') || ''}<br/><a href="/company/${c.slug}" style="display:inline-block;margin-top:6px;background:#eab308;color:#1f2937;font-weight:700;font-size:11px;padding:4px 10px;border-radius:8px;text-decoration:none">${t('Angalia Bidhaa')}</a></div>`
          };
        }).filter((m): m is NonNullable<typeof m> => m !== null);
        return (
          <LeafletMap
            center={rc}
            markers={markers}
            zoom={8}
            className="h-80 rounded-3xl overflow-hidden"
            scrollWheelZoom
          />
        );
      })()}

      {/* Companies & products in this region */}
      {regionCompanies.length === 0 ? (
        <div className={`${th.card} ${th.cardBorder} rounded-2xl p-10 text-center`}>
          <Store className={`w-10 h-10 mx-auto mb-3 ${th.textDim}`} />
          <div className={`text-sm font-black ${th.strongText}`}>{t('Hakuna kampuni katika mkoa huu bado')}</div>
          <div className={`text-[11px] ${th.textMuted} font-semibold mt-1`}>{t('Check back soon — new verified companies are added regularly.')}</div>
        </div>
      ) : (
        regionCompanies.map(c => {
          const prods = visibleProducts.filter(p => p.companyId === c.id);
          return (
            <section key={c.id}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center text-base font-black shrink-0 ${milkIcon(theme)}`}>
                  {c.logoUrl ? (
                    <img src={c.logoUrl} alt={c.name} className="w-full h-full object-cover" />
                  ) : (
                    (c.name || '-').charAt(0)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <button
                    onClick={() => c.slug && onOpenCompany(c.slug)}
                    className={`text-sm font-black ${th.strongText} hover:underline truncate block cursor-pointer`}
                  >
                    {c.name}
                  </button>
                  <div className={`text-[10px] ${th.textDim} font-semibold flex items-center gap-1`}>
                    <MapPin className="w-3 h-3" /> {[c.region, c.district, c.ward].filter(Boolean).join(', ') || (c.country || '')}
                  </div>
                </div>
                {c.isVerified && <VerifiedBadge milk={theme === 'milk'} t={t} />}
              </div>

              {prods.length === 0 ? (
                <div className={`${th.card} ${th.cardBorder} rounded-2xl p-6 text-center`}>
                  <div className={`text-[11px] ${th.textMuted} font-semibold`}>{t('Hakuna bidhaa bado')}</div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                  {prods.map(p => (
                    <React.Fragment key={p.id}>
                      <ProductCard
                        product={p}
                        theme={theme}
                        t={t}
                        companyName={c.name}
                        onOpen={() => onOpenProduct(p)}
                        onAddToCart={() => onAddToCart(p)}
                      />
                    </React.Fragment>
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}

function milkIcon(theme: PublicTheme): string {
  return theme === 'milk' ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/15 text-amber-300';
}
