import React, { useMemo, useRef, useState } from 'react';
import { Camera, X, Upload, Link2, Loader2, Search, Sparkles } from 'lucide-react';
import { Company, MarketplaceProduct, VisualSearchRecord } from '../../types';
import { getPublicTheme, PublicTheme } from '../../utils/publicTheme';
import { TZS, TFunc } from './MarketplaceShared';
import { DominantColor, extractDominantColors, colorSimilarity } from '../../utils/megaHelpers';

interface Props {
  theme: PublicTheme;
  t: TFunc;
  open: boolean;
  products: MarketplaceProduct[];
  companies: Company[];
  onClose: () => void;
  onOpenProduct: (product: MarketplaceProduct) => void;
  onLogSearch?: (record: Omit<VisualSearchRecord, 'id' | 'createdAt'>) => void;
}

interface VisualResult {
  product: MarketplaceProduct;
  score: number; // 0-100 similarity
}

const COLOR_KEYWORDS: Record<string, string[]> = {
  black: ['black', 'nyeusi'],
  white: ['white', 'nyeupe'],
  gray: ['gray', 'grey', 'kijivu'],
  red: ['red', 'nyekundu'],
  orange: ['orange', 'machungwa'],
  yellow: ['yellow', 'njano'],
  green: ['green', 'kijani'],
  blue: ['blue', 'bluu'],
  purple: ['purple', 'zambarau'],
  pink: ['pink', 'pinki', 'waridi'],
  brown: ['brown', 'kahawia'],
  beige: ['beige', 'cream', 'mweupe']
};

/**
 * MEGA BUILD F3 — Visual search: "Piga Picha · Tafta Bidhaa".
 * MVP: dominant-color extraction on canvas + color/keyword matching against
 * product images and text. No external API required.
 */
