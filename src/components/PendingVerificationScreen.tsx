import React from 'react';
import {
  ShieldCheck, Clock, User, Building2, CreditCard, Hash, LayoutGrid,
  CheckCircle2, ArrowRight, ReceiptText, Fingerprint, ScanLine
} from 'lucide-react';
import { PublicTheme, GoldenTopLine, PublicThemeToggle } from '../utils/publicTheme';

export interface PendingVerificationData {
  companyName: string;
  userFullName: string;
  username: string;
  planName: string;
  amountFormatted: string;
  paymentChannel: string;
  paymentRef: string;
  status: string;
}

interface PendingVerificationScreenProps {
  submissionData: PendingVerificationData;
  translate: (text: string) => string;
  theme?: PublicTheme;
  onToggleTheme?: () => void;
  onProceedToLogin?: () => void;
}

const dashes = (v: string | undefined | null) => (v && v.trim() ? v : '—');

export default function PendingVerificationScreen({
  submissionData: d,
  translate: t,
  theme = 'dark',
  onToggleTheme,
  onProceedToLogin
}: PendingVerificationScreenProps) {
  const milk = theme === 'milk';

  return (
    <div
      className={`relative min-h-screen w-full flex items-center justify-center p-4 overflow-hidden ${milk ? 'bg-[#faf8f5] text-[#1f2937]' : 'bg-[#0b0e14] text-white'}`}
      style={{
        backgroundImage: milk
          ? 'linear-gradient(rgba(212,160,23,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(212,160,23,0.05) 1px, transparent 1px), radial-gradient(ellipse at 20% 10%, rgba(212,160,23,0.12), transparent 50%), radial-gradient(ellipse at 85% 90%, rgba(13,148,136,0.10), transparent 50%)'
          : 'linear-gradient(rgba(56,189,248,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.06) 1px, transparent 1px), radial-gradient(ellipse at 20% 10%, rgba(245,158,11,0.14), transparent 50%), radial-gradient(ellipse at 85% 90%, rgba(45,212,191,0.14), transparent 50%)',
        backgroundSize: '42px 42px, 42px 42px, 100% 100%, 100% 100%'
      }}
    >
      <div className={`absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-transparent ${milk ? 'to-[#faf8f5]' : 'to-[#0b0e14]'}`} />
      <div className="absolute top-0 left-0 right-0"><GoldenTopLine theme={theme} /></div>
      {onToggleTheme && (
        <div className="absolute top-4 right-4 z-20">
          <PublicThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      )}

      <div className="relative w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-2">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shadow-lg ${milk ? 'bg-white border border-amber-300/60 shadow-amber-500/10' : 'bg-[#0f172a] border border-cyan-400/30 shadow-cyan-500/10'}`}>
              <Fingerprint className={`w-5 h-5 ${milk ? 'text-amber-600' : 'text-cyan-400'}`} />
            </div>
            <div>
              <div className={`text-xs font-black tracking-widest uppercase ${milk ? 'text-[#1f2937]' : 'text-white'}`}>TradeCore</div>
              <div className={`text-[9px] font-bold uppercase tracking-wider ${milk ? 'text-gray-500' : 'text-gray-500'}`}>Verification Portal</div>
            </div>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${milk ? 'bg-amber-100/70 border border-amber-300/70' : 'bg-amber-500/10 border border-amber-400/40'}`}>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
            </span>
            <span className={`text-[9px] font-black uppercase tracking-wider ${milk ? 'text-amber-700' : 'text-amber-300'}`}>{dashes(d.status)}</span>
          </div>
        </div>

        {/* Main Card */}
        <div className={`rounded-2xl backdrop-blur shadow-2xl overflow-hidden ${milk ? 'bg-white border border-amber-200/80 shadow-amber-500/10' : 'bg-[#111827]/90 border border-white/10 shadow-black/50'}`}>
          {/* Card top bar */}
          <div className="h-1 bg-gradient-to-r from-amber-400 via-amber-300 to-teal-400" />

          <div className="p-6 sm:p-7">
            {/* Title */}
            <div className="flex items-start gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${milk ? 'bg-amber-100/80 border border-amber-300/60' : 'bg-amber-500/10 border border-amber-400/30'}`}>
                <Clock className={`w-6 h-6 ${milk ? 'text-amber-600' : 'text-amber-400'}`} />
              </div>
              <div>
                <h2 className={`text-lg font-black tracking-tight uppercase ${milk ? 'text-[#1f2937]' : 'text-white'}`}>
                  {t('Payment Pending Verification')}
                </h2>
                <p className={`text-[11px] font-semibold mt-0.5 leading-relaxed ${milk ? 'text-gray-500' : 'text-gray-400'}`}>
                  {t('Your registration has been received. A Super Admin must manually verify your payment before your subscription is activated.')}
                </p>
              </div>
            </div>

            {/* Super Admin status badge */}
            <div className={`mt-5 rounded-xl border p-3 flex items-center gap-3 ${milk ? 'border-amber-300/70 bg-gradient-to-r from-amber-100/80 to-amber-50' : 'border-amber-400/30 bg-gradient-to-r from-amber-500/10 to-amber-500/5'}`}>
              <ShieldCheck className={`w-8 h-8 shrink-0 ${milk ? 'text-amber-600' : 'text-amber-400'}`} />
              <div className="flex-1">
                <div className={`text-[9px] font-black uppercase tracking-widest ${milk ? 'text-amber-700' : 'text-amber-300'}`}>
                  {t('Super Admin Status')}
                </div>
                <div className={`text-xs font-black mt-0.5 ${milk ? 'text-[#1f2937]' : 'text-white'}`}>{dashes(d.status)}</div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${milk ? 'bg-amber-100 border border-amber-300/80 text-amber-800' : 'bg-amber-400/15 border border-amber-400/40 text-amber-300'}`}>
                {t('In Review')}
              </span>
            </div>

            {/* Submission details */}
            <div className="mt-5 space-y-2">
              <FieldRow
                milk={milk}
                icon={<Building2 className={`w-4 h-4 ${milk ? 'text-gray-400' : 'text-gray-400'}`} />}
                label={t('Company')}
                value={dashes(d.companyName)}
              />
              <FieldRow
                milk={milk}
                icon={<User className="w-4 h-4 text-gray-400" />}
                label={t('Applicant')}
                value={dashes(d.userFullName)}
              />
              <FieldRow
                milk={milk}
                icon={<Fingerprint className="w-4 h-4 text-gray-400" />}
                label={t('Username')}
                value={dashes(d.username)}
                mono
              />
              <FieldRow
                milk={milk}
                icon={<LayoutGrid className="w-4 h-4 text-gray-400" />}
                label={t('Subscription Plan')}
                value={dashes(d.planName)}
                highlight
              />
              <FieldRow
                milk={milk}
                icon={<ReceiptText className="w-4 h-4 text-gray-400" />}
                label={t('Amount')}
                value={dashes(d.amountFormatted)}
                highlight
                strong
              />
              <FieldRow
                milk={milk}
                icon={<CreditCard className="w-4 h-4 text-gray-400" />}
                label={t('Payment Channel')}
                value={dashes(d.paymentChannel)}
              />
              <FieldRow
                milk={milk}
                icon={<Hash className={`w-4 h-4 ${milk ? 'text-teal-600' : 'text-teal-400'}`} />}
                label={t('Transaction Reference')}
                value={dashes(d.paymentRef)}
                mono
                refHighlight
                selectable
              />
            </div>

            {/* What happens next */}
            <div className={`mt-5 rounded-xl border p-3.5 flex items-start gap-2.5 ${milk ? 'border-teal-600/30 bg-teal-500/5' : 'border-cyan-400/20 bg-cyan-400/5'}`}>
              <ScanLine className={`w-4 h-4 mt-0.5 shrink-0 ${milk ? 'text-teal-700' : 'text-cyan-400'}`} />
              <p className={`text-[10px] font-semibold leading-relaxed ${milk ? 'text-gray-600' : 'text-gray-300'}`}>
                {t('Keep this reference number handy. Once the Super Admin confirms your payment, your account unlocks and you can sign in with the password you set during registration.')}
              </p>
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
              <button
                onClick={onProceedToLogin}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-[#0b0e14] text-[11px] font-black uppercase tracking-wider transition shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                {t('Proceed to Sign In')}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Footer note */}
            <div className={`mt-5 pt-4 flex items-center justify-center gap-1.5 ${milk ? 'border-t border-amber-200/70' : 'border-t border-white/10'}`}>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span className={`text-[9px] font-bold uppercase tracking-wider ${milk ? 'text-gray-500' : 'text-gray-500'}`}>
                {t('Secure submission — encrypted & logged')}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom strip */}
        <div className="mt-4 flex items-center justify-between px-1">
          <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">TradeCore build 2026-08-04-1</span>
          <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Enterprise Commerce ERP</span>
        </div>
      </div>
    </div>
  );
}

function FieldRow({
  milk, icon, label, value, mono, highlight, strong, refHighlight, selectable
}: {
  milk: boolean;
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
  strong?: boolean;
  refHighlight?: boolean;
  selectable?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${milk ? 'bg-amber-50/60 border-amber-200/70' : 'bg-black/30 border-white/5'}`}>
      <div className="shrink-0 w-5 flex justify-center">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className={`text-[8px] font-black uppercase tracking-widest ${milk ? 'text-gray-400' : 'text-gray-500'}`}>{label}</div>
        <div
          className={`mt-0.5 truncate ${
            refHighlight
              ? milk ? 'text-teal-700 font-black' : 'text-cyan-400 font-black'
              : highlight
                ? milk ? 'text-amber-700 font-black' : 'text-amber-300 font-black'
                : mono
                  ? milk ? 'text-gray-700 font-bold' : 'text-gray-200 font-bold'
                  : milk ? 'text-gray-800 font-bold' : 'text-white font-bold'
          } ${strong ? 'text-sm' : 'text-xs'} ${mono ? 'font-mono' : ''} ${selectable ? 'select-all cursor-text' : ''}`}
        >
          {value}
        </div>
      </div>
    </div>
  );
}
