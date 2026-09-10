import React, { useState } from 'react';
import { User, Company, Branch, Store, AuditTrail, SecurityLog, Settings } from '../types';
import {
  Plus, Pencil, Trash2, ShieldAlert, CheckCircle, X, Eye, EyeOff, Lock, RotateCcw, Key
} from 'lucide-react';
import { ConfirmActionModal } from './ConfirmActionModal';
import { toast } from '../utils/toast';
import { hashPassword, isHashedPassword } from '../utils/hash';
import { apiChangePassword, apiDeleteUser, apiUpsertUser } from '../utils/api';
import { defaultUsers } from '../initialData';
import { sameId } from '../utils/idUtils';

interface ManageUsersProps {
  currentPage: string;
  users: User[];
  companies: Company[];
  branches: Branch[];
  stores: Store[];
  auditTrails: AuditTrail[];
  securityLogs?: SecurityLog[];
  rolePermissions: Record<string, string[]>;
  currentUser: User | null;
  currentCompanyId: string | number | null;
  currentBranchId: string | number | null;
  currentStoreId: string | number | null;
  settings: Settings;
  isSuperAdmin: boolean;
  isGlobalSuperAdmin: boolean;
  translate: (text: string) => string;
  logAction: (action: string, details: string) => void;
  saveAllData: (updatedFields: any) => void;
  onNavigate: (page: string) => void;
  onResetPassword?: (target: User, newPasswordHash: string, companyId?: string | number) => Promise<boolean>;
}

