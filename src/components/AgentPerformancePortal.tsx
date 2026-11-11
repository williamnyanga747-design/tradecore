import React, { useState, useMemo } from 'react';
import {
  Share2, Copy, Check, QrCode, DollarSign, TrendingUp, ShoppingBag,
  ArrowUpRight, Clock, CheckCircle2, XCircle, AlertCircle, Phone,
  Building2, Wallet, ExternalLink, RefreshCw, Send, ShieldCheck,
  ChevronRight, ArrowDownLeft, Layers, Award, Sparkles, Filter, Search
} from 'lucide-react';
import { User, Affiliate, AffiliateSale, AffiliateWithdrawal, Company, MarketplaceOrder } from '../types';
import { formatMoney } from '../utils/format';
import { generateQrDataUrl } from '../utils/qrCodeUtils';
import { toast } from '../utils/toast';

interface AgentPerformancePortalProps {
  currentUser: User | null;
  affiliate?: Affiliate;
  company?: Company;
  affiliateSales: AffiliateSale[];
  affiliateWithdrawals: AffiliateWithdrawal[];
  affiliateClicks?: any[];
  orders?: MarketplaceOrder[];
  minWithdrawal?: number;
  activeCurrency?: string;
  activeExchangeRate?: number;
  onRequestWithdrawal: (
    affiliateId: number,
    amount: number,
    phoneNumber: string,
    extra?: { method?: string; accountName?: string; bankName?: string }
  ) => { ok: boolean; error?: string; withdrawal?: AffiliateWithdrawal };
  t: (text: string) => string;
}

