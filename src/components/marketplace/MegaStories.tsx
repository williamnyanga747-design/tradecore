import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Eye, Trash2, Plus, ImagePlus, Video, Package, ChevronLeft, ChevronRight } from 'lucide-react';
import { Company, MarketplaceProduct, Story } from '../../types';
import { getPublicTheme, PublicTheme } from '../../utils/publicTheme';
import { TZS, TFunc } from './MarketplaceShared';
import { timeAgo } from '../../utils/megaHelpers';

// ============================================================================
// F8 — STORIES KAMA INSTAGRAM (24H)
// ============================================================================

export interface StoryGroup {
  company: Company;
  items: Story[];
}

interface BarProps {
  theme: PublicTheme;
  t: TFunc;
  stories: Story[]; // active, non-expired
  companies: Company[];
  products: MarketplaceProduct[];
  buyerPhone?: string | null;
  onView: (storyId: number) => void;
  onOpenProduct: (product: MarketplaceProduct) => void;
}

/** Homepage top stories bar — gradient rings like Instagram. */
export function StoriesBar({ theme, t, stories, companies, products, buyerPhone, onView, onOpenProduct }: BarProps) {
  const th = getPublicTheme(theme);
  const [viewerGroup, setViewerGroup] = useState<number | null>(null); // company id

  const groups = useMemo(() => {
    const now = Date.now();
    const live = stories.filter(s => s.isActive !== false && new Date(s.expiresAt).getTime() > now);
    const byCompany = new Map<number, Story[]>();
    for (const s of live) {
      const arr = byCompany.get(s.companyId) || [];
      arr.push(s);
      byCompany.set(s.companyId, arr);
    }
    return [...byCompany.entries()]
      .map(([cid, items]) => ({
        company: companies.find(c => c.id === cid),
        items: items.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      }))
      .filter((g): g is StoryGroup => !!g.company && g.items.length > 0);
  }, [stories, companies]);

  if (groups.length === 0) return null;

  const group = groups.find(g => g.company.id === viewerGroup) || null;

  return (
    <>
      <div className="flex gap-3.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {groups.map(g => (
          <button
            key={g.company.id}
            onClick={() => setViewerGroup(g.company.id)}
            className="flex flex-col items-center gap-1 shrink-0 w-[68px] cursor-pointer group"
          >
            <span className="block p-[2.5px] rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 group-hover:scale-105 transition-transform">
              <span className={`block p-[2px] rounded-full ${theme === 'milk' ? 'bg-white' : 'bg-gray-900'}`}>
                <span className="block w-12 h-12 rounded-full overflow-hidden">
                  {g.company.logoUrl ? (
                    <img src={g.company.logoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center bg-gradient-to-br from-yellow-400 to-amber-600 text-white text-base font-black">
                      {(g.company?.name || '-').charAt(0)}
                    </span>
                  )}
                </span>
              </span>
            </span>
            <span className={`text-[9px] font-bold truncate w-full text-center ${th.textMuted}`}>{g.company.name.split(' ')[0]}</span>
          </button>
        ))}
      </div>

      {group && (
        <StoryViewer
          theme={theme}
          t={t}
          group={group}
          products={products}
          buyerPhone={buyerPhone}
          onClose={() => setViewerGroup(null)}
          onView={onView}
          onOpenProduct={(p) => { setViewerGroup(null); onOpenProduct(p); }}
        />
      )}
    </>
  );
}

interface ViewerProps {
  theme: PublicTheme;
  t: TFunc;
  group: StoryGroup;
  products: MarketplaceProduct[];
  buyerPhone?: string | null;
  onClose: () => void;
  onView: (storyId: number) => void;
  onOpenProduct: (product: MarketplaceProduct) => void;
}

