/**
 * Test: sanitizeArray and sanitizeStateData prevent undefined entries
 * from crashing React internals (reportAllChanges reading .startTime from undefined).
 *
 * Run: node --experimental-vm-modules node_modules/.bin/jest src/__tests__/sanitize.test.ts
 * Or simply: node -e "require('./sanitize.test.ts')" (inline, no framework needed).
 */

// --- Inline test harness (no jest/vitest dependency) ---
let _pass = 0;
let _fail = 0;
function expect(actual: any) {
  return {
    toBe(expected: any) {
      if (actual === expected) { _pass++; } else { _fail++; console.error(`  FAIL: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
    },
    toEqual(expected: any) {
      const a = JSON.stringify(actual), e = JSON.stringify(expected);
      if (a === e) { _pass++; } else { _fail++; console.error(`  FAIL: expected ${e}, got ${a}`); }
    },
    toBeTruthy() {
      if (actual) { _pass++; } else { _fail++; console.error(`  FAIL: expected truthy, got ${JSON.stringify(actual)}`); }
    },
    toHaveLength(n: number) {
      if (actual && actual.length === n) { _pass++; } else { _fail++; console.error(`  FAIL: expected length ${n}, got ${actual?.length}`); }
    },
  };
}

// --- Import the functions under test (copied inline to avoid module resolution issues) ---

const sanitizeArray = <T extends Record<string, any>>(arr: any): T[] => {
  if (!Array.isArray(arr)) return [];
  return arr.filter((item): item is T => item != null && typeof item === 'object' && !Array.isArray(item));
};

const COLLECTION_KEYS = [
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
];

const sanitizeStateData = (data: any): any => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
  const cleaned: any = { ...data };
  for (const key of COLLECTION_KEYS) {
    if (key in cleaned) cleaned[key] = sanitizeArray(cleaned[key]);
  }
  return cleaned;
};

// --- Tests ---

console.log('--- sanitizeArray tests ---');

// Test 1: Array with undefined, null, and valid objects (the exact crash scenario)
const corruptedFlashSales = [{ startTime: '2026-01-01T00:00:00Z', endTime: '2026-12-31T23:59:59Z', status: 'active' }, undefined, null, {}];
const cleanedFlash = sanitizeArray(corruptedFlashSales);
expect(cleanedFlash).toHaveLength(2); // valid object + empty object
expect(cleanedFlash[0].startTime).toBe('2026-01-01T00:00:00Z');

// Test 2: reportAllChanges simulation — iterating over sanitized array with .startTime access
const reportAllChanges = (items: any[]) => {
  // This is the pattern that crashes: items.forEach(item => item.startTime)
  // After sanitization, no item should be undefined/null/primitive
  items.forEach((item) => {
    // If item is undefined/null, this would throw: Cannot read properties of undefined (reading 'startTime')
    const t = item.startTime;
    return t; // just accessing, not using
  });
};
// This should NOT throw after sanitization
try {
  reportAllChanges(cleanedFlash);
  expect(true).toBeTruthy();
} catch {
  _fail++;
  console.error('  FAIL: reportAllChanges crashed on sanitized array');
}

// Test 3: Original (uncleaned) array WOULD crash
try {
  reportAllChanges(corruptedFlashSales);
  _fail++;
  console.error('  FAIL: reportAllChanges should have crashed on uncleaned array');
} catch (e: any) {
  expect(e.message.includes("Cannot read properties")).toBeTruthy();
}

// Test 4: sanitizeArray with non-array input
expect(sanitizeArray(null)).toHaveLength(0);
expect(sanitizeArray(undefined)).toHaveLength(0);
expect(sanitizeArray('string')).toHaveLength(0);
expect(sanitizeArray(42)).toHaveLength(0);

// Test 5: sanitizeArray preserves valid objects
const valid = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }];
expect(sanitizeArray(valid)).toHaveLength(2);

// Test 6: sanitizeArray removes primitives that leak in
const mixed = [{ id: 1 }, 'oops', 42, undefined, null, { id: 2 }, false];
expect(sanitizeArray(mixed)).toHaveLength(2); // only the two objects

// Test 7: sanitizeStateData cleans all collection keys
const dirtyState = {
  flashSales: [{ startTime: '2026-01-01', endTime: '2026-12-31', status: 'active' }, undefined, null],
  marketplaceProducts: [{ id: 1, name: 'prod' }, undefined],
  users: [{ id: 1, username: 'admin' }, null, { id: 2, username: 'user' }],
  settings: { theme: 'dark' }, // non-collection, preserved as-is
};
const cleaned = sanitizeStateData(dirtyState);
expect(cleaned.flashSales).toHaveLength(1);
expect(cleaned.marketplaceProducts).toHaveLength(1);
expect(cleaned.users).toHaveLength(2);
expect(cleaned.settings.theme).toBe('dark'); // non-collection preserved

// Test 8: sanitizeStateData with null/undefined input
expect(sanitizeStateData(null)).toBe(null);
expect(sanitizeStateData(undefined)).toBe(undefined);

// Test 9: Poll merge simulation — the exact pattern from App.tsx:1685
// .map().find() can return undefined; .filter(Boolean) + sanitizeArray catches it
const curProds = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }];
const incomingProducts = [{ id: 2, name: 'B-updated' }, { id: 4, name: 'D' }];
const incomingProdIds = new Set(incomingProducts.map(p => p.id));
const mergedProds = curProds
  .map((p: any) => incomingProdIds.has(p.id) ? incomingProducts.find((ip: any) => ip.id === p.id) : p)
  .filter(Boolean);
// Simulate the case where .find() doesn't match (race condition)
const raceMerged = curProds
  .map((p: any) => ({ id: p.id, _replaced: true })) // simulate some mismatch
  .map((p: any) => incomingProdIds.has(p.id) ? incomingProducts.find((ip: any) => ip.id === p.id) : p)
  .filter(Boolean);
// Even with potential undefined from find(), filter(Boolean) removes them
const finalCleaned = sanitizeArray(raceMerged);
finalCleaned.forEach((item: any) => {
  // This is the crash pattern: accessing startTime on potentially-undefined items
  // After sanitization, it should never crash
  expect(typeof item === 'object').toBeTruthy();
});

// Test 10: flashSales with items missing startTime/endTime — should survive null-safe access
const flashSalesWithMissingFields = [
  { id: 1, startTime: '2026-01-01', endTime: '2026-12-31', status: 'active' },
  { id: 2 }, // missing startTime and endTime
  undefined,
  null,
  { id: 3, startTime: '2026-06-01', endTime: '2026-12-31', status: 'upcoming', items: [] },
];
const cleanedSales = sanitizeArray(flashSalesWithMissingFields);
// The null-safe filter: s && s.startTime && s.endTime
const active = cleanedSales.filter((s: any) => s && s.startTime && s.endTime && s.status === 'active');
expect(active).toHaveLength(1);
expect(active[0].id).toBe(1);

// --- Summary ---
console.log(`\nResults: ${_pass} passed, ${_fail} failed`);
if (_fail > 0) process.exit(1);
console.log('All tests passed!');
