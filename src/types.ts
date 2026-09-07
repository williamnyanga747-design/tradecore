export interface Company {
  id: number;
  name: string;
  logoUrl?: string;
  themeColor?: string; // Hex color string, e.g. "#c41e3a"
  subscriptionEnd?: string; // e.g. "2026-08-01"
  subscriptionApproved?: boolean;
  isDeleted?: boolean;
  language?: LanguageType;
  currency?: CurrencyType;
  exchangeRate?: number;
  // --- Subscription & Registration fields ---
  subscriptionStart?: string;
  planId?: number;
  planName?: string;
  paymentReference?: string;
  paymentMethod?: string;
  receiptImageUrl?: string;
  status?: string; // 'Pending Payment' | 'Active' | 'Rejected' | 'Demo'
  isDemo?: boolean;
  demoExpiresAt?: string;
  adminNote?: string;
  country?: string;
  // --- Public Marketplace (storefront) fields ---
  slug?: string;
  coverImage?: string;
  description?: string;
  category?: string;
  region?: string;
  district?: string;
  ward?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  whatsappNumber?: string; // WhatsApp business number used by "Order via WhatsApp" (e.g. 255712345678)
  isVerified?: boolean;
  isMarketplaceActive?: boolean;
  paymentMethods?: CompanyPaymentMethod[];
  // --- New billing model: plan type, billing currency & commission snapshot ---
  planType?: TradePlanType; // 'direct' (pay seller) | 'commission' (pay platform)
  currencyCode?: string; // Billing currency chosen at registration (e.g. TZS, USD)
  commissionPercentSnapshot?: number; // % commission captured from the plan at registration
  // --- Store location (map) ---
  addressText?: string; // human address line (reverse geocoded or typed by the seller)
  // --- Reviews & rating ---
  averageRating?: number; // recalculated from approved reviews (0 when none)
  reviewsCount?: number; // count of approved reviews
  // --- MEGA ULTIMATE: store QR code (QR Code ya Duka la Mtaa) ---
  qrCodeToken?: string; // unique scan token, e.g. 8F3K2Q9A1Z (public /company?qr=1&ref_qr=...)
  qrScans?: number; // total scans of this store QR
  qrCodePath?: string; // data URL of the generated QR image (cached)
  defaultAffiliatePercent?: number; // per-company affiliate commission % (overrides global default)
  // --- TRA COMPLIANCE (Tanzania Revenue Authority) ---
  tinNumber?: string; // TIN ya TRA (9-12 digits)
  vrnNumber?: string; // VAT Registration Number
  isVatRegistered?: boolean; // "Nimesajiliwa VAT?"
  businessLicense?: string; // data URL of the uploaded business license
  tinVerified?: boolean; // ROOT admin marked this TIN as verified
  tinVerifiedAt?: string;
  totalSalesAmount?: number; // cumulative total sales for TRA reporting
}

/** EFD / TRA receipt tracking per delivered order. */
export type TraReceiptStatus = 'pending' | 'issued' | 'failed';

export interface TraReceipt {
  id: number;
  orderId: number;
  orderNumber: string;
  companyId: number;
  tinNumber?: string;
  customerName: string;
  amount: number;
  vatAmount: number;
  efdReceiptNumber?: string; // company-entered EFD receipt number
  status: TraReceiptStatus;
  traResponse?: any; // reserved for future EFDMS API integration
  createdAt: string;
}

export interface CompanyPaymentMethod {
  id: number;
  companyId: number;
  methodType: 'mpesa' | 'tigopesa' | 'airtelmoney' | 'halopesa' | 'lipa_number' | 'bank';
  accountName: string;
  accountNumber: string;
  instructions?: string;
  isActive?: boolean;
}

export interface MarketplaceProduct {
  id: number;
  companyId: number;
  name: string;
  slug: string;
  description: string;
  price: number; // TZS
  stockQuantity: number;
  image: string; // data URL main image
  gallery?: string[]; // extra images (1-6 total, at least 1)
  video?: string; // optional single video (data URL) — mp4/mov/webm
  category?: string;
  isActive?: boolean;
  status?: 'pending' | 'approved' | 'rejected';
  // --- Reviews & rating ---
  averageRating?: number; // recalculated from approved reviews (0 when none)
  reviewsCount?: number; // count of approved reviews
  // --- MEGA ULTIMATE: per-product affiliate commission override (%) ---
  affiliateCommissionPercent?: number; // 0-50; fallback to company/global default
  qrScans?: number; // total scans of this product QR
  // --- Shipping ---
  weightKg?: number; // product weight in kg (for shipping calc)
  shippingZoneIds?: number[]; // which shipping zones this product ships to (empty = all zones)
  freeShipping?: boolean; // if true, no shipping fee for this product
  // --- Multi-Store Location Mapping: physical Master Data stores where this item is available ---
  // Empty/undefined = fall back to the company's Main HQ location (Marketplace Settings -> Store Profile).
  storeIds?: number[];
}

/** Public marketplace product reviews (pending until approved by ROOT_MANDATE). */
export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface Review {
  id: number;
  companyId: number;
  productId: number | null;
  userId: number | null; // marketplace customer id (null for anonymous)
  reviewerName: string;
  reviewerPhone?: string;
  rating: number; // 1-5
  comment?: string; // max 1000 chars
  isVerifiedBuyer: boolean;
  status: ReviewStatus;
  ipAddress?: string;
  createdAt: string;
  decidedAt?: string;
}

