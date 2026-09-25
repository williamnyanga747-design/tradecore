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
import { queueMutations } from './offlinePersistence';
import type { Sponsor } from '../types';

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
      .catch(() => null)
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
 * operator + bearer headers, 30s timeout, outer-signal ignore (writes must finish).
 */
async function v2Post<T>(action: string, payload: Record<string, unknown>): Promise<T | null> {
  const isDiagAction = action === 'v2_upsert_store' || action === 'v2_delete_store' || action === 'v2_list_stores' || action === 'v2_list_branches' || action === 'v2_upsert_category' || action === 'v2_delete_category' || action === 'v2_list_categories' || action === 'v2_upsert_company' || action === 'v2_delete_company';
  if (isDiagAction) console.log('[DIAG-v2Post] → ' + action + ' payload_keys=' + Object.keys(payload).join(',') + ' company_id=' + (payload.company_id ?? ''));
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
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action, ...payload }),
        signal: controller.signal
      });
      const respText = await response.text();
      if (isDiagAction) console.log('[DIAG-v2Post] ← ' + action + ' status=' + response.status + ' body=' + respText.substring(0, 500));
      if (!response.ok) { if (isDiagAction) console.warn('[DIAG-v2Post] ' + action + ' NON-OK status=' + response.status); return null; }
      try {
        return JSON.parse(respText) as T;
      } catch (e) {
        if (isDiagAction) console.warn('[DIAG-v2Post] ' + action + ' JSON parse error');
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

/**
 * Executes a v2 write mutation immediately if online, or queues it to the
 * persistent offline sync_queue (IndexedDB) if offline or if network fails.
 */
async function postOrQueue<T extends { success?: boolean; id?: string; error?: string }>(
  table: string,
  op: 'upsert' | 'delete',
  id: string | number,
  action: string,
  payload: Record<string, unknown>,
  data?: any,
  companyId?: string | number
): Promise<T | null> {
  const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (isOffline) {
    queueMutations([{
      op,
      table,
      id: String(id),
      data: op === 'delete' ? null : (data ?? payload.entity ?? payload),
      companyId: companyId ? String(companyId) : undefined,
      timestamp: Date.now()
    }]);
    return { success: true, id: String(id) } as unknown as T;
  }

  const res = await v2Post<T>(action, payload);
  if (!res || !(res as any).success) {
    // If request failed (network error / timeout / server unreachable)
    queueMutations([{
      op,
      table,
      id: String(id),
      data: op === 'delete' ? null : (data ?? payload.entity ?? payload),
      companyId: companyId ? String(companyId) : undefined,
      timestamp: Date.now()
    }]);
    return { success: true, id: String(id) } as unknown as T;
  }
  return res;
}

// ----------------------------------------------------------------------------
// COMPANIES
// ----------------------------------------------------------------------------
export async function v2ListCompanies(): Promise<Company[]> {
  const res = await v2Post<V2ListResponse<Company>>('v2_list_companies', {});
  return res && Array.isArray(res.list) ? res.list : [];
}

export async function v2UpsertCompany(entity: Company): Promise<boolean> {
  const res = await postOrQueue<V2WriteResponse>(
    'companies',
    'upsert',
    entity.id,
    'v2_upsert_company',
    { entity },
    entity
  );
  return !!(res && res.success);
}

/** Detailed variant — returns the raw server response (with error message) for diagnostics. */
export async function v2UpsertCompanyDetailed(entity: Company): Promise<V2WriteResponse | null> {
  return postOrQueue<V2WriteResponse>(
    'companies',
    'upsert',
    entity.id,
    'v2_upsert_company',
    { entity },
    entity
  );
}

export async function v2DeleteCompany(id: string | number): Promise<boolean> {
  const res = await postOrQueue<V2WriteResponse>(
    'companies',
    'delete',
    id,
    'v2_delete_company',
    { id: String(id) }
  );
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
  const cid = companyId ?? (entity.company_id ?? entity.companyId);
  const res = await postOrQueue<V2WriteResponse>(
    'stores',
    'upsert',
    entity.id,
    'v2_upsert_store',
    {
      entity,
      ...companyKey(cid)
    },
    entity,
    cid
  );
  return !!(res && res.success);
}

export async function v2DeleteStore(id: string | number, companyId?: string | number): Promise<boolean> {
  const res = await postOrQueue<V2WriteResponse>(
    'stores',
    'delete',
    id,
    'v2_delete_store',
    {
      id: String(id),
      ...companyKey(companyId)
    },
    null,
    companyId
  );
  return !!(res && res.success);
}

// ----------------------------------------------------------------------------
// BRANCHES (dedicated v2_upsert_branch / v2_delete_branch / v2_list_branches)
// ----------------------------------------------------------------------------
export async function v2ListBranches(companyId?: string | number): Promise<Store[]> {
  const res = await v2Post<V2ListResponse<Store>>('v2_list_branches', companyKey(companyId));
  return res && Array.isArray(res.list) ? res.list : [];
}

export async function v2UpsertBranch(entity: any, companyId?: string | number): Promise<boolean> {
  const cid = companyId ?? entity.company_id ?? entity.companyId;
  const res = await postOrQueue<V2WriteResponse>(
    'branches',
    'upsert',
    entity.id,
    'v2_upsert_branch',
    {
      entity,
      branch: entity,
      ...companyKey(cid)
    },
    entity,
    cid
  );
  return !!(res && res.success);
}

export async function v2DeleteBranch(id: string | number, companyId?: string | number): Promise<boolean> {
  const res = await postOrQueue<V2WriteResponse>(
    'branches',
    'delete',
    id,
    'v2_delete_branch',
    {
      id: String(id),
      ...companyKey(companyId)
    },
    null,
    companyId
  );
  return !!(res && res.success);
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
  const res = await postOrQueue<V2WriteResponse>(
    'marketplaceProducts',
    'upsert',
    entity.id,
    'v2_upsert_product',
    {
      entity,
      ...companyKey(cid)
    },
    entity,
    cid
  );
  return !!(res && res.success);
}

export async function v2DeleteProduct(id: string | number, companyId: string | number): Promise<boolean> {
  const res = await postOrQueue<V2WriteResponse>(
    'marketplaceProducts',
    'delete',
    id,
    'v2_delete_product',
    {
      id: String(id),
      ...companyKey(companyId)
    },
    null,
    companyId
  );
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
      const trimmed = typeof key === 'string' ? key.trim() : '';
      if (trimmed === '') return { key: String(key ?? ''), companyId: sv(companyId) || '1', name: String(key ?? '') };
      const m = /^co_([^:]+):(.+)$/s.exec(trimmed);
      return m
        ? { key: trimmed, companyId: sv(m[1]) || '1', name: m[2] }
        : { key: trimmed, companyId: sv(companyId) || '1', name: trimmed };
    });
}

