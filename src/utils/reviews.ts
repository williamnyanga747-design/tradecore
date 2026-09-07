import { Company, MarketplaceProduct, Review } from '../types';

/** Reviews that are visible on the public storefront (approved only). */
export function approvedReviews(reviews: Review[]): Review[] {
  return reviews.filter(r => r.status === 'approved');
}

/** Approved reviews for a specific company and/or product. */
export function reviewsFor(
  reviews: Review[],
  target: { companyId?: number; productId?: number | null },
  status: ReviewStatusFilter = 'approved'
): Review[] {
  const approved = status === 'all' ? reviews : reviews.filter(r => r.status === status);
  return approved.filter(r =>
    (target.companyId === undefined || r.companyId === target.companyId) &&
    (target.productId === undefined || r.productId === target.productId)
  );
}

export type ReviewStatusFilter = 'approved' | 'all';

/** Approve/reject count aggregates used on product + company pages. */
export function ratingSummary(reviews: Review[], target: { companyId: number; productId?: number | null }) {
  const approved = reviewsFor(reviews, target, 'approved');
  const total = approved.length;
  const avg = total === 0 ? 0 : approved.reduce((s, r) => s + r.rating, 0) / total;
  const breakdown: { stars: number; count: number }[] = [5, 4, 3, 2, 1].map(stars => ({
    stars,
    count: approved.filter(r => r.rating === stars).length
  }));
  return { avg, total, breakdown, approved };
}

/**
 * Recompute average_rating + reviews_count for every company and product from the
 * approved reviews. Returns fresh arrays so callers can saveAllData them together.
 */
export function computeRatings(
  reviews: Review[],
  companies: Company[],
  products: MarketplaceProduct[]
): { companies: Company[]; products: MarketplaceProduct[] } {
  const approved = approvedReviews(reviews);

  const companyAgg = new Map<number, { sum: number; count: number }>();
  const productAgg = new Map<number, { sum: number; count: number }>();

  for (const r of approved) {
    if (r.companyId !== undefined) {
      const cur = companyAgg.get(r.companyId) || { sum: 0, count: 0 };
      cur.sum += r.rating;
      cur.count += 1;
      companyAgg.set(r.companyId, cur);
    }
    if (r.productId !== undefined && r.productId !== null) {
      const cur = productAgg.get(r.productId) || { sum: 0, count: 0 };
      cur.sum += r.rating;
      cur.count += 1;
      productAgg.set(r.productId, cur);
    }
  }

  const round1 = (v: number) => Math.round(v * 10) / 10;

  const nextCompanies = companies.map(c => {
    const agg = companyAgg.get(c.id);
    return {
      ...c,
      averageRating: agg ? round1(agg.sum / agg.count) : 0,
      reviewsCount: agg ? agg.count : 0
    };
  });

  const nextProducts = products.map(p => {
    const agg = productAgg.get(p.id);
    return {
      ...p,
      averageRating: agg ? round1(agg.sum / agg.count) : 0,
      reviewsCount: agg ? agg.count : 0
    };
  });

  return { companies: nextCompanies, products: nextProducts };
}

/** 24h spam guard: the same reviewer (phone if present, else name) + product within 24h. */
export function isDuplicateReview(reviews: Review[], data: { productId: number | null; reviewerPhone?: string; reviewerName: string }): boolean {
  const key = (data.reviewerPhone && data.reviewerPhone.trim()
    ? data.reviewerPhone.trim().replace(/[^0-9]/g, '')
    : data.reviewerName.trim().toLowerCase());
  if (!key) return false;
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return reviews.some(r =>
    r.productId === data.productId &&
    new Date(r.createdAt).getTime() > cutoff &&
    (r.reviewerPhone ? r.reviewerPhone.replace(/[^0-9]/g, '') === key : r.reviewerName.trim().toLowerCase() === key)
  );
}
