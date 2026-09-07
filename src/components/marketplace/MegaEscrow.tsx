import React, { useRef, useState } from 'react';
import {
  ChevronLeft, ShieldCheck, Lock, Unlock, AlertTriangle, CheckCircle2,
  Clock, Store, Package, Upload, X, Loader2, Banknote
} from 'lucide-react';
import { Company, MarketplaceOrder, ProductReturn, ReturnReason } from '../../types';
import { getPublicTheme, PublicTheme } from '../../utils/publicTheme';
import { TZS, TFunc, orderStatusLabel } from './MarketplaceShared';

// ============================================================================
// F1 — BUYER ORDER DETAIL WITH ESCROW STATUS + ACTIONS
// ============================================================================

interface Props {
  theme: PublicTheme;
  t: TFunc;
  order: MarketplaceOrder;
  company?: Company;
  returns: ProductReturn[];
  /** verify the viewer controls this order (session phone or typed phone) */
  identityPhone: string | null;
  onVerifyPhone: (phone: string) => boolean;
  onBack: () => void;
  onTrack: () => void;
  onOpenCompany: () => void;
  onConfirmDelivery: (orderId: number) => { ok: boolean; error?: string };
  onSubmitDispute: (order: MarketplaceOrder, input: {
    reason: ReturnReason;
    description: string;
    images: string[];
    desiredSolution: 'refund' | 'replacement';
  }) => { ok: boolean; error?: string };
}

const REASONS: Array<{ key: ReturnReason; label: string }> = [
  { key: 'damaged', label: 'Bidhaa imeharibika' },
  { key: 'wrong_item', label: 'Nimepokea bidhaa isiyo sahihi' },
  { key: 'not_as_described', label: 'Haitoshi maelezo ya tangazo' },
  { key: 'size_issue', label: 'Saizi haijafit' },
  { key: 'fake', label: 'Bidhaa bandia' },
  { key: 'late_delivery', label: 'Imechelewa sana' },
  { key: 'other', label: 'Nyingine' }
];

