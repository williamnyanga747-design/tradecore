import React, { useState } from 'react';
import {
  Zap, ArrowRight, LogIn, UserPlus, BarChart3, Package, ShoppingCart, FileText, ShieldCheck, Globe2, Phone, Mail,
  LayoutDashboard, Boxes, Wallet, Users, MessageSquare, ChevronDown, ChevronLeft, ChevronRight, Send,
  CheckCircle2, Star, Target, Heart, Lightbulb, Scale, Cpu, Layers, ClipboardCheck, Lock, TrendingUp, Eye,
  Sparkles, Quote, Store
} from 'lucide-react';
import { getPublicTheme, PublicTheme, GoldenTopLine, PublicThemeToggle } from '../utils/publicTheme';
import { Company, MarketplaceProduct, HomepageContent, SiteConfig } from '../types';
import { isProductVisible } from './marketplace/MarketplaceShared';
import { defaultHomepageContent } from '../initialData';

const CONTENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'shopping-cart': ShoppingCart,
  'package': Package,
  'file-text': FileText,
  'bar-chart-3': BarChart3,
  'boxes': Boxes,
  'clipboard-check': ClipboardCheck,
  'lock': Lock,
  'cpu': Cpu,
  'users': Users,
  'trending-up': TrendingUp,
  'shield-check': ShieldCheck,
  'layers': Layers,
  'heart': Heart,
  'lightbulb': Lightbulb,
  'scale': Scale
};

interface HomepageProps {
  translate: (text: string) => string;
  theme: PublicTheme;
  onToggleTheme: () => void;
  onRegister: () => void;
  onLogin: () => void;
  onStartDemo: () => void;
  onSubmitContact: (data: { name: string; email: string; phone: string; subject: string; message: string }) => void;
  marketplaceCompanies?: Company[];
  marketplaceProducts?: MarketplaceProduct[];
  onGoMarketplace?: (path: string) => void;
  homepageContent?: HomepageContent;
  siteConfig?: SiteConfig;
}

type HomeTab = 'overview' | 'features' | 'pricing' | 'about' | 'faq';

