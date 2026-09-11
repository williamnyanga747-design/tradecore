/**
 * entityPersistence.ts — Atomic CRUD for all new entity tables.
 *
 * Follows the same pattern as normalizedPersistence.ts but covers:
 *   expenses | suppliers | purchase_orders | customers | company_settings |
 *   tax_rules | flash_sales | stories | disputes | dispute_messages |
 *   product_returns | chat_conversations | chat_messages | escrow_transactions |
 *   visual_searches | installment_plans | installment_orders | installment_payments
 *
 * Design rules (same as normalizedPersistence.ts):
 *   - Every write is a single targeted round-trip to MySQL.
 *   - No localStorage/IndexedDB caching — source of truth is the database.
 *   - Fresh AbortController per call — outer signal never kills an in-flight save.
 *   - Operator identity forwarded for auth.
 */
import {
  getPhpConfig,
  getOperatorHeaders,
  buildSessionToken,
  discoverApiUrl
} from './api';

// ---------------------------------------------------------------------------
// Internal transport (identical to normalizedPersistence.ts)
// ---------------------------------------------------------------------------
let _apiUrl: string | null = null;
let _resolving: Promise<string | null> | null = null;

async function apiUrl(): Promise<string> {
  if (_apiUrl) return _apiUrl;
  const { apiUrl: cfg } = getPhpConfig();
  if (cfg && !cfg.endsWith('/api.php')) return (_apiUrl = cfg);
  if (!_resolving) {
    _resolving = discoverApiUrl().then((f) => { _apiUrl = f; return f; }).finally(() => { _resolving = null; });
  }
  const found = await _resolving;
  return found || cfg || '/cpanel/api.php';
}

async function post<T>(action: string, payload: Record<string, unknown>): Promise<T | null> {
  try {
    const url = await apiUrl();
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    const { apiKey } = getPhpConfig();
    if (apiKey) headers['X-API-Key'] = apiKey;
    Object.assign(headers, getOperatorHeaders());
    const token = buildSessionToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 15000);
    try {
      const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ action, ...payload }), signal: ctrl.signal });
      if (!r.ok) return null;
      return JSON.parse(await r.text()) as T;
    } finally { clearTimeout(tid); }
  } catch (e) { console.warn(`[entity] POST ${action} failed`, e); return null; }
}

function ck(cid: string | number | undefined): Record<string, unknown> {
  return { company_id: String(cid ?? '') };
}

// BUILD 2026-09-08-19 (Required Fix 3): every delete carries the owning company scope
// so the backend soft-delete is scoped + audited to the right company (multi-company
// rows can never collide on the numeric id) and root_mandate impersonation deletes
// land on the intended tenant.
async function deleteByKey<T>(
  action: string,
  id: string | number,
  companyId?: string | number
): Promise<boolean> {
  const r = await post<WriteRes>(action, {
    id: String(id),
    ...ck(companyId != null ? companyId : undefined)
  });
  return !!r?.success;
}

interface ListRes<T> { success: boolean; list?: T[]; count?: number; server_ts?: number; error?: string; }
interface WriteRes { success: boolean; id?: string; server_ts?: number; error?: string; }

// ============================================================================
// EXPENSES
// ============================================================================
export interface Expense {
  id: string; company_id: string; store_id?: string; category: string; description?: string;
  amount: number; currency_code?: string; amount_tzs: number; date: number;
  receipt_image?: string; payment_method?: string; reference?: string;
  approved_by?: string; status?: string; created_at?: number; updated_at?: number; deleted_at?: number;
  [k: string]: unknown;
}

export async function listExpenses(companyId: string | number): Promise<Expense[]> {
  const r = await post<ListRes<Expense>>('v2_list_expenses', ck(companyId));
  return r?.list ?? [];
}
export async function upsertExpense(e: Expense, companyId?: string | number): Promise<boolean> {
  const r = await post<WriteRes>('v2_upsert_expense', { entity: e, ...ck(companyId ?? e.company_id) });
  return !!r?.success;
}
export async function deleteExpense(id: string | number, companyId?: string | number): Promise<boolean> {
  return deleteByKey('v2_delete_expense', id, companyId);
}

