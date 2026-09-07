import React, { useState } from 'react';
import {
  ShieldCheck, Clock, BadgeCheck, XCircle, Smartphone, X, Eye, Plus, Trash2, History,
  CalendarDays, RefreshCcw, Search, CreditCard, LayoutGrid, AlertTriangle, MessageSquare, CheckCircle2
} from 'lucide-react';
import { SubscriptionMeta, Company, PaymentConfirmationRequest, SubscriptionPlan, PayNumbersConfig, ContactMessage } from '../types';
import { formatMoney } from '../utils/format';

interface SubscriptionManagementPanelProps {
  meta: SubscriptionMeta;
  companies: Company[];
  currentUserName: string;
  translate: (text: string) => string;
  currency: string;
  exchangeRate: number;
  onSaveMeta: (meta: SubscriptionMeta) => void;
  onApprove: (requestId: string, months: number, note?: string) => void;
  onReject: (requestId: string, note: string) => void;
  onRenew: (companyId: number, months: number, note?: string) => void;
  onDeleteCompany: (companyId: number) => void;
  contactMessages: ContactMessage[];
  onMarkContactAnswered: (msgId: number) => void;
  onDeleteContactMessage: (msgId: number) => void;
}

const periodOptions = [
  { label: '1 Month', months: 1 },
  { label: '3 Months', months: 3 },
  { label: '6 Months', months: 6 },
  { label: '1 Year', months: 12 },
  { label: '2 Years', months: 24 },
  { label: 'Custom', months: 0 }
];

