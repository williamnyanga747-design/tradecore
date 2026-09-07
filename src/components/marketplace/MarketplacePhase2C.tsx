import React, { useMemo, useState } from 'react';
import {
  ChevronLeft, HandCoins, Users, CalendarClock, Radio, Heart, MessageCircle, Send,
  MapPin, Navigation, Truck, Smartphone, CheckCircle2, Loader2, ShieldCheck, Clock,
  Gift, Star, Play, Bot, Copy, ExternalLink, ShoppingCart
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

export type FeatureT = TFunc;

export interface FeatureHandlers {
  onSubmitOffer: (input: {
    productId: number; companyId: number; customerName: string; customerPhone: string;
    originalPrice: number; offeredPrice: number;
  }) => { ok: boolean; error?: string };
  onInitiateOfferPayment: (offerId: number, address: {
    customerRegion?: string; customerDistrict?: string; customerWard?: string; customerStreet?: string;
  }, network?: CollectionNetwork) => { ok: boolean; reference?: string; error?: string };
  onJoinGroupDeal: (dealId: number, input: { customerName: string; customerPhone: string }) => {
    ok: boolean; reference?: string; error?: string; alreadyPaid?: boolean;
  };
  onInitiateGroupPayment: (dealId: number, address: {
    customerName?: string; customerPhone?: string;
    customerRegion?: string; customerDistrict?: string; customerWard?: string; customerStreet?: string;
  }, network?: CollectionNetwork) => { ok: boolean; reference?: string; error?: string };
  onCreateInstallmentOrder: (input: {
    productId: number; companyId: number; installmentPlanId: number;
    customerName: string; customerPhone: string;
  }) => { ok: boolean; trackingCode?: string; error?: string };
  onInitiateInstallmentPayment: (installmentOrderId: number, type: 'down' | 'installment', address: {
    customerRegion?: string; customerDistrict?: string; customerWard?: string; customerStreet?: string;
  }, network?: CollectionNetwork) => { ok: boolean; reference?: string; error?: string };
  onAddLiveComment: (streamId: number, input: {
    customerName: string; customerPhone?: string; message: string; type?: 'comment' | 'want'; productId?: number;
  }) => void;
  onLikeLiveStream: (streamId: number) => void;
  onRedeemLoyalty: (phone: string) => { ok: boolean; code?: string; valueTzs?: number; error?: string };
  onWhatsappMessage: (phone: string, message: string) => WhatsappConversation | null;
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

const NETWORK_META: Record<string, { label: string; color: string }> = {
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

/** Shared mini-checkout modal used by offer / group deal / installment payments. */
function PaymentModal(props: {
  th: ReturnType<typeof getPublicTheme>;
  t: FeatureT;
  milk: boolean;
  title: string;
  amount: number;
  prefillName: string;
  prefillPhone: string;
  networks: CollectionSetting[];
  note?: string;
  onClose: () => void;
  onPay: (input: {
    customerName: string; customerPhone: string;
    customerRegion: string; customerDistrict: string; customerWard: string; customerStreet: string;
    network: CollectionNetwork;
  }) => { ok: boolean; reference?: string; error?: string };
}) {
  const { th, t, milk } = props;
  const activeNetworks = props.networks.filter(n => n.isActive !== false);
  const [name, setName] = useState(props.prefillName);
  const [phone, setPhone] = useState(props.prefillPhone);
  const [region, setRegion] = useState('');
  const [district, setDistrict] = useState('');
  const [ward, setWard] = useState('');
  const [street, setStreet] = useState('');
  const [network, setNetwork] = useState<CollectionNetwork>(activeNetworks[0]?.network || 'mpesa');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ ok: boolean; reference?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const selected = activeNetworks.find(n => n.network === network);

  const pay = () => {
    setError('');
    if (!name.trim()) return setError(t('Jina linahitajika.'));
    if (!/^(\+?255|0)[67]\d{8}$/.test(phone.trim().replace(/\s/g, ''))) return setError(t('Namba ya simu si sahihi. Tumia format ya Tanzania (+255 or 0...).'));
    setBusy(true);
    const res = props.onPay({
      customerName: name.trim(), customerPhone: phone.trim(),
      customerRegion: region, customerDistrict: district, customerWard: ward, customerStreet: street,
      network
    });
    setBusy(false);
    if (!res.ok || !res.reference) return setError(res.error || t('Something went wrong.'));
    setResult({ ok: true, reference: res.reference });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => props.onClose()}>
      <div className={`${th.card} ${th.cardBorder} rounded-2xl p-5 w-full max-w-md space-y-3 max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
        {result?.ok ? (
          <div className="space-y-4 py-2 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-emerald-500" />
            </div>
            <div className={`text-sm font-black ${th.strongText}`}>{t('Order imewekwa — Malipo yanasubiri kuthibitishwa')}</div>
            <div className={`flex items-center justify-center gap-1.5 text-[11px] font-black ${th.chipText} ${th.chip} ${th.chipBorder} px-3 py-1.5 rounded-full mx-auto`}>
              <ShieldCheck className="w-3.5 h-3.5" /> {t('Payment Reference')}: <span className="font-mono">{result.reference}</span>
            </div>
            <p className={`text-[11px] ${th.textMuted} font-semibold leading-relaxed`}>
              {t('Lipa kwa')} <span className="font-black">{NETWORK_META[network]?.label || network}</span>{' '}
              <span className="font-black underline">{selected?.payNumber || '-'}</span>
              {selected?.accountName ? ` (${selected.accountName})` : ''}. {t('Team yetu itathibitisha malipo na kumsaidia muuzaji.')}
            </p>
            <button onClick={() => props.onClose()} className={`w-full px-5 py-2.5 text-[11px] font-black rounded-xl ${th.btnPrimary} ${th.btnPrimaryText} cursor-pointer`}>
              {t('Sawa')}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h4 className={`text-sm font-black ${th.strongText}`}>{props.title}</h4>
              <button onClick={() => props.onClose()} className={`p-1.5 rounded-lg cursor-pointer ${th.textMuted} hover:bg-white/10`}>✕</button>
            </div>
            <div className={`rounded-xl border ${milk ? 'border-amber-200 bg-amber-50' : 'border-amber-500/30 bg-amber-500/10'} px-3.5 py-2.5 flex items-center justify-between`}>
              <span className={`text-[11px] font-black ${th.chipText}`}>{t('Total to Pay')}</span>
              <span className={`text-lg font-black ${th.statValue}`}>{TZS(props.amount)}</span>
            </div>
            <input value={name} onChange={e => setName(e.target.value)} placeholder={t('Jina Kamili')} className={th.input} />
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+255 7XX XXX XXX" className={th.input} />
            <div className="grid grid-cols-2 gap-2">
              <select value={region} onChange={e => setRegion(e.target.value)} className={`${th.input} cursor-pointer`}>
                <option value="">{t('Region (optional)')}</option>
                {TANZANIA_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <input value={district} onChange={e => setDistrict(e.target.value)} placeholder={t('District (optional)')} className={th.input} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input value={ward} onChange={e => setWard(e.target.value)} placeholder={t('Ward (optional)')} className={th.input} />
              <input value={street} onChange={e => setStreet(e.target.value)} placeholder={t('Street (optional)')} className={th.input} />
            </div>
            {activeNetworks.length > 0 && (
              <div>
                <div className={`block text-[10px] font-black uppercase tracking-wider mb-1.5 ${th.label}`}>{t('Njia ya Malipo')}</div>
                <div className="grid grid-cols-2 gap-2">
                  {activeNetworks.map(n => (
                    <button
                      key={n.network}
                      onClick={() => setNetwork(n.network)}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${network === n.network ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/40' : `${th.cardBorder} ${th.card} hover:brightness-105`}`}
                    >
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-3.5 h-3.5" />
                        <span className={`text-[11px] font-black ${th.strongText}`}>{n.displayName || NETWORK_META[n.network]?.label || n.network}</span>
                      </div>
                      <div className={`text-[9px] ${th.textMuted} font-bold truncate`}>{n.payNumber}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {props.note && <p className={`text-[10px] ${th.textDim} font-semibold`}>{props.note}</p>}
            {error && <div className="text-[11px] font-bold text-red-500">{error}</div>}
            <button
              onClick={pay}
              disabled={busy}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-black rounded-xl ${th.btnPrimary} ${th.btnPrimaryText} cursor-pointer disabled:opacity-50`}
            >
              {busy ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('Inaandaa...')}</> : <><CheckCircle2 className="w-3.5 h-3.5" /> {t('Lipa Sasa — Weka Order')}</>}
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
function GroupDealPage(props: Props) {
  const { t, theme } = props;
  const th = getPublicTheme(theme);
  const milk = theme === 'milk';
  const deal = props.groupDeals.find(d => d.id === Number(props.route.id));
  const [joined, setJoined] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [jName, setJName] = useState(props.session?.name || '');
  const [jPhone, setJPhone] = useState(props.session?.phone || '');
  const [jError, setJError] = useState('');
  const [done, setDone] = useState(false);
  if (!deal) return <NotFound th={th} t={t} onBack={props.onBack} label={t('The deal does not exist.')} />;
  const product = props.products.find(p => p.id === deal.productId);
  const company = props.companies.find(c => c.id === deal.companyId);
  const participants = props.groupDealParticipants.filter(p => p.groupDealId === deal.id);
  const paidCount = participants.filter(p => p.status === 'paid').length;
  const joinedCount = participants.filter(p => p.status === 'joined').length;
  const remaining = Math.max(0, deal.minBuyers - paidCount);
  const progress = Math.min(100, Math.round(paidCount / deal.minBuyers * 100));
  const expired = new Date(deal.expiresAt).getTime() < Date.now();

  const join = () => {
    setJError('');
    if (!jName.trim()) return setJError(t('Jina linahitajika.'));
    if (!/^(\+?255|0)[67]\d{8}$/.test(jPhone.trim().replace(/\s/g, ''))) return setJError(t('Namba ya simu si sahihi. Tumia format ya Tanzania (+255 or 0...).'));
    const res = props.handlers.onJoinGroupDeal(deal.id, { customerName: jName.trim(), customerPhone: jPhone.trim() });
    if (!res.ok) return setJError(res.error || t('Something went wrong.'));
    setJoined(true);
    setDone(true);
  };

  const canPay = done || (deal.status === 'active' && !expired);

  return (
    <div className="space-y-4 pb-16">
      <BackButton th={th} t={t} onClick={props.onBack} />
      <Card th={th} className="p-5">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0">
            {product?.image ? <img src={product.image} alt="" className="w-full h-full object-cover" /> : <div className={`w-full h-full flex items-center justify-center text-white text-xl font-black bg-gradient-to-br from-indigo-500 to-purple-600`}>{(product?.name || '-').charAt(0)}</div>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className={`text-sm font-black ${th.strongText}`}>{product?.name}</h2>
              {deal.status === 'completed' ? (
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">{t('Imekamilika')}</span>
              ) : expired ? (
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-gray-500/15 text-gray-400">{t('Imeisha muda')}</span>
              ) : (
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400">Nunua Pamoja</span>
              )}
            </div>
            <div className={`text-[10px] ${th.textMuted} font-semibold`}>{company?.name} · {t('Kikodi cha kushiriki')}: <span className="font-mono font-black">{deal.shareCode}</span></div>
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              <div>
                <div className={`text-[9px] ${th.textDim} font-bold uppercase`}>{t('Bei ya Kawaida')}</div>
                <div className={`text-xs font-bold ${th.textMuted} line-through`}>{TZS(deal.soloPrice)}</div>
              </div>
              <div>
                <div className={`text-[9px] ${th.textDim} font-bold uppercase`}>{t('Bei ya Kikundi')}</div>
                <div className={`text-lg font-black text-emerald-500`}>{TZS(deal.groupPrice)}</div>
              </div>
              <div>
                <div className={`text-[9px] ${th.textDim} font-bold uppercase`}>{t('Unaokoa')}</div>
                <div className={`text-sm font-black text-amber-500`}>{TZS(Math.max(0, deal.soloPrice - deal.groupPrice))}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-[10px] font-black mb-1.5">
            <span className={th.textMuted}>{paidCount}/{deal.minBuyers} {t('wamelipa')}</span>
            <span className={th.textMuted}>{joinedCount} {t('wamejiunga')} · {t('Wabaki')}: {remaining}</span>
          </div>
          <div className={`h-2.5 rounded-full ${milk ? 'bg-indigo-100' : 'bg-indigo-500/15'} overflow-hidden`}>
            <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          {remaining > 0 && deal.status === 'active' && !expired && (
            <p className={`text-[10px] ${th.textMuted} font-semibold mt-2`}>
              {t('Watu')} {remaining} {remaining === 1 ? t('mwingine anahitajika') : t('wengine wanahitajika')} kulipa ili kila mtu apate bei ya kikundi.
            </p>
          )}
        </div>

        {deal.status === 'active' && !expired && !joined && (
          <div className={`mt-4 p-3.5 rounded-2xl border ${th.cardBorder} space-y-2`}>
            <div className={`text-[11px] font-black ${th.strongText}`}>{t('Jiunge na kikundi')}</div>
            <div className="grid sm:grid-cols-2 gap-2">
              <input value={jName} onChange={e => setJName(e.target.value)} placeholder={t('Jina Kamili')} className={th.input} />
              <input value={jPhone} onChange={e => setJPhone(e.target.value)} placeholder="+255 7XX XXX XXX" className={th.input} />
            </div>
            {jError && <div className="text-[11px] font-bold text-red-500">{jError}</div>}
            <button
              onClick={join}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-black rounded-xl ${th.btnPrimary} ${th.btnPrimaryText} cursor-pointer`}
            >
              <Users className="w-3.5 h-3.5" /> {t('Jiunge — Lipa')} {TZS(deal.groupPrice)}
            </button>
          </div>
        )}

        {canPay && (
          <button
            onClick={() => setPayOpen(true)}
            className={`mt-4 w-full flex items-center justify-center gap-2 px-5 py-3 text-sm font-black rounded-2xl ${th.btnPrimary} ${th.btnPrimaryText} cursor-pointer`}
          >
            <CheckCircle2 className="w-4 h-4" /> {t('Lipa Sasa')} — {TZS(deal.groupPrice)}
          </button>
        )}
      </Card>
      {payOpen && (
        <PaymentModal
          th={th} t={t} milk={milk}
          title={`Nunua Pamoja — ${product?.name || ''}`}
          amount={deal.groupPrice}
          prefillName={jName || props.session?.name || ''}
          prefillPhone={jPhone || props.session?.phone || ''}
          networks={props.collectionSettings || []}
          note={`${t('Bei inathibitishwa pale watu')} ${deal.minBuyers} ${t('wamelipa. Kama muda unaisha, unalipa bei ya kawaida.')}`}
          onClose={() => setPayOpen(false)}
          onPay={(input) => props.handlers.onInitiateGroupPayment(deal.id, input, input.network)}
        />
      )}
    </div>
  );
}

