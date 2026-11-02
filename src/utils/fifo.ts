import { StockItem, InventoryBatch } from '../types';

export type ExpiryStatus = 'expired' | 'urgent' | 'warning' | 'good' | 'none';

/**
 * Returns the number of days until the given expiration date (negative if past expiration).
 */
export function getDaysUntilExpiry(expiryDate?: string): number | null {
  if (!expiryDate) return null;
  const exp = new Date(expiryDate);
  if (isNaN(exp.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate()).getTime();
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

/**
 * Tiered expiration alert evaluation:
 * - expired: <= 0 days (Crimson)
 * - urgent: 1 to 7 days (Red / Urgent Alert)
 * - warning: 8 to 30 days (Amber / Early Warning)
 * - good: > 30 days
 */
export function getExpiryStatus(expiryDate?: string): ExpiryStatus {
  const days = getDaysUntilExpiry(expiryDate);
  if (days === null) return 'none';
  if (days <= 0) return 'expired';
  if (days <= 7) return 'urgent';
  if (days <= 30) return 'warning';
  return 'good';
}

/**
 * FEFO (First-Expired, First-Out) batch comparator.
 * Batches with known earliest expiry date are consumed first.
 * Fallback to receivedDate (FIFO) when expiry dates are absent or equal.
 */
export function compareBatchesFEFO(a: InventoryBatch, b: InventoryBatch): number {
  if (a.expiryDate && b.expiryDate) {
    const timeA = new Date(a.expiryDate).getTime();
    const timeB = new Date(b.expiryDate).getTime();
    if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) {
      return timeA - timeB;
    }
  } else if (a.expiryDate && !b.expiryDate) {
    return -1; // Batches with known expiry date consumed first
  } else if (!a.expiryDate && b.expiryDate) {
    return 1;
  }
  return new Date(a.receivedDate).getTime() - new Date(b.receivedDate).getTime();
}

/**
 * Calculates FEFO/FIFO Cost of Goods Sold (COGS) and updates batch quantities.
 * Prioritizes batches with earliest expiration date (FEFO), with fallback to received date.
 */
export function calculateFIFOCost(
  product: StockItem,
  storeId: number,
  requiredBaseUnits: number
): { totalCost: number; updatedBatches: InventoryBatch[] } {
  if (requiredBaseUnits <= 0) {
    return {
      totalCost: 0,
      updatedBatches: product.batches?.[storeId] || []
    };
  }

  const existingBatches: InventoryBatch[] = [...(product.batches?.[storeId] || [])];

  // Fallback default cost if no batches or remaining units exceed batch stock
  const storePriceObj = product.storePrices?.[storeId];
  const defaultUnitCost = storePriceObj?.purchasePrice ?? product.purchasePrice ?? 0;

  // If no batches exist, auto-synthesize an initial batch from existing stock
  if (existingBatches.length === 0) {
    const currentStock = product.stock?.[storeId] || 0;
    if (currentStock > 0) {
      existingBatches.push({
        id: `initial-batch-${product.id}-${storeId}`,
        poNumber: 'INITIAL-STOCK',
        qty: currentStock,
        initialQty: currentStock,
        cost: defaultUnitCost,
        receivedDate: new Date().toISOString().split('T')[0],
        expiryDate: product.expiryDates?.[storeId] || product.expiryDate
      });
    }
  }

  // Sort batches by FEFO (earliest expiry first, fallback to received date)
  const sortedBatches = existingBatches
    .map(b => ({ ...b }))
    .sort(compareBatchesFEFO);

  let remainingToDeduct = requiredBaseUnits;
  let totalCost = 0;

  for (const batch of sortedBatches) {
    if (remainingToDeduct <= 0) break;
    if (batch.qty <= 0) continue;

    const qtyDeducted = Math.min(batch.qty, remainingToDeduct);
    totalCost += qtyDeducted * batch.cost;
    batch.qty -= qtyDeducted;
    remainingToDeduct -= qtyDeducted;
  }

  // If quantity sold exceeds available batch stock (e.g. negative stock allowed), evaluate remaining at default unit cost
  if (remainingToDeduct > 0) {
    totalCost += remainingToDeduct * defaultUnitCost;
  }

  // Keep batches with remaining qty > 0 (or keep recent 0-qty for record)
  const updatedBatches = sortedBatches.filter(b => b.qty > 0);

  return {
    totalCost,
    updatedBatches
  };
}

/**
 * Appends a new FIFO inventory batch when goods are received via Purchase Order or Stock Adjustment.
 */
export function addFIFOBatch(
  product: StockItem,
  storeId: number,
  batchData: {
    poNumber?: string;
    supplierName?: string;
    qty: number; // in base units
    cost: number; // cost per base unit
    receivedDate?: string;
    expiryDate?: string;
  }
): { [storeId: number]: InventoryBatch[] } {
  const currentBatches = { ...(product.batches || {}) };
  const storeBatches: InventoryBatch[] = [...(currentBatches[storeId] || [])];

  const newBatch: InventoryBatch = {
    id: `batch-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    poNumber: batchData.poNumber || 'MANUAL-REC',
    supplierName: batchData.supplierName,
    qty: batchData.qty,
    initialQty: batchData.qty,
    cost: batchData.cost,
    receivedDate: batchData.receivedDate || new Date().toISOString().split('T')[0],
    expiryDate: batchData.expiryDate
  };

  storeBatches.push(newBatch);
  currentBatches[storeId] = storeBatches;

  return currentBatches;
}

/**
 * Gets total inventory monetary valuation for a product at a given store using FIFO batch costs.
 */
export function getFIFOInventoryValuation(product: StockItem, storeId: number): {
  totalValue: number;
  totalQty: number;
  averageUnitCost: number;
} {
  const storeBatches = product.batches?.[storeId] || [];
  const defaultCost = product.storePrices?.[storeId]?.purchasePrice ?? product.purchasePrice ?? 0;

  if (storeBatches.length === 0) {
    const qty = product.stock?.[storeId] || 0;
    return {
      totalValue: qty * defaultCost,
      totalQty: qty,
      averageUnitCost: defaultCost
    };
  }

  let totalValue = 0;
  let totalQty = 0;

  for (const batch of storeBatches) {
    if (batch.qty > 0) {
      totalValue += batch.qty * batch.cost;
      totalQty += batch.qty;
    }
  }

  // If stock recorded in item.stock exceeds sum of batches, include unbatched stock
  const recordedStock = product.stock?.[storeId] || 0;
  if (recordedStock > totalQty) {
    const unbatchedQty = recordedStock - totalQty;
    totalValue += unbatchedQty * defaultCost;
    totalQty = recordedStock;
  }

  const averageUnitCost = totalQty > 0 ? totalValue / totalQty : defaultCost;

  return {
    totalValue,
    totalQty,
    averageUnitCost
  };
}

/**
 * Removes empty historical batch entries (qty <= 0) for a product at a given store.
 */
export function cleanupEmptyBatches(product: StockItem, storeId: number): {
  updatedProduct: StockItem;
  removedCount: number;
} {
  const currentBatchesMap = { ...(product.batches || {}) };
  const storeBatches = currentBatchesMap[storeId] || [];

  const activeBatches = storeBatches.filter(b => b.qty > 0);
  const removedCount = storeBatches.length - activeBatches.length;

  currentBatchesMap[storeId] = activeBatches;

  return {
    updatedProduct: {
      ...product,
      batches: currentBatchesMap
    },
    removedCount
  };
}

/**
 * Generates an itemized FIFO cost breakdown showing exactly which batches contributed to the cost.
 */
export function getFIFOBatchBreakdown(
  product: StockItem,
  storeId: number,
  requiredBaseUnits: number
): {
  totalCost: number;
  averageUnitCost: number;
  batchContributions: {
    poNumber: string;
    qtyDeducted: number;
    unitCost: number;
    totalCost: number;
    receivedDate?: string;
    expiryDate?: string;
  }[];
} {
  if (requiredBaseUnits <= 0) {
    return { totalCost: 0, averageUnitCost: 0, batchContributions: [] };
  }

  const storeBatches = product.batches?.[storeId] || [];
  const defaultUnitCost = product.storePrices?.[storeId]?.purchasePrice ?? product.purchasePrice ?? 0;

  if (storeBatches.length === 0) {
    return {
      totalCost: requiredBaseUnits * defaultUnitCost,
      averageUnitCost: defaultUnitCost,
      batchContributions: [{
        poNumber: 'STANDARD-COST',
        qtyDeducted: requiredBaseUnits,
        unitCost: defaultUnitCost,
        totalCost: requiredBaseUnits * defaultUnitCost
      }]
    };
  }

  // Sort by FEFO (earliest expiry first, fallback to received date)
  const sortedBatches = [...storeBatches]
    .filter(b => b.qty > 0)
    .sort(compareBatchesFEFO);

  let remaining = requiredBaseUnits;
  let totalCost = 0;
  const batchContributions: {
    poNumber: string;
    qtyDeducted: number;
    unitCost: number;
    totalCost: number;
    receivedDate?: string;
    expiryDate?: string;
  }[] = [];

  for (const batch of sortedBatches) {
    if (remaining <= 0) break;

    const qtyDeducted = Math.min(batch.qty, remaining);
    const costForThis = qtyDeducted * batch.cost;
    totalCost += costForThis;

    batchContributions.push({
      poNumber: batch.poNumber || 'BATCH',
      qtyDeducted,
      unitCost: batch.cost,
      totalCost: costForThis,
      receivedDate: batch.receivedDate,
      expiryDate: batch.expiryDate
    });

    remaining -= qtyDeducted;
  }

  if (remaining > 0) {
    const unbatchedCost = remaining * defaultUnitCost;
    totalCost += unbatchedCost;
    batchContributions.push({
      poNumber: 'STANDARD-COST',
      qtyDeducted: remaining,
      unitCost: defaultUnitCost,
      totalCost: unbatchedCost
    });
  }

  return {
    totalCost,
    averageUnitCost: totalCost / requiredBaseUnits,
    batchContributions
  };
}

