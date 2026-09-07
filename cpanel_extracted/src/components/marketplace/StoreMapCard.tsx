import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, MessageCircle, Store as StoreIcon } from 'lucide-react';
import { Company, Store } from '../../types';
import { getPublicTheme, PublicTheme } from '../../utils/publicTheme';
import { loadLeaflet } from '../../utils/leafletLoader';
import { TFunc } from './MarketplaceShared';

interface Props {
  company: Company;
  theme: PublicTheme;
  t: TFunc;
  compact?: boolean;
  /**
   * Optional physical stores (Master Data) assigned to a product.
   * When provided, one pin is rendered per store. When empty, the map falls back
   * to a single "Main HQ" pin using the company's Marketplace Settings coordinates.
   */
  stores?: Store[];
}

interface Pin {
  label: string;      // Store name or "Main HQ"
  lat: number;
  lng: number;
  address: string;
  directionsUrl: string;
  mapsUrl?: string;
}

/**
 * Feature 4 — "Njoo Dukani": multi-store location map (Leaflet + OpenStreetMap, no API key).
 * Renders a dynamic marker for every physical store where an item is available, with a
 * per-pin popup:
 *   <b>{Company Name}</b><br/><b>Store:</b> {Store Name or 'Main HQ'}<br/>{Address}
 * plus a "Get Directions / Indicaciones" button on each pin. Falls back to Main HQ when
 * no stores are assigned or when Leaflet cannot load.
 */
