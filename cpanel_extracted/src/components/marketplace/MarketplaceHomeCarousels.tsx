import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ShoppingBag, Store, BadgeCheck, MapPin, Star, Flame } from 'lucide-react';
import { Company, MarketplaceProduct } from '../../types';
import { getPublicTheme, PublicTheme } from '../../utils/publicTheme';
import { TZS, TFunc, ProductImage, RatingChip } from './MarketplaceShared';

interface CarouselProps {
  theme: PublicTheme;
  t: TFunc;
  companies: Company[];
  products: MarketplaceProduct[];
  onOpenCompany: (slug: string) => void;
  onOpenProduct: (product: MarketplaceProduct) => void;
}

const HERO_HEIGHT = 'h-[420px] md:h-[520px]';
const MARQUEE_DURATION_PRODUCTS = 48;
const MARQUEE_DURATION_COMPANIES = 32;

export default function MarketplaceHomeCarousels({ theme, t, companies, products, onOpenCompany, onOpenProduct }: CarouselProps) {
  const activeProducts = useMemo(() => products.filter(p => p.isActive !== false && (p.status === undefined || p.status === 'approved')), [products]);
  const activeCompanies = useMemo(() => companies.filter(c => c.isMarketplaceActive !== false), [companies]);

  const companyById = useMemo(() => {
    const m = new Map<number, Company>();
    activeCompanies.forEach(c => m.set(c.id, c));
    return m;
  }, [activeCompanies]);

  const heroProducts = useMemo(() => activeProducts.slice(0, 20), [activeProducts]);

  const topSelling = useMemo(() => {
    return [...activeProducts]
      .sort((a, b) => (b.reviewsCount || 0) - (a.reviewsCount || 0) || (b.averageRating || 0) - (a.averageRating || 0))
      .slice(0, 12);
  }, [activeProducts]);

  const verifiedCompanies = useMemo(() => {
    const countByCompany = new Map<number, number>();
    activeProducts.forEach(p => countByCompany.set(p.companyId, (countByCompany.get(p.companyId) || 0) + 1));
    return activeCompanies
      .filter(c => c.isVerified && (countByCompany.get(c.id) || 0) > 0)
      .sort((a, b) => (b.reviewsCount || 0) - (a.reviewsCount || 0))
      .slice(0, 15)
      .map(c => ({ company: c, count: countByCompany.get(c.id) || 0 }));
  }, [activeCompanies, activeProducts]);

  const scrollToFeatured = () => {
    document.getElementById('featured-products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="space-y-8">
      <HeroSlider
        theme={theme}
        t={t}
        products={heroProducts}
        companyById={companyById}
        onOpenCompany={onOpenCompany}
        onOpenProduct={onOpenProduct}
      />

      {topSelling.length > 0 && (
        <ProductMarquee
          theme={theme}
          t={t}
          products={topSelling}
          companyById={companyById}
          onOpenProduct={onOpenProduct}
          onViewAll={scrollToFeatured}
        />
      )}

      {verifiedCompanies.length > 0 && (
        <CompanyMarquee theme={theme} t={t} companies={verifiedCompanies} onOpenCompany={onOpenCompany} />
      )}

      <DealOfTheDay t={t} onGetDeal={scrollToFeatured} />
    </div>
  );
}

function HeroSlider({ theme, t, products, companyById, onOpenCompany, onOpenProduct }: {
  theme: PublicTheme;
  t: TFunc;
  products: MarketplaceProduct[];
  companyById: Map<number, Company>;
  onOpenCompany: (slug: string) => void;
  onOpenProduct: (product: MarketplaceProduct) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = products.length;

  useEffect(() => {
    setIdx(0);
  }, [count]);

  useEffect(() => {
    if (count < 2 || paused) return;
    const id = setInterval(() => setIdx(i => (i + 1) % count), 4500);
    return () => clearInterval(id);
  }, [count, paused]);

  const go = (dir: 1 | -1) => {
    if (count === 0) return;
    setIdx(i => (i + dir + count) % count);
  };

  if (count === 0) {
    return (
      <section className={`relative w-full overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center ${HERO_HEIGHT}`}>
        <div className="text-center text-white px-6">
          <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-60" />
          <div className="text-xl font-black">{t('No products yet')}</div>
          <div className="text-sm opacity-70 mt-1 max-w-sm">{t('Fresh stock from verified sellers')}</div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`relative w-full overflow-hidden rounded-3xl bg-gray-900 ${HERO_HEIGHT}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="h-full flex transition-transform duration-700 ease-out"
        style={{ transform: `translateX(-${idx * 100}%)` }}
      >
        {products.map(p => {
          const company = companyById.get(p.companyId);
          return (
            <div key={p.id} className="relative h-full w-full shrink-0">
              <ProductImage product={p} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-transparent" />
              <div className="absolute inset-0 flex items-center">
                <div className="ml-5 md:ml-14 max-w-2xl text-white">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    {company?.isVerified && (
                      <span className="inline-flex items-center gap-1 bg-white/20 backdrop-blur px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                        <BadgeCheck className="w-3.5 h-3.5" /> {t('Verified')}
                      </span>
                    )}
                    {company?.region && (
                      <span className="inline-flex items-center gap-1 bg-[#00a99d] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                        <MapPin className="w-3 h-3" /> {company.region}
                      </span>
                    )}
                  </div>
                  <h1 className="text-2xl md:text-4xl font-black leading-tight line-clamp-2">{p.name}</h1>
                  <p className="mt-3 text-lg md:text-xl font-extrabold">
                    {TZS(p.price)}
                    {(p.reviewsCount || 0) > 0 && (
                      <span className="ml-3 inline-flex items-center gap-1 text-base font-bold align-middle">
                        <Star className="w-4 h-4 text-amber-400" fill="currentColor" /> {Number(p.averageRating || 0).toFixed(1)} ({p.reviewsCount})
                      </span>
                    )}
                  </p>
                  <div className="mt-6 flex gap-3 flex-wrap">
                    <button
                      onClick={() => onOpenProduct(p)}
                      className="inline-flex items-center gap-2 bg-[#00a99d] hover:bg-[#0d9488] px-7 py-3 rounded-full font-black text-sm text-white transition cursor-pointer"
                    >
                      {t('Buy Now')} <ChevronRight className="w-4 h-4" />
                    </button>
                    {company && (
                      <button
                        onClick={() => onOpenCompany(company.slug || String(company.id))}
                        className="bg-white/20 backdrop-blur hover:bg-white/30 px-6 py-3 rounded-full font-bold text-sm transition cursor-pointer"
                      >
                        {t('View Shop')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {count > 1 && (
        <>
          <button
            onClick={() => go(-1)}
            aria-label="Previous"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur flex items-center justify-center text-white transition cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => go(1)}
            aria-label="Next"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur flex items-center justify-center text-white transition cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            {products.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setIdx(i)}
                aria-label={`Slide ${i + 1}`}
                className={`h-2 rounded-full transition-all cursor-pointer ${i === idx ? 'w-6 bg-white' : 'w-2 bg-white/40 hover:bg-white/70'}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function ProductMarquee({ theme, t, products, companyById, onOpenProduct, onViewAll }: {
  theme: PublicTheme;
  t: TFunc;
  products: MarketplaceProduct[];
  companyById: Map<number, Company>;
  onOpenProduct: (product: MarketplaceProduct) => void;
  onViewAll: () => void;
}) {
  const th = getPublicTheme(theme);
  const row = useMemo(() => [...products, ...products], [products]);

  return (
    <div className={`relative z-20 -mt-10 mx-3 md:mx-8 ${th.card} ${th.cardBorder} rounded-2xl shadow-xl p-4 md:p-6`}>
      <div className="flex justify-between items-center mb-4">
        <h2 className={`font-black text-base md:text-lg flex items-center gap-2 ${th.strongText}`}>
          <Flame className="w-5 h-5 text-orange-500" /> {t('Top Selling Today')}
          <span className={`font-semibold text-xs hidden md:inline ${th.textDim}`}>{t('Fresh stock from verified sellers')}</span>
        </h2>
        <button onClick={onViewAll} className={`text-[#00a99d] font-black text-xs hover:underline cursor-pointer`}>
          {t('View All')} <ChevronRight className="w-3.5 h-3.5 inline" />
        </button>
      </div>

      <div className="marquee overflow-hidden py-1">
        <div className="marquee-track flex w-max gap-3.5 pr-3.5">
          {row.map((p, i) => {
            const company = companyById.get(p.companyId);
            return (
              <button key={`${p.id}-${i}`} onClick={() => onOpenProduct(p)} className="w-[185px] shrink-0 text-left group cursor-pointer">
                <div className={`bg-gray-50 dark:bg-gray-800/60 rounded-xl overflow-hidden group-hover:shadow-lg transition p-2`}>
                  <div className="h-32 overflow-hidden rounded-lg">
                    <ProductImage product={p} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-2">
                    <p className={`font-bold text-xs truncate ${th.strongText}`}>{p.name}</p>
                    <p className={`text-[10px] text-gray-500 dark:text-gray-400 truncate`}>
                      <Store className="w-3 h-3 inline -mt-0.5" /> {company?.name || t('Store')}{company?.region ? ` • ${company.region}` : ''}
                    </p>
                    <p className="text-[#00a99d] font-extrabold text-sm mt-1">{TZS(p.price)}</p>
                    {(p.reviewsCount || 0) > 0 ? (
                      <p className="text-[10px] mt-1">
                        <RatingChip rating={p.averageRating || 0} count={p.reviewsCount || 0} t={t} />
                      </p>
                    ) : (
                      <p className={`text-[10px] text-gray-400 dark:text-gray-500 mt-1 font-semibold`}>{t('New Arrival')}</p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <style>{`@keyframes tc-marquee-a { from { transform: translateX(0); } to { transform: translateX(-50%); } } .marquee-track { animation: tc-marquee-a ${MARQUEE_DURATION_PRODUCTS}s linear infinite; } .marquee:hover .marquee-track { animation-play-state: paused; }`}</style>
    </div>
  );
}

function CompanyMarquee({ theme, t, companies, onOpenCompany }: {
  theme: PublicTheme;
  t: TFunc;
  companies: Array<{ company: Company; count: number }>;
  onOpenCompany: (slug: string) => void;
}) {
  const th = getPublicTheme(theme);
  const row = useMemo(() => [...companies, ...companies], [companies]);

  return (
    <div className={`bg-gray-50 dark:bg-gray-900/40 py-6 rounded-2xl`}>
      <div className="px-4 md:px-8 flex justify-between items-center mb-4">
        <h2 className={`font-black text-base flex items-center gap-2 ${th.strongText}`}>
          <Store className="w-5 h-5 text-[#00a99d]" /> {t('Verified Companies')}
        </h2>
        <span className={`text-[10px] bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-3 py-1 rounded-full font-black uppercase tracking-wider`}>
          <BadgeCheck className="w-3 h-3 inline -mt-0.5" /> {t('Verified Only')}
        </span>
      </div>

      <div className="company-marquee overflow-hidden px-2">
        <div className="company-marquee-track flex w-max gap-3.5 px-2">
          {row.map(({ company, count }, i) => (
            <button key={`${company.id}-${i}`} onClick={() => onOpenCompany(company.slug || String(company.id))} className="w-[260px] shrink-0 text-left group cursor-pointer">
              <div className={`${th.card} ${th.cardBorder} rounded-xl shadow-sm hover:shadow-md transition p-4 flex flex-col gap-3 h-full`}>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full overflow-hidden border flex items-center justify-center shrink-0">
                    {company.logoUrl ? (
                      <img src={company.logoUrl} alt={company.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-yellow-400 to-amber-600 text-white font-black text-lg">
                        {(company.name || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-xs truncate ${th.strongText}`}>
                      {company.name} <BadgeCheck className="w-3.5 h-3.5 inline text-blue-600 -mt-0.5" />
                    </p>
                    <p className={`text-[10px] text-gray-500 dark:text-gray-400 truncate`}>
                      {company.region || 'Tanzania'} • {count} {t('products')}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <span className={`text-[10px] font-black bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded-full inline-flex items-center gap-1`}>
                    <MapPin className="w-3 h-3" /> {company.district || company.region || 'Tanzania'}
                  </span>
                  {(company.reviewsCount || 0) > 0 && (
                    <span className={`text-[10px] font-black bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full inline-flex items-center gap-1`}>
                      <Star className="w-3 h-3" fill="currentColor" /> {Number(company.averageRating || 0).toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <style>{`@keyframes tc-marquee-b { from { transform: translateX(0); } to { transform: translateX(-50%); } } .company-marquee-track { animation: tc-marquee-b ${MARQUEE_DURATION_COMPANIES}s linear infinite; } .company-marquee:hover .company-marquee-track { animation-play-state: paused; }`}</style>
    </div>
  );
}

function DealOfTheDay({ t, onGetDeal }: { t: TFunc; onGetDeal: () => void }) {
  const msToMidnight = () => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    return Math.max(0, midnight.getTime() - now.getTime());
  };
  const [ms, setMs] = useState(msToMidnight);
  useEffect(() => {
    const id = setInterval(() => setMs(msToMidnight()), 1000);
    return () => clearInterval(id);
  }, []);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="mx-1 md:mx-4 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl p-4 text-white flex flex-wrap items-center gap-4">
      <h3 className="font-black flex items-center gap-2">
        <Flame className="w-5 h-5" /> {t('Deal of the Day')}
      </h3>
      <div className="flex gap-1.5 font-mono font-bold text-black items-center">
        <span className="bg-white px-2 py-1 rounded min-w-[2rem] text-center">{pad(h)}</span>:
        <span className="bg-white px-2 py-1 rounded min-w-[2rem] text-center">{pad(m)}</span>:
        <span className="bg-white px-2 py-1 rounded min-w-[2rem] text-center">{pad(s)}</span>
      </div>
      <p className="text-sm opacity-95 font-semibold">{t('Discount up to 30% off today')}</p>
      <button
        onClick={onGetDeal}
        className="ml-auto bg-white text-red-600 px-5 py-2 rounded-full font-black text-xs transition hover:bg-red-50 cursor-pointer"
      >
        {t('Get Deal')} <ChevronRight className="w-3.5 h-3.5 inline" />
      </button>
    </div>
  );
}
