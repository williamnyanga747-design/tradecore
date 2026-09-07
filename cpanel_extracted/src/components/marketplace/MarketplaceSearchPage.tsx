import React, { useEffect, useMemo, useState } from 'react';
import { Search, X, SlidersHorizontal, Sparkles, MapPin, ChevronLeft, Mic } from 'lucide-react';
import { Company, MarketplaceProduct, SearchSynonym } from '../../types';
import { getPublicTheme, PublicTheme } from '../../utils/publicTheme';
import { ProductCard, TFunc, isProductVisible } from './MarketplaceShared';
import { expandSearchQuery, productMatchesTerms, translatePhrase } from '../../utils/synonymSearch';
import { getPhpConfig } from '../../utils/api';
import { TANZANIA_REGIONS } from '../../utils/regions';
import { useVoiceSearch } from '../../utils/voiceSearch';

interface Props {
  theme: PublicTheme;
  t: TFunc;
  companies: Company[];
  products: MarketplaceProduct[];
  regions?: string[];
  searchSynonyms: SearchSynonym[];
  initialQuery?: string;
  voiceTranscript?: string;
  onVoiceSearch?: (transcript: string, query: string) => void;
  onBack: () => void;
  onOpenCompany: (slug: string) => void;
  onOpenProduct: (product: MarketplaceProduct) => void;
  onAddToCart: (product: MarketplaceProduct) => void;
}

const RATING_OPTIONS = [
  { value: 0, label: 'Zote' },
  { value: 4, label: '4+ Stars' },
  { value: 4.5, label: '4.5+ Stars' },
  { value: 5, label: '5 Stars' }
];

