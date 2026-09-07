// =============================================================
// MEGA ULTIMATE — TAFTA KWA SAUTI: reusable voice mic button.
// Place in the marketplace header, hero search and map pages.
// =============================================================
import React from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { useVoiceSearch } from '../../utils/voiceSearch';
import { getPublicTheme, PublicTheme } from '../../utils/publicTheme';
import { TFunc } from './MarketplaceShared';

interface VoiceMicButtonProps {
  theme: PublicTheme;
  t: TFunc;
  compact?: boolean;
  onVoiceResult: (transcript: string, query: string) => void;
}

export default function VoiceMicButton({ theme, t, compact, onVoiceResult }: VoiceMicButtonProps) {
  const th = getPublicTheme(theme);
  const { supported, listening, start, stop } = useVoiceSearch({
    lang: 'sw-TZ',
    onResult: onVoiceResult
  });

  if (!supported) return null;

  const base = compact
    ? 'w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer'
    : 'px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1.5';

  const style = listening
    ? 'bg-red-500 text-white shadow-lg animate-pulse'
    : 'bg-amber-400 text-amber-950 hover:bg-amber-300';

  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      title={listening ? t('Stop listening') : t('Tafuta kwa Sauti (Kiswahili)')}
      className={`${base} ${style}`}
    >
      {listening ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mic className="w-3.5 h-3.5" />}
      {!compact && <span>{listening ? t('Sikiliza...') : t('Sauti')}</span>}
    </button>
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