/** One product-page view (analytics). Throttled to 1 view per product per 1 hour per device. */
export interface ProductView {
  id: number;
  productId: number;
  companyId: number;
  viewedAt: string; // ISO
}

/** Tracks public marketplace engagement clicks (e.g. "order via WhatsApp"). */
export interface MarketplaceClick {
  id: number;
  productId: number;
  type: 'whatsapp';
  companyId?: number;
  createdAt: string;
}

export interface MarketplaceCustomer {
  id: number;
  name: string;
  phone: string;
  email?: string;
  password?: string; // hashed (sha256$...)
  region?: string;
  district?: string;
  ward?: string;
  street?: string;
  latitude?: number;
  longitude?: number;
  isGuest: boolean;
  createdAt: string;
  locale?: string; // en | sw | fr | es (default 'en')
}

export type MarketplaceOrderStatus = 'pending_verification' | 'verified' | 'processing' | 'out_for_delivery' | 'delivered' | 'rejected';

export interface MarketplaceOrderItem {
  productId: number;
  productName: string;
  productImage?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface MarketplaceOrder {
  id: number;
  orderNumber: string; // TRD-YYYY-XXXXX
  companyId: number;
  customerId?: number | null;
  customerName: string;
  customerPhone: string;
  customerRegion: string;
  customerDistrict: string;
  customerWard: string;
  customerStreet: string;
  deliveryInstructions?: string;
  latitude?: number;
  longitude?: number;
  totalAmount: number;
  amountPaid: number;
  paymentMethodType: string;
  transactionId: string;
  receiptImage?: string; // data URL
  status: MarketplaceOrderStatus;
  rejectionReason?: string;
  verifiedBy?: string;
  verifiedById?: number;
  verifiedAt?: string;
  items: MarketplaceOrderItem[];
  customerType: 'guest' | 'account';
  createdAt: string;
  updatedAt?: string;
  // --- Commission billing (commission plans) ---
  commissionPercent?: number; // % snapshot from the seller's subscription at order time
  commissionAmount?: number; // commissionAmount = totalAmount * commissionPercent / 100
  payToSellerDone?: boolean; // ROOT_MANDATE marked this order as paid out to the seller
  // --- MEGA Phase 2B: multi-network collection ---
  paymentStatus?: string; // 'manual_pending_approval' | 'processing' | 'completed' | 'failed' (blank = legacy paid-at-order)
  collectionReference?: string; // COL-... linking this order to its CollectionRecord
  // --- MEGA BUILD F1: ESCROW + MOBILE MONEY ---
  escrowStatus?: EscrowStatus; // held after paid → released/refunded/disputed
  escrowAmount?: number;
  escrowReleasedAt?: string;
  paymentPhone?: string; // phone used for mobile money payment / STK push
  mpesaTransactionId?: string; // simulated STK push transaction id
  codConfirmed?: boolean; // company confirmed cash received on delivery
  deliveredAt?: string; // stamped when company marks delivered — starts the 48h window
  autoReleaseAt?: string; // deliveredAt + 48h — cron releases escrow after this
  archivedAt?: string; // CRITICAL FIX Part 1 — TRA archive: delivered orders only (kept for tax reporting, hidden from Active list)
  deletedAt?: string; // CRITICAL FIX Part 1 — soft-delete → Trash: pending/rejected orders only; delivered orders can NEVER be deleted (TRA)
  // --- Shipping ---
  shippingZoneId?: number;
  shippingZoneName?: string;
  shippingFee?: number;
  shippingWeightKg?: number;
}

// --- SHIPPING ZONES ---
export interface ShippingZone {
  id: number;
  companyId: number;
  name: string;
  regions: string[]; // e.g. ['Dar es Salaam', 'Arusha']
  baseFee: number; // TZS base shipping fee
  perKgRate: number; // TZS per additional kg
  estimatedDays: number; // delivery estimate in days
  isActive: boolean;
  createdAt: string;
}

// --- MEGA BUILD F1: ESCROW ---
export type EscrowStatus = 'held' | 'released' | 'refunded' | 'disputed';
export type MegaPaymentMethod = 'wallet' | 'm_pesa' | 'tigo_pesa' | 'airtel_money' | 'halopesa' | 'cod';

export interface EscrowTransaction {
  id: number;
  orderId: number;
  orderNumber: string;
  buyerId?: number | null;
  companyId: number;
  amount: number;
  status: EscrowStatus;
  method: MegaPaymentMethod;
  heldAt: string;
  releasedAt?: string;
  refundedAt?: string;
  createdAt: string;
}

export interface Currency {
  id: number;
  code: string; // ISO code, e.g. TZS, USD, KES, UGX
  symbol: string; // display symbol, e.g. TZS, $, KSh
  name: string; // human name, e.g. Tanzanian Shilling
  exchangeRate: number; // 1 unit of this currency = X TZS (TZS itself = 1)
  isActive: boolean; // only active currencies appear in the registration selector
}

export type TradePlanType = 'direct' | 'commission';

export interface TradeSubscriptionPlan {
  id: number;
  name: string;
  slug: string; // unique, e.g. direct_premium | commission_standard
  type: TradePlanType;
  basePriceTZS: number; // monthly price expressed in TZS
  commissionPercent: number; // 0-100; 0 for direct plans
  maxProducts: number; // product listing cap
  features: string[];
  durationDays: number; // e.g. 30
  isActive: boolean;
}

export type CompanySubscriptionStatus = 'pending' | 'active' | 'expired';

export interface CompanySubscription {
  id: number;
  companyId: number;
  planId: number;
  planName: string;
  planSlug: string;
  planType: TradePlanType;
  currencyCode: string;
  amountPaid: number; // in chosen billing currency
  amountTzs: number; // equivalent in TZS
  commissionPercentSnapshot: number;
  status: CompanySubscriptionStatus;
  startsAt?: string;
  endsAt?: string;
  paymentProof?: string; // receipt image data URL
  paymentReference?: string;
  paymentMethod?: string;
  adminNote?: string;
  createdAt: string;
}

export interface Branch {
  id: number;
  companyId: number;
  name: string;
  isDeleted?: boolean;
}

export interface Store {
  id: number;
  branchId: number;
  name: string;
  location: string;
  phone: string;
  isDeleted?: boolean;
  // --- Multi-Store Location Mapping (Master Data -> physical branch) ---
  latitude?: number;
  longitude?: number;
  googleMapsUrl?: string;
  isMarketplaceVisible?: boolean; // show this branch's pin on the public product map
  operatingHours?: string; // e.g. "Mon–Sat 08:00–18:00"
}

export interface User {
  id: number;
  username: string;
  password?: string; // Kept secure or editable
  role: 'Super Admin' | 'Admin' | 'Branch Administrator' | 'Store Admin' | 'Retailer' | 'Wholesaler';
  name: string;
  email: string;
  companyId: number | null;
  branchId: number | null;
  storeId: number | null;
  firstLogin: boolean;
  status: 'Active' | 'Blocked';
  allowedPages?: string[];
  remoteTerminated?: boolean;
  remoteTerminatedAt?: string;
  locale?: string; // en | sw | fr | es (default 'en')
  isRoot?: boolean; // ROOT_MANDATE God Mode — full platform control
}

export interface InventoryBatch {
  id: string;
  poNumber?: string;
  supplierName?: string;
  qty: number;
  initialQty: number;
  cost: number;
  receivedDate: string;
  expiryDate?: string;
}

export interface StockItem {
  id: number;
  companyId?: number | null; // Company ownership ID for company-exclusive privacy
  name: string;
  code: string;
  isDeleted?: boolean;
  category: string;
  stock: { [storeId: number]: number };
  purchasePrice: number;
  retailPrice: number;
  wholesalePrice: number;
  partnerPrice?: number;
  lowStockQty: number;
  unit?: string;
  imageUrl?: string;
  expiryDate?: string; // Optional Expiry Date field (YYYY-MM-DD)
  expiryDates?: { [storeId: number]: string }; // Store-specific expiry dates (storeId -> YYYY-MM-DD)
  batches?: { [storeId: number]: InventoryBatch[] }; // FIFO Batch Tracking per store
  useSubUnitPricing?: boolean;
  subUnitName?: string;
  subUnitConversion?: number;
  subUnitRetailPrice?: number;
  subUnitWholesalePrice?: number;
  subUnitPartnerPrice?: number;
  companyPrices?: {
    [companyId: number]: {
      purchasePrice: number;
      retailPrice: number;
      wholesalePrice: number;
      partnerPrice?: number;
      subUnitRetailPrice?: number;
      subUnitWholesalePrice?: number;
      subUnitPartnerPrice?: number;
    }
  };
  storePrices?: {
    [storeId: number]: {
      purchasePrice: number;
      retailPrice: number;
      wholesalePrice: number;
      partnerPrice?: number;
      subUnitRetailPrice?: number;
      subUnitWholesalePrice?: number;
      subUnitPartnerPrice?: number;
    }
  };
  updated_at?: number; // millisecond watermark for per-record optimistic locking (micro-update)
}

export interface POItem {
  productId: number;
  qty: number;
  cost: number;
  discount?: number; // item-level discount in absolute value (in currency)
  unitType?: 'main' | 'sub';
  subUnitName?: string;
}

export interface PurchaseOrder {
  id: number;
  poNumber: string;
  supplierId: number;
  storeId: number;
  date: string;
  status: 'Pending' | 'Received';
  items: POItem[];
  total: number;
  paymentTerms?: string; // 'Paid in Full' | 'Credit / On Account' | 'Partial Deposit'
  isDeleted?: boolean;
}

export interface SOItem {
  productId: number;
  qty: number;
  price: number;
  cost: number;
  unitType?: 'main' | 'sub';
  subUnitName?: string;
}

export interface SalesOrder {
  id: number;
  soNumber: string;
  customerId: number;
  storeId: number;
  date: string;
  priceType: 'Retail' | 'Wholesale' | 'Preferred';
  items: SOItem[];
  total: number;
  profit: number;
  status: 'Completed' | 'Voided';
  paymentMethod?: 'Cash' | 'Bank' | 'Mobile Money' | 'Split';
  paymentStatus?: 'Paid' | 'Credit' | 'Partial';
  paymentSplit?: { cash: number; bank: number; mobile: number };
}

export interface Expense {
  id: number;
  expenseNumber: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  storeId: number;
  paymentMethod: 'Cash' | 'Bank' | 'Mobile Money';
}

export interface Tax {
  id: number;
  name: string;
  rate: number;
  type: 'Percentage';
  storeId?: number | null;
  companyId?: number | null;
}

export interface Supplier {
  id: number;
  name: string;
  phone: string;
  email: string;
  contact: string;
  storeId?: number | null;
}

export interface Customer {
  id: number;
  name: string;
  type: 'Retail' | 'Wholesale' | 'Preferred';
  phone: string;
  email: string;
  creditLimit: number;
  balance: number;
  storeId?: number | null;
}

export interface AuditTrail {
  id: string;
  userId: number;
  username: string;
  role: string;
  action: string;
  details: string;
  companyId: number | null | undefined;
  timestamp: string;
}

export interface SecurityLog {
  id: string;
  username: string;
  status: 'Success' | 'Failed' | 'Auto-Blocked' | 'Remote Terminated';
  ipAddress: string;
  browserFingerprint: string;
  userAgent: string;
  timestamp: string;
  failureReason?: string;
  deviceRecognized: boolean;
  companyId?: number | null;
}

export type CurrencyType = 'USD' | 'TZS' | 'KES' | 'UGD' | 'UGX' | 'RWF' | 'EUR' | 'GBP';

export type LanguageType = 'en' | 'sw' | 'fr' | 'es';

export interface HomepageContent {
  heroTitle: string;
  heroSubtitle: string;
  heroStats: { value: string; label: string }[];
  overviewTitle: string;
  overviewText: string;
  overviewFeatures: { icon: string; title: string; desc: string }[];
  featureCarousel: { icon: string; title: string; tag: string; desc: string }[];
  pricingTiers: { name: string; price: string; period: string; popular: boolean; tagline: string; features: string[] }[];
  aboutTitle: string;
  aboutText: string;
  aboutStats: { value: string; label: string }[];
  coreValues: { icon: string; title: string; desc: string }[];
  testimonials: { name: string; role: string; quote: string; stars: number }[];
  faqItems: { q: string; a: string }[];
}

export interface SiteConfig {
  siteName?: string;
  tagline?: string;
  supportPhone?: string;
  supportEmail?: string;
  commissionPct?: string;
}

export interface Settings {
  language: LanguageType;
  currency: CurrencyType;
  exchangeRate: number;
  companyLanguages?: Record<number, LanguageType>;
  companyCurrencies?: Record<number, CurrencyType>;
  companyExchangeRates?: Record<number, number>;
  companyTaxes?: Record<number, Tax[]>;
  userCurrencies?: Record<string, CurrencyType>;
  userExchangeRates?: Record<string, number>;
  allowNegativeStock?: boolean;
  allowGamesEnabled?: boolean;
  autoWeeklyBackupEnabled?: boolean;
  deletedDefaultUsers?: string[];
  subscriptionMeta?: SubscriptionMeta;
  homepageContent?: HomepageContent; // Editable public homepage (ROOT editor)
  siteConfig?: SiteConfig; // Global site branding & contact info (ROOT editor)
  marketplaceRegions?: string[]; // Editable Tanzania region list (ROOT editor)
  homepageMeta?: { title?: string; description?: string }; // SEO meta for the public homepage
  // --- New billing model (ROOT_MANDATE editable) ---
  currencies?: Currency[]; // owner-defined exchange rates (TZS base)
  subscriptionPlans?: TradeSubscriptionPlan[]; // direct/commission plans
  companySubscriptions?: CompanySubscription[]; // billing history per company
  // --- MEGA Phase 1 (ROOT_MANDATE editable) ---
  affiliateCommissionPercent?: number; // affiliate referral commission % (0-20, default 2)
  // --- MEGA ULTIMATE: MFUMO WA WAKALA · TAFTA KWA SAUTI · QR CODE YA DUKA ---
  affiliateMinWithdrawal?: number; // min withdrawal amount in TZS (default 10000)
  affiliateDefaultPercent?: number; // default affiliate commission % (default 2)
  voiceSearchEnabled?: boolean; // master switch for voice search (default true)
  qr5Enabled?: boolean; // QR discount banner master switch (default true)
  qr5DiscountPercent?: number; // discount % for QR5 scans (default 5)
  // --- MEGA Phase 2B (ROOT_MANDATE editable) ---
  collectionMode?: 'manual' | 'auto'; // 'manual' = show numbers + upload proof; 'auto' = USSD push via API
  collectionSettings?: CollectionSetting[]; // per-network pay numbers / instructions / active flags
  azampayCollectionEnabled?: boolean; // master switch (default false)
  beemCollectionEnabled?: boolean; // future BEEM switch (default false)
  azampayAppName?: string;
  azampayClientId?: string;
  azampayClientSecret?: string;
  azampayWebhookSecret?: string; // if set, webhook signature is validated
  // --- MEGA Phase 2C: 7 killer features (ROOT_MANDATE editable) ---
  whatsappBot?: WhatsappBotSettings;
  loyalty?: LoyaltySettings;
}

export interface SubscriptionPlan {
  id: number;
  name: string;
  priceTZS: number;
  priceUSD?: number;
  months: number;
  features?: string[];
  isActive: boolean;
  isMostPopular?: boolean;
}

export interface PayNumbersConfig {
  mpesa: string;
  tigopesa: string;
  airtel: string;
  bankName: string;
  bankAccount: string;
  bankHolder: string;
  instructions: string;
}

export interface PaymentConfirmationRequest {
  id: string;
  companyId: number;
  companyName: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  planId: number;
  planName: string;
  amount: number;
  paymentMethod: string;
  paymentReference: string;
  receiptImageUrl?: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Resubmitted';
  adminNote?: string;
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
}

export interface SubscriptionMeta {
  plans: SubscriptionPlan[];
  payNumbers: PayNumbersConfig;
  paymentRequests: PaymentConfirmationRequest[];
}

export interface PosShift {
  id: number;
  userId: number;
  username: string;
  storeId: number;
  openTime: string;
  closeTime?: string;
  openingFloat: number;
  closingCashActual?: number;
  expectedCashSales?: number;
  salesOrderIds: number[];
  status: 'Open' | 'Closed';
  variance?: number;
  notes?: string;
}

export interface StockTransfer {
  id: number;
  transferNumber: string;
  productId: number;
  fromStoreId: number;
  toStoreId: number;
  qty: number;
  status: 'Pending' | 'In-Transit' | 'Completed' | 'Rejected';
  createdAt: string;
  sentAt?: string;
  receivedAt?: string;
}

export interface ContactMessage {
  id: number;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: 'new' | 'answered';
  createdAt: string;
}

// =============================================================
// MEGA PHASE 1 — WALLET, AFFILIATE, PWA PUSH, AI SEARCH
// =============================================================

export type WalletTxnType = 'credit' | 'debit' | 'withdrawal_request' | 'withdrawal_approved';
export type WalletTxnStatus = 'pending' | 'completed' | 'rejected';

/** Seller wallet (one per company, manual M-Pesa payouts — Phase 1, no BEEM). */
export interface SellerWallet {
  id: number;
  companyId: number;
  balance: number; // TZS available to withdraw
  totalEarned: number; // lifetime credits from commission sales
  totalWithdrawn: number; // lifetime approved withdrawals
  updatedAt: string;
}

export interface WalletTransaction {
  id: number;
  walletId: number;
  companyId: number;
  type: WalletTxnType;
  amount: number;
  description: string;
  orderId?: number | null;
  status: WalletTxnStatus;
  reference?: string;
  createdAt: string;
}

export type WithdrawalStatus = 'pending' | 'approved' | 'rejected';

/** Seller M-Pesa withdrawal request (ROOT pays manually then approves). */
export interface Withdrawal {
  id: number;
  companyId: number;
  companyName?: string;
  amount: number;
  phoneNumber: string; // M-Pesa number to receive
  status: WithdrawalStatus;
  adminNote?: string;
  requestedAt: string;
  approvedAt?: string;
  decidedBy?: string;
}

export interface Affiliate {
  id: number;
  userId?: number | null;
  name: string;
  phone: string;
  referralCode: string; // unique, e.g. WAKALA-8F3K2Q or juma123 (legacy)
  balance: number;
  totalEarned: number;
  totalWithdrawn: number;
  isActive: boolean;
  createdAt: string;
  // --- MEGA ULTIMATE: MFUMO WA WAKALA (public portal) ---
  status?: 'active' | 'pending' | 'suspended'; // pending until approved by ROOT
  region?: string;
  district?: string;
  ward?: string;
  nida?: string; // optional National ID
  totalClicks?: number;
  totalSales?: number;
  password?: string; // hashed (sha256$...) for wakala portal login
  registeredBy?: 'self' | 'company' | 'root';
  approvedAt?: string;
}

export interface AffiliateClick {
  id: number;
  affiliateId: number;
  ipAddress?: string;
  userAgent?: string;
  url?: string;
  clickedAt: string;
}

export type AffiliateSaleStatus = 'pending' | 'approved' | 'paid' | 'cancelled' | 'rejected';

export interface AffiliateSale {
  id: number;
  affiliateId: number;
  orderId: number;
  orderNumber?: string;
  companyId: number;
  productId?: number | null;
  amount: number; // order total
  commissionAmount: number;
  commissionPercent: number;
  status: AffiliateSaleStatus;
  createdAt: string;
}

export interface AffiliateWithdrawal {
  id: number;
  affiliateId: number;
  amount: number;
  phoneNumber: string;
  method?: string; // 'mpesa' | 'tigopesa' | 'bank'
  accountName?: string;
  bankName?: string;
  status: WithdrawalStatus;
  requestedAt: string;
  approvedAt?: string;
  decidedBy?: string;
}

/** One Swahili voice-search query (TAFTA KWA SAUTI). */
export interface VoiceSearchLog {
  id: number;
  query: string; // normalized search text after Swahili stopword stripping
  transcript: string; // raw speech transcript
  matches: number; // number of results found
  language: string; // e.g. 'sw-TZ'
  createdAt: string;
}

/** One QR scan of a store/product QR (QR CODE YA DUKA LA MTAA). */
export interface QrScanLog {
  id: number;
  companyId: number;
  productId?: number | null;
  token: string;
  referrer?: string;
  ipAddress?: string;
  isAffiliate?: boolean; // true when the link carried ?ref=...
  scannedAt: string;
}

/** Kiswahili↔English search synonym group (keyword + expansions). */
export interface SearchSynonym {
  id: number;
  keyword: string;
  synonyms: string[]; // e.g. ["shoes","kiatu","sneakers"]
}

/** Browser Web Push subscription persisted for a company/user (Phase 1 = store only). */
export interface PushSubscriptionRec {
  id: number;
  companyId?: number | null;
  userId?: number | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: string;
}

// =============================================================
// MEGA PHASE 2B — MULTI-NETWORK COLLECTION (M-PESA / TIGO / AIRTEL / HALOPESA)
// =============================================================

export type CollectionNetwork = 'mpesa' | 'tigopesa' | 'airtelmoney' | 'halopesa' | 'azampesa';

export type CollectionStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'manual_pending_approval';

export type CollectionMode = 'manual' | 'auto';

/** ROOT-editable per-network collection instructions (mirrors collection_settings table). */
export interface CollectionSetting {
  id: number;
  network: CollectionNetwork;
  displayName: string;
  isActive: boolean;
  payNumber: string; // e.g. 2557XXXXXX — ROOT edits in /admin/collection-settings
  accountName: string;
  logo?: string; // e.g. /images/mpesa.png
  instructions: string;
}

/** One customer payment attempt toward an order (manual or AzamPay auto). */
export interface CollectionRecord {
  id: number;
  orderId?: number | null;
  companyId: number;
  customerName?: string;
  customerPhone: string;
  network: CollectionNetwork;
  amount: number;
  amountTzs: number;
  currencyCode: string;
  status: CollectionStatus;
  reference: string; // COL-123456
  azampayTransactionId?: string;
  providerResponse?: string; // JSON string from the gateway
  mode: CollectionMode;
  transactionId?: string; // manual mode: customer's M-Pesa/Tigo/Airtel transaction ID
  proofImage?: string; // manual mode: receipt screenshot (data URL)
  adminNote?: string;
  decidedBy?: string;
  createdAt: string;
  updatedAt: string;
}

/** Incoming payment-gateway webhook call (debug / audit). */
export interface WebhookLog {
  id: number;
  provider: string;
  event: string;
  status: 'received' | 'processed' | 'signature_failed';
  note?: string;
  payload?: string; // JSON string
  receivedAt: string;
}

/** Commission kept by the platform when a collection completes. */
export interface AdminEarning {
  id: number;
  companyId: number;
  orderId?: number | null;
  reference: string; // order number
  amount: number; // order total (customer paid)
  commissionAmount: number; // kept by platform
  sellerAmount: number; // credited to seller wallet
  createdAt: string;
}

// =============================================================
// MEGA PHASE 2C — 7 KILLER FEATURES
// (Piga Bei · Nunua Pamoja · WhatsApp AI · Bodaboda Tracking · Lipa Pole Pole · Live Shopping · Loyalty)
// All flows work in LOG/MANUAL mode without any API keys (Phase 1).
// =============================================================

/** SMS / web-push record. Phase 1 = status 'logged' (no gateway keys required). */
export type NotificationKind = 'sms' | 'push';
export interface NotificationLog {
  id: number;
  kind: NotificationKind;
  to: string; // phone number (sms) or company/user reference (push)
  title?: string;
  message: string;
  url?: string;
  status: 'logged' | 'sent' | 'failed';
  mode: 'log' | 'live';
  createdAt: string;
}

// --- 1. PIGA BEI / HAGGLING ---
export type OfferStatus = 'pending' | 'accepted' | 'countered' | 'rejected' | 'expired' | 'paid';

export interface Offer {
  id: number;
  productId: number;
  companyId: number;
  customerName: string;
  customerPhone: string;
  originalPrice: number;
  offeredPrice: number;
  counterPrice?: number;
  finalPrice?: number;
  sellerMessage?: string; // reason on reject / note on counter (MEGA CRITICAL FIX 2-in-1)
  buyerMessage?: string; // optional message from the buyer when offering
  status: OfferStatus;
  expiresAt: string; // offered price valid +24h
  acceptedExpiresAt?: string; // payment lock +2h after accept
  paymentReference?: string; // collection reference for offer checkout
  orderId?: number | null; // created order once paid
  createdAt: string;
}

export interface OfferMessage {
  id: number;
  offerId: number;
  senderType: 'customer' | 'seller';
  message?: string;
  price?: number;
  createdAt: string;
}

// --- 2. NUNUA PAMOJA / GROUP BUYING ---
export type GroupDealStatus = 'active' | 'completed' | 'expired' | 'cancelled';

export interface GroupDeal {
  id: number;
  productId: number;
  companyId: number;
  soloPrice: number;
  groupPrice: number;
  minBuyers: number;
  maxBuyers?: number;
  currentBuyersCount: number;
  paidCount: number;
  expiresAt: string;
  shareCode: string; // 8-char invite code
  status: GroupDealStatus;
  createdAt: string;
}

export type GroupParticipantStatus = 'joined' | 'paid' | 'cancelled';

export interface GroupDealParticipant {
  id: number;
  groupDealId: number;
  customerName: string;
  customerPhone: string;
  status: GroupParticipantStatus;
  amountPaid?: number;
  reference?: string; // GROUP-{dealId}-{phone}
  orderId?: number | null;
  joinedAt: string;
  paidAt?: string;
}

// --- 3. WHATSAPP AI BOT ---
export type WhatsappBotMode = 'log' | 'live';
export type WhatsappConversationStatus = 'pending' | 'replied' | 'failed' | 'logged_test';

export interface WhatsappConversation {
  id: number;
  phone: string;
  messageIn: string;
  messageOut?: string;
  intent?: string;
  productIds?: number[];
  status: WhatsappConversationStatus;
  mode: WhatsappBotMode;
  createdAt: string;
}

export interface WhatsappBotSettings {
  enabled: boolean;
  mode: WhatsappBotMode;
  apiKey: string;
  phoneId: string;
  welcomeMessage: string;
  fallbackMessage: string;
}

// --- 4. BODABODA LIVE TRACKING ---
export type DeliveryStatus = 'pending' | 'assigned' | 'picked' | 'on_the_way' | 'delivered' | 'cancelled';

export interface Delivery {
  id: number;
  orderId: number;
  collectionId?: number | null;
  companyId: number;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerLat?: number;
  customerLng?: number;
  riderName?: string;
  riderPhone?: string;
  riderLat?: number;
  riderLng?: number;
  status: DeliveryStatus;
  trackingCode: string; // TRACK-{orderId}-{rand}
  estimatedMinutes?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryUpdate {
  id: number;
  deliveryId: number;
  status: string;
  lat?: number;
  lng?: number;
  note?: string;
  createdAt: string;
}

// --- 5. LIPA POLE POLE / BNPL ---
export interface InstallmentPlan {
  id: number;
  productId: number;
  companyId: number;
  totalPrice: number;
  downPaymentPercent: number; // 20-50
  installmentsCount: number; // 2-6
  installmentPercentExtra: number; // 0-10 riba per installment
  status: 'active' | 'inactive';
  createdAt: string;
}

export type InstallmentOrderStatus = 'pending_down' | 'active' | 'completed' | 'defaulted' | 'cancelled';

export interface InstallmentOrder {
  id: number;
  productId: number;
  companyId: number;
  installmentPlanId: number;
  customerName: string;
  customerPhone: string;
  totalPrice: number;
  downPayment: number;
  remaining: number;
  installmentAmount: number;
  installmentsCount: number;
  paidInstallments: number;
  totalPaid: number;
  status: InstallmentOrderStatus;
  nextDueDate?: string;
  trackingCode: string; // LP-{random}
  orderId?: number | null;
  createdAt: string;
}

export type InstallmentPaymentType = 'down' | 'installment';
export type InstallmentPaymentStatus = 'pending' | 'completed' | 'failed' | 'manual_pending';

export interface InstallmentPayment {
  id: number;
  installmentOrderId: number;
  amount: number;
  type: InstallmentPaymentType;
  status: InstallmentPaymentStatus;
  reference?: string; // LP-{orderId}-D / LP-{orderId}-I{n}
  collectionId?: number | null;
  dueDate?: string;
  paidAt?: string;
  createdAt: string;
}

// --- 6. LIVE SHOPPING (TikTok-style) ---
export type LiveStreamStatus = 'scheduled' | 'live' | 'ended' | 'cancelled';

export interface LiveStream {
  id: number;
  companyId: number;
  title: string;
  description?: string;
  productIds: number[];
  featuredProductId?: number;
  status: LiveStreamStatus;
  scheduledAt?: string;
  startedAt?: string;
  endedAt?: string;
  streamKey: string; // LIVE-{random}
  viewersCount: number;
  likesCount: number;
  createdAt: string;
}

export type LiveCommentType = 'comment' | 'want' | 'paid';

export interface LiveComment {
  id: number;
  liveStreamId: number;
  customerName: string;
  customerPhone?: string;
  message: string;
  type: LiveCommentType;
  productId?: number;
  createdAt: string;
}

// --- 7. LOYALTY / POINTI ZA MTEJA ---
export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface LoyaltyCustomer {
  id: number;
  phone: string;
  name?: string;
  totalPoints: number;
  usedPoints: number;
  balancePoints: number;
  totalSpent: number;
  tier: LoyaltyTier;
  createdAt: string;
  updatedAt: string;
}

export type LoyaltyTxnType = 'earn' | 'redeem' | 'expired';

export interface LoyaltyTransaction {
  id: number;
  loyaltyCustomerId: number;
  type: LoyaltyTxnType;
  points: number;
  description: string;
  orderId?: number | null;
  reference?: string;
  code?: string; // LOYALTY-{phone}-{rand} (redeem)
  codeValueTzs?: number;
  codeUsed?: boolean;
  createdAt: string;
}

export interface LoyaltySettings {
  pointsPer1000: number; // default 100 → every TZS 1,000 spent earns 100 points
  pointsToTzsRate: number; // default 100 → 100 points = TZS 1,000 discount
  bronzeMin: number;
  silverMin: number;
  goldMin: number;
  platinumMin: number;
}

export interface LoyaltyRedeemCode {
  code: string;
  phone: string;
  valueTzs: number;
  used: boolean;
  orderId?: number | null;
  createdAt: string;
}

// ============================================================================
// MEGA BUILD — 7 ULTIMATE FEATURES
// ============================================================================

// --- F2: REAL-TIME CHAT BUYER <-> SELLER ---
export interface ChatConversation {
  id: number;
  buyerId?: number | null;
  buyerPhone: string;
  buyerName: string;
  companyId: number;
  productId?: number | null; // product that started the chat (nullable)
  lastMessage: string;
  lastMessageAt: string;
  unreadBuyer: number; // unread count for the buyer side
  unreadCompany: number; // unread count for the company side
  createdAt: string;
}

export interface ChatMessage {
  id: number;
  conversationId: number;
  senderType: 'buyer' | 'company' | 'admin';
  senderName: string;
  message: string; // original text (or image data URL when messageType=image)
  messageType: 'text' | 'image' | 'product' | 'system';
  productId?: number | null; // for product-share cards
  imageData?: string; // data URL for image messages
  isRead: boolean;
  translatedMessage?: string; // auto-translation to the opposite language
  originalLang: 'sw' | 'en';
  createdAt: string;
}

// --- F3: VISUAL SEARCH ---
export interface VisualSearchRecord {
  id: number;
  userId?: number | null;
  imagePath: string; // data URL thumbnail of the uploaded photo
  detectedColors: string[]; // hex codes, e.g. ['#c19a6b', ...]
  detectedColorNames: string[]; // english names, e.g. ['brown', 'yellow']
  detectedCategory?: string; // best-effort category guess
  resultsCount: number;
  createdAt: string;
}

// --- F4: RETURNS & DISPUTE CENTER ---
export type ReturnReason = 'wrong_item' | 'damaged' | 'not_as_described' | 'size_issue' | 'fake' | 'late_delivery' | 'other';

export interface ProductReturn {
  id: number;
  orderId: number;
  orderNumber: string;
  buyerId?: number | null;
  buyerPhone: string;
  buyerName: string;
  companyId: number;
  reason: ReturnReason;
  description: string;
  images?: string[]; // up to 5 data URLs
  desiredSolution: 'refund' | 'replacement';
  status: 'pending' | 'approved' | 'rejected' | 'refunded' | 'completed';
  refundAmount?: number;
  responseNote?: string;
  respondedAt?: string;
  createdAt: string;
}

export interface Dispute {
  id: number;
  orderId: number;
  orderNumber: string;
  returnId?: number | null;
  buyerPhone: string;
  buyerName: string;
  companyId: number;
  reason: string;
  description: string;
  status: 'open' | 'under_review' | 'resolved_buyer' | 'resolved_seller' | 'closed';
  resolution?: string;
  adminNotes?: string;
  escrowFrozen: boolean;
  createdAt: string;
  resolvedAt?: string;
}

export interface DisputeMessage {
  id: number;
  disputeId: number;
  senderType: 'buyer' | 'company' | 'admin';
  senderName: string;
  message: string;
  createdAt: string;
}

// --- F5: FLASH SALES + NOTIFICATIONS ---
export interface FlashSaleItem {
  productId: number;
  productName: string;
  productImage?: string;
  originalPrice: number;
  flashPrice: number;
  discountPercent: number;
  stock: number;
  sold: number;
}

export interface FlashSale {
  id: number;
  companyId: number;
  title: string;
  slug: string;
  startTime: string; // ISO
  endTime: string; // ISO
  status: 'upcoming' | 'active' | 'ended';
  bannerImage?: string;
  items: FlashSaleItem[];
  createdAt: string;
}

export interface AppNotification {
  id: number;
  audiencePhone?: string; // target customer phone (undefined = broadcast)
  companyId?: number | null; // target company (seller notifications)
  type: 'flash_sale' | 'order_update' | 'new_message' | 'dispute' | 'general' | 'offer_update';
  title: string;
  message: string;
  data?: {
    productId?: number;
    orderId?: number;
    conversationId?: number;
    disputeId?: number;
    url?: string;
  };
  isRead: boolean;
  createdAt: string;
}

// --- F6: BULK UPLOAD ---
export interface BulkUploadRowError {
  row: number;
  message: string;
}

export interface BulkUploadJob {
  id: number;
  companyId: number;
  fileName: string;
  totalRows: number;
  successRows: number;
  failedRows: number;
  errors: BulkUploadRowError[];
  status: 'processing' | 'completed' | 'failed';
  createdAt: string;
}

// --- F8: STORIES (72H) ---
export interface Story {
  id: number;
  companyId: number;
  type: 'image' | 'video';
  mediaPath: string; // data URL
  caption?: string;
  productId?: number | null; // linked product ("Nunua Sasa")
  views: number;
  expiresAt: string; // createdAt + 72h
  isActive: boolean;
  createdAt: string;
  fileSizeBytes?: number; // original upload size
  videoDurationSeconds?: number; // probed at upload time
}

export interface StoryView {
  id: number;
  storyId: number;
  viewerPhone?: string;
  viewerType: 'buyer' | 'guest';
  viewedAt: string;
}

