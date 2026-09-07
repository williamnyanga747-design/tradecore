// Chart.js is loaded at runtime from a CDN (unpkg), not from npm,
// so its types are treated as `any`.
export type ChartJsModule = any;

let jsPromise: Promise<ChartJsModule> | null = null;

const CHART_VERSION = '4.4.3';

export function loadChartJs(): Promise<ChartJsModule> {
  if (jsPromise) return jsPromise;
  jsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-chartjs-js]') as HTMLScriptElement | null;
    if (existing && (window as any).Chart) {
      resolve((window as any).Chart);
      return;
    }
    const script = document.createElement('script');
    script.src = `https://unpkg.com/chart.js@${CHART_VERSION}/dist/chart.umd.js`;
    script.dataset.chartjsJs = 'true';
    script.onload = () => {
      const Chart = (window as any).Chart as ChartJsModule;
      if (Chart) {
        resolve(Chart);
      } else {
        reject(new Error('Chart.js failed to initialize'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load Chart.js'));
    document.head.appendChild(script);
  });
  jsPromise.catch(() => { jsPromise = null; });
  return jsPromise;
}
