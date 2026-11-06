// =============================================================
// TradeCore POS - Professional Code 128 Barcode Generator
// Standard Code 128 Subset B barcode symbology generator.
// Generates scannable vector SVG bar patterns for any SKU / code.
// =============================================================

// Code 128 patterns (Subset B, characters 32 to 127 + control codes)
const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', // 0-9
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', // 10-19
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', // 20-29
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', // 30-39
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', // 40-49
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', // 50-59
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', // 60-69
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', // 70-79
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', // 80-89
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', // 90-99
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112' // 100-106 (104=Start B, 106=Stop)
];

const START_B_INDEX = 104;
const STOP_INDEX = 106;

export interface BarcodeBar {
  x: number;
  width: number;
}

/**
 * Encodes an ASCII string into Code 128 Subset B bars
 */
export function encodeCode128B(text: string, moduleWidth: number = 2): { bars: BarcodeBar[]; totalWidth: number } {
  const clean = String(text || '').trim() || 'TRADECORE';
  const indices: number[] = [START_B_INDEX];

  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    // ASCII 32 to 127 maps to Code 128 B values 0 to 95
    if (code >= 32 && code <= 126) {
      indices.push(code - 32);
    } else {
      indices.push(0); // fallback space
    }
  }

  // Calculate Checksum: (Start_Value + SUM(char_value * position)) % 103
  let checksum = START_B_INDEX;
  for (let i = 1; i < indices.length; i++) {
    checksum += indices[i] * i;
  }
  indices.push(checksum % 103);
  indices.push(STOP_INDEX);

  // Convert pattern strings to bars
  const bars: BarcodeBar[] = [];
  let currentX = 10; // Left quiet zone

  indices.forEach(idx => {
    const pattern = CODE128_PATTERNS[idx] || CODE128_PATTERNS[0];
    let isBar = true;
    for (let j = 0; j < pattern.length; j++) {
      const w = parseInt(pattern[j], 10) * moduleWidth;
      if (isBar) {
        bars.push({ x: currentX, width: w });
      }
      currentX += w;
      isBar = !isBar;
    }
  });

  const totalWidth = currentX + 10; // Right quiet zone
  return { bars, totalWidth };
}

/**
 * Customer Pricing Tiers for Barcode labels
 */
export type CustomerPriceTier = 'Retail' | 'Wholesale' | 'Preferred' | 'All';

export interface BarcodeLabelData {
  productName: string;
  sku: string;
  retailPrice: number;
  wholesalePrice?: number;
  partnerPrice?: number;
  unit?: string;
  companyName?: string;
  category?: string;
  barcodeType?: CustomerPriceTier;
}

/**
 * Generates an SVG string representation of Code 128 barcode
 */
export function generateBarcodeSvgString(
  sku: string,
  height: number = 50,
  moduleWidth: number = 2
): string {
  const { bars, totalWidth } = encodeCode128B(sku, moduleWidth);
  const rects = bars.map(b => `<rect x="${b.x}" y="0" width="${b.width}" height="${height}" fill="#000000" />`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${height + 18}" width="100%" height="${height + 18}">
    <rect width="${totalWidth}" height="${height + 18}" fill="#ffffff" />
    ${rects}
    <text x="${totalWidth / 2}" y="${height + 14}" text-anchor="middle" font-family="monospace" font-size="12" font-weight="bold" fill="#000000" letter-spacing="2">${sku}</text>
  </svg>`;
}
