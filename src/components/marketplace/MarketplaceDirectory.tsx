import React, { useMemo, useState } from 'react';
import { Search, MapPin, Navigation, LayoutGrid, Map as MapIcon, Store as StoreIcon, ChevronLeft, ChevronRight, ExternalLink, Phone } from 'lucide-react';
import { Company, MarketplaceProduct, Store } from '../../types';
import { getPublicTheme, PublicTheme } from '../../utils/publicTheme';
import { TANZANIA_REGIONS, regionCenter } from '../../utils/regions';
import { haversineKm, readCustomerLocation, saveCustomerLocation, formatDistanceKm, resolveCompanyCoords, jitterCompanyCoords } from '../../utils/haversine';
import { sameId } from '../../utils/idUtils';
import LeafletMap from './LeafletMap';
import { VerifiedBadge, Money, TZS, TFunc, isProductVisible } from './MarketplaceShared';

interface Props {
  companies: Company[];
  products: MarketplaceProduct[];
  stores?: Store[];
  theme: PublicTheme;
  t: TFunc;
  regions?: string[];
  onOpenCompany: (slug: string) => void;
  paginate?: boolean;
  maxCards?: number;
}

export default function MarketplaceDirectory({ companies, products, stores = [], theme, t, regions, onOpenCompany, paginate = false, maxCards }: Props) {
  const th = getPublicTheme(theme);
  const milk = theme === 'milk';
  const regionList = regions && regions.length > 0 ? regions : TANZANIA_REGIONS;
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('All');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [customerLoc, setCustomerLoc] = useState<{ lat: number; lng: number } | null>(readCustomerLocation());
  const [locating, setLocating] = useState(false);
  const [locMsg, setLocMsg] = useState('');
  const [radiusKm, setRadiusKm] = useState(0);
  const [page, setPage] = useState(0);
  const pageSize = 6;

  const productCountFor = (companyId: number) => products.filter(p => p.companyId === companyId && isProductVisible(p)).length;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = companies
      .filter(c => c.isMarketplaceActive !== false)
      .map(c => {
        const companyStores = (stores || []).filter(s => s.companyId === c.id || sameId((s as any).companyId, c.id));
        const companyStoreWithCoords = companyStores.find(s => typeof s.latitude === 'number' && typeof s.longitude === 'number' && isFinite(s.latitude) && isFinite(s.longitude));
        const effectiveLat = typeof c.latitude === 'number' && isFinite(c.latitude) ? c.latitude : companyStoreWithCoords?.latitude;
        const effectiveLng = typeof c.longitude === 'number' && isFinite(c.longitude) ? c.longitude : companyStoreWithCoords?.longitude;
        const hasOwnCoords = typeof effectiveLat === 'number' && typeof effectiveLng === 'number' && isFinite(effectiveLat) && isFinite(effectiveLng);
        const resolved = resolveCompanyCoords(effectiveLat, effectiveLng, c.region);
        const coords = resolved ? (hasOwnCoords ? resolved : jitterCompanyCoords(resolved.lat, resolved.lng, c.id)) : null;
        return {
          company: c,
          companyStores,
          coords,
          distanceKm: customerLoc && coords ? haversineKm(customerLoc.lat, customerLoc.lng, coords.lat, coords.lng) : null,
          productCount: productCountFor(c.id),
          companyProducts: products.filter(p => p.companyId === c.id && isProductVisible(p))
        };
      })
      .filter(c => {
        if (!q) return true;
        const haystack = [c.company.name, c.company.description, c.company.category, c.company.region, c.company.district, c.company.ward, c.company.addressText, c.company.slug]
          .filter(Boolean).join(' ').toLowerCase();
        if (haystack.includes(q)) return true;
        // "Find a company or product": match any active product this company sells
        return products.some(p => p.companyId === c.company.id && isProductVisible(p) && (p.name || '').toLowerCase().includes(q));
      })
      .filter(c => region === 'All' || (c.company.region || '') === region)
      .filter(c => radiusKm <= 0 || !customerLoc || (c.distanceKm !== null && c.distanceKm <= radiusKm));
    if (customerLoc) list.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    return list;
  }, [companies, products, stores, search, region, customerLoc, radiusKm]);

  const locateMe = () => {
    if (!navigator.geolocation) {
      setLocMsg(t('Geolocation is not supported on this device.'));
      return;
    }
    setLocating(true);
    setLocMsg('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        saveCustomerLocation(loc.lat, loc.lng);
        setCustomerLoc(loc);
        setLocating(false);
        setLocMsg(t('Location captured — companies sorted nearest first.'));
      },
      () => {
        setLocating(false);
        setLocMsg(t('Could not access your location. Please enable location access.'));
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const maxPage = Math.max(0, Math.ceil(rows.length / pageSize) - 1);
  const clampedPage = Math.min(page, maxPage);
  const visible = paginate ? rows.slice(clampedPage * pageSize, clampedPage * pageSize + pageSize) : rows.slice(0, maxCards || rows.length);

  // Map markers for BOTH Company Headquarters AND its physical Stores
  const mapMarkers = useMemo(() => {
    const list: Array<{ lat: number; lng: number; title: string; popupHtml: string }> = [];
    rows.forEach(r => {
      // 1. Company HQ Pin
      if (r.coords) {
        list.push({
          lat: r.coords.lat,
          lng: r.coords.lng,
          title: `🏢 ${r.company.name} (Makao Makuu)`,
          popupHtml: `<div style="min-width:190px">
            <div style="font-size:10px;font-weight:800;color:#d97706;text-transform:uppercase;margin-bottom:2px">🏢 Makao Makuu / HQ</div>
            <b style="font-size:13px;color:#111827">${r.company.name}</b><br/>
            <span style="font-size:11px;color:#4b5563">${[r.company.addressText, r.company.district, r.company.region].filter(Boolean).join(', ') || 'Tanzania'}</span><br/>
            ${r.distanceKm !== null ? `<span style="font-size:11px;font-weight:700;color:#059669">${formatDistanceKm(r.distanceKm)} ${t('away')}</span><br/>` : ''}
            <a href="/company/${r.company.slug}" style="display:inline-block;margin-top:6px;background:#eab308;color:#1f2937;font-weight:800;font-size:11px;padding:4px 10px;border-radius:8px;text-decoration:none">${t('Angalia Kampuni')}</a>
          </div>`
        });
      }

      // 2. Individual Store Pins under this Company
      (r.companyStores || []).forEach(st => {
        const hasStoreCoords = typeof st.latitude === 'number' && typeof st.longitude === 'number' && isFinite(st.latitude) && isFinite(st.longitude);
        const storeCoords = hasStoreCoords
          ? { lat: st.latitude, lng: st.longitude }
          : (r.coords ? jitterCompanyCoords(r.coords.lat, r.coords.lng, (st.id || 1) * 31) : null);
        if (!storeCoords) return;
        const storeDist = customerLoc ? haversineKm(customerLoc.lat, customerLoc.lng, storeCoords.lat, storeCoords.lng) : null;
        list.push({
          lat: storeCoords.lat,
          lng: storeCoords.lng,
          title: `🏪 ${st.name} — ${r.company.name}`,
          popupHtml: `<div style="min-width:190px">
            <div style="font-size:10px;font-weight:800;color:#2563eb;text-transform:uppercase;margin-bottom:2px">🏪 Duka / Store</div>
            <b style="font-size:13px;color:#111827">${st.name}</b><br/>
            <span style="font-size:11px;color:#6b7280;font-weight:700">🏢 ${r.company.name}</span><br/>
            <span style="font-size:11px;color:#4b5563">${[st.address, st.city].filter(Boolean).join(', ') || 'Duka Rasmi'}</span><br/>
            ${st.phone ? `<span style="font-size:10px;color:#4b5563">📞 ${st.phone}</span><br/>` : ''}
            ${storeDist !== null ? `<span style="font-size:11px;font-weight:700;color:#059669">${formatDistanceKm(storeDist)} ${t('away')}</span><br/>` : ''}
            <a href="/company/${r.company.slug}" style="display:inline-block;margin-top:6px;background:#2563eb;color:#ffffff;font-weight:800;font-size:11px;padding:4px 10px;border-radius:8px;text-decoration:none">${t('Tembelea Duka')}</a>
          </div>`
        });
      });
    });
    return list;
  }, [rows, customerLoc, t]);

  const hasLocationCompanies = companies.some(c => c.isMarketplaceActive !== false && !!resolveCompanyCoords(c.latitude, c.longitude, c.region));

  const mapCenter = useMemo(() => {
    const rc = regionCenter(region === 'All' ? null : region);
    if (rc) return rc;
    const q = search.trim().toLowerCase();
    if (q) {
      const matched = TANZANIA_REGIONS.find(r => r.toLowerCase().includes(q) || q.includes(r.toLowerCase()));
      const rc2 = matched ? regionCenter(matched) : null;
      if (rc2) return rc2;
    }
    return { lat: -6.3690, lng: 34.8888 };
  }, [region, search]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${th.textDim}`} />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder={t('Search company or product...')}
            className={th.input + ' pl-9'}
          />
        </div>
        <select
          value={region}
          onChange={(e) => { setRegion(e.target.value); setPage(0); }}
          className={th.input + ' md:w-52 cursor-pointer'}
        >
          <option value="All">{t('Region zote')}</option>
          {regionList.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <button
          onClick={locateMe}
          disabled={locating}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-black rounded-xl transition cursor-pointer disabled:opacity-50 ${th.btnPrimary} ${th.btnPrimaryText}`}
        >
          <Navigation className="w-3.5 h-3.5" />
          {locating ? t('Finding you...') : t('Kampuni Karibu Yangu')}
        </button>
      </div>

      {locMsg && (
        <div className={`text-[11px] font-bold px-3 py-2 rounded-lg ${milk ? 'bg-amber-100 text-amber-800' : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'}`}>
          {locMsg}
        </div>
      )}

      {/* Radius filter */}
      {customerLoc && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-black uppercase tracking-wider ${th.textDim}`}>{t('Radius')}</span>
          {[0, 10, 25, 50, 100].map(r => (
            <button
              key={r}
              onClick={() => setRadiusKm(r)}
              className={`px-3 py-1.5 text-[10px] font-black rounded-full transition cursor-pointer ${radiusKm === r ? `${th.btnPrimary} ${th.btnPrimaryText}` : `${milk ? 'bg-amber-100 text-amber-700' : 'bg-white/10 text-gray-300'} hover:opacity-80`}`}
            >
              {r === 0 ? t('All') : `${r}km`}
            </button>
          ))}
        </div>
      )}

      {/* View toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-white/10 rounded-xl p-1">
          <button
            onClick={() => setView('list')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-black rounded-lg transition cursor-pointer ${view === 'list' ? `${th.btnPrimary} ${th.btnPrimaryText}` : 'text-gray-400 hover:text-white'}`}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> {t('List View')}
          </button>
          <button
            onClick={() => setView('map')}
            disabled={!hasLocationCompanies}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-black rounded-lg transition cursor-pointer ${view === 'map' ? `${th.btnPrimary} ${th.btnPrimaryText}` : 'text-gray-400 hover:text-white'} disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <MapIcon className="w-3.5 h-3.5" /> {t('Map View')}
          </button>
        </div>
        <span className={`text-[10px] ${th.textDim} font-bold`}>{rows.length} {rows.length === 1 ? t('company') : t('companies')}</span>
      </div>

      {view === 'map' ? (
        <LeafletMap
          center={mapCenter}
          markers={mapMarkers}
          zoom={6}
          circle={customerLoc && radiusKm > 0 ? { lat: customerLoc.lat, lng: customerLoc.lng, radiusKm } : undefined}
          className="h-96 rounded-2xl overflow-hidden"
          scrollWheelZoom
        />
      ) : visible.length === 0 ? (
        <div className={`${th.card} ${th.cardBorder} rounded-2xl p-10 text-center`}>
          <StoreIcon className={`w-10 h-10 mx-auto mb-3 ${th.textDim}`} />
          <div className={`text-sm font-black ${th.strongText}`}>{t('Hakuna kampuni zilizopatikana')}</div>
          <div className={`text-[11px] ${th.textMuted} font-semibold mt-1`}>{t('Try a different search or region.')}</div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map(({ company: c, companyStores, distanceKm, productCount, companyProducts }) => (
            <div key={c.id} className={`${th.card} ${th.cardBorder} rounded-2xl overflow-hidden flex flex-col hover:-translate-y-1 transition duration-200`}>
              <div className="flex items-center gap-3 p-4">
                {c.logoUrl ? (
                  <img src={c.logoUrl} alt={c.name} className="w-12 h-12 rounded-xl object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black bg-amber-400/20 text-amber-600 dark:text-amber-300">{(c.name || '-').charAt(0)}</div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-xs font-black ${th.strongText} truncate`}>{c.name}</span>
                    {c.isVerified && <VerifiedBadge milk={milk} t={t} />}
                  </div>
                  <div className={`text-[10px] ${th.textDim} font-semibold mt-0.5 flex items-center gap-1`}>
                    <MapPin className="w-3 h-3 shrink-0 text-amber-500" />
                    <span className="font-bold text-gray-700">HQ:</span> {[c.addressText, c.district, c.region].filter(Boolean).join(', ') || (c.country || t('Address not set'))}
                  </div>
                  {c.phone && (
                    <div className={`text-[10px] ${th.textDim} font-semibold mt-0.5 flex items-center gap-1`}>
                      <Phone className="w-3 h-3 shrink-0" /> {c.phone}
                    </div>
                  )}
                </div>
              </div>

              {c.description && (
                <div className={`px-4 pb-1 text-[10px] ${th.textMuted} font-medium leading-relaxed line-clamp-2`}>{c.description}</div>
              )}

              {/* Physical Stores / Maduka under this company */}
              {companyStores && companyStores.length > 0 && (
                <div className="px-4 pb-2 pt-1 border-t border-gray-100">
                  <div className={`text-[9px] font-black uppercase tracking-wider mb-1 ${th.textDim} flex items-center gap-1`}>
                    <StoreIcon className="w-3 h-3 text-blue-500" />
                    {t('Maduka ya Mauzo (Stores)')} ({companyStores.length})
                  </div>
                  <div className="space-y-1">
                    {companyStores.slice(0, 2).map(st => {
                      const hasStoreCoords = typeof st.latitude === 'number' && typeof st.longitude === 'number' && isFinite(st.latitude) && isFinite(st.longitude);
                      const storeDist = customerLoc && hasStoreCoords ? haversineKm(customerLoc.lat, customerLoc.lng, st.latitude!, st.longitude!) : null;
                      return (
                        <div key={st.id} className={`flex items-center justify-between text-[10px] rounded-lg px-2 py-1 bg-blue-500/5 ${th.cardBorder}`}>
                          <span className={`font-bold truncate ${th.strongText}`}>
                            🏪 {st.name} <span className={`text-[9px] font-normal ${th.textDim}`}>({[st.address, st.city].filter(Boolean).join(', ') || 'Duka Rasmi'})</span>
                          </span>
                          {storeDist !== null && (
                            <span className="text-[9px] font-black text-emerald-600 shrink-0 ml-1">
                              {formatDistanceKm(storeDist)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {companyStores.length > 2 && (
                      <div className={`text-[9px] font-bold px-2 ${th.brandText}`}>+{companyStores.length - 2} {t('maduka mengine')}</div>
                    )}
                  </div>
                </div>
              )}

              {/* This company's products */}
              {companyProducts.length > 0 && (
                <div className="px-4 pb-1">
                  <div className={`text-[9px] font-black uppercase tracking-wider mb-1.5 ${th.textDim}`}>{t('Products')}</div>
                  <div className="space-y-0.5">
                    {companyProducts.slice(0, 3).map(p => (
                      <button
                        key={p.id}
                        onClick={() => c.slug && onOpenCompany(c.slug)}
                        className={`w-full flex items-center justify-between gap-2 text-left rounded-lg px-2 py-1 transition cursor-pointer hover:bg-amber-500/10 ${th.cardBorder}`}
                        title={p.name}
                      >
                        <span className={`text-[10px] font-semibold truncate ${th.textMuted}`}>{p.name}</span>
                        <span className={`text-[10px] font-black shrink-0 ${th.statValue}`}>{TZS(p.price)}</span>
                      </button>
                    ))}
                    {companyProducts.length > 3 && (
                      <div className={`text-[10px] font-bold px-2 ${th.brandText}`}>+{companyProducts.length - 3} {t('more')}</div>
                    )}
                  </div>
                </div>
              )}

              <div className="px-4 pb-3 flex items-center justify-between flex-wrap gap-1.5">
                <div className="flex items-center gap-2">
                  {distanceKm !== null && (
                    <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full ${milk ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/15 text-amber-300 border border-amber-500/40'}`}>
                      <MapPin className="w-3 h-3" /> {formatDistanceKm(distanceKm)} {t('away')}
                    </span>
                  )}
                  <span className={`text-[10px] font-bold ${th.textDim}`}>{productCount} {productCount === 1 ? t('product') : t('products')}</span>
                </div>
                {c.phone && (
                  <a href={`tel:${c.phone}`} className={`text-[10px] font-bold flex items-center gap-1 ${th.brandText}`}>
                    <Phone className="w-3 h-3" /> {t('Call')}
                  </a>
                )}
              </div>
              <div className="p-3 pt-0">
                <button
                  onClick={() => c.slug && onOpenCompany(c.slug)}
                  className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 text-[11px] font-black rounded-xl uppercase tracking-wider transition cursor-pointer ${th.btnPrimary} ${th.btnPrimaryText}`}
                >
                  {t('Angalia Bidhaa')} <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {paginate && rows.length > pageSize && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            onClick={() => setPage(Math.max(0, clampedPage - 1))}
            disabled={clampedPage === 0}
            className={`flex items-center gap-1 px-4 py-2 text-[11px] font-black rounded-xl transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${th.btnSecondary} ${th.btnSecondaryText}`}
          >
            <ChevronLeft className="w-3.5 h-3.5" /> {t('Prev')}
          </button>
          <span className={`text-[11px] font-bold ${th.textDim}`}>{t('Page')} {clampedPage + 1} / {maxPage + 1}</span>
          <button
            onClick={() => setPage(Math.min(maxPage, clampedPage + 1))}
            disabled={clampedPage === maxPage}
            className={`flex items-center gap-1 px-4 py-2 text-[11px] font-black rounded-xl transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${th.btnSecondary} ${th.btnSecondaryText}`}
          >
            {t('Next')} <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

