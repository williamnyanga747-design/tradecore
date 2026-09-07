import { jsPDF } from 'jspdf';
import { Company, MarketplaceOrder, TraReceipt } from '../types';

export const VAT_RATE = 18; // Tanzania standard VAT percent (inclusive: vat = total * 18/118)

/** VAT amount for a total when the seller is VAT registered (18% inclusive of price). */
export const vatAmountOf = (total: number, isVatRegistered: boolean): number =>
  isVatRegistered ? Math.round((total * VAT_RATE) / (100 + VAT_RATE)) : 0;

/** "YYYY-MM" key of an ISO date string. */
export const monthKeyOf = (iso: string): string => (iso || '').slice(0, 7);

export const formatTzs = (n: number): string => 'TZS ' + Math.round(n || 0).toLocaleString('en-US');

/** Trigger a browser download of a CSV string with a UTF-8 BOM (opens correctly in Excel). */
export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]): void {
  const esc = (v: string | number): string => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csv = '\uFEFF' + [header.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Build the per-company monthly TRA report rows for delivered orders. */
export function traOrderRows(orders: MarketplaceOrder[], company: Company | null): {
  rows: (string | number)[][];
  totalSales: number;
  totalVat: number;
  orderCount: number;
} {
  const isVat = !!company?.isVatRegistered;
  let totalSales = 0;
  let totalVat = 0;
  const rows: (string | number)[][] = [];
  orders.forEach((o, idx) => {
    const vat = vatAmountOf(o.totalAmount, isVat);
    totalSales += o.totalAmount;
    totalVat += vat;
    const items = o.items || [];
    items.forEach((it, i2) => {
      rows.push([
        idx + 1,
        (o.createdAt || '').slice(0, 10),
        o.orderNumber,
        it.productName,
        it.quantity,
        it.subtotal,
        isVat ? vatAmountOf(it.subtotal, true) : 0,
        company?.tinNumber || '',
        o.customerName
      ]);
    });
  });
  return { rows, totalSales, totalVat, orderCount: orders.length };
}

/** Render a jsPDF TRA report (company monthly). */
export function generateTraPdf(opts: {
  title: string;
  subtitle: string;
  companyName: string;
  tinNumber: string;
  vrnNumber: string;
  vatStatus: string;
  totals: { totalSales: number; totalVat: number; orderCount: number };
  header: string[];
  rows: (string | number)[][];
  filename: string;
  footerNote: string;
}): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 30;
  let y = 30;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(opts.title, margin, y);
  y += 18;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(opts.subtitle, margin, y);
  y += 14;
  doc.setFont('helvetica', 'bold');
  doc.text(`Business: ${opts.companyName}`, margin, y);
  y += 13;
  doc.text(`TIN: ${opts.tinNumber}   |   VRN: ${opts.vrnNumber || '-'}   |   VAT: ${opts.vatStatus}`, margin, y);
  y += 16;

  doc.setFont('helvetica', 'bold');
  doc.text(`Total Sales: ${formatTzs(opts.totals.totalSales)}   Orders: ${opts.totals.orderCount}   VAT Collected: ${formatTzs(opts.totals.totalVat)}`, margin, y);
  y += 20;

  const colW = pageW - margin * 2;
  const n = opts.header.length;
  const cellW = colW / n;
  const rowH = 18;
  const line = (text: string, x: number, w: number, bold = false, align: 'left' | 'right' = 'left') => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(7);
    doc.text(text, x + (align === 'right' ? w - 4 : 4), y + 12, { maxWidth: w - 8, align });
  };

  doc.setFillColor(15, 118, 110);
  doc.rect(margin, y, colW, rowH, 'F');
  doc.setTextColor(255, 255, 255);
  opts.header.forEach((h, i) => line(h, margin + i * cellW, cellW, true));
  doc.setTextColor(20, 20, 20);
  y += rowH;

  const isLast = (i: number) => i === opts.rows.length - 1;
  opts.rows.forEach((r, i) => {
    if (y > 780) {
      doc.addPage();
      y = 30;
    }
    doc.setFillColor(i % 2 === 0 ? 245 : 255, i % 2 === 0 ? 245 : 255, i % 2 === 0 ? 245 : 255);
    doc.rect(margin, y, colW, rowH, 'F');
    opts.header.forEach((_, ci) => {
      const v = r[ci];
      const isNum = typeof v === 'number' || /^[\d,.TZS ]+$/.test(String(v));
      line(String(v ?? ''), margin + ci * cellW, cellW, false, isNum ? 'right' : 'left');
    });
    y += rowH;
    if (!isLast(i)) y -= 1;
  });

  y += 24;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(90, 90, 90);
  doc.text(opts.footerNote, margin, y, { maxWidth: colW });
  doc.save(opts.filename);
}

/** Look up the EFD receipt for an order. */
export const receiptForOrder = (traReceipts: TraReceipt[], orderId: number): TraReceipt | undefined =>
  traReceipts.find(r => r.orderId === orderId);

/** Month label list for a given year (short English label + key). */
export function monthsOfYear(year: number): { key: string; label: string }[] {
  const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return labels.map((l, i) => ({ key: `${year}-${String(i + 1).padStart(2, '0')}`, label: `${l} ${year}` }));
}

/** Build the marketplace-wide TRA report rows: one per company per month. */
export function traMarketplaceRows(companies: Company[], orders: MarketplaceOrder[], monthKey: string): {
  rows: (string | number)[][];
  totalSales: number;
  totalVat: number;
  orderCount: number;
  companiesWithSales: number;
} {
  const monthOrders = orders.filter(o => o.status === 'delivered' && monthKeyOf(o.createdAt) === monthKey);
  let totalSales = 0;
  let totalVat = 0;
  const rows: (string | number)[][] = [];
  companies
    .filter(c => monthOrders.some(o => o.companyId === c.id))
    .forEach((c, idx) => {
      const co = monthOrders.filter(o => o.companyId === c.id);
      const sales = co.reduce((s, o) => s + o.totalAmount, 0);
      const vat = co.reduce((s, o) => s + vatAmountOf(o.totalAmount, !!c.isVatRegistered), 0);
      totalSales += sales;
      totalVat += vat;
      rows.push([
        idx + 1,
        c.name,
        c.tinNumber || '—',
        c.region || c.district || '—',
        sales,
        co.length,
        vat,
        c.isVatRegistered ? 'Yes' : 'No'
      ]);
    });
  return { rows, totalSales, totalVat, orderCount: monthOrders.length, companiesWithSales: rows.length };
}
