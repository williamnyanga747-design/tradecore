import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
function getPort(): number {
  const portArgIdx = process.argv.indexOf("--port");
  if (portArgIdx !== -1 && process.argv[portArgIdx + 1]) {
    const p = parseInt(process.argv[portArgIdx + 1], 10);
    if (!isNaN(p)) return p;
  }
  return 3000;
}
const PORT = getPort();

app.use(express.json());

// Immediate health check endpoints so proxy health checks pass instantly
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), server_ts: Date.now() });
});
app.get("/healthz", (_req, res) => {
  res.send("OK");
});

let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required in secrets");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Mock/Proxy PHP Sync API Endpoint for local/container dev environment
let inMemoryPhpState: any = null;
let inMemorySponsors: any[] = [
  {
    id: 'sp_crdb_01',
    sponsor_id: 'sp_crdb_01',
    company_id: null,
    name: 'CRDB Bank Plc',
    logo_url: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=200&auto=format&fit=crop&q=60',
    website_url: 'https://crdbbank.co.tz',
    description: 'Benki kiongozi Tanzania inayowezesha wafanyabiashara wa ndani na wa kimataifa.',
    tier: 'platinum',
    is_active: 1,
    sort_order: 1,
    status: 'ACTIVE',
    created_at: 1726000000,
    updated_at: 1726000000,
    deleted_at: null
  },
  {
    id: 'sp_nmb_02',
    sponsor_id: 'sp_nmb_02',
    company_id: null,
    name: 'NMB Bank Plc',
    logo_url: 'https://images.unsplash.com/photo-1541354329998-f4d9a9f9297f?w=200&auto=format&fit=crop&q=60',
    website_url: 'https://nmbbank.co.tz',
    description: 'Karibu katika benki inayoaminika na mamilioni ya Watanzania kwa mikopo na malipo.',
    tier: 'gold',
    is_active: 1,
    sort_order: 2,
    status: 'ACTIVE',
    created_at: 1726000000,
    updated_at: 1726000000,
    deleted_at: null
  },
  {
    id: 'sp_vodacom_03',
    sponsor_id: 'sp_vodacom_03',
    company_id: null,
    name: 'Vodacom M-Pesa',
    logo_url: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=200&auto=format&fit=crop&q=60',
    website_url: 'https://vodacom.co.tz',
    description: 'Mfumo wa kidijitali wa malipo na miamala ya biashara nchini kote.',
    tier: 'gold',
    is_active: 1,
    sort_order: 3,
    status: 'ACTIVE',
    created_at: 1726000000,
    updated_at: 1726000000,
    deleted_at: null
  }
];

let inMemoryCompanies: any[] = [
  { id: 1, company_id: '1', name: "Alpha Global Retail Corp", logo_url: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=120&auto=format&fit=crop&q=60", logoUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=120&auto=format&fit=crop&q=60", subscriptionEnd: "2027-12-31", subscription_end: "2027-12-31", is_active: 1, status: 'active', country: "Tanzania", tin_number: "100-200-300", tinNumber: "100-200-300" },
  { id: 2, company_id: '2', name: "Beta Distributors Ltd", logo_url: "https://images.unsplash.com/photo-1542744094-3a31f103e35f?w=120&auto=format&fit=crop&q=60", logoUrl: "https://images.unsplash.com/photo-1542744094-3a31f103e35f?w=120&auto=format&fit=crop&q=60", subscriptionEnd: "2026-11-30", subscription_end: "2026-11-30", is_active: 1, status: 'active', country: "Tanzania", tin_number: "200-300-400", tinNumber: "200-300-400" },
  { id: 3, company_id: '3', name: "Apex Commercial Holdings", logo_url: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=120&auto=format&fit=crop&q=60", logoUrl: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=120&auto=format&fit=crop&q=60", subscriptionEnd: "2026-06-30", subscription_end: "2026-06-30", is_active: 1, status: 'active', country: "Tanzania", tin_number: "300-400-500", tinNumber: "300-400-500" }
];

let inMemoryBranches: any[] = [
  { id: 1, company_id: '1', companyId: '1', name: 'DSM HQ Main Branch', is_active: 1 },
  { id: 2, company_id: '1', companyId: '1', name: 'DSM Northern Hub', is_active: 1 },
  { id: 3, company_id: '2', companyId: '2', name: 'Beta Arusha Depot', is_active: 1 }
];

let inMemoryStores: any[] = [
  { id: 1, store_id: '1', branch_id: 1, branchId: 1, company_id: '1', companyId: '1', name: 'DSM Store Alpha', location: 'Downtown', phone: '+255 22 1234', is_active: 1 },
  { id: 2, store_id: '2', branch_id: 2, branchId: 2, company_id: '1', companyId: '1', name: 'DSM Store Beta', location: 'Uptown', phone: '+255 22 5678', is_active: 1 },
  { id: 3, store_id: '3', branch_id: 3, branchId: 3, company_id: '2', companyId: '2', name: 'Arusha Warehouse', location: 'Industrial Block', phone: '+255 27 9876', is_active: 1 }
];

let inMemoryCategories: string[] = [
  'co_1:Cereals', 'co_1:Oil', 'co_1:Household', 'co_1:Building', 'co_1:Electronics',
  'co_2:Cereals', 'co_2:Oil', 'co_2:Household', 'co_2:Building', 'co_2:Electronics',
  'co_3:Cereals', 'co_3:Oil', 'co_3:Household', 'co_3:Building', 'co_3:Electronics',
  'Cereals', 'Oil', 'Household', 'Building', 'Electronics'
];

let inMemoryUsers: any[] = [
  { id: 4, username: 'root_mandate', password: 'sha256$5811b73dea1a2b5991ab4a0e887b70604d3bf745716d66059884b2a0ff24ba46', role: 'Super Admin', name: 'Root Mandate', email: 'globaltradecore@gmail.com', companyId: null, branchId: null, storeId: null, firstLogin: true, status: 'Active', isRoot: true },
  { id: 5, username: 'superadmin', password: 'sha256$daa62f6fcc24de4977b4c73eb5cf2f78e56950e2e0c4de2316399a09a1139890', role: 'Super Admin', name: 'Global Super Admin', email: 'superadmin@tradecore.com', companyId: null, branchId: null, storeId: null, firstLogin: true, status: 'Active' },
  { id: 1, username: 'admin', password: 'sha256$afe1b7a51c5b5201f3c79f903de5a513172de6760d8ae3be64edf7959c14d3ec', role: 'Admin', name: 'Alpha Manager', email: 'admin@tradecore.com', companyId: 1, branchId: null, storeId: null, firstLogin: true, status: 'Active' },
  { id: 2, username: 'retailer', password: 'sha256$42f164df6191123a8a2d18507b2b54fe78782349aee758230557c95905a7a776', role: 'Retailer', name: 'Sarah Chen', email: 'retail@tradecore.com', companyId: 1, branchId: 1, storeId: 1, firstLogin: true, status: 'Active' },
  { id: 3, username: 'wholesaler', password: 'sha256$c56f4cad86de5e7c7656ae2e8a67a73994c0937dfe92360e4b4b773027917b0d', role: 'Wholesaler', name: 'Mike Wilson', email: 'wholesale@tradecore.com', companyId: 1, branchId: 2, storeId: 2, firstLogin: true, status: 'Active' }
];

const DB_FILE = path.join(process.cwd(), 'data', 'tradecore_server_state.json');