export default function MegaBuyerOrderDetail({
  theme, t, order, company, returns, identityPhone, onVerifyPhone, onBack, onTrack, onOpenCompany,
  onConfirmDelivery, onSubmitDispute
}: Props) {
  const th = getPublicTheme(theme);
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [disputeOpen, setDisputeOpen] = useState(false);

  const authorized = !!identityPhone && identityPhone === order.customerPhone;

  const existingReturn = returns.find(r => r.orderId === order.id);
  const isCod = order.paymentMethodType === 'cod';
  const escrowHeld = order.escrowStatus === 'held';
  const canConfirm = authorized && order.status === 'delivered' && escrowHeld;
  // MEGA BUILD F4: returns/disputes allowed within 7 days of delivery
  const RETURN_WINDOW_MS = 7 * 24 * 3600 * 1000;
  const withinReturnWindow = !order.deliveredAt || (Date.now() - new Date(order.deliveredAt).getTime()) <= RETURN_WINDOW_MS;
  const canDispute = authorized && order.status === 'delivered' && escrowHeld && !existingReturn && withinReturnWindow;

  // hours left in the 48h auto-release window
  let windowLeft: number | null = null;
  if (order.status === 'delivered' && escrowHeld) {
    const end = order.autoReleaseAt ? new Date(order.autoReleaseAt).getTime() : (order.deliveredAt ? new Date(order.deliveredAt).getTime() + 48 * 3600 * 1000 : null);
    if (end) windowLeft = Math.max(0, end - Date.now());
  }

  const tryVerify = () => {
    if (onVerifyPhone(phoneInput.trim())) { setPhoneError(''); setErr(''); }
    else setPhoneError(t('Namba ya simu hailingani na order hii.'));
  };

  const confirm = () => {
    setMsg(''); setErr('');
    const res = onConfirmDelivery(order.id);
    if (res.ok) setMsg(t('Asante! Pesa zimeachiliwa kwa muuzaji.'));
    else setErr(res.error || t('Imeshindikana.'));
  };

  if (!authorized) {
    return (
      <div className="max-w-md mx-auto space-y-5 pb-16">
        <button onClick={onBack} className={`flex items-center gap-1.5 text-[11px] font-bold ${th.textMuted} hover:underline cursor-pointer`}>
          <ChevronLeft className="w-4 h-4" /> {t('Back')}
        </button>
        <div className={`${th.card} ${th.cardBorder} rounded-2xl p-6 space-y-3`}>
          <div className={`w-12 h-12 mx-auto rounded-2xl flex items-center justify-center ${th.btnPrimary}`}><Lock className={`w-6 h-6 ${th.btnPrimaryText}`} /></div>
          <h2 className={`text-sm font-black text-center ${th.strongText}`}>{t('Thibitisha Namba Yako')}</h2>
          <p className={`text-[11px] ${th.textMuted} font-semibold text-center`}>{t('Weka namba ya simu uliyotumia kuweka order')} {order.orderNumber}</p>
          <input value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} placeholder="+255 7XX XXX XXX" className={th.input} />
          {phoneError && <div className="text-[11px] font-bold text-red-400 bg-red-500/10 border border-red-500/40 rounded-lg px-3 py-2">{phoneError}</div>}
          <button onClick={tryVerify} className={`w-full px-4 py-2.5 text-[11px] font-black rounded-xl cursor-pointer ${th.btnPrimary} ${th.btnPrimaryText}`}>{t('Endelea')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-16">
      <button onClick={onBack} className={`flex items-center gap-1.5 text-[11px] font-bold ${th.textMuted} hover:underline cursor-pointer`}>
        <ChevronLeft className="w-4 h-4" /> {t('My Orders')}
      </button>

      {/* header */}
      <div className={`${th.card} ${th.cardBorder} rounded-2xl p-5 space-y-3`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className={`text-base font-black ${th.strongText}`}>{t('Order')} {order.orderNumber}</h1>
            <div className={`text-[10px] font-semibold ${th.textMuted}`}>{new Date(order.createdAt).toLocaleString()}</div>
          </div>
          <span className={`shrink-0 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full border ${theme === 'milk' ? 'bg-gray-100 text-gray-700 border-gray-300' : 'bg-white/10 text-gray-200 border-white/20'}`}>
            {orderStatusLabel(order.status, t)}
          </span>
        </div>
        <button onClick={onOpenCompany} className={`flex items-center gap-1.5 text-[11px] font-bold cursor-pointer hover:underline ${th.brandText}`}>
          <Store className="w-3.5 h-3.5" /> {company?.name || t('Muuzaji')}
        </button>

        {/* items */}
        <div className="space-y-2 pt-1">
          {(order.items || []).map(it => (
            <div key={it.productId} className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                {it.productImage ? <img src={it.productImage} alt="" className="w-full h-full object-cover" />
                  : <Package className={`w-5 h-5 m-auto ${th.textDim}`} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-[11px] font-black truncate ${th.strongText}`}>{it.productName}</div>
                <div className={`text-[9px] font-semibold ${th.textDim}`}>{TZS(it.unitPrice)} × {it.quantity}</div>
              </div>
              <div className={`text-[11px] font-black ${th.strongText}`}>{TZS(it.subtotal)}</div>
            </div>
          ))}
        </div>
        <div className={`border-t pt-2 flex justify-between text-xs font-black`} style={{ borderColor: 'rgba(128,128,128,0.2)' }}>
          <span className={th.strongText}>{t('Total to Pay')}</span>
          <span className={th.statValue}>{TZS(order.totalAmount)}</span>
        </div>
      </div>

      {/* ESCROW BADGE */}
      {(escrowHeld || order.escrowStatus === 'disputed') && (
        <div className={`rounded-2xl p-4 border ${order.escrowStatus === 'disputed' ? 'bg-red-500/10 border-red-500/40' : 'bg-emerald-500/10 border-emerald-500/40'}`}>
          <div className="flex items-start gap-3">
            {order.escrowStatus === 'disputed'
              ? <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" />
              : <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />}
            <div className="space-y-1">
              <div className={`text-[12px] font-black ${order.escrowStatus === 'disputed' ? 'text-red-400' : 'text-emerald-400'}`}>
                {order.escrowStatus === 'disputed'
                  ? t('🔒 Mgomoro umefunguliwa — pesa zimesimamishwa')
                  : t('🔒 Pesa yako iko salama kwa GlobalTradeCore')}
              </div>
              <p className={`text-[11px] font-semibold leading-relaxed ${th.textMuted}`}>
                {order.escrowStatus === 'disputed'
                  ? t('Pesa zimewekwa baridi mpaka mgogoro utakaposuluhishwa na timu yetu.')
                  : t('Itaachiliwa muuzaji akisha deliver au baada ya masaa 48 bila mgogoro.')}
              </p>
              <div className={`text-[10px] font-black ${th.strongText}`}>{t('Kiasi kwenye Escrow')}: {TZS(order.escrowAmount || order.totalAmount)}</div>
              {windowLeft !== null && (
                <div className={`flex items-center gap-1.5 text-[10px] font-black ${th.chipText}`}>
                  <Clock className="w-3 h-3" /> {t('Auto-release baada ya masaa')} {Math.floor(windowLeft / 3600000)}h {Math.floor((windowLeft % 3600000) / 60000)}m
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {order.escrowStatus === 'released' && (
        <div className="rounded-2xl p-4 bg-emerald-500/10 border border-emerald-500/40 flex items-center gap-3">
          <Unlock className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <div className="text-[12px] font-black text-emerald-400">{t('Pesa Zimeachiliwa kwa Muuzaji')}</div>
            <div className={`text-[10px] font-semibold ${th.textMuted}`}>
              {order.escrowReleasedAt ? new Date(order.escrowReleasedAt).toLocaleString() : ''}
            </div>
          </div>
        </div>
      )}

      {isCod && order.status === 'delivered' && !order.codConfirmed && (
        <div className="rounded-2xl p-4 bg-amber-500/10 border border-amber-500/40 flex items-center gap-3">
          <Banknote className="w-5 h-5 text-amber-400 shrink-0" />
          <div className={`text-[11px] font-bold ${th.textMuted}`}>{t('Lipa Cash Baada ya Kupokea — muuzaji atathibitisha malipo yako.')}</div>
        </div>
      )}

      {/* messages */}
      {msg && (
        <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/40 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-3.5 h-3.5" /> {msg}
        </div>
      )}
      {err && <div className="text-[11px] font-bold text-red-400 bg-red-500/10 border border-red-500/40 rounded-lg px-3 py-2">{err}</div>}

      {/* actions */}
      {(canConfirm || canDispute) && (
        <div className="grid sm:grid-cols-2 gap-2">
          {canConfirm && (
            <button onClick={confirm} className={`flex items-center justify-center gap-2 px-4 py-3 text-[11px] font-black rounded-xl cursor-pointer ${th.btnPrimary} ${th.btnPrimaryText}`}>
              <CheckCircle2 className="w-4 h-4" /> {t('✅ Nimepokea - Achilia Pesa')}
            </button>
          )}
          {canDispute && (
            <button onClick={() => setDisputeOpen(true)} className="flex items-center justify-center gap-2 px-4 py-3 text-[11px] font-black rounded-xl cursor-pointer bg-red-500/15 text-red-400 border border-red-500/40 hover:bg-red-500/25">
              <AlertTriangle className="w-4 h-4" /> {t('❌ Fungua Mgogoro')}
            </button>
          )}
        </div>
      )}

      {existingReturn && (
        <div className={`${th.card} ${th.cardBorder} rounded-2xl p-4 space-y-1.5`}>
          <div className={`text-[11px] font-black ${th.strongText}`}>{t('Rudisha / Mgogoro')}: {REASONS.find(r => r.key === existingReturn.reason)?.label}</div>
          <div className={`text-[10px] font-semibold ${th.textMuted}`}>{t('Hali')}: <b>{existingReturn.status}</b> · {new Date(existingReturn.createdAt).toLocaleString()}</div>
          {existingReturn.responseNote && <div className={`text-[10px] font-semibold ${th.textMuted}`}>{t('Jibu la Muuzaji')}: {existingReturn.responseNote}</div>}
        </div>
      )}

      <button onClick={onTrack} className={`w-full px-4 py-2.5 text-[11px] font-black rounded-xl cursor-pointer ${th.btnSecondary} ${th.btnSecondaryText}`}>
        {t('Track Order')}
      </button>

      {disputeOpen && (
        <DisputeForm
          theme={theme}
          t={t}
          order={order}
          onClose={() => setDisputeOpen(false)}
          onSubmit={(input) => {
            const res = onSubmitDispute(order, input);
            if (res.ok) { setDisputeOpen(false); setMsg(t('Mgogoro umefunguliwa — timu yetu itawasiliana nawe.')); }
            else setErr(res.error || t('Imeshindikana.'));
            return res.ok;
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// F4 — DISPUTE / RETURN FORM (buyer)
// ============================================================================

function DisputeForm({ theme, t, order, onClose, onSubmit }: {
  theme: PublicTheme;
  t: TFunc;
  order: MarketplaceOrder;
  onClose: () => void;
  onSubmit: (input: { reason: ReturnReason; description: string; images: string[]; desiredSolution: 'refund' | 'replacement' }) => boolean;
}) {
  const th = getPublicTheme(theme);
  const [reason, setReason] = useState<ReturnReason>('damaged');
  const [description, setDescription] = useState('');
  const [solution, setSolution] = useState<'refund' | 'replacement'>('refund');
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    const room = 5 - images.length;
    Array.from(files).slice(0, room).forEach(f => {
      if (!f.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') setImages(prev => prev.length < 5 ? [...prev, reader.result as string] : prev);
      };
      reader.readAsDataURL(f);
    });
  };

  const submit = () => {
    setError('');
    if (description.trim().length < 10) return setError(t('Eleza kwa undani zaidi (angalau herufi 10).'));
    setSubmitting(true);
    const ok = onSubmit({ reason, description: description.trim(), images, desiredSolution: solution });
    setSubmitting(false);
    if (!ok) setError(t('Imeshindikana kutuma maombi.'));
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className={`w-full max-w-lg max-h-[88vh] overflow-y-auto ${th.card} ${th.cardBorder} rounded-3xl p-5 space-y-4`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className={`text-sm font-black flex items-center gap-2 ${th.strongText}`}><AlertTriangle className="w-4 h-4 text-red-500" /> {t('Rudisha / Fungua Mgogoro')}</h3>
          <button onClick={onClose} className={`p-1.5 rounded-lg cursor-pointer ${th.btnSecondary} ${th.btnSecondaryText}`}><X className="w-4 h-4" /></button>
        </div>
        <div className={`text-[10px] font-bold ${th.textMuted}`}>{t('Order')}: <span className="font-mono">{order.orderNumber}</span></div>

        <div>
          <label className={`block text-[10px] font-black uppercase mb-1 ${th.label}`}>{t('Sababu')} *</label>
          <select value={reason} onChange={(e) => setReason(e.target.value as ReturnReason)} className={th.input + ' cursor-pointer'}>
            {REASONS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </div>

        <div>
          <label className={`block text-[10px] font-black uppercase mb-1 ${th.label}`}>{t('Eleza Tatizo')} *</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder={t('Toa maelezo ya tatizo lako...')} className={th.input + ' resize-none'} />
        </div>

        <div>
          <label className={`block text-[10px] font-black uppercase mb-1 ${th.label}`}>{t('Suluhisho Unalotaka')}</label>
          <div className="grid grid-cols-2 gap-2">
            {(['refund', 'replacement'] as const).map(s => (
              <button key={s} onClick={() => setSolution(s)} className={`px-3 py-2.5 text-[11px] font-black rounded-xl border cursor-pointer transition ${solution === s ? 'border-amber-500 bg-amber-500/10 text-amber-500' : `${th.cardBorder} ${th.textMuted}`}`}>
                {s === 'refund' ? t('Pesa Yangu Nyuma') : t('Bidhaa Nyingine')}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={`block text-[10px] font-black uppercase mb-1 ${th.label}`}>{t('Picha (hadi 5)')}</label>
          <button onClick={() => fileRef.current?.click()} className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed text-[11px] font-bold cursor-pointer ${th.cardBorder} ${th.textMuted}`}>
            <Upload className="w-4 h-4" /> {t('Pakia picha za tatizo')}
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { onFiles(e.target.files); e.currentTarget.value = ''; }} />
          {images.length > 0 && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {images.map((img, i) => (
                <div key={i} className="relative">
                  <img src={img} alt="" className="w-14 h-14 rounded-lg object-cover" />
                  <button onClick={() => setImages(prev => prev.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`rounded-xl p-3 bg-amber-500/10 border border-amber-500/30 text-[10px] font-bold ${th.textMuted}`}>
          {t('🔒 Pesa zitasimamishwa kwenye escrow mara moja. Muuzaji ana siku 3 kujibu — akijibu, timu ya GlobalTradeCore itaamua mwisho.')}
        </div>

        {error && <div className="text-[11px] font-bold text-red-400 bg-red-500/10 border border-red-500/40 rounded-lg px-3 py-2">{error}</div>}
        <button onClick={submit} disabled={submitting} className={`w-full flex items-center justify-center gap-2 px-4 py-3 text-[12px] font-black rounded-xl cursor-pointer disabled:opacity-50 bg-red-600 text-white hover:bg-red-700`}>
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
          {t('Tuma Maombi ya Mgogoro')}
        </button>
      </div>
    </div>
  );
}