export default function StoreMapCard({ company, theme, t, compact, stores }: Props) {
  const th = getPublicTheme(theme);
  const milk = theme === 'milk';
  const [failed, setFailed] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  // Build the ordered list of pins. Explicitly-assigned stores win; otherwise fall back
  // to the company's Main HQ (Marketplace Settings -> Store Profile coordinates).
  const baseAddress = [company.addressText, company.region, company.district, company.ward].filter(Boolean).join(', ');
  const assigned = (stores || [])
    .filter(s => !s.isDeleted && s.isMarketplaceVisible !== false &&
      typeof s.latitude === 'number' && typeof s.longitude === 'number' &&
      Number.isFinite(s.latitude) && Number.isFinite(s.longitude))
    .map(s => ({
      label: s.name || t('Store'),
      lat: s.latitude as number,
      lng: s.longitude as number,
      address: [s.location, company.addressText, company.region, company.district, company.ward]
        .filter(Boolean).join(', ') || baseAddress,
      directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${s.latitude},${s.longitude}`,
      mapsUrl: s.googleMapsUrl || undefined
    }));

  const hasCompanyCoords = typeof company.latitude === 'number' && typeof company.longitude === 'number' &&
    Number.isFinite(company.latitude) && Number.isFinite(company.longitude);

  // Merge assigned pins + (if no stores assigned) the Main HQ fallback pin.
  const pins: Pin[] =
    assigned.length > 0
      ? assigned
      : (hasCompanyCoords
          ? [{
              label: t('Main HQ'),
              lat: company.latitude as number,
              lng: company.longitude as number,
              address: baseAddress || t('Location not set'),
              directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${company.latitude},${company.longitude}`,
              mapsUrl: undefined
            }]
          : []);

  const visiblePins = pins.filter(p => typeof p.lat === 'number' && typeof p.lng === 'number' && Number.isFinite(p.lat) && Number.isFinite(p.lng));

  useEffect(() => {
    if (visiblePins.length === 0 || failed) return;
    let cancelled = false;
    loadLeaflet()
      .then(() => {
        if (cancelled || !mapElRef.current) return;
        const L: any = (window as any).L;
        if (!L) { setFailed(true); return; }
        try {
          const el = mapElRef.current;
          const map = L.map(el, { scrollWheelZoom: false, attributionControl: true });
          mapRef.current = map;
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
          }).addTo(map);

          const companyName = (company.name || '').replace(/</g, '&lt;');
          const pinHtml = (p: Pin) => {
            const addr = (p.address || '').replace(/</g, '&lt;');
            const storeLabel = (p.label || t('Main HQ')).replace(/</g, '&lt;');
            // Exact required format:
            // <b>{Company Name}</b><br/><b>Store:</b> {Store Name or 'Main HQ'}<br/>{Address}
            const dirHref = (p.directionsUrl || `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`).replace(/&/g, '&amp;');
            const directionsLabel = (t('Get Directions') || t('Indicaciones')).replace(/&/g, '&amp;');
            return (
              `<div style="min-width:150px">` +
              `<div style="font-weight:800;font-size:12px;">${companyName}</div>` +
              `<div style="font-size:11px;color:#111827;margin-top:3px;"><b>Store:</b> ${storeLabel}</div>` +
              `<div style="font-size:10px;color:#6b7280;margin-top:2px;">${addr}</div>` +
              `<div style="margin-top:7px;">` +
              `<a href="${dirHref}" target="_blank" rel="noopener noreferrer" ` +
              `style="display:inline-flex;align-items:center;gap:5px;background:#2563eb;color:#fff;` +
              `text-decoration:none;font-size:11px;font-weight:800;padding:6px 10px;border-radius:8px;">` +
              `&#8599; ${directionsLabel}</a>` +
              `</div></div>`
            );
          };

          const makeIcon = () =>
            L.divIcon({
              className: '',
              html: `<div style="font-size:28px;line-height:1;filter:drop-shadow(0 2px 2px rgba(0,0,0,0.3))">📌</div>`,
              iconSize: [28, 28],
              iconAnchor: [14, 28],
              popupAnchor: [0, -26]
            });

          visiblePins.forEach(p => {
            const m = L.marker([p.lat, p.lng], { icon: makeIcon() }).addTo(map);
            markersRef.current.push(m);
            m.bindPopup(pinHtml(p)).openPopup();
          });

          const latlngs = visiblePins.map(p => [p.lat, p.lng]);
          try { map.fitBounds(L.latLngBounds(latlngs).pad(0.3)); } catch (e) { map.setView([visiblePins[0].lat, visiblePins[0].lng], 13); }
          setMapReady(true);
          setTimeout(() => { try { map.invalidateSize(); } catch (e) {} }, 250);
        } catch (e) {
          setFailed(true);
        }
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      try { mapRef.current?.remove?.(); } catch (e) {}
      mapRef.current = null;
      markersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(visiblePins.map(p => [p.lat, p.lng, p.label])), failed]);

  if (visiblePins.length === 0) {
    const fallbackText = baseAddress || t('Location not set');
    return (
      <div className={`rounded-2xl border ${th.cardBorder} ${th.card} p-3.5`}>
        <div className="flex items-center gap-2 text-[11px] font-black mb-1">
          <MapPin className={`w-3.5 h-3.5 ${th.brandText}`} /> {t('Store Location')}
        </div>
        <p className={`text-[11px] font-bold ${th.textMuted}`}>{fallbackText}</p>
      </div>
    );
  }

  const shareText = `Habari ${company.name}, naomba kujua namna ya kufika duka lako (${baseAddress || ''}).`;
  const shareWhatsApp = (company?.whatsappNumber || company?.phone || '').replace(/[^0-9]/g, '');

  return (
    <div className={`rounded-2xl border ${th.cardBorder} ${th.card} overflow-hidden`}>
      <div className="flex items-center justify-between px-3.5 pt-3 pb-1.5 flex-wrap gap-1.5">
        <div className="flex items-center gap-2 text-[11px] font-black">
          <MapPin className={`w-3.5 h-3.5 ${th.brandText}`} /> {t('Store Location')} — {t('Njoo Dukani')}
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${th.cardBorder}`}>
            <StoreIcon className="inline w-2.5 h-2.5 mr-0.5" />{visiblePins.length} {t('store(s)')}
          </span>
        </div>
        {mapReady && visiblePins.length === 1 && (
          <a href={visiblePins[0].directionsUrl} target="_blank" rel="noopener noreferrer"
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-black rounded-lg cursor-pointer ${th.btnPrimary} ${th.btnPrimaryText}`}>
            <Navigation className="w-3 h-3" /> {t('Directions')}
          </a>
        )}
      </div>
      {failed ? (
        <div className="px-3.5 pb-3 text-[11px] font-bold text-gray-400">
          {visiblePins.map((p, i) => (
            <div key={i} className="mb-1"><b>{t('Store')}:</b> {p.label} — {p.address}</div>
          ))}
        </div>
      ) : (
        <div ref={mapElRef} className={compact ? 'h-40' : 'h-52'} style={{ backgroundColor: '#e9edf1' }} />
      )}
      <div className="px-3.5 py-2 space-y-1">
        {visiblePins.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-2 text-[11px] font-bold">
            <span className={`flex items-center gap-1 min-w-0 ${th.textMuted}`}>
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate"><b>{p.label}</b> — {p.address}</span>
            </span>
            <a href={p.directionsUrl} target="_blank" rel="noopener noreferrer"
              className={`inline-flex items-center gap-1 px-2 py-1 text-[9px] font-black rounded-md shrink-0 cursor-pointer ${th.btnPrimary} ${th.btnPrimaryText}`}>
              <Navigation className="w-3 h-3" /> {t('Get Directions')}
            </a>
          </div>
        ))}
      </div>
      {shareWhatsApp && (
        <div className="px-3.5 pb-2.5">
          <a
            href={`https://wa.me/${shareWhatsApp}?text=${encodeURIComponent(shareText)}`}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-500/15 text-green-600 hover:bg-green-500/25 cursor-pointer text-[10px] font-bold"
          >
            <MessageCircle className="w-3 h-3" /> {t('Share location on WhatsApp')}
          </a>
        </div>
      )}
      {!milk && <div className="h-px bg-black/10" />}
    </div>
  );
}