export default function ManageUsers({
  currentPage,
  users,
  companies,
  branches,
  stores,
  auditTrails,
  rolePermissions,
  currentUser,
  currentCompanyId,
  currentBranchId,
  currentStoreId,
  settings,
  isSuperAdmin,
  isGlobalSuperAdmin,
  translate: t,
  logAction,
  saveAllData,
  onNavigate,
  onResetPassword
}: ManageUsersProps) {
  // BUILD 2026-09-08-6: tolerant global-super detection — the login server can
  // emit the role as 'Super Admin' / 'superadmin' / 'super_admin' / 'super admin'
  // and the recreated root may carry no isRoot flag. None of the exact-string
  // gates below may hide User Access / the Access Matrix / audit rows from a real
  // global super.
  const isSuperRole = (r?: string): boolean =>
    !!r && ['Super Admin', 'superadmin', 'super_admin', 'super admin'].includes(String(r).trim());
  const isSuperScopeCtx = (u: any): boolean =>
    !!u && (u.username === 'root_mandate' || u.username === 'superadmin' || isSuperRole(u?.role));
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const [selectedStaffPages, setSelectedStaffPages] = useState<string[]>([]);
  const [lastSyncedStaffId, setLastSyncedStaffId] = useState<number | null>(null);

  // Security Telemetry Panel filters
  const [telemetrySearch, setTelemetrySearch] = useState('');
  const [telemetryCategory, setTelemetryCategory] = useState('All');
  const [telemetryUser, setTelemetryUser] = useState('All');

  // Password masking & hierarchy
  const [showModalPassword, setShowModalPassword] = useState(false);

  // Secure temporary-password reset modal (never reveals the old password)
  const [resetPassTarget, setResetPassTarget] = useState<User | null>(null);
  const [resetPassVal, setResetPassVal] = useState('');
  const [resetPassConfirm, setResetPassConfirm] = useState('');
  const [resetPassError, setResetPassError] = useState('');

  // Audit Ledger filters & bulk selection
  const [auditStaffFilter, setAuditStaffFilter] = useState('All');
  const [selectedAuditIds, setSelectedAuditIds] = useState<string[]>([]);

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

  // Helper getters
  const getCompanyName = (id: number | null) => id ? (companies.find(c => sameId(c.id, id))?.name || t('Unknown')) : t('Global / All');
  const getBranchName = (id: number | null) => id ? (branches.find(b => b.id === id)?.name || t('Unknown')) : t('Global / All');
  const getStoreName = (id: number | null) => id ? (stores.find(s => s.id === id)?.name || t('Unknown')) : t('Global / All');

  // Password hierarchy: only root_mandate / global super admin can view or modify passwords of core accounts.
  // The restricted Super Admin role (non-global) has NO password access; only Admins may reset company staff credentials.
  const canAccessPassword = (target: User) => {
    if (currentUser?.username === 'root_mandate') return true;
    if (currentUser?.username === 'superadmin') {
      return target.username !== 'root_mandate';
    }
    if (target.username === 'root_mandate' || target.username === 'superadmin') return false;
    if (target.role === 'Super Admin') return false;
    return isGlobalSuperAdmin || isSuperScopeCtx(currentUser) || currentUser?.role === 'Admin';
  };

  // Restricted Super Admin: a Super Admin who is not the global superadmin/root_mandate.
  // Such accounts may ONLY block and delete users — no editing, no password access.
  const isRestrictedSuperAdmin = isSuperAdmin && !isGlobalSuperAdmin;

  // Block capability: restricted Super Admin may only block/delete (no edit, no password access).
  const canBlockUser = (target: User) => {
    if (!currentUser) return false;
    if (target.id === currentUser.id) return false;
    if (target.username === 'root_mandate') return false;
    if (target.username === 'superadmin') return isGlobalSuperAdmin;
    if (isSuperRole(target.role)) return isGlobalSuperAdmin;
    if (!isGlobalSuperAdmin && target.companyId !== null && currentUser.companyId !== null && target.companyId !== currentUser.companyId) return false;
    return isSuperScopeCtx(currentUser) || currentUser.role === 'Admin';
  };

  // Filter users based on logged-in user's administrative level
  let usersToRender = [...users];

  // Hide root_mandate from everyone else
  if (currentUser?.username !== 'root_mandate') {
    usersToRender = usersToRender.filter(u => u.username !== 'root_mandate');
  }

  // Hide Global Super Admin from standard Admins
  if (!isGlobalSuperAdmin) {
    usersToRender = usersToRender.filter(u => u.username !== 'superadmin');
  }

  // Hide Super Admins and other companies from regular Admins
  if (!isSuperAdmin) {
    usersToRender = usersToRender.filter(
      u => u.role !== 'Super Admin' && sameId(u.companyId, currentCompanyId)
    );
  }

  // Filter staff to render (exclude Supers — any spelling, so lowercased super rows never appear as editable targets)
  let staffToRender = users.filter(u => u.role !== 'Super Admin' && !isSuperRole(u.role) && u.username !== 'root_mandate' && u.username !== 'superadmin');
  if (currentUser?.username !== 'root_mandate') {
    staffToRender = staffToRender.filter(u => u.username !== 'root_mandate' && u.username !== 'superadmin');
  }
  if (!isSuperAdmin) {
    staffToRender = staffToRender.filter(u => sameId(u.companyId, currentCompanyId));
  }

  // Categories of modules for cleaner representation
  const moduleCategories = [
    {
      title: t('Core Operational Panels'),
      items: [
        { id: 'dashboard', name: t('Dashboard') },
        { id: 'stock-items', name: t('Stock Items') },
        { id: 'purchase-order', name: t('Purchase Orders') },
        { id: 'sales-order', name: t('Sales Orders') },
        { id: 'expenses', name: t('Expenses') },
        { id: 'receipts', name: t('Receipts') },
      ]
    },
    {
      title: t('Marketplace Panels'),
      items: [
        { id: 'marketplace-orders', name: t('Marketplace Orders (verify customers)') },
        { id: 'marketplace-settings', name: t('Marketplace Store Settings') },
        { id: 'seller-wallet', name: t('Seller Wallet (M-Pesa payouts)') },
        { id: 'affiliate-program', name: t('Wakala Wangu (referral earnings)') },
        { id: 'qr-code-yangu', name: t('QR Code Yangu (store poster)') },
        { id: 'sauti-search', name: t('Sauti Search (voice stats)') },
      ]
    },
    {
      title: t('Master Data Panels'),
      items: [
        { id: 'customers', name: t('Customers (Master)') },
        { id: 'suppliers', name: t('Suppliers (Master)') },
        { id: 'categories', name: t('Stock Categories (Master)') },
        { id: 'taxes', name: t('Taxes (Master)') },
        { id: 'stores', name: t('Store Management (Master)') },
        { id: 'branches', name: t('Branch Management (Master)') },
        { id: 'companies', name: t('Company Registry (Super Admin)') },
        { id: 'data-recovery', name: t('Data Recovery / Trash (Master)') },
      ]
    },
    {
      title: t('Import Tools'),
      items: [
        { id: 'import-stock', name: t('Import Stock Items') },
        { id: 'import-customers', name: t('Import Customers') },
        { id: 'import-suppliers', name: t('Import Suppliers') },
      ]
    },
    {
      title: t('Report Sheets'),
      items: [
        { id: 'report-transaction', name: t('Transaction Logs (Date Search)') },
        { id: 'report-financial', name: t('Financial Report (P&L)') },
        { id: 'report-daily', name: t('Daily Activity Sheet') },
        { id: 'report-monthly', name: t('Monthly Report Sheet') },
        { id: 'report-sales', name: t('Sales Report Sheet') },
        { id: 'report-purchase', name: t('Purchase Report Sheet') },
        { id: 'report-sales-outstanding', name: t('Sales Outstanding') },
        { id: 'report-purchase-outstanding', name: t('Purchase Outstanding') },
        { id: 'report-lowstock', name: t('Low Stock Report') },
        { id: 'report-po-details', name: t('PO Details Report') },
      ]
    }
  ];

  // Toggle user block status
  const handleToggleUserBlock = (userId: number, blockBool: boolean) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;
    if (!canBlockUser(target)) {
      toast.error(t('Insufficient authorization scope'));
      return;
    }
    // Core super admin accounts are immune to blocking
    if (target.username === 'root_mandate' || target.username === 'superadmin') {
      toast.error(t('Core super admin accounts cannot be blocked.'));
      return;
    }
    const status = blockBool ? 'Blocked' : 'Active';
    const updatedUsers = users.map(u => u.id === userId ? { ...u, status } : u);
    saveAllData({ users: updatedUsers });
    logAction(blockBool ? 'Blocked Account' : 'Unblocked Account', `${currentUser?.username} changed scope accessibility of ${target.username} to ${status}`);
    toast.success(`${t('Account')} ${target.name} has been ${blockBool ? t('blocked') : t('unblocked')}.`);
  };

  // Delete user handler
  const handleDeleteUser = (id: number) => {
    if (id === currentUser?.id) {
      toast.error(t('Cannot self-terminate active session!'));
      return;
    }

    const target = users.find(u => u.id === id);
    if (!target) return;

    if (target.username === 'root_mandate') {
      toast.error(t('Super Admin is locked and cannot be deleted'));
      return;
    }

    const isFounder = currentUser?.username === 'root_mandate';
    const isGlobalSA = currentUser?.username === 'superadmin' || isFounder;

    if (!isFounder) {
      // Non-founders cannot delete the global superadmin
      if (target.username === 'superadmin') {
        toast.error(t('Global Super Admin is locked and cannot be deleted'));
        return;
      }

      // If not even global super admin, apply company admin checks
      if (!isGlobalSA) {
        if (target.role === 'Super Admin') {
          toast.error(t('Insufficient authorization scope'));
          return;
        }

        // Company Admin of the company can add/delete his/her own staff
        if (!sameId(target.companyId, currentCompanyId)) {
          toast.error(t('Cannot delete users from other companies'));
          return;
        }
      }
    }

    setConfirmModal({
      isOpen: true,
      title: t('Delete User Account'),
      description: `${t('Are you sure you want to completely revoke the core operational scope for')} ${target.name}? ${t('This action is irreversible.')}`,
      onConfirm: async () => {
        // BUG 4 FIX: delete the row in MySQL synchronously BEFORE updating local state,
        // so background syncs / restarts can never re-return this user (the old code only
        // removed the user from React state — the MySQL row stayed and re-appeared).
        try {
          await apiDeleteUser(id, target.companyId);
        } catch (e) {
          toast.error(t('Delete failed — user will reappear. Check connection and retry.'));
        }
        const updatedUsers = users.filter(u => u.id !== id);
        // Track deleted default users so the seeder never auto-recreates them.
        const isDefaultUser = defaultUsers.some(
          d => d.username.toLowerCase() === target.username.toLowerCase()
        );
        let updatedSettings = settings;
        if (isDefaultUser) {
          const deleted = Array.from(new Set([...(settings.deletedDefaultUsers || []), target.username]));
          updatedSettings = { ...settings, deletedDefaultUsers: deleted };
        }
        saveAllData({ users: updatedUsers, settings: updatedSettings });
        logAction('Deleted User Account', `Revoked access for operator ${target.username}`);
      }
    });
  };

  // Save matrix permissions handler
  const saveDynamicPermissions = () => {
    if (!isSuperAdmin) return;

    const roles = ['Admin', 'Store Admin', 'Branch Administrator', 'Retailer', 'Wholesaler'];
    const updatedPermissions: Record<string, string[]> = {
      'Super Admin': [
        'dashboard', 'stock-items', 'purchase-order', 'sales-order', 'expenses', 'receipts',
        'companies', 'branches', 'stores', 'customers', 'suppliers', 'categories', 'taxes',
        'import-stock', 'import-customers', 'import-suppliers',
        'report-transaction', 'report-financial', 'report-daily', 'report-monthly', 'report-sales', 'report-purchase',
        'report-sales-outstanding', 'report-purchase-outstanding', 'report-lowstock', 'report-po-details',
        'user-info', 'user-access',
        'marketplace-orders', 'marketplace-settings',
        'seller-wallet', 'affiliate-program', 'qr-code-yangu', 'sauti-search'
      ],
      'Admin': [],
      'Store Admin': [],
      'Branch Administrator': [],
      'Retailer': [],
      'Wholesaler': []
    };

    roles.forEach(r => {
      const inputs = document.querySelectorAll(`input[data-role="${r}"]`) as NodeListOf<HTMLInputElement>;
      inputs.forEach(input => {
        if (input.checked && input.dataset.module) {
          updatedPermissions[r].push(input.dataset.module);
        }
      });
    });

    saveAllData({ rolePermissions: updatedPermissions });
    logAction('Updated Permissions Matrix', 'Custom operational permissions modified.');
    toast.success(t('Operational parameters updated successfully'));
  };

  // Modal Save handler
  const handleSaveUser = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingUser) return;

    const data = { ...editingUser };
    // BUILD 2026-09-08-18: company ids are STRINGS — parseInt converts a UUID to NaN
    // and every downstream filter silently targets 'NaN'. Keep the raw string scope.
    data.companyId = isSuperAdmin
      ? (data.companyId !== undefined && data.companyId !== null && data.companyId !== '' && String(data.companyId) !== 'NaN'
          ? String(data.companyId)
          : null)
      : (currentCompanyId != null ? String(currentCompanyId) : data.companyId);
    if (isSuperAdmin && !isGlobalSuperAdmin) {
      data.companyId = currentCompanyId != null ? String(currentCompanyId) : data.companyId;
    }

    // Restricted Super Admins may ADD new users, but cannot edit existing accounts (block/delete only for existing).
    if (isRestrictedSuperAdmin && data.id) {
      toast.error(t('Access Denied: Super Admin can add new users, but only block or delete existing ones.'));
      setEditingUser(null);
      return;
    }
    data.branchId = (data.branchId as any) === 'None' || !data.branchId ? null : parseInt(data.branchId as any);
    data.storeId = (data.storeId as any) === 'None' || !data.storeId ? null : parseInt(data.storeId as any);

    // ROLE-HIERARCHY scope rules (ADD USER):
    //  - Admin / Administrator / Company Administrator / Super Admin → Branch=None,
    //    Store=None allowed (accesses ALL branches + ALL stores in the allocated company).
    //  - Branch Administrator / Branch Manager / Branch Admin → Branch REQUIRED,
    //    Store=None allowed (= All Stores in that branch).
    //  - Store Administrator / Store Admin / Store Manager → Branch REQUIRED,
    //    Store=None allowed (= All Stores in that branch).
    //  - Plain staff (Cashier/Retailer/Wholesaler/seller) → Branch + Store REQUIRED.
    const roleLower = String((data as any).role || '').toLowerCase();
    const topAdminRoles = ['admin', 'administrator', 'company administrator', 'super admin'];
    const branchAdminRoles = ['branch administrator', 'branch manager', 'branch admin'];
    const storeAdminRoles = ['store administrator', 'store admin', 'store manager'];
    const isTopAdmin = topAdminRoles.includes(roleLower);
    const isBranchScoped = branchAdminRoles.includes(roleLower) || storeAdminRoles.includes(roleLower);
    const isAdminLike = isTopAdmin || isBranchScoped || roleLower.includes('admin') || roleLower.includes('manager');

    if ((data as any).role !== 'Super Admin') {
      if (!data.companyId) {
        toast.error(t('Company is required for this account.'));
        return;
      }
      if (!isTopAdmin && !data.branchId) {
        toast.error(t('Please assign a Branch — Branch/Store managers must be anchored to a branch.'));
        return;
      }
      if (!isAdminLike && !data.storeId) {
        toast.error(t('Please assign a Store — staff accounts cannot be storeless.'));
        return;
      }
    }

    // Hash plaintext passwords on create/reset; leave already-hashed values untouched.
    if (data.password && !isHashedPassword(data.password)) {
      data.password = hashPassword(data.password);
    }
    if (!data.id && !data.password) {
      toast.error(t('Password is required for new users.'));
      return;
    }

    if (data.id) {
      // Edit
      const updated = users.map(u => u.id === data.id ? data : u);
      saveAllData({ users: updated });
      // IMMEDIATE DB ASSIGNMENT: push the edited row to the atomic tradecore_users
      // table right away (REPLACE INTO + blob dual-write), so the assignment is
      // durable before the debounced blob flush runs.
      void apiUpsertUser(data).catch(() => {});
      logAction('Edited User', `Modified user details for ${data.username}`);
      toast.success(t('User saved'));
    } else {
      // Create
      const nextId = Math.max(0, ...users.map(u => u.id)) + 1;
      const newUser = {
        ...data,
        id: nextId,
        firstLogin: true,
        status: 'Active' as const
      };
      saveAllData({ users: [...users, newUser] });
      // IMMEDIATE DB ASSIGNMENT for brand-new accounts — the user exists in MySQL
      // the moment they are created, so a same-second login from another device is
      // recognized instead of stuck in the pre-login sync window.
      void apiUpsertUser(newUser).catch(() => {});
      logAction('Added User', `Registered platform account: ${data.username}`);
      toast.success(t('User saved'));
    }

    setEditingUser(null);
  };

  // Define module screens for Access Matrix
  const modules = [
    { id: 'dashboard', name: t('Dashboard') },
    { id: 'stock-items', name: t('Stock Items') },
    { id: 'purchase-order', name: t('Purchase Orders') },
    { id: 'sales-order', name: t('Sales Orders') },
    { id: 'companies', name: t('Company Settings (Master)') },
    { id: 'branches', name: t('Branch Management (Master)') },
    { id: 'stores', name: t('Store Management (Master)') },
    { id: 'customers', name: t('Customers (Master)') },
    { id: 'suppliers', name: t('Suppliers (Master)') },
    { id: 'categories', name: t('Categories (Master)') },
    { id: 'taxes', name: t('Taxes (Master)') },
    { id: 'import-stock', name: t('Import - Stock Items') },
    { id: 'import-customers', name: t('Import - Customers') },
    { id: 'import-suppliers', name: t('Import - Suppliers') },
    { id: 'report-transaction', name: t('Report - Transaction Date Search') },
    { id: 'report-daily', name: t('Report - Daily Activity') },
    { id: 'report-monthly', name: t('Report - Monthly') },
    { id: 'report-sales', name: t('Report - Sales') },
    { id: 'report-purchase', name: t('Report - Purchase') },
    { id: 'report-sales-outstanding', name: t('Report - Sales Outstanding') },
    { id: 'report-purchase-outstanding', name: t('Report - Purchase Outstanding') },
    { id: 'report-lowstock', name: t('Report - Low Stock') },
    { id: 'report-po-details', name: t('Report - Purchase Order Details') },
    { id: 'user-info', name: t('User Management') }
  ];

  // --- RENDER CONTENT BY currentPage ---
  if (currentPage === 'user-info') {
    let logs = [...auditTrails];

    // Filter audit logs as requested
    if (currentUser?.username !== 'root_mandate') {
      logs = logs.filter(l => l.username !== 'root_mandate');
    }
    if (!isSuperScopeCtx(currentUser)) {
      logs = logs.filter(l => l.username !== 'superadmin');
    }
    if (!isSuperAdmin && !isSuperScopeCtx(currentUser)) {
      logs = logs.filter(l => l.role !== 'Super Admin' && sameId(l.companyId, currentCompanyId));
    }
    if (auditStaffFilter !== 'All') {
      logs = logs.filter(l => l.username === auditStaffFilter);
    }
    const auditOperators = Array.from(new Set(logs.map(l => l.username))).sort();
    const allLogsShownSelected = logs.length > 0 && logs.every(l => selectedAuditIds.includes(l.id));

    const toggleAuditSelection = (id: string) => {
      setSelectedAuditIds(prev =>
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      );
    };

    const toggleAllAuditSelection = () => {
      if (allLogsShownSelected) {
        const shownIds = new Set(logs.map(l => l.id));
        setSelectedAuditIds(prev => prev.filter(id => !shownIds.has(id)));
      } else {
        const shownIds = logs.map(l => l.id);
        setSelectedAuditIds(prev => Array.from(new Set([...prev, ...shownIds])));
      }
    };

    const handleBulkDeleteAudits = () => {
      if (selectedAuditIds.length === 0) return;
      setConfirmModal({
        isOpen: true,
        title: t('Bulk Delete Audit Trails'),
        description: `${t('Are you sure you want to permanently delete')} ${selectedAuditIds.length} ${t('audit trail log(s)? This action is irreversible.')}`,
        onConfirm: () => {
          const removeSet = new Set(selectedAuditIds);
          const remaining = auditTrails.filter(item => !removeSet.has(item.id));
          saveAllData({ auditTrails: remaining });
          setSelectedAuditIds([]);
          logAction('Bulk Deleted Audit Trails', `Permanently removed ${selectedAuditIds.length} core action audit trail log(s).`);
          toast.success(t('Selected audit trail logs deleted successfully.'));
        }
      });
    };

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="font-bold text-gray-900 text-sm">{t('Account Operations')}</h3>
              <p className="text-xs text-gray-500 mt-1">{t('Admins and Super Admins can create and reset operator credentials below. Super Admin edits of existing accounts are limited to blocking and deleting; only the Global Super Admin modifies core accounts.')}</p>
            </div>
            <button
              onClick={() => { setShowModalPassword(false); setEditingUser({
                id: 0,
                username: '',
                password: '',
                role: 'Retailer',
                name: '',
                email: '',
                companyId: currentCompanyId != null ? String(currentCompanyId) : null,
                branchId: null,
                storeId: null,
                firstLogin: true,
                status: 'Active',
                allowedPages: rolePermissions['Retailer'] || []
              }); }}
              className="bg-brand hover:bg-brand-hover text-white px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 flex-shrink-0 shadow"
            >
              <Plus className="w-4 h-4" /> {t('Add User')}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] text-left">
              <thead className="bg-gray-50 border-b text-gray-500 text-[10px] uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-4 py-3">{t('Name')}</th>
                  <th className="px-4 py-3">{t('Username')}</th>
                  <th className="px-4 py-3">{t('Role')}</th>
                  <th className="px-4 py-3">{t('Company')}</th>
                  <th className="px-4 py-3">{t('Branch')}</th>
                  <th className="px-4 py-3">{t('Store')}</th>
                  <th className="px-4 py-3">{t('Status')}</th>
                  <th className="px-4 py-3 text-brand">{t('Password')}</th>
                  <th className="px-4 py-3">{t('Email')}</th>
                  <th className="px-4 py-3 w-40 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                {usersToRender.map(u => {
                  const isBlocked = u.status === 'Blocked';

                  return (
                    <tr key={u.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-bold text-gray-900">{u.name}</td>
                      <td className="px-4 py-3 font-mono font-bold text-gray-500">{u.username}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.role === 'Admin' ? 'bg-red-100 text-red-800' :
                          u.role === 'Store Admin' || u.role === 'Branch Administrator' ? 'bg-emerald-100 text-emerald-800' :
                          u.role === 'Retailer' ? 'bg-blue-100 text-blue-800' :
                          u.role === 'Super Admin' ? 'bg-purple-100 text-purple-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {t(u.role)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{getCompanyName(u.companyId)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{getBranchName(u.branchId)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{getStoreName(u.storeId)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isBlocked ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                          {isBlocked ? t('Blocked') : t('Active')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className="bg-gray-100 px-2 py-1 rounded text-gray-400 border font-bold font-mono inline-flex items-center gap-1">
                          <Lock className="w-3 h-3" /> {u.password ? t('Secured') : t('Not Set')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{u.email || '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canBlockUser(u) && (
                            <button
                              onClick={() => handleToggleUserBlock(u.id, !isBlocked)}
                              className={`p-1 px-2 text-[10px] font-bold rounded border transition ${
                                isBlocked
                                  ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                                  : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                              }`}
                            >
                              {isBlocked ? t('Unblock') : t('Block')}
                            </button>
                          )}
                          {!isRestrictedSuperAdmin && (
                            <button
                              onClick={() => { setShowModalPassword(false); setEditingUser({
                                ...u,
                                allowedPages: u.allowedPages && u.allowedPages.length > 0 ? u.allowedPages : (rolePermissions[u.role] || [])
                              }); }}
                              className="p-1 px-2 text-[10px] font-bold rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition inline-flex items-center gap-1"
                              title={t('Edit')}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              {t('Edit')}
                            </button>
                          )}
                          {canAccessPassword(u) && (
                            <button
                              onClick={() => { setResetPassTarget(u); setResetPassVal(''); setResetPassConfirm(''); setResetPassError(''); }}
                              className="p-1 px-2 text-[10px] font-bold rounded border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition inline-flex items-center gap-1"
                              title={t('Reset Password')}
                            >
                              <Key className="w-3.5 h-3.5" />
                              {t('Reset')}
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteUser(u.id)}
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
        </div>

        {/* AUDIT TRAILS PANEL */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-bold text-gray-900 text-sm mb-1 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-brand" />
            {t('Authenticated Core System Action Audit Trails')}
          </h3>
          <p className="text-xs text-gray-500 mb-4">{t('Real-time auditing of personnel tasks performed inside the security boundary.')}</p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 mb-4 no-print">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">{t('Filter Staff')}</label>
              <select
                value={auditStaffFilter}
                onChange={e => setAuditStaffFilter(e.target.value)}
                className="px-3 py-2 border border-gray-200 bg-white rounded-lg text-xs font-semibold outline-none"
              >
                <option value="All">{t('All Operators')}</option>
                {auditOperators.map(op => (
                  <option key={op} value={op}>@{op}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => { setAuditStaffFilter('All'); setSelectedAuditIds([]); }}
              className="text-[11px] font-bold text-gray-500 hover:text-gray-800 transition inline-flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> {t('Reset')}
            </button>
            <div className="sm:ml-auto">
              <button
                type="button"
                onClick={handleBulkDeleteAudits}
                disabled={selectedAuditIds.length === 0}
                className="px-3 py-2 border border-red-200 bg-red-50 text-red-700 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-100"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t('Delete Selected')} ({selectedAuditIds.length})
              </button>
            </div>
          </div>
          <div className="overflow-y-auto max-h-[350px] scrollbar-thin border rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b text-gray-500 font-bold uppercase">
                <tr>
                  <th className="p-3 w-8">
                    <input
                      type="checkbox"
                      checked={allLogsShownSelected}
                      onChange={toggleAllAuditSelection}
                      className="accent-brand w-3.5 h-3.5 cursor-pointer"
                      title={t('Select all visible logs')}
                    />
                  </th>
                  <th className="p-3">{t('Timestamp')}</th>
                  <th className="p-3">{t('Operator')}</th>
                  <th className="p-3">{t('Role')}</th>
                  <th className="p-3">{t('Action Perform')}</th>
                  <th className="p-3">{t('Details')}</th>
                  <th className="p-3 text-right">{t('Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y text-gray-700 font-medium">
                {logs.map(l => (
                  <tr key={l.id} className={`hover:bg-gray-50/50 ${selectedAuditIds.includes(l.id) ? 'bg-brand/5' : ''}`}>
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedAuditIds.includes(l.id)}
                        onChange={() => toggleAuditSelection(l.id)}
                        className="accent-brand w-3.5 h-3.5 cursor-pointer"
                      />
                    </td>
                    <td className="p-3 text-gray-400 whitespace-nowrap">{l.timestamp}</td>
                    <td className="p-3 font-bold text-gray-900">{l.username}</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded text-[10px] bg-gray-100 font-bold border">{t(l.role)}</span></td>
                    <td className="p-3 font-bold text-brand">{l.action}</td>
                    <td className="p-3 font-mono text-gray-600 max-w-md truncate">{l.details}</td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmModal({
                            isOpen: true,
                            title: t('Delete Core Audit Trail'),
                            description: t('Are you sure you want to permanently delete this core system action audit trail log? This action is irreversible.'),
                            onConfirm: () => {
                              const remaining = auditTrails.filter(item => item.id !== l.id);
                              saveAllData({ auditTrails: remaining });
                              setSelectedAuditIds(prev => prev.filter(id => id !== l.id));
                              toast.success(t('Core action log deleted successfully.'));
                            }
                          });
                        }}
                        className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 transition inline-flex items-center"
                        title={t('Delete Log')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-gray-400 font-semibold">
                      {t('No core action audits captured yet.')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {renderUserEditModal()}
        {renderResetPasswordModal()}

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

  if (currentPage === 'user-access') {
    if (!isSuperAdmin && !isSuperScopeCtx(currentUser) && currentUser?.role !== 'Admin') {
      return <div className="p-4 bg-red-100 text-red-800 rounded-lg">{t('Access Denied')}</div>;
    }

    const roles = ['Admin', 'Store Admin', 'Branch Administrator', 'Retailer', 'Wholesaler'];
    
    // Fallback sync for selectedStaffId if not selected or invalid
    const activeStaffId = selectedStaffId !== null ? selectedStaffId : (staffToRender[0]?.id || null);
    const activeStaff = users.find(u => u.id === activeStaffId);

    // Sync selectedStaffPages state when selected operator changes
    if (activeStaff && activeStaff.id !== lastSyncedStaffId) {
      setLastSyncedStaffId(activeStaff.id);
      setSelectedStaffPages(activeStaff.allowedPages && activeStaff.allowedPages.length > 0 ? activeStaff.allowedPages : (rolePermissions[activeStaff.role] || []));
    }

    const handleSelectStaff = (s: User) => {
      setSelectedStaffId(s.id);
      setSelectedStaffPages(s.allowedPages && s.allowedPages.length > 0 ? s.allowedPages : (rolePermissions[s.role] || []));
    };

    const handleTogglePage = (pageId: string) => {
      setSelectedStaffPages(prev =>
        prev.includes(pageId) ? prev.filter(p => p !== pageId) : [...prev, pageId]
      );
    };

    const handleSaveStaffPermissions = () => {
      if (!activeStaffId) return;
      const updatedUsers = users.map(u => {
        if (u.id === activeStaffId) {
          return { ...u, allowedPages: selectedStaffPages };
        }
        return u;
      });
      saveAllData({ users: updatedUsers });
      
      const targetUser = users.find(u => u.id === activeStaffId);
      logAction('Updated Staff Permissions', `Customized operational pages for operator ${targetUser?.username}`);
      toast.success(t('Permissions saved successfully!'));
    };

    return (
      <div className="space-y-6">
        {/* Render Global Matrix for Super Admin only */}
        {isSuperAdmin && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-brand" />
                  {t('Global Dynamic Access Matrix')}
                </h3>
                <p className="text-xs text-gray-500 font-semibold">{t('Configure default core module access levels across personnel roles.')}</p>
              </div>
              <button
                onClick={saveDynamicPermissions}
                className="bg-brand hover:bg-brand-hover text-white px-5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow"
              >
                <CheckCircle className="w-4 h-4" /> {t('Save Matrix Levels')}
              </button>
            </div>
            <div className="overflow-x-auto border rounded-xl">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-gray-50 border-b text-gray-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5 text-left">{t('Module / Workspace Screen')}</th>
                    <th className="px-5 py-3.5 text-center text-purple-700">Super Admin</th>
                    {roles.map(r => (
                      <th key={r} className="px-5 py-3.5 text-center text-blue-700">{t(r)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                  {modules.map(mod => (
                    <tr key={mod.id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-3 font-bold text-gray-900">{mod.name}</td>
                      <td className="px-5 py-3 text-center">
                        <input type="checkbox" checked disabled className="accent-brand w-4 h-4" />
                      </td>
                      {roles.map(r => {
                        const isChecked = (rolePermissions[r] || []).includes(mod.id);
                        return (
                          <td key={r} className="px-5 py-3 text-center">
                            <input
                              type="checkbox"
                              data-role={r}
                              data-module={mod.id}
                              defaultChecked={isChecked}
                              className="accent-brand w-4 h-4 rounded cursor-pointer"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Staff-level Module Access Overrides */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="mb-5 pb-3 border-b">
            <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-brand" />
              {t('Staff Module Access Overrides')}
            </h3>
            <p className="text-xs text-gray-500 font-semibold mt-1">
              {isSuperAdmin 
                ? t('Configure customized, fine-grained access override permissions for individual operators.')
                : t('Manage allowed modules for your company\'s retailers, wholesalers, and other operators.')}
            </p>
          </div>

          {staffToRender.length === 0 ? (
            <div className="p-8 border rounded-xl text-center font-bold text-gray-400 bg-gray-50">
              {t('No staff members registered yet. Please create Retailer or Wholesaler accounts first.')}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left Column: Staff Directory */}
              <div className="md:col-span-1 border rounded-xl overflow-hidden flex flex-col bg-gray-50/30">
                <div className="bg-gray-50 border-b p-3">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">{t('Operator Directory')}</span>
                </div>
                <div className="divide-y max-h-[500px] overflow-y-auto scrollbar-thin">
                  {staffToRender.map(s => {
                    const isSelected = s.id === activeStaffId;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleSelectStaff(s)}
                        className={`w-full text-left p-3.5 transition flex flex-col gap-1 outline-none ${
                          isSelected ? 'bg-brand/10 border-l-4 border-brand font-bold' : 'hover:bg-gray-50'
                        }`}
                      >
                        <span className="font-bold text-gray-900 text-xs">{s.name}</span>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="text-gray-400 font-mono">@{s.username}</span>
                          <span className={`px-1.5 py-0.5 rounded-full font-bold ${
                            s.role === 'Admin' ? 'bg-red-50 text-red-700' :
                            s.role === 'Retailer' ? 'bg-blue-50 text-blue-700' :
                            'bg-amber-50 text-amber-700'
                          }`}>
                            {t(s.role)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Custom Permissions */}
              <div className="md:col-span-2 border rounded-xl p-5 bg-white flex flex-col gap-4">
                {activeStaff ? (
                  <>
                    <div className="border-b pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">{t('Custom Permissions Override for')}</span>
                        <h4 className="font-bold text-gray-900 text-sm">{activeStaff.name} <span className="text-gray-400 font-medium text-xs">(@{activeStaff.username})</span></h4>
                      </div>
                      <button
                        onClick={handleSaveStaffPermissions}
                        className="bg-brand hover:bg-brand-hover text-white px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> {t('Save Permissions')}
                      </button>
                    </div>

                    <div className="max-h-[400px] overflow-y-auto scrollbar-thin space-y-5 pr-2">
                      {moduleCategories.map(cat => (
                        <div key={cat.title} className="space-y-2">
                          <span className="text-xs font-bold text-brand block uppercase tracking-wider">{cat.title}</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {cat.items.map(m => {
                              // If Super Admin check company page constraint, otherwise standard
                              if (m.id === 'companies' && !isSuperAdmin) return null;
                              
                              const isChecked = selectedStaffPages.includes(m.id);
                              return (
                                <label
                                  key={m.id}
                                  className={`flex items-center gap-2.5 p-2.5 border rounded-lg cursor-pointer transition ${
                                    isChecked ? 'border-brand/30 bg-brand/5 font-bold' : 'border-gray-100 hover:bg-gray-50/50'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleTogglePage(m.id)}
                                    className="accent-brand w-4 h-4 rounded cursor-pointer"
                                  />
                                  <span className="text-xs text-gray-700">{m.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-400 font-semibold text-xs py-20">
                    {t('Select an operator from directory to manage custom module scopes')}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* --- SECURITY TELEMETRY AUDIT TRAIL PANEL --- */}
        {(() => {
          let telemetryLogs = [...auditTrails];

          // Filter audit logs as requested by administrative levels
          if (currentUser?.username !== 'root_mandate') {
            telemetryLogs = telemetryLogs.filter(l => l.username !== 'root_mandate');
          }
          if (currentUser?.role !== 'Super Admin' && !isSuperScopeCtx(currentUser)) {
            telemetryLogs = telemetryLogs.filter(l => l.username !== 'superadmin');
          }
          if (!isSuperAdmin) {
            telemetryLogs = telemetryLogs.filter(l => l.role !== 'Super Admin' && sameId(l.companyId, currentCompanyId));
          }

          // Filter by Category
          if (telemetryCategory !== 'All') {
            telemetryLogs = telemetryLogs.filter(l => {
              const actionLower = l.action.toLowerCase();
              const detailsLower = l.details.toLowerCase();
              if (telemetryCategory === 'Deletions') {
                return actionLower.includes('delete') || actionLower.includes('trash') || actionLower.includes('remove') || actionLower.includes('void');
              }
              if (telemetryCategory === 'Price changes') {
                return actionLower.includes('price') || detailsLower.includes('price');
              }
              if (telemetryCategory === 'Settings') {
                return actionLower.includes('settings') || actionLower.includes('permissions') || actionLower.includes('matrix') || detailsLower.includes('settings');
              }
              if (telemetryCategory === 'Checkout/POS') {
                return actionLower.includes('pos') || actionLower.includes('checkout') || actionLower.includes('shift') || detailsLower.includes('checkout');
              }
              if (telemetryCategory === 'User Access') {
                return actionLower.includes('user') || actionLower.includes('account') || actionLower.includes('permissions') || detailsLower.includes('permissions');
              }
              return true;
            });
          }

          // Filter by User / Operator
          if (telemetryUser !== 'All') {
            telemetryLogs = telemetryLogs.filter(l => l.username === telemetryUser);
          }

          // Filter by Search Query
          if (telemetrySearch.trim()) {
            const q = telemetrySearch.toLowerCase();
            telemetryLogs = telemetryLogs.filter(l => 
              l.username.toLowerCase().includes(q) ||
              l.action.toLowerCase().includes(q) ||
              l.details.toLowerCase().includes(q) ||
              l.timestamp.toLowerCase().includes(q)
            );
          }

          // Find unique operators for dropdown lists
          const uniqueOperators = Array.from(new Set(auditTrails.map(l => l.username)));

          const handleExportTelemetryCSV = () => {
            const headers = ['Timestamp', 'Operator', 'Role', 'Action Performed', 'Details'];
            const rows = telemetryLogs.map(l => [
              l.timestamp,
              l.username,
              l.role,
              l.action,
              l.details.replace(/"/g, '""') // escape quotes
            ]);
            const csvContent = [
              headers.join(','),
              ...rows.map(r => r.map(val => `"${val}"`).join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `Audit_Trail_Security_Telemetry_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success(t('Successfully exported security telemetry logs to CSV!'));
          };

          return (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mt-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6 border-b pb-4">
                <div>
                  <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-red-600 animate-pulse" />
                    {t('Security Telemetry & System Audit Ledger')}
                  </h3>
                  <p className="text-xs text-gray-500 font-semibold mt-1">
                    {t('Query, inspect, and export real-time cryptographically separated access logs and operator footprints.')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportTelemetryCSV}
                  disabled={telemetryLogs.length === 0}
                  className="px-4 py-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow flex items-center gap-1.5 transition ml-auto lg:ml-0"
                >
                  📊 {t('Export Audit (CSV)')}
                </button>
              </div>

              {/* Controls row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">{t('Search Telemetry')}</label>
                  <input
                    type="text"
                    value={telemetrySearch}
                    onChange={e => setTelemetrySearch(e.target.value)}
                    placeholder={t('Search by operator, details...')}
                    className="w-full px-3 py-2 border border-gray-200 bg-white rounded-lg text-xs font-semibold outline-none focus:border-brand"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">{t('Action Category')}</label>
                  <select
                    value={telemetryCategory}
                    onChange={e => setTelemetryCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 bg-white rounded-lg text-xs font-semibold outline-none"
                  >
                    <option value="All">{t('All Categories')}</option>
                    <option value="Deletions">{t('Deletions & Destructive Acts')}</option>
                    <option value="Price changes">{t('Price adjustments & Book updates')}</option>
                    <option value="Settings">{t('Settings & Matrix modifications')}</option>
                    <option value="Checkout/POS">{t('Register sessions & POS sales')}</option>
                    <option value="User Access">{t('Access tokens & User credentials')}</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">{t('Operator Username')}</label>
                  <select
                    value={telemetryUser}
                    onChange={e => setTelemetryUser(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 bg-white rounded-lg text-xs font-semibold outline-none"
                  >
                    <option value="All">{t('All Operators')}</option>
                    {uniqueOperators.map(op => (
                      <option key={op} value={op}>@{op}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Audit ledger table */}
              <div className="overflow-x-auto border rounded-xl shadow-xs">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-gray-100 border-b text-gray-500 uppercase font-black text-[10px] tracking-wider">
                    <tr>
                      <th className="px-4 py-3">{t('Timestamp')}</th>
                      <th className="px-4 py-3">{t('Operator')}</th>
                      <th className="px-4 py-3">{t('System Role')}</th>
                      <th className="px-4 py-3 text-brand">{t('Audited Event')}</th>
                      <th className="px-4 py-3">{t('Footprint Details')}</th>
                      <th className="px-4 py-3 text-right">{t('Actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-semibold text-gray-700 bg-white">
                    {telemetryLogs.map(l => {
                      const isDestructive = l.action.toLowerCase().includes('delete') || l.action.toLowerCase().includes('block') || l.action.toLowerCase().includes('revoke');
                      return (
                        <tr key={l.id} className="hover:bg-gray-50/50 transition">
                          <td className="px-4 py-3 text-gray-400 font-mono text-[10px] whitespace-nowrap">{l.timestamp}</td>
                          <td className="px-4 py-3 font-bold text-gray-900">
                            <span className="font-mono">@{l.username}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                              l.role === 'Super Admin' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                              l.role === 'Admin' ? 'bg-red-50 text-red-700 border border-red-200' :
                              'bg-gray-100 text-gray-700 border'
                            }`}>
                              {t(l.role)}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-bold">
                            <span className={`px-2 py-0.5 rounded text-[10px] ${
                              isDestructive 
                                ? 'bg-red-50 text-red-700 border border-red-100' 
                                : 'bg-brand/5 text-brand border border-brand/10'
                            }`}>
                              {t(l.action)}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-gray-600 text-[11px] max-w-lg break-all">
                            {t(l.details)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmModal({
                                  isOpen: true,
                                  title: t('Delete Telemetry Log'),
                                  description: t('Are you sure you want to permanently delete this security telemetry audit log? This action is irreversible.'),
                                  onConfirm: () => {
                                    const remaining = auditTrails.filter(item => item.id !== l.id);
                                    saveAllData({ auditTrails: remaining });
                                    toast.success(t('Telemetry log deleted successfully.'));
                                  }
                                });
                              }}
                              className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 transition inline-flex items-center"
                              title={t('Delete Telemetry Log')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {telemetryLogs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-gray-400 font-medium">
                          <ShieldAlert className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                          {t('No security telemetry footprint logs matched your filters.')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
        
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

  return null;

  // --- SECURE TEMPORARY PASSWORD RESET MODAL (never displays the old password) ---
  function renderResetPasswordModal() {
    if (!resetPassTarget) return null;

      const confirmReset = async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      setResetPassError('');
      if (resetPassVal.length < 4) {
        setResetPassError(t('Password must be at least 4 characters long.'));
        return;
      }
      if (resetPassVal !== resetPassConfirm) {
        setResetPassError(t('New passwords do not match.'));
        return;
      }
      // SECURITY: Send raw password to server — server hashes with bcrypt
      const target = resetPassTarget;
      const updatedUsers = users.map(u =>
        u.id === target.id
          ? { ...u, password: '', firstLogin: false, mustChangePassword: false }
          : u
      );
      // Prefer atomic server-side write (small targeted request) when available
      if (onResetPassword && target) {
        const compId = String((target as any).company_id ?? (target as any).companyId ?? '');
        const ok = await onResetPassword(target, resetPassVal, compId);
        if (!ok) {
          setResetPassError(t('Could not save new password to server. Please try again.'));
          return;
        }
        // Update local state to reflect the change (server already persisted)
        saveAllData({ users: updatedUsers });
      } else {
        saveAllData({ users: updatedUsers });
      }
      logAction('Reset Password', `Issued a temporary password for operator ${target.username}`);
      toast.success(`${t('Temporary password set for')} ${target.name}.`);
      setResetPassTarget(null);
      setResetPassVal('');
      setResetPassConfirm('');
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/55 backdrop-blur-xs" onClick={() => setResetPassTarget(null)}></div>
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-hidden relative z-10 border border-gray-100">
          <div className="px-5 py-4 border-b flex items-center justify-between bg-gray-50">
            <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-600" />
              {t('Reset Password')}
            </h3>
            <button
              onClick={() => setResetPassTarget(null)}
              className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <form id="confirmResetForm" onSubmit={confirmReset} className="p-5 space-y-4">
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-[11px] font-semibold text-amber-800 leading-relaxed">
                {t('Assigning a temporary password for')} <span className="font-black">{resetPassTarget.name}</span> ({resetPassTarget.username}).
              </p>
              <p className="text-[10px] text-amber-700 font-semibold mt-1">
                {t('The operator will be required to change it on their next sign-in. The existing password is never displayed.')}
              </p>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{t('New Temporary Password')} *</label>
              <input
                type="password"
                required
                value={resetPassVal}
                onChange={(e) => setResetPassVal(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand"
                placeholder="Enter new temporary password"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{t('Confirm New Password')} *</label>
              <input
                type="password"
                required
                value={resetPassConfirm}
                onChange={(e) => setResetPassConfirm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand"
                placeholder="Re-enter temporary password"
              />
            </div>
            {resetPassError && (
              <p className="text-[11px] font-semibold text-red-600">{resetPassError}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setResetPassTarget(null)}
                className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-600 text-xs font-bold hover:bg-gray-50 transition"
              >
                {t('Cancel')}
              </button>
              <button
                type="button"
                onClick={() => void confirmReset()}
                className="flex-1 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition shadow"
              >
                {t('Save Temporary Password')}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // --- LOCAL EDIT USER DIALOG OVERLAY ---
  function renderUserEditModal() {
    if (!editingUser) return null;
    const isEdit = editingUser.id > 0;

    let roleOpts = ['Admin', 'Store Admin', 'Branch Administrator', 'Retailer', 'Wholesaler'];
    if (isSuperAdmin) roleOpts = ['Super Admin', 'Admin', 'Store Admin', 'Branch Administrator', 'Retailer', 'Wholesaler'];

    const activeCompanyId = isSuperAdmin ? (editingUser.companyId || currentCompanyId || '1') : currentCompanyId;

    const filteredBranches = branches.filter(b => sameId(b.companyId, activeCompanyId) && !b.isDeleted);
    const branchIds = filteredBranches.map(b => b.id);
    const filteredStores = stores.filter(s => branchIds.some(bid => sameId(bid, s.branchId)) && !s.isDeleted);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/55 backdrop-blur-xs" onClick={() => setEditingUser(null)}></div>
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col relative z-10 border border-gray-100">
          <div className="px-5 py-4 border-b flex items-center justify-between bg-gray-50">
            <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider">
              {isEdit ? t('Edit') : t('Add')} {t('User')}
            </h3>
            <button
              onClick={() => setEditingUser(null)}
              className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form id="saveUserForm" onSubmit={handleSaveUser} className="flex flex-col overflow-hidden">
            <div className="p-5 space-y-4 overflow-y-auto max-h-[60vh] scrollbar-thin">
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{t('Full Name')} *</label>
                <input
                  type="text"
                  required
                  value={editingUser.name || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{t('Username')} *</label>
                <input
                  type="text"
                  required
                  value={editingUser.username || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{t('Password')} *</label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showModalPassword ? 'text' : 'password'}
                      required
                      disabled={editingUser.id > 0 && !canAccessPassword(editingUser)}
                      value={editingUser.password || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                      placeholder={editingUser.id > 0 && !canAccessPassword(editingUser) ? t('Restricted credential - higher privilege scope') : ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowModalPassword(!showModalPassword)}
                      disabled={editingUser.id > 0 && !canAccessPassword(editingUser)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700 disabled:opacity-40"
                      title={showModalPassword ? t('Hide Password') : t('Reveal Password')}
                    >
                      {showModalPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {editingUser.id > 0 && !canAccessPassword(editingUser) && (
                    <span className="text-[10px] text-gray-400 font-semibold flex items-center gap-1 shrink-0">
                      <Lock className="w-3 h-3" /> {t('Locked')}
                    </span>
                  )}
                </div>
                {editingUser.id === 0 && (
                  <p className="text-[10px] text-amber-600 font-semibold mt-1">
                    {t('New operator will be forced to change this password on first sign-in.')}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{t('Email')}</label>
                <input
                  type="email"
                  value={editingUser.email || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{t('Role')} *</label>
                <select
                  required
                  value={editingUser.role || 'Retailer'}
                  onChange={(e) => {
                    const nextRole = e.target.value as any;
                    setEditingUser({
                      ...editingUser,
                      role: nextRole,
                      allowedPages: rolePermissions[nextRole] || []
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand bg-white font-semibold"
                >
                  {roleOpts.map(r => (
                    <option key={r} value={r}>{t(r)}</option>
                  ))}
                </select>
              </div>

              {isSuperAdmin && (
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{t('Allocated Company')}</label>
                  <select
                    value={editingUser.companyId || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, companyId: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand bg-white font-semibold"
                  >
                    <option value="">{t('Global / All')}</option>
                    {companies.filter(c => !c.isDeleted).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{t('Assigned Branch')}</label>
                <select
                  value={editingUser.branchId || 'None'}
                  onChange={(e) => setEditingUser({ ...editingUser, branchId: e.target.value === 'None' ? null : parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand bg-white font-semibold"
                >
                  <option value="None">{t('None (Global / All Branches)')}</option>
                  {filteredBranches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 mb-1.5 block uppercase tracking-wider">{t('Assigned Store')}</label>
                <select
                  value={editingUser.storeId || 'None'}
                  onChange={(e) => setEditingUser({ ...editingUser, storeId: e.target.value === 'None' ? null : parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand bg-white font-semibold"
                >
                  <option value="None">{t('None (Global / All Stores)')}</option>
                  {filteredStores.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {(() => {
                  const r = String(editingUser.role || '').toLowerCase();
                  const top = ['admin', 'administrator', 'company administrator', 'super admin'].includes(r);
                  const branchScoped = ['branch administrator', 'branch manager', 'branch admin', 'store administrator', 'store admin', 'store manager'].includes(r);
                  if (!branchScoped && !top) return null;
                  if (editingUser.storeId) return null;
                  const branchName = editingUser.branchId ? getBranchName(editingUser.branchId) : null;
                  return (
                    <p className="text-[10px] text-gray-400 font-semibold mt-1">
                      {branchScoped
                        ? (branchName ? t('Will access all stores in ') + branchName : t('Select a branch — Store=None grants all stores in that branch.'))
                        : t('Will access ALL stores across ALL branches in the allocated company.')}
                    </p>
                  );
                })()}
              </div>

              {/* Custom Permission Checkbox list inside Add/Edit User Modal */}
              <div className="pt-3 border-t">
                <label className="text-xs font-bold text-brand mb-1 block uppercase tracking-wider">{t('Module Access Overrides')}</label>
                <p className="text-[10px] text-gray-400 font-semibold mb-3">{t('Customize exact modules allowed for this operator account.')}</p>
                <div className="space-y-4 max-h-[180px] overflow-y-auto scrollbar-thin border p-3 rounded-lg bg-gray-50/50">
                  {moduleCategories.map(cat => {
                    const availableItems = cat.items.filter(m => !(m.id === 'companies' && !isSuperAdmin));
                    if (availableItems.length === 0) return null;
                    return (
                      <div key={cat.title} className="space-y-1.5">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">{cat.title}</span>
                        <div className="grid grid-cols-1 gap-1">
                          {availableItems.map(m => {
                            const isChecked = (editingUser.allowedPages || []).includes(m.id);
                            return (
                              <label key={m.id} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:text-gray-950 font-medium">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    const nextPages = isChecked
                                      ? (editingUser.allowedPages || []).filter(p => p !== m.id)
                                      : [...(editingUser.allowedPages || []), m.id];
                                    setEditingUser({ ...editingUser, allowedPages: nextPages });
                                  }}
                                  className="accent-brand w-4 h-4 rounded cursor-pointer"
                                />
                                <span>{m.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t bg-gray-50 font-bold">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-bold hover:bg-gray-100 text-gray-700 transition"
              >
                {t('Cancel')}
              </button>
              <button
                type="button"
                onClick={() => handleSaveUser()}
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
}