function GroupDealsListing(props: Props) {
  const { t } = props;
  const th = getPublicTheme(props.theme);
  const now = Date.now();
  const deals = props.groupDeals.filter(d => d.status === 'active' && new Date(d.expiresAt).getTime() > now);
  return (
    <div className="space-y-4 pb-16">
      <BackButton th={th} t={t} onClick={props.onBack} />
      <h1 className={`text-xl font-black ${th.strongText}`}>{t('Nunua Pamoja — Deals za Kikundi')}</h1>
      {deals.length === 0 && (
        <Card th={th} className="p-8 text-center">
          <div className={`text-sm font-black ${th.strongText}`}>{t('Hakuna deals sasa')}</div>
          <div className={`text-[11px] ${th.textMuted} font-semibold mt-1`}>{t('Muuzaji akianzisha Nunua Pamoja, deal itaonekana hapa.')}</div>
        </Card>
      )}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {deals.map(d => {
          const product = props.products.find(p => p.id === d.productId);
          const company = props.companies.find(c => c.id === d.companyId);
          const paid = props.groupDealParticipants.filter(p => p.groupDealId === d.id && p.status === 'paid').length;
          return (
            <button key={d.id} onClick={() => props.onNavigate(`/group-deal/${d.id}`)} className={`${th.card} ${th.cardBorder} rounded-2xl overflow-hidden text-left transition hover:brightness-105 cursor-pointer`}>
              <div className="h-36 overflow-hidden">
                {product?.image ? <img src={product.image} alt="" className="w-full h-full object-cover" /> : <div className={`w-full h-full flex items-center justify-center text-white text-3xl font-black bg-gradient-to-br from-indigo-500 to-purple-600`}>{(product?.name || '-').charAt(0)}</div>}
              </div>
              <div className="p-3.5">
                <div className={`text-[12px] font-black ${th.strongText} line-clamp-1`}>{product?.name}</div>
                <div className={`text-[10px] ${th.textMuted} font-semibold`}>{company?.name}</div>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-sm font-black text-emerald-500`}>{TZS(d.groupPrice)}</span>
                  <span className={`text-[10px] font-bold ${th.textMuted} line-through`}>{TZS(d.soloPrice)}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 text-[10px] font-black">
                  <Users className="w-3 h-3 text-indigo-400" /> {paid}/{d.minBuyers} {t('wamelipa')}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ================= 5. LIPA POLE POLE =================
function InstallmentStartPage(props: Props) {
  const { t, theme } = props;
  const th = getPublicTheme(theme);
  const milk = theme === 'milk';
  const product = props.products.find(p => p.id === Number(props.route.id));
  const [name, setName] = useState(props.session?.name || '');
  const [phone, setPhone] = useState(props.session?.phone || '');
  const [planId, setPlanId] = useState<number | undefined>(props.installmentPlans.find(p => p.productId === Number(props.route.id) && p.status === 'active')?.id);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{ trackingCode: string } | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  if (!product) return <NotFound th={th} t={t} onBack={props.onBack} label={t('The product does not exist.')} />;
  const plans = props.installmentPlans.filter(p => p.productId === product.id && p.status === 'active');
  const plan = plans.find(p => p.id === planId) || plans[0];

  const create = () => {
    setError('');
    if (!name.trim()) return setError(t('Jina linahitajika.'));
    if (!/^(\+?255|0)[67]\d{8}$/.test(phone.trim().replace(/\s/g, ''))) return setError(t('Namba ya simu si sahihi. Tumia format ya Tanzania (+255 or 0...).'));
    if (!plan) return setError(t('Chagua mpango.'));
    const res = props.handlers.onCreateInstallmentOrder({
      productId: product.id, companyId: product.companyId, installmentPlanId: plan.id,
      customerName: name.trim(), customerPhone: phone.trim()
    });
    if (!res.ok || !res.trackingCode) return setError(res.error || t('Something went wrong.'));
    setCreated({ trackingCode: res.trackingCode });
  };

  const instOrder = created ? props.installmentOrders.find(o => o.trackingCode === created.trackingCode) : undefined;

  return (
    <div className="space-y-4 pb-16">
      <BackButton th={th} t={t} onClick={props.onBack} />
      <Card th={th} className="p-5">
        <h1 className={`text-lg font-black ${th.strongText}`}>{t('Lipa Pole Pole')} — {product.name}</h1>
        <div className={`text-[11px] ${th.textMuted} font-semibold mt-1`}>{t('Nunua sasa, lipa kwa awamu. Hakuna mabenki yanayohitajika.')}</div>
        <div className={`mt-3 rounded-xl border ${milk ? 'border-amber-200 bg-amber-50' : 'border-amber-500/30 bg-amber-500/10'} px-3.5 py-2.5`}>
          <div className={`text-[10px] ${th.textMuted} font-bold uppercase`}>{t('Bei ya Bidhaa')}</div>
          <div className={`text-lg font-black ${th.statValue}`}>{TZS(product.price)}</div>
        </div>

        {plans.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className={`block text-[10px] font-black uppercase tracking-wider mb-1 ${th.label}`}>{t('Chagua Mpango wa Awamu')}</div>
            {plans.map(p => {
              const down = Math.round(product.price * p.downPaymentPercent / 100);
              const principal = Math.round((product.price - down) / p.installmentsCount);
              const instAmount = Math.round(principal * (1 + p.installmentPercentExtra / 100));
              const active = plan?.id === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setPlanId(p.id)}
                  className={`w-full p-3 rounded-xl border text-left transition cursor-pointer ${active ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/40' : `${th.cardBorder} ${th.card} hover:brightness-105`}`}
                >
                  <div className="flex items-center justify-between flex-wrap">
                    <span className={`text-[11px] font-black ${th.strongText}`}>{t('Awali')} {p.downPaymentPercent}% + {p.installmentsCount} {t('awamu')}</span>
                    <span className={`text-[10px] font-bold ${th.textMuted}`}>{t('Riba')} {p.installmentPercentExtra}%/{t('awamu')}</span>
                  </div>
                  <div className={`text-[10px] ${th.textMuted} font-semibold mt-1`}>
                    {t('Awali')}: {TZS(down)} · {t('Kila awamu')}: {TZS(instAmount)}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {!created ? (
          <div className="mt-4 space-y-2">
            <input value={name} onChange={e => setName(e.target.value)} placeholder={t('Jina Kamili')} className={th.input} />
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+255 7XX XXX XXX" className={th.input} />
            {error && <div className="text-[11px] font-bold text-red-500">{error}</div>}
            <button onClick={create} className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-black rounded-xl ${th.btnPrimary} ${th.btnPrimaryText} cursor-pointer`}>
              <CalendarClock className="w-3.5 h-3.5" /> {t('Anza Lipa Pole Pole')}
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            <div className={`rounded-xl border ${milk ? 'border-emerald-200 bg-emerald-50' : 'border-emerald-500/30 bg-emerald-500/10'} p-3.5`}>
              <div className={`text-[11px] font-black text-emerald-500`}>{t('Agizo lako la awamu limeundwa!')}</div>
              <div className={`text-[10px] ${th.textMuted} font-semibold mt-1`}>
                {t('Kodi ya kufuatilia')}: <span className="font-mono font-black">{created.trackingCode}</span>
              </div>
            </div>
            <button
              onClick={() => setPayOpen(true)}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-black rounded-xl ${th.btnPrimary} ${th.btnPrimaryText} cursor-pointer`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> {t('Lipa Awali')} — {instOrder ? TZS(instOrder.downPayment) : ''}
            </button>
          </div>
        )}
      </Card>
      {payOpen && instOrder && (
        <PaymentModal
          th={th} t={t} milk={milk}
          title={t('Malipo ya Awali')}
          amount={instOrder.downPayment}
          prefillName={name}
          prefillPhone={phone}
          networks={props.collectionSettings || []}
          note={t('Baada ya awali kuthibitishwa, utapokea SMS ya malipo yafuatayo.')}
          onClose={() => setPayOpen(false)}
          onPay={(input) => props.handlers.onInitiateInstallmentPayment(instOrder.id, 'down', input, input.network)}
        />
      )}
    </div>
  );
}

function InstallmentOrderPage(props: Props) {
  const { t, theme } = props;
  const th = getPublicTheme(theme);
  const milk = theme === 'milk';
  const instOrder = props.installmentOrders.find(o => o.trackingCode === props.route.id);
  const [payOpen, setPayOpen] = useState(false);
  if (!instOrder) return <NotFound th={th} t={t} onBack={props.onBack} label={t('Agizo la awamu halipo.')} />;
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
            className={`mt-4 w-full flex items-center justify-center gap-2 px-5 py-3 text-sm font-black rounded-2xl ${th.btnPrimary} ${th.btnPrimaryText} cursor-pointer`}
          >
            <CalendarClock className="w-4 h-4" /> {t('Lipa Awamu Ifuatayo')} — {TZS(instOrder.installmentAmount)}
          </button>
        )}
      </Card>

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
          networks={props.collectionSettings || []}
          note={t('Baada ya awamu ya mwisho kuthibitishwa, bidhaa itatumwa.')}
          onClose={() => setPayOpen(false)}
          onPay={(input) => props.handlers.onInitiateInstallmentPayment(instOrder.id, 'installment', input, input.network)}
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
  const updates = props.deliveryUpdates.filter(u => u.deliveryId === delivery.id).slice(0, 30);
  const steps: Array<{ key: string; label: string }> = [
    { key: 'pending', label: t('Inasubiri rider') },
    { key: 'assigned', label: t('Rider ameteuliwa') },
    { key: 'picked', label: t('Bidhaa imechukuliwa') },
    { key: 'on_the_way', label: t('Njiani kwako') },
    { key: 'delivered', label: t('Imefikishwa') }
  ];
  const statusIdx = steps.findIndex(s => s.key === delivery.status);

  return (
    <div className="space-y-4 pb-16">
      <BackButton th={th} t={t} onClick={props.onBack} />
      <Card th={th} className="p-5">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${delivery.status === 'delivered' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className={`text-sm font-black ${th.strongText}`}>{t('Kufuatilia Delivery')}</div>
            <div className={`text-[11px] font-black ${th.textMuted} font-mono`}>{delivery.trackingCode}</div>
          </div>
        </div>
        <div className={`text-[11px] ${th.textMuted} font-semibold mt-3`}>
          {delivery.customerName} · {delivery.customerAddress}
        </div>

        <div className="mt-5">
          {steps.map((s, i) => {
            const done = i <= statusIdx;
            const cancelled = delivery.status === 'cancelled';
            return (
              <div key={s.key} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${cancelled ? 'bg-red-500/15 text-red-400' : done ? 'bg-emerald-500/20 text-emerald-500' : 'bg-gray-500/15 text-gray-400'}`}>
                    {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  {i < steps.length - 1 && <div className={`w-0.5 h-8 ${done && !cancelled ? 'bg-emerald-500/50' : 'bg-gray-500/20'}`} />}
                </div>
                <div className={`pb-4 text-[11px] font-black ${done ? th.strongText : th.textMuted}`}>{s.label}</div>
              </div>
            );
          })}
        </div>

        {delivery.riderName && (
          <div className={`mt-2 rounded-xl border ${th.cardBorder} p-3`}>
            <div className={`text-[10px] font-black uppercase tracking-wider ${th.textMuted}`}>{t('Rider')}</div>
            <div className={`text-[12px] font-black ${th.strongText}`}>{delivery.riderName}</div>
            {delivery.riderPhone && <div className={`text-[10px] ${th.textMuted} font-bold`}>{delivery.riderPhone}</div>}
          </div>
        )}
        {delivery.estimatedMinutes != null && (
          <div className={`mt-2 flex items-center gap-1.5 text-[11px] font-black ${th.chipText} ${th.chip} ${th.chipBorder} px-3 py-1.5 rounded-full w-fit`}>
            <Clock className="w-3.5 h-3.5" /> ~{delivery.estimatedMinutes} min
          </div>
        )}
      </Card>

      {updates.length > 0 && (
        <Card th={th} className="p-5">
          <h3 className={`text-sm font-black ${th.strongText} mb-3`}>{t('Mabadiliko ya Delivery')}</h3>
          <div className="space-y-2">
            {updates.map(u => (
              <div key={u.id} className={`p-2.5 rounded-xl border ${th.cardBorder}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[10px] font-black uppercase ${u.status === 'location' ? 'text-sky-400' : th.strongText}`}>{u.status}</span>
                  <span className={`text-[9px] ${th.textDim} font-bold`}>{new Date(u.createdAt).toLocaleString()}</span>
                </div>
                {u.lat != null && u.lng != null && (
                  <div className={`flex items-center gap-1.5 text-[10px] text-sky-400 font-bold mt-1`}>
                    <Navigation className="w-3 h-3" /> {u.lat.toFixed(5)}, {u.lng.toFixed(5)}
                  </div>
                )}
                {u.note && <p className={`text-[10px] ${th.textMuted} font-semibold mt-0.5`}>{u.note}</p>}
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
