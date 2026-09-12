// =============================================================
// MEGA ULTIMATE — TAFTA KWA SAUTI: search stats panel.
// Shows every Swahili voice query, transcript, matches and time.
// CRITICAL FIX Part 1 — per-row delete + Clear All controls.
// =============================================================
import React, { useMemo, useState } from 'react';
import { Mic, Search, TrendingUp, BarChart3, Trash2 } from 'lucide-react';
import { VoiceSearchLog } from '../types';

interface VoiceSearchStatsPanelProps {
  voiceSearches: VoiceSearchLog[];
  t: (text: string) => string;
  onDeleteVoiceSearch?: (id: number) => void;
  onClearVoiceHistory?: () => void;
}

export default function VoiceSearchStatsPanel({ voiceSearches, t, onDeleteVoiceSearch, onClearVoiceHistory }: VoiceSearchStatsPanelProps) {
  const [confirmClear, setConfirmClear] = useState(false);
  const total = voiceSearches.length;
  const matched = voiceSearches.filter(v => v.matches > 0).length;
  const topQueries = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const v of voiceSearches) {
      const q = String(v.query || '').trim().toLowerCase();
      if (!q) continue;
      counts[q] = (counts[q] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [voiceSearches]);

  const handleDeleteRow = (id: number) => {
    if (onDeleteVoiceSearch) onDeleteVoiceSearch(id);
  };

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-5 text-white shadow-lg">
        <div className="text-[11px] font-bold uppercase tracking-wider opacity-80 inline-flex items-center gap-1.5"><Mic className="w-4 h-4" /> {t('TAFTA KWA SAUTI — Stats')}</div>
        <div className="grid grid-cols-3 gap-4 mt-3 max-w-lg">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{t('Voice Queries')}</div>
            <div className="text-2xl font-black mt-0.5">{total}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{t('With Results')}</div>
            <div className="text-2xl font-black mt-0.5">{matched}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{t('Match Rate')}</div>
            <div className="text-2xl font-black mt-0.5">{total ? Math.round((matched / total) * 100) : 0}%</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div className="font-bold text-sm inline-flex items-center gap-1.5"><BarChart3 className="w-4 h-4 text-indigo-500" /> {t('Voice Search History')}</div>
            {total > 0 && onClearVoiceHistory && (
              <button
                onClick={() => setConfirmClear(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> {t('Clear All')}
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-3 font-bold">{t('Query')}</th>
                  <th className="py-2 pr-3 font-bold">{t('Transcript')}</th>
                  <th className="py-2 pr-3 font-bold">{t('Results')}</th>
                  <th className="py-2 pr-3 font-bold">{t('Time')}</th>
                  <th className="py-2 font-bold w-8"></th>
                </tr>
              </thead>
              <tbody>
                {[...voiceSearches].slice(0, 50).map(v => (
                  <tr key={v.id} className="border-b border-gray-100 group">
                    <td className="py-2 pr-3 font-black text-gray-800">{v.query || '—'}</td>
                    <td className="py-2 pr-3 text-gray-500 max-w-48 truncate">{v.transcript}</td>
                    <td className="py-2 pr-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${v.matches > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{v.matches}</span>
                    </td>
                    <td className="py-2 pr-3 text-gray-400">{new Date(v.createdAt).toLocaleString()}</td>
                    <td className="py-2">
                      {onDeleteVoiceSearch && (
                        <button
                          onClick={() => handleDeleteRow(v.id)}
                          title={t('Delete')}
                          className="p-1.5 rounded-md text-gray-300 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {total === 0 && <tr><td colSpan={5} className="py-6 text-center text-gray-400 font-medium">{t('No voice searches yet.')}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="font-bold text-sm mb-3 inline-flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-indigo-500" /> {t('Top Voice Queries')}</div>
          <div className="space-y-2">
            {topQueries.map(([q, c], i) => (
              <div key={i} className="flex items-center justify-between gap-2 border border-gray-100 rounded-lg px-3 py-2">
                <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5"><Search className="w-3 h-3 text-gray-400" /> {q}</span>
                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{c}</span>
              </div>
            ))}
            {topQueries.length === 0 && <div className="py-6 text-center text-gray-400 font-medium text-xs">{t('No data yet.')}</div>}
          </div>
        </div>
      </div>

      {confirmClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 max-w-sm w-full p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-red-100 text-red-600 shrink-0"><Trash2 className="w-5 h-5" /></div>
              <div>
                <div className="text-sm font-bold text-gray-900">{t('Clear All')}</div>
                <div className="text-xs text-gray-500 font-medium mt-1">{t('Clear the entire voice search history? This cannot be undone.')}</div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmClear(false)} className="px-3 py-2 text-[11px] font-bold text-gray-500 hover:bg-gray-100 rounded-lg cursor-pointer">{t('Cancel')}</button>
              <button
                onClick={() => { setConfirmClear(false); onClearVoiceHistory?.(); }}
                className="px-4 py-2 text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
              >
                {t('Clear All')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