export default function MegaVisualSearch({ theme, t, open, products, companies, onClose, onOpenProduct, onLogSearch }: Props) {
  const th = getPublicTheme(theme);
  const [preview, setPreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [colors, setColors] = useState<DominantColor[]>([]);
  const [results, setResults] = useState<VisualResult[] | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);

  // cache of product image dominant colors for this session
  const colorCache = useMemo(() => new Map<number, DominantColor[]>(), []);

  if (!open) return null;

  const reset = () => {
    setPreview(null); setColors([]); setResults(null); setUrlInput(''); setShowUrlInput(false);
  };

  const analyze = async (src: string) => {
    setPreview(src);
    setResults(null);
    setAnalyzing(true);
    let dominant: DominantColor[] = [];
    try { dominant = await extractDominantColors(src, 3); } catch (e) { /* keep empty */ }
    setColors(dominant);

    // Build keyword set from detected colors (en + sw)
    const keywords = new Set<string>();
    dominant.forEach(c => {
      (COLOR_KEYWORDS[c.name] || []).forEach(k => keywords.add(k));
      keywords.add(c.nameSw);
    });

    // Score every visible product
    const scored: VisualResult[] = [];
    for (const p of products) {
      let score = 0;
      // text match: name/description/category contains a color keyword
      const haystack = `${p.name} ${p.description || ''} ${p.category || ''}`.toLowerCase();
      let textHits = 0;
      keywords.forEach(k => { if (haystack.includes(k)) textHits++; });
      if (textHits > 0) score += Math.min(40, 20 * textHits);

      // image match: compare dominant colors
      if (dominant.length > 0 && p.image) {
        try {
          let pc = colorCache.get(p.id);
          if (!pc) {
            pc = await extractDominantColors(p.image, 2).catch(() => []);
            colorCache.set(p.id, pc);
          }
          if (pc.length > 0) {
            let best = 0;
            for (const dc of dominant) {
              for (const pcol of pc) {
                best = Math.max(best, colorSimilarity(dc.rgb, pcol.rgb));
              }
            }
            score += Math.round(best * 0.6);
          }
        } catch (e) { /* image failed — skip */ }
      }

      if (score >= 35) scored.push({ product: p, score: Math.min(98, score) });
    }
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 24);
    setResults(top);
    setAnalyzing(false);
    onLogSearch?.({
      imagePath: src.length > 200_000 ? src : src, // data URL thumbnail
      detectedColors: dominant.map(c => c.hex),
      detectedColorNames: dominant.map(c => c.name),
      resultsCount: top.length
    });
  };

  const onFile = (file: File | null) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') void analyze(reader.result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`w-full max-w-3xl max-h-[88vh] overflow-y-auto ${th.card} ${th.cardBorder} rounded-3xl p-5 space-y-4`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className={`text-base font-black flex items-center gap-2 ${th.strongText}`}>
            <Camera className="w-5 h-5 text-amber-500" /> {t('Piga Picha · Tafta Bidhaa')}
          </h2>
          <button onClick={onClose} className={`p-1.5 rounded-lg cursor-pointer ${th.btnSecondary} ${th.btnSecondaryText}`}><X className="w-4 h-4" /></button>
        </div>

        {!preview ? (
          <>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); onFile(e.dataTransfer.files?.[0] || null); }}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition ${dragOver ? 'border-amber-500 bg-amber-500/10' : th.cardBorder}`}
            >
              <Upload className={`w-10 h-10 mx-auto mb-3 ${th.textDim}`} />
              <div className={`text-sm font-black ${th.strongText}`}>{t('Buruta picha hapa au bofya kupakia')}</div>
              <div className={`text-[11px] ${th.textMuted} font-semibold mt-1`}>{t('Piga picha ya bidhaa — tutatafuta zinazofanana.')}</div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onFile(e.target.files?.[0] || null); e.currentTarget.value = ''; }} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { onFile(e.target.files?.[0] || null); e.currentTarget.value = ''; }} />

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => cameraRef.current?.click()} className={`flex items-center justify-center gap-2 px-4 py-3 text-[11px] font-black rounded-xl cursor-pointer ${th.btnSecondary} ${th.btnSecondaryText}`}>
                <Camera className="w-4 h-4" /> {t('Piga Picha Sasa')}
              </button>
              <button onClick={() => setShowUrlInput(v => !v)} className={`flex items-center justify-center gap-2 px-4 py-3 text-[11px] font-black rounded-xl cursor-pointer ${th.btnSecondary} ${th.btnSecondaryText}`}>
                <Link2 className="w-4 h-4" /> {t('Weka URL ya Picha')}
              </button>
            </div>
            {showUrlInput && (
              <div className="flex gap-2">
                <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://..." className={th.input} />
                <button
                  onClick={() => urlInput.trim() && void analyze(urlInput.trim())}
                  disabled={!urlInput.trim()}
                  className={`px-4 py-2 text-[11px] font-black rounded-xl cursor-pointer disabled:opacity-40 ${th.btnPrimary} ${th.btnPrimaryText}`}
                >
                  {t('Tafuta')}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <img src={preview} alt="" className="w-24 h-24 rounded-xl object-cover border" style={{ borderColor: 'rgba(128,128,128,0.3)' }} />
              <div className="flex-1 min-w-0">
                {analyzing ? (
                  <div className="space-y-2">
                    <div className={`flex items-center gap-2 text-[12px] font-black ${th.strongText}`}>
                      <Loader2 className="w-4 h-4 animate-spin text-amber-500" /> {t('Inatafuta bidhaa zinazofanana...')}
                    </div>
                    <div className={`text-[10px] font-semibold ${th.textMuted}`}>{t('Tunachambua rangi na muundo wa picha yako')}</div>
                  </div>
                ) : (
                  <>
                    <div className={`text-[12px] font-black ${th.strongText}`}>
                      {results && results.length > 0
                        ? t('Matokeo ya picha') + `: ${t('Bidhaa')} ${results.length} ${t('zinazofanana zimepatikana')}`
                        : t('Hakuna inayofanana - Jaribu picha nyingine')}
                    </div>
                    {colors.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <span className={`text-[9px] font-bold uppercase ${th.textDim}`}>{t('Rangi zilizogundulika')}:</span>
                        {colors.map(c => (
                          <span key={c.hex} className={`inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full ${th.chip} ${th.chipText} ${th.chipBorder}`}>
                            <span className="w-2.5 h-2.5 rounded-full inline-block border border-white/30" style={{ background: c.hex }} />
                            {c.nameSw}
                          </span>
                        ))}
                      </div>
                    )}
                    <button onClick={reset} className={`mt-2 text-[10px] font-black underline cursor-pointer ${th.brandText}`}>{t('Badilisha picha')}</button>
                  </>
                )}
              </div>
            </div>

            {!analyzing && results && results.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {results.map(r => {
                  const company = companies.find(c => c.id === r.product.companyId);
                  return (
                    <button
                      key={r.product.id}
                      onClick={() => { onClose(); onOpenProduct(r.product); }}
                      className={`${th.card} ${th.cardBorder} rounded-2xl overflow-hidden text-left hover:brightness-105 transition cursor-pointer`}
                    >
                      <div className="relative aspect-square">
                        {r.product.image ? (
                          <img src={r.product.image} alt={r.product.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-yellow-400 to-amber-600 text-white text-lg font-black">
                            {(r.product?.name || '-').charAt(0)}
                          </div>
                        )}
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-black flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5" /> {r.score}% {t('inafanana')}
                        </span>
                      </div>
                      <div className="p-2.5">
                        <div className={`text-[11px] font-black truncate ${th.strongText}`}>{r.product.name}</div>
                        <div className={`text-[9px] font-semibold truncate ${th.textDim}`}>{company?.name}</div>
                        <div className={`text-[11px] font-black mt-0.5 ${th.brandText}`}>{TZS(r.product.price)}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {!analyzing && results && results.length === 0 && (
              <div className="text-center py-8">
                <Search className={`w-10 h-10 mx-auto mb-2 ${th.textDim}`} />
                <div className={`text-sm font-black ${th.strongText}`}>{t('Hakuna inayofanana - Jaribu picha nyingine')}</div>
                <div className={`text-[11px] ${th.textMuted} font-semibold mt-1`}>{t('Jaribu picha yenye mwanga mzuri na bidhaa iko wazi.')}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
