import React from 'react';

export type PublicTheme = 'milk' | 'dark';

export const GOLD = '#eab308';
export const GOLD_DEEP = '#ca8a04';

// Golden brand variables so `bg-brand` / `text-brand` / `ring-brand` resolve to gold
export const goldenBrandStyle = {
  '--brand-color': GOLD,
  '--brand-color-hover': GOLD_DEEP,
  '--brand-color-light': 'rgba(234, 179, 8, 0.15)'
} as React.CSSProperties;

export interface PublicThemeTokens {
  root: string;
  goldenLine: string;
  headerBg: string;
  headerBorder: string;
  border: string;
  card: string;
  cardBorder: string;
  textMuted: string;
  textDim: string;
  chip: string;
  chipBorder: string;
  chipText: string;
  input: string;
  label: string;
  btnPrimary: string;
  btnPrimaryText: string;
  btnSecondary: string;
  btnSecondaryText: string;
  heroBlobA: string;
  heroBlobB: string;
  statCard: string;
  statValue: string;
  missionCard: string;
  featureCard: string;
  footerBorder: string;
  footerText: string;
  brandText: string;
  strongText: string;
}

export function getPublicTheme(theme: PublicTheme): PublicThemeTokens {
  if (theme === 'milk') {
    return {
      root: 'bg-[#faf8f5] text-[#1f2937]',
      goldenLine: 'bg-gradient-to-r from-amber-200 via-yellow-500 to-amber-600',
      headerBg: 'bg-[#faf8f5]/85 backdrop-blur-md',
      headerBorder: 'border-b border-amber-300/60',
      border: 'border-gray-200',
      card: 'bg-white',
      cardBorder: 'border border-amber-200/80',
      textMuted: 'text-gray-600',
      textDim: 'text-gray-400',
      chip: 'bg-amber-100/70',
      chipBorder: 'border border-amber-300/70',
      chipText: 'text-amber-800',
      input: 'w-full px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-500 text-gray-800 font-medium placeholder:text-gray-400',
      label: 'text-gray-500',
      btnPrimary: 'bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-amber-400 hover:to-amber-600 shadow-lg shadow-amber-500/20',
      btnPrimaryText: 'text-[#1f2937]',
      btnSecondary: 'bg-white/80 hover:bg-amber-100 border border-amber-300/70',
      btnSecondaryText: 'text-[#1f2937]',
      heroBlobA: 'bg-amber-400/15',
      heroBlobB: 'bg-yellow-500/10',
      statCard: 'bg-white',
      statValue: 'text-amber-600',
      missionCard: 'bg-white',
      featureCard: 'bg-[#faf8f5]',
      footerBorder: 'border-t border-amber-200/70',
      footerText: 'text-gray-500',
      brandText: 'text-amber-600',
      strongText: 'text-gray-900'
    };
  }
  return {
    root: 'bg-[#070e20] text-white',
    goldenLine: 'bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-600',
    headerBg: 'bg-[#070e20]/80 backdrop-blur-md',
    headerBorder: 'border-b border-amber-400/30',
    border: 'border-white/10',
    card: 'bg-[#0d1832]',
    cardBorder: 'border border-amber-400/25',
    textMuted: 'text-gray-300',
    textDim: 'text-gray-400',
    chip: 'bg-amber-400/10',
    chipBorder: 'border border-amber-400/40',
    chipText: 'text-amber-300',
    input: 'w-full px-3 py-2 border border-white/10 rounded-lg text-xs bg-[#0d1832] outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400/60 text-white font-medium placeholder:text-gray-500',
    label: 'text-gray-400',
    btnPrimary: 'bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-amber-400 hover:to-amber-600 shadow-lg shadow-amber-500/20',
    btnPrimaryText: 'text-[#1f2937]',
    btnSecondary: 'bg-white/10 hover:bg-white/20 border border-amber-400/30',
    btnSecondaryText: 'text-white',
    heroBlobA: 'bg-amber-400/10',
    heroBlobB: 'bg-yellow-500/10',
    statCard: 'bg-white/5',
    statValue: 'text-amber-400',
    missionCard: 'bg-[#0d1832]',
    featureCard: 'bg-white/5',
    footerBorder: 'border-t border-white/10',
    footerText: 'text-gray-400',
    brandText: 'text-amber-400',
    strongText: 'text-white'
  };
}

interface ThemeToggleProps {
  theme: PublicTheme;
  onToggle: () => void;
  className?: string;
}

// Theme switcher shown in public page header navigation bars
export function PublicThemeToggle({ theme, onToggle, className = '' }: ThemeToggleProps) {
  const milk = theme === 'milk';
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg transition cursor-pointer ${
        milk
          ? 'bg-[#070e20] hover:bg-[#101b3d] text-white border border-amber-400/40'
          : 'bg-white/10 hover:bg-white/20 text-white border border-amber-400/40'
      } ${className}`}
      title={milk ? 'Switch to Dark Gold theme' : 'Switch to Milk theme'}
    >
      {milk ? (
        <>
          <span aria-hidden>🌌</span> Dark Gold
        </>
      ) : (
        <>
          <span aria-hidden>🥛</span> Milk Theme
        </>
      )}
    </button>
  );
}

// Thin golden line placed at the very top of every public page for consistency
export function GoldenTopLine({ theme }: { theme: PublicTheme }) {
  const t = getPublicTheme(theme);
  return <div className={`h-1 w-full ${t.goldenLine}`} />;
}
