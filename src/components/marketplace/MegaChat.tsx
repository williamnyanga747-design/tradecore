import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Send, ImagePlus, Package, Search, MessageCircle, ArrowLeft, Languages, ShieldAlert } from 'lucide-react';
import { ChatConversation, ChatMessage, Company, MarketplaceProduct } from '../../types';
import { getPublicTheme, PublicTheme } from '../../utils/publicTheme';
import { TZS, TFunc } from './MarketplaceShared';
import { timeAgo } from '../../utils/megaHelpers';

interface Props {
  theme: PublicTheme;
  t: TFunc;
  mode: 'buyer' | 'company';
  conversations: ChatConversation[];
  messages: ChatMessage[];
  products: MarketplaceProduct[];
  companies: Company[];
  /** buyer identity (phone+name) when mode=buyer */
  buyerIdentity?: { phone: string; name: string } | null;
  /** company id when mode=company */
  companyId?: number;
  initialConversationId?: number;
  onSend: (conversationId: number, input: { text?: string; messageType: 'text' | 'image' | 'product'; imageData?: string; productId?: number }) => void;
  onMarkRead: (conversationId: number) => void;
  onOpenProduct?: (product: MarketplaceProduct) => void;
}

/**
 * MEGA BUILD F2 — Real-time chat buyer <-> seller (WhatsApp-style).
 * MVP polling: the message list re-renders on a 3s tick so new messages
 * written by the other side appear without a manual refresh.
 */
