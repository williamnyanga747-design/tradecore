import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, FileText, Calendar, ShieldCheck, Check, Info, Landmark } from 'lucide-react';
import { Company, MarketplaceOrder, TraReceipt } from '../types';
import { TZS } from './marketplace/MarketplaceShared';
import {
  monthsOfYear, monthKeyOf, traOrderRows, downloadCsv, generateTraPdf,
  vatAmountOf, receiptForOrder
} from '../utils/tra';

interface Props {
  company: Company | null;
  orders: MarketplaceOrder[];
  traReceipts: TraReceipt[];
  translate: (text: string) => string;
  onUpdateReceipt: (orderId: number, efdReceiptNumber: string) => void;
}

const MONTH_LABEL: Record<string, string> = {
  '01': 'January', '02': 'February', '03': 'March', '04': 'April',
  '05': 'May', '06': 'June', '07': 'July', '08': 'August',
  '09': 'September', '10': 'October', '11': 'November', '12': 'December'
};

export default function TraReportPanel({ company, orders, traReceipts, translate: t, onUpdateReceipt }: Props) {
  const year = new Date().getFullYear();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState<string>(currentMonth);

  const monthOrders = useMemo(() => {
    const monthParts = month.split('-');
    return (orders || [])
      .filter(o => o.status === 'delivered' && monthKeyOf(o.createdAt) === month)
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  }, [orders, month]);

  const isVat = !!company?.isVatRegistered;
  const { rows, totalSales, totalVat, orderCount } = useMemo(
    () => traOrderRows(monthOrders, company),
    [monthOrders, company]
  );

  const monthName = (() => {
    const m = month.split('-')[1];
    return (MONTH_LABEL[m] || m || month) + ' ' + year;
  })();

  const doExportExcel = () => {
    downloadCsv(`GlobalTradeCore-TRA-Report-${company?.slug || company?.name || 'company'}-${month}.csv`, [
      'S/No', 'Date', 'Order ID', 'Product Name', 'Quantity', 'Amount (TZS)', `VAT ${isVat ? '18%' : '0%'} (TZS)`, 'TIN', 'Buyer Name'
    ], rows);
  };

  const doExportPdf = () => {
    generateTraPdf({
      title: 'TRA MONTHLY SALES REPORT',
      subtitle: `${company?.name || ''} — ${monthName} — GlobalTradeCore Marketplace`,
      companyName: company?.name || '',
      tinNumber: company?.tinNumber || '—',
      vrnNumber: company?.vrnNumber || '',
      vatStatus: isVat ? 'Registered (18%)' : 'Not VAT registered',
      totals: { totalSales, totalVat, orderCount },
      header: ['No', 'Date', 'Order ID', 'Product', 'Qty', 'Amount', 'VAT', 'TIN', 'Buyer'],
      rows,
      filename: `GlobalTradeCore-TRA-Report-${company?.slug || company?.name || 'company'}-${month}.pdf`,
      footerNote: 'Kwa mujibu wa sheria, kila muuzaji anawajibika kutunza kumbukumbu na kulipa kodi TRA. GlobalTradeCore kama marketplace inatoa ripoti hii kwa urahisi wako.'
    });
  };

  const statCls = 'rounded-xl border px-4 py-3';
  const statNum = 'text-lg font-black mt-0.5';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-100 text-amber-700">
            <Landmark className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">{t('Ripoti ya TRA')}</h2>
            <p className="text-xs text-gray-500 font-medium">{t('Tanzania Revenue Authority monthly sales report for your company.')}</p>
          </div>
        </div>
      </div>

      {/* TRA identity */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-wider text-amber-800/70">{t('TIN Number')}</div>
          <div className="font-mono font-black text-gray-900 text-sm mt-0.5">{company?.tinNumber || '—'}</div>
        </div>
        <div>
          <div className="text-[10px] font-black uppercase tracking-wider text-amber-800/70">{t('VRN Number')}</div>
          <div className="font-mono font-black text-gray-900 text-sm mt-0.5">{company?.vrnNumber || '—'}</div>
        </div>
        <div>
          <div className="text-[10px] font-black uppercase tracking-wider text-amber-800/70">{t('VAT Status')}</div>
          <div className="font-black text-gray-900 text-sm mt-0.5">
            {isVat ? t('Registered (18%)') : t('Not VAT registered')}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-black uppercase tracking-wider text-amber-800/70">{t('TIN Verification')}</div>
          <div className="flex items-center gap-1.5 text-sm font-black mt-0.5">
            {company?.tinVerified ? (
              <span className="inline-flex items-center gap-1 text-emerald-700"><Check className="w-4 h-4" /> {t('Verified')}</span>
            ) : (
              <span className="text-amber-700">{t('Pending admin verification')}</span>
            )}
          </div>
        </div>
      </div>

      {/* Month selector + actions */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand font-bold text-gray-800 cursor-pointer"
          >
            {monthsOfYear(year).map(mo => (
              <option key={mo.key} value={mo.key}>{mo.label}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={doExportExcel} className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition cursor-pointer">
            <FileSpreadsheet className="w-3.5 h-3.5" /> {t('Pakua Ripoti ya TRA (Excel)')}
          </button>
          <button onClick={doExportPdf} className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition cursor-pointer">
            <FileText className="w-3.5 h-3.5" /> {t('Pakua Ripoti ya TRA (PDF)')}
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className={`${statCls} bg-emerald-50 border-emerald-200`}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700/70">{t('Mauzo ya Mwezi')}</div>
          <div className={statNum}>{TZS(totalSales)}</div>
        </div>
        <div className={`${statCls} bg-blue-50 border-blue-200`}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700/70">{t('Oda')}</div>
          <div className={statNum}>{orderCount}</div>
        </div>
        <div className={`${statCls} bg-purple-50 border-purple-200`}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-purple-700/70">{t('VAT iliyokusanywa')}</div>
          <div className={statNum}>{TZS(totalVat)}</div>
        </div>
      </div>

      {/* Orders table */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <span className="text-xs font-black text-gray-800">{t('Oda za Mwezi')}</span>
          <span className="text-[10px] text-gray-400 font-semibold">{monthName} · {orderCount} {t('orders')}</span>
        </div>
        {monthOrders.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-sm font-bold text-gray-600">{t('Hakuna oda zilizofikishwa mwezi huu')}</div>
            <div className="text-xs text-gray-400 font-medium mt-1">{t('Delivered orders will appear here for your TRA report.')}</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-gray-50 text-[10px] font-black uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-2.5">{t('Date')}</th>
                  <th className="px-4 py-2.5">{t('Order ID')}</th>
                  <th className="px-4 py-2.5">{t('Product')}</th>
                  <th className="px-4 py-2.5">{t('Buyer')}</th>
                  <th className="px-4 py-2.5 text-right">{t('Amount')}</th>
                  <th className="px-4 py-2.5 text-right">{t('VAT')}</th>
                  <th className="px-4 py-2.5">{t('Status')}</th>
                  <th className="px-4 py-2.5">{t('EFD Receipt No')}</th>
                </tr>
              </thead>
              <tbody>
                {monthOrders.map(o => {
                  const receipt = receiptForOrder(traReceipts, o.id);
                  return (
                    <tr key={o.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-2.5 text-gray-500 font-medium">{(o.createdAt || '').slice(0, 10)}</td>
                      <td className="px-4 py-2.5 font-bold text-gray-900">{o.orderNumber}</td>
                      <td className="px-4 py-2.5 text-gray-600">{(o.items || []).map(i => `${i.productName} ×${i.quantity}`).join(', ')}</td>
                      <td className="px-4 py-2.5 text-gray-600">{o.customerName}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-gray-900">{TZS(o.totalAmount)}</td>
                      <td className="px-4 py-2.5 text-right text-purple-700 font-bold">{TZS(vatAmountOf(o.totalAmount, isVat))}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-green-100 text-green-700">{t('Delivered')}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <input
                            value={receipt?.efdReceiptNumber || ''}
                            onChange={(e) => onUpdateReceipt(o.id, e.target.value.replace(/[^0-9A-Za-z\-]/g, ''))}
                            placeholder={t('EFD No.')}
                            className="w-32 px-2 py-1 border border-gray-200 rounded-md text-[11px] font-mono font-bold text-gray-800 outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                          />
                          {receipt?.efdReceiptNumber && (
                            <span className="text-[9px] font-black uppercase text-emerald-600 flex items-center gap-0.5">
                              <Check className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-2.5">
        <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <p className="text-[11px] text-amber-800 font-semibold leading-relaxed">
          {t('Kwa mujibu wa sheria, kila muuzaji anawajibika kutunza kumbukumbu na kulipa kodi TRA. GlobalTradeCore kama marketplace inatoa ripoti hii kwa urahisi wako.')}
        </p>
      </div>
    </div>
  );
}
