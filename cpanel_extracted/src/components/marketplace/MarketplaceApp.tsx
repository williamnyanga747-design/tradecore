import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, CheckCircle2, Loader2, Clock, ShieldCheck, Zap, XCircle, RefreshCw, ChevronLeft, Landmark, Camera } from 'lucide-react';
import { Company, MarketplaceCustomer, MarketplaceOrder, MarketplaceProduct, Currency, TradeSubscriptionPlan, CompanySubscription, PayNumbersConfig, Review, SearchSynonym, CollectionSetting, CollectionMode, CollectionNetwork, CollectionStatus, Offer, GroupDeal, GroupDealParticipant, InstallmentPlan, InstallmentOrder, InstallmentPayment, LiveStream, LiveComment, Delivery, DeliveryUpdate, LoyaltyCustomer, WhatsappConversation, Affiliate, AffiliateClick, AffiliateSale, AffiliateWithdrawal, EscrowTransaction, ChatConversation, ChatMessage, VisualSearchRecord, ProductReturn, Dispute, DisputeMessage, FlashSale, FlashSaleItem, AppNotification, Story, StoryView, ReturnReason, BulkUploadJob, ShippingZone, Store } from '../../types';
import { getPublicTheme, PublicTheme } from '../../utils/publicTheme';
import { haversineKm, readCustomerLocation } from '../../utils/haversine';
import { GoldenTopLine } from '../../utils/publicTheme';
import { MarketHeader, MarketFooter, CartLine, isProductVisible, isCompanySubscriptionExpired } from './MarketplaceShared';
import { translate } from '../../utils/format';
import { getScopedStoredLanguage, setScopedStoredLanguage, clearScopedStoredLanguage, ensureLocaleCookie, setLocaleCookie, isLangCode, syncDocumentLang, LangCode } from '../../utils/i18n';
import MarketplaceHome from './MarketplaceHome';
import MarketplaceStorefront from './MarketplaceStorefront';
import MarketplaceCart from './MarketplaceCart';
import MarketplaceCheckout, { CheckoutSubmitData } from './MarketplaceCheckout';
import MarketplaceTrackOrder from './MarketplaceTrackOrder';
import MarketplaceMyOrders from './MarketplaceMyOrders';
import ProductDetailPage from './ProductDetailModal';
import SubscriptionPayment from './SubscriptionPayment';
import MarketplaceRegion, { resolveRegionName } from './MarketplaceRegion';
import MarketplaceSearchPage from './MarketplaceSearchPage';
import MarketplacePhase2C, { FeatureHandlers } from './MarketplacePhase2C';
import MarketplaceWakala, { WakalaView } from './MarketplaceWakala';
import VoiceMicButton from './VoiceMicButton';
import QrScanBanner from './QrScanBanner';
import { StoriesBar } from './MegaStories';
import { FlashSalesSection } from './MegaFlashSales';
import MegaVisualSearch from './MegaVisualSearch';
import MegaNotificationsBell from './MegaNotifications';
import MegaChat from './MegaChat';
import MegaBuyerOrderDetail from './MegaEscrow';
import MegaOffers from './MegaOffers';
import { applySeo, DEFAULT_TITLE, DEFAULT_DESCRIPTION, SITE_DOMAIN, productJsonLd, companyJsonLd } from '../../utils/seo';
import { extractSwahiliKeywords } from '../../utils/voiceSearch';

export interface SubmitOrderResult {
  ok: boolean;
  orderNumber?: string;
  error?: string;
  stkInitiated?: boolean;
}

interface Props {
  path: string;
  companies: Company[];
  products: MarketplaceProduct[];
  /** Physical stores (Master Data) — used to render a product's assigned-store pins on the map. */
  stores?: Store[];
  orders: MarketplaceOrder[];
  customers: MarketplaceCustomer[];
  regions?: string[];
  translate?: (text: string) => string;
  theme: PublicTheme;
  onToggleTheme: () => void;
  onNavigate: (path: string) => void;
  onSubmitOrder: (data: CheckoutSubmitData) => SubmitOrderResult;
  onCustomerLogin: (phone: string, password: string) => { ok: boolean; customer?: MarketplaceCustomer; error?: string };
  onUpdateCustomerLocale?: (customerId: number, locale: LangCode) => void;
  onTrackProductClick?: (productId: number, type: 'whatsapp') => void;
  onBackHome: () => void;
  // --- MEGA Phase 1: Kiswahili/AI search ---
  searchSynonyms?: SearchSynonym[];
  // --- MEGA Phase 2B: multi-network collection (M-Pesa / Tigo / Airtel / HaloPesa) ---
  collectionSettings?: CollectionSetting[];
  collectionMode?: CollectionMode;
  onInitiateCollection?: (input: {
    companyId: number;
    customerName?: string;
    customerPhone: string;
    network: CollectionNetwork;
    amount: number;
  }) => Promise<{ ok: boolean; reference?: string; status?: CollectionStatus; mode?: CollectionMode; error?: string }>;
  onCheckCollectionStatus?: (reference: string) => Promise<{ ok: boolean; status?: CollectionStatus; error?: string }>;
  // --- Reviews & analytics (Features 3 & 5) ---
  onTrackProductView?: (productId: number) => void;
  reviews?: Review[];
  onSubmitReview?: (data: {
    companyId: number;
    productId: number | null;
    reviewerName: string;
    reviewerPhone?: string;
    rating: number;
    comment?: string;
    isVerifiedBuyer: boolean;
  }) => { ok: boolean; error?: string };
  // --- New billing model ---
  currencies: Currency[];
  subscriptionPlans: TradeSubscriptionPlan[];
  companySubscriptions: CompanySubscription[];
  payNumbers: PayNumbersConfig;
  onSubmitSubscriptionPayment: (data: {
    companyId: number;
    planId: number;
    planName: string;
    planSlug: string;
    planType: 'direct' | 'commission';
    currencyCode: string;
    exchangeRate: number;
    amountPaid: number;
    amountTzs: number;
    commissionPercentSnapshot: number;
    paymentMethod: string;
    paymentReference: string;
    paymentProof?: string;
  }) => { ok: boolean; subscriptionId?: number; error?: string };
  // --- MEGA Phase 2C: Piga Bei · Nunua Pamoja · WhatsApp AI · Bodaboda · Lipa Pole Pole · Live Shopping · Loyalty ---
  offers?: Offer[];
  groupDeals?: GroupDeal[];
  groupDealParticipants?: GroupDealParticipant[];
  installmentPlans?: InstallmentPlan[];
  installmentOrders?: InstallmentOrder[];
  installmentPayments?: InstallmentPayment[];
  liveStreams?: LiveStream[];
  liveComments?: LiveComment[];
  deliveries?: Delivery[];
  deliveryUpdates?: DeliveryUpdate[];
  loyaltyCustomers?: LoyaltyCustomer[];
  whatsappConversations?: WhatsappConversation[];
  featureHandlers?: FeatureHandlers;
  // --- MEGA ULTIMATE: MFUMO WA WAKALA · TAFTA KWA SAUTI · QR CODE YA DUKA ---
  affiliates?: Affiliate[];
  affiliateClicks?: AffiliateClick[];
  affiliateSales?: AffiliateSale[];
  affiliateWithdrawals?: AffiliateWithdrawal[];
  affiliateCommissionPercent?: number;
  affiliateMinWithdrawal?: number;
  onRegisterAffiliate?: (data: {
    name: string;
    phone: string;
    password?: string;
    region?: string;
    district?: string;
    ward?: string;
    nida?: string;
  }) => { ok: boolean; error?: string; affiliate?: Affiliate };
  onLoginAffiliate?: (phone: string, password: string) => { ok: boolean; error?: string; affiliate?: Affiliate };
  onRequestAffiliateWithdrawal?: (affiliateId: number, amount: number, phoneNumber: string, options?: {
    method?: string;
    accountName?: string;
    bankName?: string;
  }) => { ok: boolean; error?: string };
  onLogVoiceSearch?: (query: string, transcript: string, matches: number, language?: string) => void;
  onRecordQrScan?: (companyId: number, productId: number | null, token: string, referrer: string, isAffiliate: boolean) => void;
  onOpenQrPage?: () => void;
  voiceSearchEnabled?: boolean;
  qr5Enabled?: boolean;
  qr5DiscountPercent?: number;
  // --- MEGA BUILD: 7 ultimate features ---
  flashSales?: FlashSale[];
  flashSalesHandlers?: { onSave: (sale: FlashSale) => void; onDelete: (id: number) => void };
  stories?: Story[];
  storyViews?: StoryView[];
  storiesHandlers?: { onCreate: (payload: { companyId: number; type: 'image' | 'video'; mediaPath: string; caption?: string; productId?: number | null }) => void; onDelete: (id: number) => void; onRecordView: (storyId: number, viewerPhone?: string) => void };
  chatConversations?: ChatConversation[];
  chatMessages?: ChatMessage[];
  chatHandlers?: { onSend: (conversationId: number, input: { text?: string; messageType: 'text' | 'image' | 'product'; imageData?: string; productId?: number }) => void; onMarkRead: (conversationId: number) => void; onStartConversation: (companyId: number, buyerName: string, buyerPhone: string, productId?: number | null) => number };
  appNotifications?: AppNotification[];
  notificationHandlers?: { onMarkAllRead: () => void };
  visualSearchHandlers?: { onLogSearch: (record: VisualSearchRecord) => void };
  onConfirmDelivery?: (orderId: number, source: 'buyer_confirm' | 'auto_48h' | 'admin') => { ok: boolean; error?: string };
  onOpenDispute?: (order: MarketplaceOrder, input: { reason: ReturnReason; description: string; images: string[]; desiredSolution: 'refund' | 'replacement' }) => { ok: boolean; error?: string };
  onConfirmCodReceipt?: (orderId: number) => { ok: boolean; error?: string };
  identityPhone?: string | null;
  // --- MEGA CRITICAL FIX 2-in-1: buyer offer negotiation actions ---
  offerActions?: {
    onAcceptCounter: (offerId: number) => { ok: boolean; error?: string };
    onRejectCounter: (offerId: number) => { ok: boolean; error?: string };
    onCounterAgain: (offerId: number, price: number, message?: string) => { ok: boolean; error?: string };
  };
  shippingZones?: ShippingZone[];
}

