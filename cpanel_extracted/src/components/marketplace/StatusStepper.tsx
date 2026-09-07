import React from 'react';
import { MarketplaceOrderStatus } from '../../types';
import { TFunc } from './MarketplaceShared';

const STEPS: Array<{ key: MarketplaceOrderStatus; label: string; desc: string; color: string }> = [
  { key: 'pending_verification', label: 'Inasubiri Uhakiki', desc: 'Risiti yako inahakikiwa na staff', color: 'bg-amber-500' },
  { key: 'verified', label: 'Verified / Approved', desc: 'Malipo Yamekubaliwa! ✅', color: 'bg-emerald-500' },
  { key: 'processing', label: 'Processing', desc: 'Bidhaa inaandaliwa', color: 'bg-blue-500' },
  { key: 'out_for_delivery', label: 'Out for Delivery', desc: 'Bidhaa iko njiani kukujia', color: 'bg-purple-500' },
  { key: 'delivered', label: 'Delivered', desc: 'Imeshafikishwa — Ahsante!', color: 'bg-emerald-500' }
];

const STATUS_INDEX: Record<MarketplaceOrderStatus, number> = {
  pending_verification: 0,
  verified: 1,
  processing: 2,
  out_for_delivery: 3,
  delivered: 4,
  rejected: -1
};

export default function StatusStepper({ status, rejectionReason, t }: { status: MarketplaceOrderStatus; rejectionReason?: string; t?: TFunc }) {
  const tr = t || ((s: string) => s);
  const activeIdx = STATUS_INDEX[status];

  if (status === 'rejected') {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4">
        <div className="text-xs font-black text-red-400 uppercase tracking-wider">{tr('Rejected')}</div>
        <div className="text-sm font-bold text-white mt-1">{tr('Haikukubaliwa')}</div>
        {rejectionReason && (
          <div className="text-[11px] text-red-200 font-semibold mt-1">{tr('Sababu')}: {rejectionReason}</div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        {STEPS.map((s, i) => {
          const isActive = i <= activeIdx;
          const isCurrent = i === activeIdx;
          return (
            <React.Fragment key={s.key}>
              <div className="flex flex-col items-center flex-1 min-w-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black border-2 shrink-0 ${
                  isCurrent
                    ? `${s.color} text-white border-white/30 shadow-lg`
                    : isActive
                      ? `${s.color} text-white border-transparent`
                      : 'bg-white/10 border-white/20 text-gray-400'
                }`}>
                  {isActive ? '✓' : i + 1}
                </div>
                <div className={`text-[8px] font-black uppercase tracking-wide mt-1.5 text-center ${isActive ? 'text-white' : 'text-gray-500'}`}>
                  {tr(s.label)}
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 mb-5 ${i < activeIdx ? 'bg-emerald-500' : 'bg-white/10'}`}></div>
              )}
            </React.Fragment>
          );
        })}
      </div>
      <div className="text-center">
        <div className="text-sm font-black text-white">{tr(STEPS[activeIdx].label)}</div>
        <div className="text-[11px] text-gray-400 font-semibold mt-0.5">{tr(STEPS[activeIdx].desc)}</div>
      </div>
    </div>
  );
}
