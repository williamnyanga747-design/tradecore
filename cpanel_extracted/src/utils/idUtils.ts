/**
 * Build 2026-09-08-18 — system-wide STRING-ID discipline.
 *
 * Company / Branch / Store ids are STRINGS (the v2 backend mints UUIDs like
 * 'co_<hex>' / crypto.randomUUID()), but legacy seeded rows use numbers. Strict
 * `===` between a number and a UUID, plus `parseInt()`/`Number()` on UUIDs, is
 * the root cause of every 'company=NaN' symptom: the company selector resolved
 * to NaN, branch/store parent names rendered 'N/A', per-company filters matched
 * nothing, and the auto-sync re-fetched against 'company_id=NaN' — whose empty
 * server payload then overwrote local categories/stock/items/branches.
 *
 * Rule: NEVER parseInt/Number an entity id. Always normalize both sides with
 * `sv()` and compare with `sameId()`. Validate scopes with isValidCompanyScope /
 * isRealCompanyId BEFORE any snapshot/refetch/flush.
 */

const BAD_SCOPE = new Set(['nan', 'undefined', 'null', 'none']);

/**
 * Canonical string form of an id. Returns '' for null/undefined/blank/'NaN'
 * (so a UUID string like '677a8218-…' passes through untouched as a string).
 */
export function sv(id: unknown): string {
  if (id === null || id === undefined) return '';
  const s = String(id).trim();
  return s === '' || s.toLowerCase() === 'nan' ? '' : s;
}

/** True when both sides are non-empty and normalize to the same string. */
export function sameId(a: unknown, b: unknown): boolean {
  const x = sv(a);
  return x !== '' && x === sv(b);
}

/** Usable scope value (not NaN/undefined/null/none). The literal 'all' is allowed (Global View). */
export function isValidCompanyScope(v: unknown): boolean {
  const s = sv(v);
  return s !== '' && !BAD_SCOPE.has(s.toLowerCase());
}

/**
 * A CONCRETE single-company id — 'all' is a global view, not a company, so it
 * must never be sent as `company_id` to a per-company snapshot/fetch.
 */
export function isRealCompanyId(v: unknown): boolean {
  const s = sv(v);
  return isValidCompanyScope(s) && s.toLowerCase() !== 'all';
}

/** Real single-company id, or '' if the value is invalid. Guards snapshot/fetch calls. */
export function safeCompanyId(v: unknown): string {
  return isRealCompanyId(v) ? sv(v) : '';
}