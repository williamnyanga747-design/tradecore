import React, { useState, useEffect, useMemo } from 'react';
import { User, Settings } from '../types';
import { translate } from '../utils/format';
import {
  LayoutDashboard, Package, ShoppingCart, Receipt, DollarSign, FileText,
  Database, FileUp, BarChart3, Users, UserCircle, LogOut, ChevronDown, Store,
  ChevronLeft, ChevronRight, Settings as SettingsIcon, Sparkles, BadgeCheck, Crown,
  Wallet, Share2, Tags, HandCoins, CalendarClock, Bike, Video, Gift, MessageCircle,
  QrCode, Mic, Landmark, Scale
} from 'lucide-react';
import PWAInstallButton from './PWAInstallButton';

interface SidebarProps {
  currentPage: string;
  currentUser: User | null;
  settings: Settings;
  allowedPages: string[];
  onNavigate: (page: string) => void;
  onLogout: () => void;
  onOpenSettings?: () => void;
  lowStockCount?: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  language?: 'en' | 'sw' | 'fr' | 'es';
  onRegisterPushSubscription?: (rec: { endpoint: string; p256dh: string; auth: string }) => void;
}

/**
 * Sidebar reads the current user from localStorage ONCE at render time.
 * This avoids re-rendering when applyData creates new object references
 * for currentUser/settings/allowedPages — the sidebar stays stable.
 */
function readStableUser(): { role: string; isRoot: boolean; username: string; companyId: string } | null {
  try {
    const raw = localStorage.getItem('tradecore_user');
    if (!raw) return null;
    const u = JSON.parse(raw);
    if (!u || typeof u !== 'object') return null;
    return {
      role: u.role || 'User',
      isRoot: u.isRoot === true || u.username === 'root_mandate' || u.username === 'superadmin',
      username: u.username || '',
      companyId: String(u.company_id ?? u.companyId ?? ''),
    };
  } catch { return null; }
}

