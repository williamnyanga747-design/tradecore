import React, { useState } from 'react';
import {
  Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft, Clock3, CheckCircle2, XCircle,
  Smartphone, Send, ShieldCheck, AlertTriangle, Copy
} from 'lucide-react';
import { Company, SellerWallet, WalletTransaction } from '../types';
import { TZS } from './marketplace/MarketplaceShared';

interface SellerWalletPanelProps {
  company: Company | null;
  wallet: SellerWallet | undefined;
  transactions: WalletTransaction[];
  translate: (text: string) => string;
  onRequestWithdrawal: (companyId: number, amount: number, phoneNumber: string) => { ok: boolean; error?: string };
}

const TXN_META: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  credit: { label: 'Mauzo', cls: 'bg-green-100 text-green-800', icon: <ArrowDownLeft className="w-3.5 h-3.5" /> },
  withdrawal_request: { label: 'Inasubiri', cls: 'bg-amber-100 text-amber-800', icon: <Clock3 className="w-3.5 h-3.5" /> },
  withdrawal_approved: { label: 'Imelipwa', cls: 'bg-blue-100 text-blue-800', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  debit: { label: 'Kutoka', cls: 'bg-gray-100 text-gray-700', icon: <ArrowUpRight className="w-3.5 h-3.5" /> }
};

export default function SellerWalletPanel({ company, wallet, transactions, translate: t, onRequestWithdrawal }: SellerWalletPanelProps) {
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const balance = wallet?.balance || 0;
  const totalEarned = wallet?.totalEarned || 0;
  const totalWithdrawn = wallet?.totalWithdrawn || 0;

  const handleSubmit = () => {
    setError('');
    const amt = Number(amount);
    const phoneNum = phone.replace(/\s+/g, '');
    if (!amt || amt <= 0 || !company) {
      setError(t('Please enter a valid amount.'));
      return;
    }
    if (!phoneNum || !/^(\+?255|0)[67][0-9]{8}$/.test(phoneNum)) {
      setError(t('Please enter a valid M-Pesa number.'));
      return;
    }
    const res = onRequestWithdrawal(company.id, amt, phoneNum);
    if (!res.ok) {
      setError(res.error || t('Something went wrong.'));
      return;
    }
    setAmount('');
    setPhone('');
    setError('');
  };

  const copyPhone = () => {
    if (!phone) return;
    navigator.clipboard?.writeText(phone).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-brand to-green-700 rounded-xl p-5 text-white shadow-lg">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">{t('Seller Wallet')} — {company?.name || ''}</div>
            <div className="text-3xl font-black mt-1">{TZS(balance)}</div>
            <div className="text-[11px] font-semibold mt-1 opacity-90">{t('Available to withdraw')}</div>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{t('Total Earned')}</div>
              <div className="text-lg font-extrabold mt-0.5">{TZS(totalEarned)}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{t('Total Withdrawn')}</div>
              <div className="text-lg font-extrabold mt-0.5">{TZS(totalWithdrawn)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="font-bold text-gray-900 text-sm mb-1">{t('Withdraw to M-Pesa')}</div>
        <div className="text-[11px] text-gray-500 mb-3">{t('ROOT processes the payment manually, then you see it as approved.')}</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">{t('Amount (TZS)')}</label>
            <input
              type="number"
              min={0}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="e.g. 500000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">{t('M-Pesa Number')}</label>
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Smartphone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="07XX XXX XXX"
                  className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm outline-none"
                />
                <button onClick={copyPhone} title={t('Copy')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand cursor-pointer">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              {copied && <span className="text-[10px] font-bold text-green-600 whitespace-nowrap">{t('Copied!')}</span>}
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleSubmit}
              className="w-full px-4 py-2 bg-brand text-white rounded-lg text-sm font-bold hover:bg-brand/90 cursor-pointer inline-flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" /> {t('Request Payout')}
            </button>
          </div>
        </div>
        {error && <div className="mt-2 text-xs font-bold text-red-600 inline-flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> {error}</div>}
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-gray-500">
          <ShieldCheck className="w-4 h-4 text-green-600" />
          {t('M-Pesa number must start with 07, 06 or +2557.')}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-bold text-gray-900 text-sm inline-flex items-center gap-2"><WalletIcon className="w-4 h-4 text-brand" /> {t('Wallet Transactions')}</div>
          <span className="text-[11px] font-bold text-gray-400">{transactions.length}</span>
        </div>
        <div className="space-y-2">
          {transactions.map(tx => {
            const meta = TXN_META[tx.type] || TXN_META.debit;
            const positive = tx.type === 'credit';
            return (
              <div key={tx.id} className="flex items-center justify-between gap-3 border border-gray-100 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${meta.cls}`}>{meta.icon}</div>
                  <div>
                    <div className="text-xs font-bold text-gray-900">{t(tx.description)}</div>
                    <div className="text-[10px] text-gray-500">{tx.reference || ''} · {new Date(tx.createdAt).toLocaleString()}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-extrabold ${positive ? 'text-green-600' : 'text-gray-900'}`}>
                    {positive ? '+' : '−'}{TZS(tx.amount)}
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.cls}`}>{t(meta.label)}</span>
                </div>
              </div>
            );
          })}
          {transactions.length === 0 && (
            <div className="py-6 text-center text-gray-400 font-medium text-xs">{t('No transactions yet. Your first sale credits this wallet automatically.')}</div>
          )}
        </div>
      </div>
    </div>
  );
}
