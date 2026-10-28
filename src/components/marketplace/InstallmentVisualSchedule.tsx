import React, { useState } from 'react';
import {
  Calendar, CheckCircle2, Clock, AlertCircle, CalendarClock,
  ArrowRight, ShieldCheck, Download, Check, Sparkles, ChevronRight
} from 'lucide-react';
import { InstallmentOrder, InstallmentPayment } from '../../types';
import { PublicTheme, getPublicTheme } from '../../utils/publicTheme';
import { TZS, TFunc } from './MarketplaceShared';

export interface MilestoneItem {
  index: number; // 0 = Down payment, 1..N = Installments
  title: string;
  amount: number;
  dueDate: string;
  status: 'paid' | 'due_now' | 'upcoming';
  payment?: InstallmentPayment;
  daysDiff?: number; // positive = days until due, negative = overdue, 0 = due today
}

interface Props {
  order: InstallmentOrder;
  payments?: InstallmentPayment[];
  theme?: PublicTheme;
  t?: TFunc;
  onPayNow?: () => void;
  onRecordPayment?: (instNum: number, amount: number) => void;
  readOnly?: boolean;
}

export default function InstallmentVisualSchedule({
  order,
  payments = [],
  theme = 'milk',
  t = (s: string) => s,
  onPayNow,
  onRecordPayment,
  readOnly = false
}: Props) {
  const th = getPublicTheme(theme);
  const milk = theme === 'milk';
  const [selectedMilestone, setSelectedMilestone] = useState<number | null>(null);

  // Compute all milestone dates and statuses
  const milestones: MilestoneItem[] = [];

  // Down Payment (Milestone 0)
  const downPayment = payments.find(p => p.type === 'down');
  const isDownPaid = order.status !== 'pending_down' && (order.downPayment <= 0 || order.totalPaid >= order.downPayment || downPayment?.status === 'completed');

  milestones.push({
    index: 0,
    title: t('Malipo ya Awali (Down Payment)'),
    amount: order.downPayment,
    dueDate: order.createdAt,
    status: isDownPaid ? 'paid' : 'due_now',
    payment: downPayment
  });

  // Calculate base interval days (default 30 days)
  const intervalDays = 30;
  const orderCreated = new Date(order.createdAt).getTime();

  for (let i = 1; i <= order.installmentsCount; i++) {
    const isPaid = i <= order.paidInstallments;
    const isDueNow = !isPaid && (i === order.paidInstallments + 1);

    // Compute estimated or actual due date
    let dueDateStr: string;
    if (isDueNow && order.nextDueDate) {
      dueDateStr = order.nextDueDate;
    } else {
      const projectedMs = orderCreated + (i * intervalDays * 24 * 60 * 60 * 1000);
      dueDateStr = new Date(projectedMs).toISOString();
    }

    // Match payment record if completed
    const matchingPayment = payments.find(p =>
      p.type === 'installment' &&
      (p.reference?.endsWith(`-I${i}`) || p.reference?.endsWith(`-${i}`))
    );

    let daysDiff: number | undefined;
    if (!isPaid && dueDateStr) {
      const dueTime = new Date(dueDateStr).getTime();
      const now = Date.now();
      daysDiff = Math.round((dueTime - now) / (1000 * 60 * 60 * 24));
    }

    milestones.push({
      index: i,
      title: `${t('Awamu ya')} ${i}`,
      amount: order.installmentAmount,
      dueDate: dueDateStr,
      status: isPaid ? 'paid' : isDueNow ? 'due_now' : 'upcoming',
      payment: matchingPayment,
      daysDiff
    });
  }

  const completedCount = order.paidInstallments + (isDownPaid ? 1 : 0);
  const totalMilestones = order.installmentsCount + 1;
  const progressPercent = Math.min(100, Math.round((completedCount / totalMilestones) * 100));

  const currentDueMilestone = milestones.find(m => m.status === 'due_now');

  return (
    <div className={`${th.card} ${th.cardBorder} rounded-3xl p-5 md:p-6 space-y-6 shadow-sm`}>
      {/* Header and Summary Bar */}
      <div className="flex items-start justify-between gap-4 flex-wrap pb-4 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-sky-500/10 text-sky-600">
              <CalendarClock className="w-5 h-5" />
            </span>
            <div>
              <h3 className={`text-base font-black ${th.strongText}`}>
                {t('Ratiba ya Malipo ya Awamu (Lipa Pole Pole Schedule)')}
              </h3>
              <p className={`text-xs ${th.textMuted} font-semibold mt-0.5`}>
                {t('Mpango kamili wa tarehe za malipo, kiasi cha kila awamu na maendeleo yako.')}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-black uppercase px-3 py-1 rounded-full ${
            order.status === 'completed'
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-sky-100 text-sky-800'
          }`}>
            {order.status === 'completed' ? `✓ ${t('Awamu Zote Zimekamilika')}` : `${order.paidInstallments}/${order.installmentsCount} ${t('Awamu Zimelipwa')}`}
          </span>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100">
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('Jumla ya Agizo')}</div>
          <div className="text-base font-black text-gray-900 mt-1">{TZS(order.totalPrice)}</div>
          <div className="text-[10px] text-gray-400 font-semibold mt-0.5">{order.installmentsCount} {t('awamu')}</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100">
          <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">{t('Zilipwazo')}</div>
          <div className="text-base font-black text-emerald-700 mt-1">{TZS(order.totalPaid)}</div>
          <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">{progressPercent}% {t('imekamilika')}</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-100">
          <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">{t('Baki Inayodaiwa')}</div>
          <div className="text-base font-black text-amber-800 mt-1">{TZS(order.remaining)}</div>
          <div className="text-[10px] text-amber-600 font-semibold mt-0.5">{Math.max(0, order.installmentsCount - order.paidInstallments)} {t('awamu zimebaki')}</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-100">
          <div className="text-[10px] font-bold text-sky-700 uppercase tracking-wider">{t('Awamu Inayofuata')}</div>
          <div className="text-base font-black text-sky-800 mt-1">
            {currentDueMilestone ? TZS(currentDueMilestone.amount) : '✓ TZS 0'}
          </div>
          <div className="text-[10px] text-sky-600 font-semibold mt-0.5">
            {order.status === 'completed'
              ? t('Imekamilika')
              : order.nextDueDate
              ? new Date(order.nextDueDate).toLocaleDateString()
              : t('Tayari')}
          </div>
        </div>
      </div>

      {/* Visual Timeline Stepper / Plot */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between text-xs font-bold text-gray-500">
          <span>{t('Maendeleo ya Malipo')}</span>
          <span>{completedCount} / {totalMilestones} {t('hatua zimekamilika')} ({progressPercent}%)</span>
        </div>

        <div className={`h-3 rounded-full ${milk ? 'bg-gray-100' : 'bg-gray-800'} overflow-hidden p-0.5 shadow-inner`}>
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-sky-500 to-indigo-600 rounded-full transition-all duration-700"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Horizontal Node Stepper for Screen Widths */}
        <div className="relative pt-3 pb-2 hidden md:block">
          <div className="absolute top-7 left-4 right-4 h-0.5 bg-gray-200 -z-0" />
          <div className="grid grid-cols-4 lg:grid-cols-7 gap-2 relative z-10">
            {milestones.map((m) => {
              const isPaid = m.status === 'paid';
              const isDueNow = m.status === 'due_now';

              return (
                <div
                  key={m.index}
                  onClick={() => setSelectedMilestone(m.index)}
                  className={`flex flex-col items-center text-center p-2.5 rounded-2xl cursor-pointer transition ${
                    isDueNow
                      ? 'bg-sky-50 border-2 border-sky-500 shadow-sm scale-105'
                      : isPaid
                      ? 'bg-emerald-50/50 border border-emerald-200'
                      : 'bg-white border border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs mb-1.5 shadow-xs ${
                    isPaid
                      ? 'bg-emerald-500 text-white'
                      : isDueNow
                      ? 'bg-sky-600 text-white ring-4 ring-sky-200 animate-pulse'
                      : 'bg-gray-100 text-gray-400'
                  }`}>
                    {isPaid ? <Check className="w-4 h-4" /> : m.index === 0 ? '0' : m.index}
                  </div>
                  <div className="text-[11px] font-black text-gray-900 truncate w-full">
                    {m.index === 0 ? t('Awali') : `Awamu ${m.index}`}
                  </div>
                  <div className={`text-[10px] font-extrabold mt-0.5 ${isPaid ? 'text-emerald-700' : isDueNow ? 'text-sky-700' : 'text-gray-500'}`}>
                    {TZS(m.amount)}
                  </div>
                  <div className="text-[9px] text-gray-400 mt-0.5 truncate w-full">
                    {new Date(m.dueDate).toLocaleDateString()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Milestone Cards Schedule List */}
      <div className="space-y-2.5 pt-2">
        <div className={`text-[11px] font-black uppercase tracking-wider ${th.label}`}>
          {t('Orodha ya Awamu & Tarehe za Kulipa')}
        </div>

        <div className="space-y-2.5">
          {milestones.map((m) => {
            const isPaid = m.status === 'paid';
            const isDueNow = m.status === 'due_now';
            const isSelected = selectedMilestone === m.index;

            return (
              <div
                key={m.index}
                className={`p-4 rounded-2xl border transition ${
                  isDueNow
                    ? 'border-sky-500 bg-sky-50/60 shadow-md ring-2 ring-sky-500/20'
                    : isPaid
                    ? 'border-emerald-200 bg-emerald-50/30'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isPaid
                        ? 'bg-emerald-500 text-white'
                        : isDueNow
                        ? 'bg-sky-600 text-white'
                        : 'bg-gray-100 text-gray-400'
                    }`}>
                      {isPaid ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : isDueNow ? (
                        <Clock className="w-5 h-5 animate-pulse" />
                      ) : (
                        <Calendar className="w-5 h-5" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-gray-900">{m.title}</span>
                        {isPaid && (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            ✓ {t('Imelipwa')}
                          </span>
                        )}
                        {isDueNow && (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-sky-500 text-white animate-pulse">
                            {t('Inayotakiwa Sasa')}
                          </span>
                        )}
                        {!isPaid && !isDueNow && (
                          <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {t('Inayofuata')}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 font-semibold">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          {isPaid ? t('Tarehe ya Malipo') : t('Tarehe ya Mwisho')}: {new Date(m.dueDate).toLocaleDateString()}
                        </span>
                        {m.daysDiff !== undefined && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            m.daysDiff < 0
                              ? 'bg-red-100 text-red-800'
                              : m.daysDiff === 0
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {m.daysDiff < 0
                              ? `${t('Imechelewa siku')} ${Math.abs(m.daysDiff)}`
                              : m.daysDiff === 0
                              ? t('Imeiva leo!')
                              : `${t('Bado siku')} ${m.daysDiff}`}
                          </span>
                        )}
                        {m.payment?.reference && (
                          <span className="text-[10px] font-mono text-gray-400">Ref: {m.payment.reference}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[10px] font-bold text-gray-400 uppercase">{t('Kiasi')}</div>
                      <div className={`text-sm font-black ${isPaid ? 'text-emerald-600' : isDueNow ? 'text-sky-700' : 'text-gray-900'}`}>
                        {TZS(m.amount)}
                      </div>
                    </div>

                    {isDueNow && !readOnly && onPayNow && (
                      <button
                        type="button"
                        onClick={onPayNow}
                        className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-black shadow-md cursor-pointer flex items-center gap-1.5 transition hover:scale-105"
                      >
                        <CalendarClock className="w-3.5 h-3.5" /> {t('Lipa Awamu Hii Sasa')} <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Completion guarantee badge */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-emerald-500/10 border border-sky-200/50 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs font-bold text-sky-900">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{t('Malipo yako yote yanalindwa na Escrow ya GlobalTradeCore hadi awamu zote zitakapokamilika na kupokea mzigo.')}</span>
        </div>
        <div className="text-[10px] font-mono font-bold text-gray-500 bg-white px-2.5 py-1 rounded-lg border border-gray-200">
          Tracking: {order.trackingCode}
        </div>
      </div>
    </div>
  );
}
