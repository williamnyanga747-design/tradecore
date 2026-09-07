import Cookies from 'js-cookie';

export type LangCode = 'en' | 'sw' | 'fr' | 'es';

export const LANGUAGES: Array<{ code: LangCode; flag: string; label: string }> = [
  { code: 'en', flag: '🇬🇧', label: 'English' },
  { code: 'sw', flag: '🇹🇿', label: 'Kiswahili' },
  { code: 'fr', flag: '🇫🇷', label: 'Français' },
  { code: 'es', flag: '🇪🇸', label: 'Español' }
];

export const LANG_STORAGE_KEY = 'app_language';
export const LOCALE_COOKIE_KEY = 'app_locale';
export const DEFAULT_LANG: LangCode = 'en';
export const LOCALE_COOKIE_MAX_AGE_DAYS = 365;

function sanitizeLang(v: unknown): LangCode | null {
  return isLangCode(v) ? v : null;
}

export function getLocaleCookie(): LangCode | null {
  try {
    return sanitizeLang(Cookies.get(LOCALE_COOKIE_KEY));
  } catch (e) {}
  return null;
}

export function setLocaleCookie(lang: LangCode, expiresDays: number = LOCALE_COOKIE_MAX_AGE_DAYS): void {
  try {
    Cookies.set(LOCALE_COOKIE_KEY, lang, { expires: expiresDays, path: '/', sameSite: 'Lax' });
  } catch (e) {}
}

// On first visit (no cookie, no localStorage, no DB) the default is English.
export function ensureLocaleCookie(lang: LangCode = DEFAULT_LANG): void {
  if (getLocaleCookie() === null) {
    setLocaleCookie(lang);
  }
}

export function getStoredLanguage(): LangCode {
  try {
    const v = localStorage.getItem(LANG_STORAGE_KEY);
    const fromStorage = sanitizeLang(v);
    if (fromStorage) return fromStorage;
  } catch (e) {}
  const fromCookie = getLocaleCookie();
  if (fromCookie) return fromCookie;
  return DEFAULT_LANG;
}

export function setStoredLanguage(lang: LangCode): void {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch (e) {}
  setLocaleCookie(lang);
}

// Marketplace customers log in on shared devices, so their language preference
// must be scoped to their own account to stop it leaking between device users.
const SCOPED_LANG_PREFIX = 'app_language_';

export function getScopedStoredLanguage(scope: string): LangCode {
  if (scope) {
    try {
      const v = localStorage.getItem(`${SCOPED_LANG_PREFIX}${scope}`);
      if (isLangCode(v)) return v;
    } catch (e) {}
  }
  return getStoredLanguage();
}

export function setScopedStoredLanguage(scope: string, lang: LangCode): void {
  if (scope) {
    try {
      localStorage.setItem(`${SCOPED_LANG_PREFIX}${scope}`, lang);
    } catch (e) {}
  } else {
    setStoredLanguage(lang);
    return;
  }
  setLocaleCookie(lang);
}

export function clearScopedStoredLanguage(scope: string): void {
  if (!scope) return;
  try {
    localStorage.removeItem(`${SCOPED_LANG_PREFIX}${scope}`);
  } catch (e) {}
}

// --- Admin panel user-level language override ---
// Separate from the company language setting so each admin user can work in their
// preferred language without affecting other users of the same company.
const ADMIN_LANG_KEY = 'admin_user_language';

export function getUserAdminLanguage(): LangCode | null {
  try {
    const v = localStorage.getItem(ADMIN_LANG_KEY);
    return sanitizeLang(v);
  } catch (e) {}
  return null;
}

export function setUserAdminLanguage(lang: LangCode): void {
  try {
    localStorage.setItem(ADMIN_LANG_KEY, lang);
  } catch (e) {}
  setLocaleCookie(lang);
}

export function clearUserAdminLanguage(): void {
  try {
    localStorage.removeItem(ADMIN_LANG_KEY);
  } catch (e) {}
}

export function isLangCode(v: unknown): v is LangCode {
  return v === 'en' || v === 'sw' || v === 'fr' || v === 'es';
}

// Keep <html lang="..."> in sync with the active locale (SPA equivalent of Blade's lang attribute).
export function syncDocumentLang(lang: LangCode): void {
  try {
    document.documentElement.lang = lang;
  } catch (e) {}
}