// ============================================================================
// SUPPLIERS
// ============================================================================
export interface Supplier {
  id: string; company_id: string; name: string; phone?: string; email?: string;
  address?: string; city?: string; contact_person?: string; tax_id?: string;
  notes?: string; is_active?: number; created_at?: number; updated_at?: number; deleted_at?: number;
  [k: string]: unknown;
}

export async function listSuppliers(companyId: string | number): Promise<Supplier[]> {
  const r = await post<ListRes<Supplier>>('v2_list_suppliers', ck(companyId));
  return r?.list ?? [];
}
export async function upsertSupplier(e: Supplier, companyId?: string | number): Promise<boolean> {
  const r = await post<WriteRes>('v2_upsert_supplier', { entity: e, ...ck(companyId ?? e.company_id) });
  return !!r?.success;
}
export async function deleteSupplier(id: string | number, companyId?: string | number): Promise<boolean> {
  return deleteByKey('v2_delete_supplier', id, companyId);
}

// ============================================================================
// PURCHASE ORDERS
// ============================================================================
export interface PurchaseOrder {
  id: string; company_id: string; store_id?: string; supplier_id?: string;
  supplier_name?: string; order_number: string; status?: string;
  items: Array<{ productId: string; name: string; qty: number; costPrice: number; total: number }>;
  subtotal: number; tax_amount?: number; total: number; currency_code?: string;
  notes?: string; expected_date?: number; received_date?: number; received_by?: string;
  created_at?: number; updated_at?: number; deleted_at?: number;
  [k: string]: unknown;
}

export async function listPurchaseOrders(companyId: string | number): Promise<PurchaseOrder[]> {
  const r = await post<ListRes<PurchaseOrder>>('v2_list_purchase_orders', ck(companyId));
  return r?.list ?? [];
}
export async function upsertPurchaseOrder(e: PurchaseOrder, companyId?: string | number): Promise<boolean> {
  const r = await post<WriteRes>('v2_upsert_purchase_order', { entity: e, ...ck(companyId ?? e.company_id) });
  return !!r?.success;
}
export async function deletePurchaseOrder(id: string | number, companyId?: string | number): Promise<boolean> {
  return deleteByKey('v2_delete_purchase_order', id, companyId);
}

// ============================================================================
// CUSTOMERS
// ============================================================================
export interface Customer {
  id: string; company_id: string; name: string; phone?: string; email?: string;
  address?: string; city?: string; tax_id?: string; loyalty_points?: number;
  total_spent?: number; notes?: string; is_active?: number;
  created_at?: number; updated_at?: number; deleted_at?: number;
  [k: string]: unknown;
}

export async function listCustomers(companyId: string | number): Promise<Customer[]> {
  const r = await post<ListRes<Customer>>('v2_list_customers', ck(companyId));
  return r?.list ?? [];
}
export async function upsertCustomer(e: Customer, companyId?: string | number): Promise<boolean> {
  const r = await post<WriteRes>('v2_upsert_customer', { entity: e, ...ck(companyId ?? e.company_id) });
  return !!r?.success;
}
export async function deleteCustomer(id: string | number, companyId?: string | number): Promise<boolean> {
  return deleteByKey('v2_delete_customer', id, companyId);
}

// ============================================================================
// COMPANY SETTINGS
// ============================================================================
export interface CompanySettings {
  id?: string; company_id: string; currency_code?: string; currency_symbol?: string;
  exchange_rate?: number; tax_enabled?: number; tax_rate?: number;
  receipt_header?: string; receipt_footer?: string; low_stock_threshold?: number;
  pos_enabled?: number; marketplace_enabled?: number; loyalty_enabled?: number;
  sms_notifications?: number; extra_json?: Record<string, unknown>;
  created_at?: number; updated_at?: number;
  [k: string]: unknown;
}

