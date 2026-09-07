import { Company, Branch, Store, User, StockItem, PurchaseOrder, SalesOrder, Expense, Tax, Supplier, Customer, AuditTrail, SecurityLog, Settings, SubscriptionMeta, MarketplaceProduct, MarketplaceCustomer, MarketplaceOrder, HomepageContent, SiteConfig, Currency, TradeSubscriptionPlan, CollectionSetting, Offer, OfferMessage, GroupDeal, GroupDealParticipant, WhatsappConversation, NotificationLog, Delivery, DeliveryUpdate, InstallmentPlan, InstallmentOrder, InstallmentPayment, LiveStream, LiveComment, LoyaltyCustomer, LoyaltyTransaction, LoyaltyRedeemCode } from './types';
import { TANZANIA_REGIONS } from './utils/regions';

const today = new Date().toISOString().split('T')[0];
const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
const expIn12Days = new Date(Date.now() + 12 * 86400000).toISOString().split('T')[0];
const expIn3Days = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
const exp2DaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];
const expIn25Days = new Date(Date.now() + 25 * 86400000).toISOString().split('T')[0];

export const defaultSubscriptionMeta: SubscriptionMeta = {
  plans: [
    { id: 1, name: '1 Month Plan', priceTZS: 30000, priceUSD: 12, months: 1, features: ['1 Branch Administrator', 'POS & Stock Control', 'Reports & Receipts'], isActive: true, isMostPopular: false },
    { id: 2, name: '2 Months Plan', priceTZS: 50000, priceUSD: 20, months: 2, features: ['1 Branch Administrator', 'POS & Stock Control', 'Reports & Receipts', 'Email Support'], isActive: true, isMostPopular: true },
    { id: 3, name: '6 Months Plan', priceTZS: 140000, priceUSD: 55, months: 6, features: ['1 Branch Administrator', 'POS & Stock Control', 'Reports & Receipts', 'Priority Support'], isActive: true, isMostPopular: false },
    { id: 4, name: '1 Year Enterprise', priceTZS: 250000, priceUSD: 100, months: 12, features: ['1 Branch Administrator', 'POS & Stock Control', 'Reports & Receipts', 'AI Copilot', 'Priority Support'], isActive: true, isMostPopular: false }
  ],
  payNumbers: {
    mpesa: '*150*00#',
    tigopesa: '*150*01#',
    airtel: '*150*60#',
    bankName: 'NMB Bank',
    bankAccount: '1234567890',
    bankHolder: 'Global TradeCore & Enterprise Solutions',
    instructions: 'Pay via USSD to the numbers below, then enter your transaction reference (receipt ID) and upload a photo of the receipt for verification.'
  },
  paymentRequests: []
};

