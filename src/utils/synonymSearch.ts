import { SearchSynonym } from '../types';

/** Normalize a search term for matching: lowercase, strip accents, trim punctuation. */
export function normalizeTerm(term: string): string {
  return term
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim();
}

/**
 * Expand a Kiswahili/English query using the synonym dictionary.
 * Returns the original tokens plus every keyword/synonym reachable from any token.
 * Example: "viatu" with { keyword: 'viatu', synonyms: ['shoes','kiatu','sneakers'] }
 *  -> ["viatu","shoes","kiatu","sneakers"]
 */
export function expandSearchQuery(query: string, synonyms: SearchSynonym[]): string[] {
  const tokens = normalizeTerm(query).split(/\s+/).filter(Boolean);
  const expanded = new Set<string>();
  tokens.forEach(t => expanded.add(t));

  for (const group of synonyms || []) {
    const groupWords = [group.keyword.toLowerCase(), ...(group.synonyms || []).map(s => s.toLowerCase())];
    const hit = tokens.some(t => groupWords.includes(t));
    if (hit) {
      groupWords.forEach(w => expanded.add(w));
    }
  }

  return Array.from(expanded);
}

/**
 * Does a product match any expanded term?
 * Match fields: name, category, description (word-boundary, substring).
 */
export function productMatchesTerms(
  product: { name: string; category?: string; description?: string },
  terms: string[]
): boolean {
  if (!terms || terms.length === 0) return true;
  const haystacks = [product.name || '', product.category || '', product.description || '']
    .map(h => normalizeTerm(h));
  return terms.some(term => {
    if (!term) return false;
    return haystacks.some(h => h.includes(term));
  });
}

/** A tiny built-in Kiswahili→English phrase map for common marketplace queries (offline fallback for AI switcher). */
export const PHRASE_MAP: Record<string, string> = {
  'viatu vya wanaume': 'men shoes',
  'viatu vya wanawake': 'women shoes',
  'viatu vya watoto': 'kids shoes',
  'nguo za mtoto': 'baby clothes',
  'nguo za watoto': 'kids clothes',
  'nguo za wanaume': 'men clothes',
  'nguo za wanawake': 'women clothes',
  'suruali fupi': 'shorts',
  'suruali ya jeans': 'jeans trousers',
  'shati la mikono mirefu': 'long sleeve shirt',
  'kofia za watoto': 'kids caps',
  'kahawa ya kinywaji': 'drinking coffee',
  'asali ya asili': 'natural honey',
  'vifaa vya umeme': 'electronics',
  'vifaa vya nyumbani': 'home appliances',
  'vifaa vya shamba': 'farm tools',
  'bidhaa za kijiji': 'village products',
  'bidhaa za chakula': 'food products',
  'mafuta ya kupikia': 'cooking oil',
  'unga wa mahindi': 'maize flour',
  'unga wa ngano': 'wheat flour',
  'mchele mweupe': 'white rice',
  'simu za mkono': 'mobile phones',
  'laptop mpya': 'new laptop',
  'vipodozi': 'cosmetics',
  'mapambo ya nyumbani': 'home decor'
};

/** Translate a Kiswahili phrase to English using the offline map (single phrase match or token-level). */
export function translatePhrase(query: string): { ok: boolean; result: string } {
  const q = query.trim().toLowerCase();
  if (PHRASE_MAP[q]) return { ok: true, result: PHRASE_MAP[q] };
  // Token-level: swap known Kiswahili tokens for English equivalents
  const tokenMap: Record<string, string> = {
    viatu: 'shoes', kiatu: 'shoe', nguo: 'clothes', gauni: 'dress', shati: 'shirt',
    suruali: 'trousers', simu: 'phone', laptop: 'laptop', kahawa: 'coffee', asali: 'honey',
    mafuta: 'oil', mchele: 'rice', unga: 'flour', kofia: 'cap', saa: 'watch', miwani: 'glasses',
    mkoba: 'bag', kitenge: 'kitenge', vifaa: 'equipment', mapambo: 'decorations',
    kununua: 'buy', bei: 'price', ghali: 'expensive', rahisi: 'cheap', bora: 'best',
    mpya: 'new', mzee: 'old', nzuri: 'good', kubwa: 'big', ndogo: 'small'
  };
  const words = normalizeTerm(q).split(/\s+/).filter(Boolean);
  let changed = false;
  const translated = words.map(w => {
    if (tokenMap[w]) {
      changed = true;
      return tokenMap[w];
    }
    return w;
  });
  if (!changed) return { ok: false, result: q };
  return { ok: true, result: translated.join(' ') };
}
