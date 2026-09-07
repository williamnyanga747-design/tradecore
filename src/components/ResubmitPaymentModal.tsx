import React, { useState } from 'react';
import { RefreshCcw, Camera, X, CheckCircle2, Landmark, Smartphone } from 'lucide-react';
import { PayNumbersConfig } from '../types';
import ReceiptCameraModal from './ReceiptCameraModal';

interface ResubmitPaymentModalProps {
  companyName: string;
  adminNote?: string;
  payNumbers: PayNumbersConfig;
  translate: (text: string) => string;
  onClose: () => void;
  onSubmit: (data: { paymentMethod: string; paymentReference: string; receiptImageUrl: string }) => void;
}

export default function ResubmitPaymentModal({
  companyName, adminNote, payNumbers, translate: t, onClose, onSubmit
}: ResubmitPaymentModalProps) {
  const [paymentMethod, setPaymentMethod] = useState('M-Pesa');
  const [paymentReference, setPaymentReference] = useState('');
  const [receiptImageUrl, setReceiptImageUrl] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [error, setError] = useState('');

  const inputCls =
    'w-full px-3 py-2 border border-gray-200 rounded-lg text-xs bg-gray-50 outline-none focus:ring-2 focus:ring-brand/20 font-medium';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!paymentReference.trim()) {
      setError(t('Payment reference / transaction ID is required'));
      return;
    }
    onSubmit({ paymentMethod, paymentReference: paymentReference.trim(), receiptImageUrl });
  };

  return (
    <div className="fixed inset-0 z-[85] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[92vh] overflow-y-auto scrollbar-thin">
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#2d323e] text-white">
          <div className="flex items-center gap-2">
            <RefreshCcw className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-black tracking-wider uppercase">Resubmit Payment for Verification</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          <p className="text-[11px] text-gray-600 font-semibold bg-gray-50 border border-gray-200 rounded-lg p-3">
            Company: <strong className="text-gray-900">{companyName}</strong>
            {adminNote && (
              <span className="block mt-1 text-[10px] text-red-600 bg-red-50 border border-red-100 rounded p-1.5">
                {t('Super Admin feedback')}: {adminNote}
              </span>
            )}
          </p>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-[11px] font-semibold text-red-700">{error}</div>
          )}

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-[10px] font-black text-amber-800 uppercase tracking-wider">
              <Smartphone className="w-3.5 h-3.5" /> {t('Official Pay Numbers')}
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
              <div className="bg-white rounded p-1.5 border border-amber-100">
                <span className="block text-[8px] text-gray-400 font-bold uppercase">M-Pesa</span>
                <span className="font-black text-amber-900 font-mono">{payNumbers.mpesa || '- - -'}</span>
              </div>
              <div className="bg-white rounded p-1.5 border border-amber-100">
                <span className="block text-[8px] text-gray-400 font-bold uppercase">TigoPesa</span>
                <span className="font-black text-amber-900 font-mono">{payNumbers.tigopesa || '- - -'}</span>
              </div>
              <div className="bg-white rounded p-1.5 border border-amber-100">
                <span className="block text-[8px] text-gray-400 font-bold uppercase">Airtel</span>
                <span className="font-black text-amber-900 font-mono">{payNumbers.airtel || '- - -'}</span>
              </div>
              <div className="bg-white rounded p-1.5 border border-amber-100">
                <span className="block text-[8px] text-gray-400 font-bold uppercase">{t('Bank')}</span>
                <span className="font-black text-amber-900 text-[9px]">{payNumbers.bankAccount || '- - -'}</span>
              </div>
            </div>
            {payNumbers.bankHolder && (
              <p className="text-[9px] text-amber-700 font-semibold flex items-center gap-1">
                <Landmark className="w-3 h-3" /> {payNumbers.bankName}: {payNumbers.bankAccount} — {payNumbers.bankHolder}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 block tracking-wider uppercase">{t('Payment Method')}</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputCls}>
                <option>M-Pesa</option>
                <option>TigoPesa</option>
                <option>Airtel Money</option>
                <option>Bank Wire Transfer</option>
                <option>Direct Cash</option>
                <option>Credit Card</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 block tracking-wider uppercase">{t('Payment Reference')}</label>
              <input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} className={inputCls} placeholder="e.g. SDR93LXM2A" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 block tracking-wider uppercase">{t('New Receipt Photo (Optional)')}</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowCamera(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#2d323e] text-white text-[11px] font-bold rounded-lg"
              >
                <Camera className="w-4 h-4" />
                {t('Capture / Upload Receipt')}
              </button>
              {receiptImageUrl && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {t('Attached')}
                </span>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-lg tracking-wider uppercase shadow transition"
          >
            {t('Resubmit for Verification')}
          </button>
        </form>
      </div>

      <ReceiptCameraModal open={showCamera} onClose={() => setShowCamera(false)} onCapture={setReceiptImageUrl} translate={t} />
    </div>
  );
}
