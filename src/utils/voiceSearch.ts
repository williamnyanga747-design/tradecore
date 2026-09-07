// =============================================================
// MEGA ULTIMATE — TAFTA KWA SAUTI (Swahili voice search)
// Web Speech API (sw-TZ) + Swahili stopword/keyword extraction.
// =============================================================
import { useCallback, useEffect, useRef, useState } from 'react';

/** Common Swahili filler/connector words removed before matching products. */
export const SWAHILI_STOPWORDS = [
  'ni', 'na', 'ya', 'wa', 'za', 'cha', 'vya', 'kwa', 'katika', 'kwenye', 'hii', 'hicho', 'hizi', 'hizo',
  'ile', 'yule', 'wale', 'nataka', 'naomba', 'natafuta', 'nitafute', 'tafuta', 'ninahitaji', 'nauza',
  'kama', 'au', 'la', 'li', 'lo', 'vile', 'ambao', 'ambayo', 'ambazo', 'yote', 'wote', 'kipande',
  'kitu', 'sasa', 'leo', 'bado', 'tu', 'jinsi', 'mimi', 'wewe', 'kwani', 'basi', 'si', 'sijui', 'hivi'
];

const STRIP_RE = /[.,!?;:"'()\[\]{}<>@#$%^&*+=|\\/~`]/g;

/** Normalise a voice transcript into a compact search query (stopwords removed). */
export function extractSwahiliKeywords(transcript: string): string {
  return transcript
    .toLowerCase()
    .replace(STRIP_RE, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2)
    .filter(w => !SWAHILI_STOPWORDS.includes(w))
    .join(' ');
}

/** Quick keyword set match for banner suggestions (e.g. "kiatu", "simu", "nguo"). */
export function matchSuggestion(transcript: string, keywords: string[]): string | null {
  const q = extractSwahiliKeywords(transcript);
  if (!q) return null;
  const words = q.split(' ');
  const found = keywords.find(k => words.includes(k) || q.includes(k));
  return found || null;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: { length: number; [i: number]: { isFinal: boolean; [j: number]: { transcript: string } } } }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  const ctor = w.SpeechRecognition || (w as Record<string, unknown>).webkitSpeechRecognition;
  return ctor ? (ctor as unknown as new () => SpeechRecognitionLike) : null;
}

/** Speech API availability (Chrome/Edge/Android only; Firefox needs Webkit prefix). */
export function isSpeechRecognitionSupported(): boolean {
  return !!getRecognitionCtor();
}

export interface UseVoiceSearchOptions {
  onResult: (transcript: string, query: string) => void;
  onListeningChange?: (listening: boolean) => void;
  lang?: string;
}

/** Voice-recognition hook with Swahili (sw-TZ) default and graceful fallbacks. */
export function useVoiceSearch({ onResult, onListeningChange, lang = 'sw-TZ' }: UseVoiceSearchOptions) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const onResultRef = useRef(onResult);
  const onListeningRef = useRef(onListeningChange);

  useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  useEffect(() => { onListeningRef.current = onListeningChange; }, [onListeningChange]);

  useEffect(() => {
    setSupported(!!getRecognitionCtor());
    return () => { try { recRef.current?.abort(); } catch (e) {} };
  }, []);

  const start = useCallback(() => {
    const ctor = getRecognitionCtor();
    if (!ctor) { setError('voice-unsupported'); return; }
    try {
      recRef.current?.abort();
      const rec = new ctor();
      rec.lang = lang;
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.onstart = () => { setListening(true); setError(''); onListeningRef.current?.(true); };
      rec.onerror = (e) => { setError(e?.error || 'voice-error'); setListening(false); onListeningRef.current?.(false); };
      rec.onresult = (event) => {
        let final = '';
        let interim = '';
        for (let i = 0; i < event.results.length; i++) {
          const item = event.results[i];
          if (item.isFinal) final += item[0].transcript;
          else interim += item[0].transcript;
        }
        const text = (final || interim).trim();
        if (text) {
          onResultRef.current(text, extractSwahiliKeywords(text));
        }
      };
      rec.onend = () => { setListening(false); onListeningRef.current?.(false); };
      recRef.current = rec;
      rec.start();
    } catch (err) {
      setError('voice-error');
      setListening(false);
    }
  }, [lang]);

  const stop = useCallback(() => {
    try { recRef.current?.stop(); } catch (e) {}
    setListening(false);
  }, []);

  return { supported, listening, error, start, stop };
}
