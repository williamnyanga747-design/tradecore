// =============================================================
// MEGA ULTIMATE — QR CODE YANGU (seller dashboard page)
// Generate / print / download the store QR poster (QR Code ya
// Duka la Mtaa) and per-product QR stickers + scan analytics.
// =============================================================
import React, { useEffect, useState } from 'react';
import { QrCode, Printer, Copy, Check, Download, MessageCircle, ExternalLink, RefreshCw, BadgePercent, Eye, ShoppingBag } from 'lucide-react';
import { Company, MarketplaceProduct } from '../types';
import { jsPDF } from 'jspdf';
import { generateQrDataUrl, generateQrToken, buildCompanyQrUrl, buildProductQrUrl } from '../utils/qrCodeUtils';

interface CompanyQrPanelProps {
  company: Company | null;
  products: MarketplaceProduct[];
  t: (text: string) => string;
  qr5DiscountPercent?: number;
  onSaveCompany: (patch: Partial<Company>) => void;
  onSaveProduct: (product: MarketplaceProduct) => void;
}

export default function CompanyQrPanel({
  company, products, t, qr5DiscountPercent = 5, onSaveCompany, onSaveProduct
}: CompanyQrPanelProps) {
  const [token, setToken] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [productQrs, setProductQrs] = useState<Record<number, string>>({});

  // Ensure the company has a persistent QR token + cached image.
  useEffect(() => {
    if (!company) return;
    const existing = company.qrCodeToken;
    if (existing) {
      setToken(existing);
      return;
    }
    const fresh = generateQrToken();
    setToken(fresh);
    onSaveCompany({ qrCodeToken: fresh });
  }, [company?.id]);

  // Generate the poster QR image whenever the token/slug changes.
  useEffect(() => {
    let alive = true;
    if (company && token) {
      const url = buildCompanyQrUrl(company.slug || slugFallback(company), token);
      generateQrDataUrl(url, { width: 512 })
        .then(data => {
          if (!alive) return;
          setQrUrl(data);
          onSaveCompany({ qrCodePath: data, qrCodeToken: token });
        })
        .catch(() => {});
    } else {
      setQrUrl('');
    }
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id, token]);

  // Lazy-generate per-product QRs.
  useEffect(() => {
    let alive = true;
    (async () => {
      const map: Record<number, string> = {};
      for (const p of products) {
        try {
          const url = buildProductQrUrl(p.slug || String(p.id), token || generateQrToken());
          map[p.id] = await generateQrDataUrl(url, { width: 256 });
        } catch (e) {}
      }
      if (alive) setProductQrs(map);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products.length, token]);

  if (!company) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
        <QrCode className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <div className="font-bold text-gray-800">{t('No store linked to your account.')}</div>
        <div className="text-xs text-gray-500 mt-1">{t('Register a marketplace store first to get your QR code.')}</div>
      </div>
    );
  }

  const storeUrl = buildCompanyQrUrl(company.slug || slugFallback(company), token);
  const copyLink = () => {
    navigator.clipboard?.writeText(storeUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const whatsappShare = () => {
    const msg = encodeURIComponent(`${t('Tembelea duka letu la GlobalTradeCore kwa kuscan QR hii — punguzo la')} ${qr5DiscountPercent}%! ${storeUrl}`);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  const downloadPoster = async () => {
    setBusy(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      // Background
      doc.setFillColor(196, 30, 58);
      doc.rect(0, 0, 210, 297, 'F');
      doc.setFillColor(255, 255, 255);
      doc.rect(15, 15, 180, 267, 'F');
      // Header
      doc.setFillColor(196, 30, 58);
      doc.rect(15, 15, 180, 38, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(26);
      doc.setFont('helvetica', 'bold');
      doc.text('QR CODE YA DUKA', 105, 30, { align: 'center' });
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text('GlobalTradeCore.co.tz', 105, 38, { align: 'center' });
      // Company name
      doc.setTextColor(20, 20, 20);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      const name = company.name || 'Duka Langu';
      doc.text(doc.splitTextToSize(name, 150), 105, 70, { align: 'center' });
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(90, 90, 90);
      const loc = [company.region, company.district, company.ward].filter(Boolean).join(', ');
      if (loc) doc.text(loc, 105, 78, { align: 'center' });
      // QR image
      if (qrUrl) {
        doc.addImage(qrUrl, 'PNG', 60, 88, 90, 90);
      } else {
        doc.setDrawColor(200);
        doc.rect(60, 88, 90, 90);
      }
      // Scan instructions
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(196, 30, 58);
      doc.text(t('Scan me to view our products'), 105, 188, { align: 'center' });
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text(`QR5 ${t('Punguzo la')} ${qr5DiscountPercent}% ${t('kwa wateja wa QR')}`, 105, 196, { align: 'center' });
      // Footer details
      doc.setDrawColor(220);
      doc.setLineWidth(0.3);
      doc.line(45, 205, 165, 205);
      doc.setFontSize(10);
      doc.setTextColor(70, 70, 70);
      if (company.whatsappNumber) doc.text(`${t('WhatsApp')}: +${company.whatsappNumber}`, 105, 214, { align: 'center' });
      if (company.phone) doc.text(`${t('Simu')}: ${company.phone}`, 105, 220, { align: 'center' });
      doc.text(storeUrl, 105, 232, { align: 'center', maxWidth: 150 });
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text('GlobalTradeCore.co.tz — Tafuta, Linganisha, Nunua', 105, 268, { align: 'center' });
      doc.save(`QR-${(company.slug || company.name || 'duka').replace(/[^a-z0-9-]/gi, '').slice(0, 40)}.pdf`);
    } catch (e) {
      console.error('QR poster PDF failed:', e);
    } finally {
      setBusy(false);
    }
  };

  const downloadProductQr = async (p: MarketplaceProduct) => {
    try {
      const url = buildProductQrUrl(p.slug || String(p.id), token || generateQrToken());
      const data = productQrs[p.id] || await generateQrDataUrl(url, { width: 512 });
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a6' });
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, 148, 105, 'F');
      doc.setTextColor(20, 20, 20);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(doc.splitTextToSize(p.name, 120), 74, 18, { align: 'center' });
      doc.addImage(data, 'PNG', 27, 26, 94, 94);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(90, 90, 90);
      doc.text(`${t('Punguzo la')} ${qr5DiscountPercent}% (QR5) — GlobalTradeCore.co.tz`, 74, 127, { align: 'center' });
      doc.save(`QR-${(p.slug || p.name).replace(/[^a-z0-9-]/gi, '').slice(0, 40)}.pdf`);
    } catch (e) {
      console.error('Product QR PDF failed:', e);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl p-5 text-white shadow-lg">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider opacity-80 inline-flex items-center gap-1.5"><QrCode className="w-4 h-4" /> {t('QR CODE YA DUKA LA MTAA')}</div>
            <div className="text-2xl font-black mt-1">{company.name}</div>
            <div className="text-[11px] font-semibold mt-1 opacity-90 inline-flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" /> {t('Scans')}: {company.qrScans || 0} · <BadgePercent className="w-3.5 h-3.5" /> QR5 {qr5DiscountPercent}% {t('discount for QR customers')}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={copyLink} className="px-3 py-2 bg-white text-emerald-700 rounded-lg text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 hover:bg-emerald-50">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? t('Copied!') : t('Copy Link')}
            </button>
            <button onClick={whatsappShare} className="px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 hover:bg-green-700">
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
            </button>
            <button onClick={() => window.open(storeUrl, '_blank')} className="px-3 py-2 bg-white/15 text-white border border-white/40 rounded-lg text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 hover:bg-white/25">
              <ExternalLink className="w-3.5 h-3.5" /> {t('Open')}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="font-bold text-sm">{t('Duka QR Poster')}</div>
            <button onClick={downloadPoster} disabled={busy} className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 hover:bg-emerald-700 disabled:opacity-50">
              {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} {t('Download Poster (PDF)')}
            </button>
          </div>
          <div className="flex flex-col items-center bg-gray-50 rounded-xl p-5">
            {qrUrl ? (
              <img src={qrUrl} alt="Store QR" className="w-52 h-52 rounded-xl border border-gray-200 bg-white" />
            ) : (
              <div className="w-52 h-52 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-300"><RefreshCw className="w-8 h-8 animate-spin" /></div>
            )}
            <div className="text-[11px] font-bold text-gray-600 mt-3">{t('Chapisha, wambaza na usambaze.')}</div>
            <div className="text-[10px] text-gray-400 text-center mt-1 max-w-sm break-all">{storeUrl}</div>
          </div>
          <div className="mt-3 text-[11px] font-semibold text-gray-500 leading-relaxed">
            {t('Wateja wanaoscan QR ya duka lako wanafika moja kwa moja kwenye ukurasa wako na kuona punguzo la')} {qr5DiscountPercent}% (QR5). {t('Kila scan inahesabiwa hapo juu.')}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="font-bold text-sm mb-3">{t('Bidhaa QR Stickers')}</div>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {products.map(p => (
              <div key={p.id} className="flex items-center gap-3 border border-gray-100 rounded-lg p-2.5">
                {p.image && <img src={p.image} alt="" className="w-10 h-10 rounded-lg object-cover" />}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-gray-800 truncate">{p.name}</div>
                  <div className="text-[10px] text-gray-400">{p.slug || `#${p.id}`}</div>
                </div>
                {productQrs[p.id] ? <img src={productQrs[p.id]} alt="" className="w-10 h-10 rounded" /> : <div className="w-10 h-10 rounded bg-gray-100" />}
                <button onClick={() => downloadProductQr(p)} title={t('Download')} className="p-2 bg-gray-100 text-gray-600 rounded-lg cursor-pointer hover:bg-gray-200">
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {products.length === 0 && (
              <div className="py-6 text-center text-gray-400 font-medium text-xs">{t('No products yet — add products to generate stickers.')}</div>
            )}
          </div>
          <div className="mt-3 text-[11px] font-semibold text-gray-500 flex items-start gap-1.5">
            <ShoppingBag className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            {t('Bandika QR sticker kwenye bidhaa zako — mteja anayescan anaona ukurasa wa bidhaa na punguzo la')} {qr5DiscountPercent}%.
          </div>
        </div>
      </div>
    </div>
  );
}

function slugFallback(c: Company): string {
  return (c.slug || c.name || 'duka').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'duka';
}
