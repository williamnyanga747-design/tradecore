import { sv } from './idUtils';

export function getCompanyCategories(
  categories: string[],
  companyId: string | number | null,
  storeId?: string | number | null
): string[] {
  if (!categories || categories.length === 0) return [];
  // BUILD 2026-09-08-18: company ids are STRING UUIDs — a Number() here mints NaN and
  // every co_ filter silently matched nothing. Compare the raw string scopes.
  const targetCo = sv(companyId) || '1';
  const targetSt = sv(storeId);

  return categories.filter(c => {
    if (!c) return false;
    // Check if category is scoped to a company
    if (c.startsWith('co_')) {
      const prefix = `co_${targetCo}:`;
      return c.startsWith(prefix);
    }
    // Check if category is scoped to a store
    if (c.startsWith('st_')) {
      if (!targetSt) return false;
      return c.startsWith(`st_${targetSt}:`);
    }
    // Backward compatibility for numeric store prefix e.g. "1:Electronics"
    if (/^\d+:/.test(c)) {
      if (!targetSt) return true;
      return c.startsWith(`${targetSt}:`);
    }
    // Plain legacy category names default to Company 1
    return targetCo === '1';
  });
}

export function getStoreCategories(categories: string[], storeId: string | number | null): string[] {
  if (!categories || categories.length === 0) return [];
  const targetSt = sv(storeId);
  if (!targetSt) return categories;
  return categories.filter(c => {
    if (!c) return false;
    if (c.startsWith('st_')) return c.startsWith(`st_${targetSt}:`);
    if (/^\d+:/.test(c)) return c.startsWith(`${targetSt}:`);
    return true;
  });
}

export function cleanCategoryName(category: string): string {
  if (!category) return '';
  if (category.startsWith('co_')) {
    const parts = category.split(':');
    return parts.slice(1).join(':');
  }
  if (category.startsWith('st_')) {
    const parts = category.split(':');
    return parts.slice(1).join(':');
  }
  if (category.includes(':')) {
    return category.split(':').slice(1).join(':');
  }
  return category;
}

export function formatCompanyCategory(categoryName: string, companyId: string | number | null): string {
  const clean = cleanCategoryName(categoryName.trim());
  const coId = sv(companyId) || '1';
  return `co_${coId}:${clean}`;
}