export default function MarketplaceSearchPage({
  theme, t, companies, products, regions, searchSynonyms, initialQuery = '', voiceTranscript = '', onVoiceSearch,
  onBack, onOpenCompany, onOpenProduct, onAddToCart
}: Props) {
  const th = getPublicTheme(theme);
  const [query, setQuery] = useState(initialQuery);
  const [submitted, setSubmitted] = useState(initialQuery);
  const [region, setRegion] = useState('All');
  const [priceRange, setPriceRange] = useState<'all' | 'low' | 'mid' | 'high'>('all');
  const [minRating, setMinRating] = useState(0);
  const [aiLoading, setAiLoading] = useState(false);

  const voice = useVoiceSearch({
    lang: 'sw-TZ',
    onResult: (text, q) => {
      if (onVoiceSearch) onVoiceSearch(text, q);
      else { setQuery(q); setSubmitted(q); }
    }
  });

  useEffect(() => { setQuery(initialQuery); setSubmitted(initialQuery); }, [initialQuery]);

  const activeCompanies = useMemo(() => companies.filter(c => c.isMarketplaceActive !== false), [companies]);
  const visibleProducts = useMemo(() => products.filter(isProductVisible), [products]);
  const regionList = regions && regions.length > 0 ? regions : TANZANIA_REGIONS;

  const expandedTerms = useMemo(() => expandSearchQuery(submitted, searchSynonyms), [submitted, searchSynonyms]);

  const matched = useMemo(() => {
    let list = visibleProducts;
    if (submitted.trim()) list = list.filter(p => productMatchesTerms(p, expandedTerms));
    if (region && region !== 'All') {
      const companyIds = new Set(activeCompanies.filter(c => c.region === region).map(c => c.id));
      list = list.filter(p => companyIds.has(p.companyId));
    }
    if (priceRange !== 'all') {
      list = list.filter(p => {
        const price = p.price || 0;
        if (priceRange === 'low') return price < 100000;
        if (priceRange === 'mid') return price >= 100000 && price < 500000;
        return price >= 500000;
      });
    }
    if (minRating > 0) list = list.filter(p => (p.averageRating || 0) >= minRating);
    return list;
  }, [visibleProducts, submitted, expandedTerms, region, priceRange, minRating, activeCompanies]);

  const companyNameFor = (companyId: number) => activeCompanies.find(c => c.id === companyId)?.name || '';

  const submit = () => setSubmitted(query);

  const clearAll = () => {
    setQuery('');
    setSubmitted('');
    setRegion('All');
    setPriceRange('all');
    setMinRating(0);
  };

  const runAiSwitch = async () => {
    if (!query.trim()) return;
    setAiLoading(true);
    try {
      const { apiUrl } = getPhpConfig();
      const res = await fetch(`${apiUrl}?action=ai_search_expand&q=${encodeURIComponent(query)}`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json && json.success && json.expanded) {
          setQuery(json.expanded);
          setSubmitted(json.expanded);
          setAiLoading(false);
          return;
        }
      }
    } catch (e) { /* offline — fall back to local switcher */ }
    const local = translatePhrase(query);
    if (local.ok && local.result !== query.toLowerCase()) {
      setQuery(local.result);
      setSubmitted(local.result);
    }
    setAiLoading(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button onClick={onBack} className={`inline-flex items-center gap-1.5 text-[11px] font-black ${th.textMuted} hover:${th.strongText} cursor-pointer`}>
          <ChevronLeft className="w-4 h-4" /> {t('Back')}
        </button>
        <div className={`text-xs font-black ${th.strongText}`}>{t('Search Products')}</div>
      </div>

      <div className={`${th.card} ${th.cardBorder} rounded-2xl p-4`}>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${th.textDim}`} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit(); }}
              placeholder={t('Tafuta bidhaa au kampuni… e.g. viatu, kitenge, simu')}
              className={th.input + ' pl-9'}
            />
          </div>
          <button
            onClick={voice.supported ? voice.start : undefined}
            title={t('Tafta kwa sauti')}
            className={`px-3 py-2.5 text-[11px] font-black rounded-xl border ${th.cardBorder} ${voice.listening ? 'bg-red-100 text-red-600 animate-pulse' : th.textMuted} hover:brightness-110 cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-40`}
          >
            <Mic className="w-3.5 h-3.5" /> {voice.listening ? t('Sikiliza…') : t('Sauti')}
          </button>
          <button
            onClick={submit}
            className={`px-4 py-2.5 text-[11px] font-black rounded-xl ${th.btnPrimary} ${th.btnPrimaryText} cursor-pointer inline-flex items-center gap-1.5`}
          >
            <Search className="w-3.5 h-3.5" /> {t('Search')}
          </button>
        </div>

        {voiceTranscript && (
          <div className={`mt-2.5 flex items-center gap-2 px-3 py-2 rounded-xl ${th.cardBorder} ${th.textMuted} text-[11px] font-semibold`}>
            <Mic className="w-3.5 h-3.5 text-emerald-500" />
            <span>{t('Ulisema')}: “{voiceTranscript}” — {t('nimekutafutia maneno yanayofanana.')}</span>
          </div>
        )}

        {voice.supported && voice.error && (
          <div className="mt-2.5 px-3 py-2 rounded-xl bg-red-50 text-red-600 text-[11px] font-semibold">{voice.error}</div>
        )}

        {expandedTerms.length > 1 && (
          <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
            <span className={`text-[10px] font-bold ${th.textDim}`}>{t('Inaonekana unatafuta')}:</span>
            {expandedTerms.map(term => (
              <button
                key={term}
                onClick={() => { setQuery(term); setSubmitted(term); }}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${th.cardBorder} ${th.textMuted} hover:brightness-110 cursor-pointer`}
              >
                {term}
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
          <div>
            <label className={`text-[10px] font-black uppercase tracking-wider ${th.textDim} block mb-1`}>{t('Region')}</label>
            <select value={region} onChange={e => setRegion(e.target.value)} className={th.input + ' cursor-pointer'}>
              <option value="All">{t('Region zote')}</option>
              {regionList.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className={`text-[10px] font-black uppercase tracking-wider ${th.textDim} block mb-1`}>{t('Price')}</label>
            <select value={priceRange} onChange={e => setPriceRange(e.target.value as any)} className={th.input + ' cursor-pointer'}>
              <option value="all">{t('Bei zote')}</option>
              <option value="low">{t('Under TZS 100k')}</option>
              <option value="mid">{t('TZS 100k – 500k')}</option>
              <option value="high">{t('Over TZS 500k')}</option>
            </select>
          </div>
          <div>
            <label className={`text-[10px] font-black uppercase tracking-wider ${th.textDim} block mb-1`}>{t('Rating')}</label>
            <select value={minRating} onChange={e => setMinRating(Number(e.target.value))} className={th.input + ' cursor-pointer'}>
              {RATING_OPTIONS.map(o => <option key={o.value} value={o.value}>{t(o.label)}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={runAiSwitch}
              disabled={aiLoading || !query.trim()}
              className={`px-3 py-2.5 text-[11px] font-black rounded-xl border ${th.cardBorder} ${th.textMuted} hover:brightness-110 cursor-pointer disabled:opacity-40 inline-flex items-center gap-1.5`}
              title={t('Switch Kiswahili phrase to English search')}
            >
              <Sparkles className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : ''}`} /> {t('AI Phrase')}
            </button>
            {(submitted || region !== 'All' || priceRange !== 'all' || minRating > 0) && (
              <button onClick={clearAll} className={`px-3 py-2.5 text-[11px] font-black rounded-xl border ${th.cardBorder} ${th.textMuted} hover:brightness-110 cursor-pointer inline-flex items-center gap-1.5`}>
                <X className="w-3.5 h-3.5" /> {t('Clear')}
              </button>
            )}
          </div>
        </div>
      </div>

      {submitted.trim() && (
        <div className={`flex items-center justify-between gap-3 ${th.textMuted} text-[11px] font-semibold`}>
          <span>
            {matched.length} {matched.length === 1 ? t('result') : t('results')} {t('for')} “{submitted}”
          </span>
          <SlidersHorizontal className="w-3.5 h-3.5" />
        </div>
      )}

      {matched.length === 0 ? (
        <div className={`${th.card} ${th.cardBorder} rounded-2xl p-10 text-center`}>
          <Search className={`w-8 h-8 mx-auto mb-2 ${th.textDim}`} />
          <div className={`text-sm font-black ${th.strongText}`}>{t('Hakuna bidhaa zilizopatikana')}</div>
          <div className={`text-[11px] ${th.textMuted} font-semibold mt-1`}>
            {t('Try a different keyword, clear filters, or browse all products.')}
          </div>
          {submitted.trim() && (
            <button onClick={clearAll} className={`mt-4 px-4 py-2 text-[11px] font-black rounded-xl ${th.btnPrimary} ${th.btnPrimaryText} cursor-pointer`}>
              {t('Show all products')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {matched.map(p => (
            <React.Fragment key={p.id}>
            <ProductCard
              product={p}
              theme={theme}
              t={t}
              compact
              companyName={companyNameFor(p.companyId)}
              onOpen={() => onOpenProduct(p)}
              onAddToCart={() => onAddToCart(p)}
            />
            </React.Fragment>
          ))}
        </div>
      )}

      {matched.length === 0 && !submitted.trim() && (
        <div className={`${th.card} ${th.cardBorder} rounded-2xl p-10 text-center`}>
          <MapPin className={`w-8 h-8 mx-auto mb-2 ${th.textDim}`} />
          <div className={`text-sm font-black ${th.strongText}`}>{t('Search the whole marketplace')}</div>
          <div className={`text-[11px] ${th.textMuted} font-semibold mt-1`}>
            {t('Type a product name in Kiswahili or English, e.g. viatu, kitenge, simu, nguo.')}
          </div>
        </div>
      )}
    </div>
  );
}
