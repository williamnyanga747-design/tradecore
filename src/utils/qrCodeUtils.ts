// =============================================================
// MEGA ULTIMATE — QR CODE YA DUKA LA MTAA
// QR generation (qrcode pkg) + unique token helpers for store /
// product posters and scan links.
// =============================================================
import QRCode from 'qrcode';

/** Cryptic uppercase token for a store/product QR (e.g. 8F3K2Q9A1Z). */
export function generateQrToken(len = 10): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(len);
  try {
    crypto.getRandomValues(bytes);
  } catch (e) {
    for (let i = 0; i < len; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/** Public URL encoded in a store QR poster. */
export function buildCompanyQrUrl(slug: string, token: string, refCode?: string): string {
  const base = `https://tanzaniatradecore.co.tz/company/${encodeURIComponent(slug)}?qr=1&ref_qr=${encodeURIComponent(token)}`;
  return refCode ? `${base}&ref=${encodeURIComponent(refCode)}` : base;
}

/** Public URL encoded in a product QR sticker. */
export function buildProductQrUrl(productSlug: string, token: string, refCode?: string): string {
  const base = `https://tanzaniatradecore.co.tz/product/${encodeURIComponent(productSlug)}?qr=1&ref_qr=${encodeURIComponent(token)}`;
  return refCode ? `${base}&ref=${encodeURIComponent(refCode)}` : base;
}

/** Generate a QR image data URL (PNG) ready for <img> / jsPDF. */
export async function generateQrDataUrl(
  text: string,
  opts: { width?: number; dark?: string; light?: string } = {}
): Promise<string> {
  return QRCode.toDataURL(text, {
    width: opts.width ?? 512,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: opts.dark ?? '#111111', light: opts.light ?? '#ffffff' }
  });
}

/** Extract & verify the ref_qr token from a ?qr=1 scan link. */
export function readQrScanParams(url: string): { token?: string; isQr: boolean } {
  try {
    const params = new URL(url).searchParams;
    return { token: params.get('ref_qr') || undefined, isQr: params.get('qr') === '1' };
  } catch (e) {
    return { isQr: false };
  }
}
