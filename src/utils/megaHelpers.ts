// ============================================================================
// MEGA BUILD — shared helpers for the 7 ultimate features
// ============================================================================

// --- F3: VISUAL SEARCH — dominant color extraction (canvas, no deps) ---

const NAMED_COLORS: Array<{ name: string; sw: string; rgb: [number, number, number] }> = [
  { name: 'black', sw: 'nyeusi', rgb: [20, 20, 20] },
  { name: 'white', sw: 'nyeupe', rgb: [245, 245, 245] },
  { name: 'gray', sw: 'kijivu', rgb: [128, 128, 128] },
  { name: 'red', sw: 'nyekundu', rgb: [200, 30, 30] },
  { name: 'orange', sw: 'machungwa', rgb: [235, 130, 30] },
  { name: 'yellow', sw: 'njano', rgb: [230, 210, 40] },
  { name: 'green', sw: 'kijani', rgb: [40, 160, 60] },
  { name: 'blue', sw: 'bluu', rgb: [35, 80, 200] },
  { name: 'purple', sw: 'zambarau', rgb: [130, 50, 180] },
  { name: 'pink', sw: 'pinki', rgb: [235, 120, 170] },
  { name: 'brown', sw: 'kahawia', rgb: [130, 85, 45] },
  { name: 'beige', sw: 'mweupe-mwanga', rgb: [220, 195, 160] }
];

export interface DominantColor {
  hex: string;
  name: string;
  nameSw: string;
  rgb: [number, number, number];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

export function nearestNamedColor(rgb: [number, number, number]): { name: string; nameSw: string } {
  let best = NAMED_COLORS[0];
  let bestD = Infinity;
  for (const c of NAMED_COLORS) {
    const d = colorDistance(rgb, c.rgb);
    if (d < bestD) { bestD = d; best = c; }
  }
  return { name: best.name, nameSw: best.sw };
}

/** Extract the top N dominant colors of an image (data URL or remote URL). */
export async function extractDominantColors(imageSrc: string, count = 3): Promise<DominantColor[]> {
  const img = await loadImage(imageSrc);
  const size = 48;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;

  // Quantize into 4x4x4-ish buckets (16 levels per channel >> too many; use 5 bits → bucket by 32)
  const buckets = new Map<string, { r: number; g: number; b: number; n: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 125) continue; // skip transparent
    const r = data[i], g = data[i + 1], b = data[i + 2];
    // skip near-extremes noise only if very dark/very light AND low saturation is fine to keep
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
    const cur = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
    cur.r += r; cur.g += g; cur.b += b; cur.n += 1;
    buckets.set(key, cur);
  }
  const sorted = [...buckets.values()]
    .map(b => ({ rgb: [b.r / b.n, b.g / b.n, b.b / b.n] as [number, number, number], n: b.n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, count * 2);

  // Deduplicate similar colors
  const out: DominantColor[] = [];
  for (const s of sorted) {
    const rgb: [number, number, number] = [Math.round(s.rgb[0]), Math.round(s.rgb[1]), Math.round(s.rgb[2])];
    if (out.some(o => colorDistance(o.rgb, rgb) < 48)) continue;
    const named = nearestNamedColor(rgb);
    out.push({ hex: rgbToHex(rgb[0], rgb[1], rgb[2]), name: named.name, nameSw: named.nameSw, rgb });
    if (out.length >= count) break;
  }
  return out;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
}

/** Similarity % between two colors (100 = identical). */
export function colorSimilarity(a: [number, number, number], b: [number, number, number]): number {
  const d = colorDistance(a, b);
  return Math.max(0, Math.round(100 - (d / 441.67) * 100));
}

// --- F6: BULK UPLOAD — minimal CSV parser (handles quotes) ---

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(f => f.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some(f => f.trim() !== '')) rows.push(row);
  return rows;
}

export const BULK_TEMPLATE_HEADERS = ['name', 'category', 'price', 'stock', 'description_sw', 'description_en', 'sku'];

export function buildBulkTemplateCsv(): string {
  const sample = [
    BULK_TEMPLATE_HEADERS.join(','),
    'Kitenge Rangi Zaidi,Kitenge,25000,50,"Kitenge kizuri cha rangi nyingi, ubora wa juu.","Multicolor kitenge fabric, premium quality.",KT-001',
    'Simu Yake Smart 64GB,Simu,450000,12,"Simu janja, kamera nzuri, betri ya kutosha.","Smart phone, great camera, long battery.",PH-002'
  ].join('\n');
  return sample;
}

// --- F2: CHAT — language detection + auto translation (MyMemory free API) ---

const SW_MARKERS = ['habari','asante','karibu','naomba','samahani','bidhaa','bei','ngapi','kiasi','nataka','nunua','muuzaji','duka','sasa','baadaye','asubuhi','jioni','sawa','hapana','ndiyo','rahisi','ghali','uzuri','poa','tafadhali','kwenda','kuja','wapi','lini','nini','ngapi','shilingi','kwa','ya','wa','cha','za','ni','huu','hii','hizo','wako','yangu','je','sio','tuna','mimi','wewe','yeye','sisi','ninyi','wao'];

/** Simple heuristic: count Swahili marker words vs English markers. */
export function detectLang(text: string): 'sw' | 'en' {
  const t = ` ${text.toLowerCase().replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ')} `;
  let swScore = 0;
  for (const m of SW_MARKERS) {
    if (t.includes(` ${m} `)) swScore++;
  }
  const enMarkers = ['the','and','you','your','for','with','this','that','have','price','how','much','want','buy','please','thanks','hello','good','can','is','are','do','does'];
  let enScore = 0;
  for (const m of enMarkers) {
    if (t.includes(` ${m} `)) enScore++;
  }
  return swScore >= enScore ? 'sw' : 'en';
}

/**
 * Translate via MyMemory free API (MVP). Falls back to the original text on any failure.
 */
export async function translateText(text: string, from: 'sw' | 'en', to: 'en' | 'sw'): Promise<string> {
  if (!text.trim()) return text;
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 480))}&langpair=${from}|${to}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      const translated = json?.responseData?.translatedText;
      if (typeof translated === 'string' && translated.trim() && !/MYMEMORY WARNING/i.test(translated)) {
        return translated;
      }
    }
  } catch (e) { /* network/API failure — fall through */ }
  return text;
}