function loadStateFromDisk() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed.inMemoryPhpState) inMemoryPhpState = parsed.inMemoryPhpState;
      if (Array.isArray(parsed.inMemoryCompanies) && parsed.inMemoryCompanies.length) inMemoryCompanies = parsed.inMemoryCompanies;
      if (Array.isArray(parsed.inMemoryBranches) && parsed.inMemoryBranches.length) inMemoryBranches = parsed.inMemoryBranches;
      if (Array.isArray(parsed.inMemoryStores) && parsed.inMemoryStores.length) inMemoryStores = parsed.inMemoryStores;
      if (Array.isArray(parsed.inMemoryCategories) && parsed.inMemoryCategories.length) inMemoryCategories = parsed.inMemoryCategories;
      if (Array.isArray(parsed.inMemoryUsers) && parsed.inMemoryUsers.length) inMemoryUsers = parsed.inMemoryUsers;
      if (Array.isArray(parsed.inMemorySponsors) && parsed.inMemorySponsors.length) inMemorySponsors = parsed.inMemorySponsors;
      console.log('[server.ts] Loaded persisted state from disk successfully.');
    }
  } catch (e) {
    console.warn('[server.ts] Error reading state from disk:', e);
  }
}

function saveStateToDisk() {
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const payload = {
      inMemoryPhpState,
      inMemoryCompanies,
      inMemoryBranches,
      inMemoryStores,
      inMemoryCategories,
      inMemoryUsers,
      inMemorySponsors,
      savedAt: new Date().toISOString()
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[server.ts] Error saving state to disk:', e);
  }
}

// Initial load on server boot
loadStateFromDisk();

function archiveExpiredSponsors(): number {
  const now = Date.now();
  let count = 0;
  for (const s of inMemorySponsors) {
    if (!s.deleted_at && !s.is_archived && s.status !== 'EXPIRED' && s.status !== 'ARCHIVED' && s.end_date) {
      const endT = s.end_date.length === 10 ? new Date(`${s.end_date}T23:59:59`).getTime() : new Date(s.end_date).getTime();
      if (!isNaN(endT) && endT < now) {
        s.is_archived = 1;
        s.is_active = 0;
        s.status = 'EXPIRED';
        s.archived_at = now;
        s.updated_at = Math.floor(now / 1000);
        count++;
      }
    }
  }
  return count;
}

// Auto-run sponsor archive check every 30 seconds
setInterval(archiveExpiredSponsors, 30000);

let inMemoryStateVersion = 100;

