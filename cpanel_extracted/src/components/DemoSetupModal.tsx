import React, { useState } from 'react';
import { Zap, X, User, Lock, CheckCircle2 } from 'lucide-react';

interface DemoSetupModalProps {
  translate: (text: string) => string;
  onConfirm: (data: { username: string; password: string }) => void;
  onClose: () => void;
}

export default function DemoSetupModal({ translate: t, onConfirm, onClose }: DemoSetupModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || username.trim().length < 3) {
      setError(t('Choose a username with at least 3 characters.'));
      return;
    }
    if (!password || password.length < 6) {
      setError(t('Password must be at least 6 characters.'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('Passwords do not match.'));
      return;
    }
    onConfirm({ username: username.trim().toLowerCase(), password });
  };

  const inputCls =
    'w-full px-3 py-2 border border-white/10 rounded-lg text-xs bg-white/5 text-white outline-none focus:ring-2 focus:ring-amber-400/40 placeholder-gray-500 font-medium';

  return (
    <div className="fixed inset-0 z-[90] bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#2d323e] rounded-2xl shadow-2xl border border-amber-500/30 overflow-hidden">
        <div className="px-6 pt-6 pb-4 bg-gradient-to-br from-[#2d323e] to-[#1f242d] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-black text-white uppercase tracking-wide">1-Day Free Demo</div>
              <div className="text-[10px] text-gray-400 font-semibold">{t('Create your own demo sign-in credentials')}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-[11px] font-semibold text-red-300">{error}</div>
          )}

          <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            <p className="text-[10px] text-gray-300 font-semibold leading-relaxed">
              {t('Set a username and password you will remember. Your demo gives you a restricted wholesale workspace for 1 day.')}
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('Demo Username')}</label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={inputCls + ' pl-9'}
                placeholder="e.g. demo_wholesale"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('Password')}</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls + ' pl-9 pr-14'}
                placeholder="Minimum 6 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 hover:text-amber-400"
              >
                {showPassword ? t('Hide') : t('Show')}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('Confirm Password')}</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputCls}
              placeholder="Re-enter your password"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-[#1f242d] text-xs font-black rounded-lg tracking-wider uppercase shadow transition cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 inline mr-1.5" />
            {t('Start Demo')}
          </button>
        </form>
      </div>
    </div>
  );
}