export default function Homepage({ translate: t, theme, onToggleTheme, onRegister, onLogin, onStartDemo, onSubmitContact, marketplaceCompanies = [], marketplaceProducts = [], onGoMarketplace, homepageContent, siteConfig }: HomepageProps) {
  const th = getPublicTheme(theme);
  const milk = theme === 'milk';
  const content = homepageContent || defaultHomepageContent;
  const settingsSupportPhone = siteConfig?.supportPhone || '+255 700 000 000';
  const settingsSupportEmail = siteConfig?.supportEmail || 'globaltradecore@gmail.com';
  const contentIcon = (name: string, cls: string) => {
    const Icon = CONTENT_ICONS[name] || Package;
    return <Icon className={cls} />;
  };

  const [tab, setTab] = useState<HomeTab>('overview');
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const [page, setPage] = useState(0);
  const perPage = 4;
  const maxPage = Math.max(0, Math.ceil(content.featureCarousel.length / perPage) - 1);
  const visibleFeatures = content.featureCarousel.slice(page * perPage, page * perPage + perPage);

  const [contact, setContact] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [contactError, setContactError] = useState('');

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact.name.trim() || !contact.email.trim() || !contact.message.trim()) {
      setContactError(t('Please fill in your name, email and message.'));
      return;
    }
    onSubmitContact(contact);
    setContactSubmitted(true);
    setContactError('');
    setContact({ name: '', email: '', phone: '', subject: '', message: '' });
  };

  const setField = (field: keyof typeof contact, value: string) => setContact(prev => ({ ...prev, [field]: value }));

  const tabs: Array<{ key: HomeTab; label: string; icon: React.ElementType }> = [
    { key: 'overview', label: t('Overview'), icon: LayoutDashboard },
    { key: 'features', label: t('Features & Modules'), icon: Boxes },
    { key: 'pricing', label: t('Pricing & Plans'), icon: Wallet },
    { key: 'about', label: t('About Us'), icon: Users },
    { key: 'faq', label: t('FAQ & Contact'), icon: MessageSquare }
  ];

  const sectionTitle = (chip: string, title: string, sub?: string) => (
    <div className="text-center max-w-2xl mx-auto mb-8">
      <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest rounded-full px-3 py-1 ${th.chip} ${th.chipBorder} ${th.chipText}`}>
        <Sparkles className="w-3 h-3" /> {chip}
      </span>
      <h2 className={`text-2xl md:text-3xl font-black mt-3 ${th.strongText}`}>{title}</h2>
      {sub && <p className={`text-xs ${th.textMuted} font-semibold mt-2 leading-relaxed`}>{sub}</p>}
    </div>
  );

  return (
    <div className={`min-h-screen ${th.root}`}>
      <GoldenTopLine theme={theme} />
      {/* Top nav + tab navigation (sticky together) */}
      <header className={`sticky top-0 z-30 ${th.headerBg} ${th.headerBorder}`}>
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-lg ${milk ? 'bg-[#1f2937] text-amber-400' : 'bg-brand text-[#1f2937]'}`}>T</div>
            <div>
              <div className={`font-black text-sm tracking-tight ${th.strongText}`}>Global TradeCore</div>
              <div className={`text-[9px] ${th.textDim} tracking-wider font-semibold uppercase`}>Enterprise Commerce ERP</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PublicThemeToggle theme={theme} onToggle={onToggleTheme} />
            <button
              onClick={onLogin}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg transition cursor-pointer ${milk ? 'text-gray-600 hover:text-amber-700 hover:bg-amber-100' : 'text-gray-200 hover:text-white hover:bg-white/10'}`}
            >
              <LogIn className="w-3.5 h-3.5" />
              {t('Sign In')}
            </button>
            <button
              onClick={onRegister}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-black rounded-lg transition cursor-pointer ${th.btnPrimary} ${th.btnPrimaryText}`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              {t('Register')}
            </button>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-5 pb-2">
          <nav className="flex items-center gap-1 overflow-x-auto pb-1">
            {tabs.map(tb => {
              const active = tab === tb.key;
              return (
                <button
                  key={tb.key}
                  onClick={() => setTab(tb.key)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 text-[11px] font-black rounded-xl transition cursor-pointer whitespace-nowrap ${
                    active
                      ? `${th.btnPrimary} ${th.btnPrimaryText} shadow-lg shadow-amber-500/20`
                      : milk
                        ? 'text-gray-600 hover:bg-amber-100/70 hover:text-amber-800'
                        : 'text-gray-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <tb.icon className="w-3.5 h-3.5" />
                  {tb.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* ===== OVERVIEW TAB ===== */}
      {tab === 'overview' && (
        <>
          {/* Hero */}
          <section className="max-w-6xl mx-auto px-5 pt-16 pb-12 text-center relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3 ${th.heroBlobA}`}></div>
            <div className={`absolute bottom-0 left-0 w-80 h-80 rounded-full blur-3xl -translate-x-1/3 translate-y-1/3 ${th.heroBlobB}`}></div>
            <div className="relative">
              <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest rounded-full px-3 py-1 ${milk ? 'bg-white text-amber-700 border border-amber-300/70' : 'bg-white/10 border border-amber-400/40 text-amber-300'}`}>
                <Zap className="w-3 h-3" /> The Enterprise Commerce Platform
              </span>
              <h1 className={`text-4xl md:text-5xl font-black leading-tight mt-5 ${th.strongText}`}>
                {content.heroTitle}
              </h1>
              <p className={`max-w-xl mx-auto text-sm ${th.textMuted} font-semibold leading-relaxed mt-4`}>
                {content.heroSubtitle}
              </p>
              <div className="flex items-center justify-center gap-3 mt-8 flex-wrap">
                <button
                  onClick={onRegister}
                  className={`flex items-center gap-2 px-6 py-3 text-xs font-black rounded-xl uppercase tracking-wider shadow-lg transition cursor-pointer ${th.btnPrimary} ${th.btnPrimaryText}`}
                >
                  <UserPlus className="w-4 h-4" />
                  {t('Register Account')}
                </button>
                <button
                  onClick={onStartDemo}
                  className={`flex items-center gap-2 px-6 py-3 text-xs font-black rounded-xl uppercase tracking-wider transition cursor-pointer ${th.btnSecondary} ${th.btnSecondaryText}`}
                >
                  <Zap className="w-4 h-4 text-amber-500" />
                  {t('Start 1-Day Free Demo')}
                </button>
              </div>
            </div>
          </section>

          {/* Key performance metrics */}
          <section className="max-w-6xl mx-auto px-5 pb-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {content.heroStats.map(s => (
                <div key={s.label} className={`${th.statCard} ${th.cardBorder} rounded-2xl p-5 text-center`}>
                  <div className={`text-2xl font-black ${th.statValue}`}>{s.value}</div>
                  <div className={`text-[10px] ${th.textDim} font-bold uppercase tracking-wider mt-1`}>{s.label}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Marketplace promo */}
          <section className="max-w-6xl mx-auto px-5 pb-12">
            <div className={`${th.card} ${th.cardBorder} rounded-2xl p-7 md:p-8 flex flex-col md:flex-row items-center gap-6`}>
              <div className="flex-1">
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${th.chip} ${th.chipBorder} ${th.chipText} px-3 py-1 rounded-full`}>
                  <Store className="w-3 h-3" /> Public Marketplace
                </span>
                <h2 className={`text-xl md:text-2xl font-black mt-3 ${th.strongText}`}>
                  Buy Directly from Verified Tanzanian Companies
                </h2>
                <p className={`text-xs ${th.textMuted} font-semibold leading-relaxed mt-2 max-w-xl`}>
                  Browse wholesale and retail products from registered companies, pay by mobile money and
                  track your delivery — no account needed.
                </p>
                <div className="flex flex-wrap gap-4 mt-4">
                  <div className="text-center">
                    <div className={`text-xl font-black ${th.statValue}`}>{marketplaceCompanies.filter(c => c.isMarketplaceActive !== false).length}</div>
                    <div className={`text-[9px] ${th.textDim} font-black uppercase tracking-wider`}>Companies</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-xl font-black ${th.statValue}`}>{marketplaceProducts.filter(isProductVisible).length}</div>
                    <div className={`text-[9px] ${th.textDim} font-black uppercase tracking-wider`}>Products</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-xl font-black ${th.statValue}`}>{marketplaceCompanies.filter(c => c.isVerified).length}</div>
                    <div className={`text-[9px] ${th.textDim} font-black uppercase tracking-wider`}>Verified</div>
                  </div>
                </div>
                <button
                  onClick={() => onGoMarketplace && onGoMarketplace('/marketplace')}
                  className={`inline-flex items-center gap-2 px-6 py-3 text-xs font-black rounded-xl uppercase tracking-wider mt-5 transition cursor-pointer ${th.btnPrimary} ${th.btnPrimaryText}`}
                >
                  <ShoppingCart className="w-4 h-4" /> Visit Marketplace
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 w-full md:w-80">
                {marketplaceProducts.filter(isProductVisible).slice(0, 4).map(p => (
                  <div key={p.id} className={`${th.featureCard} ${th.cardBorder} rounded-xl overflow-hidden text-center`}>
                    <div className="h-16 overflow-hidden">
                      {p.image ? (
                        <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-yellow-400 to-amber-600 text-white text-xl font-black">
                          {(p.name || '-').charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="px-2 py-1.5">
                      <div className={`text-[10px] font-black ${th.strongText} truncate`}>{p.name}</div>
                      <div className={`text-[9px] ${th.statValue} font-black`}>TZS {p.price.toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Corporate profile card + mission */}
          <section className="max-w-6xl mx-auto px-5 pb-12">
            <div className={`${th.missionCard} ${th.cardBorder} rounded-2xl p-7 md:p-9 grid md:grid-cols-2 gap-6 items-center`}>
              <div>
                <span className={`text-[10px] font-black uppercase tracking-widest ${th.brandText}`}>Corporate Profile</span>
                <h2 className={`text-2xl font-black mt-2 leading-snug ${th.strongText}`}>
                  {content.overviewTitle}
                </h2>
                <p className={`text-xs ${th.textMuted} font-semibold leading-relaxed mt-3`}>
                  {content.overviewText}
                </p>
                <div className="flex flex-wrap gap-2 mt-4">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full ${th.chip} ${th.chipBorder} ${th.chipText}`}>
                    <Globe2 className="w-3 h-3" /> tanzaniatradecore.co.tz
                  </span>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full ${th.chip} ${th.chipBorder} ${th.chipText}`}>
                    <Phone className="w-3 h-3" /> {settingsSupportPhone}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full ${th.chip} ${th.chipBorder} ${th.chipText}`}>
                    <Mail className="w-3 h-3" /> {settingsSupportEmail}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {content.overviewFeatures.map(f => (
                  <div key={f.title} className={`${th.featureCard} ${th.cardBorder} rounded-xl p-4`}>
                    {contentIcon(f.icon, `w-5 h-5 ${th.brandText} mb-2`)}
                    <div className={`text-xs font-black ${th.strongText}`}>{t(f.title)}</div>
                    <p className={`text-[10px] ${th.textDim} font-semibold mt-1 leading-relaxed`}>{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Security + CTA */}
          <section className="max-w-6xl mx-auto px-5 pb-12">
            <div className={`bg-gradient-to-br from-yellow-500 via-amber-500 to-amber-700 rounded-2xl p-7 md:p-9 text-center relative overflow-hidden ${th.btnPrimaryText}`}>
              <div className="absolute top-0 left-0 w-40 h-40 bg-white/15 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2"></div>
              <ShieldCheck className="w-8 h-8 mx-auto mb-3" />
              <h3 className="text-xl font-black">256-bit Encrypted • Bcrypt Password Hashing • Prepared Statements</h3>
              <p className="text-[11px] text-white/85 font-semibold mt-2 max-w-lg mx-auto">
                {t('Every account is protected with industry-standard password hashing, tamper-proof audit trails, and verified payment activation before branch access is granted.')}
              </p>
              <button
                onClick={onRegister}
                className={`inline-flex items-center gap-2 px-6 py-3 text-xs font-black rounded-xl uppercase tracking-wider mt-5 shadow transition cursor-pointer ${milk ? 'bg-[#1f2937] text-amber-300 hover:bg-[#111827]' : 'bg-white text-amber-600 hover:bg-amber-50'}`}
              >
                {t('Get Started Now')}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </section>

          {/* Testimonials */}
          <section className="max-w-6xl mx-auto px-5 pb-14">
            {sectionTitle('Customer Stories', 'Trusted by Growing Businesses', 'Real feedback from successful Global TradeCore users.')}
            <div className="grid md:grid-cols-3 gap-4">
              {content.testimonials.map(tst => (
                <div key={tst.name} className={`${th.card} ${th.cardBorder} rounded-2xl p-6 flex flex-col`}>
                  <Quote className={`w-6 h-6 ${th.brandText} mb-3`} />
                  <p className={`text-xs ${th.textMuted} font-semibold leading-relaxed flex-1`}>“{tst.quote}”</p>
                  <div className="flex gap-0.5 mt-4">
                    {Array.from({ length: tst.stars }).map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black ${milk ? 'bg-amber-100 text-amber-700' : 'bg-amber-400/15 text-amber-300 border border-amber-400/30'}`}>
                      {(tst.name || '-').charAt(0)}
                    </div>
                    <div>
                      <div className={`text-xs font-black ${th.strongText}`}>{tst.name}</div>
                      <div className={`text-[9px] ${th.textDim} font-bold uppercase tracking-wider`}>{tst.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* ===== FEATURES & MODULES TAB ===== */}
      {tab === 'features' && (
        <section className="max-w-6xl mx-auto px-5 pt-12 pb-14">
          {sectionTitle('Features & Modules', 'Everything Your Business Needs in One Platform', 'Interactive showcase of the core TradeCore modules — from stock valuation to enterprise security.')}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {visibleFeatures.map(f => (
              <div key={f.title} className={`${th.card} ${th.cardBorder} rounded-2xl p-5 hover:-translate-y-1 transition duration-200 flex flex-col`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${milk ? 'bg-amber-100 text-amber-700' : 'bg-amber-400/15 text-amber-300 border border-amber-400/30'}`}>
                  <f.icon className="w-5 h-5" />
                </div>
                <div className={`text-[9px] font-black uppercase tracking-widest ${th.brandText}`}>{f.tag}</div>
                <div className={`text-sm font-black mt-1 ${th.strongText}`}>{f.title}</div>
                <p className={`text-[10px] ${th.textDim} font-semibold mt-2 leading-relaxed flex-1`}>{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className={`flex items-center gap-1 px-4 py-2 text-[11px] font-black rounded-xl transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${th.btnSecondary} ${th.btnSecondaryText}`}
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </button>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: maxPage + 1 }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  className={`w-2 h-2 rounded-full transition cursor-pointer ${i === page ? 'bg-amber-500 w-5' : milk ? 'bg-gray-300 hover:bg-gray-400' : 'bg-white/20 hover:bg-white/40'}`}
                />
              ))}
            </div>
            <button
              onClick={() => setPage(Math.min(maxPage, page + 1))}
              disabled={page === maxPage}
              className={`flex items-center gap-1 px-4 py-2 text-[11px] font-black rounded-xl transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${th.btnSecondary} ${th.btnSecondaryText}`}
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="mt-8 text-center">
            <button
              onClick={onStartDemo}
              className={`inline-flex items-center gap-2 px-6 py-3 text-xs font-black rounded-xl uppercase tracking-wider shadow-lg transition cursor-pointer ${th.btnPrimary} ${th.btnPrimaryText}`}
            >
              <Eye className="w-4 h-4" /> {t('Explore With a Free Demo')}
            </button>
          </div>
        </section>
      )}

      {/* ===== PRICING & PLANS TAB ===== */}
      {tab === 'pricing' && (
        <section className="max-w-6xl mx-auto px-5 pt-12 pb-14">
          {sectionTitle('Pricing & Plans', 'Flexible Tiers for Every Stage of Growth', 'Simple, transparent subscription pricing with feature breakdowns. All plans include secure hosting and audit trails.')}
          <div className="grid md:grid-cols-3 gap-4 items-stretch">
            {content.pricingTiers.map(tier => (
              <div
                key={tier.name}
                className={`relative rounded-2xl p-6 flex flex-col ${tier.popular ? `${th.btnPrimaryText} bg-gradient-to-br from-yellow-400 via-amber-500 to-amber-700 shadow-xl shadow-amber-500/25 border-2 border-amber-400` : `${th.card} ${th.cardBorder}`}`}
              >
                {tier.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-[#1f2937] text-amber-400 border border-amber-400/40">
                    Most Popular
                  </span>
                )}
                <div className={`text-[10px] font-black uppercase tracking-widest ${tier.popular ? 'text-white/90' : th.brandText}`}>{tier.name}</div>
                <div className={`text-2xl font-black mt-1 ${tier.popular ? 'text-[#1f2937]' : th.strongText}`}>
                  {tier.price}
                  <span className={`text-[11px] font-bold ${tier.popular ? 'text-[#1f2937]/70' : th.textDim}`}>{tier.period}</span>
                </div>
                <div className={`text-[10px] font-semibold mt-1 ${tier.popular ? 'text-[#1f2937]/75' : th.textMuted}`}>{tier.tagline}</div>
                <div className={`my-4 border-t ${tier.popular ? 'border-[#1f2937]/20' : th.cardBorder}`}></div>
                <ul className={`space-y-2 flex-1 ${tier.popular ? 'text-[#1f2937]' : th.textMuted}`}>
                  {tier.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-[11px] font-semibold">
                      <CheckCircle2 className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${tier.popular ? 'text-[#1f2937]' : 'text-amber-500'}`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={onRegister}
                  className={`mt-5 flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-black rounded-xl uppercase tracking-wider transition cursor-pointer ${
                    tier.popular
                      ? 'bg-[#1f2937] text-amber-300 hover:bg-[#111827]'
                      : `${th.btnPrimary} ${th.btnPrimaryText}`
                  }`}
                >
                  {t('Choose')} {tier.name}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ===== ABOUT US TAB ===== */}
      {tab === 'about' && (
        <section className="max-w-6xl mx-auto px-5 pt-12 pb-14">
          {sectionTitle('About Us', content.aboutTitle, 'The story, mission and values behind Global TradeCore & Enterprise Solutions.')}

          <div className={`${th.missionCard} ${th.cardBorder} rounded-2xl p-7 md:p-9 grid md:grid-cols-2 gap-8 items-start`}>
            <div>
              <span className={`text-[10px] font-black uppercase tracking-widest ${th.brandText}`}>Our Mission</span>
              <p className={`text-sm ${th.textMuted} font-semibold leading-relaxed mt-3`}>
                {content.aboutText}
              </p>
              <span className={`text-[10px] font-black uppercase tracking-widest ${th.brandText} mt-6 block`}>Our Vision</span>
              <p className={`text-sm ${th.textMuted} font-semibold leading-relaxed mt-3`}>
                To become the region's most trusted trade-commerce technology partner — a platform where any
                business, from a single store to a national distributor, runs with bank-grade security and
                enterprise-grade clarity.
              </p>
              <div className="flex flex-wrap gap-2 mt-6">
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full ${th.chip} ${th.chipBorder} ${th.chipText}`}>
                  <Globe2 className="w-3 h-3" /> tanzaniatradecore.co.tz
                </span>
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full ${th.chip} ${th.chipBorder} ${th.chipText}`}>
                  <Phone className="w-3 h-3" /> {settingsSupportPhone}
                </span>
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full ${th.chip} ${th.chipBorder} ${th.chipText}`}>
                  <Mail className="w-3 h-3" /> {settingsSupportEmail}
                </span>
              </div>
            </div>
            <div>
              <span className={`text-[10px] font-black uppercase tracking-widest ${th.brandText}`}>Institutional Growth</span>
              <div className="grid grid-cols-2 gap-3 mt-3">
                {content.aboutStats.map(s => (
                  <div key={s.label} className={`${th.statCard} ${th.cardBorder} rounded-xl p-4 text-center`}>
                    <div className={`text-xl font-black ${th.statValue}`}>{s.value}</div>
                    <div className={`text-[9px] ${th.textDim} font-bold uppercase tracking-wider mt-1`}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8">
            {sectionTitle('Core Values', 'What We Stand For', 'The principles that guide every feature we build and every customer we serve.')}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {content.coreValues.map(v => (
                <div key={v.title} className={`${th.card} ${th.cardBorder} rounded-2xl p-5`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${milk ? 'bg-amber-100 text-amber-700' : 'bg-amber-400/15 text-amber-300 border border-amber-400/30'}`}>
                    {contentIcon(v.icon, 'w-5 h-5')}
                  </div>
                  <div className={`text-sm font-black ${th.strongText}`}>{v.title}</div>
                  <p className={`text-[10px] ${th.textDim} font-semibold mt-2 leading-relaxed`}>{v.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 text-center">
            <button
              onClick={onRegister}
              className={`inline-flex items-center gap-2 px-6 py-3 text-xs font-black rounded-xl uppercase tracking-wider shadow-lg transition cursor-pointer ${th.btnPrimary} ${th.btnPrimaryText}`}
            >
              {t('Join the TradeCore Family')}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      )}

      {/* ===== FAQ & CONTACT TAB ===== */}
      {tab === 'faq' && (
        <section className="max-w-6xl mx-auto px-5 pt-12 pb-14">
          {sectionTitle('FAQ & Contact', 'Common Questions & Direct Support', 'Find quick answers below, or send us a message and our team will respond by phone or email.')}
          <div className="grid lg:grid-cols-2 gap-6 items-start">
            {/* FAQ accordion */}
            <div className="space-y-2">
              {content.faqItems.map((item, i) => {
                const open = faqOpen === i;
                return (
                  <div key={item.q} className={`${th.card} ${th.cardBorder} rounded-xl overflow-hidden`}>
                    <button
                      onClick={() => setFaqOpen(open ? null : i)}
                      className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left cursor-pointer transition ${open ? `${milk ? 'bg-amber-100/60' : 'bg-amber-400/10'}` : 'hover:' + (milk ? 'bg-amber-50' : 'bg-white/5')}`}
                    >
                      <span className={`text-xs font-black ${th.strongText}`}>{item.q}</span>
                      <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${th.brandText} ${open ? 'rotate-180' : ''}`} />
                    </button>
                    {open && (
                      <div className={`px-4 py-3.5 text-[11px] ${th.textMuted} font-semibold leading-relaxed border-t ${th.cardBorder}`}>
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Contact form */}
            <div className={`${th.card} ${th.cardBorder} rounded-2xl p-6`}>
              {contactSubmitted ? (
                <div className="text-center py-10">
                  <div className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center ${milk ? 'bg-emerald-100 text-emerald-600' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'}`}>
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <h3 className={`text-base font-black mt-4 ${th.strongText}`}>{t('Message Sent Successfully!')}</h3>
                  <p className={`text-xs ${th.textMuted} font-semibold mt-2 max-w-xs mx-auto leading-relaxed`}>
                    {t('Thank you for reaching out. Our support team will contact you by phone or email as soon as possible.')}
                  </p>
                  <button
                    onClick={() => setContactSubmitted(false)}
                    className={`mt-5 inline-flex items-center gap-2 px-4 py-2 text-[11px] font-black rounded-xl uppercase tracking-wider transition cursor-pointer ${th.btnSecondary} ${th.btnSecondaryText}`}
                  >
                    <Send className="w-3.5 h-3.5" /> {t('Send Another Message')}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className={`w-4 h-4 ${th.brandText}`} />
                    <h3 className={`text-sm font-black ${th.strongText}`}>{t('Send Us a Message')}</h3>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className={`text-[10px] font-bold uppercase tracking-wider ${th.label}`}>{t('Full Name')} *</label>
                      <input
                        value={contact.name}
                        onChange={(e) => setField('name', e.target.value)}
                        placeholder={t('Your name')}
                        className={th.input}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className={`text-[10px] font-bold uppercase tracking-wider ${th.label}`}>{t('Phone')}</label>
                      <input
                        value={contact.phone}
                        onChange={(e) => setField('phone', e.target.value)}
                        placeholder="+255 7XX XXX XXX"
                        className={th.input}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className={`text-[10px] font-bold uppercase tracking-wider ${th.label}`}>{t('Email')} *</label>
                    <input
                      type="email"
                      value={contact.email}
                      onChange={(e) => setField('email', e.target.value)}
                      placeholder="you@company.com"
                      className={th.input}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className={`text-[10px] font-bold uppercase tracking-wider ${th.label}`}>{t('Subject')}</label>
                    <input
                      value={contact.subject}
                      onChange={(e) => setField('subject', e.target.value)}
                      placeholder={t('How can we help?')}
                      className={th.input}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className={`text-[10px] font-bold uppercase tracking-wider ${th.label}`}>{t('Message')} *</label>
                    <textarea
                      value={contact.message}
                      onChange={(e) => setField('message', e.target.value)}
                      rows={4}
                      placeholder={t('Describe your inquiry...')}
                      className={th.input + ' resize-none'}
                    />
                  </div>
                  {contactError && (
                    <div className="text-[11px] font-bold text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                      {contactError}
                    </div>
                  )}
                  <button
                    type="submit"
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-black rounded-xl uppercase tracking-wider transition cursor-pointer ${th.btnPrimary} ${th.btnPrimaryText}`}
                  >
                    <Send className="w-3.5 h-3.5" /> {t('Submit Inquiry')}
                  </button>
                  <p className={`text-[9px] ${th.textDim} font-semibold text-center`}>
                    {t('Our team responds by phone or email — usually within one business day.')}
                  </p>
                </form>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className={`${th.footerBorder}`}>
        <div className={`max-w-6xl mx-auto px-5 py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-[10px] ${th.footerText} font-semibold`}>
          <div className="flex items-center gap-2">
            <Globe2 className="w-3.5 h-3.5" />
            Global TradeCore & Enterprise Solutions — tanzaniatradecore.co.tz
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> +255747876653</span>
            <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> globaltradecore@gmail.com</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