export default function SubscriptionManagementPanel({
  meta, companies, translate: t, currency, exchangeRate,
  onSaveMeta, onApprove, onReject, onRenew, onDeleteCompany,
  contactMessages, onMarkContactAnswered, onDeleteContactMessage
}: SubscriptionManagementPanelProps) {
  const [tab, setTab] = useState<'approvals' | 'periods' | 'plans' | 'paynumbers' | 'history' | 'sms'>('periods');
  const [search, setSearch] = useState('');
  const [lightbox, setLightbox] = useState<{ url: string; title: string } | null>(null);
  const [approveTarget, setApproveTarget] = useState<PaymentConfirmationRequest | null>(null);
  const [approvePeriod, setApprovePeriod] = useState(1);
  const [approveCustomMonths, setApproveCustomMonths] = useState(18);
  const [approveNote, setApproveNote] = useState('');
  const [rejectTarget, setRejectTarget] = useState<PaymentConfirmationRequest | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [renewTarget, setRenewTarget] = useState<Company | null>(null);
  const [renewPeriod, setRenewPeriod] = useState(1);
  const [renewCustomMonths, setRenewCustomMonths] = useState(12);
  const [renewNote, setRenewNote] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>(meta.plans || []);
  const [payNumbers, setPayNumbers] = useState<PayNumbersConfig>(meta.payNumbers);
  const [plansDirty, setPlansDirty] = useState(false);
  const [payDirty, setPayDirty] = useState(false);

  // --- Currency-aware money display (canonical plan amount is TZS) ---
  const usdOfTZS = (tzs: number) => (tzs / 2600);
  const money = (tzs: number, usd?: number) => {
    const rate = exchangeRate > 0 ? exchangeRate : 2600;
    const base = usd && usd > 0 ? usd : usdOfTZS(tzs);
    return formatMoney(base, currency, rate);
  };

  const q = search.trim().toLowerCase();
  const matchesSearch = (...fields: Array<string | undefined>) =>
    !q || fields.some(f => (f || '').toLowerCase().includes(q));

  const allRequests = meta.paymentRequests || [];
  const pending = allRequests.filter(r => r.status === 'Pending' || r.status === 'Resubmitted');
  const history = allRequests.filter(r => r.status === 'Approved' || r.status === 'Rejected');

  // --- SMS / contact inquiries report ---
  const smsMessages = contactMessages || [];
  const smsNew = smsMessages.filter(m => m.status === 'new').length;
  const filteredSms = smsMessages.filter(m => matchesSearch(m.name, m.email, m.phone, m.subject, m.message));

  // --- Company period helpers ---
  const todayStr = new Date().toISOString().split('T')[0];
  const fmtDate = (d?: string | null) => {
    if (!d) return '—';
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    return new Date(d).toLocaleDateString();
  };
  const isDemoExpired = (c: Company) => !!c.isDemo && !!c.demoExpiresAt && todayStr > c.demoExpiresAt.split('T')[0];
  const daysLeftFor = (c: Company): number | null => {
    const end = c.isDemo ? c.demoExpiresAt : c.subscriptionEnd;
    if (!end) return null;
    const endMs = /^\d{4}-\d{2}-\d{2}$/.test(end) ? new Date(end + 'T23:59:59').getTime() : new Date(end).getTime();
    return Math.ceil((endMs - Date.now()) / 86400000);
  };
  const displayStatus = (c: Company): string => {
    if (c.isDemo) return isDemoExpired(c) ? 'Expired' : 'Demo';
    if (c.subscriptionEnd && todayStr > c.subscriptionEnd) return 'Expired';
    return c.status || 'Active';
  };

  // --- Stat cards ---
  const activeCount = companies.filter(c => displayStatus(c) === 'Active').length;
  const pendingAccounts = companies.filter(c => c.status === 'Pending Payment' || c.status === 'Rejected').length;
  const blockedCount = companies.filter(c => displayStatus(c) === 'Expired').length;

  const statCards: Array<{
    label: string; value: number; sub: string; icon: React.ElementType;
    border: string; text: string; bg: string; iconWrap: string;
  }> = [
    { label: 'Pending Confirmations', value: pending.length, sub: 'Awaiting Super Admin verification', icon: Clock, border: 'border-amber-500/40', text: 'text-amber-400', bg: 'bg-amber-500/10', iconWrap: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    { label: 'Active Subscriptions', value: activeCount, sub: 'Fully Verified & Operational', icon: BadgeCheck, border: 'border-emerald-500/40', text: 'text-emerald-400', bg: 'bg-emerald-500/10', iconWrap: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    { label: 'Pending Payment Accounts', value: pendingAccounts, sub: 'Requires Approval', icon: CreditCard, border: 'border-blue-500/40', text: 'text-blue-400', bg: 'bg-blue-500/10', iconWrap: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
    { label: 'Blocked / Expired', value: blockedCount, sub: 'Subscription Action Required', icon: XCircle, border: 'border-red-500/40', text: 'text-red-400', bg: 'bg-red-500/10', iconWrap: 'bg-red-500/15 text-red-400 border-red-500/30' }
  ];

  // --- Filtered data by search ---
  const filteredCompanies = companies.filter(c =>
    matchesSearch(c.name, c.country, c.paymentReference, c.planName)
  );
  const filteredPending = pending.filter(r =>
    matchesSearch(r.companyName, r.userName, r.userEmail, r.userPhone, r.paymentReference)
  );
  const filteredHistory = history.filter(r =>
    matchesSearch(r.companyName, r.userName, r.userEmail, r.paymentReference)
  );

  const savePlans = () => {
    onSaveMeta({ ...meta, plans });
    setPlansDirty(false);
  };

  const savePayNumbers = () => {
    onSaveMeta({ ...meta, payNumbers });
    setPayDirty(false);
  };

  const updatePlan = (id: number, patch: Partial<SubscriptionPlan>) => {
    setPlans(plans.map(p => (p.id === id ? { ...p, ...patch } : p)));
    setPlansDirty(true);
  };

  const addPlan = () => {
    const newId = Math.max(0, ...plans.map(p => p.id)) + 1;
    setPlans([...plans, { id: newId, name: 'New Plan', priceTZS: 0, months: 1, features: [], isActive: true }]);
    setPlansDirty(true);
  };

  const removePlan = (id: number) => {
    setPlans(plans.filter(p => p.id !== id));
    setPlansDirty(true);
  };

  const setPay = (key: keyof PayNumbersConfig, val: string) => {
    setPayNumbers({ ...payNumbers, [key]: val });
    setPayDirty(true);
  };

  const tabs: Array<{ key: typeof tab; label: string; icon: React.ElementType; badge?: number }> = [
    { key: 'approvals', label: 'Pending Payment Queue', icon: Clock, badge: pending.length },
    { key: 'periods', label: 'Company Subscription Periods', icon: CalendarDays },
    { key: 'history', label: 'Approval History Ledger', icon: History },
    { key: 'paynumbers', label: 'Pay Numbers (USSD)', icon: Smartphone },
    { key: 'plans', label: 'Subscription Plans Setup', icon: LayoutGrid },
    { key: 'sms', label: 'SMS Inquiries', icon: MessageSquare, badge: smsNew }
  ];

  const statusBadge = (r: PaymentConfirmationRequest) => {
    if (r.status === 'Approved') return <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase">Approved</span>;
    if (r.status === 'Rejected') return <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 uppercase">Rejected</span>;
    if (r.status === 'Resubmitted') return <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 uppercase">Resubmitted</span>;
    return <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 uppercase">Pending</span>;
  };

  const companyStatusBadge = (status: string) => {
    const cls =
      status === 'Active' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
      status === 'Demo' ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' :
      status === 'Expired' ? 'bg-gray-500/15 text-gray-400 border-gray-500/30' :
      status === 'Rejected' ? 'bg-red-500/15 text-red-400 border-red-500/30' :
      'bg-amber-500/15 text-amber-400 border-amber-500/30';
    return <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase border ${cls}`}>{status}</span>;
  };

  const daysLeftBadge = (days: number | null) => {
    if (days === null) return <span className="text-[10px] text-gray-500 font-bold">—</span>;
    if (days < 0) return <span className="text-[10px] font-black text-red-400">Expired</span>;
    if (days === 0) return <span className="text-[10px] font-black text-amber-400">Today</span>;
    return <span className="text-[10px] font-black text-emerald-400">{days} {days === 1 ? 'day' : 'days'}</span>;
  };

  const inputCls = 'w-full px-3 py-2 border border-white/10 rounded-lg text-xs bg-white/5 text-white outline-none focus:ring-2 focus:ring-emerald-500/30 placeholder-gray-500 font-bold';

  return (
    <div className="space-y-4">
      {/* ===== CONTROL CENTER HEADER + STAT CARDS ===== */}
      <div className="bg-[#1f242d] rounded-2xl border border-white/10 shadow-xl p-5 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Subscriptions & Payments Control
            </h2>
            <p className="text-[11px] text-gray-400 font-semibold mt-1">
              Super Admin Control Center — verify payments, manage subscription periods, and configure plans & pay numbers.
            </p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by company, user, or ref #..."
              className="w-full pl-9 pr-3 py-2 bg-[#2d323e] border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statCards.map(card => (
            <div key={card.label} className={`bg-[#2d323e] rounded-xl border ${card.border} p-4 relative overflow-hidden`}>
              <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full ${card.bg} blur-2xl`}></div>
              <div className="flex items-start justify-between relative">
                <div>
                  <div className="text-2xl font-black text-white leading-none">{card.value}</div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-2">{card.label}</div>
                  <div className={`text-[10px] font-semibold mt-1 ${card.text}`}>{card.sub}</div>
                </div>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${card.iconWrap}`}>
                  <card.icon className="w-4.5 h-4.5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== PILL TAB NAVIGATION ===== */}
      <div className="flex flex-wrap items-center gap-1 bg-[#1f242d] rounded-xl p-1.5 border border-white/10">
        {tabs.map(tb => {
          const active = tab === tb.key;
          return (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold rounded-lg transition cursor-pointer ${
                active
                  ? 'bg-emerald-500 text-[#0b0e12] shadow-lg shadow-emerald-500/20'
                  : 'text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              <tb.icon className={`w-3.5 h-3.5 ${active ? 'text-[#0b0e12]' : 'text-gray-500'}`} />
              {tb.label}
              {tb.badge !== undefined && (
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${active ? 'bg-[#0b0e12]/20 text-[#0b0e12]' : 'bg-amber-500/20 text-amber-400'}`}>
                  {tb.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ===== APPROVALS (PENDING PAYMENT QUEUE) ===== */}
      {tab === 'approvals' && (
        <div className="bg-[#2d323e] rounded-xl border border-white/10 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-xs font-black text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" /> Pending Payment Queue
              </div>
              <div className="text-[10px] text-gray-400 font-semibold mt-0.5">
                New registrations awaiting payment verification.
              </div>
            </div>
            <span className="text-[10px] text-amber-400 font-black bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded-full">
              {pending.length} pending
            </span>
          </div>
          {filteredPending.length === 0 ? (
            <div className="p-8 text-center text-xs font-semibold text-gray-500">
              {q ? 'No requests match your search.' : 'No pending payment requests. New registrations will appear here for verification.'}
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {filteredPending.map(r => (
                <div key={r.id} className="p-4 flex flex-col md:flex-row md:items-start gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black text-white">{r.companyName}</span>
                      {statusBadge(r)}
                    </div>
                    <div className="text-[11px] text-gray-400 font-semibold">
                      {r.userName} • {r.userEmail} • {r.userPhone}
                    </div>
                    <div className="grid sm:grid-cols-3 gap-1.5 pt-1">
                      <div className="bg-black/25 rounded-lg p-2 border border-white/5">
                        <div className="text-[9px] text-gray-500 uppercase font-bold">Plan</div>
                        <div className="text-[11px] font-black text-white">{r.planName} — {money(r.amount)}</div>
                      </div>
                      <div className="bg-black/25 rounded-lg p-2 border border-white/5">
                        <div className="text-[9px] text-gray-500 uppercase font-bold">Method</div>
                        <div className="text-[11px] font-black text-white">{r.paymentMethod}</div>
                      </div>
                      <div className="bg-black/25 rounded-lg p-2 border border-white/5">
                        <div className="text-[9px] text-gray-500 uppercase font-bold">Reference</div>
                        <div className="text-[11px] font-mono font-black text-emerald-400">{r.paymentReference}</div>
                      </div>
                    </div>
                    {r.adminNote && (
                      <div className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 font-semibold">
                        Note: {r.adminNote}
                      </div>
                    )}
                    <div className="text-[9px] text-gray-500 font-semibold">Requested {new Date(r.requestedAt).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-2 md:flex-col shrink-0">
                    {r.receiptImageUrl && (
                      <button
                        onClick={() => setLightbox({ url: r.receiptImageUrl!, title: `${r.companyName} — Receipt` })}
                        className="flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white text-[10px] font-bold rounded-lg"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Receipt
                      </button>
                    )}
                    <button
                      onClick={() => { setApproveTarget(r); setApprovePeriod(1); setApproveCustomMonths(18); setApproveNote(''); }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg"
                    >
                      <BadgeCheck className="w-3.5 h-3.5" /> Activate
                    </button>
                    <button
                      onClick={() => { setRejectTarget(r); setRejectNote(''); }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold rounded-lg"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== COMPANY SUBSCRIPTION PERIODS ===== */}
      {tab === 'periods' && (
        <div className="bg-[#2d323e] rounded-xl border border-white/10 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-xs font-black text-white flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-emerald-400" /> Company Subscription Periods
              </div>
              <div className="text-[10px] text-gray-400 font-semibold mt-0.5">
                Overview of every company assigned in the system with its subscription period and remaining time.
              </div>
            </div>
            <span className="text-[10px] text-gray-400 font-bold bg-white/5 border border-white/10 px-2 py-1 rounded-full">
              {companies.length} {companies.length === 1 ? 'company' : 'companies'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 bg-black/25 text-[10px] text-gray-500 uppercase font-black tracking-wider">
                  <th className="px-4 py-2.5">Company Name</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Plan</th>
                  <th className="px-4 py-2.5">Start Date</th>
                  <th className="px-4 py-2.5">Expiry Date</th>
                  <th className="px-4 py-2.5">Days Left</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCompanies.map(c => {
                  const st = displayStatus(c);
                  const days = daysLeftFor(c);
                  const reviewable = c.status === 'Pending Payment' || c.status === 'Rejected';
                  const expiry = c.isDemo ? c.demoExpiresAt : c.subscriptionEnd;
                  return (
                    <tr key={c.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-4 py-2.5">
                        <div className="text-xs font-black text-white">{c.name}</div>
                        {c.country && <div className="text-[9px] text-gray-500 font-semibold">{c.country}</div>}
                      </td>
                      <td className="px-4 py-2.5">{companyStatusBadge(st)}</td>
                      <td className="px-4 py-2.5 text-xs font-semibold text-gray-300">{c.planName || '—'}</td>
                      <td className="px-4 py-2.5 text-[11px] font-mono text-gray-400">{fmtDate(c.subscriptionStart)}</td>
                      <td className="px-4 py-2.5 text-[11px] font-mono text-gray-400">{fmtDate(expiry)}</td>
                      <td className="px-4 py-2.5">{daysLeftBadge(days)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {reviewable ? (
                            <button
                              onClick={() => setTab('approvals')}
                              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-[#1f242d] text-[10px] font-black rounded-lg"
                            >
                              Review
                            </button>
                          ) : (
                            <button
                              onClick={() => { setRenewTarget(c); setRenewPeriod(1); setRenewCustomMonths(12); setRenewNote(''); }}
                              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg"
                            >
                              <RefreshCcw className="w-3 h-3" />
                              {c.isDemo ? 'Convert to Paid' : st === 'Expired' ? 'Reactivate' : 'Renew / Extend'}
                            </button>
                          )}
                          <button
                            onClick={() => setDeleteTarget(c)}
                            title="Delete company & accounts"
                            className="p-1.5 text-red-400 hover:text-white hover:bg-red-500/80 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredCompanies.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-xs font-semibold text-gray-500">
                      {q ? 'No companies match your search.' : 'No companies assigned in the system yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== PLANS ===== */}
      {tab === 'plans' && (
        <div className="bg-[#2d323e] rounded-xl border border-white/10 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-white flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-emerald-400" /> Subscription Plans (shown to registering users)
            </span>
            <button onClick={addPlan} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg">
              <Plus className="w-3.5 h-3.5" /> Add Plan
            </button>
          </div>
          <div className="space-y-2">
            {plans.map(p => (
              <div key={p.id} className="border border-white/10 rounded-xl p-3 grid md:grid-cols-12 gap-2 items-center bg-black/15">
                <div className="md:col-span-3">
                  <input
                    value={p.name}
                    onChange={(e) => updatePlan(p.id, { name: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div className="md:col-span-2">
                  <input
                    type="number"
                    value={p.priceTZS}
                    onChange={(e) => updatePlan(p.id, { priceTZS: Number(e.target.value) })}
                    className={inputCls}
                    title="Price TZS"
                  />
                </div>
                <div className="md:col-span-1">
                  <input
                    type="number"
                    value={p.months}
                    onChange={(e) => updatePlan(p.id, { months: Number(e.target.value) })}
                    className={inputCls}
                    title="Months"
                  />
                </div>
                <div className="md:col-span-2">
                  <input
                    value={p.priceUSD || ''}
                    placeholder="USD"
                    onChange={(e) => updatePlan(p.id, { priceUSD: e.target.value ? Number(e.target.value) : undefined })}
                    className={inputCls}
                  />
                </div>
                <div className="md:col-span-2 flex items-center gap-3">
                  <label className="flex items-center gap-1 text-[10px] font-bold text-gray-400">
                    <input type="checkbox" checked={p.isActive} onChange={(e) => updatePlan(p.id, { isActive: e.target.checked })} />
                    Active
                  </label>
                  <label className="flex items-center gap-1 text-[10px] font-bold text-gray-400">
                    <input type="checkbox" checked={!!p.isMostPopular} onChange={(e) => updatePlan(p.id, { isMostPopular: e.target.checked })} />
                    Popular
                  </label>
                </div>
                <div className="md:col-span-2 flex items-center justify-end gap-1">
                  <input
                    value={(p.features || []).join(', ')}
                    onChange={(e) => updatePlan(p.id, { features: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                    className={inputCls + ' text-[10px]'}
                    placeholder="Features (comma separated)"
                  />
                  <button onClick={() => removePlan(p.id)} className="p-1.5 text-red-400 hover:bg-red-500/80 hover:text-white rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {plansDirty && (
            <button onClick={savePlans} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg">
              Save Plans
            </button>
          )}
        </div>
      )}

      {/* ===== PAY NUMBERS ===== */}
      {tab === 'paynumbers' && (
        <div className="bg-[#2d323e] rounded-xl border border-white/10 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-black text-white">
            <Smartphone className="w-4 h-4 text-emerald-400" /> Pay Numbers (USSD Settings)
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {([
              ['mpesa', 'Payment Provider A (Mobile Money)'],
              ['tigopesa', 'Payment Provider B (Mobile Money)'],
              ['airtel', 'Payment Provider C (Mobile Money)'],
              ['bankName', 'Bank Name'],
              ['bankAccount', 'Bank Account Number'],
              ['bankHolder', 'Account Holder Name']
            ] as [keyof PayNumbersConfig, string][]).map(([key, label]) => (
              <div key={key} className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</label>
                <input
                  value={payNumbers[key] || ''}
                  onChange={(e) => setPay(key, e.target.value)}
                  className={inputCls + ' font-mono'}
                />
              </div>
            ))}
            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Payment Instructions / Notes</label>
              <textarea
                value={payNumbers.instructions || ''}
                onChange={(e) => setPay('instructions', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-white/10 rounded-lg text-xs bg-white/5 text-white outline-none focus:ring-2 focus:ring-emerald-500/30 font-semibold"
              />
            </div>
          </div>
          {payDirty && (
            <button onClick={savePayNumbers} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg">
              Save Pay Numbers
            </button>
          )}
        </div>
      )}

      {/* ===== HISTORY / AUDIT TRAIL ===== */}
      {tab === 'history' && (
        <div className="bg-[#2d323e] rounded-xl border border-white/10 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-xs font-black text-white flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-400" /> Approval History Ledger
              </div>
              <div className="text-[10px] text-gray-400 font-semibold mt-0.5">
                Full payment audit trail of approved and rejected requests.
              </div>
            </div>
            <span className="text-[10px] text-gray-400 font-bold bg-white/5 border border-white/10 px-2 py-1 rounded-full">
              {history.length} records
            </span>
          </div>
          {filteredHistory.length === 0 ? (
            <div className="p-8 text-center text-xs font-semibold text-gray-500">
              {q ? 'No records match your search.' : 'No approved or rejected requests yet — the full payment audit trail will appear here.'}
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {filteredHistory.map(r => (
                <div key={r.id} className="p-4 flex flex-col md:flex-row md:items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black text-white">{r.companyName}</span>
                      {statusBadge(r)}
                    </div>
                    <div className="text-[11px] text-gray-400 font-semibold">
                      {r.userName} • {money(r.amount)} • {r.paymentMethod} • Ref: <span className="font-mono text-emerald-400">{r.paymentReference}</span>
                    </div>
                    <div className="text-[10px] text-gray-500 font-semibold">
                      Requested {new Date(r.requestedAt).toLocaleString()}
                      {r.decidedAt ? ` • Decided ${new Date(r.decidedAt).toLocaleString()} by ${r.decidedBy || 'Super Admin'}` : ''}
                    </div>
                    {r.adminNote && (
                      <div className="text-[10px] mt-1 text-gray-300 bg-white/5 border border-white/10 rounded-lg p-2 font-semibold">
                        Admin note: {r.adminNote}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.receiptImageUrl && (
                      <button
                        onClick={() => setLightbox({ url: r.receiptImageUrl!, title: `${r.companyName} — Receipt` })}
                        className="flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white text-[10px] font-bold rounded-lg"
                      >
                        <Eye className="w-3.5 h-3.5" /> Receipt
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== SMS INQUIRIES (FAQ & CONTACT REPORT) ===== */}
      {tab === 'sms' && (
        <div className="bg-[#2d323e] rounded-xl border border-white/10 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-xs font-black text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-amber-400" /> SMS Inquiries Report
              </div>
              <div className="text-[10px] text-gray-400 font-semibold mt-0.5">
                Messages submitted from the homepage FAQ &amp; Contact form. Contact the user by phone or email to answer.
              </div>
            </div>
            <span className="text-[10px] text-amber-400 font-black bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded-full">
              {smsNew} new · {smsMessages.length} total
            </span>
          </div>
          {filteredSms.length === 0 ? (
            <div className="p-8 text-center text-xs font-semibold text-gray-500">
              {q ? 'No inquiries match your search.' : 'No contact inquiries yet. Messages from the homepage FAQ & Contact form will appear here for you to answer by phone or email.'}
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {filteredSms.map(m => (
                <div key={m.id} className="p-4 flex flex-col md:flex-row md:items-start gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black text-white">{m.name}</span>
                      {m.status === 'new' ? (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 uppercase">New</span>
                      ) : (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase">Answered</span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-400 font-semibold flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span>{m.email}</span>
                      {m.phone && <span>• <a href={`tel:${m.phone}`} className="text-emerald-400 hover:underline">{m.phone}</a></span>}
                      {m.email && <span>• <a href={`mailto:${m.email}`} className="text-emerald-400 hover:underline">Reply by Email</a></span>}
                    </div>
                    <div className="grid sm:grid-cols-1 gap-1.5 pt-1">
                      <div className="bg-black/25 rounded-lg p-2 border border-white/5">
                        <div className="text-[9px] text-gray-500 uppercase font-bold">Subject</div>
                        <div className="text-[11px] font-black text-white">{m.subject || 'General Inquiry'}</div>
                      </div>
                      <div className="bg-black/25 rounded-lg p-2 border border-white/5">
                        <div className="text-[9px] text-gray-500 uppercase font-bold">Message</div>
                        <div className="text-[11px] font-semibold text-gray-200 whitespace-pre-wrap">{m.message}</div>
                      </div>
                    </div>
                    <div className="text-[9px] text-gray-500 font-semibold">Received {new Date(m.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-2 md:flex-col shrink-0">
                    {m.status === 'new' && (
                      <button
                        onClick={() => onMarkContactAnswered(m.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Mark Answered
                      </button>
                    )}
                    <button
                      onClick={() => onDeleteContactMessage(m.id)}
                      title="Delete inquiry"
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-500/80 hover:bg-red-600 text-white text-[10px] font-bold rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== APPROVE MODAL ===== */}
      {approveTarget && (
        <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#2d323e] rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 border border-white/10">
            <div className="flex items-center gap-2">
              <BadgeCheck className="w-5 h-5 text-emerald-400" />
              <span className="text-sm font-black text-white">Confirm Payment & Activate Subscription</span>
            </div>
            <p className="text-[11px] text-gray-400 font-semibold">
              {approveTarget.companyName} — {approveTarget.planName} ({money(approveTarget.amount)})
            </p>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Subscription Period</label>
              <select
                value={approvePeriod}
                onChange={(e) => setApprovePeriod(Number(e.target.value))}
                className="w-full px-3 py-2 border border-white/10 rounded-lg text-xs bg-white/5 text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                {periodOptions.map(o => (
                  <option key={o.label} value={o.months} className="text-gray-900">{o.label}</option>
                ))}
              </select>
            </div>
            {approvePeriod === 0 && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Custom Months</label>
                <input
                  type="number"
                  value={approveCustomMonths}
                  onChange={(e) => setApproveCustomMonths(Number(e.target.value))}
                  placeholder="e.g. 18"
                  className="w-full px-3 py-2 border border-white/10 rounded-lg text-xs bg-white/5 text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Admin Note (optional)</label>
              <input
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
                placeholder="Optional note shown to the company"
                className="w-full px-3 py-2 border border-white/10 rounded-lg text-xs bg-white/5 text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setApproveTarget(null)} className="px-3 py-2 text-xs font-bold text-gray-400 hover:text-white rounded-lg">Cancel</button>
              <button
                onClick={() => {
                  onApprove(approveTarget.id, approvePeriod === 0 ? approveCustomMonths : approvePeriod, approveNote);
                  setApproveTarget(null);
                  setApproveNote('');
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg"
              >
                Confirm & Activate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== REJECT MODAL ===== */}
      {rejectTarget && (
        <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#2d323e] rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 border border-white/10">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-400" />
              <span className="text-sm font-black text-white">Reject Payment Request</span>
            </div>
            <p className="text-[11px] text-gray-400 font-semibold">
              {rejectTarget.companyName} — Ref: <span className="font-mono text-emerald-400">{rejectTarget.paymentReference}</span>
            </p>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Reason / Feedback Note</label>
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={3}
                placeholder="e.g. Reference not found. Please re-submit with the correct transaction ID."
                className="w-full px-3 py-2 border border-white/10 rounded-lg text-xs bg-white/5 text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setRejectTarget(null)} className="px-3 py-2 text-xs font-bold text-gray-400 hover:text-white rounded-lg">Cancel</button>
              <button
                onClick={() => {
                  onReject(rejectTarget.id, rejectNote);
                  setRejectTarget(null);
                  setRejectNote('');
                }}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg"
              >
                Reject Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== RENEW / EXTEND MODAL ===== */}
      {renewTarget && (
        <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#2d323e] rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 border border-white/10">
            <div className="flex items-center gap-2">
              <RefreshCcw className="w-5 h-5 text-emerald-400" />
              <span className="text-sm font-black text-white">
                {renewTarget.isDemo ? 'Convert Demo to Paid Subscription' : renewTarget.status === 'Expired' ? 'Reactivate Subscription' : 'Renew / Extend Subscription'}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 font-semibold">
              {renewTarget.name} — {renewTarget.planName || 'No plan'} • Expires {fmtDate(renewTarget.isDemo ? renewTarget.demoExpiresAt : renewTarget.subscriptionEnd)}
            </p>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">New Period (adds months from current expiry)</label>
              <select
                value={renewPeriod}
                onChange={(e) => setRenewPeriod(Number(e.target.value))}
                className="w-full px-3 py-2 border border-white/10 rounded-lg text-xs bg-white/5 text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                {periodOptions.map(o => (
                  <option key={o.label} value={o.months} className="text-gray-900">{o.label}</option>
                ))}
              </select>
            </div>
            {renewPeriod === 0 && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Custom Months</label>
                <input
                  type="number"
                  value={renewCustomMonths}
                  onChange={(e) => setRenewCustomMonths(Number(e.target.value))}
                  placeholder="e.g. 12"
                  className="w-full px-3 py-2 border border-white/10 rounded-lg text-xs bg-white/5 text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Admin Note (optional)</label>
              <input
                value={renewNote}
                onChange={(e) => setRenewNote(e.target.value)}
                placeholder="Optional note"
                className="w-full px-3 py-2 border border-white/10 rounded-lg text-xs bg-white/5 text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setRenewTarget(null)} className="px-3 py-2 text-xs font-bold text-gray-400 hover:text-white rounded-lg">Cancel</button>
              <button
                onClick={() => {
                  onRenew(renewTarget.id, renewPeriod === 0 ? renewCustomMonths : renewPeriod, renewNote);
                  setRenewTarget(null);
                  setRenewNote('');
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg"
              >
                Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== DELETE CONFIRM MODAL ===== */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#2d323e] rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 border border-red-500/30">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span className="text-sm font-black text-white">Delete Company</span>
            </div>
            <p className="text-[11px] text-gray-400 font-semibold leading-relaxed">
              This permanently removes <span className="text-white font-bold">{deleteTarget.name}</span> and all of its
              user accounts, branches and stores from the system. This action cannot be undone.
            </p>
            <div className="bg-black/25 rounded-xl p-3 text-[10px] font-mono text-gray-400 space-y-1 border border-white/10">
              <div className="flex justify-between"><span>Company</span><span className="text-white font-bold">{deleteTarget.name}</span></div>
              <div className="flex justify-between"><span>Status</span><span className="text-red-400 font-bold uppercase">{displayStatus(deleteTarget)}</span></div>
              <div className="flex justify-between"><span>Accounts</span><span className="text-white font-bold">{companies.some(c => c.id === deleteTarget.id) ? 'All users removed' : '—'}</span></div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setDeleteTarget(null)} className="px-3 py-2 text-xs font-bold text-gray-400 hover:text-white rounded-lg">Cancel</button>
              <button
                onClick={() => {
                  onDeleteCompany(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg"
              >
                Delete Company
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== RECEIPT LIGHTBOX ===== */}
      {lightbox && (
        <div className="fixed inset-0 z-[90] bg-black/80 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-white text-xs font-black">{lightbox.title}</span>
              <button onClick={() => setLightbox(null)} className="text-white hover:bg-white/10 p-1 rounded"><X className="w-5 h-5" /></button>
            </div>
            <img src={lightbox.url} alt={lightbox.title} className="w-full rounded-xl max-h-[80vh] object-contain bg-black" />
          </div>
        </div>
      )}
    </div>
  );
}
