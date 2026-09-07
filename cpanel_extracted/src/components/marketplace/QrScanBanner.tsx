// =============================================================
// MEGA ULTIMATE — QR CODE YA DUKA LA MTAA: scan detection + banner.
// Mounted on /company/{slug} and /product/{slug} pages. When the
// visitor arrived via ?qr=1&ref_qr=TOKEN it records the scan and
// shows the QR5 5% discount banner.
// =============================================================
import React, { useEffect, useRef, useState } from 'react';
import { QrCode, BadgePercent, X, ShoppingBag } from 'lucide-react';
import { Company, MarketplaceProduct } from '../../types';
import { getPublicTheme, PublicTheme } from '../../utils/publicTheme';
import { TFunc } from './MarketplaceShared';
import { readQrScanParams } from '../../utils/qrCodeUtils';

interface QrScanBannerProps {
  theme: PublicTheme;
  t: TFunc;
  company: Company;
  product?: MarketplaceProduct;
  qr5Enabled?: boolean;
  qr5DiscountPercent?: number;
  onRecordQrScan: (companyId: number, productId: number | null, token: string, referrer: string, isAffiliate: boolean) => void;
  onBrowseStore?: () => void;
}

export default function QrScanBanner({
  theme, t, company, product, qr5Enabled = true, qr5DiscountPercent = 5,
  onRecordQrScan, onBrowseStore
}: QrScanBannerProps) {
  const th = getPublicTheme(theme);
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(false);
  const recordedRef = useRef('');

  useEffect(() => {
    try {
      const { token, isQr } = readQrScanParams(window.location.href);
      if (!isQr || !token) return;
      if (recordedRef.current === token) return;
      recordedRef.current = token;
      const params = new URLSearchParams(window.location.search);
      const isAffiliate = !!params.get('ref');
      onRecordQrScan(company.id, product?.id ?? null, token, window.location.href, isAffiliate);
      setActive(true);
    } catch (e) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id, product?.id]);

  if (!active || dismissed || !qr5Enabled) return null;

  return (
    <div className={`mb-4 rounded-2xl p-4 flex items-center justify-between gap-3 border-2 border-emerald-400 bg-emerald-50 shadow-sm`}>
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-emerald-500 text-white flex items-center justify-center flex-shrink-0">
          <QrCode className="w-6 h-6" />
        </div>
        <div>
          <div className="text-[12px] font-black text-emerald-800 inline-flex items-center gap-1.5">
            <BadgePercent className="w-4 h-4" />
            {t('QR5 — Punguzo la')} {qr5DiscountPercent}% {t('kwa wateja waliofika kupitia QR code')}
          </div>
          <div className="text-[11px] font-semibold text-emerald-600 mt-0.5">
            {t('Umefika kupitia QR CODE ya')} {company.name}. {t('Onyesha hii kwa mwuzaji unaponunua.')}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {onBrowseStore && (
          <button onClick={onBrowseStore} className="px-3 py-2 bg-emerald-600 text-white rounded-xl text-[11px] font-black cursor-pointer inline-flex items-center gap-1.5 hover:bg-emerald-700">
            <ShoppingBag className="w-3.5 h-3.5" /> {t('Nunua Sasa')}
          </button>
        )}
        <button onClick={() => setDismissed(true)} className="p-2 text-emerald-500 hover:bg-emerald-100 rounded-lg cursor-pointer" title={t('Close')}>
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
