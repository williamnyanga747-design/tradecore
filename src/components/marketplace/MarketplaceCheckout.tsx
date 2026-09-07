import React, { useMemo, useRef, useState } from 'react';
import { ChevronLeft, Minus, Plus, Trash2, MapPin, Navigation, Smartphone, Upload, Loader2, CheckCircle2, Store, Zap, ShieldCheck, Clock, Landmark, Banknote } from 'lucide-react';
import { Company, CompanyPaymentMethod, MarketplaceProduct, CollectionNetwork, CollectionSetting, CollectionMode, CollectionStatus, MegaPaymentMethod, ShippingZone } from '../../types';
import { getPublicTheme, PublicTheme } from '../../utils/publicTheme';
import { TANZANIA_REGIONS } from '../../utils/regions';
import { readCustomerLocation, saveCustomerLocation } from '../../utils/haversine';
import { CartLine, TZS, TFunc } from './MarketplaceShared';

export interface CheckoutSubmitData {
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
  paymentStatus?: CollectionStatus;
  collectionReference?: string;
  deferWalletCredit?: boolean;
  // --- MEGA BUILD F1: escrow + mobile money ---
  escrowMethod?: MegaPaymentMethod;
  paymentPhone?: string;
  // --- Shipping ---
  shippingZoneId?: number;
  shippingZoneName?: string;
  shippingFee?: number;
}

export interface InitiateCollectionInput {
  companyId: number;
  customerName?: string;
  customerPhone: string;
  network: CollectionNetwork;
  amount: number;
}

export interface InitiateCollectionResult {
  ok: boolean;
  reference?: string;
  status?: CollectionStatus;
  mode?: CollectionMode;
  error?: string;
}

interface Props {
  theme: PublicTheme;
  t: TFunc;
  regions?: string[];
  company: Company;
  cartItems: CartLine[];
  onUpdateQty: (productId: number, qty: number) => void;
  onRemove: (productId: number) => void;
  onBack: () => void;
  onSubmitOrder: (data: CheckoutSubmitData) => { ok: boolean; orderNumber?: string; error?: string };
  onOrderPlaced: (orderNumber: string) => void;
  // --- MEGA Phase 2B: multi-network collection ---
  collectionSettings?: CollectionSetting[];
  collectionMode?: CollectionMode;
  onInitiateCollection?: (input: InitiateCollectionInput) => Promise<InitiateCollectionResult>;
  // --- MEGA Phase 2C: live shopping context (tag the order so completion records a paid comment) ---
  liveStreamKey?: string;
  // --- Shipping ---
  shippingZones?: ShippingZone[];
}

const DEFAULT_METHODS: CompanyPaymentMethod[] = [
  { id: -1, companyId: -1, methodType: 'mpesa', accountName: 'Global TradeCore', accountNumber: '+255747876653', instructions: 'Lipa kwa M-Pesa. Baada ya malipo, andika Transaction ID.' },
  { id: -2, companyId: -1, methodType: 'tigopesa', accountName: 'Global TradeCore', accountNumber: '+255747876653', instructions: 'Lipa kwa Tigo Pesa. Baada ya malipo, andika Transaction ID.' }
];

const METHOD_LABEL: Record<string, string> = {
  mpesa: 'M-Pesa',
  tigopesa: 'Tigo Pesa',
  airtelmoney: 'Airtel Money',
  halopesa: 'HaloPesa',
  azampesa: 'AzamPesa',
  lipa_number: 'Lipa Namba',
  bank: 'Bank Transfer'
};

const NETWORK_LOGO: Record<string, string> = {
  mpesa: '/images/mpesa.png',
  tigopesa: '/images/tigopesa.png',
  airtelmoney: '/images/airtelmoney.png',
  halopesa: '/images/halopesa.png'
};

