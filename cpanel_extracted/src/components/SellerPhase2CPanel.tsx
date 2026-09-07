import React, { useState } from 'react';
import {
  HandCoins, Users, CalendarClock, Bike, Video, Gift, MessageCircle,
  CheckCircle2, XCircle, Clock3, MapPin, Send, Copy, ExternalLink, Repeat
} from 'lucide-react';
import {
  Company, Offer, OfferMessage, GroupDeal, GroupDealParticipant, InstallmentPlan,
  InstallmentOrder, InstallmentPayment, Delivery, DeliveryUpdate, LiveStream,
  LiveComment, LoyaltyCustomer, WhatsappConversation, MarketplaceProduct
} from '../types';
import { TZS } from './marketplace/MarketplaceShared';

interface SellerPhase2CPanelProps {
  company: Company | null;
  offers: Offer[];
  offerMessages: OfferMessage[];
  products?: MarketplaceProduct[];
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
  whatsappConversations: WhatsappConversation[];
  translate: (text: string) => string;
  onDecideOffer: (offerId: number, accept: boolean) => void;
  // --- MEGA CRITICAL FIX 2-in-1: counter + reject-with-reason ---
  onCounterOffer?: (offerId: number, counterPrice: number, message?: string) => void;
  onRejectOffer?: (offerId: number, reason: string) => void;
  onAssignDeliveryRider: (deliveryId: number, riderName: string, riderPhone: string) => void;
  onUpdateDeliveryStatus: (deliveryId: number, status: string, note?: string) => void;
}

const OFFER_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Inasubiri', cls: 'bg-amber-100 text-amber-800' },
  countered: { label: 'Mpango Mpya', cls: 'bg-blue-100 text-blue-800' },
  accepted: { label: 'Imekubaliwa', cls: 'bg-green-100 text-green-800' },
  rejected: { label: 'Imekataliwa', cls: 'bg-red-100 text-red-800' },
  paid: { label: 'Imelipwa', cls: 'bg-emerald-100 text-emerald-700' },
  expired: { label: 'Imekwisha', cls: 'bg-gray-100 text-gray-600' }
};

const DELIVERY_STEPS = ['pending', 'assigned', 'picked', 'on_the_way', 'delivered'];

const STATUS_LABEL: Record<string, string> = {
  pending: 'Inasubiri rider',
  assigned: 'Rider amekabidhiwa',
  picked: 'Bidhaa zimechukuliwa',
  on_the_way: 'Njiani kufika',
  delivered: 'Imefikishwa',
  cancelled: 'Imeghairiwa'
};

