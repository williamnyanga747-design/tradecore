import { MarketplaceProduct, Company } from '../types';

export interface BotIntent {
  keywords: string[];
  region?: string;
  size?: string;
  priceMax?: number;
}

/** Tanzania regions + their common Kiswahili/English names for intent detection. */
const REGION_KEYWORDS: Record<string, string[]> = {
  'Dar es Salaam': ['dar', 'dodoma?no', 'dar es salaam', 'dsm', 'ubungo', 'ilala', 'kinondoni', 'temeke'],
  'Dodoma': ['dodoma', 'dodoma mjini'],
  'Arusha': ['arusha'],
  'Mwanza': ['mwanza'],
  'Mbeya': ['mbeya'],
  'Morogoro': ['morogoro'],
  'Tanga': ['tanga'],
  'Kilimanjaro': ['moshi', 'kilimanjaro'],
  'Singida': ['singida'],
  'Tabora': ['tabora'],
  'Kigoma': ['kigoma'],
  'Iringa': ['iringa'],
  'Manyara': ['manyara', 'babati'],
  'Kagera': ['kagera', 'bukoba'],
  'Shinyanga': ['shinyanga'],
  'Ruvuma': ['ruvuma', 'songea'],
  'Pwani': ['pwani', 'bagamoyo', 'kibaha'],
  'Zanzibar': ['zanzibar'],
  'Geita': ['geita'],
  'Simiyu': ['simiyu', 'bariadi'],
  'Songwe': ['songwe'],
  'Njombe': ['njombe'],
  'Lindi': ['lindi'],
  'Mtwara': ['mtwara'],
  'Rukwa': ['rukwa', 'sumbawanga'],
  'Katavi': ['katavi'],
  'Mara': ['mara', 'musoma']
};

const SIZE_PATTERN = /(?:size|ukubwa|ukubwa wa|saizi)\s*(\d+(?:\.\d+)?)/i;

/** Cheap, dependency-free intent parser for Kiswahili/English shopping messages. */
export function parseIntent(message: string): BotIntent {
  const lower = (message || '').toLowerCase();
  const intent: BotIntent = { keywords: [] };

  const sizeMatch = lower.match(SIZE_PATTERN);
  if (sizeMatch) {
    intent.size = sizeMatch[1];
    const clean = lower.replace(SIZE_PATTERN, '');
    intent.keywords = clean.split(/[\s,.;!?]+/).filter(w => w.length > 1 && !/^(kwa|na|ya|wa|za|la|vya|katika|nataka|nataka|unayo|naomba|tanzania|bei|kiasi)$/.test(w));
  } else {
    intent.keywords = lower.split(/[\s,.;!?]+/).filter(w => w.length > 1 && !/^(kwa|na|ya|wa|za|la|vya|katika|nataka|nataka|unayo|naomba|tanzania|bei|kiasi)$/.test(w));
  }

  for (const region of Object.keys(REGION_KEYWORDS)) {
    if (REGION_KEYWORDS[region].some(k => lower.includes(k))) {
      intent.region = region;
      break;
    }
  }

  const priceMatch = lower.match(/(?:under|chini ya|hadi|bei ya)\s*(\d+)/);
  if (priceMatch) intent.priceMax = Number(priceMatch[1]);

  return intent;
}

/** Score a product against the parsed intent (name/description/category + optional region/size). */
export function scoreProduct(product: MarketplaceProduct, company: Company | undefined, intent: BotIntent): number {
  let score = 0;
  const haystack = `${product.name} ${product.description} ${product.category || ''} ${company?.name || ''} ${company?.region || ''}`.toLowerCase();

  for (const kw of intent.keywords) {
    if (haystack.includes(kw)) score += 3;
  }
  // Partial keyword match (e.g. "viatu" inside "viatu vya kiume")
  for (const kw of intent.keywords) {
    if (kw.length > 3 && haystack.split(/\s+/).some(w => w.startsWith(kw) || kw.startsWith(w))) score += 1;
  }
  if (intent.region && (company?.region || '').toLowerCase().includes(intent.region.toLowerCase())) score += 4;
  if (intent.size && product.name.toLowerCase().includes(`size ${intent.size}`)) score += 3;
  if (intent.priceMax && product.price <= intent.priceMax) score += 2;
  return score;
}

/** Return up to `limit` products matching the intent, sorted by score. */
export function searchProducts(
  message: string,
  products: MarketplaceProduct[],
  companies: Company[],
  limit = 3
): Array<{ product: MarketplaceProduct; company?: Company; score: number }> {
  const intent = parseIntent(message);
  const byId = new Map<number, Company>();
  companies.forEach(c => byId.set(c.id, c));
  const visible = products.filter(p => p.isActive !== false && (p.status === undefined || p.status === 'approved'));
  const scored = visible
    .map(p => ({ product: p, company: byId.get(p.companyId), score: scoreProduct(p, byId.get(p.companyId), intent) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/** Build the bot's Kiswahili reply text (with line breaks) from results. */
export function buildReply(
  results: Array<{ product: MarketplaceProduct; company?: Company; score: number }>,
  fallback: string
): string {
  if (results.length === 0) return fallback;
  const lines = results.map((r, i) => {
    const company = r.company;
    const loc = company?.region ? ` - ${company.name} (${company.region})` : company ? ` - ${company.name}` : '';
    return `${i + 1}. ${r.product.name} - TZS ${Math.round(r.product.price).toLocaleString('en-US')} - /product/${r.product.slug}${loc}`;
  });
  return `Karibu TradeCore! Hizi hapa bidhaa tulizozipata:\n${lines.join('\n')}\n\nBonyeza jina la bidhaa ili kuona zaidi.`;
}

/** Mask a phone number for public display, e.g. 2557***123. */
export function maskPhone(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length < 7) return phone || '-';
  return `${digits.slice(0, 4)}***${digits.slice(-3)}`;
}

/** Normalise a Tanzanian phone to 255… format (accepts +255/0/07 etc). */
export function normalizeTzPhone(phone: string): string {
  let d = (phone || '').replace(/\D/g, '');
  if (d.startsWith('255')) return d;
  if (d.startsWith('0')) return '255' + d.slice(1);
  if (d.startsWith('7') || d.startsWith('6')) return '255' + d;
  return d;
}
