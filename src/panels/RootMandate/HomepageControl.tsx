import React, { useState, useEffect } from 'react';
import {
  Handshake, Plus, Edit2, Trash2, Globe, ExternalLink, Upload,
  CheckCircle2, XCircle, Image as ImageIcon, AlertCircle, RefreshCw, Eye,
  Calendar, Archive, RotateCcw, Clock
} from 'lucide-react';
import { Sponsor, SponsorTier } from '../../types';
import {
  v2ListSponsors,
  v2UpsertSponsor,
  v2DeleteSponsor,
  v2UploadSponsorLogo
} from '../../utils/normalizedPersistence';

const EMPTY_SPONSORS: Sponsor[] = [];

interface SponsorsManagerProps {
  translate?: (key: string) => string;
  companyId?: string | null;
  canManage?: boolean;
  onSponsorsChange?: (sponsors: Sponsor[]) => void;
  initialSponsors?: Sponsor[];
}

export function SponsorsManagerInsideHomepageControl({
  translate = (k: string) => k,
  companyId = null,
  canManage = true,
  onSponsorsChange,
  initialSponsors = EMPTY_SPONSORS
}: SponsorsManagerProps) {
  const t = translate;
  const [sponsors, setSponsors] = useState<Sponsor[]>(initialSponsors);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [tabFilter, setTabFilter] = useState<'active' | 'expired' | 'all'>('active');
  const [runningCron, setRunningCron] = useState(false);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formLogoUrl, setFormLogoUrl] = useState('');
  const [formWebsiteUrl, setFormWebsiteUrl] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTier, setFormTier] = useState<SponsorTier>('gold');
  const [formSortOrder, setFormSortOrder] = useState(0);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formIsArchived, setFormIsArchived] = useState(false);
  const [formCompanyId, setFormCompanyId] = useState<string | null>(companyId);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const prevInitialRef = React.useRef<Sponsor[]>(initialSponsors);

  // Sync with initialSponsors when provided
  useEffect(() => {
    if (initialSponsors && initialSponsors.length > 0) {
      if (JSON.stringify(initialSponsors) !== JSON.stringify(prevInitialRef.current)) {
        prevInitialRef.current = initialSponsors;
        setSponsors(initialSponsors);
      }
    }
  }, [initialSponsors]);

  // Fetch list from backend on mount
  const refreshList = async () => {
    setLoading(true);
    try {
      const list = await v2ListSponsors(companyId);
      if (Array.isArray(list) && list.length > 0) {
        setSponsors(list);
      }
    } catch (err) {
      console.warn('[SponsorsManager] refreshList error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshList();
  }, [companyId]);

  const isSponsorExpired = (sp: Sponsor) => {
    if (sp.is_archived === 1 || sp.is_archived === true || sp.status === 'EXPIRED' || sp.status === 'ARCHIVED') {
      return true;
    }
    if (!sp.end_date) return false;
    const endT = sp.end_date.length === 10 ? new Date(`${sp.end_date}T23:59:59`).getTime() : new Date(sp.end_date).getTime();
    return !isNaN(endT) && endT < Date.now();
  };

  // Routine to automatically archive expired sponsors
  const handleRunArchiveRoutine = async () => {
    setRunningCron(true);
    setErrorMsg('');
    try {
      const now = Date.now();
      const nowIso = new Date().toISOString();
      const toArchive = sponsors.filter(s => {
        if (s.is_archived === 1 || s.status === 'ARCHIVED') return false;
        if (!s.end_date) return false;
        const endT = s.end_date.length === 10 ? new Date(`${s.end_date}T23:59:59`).getTime() : new Date(s.end_date).getTime();
        return !isNaN(endT) && endT < now;
      });

      if (toArchive.length === 0) {
        setSuccessMsg(t('Hakuna mdhamini aliyepitwa na muda kwa sasa.'));
        setTimeout(() => setSuccessMsg(''), 3000);
        return;
      }

      const updated = sponsors.map(s => {
        const shouldArchive = toArchive.some(a => a.id === s.id);
        if (shouldArchive) {
          return {
            ...s,
            is_archived: 1,
            is_active: 0,
            status: 'EXPIRED' as const,
            archived_at: nowIso
          };
        }
        return s;
      });

      setSponsors(updated);
      if (onSponsorsChange) {
        setTimeout(() => onSponsorsChange(updated), 0);
      }

      // Persist all archived sponsors to backend
      for (const item of toArchive) {
        await v2UpsertSponsor({
          ...item,
          is_archived: 1,
          is_active: 0,
          status: 'EXPIRED',
          archived_at: nowIso
        });
      }

      setSuccessMsg(t(`Wadhamini ${toArchive.length} walioisha muda wamehamishiwa sehemu ya 'Expired Sponsors' kikamilifu!`));
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: any) {
      setErrorMsg(t('Hitilafu wakati wa kutekeleza routine ya kuhamisha walioisha muda: ') + (e?.message || String(e)));
    } finally {
      setRunningCron(false);
    }
  };

  const handleReactivate = async (sp: Sponsor) => {
    setLoading(true);
    try {
      // Set end_date to 1 year from now by default if expired
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      const nextEnd = nextYear.toISOString().slice(0, 10);

      const payload: Partial<Sponsor> = {
        ...sp,
        is_active: 1,
        is_archived: 0,
        status: 'ACTIVE',
        end_date: nextEnd
      };

      const resp = await v2UpsertSponsor(payload);
      if (resp && resp.success) {
        const saved: Sponsor = resp.data || { ...payload, id: sp.id } as Sponsor;
        const updated = sponsors.map(s => s.id === sp.id ? saved : s);
        setSponsors(updated);
        if (onSponsorsChange) {
          setTimeout(() => onSponsorsChange(updated), 0);
        }
        setSuccessMsg(t(`Mdhamini "${sp.name}" amerudishwa kazini (Mkataba hadi ${nextEnd}).`));
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || t('Hitilafu wakati wa kurudisha mdhamini.'));
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormName('');
    setFormLogoUrl('');
    setFormWebsiteUrl('');
    setFormDescription('');
    setFormTier('gold');
    setFormSortOrder(sponsors.length + 1);
    setFormIsActive(true);
    const today = new Date().toISOString().slice(0, 10);
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    setFormStartDate(today);
    setFormEndDate(nextYear.toISOString().slice(0, 10));
    setFormIsArchived(false);
    setFormCompanyId(companyId);
    setErrorMsg('');
    setModalOpen(true);
  };

  const openEditModal = (sp: Sponsor) => {
    setEditingId(sp.id);
    setFormName(sp.name || '');
    setFormLogoUrl(sp.logo_url || '');
    setFormWebsiteUrl(sp.website_url || '');
    setFormDescription(sp.description || '');
    setFormTier((sp.tier as SponsorTier) || 'gold');
    setFormSortOrder(Number(sp.sort_order ?? 0));
    setFormIsActive(sp.is_active === 1 || sp.is_active === true);
    setFormStartDate(sp.start_date ? sp.start_date.slice(0, 10) : '');
    setFormEndDate(sp.end_date ? sp.end_date.slice(0, 10) : '');
    setFormIsArchived(sp.is_archived === 1 || sp.is_archived === true || sp.status === 'ARCHIVED');
    setFormCompanyId(sp.company_id || null);
    setErrorMsg('');
    setModalOpen(true);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      setErrorMsg(t('Picha ya logo lazima iwe chini ya 3MB.'));
      return;
    }

    setUploadingLogo(true);
    setErrorMsg('');

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        setFormLogoUrl(base64);

        const uploadedUrl = await v2UploadSponsorLogo(base64);
        if (uploadedUrl) {
          setFormLogoUrl(uploadedUrl);
        }
        setUploadingLogo(false);
      };
      reader.onerror = () => {
        setErrorMsg(t('Imeshindwa kusoma faili la picha.'));
        setUploadingLogo(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setErrorMsg(t('Hitilafu wakati wa kupakia logo.'));
      setUploadingLogo(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setErrorMsg(t('Tafadhali jaza jina la mdhamini.'));
      return;
    }

    setSaving(true);
    setErrorMsg('');

    // Check if end_date has passed
    const nowMs = Date.now();
    const isPast = formEndDate
      ? (formEndDate.length === 10 ? new Date(`${formEndDate}T23:59:59`).getTime() : new Date(formEndDate).getTime()) < nowMs
      : false;

    const payload: Partial<Sponsor> = {
      id: editingId || undefined,
      company_id: formCompanyId || null,
      name: formName.trim(),
      logo_url: formLogoUrl.trim(),
      website_url: formWebsiteUrl.trim(),
      description: formDescription.trim(),
      tier: formTier,
      sort_order: Number(formSortOrder || 0),
      is_active: isPast ? 0 : (formIsActive ? 1 : 0),
      start_date: formStartDate || null,
      end_date: formEndDate || null,
      is_archived: isPast || formIsArchived ? 1 : 0,
      status: isPast ? 'EXPIRED' : (formIsArchived ? 'ARCHIVED' : (formIsActive ? 'ACTIVE' : 'INACTIVE')),
      archived_at: isPast || formIsArchived ? new Date().toISOString() : null
    };

    try {
      const resp = await v2UpsertSponsor(payload);
      if (resp && resp.success) {
        setSuccessMsg(editingId ? t('Mdhamini amesasishwa kikamilifu.') : t('Mdhamini mpya ameongezwa kikamilifu.'));
        setTimeout(() => setSuccessMsg(''), 3000);

        const savedItem: Sponsor = resp.data || {
          ...payload,
          id: resp.id || editingId || `sp_${Date.now()}`,
          name: formName.trim()
        } as Sponsor;

        const nextList = editingId
          ? sponsors.map(s => s.id === editingId ? savedItem : s)
          : [...sponsors, savedItem];
        nextList.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        setSponsors(nextList);
        if (onSponsorsChange) {
          setTimeout(() => onSponsorsChange(nextList), 0);
        }

        setModalOpen(false);
      } else {
        setErrorMsg(resp?.error || t('Imeshindwa kuhifadhi taarifa za mdhamini.'));
      }
    } catch (err: any) {
      setErrorMsg(err?.message || t('Hitilafu ya mtandao.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    try {
      const ok = await v2DeleteSponsor(id);
      if (ok) {
        setSuccessMsg(t('Mdhamini amefutwa kikamilifu.'));
        setTimeout(() => setSuccessMsg(''), 3000);
        const nextList = sponsors.filter(s => s.id !== id);
        setSponsors(nextList);
        if (onSponsorsChange) {
          setTimeout(() => onSponsorsChange(nextList), 0);
        }
      } else {
        setErrorMsg(t('Imeshindwa kufuta mdhamini.'));
      }
    } catch (err: any) {
      setErrorMsg(err?.message || t('Hitilafu ya mtandao wakati wa kufuta.'));
    } finally {
      setLoading(false);
      setDeleteConfirmId(null);
    }
  };

  const getTierBadge = (tier: string) => {
    switch (tier?.toLowerCase()) {
      case 'platinum':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">Platinum</span>;
      case 'silver':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-300">Silver</span>;
      case 'bronze':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-100 text-orange-800 border border-orange-200">Bronze</span>;
      case 'gold':
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">Gold</span>;
    }
  };

  if (!canManage) {
    return (
      <div className="p-8 text-center text-gray-500">
        <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
        <p className="text-sm font-bold">{t('Ruhusa Maalum Inahitajika')}</p>
        <p className="text-xs text-gray-400 mt-1">{t('Kichupo hiki kinaruhusiwa kwa Super Admin / Root Mandate pekee.')}</p>
      </div>
    );
  }

  // Segment sponsors into active vs expired/archived
  const activeSponsorsList = sponsors.filter(s => !isSponsorExpired(s) && (s.is_active === 1 || s.is_active === true));
  const expiredSponsorsList = sponsors.filter(s => isSponsorExpired(s));
  const displayedSponsors = tabFilter === 'active'
    ? activeSponsorsList
    : tabFilter === 'expired'
      ? expiredSponsorsList
      : sponsors;

  const sortedDisplayed = [...displayedSponsors].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Handshake className="w-5 h-5 text-amber-600" />
            <span className="font-bold text-gray-900 text-sm">{t('Wadhamini na Washirika wa Homepage')}</span>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              {sponsors.length} {sponsors.length === 1 ? t('Mdhamini') : t('Wadhamini')}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {t('Dhibiti wadhamini wanaotokea kwenye ukurasa wa umma. Routine ya cron huhamisha kiotomatiki wadhamini walioisha muda kwenda sehemu ya Expired Sponsors.')}
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* Cron Routine Button */}
          <button
            onClick={handleRunArchiveRoutine}
            disabled={runningCron || loading}
            className="px-3 py-2 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title={t('Tekeleza routine ya kuhamisha wadhamini walioisha muda sasa')}
          >
            <Clock className={`w-3.5 h-3.5 text-amber-600 ${runningCron ? 'animate-spin' : ''}`} />
            <span>{runningCron ? t('Inakagua...') : t('Kagua Walioisha Muda (Cron)')}</span>
          </button>

          <button
            onClick={refreshList}
            disabled={loading}
            className="px-3 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title={t('Pakia Upya')}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t('Pakia Upya')}</span>
          </button>

          <button
            onClick={openAddModal}
            className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 rounded-lg shadow-sm transition inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('Ongeza Mdhamini')}</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs: Active, Expired / Archived, All */}
      <div className="flex border-b border-gray-200 bg-white rounded-xl p-1.5 gap-1.5 shadow-xs">
        <button
          onClick={() => setTabFilter('active')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer ${
            tabFilter === 'active'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{t('Wanaofanya Kazi (Active)')}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            tabFilter === 'active' ? 'bg-amber-700 text-amber-100' : 'bg-gray-200 text-gray-700'
          }`}>
            {activeSponsorsList.length}
          </span>
        </button>

        <button
          onClick={() => setTabFilter('expired')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer ${
            tabFilter === 'expired'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Archive className="w-3.5 h-3.5" />
          <span>{t('Walioisha Muda (Expired Sponsors)')}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            tabFilter === 'expired' ? 'bg-rose-700 text-rose-100' : 'bg-rose-100 text-rose-700'
          }`}>
            {expiredSponsorsList.length}
          </span>
        </button>

        <button
          onClick={() => setTabFilter('all')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer ${
            tabFilter === 'all'
              ? 'bg-gray-800 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <span>{t('Wote (All Sponsors)')}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            tabFilter === 'all' ? 'bg-gray-900 text-gray-200' : 'bg-gray-200 text-gray-700'
          }`}>
            {sponsors.length}
          </span>
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Section info banner when in Expired Sponsors tab */}
      {tabFilter === 'expired' && (
        <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 flex items-start gap-2.5">
          <Archive className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold">{t('Sehemu ya Wadhamini Walioisha Muda (Expired Sponsors):')}</span>{' '}
            {t('Wadhamini hawa hawataonekana tena kwenye ukurasa wa umma wa tovuti kwa sababu tarehe yao ya mwisho (end_date) imekwisha au wamehifadhiwa (archived). Unaweza kubofya "Rudisha Kazini / Renew" ili kuongeza muda wao na kuwarudisha hewani.')}
          </div>
        </div>
      )}

      {/* Sponsors Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-700">
            <thead className="bg-gray-50/80 text-[10px] font-black uppercase tracking-wider text-gray-500 border-b border-gray-100">
              <tr>
                <th className="py-3 px-4">{t('Logo')}</th>
                <th className="py-3 px-4">{t('Jina')}</th>
                <th className="py-3 px-4">{t('Tier')}</th>
                <th className="py-3 px-4">{t('Mkataba (Muda)')}</th>
                <th className="py-3 px-4">{t('Hali (Status)')}</th>
                <th className="py-3 px-4 text-center">{t('Sort')}</th>
                <th className="py-3 px-4 text-right">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedDisplayed.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    <Handshake className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="font-semibold text-gray-600 text-xs">
                      {tabFilter === 'expired'
                        ? t('Hakuna mdhamini aliyepitwa na muda au kuhifadhiwa.')
                        : t('Hakuna mdhamini anayeendana na kichujio hiki.')}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      {tabFilter === 'expired'
                        ? t('Wadhamini ambao tarehe yao ya mwisho itapita wataonekana hapa kiotomatiki kupitia cron routine.')
                        : t('Bofya "Ongeza Mdhamini" ili kuanza kuongeza wadhamini wapya.')}
                    </p>
                  </td>
                </tr>
              ) : (
                sortedDisplayed.map((sp) => {
                  const expired = isSponsorExpired(sp);
                  const isActive = !expired && (sp.is_active === 1 || sp.is_active === true);
                  return (
                    <tr key={sp.id} className={`transition group ${expired ? 'bg-rose-50/20 hover:bg-rose-50/40' : 'hover:bg-amber-50/30'}`}>
                      {/* Logo */}
                      <td className="py-3 px-4">
                        <div className="w-12 h-12 rounded-lg border border-gray-200 bg-white p-1 flex items-center justify-center overflow-hidden shadow-xs">
                          {sp.logo_url ? (
                            <img
                              src={sp.logo_url}
                              alt={sp.name}
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <span className="font-black text-amber-600 text-sm">
                              {(sp.name || 'S').charAt(0)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Jina & Description & Website */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                          <span>{sp.name}</span>
                          {expired && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200">
                              {t('Expired')}
                            </span>
                          )}
                        </div>
                        {sp.description && (
                          <div className="text-[10px] text-gray-500 max-w-xs truncate mt-0.5">
                            {sp.description}
                          </div>
                        )}
                        {sp.website_url && (
                          <a
                            href={sp.website_url.startsWith('http') ? sp.website_url : `https://${sp.website_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-amber-700 hover:text-amber-900 font-medium inline-flex items-center gap-1 hover:underline text-[10px] mt-0.5"
                          >
                            <Globe className="w-3 h-3" />
                            <span className="max-w-[140px] truncate">{sp.website_url.replace(/^https?:\/\//, '')}</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                          </a>
                        )}
                      </td>

                      {/* Tier */}
                      <td className="py-3 px-4">
                        {getTierBadge(sp.tier)}
                      </td>

                      {/* Contract Dates */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5 text-[11px]">
                          {sp.end_date ? (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-gray-400" />
                              <span className={expired ? 'text-rose-600 font-bold' : 'text-gray-700'}>
                                {sp.end_date}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400 italic text-[10px]">{t('Bila ukomo')}</span>
                          )}
                          {sp.start_date && (
                            <div className="text-[10px] text-gray-400">
                              {t('Kuanzia:')} {sp.start_date}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {expired ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                            <Archive className="w-3 h-3 text-rose-600" />
                            {t('Umeisha / Archived')}
                          </span>
                        ) : isActive ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            {t('Inafanya kazi')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
                            <XCircle className="w-3 h-3 text-gray-400" />
                            {t('Imezimwa')}
                          </span>
                        )}
                      </td>

                      {/* Sort Order */}
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-bold text-[11px]">
                          {sp.sort_order ?? 0}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          {expired && (
                            <button
                              onClick={() => handleReactivate(sp)}
                              className="px-2 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-md transition inline-flex items-center gap-1 cursor-pointer"
                              title={t('Rudisha kazini na ongeza mwaka 1 wa mkataba')}
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>{t('Renew')}</span>
                            </button>
                          )}
                          <button
                            onClick={() => openEditModal(sp)}
                            className="p-1.5 text-gray-600 hover:text-amber-700 hover:bg-amber-50 rounded-md transition cursor-pointer"
                            title={t('Hariri Mdhamini')}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(sp.id)}
                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
                            title={t('Futa Mdhamini')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-100 space-y-3">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="text-center">
              <h4 className="font-bold text-gray-900 text-sm">{t('Futa Mdhamini?')}</h4>
              <p className="text-xs text-gray-500 mt-1">
                {t('Mdhamini huyu ataondolewa kwenye mfumo na hataonekana tena kwenye homepage ya umma.')}
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                {t('Ghairi')}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-sm transition cursor-pointer"
              >
                {t('Ndio, Futa')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Sponsor Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 my-8 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Handshake className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    {editingId ? t('Hariri Taarifa za Mdhamini') : t('Ongeza Mdhamini Mpya')}
                  </h3>
                  <p className="text-[11px] text-gray-500">{t('Ukurasa wa Umma wa Tanzaniatradecore.co.tz')}</p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3.5">
              {/* Jina */}
              <div>
                <label className="text-[11px] font-bold text-gray-700 block mb-1">
                  {t('Jina la Mdhamini / Shirika')} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Mfano: CRDB Bank, Vodacom M-Pesa, NMB..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Logo Upload & Preview */}
              <div>
                <label className="text-[11px] font-bold text-gray-700 block mb-1">
                  {t('Picha ya Logo')}
                </label>
                <div className="flex gap-3 items-center">
                  <div className="w-16 h-16 rounded-xl border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                    {formLogoUrl ? (
                      <img src={formLogoUrl} alt="Preview" className="w-full h-full object-contain p-1" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 cursor-pointer transition">
                      <Upload className="w-3.5 h-3.5 text-amber-600" />
                      <span>{uploadingLogo ? t('Inapakia...') : t('Chagua Picha')}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoUpload}
                        disabled={uploadingLogo}
                      />
                    </label>
                    <input
                      type="url"
                      value={formLogoUrl}
                      onChange={(e) => setFormLogoUrl(e.target.value)}
                      placeholder={t('Au ingiza URL ya logo (https://...)')}
                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-[11px] outline-none text-gray-600"
                    />
                  </div>
                </div>
              </div>

              {/* Website URL */}
              <div>
                <label className="text-[11px] font-bold text-gray-700 block mb-1">
                  {t('Tovuti / Website URL')}
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={formWebsiteUrl}
                    onChange={(e) => setFormWebsiteUrl(e.target.value)}
                    placeholder="https://mfano.co.tz"
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-xs outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Dates: Start Date & End Date (Expiry) */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50/40 rounded-xl border border-amber-200/60">
                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                    <span>{t('Tarehe ya Kuanza')}</span>
                  </label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs outline-none focus:border-amber-500 bg-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-rose-600" />
                    <span>{t('Tarehe ya Mwisho (Expiry)')}</span>
                  </label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs outline-none focus:border-amber-500 bg-white"
                  />
                  <span className="text-[10px] text-gray-500 mt-0.5 block">
                    {t('Ikipita, mdhamini huhamishwa kwenye Expired Sponsors kiotomatiki.')}
                  </span>
                </div>
              </div>

              {/* Tier & Sort Order */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">
                    {t('Kiwango (Tier)')}
                  </label>
                  <select
                    value={formTier}
                    onChange={(e) => setFormTier(e.target.value as SponsorTier)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs outline-none focus:border-amber-500 bg-white"
                  >
                    <option value="platinum">Platinum</option>
                    <option value="gold">Gold</option>
                    <option value="silver">Silver</option>
                    <option value="bronze">Bronze</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">
                    {t('Nafasi (Sort Order 0-100)')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formSortOrder}
                    onChange={(e) => setFormSortOrder(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Active Switch & Archived Switch */}
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200/70">
                  <div>
                    <div className="text-xs font-bold text-gray-800">{t('Onyesha kwenye Homepage')}</div>
                    <div className="text-[10px] text-gray-500">{t('Zima ili kuficha mdhamini huyu bila kumfuta')}</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                  </label>
                </div>

                {editingId && (
                  <div className="flex items-center justify-between p-3 bg-rose-50/50 rounded-xl border border-rose-200/70">
                    <div>
                      <div className="text-xs font-bold text-rose-900">{t('Weka kwenye Expired / Archived')}</div>
                      <div className="text-[10px] text-rose-600">{t('Huondoa kadi hii kwenye homepage na kuihifadhi')}</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formIsArchived}
                        onChange={(e) => setFormIsArchived(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-600"></div>
                    </label>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="text-[11px] font-bold text-gray-700 block mb-1">
                  {t('Maelezo Mafupi (Hiari)')}
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder={t('Maelezo mafupi kuhusu ushirikiano au huduma za mdhamini...')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs outline-none resize-none focus:border-amber-500"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  {t('Ghairi')}
                </button>
                <button
                  type="submit"
                  disabled={saving || uploadingLogo}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-lg text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {saving ? t('Inahifadhi...') : t('Hifadhi Mdhamini')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Full HomepageControl Component with Tabs
export default function HomepageControl({
  translate = (k: string) => k,
  companyId = null,
  canManage = true,
  sponsors = EMPTY_SPONSORS,
  onSponsorsChange,
  children
}: {
  translate?: (k: string) => string;
  companyId?: string | null;
  canManage?: boolean;
  sponsors?: Sponsor[];
  onSponsorsChange?: (sponsors: Sponsor[]) => void;
  children?: React.ReactNode;
}) {
  const t = translate;
  const [activeTab, setActiveTab] = useState<'content' | 'sponsors'>('content');

  return (
    <div className="space-y-4">
      {/* Subtabs Header */}
      <div className="flex border-b border-gray-200 bg-white rounded-t-xl px-4 pt-3 gap-2">
        <button
          onClick={() => setActiveTab('content')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'content'
              ? 'border-b-2 border-amber-600 text-amber-700 bg-amber-50/50'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>{t('Ukurasa Mkuu / Hero & Sections')}</span>
        </button>

        <button
          onClick={() => setActiveTab('sponsors')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'sponsors'
              ? 'border-b-2 border-amber-600 text-amber-700 bg-amber-50/50'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Handshake className="w-4 h-4" />
          <span>{t('Wadhamini / Sponsors')}</span>
          {sponsors && sponsors.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
              {sponsors.length}
            </span>
          )}
        </button>
      </div>

      {/* Subtab Content */}
      <div>
        {activeTab === 'content' ? (
          children
        ) : (
          <SponsorsManagerInsideHomepageControl
            translate={t}
            companyId={companyId}
            canManage={canManage}
            initialSponsors={sponsors}
            onSponsorsChange={onSponsorsChange}
          />
        )}
      </div>
    </div>
  );
}