export default function MegaChat({
  theme, t, mode, conversations, messages, products, companies,
  buyerIdentity, companyId, initialConversationId, onSend, onMarkRead, onOpenProduct
}: Props) {
  const th = getPublicTheme(theme);
  const [activeId, setActiveId] = useState<number | null>(initialConversationId || null);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [, setTick] = useState(0);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // MVP "polling": refresh every 3 seconds (client-side state re-read).
  useEffect(() => {
    const id = window.setInterval(() => setTick(x => x + 1), 3000);
    return () => window.clearInterval(id);
  }, []);

  const myConversations = useMemo(() => {
    let list = conversations;
    if (mode === 'buyer') list = list.filter(c => c.buyerPhone === buyerIdentity?.phone);
    else list = list.filter(c => c.companyId === companyId);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c => {
        if (mode === 'buyer') {
          const comp = companies.find(x => x.id === c.companyId);
          return (comp?.name || '').toLowerCase().includes(q) || c.lastMessage.toLowerCase().includes(q);
        }
        return c.buyerName.toLowerCase().includes(q) || c.buyerPhone.includes(q) || c.lastMessage.toLowerCase().includes(q);
      });
    }
    return [...list].sort((a, b) => (b.lastMessageAt || '').localeCompare(a.lastMessageAt || ''));
  }, [conversations, mode, buyerIdentity?.phone, companyId, search, companies]);

  const active = myConversations.find(c => c.id === activeId) || null;
  const activeMessages = useMemo(
    () => messages.filter(m => m.conversationId === activeId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [messages, activeId]
  );

  useEffect(() => {
    if (activeId && active) onMarkRead(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, active?.unreadBuyer, active?.unreadCompany]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages.length, activeId]);

  const send = (input: { text?: string; messageType: 'text' | 'image' | 'product'; imageData?: string; productId?: number }) => {
    if (!active) return;
    onSend(active.id, input);
    setDraft('');
  };

  const sendText = () => {
    const text = draft.trim();
    if (!text || !active) return;
    send({ text, messageType: 'text' });
  };

  const onFile = (file: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') send({ messageType: 'image', imageData: reader.result, text: '' });
    };
    reader.readAsDataURL(file);
  };

  // ---- Conversation list (left sidebar) ----
  const renderList = () => (
    <div className={`w-full sm:w-72 shrink-0 flex flex-col ${active ? 'hidden sm:flex' : 'flex'} ${th.card} ${th.cardBorder} rounded-2xl overflow-hidden`}>
      <div className="p-3 border-b" style={{ borderColor: 'rgba(128,128,128,0.15)' }}>
        <div className="relative">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${th.textDim}`} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('Search chats')}
            className={th.input + ' pl-9 !py-2 !text-[11px]'}
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {myConversations.length === 0 && (
          <div className="p-6 text-center">
            <MessageCircle className={`w-8 h-8 mx-auto mb-2 ${th.textDim}`} />
            <div className={`text-[11px] font-bold ${th.textMuted}`}>{t('Hakuna mazungumzo bado')}</div>
            <div className={`text-[10px] ${th.textDim} font-semibold mt-1`}>
              {mode === 'buyer' ? t('Bofya "Chat na Muuzaji" kwenye bidhaa yoyote.') : t('Wateja wakikuuliza maswali, mazungumzo yataonekana hapa.')}
            </div>
          </div>
        )}
        {myConversations.map(c => {
          const company = companies.find(x => x.id === c.companyId);
          const unread = mode === 'buyer' ? c.unreadBuyer : c.unreadCompany;
          const name = mode === 'buyer' ? (company?.name || t('Muuzaji')) : c.buyerName;
          return (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={`w-full flex items-center gap-2.5 p-3 text-left transition cursor-pointer border-b ${activeId === c.id ? (theme === 'milk' ? 'bg-amber-50' : 'bg-white/10') : 'hover:bg-white/5'}`}
              style={{ borderColor: 'rgba(128,128,128,0.12)' }}
            >
              <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center text-white text-xs font-black">
                {(mode === 'buyer' ? company?.logoUrl : undefined)
                  ? <img src={company!.logoUrl} alt="" className="w-full h-full object-cover" />
                  : name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-[11px] font-black truncate ${th.strongText}`}>{name}</span>
                  <span className={`text-[8px] font-bold shrink-0 ${th.textDim}`}>{c.lastMessageAt ? timeAgo(c.lastMessageAt) : ''}</span>
                </div>
                <div className="flex items-center justify-between gap-1 mt-0.5">
                  <span className={`text-[10px] font-semibold truncate ${th.textMuted}`}>{c.lastMessage || '—'}</span>
                  {unread > 0 && (
                    <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-white text-[9px] font-black flex items-center justify-center">{unread}</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  // ---- Chat window (right) ----
  const renderWindow = () => {
    if (!active) {
      // 403 equivalent: a conversation id was requested but it is NOT owned by the
      // current viewer — show forbidden instead of silently rendering an empty pane.
      const forbidden = !!initialConversationId && !myConversations.some(c => c.id === initialConversationId);
      return (
        <div className={`flex-1 hidden sm:flex items-center justify-center ${th.card} ${th.cardBorder} rounded-2xl`}>
          <div className="text-center p-8">
            {forbidden ? (
              <>
                <ShieldAlert className="w-12 h-12 mx-auto mb-3 text-red-500" />
                <div className="text-sm font-black text-red-400">403 — {t('Huwezi kufungua mazungumzo ya wengine.')}</div>
                <div className={`text-[11px] ${th.textMuted} font-semibold mt-1`}>{t('Mazungumzo haya si yako.')}</div>
              </>
            ) : (
              <>
                <MessageCircle className={`w-12 h-12 mx-auto mb-3 ${th.textDim}`} />
                <div className={`text-sm font-black ${th.strongText}`}>{t('Chagua mazungumzo')}</div>
                <div className={`text-[11px] ${th.textMuted} font-semibold mt-1`}>{t('Chagua soga kutoka orodha ili uanze kuwasiliana.')}</div>
              </>
            )}
          </div>
        </div>
      );
    }
    const company = companies.find(x => x.id === active.companyId);
    const title = mode === 'buyer' ? (company?.name || t('Muuzaji')) : active.buyerName;
    const sharedProduct = active.productId ? products.find(p => p.id === active.productId) : null;

    return (
      <div className={`flex-1 flex flex-col ${th.card} ${th.cardBorder} rounded-2xl overflow-hidden`}>
        {/* header */}
        <div className={`flex items-center gap-2.5 p-3 border-b ${theme === 'milk' ? 'bg-white' : 'bg-black/20'}`} style={{ borderColor: 'rgba(128,128,128,0.15)' }}>
          <button onClick={() => setActiveId(null)} className={`sm:hidden p-1 rounded-lg cursor-pointer ${th.btnSecondary} ${th.btnSecondaryText}`}>
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center text-white text-[11px] font-black shrink-0">
            {(mode === 'buyer' ? company?.logoUrl : undefined)
              ? <img src={company!.logoUrl} alt="" className="w-full h-full object-cover" />
              : title.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className={`text-[12px] font-black truncate ${th.strongText}`}>{title}</div>
            <div className={`text-[9px] font-bold ${th.textDim}`}>
              {mode === 'buyer' ? (company?.phone || t('Muuzaji')) : active.buyerPhone}
            </div>
          </div>
        </div>

        {/* product context card */}
        {sharedProduct && (
          <div className={`mx-3 mt-3 p-2.5 rounded-xl flex items-center gap-2.5 border ${th.cardBorder}`}>
            <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
              {sharedProduct.image
                ? <img src={sharedProduct.image} alt="" className="w-full h-full object-cover" />
                : <Package className={`w-5 h-5 m-auto ${th.textDim}`} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-[10px] font-black truncate ${th.strongText}`}>{sharedProduct.name}</div>
              <div className={`text-[10px] font-bold ${th.brandText}`}>{TZS(sharedProduct.price)}</div>
            </div>
            {onOpenProduct && (
              <button onClick={() => onOpenProduct(sharedProduct)} className={`text-[9px] font-black px-2.5 py-1.5 rounded-lg cursor-pointer ${th.btnPrimary} ${th.btnPrimaryText}`}>
                {t('Tazama')}
              </button>
            )}
          </div>
        )}

        {/* messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {activeMessages.map(m => {
            const mine = mode === 'buyer' ? m.senderType === 'buyer' : m.senderType === 'company';
            if (m.messageType === 'system') {
              return (
                <div key={m.id} className="text-center">
                  <span className={`inline-block text-[9px] font-bold px-3 py-1 rounded-full ${th.chip} ${th.chipText} ${th.chipBorder}`}>{m.message}</span>
                </div>
              );
            }
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[78%] rounded-2xl px-3 py-2 ${mine ? 'bg-blue-600 text-white rounded-br-md' : (theme === 'milk' ? 'bg-gray-100 text-gray-800 rounded-bl-md' : 'bg-gray-700 text-gray-100 rounded-bl-md')}`}>
                  {m.messageType === 'image' && m.imageData && (
                    <img src={m.imageData} alt="" className="rounded-xl max-h-48 w-auto mb-1" />
                  )}
                  {m.messageType === 'product' && (() => {
                    const p = products.find(x => x.id === m.productId);
                    if (!p) return null;
                    return (
                      <button
                        onClick={() => onOpenProduct?.(p)}
                        className={`flex items-center gap-2 p-2 rounded-xl mb-1 cursor-pointer ${mine ? 'bg-blue-500' : (theme === 'milk' ? 'bg-white' : 'bg-gray-600')}`}
                      >
                        <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                          {p.image ? <img src={p.image} alt="" className="w-full h-full object-cover" /> : <Package className="w-5 h-5 m-auto" />}
                        </div>
                        <div className="text-left min-w-0">
                          <div className="text-[10px] font-black truncate max-w-[150px]">{p.name}</div>
                          <div className="text-[10px] font-bold opacity-90">{TZS(p.price)}</div>
                        </div>
                      </button>
                    );
                  })()}
                  {m.messageType !== 'image' && m.message && (
                    <div className="text-[11px] font-semibold whitespace-pre-wrap break-words">{m.message}</div>
                  )}
                  {m.translatedMessage && m.translatedMessage !== m.message && (
                    <div className={`mt-1 pt-1 border-t text-[9px] italic font-semibold flex items-start gap-1 ${mine ? 'border-white/25 text-blue-100' : 'opacity-70'}`} style={{ borderColor: mine ? undefined : 'rgba(128,128,128,0.3)' }}>
                      <Languages className="w-3 h-3 shrink-0 mt-0.5" />
                      <span>Translated: {m.translatedMessage}</span>
                    </div>
                  )}
                  <div className={`text-right text-[8px] font-bold mt-0.5 ${mine ? 'text-blue-200' : 'opacity-60'}`}>
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* composer */}
        <div className={`p-2.5 border-t flex items-end gap-2`} style={{ borderColor: 'rgba(128,128,128,0.15)' }}>
          <button onClick={() => fileRef.current?.click()} title={t('Tuma picha')} className={`p-2.5 rounded-xl cursor-pointer ${th.btnSecondary} ${th.btnSecondaryText}`}>
            <ImagePlus className="w-4.5 h-4.5" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onFile(e.target.files?.[0] || null); e.currentTarget.value = ''; }} />
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); } }}
            rows={1}
            placeholder={t('Andika ujumbe...')}
            className={`${th.input} !py-2.5 resize-none max-h-24 flex-1`}
          />
          {mode === 'buyer' && (
            <button
              onClick={() => {
                const p = sharedProduct || (active.productId ? products.find(x => x.id === active.productId) : null);
                if (p) send({ messageType: 'product', productId: p.id });
              }}
              disabled={!sharedProduct}
              title={t('Share product')}
              className={`p-2.5 rounded-xl cursor-pointer disabled:opacity-40 ${th.btnSecondary} ${th.btnSecondaryText}`}
            >
              <Package className="w-4.5 h-4.5" />
            </button>
          )}
          <button onClick={sendText} disabled={!draft.trim()} className={`p-2.5 rounded-xl cursor-pointer disabled:opacity-40 ${th.btnPrimary} ${th.btnPrimaryText}`}>
            <Send className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto pb-16">
      <div className="flex flex-col sm:flex-row gap-3 h-[calc(100vh-220px)] min-h-[480px]">
        {renderList()}
        {renderWindow()}
      </div>
    </div>
  );
}
