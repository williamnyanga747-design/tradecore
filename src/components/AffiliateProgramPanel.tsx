import React, { useMemo, useState } from 'react';
import {
  Share2, Copy, Check, MessageCircle, MousePointerClick, ShoppingBag, Wallet as WalletIcon,
  Smartphone, Send, AlertTriangle, ExternalLink, BadgePercent, Plus, Users, Search,
  CheckCircle2, XCircle, Clock3, MapPin, Edit3, Trash2, Power, UserCheck, ShieldCheck,
  Eye, ArrowLeft, TrendingUp, BarChart3, Building2, CreditCard
} from 'lucide-react';
import { Affiliate, AffiliateClick, AffiliateSale, AffiliateWithdrawal, Company, User, MarketplaceOrder } from '../types';
import { TZS } from './marketplace/MarketplaceShared';
import { sameId } from '../utils/idUtils';
import { TANZANIA_REGIONS } from '../utils/regions';
import AgentPerformancePortal from './AgentPerformancePortal';

interface AffiliateProgramPanelProps {
  user: User | null;
  affiliate: Affiliate | undefined;
  affiliates?: Affiliate[];
  clicks: AffiliateClick[];
  sales: AffiliateSale[];
  withdrawals: AffiliateWithdrawal[];
  companies: Company[];
  commissionPercent: number;
  currentCompanyId?: number | string | null;
  translate: (text: string) => string;
  onRequestWithdrawal: (affiliateId: number, amount: number, phoneNumber: string, extra?: any) => { ok: boolean; error?: string; withdrawal?: AffiliateWithdrawal };
  onCreateAgent?: (agent: {
    name: string;
    phone: string;
    email?: string;
    region?: string;
    district?: string;
    commissionPercent?: number;
    nationalId?: string;
    referralCode?: string;
    password?: string;
    companyId?: number;
  }) => { ok: boolean; error?: string; agent?: Affiliate };
  onUpdateAgent?: (id: number, patch: Partial<Affiliate>) => void;
  onDeleteAgent?: (id: number) => void;
  onDecideWithdrawal?: (withdrawalId: number, status: 'approved' | 'rejected', extra?: { paymentReference?: string; adminNote?: string } | string) => void;
  orders?: MarketplaceOrder[];
  activeCurrency?: string;
  activeExchangeRate?: number;
  minWithdrawal?: number;
}

const SALE_STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800'
};

const SALE_STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected'
};

function companyNameFor(companies: Company[], id: number): string {
  return companies.find(c => sameId(c.id, id))?.name || `Company #${id}`;
}