const handlePhpApi = (req: express.Request, res: express.Response) => {
  const action = req.query.action || req.body?.action;
  const now = Math.floor(Date.now() / 1000);

  // Check and auto-archive expired sponsors before responding
  archiveExpiredSponsors();

  if (action === 'check_timestamp') {
    return res.json({
      success: true,
      status: 'ok',
      _assembled: 1,
      version: inMemoryStateVersion,
      server_ts: now,
      lastUpdated: new Date().toISOString()
    });
  }

  // v2_upsert_sponsor
  if (action === 'v2_upsert_sponsor') {
    const raw = req.body?.entity || req.body?.sponsor || req.body || {};
    const id = String(raw.id || raw.sponsor_id || `sp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
    const name = String(raw.name || '').trim();
    if (!name) {
      return res.json({ success: false, error: 'name required', server_ts: now, version: inMemoryStateVersion, _assembled: 1 });
    }
    const idx = inMemorySponsors.findIndex(s => s.id === id || s.sponsor_id === id);
    const existing = idx >= 0 ? inMemorySponsors[idx] : null;

    const endDate = raw.end_date || existing?.end_date || null;
    const startDate = raw.start_date || existing?.start_date || null;

    // Check if end_date has already passed
    let isExpired = false;
    if (endDate) {
      const endT = endDate.length === 10 ? new Date(`${endDate}T23:59:59`).getTime() : new Date(endDate).getTime();
      if (!isNaN(endT) && endT < Date.now()) {
        isExpired = true;
      }
    }

    const isArchived = (raw.is_archived === 1 || raw.is_archived === true || raw.status === 'EXPIRED' || raw.status === 'ARCHIVED' || isExpired) ? 1 : 0;
    const isActive = isArchived ? 0 : ((raw.is_active === 0 || raw.is_active === '0' || raw.is_active === false) ? 0 : 1);
    const status = isArchived ? (raw.status === 'ARCHIVED' ? 'ARCHIVED' : 'EXPIRED') : (isActive ? 'ACTIVE' : 'INACTIVE');

    const updatedSponsor = {
      id,
      sponsor_id: id,
      company_id: raw.company_id || null,
      name,
      logo_url: raw.logo_url || '',
      website_url: raw.website_url || '',
      description: raw.description || '',
      tier: (raw.tier || 'gold').toLowerCase(),
      is_active: isActive,
      sort_order: Number(raw.sort_order ?? 0),
      status,
      start_date: startDate,
      end_date: endDate,
      is_archived: isArchived,
      archived_at: isArchived ? (raw.archived_at || Date.now()) : null,
      created_at: existing?.created_at || now,
      updated_at: now,
      deleted_at: null
    };

    if (idx >= 0) {
      inMemorySponsors[idx] = updatedSponsor;
    } else {
      inMemorySponsors.push(updatedSponsor);
    }

    inMemoryStateVersion++;
    return res.json({
      success: true,
      data: updatedSponsor,
      id,
      server_ts: now,
      version: inMemoryStateVersion,
      server_version: inMemoryStateVersion,
      _assembled: 1
    });
  }

  // v2_delete_sponsor
  if (action === 'v2_delete_sponsor') {
    const raw = req.body?.entity || req.body?.sponsor || req.body || {};
    const id = String(raw.id || raw.sponsor_id || req.query.id || '');
    if (!id) {
      return res.json({ success: false, error: 'id required', server_ts: now, version: inMemoryStateVersion, _assembled: 1 });
    }
    const idx = inMemorySponsors.findIndex(s => s.id === id || s.sponsor_id === id);
    if (idx >= 0) {
      inMemorySponsors[idx].deleted_at = now;
      inMemorySponsors[idx].status = 'DELETED';
      inMemorySponsors[idx].is_active = 0;
    }
    inMemoryStateVersion++;
    return res.json({ success: true, id, server_ts: now, version: inMemoryStateVersion, server_version: inMemoryStateVersion, _assembled: 1 });
  }

  // v2_list_sponsors
  if (action === 'v2_list_sponsors' || action === 'v2_list_sponsor') {
    const cid = req.query.company_id || req.body?.company_id;
    let list = inMemorySponsors.filter(s => !s.deleted_at);
    if (cid) {
      list = list.filter(s => s.company_id === cid || s.company_id === null);
    }
    list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    return res.json({
      success: true,
      list,
      data: list,
      count: list.length,
      server_ts: now
    });
  }

  // v2_upload_sponsor_logo
  if (action === 'v2_upload_sponsor_logo') {
    const b64 = req.body?.data_base64 || req.body?.file_data || '';
    if (b64) {
      return res.json({
        success: true,
        url: b64,
        logo_url: b64,
        server_ts: now
      });
    }
    return res.json({
      success: true,
      url: '/cpanel/uploads/sponsors/default_sponsor.png',
      logo_url: '/cpanel/uploads/sponsors/default_sponsor.png',
      server_ts: now
    });
  }

  // --- MASTER DATA: COMPANIES ---
  if (action === 'v2_list_companies') {
    return res.json({
      success: true,
      list: inMemoryCompanies,
      data: inMemoryCompanies,
      count: inMemoryCompanies.length,
      server_ts: now
    });
  }

  if (action === 'v2_upsert_company') {
    const raw = req.body?.entity || req.body?.company || req.body || {};
    const id = raw.id !== undefined && raw.id !== null && raw.id !== '' ? raw.id : (raw.company_id || `co_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    const name = String(raw.name || '').trim();
    if (!name) {
      return res.json({ success: false, error: 'Company name is required', server_ts: now });
    }
    const idx = inMemoryCompanies.findIndex(c => String(c.id) === String(id) || String(c.company_id) === String(id));
    const existing = idx >= 0 ? inMemoryCompanies[idx] : {};
    const updatedCompany = {
      ...existing,
      ...raw,
      id,
      company_id: String(raw.company_id || id),
      name,
      tin_number: raw.tin_number ?? raw.tinNumber ?? existing.tin_number ?? '',
      tinNumber: raw.tin_number ?? raw.tinNumber ?? existing.tinNumber ?? '',
      theme_color: raw.theme_color ?? raw.themeColor ?? existing.theme_color ?? '#c41e3a',
      themeColor: raw.theme_color ?? raw.themeColor ?? existing.themeColor ?? '#c41e3a',
      subscription_end: raw.subscription_end ?? raw.subscriptionEnd ?? existing.subscription_end ?? '2027-12-31',
      subscriptionEnd: raw.subscription_end ?? raw.subscriptionEnd ?? existing.subscriptionEnd ?? '2027-12-31',
      subscriptionApproved: true,
      language: raw.language ?? existing.language ?? 'en',
      currency: raw.currency ?? existing.currency ?? 'USD',
      exchangeRate: raw.exchangeRate !== undefined ? Number(raw.exchangeRate) : (existing.exchangeRate ?? 1),
      is_active: 1,
      status: 'active',
      updated_at: now
    };

    if (idx >= 0) {
      inMemoryCompanies[idx] = updatedCompany;
    } else {
      inMemoryCompanies.push(updatedCompany);
    }

    if (inMemoryPhpState && Array.isArray(inMemoryPhpState.companies)) {
      const pIdx = inMemoryPhpState.companies.findIndex((c: any) => String(c.id) === String(id) || String(c.company_id) === String(id));
      if (pIdx >= 0) inMemoryPhpState.companies[pIdx] = updatedCompany;
      else inMemoryPhpState.companies.push(updatedCompany);
    }

    saveStateToDisk();

    return res.json({
      success: true,
      id: String(id),
      data: updatedCompany,
      server_ts: now
    });
  }

  if (action === 'v2_delete_company') {
    const id = String(req.body?.id || req.query.id || '');
    inMemoryCompanies = inMemoryCompanies.filter(c => String(c.id) !== id && String(c.company_id) !== id);
    if (inMemoryPhpState && Array.isArray(inMemoryPhpState.companies)) {
      inMemoryPhpState.companies = inMemoryPhpState.companies.filter((c: any) => String(c.id) !== id && String(c.company_id) !== id);
    }
    saveStateToDisk();
    return res.json({ success: true, id, server_ts: now });
  }

  // --- MASTER DATA: BRANCHES ---
  if (action === 'v2_list_branches') {
    const cid = String(req.query.company_id || req.body?.company_id || '');
    let list = inMemoryBranches;
    if (cid && cid !== 'all') {
      list = list.filter(b => String(b.company_id) === cid || String(b.companyId) === cid);
    }
    return res.json({
      success: true,
      list,
      data: list,
      count: list.length,
      server_ts: now
    });
  }

  if (action === 'v2_upsert_branch') {
    const raw = req.body?.entity || req.body?.branch || req.body || {};
    const id = raw.id || `br_${Date.now()}`;
    const idx = inMemoryBranches.findIndex(b => String(b.id) === String(id));
    const updated = { ...raw, id, updated_at: now };
    if (idx >= 0) inMemoryBranches[idx] = updated;
    else inMemoryBranches.push(updated);
    if (inMemoryPhpState && Array.isArray(inMemoryPhpState.branches)) {
      const pIdx = inMemoryPhpState.branches.findIndex((b: any) => String(b.id) === String(id));
      if (pIdx >= 0) inMemoryPhpState.branches[pIdx] = updated;
      else inMemoryPhpState.branches.push(updated);
    }
    saveStateToDisk();
    return res.json({ success: true, id: String(id), data: updated, server_ts: now });
  }

  if (action === 'v2_delete_branch') {
    const id = String(req.body?.id || req.query.id || '');
    inMemoryBranches = inMemoryBranches.filter(b => String(b.id) !== id);
    if (inMemoryPhpState && Array.isArray(inMemoryPhpState.branches)) {
      inMemoryPhpState.branches = inMemoryPhpState.branches.filter((b: any) => String(b.id) !== id);
    }
    saveStateToDisk();
    return res.json({ success: true, id, server_ts: now });
  }

  // --- MASTER DATA: STORES ---
  if (action === 'v2_list_stores') {
    const cid = String(req.query.company_id || req.body?.company_id || '');
    let list = inMemoryStores;
    if (cid && cid !== 'all') {
      list = list.filter(s => String(s.company_id) === cid || String(s.companyId) === cid);
    }
    return res.json({
      success: true,
      list,
      data: list,
      count: list.length,
      server_ts: now
    });
  }

  if (action === 'v2_upsert_store') {
    const raw = req.body?.entity || req.body?.store || req.body || {};
    const id = raw.id || `st_${Date.now()}`;
    const idx = inMemoryStores.findIndex(s => String(s.id) === String(id));
    const updated = { ...raw, id, updated_at: now };
    if (idx >= 0) inMemoryStores[idx] = updated;
    else inMemoryStores.push(updated);
    if (inMemoryPhpState && Array.isArray(inMemoryPhpState.stores)) {
      const pIdx = inMemoryPhpState.stores.findIndex((s: any) => String(s.id) === String(id));
      if (pIdx >= 0) inMemoryPhpState.stores[pIdx] = updated;
      else inMemoryPhpState.stores.push(updated);
    }
    saveStateToDisk();
    return res.json({ success: true, id: String(id), data: updated, server_ts: now });
  }

  if (action === 'v2_delete_store') {
    const id = String(req.body?.id || req.query.id || '');
    inMemoryStores = inMemoryStores.filter(s => String(s.id) !== id);
    if (inMemoryPhpState && Array.isArray(inMemoryPhpState.stores)) {
      inMemoryPhpState.stores = inMemoryPhpState.stores.filter((s: any) => String(s.id) !== id);
    }
    saveStateToDisk();
    return res.json({ success: true, id, server_ts: now });
  }

  // --- MASTER DATA: USER ACCOUNTS ---
  if (action === 'change_password') {
    const uid = String(req.body?.user_id || req.body?.id || req.query.user_id || '');
    const newPass = req.body?.password || req.body?.new_password || req.body?.passwordHash || '';
    if (!uid || !newPass) {
      return res.json({ success: false, error: 'User ID and password required', server_ts: now });
    }
    const passHash = newPass.startsWith('sha256$') ? newPass : `sha256$${newPass}`;
    const user = inMemoryUsers.find(u => String(u.id) === uid);
    if (user) {
      user.password = passHash;
      user.firstLogin = false;
      user.mustChangePassword = false;
      user.updatedAt = new Date().toISOString();
    }
    if (inMemoryPhpState && Array.isArray(inMemoryPhpState.users)) {
      const pu = inMemoryPhpState.users.find((u: any) => String(u.id) === uid);
      if (pu) {
        pu.password = passHash;
        pu.firstLogin = false;
        pu.mustChangePassword = false;
        pu.updatedAt = new Date().toISOString();
      }
    }
    saveStateToDisk();
    return res.json({ success: true, server_ts: now });
  }

  if (action === 'v2_list_user_accounts' || action === 'list_users') {
    const cid = String(req.query.company_id || req.body?.company_id || '');
    let list = inMemoryUsers.filter(u => !u.isDeleted && u.status !== 'DELETED');
    if (cid && cid !== 'all') {
      list = list.filter(u => !u.companyId || String(u.companyId) === cid || u.role === 'Super Admin' || u.isRoot);
    }
    return res.json({ success: true, list, data: list, count: list.length, server_ts: now });
  }

  if (action === 'v2_upsert_user_account' || action === 'upsert_user' || action === 'assign_user') {
    const body = req.body || {};
    let userData = body.entity || body.user || body.userData || body.data;
    if (!userData && body.user_json) {
      try { userData = typeof body.user_json === 'string' ? JSON.parse(body.user_json) : body.user_json; } catch {}
    }
    if (!userData) userData = body;
    const uid = userData.id !== undefined && userData.id !== null && userData.id !== '' ? userData.id : `u_${Date.now()}`;
    const cid = userData.companyId ?? userData.company_id ?? null;
    const username = (userData.username || userData.email || '').trim();

    const existingIdx = inMemoryUsers.findIndex(u =>
      (u.id && String(u.id) === String(uid)) ||
      (username && u.username && u.username.toLowerCase() === username.toLowerCase())
    );

    const userRecord = {
      ...(existingIdx >= 0 ? inMemoryUsers[existingIdx] : {}),
      ...userData,
      id: existingIdx >= 0 ? inMemoryUsers[existingIdx].id : uid,
      companyId: cid,
      company_id: cid,
      username: username || (existingIdx >= 0 ? inMemoryUsers[existingIdx].username : `user_${Date.now()}`),
      updatedAt: new Date().toISOString()
    };

    if (existingIdx >= 0) {
      inMemoryUsers[existingIdx] = userRecord;
    } else {
      inMemoryUsers.push(userRecord);
    }

    if (inMemoryPhpState) {
      if (!Array.isArray(inMemoryPhpState.users)) inMemoryPhpState.users = [...inMemoryUsers];
      const pIdx = inMemoryPhpState.users.findIndex((u: any) => String(u.id) === String(userRecord.id));
      if (pIdx >= 0) inMemoryPhpState.users[pIdx] = userRecord;
      else inMemoryPhpState.users.push(userRecord);
    }

    saveStateToDisk();
    return res.json({ success: true, status: 'ok', user: userRecord, id: userRecord.id, server_ts: now });
  }

  if (action === 'v2_delete_user_account' || action === 'delete_user') {
    const uid = String(req.body?.id || req.body?.userId || req.body?.user_id || req.query.id || '');
    const username = String(req.body?.username || '').trim().toLowerCase();
    if (uid || username) {
      inMemoryUsers = inMemoryUsers.filter(u => {
        if (uid && String(u.id) === uid) return false;
        if (username && u.username && u.username.toLowerCase() === username) return false;
        return true;
      });
      if (inMemoryPhpState && Array.isArray(inMemoryPhpState.users)) {
        inMemoryPhpState.users = inMemoryPhpState.users.filter((u: any) => {
          if (uid && String(u.id) === uid) return false;
          if (username && u.username && u.username.toLowerCase() === username) return false;
          return true;
        });
      }
      saveStateToDisk();
    }
    return res.json({ success: true, status: 'ok', id: uid, server_ts: now });
  }

  // --- MASTER DATA: CATEGORIES ---
  if (action === 'v2_list_categories') {
    const cid = String(req.query.company_id || req.body?.company_id || req.body?.companyId || '');
    const stId = req.query.store_id || req.body?.store_id;
    let list = inMemoryCategories;
    if (cid && cid !== 'all') {
      const prefix = `co_${cid}:`;
      list = list.filter(c => c.startsWith(prefix) || (cid === '1' && !c.includes(':')));
    }
    if (stId) {
      const stPrefix = `st_${stId}:`;
      list = list.filter(c => c.includes(stPrefix) || (!c.includes('st_') && (cid ? c.startsWith(`co_${cid}:`) : true)));
    }
    return res.json({
      success: true,
      list,
      data: list,
      count: list.length,
      server_ts: now
    });
  }

  if (action === 'v2_upsert_category') {
    const cid = String(req.body?.company_id || req.query.company_id || req.body?.companyId || '1');
    const stId = req.body?.store_id || req.body?.storeId || req.query.store_id;
    const name = String(req.body?.name || req.body?.category_name || '').trim();
    if (!name) {
      return res.json({ success: false, error: 'Category name is required', server_ts: now });
    }
    const clean = name.replace(/^co_[^:]+:/, '').replace(/^st_[^:]+:/, '');
    let catEntry = stId ? `co_${cid}:st_${stId}:${clean}` : `co_${cid}:${clean}`;
    if (name.startsWith('co_')) {
      catEntry = name;
    } else if (name.startsWith('st_')) {
      catEntry = `co_${cid}:${name}`;
    }

    if (!inMemoryCategories.includes(catEntry)) {
      inMemoryCategories.push(catEntry);
    }
    if (cid === '1' && !stId && !inMemoryCategories.includes(clean)) {
      inMemoryCategories.push(clean);
    }
    if (inMemoryPhpState) {
      const mergedCats = new Set([...(Array.isArray(inMemoryPhpState.categories) ? inMemoryPhpState.categories : []), ...inMemoryCategories]);
      inMemoryPhpState.categories = Array.from(mergedCats);
    }
    saveStateToDisk();
    return res.json({ success: true, id: `nc_${cid}_${clean}`, key: catEntry, server_ts: now });
  }

  if (action === 'v2_delete_category') {
    const cid = String(req.body?.company_id || req.query.company_id || req.body?.companyId || '');
    const stId = req.body?.store_id || req.body?.storeId || req.query.store_id;
    const rawName = String(req.body?.name || req.body?.category_name || '').trim();
    const clean = rawName.replace(/^co_[^:]+:/, '').replace(/^st_[^:]+:/, '');

    if (clean) {
      inMemoryCategories = inMemoryCategories.filter(c => {
        if (c === rawName) return false;
        const cClean = c.replace(/^co_[^:]+:/, '').replace(/^st_[^:]+:/, '');
        if (cClean.toLowerCase() === clean.toLowerCase()) {
          if (stId && c.includes(`st_${stId}:`)) return false;
          if (cid && c.startsWith(`co_${cid}:`)) return false;
          if (!stId && !cid) return false;
        }
        return true;
      });
      if (inMemoryPhpState && Array.isArray(inMemoryPhpState.categories)) {
        inMemoryPhpState.categories = inMemoryPhpState.categories.filter((c: any) => {
          if (c === rawName) return false;
          const cClean = String(c).replace(/^co_[^:]+:/, '').replace(/^st_[^:]+:/, '');
          if (cClean.toLowerCase() === clean.toLowerCase()) {
            if (stId && String(c).includes(`st_${stId}:`)) return false;
            if (cid && String(c).startsWith(`co_${cid}:`)) return false;
            if (!stId && !cid) return false;
          }
          return true;
        });
      }
      saveStateToDisk();
    }
    return res.json({ success: true, server_ts: now });
  }

  if (action === 'v2_get_audit_trails') {
    const limit = Math.max(1, Math.min(500, Number(req.query.limit || req.body?.limit || 100)));
    const page = Math.max(1, Number(req.query.page || req.body?.page || 1));
    const trails = Array.isArray(inMemoryPhpState?.auditTrails) ? inMemoryPhpState.auditTrails : [];
    const total = trails.length;
    const offset = (page - 1) * limit;
    const list = trails.slice(offset, offset + limit);
    return res.json({ success: true, list, count: list.length, total, page, limit, server_ts: now });
  }

  // --- PURCHASE ORDERS ---
  if (action === 'v2_list_purchase_orders') {
    const cid = String(req.query.company_id || req.body?.company_id || req.query.companyId || req.body?.companyId || '');
    let list = Array.isArray(inMemoryPhpState?.purchaseOrders) ? inMemoryPhpState.purchaseOrders : [];
    if (cid) {
      list = list.filter((p: any) => String(p.companyId || p.company_id || '') === cid);
    }
    return res.json({ success: true, list, count: list.length, server_ts: now });
  }

  if (action === 'v2_upsert_purchase_order') {
    const entity = req.body?.entity || req.body?.data || req.body?.purchaseOrder || req.body;
    if (!inMemoryPhpState) inMemoryPhpState = {};
    if (!Array.isArray(inMemoryPhpState.purchaseOrders)) inMemoryPhpState.purchaseOrders = [];
    const id = entity?.id;
    const existingIdx = inMemoryPhpState.purchaseOrders.findIndex((p: any) => String(p.id) === String(id));
    if (existingIdx >= 0) {
      inMemoryPhpState.purchaseOrders[existingIdx] = { ...inMemoryPhpState.purchaseOrders[existingIdx], ...entity, updated_at: now };
    } else {
      inMemoryPhpState.purchaseOrders.unshift({ ...entity, created_at: now, updated_at: now });
    }
    saveStateToDisk();
    return res.json({ success: true, id, server_ts: now });
  }

  if (action === 'v2_delete_purchase_order') {
    const id = String(req.body?.id || req.query.id || '');
    if (inMemoryPhpState && Array.isArray(inMemoryPhpState.purchaseOrders)) {
      inMemoryPhpState.purchaseOrders = inMemoryPhpState.purchaseOrders.map((p: any) => {
        if (String(p.id) === id) return { ...p, isDeleted: true, deleted_at: now };
        return p;
      });
      saveStateToDisk();
    }
    return res.json({ success: true, id, server_ts: now });
  }

  // --- EXPENSES ---
  if (action === 'v2_list_expenses') {
    const cid = String(req.query.company_id || req.body?.company_id || req.query.companyId || req.body?.companyId || '');
    let list = Array.isArray(inMemoryPhpState?.expenses) ? inMemoryPhpState.expenses : [];
    if (cid) {
      list = list.filter((e: any) => String(e.companyId || e.company_id || '') === cid);
    }
    return res.json({ success: true, list, count: list.length, server_ts: now });
  }

  if (action === 'v2_upsert_expense') {
    const entity = req.body?.entity || req.body?.data || req.body?.expense || req.body;
    if (!inMemoryPhpState) inMemoryPhpState = {};
    if (!Array.isArray(inMemoryPhpState.expenses)) inMemoryPhpState.expenses = [];
    const id = entity?.id;
    const existingIdx = inMemoryPhpState.expenses.findIndex((e: any) => String(e.id) === String(id));
    if (existingIdx >= 0) {
      inMemoryPhpState.expenses[existingIdx] = { ...inMemoryPhpState.expenses[existingIdx], ...entity, updated_at: now };
    } else {
      inMemoryPhpState.expenses.unshift({ ...entity, created_at: now, updated_at: now });
    }
    saveStateToDisk();
    return res.json({ success: true, id, server_ts: now });
  }

  if (action === 'v2_delete_expense') {
    const id = String(req.body?.id || req.query.id || '');
    if (inMemoryPhpState && Array.isArray(inMemoryPhpState.expenses)) {
      inMemoryPhpState.expenses = inMemoryPhpState.expenses.map((e: any) => {
        if (String(e.id) === id) return { ...e, isDeleted: true, deleted_at: now };
        return e;
      });
      saveStateToDisk();
    }
    return res.json({ success: true, id, server_ts: now });
  }

  // --- SUPPLIERS ---
  if (action === 'v2_list_suppliers') {
    const cid = String(req.query.company_id || req.body?.company_id || req.query.companyId || req.body?.companyId || '');
    let list = Array.isArray(inMemoryPhpState?.suppliers) ? inMemoryPhpState.suppliers : [];
    if (cid) {
      list = list.filter((s: any) => String(s.companyId || s.company_id || '') === cid);
    }
    return res.json({ success: true, list, count: list.length, server_ts: now });
  }

  if (action === 'v2_upsert_supplier') {
    const entity = req.body?.entity || req.body?.data || req.body?.supplier || req.body;
    if (!inMemoryPhpState) inMemoryPhpState = {};
    if (!Array.isArray(inMemoryPhpState.suppliers)) inMemoryPhpState.suppliers = [];
    const id = entity?.id;
    const existingIdx = inMemoryPhpState.suppliers.findIndex((s: any) => String(s.id) === String(id));
    if (existingIdx >= 0) {
      inMemoryPhpState.suppliers[existingIdx] = { ...inMemoryPhpState.suppliers[existingIdx], ...entity, updated_at: now };
    } else {
      inMemoryPhpState.suppliers.unshift({ ...entity, created_at: now, updated_at: now });
    }
    saveStateToDisk();
    return res.json({ success: true, id, server_ts: now });
  }

  if (action === 'v2_delete_supplier') {
    const id = String(req.body?.id || req.query.id || '');
    if (inMemoryPhpState && Array.isArray(inMemoryPhpState.suppliers)) {
      inMemoryPhpState.suppliers = inMemoryPhpState.suppliers.map((s: any) => {
        if (String(s.id) === id) return { ...s, isDeleted: true, deleted_at: now };
        return s;
      });
      saveStateToDisk();
    }
    return res.json({ success: true, id, server_ts: now });
  }

  // --- CUSTOMERS ---
  if (action === 'v2_list_customers') {
    const cid = String(req.query.company_id || req.body?.company_id || req.query.companyId || req.body?.companyId || '');
    let list = Array.isArray(inMemoryPhpState?.customers) ? inMemoryPhpState.customers : [];
    if (cid) {
      list = list.filter((c: any) => String(c.companyId || c.company_id || '') === cid);
    }
    return res.json({ success: true, list, count: list.length, server_ts: now });
  }

  if (action === 'v2_upsert_customer') {
    const entity = req.body?.entity || req.body?.data || req.body?.customer || req.body;
    if (!inMemoryPhpState) inMemoryPhpState = {};
    if (!Array.isArray(inMemoryPhpState.customers)) inMemoryPhpState.customers = [];
    const id = entity?.id;
    const existingIdx = inMemoryPhpState.customers.findIndex((c: any) => String(c.id) === String(id));
    if (existingIdx >= 0) {
      inMemoryPhpState.customers[existingIdx] = { ...inMemoryPhpState.customers[existingIdx], ...entity, updated_at: now };
    } else {
      inMemoryPhpState.customers.unshift({ ...entity, created_at: now, updated_at: now });
    }
    saveStateToDisk();
    return res.json({ success: true, id, server_ts: now });
  }

  if (action === 'v2_delete_customer') {
    const id = String(req.body?.id || req.query.id || '');
    if (inMemoryPhpState && Array.isArray(inMemoryPhpState.customers)) {
      inMemoryPhpState.customers = inMemoryPhpState.customers.map((c: any) => {
        if (String(c.id) === id) return { ...c, isDeleted: true, deleted_at: now };
        return c;
      });
      saveStateToDisk();
    }
    return res.json({ success: true, id, server_ts: now });
  }

  if (action === 'v2_get_sales_orders_paged') {
    const limit = Math.max(1, Math.min(500, Number(req.query.limit || req.body?.limit || 50)));
    const page = Math.max(1, Number(req.query.page || req.body?.page || 1));
    const orders = Array.isArray(inMemoryPhpState?.salesOrders) ? inMemoryPhpState.salesOrders : [];
    const total = orders.length;
    const offset = (page - 1) * limit;
    const list = orders.slice(offset, offset + limit);
    return res.json({ success: true, list, count: list.length, total, page, limit, server_ts: now });
  }

  if (action === 'v2_get_stock_items_paged') {
    const limit = Math.max(1, Math.min(500, Number(req.query.limit || req.body?.limit || 50)));
    const page = Math.max(1, Number(req.query.page || req.body?.page || 1));
    const items = Array.isArray(inMemoryPhpState?.stockItems) ? inMemoryPhpState.stockItems : [];
    const total = items.length;
    const offset = (page - 1) * limit;
    const list = items.slice(offset, offset + limit);
    return res.json({ success: true, list, count: list.length, total, page, limit, server_ts: now });
  }

  const activeSponsors = inMemorySponsors
    .filter(s => !s.deleted_at && !s.is_archived && s.status !== 'EXPIRED' && s.status !== 'ARCHIVED' && (s.is_active === 1 || s.is_active === true))
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const activeGlobalSponsors = inMemorySponsors
    .filter(s => !s.deleted_at && !s.is_archived && s.status !== 'EXPIRED' && s.status !== 'ARCHIVED' && (s.is_active === 1 || s.is_active === true) && !s.company_id)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  if (req.method === "GET" || action === "get_state" || action === "snapshot") {
    const resData = inMemoryPhpState ? { ...inMemoryPhpState } : {};
    if (!resData.companies || !Array.isArray(resData.companies) || resData.companies.length === 0) {
      resData.companies = inMemoryCompanies;
    }
    if (!resData.branches || !Array.isArray(resData.branches) || resData.branches.length === 0) {
      resData.branches = inMemoryBranches;
    }
    if (!resData.stores || !Array.isArray(resData.stores) || resData.stores.length === 0) {
      resData.stores = inMemoryStores;
    }
    resData.categories = inMemoryCategories;
    resData.users = inMemoryUsers;
    resData.sponsors = activeSponsors;
    resData.globalSponsors = activeGlobalSponsors;
    resData._assembled = 1;
    return res.json({
      success: true,
      status: "ok",
      _assembled: 1,
      sponsors: activeSponsors,
      globalSponsors: activeGlobalSponsors,
      companies: inMemoryCompanies,
      branches: inMemoryBranches,
      stores: inMemoryStores,
      categories: inMemoryCategories,
      users: inMemoryUsers,
      data: resData
    });
  }

  if (action === "save_state" || (!action && req.method === "POST" && (req.body?.delta || req.body?.data || req.body?.companies || req.body?.settings))) {
    const incomingData = req.body?.delta || req.body?.data || req.body || {};
    inMemoryPhpState = {
      ...(inMemoryPhpState || {}),
      ...incomingData
    };

    if (incomingData?.companies && Array.isArray(incomingData.companies)) {
      inMemoryCompanies = incomingData.companies;
    }
    if (incomingData?.branches && Array.isArray(incomingData.branches)) {
      inMemoryBranches = incomingData.branches;
    }
    if (incomingData?.stores && Array.isArray(incomingData.stores)) {
      inMemoryStores = incomingData.stores;
    }
    if (incomingData?.users && Array.isArray(incomingData.users)) {
      inMemoryUsers = incomingData.users;
    }
    if (incomingData?.categories && Array.isArray(incomingData.categories)) {
      const incomingCats = incomingData.categories.filter((c: any) => typeof c === 'string' && c.trim());
      const catSet = new Set([...inMemoryCategories, ...incomingCats]);
      inMemoryCategories = Array.from(catSet);
      if (inMemoryPhpState) {
        inMemoryPhpState.categories = [...inMemoryCategories];
      }
    }
    if (incomingData?.purchaseOrders && Array.isArray(incomingData.purchaseOrders)) {
      if (inMemoryPhpState) inMemoryPhpState.purchaseOrders = incomingData.purchaseOrders;
    }
    if (incomingData?.expenses && Array.isArray(incomingData.expenses)) {
      if (inMemoryPhpState) inMemoryPhpState.expenses = incomingData.expenses;
    }
    if (incomingData?.salesOrders && Array.isArray(incomingData.salesOrders)) {
      if (inMemoryPhpState) inMemoryPhpState.salesOrders = incomingData.salesOrders;
    }
    if (incomingData?.stockItems && Array.isArray(incomingData.stockItems)) {
      if (inMemoryPhpState) inMemoryPhpState.stockItems = incomingData.stockItems;
    }
    if (incomingData?.customers && Array.isArray(incomingData.customers)) {
      if (inMemoryPhpState) inMemoryPhpState.customers = incomingData.customers;
    }
    if (incomingData?.suppliers && Array.isArray(incomingData.suppliers)) {
      if (inMemoryPhpState) inMemoryPhpState.suppliers = incomingData.suppliers;
    }
    saveStateToDisk();
    return res.json({
      success: true,
      status: "ok",
      _assembled: 1,
      version: Date.now(),
      server_ts: Date.now(),
      message: "Data successfully synchronized with backend",
      timestamp: new Date().toISOString()
    });
  }

  res.json({ success: true, status: "ok", _assembled: 1 });
};

app.all("/api/php_sync.php", handlePhpApi);
app.all("/api/api.php", handlePhpApi);
app.all("/cpanel/api.php", handlePhpApi);

// API routes FIRST
app.post("/api/ai-assist", async (req, res) => {
  try {
    const { prompt, products, priceType } = req.body;

    if (!prompt) {
      res.status(400).json({ success: false, error: "Prompt is required" });
      return;
    }

    const ai = getGeminiClient();

    const systemInstruction = `You are an assistant for a point-of-sale (POS/ERP) system.

<system_purpose>
Analyze order requests, accurately decompose package/bulk quantities into standard base units, deduct inventory, and apply the correct tiered pricing (Retail vs. Wholesale).
Our products can be sold in two ways: 'Wholesale' (Package/Bulk units such as Sacks, Dozens, or Cartons) and 'Retail' (Non-package/Loose units such as a Single Kilogram, a Single Loaf, or a Single Bottle).
</system_purpose>

Example of how we define products internally:
{
  "product_name": "Bottled Water",
  "category": "Beverages",
  "stock_management": {
    "total_base_units_in_stock": 20,
    "base_unit_name": "bottle",
    "package_unit_name": "carton",
    "units_per_package": 4
  },
  "pricing": {
    "retail_price_per_base_unit": 500,
    "wholesale_price_per_package": 1800
  }
}

Example 1: Flour
User (Input): "We have 5 bags of 24kg flour in stock. A retail customer wants to buy 2 kilograms, and a Wholesaler wants 1 full sack."
Explanation:
- Initial State Summary: Current stock is 5 Sacks (120 kg total).
- Decomposition Math: 2 kg (Retail) = 2 base units. 1 full sack (Wholesale) = 24 kg = 24 base units. Total sold = 26 base units (kg).
- Transaction Deduction: 120 kg - 26 kg = 94 kg.
- Financial Summary: 2 kg charged at the retail price per kg, 1 sack charged at the wholesale price per sack.
- New Inventory State: 94 kg remaining (Equivalent to 3 Sacks and 22 kg).

Example 2: Bread
User (Input): "We have 5 dozens of bread (each dozen contains 5 loaves). A customer is buying 3 loose loaves individually."
Explanation:
- Initial State Summary: Current stock is 5 Dozens (25 loaves total).
- Decomposition Math: 3 loose loaves = 3 base units. Total sold = 3 base units (loaves).
- Transaction Deduction: 25 loaves - 3 loaves = 22 loaves.
- Financial Summary: 3 loaves charged at the retail price.
- New Inventory State: 22 loaves remaining (Equivalent to 4 dozens and 2 extra loaves).

<inventory_rules>
1. ALWAYS convert incoming quantities into the 'base_unit' (e.g., kg, single bottle, loaf) before performing any addition or subtraction.
2. Wholesale purchases (Sacks, Dozens, Cartons, Boxes) must be instantly multiplied by the 'units_per_package' factor to find the base unit equivalent.
3. Total stock must always be tracked and updated as a single flat integer of total base units to avoid floating-point errors or mismatched states.
</inventory_rules>

<pricing_logic>
- If the order specifies a bulk unit (e.g., Sack, Carton, Dozen), apply the wholesale_price or partner_price per package equivalent.
- If the order specifies loose units (e.g., kg, single item), apply the retail_price per base unit.
</pricing_logic>

Your tasks are:
1. Receive orders and identify whether the customer is buying in Wholesale (Package/Bulk) or Retail (Single/Loose Sub-unit).
2. Deduct inventory accurately based on the 'Base Unit' (for example, if someone buys 1 carton of water containing 4 bottles, you deduct 4 bottles from the main stock).
3. Calculate the correct price based on the customer type and unit type requested (Wholesaler or Retailer).

<response_format>
For every transaction, output your internal logic following this structural chain-of-thought in your 'explanation' field:
1. **Initial State Summary**: Clear breakdown of current stock in both bulk units and remaining loose units.
2. **Decomposition Math**: Show the step-by-step conversion of the order into base units.
3. **Transaction Deduction**: (Initial Base Units) - (Sold Base Units) = (Remaining Base Units).
4. **Financial Summary**: Detailed calculation of the total amount charged based on the customer type price tier.
5. **New Inventory State**: Output the final stock converted back into a user-friendly format (e.g., '3 Sacks and 22 kg remaining').
</response_format>`;

    const userMsg = `Here is the current list of available products in the store:
${JSON.stringify(products, null, 2)}

Active Price Type context (Retail/Wholesale/Preferred): ${priceType || 'Retail'}

User Input Command: "${prompt}"

Identify matched products. If the user refers to quantities in loose or sub-units (e.g. kg, loaves, bottles) and the product supports subUnitPricing (useSubUnitPricing is true and subUnitConversion is defined), set 'unitType' to 'sub' and specify the sub-unit quantity. If they buy package/bulk (e.g. sacks, bags, cartons, dozens) or if the product does NOT support sub-units, set 'unitType' to 'main'.

Calculate the prices:
- For 'main' unitType, the unit price should be:
  * wholesalePrice (if priceType is Wholesale)
  * partnerPrice or retailPrice (if priceType is Preferred)
  * retailPrice (otherwise)
- For 'sub' unitType, the unit price should be:
  * subUnitWholesalePrice or subUnitRetailPrice (if priceType is Wholesale)
  * subUnitPartnerPrice or subUnitRetailPrice (if priceType is Preferred)
  * subUnitRetailPrice (otherwise)

Generate a JSON response conforming to the schema. Include a descriptive 'explanation' in the style of the system instruction examples, breaking down the initial stock, sales, prices charged, and remaining stock.`;

    let response: any = null;
    const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
    let lastError: any = null;

    for (const modelName of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: userMsg,
          config: {
            systemInstruction,
            temperature: 0.2,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                success: { type: Type.BOOLEAN },
                explanation: { type: Type.STRING },
                actions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      productId: { type: Type.INTEGER },
                      productName: { type: Type.STRING },
                      unitType: { type: Type.STRING, description: "Must be 'main' (for whole package) or 'sub' (for loose/retail sub-units)" },
                      qty: { type: Type.NUMBER, description: "Quantity of the unitType purchased" },
                      price: { type: Type.NUMBER, description: "Calculated unit price for this action" },
                      total: { type: Type.NUMBER, description: "qty * price" }
                    },
                    required: ["productId", "productName", "unitType", "qty", "price", "total"]
                  }
                }
              },
              required: ["success", "explanation", "actions"]
            }
          }
        });
        if (response && response.text) break;
      } catch (err) {
        lastError = err;
        console.warn(`[AI Assist] Model ${modelName} call failed, trying next fallback...`, err instanceof Error ? err.message : err);
      }
    }

    if (!response || !response.text) {
      // Deterministic Local Rule Fallback for AI Assist when API experiences high demand
      const matchedActions: any[] = [];
      const promptLower = prompt.toLowerCase();
      
      (products || []).forEach((p: any) => {
        if (promptLower.includes(p.name.toLowerCase()) || (p.code && promptLower.includes(p.code.toLowerCase()))) {
          const isSub = p.useSubUnitPricing && p.subUnitConversion && (promptLower.includes(p.subUnitName?.toLowerCase() || '') || promptLower.includes('kg') || promptLower.includes('loose'));
          const price = isSub ? (p.subUnitRetailPrice || p.retailPrice) : (priceType === 'Wholesale' ? p.wholesalePrice : p.retailPrice);
          matchedActions.push({
            productId: p.id,
            productName: p.name,
            unitType: isSub ? 'sub' : 'main',
            qty: 1,
            price: price || 0,
            total: price || 0
          });
        }
      });

      return res.json({
        success: true,
        explanation: matchedActions.length > 0 
          ? `Identified ${matchedActions.length} matching product(s) for prompt "${prompt}".` 
          : `No direct product matches found for "${prompt}". Please check spelling or product list.`,
        actions: matchedActions
      });
    }

    const resultText = response.text || "{}";
    res.json(JSON.parse(resultText));
  } catch (error: any) {
    console.error("AI Assist error:", error);
    res.status(500).json({ success: false, error: error.message || "Internal Server Error" });
  }
});

