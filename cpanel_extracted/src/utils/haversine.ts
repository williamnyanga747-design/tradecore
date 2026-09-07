const EARTH_RADIUS_KM = 6371;

import { regionCenter } from './regions';

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export function formatDistanceKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

export function readCustomerLocation(): { lat: number; lng: number } | null {
  try {
    const raw = localStorage.getItem('tradecore_customer_loc');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
      return { lat: parsed.lat, lng: parsed.lng };
    }
  } catch (e) {}
  return null;
}

export function saveCustomerLocation(lat: number, lng: number): void {
  try {
    localStorage.setItem('tradecore_customer_loc', JSON.stringify({ lat, lng, ts: Date.now() }));
  } catch (e) {}
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// Resolve a company's coordinates: explicit lat/lng wins, otherwise fall back
// to the region's center so every company has a map position.
export function resolveCompanyCoords(
  latitude?: number | null,
  longitude?: number | null,
  region?: string | null
): { lat: number; lng: number } | null {
  if (typeof latitude === 'number' && typeof longitude === 'number' && isFinite(latitude) && isFinite(longitude)) {
    return { lat: latitude, lng: longitude };
  }
  return regionCenter(region);
}

// Deterministic small offset so companies backfilled to the same region center
// do not stack on top of each other, while staying close to their real region.
export function jitterCompanyCoords(lat: number, lng: number, seed: number): { lat: number; lng: number } {
  const rand = (n: number) => {
    const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  return {
    lat: lat + (rand(seed + 1) - 0.5) * 0.02,
    lng: lng + (rand(seed + 2) - 0.5) * 0.02
  };
}