// --- F1: ESCROW / M-PESA SIMULATION ---

/** Generate a fake mobile-money transaction id (STK push simulation). */
export function simulateTxId(network: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 10; i++) id += chars[Math.floor(Math.random() * chars.length)];
  const prefix = network === 'm_pesa' ? 'Q' : network === 'tigo_pesa' ? 'T' : network === 'airtel_money' ? 'A' : 'H';
  return `${prefix}${id}`;
}

export function normalizePhoneTz(phone: string): string {
  const digits = (phone || '').replace(/[^0-9]/g, '');
  if (digits.startsWith('255')) return `+${digits}`;
  if (digits.startsWith('0')) return `+255${digits.slice(1)}`;
  if (digits.length === 9) return `+255${digits}`;
  return phone.startsWith('+') ? phone : `+${digits}`;
}

/** Network detection from a Tanzanian phone number. */
export function networkFromPhone(phone: string): MegaNetwork | null {
  const n = normalizePhoneTz(phone).replace('+255', '');
  if (/^7[45]/.test(n) || /^6[57]/.test(n)) return 'm_pesa'; // Vodacom 074/075/065/067
  if (/^71/.test(n) || /^65/.test(n)) return 'tigo_pesa'; // Tigo 071/065 overlap kept simple
  if (/^7[038]/.test(n) || /^6[89]/.test(n)) return 'airtel_money'; // Airtel 070/078/068/069
  if (/^76/.test(n)) return 'halopesa'; // Halotel 076
  return null;
}

export type MegaNetwork = 'm_pesa' | 'tigo_pesa' | 'airtel_money' | 'halopesa';

// --- F5: FLASH SALE countdown formatting ---

export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

export function flashStatusFor(startTime?: string | null, endTime?: string | null, now = Date.now()): 'upcoming' | 'active' | 'ended' {
  // Defensive null-safe parsing: a malformed record read during a company-switch re-sync
  // (or a partial flash-sale row) must never crash the caller. Missing/invalid dates are
  // treated as 'ended' so the sale simply never renders as active.
  const st = startTime ? new Date(startTime).getTime() : 0;
  const et = endTime ? new Date(endTime).getTime() : 0;
  if (!Number.isFinite(st) || !Number.isFinite(et) || st === 0 || et === 0) return 'ended';
  if (now < st) return 'upcoming';
  if (now > et) return 'ended';
  return 'active';
}

// --- misc ---

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
