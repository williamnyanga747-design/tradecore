import React, { useMemo, useRef, useState } from 'react';
import { Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, Loader2, Sparkles } from 'lucide-react';
import { BulkUploadJob, Company, MarketplaceProduct } from '../../types';
import { getPublicTheme, PublicTheme } from '../../utils/publicTheme';
import { TFunc } from './MarketplaceShared';
import { BULK_TEMPLATE_HEADERS, buildBulkTemplateCsv, parseCsv } from '../../utils/megaHelpers';
import { slugify } from '../../utils/haversine';

// ============================================================================
// F6 — BULK UPLOAD + AI MAELEZO
// ============================================================================

/** Bilingual AI description: PHP/Gemini endpoint first, local template fallback. */
export async function aiBilingualDescription(
  name: string,
  category: string,
  companyName: string,
  region?: string
): Promise<{ sw: string; en: string }> {
  const local = (): { sw: string; en: string } => ({
    sw: `${name} — ${category || 'bidhaa'} bora ya ubora wa juu inayopatikana ${region || 'Tanzania'}. Inafaa kwa matumizi ya kila siku na ina thamani nzuri kwa bei yake. Nunua kutoka ${companyName} kupitia GlobalTradeCore kwa huduma ya haraka na salama.`,
    en: `${name} — a high-quality ${category || 'product'} available in ${region || 'Tanzania'}. Perfect for everyday use and great value for money. Buy from ${companyName} on GlobalTradeCore with fast, safe delivery.`
  });
  try {
    const { getPhpConfig } = await import('../../utils/api');
    const { apiUrl } = getPhpConfig();
    const res = await fetch(`${apiUrl}?action=ai_product_description_bilingual&name=${encodeURIComponent(name)}&category=${encodeURIComponent(category)}&company=${encodeURIComponent(companyName)}`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (json && json.success && json.sw && json.en) return { sw: String(json.sw), en: String(json.en) };
    }
  } catch (e) { /* fall through */ }
  return local();
}

interface Props {
  theme: PublicTheme;
  t: TFunc;
  company: Company;
  existingProducts: MarketplaceProduct[];
  jobs: BulkUploadJob[];
  onCreateJob: (job: BulkUploadJob) => void;
  onUpdateJob: (job: BulkUploadJob) => void;
  onSaveProduct: (product: MarketplaceProduct) => void;
}

const MAX_ROWS = 1000;

