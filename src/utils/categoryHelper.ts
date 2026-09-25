import { sv } from './idUtils';

export interface CategoryScopeInfo {
  companyId: string | null;
  storeId: string | null;
  name: string;
}

export function parseCategoryScope(category: string): CategoryScopeInfo {
  if (!category || typeof category !== 'string') {
    return { companyId: null, storeId: null, name: '' };
  }

  let raw = category.trim();
  let coId: string | null = null;
  let stId: string | null = null;

  // Match co_<companyId>:
  const coMatch = /^co_([^:]+):(.*)$/.exec(raw);
  if (coMatch) {
    coId = coMatch[1];
    raw = coMatch[2];
  }

  // Match st_<storeId>:
  const stMatch = /^st_([^:]+):(.*)$/.exec(raw);
  if (stMatch) {
    stId = stMatch[1];
    raw = stMatch[2];
  } else {
    // Numeric store prefix legacy e.g. "2:Food"
    const numMatch = /^(\d+):(.*)$/.exec(raw);
    if (numMatch && !coId) {
      stId = numMatch[1];
      raw = numMatch[2];
    }
  }

  return {
    companyId: coId,
    storeId: stId,
    name: cleanCategoryName(raw)
  };
}

export function cleanCategoryName(category: string): string {
  if (!category || typeof category !== 'string') return '';
  let cleaned = category.trim();
  // Strip leading prefixes repeatedly until clean
  let changed = true;
  while (changed) {
    changed = false;
    if (cleaned.startsWith('co_')) {
      cleaned = cleaned.replace(/^co_[^:]+:/, '');
      changed = true;
    }
    if (cleaned.startsWith('st_')) {
      cleaned = cleaned.replace(/^st_[^:]+:/, '');
      changed = true;
    }
    if (/^\d+:/.test(cleaned)) {
      cleaned = cleaned.replace(/^\d+:/, '');
      changed = true;
    }
  }
  return cleaned.trim();
}

export function formatCompanyCategory(categoryName: string, companyId: string | number | null): string {
  const clean = cleanCategoryName(categoryName);
  const rawCo = sv(companyId);
  const coId = (rawCo && rawCo !== 'all') ? rawCo : '1';
  return `co_${coId}:${clean}`;
}

export function formatStoreCategory(
  categoryName: string,
  storeId: string | number | null,
  companyId?: string | number | null
): string {
  const clean = cleanCategoryName(categoryName);
  const stId = sv(storeId);
  const rawCo = sv(companyId);
  const coId = (rawCo && rawCo !== 'all') ? rawCo : '1';

  if (stId && coId) {
    return `co_${coId}:st_${stId}:${clean}`;
  }
  if (stId) {
    return `st_${stId}:${clean}`;
  }
  return formatCompanyCategory(categoryName, companyId);
}

export function getCompanyCategories(
  categories: string[],
  companyId: string | number | null,
  storeId?: string | number | null
): string[] {
  if (!categories || categories.length === 0) return [];
  const rawCo = sv(companyId);
  const isGlobal = !rawCo || rawCo === 'all';
  const targetCo = isGlobal ? null : rawCo;
  const targetSt = sv(storeId);

  return categories.filter(c => {
    if (!c || typeof c !== 'string' || !c.trim()) return false;
    const parsed = parseCategoryScope(c);

    // If a specific company is selected, filter for that company
    if (targetCo) {
      if (parsed.companyId) {
        if (parsed.companyId !== targetCo) return false;
      } else {
        // Unprefixed legacy categories default to company 1
        if (targetCo !== '1') return false;
      }
    }

    // If storeId is provided, filter strictly for that store
    if (targetSt) {
      if (parsed.storeId) {
        return parsed.storeId === targetSt;
      }
      return false;
    }

    return true;
  });
}

/**
 * Strict store category retriever:
 * Ensures Store A categories NEVER appear in Store B.
 */
export function getStoreCategories(
  categories: string[],
  storeId: string | number | null,
  companyId?: string | number | null
): string[] {
  if (!categories || categories.length === 0) return [];
  const targetSt = sv(storeId);
  const rawCo = sv(companyId);
  const isGlobal = !rawCo || rawCo === 'all';
  const targetCo = isGlobal ? null : rawCo;

  if (!targetSt) {
    // If no specific store is selected, return company-scoped categories
    return getCompanyCategories(categories, targetCo);
  }

  const results: string[] = [];
  const seenNames = new Set<string>();

  // 1. First add store-specific categories for this store
  for (const c of categories) {
    if (!c || typeof c !== 'string' || !c.trim()) continue;
    const parsed = parseCategoryScope(c);

    if (targetCo && parsed.companyId && parsed.companyId !== targetCo) {
      continue;
    }

    if (parsed.storeId && parsed.storeId === targetSt) {
      const clean = parsed.name.toLowerCase();
      if (!seenNames.has(clean)) {
        seenNames.add(clean);
        results.push(c);
      }
    }
  }

  // 2. Include company-wide categories that are not restricted to another store
  for (const c of categories) {
    if (!c || typeof c !== 'string' || !c.trim()) continue;
    const parsed = parseCategoryScope(c);

    if (targetCo && parsed.companyId && parsed.companyId !== targetCo) {
      continue;
    }

    if (!parsed.storeId) {
      if (!targetCo || parsed.companyId === targetCo || (!parsed.companyId && targetCo === '1')) {
        const clean = parsed.name.toLowerCase();
        if (!seenNames.has(clean)) {
          seenNames.add(clean);
          results.push(c);
        }
      }
    }
  }

  return results;
}
