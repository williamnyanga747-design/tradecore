import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  HandCoins, Users, CalendarClock, Bike, Video, Gift, MessageCircle,
  CheckCircle2, XCircle, Clock3, MapPin, Send, Copy, ExternalLink, Repeat,
  Phone, MessageSquare, Plus, Filter, Check, ChevronRight, X, Sparkles,
  ArrowRight, ShieldCheck, Tag, AlertCircle, Radio, Play, Square,
  CheckCheck, ToggleLeft, ToggleRight, DollarSign, Receipt
} from 'lucide-react';
import {
  Company, Offer, OfferMessage, GroupDeal, GroupDealParticipant, InstallmentPlan,
  InstallmentOrder, InstallmentPayment, Delivery, DeliveryUpdate, LiveStream,
  LiveComment, LoyaltyCustomer, WhatsappConversation, MarketplaceProduct,
  ChatConversation, ChatMessage, InstallmentOrderStatus, LiveStreamStatus, LiveCommentType
} from '../types';
import { TZS } from './marketplace/MarketplaceShared';
import { sameId } from '../utils/idUtils';
import { timeAgo } from '../utils/megaHelpers';
import InstallmentVisualSchedule from './marketplace/InstallmentVisualSchedule';

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
  onCounterOffer?: (offerId: number, counterPrice: number, message?: string) => void;
  onRejectOffer?: (offerId: number, reason: string) => void;
  onAssignDeliveryRider: (deliveryId: number, riderName: string, riderPhone: string) => void;
  onUpdateDeliveryStatus: (deliveryId: number, status: string, note?: string) => void;
  // --- Live Chat & Creation Handlers ---
  chatConversations?: ChatConversation[];
  chatMessages?: ChatMessage[];
  chatHandlers?: {
    onSend: (conversationId: number, input: { text?: string; messageType: 'text' | 'image' | 'product'; imageData?: string; productId?: number }) => void;
    onMarkRead: (conversationId: number) => void;
  };
  onCreateGroupDeal?: (input: { productId: number; companyId: number; groupPrice: number; minBuyers: number; maxBuyers?: number; durationHours: number }) => { ok: boolean; dealId?: number; error?: string };
  onVerifyParticipantPayment?: (participantId: number) => { ok: boolean; error?: string } | void;
  onCloseGroupDeal?: (dealId: number, status: 'completed' | 'cancelled') => { ok: boolean } | void;
  onCreateInstallmentPlan?: (input: { productId: number; companyId: number; downPaymentPercent: number; installmentsCount: number; installmentPercentExtra: number }) => { ok: boolean; planId?: number; error?: string };
  onToggleInstallmentPlan?: (planId: number, active: boolean) => void;
  onRecordManualInstallmentPayment?: (input: {
    installmentOrderId: number;
    amount: number;
    paymentIndex: number;
    transactionId?: string;
    receiptImage?: string;
    note?: string;
  }) => { ok: boolean; error?: string } | void;
  onUpdateInstallmentOrderStatus?: (orderId: number, status: InstallmentOrderStatus) => void;
  onCreateLiveStream?: (input: { companyId: number; title: string; description?: string; productIds: number[]; scheduledAt?: string }) => { ok: boolean; streamId?: number; streamKey?: string; error?: string };
  onStartLiveStream?: (streamId: number) => void;
  onEndLiveStream?: (streamId: number) => void;
  onAddLiveComment?: (streamId: number, input: { customerName: string; customerPhone?: string; message: string; type?: LiveCommentType; productId?: number }) => void;
  onCompleteOfferSale?: (offerId: number, paymentMethod?: string, transactionId?: string) => { ok: boolean; error?: string };
  onRecordSmartSale?: (input: {
    companyId: number;
    productId: number;
    quantity: number;
    unitPrice: number;
    customerName: string;
    customerPhone: string;
    customerAddress?: string;
    paymentMethod: string;
    transactionId?: string;
    note?: string;
  }) => { ok: boolean; orderId?: number; orderNumber?: string; error?: string };
  currentUser?: any;
}

