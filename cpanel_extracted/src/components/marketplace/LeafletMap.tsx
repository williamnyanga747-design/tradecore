import React, { useEffect, useRef } from 'react';
import { loadLeaflet } from '../../utils/leafletLoader';

export interface MapMarker {
  lat: number;
  lng: number;
  title?: string;
  isCustomer?: boolean;
  popupHtml?: string;
}

interface MapCircle {
  lat: number;
  lng: number;
  radiusKm: number;
}

interface LeafletMapProps {
  center: { lat: number; lng: number };
  markers?: MapMarker[];
  zoom?: number;
  className?: string;
  scrollWheelZoom?: boolean;
  draggableMarker?: boolean;
  onPickLocation?: (lat: number, lng: number) => void;
  pickTitle?: string;
  circle?: MapCircle;
}

export default function LeafletMap({
  center, markers = [], zoom = 13, className = 'h-72',
  scrollWheelZoom = false, draggableMarker = false, onPickLocation, pickTitle, circle
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const circleRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    let L: any = null;
    loadLeaflet().then((mod) => {
      if (cancelled || !containerRef.current) return;
      L = mod;
      const map = L.map(containerRef.current, { scrollWheelZoom, zoomControl: true });
      mapRef.current = map;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      const makeIcon = (isCustomer: boolean) =>
        L.divIcon({
          className: '',
          html: `<div style="font-size:${isCustomer ? 26 : 30}px;line-height:1;filter:drop-shadow(0 2px 2px rgba(0,0,0,0.3))">${isCustomer ? '🏠' : '📍'}</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 28],
          popupAnchor: [0, -26]
        });

      const draw = () => {
        // Clear existing markers
        markersRef.current.forEach(m => { try { map.removeLayer(m); } catch (e) {} });
        markersRef.current = [];

        if (circleRef.current) { try { map.removeLayer(circleRef.current); } catch (e) {} circleRef.current = null; }

        if (circle) {
          circleRef.current = L.circle([circle.lat, circle.lng], {
            radius: circle.radiusKm * 1000,
            color: '#2563eb',
            fillColor: '#2563eb',
            fillOpacity: 0.12,
            weight: 2
          }).addTo(map);
        }

        if (draggableMarker) {
          const m = L.marker([center.lat, center.lng], { icon: makeIcon(false), draggable: true }).addTo(map);
          markersRef.current.push(m);
          m.bindPopup(`<b>${pickTitle || 'Location'}</b>`).openPopup();
          const onMove = () => {
            const pos = m.getLatLng();
            if (onPickLocation) onPickLocation(pos.lat, pos.lng);
          };
          m.on('dragend', onMove);
          m.on('move', onMove);
          map.on('click', (e: any) => {
            m.setLatLng([e.latlng.lat, e.latlng.lng]);
            if (onPickLocation) onPickLocation(e.latlng.lat, e.latlng.lng);
          });
          return;
        }

        markers.forEach(mk => {
          if (typeof mk.lat !== 'number' || typeof mk.lng !== 'number') return;
          const m = L.marker([mk.lat, mk.lng], { icon: makeIcon(!!mk.isCustomer) }).addTo(map);
          markersRef.current.push(m);
          if (mk.popupHtml) m.bindPopup(mk.popupHtml);
        });
      };

      draw();
      const hasCoords = markers.some(mk => typeof mk.lat === 'number' && typeof mk.lng === 'number');
      if (hasCoords) {
        const latlngs = markers.map(mk => [mk.lat, mk.lng]);
        try { map.fitBounds(L.latLngBounds(latlngs).pad(0.25)); } catch (e) { map.setView([center.lat, center.lng], zoom); }
      } else {
        map.setView([center.lat, center.lng], zoom);
      }
    }).catch((err) => {
      if (containerRef.current && !cancelled) {
        containerRef.current.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#0d1832;color:#9ca3af;font-size:12px;font-weight:600;text-align:center;padding:16px">Map could not load. Check your internet connection.</div>`;
      }
    });

    return () => {
      cancelled = true;
      try { if (mapRef.current) mapRef.current.remove(); } catch (e) {}
      mapRef.current = null;
      markersRef.current = [];
    };
  }, [center.lat, center.lng, markers, zoom, draggableMarker, pickTitle, circle]);

  // Redraw when marker set changes (markers array identity changes)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || draggableMarker) return;
    try {
      markersRef.current.forEach(m => { try { map.removeLayer(m); } catch (e) {} });
      markersRef.current = [];
      if (circleRef.current) { try { map.removeLayer(circleRef.current); } catch (e) {} circleRef.current = null; }
      const L = (window as any).L;
      if (!L) return;
      const makeIcon = (isCustomer: boolean) =>
        L.divIcon({
          className: '',
          html: `<div style="font-size:${isCustomer ? 26 : 30}px;line-height:1">${isCustomer ? '🏠' : '📍'}</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 28],
          popupAnchor: [0, -26]
        });
      if (circle) {
        circleRef.current = L.circle([circle.lat, circle.lng], {
          radius: circle.radiusKm * 1000,
          color: '#2563eb',
          fillColor: '#2563eb',
          fillOpacity: 0.12,
          weight: 2
        }).addTo(map);
      }
      markers.forEach(mk => {
        if (typeof mk.lat !== 'number' || typeof mk.lng !== 'number') return;
        const m = L.marker([mk.lat, mk.lng], { icon: makeIcon(!!mk.isCustomer) }).addTo(map);
        markersRef.current.push(m);
        if (mk.popupHtml) m.bindPopup(mk.popupHtml);
      });
    } catch (e) {}
  }, [markers, draggableMarker, circle]);

  return <div ref={containerRef} className={className} />;
}
