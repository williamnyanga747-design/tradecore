/**
 * PBS v2 — Stateless Normalized Persistence Layer (client side).
 *
 * Replaces the monolithic 5MB blob round-trip with small, atomic, company-scoped
 * HTTP CRUD calls against the normalized MySQL tables that api.php backs:
 *
 *   companies | stores | products | stock_categories | user_accounts | audit_trails
 *
 * Design rules (mirror the PHP dispatch in public/cpanel/api.php):
 *   - The client holds NO source-of-truth blob. Every write is a single targeted
 *     round-trip (v2_upsert_* / v2_delete_*) that the server commits at once:
 *     normalized row + legacy atomic mirror + blob merge + audit trail.
 *   - Reads (v2_list_*) are company-scoped (`company_id = ?`) and fall back to the
 *     legacy blob key only while the normalized table is still empty, so a fresh
 *     DB never returns an empty state before migration 003 has backfilled.
 *   - Writes use a fresh AbortController and IGNORE outer signals (like apiPost):
 *     a caller abort (rapid company switch / unmount) must never kill an in-flight
 *     save and drop the user's edits.
 *   - Operator identity is forwarded on every call so the strict auth guard passes
 *     and audit_trails.user_name is populated.
 */
import {
  getPhpConfig,
  getOperatorHeaders,
  buildSessionToken,
  discoverApiUrl
} from './api';
import { sv, isValidCompanyScope } from './idUtils';

export interface Company {
  id: string | number;
  name?: string;
  code?: string;
  is_active?: number | boolean;
  [k: string]: unknown;
}

export interface Store {
  id: string | number;
  company_id?: string | number;
  companyId?: string | number;
  name?: string;
  branch_id?: string | number;
  branchId?: string | number;
  is_active?: number | boolean;
  [k: string]: unknown;
}

export interface Product {
  id: string | number;
  company_id?: string | number;
  companyId?: string | number;
  store_id?: string | number;
  storeId?: string | number;
  name?: string;
  sku?: string;
  price?: number;
  stock?: number;
  [k: string]: unknown;
}

export interface UserAccount {
  id: string | number;
  company_id?: string | number;
  companyId?: string | number;
  full_name?: string;
  username?: string;
  phone?: string;
  email?: string;
  role?: string;
  is_active?: number | boolean;
  [k: string]: unknown;
}

export interface Category {
  key: string;
  // BUILD 2026-09-08-18: company ids are STRING UUIDs — companyId stays a string.
  companyId: string | number;
  name: string;
}

export interface AuditRecord {
  id: string;
  company_id: string;
  store_id: string | null;
  user_id: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  details: string;
  ip_address: string;
  created_at: string;
  timestamp: string;
  detailsObj?: Record<string, unknown>;
}

export interface V2ListResponse<T> {
  success: boolean;
  list?: T[];
  count?: number;
  server_ts?: number;
  error?: string;
}

export interface V2WriteResponse {
  success: boolean;
  id?: string;
  server_ts?: number;
  error?: string;
}

let cachedApiUrl: string | null = null;
let resolvingApiUrl: Promise<string | null> | null = null;

async function resolveApiUrl(): Promise<string> {
  if (cachedApiUrl) return cachedApiUrl;
  const { apiUrl } = getPhpConfig();
  if (apiUrl && !apiUrl.endsWith('/api.php')) return (cachedApiUrl = apiUrl);
  if (!resolvingApiUrl) {
    resolvingApiUrl = discoverApiUrl()
      .then((found) => {
        cachedApiUrl = found;
        return found;
      })
      .finally(() => {
        resolvingApiUrl = null;
      });
  }
  const found = await resolvingApiUrl;
  if (found) return found;
  return apiUrl || '/cpanel/api.php';
}

/**
 * Targeted atomic POST to the v2 dispatch. Mirrors apiPost's transport: JSON body,
 * operator + bearer headers, 12s timeout, outer-signal ignore (writes must finish).
 */
async function v2Post<T>(action: string, payload: Record<string, unknown>): Promise<T | null> {
  try {
    const url = await resolveApiUrl();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    const { apiKey } = getPhpConfig();
    if (apiKey) headers['X-API-Key'] = apiKey;
    Object.assign(headers, getOperatorHeaders());
    const token = buildSessionToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action, ...payload }),
        signal: controller.signal
      });
      if (!response.ok) return null;
      const text = await response.text();
      try {
        return JSON.parse(text) as T;
      } catch (e) {
        return null;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.warn('[PBS v2] POST failed for ' + action, error);
    return null;
  }
}

