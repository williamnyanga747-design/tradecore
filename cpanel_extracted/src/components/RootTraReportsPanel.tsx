import React, { useMemo, useState } from 'react';
import { Landmark, FileSpreadsheet, ListOrdered, Calendar, Check, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { Company, MarketplaceOrder } from '../types';
import { TZS } from './marketplace/MarketplaceShared';
import {
  monthsOfYear, traMarketplaceRows, downloadCsv
} from '../utils/tra';

interface Props {
  companies: Company[];
  orders: MarketplaceOrder[];
  translate: (text: string) => string;
  onToggleTinVerified: (companyId: number, verified: boolean) => void;
}

export default function RootTraReportsPanel({ companies, orders, translate: t, onToggleTinVerified }: Props) {
  const year = new Date().getFullYear();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState<string>(currentMonth);
  const [companyFilter, setCompanyFilter] = useState<number | ''>('');
  const [expanded, setExpanded] = useState<number | null>(null);

  const activeCompanies = companies.filter(c => c.status !== 'Rejected' && !c.isDeleted);

  const { rows, totalSales, totalVat, orderCount, companiesWithSales } = useMemo(
    () => traMarketplaceRows(activeCompanies, orders || [], month),
    [activeCompanies, orders, month]
  );

  const filteredRows = companyFilter === '' ? rows : rows.filter(r => r[1] === companyFilter);

  const scopedCompany = (name: string) => activeCompanies.find(c => c.name === name);

  const doExportMarketplace = () => {
    downloadCsv(`GlobalTradeCore-Marketplace-TRA-Report-${month}.csv`, [
      'S/No', 'Company Name', 'TIN', 'Region', 'Total Sales (TZS)', 'Orders', 'VAT 18% (TZS)', 'VAT Registered'
    ], rows);
  };

  const doExportTins = () => {
    const rows2 = activeCompanies
      .filter(c => c.tinNumber)
      .map((c, i) => [i + 1, c.name, c.tinNumber || '', c.region || c.district || '—', c.isVatRegistered ? 'Yes' : 'No']);
    downloadCsv('GlobalTradeCore-All-TIN-List.csv', ['S/No', 'Company Name', 'TIN', 'Region', 'VAT Registered'], rows2);
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
            <h2 className="text-lg font-bold text-gray-900">{t('Ripoti za TRA (Marketplace)')}</h2>
            <p className="text-xs text-gray-500 font-medium">{t('TRA compliance report for the whole marketplace — sellers, TIN and total sales.')}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center flex-wrap">
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
        <select
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value === '' ? '' : Number(e.target.value))}
          className="px-3 py-2 border border-gray-200 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand font-bold text-gray-800 cursor-pointer"
        >
          <option value="">{t('All companies')}</option>
          {activeCompanies.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <div className="flex gap-2 flex-wrap ml-auto">
          <button onClick={doExportMarketplace} className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition cursor-pointer">
            <FileSpreadsheet className="w-3.5 h-3.5" /> {t('Pakua Ripoti YOTE ya Marketplace kwa TRA (Excel)')}
          </button>
          <button onClick={doExportTins} className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition cursor-pointer">
            <ListOrdered className="w-3.5 h-3.5" /> {t('Pakua Orodha ya TIN zote')}
          </button>
        </div>
      </div>

      {/* Platform totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className={`${statCls} bg-emerald-50 border-emerald-200`}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700/70">{t('Total Marketplace Sales')}</div>
          <div className={statNum}>{TZS(totalSales)}</div>
        </div>
        <div className={`${statCls} bg-blue-50 border-blue-200`}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700/70">{t('Total Orders')}</div>
          <div className={statNum}>{orderCount}</div>
        </div>
        <div className={`${statCls} bg-amber-50 border-amber-200`}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700/70">{t('Total Companies Active')}</div>
          <div className={statNum}>{companiesWithSales}</div>
        </div>
        <div className={`${statCls} bg-purple-50 border-purple-200`}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-purple-700/70">{t('Estimated VAT')}</div>
          <div className={statNum}>{TZS(totalVat)}</div>
        </div>
      </div>

      {/* Company table */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <span className="text-xs font-black text-gray-800">{t('Wauzaji kwa mwezi huu')}</span>
          <span className="text-[10px] text-gray-400 font-semibold ml-2">({filteredRows.length} {t('sellers')})</span>
        </div>
        {filteredRows.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-sm font-bold text-gray-600">{t('Hakuna mauzo mwezi huu')}</div>
            <div className="text-xs text-gray-400 font-medium mt-1">{t('Delivered marketplace orders will appear here for TRA reporting.')}</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-gray-50 text-[10px] font-black uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-2.5">{t('Company')}</th>
                  <th className="px-4 py-2.5">{t('TIN')}</th>
                  <th className="px-4 py-2.5">{t('Region')}</th>
                  <th className="px-4 py-2.5 text-right">{t('Total Sales Month')}</th>
                  <th className="px-4 py-2.5 text-right">{t('Orders')}</th>
                  <th className="px-4 py-2.5 text-right">{t('VAT')}</th>
                  <th className="px-4 py-2.5">{t('TIN Verified')}</th>
                  <th className="px-4 py-2.5">{t('Details')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(r => {
                  const name = String(r[1]);
                  const comp = scopedCompany(name);
                  const isOpen = expanded === comp?.id;
                  const tinVerified = !!comp?.tinVerified;
                  return (
                    <React.Fragment key={r[0]}>
                      <tr className="border-t border-gray-50 hover:bg-gray-50/50">
                        <td className="px-4 py-2.5 font-bold text-gray-900">{name}</td>
                        <td className="px-4 py-2.5 font-mono font-bold text-gray-700">{comp?.tinNumber || <span className="text-red-500">{t('No TIN')}</span>}</td>
                        <td className="px-4 py-2.5 text-gray-600">{comp?.region || comp?.district || '—'}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-gray-900">{TZS(Number(r[4]))}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{String(r[5])}</td>
                        <td className="px-4 py-2.5 text-right text-purple-700 font-bold">{TZS(Number(r[6]))}</td>
                        <td className="px-4 py-2.5">
                          <button
                            onClick={() => onToggleTinVerified(comp!.id, !tinVerified)}
                            className={`inline-flex items-center gap-1 px-2 py-1 text-[9px] font-black uppercase rounded-full border transition cursor-pointer ${
                              tinVerified ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <Check className="w-3 h-3" /> {tinVerified ? t('Verified') : t('Mark Verified')}
                          </button>
                        </td>
                        <td className="px-4 py-2.5">
                          <button
                            onClick={() => setExpanded(isOpen ? null : (comp?.id ?? null))}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-brand hover:underline cursor-pointer"
                          >
                            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            {t('View Details')}
                          </button>
                        </td>
                      </tr>
                      {isOpen && comp && (
                        <tr className="bg-amber-50/40">
                          <td colSpan={8} className="px-4 py-3">
                            <div className="grid sm:grid-cols-3 gap-3 text-[11px]">
                              <div>
                                <span className="text-gray-400 font-bold uppercase text-[9px] block">{t('VRN')}</span>
                                <span className="font-mono font-bold text-gray-800">{comp.vrnNumber || '—'}</span>
                              </div>
                              <div>
                                <span className="text-gray-400 font-bold uppercase text-[9px] block">{t('VAT Status')}</span>
                                <span className="font-bold text-gray-800">{comp.isVatRegistered ? t('Registered (18%)') : t('Not VAT registered')}</span>
                              </div>
                              <div>
                                <span className="text-gray-400 font-bold uppercase text-[9px] block">{t('Total Sales (all time)')}</span>
                                <span className="font-bold text-gray-800">{TZS(comp.totalSalesAmount || 0)}</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
          {t('TRA inahitaji marketplace operators kuwasilisha ripoti ya wauzaji wote pamoja na TIN zao na mauzo kila mwezi. Ripoti hii inatayarishwa kwa ajili ya GlobalTradeCore.')}
        </p>
      </div>
    </div>
  );
}
