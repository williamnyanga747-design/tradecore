import React, { useState, useEffect } from 'react';
import {
  Company, Branch, Store, Customer, Supplier, Tax, StockItem, User
} from '../types';
import {
  Plus, Pencil, Trash2, X, Store as StoreIcon, Database, RefreshCw, FileText, MessageSquare,
  Search, Loader2
} from 'lucide-react';
import { formatMoney } from '../utils/format';
import { ConfirmActionModal } from './ConfirmActionModal';
import { AccountStatementModal } from './AccountStatementModal';
import { SmartMessagingModal } from './SmartMessagingModal';
import { performCascadeDelete } from '../utils/cascadeDelete';
import { toast } from '../utils/toast';
import { getStoreCategories, getCompanyCategories, formatCompanyCategory, cleanCategoryName } from '../utils/categoryHelper';
import { sv, sameId, getActiveCompanyScope } from '../utils/idUtils';
import { v2DeleteCategory } from '../utils/normalizedPersistence';
import LocationPicker from './marketplace/LocationPicker';

interface MasterDataProps {
  currentPage: string;
  companies: Company[];
  branches: Branch[];
  stores: Store[];
  customers: Customer[];
  suppliers: Supplier[];
  categories: string[];
  taxes: Tax[];
  stockItems: StockItem[];
  users: User[];
  currentCompanyId: string | number | null;
  currentBranchId: string | number | null;
  currentStoreId: string | number | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  currency: string;
  exchangeRate: number;
  translate: (text: string) => string;
  logAction: (action: string, details: string) => void;
  saveAllData: (updatedFields: any) => void;
  refreshMasterData?: (tab: string) => void;
  addCompany?: (data: { name: string; [k: string]: unknown }) => Promise<string>;
  mutateRecord?: (collection: string, op: 'upsert' | 'delete', recordId: string | number, record: any) => Promise<boolean>;
  settings?: any;
  currentUser?: any;
  onNavigate?: (page: string) => void;
  salesOrders?: any[];
  purchaseOrders?: any[];
}