export async function getCompanySettings(companyId: string | number): Promise<CompanySettings | null> {
  const r = await post<{ success: boolean; settings?: CompanySettings }>('v2_get_company_settings', ck(companyId));
  return r?.settings ?? null;
}
export async function upsertCompanySettings(e: CompanySettings, companyId?: string | number): Promise<boolean> {
  const r = await post<WriteRes>('v2_upsert_company_settings', { entity: e, ...ck(companyId ?? e.company_id) });
  return !!r?.success;
}

// ============================================================================
// TAX RULES
// ============================================================================
export interface TaxRule {
  id: string; company_id: string; name: string; rate: number;
  type?: string; applies_to?: string; is_active?: number;
  created_at?: number; updated_at?: number; deleted_at?: number;
  [k: string]: unknown;
}

export async function listTaxRules(companyId: string | number): Promise<TaxRule[]> {
  const r = await post<ListRes<TaxRule>>('v2_list_tax_rules', ck(companyId));
  return r?.list ?? [];
}
export async function upsertTaxRule(e: TaxRule, companyId?: string | number): Promise<boolean> {
  const r = await post<WriteRes>('v2_upsert_tax_rule', { entity: e, ...ck(companyId ?? e.company_id) });
  return !!r?.success;
}
export async function deleteTaxRule(id: string | number, companyId?: string | number): Promise<boolean> {
  return deleteByKey('v2_delete_tax_rule', id, companyId);
}

// ============================================================================
// FLASH SALES
// ============================================================================
export interface FlashSale {
  id: string; company_id: string; product_id: string; original_price: number;
  flash_price: number; stock_limit?: number; stock_sold?: number;
  starts_at: number; ends_at: number; status?: string;
  created_at?: number; updated_at?: number; deleted_at?: number;
  [k: string]: unknown;
}

export async function listFlashSales(companyId: string | number): Promise<FlashSale[]> {
  const r = await post<ListRes<FlashSale>>('v2_list_flash_sales', ck(companyId));
  return r?.list ?? [];
}
export async function upsertFlashSale(e: FlashSale, companyId?: string | number): Promise<boolean> {
  const r = await post<WriteRes>('v2_upsert_flash_sale', { entity: e, ...ck(companyId ?? e.company_id) });
  return !!r?.success;
}
export async function deleteFlashSale(id: string | number, companyId?: string | number): Promise<boolean> {
  return deleteByKey('v2_delete_flash_sale', id, companyId);
}

// ============================================================================
// STORIES
// ============================================================================
export interface Story {
  id: string; company_id: string; product_id?: string; media_url: string;
  caption?: string; views_count?: number; expires_at: number;
  created_at?: number; deleted_at?: number;
  [k: string]: unknown;
}

export async function listStories(companyId: string | number): Promise<Story[]> {
  const r = await post<ListRes<Story>>('v2_list_stories', ck(companyId));
  return r?.list ?? [];
}
export async function upsertStory(e: Story, companyId?: string | number): Promise<boolean> {
  const r = await post<WriteRes>('v2_upsert_story', { entity: e, ...ck(companyId ?? e.company_id) });
  return !!r?.success;
}
export async function deleteStory(id: string | number, companyId?: string | number): Promise<boolean> {
  return deleteByKey('v2_delete_story', id, companyId);
}

// ============================================================================
// DISPUTES
// ============================================================================
export interface Dispute {
  id: string; company_id: string; order_id: string; raised_by: string;
  reason: string; description?: string; status?: string; resolution?: string;
  resolved_by?: string; created_at?: number; updated_at?: number; deleted_at?: number;
  [k: string]: unknown;
}

export async function listDisputes(companyId: string | number): Promise<Dispute[]> {
  const r = await post<ListRes<Dispute>>('v2_list_disputes', ck(companyId));
  return r?.list ?? [];
}
export async function upsertDispute(e: Dispute, companyId?: string | number): Promise<boolean> {
  const r = await post<WriteRes>('v2_upsert_dispute', { entity: e, ...ck(companyId ?? e.company_id) });
  return !!r?.success;
}
export async function deleteDispute(id: string | number, companyId?: string | number): Promise<boolean> {
  return deleteByKey('v2_delete_dispute', id, companyId);
}

