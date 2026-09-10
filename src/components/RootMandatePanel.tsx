import React, { useEffect, useMemo, useState } from 'react';
import {
  Crown, LayoutDashboard, Building2, Package, Users, MessageSquare, FolderTree, MapPin,
  Search, Eye, ShieldCheck, ShieldBan, Trash2, ExternalLink, UserCog, CheckCircle2,
  Settings as SettingsIcon, Globe, FileText, Loader, Save, Plus, Database, HardDrive,
  Server, ArrowLeft, Boxes, ClipboardCheck, Lock, Cpu, TrendingUp, Layers,
  Heart, Lightbulb, Scale, ShoppingCart, BarChart3, Clock3, ShieldAlert, Activity, RefreshCw,
  Coins, BadgePercent, CreditCard, Wallet, CalendarClock, Star, Navigation, LocateFixed,
  ThumbsUp, ThumbsDown, MessageCircle, Share2, Landmark, Webhook as WebhookIcon, Zap, Inbox,
  Smartphone, AlertTriangle, ClipboardList, HandCoins, Users as UsersIcon, Bike, Video, Gift, MessageCircle as ChatIcon, Radio, XCircle,
  QrCode, Mic, Info
} from 'lucide-react';
import {
  Company, MarketplaceProduct, MarketplaceOrder, MarketplaceClick, User, Settings,
  AuditTrail, SecurityLog, Branch, Store, Tax, Supplier, Customer, HomepageContent,
  Currency, TradeSubscriptionPlan, CompanySubscription, Review, ProductView, ReviewStatus,
  SellerWallet, WalletTransaction, Withdrawal, Affiliate, AffiliateClick, AffiliateSale, AffiliateWithdrawal, SearchSynonym, PushSubscriptionRec,
  VoiceSearchLog, QrScanLog,
  CollectionRecord, CollectionSetting, WebhookLog, AdminEarning, CollectionNetwork, CollectionStatus, CollectionMode,
  Offer, OfferMessage, GroupDeal, GroupDealParticipant, InstallmentPlan, InstallmentOrder, InstallmentPayment,
  Delivery, DeliveryUpdate, LiveStream, LiveComment, LoyaltyCustomer, LoyaltyTransaction, WhatsappConversation, NotificationLog
} from '../types';
import { defaultHomepageContent } from '../initialData';
import { getPhpConfig } from '../utils/api';
import { sameId } from '../utils/idUtils';
import { Stars, VerifiedBadge, TZS } from './marketplace/MarketplaceShared';
import AnalyticsLineChart from './marketplace/AnalyticsLineChart';
import LeafletMap from './marketplace/LeafletMap';

interface RootMandatePanelProps {
  currentUser: User;
  users: User[];
  companies: Company[];
  branches: Branch[];
  stores: Store[];
  products: MarketplaceProduct[];
  orders: MarketplaceOrder[];
  clicks: MarketplaceClick[];
  reviews: Review[];
  productViews: ProductView[];
  categories: string[];
  taxes: Tax[];
  suppliers: Supplier[];
  customers: Customer[];
  auditTrails: AuditTrail[];
  securityLogs: SecurityLog[];
  rolePermissions: Record<string, string[]>;
  settings: Settings;
  translate: (text: string) => string;
  onSaveSettings: (next: Settings) => void;
  onVerifyCompany: (id: number) => void;
  onBanCompany: (id: number) => void;
  onDeleteCompany: (id: number) => void;
  onApproveProduct: (id: number) => void;
  onUpdateProducts: (next: MarketplaceProduct[]) => void;
  onDeleteProduct: (id: number) => void;
  onUpdateUsers: (next: User[]) => void;
  onUpdateCategories: (next: string[]) => void;
  onUpdateCompanies: (next: Company[]) => void;
  onUpdateOrders: (next: MarketplaceOrder[]) => void;
  onUpdateReviewStatus: (reviewId: number, status: ReviewStatus) => void;
  currencies: Currency[];
  subscriptionPlans: TradeSubscriptionPlan[];
  companySubscriptions: CompanySubscription[];
  onApproveCompanySubscription: (companyId: number) => void;
  onRejectCompanySubscription: (companyId: number, note?: string) => void;
  onExtendCompanySubscription: (companyId: number, days?: number) => void;
  onChangeCompanyPlan: (companyId: number, planId: number) => void;
  // --- MEGA Phase 1 ---
  wallets: SellerWallet[];
  walletTransactions: WalletTransaction[];
  withdrawals: Withdrawal[];
  affiliates: Affiliate[];
  affiliateClicks: AffiliateClick[];
  affiliateSales: AffiliateSale[];
  affiliateWithdrawals: AffiliateWithdrawal[];
  searchSynonyms: SearchSynonym[];
  pushSubscriptions: PushSubscriptionRec[];
  commissionPercent: number;
  onDecideSellerWithdrawal: (withdrawalId: number, decision: 'approved' | 'rejected', note?: string) => void;
  onDecideAffiliateWithdrawal: (withdrawalId: number, decision: 'approved' | 'rejected') => void;
  onUpdateAffiliate: (next: Affiliate[]) => void;
  onUpdateSearchSynonyms: (next: SearchSynonym[]) => void;
  // --- MEGA ULTIMATE: wakala approval, QR + voice analytics ---
  voiceSearches: VoiceSearchLog[];
  qrScans: QrScanLog[];
  onApproveAffiliate: (affiliateId: number, active: boolean) => void;
  // --- MEGA Phase 2B: collections, webhook logs, admin earnings ---
  collections: CollectionRecord[];
  webhookLogs: WebhookLog[];
  adminEarnings: AdminEarning[];
  onDecideCollection: (collectionId: number, decision: 'approved' | 'rejected', note?: string) => void;
  onUpdateCollectionSettings: (next: CollectionSetting[]) => void;
  onUpdateCollectionMode: (mode: 'manual' | 'auto') => void;
  onClearWebhookLogs: () => void;
  onTestCollection: () => void;
  // --- MEGA Phase 2C: 7 killer features ---
  offers: Offer[];
  offerMessages: OfferMessage[];
  groupDeals: GroupDeal[];
  groupDealParticipants: GroupDealParticipant[];
  installmentPlans: InstallmentPlan[];
  installmentOrders: InstallmentOrder[];
  installmentPayments: InstallmentPayment[];
  deliveries: Delivery[];
  deliveryUpdates: DeliveryUpdate[];
  liveStreams: LiveStream[];
  liveComments: LiveComment[];
  loyaltyCustomers: LoyaltyCustomer[];
  loyaltyTransactions: LoyaltyTransaction[];
  whatsappConversations: WhatsappConversation[];
  notificationLogs: NotificationLog[];
  onDecideOffer: (offerId: number, decision: 'accept' | 'reject') => void;
  onAssignDeliveryRider: (deliveryId: number, riderName: string, riderPhone: string) => void;
  onUpdateDeliveryStatus: (deliveryId: number, status: string, note?: string) => void;
  onToggleLiveStream: (streamId: number, live: boolean) => void;
  onImpersonateCompany: (id: number) => void;
  onReturnToRoot: () => void;
  onViewStore: (company: Company) => void;
  logAction: (action: string, details: string) => void;
}

type RootTab = 'overview' | 'companies' | 'products' | 'users' | 'leads' | 'categories' | 'regions' | 'seo' | 'homepage' | 'settings' | 'logs' | 'currencies' | 'subscription-plans' | 'subscriptions' | 'orders' | 'reviews' | 'map' | 'analytics' | 'withdrawals' | 'affiliates' | 'search-synonyms' | 'collections' | 'collection-settings' | 'webhook-logs' | 'phase2c' | 'qr-analytics' | 'voice-search';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  'shopping-cart': ShoppingCart,
  'package': Package,
  'file-text': FileText,
  'bar-chart-3': BarChart3,
  'boxes': Boxes,
  'clipboard-check': ClipboardCheck,
  'lock': Lock,
  'cpu': Cpu,
  'users': Users,
  'trending-up': TrendingUp,
  'shield-check': ShieldCheck,
  'layers': Layers,
  'heart': Heart,
  'lightbulb': Lightbulb,
  'scale': Scale
};

const ICON_OPTIONS = Object.keys(ICON_MAP);

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800'
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected'
};

function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function companyName(companies: Company[], id: number): string {
  return companies.find(c => sameId(c.id, id))?.name || `Company #${id}`;
}

function companyVerificationState(c: Company): { label: string; cls: string } {
  if (c.isMarketplaceActive === false || c.status === 'Rejected') return { label: 'Banned', cls: 'bg-red-100 text-red-800' };
  if (c.subscriptionApproved === true || c.isVerified === true) return { label: 'Verified', cls: 'bg-green-100 text-green-800' };
  return { label: 'Pending', cls: 'bg-amber-100 text-amber-800' };
}