const OFFER_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Inasubiri', cls: 'bg-amber-100 text-amber-800 border border-amber-200' },
  countered: { label: 'Mpango Mpya', cls: 'bg-blue-100 text-blue-800 border border-blue-200' },
  accepted: { label: 'Imekubaliwa', cls: 'bg-green-100 text-green-800 border border-green-200' },
  rejected: { label: 'Imekataliwa', cls: 'bg-red-100 text-red-800 border border-red-200' },
  paid: { label: 'Imelipwa', cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  expired: { label: 'Imekwisha', cls: 'bg-gray-100 text-gray-600 border border-gray-200' }
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

const QUICK_REPLIES = [
  'Habari! Ndio, bidhaa bado ipo ghalani.',
  'Tunaweza kufanya punguzo ukinunua sasa.',
  'Usafiri unapatikana hadi ulipo kupitia Bodaboda au Basi.',
  'Tafadhali tupigie simu au weka ofa kupitia Piga Bei.',
  'Asante kwa kuwasiliana nasi!'
];

export default function SellerPhase2CPanel({
  currentUser,
  company, offers, offerMessages, products = [], groupDeals, groupDealParticipants, installmentPlans,
  installmentOrders, installmentPayments, deliveries, deliveryUpdates, liveStreams,
  liveComments, loyaltyCustomers, whatsappConversations, translate: t,
  onDecideOffer, onCounterOffer, onRejectOffer, onAssignDeliveryRider, onUpdateDeliveryStatus,
  chatConversations = [], chatMessages = [], chatHandlers,
  onCreateGroupDeal, onVerifyParticipantPayment, onCloseGroupDeal,
  onCreateInstallmentPlan, onToggleInstallmentPlan, onRecordManualInstallmentPayment, onUpdateInstallmentOrderStatus,
  onCreateLiveStream, onStartLiveStream, onEndLiveStream, onAddLiveComment,
  onCompleteOfferSale, onRecordSmartSale
}: SellerPhase2CPanelProps) {
  const companyId = company?.id || 0;
  const isAdmin = Boolean(
    currentUser?.role === 'Admin' ||
    currentUser?.role === 'Super Admin' ||
    currentUser?.role === 'admin' ||
    currentUser?.role === 'superadmin' ||
    currentUser?.isAdmin ||
    !currentUser
  );
  const [tab, setTab] = useState('offers');
  const [copied, setCopied] = useState<string | null>(null);

  // Offers state
  const [offerFilter, setOfferFilter] = useState<'all' | 'pending' | 'countered' | 'accepted' | 'paid' | 'rejected'>('all');
  const [counterFor, setCounterFor] = useState<number | null>(null);
  const [counterPrice, setCounterPrice] = useState('');
  const [counterMsg, setCounterMsg] = useState('');
  const [rejectFor, setRejectFor] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [previewReceipt, setPreviewReceipt] = useState<string | null>(null);

  // Top-level rider state for delivery assignment (avoids React Hook inside renderDeliveries violation)
  const [riders, setRiders] = useState<Record<number, { name: string; phone: string }>>({});

  // Chat state
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
  const [chatDraft, setChatDraft] = useState('');
  const [chatSearch, setChatSearch] = useState('');
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // Creation Modals
  const [quickSaleModal, setQuickSaleModal] = useState(false);
  const [quickSaleProdId, setQuickSaleProdId] = useState<number>(products[0]?.id || 0);
  const [quickSaleQty, setQuickSaleQty] = useState('1');
  const [quickSalePrice, setQuickSalePrice] = useState('');
  const [quickSaleCustName, setQuickSaleCustName] = useState('');
  const [quickSaleCustPhone, setQuickSaleCustPhone] = useState('');
  const [quickSaleMethod, setQuickSaleMethod] = useState('cash');
  const [quickSaleTxId, setQuickSaleTxId] = useState('');
  const [quickSaleNote, setQuickSaleNote] = useState('');
  const [quickSaleMsg, setQuickSaleMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [dealModal, setDealModal] = useState(false);
  const [dealProductId, setDealProductId] = useState<number>(products[0]?.id || 0);
  const [dealPrice, setDealPrice] = useState('');
  const [dealMinBuyers, setDealMinBuyers] = useState('3');
  const [dealHours, setDealHours] = useState('48');
  const [dealError, setDealError] = useState('');
  const [dealFilter, setDealFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');

  const [installmentModal, setInstallmentModal] = useState(false);
  const [instProductId, setInstProductId] = useState<number>(products[0]?.id || 0);
  const [instDownPercent, setInstDownPercent] = useState('30');
  const [instCount, setInstCount] = useState('3');
  const [instExtraPercent, setInstExtraPercent] = useState('5');
  const [instError, setInstError] = useState('');
  const [installmentFilter, setInstallmentFilter] = useState<'all' | 'active' | 'completed' | 'pending_down' | 'defaulted'>('all');

  // Manual Installment Payment Recording Modal
  const [manualPayModal, setManualPayModal] = useState<{
    order: InstallmentOrder;
    paymentIndex: number;
    suggestedAmount: number;
  } | null>(null);
  const [manualPayAmount, setManualPayAmount] = useState('');
  const [manualPayTxId, setManualPayTxId] = useState('');
  const [manualPayReceipt, setManualPayReceipt] = useState('');
  const [manualPayNote, setManualPayNote] = useState('');
  const [manualPaySubmitting, setManualPaySubmitting] = useState(false);
  const [manualPayError, setManualPayError] = useState('');
  const [scheduleModalOrder, setScheduleModalOrder] = useState<InstallmentOrder | null>(null);

  // Live Stream state
  const [streamModal, setStreamModal] = useState(false);
  const [streamTitle, setStreamTitle] = useState('');
  const [streamDesc, setStreamDesc] = useState('');
  const [streamProductId, setStreamProductId] = useState<number>(products[0]?.id || 0);
  const [streamError, setStreamError] = useState('');
  const [liveCommentDrafts, setLiveCommentDrafts] = useState<Record<number, string>>({});

  // Filtered collections for this seller
  const myOffers = useMemo(() => offers.filter(o => sameId(o.companyId, companyId)), [offers, companyId]);
  const myDeals = useMemo(() => groupDeals.filter(g => sameId(g.companyId, companyId)), [groupDeals, companyId]);
  const myPlans = useMemo(() => installmentPlans.filter(p => sameId(p.companyId, companyId)), [installmentPlans, companyId]);
  const myInstallments = useMemo(() => installmentOrders.filter(o => sameId(o.companyId, companyId)), [installmentOrders, companyId]);
  const myDeliveries = useMemo(() => deliveries.filter(d => sameId(d.companyId, companyId)), [deliveries, companyId]);
  const myStreams = useMemo(() => liveStreams.filter(s => sameId(s.companyId, companyId)), [liveStreams, companyId]);

  // Seller's chat conversations with buyers
  const myChats = useMemo(() => {
    let list = chatConversations.filter(c => sameId(c.companyId, companyId));
    if (chatSearch.trim()) {
      const q = chatSearch.toLowerCase();
      list = list.filter(c =>
        (c.buyerName || '').toLowerCase().includes(q) ||
        (c.buyerPhone || '').includes(q) ||
        (c.lastMessage || '').toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => (b.lastMessageAt || '').localeCompare(a.lastMessageAt || ''));
  }, [chatConversations, companyId, chatSearch]);

  const totalUnreadChats = useMemo(
    () => chatConversations.filter(c => sameId(c.companyId, companyId)).reduce((sum, c) => sum + (c.unreadCompany || 0), 0),
    [chatConversations, companyId]
  );

  const activeChat = useMemo(() => myChats.find(c => c.id === selectedChatId) || myChats[0] || null, [myChats, selectedChatId]);
  const activeChatMessages = useMemo(
    () => activeChat ? chatMessages.filter(m => m.conversationId === activeChat.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : [],
    [chatMessages, activeChat]
  );

  useEffect(() => {
    if (activeChat && activeChat.unreadCompany > 0 && chatHandlers?.onMarkRead) {
      chatHandlers.onMarkRead(activeChat.id);
    }
  }, [activeChat, chatHandlers]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChatMessages.length, activeChat?.id]);

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const handleSendChat = (textToSend?: string) => {
    const text = (textToSend || chatDraft).trim();
    if (!text || !activeChat || !chatHandlers?.onSend) return;
    chatHandlers.onSend(activeChat.id, { text, messageType: 'text' });
    setChatDraft('');
  };

  const tabs = [
    { id: 'offers', label: t('Piga Bei'), icon: HandCoins, count: myOffers.filter(o => o.status === 'pending' || o.status === 'countered').length },
    { id: 'chat', label: t('Ask Seller (Chat)'), icon: MessageCircle, count: totalUnreadChats, alert: totalUnreadChats > 0 },
    { id: 'deals', label: t('Nunua Pamoja'), icon: Users, count: myDeals.length },
    { id: 'installments', label: t('Lipa Pole Pole'), icon: CalendarClock, count: myInstallments.length },
    { id: 'deliveries', label: t('Bodaboda'), icon: Bike, count: myDeliveries.filter(d => d.status !== 'delivered' && d.status !== 'cancelled').length },
    { id: 'live', label: t('Live Shopping'), icon: Video, count: myStreams.length },
    { id: 'loyalty', label: t('Loyalty'), icon: Gift, count: loyaltyCustomers.length },
    { id: 'whatsapp', label: t('WhatsApp Bot'), icon: MessageSquare, count: whatsappConversations.length }
  ];

  // ================= 1. OFFERS (Piga Bei) =================
  const filteredOffers = useMemo(() => {
    if (offerFilter === 'all') return myOffers;
    return myOffers.filter(o => o.status === offerFilter);
  }, [myOffers, offerFilter]);

  const renderOffers = () => (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
        {[
          { key: 'all', label: `${t('Zote')} (${myOffers.length})` },
          { key: 'pending', label: `${t('Zinazosubiri')} (${myOffers.filter(o => o.status === 'pending').length})` },
          { key: 'countered', label: `${t('Mpango Mpya')} (${myOffers.filter(o => o.status === 'countered').length})` },
          { key: 'accepted', label: `${t('Zilizokubaliwa')} (${myOffers.filter(o => o.status === 'accepted').length})` },
          { key: 'paid', label: `${t('Zilizolipwa')} (${myOffers.filter(o => o.status === 'paid').length})` },
          { key: 'rejected', label: `${t('Zilizokataliwa')} (${myOffers.filter(o => o.status === 'rejected').length})` }
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setOfferFilter(f.key as any)}
            className={`px-3 py-1.5 rounded-full font-bold transition whitespace-nowrap cursor-pointer text-[11px] ${
              offerFilter === f.key ? 'bg-brand text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filteredOffers.length === 0 && (
        <div className="py-12 text-center text-gray-400 font-medium text-xs bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <HandCoins className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <div className="font-bold text-gray-600">{t('Hakuna ofa katika kipengele hiki.')}</div>
          <div className="text-[11px] text-gray-400 mt-1">{t('Wateja wakiweka "Piga Bei" kwenye bidhaa zako, zitaonekana hapa papo hapo.')}</div>
        </div>
      )}

      <div className="space-y-3">
        {filteredOffers.map(offer => {
          const meta = OFFER_STATUS[offer.status] || OFFER_STATUS.pending;
          const msgs = offerMessages.filter(m => m.offerId === offer.id);
          const counter = msgs.filter(m => m.senderType === 'seller' && m.price !== undefined).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
          const product = products.find(p => p.id === offer.productId);
          const discountPct = Math.round(((offer.originalPrice - offer.offeredPrice) / offer.originalPrice) * 100);

          return (
            <div key={offer.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 hover:border-gray-300 transition">
              <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center text-white text-base font-black shadow-inner">
                    {product?.image ? <img src={product.image} alt="" className="w-full h-full object-cover" /> : (product?.name || '?').charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-gray-900">{offer.customerName}</span>
                      <span className="text-[11px] text-gray-500 font-semibold">{offer.customerPhone}</span>
                      <div className="flex items-center gap-1 ml-1">
                        <a
                          href={`tel:${offer.customerPhone}`}
                          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          title="Piga Simu"
                        >
                          <Phone className="w-3 h-3" /> Piga
                        </a>
                        <a
                          href={`https://wa.me/${offer.customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`Habari ${offer.customerName}, kuhusu ofa yako ya ${product?.name || 'bidhaa'}`)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-green-50 text-green-700 hover:bg-green-100"
                          title="Wasiliana WhatsApp"
                        >
                          <MessageCircle className="w-3 h-3" /> WhatsApp
                        </a>
                      </div>
                    </div>
                    <div className="text-[11px] text-gray-600 font-semibold mt-1 truncate">
                      {product ? product.name : `${t('Bidhaa')} #${offer.productId}`} · <span className="text-gray-400">{new Date(offer.createdAt).toLocaleString()}</span>
                    </div>
                    {offer.buyerMessage && (
                      <div className="mt-1.5 text-[11px] text-gray-700 bg-amber-50/70 border border-amber-200/60 rounded-lg px-2.5 py-1 inline-block">
                        💬 <span className="italic">{offer.buyerMessage}</span>
                      </div>
                    )}
                  </div>
                </div>
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-full shrink-0 ${meta.cls}`}>{meta.label}</span>
              </div>

              {/* Price comparison */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-gray-100">
                <div className="bg-gray-50 rounded-xl p-2.5">
                  <div className="text-[9px] text-gray-400 font-bold uppercase">{t('Bei Halisi')}</div>
                  <div className="text-xs font-bold text-gray-500 line-through mt-0.5">{TZS(offer.originalPrice)}</div>
                </div>
                <div className="bg-amber-50/80 rounded-xl p-2.5 border border-amber-200/50">
                  <div className="text-[9px] text-amber-700 font-bold uppercase">{t('Ofa ya Mteja')}</div>
                  <div className="text-sm font-black text-amber-900 mt-0.5">
                    {TZS(offer.offeredPrice)} <span className="text-[10px] font-bold text-orange-600">(-{discountPct}%)</span>
                  </div>
                </div>
                {(counter || offer.counterPrice) && (
                  <div className="bg-blue-50/80 rounded-xl p-2.5 border border-blue-200/50">
                    <div className="text-[9px] text-blue-700 font-bold uppercase">{t('Bei yako ya Mazungumzo')}</div>
                    <div className="text-sm font-black text-blue-900 mt-0.5">{TZS(offer.counterPrice ?? counter!.price!)}</div>
                  </div>
                )}
                {offer.status === 'accepted' && (
                  <div className="bg-emerald-50 rounded-xl p-2.5 border border-emerald-200/50">
                    <div className="text-[9px] text-emerald-700 font-bold uppercase">{t('Bei ya Makubaliano')}</div>
                    <div className="text-sm font-black text-emerald-900 mt-0.5">{TZS(offer.finalPrice ?? offer.counterPrice ?? offer.offeredPrice)}</div>
                  </div>
                )}
              </div>

              {/* Seller Feedback Message */}
              {offer.sellerMessage && ['rejected', 'countered', 'accepted'].includes(offer.status) && (
                <div className="mt-2.5 text-[11px] text-gray-600 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200 flex items-start gap-1.5">
                  <span className="font-bold text-gray-800">💬 {t('Jibu lako')}:</span> {offer.sellerMessage}
                </div>
              )}

              {/* Action buttons if Pending */}
              {offer.status === 'pending' && (
                <div className="space-y-2 mt-3 pt-3 border-t border-gray-100">
                  {isAdmin ? (
                    <div className="flex gap-2 flex-wrap items-center">
                      <button
                        onClick={() => onDecideOffer(offer.id, true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-green-600 text-white rounded-xl text-xs font-black hover:bg-green-700 cursor-pointer shadow-sm active:scale-95 transition"
                      >
                        <CheckCircle2 className="w-4 h-4" /> {t('Kubali Ofa Hii')} ({TZS(offer.offeredPrice)})
                      </button>
                      <button
                        onClick={() => {
                          setCounterFor(counterFor === offer.id ? null : offer.id);
                          setCounterPrice(String(Math.round(offer.offeredPrice * 1.15)));
                          setCounterMsg('');
                          setRejectFor(null);
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 cursor-pointer shadow-sm active:scale-95 transition"
                      >
                        <Repeat className="w-4 h-4" /> {t('Toa Bei Nyingine (Counter)')}
                      </button>
                      <button
                        onClick={() => {
                          setRejectFor(rejectFor === offer.id ? null : offer.id);
                          setRejectReason('');
                          setCounterFor(null);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-xl text-xs font-black cursor-pointer border border-red-200 transition"
                      >
                        <XCircle className="w-4 h-4" /> {t('Kataa')}
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs font-semibold text-gray-400 italic bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-xl inline-flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-gray-400" />
                      {t('Uamuzi wa ofa unaruhusiwa kwa Admin pekee (Read-only).')}
                    </div>
                  )}

                  {counterFor === offer.id && (
                    <div className="rounded-xl border border-blue-200 p-3.5 space-y-2.5 bg-blue-50/50 mt-2">
                      <div className="text-xs font-bold text-blue-900">{t('Weka Bei Mpya ya Kumtumia Mteja')}:</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          value={counterPrice}
                          onChange={e => setCounterPrice(e.target.value.replace(/[^\d]/g, ''))}
                          placeholder={t('Bei yako (TZS)')}
                          type="number"
                          className="w-full px-3 py-2 border border-blue-300 rounded-lg text-xs font-bold bg-white outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          value={counterMsg}
                          onChange={e => setCounterMsg(e.target.value)}
                          placeholder={t('Ujumbe (mfano: Hii ndio bei yetu ya chini kabisa)')}
                          maxLength={300}
                          className="w-full px-3 py-2 border border-blue-300 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <button
                        onClick={() => {
                          const cp = Number(counterPrice);
                          if (cp > 0 && onCounterOffer) {
                            onCounterOffer(offer.id, cp, counterMsg.trim() || undefined);
                            setCounterFor(null);
                            setCounterPrice('');
                            setCounterMsg('');
                          }
                        }}
                        disabled={!Number(counterPrice)}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-xs font-black hover:bg-blue-700 cursor-pointer disabled:opacity-40 transition shadow-sm"
                      >
                        <Send className="w-3.5 h-3.5" /> {t('Tuma Bei Mpya kwa Mteja')}
                      </button>
                    </div>
                  )}

                  {rejectFor === offer.id && (
                    <div className="rounded-xl border border-red-200 p-3.5 space-y-2.5 bg-red-50/50 mt-2">
                      <div className="text-xs font-bold text-red-900">{t('Sababu ya Kukataa Ofa Hii')}:</div>
                      <input
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        placeholder={t('Mfano: Bei ipo chini ya gharama ya bidhaa au mzigo umepungua')}
                        maxLength={300}
                        className="w-full px-3 py-2 border border-red-300 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-red-500"
                      />
                      <button
                        onClick={() => {
                          if (rejectReason.trim() && onRejectOffer) {
                            onRejectOffer(offer.id, rejectReason.trim());
                            setRejectFor(null);
                            setRejectReason('');
                          }
                        }}
                        disabled={!rejectReason.trim()}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg text-xs font-black hover:bg-red-700 cursor-pointer disabled:opacity-40 transition shadow-sm"
                      >
                        <XCircle className="w-3.5 h-3.5" /> {t('Thibitisha Kukataa')}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Status details when Countered */}
              {offer.status === 'countered' && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs flex-wrap gap-2">
                  <span className="font-bold text-blue-700 inline-flex items-center gap-1.5">
                    <Clock3 className="w-3.5 h-3.5 text-blue-500" /> {t('Inasubiri mteja ajibu pendekezo lako la TZS')} {(offer.counterPrice || 0).toLocaleString()}.
                  </span>
                  <button
                    onClick={() => {
                      const text = `Habari ${offer.customerName}, kuhusu ofa yako ya bidhaa #${offer.productId}, tumekupatia punguzo la TZS ${(offer.counterPrice || 0).toLocaleString()}. Unaweza kuikubali kwenye akaunti yako.`;
                      navigator.clipboard?.writeText(text);
                      setCopied(`offer-${offer.id}`);
                      setTimeout(() => setCopied(null), 1500);
                    }}
                    className="text-[11px] font-bold text-blue-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" /> {copied === `offer-${offer.id}` ? t('Imenakiliwa!') : t('Nakili ujumbe wa SMS/WhatsApp')}
                  </button>
                </div>
              )}

              {/* Status details when Accepted */}
              {offer.status === 'accepted' && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs flex-wrap gap-2">
                  <span className="font-bold text-emerald-700 inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> {t('Ofa imekubaliwa! Unaweza kuthibitisha malipo hapa au kusubiri mteja alipe mtandaoni:')}
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {isAdmin && onCompleteOfferSale && (
                      <button
                        onClick={() => {
                          const res = onCompleteOfferSale(offer.id);
                          if (res?.ok) {
                            alert(t('Malipo yamethibitishwa na mauzo yameingizwa kiotomatiki kwenye Marketplace Orders na Ripoti ya Kifedha (P&L)!'));
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[11px] font-black hover:bg-emerald-700 cursor-pointer shadow-sm active:scale-95 transition"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> ⚡ {t('Thibitisha Malipo Dukani (Kamilisha Mauzo)')}
                      </button>
                    )}
                    <a
                      href={`https://wa.me/${offer.customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`Habari ${offer.customerName}, tumekubali ofa yako ya TZS ${(offer.finalPrice || offer.offeredPrice).toLocaleString()}! Unaweza kukamilisha malipo yako sasa.`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg cursor-pointer"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-600" /> Mjulishe Mteja
                    </a>
                  </div>
                </div>
              )}

              {/* Status details when Paid */}
              {offer.status === 'paid' && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                  <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                    <span className="font-bold text-emerald-700 inline-flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" /> {t('Imelipwa Kamili!')} {offer.paymentReference && `(Ref: ${offer.paymentReference})`}
                    </span>
                    <button
                      onClick={() => setTab('deliveries')}
                      className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer"
                    >
                      <Bike className="w-3.5 h-3.5" /> {t('Panga Bodaboda Delivery')}
                    </button>
                  </div>

                  {/* Customer Delivery Records */}
                  <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 text-xs space-y-1.5">
                    <div className="font-black text-emerald-900 flex items-center gap-1.5 text-[11px]">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" /> {t('Anwani ya Mteja (Delivery Destination)')}:
                    </div>
                    <div className="text-gray-700 font-semibold pl-5 text-[11px]">
                      {[offer.customerRegion && `Mkoa: ${offer.customerRegion}`, offer.customerDistrict && `Wilaya: ${offer.customerDistrict}`, offer.customerWard && `Kata: ${offer.customerWard}`, offer.customerStreet && `Mtaa: ${offer.customerStreet}`].filter(Boolean).join(' · ') || 'Mahali hakukuwekwa (Mteja atapigiwa simu)'}
                    </div>

                    <div className="flex items-center gap-3 pt-1 border-t border-emerald-200/50 flex-wrap">
                      {offer.transactionId && (
                        <div className="text-[11px] text-gray-700 font-bold">
                          Namba ya Muamala: <span className="font-mono text-emerald-700 bg-white px-1.5 py-0.5 rounded border border-emerald-200">{offer.transactionId}</span>
                        </div>
                      )}
                      {offer.receiptImage && (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-gray-600">Risiti ya Malipo:</span>
                          <button
                            type="button"
                            onClick={() => setPreviewReceipt(offer.receiptImage!)}
                            className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-300 hover:bg-emerald-50 cursor-pointer shadow-2xs"
                          >
                            <img src={offer.receiptImage} alt="Receipt thumbnail" className="w-5 h-5 rounded object-cover" />
                            Tazama Risiti
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ================= 2. ASK SELLER (CHAT / SOGA ZA WATEJA) =================
  const renderChat = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs font-black text-gray-900 flex items-center gap-1.5">
            <MessageCircle className="w-4 h-4 text-brand" /> {t('Mawasiliano na Wateja (Ask Seller Live Chat)')}
          </div>
          <div className="text-[11px] text-gray-500 font-semibold mt-0.5">
            {t('Jibu maswali ya wateja wanaoulizia bidhaa zako papo kwa hapo ili kuongeza mauzo.')}
          </div>
        </div>
        <div className="relative w-full sm:w-64">
          <input
            value={chatSearch}
            onChange={e => setChatSearch(e.target.value)}
            placeholder={t('Tafuta mteja au ujumbe...')}
            className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 min-h-[460px] bg-gray-50/70 p-2 rounded-2xl border border-gray-200">
        {/* Conversation list */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col md:col-span-1 shadow-sm max-h-[500px]">
          <div className="p-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between text-xs font-bold text-gray-700">
            <span>{t('Orodha ya Mazungumzo')} ({myChats.length})</span>
            {totalUnreadChats > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black">{totalUnreadChats} {t('vipya')}</span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {myChats.length === 0 && (
              <div className="p-6 text-center text-xs text-gray-400">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <div className="font-bold">{t('Hakuna mazungumzo bado.')}</div>
                <div className="text-[10px] text-gray-400 mt-1">{t('Mteja akibofya "Uliza Muuzaji (Chat)" kwenye bidhaa yako, itaonekana hapa.')}</div>
              </div>
            )}
            {myChats.map(c => {
              const isSelected = activeChat?.id === c.id;
              const prod = products.find(p => p.id === c.productId);
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedChatId(c.id)}
                  className={`w-full text-left p-3 transition cursor-pointer flex items-start gap-2.5 ${
                    isSelected ? 'bg-amber-50/70 border-l-4 border-l-brand' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-indigo-600 flex items-center justify-center text-white text-xs font-black shrink-0">
                    {c.buyerName ? c.buyerName.charAt(0).toUpperCase() : 'M'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-gray-900 truncate">{c.buyerName || 'Mteja'}</span>
                      <span className="text-[9px] text-gray-400 font-semibold shrink-0">{c.lastMessageAt ? timeAgo(c.lastMessageAt) : ''}</span>
                    </div>
                    <div className="text-[10px] text-gray-500 font-semibold">{c.buyerPhone}</div>
                    {prod && <div className="text-[9px] text-indigo-600 font-bold truncate mt-0.5">🛍 {prod.name}</div>}
                    <div className="flex items-center justify-between gap-1 mt-1">
                      <span className="text-[11px] text-gray-600 truncate">{c.lastMessage || 'Hakuna ujumbe bado'}</span>
                      {c.unreadCompany > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-white text-[9px] font-black flex items-center justify-center shrink-0">
                          {c.unreadCompany}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active chat window */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col md:col-span-2 shadow-sm min-h-[460px]">
          {activeChat ? (
            <>
              {/* Header */}
              <div className="p-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center text-xs font-black">
                    {(activeChat.buyerName || 'M').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-black text-gray-900 truncate">{activeChat.buyerName}</div>
                    <div className="text-[10px] text-gray-500 font-semibold flex items-center gap-2">
                      <span>{activeChat.buyerPhone}</span>
                      <a href={`tel:${activeChat.buyerPhone}`} className="text-emerald-600 hover:underline font-bold">☎ Piga</a>
                      <a
                        href={`https://wa.me/${activeChat.buyerPhone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-green-600 hover:underline font-bold"
                      >
                        WhatsApp
                      </a>
                    </div>
                  </div>
                </div>

                {activeChat.productId && (() => {
                  const p = products.find(prod => prod.id === activeChat.productId);
                  if (!p) return null;
                  return (
                    <div className="flex items-center gap-2 bg-white px-2.5 py-1 rounded-lg border border-gray-200 text-[10px]">
                      {p.image && <img src={p.image} alt="" className="w-5 h-5 rounded object-cover" />}
                      <span className="font-bold text-gray-800 truncate max-w-[140px]">{p.name}</span>
                      <span className="font-black text-brand">{TZS(p.price)}</span>
                    </div>
                  );
                })()}
              </div>

              {/* Message thread */}
              <div className="flex-1 p-3 overflow-y-auto space-y-2.5 bg-slate-50/50 max-h-[340px]">
                {activeChatMessages.length === 0 && (
                  <div className="py-12 text-center text-xs text-gray-400">
                    {t('Hakuna ujumbe katika mazungumzo haya bado. Msalimie mteja kuanza mazungumzo!')}
                  </div>
                )}
                {activeChatMessages.map(m => {
                  const isSeller = m.senderType === 'company' || m.senderType === 'admin';
                  return (
                    <div key={m.id} className={`flex flex-col ${isSeller ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-center gap-1 text-[9px] text-gray-400 font-semibold mb-0.5 px-1">
                        <span>{isSeller ? `${t('Wewe')} (${m.senderName})` : m.senderName}</span>
                        <span>· {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div
                        className={`rounded-2xl px-3.5 py-2 max-w-[85%] text-xs shadow-sm ${
                          isSeller
                            ? 'bg-brand text-white rounded-br-xs'
                            : 'bg-white text-gray-800 border border-gray-200 rounded-bl-xs'
                        }`}
                      >
                        {m.messageType === 'product' && m.productId && (() => {
                          const pr = products.find(x => x.id === m.productId);
                          return (
                            <div className="p-2 mb-1.5 bg-black/10 rounded-xl flex items-center gap-2">
                              {pr?.image && <img src={pr.image} alt="" className="w-8 h-8 rounded object-cover" />}
                              <div>
                                <div className="font-bold text-[11px]">{pr?.name || `#${m.productId}`}</div>
                                {pr && <div className="text-[10px] font-black">{TZS(pr.price)}</div>}
                              </div>
                            </div>
                          );
                        })()}
                        {m.imageData && (
                          <img src={m.imageData} alt="" className="max-w-full rounded-lg mb-1.5 max-h-48 object-cover" />
                        )}
                        <div className="whitespace-pre-wrap leading-relaxed">{m.message}</div>
                        {m.translatedMessage && (
                          <div className={`mt-1 pt-1 text-[10px] border-t opacity-80 italic ${isSeller ? 'border-white/20' : 'border-gray-200'}`}>
                            🔤 {m.translatedMessage}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={chatBottomRef} />
              </div>

              {/* Quick reply bar */}
              <div className="p-2 bg-gray-50 border-t border-gray-200 flex gap-1.5 overflow-x-auto no-scrollbar">
                {QUICK_REPLIES.map((qr, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendChat(qr)}
                    className="px-2.5 py-1 bg-white hover:bg-gray-100 border border-gray-200 rounded-full text-[10px] font-semibold text-gray-700 whitespace-nowrap cursor-pointer transition shrink-0"
                  >
                    + {qr}
                  </button>
                ))}
              </div>

              {/* Input */}
              <div className="p-2.5 bg-white border-t border-gray-200 flex items-center gap-2">
                <input
                  value={chatDraft}
                  onChange={e => setChatDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                  placeholder={t('Andika ujumbe kwa mteja...')}
                  className="flex-1 px-3 py-2 text-xs border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-brand"
                />
                <button
                  onClick={() => handleSendChat()}
                  disabled={!chatDraft.trim()}
                  className="px-4 py-2 bg-brand text-white rounded-xl text-xs font-black hover:bg-brand/90 cursor-pointer disabled:opacity-40 transition shadow-sm inline-flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> {t('Tuma')}
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-gray-400">
              <div>
                <MessageCircle className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <div className="font-bold text-gray-600 text-xs">{t('Chagua mazungumzo kutoka upande wa kushoto')}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ================= 3. NUNUA PAMOJA (Group Deals) =================
  const renderDeals = () => {
    const displayedDeals = dealFilter === 'all'
      ? myDeals
      : myDeals.filter(d => d.status === dealFilter);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xs font-black text-gray-900">{t('Group Deals (Nunua Pamoja)')}</div>
            <div className="text-[11px] text-gray-500">{t('Ruhusu wateja wajiunge pamoja kununua kwa punguzo. Hakiki malipo, kamilisha deal au ghairi.')}</div>
          </div>
          {isAdmin ? (
            <button
              onClick={() => { setDealError(''); setDealModal(true); }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand text-white rounded-xl text-xs font-black hover:bg-brand/90 cursor-pointer shadow-sm transition"
            >
              <Plus className="w-3.5 h-3.5" /> {t('Tengeneza Group Deal Mpya')}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-500 rounded-xl text-xs font-bold border border-gray-200">
              <ShieldCheck className="w-3.5 h-3.5 text-gray-400" /> {t('Admin pekee ndiye anayetengeneza Group Deals')}
            </span>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'all', label: `Zote (${myDeals.length})` },
            { id: 'active', label: `Zinazoendelea (${myDeals.filter(d => d.status === 'active').length})` },
            { id: 'completed', label: `Zilizokamilika (${myDeals.filter(d => d.status === 'completed').length})` },
            { id: 'cancelled', label: `Zilizoghairiwa (${myDeals.filter(d => d.status === 'cancelled').length})` }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setDealFilter(f.id as any)}
              className={`px-3 py-1.5 rounded-xl font-bold transition text-[11px] shrink-0 cursor-pointer ${
                dealFilter === f.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {displayedDeals.length === 0 && (
          <div className="py-12 text-center text-gray-400 font-medium text-xs bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <div className="font-bold text-gray-600">{t('Hakuna group deals kwenye orodha hii.')}</div>
            <div className="text-[11px] text-gray-400 mt-1">{t('Bofya "Tengeneza Group Deal Mpya" hapo juu ili kuanzisha kampeni.')}</div>
          </div>
        )}

        {displayedDeals.map(deal => {
          const product = products.find(p => p.id === deal.productId);
          const participants = groupDealParticipants.filter(p => p.groupDealId === deal.id);
          const paidParticipants = participants.filter(p => p.status === 'paid');
          const paid = paidParticipants.length;

          // Crowdfund Split-Deduct Calculations
          const targetTotal = deal.targetTotalAmount || (product?.price || deal.soloPrice || deal.groupPrice);
          const totalPaid = deal.totalPaidAmount !== undefined && deal.totalPaidAmount !== null
            ? deal.totalPaidAmount
            : paidParticipants.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
          const remainingAmount = Math.max(0, targetTotal - totalPaid);
          const progress = Math.min(100, Math.round((totalPaid / Math.max(1, targetTotal)) * 100));
          const isDone = remainingAmount <= 0 || deal.isReadyForDelivery || deal.status === 'completed';

          return (
            <div key={deal.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 hover:border-gray-300 transition space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-indigo-50 flex items-center justify-center text-indigo-700 font-black">
                    {product?.image ? <img src={product.image} alt="" className="w-full h-full object-cover" /> : '👥'}
                  </div>
                  <div>
                    <div className="text-xs font-black text-gray-900">{product ? product.name : `${t('Bidhaa')} #${deal.productId}`}</div>
                    <div className="text-[11px] text-gray-600 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900">{deal.title || `Kikundi #${deal.shareCode}`}</span>
                      {deal.creatorName && <span className="text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded font-bold">Kiongozi: {deal.creatorName}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isDone ? 'bg-emerald-100 text-emerald-800 font-black border border-emerald-300' :
                    deal.status === 'active' ? 'bg-indigo-100 text-indigo-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {isDone ? t('✓ TAYARI KUSAFIRISHWA (100% Imelipwa)') : deal.status === 'active' ? t('● Inakusanya Michango') : deal.status}
                  </span>
                  <button
                    onClick={() => copyCode(deal.shareCode)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-brand hover:underline cursor-pointer bg-amber-50 px-2 py-1 rounded-lg"
                    title="Nakili Share Code"
                  >
                    {copied === deal.shareCode ? <span className="text-green-600">{t('Imenakiliwa!')}</span> : <><Copy className="w-3 h-3" /> {deal.shareCode}</>}
                  </button>
                </div>
              </div>

              {/* Financial Summary & Split-Deduct Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-[11px]">
                <div>
                  <span className="text-gray-500 text-[10px] uppercase font-bold block">{t('Bei Kamili ya Bidhaa')}</span>
                  <span className="font-black text-gray-900 text-xs">{TZS(targetTotal)}</span>
                </div>
                <div>
                  <span className="text-emerald-700 text-[10px] uppercase font-bold block">{t('Jumla Iliyolipwa')} ({progress}%)</span>
                  <span className="font-black text-emerald-600 text-xs">{TZS(totalPaid)}</span>
                </div>
                <div>
                  <span className={`text-[10px] uppercase font-bold block ${remainingAmount === 0 ? 'text-emerald-700' : 'text-amber-800'}`}>
                    {remainingAmount === 0 ? t('Deni Limemalizika') : t('Bado Kulipwa')}
                  </span>
                  <span className={`font-black text-xs ${remainingAmount === 0 ? 'text-emerald-700' : 'text-amber-600'}`}>
                    {remainingAmount === 0 ? '✓ 0 TZS (100%)' : TZS(remainingAmount)}
                  </span>
                </div>
              </div>

              {/* Progress and target */}
              <div>
                <div className="flex justify-between text-[11px] font-bold text-gray-600 mb-1">
                  <span>{paid} {t('wanunuzi wamechangia')}</span>
                  <span className={remainingAmount === 0 ? 'text-emerald-600 font-extrabold' : 'text-indigo-600 font-bold'}>
                    {progress}% {remainingAmount === 0 ? '· ✓ Tayari Kusafirishwa!' : `· Bado TZS ${remainingAmount.toLocaleString()}`}
                  </span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${isDone ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Deal Status Banner & Seller Controls */}
              {deal.status === 'active' && !isDone && (
                <div className="flex items-center justify-between gap-2 p-2.5 bg-indigo-50/70 border border-indigo-100 rounded-xl flex-wrap">
                  <div className="text-[11px] text-indigo-900 font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>{remainingAmount === 0 ? 'Kiasi kamili kimetimia! Deal imekamilika.' : `Bado TZS ${remainingAmount.toLocaleString()} ili bidhaa iwe tayari kusafirishwa.`}</span>
                  </div>
                  {isAdmin ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onCloseGroupDeal?.(deal.id, 'completed')}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-black cursor-pointer shadow-sm transition inline-flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" /> Kamilisha Deal Sasa
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('Una uhakika unataka kughairi kikundi hiki cha Nunua Pamoja?')) {
                            onCloseGroupDeal?.(deal.id, 'cancelled');
                          }
                        }}
                        className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-[11px] font-bold cursor-pointer transition inline-flex items-center gap-1"
                      >
                        <X className="w-3 h-3" /> Ghairi
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] text-gray-500 font-bold bg-white px-2 py-1 rounded border border-gray-200">
                      Usimamizi wa Deal: Wasimamizi Pekee
                    </span>
                  )}
                </div>
              )}

              {isDone && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-[11px] font-semibold space-y-1.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-black flex items-center gap-1.5 text-xs text-emerald-950">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      🎉 TAYARI KUSAFIRISHWA — Bei ya Bidhaa Imelipwa 100%!
                    </span>
                    {deal.deliveryTrackingCode && (
                      <span className="font-mono bg-white px-2 py-0.5 rounded border border-emerald-300 font-bold text-emerald-800">
                        {deal.deliveryTrackingCode}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-emerald-800">
                    <span className="font-bold">Mpokeaji:</span> {deal.deliveryRecipientName || deal.creatorName || 'Mteja'} · <span className="font-bold">Anwani:</span> {deal.deliveryAddress || 'Dar es Salaam'}
                  </div>
                </div>
              )}

              {/* Participants */}
              {participants.length > 0 && (
                <div className="pt-2 border-t border-gray-100 space-y-2">
                  <div className="text-[10px] font-black uppercase text-gray-400 tracking-wider flex items-center justify-between">
                    <span>{t('Washiriki wa Kikundi Hiki')} ({participants.length}):</span>
                    <span>{paid} waliolipia · Jumla: {TZS(totalPaid)}</span>
                  </div>
                  <div className="space-y-2">
                    {participants.map(p => {
                      const partDelivery = deliveries.find(d => d.customerPhone === p.customerPhone && (d.orderId === p.orderId || d.trackingCode.includes(`GRP-${deal.id}-${p.id}`)));
                      const cleanPhone = (p.customerPhone || '').replace(/[^0-9]/g, '');
                      const isPaid = p.status === 'paid';
                      const amtPaid = p.amountPaid || 0;
                      const sharePct = targetTotal > 0 ? Math.round((amtPaid / targetTotal) * 100) : 0;

                      return (
                        <div key={p.id} className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs space-y-2">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                              <span className="font-black text-gray-900">{p.customerName}</span>
                              <span className="text-gray-500 font-semibold ml-1.5 font-mono text-[11px]">· {p.customerPhone}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <a
                                href={`tel:${p.customerPhone}`}
                                className="px-2 py-0.5 bg-white border border-gray-200 hover:bg-gray-100 rounded text-[11px] font-bold text-gray-700 inline-flex items-center gap-1"
                                title="Piga Simu"
                              >
                                <Phone className="w-3 h-3 text-brand" /> Piga
                              </a>
                              <a
                                href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Habari ${p.customerName}, tunawasiliana kuhusu Nunua Pamoja #${deal.shareCode} ya ${product?.name || 'bidhaa'}.`)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded text-[11px] font-bold text-emerald-800 inline-flex items-center gap-1"
                                title="Fungua WhatsApp"
                              >
                                <MessageSquare className="w-3 h-3 text-emerald-600" /> WhatsApp
                              </a>
                              <span className={`font-black px-2 py-0.5 rounded text-[10px] ${
                                isPaid ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}>
                                {isPaid ? `✓ Amelipa (${TZS(amtPaid)}${sharePct > 0 ? ` · ${sharePct}%` : ''})` : t('Inasubiri Malipo')}
                              </span>
                            </div>
                          </div>

                          <div className="text-[11px] text-gray-600 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <span>{[p.customerRegion && `Mkoa: ${p.customerRegion}`, p.customerDistrict && `Wilaya: ${p.customerDistrict}`, p.customerWard && `Kata: ${p.customerWard}`, p.customerStreet && `Mtaa: ${p.customerStreet}`].filter(Boolean).join(' · ') || 'Mahali hakukuwekwa rasmi'}</span>
                          </div>

                          {/* Transaction and verification actions */}
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-200/60 text-[10px] flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                              {p.transactionId ? (
                                <span className="font-semibold text-gray-700 flex items-center gap-1">
                                  Muamala: <span className="font-mono text-emerald-800 font-bold bg-white px-1.5 py-0.5 rounded border border-gray-200">{p.transactionId}</span>
                                </span>
                              ) : (
                                <span className="text-gray-400 italic">Hakuna TxID</span>
                              )}
                              {p.receiptImage && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewReceipt(p.receiptImage!)}
                                  className="inline-flex items-center gap-1 font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200 hover:bg-indigo-50 cursor-pointer"
                                >
                                  <img src={p.receiptImage} alt="Receipt" className="w-4 h-4 rounded object-cover" />
                                  Tazama Risiti
                                </button>
                              )}
                              {partDelivery && (
                                <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-800 border border-sky-200 px-2 py-0.5 rounded font-bold">
                                  <Bike className="w-3 h-3 text-sky-600" /> Bodaboda: {partDelivery.trackingCode} ({STATUS_LABEL[partDelivery.status] || partDelivery.status})
                                </span>
                              )}
                            </div>

                            {p.status !== 'paid' && onVerifyParticipantPayment && (
                              isAdmin ? (
                                <button
                                  type="button"
                                  onClick={() => onVerifyParticipantPayment(p.id)}
                                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-black text-[11px] cursor-pointer shadow-sm transition inline-flex items-center gap-1"
                                >
                                  <CheckCheck className="w-3.5 h-3.5" /> Thibitisha Malipo
                                </button>
                              ) : (
                                <span className="text-[10px] text-gray-400 italic">Inasubiri uthibitisho wa Admin</span>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ================= 4. LIPA POLE POLE (Installments) =================
  const renderInstallments = () => {
    const displayedOrders = installmentFilter === 'all'
      ? myInstallments
      : myInstallments.filter(o => o.status === installmentFilter);

    return (
      <div className="space-y-6">
        {/* SECTION 1: Configured Installment Plans */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs font-black text-gray-900 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-sky-600" />
                {t('Mipango Yangu ya Lipa Pole Pole Iliyowekwa')} ({myPlans.length})
              </div>
              <div className="text-[11px] text-gray-500">
                {t('Bidhaa ulizoruhusu wateja kulipa kwa awamu. Washa au zima mpango wakati wowote.')}
              </div>
            </div>
            {isAdmin ? (
              <button
                onClick={() => { setInstError(''); setInstallmentModal(true); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-black cursor-pointer shadow-sm transition"
              >
                <Plus className="w-3.5 h-3.5" /> {t('Washa Lipa Pole Pole Mpya')}
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-500 rounded-xl text-xs font-bold border border-gray-200">
                <ShieldCheck className="w-3.5 h-3.5 text-gray-400" /> {t('Admin pekee ndiye anayewasha Lipa Pole Pole')}
              </span>
            )}
          </div>

          {myPlans.length === 0 ? (
            <div className="p-4 bg-sky-50/50 rounded-2xl border border-dashed border-sky-200 text-center text-xs text-sky-800">
              <CalendarClock className="w-6 h-6 mx-auto mb-1 text-sky-400" />
              <div className="font-bold">{t('Hujaweka mpango wowote wa Lipa Pole Pole bado.')}</div>
              <div className="text-[11px] text-sky-600 mt-0.5">{t('Bofya "Washa Lipa Pole Pole Mpya" ili kuchagua bidhaa na kupanga masharti.')}</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {myPlans.map(plan => {
                const prod = products.find(p => p.id === plan.productId);
                const isActive = plan.status === 'active';
                const downAmount = Math.round(plan.totalPrice * plan.downPaymentPercent / 100);
                const perInst = Math.round(((plan.totalPrice - downAmount) / plan.installmentsCount) * (1 + plan.installmentPercentExtra / 100));

                return (
                  <div key={plan.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-3.5 space-y-2.5 hover:border-gray-300 transition">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center font-bold text-gray-400 text-xs">
                          {prod?.image ? <img src={prod.image} alt="" className="w-full h-full object-cover" /> : '📦'}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-black text-gray-900 truncate">{prod?.name || `Bidhaa #${plan.productId}`}</div>
                          <div className="text-[11px] font-bold text-gray-500">{TZS(plan.totalPrice)}</div>
                        </div>
                      </div>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {isActive ? 'Inatumika' : 'Imezimwa'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 p-2 bg-gray-50 rounded-xl text-center text-[10px]">
                      <div>
                        <div className="text-gray-400 font-bold uppercase">Awali ({plan.downPaymentPercent}%)</div>
                        <div className="font-black text-gray-800">{TZS(downAmount)}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 font-bold uppercase">Awamu</div>
                        <div className="font-black text-sky-700">{plan.installmentsCount} × {TZS(perInst)}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 font-bold uppercase">Riba</div>
                        <div className="font-black text-gray-800">+{plan.installmentPercentExtra}%</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-xs">
                      <span className="text-[11px] text-gray-500 font-medium">Hali ya mpango:</span>
                      <button
                        type="button"
                        onClick={() => onToggleInstallmentPlan?.(plan.id, !isActive)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer transition ${
                          isActive
                            ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {isActive ? <><ToggleRight className="w-3.5 h-3.5 text-emerald-600" /> Zima Mpango</> : <><ToggleLeft className="w-3.5 h-3.5 text-gray-400" /> Washa Mpango</>}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION 2: Customer Installment Orders */}
        <div className="space-y-3 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs font-black text-gray-900 flex items-center gap-1.5">
                <CalendarClock className="w-4 h-4 text-sky-600" />
                {t('Maagizo ya Wateja ya Lipa Pole Pole')} ({myInstallments.length})
              </div>
              <div className="text-[11px] text-gray-500">
                {t('Fuatilia maendeleo ya kila mteja, kagua awamu zilizolipwa na rekodi malipo ya mkono au risiti.')}
              </div>
            </div>
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {[
              { id: 'all', label: `Zote (${myInstallments.length})` },
              { id: 'active', label: `Zinazoendelea (${myInstallments.filter(o => o.status === 'active').length})` },
              { id: 'completed', label: `Zilizokamilika (${myInstallments.filter(o => o.status === 'completed').length})` },
              { id: 'pending_down', label: `Awali Inasubiriwa (${myInstallments.filter(o => o.status === 'pending_down').length})` },
              { id: 'defaulted', label: `Zilizochelewa / Defaulted (${myInstallments.filter(o => o.status === 'defaulted').length})` }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setInstallmentFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-xl font-bold transition text-[11px] shrink-0 cursor-pointer ${
                  installmentFilter === f.id
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {displayedOrders.length === 0 && (
            <div className="py-12 text-center text-gray-400 font-medium text-xs bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <CalendarClock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <div className="font-bold text-gray-600">{t('Hakuna maagizo ya Lipa Pole Pole kwenye orodha hii.')}</div>
              <div className="text-[11px] text-gray-400 mt-1">{t('Wateja wakichagua kulipa kwa awamu kupitia soko au link, yataonekana hapa.')}</div>
            </div>
          )}

          {displayedOrders.map(order => {
            const product = products.find(p => p.id === order.productId);
            const payments = installmentPayments.filter(p => p.installmentOrderId === order.id);
            const done = order.paidInstallments || 0;
            const progress = Math.round((done / Math.max(1, order.installmentsCount)) * 100);
            const cleanPhone = (order.customerPhone || '').replace(/[^0-9]/g, '');

            return (
              <div key={order.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 hover:border-gray-300 transition space-y-3.5">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-sky-50 flex items-center justify-center text-sky-700 font-black">
                      {product?.image ? <img src={product.image} alt="" className="w-full h-full object-cover" /> : '📅'}
                    </div>
                    <div>
                      <div className="text-xs font-black text-gray-900 flex items-center gap-1.5 flex-wrap">
                        <span>{order.customerName}</span>
                        <span className="text-gray-400 font-normal">·</span>
                        <span className="font-mono text-gray-500 font-semibold">{order.customerPhone}</span>
                      </div>
                      <div className="text-[11px] text-gray-600 mt-0.5 font-semibold">
                        {product ? product.name : `${t('Bidhaa')} #${order.productId}`} · <span className="font-mono text-gray-500 bg-gray-100 px-1 py-0.5 rounded">{order.trackingCode}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                      order.status === 'completed' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                      order.status === 'active' ? 'bg-sky-100 text-sky-800 border border-sky-200' :
                      order.status === 'defaulted' ? 'bg-red-100 text-red-800 border border-red-200' :
                      'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}>
                      {order.status === 'completed' ? '✓ Imekamilika' :
                       order.status === 'active' ? '● Inaendelea' :
                       order.status === 'defaulted' ? '⚠️ Imechelewa' : 'Awali Inasubiriwa'}
                    </span>

                    <button
                      onClick={() => copyCode(order.trackingCode)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 hover:underline cursor-pointer bg-sky-50 px-2 py-1 rounded-lg"
                      title="Nakili Tracking Code"
                    >
                      {copied === order.trackingCode ? <span className="text-green-600">{t('Imenakiliwa!')}</span> : <><Copy className="w-3 h-3" /> Nakili</>}
                    </button>
                  </div>
                </div>

                {/* Customer Contact & Quick Status Controls */}
                <div className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded-xl text-xs flex-wrap">
                  <div className="flex items-center gap-2">
                    <a
                      href={`tel:${order.customerPhone}`}
                      className="px-2.5 py-1 bg-white border border-gray-200 hover:bg-gray-100 rounded-lg text-[11px] font-bold text-gray-700 inline-flex items-center gap-1"
                    >
                      <Phone className="w-3 h-3 text-brand" /> Piga Simu
                    </a>
                    <a
                      href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Habari ${order.customerName}, tunakukumbusha kuhusu malipo ya Lipa Pole Pole #${order.trackingCode} kwa ajili ya ${product?.name || 'bidhaa'}. Baki ni TZS ${order.remaining.toLocaleString()}. Asante!`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg text-[11px] font-bold text-emerald-800 inline-flex items-center gap-1"
                    >
                      <MessageSquare className="w-3 h-3 text-emerald-600" /> WhatsApp
                    </a>
                  </div>

                  {/* Status switches & Visual Schedule */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setScheduleModalOrder(order)}
                      className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-bold cursor-pointer transition inline-flex items-center gap-1 shadow-2xs"
                    >
                      <CalendarClock className="w-3.5 h-3.5 text-indigo-600" />
                      📅 Ratiba Kamili
                    </button>
                    {isAdmin ? (
                      <>
                        {order.status !== 'completed' && onUpdateInstallmentOrderStatus && (
                          <button
                            type="button"
                            onClick={() => onUpdateInstallmentOrderStatus(order.id, 'completed')}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-black cursor-pointer shadow-sm transition inline-flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" /> Weka Imekamilika
                          </button>
                        )}
                        {order.status !== 'defaulted' && order.status !== 'completed' && onUpdateInstallmentOrderStatus && (
                          <button
                            type="button"
                            onClick={() => onUpdateInstallmentOrderStatus(order.id, 'defaulted')}
                            className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-[11px] font-bold cursor-pointer transition"
                          >
                            ⚠️ Weka Defaulted
                          </button>
                        )}
                        {order.status === 'defaulted' && onUpdateInstallmentOrderStatus && (
                          <button
                            type="button"
                            onClick={() => onUpdateInstallmentOrderStatus(order.id, 'active')}
                            className="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg text-[11px] font-bold cursor-pointer transition"
                          >
                            Rejesha Active
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="text-[10px] text-gray-400 font-semibold bg-gray-100 px-2 py-0.5 rounded">Admin pekee kubadili hali</span>
                    )}
                  </div>
                </div>

                {/* Financial Summary Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-sky-50/50 p-2.5 rounded-xl border border-sky-100 text-xs">
                  <div>
                    <div className="text-[9px] uppercase font-bold text-gray-400">{t('Jumla Kuu')}</div>
                    <div className="text-xs font-black text-gray-900">{TZS(order.totalPrice)}</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase font-bold text-gray-400">{t('Malipo ya Awali')}</div>
                    <div className="text-xs font-bold text-gray-700">{TZS(order.downPayment)}</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase font-bold text-gray-400">{t('Kila Awamu')}</div>
                    <div className="text-xs font-bold text-sky-700">{TZS(order.installmentAmount)} × {order.installmentsCount}</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase font-bold text-gray-400">{t('Jumla Iliyolipwa')}</div>
                    <div className="text-xs font-black text-emerald-700">{TZS(order.totalPaid || 0)}</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase font-bold text-gray-400">{t('Baki')}</div>
                    <div className="text-xs font-black text-rose-700">{TZS(order.remaining)}</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-[11px] font-bold text-gray-600 mb-1">
                    <span>{done} / {order.installmentsCount} {t('awamu zilizolipwa')}</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${order.status === 'completed' ? 'bg-emerald-500' : 'bg-sky-500'}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Customer Delivery Location */}
                <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs space-y-1">
                  <div className="text-[11px] text-gray-700 flex items-center gap-1 font-semibold">
                    <MapPin className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                    <span>{[order.customerRegion && `Mkoa: ${order.customerRegion}`, order.customerDistrict && `Wilaya: ${order.customerDistrict}`, order.customerWard && `Kata: ${order.customerWard}`, order.customerStreet && `Mtaa: ${order.customerStreet}`].filter(Boolean).join(' · ') || 'Mahali: Hakukuwekwa (Mteja atapigiwa simu kabla ya kupeleka)'}</span>
                  </div>
                  {(order.transactionId || order.receiptImage) && (
                    <div className="flex items-center gap-3 pt-1 border-t border-gray-200 text-[10px] flex-wrap">
                      {order.transactionId && (
                        <span className="font-semibold text-gray-700">
                          TxID ya Awali: <span className="font-mono text-sky-700 font-bold bg-white px-1.5 py-0.5 rounded border border-gray-200">{order.transactionId}</span>
                        </span>
                      )}
                      {order.receiptImage && (
                        <button
                          type="button"
                          onClick={() => setPreviewReceipt(order.receiptImage!)}
                          className="inline-flex items-center gap-1 font-bold text-sky-700 bg-white px-2 py-0.5 rounded border border-sky-200 hover:bg-sky-50 cursor-pointer"
                        >
                          <img src={order.receiptImage} alt="Receipt" className="w-4 h-4 rounded object-cover" />
                          Tazama Risiti ya Awali
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* DETAILED MILESTONE SCHEDULE */}
                <div className="pt-2 border-t border-gray-100 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase text-gray-400 tracking-wider">
                    <span>Ratiba ya Awamu (Milestone Schedule):</span>
                    <span>{order.installmentsCount} Awamu</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {/* Down Payment Card */}
                    <div className="p-2.5 rounded-xl border border-gray-200 bg-gray-50 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-gray-800">Malipo ya Awali</span>
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                          order.status !== 'pending_down' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {order.status !== 'pending_down' ? '✓ Imelipwa' : 'Inasubiriwa'}
                        </span>
                      </div>
                      <div className="font-extrabold text-gray-900">{TZS(order.downPayment)}</div>
                      {order.transactionId && (
                        <div className="text-[10px] text-gray-500 font-mono truncate">Ref: {order.transactionId}</div>
                      )}
                    </div>

                    {/* Sequential Installment Milestone Cards */}
                    {Array.from({ length: order.installmentsCount }, (_, idx) => {
                      const instNum = idx + 1;
                      const isPaid = instNum <= done;
                      const matchedPayment = payments.find(p => p.type === 'installment' && (p.reference?.endsWith(`I${instNum}`) || payments.indexOf(p) === (instNum - 1)));

                      return (
                        <div
                          key={instNum}
                          className={`p-2.5 rounded-xl border text-xs space-y-1 transition ${
                            isPaid
                              ? 'border-emerald-200 bg-emerald-50/40'
                              : 'border-gray-200 bg-white hover:border-sky-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-black text-gray-800">Awamu #{instNum}</span>
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                              isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {isPaid ? '✓ Imelipwa' : 'Inasubiriwa'}
                            </span>
                          </div>
                          <div className="font-extrabold text-sky-800">{TZS(order.installmentAmount)}</div>

                          {matchedPayment && (
                            <div className="text-[10px] text-gray-500 font-mono truncate">
                              TxID: {matchedPayment.transactionId || matchedPayment.reference || 'Kamilifu'}
                            </div>
                          )}

                          {isAdmin && !isPaid && order.status !== 'completed' && onRecordManualInstallmentPayment && (
                            <button
                              type="button"
                              onClick={() => {
                                setManualPayModal({
                                  order,
                                  paymentIndex: instNum,
                                  suggestedAmount: order.installmentAmount
                                });
                                setManualPayAmount(String(order.installmentAmount));
                                setManualPayTxId('');
                                setManualPayReceipt('');
                                setManualPayNote(`Malipo ya awamu #${instNum}`);
                                setManualPayError('');
                              }}
                              className="w-full mt-1 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[10px] font-black cursor-pointer shadow-xs transition inline-flex items-center justify-center gap-1"
                            >
                              <Plus className="w-3 h-3" /> Rekodi Malipo Haya
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Main Action Bar for order */}
                  <div className="pt-2 flex items-center justify-between flex-wrap gap-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setScheduleModalOrder(order)}
                      className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold cursor-pointer transition inline-flex items-center gap-1.5 shadow-2xs"
                    >
                      <CalendarClock className="w-4 h-4 text-indigo-600" />
                      📅 Kagua Ratiba ya Awamu (Visual Milestone Schedule)
                    </button>
                    {isAdmin && order.status !== 'completed' && onRecordManualInstallmentPayment && (
                      <button
                        type="button"
                        onClick={() => {
                          const nextIdx = Math.min(order.installmentsCount, done + 1);
                          setManualPayModal({
                            order,
                            paymentIndex: nextIdx,
                            suggestedAmount: order.installmentAmount
                          });
                          setManualPayAmount(String(order.installmentAmount));
                          setManualPayTxId('');
                          setManualPayReceipt('');
                          setManualPayNote(`Malipo ya awamu #${nextIdx}`);
                          setManualPayError('');
                        }}
                        className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-black cursor-pointer shadow-sm transition inline-flex items-center gap-1.5"
                      >
                        <Receipt className="w-3.5 h-3.5" /> {t('Rekodi / Thibitisha Malipo ya Awamu')} (#{Math.min(order.installmentsCount, done + 1)})
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ================= 5. BODABODA DELIVERIES =================
  const renderDeliveries = () => (
    <div className="space-y-3">
      {myDeliveries.length === 0 && (
        <div className="py-12 text-center text-gray-400 font-medium text-xs bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <Bike className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <div className="font-bold text-gray-600">{t('Hakuna deliveries bado.')}</div>
          <div className="text-[11px] text-gray-400 mt-1">{t('Kila order au ofa iliyolipwa inaunda tracking code ya bodaboda moja kwa moja.')}</div>
        </div>
      )}

      {myDeliveries.map(delivery => {
        const rider = riders[delivery.id] || { name: '', phone: '' };
        const latest = deliveryUpdates.filter(u => u.deliveryId === delivery.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

        return (
          <div key={delivery.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 hover:border-gray-300 transition">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-black text-gray-900 font-mono">{delivery.trackingCode}</div>
                <div className="text-[11px] text-gray-500 mt-0.5 font-semibold">
                  {delivery.status !== 'cancelled' && (STATUS_LABEL[delivery.status] || delivery.status)}
                  {delivery.status === 'cancelled' && <span className="text-red-600 font-bold">{t('Imeghairiwa')}</span>}
                </div>
              </div>
              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                delivery.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' :
                delivery.status === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-sky-100 text-sky-700'
              }`}>
                {(STATUS_LABEL[delivery.status] || delivery.status).toUpperCase()}
              </span>
            </div>

            {delivery.status === 'pending' && (
              isAdmin ? (
                <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input
                    value={rider.name}
                    onChange={e => setRiders({ ...riders, [delivery.id]: { ...rider, name: e.target.value } })}
                    placeholder={t('Jina la rider wa bodaboda')}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand"
                  />
                  <div className="flex gap-2">
                    <input
                      value={rider.phone}
                      onChange={e => setRiders({ ...riders, [delivery.id]: { ...rider, phone: e.target.value } })}
                      placeholder="07XX XXX XXX"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand"
                    />
                    <button
                      onClick={() => {
                        if (rider.name.trim() && rider.phone.trim()) {
                          onAssignDeliveryRider(delivery.id, rider.name.trim(), rider.phone.trim());
                          setRiders({ ...riders, [delivery.id]: { name: '', phone: '' } });
                        }
                      }}
                      className="px-3.5 py-2 bg-brand text-white rounded-lg text-xs font-bold hover:bg-brand/90 cursor-pointer inline-flex items-center gap-1.5 transition"
                    >
                      <Send className="w-3.5 h-3.5" /> {t('Kabidhi')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-[11px] text-gray-500 italic bg-gray-50 p-2 rounded-xl">
                  {t('Inasubiri Admin kukabidhi rider wa bodaboda.')}
                </div>
              )
            )}

            {(delivery.status === 'assigned' || delivery.status === 'picked' || delivery.status === 'on_the_way') && (
              isAdmin ? (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => onUpdateDeliveryStatus(delivery.id, 'picked', t('Rider amechukua mzigo ghalani'))}
                    className="px-3 py-1.5 bg-sky-600 text-white rounded-lg text-xs font-bold hover:bg-sky-700 cursor-pointer transition"
                  >
                    {t('Amechukua Mzigo')}
                  </button>
                  <button
                    onClick={() => onUpdateDeliveryStatus(delivery.id, 'on_the_way', t('Rider yupo njiani kumpelekea mteja'))}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 cursor-pointer transition"
                  >
                    {t('Yupo Njiani')}
                  </button>
                  <button
                    onClick={() => onUpdateDeliveryStatus(delivery.id, 'delivered', t('Mzigo umekabidhiwa salama kwa mteja'))}
                    className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-black hover:bg-emerald-700 cursor-pointer transition"
                  >
                    {t('Imefikishwa (Delivered)')}
                  </button>
                </div>
              ) : (
                <div className="mt-2 text-[11px] text-gray-500 italic bg-gray-50 p-2 rounded-xl">
                  {t('Masasisho ya safari ya bodaboda yanasimamiwa na Admin.')}
                </div>
              )
            )}

            {delivery.riderName && (
              <div className="mt-3 flex items-center gap-2 text-xs text-gray-700 bg-gray-50 px-3 py-2 rounded-xl">
                <Bike className="w-4 h-4 text-brand" />
                <span className="font-bold">{delivery.riderName}</span>
                <span className="text-gray-400">· {delivery.riderPhone}</span>
                <a href={`tel:${delivery.riderPhone}`} className="text-brand font-bold ml-auto hover:underline">☎ Piga Simu</a>
              </div>
            )}

            {latest && (
              <div className="mt-2 text-[10px] text-gray-500 inline-flex items-center gap-1 font-semibold">
                <MapPin className="w-3 h-3 text-brand" />
                {latest.note || t('Sasisho')} · {new Date(latest.createdAt).toLocaleTimeString()}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // ================= 6. LIVE SHOPPING =================
  const renderLive = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs font-black text-gray-900">{t('Live Shopping (TikTok Style)')}</div>
          <div className="text-[11px] text-gray-500">{t('Onyesha bidhaa zako mubashara, pokea maoni na maagizo ya papo kwa hapo kutoka kwa wateja.')}</div>
        </div>
        {isAdmin ? (
          <button
            onClick={() => { setStreamError(''); setStreamModal(true); }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 text-white rounded-xl text-xs font-black hover:bg-rose-700 cursor-pointer shadow-sm transition"
          >
            <Video className="w-3.5 h-3.5" /> {t('Panga Live Stream Mpya')}
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-500 rounded-xl text-xs font-bold border border-gray-200">
            <ShieldCheck className="w-3.5 h-3.5 text-gray-400" /> {t('Admin pekee ndiye anayepanga Live Streams')}
          </span>
        )}
      </div>

      {myStreams.length === 0 && (
        <div className="py-12 text-center text-gray-400 font-medium text-xs bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <Video className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <div className="font-bold text-gray-600">{t('Hakuna live streams bado.')}</div>
          <div className="text-[11px] text-gray-400 mt-1">{t('Anzisha live shopping ili kuungana moja kwa moja na wateja wako.')}</div>
        </div>
      )}

      {myStreams.map(stream => {
        const comments = liveComments.filter(c => c.liveStreamId === stream.id);
        const wants = comments.filter(c => c.type === 'want').length;
        const isLiveNow = stream.status === 'live';
        const streamDraft = liveCommentDrafts[stream.id] || '';

        return (
          <div key={stream.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 hover:border-gray-300 transition space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
              <div>
                <div className="text-sm font-black text-gray-900 flex items-center gap-2">
                  <span>{stream.title}</span>
                  {isLiveNow && (
                    <span className="flex items-center gap-1 bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse shadow-xs">
                      <span className="w-2 h-2 rounded-full bg-white animate-ping" /> ● MUBASHARA
                    </span>
                  )}
                </div>
                {stream.description && (
                  <div className="text-xs text-gray-600 mt-0.5">{stream.description}</div>
                )}
                <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                  <span>Stream Key: <span className="font-mono text-gray-700 font-bold bg-gray-100 px-1.5 py-0.5 rounded">{stream.streamKey}</span></span>
                  <button
                    onClick={() => copyCode(stream.streamKey)}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-brand hover:underline cursor-pointer bg-amber-50 px-2 py-0.5 rounded"
                  >
                    {copied === stream.streamKey ? <span className="text-green-600">Imenakiliwa!</span> : <><Copy className="w-2.5 h-2.5" /> Nakili</>}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                  stream.status === 'live' ? 'bg-rose-100 text-rose-700' :
                  stream.status === 'scheduled' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'
                }`}>
                  {stream.status === 'live' ? 'LIVE NOW' : stream.status === 'scheduled' ? 'Imepangwa' : 'Imekwisha'}
                </span>

                {/* Live Stream Controls */}
                {isAdmin ? (
                  <>
                    {stream.status === 'scheduled' && onStartLiveStream && (
                      <button
                        type="button"
                        onClick={() => onStartLiveStream(stream.id)}
                        className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-black text-xs cursor-pointer shadow-sm transition inline-flex items-center gap-1"
                      >
                        <Play className="w-3 h-3" /> Anza Live Sasa
                      </button>
                    )}

                    {stream.status === 'live' && onEndLiveStream && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('Una uhakika unataka kusimamisha kipindi hiki cha Live?')) {
                            onEndLiveStream(stream.id);
                          }
                        }}
                        className="px-3 py-1 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-black text-xs cursor-pointer shadow-sm transition inline-flex items-center gap-1"
                      >
                        <Square className="w-3 h-3" /> Maliza Live
                      </button>
                    )}
                  </>
                ) : (
                  <span className="text-[10px] text-gray-400 italic">Udhibiti: Admin Pekee</span>
                )}
              </div>
            </div>

            {/* Metrics */}
            <div className="flex items-center gap-4 text-xs text-gray-700 bg-gray-50 px-3.5 py-2 rounded-xl flex-wrap">
              <span className="font-semibold">👁 {stream.viewersCount || 0} watazamaji</span>
              <span className="font-semibold">👍 {stream.likesCount || 0} likes</span>
              <span className="font-black text-indigo-700">🛒 "Nataka" × {wants}</span>
              {stream.productIds?.length > 0 && (
                <span className="text-[11px] text-gray-500 ml-auto">
                  Bidhaa {stream.productIds.length} zimeunganishwa
                </span>
              )}
            </div>

            {/* In-stream announcement / broadcast chat for seller */}
            {stream.status !== 'ended' && onAddLiveComment && (
              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <input
                  type="text"
                  value={streamDraft}
                  onChange={e => setLiveCommentDrafts({ ...liveCommentDrafts, [stream.id]: e.target.value })}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && streamDraft.trim()) {
                      onAddLiveComment(stream.id, {
                        customerName: company?.name || 'Muuzaji',
                        message: streamDraft.trim(),
                        type: 'comment'
                      });
                      setLiveCommentDrafts({ ...liveCommentDrafts, [stream.id]: '' });
                    }
                  }}
                  placeholder={t('Tuma tangazo au ujumbe mubashara kwa watazamaji...')}
                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!streamDraft.trim()) return;
                    onAddLiveComment(stream.id, {
                      customerName: company?.name || 'Muuzaji',
                      message: streamDraft.trim(),
                      type: 'comment'
                    });
                    setLiveCommentDrafts({ ...liveCommentDrafts, [stream.id]: '' });
                  }}
                  disabled={!streamDraft.trim()}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black cursor-pointer disabled:opacity-40 transition shadow-xs inline-flex items-center gap-1"
                >
                  <Send className="w-3 h-3" /> Tangaza
                </button>
              </div>
            )}

            {/* Comments Feed */}
            {comments.length > 0 && (
              <div className="pt-2 border-t border-gray-100 space-y-1.5">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{t('Maoni na Maombi ya Watazamaji')} ({comments.length}):</div>
                <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                  {comments.slice(-8).map(c => (
                    <div key={c.id} className={`text-[11px] px-2.5 py-1.5 rounded-lg flex items-center justify-between ${
                      c.type === 'paid' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold' :
                      c.type === 'want' ? 'bg-indigo-50 text-indigo-800 border border-indigo-200 font-bold' :
                      'bg-gray-50 text-gray-700'
                    }`}>
                      <div>
                        <span className="font-black text-gray-900">{c.customerName}:</span> {c.message || (c.type === 'want' ? `"Nataka hii!"` : '')}
                      </div>
                      <span className="text-[9px] text-gray-400 ml-2">{timeAgo(c.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // ================= 7. LOYALTY =================
  const renderLoyalty = () => (
    <div className="space-y-3">
      {loyaltyCustomers.length === 0 && (
        <div className="py-12 text-center text-gray-400 font-medium text-xs bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <Gift className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <div className="font-bold text-gray-600">{t('Hakuna wateja wa loyalty bado.')}</div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {loyaltyCustomers.map(c => (
          <div key={c.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-black text-gray-900">{c.name || c.phone}</div>
                <div className="text-[11px] text-gray-500 font-semibold">{c.phone}</div>
              </div>
              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                c.tier === 'platinum' ? 'bg-purple-100 text-purple-700' :
                c.tier === 'gold' ? 'bg-amber-100 text-amber-700' :
                c.tier === 'silver' ? 'bg-gray-100 text-gray-700' : 'bg-orange-100 text-orange-700'
              }`}>{c.tier}</span>
            </div>
            <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100 text-xs">
              <div><div className="text-sm font-black text-gray-900">{c.balancePoints}</div><div className="text-[10px] text-gray-400 font-bold uppercase">{t('Points')}</div></div>
              <div className="h-6 w-px bg-gray-200" />
              <div><div className="text-sm font-black text-gray-900">{TZS(c.totalSpent)}</div><div className="text-[10px] text-gray-400 font-bold uppercase">{t('Ametumia')}</div></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ================= 8. WHATSAPP BOT =================
  const renderWhatsapp = () => (
    <div className="space-y-3">
      {whatsappConversations.length === 0 && (
        <div className="py-12 text-center text-gray-400 font-medium text-xs bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <div className="font-bold text-gray-600">{t('Hakuna mazungumzo ya WhatsApp Bot bado.')}</div>
        </div>
      )}
      {whatsappConversations.slice(0, 50).map(conv => (
        <div key={conv.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-black text-gray-900">{conv.phone}</div>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${conv.status === 'replied' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{conv.status}</span>
          </div>
          <div className="mt-2 text-xs text-gray-700 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
            <span className="font-bold text-gray-900">{t('Ujumbe wa mteja')}:</span> {conv.messageIn}
          </div>
          {conv.messageOut && (
            <div className="mt-2 text-xs text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-100 font-semibold">
              <span className="font-bold">→ Bot:</span> {conv.messageOut}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-brand via-indigo-700 to-purple-800 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[11px] font-black uppercase tracking-widest text-white/80">{t('Smart Selling & Direct Commerce')} — {company?.name || ''}</div>
            <div className="text-lg font-black mt-1">{t('Piga Bei · Ask Seller Chat · Nunua Pamoja · Lipa Pole Pole · Bodaboda')}</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isAdmin && onRecordSmartSale && (
              <button
                onClick={() => {
                  setQuickSaleProdId(products[0]?.id || 0);
                  setQuickSalePrice(products[0]?.price ? String(products[0].price) : '');
                  setQuickSaleQty('1');
                  setQuickSaleCustName('');
                  setQuickSaleCustPhone('');
                  setQuickSaleNote('');
                  setQuickSaleTxId('');
                  setQuickSaleMsg(null);
                  setQuickSaleModal(true);
                }}
                className="text-xs font-black bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-md active:scale-95 transition cursor-pointer"
              >
                <DollarSign className="w-3.5 h-3.5" /> ⚡ {t('Rekodi Mauzo ya Smart Selling (POS)')}
              </button>
            )}
            {isAdmin ? (
              <span className="text-xs font-black bg-emerald-500/80 text-white backdrop-blur px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm">
                <ShieldCheck className="w-3.5 h-3.5" /> {t('Admin Mode (CRUD Active)')}
              </span>
            ) : (
              <span className="text-xs font-bold bg-amber-500/80 text-white backdrop-blur px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm" title={t('CRUD actions are restricted to Admin')}>
                <AlertCircle className="w-3.5 h-3.5" /> {t('Staff (Read-Only Mode)')}
              </span>
            )}
            <span className="text-xs font-black bg-white/20 backdrop-blur px-3 py-1.5 rounded-full">
              {myOffers.length} {t('Ofa')} · {totalUnreadChats} {t('Soga')}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {tabs.map(tabItem => (
          <button
            key={tabItem.id}
            onClick={() => setTab(tabItem.id)}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
              tab === tabItem.id
                ? 'bg-brand text-white shadow-md'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <tabItem.icon className="w-4 h-4" /> {tabItem.label}
            {tabItem.count > 0 && (
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                tab === tabItem.id ? 'bg-white/25 text-white' : tabItem.alert ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-700'
              }`}>
                {tabItem.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 md:p-5">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
          <div className="font-black text-gray-900 text-sm flex items-center gap-2">
            {tab === 'offers' && <><HandCoins className="w-4 h-4 text-orange-500" /> {t('Mazungumzo ya Bei (Piga Bei)')}</>}
            {tab === 'chat' && <><MessageCircle className="w-4 h-4 text-brand" /> {t('Ask Seller Live Chat')}</>}
            {tab === 'deals' && <><Users className="w-4 h-4 text-indigo-600" /> {t('Nunua Pamoja (Group Deals)')}</>}
            {tab === 'installments' && <><CalendarClock className="w-4 h-4 text-sky-600" /> {t('Lipa Pole Pole (Installments)')}</>}
            {tab === 'deliveries' && <><Bike className="w-4 h-4 text-emerald-600" /> {t('Bodaboda Deliveries & Tracking')}</>}
            {tab === 'live' && <><Video className="w-4 h-4 text-rose-600" /> {t('Live Shopping Mubashara')}</>}
            {tab === 'loyalty' && <><Gift className="w-4 h-4 text-purple-600" /> {t('Wateja wa Loyalty (Points & Rewards)')}</>}
            {tab === 'whatsapp' && <><MessageSquare className="w-4 h-4 text-emerald-600" /> {t('WhatsApp Automated Bot')}</>}
          </div>
        </div>

        {tab === 'offers' && renderOffers()}
        {tab === 'chat' && renderChat()}
        {tab === 'deals' && renderDeals()}
        {tab === 'installments' && renderInstallments()}
        {tab === 'deliveries' && renderDeliveries()}
        {tab === 'live' && renderLive()}
        {tab === 'loyalty' && renderLoyalty()}
        {tab === 'whatsapp' && renderWhatsapp()}
      </div>

      {/* Modal: Tengeneza Group Deal */}
      {dealModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setDealModal(false)}>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 w-full max-w-md space-y-3 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-gray-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" /> {t('Tengeneza Group Deal Mpya')}
              </h4>
              <button onClick={() => setDealModal(false)} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">{t('Chagua Bidhaa')}:</label>
                <select
                  value={dealProductId}
                  onChange={e => setDealProductId(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none font-semibold"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} — {TZS(p.price)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-bold text-gray-700 block mb-1">{t('Bei ya Kikundi (TZS)')}:</label>
                <input
                  type="number"
                  value={dealPrice}
                  onChange={e => setDealPrice(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder={t('Bei iliyopunguzwa ya kikundi')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none font-bold"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">{t('Wanunuzi wa Chini')}:</label>
                  <input
                    type="number"
                    value={dealMinBuyers}
                    onChange={e => setDealMinBuyers(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">{t('Muda (Masaa)')}:</label>
                  <input
                    type="number"
                    value={dealHours}
                    onChange={e => setDealHours(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none font-bold"
                  />
                </div>
              </div>
              {dealError && <div className="text-xs text-red-500 font-bold">{dealError}</div>}
              <button
                onClick={() => {
                  if (!onCreateGroupDeal) return;
                  const res = onCreateGroupDeal({
                    productId: dealProductId,
                    companyId,
                    groupPrice: Number(dealPrice),
                    minBuyers: Number(dealMinBuyers) || 2,
                    durationHours: Number(dealHours) || 48
                  });
                  if (!res.ok) {
                    setDealError(res.error || t('Imeshindikana kutengeneza group deal.'));
                  } else {
                    setDealModal(false);
                    setDealPrice('');
                  }
                }}
                disabled={!Number(dealPrice)}
                className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-black text-xs hover:bg-indigo-700 cursor-pointer disabled:opacity-40 transition shadow-sm"
              >
                {t('Thibitisha na Washa Deal')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Washa Lipa Pole Pole */}
      {installmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setInstallmentModal(false)}>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 w-full max-w-md space-y-3 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-gray-900 flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-sky-600" /> {t('Washa Mpango wa Lipa Pole Pole')}
              </h4>
              <button onClick={() => setInstallmentModal(false)} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">{t('Chagua Bidhaa')}:</label>
                <select
                  value={instProductId}
                  onChange={e => setInstProductId(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none font-semibold"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} — {TZS(p.price)}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">{t('Malipo ya Awali (%)')}:</label>
                  <input
                    type="number"
                    value={instDownPercent}
                    onChange={e => setInstDownPercent(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">{t('Idadi ya Awamu')}:</label>
                  <input
                    type="number"
                    value={instCount}
                    onChange={e => setInstCount(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">{t('Riba (%)')}:</label>
                  <input
                    type="number"
                    value={instExtraPercent}
                    onChange={e => setInstExtraPercent(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none font-bold"
                  />
                </div>
              </div>
              {instError && <div className="text-xs text-red-500 font-bold">{instError}</div>}
              <button
                onClick={() => {
                  if (!onCreateInstallmentPlan) return;
                  const res = onCreateInstallmentPlan({
                    productId: instProductId,
                    companyId,
                    downPaymentPercent: Number(instDownPercent),
                    installmentsCount: Number(instCount),
                    installmentPercentExtra: Number(instExtraPercent)
                  });
                  if (!res.ok) {
                    setInstError(res.error || t('Imeshindikana kuwasha mpango wa awamu.'));
                  } else {
                    setInstallmentModal(false);
                  }
                }}
                className="w-full py-2.5 bg-sky-600 text-white rounded-xl font-black text-xs hover:bg-sky-700 cursor-pointer transition shadow-sm"
              >
                {t('Thibitisha na Washa Mpango')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Panga Live Stream */}
      {streamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setStreamModal(false)}>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 w-full max-w-md space-y-3 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-gray-900 flex items-center gap-2">
                <Video className="w-4 h-4 text-rose-600" /> {t('Panga Live Stream Mpya')}
              </h4>
              <button onClick={() => setStreamModal(false)} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">{t('Kichwa cha Live Stream')}:</label>
                <input
                  value={streamTitle}
                  onChange={e => setStreamTitle(e.target.value)}
                  placeholder="Mfano: Maonyesho ya nguo na viatu vipya"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-gray-700 block mb-1">{t('Maelezo Fupi')}:</label>
                <textarea
                  value={streamDesc}
                  onChange={e => setStreamDesc(e.target.value)}
                  placeholder="Mambo yatakayoonyeshwa katika kipindi hiki..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none"
                />
              </div>
              <div>
                <label className="font-bold text-gray-700 block mb-1">{t('Bidhaa Kuu ya Kuonyesha')}:</label>
                <select
                  value={streamProductId}
                  onChange={e => setStreamProductId(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none font-semibold"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} — {TZS(p.price)}</option>
                  ))}
                </select>
              </div>
              {streamError && <div className="text-xs text-red-500 font-bold">{streamError}</div>}
              <button
                onClick={() => {
                  if (!onCreateLiveStream) return;
                  const res = onCreateLiveStream({
                    companyId,
                    title: streamTitle,
                    description: streamDesc,
                    productIds: streamProductId ? [streamProductId] : []
                  });
                  if (!res.ok) {
                    setStreamError(res.error || t('Imeshindikana kupanga live stream.'));
                  } else {
                    setStreamModal(false);
                    setStreamTitle('');
                    setStreamDesc('');
                  }
                }}
                disabled={!streamTitle.trim()}
                className="w-full py-2.5 bg-rose-600 text-white rounded-xl font-black text-xs hover:bg-rose-700 cursor-pointer disabled:opacity-40 transition shadow-sm"
              >
                {t('Anzisha Live Stream Sasa')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Rekodi Malipo ya Awamu ya Mteja (Manual Installment Payment) */}
      {manualPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setManualPayModal(null)}>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 w-full max-w-md space-y-3.5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-2.5">
              <h4 className="text-sm font-black text-gray-900 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-sky-600" />
                {t('Rekodi / Thibitisha Malipo ya Awamu')}
              </h4>
              <button onClick={() => setManualPayModal(null)} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target order summary */}
            <div className="p-3 bg-sky-50 rounded-xl border border-sky-100 text-xs space-y-1">
              <div className="flex justify-between font-bold text-gray-800">
                <span>Mteja: <strong className="text-gray-900">{manualPayModal.order.customerName}</strong></span>
                <span className="font-mono text-sky-700">{manualPayModal.order.customerPhone}</span>
              </div>
              <div className="flex justify-between text-[11px] text-gray-600">
                <span>Agizo: <strong className="font-mono">{manualPayModal.order.trackingCode}</strong></span>
                <span>Baki: <strong className="text-rose-700">{TZS(manualPayModal.order.remaining)}</strong></span>
              </div>
              <div className="text-[11px] font-bold text-sky-800 pt-1">
                Awamu inayorekodiwa: Awamu #{manualPayModal.paymentIndex} ya {manualPayModal.order.installmentsCount}
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">
                  Kiasi Kilicholipwa (TZS): <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={manualPayAmount}
                  onChange={e => setManualPayAmount(e.target.value)}
                  placeholder={String(manualPayModal.suggestedAmount)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none font-black text-sm focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">
                  Namba ya Muamala / TxID (M-Pesa / Tigo Pesa / Benki):
                </label>
                <input
                  type="text"
                  value={manualPayTxId}
                  onChange={e => setManualPayTxId(e.target.value)}
                  placeholder="Mfano: QHD872KLS9 au MP230911"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none font-mono font-bold focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">
                  Picha au URL ya Risiti (Hiari):
                </label>
                <input
                  type="text"
                  value={manualPayReceipt}
                  onChange={e => setManualPayReceipt(e.target.value)}
                  placeholder="https://... au weka picha"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none text-xs focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">
                  Maelezo / Note ya Muuzaji:
                </label>
                <input
                  type="text"
                  value={manualPayNote}
                  onChange={e => setManualPayNote(e.target.value)}
                  placeholder="Mfano: Malipo yamepokelewa taslimu / M-Pesa dukani"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl outline-none text-xs focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {manualPayError && (
                <div className="p-2 bg-red-50 text-red-700 text-xs rounded-lg font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{manualPayError}</span>
                </div>
              )}

              <button
                type="button"
                disabled={!Number(manualPayAmount) || manualPaySubmitting}
                onClick={async () => {
                  const amt = Number(manualPayAmount);
                  if (!amt || amt <= 0) {
                    setManualPayError('Weka kiasi halali cha malipo.');
                    return;
                  }
                  if (!onRecordManualInstallmentPayment) return;
                  setManualPaySubmitting(true);
                  try {
                    const res = await onRecordManualInstallmentPayment({
                      installmentOrderId: manualPayModal.order.id,
                      amount: amt,
                      paymentIndex: manualPayModal.paymentIndex,
                      transactionId: manualPayTxId.trim() || undefined,
                      receiptImage: manualPayReceipt.trim() || undefined,
                      note: manualPayNote.trim() || undefined
                    });
                    if (res && (res as any).ok === false) {
                      setManualPayError((res as any).error || 'Imeshindikana kurekodi malipo.');
                    } else {
                      setManualPayModal(null);
                    }
                  } catch (err: any) {
                    setManualPayError(err.message || 'Hitilafu imetokea.');
                  } finally {
                    setManualPaySubmitting(false);
                  }
                }}
                className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-black text-xs cursor-pointer disabled:opacity-40 transition shadow-sm inline-flex items-center justify-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                {manualPaySubmitting ? 'Inarekodi...' : t('Thibitisha na Rekodi Malipo')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Preview Modal */}
      {previewReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => setPreviewReceipt(null)}>
          <div className="bg-white rounded-2xl p-4 max-w-xl w-full max-h-[90vh] flex flex-col space-y-3 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="text-xs font-black text-gray-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> {t('Uthibitisho wa Malipo (Risiti / Screenshot)')}
              </h4>
              <button onClick={() => setPreviewReceipt(null)} className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 cursor-pointer">✕</button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center bg-gray-900 rounded-xl p-2 min-h-[300px]">
              <img src={previewReceipt} alt="Receipt Full Preview" className="max-w-full max-h-[70vh] object-contain rounded-lg" />
            </div>
            <button onClick={() => setPreviewReceipt(null)} className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold text-xs cursor-pointer">
              {t('Funga')}
            </button>
          </div>
        </div>
      )}

      {/* Visual Schedule Modal for Lipa Pole Pole */}
      {scheduleModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto" onClick={() => setScheduleModalOrder(null)}>
          <div className="max-w-2xl w-full my-8 bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
              <div>
                <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-sky-600" />
                  Ratiba Kamili ya Malipo · {scheduleModalOrder.customerName}
                </h3>
                <p className="text-[11px] text-gray-500 font-mono">Agizo: {scheduleModalOrder.trackingCode}</p>
              </div>
              <button
                type="button"
                onClick={() => setScheduleModalOrder(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 max-h-[80vh] overflow-y-auto">
              <InstallmentVisualSchedule
                order={scheduleModalOrder}
                payments={installmentPayments.filter(p => p.installmentOrderId === scheduleModalOrder.id)}
                onRecordPayment={isAdmin && onRecordManualInstallmentPayment ? (instNum, amount) => {
                  const targetOrder = scheduleModalOrder;
                  setScheduleModalOrder(null);
                  setManualPayModal({
                    order: targetOrder,
                    paymentIndex: instNum,
                    suggestedAmount: amount
                  });
                  setManualPayAmount(String(amount));
                  setManualPayTxId('');
                  setManualPayReceipt('');
                  setManualPayNote(`Malipo ya awamu #${instNum}`);
                  setManualPayError('');
                } : undefined}
              />
            </div>
          </div>
        </div>
      )}

      {/* QUICK SMART POS SALE MODAL */}
      {quickSaleModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 px-6 py-4 text-white flex items-center justify-between">
              <div>
                <h3 className="font-black text-sm flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4" /> ⚡ {t('Rekodi Mauzo ya Smart Selling (POS)')}
                </h3>
                <p className="text-[11px] text-white/80 mt-0.5">
                  {t('Mauzo yatakamilika na kuwekwa kiotomatiki kwenye Marketplace Orders na Ripoti ya Kifedha (P&L).')}
                </p>
              </div>
              <button
                onClick={() => setQuickSaleModal(false)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!onRecordSmartSale) return;
                const prod = products.find(p => p.id === quickSaleProdId) || products[0];
                if (!prod) {
                  setQuickSaleMsg({ text: 'Tafadhali chagua bidhaa.', ok: false });
                  return;
                }
                const qty = parseInt(quickSaleQty) || 1;
                const price = parseFloat(quickSalePrice) || prod.price;
                const res = onRecordSmartSale({
                  companyId: companyId || prod.companyId,
                  productId: prod.id,
                  quantity: qty,
                  unitPrice: price,
                  customerName: quickSaleCustName.trim() || 'Mteja wa Dukani',
                  customerPhone: quickSaleCustPhone.trim() || '0700000000',
                  paymentMethod: quickSaleMethod,
                  transactionId: quickSaleTxId.trim() || undefined,
                  note: quickSaleNote.trim() || undefined
                });

                if (res.ok) {
                  setQuickSaleMsg({
                    text: `🎉 Mauzo yamekamilika! Agizo #${res.orderNumber || ''} limewekwa kiotomatiki kwenye Marketplace Orders na Ripoti ya Kifedha.`,
                    ok: true
                  });
                  setTimeout(() => {
                    setQuickSaleModal(false);
                    setQuickSaleMsg(null);
                  }, 1800);
                } else {
                  setQuickSaleMsg({ text: res.error || 'Kulitokea hitilafu.', ok: false });
                }
              }}
              className="p-6 space-y-4 text-xs font-semibold"
            >
              {quickSaleMsg && (
                <div className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                  quickSaleMsg.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  {quickSaleMsg.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
                  <span>{quickSaleMsg.text}</span>
                </div>
              )}

              {/* Product select */}
              <div>
                <label className="text-gray-700 font-bold block mb-1">{t('Bidhaa ya Kuuza')}</label>
                <select
                  value={quickSaleProdId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setQuickSaleProdId(id);
                    const prod = products.find(p => p.id === id);
                    if (prod) setQuickSalePrice(String(prod.price));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {TZS(p.price)} (Baki Ghalani: {p.stockQuantity ?? 0})
                    </option>
                  ))}
                </select>
              </div>

              {/* Qty & Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-700 font-bold block mb-1">{t('Idadi (Quantity)')}</label>
                  <input
                    type="number"
                    min="1"
                    value={quickSaleQty}
                    onChange={(e) => setQuickSaleQty(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-gray-700 font-bold block mb-1">{t('Bei kwa Kipimo (TZS)')}</label>
                  <input
                    type="number"
                    value={quickSalePrice}
                    onChange={(e) => setQuickSalePrice(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Total Summary */}
              <div className="bg-emerald-50/80 p-3 rounded-xl border border-emerald-200 flex items-center justify-between text-xs">
                <span className="text-emerald-900 font-bold">{t('Jumla Kuu ya Mauzo (Total Amount)')}:</span>
                <span className="text-base font-black text-emerald-800">
                  {TZS((parseFloat(quickSalePrice) || 0) * (parseInt(quickSaleQty) || 1))}
                </span>
              </div>

              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-700 font-bold block mb-1">{t('Jina la Mteja')}</label>
                  <input
                    type="text"
                    placeholder="Mfano: Juma Rashid"
                    value={quickSaleCustName}
                    onChange={(e) => setQuickSaleCustName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs text-gray-800 bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-gray-700 font-bold block mb-1">{t('Namba ya Simu')}</label>
                  <input
                    type="tel"
                    placeholder="07XXXXXXXX"
                    value={quickSaleCustPhone}
                    onChange={(e) => setQuickSaleCustPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs text-gray-800 bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Payment Method & TxID */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-700 font-bold block mb-1">{t('Njia ya Malipo')}</label>
                  <select
                    value={quickSaleMethod}
                    onChange={(e) => setQuickSaleMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="cash">Pesa Taslimu (Cash)</option>
                    <option value="mpesa">M-Pesa</option>
                    <option value="tigo_pesa">Tigo Pesa</option>
                    <option value="airtel_money">Airtel Money</option>
                    <option value="halopesa">HaloPesa</option>
                    <option value="bank">Benki / Kadi</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-700 font-bold block mb-1">{t('Namba ya Muamala (TxID)')}</label>
                  <input
                    type="text"
                    placeholder="Hiari (Mfano: QWE12345)"
                    value={quickSaleTxId}
                    onChange={(e) => setQuickSaleTxId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs text-gray-800 bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="text-gray-700 font-bold block mb-1">{t('Maelezo ya Mauzo (Hiari)')}</label>
                <input
                  type="text"
                  placeholder="Mfano: Mauzo ya kaunta dukani"
                  value={quickSaleNote}
                  onChange={(e) => setQuickSaleNote(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs text-gray-800 bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setQuickSaleModal(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition cursor-pointer"
                >
                  {t('Ghairi')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 transition cursor-pointer active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" /> ⚡ {t('Kamilisha Mauzo Dukani')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