function SidebarInner({
  currentPage,
  currentUser,
  settings,
  allowedPages,
  onNavigate,
  onLogout,
  onOpenSettings,
  lowStockCount = 0,
  isCollapsed = false,
  onToggleCollapse,
  language,
  onRegisterPushSubscription
}: SidebarProps) {
  // Read stable user from localStorage — never re-read on applyData
  const stableUser = useMemo(() => readStableUser(), []);
  const userRole = stableUser?.role ?? currentUser?.role ?? 'User';
  const isSuperAdmin = userRole === 'Super Admin';
  const isAdmin = userRole === 'Admin' || isSuperAdmin;
  const isRoot = stableUser?.isRoot ?? currentUser?.isRoot === true ?? currentUser?.username === 'root_mandate' ?? currentUser?.username === 'superadmin';

  // Use allowedPages prop (computed in App.tsx via useMemo) — this is stable
  // because App.tsx memoizes it. Only re-computes if role/permissions actually change.
  // DEFENSIVE RBAC FALLBACK (Requirement 3): if the incoming allowedPages is ever
  // empty (roles/permissions still loading), fall back to the full default operational
  // menu so core panels never unmount. This is a pure safety net — App.tsx's
  // allowedPages already guarantees a non-empty authoritative list.
  const DEFAULT_OPERATIONAL_PAGES = [
    'dashboard', 'stock-items', 'purchase-order', 'sales-order', 'expenses', 'receipts', 'ai-copilot',
    'companies', 'branches', 'stores', 'customers', 'suppliers', 'categories', 'taxes', 'exchange-rate',
    'import-stock', 'import-customers', 'import-suppliers',
    'report-transaction', 'report-financial', 'report-daily', 'report-monthly', 'report-sales', 'report-purchase',
    'report-sales-outstanding', 'report-purchase-outstanding', 'report-lowstock', 'report-po-details', 'report-shifts',
    'user-info', 'user-access',
    'marketplace-orders', 'marketplace-settings', 'profile'
  ];
  const pages = allowedPages && allowedPages.length > 0 ? allowedPages : DEFAULT_OPERATIONAL_PAGES;
  const isAllowed = (page: string) => pages.includes(page);
  const t = (text: string) => translate(text, language || settings.language || 'en');

  // Helper for submenus to check if any of their children is active
  const isMasterActive = ['companies', 'branches', 'stores', 'customers', 'suppliers', 'categories', 'taxes', 'data-recovery', 'exchange-rate'].includes(currentPage);
  const isImportActive = ['import-stock', 'import-customers', 'import-suppliers'].includes(currentPage);
  const isReportActive = ['report-transaction', 'report-financial', 'report-daily', 'report-monthly', 'report-sales', 'report-purchase', 'report-sales-outstanding', 'report-purchase-outstanding', 'report-lowstock', 'report-po-details', 'report-shifts', 'report-unit-velocity'].includes(currentPage);
  const isUserActive = ['user-info', 'user-access'].includes(currentPage);

  const [showMasters, setShowMasters] = useState(isMasterActive);
  const [showImports, setShowImports] = useState(isImportActive);
  const [showReports, setShowReports] = useState(isReportActive);
  const [showUsers, setShowUsers] = useState(isUserActive);

  // App version (from version.json emitted at deploy time) shown in the sidebar footer
  const [appVersion, setAppVersion] = useState<{ version: string; name?: string; date?: string; description?: string } | null>(null);

  // Sync accordion state on currentPage change so only the relevant submenu is expanded
  useEffect(() => {
    if (isMasterActive) {
      setShowMasters(true);
      setShowImports(false);
      setShowReports(false);
      setShowUsers(false);
    } else if (isImportActive) {
      setShowImports(true);
      setShowMasters(false);
      setShowReports(false);
      setShowUsers(false);
    } else if (isReportActive) {
      setShowReports(true);
      setShowMasters(false);
      setShowImports(false);
      setShowUsers(false);
    } else if (isUserActive) {
      setShowUsers(true);
      setShowMasters(false);
      setShowImports(false);
      setShowReports(false);
    } else {
      setShowMasters(false);
      setShowImports(false);
      setShowReports(false);
      setShowUsers(false);
    }
  }, [currentPage]);

  // Fetch app version once on mount for the sidebar footer
  useEffect(() => {
    let mounted = true;
    fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (mounted && d?.version) setAppVersion(d); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  const toggleMasters = () => {
    if (isCollapsed && onToggleCollapse) {
      onToggleCollapse();
    } else {
      const next = !showMasters;
      setShowMasters(next);
      if (next) {
        setShowImports(false);
        setShowReports(false);
        setShowUsers(false);
      }
    }
  };

  const toggleImports = () => {
    if (isCollapsed && onToggleCollapse) {
      onToggleCollapse();
    } else {
      const next = !showImports;
      setShowImports(next);
      if (next) {
        setShowMasters(false);
        setShowReports(false);
        setShowUsers(false);
      }
    }
  };

  const toggleReports = () => {
    if (isCollapsed && onToggleCollapse) {
      onToggleCollapse();
    } else {
      const next = !showReports;
      setShowReports(next);
      if (next) {
        setShowMasters(false);
        setShowImports(false);
        setShowUsers(false);
      }
    }
  };

  const toggleUsers = () => {
    if (isCollapsed && onToggleCollapse) {
      onToggleCollapse();
    } else {
      const next = !showUsers;
      setShowUsers(next);
      if (next) {
        setShowMasters(false);
        setShowImports(false);
        setShowReports(false);
      }
    }
  };

  return (
    <aside className={`${isCollapsed ? 'w-[70px]' : 'w-64'} bg-[#2d323e] text-gray-200 flex flex-col h-full flex-shrink-0 border-r border-gray-800/20 no-print transition-all duration-300`}>
      {/* Brand logo */}
      <div className={`h-[56px] bg-brand flex items-center ${isCollapsed ? 'justify-center px-1' : 'px-4'} gap-2.5 flex-shrink-0 shadow-sm transition-all duration-300`}>
        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-brand font-bold shadow-sm flex-shrink-0">T</div>
        {!isCollapsed && <span className="font-semibold text-white tracking-wide truncate">TradeCore</span>}
      </div>

      {/* Nav items list */}
      <nav className={`flex-1 overflow-y-auto py-3 ${isCollapsed ? 'px-1.5' : 'px-2.5'} scrollbar-thin text-[13px] leading-5 space-y-1 transition-all duration-300`}>
        {/* Core Pages */}
        {/* ROOT MANDATE — God Mode dashboard (visible only to the platform owner) */}
        {isRoot && isAllowed('root-dashboard') && (
          <button
            onClick={() => onNavigate('root-dashboard')}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center py-2.5' : 'gap-3 px-3 py-2'} rounded-md transition text-left mb-1 ${
              currentPage === 'root-dashboard'
                ? 'bg-gradient-to-r from-amber-500 to-brand text-white font-bold shadow'
                : 'bg-white/5 text-amber-300 hover:bg-white/15 border border-amber-400/20'
            }`}
            title={isCollapsed ? 'ROOT MANDATE' : undefined}
          >
            <Crown className="w-[18px] h-[18px] flex-shrink-0" />
            {!isCollapsed && <span>ROOT MANDATE</span>}
          </button>
        )}

        {/* ROOT — Marketplace TRA Reports (whole-platform TRA compliance) */}
        {isRoot && isAllowed('tra-reports') && (
          <button
            onClick={() => onNavigate('tra-reports')}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center py-2.5' : 'gap-3 px-3 py-2'} rounded-md transition text-left mb-1 ${
              currentPage === 'tra-reports'
                ? 'bg-gradient-to-r from-amber-500 to-brand text-white font-bold shadow'
                : 'bg-white/5 text-amber-300 hover:bg-white/15 border border-amber-400/20'
            }`}
            title={isCollapsed ? t('TRA Reports') : undefined}
          >
            <Landmark className="w-[18px] h-[18px] flex-shrink-0" />
            {!isCollapsed && <span>{t('TRA Reports')}</span>}
          </button>
        )}

        {/* ROOT — Dispute Center (ALL marketplace disputes across companies) */}
        {isRoot && (
          <button
            onClick={() => onNavigate('root-disputes')}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center py-2.5' : 'gap-3 px-3 py-2'} rounded-md transition text-left mb-1 ${
              currentPage === 'root-disputes'
                ? 'bg-gradient-to-r from-red-500 to-brand text-white font-bold shadow'
                : 'bg-white/5 text-red-300 hover:bg-white/15 border border-red-400/20'
            }`}
            title={isCollapsed ? t('Dispute Center') : undefined}
          >
            <Scale className="w-[18px] h-[18px] flex-shrink-0" />
            {!isCollapsed && <span>{t('Dispute Center')}</span>}
          </button>
        )}

        {isAllowed('dashboard') && (
          <button
            onClick={() => onNavigate('dashboard')}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center py-2.5' : 'gap-3 px-3 py-2'} rounded-md transition text-left ${
              currentPage === 'dashboard' ? 'bg-brand text-white font-bold' : 'text-gray-300 hover:bg-white/10'
            }`}
            title={isCollapsed ? t('Dashboard') : undefined}
          >
            <LayoutDashboard className="w-[18px] h-[18px] flex-shrink-0" />
            {!isCollapsed && <span>{t('Dashboard')}</span>}
          </button>
        )}

        {isAllowed('stock-items') && (
          <button
            onClick={() => onNavigate('stock-items')}
            className={`w-full relative flex items-center ${isCollapsed ? 'justify-center py-2.5' : 'justify-between px-3 py-2'} rounded-md transition text-left ${
              currentPage === 'stock-items' ? 'bg-brand text-white font-bold shadow-xs' : 'text-gray-300 hover:bg-white/10'
            }`}
            title={isCollapsed ? t('Stock Items') : undefined}
          >
            <span className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
              <Package className="w-[18px] h-[18px] flex-shrink-0" />
              {!isCollapsed && <span>{t('Stock Items')}</span>}
            </span>
            {!isCollapsed && lowStockCount > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse transition-all ${
                currentPage === 'stock-items' ? 'bg-white text-brand' : 'bg-brand text-white'
              }`}>
                {lowStockCount}
              </span>
            )}
            {isCollapsed && lowStockCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand rounded-full border border-white animate-pulse"></span>
            )}
          </button>
        )}

        {isAllowed('purchase-order') && (
          <button
            onClick={() => onNavigate('purchase-order')}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center py-2.5' : 'gap-3 px-3 py-2'} rounded-md transition text-left ${
              currentPage === 'purchase-order' ? 'bg-brand text-white font-bold' : 'text-gray-300 hover:bg-white/10'
            }`}
            title={isCollapsed ? t('Purchase Order') : undefined}
          >
            <ShoppingCart className="w-[18px] h-[18px] flex-shrink-0" />
            {!isCollapsed && <span>{t('Purchase Order')}</span>}
          </button>
        )}

        {isAllowed('sales-order') && (
          <button
            onClick={() => onNavigate('sales-order')}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center py-2.5' : 'gap-3 px-3 py-2'} rounded-md transition text-left ${
              currentPage === 'sales-order' ? 'bg-brand text-white font-bold' : 'text-gray-300 hover:bg-white/10'
            }`}
            title={isCollapsed ? t('Sales Order') : undefined}
          >
            <Receipt className="w-[18px] h-[18px] flex-shrink-0" />
            {!isCollapsed && <span>{t('Sales Order')}</span>}
          </button>
        )}

        {/* Expenses Panel (Requested Position: "ALSO EXPENSESS PANEL AFTER SALES ORDER") */}
        {isAllowed('expenses') && (
          <button
            onClick={() => onNavigate('expenses')}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center py-2.5' : 'gap-3 px-3 py-2'} rounded-md transition text-left ${
              currentPage === 'expenses' ? 'bg-brand text-white font-bold' : 'text-gray-300 hover:bg-white/10'
            }`}
            title={isCollapsed ? t('Expenses') : undefined}
          >
            <DollarSign className="w-[18px] h-[18px] flex-shrink-0" />
            {!isCollapsed && <span>{t('Expenses')}</span>}
          </button>
        )}

        {/* Receipts Panel */}
        {isAllowed('receipts') && (
          <button
            onClick={() => onNavigate('receipts')}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center py-2.5' : 'gap-3 px-3 py-2'} rounded-md transition text-left ${
              currentPage === 'receipts' ? 'bg-brand text-white font-bold' : 'text-gray-300 hover:bg-white/10'
            }`}
            title={isCollapsed ? t('Receipts') : undefined}
          >
            <FileText className="w-[18px] h-[18px] flex-shrink-0" />
            {!isCollapsed && <span>{t('Receipts')}</span>}
          </button>
        )}

        {/* Marketplace Panels (verify customer orders & manage storefront) */}
        {isAllowed('marketplace-orders') && (
          <button
            onClick={() => onNavigate('marketplace-orders')}
            className={`w-full relative flex items-center ${isCollapsed ? 'justify-center py-2.5' : 'gap-3 px-3 py-2'} rounded-md transition text-left ${
              currentPage === 'marketplace-orders' ? 'bg-brand text-white font-bold' : 'text-gray-300 hover:bg-white/10'
            }`}
            title={isCollapsed ? t('Marketplace Orders') : undefined}
          >
            <ShoppingCart className="w-[18px] h-[18px] flex-shrink-0" />
            {!isCollapsed && <span>{t('Marketplace Orders')}</span>}
          </button>
        )}
        {isAllowed('marketplace-settings') && (
          <button
            onClick={() => onNavigate('marketplace-settings')}
            className={`w-full relative flex items-center ${isCollapsed ? 'justify-center py-2.5' : 'gap-3 px-3 py-2'} rounded-md transition text-left ${
              currentPage === 'marketplace-settings' ? 'bg-brand text-white font-bold' : 'text-gray-300 hover:bg-white/10'
            }`}
            title={isCollapsed ? t('Marketplace Settings') : undefined}
          >
            <Store className="w-[18px] h-[18px] flex-shrink-0" />
            {!isCollapsed && <span>{t('Marketplace Settings')}</span>}
          </button>
        )}

        {/* Seller Wallet & Affiliate Program (earnings + M-Pesa payouts) */}
        {isAllowed('seller-wallet') && (
          <button
            onClick={() => onNavigate('seller-wallet')}
            className={`w-full relative flex items-center ${isCollapsed ? 'justify-center py-2.5' : 'gap-3 px-3 py-2'} rounded-md transition text-left ${
              currentPage === 'seller-wallet' ? 'bg-brand text-white font-bold' : 'text-gray-300 hover:bg-white/10'
            }`}
            title={isCollapsed ? t('Seller Wallet') : undefined}
          >
            <Wallet className="w-[18px] h-[18px] flex-shrink-0" />
            {!isCollapsed && <span>{t('Seller Wallet')}</span>}
          </button>
        )}
        {isAllowed('seller-phase2c') && (
          <button
            onClick={() => onNavigate('seller-phase2c')}
            className={`w-full relative flex items-center ${isCollapsed ? 'justify-center py-2.5' : 'gap-3 px-3 py-2'} rounded-md transition text-left ${
              currentPage === 'seller-phase2c' ? 'bg-brand text-white font-bold' : 'text-gray-300 hover:bg-white/10'
            }`}
            title={isCollapsed ? t('Smart Selling') : undefined}
          >
            <HandCoins className="w-[18px] h-[18px] flex-shrink-0" />
            {!isCollapsed && <span>{t('Smart Selling')}</span>}
          </button>
        )}
        {isAllowed('affiliate-program') && (
          <button
            onClick={() => onNavigate('affiliate-program')}
            className={`w-full relative flex items-center ${isCollapsed ? 'justify-center py-2.5' : 'gap-3 px-3 py-2'} rounded-md transition text-left ${
              currentPage === 'affiliate-program' ? 'bg-brand text-white font-bold' : 'text-gray-300 hover:bg-white/10'
            }`}
            title={isCollapsed ? t('Wakala Wangu') : undefined}
          >
            <Share2 className="w-[18px] h-[18px] flex-shrink-0" />
            {!isCollapsed && <span>{t('Wakala Wangu')}</span>}
          </button>
        )}
        {isAllowed('qr-code-yangu') && (
          <button
            onClick={() => onNavigate('qr-code-yangu')}
            className={`w-full relative flex items-center ${isCollapsed ? 'justify-center py-2.5' : 'gap-3 px-3 py-2'} rounded-md transition text-left ${
              currentPage === 'qr-code-yangu' ? 'bg-emerald-600 text-white font-bold' : 'text-emerald-300 hover:bg-white/10'
            }`}
            title={isCollapsed ? t('QR Code Yangu') : undefined}
          >
            <QrCode className="w-[18px] h-[18px] flex-shrink-0" />
            {!isCollapsed && <span>{t('QR Code Yangu')}</span>}
          </button>
        )}
        {isAllowed('sauti-search') && (
          <button
            onClick={() => onNavigate('sauti-search')}
            className={`w-full relative flex items-center ${isCollapsed ? 'justify-center py-2.5' : 'gap-3 px-3 py-2'} rounded-md transition text-left ${
              currentPage === 'sauti-search' ? 'bg-indigo-600 text-white font-bold' : 'text-indigo-300 hover:bg-white/10'
            }`}
            title={isCollapsed ? t('Sauti Search') : undefined}
          >
            <Mic className="w-[18px] h-[18px] flex-shrink-0" />
            {!isCollapsed && <span>{t('Sauti Search')}</span>}
          </button>
        )}

        {/* TRA Compliance — seller submits monthly EFD/TRA report */}
        {isAllowed('tra-report') && (
          <button
            onClick={() => onNavigate('tra-report')}
            className={`w-full relative flex items-center ${isCollapsed ? 'justify-center py-2.5' : 'gap-3 px-3 py-2'} rounded-md transition text-left ${
              currentPage === 'tra-report' ? 'bg-amber-500 text-white font-bold' : 'text-amber-300 hover:bg-white/10'
            }`}
            title={isCollapsed ? t('Ripoti ya TRA') : undefined}
          >
            <Landmark className="w-[18px] h-[18px] flex-shrink-0" />
            {!isCollapsed && <span>{t('Ripoti ya TRA')}</span>}
          </button>
        )}

        {/* AI Stock & Pricing Copilot */}
        {isAllowed('ai-copilot') && (
          <button
            onClick={() => onNavigate('ai-copilot')}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center py-2.5' : 'gap-3 px-3 py-2'} rounded-md transition text-left ${
              currentPage === 'ai-copilot' ? 'bg-indigo-600 text-white font-bold shadow-xs' : 'text-amber-300 hover:bg-white/10 font-semibold'
            }`}
            title={isCollapsed ? t('AI Stock Copilot') : undefined}
          >
            <Sparkles className="w-[18px] h-[18px] flex-shrink-0 text-amber-400" />
            {!isCollapsed && <span>{t('AI Stock Copilot')}</span>}
          </button>
        )}

        {/* Super Admin — Subscriptions & Payments */}
        {isSuperAdmin && (
          <button
            onClick={() => onNavigate('subscriptions')}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center py-2.5' : 'gap-3 px-3 py-2'} rounded-md transition text-left ${
              currentPage === 'subscriptions' ? 'bg-brand text-white font-bold shadow-xs' : 'text-emerald-300 hover:bg-white/10 font-semibold'
            }`}
            title={isCollapsed ? t('Subscriptions & Payments') : undefined}
          >
            <BadgeCheck className="w-[18px] h-[18px] flex-shrink-0 text-emerald-400" />
            {!isCollapsed && (
              <span className="flex items-center justify-between w-full">
                <span>{t('Subscriptions & Payments')}</span>
                <span className="text-[9px] bg-emerald-500 text-white font-black px-1.5 py-0.5 rounded-full">SA</span>
              </span>
            )}
          </button>
        )}

        {/* MASTER DATA */}
        {(isAllowed('companies') || isAllowed('branches') || isAllowed('stores') || isAllowed('customers') || isAllowed('suppliers') || isAllowed('categories') || isAllowed('taxes') || isAllowed('data-recovery') || isAllowed('exchange-rate')) && (
          <div className="pt-2">
            <button
              onClick={toggleMasters}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center py-2.5' : 'justify-between px-3 py-2'} rounded-md hover:bg-white/10 text-gray-400 hover:text-gray-200 font-semibold`}
              title={isCollapsed ? t('Master Data') : undefined}
            >
              <span className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
                <Database className="w-[18px] h-[18px] flex-shrink-0" />
                {!isCollapsed && <span>{t('Master Data')}</span>}
              </span>
              {!isCollapsed && <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showMasters ? 'rotate-180' : ''}`} />}
            </button>
            {!isCollapsed && showMasters && (
              <div className="ml-4 mt-1 border-l border-gray-700 pl-3 space-y-1">
                {isAllowed('companies') && (
                  <button
                    onClick={() => onNavigate('companies')}
                    className={`w-full text-left px-3 py-1.5 rounded transition ${
                      currentPage === 'companies' ? 'text-white font-bold' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {t('Companies')}
                  </button>
                )}
                {isAllowed('branches') && (
                  <button
                    onClick={() => onNavigate('branches')}
                    className={`w-full text-left px-3 py-1.5 rounded transition ${
                      currentPage === 'branches' ? 'text-white font-bold' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {t('Branches')}
                  </button>
                )}
                {isAllowed('stores') && (
                  <button
                    onClick={() => onNavigate('stores')}
                    className={`w-full text-left px-3 py-1.5 rounded transition ${
                      currentPage === 'stores' ? 'text-white font-bold' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {t('Store Management')}
                  </button>
                )}
                {isAllowed('customers') && (
                  <button
                    onClick={() => onNavigate('customers')}
                    className={`w-full text-left px-3 py-1.5 rounded transition ${
                      currentPage === 'customers' ? 'text-white font-bold' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {t('Customers')}
                  </button>
                )}
                {isAllowed('suppliers') && (
                  <button
                    onClick={() => onNavigate('suppliers')}
                    className={`w-full text-left px-3 py-1.5 rounded transition ${
                      currentPage === 'suppliers' ? 'text-white font-bold' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {t('Suppliers')}
                  </button>
                )}
                {isAllowed('categories') && (
                  <button
                    onClick={() => onNavigate('categories')}
                    className={`w-full text-left px-3 py-1.5 rounded transition ${
                      currentPage === 'categories' ? 'text-white font-bold' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {t('Stock Categories')}
                  </button>
                )}
                {isAllowed('taxes') && (
                  <button
                    onClick={() => onNavigate('taxes')}
                    className={`w-full text-left px-3 py-1.5 rounded transition ${
                      currentPage === 'taxes' ? 'text-white font-bold' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {t('Manage Taxes')}
                  </button>
                )}
                {isAllowed('data-recovery') && isSuperAdmin && (
                  <button
                    onClick={() => onNavigate('data-recovery')}
                    className={`w-full text-left px-3 py-1.5 rounded transition ${
                      currentPage === 'data-recovery' ? 'text-white font-bold' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    ♻️ {t('Data Recovery')}
                  </button>
                )}
                {isAllowed('exchange-rate') && (
                  <button
                    onClick={() => onNavigate('exchange-rate')}
                    className={`w-full text-left px-3 py-1.5 rounded transition ${
                      currentPage === 'exchange-rate' ? 'text-white font-bold' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    🌐 {t('Exchange Rates')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* IMPORT DATA */}
        {(isAllowed('import-stock') || isAllowed('import-customers') || isAllowed('import-suppliers')) && (
          <div>
            <button
              onClick={toggleImports}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center py-2.5' : 'justify-between px-3 py-2'} rounded-md hover:bg-white/10 text-gray-400 hover:text-gray-200 font-semibold`}
              title={isCollapsed ? t('Import Data') : undefined}
            >
              <span className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
                <FileUp className="w-[18px] h-[18px] flex-shrink-0" />
                {!isCollapsed && <span>{t('Import Data')}</span>}
              </span>
              {!isCollapsed && <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showImports ? 'rotate-180' : ''}`} />}
            </button>
            {!isCollapsed && showImports && (
              <div className="ml-4 mt-1 border-l border-gray-700 pl-3 space-y-1">
                {isAllowed('import-stock') && (
                  <button
                    onClick={() => onNavigate('import-stock')}
                    className={`w-full text-left px-3 py-1.5 rounded transition ${
                      currentPage === 'import-stock' ? 'text-white font-bold' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {t('Import Stock Items')}
                  </button>
                )}
                {isAllowed('import-customers') && (
                  <button
                    onClick={() => onNavigate('import-customers')}
                    className={`w-full text-left px-3 py-1.5 rounded transition ${
                      currentPage === 'import-customers' ? 'text-white font-bold' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {t('Import Customers')}
                  </button>
                )}
                {isAllowed('import-suppliers') && (
                  <button
                    onClick={() => onNavigate('import-suppliers')}
                    className={`w-full text-left px-3 py-1.5 rounded transition ${
                      currentPage === 'import-suppliers' ? 'text-white font-bold' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {t('Import Suppliers')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* REPORTS */}
        {(isAllowed('report-transaction') || isAllowed('report-financial') || isAllowed('report-daily') || isAllowed('report-monthly') || isAllowed('report-sales') || isAllowed('report-purchase') || isAllowed('report-sales-outstanding') || isAllowed('report-purchase-outstanding') || isAllowed('report-lowstock') || isAllowed('report-po-details') || isAllowed('report-shifts') || isAllowed('report-unit-velocity') || isAllowed('report-tax-vat') || isAllowed('report-predictive-ai')) && (
          <div>
            <button
              onClick={toggleReports}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center py-2.5' : 'justify-between px-3 py-2'} rounded-md hover:bg-white/10 text-gray-400 hover:text-gray-200 font-semibold`}
              title={isCollapsed ? t('Reports') : undefined}
            >
              <span className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
                <BarChart3 className="w-[18px] h-[18px] flex-shrink-0" />
                {!isCollapsed && <span>{t('Reports')}</span>}
              </span>
              {!isCollapsed && <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showReports ? 'rotate-180' : ''}`} />}
            </button>
            {!isCollapsed && showReports && (
              <div className="ml-4 mt-1 border-l border-gray-700 pl-3 space-y-1">
                {isAllowed('report-transaction') && (
                  <button
                    onClick={() => onNavigate('report-transaction')}
                    className={`w-full text-left px-3 py-1.5 rounded transition ${
                      currentPage === 'report-transaction' ? 'text-white font-bold text-xs' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {t('Transaction Report')}
                  </button>
                )}
                
                {/* Financial Statement Report */}
                {isAllowed('report-financial') && (
                  <button
                    onClick={() => onNavigate('report-financial')}
                    className={`w-full text-left px-3 py-1.5 rounded transition ${
                      currentPage === 'report-financial' ? 'text-white font-bold text-xs' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {t('Financial Report')}
                  </button>
                )}

                {isAllowed('report-daily') && (
                  <button
                    onClick={() => onNavigate('report-daily')}
                    className={`w-full text-left px-3 py-1.5 rounded transition ${
                      currentPage === 'report-daily' ? 'text-white font-bold text-xs' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {t('Daily Activity Report')}
                  </button>
                )}
                {isAllowed('report-monthly') && (
                  <button
                    onClick={() => onNavigate('report-monthly')}
                    className={`w-full text-left px-3 py-1.5 rounded transition ${
                      currentPage === 'report-monthly' ? 'text-white font-bold text-xs' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {t('Monthly Report')}
                  </button>
                )}
                {isAllowed('report-sales') && (
                  <button
                    onClick={() => onNavigate('report-sales')}
                    className={`w-full text-left px-3 py-1.5 rounded transition ${
                      currentPage === 'report-sales' ? 'text-white font-bold text-xs' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {t('Sales Report')}
                  </button>
                )}
                {isAllowed('report-purchase') && (
                  <button
                    onClick={() => onNavigate('report-purchase')}
                    className={`w-full text-left px-3 py-1.5 rounded transition ${
                      currentPage === 'report-purchase' ? 'text-white font-bold text-xs' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {t('Purchase Report')}
                  </button>
                )}
                {isAllowed('report-sales-outstanding') && (
                  <button
                    onClick={() => onNavigate('report-sales-outstanding')}
                    className={`w-full text-left px-3 py-1.5 rounded transition ${
                      currentPage === 'report-sales-outstanding' ? 'text-white font-bold text-xs' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {t('Sales Outstanding')}
                  </button>
                )}
                {isAllowed('report-purchase-outstanding') && (
                  <button
                    onClick={() => onNavigate('report-purchase-outstanding')}
                    className={`w-full text-left px-3 py-1.5 rounded transition ${
                      currentPage === 'report-purchase-outstanding' ? 'text-white font-bold text-xs' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {t('Purchase Outstanding')}
                  </button>
                )}
                {isAllowed('report-lowstock') && (
                  <button
                    onClick={() => onNavigate('report-lowstock')}
                    className={`w-full text-left px-3 py-1.5 rounded transition ${
                      currentPage === 'report-lowstock' ? 'text-white font-bold text-xs' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {t('Low Stock Items Report')}
                  </button>
                )}
                {isAllowed('report-po-details') && (
                  <button
                    onClick={() => onNavigate('report-po-details')}
                    className={`w-full text-left px-3 py-1.5 rounded transition ${
                      currentPage === 'report-po-details' ? 'text-white font-bold text-xs' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {t('Purchase Order Details')}
                  </button>
                )}

                {/* Tax & VAT Return Summary */}
                <button
                  onClick={() => onNavigate('report-tax-vat')}
                  className={`w-full text-left px-3 py-1.5 rounded transition ${
                    currentPage === 'report-tax-vat' ? 'text-white font-bold text-xs' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  📊 {t('Tax & VAT Return Summary')}
                </button>

                {/* AI Demand Forecasting & Fraud Detector */}
                <button
                  onClick={() => onNavigate('report-predictive-ai')}
                  className={`w-full text-left px-3 py-1.5 rounded transition flex items-center justify-between ${
                    currentPage === 'report-predictive-ai' ? 'text-white font-bold text-xs bg-indigo-600/30' : 'text-indigo-300 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-1">✨ {t('AI Predictive & Fraud')}</span>
                  <span className="text-[9px] bg-indigo-500 text-white font-black px-1.5 py-0.2 rounded-full">AI</span>
                </button>
                {isAllowed('report-shifts') && (
                  <button
                    onClick={() => onNavigate('report-shifts')}
                    className={`w-full text-left px-3 py-1.5 rounded transition ${
                      currentPage === 'report-shifts' ? 'text-white font-bold text-xs' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {t('POS Shift & Drawer Ledger')}
                  </button>
                )}
                {isAllowed('report-unit-velocity') && (
                  <button
                    onClick={() => onNavigate('report-unit-velocity')}
                    className={`w-full text-left px-3 py-1.5 rounded transition ${
                      currentPage === 'report-unit-velocity' ? 'text-white font-bold text-xs' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {t('Sub-Unit vs Bulk Velocity')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* USERS ACCREDITATIONS */}
        {isAllowed('user-info') && (
          <div>
            <button
              onClick={toggleUsers}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center py-2.5' : 'justify-between px-3 py-2'} rounded-md hover:bg-white/10 text-gray-400 hover:text-gray-200 font-semibold`}
              title={isCollapsed ? t('Manage User') : undefined}
            >
              <span className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
                <Users className="w-[18px] h-[18px] flex-shrink-0" />
                {!isCollapsed && <span>{t('Manage User')}</span>}
              </span>
              {!isCollapsed && <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showUsers ? 'rotate-180' : ''}`} />}
            </button>
            {!isCollapsed && showUsers && (
              <div className="ml-4 mt-1 border-l border-gray-700 pl-3 space-y-1">
                <button
                  onClick={() => onNavigate('user-info')}
                  className={`w-full text-left px-3 py-1.5 rounded transition ${
                    currentPage === 'user-info' ? 'text-white font-bold' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {t('User Info')}
                </button>
                {(currentUser?.role === 'Super Admin' || currentUser?.role === 'Admin') && (
                  <button
                    onClick={() => onNavigate('user-access')}
                    className={`w-full text-left px-3 py-1.5 rounded transition ${
                      currentPage === 'user-access' ? 'text-white font-bold' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {t('User Access')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* PROFILE */}
        <button
          onClick={() => onNavigate('profile')}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center py-2.5' : 'gap-3 px-3 py-2'} rounded-md transition text-left ${
            currentPage === 'profile' ? 'bg-brand text-white font-bold' : 'text-gray-300 hover:bg-white/10'
          }`}
          title={isCollapsed ? t('My Profile') : undefined}
        >
          <UserCircle className="w-[18px] h-[18px] flex-shrink-0" />
          {!isCollapsed && <span>{t('My Profile')}</span>}
        </button>

        {/* SETTING (opens the System Settings modal) */}
        {onOpenSettings && isAdmin && (
          <button
            onClick={onOpenSettings}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center py-2.5' : 'gap-3 px-3 py-2'} rounded-md transition text-left text-gray-300 hover:bg-white/10`}
            title={isCollapsed ? t('Setting') : undefined}
          >
            <SettingsIcon className="w-[18px] h-[18px] flex-shrink-0" />
            {!isCollapsed && <span>{t('Setting')}</span>}
          </button>
        )}
      </nav>

      {/* Collapse Toggle Button */}
      {onToggleCollapse && (
        <div className="p-3 border-t border-gray-700/25 flex-shrink-0 hidden md:block">
          <div className="flex justify-center mb-2">
            <PWAInstallButton
              translate={t}
              currentUserId={currentUser?.id}
              currentCompanyId={currentUser?.companyId}
              onRegisterPushSubscription={onRegisterPushSubscription}
            />
          </div>
          <button
            onClick={onToggleCollapse}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-2 px-3'} py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 rounded-md transition`}
            title={isCollapsed ? t('Expand Sidebar') : t('Collapse Sidebar')}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4 flex-shrink-0" /> : <ChevronLeft className="w-4 h-4 flex-shrink-0" />}
            {!isCollapsed && <span>{t('Collapse Sidebar')}</span>}
          </button>
        </div>
      )}

      {/* Logout bottom block */}
      <div className="p-3 border-t border-gray-700/50 flex-shrink-0">
        <button
          onClick={onLogout}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-2 px-3'} py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 rounded-md transition`}
          title={isCollapsed ? t('Logout') : undefined}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && <span>{t('Logout')}</span>}
        </button>
      </div>

      {/* App version footer */}
      {appVersion?.version && (
        <div className="px-3 pb-3 flex-shrink-0">
          <p
            className={`text-center text-[9px] font-semibold text-gray-500 ${isCollapsed ? 'truncate' : ''}`}
            title={`${appVersion.name || 'TradeCore'} v${appVersion.version}`}
          >
            {isCollapsed ? `v${appVersion.version}` : `${appVersion.name || 'TradeCore'} v${appVersion.version}`}
          </p>
        </div>
      )}
    </aside>
  );
}

/**
 * React.memo wrapper: Sidebar only re-renders when currentPage or isCollapsed
 * changes. The currentUser/settings props are ignored for memo comparison because
 * they get new object references on every applyData sync, causing the sidebar to
 * flicker. Role and permissions are read from localStorage (stable) instead of from
 * the flickering props. allowedPages IS compared because it is produced by a App.tsx
 * useMemo and is the authoritative list that drives panel visibility — always
 * including it in the comparison guarantees a permissions change or an empty→full
 * RBAC fallback re-renders the menu instead of leaving it unmounted.
 */
export default React.memo(SidebarInner, (prev, next) => {
  return prev.currentPage === next.currentPage
    && prev.isCollapsed === next.isCollapsed
    && prev.lowStockCount === next.lowStockCount
    && prev.language === next.language
    && prev.allowedPages === next.allowedPages;
});
