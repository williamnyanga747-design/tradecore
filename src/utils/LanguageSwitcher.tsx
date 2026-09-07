import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Languages } from 'lucide-react';
import { LANGUAGES, LangCode } from './i18n';

interface Props {
  language: LangCode;
  onChange: (lang: LangCode) => void;
  dark?: boolean;
  className?: string;
}

export default function LanguageSwitcher({ language, onChange, dark = false, className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Select language"
        className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black rounded-lg transition cursor-pointer border ${
          dark ? 'border-white/15 bg-white/5 text-gray-200 hover:bg-white/10' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
        }`}
      >
        <Languages className="w-3.5 h-3.5" />
        {active.flag} {active.code.toUpperCase()}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className={`absolute right-0 top-full mt-1.5 w-44 rounded-xl border shadow-xl z-50 overflow-hidden ${dark ? 'border-white/15 bg-[#232836]' : 'border-gray-200 bg-white'}`}>
          <div className="max-h-56 overflow-y-auto scrollbar-thin">
            {LANGUAGES.map(l => {
              const isActive = language === l.code;
              return (
                <button
                  key={l.code}
                  onClick={() => { onChange(l.code); setOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-[11px] font-black text-left transition cursor-pointer ${
                    isActive
                      ? dark ? 'bg-amber-500/15 text-amber-300' : 'bg-brand/10 text-brand'
                      : dark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-sm leading-none">{l.flag}</span>
                  <span className="flex-1">{l.label}</span>
                  <span className={`text-[9px] font-bold uppercase opacity-70 ${dark ? 'text-gray-400' : 'text-gray-400'}`}>{l.code}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
