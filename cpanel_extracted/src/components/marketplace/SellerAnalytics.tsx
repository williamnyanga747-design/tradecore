import React, { useMemo, useState } from 'react';
import { Eye, MessageCircle, Star, TrendingUp, Check, Calendar } from 'lucide-react';
import { Company, MarketplaceProduct, MarketplaceClick, Review, ProductView } from '../../types';
import { TFunc, Stars, TZS } from './MarketplaceShared';
import AnalyticsLineChart from './AnalyticsLineChart';

interface Props {
  companyId: number;
  company: Company;
  products: MarketplaceProduct[];
  clicks: MarketplaceClick[];
  reviews: Review[];
  productViews: ProductView[];
  t: TFunc;
}

const DAY = 24 * 60 * 60 * 1000;

function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Feature 5 — seller analytics dashboard. Views + WhatsApp clicks over the last
 * 14 days, top products table, review summary and a WhatsApp clicks log.
 */
export default function SellerAnalytics({ companyId, company, products, clicks, reviews, productViews, t }: Props) {
  const [range, setRange] = useState<7 | 14 | 30>(14);

  const companyViews = useMemo(() => productViews.filter(v => v.companyId === companyId), [productViews, companyId]);
  const companyClicks = useMemo(() => clicks.filter(c => c.type === 'whatsapp' && c.productId && products.some(p => p.id === c.productId)), [clicks, products]);
  const companyReviews = useMemo(() => reviews.filter(r => r.companyId === companyId), [reviews, companyId]);
  const approvedReviews = useMemo(() => companyReviews.filter(r => r.status === 'approved'), [companyReviews]);

  const now = useMemo(() => new Date(), []);
  const inRange = useMemo(() => {
    const cutoff = now.getTime() - range * DAY;
    return {
      views: companyViews.filter(v => new Date(v.viewedAt).getTime() >= cutoff),
      clicks: companyClicks.filter(c => new Date(c.createdAt).getTime() >= cutoff)
    };
  }, [companyViews, companyClicks, range, now]);

  const days = useMemo(() => {
    const arr: string[] = [];
    for (let i = range - 1; i >= 0; i--) arr.push(dayKey(new Date(now.getTime() - i * DAY)));
    return arr;
  }, [range, now]);

  const series = useMemo(() => {
    const views = days.map(d => companyViews.filter(v => dayKey(new Date(v.viewedAt)) === d).length);
    const clicksData = days.map(d => companyClicks.filter(c => dayKey(new Date(c.createdAt)) === d).length);
    return [
      { label: t('Product Views'), values: views, color: '#f59e0b' },
      { label: t('WhatsApp Clicks'), values: clicksData, color: '#22c55e' }
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, companyViews, companyClicks]);

  const topProducts = useMemo(() => {
    return products.map(p => {
      const views = companyViews.filter(v => v.productId === p.id).length;
      const waClicks = companyClicks.filter(c => c.productId === p.id).length;
      const productReviews = approvedReviews.filter(r => r.productId === p.id);
      const avg = productReviews.length ? productReviews.reduce((s, r) => s + r.rating, 0) / productReviews.length : 0;
      return { product: p, views, waClicks, reviews: productReviews.length, avg };
    }).sort((a, b) => (b.views + b.waClicks * 2) - (a.views + a.waClicks * 2)).slice(0, 8);
  }, [products, companyViews, companyClicks, approvedReviews]);

  const pendingCount = companyReviews.filter(r => r.status === 'pending').length;
  const avgRating = company.averageRating || 0;
  const stats = [
    { label: t('Product Views'), value: inRange.views.length, total: companyViews.length, icon: Eye, color: 'bg-amber-50 text-amber-600' },
    { label: t('WhatsApp Clicks'), value: inRange.clicks.length, total: companyClicks.length, icon: MessageCircle, color: 'bg-green-50 text-green-600' },
    { label: t('Reviews'), value: approvedReviews.length, total: pendingCount, icon: Star, color: 'bg-purple-50 text-purple-600' },
    { label: t('Average Rating'), value: avgRating ? avgRating.toFixed(1) : '—', total: 0, icon: TrendingUp, color: 'bg-blue-50 text-blue-600' }
  ];

  const recentClicks = useMemo(() => [...companyClicks].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12), [companyClicks]);

  return (
    <div className="space-y-4">
      {/* Range filter */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-gray-500 font-medium">{t('Performance of your storefront. Views update once per hour per device.')}</p>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {([7, 14, 30] as const).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 text-[10px] font-black rounded-md transition cursor-pointer ${range === r ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {r} {t('days')}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-4">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${s.color}`}>
              <s.icon className="w-4.5 h-4.5" />
            </div>
            <div className="text-xl font-black text-gray-900">{s.value}</div>
            <div className="text-[10px] font-black uppercase tracking-wider text-gray-400">{s.label}</div>
            {s.total > 0 && <div className="text-[10px] font-semibold text-gray-400 mt-0.5">{s.label === t('Reviews') ? `${s.total} ${t('pending approval')}` : `${s.total} ${t('all time')}`}</div>}
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-gray-400" />
          <h3 className="text-xs font-black text-gray-900">{t('Views & WhatsApp Clicks')} — {t('last')} {range} {t('days')}</h3>
        </div>
        <AnalyticsLineChart labels={days} series={series} height={220} emptyText={t('No activity yet — share your store link to get customers.')} />
      </div>

      {/* Top products */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <h3 className="text-xs font-black text-gray-900 mb-3">{t('Top Products')}</h3>
        {topProducts.length === 0 ? (
          <div className="text-xs text-gray-400 font-medium text-center py-6">{t('No products yet.')}</div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_auto] gap-2 text-[9px] font-black uppercase tracking-wider text-gray-400 px-2">
              <span>{t('Product')}</span>
              <span className="flex gap-4">
                <span className="w-12 text-right">{t('Views')}</span>
                <span className="w-12 text-right">{t('WhatsApp')}</span>
                <span className="w-12 text-right">{t('Rating')}</span>
              </span>
            </div>
            {topProducts.map(({ product, views, waClicks, reviews: rc, avg }) => (
              <div key={product.id} className="grid grid-cols-[1fr_auto] gap-2 items-center bg-gray-50 rounded-lg px-2 py-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-gray-800 truncate">{product.name}</div>
                  <div className="text-[9px] font-semibold text-gray-400">{TZS(product.price)}</div>
                </div>
                <div className="flex gap-4 items-center text-[11px] font-black text-gray-700">
                  <span className="w-12 text-right">{views}</span>
                  <span className="w-12 text-right flex items-center justify-end gap-0.5 text-green-600">
                    <MessageCircle className="w-3 h-3" /> {waClicks}
                  </span>
                  <span className="w-12 text-right flex items-center justify-end gap-0.5">
                    {rc > 0 ? <><Star className="w-3 h-3 text-amber-400" fill="currentColor" /> {avg.toFixed(1)}</> : <span className="text-gray-300">—</span>}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reviews summary + clicks log */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <h3 className="text-xs font-black text-gray-900 mb-3">{t('Latest Reviews')}</h3>
          {companyReviews.length === 0 ? (
            <div className="text-xs text-gray-400 font-medium text-center py-6">{t('No reviews yet.')}</div>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {companyReviews.slice(0, 10).map(r => (
                <div key={r.id} className="rounded-lg border border-gray-100 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[11px] font-bold text-gray-800 truncate">{r.reviewerName}</span>
                      {r.isVerifiedBuyer && (
                        <span className="inline-flex items-center gap-0.5 text-[8px] font-black uppercase text-emerald-600 bg-emerald-50 rounded-full px-1.5 py-0.5">
                          <Check className="w-2.5 h-2.5" /> {t('Verified Buyer')}
                        </span>
                      )}
                    </div>
                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${r.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : r.status === 'pending' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'}`}>
                      {r.status === 'approved' ? t('Approved') : r.status === 'pending' ? t('Pending') : t('Rejected')}
                    </span>
                  </div>
                  <div className="mt-1"><Stars rating={r.rating} size={12} /></div>
                  {r.comment && <p className="text-[10px] text-gray-500 font-medium mt-1 line-clamp-2">{r.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <h3 className="text-xs font-black text-gray-900 mb-3">{t('WhatsApp Order Clicks')}</h3>
          {recentClicks.length === 0 ? (
            <div className="text-xs text-gray-400 font-medium text-center py-6">{t('No WhatsApp clicks yet.')}</div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {recentClicks.map(c => {
                const p = products.find(x => x.id === c.productId);
                return (
                  <div key={c.id} className="flex items-center gap-2 rounded-lg border border-gray-100 p-2.5">
                    <div className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center shrink-0">
                      <MessageCircle className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold text-gray-800 truncate">{p?.name || t('Product')}</div>
                      <div className="text-[9px] font-semibold text-gray-400">{new Date(c.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
