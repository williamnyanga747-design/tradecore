import React, { useState } from 'react';
import {
  Share2, Copy, Check, MessageCircle, MousePointerClick, ShoppingBag, Wallet as WalletIcon,
  Smartphone, Send, AlertTriangle, ExternalLink, BadgePercent
} from 'lucide-react';
import { Affiliate, AffiliateClick, AffiliateSale, AffiliateWithdrawal, Company, User } from '../types';
import { TZS } from './marketplace/MarketplaceShared';

interface AffiliateProgramPanelProps {
  user: User | null;
  affiliate: Affiliate | undefined;
  clicks: AffiliateClick[];
  sales: AffiliateSale[];
  withdrawals: AffiliateWithdrawal[];
  companies: Company[];
  commissionPercent: number;
  translate: (text: string) => string;
  onRequestWithdrawal: (affiliateId: number, amount: number, phoneNumber: string) => { ok: boolean; error?: string };
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
  return companies.find(c => c.id === id)?.name || `Company #${id}`;
}

export default function AffiliateProgramPanel({
  user, affiliate, clicks, sales, withdrawals, companies,
  commissionPercent, translate: t, onRequestWithdrawal
}: AffiliateProgramPanelProps) {
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const referralLink = affiliate ? `https://tanzaniatradecore.co.tz/ref/${affiliate.referralCode}` : '';
  const myClicks = affiliate ? clicks.filter(c => c.affiliateId === affiliate.id).length : 0;
  const mySales = affiliate ? sales.filter(s => s.affiliateId === affiliate.id) : [];
  const pendingSales = mySales.filter(s => s.status === 'pending');
  const approvedSales = mySales.filter(s => s.status === 'approved');
  const balance = affiliate?.balance || 0;
  const totalEarned = affiliate?.totalEarned || 0;
  const totalWithdrawn = affiliate?.totalWithdrawn || 0;
  const myWithdrawals = affiliate ? withdrawals.filter(w => w.affiliateId === affiliate.id) : [];

  const copyLink = () => {
    navigator.clipboard?.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const whatsappShare = () => {
    const msg = encodeURIComponent(`${t('Join')} GlobalTradeCore — ${t('order from the best shops in Tanzania using my referral link:')} ${referralLink}`);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  const handleSubmit = () => {
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

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-purple-600 to-brand rounded-xl p-5 text-white shadow-lg">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider opacity-80 inline-flex items-center gap-1.5"><Share2 className="w-4 h-4" /> {t('Affiliate Program')}</div>
            <div className="text-2xl font-black mt-1">{affiliate?.name || user?.name || user?.username || ''}</div>
            <div className="text-[11px] font-semibold mt-1 opacity-90 inline-flex items-center gap-1"><BadgePercent className="w-3.5 h-3.5" /> {t('You earn')} {commissionPercent}% {t('per approved sale')}</div>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{t('Balance')}</div>
              <div className="text-xl font-extrabold mt-0.5">{TZS(balance)}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{t('Earned')}</div>
              <div className="text-xl font-extrabold mt-0.5">{TZS(totalEarned)}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{t('Withdrawn')}</div>
              <div className="text-xl font-extrabold mt-0.5">{TZS(totalWithdrawn)}</div>
            </div>
          </div>
        </div>
      </div>

      {affiliate ? (
        <>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="font-bold text-gray-900 text-sm mb-3">{t('Your Referral Link')}</div>
            <div className="flex items-center gap-2 flex-wrap">
              <input readOnly value={referralLink} className="flex-1 min-w-60 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono text-gray-700 outline-none" onFocus={e => e.target.select()} />
              <button onClick={copyLink} className="px-3 py-2 bg-brand text-white rounded-lg text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 hover:bg-brand/90">
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? t('Copied!') : t('Copy')}
              </button>
              <button onClick={whatsappShare} className="px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 hover:bg-green-700">
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
              </button>
              <button onClick={() => window.open(referralLink, '_blank')} className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 hover:bg-gray-200">
                <ExternalLink className="w-3.5 h-3.5" /> {t('Open')}
              </button>
            </div>
            <div className="mt-2 text-[11px] text-gray-500">{t('Share this link — you get paid for every approved sale it brings.')}</div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center"><MousePointerClick className="w-5 h-5" /></div>
              <div>
                <div className="text-xl font-extrabold text-gray-900 leading-none">{myClicks}</div>
                <div className="text-[11px] font-semibold text-gray-500 mt-1">{t('Clicks')}</div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center"><ShoppingBag className="w-5 h-5" /></div>
              <div>
                <div className="text-xl font-extrabold text-gray-900 leading-none">{mySales.length}</div>
                <div className="text-[11px] font-semibold text-gray-500 mt-1">{t('Sales')}</div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center"><WalletIcon className="w-5 h-5" /></div>
              <div>
                <div className="text-xl font-extrabold text-gray-900 leading-none">{TZS(commissionPercent)}%</div>
                <div className="text-[11px] font-semibold text-gray-500 mt-1">{t('Commission')}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="font-bold text-gray-900 text-sm mb-1">{t('Withdraw Commission to M-Pesa')}</div>
            <div className="text-[11px] text-gray-500 mb-3">{t('ROOT pays approved commissions manually.')}</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">{t('Amount (TZS)')}</label>
                <input type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 50000" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">{t('M-Pesa Number')}</label>
                <div className="relative">
                  <Smartphone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="07XX XXX XXX" className="w-full pl-9 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                </div>
              </div>
              <div className="flex items-end">
                <button onClick={handleSubmit} className="w-full px-4 py-2 bg-brand text-white rounded-lg text-sm font-bold hover:bg-brand/90 cursor-pointer inline-flex items-center justify-center gap-2">
                  <Send className="w-4 h-4" /> {t('Request Payment')}
                </button>
              </div>
            </div>
            {error && <div className="mt-2 text-xs font-bold text-red-600 inline-flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> {error}</div>}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-bold text-gray-900 text-sm">{t('My Sales')}</div>
              <span className="text-[11px] font-bold text-amber-600">{pendingSales.length} {t('Pending')}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-3 font-bold">{t('Order')}</th>
                    <th className="py-2 pr-3 font-bold">{t('Store')}</th>
                    <th className="py-2 pr-3 font-bold">{t('Order Total')}</th>
                    <th className="py-2 pr-3 font-bold">{t('Commission')}</th>
                    <th className="py-2 font-bold">{t('Status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {mySales.map(s => (
                    <tr key={s.id} className="border-b border-gray-100">
                      <td className="py-2 pr-3 font-mono text-gray-700">#{s.orderId}</td>
                      <td className="py-2 pr-3 text-gray-600">{companyNameFor(companies, s.companyId)}</td>
                      <td className="py-2 pr-3 text-gray-600">{TZS(s.amount)}</td>
                      <td className="py-2 pr-3 font-bold text-gray-900">{TZS(s.commissionAmount)} <span className="text-gray-400 font-medium">({s.commissionPercent}%)</span></td>
                      <td className="py-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${SALE_STATUS_BADGE[s.status] || 'bg-gray-100 text-gray-700'}`}>{t(SALE_STATUS_LABEL[s.status] || s.status)}</span>
                      </td>
                    </tr>
                  ))}
                  {mySales.length === 0 && (
                    <tr><td colSpan={5} className="py-6 text-center text-gray-400 font-medium">{t('No sales yet — share your link to start earning.')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="font-bold text-gray-900 text-sm mb-3">{t('Withdrawal History')}</div>
            <div className="space-y-2">
              {myWithdrawals.map(w => (
                <div key={w.id} className="flex items-center justify-between gap-3 border border-gray-100 rounded-lg p-3">
                  <div>
                    <div className="text-xs font-bold text-gray-900">{TZS(w.amount)} → {w.phoneNumber}</div>
                    <div className="text-[10px] text-gray-500">{new Date(w.requestedAt).toLocaleString()}</div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${SALE_STATUS_BADGE[w.status] || 'bg-gray-100 text-gray-700'}`}>{t(SALE_STATUS_LABEL[w.status] || w.status)}</span>
                </div>
              ))}
              {myWithdrawals.length === 0 && <div className="py-4 text-center text-gray-400 font-medium text-xs">{t('No withdrawals yet.')}</div>}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 text-center">
          <Share2 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <div className="font-bold text-gray-900 text-sm">{t('Become an Affiliate')}</div>
          <div className="text-xs text-gray-500 mt-1 max-w-md mx-auto">{t('Join the affiliate program to earn commission on every order that comes through your link.')}</div>
        </div>
      )}
    </div>
  );
}
