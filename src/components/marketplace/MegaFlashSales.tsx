import React, { useEffect, useMemo, useState } from 'react';
import { Zap, Clock, Trash2, Plus, X, Calendar, Percent } from 'lucide-react';
import { Company, FlashSale, MarketplaceProduct } from '../../types';
import { getPublicTheme, PublicTheme } from '../../utils/publicTheme';
import { TZS, TFunc } from './MarketplaceShared';
import { flashStatusFor, formatCountdown } from '../../utils/megaHelpers';

// ============================================================================
// F5 — FLASH SALE & COUNTDOWN
// ============================================================================

function useNowTick(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

interface SectionProps {
  theme: PublicTheme;
  t: TFunc;
  flashSales: FlashSale[];
  companies: Company[];
  onOpenProduct: (product: MarketplaceProduct) => void;
}

/** Homepage "🔥 OFA ZA KUPIGWA" horizontal scroll with live countdowns. */
export function FlashSalesSection({ theme, t, flashSales, companies, onOpenProduct }: SectionProps) {
  const th = getPublicTheme(theme);
  const now = useNowTick(1000);

  const active = useMemo(() =>
    flashSales
      .filter(s => s && s.startTime && s.endTime && flashStatusFor(s.startTime, s.endTime, now) === 'active')
      .sort((a, b) => new Date(a.endTime).getTime() - new Date(b.endTime).getTime()),
    [flashSales, now]
  );

  if (active.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className={`text-base md:text-lg font-black flex items-center gap-2 ${th.strongText}`}>
          <span className="relative flex w-8 h-8 items-center justify-center rounded-xl bg-red-500/15">
            <Zap className="w-5 h-5 text-red-500" />
          </span>
          {t('OFA ZA KUPIGWA - Zinaisha Muda')}
        </h2>
        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full bg-red-500/15 text-red-500 flex items-center gap-1`}>
          <Clock className="w-3 h-3" /> {t('LIVE')}
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
        {active.map(sale => {
          const company = companies.find(c => c.id === sale.companyId);
          const secsLeft = Math.max(0, Math.floor((new Date(sale.endTime).getTime() - now) / 1000));
          return (sale.items || []).map(item => {
            const product = {
              id: item.productId,
              companyId: sale.companyId,
              name: item.productName,
              slug: String(item.productId),
              description: '',
              price: item.flashPrice,
              stockQuantity: Math.max(0, item.stock - item.sold),
              image: item.productImage || ''
            } as MarketplaceProduct;
            const soldPct = item.stock > 0 ? Math.min(100, Math.round((item.sold / item.stock) * 100)) : 100;
            return (
              <button
                key={`${sale.id}-${item.productId}`}
                onClick={() => onOpenProduct(product)}
                className={`${th.card} ${th.cardBorder} rounded-2xl overflow-hidden shrink-0 w-[168px] text-left hover:brightness-105 transition cursor-pointer`}
              >
                <div className="relative aspect-square">
                  {item.productImage ? (
                    <img src={item.productImage} alt={item.productName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-yellow-400 to-amber-600 text-white text-xl font-black">
                      {item.productName.charAt(0)}
                    </div>
                  )}
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black">
                    -{Math.round(item.discountPercent)}%
                  </span>
                  <span className="absolute bottom-2 left-2 right-2 px-2 py-1 rounded-lg bg-black/75 text-white text-[9px] font-black flex items-center justify-center gap-1">
                    <Clock className="w-3 h-3 text-red-400" /> {formatCountdown(secsLeft)}
                  </span>
                </div>
                <div className="p-2.5 space-y-1">
                  <div className={`text-[11px] font-black truncate ${th.strongText}`}>{item.productName}</div>
                  <div className={`text-[9px] font-semibold truncate ${th.textDim}`}>{company?.name}</div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[14px] font-black text-red-500">{TZS(item.flashPrice)}</span>
                    <span className={`text-[9px] font-bold line-through ${th.textDim}`}>{TZS(item.originalPrice)}</span>
                  </div>
                  <div>
                    <div className="h-1.5 rounded-full bg-gray-500/25 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-orange-500 to-red-600" style={{ width: `${soldPct}%` }} />
                    </div>
                    <div className={`text-[8px] font-bold mt-0.5 ${th.textMuted}`}>
                      {t('Zimeuzwa')} {item.sold}/{item.stock}
                    </div>
                  </div>
                </div>
              </button>
            );
          });
        })}
      </div>
    </section>
  );
}

// ============================================================================
// COMPANY PANEL — flash sale CRUD
// ============================================================================

interface MgrProps {
  theme: PublicTheme;
  t: TFunc;
  companyId: number;
  flashSales: FlashSale[];
  products: MarketplaceProduct[];
  onSave: (sale: FlashSale) => void;
  onDelete: (saleId: number) => void;
}

export function CompanyFlashSalesManager({ theme, t, companyId, flashSales, products, onSave, onDelete }: MgrProps) {
  const th = getPublicTheme(theme);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [picked, setPicked] = useState<Record<number, string>>({}); // productId -> flash price
  const [stock, setStock] = useState<Record<number, string>>({});
  const [error, setError] = useState('');

  // Defensive: drop null/undefined/holes FIRST (a company-switch re-sync can briefly
  // supply an array with undefined entries; reading s.startTime on one is the exact
  // "Cannot read properties of undefined (reading 'startTime')" crash). Also guard
  // createdAt so a partial row can't throw in localeCompare.
  const mine = useMemo(() =>
    [...flashSales].filter(s => s && s.companyId === companyId).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [flashSales, companyId]
  );
  const now = useNowTick(30000);

  const toLocalInput = (d: Date) => {
    const pad = (v: number) => String(v).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const openForm = () => {
    setTitle('');
    setStart(toLocalInput(new Date(Date.now() + 60 * 1000)));
    setEnd(toLocalInput(new Date(Date.now() + 3 * 3600 * 1000)));
    setPicked({}); setStock({}); setError(''); setOpen(true);
  };

  const toggleProduct = (p: MarketplaceProduct) => {
    setPicked(prev => {
      const next = { ...prev };
      if (next[p.id] !== undefined) delete next[p.id];
      else next[p.id] = String(Math.max(1, Math.round(p.price * 0.8)));
      return next;
    });
  };

  const submit = () => {
    setError('');
    if (!title.trim()) return setError(t('Weka kichwa cha ofa.'));
    const st = new Date(start).getTime();
    const et = new Date(end).getTime();
    if (!st || !et) return setError(t('Weka muda wa kuanza na kuisha.'));
    if (st <= Date.now()) return setError(t('Muda wa kuanza lazima uwe baadaye.'));
    if (et <= st) return setError(t('Muda wa kuisha lazima uwe baada ya kuanza.'));
    const ids = Object.keys(picked).map(Number);
    if (ids.length === 0) return setError(t('Chagua angalau bidhaa moja.'));
    for (const id of ids) {
      const p = products.find(x => x.id === id);
      if (!p) continue;
      const fp = Number(picked[id]);
      if (!fp || fp <= 0) return setError(`${p.name}: ${t('weka bei sahihi ya ofa')}.`);
      if (fp >= p.price) return setError(`${p.name}: ${t('Bei ya ofa lazima iwe chini ya bei ya kawaida')}.`);
    }
    const items = ids.map(id => {
      const p = products.find(x => x.id === id)!;
      const flashPrice = Number(picked[id]);
      return {
        productId: p.id,
        productName: p.name,
        productImage: p.image || undefined,
        originalPrice: p.price,
        flashPrice,
        discountPercent: Math.round(((p.price - flashPrice) / p.price) * 10000) / 100,
        stock: Math.max(1, Number(stock[id]) || Math.min(50, p.stockQuantity || 10)),
        sold: 0
      };
    });
    const nowIso = new Date().toISOString();
    onSave({
      id: Date.now(),
      companyId,
      title: title.trim(),
      slug: title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `ofa-${Date.now()}`,
      startTime: new Date(st).toISOString(),
      endTime: new Date(et).toISOString(),
      status: 'upcoming',
      items,
      createdAt: nowIso
    });
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className={`text-xs font-black ${th.strongText}`}>{t('Flash Sales Zangu')}</h3>
        <button onClick={openForm} className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-black rounded-xl cursor-pointer ${th.btnPrimary} ${th.btnPrimaryText}`}>
          <Plus className="w-3.5 h-3.5" /> {t('Unda Flash Sale')}
        </button>
      </div>

      {mine.length === 0 && (
        <div className={`${th.card} ${th.cardBorder} rounded-2xl p-6 text-center`}>
          <Zap className={`w-8 h-8 mx-auto mb-2 ${th.textDim}`} />
          <div className={`text-[12px] font-black ${th.strongText}`}>{t('Hakuna flash sale bado')}</div>
          <div className={`text-[11px] ${th.textMuted} font-semibold mt-1`}>{t('Unda ofa ya muda mfupi — wateja wataona countdown moja kwa moja.')}</div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {mine.map(s => {
          const status = flashStatusFor(s.startTime, s.endTime, now);
          const statusCls = status === 'active' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
            : status === 'upcoming' ? 'bg-blue-500/15 text-blue-400 border-blue-500/40'
            : 'bg-gray-500/15 text-gray-400 border-gray-500/40';
          return (
            <div key={s.id} className={`${th.card} ${th.cardBorder} rounded-2xl p-4 space-y-2`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className={`text-xs font-black truncate ${th.strongText}`}>{s.title}</div>
                  <div className={`text-[10px] font-semibold ${th.textMuted}`}>
                    {s.startTime && s.endTime
                      ? `${new Date(s.startTime).toLocaleString()} → ${new Date(s.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : t('Ratiba haijabainishwa')}
                  </div>
                </div>
                <span className={`shrink-0 text-[9px] font-black uppercase px-2 py-1 rounded-full border ${statusCls}`}>{status}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(s.items || []).map(it => (
                  <span key={it.productId} className={`text-[9px] font-bold px-2 py-1 rounded-lg ${th.chip} ${th.chipText} ${th.chipBorder}`}>
                    {it.productName.slice(0, 18)} · {TZS(it.flashPrice)} (-{Math.round(it.discountPercent)}%) · {it.sold}/{it.stock}
                  </span>
                ))}
              </div>
              <button onClick={() => onDelete(s.id)} className="flex items-center gap-1 text-[10px] font-black text-red-400 hover:text-red-300 cursor-pointer w-fit">
                <Trash2 className="w-3 h-3" /> {t('Futa')}
              </button>
            </div>
          );
        })}
      </div>

      {/* create modal */}
      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className={`w-full max-w-lg max-h-[85vh] overflow-y-auto ${th.card} ${th.cardBorder} rounded-3xl p-5 space-y-4`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className={`text-sm font-black flex items-center gap-2 ${th.strongText}`}><Zap className="w-4 h-4 text-red-500" /> {t('Unda Flash Sale')}</h3>
              <button onClick={() => setOpen(false)} className={`p-1.5 rounded-lg cursor-pointer ${th.btnSecondary} ${th.btnSecondaryText}`}><X className="w-4 h-4" /></button>
            </div>

            <div>
              <label className={`block text-[10px] font-black uppercase mb-1 ${th.label}`}>{t('Kichwa cha Ofa')}</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('Mfano: OFA YA SAA 2 - Vitenge')} className={th.input} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-[10px] font-black uppercase mb-1 ${th.label}`}><Calendar className="w-3 h-3 inline mr-1" />{t('Kuanza')}</label>
                <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={th.input} />
              </div>
              <div>
                <label className={`block text-[10px] font-black uppercase mb-1 ${th.label}`}>{t('Kuisha')}</label>
                <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className={th.input} />
              </div>
            </div>

            <div>
              <label className={`block text-[10px] font-black uppercase mb-1.5 ${th.label}`}>{t('Chagua Bidhaa & Weka Bei ya Ofa')}</label>
              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                {products.map(p => {
                  const isPicked = picked[p.id] !== undefined;
                  return (
                    <div key={p.id} className={`rounded-xl border p-2.5 cursor-pointer transition ${isPicked ? 'border-amber-500 bg-amber-500/10' : th.cardBorder}`} onClick={() => toggleProduct(p)}>
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0">
                          {p.image ? <img src={p.image} alt="" className="w-full h-full object-cover" /> : <span className="w-full h-full flex items-center justify-center bg-gradient-to-br from-yellow-400 to-amber-600 text-white text-xs font-black">{(p.name || '-').charAt(0)}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-[11px] font-black truncate ${th.strongText}`}>{p.name}</div>
                          <div className={`text-[10px] font-bold ${th.textMuted}`}>{TZS(p.price)}</div>
                        </div>
                        {isPicked && <Percent className="w-4 h-4 text-amber-500 shrink-0" />}
                      </div>
                      {isPicked && (
                        <div className="grid grid-cols-2 gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                          <div>
                            <label className={`block text-[8px] font-black uppercase mb-0.5 ${th.label}`}>{t('Bei ya Flash (TZS)')}</label>
                            <input
                              type="number"
                              value={picked[p.id]}
                              onChange={(e) => setPicked(prev => ({ ...prev, [p.id]: e.target.value }))}
                              className={th.input + ' !py-1.5 !text-[11px]'}
                            />
                          </div>
                          <div>
                            <label className={`block text-[8px] font-black uppercase mb-0.5 ${th.label}`}>{t('Stock la Ofani')}</label>
                            <input
                              type="number"
                              value={stock[p.id] ?? ''}
                              onChange={(e) => setStock(prev => ({ ...prev, [p.id]: e.target.value }))}
                              placeholder="50"
                              className={th.input + ' !py-1.5 !text-[11px]'}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {error && <div className="text-[11px] font-bold text-red-400 bg-red-500/10 border border-red-500/40 rounded-lg px-3 py-2">{error}</div>}
            <button onClick={submit} className={`w-full px-4 py-3 text-[12px] font-black rounded-xl cursor-pointer ${th.btnPrimary} ${th.btnPrimaryText}`}>
              {t('Anzasha Ofa')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