export default function MegaBulkUpload({ theme, t, company, existingProducts, jobs, onCreateJob, onUpdateJob, onSaveProduct }: Props) {
  const th = getPublicTheme(theme);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  const myJobs = useMemo(() =>
    [...jobs].filter(j => j.companyId === company.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10),
    [jobs, company.id]
  );

  const downloadTemplate = () => {
    const blob = new Blob(['\ufeff' + buildBulkTemplateCsv()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tradecore_bulk_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const process = async (file: File) => {
    setError('');
    if (file.size > 10 * 1024 * 1024) return setError(t('Faili ni kubwa — maksimumi 10MB.'));
    setProcessing(true);
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length < 2) { setProcessing(false); return setError(t('Faili haina data — tumia template yetu.')); }
    const header = rows[0].map(h => String(h || '').trim().toLowerCase());
    const missing = BULK_TEMPLATE_HEADERS.filter(h => !header.includes(h));
    if (missing.length > 0) { setProcessing(false); return setError(`${t('Nguzo hazipatikani')}: ${missing.join(', ')}`); }
    const dataRows = rows.slice(1);
    if (dataRows.length > MAX_ROWS) { setProcessing(false); return setError(`${t('Mistari mingi')}: ${dataRows.length} > ${MAX_ROWS}.`); }

    const col = (r: string[], key: string) => r[header.indexOf(key)]?.trim() || '';
    const nowIso = new Date().toISOString();

    let job: BulkUploadJob = {
      id: Date.now(),
      companyId: company.id,
      fileName: file.name,
      totalRows: dataRows.length,
      successRows: 0,
      failedRows: 0,
      errors: [],
      status: 'processing',
      createdAt: nowIso
    };
    onCreateJob(job);

    let nextId = Math.max(0, ...existingProducts.map(p => p.id)) + 1;
    const usedSkus = new Set(existingProducts.map(p => p.slug));

    for (let i = 0; i < dataRows.length; i++) {
      const r = dataRows[i];
      const rowNo = i + 2; // 1-based incl. header
      try {
        const name = col(r, 'name');
        const price = Number(col(r, 'price').replace(/[^0-9.]/g, ''));
        const stockQty = parseInt(col(r, 'stock') || '0', 10);
        const category = col(r, 'category');
        let descSw = col(r, 'description_sw');
        let descEn = col(r, 'description_en');
        const sku = col(r, 'sku');

        if (!name) throw new Error(t('Jina linahitajika'));
        if (!price || price <= 0) throw new Error(t('Bei si sahihi'));
        if (isNaN(stockQty) || stockQty < 0) throw new Error(t('Stock si sahihi'));

        // AI maelezo when missing
        if (!descSw || !descEn) {
          const ai = await aiBilingualDescription(name, category, company.name, company.region);
          descSw = descSw || ai.sw;
          descEn = descEn || ai.en;
        }

        let slug = slugify(name) || `bidhaa-${nextId}`;
        while (usedSkus.has(slug)) slug = `${slug}-${nextId}`;
        usedSkus.add(slug);

        const product: MarketplaceProduct = {
          id: nextId++,
          companyId: company.id,
          name,
          slug,
          description: descEn || descSw,
          price,
          stockQuantity: stockQty,
          image: '',
          category: category || undefined,
          isActive: true,
          status: 'approved',
          averageRating: 0,
          reviewsCount: 0
        };
        onSaveProduct(product);
        job = { ...job, successRows: job.successRows + 1 };
      } catch (e: any) {
        job = {
          ...job,
          failedRows: job.failedRows + 1,
          errors: [...job.errors, { row: rowNo, message: e?.message || 'Error' }].slice(-100)
        };
      }
      setProgress({ done: i + 1, total: dataRows.length });
      onUpdateJob(job);
      // yield to UI
      if (i % 5 === 0) await new Promise(res => setTimeout(res, 0));
    }

    job = { ...job, status: job.failedRows > 0 && job.successRows === 0 ? 'failed' : 'completed' };
    onUpdateJob(job);
    setProcessing(false);
  };

  return (
    <div className="space-y-4">
      {/* instructions */}
      <div className={`${th.card} ${th.cardBorder} rounded-2xl p-4 space-y-3`}>
        <h3 className={`text-xs font-black flex items-center gap-2 ${th.strongText}`}><FileSpreadsheet className="w-4 h-4 text-emerald-500" /> {t('Pakia Bidhaa kwa Wingi (Excel/CSV)')}</h3>
        <ol className={`text-[11px] font-semibold space-y-1 list-decimal ml-4 ${th.textMuted}`}>
          <li>{t('Pakua template yetu ya Excel/CSV.')}</li>
          <li>{t('Jaza nguzo: name, category, price, stock, description_sw, description_en, sku.')}</li>
          <li>{t('Acha description wazi — AI itazitengeneza kwa Kiswahili na Kiingereza!')}</li>
          <li>{t('Pakia faili (maks 1000 mistari, 10MB).')}</li>
        </ol>
        <button onClick={downloadTemplate} className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-black rounded-xl cursor-pointer ${th.btnSecondary} ${th.btnSecondaryText}`}>
          <Download className="w-3.5 h-3.5" /> {t('Pakua Template')}
        </button>
      </div>

      {/* upload */}
      <div className={`${th.card} ${th.cardBorder} rounded-2xl p-4 space-y-3`}>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={processing}
          className={`w-full flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed cursor-pointer disabled:opacity-50 ${th.cardBorder} hover:brightness-105`}
        >
          {processing ? (
            <>
              <Loader2 className={`w-7 h-7 animate-spin text-amber-500`} />
              <span className={`text-[11px] font-black ${th.strongText}`}>{t('Inapakia bidhaa')}... {progress.done}/{progress.total}</span>
              <div className={`w-48 h-1.5 rounded-full overflow-hidden bg-gray-500/25`}>
                <div className="h-full bg-amber-500 transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
              </div>
            </>
          ) : (
            <>
              <Upload className={`w-7 h-7 ${th.textDim}`} />
              <span className={`text-[11px] font-bold ${th.textMuted}`}>{t('Bofya kuchagua faili la CSV/Excel')}</span>
            </>
          )}
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv,.xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.currentTarget.value = ''; if (f) void process(f); }} />
        {error && <div className="text-[11px] font-bold text-red-400 bg-red-500/10 border border-red-500/40 rounded-lg px-3 py-2">{error}</div>}
      </div>

      {/* history */}
      <div className={`${th.card} ${th.cardBorder} rounded-2xl p-4 space-y-3`}>
        <h3 className={`text-xs font-black ${th.strongText}`}>{t('Historia ya Uploads')}</h3>
        {myJobs.length === 0 && <div className={`text-[11px] font-semibold ${th.textMuted}`}>{t('Hakuna uploads bado.')}</div>}
        {myJobs.map(j => (
          <div key={j.id} className={`rounded-xl border p-3 space-y-1.5 ${th.cardBorder}`}>
            <div className="flex items-center justify-between gap-2">
              <div className={`text-[11px] font-black truncate ${th.strongText}`}>{j.fileName}</div>
              <span className={`shrink-0 text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                j.status === 'completed' ? 'bg-emerald-500/15 text-emerald-500'
                : j.status === 'failed' ? 'bg-red-500/15 text-red-400'
                : 'bg-amber-500/15 text-amber-500'}`}>
                {j.status}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-bold">
              <span className="text-emerald-500 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {j.successRows}</span>
              <span className="text-red-400 flex items-center gap-1"><XCircle className="w-3 h-3" /> {j.failedRows}</span>
              <span className={th.textDim}>{new Date(j.createdAt).toLocaleString()}</span>
            </div>
            {j.errors.length > 0 && (
              <details className="text-[10px]">
                <summary className={`cursor-pointer font-black ${th.brandText}`}>{t('Onyesha makosa')} ({j.errors.length})</summary>
                <ul className={`mt-1 space-y-0.5 list-disc ml-4 font-semibold ${th.textMuted}`}>
                  {j.errors.slice(0, 20).map((er, i) => <li key={i}>{t('Mstari')} {er.row}: {er.message}</li>)}
                </ul>
              </details>
            )}
          </div>
        ))}
      </div>

      <div className={`rounded-xl p-3 bg-amber-500/10 border border-amber-500/30 text-[10px] font-bold ${th.textMuted} flex items-start gap-2`}>
        <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
        {t('AI huandika maelezo kwa bidhaa zisizo na maelezo — hakikisha jina na category ni sahihi kabla ya kupakia.')}
      </div>
    </div>
  );
}
