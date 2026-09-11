import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, UserPlus, Camera, Smartphone, ShieldCheck, CheckCircle2, Landmark, Lock, Loader2, BadgePercent, Store, Coins, ChevronLeft } from 'lucide-react';
import { SubscriptionPlan, PayNumbersConfig, Currency, TradeSubscriptionPlan, TradePlanType } from '../types';
import { formatMoney } from '../utils/format';
import { toast } from '../utils/toast';
import { getPublicTheme, PublicTheme, GoldenTopLine, PublicThemeToggle } from '../utils/publicTheme';
import ReceiptCameraModal from './ReceiptCameraModal';
import LocationPicker from './marketplace/LocationPicker';

export const REGISTER_BUILD_TAG = '2026-08-27-3';

interface RegisterCompanyProps {
  plans: SubscriptionPlan[];
  payNumbers: PayNumbersConfig;
  translate: (text: string) => string;
  theme: PublicTheme;
  onToggleTheme: () => void;
  currency: string;
  exchangeRate: number;
  currencies?: Currency[];
  subscriptionPlans?: TradeSubscriptionPlan[];
  onRegister: (data: {
    name: string;
    username: string;
    email: string;
    phone: string;
    companyName: string;
    country?: string;
    password: string;
    planId: number;
    planName: string;
    amount: number;
    paymentMethod: string;
    paymentReference: string;
    receiptImageUrl: string;
    planSlug?: string;
    planType?: TradePlanType;
    currencyCode?: string;
    exchangeRate?: number;
    amountTzs?: number;
    commissionPercentSnapshot?: number;
    latitude?: number;
    longitude?: number;
    addressText?: string;
    // TRA COMPLIANCE fields
    tinNumber?: string;
    vrnNumber?: string;
    isVatRegistered?: boolean;
    businessLicense?: string;
  }) => string | void | Promise<string | void>;
  onBackToLogin: () => void;
}

interface PlanCard {
  id: number;
  name: string;
  slug: string;
  type: TradePlanType;
  basePriceTZS: number;
  commissionPercent: number;
  maxProducts: number;
  features: string[];
  durationDays?: number;
  isMostPopular?: boolean;
}