// --- New billing model: owner-defined currencies (TZS base) ---
export const defaultCurrencies: Currency[] = [
  { id: 1, code: 'TZS', symbol: 'TZS', name: 'Tanzanian Shilling', exchangeRate: 1, isActive: true },
  { id: 2, code: 'USD', symbol: '$', name: 'US Dollar', exchangeRate: 2600, isActive: true },
  { id: 3, code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', exchangeRate: 20, isActive: false },
  { id: 4, code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling', exchangeRate: 0.7, isActive: false }
];

// --- New billing model: the two subscription plans (owner-editable) ---
export const defaultTradePlans: TradeSubscriptionPlan[] = [
  {
    id: 1,
    name: 'Biashara Direct',
    slug: 'direct_premium',
    type: 'direct',
    basePriceTZS: 50000,
    commissionPercent: 0,
    maxProducts: 100,
    durationDays: 30,
    isActive: true,
    features: [
      'Full POS system with product management',
      'Customers pay you directly (WhatsApp)',
      'No platform commission',
      'Email support'
    ]
  },
  {
    id: 2,
    name: 'Biashara Commission',
    slug: 'commission_standard',
    type: 'commission',
    basePriceTZS: 30000,
    commissionPercent: 10,
    maxProducts: 50,
    durationDays: 30,
    isActive: true,
    features: [
      'Full POS system with product management',
      'Customers pay through the platform',
      'Adjustable platform commission',
      'Trusted customer payments'
    ]
  }
];

export const defaultHomepageContent: HomepageContent = {
  heroTitle: 'Tanzania\'s All-in-One Business & Wholesale Trading Platform',
  heroSubtitle: 'POS, FIFO stock control, financial reports and a public storefront marketplace for every Tanzanian business — register your company and start selling today.',
  heroStats: [
    { value: '4+', label: 'Subscription Plans' },
    { value: '24/7', label: 'Enterprise Availability' },
    { value: '256-bit', label: 'Transaction Security' },
    { value: '50k+', label: 'Records Managed' }
  ],
  overviewTitle: 'Everything your business needs to run smoothly',
  overviewText: 'From the counter to the boardroom, TradeCore gives you one connected command centre.',
  overviewFeatures: [
    { icon: 'shopping-cart', title: 'POS Sales', desc: 'Fast, offline-capable point-of-sale with multi-store support.' },
    { icon: 'package', title: 'Stock Control', desc: 'FIFO batch tracking, low-stock alerts and store-wise inventory.' },
    { icon: 'file-text', title: 'Financial Reports', desc: 'Real-time revenue, margin, expense and VAT/Tax reporting.' },
    { icon: 'bar-chart-3', title: 'Executive Copilot', desc: 'AI-driven insights, forecasting and fraud detection.' }
  ],
  featureCarousel: [
    { icon: 'boxes', title: 'FIFO Inventory Valuation', tag: 'Stock Control', desc: 'Batch-level first-in, first-out cost tracking so stock valuation and margin stay precise across every store.' },
    { icon: 'clipboard-check', title: 'POS Shift Reconciliation', tag: 'Point of Sale', desc: 'Open/close cashier shifts, match expected vs actual cash and close the day with a full variance audit.' },
    { icon: 'lock', title: 'Secure Audit Trails', tag: 'Security', desc: 'Tamper-proof, timestamped logs of every login, sale, transfer and configuration change in the business.' },
    { icon: 'cpu', title: 'Automated Workflows', tag: 'Automation', desc: 'Approvals, reorders, alerts and stock transfers that trigger automatically the moment rules are met.' },
    { icon: 'users', title: 'Team Management', tag: 'Organisation', desc: 'Roles, permissions and branch/store assignments that keep every user accountable and access tight.' },
    { icon: 'trending-up', title: 'Advanced Analytics', tag: 'Reporting', desc: 'Revenue, margin, expense and VAT dashboards with drill-downs for executives and branch admins.' },
    { icon: 'shield-check', title: 'Enterprise Security', tag: 'Security', desc: 'Bcrypt password hashing, 256-bit transport encryption and prepared statements on every query.' },
    { icon: 'layers', title: 'Multi-Branch Control', tag: 'Organisation', desc: 'One platform for head office, branches and stores — with per-store stock, prices and reporting.' }
  ],
  pricingTiers: [
    {
      name: 'Starter',
      price: 'TZS 50,000',
      period: '/month',
      popular: false,
      tagline: 'For single-store retail startups',
      features: ['1 Store', 'POS Sales & Receipts', 'Basic Stock Control', 'Expense Tracking', 'Standard Reports', 'Email Support']
    },
    {
      name: 'Professional',
      price: 'TZS 150,000',
      period: '/month',
      popular: true,
      tagline: 'For growing multi-store businesses',
      features: ['Up to 5 Stores', 'FIFO Inventory Valuation', 'POS Shift Reconciliation', 'Purchase Orders & Transfers', 'Advanced Financial Reports', 'Priority Support']
    },
    {
      name: 'Enterprise',
      price: 'TZS 400,000',
      period: '/month',
      popular: false,
      tagline: 'For branch networks & distributors',
      features: ['Unlimited Stores', 'Secure Audit Trails', 'Executive Copilot & Analytics', 'Custom Integrations', 'Dedicated Account Manager', '24/7 Priority Support']
    }
  ],
  aboutTitle: 'Built for Tanzanian trade, trusted across East Africa',
  aboutText: 'TradeCore is the operating system for Tanzanian retail, wholesale and distribution businesses — connecting every shop, branch and store on one secure platform.',
  aboutStats: [
    { value: '50+', label: 'Businesses Empowered' },
    { value: '120+', label: 'Stores Under Management' },
    { value: '24/7', label: 'Enterprise Support' },
    { value: '99.9%', label: 'Platform Uptime' }
  ],
  coreValues: [
    { icon: 'shield-check', title: 'Security First', desc: 'We protect every transaction and record with the same discipline used by banks.' },
    { icon: 'heart', title: 'Customer Success', desc: 'Your growth is our growth — we stay with you from onboarding to expansion.' },
    { icon: 'lightbulb', title: 'Innovation', desc: 'We continuously sharpen our platform so businesses keep moving forward.' },
    { icon: 'scale', title: 'Integrity', desc: 'Honest pricing, transparent reporting and accountable operations — always.' }
  ],
  testimonials: [
    { name: 'Asha M.', role: 'Retail Owner — Dar es Salaam', quote: 'TradeCore replaced our paper registers overnight. FIFO valuation finally tells me exactly what my shop is worth.', stars: 5 },
    { name: 'Daniel K.', role: 'Branch Administrator — Arusha', quote: 'The shift reconciliation at POS saves us hours every week. Cash and sales now balance without arguments.', stars: 5 },
    { name: 'Grace P.', role: 'Wholesale Distributor — Mwanza', quote: 'Audit trails give me total trust. I can see every transfer, every approval and every change across all my stores.', stars: 5 }
  ],
  faqItems: [
    { q: 'How do I register my business?', a: 'Click "Register" at the top of the page, complete the form, choose a plan and submit your payment details. A Super Admin verifies your payment and activates your subscription — you will be notified when you can sign in.' },
    { q: 'What payment methods do you accept?', a: 'We accept mobile money (Tigo Pesa, M-Pesa, Airtel Money), international bank wire and PayPal. The active pay numbers and account details are shown on the registration page.' },
    { q: 'How long does payment verification take?', a: 'Verification is usually completed within a few hours of your submission. Until then your account sits safely in the Pending Verification queue.' },
    { q: 'Is my business data secure?', a: 'Yes. All passwords are hashed with Bcrypt, every database call uses prepared statements, connections are encrypted, and every action is written to a tamper-proof audit trail.' },
    { q: 'Can I try TradeCore before paying?', a: 'Absolutely. Use the "Start 1-Day Free Demo" button to explore the full platform with a demo company, store and sample data — no payment required.' },
    { q: 'Do you provide training and support?', a: 'Yes. We provide onboarding guidance and responsive support by phone or email. Enterprise customers also get a dedicated account manager.' }
  ]
};

export const defaultSiteConfig: SiteConfig = {
  siteName: 'GlobalTradeCore',
  tagline: 'POS, Stock & Wholesale Marketplace for Tanzanian Business',
  supportPhone: '+255 700 000 000',
  supportEmail: 'globaltradecore@gmail.com',
  commissionPct: '5'
};

export const defaultCollectionSettings: CollectionSetting[] = [
  {
    id: 1,
    network: 'mpesa',
    displayName: 'M-Pesa',
    isActive: true,
    payNumber: '2557XXXXXX',
    accountName: 'Tanzania Trade Core',
    logo: '/images/mpesa.png',
    instructions: 'Send to M-Pesa number {payNumber} then enter the Transaction ID below.'
  },
  {
    id: 2,
    network: 'tigopesa',
    displayName: 'Tigo Pesa',
    isActive: true,
    payNumber: '25571XXXXX',
    accountName: 'Tanzania Trade Core',
    logo: '/images/tigopesa.png',
    instructions: 'Send to Tigo Pesa number {payNumber} then enter the Transaction ID below.'
  },
  {
    id: 3,
    network: 'airtelmoney',
    displayName: 'Airtel Money',
    isActive: true,
    payNumber: '2557XXXXXX',
    accountName: 'Tanzania Trade Core',
    logo: '/images/airtelmoney.png',
    instructions: 'Send to Airtel Money number {payNumber} then enter the Transaction ID below.'
  },
  {
    id: 4,
    network: 'halopesa',
    displayName: 'HaloPesa',
    isActive: true,
    payNumber: '2557XXXXXX',
    accountName: 'Tanzania Trade Core',
    logo: '/images/halopesa.png',
    instructions: 'Send to HaloPesa number {payNumber} then enter the Transaction ID below.'
  },
  {
    id: 5,
    network: 'azampesa',
    displayName: 'AzamPesa',
    isActive: false,
    payNumber: '2557XXXXXX',
    accountName: 'Tanzania Trade Core',
    logo: '/images/azampesa.png',
    instructions: 'Send to AzamPesa number {payNumber} then enter the Transaction ID below.'
  }
];

export const defaultSettings: Settings = {
  language: 'en',
  currency: 'USD',
  exchangeRate: 1,
  subscriptionMeta: defaultSubscriptionMeta,
  currencies: defaultCurrencies,
  subscriptionPlans: defaultTradePlans,
  companySubscriptions: [],
  homepageContent: defaultHomepageContent,
  siteConfig: defaultSiteConfig,
  marketplaceRegions: [...TANZANIA_REGIONS],
  homepageMeta: {
    title: 'GlobalTradeCore — POS, Stock & Wholesale Marketplace for Tanzanian Business',
    description: 'All-in-one POS, FIFO stock control, financial reports and public storefront marketplace for Tanzanian retail, wholesale and distribution businesses.'
  },
  // --- MEGA Phase 2B: multi-network collection (manual by default, auto ready) ---
  collectionMode: 'manual',
  collectionSettings: defaultCollectionSettings,
  azampayCollectionEnabled: false,
  beemCollectionEnabled: false,
  azampayAppName: '',
  azampayClientId: '',
  azampayClientSecret: '',
  azampayWebhookSecret: '',
  // --- MEGA Phase 2C: WhatsApp AI bot + loyalty (log/manual by default, no keys required) ---
  whatsappBot: {
    enabled: true,
    mode: 'log',
    apiKey: '',
    phoneId: '',
    welcomeMessage: 'Karibu TradeCore! Tafuta bidhaa kwa kuandika jina, mji na size. Mfano: "viatu size 42 Dodoma"',
    fallbackMessage: 'Samahani, sikuipata bidhaa hiyo. Jaribu kuandika jina tofauti, mfano: kitenge, simu, viatu, mchele.'
  },
  loyalty: {
    pointsPer1000: 100,
    pointsToTzsRate: 100,
    bronzeMin: 0,
    silverMin: 5000,
    goldMin: 20000,
    platinumMin: 50000
  }
};

export const defaultRolePermissions: Record<string, string[]> = {
  'Super Admin': [
    'dashboard', 'stock-items', 'purchase-order', 'sales-order', 'expenses', 'receipts', 'ai-copilot',
    'companies', 'branches', 'stores', 'customers', 'suppliers', 'categories', 'taxes', 'data-recovery', 'exchange-rate',
    'import-stock', 'import-customers', 'import-suppliers',
    'report-transaction', 'report-financial', 'report-daily', 'report-monthly', 'report-sales', 'report-purchase',
    'report-sales-outstanding', 'report-purchase-outstanding', 'report-lowstock', 'report-po-details', 'report-shifts',
    'user-info', 'user-access', 'subscriptions',
    'marketplace-orders', 'marketplace-settings'
  ],
  'Admin': [
    'dashboard', 'stock-items', 'purchase-order', 'sales-order', 'expenses', 'receipts', 'ai-copilot',
    'branches', 'stores', 'customers', 'suppliers', 'categories', 'taxes', 'data-recovery', 'exchange-rate',
    'import-stock', 'import-customers', 'import-suppliers',
    'report-transaction', 'report-financial', 'report-daily', 'report-monthly', 'report-sales', 'report-purchase',
    'report-sales-outstanding', 'report-purchase-outstanding', 'report-lowstock', 'report-po-details', 'report-shifts',
    'user-info',
    'marketplace-orders', 'marketplace-settings'
  ],
  'Retailer': [
    'dashboard', 'stock-items', 'sales-order', 'expenses', 'receipts', 'ai-copilot',
    'report-transaction', 'report-daily', 'report-sales', 'report-sales-outstanding', 'report-lowstock', 'report-shifts',
    'marketplace-orders', 'marketplace-settings'
  ],
  'Wholesaler': [
    'dashboard', 'stock-items', 'purchase-order', 'sales-order', 'expenses', 'receipts', 'ai-copilot',
    'import-stock', 'import-customers', 'import-suppliers',
    'report-transaction', 'report-daily', 'report-sales', 'report-purchase',
    'report-sales-outstanding', 'report-purchase-outstanding', 'report-lowstock', 'report-po-details', 'report-shifts',
    'marketplace-orders', 'marketplace-settings'
  ],
  'Store Admin': [
    'dashboard', 'stock-items', 'purchase-order', 'sales-order', 'expenses', 'receipts', 'ai-copilot',
    'report-transaction', 'report-daily', 'report-sales', 'report-purchase',
    'report-sales-outstanding', 'report-purchase-outstanding', 'report-lowstock', 'report-po-details', 'report-shifts',
    'user-info',
    'marketplace-orders', 'marketplace-settings'
  ],
  'Branch Administrator': [
    'dashboard', 'stock-items', 'purchase-order', 'sales-order', 'expenses', 'receipts', 'ai-copilot',
    'report-transaction', 'report-daily', 'report-sales', 'report-purchase',
    'report-sales-outstanding', 'report-purchase-outstanding', 'report-lowstock', 'report-po-details', 'report-shifts',
    'user-info',
    'marketplace-orders', 'marketplace-settings'
  ]
};

export const defaultCompanies: Company[] = [
  { id: 1, name: "Alpha Global Retail Corp", logoUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=120&auto=format&fit=crop&q=60", subscriptionEnd: "2027-12-31", subscriptionApproved: true, themeColor: "#c41e3a", country: "Tanzania",
    slug: "alpha-global-retail-corp", description: "Wholesale and retail supplier of food products, household goods and business supplies — Dar es Salaam.", category: "Retail & Wholesale",
    region: "Dar es Salaam", district: "Ilala", ward: "Kariakoo", latitude: -6.8175, longitude: 39.2732, phone: "+255747876653",
    isVerified: true, isMarketplaceActive: true,
    paymentMethods: [
      { id: 1, companyId: 1, methodType: 'mpesa', accountName: 'Alpha Global Retail Corp', accountNumber: '0711000111', instructions: 'Lipa kwenye M-Pesa 0711 000 111 — Jina: Alpha Global Retail Corp' },
      { id: 2, companyId: 1, methodType: 'bank', accountName: 'Alpha Global Retail Corp', accountNumber: '2010123456789', instructions: 'NMB Bank — A/C 2010123456789' }
    ]
  },
  { id: 2, name: "Beta Distributors Ltd", logoUrl: "https://images.unsplash.com/photo-1542744094-3a31f103e35f?w=120&auto=format&fit=crop&q=60", subscriptionEnd: "2026-11-30", subscriptionApproved: true, themeColor: "#1e3a8a", country: "Tanzania",
    slug: "beta-distributors-ltd", description: "Msambazaji wa vifaa vya elektroniki, simu na vifaa vya ofisi — Arusha.", category: "Electronics Distribution",
    region: "Arusha", district: "Arusha City", ward: "Sekei", latitude: -3.3869, longitude: 36.6830, phone: "+255688222333",
    isVerified: true, isMarketplaceActive: true,
    paymentMethods: [
      { id: 1, companyId: 2, methodType: 'tigopesa', accountName: 'Beta Distributors Ltd', accountNumber: '0688222333', instructions: 'Lipa kwenye Tigo Pesa 0688 222 333 — Jina: Beta Distributors Ltd' },
      { id: 2, companyId: 2, methodType: 'lipa_number', accountName: 'Beta Distributors Ltd', accountNumber: '5234567', instructions: 'M-Pesa Lipa Namba 5234567 — Beta Distributors Ltd' }
    ]
  }
];

export const defaultMarketplaceProducts: MarketplaceProduct[] = [];

export const defaultMarketplaceCustomers: MarketplaceCustomer[] = [];

export const defaultMarketplaceOrders: MarketplaceOrder[] = [];

export const defaultBranches: Branch[] = [
  { id: 1, companyId: 1, name: "DSM HQ Main Branch" },
  { id: 2, companyId: 1, name: "DSM Northern Hub" },
  { id: 3, companyId: 2, name: "Beta Arusha Depot" }
];

export const defaultStores: Store[] = [
  { id: 1, branchId: 1, name: "DSM Store Alpha", location: "Downtown", phone: "+255 22 1234" },
  { id: 2, branchId: 2, name: "DSM Store Beta", location: "Uptown", phone: "+255 22 5678" },
  { id: 3, branchId: 3, name: "Arusha Warehouse", location: "Industrial Block", phone: "+255 27 9876" }
];

export const defaultUsers: User[] = [
  { id: 4, username: 'root_mandate', password: 'sha256$83d902232c93a96990cd3013fb694df1b3e3031e6afb8fb1e402f0478c0de7d4', role: 'Super Admin', name: 'Root Mandate', email: 'globaltradecore@gmail.com', companyId: null, branchId: null, storeId: null, firstLogin: true, status: 'Active', isRoot: true },
  { id: 5, username: 'superadmin', password: 'sha256$daa62f6fcc24de4977b4c73eb5cf2f78e56950e2e0c4de2316399a09a1139890', role: 'Super Admin', name: 'Global Super Admin', email: 'superadmin@tradecore.com', companyId: null, branchId: null, storeId: null, firstLogin: true, status: 'Active' },
  { id: 1, username: 'admin', password: 'sha256$afe1b7a51c5b5201f3c79f903de5a513172de6760d8ae3be64edf7959c14d3ec', role: 'Admin', name: 'Alpha Manager', email: 'admin@tradecore.com', companyId: 1, branchId: null, storeId: null, firstLogin: true, status: 'Active' },
  { id: 2, username: 'retailer', password: 'sha256$42f164df6191123a8a2d18507b2b54fe78782349aee758230557c95905a7a776', role: 'Retailer', name: 'Sarah Chen', email: 'retail@tradecore.com', companyId: 1, branchId: 1, storeId: 1, firstLogin: true, status: 'Active' },
  { id: 3, username: 'wholesaler', password: 'sha256$c56f4cad86de5e7c7656ae2e8a67a73994c0937dfe92360e4b4b773027917b0d', role: 'Wholesaler', name: 'Mike Wilson', email: 'wholesale@tradecore.com', companyId: 1, branchId: 2, storeId: 2, firstLogin: true, status: 'Active' }
];

export const defaultCategories: string[] = ['Cereals', 'Oil', 'Household', 'Building', 'Electronics'];

export const defaultTaxes: Tax[] = [
  { id: 1, name: 'VAT', rate: 18, type: 'Percentage' },
  { id: 2, name: 'Withholding', rate: 2, type: 'Percentage' }
];

export const defaultSuppliers: Supplier[] = [
  { id: 1, name: 'Singida Grain Millers', phone: '+255 26 250 1001', email: 'orders@singidagrain.co.tz', contact: 'Juma M.' },
  { id: 2, name: 'Twiga Cement Distributors', phone: '+255 22 286 5000', email: 'sales@twiga.co.tz', contact: 'Asha K.' }
];

export const defaultCustomers: Customer[] = [
  { id: 1, name: 'BestBuy Wholesale Ltd', type: 'Wholesale', phone: '+255 711 000 111', email: 'info@bestbuy.co.tz', creditLimit: 200000, balance: 4700.5 },
  { id: 2, name: 'TechWorld Retail', type: 'Retail', phone: '+255 688 222 333', email: 'sales@techworld.com', creditLimit: 100000, balance: 5000 },
  { id: 3, name: 'MobileHub Distributors', type: 'Wholesale', phone: '+255 754 444 555', email: 'orders@mobilehub.co.tz', creditLimit: 500000, balance: 0 }
];

export const defaultStockItems: StockItem[] = [
  { id: 1, companyId: 1, name: 'Sony WH-1000XM5', code: 'SONY-WH5-BLK', category: 'Electronics', stock: { 1: 8, 2: 5, 3: 2 }, purchasePrice: 280, retailPrice: 399, wholesalePrice: 349, lowStockQty: 10, unit: 'Package', expiryDate: expIn12Days },
  { id: 2, companyId: 1, name: 'Mahindi (Maize) 50kg', code: 'MAZ-50', category: 'Cereals', stock: { 1: 120, 2: 80, 3: 200 }, purchasePrice: 18, retailPrice: 25, wholesalePrice: 22, lowStockQty: 5, unit: 'Kg' },
  { id: 3, companyId: 1, name: 'Mafuta ya Alizeti 20L', code: 'MAF-20', category: 'Oil', stock: { 1: 45, 2: 30, 3: 60 }, purchasePrice: 24, retailPrice: 32, wholesalePrice: 29, lowStockQty: 5, unit: 'Litres', expiryDate: expIn3Days },
  { id: 4, companyId: 1, name: 'Mchele Singida 25kg', code: 'MCH-25', category: 'Cereals', stock: { 1: 1000, 2: 50, 3: 110 }, purchasePrice: 22, retailPrice: 30, wholesalePrice: 26, lowStockQty: 5, unit: 'Kg', expiryDate: exp2DaysAgo },
  { id: 5, companyId: 1, name: 'Sukari 50kg', code: 'SUK-50', category: 'Household', stock: { 1: 3500, 2: 25, 3: 40 }, purchasePrice: 50, retailPrice: 65, wholesalePrice: 58, lowStockQty: 5, unit: 'Kg', expiryDate: expIn25Days },
  { id: 6, companyId: 1, name: 'Cement Twiga 50kg', code: 'CEM-TW', category: 'Building', stock: { 1: 5200, 2: 150, 3: 300 }, purchasePrice: 7, retailPrice: 9.5, wholesalePrice: 8.5, lowStockQty: 5, unit: 'Package' }
];

export const defaultPurchaseOrders: PurchaseOrder[] = [
  { id: 1, poNumber: 'PO-2024-1001', supplierId: 1, storeId: 1, date: today, status: 'Received', items: [{ productId: 1, qty: 100, cost: 280 }, { productId: 4, qty: 225, cost: 22 }], total: 32970 },
  { id: 2, poNumber: 'PO-2024-1002', supplierId: 2, storeId: 1, date: yesterday, status: 'Received', items: [{ productId: 6, qty: 500, cost: 7 }], total: 3500 }
];

export const defaultSalesOrders: SalesOrder[] = [
  { id: 1, soNumber: 'SO-2024-5001', customerId: 1, storeId: 1, date: today, priceType: 'Wholesale', items: [{ productId: 1, qty: 70, price: 349, cost: 280 }, { productId: 4, qty: 173, price: 26, cost: 22 }], total: 28930, profit: 3500, status: 'Completed' },
  { id: 2, soNumber: 'SO-2024-5002', customerId: 2, storeId: 1, date: today, priceType: 'Retail', items: [{ productId: 1, qty: 3, price: 399, cost: 280 }, { productId: 3, qty: 3, price: 32, cost: 24 }], total: 1293, profit: 340, status: 'Completed' },
  { id: 3, soNumber: 'SO-2024-5003', customerId: 3, storeId: 1, date: yesterday, priceType: 'Wholesale', items: [{ productId: 1, qty: 30, price: 349, cost: 280 }, { productId: 3, qty: 52, price: 29, cost: 24 }], total: 11990, profit: 1000, status: 'Completed' }
];

export const defaultExpenses: Expense[] = [
  { id: 1, expenseNumber: 'EXP-2026-0001', category: 'Rent', description: 'Store Premises Rent (January 2026)', amount: 450, date: today, storeId: 1, paymentMethod: 'Bank' },
  { id: 2, expenseNumber: 'EXP-2026-0002', category: 'Utilities', description: 'Electricity and Power Supply Grid', amount: 85, date: today, storeId: 1, paymentMethod: 'Cash' },
  { id: 3, expenseNumber: 'EXP-2026-0003', category: 'Transport', description: 'Transporting grain from depot', amount: 150, date: yesterday, storeId: 1, paymentMethod: 'Mobile Money' }
];

export const defaultAuditTrails: AuditTrail[] = [];
export const defaultSecurityLogs: SecurityLog[] = [];

// --- MEGA Phase 1: Kiswahili↔English search synonyms (ROOT_MANDATE editable) ---
export const defaultSearchSynonyms: { id: number; keyword: string; synonyms: string[] }[] = [
  { id: 1, keyword: 'viatu', synonyms: ['shoes', 'kiatu', 'sneakers', 'viatu vya kiume', 'viatu vya wanawake', 'sandals'] },
  { id: 2, keyword: 'kitenge', synonyms: ['kitenge', 'leso', 'kanga', 'fabric', 'tissue', 'tanzania kitenge', 'vitezi'] },
  { id: 3, keyword: 'gauni', synonyms: ['dress', 'dresses', 'gauni ya wanawake', 'maxi dress', 'mavazi'] },
  { id: 4, keyword: 'shati', synonyms: ['shirt', 'shirts', 't-shirt', 'tshirt', 'chemise', 'viatu na shati'] },
  { id: 5, keyword: 'suruali', synonyms: ['trouser', 'trousers', 'jeans', 'pants', 'suruali ya kiume', 'denim'] },
  { id: 6, keyword: 'simu', synonyms: ['phone', 'phones', 'smartphone', 'simu ya mkononi', 'mobile', 'iphone', 'samsung'] },
  { id: 7, keyword: 'laptop', synonyms: ['laptop', 'computer', 'kompyuta', 'pc', 'notebook', 'macbook'] },
  { id: 8, keyword: 'nguo', synonyms: ['clothes', 'clothing', 'mavazi', 'nguo za mtumba', 'second hand', 'mitumba'] },
  { id: 9, keyword: 'vifaa', synonyms: ['electronics', 'equipment', 'gadgets', 'vifaa vya umeme', 'appliances', 'devices'] },
  { id: 10, keyword: 'mapambo', synonyms: ['jewellery', 'jewelry', 'accessories', 'decorations', 'pambo', 'bling'] },
  { id: 11, keyword: 'mkoba', synonyms: ['bag', 'bags', 'handbag', 'backpack', 'wallet', 'mkoba wa wanawake'] },
  { id: 12, keyword: 'kahawa', synonyms: ['coffee', 'kahawa ya tanzania', 'coffee beans', 'arusha coffee'] },
  { id: 13, keyword: 'chai', synonyms: ['tea', 'chai ya tanzania', 'tea leaves', 'green tea'] },
  { id: 14, keyword: 'asali', synonyms: ['honey', 'asali ya nyuki', 'organic honey'] },
  { id: 15, keyword: 'mafuta', synonyms: ['oil', 'cooking oil', 'mafuta ya alizeti', 'sumbu', 'mafuta ya kupikia'] },
  { id: 16, keyword: 'mchele', synonyms: ['rice', 'paddy', 'mchele wa mbeya', 'rice 25kg'] },
  { id: 17, keyword: 'unga', synonyms: ['flour', 'maize flour', 'sembe', 'unga wa mahindi', 'dona'] },
  { id: 18, keyword: 'kofia', synonyms: ['cap', 'hat', 'kuofia', 'kofia ya kiume'] },
  { id: 19, keyword: 'saa', synonyms: ['watch', 'watches', 'clock', 'saa ya mkono', 'wristwatch'] },
  { id: 20, keyword: 'miwani', synonyms: ['glasses', 'sunglasses', 'spectacles', 'eyewear'] }
];

export const defaultAffiliateCommissionPercent = 2;

// --- MEGA Phase 2C: 7 killer features — empty defaults ---
export const defaultOffers: Offer[] = [];
export const defaultOfferMessages: OfferMessage[] = [];
export const defaultGroupDeals: GroupDeal[] = [];
export const defaultGroupDealParticipants: GroupDealParticipant[] = [];
export const defaultWhatsappConversations: WhatsappConversation[] = [];
export const defaultNotificationLogs: NotificationLog[] = [];
export const defaultDeliveries: Delivery[] = [];
export const defaultDeliveryUpdates: DeliveryUpdate[] = [];
export const defaultInstallmentPlans: InstallmentPlan[] = [];
export const defaultInstallmentOrders: InstallmentOrder[] = [];
export const defaultInstallmentPayments: InstallmentPayment[] = [];
export const defaultLiveStreams: LiveStream[] = [];
export const defaultLiveComments: LiveComment[] = [];
export const defaultLoyaltyCustomers: LoyaltyCustomer[] = [];
export const defaultLoyaltyTransactions: LoyaltyTransaction[] = [];
export const defaultLoyaltyRedeemCodes: LoyaltyRedeemCode[] = [];