// ============================================================================
// DISPUTE MESSAGES
// ============================================================================
export interface DisputeMessage {
  id: string; dispute_id: string; sender: string; sender_role?: string;
  message: string; created_at?: number;
  [k: string]: unknown;
}

export async function listDisputeMessages(disputeId: string | number): Promise<DisputeMessage[]> {
  const r = await post<ListRes<DisputeMessage>>('v2_list_dispute_messages', { dispute_id: String(disputeId) });
  return r?.list ?? [];
}
export async function upsertDisputeMessage(e: DisputeMessage): Promise<boolean> {
  const r = await post<WriteRes>('v2_upsert_dispute_message', { entity: e });
  return !!r?.success;
}

// ============================================================================
// PRODUCT RETURNS
// ============================================================================
export interface ProductReturn {
  id: string; company_id: string; order_id: string; product_id: string;
  customer_name: string; reason: string; status?: string; refund_amount?: number;
  admin_note?: string; created_at?: number; updated_at?: number; deleted_at?: number;
  [k: string]: unknown;
}

export async function listProductReturns(companyId: string | number): Promise<ProductReturn[]> {
  const r = await post<ListRes<ProductReturn>>('v2_list_product_returns', ck(companyId));
  return r?.list ?? [];
}
export async function upsertProductReturn(e: ProductReturn, companyId?: string | number): Promise<boolean> {
  const r = await post<WriteRes>('v2_upsert_product_return', { entity: e, ...ck(companyId ?? e.company_id) });
  return !!r?.success;
}
export async function deleteProductReturn(id: string | number, companyId?: string | number): Promise<boolean> {
  return deleteByKey('v2_delete_product_return', id, companyId);
}

// ============================================================================
// CHAT CONVERSATIONS
// ============================================================================
export interface ChatConversation {
  id: string; company_id: string; customer_name: string; customer_phone?: string;
  last_message?: string; last_message_at?: number; unread_count?: number; status?: string;
  created_at?: number; updated_at?: number;
  [k: string]: unknown;
}

export async function listChatConversations(companyId: string | number): Promise<ChatConversation[]> {
  const r = await post<ListRes<ChatConversation>>('v2_list_chat_conversations', ck(companyId));
  return r?.list ?? [];
}
export async function upsertChatConversation(e: ChatConversation, companyId?: string | number): Promise<boolean> {
  const r = await post<WriteRes>('v2_upsert_chat_conversation', { entity: e, ...ck(companyId ?? e.company_id) });
  return !!r?.success;
}
export async function deleteChatConversation(id: string | number, companyId?: string | number): Promise<boolean> {
  return deleteByKey('v2_delete_chat_conversation', id, companyId);
}

// ============================================================================
// CHAT MESSAGES
// ============================================================================
export interface ChatMessageRecord {
  id: string; conversation_id: string; sender: string; sender_role: string;
  message: string; is_read?: number; created_at?: number;
  [k: string]: unknown;
}

export async function listChatMessages(conversationId: string | number): Promise<ChatMessageRecord[]> {
  const r = await post<ListRes<ChatMessageRecord>>('v2_list_chat_messages', { conversation_id: String(conversationId) });
  return r?.list ?? [];
}
export async function upsertChatMessage(e: ChatMessageRecord): Promise<boolean> {
  const r = await post<WriteRes>('v2_upsert_chat_message', { entity: e });
  return !!r?.success;
}

// ============================================================================
// ESCROW TRANSACTIONS
// ============================================================================
export interface EscrowTransaction {
  id: string; company_id: string; order_id: string; buyer_id?: string;
  seller_id?: string; amount: number; status?: string; released_at?: number;
  created_at?: number; updated_at?: number;
  [k: string]: unknown;
}