// Comprehensive AI Stock, Pricing, Sales & Company Growth Copilot Endpoint
app.post("/api/copilot-analysis", async (req, res) => {
  try {
    const { prompt, topic, companyInfo, metricsSummary, products, sales, purchases, expenses, language } = req.body;

    let aiResponse = "";
    const targetLang = language === 'sw' ? 'Swahili (Kiswahili)' : 'English';
    const companyName = companyInfo?.name || 'Active Company';

    const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];

    const systemInstruction = `You are the Lead Executive AI Enterprise Copilot for the specified company (${companyName}).
Your mandate is to DIRECTLY AND SPECIFICALLY ANSWER the user's specific prompt/question first ("${prompt || 'General Review'}").
Do NOT provide generic repeated templates. Always personalize your answer to directly answer the user's question with specific actionable facts, metrics, and steps.

CRITICAL LANGUAGE REQUIREMENT: You MUST respond entirely in ${targetLang}. If Swahili is selected, construct naturally fluent, professional Swahili text for business leadership.

Formatting: Use bold headers, numbered actionable steps, and clear bullet points. Keep recommendations grounded in the provided company metrics.`;

    const userMsg = `Company Context: ${JSON.stringify(companyInfo)}
Requested Language: ${targetLang}
Topic Focus: ${topic || 'All Company Matters'}
User Question/Command: "${prompt || 'Provide a complete strategic review covering all matters facing our company.'}"

Metrics Summary: ${JSON.stringify(metricsSummary)}
Top Products Sample: ${JSON.stringify((products || []).slice(0, 10))}
Recent Sales Orders: ${JSON.stringify((sales || []).slice(0, 10))}
Recent Purchase Orders: ${JSON.stringify((purchases || []).slice(0, 10))}

Respond in ${targetLang} directly answering "${prompt}".`;

    try {
      const ai = getGeminiClient();

      for (const modelName of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: userMsg,
            config: {
              systemInstruction,
              temperature: 0.4
            }
          });
          if (response && response.text) {
            aiResponse = response.text;
            break;
          }
        } catch (mErr: any) {
          console.warn(`[Copilot] Gemini model ${modelName} failed:`, mErr.message);
        }
      }
    } catch (geminiErr: any) {
      console.warn("Gemini API fallback for copilot:", geminiErr.message);
    }

    // Server-side fallback analysis generation if Gemini API experienced 503 high demand or unavailable status
    if (!aiResponse || aiResponse.trim().length < 20) {
      const isSwahili = language === 'sw';
      const rev = metricsSummary?.totalSalesRevenue || 0;
      const profit = metricsSummary?.totalSalesProfit || 0;
      const margin = metricsSummary?.grossMarginPct || 0;
      const exp = metricsSummary?.totalExpenseAmount || 0;
      const net = metricsSummary?.netOperatingProfit || 0;
      const lowStock = metricsSummary?.lowStockCount || 0;
      const qLower = (prompt || '').toLowerCase();

      if (isSwahili) {
        if (qLower.includes('matumizi') || qLower.includes('expense') || qLower.includes('gharama')) {
          aiResponse = `### 💡 Uchambuzi wa Matumizi na Gharama kwa **${companyName}**\n\n` +
            `Jumla ya matumizi ya sasa ni **${exp.toLocaleString()}**.\n\n` +
            `1. **Kagua Matumizi Yasiyo ya Lazima**: Matumizi ya uendeshaji ni **${exp.toLocaleString()}**, ambayo inaathiri faida halisi (**${net.toLocaleString()}**).\n` +
            `2. **Ufuatiliaji wa Siku kwa Siku**: Hakikisha matumizi yote yanapitishwa na meneja wa duka kabla ya kutoa fedha drooni.\n` +
            `3. **Ushauri wa Kifedha**: Weka bajeti maalum kwa kila tawi/duka ili kubana matumizi yasiyo ya lazima.`;
        } else if (qLower.includes('mauzo') || qLower.includes('sale') || qLower.includes('faida') || qLower.includes('profit')) {
          aiResponse = `### 📊 Uchambuzi wa Mauzo na Faida kwa **${companyName}**\n\n` +
            `Jumla ya mapato ya mauzo ni **${rev.toLocaleString()}** na faida ghafi ni **${profit.toLocaleString()}** (**${margin.toFixed(1)}%**).\n\n` +
            `1. **Ongeza Mauzo ya Rejareja na Jumla**: Tumia mfumo wa bei za jumla kuwapa wateja wa kubwa punguzo na kuongeza mauzo.\n` +
            `2. **Uza Vipimo Vidogo (Loose Units)**: Kutokana na mahitaji, kuuza vipimo vidogo kama unga au mikate huongeza faida ghafi kwa **12-15%**.\n` +
            `3. **Urejeshaji wa Madeni**: Fuatilia madeni ya wateja ili kuhakikisha mzunguko wa fedha unakaa vizuri.`;
        } else if (qLower.includes('akiba') || qLower.includes('stock') || qLower.includes('bidhaa')) {
          aiResponse = `### 📦 Uchambuzi wa Akiba na Bidhaa kwa **${companyName}**\n\n` +
            `Kuna bidhaa **${lowStock}** zilizokaribia kuisha ghalani kwa sasa.\n\n` +
            `1. **Weka Oda za Manunuzi Mapema**: Tuma oda za manunuzi (PO) kwa wauzaji kwa bidhaa **${lowStock}** zilizopo chini ya kiwango cha chini.\n` +
            `2. **Uhamisho wa Bidhaa Baina ya Maduka**: Tumia Stock Transfer kuhamisha bidhaa kutoka maduka yenye ziada kwenda maduka yenye uhaba.\n` +
            `3. **Tarehe za Mwisho wa Matumizi (Expiry Tracking)**: Hakikisha bidhaa zinazokaribia kuisha muda zinauzwa kwanza (FIFO).`;
        } else {
          aiResponse = `### 🚀 Majibu ya Mtaalamu Copilot kwa **${companyName}**\n\n` +
            `Kuhusu swali lako: *"_${prompt}_"*\n\n` +
            `#### 📊 Muhtasari wa Mfumo na Mfano wa Takwimu:\n` +
            `- **Mapato ya Mauzo**: **${rev.toLocaleString()}** | **Faida Ghafi**: **${profit.toLocaleString()}** (**${margin.toFixed(1)}%**).\n` +
            `- **Gharama za Uendeshaji**: **${exp.toLocaleString()}** | **Faida Halisi**: **${net.toLocaleString()}**.\n` +
            `- **Bidhaa Chache Ghalani**: Bidhaa **${lowStock}** ziko chini ya kiwango cha usalama.\n\n` +
            `#### 🎯 Hatua za Kuchukua Mara Moja:\n` +
            `1. **Usimamizi wa Sehemu za Mfumo**: Hakikisha watumiaji wote wametengewa maduka na haki zao za ufikiaji vizuri.\n` +
            `2. **Ukaguzi wa Kila Siku**: Tumia sehemu ya Ripoti za Kila Siku na POS Shift Ledger kukagua miamala yote.\n` +
            `3. **Mawasiliano na Wateja**: Tumia WhatsApp/SMS Messaging kuwatumia wateja risiti na taarifa za madeni.`;
        }
      } else {
        if (qLower.includes('expense') || qLower.includes('cost') || qLower.includes('spending')) {
          aiResponse = `### 💡 Expense & Operational Overhead Analysis for **${companyName}**\n\n` +
            `Total operating expenses stand at **${exp.toLocaleString()}**.\n\n` +
            `1. **Review Operational Costs**: Expenses directly impact your net operating profit of **${net.toLocaleString()}**.\n` +
            `2. **Approval Rules**: Require store manager sign-off for all drawer cash payouts.\n` +
            `3. **Budget Allocation**: Set store-level expense caps in Master Data to control operational creep.`;
        } else if (qLower.includes('sale') || qLower.includes('profit') || qLower.includes('revenue')) {
          aiResponse = `### 📊 Revenue & Margin Analysis for **${companyName}**\n\n` +
            `Total sales revenue is **${rev.toLocaleString()}** with gross profit of **${profit.toLocaleString()}** (**${margin.toFixed(1)}% margin**).\n\n` +
            `1. **Leverage Tiered Pricing**: Use wholesale vs retail pricing tiers to capture commercial buyers.\n` +
            `2. **Loose Unit Sub-Pricing**: Sub-unit breakdowns (e.g. per-kg, per-piece) increase margins by **12-15%**.\n` +
            `3. **Receivables Recovery**: Follow up on customer credit balances to keep cash flow strong.`;
        } else if (qLower.includes('stock') || qLower.includes('inventory') || qLower.includes('product')) {
          aiResponse = `### 📦 Inventory & Stock Health Analysis for **${companyName}**\n\n` +
            `There are currently **${lowStock} low-stock items** requiring reordering.\n\n` +
            `1. **Issue Purchase Orders**: Generate POs for the **${lowStock} critical items** to prevent stockouts.\n` +
            `2. **Inter-Store Transfers**: Move stock between branches before placing new supplier orders.\n` +
            `3. **FIFO Expiry Tracking**: Prioritize older inventory batches to eliminate waste.`;
        } else {
          aiResponse = `### 🚀 Executive Intelligence Response for **${companyName}**\n\n` +
            `In response to your query: *"_${prompt}_"*\n\n` +
            `#### 📊 Core Operational Financial Status:\n` +
            `- **Total Revenue**: **${rev.toLocaleString()}** | **Gross Profit**: **${profit.toLocaleString()}** (**${margin.toFixed(1)}%**).\n` +
            `- **Expenses**: **${exp.toLocaleString()}** | **Net Profit**: **${net.toLocaleString()}**.\n` +
            `- **Low Stock Items**: **${lowStock} items** need attention.\n\n` +
            `#### 🎯 Strategic Action Plan:\n` +
            `1. **Multi-Tenant Operations**: Ensure stores, branches, and staff accounts are separated appropriately.\n` +
            `2. **Daily Shift Audit**: Use POS Shift Reconciliations to keep drawer cash aligned.\n` +
            `3. **Automated Follow-ups**: Send automated PDF invoices and account statements to credit customers.`;
        }
      }
    }

    res.json({
      success: true,
      analysis: aiResponse
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Failed to execute copilot analysis" });
  }
});

