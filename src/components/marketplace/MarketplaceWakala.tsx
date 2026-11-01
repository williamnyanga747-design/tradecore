// =============================================================
// MEGA ULTIMATE — MFUMO WA WAKALA (public affiliate portal)
// Routes: /affiliate/register | /affiliate/login
//         /affiliate/dashboard | /affiliate/withdraw
// =============================================================
import React, { useEffect, useMemo, useState } from 'react';
import {
  Share2, Copy, Check, MessageCircle, MousePointerClick, ShoppingBag,
  Smartphone, Send, AlertTriangle, ExternalLink, BadgePercent, Landmark,
  ArrowLeft, CheckCircle2, UserPlus, KeyRound, QrCode, ShieldCheck, LayoutDashboard
} from 'lucide-react';
import { Affiliate, AffiliateClick, AffiliateSale, AffiliateWithdrawal, Company, Store } from '../../types';
import { getPublicTheme, PublicTheme } from '../../utils/publicTheme';
import { TZS, TFunc } from './MarketplaceShared';
import { generateQrDataUrl } from '../../utils/qrCodeUtils';

export type WakalaView = 'landing' | 'register' | 'login' | 'dashboard' | 'withdraw';

interface MarketplaceWakalaProps {
  view: WakalaView;
  theme: PublicTheme;
  t: TFunc;
  affiliates: Affiliate[];
  affiliateClicks: AffiliateClick[];
  affiliateSales: AffiliateSale[];
  affiliateWithdrawals: AffiliateWithdrawal[];
  companies: Company[];
  stores?: Store[];
  commissionPercent: number;
  minWithdrawal: number;
  onRegisterAffiliate: (data: {
    name: string;
    phone: string;
    password?: string;
    region?: string;
    district?: string;
    ward?: string;
    nida?: string;
  }) => { ok: boolean; error?: string; affiliate?: Affiliate };
  onLoginAffiliate: (identifier: string, password: string) => { ok: boolean; error?: string; affiliate?: Affiliate };
  onRequestWithdrawal: (affiliateId: number, amount: number, phoneNumber: string, options?: {
    method?: string;
    accountName?: string;
    bankName?: string;
  }) => { ok: boolean; error?: string };
  onNavigate: (view: WakalaView) => void;
  onBack: () => void;
}

const SESSION_KEY = 'tradecore_wakala_session';

const SALE_STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  paid: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800',
  rejected: 'bg-red-100 text-red-800'
};

const SALE_STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  paid: 'Paid',
  cancelled: 'Cancelled',
  rejected: 'Rejected'
};

const WDR_STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800'
};

function readSessionId(): number | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? Number(raw) : null;
  } catch (e) {
    return null;
  }
}

