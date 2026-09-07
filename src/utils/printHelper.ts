import { translate } from './format';

export function isInIframe(): boolean {
  return false;
}

export function handlePrintWithFallback(
  onShowIframeWarning: (title: string, desc: string) => void,
  lang?: 'en' | 'sw' | 'fr' | 'es'
) {
  try {
    window.focus();
    window.print();
  } catch (e) {
    console.error('Print action exception:', e);
  }
}

