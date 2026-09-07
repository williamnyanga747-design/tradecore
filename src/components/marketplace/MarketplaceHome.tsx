import React, { useMemo, useState } from 'react';
import { Store, Package, BadgeCheck, ArrowRight, ShoppingBag, HandCoins, Users, Gift, MessageCircle, Video, Bike, Mic, QrCode, Percent, UserPlus } from 'lucide-react';
import { Company, MarketplaceProduct } from '../../types';
import { getPublicTheme, PublicTheme } from '../../utils/publicTheme';
import MarketplaceHero from './MarketplaceHero';
import MarketplaceDirectory from './MarketplaceDirectory';
import MarketplaceHomeCarousels from './MarketplaceHomeCarousels';
import { ProductCard, TFunc, isProductVisible } from './MarketplaceShared';

interface Props {
  theme: PublicTheme;
  t: TFunc;
  regions?: string[];
  companies: Company[];
  products: MarketplaceProduct[];
  onOpenCompany: (slug: string) => void;
  onOpenProduct: (product: MarketplaceProduct) => void;
  onTrackOrder: () => void;
  onAddToCart: (product: MarketplaceProduct) => void;
  onNavigate?: (path: string) => void;
  onOpenWakala?: () => void;
  onOpenQr?: () => void;
  voiceEnabled?: boolean;
  qr5Enabled?: boolean;
  qr5DiscountPercent?: number;
  offerCount?: number;
  groupDealCount?: number;
  liveCount?: number;
}