/** Full-screen story viewer with progress bars + auto advance. */
export function StoryViewer({ theme, t, group, products, buyerPhone, onClose, onView, onOpenProduct }: ViewerProps) {
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const viewedRef = useRef<Set<number>>(new Set());
  const story = group.items[idx];

  const next = () => {
    if (idx < group.items.length - 1) { setIdx(idx + 1); setProgress(0); }
    else onClose();
  };
  const prev = () => {
    if (idx > 0) { setIdx(idx - 1); setProgress(0); }
  };

  // record a view once per story per mount
  useEffect(() => {
    if (!story || viewedRef.current.has(story.id)) return;
    viewedRef.current.add(story.id);
    onView(story.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  // auto-advance timer for images (5s); videos advance onEnded
  useEffect(() => {
    if (!story || story.type !== 'image') return;
    const started = Date.now();
    const DURATION = 5000;
    const id = window.setInterval(() => {
      const p = Math.min(100, ((Date.now() - started) / DURATION) * 100);
      setProgress(p);
      if (p >= 100) {
        window.clearInterval(id);
        next();
      }
    }, 50);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, story?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  if (!story) return null;
  const linkedProduct = story.productId ? products.find(p => p.id === story.productId) : null;

  return (
    <div className="fixed inset-0 z-[80] bg-black flex flex-col">
      {/* progress bars */}
      <div className="absolute top-2 left-2 right-2 z-20 flex gap-1">
        {group.items.map((s, i) => (
          <div key={s.id} className="h-[3px] flex-1 rounded-full bg-white/25 overflow-hidden">
            <div
              className="h-full bg-white transition-none"
              style={{ width: i < idx ? '100%' : i === idx ? `${progress}%` : '0%' }}
            />
          </div>
        ))}
      </div>

      {/* header */}
      <div className="absolute top-5 left-3 right-3 z-20 flex items-center gap-2.5">
        <span className="w-9 h-9 rounded-full overflow-hidden border border-white/40 shrink-0">
          {group.company.logoUrl
            ? <img src={group.company.logoUrl} alt="" className="w-full h-full object-cover" />
            : <span className="w-full h-full flex items-center justify-center bg-gradient-to-br from-yellow-400 to-amber-600 text-white text-sm font-black">{(group.company?.name || '-').charAt(0)}</span>}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-white text-[12px] font-black truncate">{group.company.name}</div>
          <div className="text-white/60 text-[9px] font-bold">{timeAgo(story.createdAt)}</div>
        </div>
        <button onClick={onClose} className="p-2 text-white/90 hover:text-white cursor-pointer"><X className="w-6 h-6" /></button>
      </div>

      {/* media */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden" onClick={(e) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        if (x < rect.width * 0.35) prev(); else next();
      }}>
        {story.type === 'image' ? (
          <img src={story.mediaPath} alt="" className="max-h-full max-w-full object-contain" draggable={false} />
        ) : (
          <video
            ref={videoRef}
            src={story.mediaPath}
            autoPlay
            playsInline
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (v.duration > 0) setProgress((v.currentTime / v.duration) * 100);
            }}
            onEnded={next}
            className="max-h-full max-w-full object-contain"
          />
        )}

        {/* tap zone hints (desktop) */}
        <button onClick={(e) => { e.stopPropagation(); prev(); }} className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white cursor-pointer">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); next(); }} className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white cursor-pointer">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* footer: caption + product card */}
      {(story.caption || linkedProduct) && (
        <div className="absolute bottom-0 left-0 right-0 z-20 p-4 pb-6 space-y-3 bg-gradient-to-t from-black/85 to-transparent">
          {story.caption && <p className="text-white text-[13px] font-semibold text-center">{story.caption}</p>}
          {linkedProduct && (
            <div className="mx-auto max-w-sm bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-3 flex items-center gap-3">
              <span className="w-12 h-12 rounded-xl overflow-hidden shrink-0">
                {linkedProduct.image
                  ? <img src={linkedProduct.image} alt="" className="w-full h-full object-cover" />
                  : <Package className="w-6 h-6 m-auto text-white" />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-white text-[11px] font-black truncate">{linkedProduct.name}</span>
                <span className="block text-emerald-300 text-[11px] font-black">{TZS(linkedProduct.price)}</span>
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); onOpenProduct(linkedProduct); }}
                className="shrink-0 px-4 py-2 rounded-xl bg-white text-black text-[10px] font-black cursor-pointer hover:bg-gray-200"
              >
                {t('Nunua Sasa')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// COMPANY PANEL — create / manage stories
// ============================================================================

// Upload tiers: free plan vs Premium (subscriptionApproved companies)
const FREE_MAX_MB = 100;
const FREE_MAX_SEC = 180; // 3 min
const PREMIUM_MAX_MB = 500;
const PREMIUM_MAX_SEC = 600; // 10 min

interface MgrProps {
  theme: PublicTheme;
  t: TFunc;
  companyId: number;
  stories: Story[]; // this company's stories (any state)
  products: MarketplaceProduct[]; // own products
  isPremium?: boolean;
  onCreate: (input: { type: 'image' | 'video'; mediaPath: string; caption?: string; productId?: number | null; fileSizeBytes?: number; videoDurationSeconds?: number }) => { ok: boolean; error?: string };
  onDelete: (storyId: number) => void;
}

export function CompanyStoriesManager({ theme, t, companyId, stories, products, isPremium, onCreate, onDelete }: MgrProps) {
  const th = getPublicTheme(theme);
  const [type, setType] = useState<'image' | 'video'>('image');
  const [media, setMedia] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [productId, setProductId] = useState<string>('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [reading, setReading] = useState(false);
  const [fileMeta, setFileMeta] = useState<{ sizeMb: string; durationSec?: number } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const pendingMetaRef = useRef<{ fileSizeBytes?: number; videoDurationSeconds?: number }>({});

  const maxMb = isPremium ? PREMIUM_MAX_MB : FREE_MAX_MB;
  const maxSec = isPremium ? PREMIUM_MAX_SEC : FREE_MAX_SEC;

  const probeVideoDuration = (file: File): Promise<number> =>
    new Promise((resolve) => {
      try {
        const url = URL.createObjectURL(file);
        const v = document.createElement('video');
        v.preload = 'metadata';
        v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Number.isFinite(v.duration) ? v.duration : 0); };
        v.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
        v.src = url;
      } catch { resolve(0); }
    });

  const now = Date.now();
  const active = stories.filter(s => s.isActive !== false && new Date(s.expiresAt).getTime() > now);
  const expired = stories.filter(s => !active.includes(s));

  const onFile = async (file: File | null) => {
    setError('');
    setFileMeta(null);
    if (!file) return;
    if (file.size > maxMb * 1024 * 1024) {
      return setError(isPremium ? t('File exceeds the 500MB limit.') : t('File exceeds the 100MB free limit.'));
    }
    const isVideo = file.type.startsWith('video/');
    let durationSec: number | undefined;
    if (isVideo) {
      durationSec = Math.round(await probeVideoDuration(file));
      if (durationSec > maxSec) {
        return setError(isPremium ? t('Video exceeds the 10-minute limit.') : t('Video exceeds the 3-minute limit on the free plan.'));
      }
    }
    const reader = new FileReader();
    reader.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.min(99, Math.round((e.loaded / e.total) * 100))); };
    reader.onloadstart = () => { setReading(true); setProgress(1); };
    reader.onload = () => {
      setReading(false);
      setProgress(100);
      if (typeof reader.result === 'string') {
        setType(isVideo ? 'video' : 'image');
        setMedia(reader.result);
        setFileMeta({ sizeMb: (file.size / (1024 * 1024)).toFixed(1), durationSec });
        pendingMetaRef.current = { fileSizeBytes: file.size, videoDurationSeconds: durationSec };
      }
    };
    reader.onerror = () => { setReading(false); setError(t('Could not create the story.')); };
    reader.readAsDataURL(file);
  };

  const submit = () => {
    setError('');
    if (!media) return setError(t('Choose a photo or video first.'));
    const res = onCreate({
      type,
      mediaPath: media,
      caption: caption.trim() || undefined,
      productId: productId ? Number(productId) : null,
      fileSizeBytes: pendingMetaRef.current.fileSizeBytes,
      videoDurationSeconds: pendingMetaRef.current.videoDurationSeconds
    });
    if (res.ok) { setMedia(''); setCaption(''); setProductId(''); setFileMeta(null); pendingMetaRef.current = {}; }
    else setError(res.error || t('Could not create the story.'));
  };

  return (
    <div className="space-y-5">
      <div className="grid md:grid-cols-2 gap-4">
        {/* create form */}
        <div className={`${th.card} ${th.cardBorder} rounded-2xl p-4 space-y-3`}>
          <h3 className={`text-xs font-black flex items-center gap-2 ${th.strongText}`}><Plus className="w-4 h-4 text-amber-500" /> {t('Create Story (Duration: 72 Hours)')}</h3>
          {!isPremium && (
            <div className="text-[10px] font-bold text-amber-600 bg-amber-500/10 border border-amber-500/40 rounded-lg px-3 py-1.5">
              ⬆ {t('Upgrade to SA to upload up to 500MB')}
            </div>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={reading}
            className={`w-full flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed cursor-pointer disabled:opacity-60 ${th.cardBorder} hover:brightness-105`}
          >
            {media ? (
              type === 'image'
                ? <img src={media} alt="" className="max-h-36 rounded-lg" />
                : <video src={media} className="max-h-36 rounded-lg" muted />
            ) : (
              <>
                {type === 'image' ? <ImagePlus className={`w-7 h-7 ${th.textDim}`} /> : <Video className={`w-7 h-7 ${th.textDim}`} />}
                <span className={`text-[11px] font-bold ${th.textMuted}`}>{t('Tap to upload a photo or video')}</span>
                <span className={`text-[9px] font-semibold ${th.textDim}`}>
                  {t('Free plan: up to 100MB & 3 minutes')} · {t('Premium: up to 500MB & 10 minutes')}
                </span>
              </>
            )}
          </button>
          {reading && (
            <div className="space-y-1">
              <div className={`text-[10px] font-bold ${th.textMuted}`}>{t('Uploading')}… {progress}%</div>
              <div className="h-1.5 w-full bg-black/10 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          )}
          {!reading && fileMeta && (
            <div className={`flex flex-wrap items-center gap-2 text-[9px] font-bold ${th.textMuted}`}>
              <span className="px-2 py-0.5 rounded-full bg-black/5">{t('File size')}: {fileMeta.sizeMb} MB</span>
              {fileMeta.durationSec !== undefined && (
                <span className="px-2 py-0.5 rounded-full bg-black/5">{t('Duration')}: {Math.floor(fileMeta.durationSec / 60)}:{String(fileMeta.durationSec % 60).padStart(2, '0')}</span>
              )}
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { onFile(e.target.files?.[0] || null); e.currentTarget.value = ''; }} />
          <div>
            <label className={`block text-[10px] font-black uppercase mb-1 ${th.label}`}>{t('Caption')}</label>
            <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder={t('Example: Today only SALE!')} className={th.input} />
          </div>
          <div>
            <label className={`block text-[10px] font-black uppercase mb-1 ${th.label}`}>{t('Link Products (Optional)')}</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className={th.input + ' cursor-pointer'}>
              <option value="">-- {t('Bidhaa')} --</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {error && <div className="text-[11px] font-bold text-red-400 bg-red-500/10 border border-red-500/40 rounded-lg px-3 py-2">{error}</div>}
          <button onClick={submit} disabled={!media || reading} className={`w-full px-4 py-2.5 text-[11px] font-black rounded-xl cursor-pointer disabled:opacity-40 ${th.btnPrimary} ${th.btnPrimaryText}`}>
            {t('Publish Story')}
          </button>
        </div>

        {/* active stories */}
        <div className={`${th.card} ${th.cardBorder} rounded-2xl p-4`}>
          <h3 className={`text-xs font-black mb-3 ${th.strongText}`}>{t('Active Stories')} ({active.length})</h3>
          {active.length === 0 && <div className={`text-[11px] font-semibold ${th.textMuted}`}>{t('No stories yet.')}</div>}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {active.map(s => (
              <div key={s.id} className={`${th.cardBorder} border rounded-xl overflow-hidden`}>
                <div className="aspect-[9/16] bg-black/30 relative">
                  {s.type === 'image'
                    ? <img src={s.mediaPath} alt="" className="w-full h-full object-cover" />
                    : <video src={s.mediaPath} className="w-full h-full object-cover" muted />}
                  <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-black/60 text-white text-[8px] font-black flex items-center gap-1">
                    <Eye className="w-2.5 h-2.5" /> {s.views}
                  </span>
                </div>
                <div className="p-2 space-y-1">
                  <div className={`text-[9px] font-bold truncate ${th.textMuted}`}>{s.caption || t('No caption')}</div>
                  <div className={`text-[8px] font-bold ${th.textDim}`}>
                    {t('Expires in')} {Math.max(0, Math.floor((new Date(s.expiresAt).getTime() - now) / 3600000))}h
                  </div>
                  <button onClick={() => onDelete(s.id)} className={`w-full flex items-center justify-center gap-1 text-[9px] font-black py-1 rounded-lg cursor-pointer bg-red-500/10 text-red-400 hover:bg-red-500/20`}>
                    <Trash2 className="w-3 h-3" /> {t('Delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {expired.length > 0 && (
        <div className={`text-[10px] font-semibold ${th.textDim}`}>{t('Expired stories')}: {expired.length}</div>
      )}
    </div>
  );
}
