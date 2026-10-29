import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, Company, Branch, Store, Settings, AppNotification } from '../types';
import { translate } from '../utils/format';
import { getStoredLanguage } from '../utils/i18n';
import LanguageSwitcher from '../utils/LanguageSwitcher';
import { Settings as SettingsIcon, Menu, Bell, Sun, Moon, Store as StoreIcon, Globe, Printer, ShoppingCart, HandCoins, Star, MessageSquare, CheckCheck, ExternalLink } from 'lucide-react';
import { isBluetoothPrinterConnected } from '../utils/escposPrinter';
import SyncStatusDot from './SyncStatusDot';
import { sameId } from '../utils/idUtils';

interface HeaderProps {
  currentPage: string;
  currentUser: User | null;
  companies: Company[];
  branches: Branch[];
  stores: Store[];
  currentCompanyId: string | number | null;
  currentBranchId: string | number | null;
  currentStoreId: string | number | null;
  settings: Settings;
  globalView?: boolean;
  onContextChange: (level: 'company' | 'branch' | 'store', val: number | string) => void;
  onOpenSettings: () => void;
  onToggleMobileSidebar: () => void;
  pageTitle: string;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenGame?: () => void;
  onNavigate?: (page: string) => void;
  language: 'en' | 'sw' | 'fr' | 'es';
  onLanguageChange?: (lang: 'en' | 'sw' | 'fr' | 'es') => void;
  appNotifications?: AppNotification[];
  onMarkNotificationRead?: (id: number) => void;
  onMarkAllNotificationsRead?: (companyId: number | string | null) => void;
}

// SUPER-ADMIN GLOBAL SCOPE: true for the root accounts and any company-less super role
// ('Super Admin' / 'superadmin' / 'super_admin'). A global super admin is NEVER a
// single-company operator — every selector below must treat them as cross-company.
const isSuperScopeUser = (u: User | null): boolean =>
  !!u && (u.isRoot === true || u.username === 'root_mandate' || u.username === 'superadmin' ||
    ['Super Admin', 'superadmin', 'super_admin', 'super admin'].includes(String(u.role || '').trim()));

