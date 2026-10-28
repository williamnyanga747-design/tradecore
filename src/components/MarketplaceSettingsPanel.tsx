import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Store as StoreIcon, CreditCard, Package, Plus, Pencil, Trash2, Save, ImagePlus, X, Check, Upload, Video, Play, AlertTriangle, MessageCircle, BarChart3, Sparkles, MapPin, Loader2, ShieldCheck, ExternalLink } from 'lucide-react';
import { compressImageFile, formatByteSize } from '../utils/imageCompression';
import { Company, CompanyPaymentMethod, MarketplaceProduct, MarketplaceClick, Review, ProductView, FlashSale, Story, ChatConversation, ChatMessage, ProductReturn, Dispute, DisputeMessage, BulkUploadJob, ShippingZone, Store } from '../types';
import { PublicTheme, getPublicTheme } from '../utils/publicTheme';
import { TANZANIA_REGIONS } from './../utils/regions';
import { slugify } from './../utils/haversine';
import { ConfirmActionModal } from './ConfirmActionModal';
import { toast } from './../utils/toast';
import { TZS } from './marketplace/MarketplaceShared';
import LocationPicker from './marketplace/LocationPicker';
import SellerAnalytics from './marketplace/SellerAnalytics';
import { CompanyFlashSalesManager } from './marketplace/MegaFlashSales';
import { CompanyStoriesManager } from './marketplace/MegaStories';
import MegaChat from './marketplace/MegaChat';
import MegaBulkUpload from './marketplace/MegaBulkUpload';
import { CompanyReturnsPanel, AdminDisputeCenter } from './marketplace/MegaReturns';
import ProductMediaStudioModal from './marketplace/ProductMediaStudioModal';
import { getPhpConfig } from '../utils/api';

interface Props {
  company: Company | null;
  products: MarketplaceProduct[];
  stores?: Store[];
  clicks?: MarketplaceClick[];
  reviews?: Review[];
  productViews?: ProductView[];
  regions?: string[];
  theme?: PublicTheme;
  translate: (text: string) => string;
  onSaveProfile: (patch: Partial<Company>) => void;
  onSavePaymentMethod: (companyId: number, method: CompanyPaymentMethod) => void;
  onDeletePaymentMethod: (companyId: number, methodId: number) => void;
  onSaveProduct: (product: MarketplaceProduct) => void;
  onDeleteProduct: (productId: number) => void;
  onSaveStore?: (store: Store) => void;
  // --- MEGA BUILD: 7 ultimate features company panel ---
  flashSales?: FlashSale[];
  flashSalesHandlers?: { onSave: (sale: FlashSale) => void; onDelete: (id: number) => void };
  stories?: Story[];
  storiesHandlers?: { onCreate: (payload: { companyId: number; type: 'image' | 'video'; mediaPath: string; caption?: string; productId?: number | null }) => void; onDelete: (id: number) => void };
  chatConversations?: ChatConversation[];
  chatMessages?: ChatMessage[];
  chatHandlers?: { onSend: (conversationId: number, input: { text?: string; messageType: 'text' | 'image' | 'product'; imageData?: string; productId?: number }) => void; onMarkRead: (conversationId: number) => void };
  productReturns?: ProductReturn[];
  returnHandlers?: { onApprove: (returnId: number) => void; onReject: (returnId: number, note?: string) => void };
  disputes?: Dispute[];
  disputeMessages?: DisputeMessage[];
  disputeHandlers?: { onResolve: (disputeId: number, outcome: 'buyer' | 'seller', resolution: string) => void; onSetUnderReview: (disputeId: number) => void; onAddAdminNote: (disputeId: number, note: string) => void; onAddDisputeMessage: (disputeId: number, message: string) => void };
  bulkUploadJobs?: BulkUploadJob[];
  bulkUploadHandlers?: { onCreateJob: (job: BulkUploadJob) => void; onUpdateJob: (job: BulkUploadJob) => void; onSaveProduct: (product: MarketplaceProduct) => void };
  shippingZones?: ShippingZone[];
  shippingZoneHandlers?: { onSave: (zone: ShippingZone) => void; onDelete: (id: number) => void };
}

const METHOD_TYPES: Array<{ key: CompanyPaymentMethod['methodType']; label: string }> = [
  { key: 'mpesa', label: 'M-Pesa' },
  { key: 'tigopesa', label: 'Tigo Pesa' },
  { key: 'airtelmoney', label: 'Airtel Money' },
  { key: 'halopesa', label: 'HaloPesa' },
  { key: 'lipa_number', label: 'Lipa Namba' },
  { key: 'bank', label: 'Bank Transfer' }
];