export default function SellerPhase2CPanel({
  company, offers, offerMessages, products, groupDeals, groupDealParticipants, installmentPlans,
  installmentOrders, installmentPayments, deliveries, deliveryUpdates, liveStreams,
  liveComments, loyaltyCustomers, whatsappConversations, translate: t,
  onDecideOffer, onCounterOffer, onRejectOffer, onAssignDeliveryRider, onUpdateDeliveryStatus
}: SellerPhase2CPanelProps) {
  const companyId = company?.id || 0;
  const [tab, setTab] = useState('offers');
  const [copied, setCopied] = useState<string | null>(null);
  // --- MEGA CRITICAL FIX: counter / reject-reason inline forms ---
  const [counterFor, setCounterFor] = useState<number | null>(null);
  const [counterPrice, setCounterPrice] = useState('');
  const [counterMsg, setCounterMsg] = useState('');
  const [rejectFor, setRejectFor] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const myOffers = offers.filter(o => o.companyId === companyId);
  const myDeals = groupDeals.filter(g => g.companyId === companyId);
  const myInstallments = installmentOrders.filter(o => o.companyId === companyId);
  const myDeliveries = deliveries.filter(d => d.companyId === companyId);
  const myStreams = liveStreams.filter(s => s.companyId === companyId);

  const productName = (id: number) => {
    // product names are resolved via liveStreams/deliveries descriptions; fallback to id
    return `#${id}`;
  };

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const productNameForStream = (stream: LiveStream) => productName(stream.productIds?.[0] || 0);

  const tabs = [
    { id: 'offers', label: t('Piga Bei'), icon: HandCoins, count: myOffers.length },
    { id: 'deals', label: t('Nunua Pamoja'), icon: Users, count: myDeals.length },
    { id: 'installments', label: t('Lipa Pole Pole'), icon: CalendarClock, count: myInstallments.length },
    { id: 'deliveries', label: t('Bodaboda'), icon: Bike, count: myDeliveries.length },
    { id: 'live', label: t('Live Shopping'), icon: Video, count: myStreams.length },
    { id: 'loyalty', label: t('Loyalty'), icon: Gift, count: loyaltyCustomers.length },
    { id: 'whatsapp', label: t('WhatsApp Bot'), icon: MessageCircle, count: whatsappConversations.length }
  ];

  const renderOffers = () => (
    <div className="space-y-2">
      {myOffers.length === 0 && <div className="py-8 text-center text-gray-400 font-medium text-xs">{t('Hakuna offers bado. Wateja wanaweza kuweka Piga Bei kwenye bidhaa zako.')}</div>}
      {myOffers.map(offer => {
        const meta = OFFER_STATUS[offer.status] || OFFER_STATUS.pending;
        const msgs = offerMessages.filter(m => m.offerId === offer.id);
        const counter = msgs.filter(m => m.senderType === 'seller' && m.price !== undefined).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
        // MEGA CRITICAL FIX: resolve real product info
        const product = products?.find(p => p.id === offer.productId);
        return (
          <div key={offer.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center text-white text-sm font-black">
                  {product?.image ? <img src={product.image} alt="" className="w-full h-full object-cover" /> : (product?.name || '?').charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-gray-900">{offer.customerName} <span className="text-gray-400 font-medium">· {offer.customerPhone}</span></div>
                  <div className="text-[11px] text-gray-500 mt-0.5 truncate">{product ? product.name : `${t('Bidhaa')} #${offer.productId}`} · {new Date(offer.createdAt).toLocaleString()}</div>
                  {offer.buyerMessage && <div className="mt-1 text-[10px] text-gray-600 italic">💬 {offer.buyerMessage}</div>}
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${meta.cls}`}>{meta.label}</span>
            </div>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <div>
                <div className="text-[9px] text-gray-400 font-bold uppercase">{t('Bei Halisi')}</div>
                <div className="text-[11px] font-bold text-gray-500 line-through">{TZS(offer.originalPrice)}</div>
              </div>
              <div>
                <div className="text-[9px] text-gray-400 font-bold uppercase">{t('Ofa ya Mteja')}</div>
                <div className="text-lg font-extrabold text-gray-900">{TZS(offer.offeredPrice)}</div>
              </div>
              {(counter || offer.counterPrice) && (
                <div>
                  <div className="text-[9px] text-gray-400 font-bold uppercase">{t('Bei yako')}</div>
                  <div className="text-lg font-extrabold text-brand">{TZS(offer.counterPrice ?? counter!.price!)}</div>
                </div>
              )}
            </div>
            {offer.sellerMessage && ['rejected', 'countered', 'accepted'].includes(offer.status) && (
              <div className="mt-2 text-[10px] text-gray-500 bg-gray-50 rounded-lg px-2.5 py-1.5">💬 {offer.sellerMessage}</div>
            )}
            {offer.status === 'pending' && (
              <div className="space-y-2 mt-3">
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => onDecideOffer(offer.id, true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-[11px] font-bold hover:bg-green-700 cursor-pointer">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {t('Kubali')}
                  </button>
                  <button
                    onClick={() => { setCounterFor(counterFor === offer.id ? null : offer.id); setCounterPrice(String(Math.round(offer.offeredPrice * 1.15))); setCounterMsg(''); setRejectFor(null); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[11px] font-bold hover:bg-blue-700 cursor-pointer"
                  >
                    <Repeat className="w-3.5 h-3.5" /> {t('Counter Offer')}
                  </button>
                  <button
                    onClick={() => { setRejectFor(rejectFor === offer.id ? null : offer.id); setRejectReason(''); setCounterFor(null); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-lg text-[11px] font-bold hover:bg-red-600 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" /> {t('Kataa')}
                  </button>
                </div>
                {counterFor === offer.id && (
                  <div className="rounded-xl border border-gray-200 p-3 space-y-2 bg-gray-50">
                    <input
                      value={counterPrice}
                      onChange={e => setCounterPrice(e.target.value.replace(/[^\d]/g, ''))}
                      placeholder={t('Bei yako ya kukabidhi (TZS)')}
                      type="number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
                    />
                    <input
                      value={counterMsg}
                      onChange={e => setCounterMsg(e.target.value)}
                      placeholder={t('Ujumbe kwa mteja (si lazima) — mfano: Hii ndio bei ya mwisho')}
                      maxLength={300}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
                    />
                    <button
                      onClick={() => {
                        const cp = Number(counterPrice);
                        if (cp > 0 && onCounterOffer) {
                          onCounterOffer(offer.id, cp, counterMsg.trim() || undefined);
                          setCounterFor(null); setCounterPrice(''); setCounterMsg('');
                        }
                      }}
                      disabled={!Number(counterPrice)}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-[11px] font-bold hover:bg-blue-700 cursor-pointer disabled:opacity-40"
                    >
                      <Repeat className="w-3.5 h-3.5" /> {t('Tuma Counter Offer')}
                    </button>
                  </div>
                )}
                {rejectFor === offer.id && (
                  <div className="rounded-xl border border-gray-200 p-3 space-y-2 bg-gray-50">
                    <input
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      placeholder={t('Sababu ya kukataa (inahitajika) — mfano: Bei ni below cost')}
                      maxLength={300}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
                    />
                    <button
                      onClick={() => {
                        if (rejectReason.trim() && onRejectOffer) {
                          onRejectOffer(offer.id, rejectReason.trim());
                          setRejectFor(null); setRejectReason('');
                        }
                      }}
                      disabled={!rejectReason.trim()}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-red-500 text-white rounded-lg text-[11px] font-bold hover:bg-red-600 cursor-pointer disabled:opacity-40"
                    >
                      <XCircle className="w-3.5 h-3.5" /> {t('Kataa kwa Sababu')}
                    </button>
                  </div>
                )}
              </div>
            )}
            {offer.status === 'countered' && (
              <div className="mt-2 text-[11px] font-bold text-sky-700 inline-flex items-center gap-1.5">
                <Clock3 className="w-3.5 h-3.5" /> {t('Inasubiri mteja ajibu pendekezo lako.')}
              </div>
            )}
            {offer.status === 'accepted' && (
              <div className="mt-2 text-[11px] font-bold text-emerald-700 inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> {t('Mteja anaweza kulipa sasa. Inasubiri uthibitisho wa malipo.')}
              </div>
            )}
            {offer.status === 'paid' && offer.paymentReference && (
              <div className="mt-2 text-[11px] font-bold text-gray-500 inline-flex items-center gap-1.5">
                <Clock3 className="w-3.5 h-3.5" /> {t('Ref')}: {offer.paymentReference}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderDeals = () => (
    <div className="space-y-2">
      {myDeals.length === 0 && <div className="py-8 text-center text-gray-400 font-medium text-xs">{t('Hakuna group deals bado.')}</div>}
      {myDeals.map(deal => {
        const participants = groupDealParticipants.filter(p => p.groupDealId === deal.id);
        const paid = participants.filter(p => p.status === 'paid').length;
        return (
          <div key={deal.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-gray-900">{t('Bidhaa')} #{deal.productId}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">{t('Bei ya peke')}: {TZS(deal.soloPrice)} → {t('Pamoja')}: {TZS(deal.groupPrice)}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{deal.status === 'active' ? t('Inaendelea') : deal.status}</span>
                <button onClick={() => copyCode(deal.shareCode)} className="inline-flex items-center gap-1 text-[10px] font-bold text-brand hover:text-brand/80 cursor-pointer">
                  {copied === deal.shareCode ? <span className="text-green-600">{t('Copied!')}</span> : <><Copy className="w-3 h-3" /> {deal.shareCode}</>}
                </button>
              </div>
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-1">
                <span>{paid} / {deal.minBuyers} {t('wanunuzi')}</span>
                <span>{Math.min(100, Math.round((paid / deal.minBuyers) * 100))}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${Math.min(100, (paid / deal.minBuyers) * 100)}%` }} />
              </div>
            </div>
            {participants.length > 0 && (
              <div className="mt-3 space-y-1">
                {participants.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-[11px] text-gray-600">
                    <span>{p.customerName} · {p.customerPhone}</span>
                    <span className={`font-bold ${p.status === 'paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {p.status === 'paid' ? t('Imelipwa') : t('Amekusanywa')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderInstallments = () => (
    <div className="space-y-2">
      {myInstallments.length === 0 && <div className="py-8 text-center text-gray-400 font-medium text-xs">{t('Hakuna orders za Lipa Pole Pole bado.')}</div>}
      {myInstallments.map(order => {
        const plan = installmentPlans.find(p => p.id === order.installmentPlanId);
        const payments = installmentPayments.filter(p => p.installmentOrderId === order.id);
        const done = payments.filter(p => p.status === 'completed').length;
        const progress = Math.round((done / order.installmentsCount) * 100);
        return (
          <div key={order.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-gray-900">{order.customerName} <span className="text-gray-400 font-medium">· {order.customerPhone}</span></div>
                <div className="text-[11px] text-gray-500 mt-0.5">{t('Bidhaa')} #{order.productId} · {order.trackingCode}</div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${order.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : order.status === 'active' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-800'}`}>
                {order.status === 'completed' ? t('Imekamilika') : order.status === 'active' ? t('Inaendelea') : t('Awali haijalipwa')}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="text-lg font-extrabold text-gray-900">{TZS(order.totalPrice)}</div>
              <div className="text-[11px] text-gray-500">Kila awamu {TZS(order.installmentAmount)} × {order.installmentsCount}</div>
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-1">
                <span>{done} / {order.installmentsCount} {t('awamu zilizolipwa')}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-sky-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderDeliveries = () => {
    const [riders, setRiders] = useState<Record<number, { name: string; phone: string }>>({});
    return (
      <div className="space-y-2">
        {myDeliveries.length === 0 && <div className="py-8 text-center text-gray-400 font-medium text-xs">{t('Hakuna deliveries bado. Kila order inayomalizika inaunda tracking ya bodaboda.')}</div>}
        {myDeliveries.map(delivery => {
          const stepIdx = DELIVERY_STEPS.indexOf(delivery.status);
          const rider = riders[delivery.id] || { name: '', phone: '' };
          const latest = deliveryUpdates.filter(u => u.deliveryId === delivery.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
          return (
            <div key={delivery.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-gray-900">{delivery.trackingCode}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    {delivery.status !== 'cancelled' && STATUS_LABEL[delivery.status]}
                    {delivery.status === 'cancelled' && <span className="text-red-600 font-bold">Imegairiwa</span>}
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${delivery.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' : delivery.status === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-sky-100 text-sky-700'}`}>
                  {(STATUS_LABEL[delivery.status] || delivery.status).toUpperCase()}
                </span>
              </div>
              {delivery.status === 'pending' && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input
                    value={rider.name}
                    onChange={e => setRiders({ ...riders, [delivery.id]: { ...rider, name: e.target.value } })}
                    placeholder={t('Jina la rider')}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
                  />
                  <div className="flex gap-2">
                    <input
                      value={rider.phone}
                      onChange={e => setRiders({ ...riders, [delivery.id]: { ...rider, phone: e.target.value } })}
                      placeholder="07XX XXX XXX"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
                    />
                    <button
                      onClick={() => {
                        if (rider.name.trim() && rider.phone.trim()) {
                          onAssignDeliveryRider(delivery.id, rider.name.trim(), rider.phone.trim());
                          setRiders({ ...riders, [delivery.id]: { name: '', phone: '' } });
                        }
                      }}
                      className="px-3 py-2 bg-brand text-white rounded-lg text-[11px] font-bold hover:bg-brand/90 cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" /> {t('Kabidhi')}
                    </button>
                  </div>
                </div>
              )}
              {(delivery.status === 'assigned' || delivery.status === 'picked' || delivery.status === 'on_the_way') && (
                <div className="flex flex-wrap gap-2 mt-3">
                  <button onClick={() => onUpdateDeliveryStatus(delivery.id, 'picked', t('Rider amechukua bidhaa'))} className="px-3 py-1.5 bg-sky-600 text-white rounded-lg text-[11px] font-bold hover:bg-sky-700 cursor-pointer">{t('Amechukua')}</button>
                  <button onClick={() => onUpdateDeliveryStatus(delivery.id, 'on_the_way', t('Rider njiani'))} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[11px] font-bold hover:bg-indigo-700 cursor-pointer">{t('Njiani')}</button>
                  <button onClick={() => onUpdateDeliveryStatus(delivery.id, 'delivered', t('Bidhaa zimefika'))} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[11px] font-bold hover:bg-emerald-700 cursor-pointer">{t('Imefikishwa')}</button>
                </div>
              )}
              {delivery.riderName && (
                <div className="mt-3 flex items-center gap-2 text-[11px] text-gray-600">
                  <Bike className="w-4 h-4 text-brand" />
                  <span className="font-bold">{delivery.riderName}</span>
                  <span>· {delivery.riderPhone}</span>
                  <a href={`tel:${delivery.riderPhone}`} className="text-brand font-bold">☎</a>
                </div>
              )}
              {latest && (
                <div className="mt-2 text-[10px] text-gray-500 inline-flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-brand" />
                  {latest.note || t('Sasisho')} {latest.lat !== undefined && latest.lng !== undefined ? `· ${Number(latest.lat).toFixed(5)}, ${Number(latest.lng).toFixed(5)}` : ''} · {new Date(latest.createdAt).toLocaleTimeString()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderLive = () => (
    <div className="space-y-2">
      {myStreams.length === 0 && <div className="py-8 text-center text-gray-400 font-medium text-xs">{t('Hakuna live streams bado.')}</div>}
      {myStreams.map(stream => {
        const comments = liveComments.filter(c => c.liveStreamId === stream.id);
        const wants = comments.filter(c => c.type === 'want').length;
        return (
          <div key={stream.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-gray-900">{stream.title}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">{t('Bidhaa')} {productNameForStream(stream)} · {stream.streamKey}</div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stream.status === 'live' ? 'bg-rose-100 text-rose-700' : stream.status === 'scheduled' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>
                {stream.status === 'live' ? '● LIVE' : stream.status}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-3 text-[11px] text-gray-500">
              <span>👁 {stream.viewersCount || 0}</span>
              <span>👍 {stream.likesCount || 0}</span>
              <span className="font-bold text-indigo-600">"Nataka" × {wants}</span>
            </div>
            {comments.length > 0 && (
              <div className="mt-3 space-y-1">
                {comments.slice(-4).map(c => (
                  <div key={c.id} className="text-[11px] text-gray-600">
                    <span className="font-bold text-gray-800">{c.customerName}:</span> {c.message || (c.type === 'want' ? `"Nataka #${c.productId}"` : '')}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderLoyalty = () => (
    <div className="space-y-2">
      {loyaltyCustomers.length === 0 && <div className="py-8 text-center text-gray-400 font-medium text-xs">{t('Hakuna wateja wa loyalty bado.')}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {loyaltyCustomers.map(c => (
          <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-gray-900">{c.name || c.phone} <span className="text-gray-400 font-medium">· {c.phone}</span></div>
                <div className="text-[11px] text-gray-500 mt-0.5">{c.tier} · {t('Kila')} {c.balancePoints > 0 ? `${t('points')} ${c.balancePoints}` : ''}</div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.tier === 'platinum' ? 'bg-purple-100 text-purple-700' : c.tier === 'gold' ? 'bg-amber-100 text-amber-700' : c.tier === 'silver' ? 'bg-gray-100 text-gray-700' : 'bg-orange-100 text-orange-700'}`}>{c.tier}</span>
            </div>
            <div className="flex gap-6 mt-3 text-[11px]">
              <div><div className="text-lg font-extrabold text-gray-900">{c.balancePoints}</div><div className="text-gray-400 font-semibold">{t('Points balance')}</div></div>
              <div><div className="text-lg font-extrabold text-gray-900">{c.totalPoints}</div><div className="text-gray-400 font-semibold">{t('Total earned')}</div></div>
              <div><div className="text-lg font-extrabold text-gray-900">{t('TZS')} {c.totalSpent.toLocaleString()}</div><div className="text-gray-400 font-semibold">{t('Total spent')}</div></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderWhatsapp = () => (
    <div className="space-y-2">
      {whatsappConversations.length === 0 && <div className="py-8 text-center text-gray-400 font-medium text-xs">{t('Hakuna mazungumzo ya WhatsApp bado.')}</div>}
      {whatsappConversations.slice(0, 50).map(conv => (
        <div key={conv.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-gray-900">{conv.phone}</div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${conv.status === 'replied' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{conv.status}</span>
          </div>
          <div className="mt-2 text-[11px] text-gray-600">{conv.messageIn}</div>
          {conv.messageOut && (
            <div className="mt-1.5 text-[11px] text-brand font-semibold bg-emerald-50 rounded-lg p-2">→ {conv.messageOut}</div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-brand to-indigo-700 rounded-xl p-5 text-white shadow-lg">
        <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">{t('Smart Selling (Phase 2C)')} — {company?.name || ''}</div>
        <div className="text-lg font-black mt-1">{t('Piga Bei · Nunua Pamoja · Lipa Pole Pole · Bodaboda · Live · Loyalty · WhatsApp Bot')}</div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {tabs.map(tabItem => (
          <button
            key={tabItem.id}
            onClick={() => setTab(tabItem.id)}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-bold transition cursor-pointer ${
              tab === tabItem.id ? 'bg-brand text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <tabItem.icon className="w-3.5 h-3.5" /> {tabItem.label}
            {tabItem.count > 0 && <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${tab === tabItem.id ? 'bg-white/25' : 'bg-gray-100 text-gray-600'}`}>{tabItem.count}</span>}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-bold text-gray-900 text-sm">
            {tab === 'offers' && t('Offers (Piga Bei)')}
            {tab === 'deals' && t('Group Deals (Nunua Pamoja)')}
            {tab === 'installments' && t('Lipa Pole Pole')}
            {tab === 'deliveries' && t('Bodaboda Deliveries')}
            {tab === 'live' && t('Live Shopping')}
            {tab === 'loyalty' && t('Loyalty Customers')}
            {tab === 'whatsapp' && t('WhatsApp Bot Conversations')}
          </div>
          <span className="text-[11px] font-bold text-gray-400">
            {tab === 'offers' && myOffers.length}
            {tab === 'deals' && myDeals.length}
            {tab === 'installments' && myInstallments.length}
            {tab === 'deliveries' && myDeliveries.length}
            {tab === 'live' && myStreams.length}
            {tab === 'loyalty' && loyaltyCustomers.length}
            {tab === 'whatsapp' && whatsappConversations.length}
          </span>
        </div>

        {tab === 'offers' && renderOffers()}
        {tab === 'deals' && renderDeals()}
        {tab === 'installments' && renderInstallments()}
        {tab === 'deliveries' && renderDeliveries()}
        {tab === 'live' && renderLive()}
        {tab === 'loyalty' && renderLoyalty()}
        {tab === 'whatsapp' && renderWhatsapp()}
      </div>
    </div>
  );
}