export async function listEscrowTransactions(companyId: string | number): Promise<EscrowTransaction[]> {
  const r = await post<ListRes<EscrowTransaction>>('v2_list_escrow_transactions', ck(companyId));
  return r?.list ?? [];
}
export async function upsertEscrowTransaction(e: EscrowTransaction, companyId?: string | number): Promise<boolean> {
  const r = await post<WriteRes>('v2_upsert_escrow_transaction', { entity: e, ...ck(companyId ?? e.company_id) });
  return !!r?.success;
}

// ============================================================================
// VISUAL SEARCHES
// ============================================================================
export interface VisualSearch {
  id: string; company_id: string; user_id?: string; image_url: string;
  results?: unknown; created_at?: number;
  [k: string]: unknown;
}

export async function listVisualSearches(companyId: string | number): Promise<VisualSearch[]> {
  const r = await post<ListRes<VisualSearch>>('v2_list_visual_searches', ck(companyId));
  return r?.list ?? [];
}
export async function upsertVisualSearch(e: VisualSearch, companyId?: string | number): Promise<boolean> {
  const r = await post<WriteRes>('v2_upsert_visual_search', { entity: e, ...ck(companyId ?? e.company_id) });
  return !!r?.success;
}

// ============================================================================
// INSTALLMENT PLANS
// ============================================================================
export interface InstallmentPlan {
  id: string; product_id: string; company_id: string; total_price: number;
  down_payment_percent: number; installments_count: number;
  installment_percent_extra?: number; status?: string;
  created_at?: number;
  [k: string]: unknown;
}

export async function listInstallmentPlans(companyId: string | number): Promise<InstallmentPlan[]> {
  const r = await post<ListRes<InstallmentPlan>>('v2_list_installment_plans', ck(companyId));
  return r?.list ?? [];
}
export async function upsertInstallmentPlan(e: InstallmentPlan, companyId?: string | number): Promise<boolean> {
  const r = await post<WriteRes>('v2_upsert_installment_plan', { entity: e, ...ck(companyId ?? e.company_id) });
  return !!r?.success;
}
export async function deleteInstallmentPlan(id: string | number, companyId?: string | number): Promise<boolean> {
  return deleteByKey('v2_delete_installment_plan', id, companyId);
}

// ============================================================================
// INSTALLMENT ORDERS
// ============================================================================
export interface InstallmentOrder {
  id: string; product_id: string; company_id: string; installment_plan_id: string;
  customer_name: string; customer_phone: string; total_price: number;
  down_payment: number; remaining: number; installment_amount: number;
  installments_count: number; paid_installments?: number; total_paid?: number;
  status?: string; next_due_date?: number; tracking_code: string; order_id?: string;
  created_at?: number;
  [k: string]: unknown;
}

export async function listInstallmentOrders(companyId: string | number): Promise<InstallmentOrder[]> {
  const r = await post<ListRes<InstallmentOrder>>('v2_list_installment_orders', ck(companyId));
  return r?.list ?? [];
}
export async function upsertInstallmentOrder(e: InstallmentOrder, companyId?: string | number): Promise<boolean> {
  const r = await post<WriteRes>('v2_upsert_installment_order', { entity: e, ...ck(companyId ?? e.company_id) });
  return !!r?.success;
}

// ============================================================================
// INSTALLMENT PAYMENTS
// ============================================================================
export interface InstallmentPayment {
  id: string; installment_order_id: string; amount: number; type: string;
  status?: string; reference?: string; collection_id?: string;
  due_date?: number; paid_at?: number; created_at?: number;
  [k: string]: unknown;
}

export async function listInstallmentPayments(orderId: string | number): Promise<InstallmentPayment[]> {
  const r = await post<ListRes<InstallmentPayment>>('v2_list_installment_payments', { installment_order_id: String(orderId) });
  return r?.list ?? [];
}
export async function upsertInstallmentPayment(e: InstallmentPayment): Promise<boolean> {
  const r = await post<WriteRes>('v2_upsert_installment_payment', { entity: e });
  return !!r?.success;
}