export default function Header({
  currentPage,
  currentUser,
  companies,
  branches,
  stores,
  currentCompanyId,
  currentBranchId,
  currentStoreId,
  settings,
  globalView,
  onContextChange,
  onOpenSettings,
  onToggleMobileSidebar,
  pageTitle,
  theme,
  onToggleTheme,
  onOpenGame,
  onNavigate,
  language,
  onLanguageChange,
  appNotifications = [],
  onMarkNotificationRead,
  onMarkAllNotificationsRead
}: HeaderProps) {
  const isSuperAdmin = isSuperScopeUser(currentUser);
  const isAdmin = currentUser?.role === 'Admin' || isSuperAdmin;
  const userInitial = (currentUser?.name?.[0] || currentUser?.username?.[0] || 'U').toUpperCase();

  const [showNotifDropdown, setShowNotifDropdown] = useState<boolean>(false);
  const notifDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target as Node)) {
        setShowNotifDropdown(false);
      }
    };
    if (showNotifDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifDropdown]);

  // Company-isolated notifications (Super admin in global view sees all)
  const companyNotifications = useMemo(() => {
    return (appNotifications || []).filter(n => {
      if (isSuperAdmin && (currentCompanyId === 0 || currentCompanyId === '0' || !currentCompanyId)) return true;
      if (!currentCompanyId) return true;
      return n.companyId != null && sameId(n.companyId, currentCompanyId);
    });
  }, [appNotifications, isSuperAdmin, currentCompanyId]);

  const unreadNotifs = useMemo(() => companyNotifications.filter(n => !n.isRead), [companyNotifications]);
  const unreadCount = unreadNotifs.length;

  const formatRelativeTime = (dateStr?: string): string => {
    if (!dateStr) return '';
    try {
      const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
      if (diffSec < 45) return 'Sasa hivi';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `Dakika ${diffMin} zilizopita`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `Saa ${diffHours} zilizopita`;
      const diffDays = Math.floor(diffHours / 24);
      return `Siku ${diffDays} zilizopita`;
    } catch {
      return dateStr;
    }
  };

  // GLOBAL VIEW (ALL COMPANIES): when a global super admin activates it, the company,
  // branch and store selectors aggregate across EVERY company in the system.
  const inGlobalView = !!globalView && isSuperAdmin;

  const activeComp = companies.find(c => sameId(c.id, currentCompanyId));
  const activeCompCurrency = activeComp?.currency || settings.companyCurrencies?.[currentCompanyId || 1] || settings.currency || 'USD';
  // Tenant-isolated language: company preference, otherwise the browser's
  // stored site language (what the visitor picked on the marketplace homepage).
  const activeCompLanguage: 'en' | 'sw' | 'fr' | 'es' =
    activeComp?.language ||
    settings.companyLanguages?.[currentCompanyId || 1] ||
    settings.companyLanguages?.[currentUser?.companyId || 1] ||
    getStoredLanguage();
  const t = (text: string) => translate(text, activeCompLanguage);

  // Filter available options based on hierarchy and soft-deleted status.
  // Global View aggregates branches/stores across ALL companies (grouped by company).
  const availableCompanies = (isSuperAdmin 
    ? companies 
    : companies.filter(c => sameId(c.id, currentCompanyId))
  ).filter(c => !c.isDeleted);

  const availableBranches = (inGlobalView
    ? branches.filter(b => !b.isDeleted)
    : (isSuperAdmin 
      ? branches.filter(b => sameId(b.companyId, currentCompanyId))
      : branches.filter(b => sameId(b.companyId, (currentUser?.companyId || currentCompanyId)))
    )
  ).filter(b => !b.isDeleted);

  const [btConnected, setBtConnected] = useState<boolean>(false);

  useEffect(() => {
    const checkPrinter = () => setBtConnected(isBluetoothPrinterConnected());
    checkPrinter();

    const interval = setInterval(() => {
      checkPrinter();
    }, 3000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  let availableStores = inGlobalView
    ? stores.filter(s => !s.isDeleted)
    : stores.filter(s => {
        if (currentBranchId) return sameId(s.branchId, currentBranchId) && !s.isDeleted;
        const branch = branches.find(b => sameId(b.id, s.branchId));
        return branch && sameId(branch.companyId, (currentUser?.companyId || currentCompanyId)) && !s.isDeleted;
      });

  if (!inGlobalView && currentUser && !isSuperScopeUser(currentUser)) {
    const userCompanyBranchIds = branches
      .filter(b => sameId(b.companyId, (currentUser.companyId || currentCompanyId)) && !b.isDeleted)
      .map(b => b.id);
    availableStores = availableStores.filter(s => userCompanyBranchIds.includes(s.branchId));

    // Lock operators to assigned store ONLY if explicitly set and user is NOT Wholesaler or Admin
    const roleLower = String(currentUser.role || '').toLowerCase();
    const isUnlockedRole = roleLower === 'wholesaler' || ['admin', 'administrator', 'company administrator', 'super admin'].includes(roleLower);
    if (!isUnlockedRole) {
      if (currentUser.storeId) {
        availableStores = availableStores.filter(s => sameId(s.id, currentUser.storeId));
      } else if (currentUser.branchId) {
        // Store=None → Branch/Store administrators access ALL stores in their branch.
        availableStores = availableStores.filter(s => sameId(s.branchId, currentUser.branchId));
      }
    }
  }

  // --- SUBSCRIPTION / DEMO ALERT BANNERS ---
  const activeUserCompany = companies.find(c => sameId(c.id, (currentCompanyId || currentUser?.companyId)));
  const isDemoCompany = !!activeUserCompany?.isDemo;
  const subDaysLeft = activeUserCompany?.subscriptionEnd
    ? Math.ceil((new Date(activeUserCompany.subscriptionEnd + 'T23:59:59').getTime() - Date.now()) / 86400000)
    : null;
  const demoDaysLeft = activeUserCompany?.demoExpiresAt
    ? Math.ceil((new Date(activeUserCompany.demoExpiresAt).getTime() - Date.now()) / 86400000)
    : null;
  const showExpiryAlert = !isDemoCompany && subDaysLeft !== null && subDaysLeft >= 0 && subDaysLeft <= 7;
  const showDemoAlert = isDemoCompany && demoDaysLeft !== null && demoDaysLeft >= 0;
  const canOpenSubscriptions = onNavigate && currentUser?.role === 'Super Admin';

  return (
    <>
      {showExpiryAlert && (
        <div className="no-print flex items-center justify-between gap-3 px-4 py-1.5 bg-amber-400 text-amber-950 text-[11px] font-black">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-900 animate-pulse"></span>
            {t('Subscription expires in')} {subDaysLeft} {subDaysLeft === 1 ? t('day') : t('days')} — {activeUserCompany?.subscriptionEnd}
          </span>
          <div className="flex items-center gap-3 shrink-0">
            {canOpenSubscriptions && (
              <button
                onClick={() => onNavigate && onNavigate('subscriptions')}
                className="px-2.5 py-0.5 bg-amber-900 text-amber-50 rounded-full hover:bg-black transition text-[10px] font-black uppercase"
              >
                {t('Renew Now')}
              </button>
            )}
            <a href="mailto:globaltradecore@gmail.com" className="underline font-bold">{t('Contact Admin')}</a>
          </div>
        </div>
      )}

      {showDemoAlert && (
        <div className="no-print flex items-center justify-between gap-3 px-4 py-1.5 bg-emerald-500 text-emerald-950 text-[11px] font-black">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-900 animate-pulse"></span>
            {t('Free demo expires in')} {demoDaysLeft} {demoDaysLeft === 1 ? t('day') : t('days')} — {activeUserCompany?.demoExpiresAt?.split('T')[0]}
          </span>
          <span className="text-[10px] font-bold">{t('Subscribe to continue after demo')}</span>
        </div>
      )}

      <header className="min-h-[56px] md:h-[56px] bg-brand text-white flex flex-col md:flex-row md:items-center px-3 lg:px-5 py-2 md:py-0 gap-2 md:gap-3 shadow-sm flex-shrink-0 z-20 no-print">
      <div className="flex items-center justify-between w-full md:w-auto flex-1 md:flex-none">
        <div className="flex items-center gap-3">
          {/* Mobile Toggle Button */}
          <button
            onClick={onToggleMobileSidebar}
            className="lg:hidden p-1.5 hover:bg-white/10 rounded"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Page Title */}
          <h1 className="font-semibold text-[15px] lg:text-base truncate">
            {t(pageTitle)}
          </h1>
        </div>

        {/* Mobile controls */}
        <div className="flex items-center gap-2 md:hidden">
          {/* Mobile Notification Bell */}
          <button
            onClick={() => setShowNotifDropdown(!showNotifDropdown)}
            type="button"
            className="relative w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition text-white"
            title={unreadCount > 0 ? `${unreadCount} unread notification(s)` : t('Notifications')}
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black rounded-full h-3.5 min-w-[14px] px-0.5 flex items-center justify-center animate-pulse border border-white/40 shadow-xs">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Global Theme Toggle Button */}
          <button
            onClick={onToggleTheme}
            type="button"
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition text-white"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-slate-100" />}
          </button>

          {/* User Name & Settings Pill for Mobile */}
          <div className="flex items-center gap-1.5 text-xs bg-white/15 px-2 py-1 rounded-full font-semibold border border-white/15">
            <div
              className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 font-black text-white text-[11px] flex items-center justify-center shadow-xs shrink-0 border border-white/30"
            >
              {userInitial}
            </div>
            <span className="text-white font-bold truncate max-w-[80px]">{currentUser?.username || currentUser?.name || 'User'}</span>
            {isAdmin && (
              <button
                onClick={onOpenSettings}
                type="button"
                className="p-1 rounded-full bg-white/20 hover:bg-white/40 transition text-white shrink-0"
                title={t('System Settings')}
              >
                <SettingsIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 ml-auto w-full md:w-auto justify-between md:justify-end">
        {/* Dynamic Context Selector Hub */}
        <div className="flex items-center gap-1.5 bg-white/10 rounded-lg p-1 border border-white/20 text-xs text-white w-full md:w-auto overflow-x-auto whitespace-nowrap scrollbar-none max-w-full shrink-0">
          {/* Company Context Select */}
          {isSuperAdmin && (
            <select
              value={inGlobalView ? 0 : (currentCompanyId || '')}
              onChange={(e) => onContextChange('company', e.target.value)}
              className="bg-transparent text-white text-xs px-2 py-1 outline-none border-none cursor-pointer font-medium shrink-0"
            >
              {inGlobalView ? (
                <option key="__hdr_global_view__" value={0} className="text-gray-900 bg-white font-bold">{t('Global View (All Companies)')}</option>
              ) : (
                <>
                  {isSuperAdmin && (
                    <option key="__hdr_super_global__" value={0} className="text-gray-900 bg-white font-bold">{t('Global View (All Companies)')}</option>
                  )}
                  {availableCompanies.map((c, cIdx) => (
                    <option key={c.id != null ? `hdr-co-${c.id}-${cIdx}` : `hdr-co-${cIdx}`} value={c.id} className="text-gray-900 bg-white font-medium">{c.name}</option>
                  ))}
                </>
              )}
            </select>
          )}

          {/* Branch Context Select */}
          {(isAdmin || currentUser?.role === 'Wholesaler') && (
            <select
              value={currentBranchId || ''}
              onChange={(e) => onContextChange('branch', e.target.value)}
              className="bg-transparent text-white text-xs px-2 py-1 outline-none border-none cursor-pointer font-medium shrink-0"
            >
              {availableBranches.map((b, bIdx) => (
                <option key={b.id != null ? `hdr-br-${b.id}-${bIdx}` : `hdr-br-${bIdx}`} value={b.id} className="text-gray-900 bg-white font-medium">{b.name}</option>
              ))}
            </select>
          )}

          {/* Store Context Select Pills Container (Always shown with mobile horizontal scroll) */}
          <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-thin max-w-full shrink-0 py-0.5">
            <StoreIcon className="w-3.5 h-3.5 text-emerald-300 shrink-0 ml-1" />
            {availableStores.map((s, sIdx) => (
              <button
                key={s.id != null ? `hdr-st-${s.id}-${sIdx}` : `hdr-st-${sIdx}`}
                type="button"
                onClick={() => onContextChange('store', s.id)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition shrink-0 whitespace-nowrap ${
                  sameId(s.id, currentStoreId)
                    ? 'bg-emerald-500 text-white shadow-xs border border-emerald-400'
                    : 'bg-white/10 hover:bg-white/20 text-gray-200'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>

          {/* Sync Status Dot — minimal icon-only fallback so connectivity stays
              visible on every page without crowding the selector hub. */}
          <div className="hidden md:flex items-center shrink-0 pl-1.5 border-l border-white/20">
            <SyncStatusDot t={t} />
          </div>
        </div>

        {/* Desktop-only action controls & user status badge */}
        <div className="hidden md:flex items-center gap-2.5 shrink-0">
          {/* Bluetooth Thermal Printer Indicator */}
          {btConnected && (
            <div className="flex items-center gap-1 text-[11px] bg-blue-500/20 text-blue-200 border border-blue-400/30 px-2 py-1 rounded-full font-bold">
              <Printer className="w-3.5 h-3.5 text-blue-300" />
              <span>{t('Printer Connected')}</span>
            </div>
          )}

          {/* Company-Independent Currency & Language Badge */}
          <button
            type="button"
            onClick={onOpenSettings}
            className="hidden sm:flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 transition cursor-pointer px-2.5 py-1 rounded-full border border-white/15 text-emerald-200 shrink-0 font-extrabold"
            title={t('Click to edit Company Independent Currency & Language')}
          >
            <Globe className="w-3.5 h-3.5 text-emerald-300" />
            <span>{activeCompCurrency}</span>
            <span className="opacity-40">•</span>
            <span className="uppercase">{activeCompLanguage}</span>
          </button>

          {/* Language Switcher — lets each admin user work in their preferred language */}
          {onLanguageChange && (
            <LanguageSwitcher language={language} onChange={onLanguageChange} dark={true} />
          )}

          {/* Notification Bell Button with Unread Badge */}
          <div className="relative">
            <button
              onClick={() => setShowNotifDropdown(!showNotifDropdown)}
              type="button"
              className="relative w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition text-white"
              title={unreadCount > 0 ? `${unreadCount} unread notification(s)` : t('Notifications')}
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-black rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center animate-pulse shadow-xs border border-white/40">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          </div>

          {/* Global Theme Toggle Button */}
          <button
            onClick={onToggleTheme}
            type="button"
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition text-white"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-slate-100" />}
          </button>

          {/* User Profile Badge with Avatar Letter, Name, Role & System Settings Icon beside User Name */}
          <div className="flex items-center gap-2 text-xs bg-white/10 px-2.5 py-1 rounded-full font-semibold border border-white/15">
            <div
              className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 font-black text-white text-xs flex items-center justify-center shrink-0 border border-white/30 select-none"
              title={currentUser?.username || currentUser?.name || 'User'}
            >
              {userInitial}
            </div>
            <div className="flex flex-col text-left">
              <span className="text-white font-bold leading-tight">{currentUser?.username || currentUser?.name || 'User'}</span>
              <span className="text-gray-200 text-[10px] leading-tight font-medium">{currentUser ? t(currentUser.role) : 'Offline'}</span>
            </div>
            {isAdmin && (
              <button
                onClick={onOpenSettings}
                type="button"
                className="ml-1 p-1 rounded-full bg-white/20 hover:bg-white/40 transition text-white shrink-0"
                title={t('System Settings')}
              >
                <SettingsIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notification Dropdown Drawer for Company User Alerting */}
      {showNotifDropdown && (
        <div
          ref={notifDropdownRef}
          className="absolute right-2 sm:right-6 top-14 w-[94vw] max-w-sm sm:max-w-md bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-sm tracking-tight">{t('Arifa za Mfanyabiashara')}</span>
              {unreadCount > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                  {unreadCount} {t('Mpya')}
                </span>
              )}
            </div>
            {unreadCount > 0 && onMarkAllNotificationsRead && (
              <button
                type="button"
                onClick={() => onMarkAllNotificationsRead(currentCompanyId)}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 transition cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>{t('Weka Zote Zimesomwa')}</span>
              </button>
            )}
          </div>

          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {companyNotifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-50" />
                <p className="font-medium text-slate-700">{t('Hakuna arifa mpya kwa sasa.')}</p>
                <p className="text-[10px] text-slate-400 mt-1">Matendo yote ya wanunuzi nje ya duka (maagizo mapya, nunua pamoja, lipa pole pole, maoni) yatatokea hapa kiotomatiki.</p>
              </div>
            ) : (
              companyNotifications.slice(0, 30).map((notif) => {
                const getNotifIcon = () => {
                  switch (notif.type) {
                    case 'order_update':
                      return <ShoppingCart className="w-4 h-4 text-emerald-600" />;
                    case 'deal_update':
                      return <HandCoins className="w-4 h-4 text-amber-600" />;
                    case 'installment_update':
                      return <HandCoins className="w-4 h-4 text-blue-600" />;
                    case 'offer_update':
                      return <HandCoins className="w-4 h-4 text-indigo-600" />;
                    case 'review':
                      return <Star className="w-4 h-4 text-amber-500 fill-amber-400" />;
                    case 'new_message':
                      return <MessageSquare className="w-4 h-4 text-purple-600" />;
                    default:
                      return <Bell className="w-4 h-4 text-slate-600" />;
                  }
                };

                const getBadgeBg = () => {
                  switch (notif.type) {
                    case 'order_update':
                      return 'bg-emerald-50 border-emerald-200';
                    case 'deal_update':
                      return 'bg-amber-50 border-amber-200';
                    case 'installment_update':
                      return 'bg-blue-50 border-blue-200';
                    case 'offer_update':
                      return 'bg-indigo-50 border-indigo-200';
                    case 'review':
                      return 'bg-yellow-50 border-yellow-200';
                    case 'new_message':
                      return 'bg-purple-50 border-purple-200';
                    default:
                      return 'bg-slate-50 border-slate-200';
                  }
                };

                return (
                  <div
                    key={notif.id}
                    onClick={() => {
                      if (!notif.isRead && onMarkNotificationRead) {
                        onMarkNotificationRead(notif.id);
                      }
                      if (notif.data?.url && onNavigate) {
                        onNavigate(notif.data.url);
                        setShowNotifDropdown(false);
                      }
                    }}
                    className={`p-3 text-left transition cursor-pointer flex gap-3 items-start ${
                      !notif.isRead ? 'bg-amber-50/50 hover:bg-amber-50/80' : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className={`p-2 rounded-xl border shrink-0 mt-0.5 ${getBadgeBg()}`}>
                      {getNotifIcon()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-xs truncate ${!notif.isRead ? 'font-black text-slate-900' : 'font-semibold text-slate-700'}`}>
                          {notif.title}
                        </span>
                        {!notif.isRead && (
                          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2 mt-0.5 leading-snug">
                        {notif.message}
                      </p>
                      <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                        <span>{formatRelativeTime(notif.createdAt)}</span>
                        {notif.data?.url && (
                          <span className="text-brand hover:underline font-bold flex items-center gap-0.5">
                            Fungua <ExternalLink className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
            <span className="text-[11px] text-slate-500 font-medium">
              {t('Arifa hizi zinatoka kwa wateja nje ya mfumo (Marketplace).')}
            </span>
          </div>
        </div>
      )}
    </header>
    </>
  );
}