export default function MarketplaceHome({ theme, t, regions, companies, products, onOpenCompany, onOpenProduct, onTrackOrder, onAddToCart, onNavigate, onOpenWakala, onOpenQr, voiceEnabled = true, qr5Enabled = false, qr5DiscountPercent = 5, offerCount = 0, groupDealCount = 0, liveCount = 0 }: Props) {
  const th = getPublicTheme(theme);
  const activeCompanies = useMemo(() => companies.filter(c => c.isMarketplaceActive !== false), [companies]);
  const activeProducts = useMemo(() => products.filter(isProductVisible), [products]);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    activeProducts.forEach(p => {
      const cat = p.category || 'General';
      map.set(cat, (map.get(cat) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [activeProducts]);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const featured = useMemo(() => {
    let list = activeProducts;
    if (selectedCategory) list = list.filter(p => (p.category || 'General') === selectedCategory);
    return list.slice(0, 8);
  }, [activeProducts, selectedCategory]);

  const companyNameFor = (companyId: number) => activeCompanies.find(c => c.id === companyId)?.name || '';

  const scrollToDirectory = () => {
    document.getElementById('companies')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="space-y-10">
      {/* Amazon-style carousels: hero slider + product marquee + company marquee + deal of the day */}
      <MarketplaceHomeCarousels
        theme={theme}
        t={t}
        companies={companies}
        products={products}
        onOpenCompany={onOpenCompany}
        onOpenProduct={onOpenProduct}
      />

      <MarketplaceHero
        theme={theme}
        t={t}
        stats={{
          companies: activeCompanies.length,
          products: activeProducts.length,
          verified: activeCompanies.filter(c => c.isVerified).length
        }}
        onShopNow={scrollToDirectory}
        onTrackOrder={onTrackOrder}
      />

      {/* Phase 2C feature quick links */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-3">
        {[
          { icon: HandCoins, label: t('Piga Bei'), sub: t('Negotiate any price'), path: '/marketplace/offers', color: 'text-orange-500', count: offerCount },
          { icon: Users, label: t('Nunua Pamoja'), sub: t('Group deals for big savings'), path: '/marketplace/deals', color: 'text-indigo-500', count: groupDealCount },
          { icon: Gift, label: t('Loyalty Points'), sub: t('Earn & redeem rewards'), path: '/marketplace/loyalty', color: 'text-amber-500', count: 0 },
          { icon: Video, label: t('Live Shopping'), sub: t('Buy in real time'), path: '/marketplace/live-shopping', color: 'text-rose-500', count: liveCount },
          { icon: MessageCircle, label: t('WhatsApp Bot'), sub: t('Chat to order'), path: '/marketplace/whatsapp-bot', color: 'text-emerald-500', count: 0 }
        ].map((f, i) => (
          <button
            key={i}
            onClick={() => onNavigate && onNavigate(f.path)}
            className={`${th.card} ${th.cardBorder} rounded-2xl p-3.5 text-left transition hover:brightness-110 hover:-translate-y-0.5 cursor-pointer`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <f.icon className={`w-4 h-4 ${f.color}`} />
              {f.count > 0 && (
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${th.btnPrimary} ${th.btnPrimaryText}`}>{f.count}</span>
              )}
            </div>
            <div className={`text-[11px] font-black ${th.strongText}`}>{f.label}</div>
            <div className={`text-[9px] ${th.textMuted} font-semibold`}>{f.sub}</div>
          </button>
        ))}
        <button
          onClick={onTrackOrder}
          className={`${th.card} ${th.cardBorder} rounded-2xl p-3.5 text-left transition hover:brightness-110 hover:-translate-y-0.5 cursor-pointer`}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Bike className="w-4 h-4 text-sky-500" />
          </div>
          <div className={`text-[11px] font-black ${th.strongText}`}>{t('Track Delivery')}</div>
          <div className={`text-[9px] ${th.textMuted} font-semibold`}>{t('Follow your bodaboda rider')}</div>
        </button>
      </section>

      {/* New feature promo band: voice search, QR5 discount, wakala program */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        {voiceEnabled && (
          <button
            onClick={() => onNavigate && onNavigate('/marketplace/search')}
            className={`${th.card} ${th.cardBorder} rounded-2xl p-5 text-left transition hover:brightness-110 hover:-translate-y-0.5 cursor-pointer relative overflow-hidden`}
          >
            <div className={`absolute -top-4 -right-4 w-20 h-20 rounded-full ${th.btnPrimary} opacity-20`} />
            <Mic className={`w-6 h-6 ${th.textMuted}`} />
            <div className={`text-xs font-black ${th.strongText} mt-2`}>{t('Tafta kwa Sauti')}</div>
            <div className={`text-[10px] ${th.textMuted} font-semibold mt-1 leading-relaxed`}>{t('Say what you need in Kiswahili — sema "viatu", tafuta papo hapo.')}</div>
          </button>
        )}
        {qr5Enabled && (
          <button
            onClick={onOpenQr}
            className={`${th.card} ${th.cardBorder} rounded-2xl p-5 text-left transition hover:brightness-110 hover:-translate-y-0.5 cursor-pointer relative overflow-hidden`}
          >
            <div className={`absolute -top-4 -right-4 w-20 h-20 rounded-full bg-emerald-500 opacity-20`} />
            <QrCode className="w-6 h-6 text-emerald-500" />
            <div className={`text-xs font-black ${th.strongText} mt-2`}>{t('QR5 Discount')}</div>
            <div className={`text-[10px] ${th.textMuted} font-semibold mt-1 leading-relaxed`}>{t('Scan the duka la mtaa QR code and get')} {qr5DiscountPercent}% {t('off your order instantly.')}</div>
          </button>
        )}
        <button
          onClick={onOpenWakala}
          className={`${th.card} ${th.cardBorder} rounded-2xl p-5 text-left transition hover:brightness-110 hover:-translate-y-0.5 cursor-pointer relative overflow-hidden`}
        >
          <div className={`absolute -top-4 -right-4 w-20 h-20 rounded-full bg-amber-500 opacity-20`} />
          <UserPlus className="w-6 h-6 text-amber-500" />
          <div className={`text-xs font-black ${th.strongText} mt-2`}>{t('Kuwa Wakala')}</div>
          <div className={`text-[10px] ${th.textMuted} font-semibold mt-1 leading-relaxed`}>{t('Earn commission on every sale you refer to duka la mtaa.')}</div>
        </button>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className={`text-base font-black ${th.strongText}`}>{t('Browse by Category')}</h2>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`shrink-0 flex items-center gap-1.5 px-4 py-2 text-[11px] font-black rounded-full transition cursor-pointer ${
                selectedCategory === null
                  ? `${th.btnPrimary} ${th.btnPrimaryText}`
                  : `${th.card} ${th.cardBorder} ${th.textMuted} hover:brightness-110`
              }`}
            >
              <Package className="w-3.5 h-3.5" /> {t('All')}
            </button>
            {categories.map(([cat, count]) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                className={`shrink-0 flex items-center gap-1.5 px-4 py-2 text-[11px] font-black rounded-full transition cursor-pointer ${
                  selectedCategory === cat
                    ? `${th.btnPrimary} ${th.btnPrimaryText}`
                    : `${th.card} ${th.cardBorder} ${th.textMuted} hover:brightness-110`
                }`}
              >
                {cat} <span className="opacity-60">({count})</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Featured products */}
      <section id="featured-products" className="scroll-mt-24">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className={`text-base font-black ${th.strongText}`}>{selectedCategory ? selectedCategory : t('Featured Products')}</h2>
            <p className={`text-[11px] ${th.textDim} font-semibold`}>{t('Fresh stock from verified sellers')}</p>
          </div>
        </div>
        {featured.length === 0 ? (
          <div className={`${th.card} ${th.cardBorder} rounded-2xl p-8 text-center`}>
            <Package className={`w-8 h-8 mx-auto mb-2 ${th.textDim}`} />
            <div className={`text-sm font-black ${th.strongText}`}>{t('Hakuna bidhaa katika category hii')}</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {featured.map(p => (
              <React.Fragment key={p.id}>
              <ProductCard
                product={p}
                theme={theme}
                t={t}
                compact
                companyName={companyNameFor(p.companyId)}
                onOpen={() => onOpenProduct(p)}
                onAddToCart={() => onAddToCart(p)}
              />
              </React.Fragment>
            ))}
          </div>
        )}
      </section>

      {/* Companies directory */}
      <section id="companies" className="scroll-mt-24">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className={`text-base font-black ${th.strongText}`}>{t('Registered Companies')}</h2>
            <p className={`text-[11px] ${th.textDim} font-semibold`}>{t('Find a company near you or by region')}</p>
          </div>
          <span className={`flex items-center gap-1.5 text-[10px] ${th.textDim} font-bold`}>
            <BadgeCheck className="w-3.5 h-3.5 text-emerald-500" /> {t('Verified by staff')}
          </span>
        </div>
        <MarketplaceDirectory
          companies={activeCompanies}
          products={activeProducts}
          theme={theme}
          t={t}
          regions={regions}
          onOpenCompany={onOpenCompany}
          maxCards={6}
        />
      </section>

      {/* How it works */}
      <section className={`${th.card} ${th.cardBorder} rounded-3xl p-6 md:p-8`}>
        <h2 className={`text-base font-black ${th.strongText} mb-5 text-center`}>{t('Jinsi Inavyofanya Kazi')}</h2>
        <div className="grid sm:grid-cols-4 gap-4">
          {[
            { icon: Store, step: '1', title: 'Chagua Kampuni', desc: t('Pick a verified company from the directory.') },
            { icon: ShoppingBag, step: '2', title: 'Agiza Bidhaa', desc: t('Add products to your cart and checkout.') },
            { icon: BadgeCheck, step: '3', title: 'Lipia & Thibitisha', desc: t('Pay via mobile money and upload the receipt.') },
            { icon: Package, step: '4', title: 'Subiri Ufikishwe', desc: t('Staff verify, then your order is delivered.') }
          ].map(s => (
            <div key={s.step} className="text-center">
              <div className={`w-11 h-11 mx-auto rounded-2xl flex items-center justify-center ${th.btnPrimary} relative mb-3`}>
                <s.icon className={`w-5 h-5 ${th.btnPrimaryText}`} />
                <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-black flex items-center justify-center">{s.step}</span>
              </div>
              <div className={`text-xs font-black ${th.strongText}`}>{t(s.title)}</div>
              <div className={`text-[10px] ${th.textMuted} font-semibold mt-1 leading-relaxed max-w-[180px] mx-auto`}>{s.desc}</div>
            </div>
          ))}
        </div>
        <div className="text-center mt-6">
          <button onClick={scrollToDirectory} className={`inline-flex items-center gap-2 px-5 py-2.5 text-[11px] font-black rounded-xl uppercase tracking-wider transition cursor-pointer ${th.btnPrimary} ${th.btnPrimaryText}`}>
            {t('Start Shopping')} <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>
    </div>
  );
}