interface CartState {
  companyId: number;
  items: CartLine[];
}

const SESSION_KEY = 'tradecore_customer_session';

const scopeForSession = (s: CustomerSession | null): string => (s && s.id ? `cust_${s.id}` : 'guest');

// Fallback no-op handlers — real handlers are injected from App.tsx.
const defaultFeatureHandlers: FeatureHandlers = {
  onSubmitOffer: () => ({ ok: false, error: 'Feature handlers not available.' }),
  onInitiateOfferPayment: () => ({ ok: false, error: 'Feature handlers not available.' }),
  onJoinGroupDeal: () => ({ ok: false, error: 'Feature handlers not available.' }),
  onInitiateGroupPayment: () => ({ ok: false, error: 'Feature handlers not available.' }),
  onCreateInstallmentOrder: () => ({ ok: false, error: 'Feature handlers not available.' }),
  onInitiateInstallmentPayment: () => ({ ok: false, error: 'Feature handlers not available.' }),
  onAddLiveComment: () => {},
  onLikeLiveStream: () => {},
  onRedeemLoyalty: () => ({ ok: false, error: 'Feature handlers not available.' }),
  onWhatsappMessage: () => null
};

interface CustomerSession {
  id?: number;
  phone: string;
  name: string;
  locale?: LangCode;
}

function readSession(): CustomerSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.phone && parsed.name) return parsed;
  } catch (e) {}
  return null;
}

