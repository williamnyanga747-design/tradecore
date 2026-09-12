// SAFE STATE HELPERS (2026-09-08-22)
// ---------------------------------------------------------------------------
// The app renders from database collections that can arrive from the API as
// arrays, object-maps, null, undefined, or primitives — a stale snapshot, a
// fresh DB with no rows, a partial payload, or a mis-typed legacy record.
// EVERY render path must be crash-proof against
//   "TypeError: Cannot convert undefined or null to object ... at Object.values"
// These helpers normalize any of those shapes into a plain array (or a
// safely-guarded value) and let state hydration guarantee collections are
// never null/undefined when they enter React state.

/** Normalize any collection-ish value to a plain array. */
export function safeArray<T>(data: T[] | Record<string, T> | null | undefined): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'object') {
    try { return Object.values(data as Record<string, T>); } catch { return []; }
  }
  return [];
}

/** Safe Object.values for any possibly-null/malformed object (falls back to []). */
export function safeObjectValues<T>(data: Record<string, T> | null | undefined): T[] {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  try { return Object.values(data as Record<string, T>); } catch { return []; }
}

/** Safe Object.keys for any possibly-null/malformed object (falls back to []). */
export function safeObjectKeys(data: object | null | undefined): string[] {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  try { return Object.keys(data); } catch { return []; }
}

// Canonical list of every collection that enters React state as an array.
// Kept in ONE module so hydration normalization and the sanitize pass always
// agree about which keys must be arrays.
export const COLLECTION_KEYS = [
  'companies', 'branches', 'stores', 'users', 'categories', 'taxes',
  'suppliers', 'customers', 'stockItems', 'purchaseOrders', 'salesOrders',
  'expenses', 'auditTrails', 'securityLogs', 'rolePermissions', 'posShifts',
  'stockTransfers', 'contactMessages', 'marketplaceProducts', 'marketplaceCustomers',
  'marketplaceOrders', 'marketplaceClicks', 'reviews', 'productViews', 'wallets',
  'walletTransactions', 'withdrawals', 'affiliates', 'affiliateClicks',
  'affiliateSales', 'affiliateWithdrawals', 'searchSynonyms', 'pushSubscriptions',
  'collections', 'webhookLogs', 'adminEarnings', 'offers', 'offerMessages',
  'groupDeals', 'groupDealParticipants', 'whatsappConversations', 'notificationLogs',
  'deliveries', 'deliveryUpdates', 'installmentPlans', 'installmentOrders',
  'installmentPayments', 'liveStreams', 'liveComments', 'loyaltyCustomers',
  'loyaltyTransactions', 'loyaltyRedeemCodes', 'voiceSearches', 'qrScans',
  'traReceipts', 'escrowTransactions', 'chatConversations', 'chatMessages',
  'visualSearches', 'productReturns', 'disputes', 'disputeMessages',
  'flashSales', 'appNotifications', 'bulkUploads', 'stories', 'storyViews',
] as const;

/**
 * State-engine normalization (build 2026-09-08-22): given an arbitrary incoming
 * state object (from a snapshot, SSE payload, localStorage boot or CRUD merge),
 * returns a COPY in which every collection key is guaranteed to be a plain array.
 * Object-maps (e.g. { categories: { 'co_1:Food': {...} } }) are unwrapped via
 * safeArray; null/undefined/primitive values become []. All non-collection keys
 * are preserved verbatim.
 */
export function normalizeDbCollections<T extends Record<string, any>>(state: T | null | undefined): T {
  const src = (state && typeof state === 'object' && !Array.isArray(state)) ? state : ({} as T);
  const out: Record<string, any> = { ...src };
  for (const key of COLLECTION_KEYS) {
    if (key in src) {
      out[key] = safeArray((src as any)[key]);
    }
  }
  return out as T;
}

/**
 * Normalize a component-level slice (e.g. a single stock map) defensively. Kept
 * tiny and generic: returns safeArray + safeObjectValues so components never
 * have to think about which shape they are receiving.
 */
export function safeCollection<T>(data: T | T[] | Record<string, T> | null | undefined, fallback: T[] = []): T[] {
  const arr = safeArray<T>(data as any);
  return arr.length > 0 ? arr : fallback;
}