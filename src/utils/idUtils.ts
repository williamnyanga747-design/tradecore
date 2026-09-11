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

// BUILD 2026-09-08-19: '0' added — the Global View selector reads value="0" off the
// DOM as the STRING '0', and a literal '0' is never a real company scope (the PHP
// gate rejects it too). Treating it as valid let a stray Global-View selection run a
// snapshot against company '0' which then overwrote local data with an empty payload.
const BAD_SCOPE = new Set(['nan', 'undefined', 'null', 'none', '0']);

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

/**
 * BUILD 2026-09-08-19 — DYNAMIC SCOPE BINDING (Required Fix 1).
 * Resolve the company scope to attach to an outgoing CRUD payload AT THE MOMENT OF
 * SUBMISSION (not from a stale prop captured when the form opened). Priority:
 *  1. the live preferred value (the component's currentCompanyId state at submit time)
 *  2. localStorage 'active_company_id' (persisted canonical committed scope)
 *  3. the acting user's company id
 * Returns only a validated real single-company id ("", 'all', 'NaN' etc. => '' so a
 * degenerate scope can never reach a snapshot/flush/save).
 */
export function getActiveCompanyScope(
  preferred?: unknown,
  user?: { company_id?: unknown; companyId?: unknown } | null
): string {
  const pref = sv(preferred);
  if (isRealCompanyId(pref)) return pref;
  try {
    const stored = window.localStorage.getItem('active_company_id');
    if (stored) {
      const s = sv(stored);
      if (isRealCompanyId(s)) return s;
    }
  } catch {}
  const u = user?.company_id ?? user?.companyId;
  return safeCompanyId(u);
}