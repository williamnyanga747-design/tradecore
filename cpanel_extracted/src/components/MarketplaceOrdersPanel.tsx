import React, { useMemo, useState } from 'react';
import { Package, CheckCircle2, XCircle, Truck, Search, ChevronDown, Store, Phone, MapPin, Calendar, FileText, ShieldCheck, Boxes, Lock, Archive, ArchiveRestore, Trash2, RotateCcw } from 'lucide-react';
import { Company, MarketplaceOrder, MarketplaceOrderStatus, User } from '../types';
import StatusStepper from './marketplace/StatusStepper';
import { TZS, orderStatusLabel } from './marketplace/MarketplaceShared';
import { sameId } from '../utils/idUtils';

interface Props {
  currentCompanyId?: string | number;
  orders: MarketplaceOrder[];
  companies: Company[];
  translate: (text: string) => string;
  currentUser: User | null;
  onUpdateStatus: (orderId: number, status: MarketplaceOrderStatus, reason?: string) => void;
  onMutateOrders?: (op: 'archive' | 'unarchive' | 'trash' | 'restore' | 'purge', ids: number[]) => void;
}

type ViewTab = 'all' | 'active' | 'archived' | 'trash';
type MutateOp = 'archive' | 'unarchive' | 'trash' | 'restore' | 'purge';

const STATUS_STYLE: Record<string, string> = {
  pending_verification: 'bg-amber-100 text-amber-700 border-amber-300',
  verified: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  processing: 'bg-blue-100 text-blue-700 border-blue-300',
  out_for_delivery: 'bg-purple-100 text-purple-700 border-purple-300',
  delivered: 'bg-green-100 text-green-700 border-green-300',
  rejected: 'bg-red-100 text-red-700 border-red-300'
};