// Vite or Static assets middleware
async function setupServer() {
  let vitePromise: Promise<any> | null = null;
  if (process.env.NODE_ENV !== "production") {
    vitePromise = import("vite").then(({ createServer: createViteServer }) =>
      createViteServer({
        server: {
          middlewareMode: true,
          hmr: false,
        },
        appType: "spa",
      })
    ).catch(err => {
      console.error("[server.ts] Error initializing Vite dev server:", err);
      return null;
    });

    app.use(async (req, res, next) => {
      try {
        const vite = await vitePromise;
        if (vite) {
          vite.middlewares(req, res, next);
        } else {
          next();
        }
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const startListening = (retryCount = 0) => {
    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`  ➜  Local:   http://localhost:${PORT}/`);
      console.log(`  ➜  Network: http://0.0.0.0:${PORT}/`);
      console.log(`Server running on http://localhost:${PORT}`);
    });

    server.on("error", (err: any) => {
      if (err.code === "EADDRINUSE" && retryCount < 10) {
        console.warn(`Port ${PORT} in use, retrying in 500ms (attempt ${retryCount + 1}/10)...`);
        setTimeout(() => {
          try { server.close(); } catch {}
          startListening(retryCount + 1);
        }, 500);
      } else {
        console.error("Server listen error:", err);
      }
    });

    const shutdown = async () => {
      try {
        if (vitePromise) {
          const vite = await vitePromise;
          if (vite) await vite.close();
        }
        server.close(() => {
          process.exit(0);
        });
      } catch {
        process.exit(0);
      }
    };

    process.once("SIGTERM", shutdown);
    process.once("SIGINT", shutdown);
  };

  startListening();
}

setupServer();
