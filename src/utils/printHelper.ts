export function isInIframe(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch (e) {
    return true;
  }
}

/**
 * Robust print helper designed to work seamlessly both inside sandboxed iframes (e.g. AI Studio preview)
 * and in top-level standalone windows.
 */
export function handlePrintWithFallback(
  onShowIframeWarning?: (title: string, desc: string) => void,
  lang?: 'en' | 'sw' | 'fr' | 'es'
) {
  const inIframe = isInIframe();
  let directPrintSucceeded = false;

  // 1. Attempt direct window print
  try {
    window.focus();
    window.print();
    directPrintSucceeded = true;
  } catch (err) {
    console.warn('[PrintHelper] window.print() exception (sandboxed/restricted):', err);
  }

  // 2. Attempt isolated dynamic iframe printing to bypass parent sandbox restrictions
  try {
    const existing = document.getElementById('tradecore-isolated-print-frame');
    if (existing) existing.remove();

    const pFrame = document.createElement('iframe');
    pFrame.id = 'tradecore-isolated-print-frame';
    pFrame.style.position = 'fixed';
    pFrame.style.right = '0';
    pFrame.style.bottom = '0';
    pFrame.style.width = '10px';
    pFrame.style.height = '10px';
    pFrame.style.opacity = '0.01';
    pFrame.style.pointerEvents = 'none';
    document.body.appendChild(pFrame);

    const doc = pFrame.contentWindow?.document;
    if (doc) {
      doc.open();
      let styles = '';
      document.querySelectorAll('style, link[rel="stylesheet"]').forEach(el => {
        styles += el.outerHTML;
      });

      // Target printable receipt/report container or fallback to body content
      const printTarget =
        document.querySelector('#receipt-print') ||
        document.querySelector('.printable-area') ||
        document.querySelector('.print-content') ||
        document.querySelector('#printable-receipt') ||
        document.querySelector('[data-printable="true"]');

      const bodyHtml = printTarget ? printTarget.outerHTML : document.body.innerHTML;

      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>TradeCore ERP - Print</title>
            ${styles}
            <style>
              @media print {
                .no-print, aside, header, nav, button, input, select { display: none !important; }
              }
              body { background: white !important; color: black !important; padding: 16px; font-family: system-ui, -apple-system, sans-serif; }
            </style>
          </head>
          <body>
            ${bodyHtml}
          </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        try {
          pFrame.contentWindow?.focus();
          pFrame.contentWindow?.print();
        } catch (iframeErr) {
          console.warn('[PrintHelper] Isolated iframe print failed:', iframeErr);
        } finally {
          setTimeout(() => {
            try { pFrame.remove(); } catch {}
          }, 3500);
        }
      }, 250);
    }
  } catch (err) {
    console.warn('[PrintHelper] Isolated print container failed:', err);
  }

  // 3. If running inside an iframe, always inform the user via the modal callback with helpful guidance
  if (inIframe && onShowIframeWarning) {
    const isSw = lang === 'sw' || (!lang && (typeof document !== 'undefined' && document.documentElement.lang === 'sw'));
    const title = isSw
      ? 'Chapa Hati (Print & Export)'
      : 'Print & Export Document';
    const desc = isSw
      ? 'Amri ya kuchapa imetumwa. Ikiwa kivinjari kinazuia dirisha la print kwenye iFrame ya preview, unaweza pia kutumia vitufe vya "PDF" au "Excel" kupakua risiti au ripoti hii mara moja.'
      : 'Print command initiated. If your browser restricts pop-up print dialogs inside this preview frame, you can also use the direct "PDF" or "Excel" buttons to download this document instantly.';

    onShowIframeWarning(title, desc);
  }
}

