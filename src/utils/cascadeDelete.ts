import { Company, Branch, Store, User, StockItem, PurchaseOrder, SalesOrder, Expense } from '../types';
import { sameId } from './idUtils';

export interface AppState {
  companies: Company[];
  branches: Branch[];
  stores: Store[];
  users: User[];
  stockItems: StockItem[];
  purchaseOrders: PurchaseOrder[];
  salesOrders: SalesOrder[];
  expenses: Expense[];
}

/**
 * Returns active (non-deleted) entity IDs based on hierarchy rules.
 * A Store is active if it is not deleted, its branch is not deleted, and its company is not deleted.
 */
export function getActiveEntities(
  companies: Company[],
  branches: Branch[],
  stores: Store[]
) {
  const activeCompanyIds = new Set<string>(
    companies.filter(c => !c.isDeleted).map(c => String(c.id))
  );
  
  const activeBranchIds = new Set<string>(
    branches
      .filter(b => !b.isDeleted && (b.companyId == null || activeCompanyIds.has(String(b.companyId))))
      .map(b => String(b.id))
  );
  
  const activeStoreIds = new Set<string>(
    stores
      .filter(s => !s.isDeleted && (s.branchId == null || activeBranchIds.has(String(s.branchId))))
      .map(s => String(s.id))
  );

  return {
    activeCompanyIds,
    activeBranchIds,
    activeStoreIds
  };
}

/**
 * Dynamically filters out data related to deleted entities.
 */
export function filterActiveData(state: AppState): AppState {
  const { activeCompanyIds, activeBranchIds, activeStoreIds } = getActiveEntities(
    state.companies,
    state.branches,
    state.stores
  );

  // 1. Clean user assignments
  const cleanedUsers = state.users.map(u => {
    let companyId = u.companyId;
    let branchId = u.branchId;
    let storeId = u.storeId;

    if (companyId != null && activeCompanyIds.size > 0 && !activeCompanyIds.has(String(companyId))) {
      companyId = null;
      branchId = null;
      storeId = null;
    }
    if (branchId != null && activeBranchIds.size > 0 && !activeBranchIds.has(String(branchId))) {
      branchId = null;
      storeId = null;
    }
    if (storeId != null && activeStoreIds.size > 0 && !activeStoreIds.has(String(storeId))) {
      storeId = null;
    }

    return {
      ...u,
      companyId,
      branchId,
      storeId
    };
  });

  // 2. Clean stock references (only keep active, non-deleted items)
  const cleanedStockItems = state.stockItems.filter(item => !item.isDeleted).map(item => {
    const cleanedStock: { [storeId: string]: number } = {};
    if (item.stock) {
      Object.entries(item.stock).forEach(([stIdStr, qty]) => {
        // If activeStoreIds has records, keep active stores or legacy unassigned
        if (activeStoreIds.size === 0 || activeStoreIds.has(String(stIdStr))) {
          cleanedStock[stIdStr] = qty;
        } else {
          // Check if the store is actually marked deleted
          const foundStore = state.stores.find(s => sameId(s.id, stIdStr));
          if (!foundStore || !foundStore.isDeleted) {
            cleanedStock[stIdStr] = qty;
          }
        }
      });
    }
    return {
      ...item,
      stock: cleanedStock
    };
  });

  // 3. Filter orders and expenses
  // DO NOT drop purchase orders, sales orders, or expenses if they are valid records!
  // Only drop if explicitly soft-deleted, or if their bound company or store is explicitly marked isDeleted: true.
  const cleanedSalesOrders = state.salesOrders.filter(so => {
    if ((so as any).isDeleted) return false;
    if (so.storeId != null) {
      const foundStore = state.stores.find(s => sameId(s.id, so.storeId));
      if (foundStore && foundStore.isDeleted) return false;
    }
    const soCo = (so as any).companyId;
    if (soCo != null) {
      const foundCo = state.companies.find(c => sameId(c.id, soCo));
      if (foundCo && foundCo.isDeleted) return false;
    }
    return true;
  });

  const cleanedPurchaseOrders = state.purchaseOrders.filter(po => {
    if (po.isDeleted) return false;
    if (po.storeId != null) {
      const foundStore = state.stores.find(s => sameId(s.id, po.storeId));
      if (foundStore && foundStore.isDeleted) return false;
    }
    const poCo = (po as any).companyId;
    if (poCo != null) {
      const foundCo = state.companies.find(c => sameId(c.id, poCo));
      if (foundCo && foundCo.isDeleted) return false;
    }
    return true;
  });

  const cleanedExpenses = state.expenses.filter(exp => {
    if ((exp as any).isDeleted) return false;
    if (exp.storeId != null && exp.storeId !== 0) {
      const foundStore = state.stores.find(s => sameId(s.id, exp.storeId));
      if (foundStore && foundStore.isDeleted) return false;
    }
    const expCo = (exp as any).companyId;
    if (expCo != null) {
      const foundCo = state.companies.find(c => sameId(c.id, expCo));
      if (foundCo && foundCo.isDeleted) return false;
    }
    return true;
  });

  return {
    companies: state.companies,
    branches: state.branches,
    stores: state.stores,
    users: cleanedUsers,
    stockItems: cleanedStockItems,
    purchaseOrders: cleanedPurchaseOrders,
    salesOrders: cleanedSalesOrders,
    expenses: cleanedExpenses
  };
}

/**
 * Performs state update cleanup during soft deletion of a Company, Branch, or Store.
 */
export function performCascadeDelete(
  type: 'company' | 'branch' | 'store',
  id: number | string,
  state: AppState
): Partial<AppState> {
  let updatedCompanies = [...state.companies];
  let updatedBranches = [...state.branches];
  let updatedStores = [...state.stores];

  if (type === 'company') {
    updatedCompanies = state.companies.map(c => sameId(c.id, id) ? { ...c, isDeleted: true } : c);
    updatedBranches = state.branches.map(b => sameId(b.companyId, id) ? { ...b, isDeleted: true } : b);
    const branchIds = state.branches.filter(b => sameId(b.companyId, id)).map(b => b.id);
    updatedStores = state.stores.map(s => branchIds.some(bid => sameId(bid, s.branchId)) ? { ...s, isDeleted: true } : s);
  } else if (type === 'branch') {
    updatedBranches = state.branches.map(b => sameId(b.id, id) ? { ...b, isDeleted: true } : b);
    updatedStores = state.stores.map(s => sameId(s.branchId, id) ? { ...s, isDeleted: true } : s);
  } else if (type === 'store') {
    updatedStores = state.stores.map(s => sameId(s.id, id) ? { ...s, isDeleted: true } : s);
  }

  // Run cleanup filters on top of the marked entities
  const filtered = filterActiveData({
    ...state,
    companies: updatedCompanies,
    branches: updatedBranches,
    stores: updatedStores
  });

  return {
    companies: updatedCompanies,
    branches: updatedBranches,
    stores: updatedStores,
    users: filtered.users,
    stockItems: filtered.stockItems,
    salesOrders: filtered.salesOrders,
    purchaseOrders: filtered.purchaseOrders,
    expenses: filtered.expenses
  };
}
