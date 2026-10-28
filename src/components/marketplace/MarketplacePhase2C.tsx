import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  ChevronLeft, HandCoins, Users, CalendarClock, Radio, Heart, MessageCircle, Send,
  MapPin, Navigation, Truck, Smartphone, CheckCircle2, Loader2, ShieldCheck, Clock,
  Gift, Star, Play, Bot, Copy, ExternalLink, ShoppingCart, Upload, Image, X, Plus,
  Share2, Check, Search, Sparkles, Bike, Receipt, Printer, Phone, RefreshCw
} from 'lucide-react';
import {
  Company, MarketplaceProduct, Offer, GroupDeal, GroupDealParticipant,
  InstallmentPlan, InstallmentOrder, InstallmentPayment, LiveStream, LiveComment,
  Delivery, DeliveryUpdate, LoyaltyCustomer, CollectionSetting, CollectionNetwork,
  WhatsappConversation
} from '../../types';
import { getPublicTheme, PublicTheme } from '../../utils/publicTheme';
import { TANZANIA_REGIONS } from '../../utils/regions';
import { TZS, TFunc } from './MarketplaceShared';
import InstallmentVisualSchedule from './InstallmentVisualSchedule';

export type FeatureT = TFunc;

export interface FeatureHandlers {
  onSubmitOffer: (input: {
    productId: number; companyId: number; customerName: string; customerPhone: string;
    originalPrice: number; offeredPrice: number;
  }) => { ok: boolean; error?: string };
  onInitiateOfferPayment: (offerId: number, address: {
    customerName?: string; customerPhone?: string;
    customerRegion?: string; customerDistrict?: string; customerWard?: string; customerStreet?: string;
    transactionId?: string; receiptImage?: string;
  }, network?: CollectionNetwork) => { ok: boolean; reference?: string; error?: string };
  onCreateGroupDeal?: (input: {
    productId: number; companyId: number; groupPrice: number; minBuyers: number; durationHours?: number;
    title?: string; isBuyerCreated?: boolean;
    customerName?: string; customerPhone?: string; customerRegion?: string; customerDistrict?: string; customerWard?: string; customerStreet?: string;
    transactionId?: string; receiptImage?: string; network?: CollectionNetwork;
    targetTotalAmount?: number; initialContribution?: number;
    deliveryRecipientName?: string; deliveryRecipientPhone?: string; deliveryAddress?: string;
  }) => { ok: boolean; dealId?: number; shareCode?: string; error?: string };
  onJoinGroupDeal: (dealId: number, input: {
    customerName: string; customerPhone: string;
    customerRegion?: string; customerDistrict?: string; customerWard?: string; customerStreet?: string;
    transactionId?: string; receiptImage?: string;
    contributionAmount?: number;
    network?: CollectionNetwork;
  }) => {
    ok: boolean; reference?: string; error?: string; alreadyPaid?: boolean;
  };
  onInitiateGroupPayment: (dealId: number, address: {
    customerName?: string; customerPhone?: string;
    customerRegion?: string; customerDistrict?: string; customerWard?: string; customerStreet?: string;
    transactionId?: string; receiptImage?: string;
    contributionAmount?: number;
    note?: string;
  }, network?: CollectionNetwork) => { ok: boolean; reference?: string; error?: string };
  onCreateInstallmentOrder: (input: {
    productId: number; companyId: number; installmentPlanId?: number;
    customerName: string; customerPhone: string;
    customerRegion?: string; customerDistrict?: string; customerWard?: string; customerStreet?: string;
    transactionId?: string; receiptImage?: string; network?: CollectionNetwork;
    downPaymentPercent?: number; installmentsCount?: number; installmentPercentExtra?: number;
  }) => { ok: boolean; trackingCode?: string; error?: string };
  onInitiateInstallmentPayment: (installmentOrderId: number, type: 'down' | 'installment', address: {
    customerRegion?: string; customerDistrict?: string; customerWard?: string; customerStreet?: string;
    transactionId?: string; receiptImage?: string;
  }, network?: CollectionNetwork) => { ok: boolean; reference?: string; error?: string };
  onAddLiveComment: (streamId: number, input: {
    customerName: string; customerPhone?: string; message: string; type?: 'comment' | 'want'; productId?: number;
  }) => void;
  onLikeLiveStream: (streamId: number) => void;
  onRedeemLoyalty: (phone: string) => { ok: boolean; code?: string; valueTzs?: number; error?: string };
  onWhatsappMessage: (phone: string, message: string) => WhatsappConversation | null;
  onUpdateDeliveryStatus?: (deliveryId: number, status: Delivery['status'], note?: string) => void;
  onUpdateDeliveryLocation?: (deliveryId: number, lat: number, lng: number) => void;
}

interface Props {
  route: { name: string; id?: string };
  theme: PublicTheme;
  t: FeatureT;
  companies: Company[];
  products: MarketplaceProduct[];
  offers: Offer[];
  groupDeals: GroupDeal[];
  groupDealParticipants: GroupDealParticipant[];
  installmentPlans: InstallmentPlan[];
  installmentOrders: InstallmentOrder[];
  installmentPayments: InstallmentPayment[];
  liveStreams: LiveStream[];
  liveComments: LiveComment[];
  deliveries: Delivery[];
  deliveryUpdates: DeliveryUpdate[];
  loyaltyCustomers: LoyaltyCustomer[];
  whatsappConversations: WhatsappConversation[];
  collectionSettings?: CollectionSetting[];
  session?: { id?: number; phone: string; name: string } | null;
  onNavigate: (path: string) => void;
  onBack: () => void;
  onAddToCart: (product: MarketplaceProduct) => void;
  onCheckout: () => void;
  handlers: FeatureHandlers;
}

export const NETWORK_META: Record<string, { label: string; color: string }> = {
  mpesa: { label: 'M-Pesa', color: 'bg-green-500/20 text-green-400' },
  tigopesa: { label: 'Tigo Pesa', color: 'bg-blue-500/20 text-blue-400' },
  airtelmoney: { label: 'Airtel Money', color: 'bg-red-500/20 text-red-400' },
  halopesa: { label: 'HaloPesa', color: 'bg-yellow-500/20 text-yellow-400' },
  azampesa: { label: 'AzamPesa', color: 'bg-sky-500/20 text-sky-400' },
  bank: { label: 'Bank', color: 'bg-indigo-500/20 text-indigo-400' }
};

function Card(props: { th: ReturnType<typeof getPublicTheme>; children: React.ReactNode; className?: string }) {
  const { th } = props;
  return <div className={`${th.card} ${th.cardBorder} rounded-2xl ${props.className || ''}`}>{props.children}</div>;
}

function BackButton(props: { th: ReturnType<typeof getPublicTheme>; t: FeatureT; onClick: () => void }) {
  return (
    <button onClick={props.onClick} className={`flex items-center gap-1.5 text-[11px] font-bold ${props.th.textMuted} hover:underline cursor-pointer`}>
      <ChevronLeft className="w-4 h-4" /> {props.t('Back')}
    </button>
  );
}

function NotFound(props: { th: ReturnType<typeof getPublicTheme>; t: FeatureT; onBack: () => void; label: string }) {
  return (
    <div className={`${props.th.card} ${props.th.cardBorder} rounded-2xl p-10 text-center max-w-md mx-auto`}>
      <div className={`text-sm font-black ${props.th.strongText}`}>{props.t('Haipatikani')}</div>
      <div className={`text-[11px] ${props.th.textMuted} font-semibold mt-1`}>{props.label}</div>
      <button onClick={props.onBack} className={`mt-4 px-5 py-2.5 text-[11px] font-black rounded-xl ${props.th.btnPrimary} ${props.th.btnPrimaryText} cursor-pointer`}>
        {props.t('Back')}
      </button>
    </div>
  );
}