export default function MarketplaceSettingsPanel({
  company, products, stores, clicks, reviews, productViews, regions, theme: themeProp, translate: t, onSaveProfile, onSavePaymentMethod, onDeletePaymentMethod, onSaveProduct, onDeleteProduct, onSaveStore,
  flashSales, flashSalesHandlers, stories, storiesHandlers, chatConversations, chatMessages, chatHandlers,
  productReturns, returnHandlers, disputes, disputeMessages, disputeHandlers, bulkUploadJobs, bulkUploadHandlers, shippingZones, shippingZoneHandlers
}: Props) {
  const th = getPublicTheme(themeProp || 'milk');
  const regionList = regions && regions.length > 0 ? regions : TANZANIA_REGIONS;
  const [tab, setTab] = useState<'profile' | 'stores' | 'payments' | 'products' | 'analytics' | 'flash-sales' | 'stories' | 'chat' | 'returns' | 'disputes' | 'bulk-upload' | 'shipping'>('profile');

  // Profile form state
  const [profile, setProfile] = useState<Partial<Company>>({
    name: company?.name || '',
    description: company?.description || '',
    category: company?.category || '',
    region: company?.region || '',
    district: company?.district || '',
    ward: company?.ward || '',
    phone: company?.phone || '',
    whatsappNumber: company?.whatsappNumber || '',
    latitude: company?.latitude ?? undefined,
    longitude: company?.longitude ?? undefined,
    addressText: company?.addressText || '',
    isMarketplaceActive: company?.isMarketplaceActive !== false,
    isVerified: company?.isVerified ?? false,
    logoUrl: company?.logoUrl || '',
    coverImage: company?.coverImage || '',
    tinNumber: company?.tinNumber || '',
    vrnNumber: company?.vrnNumber || '',
    isVatRegistered: company?.isVatRegistered ?? false,
    businessLicense: company?.businessLicense || ''
  });

  // Sync profile when company prop changes (switching active company or receiving updates)
  useEffect(() => {
    if (!company) return;
    setProfile({
      name: company.name || '',
      description: company.description || '',
      category: company.category || '',
      region: company.region || '',
      district: company.district || '',
      ward: company.ward || '',
      phone: company.phone || '',
      whatsappNumber: company.whatsappNumber || '',
      latitude: company.latitude ?? undefined,
      longitude: company.longitude ?? undefined,
      addressText: company.addressText || '',
      isMarketplaceActive: company.isMarketplaceActive !== false,
      isVerified: company.isVerified ?? false,
      logoUrl: company.logoUrl || '',
      coverImage: company.coverImage || '',
      tinNumber: company.tinNumber || '',
      vrnNumber: company.vrnNumber || '',
      isVatRegistered: company.isVatRegistered ?? false,
      businessLicense: company.businessLicense || ''
    });
  }, [company?.id, company?.isMarketplaceActive, company?.name, company?.isVerified]);

  const toggleMarketplaceActive = () => {
    const nextVal = !(profile.isMarketplaceActive !== false);
    setProfile(p => ({ ...p, isMarketplaceActive: nextVal }));
    if (company) {
      onSaveProfile({ isMarketplaceActive: nextVal });
      toast.success(nextVal ? t('Storefront is now LIVE in public directory.') : t('Storefront is now HIDDEN from public directory.'));
    }
  };

  // Payment method form state
  const [editingMethod, setEditingMethod] = useState<CompanyPaymentMethod | null>(null);
  const [methodForm, setMethodForm] = useState<Partial<CompanyPaymentMethod>>({});

  // Store management state
  const [storeModalOpen, setStoreModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [storeForm, setStoreForm] = useState<Partial<Store>>({
    name: '',
    location: '',
    phone: '',
    latitude: undefined,
    longitude: undefined,
    operatingHours: '',
    isMarketplaceVisible: true,
  });
  const [deleteStoreId, setDeleteStoreId] = useState<number | null>(null);

  const startNewStore = () => {
    setEditingStore(null);
    setStoreForm({
      name: '',
      location: profile.addressText || '',
      phone: profile.phone || '',
      latitude: profile.latitude,
      longitude: profile.longitude,
      operatingHours: 'Mon-Sat 08:00 - 18:00',
      isMarketplaceVisible: true
    });
    setStoreModalOpen(true);
  };

  const startEditStore = (s: Store) => {
    setEditingStore(s);
    setStoreForm({
      ...s,
      isMarketplaceVisible: s.isMarketplaceVisible !== false
    });
    setStoreModalOpen(true);
  };

  const handleSaveStore = () => {
    if (!company) return;
    if (!storeForm.name?.trim()) {
      toast.error(t('Jina la duka linahitajika (Store name is required).'));
      return;
    }
    const payload: Store = {
      id: editingStore?.id ?? Date.now(),
      branchId: editingStore?.branchId ?? 1,
      companyId: company.id,
      name: storeForm.name.trim(),
      location: (storeForm.location || '').trim(),
      phone: (storeForm.phone || '').trim(),
      latitude: storeForm.latitude != null ? Number(storeForm.latitude) : undefined,
      longitude: storeForm.longitude != null ? Number(storeForm.longitude) : undefined,
      operatingHours: (storeForm.operatingHours || '').trim() || undefined,
      isMarketplaceVisible: storeForm.isMarketplaceVisible !== false,
      isDeleted: false,
      ...(storeForm as any)
    };
    if (onSaveStore) {
      onSaveStore(payload);
    } else {
      toast.error(t('Store save handler not available.'));
      return;
    }
    setStoreModalOpen(false);
    setEditingStore(null);
  };

  const handleDeleteStore = (sId: number) => {
    const target = (stores || []).find(s => s.id === sId);
    if (target && onSaveStore) {
      onSaveStore({ ...target, isDeleted: true });
      toast.success(t('Duka limefutwa.'));
    }
    setDeleteStoreId(null);
  };

  // Product form state
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<MarketplaceProduct | null>(null);
  const [productForm, setProductForm] = useState<Partial<MarketplaceProduct>>({});
  const [productImages, setProductImages] = useState<string[]>([]);
  const [productVideo, setProductVideo] = useState<string | undefined>();
  const [deleteProductId, setDeleteProductId] = useState<number | null>(null);
  const productFileRef = useRef<HTMLInputElement | null>(null);
  const videoFileRef = useRef<HTMLInputElement | null>(null);
  const [aiDescLoading, setAiDescLoading] = useState(false);

  // TradeCore Product Media Studio states
  const [studioModalOpen, setStudioModalOpen] = useState(false);
  const [studioTargetImage, setStudioTargetImage] = useState<string>('');
  const [studioTargetIndex, setStudioTargetIndex] = useState<number>(-1);
  const [studioInitialTab, setStudioInitialTab] = useState<'image_studio' | 'video_studio'>('image_studio');

  const openImageStudio = (imgUrl: string, index: number) => {
    setStudioTargetImage(imgUrl);
    setStudioTargetIndex(index);
    setStudioInitialTab('image_studio');
    setStudioModalOpen(true);
  };

  const openVideoStudio = () => {
    const mainImg = productImages[0] || productForm.image || '';
    if (!mainImg) {
      toast.error(t('Please add at least 1 product image first to generate a 360° video.'));
      return;
    }
    setStudioTargetImage(mainImg);
    setStudioTargetIndex(0);
    setStudioInitialTab('video_studio');
    setStudioModalOpen(true);
  };

  const MAX_IMAGES = 6;
  const MAX_VIDEO_MB = 100;
  const MAX_VIDEO_SECONDS = 300;

  const nextProductId = useMemo(() => {
    const maxExisting = Math.max(0, ...(products || []).map(p => Number(p.id) || 0));
    return Math.max(maxExisting + 1, Date.now());
  }, [products]);
  const nextMethodId = useMemo(() => Math.max(0, ...(company?.paymentMethods || []).map(m => m.id)) + 1, [company]);

  const whatsappClicksFor = (productId: number) => (clicks || []).filter(c => c.productId === productId && c.type === 'whatsapp').length;

  const generateAiDescription = async () => {
    const name = (productForm.name || '').trim();
    const category = (productForm.category || '').trim();
    const price = productForm.price || 0;
    if (!name) return toast.error(t('Add a product name first, then generate the description.'));
    setAiDescLoading(true);
    const localFallback = () => {
      const lines = [
        `${name} — ${category || 'bidhaa'} bora inauzwa sasa.`,
        `Bei: TZS ${price.toLocaleString()}.`,
        `${company?.name || ''}, GlobalTradeCore — nunua bidhaa halisi kutoka wauzaji walio thibitishwa.`,
        `Piga simu/whatsapp: ${company?.whatsappNumber || company?.phone || ''}.`,
        `Bidhaa hii inapatikana ${company?.district ? `${company.district}, ` : ''}${company?.region || 'Tanzania'}.`
      ];
      setProductForm(p => ({ ...p, description: lines.join('\n') }));
    };
    try {
      const { apiUrl } = getPhpConfig();
      const res = await fetch(`${apiUrl}?action=ai_product_description&name=${encodeURIComponent(name)}&category=${encodeURIComponent(category)}&price=${price}&company=${encodeURIComponent(company?.name || '')}`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json && json.success && json.description) {
          setProductForm(p => ({ ...p, description: json.description }));
          setAiDescLoading(false);
          toast.success(t('Description generated.'));
          return;
        }
      }
      localFallback();
    } catch (e) {
      localFallback();
    }
    setAiDescLoading(false);
    toast.success(t('Description generated.'));
  };

  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand text-gray-800 font-medium placeholder:text-gray-400';
  const labelCls = 'block text-[10px] font-black uppercase tracking-wider mb-1.5 text-gray-500';
  const [geocoding, setGeocoding] = useState(false);

  const geocodeAddress = async () => {
    const addr = (profile.addressText || '').trim();
    if (!addr) return toast.error(t('Enter a street address first, then look it up on the map.'));
    setGeocoding(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=tz&q=${encodeURIComponent(addr)}`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) throw new Error('geocode failed');
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        toast.error(t('Address not found. Try a more specific address (e.g. street, ward, district).'));
        return;
      }
      const hit = data[0];
      const ad = hit.address || {};
      setProfile(p => ({
        ...p,
        latitude: parseFloat(hit.lat),
        longitude: parseFloat(hit.lon),
        region: ad.state || ad.region || p.region || '',
        district: ad.state_district || ad.county || ad.city || ad.town || p.district || '',
        ward: ad.suburb || ad.neighbourhood || ad.village || p.ward || ''
      }));
      toast.success(t('Location found — review the pin and save.'));
    } catch (e) {
      toast.error(t('Could not look up the address. Check your connection.'));
    } finally {
      setGeocoding(false);
    }
  };

  const saveProfile = () => {
    if (!profile.name?.trim()) return toast.error(t('Company name is required.'));
    onSaveProfile({
      ...profile,
      name: profile.name.trim(),
      slug: slugify(profile.name.trim())
    });
  };

  const startNewMethod = () => {
    setEditingMethod(null);
    setMethodForm({ methodType: 'mpesa', accountName: '', accountNumber: '', instructions: '', isActive: true });
  };

  const startEditMethod = (m: CompanyPaymentMethod) => {
    setEditingMethod(m);
    setMethodForm({ ...m });
  };

  const saveMethod = () => {
    if (!company) return;
    if (!methodForm.accountName?.trim() || !methodForm.accountNumber?.trim()) {
      return toast.error(t('Account name and number are required.'));
    }
    const method: CompanyPaymentMethod = {
      id: editingMethod?.id ?? nextMethodId,
      companyId: company.id,
      methodType: (methodForm.methodType as CompanyPaymentMethod['methodType']) || 'mpesa',
      accountName: methodForm.accountName.trim(),
      accountNumber: methodForm.accountNumber.trim(),
      instructions: methodForm.instructions?.trim() || undefined,
      isActive: methodForm.isActive !== false
    };
    onSavePaymentMethod(company.id, method);
    setEditingMethod(null);
    setMethodForm({});
  };

  const startNewProduct = () => {
    setEditingProduct(null);
    setProductForm({ name: '', price: 0, stockQuantity: 0, category: '', description: '', image: '', isActive: true });
    setProductImages([]);
    setProductVideo(undefined);
    setProductFormOpen(true);
  };

  const startEditProduct = (p: MarketplaceProduct) => {
    setEditingProduct(p);
    setProductForm({ ...p });
    setProductImages([p.image, ...(p.gallery || [])].filter(Boolean));
    setProductVideo(p.video || undefined);
    setProductFormOpen(true);
  };

  const readAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const onProductImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);
    const room = MAX_IMAGES - productImages.length;
    if (room <= 0) return toast.error(t('Maximum 6 images per product.'));
    const picked = fileList.slice(0, room);
    const tooMany = fileList.length > room;
    for (const f of picked) {
      if (!f.type.startsWith('image/')) return toast.error(`${f.name} — ${t('not an image file.')}`);
      if (f.size > 15 * 1024 * 1024) return toast.error(`${f.name} — ${t('image must be under 15MB.')}`);
    }
    try {
      const compressedList = await Promise.all(
        picked.map(f => compressImageFile(f, { maxWidth: 1024, maxHeight: 1024, quality: 0.78 }))
      );
      const urls = compressedList.map(c => c.dataUrl);
      const totalOrig = compressedList.reduce((acc, cur) => acc + cur.originalBytes, 0);
      const totalComp = compressedList.reduce((acc, cur) => acc + cur.compressedBytes, 0);
      const overallSavings = totalOrig > 0 ? Math.round((1 - totalComp / totalOrig) * 100) : 0;
      
      setProductImages(prev => [...prev, ...urls].slice(0, MAX_IMAGES));
      toast.success(
        `${t('Images compressed')} (${formatByteSize(totalOrig)} → ${formatByteSize(totalComp)}, -${overallSavings}%)`
      );
      if (tooMany) toast.error(t('Maximum 6 images per product.'));
    } catch (e) {
      toast.error(t('Could not process one of the image files.'));
    }
  };

  const removeProductImage = (index: number) => {
    setProductImages(prev => prev.filter((_, i) => i !== index));
  };

  const onProductVideo = async (file: File | null) => {
    if (!file) return;
    const okType = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'].includes(file.type);
    if (!okType) return toast.error(t('Video must be MP4, MOV or WebM.'));
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) return toast.error(t(`Video must be under ${MAX_VIDEO_MB}MB.`));
    try {
      const url = await readAsDataUrl(file);
      const probe = document.createElement('video');
      probe.preload = 'metadata';
      probe.src = url;
      await new Promise<void>((resolve, reject) => {
        probe.onloadedmetadata = () => resolve();
        probe.onerror = () => reject(new Error('invalid video'));
      });
      if (probe.duration > MAX_VIDEO_SECONDS) {
        return toast.error(t(`Video must be at most ${MAX_VIDEO_SECONDS} seconds long.`));
      }
      setProductVideo(url);
    } catch (e) {
      toast.error(t('Could not read the video file.'));
    }
  };

  const saveProduct = () => {
    if (!productForm.name?.trim()) return toast.error(t('Product name is required.'));
    if (productImages.length === 0) return toast.error(t('At least 1 product image is required.'));
    const price = Number(productForm.price) || 0;
    const stockQuantity = Number(productForm.stockQuantity) || 0;
    const images = productImages.slice(0, MAX_IMAGES);
    const product: MarketplaceProduct = {
      id: editingProduct?.id ?? nextProductId,
      companyId: company?.id ?? 0,
      name: productForm.name.trim(),
      slug: slugify(productForm.name.trim()),
      description: productForm.description?.trim() || '',
      price,
      stockQuantity,
      image: images[0],
      gallery: images.length > 1 ? images.slice(1) : undefined,
      video: productVideo || undefined,
      category: (productForm.category?.trim() || '').toLowerCase() ? productForm.category.trim() : '',
      // Multi-Store Location Mapping: explicitly assigned physical stores (Master Data).
      // Empty array = fall back to the company's Main HQ location on the public product map.
      storeIds: Array.isArray(productForm.storeIds) && productForm.storeIds.length > 0 ? productForm.storeIds : undefined,
      isActive: productForm.isActive !== false,
      status: editingProduct?.status && editingProduct.status !== 'pending' ? editingProduct.status : ((company?.isVerified || company?.subscriptionApproved === true) ? 'approved' : 'pending'),
      weightKg: productForm.weightKg || undefined,
      freeShipping: productForm.freeShipping || undefined,
      shippingZoneIds: productForm.shippingZoneIds?.length ? productForm.shippingZoneIds : undefined,
    };
    if (!product.companyId) return toast.error(t('No company selected.'));
    onSaveProduct(product);
    setProductFormOpen(false);
    setEditingProduct(null);
  };

  if (!company) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl p-10 text-center">
        <StoreIcon className="w-10 h-10 mx-auto mb-3 text-gray-300" />
        <div className="text-sm font-bold text-gray-700">{t('No company linked')}</div>
        <div className="text-xs text-gray-400 font-medium mt-1">{t('This user has no company assigned. Contact a Super Admin.')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-100 text-amber-600">
            <StoreIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">{t('Marketplace Store Settings')}</h2>
            <p className="text-xs text-gray-500 font-medium">{t('Manage your public storefront, payment methods and products.')}</p>
          </div>
        </div>
        <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full border ${profile.isMarketplaceActive !== false ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
          {profile.isMarketplaceActive !== false ? t('Storefront Live') : t('Storefront Hidden')}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 bg-gray-100 rounded-xl p-1 overflow-x-auto max-w-full no-scrollbar">
        {([
          { key: 'profile', label: t('Store Profile'), icon: StoreIcon },
          { key: 'stores', label: t('Maduka (Stores)'), icon: MapPin },
          { key: 'payments', label: t('Payment Methods'), icon: CreditCard },
          { key: 'products', label: t('Products'), icon: Package },
          { key: 'analytics', label: t('Analytics'), icon: BarChart3 },
          { key: 'flash-sales', label: 'Flash Sales', icon: Sparkles },
          { key: 'stories', label: 'Stories', icon: Play },
          { key: 'chat', label: 'Chat', icon: MessageCircle },
          { key: 'returns', label: 'Returns', icon: AlertTriangle },
          { key: 'disputes', label: 'Disputes', icon: ShieldCheck },
          { key: 'bulk-upload', label: 'Bulk Upload', icon: Upload },
          { key: 'shipping', label: 'Shipping Zones', icon: MapPin },
        ] as const).map(tb => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold rounded-lg transition shrink-0 cursor-pointer ${tab === tb.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <tb.icon className="w-3.5 h-3.5 shrink-0" /> {tb.label}
          </button>
        ))}
      </div>

      {/* PROFILE TAB */}
      {tab === 'profile' && (
        <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t('Company Name')} *</label>
              <input value={profile.name || ''} onChange={(e) => setProfile(p => ({ ...p, name: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t('Category')}</label>
              <input value={profile.category || ''} onChange={(e) => setProfile(p => ({ ...p, category: e.target.value }))} placeholder={t('e.g. Retail & Wholesale')} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>{t('Description')}</label>
              <textarea value={profile.description || ''} onChange={(e) => setProfile(p => ({ ...p, description: e.target.value }))} rows={2} className={inputCls + ' resize-none'} />
            </div>
            <div>
              <label className={labelCls}>{t('Region')}</label>
              <select value={profile.region || ''} onChange={(e) => setProfile(p => ({ ...p, region: e.target.value }))} className={inputCls + ' cursor-pointer'}>
                <option value="">-- {t('Select region')} --</option>
                {regionList.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t('District')}</label>
              <input value={profile.district || ''} onChange={(e) => setProfile(p => ({ ...p, district: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t('Ward')}</label>
              <input value={profile.ward || ''} onChange={(e) => setProfile(p => ({ ...p, ward: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t('Phone')}</label>
              <input value={profile.phone || ''} onChange={(e) => setProfile(p => ({ ...p, phone: e.target.value }))} placeholder="+255..." className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t('WhatsApp Number (for "Order via WhatsApp" button)')}</label>
              <div className="relative">
                <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-green-500" />
                <input
                  value={profile.whatsappNumber || ''}
                  onChange={(e) => setProfile(p => ({ ...p, whatsappNumber: e.target.value.replace(/[^0-9+]/g, '') }))}
                  placeholder="e.g. 255712345678"
                  className={inputCls + ' pl-9'}
                />
              </div>
              <p className="text-[10px] text-gray-400 font-medium mt-1">
                {t('Customers order instantly via WhatsApp chat. If empty, your Phone number is used. Format: country code without leading zeros or + (e.g. 255712345678).')}
              </p>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>{t('Store Location on Map (Feature: "Njoo Dukani")')}</label>
              <LocationPicker
                lat={profile.latitude ?? null}
                lng={profile.longitude ?? null}
                onChange={(la, lo) => setProfile(p => ({ ...p, latitude: la, longitude: lo }))}
                t={t}
                pickTitle={t('Your store location')}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>{t('Street Address')}</label>
              <div className="flex gap-2">
                <input
                  value={profile.addressText || ''}
                  onChange={(e) => setProfile(p => ({ ...p, addressText: e.target.value }))}
                  placeholder={t('e.g. Shekilango Road, Kijitonyama, Dar es Salaam')}
                  className={inputCls}
                />
                <button
                  onClick={geocodeAddress}
                  disabled={geocoding}
                  className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 text-[10px] font-black rounded-lg transition cursor-pointer disabled:opacity-50 ${profile.addressText?.trim() ? 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border border-blue-500/30' : 'bg-gray-100 text-gray-400'}`}
                >
                  {geocoding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
                  {geocoding ? t('Looking up...') : t('Look up on map')}
                </button>
              </div>
              <p className="text-[10px] text-gray-400 font-medium mt-1">{t('Customers use this address and the map to find your store (directions + WhatsApp share). "Look up on map" fills your map pin, region, district and ward automatically.')}</p>
            </div>
            <div>
              <label className={labelCls}>{t('Latitude')} ({t('optional — enables map')})</label>
              <input type="number" value={profile.latitude ?? ''} onChange={(e) => setProfile(p => ({ ...p, latitude: e.target.value ? Number(e.target.value) : undefined }))} step="0.0001" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t('Longitude')}</label>
              <input type="number" value={profile.longitude ?? ''} onChange={(e) => setProfile(p => ({ ...p, longitude: e.target.value ? Number(e.target.value) : undefined }))} step="0.0001" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t('Storefront Slug')}</label>
              <input value={company.slug || ''} readOnly className={inputCls + ' bg-gray-50 text-gray-500'} />
            </div>
          </div>

          {/* Toggles */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div
              onClick={toggleMarketplaceActive}
              className="flex items-center justify-between gap-3 border border-gray-100 rounded-xl px-4 py-3 cursor-pointer hover:bg-gray-50/60 transition select-none"
            >
              <div>
                <div className="text-xs font-bold text-gray-800">{t('Storefront Live')}</div>
                <div className="text-[10px] text-gray-400 font-medium">{t('Show this store in the public marketplace directory.')}</div>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggleMarketplaceActive(); }}
                className={`w-11 h-6 rounded-full transition relative cursor-pointer ${profile.isMarketplaceActive !== false ? 'bg-emerald-500' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${profile.isMarketplaceActive !== false ? 'left-[22px]' : 'left-0.5'}`}></span>
              </button>
            </div>
            <label className="flex items-center justify-between gap-3 border border-gray-100 rounded-xl px-4 py-3 cursor-default">
              <div>
                <div className="text-xs font-bold text-gray-800">{t('Verified Seller')}</div>
                <div className="text-[10px] text-gray-400 font-medium">{t('Granted by Super Admin after payment review. Your products go live once verified.')}</div>
              </div>
              <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full border ${profile.isVerified ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                {profile.isVerified ? t('Verified by Admin') : t('Pending Verification')}
              </span>
            </label>
          </div>

          {/* Images */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t('Logo Image URL')}</label>
              <input value={profile.logoUrl || ''} onChange={(e) => setProfile(p => ({ ...p, logoUrl: e.target.value }))} className={inputCls} />
              {profile.logoUrl && <img src={profile.logoUrl} alt="logo" className="mt-2 h-16 rounded-lg object-cover" />}
            </div>
            <div>
              <label className={labelCls}>{t('Cover Image URL')}</label>
              <input value={profile.coverImage || ''} onChange={(e) => setProfile(p => ({ ...p, coverImage: e.target.value }))} className={inputCls} />
              {profile.coverImage && <img src={profile.coverImage} alt="cover" className="mt-2 h-16 w-full object-cover rounded-lg" />}
            </div>
          </div>

          {/* TRA COMPLIANCE — Taarifa za TRA */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-700" />
              <span className="text-[11px] font-black text-amber-800 uppercase tracking-wider">{t('Taarifa za TRA (Tax Compliance)')}</span>
              {company?.tinVerified && (
                <span className="ml-auto text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{t('TIN Verified')}</span>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t('TIN Number')} *</label>
                <input
                  value={profile.tinNumber || ''}
                  onChange={(e) => setProfile(p => ({ ...p, tinNumber: e.target.value.replace(/[^0-9\-]/g, '') }))}
                  placeholder="123-456-789"
                  disabled={!!company?.tinVerified}
                  className={inputCls + (company?.tinVerified ? ' bg-gray-100 text-gray-500' : '')}
                />
                {company?.tinVerified && (
                  <p className="text-[10px] text-gray-400 font-medium mt-1">{t('TIN imethibitishwa na admin — hauwezi kubadilishwa.')}</p>
                )}
              </div>
              <div>
                <label className={labelCls}>{t('VRN Number (if VAT registered)')}</label>
                <input
                  value={profile.vrnNumber || ''}
                  onChange={(e) => setProfile(p => ({ ...p, vrnNumber: e.target.value.replace(/[^0-9A-Za-z\-]/g, '') }))}
                  placeholder="e.g. 40-012345678"
                  disabled={!profile.isVatRegistered}
                  className={inputCls + (!profile.isVatRegistered ? ' bg-gray-100 text-gray-400' : '')}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!profile.isVatRegistered}
                onChange={(e) => setProfile(p => ({ ...p, isVatRegistered: e.target.checked }))}
                className="w-4 h-4 accent-amber-600"
              />
              <span className="text-[11px] font-bold text-gray-700">{t('Nimesajiliwa VAT (VAT registered)')}</span>
            </label>
            <p className="text-[10px] text-amber-700 font-semibold leading-relaxed">
              {t('TIN inahitajika kwa mujibu wa sheria za TRA. Kila mauzo yako utawajibika kutoa risiti ya EFD.')}
            </p>
            <div>
              <label className={labelCls}>{t('Business License')}</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const fileInput = document.createElement('input');
                    fileInput.type = 'file';
                    fileInput.accept = 'image/*,.pdf';
                    fileInput.onchange = () => {
                      const file = fileInput.files && fileInput.files[0];
                      if (!file) return;
                      if (file.size > 2 * 1024 * 1024) { toast.error(t('File too large (max 2MB).')); return; }
                      const reader = new FileReader();
                      reader.onload = () => setProfile(p => ({ ...p, businessLicense: String(reader.result || '') }));
                      reader.readAsDataURL(file);
                    };
                    fileInput.click();
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#2d323e] text-white text-[11px] font-bold rounded-lg cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {t('Upload License')}
                </button>
                {profile.businessLicense && (
                  <button type="button" onClick={() => setProfile(p => ({ ...p, businessLicense: '' }))} className="text-[11px] font-bold text-red-500 underline">{t('Remove')}</button>
                )}
              </div>
              {profile.businessLicense && (
                <div className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1">
                  <Check className="w-3.5 h-3.5" /> {t('License attached')}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-amber-100">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800/70">{t('Jumla ya Mauzo (Total Sales)')}</div>
                <div className="text-lg font-black text-gray-900">{TZS(company?.totalSalesAmount || 0)}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800/70">{t('Hali ya VAT (VAT Status)')}</div>
                <div className="text-sm font-black text-gray-900">{profile.isVatRegistered ? t('Registered (18%)') : t('Not VAT registered')}</div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-gray-100">
            <button onClick={saveProfile} className="flex items-center gap-2 px-5 py-2.5 text-[11px] font-bold text-white bg-brand hover:opacity-90 rounded-lg transition cursor-pointer">
              <Save className="w-3.5 h-3.5" /> {t('Save Profile')}
            </button>
          </div>
        </div>
      )}

      {/* STORES TAB — Physical Branch Stores & In-Store Pickup */}
      {tab === 'stores' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900">{t('Maduka na Matawi ya Kimwili (Stores & Pickup Locations)')}</h3>
              <p className="text-xs text-gray-500 font-medium">
                {t('Maduka haya kutoka Master Data Store Management hutumika kuwezesha wateja kuona tawi la karibu, kutembelea dukani ("Njoo Dukani"), na kutenga bidhaa maalum kwa kila duka.')}
              </p>
            </div>
            <button
              onClick={startNewStore}
              className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold text-white bg-brand hover:opacity-90 rounded-lg transition cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" /> {t('Ongeza Duka Jipya')}
            </button>
          </div>

          {(() => {
            const companyStores = (stores || []).filter(s => !s.isDeleted);
            if (companyStores.length === 0) {
              return (
                <div className="bg-white border border-gray-100 rounded-xl p-8 text-center space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-800">{t('Hakuna maduka yaliyosajiliwa bado')}</div>
                    <div className="text-xs text-gray-400 font-medium max-w-md mx-auto mt-1">
                      {t('Ongeza duka la kimwili au tawi lenye GPS coordinates ili wateja waweze kuchagua kuchukua mzigo dukani ("In-Store Pickup") au kutembelea moja kwa moja.')}
                    </div>
                  </div>
                  <button
                    onClick={startNewStore}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-brand rounded-lg shadow-sm hover:opacity-90 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> {t('Sajili Duka la Kwanza')}
                  </button>
                </div>
              );
            }

            return (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {companyStores.map(st => {
                  const hasGps = st.latitude != null && st.longitude != null;
                  const isVisible = st.isMarketplaceVisible !== false;
                  const allocatedProductCount = (products || []).filter(p => (p.storeIds && p.storeIds.includes(st.id)) || (p as any).storeId === st.id).length;

                  return (
                    <div key={st.id} className="bg-white border border-gray-100 rounded-xl p-4 flex flex-col justify-between hover:shadow-md transition">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600 shrink-0">
                              <StoreIcon className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-gray-900 truncate">{st.name}</h4>
                              <span className="text-[10px] text-gray-400 font-medium block truncate">
                                {st.phone || t('Hakuna simu')}
                              </span>
                            </div>
                          </div>
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${isVisible ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
                            {isVisible ? t('Live Marketplace') : t('Hidden')}
                          </span>
                        </div>

                        <div className="space-y-1.5 text-xs text-gray-600">
                          <div className="flex items-start gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                            <span className="text-[11px] font-medium leading-tight">
                              {st.location || (st as any).address || t('Hakuna anuani iliyoandikwa')}
                            </span>
                          </div>

                          {hasGps ? (
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50/70 border border-emerald-100 rounded-md px-2 py-1">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                              <span>GPS: {st.latitude?.toFixed(4)}, {st.longitude?.toFixed(4)}</span>
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${st.latitude},${st.longitude}`}
                                target="_blank"
                                rel="noreferrer"
                                className="ml-auto text-emerald-700 hover:underline inline-flex items-center gap-0.5 text-[9px] font-black"
                              >
                                Maps <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </div>
                          ) : (
                            <div className="text-[10px] text-amber-600 bg-amber-50 rounded-md px-2 py-1 border border-amber-100 font-semibold">
                              ⚠️ {t('Hakuna GPS coordinates — hariri kuweka ramani')}
                            </div>
                          )}

                          {st.operatingHours && (
                            <div className="text-[10px] text-gray-500 font-medium">
                              🕒 {st.operatingHours}
                            </div>
                          )}

                          <div className="text-[10px] text-gray-500 font-medium pt-1 border-t border-gray-50 flex items-center justify-between">
                            <span>{t('Bidhaa zilizotengwa')}:</span>
                            <span className="font-bold text-gray-800">{allocatedProductCount} {t('bidhaa')}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => {
                            if (onSaveStore) {
                              onSaveStore({ ...st, isMarketplaceVisible: !isVisible });
                              toast.success(isVisible ? t('Duka limefichwa kwenye Marketplace.') : t('Duka sasa linaonekana kwenye Marketplace!'));
                            }
                          }}
                          className={`text-[10px] font-bold px-2 py-1 rounded-md transition cursor-pointer ${isVisible ? 'text-amber-700 bg-amber-50 hover:bg-amber-100' : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'}`}
                        >
                          {isVisible ? t('Ficha') : t('Weka Live')}
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => startEditStore(st)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-brand hover:bg-gray-50 transition cursor-pointer"
                            title={t('Hariri duka')}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteStoreId(st.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition cursor-pointer"
                            title={t('Futa duka')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Store Modal (Add / Edit) */}
          {storeModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl my-8">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <StoreIcon className="w-5 h-5 text-brand" />
                    <h3 className="text-sm font-bold text-gray-900">
                      {editingStore ? t('Hariri Duka la Mauzo') : t('Ongeza Duka Jipya la Mauzo')}
                    </h3>
                  </div>
                  <button onClick={() => { setStoreModalOpen(false); setEditingStore(null); }} className="p-1 text-gray-400 hover:text-gray-700 rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3.5">
                  <div>
                    <label className={labelCls}>{t('Jina la Duka / Tawi (Store Name)')} *</label>
                    <input
                      value={storeForm.name || ''}
                      onChange={(e) => setStoreForm(p => ({ ...p, name: e.target.value }))}
                      placeholder={t('mf. Duka Kuu Kariakoo, Mlimani City Branch, n.k.')}
                      className={inputCls}
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>{t('Nambari ya Simu ya Duka')}</label>
                      <input
                        value={storeForm.phone || ''}
                        onChange={(e) => setStoreForm(p => ({ ...p, phone: e.target.value }))}
                        placeholder="+255 7..."
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>{t('Masaa ya Kazi (Operating Hours)')}</label>
                      <input
                        value={storeForm.operatingHours || ''}
                        onChange={(e) => setStoreForm(p => ({ ...p, operatingHours: e.target.value }))}
                        placeholder="mf. Jtt - Jms: 08:00 - 18:00"
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>{t('Eneo la Duka / Mtaa (Address/Location)')}</label>
                    <input
                      value={storeForm.location || ''}
                      onChange={(e) => setStoreForm(p => ({ ...p, location: e.target.value }))}
                      placeholder={t('mf. Kariakoo mtaa wa Narung\'ombe & Congo, Dar es Salaam')}
                      className={inputCls}
                    />
                  </div>

                  {/* GPS & Location Picker */}
                  <div className="border border-gray-100 rounded-xl p-3 bg-gray-50/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className={labelCls + ' mb-0'}>{t('Weka Ramani / GPS Coordinates (Njoo Dukani Pickup)')}</label>
                      {storeForm.latitude != null && storeForm.longitude != null && (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          {storeForm.latitude.toFixed(4)}, {storeForm.longitude.toFixed(4)}
                        </span>
                      )}
                    </div>
                    <LocationPicker
                      lat={storeForm.latitude}
                      lng={storeForm.longitude}
                      onChange={(lat, lng) => {
                        setStoreForm(p => ({
                          ...p,
                          latitude: lat,
                          longitude: lng
                        }));
                      }}
                      t={t}
                    />
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
                    <input
                      type="checkbox"
                      checked={storeForm.isMarketplaceVisible !== false}
                      onChange={(e) => setStoreForm(p => ({ ...p, isMarketplaceVisible: e.target.checked }))}
                      className="w-4 h-4 accent-brand rounded"
                    />
                    <div>
                      <span className="text-xs font-bold text-gray-800">{t('Onyesha duka hili kwenye ramani ya Marketplace')}</span>
                      <p className="text-[10px] text-gray-400 font-medium">{t('Wateja wataona duka hili kwenye ramani ya bidhaa zilizotengwa na wanaweza kuchagua kulitembelea.')}</p>
                    </div>
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => { setStoreModalOpen(false); setEditingStore(null); }}
                    className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition cursor-pointer"
                  >
                    {t('Ghairi')}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveStore}
                    className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-brand rounded-lg shadow-sm hover:opacity-90 transition cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" /> {t('Hifadhi Duka')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Confirm Delete Store Modal */}
          {deleteStoreId !== null && (
            <ConfirmActionModal
              isOpen={true}
              title={t('Futa Duka')}
              message={t('Una uhakika unataka kufuta duka hili? Bidhaa zilizotengwa duka hili zitarudi kwenye HQ kuu.')}
              confirmLabel={t('Futa')}
              cancelLabel={t('Ghairi')}
              isDestructive={true}
              onConfirm={() => handleDeleteStore(deleteStoreId)}
              onCancel={() => setDeleteStoreId(null)}
            />
          )}
        </div>
      )}

      {/* PAYMENTS TAB */}
      {tab === 'payments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 font-medium">{t('Customers pay to these accounts during checkout.')}</p>
            <button onClick={startNewMethod} className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold text-white bg-brand hover:opacity-90 rounded-lg transition cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> {t('Add Payment Method')}
            </button>
          </div>

          {(company.paymentMethods || []).length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-xl p-8 text-center">
              <CreditCard className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <div className="text-sm font-bold text-gray-700">{t('No payment methods yet')}</div>
              <div className="text-xs text-gray-400 font-medium mt-1">{t('Add one so customers can pay you.')}</div>
            </div>
          ) : (
            <div className="space-y-2">
              {(company.paymentMethods || []).map(m => (
                <div key={m.id} className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-green-50 text-green-600">
                    <CreditCard className="w-4.5 h-4.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-900">{m.accountName}</span>
                      <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{t(m.methodType.replace(/_/g, ' '))}</span>
                      {m.isActive === false && <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">{t('inactive')}</span>}
                    </div>
                    <div className="text-[11px] text-gray-500 font-medium">{m.accountNumber}</div>
                  </div>
                  <button onClick={() => startEditMethod(m)} className="p-2 rounded-lg text-gray-400 hover:text-brand hover:bg-gray-50 transition cursor-pointer" title={t('Edit')}>
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => onDeletePaymentMethod(company.id, m.id)} className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition cursor-pointer" title={t('Delete')}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Method form */}
          {(editingMethod !== null || methodForm.methodType) && (
            <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-gray-900">{editingMethod ? t('Edit Payment Method') : t('New Payment Method')}</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{t('Method Type')}</label>
                  <select
                    value={methodForm.methodType || 'mpesa'}
                    onChange={(e) => setMethodForm(m => ({ ...m, methodType: e.target.value as CompanyPaymentMethod['methodType'] }))}
                    className={inputCls + ' cursor-pointer'}
                  >
                    {METHOD_TYPES.map(mt => <option key={mt.key} value={mt.key}>{mt.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>{t('Account Name')} *</label>
                  <input value={methodForm.accountName || ''} onChange={(e) => setMethodForm(m => ({ ...m, accountName: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t('Account Number')} *</label>
                  <input value={methodForm.accountNumber || ''} onChange={(e) => setMethodForm(m => ({ ...m, accountNumber: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t('Instructions (optional)')}</label>
                  <input value={methodForm.instructions || ''} onChange={(e) => setMethodForm(m => ({ ...m, instructions: e.target.value }))} placeholder={t('e.g. Lipa kwa M-Pesa halafu andika Transaction ID')} className={inputCls} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700">
                  <input type="checkbox" checked={methodForm.isActive !== false} onChange={(e) => setMethodForm(m => ({ ...m, isActive: e.target.checked }))} className="w-4 h-4 accent-brand" />
                  {t('Active')}
                </label>
              </div>
              <div className="flex items-center gap-2 justify-end border-t border-gray-100 pt-3">
                <button onClick={() => { setEditingMethod(null); setMethodForm({}); }} className="px-4 py-2 text-[11px] font-bold text-gray-500 hover:bg-gray-100 rounded-lg cursor-pointer">
                  {t('Cancel')}
                </button>
                <button onClick={saveMethod} className="flex items-center gap-2 px-5 py-2 text-[11px] font-bold text-white bg-brand hover:opacity-90 rounded-lg cursor-pointer">
                  <Save className="w-3.5 h-3.5" /> {t('Save Method')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PRODUCTS TAB */}
      {tab === 'products' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 font-medium">{products.length} {t('products')}</p>
            <button onClick={startNewProduct} className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold text-white bg-brand hover:opacity-90 rounded-lg transition cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> {t('Add Product')}
            </button>
          </div>

          {products.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-xl p-8 text-center">
              <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <div className="text-sm font-bold text-gray-700">{t('No products yet')}</div>
              <div className="text-xs text-gray-400 font-medium mt-1">{t('Add your first product to start selling.')}</div>
            </div>
          ) : (
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100 text-[10px] font-black uppercase tracking-wider text-gray-400">
                    <th className="px-4 py-3">{t('Product')}</th>
                    <th className="px-4 py-3">{t('Price')}</th>
                    <th className="px-4 py-3">{t('Stock')}</th>
                    <th className="px-4 py-3">{t('Duka lililowekwa (Store Allocation)')}</th>
                    <th className="px-4 py-3">{t('WhatsApp Clicks')}</th>
                    <th className="px-4 py-3">{t('Status')}</th>
                    <th className="px-4 py-3 text-right">{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(products || []).map(p => (
                    <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                            {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" /> : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-yellow-400 to-amber-600 text-white text-sm font-black">{(p.name || '').charAt(0)}</div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-gray-900 truncate">{p.name}</div>
                            <div className="text-[10px] text-gray-400 font-medium">{p.category || '-'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-gray-900">{TZS(p.price)}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-gray-600">{p.stockQuantity}</td>
                      <td className="px-4 py-3">
                        {(() => {
                          const allocatedStores = (stores || []).filter(s => (p.storeIds && p.storeIds.includes(s.id)) || (p as any).storeId === s.id);
                          if (allocatedStores.length === 0) {
                            return (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200" title={t('Inapatikana maduka yote au makao makuu')}>
                                <StoreIcon className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{t('HQ / Yote (Main)')}</span>
                              </span>
                            );
                          }
                          return (
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {allocatedStores.map(s => (
                                <span
                                  key={s.id}
                                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200"
                                  title={`${s.location || ''} ${s.latitude != null && s.longitude != null ? `(${s.latitude.toFixed(4)}, ${s.longitude.toFixed(4)})` : ''}`}
                                >
                                  <MapPin className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                  <span className="truncate max-w-[120px]">{s.name}</span>
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-black rounded-full px-2.5 py-1 ${whatsappClicksFor(p.id) > 0 ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-50 text-gray-400 border border-gray-100'}`}>
                          <MessageCircle className="w-3 h-3" /> {whatsappClicksFor(p.id)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border w-fit ${p.isActive !== false ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                            {p.isActive !== false ? t('Active') : t('Hidden')}
                          </span>
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border w-fit ${p.status === 'approved' || p.status === undefined ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                            {p.status === 'approved' || p.status === undefined ? t('Approved') : t('Pending Verification')}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => onSaveProduct({ ...p, isActive: !(p.isActive !== false) })} className="p-2 rounded-lg text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 transition cursor-pointer" title={t('Toggle visibility')}>
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => startEditProduct(p)} className="p-2 rounded-lg text-gray-400 hover:text-brand hover:bg-gray-50 transition cursor-pointer" title={t('Edit')}>
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleteProductId(p.id)} className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition cursor-pointer" title={t('Delete')}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Product form */}
          {productFormOpen && (
            <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900">{editingProduct ? t('Edit Product') : t('New Product')}</h3>
                <button onClick={() => { setProductFormOpen(false); setEditingProduct(null); }} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className={labelCls}>{t('Product Name')} *</label>
                  <input value={productForm.name || ''} onChange={(e) => setProductForm(p => ({ ...p, name: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t('Price (TZS)')} *</label>
                  <input type="number" min="0" value={productForm.price ?? ''} onChange={(e) => setProductForm(p => ({ ...p, price: Number(e.target.value) }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t('Stock Quantity')} *</label>
                  <input type="number" min="0" value={productForm.stockQuantity ?? ''} onChange={(e) => setProductForm(p => ({ ...p, stockQuantity: Number(e.target.value) }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t('Category')}</label>
                  <input value={productForm.category || ''} onChange={(e) => setProductForm(p => ({ ...p, category: e.target.value }))} placeholder={t('e.g. Electronics')} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t('Weight (kg)')}</label>
                  <input type="number" min="0" step="0.1" value={productForm.weightKg ?? ''} onChange={(e) => setProductForm(p => ({ ...p, weightKg: Number(e.target.value) || undefined }))} className={inputCls} placeholder="0.5" />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input type="checkbox" checked={productForm.freeShipping === true} onChange={(e) => setProductForm(p => ({ ...p, freeShipping: e.target.checked || undefined }))} className="rounded" />
                  <label className="text-xs font-bold text-gray-700">{t('Free Shipping')}</label>
                </div>
                {/* Multi-Store Location Mapping: assign physical Master Data stores to this product */}
                <div className="sm:col-span-2 border-t border-gray-100 pt-4">
                  <div className="flex items-center justify-between flex-wrap gap-1.5 mb-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-gray-500">{t('Available At (Stores)')}</label>
                    <span className="text-[9px] text-gray-400 font-semibold">{t('Empty = Main HQ fallback')}</span>
                  </div>
                  {(() => {
                    const companyStores = (stores || []).filter(s => !s.isDeleted && s.isMarketplaceVisible !== false);
                    const toggled = productForm.storeIds || [];
                    const toggle = (id: number) =>
                      setProductForm(p => ({
                        ...p,
                        storeIds: toggled.includes(id) ? toggled.filter(x => x !== id) : [...toggled, id]
                      }));
                    if (companyStores.length === 0) {
                      return (
                        <p className="text-[10px] text-gray-400 font-semibold bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-2">
                          {t('No stores available. Add GPS-enabled stores under Master Data -> Store Management, or the product will use the Main HQ location.')}
                        </p>
                      );
                    }
                    return (
                      <div className="space-y-1.5">
                        {companyStores.map(s => (
                          <label key={s.id} className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 hover:border-gray-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={toggled.includes(s.id)}
                              onChange={() => toggle(s.id)}
                              className="w-4 h-4 accent-brand"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-gray-700 truncate">{s.name}</div>
                              <div className="text-[9px] text-gray-400 font-semibold truncate">
                                {s.location || ''}{s.latitude != null && s.longitude != null ? ` · ${s.latitude.toFixed(4)}, ${s.longitude.toFixed(4)}` : ' · ' + t('No GPS')}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={labelCls + ' mb-0'}>{t('Product Images')} * ({t('1-6 images, at least 1')})</label>
                    {productImages.length > 0 && (
                      <button
                        type="button"
                        onClick={() => openImageStudio(productImages[0], 0)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-black text-brand bg-brand/10 hover:bg-brand/20 border border-brand/20 rounded-full transition cursor-pointer"
                        title={t('Open TradeCore Image Studio to remove background and enhance to 4K pure white #FFFFFF')}
                      >
                        <Sparkles className="w-3 h-3 text-brand" />
                        <span>{t('✨ AI Studio (#FFFFFF & Shadow)')}</span>
                      </button>
                    )}
                  </div>

                  {/* TradeCore Image Studio Banner */}
                  <div className="mb-3 p-3 bg-gradient-to-r from-brand/5 via-cyan-50/50 to-indigo-50/40 rounded-xl border border-brand/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-brand text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                          <span>{t('TradeCore Image Editor')}</span>
                          <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded font-mono">1000x1000 #FFFFFF</span>
                        </div>
                        <p className="text-[10px] text-gray-600 leading-tight">
                          {t('1. Remove background completely -> pure white #FFFFFF • 2. Add soft shadow • 3. Enhance to 4K • 4. Keep label readable • 5. 1000x1000px centered')}
                        </p>
                      </div>
                    </div>
                    {productImages.length > 0 && (
                      <button
                        type="button"
                        onClick={() => openImageStudio(productImages[0], 0)}
                        className="px-3 py-1.5 bg-brand hover:bg-brand-hover text-white text-[11px] font-bold rounded-lg transition shadow-xs flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{t('Enhance Main Photo')}</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                    {productImages.map((img, i) => (
                      <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 group bg-slate-50">
                        <img src={img} alt={`${productForm.name || 'product'} ${i + 1}`} className="w-full h-full object-cover" />
                        <button
                          onClick={() => removeProductImage(i)}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-600 transition cursor-pointer z-10"
                          title={t('Remove image')}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        {i === 0 && (
                          <span className="absolute bottom-1 left-1 text-[8px] font-black uppercase tracking-wider bg-amber-500 text-white px-1.5 py-0.5 rounded-md z-10">{t('Main')}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => openImageStudio(img, i)}
                          className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-slate-900/85 hover:bg-brand text-white text-[9px] font-bold backdrop-blur-xs flex items-center gap-1 transition cursor-pointer shadow-xs z-10"
                          title={t('Edit in TradeCore Studio (Pure White #FFFFFF & Shadow)')}
                        >
                          <Sparkles className="w-3 h-3 text-amber-300" />
                          <span>Studio</span>
                        </button>
                      </div>
                    ))}
                    {productImages.length < MAX_IMAGES && (
                      <button
                        onClick={() => productFileRef.current?.click()}
                        className="aspect-square rounded-xl border-2 border-dashed border-gray-300 text-gray-400 hover:text-brand hover:border-brand/50 flex flex-col items-center justify-center gap-1 transition cursor-pointer"
                        title={t('Add image')}
                      >
                        <ImagePlus className="w-5 h-5" />
                        <span className="text-[9px] font-bold">{t('Add')}</span>
                      </button>
                    )}
                  </div>
                  <input ref={productFileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { onProductImages(e.target.files); e.target.value = ''; }} />
                  <p className="text-[10px] text-gray-400 font-medium mt-1.5">{productImages.length}/{MAX_IMAGES} — {t('First image is the main photo shown on cards.')}</p>
                </div>

                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={labelCls + ' mb-0'}>{t('Product Video')} ({t('optional')})</label>
                    {productImages.length > 0 && (
                      <button
                        type="button"
                        onClick={openVideoStudio}
                        className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-black text-cyan-700 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 rounded-full transition cursor-pointer"
                        title={t('Animate product photo into 8-10s 360° turntable, 24-frame packaging spin, or TikTok 9:16 vertical video')}
                      >
                        <Video className="w-3 h-3 text-cyan-600" />
                        <span>{t('🎥 Generate 360° Video from Photo')}</span>
                      </button>
                    )}
                  </div>
                  <div className={`rounded-xl border ${productVideo ? 'border-gray-200' : 'border-2 border-dashed border-gray-300'} p-3`}>
                    {productVideo ? (
                      <div className="space-y-2.5">
                        <video src={productVideo} controls preload="metadata" className="w-full max-h-56 rounded-xl bg-black" />
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
                            <Play className="w-3 h-3" /> {t('Video attached')}
                          </span>
                          <button onClick={openVideoStudio} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 rounded-lg hover:bg-cyan-100 transition cursor-pointer">
                            <Video className="w-3 h-3 text-cyan-600" /> {t('360° Studio Generator')}
                          </button>
                          <button onClick={() => videoFileRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition cursor-pointer">
                            <Upload className="w-3 h-3" /> {t('Upload File')}
                          </button>
                          <button onClick={() => setProductVideo(undefined)} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition cursor-pointer">
                            <X className="w-3 h-3" /> {t('Remove')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-4 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          {productImages.length > 0 && (
                            <button
                              type="button"
                              onClick={openVideoStudio}
                              className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:brightness-110 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer"
                            >
                              <Video className="w-4 h-4" />
                              <span>{t('Generate 360° Studio Video from Photo')}</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => videoFileRef.current?.click()}
                            className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer"
                          >
                            <Upload className="w-4 h-4" />
                            <span>{t('Upload Video File')}</span>
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-400 text-center flex items-center justify-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>{t('Presets: 1 Minute 360° E-Commerce Turntable (1:1), 1 Minute Packaging Spin, or 1 Minute TikTok Vertical (9:16) with slow motions')}</span>
                        </p>
                      </div>
                    )}
                    <input ref={videoFileRef} type="file" accept="video/mp4,video/quicktime,video/webm,video/x-msvideo" className="hidden" onChange={(e) => { onProductVideo(e.target.files?.[0] || null); e.target.value = ''; }} />
                  </div>
                  <p className="text-[10px] text-gray-400 font-medium mt-1.5">{t('Max 1 video, up to 5 minutes, up to 100MB (MP4/MOV/WebM). Recommended: 2-3 min for best sales.')}</p>
                </div>
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={labelCls + ' mb-0'}>{t('Description')}</label>
                    <button
                      onClick={generateAiDescription}
                      disabled={aiDescLoading || !(productForm.name || '').trim()}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black text-brand bg-brand/10 hover:bg-brand/20 rounded-full transition cursor-pointer disabled:opacity-40"
                      title={t('Generate a product description automatically')}
                    >
                      <Sparkles className={`w-3 h-3 ${aiDescLoading ? 'animate-spin' : ''}`} />
                      {aiDescLoading ? t('Generating…') : t('Generate Description with AI')}
                    </button>
                  </div>
                  <textarea value={productForm.description || ''} onChange={(e) => setProductForm(p => ({ ...p, description: e.target.value }))} rows={2} className={inputCls + ' resize-none'} />
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700">
                  <input type="checkbox" checked={productForm.isActive !== false} onChange={(e) => setProductForm(p => ({ ...p, isActive: e.target.checked }))} className="w-4 h-4 accent-brand" />
                  {t('Active (visible in store)')}
                </label>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setProductFormOpen(false); setEditingProduct(null); }} className="px-4 py-2 text-[11px] font-bold text-gray-500 hover:bg-gray-100 rounded-lg cursor-pointer">
                    {t('Cancel')}
                  </button>
                  <button onClick={saveProduct} className="flex items-center gap-2 px-5 py-2 text-[11px] font-bold text-white bg-brand hover:opacity-90 rounded-lg cursor-pointer">
                    <Save className="w-3.5 h-3.5" /> {t('Save Product')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ANALYTICS TAB — Feature 5: seller dashboard */}
      {tab === 'analytics' && (
        <SellerAnalytics
          companyId={company.id}
          company={company}
          products={products}
          clicks={clicks || []}
          reviews={reviews || []}
          productViews={productViews || []}
          t={t}
        />
      )}

      {/* --- MEGA BUILD: Flash Sales tab --- */}
      {tab === 'flash-sales' && (
        <CompanyFlashSalesManager
          theme={themeProp || 'milk'}
          t={t}
          companyId={company.id}
          flashSales={flashSales || []}
          products={products}
          onSave={flashSalesHandlers?.onSave || (() => {})}
          onDelete={flashSalesHandlers?.onDelete || (() => {})}
        />
      )}

      {/* --- MEGA BUILD: Stories tab --- */}
      {tab === 'stories' && (
        <CompanyStoriesManager
          theme={themeProp || 'milk'}
          t={t}
          companyId={company.id}
          stories={stories || []}
          products={products}
          isPremium={company.subscriptionApproved === true}
          onCreate={storiesHandlers?.onCreate ? ((input: any) => { storiesHandlers!.onCreate({ ...input, companyId: company.id }); return { ok: true }; }) : (() => ({ ok: false, error: 'Not available' }))}
          onDelete={storiesHandlers?.onDelete || (() => {})}
        />
      )}

      {/* --- MEGA BUILD: Chat tab --- */}
      {tab === 'chat' && (
        <MegaChat
          theme={themeProp || 'milk'}
          t={t}
          mode="company"
          conversations={chatConversations || []}
          messages={chatMessages || []}
          products={products}
          companies={[]}
          companyId={company.id}
          onSend={(convId, input) => chatHandlers?.onSend(convId, input)}
          onMarkRead={(convId) => chatHandlers?.onMarkRead(convId)}
        />
      )}

      {/* --- MEGA BUILD: Returns tab --- */}
      {tab === 'returns' && (
        <CompanyReturnsPanel
          theme={themeProp || 'milk'}
          t={t}
          companyId={company.id}
          returns={productReturns || []}
          orders={[]}
          onApprove={(returnId) => returnHandlers?.onApprove(returnId)}
          onReject={(returnId, note) => returnHandlers?.onReject(returnId, note)}
        />
      )}

      {/* --- MEGA BUILD: Disputes tab --- */}
      {tab === 'disputes' && (
        <AdminDisputeCenter
          theme={themeProp || 'milk'}
          t={t}
          disputes={disputes || []}
          disputeMessages={disputeMessages || []}
          returns={productReturns || []}
          orders={[]}
          companies={[]}
          onResolve={(disputeId, outcome, resolution) => { disputeHandlers?.onResolve(disputeId, outcome, resolution); return { ok: true }; }}
          onSetUnderReview={(disputeId) => disputeHandlers?.onSetUnderReview(disputeId)}
          onAddAdminNote={(disputeId, note) => disputeHandlers?.onAddAdminNote(disputeId, note)}
          onAddDisputeMessage={(disputeId, msg) => disputeHandlers?.onAddDisputeMessage(disputeId, msg)}
        />
      )}

      {/* --- MEGA BUILD: Bulk Upload tab --- */}
      {tab === 'bulk-upload' && (
        <MegaBulkUpload
          theme={themeProp || 'milk'}
          t={t}
          company={company}
          existingProducts={products}
          jobs={bulkUploadJobs || []}
          onCreateJob={(job) => bulkUploadHandlers?.onCreateJob(job)}
          onUpdateJob={(job) => bulkUploadHandlers?.onUpdateJob(job)}
          onSaveProduct={(prod) => bulkUploadHandlers?.onSaveProduct(prod)}
        />
      )}

      {/* --- Shipping Zones tab --- */}
      {tab === 'shipping' && (
        <ShippingZonesManager
          zones={shippingZones || []}
          onSave={(z) => shippingZoneHandlers?.onSave({ ...z, companyId: company?.id || 0 })}
          onDelete={(id) => shippingZoneHandlers?.onDelete(id)}
          regions={regionList}
          t={t}
        />
      )}

      <ProductMediaStudioModal
        isOpen={studioModalOpen}
        onClose={() => setStudioModalOpen(false)}
        productImage={studioTargetImage}
        productName={productForm.name || 'Product'}
        initialTab={studioInitialTab}
        onApplyImage={(newImageDataUrl) => {
          if (studioTargetIndex >= 0 && studioTargetIndex < productImages.length) {
            const updated = [...productImages];
            updated[studioTargetIndex] = newImageDataUrl;
            setProductImages(updated);
            if (studioTargetIndex === 0) {
              setProductForm(prev => ({ ...prev, image: newImageDataUrl }));
            }
          } else {
            setProductImages(prev => [newImageDataUrl, ...prev].slice(0, MAX_IMAGES));
            setProductForm(prev => ({ ...prev, image: newImageDataUrl }));
          }
        }}
        onApplyVideo={(newVideoUrl) => {
          setProductVideo(newVideoUrl);
        }}
        translate={t}
      />

      <ConfirmActionModal
        isOpen={deleteProductId !== null}
        onClose={() => setDeleteProductId(null)}
        onConfirm={() => { if (deleteProductId !== null) onDeleteProduct(deleteProductId); }}
        title={t('Delete product?')}
        description={t('This will permanently remove the product from your storefront.')}
        confirmText={t('Delete')}
      />
    </div>
  );
}

// --- SHIPPING ZONES CRUD (inline sub-component) ---
function ShippingZonesManager({ zones, onSave, onDelete, regions, t }: { zones: ShippingZone[]; onSave: (z: ShippingZone) => void; onDelete: (id: number) => void; regions: string[]; t: (s: string) => string }) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<ShippingZone>>({});
  const isNew = editingId === -1;
  const nextId = useMemo(() => Math.max(0, ...zones.map(z => z.id)) + 1, [zones]);

  const startNew = () => { setEditingId(-1); setForm({ name: '', regions: [], baseFee: 0, perKgRate: 0, estimatedDays: 3, isActive: true }); };
  const startEdit = (z: ShippingZone) => { setEditingId(z.id); setForm({ ...z }); };
  const save = () => {
    if (!form.name || (form.regions || []).length === 0) return toast.error(t('Zone name and at least one region are required.'));
    onSave({ ...form, id: editingId === -1 ? nextId : editingId, createdAt: form.createdAt || new Date().toISOString() } as ShippingZone);
    setEditingId(null);
    setForm({});
  };
  const toggleRegion = (r: string) => {
    const cur = form.regions || [];
    setForm({ ...form, regions: cur.includes(r) ? cur.filter(x => x !== r) : [...cur, r] });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-gray-900 flex items-center gap-2"><MapPin className="w-4 h-4 text-brand" /> {t('Shipping Zones')}</h3>
        <button onClick={startNew} className="px-3 py-1.5 bg-brand text-white rounded-lg text-[11px] font-bold hover:bg-brand/90 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> {t('Add Zone')}</button>
      </div>
      {(zones.length === 0 && editingId === null) && <p className="text-gray-400 text-xs italic">No shipping zones configured yet. Add zones to offer calculated shipping at checkout.</p>}

      {(isNew || editingId !== null) && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">{t('Zone Name')}</label>
              <input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full mt-1 px-3 py-1.5 border rounded-lg text-xs font-medium" placeholder="e.g. Dar es Salaam Express" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">{t('Base Fee')} (TZS)</label>
              <input type="number" value={form.baseFee || 0} onChange={e => setForm({ ...form, baseFee: +e.target.value })} className="w-full mt-1 px-3 py-1.5 border rounded-lg text-xs font-medium" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">{t('Per Kg Rate')} (TZS)</label>
              <input type="number" value={form.perKgRate || 0} onChange={e => setForm({ ...form, perKgRate: +e.target.value })} className="w-full mt-1 px-3 py-1.5 border rounded-lg text-xs font-medium" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">{t('Est. Days')}</label>
              <input type="number" min={1} max={30} value={form.estimatedDays || 3} onChange={e => setForm({ ...form, estimatedDays: +e.target.value })} className="w-full mt-1 px-3 py-1.5 border rounded-lg text-xs font-medium" />
            </div>
            <div className="flex items-center gap-2 pt-4">
              <input type="checkbox" checked={form.isActive !== false} onChange={e => setForm({ ...form, isActive: e.target.checked })} className="rounded" />
              <span className="text-xs font-bold text-gray-700">{t('Active')}</span>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">{t('Regions Served')}</label>
            <div className="flex flex-wrap gap-1.5">
              {regions.map(r => (
                <button key={r} type="button" onClick={() => toggleRegion(r)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition ${(form.regions || []).includes(r) ? 'bg-brand text-white border-brand' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={save} className="px-4 py-1.5 bg-brand text-white rounded-lg text-xs font-bold hover:bg-brand/90 flex items-center gap-1"><Save className="w-3.5 h-3.5" /> {t('Save')}</button>
            <button onClick={() => { setEditingId(null); setForm({}); }} className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-300">{t('Cancel')}</button>
          </div>
        </div>
      )}

      {zones.length > 0 && (
        <div className="space-y-2">
          {zones.map(z => (
            <div key={z.id} className={`flex items-center justify-between p-3 rounded-xl border transition ${z.isActive ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
              <div className="space-y-0.5">
                <span className="text-xs font-black text-gray-900">{z.name}</span>
                <div className="text-[10px] text-gray-500 flex gap-3">
                  <span>{(z.regions || []).join(', ')}</span>
                  <span>TZS {z.baseFee.toLocaleString()} base + TZS {z.perKgRate.toLocaleString()}/kg</span>
                  <span>{z.estimatedDays}d est.</span>
                </div>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => startEdit(z)} className="p-1.5 hover:bg-gray-100 rounded-lg"><Pencil className="w-3.5 h-3.5 text-gray-500" /></button>
                <button onClick={() => onDelete(z.id)} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
