// Leaflet is loaded at runtime from a CDN (unpkg), not from npm,
// so its types are treated as `any`.
export type LeafletMapModule = any;

let cssPromise: Promise<void> | null = null;
let jsPromise: Promise<LeafletMapModule> | null = null;

const LEAFLET_VERSION = '1.9.4';

function loadCss(): Promise<void> {
  if (document.querySelector('link[data-leaflet-css]')) return Promise.resolve();
  cssPromise = new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
    link.dataset.leafletCss = 'true';
    link.onload = () => resolve();
    link.onerror = () => reject(new Error('Failed to load Leaflet CSS'));
    document.head.appendChild(link);
  });
  return cssPromise;
}

export function loadLeaflet(): Promise<LeafletMapModule> {
  if (jsPromise) return jsPromise;
  jsPromise = loadCss().then(() => {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-leaflet-js]') as HTMLScriptElement | null;
      if (existing && (window as any).L) {
        resolve((window as any).L);
        return;
      }
      const script = document.createElement('script');
      script.src = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;
      script.dataset.leafletJs = 'true';
      script.onload = () => {
        const L = (window as any).L as LeafletMapModule;
        if (L) {
          resolve(L);
        } else {
          reject(new Error('Leaflet failed to initialize'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load Leaflet JS'));
      document.head.appendChild(script);
    });
  });
  jsPromise.catch(() => { jsPromise = null; });
  return jsPromise;
}