/** Company id fallback helper → the server accepts both company_id and companyId. */
function companyKey(companyId: string | number | undefined): Record<string, unknown> {
  return { company_id: String(companyId ?? '') };
}

// ----------------------------------------------------------------------------
// COMPANIES
// ----------------------------------------------------------------------------
export async function v2ListCompanies(): Promise<Company[]> {
  const res = await v2Post<V2ListResponse<Company>>('v2_list_companies', {});
  return res && Array.isArray(res.list) ? res.list : [];
}

export async function v2UpsertCompany(entity: Company): Promise<boolean> {
  const res = await v2Post<V2WriteResponse>('v2_upsert_company', { entity });
  return !!(res && res.success);
}

/** Detailed variant — returns the raw server response (with error message) for diagnostics. */
export async function v2UpsertCompanyDetailed(entity: Company): Promise<V2WriteResponse | null> {
  return v2Post<V2WriteResponse>('v2_upsert_company', { entity });
}

export async function v2DeleteCompany(id: string | number): Promise<boolean> {
  const res = await v2Post<V2WriteResponse>('v2_delete_company', { id: String(id) });
  return !!(res && res.success);
}

// ----------------------------------------------------------------------------
// STORES (stores + branch aliases on the server)
// ----------------------------------------------------------------------------
export async function v2ListStores(companyId?: string | number): Promise<Store[]> {
  const res = await v2Post<V2ListResponse<Store>>('v2_list_stores', companyKey(companyId));
  return res && Array.isArray(res.list) ? res.list : [];
}

export async function v2UpsertStore(entity: Store, companyId?: string | number): Promise<boolean> {
  const res = await v2Post<V2WriteResponse>('v2_upsert_store', {
    entity,
    ...companyKey(companyId ?? (entity.company_id ?? entity.companyId))
  });
  return !!(res && res.success);
}

export async function v2DeleteStore(id: string | number, companyId?: string | number): Promise<boolean> {
  const res = await v2Post<V2WriteResponse>('v2_delete_store', {
    id: String(id),
    ...companyKey(companyId)
  });
  return !!(res && res.success);
}

// ----------------------------------------------------------------------------
// BRANCHES (server: store rows whose branch_id === own id; list is MySQL-first)
// ----------------------------------------------------------------------------
export async function v2ListBranches(companyId?: string | number): Promise<Store[]> {
  const res = await v2Post<V2ListResponse<Store>>('v2_list_branches', companyKey(companyId));
  return res && Array.isArray(res.list) ? res.list : [];
}

export async function v2UpsertBranch(entity: Store, companyId?: string | number): Promise<boolean> {
  const branchShape = { ...entity, branch_id: entity.id, branchId: entity.id } as Store;
  const res = await v2Post<V2WriteResponse>('v2_upsert_store', {
    entity: branchShape,
    ...companyKey(companyId ?? branchShape.company_id ?? branchShape.companyId)
  });
  return !!(res && res.success);
}

export async function v2DeleteBranch(id: string | number, companyId?: string | number): Promise<boolean> {
  return v2DeleteStore(id, companyId);
}

// ----------------------------------------------------------------------------
// PRODUCTS
// ----------------------------------------------------------------------------
export async function v2ListProducts(companyId: string | number, opts?: { storeId?: string | number; since?: number }): Promise<Product[]> {
  const res = await v2Post<V2ListResponse<Product>>('v2_list_products', {
    ...companyKey(companyId),
    ...(opts?.storeId != null ? { store_id: String(opts.storeId) } : {}),
    ...(opts?.since ? { since: opts.since } : {})
  });
  return res && Array.isArray(res.list) ? res.list : [];
}

export async function v2UpsertProduct(entity: Product, companyId?: string | number): Promise<boolean> {
  const cid = companyId ?? (entity.company_id ?? entity.companyId);
  const res = await v2Post<V2WriteResponse>('v2_upsert_product', {
    entity,
    ...companyKey(cid)
  });
  return !!(res && res.success);
}

export async function v2DeleteProduct(id: string | number, companyId: string | number): Promise<boolean> {
  const res = await v2Post<V2WriteResponse>('v2_delete_product', {
    id: String(id),
    ...companyKey(companyId)
  });
  return !!(res && res.success);
}

