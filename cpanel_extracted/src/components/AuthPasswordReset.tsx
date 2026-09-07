import React, { useState } from 'react';
import { ArrowLeft, KeyRound, Mail, ShieldAlert, CheckCircle2, ExternalLink } from 'lucide-react';
import { getPhpConfig } from '../utils/api';
import { getPublicTheme, PublicTheme, GoldenTopLine, PublicThemeToggle } from '../utils/publicTheme';

interface AuthPasswordResetProps {
  mode: 'forgot' | 'reset';
  token?: string | null;
  translate: (text: string) => string;
  theme: PublicTheme;
  onToggleTheme: () => void;
  onBackToLogin: () => void;
}

function buildAuthUrl(endpoint: string): string {
  const { apiUrl } = getPhpConfig();
  if (!apiUrl) return `/api/${endpoint}`;
  const sep = apiUrl.includes('?') ? '&' : '?';
  return `${apiUrl}${sep}action=${endpoint}`;
}

export default function AuthPasswordReset({ mode, token, translate: t, theme, onToggleTheme, onBackToLogin }: AuthPasswordResetProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [detail, setDetail] = useState('');
  const [testToken, setTestToken] = useState<string | null>(null);
  const [testUrl, setTestUrl] = useState('');
  const [done, setDone] = useState(false);

  const submitForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setDetail('');
    setMessage('');
    setTestToken(null);
    setTestUrl('');
    setLoading(true);
    try {
      const res = await fetch(buildAuthUrl('forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });
      const data = await res.json().catch(() => ({}));
      if (data && data.success) {
        setMessage(data.message || t('If an account exists for that email, a reset link has been sent.'));
        if (data.sent === false && data.token) {
          setTestToken(data.token as string);
          setTestUrl(data.resetUrl || `${window.location.origin}/reset-password?token=${encodeURIComponent(data.token)}`);
        }
      } else {
        setError(data?.error || t('Unable to process the request. Please try again later.'));
        setDetail(typeof data?.detail === 'string' && data.detail ? data.detail : '');
      }
    } catch (err) {
      setError(t('Network error. Please check your connection and try again.'));
    } finally {
      setLoading(false);
    }
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (password.length < 6) {
      setError(t('New password must be at least 6 characters long.'));
      return;
    }
    if (password !== confirm) {
      setError(t('New passwords do not match.'));
      return;
    }
    if (!token) {
      setError(t('Missing reset token. Please use the link from your email.'));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(buildAuthUrl('reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });
      const data = await res.json().catch(() => ({}));
      if (data && data.success) {
        setDone(true);
        setMessage(data.message || t('Your password has been reset.'));
      } else {
        setError(data?.error || t('Unable to reset your password. The link may be invalid or expired.'));
      }
    } catch (err) {
      setError(t('Network error. Please check your connection and try again.'));
    } finally {
      setLoading(false);
    }
  };

  const backToLogin = () => {
    setMessage('');
    setError('');
    setDetail('');
    setDone(false);
    setTestToken(null);
    onBackToLogin();
  };

  const th = getPublicTheme(theme);
  const milk = theme === 'milk';

  const inputCls = th.input;

  return (
    <div className={`relative min-h-screen flex items-center justify-center p-4 ${th.root}`}>
      <div className="absolute top-0 left-0 right-0"><GoldenTopLine theme={theme} /></div>
      <div className="absolute top-4 right-4 z-20">
        <PublicThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
      <div className="w-full max-w-md">
        <div className={`${th.card} ${th.cardBorder} rounded-2xl shadow-2xl overflow-hidden`}>
          <div className={`px-7 pt-8 pb-6 relative overflow-hidden ${
            milk ? 'bg-[#f1eadb] text-[#1f2937]' : 'bg-[#0d1832] text-white'
          }`}>
            <div className={`absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl -translate-y-10 translate-x-10 ${milk ? 'bg-amber-400/25' : 'bg-amber-400/15'}`}></div>
            <div className="relative flex items-center gap-3 mb-5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shadow-md ${milk ? 'bg-[#1f2937] text-amber-400' : 'bg-white text-brand'}`}>T</div>
              <div>
                <div className={`font-black text-base tracking-tight ${th.strongText}`}>Global TradeCore</div>
                <div className={`text-[10px] ${th.textDim} tracking-wider font-semibold uppercase`}>Enterprise commerce ERP</div>
              </div>
            </div>
            <h2 className="relative text-lg font-black">
              {mode === 'forgot' ? t('Forgot Password') : t('Reset Password')}
            </h2>
            <p className={`relative text-[11px] ${th.textDim} font-semibold mt-1`}>
              {mode === 'forgot'
                ? t('Enter your account email and we will send you a secure one-time reset link.')
                : t('Choose a new password for your account. The reset link works only once and expires in 10 minutes.')}
            </p>
          </div>

          <div className="p-7 space-y-4">
            {done && message ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <p className="text-xs font-semibold text-emerald-800 leading-relaxed">{message}</p>
                </div>
                <button
                  onClick={backToLogin}
                  className={`w-full py-2.5 ${th.btnPrimary} ${th.btnPrimaryText} text-xs font-bold rounded-lg tracking-wider uppercase shadow transition cursor-pointer`}
                >
                  {t('Back to Sign In')}
                </button>
              </div>
            ) : (
              <form onSubmit={mode === 'forgot' ? submitForgot : submitReset} className="space-y-3.5">
                {mode === 'forgot' ? (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 block tracking-wider uppercase">{t('Email Address')}</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={inputCls + ' pl-9'}
                        placeholder="name@company.com"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 block tracking-wider uppercase">{t('New Password')}</label>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={inputCls}
                        placeholder="At least 6 characters"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 block tracking-wider uppercase">{t('Confirm New Password')}</label>
                      <input
                        type="password"
                        required
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        className={inputCls}
                        placeholder="Re-enter new password"
                      />
                    </div>
                  </>
                )}

                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                    <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[11px] font-semibold text-red-700 leading-relaxed">{error}</p>
                      {detail && (
                        <p className="text-[10px] font-mono text-red-500 leading-relaxed mt-1 break-all">{detail}</p>
                      )}
                    </div>
                  </div>
                )}

                {message && !done && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] font-semibold text-emerald-800 leading-relaxed">{message}</p>
                  </div>
                )}

                {testToken && testUrl && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1.5">
                      {t('Testing mode - SMTP not configured. Use this link:')}
                    </p>
                    <a
                      href={testUrl}
                      onClick={(e) => e.preventDefault()}
                      className="text-[11px] font-mono font-bold text-amber-800 break-all inline-flex items-center gap-1"
                    >
                      <KeyRound className="w-3.5 h-3.5 shrink-0" />
                      {testUrl}
                    </a>
                    <p className="text-[10px] text-amber-600 font-semibold mt-1.5">
                      {t('Token:')} <span className="font-mono">{testToken}</span>
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-2.5 ${th.btnPrimary} ${th.btnPrimaryText} text-xs font-bold rounded-lg tracking-wider uppercase shadow transition disabled:opacity-50 cursor-pointer`}
                >
                  {loading ? t('Please wait...') : mode === 'forgot' ? t('Send Reset Link') : t('Save New Password')}
                </button>
              </form>
            )}

            <div className={`pt-2 ${milk ? 'border-t border-amber-200/70' : 'border-t border-white/10'}`}>
              <button
                type="button"
                onClick={backToLogin}
                className={`w-full flex items-center justify-center gap-1.5 text-[11px] font-bold transition py-1 cursor-pointer ${milk ? 'text-gray-500 hover:text-amber-700' : 'text-gray-400 hover:text-brand'}`}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {t('Back to Sign In')}
              </button>
            </div>
          </div>
        </div>

        <p className={`text-center text-[10px] ${th.footerText} font-semibold mt-4 flex items-center justify-center gap-1`}>
          <ExternalLink className="w-3 h-3" />
          {t('Secure password reset • one-time token • 10-minute expiry')}
        </p>
      </div>
    </div>
  );
}