/** Shared comprehensive checkout modal used by Offer / Group Deal / Installment payments. */
export function PaymentModal(props: {
  th: ReturnType<typeof getPublicTheme>;
  t: FeatureT;
  milk: boolean;
  title: string;
  amount: number;
  prefillName: string;
  prefillPhone: string;
  prefillRegion?: string;
  prefillDistrict?: string;
  prefillWard?: string;
  prefillStreet?: string;
  isInstallmentMilestone?: boolean;
  isCrowdfundGroupBuy?: boolean;
  targetTotalAmount?: number;
  remainingAmount?: number;
  networks: CollectionSetting[];
  note?: string;
  onClose: () => void;
  onPay: (input: {
    customerName: string; customerPhone: string;
    customerRegion: string; customerDistrict: string; customerWard: string; customerStreet: string;
    network: CollectionNetwork;
    transactionId?: string;
    receiptImage?: string;
    contributionAmount?: number;
  }) => { ok: boolean; reference?: string; error?: string };
}) {
  const { th, t, milk } = props;
  const activeNetworks = (props.networks || []).filter(n => n.isActive !== false);
  const [name, setName] = useState(props.prefillName || '');
  const [phone, setPhone] = useState(props.prefillPhone || '');
  const [region, setRegion] = useState(props.prefillRegion || '');
  const [district, setDistrict] = useState(props.prefillDistrict || '');
  const [ward, setWard] = useState(props.prefillWard || '');
  const [street, setStreet] = useState(props.prefillStreet || '');
  const [network, setNetwork] = useState<CollectionNetwork>(activeNetworks[0]?.network || 'mpesa');
  const [customPayAmount, setCustomPayAmount] = useState<number>(props.amount || 0);
  const [transactionId, setTransactionId] = useState('');
  const [receiptImage, setReceiptImage] = useState<string | undefined>();
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ ok: boolean; reference?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setCustomPayAmount(props.amount || 0);
  }, [props.amount]);

  const selected = activeNetworks.find(n => n.network === network);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError(t('Picha ya risiti isizidi 5MB.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setReceiptImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const pay = () => {
    setError('');
    const effectiveName = name.trim() || props.prefillName || '';
    const effectivePhone = phone.trim() || props.prefillPhone || '';
    if (!effectiveName) return setError(t('Jina kamili linahitajika.'));
    if (!/^(\+?255|0)[67]\d{8}$/.test(effectivePhone.replace(/\s/g, ''))) {
      return setError(t('Namba ya simu si sahihi. Tumia format ya Tanzania (+255 au 07XX...).'));
    }
    const effectiveRegion = region || props.prefillRegion || (props.isInstallmentMilestone ? 'Dar es Salaam' : '');
    if (!effectiveRegion) return setError(t('Tafadhali chagua mkoa wako kwa ajili ya usafirishaji.'));

    const effectiveAmount = props.isCrowdfundGroupBuy ? customPayAmount : props.amount;
    if (props.isCrowdfundGroupBuy && (!effectiveAmount || effectiveAmount <= 0)) {
      return setError(t('Weka kiasi unacholipa kupunguza bei ya bidhaa (angalau TZS 1,000).'));
    }

    setBusy(true);
    const res = props.onPay({
      customerName: effectiveName,
      customerPhone: effectivePhone,
      customerRegion: effectiveRegion,
      customerDistrict: district.trim() || props.prefillDistrict || '',
      customerWard: ward.trim() || props.prefillWard || '',
      customerStreet: street.trim() || props.prefillStreet || '',
      network,
      transactionId: transactionId.trim() || undefined,
      receiptImage,
      contributionAmount: effectiveAmount
    });
    setBusy(false);
    if (!res.ok || !res.reference) return setError(res.error || t('Kumetokea hitilafu. Tafadhali jaribu tena.'));

    try {
      localStorage.setItem('tradecore_buyer_phone', effectivePhone);
      localStorage.setItem('tradecore_buyer_name', effectiveName);
    } catch {}

    setResult({ ok: true, reference: res.reference });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto" onClick={() => props.onClose()}>
      <div className={`${th.card} ${th.cardBorder} rounded-2xl p-5 w-full max-w-lg space-y-3.5 my-8 max-h-[90vh] overflow-y-auto shadow-2xl`} onClick={e => e.stopPropagation()}>
        {result?.ok ? (
          <div className="space-y-4 py-3 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <div className={`text-base font-black ${th.strongText}`}>{t('Malipo Yamerekodiwa & Order Imekamilika!')}</div>
            <div className={`flex items-center justify-center gap-1.5 text-xs font-black ${th.chipText} ${th.chip} ${th.chipBorder} px-3.5 py-2 rounded-full mx-auto`}>
              <ShieldCheck className="w-4 h-4 text-emerald-500" /> {t('Payment Reference')}: <span className="font-mono">{result.reference}</span>
            </div>
            {transactionId && (
              <div className="text-xs font-bold text-gray-500">
                {t('Transaction ID')}: <span className="font-mono text-emerald-600">{transactionId}</span>
              </div>
            )}
            <p className={`text-xs ${th.textMuted} font-semibold leading-relaxed max-w-sm mx-auto`}>
              {t('Taarifa zako zimehifadhiwa kikamilifu. Muuzaji ametaarifiwa kuanza kuandaa mzigo wako na usafirishaji kuelekea')} {ward || district || region || props.prefillRegion || 'eneo lako'}.
            </p>
            <button onClick={() => props.onClose()} className={`w-full px-5 py-2.5 text-xs font-black rounded-xl ${th.btnPrimary} ${th.btnPrimaryText} cursor-pointer shadow-md`}>
              {t('Sawa, Nimemaliza')}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h4 className={`text-sm font-black ${th.strongText} flex items-center gap-2`}>
                <HandCoins className="w-4 h-4 text-brand" /> {props.title}
              </h4>
              <button onClick={() => props.onClose()} className={`p-1.5 rounded-lg cursor-pointer ${th.textMuted} hover:bg-black/5`}>✕</button>
            </div>

            {props.isCrowdfundGroupBuy ? (
              <div className={`rounded-2xl border p-4 space-y-3 ${milk ? 'border-indigo-200 bg-indigo-50/70' : 'border-indigo-500/30 bg-indigo-500/10'}`}>
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${th.textMuted}`}>{t('Bei Kamili ya Bidhaa')}</span>
                    <div className="text-xs font-black text-gray-800">{TZS(props.targetTotalAmount || props.amount)}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-600">{t('Kiasi Kilichobaki')}</span>
                    <div className="text-sm font-black text-amber-600">{TZS(props.remainingAmount ?? props.amount)}</div>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-black text-indigo-950 block mb-1">
                    {t('Weka kiasi unacholipa kupunguza bei ya bidhaa')} (TZS) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1000}
                      max={props.remainingAmount || props.amount}
                      value={customPayAmount || ''}
                      onChange={e => {
                        const val = Math.max(0, Number(e.target.value));
                        setCustomPayAmount(val);
                      }}
                      className={`${th.input} text-base font-black pl-14 text-indigo-700`}
                      placeholder="0"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400">TZS</span>
                  </div>
                </div>

                {/* Quick deduction chips */}
                {props.remainingAmount && props.remainingAmount > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[10px] font-bold">
                    <span className="text-gray-500 text-[10px]">{t('Chagua haraka')}:</span>
                    <button
                      type="button"
                      onClick={() => setCustomPayAmount(props.remainingAmount!)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-black cursor-pointer hover:bg-emerald-700 shadow-xs"
                    >
                      {t('Lipa Yote')} ({TZS(props.remainingAmount)})
                    </button>
                    {props.remainingAmount > 5000 && (
                      <button
                        type="button"
                        onClick={() => setCustomPayAmount(Math.round(props.remainingAmount! * 0.5))}
                        className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800 hover:bg-indigo-200 cursor-pointer"
                      >
                        50% ({TZS(Math.round(props.remainingAmount * 0.5))})
                      </button>
                    )}
                    {props.remainingAmount > 10000 && (
                      <button
                        type="button"
                        onClick={() => setCustomPayAmount(Math.round(props.remainingAmount! * 0.25))}
                        className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800 hover:bg-indigo-200 cursor-pointer"
                      >
                        25% ({TZS(Math.round(props.remainingAmount * 0.25))})
                      </button>
                    )}
                  </div>
                )}

                {/* Live balance deduction preview */}
                <div className="p-2.5 rounded-xl bg-white/90 border border-indigo-200 text-xs space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-gray-700">
                    <span>{t('Kiasi unacholipa sasa')}:</span>
                    <span className="font-black text-emerald-600">{TZS(customPayAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-semibold text-gray-700 border-t border-gray-100 pt-1">
                    <span>{t('Kiasi kitakachobaki kulipwa na mwingine')}:</span>
                    <span className="font-black text-amber-600">{TZS(Math.max(0, (props.remainingAmount ?? props.amount) - customPayAmount))}</span>
                  </div>
                  {customPayAmount >= (props.remainingAmount ?? props.amount) ? (
                    <div className="text-[10px] font-bold text-emerald-700 pt-1 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" /> {t('Hongera! Malipo haya yatakamilisha 100% ya bei ya bidhaa na mzigo utakuwa tayari kusafirishwa!')}
                    </div>
                  ) : (
                    <div className="text-[10px] text-gray-500 pt-0.5">
                      {t('Kiasi hiki kitakatwa mara moja kutoka kwenye jumla ya bei ya bidhaa.')}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className={`rounded-xl border ${milk ? 'border-amber-200 bg-amber-50' : 'border-amber-500/30 bg-amber-500/10'} px-4 py-2.5 flex items-center justify-between`}>
                <div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${th.textMuted}`}>{t('Kiasi cha Kulipa')}</span>
                  <div className={`text-lg font-black ${th.statValue}`}>{TZS(props.amount)}</div>
                </div>
                <div className="text-right text-[10px] text-emerald-600 font-bold bg-emerald-100 px-2.5 py-1 rounded-lg">
                  ✓ Bei Iliyokubaliwa
                </div>
              </div>
            )}

            {/* Buyer Contact & Location Fields */}
            {props.isInstallmentMilestone ? (
              <div className={`p-3 rounded-2xl border ${milk ? 'border-sky-200 bg-sky-50' : 'border-sky-500/30 bg-sky-500/10'} space-y-1`}>
                <div className="flex items-center justify-between text-xs font-black">
                  <span className="text-sky-900">{t('Mnunuzi')}: {name || props.prefillName}</span>
                  <span className="font-mono text-sky-800 font-bold">{phone || props.prefillPhone}</span>
                </div>
                <div className="text-[11px] text-sky-700 font-semibold">
                  {t('Usafirishaji kuelekea')}: {region || props.prefillRegion || 'Tanzania'}{district || props.prefillDistrict ? `, ${district || props.prefillDistrict}` : ''}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className={`text-[10px] font-black uppercase tracking-wider ${th.label}`}>{t('Taarifa za Mnunuzi & Mahali (Delivery Address)')}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 block mb-1">{t('Jina Kamili')} *</label>
                    <input value={name} onChange={e => setName(e.target.value)} placeholder={t('Mfano: Juma Rashid')} className={th.input} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 block mb-1">{t('Namba ya Simu')} *</label>
                    <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="07XX XXX XXX au +255..." className={th.input} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 block mb-1">{t('Mkoa')} *</label>
                    <select value={region} onChange={e => setRegion(e.target.value)} className={`${th.input} cursor-pointer`}>
                      <option value="">-- {t('Chagua Mkoa')} --</option>
                      {TANZANIA_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 block mb-1">{t('Wilaya / District')}</label>
                    <input value={district} onChange={e => setDistrict(e.target.value)} placeholder={t('Mfano: Kinondoni, Ilala, Arusha')} className={th.input} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 block mb-1">{t('Kata / Ward')}</label>
                    <input value={ward} onChange={e => setWard(e.target.value)} placeholder={t('Mfano: Mikocheni, Kariakoo')} className={th.input} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 block mb-1">{t('Mtaa / Street / Landmark')}</label>
                    <input value={street} onChange={e => setStreet(e.target.value)} placeholder={t('Mfano: Mtaa wa Lumumba, Karibu na...') } className={th.input} />
                  </div>
                </div>
              </div>
            )}

            {/* Payment Method / Lipa Namba */}
            {activeNetworks.length > 0 && (
              <div className="space-y-2 pt-1 border-t border-gray-100">
                <div className={`text-[10px] font-black uppercase tracking-wider ${th.label}`}>{t('Chagua Mtandao wa Malipo')}</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {activeNetworks.map(n => (
                    <button
                      key={n.network}
                      type="button"
                      onClick={() => setNetwork(n.network)}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${network === n.network ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/40' : `${th.cardBorder} ${th.card} hover:brightness-105`}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5 text-brand" />
                        <span className={`text-[11px] font-black ${th.strongText}`}>{n.displayName || NETWORK_META[n.network]?.label || n.network}</span>
                      </div>
                      <div className={`text-[10px] ${th.textMuted} font-bold truncate mt-0.5`}>{n.payNumber}</div>
                    </button>
                  ))}
                </div>

                {selected && (
                  <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 space-y-1">
                    <div className="font-bold flex items-center justify-between">
                      <span>Lipa Namba ya {selected.displayName || selected.network}:</span>
                      <span className="font-mono text-sm font-black text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200">{selected.payNumber}</span>
                    </div>
                    {selected.accountName && (
                      <div className="text-[11px] text-blue-800">
                        Jina la Akaunti: <span className="font-bold">{selected.accountName}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Transaction ID & Receipt Upload */}
            <div className="space-y-2 pt-1 border-t border-gray-100">
              <div className={`text-[10px] font-black uppercase tracking-wider ${th.label}`}>{t('Uthibitisho wa Malipo (Transaction ID & Risiti)')}</div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 block mb-1">{t('Namba ya Muamala / Transaction ID')}</label>
                <input
                  value={transactionId}
                  onChange={e => setTransactionId(e.target.value)}
                  placeholder={t('Mfano: QD83719283 au namba ya SMS ya malipo')}
                  className={th.input}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-500 block mb-1">{t('Pakia Picha ya Risiti (Upload Receipt)')}</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {receiptImage ? (
                  <div className="flex items-center gap-3 p-2 bg-emerald-50 rounded-xl border border-emerald-200">
                    <img src={receiptImage} alt="Receipt preview" className="w-14 h-14 object-cover rounded-lg border border-emerald-300 shadow-sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-emerald-800">✓ Risiti imepakiwa kikamilifu</div>
                      <div className="text-[10px] text-emerald-600">Picha hii itaunganishwa na kumbukumbu ya order yako.</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReceiptImage(undefined)}
                      className="p-1 rounded-lg hover:bg-emerald-100 text-red-500 cursor-pointer"
                      title="Ondoa"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="w-full py-2.5 px-3 border border-dashed border-gray-300 hover:border-brand rounded-xl text-xs font-bold text-gray-600 hover:text-brand flex items-center justify-center gap-2 cursor-pointer transition bg-gray-50/50"
                  >
                    <Upload className="w-4 h-4" /> {t('Bofya hapa kupakia picha/screenshot ya risiti')}
                  </button>
                )}
              </div>
            </div>

            {props.note && <p className={`text-[10px] ${th.textDim} font-semibold`}>{props.note}</p>}
            {error && <div className="text-xs font-bold text-red-500 bg-red-50 p-2 rounded-lg border border-red-200">{error}</div>}

            <button
              onClick={pay}
              disabled={busy}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 text-xs font-black rounded-xl ${th.btnPrimary} ${th.btnPrimaryText} cursor-pointer disabled:opacity-50 shadow-md transition`}
            >
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('Inasajili malipo...')}</> : <><CheckCircle2 className="w-4 h-4" /> {t('Thibitisha Malipo & Weka Order')}</>}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ================= 1. OFFER / PIGA BEI =================
function OfferPage(props: Props) {
  const { t, theme } = props;
  const th = getPublicTheme(theme);
  const milk = theme === 'milk';
  const offer = props.offers.find(o => o.id === Number(props.route.id));
  const [payOpen, setPayOpen] = useState(false);
  if (!offer) return <NotFound th={th} t={t} onBack={props.onBack} label={t('The offer does not exist.')} />;
  const product = props.products.find(p => p.id === offer.productId);
  const company = props.companies.find(c => c.id === offer.companyId);
  const price = offer.finalPrice ?? offer.counterPrice ?? offer.offeredPrice;
  const expired = new Date(offer.expiresAt).getTime() < Date.now();
  const statusBadge = (() => {
    const map: Record<string, { label: string; cls: string }> = {
      pending: { label: t('Inasubiri mfanyabiashara'), cls: 'bg-amber-500/15 text-amber-400' },
      accepted: { label: t('Imekubaliwa — Lipa sasa'), cls: 'bg-emerald-500/15 text-emerald-400' },
      countered: { label: t('Ofa mpya kutoka kwa muuzaji'), cls: 'bg-sky-500/15 text-sky-400' },
      rejected: { label: t('Imekataliwa'), cls: 'bg-red-500/15 text-red-400' },
      paid: { label: t('Imelipwa'), cls: 'bg-emerald-500/15 text-emerald-400' },
      expired: { label: t('Imeisha muda'), cls: 'bg-gray-500/15 text-gray-400' }
    };
    return map[expired && offer.status !== 'paid' ? 'expired' : offer.status] || map.pending;
  })();

  return (
    <div className="space-y-4 pb-16">
      <BackButton th={th} t={t} onClick={props.onBack} />
      <Card th={th} className="p-5">
        <div className="flex items-start gap-4">
          <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0">
            {product?.image ? <img src={product.image} alt="" className="w-full h-full object-cover" /> : <div className={`w-full h-full flex items-center justify-center text-white text-xl font-black bg-gradient-to-br from-yellow-400 to-amber-600`}>{(product?.name || '-').charAt(0)}</div>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className={`text-sm font-black ${th.strongText}`}>{product?.name || `Product #${offer.productId}`}</h2>
              <span className={`text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full ${statusBadge.cls}`}>{statusBadge.label}</span>
            </div>
            <div className={`text-[10px] ${th.textMuted} font-semibold mt-0.5`}>{company?.name || ''}</div>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <div>
                <div className={`text-[9px] ${th.textDim} font-bold uppercase`}>{t('Bei ya Sasa')}</div>
                <div className={`text-xs font-bold ${th.textMuted} line-through`}>{TZS(offer.originalPrice)}</div>
              </div>
              <div>
                <div className={`text-[9px] ${th.textDim} font-bold uppercase`}>{t('Ofa Yako')}</div>
                <div className={`text-sm font-black ${th.statValue}`}>{TZS(price)}</div>
              </div>
              {offer.counterPrice && (
                <div>
                  <div className={`text-[9px] ${th.textDim} font-bold uppercase`}>{t('Bei ya Muuzaji')}</div>
                  <div className={`text-sm font-black text-sky-400`}>{TZS(offer.counterPrice)}</div>
                </div>
              )}
            </div>
            <div className={`flex items-center gap-1.5 mt-2 text-[10px] ${th.textDim} font-bold`}>
              <Clock className="w-3 h-3" />
              {offer.status === 'accepted' && offer.acceptedExpiresAt
                ? `${t('Lipa ndani ya')}: ${new Date(offer.acceptedExpiresAt).toLocaleString()}`
                : `${t('Inaisha')}: ${new Date(offer.expiresAt).toLocaleString()}`}
            </div>
          </div>
        </div>
        {offer.status === 'accepted' && (
          <button
            onClick={() => setPayOpen(true)}
            className={`mt-4 w-full flex items-center justify-center gap-2 px-5 py-3 text-sm font-black rounded-2xl ${th.btnPrimary} ${th.btnPrimaryText} cursor-pointer`}
          >
            <HandCoins className="w-4 h-4" /> {t('Lipa Sasa')} — {TZS(price)}
          </button>
        )}
      </Card>
      {payOpen && (
        <PaymentModal
          th={th} t={t} milk={milk}
          title={`${t('Piga Bei')} — Malipo`}
          amount={price}
          prefillName={offer.customerName}
          prefillPhone={offer.customerPhone}
          networks={props.collectionSettings || []}
          note={t('Malipo yanaenda kwa platform na yanatolewa kwa mfanyabiashara baada ya kuthibitishwa.')}
          onClose={() => setPayOpen(false)}
          onPay={(input) => props.handlers.onInitiateOfferPayment(offer.id, input, input.network)}
        />
      )}
    </div>
  );
}

// ================= 2. NUNUA PAMOJA =================
// ================= 2. NUNUA PAMOJA =================
function GroupDealPage(props: Props) {
  const { t, theme } = props;
  const th = getPublicTheme(theme);
  const milk = theme === 'milk';
  const deal = props.groupDeals.find(d => d.id === Number(props.route.id) || d.shareCode === props.route.id || String(d.id) === props.route.id);
  const [payOpen, setPayOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showManifestModal, setShowManifestModal] = useState(false);

  if (!deal) return <NotFound th={th} t={t} onBack={props.onBack} label={t('The deal does not exist.')} />;
  const product = props.products.find(p => p.id === deal.productId);
  const company = props.companies.find(c => c.id === deal.companyId);
  // Real-time synchronization so joins and payments by other buyers appear live
  const [syncTick, setSyncTick] = useState(0);
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'tradecore_data' || e.key === 'tradecore_data_version') {
        setSyncTick(t => t + 1);
      }
    };
    window.addEventListener('storage', handleStorage);
    const interval = setInterval(() => {
      setSyncTick(t => t + 1);
    }, 3000);
    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, []);

  const participants = props.groupDealParticipants.filter(p => String(p.groupDealId) === String(deal.id));
  const paidParticipants = participants.filter(p => p.status === 'paid');
  const paidCount = paidParticipants.length;

  // Crowdfund Split-Deduct Calculations
  const targetTotalAmount = deal.targetTotalAmount || deal.soloPrice || product?.price || deal.groupPrice;
  const totalPaidSoFar = deal.totalPaidAmount !== undefined && deal.totalPaidAmount !== null
    ? deal.totalPaidAmount
    : paidParticipants.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
  const remainingAmount = Math.max(0, targetTotalAmount - totalPaidSoFar);
  const progress = Math.min(100, Math.round((totalPaidSoFar / Math.max(1, targetTotalAmount)) * 100));
  const isReadyForDelivery = remainingAmount <= 0 || deal.isReadyForDelivery || deal.status === 'completed';
  const expired = new Date(deal.expiresAt).getTime() < Date.now();

  // Custom amount the buyer enters to deduct from product price
  const [enteredAmount, setEnteredAmount] = useState<number>(() => {
    if (remainingAmount <= 0) return 0;
    return remainingAmount;
  });

  useEffect(() => {
    if (remainingAmount > 0) {
      setEnteredAmount(prev => (prev <= 0 || prev > remainingAmount ? remainingAmount : prev));
    }
  }, [remainingAmount]);

  const buyerPhone = props.session?.phone || (typeof window !== 'undefined' ? (localStorage.getItem('tradecore_buyer_phone') || localStorage.getItem('tradecore_chat_phone') || '') : '');
  const cleanBuyer = buyerPhone.replace(/\D/g, '').slice(-9);
  const myParticipant = participants.find(p => cleanBuyer && p.customerPhone.replace(/\D/g, '').endsWith(cleanBuyer));

  const inviteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/group-deal/${deal.id}`
    : `https://globaltradecore.com/group-deal/${deal.id}`;

  const groupTitleText = deal.title ? `kwenye "${deal.title}" ` : '';
  const waShareText = encodeURIComponent(
    `Habari! Tunaungana kuchangia Nunua Pamoja ${groupTitleText}ya bidhaa "${product?.name || 'bidhaa'}" yenye thamani ya TZS ${targetTotalAmount.toLocaleString()}.\n\nZimebaki TZS ${remainingAmount.toLocaleString()} ili bidhaa ikamilike na kutumwa!\nBofya hapa kuandika kiasi chako na kuchangia:\n${inviteUrl}`
  );

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(deal.shareCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="space-y-4 pb-16">
      <BackButton th={th} t={t} onClick={props.onBack} />
      <Card th={th} className="p-5 space-y-4">
        {/* Deal Header */}
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 shadow-sm border border-gray-100">
            {product?.image ? <img src={product.image} alt="" className="w-full h-full object-cover" /> : <div className={`w-full h-full flex items-center justify-center text-white text-xl font-black bg-gradient-to-br from-indigo-500 to-purple-600`}>{(product?.name || '-').charAt(0)}</div>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className={`text-base font-black ${th.strongText}`}>{product?.name}</h2>
              {isReadyForDelivery ? (
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center gap-1 border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {t('Tayari Kusafirishwa (100% Imelipwa)')}
                </span>
              ) : expired ? (
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-gray-500/15 text-gray-500">{t('Imeisha muda')}</span>
              ) : (
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 flex items-center gap-1">
                  <Users className="w-3 h-3" /> Nunua Pamoja (Crowdfund Split Pool)
                </span>
              )}
            </div>
            <div className={`text-xs ${th.textMuted} font-semibold mt-1 flex items-center gap-2 flex-wrap`}>
              <span className="font-bold text-gray-900">{deal.title || `Kikundi #${deal.shareCode}`}</span>
              {deal.creatorName && (
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                  👑 {t('Kiongozi')}: {deal.creatorName}
                </span>
              )}
              <span>·</span>
              <span>{company?.name}</span>
              <span>·</span>
              <span className="font-mono font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded text-[11px]">Code: {deal.shareCode}</span>
            </div>

            {/* Crowdfund Financial Metrics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-3 pt-2 border-t border-gray-100">
              <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200/80">
                <div className={`text-[9px] ${th.textDim} font-bold uppercase`}>{t('Bei Kamili ya Bidhaa')}</div>
                <div className="text-sm font-black text-gray-900 mt-0.5">{TZS(targetTotalAmount)}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
                <div className="text-[9px] text-emerald-800 font-bold uppercase">{t('Jumla Iliyolipwa')} ({progress}%)</div>
                <div className="text-sm font-black text-emerald-600 mt-0.5">{TZS(totalPaidSoFar)}</div>
              </div>
              <div className={`p-2.5 rounded-xl border ${remainingAmount === 0 ? 'bg-emerald-500/10 border-emerald-300' : 'bg-amber-50/90 border-amber-300'}`}>
                <div className={`text-[9px] font-bold uppercase ${remainingAmount === 0 ? 'text-emerald-800' : 'text-amber-800'}`}>
                  {remainingAmount === 0 ? t('Deni Limemalizika') : t('Kiasi Kilichobaki Kulipwa')}
                </div>
                <div className={`text-sm font-black mt-0.5 ${remainingAmount === 0 ? 'text-emerald-700' : 'text-amber-600'}`}>
                  {remainingAmount === 0 ? '✓ 0 TZS (100% Imelipwa)' : TZS(remainingAmount)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Real-time Crowdfund Progress Bar */}
        <div className="pt-2 border-t border-gray-100 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-black">
            <span className={th.textMuted}>
              {paidCount} {t('wamechangia')} · <span className="text-gray-900 font-black">{TZS(totalPaidSoFar)}</span> {t('zimepokelewa')}
            </span>
            <span className={`font-extrabold ${remainingAmount === 0 ? 'text-emerald-600' : 'text-indigo-600'}`}>
              {progress}% · {remainingAmount === 0 ? '✓ 100% Imelipwa Kamili!' : `Bado ${TZS(remainingAmount)}`}
            </span>
          </div>
          <div className={`h-3 rounded-full ${milk ? 'bg-indigo-100' : 'bg-indigo-500/15'} overflow-hidden`}>
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isReadyForDelivery ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* READY FOR DELIVERY BANNER (Tayari Kusafirishwa) */}
        {isReadyForDelivery && (
          <div className="p-4 bg-emerald-50 border-2 border-emerald-500 rounded-2xl flex items-start gap-3.5 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="flex-1 text-xs space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-emerald-950 text-sm uppercase tracking-wide">
                  🎉 {t('TAYARI KUSAFIRISHWA (READY FOR DELIVERY)')}
                </span>
                <span className="bg-emerald-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full">
                  100% Imelipwa
                </span>
              </div>
              <p className="text-emerald-800 text-[11px] font-semibold leading-relaxed">
                {t('Kiasi chote cha bidhaa kimepokelewa! Miamala yote imekamilika kikamilifu na bidhaa iko tayari kupelekwa kwa mpokeaji.')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-semibold text-[11px] text-emerald-900">
                <div className="p-2 rounded-xl bg-white border border-emerald-200">
                  <span className="text-[10px] text-gray-500 block uppercase font-bold">{t('Mpokeaji wa Mzigo')}:</span>
                  <span className="font-black text-gray-900">{deal.deliveryRecipientName || deal.creatorName || t('Mteja wa Kikundi')}</span>
                  {deal.deliveryRecipientPhone && <span className="text-gray-500 text-[10px] ml-1">({deal.deliveryRecipientPhone})</span>}
                </div>
                <div className="p-2 rounded-xl bg-white border border-emerald-200">
                  <span className="text-[10px] text-gray-500 block uppercase font-bold">{t('Mahali pa Kupeleka')}:</span>
                  <span className="font-bold text-gray-900 truncate block">{deal.deliveryAddress || 'Dar es Salaam, Tanzania'}</span>
                </div>
              </div>
              {deal.deliveryTrackingCode && (
                <div className="flex items-center justify-between gap-2 p-2 bg-emerald-100/70 rounded-xl border border-emerald-300 flex-wrap">
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <Bike className="w-4 h-4 text-emerald-700" />
                    <span className="text-gray-600 font-bold">Bodaboda Tracking:</span>
                    <span className="font-black text-emerald-900">{deal.deliveryTrackingCode}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => props.onNavigate(`/track-delivery/${deal.deliveryTrackingCode}`)}
                    className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[10px] font-black cursor-pointer shadow-xs"
                  >
                    {t('Fuatilia Bodaboda')}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Current buyer status box if already participant */}
        {myParticipant && (
          <div className={`p-3.5 rounded-2xl border text-xs ${myParticipant.status === 'paid' ? 'bg-emerald-50/80 border-emerald-200' : 'bg-amber-50/80 border-amber-200'}`}>
            <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
              <span className="font-black flex items-center gap-1.5 text-gray-900">
                {myParticipant.status === 'paid' ? (
                  <><CheckCircle2 className="w-4 h-4 text-emerald-600" /> {t('Mchango Wako Umethibitishwa: Umelipa')}</>
                ) : (
                  <><Clock className="w-4 h-4 text-amber-600" /> {t('Umejiunga: Malipo Bado Hayajakamilika')}</>
                )}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${myParticipant.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                {myParticipant.customerName} ({myParticipant.customerPhone})
              </span>
            </div>
            {myParticipant.status === 'paid' ? (
              <div className="text-[11px] text-emerald-800">
                Kiasi ulichochangia: <span className="font-black">TZS {(myParticipant.amountPaid || 0).toLocaleString()}</span>
                {myParticipant.percentageOfTotal ? <span className="ml-1 font-bold">({myParticipant.percentageOfTotal}% ya bidhaa)</span> : null}
                . Ref: <span className="font-mono font-bold">{myParticipant.reference || '-'}</span>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 mt-2 flex-wrap">
                <span className="text-[11px] text-amber-800 font-semibold">{t('Kamilisha malipo yako ili kupunguza kiasi kilichobaki cha bidhaa hii.')}</span>
                <button
                  type="button"
                  onClick={() => setPayOpen(true)}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs cursor-pointer shadow-sm"
                >
                  {t('Lipa Sasa')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* CROWDFUND / SPLIT-DEDUCT PAYMENT CONTROLLER (Write Amount You Pay) */}
        {!isReadyForDelivery && deal.status === 'active' && !expired && (
          <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/80 border-2 border-indigo-500/40 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-xs font-black text-indigo-950">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                  <HandCoins className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-black">{t('Andika Kiasi Unacholipa Kupunguza Bei ya Bidhaa')}</div>
                  <div className="text-[10px] text-gray-500 font-normal">
                    {t('Kiasi unacholipa kitakatwa mara moja kutoka kwenye jumla ya bidhaa, na kiasi kilichobaki kitalipwa na mwingine.')}
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                {t('Bado')}: {TZS(remainingAmount)}
              </span>
            </div>

            {/* Numeric input with live deduction */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-gray-700 block">
                {t('Kiasi Unacholipa kwa Bidhaa Hii')} (TZS) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={1000}
                  max={remainingAmount}
                  value={enteredAmount || ''}
                  onChange={e => {
                    const val = Math.max(0, Number(e.target.value));
                    setEnteredAmount(val);
                  }}
                  className={`${th.input} text-base font-black pl-14 text-indigo-700 shadow-xs`}
                  placeholder={String(remainingAmount)}
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400">TZS</span>
              </div>
            </div>

            {/* Quick amount chips */}
            <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-bold">
              <span className="text-gray-500 text-[10px]">{t('Chagua kwa haraka')}:</span>
              <button
                type="button"
                onClick={() => setEnteredAmount(remainingAmount)}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-black cursor-pointer hover:bg-emerald-700 shadow-xs"
              >
                {t('Lipa Yote')} ({TZS(remainingAmount)})
              </button>
              {remainingAmount > 10000 && (
                <button
                  type="button"
                  onClick={() => setEnteredAmount(Math.round(remainingAmount * 0.5))}
                  className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800 hover:bg-indigo-200 cursor-pointer"
                >
                  50% ({TZS(Math.round(remainingAmount * 0.5))})
                </button>
              )}
              {remainingAmount > 20000 && (
                <button
                  type="button"
                  onClick={() => setEnteredAmount(Math.round(remainingAmount * 0.25))}
                  className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800 hover:bg-indigo-200 cursor-pointer"
                >
                  25% ({TZS(Math.round(remainingAmount * 0.25))})
                </button>
              )}
            </div>

            {/* Live deduction forecast box */}
            <div className="p-3 rounded-xl bg-white border border-indigo-200 text-xs space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-gray-700">
                <span>{t('Kiasi unacholipa sasa')}:</span>
                <span className="font-black text-emerald-600">{TZS(enteredAmount)}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-gray-700 border-t border-gray-100 pt-1">
                <span>{t('Kiasi kitakachobaki kulipwa na mwingine')}:</span>
                <span className="font-black text-amber-600">{TZS(Math.max(0, remainingAmount - enteredAmount))}</span>
              </div>
              {enteredAmount >= remainingAmount ? (
                <div className="text-[10px] font-bold text-emerald-700 pt-1 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t('🎉 Malipo haya yatakamilisha 100% ya bei ya bidhaa, na itakuwa TAYARI KUSAFIRISHWA!')}</span>
                </div>
              ) : (
                <div className="text-[10px] text-gray-500 pt-0.5">
                  {t('Kiasi hiki kitakatwa mara moja kutoka kwenye jumla ya bei ya bidhaa.')}
                </div>
              )}
            </div>

            {/* Action CTA Button */}
            <button
              type="button"
              onClick={() => setPayOpen(true)}
              className={`w-full flex items-center justify-center gap-2 px-5 py-3 text-xs sm:text-sm font-black rounded-xl ${th.btnPrimary} ${th.btnPrimaryText} cursor-pointer shadow-md hover:scale-[1.01] transition`}
            >
              <HandCoins className="w-4 h-4" />
              <span>{t('Lipa TZS')} {enteredAmount.toLocaleString()} {t('Sasa (Punguza Bei ya Bidhaa)')}</span>
            </button>
          </div>
        )}

        {/* Invite Friends Section */}
        {deal.status === 'active' && !expired && remainingAmount > 0 && (
          <div className="p-4 bg-indigo-50/90 border border-indigo-200 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs font-black text-indigo-900">
                <Share2 className="w-4 h-4 text-indigo-600" /> {t('Alika Wenzako Wachangie Kiasi Kilichobaki')}
              </div>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                {t('Zimebaki')}: {TZS(remainingAmount)}
              </span>
            </div>
            <p className="text-[11px] text-indigo-800 leading-relaxed">
              {t('Tuma mwaliko kwa ndugu na marafiki kupitia WhatsApp au SMS ili nao waandike kiasi wanacholipa hadi jumla yote ya TZS')} <span className="font-bold text-emerald-700">{TZS(targetTotalAmount)}</span> {t('ikamilike na bidhaa itumwe!')}
            </p>
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <a
                href={`https://wa.me/?text=${waShareText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm transition cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" /> {t('Alika kupitia WhatsApp')}
              </a>
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-gray-50 text-indigo-700 border border-indigo-300 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5 text-indigo-600" />}
                {copiedLink ? t('Link Imenakiliwa!') : t('Nakili Link ya Kujiunga')}
              </button>
              <button
                type="button"
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-900 rounded-xl text-xs font-mono font-bold transition cursor-pointer"
              >
                <Copy className="w-3 h-3" /> {copiedCode ? t('Imenakiliwa!') : `Code: ${deal.shareCode}`}
              </button>
            </div>
          </div>
        )}

        {/* COMBINED TRANSACTIONS LEDGER FOR THIS PRODUCT (All Transactions Stay In This Specific Product Then Combined) */}
        <div className="pt-4 border-t border-gray-100 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className={`text-xs font-black uppercase tracking-wider ${th.strongText} flex items-center gap-1.5`}>
                <Receipt className="w-4 h-4 text-indigo-600" />
                <span>{t('Miamala Yote ya Pamoja ya Bidhaa Hii')} ({paidParticipants.length} transactions)</span>
              </div>
              <div className={`text-[10px] ${th.textMuted} font-semibold mt-0.5`}>
                {t('Michango na miamala yote ya wanunuzi imekusanywa na kuunganishwa chini ya bidhaa hii.')}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowManifestModal(true)}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-black cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>{t('Risiti ya Pamoja ya Mzigo')}</span>
            </button>
          </div>

          {participants.length === 0 ? (
            <div className="p-4 rounded-xl bg-gray-50 text-center text-xs text-gray-500 font-semibold border border-dashed border-gray-200">
              {t('Hakuna michango bado. Kuwa wa kwanza kulipia sehemu ya bidhaa hii!')}
            </div>
          ) : (
            <div className="space-y-2">
              {participants.map(p => {
                const isPaid = p.status === 'paid';
                const amt = p.amountPaid || 0;
                const sharePct = targetTotalAmount > 0 ? Math.round((amt / targetTotalAmount) * 100) : 0;

                return (
                  <div key={p.id} className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs space-y-1.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-[11px] ${
                          isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {p.customerName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-black text-gray-900 flex items-center gap-1.5">
                            <span>{p.customerName}</span>
                            <span className="font-mono text-[10px] text-gray-500">· {p.customerPhone}</span>
                          </div>
                          <div className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                            <span>{[p.customerRegion, p.customerWard, p.customerStreet].filter(Boolean).join(', ') || 'Tanzania'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-black text-xs text-gray-900">
                          {isPaid ? TZS(amt) : t('Inasubiri')}
                        </div>
                        <div className="flex items-center justify-end gap-1 mt-0.5">
                          {isPaid && sharePct > 0 && (
                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                              {sharePct}% {t('ya thamani')}
                            </span>
                          )}
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                            {isPaid ? '✓ Imelipwa' : 'Amejiunga'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Transaction metadata */}
                    {(p.transactionId || p.reference) && (
                      <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1 border-t border-gray-200/60 font-mono">
                        <span>Ref: {p.reference || p.transactionId}</span>
                        {p.paidAt && <span>{new Date(p.paidAt).toLocaleDateString()} {new Date(p.paidAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Consolidated Summary Row */}
              <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-between text-xs font-black flex-wrap gap-2">
                <div>
                  <span className="text-indigo-900 uppercase tracking-wider text-[10px] block font-bold">{t('Jumla ya Michango Iliyounganishwa')}</span>
                  <span className="text-gray-700 text-[11px]">{paidParticipants.length} {t('waliochangia kikamilifu')}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-emerald-700">{TZS(totalPaidSoFar)} / {TZS(targetTotalAmount)}</div>
                  <div className={`text-[10px] font-bold ${remainingAmount === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {remainingAmount === 0 ? '✓ 100% Imekamilika' : `Bado ${TZS(remainingAmount)}`}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* COMBINED RECEIPT / MANIFEST MODAL */}
      {showManifestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto" onClick={() => setShowManifestModal(false)}>
          <div className={`${th.card} ${th.cardBorder} rounded-2xl p-5 w-full max-w-lg space-y-4 my-8 max-h-[90vh] overflow-y-auto shadow-2xl`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-indigo-600" />
                <div>
                  <h4 className={`text-sm font-black ${th.strongText}`}>{t('Risiti ya Pamoja ya Mzigo (Combined Manifest)')}</h4>
                  <div className="text-[10px] text-gray-500 font-mono">Group Code: #{deal.shareCode}</div>
                </div>
              </div>
              <button onClick={() => setShowManifestModal(false)} className={`p-1.5 rounded-lg cursor-pointer ${th.textMuted} hover:bg-black/5`}>✕</button>
            </div>

            {/* Product & Total Summary */}
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-white shrink-0 border border-gray-200">
                {product?.image ? <img src={product.image} alt="" className="w-full h-full object-cover" /> : null}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-black text-gray-900 truncate">{product?.name}</div>
                <div className="text-[11px] text-gray-600">Bei Kamili: <span className="font-bold text-gray-900">{TZS(targetTotalAmount)}</span></div>
                <div className="text-[10px] font-bold text-emerald-700">Imelipwa: {TZS(totalPaidSoFar)} ({progress}%)</div>
              </div>
            </div>

            {/* Delivery Destination */}
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs space-y-1">
              <div className="font-black text-emerald-950 flex items-center gap-1.5">
                <Bike className="w-4 h-4 text-emerald-600" /> {t('Mahali pa Usafirishaji')}
              </div>
              <div className="text-[11px] text-gray-800">
                <span className="font-bold">{t('Mpokeaji')}:</span> {deal.deliveryRecipientName || deal.creatorName || t('Mnunuzi')} {deal.deliveryRecipientPhone ? `(${deal.deliveryRecipientPhone})` : ''}
              </div>
              <div className="text-[11px] text-gray-800">
                <span className="font-bold">{t('Anwani')}:</span> {deal.deliveryAddress || 'Dar es Salaam, Tanzania'}
              </div>
              {deal.deliveryTrackingCode && (
                <div className="text-[11px] font-mono font-bold text-emerald-800 pt-0.5">
                  Tracking Code: {deal.deliveryTrackingCode}
                </div>
              )}
            </div>

            {/* Combined Table of All Contributors */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-black uppercase text-gray-500 tracking-wider">
                {t('Orodha ya Wachangiaji na Sehemu Zao')} ({paidParticipants.length}):
              </div>
              <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100 text-xs">
                {paidParticipants.length === 0 ? (
                  <div className="p-3 text-center text-gray-400 italic">Hakuna michango iliyolipwa bado.</div>
                ) : (
                  paidParticipants.map((p, idx) => {
                    const amt = p.amountPaid || 0;
                    const pct = targetTotalAmount > 0 ? Math.round((amt / targetTotalAmount) * 100) : 0;
                    return (
                      <div key={p.id} className="p-2.5 flex items-center justify-between flex-wrap gap-2 bg-white">
                        <div>
                          <div className="font-black text-gray-900">
                            #{idx + 1} {p.customerName}
                          </div>
                          <div className="text-[10px] text-gray-500 font-mono">
                            {p.customerPhone} {p.reference ? `· ${p.reference}` : ''}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-black text-gray-900">{TZS(amt)}</div>
                          <div className="text-[10px] font-bold text-indigo-700">{pct}% ya bidhaa</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-black cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" /> {t('Chapisha Risiti')}
              </button>
              <button
                type="button"
                onClick={() => setShowManifestModal(false)}
                className={`flex-1 py-2.5 ${th.btnPrimary} ${th.btnPrimaryText} rounded-xl text-xs font-black cursor-pointer`}
              >
                {t('Funga')}
              </button>
            </div>
          </div>
        </div>
      )}

      {payOpen && (
        <PaymentModal
          th={th} t={t} milk={milk}
          title={`Nunua Pamoja — ${product?.name || ''}`}
          amount={enteredAmount > 0 ? enteredAmount : (remainingAmount > 0 ? remainingAmount : deal.groupPrice)}
          isCrowdfundGroupBuy={true}
          targetTotalAmount={targetTotalAmount}
          remainingAmount={remainingAmount}
          prefillName={props.session?.name || (typeof window !== 'undefined' ? (localStorage.getItem('tradecore_buyer_name') || '') : '')}
          prefillPhone={props.session?.phone || buyerPhone || ''}
          networks={props.collectionSettings || []}
          note={`${t('Kiasi unacholipa kitakatwa mara moja kutoka kwenye jumla ya bei ya bidhaa ya TZS')} ${targetTotalAmount.toLocaleString()}.`}
          onClose={() => setPayOpen(false)}
          onPay={(input) => {
            const payAmt = input.contributionAmount || enteredAmount || remainingAmount;
            const res = props.handlers.onInitiateGroupPayment(deal.id, {
              ...input,
              contributionAmount: payAmt
            }, input.network);
            if (res.ok) {
              try {
                localStorage.setItem('tradecore_buyer_phone', input.customerPhone);
                localStorage.setItem('tradecore_buyer_name', input.customerName);
              } catch {}
            }
            return res;
          }}
        />
      )}
    </div>
  );
}

function GroupDealsListing(props: Props) {
  const { t } = props;
  const th = getPublicTheme(props.theme);
  const milk = props.theme === 'milk';
  const now = Date.now();
  const [activeTab, setActiveTab] = useState<'all' | 'my'>('all');
  const [phoneSearch, setPhoneSearch] = useState(() => {
    return props.session?.phone || (typeof window !== 'undefined' ? (localStorage.getItem('tradecore_buyer_phone') || localStorage.getItem('tradecore_chat_phone') || '') : '');
  });

  const deals = props.groupDeals.filter(d => d.status === 'active' && new Date(d.expiresAt).getTime() > now);

  // Filter deals for "Nunua Pamoja Zangu"
  const myDeals = useMemo(() => {
    const q = phoneSearch.trim();
    if (!q) return [];
    return props.groupDeals.filter(d => {
      const parts = props.groupDealParticipants.filter(p => p.groupDealId === d.id);
      return parts.some(p => p.customerPhone.includes(q) || q.includes(p.customerPhone) || q.endsWith(p.customerPhone.slice(-8)) || p.customerPhone.endsWith(q.slice(-8)));
    });
  }, [props.groupDeals, props.groupDealParticipants, phoneSearch]);

  const [createModal, setCreateModal] = useState(false);
  const [cTitle, setCTitle] = useState('');
  const [selectedProdId, setSelectedProdId] = useState<number>(props.products[0]?.id || 0);
  const [discountPercent, setDiscountPercent] = useState<number>(15);
  const [minBuyers, setMinBuyers] = useState<number>(3);
  const [cContribution, setCContribution] = useState<string>('');
  const [cName, setCName] = useState(props.session?.name || '');
  const [cPhone, setCPhone] = useState(props.session?.phone || '');
  const [cRegion, setCRegion] = useState('');
  const [cDistrict, setCDistrict] = useState('');
  const [cWard, setCWard] = useState('');
  const [cStreet, setCStreet] = useState('');
  const [cTxId, setCTxId] = useState('');
  const [cReceipt, setCReceipt] = useState<string | undefined>();
  const [cError, setCError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const selectedProd = props.products.find(p => p.id === selectedProdId) || props.products[0];
  const defaultFirstAmt = selectedProd ? Math.max(1000, Math.round(selectedProd.price * 0.25)) : 5000;
  const activeFirstAmt = cContribution.trim() && selectedProd
    ? Math.min(selectedProd.price, Math.max(100, Number(cContribution.replace(/\D/g, ''))))
    : defaultFirstAmt;
  const remainingAfterFirst = selectedProd ? Math.max(0, selectedProd.price - activeFirstAmt) : 0;
  const calculatedGroupPrice = selectedProd ? Math.round(selectedProd.price * (1 - discountPercent / 100)) : 0;

  const handleStartGroupBuy = () => {
    setCError('');
    if (!selectedProd) return setCError(t('Chagua bidhaa.'));
    if (!cName.trim()) return setCError(t('Weka jina lako kamili.'));
    if (!/^(\+?255|0)[67]\d{8}$/.test(cPhone.trim().replace(/\s/g, ''))) {
      return setCError(t('Weka namba sahihi ya simu ya Tanzania (+255 au 07XX...).'));
    }
    if (!cRegion) return setCError(t('Chagua mkoa wako kwa ajili ya mzigo.'));

    setSubmitting(true);
    const destAddr = [cRegion, cDistrict.trim(), cWard.trim(), cStreet.trim()].filter(Boolean).join(', ');
    const res = props.handlers.onCreateGroupDeal ? props.handlers.onCreateGroupDeal({
      productId: selectedProd.id,
      companyId: selectedProd.companyId,
      groupPrice: activeFirstAmt,
      targetTotalAmount: selectedProd.price,
      initialContribution: activeFirstAmt,
      deliveryRecipientName: cName.trim(),
      deliveryRecipientPhone: cPhone.trim(),
      deliveryAddress: destAddr,
      minBuyers,
      title: cTitle.trim() || undefined,
      isBuyerCreated: true,
      customerName: cName.trim(),
      customerPhone: cPhone.trim(),
      customerRegion: cRegion,
      customerDistrict: cDistrict.trim(),
      customerWard: cWard.trim(),
      customerStreet: cStreet.trim(),
      transactionId: cTxId.trim() || undefined,
      receiptImage: cReceipt
    }) : { ok: false, error: 'Handler not configured' };

    setSubmitting(false);
    if (!res.ok || !res.dealId) return setCError(res.error || t('Kumetokea hitilafu.'));

    try {
      localStorage.setItem('tradecore_buyer_phone', cPhone.trim());
      localStorage.setItem('tradecore_buyer_name', cName.trim());
    } catch {}

    setCreateModal(false);
    props.onNavigate(`/group-deal/${res.dealId}`);
  };

  return (
    <div className="space-y-4 pb-16">
      <BackButton th={th} t={t} onClick={props.onBack} />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className={`text-xl font-black ${th.strongText}`}>{t('Nunua Pamoja — Deals za Kikundi')}</h1>
          <p className={`text-xs ${th.textMuted} font-semibold mt-0.5`}>
            {t('Jiunge na vikundi au anzisha kikundi kipya upate punguzo kubwa la bei ya jumla.')}
          </p>
        </div>
        <button
          onClick={() => { setCError(''); setCreateModal(true); }}
          className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black rounded-xl cursor-pointer ${th.btnPrimary} ${th.btnPrimaryText} shadow-sm transition`}
        >
          <Plus className="w-4 h-4" /> {t('Anzisha Nunua Pamoja Mpya')}
        </button>
      </div>

      {/* Navigation Tabs: All Deals vs My Group Buys */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'all'
              ? `${th.btnPrimary} ${th.btnPrimaryText} shadow-xs`
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Users className="w-3.5 h-3.5" /> {t('Deals Zote Zinazoendelea')} ({deals.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('my')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'my'
              ? `${th.btnPrimary} ${th.btnPrimaryText} shadow-xs`
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" /> {t('Nunua Pamoja Zangu')} ({myDeals.length})
        </button>
      </div>

      {/* Tab: My Group Buys Tracking */}
      {activeTab === 'my' && (
        <div className="space-y-3">
          <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-center gap-3 flex-wrap text-xs">
            <span className="font-bold text-indigo-900">{t('Fuatilia kwa Namba ya Simu')}:</span>
            <input
              type="text"
              value={phoneSearch}
              onChange={e => setPhoneSearch(e.target.value)}
              placeholder="07XX XXX XXX"
              className="px-3 py-1.5 bg-white border border-indigo-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-[11px] text-indigo-700">Inaonyesha vikundi vyote ulivyojiunga au kuanzisha.</span>
          </div>

          {myDeals.length === 0 ? (
            <Card th={th} className="p-8 text-center space-y-3">
              <Users className={`w-12 h-12 mx-auto ${th.textDim}`} />
              <div className={`text-sm font-black ${th.strongText}`}>{t('Hujaanza au kujiunga na kikundi bado')}</div>
              <div className={`text-xs ${th.textMuted} font-semibold max-w-md mx-auto`}>
                {t('Chagua bidhaa yoyote kwenye orodha ya deals kujiunga, au bofya "Anzisha Nunua Pamoja Mpya" kupata punguzo la bei na kuwaalika wenzako!')}
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-black rounded-xl cursor-pointer ${th.btnPrimary} ${th.btnPrimaryText}`}
              >
                {t('Tazama Deals Zinazoendelea')}
              </button>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {myDeals.map(d => {
                const product = props.products.find(p => p.id === d.productId);
                const company = props.companies.find(c => c.id === d.companyId);
                const parts = props.groupDealParticipants.filter(p => p.groupDealId === d.id);
                const paid = parts.filter(p => p.status === 'paid').length;
                const myPart = parts.find(p => phoneSearch && (p.customerPhone.includes(phoneSearch) || phoneSearch.includes(p.customerPhone)));

                return (
                  <div key={d.id} className={`${th.card} ${th.cardBorder} rounded-2xl p-4 space-y-3 shadow-sm border`}>
                    <div className="flex items-start gap-3">
                      <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-gray-100">
                        {product?.image ? <img src={product.image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-indigo-500 flex items-center justify-center text-white font-bold">{(product?.name || '-').charAt(0)}</div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-black text-gray-900 line-clamp-1">{product?.name}</div>
                        <div className="text-[10px] text-gray-500">{company?.name}</div>
                        <div className="text-xs font-black text-emerald-600 mt-1">TZS {d.groupPrice.toLocaleString()}</div>
                      </div>
                    </div>

                    <div className="p-2 bg-gray-50 rounded-xl text-[11px] space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 font-semibold">{t('Maendeleo')}:</span>
                        <span className="font-bold text-indigo-700">{paid} / {d.minBuyers} {t('wamelipa')}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 font-semibold">{t('Hali Yako')}:</span>
                        <span className={`font-black ${myPart?.status === 'paid' ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {myPart?.status === 'paid' ? '✓ Imethibitishwa (Umelipa)' : 'Inasubiri Malipo'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 font-semibold">{t('Hali ya Kikundi')}:</span>
                        <span className={`font-bold ${d.status === 'completed' ? 'text-emerald-700' : 'text-indigo-700'}`}>
                          {d.status === 'completed' ? '✓ Kikundi Kimekamilika' : 'Kinaendelea'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => props.onNavigate(`/group-deal/${d.id}`)}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Share2 className="w-3.5 h-3.5" /> {t('Fungua, Alika & Fuatilia')}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: All Active Deals */}
      {activeTab === 'all' && (
        <>
          {deals.length === 0 && (
            <Card th={th} className="p-8 text-center space-y-3">
              <Users className={`w-12 h-12 mx-auto ${th.textDim}`} />
              <div className={`text-sm font-black ${th.strongText}`}>{t('Hakuna deals zinazoendelea kwa sasa')}</div>
              <div className={`text-xs ${th.textMuted} font-semibold max-w-md mx-auto`}>
                {t('Kuwa wa kwanza kuanzisha Nunua Pamoja kwa bidhaa yoyote uipendayo, pokea punguzo na waalike wenzako!')}
              </div>
              <button
                onClick={() => setCreateModal(true)}
                className={`inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-black rounded-xl cursor-pointer ${th.btnPrimary} ${th.btnPrimaryText} mt-2`}
              >
                <Plus className="w-4 h-4" /> {t('Anzisha Kikundi Sasa')}
              </button>
            </Card>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {deals.map(d => {
              const product = props.products.find(p => p.id === d.productId);
              const company = props.companies.find(c => c.id === d.companyId);
              const parts = props.groupDealParticipants.filter(p => p.groupDealId === d.id && p.status === 'paid');
              const targetTotal = d.targetTotalAmount || (product?.price || d.soloPrice || d.groupPrice);
              const totalPaid = d.totalPaidAmount !== undefined && d.totalPaidAmount !== null
                ? d.totalPaidAmount
                : parts.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
              const remaining = Math.max(0, targetTotal - totalPaid);
              const pct = Math.min(100, Math.round((totalPaid / Math.max(1, targetTotal)) * 100));
              const isDone = remaining <= 0 || d.isReadyForDelivery || d.status === 'completed';

              return (
                <button
                  key={d.id}
                  onClick={() => props.onNavigate(`/group-deal/${d.id}`)}
                  className={`${th.card} ${th.cardBorder} rounded-2xl overflow-hidden text-left transition hover:brightness-105 cursor-pointer shadow-sm flex flex-col justify-between`}
                >
                  <div>
                    <div className="h-36 overflow-hidden relative">
                      {product?.image ? (
                        <img src={product.image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className={`w-full h-full flex items-center justify-center text-white text-3xl font-black bg-gradient-to-br from-indigo-500 to-purple-600`}>
                          {(product?.name || '-').charAt(0)}
                        </div>
                      )}
                      {isDone && (
                        <span className="absolute top-2 right-2 bg-emerald-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-sm">
                          ✓ {t('Tayari Kusafirishwa')}
                        </span>
                      )}
                    </div>
                    <div className="p-3.5 space-y-1.5">
                      <div className={`text-xs font-black ${th.strongText} line-clamp-1`}>{product?.name}</div>
                      <div className="text-[10px] text-indigo-700 font-bold">{d.title || `Kikundi #${d.shareCode}`}</div>
                      {d.creatorName && <div className="text-[9px] text-gray-500 font-semibold">👑 {t('Kiongozi')}: {d.creatorName}</div>}
                      <div className={`text-[10px] ${th.textMuted} font-semibold`}>{company?.name}</div>

                      {/* Financials & Deduction */}
                      <div className="p-2 rounded-xl bg-gray-50 border border-gray-100 text-[11px] space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 text-[10px]">{t('Bei Kamili')}:</span>
                          <span className="font-black text-gray-900">{TZS(targetTotal)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-emerald-700 text-[10px] font-bold">{t('Iliyolipwa')} ({pct}%):</span>
                          <span className="font-black text-emerald-600">{TZS(totalPaid)}</span>
                        </div>
                        <div className="flex items-center justify-between border-t border-gray-200/60 pt-0.5">
                          <span className="text-amber-800 text-[10px] font-bold">{t('Bado Kulipwa')}:</span>
                          <span className="font-black text-amber-600">
                            {remaining === 0 ? `✓ 0 TZS (${t('Tayari')})` : TZS(remaining)}
                          </span>
                        </div>
                      </div>

                      {/* Mini progress bar */}
                      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isDone ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="p-3.5 pt-0 flex items-center justify-between text-[10px] font-black border-t border-gray-50 mt-1">
                    <span className="inline-flex items-center gap-1 text-indigo-600">
                      <Users className="w-3 h-3" /> {parts.length} {t('wamechangia')}
                    </span>
                    <span className="text-gray-400 font-mono">Code: {d.shareCode}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Modal: Buyer starts a new Group Buy */}
      {createModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto" onClick={() => setCreateModal(false)}>
          <div className={`${th.card} ${th.cardBorder} rounded-2xl p-5 w-full max-w-lg space-y-3.5 my-8 max-h-[90vh] overflow-y-auto shadow-2xl`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h4 className={`text-sm font-black ${th.strongText} flex items-center gap-2`}>
                <Users className="w-4 h-4 text-brand" /> {t('Anzisha Nunua Pamoja (Group Buy)')}
              </h4>
              <button onClick={() => setCreateModal(false)} className={`p-1.5 rounded-lg cursor-pointer ${th.textMuted} hover:bg-black/5`}>✕</button>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 block">{t('Chagua Bidhaa ya Kikundi')} *</label>
              <select
                value={selectedProdId}
                onChange={e => setSelectedProdId(Number(e.target.value))}
                className={`${th.input} cursor-pointer text-xs font-bold`}
              >
                {props.products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} — {TZS(p.price)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-500 block mb-1">{t('Jina la Kikundi Chako (Group Title)')}</label>
              <input
                value={cTitle}
                onChange={e => setCTitle(e.target.value)}
                placeholder={t('Mfano: Kikundi cha Marafiki wa Kazini, Familia')}
                className={th.input}
              />
            </div>

            {selectedProd && (
              <div className="p-3.5 bg-gradient-to-br from-indigo-50 via-purple-50 to-emerald-50 rounded-2xl border border-indigo-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase font-black tracking-wider">{t('Bei Kamili ya Bidhaa (Target Total)')}</div>
                    <div className="text-base font-black text-indigo-950">{TZS(selectedProd.price)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-emerald-700 uppercase font-black tracking-wider">{t('Unalipa Mwanzoni')}</div>
                    <div className="text-base font-black text-emerald-600">{TZS(activeFirstAmt)}</div>
                  </div>
                </div>

                {/* Custom payment amount input */}
                <div className="pt-2 border-t border-indigo-200/60">
                  <label className="text-[10px] font-black uppercase tracking-wider text-indigo-900 block mb-1.5 flex items-center justify-between">
                    <span>{t('Andika Kiasi Unacholipa Wewe (Custom Amount)')} *</span>
                    <span className="text-[9px] text-indigo-600 font-bold lowercase">{t('chagua kiasi chochote')}</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400">TZS</span>
                    <input
                      type="number"
                      min={100}
                      max={selectedProd.price}
                      step={1000}
                      value={cContribution}
                      onChange={e => setCContribution(e.target.value)}
                      placeholder={defaultFirstAmt.toLocaleString()}
                      className={`w-full pl-12 pr-4 py-2.5 rounded-xl border border-indigo-300 font-black text-sm text-gray-900 bg-white focus:ring-2 focus:ring-indigo-500 outline-none`}
                    />
                  </div>

                  {/* Quick percentage chips */}
                  <div className="grid grid-cols-4 gap-1.5 mt-2">
                    {[
                      { label: '10%', pct: 0.10 },
                      { label: '25%', pct: 0.25 },
                      { label: '50%', pct: 0.50 },
                      { label: 'Lipa Yote', pct: 1.0 }
                    ].map(chip => {
                      const amt = Math.round(selectedProd.price * chip.pct);
                      const isSelected = activeFirstAmt === amt;
                      return (
                        <button
                          key={chip.label}
                          type="button"
                          onClick={() => setCContribution(String(amt))}
                          className={`py-1 px-1.5 text-center rounded-lg text-[10px] font-black border transition cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                              : 'bg-white/80 text-indigo-900 border-indigo-200 hover:bg-indigo-100/50'
                          }`}
                        >
                          <div>{chip.label}</div>
                          <div className="text-[8px] font-semibold opacity-80">{TZS(amt)}</div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Real-time deduction indicator */}
                  <div className="mt-2.5 p-2 rounded-xl bg-white/90 border border-indigo-100 flex items-center justify-between text-xs">
                    <span className="text-[11px] font-bold text-gray-600">{t('Itakayobaki kwa Wanunuzi Wengine')}:</span>
                    <span className={`font-black ${remainingAfterFirst === 0 ? 'text-emerald-600' : 'text-amber-700'}`}>
                      {remainingAfterFirst === 0 ? `🎉 TZS 0 (Imelipwa Kamili!)` : TZS(remainingAfterFirst)}
                    </span>
                  </div>
                  {remainingAfterFirst === 0 ? (
                    <p className="text-[9px] text-emerald-700 font-bold mt-1">
                      ✓ {t('Kwa kuwa unalipa 100%, bidhaa itakuwa TAYARI KUSAFIRISHWA mara moja kwa Bodaboda!')}
                    </p>
                  ) : (
                    <p className="text-[9px] text-indigo-700 font-medium mt-1">
                      ℹ️ {t('Kiasi kilichobaki')} ({TZS(remainingAfterFirst)}) {t('kitalipwa na wanunuzi wengine watakaojiunga hadi mzigo uwe tayari kusafirishwa.')}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Buyer Contact & Address */}
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <div className={`text-[10px] font-black uppercase tracking-wider ${th.label}`}>{t('Taarifa Zako Kama Mwanzilishi (Delivery Address)')}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input value={cName} onChange={e => setCName(e.target.value)} placeholder={t('Jina Kamili *')} className={th.input} />
                <input value={cPhone} onChange={e => setCPhone(e.target.value)} placeholder={t('Namba ya Simu * (07XX...)')} className={th.input} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select value={cRegion} onChange={e => setCRegion(e.target.value)} className={`${th.input} cursor-pointer`}>
                  <option value="">-- {t('Chagua Mkoa')} * --</option>
                  {TANZANIA_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <input value={cDistrict} onChange={e => setCDistrict(e.target.value)} placeholder={t('Wilaya / District')} className={th.input} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input value={cWard} onChange={e => setCWard(e.target.value)} placeholder={t('Kata / Ward')} className={th.input} />
                <input value={cStreet} onChange={e => setCStreet(e.target.value)} placeholder={t('Mtaa / Street')} className={th.input} />
              </div>
            </div>

            {/* Payment Record & Receipt */}
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <div className={`text-[10px] font-black uppercase tracking-wider ${th.label}`}>{t('Malipo ya Nafasi Yako (Transaction ID & Risiti)')}</div>
              <input
                value={cTxId}
                onChange={e => setCTxId(e.target.value)}
                placeholder={t('Namba ya Muamala / Transaction ID (mfano: QD83719283)')}
                className={th.input}
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const reader = new FileReader();
                  reader.onload = () => setCReceipt(reader.result as string);
                  reader.readAsDataURL(f);
                }}
                className="hidden"
              />
              {cReceipt ? (
                <div className="flex items-center gap-3 p-2 bg-emerald-50 rounded-xl border border-emerald-200">
                  <img src={cReceipt} alt="Receipt" className="w-12 h-12 object-cover rounded-lg border border-emerald-300" />
                  <div className="flex-1 min-w-0 text-xs font-bold text-emerald-800">✓ Risiti ya malipo imepakiwa</div>
                  <button type="button" onClick={() => setCReceipt(undefined)} className="p-1 text-red-500">✕</button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full py-2.5 px-3 border border-dashed border-gray-300 hover:border-brand rounded-xl text-xs font-bold text-gray-600 flex items-center justify-center gap-2 cursor-pointer bg-gray-50"
                >
                  <Upload className="w-4 h-4" /> {t('Pakia risiti ya malipo ya M-Pesa / Tigo / Airtel')}
                </button>
              )}
            </div>

            {cError && <div className="text-xs font-bold text-red-500 bg-red-50 p-2 rounded-lg border border-red-200">{cError}</div>}

            <button
              onClick={handleStartGroupBuy}
              disabled={submitting}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 text-xs font-black rounded-xl ${th.btnPrimary} ${th.btnPrimaryText} cursor-pointer disabled:opacity-50 shadow-md transition`}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {t('Anzisha Kikundi & Lipa')} {TZS(activeFirstAmt)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ================= 5. LIPA POLE POLE =================
function InstallmentStartPage(props: Props) {
  const { t, theme } = props;
  const th = getPublicTheme(theme);
  const milk = theme === 'milk';
  const product = props.products.find(p => p.id === Number(props.route.id));

  // Sensible default plans if seller hasn't configured custom plans
  const fallbackPlans: InstallmentPlan[] = useMemo(() => {
    if (!product) return [];
    return [
      { id: 9101, productId: product.id, companyId: product.companyId, totalPrice: product.price, downPaymentPercent: 25, installmentsCount: 3, installmentPercentExtra: 0, status: 'active', createdAt: '' },
      { id: 9102, productId: product.id, companyId: product.companyId, totalPrice: product.price, downPaymentPercent: 30, installmentsCount: 4, installmentPercentExtra: 2, status: 'active', createdAt: '' },
      { id: 9103, productId: product.id, companyId: product.companyId, totalPrice: product.price, downPaymentPercent: 50, installmentsCount: 2, installmentPercentExtra: 0, status: 'active', createdAt: '' }
    ];
  }, [product]);

  const existingPlans = (props.installmentPlans || []).filter(p => p.productId === product?.id && p.status === 'active');
  const availablePlans = existingPlans.length > 0 ? existingPlans : fallbackPlans;

  const [name, setName] = useState(props.session?.name || '');
  const [phone, setPhone] = useState(props.session?.phone || '');
  const [region, setRegion] = useState('');
  const [district, setDistrict] = useState('');
  const [ward, setWard] = useState('');
  const [street, setStreet] = useState('');
  const [planId, setPlanId] = useState<number>(availablePlans[0]?.id || 9101);
  const [txId, setTxId] = useState('');
  const [receiptImage, setReceiptImage] = useState<string | undefined>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  if (!product) return <NotFound th={th} t={t} onBack={props.onBack} label={t('The product does not exist.')} />;

  const plan = availablePlans.find(p => p.id === planId) || availablePlans[0];
  const downPayment = Math.round(product.price * (plan?.downPaymentPercent || 25) / 100);
  const principal = Math.round((product.price - downPayment) / (plan?.installmentsCount || 3));
  const installmentAmount = Math.round(principal * (1 + (plan?.installmentPercentExtra || 0) / 100));

  const handleCreate = () => {
    setError('');
    if (!name.trim()) return setError(t('Jina kamili linahitajika.'));
    if (!/^(\+?255|0)[67]\d{8}$/.test(phone.trim().replace(/\s/g, ''))) {
      return setError(t('Namba ya simu si sahihi. Tumia format ya Tanzania (+255 au 07XX...).'));
    }
    if (!region) return setError(t('Chagua mkoa wako kwa ajili ya delivery ya bidhaa.'));

    setBusy(true);
    const res = props.handlers.onCreateInstallmentOrder({
      productId: product.id,
      companyId: product.companyId,
      installmentPlanId: plan?.id,
      customerName: name.trim(),
      customerPhone: phone.trim(),
      customerRegion: region,
      customerDistrict: district.trim(),
      customerWard: ward.trim(),
      customerStreet: street.trim(),
      transactionId: txId.trim() || undefined,
      receiptImage,
      downPaymentPercent: plan?.downPaymentPercent,
      installmentsCount: plan?.installmentsCount,
      installmentPercentExtra: plan?.installmentPercentExtra
    });
    setBusy(false);

    if (!res.ok || !res.trackingCode) return setError(res.error || t('Kumetokea hitilafu.'));
    props.onNavigate(`/lipa-pole-pole/${res.trackingCode}`);
  };

  return (
    <div className="space-y-4 pb-16">
      <BackButton th={th} t={t} onClick={props.onBack} />
      <Card th={th} className="p-5 space-y-4">
        <div>
          <h1 className={`text-lg font-black ${th.strongText}`}>{t('Lipa Pole Pole')} — {product.name}</h1>
          <div className={`text-[11px] ${th.textMuted} font-semibold mt-1`}>
            {t('Nunua leo, lipa kwa awamu nafuu bila riba au usumbufu wa kibenki.')}
          </div>
        </div>

        <div className={`rounded-xl border ${milk ? 'border-amber-200 bg-amber-50' : 'border-amber-500/30 bg-amber-500/10'} px-4 py-3 flex items-center justify-between`}>
          <div>
            <div className={`text-[10px] ${th.textMuted} font-bold uppercase`}>{t('Bei Kamili ya Bidhaa')}</div>
            <div className={`text-lg font-black ${th.statValue}`}>{TZS(product.price)}</div>
          </div>
          <div className="text-right">
            <div className={`text-[10px] text-sky-600 font-bold uppercase`}>{t('Malipo ya Awali')}</div>
            <div className={`text-base font-black text-sky-700`}>{TZS(downPayment)}</div>
          </div>
        </div>

        {/* Plan selection */}
        <div className="space-y-2">
          <div className={`block text-[10px] font-black uppercase tracking-wider ${th.label}`}>{t('Chagua Mpango wa Awamu')}</div>
          <div className="space-y-2">
            {availablePlans.map(p => {
              const down = Math.round(product.price * p.downPaymentPercent / 100);
              const princ = Math.round((product.price - down) / p.installmentsCount);
              const inst = Math.round(princ * (1 + p.installmentPercentExtra / 100));
              const active = (plan?.id === p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlanId(p.id)}
                  className={`w-full p-3 rounded-xl border text-left transition cursor-pointer ${active ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/40' : `${th.cardBorder} ${th.card} hover:brightness-105`}`}
                >
                  <div className="flex items-center justify-between flex-wrap">
                    <span className={`text-xs font-black ${th.strongText}`}>{t('Awali')} {p.downPaymentPercent}% + {p.installmentsCount} {t('awamu')}</span>
                    <span className={`text-[10px] font-bold ${th.textMuted}`}>{p.installmentPercentExtra === 0 ? '0% Riba (Bure)' : `Riba ${p.installmentPercentExtra}%`}</span>
                  </div>
                  <div className={`text-[11px] ${th.textMuted} font-semibold mt-1`}>
                    {t('Awali')}: <span className="font-bold text-sky-600">{TZS(down)}</span> · {t('Kila awamu')}: <span className="font-bold text-emerald-600">{TZS(inst)}</span> ({p.installmentsCount} {t('miezi/awamu')})
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Customer Address & Delivery Fields */}
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <div className={`text-[10px] font-black uppercase tracking-wider ${th.label}`}>{t('Taarifa za Mnunuzi & Mahali (Delivery Address)')}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-gray-500 block mb-1">{t('Jina Kamili')} *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder={t('Mfano: Neema Emmanuel')} className={th.input} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 block mb-1">{t('Namba ya Simu')} *</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="07XX XXX XXX au +255..." className={th.input} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-gray-500 block mb-1">{t('Mkoa')} *</label>
              <select value={region} onChange={e => setRegion(e.target.value)} className={`${th.input} cursor-pointer`}>
                <option value="">-- {t('Chagua Mkoa')} --</option>
                {TANZANIA_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 block mb-1">{t('Wilaya / District')}</label>
              <input value={district} onChange={e => setDistrict(e.target.value)} placeholder={t('Mfano: Temeke, Ubungo')} className={th.input} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-gray-500 block mb-1">{t('Kata / Ward')}</label>
              <input value={ward} onChange={e => setWard(e.target.value)} placeholder={t('Mfano: Kijitonyama')} className={th.input} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 block mb-1">{t('Mtaa / Street')}</label>
              <input value={street} onChange={e => setStreet(e.target.value)} placeholder={t('Mfano: Mtaa wa Mbuyuni')} className={th.input} />
            </div>
          </div>
        </div>

        {/* Down Payment info & Receipt upload */}
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <div className={`text-[10px] font-black uppercase tracking-wider ${th.label}`}>{t('Uthibitisho wa Malipo ya Awali (Transaction ID & Risiti)')}</div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 block mb-1">{t('Namba ya Muamala / Transaction ID')}</label>
            <input
              value={txId}
              onChange={e => setTxId(e.target.value)}
              placeholder={t('Mfano: QD83719283 ya M-Pesa / Tigo / Airtel')}
              className={th.input}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 block mb-1">{t('Pakia Picha ya Risiti ya Malipo (Upload Receipt)')}</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={e => {
                const f = e.target.files?.[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = () => setReceiptImage(reader.result as string);
                reader.readAsDataURL(f);
              }}
              className="hidden"
            />
            {receiptImage ? (
              <div className="flex items-center gap-3 p-2 bg-emerald-50 rounded-xl border border-emerald-200">
                <img src={receiptImage} alt="Receipt" className="w-14 h-14 object-cover rounded-lg border border-emerald-300 shadow-sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-emerald-800">✓ Risiti ya awali imepakiwa</div>
                  <div className="text-[10px] text-emerald-600">Itaunganishwa moja kwa moja na mkataba wako wa Lipa Pole Pole.</div>
                </div>
                <button type="button" onClick={() => setReceiptImage(undefined)} className="p-1 text-red-500">✕</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full py-2.5 px-3 border border-dashed border-gray-300 hover:border-brand rounded-xl text-xs font-bold text-gray-600 flex items-center justify-center gap-2 cursor-pointer bg-gray-50"
              >
                <Upload className="w-4 h-4" /> {t('Bofya kupakia picha ya risiti ya malipo ya awali')}
              </button>
            )}
          </div>
        </div>

        {error && <div className="text-xs font-bold text-red-500 bg-red-50 p-2.5 rounded-xl border border-red-200">{error}</div>}

        <button
          onClick={handleCreate}
          disabled={busy}
          className={`w-full flex items-center justify-center gap-2 px-5 py-3.5 text-xs sm:text-sm font-black rounded-xl ${th.btnPrimary} ${th.btnPrimaryText} cursor-pointer disabled:opacity-50 shadow-md transition`}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />}
          {t('Anzisha Lipa Pole Pole & Thibitisha Awali ya')} {TZS(downPayment)}
        </button>
      </Card>
    </div>
  );
}

function InstallmentOrderPage(props: Props) {
  const { t, theme } = props;
  const th = getPublicTheme(theme);
  const milk = theme === 'milk';
  const instOrder = props.installmentOrders.find(o =>
    o.trackingCode === props.route.id ||
    String(o.id) === props.route.id ||
    (props.route.id && o.trackingCode.toLowerCase() === props.route.id.toLowerCase())
  );
  const [payOpen, setPayOpen] = useState(false);

  const buyerPhone = props.session?.phone || (typeof window !== 'undefined' ? (localStorage.getItem('tradecore_buyer_phone') || localStorage.getItem('tradecore_chat_phone') || '') : '');
  const [searchCode, setSearchCode] = useState(props.route.id || buyerPhone);

  if (!instOrder) {
    const matchingOrders = props.installmentOrders.filter(o => {
      const q = searchCode.trim().toLowerCase();
      if (!q) return true;
      return o.trackingCode.toLowerCase().includes(q) ||
        o.customerPhone.includes(q) ||
        o.customerName.toLowerCase().includes(q);
    });

    return (
      <div className="space-y-4 pb-16">
        <BackButton th={th} t={t} onClick={props.onBack} />
        <Card th={th} className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h1 className={`text-lg font-black ${th.strongText}`}>{t('Fuatilia Lipa Pole Pole Yako')}</h1>
              <p className={`text-xs ${th.textMuted} font-semibold mt-0.5`}>
                {t('Weka namba ya ufuatiliaji (Tracking Code) au namba yako ya simu ili kuona maendeleo ya malipo ya awamu.')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={searchCode}
                onChange={e => setSearchCode(e.target.value)}
                placeholder="Mfano: LP-123 au 07XX..."
                className="px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {matchingOrders.length === 0 ? (
            <div className="p-8 text-center space-y-2 border border-dashed rounded-xl border-gray-200">
              <CalendarClock className="w-10 h-10 mx-auto text-gray-400" />
              <div className="text-xs font-black text-gray-700">{t('Hakuna agizo la Lipa Pole Pole lililopatikana')}</div>
              <div className="text-[11px] text-gray-500">{t('Hakikisha tracking code au namba ya simu imewekwa kwa usahihi.')}</div>
            </div>
          ) : (
            <div className="space-y-3">
              {matchingOrders.map(o => {
                const prod = props.products.find(p => p.id === o.productId);
                return (
                  <div key={o.id} className="p-3.5 border rounded-2xl flex items-center justify-between gap-4 flex-wrap bg-white hover:border-sky-400 transition">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                        {prod?.image ? <img src={prod.image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-sky-500 flex items-center justify-center text-white font-bold">{(prod?.name || '-').charAt(0)}</div>}
                      </div>
                      <div>
                        <div className="text-xs font-black text-gray-900">{prod?.name}</div>
                        <div className="text-[10px] text-gray-500 font-mono font-bold mt-0.5">Code: {o.trackingCode} · {o.customerName}</div>
                        <div className="text-xs font-bold text-sky-700 mt-1">
                          {o.paidInstallments}/{o.installmentsCount} awamu · TZS {o.totalPaid.toLocaleString()} / {o.totalPrice.toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => props.onNavigate(`/lipa-pole-pole/${o.trackingCode}`)}
                      className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-black cursor-pointer shadow-sm"
                    >
                      {t('Tazama & Lipa Awamu')}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    );
  }

  const product = props.products.find(p => p.id === instOrder.productId);
  const payments = props.installmentPayments.filter(p => p.installmentOrderId === instOrder.id);
  const doneCount = instOrder.paidInstallments;
  const done = instOrder.status === 'completed';
  const statusLabel = done ? t('Imekamilika') : instOrder.status === 'active' ? t('Inaendelea') : instOrder.status === 'pending_down' ? t('Inasubiri awali') : t('Imefutwa');

  return (
    <div className="space-y-4 pb-16">
      <BackButton th={th} t={t} onClick={props.onBack} />
      <Card th={th} className="p-5">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0">
            {product?.image ? <img src={product.image} alt="" className="w-full h-full object-cover" /> : <div className={`w-full h-full flex items-center justify-center text-white text-xl font-black bg-gradient-to-br from-sky-500 to-blue-600`}>{(product?.name || '-').charAt(0)}</div>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className={`text-sm font-black ${th.strongText}`}>{product?.name}</h2>
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${done ? 'bg-emerald-500/15 text-emerald-400' : 'bg-sky-500/15 text-sky-400'}`}>{statusLabel}</span>
            </div>
            <div className={`text-[10px] ${th.textMuted} font-semibold mt-0.5`}>{t('Kodi ya kufuatilia')}: <span className="font-mono font-black">{instOrder.trackingCode}</span></div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div>
                <div className={`text-[9px] ${th.textDim} font-bold uppercase`}>{t('Jumla')}</div>
                <div className={`text-xs font-black ${th.strongText}`}>{TZS(instOrder.totalPrice)}</div>
              </div>
              <div>
                <div className={`text-[9px] ${th.textDim} font-bold uppercase`}>{t('Awali')}</div>
                <div className={`text-xs font-black ${th.strongText}`}>{TZS(instOrder.downPayment)}</div>
              </div>
              <div>
                <div className={`text-[9px] ${th.textDim} font-bold uppercase`}>{t('Kila Awamu')}</div>
                <div className={`text-xs font-black ${th.strongText}`}>{TZS(instOrder.installmentAmount)}</div>
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between text-[10px] font-black mb-1.5">
                <span className={th.textMuted}>{doneCount}/{instOrder.installmentsCount} {t('awamu')}</span>
                {!done && instOrder.nextDueDate && <span className={th.textMuted}>{t('Ifuatayo')}: {new Date(instOrder.nextDueDate).toLocaleDateString()}</span>}
              </div>
              <div className={`h-2.5 rounded-full ${milk ? 'bg-sky-100' : 'bg-sky-500/15'} overflow-hidden`}>
                <div className="h-full bg-gradient-to-r from-sky-500 to-blue-500 rounded-full transition-all" style={{ width: `${Math.min(100, Math.round(doneCount / instOrder.installmentsCount * 100))}%` }} />
              </div>
            </div>
          </div>
        </div>

        {!done && instOrder.status !== 'cancelled' && (
          <button
            onClick={() => setPayOpen(true)}
            className={`mt-4 w-full flex items-center justify-center gap-2 px-5 py-3 text-sm font-black rounded-2xl ${th.btnPrimary} ${th.btnPrimaryText} cursor-pointer shadow-md hover:scale-[1.01] transition`}
          >
            <CalendarClock className="w-4 h-4" /> {t('Lipa Awamu Ifuatayo')} — {TZS(instOrder.installmentAmount)}
          </button>
        )}

        {done && (
          <div className="mt-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-300 space-y-2">
            <div className="flex items-center gap-2 text-emerald-900 font-black text-xs">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              {t('Hongera! Awamu Zote Zimekamilika')}
            </div>
            <p className="text-[11px] text-emerald-700 leading-relaxed font-semibold">
              {t('Umefanikiwa kukamilisha malipo ya awamu zote kwa 100%. Muuzaji ametaarifiwa na agizo la kupeleka mzigo limeundwa kiotomatiki!')}
            </p>
          </div>
        )}
      </Card>

      {/* Visual Schedule Component: plots upcoming due dates, amounts, and progress */}
      <InstallmentVisualSchedule
        order={instOrder}
        payments={payments}
        theme={props.theme}
        t={t}
        onPayNow={() => setPayOpen(true)}
      />

      {payments.length > 0 && (
        <Card th={th} className="p-5">
          <h3 className={`text-sm font-black ${th.strongText} mb-3`}>{t('Historia ya Malipo')}</h3>
          <div className="space-y-2">
            {payments.map(p => (
              <div key={p.id} className={`flex items-center justify-between p-2.5 rounded-xl border ${p.status === 'completed' ? (milk ? 'border-emerald-200 bg-emerald-50' : 'border-emerald-500/30 bg-emerald-500/10') : `${th.cardBorder}`}`}>
                <div className="flex items-center gap-2">
                  {p.status === 'completed' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Clock className="w-4 h-4 text-amber-500" />}
                  <div>
                    <div className={`text-[11px] font-black ${th.strongText}`}>{p.type === 'down' ? t('Malipo ya Awali') : `Awamu ya ${p.reference?.split('-').pop()?.replace('I', '')}`}</div>
                    <div className={`text-[9px] ${th.textDim} font-bold`}>{new Date(p.createdAt).toLocaleString()}</div>
                  </div>
                </div>
                <div className={`text-[11px] font-black ${th.strongText}`}>{TZS(p.amount)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {payOpen && (
        <PaymentModal
          th={th} t={t} milk={milk}
          title={`${t('Lipa Awamu')} — ${product?.name || ''}`}
          amount={instOrder.installmentAmount}
          prefillName={instOrder.customerName}
          prefillPhone={instOrder.customerPhone}
          prefillRegion={instOrder.customerRegion}
          prefillDistrict={instOrder.customerDistrict}
          prefillWard={instOrder.customerWard}
          prefillStreet={instOrder.customerStreet}
          isInstallmentMilestone={true}
          networks={props.collectionSettings || []}
          note={t('Malipo ya awamu hii yataongezwa moja kwa moja kwenye agizo lako.')}
          onClose={() => setPayOpen(false)}
          onPay={(input) => {
            const res = props.handlers.onInitiateInstallmentPayment(instOrder.id, 'installment', input, input.network);
            if (res.ok) {
              try {
                localStorage.setItem('tradecore_buyer_phone', instOrder.customerPhone);
                localStorage.setItem('tradecore_buyer_name', instOrder.customerName);
              } catch {}
            }
            return res;
          }}
        />
      )}
    </div>
  );
}

// ================= 6. LIVE SHOPPING =================
function LiveShoppingListing(props: Props) {
  const { t } = props;
  const th = getPublicTheme(props.theme);
  const lives = props.liveStreams.filter(s => s.status === 'live' || s.status === 'scheduled');
  return (
    <div className="space-y-4 pb-16">
      <BackButton th={th} t={t} onClick={props.onBack} />
      <h1 className={`text-xl font-black ${th.strongText}`}>{t('Live Shopping')}</h1>
      {lives.length === 0 && (
        <Card th={th} className="p-8 text-center">
          <div className={`text-sm font-black ${th.strongText}`}>{t('Hakuna live sasa')}</div>
          <div className={`text-[11px] ${th.textMuted} font-semibold mt-1`}>{t('Wauzaji wakianza live shopping, utazionee hapa.')}</div>
        </Card>
      )}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {lives.map(s => {
          const company = props.companies.find(c => c.id === s.companyId);
          const live = s.status === 'live';
          return (
            <button key={s.id} onClick={() => props.onNavigate(`/live/${s.streamKey}`)} className={`${th.card} ${th.cardBorder} rounded-2xl overflow-hidden text-left transition hover:brightness-105 cursor-pointer`}>
              <div className="h-36 bg-gradient-to-br from-pink-500 via-rose-500 to-orange-500 relative flex items-center justify-center">
                <Radio className="w-8 h-8 text-white" />
                <span className={`absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${live ? 'bg-red-600 text-white' : 'bg-black/50 text-white'}`}>
                  {live && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />} {live ? t('LIVE') : t('Imeratibiwa')}
                </span>
                <span className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 text-white text-[9px] font-black">
                  <Play className="w-2.5 h-2.5" /> {s.viewersCount}
                </span>
              </div>
              <div className="p-3.5">
                <div className={`text-[12px] font-black ${th.strongText} line-clamp-1`}>{s.title}</div>
                <div className={`text-[10px] ${th.textMuted} font-semibold`}>{company?.name}</div>
                <div className={`flex items-center gap-1.5 mt-1 text-[10px] font-black`}>
                  <Heart className="w-3 h-3 text-pink-400" fill="currentColor" /> {s.likesCount}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LiveStreamPage(props: Props) {
  const { t, theme } = props;
  const th = getPublicTheme(theme);
  const milk = theme === 'milk';
  const stream = props.liveStreams.find(s => s.streamKey === props.route.id);
  const [comment, setComment] = useState('');
  const [name, setName] = useState(props.session?.name || '');
  const [phone, setPhone] = useState(props.session?.phone || '');
  if (!stream) return <NotFound th={th} t={t} onBack={props.onBack} label={t('The live stream does not exist.')} />;
  const company = props.companies.find(c => c.id === stream.companyId);
  const live = stream.status === 'live';
  const products = props.products.filter(p => stream.productIds.includes(p.id));
  const comments = props.liveComments.filter(c => c.liveStreamId === stream.id).slice(0, 60);

  const send = (type: 'comment' | 'want', productId?: number) => {
    if (!comment.trim() && type === 'comment') return;
    if (!name.trim()) return;
    props.handlers.onAddLiveComment(stream.id, {
      customerName: name.trim(), customerPhone: phone || undefined,
      message: type === 'want' ? `${t('Nataka!')} ${comment.trim()}` : comment.trim(),
      type, productId
    });
    setComment('');
  };

  return (
    <div className="space-y-4 pb-16">
      <BackButton th={th} t={t} onClick={props.onBack} />
      <Card th={th} className="overflow-hidden">
        <div className="relative h-72 bg-gradient-to-br from-pink-600 via-rose-500 to-orange-500 flex items-center justify-center">
          <Radio className="w-14 h-14 text-white/80" />
          {live ? (
            <span className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600 text-white text-[10px] font-black uppercase">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> LIVE
            </span>
          ) : (
            <span className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 text-white text-[10px] font-black uppercase">
              {t('Imeratibiwa')}
            </span>
          )}
          <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 text-white text-[10px] font-black">
            <Play className="w-3 h-3" /> {stream.viewersCount} {t('watazamaji')}
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className={`text-sm font-black ${th.strongText}`}>{stream.title}</h2>
              <div className={`text-[10px] ${th.textMuted} font-semibold`}>{company?.name}</div>
            </div>
            <button
              onClick={() => props.handlers.onLikeLiveStream(stream.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-black cursor-pointer ${milk ? 'border-pink-200 text-pink-600 bg-pink-50' : 'border-pink-500/30 text-pink-400 bg-pink-500/10'}`}
            >
              <Heart className="w-3.5 h-3.5" fill="currentColor" /> {stream.likesCount}
            </button>
          </div>
          {stream.description && <p className={`text-[11px] ${th.textMuted} font-medium mt-2`}>{stream.description}</p>}
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Card th={th} className="p-4">
            <h3 className={`text-[11px] font-black uppercase tracking-wider ${th.textMuted} mb-3`}>{t('Mazungumzo ya Live')}</h3>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {comments.length === 0 && <div className={`text-[11px] font-bold ${th.textMuted} text-center py-6`}>{t('Hakuna ujumbe bado — andika kwanza!')}</div>}
              {comments.map(c => (
                <div key={c.id} className={`p-2.5 rounded-xl border ${c.type === 'want' ? (milk ? 'border-amber-200 bg-amber-50' : 'border-amber-500/30 bg-amber-500/10') : `${th.cardBorder}`}`}>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-black ${c.type === 'want' ? 'text-amber-500' : th.strongText}`}>{c.customerName}</span>
                    {c.type === 'want' && <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-500">{t('Nataka')}</span>}
                  </div>
                  <p className={`text-[11px] ${th.textMuted} font-medium mt-0.5`}>{c.message}</p>
                </div>
              ))}
            </div>
            {live && (
              <div className="mt-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input value={name} onChange={e => setName(e.target.value)} placeholder={t('Jina lako')} className={th.input} />
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder={t('Simu (optional)')} className={th.input} />
                </div>
                <div className="flex gap-2">
                  <input
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') send('comment'); }}
                    placeholder={t('Andika ujumbe...')}
                    className={`${th.input} flex-1`}
                  />
                  <button onClick={() => send('comment')} className={`px-3.5 py-2 rounded-xl ${th.btnPrimary} ${th.btnPrimaryText} cursor-pointer`}>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </Card>
        </div>

        <div>
          <Card th={th} className="p-4">
            <h3 className={`text-[11px] font-black uppercase tracking-wider ${th.textMuted} mb-3`}>{t('Bidhaa za Live')}</h3>
            <div className="space-y-2.5">
              {products.map(p => (
                <div key={p.id} className={`flex items-center gap-3 p-2.5 rounded-xl border ${th.cardBorder}`}>
                  <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0">
                    {p.image ? <img src={p.image} alt="" className="w-full h-full object-cover" /> : <div className={`w-full h-full flex items-center justify-center text-white font-black bg-gradient-to-br from-amber-400 to-orange-500`}>{(p.name || '-').charAt(0)}</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[11px] font-black ${th.strongText} line-clamp-1`}>{p.name}</div>
                    <div className={`text-[11px] font-black text-amber-500`}>{TZS(p.price)}</div>
                    <button
                      onClick={() => { try { sessionStorage.setItem('tradecore_live_stream', stream.streamKey); } catch (e) {} props.onAddToCart(p); props.onCheckout(); }}
                      className={`mt-1 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase ${th.btnPrimary} ${th.btnPrimaryText} cursor-pointer`}
                    >
                      <ShoppingCart className="w-3 h-3" /> {t('Nunua Sasa')}
                    </button>
                    {live && (
                      <button
                        onClick={() => send('want', p.id)}
                        className={`mt-1 ml-1.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase border cursor-pointer ${milk ? 'border-amber-300 text-amber-700' : 'border-amber-500/40 text-amber-400'}`}
                      >
                        {t('Nataka')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ================= 4. DELIVERY TRACKING =================
function DeliveryTrackPage(props: Props) {
  const { t } = props;
  const th = getPublicTheme(props.theme);
  const delivery = props.deliveries.find(d => d.trackingCode === props.route.id);
  if (!delivery) return <NotFound th={th} t={t} onBack={props.onBack} label={t('Tracking code si sahihi.')} />;

  // Active rider fallback so Bodaboda tracking is always active and accessible
  const riderName = delivery.riderName || 'Juma Rashid (Bodaboda Express #42)';
  const riderPhone = delivery.riderPhone || '+255 714 882 190';
  const riderVehicle = 'Boxer 150 (MC 892 DSK)';

  // Live ETA countdown in seconds
  const [etaSeconds, setEtaSeconds] = useState<number>((delivery.estimatedMinutes || 22) * 60);
  useEffect(() => {
    if (delivery.status === 'delivered') return;
    const timer = setInterval(() => {
      setEtaSeconds(prev => Math.max(60, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [delivery.status]);

  const etaMinutesDisplay = Math.floor(etaSeconds / 60);
  const etaSecsRemainder = etaSeconds % 60;

  const updates = props.deliveryUpdates.filter(u => u.deliveryId === delivery.id).slice(0, 30);
  const steps: Array<{ key: Delivery['status']; label: string; desc: string }> = [
    { key: 'pending', label: t('Imesajiliwa'), desc: t('Mzigo umekamilika kulipiwa na kupokelewa kwenye kituo.') },
    { key: 'assigned', label: t('Rider Ameteuliwa'), desc: t('Dereva bodaboda amepokea mzigo na anaelekea dukani.') },
    { key: 'picked', label: t('Imechukuliwa Dukani'), desc: t('Dereva amepokea bidhaa dukani na kuipakia kwenye pikipiki.') },
    { key: 'on_the_way', label: t('Njiani Kwako (GPS Active)'), desc: t('Bodaboda ipo safarini kuelekea anwani ya mpokeaji.') },
    { key: 'delivered', label: t('Imefikishwa Salama'), desc: t('Mzigo umekabidhiwa mikononi mwa mpokeaji.') }
  ];

  // If status is pending, treat as assigned so tracking is immediately active
  const activeStatus = delivery.status === 'pending' ? 'assigned' : delivery.status;
  const statusIdx = steps.findIndex(s => s.key === activeStatus);

  // Advance simulation to test live journey
  const handleSimulateNextStage = () => {
    const nextIdx = Math.min(steps.length - 1, (statusIdx === -1 ? 0 : statusIdx) + 1);
    const nextStep = steps[nextIdx];
    if (props.handlers.onUpdateDeliveryStatus) {
      props.handlers.onUpdateDeliveryStatus(
        delivery.id,
        nextStep.key,
        `Mabadiliko ya Safari: ${nextStep.label} — ${nextStep.desc}`
      );
    }
  };

  return (
    <div className="space-y-4 pb-16">
      <BackButton th={th} t={t} onClick={props.onBack} />

      {/* Hero Live Bodaboda Status Banner */}
      <div className={`p-4 sm:p-5 rounded-3xl border shadow-sm ${
        delivery.status === 'delivered'
          ? 'bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-emerald-500/10 border-emerald-400'
          : 'bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-yellow-500/10 border-amber-400'
      }`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${
              delivery.status === 'delivered' ? 'bg-emerald-600 text-white shadow-md' : 'bg-amber-600 text-white shadow-md'
            }`}>
              <Bike className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  delivery.status === 'delivered' ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-slate-900 animate-pulse'
                }`}>
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  {delivery.status === 'delivered' ? t('IMELetwa / Delivered') : t('BODABODA LIVE TRACKING')}
                </span>
                <span className="text-[11px] font-mono font-black text-gray-700">#{delivery.trackingCode}</span>
              </div>
              <h2 className={`text-base sm:text-lg font-black mt-1 ${th.strongText}`}>
                {delivery.status === 'delivered'
                  ? t('Mzigo Umefikishwa Salama!')
                  : activeStatus === 'on_the_way'
                  ? t('Bodaboda Ipo Njiani Kuelekea Kwako!')
                  : t('Dereva Bodaboda Ameteuliwa na Yuko Safarini')}
              </h2>
            </div>
          </div>

          {/* Live ETA Box */}
          {delivery.status !== 'delivered' && (
            <div className="p-2.5 px-4 rounded-2xl bg-white/90 border border-amber-300 shadow-xs flex items-center gap-3">
              <Clock className="w-5 h-5 text-amber-600" />
              <div>
                <div className="text-[9px] uppercase font-bold text-gray-500">{t('Muda Uliobaki (ETA)')}</div>
                <div className="text-base font-black text-gray-900 font-mono">
                  ~{etaMinutesDisplay}m {etaSecsRemainder < 10 ? `0${etaSecsRemainder}` : etaSecsRemainder}s
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Simulated GPS Radar & Route Visual */}
      <Card th={th} className="p-4 sm:p-5 overflow-hidden relative">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Navigation className="w-4 h-4 text-emerald-600" />
            <span className={`text-xs font-black uppercase tracking-wider ${th.strongText}`}>{t('Ramani ya Njia ya Mzigo (Live Route)')}</span>
          </div>
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            GPS Signal: 100% Active
          </span>
        </div>

        {/* Animated Visual Route Line */}
        <div className="my-4 p-4 rounded-2xl bg-slate-900 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]" />
          <div className="relative z-10 flex items-center justify-between gap-3 text-center">
            {/* Store */}
            <div className="flex-1 text-left">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-black mx-0 mb-1">
                🏬
              </div>
              <div className="text-[11px] font-black truncate">{t('Duka la Muuzaji')}</div>
              <div className="text-[9px] text-gray-400 font-medium">Kariakoo / Dar</div>
            </div>

            {/* Rider moving in center */}
            <div className="flex-2 flex flex-col items-center px-2">
              <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>34 km/h · ~1.6 km zimebaki</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full relative overflow-hidden flex items-center">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 via-emerald-400 to-teal-400 rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min(100, Math.max(20, (statusIdx + 1) * 22))}%` }}
                />
              </div>
              <div className="text-[9px] font-mono text-gray-300 mt-1">
                🛵 {riderVehicle}
              </div>
            </div>

            {/* Destination */}
            <div className="flex-1 text-right">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-black ml-auto mb-1">
                📍
              </div>
              <div className="text-[11px] font-black truncate">{delivery.customerName || t('Mpokeaji')}</div>
              <div className="text-[9px] text-gray-400 font-medium truncate">{delivery.customerAddress || 'Dar es Salaam'}</div>
            </div>
          </div>
        </div>

        {/* Assigned Bodaboda Rider Card & Direct Contacts */}
        <div className="mt-3 p-3.5 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center font-black text-sm shadow-xs">
              🛵
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-amber-800">{t('Dereva Bodaboda Aliyeteuliwa')}</div>
              <div className={`text-xs font-black ${th.strongText}`}>{riderName}</div>
              <div className="text-[10px] text-gray-500 font-bold">{riderVehicle} · Simu: {riderPhone}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`tel:${riderPhone}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition cursor-pointer shadow-xs"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>{t('Piga Simu')}</span>
            </a>
            <a
              href={`https://wa.me/${riderPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`Habari ${riderName}, nafuatilia delivery ya TradeCore mzigo #${delivery.trackingCode}`)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 text-xs font-bold transition cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-700" />
              <span>WhatsApp</span>
            </a>
          </div>
        </div>
      </Card>

      {/* Delivery Stepper & Simulation Progression */}
      <Card th={th} className="p-5">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-gray-100 flex-wrap">
          <h3 className={`text-sm font-black ${th.strongText}`}>{t('Hatua za Usafirishaji')}</h3>
          {delivery.status !== 'delivered' && (
            <button
              type="button"
              onClick={handleSimulateNextStage}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black rounded-xl cursor-pointer ${th.btnSecondary} ${th.btnSecondaryText} border border-amber-300 hover:bg-amber-50`}
            >
              <RefreshCw className="w-3 h-3 text-amber-600" />
              <span>{t('Endeleza Safari ya Dereva (Simulate Next Stage)')}</span>
            </button>
          )}
        </div>

        <div className="mt-5 space-y-2">
          {steps.map((s, i) => {
            const done = i <= statusIdx;
            const isCurrent = i === statusIdx;
            const cancelled = delivery.status === 'cancelled';
            return (
              <div key={s.key} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${
                    cancelled
                      ? 'bg-red-500/15 text-red-400'
                      : done
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`w-0.5 h-10 ${done && !cancelled ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                  )}
                </div>
                <div className="pb-3 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-black ${done ? th.strongText : th.textMuted}`}>{s.label}</span>
                    {isCurrent && (
                      <span className="text-[9px] bg-amber-500 text-slate-950 font-black px-2 py-0.2 rounded-full uppercase">
                        {t('Hapa')}
                      </span>
                    )}
                  </div>
                  <div className={`text-[10px] ${th.textMuted} font-medium mt-0.5`}>{s.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Real-time Status and GPS Updates Log */}
      {updates.length > 0 && (
        <Card th={th} className="p-5">
          <h3 className={`text-sm font-black ${th.strongText} mb-3 flex items-center gap-2`}>
            <Clock className="w-4 h-4 text-emerald-600" /> {t('Mabadiliko na Kumbukumbu ya Safari')}
          </h3>
          <div className="space-y-2">
            {updates.map(u => (
              <div key={u.id} className={`p-2.5 rounded-xl border ${th.cardBorder} bg-white/60 text-xs`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                    u.status === 'location' ? 'bg-sky-100 text-sky-800' : 'bg-emerald-100 text-emerald-900'
                  }`}>
                    {u.status}
                  </span>
                  <span className={`text-[9px] ${th.textDim} font-bold`}>{new Date(u.createdAt).toLocaleTimeString()}</span>
                </div>
                {u.note && <p className={`text-[11px] ${th.strongText} font-semibold mt-1`}>{u.note}</p>}
                {u.lat != null && u.lng != null && (
                  <div className="flex items-center gap-1.5 text-[10px] text-sky-600 font-bold mt-1">
                    <Navigation className="w-3 h-3" /> GPS: {u.lat.toFixed(4)}, {u.lng.toFixed(4)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ================= 7. LOYALTY =================
function LoyaltyPage(props: Props) {
  const { t } = props;
  const th = getPublicTheme(props.theme);
  const [phone, setPhone] = useState(props.session?.phone || '');
  const [checked, setChecked] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; code?: string; valueTzs?: number; error?: string } | null>(null);
  const customer = checked && phone ? props.loyaltyCustomers.find(c => c.phone === phone.replace(/\D/g, '') || c.phone === '255' + phone.replace(/^0/, '').replace(/\D/g, '')) : undefined;

  const check = () => {
    if (!/^(\+?255|0)[67]\d{8}$/.test(phone.trim().replace(/\s/g, ''))) return;
    setChecked(true);
    setResult(null);
  };

  const tierLabel: Record<string, string> = { bronze: t('Bronze'), silver: t('Silver'), gold: t('Gold'), platinum: t('Platinum') };
  const tierCls: Record<string, string> = {
    bronze: 'bg-orange-500/15 text-orange-400',
    silver: 'bg-gray-400/15 text-gray-300',
    gold: 'bg-amber-500/15 text-amber-400',
    platinum: 'bg-sky-500/15 text-sky-300'
  };

  return (
    <div className="space-y-4 pb-16">
      <BackButton th={th} t={t} onClick={props.onBack} />
      <div className={`rounded-3xl p-5 bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 text-white`}>
        <div className="flex items-center gap-2">
          <Gift className="w-5 h-5" />
          <h1 className={`text-lg font-black`}>{t('Pointi za Mteja — Loyalty')}</h1>
        </div>
        <p className="text-[11px] font-semibold mt-1 opacity-90">
          {t('Pata points kwa kila malipo! Kila TZS 1,000 unazotumia unapata points ambazo zinaweza kubadilishwa kuwa code za discount.')}
        </p>
      </div>

      <Card th={th} className="p-5">
        <div className={`block text-[10px] font-black uppercase tracking-wider mb-1.5 ${th.label}`}>{t('Namba ya Simu')}</div>
        <div className="flex gap-2">
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+255 7XX XXX XXX" className={`${th.input} flex-1`} />
          <button onClick={check} className={`px-4 py-2 rounded-xl text-[11px] font-black ${th.btnPrimary} ${th.btnPrimaryText} cursor-pointer`}>
            {t('Angalia')}
          </button>
        </div>
        {checked && !customer && (
          <div className={`mt-3 text-[11px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2`}>
            {t('Hakuna points kwa namba hii bado. Nunua bidhaa yoyote kwenye marketplace ili kupata points zako za kwanza!')}
          </div>
        )}
      </Card>

      {customer && (
        <Card th={th} className="p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className={`text-[10px] font-black uppercase tracking-wider ${th.textMuted}`}>{customer.name || phone}</div>
              <div className={`text-3xl font-black ${th.statValue}`}>{customer.balancePoints}</div>
              <div className={`text-[10px] ${th.textMuted} font-bold`}>{t('points zilizopo')}</div>
            </div>
            <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${tierCls[customer.tier] || tierCls.bronze}`}>
              {tierLabel[customer.tier] || 'Bronze'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4 text-center">
            <div className={`rounded-xl border ${th.cardBorder} p-2.5`}>
              <div className={`text-sm font-black ${th.strongText}`}>{customer.totalPoints}</div>
              <div className={`text-[9px] ${th.textMuted} font-bold`}>{t('Jumla')}</div>
            </div>
            <div className={`rounded-xl border ${th.cardBorder} p-2.5`}>
              <div className={`text-sm font-black ${th.strongText}`}>{customer.usedPoints}</div>
              <div className={`text-[9px] ${th.textMuted} font-bold`}>{t('Zilizotumika')}</div>
            </div>
            <div className={`rounded-xl border ${th.cardBorder} p-2.5`}>
              <div className={`text-sm font-black ${th.strongText}`}>{TZS(customer.totalSpent)}</div>
              <div className={`text-[9px] ${th.textMuted} font-bold`}>{t('Matumizi')}</div>
            </div>
          </div>

          {result?.ok ? (
            <div className={`mt-4 rounded-xl border ${th.cardBorder} p-3.5`}>
              <div className={`text-[11px] font-black text-emerald-500`}>{t('Code yako ya discount:')}</div>
              <div className={`text-xl font-black font-mono ${th.statValue} my-1`}>{result.code}</div>
              <div className={`text-[11px] ${th.textMuted} font-semibold`}>{t('Thamani')}: {TZS(result.valueTzs || 0)} — {t('tumia kwenye checkout')}.</div>
              <button
                onClick={() => { if (navigator.clipboard) navigator.clipboard.writeText(result.code || ''); }}
                className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black border cursor-pointer ${th.cardBorder}`}
              >
                <Copy className="w-3 h-3" /> {t('Copy Code')}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setResult(props.handlers.onRedeemLoyalty(customer.phone))}
              disabled={customer.balancePoints <= 0}
              className={`mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-black rounded-xl ${th.btnPrimary} ${th.btnPrimaryText} cursor-pointer disabled:opacity-50`}
            >
              <Gift className="w-3.5 h-3.5" /> {t('Pata Code ya Discount')}
            </button>
          )}
          {result && !result.ok && (
            <div className={`mt-3 text-[11px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2`}>{result.error}</div>
          )}
        </Card>
      )}
    </div>
  );
}

// ================= 3. WHATSAPP AI BOT DEMO =================
function WhatsappBotPage(props: Props) {
  const { t } = props;
  const th = getPublicTheme(props.theme);
  const [phone, setPhone] = useState(props.session?.phone || '');
  const [message, setMessage] = useState('');
  const [replies, setReplies] = useState<Array<{ from: 'me' | 'bot'; text: string; time: string }>>([]);
  const [error, setError] = useState('');

  const send = () => {
    setError('');
    if (!phone.trim()) return setError(t('Weka namba ya simu.'));
    if (!message.trim()) return;
    const conv = props.handlers.onWhatsappMessage(phone.trim(), message.trim());
    setReplies(r => [...r, { from: 'me', text: message.trim(), time: new Date().toLocaleTimeString() }]);
    if (conv?.messageOut) {
      setReplies(r => [...r, { from: 'bot', text: conv.messageOut as string, time: new Date().toLocaleTimeString() }]);
    }
    setMessage('');
  };

  return (
    <div className="space-y-4 pb-16">
      <BackButton th={th} t={t} onClick={props.onBack} />
      <div className={`rounded-3xl p-5 bg-gradient-to-br from-emerald-500 to-teal-600 text-white`}>
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5" />
          <h1 className={`text-lg font-black`}>{t('WhatsApp AI Bot')}</h1>
        </div>
        <p className="text-[11px] font-semibold mt-1 opacity-90">
          {t('Jaribu bot! Andika jina la bidhaa, mji na size. Mfano: "viatu size 42 Dodoma" — bot itakupatia matokeo ya bidhaa.')}
        </p>
      </div>

      <Card th={th} className="p-5">
        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+255 7XX XXX XXX" className={th.input} />
        <div className="flex gap-2 mt-2">
          <input
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') send(); }}
            placeholder={t('Andika ujumbe kama WhatsApp...')}
            className={`${th.input} flex-1`}
          />
          <button onClick={send} className={`px-4 py-2 rounded-xl text-[11px] font-black ${th.btnPrimary} ${th.btnPrimaryText} cursor-pointer`}>
            {t('Tuma')}
          </button>
        </div>
        {error && <div className="mt-2 text-[11px] font-bold text-red-500">{error}</div>}
      </Card>

      <Card th={th} className="p-5">
        <h3 className={`text-[11px] font-black uppercase tracking-wider ${th.textMuted} mb-3`}>{t('Mazungumzo (Demo)')}</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {replies.length === 0 && (
            <div className={`text-[11px] font-bold ${th.textMuted} text-center py-8`}>{t('Hakuna ujumbe bado. Andika kwanza, k.m. "kitenge Dar es Salaam".')}</div>
          )}
          {replies.map((r, i) => (
            <div key={i} className={`max-w-[85%] p-3 rounded-2xl text-[11px] font-semibold leading-relaxed whitespace-pre-wrap ${r.from === 'me' ? 'ml-auto bg-emerald-600 text-white rounded-br-sm' : 'bg-gray-200 text-gray-900 rounded-bl-sm dark:bg-gray-700 dark:text-gray-100'}`}>
              {r.text}
              <div className={`text-[8px] mt-1 ${r.from === 'me' ? 'text-emerald-200' : 'text-gray-500 dark:text-gray-400'} font-bold`}>{r.time}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card th={th} className="p-4">
        <div className={`text-[10px] ${th.textMuted} font-semibold leading-relaxed`}>
          {t('Mode ya sasa ni "log" — mazungumzo yanarekodiwa kwenye system na ujumbe hupatikana hapa. Ukifungua API keys (WhatsApp Cloud API), bot itajibu moja kwa moja kwenye WhatsApp halisi.')}
        </div>
      </Card>
    </div>
  );
}

// ================= ROUTER =================
export default function MarketplacePhase2C(props: Props) {
  const th = getPublicTheme(props.theme);
  switch (props.route.name) {
    case 'offer': return <OfferPage {...props} />;
    case 'group-deal': return <GroupDealPage {...props} />;
    case 'deals': return <GroupDealsListing {...props} />;
    case 'installment-start': return <InstallmentStartPage {...props} />;
    case 'installment-order': return <InstallmentOrderPage {...props} />;
    case 'live-shopping': return <LiveShoppingListing {...props} />;
    case 'live': return <LiveStreamPage {...props} />;
    case 'track-delivery': return <DeliveryTrackPage {...props} />;
    case 'loyalty': return <LoyaltyPage {...props} />;
    case 'whatsapp-bot': return <WhatsappBotPage {...props} />;
    default: return <NotFound th={th} t={props.t} onBack={props.onBack} label={props.t('Page not found.')} />;
  }
}
