import React, { useMemo, useState } from 'react';
import { ChevronLeft, AlertTriangle, CheckCircle2, XCircle, Package, Send, ShieldCheck, MessageSquare } from 'lucide-react';
import { Company, Dispute, DisputeMessage, MarketplaceOrder, ProductReturn } from '../../types';
import { getPublicTheme, PublicTheme } from '../../utils/publicTheme';
import { TZS, TFunc } from './MarketplaceShared';

const REASON_LABEL: Record<string, string> = {
  wrong_item: 'Bidhaa isiyo sahihi',
  damaged: 'Imeharibika',
  not_as_described: 'Haitoshi maelezo',
  size_issue: 'Saizi haijafit',
  fake: 'Bandia',
  late_delivery: 'Imechelewa',
  other: 'Nyingine'
};

// ============================================================================
// F4 — COMPANY RETURNS PANEL
// ============================================================================

interface CompanyProps {
  theme: PublicTheme;
  t: TFunc;
  companyId: number;
  returns: ProductReturn[];
  orders: MarketplaceOrder[];
  onApprove: (returnId: number, note?: string) => void;
  onReject: (returnId: number, note: string) => void;
}

export function CompanyReturnsPanel({ theme, t, companyId, returns, orders, onApprove, onReject }: CompanyProps) {
  const th = getPublicTheme(theme);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'All'>('pending');
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [note, setNote] = useState('');

  const mine = useMemo(() =>
    returns.filter(r => r.companyId === companyId)
      .filter(r => filter === 'All' ? true : filter === 'pending' ? r.status === 'pending' : r.status === filter)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [returns, companyId, filter]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 flex-wrap">
        {(['pending', 'approved', 'rejected', 'All'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 text-[11px] font-black rounded-lg transition cursor-pointer ${filter === f ? `${th.btnPrimary} ${th.btnPrimaryText}` : `text-gray-500 hover:text-gray-700`}`}>
            {f === 'All' ? t('Zote') : f}
          </button>
        ))}
      </div>

      {mine.length === 0 && (
        <div className={`${th.card} ${th.cardBorder} rounded-2xl p-6 text-center`}>
          <Package className={`w-8 h-8 mx-auto mb-2 ${th.textDim}`} />
          <div className={`text-[12px] font-black ${th.strongText}`}>{t('Hakuna maombi ya marejesho')}</div>
        </div>
      )}

      <div className="space-y-3">
        {mine.map(r => {
          const order = orders.find(o => o.id === r.orderId);
          return (
            <div key={r.id} className={`${th.card} ${th.cardBorder} rounded-2xl p-4 space-y-3`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className={`text-xs font-black ${th.strongText}`}>{t('Order')} <span className="font-mono">{r.orderNumber}</span></div>
                  <div className={`text-[10px] font-semibold ${th.textMuted}`}>{r.buyerName} · {r.buyerPhone} · {new Date(r.createdAt).toLocaleString()}</div>
                </div>
                <span className={`shrink-0 text-[9px] font-black uppercase px-2 py-1 rounded-full border ${
                  r.status === 'pending' ? 'bg-amber-500/15 text-amber-500 border-amber-500/40'
                  : r.status === 'rejected' ? 'bg-red-500/15 text-red-400 border-red-500/40'
                  : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'}`}>
                  {r.status}
                </span>
              </div>

              <div className={`rounded-xl p-3 space-y-1 ${theme === 'milk' ? 'bg-gray-50' : 'bg-white/5'}`}>
                <div className={`text-[11px] font-black ${th.strongText}`}>{REASON_LABEL[r.reason] || r.reason}</div>
                <div className={`text-[11px] font-semibold ${th.textMuted}`}>{r.description}</div>
                <div className={`text-[10px] font-bold ${th.brandText}`}>
                  {r.desiredSolution === 'refund' ? t('Anataka: Pesa Yangu Nyuma') : t('Anataka: Bidhaa Nyingine')}
                  {order ? ` · ${TZS(order.totalAmount)}` : ''}
                </div>
              </div>

              {r.images && r.images.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {r.images.map((img, i) => <img key={i} src={img} alt="" className="w-16 h-16 rounded-lg object-cover border" style={{ borderColor: 'rgba(128,128,128,0.25)' }} />)}
                </div>
              )}

              {r.status === 'pending' && (
                rejecting === r.id ? (
                  <div className="space-y-2">
                    <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Sababu ya kukataa...')} className={th.input} />
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => { if (note.trim()) { onReject(r.id, note.trim()); setRejecting(null); setNote(''); } }}
                        className="px-3 py-2 text-[10px] font-black rounded-xl cursor-pointer bg-red-600 text-white">{t('Kataa na Sababu')}</button>
                      <button onClick={() => { setRejecting(null); setNote(''); }} className={`px-3 py-2 text-[10px] font-black rounded-xl cursor-pointer ${th.btnSecondary} ${th.btnSecondaryText}`}>{t('Ghairi')}</button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => onApprove(r.id)} className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-[10px] font-black rounded-xl cursor-pointer bg-emerald-600 text-white hover:bg-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {t('Kubali Rudisha Pesa')}
                    </button>
                    <button onClick={() => setRejecting(r.id)} className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-[10px] font-black rounded-xl cursor-pointer bg-red-500/15 text-red-400 border border-red-500/40">
                      <XCircle className="w-3.5 h-3.5" /> {t('Kataa')}
                    </button>
                  </div>
                )
              )}
              {r.responseNote && r.status !== 'pending' && (
                <div className={`text-[10px] font-semibold ${th.textMuted}`}>{t('Jibu lako')}: {r.responseNote}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// F4 — ADMIN DISPUTE CENTER (ROOT)
// ============================================================================

interface AdminProps {
  theme: PublicTheme;
  t: TFunc;
  disputes: Dispute[];
  disputeMessages: DisputeMessage[];
  returns: ProductReturn[];
  orders: MarketplaceOrder[];
  companies: Company[];
  onResolve: (disputeId: number, outcome: 'buyer' | 'seller', resolution: string) => { ok: boolean; error?: string };
  onSetUnderReview: (disputeId: number) => void;
  onAddAdminNote: (disputeId: number, note: string) => void;
  onAddDisputeMessage: (disputeId: number, message: string) => void;
}

export function AdminDisputeCenter({ theme, t, disputes, disputeMessages, returns, orders, companies, onResolve, onSetUnderReview, onAddAdminNote, onAddDisputeMessage }: AdminProps) {
  const th = getPublicTheme(theme);
  const [filter, setFilter] = useState<'open' | 'under_review' | 'resolved'>('open');
  const [activeId, setActiveId] = useState<number | null>(null);
  const [resolution, setResolution] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [reply, setReply] = useState('');

  const list = useMemo(() =>
    disputes.filter(d =>
      filter === 'resolved'
        ? d.status === 'resolved_buyer' || d.status === 'resolved_seller' || d.status === 'closed'
        : d.status === filter
    ).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [disputes, filter]
  );

  const active = disputes.find(d => d.id === activeId) || null;

  if (active) {
    const order = orders.find(o => o.id === active.orderId);
    const ret = active.returnId ? returns.find(r => r.id === active.returnId) : undefined;
    const company = companies.find(c => c.id === active.companyId);
    const msgs = disputeMessages.filter(m => m.disputeId === active.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const resolved = active.status === 'resolved_buyer' || active.status === 'resolved_seller';

    return (
      <div className="space-y-4">
        <button onClick={() => setActiveId(null)} className={`flex items-center gap-1.5 text-[11px] font-bold text-gray-400 hover:text-gray-200 cursor-pointer`}>
          <ChevronLeft className="w-4 h-4" /> {t('Disputes zote')}
        </button>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-black text-white">{t('Mgogoro')} #{active.id} — {t('Order')} <span className="font-mono">{active.orderNumber}</span></div>
              <div className="text-[10px] font-semibold text-gray-400">
                {active.buyerName} ({active.buyerPhone}) vs {company?.name} · {new Date(active.createdAt).toLocaleString()}
              </div>
            </div>
            <span className={`shrink-0 text-[9px] font-black uppercase px-2 py-1 rounded-full border ${
              active.status === 'open' ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
              : active.status === 'under_review' ? 'bg-blue-500/15 text-blue-300 border-blue-500/40'
              : active.status === 'resolved_buyer' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
              : 'bg-purple-500/15 text-purple-300 border-purple-500/40'}`}>
              {active.status.replace('_', ' ')}
            </span>
          </div>
          <div className="rounded-xl bg-white/5 p-3 space-y-1">
            <div className="text-[11px] font-black text-white">{REASON_LABEL[active.reason] || active.reason}</div>
            <div className="text-[11px] text-gray-300 font-semibold">{active.description}</div>
            {ret?.images && ret.images.length > 0 && (
              <div className="flex gap-2 pt-1 flex-wrap">
                {ret.images.map((img, i) => <img key={i} src={img} alt="" className="w-14 h-14 rounded-lg object-cover" />)}
              </div>
            )}
            {order && <div className="text-[10px] font-bold text-amber-400 pt-1">{t('Thamani ya Escrow')}: {TZS(order.escrowAmount || order.totalAmount)}</div>}
          </div>
        </div>

        {/* conversation */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-2">
          <div className="text-xs font-black text-white flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5 text-amber-400" /> {t('Soga ya Mgogoro')}</div>
          <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
            {msgs.length === 0 && <div className="text-[10px] text-gray-500 font-semibold">{t('Hakuna ujumbe bado.')}</div>}
            {msgs.map(m => (
              <div key={m.id} className={`max-w-[85%] rounded-xl px-3 py-2 ${m.senderType === 'admin' ? 'ml-auto bg-amber-500/20 text-amber-100' : m.senderType === 'buyer' ? 'bg-blue-500/15 text-blue-100' : 'bg-gray-700/60 text-gray-100'}`}>
                <div className="text-[8px] font-black uppercase opacity-70">{m.senderName} ({m.senderType})</div>
                <div className="text-[11px] font-semibold">{m.message}</div>
              </div>
            ))}
          </div>
          {!resolved && (
            <div className="flex gap-2 pt-1">
              <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder={t('Andika ujumbe kwa pande zote...')} className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-[11px] text-white placeholder-gray-500 outline-none focus:border-amber-500" />
              <button onClick={() => { if (reply.trim()) { onAddDisputeMessage(active.id, reply.trim()); setReply(''); } }}
                className="px-3 py-2 rounded-xl bg-amber-500 text-black text-[10px] font-black cursor-pointer flex items-center gap-1"><Send className="w-3.5 h-3.5" /></button>
            </div>
          )}
        </div>

        {/* admin actions */}
        {!resolved && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
            <div className="text-xs font-black text-white flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> {t('Amua Mgogoro')}</div>
            <textarea value={resolution} onChange={(e) => setResolution(e.target.value)} rows={2} placeholder={t('Sababu za uamuzi...')} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-[11px] text-white placeholder-gray-500 outline-none focus:border-amber-500 resize-none" />
            <div className="grid sm:grid-cols-3 gap-2">
              <button onClick={() => { if (resolution.trim()) { onResolve(active.id, 'buyer', resolution.trim()); setActiveId(null); setResolution(''); } }}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-[10px] font-black rounded-xl cursor-pointer bg-emerald-600 text-white hover:bg-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" /> {t('Mkomo wa Mnunuzi — Rejesha Pesa')}
              </button>
              <button onClick={() => { if (resolution.trim()) { onResolve(active.id, 'seller', resolution.trim()); setActiveId(null); setResolution(''); } }}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-[10px] font-black rounded-xl cursor-pointer bg-purple-600 text-white hover:bg-purple-700">
                <CheckCircle2 className="w-3.5 h-3.5" /> {t('Mkomo wa Muuzaji — Achilia Escrow')}
              </button>
              <button onClick={() => onSetUnderReview(active.id)}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-[10px] font-black rounded-xl cursor-pointer bg-blue-600/20 text-blue-300 border border-blue-500/40">
                <AlertTriangle className="w-3.5 h-3.5" /> {t('Weka Chini ya Uchunguzi')}
              </button>
            </div>
            <div className="flex gap-2">
              <input value={adminNote} onChange={(e) => setAdminNote(e.target.value)} placeholder={t('Maelezo ya ndani ya admin...')} className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-[11px] text-white placeholder-gray-500 outline-none focus:border-amber-500" />
              <button onClick={() => { if (adminNote.trim()) { onAddAdminNote(active.id, adminNote.trim()); setAdminNote(''); } }}
                className="px-3 py-2 rounded-xl bg-gray-700 text-white text-[10px] font-black cursor-pointer">{t('Hifadhi Note')}</button>
            </div>
            {active.adminNotes && <div className="text-[10px] text-gray-400 font-semibold italic">Notes: {active.adminNotes}</div>}
          </div>
        )}

        {active.resolution && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <div className="text-[11px] font-black text-white">{t('Uamuzi')}</div>
            <div className="text-[11px] text-gray-300 font-semibold mt-1">{active.resolution}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 flex-wrap">
        {(['open', 'under_review', 'resolved'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 text-[11px] font-black rounded-lg transition cursor-pointer ${filter === f ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-gray-200'}`}>
            {f === 'open' ? t('Wazi') : f === 'under_review' ? t('Chini ya Uchunguzi') : t('Zimesuluhishwa')}
          </button>
        ))}
      </div>

      {list.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center">
          <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-gray-600" />
          <div className="text-[12px] font-black text-white">{t('Hakuna disputes hapa')}</div>
        </div>
      )}

      <div className="space-y-2.5">
        {list.map(d => {
          const company = companies.find(c => c.id === d.companyId);
          return (
            <button key={d.id} onClick={() => setActiveId(d.id)}
              className="w-full bg-gray-900 border border-gray-800 rounded-2xl p-4 text-left hover:border-amber-500/50 transition cursor-pointer">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-black text-white">#{d.id} · <span className="font-mono">{d.orderNumber}</span> · {company?.name}</div>
                  <div className="text-[10px] text-gray-400 font-semibold mt-0.5 truncate">{d.buyerName}: {REASON_LABEL[d.reason] || d.reason} — {d.description.slice(0, 80)}</div>
                </div>
                <span className={`shrink-0 text-[9px] font-black uppercase px-2 py-1 rounded-full border ${
                  d.status === 'open' ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                  : d.status === 'under_review' ? 'bg-blue-500/15 text-blue-300 border-blue-500/40'
                  : d.status === 'resolved_buyer' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                  : 'bg-purple-500/15 text-purple-300 border-purple-500/40'}`}>
                  {d.status.replace('_', ' ')}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
