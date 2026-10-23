import React, { useState } from 'react';
import {
  Share2, Copy, Check, MessageCircle, MousePointerClick, ShoppingBag, Wallet as WalletIcon,
  Smartphone, Send, AlertTriangle, ExternalLink, BadgePercent, Plus, Users, Search,
  CheckCircle2, XCircle, Clock3, MapPin, Edit3, Trash2, Power, UserCheck, ShieldCheck
} from 'lucide-react';
import { Affiliate, AffiliateClick, AffiliateSale, AffiliateWithdrawal, Company, User } from '../types';
import { TZS } from './marketplace/MarketplaceShared';
import { sameId } from '../utils/idUtils';
import { TANZANIA_REGIONS } from '../utils/regions';

interface AffiliateProgramPanelProps {
  user: User | null;
  affiliate: Affiliate | undefined;
  affiliates?: Affiliate[];
  clicks: AffiliateClick[];
  sales: AffiliateSale[];
  withdrawals: AffiliateWithdrawal[];
  companies: Company[];
  commissionPercent: number;
  translate: (text: string) => string;
  onRequestWithdrawal: (affiliateId: number, amount: number, phoneNumber: string) => { ok: boolean; error?: string };
  onCreateAgent?: (agent: {
    name: string;
    phone: string;
    email?: string;
    region?: string;
    district?: string;
    commissionPercent?: number;
    nationalId?: string;
  }) => { ok: boolean; error?: string; agent?: Affiliate };
  onUpdateAgent?: (id: number, patch: Partial<Affiliate>) => void;
  onDeleteAgent?: (id: number) => void;
  onDecideWithdrawal?: (withdrawalId: number, status: 'approved' | 'rejected', adminNote?: string) => void;
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
  commissionPercent, translate: t, onRequestWithdrawal,
  onCreateAgent, onUpdateAgent, onDeleteAgent, onDecideWithdrawal
}: AffiliateProgramPanelProps) {
  const isAdmin = Boolean(user?.role === 'Super Admin' || user?.role === 'Admin' || (user as any)?.isAdmin);

  const [activeTab, setActiveTab] = useState<'agents' | 'withdrawals' | 'my-link'>(isAdmin ? 'agents' : 'my-link');
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
      nationalId: newAgentNationalId.trim() || undefined
    });

    if (!res.ok) {
      setCreateModalError(res.error || t('Imeshindikana kusajili wakala.'));
      return;
    }

    setCreateModalSuccess(t('Wakala amesajiliwa kikamilifu!'));
    setNewAgentName('');
    setNewAgentPhone('');
    setNewAgentEmail('');
    setNewAgentDistrict('');
    setNewAgentNationalId('');
    setTimeout(() => {
      setShowCreateModal(false);
      setCreateModalSuccess('');
    }, 1200);
  };

  // Filtered Agents for Admin view
  const filteredAgents = affiliates.filter(a => {
    const q = agentSearch.toLowerCase().trim();
    const matchesSearch = !q || a.name.toLowerCase().includes(q) || a.phone.includes(q) || a.referralCode.toLowerCase().includes(q);
    const matchesRegion = !selectedRegion || a.region === selectedRegion;
    return matchesSearch && matchesRegion;
  });

  // System Agent Totals
  const totalAgents = affiliates.length;
  const activeAgents = affiliates.filter(a => a.isActive !== false && a.status !== 'suspended').length;
  const totalSystemCommission = affiliates.reduce((sum, a) => sum + (a.totalEarned || 0), 0);
  const totalSystemBalance = affiliates.reduce((sum, a) => sum + (a.balance || 0), 0);

  return (
    <div className="space-y-4">
      {/* Admin Mode Tab Navigation */}
      {isAdmin && (
        <div className="flex items-center justify-between gap-3 flex-wrap border-b border-gray-200 pb-3">
          <div className="flex items-center gap-2">
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
              {withdrawals.filter(w => w.status === 'pending').length > 0 && (
                <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.2 rounded-full">
                  {withdrawals.filter(w => w.status === 'pending').length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('my-link')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'my-link'
                  ? 'bg-brand text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Share2 className="w-4 h-4" /> {t('Link Yangu ya Kibinafsi')}
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

      {/* ================= 2. ADMIN WITHDRAWALS TAB ================= */}
      {isAdmin && activeTab === 'withdrawals' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-black text-gray-900">{t('Maombi ya Kutoa Pesa ya Mawakala (Payouts)')}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{t('Thibitisha na idhinisha malipo ya kamisheni kwa namba za simu za M-Pesa.')}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] border-b">
                <tr>
                  <th className="px-4 py-2.5">{t('Tarehe')}</th>
                  <th className="px-4 py-2.5">{t('Wakala')}</th>
                  <th className="px-4 py-2.5">{t('Namba ya M-Pesa')}</th>
                  <th className="px-4 py-2.5 text-right">{t('Kiasi')}</th>
                  <th className="px-4 py-2.5 text-center">{t('Hali')}</th>
                  <th className="px-4 py-2.5 text-right">{t('Vitendo')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {withdrawals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      {t('Hakuna maombi ya kutoa pesa bado.')}
                    </td>
                  </tr>
                ) : (
                  withdrawals.map(w => {
                    const ag = affiliates.find(a => a.id === w.affiliateId);
                    return (
                      <tr key={w.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-500 font-mono">
                          {new Date(w.requestedAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 font-black text-gray-900">
                          {ag?.name || `Agent #${w.affiliateId}`}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-gray-700">
                          {w.phoneNumber}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-emerald-700">
                          {TZS(w.amount)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            w.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                            w.status === 'rejected' ? 'bg-red-100 text-red-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {w.status === 'approved' ? '✓ Imelipwa' : w.status === 'rejected' ? 'Imekataliwa' : 'Inasubiri'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {w.status === 'pending' && onDecideWithdrawal && (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => onDecideWithdrawal(w.id, 'approved')}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                              >
                                {t('Idhinisha')}
                              </button>
                              <button
                                type="button"
                                onClick={() => onDecideWithdrawal(w.id, 'rejected')}
                                className="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-xs font-bold cursor-pointer"
                              >
                                {t('Kataa')}
                              </button>
                            </div>
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
    </div>
  );
}