export default function MarketplaceWakala({
  view, theme, t, affiliates, affiliateClicks, affiliateSales, affiliateWithdrawals,
  companies, stores = [], commissionPercent, minWithdrawal,
  onRegisterAffiliate, onLoginAffiliate, onRequestWithdrawal, onNavigate, onBack
}: MarketplaceWakalaProps) {
  const th = getTheme(theme);
  const [sessionId, setSessionId] = useState<number | null>(readSessionId());
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [registerForm, setRegisterForm] = useState({ name: '', phone: '', password: '', region: '', district: '', ward: '', nida: '' });
  const [loginForm, setLoginForm] = useState({ phone: '', password: '' });
  const [withdrawForm, setWithdrawForm] = useState({ amount: '', phone: '', method: 'mpesa', accountName: '', bankName: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState(false);

  const affiliate = useMemo(() => {
    if (!sessionId) return undefined;
    return affiliates.find(a => a.id === sessionId) || undefined;
  }, [sessionId, affiliates]);

  const linkedCompany = useMemo(() => {
    if (!affiliate?.companyId) return undefined;
    return companies.find(c => c.id === affiliate.companyId) || undefined;
  }, [affiliate, companies]);

  useEffect(() => {
    setError('');
    setSuccess('');
  }, [view, sessionId]);

  // Generate the referral QR (offline sharing — scan → lands on ?ref=CODE).
  useEffect(() => {
    let alive = true;
    if (affiliate) {
      const link = `https://tanzaniatradecore.co.tz/ref/${affiliate.referralCode}`;
      generateQrDataUrl(link, { width: 320 })
        .then(url => { if (alive) setQrDataUrl(url); })
        .catch(() => {});
    } else {
      setQrDataUrl('');
    }
    return () => { alive = false; };
  }, [affiliate]);

  const setSession = (id: number | null) => {
    setSessionId(id);
    try {
      if (id) localStorage.setItem(SESSION_KEY, String(id));
      else localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
  };

  const myClicks = affiliate ? affiliateClicks.filter(c => c.affiliateId === affiliate.id).length : 0;
  const mySales = affiliate ? affiliateSales.filter(s => s.affiliateId === affiliate.id) : [];
  const pendingSales = mySales.filter(s => s.status === 'pending');
  const approvedSales = mySales.filter(s => s.status === 'approved' || s.status === 'paid');
  const myWithdrawals = affiliate ? affiliateWithdrawals.filter(w => w.affiliateId === affiliate.id) : [];
  const referralLink = affiliate ? `https://tanzaniatradecore.co.tz/ref/${affiliate.referralCode}` : '';

  const go = (v: WakalaView) => {
    if (v === 'dashboard' && !affiliate) { onNavigate('login'); return; }
    onNavigate(v);
  };

  const copyLink = () => {
    navigator.clipboard?.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const whatsappShare = () => {
    const msg = encodeURIComponent(`${t('Jipatie punguzo unapoungana na GlobalTradeCore kupitia wakala')} ${affiliate?.name || ''}: ${referralLink}`);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  const handleRegister = () => {
    setError('');
    if (!registerForm.name.trim() || !registerForm.phone.trim()) {
      setError(t('Please enter your full name and phone number.'));
      return;
    }
    if (!/^(\+?255|0)[67][0-9]{8}$/.test(registerForm.phone.replace(/\s+/g, ''))) {
      setError(t('Please enter a valid phone number.'));
      return;
    }
    if (registerForm.password && registerForm.password.length < 4) {
      setError(t('Password must be at least 4 characters.'));
      return;
    }
    const res = onRegisterAffiliate({
      name: registerForm.name.trim(),
      phone: registerForm.phone.replace(/\s+/g, ''),
      password: registerForm.password || undefined,
      region: registerForm.region.trim() || undefined,
      district: registerForm.district.trim() || undefined,
      ward: registerForm.ward.trim() || undefined,
      nida: registerForm.nida.trim() || undefined
    });
    if (!res.ok) { setError(res.error || t('Something went wrong.')); return; }
    if (res.affiliate) {
      setSession(res.affiliate.id);
      setSuccess(t('Hongera! Umekamilisha usajili wa wakala. Tuma kiungo chako ili kupata tume kila mauzo yanapotimia.'));
      onNavigate('dashboard');
    }
  };

  const handleLogin = () => {
    setError('');
    const idInput = loginForm.phone.trim();
    if (!idInput || !loginForm.password) {
      setError(t('Tafadhali weka Referral Code au Namba ya Simu na Nenosiri lako.'));
      return;
    }
    const res = onLoginAffiliate(idInput, loginForm.password);
    if (!res.ok) { setError(res.error || t('Login failed.')); return; }
    if (res.affiliate) {
      setSession(res.affiliate.id);
      onNavigate('dashboard');
    }
  };

  const handleWithdraw = () => {
    setError('');
    if (!affiliate) { onNavigate('login'); return; }
    const amt = Number(withdrawForm.amount);
    if (!amt || amt <= 0) { setError(t('Please enter a valid amount.')); return; }
    if (amt < minWithdrawal) { setError(t('Minimum withdrawal is') + ` ${TZS(minWithdrawal)}.`); return; }
    if (amt > (affiliate.balance || 0)) { setError(t('Amount exceeds your available balance.')); return; }
    const phoneNum = withdrawForm.phone.replace(/\s+/g, '');
    if (!phoneNum || !/^(\+?255|0)[67][0-9]{8}$/.test(phoneNum)) {
      setError(t('Please enter a valid mobile money number.'));
      return;
    }
    if (withdrawForm.method === 'bank' && (!withdrawForm.accountName.trim() || !withdrawForm.bankName.trim())) {
      setError(t('Please enter your bank name and account name.'));
      return;
    }
    const res = onRequestWithdrawal(affiliate.id, amt, phoneNum, {
      method: withdrawForm.method,
      accountName: withdrawForm.method === 'bank' ? withdrawForm.accountName.trim() : undefined,
      bankName: withdrawForm.method === 'bank' ? withdrawForm.bankName.trim() : undefined
    });
    if (!res.ok) { setError(res.error || t('Something went wrong.')); return; }
    setSuccess(t('Ombi la malipo ya kamisheni limewasilishwa kikamilifu! Kampuni/ROOT itakagua na kukulipa.'));
    setWithdrawForm({ amount: '', phone: '', method: 'mpesa', accountName: '', bankName: '' });
  };

  const renderHero = () => (
    <div className={`rounded-2xl p-6 sm:p-8 bg-gradient-to-r from-purple-700 via-fuchsia-700 to-brand text-white shadow-xl`}>
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider opacity-80">
        <Share2 className="w-4 h-4" /> {t('MFUMO WA WAKALA')} — {t('Earn on every referral sale')}
      </div>
      <h1 className="text-2xl sm:text-3xl font-black mt-2 leading-tight">
        {t('Fanya biashara kwa kuwatafutia wateja maduka bora Tanzania.')}
      </h1>
      <p className="text-[12px] font-medium mt-2 opacity-90 max-w-xl">
        {t('Become a Wakala and earn up to')} {commissionPercent}% {t('commission on every approved order that comes through your referral link or QR code. Payout via M-Pesa, Tigo Pesa or bank.')}
      </p>
      <div className="flex items-center gap-3 mt-5 flex-wrap">
        {!affiliate ? (
          <>
            <button onClick={() => go('register')} className="px-5 py-2.5 bg-white text-brand rounded-xl text-[12px] font-black hover:bg-amber-50 cursor-pointer inline-flex items-center gap-2">
              <UserPlus className="w-4 h-4" /> {t('Jisajili Sasa')} — {t('Free')}
            </button>
            <button onClick={() => go('login')} className="px-5 py-2.5 bg-white/15 text-white border border-white/40 rounded-xl text-[12px] font-black hover:bg-white/25 cursor-pointer inline-flex items-center gap-2">
              <KeyRound className="w-4 h-4" /> {t('Wakala Login')}
            </button>
          </>
        ) : (
          <button onClick={() => go('dashboard')} className="px-5 py-2.5 bg-white text-brand rounded-xl text-[12px] font-black hover:bg-amber-50 cursor-pointer inline-flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4" /> {t('Wakala Dashboard')}
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3 mt-6 max-w-md">
        {[
          { icon: <BadgePercent className="w-4 h-4" />, label: t('Commission'), value: `${commissionPercent}%` },
          { icon: <MousePointerClick className="w-4 h-4" />, label: t('Clicks'), value: '∞' },
          { icon: <Landmark className="w-4 h-4" />, label: t('Payouts'), value: t('M-Pesa · Tigo · Bank') }
        ].map((b, i) => (
          <div key={i} className="bg-white/10 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider opacity-90">{b.icon}{b.label}</div>
            <div className="text-lg font-black mt-1">{b.value}</div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAuthCard = (mode: 'register' | 'login') => {
    const isReg = mode === 'register';
    const f = isReg ? registerForm : loginForm;
    const setF = isReg ? setRegisterForm : setLoginForm;
    const submit = isReg ? handleRegister : handleLogin;
    return (
      <div className={`${th.card} ${th.cardBorder} rounded-2xl p-6 max-w-lg mx-auto shadow-sm`}>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black">
            {isReg ? <UserPlus className="w-5 h-5" /> : <KeyRound className="w-5 h-5" />}
          </div>
          <div>
            <div className="font-black text-sm">{isReg ? t('Usajili wa Wakala Mpya') : t('Wakala Login')}</div>
            <div className="text-[11px] text-gray-500">{isReg ? t('Jaza taarifa zako hapa kuanza kupata tume.') : t('Ingia kupitia Referral Code au namba ya simu na nenosiri lako.')}</div>
          </div>
        </div>
        <div className="space-y-3.5">
          {isReg && (
            <div>
              <label className="text-xs font-bold block mb-1">{t('Full Name')} *</label>
              <input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Mfano: Juma Hassan Ally" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-brand/30" />
            </div>
          )}
          <div>
            <label className="text-xs font-bold block mb-1">
              {isReg ? t('Namba ya Simu (Phone)') : t('Referral Code au Namba ya Simu')} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              {isReg ? (
                <Smartphone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              ) : (
                <QrCode className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              )}
              <input
                value={f.phone}
                onChange={e => setF({ ...f, phone: e.target.value })}
                placeholder={isReg ? "07XX XXX XXX au +255..." : "WAKALA-XXXX au 07XX XXX XXX"}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
            {!isReg && (
              <p className="text-[10px] text-gray-400 mt-1">
                {t('Ingiza Referral Code uliyopewa na kampuni (mfano: WAKALA-A1B2) au namba yako ya simu.')}
              </p>
            )}
          </div>
          <div>
            <label className="text-xs font-bold block mb-1">{t('Password (Nenosiri)')} {!isReg && <span className="text-red-500">*</span>}</label>
            <input
              type="password"
              value={f.password}
              onChange={e => setF({ ...f, password: e.target.value })}
              placeholder={isReg ? t('Hiari — weka nenosiri la kuingilia portal') : '••••••••'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-brand/30"
            />
            {!isReg && (
              <p className="text-[10px] text-gray-400 mt-1">
                {t('Kama kampuni ilikusajili bila nenosiri maalum, nenosiri la kwanza ni 1234.')}
              </p>
            )}
          </div>
          {isReg && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold block mb-1">{t('Region')}</label>
                  <input value={f.region} onChange={e => setF({ ...f, region: e.target.value })} placeholder="Mfano: Dar es Salaam" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-brand/30" />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">{t('District')}</label>
                  <input value={f.district} onChange={e => setF({ ...f, district: e.target.value })} placeholder="Kinondoni, Ilala..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-brand/30" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold block mb-1">{t('Ward (Kata)')}</label>
                  <input value={f.ward} onChange={e => setF({ ...f, ward: e.target.value })} placeholder={t('Optional')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-brand/30" />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">{t('NIDA No.')}</label>
                  <input value={f.nida} onChange={e => setF({ ...f, nida: e.target.value })} placeholder={t('Optional')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-brand/30" />
                </div>
              </div>
            </>
          )}
          {error && (
            <div className="text-[11px] font-bold text-red-600 inline-flex items-center gap-1.5 bg-red-50 p-2.5 rounded-lg w-full border border-red-200">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <button onClick={submit} className="w-full px-4 py-2.5 bg-brand text-white rounded-xl text-xs font-black hover:bg-brand/90 cursor-pointer inline-flex items-center justify-center gap-2 shadow-sm">
            {isReg ? <UserPlus className="w-4 h-4" /> : <KeyRound className="w-4 h-4" />}
            {isReg ? t('Kamilisha Usajili wa Wakala') : t('Ingia kwenye Akaunti')}
          </button>
          <div className="text-center text-[11px] font-semibold text-gray-500">
            {isReg ? (
              <>{t('Umekwishasajiliwa?')} <button onClick={() => go('login')} className="text-brand font-black hover:underline cursor-pointer">{t('Ingia Hapa')}</button></>
            ) : (
              <>{t('Bado huna akaunti ya uwakala?')} <button onClick={() => go('register')} className="text-brand font-black hover:underline cursor-pointer">{t('Jisajili Sasa')}</button></>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderDashboard = () => {
    if (!affiliate) {
      return (
        <div className={`${th.card} ${th.cardBorder} rounded-2xl p-6 max-w-md mx-auto text-center shadow-sm`}>
          <KeyRound className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <div className="font-black text-sm">{t('Wakala Login')}</div>
          <div className="text-xs text-gray-500 mt-1">{t('Tafadhali ingia kwanza ili kutazama salio na kuomba malipo.')}</div>
          <button onClick={() => go('login')} className="mt-4 px-5 py-2.5 bg-brand text-white rounded-xl text-xs font-black cursor-pointer shadow-sm">{t('Ingia Sasa')}</button>
        </div>
      );
    }
    const pending = affiliate.status === 'pending';
    const companyStores = linkedCompany ? (stores || []).filter(s => s.companyId === linkedCompany.id) : [];

    return (
      <div className="space-y-4">
        {/* Linked Company affiliation banner */}
        {linkedCompany && (
          <div className="bg-gradient-to-r from-amber-500/15 via-brand/10 to-purple-500/15 border border-amber-300/60 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-base shadow-sm">
                {linkedCompany.logoUrl ? (
                  <img src={linkedCompany.logoUrl} alt={linkedCompany.name} className="w-11 h-11 rounded-xl object-cover" />
                ) : (
                  (linkedCompany.name || 'K').charAt(0)
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded-md">
                    🏢 {t('Wakala Rasmi wa Kampuni')}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    ✓ {t('Verified Agent')}
                  </span>
                </div>
                <div className="text-sm font-black text-gray-900 mt-0.5">{linkedCompany.name}</div>
                <div className="text-[11px] text-gray-600 font-medium">
                  📍 {[linkedCompany.addressText, linkedCompany.district, linkedCompany.region].filter(Boolean).join(', ') || 'Tanzania'}
                  {companyStores.length > 0 && ` · ${companyStores.length} ${companyStores.length === 1 ? 'Duka / Store' : 'Maduka / Stores'}`}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => linkedCompany.slug && window.open(`/company/${linkedCompany.slug}`, '_blank')}
                className="px-3 py-1.5 text-xs font-bold bg-white text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
              >
                <ExternalLink className="w-3.5 h-3.5 text-amber-600" /> {t('Duka la Kampuni')}
              </button>
            </div>
          </div>
        )}

        {/* Wakala Header Card */}
        <div className={`rounded-2xl p-5 sm:p-6 bg-gradient-to-r from-purple-700 to-brand text-white shadow-xl`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider opacity-80 inline-flex items-center gap-1.5">
                <Share2 className="w-4 h-4" /> {t('Wakala Dashboard')}
              </div>
              <div className="text-2xl font-black mt-1">{affiliate.name}</div>
              <div className="text-xs font-semibold mt-1 opacity-90 inline-flex items-center gap-2">
                <span className="inline-flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-md font-mono font-bold">
                  <QrCode className="w-3.5 h-3.5" /> {affiliate.referralCode}
                </span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${pending ? 'bg-amber-400 text-amber-900' : 'bg-emerald-400 text-emerald-900'}`}>
                  {pending ? t('Pending Approval') : t('Active Wakala')}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-5 sm:gap-7 flex-wrap">
              <div className="bg-white/10 rounded-xl px-3.5 py-2 border border-white/20">
                <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{t('Salio Lililopo (Balance)')}</div>
                <div className="text-xl sm:text-2xl font-black text-amber-300 mt-0.5">{TZS(affiliate.balance)}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{t('Jumla Iliyopatikana')}</div>
                <div className="text-lg font-extrabold mt-0.5">{TZS(affiliate.totalEarned)}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{t('Zilizotolewa')}</div>
                <div className="text-lg font-extrabold mt-0.5">{TZS(affiliate.totalWithdrawn)}</div>
              </div>
            </div>
          </div>
          {/* Quick Apply for Payout CTA */}
          <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between flex-wrap gap-2">
            <div className="text-[11px] font-medium opacity-90">
              {affiliate.balance >= minWithdrawal
                ? t('Una salio linalotosha kuomba malipo mara moja kwa M-Pesa, Tigo Pesa au Benki.')
                : `${t('Kiwango cha chini cha kutoa pesa ni')} ${TZS(minWithdrawal)}. (${t('Bado')} ${TZS(Math.max(0, minWithdrawal - affiliate.balance))})`}
            </div>
            <button
              onClick={() => go('withdraw')}
              disabled={affiliate.balance < minWithdrawal}
              className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-gray-900 rounded-xl text-xs font-black shadow-md cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
            >
              <Landmark className="w-4 h-4" /> {t('Omba Malipo (Apply for Payout)')}
            </button>
          </div>
        </div>

        {pending && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-[11px] font-bold text-amber-800 inline-flex items-center gap-2 w-full">
            <ShieldCheck className="w-4 h-4 flex-shrink-0" />
            {t('Usajili wako unasubiri uthibitisho wa ROOT. Baada ya kuidhinishwa utaanza kupata tume.')}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div className={`${th.card} ${th.cardBorder} rounded-xl p-4 flex items-center gap-3`}>
            <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center"><MousePointerClick className="w-5 h-5" /></div>
            <div>
              <div className="text-xl font-extrabold leading-none">{myClicks}</div>
              <div className="text-[11px] font-semibold text-gray-500 mt-1">{t('Clicks')}</div>
            </div>
          </div>
          <div className={`${th.card} ${th.cardBorder} rounded-xl p-4 flex items-center gap-3`}>
            <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center"><ShoppingBag className="w-5 h-5" /></div>
            <div>
              <div className="text-xl font-extrabold leading-none">{mySales.length}</div>
              <div className="text-[11px] font-semibold text-gray-500 mt-1">{t('Sales')}</div>
            </div>
          </div>
          <div className={`${th.card} ${th.cardBorder} rounded-xl p-4 flex items-center gap-3`}>
            <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center"><BadgePercent className="w-5 h-5" /></div>
            <div>
              <div className="text-xl font-extrabold leading-none">{commissionPercent}%</div>
              <div className="text-[11px] font-semibold text-gray-500 mt-1">{t('Commission')}</div>
            </div>
          </div>
        </div>

        {/* Link and QR card */}
        <div className={`${th.card} ${th.cardBorder} rounded-xl p-4`}>
          <div className="font-bold text-sm mb-3">{t('Kiungo Chako cha Wakala')}</div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="flex flex-col items-center bg-gray-50 rounded-xl p-4">
              {qrDataUrl ? <img src={qrDataUrl} alt="QR" className="w-36 h-36 rounded-lg border border-gray-200 bg-white" /> : (
                <div className="w-36 h-36 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-300"><QrCode className="w-10 h-10" /></div>
              )}
              <div className="text-[11px] font-bold text-gray-600 mt-2">{t('Scan to open your referral link')}</div>
              <div className="text-[10px] text-gray-400 text-center mt-0.5">{t('Chapisha na usambaze kwa wateja wako.')}</div>
            </div>
            <div className="space-y-2 text-[11px] font-semibold text-gray-600">
              <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> {t('Each order via your link earns commission on the order total.')}</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> {t('Minimum withdrawal')} {TZS(minWithdrawal)}.</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> {t('M-Pesa, Tigo Pesa, Airtel Money, Halopesa na Benki.')}</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> {t('Track clicks, sales and commissions in real time.')}</div>
              <button onClick={() => go('withdraw')} className="mt-2 w-full px-4 py-2.5 bg-brand text-white rounded-xl text-xs font-black cursor-pointer inline-flex items-center justify-center gap-2 hover:bg-brand/90 shadow-sm">
                <Landmark className="w-4 h-4" /> {t('Withdraw Commission (Omba Payout)')}
              </button>
              <button onClick={() => setSession(null)} className="w-full px-4 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 cursor-pointer hover:bg-gray-50">
                {t('Logout')}
              </button>
            </div>
          </div>
        </div>

        {/* Sales Table with commission and status */}
        <div className={`${th.card} ${th.cardBorder} rounded-xl p-4`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-bold text-sm">{t('Mauzo Yangu na Kamisheni (Sales & Commissions)')}</div>
              <div className="text-[10px] text-gray-500">{t('Kamisheni inaingizwa rasmi kwenye salio baada ya muuzaji kuhakiki malipo ya mnunuzi.')}</div>
            </div>
            <span className="text-[11px] font-bold text-amber-600 shrink-0">{pendingSales.length} {t('Pending')} · {approvedSales.length} {t('Approved')}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-3 font-bold">{t('Order')}</th>
                  <th className="py-2 pr-3 font-bold">{t('Shop')}</th>
                  <th className="py-2 pr-3 font-bold">{t('Order Total')}</th>
                  <th className="py-2 pr-3 font-bold">{t('Commission')}</th>
                  <th className="py-2 font-bold">{t('Status')}</th>
                </tr>
              </thead>
              <tbody>
                {mySales.map(s => (
                  <tr key={s.id} className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-mono text-gray-700">#{s.orderNumber || s.orderId}</td>
                    <td className="py-2 pr-3 text-gray-600">{companies.find(c => c.id === s.companyId)?.name || `#${s.companyId}`}</td>
                    <td className="py-2 pr-3 text-gray-600">{TZS(s.amount)}</td>
                    <td className="py-2 pr-3 font-bold text-emerald-700">{TZS(s.commissionAmount)} <span className="text-gray-400 font-medium">({s.commissionPercent}%)</span></td>
                    <td className="py-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${SALE_STATUS_BADGE[s.status] || 'bg-gray-100 text-gray-700'}`}>
                        {s.status === 'approved' || s.status === 'paid' ? '✓ ' : ''}{t(SALE_STATUS_LABEL[s.status] || s.status)}
                      </span>
                    </td>
                  </tr>
                ))}
                {mySales.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-gray-400 font-medium">{t('No sales yet — share your link to start earning.')}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderWithdraw = () => {
    if (!affiliate) {
      return (
        <div className={`${th.card} ${th.cardBorder} rounded-2xl p-6 max-w-md mx-auto text-center shadow-sm`}>
          <KeyRound className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <div className="font-black text-sm">{t('Wakala Login')}</div>
          <div className="text-xs text-gray-500 mt-1">{t('Ingia kwanza ili kuomba uchukuaji.')}</div>
          <button onClick={() => go('login')} className="mt-4 px-5 py-2.5 bg-brand text-white rounded-xl text-xs font-black cursor-pointer shadow-sm">{t('Login')}</button>
        </div>
      );
    }

    const availableBal = affiliate.balance || 0;
    const setPresetAmount = (percent: number) => {
      const calc = Math.floor(availableBal * (percent / 100));
      setWithdrawForm(prev => ({ ...prev, amount: String(calc) }));
    };

    return (
      <div className={`${th.card} ${th.cardBorder} rounded-2xl p-6 max-w-xl mx-auto shadow-sm`}>
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
          <div>
            <div className="font-black text-sm">{t('Omba Kutoa Kamisheni (Apply for Payout)')}</div>
            <div className="text-[11px] text-gray-500">{t('Malipo kwa M-Pesa, Tigo Pesa, Airtel Money, Halopesa au Benki.')}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase text-gray-400">{t('Salio Lililopo')}</div>
            <div className="text-xl font-black text-brand">{TZS(availableBal)}</div>
          </div>
        </div>

        {success && (
          <div className="mb-3 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl inline-flex items-center gap-1.5 w-full">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> {success}
          </div>
        )}

        <div className="space-y-3.5">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold block text-gray-700">
                {t('Kiasi cha Kutoa (Amount TZS)')} <span className="text-amber-600 font-black">({t('Min')} {TZS(minWithdrawal)})</span>
              </label>
              {availableBal > 0 && (
                <div className="flex items-center gap-1 text-[10px] font-bold">
                  <span className="text-gray-400">{t('Chagua:')}</span>
                  <button type="button" onClick={() => setPresetAmount(25)} className="px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer">25%</button>
                  <button type="button" onClick={() => setPresetAmount(50)} className="px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer">50%</button>
                  <button type="button" onClick={() => setPresetAmount(100)} className="px-1.5 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 cursor-pointer">100% ({t('Lote')})</button>
                </div>
              )}
            </div>
            <input
              type="number"
              min={minWithdrawal}
              max={availableBal}
              value={withdrawForm.amount}
              onChange={e => setWithdrawForm({ ...withdrawForm, amount: e.target.value })}
              placeholder={`Kiwango kuanzia ${minWithdrawal}`}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>

          <div>
            <label className="text-xs font-bold block mb-1 text-gray-700">{t('Njia ya Malipo (Payment Method)')}</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {[
                { id: 'mpesa', label: 'M-Pesa' },
                { id: 'tigopesa', label: 'Tigo Pesa' },
                { id: 'airtel', label: 'Airtel Money' },
                { id: 'halopesa', label: 'Halopesa' },
                { id: 'bank', label: t('Benki') }
              ].map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setWithdrawForm({ ...withdrawForm, method: m.id })}
                  className={`px-2.5 py-2 rounded-lg text-xs font-black cursor-pointer border transition ${withdrawForm.method === m.id ? 'bg-brand text-white border-brand shadow-xs' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold block mb-1 text-gray-700">
              {withdrawForm.method === 'bank' ? t('Namba ya Simu ya Mawasiliano') : t('Namba ya Kupokelea Malipo')} *
            </label>
            <div className="relative">
              <Smartphone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={withdrawForm.phone}
                onChange={e => setWithdrawForm({ ...withdrawForm, phone: e.target.value })}
                placeholder="07XX XXX XXX au +255..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
          </div>

          {withdrawForm.method === 'bank' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold block mb-1 text-gray-700">{t('Jina la Benki (Bank Name)')} *</label>
                <input value={withdrawForm.bankName} onChange={e => setWithdrawForm({ ...withdrawForm, bankName: e.target.value })} placeholder="Mfano: CRDB, NMB, NBC..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1 text-gray-700">{t('Jina Kamili la Akaunti')} *</label>
                <input value={withdrawForm.accountName} onChange={e => setWithdrawForm({ ...withdrawForm, accountName: e.target.value })} placeholder={t('Majina kwenye akaunti ya benki')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
            </div>
          )}

          {error && (
            <div className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 p-2.5 rounded-lg inline-flex items-center gap-1.5 w-full">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <button onClick={handleWithdraw} className="w-full px-4 py-2.5 bg-brand text-white rounded-xl text-xs font-black hover:bg-brand/90 cursor-pointer inline-flex items-center justify-center gap-2 shadow-sm">
            <Send className="w-4 h-4" /> {t('Tuma Ombi la Malipo (Apply for Payout)')}
          </button>
          <div className="text-[10px] text-gray-400 text-center">{t('Kampuni / ROOT inakagua maombi ya malipo na kulipa kwa namba uliyotoa.')}</div>
        </div>

        {/* Withdrawal History */}
        <div className="mt-6 pt-4 border-t border-gray-100">
          <div className="font-bold text-xs text-gray-700 mb-2">{t('Historia ya Maombi ya Kutoa Pesa (Withdrawal History)')}</div>
          <div className="space-y-2">
            {myWithdrawals.map(w => (
              <div key={w.id} className="flex items-center justify-between gap-3 border border-gray-100 bg-gray-50/50 rounded-xl p-3">
                <div>
                  <div className="text-xs font-black text-gray-900">
                    {TZS(w.amount)} → <span className="font-mono text-gray-700">{w.phoneNumber}</span>
                    <span className="text-[10px] font-bold uppercase ml-1.5 px-1.5 py-0.2 rounded bg-gray-200 text-gray-700">
                      {w.method || 'M-Pesa'}
                    </span>
                    {w.bankName && <span className="text-gray-500 text-[10px]"> ({w.bankName})</span>}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{new Date(w.requestedAt).toLocaleString()}</div>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${WDR_STATUS_BADGE[w.status] || 'bg-gray-100 text-gray-700'}`}>
                  {w.status === 'approved' ? '✓ Imelipwa' : w.status === 'rejected' ? 'Imekataliwa' : 'Inasubiri'}
                </span>
              </div>
            ))}
            {myWithdrawals.length === 0 && <div className="py-4 text-center text-gray-400 font-medium text-xs">{t('Hakuna maombi ya kutoa pesa bado.')}</div>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <button onClick={onBack} className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${th.textMuted} hover:underline cursor-pointer`}>
        <ArrowLeft className="w-3.5 h-3.5" /> {t('Back to Marketplace')}
      </button>
      {view === 'landing' && (
        <>
          {renderHero()}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: <Share2 className="w-5 h-5" />, title: t('Shiriki kiungo chako'), desc: t('Chagua kiungo au QR code yako ya kipekee na uitume kwa wateja kwenye WhatsApp, Instagram au mitaani.') },
              { icon: <BadgePercent className="w-5 h-5" />, title: `${commissionPercent}% ${t('commission')}`, desc: t('Unapata tume kwa kila agizo linalokamilika kupitia kiungo chako — hakuna kikomo cha mauzo.') },
              { icon: <Landmark className="w-5 h-5" />, title: t('Malipo rahisi'), desc: t('Uchukuaji wa tume yako kwa M-Pesa, Tigo Pesa au Benki mara tu ROOT inapothibitisha.') }
            ].map((c, i) => (
              <div key={i} className={`${th.card} ${th.cardBorder} rounded-2xl p-5`}>
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center mb-3">{c.icon}</div>
                <div className="font-black text-sm">{c.title}</div>
                <div className="text-[11px] text-gray-500 mt-1 leading-relaxed">{c.desc}</div>
              </div>
            ))}
          </div>
        </>
      )}
      {view === 'register' && renderAuthCard('register')}
      {view === 'login' && renderAuthCard('login')}
      {view === 'dashboard' && renderDashboard()}
      {view === 'withdraw' && renderWithdraw()}
    </div>
  );
}

function getTheme(theme: PublicTheme) {
  return getPublicTheme(theme);
}
