import React from 'react';
import { Search, ShoppingBag, ShieldCheck, Truck, Store, BadgeCheck, Package } from 'lucide-react';
import { getPublicTheme, PublicTheme } from '../../utils/publicTheme';
import { TFunc } from './MarketplaceShared';

interface Props {
  theme: PublicTheme;
  t: TFunc;
  stats: { companies: number; products: number; verified: number };
  onShopNow: () => void;
  onTrackOrder: () => void;
}

export default function MarketplaceHero({ theme, t, stats, onShopNow, onTrackOrder }: Props) {
  const th = getPublicTheme(theme);
  const milk = theme === 'milk';
  return (
    <section className={`relative overflow-hidden ${th.card} ${th.cardBorder} rounded-3xl`}>
      {/* decorative blobs */}
      <div className={`absolute -top-24 -right-24 w-80 h-80 rounded-full blur-3xl ${th.heroBlobA}`}></div>
      <div className={`absolute -bottom-32 -left-20 w-96 h-96 rounded-full blur-3xl ${th.heroBlobB}`}></div>

      <div className="relative px-6 md:px-10 py-10 md:py-14">
        <div className="flex flex-col lg:flex-row items-center gap-8">
          <div className="flex-1 text-center lg:text-left">
            <div className={`inline-flex items-center gap-2 ${th.chip} ${th.chipBorder} px-3 py-1.5 rounded-full mb-5`}>
              <BadgeCheck className={`w-4 h-4 ${th.chipText}`} />
              <span className={`text-[10px] font-black uppercase tracking-wider ${th.chipText}`}>{t('Verified Tanzanian Sellers')}</span>
            </div>
            <h1 className={`text-3xl md:text-5xl font-black leading-tight ${th.strongText}`}>
              {t('Pata Bidhaa Halisi,')}<br />
              <span className={`bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600`}>{t('Kutoka Kampuni Zilizothibitishwa.')}</span>
            </h1>
            <p className={`${th.textMuted} text-sm md:text-base font-medium mt-4 max-w-xl mx-auto lg:mx-0`}>
              {t('Browse wholesale and retail goods from registered Tanzanian companies — verified, with fair prices and delivery across all regions.')}
            </p>

            {/* Stats */}
            <div className="flex items-center justify-center lg:justify-start gap-6 mt-7">
              {[
                { value: stats.companies, label: t('Companies') },
                { value: stats.products, label: t('Products') },
                { value: stats.verified, label: t('Verified') }
              ].map(s => (
                <div key={s.label} className="text-center">
                  <div className={`text-2xl font-black ${th.statValue}`}>{s.value}</div>
                  <div className={`text-[10px] ${th.textDim} font-bold uppercase tracking-wider`}>{s.label}</div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex items-center justify-center lg:justify-start gap-3 flex-wrap">
              <button
                onClick={onShopNow}
                className={`inline-flex items-center gap-2.5 px-7 py-3.5 text-sm font-black rounded-2xl uppercase tracking-wide transition cursor-pointer ${th.btnPrimary} ${th.btnPrimaryText}`}
              >
                <ShoppingBag className="w-4.5 h-4.5" /> {t('Shop Now')}
              </button>
              <button
                onClick={onTrackOrder}
                className={`inline-flex items-center gap-2.5 px-6 py-3.5 text-sm font-black rounded-2xl uppercase tracking-wide transition cursor-pointer ${th.btnSecondary} ${th.btnSecondaryText}`}
              >
                <Package className="w-4.5 h-4.5" /> {t('Track Order')}
              </button>
            </div>
          </div>

          {/* Feature cards column */}
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3 w-full lg:w-80">
            {[
              { icon: ShieldCheck, title: t('Verified Sellers'), desc: t('Every company is checked by staff before listing.') },
              { icon: Truck, title: t('Nationwide Delivery'), desc: t('Orders delivered across all 26 regions.') },
              { icon: Store, title: t('Fair Prices'), desc: t('Direct wholesale prices, no middlemen.') }
            ].map(f => (
              <div key={f.title} className={`${milk ? 'bg-[#faf8f5]' : 'bg-white/5'} border ${th.cardBorder} rounded-2xl p-4 flex items-start gap-3`}>
                <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${th.btnPrimary}`}>
                  <f.icon className={`w-5 h-5 ${th.btnPrimaryText}`} />
                </div>
                <div>
                  <div className={`text-xs font-black ${th.strongText}`}>{f.title}</div>
                  <div className={`text-[10px] ${th.textMuted} font-semibold mt-0.5 leading-relaxed`}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

