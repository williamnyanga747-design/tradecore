/**
 * SEO helpers for the public marketplace.
 * Dynamically manages <title>, meta description, canonical, Open Graph,
 * Twitter cards and JSON-LD structured data from the SPA.
 * Default language for all meta content is English.
 */

export const SITE_DOMAIN = 'https://tanzaniatradecore.co.tz';

export const DEFAULT_TITLE = 'GlobalTradeCore - Online Marketplace Tanzania';
export const DEFAULT_DESCRIPTION =
  'Buy wholesale & retail goods from verified Tanzanian companies. Fair prices with delivery across all 26 regions. Nunua bidhaa halisi kutoka kampuni zilizothibitishwa.';

function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function upsertJsonLd(json: Record<string, unknown> | null): void {
  const id = 'seo-jsonld';
  const existing = document.getElementById(id);
  if (existing) existing.remove();
  if (!json) return;
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = id;
  script.textContent = JSON.stringify(json);
  document.head.appendChild(script);
}

export interface SeoData {
  title: string;
  description?: string;
  canonical?: string;
  ogImage?: string; // only used if it is an http(s) URL
  jsonLd?: Record<string, unknown> | null;
  noindex?: boolean;
}

export function applySeo(data: SeoData): void {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  const canonical = data.canonical || `${SITE_DOMAIN}${pathname}`;
  document.title = data.title;

  const description = data.description || DEFAULT_DESCRIPTION;

  upsertMeta('name', 'description', description);
  upsertMeta('property', 'og:site_name', 'GlobalTradeCore');
  upsertMeta('property', 'og:type', data.ogImage ? 'website' : 'website');
  upsertMeta('property', 'og:title', data.title);
  upsertMeta('property', 'og:description', description);
  upsertMeta('property', 'og:url', canonical);
  upsertMeta('name', 'twitter:card', 'summary_large_image');
  upsertMeta('name', 'twitter:title', data.title);
  upsertMeta('name', 'twitter:description', description);

  // og:image only when we have a real public URL (data URLs cannot be indexed)
  if (data.ogImage && /^https?:\/\//i.test(data.ogImage)) {
    upsertMeta('property', 'og:image', data.ogImage);
    upsertMeta('name', 'twitter:image', data.ogImage);
  } else {
    const ogImg = document.head.querySelector<HTMLMetaElement>('meta[property="og:image"]');
    if (ogImg) ogImg.remove();
    const twImg = document.head.querySelector<HTMLMetaElement>('meta[name="twitter:image"]');
    if (twImg) twImg.remove();
  }

  upsertLink('canonical', canonical);

  if (data.noindex) {
    upsertMeta('name', 'robots', 'noindex, nofollow');
  } else {
    const robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (robots) robots.remove();
  }

  upsertJsonLd(data.jsonLd || null);
}

/** Build a Product JSON-LD block for Google Shopping. */
export function productJsonLd(args: {
  name: string;
  slug: string;
  description: string;
  price: number;
  sku?: string | number;
  images?: string[]; // main + gallery; only http(s) URLs are emitted
  brand?: string;
  seller?: string;
  availability?: 'InStock' | 'OutOfStock';
  rating?: { ratingValue: number; reviewCount: number };
}): Record<string, unknown> {
  const images = (args.images || []).filter(img => img && /^https?:\/\//i.test(img));
  const url = `${SITE_DOMAIN}/product/${args.slug}`;
  const r = args.rating;
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: args.name,
    description: args.description || args.name,
    image: images.length > 0 ? images : undefined,
    sku: args.sku !== undefined ? String(args.sku) : undefined,
    url,
    brand: args.brand ? { '@type': 'Brand', name: args.brand } : undefined,
    aggregateRating: r && r.ratingValue > 0 && r.reviewCount > 0
      ? { '@type': 'AggregateRating', ratingValue: Math.round(r.ratingValue * 10) / 10, reviewCount: r.reviewCount, bestRating: 5 }
      : undefined,
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'TZS',
      price: Math.round(args.price || 0),
      availability: `https://schema.org/${args.availability || 'InStock'}`,
      itemCondition: 'https://schema.org/NewCondition',
      seller: args.seller ? { '@type': 'Organization', name: args.seller } : undefined
    }
  };
}

/** Build a Store/Organization JSON-LD block for a company page. */
export function companyJsonLd(args: {
  name: string;
  slug: string;
  category?: string;
  description?: string;
  region?: string;
  district?: string;
  ward?: string;
  streetAddress?: string;
  phone?: string;
  geo?: { latitude: number; longitude: number };
  rating?: { ratingValue: number; reviewCount: number };
}): Record<string, unknown> {
  const r = args.rating;
  const geo = args.geo
    ? { '@type': 'GeoCoordinates', latitude: args.geo.latitude, longitude: args.geo.longitude }
    : undefined;
  return {
    '@context': 'https://schema.org',
    '@type': ['Store', 'LocalBusiness'],
    name: args.name,
    url: `${SITE_DOMAIN}/company/${args.slug}`,
    description: args.description || args.name,
    telephone: args.phone,
    address: args.region || args.streetAddress || args.district
      ? {
          '@type': 'PostalAddress',
          streetAddress: args.streetAddress,
          addressLocality: args.district || args.region,
          addressRegion: args.region,
          addressCountry: 'TZ'
        }
      : undefined,
    geo,
    hasMap: geo
      ? `https://www.google.com/maps/search/?api=1&query=${args.geo!.latitude},${args.geo!.longitude}`
      : undefined,
    department: args.category ? args.category : undefined,
    aggregateRating: r && r.ratingValue > 0 && r.reviewCount > 0
      ? { '@type': 'AggregateRating', ratingValue: Math.round(r.ratingValue * 10) / 10, reviewCount: r.reviewCount, bestRating: 5 }
      : undefined
  };
}
