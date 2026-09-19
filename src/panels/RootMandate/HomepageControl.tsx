import React, { useState, useEffect } from 'react';
import {
  Handshake, Plus, Edit2, Trash2, Globe, ExternalLink, Upload,
  CheckCircle2, XCircle, Image as ImageIcon, AlertCircle, RefreshCw, Eye
} from 'lucide-react';
import { Sponsor, SponsorTier } from '../../types';
import {
  v2ListSponsors,
  v2UpsertSponsor,
  v2DeleteSponsor,
  v2UploadSponsorLogo
} from '../../utils/normalizedPersistence';

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
  initialSponsors = []
}: SponsorsManagerProps) {
  const t = translate;
  const [sponsors, setSponsors] = useState<Sponsor[]>(initialSponsors);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formLogoUrl, setFormLogoUrl] = useState('');
  const [formWebsiteUrl, setFormWebsiteUrl] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTier, setFormTier] = useState<SponsorTier>('gold');
  const [formSortOrder, setFormSortOrder] = useState(0);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formCompanyId, setFormCompanyId] = useState<string | null>(companyId);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Sync with initialSponsors when provided
  useEffect(() => {
    if (initialSponsors && initialSponsors.length > 0) {
      setSponsors(initialSponsors);
    }
  }, [initialSponsors]);

  // Fetch list from backend on mount
  const refreshList = async () => {
    setLoading(true);
    try {
      const list = await v2ListSponsors(companyId);
      if (Array.isArray(list) && list.length > 0) {
        setSponsors(list);
        if (onSponsorsChange) onSponsorsChange(list);
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

  const openAddModal = () => {
    setEditingId(null);
    setFormName('');
    setFormLogoUrl('');
    setFormWebsiteUrl('');
    setFormDescription('');
    setFormTier('gold');
    setFormSortOrder(sponsors.length + 1);
    setFormIsActive(true);
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
    setFormCompanyId(sp.company_id || null);
    setErrorMsg('');
    setModalOpen(true);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (< 3MB)
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
        setFormLogoUrl(base64); // Instant local preview

        // Upload to server
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

    const payload: Partial<Sponsor> = {
      id: editingId || undefined,
      company_id: formCompanyId || null,
      name: formName.trim(),
      logo_url: formLogoUrl.trim(),
      website_url: formWebsiteUrl.trim(),
      description: formDescription.trim(),
      tier: formTier,
      sort_order: Number(formSortOrder || 0),
      is_active: formIsActive ? 1 : 0
    };

    try {
      const resp = await v2UpsertSponsor(payload);
      if (resp && resp.success) {
        setSuccessMsg(editingId ? t('Mdhamini amesasishwa kikamilifu.') : t('Mdhamini mpya ameongezwa kikamilifu.'));
        setTimeout(() => setSuccessMsg(''), 3000);

        // Update local state optimistically
        const savedItem: Sponsor = resp.data || {
          ...payload,
          id: resp.id || editingId || `sp_${Date.now()}`,
          tier: formTier,
          is_active: formIsActive ? 1 : 0,
          sort_order: Number(formSortOrder || 0),
          status: 'ACTIVE',
          name: formName.trim()
        } as Sponsor;

        setSponsors(prev => {
          let updated: Sponsor[];
          if (editingId) {
            updated = prev.map(s => s.id === editingId ? savedItem : s);
          } else {
            updated = [...prev, savedItem];
          }
          updated.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
          if (onSponsorsChange) onSponsorsChange(updated);
          return updated;
        });

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
        setSponsors(prev => {
          const updated = prev.filter(s => s.id !== id);
          if (onSponsorsChange) onSponsorsChange(updated);
          return updated;
        });
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

  const sortedSponsors = [...sponsors].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Handshake className="w-5 h-5 text-amber-600" />
            <span className="font-bold text-gray-900 text-sm">{t('Wadhamini na Washirika wa Homepage')}</span>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              {sortedSponsors.length} {sortedSponsors.length === 1 ? t('Mdhamini') : t('Wadhamini')}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {t('Dhibiti wadhamini wanaotokea kwenye ukurasa wa umma wa Tanzaniatradecore.co.tz. Mabadiliko yanaonekana moja kwa moja bila kuchelewa.')}
          </p>
        </div>

        <div className="flex items-center gap-2">
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

      {/* Sponsors Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-700">
            <thead className="bg-gray-50/80 text-[10px] font-black uppercase tracking-wider text-gray-500 border-b border-gray-100">
              <tr>
                <th className="py-3 px-4">{t('Logo')}</th>
                <th className="py-3 px-4">{t('Jina')}</th>
                <th className="py-3 px-4">{t('Tier')}</th>
                <th className="py-3 px-4">{t('Website')}</th>
                <th className="py-3 px-4 text-center">{t('Sort')}</th>
                <th className="py-3 px-4 text-center">{t('Active')}</th>
                <th className="py-3 px-4 text-right">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedSponsors.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    <Handshake className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="font-semibold text-gray-600 text-xs">{t('Hakuna mdhamini aliyesajiliwa bado.')}</p>
                    <p className="text-[11px] text-gray-400 mt-1">{t('Bofya "Ongeza Mdhamini" ili kuanza kuongeza wadhamini wa ukurasa wa mwanzo.')}</p>
                  </td>
                </tr>
              ) : (
                sortedSponsors.map((sp) => {
                  const isActive = sp.is_active === 1 || sp.is_active === true;
                  return (
                    <tr key={sp.id} className="hover:bg-amber-50/30 transition group">
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

                      {/* Jina & Description */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-gray-900 text-xs">{sp.name}</div>
                        {sp.description && (
                          <div className="text-[10px] text-gray-500 max-w-xs truncate mt-0.5">
                            {sp.description}
                          </div>
                        )}
                        <div className="text-[9px] text-gray-400 mt-0.5">
                          {sp.company_id ? `Kampuni: ${sp.company_id}` : t('Global (Ukurasa wa Mwanzo)')}
                        </div>
                      </td>

                      {/* Tier */}
                      <td className="py-3 px-4">
                        {getTierBadge(sp.tier)}
                      </td>

                      {/* Website */}
                      <td className="py-3 px-4">
                        {sp.website_url ? (
                          <a
                            href={sp.website_url.startsWith('http') ? sp.website_url : `https://${sp.website_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-amber-700 hover:text-amber-900 font-semibold inline-flex items-center gap-1 hover:underline text-[11px]"
                          >
                            <Globe className="w-3.5 h-3.5" />
                            <span className="max-w-[140px] truncate">{sp.website_url.replace(/^https?:\/\//, '')}</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                          </a>
                        ) : (
                          <span className="text-gray-400 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Sort Order */}
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-bold text-[11px]">
                          {sp.sort_order ?? 0}
                        </span>
                      </td>

                      {/* Active Status */}
                      <td className="py-3 px-4 text-center">
                        {isActive ? (
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

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
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
                  {t('Picha ya Logo (Upload to /uploads/sponsors/)')}
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
                      placeholder={t('Au ingiza URL ya logo moja kwa moja (https://...)')}
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

              {/* Active Switch */}
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
  sponsors = [],
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