export default function MarketplaceOrdersPanel({
  currentCompanyId, orders, companies, translate: t, currentUser, onUpdateStatus, onMutateOrders
}: Props) {
  const [filter, setFilter] = useState<MarketplaceOrderStatus | 'All'>('All');
  const [viewTab, setViewTab] = useState<ViewTab>('active');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmOp, setConfirmOp] = useState<{ op: MutateOp; ids: number[] } | null>(null);

  const companyFor = (id: number) => companies.find(c => sameId(c.id, id));

  const canManage = (order: MarketplaceOrder) =>
    !!currentUser && (currentUser.role === 'Super Admin' || sameId(currentUser.companyId, order.companyId));

  const matchesView = (o: MarketplaceOrder, v: ViewTab) => {
    switch (v) {
      case 'active': return !o.archivedAt && !o.deletedAt;
      case 'archived': return !!o.archivedAt && !o.deletedAt;
      case 'trash': return !!o.deletedAt;
      default: return !o.deletedAt;
    }
  };

  const scopedOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders
      .filter(o => !currentCompanyId || sameId(o.companyId, currentCompanyId))
      .filter(o => matchesView(o, viewTab))
      .filter(o => filter === 'All' || o.status === filter)
      .filter(o => !q || o.orderNumber.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q) || o.customerPhone.replace(/\s/g, '').includes(q.replace(/\s/g, '')))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [orders, currentCompanyId, filter, search, viewTab]);

  const viewCounts = useMemo(() => {
    const base = currentCompanyId ? orders.filter(o => sameId(o.companyId, currentCompanyId)) : orders;
    return {
      all: base.filter(o => !o.deletedAt).length,
      active: base.filter(o => !o.archivedAt && !o.deletedAt).length,
      archived: base.filter(o => !!o.archivedAt && !o.deletedAt).length,
      trash: base.filter(o => !!o.deletedAt).length
    };
  }, [orders, currentCompanyId]);

  const stats = useMemo(() => {
    const base = currentCompanyId ? orders.filter(o => sameId(o.companyId, currentCompanyId) && !o.deletedAt) : orders.filter(o => !o.deletedAt);
    return {
      pending: base.filter(o => o.status === 'pending_verification').length,
      active: base.filter(o => ['verified', 'processing', 'out_for_delivery'].includes(o.status)).length,
      delivered: base.filter(o => o.status === 'delivered').length,
      rejected: base.filter(o => o.status === 'rejected').length,
      revenue: base.filter(o => o.status === 'delivered' || o.status === 'verified').reduce((s, o) => s + o.totalAmount, 0),
      archived: base.filter(o => !!o.archivedAt).length
    };
  }, [orders, currentCompanyId]);

  const nextAction = (status: MarketplaceOrderStatus): { label: string; next: MarketplaceOrderStatus; color: string } | null => {
    switch (status) {
      case 'pending_verification': return { label: t('Verify Payment'), next: 'verified', color: 'bg-emerald-600 hover:bg-emerald-700' };
      case 'verified': return { label: t('Start Processing'), next: 'processing', color: 'bg-blue-600 hover:bg-blue-700' };
      case 'processing': return { label: t('Out for Delivery'), next: 'out_for_delivery', color: 'bg-purple-600 hover:bg-purple-700' };
      case 'out_for_delivery': return { label: t('Mark Delivered'), next: 'delivered', color: 'bg-green-600 hover:bg-green-700' };
      default: return null;
    }
  };

  const countLabel = t('orders');

  const visibleIds = scopedOrders.map(o => o.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selected.has(id));
  const toggleSel = (id: number) => setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAllVisible = () => setSelected(prev => {
    const n = new Set(prev);
    if (visibleIds.every(id => n.has(id))) visibleIds.forEach(id => n.delete(id));
    else visibleIds.forEach(id => n.add(id));
    return n;
  });

  const runOp = (op: MutateOp, ids: number[]) => {
    if (!onMutateOrders || !ids.length) return;
    onMutateOrders(op, ids);
    setSelected(new Set());
    setConfirmOp(null);
  };

  const bulkButtons: { label: string; op: MutateOp; cls: string; icon: React.ReactNode }[] =
    viewTab === 'trash'
      ? [
          { label: t('Restore selected'), op: 'restore', cls: 'text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200', icon: <RotateCcw className="w-3.5 h-3.5" /> },
          { label: t('Delete Forever'), op: 'purge', cls: 'text-white bg-red-600 hover:bg-red-700', icon: <Trash2 className="w-3.5 h-3.5" /> }
        ]
      : viewTab === 'archived'
        ? [{ label: t('Unarchive selected'), op: 'unarchive', cls: 'text-gray-700 bg-gray-100 hover:bg-gray-200', icon: <ArchiveRestore className="w-3.5 h-3.5" /> }]
        : [
            { label: t('Archive selected'), op: 'archive', cls: 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200', icon: <Archive className="w-3.5 h-3.5" /> },
            { label: t('Delete selected'), op: 'trash', cls: 'text-red-600 bg-red-50 hover:bg-red-100 border border-red-200', icon: <Trash2 className="w-3.5 h-3.5" /> }
          ];

  const emptyText = viewTab === 'archived' ? t('No archived orders yet.') : viewTab === 'trash' ? t('Trash is empty.') : t('Orders placed on the public marketplace will appear here.');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-100 text-amber-600">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">{t('Marketplace Orders')}</h2>
            <p className="text-xs text-gray-500 font-medium">{t('Verify payments and manage delivery of public storefront orders.')}</p>
            <p className="text-[11px] text-indigo-500 font-semibold mt-0.5 inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> {t('Delivered orders are kept for TRA compliance and can be archived.')}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: t('Pending'), value: stats.pending, cls: 'text-amber-600 bg-amber-50 border-amber-200' },
          { label: t('Active'), value: stats.active, cls: 'text-blue-600 bg-blue-50 border-blue-200' },
          { label: t('Delivered'), value: stats.delivered, cls: 'text-green-600 bg-green-50 border-green-200' },
          { label: t('Rejected'), value: stats.rejected, cls: 'text-red-600 bg-red-50 border-red-200' },
          { label: t('Revenue'), value: stats.revenue, cls: 'text-emerald-700 bg-emerald-50 border-emerald-200', money: true }
        ].map(s => (
          <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.cls}`}>
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">{s.label}</div>
            <div className="text-lg font-black mt-0.5">{s.money ? TZS(s.value) : s.value}</div>
          </div>
        ))}
      </div>

      {/* View tabs */}
      <div className="flex flex-wrap items-center gap-1.5">
        {([
          { key: 'all' as ViewTab, label: t('All') },
          { key: 'active' as ViewTab, label: t('Active') },
          { key: 'archived' as ViewTab, label: t('Archived') },
          { key: 'trash' as ViewTab, label: t('Trash') }
        ]).map(v => (
          <button
            key={v.key}
            onClick={() => { setViewTab(v.key); setFilter('All'); setSelected(new Set()); setExpanded(null); }}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black rounded-lg transition cursor-pointer ${viewTab === v.key ? 'bg-brand text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            {v.key === 'archived' && <Archive className="w-3.5 h-3.5" />}
            {v.key === 'trash' && <Trash2 className="w-3.5 h-3.5" />}
            {v.label}
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${viewTab === v.key ? 'bg-white/25' : 'bg-gray-100'}`}>{viewCounts[v.key]}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-2 items-stretch">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('Search order number, name or phone...')}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand text-gray-800 font-medium placeholder:text-gray-400"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {(['All', 'pending_verification', 'verified', 'processing', 'out_for_delivery', 'delivered', 'rejected'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s as MarketplaceOrderStatus | 'All')}
              className={`shrink-0 px-3 py-2 text-[10px] font-black rounded-lg transition cursor-pointer ${filter === s ? 'bg-brand text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {s === 'All' ? t('All') : orderStatusLabel(s, t)}
            </button>
          ))}
        </div>
        {visibleIds.length > 0 && (
          <label className="shrink-0 inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg cursor-pointer select-none">
            <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} className="w-4 h-4 accent-amber-500 cursor-pointer" />
            <span className="text-[10px] font-black text-gray-600">{t('Select all')}</span>
          </label>
        )}
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && onMutateOrders && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-gray-900 rounded-xl">
          <span className="text-[11px] font-black text-white mr-1">{selected.size} {t('selected')}</span>
          {bulkButtons.map(b => (
            <button
              key={b.op}
              onClick={() => {
                const ids = [...selected];
                if (b.op === 'trash') setConfirmOp({ op: 'trash', ids });
                else if (b.op === 'purge') setConfirmOp({ op: 'purge', ids });
                else runOp(b.op, ids);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold rounded-lg transition cursor-pointer ${b.cls}`}
            >
              {b.icon} {b.label}
            </button>
          ))}
          <button onClick={() => setSelected(new Set())} className="ml-auto text-[11px] font-bold text-gray-400 hover:text-white transition cursor-pointer">{t('Cancel')}</button>
        </div>
      )}

      {/* List */}
      {scopedOrders.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-10 text-center">
          <Package className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <div className="text-sm font-bold text-gray-700">{t('No orders found')}</div>
          <div className="text-xs text-gray-400 font-medium mt-1">{emptyText}</div>
        </div>
      ) : (
        <div className="space-y-3">
          {scopedOrders.map(o => {
            const company = companyFor(o.companyId);
            const action = nextAction(o.status);
            const isExpanded = expanded === o.id;
            const qty = (o.items || []).reduce((s, i) => s + i.quantity, 0);
            const trashed = !!o.deletedAt;
            const archivedRow = !!o.archivedAt;
            return (
              <div key={o.id} className={`bg-white border rounded-xl overflow-hidden ${trashed ? 'border-red-200 opacity-90' : archivedRow ? 'border-indigo-100' : 'border-gray-100'}`}>
                {/* Row header */}
                <div className="flex items-stretch hover:bg-gray-50/60 transition">
                  {!trashed && onMutateOrders && (
                    <div className="flex items-center pl-4">
                      <input
                        type="checkbox"
                        checked={selected.has(o.id)}
                        onChange={() => toggleSel(o.id)}
                        className="w-4 h-4 accent-amber-500 cursor-pointer"
                      />
                    </div>
                  )}
                  <button
                    onClick={() => setExpanded(isExpanded ? null : o.id)}
                    className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3 text-left cursor-pointer"
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-black text-xs shrink-0 ${trashed ? 'bg-gray-400' : o.status === 'rejected' ? 'bg-red-500' : o.status === 'delivered' ? 'bg-green-600' : o.status === 'pending_verification' ? 'bg-amber-500' : 'bg-blue-600'}`}>
                      {o.orderNumber.slice(-4)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-gray-900">{o.orderNumber}</span>
                        <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${trashed ? 'bg-gray-100 text-gray-500 border-gray-300' : STATUS_STYLE[o.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {trashed ? t('Deleted — in Trash') : orderStatusLabel(o.status, t)}
                        </span>
                        {archivedRow && !trashed && (
                          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full border bg-indigo-50 text-indigo-600 border-indigo-200 inline-flex items-center gap-1">
                            <Archive className="w-2.5 h-2.5" /> {t('Archived')}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-500 font-medium mt-0.5 truncate">
                        {o.customerName} · {o.customerPhone} · {qty} {qty !== 1 ? t('items') : t('item')} · {new Date(o.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-black text-gray-900">{TZS(o.totalAmount)}</div>
                      <div className="flex items-center gap-1 text-[9px] text-gray-400 font-semibold justify-end">
                        <Store className="w-3 h-3" /> {company?.name || '-'}
                      </div>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-4 space-y-4">
                    {!trashed && <StatusStepper status={o.status} rejectionReason={o.rejectionReason} />}

                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Items */}
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">{t('Items')}</div>
                        <div className="space-y-1.5">
                          {(o.items || []).map((it, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span className="text-gray-700 font-medium">{it.productName} × {it.quantity}</span>
                              <span className="text-gray-900 font-bold">{TZS(it.subtotal)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Customer & payment */}
                      <div className="space-y-2 text-xs">
                        <div className="text-[10px] font-black uppercase tracking-wider text-gray-400">{t('Customer & Delivery')}</div>
                        <div className="flex items-center gap-1.5 text-gray-600 font-medium"><Phone className="w-3.5 h-3.5 text-gray-400" /> {o.customerPhone} ({o.customerName})</div>
                        <div className="flex items-center gap-1.5 text-gray-600 font-medium"><MapPin className="w-3.5 h-3.5 text-gray-400" /> {[o.customerRegion, o.customerDistrict, o.customerWard, o.customerStreet].filter(Boolean).join(', ')}</div>
                        {o.deliveryInstructions && <div className="text-gray-500 italic">{t('Note:')} {o.deliveryInstructions}</div>}
                        <div className="flex items-center gap-1.5 text-gray-600 font-medium"><FileText className="w-3.5 h-3.5 text-gray-400" /> {t(o.paymentMethodType.replace(/_/g, ' '))} · <span className="font-bold">{o.transactionId}</span> · {TZS(o.amountPaid)}</div>
                        {o.receiptImage && (
                          <a href={o.receiptImage} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand font-bold hover:underline">
                            <ShieldCheck className="w-3.5 h-3.5" /> {t('View payment receipt')}
                          </a>
                        )}
                        {o.verifiedBy && (
                          <div className="flex items-center gap-1.5 text-gray-500 font-medium"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> {t('Verified by')} {o.verifiedBy}{o.verifiedById ? ` (${t('user ID')} ${o.verifiedById})` : ''}{o.verifiedAt ? ` · ${new Date(o.verifiedAt).toLocaleString()}` : ''}</div>
                        )}
                        <div className="flex items-center gap-1.5 text-gray-500 font-medium"><Calendar className="w-3.5 h-3.5 text-gray-400" /> {new Date(o.createdAt).toLocaleString()}</div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100">
                      {trashed ? (
                        <>
                          <span className="flex items-center gap-1.5 text-[11px] font-bold text-red-500"><Trash2 className="w-3.5 h-3.5" /> {t('Deleted — in Trash')}</span>
                          {canManage(o) && onMutateOrders && (
                            <>
                              <button
                                onClick={() => runOp('restore', [o.id])}
                                className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5" /> {t('Restore')}
                              </button>
                              <button
                                onClick={() => setConfirmOp({ op: 'purge', ids: [o.id] })}
                                className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> {t('Delete Forever')}
                              </button>
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          {!canManage(o) && (
                            <span className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400">
                              <Lock className="w-3.5 h-3.5" /> {t('Only staff of this company can manage this order.')}
                            </span>
                          )}

                          {canManage(o) && action && (
                            <button
                              onClick={() => onUpdateStatus(o.id, action.next)}
                              className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold text-white rounded-lg transition cursor-pointer ${action.color}`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> {action.label}
                            </button>
                          )}

                          {canManage(o) && o.status === 'pending_verification' && rejecting !== o.id && (
                            <button
                              onClick={() => { setRejecting(o.id); setRejectReason(''); }}
                              className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" /> {t('Reject')}
                            </button>
                          )}

                          {rejecting === o.id && (
                            <div className="flex flex-wrap items-center gap-2 w-full">
                              <input
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder={t('Reason for rejection...')}
                                className="flex-1 min-w-[200px] px-3 py-2 border border-gray-200 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-red-400/30 focus:border-red-400 text-gray-800"
                              />
                              <button
                                onClick={() => { onUpdateStatus(o.id, 'rejected', rejectReason.trim() || t('No reason provided')); setRejecting(null); }}
                                className="px-4 py-2 text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
                              >
                                {t('Confirm Reject')}
                              </button>
                              <button onClick={() => setRejecting(null)} className="px-3 py-2 text-[11px] font-bold text-gray-500 hover:bg-gray-100 rounded-lg cursor-pointer">
                                {t('Cancel')}
                              </button>
                            </div>
                          )}

                          {canManage(o) && o.status === 'delivered' && !o.archivedAt && onMutateOrders && (
                            <button
                              onClick={() => runOp('archive', [o.id])}
                              className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition cursor-pointer"
                            >
                              <Archive className="w-3.5 h-3.5" /> {t('Archive')}
                            </button>
                          )}

                          {canManage(o) && o.archivedAt && onMutateOrders && (
                            <>
                              <span className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-500"><Archive className="w-3.5 h-3.5" /> {t('Archived — kept for TRA records')}</span>
                              <button
                                onClick={() => runOp('unarchive', [o.id])}
                                className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition cursor-pointer"
                              >
                                <ArchiveRestore className="w-3.5 h-3.5" /> {t('Unarchive')}
                              </button>
                            </>
                          )}

                          {canManage(o) && (o.status === 'pending_verification' || o.status === 'rejected') && onMutateOrders && (
                            <button
                              onClick={() => setConfirmOp({ op: 'trash', ids: [o.id] })}
                              className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> {t('Delete')}
                            </button>
                          )}

                          {o.status === 'rejected' && (
                            <span className="flex items-center gap-1.5 text-[11px] font-bold text-red-500">
                              <XCircle className="w-3.5 h-3.5" /> {t('Rejected')}: {o.rejectionReason || '-'}
                            </span>
                          )}
                          {o.status === 'delivered' && (
                            <span className="flex items-center gap-1.5 text-[11px] font-bold text-green-600">
                              <Truck className="w-3.5 h-3.5" /> {t('Delivered — order complete')}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {scopedOrders.length > 0 && (
        <div className="text-center text-[10px] text-gray-400 font-semibold">
          {scopedOrders.length} {countLabel} · {t('You can also track from the staff dashboard')} <Boxes className="inline w-3 h-3" />
        </div>
      )}

      {confirmOp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 max-w-sm w-full p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-red-100 text-red-600 shrink-0"><Trash2 className="w-5 h-5" /></div>
              <div>
                <div className="text-sm font-bold text-gray-900">{confirmOp.op === 'purge' ? t('Delete Forever') : t('Delete')}</div>
                <div className="text-xs text-gray-500 font-medium mt-1">
                  {confirmOp.op === 'purge' ? t('Permanently delete selected orders from Trash? This cannot be undone.') : t('This order will be moved to Trash. Continue?')}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmOp(null)} className="px-3 py-2 text-[11px] font-bold text-gray-500 hover:bg-gray-100 rounded-lg cursor-pointer">{t('Cancel')}</button>
              <button
                onClick={() => runOp(confirmOp.op, confirmOp.ids)}
                className={`px-4 py-2 text-[11px] font-bold text-white rounded-lg cursor-pointer ${confirmOp.op === 'purge' ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-800 hover:bg-black'}`}
              >
                {confirmOp.op === 'purge' ? t('Delete Forever') : t('Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