export async function v2UpsertCategory(companyId: string | number, name: string, color?: string, storeId?: string | number | null): Promise<boolean> {
  const stId = sv(storeId);
  const key = stId ? `co_${companyId}:st_${stId}:${name}` : `co_${companyId}:${name}`;
  const res = await postOrQueue<V2WriteResponse>(
    'categories',
    'upsert',
    key,
    'v2_upsert_category',
    {
      name,
      ...companyKey(companyId),
      ...(stId ? { store_id: stId } : {}),
      ...(color ? { color } : {})
    },
    { name, company_id: String(companyId), store_id: stId, color },
    companyId
  );
  return !!(res && res.success);
}

export async function v2DeleteCategory(companyId: string | number, name: string, storeId?: string | number | null): Promise<boolean> {
  const stId = sv(storeId);
  const key = stId ? `co_${companyId}:st_${stId}:${name}` : `co_${companyId}:${name}`;
  const res = await postOrQueue<V2WriteResponse>(
    'categories',
    'delete',
    key,
    'v2_delete_category',
    {
      name,
      ...companyKey(companyId),
      ...(stId ? { store_id: stId } : {})
    },
    null,
    companyId
  );
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
  const res = await postOrQueue<V2WriteResponse>(
    'users',
    'upsert',
    entity.id,
    'v2_upsert_user_account',
    {
      entity,
      ...companyKey(cid)
    },
    entity,
    cid
  );
  return !!(res && res.success);
}

export async function v2DeleteUserAccount(id: string | number, companyId?: string | number): Promise<boolean> {
  const res = await postOrQueue<V2WriteResponse>(
    'users',
    'delete',
    id,
    'v2_delete_user_account',
    {
      id: String(id),
      ...companyKey(companyId)
    },
    null,
    companyId
  );
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
  branches: Store[];
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
    const [companies, branches, stores, products, categories, users] = await Promise.all([
      v2ListCompanies(),
      v2ListBranches(companyId),
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
    return { companies, branches, stores, products, categories, users };
  } catch (error) {
    console.warn('[PBS v2] v2FetchCompanyState failed:', error);
    return null;
  }
}

// ----------------------------------------------------------------------------
// SPONSORS / WADHAMINI (Build 08-20 - Tanzaniatradecore.co.tz)
// ----------------------------------------------------------------------------
export async function v2ListSponsors(companyId?: string | number | null): Promise<Sponsor[]> {
  const payload: Record<string, unknown> = {};
  if (companyId) payload.company_id = sv(companyId);
  const resp = await v2Post<{ success: boolean; list?: Sponsor[]; data?: Sponsor[] }>('v2_list_sponsors', payload);
  return (resp?.list || resp?.data || []) as Sponsor[];
}

export async function v2UpsertSponsor(sponsor: Partial<Sponsor>): Promise<{ success: boolean; data?: Sponsor; error?: string; id?: string } | null> {
  const id = sponsor.id || sponsor.sponsor_id || `sp_${Date.now()}`;
  const payload: Record<string, unknown> = {
    ...sponsor,
    id,
    company_id: sponsor.company_id ? sv(sponsor.company_id) : null
  };
  const res = await postOrQueue<{ success: boolean; data?: Sponsor; error?: string; id?: string }>(
    'sponsors',
    'upsert',
    id,
    'v2_upsert_sponsor',
    { entity: payload },
    payload,
    sponsor.company_id ? sv(sponsor.company_id) : undefined
  );
  return res || { success: true, data: payload as unknown as Sponsor, id: String(id) };
}

export async function v2DeleteSponsor(id: string | number): Promise<boolean> {
  const res = await postOrQueue<{ success: boolean }>(
    'sponsors',
    'delete',
    id,
    'v2_delete_sponsor',
    { id: sv(id) },
    null
  );
  return !!res?.success;
}

export async function v2UploadSponsorLogo(dataBase64: string): Promise<string | null> {
  const resp = await v2Post<{ success: boolean; url?: string; logo_url?: string }>('v2_upload_sponsor_logo', { data_base64: dataBase64 });
  return resp?.url || resp?.logo_url || null;
}