// --- MEGA BUILD F1: escrow payment options (STK push / COD) ---
const ESCROW_OPTIONS: { key: MegaPaymentMethod; label: string; hint: string }[] = [
  { key: 'm_pesa', label: 'M-Pesa', hint: 'Lipa na M-Pesa — STK Push' },
  { key: 'tigo_pesa', label: 'Tigo Pesa', hint: 'Lipa na Tigo Pesa — STK Push' },
  { key: 'airtel_money', label: 'Airtel Money', hint: 'Lipa na Airtel Money — STK Push' },
  { key: 'halopesa', label: 'HaloPesa', hint: 'Lipa na HaloPesa — STK Push' },
  { key: 'cod', label: 'Cash Baada ya Kupokea', hint: 'Lipa pesa taslimu ukipokea oda' }
];

export default function MarketplaceCheckout({
  theme, t, regions, company, cartItems, onUpdateQty, onRemove, onBack, onSubmitOrder, onOrderPlaced,
  collectionSettings, collectionMode, onInitiateCollection, liveStreamKey, shippingZones
}: Props) {
  const th = getPublicTheme(theme);
  const milk = theme === 'milk';

  const total = cartItems.reduce((s, i) => s + i.quantity * i.product.price, 0);
  const totalWeight = cartItems.reduce((s, i) => s + i.quantity * (i.product.weightKg || 0), 0);
  const hasFreeShipping = cartItems.every(i => i.product.freeShipping);
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const selectedZone = shippingZones?.find(z => z.id === selectedZoneId) || null;
  const shippingFee = hasFreeShipping ? 0 : selectedZone ? selectedZone.baseFee + selectedZone.perKgRate * Math.ceil(totalWeight || 0.5) : 0;
  const grandTotal = total + shippingFee;

  const activeNetworks = useMemo(
    () => (collectionSettings || []).filter(s => s.isActive !== false),
    [collectionSettings]
  );
  const usePhase2B = activeNetworks.length > 0;
  const mode: CollectionMode = collectionMode || 'manual';

  const methods = useMemo(() => {
    const m = (company.paymentMethods || []).filter(x => x.isActive !== false);
    return m.length > 0 ? m : DEFAULT_METHODS;
  }, [company.paymentMethods]);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [region, setRegion] = useState('');
  const [district, setDistrict] = useState('');
  const [ward, setWard] = useState('');
  const [street, setStreet] = useState('');
  const [instructions, setInstructions] = useState('');
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(readCustomerLocation());
  const [locating, setLocating] = useState(false);
  const [methodType, setMethodType] = useState<string>(methods[0]?.methodType || 'mpesa');
  const [network, setNetwork] = useState<CollectionNetwork>(activeNetworks[0]?.network || 'mpesa');
  // --- MEGA BUILD F1: escrow payment mode ---
  const [payMode, setPayMode] = useState<'escrow' | 'legacy'>('escrow');
  const [escrowMethod, setEscrowMethod] = useState<MegaPaymentMethod>('m_pesa');
  const [stkPhone, setStkPhone] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [receiptImage, setReceiptImage] = useState<string | undefined>();
  const [createAccount, setCreateAccount] = useState(false);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  const selectedMethod = methods.find(m => m.methodType === methodType) || methods[0];
  const selectedNetwork = activeNetworks.find(n => n.network === network) || activeNetworks[0];
  // --- MEGA BUILD F1: escrow is only offered when the Phase 2B collection flow is not active ---
  const isEscrowPay = !usePhase2B && payMode === 'escrow';
  const escrowMobileSelected = isEscrowPay && escrowMethod !== 'cod';

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError(t('Geolocation is not supported on this device.'));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const l = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        saveCustomerLocation(l.lat, l.lng);
        setLoc(l);
        setLocating(false);
      },
      () => { setLocating(false); setError(t('Could not access your location. Enable location access and try again.')); },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const onFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setReceiptImage(typeof reader.result === 'string' ? reader.result : undefined);
    reader.readAsDataURL(file);
  };

  const submit = async (requestedMode: CollectionMode) => {
    setError('');
    if (!name.trim()) return setError(t('Jina linahitajika.'));
    if (!/^(\+?255|0)[67]\d{8}$/.test(phone.trim().replace(/\s/g, ''))) return setError(t('Namba ya simu si sahihi. Tumia format ya Tanzania (+255 or 0...).'));
    if (!region) return setError(t('Chagua region ya delivery.'));
    if (usePhase2B && !selectedNetwork) return setError(t('Chagua njia ya malipo.'));
    if (!usePhase2B && payMode === 'legacy' && !selectedMethod) return setError(t('Chagua njia ya malipo.'));
    // --- MEGA BUILD F1: escrow validation — STK phone required for mobile money, nothing extra for COD ---
    if (escrowMobileSelected && !/^(\+?255|0)[67]\d{8}$/.test(stkPhone.trim().replace(/\s/g, ''))) {
      return setError(t('Ingiza namba sahihi ya simu ya malipo (M-Pesa / Tigo Pesa / Airtel Money / HaloPesa).'));
    }
    if (!isEscrowPay && requestedMode === 'manual' && !transactionId.trim()) return setError(t('Andika Transaction ID ya malipo.'));
    if (createAccount && password.length < 4) return setError(t('Password lazima iwe angalau herufi 4.'));

    setSubmitting(true);

    let collectionReference: string | undefined;
    let collectionStatus: CollectionStatus | undefined;
    let collectionMode: CollectionMode = requestedMode;

    if (usePhase2B) {
      try {
        const init = await onInitiateCollection?.({
          companyId: company.id,
          customerName: name.trim(),
          customerPhone: phone.trim().replace(/\s/g, ''),
          network: selectedNetwork.network,
          amount: total
        });
        if (!init?.ok || !init.reference) {
          setSubmitting(false);
          return setError(init?.error || t('Something went wrong while initiating payment.'));
        }
        collectionReference = init.reference;
        collectionStatus = init.status || (requestedMode === 'auto' ? 'processing' : 'manual_pending_approval');
        collectionMode = init.mode || requestedMode;
      } catch (e) {
        console.error('Collection initiate failed:', e);
        setSubmitting(false);
        return setError(t('Something went wrong while initiating payment.'));
      }
    }

    const res = onSubmitOrder({
      companyId: company.id,
      items: cartItems.map(i => ({ productId: i.product.id, quantity: i.quantity })),
      customerName: name.trim(),
      customerPhone: phone.trim().replace(/\s/g, ''),
      customerRegion: region,
      customerDistrict: district.trim(),
      customerWard: ward.trim(),
      customerStreet: street.trim(),
      deliveryInstructions: [instructions.trim(), liveStreamKey ? `LIVE-STREAM: ${liveStreamKey}` : ''].filter(Boolean).join(' | ') || undefined,
      latitude: loc?.lat,
      longitude: loc?.lng,
      paymentMethodType: isEscrowPay
        ? escrowMethod
        : (usePhase2B ? selectedNetwork.network : (selectedMethod?.methodType || 'mpesa')),
      transactionId: isEscrowPay
        ? (escrowMethod === 'cod' ? 'COD' : 'PENDING-STK')
        : (usePhase2B
          ? (transactionId.trim() || (collectionMode === 'auto' ? `AUTO-${collectionReference}` : ''))
          : (transactionId.trim() || '')),
      amountPaid: isEscrowPay ? (escrowMethod === 'cod' ? 0 : total) : total,
      receiptImage,
      createAccount,
      email: email.trim() || undefined,
      password: createAccount ? password : undefined,
      paymentStatus: usePhase2B ? collectionStatus : (escrowMobileSelected ? 'processing' : undefined),
      collectionReference: usePhase2B ? collectionReference : undefined,
      deferWalletCredit: usePhase2B ? true : undefined,
      // --- MEGA BUILD F1 ---
      escrowMethod: isEscrowPay ? escrowMethod : undefined,
      paymentPhone: escrowMobileSelected ? stkPhone.trim().replace(/\s/g, '') : undefined,
      // --- Shipping ---
      shippingZoneId: selectedZoneId ?? undefined,
      shippingZoneName: selectedZone?.name,
      shippingFee: shippingFee || undefined,
    });

    setSubmitting(false);
    if (res.ok && res.orderNumber) {
      // Phase 2B: MarketplaceApp renders the success / payment-waiting screen (cart already cleared).
      if (!usePhase2B) onOrderPlaced(res.orderNumber);
    } else {
      setError(res.error || t('Something went wrong while placing your order.'));
    }
  };

  const inputCls = th.input;
  const labelCls = `block text-[10px] font-black uppercase tracking-wider mb-1.5 ${th.label}`;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      <button onClick={onBack} className={`flex items-center gap-1.5 text-[11px] font-bold ${th.textMuted} hover:underline cursor-pointer`}>
        <ChevronLeft className="w-4 h-4" /> {t('Back to Cart')}
      </button>

      <h1 className={`text-xl md:text-2xl font-black ${th.strongText}`}>{t('Checkout')} — {company.name}</h1>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Left: form */}
        <div className="lg:col-span-3 space-y-5">
          {/* Delivery details */}
          <section className={`${th.card} ${th.cardBorder} rounded-2xl p-5`}>
            <h2 className={`text-sm font-black ${th.strongText} mb-4`}>{t('Delivery Details')}</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{t('Jina Kamili')} *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. John Makala" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t('Simu')} *</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+255 7XX XXX XXX" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t('Region')} *</label>
                <select value={region} onChange={(e) => setRegion(e.target.value)} className={inputCls + ' cursor-pointer'}>
                  <option value="">-- {t('Chagua Region')} --</option>
                  {(regions && regions.length > 0 ? regions : TANZANIA_REGIONS).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>{t('District')}</label>
                <input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="e.g. Ilala" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t('Ward')}</label>
                <input value={ward} onChange={(e) => setWard(e.target.value)} placeholder="e.g. Kariakoo" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t('Street / Area')}</label>
                <input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="e.g. Nyerere Road, Plot 12" className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>{t('Delivery Instructions (optional)')}</label>
                <input value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="e.g. Piga simu kabla ya kufika" className={inputCls} />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button onClick={useMyLocation} className={`flex items-center gap-2 px-4 py-2.5 text-[11px] font-black rounded-xl transition cursor-pointer ${th.btnSecondary} ${th.btnSecondaryText}`}>
                <Navigation className="w-3.5 h-3.5" /> {locating ? t('Finding location...') : t('Use My Location')}
              </button>
              {loc && (
                <span className={`flex items-center gap-1.5 text-[11px] font-bold ${th.chipText} ${th.chip} ${th.chipBorder} px-3 py-1.5 rounded-full`}>
                  <MapPin className="w-3.5 h-3.5" /> {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
                </span>
              )}
            </div>
          </section>

          {/* Payment */}
          <section className={`${th.card} ${th.cardBorder} rounded-2xl p-5`}>
            <h2 className={`text-sm font-black ${th.strongText} mb-4`}>{t('Payment Method')}</h2>

            {usePhase2B ? (
              <>
                {/* Network cards from collection_settings */}
                <div className="grid sm:grid-cols-2 gap-2">
                  {activeNetworks.map(n => (
                    <button
                      key={n.id}
                      onClick={() => setNetwork(n.network)}
                      className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                        network === n.network
                          ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/40'
                          : `${th.cardBorder} ${th.card} hover:brightness-105`
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden ${milk ? 'bg-green-100 text-green-700' : 'bg-green-500/20 text-green-400'}`}>
                          {NETWORK_LOGO[n.network] ? (
                            <img src={NETWORK_LOGO[n.network]} alt={n.displayName} className="w-full h-full object-cover" />
                          ) : (
                            <Smartphone className="w-4.5 h-4.5" />
                          )}
                        </div>
                        <div>
                          <div className={`text-xs font-black ${th.strongText}`}>{n.displayName}</div>
                          <div className={`text-[10px] ${th.textMuted} font-bold`}>{n.payNumber}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {selectedNetwork && (
                  <div className={`mt-4 p-4 rounded-xl ${milk ? 'bg-amber-50 border border-amber-200' : 'bg-amber-500/10 border border-amber-500/30'}`}>
                    <div className={`text-[11px] font-black ${th.chipText}`}>
                      {t('Lipa kwa')}: <span className="underline">{selectedNetwork.payNumber}</span>
                      {selectedNetwork.accountName ? ` (${selectedNetwork.accountName})` : ''}
                    </div>
                    {selectedNetwork.instructions && (
                      <div className={`text-[11px] ${th.textMuted} font-semibold mt-1`}>
                        {selectedNetwork.instructions.replace(/\{payNumber\}/g, selectedNetwork.payNumber)}
                      </div>
                    )}
                    <div className={`flex items-center gap-1.5 mt-2 text-[10px] ${th.chipText} font-bold`}>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {t('Payments are collected by the platform and released to the seller after approval.')}
                    </div>
                  </div>
                )}

                <div className="mt-4 grid sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className={labelCls}>{t('Transaction ID')}{mode === 'manual' ? ' *' : ''}</label>
                    <input
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      placeholder="e.g. SJK2KX9QKL"
                      className={inputCls}
                      disabled={mode === 'auto'}
                    />
                    {mode === 'auto' && (
                      <p className={`text-[10px] ${th.textDim} font-semibold mt-1`}>
                        {t('Auto mode: press Lipa Sasa below to pay instantly with a USSD push — no Transaction ID needed.')}
                      </p>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>{t('Receipt Screenshot (optional)')}</label>
                    <button
                      onClick={() => fileRef.current?.click()}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed ${th.cardBorder} text-[11px] font-bold ${th.textMuted} hover:brightness-105 cursor-pointer`}
                    >
                      <Upload className="w-4 h-4" /> {receiptImage ? t('Change receipt screenshot') : t('Upload receipt screenshot')}
                    </button>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] || null)} />
                    {receiptImage && (
                      <img src={receiptImage} alt="Receipt" className="mt-2 h-32 rounded-xl object-cover border border-white/10" />
                    )}
                  </div>
                </div>

                {/* CTA buttons per mode */}
                <div className="mt-5 space-y-2.5">
                  {mode === 'auto' && (
                    <button
                      onClick={() => submit('auto')}
                      disabled={submitting}
                      className={`w-full flex items-center justify-center gap-2 px-5 py-3 text-sm font-black rounded-2xl transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${th.btnPrimary} ${th.btnPrimaryText}`}
                    >
                      {submitting ? (<><Loader2 className="w-4 h-4 animate-spin" /> {t('Initiating Payment...')}</>) : (<><Zap className="w-4 h-4" /> {t('Lipa Sasa — Tuma Order')}</>)}
                    </button>
                  )}
                  <button
                    onClick={() => submit(mode === 'auto' ? 'manual' : 'manual')}
                    disabled={submitting}
                    className={`w-full flex items-center justify-center gap-2 px-5 py-3 text-sm font-black rounded-2xl transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${mode === 'auto' ? `${th.btnSecondary} ${th.btnSecondaryText}` : `${th.btnPrimary} ${th.btnPrimaryText}`}`}
                  >
                    {submitting ? (<><Loader2 className="w-4 h-4 animate-spin" /> {t('Placing Order...')}</>) : (<><CheckCircle2 className="w-4 h-4" /> {t('Nime Malipo, Weka Order')}</>)}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* --- MEGA BUILD F1: Escrow / Legacy mode toggle --- */}
                <div className={`grid grid-cols-2 gap-1 p-1 rounded-xl mb-4 ${milk ? 'bg-black/5' : 'bg-white/10'}`}>
                  <button
                    onClick={() => setPayMode('escrow')}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-black rounded-lg transition cursor-pointer ${payMode === 'escrow' ? `${th.btnPrimary} ${th.btnPrimaryText}` : `${th.textMuted} hover:brightness-110`}`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" /> {t('Malipo Salama (Escrow)')}
                  </button>
                  <button
                    onClick={() => setPayMode('legacy')}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-black rounded-lg transition cursor-pointer ${payMode === 'legacy' ? `${th.btnPrimary} ${th.btnPrimaryText}` : `${th.textMuted} hover:brightness-110`}`}
                  >
                    <Smartphone className="w-3.5 h-3.5" /> {t('Malipo ya Kawaida')}
                  </button>
                </div>

                {payMode === 'escrow' && (
                  <div className="space-y-3">
                    <div className={`p-3 rounded-xl flex items-start gap-2.5 ${milk ? 'bg-green-50 border border-green-200' : 'bg-green-500/10 border border-green-500/30'}`}>
                      <ShieldCheck className={`w-4 h-4 mt-0.5 shrink-0 ${milk ? 'text-green-700' : 'text-green-400'}`} />
                      <p className={`text-[10px] font-bold leading-relaxed ${milk ? 'text-green-800' : 'text-green-300'}`}>
                        {t('Pesa zako zinashikiliwa salama na Global TradeCore escrow — muuzaji analipwa BAADA ya kuthibitisha umepokea oda yako.')}
                      </p>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-2">
                      {ESCROW_OPTIONS.map(o => {
                        const active = escrowMethod === o.key;
                        return (
                          <button
                            key={o.key}
                            onClick={() => setEscrowMethod(o.key)}
                            className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                              active
                                ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/40'
                                : `${th.cardBorder} ${th.card} hover:brightness-105`
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden ${milk ? 'bg-green-100 text-green-700' : 'bg-green-500/20 text-green-400'}`}>
                                {o.key === 'cod'
                                  ? <Banknote className="w-4.5 h-4.5" />
                                  : NETWORK_LOGO[o.key === 'm_pesa' ? 'mpesa' : o.key === 'tigo_pesa' ? 'tigopesa' : o.key === 'airtel_money' ? 'airtelmoney' : 'halopesa'] ? (
                                    <img src={NETWORK_LOGO[o.key === 'm_pesa' ? 'mpesa' : o.key === 'tigo_pesa' ? 'tigopesa' : o.key === 'airtel_money' ? 'airtelmoney' : 'halopesa']} alt={o.label} className="w-full h-full object-cover" />
                                  ) : (
                                    <Smartphone className="w-4.5 h-4.5" />
                                  )}
                              </div>
                              <div className="min-w-0">
                                <div className={`text-xs font-black truncate ${th.strongText}`}>{o.label}</div>
                                <div className={`text-[10px] ${th.textMuted} font-bold truncate`}>{o.hint}</div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {escrowMethod !== 'cod' ? (
                      <>
                        <div>
                          <label className={labelCls}>{t('Namba ya Malipo')} *</label>
                          <input
                            value={stkPhone}
                            onChange={(e) => setStkPhone(e.target.value)}
                            placeholder="+255 7XX XXX XXX"
                            className={inputCls}
                            inputMode="tel"
                          />
                        </div>
                        <div className={`p-4 rounded-xl ${milk ? 'bg-amber-50 border border-amber-200' : 'bg-amber-500/10 border border-amber-500/30'}`}>
                          <div className={`flex items-center gap-2 text-[11px] font-black ${th.chipText}`}>
                            <Zap className="w-3.5 h-3.5" /> {t('Utapokea STK Push kwenye simu yako — ingiza PIN yako kuthibitisha malipo.')}
                          </div>
                          <div className={`flex items-center gap-1.5 mt-2 text-[10px] ${th.chipText} font-bold`}>
                            <Clock className="w-3.5 h-3.5" />
                            {t('Pesa zitashikiliwa escrow hadi utakapothibitisha umepokea mzigo (au kiotomatiki baada ya saa 48).')}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className={`p-4 rounded-xl ${milk ? 'bg-blue-50 border border-blue-200' : 'bg-blue-500/10 border border-blue-500/30'}`}>
                        <div className={`flex items-center gap-2 text-[11px] font-black ${milk ? 'text-blue-800' : 'text-blue-300'}`}>
                          <Banknote className="w-3.5 h-3.5" /> {t('Lipa pesa taslimu unapopokea oda yako — hakuna malipo ya awali yanayohitajika.')}
                        </div>
                        <div className={`flex items-center gap-1.5 mt-2 text-[10px] ${milk ? 'text-blue-700' : 'text-blue-300/80'} font-bold`}>
                          <ShieldCheck className="w-3.5 h-3.5" />
                          {t('Thibitisha umepokea mzigo na umelipa baada ya delivery.')}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {payMode === 'legacy' && (
                  <>
                <div className="grid sm:grid-cols-2 gap-2">
                  {methods.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setMethodType(m.methodType)}
                      className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                        methodType === m.methodType
                          ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/40'
                          : `${th.cardBorder} ${th.card} hover:brightness-105`
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${milk ? 'bg-green-100 text-green-700' : 'bg-green-500/20 text-green-400'}`}>
                          <Smartphone className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <div className={`text-xs font-black ${th.strongText}`}>{METHOD_LABEL[m.methodType] || m.methodType}</div>
                          <div className={`text-[10px] ${th.textMuted} font-bold`}>{m.accountNumber}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {selectedMethod && (
                  <div className={`mt-4 p-4 rounded-xl ${milk ? 'bg-amber-50 border border-amber-200' : 'bg-amber-500/10 border border-amber-500/30'}`}>
                    <div className={`text-[11px] font-black ${th.chipText}`}>{t('Lipa kwa')}: <span className="underline">{METHOD_LABEL[selectedMethod.methodType]} {selectedMethod.accountNumber} ({selectedMethod.accountName})</span></div>
                    {selectedMethod.instructions && (
                      <div className={`text-[11px] ${th.textMuted} font-semibold mt-1`}>{selectedMethod.instructions}</div>
                    )}
                  </div>
                )}

                <div className="mt-4 grid sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className={labelCls}>{t('Transaction ID')} *</label>
                    <input value={transactionId} onChange={(e) => setTransactionId(e.target.value)} placeholder="e.g. SJK2KX9QKL" className={inputCls} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>{t('Receipt Screenshot (optional)')}</label>
                    <button
                      onClick={() => fileRef.current?.click()}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed ${th.cardBorder} text-[11px] font-bold ${th.textMuted} hover:brightness-105 cursor-pointer`}
                    >
                      <Upload className="w-4 h-4" /> {receiptImage ? t('Change receipt screenshot') : t('Upload receipt screenshot')}
                    </button>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] || null)} />
                    {receiptImage && (
                      <img src={receiptImage} alt="Receipt" className="mt-2 h-32 rounded-xl object-cover border border-white/10" />
                    )}
                  </div>
                </div>
                  </>
                )}
              </>
            )}

            <p className={`text-[9px] ${th.textDim} font-semibold text-center mt-2`}>
              {t('By placing an order you agree that staff will verify your payment before delivery begins.')}
            </p>
          </section>

          {/* Create account */}
          <section className={`${th.card} ${th.cardBorder} rounded-2xl p-5`}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={createAccount} onChange={(e) => setCreateAccount(e.target.checked)} className="mt-0.5 w-4 h-4 accent-amber-500" />
              <div>
                <span className={`text-xs font-black ${th.strongText}`}>{t('Unda akaunti ya mteja')}</span>
                <span className={`block text-[10px] ${th.textMuted} font-semibold mt-0.5`}>{t('Track all your orders with this phone number. Optional for guests.')}</span>
              </div>
            </label>
            {createAccount && (
              <div className="grid sm:grid-cols-2 gap-3 mt-4">
                <div>
                  <label className={labelCls}>{t('Email')}</label>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t('Password')}</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('Angalau herufi 4')} className={inputCls} />
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Right: summary */}
        <div className="lg:col-span-2">
          <div className={`${th.card} ${th.cardBorder} rounded-2xl p-5 sticky top-24 space-y-3`}>
            <h2 className={`text-sm font-black ${th.strongText} flex items-center gap-2`}>
              <Store className="w-4 h-4" /> {t('Order Summary')}
            </h2>
            <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1">
              {cartItems.map(({ product, quantity }) => (
                <div key={product.id} className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-yellow-400 to-amber-600 text-white text-sm font-black">
                        {(product.name || '-').charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[11px] font-black ${th.strongText} line-clamp-1`}>{product.name}</div>
                    <div className={`text-[9px] ${th.textDim} font-semibold`}>{TZS(product.price)} × {quantity}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => onUpdateQty(product.id, quantity - 1)} className={`w-6 h-6 rounded-md flex items-center justify-center ${th.btnSecondary} ${th.btnSecondaryText} cursor-pointer`}>
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className={`w-6 text-center text-[11px] font-black ${th.strongText}`}>{quantity}</span>
                    <button onClick={() => onUpdateQty(product.id, quantity + 1)} disabled={(product.stockQuantity || 0) <= quantity} className={`w-6 h-6 rounded-md flex items-center justify-center ${th.btnSecondary} ${th.btnSecondaryText} cursor-pointer disabled:opacity-30`}>
                      <Plus className="w-3 h-3" />
                    </button>
                    <button onClick={() => onRemove(product.id)} className={`p-1 ml-1 text-red-400 hover:bg-red-500/10 rounded-lg cursor-pointer`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className={`border-t ${th.border} pt-3 space-y-1.5`}>
              <div className="flex justify-between text-[11px] font-bold">
                <span className={th.textMuted}>{t('Subtotal')}</span>
                <span className={th.strongText}>{TZS(total)}</span>
              </div>
              {shippingZones && shippingZones.length > 0 && !hasFreeShipping && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">{t('Shipping Zone')}</label>
                  <select
                    value={selectedZoneId ?? ''}
                    onChange={(e) => setSelectedZoneId(e.target.value ? Number(e.target.value) : null)}
                    className={`w-full px-2 py-1.5 border ${th.border} rounded-lg text-[11px] font-semibold ${th.strongText} bg-white`}
                  >
                    <option value="">{t('Select shipping zone')}</option>
                    {shippingZones.filter(z => z.isActive !== false).map(z => (
                      <option key={z.id} value={z.id}>{z.name} — TZS {z.baseFee.toLocaleString()} + {TZS(z.perKgRate)}/kg ({z.estimatedDays}d)</option>
                    ))}
                  </select>
                </div>
              )}
              {hasFreeShipping && (
                <div className="flex justify-between text-[11px] font-bold">
                  <span className={th.textMuted}>{t('Delivery')}</span>
                  <span className="text-emerald-500">{t('Free')}</span>
                </div>
              )}
              {shippingFee > 0 && (
                <div className="flex justify-between text-[11px] font-bold">
                  <span className={th.textMuted}>{t('Shipping')} ({selectedZone?.name})</span>
                  <span className={th.strongText}>{TZS(shippingFee)}</span>
                </div>
              )}
              {shippingFee === 0 && !hasFreeShipping && (
                <div className="flex justify-between text-[11px] font-bold">
                  <span className={th.textMuted}>{t('Delivery')}</span>
                  <span className={th.textMuted}>{t('Calculated by company')}</span>
                </div>
              )}
              <div className="flex justify-between items-center border-t border-dashed pt-2.5 mt-2">
                <span className={`text-xs font-black ${th.strongText}`}>{t('Total to Pay')}</span>
                <span className={`text-xl font-black ${th.statValue}`}>{TZS(grandTotal)}</span>
              </div>
            </div>

            {/* TRA COMPLIANCE — seller TIN + VAT notice (visible on every checkout) */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Landmark className="w-3.5 h-3.5 text-amber-400" />
                <span className={`text-[10px] font-black uppercase tracking-wider ${th.strongText}`}>{company.name}</span>
              </div>
              <p className={`text-[9px] font-semibold ${th.textDim}`}>
                {t('TIN')}: {company.tinNumber ? <span className="font-mono font-black">{company.tinNumber}</span> : <span className="text-red-400">{t('Not provided yet')}</span>}
                {company.vrnNumber ? <> · {t('VRN')}: <span className="font-mono font-black">{company.vrnNumber}</span></> : null}
              </p>
              {company.isVatRegistered && (
                <p className={`text-[9px] font-bold ${th.textDim}`}>
                  {t('This seller is VAT registered. A tax invoice with EFD receipt will be issued for your order.')}
                </p>
              )}
            </div>

            {error && (
              <div className="text-[11px] font-bold text-red-400 bg-red-500/10 border border-red-500/40 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            {!usePhase2B && (
              <button
                onClick={() => submit('manual')}
                disabled={submitting || cartItems.length === 0}
                className={`w-full flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-black rounded-2xl transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${th.btnPrimary} ${th.btnPrimaryText}`}
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {escrowMobileSelected ? t('Inatuma STK Push...') : t('Placing Order...')}</>
                ) : (
                  <>
                    {escrowMobileSelected ? <Zap className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                    {isEscrowPay ? (escrowMethod === 'cod' ? t('Weka Order — Lipa Baadaye') : t('Lipa Sasa — Weka Order')) : t('Place Order')}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