export default function RegisterCompany({ plans, payNumbers, translate: t, theme, onToggleTheme, currency, exchangeRate, currencies = [], subscriptionPlans = [], onRegister, onBackToLogin }: RegisterCompanyProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [country, setCountry] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('M-Pesa');
  const [paymentReference, setPaymentReference] = useState('');
  const [receiptImageUrl, setReceiptImageUrl] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [addressText, setAddressText] = useState('');
  const [tinNumber, setTinNumber] = useState('');
  const [vrnNumber, setVrnNumber] = useState('');
  const [isVatRegistered, setIsVatRegistered] = useState(false);
  const [businessLicense, setBusinessLicense] = useState('');
  const [error, setError] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // --- New billing model: active currencies + selectable plans ---
  const activeCurrencies = currencies.filter(c => c.isActive);
  const [currencyCode, setCurrencyCode] = useState<string>(activeCurrencies[0]?.code || 'TZS');
  const selectedCurrency = activeCurrencies.find(c => c.code === currencyCode) || activeCurrencies[0];
  const currencyRate = selectedCurrency?.exchangeRate || 1;

  const tradePlans: PlanCard[] = subscriptionPlans.filter(p => p.isActive).map(p => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    type: p.type,
    basePriceTZS: p.basePriceTZS,
    commissionPercent: p.commissionPercent,
    maxProducts: p.maxProducts,
    features: p.features || [],
    durationDays: p.durationDays,
    isMostPopular: p.type === 'commission'
  }));
  const legacyPlans: PlanCard[] = tradePlans.length === 0
    ? plans.filter(p => p.isActive).map(p => ({
        id: p.id,
        name: p.name,
        slug: 'custom',
        type: 'commission' as TradePlanType,
        basePriceTZS: p.priceTZS,
        commissionPercent: 0,
        maxProducts: 999,
        features: p.features || [],
        durationDays: 30,
        isMostPopular: p.isMostPopular
      }))
    : [];
  const selectablePlans = tradePlans.length > 0 ? tradePlans : legacyPlans;

  const [planId, setPlanId] = useState<number>(selectablePlans[0]?.id || 1);
  const selectedPlan = selectablePlans.find(p => p.id === planId) || selectablePlans[0];

  // Currency-aware plan display (plan prices are stored natively in TZS)
  const money = (tzs: number, usd?: number) => {
    const rate = exchangeRate > 0 ? exchangeRate : 2600;
    const base = usd && usd > 0 ? usd : tzs / 2600;
    return formatMoney(base, currency, rate);
  };

  const planPrice = (plan: PlanCard): string => {
    if (!selectedCurrency) return `TZS ${Math.round(plan.basePriceTZS).toLocaleString('en-US')}`;
    if (selectedCurrency.code === 'TZS') {
      return `TZS ${Math.round(plan.basePriceTZS).toLocaleString('en-US')}`;
    }
    const conv = plan.basePriceTZS / currencyRate;
    return `${selectedCurrency.symbol} ${conv.toLocaleString('en-US', { maximumFractionDigits: 2 })} (~TZS ${Math.round(plan.basePriceTZS).toLocaleString('en-US')})`;
  };

  const validateStep1 = (): string => {
    if (!name.trim()) return 'Full Name is required';
    if (!username.trim()) return 'Username is required';
    if (username.trim().length < 3) return 'Username must be at least 3 characters';
    if (!email.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return 'A valid email address is required';
    if (!phone.trim()) return 'Phone number is required';
    if (!companyName.trim()) return 'Company name is required';
    // TRA COMPLIANCE — TIN required by TRA law
    const cleanTin = tinNumber.replace(/-/g, '');
    if (!cleanTin || !/^\d{9,12}$/.test(cleanTin)) return 'TIN Number (TRA) is required — 9 to 12 digits.';
    if (isVatRegistered && !vrnNumber.trim()) return 'VRN is required when you are VAT registered.';
    if (!password) return 'Password is required';
    if (password.length < 6) return 'Password must be at least 6 characters';
    if (password !== confirmPassword) return 'Passwords do not match';
    return '';
  };

  const validateStep2 = (): string => {
    if (!selectedPlan) return 'Please select a subscription plan';
    if (!paymentReference.trim()) return 'Payment reference / transaction ID is required';
    return '';
  };

  const goStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    const err = validateStep1();
    if (err) {
      setError(t(err));
      toast.error(t(err));
      return;
    }
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    const err = validateStep2();
    if (err) {
      setError(t(err));
      toast.error(t(err));
      return;
    }
    if (!selectedPlan) return;
    setSubmitting(true);
    try {
      // amount_paid = converted in the chosen currency; amount_tzs = plan base in TZS
      const converted = selectedCurrency && selectedCurrency.code !== 'TZS'
        ? Math.round(selectedPlan.basePriceTZS / currencyRate)
        : selectedPlan.basePriceTZS;
      const regError = onRegister({
        name: name.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim(),
        phone: phone.trim(),
        companyName: companyName.trim(),
        country: country.trim(),
        password,
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        amount: converted,
        paymentMethod,
        paymentReference: paymentReference.trim(),
        receiptImageUrl,
        planSlug: selectedPlan.slug,
        planType: selectedPlan.type,
        currencyCode: selectedCurrency?.code || 'TZS',
        exchangeRate: currencyRate,
        amountTzs: selectedPlan.basePriceTZS,
        commissionPercentSnapshot: selectedPlan.commissionPercent,
        latitude: latitude !== null ? latitude : undefined,
        longitude: longitude !== null ? longitude : undefined,
        addressText: addressText.trim(),
        tinNumber: tinNumber.trim(),
        vrnNumber: vrnNumber.trim(),
        isVatRegistered,
        businessLicense: businessLicense || undefined
      });
      if (typeof regError === 'string' && regError) {
        setError(regError);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    } catch (ex) {
      setError(t('Something went wrong while submitting. Please try again.'));
      toast.error(t('Something went wrong while submitting. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const th = getPublicTheme(theme);
  const milk = theme === 'milk';

  const inputCls = th.input;

  return (
    <div className={`relative min-h-screen flex items-center justify-center p-4 ${th.root}`}>
      <div className="absolute top-0 left-0 right-0"><GoldenTopLine theme={theme} /></div>
      <div className="absolute top-4 right-4 z-20">
        <PublicThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
      <div className="w-full max-w-3xl">
        <div className={`${th.card} ${th.cardBorder} rounded-2xl shadow-2xl overflow-hidden`}>
          <div className={`px-7 pt-8 pb-6 relative overflow-hidden ${
            milk ? 'bg-[#f1eadb] text-[#1f2937]' : 'bg-[#0d1832] text-white'
          }`}>
            <div className={`absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl -translate-y-10 translate-x-10 ${milk ? 'bg-amber-400/25' : 'bg-amber-400/15'}`}></div>
            <div className="relative flex items-center gap-3 mb-5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shadow-md ${milk ? 'bg-[#1f2937] text-amber-400' : 'bg-white text-brand'}`}>T</div>
              <div>
                <div className={`font-black text-base tracking-tight ${th.strongText}`}>Global TradeCore</div>
                <div className={`text-[10px] ${th.textDim} tracking-wider font-semibold uppercase`}>Enterprise commerce ERP</div>
              </div>
            </div>
            <div className="relative flex items-center gap-2">
              <UserPlus className={`w-5 h-5 ${th.brandText}`} />
              <h2 className="text-lg font-black">{t('Register Company Account')}</h2>
            </div>
            <p className={`relative text-[11px] ${th.textDim} font-semibold mt-1`}>
              {t('Create an account for your company. Your subscription is activated after Super Admin verifies your payment.')}
            </p>
            <div className="relative flex items-center gap-1.5 mt-4">
              {[1, 2].map(s => (
                <div key={s} className={`flex items-center gap-1.5 ${s === 1 ? 'flex-1' : 'flex-1'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${step >= s ? 'bg-amber-400 text-[#1f2937]' : 'bg-white/15 text-white/60'}`}>{s}</div>
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${step >= s ? 'text-white' : 'text-white/50'}`}>
                    {s === 1 ? t('Company Info') : t('Plan & Payment')}
                  </span>
                  {s === 1 && <div className="h-px flex-1 bg-white/20 ml-1" />}
                </div>
              ))}
            </div>
          </div>

          {step === 1 && (
            <form onSubmit={goStep2} className="p-7 space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-[11px] font-semibold text-red-700">{error}</div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 block tracking-wider uppercase">{t('Full Name')}</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. Juma Mwakyusa" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 block tracking-wider uppercase">{t('Username')}</label>
                  <input value={username} onChange={(e) => setUsername(e.target.value)} className={inputCls} placeholder="e.g. juma_admin" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 block tracking-wider uppercase">{t('Email Address')}</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="name@company.com" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 block tracking-wider uppercase">{t('Phone Number')}</label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="+[country code] [number]" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 block tracking-wider uppercase">{t('Company Name')}</label>
                  <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputCls} placeholder="e.g. Singida Grain Millers" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 block tracking-wider uppercase">{t('Country')}</label>
                  <input value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls} placeholder="e.g. Tanzania, Kenya, UAE" />
                </div>
              </div>

              {/* Feature 4 — store location map picker */}
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 space-y-2">
                <LocationPicker
                  lat={latitude}
                  lng={longitude}
                  onChange={(la, lo) => { setLatitude(la); setLongitude(lo); }}
                  t={t}
                  pickTitle={t('Your store location')}
                  compact
                />
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 block tracking-wider uppercase">{t('Street Address (optional)')}</label>
                  <input value={addressText} onChange={(e) => setAddressText(e.target.value)} className={inputCls} placeholder="e.g. Shekilango Road, Kijitonyama, Dar es Salaam" />
                </div>
              </div>

              {/* TRA COMPLIANCE — TIN / VAT / business license */}
              <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/60 space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-700" />
                  <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider">{t('Taarifa za TRA (Tax Compliance)')}</span>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 block tracking-wider uppercase">{t('TIN Number')} *</label>
                    <input
                      value={tinNumber}
                      onChange={(e) => setTinNumber(e.target.value.replace(/[^0-9\-]/g, ''))}
                      className={inputCls}
                      placeholder="123-456-789"
                      maxLength={14}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 block tracking-wider uppercase">{t('VRN Number (if VAT registered)')}</label>
                    <input
                      value={vrnNumber}
                      onChange={(e) => setVrnNumber(e.target.value.replace(/[^0-9A-Za-z\-]/g, ''))}
                      className={inputCls}
                      placeholder="e.g. 40-012345678"
                      maxLength={20}
                      disabled={!isVatRegistered}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isVatRegistered}
                    onChange={(e) => setIsVatRegistered(e.target.checked)}
                    className="w-4 h-4 accent-amber-600"
                  />
                  <span className="text-[11px] font-bold text-gray-700">{t('Nimesajiliwa VAT (VAT registered)')}</span>
                </label>
                <p className="text-[10px] text-amber-700 font-semibold leading-relaxed">
                  {t('TIN inahitajika kwa mujibu wa sheria za TRA. Kila mauzo yako utawajibika kutoa risiti ya EFD.')}
                </p>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 block tracking-wider uppercase">{t('Business License (optional)')}</label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const fileInput = document.createElement('input');
                        fileInput.type = 'file';
                        fileInput.accept = 'image/*,.pdf';
                        fileInput.onchange = () => {
                          const file = fileInput.files && fileInput.files[0];
                          if (!file) return;
                          if (file.size > 2 * 1024 * 1024) { toast.error(t('File too large (max 2MB).')); return; }
                          const reader = new FileReader();
                          reader.onload = () => setBusinessLicense(String(reader.result || ''));
                          reader.readAsDataURL(file);
                        };
                        fileInput.click();
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 bg-[#2d323e] text-white text-[11px] font-bold rounded-lg cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      {t('Upload License')}
                    </button>
                    {businessLicense && (
                      <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        {t('License attached')}
                        <button type="button" onClick={() => setBusinessLicense('')} className="text-red-500 underline">Remove</button>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <div className="flex-1">
                  <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider">{t('Assigned System Role')}</span>
                  <span className="text-xs font-black text-gray-800">Branch Administrator</span>
                </div>
                <span className="text-[9px] bg-emerald-100 text-emerald-700 font-bold px-2 py-1 rounded-full uppercase">Locked</span>
              </div>

              {/* Login Password */}
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 space-y-3">
                    <div className="flex items-center gap-2">
                  <Lock className={`w-4 h-4 ${th.brandText}`} />
                  <div className="flex-1">
                    <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider">{t('Set Your Login Password')}</span>
                    <span className="text-[10px] text-gray-500 font-semibold">
                      {t('You will sign in with this password once the Super Admin verifies your payment and activates your subscription.')}
                    </span>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 block tracking-wider uppercase">{t('Password')}</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={inputCls + ' pr-16'}
                        placeholder="Minimum 6 characters"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-500 hover:text-amber-600 cursor-pointer"
                      >
                        {showPassword ? t('Hide') : t('Show')}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 block tracking-wider uppercase">{t('Confirm Password')}</label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={inputCls}
                      placeholder="Re-enter your password"
                    />
                  </div>
                </div>
                {password && confirmPassword && password !== confirmPassword && (
                  <p className="text-[10px] font-bold text-red-600">{t('Passwords do not match.')}</p>
                )}
              </div>

              <button
                type="submit"
                className={`w-full py-2.5 ${th.btnPrimary} disabled:opacity-60 text-[#1f2937] text-xs font-bold rounded-lg tracking-wider uppercase shadow cursor-pointer transition flex items-center justify-center gap-2`}
              >
                {t('Continue to Plan & Payment')} <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={submit} className="p-7 space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-[11px] font-semibold text-red-700">{error}</div>
              )}

              {/* Official Pay Numbers */}
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
                <div className="flex items-center gap-2 text-[11px] font-black text-amber-800 uppercase tracking-wider">
                  <Smartphone className="w-4 h-4" />
                  {t('Pay To These Official Numbers')}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                  <div className="bg-white rounded-lg p-2 border border-amber-100">
                    <span className="block text-[9px] text-gray-400 font-bold uppercase">M-Pesa</span>
                    <span className="font-black text-amber-900 font-mono">{payNumbers.mpesa || '- - -'}</span>
                  </div>
                  <div className="bg-white rounded-lg p-2 border border-amber-100">
                    <span className="block text-[9px] text-gray-400 font-bold uppercase">TigoPesa</span>
                    <span className="font-black text-amber-900 font-mono">{payNumbers.tigopesa || '- - -'}</span>
                  </div>
                  <div className="bg-white rounded-lg p-2 border border-amber-100">
                    <span className="block text-[9px] text-gray-400 font-bold uppercase">Airtel Money</span>
                    <span className="font-black text-amber-900 font-mono">{payNumbers.airtel || '- - -'}</span>
                  </div>
                  <div className="bg-white rounded-lg p-2 border border-amber-100">
                    <span className="block text-[9px] text-gray-400 font-bold uppercase">{t('Bank')}</span>
                    <span className="font-black text-amber-900">{payNumbers.bankName}</span>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-2 border border-amber-100 text-[10px] text-amber-800 font-semibold">
                  <span className="flex items-center gap-1"><Landmark className="w-3.5 h-3.5" /> {payNumbers.bankName}: {payNumbers.bankAccount} — {payNumbers.bankHolder}</span>
                </div>
                {payNumbers.instructions && (
                  <p className="text-[10px] text-amber-700 font-semibold leading-relaxed">{payNumbers.instructions}</p>
                )}
              </div>

              {/* Billing currency */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 block tracking-wider uppercase">{t('Billing Currency')}</label>
                <div className="flex items-center gap-2">
                  <Coins className={`w-4 h-4 ${th.brandText}`} />
                  <select
                    value={currencyCode}
                    onChange={(e) => setCurrencyCode(e.target.value)}
                    className={inputCls}
                  >
                    {activeCurrencies.map(c => (
                      <option key={c.id} value={c.code} data-rate={c.exchangeRate} data-symbol={c.symbol}>
                        {c.name} ({c.code}) — {c.code === 'TZS' ? 'base' : `1 ${c.code} = ${c.exchangeRate} TZS`}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[9px] text-gray-400 font-semibold">{t('Plan prices convert to your billing currency automatically.')}</p>
              </div>

              {/* Plan selection — two plan cards */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 block tracking-wider uppercase">{t('Subscription Plan Tier')}</label>
                <div className="grid md:grid-cols-2 gap-2">
                  {selectablePlans.map(plan => (
                    <label
                      key={plan.id}
                      className={`text-left p-3 rounded-xl border transition cursor-pointer block ${
                        planId === plan.id ? 'border-amber-500 bg-amber-400/10 ring-2 ring-amber-500/30' : 'border-gray-200 hover:border-amber-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <input
                            type="radio"
                            name="trade-plan"
                            checked={planId === plan.id}
                            onChange={() => setPlanId(plan.id)}
                            className="mt-0.5 w-4 h-4 accent-amber-500"
                          />
                          <div className="min-w-0">
                            <span className="text-xs font-black text-gray-800 block">{plan.name}</span>
                            <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-full mt-1 ${
                              plan.type === 'direct'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-purple-100 text-purple-700'
                            }">
                              {plan.type === 'direct' ? <Store className="w-3 h-3" /> : <BadgePercent className="w-3 h-3" />}
                              {plan.type === 'direct' ? t('Direct — Pay Seller') : `${t('Commission')} ${plan.commissionPercent}%`}
                            </span>
                          </div>
                        </div>
                        {plan.isMostPopular && (
                          <span className="text-[9px] bg-gradient-to-r from-yellow-400 to-amber-500 text-[#1f2937] font-black px-1.5 py-0.5 rounded-full uppercase shrink-0">Popular</span>
                        )}
                      </div>
                      <div className={`text-sm font-black ${th.brandText} mt-1.5`}>{planPrice(plan)}</div>
                      <div className="text-[10px] text-gray-400 font-semibold">{plan.durationDays || 30} {t('days access')} · {plan.maxProducts} {t('products')}</div>
                      <div className="mt-2 space-y-1">
                        {(plan.features || []).slice(0, 4).map((f, i) => (
                          <div key={i} className="flex items-start gap-1 text-[10px] text-gray-500 font-medium">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-[9px] text-gray-400 font-semibold">
                  {t('Biashara Direct: customers pay you directly via WhatsApp — no platform commission. Biashara Commission: customers pay through the platform and the platform commission is deducted.')}
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 block tracking-wider uppercase">{t('Payment Method')}</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputCls}>
                    <option>M-Pesa</option>
                    <option>TigoPesa</option>
                    <option>Airtel Money</option>
                    <option>Bank Wire Transfer</option>
                    <option>International Bank Wire</option>
                    <option>PayPal</option>
                    <option>Direct Cash</option>
                    <option>Credit Card</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 block tracking-wider uppercase">{t('Payment Reference / Transaction ID')}</label>
                  <input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} className={inputCls} placeholder="e.g. SDR93LXM2A" />
                </div>
              </div>

              {/* Receipt capture */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 block tracking-wider uppercase">{t('Payment Receipt Photo (Optional)')}</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCamera(true)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#2d323e] text-white text-[11px] font-bold rounded-lg"
                  >
                    <Camera className="w-4 h-4" />
                    {t('Capture / Upload Receipt')}
                  </button>
                  {receiptImageUrl && (
                    <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      {t('Receipt attached')}
                      <button type="button" onClick={() => setReceiptImageUrl('')} className="text-red-500 underline">Remove</button>
                    </div>
                  )}
                </div>
                {receiptImageUrl && (
                  <img src={receiptImageUrl} alt="Receipt" className="mt-2 w-40 h-28 object-cover rounded-lg border border-gray-200" />
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setStep(1); setError(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className={`py-2.5 ${th.btnSecondary} ${th.btnSecondaryText} text-xs font-bold rounded-lg tracking-wider uppercase shadow cursor-pointer transition flex items-center justify-center gap-2`}
                >
                  <ChevronLeft className="w-4 h-4" /> {t('Back')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`w-full py-2.5 ${th.btnPrimary} disabled:opacity-60 text-[#1f2937] text-xs font-bold rounded-lg tracking-wider uppercase shadow cursor-pointer transition flex items-center justify-center gap-2`}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('Submitting...')}
                    </>
                  ) : (
                    t('Register & Submit for Verification')
                  )}
                </button>
              </div>
            </form>
          )}

          <div className="pt-2 pb-5 px-7 border-t border-gray-100">
            <button
              type="button"
              onClick={onBackToLogin}
              className="w-full flex items-center justify-center gap-1.5 text-[11px] font-bold text-gray-500 hover:text-amber-600 transition py-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {t('Back to Sign In')}
            </button>
            <p className="text-center text-[9px] text-gray-300 font-semibold mt-1">TradeCore build {REGISTER_BUILD_TAG}</p>
          </div>
        </div>

        <ReceiptCameraModal
          open={showCamera}
          onClose={() => setShowCamera(false)}
          onCapture={setReceiptImageUrl}
          translate={t}
        />
      </div>
    </div>
  );
}