// ----------------------------------------------------------------------------
// CATEGORIES (server returns "co_<companyId>:<name>" string keys)
// ----------------------------------------------------------------------------
export async function v2ListCategories(companyId?: string | number): Promise<Category[]> {
  const res = await v2Post<V2ListResponse<string>>('v2_list_categories', companyKey(companyId));
  if (!res || !Array.isArray(res.list)) return [];
  return res.list
    .filter((c): c is string => typeof c === 'string' && c.trim() !== '')
    .map((key) => {
      // BUILD 2026-09-08-18: company ids are STRING UUIDs — parseInt mints NaN. Keep the
      // raw string from the "co_<id>:<name>" prefix so Category.companyId is the actual
      // company the category belongs to (used for ranking + scoping).
      const m = /^co_([^:]+):(.+)$/s.exec(key.trim());
      return m
        ? { key, companyId: sv(m[1]) || '1', name: m[2] }
        : { key, companyId: sv(companyId) || '1', name: key.trim() };
    });
}

export async function v2UpsertCategory(companyId: string | number, name: string, color?: string): Promise<boolean> {
  const res = await v2Post<V2WriteResponse>('v2_upsert_category', {
    name,
    ...companyKey(companyId),
    ...(color ? { color } : {})
  });
  return !!(res && res.success);
}

export async function v2DeleteCategory(companyId: string | number, name: string): Promise<boolean> {
  const res = await v2Post<V2WriteResponse>('v2_delete_category', {
    name,
    ...companyKey(companyId)
  });
  return !!(res && res.success);
}

// ----------------------------------------------------------------------------
// USER ACCOUNTS
// ----------------------------------------------------------------------------
export async function v2ListUserAccounts(companyId?: string | number): Promise<UserAccount[]> {
  const res = await v2Post<V2ListResponse<UserAccount>>('v2_list_user_accounts', companyKey(companyId));
  return res && Array.isArray(res.list) ? res.list : [];
}

export async function v2UpsertUserAccount(entity: UserAccount, companyId?: string | number): Promise<boolean> {
  const cid = companyId ?? (entity.company_id ?? entity.companyId);
  const res = await v2Post<V2WriteResponse>('v2_upsert_user_account', {
    entity,
    ...companyKey(cid)
  });
  return !!(res && res.success);
}

export async function v2DeleteUserAccount(id: string | number, companyId?: string | number): Promise<boolean> {
  const res = await v2Post<V2WriteResponse>('v2_delete_user_account', {
    id: String(id),
    ...companyKey(companyId)
  });
  return !!(res && res.success);
}

// ----------------------------------------------------------------------------
// AUDIT
// ----------------------------------------------------------------------------
export async function v2GetAuditTrails(companyId?: string | number, opts?: { limit?: number }): Promise<AuditRecord[]> {
  const res = await v2Post<V2ListResponse<AuditRecord>>('v2_get_audit_trails', {
    ...companyKey(companyId),
    ...(opts?.limit ? { limit: Math.max(1, Math.min(500, opts.limit)) } : {})
  });
  return res && Array.isArray(res.list) ? res.list : [];
}

// ----------------------------------------------------------------------------
// BATCH: assemble the whole company state from v2 reads in parallel.
// Returns null on total failure so the caller can fall back to the classic
// snapshot path — no partial state is ever trusted as authoritative.
// ----------------------------------------------------------------------------
export interface V2CompanyState {
  companies: Company[];
  stores: Store[];
  products: Product[];
  categories: Category[];
  users: UserAccount[];
}

export async function v2FetchCompanyState(companyId: string | number): Promise<V2CompanyState | null> {
  // BUILD 2026-09-08-18: never assemble state for a degenerate scope. companyID=NaN
  // produced a "null" state that the caller treated as authoritative and REPLACED the
  // local workspace with an empty one (categories/stock stripped, branches gone).
  const scope = sv(companyId);
  if (scope === '' || scope.toLowerCase() === 'all') {
    // Global scope: nothing per-row here is meaningful; signal "no scoped state".
    return null;
  }
  if (!isValidCompanyScope(scope)) {
    console.warn('[PBS v2] v2FetchCompanyState cancelled — invalid company scope "' + scope + '"');
    return null;
  }
  try {
    const [companies, stores, products, categories, users] = await Promise.all([
      v2ListCompanies(),
      v2ListStores(companyId),
      v2ListProducts(companyId),
      v2ListCategories(companyId),
      v2ListUserAccounts(companyId)
    ]);
    // If EVERY list came back empty, either the DB is fresh (nothing backfilled
    // yet) or the v2 endpoint is unreachable — refuse to fake an empty state.
    if (companies.length === 0 && stores.length === 0 && products.length === 0 && categories.length === 0 && users.length === 0) {
      return null;
    }
    return { companies, stores, products, categories, users };
  } catch (error) {
    console.warn('[PBS v2] v2FetchCompanyState failed:', error);
    return null;
  }
}