export default function RootMandatePanel(props: RootMandatePanelProps) {
  const {
    currentUser, users, companies, branches, stores, products, orders, clicks, categories,
    reviews, productViews,
    auditTrails, securityLogs, rolePermissions, settings, translate: t,
    onSaveSettings, onVerifyCompany, onBanCompany, onDeleteCompany, onApproveProduct,
    onUpdateProducts, onDeleteProduct, onUpdateUsers, onUpdateCategories, onUpdateCompanies,
    onUpdateOrders, onUpdateReviewStatus, currencies, subscriptionPlans, companySubscriptions,
    onApproveCompanySubscription, onRejectCompanySubscription, onExtendCompanySubscription,
    onChangeCompanyPlan,
    onImpersonateCompany, onReturnToRoot, onViewStore, logAction,
    wallets, walletTransactions, withdrawals, affiliates, affiliateClicks, affiliateSales, affiliateWithdrawals,
    searchSynonyms, pushSubscriptions, commissionPercent,
    onDecideSellerWithdrawal, onDecideAffiliateWithdrawal, onUpdateAffiliate, onUpdateSearchSynonyms,
    collections, webhookLogs, adminEarnings,
    onDecideCollection, onUpdateCollectionSettings, onUpdateCollectionMode, onClearWebhookLogs, onTestCollection,
    offers, offerMessages, groupDeals, groupDealParticipants, installmentPlans, installmentOrders, installmentPayments,
    deliveries, deliveryUpdates, liveStreams, liveComments, loyaltyCustomers, loyaltyTransactions, whatsappConversations, notificationLogs,
    onDecideOffer, onAssignDeliveryRider, onUpdateDeliveryStatus, onToggleLiveStream,
    voiceSearches, qrScans, onApproveAffiliate
  } = props;

  const content = settings.homepageContent || defaultHomepageContent;

  const [tab, setTab] = useState<RootTab>('overview');
  const [search, setSearch] = useState('');
  const [compFilter, setCompFilter] = useState<'all' | 'pending' | 'verified' | 'banned'>('all');
  const [prodFilter, setProdFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [userFilter, setUserFilter] = useState<'all' | 'Super Admin' | 'Admin' | 'Retailer' | 'Wholesaler' | 'Store Admin' | 'Branch Administrator'>('all');
  const [stats, setStats] = useState<{ db: string; files: string; products: number; users: number } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ type: string; id: number; label: string } | null>(null);
  const [appVersion, setAppVersion] = useState<{ version: string; name: string; date: string; description: string } | null>(null);

  // Hoisted form states (Rules of Hooks — never declare hooks inside render functions)
  const [newCat, setNewCat] = useState('');
  const [newRegion, setNewRegion] = useState('');
  const [seoTitle, setSeoTitle] = useState(settings.homepageMeta?.title || '');
  const [seoDesc, setSeoDesc] = useState(settings.homepageMeta?.description || '');
  const [saved, setSaved] = useState(false);
  const [heroTitle, setHeroTitle] = useState(content.heroTitle);
  const [heroSubtitle, setHeroSubtitle] = useState(content.heroSubtitle);
  const [logFilter, setLogFilter] = useState('all');
  // Feature 3/5 tab filters (Rules of Hooks — declared at top level)
  const [reviewFilter, setReviewFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [reviewCompanyFilter, setReviewCompanyFilter] = useState(0);
  const [mapCompanyFilter, setMapCompanyFilter] = useState(0);
  const [analyticsCompanyId, setAnalyticsCompanyId] = useState(0);
  const [analyticsRange, setAnalyticsRange] = useState<7 | 14 | 30>(14);

  // New billing-model form states (Rules of Hooks — declared at top level)
  const [newCurr, setNewCurr] = useState({ code: '', symbol: '', name: '', exchangeRate: '', isActive: true });
  const [newPlanForm, setNewPlanForm] = useState({
    name: '', slug: '', type: 'commission' as 'direct' | 'commission', basePriceTZS: '', commissionPercent: '', maxProducts: '', durationDays: '', features: '', isActive: true
  });
  const [rejectNote, setRejectNote] = useState<{ companyId: number; companyName: string; reason?: string } | null>(null);

  // MEGA Phase 1 form states (Rules of Hooks — top level)
  const [affCommission, setAffCommission] = useState(String(commissionPercent ?? 2));
  const [synSearch, setSynSearch] = useState('');
  const [newSynKeyword, setNewSynKeyword] = useState('');
  const [newSynValue, setNewSynValue] = useState('');
  const [selectedAffiliate, setSelectedAffiliate] = useState<Affiliate | null>(null);
  const [wdrNote, setWdrNote] = useState<{ id: number; note: string }>({ id: 0, note: '' });

  // MEGA Phase 2B form states (Rules of Hooks — top level)
  const [colSearch, setColSearch] = useState('');
  const [colNetFilter, setColNetFilter] = useState('all');
  const [colStatusFilter, setColStatusFilter] = useState('all');
  const [colDecideNote, setColDecideNote] = useState<{ id: number; note: string }>({ id: 0, note: '' });
  const [editingSettingId, setEditingSettingId] = useState<number | null>(null);
  const [settingForm, setSettingForm] = useState<{ displayName: string; payNumber: string; accountName: string; logo: string; instructions: string }>({ displayName: '', payNumber: '', accountName: '', logo: '', instructions: '' });
  const [colMode, setColMode] = useState<CollectionMode>(settings.collectionMode || 'manual');
  const [azampayForm, setAzampayForm] = useState({
    azampayAppName: settings.azampayAppName || '',
    azampayClientId: settings.azampayClientId || '',
    azampayClientSecret: settings.azampayClientSecret || '',
    azampayWebhookSecret: settings.azampayWebhookSecret || ''
  });

  const combinedLogs = useMemo(() => {
    const audits = auditTrails.map(l => ({ id: 'A-' + l.id, time: l.timestamp, user: l.username, action: l.action, details: l.details, kind: 'audit' as const }));
    const sec = securityLogs.map(l => ({ id: 'S-' + l.id, time: l.timestamp, user: l.username, action: l.status, details: l.failureReason || l.browserFingerprint || '', kind: 'security' as const }));
    return [...audits, ...sec].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [auditTrails, securityLogs]);

  const pendingCompanies = useMemo(() => companies.filter(c => companyVerificationState(c).label === 'Pending'), [companies]);
  const pendingProducts = useMemo(() => products.filter(p => p.status !== 'approved'), [products]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingStats(true);
      try {
        const { apiUrl } = getPhpConfig();
        const res = await fetch(`${apiUrl}?action=system_stats`, { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (mounted && json && json.success) {
            setStats({
              db: json.db_size || '—',
              files: json.data_dir_size || '—',
              products: json.product_count || products.length,
              users: json.user_count || users.length
            });
          }
        }
      } catch (e) {
        // PHP backend may be offline — the Overview tab falls back to local counts
      }
      if (mounted) setLoadingStats(false);
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch version info on mount
  useEffect(() => {
    fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d?.version) setAppVersion(d); })
      .catch(() => {});
  }, []);

  // Fetch version info on mount
  useEffect(() => {
    fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d?.version) setAppVersion(d); })
      .catch(() => {});
  }, []);

  const updateSettings = (patch: Partial<Settings>) => onSaveSettings({ ...settings, ...patch });

  const updateHomepage = (patch: Partial<HomepageContent>) => updateSettings({ homepageContent: { ...content, ...patch } });

  const tabBtn = (key: RootTab, label: string, icon: React.ReactNode) => (
    <button
      onClick={() => setTab(key)}
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition ${
        tab === key ? 'bg-brand text-white shadow' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
      }`}
    >
      {icon}
      {label}
      {key === 'overview' && pendingCompanies.length > 0 && (
        <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5">{pendingCompanies.length}</span>
      )}
      {key === 'products' && pendingProducts.length > 0 && (
        <span className="bg-amber-500 text-white text-[10px] rounded-full px-1.5">{pendingProducts.length}</span>
      )}
      {key === 'collections' && pendingCollections.length > 0 && (
        <span className="bg-amber-500 text-white text-[10px] rounded-full px-1.5">{pendingCollections.length}</span>
      )}
    </button>
  );

  const confirm = (type: string, id: number, label: string) => setConfirmTarget({ type, id, label });
  const runConfirm = () => {
    if (!confirmTarget) return;
    const { type, id } = confirmTarget;
    if (type === 'company') onDeleteCompany(id);
    if (type === 'product') onDeleteProduct(id);
    if (type === 'user') onUpdateUsers(users.filter(u => u.id !== id));
    setConfirmTarget(null);
  };

  const statCard = (icon: React.ReactNode, value: number | string, label: string, accent: string) => (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accent}`}>{icon}</div>
      <div>
        <div className="text-xl font-extrabold text-gray-900 leading-none">{value}</div>
        <div className="text-[11px] font-semibold text-gray-500 mt-1">{label}</div>
      </div>
    </div>
  );

  const sectionCard = (title: string, subtitle?: string, children?: React.ReactNode) => (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div>
          <div className="font-bold text-gray-900 text-sm">{title}</div>
          {subtitle && <div className="text-[11px] text-gray-500 font-medium">{subtitle}</div>}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );

  // ============ RENDER TAB CONTENT ============
  const renderOverview = () => {
    const totalClicks = clicks.length;
    const whatsappClicks = clicks.filter(c => c.type === 'whatsapp').length;
    const activeUsers = users.filter(u => u.status !== 'Blocked').length;
    const verifiedComps = companies.filter(c => companyVerificationState(c).label === 'Verified').length;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statCard(<Building2 className="w-5 h-5 text-white" />, companies.length, t('Companies'), 'bg-indigo-500')}
          {statCard(<Package className="w-5 h-5 text-white" />, products.length, t('Products'), 'bg-blue-500')}
          {statCard(<Users className="w-5 h-5 text-white" />, users.length, `${t('Users')} (${activeUsers} active)`, 'bg-emerald-500')}
          {statCard(<MessageSquare className="w-5 h-5 text-white" />, whatsappClicks, `${t('WhatsApp Leads')} (${totalClicks} clicks)`, 'bg-green-500')}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statCard(<CheckCircle2 className="w-5 h-5 text-white" />, verifiedComps, t('Verified Companies'), 'bg-green-600')}
          {statCard(<Clock3 className="w-5 h-5 text-white" />, pendingCompanies.length, t('Pending Companies'), 'bg-amber-500')}
          {statCard(<Clock3 className="w-5 h-5 text-white" />, pendingProducts.length, t('Pending Products'), 'bg-orange-500')}
          {statCard(<ShoppingCart className="w-5 h-5 text-white" />, orders.length, t('Marketplace Orders'), 'bg-purple-500')}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-bold text-gray-900 text-sm flex items-center gap-2"><Server className="w-4 h-4 text-brand" />{t('Resource Usage')}</div>
              <button onClick={() => setTab('seo')} className="text-[11px] font-bold text-brand hover:underline">{t('SEO & Sitemap')}</button>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-lg font-extrabold text-gray-900">{loadingStats ? <Loader className="w-4 h-4 mx-auto animate-spin text-gray-400" /> : (stats?.db || '—')}</div>
                <div className="text-[10px] font-semibold text-gray-500 mt-1">{t('Database Size')}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-lg font-extrabold text-gray-900">{loadingStats ? <Loader className="w-4 h-4 mx-auto animate-spin text-gray-400" /> : (stats?.files || '—')}</div>
                <div className="text-[10px] font-semibold text-gray-500 mt-1">{t('Data Files')}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-lg font-extrabold text-gray-900">{stats?.users ?? users.length}</div>
                <div className="text-[10px] font-semibold text-gray-500 mt-1">{t('DB Rows')}</div>
              </div>
            </div>
            <div className="mt-3 text-[11px] text-gray-500 font-medium">
              PHP/MySQL backend at <span className="font-mono text-gray-700">{getPhpConfig().apiUrl}</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="font-bold text-gray-900 text-sm mb-3">{t('Quick Actions')}</div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setTab('companies')} className="flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold">{t('Verify Companies')}</button>
              <button onClick={() => setTab('products')} className="flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-xs font-bold">{t('Approve Products')}</button>
              <button onClick={() => setTab('homepage')} className="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold">{t('Edit Homepage')}</button>
              <button onClick={() => setTab('leads')} className="flex items-center justify-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-xs font-bold">{t('WhatsApp Leads')}</button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            {pendingCompanies.length > 0 && (
              <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 font-bold text-amber-900 text-sm flex items-center gap-2">
                  <Clock3 className="w-4 h-4" /> {t('Pending Company Verification')} ({pendingCompanies.length})
                </div>
                <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                  {pendingCompanies.slice(0, 12).map(c => (
                    <div key={c.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-gray-900 text-xs truncate">{c.name}</div>
                        <div className="text-[10px] text-gray-500 font-medium">{c.region || '—'}</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => onVerifyCompany(c.id)} className="px-2 py-1 bg-green-600 text-white rounded text-[10px] font-bold hover:bg-green-700">{t('Verify')}</button>
                        <button onClick={() => confirm('company', c.id, c.name)} className="px-2 py-1 bg-red-50 text-red-600 rounded text-[10px] font-bold hover:bg-red-100">{t('Delete')}</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {pendingCompanies.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center text-xs font-semibold text-green-600 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> {t('All companies verified — no pending requests.')}
              </div>
            )}
          </div>
          <div>
            {pendingProducts.length > 0 ? (
              <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 font-bold text-amber-900 text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2"><Clock3 className="w-4 h-4" /> {t('Pending Product Approval')} ({pendingProducts.length})</span>
                  <button onClick={() => { onUpdateProducts(products.map(p => p.status !== 'approved' ? { ...p, status: 'approved' as const } : p)); logAction('Products Approved', `ROOT_MANDATE approved all ${pendingProducts.length} pending product(s).`); }} className="px-2 py-1 bg-brand text-white rounded text-[10px] font-bold hover:opacity-90">{t('Approve All')}</button>
                </div>
                <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                  {pendingProducts.slice(0, 12).map(p => (
                    <div key={p.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-gray-900 text-xs truncate">{p.name}</div>
                        <div className="text-[10px] text-gray-500 font-medium truncate">{companyName(companies, p.companyId)} · TZS {Number(p.price || 0).toLocaleString()}</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => onApproveProduct(p.id)} className="px-2 py-1 bg-green-600 text-white rounded text-[10px] font-bold hover:bg-green-700">{t('Approve')}</button>
                        <button onClick={() => confirm('product', p.id, p.name)} className="px-2 py-1 bg-red-50 text-red-600 rounded text-[10px] font-bold hover:bg-red-100">{t('Delete')}</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center text-xs font-semibold text-green-600 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> {t('All products approved and public.')}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderCompanies = () => {
    const filtered = companies.filter(c => {
      const state = companyVerificationState(c);
      const q = search.toLowerCase();
      const matchQ = !q || c.name.toLowerCase().includes(q) || (c.region || '').toLowerCase().includes(q) || (c.category || '').toLowerCase().includes(q);
      const matchF =
        compFilter === 'all' ? true :
        compFilter === 'pending' ? state.label === 'Pending' :
        compFilter === 'verified' ? state.label === 'Verified' :
        state.label === 'Banned';
      return matchQ && matchF;
    });
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-2 flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('Search companies by name, region or category...')} className="w-full outline-none text-sm font-medium" />
          </div>
          <div className="flex items-center gap-1.5">
            {(['all', 'pending', 'verified', 'banned'] as const).map(f => (
              <button key={f} onClick={() => setCompFilter(f)} className={`px-3 py-2 rounded-lg text-xs font-bold capitalize ${compFilter === f ? 'bg-brand text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {f === 'all' ? t('All') : f}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2.5">{t('Company')}</th>
                <th className="px-3 py-2.5">{t('Region')}</th>
                <th className="px-3 py-2.5">{t('Status')}</th>
                <th className="px-3 py-2.5">{t('Subscription')}</th>
                <th className="px-3 py-2.5">{t('Products')}</th>
                <th className="px-3 py-2.5 text-right">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(c => {
                const state = companyVerificationState(c);
                const count = products.filter(p => sameId(p.companyId, c.id)).length;
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5">
                      <div className="font-bold text-gray-900 flex items-center gap-2">
                        {c.logoUrl ? <img src={c.logoUrl} alt="" className="w-6 h-6 rounded object-cover" /> : <div className="w-6 h-6 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px]">{(c.name || '-').charAt(0)}</div>}
                        <div className="min-w-0">
                          <div className="truncate max-w-[220px]">{c.name}</div>
                          <div className="text-[10px] text-gray-400 font-medium">{c.category || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600 font-medium">{c.region || '—'}</td>
                    <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${state.cls}`}>{state.label}</span></td>
                    <td className="px-3 py-2.5 text-gray-600 font-medium">{c.isDemo ? `Demo (${c.demoExpiresAt || '—'})` : (c.subscriptionEnd || '—')}</td>
                    <td className="px-3 py-2.5 text-gray-600 font-medium">{count}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        <button title={t('View Storefront')} onClick={() => onViewStore(c)} className="p-1.5 rounded-md text-gray-500 hover:bg-blue-50 hover:text-blue-600"><ExternalLink className="w-4 h-4" /></button>
                        <button title={t('View as Company')} onClick={() => onImpersonateCompany(c.id)} className="p-1.5 rounded-md text-gray-500 hover:bg-indigo-50 hover:text-indigo-600"><Eye className="w-4 h-4" /></button>
                        {state.label !== 'Verified' && (
                          <button title={t('Verify & Activate')} onClick={() => onVerifyCompany(c.id)} className="p-1.5 rounded-md text-gray-500 hover:bg-green-50 hover:text-green-600"><ShieldCheck className="w-4 h-4" /></button>
                        )}
                        {state.label !== 'Banned' && (
                          <button title={t('Ban Company')} onClick={() => onBanCompany(c.id)} className="p-1.5 rounded-md text-gray-500 hover:bg-red-50 hover:text-red-600"><ShieldBan className="w-4 h-4" /></button>
                        )}
                        <button title={t('Delete Company')} onClick={() => confirm('company', c.id, c.name)} className="p-1.5 rounded-md text-gray-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400 font-semibold">{t('No companies match your filters.')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderProducts = () => {
    const filtered = products.filter(p => {
      const q = search.toLowerCase();
      const matchQ = !q || p.name.toLowerCase().includes(q) || companyName(companies, p.companyId).toLowerCase().includes(q);
      const matchF = prodFilter === 'all' ? true : (p.status || 'pending') === prodFilter;
      return matchQ && matchF;
    });
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-2 flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('Search products or companies...')} className="w-full outline-none text-sm font-medium" />
          </div>
          <div className="flex items-center gap-1.5">
            {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
              <button key={f} onClick={() => setProdFilter(f)} className={`px-3 py-2 rounded-lg text-xs font-bold capitalize ${prodFilter === f ? 'bg-brand text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{f === 'all' ? t('All') : f}</button>
            ))}
          </div>
          {pendingProducts.length > 0 && (
            <button onClick={() => { onUpdateProducts(products.map(p => p.status !== 'approved' ? { ...p, status: 'approved' as const } : p)); logAction('Products Approved', `ROOT_MANDATE approved all ${pendingProducts.length} pending product(s).`); }} className="px-3 py-2 rounded-lg text-xs font-bold bg-green-600 text-white hover:bg-green-700 inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> {t('Approve All Pending')} ({pendingProducts.length})</button>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2.5">{t('Product')}</th>
                <th className="px-3 py-2.5">{t('Company')}</th>
                <th className="px-3 py-2.5">{t('Price (TZS)')}</th>
                <th className="px-3 py-2.5">{t('Stock')}</th>
                <th className="px-3 py-2.5">{t('Status')}</th>
                <th className="px-3 py-2.5 text-right">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5">
                    <div className="font-bold text-gray-900 flex items-center gap-2">
                      {p.image ? <img src={p.image} alt="" className="w-7 h-7 rounded object-cover" /> : <div className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center"><Package className="w-4 h-4 text-gray-400" /></div>}
                      <div className="min-w-0"><div className="truncate max-w-[220px]">{p.name}</div></div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 font-medium">{companyName(companies, p.companyId)}</td>
                  <td className="px-3 py-2.5 text-gray-900 font-bold">{Number(p.price || 0).toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-gray-600 font-medium">{p.stockQuantity ?? '—'}</td>
                  <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_BADGE[p.status || 'pending']}`}>{STATUS_LABEL[p.status || 'pending']}</span></td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {(p.status || 'pending') !== 'approved' && (
                        <button title={t('Approve Product')} onClick={() => onApproveProduct(p.id)} className="p-1.5 rounded-md text-gray-500 hover:bg-green-50 hover:text-green-600"><CheckCircle2 className="w-4 h-4" /></button>
                      )}
                      <button title={t('Delete Product')} onClick={() => confirm('product', p.id, p.name)} className="p-1.5 rounded-md text-gray-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400 font-semibold">{t('No products match your filters.')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderUsers = () => {
    const filtered = users.filter(u => {
      const q = search.toLowerCase();
      const matchQ = !q || u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      const matchF = userFilter === 'all' ? true : u.role === userFilter;
      return matchQ && matchF;
    });
    const protectedUser = (u: User) => u.username === 'root_mandate' || u.username === 'superadmin';
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-2 flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('Search users by name, username or email...')} className="w-full outline-none text-sm font-medium" />
          </div>
          <select value={userFilter} onChange={e => setUserFilter(e.target.value as any)} className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-xs font-bold outline-none">
            <option value="all">{t('All Roles')}</option>
            <option>{t('Super Admin')}</option>
            <option>{t('Admin')}</option>
            <option>{t('Branch Administrator')}</option>
            <option>{t('Store Admin')}</option>
            <option>{t('Retailer')}</option>
            <option>{t('Wholesaler')}</option>
          </select>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2.5">{t('User')}</th>
                <th className="px-3 py-2.5">{t('Role')}</th>
                <th className="px-3 py-2.5">{t('Company')}</th>
                <th className="px-3 py-2.5">{t('Status')}</th>
                <th className="px-3 py-2.5 text-right">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(u => {
                const isProtected = protectedUser(u);
                return (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5">
                      <div className="font-bold text-gray-900 flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${u.isRoot ? 'bg-amber-500' : 'bg-indigo-500'}`}>{u.isRoot ? <Crown className="w-3.5 h-3.5" /> : (u?.name || '-').charAt(0)}</div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5"><span className="truncate max-w-[160px]">{u.name}</span>{u.isRoot && <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.5 rounded-full font-bold">ROOT</span>}</div>
                          <div className="text-[10px] text-gray-400 font-medium">{u.username} · {u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5"><span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[10px] font-bold">{u.role}</span></td>
                    <td className="px-3 py-2.5 text-gray-600 font-medium">{u.companyId ? companyName(companies, u.companyId) : '—'}</td>
                    <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${u.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{u.status}</span></td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {u.companyId && !isProtected && (
                          <button title={t('View as this user')} onClick={() => onImpersonateCompany(u.companyId!)} className="p-1.5 rounded-md text-gray-500 hover:bg-indigo-50 hover:text-indigo-600"><Eye className="w-4 h-4" /></button>
                        )}
                        {!isProtected && (
                          <button title={u.status === 'Active' ? t('Ban User') : t('Unban User')} onClick={() => onUpdateUsers(users.map(x => x.id === u.id ? { ...x, status: x.status === 'Active' ? 'Blocked' as const : 'Active' as const } : x))} className="p-1.5 rounded-md text-gray-500 hover:bg-red-50 hover:text-red-600">{u.status === 'Active' ? <ShieldBan className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}</button>
                        )}
                        {u.role !== 'Admin' && u.role !== 'Super Admin' && !isProtected && (
                          <button title={t('Make Admin')} onClick={() => onUpdateUsers(users.map(x => x.id === u.id ? { ...x, role: 'Admin' as const } : x))} className="p-1.5 rounded-md text-gray-500 hover:bg-emerald-50 hover:text-emerald-600"><UserCog className="w-4 h-4" /></button>
                        )}
                        {!isProtected && (
                          <button title={t('Delete User')} onClick={() => confirm('user', u.id, u.username)} className="p-1.5 rounded-md text-gray-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400 font-semibold">{t('No users match your filters.')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderLeads = () => {
    const rows = clicks.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const total = clicks.length;
    const byProduct = new Map<number, number>();
    clicks.forEach(c => byProduct.set(c.productId, (byProduct.get(c.productId) || 0) + 1));
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statCard(<MessageSquare className="w-5 h-5 text-white" />, total, t('Total WhatsApp Clicks'), 'bg-green-500')}
          {statCard(<Users className="w-5 h-5 text-white" />, byProduct.size, t('Products Clicked'), 'bg-blue-500')}
          {statCard(<Building2 className="w-5 h-5 text-white" />, new Set(clicks.map(c => products.find(p => p.id === c.productId)?.companyId).filter(Boolean)).size, t('Companies Receiving Leads'), 'bg-indigo-500')}
          {statCard(<Activity className="w-5 h-5 text-white" />, rows[0] ? new Date(rows[0].createdAt).toLocaleDateString() : '—', t('Latest Lead'), 'bg-purple-500')}
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2.5">{t('Product')}</th>
                <th className="px-3 py-2.5">{t('Company')}</th>
                <th className="px-3 py-2.5">{t('Type')}</th>
                <th className="px-3 py-2.5">{t('Total Clicks')}</th>
                <th className="px-3 py-2.5">{t('Last Clicked')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {Array.from(byProduct.entries()).map(([productId, count]) => {
                const p = products.find(x => x.id === productId);
                const last = rows.find(r => r.productId === productId);
                return (
                  <tr key={productId} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 font-bold text-gray-900">{p?.name || `Product #${productId}`}</td>
                    <td className="px-3 py-2.5 text-gray-600 font-medium">{p ? companyName(companies, p.companyId) : '—'}</td>
                    <td className="px-3 py-2.5"><span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-[10px] font-bold">{t('WhatsApp')}</span></td>
                    <td className="px-3 py-2.5"><span className="px-2 py-0.5 rounded-full bg-gray-900 text-white text-[10px] font-bold">{count}</span></td>
                    <td className="px-3 py-2.5 text-gray-600 font-medium">{last ? formatDate(last.createdAt) : '—'}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-10 text-center text-gray-400 font-semibold">{t('No WhatsApp leads yet. When a customer taps "Order via WhatsApp" on a product, it is recorded here.')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderCategories = () => {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="font-bold text-gray-900 text-sm mb-3">{t('Add Category')}</div>
          <div className="flex gap-2">
            <input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder={t('New category name...')} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
            <button onClick={() => { if (newCat.trim()) { onUpdateCategories([...categories, newCat.trim()]); logAction('Category Created', `ROOT_MANDATE created category "${newCat.trim()}".`); setNewCat(''); } }} className="px-4 py-2 bg-brand text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5"><Plus className="w-4 h-4" /> {t('Add')}</button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {categories.map(cat => (
            <div key={cat} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0"><FolderTree className="w-4 h-4" /></div>
                <span className="font-bold text-gray-900 text-xs truncate">{cat}</span>
              </div>
              <button onClick={() => { onUpdateCategories(categories.filter(c => c !== cat)); logAction('Category Deleted', `ROOT_MANDATE deleted category "${cat}".`); }} className="p-1.5 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderRegions = () => {
    const regions = settings.marketplaceRegions || [];
    const saveRegions = (next: string[]) => updateSettings({ marketplaceRegions: next });
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="font-bold text-gray-900 text-sm mb-1">{t('Marketplace Regions (Mikoa)')}</div>
          <div className="text-[11px] text-gray-500 font-medium mb-3">{t('These regions appear in the public marketplace filters, checkout and region landing pages')} ({regions.length} regions).</div>
          <div className="flex gap-2">
            <input value={newRegion} onChange={e => setNewRegion(e.target.value)} placeholder={t('New region name...')} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
            <button onClick={() => { if (newRegion.trim()) { saveRegions([...regions, newRegion.trim()]); logAction('Region Created', `ROOT_MANDATE added region "${newRegion.trim()}".`); setNewRegion(''); } }} className="px-4 py-2 bg-brand text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5"><Plus className="w-4 h-4" /> {t('Add')}</button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {regions.map(r => (
            <div key={r} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><MapPin className="w-4 h-4" /></div>
                <span className="font-bold text-gray-900 text-xs truncate">{r}</span>
              </div>
              <button onClick={() => { saveRegions(regions.filter(x => x !== r)); logAction('Region Deleted', `ROOT_MANDATE removed region "${r}".`); }} className="p-1.5 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderSeo = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-4">
          {sectionCard(t('Homepage SEO Meta'), t('Shown to Google for tanzaniatradecore.co.tz'), (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">{t('Meta Title')}</label>
                <input value={seoTitle} onChange={e => setSeoTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">{t('Meta Description')}</label>
                <textarea value={seoDesc} onChange={e => setSeoDesc(e.target.value)} rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none resize-none" />
              </div>
              <button onClick={() => { updateSettings({ homepageMeta: { title: seoTitle, description: seoDesc } }); logAction('SEO Updated', `ROOT_MANDATE updated homepage SEO meta title & description.`); setSaved(true); setTimeout(() => setSaved(false), 2000); }} className="px-4 py-2 bg-brand text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5"><Save className="w-4 h-4" /> {saved ? t('Saved!') : t('Save Meta')}</button>
            </div>
          ))}
          {sectionCard(t('Live Search Files'), t('Generated server-side for search engines'), (
            <div className="space-y-2">
              <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-lg hover:bg-gray-100 font-bold text-sm text-gray-800"><span className="flex items-center gap-2"><FileText className="w-4 h-4 text-brand" /> /sitemap.xml</span><ExternalLink className="w-4 h-4 text-gray-400" /></a>
              <a href="/robots.txt" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-lg hover:bg-gray-100 font-bold text-sm text-gray-800"><span className="flex items-center gap-2"><FileText className="w-4 h-4 text-brand" /> /robots.txt</span><ExternalLink className="w-4 h-4 text-gray-400" /></a>
            </div>
          ))}
        </div>
        <div>
          {sectionCard(t('Site Identity'), t('Global brand used across the public site'), (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">{t('Site Name')}</label>
                <input value={settings.siteConfig?.siteName || ''} onChange={e => updateSettings({ siteConfig: { ...(settings.siteConfig || {}), siteName: e.target.value } })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">{t('Tagline')}</label>
                <input value={settings.siteConfig?.tagline || ''} onChange={e => updateSettings({ siteConfig: { ...(settings.siteConfig || {}), tagline: e.target.value } })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">{t('Support Phone')}</label>
                <input value={settings.siteConfig?.supportPhone || ''} onChange={e => updateSettings({ siteConfig: { ...(settings.siteConfig || {}), supportPhone: e.target.value } })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">{t('Support Email')}</label>
                <input value={settings.siteConfig?.supportEmail || ''} onChange={e => updateSettings({ siteConfig: { ...(settings.siteConfig || {}), supportEmail: e.target.value } })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">{t('Marketplace Commission (%)')}</label>
                <input value={settings.siteConfig?.commissionPct || ''} onChange={e => updateSettings({ siteConfig: { ...(settings.siteConfig || {}), commissionPct: e.target.value } })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
              </div>
              <div className="text-[11px] text-green-700 bg-green-50 border border-green-200 rounded-lg p-2.5 font-medium">{t('Changes to the site identity are saved instantly to the database.')}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderHomepage = () => {
    const persist = () => {
      updateHomepage({ heroTitle, heroSubtitle });
      updateSettings({
        homepageContent: { ...content, heroTitle, heroSubtitle },
        homepageMeta: { ...(settings.homepageMeta || {}), title: settings.homepageMeta?.title || (settings.siteConfig?.siteName || 'GlobalTradeCore') + ' — ' + heroTitle }
      });
      logAction('Homepage Updated', `ROOT_MANDATE updated the public homepage hero content.`);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    };

    const input = (label: string, value: string, onChange: (v: string) => void, area = false) => (
      <div>
        <label className="text-[11px] font-bold text-gray-600 block mb-1">{t(label)}</label>
        {area ? <textarea rows={3} value={value} onChange={e => onChange(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none resize-none" />
          : <input value={value} onChange={e => onChange(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />}
      </div>
    );

    const heroStatsEditor = content.heroStats.map((s, i) => (
      <div key={i} className="flex gap-2">
        <input value={content.heroStats[i].value} onChange={e => updateHomepage({ heroStats: content.heroStats.map((x, j) => j === i ? { ...x, value: e.target.value } : x) })} placeholder={t('Value')} className="w-28 px-2 py-1.5 border border-gray-300 rounded text-sm outline-none" />
        <input value={content.heroStats[i].label} onChange={e => updateHomepage({ heroStats: content.heroStats.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} placeholder={t('Label')} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm outline-none" />
      </div>
    ));

    const iconPicker = (value: string, onChange: (v: string) => void) => (
      <select value={value} onChange={e => onChange(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-xs outline-none font-medium">
        {ICON_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    );

    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-bold text-gray-900 text-sm">{t('Public Homepage Editor')}</div>
              <div className="text-[11px] text-gray-500 font-medium">{t('Edits go live on the pre-login homepage instantly (saved to the database).')}</div>
            </div>
            <button onClick={persist} className="px-4 py-2 bg-brand text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5"><Save className="w-4 h-4" /> {saved ? t('Saved!') : t('Save Hero')}</button>
          </div>
          <div className="space-y-3">
            {input(t('Hero Title'), heroTitle, setHeroTitle)}
            {input(t('Hero Subtitle'), heroSubtitle, setHeroSubtitle, true)}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="font-bold text-gray-900 text-sm mb-3">{t('Hero Stats')}</div>
            <div className="space-y-2">{heroStatsEditor}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="font-bold text-gray-900 text-sm mb-3">{t('Overview Section')}</div>
            <div className="space-y-2">
              {input(t('Section Title'), content.overviewTitle, v => updateHomepage({ overviewTitle: v }))}
              {input(t('Section Text'), content.overviewText, v => updateHomepage({ overviewText: v }), true)}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="font-bold text-gray-900 text-sm mb-3">{t('Overview Features')} ({content.overviewFeatures.length})</div>
          <div className="space-y-2">
            {content.overviewFeatures.map((f, i) => (
              <div key={i} className="flex gap-2 items-center">
                {iconPicker(f.icon, v => updateHomepage({ overviewFeatures: content.overviewFeatures.map((x, j) => j === i ? { ...x, icon: v } : x) }))}
                <input value={f.title} onChange={e => updateHomepage({ overviewFeatures: content.overviewFeatures.map((x, j) => j === i ? { ...x, title: e.target.value } : x) })} placeholder={t('Title')} className="w-40 px-2 py-1.5 border border-gray-300 rounded text-sm outline-none" />
                <input value={f.desc} onChange={e => updateHomepage({ overviewFeatures: content.overviewFeatures.map((x, j) => j === i ? { ...x, desc: e.target.value } : x) })} placeholder={t('Description')} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm outline-none" />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="font-bold text-gray-900 text-sm mb-3">{t('Feature Carousel')} ({content.featureCarousel.length})</div>
          <div className="space-y-2">
            {content.featureCarousel.map((f, i) => (
              <div key={i} className="flex gap-2 items-center">
                {iconPicker(f.icon, v => updateHomepage({ featureCarousel: content.featureCarousel.map((x, j) => j === i ? { ...x, icon: v } : x) }))}
                <input value={f.title} onChange={e => updateHomepage({ featureCarousel: content.featureCarousel.map((x, j) => j === i ? { ...x, title: e.target.value } : x) })} placeholder={t('Title')} className="w-44 px-2 py-1.5 border border-gray-300 rounded text-sm outline-none" />
                <input value={f.tag} onChange={e => updateHomepage({ featureCarousel: content.featureCarousel.map((x, j) => j === i ? { ...x, tag: e.target.value } : x) })} placeholder={t('Tag')} className="w-28 px-2 py-1.5 border border-gray-300 rounded text-sm outline-none" />
                <input value={f.desc} onChange={e => updateHomepage({ featureCarousel: content.featureCarousel.map((x, j) => j === i ? { ...x, desc: e.target.value } : x) })} placeholder={t('Description')} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm outline-none" />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="font-bold text-gray-900 text-sm mb-3">{t('Pricing Tiers')} ({content.pricingTiers.length})</div>
          <div className="space-y-3">
            {content.pricingTiers.map((p, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700">{t('Tier')} {i + 1} {p.popular && <span className="ml-1 text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full">{t('POPULAR')}</span>}</span>
                  <label className="flex items-center gap-1 text-[11px] font-bold text-gray-600"><input type="checkbox" checked={p.popular} onChange={e => updateHomepage({ pricingTiers: content.pricingTiers.map((x, j) => j === i ? { ...x, popular: e.target.checked } : x) })} /> {t('Popular')}</label>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {input(t('Name'), p.name, v => updateHomepage({ pricingTiers: content.pricingTiers.map((x, j) => j === i ? { ...x, name: v } : x) }))}
                  {input(t('Price'), p.price, v => updateHomepage({ pricingTiers: content.pricingTiers.map((x, j) => j === i ? { ...x, price: v } : x) }))}
                  {input(t('Period'), p.period, v => updateHomepage({ pricingTiers: content.pricingTiers.map((x, j) => j === i ? { ...x, period: v } : x) }))}
                  {input(t('Tagline'), p.tagline, v => updateHomepage({ pricingTiers: content.pricingTiers.map((x, j) => j === i ? { ...x, tagline: v } : x) }))}
                </div>
                {input(t('Features (one per line)'), p.features.join('\n'), v => updateHomepage({ pricingTiers: content.pricingTiers.map((x, j) => j === i ? { ...x, features: v.split('\n').map(s => s.trim()).filter(Boolean) } : x) }), true)}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="font-bold text-gray-900 text-sm mb-3">{t('Testimonials')} ({content.testimonials.length})</div>
          <div className="space-y-2">
            {content.testimonials.map((ts, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input value={ts.name} onChange={e => updateHomepage({ testimonials: content.testimonials.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} placeholder={t('Name')} className="w-36 px-2 py-1.5 border border-gray-300 rounded text-sm outline-none" />
                <input value={ts.role} onChange={e => updateHomepage({ testimonials: content.testimonials.map((x, j) => j === i ? { ...x, role: e.target.value } : x) })} placeholder={t('Role')} className="w-44 px-2 py-1.5 border border-gray-300 rounded text-sm outline-none" />
                <select value={ts.stars} onChange={e => updateHomepage({ testimonials: content.testimonials.map((x, j) => j === i ? { ...x, stars: Number(e.target.value) } : x) })} className="px-2 py-1.5 border border-gray-300 rounded text-xs outline-none">
                  {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}★</option>)}
                </select>
                <input value={ts.quote} onChange={e => updateHomepage({ testimonials: content.testimonials.map((x, j) => j === i ? { ...x, quote: e.target.value } : x) })} placeholder={t('Quote')} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm outline-none" />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="font-bold text-gray-900 text-sm mb-3">{t('FAQ')} ({content.faqItems.length})</div>
          <div className="space-y-2">
            {content.faqItems.map((f, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                <input value={f.q} onChange={e => updateHomepage({ faqItems: content.faqItems.map((x, j) => j === i ? { ...x, q: e.target.value } : x) })} placeholder={t('Question')} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm outline-none" />
                <textarea rows={2} value={f.a} onChange={e => updateHomepage({ faqItems: content.faqItems.map((x, j) => j === i ? { ...x, a: e.target.value } : x) })} placeholder={t('Answer')} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm outline-none resize-none" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderWithdrawals = () => {
    const pending = (withdrawals || []).filter(w => w.status === 'pending');
    const done = (withdrawals || []).filter(w => w.status !== 'pending');
    return (
      <div className="space-y-4">
        {sectionCard(t('Seller Withdrawals'), t('All M-Pesa payout requests from ALL companies — ROOT pays manually then approves.'), (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full">{t('Pending')}: {pending.length}</span>
              <span className="text-[11px] font-bold bg-green-100 text-green-800 px-2.5 py-1 rounded-full">{t('Approved')}: {done.filter(w => w.status === 'approved').length}</span>
              <span className="text-[11px] font-bold bg-red-100 text-red-800 px-2.5 py-1 rounded-full">{t('Rejected')}: {done.filter(w => w.status === 'rejected').length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-3 font-bold">{t('Company')}</th>
                    <th className="py-2 pr-3 font-bold">{t('Amount')}</th>
                    <th className="py-2 pr-3 font-bold">{t('M-Pesa Number')}</th>
                    <th className="py-2 pr-3 font-bold">{t('Date')}</th>
                    <th className="py-2 pr-3 font-bold">{t('Status')}</th>
                    <th className="py-2 font-bold">{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(withdrawals || []).map(w => (
                    <tr key={w.id} className="border-b border-gray-100">
                      <td className="py-2 pr-3 font-bold text-gray-900">{w.companyName || companyName(companies, w.companyId)}</td>
                      <td className="py-2 pr-3 font-semibold text-gray-700">{TZS(w.amount)}</td>
                      <td className="py-2 pr-3 text-gray-600">{w.phoneNumber}</td>
                      <td className="py-2 pr-3 text-gray-500">{formatDate(w.requestedAt)}</td>
                      <td className="py-2 pr-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[w.status] || 'bg-gray-100 text-gray-700'}`}>{t(STATUS_LABEL[w.status] || w.status)}</span>
                      </td>
                      <td className="py-2">
                        {w.status === 'pending' ? (
                          <div className="flex items-center gap-2">
                            <input
                              placeholder={t('M-Pesa ref (optional)')}
                              value={wdrNote.id === w.id ? wdrNote.note : ''}
                              onChange={e => setWdrNote({ id: w.id, note: e.target.value })}
                              className="w-36 px-2 py-1.5 border border-gray-300 rounded-lg text-[11px] outline-none"
                            />
                            <button
                              onClick={() => { onDecideSellerWithdrawal(w.id, 'approved', wdrNote.id === w.id ? wdrNote.note : undefined); setWdrNote({ id: 0, note: '' }); }}
                              className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[11px] font-bold cursor-pointer"
                            >
                              <ThumbsUp className="w-3.5 h-3.5 inline mr-1" />{t('Approve')}
                            </button>
                            <button
                              onClick={() => onDecideSellerWithdrawal(w.id, 'rejected')}
                              className="px-2.5 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[11px] font-bold cursor-pointer"
                            >
                              <ThumbsDown className="w-3.5 h-3.5 inline mr-1" />{t('Reject')}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-400 font-medium">{w.decidedBy || ''} · {w.adminNote || ''}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(withdrawals || []).length === 0 && (
                    <tr><td colSpan={6} className="py-6 text-center text-gray-400 font-medium">{t('No withdrawal requests yet.')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderAffiliates = () => {
    const affClicksCount = (affId: number) => (affiliateClicks || []).filter(c => c.affiliateId === affId).length;
    const affSalesCount = (affId: number) => (affiliateSales || []).filter(s => s.affiliateId === affId).length;
    return (
      <div className="space-y-4">
        {sectionCard(t('Affiliates'), t('Referral partners — commission paid manually by ROOT via M-Pesa.'), (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-3 font-bold">{t('Name')}</th>
                  <th className="py-2 pr-3 font-bold">{t('Code')}</th>
                  <th className="py-2 pr-3 font-bold">{t('Clicks')}</th>
                  <th className="py-2 pr-3 font-bold">{t('Sales')}</th>
                  <th className="py-2 pr-3 font-bold">{t('Balance')}</th>
                  <th className="py-2 pr-3 font-bold">{t('Earned')}</th>
                  <th className="py-2 pr-3 font-bold">{t('Withdrawn')}</th>
                  <th className="py-2 font-bold">{t('Status')}</th>
                  <th className="py-2 font-bold">{t('Sales')}</th>
                </tr>
              </thead>
              <tbody>
                {(affiliates || []).map(a => (
                  <tr key={a.id} className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-bold text-gray-900">{a.name}</td>
                    <td className="py-2 pr-3 text-brand font-mono font-bold">{a.referralCode}</td>
                    <td className="py-2 pr-3 text-gray-600">{affClicksCount(a.id)}</td>
                    <td className="py-2 pr-3 text-gray-600">{affSalesCount(a.id)}</td>
                    <td className="py-2 pr-3 font-bold text-gray-900">{TZS(a.balance)}</td>
                    <td className="py-2 pr-3 text-gray-600">{TZS(a.totalEarned)}</td>
                    <td className="py-2 pr-3 text-gray-600">{TZS(a.totalWithdrawn)}</td>
                    <td className="py-2 pr-3">
                      {a.status === 'pending' ? (
                        <button
                          onClick={() => onApproveAffiliate(a.id, true)}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full cursor-pointer bg-amber-100 text-amber-800 hover:bg-amber-200"
                          title={t('Approve this wakala to start earning commission')}
                        >
                          {t('Pending Approval')}
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            const next = (affiliates || []).map(x => x.id === a.id ? { ...x, isActive: !x.isActive, status: x.isActive ? 'suspended' : ('active' as const) } : x);
                            onUpdateAffiliate(next as any);
                          }}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full cursor-pointer ${a.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                        >
                          {a.isActive ? t('Active') : t('Suspended')}
                        </button>
                      )}
                    </td>
                    <td className="py-2">
                      <button onClick={() => setSelectedAffiliate(a)} className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[11px] font-bold cursor-pointer">
                        {t('View Sales')}
                      </button>
                    </td>
                  </tr>
                ))}
                {(affiliates || []).length === 0 && (
                  <tr><td colSpan={9} className="py-6 text-center text-gray-400 font-medium">{t('No affiliates yet.')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ))}
        {sectionCard(t('Affiliate Withdrawal Requests'), t('Approve means ROOT sent the money manually via M-Pesa.'), (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-3 font-bold">{t('Affiliate')}</th>
                  <th className="py-2 pr-3 font-bold">{t('Amount')}</th>
                  <th className="py-2 pr-3 font-bold">{t('Payout')}</th>
                  <th className="py-2 pr-3 font-bold">{t('Date')}</th>
                  <th className="py-2 font-bold">{t('Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {(affiliateWithdrawals || []).map(w => {
                  const aff = (affiliates || []).find(a => a.id === w.affiliateId);
                  return (
                    <tr key={w.id} className="border-b border-gray-100">
                      <td className="py-2 pr-3 font-bold text-gray-900">{aff?.name || `#${w.affiliateId}`}</td>
                      <td className="py-2 pr-3 font-semibold text-gray-700">{TZS(w.amount)}</td>
                      <td className="py-2 pr-3 text-gray-600">
                        {w.phoneNumber}
                        {w.method === 'bank' ? ` (${w.bankName || 'Bank'})` : ` (${w.method === 'tigopesa' ? 'Tigo Pesa' : 'M-Pesa'})`}
                      </td>
                      <td className="py-2 pr-3 text-gray-500">{formatDate(w.requestedAt)}</td>
                      <td className="py-2">
                        {w.status === 'pending' ? (
                          <div className="flex gap-2">
                            <button onClick={() => onDecideAffiliateWithdrawal(w.id, 'approved')} className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[11px] font-bold cursor-pointer">
                              <ThumbsUp className="w-3.5 h-3.5 inline mr-1" />{t('Approve')}
                            </button>
                            <button onClick={() => onDecideAffiliateWithdrawal(w.id, 'rejected')} className="px-2.5 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[11px] font-bold cursor-pointer">
                              <ThumbsDown className="w-3.5 h-3.5 inline mr-1" />{t('Reject')}
                            </button>
                          </div>
                        ) : (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[w.status] || 'bg-gray-100 text-gray-700'}`}>{t(STATUS_LABEL[w.status] || w.status)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {(affiliateWithdrawals || []).length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-gray-400 font-medium">{t('No affiliate withdrawals yet.')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ))}
        {selectedAffiliate && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-bold text-gray-900 text-sm">{t('Sales')} — {selectedAffiliate.name} ({selectedAffiliate.referralCode})</div>
              <button onClick={() => setSelectedAffiliate(null)} className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-bold text-gray-600 cursor-pointer">{t('Close')}</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-3 font-bold">{t('Order')}</th>
                    <th className="py-2 pr-3 font-bold">{t('Company')}</th>
                    <th className="py-2 pr-3 font-bold">{t('Order Total')}</th>
                    <th className="py-2 pr-3 font-bold">{t('Commission %')}</th>
                    <th className="py-2 pr-3 font-bold">{t('Commission')}</th>
                    <th className="py-2 font-bold">{t('Status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(affiliateSales || []).filter(s => s.affiliateId === selectedAffiliate.id).map(s => (
                    <tr key={s.id} className="border-b border-gray-100">
                      <td className="py-2 pr-3 font-mono text-gray-700">#{s.orderId}</td>
                      <td className="py-2 pr-3 text-gray-600">{companyName(companies, s.companyId)}</td>
                      <td className="py-2 pr-3 text-gray-600">{TZS(s.amount)}</td>
                      <td className="py-2 pr-3 text-gray-600">{s.commissionPercent}%</td>
                      <td className="py-2 pr-3 font-bold text-gray-900">{TZS(s.commissionAmount)}</td>
                      <td className="py-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[s.status] || 'bg-gray-100 text-gray-700'}`}>{t(STATUS_LABEL[s.status] || s.status)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSearchSynonyms = () => {
    const filtered = (searchSynonyms || []).filter(s => {
      const q = synSearch.toLowerCase();
      if (!q) return true;
      return s.keyword.toLowerCase().includes(q) || s.synonyms.some(x => x.toLowerCase().includes(q));
    });
    return (
      <div className="space-y-4">
        {sectionCard(t('Search Synonyms'), t('Kiswahili→English search dictionary — used by /search to expand queries. Seed with viatu, kitenge, gauni…'), (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <input value={synSearch} onChange={e => setSynSearch(e.target.value)} placeholder={t('Search synonyms…')} className="flex-1 min-w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
              <input value={newSynKeyword} onChange={e => setNewSynKeyword(e.target.value)} placeholder={t('Keyword (e.g. viatu)')} className="w-44 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
              <input value={newSynValue} onChange={e => setNewSynValue(e.target.value)} placeholder={t('Synonyms, comma separated (e.g. shoes, kiatu)')} className="flex-1 min-w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
              <button
                onClick={() => {
                  const kw = newSynKeyword.trim().toLowerCase();
                  const syns = newSynValue.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
                  if (!kw || syns.length === 0) return;
                  const next = [...(searchSynonyms || []), { id: Date.now(), keyword: kw, synonyms: syns }];
                  onUpdateSearchSynonyms(next);
                  setNewSynKeyword('');
                  setNewSynValue('');
                  logAction('Search Synonym', `ROOT_MANDATE added keyword "${kw}".`);
                }}
                className="px-3 py-2 bg-brand text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 inline mr-1" />{t('Add')}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {filtered.map(s => (
                <div key={s.id} className="border border-gray-200 rounded-lg p-3 flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-gray-900 text-xs">{s.keyword}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{s.synonyms.join(', ')}</div>
                  </div>
                  <button
                    onClick={() => {
                      onUpdateSearchSynonyms((searchSynonyms || []).filter(x => x.id !== s.id));
                      logAction('Search Synonym', `ROOT_MANDATE deleted keyword "${s.keyword}".`);
                    }}
                    className="text-red-500 hover:text-red-700 cursor-pointer shrink-0"
                    title={t('Delete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {filtered.length === 0 && <div className="col-span-2 py-6 text-center text-gray-400 font-medium">{t('No synonyms found.')}</div>}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const NETWORK_LABEL: Record<string, string> = {
    mpesa: 'M-Pesa', tigopesa: 'Tigo Pesa', airtelmoney: 'Airtel Money', halopesa: 'HaloPesa', azampesa: 'AzamPesa'
  };

  const COLLECTION_STATUS_BADGE: Record<string, string> = {
    manual_pending_approval: 'bg-amber-100 text-amber-800',
    processing: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800'
  };

  const COLLECTION_STATUS_LABEL: Record<string, string> = {
    manual_pending_approval: 'Pending Approval',
    processing: 'Processing',
    completed: 'Completed',
    failed: 'Failed'
  };

  const pendingCollections = (collections || []).filter(c => c.status === 'manual_pending_approval');

  const renderCollections = () => {
    const filtered = (collections || []).filter(c => {
      const q = colSearch.toLowerCase();
      const matchesQ = !q
        || c.reference.toLowerCase().includes(q)
        || (c.customerName || '').toLowerCase().includes(q)
        || c.customerPhone.replace(/\s/g, '').toLowerCase().includes(q.replace(/\s/g, '').toLowerCase())
        || (c.transactionId || '').toLowerCase().includes(q);
      const matchesNet = colNetFilter === 'all' || c.network === colNetFilter;
      const matchesStatus = colStatusFilter === 'all' || c.status === colStatusFilter;
      return matchesQ && matchesNet && matchesStatus;
    });
    const totalCollected = (collections || []).filter(c => c.status === 'completed').reduce((s, c) => s + (c.amountTzs || c.amount || 0), 0);
    const totalAdmin = (adminEarnings || []).reduce((s, e) => s + (e.commissionAmount || 0), 0);
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statCard(<Landmark className="w-5 h-5 text-white" />, (collections || []).length, t('Total Collections'), 'bg-indigo-500')}
          {statCard(<Inbox className="w-5 h-5 text-white" />, pendingCollections.length, t('Pending Approval'), 'bg-amber-500')}
          {statCard(<CheckCircle2 className="w-5 h-5 text-white" />, TZS(totalCollected), t('Collected'), 'bg-emerald-500')}
          {statCard(<Wallet className="w-5 h-5 text-white" />, TZS(totalAdmin), t('Platform Earnings'), 'bg-purple-500')}
        </div>

        {sectionCard(t('Collections'), t('All multi-network payments. Approve manual payments to credit the seller wallet (amount − commission).'), (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <input value={colSearch} onChange={e => setColSearch(e.target.value)} placeholder={t('Search reference / customer / phone / transaction…')} className="flex-1 min-w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
              <select value={colNetFilter} onChange={e => setColNetFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none cursor-pointer">
                <option value="all">{t('All Networks')}</option>
                {['mpesa', 'tigopesa', 'airtelmoney', 'halopesa'].map(n => <option key={n} value={n}>{NETWORK_LABEL[n] || n}</option>)}
              </select>
              <select value={colStatusFilter} onChange={e => setColStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none cursor-pointer">
                <option value="all">{t('All Statuses')}</option>
                {['manual_pending_approval', 'processing', 'completed', 'failed'].map(s => <option key={s} value={s}>{COLLECTION_STATUS_LABEL[s] || s}</option>)}
              </select>
              <button onClick={onTestCollection} className="px-3 py-2 bg-gray-800 text-white rounded-lg text-xs font-bold cursor-pointer inline-flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />{t('Add Test Collection')}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-240">
                <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-3 py-2.5 font-black">{t('Reference')}</th>
                    <th className="px-3 py-2.5 font-black">{t('Network')}</th>
                    <th className="px-3 py-2.5 font-black">{t('Customer')}</th>
                    <th className="px-3 py-2.5 font-black">{t('Amount')}</th>
                    <th className="px-3 py-2.5 font-black">{t('Status')}</th>
                    <th className="px-3 py-2.5 font-black">{t('Mode')}</th>
                    <th className="px-3 py-2.5 font-black">{t('Transaction ID')}</th>
                    <th className="px-3 py-2.5 font-black">{t('Date')}</th>
                    <th className="px-3 py-2.5 font-black">{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 font-mono font-bold text-gray-900">{c.reference}</td>
                      <td className="px-3 py-2.5 font-bold text-gray-700">{NETWORK_LABEL[c.network] || c.network}</td>
                      <td className="px-3 py-2.5">
                        <div className="font-bold text-gray-900">{c.customerName || '—'}</div>
                        <div className="text-gray-400 font-semibold">{c.customerPhone}</div>
                      </td>
                      <td className="px-3 py-2.5 font-black text-gray-900">{TZS(c.amountTzs || c.amount || 0)}</td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${COLLECTION_STATUS_BADGE[c.status] || 'bg-gray-100 text-gray-700'}`}>
                          {COLLECTION_STATUS_LABEL[c.status] || c.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 font-semibold capitalize">{c.mode || 'manual'}</td>
                      <td className="px-3 py-2.5 text-gray-600 font-semibold">{c.transactionId || (c.azampayTransactionId || '—')}</td>
                      <td className="px-3 py-2.5 text-gray-500 font-semibold">{formatDate(c.createdAt)}</td>
                      <td className="px-3 py-2.5">
                        {c.status === 'manual_pending_approval' ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <input
                              value={colDecideNote.id === c.id ? colDecideNote.note : ''}
                              onChange={e => setColDecideNote({ id: c.id, note: e.target.value })}
                              placeholder={t('Note (optional)')}
                              className="w-28 px-2 py-1 border border-gray-300 rounded-md text-[10px] outline-none"
                            />
                            <button
                              onClick={() => { onDecideCollection(c.id, 'approved', colDecideNote.id === c.id ? colDecideNote.note || undefined : undefined); setColDecideNote({ id: 0, note: '' }); }}
                              className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded-md text-[10px] font-bold cursor-pointer inline-flex items-center gap-1"
                            >
                              <ThumbsUp className="w-3 h-3" />{t('Approve')}
                            </button>
                            <button
                              onClick={() => { onDecideCollection(c.id, 'rejected', colDecideNote.id === c.id ? colDecideNote.note || undefined : undefined); setColDecideNote({ id: 0, note: '' }); }}
                              className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md text-[10px] font-bold cursor-pointer inline-flex items-center gap-1"
                            >
                              <ThumbsDown className="w-3 h-3" />{t('Reject')}
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={9} className="py-6 text-center text-gray-400 font-medium">{t('No collections found.')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {pendingCollections.length > 0 && (
              <button
                onClick={() => { pendingCollections.forEach(c => onDecideCollection(c.id, 'approved')); }}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />{t('Approve All Pending')} ({pendingCollections.length})
              </button>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderCollectionSettings = () => {
    const networkSettings = settings.collectionSettings || [];
    const saveNetwork = () => {
      if (!settingForm.displayName.trim() || !settingForm.payNumber.trim()) return;
      if (editingSettingId === null) {
        const newId = Math.max(0, ...networkSettings.map(n => n.id)) + 1;
        const next: CollectionSetting[] = [...networkSettings, {
          id: newId,
          network: (settingForm.payNumber.startsWith('25574') ? 'mpesa' : settingForm.payNumber.startsWith('25571') ? 'tigopesa' : settingForm.payNumber.startsWith('25575') ? 'airtelmoney' : 'halopesa') as CollectionNetwork,
          displayName: settingForm.displayName.trim(),
          payNumber: settingForm.payNumber.trim(),
          accountName: settingForm.accountName.trim(),
          logo: settingForm.logo.trim(),
          instructions: settingForm.instructions.trim(),
          isActive: true
        }];
        onUpdateCollectionSettings(next);
      } else {
        const next = networkSettings.map(n => n.id === editingSettingId
          ? { ...n, displayName: settingForm.displayName.trim(), payNumber: settingForm.payNumber.trim(), accountName: settingForm.accountName.trim(), logo: settingForm.logo.trim(), instructions: settingForm.instructions.trim() }
          : n);
        onUpdateCollectionSettings(next);
      }
      setEditingSettingId(null);
      setSettingForm({ displayName: '', payNumber: '', accountName: '', logo: '', instructions: '' });
      logAction('Collection Settings', `ROOT_MANDATE saved network pay number ${settingForm.payNumber}.`);
    };
    return (
      <div className="space-y-4">
        {sectionCard(t('Collection Mode'), t('Manual = customers pay the network number and upload proof for ROOT approval. Auto = AzamPay USSD push when API keys are set.'), (
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => { setColMode('manual'); onUpdateCollectionMode('manual'); }} className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer border ${colMode === 'manual' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-700 border-gray-300'}`}>
              {t('Manual (default)')}
            </button>
            <button onClick={() => { setColMode('auto'); onUpdateCollectionMode('auto'); }} className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer border ${colMode === 'auto' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300'}`}>
              {t('Auto (AzamPay)')}
            </button>
            <span className={`text-[11px] font-bold ${colMode === 'auto' ? 'text-indigo-600' : 'text-gray-500'}`}>
              {colMode === 'auto' ? t('USSD push enabled — requires client id + secret below.') : t('Customers pay the displayed numbers and upload proof.')}
            </span>
          </div>
        ))}

        {sectionCard(t('Network Pay Numbers'), t('Shown at checkout. {payNumber} in instructions is replaced by the live number.'), (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-140">
                <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-3 py-2.5 font-black">{t('Network')}</th>
                    <th className="px-3 py-2.5 font-black">{t('Pay Number')}</th>
                    <th className="px-3 py-2.5 font-black">{t('Account Name')}</th>
                    <th className="px-3 py-2.5 font-black">{t('Active')}</th>
                    <th className="px-3 py-2.5 font-black">{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {networkSettings.map(n => (
                    <tr key={n.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 font-black text-gray-900 flex items-center gap-2">
                        {n.logo ? <img src={n.logo} alt={n.displayName} className="w-6 h-6 rounded object-cover" /> : <Smartphone className="w-4 h-4 text-gray-400" />}
                        {n.displayName}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold text-gray-700">{n.payNumber}</td>
                      <td className="px-3 py-2.5 text-gray-600 font-semibold">{n.accountName}</td>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => onUpdateCollectionSettings(networkSettings.map(x => x.id === n.id ? { ...x, isActive: !x.isActive } : x))}
                          className={`relative w-9 h-5 rounded-full transition cursor-pointer ${n.isActive !== false ? 'bg-emerald-500' : 'bg-gray-300'}`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${n.isActive !== false ? 'left-4.5' : 'left-0.5'}`} />
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => {
                            setEditingSettingId(n.id);
                            setSettingForm({ displayName: n.displayName, payNumber: n.payNumber, accountName: n.accountName, logo: n.logo || '', instructions: n.instructions || '' });
                          }}
                          className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-[10px] font-bold cursor-pointer"
                        >
                          {t('Edit')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-gray-100 pt-3">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">{t('Display Name')} *</label>
                <input value={settingForm.displayName} onChange={e => setSettingForm({ ...settingForm, displayName: e.target.value })} placeholder="e.g. M-Pesa" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">{t('Pay Number')} *</label>
                <input value={settingForm.payNumber} onChange={e => setSettingForm({ ...settingForm, payNumber: e.target.value })} placeholder="e.g. 2557XXXXXX" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">{t('Account Name')}</label>
                <input value={settingForm.accountName} onChange={e => setSettingForm({ ...settingForm, accountName: e.target.value })} placeholder="e.g. Tanzania Trade Core" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">{t('Logo URL')}</label>
                <input value={settingForm.logo} onChange={e => setSettingForm({ ...settingForm, logo: e.target.value })} placeholder="/images/mpesa.png" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-gray-700 block mb-1">{t('Instructions')}</label>
                <textarea value={settingForm.instructions} onChange={e => setSettingForm({ ...settingForm, instructions: e.target.value })} placeholder="Lipa kwa {payNumber}. Baada ya malipo, andika Transaction ID." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none min-h-16" />
              </div>
              <div className="md:col-span-2 flex items-center gap-2">
                <button onClick={saveNetwork} className="px-4 py-2 bg-brand text-white rounded-lg text-xs font-bold cursor-pointer inline-flex items-center gap-1.5">
                  <Save className="w-3.5 h-3.5" />{editingSettingId === null ? t('Add Network') : t('Save Changes')}
                </button>
                {editingSettingId !== null && (
                  <button onClick={() => { setEditingSettingId(null); setSettingForm({ displayName: '', payNumber: '', accountName: '', logo: '', instructions: '' }); }} className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold cursor-pointer">
                    {t('Cancel')}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {sectionCard(t('AzamPay Auto Collection'), t('Leave empty to keep manual mode. Client ID/Secret come from the AzamPay developer portal.'), (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">{t('App Name')}</label>
              <input value={azampayForm.azampayAppName} onChange={e => setAzampayForm({ ...azampayForm, azampayAppName: e.target.value })} placeholder="TradeCore" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">{t('Client ID')}</label>
              <input value={azampayForm.azampayClientId} onChange={e => setAzampayForm({ ...azampayForm, azampayClientId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">{t('Client Secret')}</label>
              <input type="password" value={azampayForm.azampayClientSecret} onChange={e => setAzampayForm({ ...azampayForm, azampayClientSecret: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">{t('Webhook Secret (optional)')}</label>
              <input type="password" value={azampayForm.azampayWebhookSecret} onChange={e => setAzampayForm({ ...azampayForm, azampayWebhookSecret: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
            </div>
            <div className="md:col-span-2">
              <button
                onClick={() => {
                  updateSettings({
                    azampayAppName: azampayForm.azampayAppName.trim(),
                    azampayClientId: azampayForm.azampayClientId.trim(),
                    azampayClientSecret: azampayForm.azampayClientSecret.trim(),
                    azampayWebhookSecret: azampayForm.azampayWebhookSecret.trim()
                  });
                  logAction('Collection Settings', 'ROOT_MANDATE updated AzamPay credentials.');
                }}
                className="px-4 py-2 bg-brand text-white rounded-lg text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />{t('Save AzamPay Settings')}
              </button>
              <p className={`text-[10px] font-semibold mt-2 text-gray-500`}>
                <AlertTriangle className="w-3 h-3 inline mr-1 text-amber-500" />
                {t('Webhook URL')}: <code className="font-mono bg-gray-100 px-1 py-0.5 rounded">/api/webhooks/azampay/collection</code>
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderWebhookLogs = () => {
    return (
      <div className="space-y-4">
        {sectionCard(t('Webhook Logs'), t('Every AzamPay/BEEM callback is logged here — even failed signature checks — so you can debug delivery issues.'), (
          <div className="space-y-3">
            <div className="flex items-center justify-end">
              <button
                onClick={() => { onClearWebhookLogs(); }}
                className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />{t('Clear Logs')}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-160">
                <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-3 py-2.5 font-black">{t('Provider')}</th>
                    <th className="px-3 py-2.5 font-black">{t('Event')}</th>
                    <th className="px-3 py-2.5 font-black">{t('Status')}</th>
                    <th className="px-3 py-2.5 font-black">{t('Note')}</th>
                    <th className="px-3 py-2.5 font-black">{t('Received At')}</th>
                    <th className="px-3 py-2.5 font-black">{t('Payload')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(webhookLogs || []).map((w, i) => (
                    <tr key={w.id || i} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 font-bold text-gray-700">{w.provider}</td>
                      <td className="px-3 py-2.5 text-gray-600 font-semibold">{w.event || '—'}</td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${w.status === 'received' ? 'bg-blue-100 text-blue-800' : w.status === 'processed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {w.status || 'received'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 font-semibold">{w.note || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-500 font-semibold">{formatDate(w.receivedAt)}</td>
                      <td className="px-3 py-2.5">
                        <details className="cursor-pointer">
                          <summary className="text-[10px] font-bold text-gray-500">{t('View')}</summary>
                          <pre className="mt-1 text-[9px] bg-gray-50 border border-gray-100 rounded-md p-2 overflow-x-auto max-w-70 whitespace-pre-wrap">{w.payload}</pre>
                        </details>
                      </td>
                    </tr>
                  ))}
                  {(webhookLogs || []).length === 0 && (
                    <tr><td colSpan={6} className="py-6 text-center text-gray-400 font-medium">{t('No webhook activity yet.')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderPhase2C = () => {
    const OFFER_STATUS_BADGE: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-800', countered: 'bg-blue-100 text-blue-800', accepted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800', paid: 'bg-emerald-100 text-emerald-700', expired: 'bg-gray-100 text-gray-600'
    };
    const DELIVERY_LABEL: Record<string, string> = {
      pending: 'Inasubiri', assigned: 'Rider amekabidhiwa', picked: 'Amechukua', on_the_way: 'Njiani', delivered: 'Imefikishwa', cancelled: 'Imegairiwa'
    };
    const tierCls = (tier: string) => tier === 'platinum' ? 'bg-purple-100 text-purple-700' : tier === 'gold' ? 'bg-amber-100 text-amber-700' : tier === 'silver' ? 'bg-gray-100 text-gray-700' : 'bg-orange-100 text-orange-700';

    return (
      <div className="space-y-4">
        {/* Overview stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: <HandCoins className="w-4 h-4 text-orange-500" />, label: t('Offers'), value: offers.length },
            { icon: <UsersIcon className="w-4 h-4 text-indigo-500" />, label: t('Group Deals'), value: groupDeals.length },
            { icon: <CalendarClock className="w-4 h-4 text-sky-500" />, label: t('Installment Orders'), value: installmentOrders.length },
            { icon: <Bike className="w-4 h-4 text-emerald-500" />, label: t('Deliveries'), value: deliveries.length },
            { icon: <Video className="w-4 h-4 text-rose-500" />, label: t('Live Streams'), value: liveStreams.length },
            { icon: <Gift className="w-4 h-4 text-amber-500" />, label: t('Loyalty Customers'), value: loyaltyCustomers.length },
            { icon: <ChatIcon className="w-4 h-4 text-green-500" />, label: t('WhatsApp Messages'), value: whatsappConversations.length },
            { icon: <Smartphone className="w-4 h-4 text-blue-500" />, label: t('SMS Log'), value: notificationLogs.length }
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-1">{s.icon}<span className="text-[10px] font-bold uppercase tracking-wide">{s.label}</span></div>
              <div className="text-2xl font-black text-gray-900">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Offers */}
        {sectionCard(t('Offers (Piga Bei)'), t('Pending offers need an accept/reject decision from the seller or ROOT.'), (
          <div className="space-y-2">
            {offers.length === 0 && <div className="py-6 text-center text-gray-400 font-medium text-xs">{t('No offers yet.')}</div>}
            {offers.map(o => (
              <div key={o.id} className="border border-gray-100 rounded-lg p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-gray-900">{o.customerName} <span className="text-gray-400 font-medium">· {o.customerPhone}</span></div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{companyName(companies, o.companyId)} · {t('Bidhaa')} #{o.productId} · {formatDate(o.createdAt)}</div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${OFFER_STATUS_BADGE[o.status] || 'bg-gray-100 text-gray-600'}`}>{o.status}</span>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <div className="text-lg font-extrabold text-gray-900">{TZS(o.offeredPrice)}</div>
                  {o.counterPrice !== undefined && <div className="text-lg font-extrabold text-brand">{TZS(o.counterPrice)}</div>}
                  {o.paymentReference && <span className="text-[10px] font-bold text-gray-400">Ref: {o.paymentReference}</span>}
                </div>
                {(o.status === 'pending' || o.status === 'countered') && (
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => onDecideOffer(o.id, 'accept')} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[11px] font-bold cursor-pointer inline-flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" />{t('Accept')}</button>
                    <button onClick={() => onDecideOffer(o.id, 'reject')} className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[11px] font-bold cursor-pointer inline-flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" />{t('Reject')}</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}

        {/* Group deals */}
        {sectionCard(t('Group Deals (Nunua Pamoja)'), t('Deals complete when paid buyers reach minBuyers.'), (
          <div className="space-y-2">
            {groupDeals.length === 0 && <div className="py-6 text-center text-gray-400 font-medium text-xs">{t('No group deals yet.')}</div>}
            {groupDeals.map(d => {
              const participants = groupDealParticipants.filter(p => p.groupDealId === d.id);
              const paid = participants.filter(p => p.status === 'paid').length;
              return (
                <div key={d.id} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-bold text-gray-900">{companyName(companies, d.companyId)} · {t('Bidhaa')} #{d.productId} <span className="text-gray-400 font-medium">· {d.shareCode}</span></div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${d.status === 'active' ? 'bg-indigo-100 text-indigo-700' : d.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{d.status}</span>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1">{TZS(d.soloPrice)} → {TZS(d.groupPrice)} · {paid}/{d.minBuyers} {t('wanunuzi')}</div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-2"><div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(100, (paid / d.minBuyers) * 100)}%` }} /></div>
                </div>
              );
            })}
          </div>
        ))}

        {/* Installments */}
        {sectionCard(t('Lipa Pole Pole'), t('Installment orders and their payment progress across all companies.'), (
          <div className="space-y-2">
            {installmentOrders.length === 0 && <div className="py-6 text-center text-gray-400 font-medium text-xs">{t('No installment orders yet.')}</div>}
            {installmentOrders.map(ord => {
              const pays = installmentPayments.filter(p => p.installmentOrderId === ord.id);
              const done = pays.filter(p => p.status === 'completed').length;
              const pct = Math.round((done / ord.installmentsCount) * 100);
              return (
                <div key={ord.id} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-bold text-gray-900">{ord.customerName} <span className="text-gray-400 font-medium">· {ord.customerPhone}</span> <span className="text-gray-400">· {companyName(companies, ord.companyId)}</span></div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ord.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : ord.status === 'active' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-800'}`}>{ord.status}</span>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1">{TZS(ord.totalPrice)} · {done}/{ord.installmentsCount} {t('awamu')} ({pct}%) · {ord.trackingCode}</div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-2"><div className="h-full bg-sky-500 rounded-full" style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
        ))}

        {/* Deliveries */}
        {sectionCard(t('Bodaboda Deliveries'), t('Live tracking state for every delivery across the platform.'), (
          <div className="space-y-2">
            {deliveries.length === 0 && <div className="py-6 text-center text-gray-400 font-medium text-xs">{t('No deliveries yet.')}</div>}
            {deliveries.map(d => {
              const latest = deliveryUpdates.filter(u => u.deliveryId === d.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
              return (
                <div key={d.id} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-bold text-gray-900">{d.trackingCode} <span className="text-gray-400 font-medium">· {d.customerName} · {companyName(companies, d.companyId)}</span></div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${d.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' : d.status === 'cancelled' ? 'bg-red-100 text-red-600' : d.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-700'}`}>{DELIVERY_LABEL[d.status] || d.status}</span>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1">
                    {d.riderName ? `${d.riderName} · ${d.riderPhone}` : t('Hakuna rider bado')}
                    {latest && <span> · {latest.note || ''} {latest.lat !== undefined && `· ${Number(latest.lat).toFixed(5)}, ${Number(latest.lng).toFixed(5)}`} · {formatDate(latest.createdAt)}</span>}
                  </div>
                  {d.status === 'pending' && (
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => onUpdateDeliveryStatus(d.id, 'assigned', t('ROOT alikabidhi rider'))} className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[11px] font-bold cursor-pointer">{t('Mark Assigned')}</button>
                      <button onClick={() => onUpdateDeliveryStatus(d.id, 'delivered', t('ROOT alithibitisha uwasilishaji'))} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold cursor-pointer">{t('Mark Delivered')}</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* Live streams */}
        {sectionCard(t('Live Shopping'), t('Toggle live status for any seller stream.'), (
          <div className="space-y-2">
            {liveStreams.length === 0 && <div className="py-6 text-center text-gray-400 font-medium text-xs">{t('No live streams yet.')}</div>}
            {liveStreams.map(s => {
              const comments = liveComments.filter(c => c.liveStreamId === s.id);
              const wants = comments.filter(c => c.type === 'want').length;
              return (
                <div key={s.id} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-bold text-gray-900">{s.title} <span className="text-gray-400 font-medium">· {companyName(companies, s.companyId)} · {s.streamKey}</span></div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.status === 'live' ? 'bg-rose-100 text-rose-700' : s.status === 'scheduled' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>{s.status}</span>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1">👁 {s.viewersCount || 0} · 👍 {s.likesCount || 0} · "Nataka" × {wants} · {formatDate(s.createdAt)}</div>
                  <div className="flex gap-2 mt-2">
                    {s.status !== 'live' && <button onClick={() => onToggleLiveStream(s.id, true)} className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold cursor-pointer inline-flex items-center gap-1.5"><Radio className="w-3.5 h-3.5" />{t('Go Live')}</button>}
                    {s.status === 'live' && <button onClick={() => onToggleLiveStream(s.id, false)} className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-[11px] font-bold cursor-pointer">{t('End Live')}</button>}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* Loyalty */}
        {sectionCard(t('Loyalty / Pointi za Mteja'), t('Every loyalty customer and their tier across the platform.'), (
          <div className="space-y-2">
            {loyaltyCustomers.length === 0 && <div className="py-6 text-center text-gray-400 font-medium text-xs">{t('No loyalty customers yet.')}</div>}
            {loyaltyCustomers.map(c => {
              const txns = loyaltyTransactions.filter(tx => tx.loyaltyCustomerId === c.id);
              return (
                <div key={c.id} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-bold text-gray-900">{c.name || c.phone} <span className="text-gray-400 font-medium">· {c.phone}</span></div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tierCls(c.tier)}`}>{c.tier}</span>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1">Balance {c.balancePoints} · Total {c.totalPoints} · Used {c.usedPoints} · Spent {TZS(c.totalSpent)} · Txns {txns.length}</div>
                </div>
              );
            })}
          </div>
        ))}

        {/* WhatsApp + SMS */}
        {sectionCard(t('WhatsApp Bot & SMS Log'), t('Recent bot conversations and the SMS notification log (log mode — nothing is actually sent).'), (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-xs font-black text-gray-700 uppercase tracking-wide">{t('WhatsApp Conversations')}</div>
              {whatsappConversations.slice(0, 20).map(conv => (
                <div key={conv.id} className="border border-gray-100 rounded-lg p-2.5">
                  <div className="flex items-center justify-between"><span className="text-[11px] font-bold text-gray-800">{conv.phone}</span><span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">{conv.mode}</span></div>
                  <div className="text-[11px] text-gray-600 mt-1">{conv.messageIn}</div>
                  {conv.messageOut && <div className="text-[11px] text-brand font-semibold bg-emerald-50 rounded-md p-1.5 mt-1">→ {conv.messageOut}</div>}
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <div className="text-xs font-black text-gray-700 uppercase tracking-wide">{t('SMS Log')}</div>
              {notificationLogs.slice(0, 20).map(log => (
                <div key={log.id} className="border border-gray-100 rounded-lg p-2.5">
                  <div className="flex items-center justify-between"><span className="text-[11px] font-bold text-gray-800">{log.to}</span><span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">{log.kind}</span></div>
                  <div className="text-[11px] text-gray-600 mt-1">{log.message}</div>
                  <div className="text-[9px] text-gray-400 mt-0.5">{formatDate(log.createdAt)}{log.url ? ` · ${log.url}` : ''}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderSettings = () => {
    const cfg = settings.siteConfig;
    return (
      <div className="space-y-4">
        {sectionCard(t('Platform Settings'), t('Global values used across the whole platform'), (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">{t('Site Name')}</label>
              <input value={cfg?.siteName || ''} onChange={e => updateSettings({ siteConfig: { ...(cfg || {}), siteName: e.target.value } })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">{t('Tagline')}</label>
              <input value={cfg?.tagline || ''} onChange={e => updateSettings({ siteConfig: { ...(cfg || {}), tagline: e.target.value } })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">{t('Support Phone')}</label>
              <input value={cfg?.supportPhone || ''} onChange={e => updateSettings({ siteConfig: { ...(cfg || {}), supportPhone: e.target.value } })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">{t('Support Email')}</label>
              <input value={cfg?.supportEmail || ''} onChange={e => updateSettings({ siteConfig: { ...(cfg || {}), supportEmail: e.target.value } })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">{t('Marketplace Commission (%)')}</label>
              <input value={cfg?.commissionPct || ''} onChange={e => updateSettings({ siteConfig: { ...(cfg || {}), commissionPct: e.target.value } })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">{t('Affiliate Commission (%)')} <span className="font-medium text-gray-400">0-20</span></label>
              <div className="flex gap-2">
                <input type="number" min={0} max={20} step={0.5} value={affCommission}
                  onChange={e => setAffCommission(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                <button
                  onClick={() => {
                    const pct = Math.max(0, Math.min(20, Number(affCommission) || 0));
                    updateSettings({ affiliateCommissionPercent: pct });
                    setAffCommission(String(pct));
                    setSaved(true);
                    window.setTimeout(() => setSaved(false), 2000);
                    logAction('Affiliate Commission', `ROOT_MANDATE set affiliate commission to ${pct}%.`);
                  }}
                  className="px-3 py-2 bg-brand text-white rounded-lg text-xs font-bold shrink-0 cursor-pointer"
                >
                  {t('Save')}
                </button>
              </div>
              <div className="text-[10px] text-gray-400 font-medium mt-1">{t('Affiliate Commission % weka mwenyewe — ROOT pays affiliate referrals manually via M-Pesa.')}</div>
            </div>
          </div>
        ))}
        {sectionCard(t('Role Permissions'), t('Company & staff access templates (not editable here)'), (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(rolePermissions).map(([role, pages]) => (
              <div key={role} className="border border-gray-200 rounded-lg p-3">
                <div className="font-bold text-gray-900 text-xs mb-1.5">{role}</div>
                <div className="flex flex-wrap gap-1">
                  {pages.slice(0, 8).map(pg => <span key={pg} className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">{pg}</span>)}
                  {pages.length > 8 && <span className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">+{pages.length - 8}</span>}
                </div>
              </div>
            ))}
          </div>
        ))}
        {sectionCard(t('System Data'), t('Live resource usage reported by the PHP/MySQL backend'), (
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-gray-50 rounded-lg p-3">
              <HardDrive className="w-5 h-5 text-brand mx-auto mb-1" />
              <div className="text-lg font-extrabold text-gray-900">{loadingStats ? '…' : (stats?.db || '—')}</div>
              <div className="text-[10px] font-semibold text-gray-500">{t('Database Size')}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <Database className="w-5 h-5 text-brand mx-auto mb-1" />
              <div className="text-lg font-extrabold text-gray-900">{loadingStats ? '…' : (stats?.files || '—')}</div>
              <div className="text-[10px] font-semibold text-gray-500">{t('Data Files')}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <Server className="w-5 h-5 text-brand mx-auto mb-1" />
              <div className="text-lg font-extrabold text-gray-900">{loadingStats ? '…' : (stats?.products ?? '—')}</div>
              <div className="text-[10px] font-semibold text-gray-500">{t('Stored Products')}</div>
            </div>
          </div>
        ))}
        {appVersion && (
          <div className="bg-gradient-to-r from-brand/5 to-brand/10 border border-brand/20 rounded-xl p-4 mt-4">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-brand" />
              <span className="text-xs font-bold text-brand uppercase">{t('System Version')}</span>
            </div>
            <div className="flex items-baseline gap-3">
              <div className="text-2xl font-extrabold text-gray-900">v{appVersion.version}</div>
              <div className="text-xs text-gray-500 font-medium">{appVersion.name}</div>
            </div>
            <div className="text-[11px] text-gray-600 mt-1">
              {t('Released')}: {appVersion.date}
              {appVersion.description && <span className="ml-2 text-gray-400">— {appVersion.description}</span>}
            </div>
            <a href="https://github.com/williamnyanga747-design/tradecore/releases" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold text-brand hover:underline">
              {t('View all releases')} <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>
    );
  };

  const renderLogs = () => {
    const rows = combinedLogs.filter(l => logFilter === 'all' ? true : l.kind === logFilter);
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('Search logs by user or action...')} className="outline-none text-sm font-medium" />
          </div>
          <div className="flex items-center gap-1.5">
            {(['all', 'audit', 'security'] as const).map(f => (
              <button key={f} onClick={() => setLogFilter(f)} className={`px-3 py-2 rounded-lg text-xs font-bold capitalize ${logFilter === f ? 'bg-brand text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{f}</button>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2.5">{t('Time')}</th>
                <th className="px-3 py-2.5">{t('User')}</th>
                <th className="px-3 py-2.5">{t('Action')}</th>
                <th className="px-3 py-2.5">{t('Details')}</th>
                <th className="px-3 py-2.5">{t('Type')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.slice(0, 80).map(l => (
                <tr key={l.id} className="hover:bg-gray-50 align-top">
                  <td className="px-3 py-2 text-gray-500 font-medium whitespace-nowrap">{formatDate(l.time)}</td>
                  <td className="px-3 py-2 font-bold text-gray-800 whitespace-nowrap">{l.user}</td>
                  <td className="px-3 py-2 font-semibold text-gray-900 whitespace-nowrap">{l.action}</td>
                  <td className="px-3 py-2 text-gray-500 max-w-[420px] break-words">{l.details || '—'}</td>
                  <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${l.kind === 'audit' ? 'bg-indigo-100 text-indigo-700' : 'bg-red-100 text-red-700'}`}>{l.kind === 'audit' ? t('Audit') : t('Security')}</span></td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400 font-semibold">{t('No logs match your filters.')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderCurrencies = () => {
    const saveCurrencies = (next: Currency[]) => updateSettings({ currencies: next });
    const addCurrency = () => {
      const code = newCurr.code.trim().toUpperCase();
      const rate = parseFloat(newCurr.exchangeRate);
      if (!code || isNaN(rate) || rate <= 0) return;
      if (currencies.some(c => c.code.toUpperCase() === code)) return;
      const entry: Currency = {
        id: Math.max(0, ...currencies.map(c => c.id)) + 1,
        code,
        symbol: newCurr.symbol.trim() || code,
        name: newCurr.name.trim() || code,
        exchangeRate: rate,
        isActive: newCurr.isActive
      };
      saveCurrencies([...currencies, entry]);
      logAction('Currency Created', `ROOT_MANDATE added currency ${code} at ${rate} TZS.`);
      setNewCurr({ code: '', symbol: '', name: '', exchangeRate: '', isActive: true });
    };
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="font-bold text-gray-900 text-sm mb-1">{t('Billing Currencies')}</div>
          <div className="text-[11px] text-gray-500 font-medium mb-3">{t('TZS is the base currency (rate 1). Exchange rate = 1 unit of this currency in TZS. Active currencies appear in the registration billing selector.')}</div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <input value={newCurr.code} onChange={e => setNewCurr({ ...newCurr, code: e.target.value })} placeholder={t('Code e.g. RWF')} className="px-2.5 py-2 border border-gray-300 rounded-lg text-xs outline-none" />
            <input value={newCurr.symbol} onChange={e => setNewCurr({ ...newCurr, symbol: e.target.value })} placeholder={t('Symbol e.g. Frw')} className="px-2.5 py-2 border border-gray-300 rounded-lg text-xs outline-none" />
            <input value={newCurr.name} onChange={e => setNewCurr({ ...newCurr, name: e.target.value })} placeholder={t('Name e.g. Rwandan Franc')} className="px-2.5 py-2 border border-gray-300 rounded-lg text-xs outline-none" />
            <input value={newCurr.exchangeRate} onChange={e => setNewCurr({ ...newCurr, exchangeRate: e.target.value })} placeholder={t('Rate in TZS')} type="number" className="px-2.5 py-2 border border-gray-300 rounded-lg text-xs outline-none" />
            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600 px-2"><input type="checkbox" checked={newCurr.isActive} onChange={e => setNewCurr({ ...newCurr, isActive: e.target.checked })} /> {t('Active')}</label>
            <button onClick={addCurrency} className="px-3 py-2 bg-brand text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 justify-center"><Plus className="w-4 h-4" /> {t('Add Currency')}</button>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2.5">{t('Currency')}</th>
                <th className="px-3 py-2.5">{t('Code')}</th>
                <th className="px-3 py-2.5">{t('Rate (1 unit = TZS)')}</th>
                <th className="px-3 py-2.5">{t('Active')}</th>
                <th className="px-3 py-2.5 text-right">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currencies.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><Coins className="w-4 h-4" /></div>
                      <div>
                        <div className="font-bold text-gray-900">{c.symbol}</div>
                        <div className="text-[10px] text-gray-400 font-medium">{c.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-mono font-bold text-gray-700">{c.code}</td>
                  <td className="px-3 py-2.5">
                    <input
                      type="number"
                      step="0.01"
                      value={c.exchangeRate}
                      onChange={e => { const next = currencies.map(x => x.id === c.id ? { ...x, exchangeRate: parseFloat(e.target.value) || 0 } : x); saveCurrencies(next); }}
                      className="w-28 px-2 py-1.5 border border-gray-300 rounded text-xs outline-none"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => { const next = currencies.map(x => x.id === c.id ? { ...x, isActive: !x.isActive } : x); saveCurrencies(next); logAction('Currency Updated', `ROOT_MANDATE ${c.isActive ? 'deactivated' : 'activated'} currency ${c.code}.`); }}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {c.isActive ? t('Active') : t('Inactive')}
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {c.code !== 'TZS' && (
                        <button title={t('Delete Currency')} onClick={() => { saveCurrencies(currencies.filter(x => x.id !== c.id)); logAction('Currency Deleted', `ROOT_MANDATE removed currency ${c.code}.`); }} className="p-1.5 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {currencies.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400 font-semibold">{t('No currencies configured.')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderSubscriptionPlans = () => {
    const savePlans = (next: TradeSubscriptionPlan[]) => updateSettings({ subscriptionPlans: next });
    const addPlan = () => {
      const name = newPlanForm.name.trim();
      const slug = (newPlanForm.slug.trim() || name.toLowerCase().replace(/\s+/g, '_')) || undefined;
      const base = parseFloat(newPlanForm.basePriceTZS);
      const pct = parseFloat(newPlanForm.commissionPercent);
      const max = parseInt(newPlanForm.maxProducts, 10);
      const days = parseInt(newPlanForm.durationDays, 10);
      if (!name || !slug || isNaN(base) || isNaN(pct) || isNaN(max) || isNaN(days)) return;
      if (subscriptionPlans.some(p => p.slug === slug)) return;
      const plan: TradeSubscriptionPlan = {
        id: Math.max(0, ...subscriptionPlans.map(p => p.id)) + 1,
        name,
        slug,
        type: newPlanForm.type,
        basePriceTZS: base,
        commissionPercent: newPlanForm.type === 'direct' ? 0 : pct,
        maxProducts: max,
        durationDays: days,
        features: newPlanForm.features.split('\n').map(s => s.trim()).filter(Boolean),
        isActive: newPlanForm.isActive
      };
      savePlans([...subscriptionPlans, plan]);
      logAction('Subscription Plan Created', `ROOT_MANDATE created plan ${name} (${plan.type}, TZS ${base}, ${plan.commissionPercent}%).`);
      setNewPlanForm({ name: '', slug: '', type: 'commission' as const, basePriceTZS: '', commissionPercent: '', maxProducts: '', durationDays: '', features: '', isActive: true });
    };
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="font-bold text-gray-900 text-sm mb-1">{t('Subscription Plans')}</div>
          <div className="text-[11px] text-gray-500 font-medium mb-3">{t('Direct plans charge a flat fee (0% commission). Commission plans charge a percentage per platform order. The rate is frozen at purchase time for each seller.')}</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
            <input value={newPlanForm.name} onChange={e => setNewPlanForm({ ...newPlanForm, name: e.target.value })} placeholder={t('Plan name e.g. Biashara Direct')} className="px-2.5 py-2 border border-gray-300 rounded-lg text-xs outline-none" />
            <input value={newPlanForm.slug} onChange={e => setNewPlanForm({ ...newPlanForm, slug: e.target.value })} placeholder={t('Slug e.g. direct_premium')} className="px-2.5 py-2 border border-gray-300 rounded-lg text-xs outline-none" />
            <input value={newPlanForm.basePriceTZS} onChange={e => setNewPlanForm({ ...newPlanForm, basePriceTZS: e.target.value })} placeholder={t('Price (TZS)')} type="number" className="px-2.5 py-2 border border-gray-300 rounded-lg text-xs outline-none" />
            <input value={newPlanForm.durationDays} onChange={e => setNewPlanForm({ ...newPlanForm, durationDays: e.target.value })} placeholder={t('Days e.g. 30')} type="number" className="px-2.5 py-2 border border-gray-300 rounded-lg text-xs outline-none" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-2">
            <select value={newPlanForm.type} onChange={e => setNewPlanForm({ ...newPlanForm, type: e.target.value as 'direct' | 'commission' })} className="px-2.5 py-2 border border-gray-300 rounded-lg text-xs outline-none font-bold">
              <option value="commission">{t('Commission')}</option>
              <option value="direct">{t('Direct (Pay Seller)')}</option>
            </select>
            <input value={newPlanForm.commissionPercent} onChange={e => setNewPlanForm({ ...newPlanForm, commissionPercent: e.target.value })} placeholder={t('Commission %')} type="number" className="px-2.5 py-2 border border-gray-300 rounded-lg text-xs outline-none" />
            <input value={newPlanForm.maxProducts} onChange={e => setNewPlanForm({ ...newPlanForm, maxProducts: e.target.value })} placeholder={t('Max products')} type="number" className="px-2.5 py-2 border border-gray-300 rounded-lg text-xs outline-none" />
            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600 px-2"><input type="checkbox" checked={newPlanForm.isActive} onChange={e => setNewPlanForm({ ...newPlanForm, isActive: e.target.checked })} /> {t('Active')}</label>
            <button onClick={addPlan} className="px-3 py-2 bg-brand text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 justify-center"><Plus className="w-4 h-4" /> {t('Add Plan')}</button>
          </div>
          <div>
            <label className="text-[11px] font-bold text-gray-600 block mb-1">{t('Features (one per line)')}</label>
            <textarea rows={3} value={newPlanForm.features} onChange={e => setNewPlanForm({ ...newPlanForm, features: e.target.value })} placeholder={t('Each line becomes a plan feature bullet.')} className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-xs outline-none resize-none" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {subscriptionPlans.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="font-bold text-gray-900 text-sm flex items-center gap-2">
                    {p.name}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.type === 'direct' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'}`}>
                      {p.type === 'direct' ? t('Direct') : t('Commission')}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-400 font-medium font-mono">{p.slug}</div>
                </div>
                <button title={t('Delete Plan')} onClick={() => { savePlans(subscriptionPlans.filter(x => x.id !== p.id)); logAction('Subscription Plan Deleted', `ROOT_MANDATE removed plan ${p.name}.`); }} className="p-1.5 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 block mb-0.5">{t('Price (TZS)')}</label>
                  <input type="number" value={p.basePriceTZS} onChange={e => savePlans(subscriptionPlans.map(x => x.id === p.id ? { ...x, basePriceTZS: parseFloat(e.target.value) || 0 } : x))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 block mb-0.5">{t('Commission %')}</label>
                  <input type="number" min={0} max={100} value={p.commissionPercent} disabled={p.type === 'direct'} onChange={e => savePlans(subscriptionPlans.map(x => x.id === p.id ? { ...x, commissionPercent: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) } : x))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs outline-none disabled:bg-gray-50 disabled:text-gray-400" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 block mb-0.5">{t('Max products')}</label>
                  <input type="number" value={p.maxProducts} onChange={e => savePlans(subscriptionPlans.map(x => x.id === p.id ? { ...x, maxProducts: parseInt(e.target.value, 10) || 0 } : x))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 block mb-0.5">{t('Days')}</label>
                  <input type="number" value={p.durationDays} onChange={e => savePlans(subscriptionPlans.map(x => x.id === p.id ? { ...x, durationDays: parseInt(e.target.value, 10) || 0 } : x))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 block mb-0.5">{t('Type')}</label>
                  <select value={p.type} onChange={e => { const type = e.target.value as 'direct' | 'commission'; savePlans(subscriptionPlans.map(x => x.id === p.id ? { ...x, type, commissionPercent: type === 'direct' ? 0 : x.commissionPercent } : x)); }} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs outline-none font-bold">
                    <option value="commission">{t('Commission')}</option>
                    <option value="direct">{t('Direct')}</option>
                  </select>
                </div>
                <div className="flex items-end pb-1.5">
                  <button onClick={() => { const next = subscriptionPlans.map(x => x.id === p.id ? { ...x, isActive: !x.isActive } : x); savePlans(next); logAction('Plan Updated', `ROOT_MANDATE ${p.isActive ? 'deactivated' : 'activated'} plan ${p.name}.`); }} className={`px-2 py-1 rounded-full text-[10px] font-bold ${p.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>{p.isActive ? t('Active') : t('Inactive')}</button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {p.features.map((f, i) => <span key={i} className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">{f}</span>)}
              </div>
            </div>
          ))}
          {subscriptionPlans.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center text-xs font-semibold text-gray-400">{t('No subscription plans configured.')}</div>
          )}
        </div>
      </div>
    );
  };

  const renderSubscriptions = () => {
    const rows = companySubscriptions.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const totalTzs = rows.filter(s => s.status === 'active').reduce((sum, s) => sum + (s.amountTzs || 0), 0);
    const subStatusCls: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-800',
      active: 'bg-green-100 text-green-800',
      expired: 'bg-red-100 text-red-800'
    };
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statCard(<CreditCard className="w-5 h-5 text-white" />, rows.length, t('Total Subscriptions'), 'bg-indigo-500')}
          {statCard(<Clock3 className="w-5 h-5 text-white" />, rows.filter(s => s.status === 'pending').length, t('Pending Payments'), 'bg-amber-500')}
          {statCard(<CheckCircle2 className="w-5 h-5 text-white" />, rows.filter(s => s.status === 'active').length, t('Active Subscriptions'), 'bg-green-600')}
          {statCard(<Wallet className="w-5 h-5 text-white" />, 'TZS ' + totalTzs.toLocaleString(), t('Active Billing (TZS)'), 'bg-purple-500')}
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2.5">{t('Company')}</th>
                <th className="px-3 py-2.5">{t('Plan')}</th>
                <th className="px-3 py-2.5">{t('Amount')}</th>
                <th className="px-3 py-2.5">{t('Status')}</th>
                <th className="px-3 py-2.5">{t('Period')}</th>
                <th className="px-3 py-2.5 text-right">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(s => {
                const company = companies.find(c => sameId(c.id, s.companyId));
                const label = company ? company.name : `Company #${s.companyId}`;
                return (
                  <tr key={s.id} className="hover:bg-gray-50 align-top">
                    <td className="px-3 py-2.5">
                      <div className="font-bold text-gray-900 max-w-[180px] truncate">{label}</div>
                      <div className="text-[10px] text-gray-400 font-medium">{company?.region || '—'}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-bold text-gray-900">{s.planName}</div>
                      <div className="text-[10px] text-gray-400 font-medium">{s.planType === 'direct' ? t('Direct') : `${t('Commission')} ${s.commissionPercentSnapshot}%`}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-bold text-gray-900">{s.currencyCode} {Number(s.amountPaid || 0).toLocaleString()}</div>
                      <div className="text-[10px] text-gray-400 font-medium">≈ TZS {Number(s.amountTzs || 0).toLocaleString()}</div>
                    </td>
                    <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${subStatusCls[s.status]}`}>{s.status}</span></td>
                    <td className="px-3 py-2.5 text-gray-600 font-medium">
                      <div>{formatDate(s.startsAt)}</div>
                      <div>→ {formatDate(s.endsAt)}</div>
                      <div className="text-[10px] text-gray-400">{s.paymentReference || '—'}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        {s.status !== 'active' && (
                          <button onClick={() => onApproveCompanySubscription(s.companyId)} title={t('Approve & Activate')} className="px-2 py-1 bg-green-600 text-white rounded text-[10px] font-bold hover:bg-green-700">{t('Approve')}</button>
                        )}
                        <button onClick={() => onExtendCompanySubscription(s.companyId, 30)} title={t('Extend 30 days')} className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-[10px] font-bold hover:bg-indigo-100">{t('Extend +30')}</button>
                        <button onClick={() => setRejectNote({ companyId: s.companyId, companyName: label })} title={t('Reject payment')} className="px-2 py-1 bg-red-50 text-red-600 rounded text-[10px] font-bold hover:bg-red-100">{t('Reject')}</button>
                        <select
                          value=""
                          onChange={e => { if (e.target.value) onChangeCompanyPlan(s.companyId, Number(e.target.value)); }}
                          className="px-1.5 py-1 border border-gray-300 rounded text-[10px] font-bold outline-none bg-white"
                        >
                          <option value="">{t('Change plan…')}</option>
                          {subscriptionPlans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-10 text-center text-gray-400 font-semibold">{t('No subscription payments submitted yet.')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {rejectNote && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3"><ShieldBan className="w-6 h-6" /></div>
              <div className="font-bold text-gray-900 text-center">{t('Reject payment for')} {rejectNote.companyName}?</div>
              <div className="text-xs text-gray-500 text-center mt-1 font-medium">{t('The seller can resubmit after fixing the issue. Optionally add a note they will see.')}</div>
              <input
                value={rejectNote.reason || ''}
                onChange={e => setRejectNote({ ...rejectNote, reason: e.target.value })}
                placeholder={t('Reason (optional)')}
                className="w-full mt-3 px-3 py-2 border border-gray-300 rounded-lg text-xs outline-none"
              />
              <div className="flex gap-2 mt-4">
                <button onClick={() => setRejectNote(null)} className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-bold text-gray-700">{t('Cancel')}</button>
                <button onClick={() => { onRejectCompanySubscription(rejectNote.companyId, rejectNote.reason || undefined); setRejectNote(null); }} className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold">{t('Reject')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderOrders = () => {
    const rows = orders.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const totalCommission = rows.reduce((sum, o) => sum + (o.commissionAmount || 0), 0);
    const pendingPayout = rows.filter(o => (o.commissionAmount || 0) > 0 && o.payToSellerDone !== true).length;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statCard(<ShoppingCart className="w-5 h-5 text-white" />, rows.length, t('Platform Orders'), 'bg-blue-500')}
          {statCard(<BadgePercent className="w-5 h-5 text-white" />, 'TZS ' + totalCommission.toLocaleString(), t('Commission Collected'), 'bg-purple-500')}
          {statCard(<Wallet className="w-5 h-5 text-white" />, pendingPayout, t('Awaiting Seller Payout'), 'bg-amber-500')}
          {statCard(<CalendarClock className="w-5 h-5 text-white" />, rows[0] ? formatDate(rows[0].createdAt) : '—', t('Latest Order'), 'bg-green-500')}
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2.5">{t('Order')}</th>
                <th className="px-3 py-2.5">{t('Company')}</th>
                <th className="px-3 py-2.5">{t('Customer')}</th>
                <th className="px-3 py-2.5 text-right">{t('Total (TZS)')}</th>
                <th className="px-3 py-2.5 text-center">{t('Commission %')}</th>
                <th className="px-3 py-2.5 text-right">{t('Commission (TZS)')}</th>
                <th className="px-3 py-2.5 text-right">{t('Seller Payout')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.slice(0, 120).map(o => {
                const company = companies.find(c => sameId(c.id, o.companyId));
                const pct = o.commissionPercent || 0;
                return (
                  <tr key={o.id} className="hover:bg-gray-50 align-top">
                    <td className="px-3 py-2.5">
                      <div className="font-mono font-bold text-gray-900">{o.orderNumber}</div>
                      <div className="text-[10px] text-gray-400 font-medium">{formatDate(o.createdAt)}</div>
                    </td>
                    <td className="px-3 py-2.5 text-gray-700 font-semibold">{company ? company.name : `#${o.companyId}`}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-gray-700">{o.customerName}</div>
                      <div className="text-[10px] text-gray-400 font-medium">{o.customerPhone}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-gray-900">{Number(o.totalAmount || 0).toLocaleString()}</td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={pct}
                        onChange={e => {
                          const nextPct = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                          onUpdateOrders(orders.map(x => x.id === o.id ? { ...x, commissionPercent: nextPct, commissionAmount: nextPct > 0 ? Math.round((x.totalAmount || 0) * nextPct / 100) : undefined } : x));
                        }}
                        className="w-16 px-1.5 py-1 border border-gray-300 rounded text-xs outline-none text-center"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-purple-700">{(o.commissionAmount || 0).toLocaleString()}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end">
                        <button
                          onClick={() => onUpdateOrders(orders.map(x => x.id === o.id ? { ...x, payToSellerDone: x.payToSellerDone !== true } : x))}
                          className={`px-2 py-1 rounded-full text-[10px] font-bold ${o.payToSellerDone === true ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}
                          disabled={(o.commissionAmount || 0) <= 0}
                        >
                          {o.payToSellerDone === true ? t('Paid to Seller') : t('Not Paid')}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-gray-400 font-semibold">{t('No marketplace orders yet.')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ---- FEATURE 3: Reviews moderation ----
  const renderReviews = () => {
    const statusFiltered = reviews.filter(r => reviewFilter === 'all' || r.status === reviewFilter);
    const rows = statusFiltered.filter(r => reviewCompanyFilter === 0 || r.companyId === reviewCompanyFilter);
    const pendingCount = reviews.filter(r => r.status === 'pending').length;

    const chip = (active: boolean) => `px-3 py-1.5 text-[10px] font-black rounded-lg transition cursor-pointer ${active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`;

    return (
      <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-black text-gray-900">{t('Review Moderation')}</h3>
            <p className="text-[11px] text-gray-500 font-medium mt-0.5">
              {pendingCount > 0 ? `${pendingCount} ${t('reviews pending approval')}` : t('All reviews have been reviewed')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select value={reviewCompanyFilter} onChange={e => setReviewCompanyFilter(Number(e.target.value))} className="px-3 py-2 border border-gray-200 rounded-lg text-[11px] font-bold text-gray-700 outline-none cursor-pointer bg-white">
              <option value={0}>{t('All companies')}</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {pendingCount > 0 && (
              <button
                onClick={() => {
                  const ids = reviews.filter(r => r.status === 'pending' && (reviewCompanyFilter === 0 || r.companyId === reviewCompanyFilter)).map(r => r.id);
                  ids.forEach(id => onUpdateReviewStatus(id, 'approved'));
                  logAction('Reviews Bulk Approved', `Approved ${ids.length} pending reviews.`);
                }}
                className="px-3 py-2 text-[10px] font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer"
              >
                {t('Approve All Pending')} ({pendingCount})
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-1.5 bg-gray-100 rounded-lg p-1 w-fit">
          {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
            <button key={f} onClick={() => setReviewFilter(f)} className={chip(reviewFilter === f)}>
              {f === 'all' ? t('All') : f === 'pending' ? t('Pending') : f === 'approved' ? t('Approved') : t('Rejected')}
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <div className="text-center py-12 text-gray-400 font-semibold text-xs">{t('No reviews found.')}</div>
        ) : (
          <div className="space-y-2.5">
            {rows.map(r => {
              const product = r.productId !== null ? products.find(p => p.id === r.productId) : undefined;
              const company = companies.find(c => c.id === r.companyId);
              return (
                <div key={r.id} className="rounded-xl border border-gray-100 p-3.5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-gray-900">{r.reviewerName}</span>
                        <Stars rating={r.rating} size={13} />
                        {r.isVerifiedBuyer && (
                          <span className="inline-flex items-center gap-0.5 text-[8px] font-black uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5" /> {t('Verified Buyer')}
                          </span>
                        )}
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${STATUS_BADGE[r.status] || STATUS_BADGE.pending}`}>
                          {t(STATUS_LABEL[r.status] || STATUS_LABEL.pending)}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-400 font-semibold mt-1">
                        {product ? product.name : t('Store review')} · {company ? company.name : `#${r.companyId}`} · {formatDate(r.createdAt)}
                        {r.ipAddress && <span className="text-gray-300"> · IP {r.ipAddress}</span>}
                      </div>
                      {r.comment && <p className="text-[11px] text-gray-600 font-medium mt-1.5 leading-relaxed">"{r.comment}"</p>}
                      {r.reviewerPhone && <div className="text-[10px] text-gray-400 font-semibold mt-1">{t('Phone')}: {r.reviewerPhone}</div>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.status !== 'approved' && (
                        <button onClick={() => { onUpdateReviewStatus(r.id, 'approved'); logAction('Review Approved', `Approved review #${r.id} by ${r.reviewerName} (${companyName(companies, r.companyId)}).`); }} className="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer">
                          <ThumbsUp className="w-3 h-3" /> {t('Approve')}
                        </button>
                      )}
                      {r.status !== 'rejected' && (
                        <button onClick={() => onUpdateReviewStatus(r.id, 'rejected')} className="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-black text-red-600 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer">
                          <ThumbsDown className="w-3 h-3" /> {t('Reject')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ---- FEATURE 4: Companies map ----
  const renderCompaniesMap = () => {
    const withCoords = companies.filter(c => typeof c.latitude === 'number' && typeof c.longitude === 'number');
    const selected = mapCompanyFilter === 0 ? withCoords : withCoords.filter(c => c.id === mapCompanyFilter);
    const markers = selected.map(c => ({
      lat: c.latitude as number,
      lng: c.longitude as number,
      title: c.name,
      popupHtml: `<b>${c.name.replace(/</g, '&lt;')}</b><br/><span style="font-size:11px;color:#666;">${[c.region, c.district, c.ward].filter(Boolean).join(', ')}</span>`
    }));

    return (
      <div className="space-y-4">
        <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-black text-gray-900">{t('Store Locations')}</h3>
              <p className="text-[11px] text-gray-500 font-medium mt-0.5">{withCoords.length} / {companies.length} {t('stores have a map pin')}</p>
            </div>
            <select value={mapCompanyFilter} onChange={e => setMapCompanyFilter(Number(e.target.value))} className="px-3 py-2 border border-gray-200 rounded-lg text-[11px] font-bold text-gray-700 outline-none cursor-pointer bg-white">
              <option value={0}>{t('All stores')}</option>
              {withCoords.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {withCoords.length === 0 ? (
            <div className="text-center py-12 text-gray-400 font-semibold text-xs">
              {t('No stores have set a map location yet.')}
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden border border-gray-100">
              <LeafletMap
                center={selected.length === 1 ? { lat: selected[0].latitude as number, lng: selected[0].longitude as number } : { lat: -6.7924, lng: 39.2083 }}
                markers={markers}
                zoom={6}
                className="h-[420px] w-full"
                scrollWheelZoom
              />
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <h4 className="text-xs font-black text-gray-900 mb-3">{t('Stores with map pins')}</h4>
          <div className="grid md:grid-cols-2 gap-2">
            {withCoords.map(c => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl border border-gray-100 p-3">
                <div className="p-2 rounded-lg bg-amber-50 text-amber-600"><MapPin className="w-4 h-4" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-black text-gray-900 truncate flex items-center gap-1.5">
                    {c.name} {c.isVerified && <VerifiedBadge milk />}
                  </div>
                  <div className="text-[10px] text-gray-400 font-semibold">{c.latitude?.toFixed(4)}, {c.longitude?.toFixed(4)}</div>
                </div>
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${c.latitude},${c.longitude}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-black text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer">
                  <Navigation className="w-3 h-3" /> {t('Directions')}
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ---- FEATURE 5: Platform analytics (ROOT only) ----
  const renderRootAnalytics = () => {
    const companyProducts = (cid: number) => (cid === 0 ? products : products.filter(p => p.companyId === cid));
    const filteredViews = (cid: number) => (cid === 0 ? productViews : productViews.filter(v => v.companyId === cid));
    const filteredClicks = (cid: number) => (cid === 0 ? clicks.filter(c => c.type === 'whatsapp') : clicks.filter(c => c.type === 'whatsapp' && c.productId && products.some(p => p.id === c.productId && p.companyId === cid)));

    const nowMs = Date.now();
    const cutoff = nowMs - analyticsRange * 24 * 60 * 60 * 1000;
    const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const days: string[] = [];
    for (let i = analyticsRange - 1; i >= 0; i--) days.push(dayKey(new Date(nowMs - i * 24 * 60 * 60 * 1000)));

    const views = filteredViews(analyticsCompanyId);
    const clicksArr = filteredClicks(analyticsCompanyId);
    const series = [
      { label: t('Product Views'), values: days.map(d => views.filter(v => dayKey(new Date(v.viewedAt)) === d).length), color: '#f59e0b' },
      { label: t('WhatsApp Clicks'), values: days.map(d => clicksArr.filter(c => dayKey(new Date(c.createdAt)) === d).length), color: '#22c55e' }
    ];

    const totalViews = views.length;
    const totalClicks = clicksArr.length;
    const totalReviews = reviews.length;
    const approved = reviews.filter(r => r.status === 'approved');
    const avgRating = approved.length ? approved.reduce((s, r) => s + r.rating, 0) / approved.length : 0;

    const topProducts = companyProducts(analyticsCompanyId).map(p => {
      const v = filteredViews(analyticsCompanyId).filter(x => x.productId === p.id).length;
      const c = filteredClicks(analyticsCompanyId).filter(x => x.productId === p.id).length;
      return { product: p, views: v, clicks: c, company: companyName(companies, p.companyId) };
    }).sort((a, b) => (b.views + b.clicks * 2) - (a.views + a.clicks * 2)).slice(0, 10);

    const stat = (label: string, value: string | number, cls: string) => (
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${cls}`}>
          {label === t('Product Views') ? <Eye className="w-4.5 h-4.5" /> : label === t('WhatsApp Clicks') ? <MessageCircle className="w-4.5 h-4.5" /> : label === t('Reviews') ? <Star className="w-4.5 h-4.5" /> : <Activity className="w-4.5 h-4.5" />}
        </div>
        <div className="text-xl font-black text-gray-900">{value}</div>
        <div className="text-[10px] font-black uppercase tracking-wider text-gray-400">{label}</div>
      </div>
    );

    return (
      <div className="space-y-4">
        <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-black text-gray-900">{t('Marketplace Analytics')}</h3>
              <p className="text-[11px] text-gray-500 font-medium mt-0.5">{t('All stores · views & WhatsApp clicks (ROOT access only)')}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select value={analyticsCompanyId} onChange={e => setAnalyticsCompanyId(Number(e.target.value))} className="px-3 py-2 border border-gray-200 rounded-lg text-[11px] font-bold text-gray-700 outline-none cursor-pointer bg-white">
                <option value={0}>{t('All companies')}</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                {([7, 14, 30] as const).map(r => (
                  <button key={r} onClick={() => setAnalyticsRange(r)} className={`px-3 py-1.5 text-[10px] font-black rounded-md transition cursor-pointer ${analyticsRange === r ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                    {r} {t('days')}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stat(t('Product Views'), totalViews, 'bg-amber-50 text-amber-600')}
            {stat(t('WhatsApp Clicks'), totalClicks, 'bg-green-50 text-green-600')}
            {stat(t('Reviews'), totalReviews, 'bg-purple-50 text-purple-600')}
            {stat(t('Average Rating'), approved.length ? avgRating.toFixed(2) : '—', 'bg-blue-50 text-blue-600')}
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <h4 className="text-xs font-black text-gray-900 mb-3">{t('Views & WhatsApp Clicks')} — {t('last')} {analyticsRange} {t('days')}</h4>
          <AnalyticsLineChart labels={days} series={series} height={260} emptyText={t('No activity in this period.')} />
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <h4 className="text-xs font-black text-gray-900 mb-3">{t('Top Products (all stores)')}</h4>
          {topProducts.length === 0 ? (
            <div className="text-center py-8 text-gray-400 font-semibold text-xs">{t('No products yet.')}</div>
          ) : (
            <div className="space-y-2">
              {topProducts.map(({ product, views, clicks: c, company }, i) => (
                <div key={product.id} className="flex items-center gap-3 rounded-xl border border-gray-100 p-3">
                  <span className="w-6 text-center text-[11px] font-black text-gray-400">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-black text-gray-900 truncate">{product.name}</div>
                    <div className="text-[10px] text-gray-400 font-semibold">{company}</div>
                  </div>
                  <div className="text-[10px] font-black text-gray-500 flex items-center gap-1 w-16 justify-end"><Eye className="w-3 h-3" /> {views}</div>
                  <div className="text-[10px] font-black text-green-600 flex items-center gap-1 w-16 justify-end"><MessageCircle className="w-3 h-3" /> {c}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderQrAnalytics = () => {
    const totalScans = (companies || []).reduce((s, c) => s + (c.qrScans || 0), 0);
    const withQr = (companies || []).filter(c => c.qrCodeToken);
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl p-4 text-white">
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{t('Stores with QR')}</div>
            <div className="text-2xl font-black mt-0.5">{withQr.length} / {(companies || []).length}</div>
          </div>
          <div className="bg-gradient-to-r from-emerald-700 to-green-700 rounded-xl p-4 text-white">
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{t('Total QR Scans')}</div>
            <div className="text-2xl font-black mt-0.5">{totalScans}</div>
          </div>
          <div className="bg-gradient-to-r from-teal-700 to-cyan-700 rounded-xl p-4 text-white">
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{t('QR Affiliate Scans')}</div>
            <div className="text-2xl font-black mt-0.5">{(qrScans || []).filter(s => s.isAffiliate).length}</div>
          </div>
        </div>
        {sectionCard(t('QR Scan Analytics'), t('QR CODE YA DUKA LA MTAA — scans per store & recent activity.'), (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-3 font-bold">{t('Store')}</th>
                  <th className="py-2 pr-3 font-bold">{t('Token')}</th>
                  <th className="py-2 pr-3 font-bold">{t('QR Scans')}</th>
                  <th className="py-2 font-bold">{t('QR5 Discount')}</th>
                </tr>
              </thead>
              <tbody>
                {withQr.map(c => (
                  <tr key={c.id} className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-bold text-gray-900">{c.name}</td>
                    <td className="py-2 pr-3 font-mono text-emerald-700">{c.qrCodeToken}</td>
                    <td className="py-2 pr-3 font-black text-gray-800">{c.qrScans || 0}</td>
                    <td className="py-2 font-semibold text-emerald-600">{settings.qr5DiscountPercent ?? 5}%</td>
                  </tr>
                ))}
                {withQr.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-gray-400 font-medium">{t('No stores have generated a QR code yet.')}</td></tr>}
              </tbody>
            </table>
          </div>
        ))}
        {sectionCard(t('Recent QR Scans'), t('Latest scan activity with referral attribution.'), (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-3 font-bold">{t('Store')}</th>
                  <th className="py-2 pr-3 font-bold">{t('Product')}</th>
                  <th className="py-2 pr-3 font-bold">{t('Token')}</th>
                  <th className="py-2 pr-3 font-bold">{t('Via Wakala')}</th>
                  <th className="py-2 font-bold">{t('Time')}</th>
                </tr>
              </thead>
              <tbody>
                {[...(qrScans || [])].slice(0, 50).map(s => (
                  <tr key={s.id} className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-bold text-gray-800">{companyName(companies, s.companyId)}</td>
                    <td className="py-2 pr-3 text-gray-600">{s.productId ? `#${s.productId}` : '—'}</td>
                    <td className="py-2 pr-3 font-mono text-emerald-700">{s.token}</td>
                    <td className="py-2 pr-3">{s.isAffiliate ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">{t('Yes')}</span> : <span className="text-gray-400">—</span>}</td>
                    <td className="py-2 text-gray-500">{formatDate(s.scannedAt)}</td>
                  </tr>
                ))}
                {(qrScans || []).length === 0 && <tr><td colSpan={5} className="py-6 text-center text-gray-400 font-medium">{t('No QR scans yet.')}</td></tr>}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    );
  };

  const renderVoiceSearch = () => {
    const total = (voiceSearches || []).length;
    const matched = (voiceSearches || []).filter(v => v.matches > 0).length;
    const counts: Record<string, number> = {};
    for (const v of voiceSearches || []) {
      const q = (v.query || '').trim().toLowerCase();
      if (!q) continue;
      counts[q] = (counts[q] || 0) + 1;
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-4 text-white">
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{t('Voice Queries')}</div>
            <div className="text-2xl font-black mt-0.5">{total}</div>
          </div>
          <div className="bg-gradient-to-r from-purple-600 to-fuchsia-600 rounded-xl p-4 text-white">
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{t('With Results')}</div>
            <div className="text-2xl font-black mt-0.5">{matched}</div>
          </div>
          <div className="bg-gradient-to-r from-fuchsia-600 to-pink-600 rounded-xl p-4 text-white">
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{t('Match Rate')}</div>
            <div className="text-2xl font-black mt-0.5">{total ? Math.round((matched / total) * 100) : 0}%</div>
          </div>
        </div>
        {sectionCard(t('TAFTA KWA SAUTI'), t('Swahili voice searches — query, transcript, results & time.'), (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-3 font-bold">{t('Query')}</th>
                  <th className="py-2 pr-3 font-bold">{t('Transcript')}</th>
                  <th className="py-2 pr-3 font-bold">{t('Results')}</th>
                  <th className="py-2 font-bold">{t('Time')}</th>
                </tr>
              </thead>
              <tbody>
                {[...(voiceSearches || [])].slice(0, 60).map(v => (
                  <tr key={v.id} className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-black text-gray-800">{v.query || '—'}</td>
                    <td className="py-2 pr-3 text-gray-500 max-w-56 truncate">{v.transcript}</td>
                    <td className="py-2 pr-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${v.matches > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{v.matches}</span>
                    </td>
                    <td className="py-2 text-gray-500">{formatDate(v.createdAt)}</td>
                  </tr>
                ))}
                {total === 0 && <tr><td colSpan={4} className="py-6 text-center text-gray-400 font-medium">{t('No voice searches yet.')}</td></tr>}
              </tbody>
            </table>
          </div>
        ))}
        {sectionCard(t('Top Voice Queries'), t('Most requested Swahili search terms.'), (
          <div className="space-y-2">
            {top.map(([q, c], i) => (
              <div key={i} className="flex items-center justify-between gap-2 border border-gray-100 rounded-lg px-3 py-2">
                <span className="text-xs font-bold text-gray-700"><Mic className="w-3 h-3 inline mr-1.5 text-indigo-500" />{q}</span>
                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{c}</span>
              </div>
            ))}
            {top.length === 0 && <div className="py-6 text-center text-gray-400 font-medium">{t('No data yet.')}</div>}
          </div>
        ))}
      </div>
    );
  };

  const TABS: { key: RootTab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: t('Overview'), icon: <LayoutDashboard className="w-4 h-4" /> },
    { key: 'companies', label: t('Companies'), icon: <Building2 className="w-4 h-4" /> },
    { key: 'products', label: t('Products'), icon: <Package className="w-4 h-4" /> },
    { key: 'users', label: t('Users'), icon: <Users className="w-4 h-4" /> },
    { key: 'leads', label: t('WhatsApp Leads'), icon: <MessageSquare className="w-4 h-4" /> },
    { key: 'currencies', label: t('Currencies'), icon: <Coins className="w-4 h-4" /> },
    { key: 'subscription-plans', label: t('Subscription Plans'), icon: <BadgePercent className="w-4 h-4" /> },
    { key: 'subscriptions', label: t('Subscriptions'), icon: <CreditCard className="w-4 h-4" /> },
    { key: 'orders', label: t('Orders'), icon: <ShoppingCart className="w-4 h-4" /> },
    { key: 'withdrawals', label: t('Withdrawals'), icon: <Wallet className="w-4 h-4" /> },
    { key: 'affiliates', label: t('Affiliates'), icon: <Share2 className="w-4 h-4" /> },
    { key: 'qr-analytics', label: t('QR Analytics'), icon: <QrCode className="w-4 h-4" /> },
    { key: 'voice-search', label: t('Voice Search'), icon: <Mic className="w-4 h-4" /> },
    { key: 'search-synonyms', label: t('Search Synonyms'), icon: <Search className="w-4 h-4" /> },
    { key: 'collections', label: t('Collections'), icon: <Landmark className="w-4 h-4" /> },
    { key: 'collection-settings', label: t('Collection Settings'), icon: <SettingsIcon className="w-4 h-4" /> },
    { key: 'webhook-logs', label: t('Webhook Logs'), icon: <WebhookIcon className="w-4 h-4" /> },
    { key: 'phase2c', label: t('Phase 2C'), icon: <HandCoins className="w-4 h-4" /> },
    { key: 'reviews', label: t('Reviews'), icon: <Star className="w-4 h-4" /> },
    { key: 'map', label: t('Store Map'), icon: <MapPin className="w-4 h-4" /> },
    { key: 'analytics', label: t('Analytics'), icon: <Activity className="w-4 h-4" /> },
    { key: 'categories', label: t('Categories'), icon: <FolderTree className="w-4 h-4" /> },
    { key: 'regions', label: t('Regions'), icon: <MapPin className="w-4 h-4" /> },
    { key: 'seo', label: t('SEO & Sitemap'), icon: <Globe className="w-4 h-4" /> },
    { key: 'homepage', label: t('Homepage Editor'), icon: <FileText className="w-4 h-4" /> },
    { key: 'settings', label: t('Settings'), icon: <SettingsIcon className="w-4 h-4" /> },
    { key: 'logs', label: t('Logs'), icon: <ShieldAlert className="w-4 h-4" /> }
  ];

  return (
    <div className="space-y-4">
      {/* ROOT header banner */}
      <div className="bg-gradient-to-r from-amber-500 to-brand rounded-xl p-4 text-white shadow-lg">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center"><Crown className="w-6 h-6" /></div>
            <div>
              <div className="font-extrabold text-lg leading-tight flex items-center gap-2">{t('ROOT MANDATE')} <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">{t('God Mode')}</span></div>
              <div className="text-xs text-white/90 font-medium">{t('Signed in as')} <span className="font-bold">{currentUser.username}</span> ({currentUser.name}) — {t('full control of every company, product, user and setting on tanzaniatradecore.co.tz')}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setTab('overview'); }} className="px-3 py-2 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-bold inline-flex items-center gap-1.5"><RefreshCw className="w-4 h-4" /> {t('Refresh')}</button>
            <button onClick={onReturnToRoot} className="px-3 py-2 bg-white text-amber-700 rounded-lg text-xs font-bold inline-flex items-center gap-1.5"><ArrowLeft className="w-4 h-4" /> {t('Dashboard')}</button>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {TABS.map(tb => tabBtn(tb.key, tb.label, tb.icon))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && renderOverview()}
      {tab === 'companies' && renderCompanies()}
      {tab === 'products' && renderProducts()}
      {tab === 'users' && renderUsers()}
      {tab === 'leads' && renderLeads()}
      {tab === 'currencies' && renderCurrencies()}
      {tab === 'subscription-plans' && renderSubscriptionPlans()}
      {tab === 'subscriptions' && renderSubscriptions()}
      {tab === 'orders' && renderOrders()}
      {tab === 'withdrawals' && renderWithdrawals()}
      {tab === 'affiliates' && renderAffiliates()}
      {tab === 'qr-analytics' && renderQrAnalytics()}
      {tab === 'voice-search' && renderVoiceSearch()}
      {tab === 'search-synonyms' && renderSearchSynonyms()}
      {tab === 'collections' && renderCollections()}
      {tab === 'collection-settings' && renderCollectionSettings()}
      {tab === 'webhook-logs' && renderWebhookLogs()}
      {tab === 'phase2c' && renderPhase2C()}
      {tab === 'reviews' && renderReviews()}
      {tab === 'map' && renderCompaniesMap()}
      {tab === 'analytics' && renderRootAnalytics()}
      {tab === 'categories' && renderCategories()}
      {tab === 'regions' && renderRegions()}
      {tab === 'seo' && renderSeo()}
      {tab === 'homepage' && renderHomepage()}
      {tab === 'settings' && renderSettings()}
      {tab === 'logs' && renderLogs()}

      {/* Confirm modal */}
      {confirmTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3"><Trash2 className="w-6 h-6" /></div>
            <div className="font-bold text-gray-900 text-center">{t('Delete')} {confirmTarget.type}?</div>
            <div className="text-xs text-gray-500 text-center mt-1 font-medium">"{confirmTarget.label}" {t('will be permanently removed. This cannot be undone.')}</div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setConfirmTarget(null)} className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-bold text-gray-700">{t('Cancel')}</button>
              <button onClick={runConfirm} className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold">{t('Delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
