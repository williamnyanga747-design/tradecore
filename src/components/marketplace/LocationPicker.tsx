import React, { useEffect, useState } from 'react';
import { LocateFixed, MapPin } from 'lucide-react';
import LeafletMap from './LeafletMap';
import { TFunc } from './MarketplaceShared';

interface Props {
  lat?: number | null;
  lng?: number | null;
  onChange: (lat: number, lng: number) => void;
  t: TFunc;
  pickTitle?: string;
  compact?: boolean;
}

/**
 * Feature 4 — map picker for store location. Reuses LeafletMap's draggable marker;
 * also offers a "use my location" button (requires browser geolocation).
 */
export default function LocationPicker({ lat, lng, onChange, t, pickTitle, compact }: Props) {
  const [center, setCenter] = useState<{ lat: number; lng: number }>({
    lat: typeof lat === 'number' ? lat : -6.7924,
    lng: typeof lng === 'number' ? lng : 39.2083
  });
  const [geoError, setGeoError] = useState('');
  const [locating, setLocating] = useState(false);

  const [hasLat] = useState<number | null>(typeof lat === 'number' ? lat : null);
  const [hasLng] = useState<number | null>(typeof lng === 'number' ? lng : null);

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setGeoError(t('Geolocation is not supported by this browser.'));
      return;
    }
    setLocating(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocating(false);
        const la = pos.coords.latitude;
        const lo = pos.coords.longitude;
        setCenter({ lat: la, lng: lo });
        onChange(la, lo);
      },
      () => {
        setLocating(false);
        setGeoError(t('Could not get your location. Please allow location access or place the pin manually.'));
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  // sync external lat/lng changes (e.g. profile edit)
  useEffect(() => {
    if (typeof lat === 'number' && typeof lng === 'number') {
      setCenter(c => (c.lat === lat && c.lng === lng ? c : { lat, lng }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-black ${(hasLat !== null || center.lat !== -6.7924 || typeof lat === 'number') ? 'text-emerald-500' : 'text-gray-400'}`}>
          <MapPin className="w-3.5 h-3.5" /> {t('Store location on map')}
          {(hasLat !== null || typeof lat === 'number') && (lat && lng) ? (
            <span className="font-bold">· {Number(lat).toFixed(4)}, {Number(lng).toFixed(4)}</span>
          ) : null}
        </span>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black rounded-lg bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 cursor-pointer disabled:opacity-50"
        >
          <LocateFixed className={`w-3.5 h-3.5 ${locating ? 'animate-spin' : ''}`} /> {t('Use my location')}
        </button>
      </div>
      {geoError && <div className="text-[10px] font-bold text-red-500">{geoError}</div>}
      <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
        <LeafletMap
          center={center}
          draggableMarker
          onPickLocation={onChange}
          pickTitle={pickTitle || t('Store location')}
          zoom={13}
          className={compact ? 'h-44' : 'h-60'}
          scrollWheelZoom
        />
      </div>
      {(hasLat === null && lat === undefined) && (
        <p className={`text-[10px] font-bold ${geoError ? 'text-red-500' : 'text-gray-400'}`}>
          {t('Drag the pin or tap the map to set your store location.')}
        </p>
      )}
    </div>
  );
}
