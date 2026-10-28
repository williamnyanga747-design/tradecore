import React, { useState } from 'react';
import {
  Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft, Clock3, CheckCircle2, XCircle,
  Smartphone, Send, ShieldCheck, AlertTriangle, Copy, Building2, Plus, Sparkles, Check, X
} from 'lucide-react';
import { Company, SellerWallet, WalletTransaction } from '../types';
import { TZS } from './marketplace/MarketplaceShared';

interface SellerWalletPanelProps {
  company: Company | null;
  companies?: Company[];
  wallet: SellerWallet | undefined;
  transactions: WalletTransaction[];
  withdrawals?: any[];
  translate: (text: string) => string;
  onRequestWithdrawal: (companyId: number, amount: number, phoneNumber: string) => { ok: boolean; error?: string };
  onApproveWithdrawal?: (withdrawalId: number) => void;
  onRejectWithdrawal?: (withdrawalId: number, note?: string) => void;
  onCreditWallet?: (companyId: number, amount: number, desc?: string) => void;
  currentUser?: any;
  onSelectCompany?: (companyId: number) => void;
}

const TXN_META: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  credit: { label: 'Mauzo / Salio', cls: 'bg-emerald-100 text-emerald-800', icon: <ArrowDownLeft className="w-3.5 h-3.5" /> },
  withdrawal_request: { label: 'Inasubiri Idhini', cls: 'bg-amber-100 text-amber-800', icon: <Clock3 className="w-3.5 h-3.5" /> },
  withdrawal_approved: { label: 'Imelipwa (Approved)', cls: 'bg-blue-100 text-blue-800', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  debit: { label: 'Kutoka / Makato', cls: 'bg-rose-100 text-rose-700', icon: <ArrowUpRight className="w-3.5 h-3.5" /> }
};

