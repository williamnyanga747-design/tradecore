// =============================================================
// MEGA ULTIMATE — TAFTA KWA SAUTI: reusable voice mic button.
// Hands-free voice search in Swahili (sw-TZ) or English (en-US).
// =============================================================
import React, { useState } from 'react';
import { Mic, MicOff, Loader2, Globe, Volume2, X, Search, Sparkles } from 'lucide-react';
import { useVoiceSearch, isSpeechRecognitionSupported } from '../../utils/voiceSearch';
import { getPublicTheme, PublicTheme } from '../../utils/publicTheme';
import { TFunc } from './MarketplaceShared';

interface VoiceMicButtonProps {
  theme: PublicTheme;
  t: TFunc;
  compact?: boolean;
  language?: 'sw' | 'en' | string;
  onVoiceResult: (transcript: string, query: string) => void;
}

export default function VoiceMicButton({ theme, t, compact, language = 'sw', onVoiceResult }: VoiceMicButtonProps) {
  const th = getPublicTheme(theme);
  const [voiceLang, setVoiceLang] = useState<'sw-TZ' | 'en-US'>(language === 'en' ? 'en-US' : 'sw-TZ');
  const [showFallbackModal, setShowFallbackModal] = useState(false);
  const [dictationText, setDictationText] = useState('');

  const { supported, listening, error, start, stop } = useVoiceSearch({
    lang: voiceLang,
    onResult: (transcript, query) => {
      onVoiceResult(transcript, query);
      setShowFallbackModal(false);
    }
  });

  const handleMicClick = () => {
    if (listening) {
      stop();
    } else if (supported) {
      start();
    } else {
      setShowFallbackModal(true);
    }
  };

  const toggleLang = (e: React.MouseEvent) => {
    e.stopPropagation();
    setVoiceLang(prev => prev === 'sw-TZ' ? 'en-US' : 'sw-TZ');
  };

  const popularVoicePrompts = voiceLang === 'sw-TZ' ? [
    { text: 'Viatu vya kiume na kike', query: 'viatu' },
    { text: 'Simu za kisasa (Smartphones)', query: 'simu' },
    { text: 'Nguo za Kitenge', query: 'kitenge' },
    { text: 'Unga wa ngano na mahindi', query: 'unga' },
    { text: 'Vifaa vya umeme na TV', query: 'vifaa umeme' }
  ] : [
    { text: 'Men and women shoes', query: 'shoes' },
    { text: 'Smartphones & gadgets', query: 'phone' },
    { text: 'Traditional fabric & clothes', query: 'kitenge' },
    { text: 'Baking flour & grains', query: 'flour' },
    { text: 'Electronics and home appliances', query: 'electronics' }
  ];

  const base = compact
    ? 'h-8 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer select-none'
    : 'px-3 py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer flex items-center gap-1.5 select-none';

  const style = listening
    ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 animate-pulse ring-2 ring-rose-400'
    : 'bg-amber-400 text-amber-950 hover:bg-amber-300 shadow-sm hover:shadow active:scale-95';

  return (
    <>
      <div className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={handleMicClick}
          title={listening ? t('Listening... Click to stop') : `${t('Tafuta kwa Sauti')} (${voiceLang === 'sw-TZ' ? 'Kiswahili' : 'English'})`}
          className={`${base} ${style}`}
        >
          {listening ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mic className="w-3.5 h-3.5" />}
          {!compact && (
            <span>{listening ? t('Listening…') : (voiceLang === 'sw-TZ' ? 'Sauti' : 'Voice')}</span>
          )}
        </button>
        {!compact && (
          <button
            type="button"
            onClick={toggleLang}
            title={voiceLang === 'sw-TZ' ? 'Switch to English voice search' : 'Badili kwenda Kiswahili'}
            className="text-[9px] font-extrabold uppercase px-1.5 py-1 rounded bg-black/10 dark:bg-white/10 text-slate-700 dark:text-slate-200 hover:bg-black/20 transition cursor-pointer"
          >
            {voiceLang === 'sw-TZ' ? 'SW' : 'EN'}
          </button>
        )}
      </div>

      {/* Fallback Voice Search Dialog */}
      {showFallbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className={`w-full max-w-md ${th.card} border ${th.cardBorder} rounded-3xl p-6 shadow-2xl relative space-y-4`}>
            <button
              onClick={() => setShowFallbackModal(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-full cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-400/20 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                <Mic className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className={`text-base font-black ${th.strongText}`}>
                  {voiceLang === 'sw-TZ' ? 'Tafuta kwa Sauti' : 'Hands-Free Voice Search'}
                </h3>
                <p className={`text-xs ${th.textMuted}`}>
                  {voiceLang === 'sw-TZ' ? 'Ongea au chagua bidhaa unayotafuta' : 'Speak or choose what you want to find'}
                </p>
              </div>
            </div>

            {/* Language toggle in modal */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-gray-100 dark:bg-gray-800">
              <span className={`text-xs font-bold ${th.textMuted}`}>
                {t('Language')}:
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setVoiceLang('sw-TZ')}
                  className={`px-3 py-1 text-xs font-black rounded-lg transition cursor-pointer ${
                    voiceLang === 'sw-TZ' ? 'bg-amber-400 text-amber-950 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  🇹🇿 Kiswahili
                </button>
                <button
                  type="button"
                  onClick={() => setVoiceLang('en-US')}
                  className={`px-3 py-1 text-xs font-black rounded-lg transition cursor-pointer ${
                    voiceLang === 'en-US' ? 'bg-amber-400 text-amber-950 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  🇬🇧 English
                </button>
              </div>
            </div>

            {/* Dictation / input box */}
            <div className="space-y-2">
              <div className="relative">
                <input
                  type="text"
                  value={dictationText}
                  onChange={(e) => setDictationText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && dictationText.trim()) {
                      onVoiceResult(dictationText, dictationText.trim());
                      setShowFallbackModal(false);
                    }
                  }}
                  placeholder={voiceLang === 'sw-TZ' ? 'Sema au andika hapa... e.g. viatu' : 'Speak or type here... e.g. shoes'}
                  className={`w-full px-4 py-3 rounded-2xl border text-sm font-semibold outline-none ${th.input}`}
                  autoFocus
                />
                {dictationText && (
                  <button
                    onClick={() => {
                      onVoiceResult(dictationText, dictationText.trim());
                      setShowFallbackModal(false);
                    }}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs font-black rounded-xl ${th.btnPrimary} ${th.btnPrimaryText} cursor-pointer`}
                  >
                    {t('Search')}
                  </button>
                )}
              </div>
            </div>

            {/* Suggested Voice queries */}
            <div className="space-y-2">
              <div className={`text-[11px] font-black uppercase tracking-wider ${th.textMuted}`}>
                {voiceLang === 'sw-TZ' ? 'Mifano ya kutamka haraka:' : 'Quick voice query examples:'}
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {popularVoicePrompts.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      onVoiceResult(p.text, p.query);
                      setShowFallbackModal(false);
                    }}
                    className={`px-3 py-2 rounded-xl text-left text-xs font-bold border transition flex items-center justify-between cursor-pointer hover:border-amber-400 ${th.cardBorder} hover:bg-amber-500/10`}
                  >
                    <span className={th.strongText}>“{p.text}”</span>
                    <span className="text-[10px] text-brand font-black uppercase">{t('Tafuta')} →</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Silent indicator for browsers without SpeechRecognition. */
export function VoiceUnsupported({ theme, t }: { theme: PublicTheme; t: TFunc }) {
  const th = getPublicTheme(theme);
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold ${th.textMuted}`} title={t('Voice search needs Chrome / Edge on a compatible device.')}>
      <MicOff className="w-3 h-3" /> {t('Sauti haipatikani kwenye kivinjari hiki')}
    </span>
  );
}