export default function AgentPerformancePortal({
  currentUser,
  affiliate,
  company,
  affiliateSales = [],
  affiliateWithdrawals = [],
  orders = [],
  minWithdrawal = 10000,
  activeCurrency = 'TZS',
  activeExchangeRate = 1,
  onRequestWithdrawal,
  t
}: AgentPerformancePortalProps) {
  const [activeTab, setActiveTab] = useState<'performance' | 'payouts'>('performance');
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'paid'>('all');

  // Payout Form State
  const [payoutAmount, setPayoutAmount] = useState<number | string>('');
  const [payoutPhone, setPayoutPhone] = useState(affiliate?.phone || currentUser?.phone || '');
  const [payoutMethod, setPayoutMethod] = useState<'mpesa' | 'tigopesa' | 'airtel' | 'halopesa' | 'bank'>('mpesa');
  const [bankName, setBankName] = useState('CRDB Bank');
  const [accountName, setAccountName] = useState(affiliate?.name || currentUser?.name || '');
  const [accountNumber, setAccountNumber] = useState('');
  const [payoutError, setPayoutError] = useState('');
  const [payoutSubmitting, setPayoutSubmitting] = useState(false);

  // Agent referral details
  const referralCode = affiliate?.referralCode || currentUser?.referralCode || `WAKALA-${currentUser?.id || 'AGT'}`;
  const referralLink = `https://tanzaniatradecore.co.tz/ref/${referralCode}`;
  const availableBalance = affiliate?.balance ?? 0;
  const totalEarned = affiliate?.totalEarned ?? 0;
  const totalWithdrawn = affiliate?.totalWithdrawn ?? 0;

  // Generate QR Code on demand
  const handleOpenQr = async () => {
    try {
      const url = await generateQrDataUrl(referralLink, { width: 320 });
      setQrDataUrl(url);
      setQrModalOpen(true);
    } catch {
      toast.error(t('Could not generate QR code'));
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(referralLink).then(() => {
      setCopiedLink(true);
      toast.success(t('Referral link copied to clipboard!'));
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(referralCode).then(() => {
      setCopiedCode(true);
      toast.success(t('Referral code copied!'));
      setTimeout(() => setCopiedCode(false), 2000);
    });
  };

  const handleShareWhatsApp = () => {
    const msg = encodeURIComponent(
      `${t('Agiza bidhaa bora kupitia kampuni ya')} ${company?.name || 'TradeCore'} ${t('kwa punguzo maalumu kwa kutumia wakala rasmi')} ${affiliate?.name || currentUser?.name || ''}:\n${referralLink}\n${t('Kodi ya Wakala')}: ${referralCode}`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  // Performance calculations
  const totalSalesCount = affiliateSales.length;
  const totalReferredGmv = useMemo(() => {
    return affiliateSales.reduce((acc, s) => acc + (s.amount || 0), 0);
  }, [affiliateSales]);

  const pendingCommission = useMemo(() => {
    return affiliateSales
      .filter(s => s.status === 'pending')
      .reduce((acc, s) => acc + (s.commissionAmount || 0), 0);
  }, [affiliateSales]);

  // Filtered sales list
  const filteredSales = useMemo(() => {
    return affiliateSales.filter(s => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (orderSearch.trim()) {
        const q = orderSearch.toLowerCase();
        return (
          (s.orderNumber && s.orderNumber.toLowerCase().includes(q)) ||
          String(s.orderId).includes(q)
        );
      }
      return true;
    });
  }, [affiliateSales, statusFilter, orderSearch]);

  // Submit Payout Application
  const handleSubmitPayout = (e: React.FormEvent) => {
    e.preventDefault();
    setPayoutError('');

    const amt = Number(payoutAmount);
    if (!amt || amt <= 0) {
      setPayoutError(t('Please enter a valid payout amount.'));
      return;
    }
    if (amt < minWithdrawal) {
      setPayoutError(`${t('Minimum payout amount is')} ${formatMoney(minWithdrawal, activeCurrency, activeExchangeRate)}.`);
      return;
    }
    if (amt > availableBalance) {
      setPayoutError(t('Requested amount exceeds your available commission balance.'));
      return;
    }

    const cleanPhone = payoutPhone.replace(/\s+/g, '');
    if (payoutMethod !== 'bank' && !/^(\+?255|0)[67][0-9]{8}$/.test(cleanPhone)) {
      setPayoutError(t('Please enter a valid Tanzanian mobile money number (e.g. 07XXXXXXXX).'));
      return;
    }

    if (payoutMethod === 'bank' && (!bankName.trim() || !accountName.trim() || !accountNumber.trim())) {
      setPayoutError(t('Please complete bank name, account holder name, and account number.'));
      return;
    }

    setPayoutSubmitting(true);
    try {
      const res = onRequestWithdrawal(
        affiliate?.id || (currentUser?.affiliateId as number) || (currentUser?.id as number),
        amt,
        cleanPhone,
        {
          method: payoutMethod,
          accountName: payoutMethod === 'bank' ? accountName.trim() : undefined,
          bankName: payoutMethod === 'bank' ? `${bankName.trim()} - A/C: ${accountNumber.trim()}` : undefined
        }
      );

      if (!res.ok) {
        setPayoutError(res.error || t('Could not submit payout request. Please try again.'));
        setPayoutSubmitting(false);
        return;
      }

      toast.success(t('Payout application submitted successfully! Company finance will review and disburse your funds.'));
      setShowPayoutModal(false);
      setPayoutAmount('');
      setPayoutError('');
    } catch {
      setPayoutError(t('An unexpected error occurred while processing payout.'));
    } finally {
      setPayoutSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 pb-20">
      {/* Agent Identification & Hero Banner */}
      <div className="rounded-3xl p-6 sm:p-8 bg-linear-to-r from-slate-950 via-indigo-950 to-slate-900 text-white shadow-xl border border-slate-800 relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                {t('Certified Company Agent / Wakala')}
              </span>
              {company && (
                <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-white/10 text-slate-200 border border-white/15 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-indigo-300" />
                  {company.name}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {affiliate?.name || currentUser?.name || t('Company Agent')}
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl font-medium">
              {t('Official Company Sales & Referral Portal. Track your real-time performance, referred customer orders, commission earnings, and request payouts via mobile money or bank.')}
            </p>
          </div>

          {/* Quick Actions & Referral Tag */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              onClick={() => setShowPayoutModal(true)}
              className="px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition cursor-pointer"
            >
              <Wallet className="w-4 h-4" />
              {t('Apply for Payout')}
            </button>
            <button
              onClick={handleOpenQr}
              className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/15 transition cursor-pointer"
            >
              <QrCode className="w-4 h-4 text-indigo-300" />
              {t('Scan QR Code')}
            </button>
          </div>
        </div>

        {/* Shareable Referral Strip */}
        <div className="mt-6 pt-5 border-t border-white/10 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">{t('My Referral Code')}:</span>
            <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-xl border border-white/10">
              <span className="font-mono font-black text-amber-300 text-sm tracking-wider">{referralCode}</span>
              <button
                onClick={handleCopyCode}
                className="text-slate-400 hover:text-white transition p-0.5"
                title={t('Copy Referral Code')}
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex-1 min-w-[240px] max-w-md bg-black/30 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-300 truncate">
              {referralLink}
            </div>
            <button
              onClick={handleCopyLink}
              className="px-3.5 py-1.5 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition cursor-pointer"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedLink ? t('Copied!') : t('Copy Link')}
            </button>
            <button
              onClick={handleShareWhatsApp}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              {t('WhatsApp')}
            </button>
          </div>
        </div>
      </div>

      {/* 4 Performance Telemetry Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Available Balance for Payout */}
        <div className="bg-white p-5 rounded-3xl border border-gray-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
              {t('Available Balance')}
            </span>
            <span className="text-2xl font-black text-emerald-600 mt-1 block font-mono">
              {formatMoney(availableBalance, activeCurrency, activeExchangeRate)}
            </span>
            <span className="text-[11px] text-gray-500 font-medium block mt-1">
              {t('Min payout')}: {formatMoney(minWithdrawal, activeCurrency, activeExchangeRate)}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
        </div>

        {/* Total Earned Commissions */}
        <div className="bg-white p-5 rounded-3xl border border-gray-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
              {t('Total Commissions Earned')}
            </span>
            <span className="text-2xl font-black text-slate-900 mt-1 block font-mono">
              {formatMoney(totalEarned, activeCurrency, activeExchangeRate)}
            </span>
            <span className="text-[11px] text-indigo-600 font-bold block mt-1">
              {formatMoney(pendingCommission, activeCurrency, activeExchangeRate)} {t('pending verification')}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Total Referred GMV Volume */}
        <div className="bg-white p-5 rounded-3xl border border-gray-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
              {t('Customer Sales Generated')}
            </span>
            <span className="text-2xl font-black text-slate-900 mt-1 block font-mono">
              {formatMoney(totalReferredGmv, activeCurrency, activeExchangeRate)}
            </span>
            <span className="text-[11px] text-amber-600 font-bold block mt-1">
              {totalSalesCount} {t('successful customer orders')}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-6 h-6" />
          </div>
        </div>

        {/* Total Payouts Settle */}
        <div className="bg-white p-5 rounded-3xl border border-gray-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
              {t('Total Withdrawn & Paid')}
            </span>
            <span className="text-2xl font-black text-purple-700 mt-1 block font-mono">
              {formatMoney(totalWithdrawn, activeCurrency, activeExchangeRate)}
            </span>
            <span className="text-[11px] text-slate-500 font-medium block mt-1">
              {affiliateWithdrawals.length} {t('payout requests recorded')}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Award className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab('performance')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'performance'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          {t('Work Performance & Sales Ledger')}
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-700 text-slate-200 font-mono">
            {affiliateSales.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('payouts')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'payouts'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Wallet className="w-4 h-4" />
          {t('Payment History & Withdrawals')}
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-700 text-emerald-100 font-mono">
            {affiliateWithdrawals.length}
          </span>
        </button>
      </div>

      {/* TAB 1: WORK PERFORMANCE & SALES LEDGER */}
      {activeTab === 'performance' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  statusFilter === 'all' ? 'bg-slate-900 text-white shadow-xs' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t('All Sales')} ({affiliateSales.length})
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  statusFilter === 'pending' ? 'bg-amber-600 text-white shadow-xs' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                }`}
              >
                {t('Pending')} ({affiliateSales.filter(s => s.status === 'pending').length})
              </button>
              <button
                onClick={() => setStatusFilter('approved')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  statusFilter === 'approved' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                {t('Approved')} ({affiliateSales.filter(s => s.status === 'approved').length})
              </button>
              <button
                onClick={() => setStatusFilter('paid')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  statusFilter === 'paid' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
                }`}
              >
                {t('Paid Out')} ({affiliateSales.filter(s => s.status === 'paid').length})
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={orderSearch}
                onChange={e => setOrderSearch(e.target.value)}
                placeholder={t('Search order number...')}
                className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium outline-none focus:border-indigo-500 focus:bg-white transition"
              />
            </div>
          </div>

          {/* Sales Ledger Table */}
          <div className="bg-white rounded-3xl border border-gray-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white font-extrabold uppercase tracking-wider text-[11px]">
                    <th className="p-4">{t('Order Reference')}</th>
                    <th className="p-4">{t('Date & Time')}</th>
                    <th className="p-4 text-right">{t('Order Value')}</th>
                    <th className="p-4 text-center">{t('Rate')}</th>
                    <th className="p-4 text-right">{t('Commission Earned')}</th>
                    <th className="p-4 text-center">{t('Status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-gray-400">
                        <ShoppingBag className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                        <p className="font-bold text-gray-600">{t('No referred sales recorded yet')}</p>
                        <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                          {t('Share your referral code or QR code with prospective clients. Whenever an order is placed through your code, commissions appear here automatically.')}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map(sale => {
                      return (
                        <tr key={sale.id} className="hover:bg-slate-50/70 transition">
                          <td className="p-4 font-mono font-bold text-indigo-700">
                            {sale.orderNumber || `#ORD-${sale.orderId}`}
                          </td>
                          <td className="p-4 text-gray-600">
                            {new Date(sale.createdAt).toLocaleDateString()} {new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="p-4 text-right font-mono font-bold text-gray-900">
                            {formatMoney(sale.amount, activeCurrency, activeExchangeRate)}
                          </td>
                          <td className="p-4 text-center">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {sale.commissionPercent}%
                            </span>
                          </td>
                          <td className="p-4 text-right font-mono font-black text-emerald-600 text-sm">
                            +{formatMoney(sale.commissionAmount, activeCurrency, activeExchangeRate)}
                          </td>
                          <td className="p-4 text-center">
                            {sale.status === 'pending' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                <Clock className="w-3 h-3 text-amber-600" />
                                {t('Pending Verification')}
                              </span>
                            )}
                            {sale.status === 'approved' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                {t('Approved & In Balance')}
                              </span>
                            )}
                            {sale.status === 'paid' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                                <Check className="w-3 h-3 text-indigo-600" />
                                {t('Paid Out')}
                              </span>
                            )}
                            {(sale.status === 'cancelled' || sale.status === 'rejected') && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                                <XCircle className="w-3 h-3 text-rose-600" />
                                {t('Cancelled')}
                              </span>
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

      {/* TAB 2: PAYMENT APPLICATIONS & WITHDRAWAL HISTORY */}
      {activeTab === 'payouts' && (
        <div className="space-y-4">
          {/* Top Info Banner with Quick Action */}
          <div className="bg-white p-5 rounded-3xl border border-gray-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-600" />
                {t('Commission Payment Applications & Settled Payouts')}
              </h3>
              <p className="text-xs text-gray-500">
                {t('Apply for mobile money (M-Pesa, Tigo Pesa, Airtel, HaloPesa) or bank disbursements once balance reaches')} {formatMoney(minWithdrawal, activeCurrency, activeExchangeRate)}.
              </p>
            </div>
            <button
              onClick={() => setShowPayoutModal(true)}
              className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              {t('Apply for Payout Now')}
            </button>
          </div>

          {/* Withdrawals Table */}
          <div className="bg-white rounded-3xl border border-gray-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white font-extrabold uppercase tracking-wider text-[11px]">
                    <th className="p-4">{t('Request ID')}</th>
                    <th className="p-4">{t('Date Submitted')}</th>
                    <th className="p-4">{t('Payment Method')}</th>
                    <th className="p-4">{t('Destination Account')}</th>
                    <th className="p-4 text-right">{t('Amount Requested')}</th>
                    <th className="p-4 text-center">{t('Status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {affiliateWithdrawals.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-gray-400">
                        <Wallet className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                        <p className="font-bold text-gray-600">{t('No payout applications submitted yet')}</p>
                        <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                          {t('When your commission balance reaches the minimum threshold, click "Apply for Payout" to receive your funds.')}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    affiliateWithdrawals.map(w => {
                      return (
                        <tr key={w.id} className="hover:bg-slate-50/70 transition">
                          <td className="p-4 font-mono font-bold text-gray-900">
                            #PAY-{w.id}
                          </td>
                          <td className="p-4 text-gray-600">
                            {new Date(w.requestedAt).toLocaleDateString()} {new Date(w.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="p-4">
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200">
                              {w.method || 'M-Pesa'}
                            </span>
                          </td>
                          <td className="p-4 font-mono font-bold text-slate-800">
                            {w.phoneNumber}
                            {w.bankName && <div className="text-[11px] text-gray-400 font-normal">{w.bankName}</div>}
                          </td>
                          <td className="p-4 text-right font-mono font-black text-slate-900 text-sm">
                            {formatMoney(w.amount, activeCurrency, activeExchangeRate)}
                          </td>
                          <td className="p-4 text-center">
                            {w.status === 'pending' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                <Clock className="w-3 h-3 text-amber-600" />
                                {t('Pending Review')}
                              </span>
                            )}
                            {w.status === 'approved' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                {t('Paid / Settled')}
                              </span>
                            )}
                            {w.status === 'rejected' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                                <XCircle className="w-3 h-3 text-rose-600" />
                                {t('Rejected')}
                              </span>
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

      {/* MODAL: APPLY FOR PAYOUT / WITHDRAWAL */}
      {showPayoutModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 sm:p-7 space-y-5 my-8 border border-gray-100">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b pb-3">
              <div>
                <h3 className="font-extrabold text-base text-gray-900 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-emerald-600" />
                  {t('Apply for Commission Payout')}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {t('Withdraw your earned referral balance directly to Mobile Money or Bank.')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPayoutModal(false)}
                className="text-gray-400 hover:text-gray-600 transition p-1"
              >
                ✕
              </button>
            </div>

            {/* Current Balance Banner */}
            <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('Available for Payout')}</span>
                <span className="text-2xl font-black text-emerald-400 font-mono mt-0.5 block">
                  {formatMoney(availableBalance, activeCurrency, activeExchangeRate)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('Minimum Threshold')}</span>
                <span className="text-xs font-mono font-bold text-slate-300">
                  {formatMoney(minWithdrawal, activeCurrency, activeExchangeRate)}
                </span>
              </div>
            </div>

            {payoutError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{payoutError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitPayout} className="space-y-4 text-xs">
              {/* Payment Method Selector */}
              <div>
                <label className="block font-bold text-gray-700 uppercase tracking-wider text-[11px] mb-1.5">
                  {t('Select Payout Channel')}
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {[
                    { id: 'mpesa', label: 'M-Pesa' },
                    { id: 'tigopesa', label: 'Tigo Pesa' },
                    { id: 'airtel', label: 'Airtel' },
                    { id: 'halopesa', label: 'HaloPesa' },
                    { id: 'bank', label: 'Bank' }
                  ].map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPayoutMethod(m.id as any)}
                      className={`p-2 rounded-xl border text-center font-bold transition text-xs ${
                        payoutMethod === m.id
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-xs'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount Input with MAX Button */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">
                    {t('Payout Amount')} ({activeCurrency}) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setPayoutAmount(availableBalance)}
                    className="text-xs font-bold text-emerald-600 hover:underline cursor-pointer"
                  >
                    {t('Use Max')} ({formatMoney(availableBalance, activeCurrency, activeExchangeRate)})
                  </button>
                </div>
                <input
                  type="number"
                  value={payoutAmount}
                  onChange={e => setPayoutAmount(e.target.value)}
                  placeholder={`Min ${minWithdrawal}`}
                  className="w-full px-3.5 py-2.5 border rounded-xl font-mono font-bold text-gray-900 outline-none focus:border-emerald-500 text-sm"
                  required
                />
              </div>

              {/* Mobile Money Details */}
              {payoutMethod !== 'bank' && (
                <div>
                  <label className="block font-bold text-gray-700 uppercase tracking-wider text-[11px] mb-1">
                    {t('Mobile Money Phone Number')} *
                  </label>
                  <input
                    type="tel"
                    value={payoutPhone}
                    onChange={e => setPayoutPhone(e.target.value)}
                    placeholder="07XXXXXXXX or +255..."
                    className="w-full px-3.5 py-2.5 border rounded-xl font-mono font-bold text-gray-900 outline-none focus:border-emerald-500 text-sm"
                    required
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    {t('Funds will be sent directly to this registered line once approved by Company Finance.')}
                  </p>
                </div>
              )}

              {/* Bank Details */}
              {payoutMethod === 'bank' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">{t('Bank Name')} *</label>
                      <input
                        type="text"
                        value={bankName}
                        onChange={e => setBankName(e.target.value)}
                        placeholder="CRDB, NMB, Stanbic..."
                        className="w-full px-3 py-2 border rounded-xl font-bold text-gray-900 outline-none focus:border-emerald-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">{t('Account Holder Name')} *</label>
                      <input
                        type="text"
                        value={accountName}
                        onChange={e => setAccountName(e.target.value)}
                        placeholder="Full Official Name"
                        className="w-full px-3 py-2 border rounded-xl font-bold text-gray-900 outline-none focus:border-emerald-500"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">{t('Account Number')} *</label>
                    <input
                      type="text"
                      value={accountNumber}
                      onChange={e => setAccountNumber(e.target.value)}
                      placeholder="Account Number"
                      className="w-full px-3 py-2 border rounded-xl font-mono font-bold text-gray-900 outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowPayoutModal(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl font-bold text-xs transition"
                >
                  {t('Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={payoutSubmitting}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {payoutSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {payoutSubmitting ? t('Submitting...') : t('Submit Payout Application')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: QR CODE ACQUISITION CARD */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center space-y-4 border border-gray-100">
            <h3 className="font-extrabold text-base text-gray-900">
              {t('Agent Referral QR Code')}
            </h3>
            <p className="text-xs text-gray-500">
              {t('Scan with any mobile camera to order and link directly to')} {affiliate?.name || currentUser?.name}.
            </p>

            {qrDataUrl && (
              <div className="p-4 bg-gray-50 border rounded-2xl inline-block shadow-inner">
                <img src={qrDataUrl} alt="Agent QR Code" className="w-48 h-48 mx-auto" />
              </div>
            )}

            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-mono font-bold text-indigo-800">
              {referralCode}
            </div>

            <button
              onClick={() => setQrModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer"
            >
              {t('Close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