export default function MarketplaceApp({
  path, companies, products, stores, orders, customers, regions, theme,
  onToggleTheme, onNavigate, onSubmitOrder, onCustomerLogin, onUpdateCustomerLocale, onTrackProductClick, onBackHome,
  onTrackProductView, reviews, onSubmitReview,
  currencies, subscriptionPlans, companySubscriptions, payNumbers, onSubmitSubscriptionPayment,
  searchSynonyms,
  collectionSettings, collectionMode, onInitiateCollection, onCheckCollectionStatus,
  offers, groupDeals, groupDealParticipants, installmentPlans, installmentOrders, installmentPayments,
  liveStreams, liveComments, deliveries, deliveryUpdates, loyaltyCustomers, whatsappConversations, featureHandlers,
  affiliates, affiliateClicks, affiliateSales, affiliateWithdrawals,
  affiliateCommissionPercent, affiliateMinWithdrawal,
  onRegisterAffiliate, onLoginAffiliate, onRequestAffiliateWithdrawal,
  onLogVoiceSearch, onRecordQrScan, onOpenQrPage, voiceSearchEnabled, qr5Enabled, qr5DiscountPercent,
  flashSales, flashSalesHandlers, stories, storyViews, storiesHandlers,
  chatConversations, chatMessages, chatHandlers, appNotifications, notificationHandlers,
  visualSearchHandlers, onConfirmDelivery, onOpenDispute, onConfirmCodReceipt, identityPhone, offerActions, shippingZones
}: Props) {
  const th = getPublicTheme(theme);
  const [language, setLanguage] = useState<LangCode>(getScopedStoredLanguage(scopeForSession(readSession())));
  const t = (text: string) => translate(text, language);
  const changeLanguage = (lang: LangCode) => {
    setLanguage(lang);
    setScopedStoredLanguage(scopeForSession(session), lang);
    // Also update the fallback keys so the language persists across all storage layers.
    try { localStorage.setItem('app_language', lang); } catch (e) {}
    setLocaleCookie(lang);
    setSession(prev => prev && prev.id ? { ...prev, locale: lang } : prev);
    if (session?.id) onUpdateCustomerLocale?.(session.id, lang);
  };
  // Cookie + localStorage + DB sync: guarantee an app_locale cookie (default 'en')
  useEffect(() => {
    ensureLocaleCookie(language);
    syncDocumentLang(language);
  }, [language]);
  const [cart, setCart] = useState<CartState>({ companyId: 0, items: [] });
  const [cartOpen, setCartOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [session, setSession] = useState<CustomerSession | null>(readSession());
  // --- MEGA ULTIMATE: TAFTA KWA SAUTI banner state ---
  const [voiceResult, setVoiceResult] = useState<{ transcript: string; query: string; matches: number } | null>(null);

  const handleVoiceResult = (transcript: string, query: string) => {
    if (!query) return;
    const matches = products.filter(p => p.name.toLowerCase().includes(query)).length;
    setVoiceResult({ transcript, query, matches });
    onLogVoiceSearch?.(query, transcript, matches, 'sw-TZ');
    go(`/marketplace/search?q=${encodeURIComponent(query)}&voice=1`);
  };

  // --- MEGA Phase 2B: placed-order success screen (manual approval / auto AzamPay polling) ---
  const [placedInfo, setPlacedInfo] = useState<{ orderNumber: string; reference?: string; mode?: string; status?: string } | null>(null);
  const [paySecondsLeft, setPaySecondsLeft] = useState(300);
  const payEndRef = useRef<number>(0);

  // --- MEGA BUILD: visual search modal + buyer notification feed ---
  const [showVisualSearch, setShowVisualSearch] = useState(false);
  const buyerNotifications = useMemo(() =>
    (appNotifications || []).filter(n => !!n.audiencePhone
      ? n.audiencePhone === (identityPhone || '')
      : (n.type === 'flash_sale' || n.type === 'general')),
    [appNotifications, identityPhone]);

  const route = useMemo(() => {
    const p = path.replace(/\/+$/, '').split('?')[0];
    const segments = p.split('/').filter(Boolean); // ['marketplace', ...] | ['product', slug] | ['company', slug] | ['mikoa', slug]
    if (segments[0] === 'product' && segments[1]) return { name: 'product' as const, slug: decodeURIComponent(segments[1]) };
    // Company subscription pay/renew routes: /company/{slug}/subscription/{renew|pay[/id]}
    if (segments[0] === 'company' && segments[1] && segments[2] === 'subscription') {
      const slug = decodeURIComponent(segments[1]);
      if (segments[3] === 'renew') return { name: 'renew' as const, slug };
      if (segments[3] === 'pay') return { name: 'pay' as const, slug, subscriptionId: segments[4] ? Number(segments[4]) : undefined };
      return { name: 'home' as const };
    }
    if (segments[0] === 'company' && segments[1]) return { name: 'company' as const, slug: decodeURIComponent(segments[1]) };
    if (segments[0] === 'mikoa' && segments[1]) return { name: 'region' as const, slug: decodeURIComponent(segments[1]) };
    if (segments[0] === 'search') return { name: 'search' as const };
    // --- MEGA Phase 2C routes ---
    if (segments[0] === 'offer' && segments[1]) return { name: 'offer' as const, id: decodeURIComponent(segments[1]) };
    if (segments[0] === 'group-deal' && segments[1]) return { name: 'group-deal' as const, id: decodeURIComponent(segments[1]) };
    if (segments[0] === 'deals') return { name: 'deals' as const };
    if (segments[0] === 'lipa-pole-pole' && segments[1] === 'start' && segments[2]) return { name: 'installment-start' as const, id: decodeURIComponent(segments[2]) };
    if (segments[0] === 'lipa-pole-pole' && segments[1]) return { name: 'installment-order' as const, id: decodeURIComponent(segments[1]) };
    if (segments[0] === 'live-shopping') return { name: 'live-shopping' as const };
    if (segments[0] === 'live' && segments[1]) return { name: 'live' as const, id: decodeURIComponent(segments[1]) };
    if (segments[0] === 'track' && segments[1]) return { name: 'track-delivery' as const, id: decodeURIComponent(segments[1]) };
    if (segments[0] === 'loyalty') return { name: 'loyalty' as const };
    if (segments[0] === 'whatsapp-bot') return { name: 'whatsapp-bot' as const };
    // --- MEGA ULTIMATE: MFUMO WA WAKALA (public affiliate portal) ---
    if (segments[0] === 'affiliate') {
      const sub = (segments[1] || '').toLowerCase();
      if (sub === 'register') return { name: 'affiliate' as const, wakalaView: 'register' as const };
      if (sub === 'login') return { name: 'affiliate' as const, wakalaView: 'login' as const };
      if (sub === 'withdraw') return { name: 'affiliate' as const, wakalaView: 'withdraw' as const };
      if (sub === 'dashboard' || sub === 'panel') return { name: 'affiliate' as const, wakalaView: 'dashboard' as const };
      return { name: 'affiliate' as const, wakalaView: 'landing' as const };
    }
    if (segments[0] !== 'marketplace') return { name: 'home' as const };
    const [sub] = segments.slice(1);
    if (sub === 'search') return { name: 'search' as const };
    if (sub === 'company' && segments[2]) {
      if (segments[3] === 'subscription') {
        const slug = decodeURIComponent(segments[2]);
        if (segments[4] === 'renew') return { name: 'renew' as const, slug };
        if (segments[4] === 'pay') return { name: 'pay' as const, slug, subscriptionId: segments[5] ? Number(segments[5]) : undefined };
        return { name: 'home' as const };
      }
      return { name: 'company' as const, slug: decodeURIComponent(segments[2]) };
    }
    if (sub === 'track') return { name: 'track' as const, orderNumber: segments[2] ? decodeURIComponent(segments[2]) : undefined };
    if (sub === 'orders') return { name: 'orders' as const };
    if (sub === 'terms-tra') return { name: 'terms-tra' as const };
    // --- MEGA BUILD: chat + order detail routes ---
    if (sub === 'chat' && segments[2]) return { name: 'chat-conv' as const, conversationId: Number(segments[2]) };
    if (sub === 'chat') return { name: 'chat' as const };
    if (sub === 'order' && segments[2]) return { name: 'order-detail' as const, orderNumber: decodeURIComponent(segments[2]) };
    if (sub === 'visual-search') return { name: 'visual-search' as const };
    if (sub === 'stories') return { name: 'stories' as const };
    // --- MEGA CRITICAL FIX 2-in-1: buyer offers list ---
    if (sub === 'offers') return { name: 'offers' as const };
    return { name: 'home' as const };
  }, [path]);

  const cartCompany = useMemo(() => companies.find(c => c.id === cart.companyId) || null, [companies, cart.companyId]);
  const cartCount = cart.items.reduce((s, i) => s + i.quantity, 0);

  const go = (p: string) => {
    setCartOpen(false);
    onNavigate(p);
  };

  const openProduct = (product: MarketplaceProduct) => go(`/product/${product.slug || String(product.id)}`);
  const openCompany = (slug: string) => go(`/company/${slug}`);

  // --- SEO: title / meta / canonical / Open Graph / JSON-LD per route ---
  const checkoutRoute = path.replace(/\/+$/, '').endsWith('/checkout');
  useEffect(() => {
    const p = path.replace(/\/+$/, '') || '/';

    if (checkoutRoute) {
      applySeo({ title: 'Checkout | GlobalTradeCore', noindex: true });
      return;
    }

    if (route.name === 'product') {
      const product = products.find(x => String(x.slug || '').toLowerCase() === (route.slug || '').toLowerCase() || String(x.id) === route.slug);
      const company = product ? companies.find(c => c.id === product.companyId) : undefined;
      if (!product) {
        applySeo({ title: 'Product Not Found | GlobalTradeCore', noindex: true });
        return;
      }
      const city = company?.region || company?.district || '';
      const price = Math.round(product.price || 0).toLocaleString('en-US');
      applySeo({
        title: `${product.name} - Bei ${price} - ${city || 'Tanzania'} | GlobalTradeCore`,
        description: `${product.name} inauzwa na ${company?.name || ''} ${city} kwa TZS ${price}. Nunua sasa tanzaniatradecore.co.tz`,
        canonical: `${SITE_DOMAIN}/product/${product.slug || product.id}`,
        ogImage: product.image,
        jsonLd: productJsonLd({
          name: product.name,
          slug: product.slug || String(product.id),
          description: product.description,
          price: product.price,
          sku: product.id,
          images: [product.image, ...(product.gallery || [])],
          brand: company?.name,
          seller: company?.name,
          availability: (product.stockQuantity || 0) > 0 ? 'InStock' : 'OutOfStock',
          rating: product.averageRating && product.reviewsCount
            ? { ratingValue: product.averageRating, reviewCount: product.reviewsCount }
            : undefined
        })
      });
      return;
    }

    if (route.name === 'company') {
      const company = companies.find(c => c.slug === route.slug);
      if (!company) {
        applySeo({ title: 'Company Not Found | GlobalTradeCore', noindex: true });
        return;
      }
      const city = company.region || company.district || '';
      applySeo({
        title: `${company.name} - ${company.category || 'Store'} ${city} | GlobalTradeCore`,
        description: (company.description || `${company.name} - ${company.category || 'Store'} ${city}`).slice(0, 160),
        canonical: `${SITE_DOMAIN}/company/${company.slug}`,
        jsonLd: companyJsonLd({
          name: company.name,
          slug: company.slug,
          category: company.category,
          description: company.description,
          region: company.region,
          district: company.district,
          ward: company.ward,
          streetAddress: company.addressText,
          phone: company.phone,
          geo: company.latitude && company.longitude
            ? { latitude: company.latitude, longitude: company.longitude }
            : undefined,
          rating: company.averageRating && company.reviewsCount
            ? { ratingValue: company.averageRating, reviewCount: company.reviewsCount }
            : undefined
        })
      });
      return;
    }

    if (route.name === 'region') {
      const regionName = resolveRegionName(route.slug, regions);
      if (!regionName) {
        applySeo({ title: 'Region Not Found | GlobalTradeCore', noindex: true });
        return;
      }
      applySeo({
        title: `Bidhaa zote ${regionName} | GlobalTradeCore`,
        description: `Nunua bidhaa kutoka kampuni zilizothibitishwa mkoani ${regionName}. GlobalTradeCore — online marketplace Tanzania.`,
        canonical: `${SITE_DOMAIN}/mikoa/${route.slug}`
      });
      return;
    }

    if (route.name === 'track') {
      applySeo({ title: 'Track Your Order | GlobalTradeCore', description: 'Track your order by order number or Transaction ID. No account needed.' });
      return;
    }
    if (route.name === 'search') {
      const q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('q') || '' : '';
      applySeo({
        title: `${q ? `Search: ${q} | ` : ''}Marketplace Search | GlobalTradeCore`,
        description: 'Search all products from verified Tanzanian companies. Find products in Swahili or English — shoes, fabrics, phones, clothing and more.'
      });
      return;
    }
    if (route.name === 'orders') {
      applySeo({ title: 'My Orders | GlobalTradeCore', noindex: true });
      return;
    }
    if (route.name === 'renew' || route.name === 'pay') {
      applySeo({ title: 'Subscription Payment | GlobalTradeCore', noindex: true });
      return;
    }

    // Home
    applySeo({ title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, canonical: p === '/' ? SITE_DOMAIN : `${SITE_DOMAIN}${p}` });
  }, [route, path, products, companies, checkoutRoute, regions]);

  const addToCart = (product: MarketplaceProduct) => {
    setCart(prev => {
      if (prev.companyId !== 0 && prev.companyId !== product.companyId) {
        setNotice(t('Cart replaced — products are from a single store.'));
        return { companyId: product.companyId, items: [{ product, quantity: 1 }] };
      }
      const existing = prev.items.find(i => i.product.id === product.id);
      if (existing) {
        const max = product.stockQuantity || 0;
        return {
          companyId: prev.companyId || product.companyId,
          items: prev.items.map(i => (i.product.id === product.id ? { ...i, quantity: Math.min(i.quantity + 1, max) } : i))
        };
      }
      return { companyId: prev.companyId || product.companyId, items: [...prev.items, { product, quantity: 1 }] };
    });
    setNotice(`${product.name} ${t('added to cart')}`);
    window.setTimeout(() => setNotice(''), 2500);
  };

  const updateQty = (productId: number, qty: number) => {
    setCart(prev => {
      if (qty <= 0) return { ...prev, items: prev.items.filter(i => i.product.id !== productId) };
      return {
        ...prev,
        items: prev.items.map(i => {
          if (i.product.id !== productId) return i;
          const max = i.product.stockQuantity || 0;
          return { ...i, quantity: Math.min(qty, Math.max(1, max)) };
        })
      };
    });
  };

  const removeItem = (productId: number) => {
    setCart(prev => ({ ...prev, items: prev.items.filter(i => i.product.id !== productId) }));
  };

  const clearCart = () => setCart({ companyId: 0, items: [] });

  const placeOrder = (data: CheckoutSubmitData): SubmitOrderResult => {
    const res = onSubmitOrder(data);
    if (res.ok && res.orderNumber) {
      clearCart();
      if (data.collectionReference) {
        payEndRef.current = Date.now() + 5 * 60 * 1000;
        setPaySecondsLeft(300);
        setPlacedInfo({
          orderNumber: res.orderNumber,
          reference: data.collectionReference,
          mode: data.paymentStatus === 'processing' ? 'auto' : 'manual',
          status: data.paymentStatus
        });
      }
    }
    return res;
  };

  const customerLogin = (phone: string, password: string) => {
    const res = onCustomerLogin(phone, password);
    if (res.ok && res.customer) {
      // DB-stored locale is authoritative for this customer; default 'en'
      const custLocale: LangCode = isLangCode(res.customer.locale) ? res.customer.locale : 'en';
      setLanguage(custLocale);
      setScopedStoredLanguage(scopeForSession({ id: res.customer.id, phone: res.customer.phone, name: res.customer.name, locale: custLocale }), custLocale);
      const s: CustomerSession = { id: res.customer.id, phone: res.customer.phone, name: res.customer.name, locale: custLocale };
      try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) {}
      setSession(s);
    }
    return res;
  };

  const customerLogout = () => {
    if (session?.id) clearScopedStoredLanguage(`cust_${session.id}`);
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
    setSession(null);
    // Reset to English default so the next visitor doesn't inherit the previous user's language.
    try { localStorage.setItem('app_language', 'en'); } catch (e) {}
    setLocaleCookie('en');
    setLanguage('en');
  };

  const distanceFor = (companyId: number): number | null => {
    const c = companies.find(x => x.id === companyId);
    const loc = readCustomerLocation();
    if (!c || !loc || typeof c.latitude !== 'number' || typeof c.longitude !== 'number') return null;
    return haversineKm(loc.lat, loc.lng, c.latitude, c.longitude);
  };

  // MEGA Phase 2C: live-shopping checkout tag (LIVE-STREAM: {key} in deliveryInstructions).
  const liveStreamKeyForCheckout = useMemo(() => {
    if (!checkoutRoute) return undefined;
    try {
      const key = sessionStorage.getItem('tradecore_live_stream');
      sessionStorage.removeItem('tradecore_live_stream');
      return key || undefined;
    } catch (e) { return undefined; }
  }, [checkoutRoute, cart.companyId]);

  const activeCompanies = useMemo(() => companies.filter(c => c.isMarketplaceActive !== false && !isCompanySubscriptionExpired(c)), [companies]);

  // --- MEGA Phase 2B: auto (AzamPay) payment poll every 5s + 5-min countdown ---
  const autoWaiting = !!placedInfo && placedInfo.mode === 'auto' && (placedInfo.status === 'processing' || placedInfo.status === undefined);
  useEffect(() => {
    if (!autoWaiting || !placedInfo?.reference || !onCheckCollectionStatus) return;
    let alive = true;
    const tick = async () => {
      if (!alive) return;
      try {
        const res = await onCheckCollectionStatus(placedInfo.reference!);
        if (!alive) return;
        if (res?.ok) {
          if (res.status === 'completed') {
            setPlacedInfo(p => p && p.reference === placedInfo.reference ? { ...p, status: 'completed' } : p);
            return;
          }
          if (res.status === 'failed') {
            setPlacedInfo(p => p && p.reference === placedInfo.reference ? { ...p, status: 'failed' } : p);
            return;
          }
          if (res.status === 'manual_pending_approval') {
            setPlacedInfo(p => p && p.reference === placedInfo.reference ? { ...p, mode: 'manual', status: 'manual_pending_approval' } : p);
            return;
          }
        }
      } catch (e) {
        console.warn('[collection] poll failed', e);
      }
    };
    void tick();
    const id = window.setInterval(tick, 5000);
    return () => { alive = false; window.clearInterval(id); };
  }, [autoWaiting, placedInfo?.reference, onCheckCollectionStatus]);

  useEffect(() => {
    if (!autoWaiting) return;
    const id = window.setInterval(() => {
      const left = Math.max(0, Math.round((payEndRef.current - Date.now()) / 1000));
      setPaySecondsLeft(left);
      if (left === 0) setPlacedInfo(p => p && p.reference === placedInfo?.reference ? { ...p, status: 'expired' } : p);
    }, 1000);
    return () => window.clearInterval(id);
  }, [autoWaiting]);

  const renderPhase2BSuccess = () => {
    const info = placedInfo!;
    const pending = info.status === undefined || info.status === 'processing' || info.status === 'manual_pending_approval';
    const mins = Math.floor(paySecondsLeft / 60);
    const secs = String(paySecondsLeft % 60).padStart(2, '0');
    return (
      <div className={`${th.card} ${th.cardBorder} rounded-2xl p-8 max-w-lg mx-auto text-center space-y-5`}>
        {info.status === 'completed' ? (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <h2 className={`text-lg font-black ${th.strongText}`}>{t('Payment Confirmed!')}</h2>
            <p className={`text-[12px] ${th.textMuted} font-semibold leading-relaxed`}>
              {t('Your payment was verified and the seller has been paid. Thank you for shopping with us!')}
            </p>
          </>
        ) : info.status === 'failed' || info.status === 'expired' ? (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center">
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className={`text-lg font-black ${th.strongText}`}>{t('Payment not confirmed')}</h2>
            <p className={`text-[12px] ${th.textMuted} font-semibold leading-relaxed`}>
              {t('We could not confirm your payment in time. If you already paid, share your Transaction ID with the seller — the order stays pending until approval.')}
            </p>
          </>
        ) : info.mode === 'manual' ? (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/15 flex items-center justify-center">
              <Clock className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className={`text-lg font-black ${th.strongText}`}>{t('Order Placed — Payment Pending Approval')}</h2>
            <p className={`text-[12px] ${th.textMuted} font-semibold leading-relaxed`}>
              {t('Our team is verifying your payment. Your seller wallet will be credited once approved.')}
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/15 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            </div>
            <h2 className={`text-lg font-black ${th.strongText}`}>{t('Waiting for Payment...')}</h2>
            <p className={`text-[12px] ${th.textMuted} font-semibold leading-relaxed`}>
              {t('A USSD push was sent to your phone. Enter your PIN to approve the payment.')}
            </p>
          </>
        )}

        <div className={`flex items-center justify-center gap-1.5 text-[11px] font-black ${th.chipText} ${th.chip} ${th.chipBorder} px-3 py-1.5 rounded-full mx-auto`}>
          <ShieldCheck className="w-3.5 h-3.5" />
          {t('Payment Reference')}: <span className="font-mono">{info.reference}</span>
        </div>
        <div className={`text-[11px] ${th.textMuted} font-bold`}>{t('Order')}: <span className="font-mono">{info.orderNumber}</span></div>

        {autoWaiting && (
          <div className={`flex items-center justify-center gap-2 text-[12px] font-black ${th.strongText}`}>
            <Clock className="w-4 h-4" /> {mins}:{secs}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
          {pending && (
            <button
              onClick={() => onCheckCollectionStatus?.(info.reference!).then(r => {
                if (r?.status === 'completed') setPlacedInfo(p => p ? { ...p, status: 'completed' } : p);
                else if (r?.status === 'failed') setPlacedInfo(p => p ? { ...p, status: 'failed' } : p);
                else if (r?.ok && r.status) setPlacedInfo(p => p ? { ...p, status: r.status } : p);
              })}
              className={`flex items-center justify-center gap-1.5 px-4 py-2.5 text-[11px] font-black rounded-xl ${th.btnSecondary} ${th.btnSecondaryText} cursor-pointer`}
            >
              <RefreshCw className="w-3.5 h-3.5" /> {t('Check Status')}
            </button>
          )}
          <button
            onClick={() => go(`/marketplace/track/${info.orderNumber}`)}
            className={`flex items-center justify-center gap-1.5 px-4 py-2.5 text-[11px] font-black rounded-xl ${th.btnPrimary} ${th.btnPrimaryText} cursor-pointer`}
          >
            {t('Track Order')}
          </button>
          <button
            onClick={() => { setPlacedInfo(null); go('/marketplace'); }}
            className={`flex items-center justify-center gap-1.5 px-4 py-2.5 text-[11px] font-black rounded-xl border ${th.cardBorder} ${th.strongText} cursor-pointer sm:col-span-2`}
          >
            {t('Back to Marketplace')}
          </button>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (route.name === 'product') {
      const product = products.find(x => String(x.slug || '').toLowerCase() === (route.slug || '').toLowerCase() || String(x.id) === route.slug);
      const company = product ? companies.find(c => c.id === product.companyId) : undefined;
      if (!product || !isProductVisible(product) || !company || isCompanySubscriptionExpired(company)) {
        return (
          <div className={`${th.card} ${th.cardBorder} rounded-2xl p-10 text-center max-w-md mx-auto`}>
            <div className={`text-sm font-black ${th.strongText}`}>{t('Bidhaa haipatikani')}</div>
            <div className={`text-[11px] ${th.textMuted} font-semibold mt-1`}>{t('The product you are looking for does not exist.')}</div>
            <button onClick={() => go('/marketplace')} className={`mt-4 px-5 py-2.5 text-[11px] font-black rounded-xl ${th.btnPrimary} ${th.btnPrimaryText} cursor-pointer`}>
              {t('Back to Marketplace')}
            </button>
          </div>
        );
      }
      // --- MEGA BUILD F5/F2: flash pricing + ask-seller chat wiring for this product ---
      const nowMs = Date.now();
      const activeSaleForProduct = (flashSales || []).find(fs =>
        fs && fs.companyId === company.id && fs.status === 'active' &&
        fs.startTime && fs.endTime &&
        new Date(fs.startTime).getTime() <= nowMs && new Date(fs.endTime).getTime() > nowMs &&
        fs.items && fs.items.some(fi => fi.productId === product.id && fi.sold < fi.stock)
      );
      const flashItemForProduct = activeSaleForProduct?.items?.find(fi => fi && fi.productId === product.id);
      const startChatAboutProduct = () => {
        let phone = identityPhone || session?.phone || '';
        const chatName = localStorage.getItem('tradecore_chat_name') || session?.name || 'Mteja';
        if (!phone) {
          const entered = window.prompt(t('Ingiza namba yako ya simu kuanza mazungumzo na muuzaji:'));
          if (!entered) return;
          const digits = entered.replace(/[^0-9]/g, '');
          if (!/^(255|0)?[67]\d{8}$/.test(digits)) { window.alert(t('Namba ya simu si sahihi.')); return; }
          phone = '+255' + digits.replace(/^255/, '').replace(/^0/, '');
          localStorage.setItem('tradecore_buyer_phone', phone);
          localStorage.setItem('tradecore_chat_name', chatName);
        }
        const convId = chatHandlers?.onStartConversation(company.id, chatName, phone, product.id);
        if (convId) go(`/marketplace/chat/${convId}`);
      };
      return (
        <>
          <QrScanBanner
            theme={theme}
            t={t}
            company={company}
            product={product}
            qr5Enabled={qr5Enabled}
            qr5DiscountPercent={qr5DiscountPercent}
            onRecordQrScan={(cid, pid, token, referrer, isAff) => onRecordQrScan?.(cid, pid, token, referrer, isAff)}
            onBrowseStore={() => go(`/company/${company.slug}`)}
          />
          <ProductDetailPage
            product={product}
            company={company}
            stores={stores}
            theme={theme}
            t={t}
            onBack={() => go('/marketplace')}
            onAddToCart={addToCart}
            onViewCompany={openCompany}
            onOrderWhatsApp={() => onTrackProductClick?.(product.id, 'whatsapp')}
            reviews={reviews || []}
            onSubmitReview={onSubmitReview}
            onTrackProductView={onTrackProductView}
            session={session}
            groupDeals={(groupDeals || []).filter(d => d.productId === product.id)}
            installmentPlans={(installmentPlans || []).filter(p => p.productId === product.id)}
            onSubmitOffer={featureHandlers?.onSubmitOffer}
            onOpenGroupDeal={(id) => go(`/group-deal/${id}`)}
            onStartInstallment={(pid) => go(`/lipa-pole-pole/start/${pid}`)}
            flashPrice={flashItemForProduct?.flashPrice}
            flashEndsAt={flashItemForProduct ? activeSaleForProduct!.endTime : undefined}
            onAskSeller={startChatAboutProduct}
            onNavigateOffers={() => go('/marketplace/offers')}
          />
        </>
      );
    }

    if (route.name === 'region') {
      return (
        <MarketplaceRegion
          theme={theme}
          t={t}
          regionSlug={route.slug}
          regions={regions}
          companies={activeCompanies}
          products={products}
          onBack={() => go('/marketplace')}
          onOpenCompany={openCompany}
          onOpenProduct={openProduct}
          onAddToCart={addToCart}
        />
      );
    }

    if (route.name === 'search') {
      const q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('q') || '' : '';
      const isVoice = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('voice') === '1' : false;
      return (
        <MarketplaceSearchPage
          theme={theme}
          t={t}
          companies={activeCompanies}
          products={products}
          regions={regions}
          searchSynonyms={searchSynonyms || []}
          initialQuery={q}
          voiceTranscript={isVoice ? voiceResult?.transcript || '' : ''}
          onVoiceSearch={(transcript, query) => handleVoiceResult(transcript, query)}
          onBack={() => go('/marketplace')}
          onOpenCompany={openCompany}
          onOpenProduct={openProduct}
          onAddToCart={addToCart}
        />
      );
    }

    if (route.name === 'affiliate') {
      return (
        <MarketplaceWakala
          view={route.wakalaView as WakalaView}
            theme={theme}
            t={t}
            affiliates={affiliates || []}
            affiliateClicks={affiliateClicks || []}
            affiliateSales={affiliateSales || []}
            affiliateWithdrawals={affiliateWithdrawals || []}
            companies={companies}
            commissionPercent={affiliateCommissionPercent ?? 2}
            minWithdrawal={affiliateMinWithdrawal ?? 10000}
            onRegisterAffiliate={(data) => onRegisterAffiliate?.(data) || { ok: false, error: 'Not available.' }}
            onLoginAffiliate={(phone, password) => onLoginAffiliate?.(phone, password) || { ok: false, error: 'Not available.' }}
            onRequestWithdrawal={(affId, amt, phone, opts) => onRequestAffiliateWithdrawal?.(affId, amt, phone, opts) || { ok: false, error: 'Not available.' }}
            onNavigate={(v) => go(`/affiliate/${v}`)}
            onBack={() => go('/marketplace')}
          />
      );
    }

    if (route.name === 'renew' || route.name === 'pay') {
      const company = companies.find(c => c.slug === route.slug);
      if (!company) {
        return (
          <div className={`${th.card} ${th.cardBorder} rounded-2xl p-10 text-center max-w-md mx-auto`}>
            <div className={`text-sm font-black ${th.strongText}`}>{t('Kampuni haipatikani')}</div>
            <div className={`text-[11px] ${th.textMuted} font-semibold mt-1`}>{t('The store you are looking for does not exist.')}</div>
            <button onClick={() => go('/marketplace')} className={`mt-4 px-5 py-2.5 text-[11px] font-black rounded-xl ${th.btnPrimary} ${th.btnPrimaryText} cursor-pointer`}>
              {t('Back to Marketplace')}
            </button>
          </div>
        );
      }
      return (
        <SubscriptionPayment
          mode={route.name}
          company={company}
          currencies={currencies}
          subscriptionPlans={subscriptionPlans}
          companySubscriptions={companySubscriptions.filter(s => s.companyId === company.id)}
          payNumbers={payNumbers}
          theme={theme}
          t={t}
          prefillSubscriptionId={route.name === 'pay' ? route.subscriptionId : undefined}
          onSubmitSubscriptionPayment={(data) => onSubmitSubscriptionPayment({ ...data, companyId: company.id })}
          onBack={() => go(`/company/${company.slug}`)}
        />
      );
    }

    if (route.name === 'company') {
      const company = activeCompanies.find(c => c.slug === route.slug);
      if (!company) {
        return (
          <div className={`${th.card} ${th.cardBorder} rounded-2xl p-10 text-center max-w-md mx-auto`}>
            <div className={`text-sm font-black ${th.strongText}`}>{t('Kampuni haipatikani')}</div>
            <div className={`text-[11px] ${th.textMuted} font-semibold mt-1`}>{t('The store you are looking for does not exist.')}</div>
            <button onClick={() => go('/marketplace')} className={`mt-4 px-5 py-2.5 text-[11px] font-black rounded-xl ${th.btnPrimary} ${th.btnPrimaryText} cursor-pointer`}>
              {t('Back to Marketplace')}
            </button>
          </div>
        );
      }
      return (
        <>
          <QrScanBanner
            theme={theme}
            t={t}
            company={company}
            qr5Enabled={qr5Enabled}
            qr5DiscountPercent={qr5DiscountPercent}
            onRecordQrScan={(cid, pid, token, referrer, isAff) => onRecordQrScan?.(cid, pid, token, referrer, isAff)}
            onBrowseStore={() => go(`/company/${company.slug}`)}
          />
          <MarketplaceStorefront
            theme={theme}
            t={t}
            company={company}
            products={products.filter(p => p.companyId === company.id && isProductVisible(p))}
            cartItems={cart.items}
            onBack={() => go('/marketplace')}
            onAddToCart={addToCart}
            onOpenProduct={openProduct}
            onOpenCart={() => setCartOpen(true)}
            distanceKm={distanceFor(company.id)}
            reviews={reviews || []}
          />
        </>
      );
    }

    if (route.name === 'track') {
      return (
        <MarketplaceTrackOrder
          theme={theme}
          t={t}
          orders={orders}
          companies={companies}
          initialOrderNumber={route.orderNumber}
          onBack={() => go('/marketplace')}
          onViewCompany={openCompany}
        />
      );
    }

    if (route.name === 'orders') {
      return (
        <MarketplaceMyOrders
          theme={theme}
          t={t}
          orders={orders}
          customers={customers}
          companies={companies}
          session={session}
          onLogin={customerLogin}
          onLogout={customerLogout}
          onTrack={(orderNumber) => go(`/marketplace/track/${orderNumber}`)}
          onViewCompany={openCompany}
          onBack={() => go('/marketplace')}
        />
      );
    }

    // --- TRA COMPLIANCE: public "TRA & Tax" information page (/marketplace/terms-tra) ---
    if (route.name === 'terms-tra') {
      const th2 = getPublicTheme(theme);
      const sellers = activeCompanies.filter(c => c.tinNumber);
      return (
        <div className={`${th2.root} min-h-[70vh]`}>
          <div className="max-w-3xl mx-auto px-5 py-10 space-y-6">
            <button onClick={() => go('/marketplace')} className={`flex items-center gap-1.5 text-[11px] font-bold ${th2.textMuted} hover:underline cursor-pointer`}>
              <ChevronLeft className="w-4 h-4" /> {t('Back to Home')}
            </button>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-amber-100 text-amber-700"><Landmark className="w-6 h-6" /></div>
              <div>
                <h1 className={`text-xl md:text-2xl font-black ${th2.strongText}`}>{t('TRA & Tax Compliance')}</h1>
                <p className={`text-[11px] ${th2.textMuted} font-semibold`}>{t('How GlobalTradeCore handles Tanzania Revenue Authority obligations.')}</p>
              </div>
            </div>

            <section className={`${th2.card} ${th2.cardBorder} rounded-2xl p-6 space-y-4`}>
              <div className="space-y-2">
                <h2 className={`text-sm font-black ${th2.strongText}`}>1. {t('Registered Sellers (TIN)')}</h2>
                <p className={`text-[11px] ${th2.textMuted} leading-relaxed`}>
                  {t('Every company selling on GlobalTradeCore is required to provide its Taxpayer Identification Number (TIN). Currently')} <b>{sellers.length}</b> {t('of')} <b>{activeCompanies.length}</b> {t('active sellers have provided a TIN.')}
                </p>
              </div>
              <div className="space-y-2">
                <h2 className={`text-sm font-black ${th2.strongText}`}>2. {t('VAT')}</h2>
                <p className={`text-[11px] ${th2.textMuted} leading-relaxed`}>
                  {t('Sellers who are VAT-registered will issue a tax invoice with an EFD receipt. The standard VAT rate is 18%. For VAT-registered sellers, the VAT portion is calculated as 18/118 of the total price (VAT inclusive).')}
                </p>
              </div>
              <div className="space-y-2">
                <h2 className={`text-sm font-black ${th2.strongText}`}>3. {t('EFD Receipts')}</h2>
                <p className={`text-[11px] ${th2.textMuted} leading-relaxed`}>
                  {t('When a marketplace order is delivered, the seller records the EFD receipt number. GlobalTradeCore maintains monthly TRA reports per seller so the data can be submitted to the Tanzania Revenue Authority.')}
                </p>
              </div>
              <div className="space-y-2">
                <h2 className={`text-sm font-black ${th2.strongText}`}>4. {t('Marketplace Obligations')}</h2>
                <p className={`text-[11px] ${th2.textMuted} leading-relaxed`}>
                  {t('As the marketplace operator, GlobalTradeCore submits a monthly report of all sellers, their TIN, total sales and VAT to TRA in accordance with the Electronic Fiscal Devices Regulations and Income Tax Act, Chapter 332.')}
                </p>
              </div>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                <p className={`text-[10px] font-bold ${th2.textMuted}`}>
                  {t('Questions? Contact us:')} +255747876653 · globaltradecore@gmail.com · {t('TIN of GlobalTradeCore available on request.')}
                </p>
              </div>
            </section>
          </div>
        </div>
      );
    }

    // --- MEGA Phase 2C routes: offer / group deal / installments / live / delivery / loyalty / whatsapp bot ---
    if (['offer', 'group-deal', 'deals', 'installment-start', 'installment-order', 'live-shopping', 'live', 'track-delivery', 'loyalty', 'whatsapp-bot'].includes(route.name)) {
      return (
        <MarketplacePhase2C
          route={route}
          theme={theme}
          t={t}
          companies={activeCompanies}
          products={products}
          offers={offers || []}
          groupDeals={groupDeals || []}
          groupDealParticipants={groupDealParticipants || []}
          installmentPlans={installmentPlans || []}
          installmentOrders={installmentOrders || []}
          installmentPayments={installmentPayments || []}
          liveStreams={liveStreams || []}
          liveComments={liveComments || []}
          deliveries={deliveries || []}
          deliveryUpdates={deliveryUpdates || []}
          loyaltyCustomers={loyaltyCustomers || []}
          whatsappConversations={whatsappConversations || []}
          collectionSettings={collectionSettings}
          session={session}
          onNavigate={go}
          onBack={() => go('/marketplace')}
          onAddToCart={addToCart}
          onCheckout={() => { setCartOpen(false); go('/marketplace/checkout'); }}
          handlers={featureHandlers || defaultFeatureHandlers}
        />
      );
    }

    // --- MEGA CRITICAL FIX 2-in-1: buyer offers list (Ofa Zangu) ---
    if (route.name === 'offers') {
      return (
        <MegaOffers
          theme={theme}
          t={t}
          offers={offers || []}
          products={products}
          companies={companies}
          identityPhone={identityPhone || session?.phone || null}
          onBack={() => go('/marketplace')}
          onOpenProduct={openProduct}
          onOpenOffer={(id) => go(`/offer/${id}`)}
          onAcceptCounter={(id) => offerActions?.onAcceptCounter(id) || { ok: false }}
          onRejectCounter={(id) => offerActions?.onRejectCounter(id) || { ok: false }}
          onCounterAgain={(id, price, message) => offerActions?.onCounterAgain(id, price, message) || { ok: false }}
        />
      );
    }

    // --- MEGA BUILD: chat routes ---
    if (route.name === 'chat-conv' || route.name === 'chat') {
      return (
        <MegaChat
          theme={theme}
          t={t}
          mode="buyer"
          conversations={chatConversations || []}
          messages={chatMessages || []}
          products={products}
          companies={companies}
          buyerIdentity={identityPhone ? { phone: identityPhone, name: localStorage.getItem('tradecore_chat_name') || 'Mteja' } : null}
          initialConversationId={route.name === 'chat-conv' ? (route as any).conversationId : undefined}
          onSend={(convId: number, input: any) => chatHandlers?.onSend(convId, input)}
          onMarkRead={(convId: number) => chatHandlers?.onMarkRead(convId)}
          onOpenProduct={openProduct}
        />
      );
    }

    // --- MEGA BUILD: order detail with escrow ---
    if (route.name === 'order-detail') {
      const order = orders.find(o => o.orderNumber === (route as any).orderNumber);
      if (!order) return <div className="p-10 text-center text-sm text-gray-400">{t('Order not found.')}</div>;
      return (
        <MegaBuyerOrderDetail
          theme={theme}
          t={t}
          order={order}
          company={companies.find(c => c.id === order.companyId)}
          returns={[]}
          identityPhone={identityPhone}
          onVerifyPhone={(phone: string) => { localStorage.setItem('tradecore_buyer_phone', phone); return phone === order.customerPhone; }}
          onBack={() => go('/marketplace/orders')}
          onTrack={() => go('/marketplace/track')}
          onOpenCompany={() => { const comp = companies.find(c => c.id === order.companyId); if (comp) openCompany(comp.slug); }}
          onConfirmDelivery={(orderId: number) => onConfirmDelivery?.(orderId, 'buyer_confirm') || { ok: false }}
          onSubmitDispute={(ord: any, input: any) => onOpenDispute?.(ord, input) || { ok: false }}
        />
      );
    }

    // --- MEGA BUILD: stories view ---
    if (route.name === 'stories') {
      return (
        <div className={`${th.root} min-h-[60vh] p-4`}>
          <button onClick={() => go('/marketplace')} className={`flex items-center gap-1.5 text-[11px] font-bold ${th.textMuted} hover:underline cursor-pointer mb-4`}>
            <ChevronLeft className="w-4 h-4" /> {t('Back to Home')}
          </button>
          <StoriesBar
            theme={theme}
            t={t}
            stories={(stories || []).filter(s => s.isActive)}
            companies={companies}
            products={products}
            buyerPhone={identityPhone}
            onView={(storyId: number) => storiesHandlers?.onRecordView(storyId, identityPhone || undefined)}
            onOpenProduct={openProduct}
          />
        </div>
      );
    }

    // Home
    return (
      <div>
        {/* --- MEGA BUILD: Stories + Flash Sales on homepage --- */}
        {(stories || []).filter(s => s.isActive).length > 0 && (
          <div className={`${th.root} px-2 pt-2 pb-0`}>
            <StoriesBar
              theme={theme}
              t={t}
              stories={(stories || []).filter(s => s.isActive)}
              companies={companies}
              products={products}
              buyerPhone={identityPhone}
              onView={(storyId: number) => storiesHandlers?.onRecordView(storyId, identityPhone || undefined)}
              onOpenProduct={openProduct}
            />
          </div>
        )}
        {(flashSales || []).filter(fs => fs.status === 'active').length > 0 && (
          <div className={`${th.root} px-2 pt-1 pb-1`}>
            <FlashSalesSection
              theme={theme}
              t={t}
              flashSales={(flashSales || []).filter(fs => fs.status === 'active')}
              companies={companies}
              onOpenProduct={openProduct}
            />
          </div>
        )}
        <MarketplaceHome
          theme={theme}
          t={t}
          regions={regions}
          companies={activeCompanies}
          products={products}
          onOpenCompany={openCompany}
          onOpenProduct={openProduct}
          onTrackOrder={() => go('/marketplace/track')}
          onAddToCart={addToCart}
          onNavigate={go}
          onOpenWakala={() => go('/affiliate')}
          onOpenQr={() => onOpenQrPage?.()}
          voiceEnabled={voiceSearchEnabled !== false}
          qr5Enabled={qr5Enabled !== false}
          qr5DiscountPercent={qr5DiscountPercent}
          offerCount={offers.filter(o => o.status === 'pending' || o.status === 'countered').length}
          groupDealCount={groupDeals.filter(g => g.status === 'active').length}
          liveCount={liveStreams.filter(s => s.status === 'live').length}
        />
      </div>
    );
  };

  // Checkout is a special route that needs a cart + company
  return (
    <div className={th.root + ' min-h-screen'}>
      <GoldenTopLine theme={theme} />
      <MarketHeader
        theme={theme}
        t={t}
        language={language}
        onLanguageChange={changeLanguage}
        onToggleTheme={onToggleTheme}
        onHome={() => go('/marketplace')}
        onMyOrders={() => go('/marketplace/orders')}
        session={session}
        onLogout={customerLogout}
        cartCount={cartCount}
        onOpenCart={() => setCartOpen(true)}
        onSearch={() => go('/marketplace/search')}
        voiceMic={
          <div className="flex items-center gap-1.5">
            <MegaNotificationsBell
              theme={theme}
              t={t}
              notifications={buyerNotifications}
              onMarkAllRead={() => notificationHandlers?.onMarkAllRead()}
              onOpenItem={(n) => {
                if (n.type === 'new_message') go('/marketplace/chat');
                else if (n.type === 'order_update' || n.type === 'dispute') go('/marketplace/orders');
                else go('/marketplace');
              }}
            />
            <button
              onClick={() => setShowVisualSearch(true)}
              title={t('Piga Picha · Tafta Bidhaa')}
              className={`flex items-center justify-center w-8 h-8 rounded-lg transition cursor-pointer ${theme === 'milk' ? 'text-gray-600 hover:text-amber-700 hover:bg-amber-100' : 'text-gray-200 hover:text-white hover:bg-white/10'}`}
            >
              <Camera className="w-4 h-4" />
            </button>
            <VoiceMicButton theme={theme} t={t} compact onVoiceResult={handleVoiceResult} />
          </div>
        }
      />

      <main className="max-w-6xl mx-auto px-5 py-8">
        {checkoutRoute ? (
          placedInfo && placedInfo.reference ? (
            renderPhase2BSuccess()
          ) : cartCompany && cart.items.length > 0 ? (
            cartCompany.planType === 'direct' ? (
              <div className={`${th.card} ${th.cardBorder} rounded-2xl p-10 text-center max-w-lg mx-auto`}>
                <div className={`text-sm font-black ${th.strongText}`}>{t('This store uses Direct billing')}</div>
                <div className={`text-[11px] ${th.textMuted} font-semibold mt-2 leading-relaxed`}>
                  {t('Direct billing stores are paid directly by the buyer — there is no platform checkout. Contact the seller on WhatsApp to complete your order.')}
                </div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const num = (cartCompany.whatsappNumber || cartCompany.phone || '').replace(/[^0-9]/g, '');
                      if (num) {
                        const msg = `Habari ${cartCompany.name || ''}, nimeona bidhaa zako kwenye GlobalTradeCore.co.tz na ninataka kununua.\n\n`;
                        window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
                      }
                    }}
                    className={`px-5 py-2.5 text-[11px] font-black rounded-xl ${th.btnPrimary} ${th.btnPrimaryText} cursor-pointer inline-flex items-center justify-center gap-2`}
                  >
                    <MessageCircle className="w-4 h-4" /> {t('Contact Seller on WhatsApp')}
                  </button>
                  <button
                    onClick={() => go(`/company/${cartCompany.slug}`)}
                    className={`px-5 py-2.5 text-[11px] font-black rounded-xl border ${th.cardBorder} ${th.strongText} cursor-pointer`}
                  >
                    {t('Back to Store')}
                  </button>
                </div>
              </div>
            ) : (
              <MarketplaceCheckout
                theme={theme}
                t={t}
                regions={regions}
                company={cartCompany}
                cartItems={cart.items}
                onUpdateQty={updateQty}
                onRemove={removeItem}
                onBack={() => { setCartOpen(true); go(`/company/${cartCompany.slug}`); }}
                onSubmitOrder={placeOrder}
                onOrderPlaced={(orderNumber) => go(`/marketplace/track/${orderNumber}`)}
                collectionSettings={collectionSettings}
                collectionMode={collectionMode}
                onInitiateCollection={onInitiateCollection}
                liveStreamKey={liveStreamKeyForCheckout}
                shippingZones={shippingZones}
              />
            )
          ) : (
            <div className={`${th.card} ${th.cardBorder} rounded-2xl p-10 text-center max-w-md mx-auto`}>
              <div className={`text-sm font-black ${th.strongText}`}>{t('Your cart is empty')}</div>
              <div className={`text-[11px] ${th.textMuted} font-semibold mt-1`}>{t('Add products before checking out.')}</div>
              <button onClick={() => go('/marketplace')} className={`mt-4 px-5 py-2.5 text-[11px] font-black rounded-xl ${th.btnPrimary} ${th.btnPrimaryText} cursor-pointer`}>
                {t('Browse Marketplace')}
              </button>
            </div>
          )
        ) : (
          renderContent()
        )}
      </main>

      {/* Add-to-cart toast */}
      {notice && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-[11px] font-black px-4 py-2.5 rounded-xl shadow-2xl">
          {notice}
        </div>
      )}

      {/* Cart drawer (only outside checkout) */}
      {!checkoutRoute && (
        <MarketplaceCart
          theme={theme}
          t={t}
          open={cartOpen}
          onClose={() => setCartOpen(false)}
          company={cartCompany}
          cartItems={cart.items}
          onUpdateQty={updateQty}
          onRemove={removeItem}
          onClear={clearCart}
          onCheckout={() => go('/marketplace/checkout')}
        />
      )}

      <MarketFooter theme={theme} t={t} onHome={() => go('/marketplace')} onAdmin={onBackHome} onTra={() => go('/marketplace/terms-tra')} />

      {/* --- MEGA BUILD F3: visual search modal --- */}
      <MegaVisualSearch
        theme={theme}
        t={t}
        open={showVisualSearch || route.name === 'visual-search'}
        products={products}
        companies={companies}
        onClose={() => { setShowVisualSearch(false); if (route.name === 'visual-search') go('/marketplace'); }}
        onOpenProduct={(p) => { setShowVisualSearch(false); openProduct(p); }}
        onLogSearch={(rec) => visualSearchHandlers?.onLogSearch({ ...rec, id: Date.now(), createdAt: new Date().toISOString() })}
      />

      {/* --- MEGA BUILD F2: floating chat button --- */}
      {route.name !== 'chat' && route.name !== 'chat-conv' && (
        <button
          onClick={() => go('/marketplace/chat')}
          title={t('Chat na Muuzaji')}
          className="fixed bottom-5 right-5 z-50 w-13 h-13 p-3.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xl flex items-center justify-center transition"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}