export default function MasterData({
  currentPage,
  companies,
  branches,
  stores,
  customers,
  suppliers,
  categories,
  taxes,
  stockItems,
  users,
  currentCompanyId,
  currentBranchId,
  currentStoreId,
  isAdmin,
  isSuperAdmin,
  currency,
  exchangeRate,
  translate: t,
  logAction,
  saveAllData,
  refreshMasterData,
  addCompany,
  mutateRecord,
  settings,
  currentUser,
  onNavigate,
  salesOrders = [],
  purchaseOrders = []
}: MasterDataProps) {
  const [editingItem, setEditingItem] = useState<{ type: string; data: any } | null>(null);
  const [showOnlyNoTin, setShowOnlyNoTin] = useState(false);
  const [activeStoreDetailsId, setActiveStoreDetailsId] = useState<number | null>(null);

  const [statementModal, setStatementModal] = useState<{
    isOpen: boolean;
    entityType: 'customer' | 'supplier';
    entityId: number;
    name: string;
  }>({
    isOpen: false,
    entityType: 'customer',
    entityId: 0,
    name: ''
  });

  const [messagingModal, setMessagingModal] = useState<{
    isOpen: boolean;
    recipientName: string;
    recipientPhone: string;
    outstandingBalance: number;
  }>({
    isOpen: false,
    recipientName: '',
    recipientPhone: '',
    outstandingBalance: 0
  });

  const [localCompanyRates, setLocalCompanyRates] = useState<Record<number, string>>({});
  const [localUserRates, setLocalUserRates] = useState<Record<string, string>>({});
  const [localGlobalRate, setLocalGlobalRate] = useState<string>('');

  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {}
  });

  // Helper for money formatting
  const fmt = (amt: number) => formatMoney(amt, currency, exchangeRate);

  // DIRECT-MYSQL TAB LOAD (2026-09-08-12): opening System Companies / Branches / Stores
  // re-reads the collection straight from MySQL (superadmin = GLOBAL server-side scope).
  // No more "Filter per-company snapshot … skipping due to company_id mismatch" — the list
  // IS whatever the tradecore_companies / stores tables hold, refreshed on every tab open.
  useEffect(() => {
    if (refreshMasterData && (currentPage === 'companies' || currentPage === 'branches' || currentPage === 'stores')) {
      refreshMasterData(currentPage);
    }
  }, [currentPage, refreshMasterData]);

  // BUILD 2026-09-08-19 (Required Fix 4): clear stale form/editing state on explicit
  // company switch so the user never continues editing a record of the PREVIOUS scope
  // (e.g. editing Company B's store details while viewing Company A).
  useEffect(() => {
    const onScopeChange = () => {
      setEditingItem(null);
      setShowOnlyNoTin(false);
      setActiveStoreDetailsId(null);
      setStatementModal(prev => ({ ...prev, isOpen: false }));
      setMessagingModal(prev => ({ ...prev, isOpen: false }));
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
      setLocalCompanyRates({});
      setLocalUserRates({});
      setLocalGlobalRate('');
    };
    window.addEventListener('companyScopeChanged', onScopeChange);
    return () => window.removeEventListener('companyScopeChanged', onScopeChange);
  }, []);

  // --- DELETE HANDLERS ---
  const handleDeleteCompany = (id: number) => {
    const compName = companies.find(c => sameId(c.id, id))?.name || `ID ${id}`;
    setConfirmModal({
      isOpen: true,
      title: t('Delete Company'),
      description: `${t('Are you sure you want to delete company')} "${compName}"? ${t('This will soft-delete its accounts, branches, stores and stock.')}`,
      onConfirm: () => {
        const result = performCascadeDelete('company', id, {
          companies,
          branches,
          stores,
          users,
          stockItems,
          purchaseOrders: [],
          salesOrders: [],
          expenses: []
        });
        saveAllData({
          companies: result.companies,
          branches: result.branches,
          stores: result.stores,
          users: result.users,
          stockItems: result.stockItems
        });
        logAction('Delete Company', `Soft deleted Company ID: ${id}`);
      }
    });
  };

  const handleDeleteBranch = (id: number) => {
    const brName = branches.find(b => sameId(b.id, id))?.name || `ID ${id}`;
    setConfirmModal({
      isOpen: true,
      title: t('Delete Branch'),
      description: `${t('Are you sure you want to delete branch')} "${brName}"? ${t('This will soft-delete associated stores.')}`,
      onConfirm: () => {
        const result = performCascadeDelete('branch', id, {
          companies,
          branches,
          stores,
          users,
          stockItems,
          purchaseOrders: [],
          salesOrders: [],
          expenses: []
        });
        saveAllData({
          companies: result.companies,
          branches: result.branches,
          stores: result.stores,
          users: result.users,
          stockItems: result.stockItems
        });
        logAction('Delete Branch', `Soft deleted Branch ID: ${id}`);
      }
    });
  };

  const handleDeleteStore = (id: number) => {
    const stName = stores.find(s => sameId(s.id, id))?.name || `ID ${id}`;
    setConfirmModal({
      isOpen: true,
      title: t('Delete Store'),
      description: `${t('Are you sure you want to delete store')} "${stName}"?`,
      onConfirm: () => {
        const result = performCascadeDelete('store', id, {
          companies,
          branches,
          stores,
          users,
          stockItems,
          purchaseOrders: [],
          salesOrders: [],
          expenses: []
        });
        saveAllData({
          companies: result.companies,
          branches: result.branches,
          stores: result.stores,
          users: result.users,
          stockItems: result.stockItems
        });
        logAction('Delete Store', `Soft deleted Store ID: ${id}`);
      }
    });
  };

  const handleDeleteCategory = (catName: string) => {
    const cleanName = cleanCategoryName(catName);
    setConfirmModal({
      isOpen: true,
      title: t('Delete Category'),
      description: `${t('Are you sure you want to permanently delete category')} "${cleanName}"?`,
      onConfirm: () => {
        const updatedCategories = categories.filter(c => c !== catName);
        saveAllData({ categories: updatedCategories });
        logAction('Delete Category', `Deleted Category: ${cleanName}`);
        // BUILD 2026-09-08-19 (Required Fix 3): ALSO delete the row from the normalized
        // stock_categories MySQL table so the category cannot resurrect from the DB on
        // the next v2ListCategories re-read (the blob-only path left a ghost category
        // behind that reappeared after every reload).
        const cid = currentCompanyId != null ? String(currentCompanyId) : (currentUser?.companyId != null ? String(currentUser.companyId) : '');
        if (cid) {
          void v2DeleteCategory(cid, cleanName).catch((e) => console.warn('[MasterData] v2DeleteCategory failed', e));
        }
      }
    });
  };

  const saveCompanyTaxes = (updatedTaxes: Tax[]) => {
    const compId = currentCompanyId ?? currentUser?.companyId ?? null;
    if (compId != null) {
      saveAllData({
        settings: {
          ...settings,
          companyTaxes: {
            ...(settings?.companyTaxes || {}),
            [compId]: updatedTaxes
          }
        }
      });
    } else {
      saveAllData({ taxes: updatedTaxes });
    }
  };

  const handleDeleteTax = (id: number) => {
    const tx = taxes.find(t => t.id === id);
    const txName = tx ? `${tx.name} (${tx.rate}%)` : `ID ${id}`;
    setConfirmModal({
      isOpen: true,
      title: t('Delete Tax Rate'),
      description: `${t('Are you sure you want to permanently delete tax rate')} "${txName}"?`,
      onConfirm: () => {
        const updatedTaxes = taxes.filter(t => t.id !== id);
        saveCompanyTaxes(updatedTaxes);
        logAction('Delete Tax', `Deleted Tax ID: ${id}`);
      }
    });
  };

  const handleDeleteCustomer = (id: number) => {
    const cust = customers.find(c => sameId(c.id, id));
    const custName = cust ? cust.name : `ID ${id}`;
    setConfirmModal({
      isOpen: true,
      title: t('Delete Customer'),
      description: `${t('Are you sure you want to delete customer')} "${custName}"?`,
      onConfirm: () => {
        const updatedCustomers = customers.filter(c => !sameId(c.id, id));
        saveAllData({ customers: updatedCustomers });
        logAction('Delete Customer', `Deleted Customer ID: ${id}`);
      }
    });
  };

  const handleDeleteSupplier = (id: number) => {
    const sup = suppliers.find(s => sameId(s.id, id));
    const supName = sup ? sup.name : `ID ${id}`;
    setConfirmModal({
      isOpen: true,
      title: t('Delete Supplier'),
      description: `${t('Are you sure you want to delete supplier')} "${supName}"?`,
      onConfirm: () => {
        const updatedSuppliers = suppliers.filter(s => !sameId(s.id, id));
        saveAllData({ suppliers: updatedSuppliers });
        logAction('Delete Supplier', `Deleted Supplier ID: ${id}`);
      }
    });
  };

  // --- RESTORE HANDLERS ---
  const handleRestoreCompany = (id: number) => {
    const updatedCompanies = companies.map(c => sameId(c.id, id) ? { ...c, isDeleted: false } : c);
    const companyBranches = branches.filter(b => sameId(b.companyId, id)).map(b => b.id);
    const updatedBranches = branches.map(b => sameId(b.companyId, id) ? { ...b, isDeleted: false } : b);
    const updatedStores = stores.map(s => companyBranches.includes(s.branchId) ? { ...s, isDeleted: false } : s);

    saveAllData({
      companies: updatedCompanies,
      branches: updatedBranches,
      stores: updatedStores
    });
    logAction('Restore Company', `Restored Company ID: ${id} and its branches & stores`);
  };

  const handleRestoreBranch = (id: number) => {
    const updatedBranches = branches.map(b => b.id === id ? { ...b, isDeleted: false } : b);
    const updatedStores = stores.map(s => sameId(s.branchId, id) ? { ...s, isDeleted: false } : s);

    saveAllData({
      branches: updatedBranches,
      stores: updatedStores
    });
    logAction('Restore Branch', `Restored Branch ID: ${id} and its stores`);
  };

  const handleRestoreStore = (id: number) => {
    const updatedStores = stores.map(s => s.id === id ? { ...s, isDeleted: false } : s);

    saveAllData({
      stores: updatedStores
    });
    logAction('Restore Store', `Restored Store ID: ${id}`);
  };

  const handlePermanentDeleteCompany = (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: t('Permanent Delete Company'),
      description: t('Are you sure you want to permanently delete this company? This will also permanently remove all its branches and stores. This action is irreversible.'),
      onConfirm: () => {
        const updatedCompanies = companies.filter(c => c.id !== id);
        const deletedBranchesInCompany = branches.filter(b => sameId(b.companyId, id)).map(b => b.id);
        const updatedBranches = branches.filter(b => b.companyId !== id);
        const updatedStores = stores.filter(s => !deletedBranchesInCompany.includes(s.branchId));
        saveAllData({ 
          companies: updatedCompanies,
          branches: updatedBranches,
          stores: updatedStores
        });
        logAction('Permanent Delete Company', `Permanently deleted Company ID: ${id}`);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handlePermanentDeleteBranch = (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: t('Permanent Delete Branch'),
      description: t('Are you sure you want to permanently delete this branch? This will also permanently remove all its stores. This action is irreversible.'),
      onConfirm: () => {
        const updatedBranches = branches.filter(b => b.id !== id);
        const updatedStores = stores.filter(s => s.branchId !== id);
        saveAllData({ 
          branches: updatedBranches,
          stores: updatedStores
        });
        logAction('Permanent Delete Branch', `Permanently deleted Branch ID: ${id}`);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handlePermanentDeleteStore = (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: t('Permanent Delete Store'),
      description: t('Are you sure you want to permanently delete this store? This action is irreversible.'),
      onConfirm: () => {
        const updatedStores = stores.filter(s => s.id !== id);
        saveAllData({ 
          stores: updatedStores
        });
        logAction('Permanent Delete Store', `Permanently deleted Store ID: ${id}`);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // --- SAVE HANDLERS FOR FORMS ---
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const { type, data } = editingItem;

    if (type === 'company') {
      const coLang = data.language || 'en';
      const coCurr = data.currency || 'USD';
      const coRate = data.exchangeRate !== undefined ? Number(data.exchangeRate) : 1;
      const cleanCompany = {
        ...data,
        language: coLang,
        currency: coCurr,
        exchangeRate: coRate
      };

      if (data.id) {
        // Edit
        const compId = data.id;
        const updated = companies.map(c => sameId(c.id, compId) ? cleanCompany : c);
        const nextSettings = {
          ...settings,
          companyLanguages: { ...(settings?.companyLanguages || {}), [compId]: coLang },
          companyCurrencies: { ...(settings?.companyCurrencies || {}), [compId]: coCurr },
          companyExchangeRates: { ...(settings?.companyExchangeRates || {}), [compId]: coRate }
        };
        saveAllData({ companies: updated, settings: nextSettings });
        logAction('Edit Company', `Modified Company details for: ${data.name}`);
      } else {
        // Create — DIRECT MySQL via addCompany (2026-09-08-13): explicit awaited
        // v2_upsert_company POST + GLOBAL v2_list_companies re-fetch so the new
        // row is visible to ALL users and survives reload. Falls back to old
        // saveAllData path if addCompany prop is not provided.
        if (addCompany) {
          try {
            const newId = await addCompany(cleanCompany);
            const nextSettings = {
              ...settings,
              companyLanguages: { ...(settings?.companyLanguages || {}), [newId]: coLang },
              companyCurrencies: { ...(settings?.companyCurrencies || {}), [newId]: coCurr },
              companyExchangeRates: { ...(settings?.companyExchangeRates || {}), [newId]: coRate }
            };
            saveAllData({ settings: nextSettings });
            logAction('Create Company', `Registered new Company: ${data.name} (id=${newId})`);
          } catch (e) {
            console.error('[MasterData] addCompany failed', e);
          }
        } else {
          const nextId = Math.max(0, ...companies.map(c => c.id)) + 1;
          const newCo: any = {
            ...cleanCompany,
            id: nextId,
            company_id: nextId,
            is_default: false,
            created_by: 'root_mandate'
          };
          const nextSettings = {
            ...settings,
            companyLanguages: { ...(settings?.companyLanguages || {}), [nextId]: coLang },
            companyCurrencies: { ...(settings?.companyCurrencies || {}), [nextId]: coCurr },
            companyExchangeRates: { ...(settings?.companyExchangeRates || {}), [nextId]: coRate }
          };
          saveAllData({ companies: [...companies, newCo], settings: nextSettings });
          logAction('Create Company', `Registered new Company: ${data.name}`);
        }
      }
    } else if (type === 'branch') {
      // BUILD 2026-09-08-18/19: ids are STRINGS — never parseInt a company id (NaNs the
      // scope). Keep the raw string from the form or fall back to the active scope at
      // submission time (getActiveCompanyScope prefers the live currentCompanyId, then
      // localStorage active_company_id, then the acting user's company).
      const parsedCoId = (data.companyId !== undefined && data.companyId !== null && data.companyId !== '' && String(data.companyId) !== 'NaN' && String(data.companyId) !== '0')
        ? String(data.companyId)
        : (currentCompanyId != null ? String(currentCompanyId) : getActiveCompanyScope(currentCompanyId, currentUser));
      const cleanData = { ...data, companyId: parsedCoId, company_id: parsedCoId };
      if (data.id) {
        const updated = branches.map(b => sameId(b.id, data.id) ? cleanData : b);
        saveAllData({ branches: updated });
        logAction('Edit Branch', `Modified Branch details for: ${data.name}`);
      } else {
        const nextId = Math.max(0, ...branches.map(b => b.id)) + 1;
        const newBranch = { ...cleanData, id: nextId };
        saveAllData({ branches: [...branches, newBranch] });
        logAction('Create Branch', `Registered new Branch: ${data.name}`);
      }
    } else if (type === 'store') {
      // BUILD 2026-09-08-18: branch ids are strings too — parse as string, never NaN.
      const parsedBranchId = sv(data.branchId) || sv(currentBranchId) || '1';
      // Normalize Multi-Store Location Mapping fields before persisting (saved via the JSON blob).
      const lat = parseFloat(data.latitude);
      const lng = parseFloat(data.longitude);
      const isMarketplaceVisible = data.isMarketplaceVisible === true || data.isMarketplaceVisible === 'true';
      const cleanData = {
        ...data,
        branchId: parsedBranchId,
        // BUILD 2026-09-08-19 (Fix 1): carry the owning company on the record itself so
        // a later edit (even from global view) never re-homes the store to another scope.
        company_id: sv(data.company_id ?? data.companyId) || (() => {
          const ownerBranch = branches.find(b => sameId(b.id, parsedBranchId));
          return sv(ownerBranch?.companyId) || getActiveCompanyScope(currentCompanyId, currentUser);
        })(),
        latitude: Number.isFinite(lat) ? lat : undefined,
        longitude: Number.isFinite(lng) ? lng : undefined,
        googleMapsUrl: typeof data.googleMapsUrl === 'string' && data.googleMapsUrl.trim() ? data.googleMapsUrl.trim() : undefined,
        operatingHours: typeof data.operatingHours === 'string' && data.operatingHours.trim() ? data.operatingHours.trim() : undefined,
        isMarketplaceVisible
      };
      if (data.id) {
        const updated = stores.map(s => sameId(s.id, data.id) ? cleanData : s);
        saveAllData({ stores: updated });
        logAction('Edit Store', `Modified Store details for: ${data.name}`);
      } else {
        const nextId = Math.max(0, ...stores.map(s => Number(s.id) || 0)) + 1;
        const newStore = { ...cleanData, id: nextId };
        // Seed store stock value 0 for all items
        const updatedStock = stockItems.map(p => ({
          ...p,
          stock: { ...p.stock, [nextId]: 0 }
        }));
        saveAllData({
          stores: [...stores, newStore],
          stockItems: updatedStock
        });
        logAction('Create Store', `Registered new Store: ${data.name}`);
      }
    } else if (type === 'customer') {
      const limit = parseFloat(data.creditLimitDisplay) || 0;
      const bal = parseFloat(data.balanceDisplay) || 0;
      // Convert to local system units (USD)
      const creditLimit = currency === 'TZS' ? limit / exchangeRate : limit;
      const balance = currency === 'TZS' ? bal / exchangeRate : bal;

      const cleanData = { ...data, creditLimit, balance };
      delete cleanData.creditLimitDisplay;
      delete cleanData.balanceDisplay;

      if (data.id) {
        // BUILD 2026-09-08-19 (Fix 1): ensure the OWNING company scope survives edits —
        // a record loaded without company_id (legacy/global rows) must not lose its
        // scope when written back through the DIRECT delta; tag the active scope.
        const editData = { ...cleanData, company_id: sv(cleanData.company_id ?? cleanData.companyId) || getActiveCompanyScope(currentCompanyId, currentUser) };
        const updated = customers.map(c => sameId(c.id, data.id) ? editData : c);
        saveAllData({ customers: updated });
        logAction('Edit Customer', `Modified Customer parameters for: ${data.name}`);
      } else {
        const nextId = Math.max(0, ...customers.map(c => Number(c.id) || 0)) + 1;
        // BUILD 2026-09-08-18/19: tag the record with its owning company id as a string
        // (resolved at submission time — never hardcode '1'). Cross-company globals then
        // never host orphaned customer rows reachable by no scope.
        const newCust = { ...cleanData, id: nextId, company_id: sv(currentCompanyId) || getActiveCompanyScope(currentCompanyId, currentUser) };
        saveAllData({ customers: [...customers, newCust] });
        logAction('Create Customer', `Registered new Customer: ${data.name}`);
      }
    } else if (type === 'supplier') {
      if (data.id) {
        const editData = { ...data, company_id: sv(data.company_id ?? data.companyId) || getActiveCompanyScope(currentCompanyId, currentUser) };
        const updated = suppliers.map(s => sameId(s.id, data.id) ? editData : s);
        saveAllData({ suppliers: updated });
        logAction('Edit Supplier', `Modified Supplier parameters for: ${data.name}`);
      } else {
        const nextId = Math.max(0, ...suppliers.map(s => Number(s.id) || 0)) + 1;
        const newSupplier = { ...data, id: nextId, company_id: sv(data.company_id ?? data.companyId) || sv(currentCompanyId) || getActiveCompanyScope(currentCompanyId, currentUser) };
        saveAllData({ suppliers: [...suppliers, newSupplier] });
        logAction('Create Supplier', `Registered new Supplier: ${data.name}`);
      }
    } else if (type === 'category') {
      if (!data.name?.trim()) return;
      const cleanName = data.name.trim();
      // Drop any null/empty/legacy entries so a malformed categories array can never
      // crash the filter or leak `null` into the persisted blob.
      const safeCats = (categories || []).filter(c => c && typeof c === 'string' && c.trim());
      const newCatName = currentCompanyId ? formatCompanyCategory(cleanName, currentCompanyId) : cleanName;
      if (safeCats.some(c => c === newCatName)) {
        toast.warning(t('Category already exists!'));
        return;
      }
      // Persist immediately + synchronize with the backend blob (categories are stored
      // company-scoped as "co_<companyId>:<name>" so they survive reloads, company
      // switches and re-fetches without being wiped).
      // CATEGORY CRUD DIRTY-MARKING (2026-09-07-02): BOTH the categories collection AND
      // the owning companies collection are explicitly dirty-marked + force-flushed so
      // the sync engine transmits the new record immediately (the key-based shouldFlush
      // releases this delta regardless of its byte size). The modal stays mounted until
      // the optimistic mutation promise settles — no detached-form submission can cancel.
      await saveAllData({
        categories: [...safeCats, newCatName],
        companies
      });
      logAction('Create Category', `Created Category: ${cleanName}`);
    } else if (type === 'tax') {
      const rate = parseFloat(data.rate) || 0;
      const compId = currentCompanyId ?? currentUser?.companyId ?? null;
      const cleanData = { 
        ...data, 
        rate, 
        type: 'Percentage',
        storeId: data.storeId !== undefined ? data.storeId : currentStoreId,
        companyId: compId != null ? compId : (data.companyId ?? null)
      };
      if (data.id) {
        const updated = taxes.map(t => t.id === data.id ? cleanData : t);
        saveCompanyTaxes(updated);
        logAction('Edit Tax', `Modified Tax: ${data.name}`);
      } else {
        const nextId = Math.max(0, ...taxes.map(t => t.id)) + 1;
        const newTax = { ...cleanData, id: nextId };
        saveCompanyTaxes([...taxes, newTax]);
        logAction('Create Tax', `Registered new Tax: ${data.name}`);
      }
    }

    setEditingItem(null);
  };

  // --- RENDER CONTENT BY currentPage ---
  const content = (() => {
    switch (currentPage) {
    case 'companies':
      if (!isSuperAdmin) {
        return <div className="p-4 bg-red-100 text-red-800 rounded-lg">{t('Access Denied')}</div>;
      }
      return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm max-w-4xl mx-auto">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <Database className="w-4 h-4 text-brand" />
              {t('System Companies')}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowOnlyNoTin(!showOnlyNoTin)}
                className={`px-3 py-2 rounded-lg text-xs font-bold border transition inline-flex items-center gap-1.5 ${
                  showOnlyNoTin ? 'bg-red-500 text-white border-red-500' : 'bg-white text-red-600 border-red-200 hover:bg-red-50'
                }`}
                title={t('Companies without a TIN')}
              >
                {t('No TIN')} ({companies.filter(c => !c.isDeleted && !c.tinNumber).length})
              </button>
              <button
                onClick={() => setEditingItem({ type: 'company', data: { name: '' } })}
                className="bg-brand text-white px-3.5 py-2 rounded-lg text-xs font-bold hover:bg-brand-hover flex items-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" /> {t('Add Company')}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] text-left">
              <thead className="bg-gray-50 border-b text-gray-500 text-[10px] uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-3">{t('Company Name')}</th>
                  <th className="px-6 py-3">{t('TIN')}</th>
                  <th className="px-6 py-3">{t('Allocated Admins')}</th>
                  <th className="px-6 py-3">{t('Subscription End')}</th>
                  <th className="px-6 py-3">{t('Status')}</th>
                  <th className="px-6 py-3 w-32 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {companies.filter(c => !c.isDeleted && (!showOnlyNoTin || !c.tinNumber)).map(c => {
                  const admins = users
                    .filter(u => u.role === 'Admin' && sameId(u.companyId, c.id))
                    .map(u => u.name)
                    .join(', ') || t('No admins assigned');
                  
                  const isApproved = c.subscriptionApproved !== false;
                  const todayStr = new Date().toISOString().split('T')[0];
                  const isExpired = c.subscriptionEnd ? todayStr > c.subscriptionEnd : false;
                  
                  return (
                    <tr key={c.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4 font-bold text-gray-900 flex items-center gap-3">
                        {c.logoUrl ? (
                          <img src={c.logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-contain bg-gray-50 border border-gray-200" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center font-bold text-xs">
                            {(c.name || '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span>{c.name}</span>
                      </td>
                      <td className="px-6 py-4">
                        {c.tinNumber ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-bold text-gray-700">{c.tinNumber}</span>
                            {c.tinVerified && (
                              <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[9px] font-black uppercase">✓</span>
                            )}
                          </div>
                        ) : (
                          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">{t('No TIN')}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-500 font-semibold">{admins}</td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-600">
                        {c.subscriptionEnd ? c.subscriptionEnd : t('Unlimited')}
                      </td>
                      <td className="px-6 py-4">
                        {!isApproved ? (
                          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                            {t('Payment Pending')}
                          </span>
                        ) : isExpired ? (
                          <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                            {t('Expired')}
                          </span>
                        ) : (
                          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                            {t('Active')}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => setEditingItem({ type: 'company', data: c })}
                            className="p-1 px-2 text-[10px] font-bold rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition inline-flex items-center gap-1"
                            title={t('Edit')}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            {t('Edit')}
                          </button>
                          <button
                            onClick={() => handleDeleteCompany(c.id)}
                            className="p-1 px-2 text-[10px] font-bold rounded border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition inline-flex items-center gap-1"
                            title={t('Delete')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {t('Delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {renderEditModal()}
        </div>
      );

    case 'branches':
      const branchData = (isSuperAdmin
        ? branches
        : branches.filter(b => sameId(b.companyId, currentCompanyId))
      ).filter(b => !b.isDeleted);

      return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm max-w-4xl mx-auto">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <Database className="w-4 h-4 text-brand" />
              {t('Branches')}
            </h3>
            <button
              onClick={() => setEditingItem({ type: 'branch', data: { name: '', companyId: currentCompanyId || 1 } })}
              className="bg-brand text-white px-3.5 py-2 rounded-lg text-xs font-bold hover:bg-brand-hover flex items-center gap-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5" /> {t('Add Branch')}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] text-left">
              <thead className="bg-gray-50 border-b text-gray-500 text-[10px] uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-3">{t('Branch Name')}</th>
                  <th className="px-6 py-3">{t('Company Parent')}</th>
                  <th className="px-6 py-3 text-center">{t('Total Stores')}</th>
                  <th className="px-6 py-3 w-32 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {branchData.map(b => {
                  const compName = companies.find(c => sameId(c.id, b.companyId))?.name || 'N/A';
                  const storeCount = stores.filter(s => sameId(s.branchId, b.id)).length;
                  return (
                    <tr key={b.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4 font-bold text-gray-900">{b.name}</td>
                      <td className="px-6 py-4 text-gray-500 font-semibold">{compName}</td>
                      <td className="px-6 py-4 text-center font-bold text-gray-700">{storeCount}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => setEditingItem({ type: 'branch', data: b })}
                            className="p-1 px-2 text-[10px] font-bold rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition inline-flex items-center gap-1"
                            title={t('Edit')}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            {t('Edit')}
                          </button>
                          <button
                            onClick={() => handleDeleteBranch(b.id)}
                            className="p-1 px-2 text-[10px] font-bold rounded border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition inline-flex items-center gap-1"
                            title={t('Delete')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {t('Delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {renderEditModal()}
        </div>
      );

    case 'stores':
      const allowedBranches = branches
        .filter(b => !b.isDeleted && (isSuperAdmin || sameId(b.companyId, currentCompanyId)))
        .map(b => b.id);
      const storeData = stores.filter(s => !s.isDeleted && allowedBranches.includes(s.branchId));

      return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <StoreIcon className="w-4 h-4 text-brand" />
              {t('Store Management')}
            </h3>
            {isAdmin && (
              <button
                onClick={() => setEditingItem({ type: 'store', data: { name: '', branchId: currentBranchId || (allowedBranches[0] || 1), location: '', phone: '', latitude: '' as any, longitude: '' as any, googleMapsUrl: '', isMarketplaceVisible: true, operatingHours: '' } })}
                className="bg-brand text-white px-3.5 py-2 rounded-lg text-xs font-bold hover:bg-brand-hover flex items-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" /> {t('Add Store')}
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] text-left">
              <thead className="bg-gray-50 border-b text-gray-500 text-[10px] uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-4 py-3">{t('Store Name')}</th>
                  <th className="px-4 py-3">{t('Branch Location')}</th>
                  <th className="px-4 py-3 text-center">{t('Total Items')}</th>
                  <th className="px-4 py-3 text-right">{t('Stock Value')}</th>
                  <th className="px-4 py-3 w-32 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {storeData.map(s => {
                  const branchName = branches.find(b => sameId(b.id, s.branchId))?.name || 'N/A';
                  const totalItems = stockItems.reduce((acc, p) => acc + (p.stock?.[s.id] || 0), 0);
                  const stockValue = stockItems.reduce((acc, p) => {
                    const rawQty = p.stock?.[s.id] || 0;
                    const mainQty = p.useSubUnitPricing ? rawQty / (p.subUnitConversion || 1) : rawQty;
                    return acc + (mainQty * p.purchasePrice);
                  }, 0);
                  return (
                    <React.Fragment key={s.id}>
                      <tr className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-bold text-gray-900 flex items-center gap-2">
                          <StoreIcon className="w-4 h-4 text-gray-400" />
                          {s.name}
                        </td>
                        <td className="px-4 py-3 text-gray-500 font-semibold">{branchName}</td>
                        <td className="px-4 py-3 text-center font-semibold text-gray-700">{totalItems}</td>
                        <td className="px-4 py-3 text-right font-bold text-indigo-700">{fmt(stockValue)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => setActiveStoreDetailsId(activeStoreDetailsId === s.id ? null : s.id)}
                              className="p-1 px-2 text-[10px] font-bold rounded border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition inline-flex items-center gap-1"
                              title={t('Show/Hide Stock Inventory Breakdown')}
                            >
                              {activeStoreDetailsId === s.id ? t('Hide') : t('Details')}
                            </button>
                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => setEditingItem({ type: 'store', data: s })}
                                  className="p-1 px-2 text-[10px] font-bold rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition inline-flex items-center gap-1"
                                  title={t('Edit')}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  {t('Edit')}
                                </button>
                                <button
                                  onClick={() => handleDeleteStore(s.id)}
                                  className="p-1 px-2 text-[10px] font-bold rounded border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition inline-flex items-center gap-1"
                                  title={t('Delete')}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  {t('Delete')}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {activeStoreDetailsId === s.id && (
                        <tr className="bg-gray-50/70">
                          <td colSpan={5} className="p-4 border-t border-b text-xs">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                              <div>
                                <span className="font-bold text-gray-700 uppercase tracking-wider text-[10px] block mb-1">{t('Physical Location')}</span>
                                <span className="text-gray-900 font-semibold">{s.location || t('No specific location configured')}</span>
                              </div>
                              <div>
                                <span className="font-bold text-gray-700 uppercase tracking-wider text-[10px] block mb-1">{t('Store Contact Phone')}</span>
                                <span className="text-gray-900 font-semibold">{s.phone || t('No specific phone configured')}</span>
                              </div>
                            </div>

                            <div className="border rounded-lg bg-white overflow-hidden shadow-xs">
                              <div className="bg-gray-100/50 p-2.5 border-b font-bold text-gray-700 text-[11px] uppercase tracking-wider">
                                {t('Active Stock Inventory weight inside')} {s.name}
                              </div>
                              <table className="w-full text-left text-[11px]">
                                <thead className="bg-gray-50 text-gray-500 font-bold border-b text-[9px] uppercase">
                                  <tr>
                                    <th className="p-2">{t('Item Name')}</th>
                                    <th className="p-2">{t('Category')}</th>
                                    <th className="p-2 text-center">{t('Current In Stock')}</th>
                                    <th className="p-2 text-right">{t('Unit Purchase Price')}</th>
                                    <th className="p-2 text-right">{t('Total Asset Value')}</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                                  {stockItems
                                    .filter(p => (p.stock?.[s.id] || 0) > 0)
                                    .map(p => {
                                      const qty = p.stock?.[s.id] || 0;
                                      const mainQty = p.useSubUnitPricing ? qty / (p.subUnitConversion || 1) : qty;
                                      const totalValue = mainQty * p.purchasePrice;
                                      return (
                                        <tr key={p.id} className="hover:bg-gray-50/50">
                                          <td className="p-2 font-bold text-gray-900">{p.name} <span className="text-[10px] font-mono text-gray-400">({p.code})</span></td>
                                          <td className="p-2">{t(p.category)}</td>
                                          <td className="p-2 text-center font-bold text-emerald-700">{qty} {p.unit ? t(p.unit) : ''}</td>
                                          <td className="p-2 text-right font-semibold text-gray-600">{fmt(p.purchasePrice)}</td>
                                          <td className="p-2 text-right font-bold text-indigo-700">{fmt(totalValue)}</td>
                                        </tr>
                                      );
                                    })}
                                  {stockItems.filter(p => (p.stock?.[s.id] || 0) > 0).length === 0 && (
                                    <tr>
                                      <td colSpan={5} className="p-3 text-center text-gray-400 font-semibold">
                                        {t('This store currently holds empty inventory weights.')}
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {renderEditModal()}
        </div>
      );

    case 'customers':
      return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-sm">{t('Customers')}</h3>
            {isAdmin && (
              <button
                onClick={() => setEditingItem({
                  type: 'customer',
                  data: { name: '', type: 'Retail', phone: '', email: '', creditLimitDisplay: '0', balanceDisplay: '0' }
                })}
                className="bg-brand text-white px-3.5 py-2 rounded-lg text-xs font-bold hover:bg-brand-hover flex items-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" /> {t('Add Customer')}
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] text-left">
              <thead className="bg-gray-50 border-b text-gray-500 text-[10px] uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-3">{t('Name')}</th>
                  <th className="px-6 py-3">{t('Type')}</th>
                  <th className="px-6 py-3">{t('Contact')}</th>
                  <th className="px-6 py-3">{t('Assigned Store')}</th>
                  <th className="px-6 py-3 text-right">{t('Credit Limit')}</th>
                  <th className="px-6 py-3 text-right">{t('Balance')}</th>
                  <th className="px-6 py-3 w-32 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customers.filter(c => !c.storeId || c.storeId === currentStoreId).map(c => (
                  <tr key={c.id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-4 font-bold text-gray-900">{c.name}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        c.type === 'Wholesale' ? 'bg-amber-100 text-amber-800' :
                        c.type === 'Preferred' ? 'bg-indigo-100 text-indigo-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {t(c.type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 font-semibold">
                      <div>{c.phone}</div>
                      <div className="text-[10px] font-mono">{c.email}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-semibold whitespace-nowrap">
                      {c.storeId ? stores.find(st => st.id === c.storeId)?.name || t('Unknown Store') : t('All Stores')}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold">{fmt(c.creditLimit)}</td>
                    <td className={`px-6 py-4 text-right font-bold ${c.balance > 0 ? 'text-red-600' : 'text-gray-700'}`}>
                      {fmt(c.balance || 0)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1.5 flex-wrap">
                        <button
                          onClick={() => setStatementModal({
                            isOpen: true,
                            entityType: 'customer',
                            entityId: c.id,
                            name: c.name
                          })}
                          className="p-1 px-2 text-[10px] font-bold rounded border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition inline-flex items-center gap-1"
                          title="Account Ledger Statement"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Ledger
                        </button>
                        {c.balance > 0 && (
                          <button
                            onClick={() => setMessagingModal({
                              isOpen: true,
                              recipientName: c.name,
                              recipientPhone: c.phone || '',
                              outstandingBalance: c.balance
                            })}
                            className="p-1 px-2 text-[10px] font-bold rounded border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition inline-flex items-center gap-1"
                            title="Send WhatsApp Payment Reminder"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                            Reminder
                          </button>
                        )}
                        {(isAdmin || isSuperAdmin) && (
                          <>
                            <button
                              onClick={() => setEditingItem({
                                type: 'customer',
                                data: {
                                  ...c,
                                  creditLimitDisplay: (currency === 'TZS' ? c.creditLimit * exchangeRate : c.creditLimit).toString(),
                                  balanceDisplay: (currency === 'TZS' ? c.balance * exchangeRate : c.balance).toString()
                                }
                              })}
                              className="p-1 px-2 text-[10px] font-bold rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition inline-flex items-center gap-1"
                              title={t('Edit')}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              {t('Edit')}
                            </button>
                            <button
                              onClick={() => handleDeleteCustomer(c.id)}
                              className="p-1 px-2 text-[10px] font-bold rounded border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition inline-flex items-center gap-1"
                              title={t('Delete')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              {t('Delete')}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {renderEditModal()}
        </div>
      );

    case 'suppliers':
      return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-sm">{t('Suppliers')}</h3>
            {isAdmin && (
              <button
                onClick={() => setEditingItem({ type: 'supplier', data: { name: '', contact: '', phone: '', email: '' } })}
                className="bg-brand text-white px-3.5 py-2 rounded-lg text-xs font-bold hover:bg-brand-hover flex items-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" /> {t('Add Supplier')}
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] text-left">
              <thead className="bg-gray-50 border-b text-gray-500 text-[10px] uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-3">{t('Name')}</th>
                  <th className="px-6 py-3">{t('Contact Person')}</th>
                  <th className="px-6 py-3">{t('Phone / Email')}</th>
                  <th className="px-6 py-3">{t('Assigned Store')}</th>
                  <th className="px-6 py-3 w-32 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {suppliers.filter(s => !s.storeId || s.storeId === currentStoreId).map(s => (
                  <tr key={s.id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-4 font-bold text-gray-900">{s.name}</td>
                    <td className="px-6 py-4 text-gray-600 font-bold">{s.contact}</td>
                    <td className="px-6 py-4 text-gray-500 font-semibold">
                      <div>{s.phone}</div>
                      <div className="text-[10px] font-mono">{s.email}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-semibold whitespace-nowrap">
                      {s.storeId ? stores.find(st => st.id === s.storeId)?.name || t('Unknown Store') : t('All Stores')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1.5 flex-wrap">
                        <button
                          onClick={() => setStatementModal({
                            isOpen: true,
                            entityType: 'supplier',
                            entityId: s.id,
                            name: s.name
                          })}
                          className="p-1 px-2 text-[10px] font-bold rounded border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition inline-flex items-center gap-1"
                          title="Account Ledger Statement"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Ledger
                        </button>
                        {(isAdmin || isSuperAdmin) && (
                          <>
                            <button
                              onClick={() => setEditingItem({ type: 'supplier', data: s })}
                              className="p-1 px-2 text-[10px] font-bold rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition inline-flex items-center gap-1"
                              title={t('Edit')}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              {t('Edit')}
                            </button>
                            <button
                              onClick={() => handleDeleteSupplier(s.id)}
                              className="p-1 px-2 text-[10px] font-bold rounded border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition inline-flex items-center gap-1"
                              title={t('Delete')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              {t('Delete')}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {renderEditModal()}
        </div>
      );

    case 'categories':
      return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm max-w-2xl mx-auto mt-6">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-sm">{t('Product Categories')}</h3>
            {isAdmin && (
              <button
                onClick={() => setEditingItem({ type: 'category', data: { name: '' } })}
                className="bg-brand text-white px-3.5 py-2 rounded-lg text-xs font-bold hover:bg-brand-hover flex items-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" /> {t('Add Category')}
              </button>
            )}
          </div>
          <ul className="divide-y divide-gray-100">
            {getCompanyCategories(categories, currentCompanyId).map((c, i) => (
              <li key={i} className="px-6 py-4 flex justify-between items-center hover:bg-gray-50/50">
                <span className="font-bold text-gray-800">{cleanCategoryName(c)}</span>
                {isAdmin && (
                  <button
                    onClick={() => handleDeleteCategory(c)}
                    className="p-1 px-2 text-[10px] font-bold rounded border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition inline-flex items-center gap-1"
                    title={t('Delete')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {t('Delete')}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {renderEditModal()}
        </div>
      );

    case 'taxes':
      return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mx-auto mt-6">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-sm">{t('Tax Rates')}</h3>
            {isAdmin && (
              <button
                onClick={() => setEditingItem({ type: 'tax', data: { name: '', rate: 0 } })}
                className="bg-brand text-white px-3.5 py-2 rounded-lg text-xs font-bold hover:bg-brand-hover flex items-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" /> {t('Add Tax')}
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] text-left">
              <thead className="bg-gray-50 border-b text-gray-500 text-[10px] uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-3">{t('Product Scope')}</th>
                  <th className="px-6 py-3">{t('Tax Name')}</th>
                  <th className="px-6 py-3">{t('Assigned Store')}</th>
                  <th className="px-6 py-3 text-center">{t('Active Items')}</th>
                  <th className="px-6 py-3 text-center">{t('Rate (%)')}</th>
                  <th className="px-6 py-3 w-32 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {taxes.filter(t => !t.storeId || t.storeId === currentStoreId).map(tData => (
                  <tr key={tData.id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-4 font-bold text-brand">{t('Various Products')}</td>
                    <td className="px-6 py-4 font-bold text-gray-900">{tData.name}</td>
                    <td className="px-6 py-4 text-gray-600 font-semibold whitespace-nowrap">
                      {tData.storeId ? stores.find(st => st.id === tData.storeId)?.name || t('Unknown Store') : t('All Stores')}
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-gray-500">{stockItems.length}</td>
                    <td className="px-6 py-4 text-center font-bold text-gray-700">{tData.rate}%</td>
                    <td className="px-6 py-4 text-right">
                      {isAdmin && (
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => setEditingItem({ type: 'tax', data: tData })}
                            className="p-1 px-2 text-[10px] font-bold rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition inline-flex items-center gap-1"
                            title={t('Edit')}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            {t('Edit')}
                          </button>
                          <button
                            onClick={() => handleDeleteTax(tData.id)}
                            className="p-1 px-2 text-[10px] font-bold rounded border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition inline-flex items-center gap-1"
                            title={t('Delete')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {t('Delete')}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {renderEditModal()}
        </div>
      );

    case 'data-recovery': {
      const allowAdminAccess = settings?.allowAdminDataRecovery || false;
      const isAdminUser = currentUser?.role === 'Admin';

      if (!isSuperAdmin && (!isAdminUser || !allowAdminAccess)) {
        return (
          <div className="bg-red-50 border border-red-200 text-red-800 p-6 rounded-xl max-w-xl mx-auto text-center space-y-2 mt-8 shadow-sm">
            <div className="text-3xl">🔒</div>
            <h3 className="font-extrabold text-base">{t('Access Denied')}</h3>
            <p className="text-xs font-medium text-red-700">
              {t('The Data Recovery Hub is restricted. Super Admin has not granted Admin permission for deleted Purchase Orders and Sales Invoices.')}
            </p>
          </div>
        );
      }

      const deletedCompanies = companies.filter(c => c.isDeleted);
      const deletedBranches = branches.filter(b => b.isDeleted);
      const deletedStores = stores.filter(s => s.isDeleted);
      const deletedPurchases = purchaseOrders.filter(po => po.isDeleted);
      const voidedSales = salesOrders.filter(so => so.status === 'Voided' || so.isDeleted);

      return (
        <div className="space-y-6 max-w-4xl mx-auto">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                <RefreshCw className="w-5 h-5" />
                {t('Data Recovery Hub')}
              </h3>
              <p className="text-xs text-emerald-100 mt-1 max-w-xl">
                {t('Restore soft-deleted records or voided transactions. All historical audit details remain preserved.')}
              </p>
            </div>

            {/* Super Admin Toggle for Admin Access */}
            {isSuperAdmin && (
              <div className="bg-white/10 backdrop-blur-xs p-3 rounded-lg border border-white/20 shrink-0">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-white">
                  <input
                    type="checkbox"
                    checked={allowAdminAccess}
                    onChange={(e) => {
                      const updatedSettings = {
                        ...settings,
                        allowAdminDataRecovery: e.target.checked
                      };
                      saveAllData({ settings: updatedSettings });
                      toast.success(e.target.checked
                        ? t('Data Recovery Hub access granted to Admins for POs and Sales Invoices!')
                        : t('Data Recovery Hub access restricted to Super Admin only.')
                      );
                    }}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-white/20 border-white/30 cursor-pointer"
                  />
                  <span>{t('Grant Data Recovery Access to Admins')}</span>
                </label>
                <span className="block text-[10px] text-emerald-100 mt-0.5">
                  {t('Admins can view and restore deleted POs and voided Sales Invoices when enabled.')}
                </span>
              </div>
            )}
          </div>

          {/* Companies Section */}
          {isSuperAdmin && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  📁 {t('Deleted Companies')}
                </h4>
                <span className="text-xs font-bold text-gray-400">
                  {deletedCompanies.length} {t('records')}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] text-left">
                  <thead className="bg-gray-50 border-b text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                    <tr>
                      <th className="px-6 py-3">{t('Company Name')}</th>
                      <th className="px-6 py-3 w-40 text-center">{t('Restore')}</th>
                      <th className="px-6 py-3 w-40 text-center">{t('Permanent Delete')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {deletedCompanies.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-8 text-center text-gray-400 italic">
                          {t('No deleted companies found.')}
                        </td>
                      </tr>
                    ) : (
                      deletedCompanies.map(c => (
                        <tr key={c.id} className="hover:bg-gray-50/50">
                          <td className="px-6 py-4 font-bold text-gray-900">{c.name}</td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => handleRestoreCompany(c.id)}
                              className="text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition mx-auto"
                            >
                              <RefreshCw className="w-3 h-3" /> {t('Restore')}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => handlePermanentDeleteCompany(c.id)}
                              className="text-xs font-bold bg-red-50 text-red-700 hover:bg-red-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition mx-auto animate-pulse hover:animate-none"
                            >
                              <Trash2 className="w-3 h-3" /> {t('Permanent')}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Branches Section */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
              <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                🌿 {t('Deleted Branches')}
              </h4>
              <span className="text-xs font-bold text-gray-400">
                {deletedBranches.length} {t('records')}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] text-left">
                <thead className="bg-gray-50 border-b text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                  <tr>
                    <th className="px-6 py-3">{t('Branch Name')}</th>
                    <th className="px-6 py-3">{t('Company Parent')}</th>
                    <th className="px-6 py-3 w-40 text-center">{t('Restore')}</th>
                    <th className="px-6 py-3 w-40 text-center">{t('Permanent Delete')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {deletedBranches.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-400 italic">
                        {t('No deleted branches found.')}
                      </td>
                    </tr>
                  ) : (
                    deletedBranches.map(b => (
                      <tr key={b.id} className="hover:bg-gray-50/50">
                        <td className="px-6 py-4 font-bold text-gray-900">{b.name}</td>
                        <td className="px-6 py-4 text-gray-500 font-semibold">
                          {companies.find(c => sameId(c.id, b.companyId))?.name || 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleRestoreBranch(b.id)}
                            className="text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition mx-auto"
                          >
                            <RefreshCw className="w-3 h-3" /> {t('Restore')}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handlePermanentDeleteBranch(b.id)}
                            className="text-xs font-bold bg-red-50 text-red-700 hover:bg-red-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition mx-auto animate-pulse hover:animate-none"
                          >
                            <Trash2 className="w-3 h-3" /> {t('Permanent')}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Stores Section */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
              <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                🏪 {t('Deleted Stores')}
              </h4>
              <span className="text-xs font-bold text-gray-400">
                {deletedStores.length} {t('records')}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] text-left">
                <thead className="bg-gray-50 border-b text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                  <tr>
                    <th className="px-6 py-3">{t('Store Name')}</th>
                    <th className="px-6 py-3">{t('Location / Contact')}</th>
                    <th className="px-6 py-3 w-40 text-center">{t('Restore')}</th>
                    <th className="px-6 py-3 w-40 text-center">{t('Permanent Delete')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {deletedStores.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-400 italic">
                        {t('No deleted stores found.')}
                      </td>
                    </tr>
                  ) : (
                    deletedStores.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50/50">
                        <td className="px-6 py-4 font-bold text-gray-900">{s.name}</td>
                        <td className="px-6 py-4 text-gray-500 text-xs">
                          {s.location} ({s.phone})
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleRestoreStore(s.id)}
                            className="text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition mx-auto"
                          >
                            <RefreshCw className="w-3 h-3" /> {t('Restore')}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handlePermanentDeleteStore(s.id)}
                            className="text-xs font-bold bg-red-50 text-red-700 hover:bg-red-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition mx-auto animate-pulse hover:animate-none"
                          >
                            <Trash2 className="w-3 h-3" /> {t('Permanent')}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Voided Sales Orders Section */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-none">
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
              <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                🛑 {t('Voided Sales Invoices (Audit Trail)')}
              </h4>
              <span className="text-xs font-bold text-gray-400">
                {voidedSales.length} {t('records')}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] text-left">
                <thead className="bg-gray-50 border-b text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                  <tr>
                    <th className="px-6 py-3">{t('Invoice / SO Number')}</th>
                    <th className="px-6 py-3">{t('Store / Customer')}</th>
                    <th className="px-6 py-3">{t('Total Amount')}</th>
                    <th className="px-6 py-3 w-40 text-center">{t('Restore / Unvoid')}</th>
                    <th className="px-6 py-3 w-40 text-center">{t('Permanent Delete')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {voidedSales.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-400 italic">
                        {t('No voided sales invoices found.')}
                      </td>
                    </tr>
                  ) : (
                    voidedSales.map(so => (
                      <tr key={so.id} className="hover:bg-gray-50/50">
                        <td className="px-6 py-4">
                          <span className="font-mono font-bold text-brand">{so.soNumber}</span>
                          <span className="block text-[10px] text-gray-400">{so.date}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-gray-900 block">🏪 {stores.find(s => s.id === so.storeId)?.name || `Store #${so.storeId}`}</span>
                          <span className="text-xs text-gray-500">👤 {customers.find(c => c.id === so.customerId)?.name || `Customer #${so.customerId}`}</span>
                        </td>
                        <td className="px-6 py-4 font-bold text-gray-950 font-mono">
                          {formatMoney(so.total, currency, exchangeRate)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => {
                              const updated = salesOrders.map(item => item.id === so.id ? { ...item, status: 'Completed' } : item);
                              saveAllData({ salesOrders: updated });
                              toast.success(t('Sales invoice successfully restored/unvoided!'));
                              logAction?.('Restored Sales Order', `Restored voided sales invoice ${so.soNumber}`);
                            }}
                            className="text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition mx-auto"
                          >
                            <RefreshCw className="w-3 h-3" /> {t('Unvoid')}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => {
                              const updated = salesOrders.filter(item => item.id !== so.id);
                              saveAllData({ salesOrders: updated });
                              toast.success(t('Sales invoice permanently deleted!'));
                              logAction?.('Permanently Deleted Sales Order', `Permanently deleted sales invoice ${so.soNumber}`);
                            }}
                            className="text-xs font-bold bg-red-50 text-red-700 hover:bg-red-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition mx-auto"
                          >
                            <Trash2 className="w-3 h-3" /> {t('Permanent')}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Deleted Purchase Orders Section */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-none">
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
              <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                📦 {t('Deleted Purchase Orders')}
              </h4>
              <span className="text-xs font-bold text-gray-400">
                {deletedPurchases.length} {t('records')}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] text-left">
                <thead className="bg-gray-50 border-b text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                  <tr>
                    <th className="px-6 py-3">{t('PO Number')}</th>
                    <th className="px-6 py-3">{t('Store / Supplier')}</th>
                    <th className="px-6 py-3">{t('Total Amount')}</th>
                    <th className="px-6 py-3 w-40 text-center">{t('Restore')}</th>
                    <th className="px-6 py-3 w-40 text-center">{t('Permanent Delete')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {deletedPurchases.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-400 italic">
                        {t('No deleted purchase orders found.')}
                      </td>
                    </tr>
                  ) : (
                    deletedPurchases.map(po => (
                      <tr key={po.id} className="hover:bg-gray-50/50">
                        <td className="px-6 py-4">
                          <span className="font-mono font-bold text-brand">{po.poNumber}</span>
                          <span className="block text-[10px] text-gray-400">{po.date}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-gray-900 block">🏪 {stores.find(s => s.id === po.storeId)?.name || `Store #${po.storeId}`}</span>
                          <span className="text-xs text-gray-500">👤 {suppliers.find(s => s.id === po.supplierId)?.name || `Supplier #${po.supplierId}`}</span>
                        </td>
                        <td className="px-6 py-4 font-bold text-gray-950 font-mono">
                          {formatMoney(po.total, currency, exchangeRate)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => {
                              const updated = purchaseOrders.map(item => item.id === po.id ? { ...item, isDeleted: false } : item);
                              saveAllData({ purchaseOrders: updated });
                              toast.success(t('Purchase order successfully restored!'));
                              logAction?.('Restored Purchase Order', `Restored deleted purchase order ${po.poNumber}`);
                            }}
                            className="text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition mx-auto"
                          >
                            <RefreshCw className="w-3 h-3" /> {t('Restore')}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => {
                              const updated = purchaseOrders.filter(item => item.id !== po.id);
                              saveAllData({ purchaseOrders: updated });
                              toast.success(t('Purchase order permanently deleted!'));
                              logAction?.('Permanently Deleted Purchase Order', `Permanently deleted purchase order ${po.poNumber}`);
                            }}
                            className="text-xs font-bold bg-red-50 text-red-700 hover:bg-red-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition mx-auto"
                          >
                            <Trash2 className="w-3 h-3" /> {t('Permanent')}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Deleted Products Section */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-none">
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
              <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                📦 {t('Deleted Products')}
              </h4>
              <span className="text-xs font-bold text-gray-400">
                {stockItems.filter(p => p.isDeleted).length} {t('records')}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] text-left">
                <thead className="bg-gray-50 border-b text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                  <tr>
                    <th className="px-6 py-3">{t('Product Name')}</th>
                    <th className="px-6 py-3">{t('Code')}</th>
                    <th className="px-6 py-3">{t('Category')}</th>
                    <th className="px-6 py-3 w-40 text-center">{t('Restore')}</th>
                    <th className="px-6 py-3 w-40 text-center">{t('Permanent Delete')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stockItems.filter(p => p.isDeleted).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-400 italic">
                        {t('No deleted products found.')}
                      </td>
                    </tr>
                  ) : (
                    stockItems.filter(p => p.isDeleted).map(product => (
                      <tr key={product.id} className="hover:bg-gray-50/50">
                        <td className="px-6 py-4">
                          <span className="font-bold text-gray-900">{product.name}</span>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-gray-600">
                          {product.code}
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-500">
                          {product.category}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => {
                              // ISOLATED MICRO-UPDATE: restore this single record only
                              // (atomic + per-record ack), so a stale sync can't wipe it back.
                              const restored: any = { ...product, isDeleted: false, updated_at: Date.now() };
                              if (mutateRecord) void mutateRecord('stockItems', 'upsert', product.id, restored);
                              else {
                                const updated = stockItems.map(item => item.id === product.id ? restored : item);
                                saveAllData({ stockItems: updated });
                              }
                              toast.success(t('Product successfully restored!'));
                              logAction?.('Restored Product', `Restored deleted product ${product.name}`);
                            }}
                            className="text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition mx-auto"
                          >
                            <RefreshCw className="w-3 h-3" /> {t('Restore')}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => {
                              // ISOLATED MICRO-UPDATE: permanently delete ONLY this record
                              // (atomic filter + per-record ack), never the whole array.
                              if (mutateRecord) void mutateRecord('stockItems', 'delete', product.id, null);
                              else {
                                const updated = stockItems.filter(item => item.id !== product.id);
                                saveAllData({ stockItems: updated });
                              }
                              toast.success(t('Product permanently deleted!'));
                              logAction?.('Permanently Deleted Product', `Permanently deleted product ${product.name}`);
                            }}
                            className="text-xs font-bold bg-red-50 text-red-700 hover:bg-red-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition mx-auto"
                          >
                            <Trash2 className="w-3 h-3" /> {t('Permanent')}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    case 'exchange-rate':
      const currentGlobalRate = settings?.exchangeRate || 1;
      const currentGlobalCurrency = settings?.currency || 'USD';
      const activeUserCompId = currentUser?.companyId || currentCompanyId;

      const visibleExchangeCompanies = isSuperAdmin
        ? companies.filter(c => !c.isDeleted)
        : companies.filter(c => !c.isDeleted && sameId(c.id, activeUserCompId));

      const visibleExchangeUsers = isSuperAdmin
        ? users.filter(u => u.status === 'Active')
        : users.filter(u => u.status === 'Active' && sameId(u.companyId, activeUserCompId));

      const handleUpdateGlobalSettings = (newCurrency: string, newRate: number) => {
        const nextSettings = {
          ...settings,
          currency: newCurrency,
          exchangeRate: newRate
        };
        saveAllData({ settings: nextSettings });
        toast.success(t('Global fallback exchange rate settings updated.'));
        logAction('Update Global Exchange Rate', `Set global fallback: 1 USD = ${newRate} ${newCurrency}, currency: ${newCurrency}`);
      };

      const handleUpdateCompanySettings = (compId: number, newCurrency: string, newRate: number) => {
        const nextSettings = {
          ...settings,
          companyCurrencies: {
            ...(settings?.companyCurrencies || {}),
            [compId]: newCurrency
          },
          companyExchangeRates: {
            ...(settings?.companyExchangeRates || {}),
            [compId]: newRate
          }
        };
        saveAllData({ settings: nextSettings });
        toast.success(t('Company isolated currency settings updated successfully.'));
        logAction('Update Company Exchange Rate', `Set company (ID: ${compId}) rate: 1 USD = ${newRate} ${newCurrency}, currency: ${newCurrency}`);
      };

      const handleUpdateUserSettings = (username: string, newCurrency: string, newRate: number | null) => {
        const nextUserCurrencies = { ...(settings?.userCurrencies || {}) };
        const nextUserRates = { ...(settings?.userExchangeRates || {}) };

        if (newCurrency === '') {
          delete nextUserCurrencies[username];
        } else {
          nextUserCurrencies[username] = newCurrency;
        }

        if (newRate === null) {
          delete nextUserRates[username];
        } else {
          nextUserRates[username] = newRate;
        }

        const nextSettings = {
          ...settings,
          userCurrencies: nextUserCurrencies,
          userExchangeRates: nextUserRates
        };
        saveAllData({ settings: nextSettings });
        toast.success(t('User specific override settings updated successfully.'));
        logAction('Update User Exchange Rate Override', `Set user (${username}) rate: ${newRate !== null ? `1 USD = ${newRate} TZS` : 'Reset'}, currency: ${newCurrency || 'Reset'}`);
      };

      return (
        <div className="space-y-6 max-w-4xl mx-auto">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-brand text-white rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-base flex items-center gap-2">
              🌐 {t('System Exchange Rate Controller')}
            </h3>
            <p className="text-xs text-indigo-100 mt-1 max-w-xl">
              {t('Configure independent currency and exchange rate operations per Company and override them per individual User. This ensures independent, localized transaction calculation across different organizations.')}
            </p>
          </div>

          {/* Section 1: Isolated Company Exchange Rates */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
              <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                🏢 {t('Company Isolated Rates & Currencies')}
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] text-left">
                <thead className="bg-gray-50 border-b text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                  <tr>
                    <th className="px-6 py-3">{t('Company')}</th>
                    <th className="px-6 py-3">{t('Active Currency')}</th>
                    <th className="px-6 py-3">{t('Exchange Rate (1 USD = Local)')}</th>
                    <th className="px-6 py-3 text-right">{t('Action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibleExchangeCompanies.map(c => {
                    const companyCurrency = settings?.companyCurrencies?.[c.id] || currentGlobalCurrency;
                    const companyRate = settings?.companyExchangeRates?.[c.id] !== undefined ? settings.companyExchangeRates[c.id] : currentGlobalRate;
                    const rateInputVal = localCompanyRates[c.id] !== undefined ? localCompanyRates[c.id] : String(companyRate);

                    return (
                      <tr key={c.id} className="hover:bg-gray-50/30">
                        <td className="px-6 py-4 font-bold text-gray-900">{c.name}</td>
                        <td className="px-6 py-4">
                          <select
                            value={companyCurrency}
                            onChange={(e) => handleUpdateCompanySettings(c.id, e.target.value, companyRate)}
                            className="bg-white border border-gray-300 rounded-lg text-xs font-semibold px-2 py-1 outline-none focus:border-brand"
                          >
                            <option value="USD">USD ($)</option>
                            <option value="TZS">TZS (TSh)</option>
                            <option value="KES">KES (KSh)</option>
                            <option value="UGD">UGD (USh)</option>
                            <option value="UGX">UGX (USh)</option>
                            <option value="RWF">RWF (RF)</option>
                            <option value="EUR">EUR (€)</option>
                            <option value="GBP">GBP (£)</option>
                          </select>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="any"
                              value={rateInputVal}
                              onChange={(e) => setLocalCompanyRates({ ...localCompanyRates, [c.id]: e.target.value })}
                              className="w-28 px-2 py-1 border border-gray-300 rounded-lg text-xs font-black outline-none focus:border-brand"
                              placeholder="e.g. 2500"
                            />
                            <span className="text-[10px] font-bold text-gray-400">{companyCurrency}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => {
                              const inputFloat = parseFloat(rateInputVal);
                              if (!isNaN(inputFloat) && inputFloat > 0) {
                                handleUpdateCompanySettings(c.id, companyCurrency, inputFloat);
                              } else {
                                toast.error(t('Please enter a valid exchange rate.'));
                              }
                            }}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800 px-3 py-1 text-xs font-bold rounded-lg transition"
                          >
                            {t('Apply')}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Personal / User Override Settings */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
              <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                👤 {t('User Level Specific Overrides')}
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] text-left">
                <thead className="bg-gray-50 border-b text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                  <tr>
                    <th className="px-6 py-3">{t('User')}</th>
                    <th className="px-6 py-3">{t('Company / Role')}</th>
                    <th className="px-6 py-3">{t('Currency Override')}</th>
                    <th className="px-6 py-3">{t('Exchange Override (1 USD = Local)')}</th>
                    <th className="px-6 py-3 text-right">{t('Action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibleExchangeUsers.map(u => {
                    const userCurrency = settings?.userCurrencies?.[u.username] || '';
                    const userRate = settings?.userExchangeRates?.[u.username];
                    const rateInputVal = localUserRates[u.username] !== undefined ? localUserRates[u.username] : (userRate !== undefined ? String(userRate) : '');
                    const belongsToCompany = companies.find(c => sameId(c.id, u.companyId))?.name || t('Global / Super');

                    return (
                      <tr key={u.id} className="hover:bg-gray-50/30">
                        <td className="px-6 py-4 font-bold text-gray-900">
                          <div>{u.name}</div>
                          <div className="text-[10px] text-gray-400 font-mono">@{u.username}</div>
                        </td>
                        <td className="px-6 py-4 text-gray-500 font-semibold text-xs">
                          <div>{belongsToCompany}</div>
                          <div className="text-[10px] text-indigo-600 uppercase font-black tracking-wider">{u.role}</div>
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={userCurrency}
                            onChange={(e) => handleUpdateUserSettings(u.username, e.target.value, userRate !== undefined ? userRate : null)}
                            className="bg-white border border-gray-300 rounded-lg text-xs font-semibold px-2 py-1 outline-none focus:border-brand"
                          >
                            <option value="">{t('No Override (Inherit)')}</option>
                            <option value="USD">USD ($)</option>
                            <option value="TZS">TZS (TSh)</option>
                            <option value="KES">KES (KSh)</option>
                            <option value="UGD">UGD (USh)</option>
                            <option value="UGX">UGX (USh)</option>
                            <option value="RWF">RWF (RF)</option>
                            <option value="EUR">EUR (€)</option>
                            <option value="GBP">GBP (£)</option>
                          </select>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="any"
                              value={rateInputVal}
                              onChange={(e) => setLocalUserRates({ ...localUserRates, [u.username]: e.target.value })}
                              className="w-28 px-2 py-1 border border-gray-300 rounded-lg text-xs font-black outline-none focus:border-brand"
                              placeholder={t('Inherit')}
                            />
                            <span className="text-[10px] font-bold text-gray-400">{userCurrency || t('Inherit')}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right flex items-center justify-end gap-1.5 pt-6">
                          <button
                            onClick={() => {
                              const inputFloat = parseFloat(rateInputVal);
                              if (rateInputVal === '') {
                                handleUpdateUserSettings(u.username, userCurrency, null);
                              } else if (!isNaN(inputFloat) && inputFloat > 0) {
                                handleUpdateUserSettings(u.username, userCurrency, inputFloat);
                              } else {
                                toast.error(t('Please enter a valid rate or clear the input.'));
                              }
                            }}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1 text-xs font-bold rounded-lg transition"
                          >
                            {t('Apply')}
                          </button>
                          {(userCurrency !== '' || userRate !== undefined) && (
                            <button
                              onClick={() => {
                                handleUpdateUserSettings(u.username, '', null);
                                setLocalUserRates({ ...localUserRates, [u.username]: '' });
                              }}
                              className="bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1 text-xs font-bold rounded-lg transition"
                              title={t('Clear overrides')}
                            >
                              {t('Clear')}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Global Falling System Backups */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-5">
            <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider mb-3">
              🌍 {t('System Global Fallback Settings')}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{t('Global Currency Fallback')}</label>
                <select
                  value={currentGlobalCurrency}
                  onChange={(e) => handleUpdateGlobalSettings(e.target.value, currentGlobalRate)}
                  className="bg-white border border-gray-300 rounded-lg text-xs font-semibold px-3 py-2 w-full outline-none focus:border-brand"
                >
                  <option value="USD">USD ($)</option>
                  <option value="TZS">TZS (TSh)</option>
                  <option value="KES">KES (KSh)</option>
                  <option value="UGD">UGD (USh)</option>
                  <option value="UGX">UGX (USh)</option>
                  <option value="RWF">RWF (RF)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{`${t('Global Exchange Rate Fallback (1 USD =')} ${currentGlobalCurrency})`}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="any"
                    value={localGlobalRate !== '' ? localGlobalRate : String(currentGlobalRate)}
                    onChange={(e) => setLocalGlobalRate(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-xs font-black outline-none focus:border-brand"
                    placeholder="1"
                  />
                  <button
                    onClick={() => {
                      const inputFloat = parseFloat(localGlobalRate !== '' ? localGlobalRate : String(currentGlobalRate));
                      if (!isNaN(inputFloat) && inputFloat > 0) {
                        handleUpdateGlobalSettings(currentGlobalCurrency, inputFloat);
                        setLocalGlobalRate('');
                      } else {
                        toast.error(t('Please enter a valid rate.'));
                      }
                    }}
                    className="bg-brand hover:bg-brand-hover text-white px-4 py-2 text-xs font-bold rounded-lg transition shrink-0"
                  >
                    {t('Apply')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );

    default:
      return null;
  }
  })();

  // --- RENDER INNER EDITING OVERLAY MODAL ---
  function renderEditModal() {
    if (!editingItem) return null;
    const { type, data } = editingItem;
    const isEdit = !!data.id;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/55 backdrop-blur-xs" onClick={() => setEditingItem(null)}></div>
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col relative z-10 transition-all transform scale-100 opacity-100 border border-gray-100">
          <div className="px-5 py-4 border-b flex items-center justify-between bg-gray-50">
            <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider">
              {isEdit ? t('Edit') : t('Add')} {t(type)}
            </h3>
            <button
              onClick={() => setEditingItem(null)}
              className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSave} className="flex flex-col overflow-hidden">
            <div className="p-5 space-y-4 overflow-y-auto max-h-[60vh] scrollbar-thin">
              {type === 'company' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{t('Company Name')} *</label>
                    <input
                      type="text"
                      required
                      value={data.name || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, data: { ...data, name: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{t('Subscription Period End Date')}</label>
                    <input
                      type="date"
                      value={data.subscriptionEnd || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, data: { ...data, subscriptionEnd: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{t('Subscription Status')}</label>
                    <select
                      value={data.subscriptionApproved !== undefined ? String(data.subscriptionApproved) : 'true'}
                      onChange={(e) => setEditingItem({ ...editingItem, data: { ...data, subscriptionApproved: e.target.value === 'true' } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none bg-white focus:border-brand"
                    >
                      <option value="true">{t('Approved & Active')}</option>
                      <option value="false">{t('Blocked / Payment Pending')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{t('Company Logo')}</label>
                    <div className="space-y-3">
                      {data.logoUrl && (
                        <div className="flex items-center gap-3 bg-gray-50 p-2.5 rounded-lg border border-dashed border-gray-200">
                          <img
                            src={data.logoUrl}
                            alt="Logo preview"
                            className="w-12 h-12 rounded-lg object-contain bg-white border border-gray-200"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                          <div>
                            <p className="text-xs font-bold text-gray-700">{t('Preview')}</p>
                            <button
                              type="button"
                              onClick={() => setEditingItem({ ...editingItem, data: { ...data, logoUrl: '' } })}
                              className="text-[11px] text-red-500 hover:underline font-bold"
                            >
                              {t('Remove')}
                            </button>
                          </div>
                        </div>
                      )}
                      <input
                        type="text"
                        placeholder="https://example.com/logo.png"
                        value={data.logoUrl || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, data: { ...data, logoUrl: e.target.value } })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand"
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-gray-400 font-bold uppercase">{t('OR')}</span>
                        <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg border border-gray-300 font-bold transition flex items-center gap-1.5">
                          📁 {t('Upload From Device')}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                if (file.size > 1.5 * 1024 * 1024) {
                                  toast.error(t('Image size exceeds 1.5MB limit. Please select a smaller image.'));
                                  return;
                                }
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  if (typeof reader.result === 'string') {
                                    setEditingItem({
                                      ...editingItem,
                                      data: { ...data, logoUrl: reader.result }
                                    });
                                  }
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                        {data.logoUrl && data.logoUrl.startsWith('data:') && (
                          <span className="text-[10px] text-green-600 font-semibold">✓ {t('Uploaded successfully')}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{t('Company Theme Color')}</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={data.themeColor || '#c41e3a'}
                        onChange={(e) => setEditingItem({ ...editingItem, data: { ...data, themeColor: e.target.value } })}
                        className="w-10 h-10 rounded border border-gray-300 cursor-pointer p-0 bg-transparent flex-shrink-0"
                      />
                      <input
                        type="text"
                        value={data.themeColor || '#c41e3a'}
                        onChange={(e) => setEditingItem({ ...editingItem, data: { ...data, themeColor: e.target.value } })}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand font-mono font-semibold"
                        placeholder="#c41e3a"
                      />
                    </div>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {[
                        { name: 'Crimson', hex: '#c41e3a' },
                        { name: 'Indigo', hex: '#1e3a8a' },
                        { name: 'Emerald', hex: '#16a34a' },
                        { name: 'Violet', hex: '#7c3aed' },
                        { name: 'Charcoal', hex: '#374151' }
                      ].map(preset => (
                        <button
                          key={preset.hex}
                          type="button"
                          onClick={() => setEditingItem({ ...editingItem, data: { ...data, themeColor: preset.hex } })}
                          className="px-2.5 py-1 text-[11px] font-bold rounded-md border text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 transition"
                          style={{ borderColor: (data.themeColor || '#c41e3a') === preset.hex ? preset.hex : '#e5e7eb' }}
                        >
                          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: preset.hex }}></span>
                          {t(preset.name)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* TRA COMPLIANCE — TIN / VAT / business license */}
                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
                    <span className="text-xs font-extrabold text-amber-900 uppercase tracking-wider block">
                      {t('Taarifa za TRA (Tax Compliance)')}
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-gray-700 mb-1 block uppercase">{t('TIN Number')} *</label>
                        <input
                          type="text"
                          required
                          value={data.tinNumber || ''}
                          onChange={(e) => setEditingItem({ ...editingItem, data: { ...data, tinNumber: e.target.value.replace(/[^0-9\-]/g, '') } })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono font-bold bg-white outline-none focus:border-brand"
                          placeholder="123-456-789"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-gray-700 mb-1 block uppercase">{t('VRN Number (if VAT registered)')}</label>
                        <input
                          type="text"
                          value={data.vrnNumber || ''}
                          onChange={(e) => setEditingItem({ ...editingItem, data: { ...data, vrnNumber: e.target.value.replace(/[^0-9A-Za-z\-]/g, '') } })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono font-bold bg-white outline-none focus:border-brand"
                          placeholder="e.g. 40-012345678"
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!data.isVatRegistered}
                        onChange={(e) => setEditingItem({ ...editingItem, data: { ...data, isVatRegistered: e.target.checked } })}
                        className="w-4 h-4 accent-amber-600"
                      />
                      <span className="text-[11px] font-bold text-gray-700">{t('Nimesajiliwa VAT (VAT registered)')}</span>
                    </label>
                    <div>
                      <label className="text-[11px] font-bold text-gray-700 mb-1 block uppercase">{t('Business License (URL or upload)')}</label>
                      <input
                        type="text"
                        value={data.businessLicense || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, data: { ...data, businessLicense: e.target.value } })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-bold bg-white outline-none focus:border-brand"
                        placeholder="https://... or data URL"
                      />
                    </div>
                  </div>

                  {/* Company Isolated Language & Currency Settings */}
                  <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-3">
                    <span className="text-xs font-extrabold text-purple-950 uppercase tracking-wider block">
                      🌐 {t('Company Independent Language & Currency')}
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-gray-700 mb-1 block uppercase">{t('Company Language')}</label>
                        <select
                          value={data.language || settings?.companyLanguages?.[data.id] || 'en'}
                          onChange={(e) => setEditingItem({ ...editingItem, data: { ...data, language: e.target.value } })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold bg-white outline-none focus:border-brand"
                        >
                          <option value="en">English</option>
                          <option value="sw">Kiswahili (Swahili)</option>
                          <option value="fr">Français (French)</option>
                          <option value="es">Español (Spanish)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-gray-700 mb-1 block uppercase">{t('Company Currency')}</label>
                        <select
                          value={data.currency || settings?.companyCurrencies?.[data.id] || 'USD'}
                          onChange={(e) => setEditingItem({ ...editingItem, data: { ...data, currency: e.target.value } })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold bg-white outline-none focus:border-brand"
                        >
                          <option value="USD">USD ($)</option>
                          <option value="TZS">TZS (TSh)</option>
                          <option value="KES">KES (KSh)</option>
                          <option value="UGD">UGD (USh)</option>
                          <option value="UGX">UGX (USh)</option>
                          <option value="RWF">RWF (RF)</option>
                          <option value="EUR">EUR (€)</option>
                          <option value="GBP">GBP (£)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-gray-700 mb-1 block uppercase">{t('Exchange Conversion (1 USD = X Local Units)')}</label>
                      <input
                        type="number"
                        step="any"
                        value={data.exchangeRate !== undefined ? data.exchangeRate : (settings?.companyExchangeRates?.[data.id] ?? 1)}
                        onChange={(e) => setEditingItem({ ...editingItem, data: { ...data, exchangeRate: parseFloat(e.target.value) || 1 } })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono font-bold bg-white outline-none focus:border-brand"
                        placeholder="e.g. 2600"
                      />
                    </div>
                  </div>
                </div>
              )}

              {type === 'branch' && (
                <>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{t('Branch Name')} *</label>
                    <input
                      type="text"
                      required
                      value={data.name || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, data: { ...data, name: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand"
                    />
                  </div>
                  {isSuperAdmin && (
                    <div>
                      <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{t('Company Parent')} *</label>
                      <select
                        required
                        value={data.companyId || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, data: { ...data, companyId: e.target.value } })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand bg-white font-semibold"
                      >
                        {companies.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              {type === 'store' && (
                <>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{t('Store Name')} *</label>
                    <input
                      type="text"
                      required
                      value={data.name || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, data: { ...data, name: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{t('Assigned Branch')} *</label>
                    <select
                      required
                      value={data.branchId || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, data: { ...data, branchId: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand bg-white font-semibold"
                    >
                      {branches
                        .filter(b => isSuperAdmin || sameId(b.companyId, currentCompanyId))
                        .map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{t('Location')} *</label>
                    <input
                      type="text"
                      required
                      value={data.location || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, data: { ...data, location: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{t('Phone')}</label>
                    <input
                      type="text"
                      value={data.phone || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, data: { ...data, phone: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand"
                    />
                  </div>
                  <div className="space-y-3 border-t border-gray-100 pt-3 mt-1">
                    <div className="text-[10px] font-black uppercase tracking-wider text-brand">📍 {t('Store Location Mapping (Multi-Store)')}</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{t('Latitude')}</label>
                        <input
                          type="number"
                          step="any"
                          value={data.latitude ?? ''}
                          onChange={(e) => setEditingItem({ ...editingItem, data: { ...data, latitude: e.target.value } })}
                          placeholder="-6.8175"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{t('Longitude')}</label>
                        <input
                          type="number"
                          step="any"
                          value={data.longitude ?? ''}
                          onChange={(e) => setEditingItem({ ...editingItem, data: { ...data, longitude: e.target.value } })}
                          placeholder="39.2732"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{t('Google Maps URL')}</label>
                      <input
                        type="text"
                        value={data.googleMapsUrl || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, data: { ...data, googleMapsUrl: e.target.value } })}
                        placeholder="https://maps.app.goo.gl/..." 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{t('Operating Hours')}</label>
                      <input
                        type="text"
                        value={data.operatingHours || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, data: { ...data, operatingHours: e.target.value } })}
                        placeholder="Mon–Sat 08:00–18:00"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand"
                      />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={data.isMarketplaceVisible !== false}
                        onChange={(e) => setEditingItem({ ...editingItem, data: { ...data, isMarketplaceVisible: e.target.checked } })}
                        className="w-4 h-4 accent-brand"
                      />
                      <span className="text-xs font-bold text-gray-600">{t('Show this store on the public product map')}</span>
                    </label>
                  </div>
                </>
              )}

              {type === 'customer' && (
                <>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{t('Name')} *</label>
                    <input
                      type="text"
                      required
                      value={data.name || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, data: { ...data, name: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{t('Type')} *</label>
                    <select
                      required
                      value={data.type || 'Retail'}
                      onChange={(e) => setEditingItem({ ...editingItem, data: { ...data, type: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand bg-white font-semibold"
                    >
                      <option value="Retail">{t('Retail')}</option>
                      <option value="Wholesale">{t('Wholesale')}</option>
                      <option value="Preferred">{t('Preferred Partner')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{t('Phone')}</label>
                    <input
                      type="text"
                      value={data.phone || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, data: { ...data, phone: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{t('Email')}</label>
                    <input
                      type="email"
                      value={data.email || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, data: { ...data, email: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">
                      {t('Credit Limit')} ({currency})
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={data.creditLimitDisplay || '0'}
                      onChange={(e) => setEditingItem({ ...editingItem, data: { ...data, creditLimitDisplay: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">
                      {t('Current Balance')} ({currency})
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={data.balanceDisplay || '0'}
                      onChange={(e) => setEditingItem({ ...editingItem, data: { ...data, balanceDisplay: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{t('Assigned Store')}</label>
                    <select
                      value={data.storeId || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, data: { ...data, storeId: e.target.value ? Number(e.target.value) : null } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none bg-white font-semibold focus:border-brand"
                    >
                      <option value="">{t('All Stores')}</option>
                      {stores.map(st => (
                        <option key={st.id} value={st.id}>{st.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {type === 'supplier' && (
                <>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{t('Company Name')} *</label>
                    <input
                      type="text"
                      required
                      value={data.name || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, data: { ...data, name: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{t('Contact Person')}</label>
                    <input
                      type="text"
                      value={data.contact || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, data: { ...data, contact: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{t('Phone')}</label>
                    <input
                      type="text"
                      value={data.phone || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, data: { ...data, phone: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{t('Email')}</label>
                    <input
                      type="email"
                      value={data.email || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, data: { ...data, email: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{t('Assigned Store')}</label>
                    <select
                      value={data.storeId || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, data: { ...data, storeId: e.target.value ? Number(e.target.value) : null } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none bg-white font-semibold focus:border-brand"
                    >
                      <option value="">{t('All Stores')}</option>
                      {stores.map(st => (
                        <option key={st.id} value={st.id}>{st.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {type === 'category' && (
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{t('Category Name')} *</label>
                  <input
                    type="text"
                    required
                    value={data.name || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, data: { ...data, name: e.target.value } })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand"
                  />
                </div>
              )}

              {type === 'tax' && (
                <>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{t('Tax Name')} *</label>
                    <input
                      type="text"
                      required
                      value={data.name || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, data: { ...data, name: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{t('Rate (%)')} *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={data.rate || '0'}
                      onChange={(e) => setEditingItem({ ...editingItem, data: { ...data, rate: e.target.value } })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-bold hover:bg-gray-100 text-gray-700 transition"
              >
                {t('Cancel')}
              </button>
              <button
                type="button"
                onClick={(e) => { (e as any).preventDefault?.(); void handleSave(e as any); }}
                className="px-4 py-2 bg-brand text-white rounded-lg text-xs font-bold hover:bg-brand-hover transition"
              >
                {t('Save')}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'companies', label: t('Companies'), icon: '🏢', visible: isSuperAdmin },
    { id: 'branches', label: t('Branches'), icon: '🌿', visible: isSuperAdmin || isAdmin },
    { id: 'stores', label: t('Store Management'), icon: '🏪', visible: true },
    { id: 'customers', label: t('Customers'), icon: '👥', visible: true },
    { id: 'suppliers', label: t('Suppliers'), icon: '🤝', visible: true },
    { id: 'categories', label: t('Stock Categories'), icon: '📁', visible: true },
    { id: 'taxes', label: t('Manage Taxes'), icon: '📊', visible: true },
    { id: 'data-recovery', label: t('Data Recovery'), icon: '♻️', visible: isSuperAdmin },
    { id: 'exchange-rate', label: t('Exchange Rates'), icon: '🌐', visible: isSuperAdmin || isAdmin },
  ].filter(tab => tab.visible);

  return (
    <div className="space-y-6">
      {/* Horizontal Tab Navigation Bar inside Master Data */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-2 max-w-4xl mx-auto overflow-x-auto scrollbar-none no-print">
        <div className="flex items-center gap-1 min-w-max">
          {tabs.map((tab) => {
            const isActive = currentPage === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onNavigate && onNavigate(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-brand text-white shadow-xs'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/80'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {content}

      <AccountStatementModal
        isOpen={statementModal.isOpen}
        onClose={() => setStatementModal(prev => ({ ...prev, isOpen: false }))}
        entityType={statementModal.entityType}
        entityId={statementModal.entityId}
        entityName={statementModal.name}
        salesOrders={salesOrders}
        purchaseOrders={purchaseOrders}
        customers={customers}
        suppliers={suppliers}
        currencySymbol={currency === 'TZS' ? 'TZS ' : '$'}
      />

      <SmartMessagingModal
        isOpen={messagingModal.isOpen}
        onClose={() => setMessagingModal(prev => ({ ...prev, isOpen: false }))}
        recipientName={messagingModal.recipientName}
        recipientPhone={messagingModal.recipientPhone}
        outstandingBalance={messagingModal.outstandingBalance}
        currencySymbol={currency === 'TZS' ? 'TZS ' : '$'}
      />

      <ConfirmActionModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        description={confirmModal.description}
      />
    </div>
  );
}