export default function AffiliateProgramPanel({
  user, affiliate, affiliates = [], clicks, sales, withdrawals, companies,
  commissionPercent, currentCompanyId, translate: t, onRequestWithdrawal,
  onCreateAgent, onUpdateAgent, onDeleteAgent, onDecideWithdrawal,
  orders = [], activeCurrency = 'TZS', activeExchangeRate = 1, minWithdrawal = 10000
}: AffiliateProgramPanelProps) {
  const isSuperAdmin = user?.role === 'Super Admin';
  const isAdmin = Boolean(isSuperAdmin || user?.role === 'Admin' || (user as any)?.isAdmin);
  const isAgent = user?.role === 'Agent' || (user as any)?.affiliateId != null;
  const activeCompanyId = currentCompanyId || user?.companyId;

  const [activeTab, setActiveTab] = useState<'agents' | 'withdrawals' | 'performance' | 'my-link'>(isAdmin ? 'agents' : 'my-link');
  const [inspectingAgent, setInspectingAgent] = useState<Affiliate | null>(null);
  const [processingPayout, setProcessingPayout] = useState<AffiliateWithdrawal | null>(null);
  const [payoutPaymentRef, setPayoutPaymentRef] = useState('');
  const [payoutAdminNote, setPayoutAdminNote] = useState('');
  const [rejectingPayout, setRejectingPayout] = useState<AffiliateWithdrawal | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [payoutStatusFilter, setPayoutStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Admin Agent Search & Filter
  const [agentSearch, setAgentSearch] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');

  // Create Agent Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentPhone, setNewAgentPhone] = useState('');
  const [newAgentEmail, setNewAgentEmail] = useState('');
  const [newAgentRegion, setNewAgentRegion] = useState(TANZANIA_REGIONS[0] || 'Dar es Salaam');
  const [newAgentDistrict, setNewAgentDistrict] = useState('');
  const [newAgentNationalId, setNewAgentNationalId] = useState('');
  const [newAgentReferralCode, setNewAgentReferralCode] = useState('');
  const [newAgentPassword, setNewAgentPassword] = useState('1234');
  const [newAgentCompanyId, setNewAgentCompanyId] = useState<number | undefined>(activeCompanyId);
  const [newAgentComm, setNewAgentComm] = useState(String(commissionPercent || 5));
  const [createModalError, setCreateModalError] = useState('');
  const [createModalSuccess, setCreateModalSuccess] = useState('');

  // Edit Agent Modal State
  const [editingAgent, setEditingAgent] = useState<Affiliate | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRegion, setEditRegion] = useState('');
  const [editComm, setEditComm] = useState('');

  const referralLink = affiliate ? `https://tanzaniatradecore.co.tz/ref/${affiliate.referralCode}` : '';
  const myClicks = affiliate ? clicks.filter(c => c.affiliateId === affiliate.id).length : 0;
  const mySales = affiliate ? sales.filter(s => s.affiliateId === affiliate.id) : [];
  const pendingSales = mySales.filter(s => s.status === 'pending');
  const approvedSales = mySales.filter(s => s.status === 'approved');
  const balance = affiliate?.balance || 0;
  const totalEarned = affiliate?.totalEarned || 0;
  const totalWithdrawn = affiliate?.totalWithdrawn || 0;
  const myWithdrawals = affiliate ? withdrawals.filter(w => w.affiliateId === affiliate.id) : [];

  const copyRefLink = (code: string) => {
    const link = `https://tanzaniatradecore.co.tz/ref/${code}`;
    navigator.clipboard?.writeText(link).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 1500);
    });
  };

  const whatsappShareLink = (code: string, agentName: string) => {
    const link = `https://tanzaniatradecore.co.tz/ref/${code}`;
    const msg = encodeURIComponent(`Habari! Ninakukaribisha GlobalTradeCore — nunua bidhaa bora kutoka maduka ya uhakika Tanzania kupitia link yangu ya uwakala: ${link}`);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  const handleSubmitWithdrawal = () => {
    setError('');
    if (!affiliate) return;
    const amt = Number(amount);
    const phoneNum = phone.replace(/\s+/g, '');
    if (!amt || amt <= 0) {
      setError(t('Please enter a valid amount.'));
      return;
    }
    if (!phoneNum || !/^(\+?255|0)[67][0-9]{8}$/.test(phoneNum)) {
      setError(t('Please enter a valid M-Pesa number.'));
      return;
    }
    const res = onRequestWithdrawal(affiliate.id, amt, phoneNum);
    if (!res.ok) {
      setError(res.error || t('Something went wrong.'));
      return;
    }
    setAmount('');
    setPhone('');
  };

  const handleCreateAgentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateModalError('');
    setCreateModalSuccess('');

    if (!newAgentName.trim()) {
      setCreateModalError(t('Tafadhali weka jina kamili la wakala.'));
      return;
    }
    if (!/^(\+?255|0)[67][0-9]{8}$/.test(newAgentPhone.trim().replace(/\s/g, ''))) {
      setCreateModalError(t('Weka namba sahihi ya simu ya Tanzania (+255 au 07XX...).'));
      return;
    }

    if (!onCreateAgent) {
      setCreateModalError('Agent handler is not configured.');
      return;
    }

    const res = onCreateAgent({
      name: newAgentName.trim(),
      phone: newAgentPhone.trim(),
      email: newAgentEmail.trim() || undefined,
      region: newAgentRegion,
      district: newAgentDistrict.trim() || undefined,
      commissionPercent: Number(newAgentComm) || commissionPercent,
      nationalId: newAgentNationalId.trim() || undefined,
      referralCode: newAgentReferralCode.trim() || undefined,
      password: newAgentPassword.trim() || '1234',
      companyId: isSuperAdmin ? (newAgentCompanyId || activeCompanyId) : activeCompanyId
    });

    if (!res.ok) {
      setCreateModalError(res.error || t('Imeshindikana kusajili wakala.'));
      return;
    }

    setCreateModalSuccess(t('Wakala amesajiliwa kikamilifu! Anaweza kuingia kwa kutumia Referral Code na nenosiri alilowekewa.'));
    setNewAgentName('');
    setNewAgentPhone('');
    setNewAgentEmail('');
    setNewAgentDistrict('');
    setNewAgentNationalId('');
    setNewAgentReferralCode('');
    setNewAgentPassword('1234');
    setTimeout(() => {
      setShowCreateModal(false);
      setCreateModalSuccess('');
    }, 1500);
  };

  // Scoped Affiliates according to active company
  const scopedAffiliates = useMemo(() => {
    if (isSuperAdmin || !activeCompanyId) return affiliates || [];
    return (affiliates || []).filter(a => sameId(a.companyId, activeCompanyId) || !a.companyId);
  }, [affiliates, isSuperAdmin, activeCompanyId]);

  // Filtered Agents for Admin view
  const filteredAgents = scopedAffiliates.filter(a => {
    const q = agentSearch.toLowerCase().trim();
    const matchesSearch = !q || a.name.toLowerCase().includes(q) || a.phone.includes(q) || a.referralCode.toLowerCase().includes(q);
    const matchesRegion = !selectedRegion || a.region === selectedRegion;
    return matchesSearch && matchesRegion;
  });

  // Scoped Withdrawals (using sameId to guarantee matching string and number company IDs)
  const scopedWithdrawals = useMemo(() => {
    if (isSuperAdmin || !activeCompanyId) return withdrawals || [];
    return (withdrawals || []).filter(w => {
      const ag = (affiliates || []).find(a => a.id === w.affiliateId);
      return sameId(w.companyId, activeCompanyId) || sameId(ag?.companyId, activeCompanyId) || !w.companyId || !ag?.companyId;
    });
  }, [withdrawals, affiliates, isSuperAdmin, activeCompanyId]);

  const pendingWithdrawals = scopedWithdrawals.filter(w => w.status === 'pending');
  const approvedWithdrawals = scopedWithdrawals.filter(w => w.status === 'approved');
  const rejectedWithdrawals = scopedWithdrawals.filter(w => w.status === 'rejected');
  const pendingAmount = pendingWithdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);
  const approvedAmount = approvedWithdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);

  const displayedWithdrawals = scopedWithdrawals.filter(w => {
    if (payoutStatusFilter === 'all') return true;
    return w.status === payoutStatusFilter;
  });

  const currentInspecting = inspectingAgent || scopedAffiliates[0] || null;

  // System Agent Totals
  const totalAgents = scopedAffiliates.length;
  const activeAgents = scopedAffiliates.filter(a => a.isActive !== false && a.status !== 'suspended').length;
  const totalSystemCommission = scopedAffiliates.reduce((sum, a) => sum + (a.totalEarned || 0), 0);
  const totalSystemBalance = scopedAffiliates.reduce((sum, a) => sum + (a.balance || 0), 0);
  const pendingPayoutsCount = pendingWithdrawals.length;

  // 1. DEDICATED AGENT WORKSPACE VIEW (When logged in as an Agent)
  if (isAgent) {
    const targetAffiliate = affiliate || (affiliates || []).find(a =>
      (user?.affiliateId && a.id === user.affiliateId) ||
      (user?.referralCode && a.referralCode.toLowerCase() === user.referralCode.toLowerCase()) ||
      a.userId === user?.id ||
      a.phone === user?.phone
    );
    const agentComp = companies.find(c => sameId(c.id, targetAffiliate?.companyId || activeCompanyId)) || companies[0];
    const agentSales = targetAffiliate ? (sales || []).filter(s => s.affiliateId === targetAffiliate.id) : (sales || []);
    const agentWithdrawals = targetAffiliate ? (withdrawals || []).filter(w => w.affiliateId === targetAffiliate.id) : (withdrawals || []);

    return (
      <AgentPerformancePortal
        currentUser={user}
        affiliate={targetAffiliate}
        company={agentComp}
        affiliateSales={agentSales}
        affiliateWithdrawals={agentWithdrawals}
        affiliateClicks={clicks || []}
        orders={orders || []}
        minWithdrawal={minWithdrawal || 10000}
        activeCurrency={activeCurrency}
        activeExchangeRate={activeExchangeRate}
        onRequestWithdrawal={onRequestWithdrawal}
        t={t}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Admin Mode Tab Navigation */}
      {isAdmin && (
        <div className="flex items-center justify-between gap-3 flex-wrap border-b border-gray-200 pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveTab('agents')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'agents'
                  ? 'bg-brand text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Users className="w-4 h-4" /> {t('Mawakala Wote (All Agents)')} ({totalAgents})
            </button>
            <button
              onClick={() => setActiveTab('withdrawals')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'withdrawals'
                  ? 'bg-brand text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <WalletIcon className="w-4 h-4" /> {t('Maombi ya Malipo (Payouts)')}
              {pendingPayoutsCount > 0 && (
                <span className="bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full animate-pulse">
                  {pendingPayoutsCount} {t('Mpya')}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                if (!inspectingAgent && scopedAffiliates.length > 0) {
                  setInspectingAgent(scopedAffiliates[0]);
                }
                setActiveTab('performance');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'performance'
                  ? 'bg-brand text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <TrendingUp className="w-4 h-4" /> {t('Utendaji wa Kila Wakala (Performance)')}
            </button>
            <button
              onClick={() => setActiveTab('my-link')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'my-link'
                  ? 'bg-brand text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Share2 className="w-4 h-4" /> {t('Link Yangu')}
            </button>
          </div>

          {activeTab === 'agents' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> {t('Sajili Wakala Mpya')}
            </button>
          )}
        </div>
      )}

      {/* ================= 1. ADMIN AGENTS MANAGEMENT TAB ================= */}
      {isAdmin && activeTab === 'agents' && (
        <div className="space-y-4">
          {/* Admin KPI Header */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('Jumla ya Mawakala')}</div>
              <div className="text-xl font-black text-gray-900 mt-1">{totalAgents}</div>
              <div className="text-[10px] text-emerald-600 font-bold mt-0.5">{activeAgents} {t('wanafanya kazi')}</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('Kamisheni Iliyolipwa')}</div>
              <div className="text-xl font-black text-emerald-600 mt-1">{TZS(totalSystemCommission)}</div>
              <div className="text-[10px] text-gray-400 font-semibold mt-0.5">{t('Jumla ya mapato ya mawakala')}</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('Salio la Mawakala')}</div>
              <div className="text-xl font-black text-amber-600 mt-1">{TZS(totalSystemBalance)}</div>
              <div className="text-[10px] text-gray-400 font-semibold mt-0.5">{t('Linazosubiri kutoa')}</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('Asilimia ya Default')}</div>
              <div className="text-xl font-black text-purple-600 mt-1">{commissionPercent}%</div>
              <div className="text-[10px] text-gray-400 font-semibold mt-0.5">{t('Kwa kila agizo lililothibitishwa')}</div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs flex items-center justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={agentSearch}
                onChange={e => setAgentSearch(e.target.value)}
                placeholder={t('Tafuta kwa jina, simu, au referral code...')}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div className="w-48">
              <select
                value={selectedRegion}
                onChange={e => setSelectedRegion(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold outline-none cursor-pointer"
              >
                <option value="">-- {t('Mikoa Yote')} --</option>
                {TANZANIA_REGIONS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Agents List Table */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3">{t('Wakala')}</th>
                    <th className="px-4 py-3">{t('Eneo / Mkoa')}</th>
                    <th className="px-4 py-3">{t('Referral Code')}</th>
                    <th className="px-4 py-3 text-right">{t('Salio')}</th>
                    <th className="px-4 py-3 text-right">{t('Jumla ya Mapato')}</th>
                    <th className="px-4 py-3 text-center">{t('Hali')}</th>
                    <th className="px-4 py-3 text-right">{t('Vitendo')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAgents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                        <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                        <div className="font-bold text-gray-600">{t('Hakuna wakala aliyepatikana.')}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">{t('Bofya "Sajili Wakala Mpya" hapo juu ili kuanzisha mawakala wako.')}</div>
                      </td>
                    </tr>
                  ) : (
                    filteredAgents.map(ag => {
                      const isSuspended = ag.isActive === false || ag.status === 'suspended';
                      return (
                        <tr key={ag.id} className="hover:bg-gray-50/60 transition">
                          <td className="px-4 py-3.5">
                            <div className="font-black text-gray-900">{ag.name}</div>
                            <div className="text-[10px] font-mono text-gray-500">{ag.phone}</div>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="font-semibold text-gray-700 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-gray-400" />
                              <span>{ag.region || 'Tanzania'}{ag.district ? `, ${ag.district}` : ''}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-brand bg-brand/10 px-2 py-0.5 rounded text-[11px]">
                                {ag.referralCode}
                              </span>
                              <button
                                type="button"
                                onClick={() => copyRefLink(ag.referralCode)}
                                className="p-1 text-gray-400 hover:text-gray-700 cursor-pointer"
                                title={t('Nakili Link')}
                              >
                                {copiedCode === ag.referralCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => whatsappShareLink(ag.referralCode, ag.name)}
                                className="p-1 text-emerald-600 hover:text-emerald-700 cursor-pointer"
                                title={t('Tuma WhatsApp')}
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right font-black text-amber-700">
                            {TZS(ag.balance || 0)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-black text-emerald-700">
                            {TZS(ag.totalEarned || 0)}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              isSuspended ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {isSuspended ? t('Amesimamishwa') : t('Hai (Active)')}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setInspectingAgent(ag);
                                  setActiveTab('performance');
                                }}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-brand bg-brand/10 hover:bg-brand/20 flex items-center gap-1 cursor-pointer transition shadow-2xs mr-1"
                                title={t('Tazama Utendaji wa Wakala')}
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>{t('Utendaji')}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onUpdateAgent && onUpdateAgent(ag.id, { isActive: isSuspended, status: isSuspended ? 'active' : 'suspended' })}
                                className={`p-1.5 rounded-lg text-xs cursor-pointer ${isSuspended ? 'text-emerald-600 hover:bg-emerald-50' : 'text-amber-600 hover:bg-amber-50'}`}
                                title={isSuspended ? t('Washa Wakala') : t('Simamisha Wakala')}
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>
                              {onDeleteAgent && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm(t(`Je, una uhakika unataka kumfuta wakala "${ag.name}"?`))) {
                                      onDeleteAgent(ag.id);
                                    }
                                  }}
                                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"
                                  title={t('Futa Wakala')}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= 2. ADMIN WITHDRAWALS (PAYOUTS) TAB ================= */}
      {isAdmin && activeTab === 'withdrawals' && (
        <div className="space-y-4">
          {/* Payout Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-500 uppercase">{t('Jumla ya Maombi')}</span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-black text-gray-900 mt-1">{scopedWithdrawals.length}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">{t('Maombi yote ya kutoa fedha')}</div>
            </div>

            <div className="bg-white rounded-2xl border border-amber-200 bg-amber-50/30 p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-700 uppercase">{t('Yanasubiri Idhini')}</span>
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Clock3 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-black text-amber-900 mt-1">{TZS(pendingAmount)}</div>
              <div className="text-[11px] text-amber-700 font-bold mt-0.5">{pendingWithdrawals.length} {t('maombi hayajalipwa')}</div>
            </div>

            <div className="bg-white rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-700 uppercase">{t('Yaliyolipwa Kikamilifu')}</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-black text-emerald-900 mt-1">{TZS(approvedAmount)}</div>
              <div className="text-[11px] text-emerald-700 font-bold mt-0.5">{approvedWithdrawals.length} {t('yamethibitishwa')}</div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-red-600 uppercase">{t('Yaliyokataliwa')}</span>
                <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                  <XCircle className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-black text-gray-900 mt-1">{rejectedWithdrawals.length}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">{t('Maombi yaliyofutwa au kukataliwa')}</div>
            </div>
          </div>

          {/* Withdrawals Table Container */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                  <WalletIcon className="w-4 h-4 text-brand" />
                  {t('Maombi ya Malipo ya Mawakala (Agent Payouts)')}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {t('Tazama maombi ya mawakala, fanya malipo kwa namba zao za simu/benki, na weka namba ya kumbukumbu (Reference).')}
                </p>
              </div>

              {/* Status filter tabs */}
              <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setPayoutStatusFilter('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${
                    payoutStatusFilter === 'all' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {t('Zote')} ({scopedWithdrawals.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPayoutStatusFilter('pending')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${
                    payoutStatusFilter === 'pending' ? 'bg-amber-500 text-white shadow-2xs' : 'text-amber-700 hover:text-amber-900'
                  }`}
                >
                  {t('Inasubiri')} ({pendingWithdrawals.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPayoutStatusFilter('approved')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${
                    payoutStatusFilter === 'approved' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-emerald-700 hover:text-emerald-900'
                  }`}
                >
                  {t('Zilizoidhinishwa')} ({approvedWithdrawals.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPayoutStatusFilter('rejected')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${
                    payoutStatusFilter === 'rejected' ? 'bg-red-600 text-white shadow-2xs' : 'text-red-600 hover:text-red-800'
                  }`}
                >
                  {t('Zilizokataliwa')} ({rejectedWithdrawals.length})
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3">{t('Tarehe')}</th>
                    <th className="px-4 py-3">{t('Wakala')}</th>
                    {isSuperAdmin && <th className="px-4 py-3">{t('Kampuni')}</th>}
                    <th className="px-4 py-3">{t('Njia & Akaunti ya Malipo')}</th>
                    <th className="px-4 py-3 text-right">{t('Kiasi')}</th>
                    <th className="px-4 py-3 text-center">{t('Hali')}</th>
                    <th className="px-4 py-3">{t('Kumbukumbu / Note')}</th>
                    <th className="px-4 py-3 text-right">{t('Vitendo')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayedWithdrawals.length === 0 ? (
                    <tr>
                      <td colSpan={isSuperAdmin ? 8 : 7} className="px-4 py-12 text-center text-gray-400">
                        <CreditCard className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                        <div className="font-bold text-gray-600">{t('Hakuna maombi ya malipo katika sehemu hii.')}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">{t('Maombi mapya ya mawakala yataonekana hapa pindi wakala anapoomba kutoa kamisheni.')}</div>
                      </td>
                    </tr>
                  ) : (
                    displayedWithdrawals.map(w => {
                      const ag = (affiliates || []).find(a => a.id === w.affiliateId);
                      const comp = companies.find(c => sameId(c.id, w.companyId) || sameId(c.id, ag?.companyId));
                      return (
                        <tr key={w.id} className="hover:bg-gray-50/60 transition">
                          <td className="px-4 py-3.5 text-gray-500 font-mono">
                            <div>{new Date(w.requestedAt).toLocaleDateString()}</div>
                            <div className="text-[10px] text-gray-400">{new Date(w.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="font-black text-gray-900">{ag?.name || `Agent #${w.affiliateId}`}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] font-mono text-brand font-bold bg-brand/10 px-1.5 py-0.2 rounded">
                                {ag?.referralCode || 'N/A'}
                              </span>
                              <span className="text-[10px] text-gray-500">{ag?.phone}</span>
                            </div>
                          </td>
                          {isSuperAdmin && (
                            <td className="px-4 py-3.5 text-gray-700 font-semibold">
                              {comp ? comp.name : t('Global')}
                            </td>
                          )}
                          <td className="px-4 py-3.5">
                            <div className="font-mono font-black text-gray-900">{w.phoneNumber || (w as any).accountNumber}</div>
                            <div className="text-[10px] text-gray-600 font-bold uppercase flex items-center gap-1 mt-0.5">
                              <Smartphone className="w-3 h-3 text-emerald-600" />
                              <span>{w.method || 'M-Pesa'}</span>
                              {w.bankName && <span className="text-gray-400">({w.bankName})</span>}
                            </div>
                            {(w as any).accountName && (
                              <div className="text-[10px] text-gray-500 font-medium">Jina: {(w as any).accountName}</div>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right font-black text-emerald-700 text-sm">
                            {TZS(w.amount)}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              w.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                              w.status === 'rejected' ? 'bg-red-100 text-red-800' :
                              'bg-amber-100 text-amber-800 animate-pulse'
                            }`}>
                              {w.status === 'approved' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                              {w.status === 'rejected' && <XCircle className="w-3 h-3 text-red-600" />}
                              {w.status === 'pending' && <Clock3 className="w-3 h-3 text-amber-600" />}
                              {w.status === 'approved' ? t('✓ Imelipwa') : w.status === 'rejected' ? t('Imekataliwa') : t('Inasubiri Malipo')}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            {w.paymentReference && (
                              <div className="font-mono text-[11px] font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded inline-block">
                                Ref: {w.paymentReference}
                              </div>
                            )}
                            {w.adminNote && (
                              <div className="text-[10px] text-gray-500 italic mt-0.5">
                                "{w.adminNote}"
                              </div>
                            )}
                            {!w.paymentReference && !w.adminNote && (
                              <span className="text-gray-300 text-[10px]">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            {w.status === 'pending' && onDecideWithdrawal ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setProcessingPayout(w);
                                    setPayoutPaymentRef('');
                                    setPayoutAdminNote('');
                                  }}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black cursor-pointer shadow-xs transition flex items-center gap-1"
                                  title={t('Fanya Malipo na Idhinisha')}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>{t('Lipa / Idhinisha')}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRejectingPayout(w);
                                    setRejectionReason('');
                                  }}
                                  className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-bold cursor-pointer transition flex items-center gap-1"
                                  title={t('Kataa Ombi la Malipo')}
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>{t('Kataa')}</span>
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-gray-400 font-semibold">{t('Imekamilika')}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= 3. AGENT PERFORMANCE INSPECTOR TAB (Integrated Agent Workspace) ================= */}
      {isAdmin && activeTab === 'performance' && (
        <div className="space-y-4">
          {/* Top Inspector Switcher Bar */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('agents')}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{t('Rudi Orodha')}</span>
              </button>
              <div>
                <h3 className="text-sm font-black text-gray-900 flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-brand" />
                  {t('Utendaji wa Wakala (Agent Performance Inspector)')}
                </h3>
                <p className="text-xs text-gray-500">{t('Chagua wakala hapa chini kutazama workspace yake, mauzo, mibofyo na maombi ya kutoa fedha.')}</p>
              </div>
            </div>

            {/* Agent Selector Dropdown */}
            {scopedAffiliates.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-600 hidden sm:inline">{t('Chagua Wakala:')}</span>
                <select
                  value={currentInspecting?.id || ''}
                  onChange={e => {
                    const found = scopedAffiliates.find(a => a.id === Number(e.target.value));
                    if (found) setInspectingAgent(found);
                  }}
                  className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 outline-none focus:ring-2 focus:ring-brand cursor-pointer shadow-2xs"
                >
                  {scopedAffiliates.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.referralCode}) — {a.region || 'Tanzania'}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Embedded Agent Workspace Portal */}
          {currentInspecting ? (
            <div className="border-t border-gray-100 pt-1">
              <div className="mb-3 px-1 flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-700">{t('Unatazama:')} <strong className="text-brand font-black">{currentInspecting.name}</strong></span>
                  <span className="font-mono text-[11px] bg-brand/10 text-brand px-2 py-0.5 rounded font-bold">{currentInspecting.referralCode}</span>
                  <span className="text-gray-400">·</span>
                  <span>{currentInspecting.region || 'Tanzania'}</span>
                </div>
                <div className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  {t('Kamisheni:')} {currentInspecting.commissionPercent || commissionPercent}%
                </div>
              </div>

              <AgentPerformancePortal
                currentUser={user}
                affiliate={currentInspecting}
                company={companies.find(c => sameId(c.id, currentInspecting.companyId || activeCompanyId)) || companies[0]}
                affiliateSales={(sales || []).filter(s => s.affiliateId === currentInspecting.id)}
                affiliateWithdrawals={(withdrawals || []).filter(w => w.affiliateId === currentInspecting.id)}
                affiliateClicks={clicks || []}
                orders={orders || []}
                minWithdrawal={minWithdrawal || 10000}
                activeCurrency={activeCurrency}
                activeExchangeRate={activeExchangeRate}
                onRequestWithdrawal={onRequestWithdrawal}
                t={t}
              />
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
              <Users className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <div className="font-black text-gray-700 text-sm">{t('Hakuna wakala aliyesajiliwa bado.')}</div>
              <p className="text-xs text-gray-400 mt-1">{t('Nenda kwenye kichupo cha "Mawakala Wote" na usajili wakala mpya ili kuona utendaji wake hapa.')}</p>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('agents');
                  setShowCreateModal(true);
                }}
                className="mt-4 px-4 py-2 bg-brand text-white rounded-xl text-xs font-black cursor-pointer shadow-sm hover:bg-brand/90 transition"
              >
                + {t('Sajili Wakala wa Kwanza')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ================= 3. PERSONAL AGENT LINK TAB ================= */}
      {(!isAdmin || activeTab === 'my-link') && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-purple-600 to-brand rounded-2xl p-5 text-white shadow-lg">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider opacity-80 inline-flex items-center gap-1.5">
                  <Share2 className="w-4 h-4" /> {t('Affiliate Program')}
                </div>
                <div className="text-2xl font-black mt-1">{affiliate?.name || user?.name || user?.username || ''}</div>
                <div className="text-[11px] font-semibold mt-1 opacity-90 inline-flex items-center gap-1">
                  <BadgePercent className="w-3.5 h-3.5" /> {t('You earn')} {commissionPercent}% {t('per approved sale')}
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{t('Available Balance')}</div>
                  <div className="text-2xl font-black mt-0.5">{TZS(balance)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{t('Total Earned')}</div>
                  <div className="text-lg font-extrabold mt-0.5">{TZS(totalEarned)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
                <MousePointerClick className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-gray-500 font-bold uppercase">{t('Total Clicks')}</div>
                <div className="text-xl font-black text-gray-900 mt-0.5">{myClicks}</div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-50 text-green-700 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-gray-500 font-bold uppercase">{t('Sales Referred')}</div>
                <div className="text-xl font-black text-gray-900 mt-0.5">{mySales.length}</div>
                <div className="text-[10px] text-gray-400 font-semibold">{approvedSales.length} {t('approved')} · {pendingSales.length} {t('pending')}</div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                <WalletIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-gray-500 font-bold uppercase">{t('Total Withdrawn')}</div>
                <div className="text-xl font-black text-gray-900 mt-0.5">{TZS(totalWithdrawn)}</div>
              </div>
            </div>
          </div>

          {/* Referral link box */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm space-y-3">
            <div className="font-bold text-gray-900 text-sm">{t('Your Referral Link')}</div>
            <div className="text-xs text-gray-500">{t('Share this link on WhatsApp, Facebook, or Instagram. When someone buys from any shop using your link, you earn a commission on every approved order.')}</div>

            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                readOnly
                value={referralLink}
                className="flex-1 min-w-[240px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono select-all outline-none"
              />
              <button
                type="button"
                onClick={() => copyRefLink(affiliate?.referralCode || '')}
                className="px-4 py-2 bg-brand text-white rounded-lg text-xs font-bold hover:bg-brand/90 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                {copiedCode === affiliate?.referralCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copiedCode === affiliate?.referralCode ? t('Copied!') : t('Copy Link')}
              </button>
              <button
                type="button"
                onClick={() => whatsappShareLink(affiliate?.referralCode || '', affiliate?.name || '')}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <MessageCircle className="w-4 h-4" />
                {t('Share on WhatsApp')}
              </button>
            </div>
          </div>

          {/* Request withdrawal */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className="font-bold text-gray-900 text-sm mb-1">{t('Request Commission Payout')}</div>
            <div className="text-xs text-gray-500 mb-3">{t('Payouts are processed to your M-Pesa number within 24 hours.')}</div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">{t('Amount (TZS)')}</label>
                <input
                  type="number"
                  min={0}
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="e.g. 50000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand font-bold"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">{t('M-Pesa Number')}</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="e.g. 0712345678"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand font-bold"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleSubmitWithdrawal}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Send className="w-4 h-4" /> {t('Submit Request')}
                </button>
              </div>
            </div>

            {error && (
              <div className="mt-2 text-xs font-bold text-red-600 bg-red-50 p-2 rounded-lg flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL: CREATE NEW AGENT ================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 w-full max-w-lg space-y-4 shadow-2xl my-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h4 className="text-sm font-black text-gray-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" /> {t('Sajili Wakala Mpya (Create Agent)')}
              </h4>
              <button onClick={() => setShowCreateModal(false)} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleCreateAgentSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">{t('Jina Kamili la Wakala')} *</label>
                <input
                  type="text"
                  required
                  value={newAgentName}
                  onChange={e => setNewAgentName(e.target.value)}
                  placeholder="Mfano: Juma Ally Mussa"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">{t('Namba ya Simu (M-Pesa)')} *</label>
                  <input
                    type="tel"
                    required
                    value={newAgentPhone}
                    onChange={e => setNewAgentPhone(e.target.value)}
                    placeholder="07XX XXX XXX au +255..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">{t('Barua Pepe (Email)')}</label>
                  <input
                    type="email"
                    value={newAgentEmail}
                    onChange={e => setNewAgentEmail(e.target.value)}
                    placeholder="wakala@gmail.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">{t('Mkoa / Territory')} *</label>
                  <select
                    value={newAgentRegion}
                    onChange={e => setNewAgentRegion(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold outline-none cursor-pointer"
                  >
                    {TANZANIA_REGIONS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">{t('Wilaya / District')}</label>
                  <input
                    type="text"
                    value={newAgentDistrict}
                    onChange={e => setNewAgentDistrict(e.target.value)}
                    placeholder="Kinondoni, Ilala, Arusha..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">{t('NIDA / Namba ya Kitambulisho')}</label>
                  <input
                    type="text"
                    value={newAgentNationalId}
                    onChange={e => setNewAgentNationalId(e.target.value)}
                    placeholder="1990XXXXXXXXXXXX"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">{t('Asilimia ya Kamisheni (%)')}</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={newAgentComm}
                    onChange={e => setNewAgentComm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">{t('Referral Code (Hiari)')}</label>
                  <input
                    type="text"
                    value={newAgentReferralCode}
                    onChange={e => setNewAgentReferralCode(e.target.value.toUpperCase())}
                    placeholder="WAKALA-XXXX (au wazi kwa auto)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">{t('Nenosiri la Kuingilia Portal')} *</label>
                  <input
                    type="text"
                    required
                    value={newAgentPassword}
                    onChange={e => setNewAgentPassword(e.target.value)}
                    placeholder="Default: 1234"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand"
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">{t('Wakala ataingia kwa Referral Code na nenosiri hili.')}</p>
                </div>
              </div>

              {isSuperAdmin && (
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">{t('Kampuni Inayomiliki Wakala')}</label>
                  <select
                    value={newAgentCompanyId || ''}
                    onChange={e => setNewAgentCompanyId(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold outline-none cursor-pointer"
                  >
                    <option value="">{t('Wakala wa Mfumo Mzima (Global Agent)')}</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.region || 'Tanzania'})</option>
                    ))}
                  </select>
                </div>
              )}

              {createModalError && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{createModalError}</span>
                </div>
              )}

              {createModalSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{createModalSuccess}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  {t('Ghairi')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md cursor-pointer transition flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> {t('Kamilisha Usajili wa Wakala')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: APPROVE & PAY AGENT ================= */}
      {processingPayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto" onClick={() => setProcessingPayout(null)}>
          <div className="bg-white rounded-2xl border border-gray-200 p-6 w-full max-w-md space-y-4 shadow-2xl my-8 animate-in fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-gray-900">{t('Idhinisha & Kamilisha Malipo ya Wakala')}</h4>
                  <p className="text-[11px] text-gray-500">{t('Weka namba ya kumbukumbu ya muamala kisha thibitisha.')}</p>
                </div>
              </div>
              <button onClick={() => setProcessingPayout(null)} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 cursor-pointer">✕</button>
            </div>

            {/* Payout Details Card */}
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-semibold">{t('Wakala:')}</span>
                <span className="font-black text-gray-900">
                  {affiliates.find(a => a.id === processingPayout.affiliateId)?.name || `Agent #${processingPayout.affiliateId}`}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-semibold">{t('Namba / Akaunti:')}</span>
                <span className="font-mono font-bold text-gray-900">{processingPayout.phoneNumber || (processingPayout as any).accountNumber}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-semibold">{t('Njia ya Malipo:')}</span>
                <span className="font-bold text-gray-800 uppercase">{processingPayout.method || 'M-Pesa'}{processingPayout.bankName ? ` (${processingPayout.bankName})` : ''}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                <span className="text-gray-700 font-bold">{t('Kiasi cha Kulipa:')}</span>
                <span className="text-base font-black text-emerald-700">{TZS(processingPayout.amount)}</span>
              </div>
            </div>

            <form
              onSubmit={e => {
                e.preventDefault();
                if (onDecideWithdrawal && processingPayout) {
                  onDecideWithdrawal(processingPayout.id, 'approved', {
                    paymentReference: payoutPaymentRef.trim() || undefined,
                    adminNote: payoutAdminNote.trim() || undefined
                  });
                }
                setProcessingPayout(null);
                setPayoutPaymentRef('');
                setPayoutAdminNote('');
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  {t('Namba ya Kumbukumbu ya Malipo (Transaction Ref / Code)')}
                </label>
                <input
                  type="text"
                  value={payoutPaymentRef}
                  onChange={e => setPayoutPaymentRef(e.target.value)}
                  placeholder="Mfano: QK84920489 au TXN-10492"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  {t('Weka namba ya muamala ya M-Pesa, Tigo au benki uliyolipia ili iwe kumbukumbu rasmi.')}
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  {t('Ujumbe / Maelezo ya Ziada (Hiari)')}
                </label>
                <input
                  type="text"
                  value={payoutAdminNote}
                  onChange={e => setPayoutAdminNote(e.target.value)}
                  placeholder="Mfano: Malipo ya kamisheni ya mwezi huu yamekamilika"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setProcessingPayout(null)}
                  className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  {t('Ghairi')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md cursor-pointer transition flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> {t('Kamilisha & Idhinisha Malipo')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: REJECT PAYOUT ================= */}
      {rejectingPayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto" onClick={() => setRejectingPayout(null)}>
          <div className="bg-white rounded-2xl border border-gray-200 p-6 w-full max-w-md space-y-4 shadow-2xl my-8 animate-in fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-red-100 text-red-700 flex items-center justify-center">
                  <XCircle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-gray-900">{t('Kataa Ombi la Malipo')}</h4>
                  <p className="text-[11px] text-gray-500">{t('Salio litarudishwa kwenye akaunti ya wakala.')}</p>
                </div>
              </div>
              <button onClick={() => setRejectingPayout(null)} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 cursor-pointer">✕</button>
            </div>

            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
              {t('Una uhakika unataka kukataa ombi la')} <strong>{TZS(rejectingPayout.amount)}</strong> {t('kwa')} <strong>{affiliates.find(a => a.id === rejectingPayout.affiliateId)?.name || `Agent #${rejectingPayout.affiliateId}`}</strong>?
            </div>

            <form
              onSubmit={e => {
                e.preventDefault();
                if (onDecideWithdrawal && rejectingPayout) {
                  onDecideWithdrawal(rejectingPayout.id, 'rejected', {
                    adminNote: rejectionReason.trim() || undefined
                  });
                }
                setRejectingPayout(null);
                setRejectionReason('');
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  {t('Sababu ya Kukataa (Itaonekana kwa Wakala)')}
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="Mfano: Namba ya simu ya M-Pesa si sahihi au haipatikani..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectingPayout(null)}
                  className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  {t('Ghairi')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black shadow-md cursor-pointer transition flex items-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" /> {t('Kataa Ombi')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
