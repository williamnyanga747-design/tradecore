import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Company, Branch, Store, User, StockItem, PurchaseOrder, SalesOrder, Expense, Tax, Supplier, Customer, AuditTrail, SecurityLog, Settings, PosShift, StockTransfer, ContactMessage,
  SubscriptionMeta, SubscriptionPlan, PayNumbersConfig, PaymentConfirmationRequest,
  MarketplaceProduct, MarketplaceCustomer, MarketplaceOrder, MarketplaceOrderItem, MarketplaceOrderStatus, CompanyPaymentMethod, MarketplaceClick,
  Currency, TradeSubscriptionPlan, CompanySubscription, TradePlanType,
  Review, ReviewStatus, ProductView,
  SellerWallet, WalletTransaction, Withdrawal, Affiliate, AffiliateClick, AffiliateSale, AffiliateWithdrawal, SearchSynonym, PushSubscriptionRec, VoiceSearchLog, QrScanLog,
  TraReceipt, TraReceiptStatus,
  CollectionRecord, CollectionSetting, CollectionNetwork, CollectionStatus, CollectionMode, WebhookLog, AdminEarning,
  Offer, OfferMessage, GroupDeal, GroupDealParticipant, WhatsappConversation, WhatsappBotSettings, NotificationLog, NotificationKind,
  Delivery, DeliveryUpdate, DeliveryStatus, InstallmentPlan, InstallmentOrder, InstallmentPayment, InstallmentPaymentType,
  LiveStream, LiveComment, LiveStreamStatus, LiveCommentType, LoyaltyCustomer, LoyaltyTransaction, LoyaltyRedeemCode, LoyaltyTier,
  // --- MEGA BUILD: 7 ultimate features ---
  EscrowStatus, EscrowTransaction, MegaPaymentMethod,
  OfferStatus,
  ChatConversation, ChatMessage,
  VisualSearchRecord,
  ProductReturn, Dispute, DisputeMessage, ReturnReason,
  FlashSale, FlashSaleItem, AppNotification,
  BulkUploadJob, Story, StoryView, ShippingZone
} from './types';
import {
  defaultSettings, defaultRolePermissions, defaultCompanies, defaultBranches, defaultStores, defaultUsers,
  defaultCategories, defaultTaxes, defaultSuppliers, defaultCustomers, defaultStockItems, defaultPurchaseOrders,
  defaultSalesOrders, defaultExpenses, defaultAuditTrails, defaultSecurityLogs, defaultSubscriptionMeta,
  defaultMarketplaceProducts, defaultMarketplaceCustomers, defaultMarketplaceOrders,
  defaultHomepageContent, defaultSiteConfig, defaultCurrencies, defaultTradePlans,
  defaultSearchSynonyms, defaultAffiliateCommissionPercent,
  defaultOffers, defaultOfferMessages, defaultGroupDeals, defaultGroupDealParticipants,
  defaultWhatsappConversations, defaultNotificationLogs, defaultDeliveries, defaultDeliveryUpdates,
  defaultInstallmentPlans, defaultInstallmentOrders, defaultInstallmentPayments,
  defaultLiveStreams, defaultLiveComments, defaultLoyaltyCustomers, defaultLoyaltyTransactions, defaultLoyaltyRedeemCodes
} from './initialData';
import { TANZANIA_REGIONS } from './utils/regions';
import ChartErrorBoundary from './ChartErrorBoundary';
import PanelErrorBoundary from './PanelErrorBoundary';

// Modular Components
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Homepage from './components/Homepage';
import RegisterCompany from './components/RegisterCompany';
import PendingVerificationScreen, { PendingVerificationData } from './components/PendingVerificationScreen';
import { goldenBrandStyle, GoldenTopLine, PublicThemeToggle, GOLD } from './utils/publicTheme';
import SubscriptionManagementPanel from './components/SubscriptionManagementPanel';
import ResubmitPaymentModal from './components/ResubmitPaymentModal';
import DemoSetupModal from './components/DemoSetupModal';
import Expenses from './components/Expenses';
import Receipts from './components/Receipts';
import FinancialReport from './components/FinancialReport';
import MasterData from './components/MasterData';
import ImportData from './components/ImportData';
import Reports from './components/Reports';
import ManageUsers from './components/ManageUsers';
import Profile from './components/Profile';
import AICopilot from './components/AICopilot';
import AuthPasswordReset from './components/AuthPasswordReset';
import POSModal from './components/POSModal';
import PurchaseOrderModal from './components/PurchaseOrderModal';
import ArcadeGameModal from './components/ArcadeGameModal';
import { ConfirmActionModal } from './components/ConfirmActionModal';
import MarketplaceApp from './components/marketplace/MarketplaceApp';
import MarketplaceOrdersPanel from './components/MarketplaceOrdersPanel';
import MarketplaceSettingsPanel from './components/MarketplaceSettingsPanel';
import RootMandatePanel from './components/RootMandatePanel';
import SellerWalletPanel from './components/SellerWalletPanel';
import SellerPhase2CPanel from './components/SellerPhase2CPanel';
import AffiliateProgramPanel from './components/AffiliateProgramPanel';
import PWAInstallButton from './components/PWAInstallButton';
import CompanyQrPanel from './components/CompanyQrPanel';
import VoiceSearchStatsPanel from './components/VoiceSearchStatsPanel';
import TraReportPanel from './components/TraReportPanel';
import RootTraReportsPanel from './components/RootTraReportsPanel';
// --- MEGA BUILD: 7 ultimate features ---
import MegaChat from './components/marketplace/MegaChat';
import MegaVisualSearch from './components/marketplace/MegaVisualSearch';
import { StoriesBar } from './components/marketplace/MegaStories';
import { FlashSalesSection } from './components/marketplace/MegaFlashSales';
import MegaBuyerOrderDetail from './components/marketplace/MegaEscrow';
import { CompanyReturnsPanel, AdminDisputeCenter } from './components/marketplace/MegaReturns';
import MegaBulkUpload from './components/marketplace/MegaBulkUpload';
import MegaNotificationsBell from './components/marketplace/MegaNotifications';
import SyncStatusIndicator from './components/SyncStatusIndicator';

// Utils
import { translate, formatMoney, exportToExcel } from './utils/format';
import { getStoredLanguage, syncDocumentLang, getUserAdminLanguage, setUserAdminLanguage } from './utils/i18n';
import { handlePrintWithFallback } from './utils/printHelper';
import { hashPassword, isHashedPassword, verifyPassword } from './utils/hash';
import { filterActiveData } from './utils/cascadeDelete';
import { generateSalesOrderPDF } from './utils/pdfGenerator';
import { jsPDF } from 'jspdf';
import { getFIFOInventoryValuation, cleanupEmptyBatches } from './utils/fifo';
import { saveSystemDataToPhp, fetchSystemDataFromPhp, connectPhpRealtimeSync, getPhpConfig, savePhpConfig, apiCollectionInitiate, apiCollectionStatus, fetchCheckTimestamp, getLastServerVersion, setLastServerVersion, apiDeleteProduct, apiAssignUser, discoverApiUrl, apiLoginAtomic, apiUpsertProduct, apiUpsertUser, apiUpsertSale, apiUpsertOrder, apiDeleteUser, apiChangePassword, consumeConflictData, mutateCollectionRecordToPhp, getAuditLogsFromPhp, fetchCompanySnapshot, purgeCompanyFromPhp, softDeleteCompanyFromPhp, getOperatorHeaders, buildSessionToken } from './utils/api';
import { replaceQueue, queueMutations, getQueueSnapshot, clearQueue, drainSyncQueue, registerOnlineSync, cacheSystemState, getCachedSystemState, flushQueueNow } from './utils/offlinePersistence';
import {
  listExpenses, upsertExpense, deleteExpense,
  listSuppliers, upsertSupplier, deleteSupplier,
  listPurchaseOrders, upsertPurchaseOrder, deletePurchaseOrder,
  listCustomers, upsertCustomer, deleteCustomer,
  getCompanySettings, upsertCompanySettings,
  listTaxRules, upsertTaxRule, deleteTaxRule,
  listFlashSales, upsertFlashSale, deleteFlashSale,
  listStories, upsertStory, deleteStory,
  listDisputes, upsertDispute, deleteDispute,
  listDisputeMessages, upsertDisputeMessage,
  listProductReturns, upsertProductReturn, deleteProductReturn,
  listChatConversations, upsertChatConversation, deleteChatConversation,
  listChatMessages, upsertChatMessage,
  listEscrowTransactions, upsertEscrowTransaction,
  listVisualSearches, upsertVisualSearch,
  listInstallmentPlans, upsertInstallmentPlan, deleteInstallmentPlan,
  listInstallmentOrders, upsertInstallmentOrder,
  listInstallmentPayments, upsertInstallmentPayment
} from './utils/entityPersistence';
// @ts-ignore - virtual module provided by vite-plugin-pwa
import { registerSW } from 'virtual:pwa-register';
import { toast, Toast } from './utils/toast';
import { getStoreCategories, cleanCategoryName } from './utils/categoryHelper';
import { slugify } from './utils/haversine';
import { computeRatings, isDuplicateReview } from './utils/reviews';
import { searchProducts, buildReply, normalizeTzPhone, maskPhone } from './utils/whatsappBot';
import { simulateTxId, translateText, detectLang } from './utils/megaHelpers';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';

// Icons
import {
  LayoutDashboard, Package, ShoppingCart, Receipt, DollarSign, FileText, Database, FileUp,
  BarChart3, Users, UserCircle, LogOut, Settings as SettingsIcon, Search, Plus, ArrowLeftRight,
  Pencil, Trash2, Printer, FileSpreadsheet, Copy, CheckCircle, CheckCircle2, ShoppingBag, RefreshCw, AlertTriangle, AlertCircle, X, XCircle, Check,
  ShieldAlert, DollarSign as DollarIcon, CreditCard, Monitor, Barcode, Store as StoreIcon,
  Calendar, TrendingUp, Info, ShieldCheck, Lock, Globe, Truck, ChevronDown, ChevronUp, Building2, Camera, Layers, Zap, RotateCcw,
  Clock3, Hourglass, UserPlus, RefreshCcw as RefreshIcon
} from 'lucide-react';

// Unique identifier for this browser tab — used to ignore our own BroadcastChannel messages
// Per-browser-TAB session id, used to ignore BroadcastChannel self-echo.
// Deliberately IN-MEMORY, never persisted: every tab in the same browser must get a
// DISTINCT id so the echo-guard filters only the sending tab. Storing it in
// localStorage would give all tabs the same id and make them ALL ignore each other,
// silently killing cross-tab sync.
const TAB_ID = ((): string => {
  try {
    if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
      return 'tab-' + (crypto as any).randomUUID();
    }
  } catch {}
  return 'tab-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
})();

// Global offline flag maintained by the window 'offline'/'online' listeners. Every
// background network path (cross-tab re-fetch, 5s poll, PHP flush, mutate ack) must
// short-circuit on this BEFORE issuing a fetch, so a dropped connection surfaces as a
// clean pause instead of an uncaught "Failed to fetch" Workbox/promise rejection that
// triggers the cross-tab re-fetch loop and wipes active UI state.
const globalOfflineRef = { current: typeof navigator !== 'undefined' && navigator.onLine === false };
const isCurrentlyOffline = (): boolean =>
  globalOfflineRef.current || (typeof navigator !== 'undefined' && navigator.onLine === false);

// Helper function to darken/lighten hex colors dynamically
function adjustColorBrightness(hex: string, percent: number): string {
  const color = hex.replace('#', '');
  const num = parseInt(color, 16);
  let r = (num >> 16) + percent;
  let g = ((num >> 8) & 0x00FF) + percent;
  let b = (num & 0x0000FF) + percent;

  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// Shared brand variables for public (non-logged-in) views so bg-brand/text-brand resolve
const publicBrandStyle = {
  '--brand-color': '#c41e3a',
  '--brand-color-hover': '#a81a32',
  '--brand-color-light': 'rgba(196, 30, 58, 0.15)'
} as React.CSSProperties;

// Normalise any server/client timestamp (MySQL DATETIME, ISO string, number) to epoch ms.
const toEpochMs = (v: unknown): number => {
  if (!v) return 0;
  const t = new Date(String(v)).getTime();
  return Number.isFinite(t) ? t : 0;
};
const normalizePhone = (phone: string): string => phone.replace(/\s+/g, '').replace(/^0/, '255');

// Persist the ACTIVE company under BOTH keys so boot resolution, the switch guard and the
// cross-device poll all agree on the single committed company. 'active_company_id' is the
// canonical "which company am I in right now" key; 'company_id' is kept for legacy readers.
const persistActiveCompany = (cid: string | number | null | undefined): void => {
  if (cid == null || cid === '' || String(cid) === 'none') return;
  const s = String(cid);
  try {
    localStorage.setItem('company_id', s);
    localStorage.setItem('active_company_id', s);
  } catch {}
};

// Collections/keys that must NEVER enter the server-sync blob. auditTrails is database-only;
// the remainder are the volatile session-scoped keys (kept as guards in case a component ever
// feeds them through the dirty set). Any of them left in the dirty set alone re-triggers the
// infinite tiny "0.1KB / 1 dirty key" flush loop while their value keeps changing.
const NON_SYNCED_KEYS = new Set(['auditTrails', 'active_company_id', 'company_selection', 'lastActiveAt', 'lastSeen', '_companySwitch']);

// MASTER-DATA KEYS (2026-09-07): company/hierarchy/category edits are the highest-value
// writes in the system. They are NEVER eligible for micro-flush suppression (shouldFlush)
// and any dirty master key is enough to force an immediate full-state flush so the edit
// can never be dropped by a <1KB delta guard or an early dirty-marker clear.
const MASTER_SYNC_KEYS = new Set(['companies', 'categories', 'branches', 'stores']);

// KEY-BASED SYNC PIVOT (2026-09-07-02): flush eligibility is decided by the ENTITY
// TYPE of the dirty keys — NEVER by payload byte size. A delta containing any real
// business record must be released immediately regardless of whether it weighs 0.2KB
// or 115KB; the byte-size heuristics of the previous builds were what allowed the
// 0.1KB (1 dirty key) category loop to swallow new categories before they reached
// the server. 'products'/'sales' below map to the codebase keys 'stockItems'/'salesOrders'.
const BUSINESS_ENTITY_KEYS = new Set([
  'categories', 'customers', 'expenses', 'companies', 'stockItems', 'salesOrders',
  'purchaseOrders', 'suppliers', 'branches', 'stores'
]);
// SYSTEM/SESSION METADATA KEYS: the ONLY key set whose presence is allowed to suppress
// a flush. Nothing here carries durable business meaning outside the active session.
const SYSTEM_SESSION_KEYS = new Set(['auditTrails', 'active_company_id', 'company_selection', 'lastActiveAt', 'lastSeen', '_companySwitch']);

// PHP state-flush timing: background saves COALESCE into a single server round-trip over
// a ~6s window (laid-back debounce so rapid small edits never go to the wire one-by-one).
// Only explicit critical user actions (checkout, save/delete product, user password,
// orders, approvals) force a near-immediate flush via forceFlushNow().
const FLUSH_DEBOUNCE_MS = 6000;
const CRITICAL_FLUSH_DEBOUNCE_MS = 150;

// --- ARRAY SANITIZATION: prevent undefined/null entries that crash React internals ---
const sanitizeArray = <T extends Record<string, any>>(arr: any): T[] => {
  if (!Array.isArray(arr)) return [];
  return arr.filter((item): item is T => item != null && typeof item === 'object' && !Array.isArray(item));
};

// Sanitize all collection arrays in a parsed state object to prevent
// "Cannot read properties of undefined (reading 'startTime')" and similar
// crashes caused by undefined entries leaking into React state.
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

// ---------------------------------------------------------------------------
// ROLE CACHE (tradecore_role_cache) — instant boot restore + background
// revalidation that eliminates the "none -> 1 forcing resync" first-frame
// company switch and auto-applies Admin reassignments without a manual logout.
//
//  * boot():    restoreRoleCacheAtBoot() runs FIRST, before the DB boot. It
//               writes active_company_id / active_branch_id / active_store_id /
//               active_role from the last-known-good assignment so boot company
//               resolution can never land on 'none' (which the company-switch
//               effect would then bounce to company 1).
//  * 2.5s later: validateRoleCacheAfterBoot() silently re-checks against the
//               get_my_role endpoint. If an Admin changed the user's role /
//               company / branch / store, the cache is purged + refreshed +
//               a clean reload activates the new assignment. Offline or no
//               session -> skipped with a log.
// ---------------------------------------------------------------------------
function normalizeRoleCache(cache: any): any {
  if (!cache || typeof cache !== 'object') return null;
  return {
    ...cache,
    user_id: cache.user_id ?? cache.id ?? cache.userId ?? null,
    role: cache.role ?? '',
    company_id: cache.company_id ?? cache.companyId ?? '',
    branch_id: cache.branch_id ?? cache.branchId ?? '',
    store_id: cache.store_id ?? cache.storeId ?? ''
  };
}

function restoreRoleCacheAtBoot(): any {
  const raw = (() => {
    try { return localStorage.getItem('tradecore_role_cache') || localStorage.getItem('tradecore_user'); } catch { return null; }
  })();
  if (!raw) return null;
  try {
    const cache = normalizeRoleCache(JSON.parse(raw));
    if (!cache) return null;
    const cid = cache.company_id != null ? String(cache.company_id) : '';
    if (cid && cid !== 'none') {
      localStorage.setItem('active_company_id', String(cid));
      localStorage.setItem('company_id', String(cid));
      localStorage.setItem('active_branch_id', String(cache.branch_id ?? ''));
      localStorage.setItem('active_store_id', String(cache.store_id ?? 'None'));
      localStorage.setItem('active_role', cache.role || '');
      try { (window as any).__TRADECORE_ROLE_CACHE__ = cache; } catch {}
      console.log('[RoleCache] Restored role=' + (cache.role || '') + ' company=' + String(cid) + ' branch=' + String(cache.branch_id ?? '') + ' store=' + String(cache.store_id ?? '') + ' - skipping none->1');
      console.log('Role cache restored at boot');
    }
    return cache;
  } catch (e) {
    return null;
  }
}

async function validateRoleCacheAfterBoot(): Promise<void> {
  setTimeout(async () => {
    try {
      let cached: any = null;
      try { cached = (window as any).__TRADECORE_ROLE_CACHE__ || JSON.parse(localStorage.getItem('tradecore_role_cache') || 'null'); } catch {}
      if (!cached) return;
      cached = normalizeRoleCache(cached);
      const userId = cached.user_id;
      if (!userId) return;
      // Resolve the API base exactly like the sync layer (saved/discovered URL).
      let base = '';
      try {
        base = (await discoverApiUrl()) || getPhpConfig().apiUrl || '/cpanel/api.php';
      } catch {
        base = getPhpConfig().apiUrl || '/cpanel/api.php';
      }
      if (!base) return;
      const sep = base.includes('?') ? '&' : '?';
      const url = base + sep + 'action=get_my_role&user_id=' + encodeURIComponent(String(userId));
      let resp: Response;
      try {
        const headers: Record<string, string> = { 'Accept': 'application/json', ...getOperatorHeaders() };
        const token = buildSessionToken();
        if (token) headers['Authorization'] = 'Bearer ' + token;
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 12000);
        resp = await fetch(url, { method: 'GET', headers, credentials: 'include', cache: 'no-store', signal: controller.signal });
        clearTimeout(tid);
      } catch {
        console.log('[RoleCache] Validation skipped - offline');
        return;
      }
      if (!resp.ok) { console.log('[RoleCache] Validation skipped - HTTP ' + resp.status); return; }
      let serverBody: any = null;
      try { serverBody = await resp.json(); } catch { serverBody = null; }
      if (!serverBody || serverBody.success === false) { console.log('[RoleCache] Validation skipped - no role payload'); return; }
      const server = normalizeRoleCache(serverBody);
      // SUPER-ADMIN / ROOT SCOPE: company/branch/store in the cache is VIEW-STATE
      // (the admin freely switches companies to inspect them), not a fixed
      // assignment. A mismatch must NEVER purge + reload — that is the "selecting a
      // company kicks me out after refresh" bug. Only a genuine ROLE change
      // (e.g. demoted) is worth applying automatically.
      const nowRole = String(cached.role ?? '').toLowerCase();
      const isSuperScope = nowRole === 'super admin' || nowRole === 'root_mandate' || nowRole === 'superadmin';
      const isChanged =
        String(server.role ?? '') !== String(cached.role ?? '')
        || (!isSuperScope && (
          String(server.company_id ?? '') !== String(cached.company_id ?? '') ||
          String(server.branch_id ?? '') !== String(cached.branch_id ?? '') ||
          String(server.store_id ?? '') !== String(cached.store_id ?? '')
        ));
      if (isChanged) {
        console.warn('[RoleCache] Role changed on server - purging cache', { cached, server });
        localStorage.removeItem('tradecore_role_cache');
        localStorage.removeItem('active_company_id');
        const fresh: any = {
          id: String(cached.user_id ?? ''),
          user_id: String(cached.user_id ?? ''),
          username: server.username ?? cached.username ?? '',
          role: server.role ?? '',
          companyId: server.company_id ?? '',
          company_id: server.company_id ?? '',
          branchId: server.branch_id ?? '',
          branch_id: server.branch_id ?? '',
          storeId: server.store_id ?? '',
          store_id: server.store_id ?? '',
          allowedPages: cached.allowedPages ?? null,
          cachedAt: Date.now()
        };
        localStorage.setItem('tradecore_role_cache', JSON.stringify(fresh));
        localStorage.setItem('active_company_id', String(server.company_id ?? ''));
        console.warn('[RoleCache] Role changed on server — applying silently (no reload loop)', fresh);
        // SILENT ROLE MERGE: instead of a hard reload (which triggers the 5s poll → apply → role re-check → reload
        // infinite loop), dispatch a custom event so the running React tree can pick up the new role assignment
        // without destroying unsaved local state or re-mounting the component tree.
        try { window.dispatchEvent(new CustomEvent('tradecore:role-changed', { detail: fresh })); } catch {}
      } else {
        console.log('[RoleCache] Background validation OK - role unchanged');
      }
    } catch (e) {
      console.log('[RoleCache] Validation skipped - offline');
    }
  }, 2500);
}

import ErrorBoundary from './ErrorBoundary';

/**
 * STATIC, IMMUTABLE, FULL-ACCESS MENU REGISTRY for privileged admin accounts
 * ('root_mandate' / 'superadmin' and the 'Super Admin' role).
 *
 * This array is referenced by value and never mutated, rebuilt, or reassigned from
 * sync state. It is a hard guarantee that these accounts ALWAYS see every system
 * module (48 routes) regardless of what `currentUser.allowedPages` holds — which a
 * background php_sync.php blob or the ManageUsers "rolePermissions[role] || []"
 * assignment can otherwise truncate to an empty/partial array (the exact cause of
 * panel/sidebar disappearance for root accounts).
 *
 * Object.freeze + as const prevent accidental mutation. Consumers downcast to
 * string[] when needed.
 */
const ADMIN_FULL_ACCESS_PAGES: readonly string[] = Object.freeze([
  'dashboard', 'stock-items', 'purchase-order', 'sales-order', 'expenses', 'receipts', 'ai-copilot',
  'companies', 'branches', 'stores', 'customers', 'suppliers', 'categories', 'taxes',
  'data-recovery', 'exchange-rate',
  'import-stock', 'import-customers', 'import-suppliers',
  'report-transaction', 'report-financial', 'report-daily', 'report-monthly', 'report-sales',
  'report-purchase', 'report-sales-outstanding', 'report-purchase-outstanding', 'report-lowstock',
  'report-po-details', 'report-shifts', 'report-unit-velocity', 'report-tax-vat', 'report-predictive-ai',
  'user-info', 'user-access', 'subscriptions',
  'marketplace-orders', 'marketplace-settings', 'seller-wallet', 'affiliate-program',
  'seller-phase2c', 'qr-code-yangu', 'sauti-search', 'tra-report',
  'root-dashboard', 'tra-reports', 'root-disputes', 'profile'
]);

// Stable module-level AI Copilot panel — defined OUTSIDE any render function so
// React's reconciliation does NOT treat it as a new component type on every parent
// re-render (which would unmount/remount it and wipe its open/prompt/response state).
interface AIStockCopilotProps {
  products: StockItem[];
  storeId: number;
  t: (s: string) => string;
  formatMoney: (n: number, c: string, r: number) => string;
  activeCurrency: string;
  activeExchangeRate: number;
  saveAllData: (fields: any) => void;
  logAction: (action: string, details: string) => void;
  toast: any;
}
function AIStockCopilot({ products, storeId, t, formatMoney, activeCurrency, activeExchangeRate, saveAllData, logAction, toast }: AIStockCopilotProps) {
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<any>(null);

  const handleAskAI = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiResponse(null);
    try {
      const response = await fetch('/api/ai-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt,
          products: products.map(p => ({
            id: p.id,
            name: p.name,
            code: p.code,
            category: p.category,
            stock_qty: p.stock?.[storeId] || 0,
            useSubUnitPricing: p.useSubUnitPricing,
            unit: p.unit,
            subUnitName: p.subUnitName,
            subUnitConversion: p.subUnitConversion,
            purchasePrice: p.purchasePrice,
            retailPrice: p.retailPrice,
            wholesalePrice: p.wholesalePrice,
            subUnitRetailPrice: p.subUnitRetailPrice,
            subUnitWholesalePrice: p.subUnitWholesalePrice,
          })),
          priceType: 'Retail'
        })
      });
      const data = await response.json();
      setAiResponse(data);
    } catch (err: any) {
      console.error("AI error", err);
      setAiResponse({ success: false, explanation: "Failed to query AI. Ensure server is running and GEMINI_API_KEY is configured." });
    } finally {
      setAiLoading(false);
    }
  };

  const handleApplyAdjustment = () => {
    if (!aiResponse || !aiResponse.actions) return;
    const updatedStockItems = products.map(item => {
      const matchingActions = aiResponse.actions.filter((act: any) => act.productId === item.id);
      if (matchingActions.length === 0) return item;
      const nextStock = { ...item.stock };
      matchingActions.forEach((action: any) => {
        const conversion = item.subUnitConversion || 1;
        const deductionInMainUnit = action.unitType === 'sub' ? action.qty / conversion : action.qty;
        nextStock[storeId] = (nextStock[storeId] || 0) - deductionInMainUnit;
      });
      return { ...item, stock: nextStock };
    });
    saveAllData({ stockItems: updatedStockItems });
    logAction('AI Stock Adjustment', `Adjusted inventory via AI Assistant for: ${aiResponse.actions.map((a: any) => a.productName).join(', ')}`);
    toast.success(t('Inventory adjusted successfully based on AI recommendations!'));
    setAiResponse(null);
    setAiPrompt('');
  };

  return (
    <div className="bg-gradient-to-r from-brand/5 to-indigo-50/40 rounded-xl border border-brand/20 shadow-sm p-4 no-print space-y-3">
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsAiOpen(!isAiOpen)}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center font-bold">✨</div>
          <div>
            <h4 className="font-bold text-gray-900 text-xs sm:text-sm">{t('AI Stock & Pricing Copilot')}</h4>
            <p className="text-[10px] text-gray-500 font-medium">{t('Ask to process sales, loose units (bread, flour) and check pricing rules')}</p>
          </div>
        </div>
        <button className="text-xs font-semibold text-brand hover:text-brand-hover">
          {isAiOpen ? t('Collapse') : t('Expand Assistant')}
        </button>
      </div>
      {isAiOpen && (
        <div className="pt-2 border-t border-brand/10 space-y-3 animate-fadeIn">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="flex-1">
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder={t("e.g. 'A retail customer is buying 3 loose loaves of bread individually' or 'A Wholesaler wants 1 full sack and 2 kg of flour'")}
                className="w-full h-16 p-2.5 border border-gray-200 rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand bg-white resize-none"
              />
            </div>
            <div className="flex flex-col gap-1.5 shrink-0 justify-end">
              <button
                onClick={handleAskAI}
                disabled={aiLoading}
                className="bg-brand hover:bg-brand-hover text-white px-4 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {aiLoading ? (<span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />) : '✨'} {t('Ask Copilot')}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{t('Try Examples')}:</span>
            <button onClick={() => setAiPrompt("We have 5 bags of 24kg flour. A customer wants to buy 2 kilograms of flour as a Retail customer.")} className="text-[10px] bg-white border border-gray-200 text-gray-600 hover:border-brand px-2 py-1 rounded font-semibold transition">🌾 Flour 2 kg (Retail)</button>
            <button onClick={() => setAiPrompt("A customer is buying 3 loose loaves of Bread.")} className="text-[10px] bg-white border border-gray-200 text-gray-600 hover:border-brand px-2 py-1 rounded font-semibold transition">🍞 Bread 3 Loaves</button>
            <button onClick={() => setAiPrompt("A wholesaler wants 2 full sacks of flour.")} className="text-[10px] bg-white border border-gray-200 text-gray-600 hover:border-brand px-2 py-1 rounded font-semibold transition">📦 Flour 2 Sacks (Wholesale)</button>
          </div>
          {aiResponse && (
            <div className="p-3 bg-white border border-brand/10 rounded-lg space-y-2.5">
              <div className="text-xs font-medium text-gray-700 whitespace-pre-line leading-relaxed border-l-2 border-brand pl-2.5 font-mono">{aiResponse.explanation}</div>
              {aiResponse.success && aiResponse.actions && aiResponse.actions.length > 0 && (
                <div className="pt-2 border-t border-gray-100 flex flex-col sm:flex-row gap-2 items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">{t('Matched Actions')}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {aiResponse.actions.map((act: any, idx: number) => (
                        <span key={idx} className="bg-brand/5 text-brand px-2 py-0.5 rounded text-[10px] font-bold">
                          {act.productName}: {act.qty} {act.unitType === 'sub' ? 'loose' : 'package'} ({formatMoney(act.total, activeCurrency, activeExchangeRate)})
                        </span>
                      ))}
                    </div>
                  </div>
                  <button onClick={handleApplyAdjustment} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0">
                    <Check className="w-3.5 h-3.5" /> {t('Apply Stock Deduction')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function App() {
  // --- DATABASE STATE ---
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [auditTrails, setAuditTrails] = useState<AuditTrail[]>([]);
  const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>(defaultRolePermissions);
  const [posShifts, setPosShifts] = useState<PosShift[]>([]);
  const [stockTransfers, setStockTransfers] = useState<StockTransfer[]>([]);
  const [contactMessages, setContactMessages] = useState<ContactMessage[]>([]);
  const [marketplaceProducts, setMarketplaceProducts] = useState<MarketplaceProduct[]>([]);
  const [marketplaceCustomers, setMarketplaceCustomers] = useState<MarketplaceCustomer[]>([]);
  const [marketplaceOrders, setMarketplaceOrders] = useState<MarketplaceOrder[]>([]);
  const [marketplaceClicks, setMarketplaceClicks] = useState<MarketplaceClick[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [productViews, setProductViews] = useState<ProductView[]>([]);
  // --- MEGA Phase 1: wallets, affiliates, push, AI search ---
  const [wallets, setWallets] = useState<SellerWallet[]>([]);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [affiliateClicks, setAffiliateClicks] = useState<AffiliateClick[]>([]);
  const [affiliateSales, setAffiliateSales] = useState<AffiliateSale[]>([]);
  const [affiliateWithdrawals, setAffiliateWithdrawals] = useState<AffiliateWithdrawal[]>([]);
  const [searchSynonyms, setSearchSynonyms] = useState<SearchSynonym[]>([]);
  const [pushSubscriptions, setPushSubscriptions] = useState<PushSubscriptionRec[]>([]);
  // --- MEGA ULTIMATE: Tafta kwa Sauti (voice search) + QR Code ya Duka ---
  const [voiceSearches, setVoiceSearches] = useState<VoiceSearchLog[]>([]);
  const [qrScans, setQrScans] = useState<QrScanLog[]>([]);
  const [traReceipts, setTraReceipts] = useState<TraReceipt[]>([]);
  // --- MEGA Phase 2B: collections, webhook logs, admin earnings ---
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [adminEarnings, setAdminEarnings] = useState<AdminEarning[]>([]);
  // --- MEGA Phase 2C: 7 killer features ---
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offerMessages, setOfferMessages] = useState<OfferMessage[]>([]);
  const [groupDeals, setGroupDeals] = useState<GroupDeal[]>([]);
  const [groupDealParticipants, setGroupDealParticipants] = useState<GroupDealParticipant[]>([]);
  const [whatsappConversations, setWhatsappConversations] = useState<WhatsappConversation[]>([]);
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [deliveryUpdates, setDeliveryUpdates] = useState<DeliveryUpdate[]>([]);
  const [installmentPlans, setInstallmentPlans] = useState<InstallmentPlan[]>([]);
  const [installmentOrders, setInstallmentOrders] = useState<InstallmentOrder[]>([]);
  const [installmentPayments, setInstallmentPayments] = useState<InstallmentPayment[]>([]);
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);
  const [liveComments, setLiveComments] = useState<LiveComment[]>([]);
  const [loyaltyCustomers, setLoyaltyCustomers] = useState<LoyaltyCustomer[]>([]);
  const [loyaltyTransactions, setLoyaltyTransactions] = useState<LoyaltyTransaction[]>([]);
  const [loyaltyRedeemCodes, setLoyaltyRedeemCodes] = useState<LoyaltyRedeemCode[]>([]);
  // --- MEGA BUILD: 7 ultimate features state ---
  const [escrowTransactions, setEscrowTransactions] = useState<EscrowTransaction[]>([]);
  const [chatConversations, setChatConversations] = useState<ChatConversation[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [visualSearches, setVisualSearches] = useState<VisualSearchRecord[]>([]);
  const [productReturns, setProductReturns] = useState<ProductReturn[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [disputeMessages, setDisputeMessages] = useState<DisputeMessage[]>([]);
  const [flashSales, setFlashSales] = useState<FlashSale[]>([]);
  const [appNotifications, setAppNotifications] = useState<AppNotification[]>([]);
  const [bulkUploads, setBulkUploads] = useState<BulkUploadJob[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [storyViews, setStoryViews] = useState<StoryView[]>([]);
  const [shippingZones, setShippingZones] = useState<ShippingZone[]>([]);

  // --- OPERATIONAL STATES ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState<string>('dashboard');
  const [currentCompanyId, setCurrentCompanyId] = useState<number | null>(null);
  const [currentBranchId, setCurrentBranchId] = useState<number | null>(null);
  const [currentStoreId, setCurrentStoreId] = useState<number | null>(null);

  // ROOT_MANDATE: "View as Company" impersonation backup (root session while helping a company)
  const [rootSessionBackup, setRootSessionBackup] = useState<User | null>(null);
  const isImpersonatingRoot = rootSessionBackup !== null;

  // ROOT_MANDATE helper — true only for the God-Mode root account
  const isRootUser = (u: User | null): boolean =>
    !!u && (u.isRoot === true || u.username === 'root_mandate' || u.username === 'superadmin');

  // Camera capture modal state & stream ref
  const [showCameraCaptureModal, setShowCameraCaptureModal] = useState<boolean>(false);
  const cameraVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const getActiveLanguage = (specificCompId?: number): 'en' | 'sw' | 'fr' | 'es' => {
    // User-level override takes priority — lets each admin user work in their
    // preferred language without changing the company-wide default.
    const userOverride = getUserAdminLanguage();
    if (userOverride) return userOverride;

    const targetCompId = specificCompId || currentCompanyId || currentUser?.companyId || (companies.length > 0 ? companies[0].id : undefined);
    if (targetCompId) {
      const companyObj = companies.find(c => c.id === targetCompId);
      if (companyObj?.language) return companyObj.language;
      if (settings.companyLanguages && settings.companyLanguages[targetCompId]) {
        return settings.companyLanguages[targetCompId];
      }
      // Tenant isolation: each company defaults to the browser's stored site
      // language (what the visitor picked on the marketplace homepage), never
      // inheriting another company's global preference.
      return getStoredLanguage();
    }
    if (currentUser && (settings as any).userLanguages && (settings as any).userLanguages[currentUser.username]) {
      return (settings as any).userLanguages[currentUser.username];
    }
    return settings.language || getStoredLanguage();
  };

  const getActiveCurrency = (specificCompId?: number): string => {
    const targetCompId = specificCompId || currentCompanyId || currentUser?.companyId || (companies.length > 0 ? companies[0].id : undefined);
    if (targetCompId) {
      const companyObj = companies.find(c => c.id === targetCompId);
      if (companyObj?.currency) return companyObj.currency;
      if (settings.companyCurrencies && settings.companyCurrencies[targetCompId]) {
        return settings.companyCurrencies[targetCompId];
      }
    }
    // Only Super Admin/Admin can override currency; other roles follow company currency strictly
    if (currentUser && (currentUser.role === 'Super Admin' || currentUser.role === 'Admin') && settings.userCurrencies && settings.userCurrencies[currentUser.username]) {
      return settings.userCurrencies[currentUser.username];
    }
    return settings.currency || 'USD';
  };

  const getActiveExchangeRate = (specificCompId?: number): number => {
    const targetCompId = specificCompId || currentCompanyId || currentUser?.companyId || (companies.length > 0 ? companies[0].id : undefined);
    if (targetCompId) {
      const companyObj = companies.find(c => c.id === targetCompId);
      if (companyObj?.exchangeRate !== undefined) return companyObj.exchangeRate;
      if (settings.companyExchangeRates && settings.companyExchangeRates[targetCompId] !== undefined) {
        return settings.companyExchangeRates[targetCompId];
      }
    }
    if (currentUser && settings.userExchangeRates && settings.userExchangeRates[currentUser.username] !== undefined) {
      return settings.userExchangeRates[currentUser.username];
    }
    return settings.exchangeRate || 1;
  };

  const getActiveTaxes = (specificCompId?: number): Tax[] => {
    const targetCompId = specificCompId || currentCompanyId || currentUser?.companyId || (companies.length > 0 ? companies[0].id : undefined);
    if (targetCompId && settings.companyTaxes && Array.isArray(settings.companyTaxes[targetCompId])) {
      return settings.companyTaxes[targetCompId];
    }
    return defaultTaxes;
  };

  const activeLanguage = getActiveLanguage();
  // SPA equivalent of <html lang="{{ app()->getLocale() }}"> — keep the document lang in sync.
  if (typeof document !== 'undefined') syncDocumentLang(activeLanguage);
  const activeCurrency = getActiveCurrency();
  const activeExchangeRate = getActiveExchangeRate();
  const activeTaxes = getActiveTaxes();
  const activeVatRate = (() => {
    const vatTax = activeTaxes.find(tx => /vat/i.test(tx.name || ''));
    const baseRate = vatTax ? vatTax.rate : (activeTaxes[0] ? activeTaxes[0].rate : 18);
    return baseRate / 100;
  })();
  const subscriptionMeta: SubscriptionMeta = settings.subscriptionMeta || defaultSubscriptionMeta;
  // New billing model (ROOT_MANDATE editable) — guaranteed present via applyData backfill
  const activeCurrencies: Currency[] = settings.currencies && settings.currencies.length > 0 ? settings.currencies : defaultCurrencies;
  const activeTradePlans: TradeSubscriptionPlan[] = settings.subscriptionPlans && settings.subscriptionPlans.length > 0 ? settings.subscriptionPlans : defaultTradePlans;
  const activeCompanySubscriptions: CompanySubscription[] = settings.companySubscriptions || [];

  // --- CASCADE DYNAMIC FILTERING ---
  const activeData = React.useMemo(() => filterActiveData({
    companies,
    branches,
    stores,
    users,
    stockItems,
    purchaseOrders,
    salesOrders,
    expenses
  }), [companies, branches, stores, users, stockItems, purchaseOrders, salesOrders, expenses]);

  const activeUsers = activeData.users;

  // Refactored stock items: Private and exclusive to each company
  const activeStockItems = React.useMemo(() => {
    let items = activeData.stockItems;
    const activeCompId = currentCompanyId || currentUser?.companyId;

    // Strict Company Privacy Filter
    if (activeCompId) {
      items = items.filter(p => {
        // Direct company ownership
        if (p.companyId === activeCompId) return true;
        // Fallback for unassigned legacy products
        if (!p.companyId) {
          const companyBranchIds = branches.filter(b => b.companyId === activeCompId).map(b => b.id);
          const companyStoreIds = stores.filter(s => companyBranchIds.includes(s.branchId)).map(s => s.id);
          const hasStockInCompanyStore = Object.keys(p.stock || {}).some(stIdStr => companyStoreIds.includes(parseInt(stIdStr, 10)));
          return hasStockInCompanyStore;
        }
        return false;
      });
    }

    return items.map(p => {
      let priceObj: any = null;
      if (currentStoreId && p.storePrices && p.storePrices[currentStoreId]) {
        priceObj = p.storePrices[currentStoreId];
      } else if (currentCompanyId && p.companyPrices && p.companyPrices[currentCompanyId]) {
        priceObj = p.companyPrices[currentCompanyId];
      }

      if (priceObj) {
        return {
          ...p,
          purchasePrice: priceObj.purchasePrice ?? p.purchasePrice,
          retailPrice: priceObj.retailPrice ?? p.retailPrice,
          wholesalePrice: priceObj.wholesalePrice ?? p.wholesalePrice,
          partnerPrice: priceObj.partnerPrice ?? priceObj.retailPrice ?? p.partnerPrice,
          subUnitRetailPrice: priceObj.subUnitRetailPrice ?? p.subUnitRetailPrice,
          subUnitWholesalePrice: priceObj.subUnitWholesalePrice ?? p.subUnitWholesalePrice,
          subUnitPartnerPrice: priceObj.subUnitPartnerPrice ?? p.subUnitPartnerPrice,
        };
      }
      return p;
    });
  }, [activeData.stockItems, currentCompanyId, currentUser, branches, stores, currentStoreId]);
  const activeCompanyScopeId = currentCompanyId || currentUser?.companyId;

  const activeBranchIdsScope = React.useMemo(() => {
    if (!activeCompanyScopeId) return branches.map(b => b.id);
    return branches.filter(b => b.companyId === activeCompanyScopeId && !b.isDeleted).map(b => b.id);
  }, [branches, activeCompanyScopeId]);

  const activeStoreIdsScope = React.useMemo(() => {
    if (!activeCompanyScopeId) return stores.map(s => s.id);
    return stores.filter(s => activeBranchIdsScope.includes(s.branchId) && !s.isDeleted).map(s => s.id);
  }, [stores, activeBranchIdsScope, activeCompanyScopeId]);

  const activePurchaseOrders = React.useMemo(() => {
    let list = activeData.purchaseOrders.filter(po => !po.isDeleted);
    if (activeCompanyScopeId) {
      list = list.filter(po => activeStoreIdsScope.includes(po.storeId) || (po as any).companyId === activeCompanyScopeId);
    }
    return list;
  }, [activeData.purchaseOrders, activeCompanyScopeId, activeStoreIdsScope]);

  const activeSalesOrders = React.useMemo(() => {
    let list = activeData.salesOrders.filter(so => !so.isDeleted && so.status !== 'Voided');
    if (activeCompanyScopeId) {
      list = list.filter(so => activeStoreIdsScope.includes(so.storeId) || (so as any).companyId === activeCompanyScopeId);
    }
    return list;
  }, [activeData.salesOrders, activeCompanyScopeId, activeStoreIdsScope]);

  const activeExpenses = React.useMemo(() => {
    let list = activeData.expenses;
    if (activeCompanyScopeId) {
      list = list.filter(ex => activeStoreIdsScope.includes(ex.storeId) || (ex as any).companyId === activeCompanyScopeId);
    }
    return list;
  }, [activeData.expenses, activeCompanyScopeId, activeStoreIdsScope]);

  // --- SYNC COOLDOWN REFS ---
  const lastLocalWriteTimeRef = React.useRef<number>(0);
  const lastServerTimestampRef = React.useRef<string | null>(null);
  const incrementalSyncSinceRef = React.useRef<number>(0);
  const lastPolledCompanyIdRef = React.useRef<string | null>(null);
  const lastSkipSigRef = React.useRef<string>('');
  // POLL DEBOUNCE: prevents the cross-device poll from re-applying the same server
  // version after a reload or within a short window. Breaks the "poll → apply → reload
  // → poll → apply" infinite loop where the version ref was reset to 0 on reload.
  const lastPollAppliedVersionRef = React.useRef<number>(0);
  const lastPollAppliedTimeRef = React.useRef<number>(0);
  // STORAGE EVENT DEBOUNCE: prevents rapid-fire storage events (e.g. from multiple
  // localStorage writes in quick succession during applyData) from triggering multiple
  // scheduleCrossTabRefetch calls. Breaks the "storage event → re-fetch → apply →
  // storage event" micro-loop.
  const lastStorageEventTimeRef = React.useRef<number>(0);
  // Monotonic server version — fixes same-second TIMESTAMP collisions
  const lastServerVersionRef = React.useRef<number>(0);
  // Guards against applying/re-broadcasting the same server version more than once
  // (breaks cross-tab echo loops and SSE self-echo).
  const lastRealtimeVersionRef = React.useRef<number>(0);
  // Tracks the version we last flushed to the server so SSE self-echoes are detected.
  const lastFlushedVersionRef = React.useRef<number>(0);
  // Tracks the version we last notified other tabs about — prevents redundant BroadcastChannel msgs.
  const lastNotifiedVersionRef = React.useRef<number>(0);
  // REQ 2 (stale-payload protection) — optimistic write watermark. Every local mutation
  // stamps the per-collection timestamp here. When a background re-fetch returns server
  // data for a collection that was optimistically edited MORE RECENTLY than the incoming
  // server payload's own updated_at, we treat the incoming payload as STALE and refuse to
  // overwrite that collection — preventing the "re-fetch overwrites fresh local edits with
  // stale DB data" race. Cleared (per collection) once the server ack adopts a NEWER version.
  const optimisticWriteTsRef = React.useRef<Record<string, number>>({});
  // Highest monotonic server version we have ever ACKed locally. Incoming server payloads
  // with a version <= this can never legitimately contain data newer than our local state.
  const lastAckVersionRef = React.useRef<number>(0);
  // Guard: set while applying remote data (cross-tab/SSE) so the storage event listener
  // ignores the localStorage writes that naturally follow — breaks the infinite loop.
  const isApplyingRemoteUpdateRef = React.useRef<boolean>(false);
  // Mirror of the module-level offline flag for the sync paths; checked synchronously
  // before any network call so offline never throws into the loop.
  const offlineRef = React.useRef<boolean>(isCurrentlyOffline());
  // Set true by the 'online' listener to signal that a pending background re-sync is due.
  const resumeSyncRef = React.useRef<boolean>(false);
  // applyData storm throttle (#185 guard) — tracks applies per 1s window.
  const applyDataThrottleRef = React.useRef<{ count: number; windowStart: number }>({ count: 0, windowStart: 0 });
  // Session-validation guards: the guard effect must NEVER auto-logout a session
  // before the server user list has loaded once, nor within the short grace window
  // right after a successful login. A newly-assigned user's row is often still in
  // the network fetch / poll queue when the guard first runs — auto-logging-out
  // then is exactly the "new user logged out 1-2s after login" bug.
  const usersSyncedRef = React.useRef<boolean>(false);
  const sessionGraceUntilRef = React.useRef<number>(0);
  // Self-write detection for the storage event handler: when noteServerVersion
  // writes tradecore_last_server_version to localStorage, the storage event fires
  // in the SAME tab. This ref tracks what we just wrote so the handler can skip it.
  const lastSelfWrittenVersionRef = React.useRef<string | null>(null);
  const noteServerVersion = (v: unknown): void => {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return;
    if (n > lastServerVersionRef.current) {
      lastServerVersionRef.current = n;
      setLastServerVersion(n);
      // Publish the lightweight version key so browsers without BroadcastChannel
      // still detect cross-tab changes (storage event listener reacts to it only).
      try {
        const vStr = String(n);
        lastSelfWrittenVersionRef.current = vStr;
        localStorage.setItem('tradecore_last_server_version', vStr);
      } catch {}
    }
  };
  // Dirty-key tracking for per-collection merge (prevents last-write-wins resurrection)
  const flushDirtyKeysRef = React.useRef<Set<string>>(new Set<string>());
  // Snapshot of the VALUES recorded at saveAllData time (collectionKey -> value).
  // Survives 409 rebases: when the server rejects a stale write we can replay the
  // user's ACTUAL edits on top of the fresh server blob instead of losing them.
  const dirtyValuesRef = React.useRef<Record<string, any>>({});

  // Newest state timestamp known to this client (local writes + applied server
  // payloads). Used by shouldApplyIncomingState so a stale server blob can never
  // overwrite changes that are newer locally. Monotonic — never moves backwards.
  const stateTimestampRef = React.useRef<string | null>(null);
  const noteStateTimestamp = (v: unknown): void => {
    const t = toEpochMs(v);
    if (t === 0) return;
    if (toEpochMs(stateTimestampRef.current) >= t) return;
    stateTimestampRef.current = String(v);
  };

  // REQ 2 — stale-payload protection helpers.
  // `stampOptimisticWrite` records that the user just edited a collection locally;
  // `isServerCollectionStale` decides whether an incoming background server payload for
  // that collection is OLDER than the local optimistic mutation and must NOT overwrite it.
  const stampOptimisticWrite = (collection: string): void => {
    (optimisticWriteTsRef.current as any)[collection] = Date.now();
    lastLocalWriteTimeRef.current = Date.now();
  };
  const clearOptimisticWrite = (collection: string): void => {
    delete (optimisticWriteTsRef.current as any)[collection];
  };
  // Returns true when the incoming server payload for `collection` is stale relative to a
  // still-unacknowledged local optimistic write. `serverUpdatedAtMs`/`serverVersion` come
  // from the fetched payload; if the server carries no version/timestamp we assume the
  // optimistic write is fresher (fail-closed → keep local, never regress user edits).
  const isServerCollectionStale = (
    collection: string,
    serverUpdatedAtMs?: number,
    serverVersion?: number
  ): boolean => {
    const localTs = (optimisticWriteTsRef.current as any)[collection];
    if (typeof localTs !== 'number') return false;
    if (serverVersion !== undefined && serverVersion > 0 && lastAckVersionRef.current > 0) {
      // If the server already carries a version strictly newer than our last ACK, it is
      // authoritative (another client committed after us) — accept it even if a slow poll
      // raced our optimistic write. This keeps multi-device edits converging.
      if (serverVersion > lastAckVersionRef.current) return false;
    }
    if (serverUpdatedAtMs !== undefined && serverUpdatedAtMs > 0) {
      // Server's own payload timestamp is older than our optimistic edit → stale.
      return serverUpdatedAtMs < localTs;
    }
    // No timestamp on the incoming payload → don't trust it over a fresh local edit.
    return true;
  };

  // --- DATABASE STATE REF (for synchronous, race-condition-free updates) ---
  const dbStateRef = React.useRef<{
    companies: Company[];
    branches: Branch[];
    stores: Store[];
    users: User[];
    categories: string[];
    taxes: Tax[];
    suppliers: Supplier[];
    customers: Customer[];
    stockItems: StockItem[];
    purchaseOrders: PurchaseOrder[];
    salesOrders: SalesOrder[];
    expenses: Expense[];
    auditTrails: AuditTrail[];
    settings: Settings;
    rolePermissions: Record<string, string[]>;
    posShifts: PosShift[];
    stockTransfers: StockTransfer[];
    contactMessages: ContactMessage[];
    marketplaceProducts: MarketplaceProduct[];
    marketplaceCustomers: MarketplaceCustomer[];
    marketplaceOrders: MarketplaceOrder[];
    marketplaceClicks: MarketplaceClick[];
    reviews: Review[];
    productViews: ProductView[];
    wallets: SellerWallet[];
    walletTransactions: WalletTransaction[];
    withdrawals: Withdrawal[];
    affiliates: Affiliate[];
    affiliateClicks: AffiliateClick[];
    affiliateSales: AffiliateSale[];
    affiliateWithdrawals: AffiliateWithdrawal[];
    searchSynonyms: SearchSynonym[];
    pushSubscriptions: PushSubscriptionRec[];
    collections: CollectionRecord[];
    webhookLogs: WebhookLog[];
    adminEarnings: AdminEarning[];
    offers: Offer[];
    offerMessages: OfferMessage[];
    groupDeals: GroupDeal[];
    groupDealParticipants: GroupDealParticipant[];
    whatsappConversations: WhatsappConversation[];
    notificationLogs: NotificationLog[];
    deliveries: Delivery[];
    deliveryUpdates: DeliveryUpdate[];
    installmentPlans: InstallmentPlan[];
    installmentOrders: InstallmentOrder[];
    installmentPayments: InstallmentPayment[];
    liveStreams: LiveStream[];
    liveComments: LiveComment[];
    loyaltyCustomers: LoyaltyCustomer[];
    loyaltyTransactions: LoyaltyTransaction[];
    loyaltyRedeemCodes: LoyaltyRedeemCode[];
    voiceSearches: VoiceSearchLog[];
    qrScans: QrScanLog[];
    traReceipts: TraReceipt[];
    // --- MEGA BUILD: 7 ultimate features ---
    escrowTransactions: EscrowTransaction[];
    chatConversations: ChatConversation[];
    chatMessages: ChatMessage[];
    visualSearches: VisualSearchRecord[];
    productReturns: ProductReturn[];
    disputes: Dispute[];
    disputeMessages: DisputeMessage[];
    flashSales: FlashSale[];
    appNotifications: AppNotification[];
    bulkUploads: BulkUploadJob[];
    stories: Story[];
    storyViews: StoryView[];
    shippingZones: ShippingZone[];
  }>({
    companies: [],
    branches: [],
    stores: [],
    users: [],
    categories: [],
    taxes: [],
    suppliers: [],
    customers: [],
    stockItems: [],
    purchaseOrders: [],
    salesOrders: [],
    expenses: [],
    auditTrails: [],
    settings: defaultSettings,
    rolePermissions: defaultRolePermissions,
    posShifts: [],
    stockTransfers: [],
    contactMessages: [],
    marketplaceProducts: [],
    marketplaceCustomers: [],
    marketplaceOrders: [],
    shippingZones: [],
    marketplaceClicks: [],
    reviews: [],
    productViews: [],
    wallets: [],
    walletTransactions: [],
    withdrawals: [],
    affiliates: [],
    affiliateClicks: [],
    affiliateSales: [],
    affiliateWithdrawals: [],
    searchSynonyms: [],
    pushSubscriptions: [],
    collections: [],
    webhookLogs: [],
    adminEarnings: [],
    offers: [],
    offerMessages: [],
    groupDeals: [],
    groupDealParticipants: [],
    whatsappConversations: [],
    notificationLogs: [],
    deliveries: [],
    deliveryUpdates: [],
    installmentPlans: [],
    installmentOrders: [],
    installmentPayments: [],
    liveStreams: [],
    liveComments: [],
    loyaltyCustomers: [],
    loyaltyTransactions: [],
    loyaltyRedeemCodes: [],
    voiceSearches: [],
    qrScans: [],
    traReceipts: [],
    // --- MEGA BUILD: 7 ultimate features ---
    escrowTransactions: [],
    chatConversations: [],
    chatMessages: [],
    visualSearches: [],
    productReturns: [],
    disputes: [],
    disputeMessages: [],
    flashSales: [],
    appNotifications: [],
    bulkUploads: [],
    stories: [],
    storyViews: [],
  });

  // --- STABLE COLLECTION STATE APPLIER ---
  // Every PHP sync / optimistic write rebuilds all collection arrays from scratch,
  // handing each one a NEW reference even when the content is byte-identical. That
  // churn forces every consumer memo (activeData, activeSalesOrders/StockItems,
  // chart data, the scope effect, filters) to recompute on EVERY 5s poll, which
  // re-renders all three Recharts charts with brand-new data arrays each time — the
  // exact recipe for React Error #185 "Maximum update depth exceeded" inside
  // Recharts' internal react-redux store (<LegendSizeDispatcher>/notify) when two
  // Legends are mounted on the same page. Applying state only when the serialized
  // value actually CHANGES kills that churn: no-op syncs no longer re-render even
  // one chart. Fail-open: if a value can't be serialized it is applied regardless.
  const lastAppliedDataJsonRef = React.useRef<Record<string, string | undefined>>({});
  const dataSettersRef = React.useRef<Record<string, (v: any) => void> | null>(null);
  if (!dataSettersRef.current) {
    dataSettersRef.current = {
      companies: setCompanies,
      branches: setBranches,
      stores: setStores,
      users: setUsers,
      categories: setCategories,
      taxes: setTaxes,
      suppliers: setSuppliers,
      customers: setCustomers,
      stockItems: setStockItems,
      purchaseOrders: setPurchaseOrders,
      salesOrders: setSalesOrders,
      expenses: setExpenses,
      auditTrails: setAuditTrails,
      securityLogs: setSecurityLogs,
      settings: setSettings,
      rolePermissions: setRolePermissions,
      posShifts: setPosShifts,
      stockTransfers: setStockTransfers,
      contactMessages: setContactMessages,
      marketplaceProducts: setMarketplaceProducts,
      marketplaceCustomers: setMarketplaceCustomers,
      marketplaceOrders: setMarketplaceOrders,
      marketplaceClicks: setMarketplaceClicks,
      reviews: setReviews,
      productViews: setProductViews,
      wallets: setWallets,
      walletTransactions: setWalletTransactions,
      withdrawals: setWithdrawals,
      affiliates: setAffiliates,
      affiliateClicks: setAffiliateClicks,
      affiliateSales: setAffiliateSales,
      affiliateWithdrawals: setAffiliateWithdrawals,
      searchSynonyms: setSearchSynonyms,
      pushSubscriptions: setPushSubscriptions,
      collections: setCollections,
      webhookLogs: setWebhookLogs,
      adminEarnings: setAdminEarnings,
      offers: setOffers,
      offerMessages: setOfferMessages,
      groupDeals: setGroupDeals,
      groupDealParticipants: setGroupDealParticipants,
      whatsappConversations: setWhatsappConversations,
      notificationLogs: setNotificationLogs,
      deliveries: setDeliveries,
      deliveryUpdates: setDeliveryUpdates,
      installmentPlans: setInstallmentPlans,
      installmentOrders: setInstallmentOrders,
      installmentPayments: setInstallmentPayments,
      liveStreams: setLiveStreams,
      liveComments: setLiveComments,
      loyaltyCustomers: setLoyaltyCustomers,
      loyaltyTransactions: setLoyaltyTransactions,
      loyaltyRedeemCodes: setLoyaltyRedeemCodes,
      voiceSearches: setVoiceSearches,
      qrScans: setQrScans,
      traReceipts: setTraReceipts,
      // --- MEGA BUILD: 7 ultimate features ---
      escrowTransactions: setEscrowTransactions,
      chatConversations: setChatConversations,
      chatMessages: setChatMessages,
      visualSearches: setVisualSearches,
      productReturns: setProductReturns,
      disputes: setDisputes,
      disputeMessages: setDisputeMessages,
      flashSales: setFlashSales,
      appNotifications: setAppNotifications,
      bulkUploads: setBulkUploads,
      stories: setStories,
      storyViews: setStoryViews,
      shippingZones: setShippingZones,
    };
  }
  const applyCollectionState = (fields: Record<string, any>): void => {
    const setters = dataSettersRef.current;
    if (!setters) return;
    for (const key of Object.keys(setters)) {
      if (!(key in fields)) continue;
      const value = fields[key];
      if (value === undefined || value === null) continue;
      let json: string | undefined;
      try {
        json = JSON.stringify(value);
      } catch {
        json = undefined;
      }
      if (json !== undefined) {
        if (lastAppliedDataJsonRef.current[key] === json) continue;
        lastAppliedDataJsonRef.current[key] = json;
      }
      setters[key](value);
    }
  };

  // --- MERGE, DON'T REPLACE, ON RE-FETCH ---
  // CRITICAL: A re-fetch (cross-tab storage event, SSE live event, cross-device
  // poll) can land between the moment the user edits a collection and the debounced
  // flush that writes it to the server. If that re-fetch applies the server state
  // wholesale, the unsaved local CRUD vanishes from the UI and from localStorage —
  // "actions saved temporarily then revert to old data". This helper overlays the
  // pending local values (dirtyValuesRef snapshots, recorded at saveAllData time)
  // on top of any incoming server state so local edits ALWAYS win until flushed.
  const protectDirtyCollections = (serverState: any): any => {
    if (!serverState || typeof serverState !== 'object' || Array.isArray(serverState)) return serverState;
    const pending = dirtyValuesRef.current as Record<string, any>;
    const keys = Object.keys(pending).filter(k => pending[k] !== undefined);
    const out: any = { ...serverState };

    // 1. Wholesale overlay of currently-dirty collections (local wins for the exact
    //    collections the user edited since last ack). This is the primary guard.
    for (const k of keys) out[k] = pending[k];

    // 2. PER-RECORD updated_at merge (Requirement 2a/2b): even for collections NOT in
    //    the dirty snapshot — e.g. already-acked edits, or edits that bypassed
    //    dirtyValuesRef — never let a background re-fetch overwrite a local record
    //    whose updated_at is NEWER than the server's copy of that same record. This
    //    closes the gap where a version-based poll accepted a stale server blob that
    //    predated the readonly debounced flush (the 5-10 min rollback window).
    const localState = dbStateRef.current as Record<string, any>;
    if (localState && typeof localState === 'object') {
      (Object.keys(localState) as string[]).forEach((ck) => {
        const localArr = localState[ck];
        const serverArr = out[ck];
        if (!Array.isArray(localArr) || !Array.isArray(serverArr)) return;
        // Skip if this collection is already fully protected by the dirty overlay.
        if (keys.includes(ck)) return;
        const serverById = new Map<string, any>();
        serverArr.forEach((sr: any) => { if (sr && sr.id != null) serverById.set(String(sr.id), sr); });
        const localById = new Map<string, any>();
        localArr.forEach((lr: any) => { if (lr && lr.id != null) localById.set(String(lr.id), lr); });
        let changed = false;
        const mergedArr: any[] = [];
        // Combine every unique id (server order first, then append local-only so
        // nothing is dropped). Per-record outcome: newer local wins, else server.
        serverArr.forEach((sr: any) => {
          if (!sr || sr.id == null) return;
          const id = String(sr.id);
          const lr = localById.get(id);
          if (!lr) { mergedArr.push(sr); return; } // server-only → keep server
          const localTs = Number(lr.updated_at ?? lr.updatedAt ?? 0);
          const serverTs = Number(sr.updated_at ?? sr.updatedAt ?? 0);
          if (localTs > 0 && serverTs > 0 && localTs > serverTs) { changed = true; mergedArr.push(lr); }
          else if (localTs > 0 && serverTs === 0) { changed = true; mergedArr.push(lr); }
          else mergedArr.push(sr);
        });
        // Append local-only records (created locally, not yet on the server).
        localArr.forEach((lr: any) => {
          if (!lr || lr.id == null) return;
          if (!serverById.has(String(lr.id))) { mergedArr.push(lr); changed = true; }
        });
        if (changed) out[ck] = sanitizeArray(mergedArr) as any;
      });
    }

    if (keys.length > 0) {
      console.log(`[Sync] Re-fetch merged ${keys.length} pending local collection(s) over server state — local edits preserved`);
    }
    return out;
  };

  // Server fan-in guard: the PHP blob is last-writer-wins, so an incoming payload
  // (realtime SSE, cross-device poll, pre-login sync) must never overwrite state that
  // is newer locally (e.g. a language change made this session). A payload with no
  // usable timestamp is always applied (legacy/corrupt records lose out).
  // Version (monotonic BIGINT) is the primary detector — fixes same-second collisions;
  // timestamp is the fallback for legacy servers.
  const shouldApplyIncomingState = (incoming: any): boolean => {
    const incomingVer = Number(incoming?._version ?? incoming?.version ?? 0);
    const localVer = lastServerVersionRef.current;

    if (Number.isFinite(incomingVer) && incomingVer > 0) {
      if (localVer <= 0) return true;            // Server has versioned data, client doesn't → apply
      if (incomingVer > localVer) return true;    // Server version is newer → apply
      if (incomingVer < localVer) return false;   // Server version is older → stale, skip
      return false;                               // Same version → nothing changed, skip
    }

    // No version available (both 0) — accept the incoming state (initial/bootstrap)
    return true;
  };

  // --- AUTH / SECURITY STATES ---
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showForcePasswordModal, setShowForcePasswordModal] = useState(false);
  const [forceNewPass, setForceNewPass] = useState('');
  const [forceConfirmPass, setForceConfirmPass] = useState('');
  const [authView, setAuthView] = useState<'login' | 'forgot' | 'reset' | 'home' | 'register'>('home');
  const [resetToken, setResetToken] = useState<string | null>(null);

  // LOGIN DEADLOCK FIX (2026-09-07-05): single-flight guard for the login submit so two
  // rapid submissions (Enter key + Authorize Entry click, or a double-click) can never
  // run two concurrent apiLoginAtomic / credential-validation flows against the same
  // localStorage keys. Covers the whole async handler body.
  const loginInFlightRef = React.useRef<boolean>(false);
  // Mirrors the lock into render state so the Authorize Entry button visibly disables and
  // shows "Signing in..." while a login is in flight — preventing any further clicks.
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  // --- PUBLIC MARKETPLACE ROUTING (outside the internal system) ---
  const isPublicMarketplacePath = (p: string) =>
    p.startsWith('/marketplace') || p.startsWith('/product/') || p.startsWith('/company/') || p.startsWith('/mikoa/') ||
    p.startsWith('/search') || p.startsWith('/ref/') || p.startsWith('/affiliate/');

  // LOGIN DEADLOCK FIX (2026-09-07-05): auth-only routes (/login, /register, /forgot-password,
  // /reset-password) must NOT run the boot-time company snapshot + full get_state resolution
  // BEFORE an authenticated session exists. On those routes the old boot sequence resolved a
  // stale localStorage company and fired authoritative snapshot fetches (each with a 10-20s
  // timeout) while the user was still on the login form — on a slow/unreachable backend this
  // hung `setPhpSyncing(false)`/`bootPhaseRef` and froze the Authorize Entry flow. We defer that
  // heavy boot to AFTER a successful login. Public / and /marketplace* routes (no auth needed)
  // keep the full boot so the storefront/homepage data still loads.
  const isAuthOnlyRoute = (p: string) =>
    p.endsWith('/login') || p.endsWith('/register') || p.endsWith('/forgot-password') || p.endsWith('/reset-password') || p.endsWith('/register-complete');
  const [mpPath, setMpPath] = useState<string>(() => {
    try { return window.location.pathname; } catch { return '/'; }
  });
  const goMarketplace = (path: string) => {
    if (window.history && window.history.pushState) {
      window.history.pushState({}, '', path);
    }
    setMpPath(path);
    window.scrollTo(0, 0);
  };

  // Registration confirmation payload (post-submission screen)
  const [registrationResult, setRegistrationResult] = useState<PendingVerificationData | null>(null);

  // Resubmission modal for Rejected company accounts
  const [resubmitOpen, setResubmitOpen] = useState(false);

  // Demo setup modal (user picks username + password before provisioning)
  const [demoSetupOpen, setDemoSetupOpen] = useState(false);

  // --- INTERACTIVE UI MODALS STATES ---
  const [fifoBatchProduct, setFifoBatchProduct] = useState<StockItem | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // One-time build log — fires exactly ONCE per browser session load. The window flag
  // resets on a real page reload (new session => fresh log) but survives component
  // remounts within the same session (error-boundary recovery, hot-reload), so a
  // remount can never re-log boot or suggest a re-boot happened. The sync loop fix is
  // structural (no reload inside cross-device handlers); this guard is defense-in-depth.
  useEffect(() => {
    if ((window as any).__TRADECORE_BUILD_LOGGED__) return;
    (window as any).__TRADECORE_BUILD_LOGGED__ = true;
    console.log('[TradeCore] build 2026-09-08-1');
  }, []);

  useEffect(() => {
    const unsubscribe = toast.subscribe((newToast) => {
      setToasts(prev => [...prev, newToast]);
      if (newToast.duration !== 0) {
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== newToast.id));
        }, newToast.duration || 4000);
      }
    });
    return unsubscribe;
  }, []);

  // Detect direct visits to /forgot-password, /reset-password?token=..., /login, /register, /marketplace* or the public homepage
  useEffect(() => {
    try {
      const path = window.location.pathname.replace(/\/+$/, '');
      if (isPublicMarketplacePath(path)) {
        setMpPath(path);
      } else if (path.endsWith('/forgot-password')) {
        setAuthView('forgot');
      } else if (path.endsWith('/reset-password')) {
        const params = new URLSearchParams(window.location.search);
        setResetToken(params.get('token'));
        setAuthView('reset');
      } else if (path.endsWith('/login')) {
        setAuthView('login');
      } else if (path.endsWith('/register')) {
        setAuthView('register');
      } else {
        setAuthView('home');
      }
    } catch (e) {}
  }, []);

  // MEGA Phase 1 — Affiliate: capture ?ref=CODE or /ref/CODE, store a 30-day cookie + click record.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      let refCode = params.get('ref') || '';
      const path = window.location.pathname.replace(/\/+$/, '');
      if (!refCode && path.startsWith('/ref/')) {
        refCode = path.split('/')[2] || '';
      }
      if (!refCode) return;
      refCode = decodeURIComponent(refCode).trim();
      if (!refCode) return;
      setAffiliateRefCookie(refCode);
      const existing = (dbStateRef.current.affiliates || []).find(a => a.referralCode.toLowerCase() === refCode.toLowerCase() && a.isActive);
      if (existing) {
        const nowIso = new Date().toISOString();
        const click = { id: Date.now(), affiliateId: existing.id, url: window.location.href, clickedAt: nowIso };
        saveAllData({ affiliateClicks: [...(dbStateRef.current.affiliateClicks || []), click].slice(0, 2000) });
      }
    } catch (e) {}
  }, []);

  // Keep the public auth view in sync with browser back/forward navigation
  useEffect(() => {
    const onPopState = () => {
      try {
        const path = window.location.pathname.replace(/\/+$/, '');
        setMpPath(isPublicMarketplacePath(path) ? path : '/');
        if (isPublicMarketplacePath(path)) return;
      } catch (e) {}
      if (currentUser) return;
      try {
        const path = window.location.pathname.replace(/\/+$/, '');
        if (path.endsWith('/forgot-password')) {
          setAuthView('forgot');
        } else if (path.endsWith('/reset-password')) {
          const params = new URLSearchParams(window.location.search);
          setResetToken(params.get('token'));
          setAuthView('reset');
        } else if (path.endsWith('/login')) {
          setAuthView('login');
        } else if (path.endsWith('/register')) {
          setAuthView('register');
        } else {
          setAuthView('home');
        }
      } catch (e) {}
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
    } catch {}
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  // Public (unauthenticated) page theme: 'milk' (light, golden accents) or 'dark' (Dark Gold / deep blue)
  const [publicTheme, setPublicTheme] = useState<'milk' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('tradecore_public_theme');
      return saved === 'milk' ? 'milk' : 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('tradecore_public_theme', publicTheme);
    } catch {}
  }, [publicTheme]);

  const togglePublicTheme = () => {
    setPublicTheme(prev => (prev === 'milk' ? 'dark' : 'milk'));
  };

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('tradecore_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleSidebarCollapsed = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('tradecore_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showGameModal, setShowGameModal] = useState(false);
  
  // Modals for Stock
  const [showStockModal, setShowStockModal] = useState(false);
  const [editingStockItem, setEditingStockItem] = useState<StockItem | null>(null);
  const [formUseSubUnit, setFormUseSubUnit] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferProductId, setTransferProductId] = useState<number | null>(null);
  const [expandedStockIds, setExpandedStockIds] = useState<number[]>([]);
  const [selectedStockIds, setSelectedStockIds] = useState<number[]>([]);
  
  // Stock list filters
  const [stockSearchQuery, setStockSearchQuery] = useState('');
  const [stockFilterCategory, setStockFilterCategory] = useState('');
  const [transferFilter, setTransferFilter] = useState<'All' | 'Pending' | 'In-Transit' | 'Completed' | 'Rejected'>('All');
  const [currencySandboxAmount, setCurrencySandboxAmount] = useState<string>('1');
  const [localExchangeRateStr, setLocalExchangeRateStr] = useState<string>('');

  // Pricing & sub-unit calculation state variables
  const [formPurchasePrice, setFormPurchasePrice] = useState<string>('');
  const [formRetailPrice, setFormRetailPrice] = useState<string>('');
  const [formWholesalePrice, setFormWholesalePrice] = useState<string>('');
  const [formPartnerPrice, setFormPartnerPrice] = useState<string>('');
  const [formConversionFactor, setFormConversionFactor] = useState<string>('');
  const [formSubRetailPrice, setFormSubRetailPrice] = useState<string>('');
  const [formSubWholesalePrice, setFormSubWholesalePrice] = useState<string>('');
  const [formSubPartnerPrice, setFormSubPartnerPrice] = useState<string>('');

  const [companyPricingInput, setCompanyPricingInput] = useState<Record<number, {
    purchasePrice: string;
    retailPrice: string;
    wholesalePrice: string;
    partnerPrice: string;
    subUnitRetailPrice: string;
    subUnitWholesalePrice: string;
    subUnitPartnerPrice: string;
  }>>({});

  const [storePricingInput, setStorePricingInput] = useState<Record<number, {
    purchasePrice: string;
    retailPrice: string;
    wholesalePrice: string;
    partnerPrice: string;
    subUnitRetailPrice: string;
    subUnitWholesalePrice: string;
    subUnitPartnerPrice: string;
  }>>({});

  useEffect(() => {
    if (showStockModal) {
      const isUSD = activeCurrency === 'USD';
      const multiplier = isUSD ? 1 : activeExchangeRate;
      
      const initialPrices: Record<number, any> = {};
      const initialStorePrices: Record<number, any> = {};

      if (editingStockItem) {
        setFormPurchasePrice(String(editingStockItem.purchasePrice * multiplier));
        setFormRetailPrice(String(editingStockItem.retailPrice * multiplier));
        setFormWholesalePrice(String(editingStockItem.wholesalePrice * multiplier));
        setFormPartnerPrice(String((editingStockItem.partnerPrice || editingStockItem.retailPrice) * multiplier));
        setFormConversionFactor(editingStockItem.subUnitConversion ? String(editingStockItem.subUnitConversion) : '');
        setFormSubRetailPrice(editingStockItem.subUnitRetailPrice !== undefined ? String(editingStockItem.subUnitRetailPrice * multiplier) : '');
        setFormSubWholesalePrice(editingStockItem.subUnitWholesalePrice !== undefined ? String(editingStockItem.subUnitWholesalePrice * multiplier) : '');
        setFormSubPartnerPrice(editingStockItem.subUnitPartnerPrice !== undefined ? String(editingStockItem.subUnitPartnerPrice * multiplier) : '');

        companies.forEach(comp => {
          const cp = editingStockItem.companyPrices?.[comp.id];
          if (cp) {
            initialPrices[comp.id] = {
              purchasePrice: String(cp.purchasePrice * multiplier),
              retailPrice: String(cp.retailPrice * multiplier),
              wholesalePrice: String(cp.wholesalePrice * multiplier),
              partnerPrice: String((cp.partnerPrice ?? cp.retailPrice) * multiplier),
              subUnitRetailPrice: cp.subUnitRetailPrice !== undefined ? String(cp.subUnitRetailPrice * multiplier) : '',
              subUnitWholesalePrice: cp.subUnitWholesalePrice !== undefined ? String(cp.subUnitWholesalePrice * multiplier) : '',
              subUnitPartnerPrice: cp.subUnitPartnerPrice !== undefined ? String(cp.subUnitPartnerPrice * multiplier) : '',
            };
          } else {
            initialPrices[comp.id] = {
              purchasePrice: String(editingStockItem.purchasePrice * multiplier),
              retailPrice: String(editingStockItem.retailPrice * multiplier),
              wholesalePrice: String(editingStockItem.wholesalePrice * multiplier),
              partnerPrice: String((editingStockItem.partnerPrice ?? editingStockItem.retailPrice) * multiplier),
              subUnitRetailPrice: editingStockItem.subUnitRetailPrice !== undefined ? String(editingStockItem.subUnitRetailPrice * multiplier) : '',
              subUnitWholesalePrice: editingStockItem.subUnitWholesalePrice !== undefined ? String(editingStockItem.subUnitWholesalePrice * multiplier) : '',
              subUnitPartnerPrice: editingStockItem.subUnitPartnerPrice !== undefined ? String(editingStockItem.subUnitPartnerPrice * multiplier) : '',
            };
          }
        });

        stores.forEach(st => {
          const sp = editingStockItem.storePrices?.[st.id];
          if (sp) {
            initialStorePrices[st.id] = {
              purchasePrice: String(sp.purchasePrice * multiplier),
              retailPrice: String(sp.retailPrice * multiplier),
              wholesalePrice: String(sp.wholesalePrice * multiplier),
              partnerPrice: String((sp.partnerPrice ?? sp.retailPrice) * multiplier),
              subUnitRetailPrice: sp.subUnitRetailPrice !== undefined ? String(sp.subUnitRetailPrice * multiplier) : '',
              subUnitWholesalePrice: sp.subUnitWholesalePrice !== undefined ? String(sp.subUnitWholesalePrice * multiplier) : '',
              subUnitPartnerPrice: sp.subUnitPartnerPrice !== undefined ? String(sp.subUnitPartnerPrice * multiplier) : '',
            };
          } else {
            initialStorePrices[st.id] = {
              purchasePrice: String(editingStockItem.purchasePrice * multiplier),
              retailPrice: String(editingStockItem.retailPrice * multiplier),
              wholesalePrice: String(editingStockItem.wholesalePrice * multiplier),
              partnerPrice: String((editingStockItem.partnerPrice ?? editingStockItem.retailPrice) * multiplier),
              subUnitRetailPrice: editingStockItem.subUnitRetailPrice !== undefined ? String(editingStockItem.subUnitRetailPrice * multiplier) : '',
              subUnitWholesalePrice: editingStockItem.subUnitWholesalePrice !== undefined ? String(editingStockItem.subUnitWholesalePrice * multiplier) : '',
              subUnitPartnerPrice: editingStockItem.subUnitPartnerPrice !== undefined ? String(editingStockItem.subUnitPartnerPrice * multiplier) : '',
            };
          }
        });
      } else {
        setFormPurchasePrice('');
        setFormRetailPrice('');
        setFormWholesalePrice('');
        setFormPartnerPrice('');
        setFormConversionFactor('');
        setFormSubRetailPrice('');
        setFormSubWholesalePrice('');
        setFormSubPartnerPrice('');

        companies.forEach(comp => {
          initialPrices[comp.id] = {
            purchasePrice: '',
            retailPrice: '',
            wholesalePrice: '',
            partnerPrice: '',
            subUnitRetailPrice: '',
            subUnitWholesalePrice: '',
            subUnitPartnerPrice: '',
          };
        });

        stores.forEach(st => {
          initialStorePrices[st.id] = {
            purchasePrice: '',
            retailPrice: '',
            wholesalePrice: '',
            partnerPrice: '',
            subUnitRetailPrice: '',
            subUnitWholesalePrice: '',
            subUnitPartnerPrice: '',
          };
        });
      }
      setCompanyPricingInput(initialPrices);
      setStorePricingInput(initialStorePrices);
    }
  }, [showStockModal, editingStockItem, activeCurrency, activeExchangeRate, companies, stores]);

  const handleMainPriceChange = (field: 'purchase' | 'retail' | 'wholesale' | 'partner', value: string) => {
    if (field === 'purchase') setFormPurchasePrice(value);
    if (field === 'retail') {
      setFormRetailPrice(value);
      const conversion = parseFloat(formConversionFactor);
      const valNum = parseFloat(value);
      if (conversion > 0 && !isNaN(valNum)) {
        setFormSubRetailPrice((valNum / conversion).toFixed(2));
      }
    }
    if (field === 'wholesale') {
      setFormWholesalePrice(value);
      const conversion = parseFloat(formConversionFactor);
      const valNum = parseFloat(value);
      if (conversion > 0 && !isNaN(valNum)) {
        setFormSubWholesalePrice((valNum / conversion).toFixed(2));
      }
    }
    if (field === 'partner') {
      setFormPartnerPrice(value);
      const conversion = parseFloat(formConversionFactor);
      const valNum = parseFloat(value);
      if (conversion > 0 && !isNaN(valNum)) {
        setFormSubPartnerPrice((valNum / conversion).toFixed(2));
      }
    }
  };

  const handleConversionChange = (value: string) => {
    setFormConversionFactor(value);
    const conversion = parseFloat(value);
    if (conversion > 0) {
      const rVal = parseFloat(formRetailPrice);
      if (!isNaN(rVal)) setFormSubRetailPrice((rVal / conversion).toFixed(2));
      const wVal = parseFloat(formWholesalePrice);
      if (!isNaN(wVal)) setFormSubWholesalePrice((wVal / conversion).toFixed(2));
      const pVal = parseFloat(formPartnerPrice);
      if (!isNaN(pVal)) setFormSubPartnerPrice((pVal / conversion).toFixed(2));
    }
  };

  const getMarginText = (sellingPriceStr: string, purchasePriceStr: string) => {
    const sp = parseFloat(sellingPriceStr);
    const pp = parseFloat(purchasePriceStr);
    if (isNaN(sp) || isNaN(pp) || sp <= 0) return null;
    const margin = ((sp - pp) / sp) * 100;
    const isNegative = margin < 0;
    return (
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ml-1.5 ${isNegative ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
        {margin > 0 ? '+' : ''}{margin.toFixed(1)}% {t('margin')}
      </span>
    );
  };

  const getSubMarginText = (subSellingPriceStr: string, purchasePriceStr: string, conversionStr: string) => {
    const ssp = parseFloat(subSellingPriceStr);
    const pp = parseFloat(purchasePriceStr);
    const conv = parseFloat(conversionStr);
    if (isNaN(ssp) || isNaN(pp) || isNaN(conv) || conv <= 0 || ssp <= 0) return null;
    const subPP = pp / conv;
    const margin = ((ssp - subPP) / ssp) * 100;
    const isNegative = margin < 0;
    return (
      <span className={`text-[9px] font-bold px-1 py-0.2 rounded ml-1 ${isNegative ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
        {margin > 0 ? '+' : ''}{margin.toFixed(1)}% {t('margin')}
      </span>
    );
  };
  
  // Modals for PO/SO
  const [showPOModal, setShowPOModal] = useState(false);
  const [showSOModal, setShowSOModal] = useState(false);

  // Confirmation Modal
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

  // Master Modals
  const [showMasterModal, setShowMasterModal] = useState<{ type: string; obj: any } | null>(null);

  // PHP Server Sync & Real-time State
  const [isSyncingWithPhp, setIsSyncingWithPhp] = useState<boolean>(false);
  const isSyncingWithPhpRef = React.useRef<boolean>(false);
  const setPhpSyncing = (v: boolean) => { isSyncingWithPhpRef.current = v; setIsSyncingWithPhp(v); };
  const [phpSyncMessage, setPhpSyncMessage] = useState<string>('Synchronizing data with PHP server...');
  const [showPhpConfigModal, setShowPhpConfigModal] = useState<boolean>(false);
  const [phpApiUrlInput, setPhpApiUrlInput] = useState<string>(getPhpConfig().apiUrl);
  const [phpWsUrlInput, setPhpWsUrlInput] = useState<string>(getPhpConfig().wsUrl);
  const [phpApiKeyInput, setPhpApiKeyInput] = useState<string>(getPhpConfig().apiKey || '');

  // Background save coalescing: many rapid actions (POS rings, form typing) collapse into a
  // single debounced server POST so the UI never waits on the network. The full state is always
  // captured at flush time, so no change is ever lost — only the round-trips are batched.
  const pendingFlushTimerRef = React.useRef<number | null>(null);
  const flushInFlightRef = React.useRef<boolean>(false);
  const flushDirtyRef = React.useRef<boolean>(false);
  // SEQUENTIAL FLUSH QUEUE (2026-09-07-03) — coalesce token. While a flush HTTP request
  // is in flight (isFlushing === true), any NEW dirty-key trigger (a timer firing, a
  // saveAllData, a master-key edit) is NEVER allowed to open a second HTTP call. It
  // instead sets this ONE pending-batch token; the running pass drains it immediately
  // after committing — AFTER locking clientVersion to the fresh response.serverVersion —
  // so the queued delta can never send a stale base version and 409 on its own sibling.
  const flushQueuedRef = React.useRef<boolean>(false);
  // Waiters that want notification once the PHP flush pipeline is quiescent.
  // Resolved in flushToPhp's finally; settleFlushes uses them (with a poll fallback)
  // so a company-switch resync never races an in-flight save_state write.
  const pendingFlushWaitersRef = React.useRef<Array<() => void>>([]);
  // Company-switch anti-loop guards:
  //  - lastResyncedCompanyRef remembers the company we ALREADY fetched an authoritative
  //    snapshot for, so flush-settled / storage events re-firing for the SAME target skip.
  //  - resyncInFlightRef blocks re-entrant scheduling while a resync is still running.
  const lastResyncedCompanyRef = React.useRef<string | null>(null);
  const resyncInFlightRef = React.useRef<boolean>(false);
  // Explicit company switches ONLY: committed by the header/settings company dropdowns
  // and ROOT impersonation. Any other currentCompanyId change (role-scope re-defaulting,
  // snapshot replay, cross-device echo) is AUTOMATIC and must never persist/resync a
  // different company (the old behavior produced the infinite "1 -> 2 -> 1 forcing
  // resync" ping-pong and resurrected a deleted company on every login).
  const explicitCompanySwitchRef = React.useRef<boolean>(false);
  // BOOT-PHASE LOCK: while initPhpSync is still loading the authoritative per-company
  // snapshot, the company-switch effect must NEVER auto-switch / resync. Role-scope
  // effects may set currentCompanyId mid-boot (e.g. Super Admin defaulting to the first
  // company), which previously produced "Company switched 2 -> 1 forcing resync" and the
  // boot-shake loop. Cleared to true only when initial sync completes.
  const bootPhaseRef = React.useRef<boolean>(false);

  // --- PENDING QUEUE: local changes not yet confirmed by server ---
  // Instead of sending the full 50KB+ blob on every flush, we only send
  // the pending operations (create/update/delete) which are typically < 5KB.
  interface PendingOp {
    op: 'upsert' | 'delete';
    table: string; // e.g. 'marketplaceProducts', 'users', 'salesOrders'
    id: string | number;
    data?: any; // the full record for upsert, null for delete
    timestamp: number;
  };
  const getPendingQueue = (): PendingOp[] => getQueueSnapshot() as PendingOp[];
  const setPendingQueue = (q: PendingOp[]) => { replaceQueue(q as any); };
  const pushPendingOp = (op: PendingOp) => {
    queueMutations([op as any]);
  };
  const clearPendingQueue = () => { clearQueue(); };
  const applyPendingQueue = (state: any, queue: PendingOp[]): any => {
    if (!queue.length || !state) return state;
    const result = { ...state };
    for (const item of queue) {
      if (!result[item.table] || !Array.isArray(result[item.table])) continue;
      if (item.op === 'upsert' && item.data) {
        const idx = result[item.table].findIndex((r: any) => String(r.id) === String(item.id));
        if (idx >= 0) result[item.table] = [...result[item.table].slice(0, idx), item.data, ...result[item.table].slice(idx + 1)];
        else result[item.table] = [...result[item.table], item.data];
      } else if (item.op === 'delete') {
        result[item.table] = result[item.table].filter((r: any) => String(r.id) !== String(item.id));
      }
    }
    return result;
  };

  // Cross-tab sync: when another tab updates tradecore_data, re-fetch from server
  const syncChannelRef = React.useRef<BroadcastChannel | null>(null);
  const syncTimeoutRef = React.useRef<number | null>(null);
  const cleanCrossTabTimer = () => {
    if (syncTimeoutRef.current !== null) {
      window.clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
  };
  // Shared cross-tab re-fetch: debounced, guards against redundant applies/echo loops.
  const pendingCrossTabRefetchRef = React.useRef<number>(0);
  const scheduleCrossTabRefetch = (incomingVersion: number) => {
    // OFFLINE: never issue a re-fetch while disconnected — a failed fetch now would
    // reject uncaught into the sync path and cascade. Remember the desired version and
    // let the 'online' listener re-trigger it once the network is back (without touching
    // active React state).
    if (offlineRef.current) {
      if (incomingVersion > pendingCrossTabRefetchRef.current) pendingCrossTabRefetchRef.current = incomingVersion;
      return;
    }
    if (incomingVersion > 0 && incomingVersion <= lastServerVersionRef.current) return;
    cleanCrossTabTimer();
    syncTimeoutRef.current = window.setTimeout(async () => {
      syncTimeoutRef.current = null;
      isApplyingRemoteUpdateRef.current = true;
      try {
        const fullState = await fetchSystemDataFromPhp();
        if (!fullState) return;
        const fetchedVer = Number((fullState as any)._version ?? (fullState as any).version ?? 0);
        const currentVer = lastServerVersionRef.current;
        if (fetchedVer > 0 && currentVer > 0 && fetchedVer <= currentVer) return;
        // The entire apply (including the version-key write below) runs under the
        // isApplyingRemoteUpdateRef guard so the storage event it triggers in THIS
        // tab is ignored — breaks the write → storage-event → re-fetch → write loop.
        if (fetchedVer > 0) { lastServerVersionRef.current = fetchedVer; lastRealtimeVersionRef.current = fetchedVer; noteServerVersion(fetchedVer); }
        if (fullState.lastUpdated) noteStateTimestamp(fullState.lastUpdated);
        if ((fullState as any)._serverUpdatedAt) lastServerTimestampRef.current = (fullState as any)._serverUpdatedAt;
        console.log('[Sync] Cross-tab: applying fetched update');
        const mergedState = protectDirtyCollections(fullState);
        applyData(mergedState, true);
        usersSyncedRef.current = true;
        localStorage.setItem('tradecore_data', JSON.stringify(mergedState));
      } catch (err) {
        console.warn('[Sync] Cross-tab re-fetch failed:', err);
      } finally {
        isApplyingRemoteUpdateRef.current = false;
      }
    }, 300);
  };
  const initCrossTabSync = () => {
    try {
      const ch = new BroadcastChannel('tradecore_sync');
      ch.onmessage = (e) => {
        const msg = e.data;
        if (!msg || typeof msg !== 'object') return;
        // Self-echo guard: ignore our own message. senderId is the canonical field;
        // tabId is accepted for older cached bundles in other tabs (defense-in-depth).
        if (msg.senderId === TAB_ID) return;
        if (msg.tabId && msg.tabId === TAB_ID) return;
        const msgVer = Number(msg.version ?? 0);
        // Don't log or re-fetch if we already have this version. lastServerVersionRef
        // tracks the highest version WE have APPLIED, and server versions are globally
        // monotonic, so a known version means our state is already current — ignoring
        // it is correct deduplication, not a stale-skip.
        if (msgVer > 0 && msgVer <= lastServerVersionRef.current) return;
        console.log('[Sync] Cross-tab: another tab updated server data, re-fetching...');
        scheduleCrossTabRefetch(msgVer);
      };
      syncChannelRef.current = ch;
    } catch {}
  };
  const notifyCrossTab = (version?: unknown) => {
    try {
      const v = Number(version ?? getLastServerVersion() ?? 0);
      if (v > 0 && v <= lastNotifiedVersionRef.current) return; // already notified for this version
      lastNotifiedVersionRef.current = v;
      syncChannelRef.current?.postMessage({ type: 'DB_CHANGE', senderId: TAB_ID, tabId: TAB_ID, version: v });
    } catch {}
  };

  // forceSync: hard refresh — clears all local state and reloads from server
  const forceSync = () => {
    try {
      clearQueue();
      localStorage.removeItem('tradecore_data');
      localStorage.removeItem('tradecore_pending_queue');
      localStorage.removeItem('tradecore_data_cache');
      localStorage.removeItem('tradecore_server_version');
    } catch {}
    location.reload();
  };

  // Optimistic local cache: the full-state JSON.stringify is deferred one tick and
  // coalesced, so heavy payloads (marketplace media) never block the action that
  // triggered the save. A pending payload is flushed synchronously on unload.
  const localCachePayloadRef = React.useRef<any>(null);
  const localCacheTimerRef = React.useRef<number | null>(null);
  const flushPendingLocalCacheSync = () => {
    if (localCacheTimerRef.current !== null) {
      window.clearTimeout(localCacheTimerRef.current);
      localCacheTimerRef.current = null;
    }
    const payload = localCachePayloadRef.current;
    localCachePayloadRef.current = null;
    if (payload) {
      try {
        localStorage.setItem('tradecore_data', JSON.stringify(payload));
      } catch (err) {
        console.warn('[localStorage] Quota exceeded while caching state (large media may not persist locally).', err);
      }
    }
  };

  // Seeder policy: default users are seeded ONLY when the user list is COMPLETELY
  // empty (fresh install). A default user intentionally deleted by the Founder is
  // recorded in settings.deletedDefaultUsers and must never be auto-recreated.
  const isDefaultUserDeleted = (settingsData: any, username: string) =>
    (settingsData?.deletedDefaultUsers || []).some(
      (d: string) => d.toLowerCase() === username.toLowerCase()
    );

  const seedDefaultUsersIfEmpty = (rawUsers: any[], settingsData: any): any[] => {
    if (!Array.isArray(rawUsers) || rawUsers.length > 0) return Array.isArray(rawUsers) ? rawUsers : [];
    return defaultUsers.filter(defU => !isDefaultUserDeleted(settingsData, defU.username));
  };

  // Merge marketplace defaults onto a company so older persisted state still renders a live storefront.
  // An approved/verified company is ALWAYS marketplace-active (verified = live store) even if older data
  // accidentally persisted the old default of isMarketplaceActive: false.
  const ensureMarketplaceCompanyDefaults = (c: any): any => {
    const seed = defaultCompanies.find(dc => dc.id === c.id);
    const merged = { ...(seed || {}), ...c };
    return {
      ...merged,
      slug: merged.slug || slugify(merged.name || `company-${merged.id}`),
      isVerified: merged.subscriptionApproved === true ? true : (merged.isVerified ?? seed?.isVerified === true),
      isMarketplaceActive: merged.subscriptionApproved === true || merged.isVerified === true || (merged.isMarketplaceActive ?? !!seed?.isMarketplaceActive),
      latitude: merged.latitude ?? seed?.latitude,
      longitude: merged.longitude ?? seed?.longitude,
      region: merged.region ?? seed?.region,
      district: merged.district ?? seed?.district,
      ward: merged.ward ?? seed?.ward,
      phone: merged.phone ?? seed?.phone,
      whatsappNumber: merged.whatsappNumber ?? seed?.whatsappNumber,
      paymentMethods: merged.paymentMethods && merged.paymentMethods.length > 0 ? merged.paymentMethods : (seed?.paymentMethods || [])
    };
  };

  // Demo/seed marketplace products that ship with the template must never appear on the public
  // marketplace. They are stripped from persisted state so real registered products are the only
  // ones customers can see.
  const DEFAULT_SEED_PRODUCTS: Array<[number, string]> = [
    [1, 'Mchele Singida 25kg'],
    [2, 'Mafuta ya Alizeti 5L'],
    [3, 'Sukari 50kg'],
    [4, 'Mahindi (Maize) 50kg'],
    [5, 'Samsung Galaxy A15 128GB'],
    [6, 'Charger Original 25W'],
    [7, 'Power Bank 20000mAh']
  ];
  const isDefaultSeedProduct = (p: { id: number; name: string }): boolean =>
    DEFAULT_SEED_PRODUCTS.some(([id, name]) => p.id === id && p.name === name);

  // Apply parsed cloud/local database state to React state
  const applyData = (parsed: any, isRemoteApply: boolean = false) => {
    // Anti-storm circuit breaker: if applyData is invoked >30x/sec it means a
    // sync loop (cross-tab echo, SSE self-echo, 409 rebase) is spiraling. Each
    // applyData drives ~70 setState calls, which is exactly what triggers React
    // #185 (Maximum update depth exceeded). Suppress re-entrant storms so the
    // app stays alive and the debounce in scheduleCrossTabRefetch settles it.
    const nowMs = Date.now();
    const thr = applyDataThrottleRef.current;
    if (nowMs - thr.windowStart > 1000) {
      thr.windowStart = nowMs;
      thr.count = 0;
    }
    thr.count++;
    if (thr.count > 30) {
      console.warn('[Sync] applyData storm detected — suppressing re-entrant apply to prevent React #185');
      return;
    }
    // CRITICAL: Sanitize all collection arrays on entry to prevent undefined entries
    // from crashing React internals (e.g. reportAllChanges reading startTime).
    // This catches corrupted localStorage, malformed server responses, and any other
    // source of array-with-holes.
    parsed = sanitizeStateData(parsed);
    const loadedCompaniesRaw = (parsed.companies || defaultCompanies).map((c: any) => {
      if (!c.themeColor) {
        const matchedDefault = defaultCompanies.find((dc: any) => dc.id === c.id);
        return {
          ...c,
          themeColor: matchedDefault?.themeColor || (c.id === 2 ? '#1e3a8a' : '#c41e3a')
        };
      }
      return c;
    }).map((c: any) => ensureMarketplaceCompanyDefaults(c));

    // SEO: backfill any missing company slugs (name + city) and guarantee uniqueness
    const usedCompanySlugs = new Set<string>();
    const loadedCompanies = loadedCompaniesRaw.map((c: any) => {
      const city = c.region || c.district || '';
      const base = c.slug && String(c.slug).trim() ? String(c.slug) : slugify(city ? `${c.name} ${city}` : `${c.name}`);
      let slug = base;
      let n = 2;
      while (usedCompanySlugs.has(slug)) { slug = `${base}-${n++}`; }
      usedCompanySlugs.add(slug);
      return { ...c, slug };
    });

    const parsedSettings = parsed.settings || defaultSettings;
    if (!parsedSettings.subscriptionMeta) {
      parsedSettings.subscriptionMeta = defaultSubscriptionMeta;
    }
    // ROOT_MANDATE: guarantee editable defaults exist on any previously saved state
    if (!parsedSettings.homepageContent) parsedSettings.homepageContent = defaultHomepageContent;
    if (!parsedSettings.siteConfig) parsedSettings.siteConfig = defaultSiteConfig;
    if (!parsedSettings.marketplaceRegions || !Array.isArray(parsedSettings.marketplaceRegions) || parsedSettings.marketplaceRegions.length === 0) {
      parsedSettings.marketplaceRegions = [...TANZANIA_REGIONS];
    }
    if (!parsedSettings.homepageMeta) {
      parsedSettings.homepageMeta = defaultSettings.homepageMeta;
    }
    // New billing model: backfill currencies, plans & subscription records on every load
    if (!parsedSettings.currencies || !Array.isArray(parsedSettings.currencies) || parsedSettings.currencies.length === 0) {
      parsedSettings.currencies = [...defaultCurrencies];
    }
    if (!parsedSettings.subscriptionPlans || !Array.isArray(parsedSettings.subscriptionPlans) || parsedSettings.subscriptionPlans.length === 0) {
      parsedSettings.subscriptionPlans = [...defaultTradePlans];
    }
    if (!parsedSettings.companySubscriptions || !Array.isArray(parsedSettings.companySubscriptions)) {
      parsedSettings.companySubscriptions = [];
    }
    let rawUsers = parsed.users || [];
    // Seed defaults ONLY on a completely empty user list (fresh install).
    // Deleted default users (settings.deletedDefaultUsers) are never re-created.
    rawUsers = seedDefaultUsersIfEmpty(rawUsers, parsedSettings);

    // Auto-unblock core super admin accounts on every state load
    rawUsers = rawUsers.map(u => {
      if ((u.username === 'root_mandate' || u.username === 'superadmin') && (u.status === 'Blocked' || u.remoteTerminated)) {
        return { ...u, status: 'Active' as const, remoteTerminated: false };
      }
      // ROOT_MANDATE: enforce root identity + support email on every load
      if (u.username === 'root_mandate') {
        return { ...u, isRoot: true, email: 'globaltradecore@gmail.com' };
      }
      return u;
    });

    const loadedProductsSlugs = new Set<string>();
    const loadedProducts = (parsed.marketplaceProducts || defaultMarketplaceProducts)
      .filter(p => !isDefaultSeedProduct(p))
      .map(p => {
        // Products saved while a company was not yet verified carry status 'pending' and are hidden.
        // Derive approval from the COMPANY state on every load so a product becomes public as soon
        // as its company is approved/verified — even if the approval happened in another browser.
        const comp = loadedCompanies.find(c => c.id === p.companyId);
        if (comp && (comp.subscriptionApproved === true || comp.isVerified === true) && p.status === 'pending') {
          return { ...p, status: 'approved' as const };
        }
        return p;
      })
      // SEO: backfill any missing product slugs (name + city) and guarantee uniqueness
      .map(p => {
        const comp = loadedCompanies.find(c => c.id === p.companyId);
        const city = comp?.region || comp?.district || '';
        const base = p.slug && String(p.slug).trim() ? String(p.slug) : slugify(city ? `${p.name} ${city}` : `${p.name}`);
        let slug = base;
        let n = 2;
        while (loadedProductsSlugs.has(slug)) { slug = `${base}-${n++}`; }
        loadedProductsSlugs.add(slug);
        return { ...p, slug };
      });

    // Reviews & product-views: normalize stored rows, then recompute every aggregate
    // (average_rating / reviews_count) from approved reviews so cached numbers can never drift.
    const loadedReviews: Review[] = Array.isArray(parsed.reviews) ? parsed.reviews : [];
    const loadedProductViews: ProductView[] = Array.isArray(parsed.productViews) ? parsed.productViews : [];

    const rated = computeRatings(loadedReviews, loadedCompanies, loadedProducts);

    const updatedState = {
      companies: rated.companies,
      branches: parsed.branches ?? (dbStateRef.current.branches || []),
      stores: parsed.stores ?? (dbStateRef.current.stores || []),
      users: rawUsers,
      categories: parsed.categories ?? (dbStateRef.current.categories || []),
      taxes: parsed.taxes ?? (dbStateRef.current.taxes || []),
      suppliers: parsed.suppliers ?? (dbStateRef.current.suppliers || []),
      customers: parsed.customers ?? (dbStateRef.current.customers || []),
      stockItems: parsed.stockItems ?? (dbStateRef.current.stockItems || []),
      purchaseOrders: parsed.purchaseOrders ?? (dbStateRef.current.purchaseOrders || []),
      salesOrders: parsed.salesOrders ?? (dbStateRef.current.salesOrders || []),
      expenses: parsed.expenses ?? (dbStateRef.current.expenses || []),
      auditTrails: parsed.auditTrails || defaultAuditTrails,
      securityLogs: parsed.securityLogs || defaultSecurityLogs,
      settings: parsedSettings,
      rolePermissions: parsed.rolePermissions ?? (dbStateRef.current.rolePermissions || defaultRolePermissions),
      posShifts: parsed.posShifts ?? (dbStateRef.current.posShifts || []),
      stockTransfers: parsed.stockTransfers ?? (dbStateRef.current.stockTransfers || []),
      contactMessages: parsed.contactMessages ?? (dbStateRef.current.contactMessages || []),
      marketplaceProducts: rated.products,
      marketplaceCustomers: parsed.marketplaceCustomers ?? (dbStateRef.current.marketplaceCustomers || []),
      marketplaceOrders: parsed.marketplaceOrders ?? (dbStateRef.current.marketplaceOrders || []),
      marketplaceClicks: parsed.marketplaceClicks ?? (dbStateRef.current.marketplaceClicks || []),
      reviews: loadedReviews,
      productViews: loadedProductViews,
      wallets: parsed.wallets ?? (dbStateRef.current.wallets || []),
      walletTransactions: parsed.walletTransactions ?? (dbStateRef.current.walletTransactions || []),
      withdrawals: parsed.withdrawals ?? (dbStateRef.current.withdrawals || []),
      affiliates: parsed.affiliates ?? (dbStateRef.current.affiliates || []),
      affiliateClicks: parsed.affiliateClicks ?? (dbStateRef.current.affiliateClicks || []),
      affiliateSales: parsed.affiliateSales ?? (dbStateRef.current.affiliateSales || []),
      affiliateWithdrawals: parsed.affiliateWithdrawals ?? (dbStateRef.current.affiliateWithdrawals || []),
      searchSynonyms: parsed.searchSynonyms ?? (dbStateRef.current.searchSynonyms || []),
      pushSubscriptions: parsed.pushSubscriptions ?? (dbStateRef.current.pushSubscriptions || []),
      collections: parsed.collections ?? (dbStateRef.current.collections || []),
      webhookLogs: parsed.webhookLogs ?? (dbStateRef.current.webhookLogs || []),
      adminEarnings: parsed.adminEarnings ?? (dbStateRef.current.adminEarnings || []),
      offers: parsed.offers ?? (dbStateRef.current.offers || []),
      offerMessages: parsed.offerMessages ?? (dbStateRef.current.offerMessages || []),
      groupDeals: parsed.groupDeals ?? (dbStateRef.current.groupDeals || []),
      groupDealParticipants: parsed.groupDealParticipants ?? (dbStateRef.current.groupDealParticipants || []),
      whatsappConversations: parsed.whatsappConversations ?? (dbStateRef.current.whatsappConversations || []),
      notificationLogs: parsed.notificationLogs ?? (dbStateRef.current.notificationLogs || []),
      deliveries: parsed.deliveries ?? (dbStateRef.current.deliveries || []),
      deliveryUpdates: parsed.deliveryUpdates ?? (dbStateRef.current.deliveryUpdates || []),
      installmentPlans: parsed.installmentPlans ?? (dbStateRef.current.installmentPlans || []),
      installmentOrders: parsed.installmentOrders ?? (dbStateRef.current.installmentOrders || []),
      installmentPayments: parsed.installmentPayments ?? (dbStateRef.current.installmentPayments || []),
      liveStreams: parsed.liveStreams ?? (dbStateRef.current.liveStreams || []),
      liveComments: parsed.liveComments ?? (dbStateRef.current.liveComments || []),
      loyaltyCustomers: parsed.loyaltyCustomers ?? (dbStateRef.current.loyaltyCustomers || []),
      loyaltyTransactions: parsed.loyaltyTransactions ?? (dbStateRef.current.loyaltyTransactions || []),
      loyaltyRedeemCodes: parsed.loyaltyRedeemCodes ?? (dbStateRef.current.loyaltyRedeemCodes || []),
      voiceSearches: parsed.voiceSearches ?? (dbStateRef.current.voiceSearches || []),
      qrScans: parsed.qrScans ?? (dbStateRef.current.qrScans || []),
      traReceipts: parsed.traReceipts ?? (dbStateRef.current.traReceipts || []),
      escrowTransactions: parsed.escrowTransactions ?? (dbStateRef.current.escrowTransactions || []),
      chatConversations: parsed.chatConversations ?? (dbStateRef.current.chatConversations || []),
      chatMessages: parsed.chatMessages ?? (dbStateRef.current.chatMessages || []),
      visualSearches: parsed.visualSearches ?? (dbStateRef.current.visualSearches || []),
      productReturns: parsed.productReturns ?? (dbStateRef.current.productReturns || []),
      disputes: parsed.disputes ?? (dbStateRef.current.disputes || []),
      disputeMessages: parsed.disputeMessages ?? (dbStateRef.current.disputeMessages || []),
      flashSales: parsed.flashSales ?? (dbStateRef.current.flashSales || []),
      appNotifications: parsed.appNotifications ?? (dbStateRef.current.appNotifications || []),
      bulkUploads: parsed.bulkUploads ?? (dbStateRef.current.bulkUploads || []),
      stories: parsed.stories ?? (dbStateRef.current.stories || []),
      storyViews: parsed.storyViews ?? (dbStateRef.current.storyViews || []),
      shippingZones: parsed.shippingZones ?? (dbStateRef.current.shippingZones || []),
    };

    // --- REMOTE APPLY: PRESERVE LOCAL DATA WHEN SERVER BLOB OMITS KEYS ---
    // When the server blob doesn't include a collection key (e.g. server is older,
    // or the blob is partial), `parsed.key || []` evaluates to `[]`, which wipes
    // the user's local data. For remote applies, copy the missing key from
    // dbStateRef.current so panels don't disappear.
    if (isRemoteApply && dbStateRef.current) {
      const prev = dbStateRef.current;
      for (const k of Object.keys(prev)) {
        if (k === 'lastUpdated' || k === '_version' || k === '_serverUpdatedAt') continue;
        if (!(k in parsed) && (updatedState as any)[k] === undefined) {
          if (prev[k] !== undefined && prev[k] !== null) {
            (updatedState as any)[k] = prev[k];
          }
        }
      }
    }

    // --- STALE SERVER SNAPSHOT PROTECTION ---
    // Only block X->0 (server returns empty when client has data). Valid deletions
    // like 3->2 companies are ACCEPTED — the database is the source of truth for
    // intentional deletes.
    // NOTE: auditTrails is NOT in STALE_GUARD — it is database-only and not part of the
    // sync blob. When server returns 0, we ACCEPT it and clear dirty tracking to break the
    // infinite 78->0 loop.
    if (isRemoteApply) {
      const STALE_GUARD = [
        'stockItems', 'users', 'companies', 'branches', 'stores', 'categories',
        'salesOrders', 'expenses', 'purchaseOrders', 'suppliers', 'customers',
        'taxes', 'wallets', 'affiliates', 'reviews', 'flashSales', 'stories',
        'disputes', 'deliveries', 'installmentPlans', 'chatConversations',
        'escrowTransactions', 'loyaltyCustomers', 'productReturns', 'marketplaceOrders'
      ] as const;
      for (const key of STALE_GUARD) {
        const incoming = (updatedState as any)[key];
        const current = (dbStateRef.current as any)[key];
        if (!Array.isArray(incoming) || !Array.isArray(current)) continue;
        if (current.length === 0) continue; // First load — accept server data
        // ONLY block when server returns 0 and client has >5 items (stale blob).
        // Accept valid deletions like 3->2, 10->8 etc. — database is source of truth.
        // CATEGORIES (added 2026-09-07): same guard. Categories are a single global array
        // of "co_<cid>:<name>" strings; if a transient empty/company-scoped server array
        // was misapplied, the subsequent flush of the trimmed array would delete the
        // other companies' categories on the server itself — permanent cross-device loss.
        if (incoming.length === 0 && current.length > 3) {
          console.warn(`[applyData] STALE GUARD: ${key} went from ${current.length} to 0 items — keeping local (server blob stale)`);
          (updatedState as any)[key] = current;
        }
      }
      // NOTE: the backend `snapshot` endpoint now returns the authoritative FULL
      // cross-company category set (tcLoadCategories/tcLoadCategoriesN with no company
      // filter) so an empty categories array is a genuine empty — the guard above only
      // protects against a transient broken/empty server blob, never real deletes.
      // auditTrails: BUG 3 FIX — the sync blob NEVER carries auditTrails (it is
      // database-only, rendered from the live DB fetch). So when a full server sync
      // arrives with an EMPTY auditTrails array, it must NOT wipe the local DB-backed
      // audits the Audit Trail UI is already showing (which caused "audit logs flash /
      // reset to 'No core action audits captured yet'"). We PRESERVE the local rows and
      // just clear dirty tracking so no spurious loop is triggered. Because auditTrails
      // is excluded from flush (NON_SYNCED_KEYS), keeping local rows cannot cause a blob loop.
      if (Array.isArray((updatedState as any).auditTrails) && (updatedState as any).auditTrails.length === 0
          && Array.isArray((dbStateRef.current as any)?.auditTrails) && (dbStateRef.current as any).auditTrails.length > 0) {
        (updatedState as any).auditTrails = (dbStateRef.current as any).auditTrails;
        if (flushDirtyKeysRef.current.has('auditTrails')) {
          console.warn(`[applyData] auditTrails: server returned 0 — preserving ${(dbStateRef.current as any).auditTrails.length} local DB-backed audits`);
        }
        flushDirtyKeysRef.current.delete('auditTrails');
        delete (dirtyValuesRef.current as any)['auditTrails'];
      }
    }

    dbStateRef.current = updatedState;
    if (parsed && parsed.lastUpdated) noteStateTimestamp(parsed.lastUpdated);

    applyCollectionState(updatedState);
  };

  // SESSION-SCOPE RESTORE (2026-09-07-02): reads ONLY the session token keys
  // (user_id / role / company_id / branch_id) out of localStorage. This is a pure
  // meta restore: it NEVER loads or applies database snapshot state (no fetch, no IDB
  // read, no applyData) — the durable snapshot is mounted SEPARATELY in the boot effect.
  // Called EXACTLY ONCE at boot, BEFORE the database state is mounted, so the identity
  // restore can never race with, or revert, a later user edit (the old flow re-derived
  // the session from server blobs and re-fires inside post-flush hooks).
  const restoreUserSession = React.useCallback((): { id: any; role?: string; company_id?: any; branch_id?: any; fromRoleCache: boolean } | null => {
    try {
      const savedUser = localStorage.getItem('tradecore_user');
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        if (parsedUser && parsedUser.id) {
          sessionGraceUntilRef.current = Date.now() + 4000;
          setCurrentUser(parsedUser);
          console.log('User session restored (meta-only)');
          return {
            id: parsedUser.id,
            role: parsedUser.role,
            company_id: parsedUser.companyId ?? parsedUser.company_id ?? null,
            branch_id: parsedUser.branchId ?? parsedUser.branch_id ?? null,
            fromRoleCache: false
          };
        }
      }
      // ROLE/SESSION CACHE FALLBACK (fast session): when tradecore_user is missing
      // (cleared mid-session, a background-tab reload, or the first paint racing the
      // server round-trip) restore the compact role cache written at login. TTL 12h —
      // never resurrect a genuinely logged-out/revoked account beyond that.
      const rcRaw = localStorage.getItem('tradecore_role_cache');
      if (rcRaw) {
        const rc = JSON.parse(rcRaw);
        if (rc && rc.id && rc.cachedAt && (Date.now() - rc.cachedAt) < 12 * 3600 * 1000) {
          const rcUser: any = {
            id: rc.id,
            username: rc.username ?? 'guest',
            role: rc.role ?? 'Staff',
            companyId: rc.companyId ?? undefined,
            company_id: rc.companyId ?? undefined,
            branchId: rc.branchId ?? undefined,
            storeId: rc.storeId ?? undefined,
            allowedPages: rc.allowedPages ?? null,
            fromRoleCache: true
          };
          sessionGraceUntilRef.current = Date.now() + 4000;
          localStorage.setItem('tradecore_user', JSON.stringify(rcUser));
          setCurrentUser(rcUser);
          console.log('User session restored from cached role');
          return { id: rc.id, role: rcUser.role, company_id: rcUser.company_id ?? null, branch_id: rcUser.branch_id ?? null, fromRoleCache: true };
        }
        localStorage.removeItem('tradecore_role_cache');
      }
    } catch (e) {
      try { localStorage.removeItem('tradecore_user'); } catch {}
    }
    return null;
  }, [setCurrentUser]);

  // --- LOAD INITIAL DATA AND REAL-TIME SYNC FROM CLOUD ---
  // LOGIN DEADLOCK FIX (2026-09-07-05): the full DB boot (company resolution + per-company
  // snapshot + full get_state) is captured here so it can be invoked EITHER at init (normal
  // authenticated/public routes) OR after a successful login (auth-only routes where the boot
  // would otherwise fetch snapshots for a stale/no session and freeze the login form).
  const initPhpSyncRef = React.useRef<(() => Promise<void>) | null>(null);
  // True when the mount effect deferred the full boot because we're on an auth-only route.
  const bootDeferredRef = React.useRef<boolean>(false);
  useEffect(() => {
    // FIRST LINE OF BOOT: restore the last-known-good role/company assignment BEFORE
    // any DB resolution so active_company_id is never 'none' (which the switch effect
    // would bounce to company 1) and the session never flashes to the login page.
    // The 2.5s background get_my_role revalidation then silently applies Admin changes.
    // Forced re-boot containers (restoreRoleCacheAtBoot / validateRoleCacheAfterBoot)
    // and this effect's wiring are IDEMPOTENT-BY-CLEANUP: React runs this effect's
    // cleanup (closes the BroadcastChannel, clears poll/timeout timers, removes
    // storage/listener hooks) before any legitimate remount, so re-entering boot is
    // safe and the ONLY way to restore React state after an error-boundary recovery.
    // NEVER add a window.location.reload() or a version-0 state reset here — the
    // cross-device reload loop (build logging 20x + wiping dirty keys) is exactly what
    // a reload inside this path produces.
    restoreRoleCacheAtBoot();
    validateRoleCacheAfterBoot();
    // 0. Probe API URL candidates immediately so all subsequent calls use the working endpoint
    discoverApiUrl().catch(() => {});
    initCrossTabSync();

    // 0b. SESSION SCOPE RESTORE — EXACTLY ONCE, BEFORE any database state is mounted.
    // Only the session tokens (user_id/role/company_id/branch_id) come from localStorage;
    // the durable snapshot is loaded right below, independently, and the server becomes
    // authoritative after initPhpSync completes. No post-flush hook ever calls this again.
    restoreUserSession();

    // 1. Instantly load local data to prevent any blank screen or login lag
    const stored = localStorage.getItem('tradecore_data');
    let initialData = null;
    if (stored) {
      try {
        initialData = JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse local tradecore_data', e);
      }
    }

    if (initialData) {
      applyData(initialData);
    } else {
      // In-memory defaults only, to avoid blank screen, but DO NOT save to Cloud/LocalStorage yet
      const defaults = {
        companies: defaultCompanies,
        branches: defaultBranches,
        stores: defaultStores,
        users: defaultUsers,
        categories: defaultCategories,
        taxes: defaultTaxes,
        suppliers: defaultSuppliers,
        customers: defaultCustomers,
        stockItems: defaultStockItems,
        purchaseOrders: defaultPurchaseOrders,
        salesOrders: defaultSalesOrders,
        expenses: defaultExpenses,
        auditTrails: defaultAuditTrails,
        securityLogs: [],
        settings: defaultSettings,
        rolePermissions: defaultRolePermissions,
        posShifts: [],
        stockTransfers: [],
        contactMessages: [],
        marketplaceProducts: defaultMarketplaceProducts,
        marketplaceCustomers: defaultMarketplaceCustomers,
        marketplaceOrders: defaultMarketplaceOrders,
        marketplaceClicks: [],
        reviews: [],
        productViews: [],
        wallets: [],
        walletTransactions: [],
        withdrawals: [],
        affiliates: [],
        affiliateClicks: [],
        affiliateSales: [],
        affiliateWithdrawals: [],
        searchSynonyms: defaultSearchSynonyms,
        pushSubscriptions: [],
        collections: [],
        webhookLogs: [],
        adminEarnings: [],
        offers: defaultOffers,
        offerMessages: defaultOfferMessages,
        groupDeals: defaultGroupDeals,
        groupDealParticipants: defaultGroupDealParticipants,
        whatsappConversations: defaultWhatsappConversations,
        notificationLogs: defaultNotificationLogs,
        deliveries: defaultDeliveries,
        deliveryUpdates: defaultDeliveryUpdates,
        installmentPlans: defaultInstallmentPlans,
        installmentOrders: defaultInstallmentOrders,
        installmentPayments: defaultInstallmentPayments,
        liveStreams: defaultLiveStreams,
        liveComments: defaultLiveComments,
        loyaltyCustomers: defaultLoyaltyCustomers,
        loyaltyTransactions: defaultLoyaltyTransactions,
        loyaltyRedeemCodes: defaultLoyaltyRedeemCodes,
        voiceSearches: [],
        qrScans: [],
        traReceipts: [],
        escrowTransactions: [],
        chatConversations: [],
        chatMessages: [],
        visualSearches: [],
        productReturns: [],
        disputes: [],
        disputeMessages: [],
        flashSales: [],
        appNotifications: [],
        bulkUploads: [],
        stories: [],
        storyViews: [],
        shippingZones: [],
      };
      dbStateRef.current = defaults;
      setCompanies(defaultCompanies);
      setBranches(defaultBranches);
      setStores(defaultStores);
      setUsers(defaultUsers);
      setCategories(defaultCategories);
      setTaxes(defaultTaxes);
      setSuppliers(defaultSuppliers);
      setCustomers(defaultCustomers);
      setStockItems(defaultStockItems);
      setPurchaseOrders(defaultPurchaseOrders);
      setSalesOrders(defaultSalesOrders);
      setExpenses(defaultExpenses);
      setAuditTrails(defaultAuditTrails);
      setSecurityLogs([]);
      setSettings(defaultSettings);
      setRolePermissions(defaultRolePermissions);
      setPosShifts([]);
      setStockTransfers([]);
      setContactMessages([]);
      setMarketplaceProducts(defaultMarketplaceProducts);
      setMarketplaceCustomers(defaultMarketplaceCustomers);
      setMarketplaceOrders(defaultMarketplaceOrders);
      setMarketplaceClicks([]);
      setReviews([]);
      setProductViews([]);
      setWallets([]);
      setWalletTransactions([]);
      setWithdrawals([]);
      setAffiliates([]);
      setAffiliateClicks([]);
      setAffiliateSales([]);
      setAffiliateWithdrawals([]);
      setSearchSynonyms(defaultSearchSynonyms);
      setPushSubscriptions([]);
      setCollections([]);
      setWebhookLogs([]);
      setAdminEarnings([]);
      setOffers(defaultOffers);
      setOfferMessages(defaultOfferMessages);
      setGroupDeals(defaultGroupDeals);
      setGroupDealParticipants(defaultGroupDealParticipants);
      setWhatsappConversations(defaultWhatsappConversations);
      setNotificationLogs(defaultNotificationLogs);
      setDeliveries(defaultDeliveries);
      setDeliveryUpdates(defaultDeliveryUpdates);
      setInstallmentPlans(defaultInstallmentPlans);
      setInstallmentOrders(defaultInstallmentOrders);
      setInstallmentPayments(defaultInstallmentPayments);
      setLiveStreams(defaultLiveStreams);
      setLiveComments(defaultLiveComments);
      setLoyaltyCustomers(defaultLoyaltyCustomers);
      setLoyaltyTransactions(defaultLoyaltyTransactions);
      setLoyaltyRedeemCodes(defaultLoyaltyRedeemCodes);
      setVoiceSearches([]);
      setQrScans([]);
      setTraReceipts([]);
      setEscrowTransactions([]);
      setChatConversations([]);
      setChatMessages([]);
      setVisualSearches([]);
      setProductReturns([]);
      setDisputes([]);
      setDisputeMessages([]);
      setFlashSales([]);
      setAppNotifications([]);
      setBulkUploads([]);
      setStories([]);
      setStoryViews([]);
      setShippingZones([]);
    }

    // LOGIN DEADLOCK FIX (2026-09-07-05): on auth-only routes (/login, /register,
    // /forgot-password, /reset-password, /register-complete) there is NO authenticated
    // session yet. Running the full boot (IDB cache, company snapshot, full get_state,
    // realtime sync, online-drain listeners) against a stale or unreachable backend
    // caused an infinite IDB flush loop that froze the browser and prevented login.
    // All heavy sync/IDB operations are gated below; after a successful login,
    // completePostLoginBoot() runs the real boot then redirects to /dashboard.
    const bootPath = window.location.pathname.replace(/\/+$/, '');
    const deferred = isAuthOnlyRoute(bootPath);
    bootDeferredRef.current = deferred;

    if (deferred) {
      console.log('[Boot] Auth-only route — deferring IDB/sync boot until after login.');
    }

    // ROOT_MANDATE: restore an interrupted "View as Company" session (refresh-safe)
    const rootBackupStr = localStorage.getItem('tradecore_root_backup');
    if (rootBackupStr) {
      try {
        const backup = JSON.parse(rootBackupStr);
        if (backup && backup.username === 'root_mandate') {
          setRootSessionBackup(backup);
        } else {
          localStorage.removeItem('tradecore_root_backup');
        }
      } catch (e) {
        localStorage.removeItem('tradecore_root_backup');
      }
    }

    // 2. Load authoritative state from PHP/MySQL database (source of truth)
    // CRITICAL: ALWAYS use server as base. localStorage is only a cache.
    // Pending local changes are stored separately in tradecore_pending_queue.
    const initPhpSync = async () => {
      setPhpSyncing(true);
      setPhpSyncMessage('Connecting to database server...');
      try {
        // SINGLE BOOT COMPANY RESOLUTION (fixes "panel shake" / double-boot):
        // The active session user is authoritative — boot DIRECTLY into their company
        // (e.g. company 3) instead of trusting a possibly-stale localStorage company_id
        // (e.g. a leftover '1') and then switching + resyncing a second time. Priority:
        //  1) active session user's company_id   ← authoritative
        //  2) previously persisted company_id    (kept as fallback)
        //  3) currentCompanyId state             (last resort)
        const bootCid = (() => {
          try {
            const u = JSON.parse(localStorage.getItem('tradecore_user') || '{}');
            const uid = u?.company_id ?? u?.companyId;
            if (uid) return String(uid);
          } catch {}
          const activeSaved = localStorage.getItem('active_company_id');
          if (activeSaved && activeSaved !== 'none') return activeSaved;
          const saved = localStorage.getItem('company_id');
          if (saved && saved !== 'none') return saved;
          return currentCompanyId != null ? String(currentCompanyId) : '';
        })();
        // Persist the resolved boot company (BOTH keys) immediately so the company-switch
        // effect sees active_company_id === curCid and does NOT schedule a redundant
        // "1 -> 3" resync. NOTE: intentionally never falls back to a hardcoded '1' — that
        // was the source of the wrong-company first boot / panel shake.
        persistActiveCompany(bootCid);
        let phpData: any = null;
        if (bootCid && bootCid !== 'none') {
          phpData = await fetchCompanySnapshot(bootCid);
          if (phpData) console.log('[DB] Booted from authoritative per-company snapshot (company ' + bootCid + ')');
        }
        if (!phpData) phpData = await fetchSystemDataFromPhp();
        // Capture server version immediately
        noteServerVersion(getLastServerVersion());
        if (phpData?._version) noteServerVersion(phpData._version);
        if (phpData?.version) noteServerVersion(phpData.version);
        if (phpData) {
          // ALWAYS apply server state — server is the source of truth
          console.log('[DB] Loaded system state from database');
          applyData(phpData, true);
          // First real server user list has arrived — safe for the guard effect
          // to make termination decisions now.
          usersSyncedRef.current = true;
          localStorage.setItem('tradecore_data', JSON.stringify(phpData));
          // Offline-first: mirror the server-acknowledged state into the durable IDB cache.
          void cacheSystemState(phpData);
          // Track server timestamp + version for cross-device polling
          if (phpData.lastUpdated) { lastServerTimestampRef.current = phpData.lastUpdated; noteStateTimestamp(phpData.lastUpdated); }
          if (phpData._version || phpData.version) noteServerVersion(phpData._version ?? phpData.version);
          if (phpData._serverUpdatedAt) lastServerTimestampRef.current = phpData._serverUpdatedAt;
          setLastServerVersion(lastServerVersionRef.current);

          // Replay pending local changes on top of server state
          const pending = getPendingQueue();
          if (pending.length > 0) {
            console.log(`[DB] Replaying ${pending.length} pending local operations on top of server state`);
            const merged = applyPendingQueue(phpData, pending);
            applyData(merged, true);
            localStorage.setItem('tradecore_data', JSON.stringify(merged));
          }

          const sessionUserStr = localStorage.getItem('tradecore_user');
          if (sessionUserStr && phpData.users) {
            try {
              const sessionUser = JSON.parse(sessionUserStr);
              const freshUser = phpData.users.find((u: any) => u.id === sessionUser.id);
              if (freshUser) {
                localStorage.setItem('tradecore_user', JSON.stringify(freshUser));
                setCurrentUser(freshUser);
              }
            } catch (e) {
              console.error(e);
            }
          }
        } else {
          // BOTH the company snapshot AND the full get_state came back empty/unknown.
          // That means the server was UNREACHABLE or returned a malformed/empty state —
          // NOT that the database is provably empty. NEVER auto-seed (write) the local
          // cache back to the server here: the cache may be partial, company-scoped or
          // stale defaults (e.g. written by an older broken get_state wrapper parse),
          // and a single flush would overwrite the real data for EVERY user/device.
          // FIX (2026-09-07): keep the local cache for display continuity only; the
          // normal background GET poll / online listener / cross-tab sync re-fetches and
          // flushes the real, user-verified edits on the next successful read.
          const localStr = localStorage.getItem('tradecore_data');
          if (localStr) {
            try {
              const localParsed = JSON.parse(localStr);
              console.warn('[DB] Server state unavailable — keeping localStorage cache for display (no server overwrite).');
              if (localParsed && Array.isArray(localParsed.users) && localParsed.users.length > 0) {
                // Only release the termination-guard "waiting for sync" hold when the
                // cache carries a real user list; otherwise stay in read-only hold.
                usersSyncedRef.current = true;
              }
              applyData(localParsed, true);
            } catch (e) {}
          }
          // If both DB and localStorage are empty, user creates data naturally via UI
        }
      } catch (err) {
        console.warn('[DB] Initial sync warning:', err);
        // Fallback: use localStorage cache if database unreachable
        const fallbackStr = localStorage.getItem('tradecore_data');
        if (fallbackStr) {
          try { applyData(JSON.parse(fallbackStr)); } catch (e) {}
        }
      } finally {
        setPhpSyncing(false);
        // BOOT-PHASE UNLOCK: initial sync finished — the company-switch effect is now
        // allowed to react to real UI-driven company changes.
        bootPhaseRef.current = true;
      }
    };

    // Capture the boot routine so a deferred (auth-only) route can run it after login.
    initPhpSyncRef.current = initPhpSync;

    // Subscribe to real-time events / WebSockets from PHP backend
    let unsubscribe = () => {};
    if (!deferred) {
      // OFFLINE-FIRST: bootstrap the durable IndexedDB engine (system-state cache +
      // sync_queue). The IDB copy of the last server-acknowledged state wins over the
      // localStorage mirror when it resolves; the server snapshot still re-applies right
      // after, so the durable copy is only a cold-start nicety, never a source of truth.
      getCachedSystemState().then((idbState) => {
        if (idbState && typeof idbState === 'object' && !Array.isArray(idbState)) applyData(idbState);
      }).catch(() => {});
      // Register the 'online'/'visibilitychange' listeners that drain the IDB queue.
      registerOnlineSync();
      initPhpSync();
      unsubscribe = connectPhpRealtimeSync((phpData) => {
      if (phpData) {
        const rtVer = Number(phpData._version ?? phpData.version ?? 0);
        // Version guard: skip if this live event carries a version OLDER than what we
        // already applied. Allow same-version updates — the server may have bumped
        // a record within the same blob version (e.g. apiUpsertProduct doesn't bump
        // _version), and rejecting same-version SSE events silently drops valid
        // realtime updates, causing CRUDs to appear saved locally but vanish on reload.
        // The self-echo guard (rtVer === lastFlushedVersionRef) below prevents infinite
        // apply→flush→SSE→apply loops for our OWN mutations.
        if (rtVer > 0 && lastRealtimeVersionRef.current > 0 && rtVer < lastRealtimeVersionRef.current) {
          return;
        }
        if (rtVer > 0) lastRealtimeVersionRef.current = rtVer;
        // CRITICAL: ALL version writes and localStorage mutations MUST happen inside
        // the isApplyingRemoteUpdateRef guard. If noteServerVersion / setLastServerVersion
        // runs OUTSIDE the guard, it writes tradecore_last_server_version to localStorage,
        // which fires a storage event in THIS tab. The storage handler sees
        // isApplyingRemoteUpdateRef.current === false, passes its guard, and calls
        // scheduleCrossTabRefetch → fetch → apply → noteServerVersion → storage event →
        // infinite loop causing React #185 (Maximum update depth exceeded).
        isApplyingRemoteUpdateRef.current = true;
        try {
          if (phpData._version || phpData.version) noteServerVersion(phpData._version ?? phpData.version);
          const mergedState = protectDirtyCollections(phpData);
          applyData(mergedState, true);
          usersSyncedRef.current = true;
          localStorage.setItem('tradecore_data', JSON.stringify(mergedState));
          if (phpData._version || phpData.version) noteServerVersion(phpData._version ?? phpData.version);
          if (phpData.lastUpdated || phpData._serverUpdatedAt) {
            lastServerTimestampRef.current = phpData.lastUpdated ?? phpData._serverUpdatedAt ?? lastServerTimestampRef.current;
          }
          setLastServerVersion(lastServerVersionRef.current);
        } finally {
          isApplyingRemoteUpdateRef.current = false;
        }
        // Self-echo guard: if this SSE event echoes our own flush, don't notify other tabs
        // (they already know via our BroadcastChannel notify from the flush path).
        const isSelfEcho = rtVer > 0 && rtVer === lastFlushedVersionRef.current;
        if (!isSelfEcho) notifyCrossTab(rtVer);

        const sessionUserStr = localStorage.getItem('tradecore_user');
        if (sessionUserStr && phpData.users) {
          try {
            const sessionUser = JSON.parse(sessionUserStr);
            const freshUser = phpData.users.find((u: any) => u.id === sessionUser.id);
            if (freshUser) {
              // SESSION-META-ONLY UPDATE (2026-09-07): a live echo must NOT rebuild the
              // whole currentUser object identity every SSE event — that identity churn
              // re-fires the persistRoleCache effect ('User session preserved/restored')
              // 2x after every Flush OK and 7x during boot. Only adopt the fresh user row
              // when the session-relevant meta (role/company/branch/store/pages) changed,
              // e.g. an admin demoted/relocated this user remotely.
              const metaKey = (u: any) => `${u.id}|${u.role}|${u.companyId ?? u.company_id ?? ''}|${u.branchId ?? u.branch_id ?? ''}|${u.storeId ?? u.store_id ?? ''}|${JSON.stringify(u.allowedPages ?? null)}`;
              if (metaKey(freshUser) !== metaKey(sessionUser)) {
                localStorage.setItem('tradecore_user', JSON.stringify(freshUser));
                setCurrentUser(freshUser);
              }
            }
          } catch (e) {}
        }
      }
    });
    } // end if (!deferred)

    const handleStorageChange = (e: StorageEvent) => {
      // Only react to the lightweight version key — NOT tradecore_data / cache —
      // so writing the cache never loops back into a re-apply.
      if (e.key === 'tradecore_last_server_version' && e.newValue) {
        // Skip if we are the ones writing (applying remote data) — breaks the infinite loop
        if (isApplyingRemoteUpdateRef.current) return;
        // Self-write detection: if this tab just wrote this exact version, skip.
        // The isApplyingRemoteUpdateRef guard above should already catch this, but
        // this is a second safety net for edge cases where the ref is cleared before
        // the storage event fires (e.g. async scheduling).
        if (lastSelfWrittenVersionRef.current === e.newValue) {
          lastSelfWrittenVersionRef.current = null;
          return;
        }
        // DEBOUNCE: if a storage event was processed within the last 2s, skip —
        // prevents rapid-fire events from multiple localStorage writes during applyData.
        const nowEv = Date.now();
        if ((nowEv - lastStorageEventTimeRef.current) < 2000) return;
        lastStorageEventTimeRef.current = nowEv;
        const newVer = Number(e.newValue);
        const oldVer = Number(e.oldValue ?? 0);
        if (!Number.isFinite(newVer) || newVer === 0) return;
        if (newVer === oldVer) return;
        if (newVer > 0 && newVer <= lastServerVersionRef.current) return;
        // CRITICAL: While a flush is in flight we are about to bump the version
        // ourselves — don't let a cross-tab event schedule a re-fetch that races
        // our dirty keys. The 5s poll picks up any missed update afterwards, and
        // all other apply paths merge (protectDirtyCollections) rather than replace.
        if (flushInFlightRef.current) return;
        // Offline: pause the cross-tab re-fetch here too. scheduleCrossTabRefetch will
        // re-trigger it from the 'online' listener via pendingCrossTabRefetchRef.
        if (offlineRef.current) { scheduleCrossTabRefetch(newVer); return; }
        console.log('[Sync] Storage: cross-tab version change detected, re-fetching...');
        scheduleCrossTabRefetch(newVer);
      }
    };
    if (!deferred) window.addEventListener('storage', handleStorageChange);

    // SILENT ROLE MERGE LISTENER: when validateRoleCacheAfterBoot detects a role
    // change on the server, instead of a hard reload (which caused the infinite
    // "build → poll → apply → role-check → reload" loop), it dispatches a custom
    // event that we handle here — updating the running React state in-place.
    const handleRoleChanged = (e: Event) => {
      const fresh = (e as CustomEvent).detail;
      if (!fresh || typeof fresh !== 'object') return;
      console.log('[RoleCache] Applying role change silently:', fresh);
      setCurrentUser((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          role: fresh.role ?? prev.role,
          companyId: fresh.companyId ?? prev.companyId,
          company_id: fresh.company_id ?? prev.company_id,
          branchId: fresh.branchId ?? prev.branchId,
          branch_id: fresh.branch_id ?? prev.branch_id,
          storeId: fresh.storeId ?? prev.storeId,
          store_id: fresh.store_id ?? prev.store_id,
          allowedPages: fresh.allowedPages ?? prev.allowedPages,
        };
      });
      // Force a re-fetch so the new role's data scope is picked up immediately
      scheduleCrossTabRefetch(0);
    };
    window.addEventListener('tradecore:role-changed', handleRoleChanged);

    // --- NETWORK RESILIENCE: pause ALL background sync while offline, resume on reconnect.
    // This is the primary defence against the "Failed to fetch" → cross-tab re-fetch loop:
    // every network path (poll, cross-tab refetch, PHP flush, mutate ack) is gated on the
    // offline flag, so a dropped connection pauses instead of throwing uncaught rejections
    // that fight each other and wipe active UI state. Reconnecting NEVER clears or resets
    // React state — it simply flushes pending edits and re-polls once.
    const handleOffline = () => {
      offlineRef.current = true;
      globalOfflineRef.current = true;
      setPhpSyncing(false);
      console.log('[Sync] Network offline — pausing background sync (local edits are safe, will flush on reconnect)');
    };
    const handleOnline = () => {
      const wasOffline = offlineRef.current;
      offlineRef.current = false;
      globalOfflineRef.current = false;
      console.log('[Sync] Network online — resuming sync');
      // Drain the durable IndexedDB sync_queue (sequential atomic POSTs; items are
      // removed only after the server acks the commit).
      void drainSyncQueue();
      // Drain any cross-tab re-fetch that was paused while offline.
      const pending = pendingCrossTabRefetchRef.current;
      if (pending > 0) {
        pendingCrossTabRefetchRef.current = 0;
        scheduleCrossTabRefetch(pending);
      }
      // Re-arm the debounced PHP flush for any edits made while offline.
      if (flushDirtyRef.current && wasOffline) schedulePhpFlush();
      // Force an immediate cross-device re-poll so this tab catches up the moment the
      // network returns (instead of waiting up to 5s for the interval).
      if (wasOffline) scheduleCrossTabRefetch(0);
    };
    if (!deferred) {
      window.addEventListener('offline', handleOffline);
      window.addEventListener('online', handleOnline);
    }

    // 3. Reconcile database state with the server:
    //    - PRIMARY (event-driven): SSE realtime + BroadcastChannel cross-tab + storage
    //      events + explicit local-mutation ack all trigger scheduleCrossTabRefetch().
    //      These are the fast paths; they apply the moment data actually changes.
    //    - SAFETY NET (fallback): a low-rate 30s reconciliation poll (NOT a boot-rerun —
    //      this callback only fetches/merges data; boot functions run from the mount
    //      effect alone). It exists ONLY because BroadcastChannel can't cross devices/
    //      browsers, so without it a change made on device A would never reach device B
    //      until a reload. Idle traffic is ~6x lighter than the old 5s interval, and every
    //      apply is already gated by version/timestamp staleness + poll debounce, so an
    //      idle tab makes a cheap no-change probe and returns.
    const crossDevicePoll = deferred ? null : setInterval(async () => {
      try {
        // OFFLINE: pause the poll entirely — a fetch now throws "Failed to fetch" and the
        // empty catch leaves dead air. The 'online' listener forces an immediate resync.
        if (offlineRef.current) return;
        // EVENT-DRIVEN FAST-PATH DEDUP: if the event channels (SSE / BroadcastChannel /
        // storage) have already brought this tab current, an idle tab should stay idle and
        // NOT issue a redundant server GET. A recently-applied version (within the debounce
        // window) means our state is already converged, so the 30s safety-net poll is skipped.
        const lastAppliedAt = lastPollAppliedTimeRef.current || 0;
        const latestSeen = lastRealtimeVersionRef.current;
        if (latestSeen > 0 && latestSeen === lastServerVersionRef.current && (Date.now() - lastAppliedAt) < 3000) {
          // Event channel already converged us; skip this redundant probe.
          return;
        }
        const pollCompanyId = (() => {
          try {
            const cid = (currentCompanyId != null ? String(currentCompanyId) : null);
            if (cid) return cid;
            const u = JSON.parse(localStorage.getItem('tradecore_user') || 'null');
            const uid = (u?.company_id ?? u?.companyId ?? u?.companyId) as any;
            return uid != null ? String(uid) : null;
          } catch { return null; }
        })();
        if (pollCompanyId) {
          // Reset incremental since when company changes — force full sync for new company
          if (lastPolledCompanyIdRef.current !== null && lastPolledCompanyIdRef.current !== pollCompanyId) {
            incrementalSyncSinceRef.current = 0;
          }
          lastPolledCompanyIdRef.current = pollCompanyId;
          const { apiUrl, apiKey } = getPhpConfig();
          if (!apiUrl) return;
          const headers: Record<string, string> = { 'Accept': 'application/json' };
          if (apiKey) headers['X-API-Key'] = apiKey;
          // First poll since=0 for full; subsequent polls use last known server_ts for incremental
          const since = incrementalSyncSinceRef.current || 0;
          const pollUrl = `${apiUrl}?action=get_state&company_id=${encodeURIComponent(pollCompanyId)}&since=${since}&t=${Date.now()}`;
          const resp = await fetch(pollUrl, { method: 'GET', headers, cache: 'no-store' });
          if (!resp.ok) return;
          const data = await resp.json();
          if (data?.debug) console.log('SYNC DEBUG', data.debug);
          const incomingProducts: any[] = sanitizeArray<any>(data.products ?? data.state?.products ?? []);
          const incomingUsers: any[] = sanitizeArray<any>(data.users ?? data.state?.users ?? []);
          const hasPayload = Array.isArray(incomingProducts) || Array.isArray(incomingUsers);
          // Handle deleted items (from incremental sync)
          const deletedIds = data.deleted || null;
          if (hasPayload && data.changed) {
            const curProds: any[] = (dbStateRef.current as any).marketplaceProducts ?? [];
            const curUsers: any[] = (dbStateRef.current as any).users ?? [];
            let mergedProds: any[];
            let mergedUsers: any[];
            if (since > 0 && deletedIds) {
              // Incremental: only replace items that were updated, remove deleted
              const incomingProdIds = new Set(incomingProducts.map((p: any) => p.id));
              const incomingUserIds = new Set(incomingUsers.map((u: any) => u.id));
              const deletedProdIds = new Set(deletedIds.productIds || []);
              const deletedUserIds = new Set(deletedIds.userIds || []);
              // Keep unchanged items, replace/update changed items, remove deleted
              // CRITICAL: .find() can return undefined if server data is incomplete;
              // filter(Boolean) prevents undefined entries that crash React internals
              // (e.g. reportAllChanges reading startTime from undefined).
              mergedProds = curProds
                .filter((p: any) => !deletedProdIds.has(p.id))
                .map((p: any) => incomingProdIds.has(p.id) ? incomingProducts.find((ip: any) => ip.id === p.id) : p)
                .filter(Boolean)
                .concat(incomingProducts.filter((ip: any) => !curProds.some((p: any) => p.id === ip.id)));
              mergedUsers = curUsers
                .filter((u: any) => !deletedUserIds.has(u.id))
                .map((u: any) => incomingUserIds.has(u.id) ? incomingUsers.find((iu: any) => iu.id === u.id) : u)
                .filter(Boolean)
                .concat(incomingUsers.filter((iu: any) => !curUsers.some((u: any) => u.id === iu.id)));
              // Also sanitize incoming arrays in case server sent malformed data
              mergedProds = sanitizeArray(mergedProds);
              mergedUsers = sanitizeArray(mergedUsers);
            } else {
              // Full: previously replaced this company's slice entirely, which caused the
              // re-fetch-overwrite race: a poll that returns STALE DB data (a just-saved
              // record not yet committed / replicated in MySQL) would wholesale-drop the
              // local optimistic edit. REQ 2 fix: version-locked per-record UNION merge —
              // keep the local company slice as the base, overlay incoming server records
              // by id, apply explicit server deletions, but DO NOT let a stale payload
              // overwrite freshly-optimistically-mutated local data.
              const serverUpdatedMs = toEpochMs(data.server_ts ?? data.lastUpdated ?? data.updatedAt ?? 0);
              const serverVersionNum = Number(data.version ?? data.server_version ?? 0) || 0;
              const prodsStale = isServerCollectionStale('marketplaceProducts', serverUpdatedMs, serverVersionNum);
              const usersStale = isServerCollectionStale('users', serverUpdatedMs, serverVersionNum);
              const deletedProdIdsFull = new Set((deletedIds?.productIds || []).map((x: any) => String(x)));
              const deletedUserIdsFull = new Set((deletedIds?.userIds || []).map((x: any) => String(x)));
              const localProds = curProds.filter((p: any) => String(p.company_id ?? p.companyId ?? '') === String(pollCompanyId));
              const otherProds = curProds.filter((p: any) => String(p.company_id ?? p.companyId ?? '') !== String(pollCompanyId));
              const localUsers = curUsers.filter((u: any) => String((u as any).company_id ?? (u as any).companyId ?? '') === String(pollCompanyId));
              const otherUsers = curUsers.filter((u: any) => String((u as any).company_id ?? (u as any).companyId ?? '') !== String(pollCompanyId));
              if (prodsStale) {
                // Incoming server payload is older than our optimistic product edit — keep local.
                mergedProds = localProds.filter((p: any) => !deletedProdIdsFull.has(String(p.id)));
              } else {
                // Server is newer/authoritative: union by id, overlay server records, honor
                // explicit deletions, and keep local-only records the server hasn't persisted yet.
                const incomingMap = new Map(incomingProducts.map((ip: any) => [String(ip.id), ip]));
                const merged = localProds
                  .filter((p: any) => !deletedProdIdsFull.has(String(p.id)))
                  .map((p: any) => {
                    const ip = incomingMap.get(String(p.id));
                    return ip ? { ...p, ...ip } : p;
                  })
                  .filter(Boolean);
                const mergedIds = new Set(merged.map((p: any) => String(p.id)));
                incomingProducts.forEach((ip: any) => {
                  if (ip && !mergedIds.has(String(ip.id)) && !deletedProdIdsFull.has(String(ip.id))) merged.push(ip);
                });
                mergedProds = merged;
              }
              if (usersStale) {
                mergedUsers = localUsers.filter((u: any) => !deletedUserIdsFull.has(String(u.id)));
              } else {
                const incomingUserMap = new Map(incomingUsers.map((iu: any) => [String(iu.id), iu]));
                const merged = localUsers
                  .filter((u: any) => !deletedUserIdsFull.has(String(u.id)))
                  .map((u: any) => {
                    const iu = incomingUserMap.get(String(u.id));
                    return iu ? { ...u, ...iu } : u;
                  })
                  .filter(Boolean);
                const mergedIds = new Set(merged.map((u: any) => String(u.id)));
                incomingUsers.forEach((iu: any) => {
                  if (iu && !mergedIds.has(String(iu.id)) && !deletedUserIdsFull.has(String(iu.id))) merged.push(iu);
                });
                mergedUsers = merged;
              }
              mergedProds = sanitizeArray([...otherProds, ...mergedProds]);
              mergedUsers = sanitizeArray([...otherUsers, ...mergedUsers]);
            }
            // CRITICAL: Do NOT wholesale-replace merged arrays with dirtyValuesRef
            // snapshots — the per-id UNION merge above already preserves local-only
            // records (created locally, not yet on the server). Wholesale replacement
            // overwrites server data from OTHER devices that the merge correctly added,
            // causing "another device's CRUDs vanish on the next poll" data loss.
            const nextState: any = { ...dbStateRef.current, marketplaceProducts: mergedProds, users: mergedUsers, lastUpdated: new Date().toISOString() };
            (dbStateRef.current as any).marketplaceProducts = mergedProds;
            (dbStateRef.current as any).users = mergedUsers;
            setMarketplaceProducts(mergedProds);
            setUsers(mergedUsers);
            localStorage.setItem('tradecore_data', JSON.stringify(nextState));
            // CRITICAL: Wrap version write + localStorage mutations in the guard
            // to prevent the storage event from triggering a same-tab re-fetch loop.
            isApplyingRemoteUpdateRef.current = true;
            try {
              if (data.server_ts) { lastServerTimestampRef.current = String(data.server_ts); noteStateTimestamp(data.server_ts); incrementalSyncSinceRef.current = Number(data.server_ts); }
              if (data.version || data.server_version) noteServerVersion(data.version ?? data.server_version);
              try { persistActiveCompany(String(pollCompanyId)); } catch {}
            } finally {
              isApplyingRemoteUpdateRef.current = false;
            }
          } else if (data.server_ts && since > 0) {
            // No changes but server_ts still advances — update for next poll
            incrementalSyncSinceRef.current = Number(data.server_ts);
            if (data.server_ts) { lastServerTimestampRef.current = String(data.server_ts); noteStateTimestamp(data.server_ts); }
          }
          return;
        }
        // Fallback: version-based full poll (public/ROOT, no company)
        const probe = await fetchCheckTimestamp();
        if (!probe) return;
        const serverVer = Number(probe.version ?? 0);
        const serverTs = probe.lastUpdated ?? probe.updatedAt ?? null;
        let changed = false;
        if (serverVer > 0 && lastServerVersionRef.current > 0) {
          if (serverVer !== lastServerVersionRef.current) changed = true;
        } else if (serverVer > 0 && lastServerVersionRef.current === 0) {
          if (serverTs && toEpochMs(serverTs) !== toEpochMs(lastServerTimestampRef.current)) changed = true;
          else if (serverVer > 0) { lastServerVersionRef.current = serverVer; setLastServerVersion(serverVer); }
        } else {
          if (serverTs && toEpochMs(serverTs) !== toEpochMs(lastServerTimestampRef.current)) changed = true;
        }
        if (!changed) return;
        if (serverVer > 0) { lastServerVersionRef.current = serverVer; setLastServerVersion(serverVer); }
        if (serverTs) lastServerTimestampRef.current = serverTs;
        const fullState = await fetchSystemDataFromPhp();
        if (fullState) {
          const fetchedVer = Number((fullState as any)._version ?? (fullState as any).version ?? getLastServerVersion());
          if (fetchedVer > 0) { lastServerVersionRef.current = Math.max(lastServerVersionRef.current, fetchedVer); setLastServerVersion(lastServerVersionRef.current); }
          if (fullState.lastUpdated) noteStateTimestamp(fullState.lastUpdated);
          if ((fullState as any)._serverUpdatedAt) lastServerTimestampRef.current = (fullState as any)._serverUpdatedAt;
          if (shouldApplyIncomingState(fullState)) {
            // POLL DEBOUNCE: if we already applied this exact version within the last 10s,
            // skip — this breaks the infinite "poll → apply → reload → poll" loop where
            // the version ref resets to 0 on reload and the same data is re-applied.
            const nowMs = Date.now();
            const appliedVer = Number((fullState as any)._version ?? (fullState as any).version ?? 0);
            if (appliedVer > 0 && appliedVer === lastPollAppliedVersionRef.current
                && (nowMs - lastPollAppliedTimeRef.current) < 10000) {
              return;
            }
            console.log('[DB] Cross-device change detected, applying update');
            const mergedState = protectDirtyCollections(fullState);
            applyData(mergedState, true);
            usersSyncedRef.current = true;
            localStorage.setItem('tradecore_data', JSON.stringify(mergedState));
            lastPollAppliedVersionRef.current = appliedVer;
            lastPollAppliedTimeRef.current = nowMs;
          }
        }
      } catch (e) {}
    }, 30000);

    // 4. On page close, do a final save via sendBeacon
    const handleBeforeUnload = () => {
      try {
        // Flush any deferred local-cache write first so the beacon includes the latest changes
        flushPendingLocalCacheSync();
        // ZERO-DIRTY GUARD: skip the unload beacon unless there are real unsynced edits — an
        // idle tab close must not upload a full 120KB+ blob. auditTrails never syncs.
        const hasUnsynced = Array.from(flushDirtyKeysRef.current).some(k => k !== 'auditTrails');
        if (!hasUnsynced) return;
        const unloadStr = localStorage.getItem('tradecore_data');
        if (unloadStr) {
          const unloadPayload = JSON.parse(unloadStr);
          const { apiUrl } = getPhpConfig();
          if (apiUrl) {
            // DELTA-ONLY BEACON: never dump the full state on page close. Send only the
            // collections with unsynced edits (same contract as flushToPhp) so an idle
            // tab close uploads a few KB instead of a 115KB blob.
            const unloadDelta: any = { lastUpdated: new Date().toISOString() };
            let deltaKeys = 0;
            for (const k of Array.from(flushDirtyKeysRef.current).filter((k): k is string => typeof k === 'string')) {
              if (k === 'auditTrails' || NON_SYNCED_KEYS.has(k)) continue;
              const snap = (dirtyValuesRef.current as any)[k];
              unloadDelta[k] = snap !== undefined ? snap : unloadPayload[k];
              deltaKeys++;
            }
            if (deltaKeys === 0) return;
            const blob = new Blob(
              [JSON.stringify({ action: 'save_state', delta: unloadDelta, changedKeys: Object.keys(unloadDelta).filter(k => k !== 'lastUpdated'), lastUpdated: unloadDelta.lastUpdated })],
              { type: 'application/json' }
            );
            navigator.sendBeacon(apiUrl, blob);
          }
        }
      } catch (e) {}
    };
    const handlePageHide = () => { flushPendingLocalCacheSync(); flushQueueNow(); };
    if (!deferred) {
      window.addEventListener('beforeunload', handleBeforeUnload);
      window.addEventListener('pagehide', handlePageHide);
    }

    return () => {
      unsubscribe();
      clearInterval(crossDevicePoll);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('tradecore:role-changed', handleRoleChanged);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      cleanCrossTabTimer();
      try { syncChannelRef.current?.close(); syncChannelRef.current = null; } catch {}
    };
  }, []);

  // Force sync on company switch + expose debugSync globally (Chrome vs Edge desync)
  React.useEffect(() => {
    const curCid = currentCompanyId != null ? String(currentCompanyId) : null;
    const savedCid = localStorage.getItem('company_id');
    const activeCid = localStorage.getItem('active_company_id') || savedCid;
    // Debug helper (hoisted): available immediately regardless of boot/switch state.
    (window as any).debugSync = () => {
      const cid = localStorage.getItem('company_id') || String(currentCompanyId ?? 'none');
      const lastTs = localStorage.getItem('last_sync_ts') || String(lastServerVersionRef.current);
      let prodCount = 0; let userCount = 0;
      try {
        const s = JSON.parse(localStorage.getItem('tradecore_data') || '{}');
        prodCount = (s.marketplaceProducts ?? s.products ?? []).length;
        userCount = (s.users ?? []).length;
      } catch {}
      const msg = `Company: ${cid}\nlast_ts: ${lastTs}\nProducts: ${prodCount}\nUsers: ${userCount}\nCheck Network tab get_state?company_id=${cid}`;
      alert(msg);
      console.log('SYNC DEBUG', { company_id: cid, last_ts: lastTs, product_count: prodCount, user_count: userCount });
    };
    // BOOT-PHASE LOCK (GUARD 0): while initPhpSync is still loading, NEVER auto-switch or
    // resync — and never persist / mark any target. Role-scope effects can set
    // currentCompanyId mid-boot (Super Admin defaulting to the first company); letting
    // that race the boot snapshot produced "Company switched 2 -> 1 forcing resync" and
    // the infinite boot-shake. Once boot completes, only real UI-driven changes proceed.
    if (!bootPhaseRef.current) return;
    // Consume the explicit-switch intent IMMEDIATELY so it can never leak into a later
    // automatic trigger (a stale flag would let an automatic flip piggyback a resync).
    const explicitSwitch = explicitCompanySwitchRef.current;
    explicitCompanySwitchRef.current = false;
    // FIRST-ASSIGNMENT LOCK (silent set): NO company was ever persisted ('none'/missing)
    // and this is the first real company assignment — commit it SILENTLY, no flush + no
    // destructive snapshot resync. The boot snapshot already applied the authoritative
    // state for the user's company, so a forced resync here only emitted "Company switched
    // none -> 1 forcing resync" and inflated server versions every load. A literal stored
    // 'none' is treated as unset, exactly like a missing value.
    if (curCid && curCid !== 'none' && !savedCid && (!activeCid || activeCid === 'none')) {
      persistActiveCompany(curCid);
      lastResyncedCompanyRef.current = curCid;
      console.log('Company selection updated, session stable: company=' + curCid + ' committed silently (first assignment).');
      return;
    }
    // switchCompany(from, to) LOCK (GUARD 1): company switches MUST only be treated as a
    // real switch when the persisted ACTIVE company differs from the current target. If
    // active_company_id already equals curCid, the company was committed by boot resolution
    // or an explicit UI selection — this flush-settled / storage-event replay is a NO-OP.
    // Mark the target as current so even later replays for the SAME company short-circuit.
    if (curCid && curCid !== 'none' && activeCid && activeCid === curCid) {
      lastResyncedCompanyRef.current = curCid;
      return;
    }
    // EXPLICIT-SWITCH ONLY (GUARD 4): the persisted active company differs from the
    // current target AND this was NOT an explicit UI selection — it is an AUTOMATIC
    // flip (role-scope re-defaulting, snapshot replay echo, cross-device replay).
    // Commit nothing: no persist, no flush, no destructive snapshot fetch. This kills
    // the infinite "Company switched 1 -> 2 -> 1 forcing resync" ping-pong and stops an
    // unrelated company snapshot from ever overwriting the session-user's workspace.
    if (curCid && curCid !== 'none' && activeCid !== curCid && !explicitSwitch) {
      lastResyncedCompanyRef.current = curCid;
      return;
    }
    // LOCK (GUARD 2 / isSwitching): a resync for a DIFFERENT target is still in flight —
    // skip this trigger, do NOT stack a second destructive snapshot fetch.
    if (curCid && curCid !== 'none' && resyncInFlightRef.current) return;
    // LOCK (GUARD 3 / idempotence): we already resynced INTO this exact target on an
    // earlier switch cycle — a replay must not re-fetch it.
    if (curCid && curCid !== 'none' && lastResyncedCompanyRef.current === curCid) return;

    // switchCompany(from, to) — STRICTLY re-entry-guarded company switch (item 3).
    // The synchronous effect above only PERSISTS the target + schedules; the destructive
    // snapshot read/resync runs here on the next microtask (so nested components settle
    // FIRST) and ALWAYS releases the isSwitching lock in `finally`. Mirrors the
    // `switchCompany(from,to)` contract exactly:
    //   1) from === to        → NO-OP: a flush-settled / storage replay for the SAME
    //                            company can never re-fetch or re-commit anything.
    //   2) isSwitching (a switch is in flight) → drop this trigger; NEVER stack a second
    //                            destructive snapshot fetch on top of the current one.
    const switchCompany = async (fromCid: string | null, targetCid: string) => {
      if (fromCid === targetCid) return;
      if (resyncInFlightRef.current) return;
      resyncInFlightRef.current = true;
      try {
        // DATA-LOSS FIX: let any in-flight or just-scheduled flush for the OLD company
        // fully complete BEFORE zeroing the version watermark. Zeroing first lets a
        // background resync fetch reach applyData with a lower version and either race
        // or prematurely overwrite the dirty snapshot — silently dropping unsaved edits.
        // The in-flight save is NEVER aborted by this switch: writes run on their own
        // per-request AbortController (ignoreOuterSignal) and settleFlushes waits them
        // out instead of killing their signal.
        await settleFlushes(10000);
        // STALE-ABORT: re-check the ACTIVE company after flushes settle. If the user
        // already switched again (or back), this resync is stale — the fresh effect run
        // for the new target owns the switch. Never force-switch to a target that is no
        // longer the active company.
        const stillActive = (currentCompanyId != null ? String(currentCompanyId) : null) === targetCid;
        if (!stillActive) return;
        // APPLY AUTHORITATIVE SNAPSHOT: the DB is the single source of truth, so on a
        // company switch the new company's state is re-READ from MySQL (fresh SQL with
        // `WHERE company_id = ?`) and applied unconditionally — never trusted to the
        // incremental blob poll, which could have raced the switch. The snapshot fetch
        // bumps the api-layer version; then we set our own watermark so the following
        // polls continue from the snapshot version instead of refusing/stale.
        let snapVer = 0;
        if (targetCid !== 'none') {
          try {
            const snap = await fetchCompanySnapshot(targetCid);
            // POST-FETCH STALE ABORT: the context can flip WHILE the snapshot request is
            // in flight. Never apply a company that is no longer the persisted ACTIVE one,
            // and never apply one the SESSION user does not belong to (kills the
            // "applied authoritative snapshot for company X / Company switched X -> Y
            // forcing resync" flood when a scoped user's currentCompanyId flapped mid-fetch).
            // Super Admin is exempt — the company dropdown deliberately moves them between
            // companies. Session + persisted-active are read fresh from localStorage so a
            // stale closure value can't defeat the check.
            let sessionRole = '';
            let sessionCo = '';
            try {
              const u = JSON.parse(localStorage.getItem('tradecore_user') || '{}');
              sessionRole = String(u?.role ?? '');
              const co = u?.company_id ?? u?.companyId;
              sessionCo = co != null && String(co) !== 'none' && String(co) !== '' ? String(co) : '';
            } catch {}
            const isSuperSession = sessionRole === 'Super Admin' || sessionRole === 'root_mandate' || sessionRole === 'superadmin';
            if (!isSuperSession && sessionCo !== '' && sessionCo !== targetCid) {
              console.warn('[Sync] Stale company snapshot ignored (session user belongs to company ' + sessionCo + ', snapshot was for ' + targetCid + ')');
              return;
            }
            const persistedActive = localStorage.getItem('active_company_id') || localStorage.getItem('company_id') || '';
            if (persistedActive !== '' && persistedActive !== 'none' && persistedActive !== targetCid) return;
            if (snap && typeof snap === 'object') {
              // MERGE FIX: Preserve cross-company data when switching companies
              // Categories, settings, and other cross-company collections should be MERGED,
              // not replaced, to prevent data loss for other companies
              const existingState = dbStateRef.current;
              if (existingState && snap.categories && Array.isArray(snap.categories)) {
                // Merge categories: keep existing + add new from snapshot
                const existingCats = existingState.categories || [];
                const snapCats = snap.categories;
                const mergedCats = [...new Set([...existingCats, ...snapCats])];
                snap.categories = mergedCats;
              }
              if (existingState && snap.taxes && Array.isArray(snap.taxes)) {
                const existingTaxes = existingState.taxes || [];
                const snapTaxes = snap.taxes;
                const mergedTaxes = [...new Set([...existingTaxes, ...snapTaxes])];
                snap.taxes = mergedTaxes;
              }
              applyData(snap, true);
              snapVer = Number(snap._version ?? snap.version ?? 0);
              if (Number.isNaN(snapVer)) snapVer = 0;
              console.log('Company switched -> applied authoritative snapshot for company ' + targetCid + ' (version ' + snapVer + ')');
            }
          } catch (e) {
            console.warn('Authoritative snapshot on company switch failed, falling through to versioned poll:', e);
          }
        }
        lastServerVersionRef.current = snapVer;
        setLastServerVersion(snapVer);
        // Remember this target: any further triggers for the SAME company are ignored.
        lastResyncedCompanyRef.current = targetCid;
        console.log('Company selection updated, session stable: company=' + targetCid + ' (explicit switch, no window.close / no session reset).');
        console.log('Company switched', fromCid ?? 'none', '->', targetCid, 'forcing resync (flush settled)');
      } finally {
        resyncInFlightRef.current = false;
      }
    };
    if (curCid && curCid !== 'none') {
      const activeCompanyChanged = !!activeCid && activeCid !== 'none' && activeCid !== curCid;
      // PURE COMPANY-SWITCH NO-FLUSH GUARD: when the persisted active company actually
      // CHANGED (2 -> 3), never force a prior flush here. switchCompany's authoritative
      // snapshot replaces all collections, and re-flushing whatever is still left dirty
      // only bumps the server version for a pointless "0.1KB (1 dirty key)" write. Edits
      // made under the previous company were already persisted by their own debounced
      // flush before navigation (and handleLogout awaits settleFlushes).
      if (!activeCompanyChanged && flushDirtyRef.current) {
        forceFlushRef.current = true;
        schedulePhpFlush();
      }
      localStorage.removeItem('last_sync_ts');
      // Commit the new active company under BOTH keys (canonical active_company_id + legacy).
      persistActiveCompany(curCid);
      // Schedule exactly ONE switch per distinct target (guards 1-3 cover re-triggers);
      // switchCompany's own from===to / isSwitching guard blocks anything that slips by.
      if (lastResyncedCompanyRef.current !== curCid && !resyncInFlightRef.current) {
        void switchCompany(activeCid, curCid);
      }
    }
  }, [currentCompanyId]);

  // ISSUE 2: Instant session revocation — when the backend detects a deleted/blocked/
  // deactivated user on any sync/request, it returns 401 SESSION_REVOKED, and the API
  // layer dispatches `tradecore:session-revoked`. Here we force a hard logout so the
  // revoked user can no longer navigate or perform actions.
  React.useEffect(() => {
    const handler = () => {
      try { localStorage.removeItem('tradecore_user'); } catch {}
      try { localStorage.removeItem('company_id'); } catch {}
      setCurrentUser(null);
      setCurrentPage('dashboard');
      toast.error(t('Session revoked: your account was deactivated or deleted by an administrator.'));
    };
    const onEvent = () => handler();
    try { window.addEventListener('tradecore:session-revoked', onEvent); } catch {}
    return () => { try { window.removeEventListener('tradecore:session-revoked', onEvent); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ISSUE 3: Live audit trail — periodically fetch authoritative rows from the backend
  // `audit_logs` table and merge them into the local auditTrails state so the Audit
  // Trail table renders DB-backed records (User Creation/Deletion, Login, CRUD, Roles).
  React.useEffect(() => {
    let cancelled = false;
    const refreshAudit = async () => {
      if (cancelled) return;
      try {
        const logs = await getAuditLogsFromPhp({ limit: 300 });
        if (cancelled || !Array.isArray(logs) || logs.length === 0) return;
        setAuditTrails(prev => {
          const map = new Map<string, AuditTrail>();
          (prev || []).forEach(l => map.set(l.id, l));
          let changed = false;
          // GUARD before reading any field (entry.startTime-class crash): the DB
          // can return a malformed/holey row — skip it instead of dereferencing it.
          logs.forEach((l: any) => {
            if (!l || typeof l !== 'object') return;
            const row: AuditTrail = {
              id: l.id || ('DB-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7)),
              userId: l.userId ?? 0,
              username: l.username || 'System',
              role: l.role || 'Guest',
              action: l.action || '',
              details: l.details || '',
              companyId: l.companyId ?? null,
              timestamp: l.timestamp || new Date().toISOString().substring(0, 19),
            };
            if (!map.has(row.id)) { map.set(row.id, row); changed = true; }
          });
          return changed ? Array.from(map.values()).slice(0, 500) : prev;
        });
        // Don't sync local-only audit entries to the DB (auditTrails stays local-only);
        // the DB table is the source of truth surfaced here.
      } catch (e) {}
    };
    refreshAudit();
    const id = setInterval(refreshAudit, 30000);
    const onFocus = () => refreshAudit();
    try { window.addEventListener('focus', onFocus); } catch {}
    return () => { cancelled = true; clearInterval(id); try { window.removeEventListener('focus', onFocus); } catch {} };
  }, []);

  // PWA update — banner-based flow (no forced reload, no silent cache purge).
  React.useEffect(() => {
    // When a new build is ready, notify the standalone UpdateBanner via a window
    // event instead of popping a confirm() or purging caches + reloading. The user
    // decides when to refresh, so open sessions and unsaved work are never lost.
    let updateSWRef: ((reloadPage?: boolean) => Promise<void>) | undefined;
    const notifyUpdateAvailable = (version: string) => {
      try {
        console.log('New build detected, banner shown');
        window.dispatchEvent(new CustomEvent('tradecore:update-available', { detail: { version } }));
      } catch (e) {}
    };
    try {
      updateSWRef = registerSW({
        immediate: true,
        onNeedRefresh() {
          notifyUpdateAvailable('latest');
        },
        onOfflineReady() {
          console.log('App ready offline');
        },
        onRegistered(registration) {
          console.log(
            "[SW] Service Worker registered",
            registration?.scope ?? "(no registration)",
            registration?.active ? "active" : "waiting for install/activate"
          );
        },
        onRegisterError(error) {
          // Deliberately non-fatal: SW is an enhancement, never a hard dependency.
          console.warn("[SW] Service Worker registration failed — running without offline caching:", error);
        }
      });
      // The banner's "Refresh now" button calls this to skip-wait + reload under
      // the user's control.
      try { (window as any).__tradecoreUpdateSW = updateSWRef; } catch (e) {}
    } catch (e) {
      console.warn("[SW] registerSW() threw — running without offline caching:", e);
    }
    // Fallback: version.json polling (also catches heroTitle/blob changes without SW update).
    // A version change raises the banner (NOT a forced purge + reload).
    let currentVersion = localStorage.getItem('app_version') || '1.0.0';
    if (!isCurrentlyOffline()) {
      fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' })
        .then(r => r.json())
        .then(d => {
          if (d?.version && !localStorage.getItem('app_version')) {
            localStorage.setItem('app_version', d.version);
            currentVersion = d.version;
          }
        })
        .catch(() => {});
    }
    async function checkAppVersion() {
      if (isCurrentlyOffline()) return; // skip version polling while offline — avoids failed fetches
      try {
        const res = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.version && data.version !== currentVersion) {
          localStorage.setItem('app_version', data.version);
          currentVersion = data.version;
          notifyUpdateAvailable(data.version);
        }
      } catch {}
    }
    const verInterval = setInterval(checkAppVersion, 30000);
    // Keep classic SW update check + purge old v1 cache that caused TANZANIA vs UNIVERSAL split
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        if (isCurrentlyOffline()) return; // don't ping the SW update endpoint while offline
        regs.forEach(r => {
          try {
            // Ping for an update; if one installs, our install-time postMessage
            // (NEW_VERSION_AVAILABLE) plus onNeedRefresh both raise the banner.
            r.update();
          } catch {}
          // If old v1 SW still active (TANZANIA branding), force unregister so new workbox SW takes over
          try {
            const url = (r as any).active?.scriptURL || (r as any).waiting?.scriptURL || '';
            if (url.includes('tanzaniatradecore-v1') || url.includes('old')) {
              r.unregister().catch(()=>{});
            }
          } catch {}
        });
      });
      // Delete old cache that held stale index.html with TANZANIA hero
      if ('caches' in window) {
        caches.keys().then(keys => keys.forEach(k => {
          if (k.includes('tanzaniatradecore-v1') || k.includes('tanzania')) {
            caches.delete(k).catch(()=>{});
          }
        }));
      }
    }
    return () => clearInterval(verInterval);
  }, []);

  // --- PRESERVE SAVED WORK: login form draft + in-progress company selection. ---
  // Before any reload (SW update refresh, manual F5, browser close) we persist the
  // half-typed login fields + the selected auth view to localStorage, then restore
  // them automatically on next load — so an update banner refresh never wipes a
  // half-filled form or a just-picked company.
  const loginDraftRef = React.useRef({ username: '', password: '', authView: 'login' });
  loginDraftRef.current = { username: loginUsername, password: loginPassword, authView };
  React.useEffect(() => {
    const persistDraft = () => {
      try {
        if (currentUser) return; // signed-in: nothing to preserve on the public form
        const draft = { username: loginDraftRef.current.username, authView: loginDraftRef.current.authView };
        if (draft.username) {
          try { localStorage.setItem('loginFormData', JSON.stringify(draft)); } catch {}
        }
      } catch (e) {}
    };
    // Restore the draft ONCE when the app boots (public/not-logged-in view).
    try {
      const raw = localStorage.getItem('loginFormData');
      if (raw && !localStorage.getItem('tradecore_user')) {
        const d = JSON.parse(raw);
        if (d && typeof d === 'object') {
          if (typeof d.username === 'string') setLoginUsername(d.username);
          if (d.authView && (d.authView === 'login' || d.authView === 'register' || d.authView === 'forgot' || d.authView === 'reset')) setAuthView(d.authView);
          console.log('User data preserved and restored');
        }
      }
    } catch (e) {}
    window.addEventListener('beforeunload', persistDraft);
    window.addEventListener('pagehide', persistDraft);
    // Used by the update banner's "Refresh now": flush queued mutations + local
    // cache synchronously before the controlled reload so no work is lost.
    try {
      (window as any).__tradecorePreserveWork = () => {
        try { flushPendingLocalCacheSync(); } catch (e) {}
        try { flushQueueNow(); } catch (e) {}
        try { persistDraft(); } catch (e) {}
      };
    } catch (e) {}
    return () => {
      window.removeEventListener('beforeunload', persistDraft);
      window.removeEventListener('pagehide', persistDraft);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Role/session cache: after a successful login (or session restore) we store a
  // compact snapshot of the user's role + scope so the next boot can restore the
  // session instantly without waiting on a full server blob. Logged on restore.
  const persistRoleCache = React.useCallback((u: any) => {
    try {
      if (!u || !u.id) return;
      localStorage.setItem('tradecore_role_cache', JSON.stringify({
        id: u.id,
        user_id: u.id,
        username: u.username,
        role: u.role,
        companyId: u.companyId ?? u.company_id ?? null,
        company_id: u.companyId ?? u.company_id ?? null,
        branchId: u.branchId ?? u.branch_id ?? null,
        branch_id: u.branchId ?? u.branch_id ?? null,
        storeId: u.storeId ?? u.store_id ?? null,
        store_id: u.storeId ?? u.store_id ?? null,
        allowedPages: u.allowedPages ?? null,
        cachedAt: Date.now()
      }));
    } catch (e) {}
  }, []);
  // SESSION-META-ONLY PERSIST (2026-09-07): this effect used to re-run on EVERY
  // currentUser object identity change and call persistRoleCache + log 'User session
  // preserved/restored' (observed 7x per boot and 2x after every Flush OK). The
  // session cache is just meta (id/role/company/branch/store/pages) — it only needs
  // to be (re)written when that meta actually changes, never because an SSE echo or
  // boot re-parse handed us a fresh object with identical fields.
  const lastRoleMetaPersistedRef = React.useRef<string>('');
  React.useEffect(() => {
    const roleMetaOf = (u: any) => u && u.id ? `${u.id}|${u.role}|${u.companyId ?? u.company_id ?? ''}|${u.branchId ?? u.branch_id ?? ''}|${u.storeId ?? u.store_id ?? ''}|${JSON.stringify(u.allowedPages ?? null)}` : '';
    const meta = roleMetaOf(currentUser);
    if (meta && meta !== lastRoleMetaPersistedRef.current) {
      lastRoleMetaPersistedRef.current = meta;
      persistRoleCache(currentUser);
      console.log('User session preserved/restored');
    } else if (!meta && lastRoleMetaPersistedRef.current) {
      lastRoleMetaPersistedRef.current = '';
      // Any logout (explicit, revoked, terminated, auto-lock) drops the cached
      // session so a stale code never resurrects a signed-out account at next boot.
      try { localStorage.removeItem('tradecore_role_cache'); } catch {}
    }
  }, [currentUser, persistRoleCache]);

  // Clear the login-form draft once a real session is active (no stale password
  // should be restored after logout).
  React.useEffect(() => {
    if (currentUser) {
      try { localStorage.removeItem('loginFormData'); } catch {}
    }
  }, [currentUser]);

  // --- SYNC TO STORAGE & CLOUD ---
  const saveAllData = async (updatedFields: Partial<{
    companies: Company[]; branches: Branch[]; stores: Store[]; users: User[];
    categories: string[]; taxes: Tax[]; suppliers: Supplier[]; customers: Customer[];
    stockItems: StockItem[]; purchaseOrders: PurchaseOrder[]; salesOrders: SalesOrder[];
    expenses: Expense[]; auditTrails: AuditTrail[]; securityLogs: SecurityLog[]; settings: Settings;
    rolePermissions: Record<string, string[]>;
    posShifts: PosShift[];
    stockTransfers: StockTransfer[];
    contactMessages: ContactMessage[];
    marketplaceProducts: MarketplaceProduct[];
    marketplaceCustomers: MarketplaceCustomer[];
    marketplaceOrders: MarketplaceOrder[];
    marketplaceClicks: MarketplaceClick[];
    reviews: Review[];
    productViews: ProductView[];
    wallets: SellerWallet[];
    walletTransactions: WalletTransaction[];
    withdrawals: Withdrawal[];
    affiliates: Affiliate[];
    affiliateClicks: AffiliateClick[];
    affiliateSales: AffiliateSale[];
    affiliateWithdrawals: AffiliateWithdrawal[];
    searchSynonyms: SearchSynonym[];
    pushSubscriptions: PushSubscriptionRec[];
    collections: CollectionRecord[];
    webhookLogs: WebhookLog[];
    adminEarnings: AdminEarning[];
    offers: Offer[];
    offerMessages: OfferMessage[];
    groupDeals: GroupDeal[];
    groupDealParticipants: GroupDealParticipant[];
    whatsappConversations: WhatsappConversation[];
    notificationLogs: NotificationLog[];
    deliveries: Delivery[];
    deliveryUpdates: DeliveryUpdate[];
    installmentPlans: InstallmentPlan[];
    installmentOrders: InstallmentOrder[];
    installmentPayments: InstallmentPayment[];
    liveStreams: LiveStream[];
    liveComments: LiveComment[];
    loyaltyCustomers: LoyaltyCustomer[];
    loyaltyTransactions: LoyaltyTransaction[];
    loyaltyRedeemCodes: LoyaltyRedeemCode[];
    voiceSearches: VoiceSearchLog[];
    qrScans: QrScanLog[];
    traReceipts: TraReceipt[];
    // --- MEGA BUILD: 7 ultimate features ---
    escrowTransactions: EscrowTransaction[];
    chatConversations: ChatConversation[];
    chatMessages: ChatMessage[];
    visualSearches: VisualSearchRecord[];
    productReturns: ProductReturn[];
    disputes: Dispute[];
    disputeMessages: DisputeMessage[];
    flashSales: FlashSale[];
    appNotifications: AppNotification[];
    bulkUploads: BulkUploadJob[];
    stories: Story[];
    storyViews: StoryView[];
    shippingZones?: ShippingZone[];
  }>) => {
    // Record cooldown timestamp to pause background synchronization polling
    lastLocalWriteTimeRef.current = Date.now();
    // NOTE: Do NOT advance stateTimestampRef here — the client's Date.now() is
    // always ahead of the server's time(), which poisons the monotonic watermark
    // and causes valid SSE updates to be rejected as "older than local state".
    // stateTimestampRef is only advanced on flush success or when an incoming
    // server payload is actually applied.
    const nowIso = new Date().toISOString();
    // Track which top-level collections changed so the server can per-collection merge
    // and avoid last-write-wins resurrection (e.g. Device B's stale blob reviving a deleted product).
    // IMPORTANT: auditTrails is excluded from dirty tracking — it is database-only and not
    // part of the sync blob. Including it causes an infinite 78->0 loop.
    try { Object.keys(updatedFields || {}).forEach(k => { if (!NON_SYNCED_KEYS.has(k)) { flushDirtyKeysRef.current.add(k); stampOptimisticWrite(k); } }); } catch {}
    // Snapshot the exact values so a 409 rebase can replay the user's edits on top
    // of the fresh server blob (data survives even if dbStateRef gets overwritten).
    try {
      Object.keys(updatedFields || {}).forEach((k: string) => {
        if (!NON_SYNCED_KEYS.has(k)) (dirtyValuesRef.current as any)[k] = (updatedFields as any)[k];
      });
    } catch {}
    
    // CRITICAL MASTER-DATA FLUSH (2026-09-07): company/hierarchy/category changes are
    // too important to ride the 6s debounce. If the user immediately logs out or closes
    // the tab, the debounced flush can be lost and the next login's server snapshot
    // silently discards it (deleted company resurrects; new company / category vanish).
    // Force a near-immediate flush whenever one of these collections changed.
    try {
      if (Object.keys(updatedFields || {}).some(k => MASTER_SYNC_KEYS.has(k))) {
        // MASTER-KEY DELTA FLUSH (2026-09-07-02): category/company/hierarchy edits ride
        // the SAME delta-only pipeline as every other write — the key-based shouldFlush
        // releases any business-entity delta regardless of byte size, so narrowing the
        // payload to ONLY the edited collection is safe. forceFlushNow bypasses the 6s
        // debounce so a logout/close immediately after editing can't strand the edit.
        if (pendingFlushTimerRef.current !== null) {
          window.clearTimeout(pendingFlushTimerRef.current);
          pendingFlushTimerRef.current = null;
        }
        forceFlushNow();
      }
    } catch {}
    
    // Get absolute latest synchronous values from the reference
    const current = dbStateRef.current;

    // Mutate reference instantly so any subsequent call in the same tick sees these changes
    const nextState = {
      companies: updatedFields.companies !== undefined ? updatedFields.companies : current.companies,
      branches: updatedFields.branches !== undefined ? updatedFields.branches : current.branches,
      stores: updatedFields.stores !== undefined ? updatedFields.stores : current.stores,
      users: updatedFields.users !== undefined ? updatedFields.users : current.users,
      categories: updatedFields.categories !== undefined ? updatedFields.categories : current.categories,
      taxes: updatedFields.taxes !== undefined ? updatedFields.taxes : current.taxes,
      suppliers: updatedFields.suppliers !== undefined ? updatedFields.suppliers : current.suppliers,
      customers: updatedFields.customers !== undefined ? updatedFields.customers : current.customers,
      stockItems: updatedFields.stockItems !== undefined ? updatedFields.stockItems : current.stockItems,
      purchaseOrders: updatedFields.purchaseOrders !== undefined ? updatedFields.purchaseOrders : current.purchaseOrders,
      salesOrders: updatedFields.salesOrders !== undefined ? updatedFields.salesOrders : current.salesOrders,
      expenses: updatedFields.expenses !== undefined ? updatedFields.expenses : current.expenses,
      auditTrails: updatedFields.auditTrails !== undefined ? updatedFields.auditTrails : current.auditTrails,
      securityLogs: updatedFields.securityLogs !== undefined ? updatedFields.securityLogs : current.securityLogs,
      settings: updatedFields.settings !== undefined ? updatedFields.settings : current.settings,
      rolePermissions: updatedFields.rolePermissions !== undefined ? updatedFields.rolePermissions : current.rolePermissions,
      posShifts: updatedFields.posShifts !== undefined ? updatedFields.posShifts : current.posShifts,
      stockTransfers: updatedFields.stockTransfers !== undefined ? updatedFields.stockTransfers : current.stockTransfers,
      contactMessages: updatedFields.contactMessages !== undefined ? updatedFields.contactMessages : current.contactMessages,
      marketplaceProducts: updatedFields.marketplaceProducts !== undefined ? updatedFields.marketplaceProducts : current.marketplaceProducts,
      marketplaceCustomers: updatedFields.marketplaceCustomers !== undefined ? updatedFields.marketplaceCustomers : current.marketplaceCustomers,
      marketplaceOrders: updatedFields.marketplaceOrders !== undefined ? updatedFields.marketplaceOrders : current.marketplaceOrders,
      marketplaceClicks: updatedFields.marketplaceClicks !== undefined ? updatedFields.marketplaceClicks : current.marketplaceClicks,
      reviews: updatedFields.reviews !== undefined ? updatedFields.reviews : current.reviews,
      productViews: updatedFields.productViews !== undefined ? updatedFields.productViews : current.productViews,
      wallets: updatedFields.wallets !== undefined ? updatedFields.wallets : current.wallets,
      walletTransactions: updatedFields.walletTransactions !== undefined ? updatedFields.walletTransactions : current.walletTransactions,
      withdrawals: updatedFields.withdrawals !== undefined ? updatedFields.withdrawals : current.withdrawals,
      affiliates: updatedFields.affiliates !== undefined ? updatedFields.affiliates : current.affiliates,
      affiliateClicks: updatedFields.affiliateClicks !== undefined ? updatedFields.affiliateClicks : current.affiliateClicks,
      affiliateSales: updatedFields.affiliateSales !== undefined ? updatedFields.affiliateSales : current.affiliateSales,
      affiliateWithdrawals: updatedFields.affiliateWithdrawals !== undefined ? updatedFields.affiliateWithdrawals : current.affiliateWithdrawals,
      searchSynonyms: updatedFields.searchSynonyms !== undefined ? updatedFields.searchSynonyms : current.searchSynonyms,
      pushSubscriptions: updatedFields.pushSubscriptions !== undefined ? updatedFields.pushSubscriptions : current.pushSubscriptions,
      collections: updatedFields.collections !== undefined ? updatedFields.collections : current.collections,
      webhookLogs: updatedFields.webhookLogs !== undefined ? updatedFields.webhookLogs : current.webhookLogs,
      adminEarnings: updatedFields.adminEarnings !== undefined ? updatedFields.adminEarnings : current.adminEarnings,
      offers: updatedFields.offers !== undefined ? updatedFields.offers : current.offers,
      offerMessages: updatedFields.offerMessages !== undefined ? updatedFields.offerMessages : current.offerMessages,
      groupDeals: updatedFields.groupDeals !== undefined ? updatedFields.groupDeals : current.groupDeals,
      groupDealParticipants: updatedFields.groupDealParticipants !== undefined ? updatedFields.groupDealParticipants : current.groupDealParticipants,
      whatsappConversations: updatedFields.whatsappConversations !== undefined ? updatedFields.whatsappConversations : current.whatsappConversations,
      notificationLogs: updatedFields.notificationLogs !== undefined ? updatedFields.notificationLogs : current.notificationLogs,
      deliveries: updatedFields.deliveries !== undefined ? updatedFields.deliveries : current.deliveries,
      deliveryUpdates: updatedFields.deliveryUpdates !== undefined ? updatedFields.deliveryUpdates : current.deliveryUpdates,
      installmentPlans: updatedFields.installmentPlans !== undefined ? updatedFields.installmentPlans : current.installmentPlans,
      installmentOrders: updatedFields.installmentOrders !== undefined ? updatedFields.installmentOrders : current.installmentOrders,
      installmentPayments: updatedFields.installmentPayments !== undefined ? updatedFields.installmentPayments : current.installmentPayments,
      liveStreams: updatedFields.liveStreams !== undefined ? updatedFields.liveStreams : current.liveStreams,
      liveComments: updatedFields.liveComments !== undefined ? updatedFields.liveComments : current.liveComments,
      loyaltyCustomers: updatedFields.loyaltyCustomers !== undefined ? updatedFields.loyaltyCustomers : current.loyaltyCustomers,
      loyaltyTransactions: updatedFields.loyaltyTransactions !== undefined ? updatedFields.loyaltyTransactions : current.loyaltyTransactions,
      loyaltyRedeemCodes: updatedFields.loyaltyRedeemCodes !== undefined ? updatedFields.loyaltyRedeemCodes : current.loyaltyRedeemCodes,
      voiceSearches: updatedFields.voiceSearches !== undefined ? updatedFields.voiceSearches : current.voiceSearches,
      qrScans: updatedFields.qrScans !== undefined ? updatedFields.qrScans : current.qrScans,
      traReceipts: updatedFields.traReceipts !== undefined ? updatedFields.traReceipts : current.traReceipts,
      // --- MEGA BUILD: 7 ultimate features ---
      escrowTransactions: updatedFields.escrowTransactions !== undefined ? updatedFields.escrowTransactions : current.escrowTransactions,
      chatConversations: updatedFields.chatConversations !== undefined ? updatedFields.chatConversations : current.chatConversations,
      chatMessages: updatedFields.chatMessages !== undefined ? updatedFields.chatMessages : current.chatMessages,
      visualSearches: updatedFields.visualSearches !== undefined ? updatedFields.visualSearches : current.visualSearches,
      productReturns: updatedFields.productReturns !== undefined ? updatedFields.productReturns : current.productReturns,
      disputes: updatedFields.disputes !== undefined ? updatedFields.disputes : current.disputes,
      disputeMessages: updatedFields.disputeMessages !== undefined ? updatedFields.disputeMessages : current.disputeMessages,
      flashSales: updatedFields.flashSales !== undefined ? updatedFields.flashSales : current.flashSales,
      appNotifications: updatedFields.appNotifications !== undefined ? updatedFields.appNotifications : current.appNotifications,
      bulkUploads: updatedFields.bulkUploads !== undefined ? updatedFields.bulkUploads : current.bulkUploads,
      stories: updatedFields.stories !== undefined ? updatedFields.stories : current.stories,
      storyViews: updatedFields.storyViews !== undefined ? updatedFields.storyViews : current.storyViews,
      shippingZones: updatedFields.shippingZones !== undefined ? updatedFields.shippingZones : (current.shippingZones || []),
    };
    dbStateRef.current = nextState;

    // 1. Update React states instantly for 100% snappy UI response
    applyCollectionState(updatedFields as unknown as Record<string, any>);

    // 2. NO localStorage write — source of truth is MySQL database.
    //    Every write goes through atomic API endpoints directly to the server.

    // 3. Atomic API flush: for each changed collection, call the appropriate
    //    atomic endpoint immediately (no debounce, no localStorage caching).
    //    This ensures every save goes straight to the MySQL database.
    try {
      const companyId = dbStateRef.current?.companies?.[0]?.id || (dbStateRef.current as any)?.companies?.[0]?.id || '';
      const changedKeys = Object.keys(updatedFields || {}).filter(k => !NON_SYNCED_KEYS.has(k));
      for (const key of changedKeys) {
        const val = (updatedFields as any)[key];
        if (!val) continue;

        // Route each collection to its atomic API endpoint
        switch (key) {
          case 'expenses':
            if (Array.isArray(val)) {
              // For array replacements, upsert each expense that has an id
              for (const e of val) { if (e?.id) upsertExpense(e, companyId).catch(() => {}); }
            }
            break;
          case 'suppliers':
            if (Array.isArray(val)) {
              for (const s of val) { if (s?.id) upsertSupplier(s, companyId).catch(() => {}); }
            }
            break;
          case 'purchaseOrders':
            if (Array.isArray(val)) {
              for (const po of val) { if (po?.id) upsertPurchaseOrder(po, companyId).catch(() => {}); }
            }
            break;
          case 'customers':
            if (Array.isArray(val)) {
              for (const c of val) { if (c?.id) upsertCustomer(c, companyId).catch(() => {}); }
            }
            break;
          case 'settings':
            if (val && typeof val === 'object') {
              upsertCompanySettings({ ...val, company_id: companyId } as any, companyId).catch(() => {});
            }
            break;
          case 'taxes':
            if (Array.isArray(val)) {
              for (const t of val) { if (t?.id) upsertTaxRule(t, companyId).catch(() => {}); }
            }
            break;
          case 'flashSales':
            if (Array.isArray(val)) {
              for (const fs of val) { if (fs?.id) upsertFlashSale(fs, companyId).catch(() => {}); }
            }
            break;
          case 'stories':
            if (Array.isArray(val)) {
              for (const s of val) { if (s?.id) upsertStory(s, companyId).catch(() => {}); }
            }
            break;
          case 'disputes':
            if (Array.isArray(val)) {
              for (const d of val) { if (d?.id) upsertDispute(d, companyId).catch(() => {}); }
            }
            break;
          case 'disputeMessages':
            if (Array.isArray(val)) {
              for (const m of val) { if (m?.id) upsertDisputeMessage(m).catch(() => {}); }
            }
            break;
          case 'productReturns':
            if (Array.isArray(val)) {
              for (const r of val) { if (r?.id) upsertProductReturn(r, companyId).catch(() => {}); }
            }
            break;
          case 'chatConversations':
            if (Array.isArray(val)) {
              for (const c of val) { if (c?.id) upsertChatConversation(c, companyId).catch(() => {}); }
            }
            break;
          case 'chatMessages':
            if (Array.isArray(val)) {
              for (const m of val) { if (m?.id) upsertChatMessage(m).catch(() => {}); }
            }
            break;
          case 'escrowTransactions':
            if (Array.isArray(val)) {
              for (const e of val) { if (e?.id) upsertEscrowTransaction(e, companyId).catch(() => {}); }
            }
            break;
          case 'visualSearches':
            if (Array.isArray(val)) {
              for (const v of val) { if (v?.id) upsertVisualSearch(v, companyId).catch(() => {}); }
            }
            break;
          case 'installmentPlans':
            if (Array.isArray(val)) {
              for (const p of val) { if (p?.id) upsertInstallmentPlan(p, companyId).catch(() => {}); }
            }
            break;
          case 'installmentOrders':
            if (Array.isArray(val)) {
              for (const o of val) { if (o?.id) upsertInstallmentOrder(o, companyId).catch(() => {}); }
            }
            break;
          case 'installmentPayments':
            if (Array.isArray(val)) {
              for (const p of val) { if (p?.id) upsertInstallmentPayment(p).catch(() => {}); }
            }
            break;
          // These collections already have atomic endpoints via api.ts
          case 'stockItems':
          case 'companies':
          case 'branches':
          case 'stores':
          case 'users':
          case 'marketplaceProducts':
          case 'marketplaceOrders':
          case 'salesOrders':
            // Handled by existing mutateCollectionRecord / apiUpsert* functions
            // Schedule the existing PHP flush for these
            schedulePhpFlush();
            break;
          default:
            // For collections without dedicated atomic endpoints, use the existing
            // save_state blob flush as fallback (keeps backward compatibility)
            schedulePhpFlush();
            break;
        }
      }
    } catch (err) {
      console.warn('[saveAllData] Atomic API dispatch error:', err);
      // Fallback: schedule the blob flush if atomic dispatch fails
      schedulePhpFlush();
    }
  };

  // Coalesce rapid saves into a single server round-trip. Background edits use a long
  // debounce window (FLUSH_DEBOUNCE_MS) to eliminate back-to-back wire traffic; when
  // forceFlushRef is set (explicit critical user action), debounce is CRITICAL_* 150ms.
  // userInitiated=true marks flushToPhp as an explicit save/delete action so its <1KB
  // micro-flush suppression (shouldFlush) never drops a genuine small user edit.
  const flushUserInitiatedRef = React.useRef<boolean>(false);
  const schedulePhpFlush = (userInitiated: boolean = false) => {
    flushDirtyRef.current = true;
    // SEQUENTIAL FLUSH QUEUE (2026-09-07-03): while an HTTP flush is in flight we do
    // NOT arm a second debounce timer — that would fire flushToPhp during the active
    // request and produce a SECOND simultaneous HTTP call. Instead, every mid-flight
    // dirty trigger is coalesced into ONE pending delta batch (flushQueuedRef) which
    // the in-flight pass drains immediately after it commits + locks clientVersion.
    if (flushInFlightRef.current) { flushQueuedRef.current = true; return; }
    // FIX (2026-09-07): the userInitiated flag used to be overwritten HERE, before the
    // pending-timer early-return. saveAllData calls schedulePhpFlush() with the default
    // false AFTER its master-key branch already force-armed a userInitiated=true flush,
    // so the running flush read the demoted flag and the micro-guard could swallow the
    // tiny (categories-only) payload. Only (re)set the flag when a timer is actually armed.
    if (pendingFlushTimerRef.current !== null) return;
    flushUserInitiatedRef.current = userInitiated;
    const debounceMs = forceFlushRef.current ? CRITICAL_FLUSH_DEBOUNCE_MS : FLUSH_DEBOUNCE_MS;
    forceFlushRef.current = false;
    pendingFlushTimerRef.current = window.setTimeout(() => {
      pendingFlushTimerRef.current = null;
      void flushToPhp();
    }, debounceMs);
  };

  // Force a near-immediate server flush (for critical explicit user actions: checkout,
  // save/delete product, user password, orders, approvals, offer/story edits).
  const forceFlushRef = React.useRef<boolean>(false);
  const forceFlushNow = () => { forceFlushRef.current = true; schedulePhpFlush(true); };

  // --- ATOMIC MICRO-UPDATE FOR SINGLE-RECORD CRUD ---
  // Isolated, optimistic, ack-confirmed, per-record write. This NEVER rewrites the
  // whole blob / full array. It:
  //   1. Applies the change ATOMICALLY via functional setState (prev =>
  //      prev.map/filter) so every other record is preserved and concurrent edits
  //      never resurrect deleted/old rows.
  //   2. Marks the collection dirty + snapshots the new array so any background
  //      server ingress (SSE / cross-tab poll / 409 rebase) preserves this local
  //      edit until the server acknowledges it.
  //   3. Sends ONLY this record through mutate_record (PATCH-style), awaiting an
  //      explicit HTTP 200 + recordId ack BEFORE trusting the write.
  //   4. On success, clears the dirty bookkeeping and records the new server version
  //      so a stale background fetch can no longer roll the change back.
  const mutateCollectionRecord = React.useCallback(
    async (
      collection: string,
      op: 'upsert' | 'delete',
      recordId: string | number,
      record: any | null,
      opts?: { silent?: boolean }
    ): Promise<boolean> => {
      lastLocalWriteTimeRef.current = Date.now();
      const setter = dataSettersRef.current?.[collection];
      const current = (dbStateRef.current as any)?.[collection] ?? [];

      // --- 1. Atomic local state merge (functional, never wholesale replace) ---
      const applyAtomic = (updater: (prev: any[]) => any[]) => {
        if (setter) {
          setter((prev: any[]) => updater(Array.isArray(prev) ? prev : []));
        } else if (dbStateRef.current) {
          (dbStateRef.current as any)[collection] = updater(current);
        }
      };

      if (op === 'delete') {
        applyAtomic(prev => prev.filter((rec: any) => String(rec?.id) !== String(recordId)));
      } else if (record) {
        applyAtomic(prev => {
          const exists = prev.some((rec: any) => String(rec?.id) === String(recordId));
          if (exists) return prev.map((rec: any) => String(rec?.id) === String(recordId) ? { ...rec, ...record } : rec);
          return [...prev, record];
        });
      }

      // --- 2. Compute the new authoritative array + snapshot it (dirty protection) ---
      let nextArray: any[];
      if (op === 'delete') {
        nextArray = current.filter((rec: any) => String(rec?.id) !== String(recordId));
      } else if (record) {
        const exists = current.some((rec: any) => String(rec?.id) === String(recordId));
        nextArray = exists
          ? current.map((rec: any) => String(rec?.id) === String(recordId) ? { ...rec, ...record } : rec)
          : [...current, record];
      } else {
        nextArray = current;
      }

      // Mutate the reference, mark dirty + snapshot (so background ingress / rebase
      // preserves this edit), and write the local cache through saveAllData's plumbing
      // WITHOUT allowing the full-collection blob flush to race the micro-update.
      if (dbStateRef.current) (dbStateRef.current as any)[collection] = nextArray;
      if (!NON_SYNCED_KEYS.has(collection)) {
        flushDirtyKeysRef.current.add(collection);
        stampOptimisticWrite(collection);
        (dirtyValuesRef.current as any)[collection] = nextArray;
      }
      try {
        // localStorage.write REMOVED — source of truth is MySQL database.
        // The atomic API call below persists directly to the server.
      } catch {}

      // --- 3. Isolated micro-update with explicit ack ---
      // OFFLINE gate: the edit is already applied + snapshotted above. Do NOT fire the
      // network PATCH now — it would reject with "Failed to fetch". Return false (dirty
      // key stays) so the 'online' resume flushes it cleanly instead of racing the loop.
      if (offlineRef.current) {
        if (!opts?.silent) toast.info('Offline — change saved locally, will sync when back online.');
        return false;
      }
      const baseVer = lastServerVersionRef.current;
      const result = await mutateCollectionRecordToPhp(collection, op, recordId, record, baseVer, 20000);

      if (result.ok) {
        // 4a. Server acknowledged (HTTP 200 + recordId). Clear dirty bookkeeping and
        //     adopt the new monotonic version so stale ingress is rejected.
        if (result.newVersion && result.newVersion > 0) {
          isApplyingRemoteUpdateRef.current = true;
          try {
            lastServerVersionRef.current = result.newVersion;
            lastFlushedVersionRef.current = result.newVersion;
            noteServerVersion(result.newVersion);
          } finally {
            isApplyingRemoteUpdateRef.current = false;
          }
        }
        flushDirtyKeysRef.current.delete(collection);
        delete (dirtyValuesRef.current as any)[collection];
        clearOptimisticWrite(collection);
        if (result.newVersion && result.newVersion > 0 && result.newVersion > lastAckVersionRef.current) {
          lastAckVersionRef.current = result.newVersion;
        }
        if (flushDirtyKeysRef.current.size === 0) flushDirtyRef.current = false;
        return true;
      }

      if (result.stale && result.serverRecord !== undefined && result.serverRecord !== null) {
        // 4b. Per-record optimistic-lock conflict: server has a NEWER copy of this
        //     exact record. The server's version wins to prevent silent rollback.
        applyAtomic(prev => prev.map((rec: any) => String(rec?.id) === String(recordId) ? result.serverRecord : rec));
        if (dbStateRef.current) {
          (dbStateRef.current as any)[collection] = ((dbStateRef.current as any)[collection] || []).map(
            (rec: any) => String(rec?.id) === String(recordId) ? result.serverRecord : rec
          );
          if (result.newVersion && result.newVersion > 0) lastServerVersionRef.current = result.newVersion;
        }
        flushDirtyKeysRef.current.delete(collection);
        delete (dirtyValuesRef.current as any)[collection];
        if (!opts?.silent) toast.warning('A newer version of this record was saved by another device. Showing the latest.');
        return false;
      }

      if (result.conflict) {
        // 4c. Whole-blob version conflict: another write bumped _version while we
        //     were editing. Merge this record onto the server's authoritative state.
        const conflict = consumeConflictData();
        if (conflict?.serverData && dbStateRef.current) {
          const merged = { ...dbStateRef.current, ...conflict.serverData };
          if (!NON_SYNCED_KEYS.has(collection) && (dirtyValuesRef.current as any)[collection] !== undefined) {
            merged[collection] = (dirtyValuesRef.current as any)[collection];
          }
          applyData(merged, true);
          try { localStorage.setItem('tradecore_data', JSON.stringify(merged)); } catch {}
        }
        if (Number(conflict?.serverVersion ?? result.newVersion) > 0) {
          isApplyingRemoteUpdateRef.current = true;
          try {
            const v = Number(conflict?.serverVersion ?? result.newVersion);
            lastServerVersionRef.current = v;
            lastRealtimeVersionRef.current = v;
            noteServerVersion(v);
          } finally {
            isApplyingRemoteUpdateRef.current = false;
          }
        }
        if (!opts?.silent) toast.error('Sync conflict detected. Your change will retry on the next sync.');
        // Keep the record dirty so the debounced flush retries it against the new version.
        return false;
      }

      // 4d. Network/other failure — keep the local edit + dirty flag so the debounced
      //     background flush retries the whole collection safely.
      if (!opts?.silent) toast.error('Could not reach the server. Your change is saved locally and will retry.');
      return false;
    },
    []
  );

  // Wait until the PHP flush pipeline is idle. Used before destructive resyncs
  // (company switch) so an in-flight save_state write can't be raced or dropped.
  // Bounds the wait so a permanently-failed flush never blocks the switch forever.
  // NOTE: declared as a stable helper (captured refs, no state) — safe to call from
  // the company-switch effect's async microtask.
  const settleFlushes = async (maxWaitMs: number = 10000): Promise<void> => {
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
      if (!flushInFlightRef.current && pendingFlushTimerRef.current === null) return;
      await new Promise<void>((resolve) => {
        const fallbackTimer = window.setTimeout(() => resolve(), 400);
        pendingFlushWaitersRef.current.push(() => { window.clearTimeout(fallbackTimer); resolve(); });
      });
    }
    console.warn('[PHP API] settleFlushes timed out after ' + maxWaitMs + 'ms — proceeding with resync anyway');
  };

  // KEY-BASED FLUSH GUARD (2026-09-07-02). Pure entity-type evaluation:
  //   - ANY dirty business entity key      -> IMMEDIATELY release (size is irrelevant).
  //   - STRICTLY system/session metadata   -> suppress (nothing durable to persist).
  //   - Anything else (settings, roles...) -> release (safe default).
  // There are NO payload-size thresholds here: a 0.2KB categories delta must be flushed
  // exactly like a 115KB full-state blob was in the pre-regression build.
  const shouldFlush = (flushableKeys: string[]): boolean => {
    if (flushableKeys.length === 0) return false;
    if (flushableKeys.some((k) => BUSINESS_ENTITY_KEYS.has(k))) return true;
    if (flushableKeys.every((k) => SYSTEM_SESSION_KEYS.has(k))) return false;
    return true;
  };

  // Send the latest dirty delta to the PHP/MySQL backend without blocking the UI.
  const flushToPhp = async () => {
    // SEQUENTIAL FLUSH QUEUE (2026-09-07-03): this is the ONLY entry into the network
    // flush engine, guarded by the isFlushing lock (flushInFlightRef). A second flush
    // that fires while an HTTP request is active does NOT drop its work — it queues a
    // single coalesced pending batch (flushQueuedRef) that the running pass drains in
    // the SAME lock, always AFTER locking clientVersion to the freshly returned
    // response.serverVersion. This eliminates the "second flush sends stale version
    // -> 409 Conflict" double-flush race.
    if (flushInFlightRef.current) { flushQueuedRef.current = true; return; }
    // OFFLINE: do not attempt the network flush — the local cache + dirty bookkeeping are
    // already safe (the edit is applied optimistically). Leave flushDirtyRef set so the
    // 'online' listener re-arms this flush and pushes the pending edits exactly once,
    // without clearing or resetting any active React state.
    if (offlineRef.current) {
      setPhpSyncing(false);
      return;
    }
    flushInFlightRef.current = true; // isFlushing lock — held until the whole coalesced queue drains
    setPhpSyncing(true);
    setPhpSyncMessage('Saving changes to server...');
    console.log('Flush started');
    try {
      // COALESCED DRAIN LOOP: repeat the HTTP pass while one mid-flight pending batch
      // coalesced. Each pass consumes the token and re-reads lastServerVersionRef — which
      // the PREVIOUS pass's success handler locked BEFORE this pass started — so a queued
      // delta always carries the fresh server version. Capped to bound pathological load.
      let queuedPasses = 0;
      do {
      queuedPasses++;
      flushQueuedRef.current = false;
      // Preserve the session + role snapshot BEFORE touching the network so a crash
      // or forced reload mid-flush can never strand the user on the login page
      // (restoreRoleCacheAtBoot + the boot session restore read these keys).
      try {
        if (currentUser) {
          localStorage.setItem('tradecore_user', JSON.stringify(currentUser));
          persistRoleCache(currentUser);
        }
        const st = dbStateRef.current;
        if (st) { void cacheSystemState(st).catch(() => {}); }
      } catch (e) {}
      let saveOk = false;
      const MAX_ATTEMPTS = 5;
      const flushStartMs = Date.now();
      for (let attempt = 1; attempt <= MAX_ATTEMPTS && !saveOk; attempt++) {
        if (!flushDirtyRef.current) break;
        // CRITICAL: exclude ALL volatile keys (auditTrails, active_company_id, lastActiveAt,
        // lastSeen, _companySwitch) from flush — they are not sync-blob state and can never
        // leave the dirty set / trigger a network round-trip. This closes the "0.1KB
        // (1 dirty key) -> Flush OK -> re-dirty" echo loop.
        const dirtySnapshot: string[] = Array.from(flushDirtyKeysRef.current).filter((k): k is string => typeof k === 'string' && !NON_SYNCED_KEYS.has(k));
        // ZERO-DIRTY GUARD: with no flushable dirty keys there is nothing to sync — BYPASS
        // the HTTP request completely. The legacy path fell through to a full-state blob upload
        // here (a 120KB+ thin 'save_state' POST on every idle flush, including a pointless
        // server version bump with no data). Full-state uploads still exist where they are
        // intentional (initial DB seed, restore factory defaults) and call saveSystemDataToPhp
        // directly — never through this pipeline.
        if (dirtySnapshot.length === 0) {
          flushDirtyKeysRef.current.clear();
          delete (dirtyValuesRef.current as any)['auditTrails'];
          flushDirtyRef.current = false;
          break;
        }
        const serverVer = lastServerVersionRef.current;
        // Build payload: send ONLY the dirty collections, never the full state.
        // Prefer the value snapshot recorded at save-time (dirtyValuesRef) so retries
        // after a 409 rebase still carry the user's actual edits.
        const fullState = dbStateRef.current;
        const deltaData: any = { lastUpdated: new Date().toISOString() };
        for (const key of dirtySnapshot) {
          const snap = (dirtyValuesRef.current as any)[key];
          deltaData[key] = snap !== undefined ? snap : (fullState as any)[key];
        }
        // Strip auditTrails from sends to prevent blob pollution (never synced).
        delete (deltaData as any).auditTrails;
        const dataToSend = deltaData;
        const payloadBytes = new Blob([JSON.stringify(dataToSend)]).size;
        // KEY-BASED SYNC GATE (2026-09-07-02): no size thresholds — the ONLY suppressible
        // flush is one whose dirty keys are ALL system/session metadata (those keys are
        // filtered to zero above by the NON_SYNCED_KEYS gate, so this is a safety net).
        // A business-entity delta (categories/stockItems/salesOrders/... ) is ALWAYS sent,
        // even a 0.2KB new-category probe.
        if (dirtySnapshot.length > 0 && !shouldFlush(dirtySnapshot)) {
          dirtySnapshot.forEach(k => {
            // Business/master keys are never cleared by a suppression skip — their dirty
            // banner must survive until a real server ack has delivered the edit.
            if (BUSINESS_ENTITY_KEYS.has(k) || MASTER_SYNC_KEYS.has(k)) return;
            flushDirtyKeysRef.current.delete(k);
            delete (dirtyValuesRef.current as any)[k];
            clearOptimisticWrite(k);
          });
          if (flushDirtyKeysRef.current.size === 0) flushDirtyRef.current = false;
          console.log(`[PHP API] Skipped session-metadata-only flush (${payloadBytes} bytes, ${dirtySnapshot.length} dirty key(s)) — no durable business data to persist`);
          break;
        }
        if (attempt === 1) console.log(`[PHP API] Flush attempt 1/${MAX_ATTEMPTS} — payload ${payloadBytes < 1048576 ? (payloadBytes / 1024).toFixed(1) + 'KB' : (payloadBytes / 1024 / 1024).toFixed(1) + 'MB'} (${dirtySnapshot.length} dirty keys)`);
        try {
          saveOk = await saveSystemDataToPhp(dataToSend, { changedKeys: dirtySnapshot, baseVersion: serverVer, timeoutMs: 30000 });
        } catch (flushErr) {
          console.warn(`[PHP API] Flush attempt ${attempt}/${MAX_ATTEMPTS} threw:`, flushErr);
        }
        if (saveOk) {
          lastServerTimestampRef.current = dataToSend.lastUpdated || null;
          noteStateTimestamp(dataToSend.lastUpdated);
          // CLIENT-VERSION LOCK (2026-09-07-03): capture response.serverVersion
          // synchronously from the api module state (updated inside saveSystemDataToPhp
          // during response parse) and lock it on every version ref BEFORE the
          // coalesced drain loop may run another pass. This ordering guarantee
          // ensures ANY queued delta always carries the fresh server version and
          // can never 409 on its own sibling flush.
          const newVer = getLastServerVersion();
          // CRITICAL: Wrap version write in guard — a flush writes the server's
          // new version to localStorage, which fires a storage event in THIS tab.
          // Without the guard, the storage handler sees isApplyingRemoteUpdateRef
          // === false and calls scheduleCrossTabRefetch, creating an infinite loop.
          isApplyingRemoteUpdateRef.current = true;
          try {
            if (newVer > 0) {
              lastServerVersionRef.current = newVer;
              noteServerVersion(newVer);
              lastFlushedVersionRef.current = newVer;
              // Persist clientVersion = response.serverVersion on in-memory state
              // so any concurrent/local reader immediately sees the locked version.
              if (dbStateRef.current) (dbStateRef.current as any)._version = newVer;
            }
          } finally {
            isApplyingRemoteUpdateRef.current = false;
          }
          // Clear flushed dirty keys AND their value snapshots
          const hadNewWrite = lastLocalWriteTimeRef.current > flushStartMs;
          if (!hadNewWrite) {
            dirtySnapshot.forEach(k => {
            flushDirtyKeysRef.current.delete(k);
            delete (dirtyValuesRef.current as any)[k];
            clearOptimisticWrite(k);
          });
          if (newVer > 0 && newVer > lastAckVersionRef.current) lastAckVersionRef.current = newVer;
            if (flushDirtyKeysRef.current.size === 0) flushDirtyRef.current = false;
            else flushDirtyRef.current = true;
          }
          // Clear pending queue on successful flush
          clearPendingQueue();
          // Notify other tabs
          notifyCrossTab(newVer);
        } else if (attempt < MAX_ATTEMPTS) {
          // 409 Conflict (or save failure): server is ahead. Rebase onto the fresh
          // server blob, then replay the client's recorded edits on top (local wins),
          // and retry against the server's new version.
          const conflict = consumeConflictData();
          if (conflict && conflict.serverData) {
            console.warn(`[PHP API] 409 Conflict detected — rebasing local edits onto server version ${conflict.serverVersion}`);
            const localPending = dirtyValuesRef.current as Record<string, any>;
            // 1. Start from the CLIENT'S full state — preserves all non-dirty
            //    collections (companies, branches, stores, settings, etc.) that the
            //    server's 409 response may not include if the client only sent dirty keys.
            const merged: any = { ...dbStateRef.current };
            // 2. Overlay the server's authoritative data for dirty keys (server wins on
            //    conflicts for keys the user didn't explicitly edit).
            for (const k of Object.keys(conflict.serverData)) {
              if (k === '_version' || k === '_serverUpdatedAt' || k === 'lastUpdated') continue;
              merged[k] = conflict.serverData[k];
            }
            // 3. Re-apply ONLY the collections the user actually edited (local wins).
            for (const k of Object.keys(localPending)) merged[k] = localPending[k];
            // 3. Persist the rebased state locally + in the UI (cache write marks it dirty nowhere).
            applyData(merged, true);
            localStorage.setItem('tradecore_data', JSON.stringify(merged));
            // CRITICAL: Wrap version write in guard — same loop risk as the flush path.
            isApplyingRemoteUpdateRef.current = true;
            try {
              if (Number(conflict.serverVersion) > 0) {
                lastServerVersionRef.current = Number(conflict.serverVersion);
                lastRealtimeVersionRef.current = Number(conflict.serverVersion);
                noteServerVersion(conflict.serverVersion);
                setLastServerVersion(conflict.serverVersion);
              }
            } finally {
              isApplyingRemoteUpdateRef.current = false;
            }
            // 4. If the server already contains every edit we had, do NOT retry —
            //    a no-op flush only inflates the version counter (2042 → 2048 churn)
            //    and keeps every tab in a 409 loop.
            if (Object.keys(localPending).length === 0) {
              flushDirtyRef.current = false;
              dirtySnapshot.forEach(k => flushDirtyKeysRef.current.delete(k));
              saveOk = true;
              break;
            }
          }
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
          console.warn(`[PHP API] Flush attempt ${attempt}/${MAX_ATTEMPTS} failed, retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
        }
      }
      if (!saveOk && flushDirtyRef.current) {
        console.warn(`[PHP API] Flush failed after ${MAX_ATTEMPTS} attempts — local cache is safe; background poll/next change will retry`);
      }
      // End of ONE coalesced pass. If a mid-flight dirty trigger set the pending batch
      // token, drain it immediately in the same isFlushing lock (freshly-locked
      // clientVersion is guaranteed). Capped to bound pathological edit storms.
      } while (flushQueuedRef.current && flushDirtyRef.current && queuedPasses < 3);
      // A token that raced in at the edge of the final pass is re-armed by finally
      // once the isFlushing lock is released.
    } catch (err) {
      // Flush errors MUST NOT force a redirect to login — the session + role snapshot
      // were preserved above, so the next boot (or the online re-fuel) recovers cleanly.
      console.warn('[PHP API] Flush error:', err);
      console.log('Flush error, session preserved');
      try {
        if (currentUser) {
          localStorage.setItem('tradecore_user', JSON.stringify(currentUser));
          persistRoleCache(currentUser);
        }
        const st = dbStateRef.current;
        if (st) { void cacheSystemState(st).catch(() => {}); }
      } catch (e) {}
    } finally {
      // SEQUENTIAL FLUSH QUEUE (2026-09-07-03): release the isFlushing lock FIRST so
      // the re-armed schedulePhpFlush below can actually arm a debounce timer (during
      // the lock, schedulePhpFlush only sets a coalesce token — which is correct while
      // in-flight but wrong for retries). Any pending work (failure retry OR edge-race
      // token) is re-queued through the scheduler with a fresh debounce; the next
      // flushToPhp invocation will always read the clientVersion that THIS pass locked
      // at Flush OK — the root cause of the double-flush 409 is eliminated.
      flushInFlightRef.current = false;
      if (flushDirtyRef.current || flushQueuedRef.current) {
        flushQueuedRef.current = false;
        schedulePhpFlush();
      }
      setPhpSyncing(false);
      // Notify settleFlushes waiters that this flush pass finished. If the pipeline
      // re-armed (still dirty), the next scheduled flush keeps the timer/in-flight
      // flags busy so settleFlushes continues polling until quiescence.
      const waiters = pendingFlushWaitersRef.current.splice(0);
      waiters.forEach(w => { try { w(); } catch {} });
    }
  };

  const restoreFactoryDefaults = async () => {
    setPhpSyncing(true);
    setPhpSyncMessage('Restoring factory defaults on PHP server...');
    const defaultState = {
      companies: defaultCompanies,
      branches: defaultBranches,
      stores: defaultStores,
      users: defaultUsers,
      categories: defaultCategories,
      taxes: defaultTaxes,
      suppliers: defaultSuppliers,
      customers: defaultCustomers,
      stockItems: defaultStockItems,
      purchaseOrders: defaultPurchaseOrders,
      salesOrders: defaultSalesOrders,
      expenses: defaultExpenses,
      auditTrails: defaultAuditTrails,
      settings: defaultSettings,
      rolePermissions: defaultRolePermissions,
      lastUpdated: new Date().toISOString()
    };

    localStorage.setItem('tradecore_data', JSON.stringify(defaultState));
    await saveSystemDataToPhp(defaultState);

    setCompanies(defaultCompanies);
    setBranches(defaultBranches);
    setStores(defaultStores);
    setUsers(defaultUsers);
    setCategories(defaultCategories);
    setTaxes(defaultTaxes);
    setSuppliers(defaultSuppliers);
    setCustomers(defaultCustomers);
    setStockItems(defaultStockItems);
    setPurchaseOrders(defaultPurchaseOrders);
    setSalesOrders(defaultSalesOrders);
    setExpenses(defaultExpenses);
    setAuditTrails(defaultAuditTrails);
    setSettings(defaultSettings);
    setRolePermissions(defaultRolePermissions);
    setPhpSyncing(false);
  };

  const handleExportDatabase = () => {
    try {
      const currentData = {
        companies,
        branches,
        stores,
        users,
        categories,
        taxes,
        suppliers,
        customers,
        stockItems,
        purchaseOrders,
        salesOrders,
        expenses,
        auditTrails,
        settings,
        rolePermissions
      };
      
      const jsonString = JSON.stringify(currentData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      downloadAnchor.download = `TradeCore_ERP_Database_Backup_${dateStr}.json`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      URL.revokeObjectURL(url);
      
      logAction('Database Backup', 'Exported complete database JSON file.');
      toast.success(t('Database Backup Downloaded Successfully! You can find it in your downloads folder.'));
    } catch (err) {
      toast.error(t('Failed to export database: ') + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleExportHTML = () => {
    try {
      const currentData = {
        companies,
        branches,
        stores,
        users,
        categories,
        taxes,
        suppliers,
        customers,
        stockItems,
        purchaseOrders,
        salesOrders,
        expenses,
        auditTrails,
        settings,
        rolePermissions,
        exportedAt: new Date().toISOString()
      };

      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Global Tradecore ERP - Interactive Offline Portal</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
    body {
      font-family: 'Inter', sans-serif;
    }
    .font-mono {
      font-family: 'JetBrains Mono', monospace;
    }
    @media print {
      header, aside, button, select, input {
        display: none !important;
      }
      main {
        padding: 0 !important;
      }
    }
  </style>
</head>
<body class="bg-slate-50 text-slate-800 flex flex-col min-h-screen">

  <!-- HEADER -->
  <header class="bg-slate-900 text-white border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-40 shadow-md">
    <div class="flex items-center gap-3">
      <div class="p-2 bg-blue-600 rounded-lg text-white">
        <i data-lucide="layout-dashboard" class="w-6 h-6"></i>
      </div>
      <div>
        <h1 class="text-lg font-bold tracking-tight">TradeCore ERP Portal</h1>
        <p class="text-xs text-slate-400 font-medium font-mono">Offline Database View & Interactive Reports</p>
      </div>
    </div>
    <div class="flex items-center gap-3">
      <div class="text-right hidden sm:block">
        <p class="text-xs text-slate-400 font-semibold">Active Company</p>
        <p class="text-sm font-bold text-blue-400" id="header-company-name">Global Tradecore</p>
      </div>
      <button onclick="window.print()" class="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 border border-slate-700 transition shadow-xs">
        <i data-lucide="printer" class="w-3.5 h-3.5"></i> Print Page
      </button>
    </div>
  </header>

  <div class="flex flex-1 flex-col md:flex-row">
    <!-- SIDEBAR NAVIGATION -->
    <aside class="w-full md:w-64 bg-slate-900 text-slate-300 border-r border-slate-800 flex flex-col justify-between">
      <nav class="p-4 space-y-1">
        <button onclick="switchTab('dashboard')" id="btn-dashboard" class="nav-btn w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition bg-blue-600 text-white">
          <i data-lucide="layout-dashboard" class="w-4 h-4"></i> Dashboard
        </button>
        <button onclick="switchTab('products')" id="btn-products" class="nav-btn w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition hover:bg-slate-800 hover:text-white">
          <i data-lucide="package" class="w-4 h-4"></i> Stock Items
        </button>
        <button onclick="switchTab('sales')" id="btn-sales" class="nav-btn w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition hover:bg-slate-800 hover:text-white">
          <i data-lucide="shopping-cart" class="w-4 h-4"></i> Sales Ledgers
        </button>
        <button onclick="switchTab('purchases')" id="btn-purchases" class="nav-btn w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition hover:bg-slate-800 hover:text-white">
          <i data-lucide="receipt" class="w-4 h-4"></i> Purchase Orders
        </button>
        <button onclick="switchTab('expenses')" id="btn-expenses" class="nav-btn w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition hover:bg-slate-800 hover:text-white">
          <i data-lucide="dollar-sign" class="w-4 h-4"></i> Expenses
        </button>
        <button onclick="switchTab('contacts')" id="btn-contacts" class="nav-btn w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition hover:bg-slate-800 hover:text-white">
          <i data-lucide="users" class="w-4 h-4"></i> Customers & Suppliers
        </button>
        <button onclick="switchTab('logs')" id="btn-logs" class="nav-btn w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition hover:bg-slate-800 hover:text-white">
          <i data-lucide="file-text" class="w-4 h-4"></i> Audit Trails
        </button>
      </nav>
      <div class="p-4 border-t border-slate-800 text-[10px] text-slate-500 font-semibold space-y-1 bg-slate-950">
        <p>Export Date: <span id="footer-export-date"></span></p>
        <p>License Status: ACTIVE (OFFLINE)</p>
      </div>
    </aside>

    <!-- MAIN CONTAINER -->
    <main class="flex-1 p-6 md:p-8 overflow-y-auto">
      
      <!-- ================= DASHBOARD TAB ================= -->
      <section id="tab-dashboard" class="tab-content space-y-6">
        <div class="border-b pb-4">
          <h2 class="text-xl font-bold text-slate-900 tracking-tight">Executive Dashboard</h2>
          <p class="text-xs text-slate-500 font-medium">Real-time summaries calculated from the active offline backup.</p>
        </div>

        <!-- KPI CARDS -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-white p-5 rounded-xl border shadow-xs flex items-center gap-4">
            <div class="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <i data-lucide="dollar-sign" class="w-6 h-6"></i>
            </div>
            <div>
              <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Revenue</p>
              <h3 class="text-lg font-bold text-slate-900 mt-0.5" id="kpi-sales-total">$0.00</h3>
            </div>
          </div>
          <div class="bg-white p-5 rounded-xl border shadow-xs flex items-center gap-4">
            <div class="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
              <i data-lucide="package" class="w-6 h-6"></i>
            </div>
            <div>
              <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Inventory Value</p>
              <h3 class="text-lg font-bold text-slate-900 mt-0.5" id="kpi-inventory-value">$0.00</h3>
            </div>
          </div>
          <div class="bg-white p-5 rounded-xl border shadow-xs flex items-center gap-4">
            <div class="p-3 bg-amber-50 text-amber-600 rounded-lg">
              <i data-lucide="receipt" class="w-6 h-6"></i>
            </div>
            <div>
              <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Stock SKU Count</p>
              <h3 class="text-lg font-bold text-slate-900 mt-0.5" id="kpi-sku-count">0 Items</h3>
            </div>
          </div>
          <div class="bg-white p-5 rounded-xl border shadow-xs flex items-center gap-4">
            <div class="p-3 bg-rose-50 text-rose-600 rounded-lg">
              <i data-lucide="trending-up" class="w-6 h-6"></i>
            </div>
            <div>
              <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Expenses</p>
              <h3 class="text-lg font-bold text-slate-900 mt-0.5" id="kpi-expenses-total">$0.00</h3>
            </div>
          </div>
        </div>

        <!-- RECENT ACTIVITY AND NOTIFICATIONS -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="lg:col-span-2 bg-white rounded-xl border shadow-xs p-5 space-y-4">
            <h3 class="text-sm font-bold text-slate-900 flex items-center gap-2">
              <i data-lucide="calendar" class="w-4 h-4 text-blue-600"></i> Recent Sales Orders
            </h3>
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs border-collapse">
                <thead>
                  <tr class="bg-slate-50 border-b">
                    <th class="p-2.5 font-bold text-slate-600">Order ID</th>
                    <th class="p-2.5 font-bold text-slate-600">Customer</th>
                    <th class="p-2.5 font-bold text-slate-600">Date</th>
                    <th class="p-2.5 font-bold text-slate-600 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody id="recent-sales-tbody">
                  <!-- JS Injection -->
                </tbody>
              </table>
            </div>
          </div>

          <div class="bg-white rounded-xl border shadow-xs p-5 space-y-4">
            <h3 class="text-sm font-bold text-slate-900 flex items-center gap-2">
              <i data-lucide="alert-triangle" class="w-4 h-4 text-amber-500"></i> Stock Level Warning
            </h3>
            <div class="space-y-2 max-h-[220px] overflow-y-auto" id="low-stock-list">
              <!-- JS Low stock item cards -->
            </div>
          </div>
        </div>
      </section>

      <!-- ================= PRODUCTS TAB ================= -->
      <section id="tab-products" class="tab-content hidden space-y-6">
        <div class="border-b pb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 class="text-xl font-bold text-slate-900 tracking-tight">Active Stock & Inventory</h2>
            <p class="text-xs text-slate-500 font-medium">Browse, search, and audit your stock counts and valuations.</p>
          </div>
          <div class="flex items-center gap-2 w-full sm:w-auto">
            <div class="relative flex-1 sm:w-64">
              <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <i data-lucide="search" class="w-4 h-4"></i>
              </span>
              <input type="text" id="search-products" onkeyup="filterProducts()" placeholder="Search Code, Name, Category..." class="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white shadow-xs focus:ring-1 focus:ring-blue-500 focus:outline-hidden font-medium">
            </div>
            <select id="filter-products-category" onchange="filterProducts()" class="py-1.5 px-3 border border-slate-200 rounded-lg text-xs bg-white shadow-xs focus:outline-hidden font-medium">
              <option value="">All Categories</option>
            </select>
          </div>
        </div>

        <div class="bg-white rounded-xl border shadow-xs overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="bg-slate-50 text-slate-600 font-bold border-b">
                  <th class="p-3">SKU Code</th>
                  <th class="p-3">Product Description</th>
                  <th class="p-3">Category</th>
                  <th class="p-3">Branch / Store</th>
                  <th class="p-3 text-right">In-Stock Qty</th>
                  <th class="p-3 text-right">Selling Price</th>
                  <th class="p-3 text-right">Total Value</th>
                  <th class="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody id="products-tbody" class="divide-y divide-slate-100 font-medium text-slate-700">
                <!-- JS Injection -->
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- ================= SALES TAB ================= -->
      <section id="tab-sales" class="tab-content hidden space-y-6">
        <div class="border-b pb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 class="text-xl font-bold text-slate-900 tracking-tight">Sales Orders & Receipts</h2>
            <p class="text-xs text-slate-500 font-medium">View completed checkout ledgers and generate printable receipts.</p>
          </div>
          <div class="relative w-full sm:w-72">
            <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
              <i data-lucide="search" class="w-4 h-4"></i>
            </span>
            <input type="text" id="search-sales" onkeyup="filterSales()" placeholder="Search Invoice #, Customer, Date..." class="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white shadow-xs focus:outline-hidden font-medium">
          </div>
        </div>

        <div class="bg-white rounded-xl border shadow-xs overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="bg-slate-50 text-slate-600 font-bold border-b">
                  <th class="p-3">Invoice Number</th>
                  <th class="p-3">Date &amp; Time</th>
                  <th class="p-3">Customer</th>
                  <th class="p-3">Branch Layout</th>
                  <th class="p-3">Operator</th>
                  <th class="p-3 text-right">Items Count</th>
                  <th class="p-3 text-right">Total Amount</th>
                  <th class="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody id="sales-tbody" class="divide-y divide-slate-100 font-medium text-slate-700">
                <!-- JS Injection -->
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- ================= PURCHASES TAB ================= -->
      <section id="tab-purchases" class="tab-content hidden space-y-6">
        <div class="border-b pb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 class="text-xl font-bold text-slate-900 tracking-tight">Purchase Orders (PO)</h2>
            <p class="text-xs text-slate-500 font-medium">Review vendor supplies, inventory acquisitions, and ledger items.</p>
          </div>
          <div class="relative w-full sm:w-72">
            <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
              <i data-lucide="search" class="w-4 h-4"></i>
            </span>
            <input type="text" id="search-purchases" onkeyup="filterPurchases()" placeholder="Search PO #, Supplier, Code..." class="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white shadow-xs focus:outline-hidden font-medium">
          </div>
        </div>

        <div class="bg-white rounded-xl border shadow-xs overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="bg-slate-50 text-slate-600 font-bold border-b">
                  <th class="p-3">PO Number</th>
                  <th class="p-3">Creation Date</th>
                  <th class="p-3">Supplier Name</th>
                  <th class="p-3">Branch Target</th>
                  <th class="p-3 text-right">Subtotal</th>
                  <th class="p-3 text-right">Tax Amount</th>
                  <th class="p-3 text-right">Grand Total</th>
                  <th class="p-3 text-center">Receipt Status</th>
                  <th class="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody id="purchases-tbody" class="divide-y divide-slate-100 font-medium text-slate-700">
                <!-- JS Injection -->
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- ================= EXPENSES TAB ================= -->
      <section id="tab-expenses" class="tab-content hidden space-y-6">
        <div class="border-b pb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 class="text-xl font-bold text-slate-900 tracking-tight">System Expenses</h2>
            <p class="text-xs text-slate-500 font-medium">Review operational overhead, utility expenditures, and rent files.</p>
          </div>
          <div class="relative w-full sm:w-72">
            <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
              <i data-lucide="search" class="w-4 h-4"></i>
            </span>
            <input type="text" id="search-expenses" onkeyup="filterExpenses()" placeholder="Search Reference, Category, Notes..." class="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white shadow-xs focus:outline-hidden font-medium">
          </div>
        </div>

        <div class="bg-white rounded-xl border shadow-xs overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="bg-slate-50 text-slate-600 font-bold border-b">
                  <th class="p-3">Expense Code</th>
                  <th class="p-3">Billing Date</th>
                  <th class="p-3">Category</th>
                  <th class="p-3">Notes &amp; Description</th>
                  <th class="p-3">Assigned Operator</th>
                  <th class="p-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody id="expenses-tbody" class="divide-y divide-slate-100 font-medium text-slate-700">
                <!-- JS Injection -->
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- ================= CONTACTS TAB ================= -->
      <section id="tab-contacts" class="tab-content hidden space-y-6">
        <div class="border-b pb-4">
          <h2 class="text-xl font-bold text-slate-900 tracking-tight">Suppliers &amp; Customers Directory</h2>
          <p class="text-xs text-slate-500 font-medium">Offline directory of all contact records, email handles, and geographical hubs.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- CUSTOMERS CARD -->
          <div class="bg-white rounded-xl border shadow-xs p-5 space-y-4">
            <h3 class="text-sm font-bold text-slate-900 flex items-center gap-1.5 border-b pb-2">
              <i data-lucide="users" class="w-4 h-4 text-blue-600"></i> Registered Customers
            </h3>
            <div class="overflow-y-auto max-h-[400px] space-y-2" id="customers-list">
              <!-- JS Customer List -->
            </div>
          </div>

          <!-- SUPPLIERS CARD -->
          <div class="bg-white rounded-xl border shadow-xs p-5 space-y-4">
            <h3 class="text-sm font-bold text-slate-900 flex items-center gap-1.5 border-b pb-2">
              <i data-lucide="truck" class="w-4 h-4 text-emerald-600"></i> Active Suppliers
            </h3>
            <div class="overflow-y-auto max-h-[400px] space-y-2" id="suppliers-list">
              <!-- JS Supplier List -->
            </div>
          </div>
        </div>
      </section>

      <!-- ================= AUDIT LOGS TAB ================= -->
      <section id="tab-logs" class="tab-content hidden space-y-6">
        <div class="border-b pb-4 flex items-center justify-between">
          <div>
            <h2 class="text-xl font-bold text-slate-900 tracking-tight">Operational Audit Trails</h2>
            <p class="text-xs text-slate-500 font-medium">Chronological registry of platform operations and data mutations.</p>
          </div>
          <span class="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold font-mono">SECURE CHRONO</span>
        </div>

        <div class="bg-slate-900 text-slate-300 rounded-xl p-4 font-mono text-xs overflow-x-auto max-h-[500px] overflow-y-auto space-y-2 border border-slate-800 shadow-lg" id="logs-container">
          <!-- JS Logs Injection -->
        </div>
      </section>

    </main>
  </div>

  <!-- DETAILS MODALS -->
  <div id="modal-backdrop" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 hidden">
    <div class="bg-white rounded-xl max-w-2xl w-full shadow-2xl border flex flex-col max-h-[90vh] overflow-hidden transform scale-95 transition-transform duration-200" id="modal-container">
      <div class="p-4 border-b flex justify-between items-center bg-slate-50">
        <h3 class="text-sm font-bold text-slate-900" id="modal-title">Receipt Details</h3>
        <button onclick="closeModal()" class="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>
      <div class="p-6 overflow-y-auto text-xs" id="modal-body">
        <!-- JS Injection -->
      </div>
      <div class="p-4 border-t bg-slate-50 flex justify-end gap-2">
        <button onclick="printModal()" class="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg flex items-center gap-1.5 transition">
          <i data-lucide="printer" class="w-3.5 h-3.5"></i> Print Receipt
        </button>
        <button onclick="closeModal()" class="py-1.5 px-3 border hover:bg-slate-100 text-slate-700 font-bold rounded-lg transition">
          Close
        </button>
      </div>
    </div>
  </div>

  <!-- EMBEDDED REAL SYSTEM DATA -->
  <script id="system-data" type="application/json">
    ${JSON.stringify(currentData)}
  </script>

  <!-- PORTAL OPERATIONS SCRIPT -->
  <script>
    // Load embedded system data safely
    const DATA = JSON.parse(document.getElementById('system-data').textContent);
    console.log('[Offline Portal] Loaded Data:', DATA);

    // Populate metadata
    document.getElementById('header-company-name').textContent = DATA.companies[0]?.name || 'Global Tradecore';
    document.getElementById('footer-export-date').textContent = new Date(DATA.exportedAt || Date.now()).toLocaleString();

    // Helper: format money with user's settings
    const currencySym = DATA.settings?.currency === 'TZS' ? 'TSh' : '$';
    function fmtMoney(usdVal) {
      if (DATA.settings?.currency === 'TZS') {
        const rate = DATA.settings?.exchangeRate || 2500;
        const val = Math.round(usdVal * rate);
        return val.toLocaleString() + ' ' + currencySym;
      }
      return currencySym + usdVal.toFixed(2);
    }

    // Tab switching engine
    function switchTab(tabId) {
      document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
      document.getElementById('tab-' + tabId).classList.remove('hidden');

      document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('hover:bg-slate-800', 'hover:text-white', 'text-slate-300');
      });
      const activeBtn = document.getElementById('btn-' + tabId);
      if (activeBtn) {
        activeBtn.classList.remove('hover:bg-slate-800', 'hover:text-white', 'text-slate-300');
        activeBtn.classList.add('bg-blue-600', 'text-white');
      }
      window.scrollTo(0, 0);
    }

    // 1. Render Dashboard Tab
    function renderDashboard() {
      // KPIs
      let totalSales = 0;
      DATA.salesOrders.filter(so => so.active !== false).forEach(so => totalSales += (so.grandTotal || 0));
      document.getElementById('kpi-sales-total').textContent = fmtMoney(totalSales);

      let totalInvVal = 0;
      DATA.stockItems.filter(p => p.active !== false).forEach(p => totalInvVal += ((p.qty || 0) * (p.costPrice || p.price || 0)));
      document.getElementById('kpi-inventory-value').textContent = fmtMoney(totalInvVal);

      const itemsCount = DATA.stockItems.filter(p => p.active !== false).length;
      document.getElementById('kpi-sku-count').textContent = itemsCount + ' SKU Items';

      let totalExp = 0;
      DATA.expenses.forEach(e => totalExp += (e.usdAmount || 0));
      document.getElementById('kpi-expenses-total').textContent = fmtMoney(totalExp);

      // Recent Sales list
      const recentSales = DATA.salesOrders.filter(so => so.active !== false).slice(0, 5);
      const recentTbody = document.getElementById('recent-sales-tbody');
      recentTbody.innerHTML = '';
      if (recentSales.length === 0) {
        recentTbody.innerHTML = '<tr><td colspan="4" class="p-3 text-slate-400 text-center font-medium">No sales recorded</td></tr>';
      } else {
        recentSales.forEach(so => {
          recentTbody.innerHTML += \`
            <tr class="border-b border-slate-100 hover:bg-slate-50/50">
              <td class="p-2.5 font-semibold text-blue-600 cursor-pointer" onclick="viewSalesDetail('\${so.soNumber}')">\${so.soNumber}</td>
              <td class="p-2.5 font-medium text-slate-700">\${so.customerName || 'Walk-in Customer'}</td>
              <td class="p-2.5 text-slate-400 font-medium">\${new Date(so.date).toLocaleDateString()}</td>
              <td class="p-2.5 text-right font-bold text-slate-900">\${fmtMoney(so.grandTotal)}</td>
            </tr>
          \`;
        });
      }

      // Low Stock warning list
      const lowStockItems = DATA.stockItems.filter(p => p.active !== false && (p.qty || 0) <= (p.minStock || 5));
      const lowStockList = document.getElementById('low-stock-list');
      lowStockList.innerHTML = '';
      if (lowStockItems.length === 0) {
        lowStockList.innerHTML = '<div class="p-3 text-emerald-600 bg-emerald-50 rounded-lg text-center font-bold text-xs">All inventory counts healthy</div>';
      } else {
        lowStockItems.slice(0, 10).forEach(p => {
          lowStockList.innerHTML += \`
            <div class="p-2.5 border rounded-lg bg-amber-50/30 flex items-center justify-between text-xs font-semibold">
              <div class="min-w-0 pr-2">
                <p class="text-slate-900 font-bold truncate">\${p.name}</p>
                <p class="text-slate-400 text-[10px]">\${p.code}</p>
              </div>
              <div class="text-right flex-shrink-0">
                <span class="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full font-bold text-[10px]">\${p.qty} left</span>
                <p class="text-[9px] text-slate-400 mt-0.5">Min level: \${p.minStock || 5}</p>
              </div>
            </div>
          \`;
        });
      }
    }

    // 2. Render Products Tab
    function renderProducts() {
      // Fill Category filter options
      const catFilter = document.getElementById('filter-products-category');
      catFilter.innerHTML = '<option value="">All Categories</option>';
      (DATA.categories || []).forEach(c => {
        catFilter.innerHTML += \`<option value="\${c}">\${c}</option>\`;
      });

      const tbody = document.getElementById('products-tbody');
      tbody.innerHTML = '';
      
      const filteredItems = DATA.stockItems.filter(p => p.active !== false);
      if (filteredItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="p-6 text-slate-400 text-center font-medium">No items registered</td></tr>';
        return;
      }

      filteredItems.forEach(p => {
        const isLow = (p.qty || 0) <= (p.minStock || 5);
        const val = (p.qty || 0) * (p.price || 0);
        tbody.innerHTML += \`
          <tr class="hover:bg-slate-50/50 product-row border-b" data-name="\${(p.name || '').toLowerCase()}" data-code="\${(p.code || '').toLowerCase()}" data-cat="\${(p.category || '').toLowerCase()}">
            <td class="p-3 font-mono font-bold text-slate-900">\${p.code}</td>
            <td class="p-3 font-bold text-slate-700">\${p.name}</td>
            <td class="p-3 text-slate-500 font-semibold">\${p.category || 'N/A'}</td>
            <td class="p-3 text-slate-400 font-medium">\${p.branch || 'Main Branch'}</td>
            <td class="p-3 text-right font-bold \${isLow ? 'text-rose-600 bg-rose-50/50' : 'text-slate-900'}">\${p.qty}</td>
            <td class="p-3 text-right text-slate-700 font-medium">\${fmtMoney(p.price || 0)}</td>
            <td class="p-3 text-right text-slate-900 font-bold">\${fmtMoney(val)}</td>
            <td class="p-3 text-center">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold \${isLow ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}">
                \${isLow ? 'Low stock' : 'Optimal'}
              </span>
            </td>
          </tr>
        \`;
      });
    }

    function filterProducts() {
      const q = document.getElementById('search-products').value.toLowerCase();
      const cat = document.getElementById('filter-products-category').value.toLowerCase();
      
      document.querySelectorAll('.product-row').forEach(row => {
        const rowName = row.getAttribute('data-name');
        const rowCode = row.getAttribute('data-code');
        const rowCat = row.getAttribute('data-cat');
        
        const matchesSearch = rowName.includes(q) || rowCode.includes(q);
        const matchesCategory = !cat || rowCat === cat;

        if (matchesSearch && matchesCategory) {
          row.classList.remove('hidden');
        } else {
          row.classList.add('hidden');
        }
      });
    }

    // 3. Render Sales Tab
    function renderSales() {
      const tbody = document.getElementById('sales-tbody');
      tbody.innerHTML = '';
      
      const sales = DATA.salesOrders.filter(so => so.active !== false);
      if (sales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="p-6 text-slate-400 text-center font-medium">No sales orders found</td></tr>';
        return;
      }

      sales.forEach(so => {
        tbody.innerHTML += \`
          <tr class="hover:bg-slate-50/50 sales-row border-b" data-invoice="\${so.soNumber.toLowerCase()}" data-cust="\${(so.customerName || 'walk-in').toLowerCase()}">
            <td class="p-3 font-mono font-bold text-blue-600 cursor-pointer" onclick="viewSalesDetail('\${so.soNumber}')">\${so.soNumber}</td>
            <td class="p-3 text-slate-500 font-medium">\${new Date(so.date).toLocaleString()}</td>
            <td class="p-3 font-bold text-slate-700">\${so.customerName || 'Walk-in Customer'}</td>
            <td class="p-3 text-slate-400 font-medium">\${so.branch || 'Main Branch'}</td>
            <td class="p-3 text-slate-500 font-semibold">\${so.operator || 'Root User'}</td>
            <td class="p-3 text-right font-medium text-slate-600">\${so.items?.length || 0} items</td>
            <td class="p-3 text-right font-bold text-slate-900">\${fmtMoney(so.grandTotal)}</td>
            <td class="p-3 text-center">
              <button onclick="viewSalesDetail('\${so.soNumber}')" class="py-1 px-2.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg hover:bg-blue-100 text-[10px] font-bold transition">
                View Receipt
              </button>
            </td>
          </tr>
        \`;
      });
    }

    function filterSales() {
      const q = document.getElementById('search-sales').value.toLowerCase();
      document.querySelectorAll('.sales-row').forEach(row => {
        const inv = row.getAttribute('data-invoice');
        const cust = row.getAttribute('data-cust');
        if (inv.includes(q) || cust.includes(q)) {
          row.classList.remove('hidden');
        } else {
          row.classList.add('hidden');
        }
      });
    }

    // 4. Render Purchases Tab
    function renderPurchases() {
      const tbody = document.getElementById('purchases-tbody');
      tbody.innerHTML = '';
      
      const purchases = DATA.purchaseOrders.filter(po => po.active !== false);
      if (purchases.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="p-6 text-slate-400 text-center font-medium">No purchase records found</td></tr>';
        return;
      }

      purchases.forEach(po => {
        const isRec = po.status === 'Received';
        tbody.innerHTML += \`
          <tr class="hover:bg-slate-50/50 purchase-row border-b" data-po="\${po.poNumber.toLowerCase()}" data-supplier="\${(po.supplierName || '').toLowerCase()}">
            <td class="p-3 font-mono font-bold text-emerald-600 cursor-pointer" onclick="viewPurchaseDetail('\${po.poNumber}')">\${po.poNumber}</td>
            <td class="p-3 text-slate-500 font-medium">\${new Date(po.date).toLocaleDateString()}</td>
            <td class="p-3 font-bold text-slate-700">\${po.supplierName || 'General Supplier'}</td>
            <td class="p-3 text-slate-400 font-medium">\${po.branch || 'Main Branch'}</td>
            <td class="p-3 text-right text-slate-600 font-medium">\${fmtMoney(po.subtotal)}</td>
            <td class="p-3 text-right text-slate-600 font-medium">\${fmtMoney(po.taxTotal || 0)}</td>
            <td class="p-3 text-right font-bold text-slate-900">\${fmtMoney(po.grandTotal)}</td>
            <td class="p-3 text-center">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold \text-[10px] \${isRec ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}">
                \${po.status}
              </span>
            </td>
            <td class="p-3 text-center">
              <button onclick="viewPurchaseDetail('\${po.poNumber}')" class="py-1 px-2.5 bg-slate-50 text-slate-600 border rounded-lg hover:bg-slate-100 text-[10px] font-bold transition">
                View Ledger
              </button>
            </td>
          </tr>
        \`;
      });
    }

    function filterPurchases() {
      const q = document.getElementById('search-purchases').value.toLowerCase();
      document.querySelectorAll('.purchase-row').forEach(row => {
        const po = row.getAttribute('data-po');
        const supplier = row.getAttribute('data-supplier');
        if (po.includes(q) || supplier.includes(q)) {
          row.classList.remove('hidden');
        } else {
          row.classList.add('hidden');
        }
      });
    }

    // 5. Render Expenses Tab
    function renderExpenses() {
      const tbody = document.getElementById('expenses-tbody');
      tbody.innerHTML = '';
      
      const expenses = DATA.expenses || [];
      if (expenses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-slate-400 text-center font-medium">No expenses registered</td></tr>';
        return;
      }

      expenses.forEach(e => {
        tbody.innerHTML += \`
          <tr class="hover:bg-slate-50/50 expense-row border-b" data-desc="\${(e.description || '').toLowerCase()}" data-cat="\${(e.category || '').toLowerCase()}" data-code="\${(e.expenseNumber || '').toLowerCase()}">
            <td class="p-3 font-mono font-bold text-rose-600">\${e.expenseNumber}</td>
            <td class="p-3 text-slate-500 font-medium">\${new Date(e.date).toLocaleDateString()}</td>
            <td class="p-3 text-slate-800 font-bold">\${e.category}</td>
            <td class="p-3 text-slate-500 font-medium max-w-xs truncate">\${e.description}</td>
            <td class="p-3 text-slate-400 font-medium">\${e.operator || 'System User'}</td>
            <td class="p-3 text-right font-bold text-rose-600">\${fmtMoney(e.usdAmount)}</td>
          </tr>
        \`;
      });
    }

    function filterExpenses() {
      const q = document.getElementById('search-expenses').value.toLowerCase();
      document.querySelectorAll('.expense-row').forEach(row => {
        const desc = row.getAttribute('data-desc');
        const cat = row.getAttribute('data-cat');
        const code = row.getAttribute('data-code');
        if (desc.includes(q) || cat.includes(q) || code.includes(q)) {
          row.classList.remove('hidden');
        } else {
          row.classList.add('hidden');
        }
      });
    }

    // 6. Render Contacts Tab
    function renderContacts() {
      const custDiv = document.getElementById('customers-list');
      custDiv.innerHTML = '';
      const customers = DATA.customers || [];
      if (customers.length === 0) {
        custDiv.innerHTML = '<p class="text-center text-slate-400 py-4 font-semibold">No customer records</p>';
      } else {
        customers.forEach(c => {
          custDiv.innerHTML += \`
            <div class="p-3 border rounded-lg bg-slate-50/50 flex items-start gap-3">
              <div class="p-2 bg-blue-100 text-blue-700 rounded-full flex-shrink-0">
                <i data-lucide="user" class="w-4 h-4"></i>
              </div>
              <div class="min-w-0">
                <p class="font-bold text-slate-800 text-xs">\${c.name}</p>
                <p class="text-[10px] text-slate-400 font-medium mt-0.5">Phone: \${c.phone || 'N/A'} | Code: \${c.id}</p>
                <p class="text-[10px] text-slate-400 font-medium">Location: \${c.address || 'N/A'}</p>
              </div>
            </div>
          \`;
        });
      }

      const suppDiv = document.getElementById('suppliers-list');
      suppDiv.innerHTML = '';
      const suppliers = DATA.suppliers || [];
      if (suppliers.length === 0) {
        suppDiv.innerHTML = '<p class="text-center text-slate-400 py-4 font-semibold">No suppliers registered</p>';
      } else {
        suppliers.forEach(s => {
          suppDiv.innerHTML += \`
            <div class="p-3 border rounded-lg bg-emerald-50/20 flex items-start gap-3">
              <div class="p-2 bg-emerald-100 text-emerald-700 rounded-full flex-shrink-0">
                <i data-lucide="truck" class="w-4 h-4"></i>
              </div>
              <div class="min-w-0">
                <p class="font-bold text-slate-800 text-xs">\${s.name}</p>
                <p class="text-[10px] text-slate-400 font-medium mt-0.5">Phone: \${s.phone || 'N/A'} | Contact: \${s.contactPerson || 'N/A'}</p>
                <p class="text-[10px] text-slate-400 font-medium">Hub: \${s.address || 'N/A'}</p>
              </div>
            </div>
          \`;
        });
      }
    }

    // 7. Render Logs Tab
    function renderLogs() {
      const logsContainer = document.getElementById('logs-container');
      logsContainer.innerHTML = '';
      const logs = DATA.auditTrails || [];
      if (logs.length === 0) {
        logsContainer.innerHTML = '<p class="text-slate-500 font-bold">No event logs recorded in system database.</p>';
      } else {
        logs.forEach(log => {
          logsContainer.innerHTML += \`
            <div class="py-1.5 border-b border-slate-800/80 last:border-0 leading-relaxed">
              <span class="text-slate-500">[\${new Date(log.timestamp).toLocaleString()}]</span> 
              <span class="text-amber-400 font-bold">\${log.operator || 'SYSTEM'}:</span> 
              <span class="text-slate-100 font-semibold">\${log.action}</span> - 
              <span class="text-slate-400">\${log.details}</span>
            </div>
          \`;
        });
      }
    }

    // Modal Manager
    function showModal(title, bodyHtml) {
      document.getElementById('modal-title').textContent = title;
      document.getElementById('modal-body').innerHTML = bodyHtml;
      document.getElementById('modal-backdrop').classList.remove('hidden');
      setTimeout(() => {
        document.getElementById('modal-container').classList.remove('scale-95');
      }, 10);
      lucide.createIcons();
    }

    function closeModal() {
      document.getElementById('modal-container').classList.add('scale-95');
      setTimeout(() => {
        document.getElementById('modal-backdrop').classList.add('hidden');
      }, 150);
    }

    function printModal() {
      const printWindow = window.open('', '_blank');
      printWindow.document.write(\`
        <html>
        <head>
          <title>Print Document</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 40px; font-size: 14px; color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border-bottom: 1px solid #eee; padding: 10px; text-align: left; }
            th { background-color: #f9f9f9; font-weight: bold; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .invoice-header { text-align: center; margin-bottom: 30px; }
          </style>
        </head>
        <body>
          \${document.getElementById('modal-body').innerHTML}
        </body>
        </html>
      \`);
      printWindow.document.close();
      printWindow.print();
    }

    function viewSalesDetail(invoiceNum) {
      const so = DATA.salesOrders.find(o => o.soNumber === invoiceNum);
      if (!so) return;

      let itemsHtml = '';
      so.items.forEach(item => {
        itemsHtml += \`
          <tr>
            <td class="py-2 text-slate-800 font-medium">\${item.code} - \${item.name}</td>
            <td class="py-2 text-right font-semibold text-slate-700">\${item.qty}</td>
            <td class="py-2 text-right text-slate-600">\${fmtMoney(item.price)}</td>
            <td class="py-2 text-right font-bold text-slate-900">\${fmtMoney(item.qty * item.price)}</td>
          </tr>
        \`;
      });

      const bodyHtml = \`
        <div class="text-center border-b pb-4 mb-4">
          <h2 class="text-lg font-bold text-slate-900">\${DATA.companies[0]?.name || 'Global Tradecore'}</h2>
          <p class="text-slate-400 font-medium text-xs mt-0.5">Sales Invoice / Checkout Ledger</p>
        </div>
        <div class="grid grid-cols-2 gap-4 border-b pb-4 mb-4 font-semibold text-slate-600">
          <div>
            <p>Invoice #: <span class="font-bold text-slate-900">\${so.soNumber}</span></p>
            <p>Customer: <span class="font-bold text-slate-900">\${so.customerName || 'Walk-in Customer'}</span></p>
            <p>Branch Layout: <span class="font-bold text-slate-900">\${so.branch || 'Main Branch'}</span></p>
          </div>
          <div class="text-right">
            <p>Date: <span class="font-bold text-slate-900">\${new Date(so.date).toLocaleString()}</span></p>
            <p>Cashier ID: <span class="font-bold text-slate-900">\${so.operator || 'Root User'}</span></p>
            <p>Status: <span class="px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-bold">COMPLETED</span></p>
          </div>
        </div>
        <table class="w-full text-left border-collapse my-4">
          <thead>
            <tr class="bg-slate-50 border-b">
              <th class="py-2 px-1 text-slate-600 font-bold">Product SKU</th>
              <th class="py-2 text-right text-slate-600 font-bold">Qty</th>
              <th class="py-2 text-right text-slate-600 font-bold">Selling Price</th>
              <th class="py-2 text-right text-slate-600 font-bold">Total</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            \${itemsHtml}
          </tbody>
        </table>
        <div class="w-1/2 ml-auto text-right font-semibold text-slate-700 mt-6 space-y-1">
          <div class="flex justify-between">
            <span>Subtotal</span>
            <span>\${fmtMoney(so.subtotal)}</span>
          </div>
          <div class="flex justify-between">
            <span>Tax Amount</span>
            <span>\${fmtMoney(so.taxTotal || 0)}</span>
          </div>
          <div class="flex justify-between text-base font-bold text-slate-900 border-t pt-2 mt-2">
            <span>Grand Total</span>
            <span>\${fmtMoney(so.grandTotal)}</span>
          </div>
        </div>
      \`;

      showModal('Sales Invoice Details', bodyHtml);
    }

    function viewPurchaseDetail(poNum) {
      const po = DATA.purchaseOrders.find(p => p.poNumber === poNum);
      if (!po) return;

      let itemsHtml = '';
      po.items.forEach(item => {
        itemsHtml += \`
          <tr>
            <td class="py-2 text-slate-800 font-medium">\${item.code} - \${item.name}</td>
            <td class="py-2 text-right font-semibold text-slate-700">\${item.qty}</td>
            <td class="py-2 text-right text-slate-600">\${fmtMoney(item.costPrice || item.price)}</td>
            <td class="py-2 text-right font-bold text-slate-900">\${fmtMoney(item.qty * (item.costPrice || item.price))}</td>
          </tr>
        \`;
      });

      const bodyHtml = \`
        <div class="text-center border-b pb-4 mb-4">
          <h2 class="text-lg font-bold text-slate-900">\${DATA.companies[0]?.name || 'Global Tradecore'}</h2>
          <p class="text-slate-400 font-medium text-xs mt-0.5">Purchase Order Ledger</p>
        </div>
        <div class="grid grid-cols-2 gap-4 border-b pb-4 mb-4 font-semibold text-slate-600">
          <div>
            <p>PO Number: <span class="font-bold text-slate-900">\${po.poNumber}</span></p>
            <p>Supplier Name: <span class="font-bold text-slate-900">\${po.supplierName || 'General Vendor'}</span></p>
            <p>Target Location: <span class="font-bold text-slate-900">\${po.branch || 'Main Branch'}</span></p>
          </div>
          <div class="text-right">
            <p>Date: <span class="font-bold text-slate-900">\${new Date(po.date).toLocaleDateString()}</span></p>
            <p>Status: <span class="px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-bold">\${po.status}</span></p>
          </div>
        </div>
        <table class="w-full text-left border-collapse my-4">
          <thead>
            <tr class="bg-slate-50 border-b">
              <th class="py-2 px-1 text-slate-600 font-bold">Acquired SKU</th>
              <th class="py-2 text-right text-slate-600 font-bold">Ordered Qty</th>
              <th class="py-2 text-right text-slate-600 font-bold">Purchase Unit Cost</th>
              <th class="py-2 text-right text-slate-600 font-bold">Total Cost</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            \${itemsHtml}
          </tbody>
        </table>
        <div class="w-1/2 ml-auto text-right font-semibold text-slate-700 mt-6 space-y-1">
          <div class="flex justify-between">
            <span>Subtotal Cost</span>
            <span>\${fmtMoney(po.subtotal)}</span>
          </div>
          <div class="flex justify-between">
            <span>Tax Cost</span>
            <span>\${fmtMoney(po.taxTotal || 0)}</span>
          </div>
          <div class="flex justify-between text-base font-bold text-slate-900 border-t pt-2 mt-2">
            <span>Grand Total Cost</span>
            <span>\${fmtMoney(po.grandTotal)}</span>
          </div>
        </div>
      \`;

      showModal('Purchase Order Details', bodyHtml);
    }

    // Initialize Page
    renderDashboard();
    renderProducts();
    renderSales();
    renderPurchases();
    renderExpenses();
    renderContacts();
    renderLogs();
    lucide.createIcons();
  </script>

</body>
</html>`;

      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      downloadAnchor.download = `TradeCore_ERP_Offline_Portal_${dateStr}.html`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      URL.revokeObjectURL(url);

      logAction('Export Offline HTML', 'Downloaded self-contained, interactive HTML web app client.');
      toast.success(t('Interactive HTML File Downloaded Successfully! You can open this file on any device offline to view your reports and logs.'));
    } catch (err) {
      toast.error(t('Failed to generate HTML file: ') + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleImportDatabase = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        
        if (!json.stockItems || !json.salesOrders || !json.purchaseOrders || !json.users) {
          toast.error(t('Invalid backup file structure. Please ensure you are uploading a valid TradeCore ERP database backup.'));
          return;
        }

        saveAllData({
          companies: json.companies || companies,
          branches: json.branches || branches,
          stores: json.stores || stores,
          users: json.users || users,
          categories: json.categories || categories,
          taxes: json.taxes || taxes,
          suppliers: json.suppliers || suppliers,
          customers: json.customers || customers,
          stockItems: json.stockItems || stockItems,
          purchaseOrders: json.purchaseOrders || purchaseOrders,
          salesOrders: json.salesOrders || salesOrders,
          expenses: json.expenses || expenses,
          settings: json.settings || settings,
          rolePermissions: json.rolePermissions || rolePermissions
        });

        toast.success(t('Database backup restored successfully! Reloading application states...'));
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } catch (err) {
        toast.error(t('Failed to parse database file: ') + (err instanceof Error ? err.message : String(err)));
      }
    };
    reader.readAsText(file);
  };

  // --- SCOPE CONTEXT INITIALIZATION ---
  useEffect(() => {
    if (!currentUser) return;

    // Cross reference user blocks and rules
    const liveUser = users.find(u => u.id === currentUser.id);
    if (liveUser) {
      // We can see the authenticated user in the in-memory list — treat the user
      // list as synced so legitimate list-based decisions are made immediately.
      usersSyncedRef.current = true;
      // Core super admins are immune to block/termination
      const isCoreSuperAdmin = currentUser.username === 'root_mandate' || currentUser.username === 'superadmin';
      if (!isCoreSuperAdmin && (liveUser.status === 'Blocked' || liveUser.remoteTerminated)) {
        localStorage.removeItem('tradecore_user');
        localStorage.removeItem('tradecore_data');
        localStorage.removeItem('tradecore_weekly_auto_backup_json');
        setCurrentUser(null);
        handleLogout();
        toast.error(t('Your active session was terminated remotely by Administrator. Local storage revoked.'));
        return;
      }
      
      // Live sync properties (like allowedPages) to currently active session
      const isCoreAdmin = (isCoreSuperAdmin || currentUser.role === 'Super Admin');
      let liveAllowedPages = liveUser.allowedPages;
      if (isCoreAdmin && !Array.isArray(liveAllowedPages)) {
        // Requirement 2: a truncated/null allowedPages from a background sync must
        // NEVER erase an admin's full-access permission set. Restore the static
        // full registry so the UI/permission keys survive large superadmin payloads.
        liveAllowedPages = Array.from(ADMIN_FULL_ACCESS_PAGES);
      }
      if (
        (isCoreAdmin ? JSON.stringify(liveAllowedPages) : JSON.stringify(liveUser.allowedPages)) !== JSON.stringify(currentUser.allowedPages) ||
        liveUser.name !== currentUser.name ||
        (currentUser.role !== 'Super Admin' ? liveUser.role !== currentUser.role : false) ||
        liveUser.companyId !== currentUser.companyId ||
        liveUser.branchId !== currentUser.branchId ||
        liveUser.storeId !== currentUser.storeId
      ) {
        const nextUser =
          isCoreAdmin
            ? { ...currentUser, ...liveUser, allowedPages: liveAllowedPages }
            : { ...currentUser, ...liveUser };
        localStorage.setItem('tradecore_user', JSON.stringify(nextUser));
        setCurrentUser(nextUser);
      }
    } else {
      // User NOT found in the current in-memory user list.
      //
      // CRITICAL: Super Admin / root accounts and ROOT "View as Company"
      // impersonation MUST NEVER be logged out from here. These accounts are
      // not bound to a single company; when the admin switches companies (or an
      // active snapshot re-applies a per-company users array that does not list
      // the admin), their row is legitimately ABSENT from the in-memory `users`
      // list even though they are healthy on the server. Logging out here is
      // exactly the "I select a company and it kicks me out" bug reported by
      // Super Admins (and the 'root_mandate'/impersonation equivalent).
      const nowRole = (currentUser as any)?.role;
      const nowUsername = String((currentUser as any)?.username ?? '').toLowerCase();
      const isSuperScope = nowRole === 'Super Admin' || nowRole === 'root_mandate' || nowRole === 'superadmin'
        || nowUsername === 'root_mandate' || nowUsername === 'superadmin';
      const isImpersonating = !!localStorage.getItem('tradecore_root_backup');
      if (isSuperScope || isImpersonating) {
        usersSyncedRef.current = true;
        console.log('[Scope] Super Admin / root / impersonation active — user not in per-company list, skipping termination check (safe company switch)');
        return;
      }
      // Regular users: Do NOT treat as deleted/terminated while (a) the server
      // user list has not loaded yet (usersSyncedRef false), (b) the list is
      // still empty, or (c) we are within the post-login grace window.
      if (!usersSyncedRef.current || (users || []).length === 0 || Date.now() < sessionGraceUntilRef.current) {
        return;
      }
      // User was deleted/terminated from the database by Admin/Super Admin
      localStorage.removeItem('tradecore_user');
      localStorage.removeItem('tradecore_data');
      setCurrentUser(null);
      handleLogout();
      toast.error(t('Your account has been terminated by system administration. Local storage revoked.'));
      return;
    }

    if (currentUser.role === 'Super Admin') {
      const activeCompanies = companies.filter(c => !c.isDeleted);
      const activeBranches = branches.filter(b => !b.isDeleted);
      const activeStores = stores.filter(s => !s.isDeleted);

      let parentCo = currentCompanyId;
      if (!parentCo || !activeCompanies.some(c => c.id === parentCo)) {
        // BOOT-SAFE DEFAULT: never fall back to the FIRST company in the list — that
        // force-switched a Super Admin browsing company 2 back to company 1 on every load
        // ("Company switched 2 -> 1 forcing resync" shake). Prefer the PERSISTED COMMITTED
        // company (boot resolution + explicit switches keep it authoritative and it can
        // never be corrupted by a snapshot's users-array re-syncing the live companyId),
        // then the session user's company as a fallback while nothing was persisted yet.
        const userCoRaw = (currentUser as any)?.company_id ?? (currentUser as any)?.companyId;
        const userCo = userCoRaw != null ? Number(userCoRaw) : null;
        const savedRaw = Number(localStorage.getItem('active_company_id') || localStorage.getItem('company_id') || '0');
        const preferred = (savedRaw > 0 ? savedRaw : null)
          ?? (userCo != null && !Number.isNaN(userCo) ? userCo : null);
        parentCo = (preferred != null && activeCompanies.some(c => c.id === preferred))
          ? preferred
          : (activeCompanies[0]?.id || null);
      }

      let activeBrId = currentBranchId;
      if (!activeBrId || !activeBranches.some(b => b.id === activeBrId && b.companyId === parentCo)) {
        const firstActiveBranch = activeBranches.find(b => b.companyId === parentCo);
        activeBrId = firstActiveBranch ? firstActiveBranch.id : null;
      }

      let activeStId = currentStoreId;
      if (!activeStId || !activeStores.some(s => s.id === activeStId && s.branchId === activeBrId)) {
        const firstActiveStore = activeStores.find(s => s.branchId === activeBrId);
        activeStId = firstActiveStore ? firstActiveStore.id : null;
      }
      
      if (currentCompanyId !== parentCo) setCurrentCompanyId(parentCo);
      if (currentBranchId !== activeBrId) setCurrentBranchId(activeBrId);
      if (currentStoreId !== activeStId) setCurrentStoreId(activeStId);
    } else if (currentUser.role === 'Admin') {
      const activeBranches = branches.filter(b => !b.isDeleted);
      const activeStores = stores.filter(s => !s.isDeleted);

      const parentCo = currentUser.companyId || null;

      let activeBrId = currentBranchId;
      if (!activeBrId || !activeBranches.some(b => b.id === activeBrId && b.companyId === parentCo)) {
        const firstActiveBranch = activeBranches.find(b => b.companyId === parentCo);
        activeBrId = firstActiveBranch ? firstActiveBranch.id : null;
      }

      let activeStId = currentStoreId;
      if (!activeStId || !activeStores.some(s => s.id === activeStId && s.branchId === activeBrId)) {
        const firstActiveStore = activeStores.find(s => s.branchId === activeBrId);
        activeStId = firstActiveStore ? firstActiveStore.id : null;
      }

      if (currentCompanyId !== parentCo) setCurrentCompanyId(parentCo);
      if (currentBranchId !== activeBrId) setCurrentBranchId(activeBrId);
      if (currentStoreId !== activeStId) setCurrentStoreId(activeStId);
    } else {
      if (currentCompanyId !== currentUser.companyId) setCurrentCompanyId(currentUser.companyId);
      if (currentBranchId !== currentUser.branchId) setCurrentBranchId(currentUser.branchId);
      if (currentStoreId !== currentUser.storeId) setCurrentStoreId(currentUser.storeId);
    }
  }, [currentUser, companies, branches, stores, currentCompanyId, currentBranchId, currentStoreId, users]);

  // Sync state-managed theme color to document element root style properties smoothly
  useEffect(() => {
    const activeCompany = companies.find(c => c.id === currentCompanyId);
    const activeColor = currentUser && activeCompany ? (activeCompany.themeColor || '#c41e3a') : '#c41e3a';
    
    const root = document.documentElement;
    root.style.setProperty('--brand-color', activeColor);
    root.style.setProperty('--brand-color-hover', adjustColorBrightness(activeColor, -15));
    root.style.setProperty('--brand-color-light', activeColor + '26');
  }, [currentUser, currentCompanyId, companies]);

  // --- 5-MINUTE INACTIVITY AUTO-LOCK / AUTO-LOGOUT FOR SHARED HARDWARE SECURITY ---
  const lastActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!currentUser) return;

    const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes inactivity timeout

    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };

    // Global listener for hardware interaction
    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    activityEvents.forEach(evt => window.addEventListener(evt, updateActivity, { passive: true }));

    // Periodic activity check every 5 seconds
    const intervalId = setInterval(() => {
      if (Date.now() - lastActivityRef.current >= INACTIVITY_TIMEOUT_MS) {
        logAction('Auto Security Lock', 'User session locked automatically due to 5 minutes of inactivity on shared POS hardware.');
        localStorage.removeItem('tradecore_user');
        setCurrentUser(null);
        setCurrentPage('dashboard');
        toast.warning(t('Auto-Locked: Session closed due to 5 minutes of inactivity to protect commerce ledger data.'));
      }
    }, 5000);

    return () => {
      activityEvents.forEach(evt => window.removeEventListener(evt, updateActivity));
      clearInterval(intervalId);
    };
  }, [currentUser]);

  // Restrict accessible stores based on soft-deletion, active company selection, and user assignment permissions
  const visibleCompanies = useMemo(() => {
    let result = companies.filter(c => !c.isDeleted);
    if (currentUser && currentUser.role !== 'Super Admin') {
      result = result.filter(c => c.id === currentUser.companyId);
    } else if (currentCompanyId) {
      result = result.filter(c => c.id === currentCompanyId);
    }
    return result;
  }, [companies, currentCompanyId, currentUser]);

  const visibleStores = useMemo(() => {
    let result = stores.filter(s => !s.isDeleted);
    
    if (currentCompanyId) {
      const activeCompanyBranchIds = branches
        .filter(b => b.companyId === currentCompanyId && !b.isDeleted)
        .map(b => b.id);
      result = result.filter(s => activeCompanyBranchIds.includes(s.branchId));
    }
    
    if (currentUser && currentUser.role !== 'Super Admin') {
      const userCompanyBranchIds = branches
        .filter(b => b.companyId === currentUser.companyId && !b.isDeleted)
        .map(b => b.id);
      result = result.filter(s => userCompanyBranchIds.includes(s.branchId));

      // Role-hierarchy store scope:
      //  - top admins (Admin/Administrator/Company Administrator) → whole allocated COMPANY
      //    (any branch, any store); Store=None is allowed and means full company access.
      //  - Branch/Store administrators → single store when storeId is SET, otherwise
      //    Store=None = ALL stores in their ASSIGNED BRANCH only.
      //  - plain staff → locked to their assigned store.
      const roleLower = String(currentUser.role || '').toLowerCase();
      const isTopAdmin = ['admin', 'administrator', 'company administrator'].includes(roleLower);
      const isBranchScoped = ['branch administrator', 'branch manager', 'branch admin', 'store administrator', 'store admin', 'store manager'].includes(roleLower);
      if (currentUser.storeId) {
        if (!isTopAdmin) result = result.filter(s => s.id === currentUser.storeId);
      } else if (isBranchScoped && currentUser.branchId) {
        result = result.filter(s => s.branchId === currentUser.branchId);
      }
    }
    
    return result;
  }, [stores, branches, currentCompanyId, currentUser]);

  // --- RECHARTS STABLE PROPS (prevent Error #185 cascading notifyNestedSubs) ---
  const rechartsMargin = useMemo(() => ({ top: 10, right: 10, left: -10, bottom: 0 }), []);
  const rechartsTick = useMemo(() => ({ fill: '#94a3b8' }), []);
  const rechartsTooltipStyle = useMemo(() => ({ background: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff' }), []);
  const rechartsColors = useMemo(() => ['#c41e3a', '#1e3a8a', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'], []);
  const formatChartMoney = useCallback((value: number) => formatMoney(value, activeCurrency, activeExchangeRate), [activeCurrency, activeExchangeRate]);

  const dailySalesData = useMemo(() => {
    const storeId = currentStoreId;
    const last15Days = Array.from({ length: 15 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();
    return last15Days.map(date => {
      const sales = activeSalesOrders
        .filter(so => so.date === date && (storeId ? so.storeId === storeId : true))
        .reduce((sum, so) => sum + so.total, 0);
      const profit = activeSalesOrders
        .filter(so => so.date === date && (storeId ? so.storeId === storeId : true))
        .reduce((sum, so) => sum + so.profit, 0);
      return { date: date.substring(5), Sales: sales, Profit: profit };
    });
  }, [activeSalesOrders, currentStoreId]);

  const topProductsStockValue = useMemo(() => {
    const storeId = currentStoreId;
    const activeStoreIds = storeId ? [storeId] : visibleStores.map(s => s.id);
    const storeStock = (p: StockItem) => {
      if (storeId) return p.stock?.[storeId] || 0;
      return activeStoreIds.reduce((sum, sId) => sum + (p.stock?.[sId] || 0), 0);
    };
    const getItemValuation = (p: StockItem) => {
      const rawQty = storeStock(p);
      const mainQty = p.useSubUnitPricing ? rawQty / (p.subUnitConversion || 1) : rawQty;
      return mainQty * p.purchasePrice;
    };
    return [...activeStockItems]
      .map(p => ({
        name: p.name.length > 15 ? p.name.slice(0, 15) + '...' : p.name,
        value: getItemValuation(p)
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [activeStockItems, currentStoreId, visibleStores]);

  const expenseCategoryData = useMemo(() => {
    const storeId = currentStoreId;
    const totals: Record<string, number> = {};
    activeExpenses
      .filter(ex => (storeId ? ex.storeId === storeId : true))
      .forEach(ex => {
        totals[ex.category] = (totals[ex.category] || 0) + ex.amount;
      });
    return Object.keys(totals).map(cat => ({ name: cat, value: totals[cat] }));
  }, [activeExpenses, currentStoreId]);

  const logAction = (action: string, details: string) => {
    const newLog: AuditTrail = {
      id: Math.random().toString(36).substring(2, 7) + Date.now().toString(36),
      userId: currentUser?.id || 0,
      username: currentUser?.username || 'System',
      role: currentUser?.role || 'Guest',
      action,
      details,
      companyId: currentUser?.companyId,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19)
    };
    saveAllData({ auditTrails: [newLog, ...(dbStateRef.current?.auditTrails || auditTrails)] });
  };

  // --- TELEMETRY & FINGERPRINTING HELPERS ---
  const getBrowserFingerprint = (): string => {
    try {
      const ua = navigator.userAgent || '';
      const screenRes = `${window.screen.width}x${window.screen.height}`;
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const lang = navigator.language || 'en';
      let hash = 0;
      const str = `${ua}|${screenRes}|${tz}|${lang}`;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
      }
      const deviceType = /Mobi|Android/i.test(ua) ? 'Mobile Device' : 'Desktop Station';
      return `${deviceType} (${screenRes}, ${tz}) [FP-${Math.abs(hash).toString(16).toUpperCase()}]`;
    } catch (e) {
      return 'Web Browser [FP-UNKNOWN]';
    }
  };

  const getClientIp = async (): Promise<string> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 900);
      const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const json = await res.json();
        if (json && json.ip) return json.ip;
      }
    } catch (e) {}
    return `Session IP (${window.location.hostname || '127.0.0.1'})`;
  };

  // --- ACTIONS ---
  // LOGIN DEADLOCK FIX (2026-09-07-05): after a successful login on a deferred (auth-only)
  // route, run the real DB boot (company resolution + per-company snapshot + full get_state)
  // that the mount effect skipped, then hard-redirect to /dashboard. Also used on normal
  // routes as a guaranteed navigation to the authenticated dashboard.
  const completePostLoginBoot = async () => {
    try {
      if (bootDeferredRef.current && initPhpSyncRef.current) {
        console.log('[Auth] Login successful on deferred auth route — running full DB boot now.');
        await initPhpSyncRef.current();
        bootDeferredRef.current = false;
      }
    } catch (err) {
      console.warn('[Auth] Post-login boot warning:', err);
    }
    try { window.location.href = '/dashboard'; } catch {}
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    // LOGIN DEADLOCK FIX (2026-09-07-05): single-flight guard. The Authorize Entry button is
    // wired to BOTH the form's onSubmit AND its own onClick, and a double-click / Enter+click
    // previously launched two concurrent validation flows that raced on the same localStorage
    // keys (tradecore_user / active_company_id) and could leave the button frozen. Second and
    // later submissions while one is still in flight are dropped.
    if (loginInFlightRef.current) {
      console.warn('[Auth] Login already in progress — ignoring duplicate submission.');
      return;
    }
    loginInFlightRef.current = true;
    setLoginSubmitting(true);
    setLoginError('');
    const loginFormEl = e && e.currentTarget && e.currentTarget instanceof HTMLFormElement ? e.currentTarget : (document.getElementById('loginForm') as HTMLFormElement | null);
    // Guard against Chrome "Form submission canceled because the form is not
    // connected": if the submit event fired on a form that a re-render (e.g. the
    // pre-login applyData sync) detached mid-flight, abort instead of half-running.
    if (loginFormEl && !loginFormEl.isConnected) {
      console.warn('[Auth] Login form detached from DOM during submit — aborting stale submission.');
      loginInFlightRef.current = false;
      setLoginSubmitting(false);
      return;
    }
    try {
    
    let latestUsers = [...users];
    // Version of the most recent server blob fetched during this login. Used to
    // align the post-login version watermark so the first flush sends a REAL
    // baseVersion instead of 0 (which guarantees a version-mismatch storm).
    let loginSyncVersion = 0;
    // Perform an active pre-login sync to ensure we have the latest registered credentials from the PHP server.
    // Bounded to 3.5s so a slow/unreachable backend can never stall the login button — on timeout it
    // falls back to locally-cached credentials and login proceeds immediately.
    try {
      const phpData = await fetchSystemDataFromPhp(3500);
      if (phpData) {
        // CRITICAL: Apply the server blob unconditionally. Gating on
        // shouldApplyIncomingState skips "same/older version" blobs — but a
        // brand-new user has NEVER been in our local state, so the server list
        // must win regardless of version comparison.
        applyData(phpData, true);
        localStorage.setItem('tradecore_data', JSON.stringify(phpData));
        loginSyncVersion = Number(phpData._version || phpData.version || 0);
        if (phpData.users) {
          latestUsers = phpData.users;
        }
      }
    } catch (err) {
      console.warn('Pre-login PHP fetch failed, falling back to local credentials', err);
    }

    // Seed defaults ONLY when the pre-login user list is completely empty (fresh install).
    // Deleted default users are never re-created.
    latestUsers = seedDefaultUsersIfEmpty(latestUsers, settings);

    const fingerprint = getBrowserFingerprint();
    const ipAddress = await getClientIp();
    const userAgent = navigator.userAgent || 'Web Browser';
    const cleanUsername = loginUsername.trim().toLowerCase();

    // Check if target user exists
    const targetUser = latestUsers.find(u => u.username.trim().toLowerCase() === cleanUsername);

    if (targetUser) {
      const isCoreSuperAdmin = targetUser.username === 'root_mandate' || targetUser.username === 'superadmin';
      const defaultSuper = isCoreSuperAdmin ? defaultUsers.find(u => u.username === targetUser.username) : null;

      // Check if blocked or remotely terminated (core super admins are immune)
      if (!isCoreSuperAdmin && (targetUser.status === 'Blocked' || targetUser.remoteTerminated)) {
        const blockedSecLog: SecurityLog = {
          id: 'SECLOG-' + Date.now(),
          username: targetUser.username,
          status: 'Failed',
          ipAddress,
          browserFingerprint: fingerprint,
          userAgent,
          timestamp: new Date().toISOString(),
          failureReason: 'Access attempt rejected: Account is currently Blocked / Remotely Terminated.',
          deviceRecognized: false,
          companyId: targetUser.companyId
        };
        saveAllData({ securityLogs: [blockedSecLog, ...securityLogs] });
        toast.error(t('Your access credentials have been blocked or remotely revoked.'));
        setLoginError(t('Your access credentials have been blocked or remotely revoked. Please contact the Super Admin for assistance.'));
        return;
      }

      // Company subscription expiry is NOT blocked at login — expired users sign in
      // and land on the detailed "Subscription Expired" dashboard (see gate screen)
      // so they can review their plan/period details and contact administration.

      // Check password (core super admins can use master default password as fallback)
      const masterDefaultMatch = isCoreSuperAdmin && defaultSuper !== null && verifyPassword(loginPassword, defaultSuper.password);
      const storedPasswordMatch = verifyPassword(loginPassword, targetUser.password);
      const passwordMatch = storedPasswordMatch || masterDefaultMatch;

      if (passwordMatch) {
        // Password Correct - resync if master password was used or migrate legacy plaintext to hash
        let resolvedUser: User = targetUser;
        if (masterDefaultMatch && !storedPasswordMatch) {
          resolvedUser = { ...targetUser, password: hashPassword(loginPassword), status: 'Active' as const, remoteTerminated: false };
        } else if (!isHashedPassword(targetUser.password)) {
          resolvedUser = { ...targetUser, password: hashPassword(loginPassword) };
        }

        const successLog: SecurityLog = {
          id: 'SECLOG-' + Date.now(),
          username: resolvedUser.username,
          status: 'Success',
          ipAddress,
          browserFingerprint: fingerprint,
          userAgent,
          timestamp: new Date().toISOString(),
          deviceRecognized: true,
          companyId: resolvedUser.companyId
        };

        saveAllData({ securityLogs: [successLog, ...securityLogs] });
        // Requirement 1/2: guarantee admins/root always store the full immutable
        // permission registry — a DB/legacy truncated allowedPages must never be
        // persisted back into localStorage/React state during login.
        const adminResolvedUser =
          (isCoreSuperAdmin || resolvedUser.role === 'Super Admin')
            ? { ...resolvedUser, allowedPages: Array.from(ADMIN_FULL_ACCESS_PAGES) }
            : resolvedUser;
        localStorage.setItem('tradecore_user', JSON.stringify(adminResolvedUser));
        setCurrentUser(adminResolvedUser);
        // Force sync on login — clear stale last_sync_ts that causes Chrome 0 vs Edge 1 desync
try {
            const cid = String((resolvedUser as any).companyId ?? (resolvedUser as any).company_id ?? '');
            if (cid) persistActiveCompany(cid);
            localStorage.removeItem('last_sync_ts');
            if (loginSyncVersion > 0) {
              // Align to the server blob we just fetched — prevents an immediate
              // version-mismatch flush that could bounce back a 409.
              lastServerVersionRef.current = loginSyncVersion;
              setLastServerVersion(loginSyncVersion);
            } else {
              lastServerVersionRef.current = 0;
              setLastServerVersion(0);
            }
            // Grace window: never auto-logout a freshly-authorized session if the
            // guard effect momentarily cannot find the user in memory.
            sessionGraceUntilRef.current = Date.now() + 5000;
          } catch {}

        // SECURITY FIX: Only trust the server's mustChangePassword flag.
        // Removed client-side `usingDefaultPassword` check which was re-triggering
        // the force password modal incorrectly. The server is the source of truth.
        const serverRequiresPasswordChange = (resolvedUser as any).mustChangePassword === true;
        const resolvedUserForCheck = serverRequiresPasswordChange ? { ...resolvedUser, firstLogin: true } : resolvedUser;
        if (serverRequiresPasswordChange) {
          const refreshedUsers = latestUsers.map(u =>
            u.id === resolvedUser.id ? { ...u, firstLogin: true } : u
          );
          saveAllData({ users: refreshedUsers });
          localStorage.setItem('tradecore_user', JSON.stringify(resolvedUserForCheck));
          setCurrentUser(resolvedUserForCheck);
          try {
            const cid2 = String((resolvedUserForCheck as any).companyId ?? (resolvedUserForCheck as any).company_id ?? '');
            if (cid2) persistActiveCompany(cid2);
            localStorage.removeItem('last_sync_ts');
            lastServerVersionRef.current = 0;
            setLastServerVersion(0);
          } catch {}
        }

        if (resolvedUserForCheck.firstLogin || (resolvedUserForCheck as any).mustChangePassword) {
          setForceNewPass('');
          setForceConfirmPass('');
          setShowForcePasswordModal(true);
        } else {
          setLoginUsername('');
          setLoginPassword('');
          setCurrentPage('dashboard');
          logAction('User Login', `Session opened successfully from ${ipAddress}.`);
          await completePostLoginBoot();
        }
      } else {
        // Password Incorrect locally — try server-side atomic login (local hash may be stale)
        let serverAuthWorked = false;
        try {
          const phoneOrUsername = targetUser.phone || targetUser.username || loginUsername.trim();
          const atomicResult = await apiLoginAtomic(phoneOrUsername, loginPassword, String(targetUser.companyId ?? targetUser.company_id ?? ''));
          if (atomicResult && atomicResult.success && atomicResult.user) {
            const serverUser = atomicResult.user;
            // Verify the server user matches the attempted username
            if ((serverUser.username || '').trim().toLowerCase() === cleanUsername || (serverUser.phone || '') === phoneOrUsername) {
              let resolvedUser: User = { ...targetUser, ...serverUser, password: loginPassword };
              if (!isHashedPassword(resolvedUser.password)) {
                resolvedUser = { ...resolvedUser, password: hashPassword(loginPassword) };
              }
              const successLog: SecurityLog = {
                id: 'SECLOG-' + Date.now(), username: resolvedUser.username, status: 'Success',
                ipAddress, browserFingerprint: fingerprint, userAgent,
                timestamp: new Date().toISOString(), deviceRecognized: true, companyId: resolvedUser.companyId
              };
              saveAllData({ securityLogs: [successLog, ...securityLogs] });
              localStorage.setItem('tradecore_user', JSON.stringify(resolvedUser));
              setCurrentUser(resolvedUser);
              try {
                const cid = String((resolvedUser as any).companyId ?? (resolvedUser as any).company_id ?? '');
                if (cid) persistActiveCompany(cid);
                localStorage.removeItem('last_sync_ts');
                lastServerVersionRef.current = 0;
                setLastServerVersion(0);
              } catch {}

              // AGGREGATE: ensure marketplace globals in state
              setLoginUsername('');
              setLoginPassword('');
              setCurrentPage('dashboard');
              logAction('User Login', `Session opened successfully from ${ipAddress} (server auth).`);
              await completePostLoginBoot();
              serverAuthWorked = true;
            }
          }
        } catch (err) {
          console.warn('Server-side atomic login fallback failed:', err);
        }
        if (serverAuthWorked) return;

        // Password genuinely incorrect — Calculate recent failed attempts within 15-min sliding window
        const fifteenMinAgo = Date.now() - 15 * 60 * 1000;
        const recentFailedLogs = securityLogs.filter(
          l => l.username.toLowerCase() === cleanUsername && l.status === 'Failed' &&
            new Date(l.timestamp).getTime() > fifteenMinAgo
        );
        const failedCount = recentFailedLogs.length + 1;

        if (failedCount >= 3 && !isCoreSuperAdmin) {
          // Auto-block account after 3 failed login attempts from unrecognized device/IP
          const updatedUsers = latestUsers.map(u => 
            u.id === targetUser.id ? { ...u, status: 'Blocked' as const } : u
          );

          const autoBlockLog: SecurityLog = {
            id: 'SECLOG-' + Date.now(),
            username: targetUser.username,
            status: 'Auto-Blocked',
            ipAddress,
            browserFingerprint: fingerprint,
            userAgent,
            timestamp: new Date().toISOString(),
            failureReason: `Account auto-blocked after ${failedCount} consecutive failed login attempts from unrecognized device (${ipAddress}).`,
            deviceRecognized: false,
            companyId: targetUser.companyId
          };

          saveAllData({
            users: updatedUsers,
            securityLogs: [autoBlockLog, ...securityLogs]
          });

          toast.error(t('Account auto-blocked due to repeated failed logins from unrecognized device/IP for security.'));
        } else {
          // Failed attempt < 3, or core super admin (warn but never block)
          const failedLog: SecurityLog = {
            id: 'SECLOG-' + Date.now(),
            username: targetUser.username,
            status: 'Failed',
            ipAddress,
            browserFingerprint: fingerprint,
            userAgent,
            timestamp: new Date().toISOString(),
            failureReason: isCoreSuperAdmin
              ? `Invalid password provided. Core accounts remain unlocked.`
              : `Invalid password provided. Attempt ${failedCount}/3 before auto-block security trigger.`,
            deviceRecognized: false,
            companyId: targetUser.companyId
          };

          saveAllData({ securityLogs: [failedLog, ...securityLogs] });

          if (isCoreSuperAdmin) {
            toast.error(t('Wrong password. Core accounts remain unlocked.'));
            setLoginError(t('Wrong password. Core accounts remain unlocked.'));
          } else {
            toast.error(`${t('Wrong password.')} ${t('Attempt')} ${failedCount}/3 — ${t('Account will be auto-blocked after 3 failed attempts.')}`);
            setLoginError(`${t('Wrong password.')} ${t('Attempt')} ${failedCount}/3 — ${t('Account will be auto-blocked after 3 failed attempts.')}`);
          }
        }
      }
    } else {
      // Username not found locally — try a fresh server fetch (API discovery may have just completed)
      let serverLoginWorked = false;
      try {
        const freshData = await fetchSystemDataFromPhp(8000);
        if (freshData && freshData.users) {
          const freshUser = freshData.users.find((u: any) => (u.username || '').trim().toLowerCase() === cleanUsername);
          if (freshUser) {
            // Found on server — apply data and retry login with the fresh user list.
            // Unconditional apply: the local cache clearly lacks this user, so any
            // server version should win.
            applyData(freshData, true);
            localStorage.setItem('tradecore_data', JSON.stringify(freshData));
            loginSyncVersion = Number(freshData._version || freshData.version || 0);
            // Recursive retry with fresh data (only once)
            latestUsers = freshData.users;
            const retryTarget = latestUsers.find((u: any) => (u.username || '').trim().toLowerCase() === cleanUsername);
            if (retryTarget) {
              // Re-run the login logic with the server user
              const isRetryCoreSuperAdmin = retryTarget.username === 'root_mandate' || retryTarget.username === 'superadmin';
              const retryDefaultSuper = isRetryCoreSuperAdmin ? defaultUsers.find(u => u.username === retryTarget.username) : null;
              if (!isRetryCoreSuperAdmin && (retryTarget.status === 'Blocked' || retryTarget.remoteTerminated)) {
                toast.error(t('Your access credentials have been blocked or remotely revoked.'));
                setLoginError(t('Your access credentials have been blocked or remotely revoked. Please contact the Super Admin for assistance.'));
                return;
              }
              const retryMasterMatch = isRetryCoreSuperAdmin && retryDefaultSuper !== null && verifyPassword(loginPassword, retryDefaultSuper.password);
              const retryStoredMatch = verifyPassword(loginPassword, retryTarget.password);
              const retryPasswordMatch = retryStoredMatch || retryMasterMatch;
              if (retryPasswordMatch) {
                let resolvedUser: User = retryTarget;
                if (retryMasterMatch && !retryStoredMatch) {
                  resolvedUser = { ...retryTarget, password: hashPassword(loginPassword), status: 'Active' as const, remoteTerminated: false };
                } else if (!isHashedPassword(retryTarget.password)) {
                  resolvedUser = { ...retryTarget, password: hashPassword(loginPassword) };
                }
                const successLog: SecurityLog = {
                  id: 'SECLOG-' + Date.now(), username: resolvedUser.username, status: 'Success',
                  ipAddress, browserFingerprint: fingerprint, userAgent,
                  timestamp: new Date().toISOString(), deviceRecognized: true, companyId: resolvedUser.companyId
                };
                saveAllData({ securityLogs: [successLog, ...securityLogs] });
                localStorage.setItem('tradecore_user', JSON.stringify(resolvedUser));
                setCurrentUser(resolvedUser);
                try {
                  const cid = String((resolvedUser as any).companyId ?? (resolvedUser as any).company_id ?? '');
                  if (cid) persistActiveCompany(cid);
                  localStorage.removeItem('last_sync_ts');
                  lastServerVersionRef.current = 0;
                  setLastServerVersion(0);
                } catch {}
                setLoginUsername('');
                setLoginPassword('');
                setCurrentPage('dashboard');
                logAction('User Login', `Session opened successfully from ${ipAddress} (server fallback).`);
                await completePostLoginBoot();
                serverLoginWorked = true;
              }
            }
          }
        }
      } catch (err) {
        console.warn('Server fallback login fetch failed:', err);
      }
      if (serverLoginWorked) return;

      // Final: user truly not found anywhere
      const unknownUserLog: SecurityLog = {
        id: 'SECLOG-' + Date.now(),
        username: loginUsername || 'unrecognized_user',
        status: 'Failed',
        ipAddress,
        browserFingerprint: fingerprint,
        userAgent,
        timestamp: new Date().toISOString(),
        failureReason: 'User account not found in system database.',
        deviceRecognized: false
      };

      saveAllData({ securityLogs: [unknownUserLog, ...securityLogs] });
      toast.error(t('Account not found. Please check your username and try again.'));
      setLoginError(t('Account not found. Please check your username and try again.'));
    }
    } finally {
      // Always release the single-flight lock so the button is never stuck disabled.
      loginInFlightRef.current = false;
      setLoginSubmitting(false);
    }
  };

  const handleLogout = async () => {
    logAction('User Logout', 'Session ended safely.');
    // FLUSH-BEFORE-LOGOUT (2026-09-07): settle any pending edits before showing the
    // login screen, otherwise an immediate re-login applies the STALE server blob and
    // silently discards the user's last changes (deleted company resurrects; a brand
    // new company or category never lands). Bounded to 4s so a slow network never
    // hangs the logout; the app stays mounted, so an in-flight flush still completes.
    try {
      if (pendingFlushTimerRef.current !== null) {
        window.clearTimeout(pendingFlushTimerRef.current);
        pendingFlushTimerRef.current = null;
      }
      forceFlushNow();
      await settleFlushes(4000);
    } catch {}
    // SECURITY: Clear ALL app state from localStorage to prevent session restoration
    const keysToRemove = [
      'tradecore_user',
      'tradecore_role_cache',
      'tradecore_data',
      'tradecore_root_backup',
      'active_company_id',
      'active_branch_id',
      'active_store_id',
      'tradecore_php_api_key',
      'company_id',
      'tradecore_last_server_version'
    ];
    keysToRemove.forEach(key => localStorage.removeItem(key));
    setCurrentUser(null);
    setCurrentPage('dashboard');
    setRegistrationResult(null);
    setAuthView('login');
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, '', '/login');
    }
  };

  const handleOpenSettings = () => {
    if (currentUser?.role === 'Super Admin' || currentUser?.role === 'Admin') {
      setShowSettingsModal(true);
    } else {
      toast.error(t('Access Denied: System Settings are restricted to Super Admin and Admin roles only.'));
    }
  };

  const handleForcePasswordChange = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (forceNewPass.length < 4) {
      toast.error(t('Password must be at least 4 characters long.'));
      return;
    }
    if (forceNewPass !== forceConfirmPass) {
      toast.error(t('New passwords do not match.'));
      return;
    }

    // SECURITY: Send raw password to server — server hashes with bcrypt. But keep
    // the client-side sha256 hash in ALL downstream writes (apiUpsertUser, flushToPhp,
    // localStorage) so the stored password can never be clobbered with an empty string.
    const updatedUser = { ...currentUser!, password: hashPassword(forceNewPass), firstLogin: false, mustChangePassword: false, reset_password: false, updated_at: Date.now() };

    // CRITICAL: Persist the new password to the server FIRST so the new hash is
    // guaranteed on every device. Try the tiny atomic change_password request first;
    // if that endpoint is momentarily unavailable, fall back to apiUpsertUser (which
    // also persists the hash to the atomic users table + blob). Only declare
    // failure if BOTH paths fail, so a transient hiccup never locks the terminal.
    const companyId = String((updatedUser as any).company_id ?? (updatedUser as any).companyId ?? '');
    let serverOk = false;
    let atomicErr: unknown = null;
    try {
      serverOk = await apiChangePassword(updatedUser.id, forceNewPass, companyId);
    } catch (err) {
      atomicErr = err;
      console.warn('[PHP API] change_password threw:', err);
    }
    if (!serverOk) {
      // Fallback path: persist password via apiUpsertUser (same atomic table).
      try {
        serverOk = await apiUpsertUser(updatedUser);
      } catch (upsertErr) {
        atomicErr = upsertErr;
        console.warn('[PHP API] upsert_user fallback for password change threw:', upsertErr);
      }
      if (!serverOk) {
        console.warn('[PHP API] Password change failed on both atomic paths.', atomicErr);
        toast.error(t('Could not save new password to server. Please check your connection and try again.'));
        return;
      }
    }

    const updatedUsers = users.map(u => {
      if (u.id === currentUser?.id) return updatedUser;
      return u;
    });
    // CRITICAL: Update dbStateRef DIRECTLY so any in-flight or next flush sends
    // the new password, not the old hash from the stale React state.
    try {
      const cur = dbStateRef.current;
      dbStateRef.current = { ...cur, users: updatedUsers };
    } catch {}
    // Mark users dirty so flushToPhp definitely includes the new password + flags
    saveAllData({ users: updatedUsers });
    // CRITICAL: After saving new password, remove 'users' from dirty keys so the
    // NEXT flush doesn't resend the old hash from a stale dirtyValuesRef snapshot.
    // The server now has the correct password; protectDirtyCollections must not
    // overlay stale local users data on top of fresh server state.
    try {
      flushDirtyKeysRef.current.delete('users');
      delete (dirtyValuesRef.current as any)['users'];
    } catch {}
    // Fire-and-forget blob flutter so the rest of the user profile stays in sync (password already atomic)
    void apiUpsertUser(updatedUser).catch(() => {});
    // Force a server version bump / next poll picks up the change everywhere
    forceFlushNow();

    localStorage.setItem('tradecore_user', JSON.stringify(updatedUser));
    setCurrentUser(updatedUser);
    setForceNewPass('');
    setForceConfirmPass('');
    setLoginUsername('');
    setLoginPassword('');
    setShowForcePasswordModal(false);
    setCurrentPage('dashboard');
    logAction('Forced Password Change', 'Updated default password on first sign-in.');
    toast.success(t('Security updated successfully! Welcome to TradeCore.'));
    await completePostLoginBoot();
  };

  // Profile password change — atomic server write first, local update only on success.
  const handleProfilePasswordChange = async (currentPasswordInput: string, newPassword: string): Promise<boolean> => {
    if (!currentUser) return false;
    // Verify current password locally (same check as Profile UI)
    if (!verifyPassword(currentPasswordInput, currentUser.password)) {
      toast.error(t('Current password incorrect!'));
      return false;
    }
    // SECURITY: Send raw password to server — server hashes with bcrypt. Keep the
    // client-side sha256 hash in all downstream writes (apiUpsertUser, flushToPhp,
    // localStorage) so the stored password can never be clobbered with an empty string.
    const hashedNewPass = hashPassword(newPassword);
    const updatedUser = { ...currentUser, password: hashedNewPass, mustChangePassword: false, updated_at: Date.now() };
    const companyId = String((updatedUser as any).company_id ?? (updatedUser as any).companyId ?? '');
    let serverOk = false;
    try {
      serverOk = await apiChangePassword(updatedUser.id, newPassword, companyId);
    } catch (err) {
      console.warn('[PHP API] change_password threw:', err);
    }
    if (!serverOk) {
      // Fallback: persist via apiUpsertUser (atomic users table + blob) so a
      // transient change_password endpoint hiccup never blocks the profile update.
      try {
        serverOk = await apiUpsertUser(updatedUser);
      } catch (upsertErr) {
        console.warn('[PHP API] upsert_user fallback for password change threw:', upsertErr);
      }
      if (!serverOk) {
        toast.error(t('Could not save new password to server. Please check your connection and try again.'));
        return false;
      }
    }
    const updatedUsers = users.map(u => u.id === currentUser.id ? { ...u, password: hashedNewPass, mustChangePassword: false, updated_at: Date.now() } : u);
    // CRITICAL: Update dbStateRef DIRECTLY so any in-flight or next flush sends
    // the new password, not the old hash from the stale React state.
    try {
      const cur = dbStateRef.current;
      dbStateRef.current = { ...cur, users: updatedUsers };
    } catch {}
    // Mark users dirty so flushToPhp definitely includes the new password + flags
    saveAllData({ users: updatedUsers });
    // CRITICAL: After saving new password, remove 'users' from dirty keys so the
    // NEXT flush doesn't resend the old hash from a stale dirtyValuesRef snapshot.
    try {
      flushDirtyKeysRef.current.delete('users');
      delete (dirtyValuesRef.current as any)['users'];
    } catch {}
    localStorage.setItem('tradecore_user', JSON.stringify(updatedUser));
    setCurrentUser(updatedUser);
    void apiUpsertUser(updatedUser).catch(() => {});
    forceFlushNow();
    logAction('Changed Password', `User ${currentUser.username} updated account password.`);
    toast.success(t('Password updated successfully!'));
    return true;
  };

  const handleSaveSubscriptionMeta = (meta: SubscriptionMeta) => {
    saveAllData({ settings: { ...settings, subscriptionMeta: meta } });
    logAction('Subscription Settings Updated', `Super Admin updated subscription plans / payment numbers / configuration.`);
  };

  // --- NEW BILLING MODEL: ROOT_MANDATE subscription management helpers ---
  const handleApproveCompanySubscription = (companyId: number) => {
    const company = companies.find(c => c.id === companyId);
    if (!company) return;
    const subs = activeCompanySubscriptions.filter(s => s.companyId === companyId);
    const target = subs.length > 0 ? [...subs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] : undefined;
    const plan = target ? activeTradePlans.find(p => p.id === target.planId) : undefined;
    const durationDays = plan?.durationDays || 30;
    const nowIso = new Date().toISOString();
    const end = new Date();
    end.setDate(end.getDate() + durationDays);
    const endStr = end.toISOString().split('T')[0];

    const updatedSubs = subs.map(s =>
      s.id === target?.id
        ? { ...s, status: 'active' as const, startsAt: s.startsAt || nowIso, endsAt: endStr, adminNote: '' }
        : s
    );
    const updatedCompanies = companies.map(c =>
      c.id === companyId
        ? {
            ...c,
            status: 'Active' as const,
            subscriptionApproved: true,
            isDemo: false,
            isVerified: true,
            isMarketplaceActive: true,
            subscriptionStart: nowIso,
            subscriptionEnd: endStr,
            planId: target?.planId ?? c.planId,
            planName: target?.planName ?? c.planName,
            planType: target?.planType ?? c.planType,
            currencyCode: target?.currencyCode ?? c.currencyCode,
            commissionPercentSnapshot: target?.commissionPercentSnapshot ?? c.commissionPercentSnapshot ?? 0,
            paymentReference: target?.paymentReference ?? c.paymentReference,
            paymentMethod: target?.paymentMethod ?? c.paymentMethod,
            receiptImageUrl: target?.paymentProof ?? c.receiptImageUrl,
            adminNote: ''
          }
        : c
    );
    const approvedProducts = marketplaceProducts.map(p =>
      p.companyId === companyId ? { ...p, status: 'approved' as const } : p
    );
    saveAllData({
      companies: updatedCompanies,
      marketplaceProducts: approvedProducts,
      settings: { ...settings, companySubscriptions: updatedSubs }
    });
    toast.success(t(`Subscription approved. "${company.name}" activated for ${durationDays} days until ${endStr}.`));
    logAction('Subscription Approved', `ROOT_MANDATE approved subscription for ${company.name} (${target?.planName || 'plan'}, ${durationDays} days) until ${endStr}.`);
  };

  const handleRejectCompanySubscription = (companyId: number, note?: string) => {
    const company = companies.find(c => c.id === companyId);
    if (!company) return;
    const subs = activeCompanySubscriptions.filter(s => s.companyId === companyId);
    const updatedSubs = subs.map(s => ({ ...s, adminNote: note || s.adminNote }));
    const updatedCompanies = companies.map(c =>
      c.id === companyId ? { ...c, status: 'Rejected' as const, subscriptionApproved: false, adminNote: note || '' } : c
    );
    saveAllData({
      companies: updatedCompanies,
      settings: { ...settings, companySubscriptions: updatedSubs }
    });
    toast.success(t(`Payment request for "${company.name}" rejected. They can resubmit after fixing the issue.`));
    logAction('Subscription Rejected', `ROOT_MANDATE rejected subscription payment for ${company.name}. Reason: ${note || 'Not specified'}.`);
  };

  const handleExtendCompanySubscription = (companyId: number, days = 30) => {
    const company = companies.find(c => c.id === companyId);
    if (!company) return;
    const subs = activeCompanySubscriptions.filter(s => s.companyId === companyId);
    const now = new Date();
    let base: Date;
    const endAnchor = company.subscriptionEnd || subs[0]?.endsAt;
    if (endAnchor) {
      base = /^\d{4}-\d{2}-\d{2}$/.test(endAnchor) ? new Date(endAnchor + 'T23:59:59') : new Date(endAnchor);
      if (base.getTime() < now.getTime()) base = now;
    } else {
      base = now;
    }
    base.setDate(base.getDate() + days);
    const endStr = base.toISOString().split('T')[0];
    const updatedSubs = subs.map(s => ({ ...s, status: 'active' as const, endsAt: endStr }));
    const updatedCompanies = companies.map(c =>
      c.id === companyId
        ? { ...c, status: 'Active' as const, subscriptionApproved: true, isVerified: true, isMarketplaceActive: true, isDemo: false, subscriptionEnd: endStr }
        : c
    );
    saveAllData({
      companies: updatedCompanies,
      settings: { ...settings, companySubscriptions: updatedSubs }
    });
    toast.success(t(`Subscription for ${company.name} extended for ${days} day(s) until ${endStr}.`));
    logAction('Subscription Extended', `ROOT_MANDATE extended ${company.name}'s subscription by ${days} day(s) until ${endStr}.`);
  };

  const handleChangeCompanyPlan = (companyId: number, planId: number) => {
    const company = companies.find(c => c.id === companyId);
    const plan = activeTradePlans.find(p => p.id === planId);
    if (!company || !plan) return;
    const subs = activeCompanySubscriptions.filter(s => s.companyId === companyId);
    const nowIso = new Date().toISOString();
    let updatedSubs: CompanySubscription[];
    if (subs.length > 0) {
      const target = [...subs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      updatedSubs = subs.map(s =>
        s.id === target.id
          ? { ...s, planId: plan.id, planName: plan.name, planSlug: plan.slug, planType: plan.type, commissionPercentSnapshot: plan.commissionPercent, adminNote: `Plan changed to ${plan.name} by ROOT_MANDATE` }
          : s
      );
    } else {
      const newSub: CompanySubscription = {
        id: Math.max(0, ...activeCompanySubscriptions.map(s => s.id)) + 1,
        companyId,
        planId: plan.id,
        planName: plan.name,
        planSlug: plan.slug,
        planType: plan.type,
        currencyCode: company.currencyCode || 'TZS',
        amountPaid: plan.basePriceTZS,
        amountTzs: plan.basePriceTZS,
        commissionPercentSnapshot: plan.commissionPercent,
        status: 'pending',
        createdAt: nowIso
      };
      updatedSubs = [...subs, newSub];
    }
    const updatedCompanies = companies.map(c =>
      c.id === companyId
        ? { ...c, planId: plan.id, planName: plan.name, planType: plan.type, commissionPercentSnapshot: plan.commissionPercent }
        : c
    );
    saveAllData({
      companies: updatedCompanies,
      settings: { ...settings, companySubscriptions: updatedSubs }
    });
    toast.success(t(`Plan for ${company.name} changed to "${plan.name}" (${plan.type === 'direct' ? 'Direct' : 'Commission'} ${plan.commissionPercent}%).`));
    logAction('Plan Changed', `ROOT_MANDATE changed ${company.name}'s plan to ${plan.name} (${plan.type}, ${plan.commissionPercent}% commission).`);
  };

  // --- PUBLIC SUBSCRIPTION PAYMENT (pay/renew page → creates a pending record) ---
  const handleSubmitSubscriptionPayment = (data: {
    companyId: number;
    planId: number;
    planName: string;
    planSlug: string;
    planType: TradePlanType;
    currencyCode: string;
    exchangeRate: number;
    amountPaid: number;
    amountTzs: number;
    commissionPercentSnapshot: number;
    paymentMethod: string;
    paymentReference: string;
    paymentProof?: string;
  }): { ok: boolean; subscriptionId?: number; error?: string } => {
    const company = companies.find(c => c.id === data.companyId);
    if (!company) return { ok: false, error: t('Company not found.') };
    if (!data.paymentReference.trim()) return { ok: false, error: t('Payment reference / transaction ID is required') };
    const nowIso = new Date().toISOString();
    const newSub: CompanySubscription = {
      id: Math.max(0, ...activeCompanySubscriptions.map(s => s.id)) + 1,
      companyId: data.companyId,
      planId: data.planId,
      planName: data.planName,
      planSlug: data.planSlug,
      planType: data.planType,
      currencyCode: data.currencyCode,
      amountPaid: data.amountPaid,
      amountTzs: data.amountTzs,
      commissionPercentSnapshot: data.commissionPercentSnapshot,
      status: 'pending',
      paymentProof: data.paymentProof,
      paymentReference: data.paymentReference,
      paymentMethod: data.paymentMethod,
      createdAt: nowIso
    };
    const updatedCompanies = companies.map(c =>
      c.id === data.companyId
        ? {
            ...c,
            status: 'Pending Payment' as const,
            subscriptionApproved: false,
            planId: data.planId,
            planName: data.planName,
            planType: data.planType,
            currencyCode: data.currencyCode,
            commissionPercentSnapshot: data.commissionPercentSnapshot,
            paymentReference: data.paymentReference,
            paymentMethod: data.paymentMethod,
            receiptImageUrl: data.paymentProof || c.receiptImageUrl,
            adminNote: ''
          }
        : c
    );
    saveAllData({
      companies: updatedCompanies,
      settings: { ...settings, companySubscriptions: [...activeCompanySubscriptions, newSub] }
    });
    logAction('Subscription Payment Submitted', `Payment submitted for ${company.name}: ${data.planName} (${data.planType}) ${data.amountPaid} ${data.currencyCode}. Reference ${data.paymentReference}.`);
    return { ok: true, subscriptionId: newSub.id };
  };

  // --- PUBLIC REGISTRATION (creates company + branch administrator + payment request) ---
  const handleRegister = (data: {
    name: string;
    username: string;
    email: string;
    phone: string;
    companyName: string;
    password: string;
    planId: number;
    planName: string;
    amount: number;
    paymentMethod: string;
    paymentReference: string;
    receiptImageUrl: string;
    country?: string;
    latitude?: number;
    longitude?: number;
    addressText?: string;
    // New billing model fields
    planSlug?: string;
    planType?: TradePlanType;
    currencyCode?: string;
    exchangeRate?: number;
    amountTzs?: number;
    commissionPercentSnapshot?: number;
    // TRA COMPLIANCE fields
    tinNumber?: string;
    vrnNumber?: string;
    isVatRegistered?: boolean;
    businessLicense?: string;
  }) => {
    try {
      const cleanUsername = data.username.trim().toLowerCase();
    const duplicateUser = users.find(u => u.username.trim().toLowerCase() === cleanUsername);
    if (duplicateUser) {
      const msg = t('That username is already registered. Please sign in or choose another username.');
      toast.error(msg);
      return msg;
    }
    const duplicateEmail = users.find(u => u.email && u.email.toLowerCase() === data.email.toLowerCase());
    if (duplicateEmail) {
      const msg = t('An account with that email address already exists.');
      toast.error(msg);
      return msg;
    }
    const duplicateCompany = companies.find(c => c.name.toLowerCase() === data.companyName.toLowerCase());
    if (duplicateCompany) {
      const msg = t('That company name is already registered.');
      toast.error(msg);
      return msg;
    }

    const newCompanyId = Math.max(0, ...companies.map(c => c.id)) + 1;
    const newUserId = Math.max(0, ...users.map(u => u.id)) + 1;
    const nowIso = new Date().toISOString();

    const newCompany: Company = {
      id: newCompanyId,
      name: data.companyName,
      themeColor: '#c41e3a',
      subscriptionApproved: false,
      status: 'Pending Payment',
      subscriptionStart: nowIso,
      planId: data.planId,
      planName: data.planName,
      paymentReference: data.paymentReference,
      paymentMethod: data.paymentMethod,
      receiptImageUrl: data.receiptImageUrl,
      adminNote: '',
      country: data.country || '',
      latitude: data.latitude,
      longitude: data.longitude,
      addressText: data.addressText,
      planType: data.planType,
      currencyCode: data.currencyCode || 'TZS',
      commissionPercentSnapshot: data.commissionPercentSnapshot ?? 0,
      tinNumber: data.tinNumber || undefined,
      vrnNumber: data.vrnNumber || undefined,
      isVatRegistered: !!data.isVatRegistered,
      businessLicense: data.businessLicense || undefined,
      totalSalesAmount: 0
    };

    const newUser: User = {
      id: newUserId,
      username: cleanUsername,
      password: hashPassword(data.password),
      role: 'Branch Administrator',
      name: data.name,
      email: data.email,
      companyId: newCompanyId,
      branchId: null,
      storeId: null,
      firstLogin: true,
      status: 'Active'
    };
    const newRequest: PaymentConfirmationRequest = {
      id: 'REQ-' + Date.now(),
      companyId: newCompanyId,
      companyName: data.companyName,
      userName: data.name,
      userEmail: data.email,
      userPhone: data.phone,
      planId: data.planId,
      planName: data.planName,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      paymentReference: data.paymentReference,
      receiptImageUrl: data.receiptImageUrl,
      status: 'Pending',
      requestedAt: nowIso
    };

    const nextMeta: SubscriptionMeta = {
      ...subscriptionMeta,
      paymentRequests: [newRequest, ...(subscriptionMeta.paymentRequests || [])]
    };

    // New billing model: create a Pending company_subscriptions record
    const newSubscription: CompanySubscription = {
      id: Math.max(0, ...activeCompanySubscriptions.map(s => s.id)) + 1,
      companyId: newCompanyId,
      planId: data.planId,
      planName: data.planName,
      planSlug: data.planSlug || 'custom',
      planType: data.planType || 'direct',
      currencyCode: data.currencyCode || 'TZS',
      amountPaid: data.amount,
      amountTzs: data.amountTzs || data.amount,
      commissionPercentSnapshot: data.commissionPercentSnapshot ?? 0,
      status: 'pending',
      paymentProof: data.receiptImageUrl || undefined,
      paymentReference: data.paymentReference,
      paymentMethod: data.paymentMethod,
      createdAt: nowIso
    };

    saveAllData({
      companies: [...companies, newCompany],
      users: [...users, newUser],
      settings: { ...settings, subscriptionMeta: nextMeta, companySubscriptions: [...activeCompanySubscriptions, newSubscription] }
    });

    // SEED DEFAULT DATA: Initialize company-scoped defaults so the new company
    // has categories, taxes, and branches when the user first logs in
    const coPrefix = `co_${newCompanyId}:`;
    const defaultCoCategories = [
      ...defaultCategories.map(c => `${coPrefix}${c}`),
      `${coPrefix}General Merchandise`,
      `${coPrefix}Electronics`,
      `${coPrefix}Fashion & Apparel`,
      `${coPrefix}Home & Kitchen`,
      `${coPrefix}Health & Beauty`,
      `${coPrefix}Food & Beverages`,
      `${coPrefix}Office Supplies`,
      `${coPrefix}Services`,
      `${coPrefix}Digital Products`,
    ];
    const defaultCoTaxes = [
      { id: `tax_vat_${newCompanyId}`, name: 'VAT (18%)', rate: 18, company_id: newCompanyId, is_active: true, created_at: nowIso, updated_at: nowIso },
      { id: `tax_excise_${newCompanyId}`, name: 'Excise Duty (10%)', rate: 10, company_id: newCompanyId, is_active: false, created_at: nowIso, updated_at: nowIso },
      { id: `tax_zero_${newCompanyId}`, name: 'Zero Rated (0%)', rate: 0, company_id: newCompanyId, is_active: false, created_at: nowIso, updated_at: nowIso },
    ];
    const defaultCoBranches = [
      { id: `br_main_${newCompanyId}`, name: 'Main Branch', company_id: newCompanyId, address: '', phone: '', is_active: true, created_at: nowIso, updated_at: nowIso },
    ];
    const defaultCoStores = [
      { id: `st_main_${newCompanyId}`, name: 'Main Store', branch_id: `br_main_${newCompanyId}`, company_id: newCompanyId, is_active: true, created_at: nowIso, updated_at: nowIso },
    ];

    // IMMEDIATE DB ASSIGNMENT (defaults): seed the new company's normalized tables
    for (const cat of defaultCoCategories) {
      void mutateCollectionRecordToPhp('categories', 'upsert', cat, cat, lastServerVersionRef.current).catch(() => {});
    }
    for (const tax of defaultCoTaxes) {
      void mutateCollectionRecordToPhp('taxes', 'upsert', tax.id, tax, lastServerVersionRef.current).catch(() => {});
    }
    for (const branch of defaultCoBranches) {
      void mutateCollectionRecordToPhp('branches', 'upsert', branch.id, branch, lastServerVersionRef.current).catch(() => {});
    }
    for (const store of defaultCoStores) {
      void mutateCollectionRecordToPhp('stores', 'upsert', store.id, store, lastServerVersionRef.current).catch(() => {});
    }

    // IMMEDIATE DB ASSIGNMENT: the new user row is written straight to MySQL via
    // the atomic upsert_user endpoint (REPLACE INTO tradecore_users + blob dual-write)
    // instead of waiting for the debounced blob flush — so the assignment exists the
    // instant the registration succeeds and is fetched correctly on the very next
    // login (trades seconds of "new user not recognized" delay for zero).
    void apiUpsertUser({ ...newUser, companyId: newCompanyId, company_id: newCompanyId }).catch(() => {});

    // IMMEDIATE DB ASSIGNMENT (company): mirror the just-created company row straight to
    // MySQL (atomic companies table via tcUpsertCompanyRow + blob) through mutate_record,
    // for the same reason as the user write above. Without it, a debounced flush can be
    // a "0.1KB / 1 dirty key" no-op that never carries the ~3.7KB companies collection —
    // so the "NEW" company vanished and every refresh bounced back to the company-1
    // snapshot.
    void mutateCollectionRecordToPhp('companies', 'upsert', newCompanyId, { ...newCompany, company_id: newCompanyId }, lastServerVersionRef.current);
    // Force an immediate FULL flush of the registration payload (the 3.7KB companies
    // blob, not the volatile-only 0.1KB flush) so the company persists server-side even
    // if this tab is closed right after registering.
    forceFlushRef.current = true;
    schedulePhpFlush();

    toast.success(t('Registration submitted successfully! A Super Admin will verify your payment shortly.'));
    logAction('Company Registration', `New company "${data.companyName}" registered by ${data.name} (${cleanUsername}). Plan ${data.planName} (${data.planType || 'direct'}) in ${data.currencyCode || 'TZS'} — payment reference ${data.paymentReference} submitted for Super Admin verification.`);

    const regCurrency = data.currencyCode || 'TZS';
    const regRate = regCurrency === 'TZS' ? 1 : (data.exchangeRate || activeExchangeRate || 2600);
    setRegistrationResult({
      companyName: data.companyName,
      userFullName: data.name,
      username: cleanUsername,
      planName: data.planName,
      amountFormatted: formatMoney(data.amount / regRate, regCurrency, regRate),
      paymentChannel: data.paymentMethod,
      paymentRef: data.paymentReference,
      status: 'Awaiting Super Admin Approval'
    });
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, '', '/register-complete');
    }
    } catch (err) {
      console.error('Register submit failed:', err);
      const msg = t('Something went wrong while submitting. Please try again.');
      toast.error(msg);
      return msg;
    }
  };

  // --- HOMEPAGE CONTACT FORM (FAQ & Contact tab) → SMS inquiry report for admins ---
  const handleSubmitContact = (data: { name: string; email: string; phone: string; subject: string; message: string }) => {
    try {
      const newMsg: ContactMessage = {
        id: Date.now(),
        name: data.name.trim(),
        email: data.email.trim(),
        phone: data.phone.trim(),
        subject: data.subject.trim(),
        message: data.message.trim(),
        status: 'new',
        createdAt: new Date().toISOString()
      };
      saveAllData({ contactMessages: [newMsg, ...(contactMessages || [])] });
      logAction('Contact Inquiry', `New contact inquiry "${newMsg.subject}" received from ${newMsg.name} (${newMsg.email}).`);
      toast.success(t('Your message has been sent. Our team will reach out to you shortly.'));
    } catch (err) {
      console.error('Contact submit failed:', err);
      toast.error(t('Something went wrong while sending your message. Please try again.'));
    }
  };

  const handleMarkContactAnswered = (msgId: number) => {
    const updated = (contactMessages || []).map(m => (m.id === msgId ? { ...m, status: 'answered' as const } : m));
    saveAllData({ contactMessages: updated });
    toast.success(t('Inquiry marked as answered.'));
  };

  const handleDeleteContactMessage = (msgId: number) => {
    const updated = (contactMessages || []).filter(m => m.id !== msgId);
    saveAllData({ contactMessages: updated });
    toast.success(t('Inquiry deleted.'));
  };

  // =====================================================================
  // MEGA BUILD — 7 ULTIMATE FEATURES: escrow, chat, visual search,
  // returns/disputes, flash sales/notifications, bulk upload, stories
  // =====================================================================

  // --- F5: NOTIFICATIONS ---
  const pushAppNotification = (n: { audiencePhone?: string; companyId?: number | null; type: AppNotification['type']; title: string; message: string; data?: AppNotification['data'] }) => {
    const cur = dbStateRef.current;
    const notif: AppNotification = { id: Date.now() + Math.floor(Math.random() * 1000), ...n, isRead: false, createdAt: new Date().toISOString() };
    saveAllData({ appNotifications: [notif, ...(cur.appNotifications || [])].slice(0, 200) });
  };

  const markAllNotificationsRead = (identityPhone: string | null) => {
    const cur = dbStateRef.current;
    saveAllData({ appNotifications: (cur.appNotifications || []).map(n => (!n.audiencePhone || n.audiencePhone === identityPhone) && !n.isRead ? { ...n, isRead: true } : n) });
  };

  // --- F5: FLASH SALES ---
  const findActiveFlashItem = (companyId: number, productId: number): FlashSaleItem | undefined => {
    const nowMs = Date.now();
    for (const fs of (flashSales || [])) {
      // Issue 1: a re-sync during company switch can leave undefined holes in the
      // flashSales array; reading fs.startTime on one crashes with
      // "Cannot read properties of undefined (reading 'startTime')". Skip + optional
      // chain every timer field so telemetry/audit cycles stay resilient.
      if (!fs || typeof fs !== 'object') continue;
      if (fs.companyId !== companyId) continue;
      const startMs = fs?.startTime ? new Date(fs.startTime).getTime() : 0;
      const endMs = fs?.endTime ? new Date(fs.endTime).getTime() : Infinity;
      if (fs.status !== 'active' || startMs > nowMs || endMs <= nowMs) continue;
      const item = (fs.items || []).find(i => i && i.productId === productId && i.sold < i.stock);
      if (item) return item;
    }
    return undefined;
  };

  const saveFlashSale = (sale: FlashSale) => {
    const cur = dbStateRef.current;
    const exists = (cur.flashSales || []).some(f => f.id === sale.id);
    const next = exists ? (cur.flashSales || []).map(f => f.id === sale.id ? sale : f) : [sale, ...(cur.flashSales || [])];
    saveAllData({ flashSales: next });
    if (!exists && sale.status === 'active') {
      pushAppNotification({ type: 'flash_sale', title: `Flash Sale: ${sale.title}`, message: 'Limited-time deals — shop now!', companyId: sale.companyId });
    }
  };

  const deleteFlashSale = (id: number) => {
    const cur = dbStateRef.current;
    saveAllData({ flashSales: (cur.flashSales || []).filter(f => f.id !== id) });
  };

  // --- F8: STORIES ---
  const createStory = (payload: { companyId: number; type: 'image' | 'video'; mediaPath: string; caption?: string; productId?: number | null; fileSizeBytes?: number; videoDurationSeconds?: number }) => {
    const now = new Date();
    const story: Story = { id: Date.now(), views: 0, expiresAt: new Date(now.getTime() + 72 * 3600000).toISOString(), isActive: true, createdAt: now.toISOString(), ...payload };
    const cur = dbStateRef.current;
    saveAllData({ stories: [story, ...(cur.stories || [])] });
    forceFlushNow();
    pushAppNotification({ type: 'general', title: 'New Story!', message: `A new story was posted by ${payload.companyId ? 'a seller' : 'a user'}.`, companyId: payload.companyId });
  };

  const deleteStory = (id: number) => {
    const cur = dbStateRef.current;
    saveAllData({ stories: (cur.stories || []).filter(s => s.id !== id) });
  };

  const recordStoryView = (storyId: number, viewerPhone?: string) => {
    const cur = dbStateRef.current;
    const alreadyViewed = (cur.storyViews || []).some(v => v.storyId === storyId && v.viewerPhone && viewerPhone && v.viewerPhone === viewerPhone);
    if (alreadyViewed) return;
    saveAllData({
      stories: (cur.stories || []).map(s => s.id === storyId ? { ...s, views: s.views + 1 } : s),
      storyViews: [{ id: Date.now(), storyId, viewerPhone, viewerType: viewerPhone ? 'buyer' : 'guest', viewedAt: new Date().toISOString() }, ...(cur.storyViews || [])]
    });
  };

  // --- F3: VISUAL SEARCH ---
  const logVisualSearch = (record: VisualSearchRecord) => {
    const cur = dbStateRef.current;
    saveAllData({ visualSearches: [record, ...(cur.visualSearches || [])].slice(0, 300) });
  };

  // --- F2: CHAT ---
  const sendChatMessage = (conversationId: number, senderType: 'buyer' | 'company' | 'admin', senderName: string, input: { text?: string; messageType: 'text' | 'image' | 'product'; imageData?: string; productId?: number }) => {
    const cur = dbStateRef.current;
    const conv = (cur.chatConversations || []).find(c => c.id === conversationId);
    if (!conv) return;
    // --- MEGA BUILD F2 access control (mirrors Laravel abort(403)): only the
    // conversation's OWN buyer or company may post into it. Foreign sends are rejected.
    if (senderType === 'buyer') {
      let buyerPhone: string | null = null;
      try { buyerPhone = localStorage.getItem('tradecore_buyer_phone'); } catch {}
      if (!buyerPhone || conv.buyerPhone !== buyerPhone) return;
    }
    if (senderType === 'company') {
      const ownCompanyId = currentUser?.companyId;
      if (!ownCompanyId || conv.companyId !== ownCompanyId) return;
    }
    const raw = (input.text || '').trim();
    if (input.messageType === 'text' && !raw) return;
    if (input.messageType !== 'text' && !input.imageData && !input.productId) return;
    const originalLang = detectLang(raw);
    const nowIso = new Date().toISOString();
    const msgId = Date.now() + Math.floor(Math.random() * 100);
    const preview = input.messageType === 'image' ? 'Photo' : input.messageType === 'product' ? 'Product' : raw.slice(0, 80);
    const msg: ChatMessage = { id: msgId, conversationId, senderType, senderName, message: raw, messageType: input.messageType, productId: input.productId ?? null, imageData: input.imageData, isRead: false, originalLang, createdAt: nowIso };
    const updatedConvs = (cur.chatConversations || []).map(c => c.id === conversationId ? {
      ...c, lastMessage: preview, lastMessageAt: nowIso,
      unreadBuyer: senderType === 'company' || senderType === 'admin' ? c.unreadBuyer + 1 : c.unreadBuyer,
      unreadCompany: senderType === 'buyer' ? c.unreadCompany + 1 : c.unreadCompany,
    } : c);
    const notif: AppNotification = {
      id: msgId + 1,
      ...(senderType === 'buyer' ? { companyId: conv.companyId } : { audiencePhone: conv.buyerPhone }),
      type: 'new_message', title: senderType === 'buyer' ? `New message — ${senderName}` : `New message — ${conv.buyerName}`, message: preview,
      data: { conversationId }, isRead: false, createdAt: nowIso
    };
    saveAllData({
      chatConversations: updatedConvs,
      chatMessages: [msg, ...(cur.chatMessages || [])],
      appNotifications: [notif, ...(cur.appNotifications || [])]
    });
    forceFlushNow();
    if (raw) {
      translateText(raw, originalLang, originalLang === 'sw' ? 'en' : 'sw')
        .then(translated => {
          if (translated) {
            const fresh = dbStateRef.current;
            saveAllData({ chatMessages: (fresh.chatMessages || []).map(m => m.id === msgId ? { ...m, translatedMessage: translated } : m) });
          }
        })
        .catch(() => {});
    }
  };

  const startChatConversation = (companyId: number, buyerName: string, buyerPhone: string, productId?: number | null): number => {
    const cur = dbStateRef.current;
    const existing = (cur.chatConversations || []).find(c => c.companyId === companyId && c.buyerPhone === buyerPhone);
    if (existing) return existing.id;
    const conv: ChatConversation = { id: Date.now(), buyerPhone, buyerName: buyerName.trim() || 'Mteja', companyId, productId: productId ?? null, lastMessage: '', lastMessageAt: new Date().toISOString(), unreadBuyer: 0, unreadCompany: 0, createdAt: new Date().toISOString() };
    saveAllData({ chatConversations: [conv, ...(cur.chatConversations || [])] });
    return conv.id;
  };

  const markChatRead = (conversationId: number, viewer: 'buyer' | 'company') => {
    const cur = dbStateRef.current;
    const updatedConvs = (cur.chatConversations || []).map(c => c.id === conversationId ? { ...c, unreadBuyer: viewer === 'buyer' ? 0 : c.unreadBuyer, unreadCompany: viewer === 'company' ? 0 : c.unreadCompany } : c);
    const updatedMsgs = (cur.chatMessages || []).map(m => m.conversationId === conversationId && m.senderType !== viewer && !m.isRead ? { ...m, isRead: true } : m);
    saveAllData({ chatConversations: updatedConvs, chatMessages: updatedMsgs });
  };

  // --- F1: ESCROW / MOBILE MONEY ---
  const confirmSimulatedPayment = (orderNumber: string) => {
    const cur = dbStateRef.current;
    const order = (cur.marketplaceOrders || []).find(o => o.orderNumber === orderNumber);
    if (!order || order.paymentStatus !== 'processing') return;
    const nowIso = new Date().toISOString();
    const txId = simulateTxId(order.paymentMethodType || 'm_pesa');
    const escrowAmt = order.amountPaid || order.totalAmount;
    saveAllData({
      marketplaceOrders: (cur.marketplaceOrders || []).map(o => o.orderNumber === orderNumber ? {
        ...o, status: 'verified' as MarketplaceOrder['status'], paymentStatus: 'completed',
        transactionId: txId, escrowStatus: 'held' as EscrowStatus, escrowAmount: escrowAmt, mpesaTransactionId: txId
      } : o),
      escrowTransactions: [{ id: Date.now(), orderId: order.id, orderNumber, buyerId: order.customerId, companyId: order.companyId, amount: escrowAmt, status: 'held', method: (order.paymentMethodType || 'm_pesa') as MegaPaymentMethod, heldAt: nowIso, createdAt: nowIso }, ...(cur.escrowTransactions || [])],
      appNotifications: [
        { id: Date.now() + 1, audiencePhone: order.customerPhone, type: 'order_update', title: 'Payment complete', message: `Payment for Order #${orderNumber} received. Funds held safely in escrow.`, isRead: false, createdAt: nowIso },
        { id: Date.now() + 2, companyId: order.companyId, type: 'order_update', title: `Payment confirmed — #${orderNumber}`, message: `${order.customerName}: TZS ${escrowAmt.toLocaleString()} held in escrow. Start shipping.`, isRead: false, createdAt: nowIso }
      ]
    });
    logAction('Escrow Held', `Simulated ${(order.paymentMethodType || 'm_pesa').toUpperCase()} confirmed for ${orderNumber} — TZS ${escrowAmt.toLocaleString()} held.`);
  };

  const releaseEscrowToSeller = (orderId: number, source: 'buyer_confirm' | 'auto_48h' | 'admin'): { ok: boolean; error?: string } => {
    const cur = dbStateRef.current;
    const order = (cur.marketplaceOrders || []).find(o => o.id === orderId);
    if (!order) return { ok: false, error: 'Order not found.' };
    if (order.escrowStatus !== 'held') return { ok: false, error: 'Escrow not held.' };
    const nowIso = new Date().toISOString();
    const pct = order.commissionPercent ?? 0;
    const payout = pct > 0 ? Math.round((order.totalAmount - (order.commissionAmount ?? 0)) * 100) / 100 : order.totalAmount;
    let walletsNext = [...(cur.wallets || [])];
    let txnsNext = [...(cur.walletTransactions || [])];
    let wallet = walletsNext.find(w => w.companyId === order.companyId);
    if (!wallet) { wallet = { id: Date.now(), companyId: order.companyId, balance: 0, totalEarned: 0, totalWithdrawn: 0, updatedAt: nowIso }; walletsNext.push(wallet); }
    walletsNext = walletsNext.map(w => w.companyId === order.companyId ? { ...w, balance: Math.round((w.balance + payout) * 100) / 100, totalEarned: Math.round((w.totalEarned + payout) * 100) / 100, updatedAt: nowIso } : w);
    txnsNext = [{ id: Date.now() + 1, walletId: wallet.id, companyId: order.companyId, type: 'credit' as WalletTransaction['type'], amount: payout, description: `Escrow release — #${order.orderNumber}`, orderId: order.id, status: 'completed' as WalletTransaction['status'], createdAt: nowIso }, ...txnsNext];
    saveAllData({
      marketplaceOrders: (cur.marketplaceOrders || []).map(o => o.id === orderId ? { ...o, escrowStatus: 'released' as EscrowStatus, escrowReleasedAt: nowIso } : o),
      wallets: walletsNext, walletTransactions: txnsNext,
      escrowTransactions: (cur.escrowTransactions || []).map(e => e.orderId === orderId && e.status === 'held' ? { ...e, status: 'released' as EscrowStatus, releasedAt: nowIso } : e),
      appNotifications: [
        { id: Date.now() + 2, audiencePhone: order.customerPhone, type: 'order_update', title: 'Escrow released', message: `Funds for Order #${order.orderNumber} have been released to the seller. Thank you for your purchase!`, isRead: false, createdAt: nowIso },
        { id: Date.now() + 3, companyId: order.companyId, type: 'order_update', title: `Funds released — #${order.orderNumber}`, message: `TZS ${payout.toLocaleString()} deposited to your wallet (${source}).`, isRead: false, createdAt: nowIso }
      ]
    });
    logAction('Escrow Released', `Order ${order.orderNumber} released to seller via ${source} — payout TZS ${payout.toLocaleString()}.`);
    return { ok: true };
  };

  const confirmCodReceipt = (orderId: number): { ok: boolean; error?: string } => {
    const cur = dbStateRef.current;
    const order = (cur.marketplaceOrders || []).find(o => o.id === orderId);
    if (!order) return { ok: false, error: 'Order not found.' };
    if (order.paymentMethodType !== 'cod') return { ok: false, error: 'Not a COD order.' };
    const nowIso = new Date().toISOString();
    saveAllData({
      marketplaceOrders: (cur.marketplaceOrders || []).map(o => o.id === orderId ? { ...o, codConfirmed: true, deliveredAt: o.deliveredAt || nowIso } : o),
      appNotifications: [{ id: Date.now(), audiencePhone: order.customerPhone, type: 'order_update', title: 'COD confirmed', message: `Cash payment for Order #${order.orderNumber} confirmed.`, isRead: false, createdAt: nowIso }]
    });
    logAction('COD Confirmed', `Cash received confirmed for Order #${order.orderNumber}.`);
    return { ok: true };
  };

  // --- F4: RETURNS & DISPUTES ---
  const openDisputeFromBuyer = (order: MarketplaceOrder, input: { reason: ReturnReason; description: string; images: string[]; desiredSolution: 'refund' | 'replacement' }): { ok: boolean; error?: string } => {
    const cur = dbStateRef.current;
    const nowIso = new Date().toISOString();
    const summary = `[Suluhisho: ${input.desiredSolution === 'refund' ? 'Rudisha pesa' : 'Badilisha'}] [Picha: ${input.images.length}]`;
    const ret: ProductReturn = { id: Date.now(), orderId: order.id, orderNumber: order.orderNumber, buyerId: order.customerId, buyerPhone: order.customerPhone, buyerName: order.customerName, companyId: order.companyId, reason: input.reason, description: `${summary}\n${input.description}`, images: input.images.length > 0 ? input.images : undefined, desiredSolution: input.desiredSolution, status: 'pending', createdAt: nowIso };
    const dispute: Dispute = { id: Date.now() + 10, orderId: order.id, orderNumber: order.orderNumber, returnId: ret.id, buyerPhone: order.customerPhone, buyerName: order.customerName, companyId: order.companyId, reason: input.reason, description: input.description, status: 'open', escrowFrozen: order.escrowStatus === 'held', createdAt: nowIso };
    const dmsg: DisputeMessage = { id: Date.now() + 11, disputeId: dispute.id, senderType: 'buyer', senderName: order.customerName, message: input.description, createdAt: nowIso };
    const patchOrders = order.escrowStatus === 'held'
      ? (cur.marketplaceOrders || []).map(o => o.id === order.id ? { ...o, escrowStatus: 'disputed' as EscrowStatus } : o)
      : cur.marketplaceOrders;
    saveAllData({
      marketplaceOrders: patchOrders, productReturns: [ret, ...(cur.productReturns || [])],
      disputes: [dispute, ...(cur.disputes || [])], disputeMessages: [dmsg, ...(cur.disputeMessages || [])],
      appNotifications: [{ id: Date.now() + 20, companyId: order.companyId, type: 'dispute', title: `Dispute — #${order.orderNumber}`, message: `${order.customerName}: ${input.reason}`, data: { orderId: order.id, disputeId: dispute.id }, isRead: false, createdAt: nowIso }]
    });
    logAction('Dispute Opened', `Buyer ${order.customerName} opened dispute on #${order.orderNumber}: ${input.reason}.`);
    return { ok: true };
  };

  const respondToReturn = (returnId: number, approve: boolean, note?: string) => {
    const cur = dbStateRef.current;
    const ret = (cur.productReturns || []).find(r => r.id === returnId);
    if (!ret || ret.status !== 'pending') return;
    const nowIso = new Date().toISOString();
    const newStatus = approve ? 'refunded' as ProductReturn['status'] : 'rejected' as ProductReturn['status'];
    const updatedReturns = (cur.productReturns || []).map(r => r.id === returnId ? { ...r, status: newStatus, responseNote: note, respondedAt: nowIso, refundAmount: approve ? (ret.refundAmount || (cur.marketplaceOrders || []).find(o => o.id === ret.orderId)?.totalAmount) : undefined } : r);
    const patch: Partial<typeof dbStateRef.current> = { productReturns: updatedReturns, appNotifications: [{ id: Date.now(), audiencePhone: ret.buyerPhone, type: 'order_update', title: `Rudisho #${ret.orderNumber} ${approve ? 'limekubaliwa' : ' limekataliwa'}`, message: approve ? 'Pesa zitarudishwa. Tafadhali subiri.' : (note || 'Muuzaji amekataa ombi la kurejesha.'), isRead: false, createdAt: nowIso }, ...(cur.appNotifications || [])] };
    if (approve) {
      const order = (cur.marketplaceOrders || []).find(o => o.id === ret.orderId);
      if (order && order.escrowStatus === 'held') {
        patch.marketplaceOrders = (cur.marketplaceOrders || []).map(o => o.id === ret.orderId ? { ...o, escrowStatus: 'refunded' as EscrowStatus, escrowReleasedAt: nowIso } : o);
        patch.escrowTransactions = (cur.escrowTransactions || []).map(e => e.orderId === ret.orderId && e.status === 'held' ? { ...e, status: 'refunded' as EscrowStatus, refundedAt: nowIso } : e);
      }
    }
    saveAllData(patch);
    logAction(approve ? 'Return Approved' : 'Return Rejected', `Return for #${ret.orderNumber} ${approve ? 'approved' : 'rejected'}.`);
  };

  const setDisputeUnderReview = (disputeId: number, note?: string) => {
    const cur = dbStateRef.current;
    saveAllData({ disputes: (cur.disputes || []).map(d => d.id === disputeId ? { ...d, status: 'under_review' as Dispute['status'], adminNotes: note || d.adminNotes } : d) });
  };

  const addDisputeReply = (disputeId: number, message: string) => {
    const cur = dbStateRef.current;
    const dmsg: DisputeMessage = { id: Date.now(), disputeId, senderType: 'admin', senderName: 'ROOT Admin', message, createdAt: new Date().toISOString() };
    saveAllData({ disputeMessages: [dmsg, ...(cur.disputeMessages || [])], disputes: (cur.disputes || []).map(d => d.id === disputeId ? { ...d, adminNotes: message } : d) });
  };

  const resolveDispute = (disputeId: number, outcome: 'buyer' | 'seller', resolutionText: string) => {
    const cur = dbStateRef.current;
    const dispute = (cur.disputes || []).find(d => d.id === disputeId);
    if (!dispute) return;
    const nowIso = new Date().toISOString();
    const newStatus = outcome === 'buyer' ? 'resolved_buyer' as Dispute['status'] : 'resolved_seller' as Dispute['status'];
    const patch: Partial<typeof dbStateRef.current> = {
      disputes: (cur.disputes || []).map(d => d.id === disputeId ? { ...d, status: newStatus, resolution: resolutionText, resolvedAt: nowIso } : d),
      appNotifications: [
        { id: Date.now() + 1, audiencePhone: dispute.buyerPhone, type: 'dispute', title: `Mgogoro #${dispute.orderNumber} umemalizwa`, message: outcome === 'buyer' ? `Umeshinda. Pesa zinarudishwa. ${resolutionText}` : `Muuzaji ameshinda. ${resolutionText}`, data: { disputeId }, isRead: false, createdAt: nowIso },
        { id: Date.now() + 2, companyId: dispute.companyId, type: 'dispute', title: `Mgogoro #${dispute.orderNumber} umemalizwa`, message: outcome === 'seller' ? `Umeshinda mgogoro. ${resolutionText}` : `Mteja ameshinda. Pesa zimerudishwa. ${resolutionText}`, data: { disputeId }, isRead: false, createdAt: nowIso },
        ...(cur.appNotifications || [])
      ]
    };
    if (outcome === 'buyer') {
      const order = (cur.marketplaceOrders || []).find(o => o.id === dispute.orderId);
      if (order && order.escrowStatus === 'held') {
        patch.marketplaceOrders = (cur.marketplaceOrders || []).map(o => o.id === dispute.orderId ? { ...o, escrowStatus: 'refunded' as EscrowStatus, escrowReleasedAt: nowIso } : o);
        patch.escrowTransactions = (cur.escrowTransactions || []).map(e => e.orderId === dispute.orderId && e.status === 'held' ? { ...e, status: 'refunded' as EscrowStatus, refundedAt: nowIso } : e);
      }
    } else {
      const order = (cur.marketplaceOrders || []).find(o => o.id === dispute.orderId);
      if (order && order.escrowStatus === 'held') { releaseEscrowToSeller(dispute.orderId, 'admin'); return; }
    }
    saveAllData(patch);
    logAction('Dispute Resolved', `Dispute #${disputeId} resolved in favor of ${outcome}.`);
  };

  // --- F6: BULK UPLOAD COMMIT ---
  const commitBulkProduct = (product: MarketplaceProduct) => {
    const cur = dbStateRef.current;
    const exists = (cur.marketplaceProducts || []).some(p => p.id === product.id);
    const updated = exists ? (cur.marketplaceProducts || []).map(p => p.id === product.id ? product : p) : [...(cur.marketplaceProducts || []), product];
    // Optimistic local
    dbStateRef.current.marketplaceProducts = updated;
    setMarketplaceProducts(updated);
    void apiUpsertProduct(product).catch(() => { saveAllData({ marketplaceProducts: updated }); forceFlushNow(); });
  };

  // --- MEGA BUILD CRON: escrow auto-release, flash transitions, return auto-approve, story expiry ---
  useEffect(() => {
    const runCron = () => {
      const cur = dbStateRef.current;
      const nowMs = Date.now();
      const nowIso = new Date().toISOString();
      const patch: Partial<typeof dbStateRef.current> = {};
      let touched = false;

      // 1) Escrow auto-release (48h after delivery)
      const dueOrders = (cur.marketplaceOrders || []).filter(o => o.escrowStatus === 'held' && o.autoReleaseAt && new Date(o.autoReleaseAt).getTime() <= nowMs);
      if (dueOrders.length > 0) {
        let walletsNext = [...(cur.wallets || [])];
        let txnsNext = [...(cur.walletTransactions || [])];
        const releasedIds = new Set<number>();
        for (const order of dueOrders) {
          releasedIds.add(order.id);
          const pct = order.commissionPercent ?? 0;
          const payout = pct > 0 ? Math.round((order.totalAmount - (order.commissionAmount ?? 0)) * 100) / 100 : order.totalAmount;
          let wallet = walletsNext.find(w => w.companyId === order.companyId);
          if (!wallet) { wallet = { id: Date.now() + order.id, companyId: order.companyId, balance: 0, totalEarned: 0, totalWithdrawn: 0, updatedAt: nowIso }; walletsNext.push(wallet); }
          walletsNext = walletsNext.map(w => w.companyId === order.companyId ? { ...w, balance: Math.round((w.balance + payout) * 100) / 100, totalEarned: Math.round((w.totalEarned + payout) * 100) / 100, updatedAt: nowIso } : w);
          txnsNext = [{ id: Date.now() + order.id, walletId: wallet.id, companyId: order.companyId, type: 'credit' as WalletTransaction['type'], amount: payout, description: `Auto-release 48h — #${order.orderNumber}`, orderId: order.id, status: 'completed' as WalletTransaction['status'], createdAt: nowIso }, ...txnsNext];
        }
        patch.marketplaceOrders = (cur.marketplaceOrders || []).map(o => releasedIds.has(o.id) ? { ...o, escrowStatus: 'released' as EscrowStatus, escrowReleasedAt: nowIso } : o);
        patch.wallets = walletsNext;
        patch.walletTransactions = txnsNext;
        patch.escrowTransactions = (cur.escrowTransactions || []).map(e => releasedIds.has(e.orderId) && e.status === 'held' ? { ...e, status: 'released' as EscrowStatus, releasedAt: nowIso } : e);
        const autoNotifs: AppNotification[] = dueOrders.flatMap(o => [
          { id: Date.now() + o.id, audiencePhone: o.customerPhone, type: 'order_update' as AppNotification['type'], title: 'Escrow released', message: `Funds for Order #${o.orderNumber} released to seller (48h).`, isRead: false, createdAt: nowIso },
          { id: Date.now() + o.id + 1, companyId: o.companyId, type: 'order_update' as AppNotification['type'], title: `Auto-release — #${o.orderNumber}`, message: '48h elapsed — funds deposited to your wallet.', isRead: false, createdAt: nowIso }
        ]);
        patch.appNotifications = [...autoNotifs, ...(cur.appNotifications || [])];
        touched = true;
      }

      // 2) Flash sale transitions — guard against undefined/null entries in flashSales
      const salesUpdate = (cur.flashSales || []).filter(f => {
        if (!f || !f.startTime || !f.endTime) return false;
        const startT = new Date(f.startTime).getTime();
        const endT = new Date(f.endTime).getTime();
        if (f.status === 'upcoming' && startT <= nowMs && endT > nowMs) return true;
        if (f.status === 'active' && endT <= nowMs) return true;
        return false;
      });
      if (salesUpdate.length > 0) {
        patch.flashSales = (cur.flashSales || []).map(f => {
          if (!f || !f.startTime || !f.endTime) return f;
          const startT = new Date(f.startTime).getTime(); const endT = new Date(f.endTime).getTime();
          if (f.status === 'upcoming' && startT <= nowMs && endT > nowMs) return { ...f, status: 'active' as FlashSale['status'] };
          if ((f.status === 'active' || f.status === 'upcoming') && endT <= nowMs) return { ...f, status: 'ended' as FlashSale['status'] };
          return f;
        });
        const wentLive = salesUpdate.filter(f => f.status === 'upcoming');
        if (wentLive.length > 0) {
          const flashNotifs: AppNotification[] = wentLive.flatMap(f => f.items.slice(0, 3).map(it => ({ id: Date.now() + it.productId, type: 'flash_sale' as AppNotification['type'], title: `🔥 ${f.title} is live!`, message: `${it.productName} for TZS ${it.flashPrice.toLocaleString()} — ${it.discountPercent}% OFF!`, data: { productId: it.productId }, isRead: false, createdAt: nowIso })));
          patch.appNotifications = [...flashNotifs, ...(patch.appNotifications || cur.appNotifications || [])];
        }
        touched = true;
      }

      // 3) Auto-approve returns after 72h
      const dueReturns = (cur.productReturns || []).filter(r => r.status === 'pending' && new Date(r.createdAt).getTime() + 72 * 3600000 <= nowMs);
      if (dueReturns.length > 0) {
        const dueIds = new Set(dueReturns.map(r => r.id));
        patch.productReturns = (cur.productReturns || []).map(r => dueIds.has(r.id) ? { ...r, status: 'refunded' as ProductReturn['status'], responseNote: 'Auto-approved: muuzaji hajajibu ndani ya saa 72.', respondedAt: nowIso } : r);
        const retOrderIds = new Set(dueReturns.map(r => r.orderId));
        const heldOrders = (cur.marketplaceOrders || []).filter(o => retOrderIds.has(o.id) && o.escrowStatus === 'held');
        if (heldOrders.length > 0) {
          const refundIds = new Set(heldOrders.map(o => o.id));
          patch.marketplaceOrders = (patch.marketplaceOrders || cur.marketplaceOrders || []).map(o => refundIds.has(o.id) ? { ...o, escrowStatus: 'refunded' as EscrowStatus, escrowReleasedAt: nowIso } : o);
          patch.escrowTransactions = (cur.escrowTransactions || []).map(e => refundIds.has(e.orderId) && e.status === 'held' ? { ...e, status: 'refunded' as EscrowStatus, refundedAt: nowIso } : e);
        }
        const returnNotifs: AppNotification[] = dueReturns.map(r => ({ id: Date.now() + r.id, audiencePhone: r.buyerPhone, type: 'dispute' as AppNotification['type'], title: `Return #${r.orderNumber} approved`, message: 'Seller did not respond within 72h — your request has been approved.', isRead: false, createdAt: nowIso }));
        patch.appNotifications = [...returnNotifs, ...(patch.appNotifications || cur.appNotifications || [])];
        touched = true;
      }

      // 4) Story expiry cleanup
      const expired = (cur.stories || []).filter(s => s.isActive && new Date(s.expiresAt).getTime() <= nowMs);
      if (expired.length > 0) {
        patch.stories = (cur.stories || []).map(s => new Date(s.expiresAt).getTime() <= nowMs ? { ...s, isActive: false } : s);
        touched = true;
      }

      // --- MEGA CRITICAL FIX PART 1: expire stale Piga Bei offers (pending/countered past expires_at) ---
      const staleOffers = (cur.offers || []).filter(o =>
        (o.status === 'pending' || o.status === 'countered') && new Date(o.expiresAt).getTime() <= nowMs);
      if (staleOffers.length > 0) {
        const staleIds = new Set(staleOffers.map(o => o.id));
        patch.offers = (cur.offers || []).map(o => staleIds.has(o.id) ? { ...o, status: 'expired' as OfferStatus } : o);
        touched = true;
        const expiryNotifs: AppNotification[] = [];
        for (const o of staleOffers) {
          expiryNotifs.push({ id: Date.now() + o.id, audiencePhone: o.customerPhone, type: 'offer_update', title: 'Offer expired', message: `Your offer of TZS ${o.offeredPrice.toLocaleString()} (product #${o.productId}) has expired. You can make a new offer.`, isRead: false, createdAt: nowIso });
          expiryNotifs.push({ id: Date.now() + o.id + 1, companyId: o.companyId, type: 'offer_update', title: `Offer expired — ${o.customerName}`, message: `Offer of TZS ${o.offeredPrice.toLocaleString()} on product #${o.productId} expired with no response.`, isRead: false, createdAt: nowIso });
        }
        patch.appNotifications = [...expiryNotifs, ...(cur.appNotifications || [])];
      }

      if (touched) saveAllData(patch);
    };
    const id = window.setInterval(runCron, 45000);
    runCron();
    return () => window.clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ===== PUBLIC MARKETPLACE =====
  const generateOrderNumber = (): string => {
    const year = new Date().getFullYear();
    for (let i = 0; i < 100; i++) {
      const rand = Math.floor(10000 + Math.random() * 90000);
      const candidate = `TRD-${year}-${rand}`;
      if (!(marketplaceOrders || []).some(o => o.orderNumber === candidate)) return candidate;
    }
    return `TRD-${year}-${Date.now() % 100000}`;
  };

  const submitMarketplaceOrder = (data: {
    companyId: number;
    items: { productId: number; quantity: number }[];
    customerName: string;
    customerPhone: string;
    customerRegion: string;
    customerDistrict: string;
    customerWard: string;
    customerStreet: string;
    deliveryInstructions?: string;
    latitude?: number;
    longitude?: number;
    paymentMethodType: string;
    transactionId: string;
    amountPaid: number;
    receiptImage?: string;
    createAccount: boolean;
    email?: string;
    password?: string;
    // --- MEGA Phase 2B: collection-linked orders ---
    paymentStatus?: string; // 'manual_pending_approval' | 'processing' | 'completed' | 'failed'
    collectionReference?: string; // COL-... created by the collection flow
    deferWalletCredit?: boolean; // true = money goes to admin first; wallet credited after ROOT approves / webhook confirms
    // --- MEGA BUILD F1: escrow + mobile money ---
    escrowMethod?: MegaPaymentMethod;
    paymentPhone?: string;
    // --- Shipping ---
    shippingZoneId?: number;
    shippingZoneName?: string;
    shippingFee?: number;
  }): { ok: boolean; orderNumber?: string; error?: string; stkInitiated?: boolean } => {
    try {
      const company = companies.find(c => c.id === data.companyId);
      if (!company) return { ok: false, error: t('Company not found.') };

      // Validate all products belong to the company and stock is sufficient
      const products = marketplaceProducts.filter(p => p.companyId === data.companyId && p.isActive !== false && (p.status === undefined || p.status === 'approved'));
      const items: MarketplaceOrderItem[] = [];
      for (const it of data.items) {
        const prod = products.find(p => p.id === it.productId);
        if (!prod) return { ok: false, error: t('One of the products is no longer available.') };
        if (it.quantity < 1) return { ok: false, error: t('Invalid quantity.') };
        if ((prod.stockQuantity || 0) < it.quantity) return { ok: false, error: `${prod.name} — ${t('out of stock')}.` };
        const flashHit = findActiveFlashItem(data.companyId, prod.id);
        const unitPrice = flashHit ? flashHit.flashPrice : prod.price;
        items.push({
          productId: prod.id,
          productName: prod.name,
          productImage: prod.image || undefined,
          quantity: it.quantity,
          unitPrice,
          subtotal: unitPrice * it.quantity
        });
      }
      const totalAmount = items.reduce((sum, i) => sum + i.subtotal, 0) + (data.shippingFee || 0);

      // Find or create the customer (guest or permanent account)
      const phone = data.customerPhone.trim();
      let customer = marketplaceCustomers.find(c => c.phone === phone);
      let customersUpdated = marketplaceCustomers;
      const nowIso = new Date().toISOString();
      if (!customer) {
        customer = {
          id: Math.max(0, ...(marketplaceCustomers || []).map(c => c.id)) + 1,
          name: data.customerName.trim(),
          phone,
          email: data.email?.trim() || undefined,
          password: data.createAccount && data.password ? hashPassword(data.password) : undefined,
          region: data.customerRegion,
          district: data.customerDistrict,
          ward: data.customerWard,
          street: data.customerStreet,
          latitude: data.latitude,
          longitude: data.longitude,
          isGuest: !data.createAccount,
          locale: 'en',
          createdAt: nowIso
        };
        customersUpdated = [...customersUpdated, customer];
      } else if (data.createAccount) {
        // Upgrade existing (guest) customer to a permanent account
        const upgraded: MarketplaceCustomer = {
          ...customer,
          name: data.customerName.trim(),
          email: data.email?.trim() || customer.email,
          password: data.password ? hashPassword(data.password) : customer.password,
          isGuest: false,
          locale: 'en'
        };
        customersUpdated = customersUpdated.map(c => (c.id === upgraded.id ? upgraded : c));
        customer = upgraded;
      }

      const orderNumber = generateOrderNumber();
      // Commission snapshot: commission plans deduct the seller's subscription commission %
      // from the order; direct plans carry 0% (customer pays the seller directly).
      const commissionPercent = company.planType === 'direct' ? 0 : (company.commissionPercentSnapshot ?? 0);
      const commissionAmount = totalAmount * (commissionPercent / 100);
      // --- MEGA BUILD F1: determine escrow mode ---
      const ESCROW_MOBILE_METHODS: MegaPaymentMethod[] = ['m_pesa', 'tigo_pesa', 'airtel_money', 'halopesa'];
      const isEscrowMobile = !!data.escrowMethod && ESCROW_MOBILE_METHODS.includes(data.escrowMethod);
      const isCodOrder = data.escrowMethod === 'cod';
      const effectiveDeferWalletCredit = isEscrowMobile ? true : (data.deferWalletCredit || false);
      const newOrder: MarketplaceOrder = {
        id: Date.now(),
        orderNumber,
        companyId: data.companyId,
        customerId: customer.id,
        customerName: data.customerName.trim(),
        customerPhone: phone,
        customerRegion: data.customerRegion,
        customerDistrict: data.customerDistrict,
        customerWard: data.customerWard,
        customerStreet: data.customerStreet,
        deliveryInstructions: data.deliveryInstructions?.trim() || undefined,
        latitude: data.latitude,
        longitude: data.longitude,
        totalAmount,
        amountPaid: data.amountPaid,
        paymentMethodType: data.paymentMethodType,
        transactionId: data.transactionId.trim(),
        receiptImage: data.receiptImage || undefined,
        status: isEscrowMobile ? 'pending_verification' : 'pending_verification',
        items,
        customerType: data.createAccount ? 'account' : 'guest',
        createdAt: nowIso,
        commissionPercent,
        commissionAmount: commissionPercent > 0 ? commissionAmount : undefined,
        payToSellerDone: false,
        paymentStatus: isEscrowMobile ? 'processing' : data.paymentStatus,
        collectionReference: data.collectionReference,
        paymentPhone: data.paymentPhone || undefined,
        codConfirmed: isCodOrder ? false : undefined,
        shippingZoneId: data.shippingZoneId,
        shippingZoneName: data.shippingZoneName,
        shippingFee: data.shippingFee,
      };

      // Decrement product stock on order placement
      const updatedProducts = marketplaceProducts.map(p => {
        const it = data.items.find(i => i.productId === p.id);
        if (it) return { ...p, stockQuantity: Math.max(0, (p.stockQuantity || 0) - it.quantity) };
        return p;
      });

      // MEGA Phase 1 — Wallet: credit seller (order total − platform commission) on commission plans.
      // Phase 2B: when deferWalletCredit is set the money stays with the platform until the
      // collection is approved (manual) or confirmed (auto webhook) — see completeCollection().
      let nextWallets = wallets || [];
      let nextWalletTxns = walletTransactions || [];
      if (commissionPercent > 0 && commissionAmount > 0 && !effectiveDeferWalletCredit) {
        const sellerPayout = totalAmount - commissionAmount;
        let wallet = nextWallets.find(w => w.companyId === data.companyId);
        if (!wallet) {
          wallet = { id: Date.now(), companyId: data.companyId, balance: 0, totalEarned: 0, totalWithdrawn: 0, updatedAt: nowIso };
          nextWallets = [...nextWallets, wallet];
        }
        const nextBalance = Math.round((wallet.balance + sellerPayout) * 100) / 100;
        nextWallets = nextWallets.map(w => w.id === wallet!.id
          ? { ...w, balance: nextBalance, totalEarned: Math.round((w.totalEarned + sellerPayout) * 100) / 100, updatedAt: nowIso }
          : w);
        nextWalletTxns = [{
          id: Date.now(),
          walletId: wallet.id,
          companyId: data.companyId,
          type: 'credit',
          amount: sellerPayout,
          description: `Mauzo ya Order #${newOrder.orderNumber}`,
          orderId: newOrder.id,
          status: 'completed',
          createdAt: nowIso
        }, ...nextWalletTxns];
        logAction('Wallet Credit', `Commission order ${orderNumber} (TZS ${totalAmount.toLocaleString()}) — credited seller ${company.name} ${sellerPayout.toLocaleString()} TZS.`);
      }

      // MEGA Phase 1 + ULTIMATE — Affiliate/Wakala: credit referrer commission on orders.
      // Commission % = per-product override → per-company default → global default.
      let nextAffiliates = affiliates || [];
      let nextAffiliateSales = affiliateSales || [];
      const refCode = readAffiliateRefCookie();
      const affiliateByCode = refCode ? nextAffiliates.find(a => a.referralCode.toLowerCase() === refCode.toLowerCase() && a.isActive) : undefined;
      if (affiliateByCode) {
        const globalPct = settings.affiliateCommissionPercent ?? settings.affiliateDefaultPercent ?? defaultAffiliateCommissionPercent;
        const companyPct = company.defaultAffiliatePercent ?? globalPct;
        let affCommission = 0;
        let weightedPct = companyPct;
        let productId: number | null = null;
        const itemsForPct = newOrder.items || [];
        for (const it of itemsForPct) {
          const prod = marketplaceProducts.find(p => p.id === it.productId);
          const pct = prod?.affiliateCommissionPercent ?? companyPct;
          affCommission += Math.round((it.subtotal || it.quantity * it.unitPrice) * (pct / 100) * 100) / 100;
          productId = it.productId;
        }
        if (itemsForPct.length > 0) {
          const totalBasis = itemsForPct.reduce((s, it) => s + (it.subtotal || it.quantity * it.unitPrice), 0);
          weightedPct = totalBasis > 0 ? Math.round((affCommission / totalBasis) * 10000) / 100 : companyPct;
        } else {
          affCommission = Math.round(totalAmount * (companyPct / 100) * 100) / 100;
        }
        if (affCommission > 0) {
          nextAffiliateSales = [{
            id: Date.now(),
            affiliateId: affiliateByCode.id,
            orderId: newOrder.id,
            orderNumber,
            companyId: data.companyId,
            productId,
            amount: totalAmount,
            commissionAmount: affCommission,
            commissionPercent: weightedPct,
            status: 'pending',
            createdAt: nowIso
          }, ...nextAffiliateSales];
          nextAffiliates = nextAffiliates.map(a => a.id === affiliateByCode.id
            ? { ...a, balance: Math.round((a.balance + affCommission) * 100) / 100, totalEarned: Math.round((a.totalEarned + affCommission) * 100) / 100, totalSales: (a.totalSales || 0) + 1 }
            : a);
          logAction('Affiliate Commission', `Referral ${affiliateByCode.referralCode} earned ${affCommission.toLocaleString()} TZS on order ${orderNumber}.`);
        }
      }

      // Link the collection record (if any) to the freshly created order so ROOT can approve it in context.
      let nextCollections = collections || [];
      if (data.collectionReference) {
        nextCollections = nextCollections.map(c => c.reference === data.collectionReference
          ? { ...c, orderId: newOrder.id, updatedAt: nowIso }
          : c);
      }

      // --- MEGA BUILD F5: increment flash sale sold counts for flash-priced items ---
      let updatedFlashSales = [...(flashSales || [])];
      for (const item of items) {
        const fsIdx = updatedFlashSales.findIndex(fs => fs.companyId === data.companyId && fs.items.some(fi => fi.productId === item.productId && fi.sold < fi.stock));
        if (fsIdx >= 0) {
          updatedFlashSales = updatedFlashSales.map((fs, idx) => idx === fsIdx ? {
            ...fs,
            items: fs.items.map(fi => fi.productId === item.productId && fi.sold < fi.stock ? { ...fi, sold: fi.sold + item.quantity } : fi)
          } : fs);
        }
      }

      saveAllData({
        marketplaceOrders: [newOrder, ...marketplaceOrders],
        marketplaceCustomers: customersUpdated,
        marketplaceProducts: updatedProducts,
        wallets: nextWallets,
        walletTransactions: nextWalletTxns,
        affiliates: nextAffiliates,
        affiliateSales: nextAffiliateSales,
        collections: nextCollections,
        flashSales: updatedFlashSales,
      });
      forceFlushNow();
      logAction('Marketplace Order', `New marketplace order ${orderNumber} (${data.customerName}, ${phone}) — TZS ${totalAmount.toLocaleString()} for ${company.name}.`);

      // --- MEGA BUILD F1: schedule simulated STK push confirmation ---
      if (isEscrowMobile) {
        const targetOrderNumber = orderNumber;
        window.setTimeout(() => { try { confirmSimulatedPayment(targetOrderNumber); } catch (e) { console.error('STK simulation failed:', e); } }, 8000);
        pushAppNotification({ audiencePhone: phone, type: 'order_update', title: 'Confirm Payment', message: `STK push sent to your phone. Confirm to proceed with Order #${orderNumber}.` });
      }

      return { ok: true, orderNumber, stkInitiated: isEscrowMobile };
    } catch (err) {
      console.error('Marketplace order failed:', err);
      return { ok: false, error: t('Something went wrong while placing your order.') };
    }
  };

  // ============ MEGA PHASE 1 — WALLET, WITHDRAWALS, AFFILIATE, PUSH ============

  const getWalletForCompany = (companyId: number): SellerWallet | undefined =>
    (wallets || []).find(w => w.companyId === companyId);

  const requestSellerWithdrawal = (companyId: number, amount: number, phoneNumber: string): { ok: boolean; error?: string } => {
    const wallet = getWalletForCompany(companyId);
    if (!wallet || wallet.balance < amount) {
      return { ok: false, error: t('Insufficient balance for this withdrawal request.') };
    }
    if (amount <= 0) {
      return { ok: false, error: t('Please enter a valid amount.') };
    }
    const nowIso = new Date().toISOString();
    const company = companies.find(c => c.id === companyId);
    const newWithdrawal: Withdrawal = {
      id: Date.now(),
      companyId,
      companyName: company?.name,
      amount: Math.round(amount * 100) / 100,
      phoneNumber: phoneNumber.trim(),
      status: 'pending',
      requestedAt: nowIso
    };
    // Hold the amount (deduct from balance) until ROOT approves or rejects.
    const nextWallets = (wallets || []).map(w => w.id === wallet.id
      ? { ...w, balance: Math.round((w.balance - newWithdrawal.amount) * 100) / 100, updatedAt: nowIso }
      : w);
    const nextTxns = [{
      id: Date.now(),
      walletId: wallet.id,
      companyId,
      type: 'withdrawal_request' as const,
      amount: newWithdrawal.amount,
      description: `Ombi la malipo (M-Pesa ${newWithdrawal.phoneNumber})`,
      status: 'pending' as const,
      reference: `WDR-${newWithdrawal.id}`,
      createdAt: nowIso
    }, ...(walletTransactions || [])];
    saveAllData({ withdrawals: [newWithdrawal, ...(withdrawals || [])], wallets: nextWallets, walletTransactions: nextTxns });
    logAction('Withdrawal Request', `${company?.name || 'Seller'} requested TZS ${newWithdrawal.amount.toLocaleString()} to ${newWithdrawal.phoneNumber}.`);
    return { ok: true };
  };

  const decideSellerWithdrawal = (withdrawalId: number, decision: 'approved' | 'rejected', note?: string): void => {
    const nowIso = new Date().toISOString();
    const target = (withdrawals || []).find(w => w.id === withdrawalId);
    if (!target || target.status !== 'pending') return;
    const wallet = (wallets || []).find(w => w.companyId === target.companyId);
    let nextWallets = wallets || [];
    let nextTxns = walletTransactions || [];
    if (decision === 'rejected' && wallet) {
      // Return the held amount to the wallet.
      nextWallets = nextWallets.map(w => w.id === wallet.id
        ? { ...w, balance: Math.round((w.balance + target.amount) * 100) / 100, updatedAt: nowIso }
        : w);
      nextTxns = [{
        id: Date.now(),
        walletId: wallet.id,
        companyId: target.companyId,
        type: 'credit',
        amount: target.amount,
        description: 'Ombi la malipo limekataliwa — fedha zimerudishwa',
        status: 'completed' as const,
        reference: `WDR-${target.id}`,
        createdAt: nowIso
      }, ...nextTxns];
    }
    if (decision === 'approved' && wallet) {
      nextWallets = nextWallets.map(w => w.id === wallet.id
        ? { ...w, totalWithdrawn: Math.round((w.totalWithdrawn + target.amount) * 100) / 100, updatedAt: nowIso }
        : w);
      nextTxns = [{
        id: Date.now(),
        walletId: wallet.id,
        companyId: target.companyId,
        type: 'withdrawal_approved',
        amount: target.amount,
        description: `Malipo yamethibitishwa — TZS ${target.amount.toLocaleString()} imetumwa kwa M-Pesa ${target.phoneNumber}`,
        status: 'completed' as const,
        reference: `WDR-${target.id}`,
        createdAt: nowIso
      }, ...nextTxns];
    }
    const nextWithdrawals = (withdrawals || []).map(w => w.id === withdrawalId
      ? { ...w, status: decision, approvedAt: decision === 'approved' ? nowIso : w.approvedAt, adminNote: note, decidedBy: currentUser?.username }
      : w);
    saveAllData({ withdrawals: nextWithdrawals, wallets: nextWallets, walletTransactions: nextTxns });
    logAction('Withdrawal ' + (decision === 'approved' ? 'Approved' : 'Rejected'), `Withdrawal #${withdrawalId} (TZS ${target.amount.toLocaleString()}) ${decision} by ${currentUser?.username || 'ROOT'}.`);
  };

  // ---- Affiliate helpers ----

  const readAffiliateRefCookie = (): string | null => {
    try {
      const m = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('tradecore_affiliate_ref='));
      return m ? decodeURIComponent(m.split('=')[1] || '') : null;
    } catch (e) {
      return null;
    }
  };

  const setAffiliateRefCookie = (code: string): void => {
    try {
      document.cookie = `tradecore_affiliate_ref=${encodeURIComponent(code)}; max-age=${60 * 60 * 24 * 30}; path=/; SameSite=Lax`;
    } catch (e) {}
  };

  const getOrCreateAffiliateForUser = (user: User): Affiliate | undefined => {
    if (!user) return undefined;
    let aff = (affiliates || []).find(a => a.userId === user.id);
    if (!aff) {
      const code = (user.username || 'ref').replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 20) || `ref${user.id}`;
      const exists = (affiliates || []).some(a => a.referralCode.toLowerCase() === code);
      const finalCode = exists ? `${code}${user.id}` : code;
      aff = {
        id: Date.now(),
        userId: user.id,
        name: user.name || user.username,
        phone: user.email || '',
        referralCode: finalCode,
        balance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
        isActive: true,
        createdAt: new Date().toISOString()
      };
      saveAllData({ affiliates: [...(affiliates || []), aff] });
    }
    return aff;
  };

  const requestAffiliateWithdrawal = (affiliateId: number, amount: number, phoneNumber: string, options?: {
    method?: string;
    accountName?: string;
    bankName?: string;
  }): { ok: boolean; error?: string } => {
    const aff = (affiliates || []).find(a => a.id === affiliateId);
    if (!aff || aff.balance < amount) return { ok: false, error: t('Insufficient affiliate balance.') };
    if (amount <= 0) return { ok: false, error: t('Please enter a valid amount.') };
    const minWdr = settings.affiliateMinWithdrawal ?? 10000;
    if (amount < minWdr) return { ok: false, error: t('Minimum withdrawal is') + ` ${minWdr.toLocaleString()} TZS.` };
    const nowIso = new Date().toISOString();
    const newWithdrawal: AffiliateWithdrawal = {
      id: Date.now(),
      affiliateId,
      amount: Math.round(amount * 100) / 100,
      phoneNumber: phoneNumber.trim(),
      method: options?.method || 'mpesa',
      accountName: options?.accountName,
      bankName: options?.bankName,
      status: 'pending',
      requestedAt: nowIso
    };
    const nextAffiliates = (affiliates || []).map(a => a.id === affiliateId
      ? { ...a, balance: Math.round((a.balance - newWithdrawal.amount) * 100) / 100 }
      : a);
    saveAllData({ affiliateWithdrawals: [newWithdrawal, ...(affiliateWithdrawals || [])], affiliates: nextAffiliates });
    logAction('Affiliate Withdrawal', `${aff.name} requested TZS ${newWithdrawal.amount.toLocaleString()} to ${newWithdrawal.phoneNumber}${options?.bankName ? ` (${options.bankName})` : ''}.`);
    return { ok: true };
  };

  const decideAffiliateWithdrawal = (withdrawalId: number, decision: 'approved' | 'rejected'): void => {
    const nowIso = new Date().toISOString();
    const target = (affiliateWithdrawals || []).find(w => w.id === withdrawalId);
    if (!target || target.status !== 'pending') return;
    let nextAffiliates = affiliates || [];
    if (decision === 'rejected') {
      // Return the held amount to the affiliate balance.
      nextAffiliates = nextAffiliates.map(a => a.id === target.affiliateId
        ? { ...a, balance: Math.round((a.balance + target.amount) * 100) / 100 }
        : a);
    }
    if (decision === 'approved') {
      nextAffiliates = nextAffiliates.map(a => a.id === target.affiliateId
        ? { ...a, totalWithdrawn: Math.round((a.totalWithdrawn + target.amount) * 100) / 100 }
        : a);
    }
    const next = (affiliateWithdrawals || []).map(w => w.id === withdrawalId
      ? { ...w, status: decision, approvedAt: decision === 'approved' ? nowIso : w.approvedAt, decidedBy: currentUser?.username }
      : w);
    saveAllData({ affiliateWithdrawals: next, affiliates: nextAffiliates });
    logAction('Affiliate Withdrawal ' + (decision === 'approved' ? 'Approved' : 'Rejected'), `Affiliate withdrawal #${withdrawalId} (TZS ${target.amount.toLocaleString()}) ${decision}.`);
  };

  const recordAffiliateClick = (affiliateId: number, url?: string): void => {
    const nowIso = new Date().toISOString();
    const clicks = [{
      id: Date.now(),
      affiliateId,
      url: url || (typeof window !== 'undefined' ? window.location.href : undefined),
      clickedAt: nowIso
    }, ...(affiliateClicks || [])].slice(0, 2000);
    saveAllData({ affiliateClicks: clicks });
  };

  // ---- MEGA ULTIMATE — MFUMO WA WAKALA (public portal) ----

  const generateWakalaCode = (): string => {
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return `WAKALA-${code}`;
  };

  const registerAffiliate = (data: {
    name: string;
    phone: string;
    password?: string;
    region?: string;
    district?: string;
    ward?: string;
    nida?: string;
  }): { ok: boolean; error?: string; affiliate?: Affiliate } => {
    const phone = (data.phone || '').replace(/\s+/g, '');
    if (!/^(\+?255|0)[67][0-9]{8}$/.test(phone)) return { ok: false, error: t('Please enter a valid phone number.') };
    const exists = (affiliates || []).some(a => a.phone.replace(/\s+/g, '') === phone.replace(/^\+?255/, '0'));
    if (exists) return { ok: false, error: t('A wakala with this phone number already exists. Login instead.') };
    let code = generateWakalaCode();
    while ((affiliates || []).some(a => a.referralCode.toLowerCase() === code.toLowerCase())) {
      code = generateWakalaCode();
    }
    const nowIso = new Date().toISOString();
    const aff: Affiliate = {
      id: Date.now(),
      name: data.name.trim(),
      phone,
      referralCode: code,
      balance: 0,
      totalEarned: 0,
      totalWithdrawn: 0,
      isActive: true,
      status: 'pending',
      region: data.region,
      district: data.district,
      ward: data.ward,
      nida: data.nida,
      password: data.password ? hashPassword(data.password) : undefined,
      registeredBy: 'self',
      createdAt: nowIso
    };
    saveAllData({ affiliates: [...(affiliates || []), aff] });
    logAction('Wakala Register', `${aff.name} (${aff.phone}) registered as wakala with code ${aff.referralCode}.`);
    return { ok: true, affiliate: aff };
  };

  const loginAffiliate = (phone: string, password: string): { ok: boolean; error?: string; affiliate?: Affiliate } => {
    const p = (phone || '').replace(/\s+/g, '');
    const aff = (affiliates || []).find(a => a.phone.replace(/\s+/g, '') === p);
    if (!aff) return { ok: false, error: t('No wakala found with this phone number.') };
    if (aff.status === 'suspended' || !aff.isActive) return { ok: false, error: t('This wakala account is suspended.') };
    if (!aff.password) return { ok: false, error: t('This account has no portal password. Contact ROOT support.') };
    if (!verifyPassword(password, aff.password)) return { ok: false, error: t('Incorrect password.') };
    return { ok: true, affiliate: aff };
  };

  const approveAffiliate = (affiliateId: number, active: boolean): void => {
    const next = (affiliates || []).map(a => a.id === affiliateId
      ? { ...a, status: active ? ('active' as const) : ('suspended' as const), isActive: active, approvedAt: active ? (a.approvedAt || new Date().toISOString()) : a.approvedAt }
      : a);
    saveAllData({ affiliates: next });
    const aff = next.find(a => a.id === affiliateId);
    logAction('Wakala Approval', `${aff?.name || affiliateId} ${active ? 'approved' : 'suspended'} by ${currentUser?.username || 'ROOT'}.`);
    toast.success(active ? t('Wakala approved — commission earning enabled.') : t('Wakala suspended.'));
  };

  // ---- MEGA ULTIMATE — TAFTA KWA SAUTI (voice search logging) ----

  const logVoiceSearch = (query: string, transcript: string, matches: number, language: string = 'sw-TZ'): void => {
    const rec: VoiceSearchLog = {
      id: Date.now(),
      query: query.trim(),
      transcript: transcript.trim(),
      matches,
      language,
      createdAt: new Date().toISOString()
    };
    saveAllData({ voiceSearches: [rec, ...(voiceSearches || [])].slice(0, 300) });
  };

  // ---- MEGA ULTIMATE — QR CODE YA DUKA LA MTAA (scan tracking) ----

  const recordQrScan = (companyId: number, productId: number | null, token: string, referrer: string, isAffiliate: boolean): void => {
    const nowIso = new Date().toISOString();
    let nextCompanies = companies || [];
    if (companyId) {
      nextCompanies = nextCompanies.map(c => c.id === companyId
        ? { ...c, qrScans: (c.qrScans || 0) + 1 }
        : c);
    }
    let nextProducts = marketplaceProducts || [];
    if (productId) {
      nextProducts = nextProducts.map(p => p.id === productId
        ? { ...p, qrScans: (p.qrScans || 0) + 1 }
        : p);
    }
    const scan: QrScanLog = {
      id: Date.now(),
      companyId,
      productId: productId || null,
      token,
      referrer,
      isAffiliate: !!isAffiliate,
      scannedAt: nowIso
    };
    saveAllData({
      companies: nextCompanies,
      marketplaceProducts: nextProducts,
      qrScans: [scan, ...(qrScans || [])].slice(0, 1000)
    });
    logAction('QR Scan', `QR scan recorded for company #${companyId}${productId ? ` product #${productId}` : ''} (token ${token})${isAffiliate ? ' via affiliate ref' : ''}.`);
  };

  const registerPushSubscription = (sub: { endpoint: string; p256dh: string; auth: string }): void => {
    const nowIso = new Date().toISOString();
    const rec: PushSubscriptionRec = {
      id: Date.now(),
      companyId: currentUser?.companyId ?? null,
      userId: currentUser?.id ?? null,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      createdAt: nowIso
    };
    const existing = (pushSubscriptions || []).filter(s => s.endpoint !== sub.endpoint);
    const next = [...existing, rec].slice(0, 500);
    saveAllData({ pushSubscriptions: next });
    logAction('Push Subscribe', `Push subscription saved for ${currentUser?.username || 'anonymous'} (${next.length} total).`);
  };

  const updateSearchSynonyms = (next: SearchSynonym[]): void => {
    saveAllData({ searchSynonyms: next });
  };

  // ============ MEGA PHASE 2B — MULTI-NETWORK COLLECTION ============

  const nextCollectionId = () => Math.max(0, ...(collections || []).map(c => c.id)) + 1;

  const generateCollectionReference = (id: number): string =>
    `COL-${String(id).padStart(6, '0')}`;

  /**
   * Create a CollectionRecord (manual mode default). Returns the reference so the
   * checkout can attach it to the order before submission.
   */
  const createCollection = (input: {
    orderId?: number | null;
    companyId: number;
    customerName?: string;
    customerPhone: string;
    network: CollectionNetwork;
    amount: number;
    status?: CollectionStatus;
    mode?: CollectionMode;
    transactionId?: string;
    proofImage?: string;
  }): { ok: boolean; reference?: string; error?: string } => {
    const nowIso = new Date().toISOString();
    const id = nextCollectionId();
    const reference = generateCollectionReference(id);
    const mode: CollectionMode = input.mode || settings.collectionMode || 'manual';
    const status: CollectionStatus = input.status || (mode === 'auto' ? 'processing' : 'manual_pending_approval');
    const rec: CollectionRecord = {
      id,
      orderId: input.orderId ?? null,
      companyId: input.companyId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      network: input.network,
      amount: input.amount,
      amountTzs: input.amount,
      currencyCode: 'TZS',
      status,
      reference,
      mode,
      transactionId: input.transactionId,
      proofImage: input.proofImage,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    const next = [rec, ...(collections || [])].slice(0, 5000);
    setCollections(next);
    saveAllData({ collections: next });
    logAction('Collection Created', `Collection ${reference} (${input.network}, TZS ${input.amount.toLocaleString()}) from ${input.customerPhone} — mode ${mode}.`);
    return { ok: true, reference };
  };

  /** Merge a server-created collection record (auto/AzamPay mode) into local state. */
  const applyCollectionRecord = (rec: CollectionRecord): void => {
    const next = [rec, ...(collections || []).filter(c => c.reference !== rec.reference)].slice(0, 5000);
    setCollections(next);
    saveAllData({ collections: next });
  };

  /**
   * Public entry point used by checkout. Auto mode tries the server (AzamPay USSD push);
   * any failure falls back to a manual collection so checkout never blocks the customer.
   */
  const initiateCollection = async (input: {
    companyId: number;
    customerName?: string;
    customerPhone: string;
    network: CollectionNetwork;
    amount: number;
  }): Promise<{ ok: boolean; reference?: string; status?: CollectionStatus; mode?: CollectionMode; error?: string }> => {
    const canAuto = settings.collectionMode === 'auto'
      && !!settings.azampayCollectionEnabled
      && !!settings.azampayClientId
      && !!settings.azampayClientSecret;
    if (canAuto) {
      try {
        const res = await apiCollectionInitiate({
          phone: input.customerPhone,
          amount: input.amount,
          network: input.network,
          companyId: input.companyId,
          customerName: input.customerName,
          customerPhone: input.customerPhone
        });
        if (res && res.ok && res.reference) {
          if (res.record) applyCollectionRecord(res.record as CollectionRecord);
          return { ok: true, reference: res.reference, status: (res.status as CollectionStatus) || 'processing', mode: 'auto' };
        }
      } catch (e) {
        console.warn('[collection] AzamPay initiate failed, falling back to manual:', e);
      }
    }
    const r = createCollection({ ...input, mode: 'manual' });
    return { ok: r.ok, reference: r.reference, status: 'manual_pending_approval', mode: 'manual', error: r.error };
  };

  /** Poll helper: ask the server for status; when confirmed, complete locally (wallet credit). */
  const checkCollectionStatus = async (reference: string): Promise<{ ok: boolean; status?: CollectionStatus; error?: string }> => {
    try {
      const res = await apiCollectionStatus(reference);
      if (res && res.ok) {
        const status = res.status as CollectionStatus | undefined;
        if (status === 'completed') {
          const local = (collections || []).find(c => c.reference === reference);
          if (local && local.status !== 'completed') {
            completeCollection(local.id, { note: 'Auto-confirmed via AzamPay callback.' });
          }
        }
        return { ok: true, status };
      }
      return { ok: false, error: res?.error || 'Status check failed.' };
    } catch (e) {
      console.warn('[collection] status check failed:', e);
      return { ok: false, error: 'Status check failed.' };
    }
  };

  /** Credit the seller wallet + create affiliate commission + record admin earning for a completed collection. */
  const completeCollection = (collectionId: number, opts?: { note?: string; decidedBy?: string }): boolean => {
    const collection = (collections || []).find(c => c.id === collectionId);
    if (!collection) return false;
    if (collection.status === 'completed') return false;
    const nowIso = new Date().toISOString();
    const order = (marketplaceOrders || []).find(o => o.collectionReference === collection.reference);
    const company = companies.find(c => c.id === collection.companyId);

    let nextCollections = (collections || []).map(c => c.id === collectionId
      ? { ...c, status: 'completed' as CollectionStatus, updatedAt: nowIso, adminNote: opts?.note || c.adminNote, decidedBy: opts?.decidedBy || c.decidedBy }
      : c);

    let nextWallets = wallets || [];
    let nextWalletTxns = walletTransactions || [];
    let nextAffiliates = affiliates || [];
    let nextAffiliateSales = affiliateSales || [];
    let nextAdminEarnings = adminEarnings || [];
    let nextOrders = marketplaceOrders;

    const totalAmount = order ? order.totalAmount : collection.amount;
    const commissionPercent = order?.commissionPercent ?? (company?.planType === 'direct' ? 0 : (company?.commissionPercentSnapshot ?? 0));
    const commissionAmount = order?.commissionAmount ?? Math.round(totalAmount * (commissionPercent / 100) * 100) / 100;
    const sellerAmount = Math.round((totalAmount - commissionAmount) * 100) / 100;

    if (commissionPercent > 0 && commissionAmount > 0 && sellerAmount > 0) {
      let wallet = nextWallets.find(w => w.companyId === collection.companyId);
      if (!wallet) {
        wallet = { id: Date.now(), companyId: collection.companyId, balance: 0, totalEarned: 0, totalWithdrawn: 0, updatedAt: nowIso };
        nextWallets = [...nextWallets, wallet];
      }
      nextWallets = nextWallets.map(w => w.id === wallet!.id
        ? { ...w, balance: Math.round((w.balance + sellerAmount) * 100) / 100, totalEarned: Math.round((w.totalEarned + sellerAmount) * 100) / 100, updatedAt: nowIso }
        : w);
      nextWalletTxns = [{
        id: Date.now(),
        walletId: wallet.id,
        companyId: collection.companyId,
        type: 'credit',
        amount: sellerAmount,
        description: `Malipo ya Order #${order ? order.orderNumber : collection.reference} (${collection.network})`,
        orderId: order?.id ?? null,
        status: 'completed',
        reference: collection.reference,
        createdAt: nowIso
      }, ...nextWalletTxns];
      nextAdminEarnings = [{
        id: Math.max(0, ...nextAdminEarnings.map(e => e.id)) + 1,
        companyId: collection.companyId,
        orderId: order?.id ?? null,
        reference: order ? order.orderNumber : collection.reference,
        amount: totalAmount,
        commissionAmount,
        sellerAmount,
        createdAt: nowIso
      }, ...nextAdminEarnings];
      logAction('Collection Completed', `Collection ${collection.reference} (${collection.network}, TZS ${totalAmount.toLocaleString()}) — credited ${company?.name || collection.companyId} TZS ${sellerAmount.toLocaleString()}, admin keeps ${commissionAmount.toLocaleString()}.`);
    }

    // Affiliate commission on the completed sale.
    const refCode = readAffiliateRefCookie();
    const affiliateByCode = refCode ? nextAffiliates.find(a => a.referralCode.toLowerCase() === refCode.toLowerCase() && a.isActive) : undefined;
    if (affiliateByCode && commissionPercent > 0 && order) {
      const affPct = settings.affiliateCommissionPercent ?? defaultAffiliateCommissionPercent;
      const affCommission = Math.round(totalAmount * (affPct / 100) * 100) / 100;
      if (affCommission > 0 && !nextAffiliateSales.some(s => s.orderId === order.id)) {
        nextAffiliateSales = [{
          id: Date.now(),
          affiliateId: affiliateByCode.id,
          orderId: order.id,
          companyId: collection.companyId,
          amount: totalAmount,
          commissionAmount: affCommission,
          commissionPercent: affPct,
          status: 'pending',
          createdAt: nowIso
        }, ...nextAffiliateSales];
        nextAffiliates = nextAffiliates.map(a => a.id === affiliateByCode.id
          ? { ...a, balance: Math.round((a.balance + affCommission) * 100) / 100, totalEarned: Math.round((a.totalEarned + affCommission) * 100) / 100 }
          : a);
      }
    }

    if (order) {
      nextOrders = nextOrders.map(o => o.id === order.id
        ? { ...o, paymentStatus: 'completed', payToSellerDone: true, updatedAt: nowIso }
        : o);
    }

    // ============ MEGA PHASE 2C — settle feature payments on collection completion ============
    // All 7 killer features settle here so every flow works in manual mode: ROOT approves the
    // collection → order paid + wallet credited (above) → offers/group deals/installments/live
    // purchases marked paid → delivery auto-created → loyalty points earned → SMS logged.
    let nextOffers = offers || [];
    let nextOfferMessages = offerMessages || [];
    let nextGroupDeals = groupDeals || [];
    let nextGroupDealParticipants = groupDealParticipants || [];
    let nextInstallmentOrders = installmentOrders || [];
    let nextInstallmentPayments = installmentPayments || [];
    let nextLiveComments = liveComments || [];
    let nextDeliveries = deliveries || [];
    let nextDeliveryUpdates = deliveryUpdates || [];
    let nextNotificationLogs = notificationLogs || [];
    let nextLoyaltyCustomers = loyaltyCustomers || [];
    let nextLoyaltyTransactions = loyaltyTransactions || [];

    const pushNotificationLog = (to: string, message: string, kind: NotificationKind = 'sms', url?: string) => {
      nextNotificationLogs = [{
        id: Date.now() + Math.floor(Math.random() * 1000),
        kind,
        to,
        message,
        url,
        status: 'logged',
        mode: 'log',
        createdAt: nowIso
      }, ...nextNotificationLogs];
    };

    // Feature reference embedded in the order's deliveryInstructions by createFeaturePayment:
    //   FEATURE-REF: OFFER-{id} | GROUP-{dealId}-{phone} | LP-{installmentOrderId}-D / -I{n}
    const featureRef = order && order.deliveryInstructions
      ? (order.deliveryInstructions.match(/FEATURE-REF[: ]([A-Za-z0-9-]+)/i)?.[1] || '').trim()
      : '';

    // 1. Piga Bei — the accepted offer becomes paid when its checkout collection completes.
    const offerHit = featureRef.startsWith('OFFER-')
      ? nextOffers.find(o => o.id === Number(featureRef.slice(6)))
      : undefined;
    if (offerHit) {
      nextOffers = nextOffers.map(o => o.id === offerHit.id ? { ...o, status: 'paid' as const, paymentReference: collection.reference, orderId: order?.id ?? null } : o);
      nextOfferMessages = [{
        id: Date.now(), offerId: offerHit.id, senderType: 'seller',
        message: 'Malipo yamethibitishwa. Ofa imefungwa, asante kwa kununua!', createdAt: nowIso
      }, ...nextOfferMessages];
      pushNotificationLog(collection.customerPhone, `Ofa yako imelipwa (TZS ${totalAmount.toLocaleString()}). Asante kwa kununua TradeCore!`, 'sms', `/product/${offerHit.productId}`);
    }

    // 2. Nunua Pamoja — participant marked paid; group completes when minBuyers reached.
    const partHit = featureRef.startsWith('GROUP-')
      ? nextGroupDealParticipants.find(p => p.reference === featureRef)
      : undefined;
    if (partHit) {
      nextGroupDealParticipants = nextGroupDealParticipants.map(p => p.id === partHit.id
        ? { ...p, status: 'paid' as const, amountPaid: totalAmount, paidAt: nowIso, orderId: order?.id ?? null }
        : p);
      const groupDeal = nextGroupDeals.find(d => d.id === partHit.groupDealId);
      if (groupDeal && groupDeal.status === 'active') {
        const paidCount = nextGroupDealParticipants.filter(p => p.groupDealId === groupDeal.id && p.status === 'paid').length;
        nextGroupDeals = nextGroupDeals.map(d => d.id === groupDeal.id ? { ...d, paidCount } : d);
        if (paidCount >= groupDeal.minBuyers) {
          nextGroupDeals = nextGroupDeals.map(d => d.id === groupDeal.id ? { ...d, status: 'completed' as const } : d);
          nextGroupDealParticipants
            .filter(p => p.groupDealId === groupDeal.id && p.status === 'paid')
            .forEach(pp => pushNotificationLog(pp.customerPhone, `Nunua Pamoja #${groupDeal.shareCode} imefanikiwa! Bidhaa itatumwa hivi karibuni.`, 'sms', `/group-deal/${groupDeal.id}`));
        } else {
          pushNotificationLog(collection.customerPhone, `Umejiunga Nunua Pamoja #${groupDeal.shareCode}! Wataka ${groupDeal.minBuyers - paidCount} wengine walipie ili deal ikamilike.`, 'sms', `/group-deal/${groupDeal.id}`);
        }
      }
    }

    // 3. Lipa Pole Pole — installment payment settled; final installment completes the order.
    const instHit = featureRef.startsWith('LP-')
      ? nextInstallmentPayments.find(p => p.reference === featureRef)
      : undefined;
    if (instHit) {
      nextInstallmentPayments = nextInstallmentPayments.map(p => p.id === instHit.id
        ? { ...p, status: 'completed' as const, paidAt: nowIso, collectionId: collection.id }
        : p);
      const instOrder = nextInstallmentOrders.find(o => o.id === instHit.installmentOrderId);
      if (instOrder) {
        if (instHit.type === 'down') {
          const nextDue = new Date(Date.now() + 30 * 86400000).toISOString();
          nextInstallmentOrders = nextInstallmentOrders.map(o => o.id === instOrder.id
            ? { ...o, status: 'active' as const, nextDueDate: nextDue, totalPaid: instOrder.downPayment }
            : o);
          pushNotificationLog(collection.customerPhone, `Lipa Pole Pole #${instOrder.trackingCode} imeanza! Malipo yafuatayo TZS ${instOrder.installmentAmount.toLocaleString()} ifikapo ${nextDue.slice(0, 10)}.`, 'sms', `/lipa-pole-pole/${instOrder.trackingCode}`);
        } else {
          const remainingPayments = Math.max(1, (instOrder.installmentsCount || 1) - (instOrder.paidInstallments || 0));
          const principalShare = Math.round((instOrder.remaining / remainingPayments) * 100) / 100;
          const newPaidInst = (instOrder.paidInstallments || 0) + 1;
          const newRemaining = Math.max(0, Math.round((instOrder.remaining - principalShare) * 100) / 100);
          const done = newPaidInst >= (instOrder.installmentsCount || 1);
          const updatedOrder: InstallmentOrder = {
            ...instOrder,
            paidInstallments: newPaidInst,
            remaining: newRemaining,
            totalPaid: Math.round((instOrder.totalPaid + instHit.amount) * 100) / 100,
            status: done ? 'completed' : 'active',
            nextDueDate: done ? instOrder.nextDueDate : new Date(Date.now() + 30 * 86400000).toISOString()
          };
          nextInstallmentOrders = nextInstallmentOrders.map(o => o.id === instOrder.id ? updatedOrder : o);
          pushNotificationLog(collection.customerPhone, done
            ? `Hongera! Umekamilisha Lipa Pole Pole #${instOrder.trackingCode}. Bidhaa itatumwa sasa.`
            : `Malipo ya Lipa Pole Pole #${instOrder.trackingCode} yamethibitishwa. Yamebaki ${(instOrder.installmentsCount || 1) - newPaidInst} ya ${instOrder.installmentsCount}.`, 'sms', `/lipa-pole-pole/${instOrder.trackingCode}`);
        }
      }
    }

    // 4. Live Shopping — record a paid comment when a live checkout completes.
    if (order && order.deliveryInstructions) {
      const liveMatch = order.deliveryInstructions.match(/LIVE-STREAM[: ]([A-Za-z0-9-]+)/i);
      if (liveMatch) {
        const live = liveStreams.find(s => s.streamKey === liveMatch[1]);
        if (live) {
          nextLiveComments = [{
            id: Date.now(),
            liveStreamId: live.id,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            message: `${order.customerName} amenunua bidhaa!`,
            type: 'paid',
            productId: order.items[0]?.productId,
            createdAt: nowIso
          }, ...nextLiveComments];
        }
      }
    }

    // 5. Bodaboda — auto-create a delivery for every paid order (seller assigns rider later).
    if (order && !nextDeliveries.some(d => d.orderId === order.id)) {
      const trackingCode = `TRACK-${order.id}-${Math.floor(1000 + Math.random() * 9000)}`;
      const delivery: Delivery = {
        id: Date.now(),
        orderId: order.id,
        collectionId: collection.id,
        companyId: collection.companyId,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerAddress: [order.customerRegion, order.customerDistrict, order.customerStreet].filter(Boolean).join(', ') || 'TBD',
        customerLat: order.latitude,
        customerLng: order.longitude,
        status: 'pending',
        trackingCode,
        createdAt: nowIso,
        updatedAt: nowIso
      };
      nextDeliveries = [delivery, ...nextDeliveries];
      nextDeliveryUpdates = [{
        id: Date.now(),
        deliveryId: delivery.id,
        status: 'pending',
        note: 'Delivery imeandaliwa. Inasubiri rider.',
        createdAt: nowIso
      }, ...nextDeliveryUpdates];
      pushNotificationLog(order.customerPhone, `Malipo yamethibitishwa! Delivery imeandaliwa. Tracking Code: ${trackingCode}. Fuata kwenye /track/${trackingCode}`, 'sms', `/track/${trackingCode}`);
    }

    // 6. Loyalty — earn points on every completed payment (TZS 1,000 = 100 points default).
    const loyaltyCustPhone = normalizeTzPhone(collection.customerPhone);
    if (loyaltyCustPhone && totalAmount > 0) {
      const loyaltyS = settings.loyalty || defaultSettings.loyalty;
      const pointsPer1000 = loyaltyS.pointsPer1000 || 0;
      const pointsEarned = Math.floor(totalAmount / 1000) * pointsPer1000;
      if (pointsEarned > 0) {
        const tierFor = (pts: number): LoyaltyTier =>
          pts >= (loyaltyS.platinumMin || 50000) ? 'platinum'
            : pts >= (loyaltyS.goldMin || 20000) ? 'gold'
              : pts >= (loyaltyS.silverMin || 5000) ? 'silver'
                : 'bronze';
        let loyaltyCust = nextLoyaltyCustomers.find(c => c.phone === loyaltyCustPhone);
        if (!loyaltyCust) {
          loyaltyCust = {
            id: Date.now(), phone: loyaltyCustPhone,
            name: collection.customerName || order?.customerName || 'Mteja',
            totalPoints: 0, usedPoints: 0, balancePoints: 0, totalSpent: 0, tier: 'bronze',
            createdAt: nowIso, updatedAt: nowIso
          };
          nextLoyaltyCustomers = [...nextLoyaltyCustomers, loyaltyCust];
        }
        const newTotal = loyaltyCust.totalPoints + pointsEarned;
        const newTier = tierFor(newTotal);
        const newBalance = loyaltyCust.balancePoints + pointsEarned;
        nextLoyaltyCustomers = nextLoyaltyCustomers.map(c => c.id === loyaltyCust!.id
          ? {
              ...c,
              name: c.name || collection.customerName || order?.customerName,
              totalPoints: newTotal,
              balancePoints: newBalance,
              totalSpent: Math.round((c.totalSpent + totalAmount) * 100) / 100,
              tier: newTier,
              updatedAt: nowIso
            }
          : c);
        nextLoyaltyTransactions = [{
          id: Date.now(),
          loyaltyCustomerId: loyaltyCust.id,
          type: 'earn',
          points: pointsEarned,
          description: `Points kwa malipo ${collection.reference}`,
          orderId: order?.id ?? null,
          reference: collection.reference,
          createdAt: nowIso
        }, ...nextLoyaltyTransactions];
        const discountTzs = Math.floor(newBalance / (loyaltyS.pointsToTzsRate || 100)) * 1000;
        pushNotificationLog(loyaltyCustPhone, `Umepata points ${pointsEarned}! Jumla: ${newBalance} pts = TZS ${discountTzs.toLocaleString()} discount. Angalia /loyalty/check`, 'sms', '/loyalty/check');
      }
    }

    setCollections(nextCollections);
    saveAllData({
      collections: nextCollections,
      wallets: nextWallets,
      walletTransactions: nextWalletTxns,
      affiliates: nextAffiliates,
      affiliateSales: nextAffiliateSales,
      adminEarnings: nextAdminEarnings,
      marketplaceOrders: nextOrders,
      offers: nextOffers,
      offerMessages: nextOfferMessages,
      groupDeals: nextGroupDeals,
      groupDealParticipants: nextGroupDealParticipants,
      installmentOrders: nextInstallmentOrders,
      installmentPayments: nextInstallmentPayments,
      liveComments: nextLiveComments,
      deliveries: nextDeliveries,
      deliveryUpdates: nextDeliveryUpdates,
      notificationLogs: nextNotificationLogs,
      loyaltyCustomers: nextLoyaltyCustomers,
      loyaltyTransactions: nextLoyaltyTransactions
    });
    return true;
  };

  /** ROOT approves (credits wallet) or rejects (restores stock) a manual collection. */
  const decideCollection = (collectionId: number, decision: 'approved' | 'rejected', note?: string): void => {
    const collection = (collections || []).find(c => c.id === collectionId);
    if (!collection) return;
    const nowIso = new Date().toISOString();
    if (decision === 'approved') {
      completeCollection(collectionId, { note, decidedBy: currentUser?.username });
      logAction('Collection Approved', `Collection ${collection.reference} approved by ${currentUser?.username}.`);
      return;
    }
    // Rejected: mark rejected + restore stock + fail the linked order.
    let nextOrders = marketplaceOrders;
    const order = (marketplaceOrders || []).find(o => o.collectionReference === collection.reference);
    if (order) {
      nextOrders = nextOrders.map(o => o.id === order.id
        ? { ...o, paymentStatus: 'failed', rejectionReason: note || 'Payment rejected', updatedAt: nowIso }
        : o);
    }
    let nextProducts = marketplaceProducts;
    if (order) {
      nextProducts = nextProducts.map(p => {
        const it = order.items.find(i => i.productId === p.id);
        if (it) return { ...p, stockQuantity: (p.stockQuantity || 0) + it.quantity };
        return p;
      });
    }
    const nextCollections = (collections || []).map(c => c.id === collectionId
      ? { ...c, status: 'failed' as CollectionStatus, updatedAt: nowIso, adminNote: note || c.adminNote, decidedBy: currentUser?.username }
      : c);
    saveAllData({ collections: nextCollections, marketplaceOrders: nextOrders, marketplaceProducts: nextProducts });
    logAction('Collection Rejected', `Collection ${collection.reference} rejected by ${currentUser?.username}${note ? ' — ' + note : ''}.`);
  };

  // ============ MEGA PHASE 2C — FEATURE HANDLERS ============

  /** Log an SMS/notification entry (Phase 1 = logged only; no gateway keys required). */
  const logNotification = (to: string, message: string, kind: NotificationKind = 'sms', url?: string): void => {
    const entry: NotificationLog = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      kind,
      to,
      message,
      url,
      status: 'logged',
      mode: 'log',
      createdAt: new Date().toISOString()
    };
    saveAllData({ notificationLogs: [entry, ...(notificationLogs || [])].slice(0, 5000) });
  };

  /**
   * Create a collection + single-product order for a feature payment (offer / group / installment /
   * live). Money goes to the platform first (deferWalletCredit) and is released to the seller when
   * ROOT approves the collection — see completeCollection(). The FEATURE-REF token in
   * deliveryInstructions links the settled collection back to the feature record.
   */
  const createFeaturePayment = (input: {
    companyId: number;
    product: MarketplaceProduct;
    unitPrice: number;
    quantity?: number;
    customerName: string;
    customerPhone: string;
    customerRegion?: string;
    customerDistrict?: string;
    customerWard?: string;
    customerStreet?: string;
    network?: CollectionNetwork;
    trackingRef?: string; // OFFER-{id} | GROUP-{dealId}-{phone} | LP-{installmentOrderId}-D/-I{n}
    liveStreamKey?: string;
  }): { ok: boolean; reference?: string; orderId?: number | null; error?: string } => {
    const phone = normalizeTzPhone((input.customerPhone || '').trim());
    if (!phone) return { ok: false, error: 'Namba ya simu si sahihi.' };
    const nowIso = new Date().toISOString();
    const company = companies.find(c => c.id === input.companyId);
    if (!company) return { ok: false, error: 'Company not found.' };
    const product = input.product;
    const qty = input.quantity || 1;
    if ((product.stockQuantity || 0) < qty) return { ok: false, error: `${product.name} — out of stock.` };
    const totalAmount = Math.round(input.unitPrice * qty * 100) / 100;

    let customer = marketplaceCustomers.find(c => c.phone === phone);
    let customersUpdated = marketplaceCustomers;
    if (!customer) {
      customer = {
        id: Math.max(0, ...(marketplaceCustomers || []).map(c => c.id)) + 1,
        name: input.customerName.trim(),
        phone,
        region: input.customerRegion || '',
        district: input.customerDistrict || '',
        ward: input.customerWard || '',
        street: input.customerStreet || '',
        isGuest: true,
        locale: 'en',
        createdAt: nowIso
      };
      customersUpdated = [...customersUpdated, customer];
    }

    const collection = createCollection({
      companyId: input.companyId,
      customerName: input.customerName.trim(),
      customerPhone: phone,
      network: input.network || 'mpesa',
      amount: totalAmount,
      mode: 'manual'
    });
    if (!collection.ok || !collection.reference) return { ok: false, error: collection.error || 'Failed to create collection.' };

    const orderNumber = generateOrderNumber();
    const commissionPercent = company.planType === 'direct' ? 0 : (company.commissionPercentSnapshot ?? 0);
    const commissionAmount = Math.round(totalAmount * (commissionPercent / 100) * 100) / 100;
    const featureTags = [
      input.trackingRef ? `FEATURE-REF: ${input.trackingRef}` : '',
      input.liveStreamKey ? `LIVE-STREAM: ${input.liveStreamKey}` : ''
    ].filter(Boolean).join(' | ');
    const newOrder: MarketplaceOrder = {
      id: Date.now(),
      orderNumber,
      companyId: input.companyId,
      customerId: customer.id,
      customerName: input.customerName.trim(),
      customerPhone: phone,
      customerRegion: input.customerRegion || '',
      customerDistrict: input.customerDistrict || '',
      customerWard: input.customerWard || '',
      customerStreet: input.customerStreet || '',
      deliveryInstructions: featureTags || undefined,
      totalAmount,
      amountPaid: totalAmount,
      paymentMethodType: input.network || 'mpesa',
      transactionId: `PENDING-${collection.reference}`,
      status: 'pending_verification',
      items: [{
        productId: product.id,
        productName: product.name,
        productImage: product.image || undefined,
        quantity: qty,
        unitPrice: input.unitPrice,
        subtotal: totalAmount
      }],
      customerType: 'guest',
      createdAt: nowIso,
      commissionPercent,
      commissionAmount: commissionPercent > 0 ? commissionAmount : undefined,
      payToSellerDone: false,
      paymentStatus: 'manual_pending_approval',
      collectionReference: collection.reference
    };
    const updatedProducts = marketplaceProducts.map(p => p.id === product.id ? { ...p, stockQuantity: Math.max(0, (p.stockQuantity || 0) - qty) } : p);
    saveAllData({
      marketplaceOrders: [newOrder, ...(marketplaceOrders || [])],
      marketplaceProducts: updatedProducts,
      marketplaceCustomers: customersUpdated
    });
    logAction('Feature Order', `Feature order ${orderNumber} (${input.trackingRef || 'feature'}) TZS ${totalAmount.toLocaleString()} — collection ${collection.reference}.`);
    return { ok: true, reference: collection.reference, orderId: newOrder.id };
  };

  // ---------- 1. PIGA BEI (Offers / Haggling) ----------

  const createOffer = (input: {
    productId: number;
    companyId: number;
    customerName: string;
    customerPhone: string;
    originalPrice: number;
    offeredPrice: number;
    buyerMessage?: string;
  }): { ok: boolean; offerId?: number; error?: string } => {
    if (!input.customerName.trim()) return { ok: false, error: 'Jina linahitajika.' };
    const phone = normalizeTzPhone(input.customerPhone);
    if (!phone) return { ok: false, error: 'Namba ya simu si sahihi.' };
    if (input.offeredPrice <= 0 || input.offeredPrice >= input.originalPrice) return { ok: false, error: 'Bei yako lazima iwe chini ya bei ya sasa.' };
    // MEGA CRITICAL FIX: no silly offers — must be more than 50% of the original price
    if (input.offeredPrice < input.originalPrice * 0.5) return { ok: false, error: 'Bei yako ni ndini mno. Kiwango cha chini kabisa ni 50% ya bei ya bidhaa.' };
    const offer: Offer = {
      id: Date.now(),
      productId: input.productId,
      companyId: input.companyId,
      customerName: input.customerName.trim(),
      customerPhone: phone,
      originalPrice: input.originalPrice,
      offeredPrice: Math.round(input.offeredPrice * 100) / 100,
      buyerMessage: input.buyerMessage?.trim() || undefined,
      status: 'pending',
      expiresAt: new Date(Date.now() + 48 * 3600000).toISOString(), // offer valid 48h
      createdAt: new Date().toISOString()
    };
    saveAllData({ offers: [offer, ...(offers || [])] });
    // Bell notification to the SELLER — a new Piga Bei arrived
    pushAppNotification({ companyId: offer.companyId, type: 'offer_update', title: 'New Piga Bei Offer', message: `${offer.customerName} made an offer of TZS ${offer.offeredPrice.toLocaleString()} (original TZS ${offer.originalPrice.toLocaleString()}). Respond before ${new Date(offer.expiresAt).toLocaleString()}.` });
    logAction('Offer Created', `Piga Bei offer #${offer.id} from ${offer.customerName} (${phone}) — TZS ${offer.offeredPrice.toLocaleString()} on product ${input.productId}.`);
    logNotification(phone, `Piga Bei offer yako imetumwa! Mfanyabiashara atajibu ndani ya saa 24. Product: #${input.productId}`, 'sms');
    return { ok: true, offerId: offer.id };
  };

  const addOfferMessage = (offerId: number, senderType: 'customer' | 'seller', message?: string, price?: number): void => {
    const msg: OfferMessage = { id: Date.now(), offerId, senderType, message: message?.trim() || undefined, price, createdAt: new Date().toISOString() };
    let nextOffers = offers;
    if (price && price > 0) {
      nextOffers = offers.map(o => o.id === offerId
        ? senderType === 'seller'
          ? { ...o, counterPrice: price, status: 'countered' as const }
          : { ...o, offeredPrice: price, status: 'pending' as const }
        : o);
    }
    saveAllData({ offerMessages: [msg, ...(offerMessages || [])], offers: nextOffers });
    forceFlushNow();
  };

  // --- MEGA CRITICAL FIX 2-in-1 PART 1: full Piga Bei negotiation with buyer feedback ---
  // Seller responds: accept / reject (with required reason) / counter (price + message).
  // Every action pushes a bell notification (type offer_update) to the BUYER.
  const respondToOfferSeller = (offerId: number, action: 'accept' | 'reject' | 'counter', payload?: { reason?: string; counterPrice?: number; message?: string }): { ok: boolean; error?: string } => {
    const offer = offers.find(o => o.id === offerId);
    if (!offer) return { ok: false, error: 'Offer not found.' };
    if (!['pending', 'countered'].includes(offer.status)) return { ok: false, error: 'This offer has already been responded to.' };
    const nowIso = new Date().toISOString();
    if (action === 'accept') {
      const finalPrice = offer.counterPrice ?? offer.offeredPrice;
      saveAllData({
        offers: offers.map(o => o.id === offerId ? {
          ...o, status: 'accepted' as const, finalPrice,
          sellerMessage: payload?.message?.trim() || offer.sellerMessage,
          acceptedExpiresAt: new Date(Date.now() + 2 * 3600000).toISOString()
        } : o)
      });
      forceFlushNow();
      pushAppNotification({
        audiencePhone: offer.customerPhone, type: 'offer_update',
        title: 'Your offer has been accepted!',
        message: `The seller accepted! Buy for TZS ${finalPrice.toLocaleString()} within 48 hours — go to My Offers to complete payment.`
      });
      logNotification(offer.customerPhone, `Seller accepted your offer! Pay TZS ${finalPrice.toLocaleString()} within 2 hours.`, 'sms', `/product/${offer.productId}`);
      logAction('Offer Accepted', `Offer #${offerId} accepted at TZS ${finalPrice.toLocaleString()}.`);
      return { ok: true };
    }
    if (action === 'reject') {
      const reason = payload?.reason?.trim();
      if (!reason) return { ok: false, error: 'A reason is required when rejecting.' };
      saveAllData({
        offers: offers.map(o => o.id === offerId ? { ...o, status: 'rejected' as const, sellerMessage: reason } : o)
      });
      forceFlushNow();
      pushAppNotification({
        audiencePhone: offer.customerPhone, type: 'offer_update',
        title: 'Your offer has been rejected',
        message: `Sorry, your offer of TZS ${offer.offeredPrice.toLocaleString()} was rejected. Reason: ${reason}`
      });
      logNotification(offer.customerPhone, `Sorry, the seller rejected your offer of TZS ${offer.offeredPrice.toLocaleString()}. Reason: ${reason}`, 'sms');
      logAction('Offer Rejected', `Offer #${offerId} rejected — reason: ${reason}`);
      return { ok: true };
    }
    // counter
    const cp = Number(payload?.counterPrice);
    if (!cp || cp <= 0 || cp >= offer.originalPrice) return { ok: false, error: 'Counter price must be valid and lower than original price.' };
    saveAllData({
      offers: offers.map(o => o.id === offerId ? {
        ...o, status: 'countered' as const, counterPrice: Math.round(cp * 100) / 100,
        sellerMessage: payload?.message?.trim() || offer.sellerMessage
      } : o)
    });
    forceFlushNow();
    pushAppNotification({
      audiencePhone: offer.customerPhone, type: 'offer_update',
      title: 'Seller suggested a new price',
      message: `Seller proposes TZS ${cp.toLocaleString()} instead of TZS ${offer.offeredPrice.toLocaleString()}. ${payload?.message?.trim() ? 'Message: ' + payload.message.trim() : ''} Open My Offers to respond.`
    });
    logNotification(offer.customerPhone, `Seller proposed TZS ${cp.toLocaleString()} for your offer. Respond in My Offers.`, 'sms', `/offer/${offerId}`);
    logAction('Offer Countered', `Offer #${offerId} countered at TZS ${cp.toLocaleString()}.`);
    return { ok: true };
  };

  // Buyer responds to a seller counter: accept / reject / counter again.
  const buyerRespondToOffer = (offerId: number, action: 'accept_counter' | 'reject_counter' | 'counter_again', payload?: { price?: number; message?: string }): { ok: boolean; error?: string } => {
    const offer = offers.find(o => o.id === offerId);
    if (!offer) return { ok: false, error: 'Offer not found.' };
    if (offer.status !== 'countered') return { ok: false, error: 'This offer cannot be responded to right now.' };
    const nowIso = new Date().toISOString();
    if (action === 'accept_counter') {
      const finalPrice = offer.counterPrice ?? offer.offeredPrice;
      saveAllData({
        offers: offers.map(o => o.id === offerId ? {
          ...o, status: 'accepted' as const, finalPrice,
          acceptedExpiresAt: new Date(Date.now() + 2 * 3600000).toISOString()
        } : o)
      });
      forceFlushNow();
      pushAppNotification({
        companyId: offer.companyId, type: 'offer_update',
        title: 'Customer accepted your price',
        message: `${offer.customerName} accepted TZS ${finalPrice.toLocaleString()} — awaiting payment.`
      });
      logAction('Offer Counter Accepted', `Buyer accepted counter on offer #${offerId} at TZS ${finalPrice.toLocaleString()}.`);
      return { ok: true };
    }
    if (action === 'reject_counter') {
      saveAllData({ offers: offers.map(o => o.id === offerId ? { ...o, status: 'rejected' as const } : o) });
      forceFlushNow();
      pushAppNotification({
        companyId: offer.companyId, type: 'offer_update',
        title: 'Customer rejected your price',
        message: `${offer.customerName} rejected the proposed TZS ${(offer.counterPrice ?? 0).toLocaleString()}.`
      });
      logAction('Offer Counter Rejected', `Buyer rejected counter on offer #${offerId}.`);
      return { ok: true };
    }
    // counter_again — buyer proposes a new price, offer returns to pending
    const np = Number(payload?.price);
    if (!np || np <= 0 || np >= offer.originalPrice) return { ok: false, error: 'Your price must be valid and lower than original price.' };
    saveAllData({
      offers: offers.map(o => o.id === offerId ? {
        ...o, offeredPrice: Math.round(np * 100) / 100, status: 'pending' as const,
        buyerMessage: payload?.message?.trim() || offer.buyerMessage,
        expiresAt: new Date(Date.now() + 48 * 3600000).toISOString()
      } : o)
    });
    forceFlushNow();
    addOfferMessage(offerId, 'customer', payload?.message, np);
    pushAppNotification({
      companyId: offer.companyId, type: 'offer_update',
      title: 'Customer made a new offer',
      message: `${offer.customerName} now offers TZS ${np.toLocaleString()}. Respond via the Piga Bei panel.`
    });
    logAction('Offer Countered Again', `Buyer re-countered offer #${offerId} at TZS ${np.toLocaleString()}.`);
    return { ok: true };
  };

  const decideOffer = (offerId: number, decision: 'accept' | 'reject'): void => {
    respondToOfferSeller(offerId, decision);
  };

  const initiateOfferPayment = (offerId: number, address: {
    customerRegion?: string; customerDistrict?: string; customerWard?: string; customerStreet?: string;
  }, network?: CollectionNetwork): { ok: boolean; reference?: string; orderId?: number | null; error?: string } => {
    const offer = offers.find(o => o.id === offerId);
    if (!offer) return { ok: false, error: 'Offer not found.' };
    if (offer.status !== 'accepted') return { ok: false, error: 'Offer must be accepted first.' };
    const product = marketplaceProducts.find(p => p.id === offer.productId);
    if (!product) return { ok: false, error: 'Product not found.' };
    const price = offer.finalPrice ?? offer.counterPrice ?? offer.offeredPrice;
    const res = createFeaturePayment({
      companyId: offer.companyId,
      product,
      unitPrice: price,
      customerName: offer.customerName,
      customerPhone: offer.customerPhone,
      trackingRef: `OFFER-${offer.id}`,
      network,
      ...address
    });
    if (res.ok) {
      saveAllData({ offers: offers.map(o => o.id === offer.id ? { ...o, paymentReference: res.reference, orderId: res.orderId ?? null } : o) });
    }
    return res;
  };

  // ---------- 2. NUNUA PAMOJA (Group Buying) ----------

  const createGroupDeal = (input: {
    productId: number;
    companyId: number;
    groupPrice: number;
    minBuyers: number;
    maxBuyers?: number;
    durationHours: number;
  }): { ok: boolean; dealId?: number; error?: string } => {
    const product = marketplaceProducts.find(p => p.id === input.productId);
    if (!product) return { ok: false, error: 'Product not found.' };
    if (input.groupPrice <= 0 || input.groupPrice >= product.price) return { ok: false, error: 'Group price must be lower than the regular price.' };
    if (input.minBuyers < 2) return { ok: false, error: 'Minimum buyers must be ≥ 2.' };
    const shareCode = Array.from({ length: 8 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
    const deal: GroupDeal = {
      id: Date.now(),
      productId: input.productId,
      companyId: input.companyId,
      soloPrice: product.price,
      groupPrice: Math.round(input.groupPrice * 100) / 100,
      minBuyers: input.minBuyers,
      maxBuyers: input.maxBuyers,
      currentBuyersCount: 0,
      paidCount: 0,
      expiresAt: new Date(Date.now() + input.durationHours * 3600000).toISOString(),
      shareCode,
      status: 'active',
      createdAt: new Date().toISOString()
    };
    saveAllData({ groupDeals: [deal, ...(groupDeals || [])] });
    logAction('Group Deal Created', `Nunua Pamoja #${shareCode} on product ${product.name} — group price TZS ${deal.groupPrice.toLocaleString()} (min ${input.minBuyers}).`);
    return { ok: true, dealId: deal.id };
  };

  const joinGroupDeal = (dealId: number, input: { customerName: string; customerPhone: string }): { ok: boolean; reference?: string; error?: string; alreadyPaid?: boolean } => {
    const deal = groupDeals.find(d => d.id === dealId);
    if (!deal || deal.status !== 'active') return { ok: false, error: 'Deal haipo tena.' };
    const phone = normalizeTzPhone(input.customerPhone);
    const existing = groupDealParticipants.find(p => p.groupDealId === dealId && p.customerPhone === phone && p.status !== 'cancelled');
    if (existing) return { ok: true, reference: existing.reference, alreadyPaid: existing.status === 'paid' };
    const ref = `GROUP-${dealId}-${phone}`;
    const participant: GroupDealParticipant = {
      id: Date.now(),
      groupDealId: dealId,
      customerName: input.customerName.trim(),
      customerPhone: phone,
      status: 'joined',
      reference: ref,
      joinedAt: new Date().toISOString()
    };
    const updatedDeals = groupDeals.map(d => d.id === dealId ? { ...d, currentBuyersCount: (d.currentBuyersCount || 0) + 1 } : d);
    saveAllData({ groupDealParticipants: [participant, ...(groupDealParticipants || [])], groupDeals: updatedDeals });
    logNotification(phone, `Umejiunga Nunua Pamoja #${deal.shareCode}! Lipa TZS ${deal.groupPrice.toLocaleString()} ili kukamilisha ushiriki wako.`, 'sms', `/group-deal/${dealId}`);
    return { ok: true, reference: ref };
  };

  const initiateGroupPayment = (dealId: number, address: {
    customerName?: string;
    customerPhone?: string;
    customerRegion?: string; customerDistrict?: string; customerWard?: string; customerStreet?: string;
  }, network?: CollectionNetwork): { ok: boolean; reference?: string; orderId?: number | null; error?: string } => {
    const deal = groupDeals.find(d => d.id === dealId);
    if (!deal || deal.status !== 'active') return { ok: false, error: 'Deal haipo tena.' };
    const product = marketplaceProducts.find(p => p.id === deal.productId);
    if (!product) return { ok: false, error: 'Product not found.' };
    const phone = normalizeTzPhone(address.customerPhone || '');
    if (!phone) return { ok: false, error: 'Namba ya simu si sahihi.' };
    const ref = `GROUP-${dealId}-${phone}`;
    const res = createFeaturePayment({
      companyId: deal.companyId,
      product,
      unitPrice: deal.groupPrice,
      customerName: address.customerName || 'Mteja',
      customerPhone: phone,
      trackingRef: ref,
      network,
      customerRegion: address.customerRegion,
      customerDistrict: address.customerDistrict,
      customerWard: address.customerWard,
      customerStreet: address.customerStreet
    });
    if (res.ok) {
      saveAllData({ groupDealParticipants: (groupDealParticipants || []).map(p => p.reference === ref ? { ...p, status: 'paid' as const } : p) });
    }
    return res;
  };

  // ---------- 3. WHATSAPP AI BOT ----------

  const handleWhatsappMessage = (phone: string, message: string): WhatsappConversation | null => {
    const botSettings = settings.whatsappBot || defaultSettings.whatsappBot;
    if (!botSettings.enabled) return null;
    const results = searchProducts(message, marketplaceProducts, companies, 3);
    const reply = buildReply(results, botSettings.fallbackMessage);
    const conv: WhatsappConversation = {
      id: Date.now(),
      phone: normalizeTzPhone(phone),
      messageIn: message.trim(),
      messageOut: reply,
      intent: results.length > 0 ? 'products' : 'fallback',
      productIds: results.map(r => r.product.id),
      status: 'replied',
      mode: botSettings.mode,
      createdAt: new Date().toISOString()
    };
    saveAllData({ whatsappConversations: [conv, ...(whatsappConversations || [])].slice(0, 2000) });
    logNotification(conv.phone, `WhatsApp bot: "${message.trim()}" → replied with ${results.length} product(s).`, 'sms');
    return conv;
  };

  // ---------- 4. BODABODA LIVE TRACKING ----------

  const assignDeliveryRider = (deliveryId: number, riderName: string, riderPhone: string): void => {
    const nowIso = new Date().toISOString();
    const nextDeliveries = (deliveries || []).map(d => d.id === deliveryId
      ? { ...d, riderName: riderName.trim(), riderPhone: riderPhone.trim(), status: 'assigned' as const, updatedAt: nowIso }
      : d);
    const nextUpdates = [{
      id: Date.now(),
      deliveryId,
      status: 'assigned',
      note: `Rider: ${riderName} (${riderPhone})`,
      createdAt: nowIso
    }, ...(deliveryUpdates || [])];
    saveAllData({ deliveries: nextDeliveries, deliveryUpdates: nextUpdates });
    logAction('Delivery Assigned', `Delivery #${deliveryId} assigned to ${riderName} (${riderPhone}).`);
  };

  const updateDeliveryStatus = (deliveryId: number, status: DeliveryStatus, note?: string): void => {
    const nowIso = new Date().toISOString();
    const delivery = (deliveries || []).find(d => d.id === deliveryId);
    const nextDeliveries = (deliveries || []).map(d => d.id === deliveryId ? { ...d, status, updatedAt: nowIso } : d);
    const nextUpdates = [{
      id: Date.now(),
      deliveryId,
      status,
      note: note?.trim() || undefined,
      createdAt: nowIso
    }, ...(deliveryUpdates || [])];
    saveAllData({ deliveries: nextDeliveries, deliveryUpdates: nextUpdates });
    if (delivery && (status === 'delivered' || status === 'cancelled')) {
      logNotification(delivery.customerPhone, status === 'delivered'
        ? `Bidhaa yako imefikishwa! Tracking ${delivery.trackingCode} — asante TradeCore.`
        : `Delivery ${delivery.trackingCode} imefutwa. Wasiliana na mfanyabiashara.`, 'sms', `/track/${delivery.trackingCode}`);
    }
  };

  const updateDeliveryLocation = (deliveryId: number, lat: number, lng: number): void => {
    const nowIso = new Date().toISOString();
    const nextDeliveries = (deliveries || []).map(d => d.id === deliveryId ? { ...d, riderLat: lat, riderLng: lng, updatedAt: nowIso } : d);
    const nextUpdates = [{
      id: Date.now(),
      deliveryId,
      status: 'location',
      lat,
      lng,
      note: 'Rider location update',
      createdAt: nowIso
    }, ...(deliveryUpdates || [])];
    saveAllData({ deliveries: nextDeliveries, deliveryUpdates: nextUpdates });
  };

  // ---------- 5. LIPA POLE POLE (BNPL / Installments) ----------

  const createInstallmentPlan = (input: {
    productId: number;
    companyId: number;
    downPaymentPercent: number;
    installmentsCount: number;
    installmentPercentExtra: number;
  }): { ok: boolean; planId?: number; error?: string } => {
    const product = marketplaceProducts.find(p => p.id === input.productId);
    if (!product) return { ok: false, error: 'Product not found.' };
    if (input.downPaymentPercent < 20 || input.downPaymentPercent > 50) return { ok: false, error: 'Malipo ya awali lazima yawe 20-50%.' };
    if (input.installmentsCount < 2 || input.installmentsCount > 6) return { ok: false, error: 'Idadi ya awamu lazima iwe 2-6.' };
    if (input.installmentPercentExtra < 0 || input.installmentPercentExtra > 10) return { ok: false, error: 'Riba kwa awamu lazima iwe 0-10%.' };
    const plan: InstallmentPlan = {
      id: Date.now(),
      productId: input.productId,
      companyId: input.companyId,
      totalPrice: product.price,
      downPaymentPercent: input.downPaymentPercent,
      installmentsCount: input.installmentsCount,
      installmentPercentExtra: input.installmentPercentExtra,
      status: 'active',
      createdAt: new Date().toISOString()
    };
    saveAllData({ installmentPlans: [plan, ...(installmentPlans || [])] });
    return { ok: true, planId: plan.id };
  };

  const createInstallmentOrder = (input: {
    productId: number;
    companyId: number;
    installmentPlanId: number;
    customerName: string;
    customerPhone: string;
  }): { ok: boolean; trackingCode?: string; error?: string } => {
    const plan = installmentPlans.find(p => p.id === input.installmentPlanId && p.status === 'active');
    const product = marketplaceProducts.find(p => p.id === input.productId);
    if (!plan || !product) return { ok: false, error: 'Mpango wa awamu haupatikani.' };
    const phone = normalizeTzPhone(input.customerPhone);
    if (!phone) return { ok: false, error: 'Namba ya simu si sahihi.' };
    const totalPrice = product.price;
    const downPayment = Math.round(totalPrice * plan.downPaymentPercent / 100 * 100) / 100;
    const principalPerInstallment = Math.round((totalPrice - downPayment) / plan.installmentsCount * 100) / 100;
    const installmentAmount = Math.round(principalPerInstallment * (1 + plan.installmentPercentExtra / 100) * 100) / 100;
    const trackingCode = `LP-${Math.floor(100000 + Math.random() * 900000)}`;
    const order: InstallmentOrder = {
      id: Date.now(),
      productId: input.productId,
      companyId: input.companyId,
      installmentPlanId: plan.id,
      customerName: input.customerName.trim(),
      customerPhone: phone,
      totalPrice,
      downPayment,
      remaining: Math.max(0, totalPrice - downPayment),
      installmentAmount,
      installmentsCount: plan.installmentsCount,
      paidInstallments: 0,
      totalPaid: 0,
      status: 'pending_down',
      trackingCode,
      createdAt: new Date().toISOString()
    };
    saveAllData({ installmentOrders: [order, ...(installmentOrders || [])] });
    logNotification(phone, `Lipa Pole Pole #${trackingCode} imeanzishwa. Malipo ya awali TZS ${downPayment.toLocaleString()}.`, 'sms', `/lipa-pole-pole/${trackingCode}`);
    return { ok: true, trackingCode };
  };

  const initiateInstallmentPayment = (installmentOrderId: number, type: InstallmentPaymentType, address: {
    customerRegion?: string; customerDistrict?: string; customerWard?: string; customerStreet?: string;
  }, network?: CollectionNetwork): { ok: boolean; reference?: string; error?: string } => {
    const instOrder = installmentOrders.find(o => o.id === installmentOrderId);
    if (!instOrder) return { ok: false, error: 'Agizo la awamu halipo.' };
    const product = marketplaceProducts.find(p => p.id === instOrder.productId);
    if (!product) return { ok: false, error: 'Product not found.' };
    const n = (instOrder.installmentsCount || 1);
    const isDown = type === 'down';
    const payIndex = isDown ? 'D' : `I${Math.min((instOrder.paidInstallments || 0) + 1, n)}`;
    const ref = `LP-${instOrder.id}-${payIndex}`;
    const amount = isDown ? instOrder.downPayment : instOrder.installmentAmount;
    if ((instOrder.paidInstallments || 0) >= n && !isDown) return { ok: false, error: 'Malipo yote yamekamilika.' };
    const payment: InstallmentPayment = {
      id: Date.now(),
      installmentOrderId: instOrder.id,
      amount,
      type,
      status: 'manual_pending',
      reference: ref,
      createdAt: new Date().toISOString()
    };
    saveAllData({ installmentPayments: [payment, ...(installmentPayments || [])] });
    const res = createFeaturePayment({
      companyId: instOrder.companyId,
      product,
      unitPrice: amount,
      customerName: instOrder.customerName,
      customerPhone: instOrder.customerPhone,
      trackingRef: ref,
      network,
      customerRegion: address.customerRegion,
      customerDistrict: address.customerDistrict,
      customerWard: address.customerWard,
      customerStreet: address.customerStreet
    });
    if (res.ok) {
      saveAllData({ installmentPayments: (installmentPayments || []).map(p => p.id === payment.id ? { ...p, reference: ref } : p) });
    }
    return { ok: res.ok, reference: res.reference, error: res.error };
  };

  // ---------- 6. LIVE SHOPPING (TikTok-style) ----------

  const createLiveStream = (input: {
    companyId: number;
    title: string;
    description?: string;
    productIds: number[];
    scheduledAt?: string;
  }): { ok: boolean; streamId?: number; streamKey?: string; error?: string } => {
    if (!input.title.trim()) return { ok: false, error: 'Jina la live linahitajika.' };
    const streamKey = `LIVE-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const stream: LiveStream = {
      id: Date.now(),
      companyId: input.companyId,
      title: input.title.trim(),
      description: input.description?.trim() || undefined,
      productIds: input.productIds,
      featuredProductId: input.productIds[0],
      status: 'scheduled',
      scheduledAt: input.scheduledAt,
      streamKey,
      viewersCount: 0,
      likesCount: 0,
      createdAt: new Date().toISOString()
    };
    saveAllData({ liveStreams: [stream, ...(liveStreams || [])] });
    return { ok: true, streamId: stream.id, streamKey };
  };

  const startLiveStream = (streamId: number): void => {
    const nowIso = new Date().toISOString();
    saveAllData({ liveStreams: (liveStreams || []).map(s => s.id === streamId ? { ...s, status: 'live' as LiveStreamStatus, startedAt: nowIso } : s) });
  };

  const endLiveStream = (streamId: number): void => {
    const nowIso = new Date().toISOString();
    saveAllData({ liveStreams: (liveStreams || []).map(s => s.id === streamId ? { ...s, status: 'ended' as LiveStreamStatus, endedAt: nowIso } : s) });
  };

  const addLiveComment = (streamId: number, input: { customerName: string; customerPhone?: string; message: string; type?: LiveCommentType; productId?: number }): void => {
    const comment: LiveComment = {
      id: Date.now(),
      liveStreamId: streamId,
      customerName: input.customerName.trim() || 'Mteja',
      customerPhone: input.customerPhone ? normalizeTzPhone(input.customerPhone) : undefined,
      message: input.message.trim(),
      type: input.type || 'comment',
      productId: input.productId,
      createdAt: new Date().toISOString()
    };
    saveAllData({ liveComments: [comment, ...(liveComments || [])].slice(0, 2000) });
  };

  const likeLiveStream = (streamId: number): void => {
    saveAllData({ liveStreams: (liveStreams || []).map(s => s.id === streamId ? { ...s, likesCount: (s.likesCount || 0) + 1 } : s) });
  };

  const recordLiveViewer = (streamId: number, delta = 1): void => {
    saveAllData({ liveStreams: (liveStreams || []).map(s => s.id === streamId ? { ...s, viewersCount: Math.max(0, (s.viewersCount || 0) + delta) } : s) });
  };

  // ---------- 7. LOYALTY (Pointi za Mteja) ----------

  const getLoyaltyByPhone = (phone: string): LoyaltyCustomer | undefined => {
    const p = normalizeTzPhone(phone);
    return (loyaltyCustomers || []).find(c => c.phone === p);
  };

  const redeemLoyaltyPoints = (phone: string): { ok: boolean; code?: string; valueTzs?: number; error?: string } => {
    const p = normalizeTzPhone(phone);
    if (!p) return { ok: false, error: 'Namba ya simu si sahihi.' };
    const loyaltyS = settings.loyalty || defaultSettings.loyalty;
    const customer = (loyaltyCustomers || []).find(c => c.phone === p);
    if (!customer || (customer.balancePoints || 0) < (loyaltyS.pointsToTzsRate || 100)) return { ok: false, error: 'Points zako hazitoshi kuomba code.' };
    const redeemable = Math.floor(customer.balancePoints / (loyaltyS.pointsToTzsRate || 100));
    const pointsUsed = redeemable * (loyaltyS.pointsToTzsRate || 100);
    const valueTzs = redeemable * 1000;
    const code = `LOYALTY-${p.slice(-4)}-${Math.floor(1000 + Math.random() * 9000)}`;
    const nowIso = new Date().toISOString();
    saveAllData({
      loyaltyCustomers: (loyaltyCustomers || []).map(c => c.id === customer.id ? { ...c, balancePoints: c.balancePoints - pointsUsed, usedPoints: (c.usedPoints || 0) + pointsUsed, updatedAt: nowIso } : c),
      loyaltyTransactions: [{
        id: Date.now(),
        loyaltyCustomerId: customer.id,
        type: 'redeem',
        points: pointsUsed,
        description: `Code ${code}`,
        code,
        codeValueTzs: valueTzs,
        createdAt: nowIso
      }, ...(loyaltyTransactions || [])],
      loyaltyRedeemCodes: [{ code, phone: p, valueTzs, used: false, createdAt: nowIso }, ...(loyaltyRedeemCodes || [])]
    });
    logNotification(p, `Code yako ya pointi: ${code} — thamani TZS ${valueTzs.toLocaleString()}. Tumia kwenye checkout.`, 'sms');
    return { ok: true, code, valueTzs };
  };

  const useLoyaltyCode = (code: string, orderId?: number | null): { ok: boolean; valueTzs?: number; error?: string } => {
    const entry = (loyaltyRedeemCodes || []).find(c => c.code.toLowerCase() === code.trim().toLowerCase());
    if (!entry) return { ok: false, error: 'Code si sahihi.' };
    if (entry.used) return { ok: false, error: 'Code hii imeshatumika.' };
    saveAllData({
      loyaltyRedeemCodes: (loyaltyRedeemCodes || []).map(c => c.code === entry.code ? { ...c, used: true, orderId: orderId ?? null } : c),
      loyaltyTransactions: [{
        id: Date.now(),
        loyaltyCustomerId: entry.phone ? (getLoyaltyByPhone(entry.phone)?.id ?? 0) : 0,
        type: 'expired',
        points: 0,
        description: `Code ${entry.code} ilitumika (TZS ${entry.valueTzs.toLocaleString()})`,
        orderId: orderId ?? null,
        code: entry.code,
        codeValueTzs: entry.valueTzs,
        codeUsed: true,
        createdAt: new Date().toISOString()
      }, ...(loyaltyTransactions || [])]
    });
    return { ok: true, valueTzs: entry.valueTzs };
  };

  const updateCollectionSettings = (next: CollectionSetting[]): void => {
    saveAllData({ settings: { ...settings, collectionSettings: next } });
  };

  const updateCollectionMode = (mode: 'manual' | 'auto'): void => {
    saveAllData({ settings: { ...settings, collectionMode: mode } });
  };

  const testCollection = (): void => {
    const nowIso = new Date().toISOString();
    const id = nextCollectionId();
    const reference = generateCollectionReference(id);
    const rec: CollectionRecord = {
      id,
      orderId: null,
      companyId: 0,
      customerName: 'TEST',
      customerPhone: '+2557XXXXXXXX',
      network: 'mpesa',
      amount: 1000,
      amountTzs: 1000,
      currencyCode: 'TZS',
      status: 'manual_pending_approval',
      reference,
      mode: 'manual',
      transactionId: 'TEST-TXN',
      createdAt: nowIso,
      updatedAt: nowIso
    };
    const next = [rec, ...(collections || [])].slice(0, 5000);
    setCollections(next);
    saveAllData({ collections: next });
    logAction('Collection Test', `Test collection ${reference} created (TZS 1,000, M-Pesa).`);
  };

  const clearWebhookLogs = (): void => {
    saveAllData({ webhookLogs: [] });
    logAction('Webhook Logs Cleared', 'All webhook logs were cleared by ROOT_MANDATE.');
  };

  const marketplaceCustomerLogin = (phone: string, password: string): { ok: boolean; customer?: MarketplaceCustomer; error?: string } => {
    const customer = (marketplaceCustomers || []).find(c => c.phone === phone.trim());
    if (!customer || customer.isGuest || !customer.password) {
      return { ok: false, error: t('No permanent account found with that phone number.') };
    }
    if (!verifyPassword(password, customer.password)) {
      return { ok: false, error: t('Incorrect password. Please try again.') };
    }
    return { ok: true, customer };
  };

  const updateMarketplaceCustomerLocale = (customerId: number, locale: string) => {
    const updated = (marketplaceCustomers || []).map(c => (c.id === customerId ? { ...c, locale } : c));
    setMarketplaceCustomers(updated);
    saveAllData({ marketplaceCustomers: updated });
  };

  const canManageOrder = (order: MarketplaceOrder) => {
    if (!currentUser) return false;
    if (currentUser.role === 'Super Admin') return true;
    return currentUser.companyId === order.companyId;
  };

  const ALLOWED_TRANSITIONS: Partial<Record<MarketplaceOrderStatus, MarketplaceOrderStatus[]>> = {
    pending_verification: ['verified', 'rejected'],
    verified: ['processing'],
    processing: ['out_for_delivery'],
    out_for_delivery: ['delivered'],
    delivered: [],
    rejected: []
  };

  const updateMarketplaceOrderStatus = (orderId: number, status: MarketplaceOrderStatus, reason?: string) => {
    const nowIso = new Date().toISOString();
    const target = (marketplaceOrders || []).find(o => o.id === orderId);
    if (!target) {
      toast.error(t('Order not found.'));
      return;
    }
    if (!canManageOrder(target)) {
      toast.error(t('You can only manage orders for your own company.'));
      return;
    }
    const allowed = ALLOWED_TRANSITIONS[target.status] || [];
    if (!allowed.includes(status)) {
      toast.error(t('Invalid status change. Manual verification is required first.'));
      return;
    }

    let productsRestored = false;
    const updatedOrders = (marketplaceOrders || []).map(o => {
      if (o.id !== orderId) return o;
      let updated: MarketplaceOrder = { ...o, status, rejectionReason: status === 'rejected' ? reason || 'Rejected' : o.rejectionReason, updatedAt: nowIso };
      if (status === 'verified') {
        updated = {
          ...updated,
          verifiedBy: currentUser?.username || 'staff',
          verifiedById: currentUser?.id,
          verifiedAt: nowIso
        };
      }
      if (status === 'delivered') {
        updated = {
          ...updated,
          deliveredAt: nowIso,
          autoReleaseAt: new Date(Date.now() + 48 * 3600000).toISOString(),
        };
      }
      if (status === 'rejected' && o.status !== 'rejected' && o.status !== 'delivered') {
        // Restore stock for rejected orders
        productsRestored = true;
      }
      return updated;
    });
    let updatedProducts = marketplaceProducts;
    if (productsRestored) {
      const rejected = (marketplaceOrders || []).find(o => o.id === orderId);
      if (rejected) {
        updatedProducts = marketplaceProducts.map(p => {
          const item = rejected.items.find(i => i.productId === p.id);
          if (item) return { ...p, stockQuantity: (p.stockQuantity || 0) + item.quantity };
          return p;
        });
      }
    }
    // TRA COMPLIANCE — a newly delivered order creates an EFD receipt obligation
    // (status 'pending') and adds the sale to the seller's totalSalesAmount.
    let nextTraReceipts = traReceipts;
    let nextCompanies = companies;
    if (status === 'delivered' && target.status !== 'delivered') {
      const seller = companies.find(c => c.id === target.companyId);
      const isVat = !!seller?.isVatRegistered;
      const vatAmount = isVat ? Math.round((target.totalAmount * 18) / 118) : 0;
      nextTraReceipts = [
        {
          id: Date.now() + Math.floor(Math.random() * 1000),
          orderId: target.id,
          orderNumber: target.orderNumber,
          companyId: target.companyId,
          tinNumber: seller?.tinNumber,
          customerName: target.customerName,
          amount: target.totalAmount,
          vatAmount,
          status: 'pending',
          createdAt: nowIso
        },
        ...traReceipts
      ];
      nextCompanies = companies.map(c => c.id === target.companyId ? { ...c, totalSalesAmount: (c.totalSalesAmount || 0) + target.totalAmount } : c);
    }
    const traHooked = status === 'delivered' && target.status !== 'delivered';
    const finalUpdatedOrder = updatedOrders.find(o => o.id === orderId);
    // Optimistic local
    const patchOrders = { marketplaceOrders: updatedOrders };
    const patchProducts = productsRestored ? { marketplaceProducts: updatedProducts } : {};
    const patchTra = traHooked ? { traReceipts: nextTraReceipts, companies: nextCompanies } : {};
    const fullPatch = { ...patchOrders, ...patchProducts, ...patchTra };
    dbStateRef.current = { ...dbStateRef.current, ...fullPatch };
    setMarketplaceOrders(updatedOrders);
    if (productsRestored) setMarketplaceProducts(updatedProducts);
    if (traHooked) { setTraReceipts(nextTraReceipts); setCompanies(nextCompanies); }
    // Atomic server calls — order + affected products + affected orders
    if (finalUpdatedOrder) void apiUpsertOrder(finalUpdatedOrder).catch(() => {});
    if (productsRestored) {
      for (const p of updatedProducts) { void apiUpsertProduct(p).catch(() => {}); }
    }
    if (traHooked) { for (const c of nextCompanies) { void apiUpsertUser(c).catch(() => {}); } }
    // Fallback full blob flush for safety
    saveAllData(fullPatch);
    forceFlushNow();
    // MEGA Phase 1 — Affiliate: approve the pending commission sale once the order is verified.
    if (status === 'verified') {
      const pendingSale = (affiliateSales || []).find(s => s.orderId === orderId && s.status === 'pending');
      if (pendingSale) {
        const nextSales = (affiliateSales || []).map(s => s.id === pendingSale.id ? { ...s, status: 'approved' as const } : s);
        saveAllData({ affiliateSales: nextSales });
      }
    }
    logAction('Marketplace Order', `Marketplace order ${updatedOrders.find(o => o.id === orderId)?.orderNumber || orderId} updated to ${status}${status === 'verified' ? ` by user ${currentUser?.username || 'staff'} (id ${currentUser?.id})` : ''}.`);
    toast.success(t(`Order marked as ${status.replace(/_/g, ' ')}.`));
  };

  // CRITICAL FIX Part 1 — archive / trash lifecycle for marketplace orders.
  // TRA compliance: delivered orders can only be ARCHIVED (never deleted);
  // pending/rejected orders go to Trash (soft delete) and can be purged.
  const mutateMarketplaceOrders = (op: 'archive' | 'unarchive' | 'trash' | 'restore' | 'purge', ids: number[]) => {
    const idSet = new Set(ids);
    if (!idSet.size) return;
    const nowIso = new Date().toISOString();
    const base = marketplaceOrders || [];
    const targets = base.filter(o => idSet.has(o.id));
    if (!targets.length) { toast.error(t('Order not found.')); return; }
    for (const target of targets) {
      if (!canManageOrder(target)) { toast.error(t('You can only manage orders for your own company.')); return; }
    }

    if (op === 'archive') {
      if (targets.some(o => o.status !== 'delivered')) {
        toast.error(t('Only delivered orders can be archived (TRA compliance).'));
        return;
      }
      const eligible = targets.filter(o => !o.archivedAt);
      if (!eligible.length) return;
      const archived = base.map(o => idSet.has(o.id) && o.status === 'delivered' ? { ...o, archivedAt: nowIso, updatedAt: nowIso } : o);
      saveAllData({ marketplaceOrders: archived });
      for (const o of eligible) { const upd = archived.find(x => x.id === o.id); if (upd) void apiUpsertOrder(upd).catch(() => {}); }
      forceFlushNow();
      logAction('Marketplace Order', `${eligible.length} order(s) archived (TRA archive).`);
      toast.success(`${eligible.length} ${t('orders archived')}.`);
      return;
    }

    if (op === 'unarchive') {
      const eligible = targets.filter(o => !!o.archivedAt);
      if (!eligible.length) return;
      const restored = base.map(o => idSet.has(o.id) ? { ...o, archivedAt: undefined, updatedAt: nowIso } : o);
      saveAllData({ marketplaceOrders: restored });
      for (const o of eligible) { const upd = restored.find(x => x.id === o.id); if (upd) void apiUpsertOrder(upd).catch(() => {}); }
      forceFlushNow();
      logAction('Marketplace Order', `${eligible.length} order(s) unarchived.`);
      toast.success(`${eligible.length} ${t('orders restored')}.`);
      return;
    }

    if (op === 'trash') {
      if (targets.some(o => o.status !== 'pending_verification' && o.status !== 'rejected')) {
        toast.error(t('Only pending or rejected orders can be deleted.'));
        return;
      }
      const eligible = targets.filter(o => !o.deletedAt);
      if (!eligible.length) return;
      const eligibleIds = new Set(eligible.map(o => o.id));
      // Trashing a PENDING order cancels it → restore product stock (rejected ones were restored at rejection time).
      let updatedProducts = marketplaceProducts;
      const stockBack = eligible.filter(o => o.status === 'pending_verification');
      if (stockBack.length) {
        updatedProducts = marketplaceProducts.map(p => {
          const qty = stockBack.reduce((s, o) => s + (o.items.find(i => i.productId === p.id)?.quantity || 0), 0);
          return qty > 0 ? { ...p, stockQuantity: (p.stockQuantity || 0) + qty } : p;
        });
      }
      const trashed = base.map(o => eligibleIds.has(o.id) ? { ...o, deletedAt: nowIso, updatedAt: nowIso } : o);
      saveAllData({ marketplaceOrders: trashed, ...(stockBack.length ? { marketplaceProducts: updatedProducts } : {}) });
      for (const o of eligible) { const upd = trashed.find(x => x.id === o.id); if (upd) void apiUpsertOrder(upd).catch(() => {}); }
      if (stockBack.length) { for (const p of updatedProducts) void apiUpsertProduct(p).catch(() => {}); }
      forceFlushNow();
      logAction('Marketplace Order', `${eligible.length} order(s) moved to Trash.`);
      toast.success(`${eligible.length} ${t('orders moved to trash')}.`);
      return;
    }

    if (op === 'restore') {
      const eligible = targets.filter(o => !!o.deletedAt);
      if (!eligible.length) return;
      const restored = base.map(o => idSet.has(o.id) ? { ...o, deletedAt: undefined, updatedAt: nowIso } : o);
      saveAllData({ marketplaceOrders: restored });
      for (const o of eligible) { const upd = restored.find(x => x.id === o.id); if (upd) void apiUpsertOrder(upd).catch(() => {}); }
      forceFlushNow();
      logAction('Marketplace Order', `${eligible.length} order(s) restored from Trash.`);
      toast.success(`${eligible.length} ${t('orders restored')}.`);
      return;
    }

    // purge — permanent removal from Trash
    const eligible = targets.filter(o => !!o.deletedAt);
    if (eligible.length !== targets.length) {
      toast.error(t('Only trashed orders can be permanently deleted.'));
      return;
    }
    if (!eligible.length) return;
    saveAllData({ marketplaceOrders: base.filter(o => !idSet.has(o.id)) });
    forceFlushNow();
    logAction('Marketplace Order', `${eligible.length} order(s) PERMANENTLY deleted from Trash.`);
    toast.success(`${eligible.length} ${t('orders permanently deleted')}.`);
  };

  // CRITICAL FIX Part 1 — auto-archive delivered orders older than 90 days (TRA retention policy).
  useEffect(() => {
    const cutoff = Date.now() - 90 * 24 * 3600 * 1000;
    const due = (marketplaceOrders || []).filter(o =>
      o.status === 'delivered' && !o.archivedAt && !o.deletedAt &&
      new Date(o.deliveredAt || o.createdAt).getTime() < cutoff
    );
    if (!due.length) return;
    const ids = new Set(due.map(o => o.id));
    const nowIso = new Date().toISOString();
    saveAllData({ marketplaceOrders: (marketplaceOrders || []).map(o => ids.has(o.id) ? { ...o, archivedAt: nowIso, updatedAt: nowIso } : o) });
  }, [marketplaceOrders]);

  // CRITICAL FIX Part 1 — voice search history deletion controls.
  const deleteVoiceSearch = (id: number) => {
    saveAllData({ voiceSearches: (voiceSearches || []).filter(v => v.id !== id) });
    toast.success(t('Voice search deleted.'));
  };
  const clearVoiceHistory = () => {
    saveAllData({ voiceSearches: [] });
    logAction('Voice Search', 'Entire voice search history cleared.');
    toast.success(t('Voice history cleared.'));
  };

  // TRA COMPLIANCE — company enters the EFD receipt number for a delivered order.
  const updateTraReceiptEfd = (orderId: number, efdReceiptNumber: string) => {
    const efd = efdReceiptNumber.trim();
    const receipt = traReceipts.find(r => r.orderId === orderId);
    if (receipt) {
      saveAllData({
        traReceipts: traReceipts.map(r => r.orderId === orderId ? { ...r, efdReceiptNumber: efd || undefined, status: efd ? 'issued' as const : 'pending' as const } : r)
      });
      return;
    }
    const order = marketplaceOrders.find(o => o.id === orderId);
    if (!order) return;
    saveAllData({
      traReceipts: [
        {
          id: Date.now(),
          orderId: order.id,
          orderNumber: order.orderNumber,
          companyId: order.companyId,
          customerName: order.customerName,
          amount: order.totalAmount,
          vatAmount: 0,
          efdReceiptNumber: efd || undefined,
          status: efd ? 'issued' as const : 'pending' as const,
          createdAt: new Date().toISOString()
        },
        ...traReceipts
      ]
    });
  };

  // TRA COMPLIANCE — ROOT admin verifies a company's TIN (locks editing).
  const toggleTinVerified = (companyId: number, verified: boolean) => {
    const nowIso = new Date().toISOString();
    saveAllData({
      companies: companies.map(c => c.id === companyId ? { ...c, tinVerified: verified, tinVerifiedAt: verified ? nowIso : c.tinVerifiedAt } : c)
    });
    logAction('TRA TIN', `${verified ? 'Verified' : 'Unverified'} TIN for company #${companyId} (${companies.find(c => c.id === companyId)?.name || ''}).`);
    toast.success(verified ? t('TIN imethibitishwa — haitaweza kubadilishwa na kampuni.') : t('TIN verification removed.'));
  };

  const saveMarketplaceCompanyProfile = (companyId: number, patch: Partial<Company>) => {
    const prev = companies.find(c => c.id === companyId);
    const merged = prev ? { ...prev, ...patch } : patch;
    // SEO slug: company name + region (e.g. aziz-electronics-singida), kept unique
    const city = merged.region || merged.district || '';
    const baseSlug = slugify(city ? `${merged.name} ${city}` : `${merged.name}`);
    let slug = baseSlug;
    let n = 2;
    const others = companies.filter(c => c.id !== companyId);
    while (others.some(c => c.slug === slug)) { slug = `${baseSlug}-${n++}`; }
    const updated = companies.map(c => (c.id === companyId ? { ...c, ...patch, slug } : c));
    saveAllData({ companies: updated });
    toast.success(t('Marketplace store settings saved.'));
  };

  // Track public marketplace engagement clicks (e.g. "Order via WhatsApp")
  const trackMarketplaceClick = (productId: number, type: 'whatsapp') => {
    const click: MarketplaceClick = {
      id: Date.now(),
      productId,
      type,
      createdAt: new Date().toISOString()
    };
    const capped = [click, ...marketplaceClicks].slice(0, 2000);
    saveAllData({ marketplaceClicks: capped });
  };

  // Feature 5 analytics: record a product page view. One view per product per hour
  // per device (localStorage guard) so refreshes don't inflate the charts.
  const trackProductView = (productId: number) => {
    const product = marketplaceProducts.find(p => p.id === productId);
    if (!product) return;
    const KEY = 'tradecore_viewed_products';
    let viewed: Record<string, number> = {};
    try { viewed = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { viewed = {}; }
    const now = Date.now();
    if (viewed[String(productId)] && now - viewed[String(productId)] < 60 * 60 * 1000) return;
    viewed[String(productId)] = now;
    try { localStorage.setItem(KEY, JSON.stringify(viewed)); } catch (e) {}
    const view: ProductView = {
      id: Date.now(),
      productId,
      companyId: product.companyId,
      viewedAt: new Date().toISOString()
    };
    const capped = [...productViews, view].slice(-2000);
    saveAllData({ productViews: capped });
  };

  // Feature 3: submit a public product review. New reviews are PENDING until
  // approved by ROOT_MANDATE; aggregates are only recomputed from approved rows.
  const submitMarketplaceReview = (data: {
    companyId: number;
    productId: number | null;
    reviewerName: string;
    reviewerPhone?: string;
    rating: number;
    comment?: string;
    isVerifiedBuyer: boolean;
  }): { ok: boolean; error?: string } => {
    const name = data.reviewerName.trim();
    if (name.length < 2) return { ok: false, error: t('Please enter your name.') };
    const comment = (data.comment || '').trim();
    if (comment.length > 1000) return { ok: false, error: t('Review comment is limited to 1000 characters.') };
    if (data.rating < 1 || data.rating > 5) return { ok: false, error: t('Please choose a star rating.') };
    if (isDuplicateReview(reviews, { productId: data.productId, reviewerPhone: data.reviewerPhone, reviewerName: name })) {
      return { ok: false, error: t('You have already reviewed this product in the last 24 hours.') };
    }
    const review: Review = {
      id: Date.now(),
      companyId: data.companyId,
      productId: data.productId,
      userId: null,
      reviewerName: name,
      reviewerPhone: data.reviewerPhone?.trim(),
      rating: data.rating,
      comment: comment || undefined,
      isVerifiedBuyer: data.isVerifiedBuyer,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    const nextReviews = [review, ...reviews].slice(0, 2000);
    saveAllData({ reviews: nextReviews });
    toast.success(t('Thank you! Your review is awaiting approval.'));
    return { ok: true };
  };

  // ROOT_MANDATE approves/rejects a review, then recomputes product+company ratings
  // from the approved set so storefront numbers always stay consistent.
  const updateReviewStatus = (reviewId: number, status: ReviewStatus) => {
    const nextReviews = reviews.map(r => (r.id === reviewId ? { ...r, status, decidedAt: new Date().toISOString() } : r));
    const rated = computeRatings(nextReviews, companies, marketplaceProducts);
    saveAllData({
      reviews: nextReviews,
      companies: rated.companies,
      marketplaceProducts: rated.products
    });
    toast.success(status === 'approved' ? t('Review approved.') : status === 'rejected' ? t('Review rejected.') : t('Review status updated.'));
  };

  const saveMarketplacePaymentMethod = (companyId: number, method: CompanyPaymentMethod) => {
    const updated = companies.map(c => {
      if (c.id !== companyId) return c;
      const methods = c.paymentMethods || [];
      const existing = methods.some(m => m.id === method.id);
      return { ...c, paymentMethods: existing ? methods.map(m => (m.id === method.id ? method : m)) : [...methods, method] };
    });
    saveAllData({ companies: updated });
    toast.success(t('Payment method saved.'));
  };

  const deleteMarketplacePaymentMethod = (companyId: number, methodId: number) => {
    const updated = companies.map(c => (c.id === companyId ? { ...c, paymentMethods: (c.paymentMethods || []).filter(m => m.id !== methodId) } : c));
    saveAllData({ companies: updated });
    toast.success(t('Payment method removed.'));
  };

  const saveMarketplaceProduct = (product: MarketplaceProduct) => {
    // SEO slug: product name + city (e.g. samsung-tv-singida), kept unique
    const company = companies.find(c => c.id === product.companyId);
    const city = company?.region || company?.district || '';
    const baseSlug = slugify(city ? `${product.name} ${city}` : `${product.name}`);
    let slug = baseSlug;
    let n = 2;
    const others = marketplaceProducts.filter(p => p.id !== product.id);
    while (others.some(p => p.slug === slug)) { slug = `${baseSlug}-${n++}`; }
    const finalProduct = { ...product, slug };
    const existing = marketplaceProducts.some(p => p.id === product.id);
    const updated = existing ? marketplaceProducts.map(p => (p.id === product.id ? finalProduct : p)) : [...marketplaceProducts, finalProduct];
    // Optimistic local update — instant UI
    dbStateRef.current.marketplaceProducts = updated;
    setMarketplaceProducts(updated);
    // Atomic server call — no 5 MB blob race
    void apiUpsertProduct(finalProduct).catch(() => {
      // Fallback to full blob if atomic endpoint unavailable
      saveAllData({ marketplaceProducts: updated });
      forceFlushNow();
    });
    toast.success(t('Product saved.'));
  };

  const deleteMarketplaceProduct = (productId: number) => {
    const prod = marketplaceProducts.find(p => p.id === productId);
    const updated = marketplaceProducts.filter(p => p.id !== productId);
    // Optimistic local update — instant UI, no waiting for server
    dbStateRef.current.marketplaceProducts = updated;
    setMarketplaceProducts(updated);
    lastLocalWriteTimeRef.current = Date.now();
    // Atomic small payload (10 ms) — no 5 MB blob race, dual-writes to blob for old clients
    if (prod) {
      void apiDeleteProduct(String(productId), String(prod.companyId)).catch(() => {
        // Fallback to full-blob if atomic endpoint not yet available (e.g. old cpanel not migrated)
        saveAllData({ marketplaceProducts: updated });
        forceFlushNow();
      });
    } else {
      saveAllData({ marketplaceProducts: updated });
      forceFlushNow();
    }
    toast.success(t('Product removed.'));
  };

  // --- SHIPPING ZONES ---
  const saveShippingZone = (zone: ShippingZone) => {
    const existing = (dbStateRef.current.shippingZones || []).some((z: ShippingZone) => z.id === zone.id);
    const updated = existing
      ? (dbStateRef.current.shippingZones || []).map((z: ShippingZone) => z.id === zone.id ? zone : z)
      : [...(dbStateRef.current.shippingZones || []), zone];
    saveAllData({ shippingZones: updated });
    toast.success(t('Shipping zone saved.'));
  };

  const deleteShippingZone = (zoneId: number) => {
    saveAllData({ shippingZones: (dbStateRef.current.shippingZones || []).filter((z: ShippingZone) => z.id !== zoneId) });
    toast.success(t('Shipping zone removed.'));
  };

  // --- 2-DAY FREE DEMO ACCOUNT PROVISIONING (auto-login) ---
  const handleStartDemo = (data: { username: string; password: string }) => {
    const nowIso = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 1 * 86400000).toISOString();
    const demoCompId = Math.max(0, ...companies.map(c => c.id)) + 1;
    const demoUserId = Math.max(0, ...users.map(u => u.id)) + 1;
    const demoUsername = data.username.trim().toLowerCase();
    const demoPassword = data.password;

    const newBranchId = Math.max(0, ...branches.map(b => b.id)) + 1;
    const newStoreId = Math.max(0, ...stores.map(s => s.id)) + 1;

    const newCompany: Company = {
      id: demoCompId,
      name: `Demo Company (${demoUsername})`,
      themeColor: '#1e3a8a',
      status: 'Demo',
      isDemo: true,
      demoExpiresAt: expiresAt,
      subscriptionApproved: true,
      isVerified: true,
      isMarketplaceActive: true,
      subscriptionStart: nowIso,
      subscriptionEnd: expiresAt.split('T')[0],
      planName: '1-Day Free Demo',
      paymentReference: 'DEMO-' + demoUsername,
      paymentMethod: 'Free Demo',
      country: 'Demo Account'
    };

    const newUser: User = {
      id: demoUserId,
      username: demoUsername,
      password: hashPassword(demoPassword),
      role: 'Wholesaler',
      name: 'Demo Wholesaler',
      email: `${demoUsername}@demo.tradecore.local`,
      companyId: demoCompId,
      branchId: newBranchId,
      storeId: newStoreId,
      firstLogin: false,
      status: 'Active',
      allowedPages: ['dashboard', 'stock-items', 'sales-order', 'purchase-order', 'expenses', 'receipts', 'profile']
    };

    const newBranch: Branch = { id: newBranchId, companyId: demoCompId, name: 'Demo Main Branch' };
    const newStore: Store = { id: newStoreId, branchId: newBranchId, name: 'Demo Store', location: 'Demo Centre', phone: '' };

    saveAllData({
      companies: [...companies, newCompany],
      users: [...users, newUser],
      branches: [...branches, newBranch],
      stores: [...stores, newStore]
    });

    localStorage.setItem('tradecore_user', JSON.stringify(newUser));
    setCurrentUser(newUser);
    setCurrentCompanyId(demoCompId);
    setCurrentBranchId(newBranchId);
    setCurrentStoreId(newStoreId);
    setCurrentPage('dashboard');
    setDemoSetupOpen(false);
    logAction('Demo Account Created', `1-day demo account "${demoUsername}" created and auto-logged-in with user-chosen credentials. Demo expires ${expiresAt.split('T')[0]}.`);
    toast.success(t('Welcome! Your 1-day free demo account has been created.'));
  };

  // --- SUPER ADMIN: APPROVE PAYMENT & ACTIVATE SUBSCRIPTION ---
  const handleApproveRequest = (requestId: string, months: number, note?: string) => {
    const meta = subscriptionMeta;
    const req = (meta.paymentRequests || []).find(r => r.id === requestId);
    if (!req) return;
    const safeMonths = Math.max(1, months || 1);
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + safeMonths);
    const endStr = endDate.toISOString().split('T')[0];
    const nowIso = new Date().toISOString();

    const updatedRequests = (meta.paymentRequests || []).map(r =>
      r.id === requestId
        ? { ...r, status: 'Approved' as const, adminNote: note || r.adminNote, decidedAt: nowIso, decidedBy: currentUser?.username || 'Super Admin' }
        : r
    );
    const updatedCompanies = companies.map(c =>
      c.id === req.companyId
        ? {
            ...c,
            status: 'Active' as const,
            subscriptionApproved: true,
            isDemo: false,
            isVerified: true,
            isMarketplaceActive: true,
            subscriptionStart: nowIso,
            subscriptionEnd: endStr,
            planId: req.planId,
            planName: req.planName,
            paymentReference: req.paymentReference,
            paymentMethod: req.paymentMethod,
            receiptImageUrl: req.receiptImageUrl,
            adminNote: note || ''
          }
        : c
    );
    const approvedProducts = marketplaceProducts.map(p =>
      p.companyId === req.companyId ? { ...p, status: 'approved' as const } : p
    );

    saveAllData({
      companies: updatedCompanies,
      marketplaceProducts: approvedProducts,
      settings: { ...settings, subscriptionMeta: { ...meta, paymentRequests: updatedRequests } }
    });
    toast.success(t(`Payment verified. "${req.companyName}" activated for ${safeMonths} month(s) until ${endStr}.`));
    logAction('Subscription Approved', `Payment verified & subscription activated for ${req.companyName} (${req.planName}, ${safeMonths} month(s)) until ${endStr}. Reference ${req.paymentReference}.`);
  };

  // --- SUPER ADMIN: REJECT PAYMENT REQUEST ---
  const handleRejectRequest = (requestId: string, note: string) => {
    const meta = subscriptionMeta;
    const req = (meta.paymentRequests || []).find(r => r.id === requestId);
    if (!req) return;
    const nowIso = new Date().toISOString();
    const updatedRequests = (meta.paymentRequests || []).map(r =>
      r.id === requestId
        ? { ...r, status: 'Rejected' as const, adminNote: note, decidedAt: nowIso, decidedBy: currentUser?.username || 'Super Admin' }
        : r
    );
    const updatedCompanies = companies.map(c =>
      c.id === req.companyId
        ? { ...c, status: 'Rejected' as const, subscriptionApproved: false, adminNote: note }
        : c
    );

    saveAllData({
      companies: updatedCompanies,
      settings: { ...settings, subscriptionMeta: { ...meta, paymentRequests: updatedRequests } }
    });
    toast.success(t(`Payment request for "${req.companyName}" rejected. They can resubmit after fixing the issue.`));
    logAction('Subscription Rejected', `Payment request rejected for ${req.companyName} (reference ${req.paymentReference}). Reason: ${note || 'Not specified'}.`);
  };

  // --- SUPER ADMIN: RENEW / EXTEND A COMPANY SUBSCRIPTION PERIOD ---
  const handleRenewCompany = (companyId: number, months: number, note?: string) => {
    const company = companies.find(c => c.id === companyId);
    if (!company) return;
    const safeMonths = Math.max(1, months || 1);
    const base = new Date();
    const baseEnd = company.isDemo ? company.demoExpiresAt : company.subscriptionEnd;
    if (baseEnd) {
      const endMs = /^\d{4}-\d{2}-\d{2}$/.test(baseEnd) ? new Date(baseEnd + 'T23:59:59').getTime() : new Date(baseEnd).getTime();
      if (endMs > base.getTime()) base.setTime(endMs);
    }
    base.setMonth(base.getMonth() + safeMonths);
    const endStr = base.toISOString().split('T')[0];
    const nowIso = new Date().toISOString();
    const updatedCompanies = companies.map(c =>
      c.id === companyId
        ? {
            ...c,
            status: 'Active' as const,
            subscriptionApproved: true,
            isDemo: false,
            isVerified: true,
            isMarketplaceActive: true,
            subscriptionStart: c.subscriptionStart || nowIso,
            subscriptionEnd: endStr,
            adminNote: note || c.adminNote
          }
        : c
    );
    saveAllData({ companies: updatedCompanies });
    toast.success(t(`Subscription for ${company.name} renewed for ${safeMonths} month(s) until ${endStr}.`));
    logAction('Subscription Renewed', `Subscription period renewed for ${company.name} for ${safeMonths} month(s) until ${endStr}.${note ? ' Note: ' + note : ''}`);
  };

  // --- SUPER ADMIN: DELETE A COMPANY AND ALL OF ITS DATA (FULL CASCADE) ---
  // Removing a company must purge every record that belongs to it — its accounts,
  // branches/stores and their stock/POS history, marketplace products & orders,
  // offers, group deals, deliveries, installments, live streams, wallets,
  // collections, reviews/views/clicks, affiliate sales and admin earnings.
  const handleDeleteCompany = async (companyId: number) => {
    const company = companies.find(c => c.id === companyId);
    if (!company) return;
    // DEFAULT COMPANY GUARD: the seeded default company (id 1) is the boot/snapshot
    // anchor every role falls back to. Deleting it only "comes back" after a refresh
    // (the boot snapshot reloads company 1) while corrupting the active-company cart —
    // block it outright.
    if (companyId === 1) {
      alert(t('Cannot delete the default company'));
      return;
    }
    const removedUserNames = users.filter(u => u.companyId === companyId).map(u => u.username);
    const removedBranchIds = branches.filter(b => b.companyId === companyId).map(b => b.id);
    const removedStoreIds = stores.filter(s => removedBranchIds.includes(s.branchId)).map(s => s.id);
    const removedProductIds = marketplaceProducts.filter(p => p.companyId === companyId).map(p => p.id);
    const removedOfferIds = offers.filter(o => o.companyId === companyId).map(o => o.id);
    const removedGroupDealIds = groupDeals.filter(g => g.companyId === companyId).map(g => g.id);
    const removedDeliveryIds = deliveries.filter(d => d.companyId === companyId).map(d => d.id);
    const removedInstallmentOrderIds = installmentOrders.filter(o => o.companyId === companyId).map(o => o.id);
    const removedLiveStreamIds = liveStreams.filter(s => s.companyId === companyId).map(s => s.id);
    const removedWalletIds = wallets.filter(w => w.companyId === companyId).map(w => w.id);
    const nextSubscriptionMeta = settings.subscriptionMeta
      ? {
          ...settings.subscriptionMeta,
          paymentRequests: (settings.subscriptionMeta.paymentRequests || []).filter(r => r.companyId !== companyId)
        }
      : settings.subscriptionMeta;
    saveAllData({
      companies: companies.filter(c => c.id !== companyId),
      users: users.filter(u => u.companyId !== companyId),
      branches: branches.filter(b => b.companyId !== companyId),
      stores: stores.filter(s => !removedStoreIds.includes(s.id)),
      stockItems: stockItems.filter(si =>
        si.companyId !== companyId &&
        !(si.companyId == null && Object.keys(si.stock || {}).some(sid => removedStoreIds.includes(Number(sid))))
      ),
      posShifts: posShifts.filter(p => !removedStoreIds.includes(p.storeId)),
      stockTransfers: stockTransfers.filter(st => !removedStoreIds.includes(st.fromStoreId) && !removedStoreIds.includes(st.toStoreId)),
      purchaseOrders: purchaseOrders.filter(po => !removedStoreIds.includes(po.storeId)),
      salesOrders: salesOrders.filter(so => !removedStoreIds.includes(so.storeId)),
      expenses: expenses.filter(e => !removedStoreIds.includes(e.storeId)),
      marketplaceProducts: marketplaceProducts.filter(p => p.companyId !== companyId),
      marketplaceOrders: marketplaceOrders.filter(o => o.companyId !== companyId),
      marketplaceClicks: marketplaceClicks.filter(c => c.companyId !== companyId && !removedProductIds.includes(c.productId)),
      reviews: reviews.filter(r => r.companyId !== companyId),
      productViews: productViews.filter(v => v.companyId !== companyId),
      offers: offers.filter(o => o.companyId !== companyId),
      offerMessages: offerMessages.filter(m => !removedOfferIds.includes(m.offerId)),
      groupDeals: groupDeals.filter(g => g.companyId !== companyId),
      groupDealParticipants: groupDealParticipants.filter(p => !removedGroupDealIds.includes(p.groupDealId)),
      deliveries: deliveries.filter(d => d.companyId !== companyId),
      deliveryUpdates: deliveryUpdates.filter(u => !removedDeliveryIds.includes(u.deliveryId)),
      installmentPlans: installmentPlans.filter(p => p.companyId !== companyId),
      installmentOrders: installmentOrders.filter(o => o.companyId !== companyId),
      installmentPayments: installmentPayments.filter(p => !removedInstallmentOrderIds.includes(p.installmentOrderId)),
      liveStreams: liveStreams.filter(s => s.companyId !== companyId),
      liveComments: liveComments.filter(c => !removedLiveStreamIds.includes(c.liveStreamId)),
      whatsappConversations: whatsappConversations.filter(w => !(w.productIds || []).some(pid => removedProductIds.includes(pid))),
      wallets: wallets.filter(w => w.companyId !== companyId),
      walletTransactions: walletTransactions.filter(t => t.companyId !== companyId && !removedWalletIds.includes(t.walletId)),
      withdrawals: withdrawals.filter(w => w.companyId !== companyId),
      adminEarnings: adminEarnings.filter(a => a.companyId !== companyId),
      affiliateSales: affiliateSales.filter(a => a.companyId !== companyId),
      collections: collections.filter(c => c.companyId !== companyId),
      settings: {
        ...settings,
        companySubscriptions: (settings.companySubscriptions || []).filter(s => s.companyId !== companyId),
        subscriptionMeta: nextSubscriptionMeta
      }
    });
    toast.success(t(`Company "${company.name}" and all of its data were permanently removed.`));
    logAction('Company Deleted', `Company "${company.name}" deleted by ${currentUser?.username || 'Super Admin'}. Removed users: ${removedUserNames.join(', ') || 'none'}. Full cascade of marketplace/offer/group-delivery/loyalty/wallet/collection data executed.`);
    // SERVER-SIDE PERSISTENCE: soft-delete the company row in MySQL (deleted_at) so a
    // per-company snapshot / v2_list_companies can never resurrect it, then drop the
    // local snapshot cache so a refresh cannot rebuild it from cache either. Best-effort
    // and non-blocking like the purge below.
    try { await softDeleteCompanyFromPhp(String(companyId)); } catch {}
    try { localStorage.removeItem('snapshot_company_' + companyId); } catch {}
    // SERVER-SIDE PERMANENT PURGE: the local cascade + blob flush left the normalized
    // mirror tables (companies/stores/products/stock_categories/user_accounts) and the
    // legacy per-company atomic tables intact — so the next authoritative snapshot
    // REBUILT the "deleted" company on every login. purge_company hard-removes all of
    // those rows + strips the blob server-side. Best-effort and non-blocking.
    void purgeCompanyFromPhp(String(companyId));
    // If the deleted company was the one we were working in, forget it as the active one.
    try {
      const activeSaved = localStorage.getItem('active_company_id') || localStorage.getItem('company_id');
      if (activeSaved && String(activeSaved) === String(companyId)) {
        localStorage.removeItem('active_company_id');
        localStorage.removeItem('company_id');
      }
    } catch {}
  };

  // --- ROOT_MANDATE: INSTANT VERIFY / ACTIVATE A COMPANY (no subscription-end change) ---
  const handleRootVerifyCompany = (companyId: number) => {
    const company = companies.find(c => c.id === companyId);
    if (!company) return;
    const updatedCompanies = companies.map(c =>
      c.id === companyId
        ? { ...c, status: 'Active' as const, subscriptionApproved: true, isVerified: true, isMarketplaceActive: true, adminNote: '' }
        : c
    );
    saveAllData({ companies: updatedCompanies });
    toast.success(t(`Company "${company.name}" verified & activated.`));
    logAction('Company Verified', `ROOT_MANDATE verified company "${company.name}" and activated its subscription.`);
  };

  // --- ROOT_MANDATE: BAN A COMPANY FROM THE PLATFORM ---
  const handleRootBanCompany = (companyId: number) => {
    const company = companies.find(c => c.id === companyId);
    if (!company) return;
    const updatedCompanies = companies.map(c =>
      c.id === companyId
        ? { ...c, status: 'Rejected' as const, isVerified: false, isMarketplaceActive: false }
        : c
    );
    saveAllData({ companies: updatedCompanies });
    toast.success(t(`Company "${company.name}" banned from the platform.`));
    logAction('Company Banned', `ROOT_MANDATE banned company "${company.name}" from the platform.`);
  };

  // --- ROOT_MANDATE: VIEW AS COMPANY (impersonate a company owner to help them) ---
  const handleImpersonateCompany = (companyId: number) => {
    if (!isRootUser(currentUser)) { toast.error(t('Access Denied')); return; }
    const owner = users.find(u => u.companyId === companyId && u.role === 'Admin') ||
                  users.find(u => u.companyId === companyId) || null;
    if (!owner) { toast.error(t('This company has no staff account to impersonate.')); return; }
    setRootSessionBackup(currentUser);
    localStorage.setItem('tradecore_root_backup', JSON.stringify(currentUser));
    const impersonated = { ...owner, password: undefined };
    localStorage.setItem('tradecore_user', JSON.stringify(impersonated));
    setCurrentUser(impersonated);
    explicitCompanySwitchRef.current = true;
    setCurrentCompanyId(companyId);
    setCurrentPage('dashboard');
    toast.success(t(`Viewing as ${owner.name} — use "Return to Root" to switch back.`));
    logAction('Root Impersonation', `ROOT_MANDATE started viewing the system as ${owner.username} of company #${companyId}.`);
  };

  // --- ROOT_MANDATE: RETURN FROM "VIEW AS COMPANY" BACK TO THE ROOT SESSION ---
  const handleReturnToRoot = () => {
    if (!rootSessionBackup) return;
    const backup = rootSessionBackup;
    setRootSessionBackup(null);
    localStorage.removeItem('tradecore_root_backup');
    localStorage.setItem('tradecore_user', JSON.stringify(backup));
    setCurrentUser(backup);
    setCurrentCompanyId(null);
    setCurrentPage('root-dashboard');
    toast.success(t('Returned to ROOT MANDATE session.'));
  };

  // --- REJECTED COMPANY: RESUBMIT PAYMENT INFO ---
  const handleResubmitPayment = (companyId: number, data: { paymentMethod: string; paymentReference: string; receiptImageUrl: string }) => {
    const meta = subscriptionMeta;
    const nowIso = new Date().toISOString();
    const company = companies.find(c => c.id === companyId);
    if (!company) return;

    const existingReq = (meta.paymentRequests || []).find(r => r.companyId === companyId && (r.status === 'Rejected' || r.status === 'Resubmitted'));
    let updatedRequests: PaymentConfirmationRequest[];
    if (existingReq) {
      updatedRequests = (meta.paymentRequests || []).map(r =>
        r.id === existingReq.id
          ? {
              ...r,
              status: 'Resubmitted' as const,
              paymentMethod: data.paymentMethod,
              paymentReference: data.paymentReference,
              receiptImageUrl: data.receiptImageUrl || r.receiptImageUrl,
              adminNote: undefined,
              requestedAt: nowIso,
              decidedAt: undefined,
              decidedBy: undefined
            }
          : r
      );
    } else {
      updatedRequests = [
        {
          id: 'REQ-' + Date.now(),
          companyId,
          companyName: company.name,
          userName: '',
          userEmail: '',
          userPhone: '',
          planId: company.planId || 0,
          planName: company.planName || 'Subscription',
          amount: 0,
          paymentMethod: data.paymentMethod,
          paymentReference: data.paymentReference,
          receiptImageUrl: data.receiptImageUrl || undefined,
          status: 'Resubmitted',
          requestedAt: nowIso
        },
        ...(meta.paymentRequests || [])
      ];
    }

    const updatedCompanies = companies.map(c =>
      c.id === companyId
        ? {
            ...c,
            status: 'Pending Payment' as const,
            subscriptionApproved: false,
            paymentMethod: data.paymentMethod,
            paymentReference: data.paymentReference,
            receiptImageUrl: data.receiptImageUrl || c.receiptImageUrl,
            adminNote: ''
          }
        : c
    );

    saveAllData({
      companies: updatedCompanies,
      settings: { ...settings, subscriptionMeta: { ...meta, paymentRequests: updatedRequests } }
    });
    setResubmitOpen(false);
    toast.success(t('Payment resubmitted. Super Admin will re-verify your details.'));
    logAction('Payment Resubmitted', `${company.name} resubmitted payment reference ${data.paymentReference} (${data.paymentMethod}) for re-verification.`);
  };

  // --- PENDING GATE: RE-CHECK APPROVAL STATUS FROM SERVER ---
  const handleRecheckApproval = async () => {
    try {
      const phpData = await fetchSystemDataFromPhp();
      if (phpData) {
        applyData(phpData, true);
        localStorage.setItem('tradecore_data', JSON.stringify(phpData));
        if (currentUser && phpData.users) {
          const freshUser = phpData.users.find((u: any) => u.id === currentUser.id);
          if (freshUser) {
            localStorage.setItem('tradecore_user', JSON.stringify(freshUser));
            setCurrentUser(freshUser);
          }
        }
        toast.success(t('Approval status re-checked from the server.'));
      }
    } catch (err) {
      toast.error(t('Could not reach the server. Please try again.'));
    }
  };

  const handleContextChange = (level: 'company' | 'branch' | 'store', val: number) => {
    if (level === 'company') {
      explicitCompanySwitchRef.current = true;
      setCurrentCompanyId(val);
      const b = branches.find(x => x.companyId === val);
      setCurrentBranchId(b ? b.id : null);
      const s = b ? stores.find(x => x.branchId === b.id) : null;
      setCurrentStoreId(s ? s.id : null);
    } else if (level === 'branch') {
      setCurrentBranchId(val);
      const s = stores.find(x => x.branchId === val);
      setCurrentStoreId(s ? s.id : null);
    } else if (level === 'store') {
      setCurrentStoreId(val);
    }
  };

  // Default-authoritative menu union. Used as an RBAC fallback so the navigation
  // tree can NEVER collapse to an empty array while roles/permissions are still
  // loading or when a user's stored/allowedPages is empty. This is the "full
  // authorized menu list" fallback per the navigation stability requirement.
  const ALL_CORE_PAGES = useMemo(() =>
    Array.from(new Set(Object.values(rolePermissions).flat())).concat([
      'profile', 'report-tax-vat', 'report-predictive-ai', 'subscriptions',
      'root-dashboard', 'tra-reports', 'root-disputes'
    ]),
  [rolePermissions]);

  // Stable role read from localStorage (used when currentUser prop isn't ready yet).
  // Mirrors the Sidebar's readStableUser() so the menu never flashes empty during
  // the first render / API role-loading window.
  const readStableNavUser = useCallback((): { role: string; companyId: string | null; isRoot: boolean } => {
    try {
      const raw = localStorage.getItem('tradecore_user');
      if (!raw) return { role: '', companyId: null, isRoot: false };
      const u = JSON.parse(raw);
      return {
        role: u?.role || '',
        companyId: u?.company_id ?? u?.companyId ?? null,
        isRoot: isRootUser(u),
      };
    } catch {
      return { role: '', companyId: null, isRoot: false };
    }
  }, []);

  const allowedPages = useMemo(() => {
    // RBAC FALLBACK SAFEGUARD (Requirement 3):
    // If currentUser / roles / permissions are still loading, default to the FULL
    // authorized menu for the best-known role instead of resetting to an empty
    // array. An empty array would unmount every operational panel (Stock Items,
    // Purchase Order, Sales Order, Expenses, Receipts, Master Data, Import Data,
    // Reports, AI Copilot, etc.).
    let activeRole = currentUser?.role || '';
    let activeCompanyId = currentUser?.companyId ?? null;
    let activeUserIsRoot = currentUser ? isRootUser(currentUser) : false;

    if (!currentUser) {
      const stable = readStableNavUser();
      activeRole = stable.role || activeRole;
      activeCompanyId = stable.companyId ?? activeCompanyId;
      activeUserIsRoot = stable.isRoot;
    }

    // ADMIN ACCOUNT GUARANTEE (Requirement 1):
    // For 'root_mandate' / 'superadmin' (isRootUser) and the 'Super Admin' role,
    // return the STATIC, IMMUTABLE full-access registry. This short-circuits BEFORE
    // any sync-derived `currentUser.allowedPages`, role default, or mutation logic
    // can truncate/empty/null the menu. These accounts ALWAYS see every module,
    // immune to php_sync.php blob syncs and ManageUsers assignment races.
    if (activeUserIsRoot || activeRole === 'Super Admin') {
      return Array.from(ADMIN_FULL_ACCESS_PAGES);
    }

    // Resolve the base page list for the resolved role. Never return empty.
    const defaultPages = (activeRole && rolePermissions[activeRole]) || [];
    let pages = currentUser?.allowedPages && currentUser.allowedPages.length > 0
      ? currentUser.allowedPages
      : (defaultPages.length > 0 ? defaultPages : ALL_CORE_PAGES);

    if (activeRole === 'Admin' || activeRole === 'Super Admin') {
      const adminPages = new Set(pages);
      adminPages.add('user-info');
      adminPages.add('user-access');
      adminPages.add('dashboard'); // Always allow dashboard for Admins
      pages = Array.from(adminPages);
    } else if (activeRole === 'Retailer' || activeRole === 'Wholesaler') {
      // Restrict system settings for Retailer and Wholesaler unless explicitly granted in allowedPages
      const settingPages = ['companies', 'branches', 'stores', 'taxes', 'data-recovery', 'exchange-rate', 'user-access', 'settings'];
      const explicitlyAllowed = currentUser?.allowedPages || [];
      pages = pages.filter(p => !settingPages.includes(p) || explicitlyAllowed.includes(p));
    }

    // If still empty after role resolution (unknown role), restore the full menu
    // so navigation never disappears.
    if (pages.length === 0) pages = ALL_CORE_PAGES;

    if (pages.includes('report-transaction') && !pages.includes('report-unit-velocity')) {
      pages = [...pages, 'report-unit-velocity'];
    }

    // Marketplace panels are available to every company staff member and Super Admin,
    // regardless of legacy stored allowedPages values.
    if (activeRole === 'Super Admin' || activeCompanyId) {
      pages = Array.from(new Set([...pages, 'marketplace-orders', 'marketplace-settings', 'seller-wallet', 'affiliate-program', 'seller-phase2c', 'qr-code-yangu', 'sauti-search', 'tra-report']));
    }

    // ROOT_MANDATE: God Mode dashboard visible only to the root account
    if (activeUserIsRoot) {
      pages = Array.from(new Set([...pages, 'root-dashboard', 'tra-reports']));
    }

    return pages;
  }, [currentUser, rolePermissions, ALL_CORE_PAGES, readStableNavUser]);

  // Global Keyboard Shortcuts (Ctrl+S for Save, Alt+S for POS, Alt+P for Purchase Orders)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Alt + S or Ctrl + Shift + S => Open POS Terminal
      if ((e.altKey && e.key.toLowerCase() === 's') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's')) {
        e.preventDefault();
        setShowSOModal(true);
      }
      // Alt + P or Ctrl + Shift + P => Open Purchase Order Modal
      else if ((e.altKey && e.key.toLowerCase() === 'p') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p')) {
        e.preventDefault();
        setShowPOModal(true);
      }
      // Ctrl + S => Prevent default browser save dialog
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);
  const t = (text: string) => translate(text, activeLanguage);

  // --- BROWSER NOTIFICATIONS: alert on NEW registration / payment submissions ---
  // Polls the PHP backend from ANY open tab (home, login, register, dashboard), so the
  // Super Admin gets notified even when not signed in, as long as a tab is left open.
  useEffect(() => {
    const notifSupported = typeof window !== 'undefined' && 'Notification' in window;
    if (!notifSupported) return;

    const requestPermission = () => {
      if (Notification.permission === 'default') {
        try { Notification.requestPermission().catch(() => {}); } catch (e) {}
      }
    };
    requestPermission();
    const gestureHandler = () => requestPermission();
    window.addEventListener('pointerdown', gestureHandler, { once: true });

    const knownKey = 'tradecore_known_pending_reqs';
    const getKnown = (): string[] => {
      try { return JSON.parse(localStorage.getItem(knownKey) || '[]'); } catch (e) { return []; }
    };

    const checkForNewRegistrations = async () => {
      try {
        // Lightweight timestamp probe first — the heavy full-state fetch only runs when
        // something actually changed, so background polling never thrashes a shared host.
        const { apiUrl, apiKey } = getPhpConfig();
        if (!apiUrl) return;
        const headers: Record<string, string> = { 'Accept': 'application/json' };
        if (apiKey) headers['X-API-Key'] = apiKey;
        const pollAbort = new AbortController();
        const pollTimeout = window.setTimeout(() => pollAbort.abort(), 8000);
        const resp = await fetch(`${apiUrl}?action=check_timestamp`, { method: 'GET', headers, cache: 'no-store', signal: pollAbort.signal });
        window.clearTimeout(pollTimeout);
        if (!resp.ok) return;
        const probe = await resp.json();
        if (!(probe && probe.success && probe.lastUpdated)) return;
        const probeMs = (() => {
          const t = new Date(String(probe.lastUpdated)).getTime();
          return Number.isFinite(t) ? t : 0;
        })();
        const knownMs = (() => {
          const t = new Date(String(lastServerTimestampRef.current)).getTime();
          return Number.isFinite(t) ? t : 0;
        })();
        if (probeMs === knownMs) return;
        const data = await fetchSystemDataFromPhp();
        if (!data) return;
        lastServerTimestampRef.current = probe.lastUpdated;
        const reqs = data?.settings?.subscriptionMeta?.paymentRequests;
        if (!Array.isArray(reqs)) return;
        const pending = reqs.filter((r: any) => r && (r.status === 'Pending' || r.status === 'Resubmitted'));
        const pendingIds = pending.map((r: any) => r.id);
        const known = getKnown();
        const newOnes = pending.filter((r: any) => !known.includes(r.id));
        try { localStorage.setItem(knownKey, JSON.stringify(pendingIds)); } catch (e) {}
        if (newOnes.length === 0) return;
        if (Notification.permission === 'granted') {
          for (const r of newOnes.slice(0, 3)) {
            try {
              new Notification('New Payment Submission — Global TradeCore', {
                body: `${r.companyName} — ${r.planName} — Ref: ${r.paymentReference}`,
                tag: 'tradecore-new-request',
                icon: '/favicon.ico'
              });
            } catch (e) {}
          }
        }
        // In-app toast (only when a Super Admin is signed in on this tab)
        try {
          const stored = JSON.parse(localStorage.getItem('tradecore_user') || 'null');
          if (stored && stored.role === 'Super Admin') {
            toast.info(`${newOnes.length} new payment submission${newOnes.length > 1 ? 's' : ''} awaiting verification in Subscriptions & Payments.`);
          }
        } catch (e) {}
      } catch (err) {
        // Best-effort polling — failures are silent.
      }
    };

    const interval = window.setInterval(checkForNewRegistrations, 30000);
    const initial = window.setTimeout(checkForNewRegistrations, 5000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(initial);
      window.removeEventListener('pointerdown', gestureHandler);
    };
  }, []);

  // Helper variables for data fetching
  const getStoreName = (id: number) => stores.find(s => s.id === id)?.name || `Store #${id}`;
  const getCustomerName = (id: number) => customers.find(c => c.id === id)?.name || 'Direct Customer';
  const getSupplierName = (id: number) => suppliers.find(s => s.id === id)?.name || 'Direct Supplier';
  const getProductName = (id: number) => stockItems.find(p => p.id === id)?.name || 'Product Item';

  const formatStockQty = (qty: number, item: StockItem) => {
    if (item.useSubUnitPricing && item.subUnitConversion && item.subUnitConversion > 1) {
      const mainUnits = Math.floor(qty / item.subUnitConversion);
      const subUnits = parseFloat((qty % item.subUnitConversion).toFixed(4));
      
      const mainLabel = item.unit || 'Pkg';
      const subLabel = item.subUnitName || 'pcs';
      
      if (mainUnits > 0 && subUnits > 0) {
        return `${mainUnits} ${mainLabel}, ${subUnits} ${subLabel}`;
      } else if (mainUnits > 0) {
        return `${mainUnits} ${mainLabel}`;
      } else {
        return `${subUnits} ${subLabel}`;
      }
    }
    return `${qty} ${item.unit || 'pcs'}`;
  };

  const isItemLowStock = (p: StockItem, qty: number) => {
    const conversion = p.useSubUnitPricing ? (p.subUnitConversion || 1) : 1;
    return (qty / conversion) <= p.lowStockQty;
  };

  // --- SUB-PANEL RENDERS ---
  
  // 1. Dashboard Segment
  const renderDashboard = () => {
    const storeId = currentStoreId;
    const activeStoreIds = storeId ? [storeId] : visibleStores.map(s => s.id);
    
    const storeStock = (p: StockItem) => {
      if (storeId) {
        return p.stock?.[storeId] || 0;
      }
      return activeStoreIds.reduce((sum, sId) => sum + (p.stock?.[sId] || 0), 0);
    };

    const getItemValuation = (p: StockItem) => {
      const rawQty = storeStock(p);
      const mainQty = p.useSubUnitPricing ? rawQty / (p.subUnitConversion || 1) : rawQty;
      return mainQty * p.purchasePrice;
    };
    
    const totalStockValue = activeStockItems.reduce((acc, p) => acc + getItemValuation(p), 0);
    const lowStockItems = activeStockItems.filter(p => {
      if (storeId) {
        return (p.stock?.[storeId] || 0) <= p.lowStockQty;
      } else {
        return activeStoreIds.some(sId => (p.stock?.[sId] || 0) <= p.lowStockQty) || activeStoreIds.length === 0;
      }
    });
    const lowStockCount = lowStockItems.length;

    const todayStr = new Date().toISOString().split('T')[0];
    const todaySalesAmt = activeSalesOrders
      .filter(so => so.date === todayStr && activeStoreIds.includes(so.storeId))
      .reduce((acc, so) => acc + so.total, 0);

    const todayPurchasesAmt = activePurchaseOrders
      .filter(po => po.date === todayStr && po.status === 'Received' && activeStoreIds.includes(po.storeId))
      .reduce((acc, po) => acc + po.total, 0);

    const receivables = customers.reduce((sum, c) => sum + (c.balance || 0), 0);
    const payables = activePurchaseOrders
      .filter(po => po.status === 'Pending' && activeStoreIds.includes(po.storeId))
      .reduce((sum, po) => sum + po.total, 0);

    const todayMs = new Date(todayStr).getTime();
    const expiryAlerts: Array<{
      product: StockItem;
      storeName: string;
      expiryDate: string;
      daysRemaining: number;
      status: 'expired' | 'critical' | 'warning' | 'safe';
    }> = [];

    activeStockItems.forEach(p => {
      activeStoreIds.forEach(sId => {
        const qty = p.stock?.[sId] || 0;
        if (qty > 0) {
          const expDate = p.expiryDates?.[sId] || p.expiryDate;
          if (expDate) {
            const expMs = new Date(expDate).getTime();
            const daysRemaining = Math.ceil((expMs - todayMs) / (1000 * 60 * 60 * 24));
            const status = daysRemaining < 0 ? 'expired' : daysRemaining <= 7 ? 'critical' : daysRemaining <= 30 ? 'warning' : 'safe';
            if (status !== 'safe') {
              const storeObj = visibleStores.find(s => s.id === sId);
              expiryAlerts.push({
                product: p,
                storeName: storeObj ? storeObj.name : `Store #${sId}`,
                expiryDate: expDate,
                daysRemaining,
                status: status as 'expired' | 'critical' | 'warning' | 'safe'
              });
            }
          }
        }
      });
    });

    expiryAlerts.sort((a, b) => a.daysRemaining - b.daysRemaining);

    const userCompany = companies.find(c => c.id === currentUser?.companyId);

    return (
      <div className="space-y-6">
        {/* Company Logo and Title Banner (Centered) */}
        {userCompany && (
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center justify-center gap-4 text-center animate-fade-in no-print mx-auto max-w-2xl">
            {userCompany.logoUrl ? (
              <img
                src={userCompany.logoUrl}
                alt={`${userCompany.name} Logo`}
                className="w-16 h-16 rounded-xl object-contain bg-gray-50 border border-gray-200 shadow-inner shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-brand to-brand-hover text-white flex items-center justify-center font-black text-2xl shadow-md uppercase shrink-0">
                {userCompany.name.slice(0, 2)}
              </div>
            )}
            <div className="text-center sm:text-left">
              <div className="text-[10px] font-extrabold text-brand tracking-widest uppercase mb-0.5">{t('Enterprise Workspace')}</div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                {userCompany.name}
              </h2>
            </div>
          </div>
        )}

        {/* System & Data Sync Status — full persistence-health widget mounted in the
            Dashboard header next to the KPI metrics/alerts (overrides the compact
            top-nav dot, which remains available on every non-dashboard page). */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm no-print flex flex-wrap items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center text-brand shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-gray-900">{t('System Data Sync')}</div>
              <div className="text-[10px] text-gray-400 font-semibold">
                {t('MySQL persistence · IndexedDB offline queue')}
              </div>
            </div>
          </div>
          <SyncStatusIndicator variant="card" t={t} />
        </div>

        {/* Expiry Alerts Notification Banner */}
        {expiryAlerts.length > 0 && (
          <div className="bg-red-50/80 border border-red-100 rounded-2xl p-5 shadow-xs animate-fade-in no-print">
            <div className="flex flex-col md:flex-row items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                <ShieldAlert className="w-5 h-5 animate-pulse" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-red-900 mb-1 flex items-center gap-1.5">
                  {t('Product Expiration Alerts')}
                  <span className="px-2 py-0.5 text-[10px] font-extrabold bg-red-600 text-white rounded-full uppercase">
                    {expiryAlerts.length} {t('Items')}
                  </span>
                </h3>
                <p className="text-xs text-red-700 font-semibold mb-3">
                  {t('The following registered inventory lines have either crossed their expiry threshold or are within critical 30-day limits.')}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {expiryAlerts.map(alert => {
                    const isExpired = alert.status === 'expired';
                    const isCritical = alert.status === 'critical';
                    return (
                      <div 
                        key={`${alert.product.id}-${alert.storeName}`} 
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs font-semibold shadow-xs transition hover:scale-[1.01] ${
                          isExpired 
                            ? 'bg-red-100 border-red-200 text-red-950' 
                            : isCritical 
                              ? 'bg-amber-100/80 border-amber-200 text-amber-950 animate-pulse' 
                              : 'bg-orange-50 border-orange-200 text-orange-950'
                        }`}
                      >
                        <div className="min-w-0">
                          <span className="font-bold block truncate text-slate-900">{alert.product.name}</span>
                          <span className="text-[10px] font-mono opacity-80 block uppercase tracking-wider">SKU: {alert.product.code} | {alert.storeName}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="block font-black text-[10px] uppercase tracking-wider">
                            {isExpired 
                              ? t('EXPIRED') 
                              : `${alert.daysRemaining} ${t('days left')}`}
                          </span>
                          <span className="text-[9px] font-bold opacity-85 block font-mono">{alert.expiryDate}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}



        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-start">
            <div>
              <span className="text-xs font-bold text-gray-400 block uppercase tracking-wider mb-1">{t('TOTAL INVENTORY VALUE')}</span>
              <span className="text-[26px] font-black text-gray-900 leading-tight">
                {formatMoney(totalStockValue, activeCurrency, activeExchangeRate)}
              </span>
              <span className="text-xs text-gray-400 block mt-2 font-semibold">{t('Active store level valuation')}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center text-brand">
              <Package className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-start">
            <div>
              <span className="text-xs font-bold text-gray-400 block uppercase tracking-wider mb-1">{t('LOW STOCK CRITICALS')}</span>
              <span className="text-[26px] font-black text-red-600 leading-tight">{lowStockCount}</span>
              <span className="text-xs text-amber-500 block mt-2 font-semibold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> {t('Requires immediate purchase')}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-500">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-start">
            <div>
              <span className="text-xs font-bold text-gray-400 block uppercase tracking-wider mb-1">{t("TODAY'S TURNOVER")}</span>
              <span className="text-[26px] font-black text-emerald-600 leading-tight">
                {formatMoney(todaySalesAmt, activeCurrency, activeExchangeRate)}
              </span>
              <span className="text-xs text-gray-400 block mt-2 font-semibold">
                {t('Completed checkout registers')}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-start">
            <div>
              <span className="text-xs font-bold text-gray-400 block uppercase tracking-wider mb-1">{t("TODAY'S PURCHASES")}</span>
              <span className="text-[26px] font-black text-purple-600 leading-tight">
                {formatMoney(todayPurchasesAmt, activeCurrency, activeExchangeRate)}
              </span>
              <span className="text-xs text-gray-400 block mt-2 font-semibold">{t('Received PO invoices')}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-500">
              <ShoppingCart className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-start">
            <div>
              <span className="text-xs font-bold text-gray-400 block uppercase tracking-wider mb-1">{t('TOTAL RECEIVABLES')}</span>
              <span className="text-[26px] font-black text-amber-600 leading-tight">
                {formatMoney(receivables, activeCurrency, activeExchangeRate)}
              </span>
              <span className="text-xs text-gray-400 block mt-2 font-semibold">{t('Customer outstanding ledger balances')}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-start">
            <div>
              <span className="text-xs font-bold text-gray-400 block uppercase tracking-wider mb-1">{t('TOTAL PAYABLES')}</span>
              <span className="text-[26px] font-black text-indigo-600 leading-tight">
                {formatMoney(payables, activeCurrency, activeExchangeRate)}
              </span>
              <span className="text-xs text-gray-400 block mt-2 font-semibold">{t('Unresolved supplier invoices')}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500">
              <DollarIcon className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Interactive Visual Analytics Dashboards */}
        <ChartErrorBoundary resetKey={dailySalesData}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
          {/* Daily Sales & Profit Area Chart */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold text-gray-950 text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-brand" /> {t('Sales & Profit Trendlines (Last 15 Days)')}
                </h4>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#c41e3a]" />{t('Turnover')}
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />{t('Profit')}
                  </span>
                </div>
              </div>
              <div className="h-72 w-full text-xs font-semibold">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailySalesData} margin={rechartsMargin}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#c41e3a" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#c41e3a" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tick={rechartsTick} />
                    <YAxis tickLine={false} axisLine={false} tick={rechartsTick} />
                    <Tooltip contentStyle={rechartsTooltipStyle} />
                    <Area type="monotone" dataKey="Sales" name={t('Turnover')} stroke="#c41e3a" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" isAnimationActive={false} />
                    <Area type="monotone" dataKey="Profit" name={t('Profit')} stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorProfit)" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Expense Breakdown Pie Chart */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold text-gray-950 text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-purple-600" /> {t('Expense Category Breakdown')}
                </h4>
                <span className="text-[10px] text-gray-400 font-bold uppercase">{t('Donut Chart')}</span>
              </div>
              <div className="h-72 w-full text-xs font-semibold relative flex flex-col items-center justify-center">
                {expenseCategoryData.length > 0 ? (
                  <>
                    <div className="w-full h-[calc(100%-38px)]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={expenseCategoryData}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={80}
                            paddingAngle={4}
                            dataKey="value"
                            isAnimationActive={false}
                          >
                            {expenseCategoryData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={rechartsColors[index % rechartsColors.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={formatChartMoney} contentStyle={rechartsTooltipStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pt-1">
                      {expenseCategoryData.map((entry, index) => (
                        <span key={`pie-legend-${index}`} className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500">
                          <span className="w-2 h-2 rounded-full" style={{ background: rechartsColors[index % rechartsColors.length] }} />
                          {entry.name}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-gray-400 text-[11px] font-bold text-center">
                    {t('No registered expenses to build breakdown visualization.')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        </ChartErrorBoundary>

        {/* Top Products Inventory Valuation */}
        <ChartErrorBoundary resetKey={topProductsStockValue}>
        <div className="grid grid-cols-1 gap-6 no-print">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-gray-950 text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-500" /> {t('Top Products by Capital Asset Value')}
              </h4>
              <span className="text-[10px] text-gray-400 font-bold uppercase">{t('Store Valuation')}</span>
            </div>
            <div className="h-64 w-full text-xs font-semibold">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProductsStockValue} barSize={40}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
<XAxis dataKey="name" tickLine={false} axisLine={false} tick={rechartsTick} />
                   <YAxis tickLine={false} axisLine={false} tick={rechartsTick} />
                  <Tooltip formatter={formatChartMoney} contentStyle={rechartsTooltipStyle} />
                  <Bar dataKey="value" name={t('Asset Valuation')} radius={[6, 6, 0, 0]} isAnimationActive={false}>
                    {topProductsStockValue.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={rechartsColors[(index + 2) % rechartsColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        </ChartErrorBoundary>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col justify-between">
            <div>
              <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between">
                <span className="font-bold text-gray-900 text-sm">Recent Completed Sales</span>
                <button onClick={() => setCurrentPage('report-sales')} className="text-xs font-bold text-brand hover:underline">View Sales Ledger</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-400 font-bold uppercase tracking-wider text-[10px] border-b">
                    <tr>
                      <th className="px-6 py-3">Sales Order #</th>
                      <th className="px-6 py-3">Client</th>
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {activeSalesOrders.filter(so => storeId ? so.storeId === storeId : true).slice(0, 5).map(so => (
                      <tr key={so.id} className="hover:bg-gray-50/50">
                        <td className="px-6 py-3.5 font-bold text-brand font-mono">{so.soNumber}</td>
                        <td className="px-6 py-3.5 font-semibold text-gray-900">{getCustomerName(so.customerId)}</td>
                        <td className="px-6 py-3.5 text-gray-500">{so.date}</td>
                        <td className="px-6 py-3.5 text-right font-bold text-gray-900">
                          {formatMoney(so.total, activeCurrency, activeExchangeRate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex-1">
              <div>
                <div className="flex items-center gap-2 mb-6 text-red-500 border-b pb-4">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-bold text-gray-900 text-sm">{t('Critical Low Stock Alerts') || 'Critical Low Stock Alerts'}</span>
                </div>
                <div className="space-y-4 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
                  {lowStockItems.map(p => (
                    <div key={p.id} className="flex items-center justify-between border-b border-gray-50 pb-3">
                      <div>
                        <span className="font-bold text-gray-900 text-xs block">{p.name}</span>
                        <span className="text-[10px] font-mono text-gray-400 tracking-wider uppercase mt-0.5">{p.code}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-red-600 block">{storeStock(p)}</span>
                        <span className="text-[9px] text-gray-400 font-semibold block uppercase">limit: {p.lowStockQty}</span>
                      </div>
                    </div>
                  ))}
                  {lowStockItems.length === 0 && (
                    <div className="text-center py-10 text-gray-400 font-medium text-xs">
                      <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                      All stock items sufficiently configured.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex-1">
              <div>
                <div className="flex items-center gap-2 mb-6 text-amber-500 border-b pb-4">
                  <ShieldAlert className="w-5 h-5" />
                  <span className="font-bold text-gray-900 text-sm">{t('Product Expiration Alerts') || 'Product Expiration Alerts'}</span>
                </div>
                <div className="space-y-4 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
                  {expiryAlerts.map(alert => {
                    const isExpired = alert.status === 'expired';
                    const isCritical = alert.status === 'critical';
                    return (
                      <div key={`${alert.product.id}-${alert.storeName}`} className="flex items-center justify-between border-b border-gray-50 pb-3">
                        <div>
                          <span className="font-bold text-gray-900 text-xs block">{alert.product.name}</span>
                          <span className="text-[10px] font-mono text-gray-400 tracking-wider uppercase mt-0.5">{alert.product.code} | {alert.storeName}</span>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs font-black block uppercase ${
                            isExpired ? 'text-red-600' : isCritical ? 'text-amber-600' : 'text-orange-500'
                          }`}>
                            {isExpired ? t('EXPIRED') : `${alert.daysRemaining} ${t('days left')}`}
                          </span>
                          <span className="text-[9px] text-gray-400 font-semibold block font-mono mt-0.5">{alert.expiryDate}</span>
                        </div>
                      </div>
                    );
                  })}
                  {expiryAlerts.length === 0 && (
                    <div className="text-center py-10 text-gray-400 font-medium text-xs">
                      <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                      No expiring products in this store.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleApproveShip = (transfer: StockTransfer) => {
    const item = stockItems.find(p => p.id === transfer.productId);
    if (!item) return;
    const conversion = item.useSubUnitPricing ? (item.subUnitConversion || 1) : 1;
    const transferQtyInBaseUnits = transfer.qty * conversion;

    if ((item.stock?.[transfer.fromStoreId] || 0) < transferQtyInBaseUnits) {
      toast.error(t('Insufficient stock weights in the source store.'));
      return;
    }
    // Deduct from source store only!
    const updatedStock = stockItems.map(p => {
      if (p.id === transfer.productId) {
        const nextStockObj = { ...p.stock };
        nextStockObj[transfer.fromStoreId] = (nextStockObj[transfer.fromStoreId] || 0) - transferQtyInBaseUnits;
        return { ...p, stock: nextStockObj };
      }
      return p;
    });
    // Set transfer status to In-Transit
    const updatedTransfers = stockTransfers.map(t => {
      if (t.id === transfer.id) {
        return { ...t, status: 'In-Transit' as const, sentAt: new Date().toISOString().split('T')[0] };
      }
      return t;
    });

    saveAllData({ stockItems: updatedStock, stockTransfers: updatedTransfers });
    logAction('Stock Transfer Dispatched', `Dispatched ${transfer.qty}x ${item.name} from ${stores.find(s => s.id === transfer.fromStoreId)?.name} (In Transit).`);
    toast.success(t('Stock transfer has been dispatched and is now IN-TRANSIT.'));
  };

  const handleReceiveComplete = (transfer: StockTransfer) => {
    const item = stockItems.find(p => p.id === transfer.productId);
    if (!item) return;
    const conversion = item.useSubUnitPricing ? (item.subUnitConversion || 1) : 1;
    const transferQtyInBaseUnits = transfer.qty * conversion;

    // Add to receiving store!
    const updatedStock = stockItems.map(p => {
      if (p.id === transfer.productId) {
        const nextStockObj = { ...p.stock };
        nextStockObj[transfer.toStoreId] = (nextStockObj[transfer.toStoreId] || 0) + transferQtyInBaseUnits;
        return { ...p, stock: nextStockObj };
      }
      return p;
    });

    // Set transfer status to Completed
    const updatedTransfers = stockTransfers.map(t => {
      if (t.id === transfer.id) {
        return { ...t, status: 'Completed' as const, receivedAt: new Date().toISOString().split('T')[0] };
      }
      return t;
    });

    saveAllData({ stockItems: updatedStock, stockTransfers: updatedTransfers });
    logAction('Stock Transfer Completed', `Received ${transfer.qty}x ${item.name} at ${stores.find(s => s.id === transfer.toStoreId)?.name}.`);
    toast.success(t('Stock transfer completed successfully! Inventory updated.'));
  };

  const handleRejectTransfer = (transfer: StockTransfer) => {
    const item = stockItems.find(p => p.id === transfer.productId);
    if (!item) return;

    // Just mark as Rejected (no stock was deducted when pending)
    const updatedTransfers = stockTransfers.map(t => {
      if (t.id === transfer.id) {
        return { ...t, status: 'Rejected' as const };
      }
      return t;
    });

    saveAllData({ stockTransfers: updatedTransfers });
    logAction('Stock Transfer Rejected', `Rejected transfer of ${transfer.qty}x ${item.name}.`);
    toast.success(t('Stock transfer request rejected and cancelled.'));
  };

  const handleDeleteTransfer = (transferId: number) => {
    const updatedTransfers = stockTransfers.filter(t => t.id !== transferId);
    saveAllData({ stockTransfers: updatedTransfers });
    toast.success(t('Stock transfer manifest deleted successfully.'));
  };

  // 2. Stock items component controller
  const renderStockItems = () => {
    const isRetailer = currentUser?.role === 'Retailer';
    const storeId = currentStoreId || 1;
    
    const filteredStockItems = activeStockItems.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(stockSearchQuery.toLowerCase()) || 
                            p.code.toLowerCase().includes(stockSearchQuery.toLowerCase());
      const matchesCategory = stockFilterCategory === '' || p.category === stockFilterCategory;
      return matchesSearch && matchesCategory;
    });

    // Bulk selection helpers (selection survives search/filter; export uses selected when present)
    const exportStockItems = selectedStockIds.length > 0
      ? filteredStockItems.filter(p => selectedStockIds.includes(p.id))
      : filteredStockItems;

    const allFilteredSelected = filteredStockItems.length > 0 &&
      filteredStockItems.every(p => selectedStockIds.includes(p.id));

    const toggleStockSelection = (id: number) => {
      setSelectedStockIds(prev =>
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      );
    };

    const toggleAllStockSelection = () => {
      if (allFilteredSelected) {
        const shownIds = new Set(filteredStockItems.map(p => p.id));
        setSelectedStockIds(prev => prev.filter(id => !shownIds.has(id)));
      } else {
        const shownIds = filteredStockItems.map(p => p.id);
        setSelectedStockIds(prev => Array.from(new Set([...prev, ...shownIds])));
      }
    };

    const handleExportStockPDF = () => {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const title = `${t('Registered Products List')} - ${currentStoreId ? getStoreName(currentStoreId) : 'All Stores'}`;
      const scopeNote = selectedStockIds.length > 0
        ? `${t('Selected')} ${exportStockItems.length} ${t('product(s)')}`
        : `${t('All filtered products')} (${exportStockItems.length})`;

      let y = 18;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(196, 30, 58);
      doc.text(title, 14, y);
      y += 6;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`${scopeNote} | Generated on: ${new Date().toLocaleString()}`, 14, y);
      y += 5;

      const startX = 10;
      const colWidths = [45, 30, 28, 24, ...visibleStores.map(() => 20), 22, 22, 22, 26];
      const headers = [
        'Product Name', 'SKU / Code', 'Category', 'Global Stock',
        ...visibleStores.map(s => s.name),
        'Cost Price', 'Retail Price', 'Wholesale Price', 'Total Value'
      ];

      const drawRow = (cells: string[], rowY: number, isHeader: boolean) => {
        let x = startX;
        cells.forEach((cell, idx) => {
          if (isHeader) {
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(255, 255, 255);
            doc.setFillColor(196, 30, 58);
          } else {
            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(40, 40, 40);
            doc.setFillColor(255, 255, 255);
          }
          doc.rect(x, rowY, colWidths[idx] || 20, 7, 'F');
          doc.text(cell.slice(0, 40), x + 1, rowY + 4.5);
          x += colWidths[idx] || 20;
        });
      };

      drawRow(headers, y, true);
      y += 7;

      exportStockItems.forEach(p => {
        if (y > 195) {
          doc.addPage();
          y = 14;
        }
        const allowedStoreIds = visibleStores.map(s => s.id);
        const globalStock = Object.entries(p.stock || {})
          .filter(([sid]) => allowedStoreIds.includes(Number(sid)))
          .reduce((sum, [_, qty]) => sum + (Number(qty) || 0), 0);
        const mainGlobalStock = p.useSubUnitPricing ? globalStock / (p.subUnitConversion || 1) : globalStock;
        const totalValue = mainGlobalStock * p.purchasePrice;
        const cells = [
          p.name,
          p.code,
          p.category,
          String(globalStock),
          ...visibleStores.map(s => String(p.stock?.[s.id] || 0)),
          formatMoney(p.purchasePrice, activeCurrency, activeExchangeRate),
          formatMoney(p.retailPrice, activeCurrency, activeExchangeRate),
          formatMoney(p.wholesalePrice, activeCurrency, activeExchangeRate),
          formatMoney(totalValue, activeCurrency, activeExchangeRate)
        ];
        drawRow(cells, y, false);
        y += 7;
      });

      doc.save(`Stock_Inventory_Report_${new Date().toISOString().split('T')[0]}.pdf`);
      logAction('Exported Stock PDF', `Downloaded stock inventory PDF (${exportStockItems.length} products)`);
      toast.success(t('Stock inventory exported to PDF!'));
    };

    const handleExportStockExcel = () => {
      let tableHtml = `
        <h3>${t('Registered Products List')} - ${currentStoreId ? getStoreName(currentStoreId) : 'All Stores'}</h3>
        <p>Generated on: ${new Date().toLocaleString()}</p>
        <table>
          <thead>
            <tr>
              <th style="background-color: ${activeCompanyColor}; color: white; padding: 10px;">Product Name</th>
              <th style="background-color: ${activeCompanyColor}; color: white; padding: 10px;">SKU / Code</th>
              <th style="background-color: ${activeCompanyColor}; color: white; padding: 10px;">Category</th>
              <th style="background-color: ${activeCompanyColor}; color: white; padding: 10px; text-align: center;">Total Global Stock</th>
      `;
      
      visibleStores.forEach(s => {
        tableHtml += `
              <th style="background-color: ${activeCompanyColor}; color: white; padding: 10px; text-align: center;">${s.name} Stock</th>
        `;
      });
      
      tableHtml += `
              <th style="background-color: ${activeCompanyColor}; color: white; padding: 10px; text-align: right;">Cost Price</th>
              <th style="background-color: ${activeCompanyColor}; color: white; padding: 10px; text-align: right;">Retail Price</th>
              <th style="background-color: ${activeCompanyColor}; color: white; padding: 10px; text-align: right;">Wholesale Price</th>
              <th style="background-color: ${activeCompanyColor}; color: white; padding: 10px; text-align: right;">Total Value</th>
            </tr>
          </thead>
          <tbody>
      `;
      
      exportStockItems.forEach(p => {
        const allowedStoreIds = visibleStores.map(s => s.id);
        const globalStock = Object.entries(p.stock || {})
          .filter(([sid]) => allowedStoreIds.includes(Number(sid)))
          .reduce((sum, [_, qty]) => sum + (Number(qty) || 0), 0);
        const mainGlobalStock = p.useSubUnitPricing ? globalStock / (p.subUnitConversion || 1) : globalStock;
        const totalValue = mainGlobalStock * p.purchasePrice;
        
        tableHtml += `
          <tr>
            <td style="font-weight: bold; color: #111827; padding: 8px;">${p.name}</td>
            <td style="font-family: monospace; color: #6b7280; padding: 8px;">${p.code}</td>
            <td style="padding: 8px;">${p.category}</td>
            <td style="text-align: center; font-weight: bold; padding: 8px;">${globalStock}</td>
        `;
        
        visibleStores.forEach(s => {
          const itemStock = p.stock?.[s.id] || 0;
          tableHtml += `
            <td style="text-align: center; padding: 8px;">${itemStock}</td>
          `;
        });
        
        tableHtml += `
            <td style="text-align: right; padding: 8px;">${formatMoney(p.purchasePrice, activeCurrency, activeExchangeRate)}</td>
            <td style="text-align: right; color: #2563eb; padding: 8px;">${formatMoney(p.retailPrice, activeCurrency, activeExchangeRate)}</td>
            <td style="text-align: right; color: #d97706; padding: 8px;">${formatMoney(p.wholesalePrice, activeCurrency, activeExchangeRate)}</td>
            <td style="text-align: right; font-weight: bold; background-color: #f0fdf4; color: #15803d; padding: 8px;">${formatMoney(totalValue, activeCurrency, activeExchangeRate)}</td>
          </tr>
        `;
      });
      
      // Add total rows
      const allowedStoreIds = visibleStores.map(s => s.id);
      const grandTotalValue = exportStockItems.reduce((acc, p) => {
        const globalStock = Object.entries(p.stock || {})
          .filter(([sid]) => allowedStoreIds.includes(Number(sid)))
          .reduce((sum, [_, qty]) => sum + (Number(qty) || 0), 0);
        return acc + (globalStock * p.purchasePrice);
      }, 0);
      
      const totalGlobalStockSum = exportStockItems.reduce((acc, p) => {
        const globalStock = Object.entries(p.stock || {})
          .filter(([sid]) => allowedStoreIds.includes(Number(sid)))
          .reduce((sum, [_, qty]) => sum + (Number(qty) || 0), 0);
        return acc + globalStock;
      }, 0);
      
      tableHtml += `
            <tr style="background-color: #fef2f2; font-weight: bold;">
              <td colspan="3" style="text-align: right; padding: 10px;">${t('Total Filtered Stock Summary:')}</td>
              <td style="text-align: center; padding: 10px; color: #dc2626;">${totalGlobalStockSum}</td>
      `;
      
      visibleStores.forEach(s => {
        const storeStockSum = exportStockItems.reduce((acc, p) => acc + (p.stock?.[s.id] || 0), 0);
        tableHtml += `
              <td style="text-align: center; padding: 10px;">${storeStockSum}</td>
        `;
      });
      
      tableHtml += `
              <td colspan="3"></td>
              <td style="text-align: right; color: #15803d; padding: 10px;">${formatMoney(grandTotalValue, activeCurrency, activeExchangeRate)}</td>
            </tr>
          </tbody>
        </table>
      `;
      
      exportToExcel(tableHtml, `Stock_Inventory_Report_${new Date().toISOString().split('T')[0]}`);
    };



    return (
      <div className="space-y-4">
        <AIStockCopilot
          products={activeStockItems}
          storeId={storeId}
          t={t}
          formatMoney={formatMoney}
          activeCurrency={activeCurrency}
          activeExchangeRate={activeExchangeRate}
          saveAllData={saveAllData}
          logAction={logAction}
          toast={toast}
        />
        {/* Search & Category Filter bar */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between no-print">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={t('Search product...')}
                value={stockSearchQuery}
                onChange={(e) => setStockSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand/20 outline-none"
              />
            </div>
            <select
              value={stockFilterCategory}
              onChange={(e) => setStockFilterCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none bg-white font-medium text-gray-700 hover:border-gray-400 focus:border-brand cursor-pointer"
            >
              <option value="">{t('All Categories')}</option>
              {getStoreCategories(categories, currentStoreId).map(c => (
                <option key={c} value={c}>{cleanCategoryName(c)}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectedStockIds.length > 0 && (
              <>
                <span className="text-[11px] font-bold text-brand px-2 py-1 bg-brand/10 rounded-lg">
                  {selectedStockIds.length} {t('selected')}
                </span>
                <button
                  onClick={() => setSelectedStockIds([])}
                  className="px-2 py-2 text-xs font-bold text-gray-500 hover:text-gray-800 transition"
                  title={t('Clear selection')}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            <button
              onClick={handleExportStockExcel}
              className="px-3 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap shadow-sm"
              title={selectedStockIds.length > 0 ? "Export selected stock list to Excel" : "Export Stock list directly to Excel"}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-green-600" /> {t('Export Stock')}
            </button>
            <button
              onClick={handleExportStockPDF}
              className="px-3 py-2 border border-red-300 hover:bg-red-50 text-red-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap shadow-sm"
              title={selectedStockIds.length > 0 ? "Export selected stock list to PDF" : "Export Stock list to PDF"}
            >
              <FileText className="w-3.5 h-3.5 text-red-600" /> {t('Export PDF')}
            </button>
            <button
              onClick={() => {
                handlePrintWithFallback((title, desc) => {
                  setConfirmModal({
                    isOpen: true,
                    title,
                    description: desc,
                    confirmText: t('Got it'),
                    cancelText: t('Close'),
                    onConfirm: () => {}
                  });
                }, activeLanguage);
              }}
              className="px-3 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap shadow-sm"
              title="Print current stock list"
            >
              <Printer className="w-3.5 h-3.5 text-blue-600" /> {t('Print')}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
            <span className="text-sm font-bold text-gray-900">{t('Registered Products List')} ({filteredStockItems.length})</span>
            <div className="flex gap-2">
              <button
                onClick={() => { setTransferProductId(null); setShowTransferModal(true); }}
                className="border border-gray-300 hover:bg-gray-50 px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" /> {t('Transfer Stock')}
              </button>
              {!isRetailer && (
                <button
                  onClick={() => { setEditingStockItem(null); setFormUseSubUnit(false); setShowStockModal(true); }}
                  className="bg-brand hover:bg-brand-hover text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap shadow-sm"
                >
                  <Plus className="w-4 h-4" /> {t('Add Product')}
                </button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left min-w-[1000px]">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase font-bold text-[10px]">
                <tr>
                  <th className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleAllStockSelection}
                      className="accent-brand w-3.5 h-3.5 cursor-pointer"
                      title={t('Select all filtered products')}
                    />
                  </th>
                  <th className="px-4 py-3">{t('Product Description')}</th>
                  <th className="px-4 py-3">{t('Category')}</th>
                  <th className="px-4 py-3 text-center">{t('Unit')}</th>
                  <th className="px-4 py-3 text-center">{t('Total Global Stock')}</th>
                  {visibleStores.map(s => (
                    <th key={s.id} className="px-4 py-3 text-center">{s.name}</th>
                  ))}
                  <th className="px-4 py-3 text-right">{t('Cost Price')}</th>
                  <th className="px-4 py-3 text-right">{t('Retail price')}</th>
                  <th className="px-4 py-3 text-right text-emerald-600 font-bold">{t('Unit Profit')}</th>
                  <th className="px-4 py-3 text-right">{t('Wholesale price')}</th>
                  <th className="px-4 py-3 text-right text-indigo-600">{t('Partner Price')}</th>
                  <th className="px-4 py-3 text-right text-indigo-700">{t('Total Value')}</th>
                  {!isRetailer && <th className="px-4 py-3 w-20"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-semibold">
                {filteredStockItems.map(p => {
                  const allowedStoreIds = visibleStores.map(s => s.id);
                  const globalStock = Object.entries(p.stock || {})
                    .filter(([sid]) => allowedStoreIds.includes(Number(sid)))
                    .reduce((sum, [_, qty]) => sum + (Number(qty) || 0), 0);
                  const isLow = isItemLowStock(p, p.stock?.[storeId] || 0);
                  const isExpanded = expandedStockIds.includes(p.id);
                  const totalCols = 11 + visibleStores.length + (!isRetailer ? 1 : 0);
                  
                  return (
                    <React.Fragment key={p.id}>
                      <tr className={`hover:bg-gray-50/50 ${isLow ? 'bg-red-50/20' : ''} ${selectedStockIds.includes(p.id) ? 'bg-brand/5' : ''}`}>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedStockIds.includes(p.id)}
                            onChange={() => toggleStockSelection(p.id)}
                            className="accent-brand w-3.5 h-3.5 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3 flex items-center gap-3">
                          {p.useSubUnitPricing ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedStockIds(prev => 
                                  prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                                );
                              }}
                              className="p-1 hover:bg-gray-100 rounded text-gray-500 transition-colors shrink-0"
                              title={t('Show Sub-unit Breakdown')}
                            >
                              <ChevronDown className={`w-3.5 h-3.5 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                          ) : (
                            <div className="w-[22px] shrink-0" />
                          )}
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center font-bold text-brand overflow-hidden border border-gray-200/65 flex-shrink-0">
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              'P'
                            )}
                          </div>
                          <div>
                            <span className="font-bold text-gray-900 block">{p.name}</span>
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] font-mono text-gray-400 uppercase">{p.code}</span>
                              {(() => {
                                const currentStore = currentStoreId || 1;
                                const activeBatches = p.batches?.[currentStore]?.filter(b => b.qty > 0) || [];
                                if (activeBatches.length > 0) {
                                  return (
                                    <span
                                      onClick={() => setFifoBatchProduct(p)}
                                      className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-extrabold border border-purple-200 cursor-pointer hover:bg-purple-200 transition"
                                      title={t('Active FIFO Queued Batches - Click to Inspect')}
                                    >
                                      <Layers className="w-2.5 h-2.5 text-purple-600 shrink-0" />
                                      FIFO ({activeBatches.length} {activeBatches.length === 1 ? t('batch') : t('batches')})
                                    </span>
                                  );
                                }
                                return null;
                              })()}
                              {(() => {
                                const expiriesToRender: { storeId?: number; storeName?: string; date: string }[] = [];
                                if (storeId) {
                                  const expD = p.expiryDates?.[storeId] || p.expiryDate;
                                  if (expD) expiriesToRender.push({ storeId, date: expD });
                                } else {
                                  visibleStores.forEach(s => {
                                    if ((p.stock?.[s.id] || 0) > 0) {
                                      const expD = p.expiryDates?.[s.id] || p.expiryDate;
                                      if (expD) {
                                        if (!expiriesToRender.some(x => x.date === expD && x.storeId === s.id)) {
                                          expiriesToRender.push({ storeId: s.id, storeName: s.name, date: expD });
                                        }
                                      }
                                    }
                                  });
                                  if (expiriesToRender.length === 0 && p.expiryDate) {
                                    expiriesToRender.push({ date: p.expiryDate });
                                  }
                                }

                                if (expiriesToRender.length === 0) return null;

                                return expiriesToRender.map((exp, idx) => {
                                  const todayStr = new Date().toISOString().split('T')[0];
                                  const todayMs = new Date(todayStr).getTime();
                                  const expMs = new Date(exp.date).getTime();
                                  const daysRemaining = Math.ceil((expMs - todayMs) / (1000 * 60 * 60 * 24));
                                  
                                  let badgeClass = "bg-green-50 text-green-700 border-green-200";
                                  let badgeText = `${daysRemaining} ${t('days left')}`;
                                  if (daysRemaining < 0) {
                                    badgeClass = "bg-red-50 text-red-700 border-red-200 animate-pulse font-black";
                                    badgeText = t('EXPIRED');
                                  } else if (daysRemaining <= 7) {
                                    badgeClass = "bg-red-50 text-red-600 border-red-100 font-extrabold";
                                    badgeText = `${daysRemaining} ${t('days!')}`;
                                  } else if (daysRemaining <= 30) {
                                    badgeClass = "bg-amber-50 text-amber-700 border-amber-200 font-bold";
                                  }
                                  
                                  const label = exp.storeName ? `${exp.storeName}: ${badgeText}` : badgeText;
                                  return (
                                    <span key={idx} className={`text-[9px] px-1.5 py-0.5 rounded border ${badgeClass} flex items-center gap-0.5 whitespace-nowrap mt-1`}>
                                      <Calendar className="w-2.5 h-2.5 text-current shrink-0" />
                                      {label} ({exp.date})
                                    </span>
                                  );
                                });
                              })()}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3"><span className="bg-gray-100 px-2 py-1 rounded text-gray-600 text-[10px]">{p.category}</span></td>
                        <td className="px-4 py-3 text-center">
                          <span className="bg-indigo-50 text-indigo-700 font-bold px-2.5 py-0.5 rounded-full text-[10px]">
                            {p.unit || 'Package'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-gray-900">{formatStockQty(globalStock, p)}</td>
                        {visibleStores.map(s => {
                          const itemStock = p.stock?.[s.id] || 0;
                          return (
                            <td key={s.id} className={`px-4 py-3 text-center font-bold ${isItemLowStock(p, itemStock) ? 'text-amber-600' : 'text-gray-700'}`}>
                              {formatStockQty(itemStock, p)}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-right text-gray-500">{formatMoney(p.purchasePrice, activeCurrency, activeExchangeRate)}</td>
                        <td className="px-4 py-3 text-right text-blue-600">{formatMoney(p.retailPrice, activeCurrency, activeExchangeRate)}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600 bg-emerald-50/40">
                          {(() => {
                            const unitProfit = p.retailPrice - p.purchasePrice;
                            const marginPct = p.retailPrice > 0 ? ((unitProfit / p.retailPrice) * 100).toFixed(0) : '0';
                            return (
                              <span>
                                {unitProfit >= 0 ? '+' : ''}{formatMoney(unitProfit, activeCurrency, activeExchangeRate)}
                                <span className="text-[9px] block text-emerald-700 font-normal">({marginPct}% margin)</span>
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3 text-right text-amber-600">{formatMoney(p.wholesalePrice, activeCurrency, activeExchangeRate)}</td>
                        <td className="px-4 py-3 text-right text-indigo-600">{formatMoney(p.partnerPrice || p.retailPrice, activeCurrency, activeExchangeRate)}</td>
                        <td className="px-4 py-3 text-right text-indigo-700 bg-indigo-50/20">
                          {formatMoney((p.useSubUnitPricing ? globalStock / (p.subUnitConversion || 1) : globalStock) * p.purchasePrice, activeCurrency, activeExchangeRate)}
                        </td>
                        {!isRetailer && (
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 justify-end">
                              <button
                                onClick={() => setFifoBatchProduct(p)}
                                className="p-1 hover:bg-gray-100 rounded text-purple-600"
                                title="View FIFO Batches & Stock Valuation"
                              >
                                <Layers className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => { setTransferProductId(p.id); setShowTransferModal(true); }}
                                className="p-1 hover:bg-gray-100 rounded text-gray-500"
                                title="Transfer Location"
                              >
                                <ArrowLeftRight className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => { setEditingStockItem(p); setFormUseSubUnit(p.useSubUnitPricing || false); setShowStockModal(true); }}
                                className="p-1 hover:bg-gray-100 rounded text-blue-600"
                                title="Modify Details"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              {(currentUser?.role === 'Admin' || currentUser?.role === 'Super Admin') && (
                                <button
                                  onClick={() => {
                                    setConfirmModal({
                                      isOpen: true,
                                      title: 'Delete Product',
                                      description: `Are you sure you want to globally remove SKU: ${p.code} (${p.name})? This action is irreversible.`,
                                      onConfirm: () => {
                                        // ISOLATED MICRO-UPDATE: soft-delete ONLY this record
                                        // (atomic functional setState + per-record ack) so a stale
                                        // background sync can never resurrect the deleted product.
                                        const softDeleted = { ...p, isDeleted: true, updated_at: Date.now() };
                                        void mutateCollectionRecord('stockItems', 'upsert', p.id, softDeleted);
                                        logAction('Deleted Product', `Moved SKU: ${p.code} to Data Recovery Hub`);
                                        toast.success(`${p.name} moved to Data Recovery Hub.`);
                                      }
                                    });
                                  }}
                                  className="p-1 hover:bg-red-50 rounded text-red-600"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>

                      {isExpanded && p.useSubUnitPricing && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={totalCols} className="p-5 border-t border-b border-indigo-100">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200/60 pb-3 mb-4">
                              <div>
                                <h5 className="font-bold text-gray-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                                  <span className="w-1.5 h-3 bg-brand rounded-full"></span>
                                  {t('Sub-Unit Breakdown & Loose Inventory')}
                                </h5>
                                <p className="text-[10px] text-gray-500 font-semibold mt-0.5">
                                  {t('Detailed loose stocks, conversion ratios, and unit pricing configuration.')}
                                </p>
                              </div>
                              <div className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-[11px] font-bold text-gray-700 flex items-center gap-3 shadow-xs">
                                <span>
                                  {t('Packaging Conversion Ratio')}:{' '}
                                  <span className="text-brand font-black">
                                    1 {p.unit || 'Pkg'} = {p.subUnitConversion || 1} {p.subUnitName || 'pcs'}
                                  </span>
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                              {/* Detailed Stock by Store */}
                              <div className="lg:col-span-2 space-y-2">
                                <h6 className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">{t('Warehouse Inventory Breakdown')}</h6>
                                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
                                  <table className="w-full text-left text-[11px] border-collapse">
                                    <thead className="bg-gray-50 text-[10px] font-bold uppercase text-gray-500 border-b">
                                      <tr>
                                        <th className="p-2.5 px-3">{t('Store / Warehouse')}</th>
                                        <th className="p-2.5 px-3 text-center">{t('Formatted Stock')}</th>
                                        <th className="p-2.5 px-3 text-center">{t('Exact Loose Count')}</th>
                                        <th className="p-2.5 px-3 text-center">{t('Equivalent Full Packs')}</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 font-semibold text-gray-700">
                                      {visibleStores.map(s => {
                                        const rawStock = p.stock?.[s.id] || 0;
                                        const conversion = p.subUnitConversion || 1;
                                        const fullPacks = Math.floor(rawStock / conversion);
                                        const looseRemainder = parseFloat((rawStock % conversion).toFixed(4));
                                        
                                        return (
                                          <tr key={s.id} className="hover:bg-gray-50/50">
                                            <td className="p-2.5 px-3 text-gray-900 font-bold">{s.name}</td>
                                            <td className="p-2.5 px-3 text-center text-indigo-700 font-black">{formatStockQty(rawStock, p)}</td>
                                            <td className="p-2.5 px-3 text-center font-mono font-black text-gray-800">
                                              {rawStock} <span className="text-gray-400 font-bold">{p.subUnitName || 'pcs'}</span>
                                            </td>
                                            <td className="p-2.5 px-3 text-center font-mono text-gray-600">
                                              {fullPacks} {p.unit || 'Pkg'} {looseRemainder > 0 ? `+ ${looseRemainder} ${p.subUnitName || 'pcs'}` : ''}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                      <tr className="bg-slate-50 font-black text-gray-900 border-t">
                                        <td className="p-2.5 px-3">{t('Global Summary')}</td>
                                        <td className="p-2.5 px-3 text-center text-indigo-700">{formatStockQty(globalStock, p)}</td>
                                        <td className="p-2.5 px-3 text-center font-mono">
                                          {globalStock} <span className="text-gray-500">{p.subUnitName || 'pcs'}</span>
                                        </td>
                                        <td className="p-2.5 px-3 text-center font-mono text-gray-700">
                                          {Math.floor(globalStock / (p.subUnitConversion || 1))} {p.unit || 'Pkg'}
                                          {globalStock % (p.subUnitConversion || 1) > 0 ? ` + ${parseFloat((globalStock % (p.subUnitConversion || 1)).toFixed(4))} ${p.subUnitName || 'pcs'}` : ''}
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              {/* Unit Pricing Specs Card */}
                              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex flex-col justify-between">
                                <div>
                                  <h6 className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-3">{t('Loose Unit Price Matrix')}</h6>
                                  <div className="space-y-2.5">
                                    <div className="flex justify-between items-center text-[11px] font-semibold py-1.5 border-b border-gray-100">
                                      <span className="text-gray-500">{t('Loose Retail Price')} ({t('per')} {p.subUnitName || 'pc'})</span>
                                      <span className="font-bold text-blue-600">{formatMoney(p.subUnitRetailPrice || 0, activeCurrency, activeExchangeRate)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[11px] font-semibold py-1.5 border-b border-gray-100">
                                      <span className="text-gray-500">{t('Loose Wholesale Price')} ({t('per')} {p.subUnitName || 'pc'})</span>
                                      <span className="font-bold text-amber-600">{formatMoney(p.subUnitWholesalePrice || 0, activeCurrency, activeExchangeRate)}</span>
                                    </div>
                                    {p.subUnitPartnerPrice && (
                                      <div className="flex justify-between items-center text-[11px] font-semibold py-1.5 border-b border-gray-100">
                                        <span className="text-gray-500">{t('Loose Partner Price')} ({t('per')} {p.subUnitName || 'pc'})</span>
                                        <span className="font-bold text-indigo-600">{formatMoney(p.subUnitPartnerPrice || 0, activeCurrency, activeExchangeRate)}</span>
                                      </div>
                                    )}
                                    <div className="flex justify-between items-center text-[11px] font-semibold py-1.5">
                                      <span className="text-gray-500">{t('Implied Bulk Value')} ({t('calculated')})</span>
                                      <span className="font-black text-gray-900">
                                        {formatMoney((p.subUnitRetailPrice || 0) * (p.subUnitConversion || 1), activeCurrency, activeExchangeRate)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-lg text-[9px] text-slate-500 font-semibold mt-4">
                                  💡 {t('This breakdown is live. High-velocity retail sales automatically subtract from these exact sub-unit totals.')}
                                </div>
                              </div>
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
        </div>

        {/* --- INTER-STORE TRANSFERS MANIFEST --- */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mt-6">
          <div className="p-4 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50/50">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-brand/10 text-brand rounded-lg">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-gray-900 text-sm block">{t('Inter-Store Transfers Manifest')}</span>
                <span className="text-[10px] text-gray-500">{t('Track and reconcile physical stock movements between store locations')}</span>
              </div>
            </div>
            {/* Filter tabs */}
            <div className="flex items-center gap-1 overflow-x-auto bg-gray-100 p-1 rounded-lg shrink-0">
              {(['All', 'Pending', 'In-Transit', 'Completed', 'Rejected'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setTransferFilter(tab)}
                  className={`px-3 py-1 rounded-md text-[10px] font-bold transition whitespace-nowrap ${
                    transferFilter === tab
                      ? 'bg-white text-gray-900 shadow-xs'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {t(tab)}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 border-b text-gray-500 uppercase font-bold text-[10px]">
                <tr>
                  <th className="p-3">{t('Manifest No.')}</th>
                  <th className="p-3">{t('Product')}</th>
                  <th className="p-3">{t('From Location')}</th>
                  <th className="p-3">{t('To Location')}</th>
                  <th className="p-3 text-center">{t('Quantity')}</th>
                  <th className="p-3">{t('Request Date')}</th>
                  <th className="p-3">{t('Transit Timeline')}</th>
                  <th className="p-3">{t('Status')}</th>
                  <th className="p-3 text-right">{t('Reconciliation Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-semibold text-gray-700">
                {stockTransfers
                  .filter(transfer => transferFilter === 'All' || transfer.status === transferFilter)
                  .map(transfer => {
                    const product = stockItems.find(p => p.id === transfer.productId);
                    const sourceStore = stores.find(s => s.id === transfer.fromStoreId);
                    const destStore = stores.find(s => s.id === transfer.toStoreId);

                    return (
                      <tr key={transfer.id} className="hover:bg-gray-50 transition">
                        <td className="p-3 font-mono text-gray-900">{transfer.transferNumber}</td>
                        <td className="p-3">
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-900">{product?.name || `Product #${transfer.productId}`}</span>
                            <span className="text-[10px] text-gray-400 font-mono">SKU: {product?.code || '-'}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-gray-100 border border-gray-200 text-gray-700 rounded text-[10px] font-bold">
                            {sourceStore?.name || `Store #${transfer.fromStoreId}`}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-brand/5 border border-brand/10 text-brand rounded text-[10px] font-bold">
                            {destStore?.name || `Store #${transfer.toStoreId}`}
                          </span>
                        </td>
                        <td className="p-3 text-center text-gray-900 font-bold">{transfer.qty}</td>
                        <td className="p-3 text-gray-500 font-mono text-[10px]">{transfer.createdAt}</td>
                        <td className="p-3">
                          <div className="flex flex-col gap-0.5 text-[10px] text-gray-500 font-mono">
                            {transfer.sentAt && (
                              <span>🚢 {t('Shipped')}: {transfer.sentAt}</span>
                            )}
                            {transfer.receivedAt && (
                              <span>📦 {t('Received')}: {transfer.receivedAt}</span>
                            )}
                            {!transfer.sentAt && !transfer.receivedAt && (
                              <span className="text-gray-400 italic">{t('Not yet dispatched')}</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          {transfer.status === 'Pending' && (
                            <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1 w-max">
                              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" />
                              {t('Pending Dispatch')}
                            </span>
                          )}
                          {transfer.status === 'In-Transit' && (
                            <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1 w-max">
                              <Truck className="w-3 h-3 text-blue-500 animate-bounce" />
                              {t('In-Transit')}
                            </span>
                          )}
                          {transfer.status === 'Completed' && (
                            <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 w-max">
                              <CheckCircle className="w-3 h-3 text-emerald-500" />
                              {t('Completed')}
                            </span>
                          )}
                          {transfer.status === 'Rejected' && (
                            <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 flex items-center gap-1 w-max">
                              <XCircle className="w-3 h-3 text-red-500" />
                              {t('Rejected')}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center gap-1.5 justify-end">
                            {transfer.status === 'Pending' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleApproveShip(transfer)}
                                  className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold shadow-xs transition"
                                >
                                  {t('Dispatch')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRejectTransfer(transfer)}
                                  className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded text-[10px] font-bold border border-red-200 transition"
                                >
                                  {t('Reject')}
                                </button>
                              </>
                            )}
                            {transfer.status === 'In-Transit' && (
                              <button
                                type="button"
                                onClick={() => handleReceiveComplete(transfer)}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold shadow-xs transition"
                              >
                                {t('Verify Receipt')}
                              </button>
                            )}
                            {['Completed', 'Rejected'].includes(transfer.status) && (
                              <span className="text-[10px] text-gray-400 italic font-medium">
                                {t('Reconciled')}
                              </span>
                            )}
                            {(currentUser?.role === 'Admin' || currentUser?.role === 'Super Admin') && (
                              <button
                                type="button"
                                onClick={() => handleDeleteTransfer(transfer.id)}
                                className="p-1 text-red-600 hover:bg-red-50 hover:text-red-700 rounded transition border border-transparent hover:border-red-100"
                                title={t('Delete Manifest')}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                {stockTransfers.filter(transfer => transferFilter === 'All' || transfer.status === transferFilter).length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-gray-400 font-medium">
                      <Truck className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      {t('No stock transfers found matching the filter.')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // 3. Purchase Order Component Log view
  const renderPurchaseOrders = () => {
    const storeFilteredPOs = activePurchaseOrders.filter(po => currentStoreId ? po.storeId === currentStoreId : true);
    const totalPOVal = storeFilteredPOs.reduce((acc, po) => acc + (po.total || 0), 0);
    const pendingCount = storeFilteredPOs.filter(po => po.status === 'Pending').length;
    const receivedCount = storeFilteredPOs.filter(po => po.status === 'Received').length;

    return (
      <div className="space-y-4">
        {/* KPI Summary Header Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{t('Total Purchase Orders')}</p>
              <p className="text-lg font-black text-slate-900 mt-0.5">{storeFilteredPOs.length}</p>
            </div>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{t('Pending Receiving')}</p>
              <p className="text-lg font-black text-amber-600 mt-0.5">{pendingCount}</p>
            </div>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <RefreshCw className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{t('Received Orders')}</p>
              <p className="text-lg font-black text-emerald-600 mt-0.5">{receivedCount}</p>
            </div>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{t('Total PO Value')}</p>
              <p className="text-lg font-black text-brand mt-0.5">{formatMoney(totalPOVal, activeCurrency, activeExchangeRate)}</p>
            </div>
            <div className="p-2 bg-brand/10 text-brand rounded-lg">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <span className="font-bold text-gray-900 text-sm">{t('Purchase Order Journals')}</span>
            <button
              onClick={() => setShowPOModal(true)}
              className="bg-brand hover:bg-brand-hover text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
            >
              <Plus className="w-4 h-4" /> {t('Create PO')}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 border-b text-gray-500 uppercase font-bold text-[10px]">
                <tr>
                  <th className="p-3">{t('PO Number')}</th>
                  <th className="p-3">{t('Store Name')}</th>
                  <th className="p-3">{t('Supplier')}</th>
                  <th className="p-3">{t('Date')}</th>
                  <th className="p-3">{t('Product Name')}</th>
                  <th className="p-3 text-right">{t('Grand Total')}</th>
                  <th className="p-3">{t('Status')}</th>
                  <th className="p-3 text-right">{t('Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-semibold">
                {storeFilteredPOs.map(po => (
                  <tr key={po.id} className="hover:bg-gray-50/50">
                    <td className="p-3 font-bold text-brand font-mono">{po.poNumber}</td>
                    <td className="p-3 text-gray-900 font-bold">{getStoreName(po.storeId)}</td>
                    <td className="p-3 text-gray-900">{getSupplierName(po.supplierId)}</td>
                    <td className="p-3 text-gray-500">{po.date}</td>
                    <td className="p-3 text-gray-600 font-medium">
                      {po.items.map(i => `${getProductName(i.productId)} (x${i.qty})`).join(', ')}
                    </td>
                    <td className="p-3 text-right font-bold text-gray-900">
                      {formatMoney(po.total, activeCurrency, activeExchangeRate)}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        po.status === 'Received' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {po.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2 justify-end">
                        {po.status === 'Pending' && (
                          <button
                            onClick={() => {
                              const updatedPOs = purchaseOrders.map(pOrder => {
                                if (pOrder.id === po.id) return { ...pOrder, status: 'Received' as const };
                                return pOrder;
                              });
                              const updatedStock = stockItems.map(p => {
                                const matchingItems = po.items.filter(i => i.productId === p.id);
                                if (matchingItems.length > 0) {
                                  const nextStockObj = { ...p.stock };
                                  let totalAdded = 0;
                                  matchingItems.forEach(itemPO => {
                                    const conversion = (itemPO.unitType || 'main') === 'main' && p.useSubUnitPricing ? (p.subUnitConversion || 1) : 1;
                                    totalAdded += itemPO.qty * conversion;
                                  });
                                  nextStockObj[po.storeId] = (nextStockObj[po.storeId] || 0) + totalAdded;
                                  return { ...p, stock: nextStockObj };
                                }
                                return p;
                              });
                              saveAllData({ purchaseOrders: updatedPOs, stockItems: updatedStock });
                              logAction('Received PO', `Transferred inventory weights from ${po.poNumber}`);
                            }}
                            className="text-xs bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 px-3 py-1 rounded-md transition"
                          >
                            {t('Receive')}
                          </button>
                        )}
                        {(currentUser?.role === 'Admin' || currentUser?.role === 'Super Admin') && (
                          <button
                            onClick={() => {
                              setConfirmModal({
                                isOpen: true,
                                title: t('Delete Purchase Order'),
                                description: `Are you sure you want to delete purchase order ${po.poNumber}? It will be moved to the Data Recovery Hub.`,
                                onConfirm: () => {
                                  const updatedPOs = purchaseOrders.map(item => item.id === po.id ? { ...item, isDeleted: true } : item);
                                  saveAllData({ purchaseOrders: updatedPOs });
                                  logAction('Deleted PO', `Moved purchase order to Data Recovery Hub: ${po.poNumber}`);
                                  toast.success(t('Purchase order moved to Data Recovery Hub.'));
                                }
                              });
                            }}
                            className="p-1 px-2 text-[10px] font-bold rounded border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition flex items-center gap-1"
                            title="Delete PO"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {t('Delete')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {storeFilteredPOs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-gray-400">
                      <ShoppingBag className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-sm font-bold text-gray-600 mb-1">{t('No purchase orders recorded yet.')}</p>
                      <p className="text-xs text-gray-400 mb-4">{t('Create purchase orders to restock products from your suppliers.')}</p>
                      <button
                        onClick={() => setShowPOModal(true)}
                        className="bg-brand hover:bg-brand-hover text-white px-4 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition"
                      >
                        <Plus className="w-4 h-4" /> {t('Create First Purchase Order')}
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // 4. Sales Orders Log view
  const renderSalesOrders = () => {
    const storeFilteredSOs = activeSalesOrders.filter(so => currentStoreId ? so.storeId === currentStoreId : true);
    const totalRev = storeFilteredSOs.reduce((acc, so) => acc + (so.total || 0), 0);
    const totalProfit = storeFilteredSOs.reduce((acc, so) => acc + (so.profit || 0), 0);
    const avgOrder = storeFilteredSOs.length > 0 ? totalRev / storeFilteredSOs.length : 0;

    return (
      <div className="space-y-4">
        {/* KPI Summary Header Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{t('Total Sales Volume')}</p>
              <p className="text-lg font-black text-slate-900 mt-0.5">{storeFilteredSOs.length}</p>
            </div>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{t('Total Revenue')}</p>
              <p className="text-lg font-black text-brand mt-0.5">{formatMoney(totalRev, activeCurrency, activeExchangeRate)}</p>
            </div>
            <div className="p-2 bg-brand/10 text-brand rounded-lg">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{t('Total Gross Profit')}</p>
              <p className="text-lg font-black text-emerald-600 mt-0.5">{formatMoney(totalProfit, activeCurrency, activeExchangeRate)}</p>
            </div>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{t('Average Order Value')}</p>
              <p className="text-lg font-black text-purple-600 mt-0.5">{formatMoney(avgOrder, activeCurrency, activeExchangeRate)}</p>
            </div>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Monitor className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <span className="font-bold text-gray-900 text-sm">{t('Completed Sales Ledgers')}</span>
            <button
              onClick={() => setShowSOModal(true)}
              className="bg-brand hover:bg-brand-hover text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
            >
              <Monitor className="w-4 h-4" /> {t('POS Terminal')}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 border-b text-gray-500 uppercase font-bold text-[10px]">
                <tr>
                  <th className="p-3">{t('Sales Document #')}</th>
                  <th className="p-3">{t('Customer Client')}</th>
                  <th className="p-3">{t('Date')}</th>
                  <th className="p-3">{t('Billing Tier')}</th>
                  <th className="p-3">{t('Checkout Items')}</th>
                  <th className="p-3 text-right">{t('Gross Total')}</th>
                  <th className="p-3 text-right text-emerald-700">{t('Profit Margin')}</th>
                  <th className="p-3 text-right">{t('Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-semibold">
                {storeFilteredSOs.map(so => (
                  <tr key={so.id} className="hover:bg-gray-50/50">
                    <td className="p-3 font-bold text-brand font-mono">{so.soNumber}</td>
                    <td className="p-3 text-gray-900">{getCustomerName(so.customerId)}</td>
                    <td className="p-3 text-gray-500">{so.date}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        so.priceType === 'Wholesale' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {so.priceType}
                      </span>
                    </td>
                    <td className="p-3 text-gray-600 font-medium">
                      {so.items.map(i => `${getProductName(i.productId)} (x${i.qty})`).join(', ')}
                    </td>
                    <td className="p-3 text-right font-bold text-gray-900">
                      {formatMoney(so.total, activeCurrency, activeExchangeRate)}
                    </td>
                    <td className="p-3 text-right font-bold text-emerald-600">
                      {formatMoney(so.profit, activeCurrency, activeExchangeRate)}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            generateSalesOrderPDF({
                              order: so,
                              customer: customers.find(c => c.id === so.customerId) || null,
                              store: stores.find(s => s.id === so.storeId) || null,
                              stockItems,
                              currentUser,
                              currency: activeCurrency,
                              exchangeRate: activeExchangeRate,
                              language: activeLanguage,
                              companyDetails: {
                                name: localStorage.getItem('tradecore_receipt_company_name') || 'Singida Grain Millers Ltd',
                                branch: localStorage.getItem('tradecore_receipt_company_branch') || 'Central Depot, Singida-Dodoma Rd',
                                phone: localStorage.getItem('tradecore_receipt_company_phone') || '+255 26 250 1234',
                                email: localStorage.getItem('tradecore_receipt_company_email') || 'logistics@singidagrain.co.tz',
                                logo: localStorage.getItem('tradecore_receipt_custom_logo')
                              }
                            });
                            if (logAction) {
                              logAction('Generated PDF Invoice', `Downloaded PDF invoice for sales ledger ${so.soNumber}`);
                            }
                          }}
                          className="p-1 px-2 text-[10px] font-bold rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition inline-flex items-center gap-1"
                          title="Download professional PDF Invoice"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          {t('View Details')}
                        </button>
                        {(currentUser?.role === 'Admin' || currentUser?.role === 'Super Admin') && (
                          <button
                            onClick={() => {
                              setConfirmModal({
                                isOpen: true,
                                title: t('Void Sales Invoice'),
                                description: `Are you sure you want to void sales ledger ${so.soNumber}? It will be moved to the Data Recovery Hub audit trail.`,
                                onConfirm: () => {
                                  const updatedSOs = salesOrders.map(item => item.id === so.id ? { ...item, status: 'Voided' as const, isDeleted: true } : item);
                                  saveAllData({ salesOrders: updatedSOs });
                                  logAction('Voided Sales Ledger', `Moved sales ledger to Data Recovery Hub: ${so.soNumber}`);
                                  toast.success(t('Sales invoice voided and moved to Data Recovery Hub.'));
                                }
                              });
                            }}
                            className="p-1 px-2 text-[10px] font-bold rounded border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition flex items-center gap-1"
                            title="Void / Delete Sales Ledger"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {t('Delete')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {storeFilteredSOs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-gray-400">
                      <Monitor className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-sm font-bold text-gray-600 mb-1">{t('No sales orders recorded yet.')}</p>
                      <p className="text-xs text-gray-400 mb-4">{t('Use the POS Terminal to launch sales checkout sessions.')}</p>
                      <button
                        onClick={() => setShowSOModal(true)}
                        className="bg-brand hover:bg-brand-hover text-white px-4 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition"
                      >
                        <Monitor className="w-4 h-4" /> {t('Open POS Terminal')}
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // --- RENDERS MAIN BODY ACCORDING TO NAV PAGE ---
  const renderMainContent = () => {
    switch (currentPage) {
      case 'dashboard': return renderDashboard();
      case 'stock-items': return renderStockItems();
      case 'purchase-order': return renderPurchaseOrders();
      case 'sales-order': return renderSalesOrders();
      case 'expenses':
        return (
          <PanelErrorBoundary panelName="Expenses">
            <Expenses
              expenses={activeExpenses}
              stores={stores}
              currentStoreId={currentStoreId}
              currency={activeCurrency}
              exchangeRate={activeExchangeRate}
              isAdmin={currentUser?.role === 'Admin' || currentUser?.role === 'Super Admin'}
              logAction={logAction}
              onUpdateExpenses={(newExpenses) => saveAllData({ expenses: newExpenses })}
              translate={t}
            />
          </PanelErrorBoundary>
        );
      case 'receipts':
        return (
          <PanelErrorBoundary panelName="Receipts">
            <Receipts
              salesOrders={activeSalesOrders}
              purchaseOrders={activePurchaseOrders}
              stores={stores}
              customers={customers}
              suppliers={suppliers}
              stockItems={activeStockItems}
              currentStoreId={currentStoreId}
              currency={activeCurrency}
              exchangeRate={activeExchangeRate}
              translate={t}
              currentUser={currentUser}
              language={activeLanguage}
              vatRate={activeVatRate}
              onUpdateSalesOrders={(newSales) => saveAllData({ salesOrders: newSales })}
              onUpdatePurchaseOrders={(newPurchases) => saveAllData({ purchaseOrders: newPurchases })}
              onUpdateStockItems={(newStock) => saveAllData({ stockItems: newStock })}
              logAction={logAction}
            />
          </PanelErrorBoundary>
        );
      case 'report-financial':
        return (
          <PanelErrorBoundary panelName="Financial Report">
            <FinancialReport
              salesOrders={activeSalesOrders}
              marketplaceOrders={marketplaceOrders}
              expenses={activeExpenses}
              stockItems={activeStockItems}
              stores={stores}
              companies={companies}
              branches={branches}
              currentCompanyId={currentCompanyId}
              currentBranchId={currentBranchId}
              currentStoreId={currentStoreId}
              currency={activeCurrency}
              exchangeRate={activeExchangeRate}
              language={activeLanguage}
            />
          </PanelErrorBoundary>
        );
      case 'ai-copilot':
        return (
          <PanelErrorBoundary panelName="AI Copilot">
            <AICopilot
            currentUser={currentUser}
            currentCompanyId={currentCompanyId}
            companies={companies}
            branches={branches}
            stores={stores}
            stockItems={stockItems}
            salesOrders={salesOrders}
            purchaseOrders={purchaseOrders}
            expenses={expenses}
            customers={customers}
            suppliers={suppliers}
            currency={activeCurrency}
            exchangeRate={activeExchangeRate}
            translate={t}
            language={activeLanguage}
          />
          </PanelErrorBoundary>
        );
      case 'companies':
      case 'branches':
      case 'stores':
      case 'customers':
      case 'suppliers':
      case 'categories':
      case 'taxes':
      case 'data-recovery':
      case 'exchange-rate':
        return (
          <MasterData
            currentPage={currentPage}
            companies={companies}
            branches={branches}
            stores={stores}
            customers={customers}
            suppliers={suppliers}
            categories={categories}
            taxes={getActiveTaxes()}
            stockItems={stockItems}
            users={users}
            currentCompanyId={currentCompanyId}
            currentBranchId={currentBranchId}
            currentStoreId={currentStoreId}
            isAdmin={currentUser?.role === 'Admin' || currentUser?.role === 'Super Admin'}
            isSuperAdmin={currentUser?.role === 'Super Admin'}
            currency={activeCurrency}
            exchangeRate={activeExchangeRate}
            translate={t}
            logAction={logAction}
            saveAllData={saveAllData}
            mutateRecord={mutateCollectionRecord}
            settings={settings}
            currentUser={currentUser}
            onNavigate={(page) => setCurrentPage(page)}
            salesOrders={salesOrders}
            purchaseOrders={purchaseOrders}
          />
        );
      case 'tra-reports':
        return (
          <PanelErrorBoundary panelName="TRA Reports">
          <RootTraReportsPanel
            companies={companies}
            orders={marketplaceOrders}
            translate={t}
            onToggleTinVerified={toggleTinVerified}
          />
          </PanelErrorBoundary>
        );
      case 'import-stock':
      case 'import-customers':
      case 'import-suppliers':
        return (
          <ImportData
            currentPage={currentPage}
            stores={stores}
            stockItems={activeStockItems}
            customers={customers}
            suppliers={suppliers}
            translate={t}
            logAction={logAction}
            saveAllData={saveAllData}
            onNavigate={(page) => setCurrentPage(page)}
          />
        );
      case 'report-unit-velocity':
      case 'report-transaction':
      case 'report-daily':
      case 'report-monthly':
      case 'report-sales':
      case 'report-purchase':
      case 'report-sales-outstanding':
      case 'report-purchase-outstanding':
      case 'report-lowstock':
      case 'report-po-details':
      case 'report-shifts':
      case 'report-tax-vat':
      case 'report-predictive-ai':
        return (
          <PanelErrorBoundary panelName="Report">
          <Reports
            currentPage={currentPage}
            salesOrders={activeSalesOrders}
            purchaseOrders={activePurchaseOrders}
            stockItems={activeStockItems}
            customers={customers}
            suppliers={suppliers}
            stores={stores}
            companies={companies}
            branches={branches}
            expenses={expenses}
            currentCompanyId={currentCompanyId}
            currentBranchId={currentBranchId}
            currentStoreId={currentStoreId}
            currency={activeCurrency}
            exchangeRate={activeExchangeRate}
            translate={t}
            posShifts={posShifts}
            taxes={getActiveTaxes()}
          />
          </PanelErrorBoundary>
        );
      case 'user-info':
      case 'user-access':
        return (
          <PanelErrorBoundary panelName="User Management">
          <ManageUsers
            currentPage={currentPage}
            users={activeUsers}
            companies={companies}
            branches={branches}
            stores={stores}
            auditTrails={auditTrails}
            securityLogs={securityLogs}
            rolePermissions={rolePermissions}
            currentUser={currentUser}
            currentCompanyId={currentCompanyId}
            currentBranchId={currentBranchId}
            currentStoreId={currentStoreId}
            settings={settings}
            isSuperAdmin={currentUser?.role === 'Super Admin'}
            isGlobalSuperAdmin={currentUser?.username === 'superadmin' || currentUser?.username === 'root_mandate'}
            translate={t}
            logAction={logAction}
            saveAllData={saveAllData}
            onNavigate={(page) => setCurrentPage(page)}
            onResetPassword={async (target: any, newPassword: string, companyId?: string | number) => {
              try {
                return await apiChangePassword(target.id, newPassword, companyId);
              } catch (err) {
                console.warn('[PHP API] change_password threw:', err);
                return false;
              }
            }}
          />
          </PanelErrorBoundary>
        );
      case 'profile':
        return (
          <Profile
            currentUser={currentUser}
            translate={t}
            onLogout={handleLogout}
            saveAllData={saveAllData}
            users={users}
            logAction={logAction}
            onPasswordChange={handleProfilePasswordChange}
            onOpenGame={() => {
              if (currentUser?.role === 'Super Admin' || currentUser?.role === 'Admin' || settings.allowGamesEnabled !== false) {
                setShowGameModal(true);
              } else {
                toast.info('Mind Refresh Game Breaks are currently disabled by Admin.');
              }
            }}
          />
        );
      case 'subscriptions':
        if (currentUser?.role !== 'Super Admin') {
          return (
            <div className="p-4 bg-red-100 text-red-800 rounded-lg">
              {t('Access Denied')} — {t('Subscription management is restricted to Super Administrators only.')}
            </div>
          );
        }
        return (
          <SubscriptionManagementPanel
            meta={subscriptionMeta}
            companies={companies}
            currentUserName={currentUser?.name || currentUser?.username || 'Super Admin'}
            translate={t}
            currency={activeCurrency}
            exchangeRate={activeExchangeRate}
            onSaveMeta={handleSaveSubscriptionMeta}
            onApprove={handleApproveRequest}
            onReject={handleRejectRequest}
            onRenew={handleRenewCompany}
            onDeleteCompany={handleDeleteCompany}
            contactMessages={contactMessages}
            onMarkContactAnswered={handleMarkContactAnswered}
            onDeleteContactMessage={handleDeleteContactMessage}
          />
        );
      case 'seller-wallet':
        return (
          <SellerWalletPanel
            company={currentUser?.companyId ? companies.find(c => c.id === currentUser.companyId) || null : null}
            wallet={getWalletForCompany(currentUser?.companyId || 0)}
            transactions={(walletTransactions || []).filter(t => t.companyId === currentUser?.companyId)}
            translate={t}
            onRequestWithdrawal={requestSellerWithdrawal}
          />
        );
      case 'seller-phase2c':
        return (
          <SellerPhase2CPanel
            company={currentUser?.companyId ? companies.find(c => c.id === currentUser.companyId) || null : null}
            offers={offers}
            offerMessages={offerMessages}
            products={currentUser?.companyId ? marketplaceProducts.filter(p => p.companyId === currentUser.companyId) : []}
            groupDeals={groupDeals}
            groupDealParticipants={groupDealParticipants}
            installmentPlans={installmentPlans}
            installmentOrders={installmentOrders}
            installmentPayments={installmentPayments}
            deliveries={deliveries}
            deliveryUpdates={deliveryUpdates}
            liveStreams={liveStreams}
            liveComments={liveComments}
            loyaltyCustomers={loyaltyCustomers}
            whatsappConversations={whatsappConversations}
            translate={t}
            onDecideOffer={(offerId, accept) => decideOffer(offerId, accept ? 'accept' : 'reject')}
            onCounterOffer={(offerId, counterPrice, message) => { respondToOfferSeller(offerId, 'counter', { counterPrice, message }); }}
            onRejectOffer={(offerId, reason) => { respondToOfferSeller(offerId, 'reject', { reason }); }}
            onAssignDeliveryRider={assignDeliveryRider}
            onUpdateDeliveryStatus={updateDeliveryStatus}
          />
        );
      case 'qr-code-yangu':
        return (
          <CompanyQrPanel
            company={currentUser?.companyId ? companies.find(c => c.id === currentUser.companyId) || null : null}
            products={currentUser?.companyId ? marketplaceProducts.filter(p => p.companyId === currentUser.companyId) : []}
            t={t}
            qr5DiscountPercent={settings.qr5DiscountPercent ?? 5}
            onSaveCompany={(patch) => { if (currentUser?.companyId) saveMarketplaceCompanyProfile(currentUser.companyId, patch); }}
            onSaveProduct={saveMarketplaceProduct}
          />
        );
      case 'sauti-search':
        return (
          <VoiceSearchStatsPanel
            voiceSearches={voiceSearches}
            t={t}
            onDeleteVoiceSearch={deleteVoiceSearch}
            onClearVoiceHistory={clearVoiceHistory}
          />
        );
      case 'affiliate-program':
        return (
          <AffiliateProgramPanel
            user={currentUser}
            affiliate={currentUser ? getOrCreateAffiliateForUser(currentUser) : undefined}
            clicks={affiliateClicks}
            sales={affiliateSales}
            withdrawals={affiliateWithdrawals}
            companies={companies}
            commissionPercent={settings.affiliateCommissionPercent ?? defaultAffiliateCommissionPercent}
            translate={t}
            onRequestWithdrawal={requestAffiliateWithdrawal}
          />
        );
      case 'marketplace-orders':
        return (
          <MarketplaceOrdersPanel
            currentCompanyId={currentUser?.companyId}
            orders={marketplaceOrders}
            companies={companies}
            translate={t}
            currentUser={currentUser}
            onUpdateStatus={updateMarketplaceOrderStatus}
            onMutateOrders={mutateMarketplaceOrders}
          />
        );
      case 'tra-report':
        return (
          <TraReportPanel
            company={currentUser?.companyId ? companies.find(c => c.id === currentUser.companyId) || null : null}
            orders={currentUser?.companyId ? marketplaceOrders.filter(o => o.companyId === currentUser.companyId) : []}
            traReceipts={traReceipts}
            translate={t}
            onUpdateReceipt={updateTraReceiptEfd}
          />
        );
      case 'marketplace-settings': {
        // BUG 2 FIX: bind to the ACTIVE navbar company context (currentCompanyId) so
        // switching the top navbar context from Alpha Global to Beta Distributors
        // actually re-renders THIS panel's storefront for the newly selected company.
        // Prefer currentCompanyId (navbar) -> currentUser.companyId -> first active
        // company so it never collapses to "No company linked".
        const msIsGlobal = isRootUser(currentUser) || currentUser?.role === 'Super Admin';
        const msCompanyId =
          currentCompanyId != null
            ? currentCompanyId
            : currentUser?.companyId != null
              ? currentUser.companyId
              : (companies.find(c => !c.isDeleted)?.id ?? null);
        const msCompany = msCompanyId != null ? companies.find(c => c.id === msCompanyId) || null : null;
        const msProducts = msIsGlobal
          ? marketplaceProducts
          : (msCompanyId != null ? marketplaceProducts.filter(p => p.companyId === msCompanyId) : []);
        return (
          <MarketplaceSettingsPanel
            company={msCompany}
            products={msProducts}
            stores={(() => {
              const coId = msCompanyId ?? currentUser?.companyId ?? null;
              const companyBranchIds = new Set(branches.filter(b => b.companyId === coId).map(b => b.id));
              return stores.filter(s => !s.isDeleted && companyBranchIds.has(s.branchId));
            })()}
            clicks={marketplaceClicks}
            reviews={reviews}
            productViews={productViews}
            regions={settings.marketplaceRegions}
            theme={publicTheme}
            translate={t}
            onSaveProfile={(patch) => { if (msCompanyId != null) saveMarketplaceCompanyProfile(msCompanyId, patch); }}
            onSavePaymentMethod={saveMarketplacePaymentMethod}
            onDeletePaymentMethod={deleteMarketplacePaymentMethod}
            onSaveProduct={saveMarketplaceProduct}
            onDeleteProduct={deleteMarketplaceProduct}
            // --- MEGA BUILD: 7 ultimate features company panel props ---
            flashSales={flashSales.filter(fs => fs.companyId === (msCompanyId ?? currentUser?.companyId))}
            flashSalesHandlers={{ onSave: saveFlashSale, onDelete: deleteFlashSale }}
            stories={stories.filter(s => s.companyId === (msCompanyId ?? currentUser?.companyId))}
            storiesHandlers={{ onCreate: createStory, onDelete: deleteStory }}
            chatConversations={chatConversations.filter(c => c.companyId === (msCompanyId ?? currentUser?.companyId))}
            chatMessages={chatMessages}
            chatHandlers={{
              onSend: (convId, input) => sendChatMessage(convId, 'company', msCompanyId != null ? companies.find(c => c.id === msCompanyId)?.name || 'Muuzaji' : 'Muuzaji', input),
              onMarkRead: (convId) => markChatRead(convId, 'company'),
            }}
            productReturns={productReturns.filter(r => r.companyId === (msCompanyId ?? currentUser?.companyId))}
            returnHandlers={{
              onApprove: (returnId) => respondToReturn(returnId, true),
              onReject: (returnId, note) => respondToReturn(returnId, false, note),
            }}
            disputes={disputes.filter(d => d.companyId === (msCompanyId ?? currentUser?.companyId))}
            disputeMessages={disputeMessages}
            disputeHandlers={{
              onResolve: (disputeId, outcome, resolution) => resolveDispute(disputeId, outcome, resolution),
              onSetUnderReview: (disputeId) => setDisputeUnderReview(disputeId),
              onAddAdminNote: (disputeId, note) => addDisputeReply(disputeId, note),
              onAddDisputeMessage: (disputeId, message) => addDisputeReply(disputeId, message),
            }}
            bulkUploadJobs={bulkUploads.filter(j => j.companyId === (msCompanyId ?? currentUser?.companyId))}
            bulkUploadHandlers={{
              onCreateJob: (job) => { const cur = dbStateRef.current; saveAllData({ bulkUploads: [job, ...(cur.bulkUploads || [])] }); },
              onUpdateJob: (job) => { const cur = dbStateRef.current; saveAllData({ bulkUploads: (cur.bulkUploads || []).map(j => j.id === job.id ? job : j) }); },
              onSaveProduct: commitBulkProduct,
            }}
            shippingZones={shippingZones.filter(z => z.companyId === (msCompanyId ?? currentUser?.companyId))}
            shippingZoneHandlers={{
              onSave: saveShippingZone,
              onDelete: deleteShippingZone,
            }}
          />
        );
      }
      case 'root-disputes':
        // --- MEGA BUILD F4: ROOT-level dispute center (ALL disputes across companies) ---
        if (!isRootUser(currentUser)) {
          return (
            <div className="p-4 bg-red-100 text-red-800 rounded-lg">
              {t('Access Denied')} — {t('ROOT MANDATE is restricted to the platform owner only.')}
            </div>
          );
        }
        return (
          <div className="p-4 space-y-4">
            <AdminDisputeCenter
              theme={publicTheme}
              t={t}
              disputes={disputes}
              disputeMessages={disputeMessages}
              returns={productReturns}
              orders={marketplaceOrders}
              companies={companies}
              onResolve={(disputeId, outcome, resolution) => { resolveDispute(disputeId, outcome, resolution); return { ok: true }; }}
              onSetUnderReview={(disputeId) => setDisputeUnderReview(disputeId)}
              onAddAdminNote={(disputeId, note) => addDisputeReply(disputeId, note)}
              onAddDisputeMessage={(disputeId, message) => addDisputeReply(disputeId, message)}
            />
          </div>
        );
      case 'root-dashboard':
        if (!isRootUser(currentUser)) {
          return (
            <div className="p-4 bg-red-100 text-red-800 rounded-lg">
              {t('Access Denied')} — {t('ROOT MANDATE is restricted to the platform owner only.')}
            </div>
          );
        }
        return (
          <RootMandatePanel
            currentUser={currentUser}
            users={users}
            companies={companies}
            branches={branches}
            stores={stores}
            products={marketplaceProducts}
            orders={marketplaceOrders}
            clicks={marketplaceClicks}
            reviews={reviews}
            productViews={productViews}
            categories={categories}
            taxes={taxes}
            suppliers={suppliers}
            customers={customers}
            auditTrails={auditTrails}
            securityLogs={securityLogs}
            rolePermissions={rolePermissions}
            settings={settings}
            translate={t}
            onSaveSettings={(nextSettings) => saveAllData({ settings: nextSettings })}
            onVerifyCompany={handleRootVerifyCompany}
            onBanCompany={handleRootBanCompany}
            onDeleteCompany={handleDeleteCompany}
            onApproveProduct={(productId) => {
              const product = marketplaceProducts.find(p => p.id === productId);
              if (product) {
                const approved = { ...product, status: 'approved' as const };
                const updated = marketplaceProducts.map(p => p.id === productId ? approved : p);
                // Optimistic local
                dbStateRef.current.marketplaceProducts = updated;
                setMarketplaceProducts(updated);
                void apiUpsertProduct(approved).catch(() => { saveAllData({ marketplaceProducts: updated }); forceFlushNow(); });
              }
              toast.success(t('Product approved and now public.'));
              logAction('Product Approved', `ROOT_MANDATE approved product #${productId} for public visibility.`);
            }}
            onUpdateProducts={(nextProducts) => {
              // Bulk update: optimistic local + atomic upsert each
              dbStateRef.current.marketplaceProducts = nextProducts;
              setMarketplaceProducts(nextProducts);
              for (const p of nextProducts) { void apiUpsertProduct(p).catch(() => {}); }
              forceFlushNow();
            }}
            onDeleteProduct={deleteMarketplaceProduct}
            onUpdateUsers={(nextUsers) => {
              // Bulk update: optimistic local + atomic upsert each
              dbStateRef.current.users = nextUsers;
              setUsers(nextUsers);
              for (const u of nextUsers) { void apiUpsertUser(u).catch(() => {}); }
              forceFlushNow();
            }}
            onUpdateCategories={(nextCategories) => saveAllData({ categories: nextCategories })}
            onUpdateCompanies={(nextCompanies) => saveAllData({ companies: nextCompanies })}
            onUpdateOrders={(nextOrders) => saveAllData({ marketplaceOrders: nextOrders })}
            onUpdateReviewStatus={updateReviewStatus}
            currencies={activeCurrencies}
            subscriptionPlans={activeTradePlans}
            companySubscriptions={activeCompanySubscriptions}
            onApproveCompanySubscription={handleApproveCompanySubscription}
            onRejectCompanySubscription={handleRejectCompanySubscription}
            onExtendCompanySubscription={handleExtendCompanySubscription}
            onChangeCompanyPlan={handleChangeCompanyPlan}
            onImpersonateCompany={handleImpersonateCompany}
            onReturnToRoot={handleReturnToRoot}
            onViewStore={(company) => {
              const slug = company?.slug || slugify(company?.name || 'company');
              goMarketplace(`/company/${slug}`);
            }}
            wallets={wallets}
            walletTransactions={walletTransactions}
            withdrawals={withdrawals}
            affiliates={affiliates}
            affiliateClicks={affiliateClicks}
            affiliateSales={affiliateSales}
            affiliateWithdrawals={affiliateWithdrawals}
            searchSynonyms={searchSynonyms}
            pushSubscriptions={pushSubscriptions}
            commissionPercent={settings.affiliateCommissionPercent ?? defaultAffiliateCommissionPercent}
            onDecideSellerWithdrawal={decideSellerWithdrawal}
            onDecideAffiliateWithdrawal={decideAffiliateWithdrawal}
            onUpdateAffiliate={(nextAffiliates) => saveAllData({ affiliates: nextAffiliates })}
            onUpdateSearchSynonyms={updateSearchSynonyms}
            voiceSearches={voiceSearches}
            qrScans={qrScans}
            onApproveAffiliate={approveAffiliate}
            collections={collections}
            webhookLogs={webhookLogs}
            adminEarnings={adminEarnings}
            onDecideCollection={decideCollection}
            onUpdateCollectionSettings={updateCollectionSettings}
            onUpdateCollectionMode={updateCollectionMode}
            onClearWebhookLogs={clearWebhookLogs}
            onTestCollection={testCollection}
            offers={offers}
            offerMessages={offerMessages}
            groupDeals={groupDeals}
            groupDealParticipants={groupDealParticipants}
            installmentPlans={installmentPlans}
            installmentOrders={installmentOrders}
            installmentPayments={installmentPayments}
            deliveries={deliveries}
            deliveryUpdates={deliveryUpdates}
            liveStreams={liveStreams}
            liveComments={liveComments}
            loyaltyCustomers={loyaltyCustomers}
            loyaltyTransactions={loyaltyTransactions}
            whatsappConversations={whatsappConversations}
            notificationLogs={notificationLogs}
            onDecideOffer={decideOffer}
            onAssignDeliveryRider={assignDeliveryRider}
            onUpdateDeliveryStatus={updateDeliveryStatus}
            onToggleLiveStream={(streamId, live) => live ? startLiveStream(streamId) : endLiveStream(streamId)}
            logAction={logAction}
          />
        );
      // Fallback placeholders for reports, dynamic configurations etc.
      default:
        return (
          <div className="bg-white p-8 rounded-xl border text-center font-semibold text-gray-500">
            <Info className="w-10 h-10 mx-auto mb-3 text-brand" />
            <span className="text-sm block font-bold mb-1">Configuration View: {currentPage}</span>
            <span className="text-xs text-gray-400 font-medium">This module relies on contextual local storage databases and is fully operational.</span>
          </div>
        );
    }
  };

  // ===== PUBLIC MARKETPLACE (outside the internal system — no login for customers) =====
  if (isPublicMarketplacePath(mpPath)) {
    return (
      <div style={{ ...publicBrandStyle, ...goldenBrandStyle }}>
        <MarketplaceApp
          path={mpPath}
          companies={companies}
          products={marketplaceProducts}
          stores={stores}
          orders={marketplaceOrders}
          customers={marketplaceCustomers}
          regions={settings.marketplaceRegions}
          translate={t}
          theme={publicTheme}
          onToggleTheme={togglePublicTheme}
          onNavigate={goMarketplace}
          onSubmitOrder={submitMarketplaceOrder}
          onCustomerLogin={marketplaceCustomerLogin}
          onUpdateCustomerLocale={updateMarketplaceCustomerLocale}
          onTrackProductClick={trackMarketplaceClick}
          onTrackProductView={trackProductView}
          reviews={reviews}
          onSubmitReview={submitMarketplaceReview}
          currencies={activeCurrencies}
          subscriptionPlans={activeTradePlans}
          companySubscriptions={activeCompanySubscriptions}
          payNumbers={subscriptionMeta.payNumbers}
          onSubmitSubscriptionPayment={handleSubmitSubscriptionPayment}
          searchSynonyms={searchSynonyms}
          collectionSettings={settings.collectionSettings}
          collectionMode={settings.collectionMode}
          onInitiateCollection={initiateCollection}
          onCheckCollectionStatus={checkCollectionStatus}
          offers={offers}
          // --- MEGA CRITICAL FIX 2-in-1: buyer offer negotiation actions ---
          offerActions={{
            onAcceptCounter: (id) => buyerRespondToOffer(id, 'accept_counter'),
            onRejectCounter: (id) => buyerRespondToOffer(id, 'reject_counter'),
            onCounterAgain: (id, price, message) => buyerRespondToOffer(id, 'counter_again', { price, message })
          }}
          groupDeals={groupDeals}
          groupDealParticipants={groupDealParticipants}
          installmentPlans={installmentPlans}
          installmentOrders={installmentOrders}
          installmentPayments={installmentPayments}
          liveStreams={liveStreams}
          liveComments={liveComments}
          deliveries={deliveries}
          deliveryUpdates={deliveryUpdates}
          loyaltyCustomers={loyaltyCustomers}
          whatsappConversations={whatsappConversations}
          featureHandlers={{
            onSubmitOffer: (input) => createOffer(input),
            onInitiateOfferPayment: (offerId, address, network) => initiateOfferPayment(offerId, address, network),
            onJoinGroupDeal: (dealId, input) => joinGroupDeal(dealId, input),
            onInitiateGroupPayment: (dealId, address, network) => initiateGroupPayment(dealId, address, network),
            onCreateInstallmentOrder: (input) => createInstallmentOrder(input),
            onInitiateInstallmentPayment: (orderId, type, address, network) => initiateInstallmentPayment(orderId, type, address, network),
            onAddLiveComment: (streamId, input) => addLiveComment(streamId, input),
            onLikeLiveStream: (streamId) => likeLiveStream(streamId),
            onRedeemLoyalty: (phone) => redeemLoyaltyPoints(phone),
            onWhatsappMessage: (phone, message) => handleWhatsappMessage(phone, message)
          }}
          // --- MEGA ULTIMATE: MFUMO WA WAKALA · TAFTA KWA SAUTI · QR CODE YA DUKA ---
          affiliates={affiliates}
          affiliateClicks={affiliateClicks}
          affiliateSales={affiliateSales}
          affiliateWithdrawals={affiliateWithdrawals}
          affiliateCommissionPercent={settings.affiliateCommissionPercent ?? settings.affiliateDefaultPercent ?? defaultAffiliateCommissionPercent}
          affiliateMinWithdrawal={settings.affiliateMinWithdrawal ?? 10000}
          onRegisterAffiliate={registerAffiliate}
          onLoginAffiliate={loginAffiliate}
          onRequestAffiliateWithdrawal={requestAffiliateWithdrawal}
          onLogVoiceSearch={logVoiceSearch}
          onRecordQrScan={recordQrScan}
          onOpenQrPage={() => {
            setMpPath('');
            setCurrentPage('qr-code-yangu');
            if (window.history && window.history.pushState) window.history.pushState({}, '', '/');
            window.scrollTo(0, 0);
          }}
          voiceSearchEnabled={settings.voiceSearchEnabled !== false}
          qr5Enabled={settings.qr5Enabled !== false}
          qr5DiscountPercent={settings.qr5DiscountPercent ?? 5}
          // --- MEGA BUILD: 7 ultimate features props ---
          flashSales={flashSales}
          flashSalesHandlers={{ onSave: saveFlashSale, onDelete: deleteFlashSale }}
          stories={stories}
          storyViews={storyViews}
          storiesHandlers={{ onCreate: createStory, onDelete: deleteStory, onRecordView: recordStoryView }}
          chatConversations={chatConversations}
          chatMessages={chatMessages}
          chatHandlers={{
            onSend: (convId, input) => sendChatMessage(convId, 'buyer', localStorage.getItem('tradecore_chat_name') || 'Mteja', input),
            onMarkRead: (convId) => markChatRead(convId, 'buyer'),
            onStartConversation: (companyId, buyerName, buyerPhone, productId) => startChatConversation(companyId, buyerName, buyerPhone, productId)
          }}
          appNotifications={appNotifications}
          notificationHandlers={{ onMarkAllRead: () => markAllNotificationsRead(localStorage.getItem('tradecore_buyer_phone') || null) }}
          visualSearchHandlers={{ onLogSearch: logVisualSearch }}
          onConfirmDelivery={releaseEscrowToSeller}
          onOpenDispute={openDisputeFromBuyer}
          onConfirmCodReceipt={confirmCodReceipt}
          identityPhone={localStorage.getItem('tradecore_buyer_phone') || null}
          shippingZones={shippingZones}
          onBackHome={() => {
            setMpPath('/');
            if (window.history && window.history.pushState) {
              window.history.pushState({}, '', '/');
            }
            setAuthView('home');
          }}
        />
      </div>
    );
  }

  if (!currentUser) {
    // --- RENDER POST-REGISTRATION PENDING VERIFICATION SCREEN ---
    if (registrationResult) {
      return (
        <PendingVerificationScreen
          submissionData={registrationResult}
          translate={t}
          theme={publicTheme}
          onToggleTheme={togglePublicTheme}
          onProceedToLogin={() => {
            setRegistrationResult(null);
            setAuthView('login');
            if (window.history && window.history.replaceState) {
              window.history.replaceState({}, '', '/login');
            }
          }}
        />
      );
    }

    // --- RENDER PUBLIC HOMEPAGE ---
    if (authView === 'home') {
      return (
        <div style={{ ...publicBrandStyle, ...goldenBrandStyle }}>
          <Homepage
            translate={t}
            theme={publicTheme}
            onToggleTheme={togglePublicTheme}
            onRegister={() => {
              setAuthView('register');
              if (window.history && window.history.pushState) {
                window.history.pushState({}, '', '/register');
              }
            }}
            onLogin={() => {
              setAuthView('login');
              if (window.history && window.history.pushState) {
                window.history.pushState({}, '', '/login');
              }
            }}
            onStartDemo={() => setDemoSetupOpen(true)}
            onSubmitContact={handleSubmitContact}
            marketplaceCompanies={companies}
            marketplaceProducts={marketplaceProducts}
            onGoMarketplace={goMarketplace}
            homepageContent={settings.homepageContent}
            siteConfig={settings.siteConfig}
          />
          {demoSetupOpen && (
            <DemoSetupModal
              translate={t}
              onConfirm={handleStartDemo}
              onClose={() => setDemoSetupOpen(false)}
            />
          )}
        </div>
      );
    }

    // --- RENDER PUBLIC REGISTER VIEW ---
    if (authView === 'register') {
      return (
        <div style={{ ...publicBrandStyle, ...goldenBrandStyle }}>
          <RegisterCompany
            plans={subscriptionMeta.plans || []}
            payNumbers={subscriptionMeta.payNumbers}
            translate={t}
            theme={publicTheme}
            onToggleTheme={togglePublicTheme}
            currency={activeCurrency}
            exchangeRate={activeExchangeRate}
            currencies={activeCurrencies}
            subscriptionPlans={activeTradePlans}
            onRegister={handleRegister}
            onBackToLogin={() => {
              setAuthView('login');
              if (window.history && window.history.replaceState) {
                window.history.replaceState({}, '', '/login');
              }
            }}
          />
        </div>
      );
    }

    // --- RENDER PASSWORD RESET VIEWS (direct visits to /forgot-password or /reset-password) ---
    if (authView === 'forgot' || authView === 'reset') {
      return (
        <div style={{ ...publicBrandStyle, ...goldenBrandStyle }}>
          <AuthPasswordReset
            mode={authView}
            token={resetToken}
            translate={t}
            theme={publicTheme}
            onToggleTheme={togglePublicTheme}
            onBackToLogin={() => {
              setAuthView('login');
              if (window.history && window.history.replaceState) {
                window.history.replaceState({}, '', '/login');
              }
            }}
          />
        </div>
      );
    }

    // --- RENDER LOGIN VIEW ---
    const loginStyle = {
      '--brand-color': publicTheme === 'milk' ? '#d4a017' : GOLD,
      '--brand-color-hover': '#b8860b',
      '--brand-color-light': 'rgba(212, 160, 23, 0.15)'
    } as React.CSSProperties;

    return (
      <div
        className={`relative min-h-screen flex items-center justify-center p-4 ${
          publicTheme === 'milk'
            ? 'bg-[#faf8f5] text-[#1f2937]'
            : 'bg-gradient-to-br from-[#070e20] via-[#0b1530] to-[#070e20] text-white'
        }`}
        style={loginStyle}
      >
        <div className="absolute top-0 left-0 right-0"><GoldenTopLine theme={publicTheme} /></div>
        <div className="absolute top-4 right-4 z-20">
          <PublicThemeToggle theme={publicTheme} onToggle={togglePublicTheme} />
        </div>
        <div className={`w-full max-w-5xl grid lg:grid-cols-5 rounded-2xl shadow-2xl overflow-hidden ${publicTheme === 'milk' ? 'bg-white' : 'bg-[#0d1832]'} ${publicTheme === 'milk' ? 'border border-amber-200/80' : 'border border-amber-400/25'}`}>
          <div className={`lg:col-span-3 p-10 lg:p-14 flex flex-col justify-between relative overflow-hidden ${
            publicTheme === 'milk' ? 'bg-[#f1eadb] text-[#1f2937]' : 'bg-[#0d1832] text-white'
          }`}>
            <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl -translate-y-20 translate-x-20 ${
              publicTheme === 'milk' ? 'bg-amber-400/20' : 'bg-amber-400/15'
            }`}></div>
            <div>
              <div className="flex items-center gap-3 mb-12">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-xl shadow-md ${
                  publicTheme === 'milk' ? 'bg-[#1f2937] text-amber-400' : 'bg-white text-brand'
                }`}>T</div>
                <div>
                  <div className="font-black text-lg tracking-tight">{t('Global TradeCore')}</div>
                  <div className={`text-[10px] tracking-wider font-semibold uppercase mt-0.5 ${publicTheme === 'milk' ? 'text-gray-500' : 'text-gray-400'}`}>{t('Enterprise commerce ERP')}</div>
                </div>
              </div>
              <h2 className="text-3xl font-black leading-tight mb-4">{t('Centralized Commerce')}<br />{t('Management ERP')}</h2>
              <p className={`text-xs font-semibold max-w-sm leading-relaxed mb-6 ${publicTheme === 'milk' ? 'text-gray-600' : 'text-gray-300'}`}>
                {t('Centralized cloud and local database directory sync for retailers, wholesalers, inventory valuations, dynamic expense logs, and real-time financial reporting sheets.')}
              </p>
              <div className={`p-4 rounded-xl max-w-sm ${publicTheme === 'milk' ? 'bg-white border border-amber-200/70' : 'bg-white/5 border border-white/10'}`}>
                <p className={`text-[10px] uppercase tracking-wider font-bold ${publicTheme === 'milk' ? 'text-gray-500' : 'text-gray-400'}`}>{t('Apply for System Access')}</p>
                <p className={`text-xs mt-1 font-semibold ${publicTheme === 'milk' ? 'text-[#1f2937]' : 'text-white'}`}>{t('Contact Founder Super Admin:')}</p>
                <a href="mailto:globaltradecore@gmail.com" className="text-brand hover:underline text-xs font-black block mt-0.5">
                  globaltradecore@gmail.com
                </a>
              </div>
            </div>
            <div className={`text-[10px] font-semibold mt-12 ${publicTheme === 'milk' ? 'text-gray-500' : 'text-gray-500'}`}>
              {t('System Boundary active • 256-bit transactional security.')}
            </div>
          </div>

          <div className={`lg:col-span-2 p-8 lg:p-12 flex flex-col justify-center ${publicTheme === 'milk' ? 'bg-white' : 'bg-[#0d1832] border-l border-amber-400/25'}`}>
            <div className="w-full max-w-sm mx-auto space-y-5">
              <div>
                <h3 className={`text-xl font-black ${publicTheme === 'milk' ? 'text-gray-900' : 'text-white'}`}>{t('Sign In')}</h3>
                <p className={`text-xs font-semibold mt-0.5 ${publicTheme === 'milk' ? 'text-gray-400' : 'text-gray-400'}`}>{t('Access your assigned branch dashboard')}</p>
              </div>

              <form id="loginForm" onSubmit={handleLogin} className="space-y-3.5">
                <div className="space-y-1">
                  <label className={`text-[10px] font-bold block tracking-wider uppercase ${publicTheme === 'milk' ? 'text-gray-500' : 'text-gray-400'}`}>{t('Username')}</label>
                  <input
                    type="text"
                    required
                    value={loginUsername}
                    onChange={(e) => { setLoginUsername(e.target.value); setLoginError(''); }}
                    className={publicTheme === 'milk'
                      ? 'w-full px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-500 font-medium'
                      : 'w-full px-3 py-2 border border-white/10 rounded-lg text-xs bg-[#0d1832] outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400/60 font-medium text-white'}
                    placeholder={t('Enter username')}
                  />
                </div>
                <div className="space-y-1">
                  <label className={`text-[10px] font-bold block tracking-wider uppercase ${publicTheme === 'milk' ? 'text-gray-500' : 'text-gray-400'}`}>{t('Password')}</label>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => { setLoginPassword(e.target.value); setLoginError(''); }}
                    className={publicTheme === 'milk'
                      ? 'w-full px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-500 font-medium'
                      : 'w-full px-3 py-2 border border-white/10 rounded-lg text-xs bg-[#0d1832] outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400/60 font-medium text-white'}
                    placeholder={t('Enter account password')}
                  />
                </div>
                {!loginUsername.trim() || !loginPassword ? (
                  <p className="text-[10px] font-semibold text-amber-600/90">
                    {t('Enter your username and password to sign in.')}
                  </p>
                ) : null}
                {loginError && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                    <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] font-semibold text-red-700 leading-relaxed">{loginError}</p>
                  </div>
                )}
                <div className="flex justify-end -mt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthView('forgot');
                      if (window.history && window.history.pushState) {
                        window.history.pushState({}, '', '/forgot-password');
                      }
                    }}
                    className="text-[10px] text-brand hover:text-brand-hover font-bold"
                  >
                    {t('Forgot Password?')}
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={loginSubmitting}
                  className={`w-full py-2.5 text-xs font-bold rounded-lg tracking-wider uppercase shadow transition-all duration-150 ${
                    loginSubmitting ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                  } ${
                    publicTheme === 'milk'
                      ? 'bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-amber-400 hover:to-amber-600 text-[#1f2937]'
                      : 'bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-amber-400 hover:to-amber-600 text-[#1f2937]'
                  }`}
                >
                  {loginSubmitting ? t('Signing in...') : t('Authorize Entry')}
                </button>
              </form>

              <div className={`pt-2 space-y-2 ${publicTheme === 'milk' ? 'border-t border-amber-200/70' : 'border-t border-white/10'}`}>
                <button
                  type="button"
                  onClick={() => {
                    setAuthView('register');
                    if (window.history && window.history.pushState) {
                      window.history.pushState({}, '', '/register');
                    }
                  }}
                  className={`w-full py-2 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1.5 transition ${
                    publicTheme === 'milk'
                      ? 'bg-[#1f2937] hover:bg-[#111827] text-white'
                      : 'bg-[#2d323e] hover:bg-[#3a404c] text-white'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  {t('New Company? Register & Subscribe')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthView('home');
                    if (window.history && window.history.pushState) {
                      window.history.pushState({}, '', '/');
                    }
                  }}
                  className={`w-full text-center text-[10px] font-bold ${publicTheme === 'milk' ? 'text-gray-500 hover:text-amber-700' : 'text-gray-400 hover:text-brand'}`}
                >
                  {t('Back to Homepage')}
                </button>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowPhpConfigModal(true)}
                  className="text-[10px] text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1"
                >
                  <Database className="w-3 h-3" />
                  {t('cPanel DB Config')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Calculate low stock items count
  const lowStockCount = stockItems.filter(item => {
    if (currentStoreId) {
      return (item.stock[currentStoreId] || 0) <= item.lowStockQty;
    } else {
      // If no store is selected, check if any of the stores are low
      return Object.values(item.stock).some(qty => qty <= item.lowStockQty) || Object.keys(item.stock).length === 0;
    }
  }).length;

  // Check if company subscription is expired, unapproved, pending approval or demo-expired
  const gateCompany = currentUser?.companyId ? companies.find(c => c.id === currentUser.companyId) : undefined;
  const todayStr = new Date().toISOString().split('T')[0];
  const isDemoExpired = !!gateCompany?.isDemo && !!gateCompany.demoExpiresAt && todayStr > gateCompany.demoExpiresAt.split('T')[0];
  const companyGateStatus = gateCompany?.status;
  const isPaymentPending = companyGateStatus === 'Pending Payment' || companyGateStatus === 'Rejected';

  const isSubscriptionBlocked = (() => {
    if (!currentUser) return false;
    if (currentUser.role === 'Super Admin') return false; // Super Admins can never be blocked
    if (!currentUser.companyId) return false;

    const userCompany = gateCompany;
    if (!userCompany) return false;

    if (isDemoExpired) return true;

    // Pending / rejected payment companies are gated with the approval screen
    if (isPaymentPending) return true;

    // Check if subscription has not been approved
    if (userCompany.subscriptionApproved === false) {
      return true;
    }

    // Check if subscription has expired
    if (userCompany.subscriptionEnd) {
      if (todayStr > userCompany.subscriptionEnd) {
        return true;
      }
    }

    return false;
  })();

  if (currentUser && isSubscriptionBlocked) {
    const userCompany = gateCompany;
    const coColor = userCompany?.themeColor || '#c41e3a';
    const subBlockedStyle = {
      '--brand-color': coColor,
      '--brand-color-hover': adjustColorBrightness(coColor, -15),
      '--brand-color-light': coColor + '26'
    } as React.CSSProperties;

    // --- DEMO-EXPIRED SCREEN: directs to real registration ---
    if (isDemoExpired) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#1f242d] via-[#2b2f3a] to-[#1f242d] text-white" style={subBlockedStyle}>
          <div className="w-full max-w-md bg-[#2d323e] rounded-2xl shadow-2xl p-8 border border-amber-500/30 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto border border-amber-500/20">
              <Hourglass className="w-8 h-8 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black tracking-tight text-white uppercase">{t('Free Demo Expired')}</h2>
              <p className="text-sm font-bold text-amber-400">{t('Your 1-day evaluation period has ended')}</p>
            </div>
            <div className="bg-black/25 p-4 rounded-xl text-left text-xs text-gray-300 space-y-2 font-semibold font-mono">
              <div className="flex justify-between">
                <span>{t('Demo Account')}:</span>
                <span className="text-white font-bold">{currentUser.username}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('Demo Ended')}:</span>
                <span className="text-amber-400 font-bold">{gateCompany?.demoExpiresAt?.split('T')[0] || todayStr}</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed font-semibold">
              {t('The demo sandbox has been closed. Register a paid subscription to continue with full system access for your company.')}
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  handleLogout();
                  setAuthView('register');
                  if (window.history && window.history.pushState) {
                    window.history.pushState({}, '', '/register');
                  }
                }}
                className="w-full py-2.5 bg-brand hover:bg-brand-hover text-white text-xs font-black rounded-lg tracking-wider uppercase transition shadow-md"
              >
                {t('Register Your Company Now')}
              </button>
              <button
                onClick={handleLogout}
                className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-lg tracking-wider uppercase transition"
              >
                {t('Sign Out')}
              </button>
            </div>
          </div>
        </div>
      );
    }

    // --- PENDING / REJECTED APPROVAL GATE SCREEN ---
    if (isPaymentPending) {
      const isRejected = companyGateStatus === 'Rejected';
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#1f242d] via-[#2b2f3a] to-[#1f242d] text-white" style={subBlockedStyle}>
          <div className="w-full max-w-md bg-[#2d323e] rounded-2xl shadow-2xl p-8 border border-amber-500/30 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto border border-amber-500/20">
              <Clock3 className="w-8 h-8 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black tracking-tight text-white uppercase">{t('Payment Approval Pending')}</h2>
              <p className="text-sm font-bold text-amber-400">
                {isRejected ? t('Registration Rejected — Please Resubmit') : t('Awaiting Super Admin Verification')}
              </p>
            </div>
            <div className="bg-black/25 p-4 rounded-xl text-left text-xs text-gray-300 space-y-2 font-semibold font-mono">
              <div className="flex justify-between">
                <span>{t('Company')}:</span>
                <span className="text-white font-bold">{userCompany?.name}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('Status')}:</span>
                <span className={`font-bold uppercase ${isRejected ? 'text-red-400' : 'text-amber-400'}`}>{companyGateStatus}</span>
              </div>
              {userCompany?.paymentReference && (
                <div className="flex justify-between">
                  <span>{t('Reference')}:</span>
                  <span className="text-white font-bold font-mono">{userCompany.paymentReference}</span>
                </div>
              )}
              {userCompany?.planName && (
                <div className="flex justify-between">
                  <span>{t('Plan')}:</span>
                  <span className="text-white font-bold">{userCompany.planName}</span>
                </div>
              )}
            </div>
            {userCompany?.adminNote && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-left text-[11px] text-red-300 font-semibold">
                <span className="block uppercase tracking-wider text-[9px] font-black mb-1">{t('Super Admin Feedback')}:</span>
                {userCompany.adminNote}
              </div>
            )}
            <p className="text-xs text-gray-400 leading-relaxed font-semibold">
              {isRejected
                ? t('Your payment details were not verified. Fix the issue noted above and resubmit for another review.')
                : t('Your payment details have been submitted to the Super Admin for verification. Access unlocks automatically once approved.')}
            </p>
            <div className="flex flex-col gap-2">
              {isRejected && (
                <button
                  onClick={() => setResubmitOpen(true)}
                  className="w-full py-2.5 bg-brand hover:bg-brand-hover text-white text-xs font-black rounded-lg tracking-wider uppercase transition shadow-md"
                >
                  {t('Resubmit Payment Details')}
                </button>
              )}
              <button
                onClick={handleRecheckApproval}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg tracking-wider uppercase transition"
              >
                <RefreshIcon className="w-3.5 h-3.5 inline mr-1.5" />
                {t('Re-check Approval Status')}
              </button>
              <button
                onClick={handleLogout}
                className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-lg tracking-wider uppercase transition"
              >
                {t('Sign Out / Switch Account')}
              </button>
            </div>
          </div>
          {resubmitOpen && currentUser?.companyId && (
            <ResubmitPaymentModal
              companyName={userCompany?.name || ''}
              adminNote={userCompany?.adminNote}
              payNumbers={subscriptionMeta.payNumbers}
              translate={t}
              onClose={() => setResubmitOpen(false)}
              onSubmit={(data) => handleResubmitPayment(currentUser.companyId!, data)}
            />
          )}
        </div>
      );
    }

    // --- GENERIC EXPIRED / DEACTIVATED SCREEN (detailed expired dashboard) ---
    const expiredEndStr = userCompany?.subscriptionEnd || '';
    let daysExpired = 0;
    if (expiredEndStr) {
      const endMs = /^\d{4}-\d{2}-\d{2}$/.test(expiredEndStr)
        ? new Date(expiredEndStr + 'T23:59:59').getTime()
        : new Date(expiredEndStr).getTime();
      daysExpired = Math.max(1, Math.ceil((Date.now() - endMs) / 86400000));
    }
    const expiredStartStr = userCompany?.subscriptionStart ? userCompany.subscriptionStart.split('T')[0] : '—';
    const expiredDetails: Array<[string, string]> = [
      [t('Company'), userCompany?.name || '—'],
      [t('Subscription Plan'), userCompany?.planName || '—'],
      [t('Period Start'), expiredStartStr],
      [t('Period End'), expiredEndStr || '—'],
      [t('Days Expired'), `${daysExpired} ${daysExpired === 1 ? 'day' : 'days'}`],
      [t('Payment Reference'), userCompany?.paymentReference || '—']
    ];
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#1f242d] via-[#2b2f3a] to-[#1f242d] text-white" style={subBlockedStyle}>
        <div className="w-full max-w-md bg-[#2d323e] rounded-2xl shadow-2xl p-8 border border-red-500/30 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto border border-red-500/20">
            <AlertTriangle className="w-8 h-8 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black tracking-tight text-white uppercase">{t('Subscription Expired')}</h2>
            <p className="text-sm font-bold text-red-400">{t('Your subscription period has ended — renew to restore access')}</p>
          </div>
          <div className="bg-black/25 p-4 rounded-xl text-left text-xs space-y-2 font-semibold">
            {expiredDetails.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <span className="text-gray-400">{k}:</span>
                <span className="text-white font-bold text-right font-mono">{v}</span>
              </div>
            ))}
            <div className="flex justify-between gap-3 pt-1 border-t border-white/10">
              <span className="text-gray-400 uppercase tracking-wider">{t('Status')}:</span>
              <span className="text-red-400 font-black uppercase">Expired</span>
            </div>
          </div>
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-left text-[11px] text-red-200 font-semibold leading-relaxed">
            <span className="block uppercase tracking-wider text-[9px] font-black mb-1">{t('What happens next')}:</span>
            {t('Your account and staff profiles are locked. Renew your subscription to restore full access — the Super Admin will verify payment and reactivate your subscription period.')}
          </div>
          <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-xs">
            <span className="text-gray-400 block mb-0.5">{t('Contact Founder for Active Assistance')}:</span>
            <a href="mailto:globaltradecore@gmail.com" className="text-brand font-black hover:underline">
              globaltradecore@gmail.com
            </a>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => goMarketplace(`/company/${(userCompany?.slug || slugify(userCompany?.name || 'company')).trim()}/subscription/renew`)}
              className="w-full py-2.5 bg-brand hover:bg-brand-hover text-white text-xs font-black rounded-lg tracking-wider uppercase transition shadow-md"
            >
              {t('Renew Subscription')}
            </button>
            <button
              onClick={handleRecheckApproval}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg tracking-wider uppercase transition"
            >
              <RefreshIcon className="w-3.5 h-3.5 inline mr-1.5" />
              {t('Re-check Subscription Status')}
            </button>
            <button
              onClick={handleLogout}
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg tracking-wider uppercase transition shadow-md"
            >
              {t('Sign Out / Switch Account')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // A signed-in session whose in-memory user list is still empty (server fetch
  // for this session's row has not landed yet) must NOT render the shell: panels
  // would read company/branch/store scope off undefined and crash. Show a brief
  // loading gate instead of a logout flash or broken UI.
  if (currentUser && Array.isArray(users) && users.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#f5f6f8] font-sans">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#c41e3a] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-xs font-semibold text-slate-500">{t('Loading system state...')}</div>
        </div>
      </div>
    );
  }

  // --- RENDER MAIN ERP CLIENT ---
  const activeCompany = companies.find(c => c.id === currentCompanyId);
  const activeCompanyColor = activeCompany?.themeColor || '#c41e3a';

  const rootStyle = {
    '--brand-color': activeCompanyColor,
    '--brand-color-hover': adjustColorBrightness(activeCompanyColor, -15),
    '--brand-color-light': activeCompanyColor + '26' // ~15% opacity
  } as React.CSSProperties;

  return (
    <div className="h-screen overflow-hidden bg-[#f5f6f8] flex font-sans" style={rootStyle}>
      {/* Non-blocking sync indicator — the UI stays fully interactive while saving */}
      {isSyncingWithPhp && (
        <div className="fixed bottom-5 right-5 z-[9999] pointer-events-none select-none">
          <div className="bg-slate-900/95 border border-slate-700/80 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-3">
            <div className="relative w-5 h-5 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-emerald-500/25 animate-ping"></div>
              <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <div className="text-left">
              <div className="text-[10px] font-black text-slate-100 uppercase tracking-wider">{t('Syncing with Server')}</div>
              <div className="text-[10px] text-emerald-400 font-semibold">{t(phpSyncMessage)}</div>
            </div>
          </div>
        </div>
      )}

      {/* PHP Server Connection & cPanel Settings Modal */}
      {showPhpConfigModal && (
        <div className="fixed inset-0 z-[9000] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-gray-900 text-sm">{t('cPanel / PHP Server Database Connection')}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPhpConfigModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-600">
              {t('Connect TradeCore ERP to your custom PHP backend API hosted on cPanel or custom server.')}
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">{t('PHP REST API Endpoint URL')}</label>
                <input
                  type="text"
                  value={phpApiUrlInput}
                  onChange={(e) => setPhpApiUrlInput(e.target.value)}
                  placeholder="/api/php_sync.php or https://yourdomain.com/api.php"
                  className="w-full text-xs p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">{t('WebSocket Sync URL (Optional)')}</label>
                <input
                  type="text"
                  value={phpWsUrlInput}
                  onChange={(e) => setPhpWsUrlInput(e.target.value)}
                  placeholder="wss://yourdomain.com/ws"
                  className="w-full text-xs p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">{t('X-API-Key Secret (Optional)')}</label>
                <input
                  type="password"
                  value={phpApiKeyInput}
                  onChange={(e) => setPhpApiKeyInput(e.target.value)}
                  placeholder="Secret key for cPanel API authentication"
                  className="w-full text-xs p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>
            </div>

            <div className="bg-emerald-50/80 border border-emerald-100 p-3 rounded-xl text-[11px] text-emerald-900 space-y-1">
              <span className="font-bold flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                {t('cPanel Export Files Ready')}
              </span>
              <p className="text-[10px] text-emerald-700">
                {t('The PHP backend script (api.php) and MySQL table schema (database.sql) are available in your /public/cpanel folder.')}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPhpConfigModal(false)}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                {t('Cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  savePhpConfig({
                    apiUrl: phpApiUrlInput,
                    wsUrl: phpWsUrlInput,
                    apiKey: phpApiKeyInput
                  });
                  toast.success(t('PHP Server connection settings saved!'));
                  setShowPhpConfigModal(false);
                  window.location.reload();
                }}
                className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
              >
                {t('Save & Connect')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar - Desktop Layout */}
      <div className={`hidden lg:block transition-all duration-300 flex-shrink-0 ${sidebarCollapsed ? 'w-[70px]' : 'w-64'}`}>
        <Sidebar
          currentPage={currentPage}
          currentUser={currentUser}
          settings={settings}
          allowedPages={allowedPages}
          onNavigate={(page) => { setCurrentPage(page); setMobileSidebarOpen(false); }}
          onLogout={handleLogout}
          onOpenSettings={handleOpenSettings}
          lowStockCount={lowStockCount}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleSidebarCollapsed}
          language={activeLanguage}
          onRegisterPushSubscription={registerPushSubscription}
        />
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div className="fixed inset-0 bg-black/55" onClick={() => setMobileSidebarOpen(false)}></div>
          <div className="relative z-50 w-64 bg-[#2d323e]">
            <Sidebar
              currentPage={currentPage}
              currentUser={currentUser}
              settings={settings}
              allowedPages={allowedPages}
              onNavigate={(page) => { setCurrentPage(page); setMobileSidebarOpen(false); }}
              onLogout={handleLogout}
              onOpenSettings={() => { handleOpenSettings(); setMobileSidebarOpen(false); }}
              lowStockCount={lowStockCount}
              language={activeLanguage}
              onRegisterPushSubscription={registerPushSubscription}
            />
          </div>
        </div>
      )}

      {/* Main Content Flow Panel */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          currentPage={currentPage}
          currentUser={currentUser}
          companies={companies}
          branches={branches}
          stores={stores}
          currentCompanyId={currentCompanyId}
          currentBranchId={currentBranchId}
          currentStoreId={currentStoreId}
          settings={settings}
          onContextChange={handleContextChange}
          onOpenSettings={handleOpenSettings}
          onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          pageTitle={currentPage}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onOpenGame={() => {
            if (currentUser?.role === 'Super Admin' || currentUser?.role === 'Admin' || settings.allowGamesEnabled !== false) {
              setShowGameModal(true);
            } else {
              toast.info('Mind Refresh Game Breaks are currently disabled by Admin.');
            }
          }}
          onNavigate={(page) => setCurrentPage(page)}
          language={activeLanguage}
          onLanguageChange={(lang) => { setUserAdminLanguage(lang); syncDocumentLang(lang); }}
        />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 scrollbar-thin">
          {/* TRA COMPLIANCE — soft prompt for sellers without a TIN (non-blocking) */}
          {(() => {
            const myCompany = currentUser?.companyId ? companies.find(c => c.id === currentUser.companyId) : null;
            if (myCompany && !myCompany.tinNumber) {
              return (
                <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-[13px] font-bold text-amber-800">{t('TIN Number Required (TRA Compliance)')}</div>
                    <p className="text-[11px] text-amber-700 font-semibold leading-relaxed mt-0.5">
                      {t('To issue compliant EFD receipts for your sales, please add your TIN (Taxpayer Identification Number) in Marketplace Settings. You can keep selling in the meantime.')}
                    </p>
                    <button
                      onClick={() => setCurrentPage('marketplace-settings')}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold rounded-lg transition cursor-pointer"
                    >
                      {t('Add TIN Now')}
                    </button>
                  </div>
                </div>
              );
            }
            return null;
          })()}
          <PanelErrorBoundary panelName="Main panel">
            {renderMainContent()}
          </PanelErrorBoundary>
        </main>
      </div>

      {/* Security enforcement first login Modal overlay */}
      {showForcePasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="w-11 h-11 bg-brand/10 text-brand rounded-full flex items-center justify-center mx-auto shadow-sm">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="text-center space-y-1">
              <span className="font-bold text-gray-900 block text-base">First-time Security Check</span>
              <p className="text-xs text-gray-400 font-semibold leading-relaxed">
                For administrative compliance, you must change your default password before unlocking your terminal.
              </p>
            </div>
            <form onSubmit={handleForcePasswordChange} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 tracking-wider block uppercase">New Password</label>
                <input
                  type="password"
                  required
                  value={forceNewPass}
                  onChange={(e) => setForceNewPass(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 tracking-wider block uppercase">Confirm Password</label>
                <input
                  type="password"
                  required
                  value={forceConfirmPass}
                  onChange={(e) => setForceConfirmPass(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => { void handleForcePasswordChange(); }}
                className="w-full py-2.5 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-lg tracking-wider uppercase mt-4 block"
              >
                Secure and Open Terminal
              </button>
            </form>
          </div>
        </div>
      )}

      {/* System Settings modal */}
      {showSettingsModal && (() => {
        const targetCompId = currentCompanyId || currentUser?.companyId || (companies.length > 0 ? companies[0].id : 1);
        const targetCompObj = companies.find(c => c.id === targetCompId);
        const currLang = targetCompObj?.language || (targetCompId && settings.companyLanguages?.[targetCompId]) || 'en';
        const currCurrency = (targetCompId && settings.companyCurrencies?.[targetCompId]) || targetCompObj?.currency || settings.currency || 'USD';
        const currRate = (targetCompId && settings.companyExchangeRates?.[targetCompId] !== undefined)
          ? settings.companyExchangeRates[targetCompId]
          : (targetCompObj?.exchangeRate !== undefined ? targetCompObj.exchangeRate : (settings.exchangeRate || 1));

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[88vh] my-auto border border-gray-100">
              {/* Modal Header */}
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/90 shrink-0">
                <div className="flex items-center gap-2">
                  <SettingsIcon className="w-5 h-5 text-gray-700" />
                  <span className="font-bold text-gray-900 text-sm">{t('System Settings')}</span>
                </div>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  type="button"
                  className="p-1.5 hover:bg-gray-200/80 rounded-full text-gray-500 hover:text-gray-900 transition focus:outline-none"
                  title={t('Close')}
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Modal Content */}
              <div className="p-5 space-y-4 overflow-y-auto flex-1 scrollbar-thin">
                <div className="bg-indigo-50/80 border border-indigo-200 rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span className="font-bold text-indigo-950 text-xs">{t('Company Selected')}</span>
                    </div>
                    <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-mono font-bold">Independent Unit</span>
                  </div>
                  {currentUser?.role === 'Super Admin' ? (
                    companies.length > 1 ? (
                      <select
                        value={targetCompId}
                        onChange={(e) => { explicitCompanySwitchRef.current = true; setCurrentCompanyId(Number(e.target.value)); }}
                        className="w-full text-xs font-bold bg-white border border-indigo-200 rounded px-2 py-1 text-indigo-950 outline-none"
                      >
                        {companies.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.currency || 'USD'})</option>
                        ))}
                      </select>
                    ) : (
                      <span className="font-bold text-indigo-950 text-xs block">{targetCompObj?.name || `Company #${targetCompId}`}</span>
                    )
                  ) : (
                    <div className="bg-white border border-indigo-200 rounded p-2 text-xs font-bold text-indigo-950 space-y-1">
                      <div className="flex justify-between items-center">
                        <span>{targetCompObj?.name || `Company #${targetCompId}`}</span>
                        <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded uppercase font-bold">Assigned Company</span>
                      </div>
                      {currentUser?.branchId && (
                        <div className="text-[11px] text-gray-600 font-medium">
                          Branch: {branches.find(b => b.id === currentUser.branchId)?.name || `Branch #${currentUser.branchId}`}
                        </div>
                      )}
                      {currentUser?.storeId && (
                        <div className="text-[11px] text-gray-600 font-medium">
                          Store: {stores.find(s => s.id === currentUser.storeId)?.name || `Store #${currentUser.storeId}`}
                        </div>
                      )}
                    </div>
                  )}
                  <span className="text-[10px] text-indigo-700 block">{t('Configuring isolated currency & language preferences for this company')}</span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">{t('Display Language')}</label>
                  <select
                    value={currLang}
                    onChange={(e) => {
                      const newLang = e.target.value as 'en' | 'sw' | 'fr' | 'es';
                      const updatedCompanyLangs = { ...(settings.companyLanguages || {}) };
                      if (targetCompId) {
                        updatedCompanyLangs[targetCompId] = newLang;
                      }
                      const nextSettings = {
                        ...settings,
                        companyLanguages: updatedCompanyLangs
                      };
                      const updatedCompanies = targetCompId ? companies.map(c => c.id === targetCompId ? { ...c, language: newLang } : c) : companies;
                      saveAllData({ settings: nextSettings, companies: updatedCompanies });
                      toast.success(t('Language preference saved!'));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white font-medium focus:ring-2 focus:ring-brand/20 outline-none"
                  >
                    <option value="en">English (default)</option>
                    <option value="sw">Kiswahili (Swahili)</option>
                    <option value="fr">Français (French)</option>
                    <option value="es">Español (Spanish)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">{t('Display Currency')}</label>
                  <select
                    value={currCurrency}
                    onChange={(e) => {
                      const newCurr = e.target.value as any;
                      const updatedCompanyCurrencies = { ...(settings.companyCurrencies || {}) };
                      if (targetCompId) {
                        updatedCompanyCurrencies[targetCompId] = newCurr;
                      }
                      const nextSettings = {
                        ...settings,
                        companyCurrencies: updatedCompanyCurrencies,
                        currency: newCurr
                      };
                      const updatedCompanies = targetCompId ? companies.map(c => c.id === targetCompId ? { ...c, currency: newCurr } : c) : companies;
                      saveAllData({ settings: nextSettings, companies: updatedCompanies });
                      toast.success(t('Currency preference saved!'));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white font-medium focus:ring-2 focus:ring-brand/20 outline-none"
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

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">{t('Exchange conversion (1 USD = X Local Units)')}</label>
                  <input
                    type="number"
                    step="any"
                    value={currRate}
                    onChange={(e) => {
                      const newRate = parseFloat(e.target.value) || 1;
                      const updatedCompanyRates = { ...(settings.companyExchangeRates || {}) };
                      if (targetCompId) {
                        updatedCompanyRates[targetCompId] = newRate;
                      }
                      const nextSettings = {
                        ...settings,
                        companyExchangeRates: updatedCompanyRates,
                        exchangeRate: newRate
                      };
                      const updatedCompanies = targetCompId ? companies.map(c => c.id === targetCompId ? { ...c, exchangeRate: newRate } : c) : companies;
                      saveAllData({ settings: nextSettings, companies: updatedCompanies });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white font-mono focus:ring-2 focus:ring-brand/20 outline-none"
                  />
                </div>

                {/* Mind Refresh Game Break Permission Toggle */}
                {(currentUser?.role === 'Super Admin' || currentUser?.role === 'Admin') && (
                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-gray-800 block">🎮 Mind Refresh Game Break</span>
                      <span className="text-[10px] text-gray-400 block">Allow operators to play arcade game by clicking user letter avatar</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.allowGamesEnabled !== false}
                      onChange={(e) => {
                        const nextSettings = { ...settings, allowGamesEnabled: e.target.checked };
                        saveAllData({ settings: nextSettings });
                        toast.success(e.target.checked ? t('Game breaks enabled for operators') : t('Game breaks disabled'));
                      }}
                      className="w-4 h-4 text-brand rounded border-gray-300 focus:ring-brand cursor-pointer"
                    />
                  </div>
                )}

                {/* Available ONLY to Founder Super Admin */}
                {currentUser?.role === 'Super Admin' && (
                  <>
                    {/* Secure Database Backup and Restore */}
                    <div className="pt-4 border-t border-gray-100 space-y-3">
                      <span className="text-xs font-bold text-gray-700 block uppercase flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5 text-blue-600" /> Database Backup &amp; Restore
                      </span>
                      <p className="text-[10px] text-gray-400 font-semibold leading-relaxed">
                        Download a complete backup of all products, sales, purchases, settings, and logs to your desktop, or upload a previously saved file to restore session data.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={handleExportDatabase}
                          className="py-2 px-3 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs"
                        >
                          <FileSpreadsheet className="w-4 h-4 text-green-600" /> Export JSON
                        </button>
                        <label className="py-2 px-3 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition shadow-xs">
                          <FileUp className="w-4 h-4 text-blue-600" /> Import JSON
                          <input
                            type="file"
                            accept=".json"
                            onChange={handleImportDatabase}
                            className="hidden"
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={handleExportHTML}
                        className="w-full py-2 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm"
                      >
                        <Globe className="w-4 h-4" /> Export Interactive HTML App
                      </button>
                      <div className="text-[9px] text-green-600 bg-green-50/50 p-2 rounded border border-green-100 font-semibold flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 flex-shrink-0" />
                        <span>Real-time Cloud Database Synchronization is Active.</span>
                      </div>
                    </div>

                    {/* System State Recovery */}
                    <div className="pt-4 border-t border-gray-100 space-y-3">
                      <div>
                        <span className="text-xs font-bold text-brand block uppercase">System State Recovery</span>
                        <p className="text-[10px] text-gray-400 font-semibold leading-relaxed">
                          Restore default companies, default active demo operators, initial stocks, and system metrics.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('Restore initial database registers? This will wipe your session changes.')) {
                              restoreFactoryDefaults();
                              setShowSettingsModal(false);
                              toast.success(t('Database successfully restored! reloading window...'));
                              setTimeout(() => {
                                window.location.reload();
                              }, 1500);
                            }
                          }}
                          className="w-full mt-2 py-2 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-lg text-xs tracking-wider uppercase transition-colors"
                        >
                          Restore Template DB
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/90 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="w-full py-2 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-lg text-xs transition shadow-xs flex items-center justify-center gap-2"
                >
                  {t('Close Settings')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* POS Checkout Terminal Modal */}
      <POSModal
        isOpen={showSOModal}
        onClose={() => setShowSOModal(false)}
        customers={customers}
        stockItems={activeStockItems}
        salesOrders={activeSalesOrders}
        currentStoreId={currentStoreId}
        stores={stores}
        saveAllData={saveAllData}
        logAction={logAction}
        settings={settings}
        t={t}
        currentUser={currentUser}
        posShifts={posShifts}
        currency={activeCurrency}
        exchangeRate={activeExchangeRate}
      />

      {/* PO order Modal */}
      <PurchaseOrderModal
        isOpen={showPOModal}
        onClose={() => setShowPOModal(false)}
        suppliers={suppliers}
        stockItems={activeStockItems}
        purchaseOrders={activePurchaseOrders}
        currentStoreId={currentStoreId}
        stores={visibleStores}
        saveAllData={saveAllData}
        logAction={logAction}
        settings={settings}
        t={t}
        currency={activeCurrency}
        exchangeRate={activeExchangeRate}
      />

      {/* Product Add/Edit Modal */}
      {showStockModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between bg-gray-50 shrink-0">
              <span className="font-bold text-gray-900 text-sm">
                {editingStockItem ? 'Edit Product Parameters' : 'Add New Product'}
              </span>
              <button onClick={() => setShowStockModal(false)} className="p-1 hover:bg-gray-200 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              id="stockItemForm"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const name = fd.get('name') as string;
                const code = fd.get('code') as string;
                const cat = (fd.get('category') as string)?.trim() || 'Uncategorized';
                const unit = fd.get('unit') as 'Kg' | 'Litres' | 'Package';
                const pPrice = parseFloat(fd.get('purchasePrice') as string) || 0;
                const rPrice = parseFloat(fd.get('retailPrice') as string) || 0;
                const wPrice = parseFloat(fd.get('wholesalePrice') as string) || 0;
                const partnerPrice = parseFloat(fd.get('partnerPrice') as string) || 0;
                const lowLimit = parseInt(fd.get('lowStockQty') as string) || 5;
                const imageUrl = (fd.get('imageUrl') as string) || '';

                const expiryDate = fd.get('expiryDate') as string || '';

                const expiryDates: Record<number, string> = {};
                visibleStores.forEach(s => {
                  const sExpiry = fd.get(`expiryDate_store_${s.id}`) as string;
                  if (sExpiry) {
                    expiryDates[s.id] = sExpiry;
                  }
                });

                // Adjust rates if not USD (database base is USD)
                const isUSD = activeCurrency === 'USD';
                const finalPPrice = !isUSD ? pPrice / activeExchangeRate : pPrice;
                const finalRPrice = !isUSD ? rPrice / activeExchangeRate : rPrice;
                const finalWPrice = !isUSD ? wPrice / activeExchangeRate : wPrice;
                const finalPartnerPrice = !isUSD ? partnerPrice / activeExchangeRate : partnerPrice;

                const useSubUnitPricing = fd.get('useSubUnitPricing') === 'on';
                const subUnitName = fd.get('subUnitName') as string || '';
                const subUnitConversion = parseFloat(fd.get('subUnitConversion') as string) || 1;
                const subUnitRPriceInput = parseFloat(fd.get('subUnitRetailPrice') as string) || 0;
                const subUnitWPriceInput = parseFloat(fd.get('subUnitWholesalePrice') as string) || 0;
                const subUnitPPriceInput = parseFloat(fd.get('subUnitPartnerPrice') as string) || 0;

                const finalSubRPrice = !isUSD ? subUnitRPriceInput / activeExchangeRate : subUnitRPriceInput;
                const finalSubWPrice = !isUSD ? subUnitWPriceInput / activeExchangeRate : subUnitWPriceInput;
                const finalSubPPrice = !isUSD ? subUnitPPriceInput / activeExchangeRate : subUnitPPriceInput;

                // Extract company pricing inputs
                const existingCompanyPrices = editingStockItem?.companyPrices || {};
                const processedCompanyPrices: Record<number, any> = { ...existingCompanyPrices };
                visibleCompanies.forEach(comp => {
                  const cInput = companyPricingInput[comp.id];
                  if (cInput && (cInput.purchasePrice || cInput.retailPrice || cInput.wholesalePrice || cInput.partnerPrice)) {
                    const cpP = parseFloat(cInput.purchasePrice) || 0;
                    const crP = parseFloat(cInput.retailPrice) || 0;
                    const cwP = parseFloat(cInput.wholesalePrice) || 0;
                    const cPartnerP = parseFloat(cInput.partnerPrice) || 0;

                    const cSubR = parseFloat(cInput.subUnitRetailPrice || '0') || 0;
                    const cSubW = parseFloat(cInput.subUnitWholesalePrice || '0') || 0;
                    const cSubP = parseFloat(cInput.subUnitPartnerPrice || '0') || 0;

                    const compRate = getActiveExchangeRate(comp.id);
                    const compIsUSD = getActiveCurrency(comp.id) === 'USD';

                    processedCompanyPrices[comp.id] = {
                      purchasePrice: !compIsUSD ? cpP / compRate : cpP,
                      retailPrice: !compIsUSD ? crP / compRate : crP,
                      wholesalePrice: !compIsUSD ? cwP / compRate : cwP,
                      partnerPrice: !compIsUSD ? cPartnerP / compRate : cPartnerP,
                      ...(useSubUnitPricing ? {
                        subUnitRetailPrice: !compIsUSD ? cSubR / compRate : cSubR,
                        subUnitWholesalePrice: !compIsUSD ? cSubW / compRate : cSubW,
                        subUnitPartnerPrice: !compIsUSD ? cSubP / compRate : cSubP,
                      } : {})
                    };
                  } else {
                    delete processedCompanyPrices[comp.id];
                  }
                });

                // Extract store pricing inputs
                const existingStorePrices = editingStockItem?.storePrices || {};
                const processedStorePrices: Record<number, any> = { ...existingStorePrices };
                visibleStores.forEach(st => {
                  const sInput = storePricingInput[st.id];
                  if (sInput && (sInput.purchasePrice || sInput.retailPrice || sInput.wholesalePrice || sInput.partnerPrice)) {
                    const stP = parseFloat(sInput.purchasePrice) || 0;
                    const stR = parseFloat(sInput.retailPrice) || 0;
                    const stW = parseFloat(sInput.wholesalePrice) || 0;
                    const stPartner = parseFloat(sInput.partnerPrice) || 0;

                    const stSubR = parseFloat(sInput.subUnitRetailPrice || '0') || 0;
                    const stSubW = parseFloat(sInput.subUnitWholesalePrice || '0') || 0;
                    const stSubP = parseFloat(sInput.subUnitPartnerPrice || '0') || 0;

                    const stCompId = st.companyId || currentCompanyId || currentUser?.companyId || (companies.length > 0 ? companies[0].id : 1);
                    const stRate = getActiveExchangeRate(stCompId);
                    const stIsUSD = getActiveCurrency(stCompId) === 'USD';

                    processedStorePrices[st.id] = {
                      purchasePrice: !stIsUSD ? stP / stRate : stP,
                      retailPrice: !stIsUSD ? stR / stRate : stR,
                      wholesalePrice: !stIsUSD ? stW / stRate : stW,
                      partnerPrice: !stIsUSD ? stPartner / stRate : stPartner,
                      ...(useSubUnitPricing ? {
                        subUnitRetailPrice: !stIsUSD ? stSubR / stRate : stSubR,
                        subUnitWholesalePrice: !stIsUSD ? stSubW / stRate : stSubW,
                        subUnitPartnerPrice: !stIsUSD ? stSubP / stRate : stSubP,
                      } : {})
                    };
                  } else {
                    delete processedStorePrices[st.id];
                  }
                });

                if (editingStockItem) {
                  // ISOLATED MICRO-UPDATE (PATCH-style): commit ONLY this record via
                  // mutateCollectionRecord (atomic functional setState + per-record
                  // optimistic lock + HTTP 200/recordId ack). We never rewrite the whole
                  // stockItems array to the server, so a background sync can't roll the
                  // edit back or resurrect an older snapshot of this product.
                  const editedProduct: any = {
                    ...editingStockItem,
                    companyId: editingStockItem.companyId || currentCompanyId || currentUser?.companyId || 1,
                    name, code, category: cat, unit,
                    purchasePrice: finalPPrice, retailPrice: finalRPrice, wholesalePrice: finalWPrice, partnerPrice: finalPartnerPrice,
                    lowStockQty: lowLimit, imageUrl, expiryDate: expiryDate || undefined,
                    expiryDates: Object.keys(expiryDates).length > 0 ? expiryDates : undefined,
                    useSubUnitPricing,
                    subUnitName,
                    subUnitConversion,
                    subUnitRetailPrice: finalSubRPrice,
                    subUnitWholesalePrice: finalSubWPrice,
                    subUnitPartnerPrice: finalSubPPrice,
                    companyPrices: Object.keys(processedCompanyPrices).length > 0 ? processedCompanyPrices : undefined,
                    storePrices: Object.keys(processedStorePrices).length > 0 ? processedStorePrices : undefined,
                    updated_at: Date.now()
                  };
                  void mutateCollectionRecord('stockItems', 'upsert', editingStockItem.id, editedProduct);
                  logAction('Updated Product', `Modified SKU parameters for ${code}`);
                  toast.success(t('Product parameters updated successfully!'));
                } else {
                  const maxId = stockItems.length > 0 ? Math.max(...stockItems.map(p => p.id)) : 0;
                  const pStockObj: Record<number, number> = {};
                  stores.forEach(s => { pStockObj[s.id] = 0; });
                  
                  const targetCompId = currentCompanyId || currentUser?.companyId || 1;
                  const newProduct: StockItem = {
                    id: maxId + 1,
                    companyId: targetCompId,
                    name, code, category: cat, unit,
                    stock: pStockObj,
                    purchasePrice: finalPPrice, retailPrice: finalRPrice, wholesalePrice: finalWPrice, partnerPrice: finalPartnerPrice,
                    lowStockQty: lowLimit, imageUrl,
                    expiryDate: expiryDate || undefined,
                    expiryDates: Object.keys(expiryDates).length > 0 ? expiryDates : undefined,
                    useSubUnitPricing,
                    subUnitName,
                    subUnitConversion,
                    subUnitRetailPrice: finalSubRPrice,
                    subUnitWholesalePrice: finalSubWPrice,
                    subUnitPartnerPrice: finalSubPPrice,
                    companyPrices: Object.keys(processedCompanyPrices).length > 0 ? processedCompanyPrices : undefined,
                    storePrices: Object.keys(processedStorePrices).length > 0 ? processedStorePrices : undefined,
                    updated_at: Date.now()
                  };
                  // ISOLATED MICRO-UPDATE: commit ONLY the new record (atomic append +
                  // per-record lock + ack), avoiding any mass full-array overwrite.
                  void mutateCollectionRecord('stockItems', 'upsert', newProduct.id, newProduct);
                  logAction('Created Product', `Registered new inventory SKU: ${code}`);
                  toast.success(t('New product registered successfully!'));
                }
                setShowStockModal(false);
              }}
              className="p-5 space-y-4 overflow-y-auto"
            >
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">{t('Product Name')}</label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={editingStockItem?.name || ''}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">{t('Product Image (URL, Upload, or Camera)')}</label>
                <div className="flex flex-wrap sm:flex-nowrap gap-2">
                  <input
                    type="text"
                    name="imageUrl"
                    id="modal-image-url-input"
                    placeholder="https://images.unsplash.com/... or snapshot"
                    defaultValue={editingStockItem?.imageUrl || ''}
                    className="flex-1 min-w-[160px] px-3 py-2 border rounded-lg text-sm bg-gray-50 outline-none"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        setShowCameraCaptureModal(true);
                        const stream = await navigator.mediaDevices.getUserMedia({
                          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
                        });
                        setCameraStream(stream);
                        setTimeout(() => {
                          if (cameraVideoRef.current) {
                            cameraVideoRef.current.srcObject = stream;
                          }
                        }, 100);
                      } catch (err: any) {
                        toast.error(t('Unable to access device camera. Check permissions or upload an image file.'));
                        setShowCameraCaptureModal(false);
                      }
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap shadow-xs"
                  >
                    <Camera className="w-3.5 h-3.5 text-white" />
                    {t('Camera')}
                  </button>
                  <label className="bg-gray-100 hover:bg-gray-200 border cursor-pointer text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition whitespace-nowrap">
                    {t('Upload')}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            if (event.target?.result) {
                              const input = document.getElementById('modal-image-url-input') as HTMLInputElement;
                              if (input) {
                                input.value = event.target.result as string;
                              }
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                  <label className="bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 cursor-pointer px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition whitespace-nowrap sm:hidden">
                    📸 {t('Snap')}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            if (event.target?.result) {
                              const input = document.getElementById('modal-image-url-input') as HTMLInputElement;
                              if (input) {
                                input.value = event.target.result as string;
                              }
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">SKU / Barcode</label>
                <input
                  type="text"
                  name="code"
                  required
                  defaultValue={editingStockItem?.code || ''}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Category</label>
                <select
                  name="category"
                  defaultValue={(editingStockItem?.category && editingStockItem.category.trim())
                    ? editingStockItem.category
                    : (getStoreCategories(categories, currentStoreId)[0] || 'Uncategorized')}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                >
                  <option value="Uncategorized">{t('Uncategorized')}</option>
                  {getStoreCategories(categories, currentStoreId).map(c => (
                    <option key={c} value={c}>{cleanCategoryName(c)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Selling Unit (Measurement)</label>
                <select
                  name="unit"
                  defaultValue={editingStockItem?.unit || 'Package'}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                >
                  <option value="Kg">Kilograms (Kg)</option>
                  <option value="Grams">Grams (g)</option>
                  <option value="Litres">Litres (L)</option>
                  <option value="Pcs">Pieces (Pcs)</option>
                  <option value="Package">Package</option>
                  <option value="Sack">Sack / Bag (Sack)</option>
                  <option value="Carton">Carton (Ctn)</option>
                  <option value="Box">Box (Box)</option>
                  <option value="Crate">Crate (Crt)</option>
                  <option value="Dozen">Dozen (Dzn)</option>
                  <option value="Bundle">Bundle (Bndl)</option>
                  <option value="Roll">Roll (Roll)</option>
                  <option value="Gallon">Gallon (Gal)</option>
                  <option value="Pallet">Pallet (Plt)</option>
                  <option value="Ton">Metric Ton (Ton)</option>
                  <option value="Container">Container (Ctr)</option>
                  <option value="Barrel">Barrel (Brl)</option>
                  <option value="Drum">Drum (Drm)</option>
                  <option value="Bale">Bale (Ble)</option>
                  <option value="Tray">Tray (Try)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">{t('Purchase Price')}</label>
                  <input
                    type="number"
                    step="any"
                    name="purchasePrice"
                    required
                    value={formPurchasePrice}
                    onChange={(e) => handleMainPriceChange('purchase', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">{t('Alert Min Quantity')}</label>
                  <input
                    type="number"
                    name="lowStockQty"
                    required
                    defaultValue={editingStockItem?.lowStockQty || 5}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 outline-none font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700 flex flex-wrap items-center">
                    {t('Global Base Selling / Wholesale Price')}
                    {getMarginText(formWholesalePrice, formPurchasePrice)}
                  </label>
                  <input
                    type="number"
                    step="any"
                    name="wholesalePrice"
                    required
                    value={formWholesalePrice}
                    onChange={(e) => {
                      handleMainPriceChange('wholesale', e.target.value);
                      if (!formRetailPrice) handleMainPriceChange('retail', e.target.value);
                      if (!formPartnerPrice) handleMainPriceChange('partner', e.target.value);
                    }}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none font-mono"
                  />
                  {/* Hidden inputs for global retail and partner prices if not specified per company/store */}
                  <input type="hidden" name="retailPrice" value={formRetailPrice || formWholesalePrice || '0'} />
                  <input type="hidden" name="partnerPrice" value={formPartnerPrice || formWholesalePrice || '0'} />
                </div>
              </div>

              {/* Live Profit Calculation Preview */}
              {(() => {
                const costVal = parseFloat(formPurchasePrice || '0') || 0;
                const retailVal = parseFloat(formWholesalePrice || formRetailPrice || '0') || 0;
                if (costVal > 0 && retailVal > 0) {
                  const unitProfit = retailVal - costVal;
                  const marginPct = ((unitProfit / retailVal) * 100).toFixed(1);
                  const markupPct = ((unitProfit / costVal) * 100).toFixed(1);
                  const isProfitable = unitProfit >= 0;
                  return (
                    <div className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs font-semibold ${
                      isProfitable ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950' : 'bg-red-50/80 border-red-200 text-red-950'
                    }`}>
                      <div className="flex items-center gap-2">
                        <TrendingUp className={`w-4 h-4 shrink-0 ${isProfitable ? 'text-emerald-600' : 'text-red-600'}`} />
                        <span>
                          <strong>Estimated Unit Profit:</strong> {isProfitable ? '+' : ''}{formatMoney(unitProfit, activeCurrency, activeExchangeRate)} / unit
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] font-mono">
                        <span className="bg-white px-2 py-0.5 rounded border border-emerald-200 shadow-2xs">
                          Margin: {marginPct}%
                        </span>
                        <span className="bg-white px-2 py-0.5 rounded border border-emerald-200 shadow-2xs">
                          Markup: {markupPct}%
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Fractional Sub-Unit Pricing Section */}
              <div className="border border-brand/20 bg-brand/5 rounded-xl p-3 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    name="useSubUnitPricing"
                    checked={formUseSubUnit}
                    onChange={(e) => setFormUseSubUnit(e.target.checked)}
                    className="w-4 h-4 text-brand rounded border-gray-300 focus:ring-brand animate-none"
                  />
                  <span className="text-xs font-bold text-gray-800">Enable Fractional & Sub-Unit Pricing</span>
                </label>

                {formUseSubUnit && (
                  <div className="space-y-3 pt-2 border-t border-brand/10">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-600 uppercase">Sub-Unit Name</label>
                        <input
                          type="text"
                          name="subUnitName"
                          placeholder="e.g. Gram, Piece, ml, KG"
                          defaultValue={editingStockItem?.subUnitName || ''}
                          required={formUseSubUnit}
                          className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-600 uppercase">Conversion Factor</label>
                        <input
                          type="number"
                          step="any"
                          name="subUnitConversion"
                          placeholder="e.g. 1000, 12"
                          value={formConversionFactor}
                          onChange={(e) => handleConversionChange(e.target.value)}
                          required={formUseSubUnit}
                          className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white outline-none font-mono"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-gray-600 uppercase flex flex-wrap items-center">
                          Retail
                          {getSubMarginText(formSubRetailPrice, formPurchasePrice, formConversionFactor)}
                        </label>
                        <input
                          type="number"
                          step="any"
                          name="subUnitRetailPrice"
                          value={formSubRetailPrice}
                          onChange={(e) => setFormSubRetailPrice(e.target.value)}
                          required={formUseSubUnit}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white outline-none font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-gray-600 uppercase flex flex-wrap items-center">
                          Wholesale
                          {getSubMarginText(formSubWholesalePrice, formPurchasePrice, formConversionFactor)}
                        </label>
                        <input
                          type="number"
                          step="any"
                          name="subUnitWholesalePrice"
                          value={formSubWholesalePrice}
                          onChange={(e) => setFormSubWholesalePrice(e.target.value)}
                          required={formUseSubUnit}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white outline-none font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-gray-600 uppercase flex flex-wrap items-center">
                          Partner
                          {getSubMarginText(formSubPartnerPrice, formPurchasePrice, formConversionFactor)}
                        </label>
                        <input
                          type="number"
                          step="any"
                          name="subUnitPartnerPrice"
                          value={formSubPartnerPrice}
                          onChange={(e) => setFormSubPartnerPrice(e.target.value)}
                          required={formUseSubUnit}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white outline-none font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {/* Multi-Company Price Setup */}
              {visibleCompanies.length > 0 && (
                <div className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                        Company-Specific Pricing Overrides
                      </span>
                    </div>
                    <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                      {visibleCompanies.length} {t('Companies')}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-600">
                    Set specific Purchase and Selling prices per company/entity. If left blank, default global pricing above will apply.
                  </p>

                  <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
                    {visibleCompanies.map(comp => {
                      const cVal = companyPricingInput[comp.id] || {
                        purchasePrice: '',
                        retailPrice: '',
                        wholesalePrice: '',
                        partnerPrice: '',
                        subUnitRetailPrice: '',
                        subUnitWholesalePrice: '',
                        subUnitPartnerPrice: ''
                      };

                      return (
                        <div key={comp.id} className="bg-white rounded-lg border border-indigo-100 p-2.5 space-y-2 shadow-2xs">
                          <div className="flex justify-between items-center bg-indigo-50/80 px-2 py-1 rounded border border-indigo-100">
                            <span className="font-extrabold text-xs text-indigo-950">{comp.name}</span>
                            <span className="text-[9px] font-bold text-indigo-600 bg-white px-1.5 py-0.5 rounded border border-indigo-200">
                              {comp.code || 'MAIN'}
                            </span>
                          </div>

                          <div className="grid grid-cols-4 gap-1.5">
                            <div className="space-y-0.5">
                              <label className="text-[9px] font-bold text-gray-500 uppercase">{t('Purchase')}</label>
                              <input
                                type="number"
                                step="any"
                                placeholder={formPurchasePrice || '0'}
                                value={cVal.purchasePrice}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setCompanyPricingInput(prev => ({
                                    ...prev,
                                    [comp.id]: { ...(prev[comp.id] || { purchasePrice: '', retailPrice: '', wholesalePrice: '', partnerPrice: '', subUnitRetailPrice: '', subUnitWholesalePrice: '', subUnitPartnerPrice: '' }), purchasePrice: val }
                                  }));
                                }}
                                className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs outline-none focus:border-indigo-500 font-mono"
                              />
                            </div>

                            <div className="space-y-0.5">
                              <label className="text-[9px] font-bold text-blue-600 uppercase">{t('Retail')}</label>
                              <input
                                type="number"
                                step="any"
                                placeholder={formRetailPrice || '0'}
                                value={cVal.retailPrice}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setCompanyPricingInput(prev => ({
                                    ...prev,
                                    [comp.id]: { ...(prev[comp.id] || { purchasePrice: '', retailPrice: '', wholesalePrice: '', partnerPrice: '', subUnitRetailPrice: '', subUnitWholesalePrice: '', subUnitPartnerPrice: '' }), retailPrice: val }
                                  }));
                                }}
                                className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs outline-none focus:border-indigo-500 font-mono"
                              />
                            </div>

                            <div className="space-y-0.5">
                              <label className="text-[9px] font-bold text-amber-600 uppercase">{t('Wholesale')}</label>
                              <input
                                type="number"
                                step="any"
                                placeholder={formWholesalePrice || '0'}
                                value={cVal.wholesalePrice}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setCompanyPricingInput(prev => ({
                                    ...prev,
                                    [comp.id]: { ...(prev[comp.id] || { purchasePrice: '', retailPrice: '', wholesalePrice: '', partnerPrice: '', subUnitRetailPrice: '', subUnitWholesalePrice: '', subUnitPartnerPrice: '' }), wholesalePrice: val }
                                  }));
                                }}
                                className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs outline-none focus:border-indigo-500 font-mono"
                              />
                            </div>

                            <div className="space-y-0.5">
                              <label className="text-[9px] font-bold text-indigo-600 uppercase">{t('Partner')}</label>
                              <input
                                type="number"
                                step="any"
                                placeholder={formPartnerPrice || '0'}
                                value={cVal.partnerPrice}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setCompanyPricingInput(prev => ({
                                    ...prev,
                                    [comp.id]: { ...(prev[comp.id] || { purchasePrice: '', retailPrice: '', wholesalePrice: '', partnerPrice: '', subUnitRetailPrice: '', subUnitWholesalePrice: '', subUnitPartnerPrice: '' }), partnerPrice: val }
                                  }));
                                }}
                                className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs outline-none focus:border-indigo-500 font-mono"
                              />
                            </div>
                          </div>

                          {formUseSubUnit && (
                            <div className="pt-1.5 border-t border-indigo-100">
                              <span className="text-[9px] font-bold text-indigo-600 uppercase block mb-1">Sub-unit Company Pricing</span>
                              <div className="grid grid-cols-3 gap-1.5">
                                <div className="space-y-0.5">
                                  <label className="text-[8px] font-bold text-gray-500 uppercase">Sub Retail</label>
                                  <input
                                    type="number"
                                    step="any"
                                    placeholder={formSubRetailPrice || '0'}
                                    value={cVal.subUnitRetailPrice}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setCompanyPricingInput(prev => ({
                                        ...prev,
                                        [comp.id]: { ...(prev[comp.id] || { purchasePrice: '', retailPrice: '', wholesalePrice: '', partnerPrice: '', subUnitRetailPrice: '', subUnitWholesalePrice: '', subUnitPartnerPrice: '' }), subUnitRetailPrice: val }
                                      }));
                                    }}
                                    className="w-full px-1.5 py-0.5 border border-gray-300 rounded text-[11px] outline-none font-mono"
                                  />
                                </div>
                                <div className="space-y-0.5">
                                  <label className="text-[8px] font-bold text-gray-500 uppercase">Sub Wholesale</label>
                                  <input
                                    type="number"
                                    step="any"
                                    placeholder={formSubWholesalePrice || '0'}
                                    value={cVal.subUnitWholesalePrice}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setCompanyPricingInput(prev => ({
                                        ...prev,
                                        [comp.id]: { ...(prev[comp.id] || { purchasePrice: '', retailPrice: '', wholesalePrice: '', partnerPrice: '', subUnitRetailPrice: '', subUnitWholesalePrice: '', subUnitPartnerPrice: '' }), subUnitWholesalePrice: val }
                                      }));
                                    }}
                                    className="w-full px-1.5 py-0.5 border border-gray-300 rounded text-[11px] outline-none font-mono"
                                  />
                                </div>
                                <div className="space-y-0.5">
                                  <label className="text-[8px] font-bold text-gray-500 uppercase">Sub Partner</label>
                                  <input
                                    type="number"
                                    step="any"
                                    placeholder={formSubPartnerPrice || '0'}
                                    value={cVal.subUnitPartnerPrice}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setCompanyPricingInput(prev => ({
                                        ...prev,
                                        [comp.id]: { ...(prev[comp.id] || { purchasePrice: '', retailPrice: '', wholesalePrice: '', partnerPrice: '', subUnitRetailPrice: '', subUnitWholesalePrice: '', subUnitPartnerPrice: '' }), subUnitPartnerPrice: val }
                                      }));
                                    }}
                                    className="w-full px-1.5 py-0.5 border border-gray-300 rounded text-[11px] outline-none font-mono"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Branch/Store-Specific Price Setup */}
              {visibleStores.length > 0 && (
                <div className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <StoreIcon className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                        Branch/Store-Specific Pricing Overrides
                      </span>
                    </div>
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                      {visibleStores.length} {t('Stores')}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-600">
                    Set store-specific purchase and sales prices for each branch or shop location. These take top precedence over company and global prices.
                  </p>

                  <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
                    {visibleStores.map(st => {
                      const stVal = storePricingInput[st.id] || {
                        purchasePrice: '',
                        retailPrice: '',
                        wholesalePrice: '',
                        partnerPrice: '',
                        subUnitRetailPrice: '',
                        subUnitWholesalePrice: '',
                        subUnitPartnerPrice: ''
                      };

                      return (
                        <div key={st.id} className="bg-white rounded-lg border border-emerald-100 p-2.5 space-y-2 shadow-2xs">
                          <div className="flex justify-between items-center bg-emerald-50/80 px-2 py-1 rounded border border-emerald-100">
                            <span className="font-extrabold text-xs text-emerald-950">{st.name}</span>
                            <span className="text-[9px] font-bold text-emerald-700 bg-white px-1.5 py-0.5 rounded border border-emerald-200">
                              {st.code || `STORE #${st.id}`}
                            </span>
                          </div>

                          <div className="grid grid-cols-4 gap-1.5">
                            <div className="space-y-0.5">
                              <label className="text-[9px] font-bold text-gray-500 uppercase">{t('Store Purchase')}</label>
                              <input
                                type="number"
                                step="any"
                                placeholder={formPurchasePrice || '0'}
                                value={stVal.purchasePrice}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setStorePricingInput(prev => ({
                                    ...prev,
                                    [st.id]: { ...(prev[st.id] || { purchasePrice: '', retailPrice: '', wholesalePrice: '', partnerPrice: '', subUnitRetailPrice: '', subUnitWholesalePrice: '', subUnitPartnerPrice: '' }), purchasePrice: val }
                                  }));
                                }}
                                className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs outline-none focus:border-emerald-500 font-mono"
                              />
                            </div>

                            <div className="space-y-0.5">
                              <label className="text-[9px] font-bold text-blue-600 uppercase">{t('Store Retail')}</label>
                              <input
                                type="number"
                                step="any"
                                placeholder={formRetailPrice || '0'}
                                value={stVal.retailPrice}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setStorePricingInput(prev => ({
                                    ...prev,
                                    [st.id]: { ...(prev[st.id] || { purchasePrice: '', retailPrice: '', wholesalePrice: '', partnerPrice: '', subUnitRetailPrice: '', subUnitWholesalePrice: '', subUnitPartnerPrice: '' }), retailPrice: val }
                                  }));
                                }}
                                className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs outline-none focus:border-emerald-500 font-mono"
                              />
                            </div>

                            <div className="space-y-0.5">
                              <label className="text-[9px] font-bold text-amber-600 uppercase">{t('Store Wholesale')}</label>
                              <input
                                type="number"
                                step="any"
                                placeholder={formWholesalePrice || '0'}
                                value={stVal.wholesalePrice}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setStorePricingInput(prev => ({
                                    ...prev,
                                    [st.id]: { ...(prev[st.id] || { purchasePrice: '', retailPrice: '', wholesalePrice: '', partnerPrice: '', subUnitRetailPrice: '', subUnitWholesalePrice: '', subUnitPartnerPrice: '' }), wholesalePrice: val }
                                  }));
                                }}
                                className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs outline-none focus:border-emerald-500 font-mono"
                              />
                            </div>

                            <div className="space-y-0.5">
                              <label className="text-[9px] font-bold text-indigo-600 uppercase">{t('Store Partner')}</label>
                              <input
                                type="number"
                                step="any"
                                placeholder={formPartnerPrice || '0'}
                                value={stVal.partnerPrice}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setStorePricingInput(prev => ({
                                    ...prev,
                                    [st.id]: { ...(prev[st.id] || { purchasePrice: '', retailPrice: '', wholesalePrice: '', partnerPrice: '', subUnitRetailPrice: '', subUnitWholesalePrice: '', subUnitPartnerPrice: '' }), partnerPrice: val }
                                  }));
                                }}
                                className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs outline-none focus:border-emerald-500 font-mono"
                              />
                            </div>
                          </div>

                          {formUseSubUnit && (
                            <div className="pt-1.5 border-t border-emerald-100">
                              <span className="text-[9px] font-bold text-emerald-700 uppercase block mb-1">Sub-unit Store Pricing</span>
                              <div className="grid grid-cols-3 gap-1.5">
                                <div className="space-y-0.5">
                                  <label className="text-[8px] font-bold text-gray-500 uppercase">Sub Retail</label>
                                  <input
                                    type="number"
                                    step="any"
                                    placeholder={formSubRetailPrice || '0'}
                                    value={stVal.subUnitRetailPrice}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setStorePricingInput(prev => ({
                                        ...prev,
                                        [st.id]: { ...(prev[st.id] || { purchasePrice: '', retailPrice: '', wholesalePrice: '', partnerPrice: '', subUnitRetailPrice: '', subUnitWholesalePrice: '', subUnitPartnerPrice: '' }), subUnitRetailPrice: val }
                                      }));
                                    }}
                                    className="w-full px-1.5 py-0.5 border border-gray-300 rounded text-[11px] outline-none font-mono"
                                  />
                                </div>
                                <div className="space-y-0.5">
                                  <label className="text-[8px] font-bold text-gray-500 uppercase">Sub Wholesale</label>
                                  <input
                                    type="number"
                                    step="any"
                                    placeholder={formSubWholesalePrice || '0'}
                                    value={stVal.subUnitWholesalePrice}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setStorePricingInput(prev => ({
                                        ...prev,
                                        [st.id]: { ...(prev[st.id] || { purchasePrice: '', retailPrice: '', wholesalePrice: '', partnerPrice: '', subUnitRetailPrice: '', subUnitWholesalePrice: '', subUnitPartnerPrice: '' }), subUnitWholesalePrice: val }
                                      }));
                                    }}
                                    className="w-full px-1.5 py-0.5 border border-gray-300 rounded text-[11px] outline-none font-mono"
                                  />
                                </div>
                                <div className="space-y-0.5">
                                  <label className="text-[8px] font-bold text-gray-500 uppercase">Sub Partner</label>
                                  <input
                                    type="number"
                                    step="any"
                                    placeholder={formSubPartnerPrice || '0'}
                                    value={stVal.subUnitPartnerPrice}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setStorePricingInput(prev => ({
                                        ...prev,
                                        [st.id]: { ...(prev[st.id] || { purchasePrice: '', retailPrice: '', wholesalePrice: '', partnerPrice: '', subUnitRetailPrice: '', subUnitWholesalePrice: '', subUnitPartnerPrice: '' }), subUnitPartnerPrice: val }
                                      }));
                                    }}
                                    className="w-full px-1.5 py-0.5 border border-gray-300 rounded text-[11px] outline-none font-mono"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Default Expiry Date (Optional)</label>
                <input
                  type="date"
                  name="expiryDate"
                  defaultValue={editingStockItem?.expiryDate || ''}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 outline-none font-sans"
                />
              </div>

              {(currentUser?.role === 'Admin' || currentUser?.role === 'Super Admin') && visibleStores.length > 0 && (
                <div className="space-y-2 border border-gray-200 rounded-xl p-3 bg-slate-50/50 mt-3">
                  <div className="text-[11px] font-bold text-gray-700 tracking-wide uppercase flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-brand" />
                    {t('Store-Specific Expiry Dates') || 'Store-Specific Expiry Dates'}
                  </div>
                  <p className="text-[10px] text-gray-500 font-medium">
                    {t('Differentiate expiration dates for individual store entries if required:') || 'Differentiate expiration dates for individual store entries if required:'}
                  </p>
                  <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1 scrollbar-thin divide-y divide-gray-100">
                    {visibleStores.map(s => (
                      <div key={s.id} className="flex items-center justify-between gap-3 text-xs pt-2 first:pt-0">
                        <span className="font-bold text-gray-700 truncate max-w-[160px]">{s.name}</span>
                        <input
                          type="date"
                          name={`expiryDate_store_${s.id}`}
                          defaultValue={editingStockItem?.expiryDates?.[s.id] || ''}
                          className="px-2 py-1 border rounded-lg text-xs bg-white outline-none font-sans"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowStockModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => { (document.getElementById('stockItemForm') as HTMLFormElement | null)?.requestSubmit(); }}
                  className="px-5 py-2 bg-brand hover:bg-brand-hover text-white rounded-lg text-sm font-semibold"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between bg-gray-50 shrink-0">
              <span className="font-bold text-gray-900 text-sm">Inter-Store Stock Transfer</span>
              <button onClick={() => setShowTransferModal(false)} className="p-1 hover:bg-gray-200 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              id="stockTransferForm"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const pid = parseInt(fd.get('productId') as string);
                const fromStore = parseInt(fd.get('fromStore') as string);
                const toStore = parseInt(fd.get('toStore') as string);
                const qty = parseInt(fd.get('qty') as string);

                if (fromStore === toStore) {
                  toast.error(t('Please select two distinct stores.'));
                  return;
                }

                const item = stockItems.find(p => p.id === pid);
                if (!item) return;

                const transferConversion = item.useSubUnitPricing ? (item.subUnitConversion || 1) : 1;
                const requiredBaseUnits = qty * transferConversion;

                if ((item.stock?.[fromStore] || 0) < requiredBaseUnits) {
                  toast.error(t('Insufficient stock weights in the source store.'));
                  return;
                }

                const maxId = stockTransfers.length > 0 ? Math.max(...stockTransfers.map(t => t.id)) : 0;
                const newTransfer: StockTransfer = {
                  id: maxId + 1,
                  transferNumber: `TR-${new Date().getFullYear()}-${5000 + maxId + 1}`,
                  productId: pid,
                  fromStoreId: fromStore,
                  toStoreId: toStore,
                  qty: qty,
                  status: 'Pending',
                  createdAt: new Date().toISOString().split('T')[0]
                };

                saveAllData({ stockTransfers: [...stockTransfers, newTransfer] });
                logAction('Stock Transfer Request', `Requested transfer of ${qty}x ${item.name} from ${stores.find(s => s.id === fromStore)?.name} to ${stores.find(s => s.id === toStore)?.name}.`);
                setShowTransferModal(false);
                toast.success(t('Stock transfer request registered as PENDING. Please dispatch it below.'));
              }}
              className="p-5 space-y-4 overflow-y-auto"
            >
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Select Product</label>
                <select
                  name="productId"
                  defaultValue={transferProductId || ''}
                  required
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white font-medium"
                >
                  <option value="">Choose item...</option>
                  {stockItems.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">From Store</label>
                  <select name="fromStore" required className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                    {stores.filter(s => currentBranchId ? s.branchId === currentBranchId : true).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">To Store</label>
                  <select name="toStore" required className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                    {stores.filter(s => currentBranchId ? s.branchId === currentBranchId : true).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Quantity</label>
                <input
                  type="number"
                  min="1"
                  required
                  defaultValue="1"
                  name="qty"
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 outline-none font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => { (document.getElementById('stockTransferForm') as HTMLFormElement | null)?.requestSubmit(); }}
                  className="px-5 py-2 bg-brand hover:bg-brand-hover text-white rounded-lg text-sm font-semibold"
                >
                  Complete Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmActionModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        description={confirmModal.description}
      />

      {/* Live Camera Capture Modal */}
      {showCameraCaptureModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b flex items-center justify-between bg-gray-900 text-white">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-emerald-400" />
                <span className="font-bold text-sm">{t('Capture Product Photo')}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (cameraStream) {
                    cameraStream.getTracks().forEach(track => track.stop());
                    setCameraStream(null);
                  }
                  setShowCameraCaptureModal(false);
                }}
                className="p-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 flex flex-col items-center bg-gray-950 space-y-4">
              <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-gray-800 flex items-center justify-center">
                <video
                  ref={cameraVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 pointer-events-none border-2 border-emerald-500/30 rounded-xl flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-dashed border-emerald-400/70 rounded-lg"></div>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full justify-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (cameraStream) {
                      cameraStream.getTracks().forEach(track => track.stop());
                      setCameraStream(null);
                    }
                    setShowCameraCaptureModal(false);
                  }}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-bold transition"
                >
                  {t('Cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (cameraVideoRef.current) {
                      const video = cameraVideoRef.current;
                      const canvas = document.createElement('canvas');
                      canvas.width = video.videoWidth || 1280;
                      canvas.height = video.videoHeight || 720;
                      const ctx = canvas.getContext('2d');
                      if (ctx) {
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                        const input = document.getElementById('modal-image-url-input') as HTMLInputElement;
                        if (input) {
                          input.value = dataUrl;
                        }
                        toast.success(t('Product photo captured!'));
                        if (cameraStream) {
                          cameraStream.getTracks().forEach(track => track.stop());
                          setCameraStream(null);
                        }
                        setShowCameraCaptureModal(false);
                      }
                    }
                  }}
                  className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition transform active:scale-95"
                >
                  <Camera className="w-4 h-4" />
                  {t('Snap Photo')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FIFO Batch Inspector Modal */}
      {fifoBatchProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between bg-gradient-to-r from-purple-900 to-indigo-900 text-white shrink-0">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-300" />
                <div>
                  <h3 className="font-bold text-sm">{t('FIFO Inventory Batch Inspector')}</h3>
                  <span className="text-[11px] text-purple-200 block">{fifoBatchProduct.name} ({fifoBatchProduct.code})</span>
                </div>
              </div>
              <button onClick={() => setFifoBatchProduct(null)} className="p-1 hover:bg-white/10 rounded-lg text-white transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {/* Valuation Summary Card */}
              {(() => {
                const targetStoreId = currentStoreId || 1;
                const valuation = getFIFOInventoryValuation(fifoBatchProduct, targetStoreId);
                const storeBatches = fifoBatchProduct.batches?.[targetStoreId] || [];

                return (
                  <>
                    <div className="grid grid-cols-3 gap-3 bg-purple-50/60 border border-purple-100 rounded-xl p-3.5">
                      <div>
                        <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">{t('Total Batch Stock')}</span>
                        <span className="text-base font-extrabold text-purple-950">
                          {valuation.totalQty} {fifoBatchProduct.unit || 'units'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">{t('Avg Unit Cost')}</span>
                        <span className="text-base font-extrabold text-purple-950">
                          {formatMoney(valuation.averageUnitCost, activeCurrency, activeExchangeRate)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">{t('Total FIFO Valuation')}</span>
                        <span className="text-base font-extrabold text-indigo-700">
                          {formatMoney(valuation.totalValue, activeCurrency, activeExchangeRate)}
                        </span>
                      </div>
                    </div>

                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                          <Package className="w-4 h-4 text-purple-600" />
                          {t('Active FIFO Queued Batches')} ({storeBatches.filter(b => b.qty > 0).length})
                        </span>
                        <div className="flex items-center gap-2">
                          {storeBatches.some(b => b.qty <= 0) && (
                            <button
                              onClick={() => {
                                const result = cleanupEmptyBatches(fifoBatchProduct, targetStoreId);
                                if (result.removedCount > 0) {
                                  const updatedStockItems = activeStockItems.map(p => p.id === result.updatedProduct.id ? result.updatedProduct : p);
                                  saveAllData({ stockItems: updatedStockItems });
                                  setFifoBatchProduct(result.updatedProduct);
                                  toast.success(t(`Cleaned up ${result.removedCount} empty batch record(s)!`));
                                } else {
                                  toast.info(t('No empty batch records found to clean up.'));
                                }
                              }}
                              className="bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-300 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                              title={t('Filter out and remove completed batches where remaining quantity is zero')}
                            >
                              <Trash2 className="w-3 h-3 text-purple-700" />
                              {t('Cleanup Empty Batches')}
                            </button>
                          )}
                          <span className="text-[10px] font-semibold text-gray-500">
                            {t('First In, First Out Order')}
                          </span>
                        </div>
                      </div>

                      {storeBatches.length === 0 ? (
                        <div className="p-6 text-center text-gray-400 text-xs">
                          {t('No purchase order batches logged yet. Inventory currently uses standard cost price.')}
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-gray-100/70 text-gray-500 font-bold text-[10px] uppercase">
                              <tr>
                                <th className="px-3 py-2.5">{t('PO / Batch Ref')}</th>
                                <th className="px-3 py-2.5">{t('Supplier')}</th>
                                <th className="px-3 py-2.5">{t('Rec. Date')}</th>
                                <th className="px-3 py-2.5">{t('Expiry Date')}</th>
                                <th className="px-3 py-2.5 text-right">{t('Unit Cost')}</th>
                                <th className="px-3 py-2.5 text-center">{t('Rem. Qty')}</th>
                                <th className="px-3 py-2.5 text-right">{t('Batch Value')}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 font-semibold text-gray-800">
                              {storeBatches.map((b, idx) => {
                                const isFirstIn = idx === 0 && b.qty > 0;
                                return (
                                  <tr key={b.id || idx} className={isFirstIn ? 'bg-purple-50/40' : 'hover:bg-gray-50'}>
                                    <td className="px-3 py-2.5 font-mono text-[11px] text-purple-900 font-bold flex items-center gap-1.5">
                                      {b.poNumber || 'BATCH'}
                                      {isFirstIn && (
                                        <span className="bg-purple-600 text-white text-[9px] px-1.5 py-0.2 rounded font-sans uppercase font-bold">
                                          {t('Next Out')}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2.5 text-gray-600">{b.supplierName || '—'}</td>
                                    <td className="px-3 py-2.5 font-mono text-gray-500">{b.receivedDate}</td>
                                    <td className="px-3 py-2.5">
                                      {(() => {
                                        if (!b.expiryDate) return <span className="text-gray-400 font-mono text-[10px]">{t('N/A')}</span>;
                                        const expDate = new Date(b.expiryDate);
                                        const today = new Date();
                                        const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                        
                                        let expiryClass = "bg-green-50 text-green-700 border-green-200";
                                        let expiryLabel = t('Valid');
                                        if (diffDays < 0) {
                                          expiryClass = "bg-red-50 text-red-700 border-red-200 font-black animate-pulse";
                                          expiryLabel = t('EXPIRED');
                                        } else if (diffDays <= 30) {
                                          expiryClass = "bg-amber-50 text-amber-700 border-amber-200 font-bold";
                                          expiryLabel = `${diffDays}d ${t('left')}`;
                                        }

                                        return (
                                          <div className="flex flex-col">
                                            <span className="font-mono text-[11px] text-gray-800">{b.expiryDate}</span>
                                            <span className={`text-[8px] px-1.5 py-0.2 rounded border w-fit font-bold uppercase mt-0.5 ${expiryClass}`}>
                                              {expiryLabel}
                                            </span>
                                          </div>
                                        );
                                      })()}
                                    </td>
                                    <td className="px-3 py-2.5 text-right text-gray-900 font-mono">
                                      {formatMoney(b.cost, activeCurrency, activeExchangeRate)}
                                    </td>
                                    <td className="px-3 py-2.5 text-center font-extrabold text-emerald-700">
                                      {b.qty} / {b.initialQty}
                                    </td>
                                    <td className="px-3 py-2.5 text-right font-bold text-indigo-700">
                                      {formatMoney(b.qty * b.cost, activeCurrency, activeExchangeRate)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="px-5 py-3 border-t bg-gray-50 flex justify-end shrink-0">
              <button
                onClick={() => setFifoBatchProduct(null)}
                className="bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs px-4 py-2 rounded-xl transition"
              >
                {t('Close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mind Refresh Arcade Break Game Modal */}
      <ArcadeGameModal
        isOpen={showGameModal}
        onClose={() => setShowGameModal(false)}
        userName={currentUser?.name || currentUser?.username}
      />

      {/* Debug Sync Button — Chrome vs Edge desync helper */}
      <button
        onClick={() => (window as any).debugSync?.()}
        className="fixed bottom-2 left-2 z-[9998] px-2 py-1 bg-amber-500 text-white text-[10px] font-bold rounded shadow hover:bg-amber-600"
        title="Debug Sync — shows company, last_ts, product count"
      >
        Debug Sync
      </button>

      {/* Toast Notifications Container */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map(t => {
          let bgColor = 'bg-white border-gray-200 text-gray-900';
          let Icon = Info;
          let iconColor = 'text-blue-500';

          if (t.type === 'success') {
            bgColor = 'bg-emerald-50 border-emerald-100 text-emerald-950';
            Icon = CheckCircle;
            iconColor = 'text-emerald-500';
          } else if (t.type === 'error') {
            bgColor = 'bg-rose-50 border-rose-100 text-rose-950';
            Icon = XCircle;
            iconColor = 'text-rose-500';
          } else if (t.type === 'warning') {
            bgColor = 'bg-amber-50 border-amber-100 text-amber-950';
            Icon = AlertTriangle;
            iconColor = 'text-amber-500';
          }

          return (
            <div
              key={t.id}
              className={`pointer-events-auto p-4 rounded-xl border shadow-lg flex items-start gap-3 transition-all duration-300 transform translate-y-0 opacity-100 ${bgColor}`}
            >
              <Icon className={`w-5 h-5 shrink-0 ${iconColor} mt-0.5`} />
              <div className="flex-1 text-xs font-semibold leading-normal">{t.message}</div>
              <button
                onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                className="text-gray-400 hover:text-gray-600 transition shrink-0 p-0.5 rounded-lg hover:bg-black/5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