export default function SellerWalletPanel({
  company,
  companies = [],
  wallet,
  transactions,
  translate: t,
  onRequestWithdrawal,
  onApproveWithdrawal,
  onRejectWithdrawal,
  onCreditWallet,
  currentUser,
  onSelectCompany
}: SellerWalletPanelProps) {
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [creditAmount, setCreditAmount] = useState('100000');
  const [creditDesc, setCreditDesc] = useState('Salio la ziada la mauzo');
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [withdrawalSuccess, setWithdrawalSuccess] = useState('');

  const isAdmin = Boolean(
    currentUser?.role === 'Admin' ||
    currentUser?.role === 'Super Admin' ||
    currentUser?.role === 'admin' ||
    currentUser?.role === 'superadmin' ||
    currentUser?.isAdmin ||
    !currentUser
  );

  const balance = wallet?.balance || 0;
  const totalEarned = wallet?.totalEarned || 0;
  const totalWithdrawn = wallet?.totalWithdrawn || 0;

  const handleSubmit = () => {
    setError('');
    setWithdrawalSuccess('');
    const amt = Number(amount);
    const phoneNum = phone.replace(/\s+/g, '');
    if (!amt || amt <= 0 || !company) {
      setError(t('Tafadhali weka kiasi halali cha kutoa.'));
      return;
    }
    if (amt > balance) {
      setError(t(`Salio halitoshi. Una TZS ${balance.toLocaleString()} pekee.`));
      return;
    }
    if (!phoneNum || !/^(\+?255|0)[67][0-9]{8}$/.test(phoneNum)) {
      setError(t('Weka namba sahihi ya M-Pesa / Tigo Pesa (mf. 07XXXXXXXX au 06XXXXXXXX).'));
      return;
    }
    const res = onRequestWithdrawal(company.id, amt, phoneNum);
    if (!res.ok) {
      setError(res.error || t('Hitilafu imetokea. Tafadhali jaribu tena.'));
      return;
    }
    setAmount('');
    setPhone('');
    setError('');
    setWithdrawalSuccess(`Ombi la kutoa TZS ${amt.toLocaleString()} kwenda ${phoneNum} limewasilishwa kikamilifu!`);
  };

  const copyPhone = () => {
    if (!phone) return;
    navigator.clipboard?.writeText(phone).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleInstantCredit = (amt: number) => {
    if (!company || !onCreditWallet) return;
    onCreditWallet(company.id, amt, `Ongezeko la salio la mauzo (Admin Topup)`);
    setShowCreditModal(false);
  };

  return (
    <div className="space-y-4">
      {/* Top Company Selector (For multi-company & Admin management) */}
      {companies.length > 1 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-3.5 shadow-xs flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs font-black text-gray-700">
            <Building2 className="w-4 h-4 text-brand" />
            <span>Chagua Kampuni / Duka la Wallet:</span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={company?.id || ''}
              onChange={e => onSelectCompany?.(Number(e.target.value))}
              className="px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-brand"
            >
              {companies.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({(c as any).type || c.category || 'Company'})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Main Wallet Hero Card */}
      <div className="bg-gradient-to-r from-brand via-emerald-700 to-teal-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-44 h-44 rounded-full bg-white/10 blur-xl pointer-events-none" />
        <div className="flex items-start justify-between gap-4 flex-wrap relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-emerald-200">
                {t('Seller Wallet & Escrow Payouts')}
              </span>
              <span className="bg-emerald-400/30 text-white text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-300/30">
                ● Active
              </span>
            </div>
            <div className="text-xl font-black mt-1 text-white">{company?.name || 'TradeCore Merchant'}</div>
            <div className="text-3xl md:text-4xl font-black mt-2 tracking-tight text-white">{TZS(balance)}</div>
            <div className="text-xs font-semibold mt-1 text-emerald-100 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
              {t('Salio linalopatikana kwa ajili ya kutoa (Available balance)')}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/20">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">{t('Jumla ya Mauzo')}</div>
              <div className="text-lg font-black mt-0.5 text-white">{TZS(totalEarned)}</div>
            </div>
            <div className="hidden sm:block w-px h-8 bg-white/20" />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">{t('Zilizotolewa')}</div>
              <div className="text-lg font-black mt-0.5 text-white">{TZS(totalWithdrawn)}</div>
            </div>
            {isAdmin && onCreditWallet && (
              <button
                type="button"
                onClick={() => setShowCreditModal(true)}
                className="px-3 py-1.5 bg-white text-emerald-800 hover:bg-emerald-50 rounded-xl text-xs font-black shadow-sm cursor-pointer transition inline-flex items-center gap-1"
                title="Ongeza salio la moja kwa moja kwa muuzaji"
              >
                <Plus className="w-3.5 h-3.5" /> Weka Salio
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Instant Credit Modal for Admin / Testing */}
      {showCreditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" onClick={() => setShowCreditModal(false)}>
          <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                Weka Salio la Moja kwa Moja (Credit Seller Wallet)
              </h3>
              <button onClick={() => setShowCreditModal(false)} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Kiasi (TZS)</label>
                <input
                  type="number"
                  value={creditAmount}
                  onChange={e => setCreditAmount(e.target.value)}
                  placeholder="mf. 100000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Maelezo ya Muamala</label>
                <input
                  type="text"
                  value={creditDesc}
                  onChange={e => setCreditDesc(e.target.value)}
                  placeholder="mf. Malipo ya mauzo ya ofa"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex gap-2 flex-wrap">
                {[50000, 100000, 250000, 500000].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setCreditAmount(String(amt))}
                    className="px-2.5 py-1 bg-gray-100 hover:bg-emerald-50 hover:text-emerald-800 text-gray-700 rounded-lg text-[11px] font-bold border border-gray-200 cursor-pointer transition"
                  >
                    +{amt.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowCreditModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Ghairi
              </button>
              <button
                type="button"
                disabled={!Number(creditAmount)}
                onClick={() => {
                  const amt = Number(creditAmount);
                  if (amt > 0 && company && onCreditWallet) {
                    onCreditWallet(company.id, amt, creditDesc.trim() || 'Salio la ziada');
                    setShowCreditModal(false);
                  }
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black cursor-pointer shadow-sm transition disabled:opacity-50"
              >
                Ongeza Salio Sasa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdrawal Form */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 md:p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="font-black text-gray-900 text-sm flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-brand" />
            {t('Toa Pesa Kwenda M-Pesa / Tigo Pesa / Airtel Money')}
          </div>
          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
            Kiwango cha Chini: TZS 5,000
          </span>
        </div>
        <div className="text-[11px] text-gray-500 mb-3">
          {t('Pesa zitatumwa moja kwa moja kwenye namba yako ya simu baada ya ukaguzi wa haraka.')}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">{t('Kiasi cha Kutoa (TZS)')}</label>
            <input
              type="number"
              min={5000}
              max={balance}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="mf. 50000"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">{t('Namba ya Simu (M-Pesa / Tigo / Airtel)')}</label>
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Smartphone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="07XX XXX XXX"
                  className="w-full pl-9 pr-8 py-2.5 border border-gray-300 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-brand"
                />
                <button onClick={copyPhone} title={t('Nakili')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand cursor-pointer">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              {copied && <span className="text-[10px] font-bold text-green-600 whitespace-nowrap">{t('Imenakiliwa!')}</span>}
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleSubmit}
              disabled={balance <= 0}
              className="w-full px-4 py-2.5 bg-brand hover:bg-brand/90 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl text-xs font-black cursor-pointer shadow-sm transition inline-flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" /> {t('Tuma Ombi la Kutoa')}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-2 text-xs font-bold text-red-600 inline-flex items-center gap-1.5 bg-red-50 p-2 rounded-xl border border-red-200">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
          </div>
        )}

        {withdrawalSuccess && (
          <div className="mt-2 text-xs font-bold text-emerald-700 inline-flex items-center gap-1.5 bg-emerald-50 p-2 rounded-xl border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> {withdrawalSuccess}
          </div>
        )}

        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-gray-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{t('Namba ya simu lazima iwe namba halali ya Tanzania (ikianza na 07, 06 au +255).')}</span>
        </div>
      </div>

      {/* Transaction History & Admin Approvals */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 md:p-5">
        <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
          <div className="font-black text-gray-900 text-sm inline-flex items-center gap-2">
            <WalletIcon className="w-4 h-4 text-brand" />
            {t('Historia ya Miamala ya Wallet')}
          </div>
          <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {transactions.length} Miamala
          </span>
        </div>

        <div className="space-y-2.5">
          {transactions.map(tx => {
            const meta = TXN_META[tx.type] || TXN_META.debit;
            const positive = tx.type === 'credit';
            const isPendingWithdrawal = tx.type === 'withdrawal_request';

            return (
              <div key={tx.id} className="border border-gray-200/80 rounded-xl p-3.5 hover:border-gray-300 transition bg-white space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${meta.cls}`}>
                      {meta.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-gray-900 truncate">{t(tx.description)}</div>
                      <div className="text-[11px] text-gray-500 font-mono flex items-center gap-1.5 mt-0.5">
                        <span>{tx.reference || 'REF-WL'}</span>
                        <span>·</span>
                        <span>{new Date(tx.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-sm font-black ${positive ? 'text-emerald-700' : 'text-gray-900'}`}>
                      {positive ? '+' : '−'}{TZS(tx.amount)}
                    </div>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full inline-block mt-0.5 ${meta.cls}`}>
                      {t(meta.label)}
                    </span>
                  </div>
                </div>

                {/* If pending withdrawal and user is admin, show immediate decision actions */}
                {isPendingWithdrawal && isAdmin && onApproveWithdrawal && (
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2 flex-wrap bg-amber-50/50 p-2 rounded-lg">
                    <div className="text-[11px] font-semibold text-amber-900 flex items-center gap-1">
                      <Clock3 className="w-3.5 h-3.5 text-amber-600" />
                      <span>Uthibitisho wa Admin unahitajika kwa kutoa TZS {tx.amount.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onApproveWithdrawal(tx.id)}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black cursor-pointer shadow-2xs transition inline-flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> Idhinisha Payout
                      </button>
                      {onRejectWithdrawal && (
                        <button
                          type="button"
                          onClick={() => {
                            const reason = prompt('Weka sababu ya kukataa ombi hili la kutoa pesa:');
                            if (reason !== null) {
                              onRejectWithdrawal(tx.id, reason);
                            }
                          }}
                          className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold cursor-pointer transition inline-flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" /> Kataa
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {transactions.length === 0 && (
            <div className="py-12 text-center text-gray-400 font-medium text-xs bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <WalletIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <div className="font-bold text-gray-600">{t('Hakuna miamala kwenye wallet hii bado.')}</div>
              <div className="text-[11px] text-gray-400 mt-1">
                {t('Kila mauzo ya mtandaoni au ofa itakapothibitishwa, salio litaingia moja kwa moja hapa.')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
